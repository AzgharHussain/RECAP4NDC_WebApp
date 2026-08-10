const express = require('express');
const router = express.Router();
const axios = require('axios');
const xml2js = require('xml2js');
const jwt = require('jsonwebtoken');
const { logFromRequest } = require('../utils/auditLogger');
const { sequelize } = require('../config/database');
const bcrypt = require('bcrypt');

// Lazy-load notifications router to avoid circular dependency at startup.
// This lets us trigger pending notifications on login.
let sendPendingNotificationsFromPreviousMonth = null;
function getPendingNotificationsFn() {
  if (!sendPendingNotificationsFromPreviousMonth) {
    try {
      const notificationsRouter = require('./notifications');
      sendPendingNotificationsFromPreviousMonth = notificationsRouter.sendPendingNotificationsFromPreviousMonth;
    } catch (e) {
      console.warn('Could not load sendPendingNotificationsFromPreviousMonth:', e.message);
    }
  }
  return sendPendingNotificationsFromPreviousMonth;
}

const SECRET_KEY = process.env.JWT_SECRET;

router.post('/forest-login', async (req, res) => {
  const { username, password } = req.body;


  if (!username || !password) {
    return res.status(400).json({
      success: false,
      error: 'Username and password are required'
    });
  }

  const soapRequest = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <LOGIN_EGUJFOREST xmlns="http://tempuri.org/">
      <username>${username}</username>
      <password>${password}</password>
    </LOGIN_EGUJFOREST>
  </soap:Body>
</soap:Envelope>`;


  try {
    const soapUrl = process.env.SOAP_API_URL;
    const response = await axios.post(soapUrl, soapRequest, {
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://tempuri.org/LOGIN_EGUJFOREST'
      },
      timeout: 30000,
      // Bypass any HTTP_PROXY/HTTPS_PROXY env vars — the SOAP service is on
      // the internal Gujarat govt network (172.16.0.0/16) and the Cisco WSA
      // proxy blocks this host with "BLOCK-DEST / GujaratDenied".
      proxy: false,
    });


    const parsed = await xml2js.parseStringPromise(response.data, {
      explicitArray: false,
      mergeAttrs: true,
      tagNameProcessors: [xml2js.processors.stripPrefix]
    });


    const envelope = parsed['Envelope'] || parsed;
    const body = envelope && envelope['Body'];

    if (!body) {
      throw new Error('Invalid SOAP response: No Body found');
    }

    // Check for SOAP Fault
    if (body['Fault']) {
      const fault = body['Fault'];
      console.error('SOAP Fault:', JSON.stringify(fault, null, 2));
      return res.status(500).json({
        success: false,
        error: 'Forest service returned a fault',
        faultCode: fault.faultcode || fault.code || 'Unknown',
        faultString: fault.faultstring || fault.reason || 'Unknown error'
      });
    }

    const loginResponse = body['LOGIN_EGUJFORESTResponse'];
    if (!loginResponse) {
      throw new Error('No LOGIN_EGUJFORESTResponse found');
    }

    const resultData = loginResponse['LOGIN_EGUJFORESTResult'];
    if (!resultData) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials - empty result',
        rawXml: response.data.substring(0, 500)
      });
    }

    // Extract user data from diffgram
    const userData = extractUserDataFromSoapResult(resultData);


    if (!userData || Object.keys(userData).length === 0) {
      logFromRequest(req, {
        action: 'LOGIN_FAILED',
        status: 'FAILED',
        statusCode: 401,
        username,
        errorMessage: 'No user data found in SOAP response',
      });
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials - no user data found',
        rawXml: response.data.substring(0, 500)
      });
    }

    if (!userData.NAME || userData.NAME === '-') {
      logFromRequest(req, {
        action: 'LOGIN_FAILED',
        status: 'FAILED',
        statusCode: 401,
        username,
        errorMessage: 'NAME field empty or dash',
      });
      return res.status(401).json({
        success: false,
        error: 'Invalid user credentials',
        userData: userData
      });
    }

    logFromRequest(req, {
      action: 'LOGIN',
      status: 'SUCCESS',
      statusCode: 200,
      username,
      resourceType: 'user_session',
      details: { name: userData.NAME, division: userData.DivisionName },
    });

    // Generate JWT token so the frontend doesn't need a separate /saveuser call
    let token = null;
    try {
      // Check if user exists in database, create if not
      const trimmedUsername = username.trim();
      const [users] = await sequelize.query(
        `SELECT user_id, username FROM public.government_department_users WHERE username = $1`,
        { bind: [trimmedUsername] }
      );

      let user;
      if (users.length > 0) {
        user = users[0];
      } else {
        const [insertResult] = await sequelize.query(
          `INSERT INTO public.government_department_users (username) VALUES ($1) RETURNING user_id, username`,
          { bind: [trimmedUsername] }
        );
        user = insertResult[0];
      }

      token = jwt.sign(
        {
          userId: user.user_id,
          username: user.username,
          name: userData.NAME,
          cadre: userData.CadreName,
          circle: userData.CircleName,
          division: userData.DivisionName,
          range: userData.RangeName,
          round: userData.RoundName,
          beat: userData.BeatName,
          mobile: userData.MobileNo,
          email: userData.EmailID
        },
        SECRET_KEY,
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
      );
    } catch (dbErr) {
      console.error('Database error during forest-login token generation:', dbErr.message);
      // Continue without token — frontend will handle via saveuser fallback
    }

    // Set token as HTTP-only cookie (backup auth mechanism)
    if (token) {
      res.cookie('authToken', token, {
        httpOnly: false, // Frontend needs to read it via js-cookie
        secure: false,   // Set to true in production with HTTPS
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });
    }

    // === Fire-and-forget: send pending notifications from previous month ===
    // Runs AFTER the response is sent so it doesn't slow down login.
    // The user must be subscribed (have a firebase_token in ndvi_notification_users).
    // If not subscribed yet, this is a no-op.
    const loginUsername = username.trim();
    setImmediate(async () => {
      try {
        const fn = getPendingNotificationsFn();
        if (!fn) return;

        // Use the shared sequelize connection — NOT a new pg.Pool (which leaks connections)
        const [subRows] = await sequelize.query(
          'SELECT firebase_token FROM public.ndvi_notification_users WHERE user_id = $1 AND firebase_token IS NOT NULL',
          { bind: [loginUsername] }
        );

        if (subRows.length === 0) {
          return;
        }

        const fbToken = subRows[0].firebase_token;
        const result = await fn(loginUsername, fbToken);
      } catch (e) {
        console.error('[login-notifications] Error:', e.message);
      }
    });

    return res.json({
      success: true,
      jsonMap: userData,
      token, // Include token in response so frontend can save to localStorage
      message: 'Authentication successful'
    });

  } catch (error) {
    console.error('SOAP proxy error:', error.message);

    // Axios throws on non-2xx — inspect error.response
    if (error.response) {
      console.error('HTTP Status:', error.response.status);
      console.error('Response Data:', error.response.data);

      // Try to parse SOAP fault from error response
      try {
        const errorParsed = await xml2js.parseStringPromise(error.response.data, {
          explicitArray: false,
          mergeAttrs: true,
          tagNameProcessors: [xml2js.processors.stripPrefix]
        });
        console.error('Parsed error response:', JSON.stringify(errorParsed, null, 2).substring(0, 2000));

        const errBody = errorParsed['Envelope'] && errorParsed['Envelope']['Body'];
        if (errBody && errBody['Fault']) {
          const fault = errBody['Fault'];
          logFromRequest(req, {
            action: 'LOGIN_FAILED',
            status: 'FAILED',
            statusCode: error.response.status,
            username,
            errorMessage: fault.faultstring || fault.reason || 'SOAP Fault',
          });
          return res.status(error.response.status).json({
            success: false,
            error: 'Forest service fault',
            faultCode: fault.faultcode || fault.code || 'Unknown',
            faultString: fault.faultstring || fault.reason || 'Unknown error'
          });
        }
      } catch (parseErr) {
        console.error('Could not parse error response as XML:', parseErr.message);
      }
    }

    logFromRequest(req, {
      action: 'LOGIN_FAILED_SOAP',
      status: 'ERROR',
      statusCode: error.code === 'ECONNABORTED' ? 504 : 502,
      username: req.body && req.body.username,
      errorMessage: error.message,
    });

    // Fallback: Check local database (admin table) if SOAP fails
    try {
      const trimmedUsername = req.body.username.trim();
      const [localUsers] = await sequelize.query(
        `SELECT username, password FROM admin WHERE username = :trimmedUsername`,
        { replacements: { trimmedUsername } }
      );

      if (localUsers.length > 0) {
        const user = localUsers[0];
        const isPasswordValid = await bcrypt.compare(req.body.password.trim(), user.password);

        if (isPasswordValid) {

          const userData = {
            NAME: user.username,
            NameOfPost: "Admin (Fallback)",
            CadreName: "-",
            CircleName: "-",
            DivisionName: "-",
            RangeName: "-",
            RoundName: "-",
            BeatName: "-",
            MobileNo: "-",
            EmailID: "-"
          };

          logFromRequest(req, {
            action: 'LOGIN_FALLBACK',
            status: 'SUCCESS',
            statusCode: 200,
            username: trimmedUsername,
            resourceType: 'user_session',
            details: { name: userData.NAME }
          });

          // Fire-and-forget: send pending notifications from previous month
          setImmediate(async () => {
            try {
              const fn = getPendingNotificationsFn();
              if (!fn) return;
              // Use shared sequelize connection — no new pg.Pool
              const [subRows] = await sequelize.query(
                'SELECT firebase_token FROM public.ndvi_notification_users WHERE user_id = $1 AND firebase_token IS NOT NULL',
                { bind: [trimmedUsername] }
              );
              if (subRows.length === 0) return;
              const result = await fn(trimmedUsername, subRows[0].firebase_token);
            } catch (e) {
              console.error('[login-notifications] Fallback error:', e.message);
            }
          });

          return res.json({
            success: true,
            jsonMap: userData,
            token: jwt.sign({ username: trimmedUsername, name: user.username }, SECRET_KEY, { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }),
            message: 'Authentication successful (Local Fallback)'
          });
        }
      }
    } catch (fallbackError) {
      console.error('Local fallback failed:', fallbackError.message);
    }

    let errorMessage = error.message;
    let errorCode = 500;

    if (error.code === 'ECONNABORTED') {
      errorMessage = 'Request timeout - Gujarat Forest Service is not responding';
      errorCode = 504;
    } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      errorMessage = 'Cannot connect to Gujarat Forest Service (DNS/connection refused)';
      errorCode = 502;
    } else if (error.code === 'ECONNRESET' || /socket hang up/i.test(error.message)) {
      errorMessage = 'Gujarat Forest Service closed the connection (socket hang up). Check server IP allowlisting, firewall, and VPN.';
      errorCode = 502;
      console.error('[SOAP] Socket hang up — likely IP not allowlisted by Forest dept, or firewall/VPN issue. Server IP:', require('os').hostname());
    } else if (error.response) {
      errorCode = error.response.status;
      errorMessage = 'Forest service returned status ' + error.response.status;
    }

    return res.status(errorCode).json({
      success: false,
      error: errorMessage,
      details: error.code || 'Unknown error'
    });
  }
});

function extractUserDataFromSoapResult(resultData) {
  const userData = {};


  try {
    // Method 1: diffgram structure
    if (resultData.diffgram && resultData.diffgram.DocumentElement) {
      const documentElement = resultData.diffgram.DocumentElement;

      if (documentElement.Result) {
        const result = documentElement.Result;

        Object.keys(result).forEach(key => {
          if (!key.startsWith('$') && !key.includes(':') && !key.includes('@')) {
            const value = result[key];
            if (value !== null && value !== undefined && value !== '') {
              userData[key] = value;
            }
          }
        });

        return userData;
      }
    }

    // Method 2: Direct Result object
    if (resultData.Result) {
      const result = resultData.Result;
      Object.keys(result).forEach(key => {
        if (!key.startsWith('$') && !key.includes(':') && !key.includes('@')) {
          const value = result[key];
          if (value !== null && value !== undefined && value !== '') {
            userData[key] = value;
          }
        }
      });

      if (Object.keys(userData).length > 0) {
        return userData;
      }
    }

    // Method 3: Direct fields
    const expectedFields = ['NAME', 'NameOfPost', 'CadreName', 'CircleName',
                           'DivisionName', 'RangeName', 'RoundName', 'BeatName',
                           'MobileNo', 'EmailID'];

    let hasUserData = false;
    expectedFields.forEach(field => {
      if (resultData[field] && resultData[field] !== '') {
        userData[field] = resultData[field];
        hasUserData = true;
      }
    });

    if (hasUserData) {
      return userData;
    }

    // Method 4: Recursive search
    const findDataRecursively = (obj, depth) => {
      if (depth > 5) return;

      if (typeof obj === 'object' && obj !== null) {
        Object.keys(obj).forEach(key => {
          if (key.startsWith('$') || key.includes(':') || key.includes('@')) {
            return;
          }

          const value = obj[key];
          if (typeof value === 'string' && value.trim() !== '') {
            if (expectedFields.includes(key) && !userData[key]) {
              userData[key] = value;
            }
          } else if (typeof value === 'object' && value !== null) {
            findDataRecursively(value, depth + 1);
          }
        });
      }
    };

    findDataRecursively(resultData, 0);

    if (Object.keys(userData).length > 0) {
      return userData;
    }


  } catch (error) {
    console.error('Error extracting user data:', error);
  }

  return userData;
}

module.exports = router;

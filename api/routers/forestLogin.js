const express = require('express');
const router = express.Router();
const axios = require('axios');
const xml2js = require('xml2js');
const { logFromRequest } = require('../utils/auditLogger');
const { sequelize } = require('../config/database');
const bcrypt = require('bcrypt');

router.post('/forest-login', async (req, res) => {
  const { username, password } = req.body;

  console.log('=== FOREST LOGIN REQUEST ===');
  console.log('Username:', username);

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

  console.log('SOAP Request:');
  console.log(soapRequest);

  try {
    const soapUrl = process.env.SOAP_API_URL;
    const response = await axios.post(soapUrl, soapRequest, {
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://tempuri.org/LOGIN_EGUJFOREST'
      },
      timeout: 30000
    });

    console.log('Response Status:', response.status);
    console.log('Response Headers:', response.headers);
    console.log('Raw SOAP Response:', response.data);

    const parsed = await xml2js.parseStringPromise(response.data, {
      explicitArray: false,
      mergeAttrs: true,
      tagNameProcessors: [xml2js.processors.stripPrefix]
    });

    console.log('Parsed XML structure:', JSON.stringify(parsed, null, 2).substring(0, 2000));

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

    console.log('Extracted user data:', userData);

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

    return res.json({
      success: true,
      jsonMap: userData,
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
          console.log('Fallback to local database authentication successful for:', trimmedUsername);

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

          return res.json({
            success: true,
            jsonMap: userData,
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
      errorMessage = 'Cannot connect to Gujarat Forest Service';
      errorCode = 502;
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

  console.log('Extracting user data from result...');

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

        console.log('Extracted via diffgram method:', userData);
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
        console.log('Extracted via Result method:', userData);
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
      console.log('Extracted via direct method:', userData);
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
      console.log('Extracted via recursive method:', userData);
      return userData;
    }

    console.log('No user data found in result structure');
    console.log('Result data:', JSON.stringify(resultData, null, 2).substring(0, 1000));

  } catch (error) {
    console.error('Error extracting user data:', error);
  }

  return userData;
}

module.exports = router;

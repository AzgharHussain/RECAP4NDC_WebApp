const express = require("express");
const axios = require("axios");
const xml2js = require("xml2js");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const { sequelize } = require('../config/database');
const { logFromRequest } = require('../utils/auditLogger');

const SECRET_KEY = process.env.JWT_SECRET;

// Rate limiter tuned for high concurrency (5000 users).
// Allows 300 requests per 15 minutes per IP — enough for office/NAT users
// while still preventing brute-force attacks.
const saveUserLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many requests. Please try again after 15 minutes."
  },
});

router.post("/saveuser", saveUserLimiter, async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      error: "Username and password are required"
    });
  }

  try {

    const soapRequest = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <LOGIN_EGUJFOREST xmlns="http://tempuri.org/">
      <username>${username}</username>
      <password>${password}</password>
    </LOGIN_EGUJFOREST>
  </soap:Body>
</soap:Envelope>`;


    const soapUrl = process.env.SOAP_API_URL;
    const response = await axios.post(soapUrl, soapRequest, {
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "SOAPAction": "http://tempuri.org/LOGIN_EGUJFOREST"
      },
      timeout: 30000
    });


    const parsed = await xml2js.parseStringPromise(response.data, {
      explicitArray: false,
      mergeAttrs: true,
      tagNameProcessors: [xml2js.processors.stripPrefix]
    });


    const envelope = parsed['Envelope'] || parsed;
    const body = envelope && envelope['Body'];

    if (!body) {
      console.error("No Body found in SOAP response");
      return res.status(500).json({
        success: false,
        error: "Invalid SOAP response - no Body element"
      });
    }

    // Check for SOAP Fault
    if (body['Fault']) {
      const fault = body['Fault'];
      console.error("SOAP Fault:", JSON.stringify(fault, null, 2));
      return res.status(500).json({
        success: false,
        error: "Forest service returned a fault",
        faultCode: fault.faultcode || fault.code || "Unknown",
        faultString: fault.faultstring || fault.reason || "Unknown error"
      });
    }

    const loginResponse = body['LOGIN_EGUJFORESTResponse'];
    if (!loginResponse) {
      console.error("No LOGIN_EGUJFORESTResponse in body. Body keys:", Object.keys(body));
      return res.status(500).json({
        success: false,
        error: "Invalid response from forest service"
      });
    }

    const loginResult = loginResponse['LOGIN_EGUJFORESTResult'];
    if (!loginResult) {
      console.error("No LOGIN_EGUJFORESTResult in response");
      return res.status(401).json({
        success: false,
        error: "Invalid credentials - empty result"
      });
    }

    // The user data is inside diffgram > DocumentElement > Result
    const diffgram = loginResult['diffgram'];
    const documentElement = diffgram && diffgram['DocumentElement'];
    const result = documentElement && (documentElement['Result'] || documentElement['result']);

    if (!result) {
      console.error("No Result in diffgram. loginResult keys:", Object.keys(loginResult));
      return res.status(401).json({
        success: false,
        error: "Invalid credentials - no user data found"
      });
    }

    const userResult = Array.isArray(result) ? result[0] : result;

    const userData = {
      NAME: userResult.NAME || "-",
      NameOfPost: userResult.NameOfPost || "-",
      CadreName: userResult.CadreName || "-",
      CircleName: userResult.CircleName || "-",
      DivisionName: userResult.DivisionName || "-",
      RangeName: userResult.RangeName || "-",
      RoundName: userResult.RoundName || "-",
      BeatName: userResult.BeatName || "-",
      MobileNo: userResult.MobileNo || "-",
      EmailID: userResult.EmailID || "-"
    };


    if (!userData.NAME || userData.NAME === "-") {
      logFromRequest(req, {
        action: 'LOGIN_FAILED',
        status: 'FAILED',
        statusCode: 401,
        username: username,
        errorMessage: 'Invalid credentials from SOAP service',
      });
      return res.status(401).json({
        success: false,
        error: "Invalid credentials"
      });
    }

    // Check if user exists in database
    const trimmedUsername = username.trim();

    const [users] = await sequelize.query(
      `SELECT user_id, username FROM public.government_department_users WHERE username = $1`,
      { bind: [trimmedUsername] }
    );

    let user;
    let isNewUser = false;

    if (users.length > 0) {
      user = users[0];
    } else {
      const [insertResult] = await sequelize.query(
        `INSERT INTO public.government_department_users (username) VALUES ($1) RETURNING user_id, username`,
        { bind: [trimmedUsername] }
      );
      user = insertResult[0];
      isNewUser = true;
    }

    const token = jwt.sign(
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

    logFromRequest(req, {
      action: 'LOGIN',
      status: 'SUCCESS',
      statusCode: 200,
      userId: user.user_id,
      username: user.username,
      resourceType: 'user_session',
      details: { name: userData.NAME, division: userData.DivisionName, isNewUser },
    });

    return res.json({
      success: true,
      token,
      user: {
        ...userData,
        db_user_id: user.user_id,
        is_new_user: isNewUser
      }
    });

  } catch (error) {
    console.error("Forest login error:", error.message);

    // Axios throws on non-2xx responses — inspect error.response
    if (error.response) {
      console.error("HTTP Status:", error.response.status);
      console.error("Response Headers:", error.response.headers);
      console.error("Response Data:", error.response.data);

      // Try to parse SOAP fault from error response
      try {
        const errorParsed = await xml2js.parseStringPromise(error.response.data, {
          explicitArray: false,
          mergeAttrs: true,
          tagNameProcessors: [xml2js.processors.stripPrefix]
        });
        console.error("Parsed error response:", JSON.stringify(errorParsed, null, 2).substring(0, 2000));

        const errBody = errorParsed['Envelope'] && errorParsed['Envelope']['Body'];
        if (errBody && errBody['Fault']) {
          const fault = errBody['Fault'];
          logFromRequest(req, {
            action: 'LOGIN_FAILED',
            status: 'FAILED',
            statusCode: error.response.status,
            username: req.body && req.body.username,
            errorMessage: fault.faultstring || fault.reason || 'SOAP Fault',
          });
          return res.status(error.response.status).json({
            success: false,
            error: "Forest service error",
            faultCode: fault.faultcode || fault.code || "Unknown",
            faultString: fault.faultstring || fault.reason || "Unknown error"
          });
        }
      } catch (parseErr) {
        console.error("Could not parse error response as XML:", parseErr.message);
      }

      logFromRequest(req, {
        action: 'LOGIN_FAILED',
        status: 'FAILED',
        statusCode: error.response.status,
        username: req.body && req.body.username,
        errorMessage: error.message,
      });

      return res.status(error.response.status).json({
        success: false,
        error: "Forest service error: " + error.response.status
      });
    }

    if (error.code === 'ECONNABORTED') {
      logFromRequest(req, {
        action: 'LOGIN_FAILED',
        status: 'ERROR',
        statusCode: 504,
        username: req.body && req.body.username,
        errorMessage: 'Request timeout',
      });
      return res.status(504).json({
        success: false,
        error: "Forest service timeout"
      });
    }

    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      logFromRequest(req, {
        action: 'LOGIN_FAILED',
        status: 'ERROR',
        statusCode: 502,
        username: req.body && req.body.username,
        errorMessage: 'Cannot connect to forest service',
      });
      return res.status(502).json({
        success: false,
        error: "Cannot connect to Gujarat Forest Service"
      });
    }

    // Database errors
    if (error.name === 'SequelizeError' || (error.code && error.code.startsWith('23'))) {
      console.error("Database error:", error.message);
      return res.status(500).json({
        success: false,
        error: "Database error occurred"
      });
    }

    logFromRequest(req, {
      action: 'LOGIN_FAILED',
      status: 'ERROR',
      statusCode: 500,
      username: req.body && req.body.username,
      errorMessage: error.message,
    });

    return res.status(500).json({
      success: false,
      error: "Forest authentication failed"
    });
  }
});

module.exports = router;

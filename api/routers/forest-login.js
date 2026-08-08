const express = require("express");
const axios = require("axios");
const xml2js = require("xml2js");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const { sequelize } = require('../config/database');
const { logFromRequest } = require('../utils/auditLogger');
// Define secret key (should be in environment variables in production)
const SECRET_KEY = process.env.JWT_SECRET || "your-secret-key-change-this-in-production";

const saveUserLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Allow only 5 requests per IP per 15 mins
  message: {
    success: false,
    error: "Too many requests. Please try again after 15 minutes."
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/saveuser", saveUserLimiter, async (req, res) => {
  const { username, password } = req.body;

  // Validate input
  if (!username || !password) {
    return res.status(400).json({
      success: false,
      error: "Username and password are required"
    });
  }

  try {
    console.log("🌲 Calling EGUJ Forest SOAP service with username:", username);

    const soapRequest = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
xmlns:xsd="http://www.w3.org/2001/XMLSchema"
xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <LOGIN_EGUJFOREST xmlns="http://tempuri.org/">
      <username>${username}</username>
      <password>${password}</password>
    </LOGIN_EGUJFOREST>
  </soap:Body>
</soap:Envelope>`;

    const response = await axios.post(
      "https://egujforest.gujarat.gov.in/FMIS/CommonService/forestcommonservice.asmx",
      soapRequest,
      {
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          "SOAPAction": "http://tempuri.org/LOGIN_EGUJFOREST"
        },
        timeout: 30000,
      }
    );

    if (response.status !== 200) {
      return res.status(500).json({ 
        success: false,
        error: "Forest service unavailable" 
      });
    }

    // Parse XML — use stripPrefix to remove namespace prefixes (soap:, diffgr:, etc.)
    console.log("Raw SOAP response:", response.data);
    const parsed = await xml2js.parseStringPromise(response.data, {
      explicitArray: false,
      mergeAttrs: true,
      tagNameProcessors: [xml2js.processors.stripPrefix]
    });

    // Navigate through the response structure (prefixes stripped)
    const envelope = parsed['Envelope'] || parsed;
    const body = envelope?.['Body'];
    const loginResponse = body?.['LOGIN_EGUJFORESTResponse'];
    const loginResult = loginResponse?.['LOGIN_EGUJFORESTResult'];

    if (!loginResult) {
      console.error("SOAP response missing LOGIN_EGUJFORESTResult. Parsed structure:", JSON.stringify(parsed, null, 2).substring(0, 1000));
      return res.status(500).json({
        success: false,
        error: "Invalid response from forest service"
      });
    }

    // The user data is in the diffgram (prefix stripped)
    const diffgram = loginResult['diffgram'];
    const documentElement = diffgram?.['DocumentElement'];
    const result = documentElement?.['Result'] || documentElement?.['result'];

    if (!result) {
      console.error("No Result in diffgram. loginResult keys:", Object.keys(loginResult));
      return res.status(401).json({
        success: false,
        message: "Invalid credentials - no user data found"
      });
    }

    // Extract user data (handling both array and object responses)
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

    console.log("User Data:", userData);

    // ✅ VERIFY LOGIN
    if (!userData.NAME || userData.NAME === "-") {
      console.error("NAME field empty or '-'. userResult:", JSON.stringify(userResult, null, 2).substring(0, 500));
      logFromRequest(req, {
        action: 'LOGIN_FAILED',
        status: 'FAILED',
        statusCode: 401,
        username: username,
        errorMessage: 'Invalid credentials from SOAP service',
      });
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    // ✅ CHECK IF USER EXISTS IN DATABASE
    const trimmedUsername = username.trim();
    
    console.log('Checking if user exists in database with username:', trimmedUsername);
    
    // Check if user exists
    const [users] = await sequelize.query(
      `SELECT user_id, username FROM public.government_department_users WHERE username = $1`,
      { bind: [trimmedUsername] }
    );

    console.log('User query result:', users);

    let user;
    let isNewUser = false;
    
    if (users.length > 0) {
      user = users[0];
      console.log('User already exists:', user);
    } else {
      // Insert new user
      const [result] = await sequelize.query(
  `INSERT INTO public.government_department_users (username) 
   VALUES ($1) 
   RETURNING user_id, username`,
  { bind: [trimmedUsername] }
);
      user = result[0];
      isNewUser = true;
      console.log('New user created:', user);
    }

    // ✅ GENERATE JWT with user data including database user_id
    const token = jwt.sign(
      {
        userId: user.user_id, // Use database user_id
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
      // {
      //   expiresIn: "24h"
      // }
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

    logFromRequest(req, {
      action: 'LOGIN_FAILED',
      status: 'ERROR',
      statusCode: error.code === 'ECONNABORTED' ? 504 : 500,
      username: req.body?.username || null,
      errorMessage: error.message,
    });
    
    // Handle specific error types
    if (error.code === 'ECONNABORTED') {
      return res.status(504).json({
        success: false,
        error: "Forest service timeout"
      });
    }
    
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", error.response.data);
      return res.status(error.response.status).json({
        success: false,
        error: `Forest service error: ${error.response.status}`
      });
    }

    // Handle database errors
    if (error.name === 'SequelizeError' || error.code?.startsWith('23')) {
      return res.status(500).json({
        success: false,
        error: "Database error occurred"
      });
    }

    return res.status(500).json({
      success: false,
      error: "Forest authentication failed"
    });
  }
});

module.exports = router;
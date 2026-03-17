const express = require("express");
const axios = require("axios");
const xml2js = require("xml2js");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const router = express.Router();

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
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
xmlns:xsd="http://www.w3.org/2001/XMLSchema"
xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <LOGIN_EGUJFOREST xmlns="http://tempuri.org/">
      <username>${username}</username>
      <password>${password}</password>
    </LOGIN_EGUJFOREST>
  </soap12:Body>
</soap12:Envelope>`;

    const response = await axios.post(
      "https://egujforest.gujarat.gov.in/FMIS/CommonService/forestcommonservice.asmx",
      soapRequest,
      {
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          SOAPAction: "http://tempuri.org/LOGIN_EGUJFOREST",
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

    // Parse XML
    const parsed = await xml2js.parseStringPromise(response.data, {
      explicitArray: false, // This helps with parsing
      mergeAttrs: true
    });
    
    // Navigate through the response structure
    const body = parsed['soap:Envelope']?.['soap:Body'] || parsed['soap:Body'] || parsed['Body'];
    const loginResponse = body?.['LOGIN_EGUJFORESTResponse'];
    const loginResult = loginResponse?.['LOGIN_EGUJFORESTResult'];
    
    if (!loginResult) {
      return res.status(500).json({
        success: false,
        error: "Invalid response from forest service"
      });
    }

    // The user data is in the diffgram
    const diffgram = loginResult['diffgr:diffgram'];
    const documentElement = diffgram?.['DocumentElement'];
    const result = documentElement?.['Result'] || documentElement?.['result'];
    
    if (!result) {
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
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    // ✅ GENERATE JWT with user data
    const token = jwt.sign(
      {
        userId: userData.USER_ID || userData.NAME, // Using NAME as fallback for userId
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
      {
        expiresIn: "24h"
      }
    );

    return res.json({
      success: true,
      token,
      user: userData
    });

  } catch (error) {
    console.error("Forest login error:", error.message);
    
    // Handle specific error types
    if (error.code === 'ECONNABORTED') {
      return res.status(504).json({
        success: false,
        error: "Forest service timeout"
      });
    }
    
    if (error.response) {
      console.error("Response status:", error.response.status);
      return res.status(error.response.status).json({
        success: false,
        error: `Forest service error: ${error.response.status}`
      });
    }

    return res.status(500).json({
      success: false,
      error: "Forest authentication failed"
    });
  }
});

module.exports = router;
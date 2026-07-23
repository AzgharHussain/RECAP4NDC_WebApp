// routes/forestLogin.js - Using xml2js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const xml2js = require('xml2js');
const { logFromRequest } = require('../utils/auditLogger');

// SOAP proxy endpoint for Gujarat Forest Service
router.post('/forest-login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    console.log('=== FOREST LOGIN REQUEST (xml2js) ===');
    console.log('Username:', username);
    
    // Validate input
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password are required'
      });
    }

    // Create SOAP Request
    const soapRequest = `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <LOGIN_EGUJFOREST xmlns="http://tempuri.org/">
      <username>${username}</username>
      <password>${password}</password>
    </LOGIN_EGUJFOREST>
  </soap12:Body>
</soap12:Envelope>`;

    console.log('Sending SOAP request...');
    
    // Make SOAP request
    const response = await axios.post(
      'https://egujforest.gujarat.gov.in/FMIS/CommonService/forestcommonservice.asmx',
      soapRequest,
      {
        headers: {
          'Content-Type': 'text/xml; charset=utf-8'
        },
        timeout: 30000
      }
    );

    console.log('SOAP Response Status:', response.status);
    
    if (response.status !== 200) {
      return res.status(502).json({
        success: false,
        error: `SOAP service returned status ${response.status}`,
        rawResponse: response.data?.substring(0, 500)
      });
    }

    // Parse XML with xml2js
    const parser = new xml2js.Parser({
      explicitArray: false,
      mergeAttrs: true,
      explicitRoot: false,
      ignoreAttrs: false,
      tagNameProcessors: [xml2js.processors.stripPrefix]
    });

    parser.parseString(response.data, (parseError, result) => {
      if (parseError) {
        console.error('XML parsing error:', parseError);
        return res.status(500).json({
          success: false,
          error: 'Failed to parse XML response',
          details: parseError.message
        });
      }

      console.log('Parsed result structure received');
      
      // Navigate through the response structure
      try {
        // The structure is: Envelope -> Body -> LOGIN_EGUJFORESTResponse -> LOGIN_EGUJFORESTResult
        const envelope = result.Envelope || result;
        if (!envelope) {
          throw new Error('Invalid SOAP response: No Envelope found');
        }

        const body = envelope.Body;
        if (!body) {
          throw new Error('Invalid SOAP response: No Body found');
        }

        const loginResponse = body.LOGIN_EGUJFORESTResponse;
        if (!loginResponse) {
          throw new Error('Invalid SOAP response: No LOGIN_EGUJFORESTResponse found');
        }

        const resultData = loginResponse.LOGIN_EGUJFORESTResult;
        if (!resultData) {
          return res.status(401).json({
            success: false,
            error: 'Invalid credentials - empty result',
            rawXml: response.data?.substring(0, 500)
          });
        }

        console.log('Result data type:', typeof resultData);
        console.log('Result data keys:', Object.keys(resultData));
        
        // Extract user data from the XML structure
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
            rawXml: response.data?.substring(0, 500)
          });
        }

        // Check if we have valid user data
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

        // Return success with user data
        logFromRequest(req, {
          action: 'LOGIN',
          status: 'SUCCESS',
          statusCode: 200,
          username,
          resourceType: 'user_session',
          details: { name: userData.NAME, division: userData.DivisionName },
        });

        res.json({
          success: true,
          jsonMap: userData,
          message: 'Authentication successful'
        });

      } catch (navigationError) {
        console.error('Error navigating XML structure:', navigationError.message);
        console.error('Full result structure:', JSON.stringify(result, null, 2));
        
        return res.status(500).json({
          success: false,
          error: 'Failed to process SOAP response',
          details: navigationError.message,
          rawXml: response.data?.substring(0, 500)
        });
      }
    });

  } catch (error) {
    console.error('SOAP proxy error:', error.message);

    logFromRequest(req, {
      action: 'LOGIN_FAILED',
      status: 'ERROR',
      statusCode: error.code === 'ECONNABORTED' ? 504 : 502,
      username: req.body?.username || null,
      errorMessage: error.message,
    });
    
    let errorMessage = error.message;
    let errorCode = 500;
    
    if (error.code === 'ECONNABORTED') {
      errorMessage = 'Request timeout - Gujarat Forest Service is not responding';
      errorCode = 504;
    } else if (error.code === 'ENOTFOUND') {
      errorMessage = 'Cannot connect to Gujarat Forest Service';
      errorCode = 502;
    }
    
    res.status(errorCode).json({
      success: false,
      error: errorMessage,
      details: error.code || 'Unknown error'
    });
  }
});

// Helper function to extract user data from SOAP result
function extractUserDataFromSoapResult(resultData) {
  const userData = {};
  
  console.log('Extracting user data from result...');
  console.log('Result data type:', typeof resultData);
  
  // Based on the parsed structure you showed:
  // The user data is in: resultData.diffgram.DocumentElement.Result
  
  try {
    // Method 1: Check if we have diffgram structure
    if (resultData.diffgram && resultData.diffgram.DocumentElement) {
      const documentElement = resultData.diffgram.DocumentElement;
      
      // Result could be an array or object
      if (documentElement.Result) {
        const result = documentElement.Result;
        
        // Extract all properties
        Object.keys(result).forEach(key => {
          // Skip metadata attributes (starts with $ or contains :)
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
    
    // Method 2: Check if resultData is already the Result object
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
    
    // Method 3: ResultData might be the user data directly
    // Check for expected user fields
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
    
    // Method 4: Try to find any data in the structure
    const findDataRecursively = (obj, depth = 0) => {
      if (depth > 5) return; // Prevent infinite recursion
      
      if (typeof obj === 'object' && obj !== null) {
        Object.keys(obj).forEach(key => {
          // Skip metadata
          if (key.startsWith('$') || key.includes(':') || key.includes('@')) {
            return;
          }
          
          const value = obj[key];
          if (typeof value === 'string' && value.trim() !== '') {
            // Check if this looks like user data
            if (expectedFields.includes(key) && !userData[key]) {
              userData[key] = value;
            }
          } else if (typeof value === 'object' && value !== null) {
            findDataRecursively(value, depth + 1);
          }
        });
      }
    };
    
    findDataRecursively(resultData);
    
    if (Object.keys(userData).length > 0) {
      console.log('Extracted via recursive method:', userData);
      return userData;
    }
    
    console.log('No user data found in result structure');
    console.log('Result data:', JSON.stringify(resultData, null, 2));
    
  } catch (error) {
    console.error('Error extracting user data:', error);
  }
  
  return userData;
}

module.exports = router;
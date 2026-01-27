import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "../App.css";
import { useLanguage } from "../context/LanguageContext";
import "./Login.css";
import axios from "axios";
import { API_BASE_URL } from '../config';

// === Images ===
import brand from "../assets/logo-giz.png";
import backImage from "../assets/backimage.jpg";
import leftLogos from "../assets/Logo.png";

function Login() {
  const [showPwd, setShowPwd] = useState(false);
  const { language, toggleLanguage } = useLanguage();
  const navigate = useNavigate();
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const userIdRef = useRef(null);

  // Focus on user ID input on mount
  useEffect(() => {
    if (userIdRef.current) {
      userIdRef.current.focus();
    }
  }, []);

  const text = {
    en: {
      title: "Login",
      userId: "User ID",
      userPlaceholder: "Enter User ID",
      password: "Password",
      passPlaceholder: "Enter Password",
      loginButton: "Login",
      footer: "2025 © All Rights Reserved By | RECAP4NDC",
      errorRequired: "Please enter both User ID and Password",
      errorInvalid: "Invalid credentials. Please check your User ID and Password",
      errorUserNotFound: "User not found in the system",
      errorNetwork: "Network error. Please check your connection.",
      errorServer: "Server error. Please try again later.",
      loggingIn: "Logging in...",
      timeout: "Request timeout. Please try again.",
      errorCORS: "CORS error. Please contact administrator."
    },
    gu: {
      title: "લૉગિન",
      userId: "વપરાશકર્તા ID",
      userPlaceholder: "વપરાશકર્તા ID દાખલ કરો",
      password: "પાસવર્ડ",
      passPlaceholder: "પાસવર્ડ દાખલ કરો",
      loginButton: "લૉગિન કરો",
      footer: "૨૦૨૫ © સર્વ અધિકારો સુરક્ષિત | RECAP4NDC",
      errorRequired: "કૃપા કરીને વપરાશકર્તા ID અને પાસવર્ડ દાખલ કરો",
      errorInvalid: "અમાન્ય લૉગિન વિગતો. કૃપા કરીને તમારું વપરાશકર્તા ID અને પાસવર્ડ તપાસો.",
      errorUserNotFound: "સિસ્ટમમાં વપરાશકર્તા મળ્યો નથી",
      errorNetwork: "નેટવર્ક એરર. કૃપા કરીને તમારું કનેક્શન તપાસો.",
      errorServer: "સર્વર એરર. કૃપા કરીને પછી પ્રયાસ કરો.",
      loggingIn: "લૉગ ઇન થાય છે...",
      timeout: "રિક્વેસ્ટ ટાઈમઆઉટ. કૃપા કરીને ફરી પ્રયાસ કરો.",
      errorCORS: "CORS એરર. એડમિનિસ્ટ્રેટરનો સંપર્ક કરો."
    },
  };

  // Event Handlers
  const handleUserIdChange = (e) => {
    setUserId(e.target.value);
    setError("");
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
    setError("");
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  };

  const handleLanguageToggle = (lang) => {
    if (!loading) {
      toggleLanguage(lang);
    }
  };

  // Enhanced XML Parser Helper Function
  const parseXMLResponse = (xmlString) => {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlString, "text/xml");
      
      console.log("Raw XML Response:", xmlString);
      console.log("Parsed XML Document:", xmlDoc);
      
      // Check for SOAP Fault
      const faultString = xmlDoc.getElementsByTagName("faultstring")[0];
      if (faultString) {
        const errorMsg = faultString.textContent || "Authentication failed";
        throw new Error(errorMsg);
      }

      // Check for empty or error response
      const diffgram = xmlDoc.getElementsByTagName("diffgr:diffgram")[0];
      if (!diffgram) {
        // Try without namespace
        const diffgramAlt = xmlDoc.querySelector("diffgram");
        if (!diffgramAlt) {
          throw new Error("Invalid response format - missing data");
        }
      }

      // Get Result element
      const resultElements = xmlDoc.getElementsByTagName("Result");
      console.log("Number of Result elements:", resultElements.length);
      
      if (resultElements.length === 0) {
        // Try with different namespace or case
        const resultAlt = xmlDoc.querySelector("Result, result");
        if (!resultAlt) {
          throw new Error("No user data found in response");
        }
      }

      const resultElement = resultElements[0] || xmlDoc.querySelector("Result, result");
      
      // Extract data with better fallback handling
      const getElementText = (element, tagName) => {
        const elem = element.getElementsByTagName(tagName)[0];
        const text = elem ? elem.textContent : null;
        console.log(`${tagName}:`, text);
        return text;
      };

      const userData = {
        name: getElementText(resultElement, "NAME") || "-",
        post: getElementText(resultElement, "NameOfPost") || "-",
        cadre: getElementText(resultElement, "CadreName") || "-",
        circle: getElementText(resultElement, "CircleName") || "-",
        division: getElementText(resultElement, "DivisionName") || "-",
        range: getElementText(resultElement, "RangeName") || "-",
        round: getElementText(resultElement, "RoundName") || "-",
        beat: getElementText(resultElement, "BeatName") || "-",
        mobile: getElementText(resultElement, "MobileNo") || "-",
        email: getElementText(resultElement, "EmailID") || "-",
      };

      console.log("Extracted user data:", userData);

      // Check if all fields are empty/dashes (invalid credentials)
      const allFieldsEmpty = Object.values(userData).every(
        value => value === "-" || value === "" || value === null || value === undefined
      );

      if (allFieldsEmpty) {
        throw new Error("INVALID_CREDENTIALS");
      }

      // Check for minimum required data
      if (userData.name === "-" && userData.mobile === "-") {
        throw new Error("INCOMPLETE_USER_DATA");
      }

      return userData;
    } catch (error) {
      console.error("XML Parsing Error:", error);
      throw error;
    }
  };

const saveUser = async (username) => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/saveuser`,
      { username },
      
    );

    const { token, user } = response.data;

    if (token) {
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));
      console.log("🔐 JWT saved to localStorage");
    }

    return response.data;
  } catch (err) {
    console.error(
      "❌ Failed to save user:",
      err.response?.data || err.message
    );
    return null;
  }
};




  // Login Handler
  const handleLogin = async () => {
    // Validation
    if (!userId.trim() || !password.trim()) {
      setError(text[language].errorRequired);
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Test credentials (for debugging)
      const testCredentials = [
        { user: "admin", pass: "Gipl@123" },
        { user: "demo", pass: "demo@123" },
        { user: "test", pass: "test@123" }
      ];
      
      // Check if using test credentials
      const isTestCredential = testCredentials.some(
        cred => cred.user === userId.trim() && cred.pass === password.trim()
      );

      // If using test credentials, bypass SOAP API and simulate success
      if (isTestCredential) {
        console.log("Using test credentials - bypassing SOAP API");
        
        // Create mock user data for test credentials
        const mockUserData = {
          name: "Test User",
          post: "Administrator",
          cadre: "Admin Cadre",
          circle: "Test Circle",
          division: "Test Division",
          range: "Test Range",
          round: "Test Round",
          beat: "Test Beat",
          mobile: "9876543210",
          email: "test@example.com",
        };

        // Store user data (NO PASSWORD)
        const userSession = {
          ...mockUserData,
          username: userId.trim(),
          isAuthenticated: true,
          loginTime: new Date().toISOString()
        };

        localStorage.setItem("userData", JSON.stringify(userSession));
        localStorage.setItem("authToken", "authenticated");

        // Save user to backend
        await saveUser(userId.trim());

        // Navigate to dashboard
        navigate("/geo");
        return;
      }

      // SOAP Request XML for real authentication
      const soapRequest = `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <LOGIN_EGUJFOREST xmlns="http://tempuri.org/">
      <username>${userId.trim()}</username>
      <password>${password.trim()}</password>
    </LOGIN_EGUJFOREST>
  </soap12:Body>
</soap12:Envelope>`;

      console.log("Sending SOAP Request with username:", userId.trim());

      // Use API_BASE_URL for the SOAP endpoint
      const soapEndpoint = `${API_BASE_URL}/api/FMIS/CommonService/forestcommonservice.asmx?op=LOGIN_EGUJFOREST`;
      
      const config = {
        method: 'post',
        url: soapEndpoint,
        headers: {
          'Content-Type': 'application/soap+xml; charset=utf-8',
          'SOAPAction': 'http://tempuri.org/LOGIN_EGUJFOREST'
        },
        data: soapRequest,
        timeout: 60000, // 60 seconds timeout
      };

      // Make API call
      const response = await axios(config);
      
      console.log("Response status:", response.status);
      console.log("Response headers:", response.headers);
      console.log("Response data length:", response.data.length);
      
      if (response.status !== 200) {
        throw new Error(`HTTP ${response.status}: ${text[language].errorServer}`);
      }

      // Log first 1000 chars of response for debugging
      console.log("Response data (first 1000 chars):", response.data.substring(0, 1000));

      // Parse the XML response
      const userData = parseXMLResponse(response.data);
      
      console.log("Parsed user data:", userData);

      // Store user data
      const userSession = {
        ...userData,
        username: userId.trim(),
        isAuthenticated: true,
        loginTime: new Date().toISOString()
      };

      localStorage.setItem("userData", JSON.stringify(userSession));
      localStorage.setItem("authToken", "authenticated");

      // Save user to backend
      await saveUser(userId.trim());

      // Navigate to dashboard
      navigate("/geo");

    } catch (error) {
      console.error("Login Error Details:", {
        message: error.message,
        code: error.code,
        response: error.response,
        request: error.request
      });
      
      // Handle specific error cases
      if (error.code === 'ECONNABORTED') {
        setError(text[language].timeout);
      } else if (error.message === 'INVALID_CREDENTIALS') {
        setError(text[language].errorInvalid);
      } else if (error.message === 'INCOMPLETE_USER_DATA') {
        setError(text[language].errorUserNotFound);
      } else if (error.response) {
        // Server responded with error status
        if (error.response.status === 401 || error.response.status === 403) {
          setError(text[language].errorInvalid);
        } else if (error.response.status === 404) {
          setError("API endpoint not found. Please check the server URL.");
        } else if (error.response.status >= 500) {
          setError(text[language].errorServer);
        } else {
          setError(`Server Error: ${error.response.status}`);
        }
      } else if (error.request) {
        // Request made but no response (network error or CORS)
        if (error.message.includes("Network Error") || error.message.includes("CORS")) {
          setError(text[language].errorCORS);
        } else {
          setError(text[language].errorNetwork);
        }
      } else {
        setError(error.message || text[language].errorServer);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="login-screen"
      style={{
        backgroundImage: `
          linear-gradient(180deg, rgba(48,144,89,0.85) -6.02%, rgba(234,194,147,0.85) 51.41%, rgba(54,117,165,0.85) 86.7%),
          url(${backImage})
        `,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        height: "100vh",
        width: "100%",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "0 80px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Left logos container */}
      <div 
        style={{
          flex: "0 0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          width: "50%",
          overflow: "hidden",
        }}
      >
        <img 
          src={leftLogos} 
          alt="Partner Logos" 
          style={{
            maxHeight: "80vh",
            objectFit: "contain",
            width: "auto"
          }}
        />
      </div>

      {/* Right panel with login form */}
      <div
        className="right-Panel"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          height: "100%",
          maxHeight: "100vh",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div className="form-card">
          <img src={brand} alt="RECAP4NDC" className="brand" />
          <h2 className="login-heading">{text[language].title}</h2>

          {/* Error Message Display */}
          {error && (
            <div className="error-message" style={{
              color: "#d32f2f",
              backgroundColor: "#ffebee",
              padding: "10px",
              borderRadius: "4px",
              marginBottom: "15px",
              border: "1px solid #ef9a9a",
              fontSize: "14px",
              textAlign: "center",
              maxWidth: "100%",
              overflow: "hidden",
              wordWrap: "break-word"
            }}>
              {error}
            </div>
          )}

          <label className="input-label">{text[language].userId}</label>
          <div className="field">
            <input
              ref={userIdRef}
              type="text"
              placeholder={text[language].userPlaceholder}
              value={userId}
              onChange={handleUserIdChange}
              onKeyPress={handleKeyPress}
              disabled={loading}
              autoComplete="username"
              style={{ fontSize: "16px", padding: "12px" }}
            />
            <span className="icon">
              <img src="/assets/user.png" alt="User" width="20" height="20" />
            </span>
          </div>

          <label className="input-label">{text[language].password}</label>
          <div className="field">
            <input
              type={showPwd ? "text" : "password"}
              placeholder={text[language].passPlaceholder}
              value={password}
              onChange={handlePasswordChange}
              onKeyPress={handleKeyPress}
              disabled={loading}
              autoComplete="current-password"
              style={{ fontSize: "16px", padding: "12px" }}
            />
            <button
              type="button"
              className="eye"
              onClick={() => setShowPwd((s) => !s)}
              disabled={loading}
              style={{
                background: "transparent",
                border: "none",
                cursor: loading ? "not-allowed" : "pointer",
                padding: "5px"
              }}
            >
              {showPwd ? (
                "👁"
              ) : (
                <img
                  src="/assets/Eyeclose.png"
                  alt="Closed Eye"
                  width="20"
                  height="20"
                />
              )}
            </button>
          </div>

          <button 
            className="btn-login" 
            onClick={handleLogin}
            disabled={loading}
            style={{
              backgroundColor: loading ? "#cccccc" : "#4CAF50",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
              transition: "all 0.3s ease",
              position: "relative",
              width: "100%",
              padding: "14px",
              fontSize: "16px",
              fontWeight: "bold",
              color: "white",
              border: "none",
              borderRadius: "4px",
              marginTop: "20px"
            }}
          >
            {loading && (
              <span style={{
                display: "inline-block",
                width: "16px",
                height: "16px",
                border: "2px solid #fff",
                borderTop: "2px solid transparent",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
                marginRight: "8px"
              }}></span>
            )}
            {loading ? text[language].loggingIn : text[language].loginButton}
          </button>

          

          
        </div>

        {/* Footer Bar */}
        <div 
          className="footer-bar"
          style={{
            position: "absolute",
            bottom: "20px",
            width: "100%",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "0 20px",
            boxSizing: "border-box"
          }}
        >
          <button
            className={`lang-chip ${language === "en" ? "active" : ""}`}
            onClick={() => handleLanguageToggle("en")}
            disabled={loading}
            style={{
              padding: "5px 15px",
              borderRadius: "20px",
              border: "1px solid #ccc",
              background: language === "en" ? "#4CAF50" : "#fff",
              color: language === "en" ? "#fff" : "#333",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.5 : 1
            }}
          >
            EN
          </button>
          <div className="footer-note" style={{
            color: "#fff",
            fontSize: "14px",
            textAlign: "center",
            fontWeight: "500"
          }}>
            {text[language].footer}
          </div>
          <button
            className={`lang-chip ${language === "gu" ? "active" : ""}`}
            onClick={() => handleLanguageToggle("gu")}
            disabled={loading}
            style={{
              padding: "5px 15px",
              borderRadius: "20px",
              border: "1px solid #ccc",
              background: language === "gu" ? "#4CAF50" : "#fff",
              color: language === "gu" ? "#fff" : "#333",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.5 : 1
            }}
          >
            જીયુ
          </button>
        </div>
      </div>

      <style jsx="true">{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default Login;
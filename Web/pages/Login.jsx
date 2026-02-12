import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "../App.css";
import { useLanguage } from "../context/LanguageContext";
import "./Login.css";
import axios from "axios";
import { API_BASE_URL } from '../config';

// === Images ===
import brand from "../assets/logo-giz.png";
import backImage from "../assets/G2.jpg";
import leftLogos from "../assets/Logo.png";
import Eyeclose from "../assets/Eyeclose.png";
import user from "../assets/user.png";

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
      errorCORS: "CORS error. Please contact administrator.",
      forestServiceUnavailable: "Gujarat Forest Service is currently unavailable",
      forestConnectionFailed: "Cannot connect to Gujarat Forest Service",
      forestAuthFailed: "Forest authentication failed"
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
      errorCORS: "CORS એરર. એડમિનિસ્ટ્રેટરનો સંપર્ક કરો.",
      forestServiceUnavailable: "ગુજરાત ફોરેસ્ટ સેવા હાલમાં ઉપલબ્ધ નથી",
      forestConnectionFailed: "ફોરેસ્ટ ઓથેન્ટિકેશન સેવા સાથે કનેક્ટ થઈ શકતું નથી",
      forestAuthFailed: "ફોરેસ્ટ ઓથેન્ટિકેશન નિષ્ફળ"
    },
  };

  // Session management functions
  const createSession = (userData, isAdmin = false) => {
    const sessionData = {
      user: {
        ...userData,
        isAdmin,
        loginTime: new Date().toISOString()
      },
      sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      isActive: true
    };

    // Store session in localStorage
    localStorage.setItem('session', JSON.stringify(sessionData));
    
    // Also store user data separately for compatibility
    localStorage.setItem('userData', JSON.stringify(sessionData.user));
    
    if (isAdmin) {
      console.log("✅ Admin session created:", sessionData.sessionId);
    } else {
      console.log("✅ User session created:", sessionData.sessionId);
    }
    
    return sessionData;
  };

  const validateSession = () => {
    try {
      const sessionStr = localStorage.getItem('session');
      if (!sessionStr) return false;
      
      const session = JSON.parse(sessionStr);
      
      // Check if session is expired
      if (new Date(session.expiresAt) < new Date()) {
        console.log("❌ Session expired");
        clearSession();
        return false;
      }
      
      // Update last activity
      session.lastActivity = new Date().toISOString();
      localStorage.setItem('session', JSON.stringify(session));
      
      return true;
    } catch (error) {
      console.error("❌ Session validation error:", error);
      return false;
    }
  };

  const clearSession = () => {
    localStorage.removeItem('session');
    localStorage.removeItem('userData');
    localStorage.removeItem('token');
    localStorage.removeItem('authToken');
    console.log("✅ Session cleared");
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

  // Frontend-only SOAP authentication using Vite proxy
  const forestLogin = async (username, password) => {
    try {
      console.log("🌲 Making SOAP request through Vite proxy...");
      
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
      
      // Make SOAP request through Vite proxy
      const response = await axios.post(
        '/forest-proxy/FMIS/CommonService/forestcommonservice.asmx',
        soapRequest,
        {
          headers: {
            'Content-Type': 'text/xml; charset=utf-8',
            'SOAPAction': 'http://tempuri.org/LOGIN_EGUJFOREST'
          },
          timeout: 30000,
          responseType: 'text'
        }
      );

      console.log('SOAP Response Status:', response.status);
      
      if (response.status !== 200) {
        throw new Error('FOREST_SERVICE_UNAVAILABLE');
      }

      // Parse XML response using DOMParser
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(response.data, "text/xml");
      
      // Check for parsing errors
      const parseError = xmlDoc.querySelector('parsererror');
      if (parseError) {
        console.error("XML parsing error");
        throw new Error('FOREST_AUTH_FAILED');
      }

      // Navigate through XML structure to extract user data
      const getElementText = (doc, tagName) => {
        const element = doc.getElementsByTagName(tagName)[0];
        return element ? (element.textContent || '-') : '-';
      };

      // Extract data from XML
      const userData = {
        NAME: getElementText(xmlDoc, 'NAME'),
        NameOfPost: getElementText(xmlDoc, 'NameOfPost'),
        CadreName: getElementText(xmlDoc, 'CadreName'),
        CircleName: getElementText(xmlDoc, 'CircleName'),
        DivisionName: getElementText(xmlDoc, 'DivisionName'),
        RangeName: getElementText(xmlDoc, 'RangeName'),
        RoundName: getElementText(xmlDoc, 'RoundName'),
        BeatName: getElementText(xmlDoc, 'BeatName'),
        MobileNo: getElementText(xmlDoc, 'MobileNo'),
        EmailID: getElementText(xmlDoc, 'EmailID'),
        USER_ID: getElementText(xmlDoc, 'USER_ID'),
        USER_TYPE: getElementText(xmlDoc, 'USER_TYPE'),
        F_ID: getElementText(xmlDoc, 'F_ID')
      };

      console.log('Extracted user data:', userData);
      
      // Check if we have valid user data
      if (!userData.NAME || userData.NAME === '-') {
        throw new Error('FOREST_AUTH_FAILED');
      }

      return userData;

    } catch (error) {
      console.error('SOAP proxy error:', error.message);
      
      // Map error messages
      if (error.message === 'FOREST_AUTH_FAILED') {
        throw new Error('FOREST_AUTH_FAILED');
      } else if (error.code === 'ECONNABORTED') {
        throw new Error('FOREST_TIMEOUT');
      } else if (error.code === 'ENOTFOUND') {
        throw new Error('FOREST_CONNECTION_FAILED');
      } else if (error.message.includes('Network Error')) {
        throw new Error('FOREST_CONNECTION_FAILED');
      } else if (error.message.includes('502') || error.message.includes('504') || error.message.includes('503')) {
        throw new Error('FOREST_SERVICE_UNAVAILABLE');
      }
      
      throw new Error(error.message || 'FOREST_AUTH_FAILED');
    }
  };

  const saveUser = async (username) => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/saveuser`,
        { username }
      );

      const { token, user } = response.data;

      if (token) {
        localStorage.setItem("token", token);
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

  const handleLogin = async () => {
    // Validation
    if (!userId.trim() || !password.trim()) {
      setError(text[language].errorRequired);
      return;
    }

    setLoading(true);
    setError("");

    try {
      // 1. Check if user is an admin via the API
      console.log("👑 Checking admin credentials...");
      
      try {
        const adminResponse = await axios.post(`${API_BASE_URL}/api/admin`, {
          username: userId.trim(),
          password: password.trim()
        });
        
        if (adminResponse.data.success) {
          // Create admin session
          const adminUserData = {
            username: userId.trim(),
            name: adminResponse.data.user.name || "Administrator",
            isAdmin: true,
            permissions: adminResponse.data.user.permissions || ['all'],
            source: 'admin_api'
          };
          
          // Create session
          createSession(adminUserData, true);
          
          // Store the token
          localStorage.setItem('token', adminResponse.data.token);
          
          // Test authenticated request
          await axios.get(
            `${API_BASE_URL}/api/admincoupes`,
            {
              headers: {
                Authorization: `Bearer ${adminResponse.data.token}`,
              },
            }
          );
          
          console.log("✅ Admin session created successfully");
          navigate("/admin");
          setLoading(false);
          return;
        }
      } catch (adminError) {
        console.log('👑 Admin login failed, trying regular user authentication...');
        // Continue to forest authentication
      }

      // 2. Forest Authentication for regular users (only if admin login failed)
      console.log("🌲 Proceeding with Forest authentication...");
      const jsonMap = await forestLogin(userId.trim(), password.trim());
      
      if (!jsonMap || Object.keys(jsonMap).length === 0) {
        throw new Error("INVALID_CREDENTIALS");
      }

      console.log("✅ Forest authentication successful, user data:", jsonMap);

      // Extract user data
      const userData = {
        name: jsonMap.NAME || "-",
        post: jsonMap.NameOfPost || "-",
        cadre: jsonMap.CadreName || "-",
        circle: jsonMap.CircleName || "-",
        division: jsonMap.DivisionName || "-",
        range: jsonMap.RangeName || "-",
        round: jsonMap.RoundName || "-",
        beat: jsonMap.BeatName || "-",
        mobile: jsonMap.MobileNo || "-",
        email: jsonMap.EmailID || "-",
        userId: jsonMap.USER_ID || userId.trim(),
        userType: jsonMap.USER_TYPE || "-",
        forestId: jsonMap.F_ID || "-",
        username: userId.trim(),
        isAdmin: false,
        source: 'forest_service_frontend'
      };

      // Check if user data is valid
      if (userData.name === "-" && userData.mobile === "-") {
        throw new Error("INVALID_CREDENTIALS");
      }

      // Create user session
      createSession(userData, false);
      
      // Store authentication token
      localStorage.setItem("authToken", "forest_authenticated");

      // Save user to backend
      await saveUser(userId.trim());

      console.log("✅ User session created successfully");
      
      // Validate session before navigation
      if (validateSession()) {
        navigate("/geo");
      } else {
        throw new Error("SESSION_CREATION_FAILED");
      }

    } catch (error) {
      console.error("🔴 Login Error:", error);
      
      // Clear any partial session data on error
      clearSession();
      
      // Handle specific error cases
      if (error.code === 'ECONNABORTED') {
        setError(text[language].timeout);
      } else if (error.message === 'INVALID_CREDENTIALS' || error.message === 'FOREST_AUTH_FAILED') {
        setError(text[language].errorInvalid);
      } else if (error.message === 'FOREST_TIMEOUT') {
        setError(text[language].timeout);
      } else if (error.message === 'FOREST_CONNECTION_FAILED') {
        setError(text[language].forestConnectionFailed);
      } else if (error.message === 'FOREST_SERVICE_UNAVAILABLE') {
        setError(text[language].forestServiceUnavailable);
      } else if (error.message === 'SESSION_CREATION_FAILED') {
        setError("Failed to create session. Please try again.");
      } else if (error.response) {
        if (error.response.status === 401 || error.response.status === 403) {
          setError(text[language].errorInvalid);
        } else if (error.response.status === 404) {
          setError("API endpoint not found");
        } else if (error.response.status >= 500) {
          setError(text[language].errorServer);
        } else {
          setError(`Error: ${error.response.status}`);
        }
      } else if (error.request) {
        setError(text[language].errorNetwork);
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
          position: "relative",
        }}
      >
        <img 
          src={leftLogos} 
          alt="Partner Logos" 
          style={{
            maxHeight: "85vh",
            objectFit: "contain",
            width: "auto",
            padding: "25px",
            borderRadius: "20px",
            boxShadow: `
              0 15px 35px rgba(0, 0, 0, 0.2),
              inset 0 1px 0 rgba(255, 255, 255, 0.3)
            `,
            border: "2px solid rgba(255, 255, 255, 0.15)",
            backdropFilter: "blur(20px)",
            transition: "all 0.3s ease",
          }}
        />
      </div>

      {/* Right panel with login form */}
      <div
        className="right-Panel"
        style={{
          flex: 1,
          display: "flex",
          justifyContent: "center",
          height: "90%",
          maxHeight: "100vh",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div className="form-card">
          <div>
            <img src={brand} alt="RECAP4NDC" className="brand" />
            <h2 className="login-heading">{text[language].title}</h2>

            {/* Error Message Display */}
            {error && (
              <div className="error-message" >
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
                style={{ fontSize: "16px" }}
              />
              <span className="icon">
                <img src={user} alt="User" width="20" height="20" />
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
                    src={Eyeclose}
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
            >
              {loading && (
                <span></span> // The span for spinner will be styled by CSS
              )}
              {loading ? text[language].loggingIn : text[language].loginButton}
            </button>
          </div>

          <div 
            className="footer-bar"
            style={{
              position: "absolute",
              width: "90%",
              display: "flex",
              justifyContent: "space-around",
              alignItems: "center",
              padding: "0 0px",
            }}
          >
            <button
              className={`lang-chip ${language === "en" ? "active" : ""}`}
              onClick={() => handleLanguageToggle("en")}
              disabled={loading}
            >
              EN
            </button>
            
            <button
              className={`lang-chip ${language === "gu" ? "active" : ""}`}
              onClick={() => handleLanguageToggle("gu")}
              disabled={loading}
            >
              જીયુ
            </button>
          </div>
        </div>
      </div>

      <style jsx="true">{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0% { opacity: 0.5; }
          50% { opacity: 1; }
          100% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

export default Login;
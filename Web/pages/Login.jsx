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

  // Updated login function using backend proxy
  const forestLogin = async (username, password) => {
    try {
      console.log("Sending SOAP request through backend proxy...");
      
      const response = await axios.post(
        `${API_BASE_URL}/api/forest-login`,
        {
          username: username,
          password: password
        },
        {
          timeout: 30000
        }
      );

      if (response.status === 200 && response.data.success) {
        console.log('Backend proxy success:', response.data);
        return response.data.jsonMap || {};
      } else {
        console.log('Backend proxy error:', response.status, '/', response.data);
        return null;
      }
    } catch (e) {
      console.log('Backend proxy error:', e.toString());
      return null;
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
      console.log("Checking admin credentials...");
      
      try {
        const adminResponse = await axios.post(`${API_BASE_URL}/api/admin`, {
          username: userId.trim(),
          password: password.trim()
        });
        
        if (adminResponse.data.success) {
          // Store the token and user info
          localStorage.setItem('token', adminResponse.data.token);
          localStorage.setItem('user', JSON.stringify(adminResponse.data.user));
          
          // Test authenticated request
          await axios.get(
            `${API_BASE_URL}/api/admincoupes`,
            {
              headers: {
                Authorization: `Bearer ${adminResponse.data.token}`,
              },
            }
          );
          
          navigate("/admin");
          setLoading(false);
          return;
        }
      } catch (adminError) {
        console.log('Admin login failed, trying regular user authentication...');
        // Continue to forest authentication
      }

      // 2. Forest Authentication for regular users (only if admin login failed)
      console.log("Proceeding with Forest authentication...");
      const jsonMap = await forestLogin(userId.trim(), password.trim());
      
      if (!jsonMap || Object.keys(jsonMap).length === 0) {
        throw new Error("INVALID_CREDENTIALS");
      }

      console.log("Authentication successful, user data:", jsonMap);

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
      };

      // Check if user data is valid
      if (userData.name === "-" && userData.mobile === "-") {
        throw new Error("INVALID_CREDENTIALS");
      }

      // Store user data
      const userSession = {
        ...userData,
        username: userId.trim(),
        isAuthenticated: true,
        isAdmin: false,
        loginTime: new Date().toISOString()
      };

      localStorage.setItem("userData", JSON.stringify(userSession));
      localStorage.setItem("authToken", "authenticated");

      // Save user to backend
      await saveUser(userId.trim());

      // Navigate to dashboard
      navigate("/geo");

    } catch (error) {
      console.error("Login Error:", error);
      
      // Handle specific error cases
      if (error.code === 'ECONNABORTED') {
        setError(text[language].timeout);
      } else if (error.message === 'INVALID_CREDENTIALS') {
        setError(text[language].errorInvalid);
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
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "../App.css";
import { useLanguage } from "../context/LanguageContext";
import "./Login.css";

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
      errorInvalid: "Invalid credentials. Please try again.",
      errorNetwork: "Network error. Please check your connection.",
      errorServer: "Server error. Please try again later.",
      loggingIn: "Logging in...",
      timeout: "Request timeout. Please try again."
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
      errorInvalid: "અમાન્ય લૉગિન વિગતો. કૃપા કરીને ફરી પ્રયાસ કરો.",
      errorNetwork: "નેટવર્ક એરર. કૃપા કરીને તમારું કનેક્શન તપાસો.",
      errorServer: "સર્વર એરર. કૃપા કરીને પછી પ્રયાસ કરો.",
      loggingIn: "લૉગ ઇન થાય છે...",
      timeout: "રિક્વેસ્ટ ટાઈમઆઉટ. કૃપા કરીને ફરી પ્રયાસ કરો."
    },
  };

  const handleLogin = async () => {
    // Reset previous errors
    setError("");
    
    // Validate inputs
    if (!userId.trim() || !password.trim()) {
      setError(text[language].errorRequired);
      return;
    }
    
    setLoading(true);
    
    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    try {
      // Construct SOAP request XML with proper escaping
      const username = escapeXml(userId);
      const passwd = escapeXml(password);
      
      const soapRequest = `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <LOGIN_EGUJFOREST xmlns="http://tempuri.org/">
      <username>${username}</username>
      <password>${passwd}</password>
    </LOGIN_EGUJFOREST>
  </soap12:Body>
</soap12:Envelope>`;

      console.log("Attempting login with user:", userId);
      
      // Make SOAP request using proxy
      const response = await fetch(
        "/api/FMIS/CommonService/forestcommonservice.asmx",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/soap+xml; charset=utf-8",
            "SOAPAction": "http://tempuri.org/LOGIN_EGUJFOREST",
          },
          body: soapRequest,
          signal: controller.signal,
          mode: 'cors',
          credentials: 'omit'
        }
      );

      // Check HTTP status
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Get the response text
      const responseText = await response.text();
      console.log("SOAP Response received");

      // Parse XML response
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(responseText, "text/xml");
      
      // Check for XML parsing errors
      const parserError = xmlDoc.querySelector("parsererror");
      if (parserError) {
        throw new Error("Invalid XML response from server");
      }
      
      // Check for SOAP Fault
      const fault = xmlDoc.querySelector("soap\\:Fault, Fault, *|fault");
      
      if (fault) {
        const faultString = fault.querySelector("faultstring")?.textContent ||
                            fault.querySelector("faultcode")?.textContent ||
                            fault.textContent ||
                            "Authentication failed";
        console.error("SOAP Fault:", faultString);
        setError(faultString);
        return;
      }

      // Extract result from SOAP response
      const resultElement = xmlDoc.querySelector("LOGIN_EGUJFORESTResult, *|LOGIN_EGUJFORESTResult");
      
      if (resultElement) {
        const resultText = resultElement.textContent.trim();
        console.log("Result text:", resultText);
        
        // Handle different response formats
        await handleResponse(resultText);
      } else {
        // No result element found
        console.warn("No LOGIN_EGUJFORESTResult element found in response");
        setError(text[language].errorInvalid);
      }
      
    } catch (error) {
      console.error("Login error:", error);
      handleError(error);
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  const handleResponse = async (resultText) => {
    // Try to parse as JSON first
    try {
      const resultData = JSON.parse(resultText);
      
      if (resultData.success || resultData.status === "success" || resultData.token) {
        // Store user data in localStorage
        const userData = {
          username: userId,
          name: resultData.name || resultData.NAME || resultData.UserName || userId,
          email: resultData.email || resultData.Email,
          department: resultData.department || resultData.Department,
          loginTime: new Date().toISOString(),
          ...resultData
        };
        localStorage.setItem("userData", JSON.stringify(userData));
        localStorage.setItem("token", resultData.token || "authenticated");
        localStorage.setItem("lastLogin", new Date().toISOString());
        
        console.log("Login successful for user:", userData.name);
        
        // Navigate to geo page
        navigate("/geo");
        return;
      } else {
        setError(resultData.message || resultData.error || resultData.MESSAGE || text[language].errorInvalid);
        return;
      }
    } catch (jsonError) {
      // If not JSON, check for plain text responses
      console.log("Response is not JSON, checking text content");
      
      // Check for success indicators in text
      const successIndicators = ["success", "true", "1", "valid", "authenticated", "approved", "welcome"];
      const failureIndicators = ["fail", "false", "0", "invalid", "error", "rejected", "denied"];
      
      const lowerResult = resultText.toLowerCase();
      
      if (successIndicators.some(indicator => lowerResult.includes(indicator))) {
        // Login successful
        const userData = {
          username: userId,
          name: userId,
          loginTime: new Date().toISOString(),
          rawResponse: resultText
        };
        localStorage.setItem("userData", JSON.stringify(userData));
        localStorage.setItem("token", "authenticated");
        localStorage.setItem("lastLogin", new Date().toISOString());
        
        console.log("Login successful (text response)");
        navigate("/geo");
        return;
      } else if (failureIndicators.some(indicator => lowerResult.includes(indicator))) {
        setError(text[language].errorInvalid);
        return;
      } else {
        // Check if response looks like XML or other structured data
        if (resultText.startsWith("<") || resultText.includes("<")) {
          console.log("Response appears to be XML");
          // Try to extract meaningful data from XML
          const xmlParser = new DOMParser();
          const xmlDoc = xmlParser.parseFromString(resultText, "text/xml");
          const anyText = xmlDoc.textContent || xmlDoc.body?.textContent || "";
          
          if (anyText.length > 10) {
            const userData = {
              username: userId,
              name: userId,
              loginTime: new Date().toISOString(),
              response: resultText.substring(0, 100)
            };
            localStorage.setItem("userData", JSON.stringify(userData));
            localStorage.setItem("token", "authenticated");
            navigate("/geo");
            return;
          }
        }
        
        // Default: non-empty response treated as success
        if (resultText.length > 0 && resultText !== "null" && resultText !== "undefined") {
          const userData = {
            username: userId,
            name: userId,
            rawResponse: resultText.substring(0, 200),
            loginTime: new Date().toISOString()
          };
          localStorage.setItem("userData", JSON.stringify(userData));
          localStorage.setItem("token", "authenticated");
          
          console.log("Login successful (unknown response format)");
          navigate("/geo");
          return;
        }
        
        // If we reach here, login failed
        setError(text[language].errorInvalid);
      }
    }
  };

  const handleError = (error) => {
    // Handle specific error types
    if (error.name === 'AbortError') {
      setError(text[language].timeout);
    } else if (error.name === 'TypeError') {
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        setError(text[language].errorNetwork);
      } else {
        setError(text[language].errorServer);
      }
    } else if (error.message) {
      // Extract meaningful error message
      const errorMsg = error.message.toLowerCase();
      if (errorMsg.includes('cors') || errorMsg.includes('origin')) {
        setError("CORS error. Please check server configuration.");
      } else if (errorMsg.includes('timeout')) {
        setError(text[language].timeout);
      } else {
        setError(error.message);
      }
    } else {
      setError(text[language].errorServer);
    }
  };

  // Helper function to escape XML special characters
  const escapeXml = (unsafe) => {
    if (!unsafe) return '';
    return unsafe.replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
        default: return c;
      }
    });
  };

  // Handle Enter key press
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !loading) {
      handleLogin();
    }
  };

  // Handle language toggle
  const handleLanguageToggle = (lang) => {
    if (!loading && language !== lang) {
      toggleLanguage(lang);
    }
  };

  // Clear error when user starts typing
  const handleUserIdChange = (e) => {
    setUserId(e.target.value);
    if (error) setError("");
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
    if (error) setError("");
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
              backgroundColor: loading ? "#cccccc" : "",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
              transition: "all 0.3s ease",
              position: "relative"
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
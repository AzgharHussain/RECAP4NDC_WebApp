import React, { useState } from "react";
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
    
    try {
      const res = await fetch("http://localhost:5002/login-eguj", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: userId,
          password: password,
        }),
      });

      const data = await res.json();
      console.log("Login response:", data);

      if (data.success) {
        // Store user data in localStorage for future use
        localStorage.setItem("userData", JSON.stringify(data.user));
        console.log("Login successful, user:", data.user.NAME);
        
        // Navigate to geo page
        navigate("/geo");
      } else {
        // Show error message from backend
        setError(data.error || text[language].errorInvalid);
      }
    } catch (error) {
      console.error("Login error:", error);
      setError(text[language].errorNetwork);
    } finally {
      setLoading(false);
    }
  };

  // Handle Enter key press
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleLogin();
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
        overflow: "hidden", // This prevents scrolling
      }}
    >
      {/* Left logos container with fixed size */}
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

      {/* Main content area */}
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
              type="text"
              placeholder={text[language].userPlaceholder}
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={loading}
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
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={loading}
            />
            <button
              type="button"
              className="eye"
              onClick={() => setShowPwd((s) => !s)}
              disabled={loading}
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
              cursor: loading ? "not-allowed" : "pointer"
            }}
          >
            {loading ? 
              (language === "en" ? "Logging in..." : "લૉગ ઇન થાય છે...") 
              : text[language].loginButton}
          </button>
        </div>

        {/* Footer Bar - positioned at bottom */}
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
            onClick={() => toggleLanguage("en")}
            disabled={loading}
          >
            EN
          </button>
          <div className="footer-note">{text[language].footer}</div>
          <button
            className={`lang-chip ${language === "gu" ? "active" : ""}`}
            onClick={() => toggleLanguage("gu")}
            disabled={loading}
          >
            જીયુ
          </button>
        </div>
      </div>
    </div>
  );
}

export default Login;
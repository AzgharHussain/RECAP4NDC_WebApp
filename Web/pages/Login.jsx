import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../App.css";
import { useLanguage } from "../context/LanguageContext"; // ✅ import hook

// === Images ===
import brand from "../assets/logo-giz.png";
import backImage from "../assets/backimage.jpg";
import leftLogos from "../assets/Logo.png";

function Login() {
  const [showPwd, setShowPwd] = useState(false);
  const { language, toggleLanguage } = useLanguage(); // ✅ use global language
  const navigate = useNavigate();

  const text = {
    en: {
      title: "Login",
      userId: "User ID",
      userPlaceholder: "Enter User ID",
      password: "Password",
      passPlaceholder: "Enter Password",
      loginButton: "Login",
      footer: "2025 © All Rights Reserved By | RECAP4NDC",
    },
    gu: {
      title: "લૉગિન",
      userId: "વપરાશકર્તા ID",
      userPlaceholder: "વપરાશકર્તા ID દાખલ કરો",
      password: "પાસવર્ડ",
      passPlaceholder: "પાસવર્ડ દાખલ કરો",
      loginButton: "લૉગિન કરો",
      footer: "૨૦૨૫ © સર્વ અધિકારો સુરક્ષિત | RECAP4NDC",
    },
  };

  const handleLogin = () => {
    navigate("/geo");
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
      }}
    >
      <img src={leftLogos} alt="Partner Logos" className="partner-logos" />

      <div
        className="right-Panel"
        style={{
          flex: 1,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100%",
        }}
      >
        <div className="form-card">
          <img src={brand} alt="RECAP4NDC" className="brand" />
          <h2 className="login-heading">{text[language].title}</h2>

          <label className="input-label">{text[language].userId}</label>
          <div className="field">
            <input type="text" placeholder={text[language].userPlaceholder} />
            <span className="icon">
              <img src="/assets/user.png" alt="User" width="20" height="20" />
            </span>
          </div>

          <label className="input-label">{text[language].password}</label>
          <div className="field">
            <input
              type={showPwd ? "text" : "password"}
              placeholder={text[language].passPlaceholder}
              required
            />
            <button
              type="button"
              className="eye"
              onClick={() => setShowPwd((s) => !s)}
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

          <button className="btn-login" onClick={handleLogin}>
            {text[language].loginButton}
          </button>
        </div>

        {/* Footer Bar */}
        <div className="footer-bar">
          <button
            className={`lang-chip ${language === "en" ? "active" : ""}`}
            onClick={() => toggleLanguage("en")}
          >
            EN
          </button>
          <div className="footer-note">{text[language].footer}</div>
          <button
            className={`lang-chip ${language === "gu" ? "active" : ""}`}
            onClick={() => toggleLanguage("gu")}
          >
            જીયુ
          </button>
        </div>
      </div>
    </div>
  );
}

export default Login;

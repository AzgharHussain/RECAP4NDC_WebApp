import React, { useState } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import "../App.css";

// === Images ===
import brand from "../assets/logo-giz.png";
import backImage from "../assets/backimage.jpg"; // ✅ your new background
import leftLogos from "../assets/Logo.png"; // 🟢 your left-side logos image
import Dashboard from "../pages/Dashboard";

function LoginPage() {
  const [showPwd, setShowPwd] = useState(false);
  const navigate = useNavigate();

  const handleLogin = () => {
    // Later: add real authentication logic
    navigate("/dashboard"); // redirect after login
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
      {/* ✅ LEFT SIDE – Logos */}

      <img
        src={leftLogos}
        alt="Partner Logos"
        style={{
          width: "26%",
          height: "auto",
          objectFit: "contain",
        }}
      />

      <div
        className="right-Panel"
        style={{
          flex: 1,
          display: "flex",
          justifyContent: "center",
          alignItems: "center", // centers vertically & horizontally
          height: "100%",
        }}
      >
        <div className="form-card">
          <img src={brand} alt="RECAP4NDC" className="brand" />
          <h2 className="login-heading">Login</h2>

          {/* User ID */}
          <label className="input-label">User ID</label>
          <div className="field">
            <input type="text" placeholder="Enter User ID" />
            <span className="icon">
              <img src="/assets/user.png" alt="User" width="20" height="20" />
            </span>
          </div>

          {/* Password */}
          <label className="input-label">Password</label>
          <div className="field">
            <input
              type={showPwd ? "text" : "password"}
              placeholder="Enter Password"
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

          {/* Login Button */}
          <button className="btn-login" onClick={handleLogin}>
            Login
          </button>
        </div>

        {/* Footer Bar */}
        <div className="footer-bar">
          <button className="lang-chip active">EN</button>
          <div className="footer-note">
            2025 © All Rights Reserved By | RECAP4NDC
          </div>
          <button className="lang-chip">જીયુ</button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/dashboard" element={<Dashboard />} />
    </Routes>
  );
}

import React from "react"; 
import { useState } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import "../App.css";


// === Images ===
import brand from "../assets/logo-giz.png";
import leftImage from "../assets/Group.jpg";
import rightBg from "../assets/Background.png";

// Pages
import Dashboard from "../pages/Dashboard";

function LoginPage() {
  const [showPwd, setShowPwd] = useState(false);
  const navigate = useNavigate();

  const handleLogin = () => {
    // Later: add real authentication logic
    navigate("/dashboard"); // redirect after login
  };

  return (
    <div className="screen">
      {/* LEFT PANEL */}
      <section className="left-panel">
        <div className="left-panel-glass">
          <img src={leftImage} alt="Left Panel Banner" className="left-image" />
        </div>
      </section>

      {/* RIGHT PANEL */}
      <section
        className="right-panel"
        style={{ backgroundImage: `url(${rightBg})` }} // ✅ KEEPING YOUR BACKGROUND
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
                {showPwd ? "👁" : <img src="/assets/Eyeclose.png" alt="Closed Eye" width="20" height="20" />}
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
          <button className="lang-chip">ગુજ</button>
        </div>
      </section>
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

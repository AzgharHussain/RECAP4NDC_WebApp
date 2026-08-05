import React, { useState, useEffect, useRef } from "react";
import { useNavigate, NavLink } from "react-router-dom";
import "../App.css";
import { useLanguage } from "../context/LanguageContext";
import "./Login.css";
import axios from "axios";
import { API_BASE_URL } from '../config';

// === Images ===
import loginBg from "../assets/loginpage/image(6).png";
import partnerLogos from "../assets/loginpage/image(7).png";
import Eyeclose from "../assets/Eyeclose.png";
import user from "../assets/user.png";
import gujaratlogo from "../assets/FOREST DEPT.jpg";
import Moef from "../assets/Moef.jpg";
import giz from "../assets/giz.png";
import recap4NDC from "../assets/re.png";

function Login() {
  const [showPwd, setShowPwd] = useState(false);
  const { language, toggleLanguage } = useLanguage();
  const navigate = useNavigate();
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const userIdRef = useRef(null);

  const setSecureCookie = () => {
    const cookieValue = "session_active=true";
    const paths = ['/petrolling-incident', '/geo', '/ndvi-dashboard', '/admin', '/petrolling-incident/patrolling'];
    paths.forEach(path => {
      const cookieAttributes = [`path=${path}`, "Secure", "SameSite=Strict", "Max-Age=86400"];
      document.cookie = `${cookieValue}; ${cookieAttributes.join('; ')}`;
    });
    document.cookie = `session_active=true; path=/api; secure; samesite=strict; max-age=86400`;
  };

  useEffect(() => {
    if (userIdRef.current) userIdRef.current.focus();
  }, []);

  const text = {
    en: {
      welcome: "WELCOME BACK",
      title: "Sign In",
      subtitle: "Access your patrol dashboard",
      userId: "USER ID",
      userPlaceholder: "Enter your User ID",
      password: "PASSWORD",
      passPlaceholder: "Enter your password",
      loginButton: "Login",
      privacyTerms: "Privacy Notice & Terms of Use",
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
      welcome: "પાછા સ્વાગત છે",
      title: "સાઇન ઇન",
      subtitle: "તમારું પેટ્રોલ ડેશબોર્ડ ઍક્સેસ કરો",
      userId: "વપરાશકર્તા ID",
      userPlaceholder: "તમારું વપરાશકર્તા ID દાખલ કરો",
      password: "પાસવર્ડ",
      passPlaceholder: "તમારું પાસવર્ડ દાખલ કરો",
      loginButton: "લૉગિન",
      privacyTerms: "ગોપનીયતા સૂચના અને વપરાશની શરતો",
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

  // Session management
  const createSession = (userData, isAdmin = false) => {
    const sessionData = {
      user: { ...userData, isAdmin, loginTime: new Date().toISOString() },
      sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      isActive: true
    };
    setSecureCookie();
    localStorage.setItem('session', JSON.stringify(sessionData));
    localStorage.setItem('userData', JSON.stringify(sessionData.user));
    return sessionData;
  };

  const validateSession = () => {
    try {
      const sessionStr = localStorage.getItem('session');
      if (!sessionStr) return false;
      const session = JSON.parse(sessionStr);
      if (new Date(session.expiresAt) < new Date()) { clearSession(); return false; }
      session.lastActivity = new Date().toISOString();
      localStorage.setItem('session', JSON.stringify(session));
      return true;
    } catch { return false; }
  };

  const clearSession = () => {
    localStorage.removeItem('session');
    localStorage.removeItem('userData');
    localStorage.removeItem('token');
    localStorage.removeItem('authToken');
  };

  // Handlers
  const handleUserIdChange = (e) => { setUserId(e.target.value); setError(""); };
  const handlePasswordChange = (e) => { setPassword(e.target.value); setError(""); };
  const handleKeyPress = (e) => { if (e.key === 'Enter') handleLogin(); };
  const handleLanguageToggle = (lang) => { if (!loading) toggleLanguage(lang); };

  // Forest SOAP auth via backend
  const forestLogin = async (username, password) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/forest-login`, { username, password }, { timeout: 30000 });
      if (response.status !== 200) throw new Error('FOREST_SERVICE_UNAVAILABLE');
      const data = response.data;
      if (!data.success) throw new Error('FOREST_AUTH_FAILED');
      const userData = data.jsonMap;
      if (!userData || !userData.NAME || userData.NAME === '-') throw new Error('FOREST_AUTH_FAILED');
      return userData;
    } catch (error) {
      if (error.message === 'FOREST_AUTH_FAILED') throw new Error('FOREST_AUTH_FAILED');
      else if (error.code === 'ECONNABORTED') throw new Error('FOREST_TIMEOUT');
      else if (error.code === 'ENOTFOUND' || error.message.includes('Network Error')) throw new Error('FOREST_CONNECTION_FAILED');
      else if (error.message.includes('502') || error.message.includes('504') || error.message.includes('503')) throw new Error('FOREST_SERVICE_UNAVAILABLE');
      throw new Error(error.message || 'FOREST_AUTH_FAILED');
    }
  };

  const saveUser = async (username, password) => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/saveuser`,
        { username, password },
        { headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'x-temp-token': 'RECAP4NDC_TEMP_TOKEN' }, timeout: 10000 }
      );
      const { token } = response.data;
      if (token) localStorage.setItem("token", token);
      return response.data;
    } catch { return null; }
  };

  const handleLogin = async () => {
    if (!userId || !password) { setError(text[language].errorRequired); return; }
    setLoading(true);
    setError("");
    try {
      // Admin check
      try {
        const adminResponse = await axios.post(`${API_BASE_URL}/api/admin`, { username: userId, password });
        if (adminResponse.data.success) {
          const adminUserData = { username: userId, name: adminResponse.data.user.name || "Administrator", isAdmin: true, permissions: adminResponse.data.user.permissions || ['all'], source: 'admin_api' };
          createSession(adminUserData, true);
          localStorage.setItem('token', adminResponse.data.token);
          await axios.get(`${API_BASE_URL}/api/admincoupes`, { headers: { Authorization: `Bearer ${adminResponse.data.token}` } });
          navigate("/admin");
          setLoading(false);
          return;
        }
      } catch { /* Continue to forest auth */ }

      // Forest auth
      const jsonMap = await forestLogin(userId, password);
      if (!jsonMap || Object.keys(jsonMap).length === 0) throw new Error("INVALID_CREDENTIALS");

      const userData = {
        name: jsonMap.NAME || "-", post: jsonMap.NameOfPost || "-", cadre: jsonMap.CadreName || "-",
        circle: jsonMap.CircleName || "-", division: jsonMap.DivisionName || "-", range: jsonMap.RangeName || "-",
        round: jsonMap.RoundName || "-", beat: jsonMap.BeatName || "-", mobile: jsonMap.MobileNo || "-",
        email: jsonMap.EmailID || "-", userId: jsonMap.USER_ID || userId, userType: jsonMap.USER_TYPE || "-",
        forestId: jsonMap.F_ID || "-", username: userId, isAdmin: false, source: 'forest_service_frontend'
      };

      if (userData.name === "-" && userData.mobile === "-") throw new Error("INVALID_CREDENTIALS");

      createSession(userData, false);
      localStorage.setItem("authToken", "forest_authenticated");
      await saveUser(userId, password);

      if (validateSession()) navigate("/geo");
      else throw new Error("SESSION_CREATION_FAILED");

    } catch (error) {
      clearSession();
      if (error.code === 'ECONNABORTED') setError(text[language].timeout);
      else if (error.message === 'INVALID_CREDENTIALS' || error.message === 'FOREST_AUTH_FAILED') setError(text[language].errorInvalid);
      else if (error.message === 'FOREST_TIMEOUT') setError(text[language].timeout);
      else if (error.message === 'FOREST_CONNECTION_FAILED') setError(text[language].forestConnectionFailed);
      else if (error.message === 'FOREST_SERVICE_UNAVAILABLE') setError(text[language].forestServiceUnavailable);
      else if (error.message === 'SESSION_CREATION_FAILED') setError("Failed to create session. Please try again.");
      else if (error.response) {
        if (error.response.status === 401 || error.response.status === 403) setError(text[language].errorInvalid);
        else if (error.response.status === 404) setError("API endpoint not found");
        else if (error.response.status >= 500) setError(text[language].errorServer);
        else setError(`Error: ${error.response.status}`);
      } else if (error.request) setError(text[language].errorNetwork);
      else setError(error.message || text[language].errorServer);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* ===== HEADER ===== */}
      <header id="header">
        <div className="newcontainer">
          <div className="headAssets">
            {/* Left: Logo + Title */}
            <div className="logo">
              <img src={gujaratlogo} alt="Gujarat Forest Department logo" style={{ width: '50px' }} />
              <div className="portal-header">
                <h2><b>FOREST PATROLLING &amp; MONITORING SYSTEM</b></h2>
              </div>
            </div>

            {/* Right: Language selector + Ministry logos */}
            <div className="ministryLogo">
              <div className="header-lang-selector">
                <button
                  id="login-lang-en"
                  className={`header-lang-btn ${language === "en" ? "active" : ""}`}
                  onClick={() => handleLanguageToggle("en")}
                  disabled={loading}
                  title="English"
                >
                  English
                </button>
                <button
                  id="login-lang-gu"
                  className={`header-lang-btn ${language === "gu" ? "active" : ""}`}
                  onClick={() => handleLanguageToggle("gu")}
                  disabled={loading}
                  title="ગુજરાતી"
                >
                  ગુજ
                </button>
              </div>
              <div className="l_1">
                <img src={Moef} alt="Ministry of Environment, Forest and Climate Change" style={{ width: '120px' }} />
              </div>
              <div className="l_2">
                <img src={giz} alt="GIZ logo" style={{ width: '160px' }} />
              </div>
              <div className="l_3">
                <a href="/"><img src={recap4NDC} alt="RECAP4NDC" style={{ height: '60px' }} /></a>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ===== LOGIN BODY ===== */}
      <div className="login-screen2222">

        {/* ── LEFT PANEL: forest bg + partner logos ── */}
        <div className="login-left-panel">
          <img src={loginBg} alt="Forest background" className="login-left-bg" />
          <div className="login-left-overlay" />
          <div className="login-left-content">
            <img src={partnerLogos} alt="Partner Logos" className="login-partners" />
          </div>
        </div>

        {/* ── RIGHT PANEL: sign-in form ── */}
        <div className="right-Panel">

          {/* × Close */}
          <button
            className="login-close"
            onClick={() => navigate("/")}
            aria-label="Close login"
            type="button"
          >
            ×
          </button>

          {/* Floating white card */}
          <div className="login-card">

            {/* RECAP4NDC logo */}
            <div className="login-form-logo">
              <img src={recap4NDC} alt="RECAP4NDC logo" className="login-recap-logo" />
            </div>

            <p className="login-welcome">{text[language].welcome}</p>
            <h2 className="login-heading">{text[language].title}</h2>
            <p className="login-subtitle">{text[language].subtitle}</p>

            {/* Error */}
            {error && <div className="error-message">{error}</div>}

            {/* USER ID */}
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
                <img src={user} alt="User" width="18" height="18" />
              </span>
            </div>

            {/* PASSWORD */}
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
              >
                {showPwd
                  ? "👁"
                  : <img src={Eyeclose} alt="Closed Eye" width="18" height="18" />
                }
              </button>
            </div>

            {/* Login Button */}
            <button className="btn-login" onClick={handleLogin} disabled={loading}>
              {loading && <span></span>}
              {loading ? text[language].loggingIn : text[language].loginButton}
            </button>

            {/* Privacy Notice */}
            <div className="login-links">
              <NavLink to="/privacy-policy">{text[language].privacyTerms}</NavLink>
            </div>

          </div>{/* end .login-card */}

        </div>{/* end .right-Panel */}

      </div>{/* end .login-screen2222 */}
    </>
  );
}

export default Login;
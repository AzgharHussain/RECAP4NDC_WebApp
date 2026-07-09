import React, { useState, useEffect, useRef } from "react";
import { useNavigate ,NavLink} from "react-router-dom";
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

// import "../layouts/DashboardLayout.css";

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
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const userIdRef = useRef(null);

  const setSecureCookie = () => {
  const cookieValue = "session_active=true";
  
  // Set cookies for each path your app uses
  const paths = ['/petrolling-incident', '/geo', '/ndvi-dashboard', '/admin', '/petrolling-incident/patrolling'];
  
  paths.forEach(path => {
    const cookieAttributes = [
      `path=${path}`,        // Path-specific cookie ✓
      "Secure",
"SameSite=Strict",
"Max-Age=86400"
    ];
    document.cookie = `${cookieValue}; ${cookieAttributes.join('; ')}`;
  });
  
  // Also set a general API cookie if needed
  document.cookie = `session_active=true; path=/api; secure; samesite=strict; max-age=86400`;
};

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

    setSecureCookie();

    // Store session in localStorage
    localStorage.setItem('session', JSON.stringify(sessionData));
    
    localStorage.setItem('userData', JSON.stringify(sessionData.user));
    
    if (isAdmin) {
      console.log("✅ Admin session created:");
    } else {
      console.log("✅ User session created:");
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

  // SOAP authentication via backend API (works in both dev and production)
  const forestLogin = async (username, password) => {
    try {
      console.log("🌲 Making forest login request via backend API...");

      const response = await axios.post(
        `${API_BASE_URL}/api/forest-login`,
        { username, password },
        { timeout: 30000 }
      );

      console.log('Forest login response status:', response.status);

      if (response.status !== 200) {
        throw new Error('FOREST_SERVICE_UNAVAILABLE');
      }

      const data = response.data;

      if (!data.success) {
        throw new Error('FOREST_AUTH_FAILED');
      }

      const userData = data.jsonMap;
      console.log('Extracted user data:', userData);

      if (!userData || !userData.NAME || userData.NAME === '-') {
        throw new Error('FOREST_AUTH_FAILED');
      }

      return userData;

    } catch (error) {
      console.error('Forest login error:', error.message);

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

const saveUser = async (username, password) => {
  try {
    console.log("📝 Attempting to save user:", username);
    console.log("📝 Attempting to save password:", password);
    
    // Validate input
    if (!username || !password) {
      console.error("❌ Username or password is empty or invalid");
      return null;
    }

    // Log the request details
    console.log("Sending request to:", `${API_BASE_URL}/api/saveuser`);
    console.log("Request payload:", { username: username, password: password });

    const response = await axios.post(
      `${API_BASE_URL}/api/saveuser`,
      { username: username ,password: password},  // Send as object with trimmed username
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'x-temp-token': 'RECAP4NDC_TEMP_TOKEN' // Custom header for temporary token verification
        },
        timeout: 10000 // 10 second timeout
      }
    );  
       
    

    console.log("✅ Save user response received:", {
      status: response.status,
      statusText: response.statusText,
      data: response.data
    });

    const { token, user } = response.data;

    if (token) {
      localStorage.setItem("token", token);
      console.log("🔐 JWT saved to localStorage");
    }

    return response.data;
  } catch (err) {
    // Detailed error logging
    console.error("❌ Failed to save user:");
    
    if (err.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error("Server responded with error:", {
        status: err.response.status,
        statusText: err.response.statusText,
        data: err.response.data,
        headers: err.response.headers
      });
      
      // Check if it's a validation error from backend
      if (err.response.status === 400) {
        console.error("Validation error:", err.response.data.error);
      }
    } else if (err.request) {
      // The request was made but no response was received
      console.error("No response received from server:", {
        request: err.request,
        message: err.message
      });
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error("Request setup error:", err.message);
    }
    
    return null;
  }
};

  const handleLogin = async () => {
    // Validation
    if (!userId || !password) {
      setError(text[language].errorRequired);
      return;
    }

    setLoading(true);
    setError("");

    try {
      console.log("👑 Checking admin credentials...");
      
      try {
        const adminResponse = await axios.post(`${API_BASE_URL}/api/admin`, {
          username: userId,
          password: password
        });
        
        if (adminResponse.data.success) {
          const adminUserData = {
            username: userId,
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

      console.log("🌲 Proceeding with Forest authentication...");
      const jsonMap = await forestLogin(userId, password);
      
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
        userId: jsonMap.USER_ID || userId,
        userType: jsonMap.USER_TYPE || "-",
        forestId: jsonMap.F_ID || "-",
        username: userId,
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
      await saveUser(userId,password);

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
    <>
  <header id="header" >
                <div className="newcontainer">
                    <div className="headAssets" style={{display:'flex',justifyContent:'space-between', alignItems:'center', gap:'10px',   padding:'2px',width:'97%'}}>
                        <div className="logo" style={{display:'flex', alignItems:'center', gap:'10px',paddingLeft:'35px'}}>
                            {/* <a href="indexs.aspx">
                                </a> */}
                                <img src={gujaratlogo} alt="logo picture" style={{width:'50px'}}></img>
                      
                        <div className="portal-header">
                            <div className="icon" aria-hidden="true"></div>
                            <h2 style={{letterSpacing:"2px"}}><b style={{fontFamily: '"arial', fontWeight: 700,}}>FOREST PATROLLING & MONITORING SYSTEM</b></h2>
                        </div>  </div>
                      
                        <div className="ministryLogo" style={{display:'flex', alignItems:'center', gap:'23px', paddingRight:'45px'}}>
                            <div className="l_1">
                                {/* <a href="https://moef.gov.in/" target="_blank">
                                    </a> */}
                                    <img src={Moef} alt="picture" style={{width:'120px'}}></img>
                            </div>
                            <div className="l_2">
                                {/* <a href="https://www.giz.de/de/html/index.html" target="_blank">
                                    </a> */}
                                    <img src={giz} alt="giz logo" style={{width:'160px'}}></img>
                            </div>
                            <div className="l_3">
                                {/* <a href="#!" target="_blank">
                                    </a> */}
                                     <a href="/" ><img src={recap4NDC} alt="recap4NDC" style={{ height:'60px'}}></img></a>
                            </div>
                            {/* <div>
<button
              className="logout-btn"
              onClick={handleLogout}
            >
              {text[language].logout}
            </button>
                            </div> */}
                            
                        </div>
                    </div>
                </div>
            </header>

    
      {/* Left logos container */}
      <div className="login-screen2222"> 
           <img 
          src={leftLogos} 
          alt="Partner Logos" 
         style={{
          width:"350px",
          height:"620px",
           
           backgroundColor:"white"
         }}
         className="image22222222"
        />

       
       <div
       className="right-Panel"
        
      >
     
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
            <div 
           style={{display:"flex",justifyContent:"space-between",marginTop:"20px"}}
           
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

            <div className="login-links">
              <a href="#" onClick={(e) => { e.preventDefault(); setShowPrivacy(true); }}>Privacy Notice</a>
              <a href="#" onClick={(e) => { e.preventDefault(); setShowTerms(true); }}>Terms of Use</a>
            </div>
          </div>

          


       

    
      {showPrivacy && (
        <div className="modal-overlay" onClick={() => setShowPrivacy(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowPrivacy(false)}>&times;</button>
            <h2 className="modal-title">PRIVACY NOTICE &ndash; INDIA</h2>
            <h3 className="modal-subtitle">FOREST PATROLLING &amp; MONITORING SYSTEM</h3>
            <p className="modal-updated">Last Updated: 9 July 2026</p>
            <p>This Privacy Notice explains how the Forest Patrolling &amp; Monitoring System ("Application", "we", "our", or "us") collects, uses, stores, and shares information in connection with the provision of forest patrolling and monitoring services.</p>
            <p>The Application has been developed for the Gujarat Forest Department under the RECAP4NDC Project implemented by Deutsche Gesellschaft f&uuml;r Internationale Zusammenarbeit (GIZ) GmbH.</p>
            <p>This Privacy Notice applies to the Application available at https://forestrecap.gisfy.co.in/ and all related services associated with the Forest Patrolling &amp; Monitoring System.</p>
            <h4>1. Information We Collect</h4>
            <p>The Application is designed to minimize data collection and only collects information that is necessary for operational forest patrolling activities.</p>
            <h5>Location Information</h5>
            <p>During active patrol operations, the Application collects:</p>
            <ul>
              <li>GPS coordinates of patrol locations;</li>
              <li>Patrol route information;</li>
              <li>Date and time stamps associated with location events; and</li>
              <li>Device identifiers required for synchronization, authentication, and operational continuity.</li>
            </ul>
            <h5>Technical Device Information</h5>
            <p>The Application may collect limited technical information required for application functionality and troubleshooting, including:</p>
            <ul>
              <li>Device model;</li>
              <li>Operating system version;</li>
              <li>Application version; and</li>
              <li>Error and diagnostic logs.</li>
            </ul>
            <h4>2. Information We Do Not Collect</h4>
            <p>The Application is not designed to collect or process the following information unless separately provided through departmental systems:</p>
            <ul>
              <li>Personal contact information such as email addresses or phone numbers;</li>
              <li>Demographic information;</li>
              <li>Biometric information;</li>
              <li>Audio recordings;</li>
              <li>Photographs or videos captured for personal purposes; or</li>
              <li>Any other information not required for official forest patrolling operations.</li>
            </ul>
            <h4>3. How We Use Information</h4>
            <p>Collected information is used exclusively for official purposes, including:</p>
            <ul>
              <li>Recording and monitoring patrol routes and coverage areas;</li>
              <li>Supporting forest protection, monitoring, and enforcement activities;</li>
              <li>Providing operational oversight to authorized officers of the Gujarat Forest Department;</li>
              <li>Generating anonymized and aggregated reports for project monitoring and evaluation under RECAP4NDC; and</li>
              <li>Maintaining, securing, and improving the Application.</li>
            </ul>
            <h4>4. Sharing of Information</h4>
            <p>Information collected through the Application may be shared only in the following circumstances:</p>
            <h5>Gujarat Forest Department</h5>
            <p>Location information and patrol records are accessible to authorized officers of the Gujarat Forest Department for operational supervision and management purposes.</p>
            <h5>Service Providers</h5>
            <p>Information may be processed by authorized hosting, cloud infrastructure, mapping, or technical support providers strictly for the purpose of operating and maintaining the Application.</p>
            <h5>Project Partners</h5>
            <p>Aggregated and anonymized information, such as patrol coverage statistics and heat maps, may be shared with GIZ and RECAP4NDC partners for project reporting, monitoring, and evaluation purposes.</p>
            <h5>Legal Requirements</h5>
            <p>Information may be disclosed where required by applicable law, court order, or governmental authority.</p>
            <h4>5. Location Permissions</h4>
            <p>Location access is essential for the intended functionality of the Application.</p>
            <p>Disabling location permissions may prevent the Application from recording patrol activities and may limit or disable core operational features required for official duties.</p>
            <h4>6. Data Storage and Retention</h4>
            <p>Data collected through the Application is stored on infrastructure located in India and retained in accordance with:</p>
            <ul>
              <li>Gujarat Forest Department record retention policies;</li>
              <li>Applicable legal requirements; and</li>
              <li>RECAP4NDC project obligations.</li>
            </ul>
            <p>Following the expiry of retention requirements, data may be securely deleted or anonymized.</p>
            <h4>7. International Data Transfers</h4>
            <p>The Application primarily stores and processes data within India. Any international access for technical support or project management purposes will be subject to appropriate safeguards and applicable legal requirements.</p>
            <h4>8. Changes to this Privacy Notice</h4>
            <p>This Privacy Notice may be updated from time to time to reflect operational, legal, or technical changes. Updated versions will be published through the Application.</p>
            <h4>9. Contact Information</h4>
            <p>For questions regarding this Privacy Notice, please contact:</p>
            <p>Gujarat Forest Department<br />RECAP4NDC Project<br />Email: [Project Coordinator Email]</p>
          </div>
        </div>
      )}

      {showTerms && (
        <div className="modal-overlay" onClick={() => setShowTerms(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowTerms(false)}>&times;</button>
            <h2 className="modal-title">TERMS OF USE</h2>
            <h3 className="modal-subtitle">FOREST PATROLLING &amp; MONITORING SYSTEM</h3>
            <p className="modal-updated">Last Updated: 9 July 2026</p>
            <p>These Terms of Use govern access to and use of the Forest Patrolling &amp; Monitoring System ("Application").</p>
            <p>By accessing or using the Application, you agree to comply with these Terms.</p>
            <h4>1. Eligibility and Authorization</h4>
            <p>Access to the Application is restricted to authorized personnel, employees, contractors, or agents of the Gujarat Forest Department acting within the scope of their official responsibilities.</p>
            <p>Users are responsible for maintaining the confidentiality and security of their login credentials. Credential sharing with unauthorized individuals is strictly prohibited.</p>
            <h4>2. Permitted Use</h4>
            <p>The Application may only be used for official forest patrolling, monitoring, conservation, and enforcement activities.</p>
            <p>Users agree that they will not:</p>
            <ul>
              <li>Use the Application for personal or commercial purposes;</li>
              <li>Circumvent or disable security controls or location tracking mechanisms;</li>
              <li>Attempt to reverse engineer, modify, or interfere with the Application; or</li>
              <li>Share patrol data or operational information without authorization.</li>
            </ul>
            <h4>3. Ownership of Data</h4>
            <p>All patrol information, location records, operational data, and derived outputs generated through the Application are the property of the Gujarat Forest Department.</p>
            <p>Unauthorized copying, extraction, publication, or distribution of such information is prohibited.</p>
            <h4>4. Availability and Accuracy</h4>
            <p>The Application is provided on an "AS IS" and "AS AVAILABLE" basis.</p>
            <p>The Gujarat Forest Department, GIZ, RECAP4NDC, and the Application developers do not guarantee uninterrupted service availability or the accuracy of GPS positioning, particularly in areas with limited network connectivity or satellite coverage.</p>
            <h4>5. Limitation of Liability</h4>
            <p>To the fullest extent permitted by applicable law, the Gujarat Forest Department, GIZ, RECAP4NDC, and associated developers shall not be liable for any indirect, incidental, consequential, or special damages arising from the use of the Application.</p>
            <h4>6. Indemnification</h4>
            <p>Users agree to indemnify and hold harmless the Gujarat Forest Department, GIZ, RECAP4NDC, and their respective officers, employees, and representatives against claims arising from unauthorized use or misuse of the Application.</p>
            <h4>7. Intellectual Property</h4>
            <p>The Application software, interface, documentation, source code, maps, and associated datasets are protected by applicable intellectual property laws.</p>
            <p>Unless otherwise specified, ownership remains with the Gujarat Forest Department, RECAP4NDC, GIZ, or their licensors.</p>
            <h4>8. Governing Law</h4>
            <p>These Terms shall be governed by the laws of India.</p>
            <p>Any disputes arising from these Terms or the use of the Application shall be subject to the exclusive jurisdiction of the competent courts located in Gandhinagar, Gujarat.</p>
            <h4>9. Privacy Notice</h4>
            <p>By using the Application, users acknowledge that location information is processed in accordance with the Privacy Notice described above.</p>
          </div>
        </div>
      )}

    </div>
  </>
  );
}

export default Login;
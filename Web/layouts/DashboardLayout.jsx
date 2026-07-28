import React, { useState, useEffect,useRef } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { FaThLarge, FaGlobe, FaClipboardList, FaBars, FaUpload, FaTimes, FaEye,FaChevronUp, FaChevronDown ,FaChevronRight, FaMapMarkedAlt} from "react-icons/fa"; 
import { MdLocalPolice } from "react-icons/md";
import { GiNotebook } from "react-icons/gi";
import brand from "../assets/FOREST DEPT.jpg";
import logos1 from "../assets/logos1.png";
import logos2 from "../assets/logos2.png";
import logos3 from "../assets/logos3.png";
import logos4 from "../assets/logos4.png";
import logos5 from "../assets/logos5.png";
import logos6 from "../assets/logos6.png";
import logos7 from "../assets/logos7.png";
import logos8 from "../assets/logos8.png";
import logos9 from "../assets/logos9.png";
import logos10 from "../assets/logos10.png";
import logos11 from "../assets/logos11.png";
import userIcon from "../assets/user.png";
import patrollingIcon from "../assets/Patrolling.png";
import incidentIcon from "../assets/incident.png";
import { useLanguage } from "../context/LanguageContext";
import "./DashboardLayout.css";

import { API_BASE_URL } from '../config';
import axios from "axios";

import gujaratlogo from "../assets/FOREST DEPT.jpg";
import Moef from "../assets/Moef.jpg";
import giz from "../assets/giz.png";
import recap4NDC from "../assets/re.png";

export default function DashboardLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isPatrollingOpen, setIsPatrollingOpen] = useState(false);
  const [isWorkingPlanOpen, setIsWorkingPlanOpen] = useState(false);
  const [isAdminMenuOpen, setIsAdminMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate(); // Add useNavigate hook
  const { language, toggleLanguage } = useLanguage();
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const headerRef = useRef(null);
const [contentHeight, setContentHeight] = useState(0);

  // Language Texts
  const text = {
    en: {
      overview: "Overview",
      geoDashboard: "Geo Dashboard",
      patrollingLogs: "Patrolling Logs",
      incidentLogs: "Incident Logs",
      workingPlan: "Working Plan Areas",
      uploadCoupe: "Upload Coupe Boundaries",
      viewCoupe: "View Coupe Boundaries",
      coupeLog: "Coupe Observation Log",
      patrollingIncident: "Patrolling",
      logout: "Logout",
      admin: "Admin",
      language: "Language",
      english: "English",
      gujarati: "Gujarati",
      NDVIDashboard: "NDVI Dashboard",           // Added
      PatrolCoverageAnalysis: "Plantation Coverage Analysis"
    },
    gu: {
      overview: "સારાંશ",
      geoDashboard: "ભૂગોળ ડેશબોર્ડ",
      patrollingLogs: "પેટ્રોલિંગ લોગ્સ",
      incidentLogs: "ઘટના લોગ્સ",
      workingPlan: "કામ કરવાના વિસ્તારમાં",
      uploadCoupe: "કૂપ બાઉન્ડરી અપલોડ કરો",
      viewCoupe: "કૂપ બાઉન્ડરી જુઓ",
      coupeLog: "કૂપ અવલોકન લોગ",
      patrollingIncident: "પેટ્રોલિંગ",
      logout: "લૉગઆઉટ",
      admin: "એડમિન",
      language: "ભાષા",
      english: "અંગ્રેજી",
      gujarati: "ગુજરાતી",
      NDVIDashboard: "NDVI ડેશબોર્ડ",        // Added (Gujarati translation)
      PatrolCoverageAnalysis: "પ્લાન્ટેશન આવરણનું વિશ્લેષણ"
    },
  };

  
  const getUserName = () => {
    try {
      // Try to get from session storage first
      const sessionStr = localStorage.getItem('session');
      if (sessionStr) {
        const session = JSON.parse(sessionStr);
        return session.user?.name || session.user?.username || 'User';
      }
      
      // Fallback to userData
      const userDataStr = localStorage.getItem('userData');
      if (userDataStr) {
        const userData = JSON.parse(userDataStr);
        return userData.name || userData.username || 'User';
      }
      
      return 'User';
    } catch (error) {
      console.error("Error getting username:", error);
      return 'User';
    }
  };

  const username = getUserName();

  useEffect(() => {
    if (location.pathname === "/petrolling-incident/patrolling" || location.pathname === "/petrolling-incident/incident") {
      setIsPatrollingOpen(true);
    }
  }, [location]);



useEffect(() => {
  const updateHeight = () => {
    if (headerRef.current) {
      setContentHeight(window.innerHeight - headerRef.current.offsetHeight);
    }
  };

  updateHeight();
  window.addEventListener("resize", updateHeight);
  return () => window.removeEventListener("resize", updateHeight);
}, []);

  const handleLinkClick = () => {
    setIsSidebarOpen(false);
  };

  const handleLogout = async () => {
  try {
    const token = localStorage.getItem("token");

    if (token) {
      await axios.post(
        `${API_BASE_URL}/api/logout`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
    }
  } catch (err) {
    console.error("Logout API error:", err);
  }

  // Clear storage
  [
    'session',
    'userData',
    'token',
    'authToken',
    'forest_authenticated',
    'user',
    'admin_token'
  ].forEach(item => {
    localStorage.removeItem(item);
    sessionStorage.removeItem(item);
  });

  // Clear cookies
  document.cookie.split(";").forEach(cookie => {
    document.cookie = cookie
      .replace(/^ +/, "")
      .replace(/=.*/, "=;expires=" + new Date(0).toUTCString() + ";path=/");
  });

  // Redirect cleanly
  window.location.href = "/";
};

  const isAdminUser = () => {
    try {
      const sessionStr = localStorage.getItem('session');
      if (sessionStr) {
        const session = JSON.parse(sessionStr);
        return session.user?.isAdmin === true;
      }
      return false;
    } catch (error) {
      return false;
    }
  };

  const isAdmin = isAdminUser();

  const isActiveLink = (path) => location.pathname === path;
const dropdownRef = useRef(null);
const [isDropdownOpen, setIsDropdownOpen] = useState(false);

// Close dropdown when clicking outside
useEffect(() => {
  const handleClickOutside = (event) => {
    if (
      dropdownRef.current &&
      !dropdownRef.current.contains(event.target)
    ) {
      setIsDropdownOpen(false);
    }
  };

  document.addEventListener("click", handleClickOutside); // 🔁 use click instead of mousedown

  return () => {
    document.removeEventListener("click", handleClickOutside);
  };
}, []);
  return (
    <div className="layout">
      {/* Header */}
      <header className="header" ref={headerRef}>
        {/* ===== TOP ROW ===== */}
        {/* <div className="header-top">
          <div className="header-left">
            <button
              className="hamburger-btn"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            >
              {isSidebarOpen ? <FaTimes /> : <FaBars />}
            </button>
            <img src={brand} alt="RECAP4NDC" className="header-logo" />
          </div>

          <div className="header-logos">
            <img src={logos1} alt="Logo 1" />
            <img src={logos2} alt="Logo 2" />
            <img src={logos3} alt="Logo 3" />
            <img src={logos4} alt="Logo 4" />
            <img src={logos5} alt="Logo 5" />
            <img src={logos6} alt="Logo 6" />
            <img src={logos7} alt="Logo 7" />
            <img src={logos8} alt="Logo 8" />
            <img src={logos9} alt="Logo 9" />
            <img src={logos10} alt="Logo 10" />
            <img src={logos11} alt="Logo 11" />
          </div>

          <div className="header-right">
            <img src={userIcon} alt="User Icon" className="user-icon-img" />
            <span className="username">
              <b>{username}</b>
              {isAdmin && <span className="admin-badge"> (Admin)</span>}
            </span>
            
            <div
              className="admin-section"
              onClick={() => setIsAdminMenuOpen(!isAdminMenuOpen)}
            >
              <span className="arrow-icon">
                {isAdminMenuOpen ? <FaChevronDown /> : <FaChevronRight />}
              </span>
            </div>
            <div className="admin-dropdown-section">
            <button
              className="logout-btn"
              onClick={handleLogout}
            >
              {text[language].logout}
            </button>
          </div>
          </div>
        </div> */}
        <div>
<div className="newcontainer">

        <header id="header">
                <div className="container-fluid22">
                    <div className="headAssets" style={{display:'flex',justifyContent:'space-between', alignItems:'center', gap:'10px',   padding:'2px',width:'100%'}}>
                        <div className="logo" style={{display:'flex', alignItems:'center', gap:'10px',paddingLeft:'25px'}}>
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
                                <a href="/" >
                                    
                                    <img src={recap4NDC} alt="recap4NDC" style={{ height:'60px'}}></img></a>
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
        {/* ===== BOTTOM ROW (BUTTONS) ===== */}
        <div className="header-bottom2">
          <div className="header-bottom">

         
          <NavLink
            to="/geo"
            className={`menu-item ${isActiveLink("/geo") ? "active" : ""}`}
            onClick={handleLinkClick}
          >
            <FaGlobe  />
            {text[language].geoDashboard}
          </NavLink>
          <NavLink
            to="/petrolling-incident/patrolling"
            className={`menu-item ${
              isActiveLink("/petrolling-incident/patrolling") ? "active" : ""
            }`}
            onClick={handleLinkClick}
          >
            <img src={patrollingIcon} alt="Patrolling" className="menu-image" />
            {text[language].patrollingLogs}
          </NavLink>
          
          <NavLink
            to="ndvi-dashboard"
            className={`menu-item ${
              isActiveLink("/ndvi-dashboard") ? "active" : ""
            }`}
            onClick={handleLinkClick}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="29" height="16" viewBox="0 0 29 30" fill="none">
<path d="M27.3707 3.8604C27.5482 4.03817 27.5889 4.2545 27.6467 4.49166C27.6604 4.54599 27.6741 4.60032 27.6883 4.6563C27.9958 5.93656 28.1866 7.27376 28.2859 8.58594C28.2896 8.63503 28.2934 8.68413 28.2973 8.73471C28.507 11.6149 28.2611 14.5095 27.4169 17.2758C27.3999 17.333 27.3829 17.3901 27.3653 17.449C26.7272 19.5582 25.5765 21.6035 24.0738 23.2157C23.9549 23.3436 23.8435 23.4751 23.732 23.6094C21.3279 26.3499 17.7388 28.0559 14.1813 28.5727C14.1359 28.5797 14.0905 28.5867 14.0437 28.5939C13.5085 28.6658 12.9656 28.6558 12.4266 28.6562C12.3462 28.6563 12.3462 28.6563 12.2641 28.6564C11.4183 28.6553 10.5989 28.6184 9.7695 28.439C9.71702 28.4279 9.66455 28.4168 9.61048 28.4053C8.74619 28.2156 7.79485 27.9517 7.03258 27.4916C6.84709 27.417 6.75055 27.4449 6.56089 27.5032C6.39448 27.5792 6.39448 27.5792 6.22666 27.6763C6.16261 27.7118 6.09857 27.7474 6.03258 27.784C5.96427 27.8223 5.89596 27.8606 5.82558 27.9001C4.54535 28.6033 3.24092 29.1827 1.87686 29.7013C1.75713 29.7469 1.63763 29.7932 1.51854 29.8405C1.18138 29.973 0.903537 30.0378 0.544739 29.9764C0.373446 29.8762 0.373446 29.8762 0.277355 29.7091C0.241155 29.5231 0.228539 29.3581 0.277355 29.1743C0.475252 28.9389 0.660742 28.8441 0.947904 28.7411C1.02768 28.7119 1.10746 28.6827 1.18965 28.6525C1.25269 28.63 1.25269 28.63 1.317 28.6069C1.5375 28.5277 1.75698 28.4458 1.97645 28.3638C2.02014 28.3475 2.06384 28.3312 2.10886 28.3144C2.69255 28.0951 3.25805 27.8391 3.8202 27.57C3.86581 27.5483 3.91143 27.5265 3.95843 27.5041C6.53473 26.2671 8.89496 24.6328 11.0054 22.7081C11.0967 22.6257 11.1885 22.5437 11.2822 22.464C11.6866 22.1187 12.0617 21.7452 12.4367 21.3688C12.5476 21.2575 12.6588 21.1466 12.7701 21.0358C13.1431 20.663 13.507 20.2862 13.8471 19.8828C13.9057 19.8153 13.9644 19.7478 14.0231 19.6804C14.7016 18.8881 15.3256 18.0557 15.9402 17.2132C15.9783 17.1613 16.0164 17.1095 16.0556 17.0561C16.1077 16.984 16.1077 16.984 16.1609 16.9105C16.1917 16.8681 16.2226 16.8256 16.2544 16.7818C16.3321 16.6763 16.3321 16.6763 16.3204 16.5405C16.2737 16.5721 16.2737 16.5721 16.2261 16.6042C13.5809 18.3913 13.5809 18.3913 12.318 19.2311C11.2976 19.9098 10.2821 20.5956 9.26708 21.2824C8.65757 21.6948 8.04759 22.1065 7.4375 22.518C7.19885 22.679 6.96025 22.8401 6.72165 23.0012C6.60942 23.0768 6.49709 23.1523 6.38465 23.2276C6.10667 23.4139 5.83046 23.6021 5.55673 23.7947C5.50262 23.8321 5.44852 23.8696 5.39278 23.9083C5.29091 23.9789 5.1896 24.0504 5.089 24.1228C4.79403 24.3256 4.59073 24.4254 4.22127 24.3614C4.02674 24.2526 4.02674 24.2526 3.88704 24.0941C3.77522 23.5376 3.91757 22.9113 4.02074 22.3603C4.03549 22.2802 4.05025 22.2002 4.06545 22.1177C4.76188 18.487 6.26623 15.048 8.63312 12.1956C8.66183 12.1608 8.69055 12.1261 8.72013 12.0903C9.04371 11.6996 9.36742 11.3137 9.73347 10.9616C9.84071 10.8543 9.9363 10.7417 10.0327 10.6247C10.2127 10.4111 10.41 10.232 10.6228 10.0516C10.7871 9.91002 10.9441 9.76201 11.1022 9.61369C11.5472 9.20819 12.0236 8.84685 12.5063 8.48776C12.592 8.42401 12.6775 8.36 12.7626 8.29558C13.4858 7.74883 14.2632 7.29584 15.0503 6.84796C15.0988 6.82013 15.1473 6.7923 15.1973 6.76362C18.2385 5.03129 21.7474 4.16171 25.2109 3.85246C25.2579 3.84821 25.3049 3.84396 25.3533 3.83959C27.0663 3.68819 27.0663 3.68819 27.3707 3.8604Z" fill="white"/>
<path d="M5.55819 0.0296346C6.46936 0.342577 7.2461 0.834985 7.94768 1.49501C8.09857 1.63759 8.09857 1.63759 8.27094 1.77075C9.8953 3.08281 11.184 5.80061 11.4406 7.85054C11.4078 8.07636 11.3411 8.17125 11.1667 8.31532C11.1244 8.35094 11.0821 8.38657 11.0385 8.42327C10.9934 8.46037 10.9482 8.49748 10.9017 8.5357C10.8096 8.61327 10.7176 8.69099 10.6257 8.76888C10.5815 8.80633 10.5373 8.84378 10.4917 8.88236C10.3006 9.04801 10.125 9.22692 9.94941 9.40861C9.83726 9.52075 9.72054 9.62138 9.5982 9.72221C9.38735 9.89942 9.21153 10.0938 9.03367 10.3037C8.88006 10.4811 8.71899 10.6503 8.55791 10.821C6.20001 13.3632 4.65959 16.6108 3.61966 19.8827C3.29225 19.6303 3.04847 19.3561 2.80079 19.0262C2.76312 18.9764 2.72545 18.9266 2.68663 18.8752C2.31969 18.383 1.98958 17.8731 1.68112 17.3426C1.65745 17.3021 1.63379 17.2617 1.60941 17.22C-0.13115 14.2094 -0.387602 10.627 0.492772 7.30007C1.26612 4.54917 2.72664 2.0459 4.82289 0.0964799C5.06688 -0.0255167 5.2962 -0.0120066 5.55819 0.0296346Z" fill="white"/>
</svg>
{text[language].NDVIDashboard}          </NavLink>
          <NavLink
            to="PatrolCoverageAnalysis"
            className={`menu-item ${
              isActiveLink("/PatrolCoverageAnalysis") ? "active" : ""
            }`}
            onClick={handleLinkClick}
          >
          <FaMapMarkedAlt />
          {text[language].PatrolCoverageAnalysis} 
          </NavLink>
           </div>
         <div className="header-right">
  <div className="user-dropdown" ref={dropdownRef}>
    {/* User icon and username as dropdown trigger */}
    <div 
      className="dropdown-trigger"
      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
    >
      <img src={userIcon} alt="User Icon" className="user-icon-img" />
     
    </div>
    
    {/* Dropdown menu */}
 
  </div>
</div>
        </div>
        </div>


</div>
      
      </header>

      <main className="content" style={{ height: contentHeight }}>
        <Outlet />
      </main>

      {isAdminMenuOpen && (
        <div className="admin-dropdown">
          <div className="admin-dropdown-section">
            <button
              className={`lang-chip ${language === "en" ? "active" : ""}`}
              onClick={() => {
                toggleLanguage("en");
                setIsAdminMenuOpen(false);
              }}
            >
              EN
            </button>
            <button
              className={`lang-chip ${language === "gu" ? "active" : ""}`}
              onClick={() => {
                toggleLanguage("gu");
                setIsAdminMenuOpen(false);
              }}
            >
              જીયુ
            </button>
          </div>
          
          
        </div>
      )}
         {isDropdownOpen && (
      <div className="dropdown-menu" onClick={(e) => e.stopPropagation()}>
        <div className="username">
        <b>{username}</b>
        {isAdmin && <span className="admin-badge"> (Admin)</span>}
      </div>

      <div className="language-section">
      <div className="language-label">Change Language</div>
      <div className="language-buttons">
  <label className={`lang-radio ${language === "en" ? "active" : ""}`}>
    <input
      type="radio"
      name="language"
      value="en"
      checked={language === "en"}
      onChange={() => {
        toggleLanguage("en");
        // setIsDropdownOpen(false);
      }}
    />
    <span className="radio-label">English</span>
  </label>
  
  <label className={`lang-radio ${language === "gu" ? "active" : ""}`}>
    <input
      type="radio"
      name="language"
      value="gu"
      checked={language === "gu"}
      onChange={() => {
        toggleLanguage("gu");
        // setIsDropdownOpen(false);
      }}
    />
    <span className="radio-label">ગુજરાતી</span>
  </label>
</div>
    </div>
      
        <button
          className="logout-btn dropdown-item"
          onClick={handleLogout}
        >
          {text[language].logout}
        </button>
      </div>
    )}
    </div>
  );
}
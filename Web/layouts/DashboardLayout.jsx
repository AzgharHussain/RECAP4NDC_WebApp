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
import { FiUser, FiActivity } from "react-icons/fi";
import { useLanguage } from "../context/LanguageContext";
import "./DashboardLayout.css";

import { API_BASE_URL } from '../config';
import axios from "axios";
import Cookies from "js-cookie";

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
      appTitle: "FOREST MONITORING PATROLLING SYSTEM",
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
      NDVIDashboard: "NDVI Dashboard",
      NDVINotifications: "NDVI Notifications",
      PatrolCoverageAnalysis: "Plantation Coverage Analysis"
    },
    gu: {
      appTitle: "વન મોનિટરિંગ અને પેટ્રોલિંગ સિસ્ટમ",
      overview: "સારાંશ",
      geoDashboard: "ભૂગોળ ડેશબોર્ડ",
      patrollingLogs: "પેટ્રોલિંગ લોગ્સ",
      incidentLogs: "ઘટના લોગ્સ",
      workingPlan: "કામ કરવાના વિસ્તારમાં",
      uploadCoupe: "કૂપ બાઉન્ડરી અપલોડ કરો",
      viewCoupe: "કૂપ બાઉન્ડરી જુાા",
      coupeLog: "કૂપ અવલોકન લોગ",
      patrollingIncident: "પેટ્રોલિંગ",
      logout: "લ಼ોગઆઉટ",
      admin: "એડમિન",
      language: "ભાષા",
      english: "અંગ્રેજી",
      gujarati: "ગુજરાતી",
      NDVIDashboard: "NDVI ડેશબોર્ડ",
      NDVINotifications: "NDVI સૂચનાઓ",
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

  const handleLinkClick = (e) => {
    setIsSidebarOpen(false);
    // Show loader immediately and block further clicks until navigation completes
    if (e && e.currentTarget && e.currentTarget.getAttribute) {
      const targetPath = e.currentTarget.getAttribute("href");
      if (targetPath && targetPath !== location.pathname) {
        setIsNavigating(true);
      }
    }
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
  ['authToken', 'token', 'role', 'id'].forEach(name => {
    Cookies.remove(name);
    Cookies.remove(name, { path: '/' });
  });
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

// === Navigation loader: shows overlay + blocks clicks during route changes ===
const [isNavigating, setIsNavigating] = useState(false);
const prevPathRef = useRef(location.pathname);

useEffect(() => {
  const currentPath = location.pathname;
  if (currentPath !== prevPathRef.current) {
    // A navigation has occurred → show loader until the new page mounts/renders
    setIsNavigating(true);
    prevPathRef.current = currentPath;
    // Hide loader on next tick (after the new page has rendered)
    const t = setTimeout(() => setIsNavigating(false), 600);
    return () => clearTimeout(t);
  }
}, [location.pathname]);

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
      {/* Navigation loader overlay — blocks all clicks while loading */}
      {isNavigating && (
        <div className="nav-loader-overlay" role="status" aria-live="polite">
          <div className="nav-loader-box">
            <div className="nav-loader-spinner" />
            <div className="nav-loader-text">Loading…</div>
          </div>
        </div>
      )}
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
<div className="after-login-container">

        <header id="after-login-header">
                <div className="container-fluid22">
                    <div className="headAssets" style={{display:'flex',justifyContent:'space-between', alignItems:'center', gap:'10px',   padding:'2px',width:'100%',borderRadius:'50px'}}>
                        <div className="logo" style={{display:'flex', alignItems:'center', gap:'10px',paddingLeft:'25px'}}>
                            {/* <a href="indexs.aspx">
                                </a> */}
                                <img src={gujaratlogo} alt="logo picture" style={{width:'50px'}}></img>
                      
                        <div className="portal-header">
                            <h2 style={{letterSpacing:"2px"}}><b style={{fontFamily: '"arial', fontWeight: 700,}}>{text[language].appTitle}</b></h2>
                        </div>  </div>
                      
                        <div className="ministryLogo" style={{display:'flex', alignItems:'center', gap:'23px', paddingRight:'45px'}}>
                            {/* <div className="l_1">
                              
                                    <img src={Moef} alt="picture" style={{width:'120px'}}></img>
                            </div> */}
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
            <MdLocalPolice style={{ fontSize: '20px', marginRight: '6px' }} />
            {text[language].patrollingLogs}
          </NavLink>
          
          <NavLink
            to="ndvi-dashboard"
            className={`menu-item ${
              isActiveLink("/ndvi-dashboard") ? "active" : ""
            }`}
            onClick={handleLinkClick}
          >
            <FiActivity style={{ fontSize: '20px', marginRight: '6px' }} />
            {text[language].NDVIDashboard}
          </NavLink>
          <NavLink
            to="/ndvi-notifications"
            className={`menu-item ${
              isActiveLink("/ndvi-notifications") ? "active" : ""
            }`}
            onClick={handleLinkClick}
          >
            <FiActivity style={{ fontSize: '20px', marginRight: '6px' }} />
            {text[language].NDVINotifications}
          </NavLink>
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
  {/* Language selector beside profile icon */}
  <div className="header-lang-selector">
    <button
      className={`header-lang-btn ${language === "en" ? "active" : ""}`}
      onClick={() => toggleLanguage("en")}
      title="English"
    >
      English
    </button>
    <button
      className={`header-lang-btn ${language === "gu" ? "active" : ""}`}
      onClick={() => toggleLanguage("gu")}
      title="ગુજરાતી"
    >
      ગુજ
    </button>
  </div>
  <div className="user-dropdown" ref={dropdownRef}>
    {/* User icon and username as dropdown trigger */}
    <div
      className="dropdown-trigger"
      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
    >
      <FiUser className="user-icon-img" style={{ fontSize: '28px', color: '#1b4332', background: 'white', borderRadius: '50%', padding: '4px' }} />

    </div>

    {/* Dropdown menu */}

  </div>
</div>
        </div>
        </div>


</div>
      
      </header>

      <main className="content">
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
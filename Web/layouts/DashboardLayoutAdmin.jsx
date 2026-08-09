import React, { useState, useEffect,useRef } from "react";
import { NavLink, Outlet, useLocation,BrowserRouter,useNavigate } from "react-router-dom";
import { FaThLarge, FaGlobe, FaClipboardList, FaBars, FaUpload, FaTimes, FaEye,FaChevronUp, FaChevronDown ,FaChevronRight} from "react-icons/fa"; 
import { MdLocalPolice } from "react-icons/md";
import { GiNotebook } from "react-icons/gi";
import brand from "../assets/Logogiz.png";
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
import patrollingIcon from "../assets/Patrolling.png";  // Import the Patrolling image
import incidentIcon from "../assets/incident.png";  // Import the Incident image
import { FiUser } from "react-icons/fi";
import { useLanguage } from "../context/LanguageContext";
import "./DashboardLayout.css";

import { API_BASE_URL } from '../config';
import axios from "axios";

import gujaratlogo from "../assets/FOREST DEPT.jpg";
import Moef from "../assets/Moef.jpg";
import giz from "../assets/giz.png";
import recap4NDC from "../assets/re.png";

export default function DashboardLayoutAdmin() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Sidebar open/close state
  const [isPatrollingOpen, setIsPatrollingOpen] = useState(false); // State for dropdown
  const [isWorkingPlanOpen, setIsWorkingPlanOpen] = useState(false); // State for dropdown
 const [isAdminMenuOpen, setIsAdminMenuOpen] = useState(false);
  const location = useLocation(); // Access current location (route)
  const { language,toggleLanguage  } = useLanguage();  // ✅ Access language context
  const navigate = useNavigate(); 

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
      coupeDashboard: "Coupe Dashboard",
      plantationBoundary: "Plantation Boundary",
      changePassword: "Change Password",
      changeLanguage: "Change Language",
      english: "English",
      gujarati: "ગુજરાતી",
      logout: "Logout",
      forestPatrollingSystem: "FOREST MONITORING & PATROLLING SYSTEM"
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
      coupeDashboard: "કૂપ ડેશબોર્ડ",
      plantationBoundary: "પ્લાન્ટેશન બાઉન્ડરી",
      changePassword: "પાસવર્ડ બદલો",
      changeLanguage: "ભાષા બદલો",
      english: "English",
      gujarati: "ગુજરાતી",
      logout: "લોગઆઉટ",
      forestPatrollingSystem: "વન મોનિટરિંગ અને પેટ્રોલિંગ સિસ્ટમ"
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
    // Clear all session data
    const itemsToRemove = [
      'session',
      'userData',
      'token',
      'authToken',
      'forest_authenticated',
      'user',
      'admin_token'
    ];

    itemsToRemove.forEach(item => {
      localStorage.removeItem(item);
      sessionStorage.removeItem(item);
    });

    // Clear cookies (if any)
    document.cookie.split(";").forEach(cookie => {
      const eqPos = cookie.indexOf("=");
      const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
      document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
    });

    setIsAdminMenuOpen(false);
    
    // Navigate to login page
    navigate("/");
    
    // Force reload to ensure clean state
    window.location.reload();
  };


  // Open the "Patrolling and Incident Logs" dropdown if we're on a relevant page
  useEffect(() => {
    if (location.pathname === "/petrolling-incident/patrolling" || location.pathname === "/petrolling-incident/incident") {
      setIsPatrollingOpen(true); // Open dropdown if we're on Patrolling or Incident Logs page
    }
  }, [location]);

  const handleLinkClick = () => {
    setIsSidebarOpen(false); // Close sidebar after clicking a link (mobile UX)
  };

  // Helper function to check if a link is active
  const isActiveLink = (path) => location.pathname === path;
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

 
const dropdownRef = useRef(null);
const [isDropdownOpen, setIsDropdownOpen] = useState(false);

const headerRef = useRef(null);
const [contentHeight, setContentHeight] = useState(0);

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
      <div className="after-login-container">

        <header id="header">
                <div className="container-fluid22">
                    <div className="headAssets" style={{display:'flex',justifyContent:'space-between', alignItems:'center', gap:'10px',   padding:'2px',width:'100%',borderRadius:'50px'}}>
                        <div className="logo" style={{display:'flex', alignItems:'center', gap:'10px',paddingLeft:'25px'}}>
                            {/* <a href="indexs.aspx">
                                </a> */}
                                <img src={gujaratlogo} alt="logo picture" style={{width:'50px'}}></img>
                      
                        <div className="portal-header">
                            <div className="icon" aria-hidden="true"></div>
                            <h2 style={{letterSpacing:"2px"}}><b style={{fontFamily: '"arial', fontWeight: 700,}}>{text[language].forestPatrollingSystem}</b></h2>
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
            to="/admin"
            className={`menu-item ${isActiveLink("/geo") ? "active" : ""}`}
            onClick={handleLinkClick}
          >
            {text[language].coupeDashboard}
          </NavLink>
          <NavLink
            to="/UploadPatrolBoundary"
            className={`menu-item ${isActiveLink("/UploadPatrolBoundary") ? "active" : ""}`}
            onClick={handleLinkClick}
          >
            {text[language].plantationBoundary}
          </NavLink>
           </div>
         <div className="header-right">
  <div className="user-dropdown">
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
         
  


          
        

        
        <main className="content">
          <Outlet />
        </main>
     
   {isAdminMenuOpen && (
           <div className="admin-dropdown">
             
             
             
           </div>
         )}
            {isDropdownOpen && (
      <div className="dropdown-menu" onClick={(e) => e.stopPropagation()}>
        <div className="username">
        <b>{username}</b>
        {isAdmin && <span className="admin-badge"> (Admin)</span>}
      </div>
      <a href="/changepassword">{text[language].changePassword}</a>

      <div className="language-section">
      <div className="language-label">{text[language].changeLanguage}</div>
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
    <span className="radio-label">{text[language].english}</span>
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
    <span className="radio-label">{text[language].gujarati}</span>
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
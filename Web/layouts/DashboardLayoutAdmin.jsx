import React, { useState, useEffect,useRef } from "react";
import { NavLink, Outlet, useLocation,BrowserRouter,useNavigate } from "react-router-dom";
import { FaThLarge, FaGlobe, FaClipboardList, FaBars, FaUpload, FaTimes, FaEye,FaChevronUp, FaChevronDown ,FaChevronRight} from "react-icons/fa"; 
import { MdLocalPolice } from "react-icons/md";
import { GiNotebook } from "react-icons/gi";
import brand from "../assets/logogiz.png";
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
import userIcon from "../assets/user.png"; // ✅ import your image
import patrollingIcon from "../assets/Patrolling.png";  // Import the Patrolling image
import incidentIcon from "../assets/Incident.png";  // Import the Incident image
import { useLanguage } from "../context/LanguageContext";
import "./DashboardLayout.css";

import gujaratlogo from "../assets/FOREST DEPT.jpg";
import Moef from "../assets/Moef.jpg";
import giz from "../assets/giz.png";
import recap4NDC from "../assets/RE.png";

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
  const handleLogout = () => {
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
    navigate("/login");
    
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

// Close dropdown when clicking outside
useEffect(() => {
  const handleClickOutside = (event) => {
    if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
      setIsDropdownOpen(false);
    }
  };

  document.addEventListener('mousedown', handleClickOutside);
  return () => {
    document.removeEventListener('mousedown', handleClickOutside);
  };
}, []);
  return (
    <div className="layout">
      {/* Header */}
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
                                {/* <a href="#!" target="_blank">
                                    </a> */}
                                    <img src={recap4NDC} alt="recap4NDC" style={{ height:'60px'}}></img>
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
            Admin Dashboard
          </NavLink>
           </div>
         <div className="header-right">
  <div className="user-dropdown">
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
         
  


          
        

        
        <main className="content">
          <Outlet />
        </main>
     
     {isAdminMenuOpen && (  <div className="admin-dropdown ">
 <button
                className={`lang-chip ${language === "en" ? "active" : ""}`}
                onClick={() => toggleLanguage("en")}
              >
                EN
              </button>
              <button
                className={`lang-chip ${language === "gu" ? "active" : ""}`}
                onClick={() => toggleLanguage("gu")}
              >
                જીયુ
              </button>
      </div>
    )}  {isDropdownOpen && (
          <div className="dropdown-menu">
            
            
          
            <button
              className="logout-btn dropdown-item"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        )}
    </div>
  );
}

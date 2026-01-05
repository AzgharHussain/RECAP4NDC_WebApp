import React, { useState, useEffect } from "react";
import { NavLink, Outlet, useLocation,BrowserRouter  } from "react-router-dom";
import { FaThLarge, FaGlobe, FaClipboardList, FaBars, FaUpload, FaTimes, FaEye,FaChevronUp, FaChevronDown } from "react-icons/fa"; 
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

export default function DashboardLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Sidebar open/close state
  const [isPatrollingOpen, setIsPatrollingOpen] = useState(false); // State for dropdown
  const [isWorkingPlanOpen, setIsWorkingPlanOpen] = useState(false); // State for dropdown
 const [isAdminMenuOpen, setIsAdminMenuOpen] = useState(false); // State for Admin dropdown
  const location = useLocation(); // Access current location (route)
  const { language,toggleLanguage  } = useLanguage();  // ✅ Access language context

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

  return (
    <div className="layout">
      {/* Header */}
    <header className="header">
  {/* ===== TOP ROW ===== */}
  <div className="header-top">
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
      <span className="user-icon">
        <img src={userIcon} alt="User Icon" className="user-icon-img" />
      </span>
      <span
        className="username"
        onClick={() => setIsAdminMenuOpen(!isAdminMenuOpen)}
      >
        Admin ▼
      </span>
    </div>
  </div>

  {/* ===== BOTTOM ROW (BUTTONS) ===== */}
  <div className="header-bottom">
    <NavLink
      to="/geo"
      className={`menu-item ${isActiveLink("/geo") ? "active" : ""}`}
      onClick={handleLinkClick}
    >
      <FaGlobe className="icon" />
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
      
     NDVI Dashboard
    </NavLink>
  </div>
</header>


          
        

        
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
    )}
    </div>
  );
}

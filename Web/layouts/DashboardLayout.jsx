import React, { useState, useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
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

import patrollingIcon from "../assets/Patrolling.png";  // Import the Patrolling image
import incidentIcon from "../assets/Incident.png";  // Import the Incident image
import "./DashboardLayout.css";

export default function DashboardLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Sidebar open/close state
  const [isPatrollingOpen, setIsPatrollingOpen] = useState(false); // State for dropdown
  const [isWorkingPlanOpen, setIsWorkingPlanOpen] = useState(false); // State for dropdown

  const location = useLocation(); // Access current location (route)

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
        <div className="header-left">
          {/* Hamburger for mobile */}
          <button
            className="hamburger-btn"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            {isSidebarOpen ? <FaTimes /> : <FaBars />}
          </button>
          <img src={brand} alt="RECAP4NDC" className="header-logo" />
        </div>

        {/* Logos Section */}
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
          <span className="user-icon">👤</span>
          <span className="username">Admin ▼</span>
        </div>
      </header>


      {/* Body */}
      <div className="layout-body">
        {/* Sidebar */}
        <aside className={`sidebar ${isSidebarOpen ? "open" : ""}`}>
          <ul>
            <li>
              <NavLink
                to="/dashboard"
                className={`menu-item ${isActiveLink("/dashboard") ? "active" : ""}`}
                onClick={handleLinkClick}
              >
                <FaThLarge className="icon" /> Overview
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/geo"
                className={`menu-item ${isActiveLink("/geo") ? "active" : ""}`}
                onClick={handleLinkClick}
              >
                <FaGlobe className="icon" /> Geo Dashboard
              </NavLink>
            </li>

            {/* Patrolling and Incident Logs Dropdown */}
           <li className={`dropdown ${isPatrollingOpen ? "open" : ""}`}>
              <button
                className={`dropdown-toggle ${
                  isActiveLink("/petrolling-incident/patrolling") ||
                  isActiveLink("/petrolling-incident/incident")
                    ? "active"
                    : ""
                }`}
                onClick={() => setIsPatrollingOpen(!isPatrollingOpen)} // Toggle only Patrolling dropdown
              >
                <MdLocalPolice className="icon" /> Patrolling and Incident Logs
                {/* ▼▲ icon toggle */}
                {isPatrollingOpen ? <FaChevronUp /> : <FaChevronDown />}
              </button>

              {isPatrollingOpen && (
                <ul className="dropdown-menus">
                  <li>
                    <NavLink
                      to="/petrolling-incident/patrolling"
                      className={`menu-item ${
                        isActiveLink("/petrolling-incident/patrolling") ? "active" : ""
                      }`}
                      onClick={handleLinkClick}
                    >
                      <img
                        src={patrollingIcon}
                        alt="Patrolling Logs"
                        className="menu-image"
                      />{" "}
                      {/* Patrolling image */}
                      Patrolling Logs
                    </NavLink>
                  </li>
                  <li>
                    <NavLink
                      to="/petrolling-incident/incident"
                      className={`menu-item ${
                        isActiveLink("/petrolling-incident/incident") ? "active" : ""
                      }`}
                      onClick={handleLinkClick}
                    >
                      <img
                        src={incidentIcon}
                        alt="Incident Logs"
                        className="menu-image"
                      />{" "}
                      {/* Incident image */}
                      Incident Logs
                    </NavLink>
                  </li>
                </ul>
              )}
            </li>


            {/* Working Plan Areas Dropdown */}
           <li className={`dropdown ${isWorkingPlanOpen ? "open" : ""}`}>
            <button
              className={`dropdown-toggle ${isWorkingPlanOpen ? "active" : ""}`}
              onClick={() => setIsWorkingPlanOpen(!isWorkingPlanOpen)} // Toggle only Working Plan dropdown
            >
              <FaClipboardList className="icon" /> Working Plan Areas
              {/* ▼▲ icon toggle */}
              {isWorkingPlanOpen ? <FaChevronUp /> : <FaChevronDown />}
            </button>

                {isWorkingPlanOpen && (
                  <ul className="dropdown-menus">
                    <li>
                      <NavLink
                        to="/working-plan/upload"
                        className={`menu-item ${
                          isActiveLink("/working-plan/upload") ? "active" : ""
                        }`}
                        onClick={handleLinkClick}
                      >
                        <FaUpload className="icon" /> Upload Coupe Boundaries
                      </NavLink>
                    </li>
                    <li>
                      <NavLink
                        to="/working-plan/view"
                        className={`menu-item ${
                          isActiveLink("/working-plan/view") ? "active" : ""
                        }`}
                        onClick={handleLinkClick}
                      >
                        <FaEye className="icon" /> View Coupe Boundaries
                      </NavLink>
                    </li>
                    <li>
                      <NavLink
                        to="/working-plan/log"
                        className={`menu-item ${
                          isActiveLink("/working-plan/log") ? "active" : ""
                        }`}
                        onClick={handleLinkClick}
                      >
                        <GiNotebook className="icon" /> Coupe Observation Log
                      </NavLink>
                    </li>
                  </ul>
                )}
              </li>

          </ul>
        </aside>

        {/* Page content */}
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

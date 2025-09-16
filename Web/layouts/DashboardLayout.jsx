import React, { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { FaThLarge, FaGlobe, FaClipboardList, FaBars,FaUpload, FaTimes,FaEye } from "react-icons/fa"; 
import { MdLocalPolice } from "react-icons/md";
import { GiNotebook } from "react-icons/gi";
import brand from "../assets/logogiz.png";
import "./DashboardLayout.css";

export default function DashboardLayout() {
  const [openDropdown, setOpenDropdown] = useState(false);
  const [activeLink, setActiveLink] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // NEW STATE

  const handleLinkClick = (link) => {
    setActiveLink(link);
    setIsSidebarOpen(false); // close sidebar after click (mobile UX)
  };

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
                className={`menu-item ${activeLink === "/dashboard" ? "active" : ""}`}
                onClick={() => handleLinkClick("/dashboard")}
              >
                <FaThLarge className="icon" /> Overview
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/geo"
                className={`menu-item ${activeLink === "/geo" ? "active" : ""}`}
                onClick={() => handleLinkClick("/geo")}
              >
                <FaGlobe className="icon" /> Geo Dashboard
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/patrolling"
                className={`menu-item ${activeLink === "/patrolling" ? "active" : ""}`}
                onClick={() => handleLinkClick("/patrolling")}
              >
                <MdLocalPolice className="icon" /> Patrolling and Incident Logs
              </NavLink>
            </li>

            {/* Dropdown */}
            <li className={`dropdown ${openDropdown ? "open" : ""}`}>
              <button
                className={`dropdown-toggle ${openDropdown ? "active" : ""}`}
                onClick={() => setOpenDropdown(!openDropdown)}
              >
                <FaClipboardList className="icon" /> Working Plan Areas
              </button>
              {openDropdown && (
                <ul className="dropdown-menus">
                  <li>
                    <NavLink
                      to="/working-plan/upload"
                      className={`menu-item ${activeLink === "/working-plan/upload" ? "active" : ""}`}
                      onClick={() => handleLinkClick("/working-plan/upload")}
                    >
                     <FaUpload className="icon" /> Upload Coupe Boundaries
                    </NavLink>
                  </li>
                  <li>
                    <NavLink
                      to="/working-plan/view"
                      className={`menu-item ${activeLink === "/working-plan/view" ? "active" : ""}`}
                      onClick={() => handleLinkClick("/working-plan/view")}
                    >
                     <FaEye className="icon" /> View Coupe Boundaries
                    </NavLink>
                  </li>
                  <li>
                    <NavLink
                      to="/working-plan/log"
                      className={`menu-item ${activeLink === "/working-plan/log" ? "active" : ""}`}
                      onClick={() => handleLinkClick("/working-plan/log")}
                    >
                      <GiNotebook className="icon" />Coupe Observation Log
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

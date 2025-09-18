import React, { useState } from "react";
import { FaChevronDown, FaChevronUp } from "react-icons/fa";
import "./LayerTogglePanel.css";

const LeftSidebar = () => {
  const [openSections, setOpenSections] = useState({
    forest: true,
    boundaries: true,
    field: true,
  });

  const toggleSection = (section) => {
    setOpenSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  return (
    <aside className="leftpanel">
      <h3 className="sidebar-title">
  <img src="../assets/Explor.png" alt="Icon" style={{ width: '20px', marginRight: '8px' }} />
  Explore Data
</h3>

      {/* Forest Cover Change */}
      <div className="sidebar-section">
        <div className="section-header" onClick={() => toggleSection("forest")}>
            <img src="../assets/forest.png" alt="Forest Icon" style={{ width: '20px', marginRight: '8px' }} />
          <span>Forest Cover Change</span>
          {openSections.forest ? <FaChevronUp /> : <FaChevronDown />}
        </div>
        {openSections.forest && (
          <div className="section-content">
       <div className="date-input-container">
  <input type="date" className="input-field" placeholder="Select From Date" />
  <input type="date" className="input-field" placeholder="Select To Date" />
  <div className="filter-icon">
    <img src="../assets/filter.png" alt="Filter" />
  </div>
</div>

       <div className="section-content">
  <label className="green-label">Select Layer:</label>
  <div className="checkbox-group">
    <label><input type="checkbox" className="checkbox" /> NDVI</label>
    <label><input type="checkbox" className="checkbox" /> NDWI</label>
  </div>
</div>

       
        </div>

        )}
      </div>

      {/* Boundaries */}
      <div className="sidebar-section">
  <div className="section-header" onClick={() => toggleSection("boundaries")}>
    <img src="../assets/Boundry.png" alt="Forest Icon" style={{ width: '20px', marginRight: '-89px' }} />
    <span>Boundaries</span>
    {openSections.boundaries ? <FaChevronUp /> : <FaChevronDown />}
  </div>
  <label className="green-label">Select Boundaries:</label>
  {openSections.boundaries && (
    <div className="section-content">
      <label className="green-label"><input type="checkbox" /> Division</label>
      <label className="green-label"><input type="checkbox" /> Range</label>
      <label className="green-label"><input type="checkbox" /> Block</label>
      <label className="green-label"><input type="checkbox" /> Compartment</label>
      <label className="green-label"><input type="checkbox" /> Coupe</label>
    </div>
  )}
</div>


      {/* Field Data */}
      <div className="sidebar-section">
        <div className="section-header" onClick={() => toggleSection("field")}>
            <img src="../assets/field.png" alt="Forest Icon" style={{ width: '20px', marginRight: '-89px' }} />
          <span> Field Data</span>
          {openSections.field ? <FaChevronUp /> : <FaChevronDown />}
        </div>
        <label className="green-label">Select Patrolling / Incident:</label>
        {openSections.field && (
          <div className="section-content">
            <label className="green-label"><input type="checkbox" /> Patrolling Routes</label>
            <label className="green-label"><input type="checkbox" /> Incident Markers</label>
          </div>
        )}
      </div>
    </aside>
  );
};

export default LeftSidebar;

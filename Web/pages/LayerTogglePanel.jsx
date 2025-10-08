import React, { useState } from "react";
import { FaChevronDown, FaChevronUp } from "react-icons/fa";
import "./LayerTogglePanel.css";
import { DatePicker } from "antd";
const { RangePicker } = DatePicker;
const LeftSidebar = ({ showDistrictLayer, setShowDistrictLayer,showCoupeLayer,setShowCoupeLayer,showNdviLayer,setShowNdviLayer,showNdwiLayer,setShowNdwiLayer,setShowPatrollingLayer,showPatrollingLayer,showIncidentLayer,setShowIncidentLayer,showChangeLayer,setShowChangeLayer,onFilter}) => {
  const [openSections, setOpenSections] = useState({
    forest: true,
    boundaries: true,
    field: true,
  });
 const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const toggleSection = (section) => {
    setOpenSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };
 const handleFilterClick = () => {
    if (!fromDate && !toDate) return;
    onFilter({ fromDate, toDate });
  };
  return (
    <aside className="leftpanel">
      <h3 className="sidebar-title">
  <img src="../assets/Explor1.png" alt="Icon" style={{ width: '20px', marginRight: '8px' }} />
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
  <input type="date" className="input-field" placeholder="Select From Date" value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}/>
  <input type="date" className="input-field" placeholder="Select To Date" value={toDate}
                onChange={(e) => setToDate(e.target.value)}/>
  <div className="filter-icon" onClick={handleFilterClick}>
    <img src="../assets/filter.png" alt="Filter" />
  </div>
</div>

       <div className="section-content">
  <label className="green-label">Select Layer:</label>
  <div className="checkbox-group">
    <label><input type="checkbox" className="checkbox" checked={showNdviLayer}
    onChange={() => setShowNdviLayer(prev => !prev)}/> NDVI</label>
    <label><input type="checkbox" className="checkbox"  checked={showNdwiLayer}
    onChange={() => setShowNdwiLayer(prev => !prev)}/> NDWI</label>
     <label><input type="checkbox" className="checkbox"  checked={showChangeLayer}
    onChange={() => setShowChangeLayer(prev => !prev)}/>NDVI Change</label>
  </div>
</div>

       
        </div>

        )}
      </div>

      {/* Boundaries */}
      <div className="sidebar-section">
  <div className="section-header" onClick={() => toggleSection("boundaries")}>
    <img src="../assets/Boundry.png" alt="Forest Icon" style={{ width: '20px', marginRight: '-69px' }} />
    <span>Boundaries</span>
    {openSections.boundaries ? <FaChevronUp /> : <FaChevronDown />}
        </div>
        <label className="green-label">Select Boundaries:</label>
        {openSections.boundaries && (
          <div className="section-content">
      
        <label className="green-label">
          <input type="checkbox" checked={showDistrictLayer}        // <-- bind to district state
    onChange={() => setShowDistrictLayer(prev => !prev)}/> District
        </label>
        <label className="green-label">
          <input type="checkbox" /> Division
        </label>
        <label className="green-label">
          <input type="checkbox" /> Range
        </label>
        <label className="green-label">
          <input type="checkbox" /> Block
        </label>
        <label className="green-label">
          <input type="checkbox" /> Compartment
        </label>
        <label className="green-label">
          <input type="checkbox" checked={showCoupeLayer}
    onChange={() => setShowCoupeLayer(prev => !prev)}/> Coupe
        </label>
      </div>

  )}
</div>


      {/* Field Data */}
      <div className="sidebar-section">
        <div className="section-header" onClick={() => toggleSection("field")}>
            <img src="../assets/field.png" alt="Forest Icon" style={{ width: '20px', marginRight: '-86px' }} />
          <span> Field Data</span>
          {openSections.field ? <FaChevronUp /> : <FaChevronDown />}
        </div>
        <label className="green-label">Select Patrolling / Incident:</label>
        {openSections.field && (
          <div className="section-content">
            <label className="green-label"><input type="checkbox" checked={showPatrollingLayer}
    onChange={() => setShowPatrollingLayer(prev => !prev)}/> Patrolling Routes</label>
            <label className="green-label"><input type="checkbox" checked={showIncidentLayer}
    onChange={(e) => setShowIncidentLayer(e.target.checked)}/> Incident Markers</label>
          </div>
        )}
      </div>
    </aside>
  );
};

export default LeftSidebar;

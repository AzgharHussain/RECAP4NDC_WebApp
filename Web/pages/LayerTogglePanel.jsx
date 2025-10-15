import React, { useState } from "react";
import { FaChevronDown, FaChevronUp } from "react-icons/fa";
import "./LayerTogglePanel.css";
import { DatePicker } from "antd";
import { useLanguage } from "../context/LanguageContext"; // Import language context
const { RangePicker } = DatePicker;
const LeftSidebar = ({ showDistrictLayer, setShowDistrictLayer,showCoupeLayer,setShowCoupeLayer,showNdviLayer,setShowNdviLayer,showNdwiLayer,setShowNdwiLayer,setShowPatrollingLayer,showPatrollingLayer,showIncidentLayer,setShowIncidentLayer,showChangeLayer,setShowChangeLayer,onFilter}) => {
  const { language } = useLanguage(); // Access language context
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

   // Language-specific text
  const text = {
  en: {
    exploreData: "Explore Data",
    forestCoverChange: "Forest Cover Change",
    selectLayer: "Select Layer:",
    selectBoundaries: "Select Boundaries:",
    selectPatrollingIncident: "Select Patrolling / Incident:",
    district: "District",
    coupe: "Coupe",
    patrollingRoutes: "Patrolling Routes",
    incidentMarkers: "Incident Markers",
    filter: "Filter",
    ndwi: "NDWI",
    ndvi: "NDVI", 
    ndviChange: "NDVI Change", // Added NDVI Change in English
    division: "Division",
    range: "Range",
    block: "Block",
    compartment: "Compartment",
    fieldData: "Field Data",
    selectPatrollingIncident: "Select Patrolling / Incident",
    patrollingRoute: "Patrolling Route",
    incidentMarkers: "Incident Markers",
    fieldData: "Field Data",  // Added Field Data in English
     boundaries: "Boundaries",  // Added Boundaries in English
  },
  gu: {
    exploreData: "ડેટા તપાસો",
    forestCoverChange: "વન આવરણમાં ફેરફાર",
    selectLayer: "લેયર પસંદ કરો:",
    selectBoundaries: "સીમા પસંદ કરો:",
    selectPatrollingIncident: "પેટ્રોલિંગ / ઘટના પસંદ કરો:",
    district: "જિલ્લો",
    coupe: "કૂપ",
    patrollingRoutes: "પેટ્રોલિંગ માર્ગો",
    incidentMarkers: "ઘટના ચિહ્નો",
    filter: "ફિલ્ટર",
     ndwi: "પાણી સૂચક",
    ndvi: "હરિયાળી સૂચક", 
    ndviChange: "હરિયાળી સૂચક ફેરફાર", // Added NDVI Change translation in Gujarati
    division: "વિભાગ",  // Added all translation details
    range: "વિસ્તાર",
    block: "ખંડ",
    compartment: "વિભાગ નંબર",
    fieldData: "મેદાનની માહિતી",
    selectPatrollingIncident: "પેટ્રોલિંગ / ઘટના પસંદ કરો",
    patrollingRoute: "પેટ્રોલિંગ માર્ગ",
    incidentMarkers: "ઘટના નિશાન",
    fieldData: "મેદાનની માહિતી",  // Updated Field Data translation in Gujarati
     boundaries: "સીમાઓ", // Added Boundaries translation in Gujarati
  },
};



  return (
    <aside className="leftpanel">
      <h3 className="sidebar-title">
  <img src="../assets/Explor1.png" alt="Icon" style={{ width: '20px', marginRight: '8px' }} />
  {text[language].exploreData}
</h3>

      {/* Forest Cover Change */}
      <div className="sidebar-section">
        <div className="section-header" onClick={() => toggleSection("forest")}>
            <img src="../assets/forest.png" alt="Forest Icon" style={{ width: '20px', marginRight: '8px' }} />
          <span>{text[language].forestCoverChange}</span>
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
  <label className="green-label">{text[language].selectLayer}</label>
  <div className="checkbox-group">
    <label><input type="checkbox" className="checkbox" checked={showNdviLayer}
    onChange={() => setShowNdviLayer(prev => !prev)}/> {text[language].ndvi}</label>
    <label><input type="checkbox" className="checkbox"  checked={showNdwiLayer}
    onChange={() => setShowNdwiLayer(prev => !prev)}/> {text[language].ndwi}</label>
     <label><input type="checkbox" className="checkbox"  checked={showChangeLayer}
    onChange={() => setShowChangeLayer(prev => !prev)}/>{text[language].ndviChange}</label>
  </div>
</div>
        </div>
        )}
      </div>

      {/* Boundaries */}
      <div className="sidebar-section">
  <div className="section-header" onClick={() => toggleSection("boundaries")}>
    <img src="../assets/Boundry.png" alt="Forest Icon" style={{ width: '20px', marginRight: '-69px' }} />
    <span>{text[language].boundaries}</span>
    {openSections.boundaries ? <FaChevronUp /> : <FaChevronDown />}
        </div>
        <label className="green-label">{text[language].selectBoundaries}</label>
        {openSections.boundaries && (
          <div className="section-content">
      
        <label className="green-label">
          <input type="checkbox" checked={showDistrictLayer}        // <-- bind to district state
    onChange={() => setShowDistrictLayer(prev => !prev)}/> {text[language].district}
        </label>
        <label className="green-label">
          <input type="checkbox" /> {text[language].division}
        </label>
        <label className="green-label">
          <input type="checkbox" /> {text[language].range}
        </label>
        <label className="green-label">
          <input type="checkbox" /> {text[language].block}
        </label>
        <label className="green-label">
          <input type="checkbox" /> {text[language].compartment}
        </label>
        <label className="green-label">
          <input type="checkbox" checked={showCoupeLayer}
    onChange={() => setShowCoupeLayer(prev => !prev)}/> {text[language].coupe}
        </label>
      </div>

  )}
</div>
      {/* Field Data */}
      <div className="sidebar-section">
        <div className="section-header" onClick={() => toggleSection("field")}>
            <img src="../assets/field.png" alt="Forest Icon" style={{ width: '20px', marginRight: '-86px' }} />
          <span> {text[language].fieldData}</span>
          {openSections.field ? <FaChevronUp /> : <FaChevronDown />}
        </div>
        <label className="green-label">{text[language].selectPatrollingIncident}</label>
        {openSections.field && (
          <div className="section-content">
            <label className="green-label"><input type="checkbox" checked={showPatrollingLayer}
    onChange={() => setShowPatrollingLayer(prev => !prev)}/> {text[language].patrollingRoute}</label>
            <label className="green-label"><input type="checkbox" checked={showIncidentLayer}
    onChange={(e) => setShowIncidentLayer(e.target.checked)}/> {text[language].incidentMarkers}</label>
          </div>
        )}
      </div>
    </aside>
  );
};

export default LeftSidebar;

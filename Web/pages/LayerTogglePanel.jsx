import React, { useState, useEffect } from "react";
import { FaChevronDown, FaChevronUp } from "react-icons/fa";
import "./LayerTogglePanel.css";
import { DatePicker } from "antd";
import { useLanguage } from "../context/LanguageContext";
import ForestHierarchyDropdowns from "./dropdown";
import L from 'leaflet';

const { RangePicker } = DatePicker;

const LeftSidebar = ({ 
  mapRef, 
  showDistrictLayer, 
  setShowDistrictLayer, 
  setShowPatrollingLayer, 
  showPatrollingLayer, 
  showIncidentLayer, 
  setShowIncidentLayer, 
  onFilter 
}) => {
  const { language } = useLanguage();

  const [selectedYear, setSelectedYear] = useState('2025');
  const [showNdviLayer, setShowNdviLayer] = useState(false);
  const [showNdwiLayer, setShowNdwiLayer] = useState(false);
  const [showChangeLayer, setShowChangeLayer] = useState(false);
  const [showCoupeLayer, setShowCoupeLayer] = useState(false);
  
  const [openSections, setOpenSections] = useState({
    forest: true,
    boundaries: true,
    field: true,
  });
  
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedCoupe, setSelectedCoupe] = useState(null);

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
      ndviChange: "NDVI Change",
      division: "Division",
      range: "Range",
      block: "Block",
      compartment: "Compartment",
      fieldData: "Field Data",
      patrollingRoute: "Patrolling Route",
      boundaries: "Boundaries",
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
      ndviChange: "હરિયાળી સૂચક ફેરફાર",
      division: "વિભાગ",
      range: "વિસ્તાર",
      block: "ખંડ",
      compartment: "વિભાગ નંબર",
      fieldData: "મેદાનની માહિતી",
      patrollingRoute: "પેટ્રોલિંગ માર્ગ",
      boundaries: "સીમાઓ",
    },
  };

const handleSelectionChange = (selectedValues) => {
  console.log("Selected values:", selectedValues);
  
  // Store the selected coupe for layer management
  if (selectedValues.coupe) {
    setSelectedCoupe(selectedValues.coupe);
  }
  
  // Update layers based on current selections with error handling
  try {
    updateLayers(selectedValues.coupe, selectedYear);
  } catch (error) {
    console.error('Error updating layers:', error);
  }
};

  // Effect to update layers when layer toggles or year changes
useEffect(() => {
  if (selectedCoupe) {
    updateLayers(selectedCoupe, selectedYear);
  }
}, [showCoupeLayer, showNdviLayer, showNdwiLayer, showChangeLayer, selectedYear, selectedCoupe]);


const zoomToLayerBounds = (layerName, map) => {
  const geoserverUrl = 'https://www.gisfy.co.in:8443/geoserver/wms';
  fetch(`${geoserverUrl}?service=WMS&version=1.1.1&request=GetCapabilities`)
    .then(response => response.text())
    .then(str => (new window.DOMParser()).parseFromString(str, "text/xml"))
    .then(xml => {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(str, "text/xml");
      const layers = xmlDoc.getElementsByTagName("Layer");
      for (let i = 0; i < layers.length; i++) {
        const name = layers[i].getElementsByTagName("Name")[0]?.textContent;
        if (name === layerName) {
          const bbox = layers[i].getElementsByTagName("EX_GeographicBoundingBox")[0];
          if (bbox) {
            const west = parseFloat(bbox.getElementsByTagName("westBoundLongitude")[0].textContent);
            const east = parseFloat(bbox.getElementsByTagName("eastBoundLongitude")[0].textContent);
            const south = parseFloat(bbox.getElementsByTagName("southBoundLatitude")[0].textContent);
            const north = parseFloat(bbox.getElementsByTagName("northBoundLatitude")[0].textContent);
            const bounds = [[south, west], [north, east]];
            map.fitBounds(bounds);
          }
          break;
        }
      }
    })
    .catch(err => console.error("Error fetching bounds:", err));
};


const updateLayers = (coupe, year) => {
  if (!mapRef.current || !coupe) return;
  const map = mapRef.current;

  // Clear previous dynamic layers
  map.eachLayer(layer => {
    if (layer.options && layer.options.isDynamic) {
      map.removeLayer(layer);
    }
  });

  // Add layers based on current selections
  if (showCoupeLayer) {
    addCoupeLayer(coupe, map);
  }
  if (showNdviLayer) {
    addNdviLayer(coupe, year, map);
  }
  if (showNdwiLayer) {
    addNdwiLayer(coupe, year, map);
  }
  if (showChangeLayer && year === '2025') {
    addChangeLayer(coupe, map);
  }
};



const addCoupeLayer = (coupe, map) => {
  const coupeLayer = L.tileLayer.wms('https://www.gisfy.co.in:8443/geoserver/wms', {
    layers: coupe,
    format: 'image/png',
    transparent: true,
    version: '1.1.1',
    isDynamic: true,
    zIndex:1000
  });
  zoomToLayerBounds(coupe, map)
  coupeLayer.addTo(map);
};

const addNdviLayer = (coupe, year, map) => {
  const ndviLayer = L.tileLayer.wms('https://www.gisfy.co.in:8443/geoserver/wms', {
    layers: `2025-02-01_Con_Cum_Imp_WC_OVLP_NDVI`,
    format: 'image/png',
    transparent: true,
    version: '1.1.1',
    isDynamic: true
  });
  zoomToLayerBounds(coupe, map)
  ndviLayer.addTo(map);
};

const addNdwiLayer = (coupe, year, map) => {
  const ndwiLayer = L.tileLayer.wms('https://www.gisfy.co.in:8443/geoserver/wms', {
    layers: `your_workspace:${coupe}_ndwi_${year}`,
    format: 'image/png',
    transparent: true,
    version: '1.1.1',
    isDynamic: true
  });
  zoomToLayerBounds(coupe, map)
  ndwiLayer.addTo(map);
};

const addChangeLayer = (coupe, map) => {
  const changeLayer = L.tileLayer.wms('https://www.gisfy.co.in:8443/geoserver/wms', {
    layers: `2025-02-01_Con_Cum_Imp_WC_OVLP_NDVI_Change`,
    format: 'image/png',
    transparent: true,
    version: '1.1.1',
    isDynamic: true
  });
  zoomToLayerBounds(coupe, map)
  changeLayer.addTo(map);
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
            {/* <div className="date-input-container">
              <input
                type="date"
                className="input-field"
                value={fromDate}
                onChange={(e) => {
                  const newFrom = e.target.value;
                  setFromDate(newFrom);
                  onFilter({ fromDate: newFrom, toDate });
                }}
                placeholder="From Date"
              />

              <input
                type="date"
                className="input-field"
                value={toDate}
                onChange={(e) => {
                  const newTo = e.target.value;
                  setToDate(newTo);
                  onFilter({ fromDate, toDate: newTo });
                }}
                placeholder="To Date"
              />
            </div> */}

            
            <div>
              <ForestHierarchyDropdowns 
              language={language}
              onSelectionChange={handleSelectionChange}
            />
              </div>
            
            <div className="section-content">
              <label className="green-label">{text[language].selectLayer}</label>
              <div className="checkbox-group">
                <label className="checkbox-label">
                  <input 
                    type="checkbox" 
                    className="checkbox" 
                    checked={showCoupeLayer}
                    onChange={() => setShowCoupeLayer(prev => !prev)}
                  /> 
                  {text[language].coupe}
                </label>
                <label className="checkbox-label">
                  <input 
                    type="checkbox" 
                    className="checkbox" 
                    checked={showNdviLayer}
                    onChange={() => setShowNdviLayer(prev => !prev)}
                  /> 
                  {text[language].ndvi}
                </label>
                {/* <label className="checkbox-label">
                  <input 
                    type="checkbox" 
                    className="checkbox" 
                    checked={showNdwiLayer}
                    onChange={() => setShowNdwiLayer(prev => !prev)}
                  /> 
                  {text[language].ndwi}
                </label> */}
                 {/* <div className="year-selection" style={{marginTop: '10px'}}>
                <label className="green-label">Select Year</label>
                <select 
                  value={selectedYear} 
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="year-select"
                >
                  <option value="2023">2023</option>
                  <option value="2024">2024</option>
                  <option value="2025">2025</option>
                </select>
              </div> */}
                <label className="checkbox-label">
                  <input 
                    type="checkbox" 
                    className="checkbox" 
                    checked={showChangeLayer}
                    onChange={() => setShowChangeLayer(prev => !prev)}
                  />
                  {text[language].ndviChange}
                </label>
              </div>
              
              {/* Year selection */}
             
            </div>
          </div>
        )}
      </div>

      {/* Boundaries */}
      <div className="sidebar-section">
        <div className="section-header" onClick={() => toggleSection("boundaries")}>
          <img src="../assets/Boundry.png" alt="Boundaries Icon" style={{ width: '20px', marginRight: '8px' }} />
          <span>{text[language].boundaries}</span>
          {openSections.boundaries ? <FaChevronUp /> : <FaChevronDown />}
        </div>
        
        {openSections.boundaries && (
          <div className="section-content">
            <label className="green-label">{text[language].selectBoundaries}</label>
            <div className="checkbox-group">
              <label className="checkbox-label">
                <input 
                  type="checkbox" 
                  checked={showDistrictLayer}
                  onChange={() => setShowDistrictLayer(prev => !prev)}
                /> 
                {text[language].district}
              </label>
              <label className="checkbox-label">
                <input type="checkbox" /> 
                {text[language].division}
              </label>
              <label className="checkbox-label">
                <input type="checkbox" /> 
                {text[language].range}
              </label>
              <label className="checkbox-label">
                <input type="checkbox" /> 
                {text[language].block}
              </label>
              <label className="checkbox-label">
                <input type="checkbox" /> 
                {text[language].compartment}
              </label>
              {/* <label className="checkbox-label">
                <input 
                  type="checkbox" 
                  checked={showCoupeLayer}
                  onChange={() => setShowCoupeLayer(prev => !prev)}
                /> 
                {text[language].coupe}
              </label> */}
            </div>
          </div>
        )}
      </div>

      {/* Field Data */}
      <div className="sidebar-section">
        <div className="section-header" onClick={() => toggleSection("field")}>
          <img src="../assets/field.png" alt="Field Data Icon" style={{ width: '20px', marginRight: '8px' }} />
          <span>{text[language].fieldData}</span>
          {openSections.field ? <FaChevronUp /> : <FaChevronDown />}
        </div>
        
        {openSections.field && (
          <div className="section-content">
            <label className="green-label">{text[language].selectPatrollingIncident}</label>
            <div className="checkbox-group">
              <label className="checkbox-label">
                <input 
                  type="checkbox" 
                  checked={showPatrollingLayer}
                  onChange={() => setShowPatrollingLayer(prev => !prev)}
                /> 
                {text[language].patrollingRoute}
              </label>
              <label className="checkbox-label">
                <input 
                  type="checkbox" 
                  checked={showIncidentLayer}
                  onChange={(e) => setShowIncidentLayer(e.target.checked)}
                /> 
                {text[language].incidentMarkers}
              </label>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

export default LeftSidebar;
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import {
  MdForest, MdLocationOn, MdBusiness, MdTerrain, MdClose,
  MdExpandMore, MdExpandLess, MdLayers, MdEco, MdShield,
  MdTrendingUp, MdTrendingDown, MdExplore, MdMap, MdInfo,
  MdSearch, MdFullscreenExit, MdDelete
} from "react-icons/md";
import "./LayerTogglePanel.css";
import { useLanguage } from "../context/LanguageContext";
import L from "leaflet";
import { debounce, min } from 'lodash';
import { API_BASE_URL } from "../config";
import "leaflet.nontiledlayer";
const Loader = () => {
  return (
    <div className="map-loader">
      <div className="map-loader__radar">
        <div className="map-loader__center">
          <div className="map-loader__satellite"></div>
          <div className="map-loader__pulse"></div>
          <div className="map-loader__pulse delay-1"></div>
          <div className="map-loader__pulse delay-2"></div>
        </div>
        <div className="map-loader__sweep"></div>
      </div>
      <div className="map-loader__message">Loading...</div>
    </div>
  );
};

// Month Range Selector Component for individual coupe groups
// Month Range Selector Component for individual coupe groups
const MonthRangeSelector = ({ onMonthSelect, selectedMonth, selectedYear, language, groupTitle, availableMonths = [] }) => {
  const monthNames = {
    en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    gu: ['જાન', 'ફેબ', 'માર્ચ', 'એપ્રિલ', 'મે', 'જૂન', 'જુલાઈ', 'ઑગસ્ટ', 'સપ્ટે', 'ઑક્ટો', 'નવે', 'ડિસે']
  };
  
  const months = monthNames[language] || monthNames.en;

  // Group available months by year
  const monthsByYear = useMemo(() => {
    const grouped = {};
    availableMonths.forEach(item => {
      if (!grouped[item.year]) {
        grouped[item.year] = [];
      }
      grouped[item.year].push(item.month);
    });
    return grouped;
  }, [availableMonths]);

  // Get unique years sorted
  const availableYears = useMemo(() => {
    return [...new Set(availableMonths.map(item => item.year))].sort();
  }, [availableMonths]);

  // Check if a specific month in a specific year is available
  const isMonthAvailable = (year, monthIndex) => {
    return monthsByYear[year]?.includes(monthIndex) || false;
  };

  // Handle year change
  const handleYearChange = (e) => {
    const newYear = parseInt(e.target.value);
    // Find first available month in the new year
    const firstAvailableMonth = monthsByYear[newYear]?.[0] || 0;
    onMonthSelect(firstAvailableMonth, newYear);
  };

  // Handle month change
  const handleMonthChange = (monthIndex) => {
    onMonthSelect(monthIndex, selectedYear);
  };

  return (
    <div className="month-range-selector">
      {/* Year selector */}
      <div className="year-selector" style={{ marginBottom: '15px' }}>
        <label style={{ 
          display: 'block', 
          marginBottom: '5px',
          fontSize: '13px',
          fontWeight: 'bold',
          color: '#555'
        }}>
          {language === 'en' ? 'Select Year:' : 'વર્ષ પસંદ કરો:'}
        </label>
        <select 
          value={selectedYear} 
          onChange={handleYearChange}
          style={{
            width: '100%',
            padding: '8px',
            borderRadius: '4px',
            border: '1px solid #ddd',
            backgroundColor: '#fff',
            cursor: 'pointer'
          }}
        >
          {availableYears.map(year => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </div>

      <div className="month-slider-container">
        <input
          type="range"
          min="0"
          max="11"
          step="1"
          value={selectedMonth}
          onChange={(e) => handleMonthChange(parseInt(e.target.value))}
          className="month-slider"
        />
        <div className="month-labels">
          {months.map((month, index) => {
            const available = isMonthAvailable(selectedYear, index);
            return (
              <span 
                key={index} 
                className={`month-label ${index === selectedMonth ? 'active' : ''} ${!available ? 'unavailable' : ''}`}
                onClick={() => available && handleMonthChange(index)}
                style={{
                  cursor: available ? 'pointer' : 'not-allowed',
                  opacity: available ? 1 : 0.3,
                  position: 'relative'
                }}
                title={!available ? `No data available for ${month} ${selectedYear}` : ''}
              >
                {month}
                {available && (
                  <span style={{
                    position: 'absolute',
                    bottom: '-12px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    fontSize: '8px',
                    color: '#4CAF50'
                  }}>●</span>
                )}
              </span>
            );
          })}
        </div>
      </div>
      
      <div className="selected-month-display" style={{ marginTop: '15px' }}>
        <span className="selected-month-text">
          {language === 'en' ? 'Selected: ' : 'પસંદ કરેલ: '}
          <strong>
            {months[selectedMonth]} {selectedYear}
          </strong>
          {!isMonthAvailable(selectedYear, selectedMonth) && (
            <span style={{ color: 'red', marginLeft: '10px', fontSize: '12px' }}>
              (No data)
            </span>
          )}
        </span>
      </div>
    </div>
  );
};

// Nested Layer Group Component - UPDATED to remove coupe layer items
const getGroupIcon = (title) => {
  const t = (title || "").toLowerCase();
  const iconStyle = { marginRight: "8px", color: '#2e7d32', fontSize: '18px' };
  if (t.includes('forest')) return <MdForest style={iconStyle} />;
  if (t.includes('circle') || t.includes('division')) return <MdShield style={iconStyle} />;
  if (t.includes('range')) return <MdTerrain style={iconStyle} />;
  if (t.includes('gujarat')) return <MdMap style={iconStyle} />;
  return <MdLayers style={iconStyle} />;
};

const NestedLayerGroup = React.memo(({
  group,
  groupId,
  addedLayers,
  toggleLayer,
  opacity,
  handleOpacityChange,
  openGroups,
  toggleGroup,
  isLayerLoading,
  nestingLevel = 0,
  language
}) => {
  const isExpanded = openGroups[groupId] || false;

  return (
    <div className="nested-layer-group">
      {/* Group Header */}
      <button
        type="button"
        className="group-title nested-group-title"
        onClick={() => toggleGroup(groupId)}
        aria-expanded={isExpanded}
      >
        <span className="group-title-content" style={{ display: 'flex', alignItems: 'center' }}>
          {getGroupIcon(group.title)}
          <span style={{ fontWeight: 600, color: '#111' }}>{group.title}</span>
          {group.children && (
            <span className="badge" style={{ marginLeft: '8px', background: '#e8f5e9', color: '#2e7d32', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}>
              {group.children.length}
            </span>
          )}
        </span>
        <span className="arrow-icon">
          {isExpanded ? <MdExpandLess /> : <MdExpandMore />}
        </span>
      </button>

      {/* Group Content */}
      {isExpanded && (
        <div className="nested-group-content">
          {/* Render layer items - only regular layers with checkboxes */}
          {group.children && group.children.map((child, index) => {
            const childId = `${groupId}-${index}`;
            
            if (child.type === "group") {
              // Render nested group
              return (
                <NestedLayerGroup
                  key={childId}
                  group={child}
                  groupId={childId}
                  addedLayers={addedLayers}
                  toggleLayer={toggleLayer}
                  opacity={opacity}
                  handleOpacityChange={handleOpacityChange}
                  openGroups={openGroups}
                  toggleGroup={toggleGroup}
                  isLayerLoading={isLayerLoading}
                  nestingLevel={nestingLevel + 1}
                  language={language}
                />
              );
            } else if (child.Name) {
              // Render leaf layer with checkbox
              return (
                <LayerItem
                  key={childId}
                  layer={child}
                  groupId={childId}
                  addedLayers={addedLayers}
                  toggleLayer={toggleLayer}
                  opacity={opacity}
                  handleOpacityChange={handleOpacityChange}
                  nestingLevel={nestingLevel + 1}
                />
              );
            }
            return null;
          })}
        </div>
      )}
    </div>
  );
});

// Individual Layer Item Component (for regular layers)
const LayerItem = React.memo(({
  layer,
  groupId,
  addedLayers,
  toggleLayer,
  opacity,
  handleOpacityChange,
  nestingLevel
}) => {
  const uniqueKey = `${layer.Name}-${groupId}`;
  const isChecked = !!addedLayers[uniqueKey];

  return (
    <div className={`layer-item nested-layer-item ${isChecked ? "active" : ""}`}>
      <label className="layer-label-container">
        <input
          type="checkbox"
          checked={isChecked}
          onChange={() => toggleLayer(layer, groupId)}
        />
        <span className={`layer-label ${isChecked ? "layer-label-bold" : ""}`}>
          {layer.Layer}
        </span>
      </label>
    </div>
  );
});

const AttributePopup = React.memo(({ position, data, onClose, setIsInfoToolActive, mapRef }) => {
  const popupRef = useRef(null);
  // Track the map container's bounding rect so we can position the popup
  // relative to the viewport (position: fixed) and keep it inside the map.
  const [mapRect, setMapRect] = useState(null);

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (popupRef.current && !popupRef.current.contains(event.target)) {
        onClose();
        // Deactivate the info tool button when popup closes
        if (setIsInfoToolActive) {
          setIsInfoToolActive(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose, setIsInfoToolActive]);

  // Keep the map container's viewport rect up to date so the popup stays
  // anchored correctly when the window resizes, scrolls, or the layout shifts.
  useEffect(() => {
    if (!position) return;
    const updateRect = () => {
      const container = mapRef?.current?.getContainer?.() || mapRef?.current?._container;
      if (container) {
        setMapRect(container.getBoundingClientRect());
      } else {
        setMapRect(null);
      }
    };
    updateRect();
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);
    return () => {
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [position, mapRef]);

  // Early return must come AFTER all hooks to respect the Rules of Hooks.
  if (!position || !data) return null;

  // Prevent event propagation to avoid triggering map clicks
  const handlePopupClick = (e) => {
    e.stopPropagation();
  };

  const handleCloseClick = (e) => {
    e.stopPropagation(); // Prevent event bubbling to map
    onClose();
    // Deactivate the info tool button when close button is clicked
    if (setIsInfoToolActive) {
      setIsInfoToolActive(false);
    }
  };

  const formatValue = (value) => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'number') {
      return value % 1 === 0 ? value.toString() : value.toFixed(2);
    }
    return value.toString();
  };

  // Clean the key name for display
  const formatKeyName = (key) => {
    let cleanKey = key
      .replace(/^layer_\d+_/, '')
      .replace(/^Wildlife_Circle_Boundary_/, '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, char => char.toUpperCase());
    
    return cleanKey;
  };

  // Filter out geometry, long coordinate strings, and unwanted fields
  const filteredEntries = Object.entries(data).filter(([key, value]) => {
    // Skip geometry fields
    if (key.toLowerCase().includes('geometry') || 
        key.toLowerCase().includes('coord') ||
        key === 'layer_1_geometry' ||
        key.includes('geometry')) {
      return false;
    }
    
    // Skip long strings
    if (typeof value === 'string' && value.length > 100) {
      return false;
    }
    
    // Skip timestamp fields
    const lowerKey = key.toLowerCase();
    if (lowerKey.includes('updated_at') || 
        lowerKey.includes('created_at') || 
        lowerKey.includes('updatedat') || 
        lowerKey.includes('createdat')) {
      return false;
    }
    
    // Skip layer name as we display it separately
    if (key === 'layer_1_name' || key === 'coordinates') {
      return false;
    }
    
    return true;
  });

  // Separate coordinates for display at the top
  const coordinates = data.coordinates || 
                     (data.layer_1_coordinates ? data.layer_1_coordinates : null);

  const getIconForKey = (keyStr, value) => {
    const k = keyStr.toLowerCase();
    const iconStyle = { fontSize: '16px' };
    if (k.includes('ndvi')) {
      const num = parseFloat(value);
      if (!isNaN(num) && num < 0) return <MdTrendingDown style={{ ...iconStyle, color: '#e74c3c' }} />;
      return <MdTrendingUp style={{ ...iconStyle, color: '#2e7d32' }} />;
    }
    if (k.includes('category') || k.includes('change')) return <MdEco style={{ ...iconStyle, color: '#4caf50' }} />;
    if (k.includes('lat')) return <MdExplore style={{ ...iconStyle, color: '#555' }} />;
    if (k.includes('lon') || k.includes('lng')) return <MdExplore style={{ ...iconStyle, color: '#555' }} />;
    if (k.includes('div')) return <MdBusiness style={{ ...iconStyle, color: '#555' }} />;
    if (k.includes('range')) return <MdTerrain style={{ ...iconStyle, color: '#555' }} />;
    return <MdInfo style={{ ...iconStyle, color: '#555' }} />;
  };

  // --- Boundary-aware positioning (kept inside the map) ---
  // `position` is a container point (relative to the map's top-left), so we
  // convert it to viewport coordinates by adding the map container's offset.
  // The popup uses position: fixed, so left/top are viewport coordinates and
  // immune to any positioned ancestors. Clamping uses the map container's rect
  // so the popup always stays within the visible map area.
  const POPUP_WIDTH = 380;   // estimated (min 320, max 400)
  const POPUP_HEIGHT = 450;  // max height
  const MARGIN = 10;         // px from edge

  // Map container rect in viewport coordinates. Fall back to the viewport
  // itself if we can't resolve the map element (keeps things safe).
  const rect = mapRect || { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
  const boundsW = rect.width;
  const boundsH = rect.height;

  // Viewport coordinates of the click point.
  const clickX = rect.left + position.x;
  const clickY = rect.top + position.y;

  // Default: place popup to the bottom-right of the click point.
  let popupLeft = clickX + MARGIN;
  let popupTop = clickY + MARGIN;

  // Horizontal: if popup would overflow the map's right edge, flip to the
  // left of the click point.
  if (popupLeft + POPUP_WIDTH > rect.left + boundsW) {
    popupLeft = clickX - POPUP_WIDTH - MARGIN;
  }
  // If flipping also overflows the map's left edge, clamp inside the map.
  if (popupLeft < rect.left + MARGIN) {
    popupLeft = rect.left + Math.max(MARGIN, boundsW - POPUP_WIDTH - MARGIN);
  }

  // Vertical: if popup would overflow the map's bottom edge, flip above the
  // click point.
  if (popupTop + POPUP_HEIGHT > rect.top + boundsH) {
    popupTop = clickY - POPUP_HEIGHT - MARGIN;
  }
  // If flipping also overflows the map's top edge, clamp inside the map.
  if (popupTop < rect.top + MARGIN) {
    popupTop = rect.top + Math.max(MARGIN, boundsH - POPUP_HEIGHT - MARGIN);
  }

  return (
    <div
      ref={popupRef}
      className="attribute-popup"
      onClick={handlePopupClick}
      style={{
        position: 'fixed',
        left: `${popupLeft}px`,
        top: `${popupTop}px`,
        zIndex: 10000,
        backgroundColor: 'white',
        border: '1px solid #eee',
        borderRadius: '12px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        padding: '16px',
        minWidth: '220px',
        maxWidth: '300px',
        maxHeight: '350px',
        overflow: 'auto',
        fontFamily: "'Inter', 'Arial', sans-serif"
      }}
    >
      <div className="attribute-popup-header" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px'
      }}>
        <h4 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#111' }}>
          Feature Information
        </h4>
        <button
          onClick={handleCloseClick}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '20px',
            cursor: 'pointer',
            color: '#666',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            transition: 'background 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <MdClose />
        </button>
      </div>
      
      <div className="attribute-popup-content">
        {/* Display coordinates at the top if available */}
        {coordinates && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '12px',
            padding: '12px',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px',
            border: '1px solid #eee',
            fontSize: '13px'
          }}>
            <MdLocationOn style={{ fontSize: '18px', color: '#333', marginRight: '10px' }} />
            <strong style={{ color: '#333', minWidth: '70px' }}>Location</strong>
            <span style={{ color: '#555', marginLeft: 'auto' }}>
              {coordinates.replace(/Lat:/, 'Lat: ').replace(/Lng:/, ', Lng: ')}
            </span>
          </div>
        )}

        {/* Display layer name if available */}
        {data.layer_1_name && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '16px',
            padding: '12px',
            backgroundColor: '#eef6fc',
            borderRadius: '8px',
            border: '1px solid #d6eaf8'
          }}>
            <MdLayers style={{ fontSize: '20px', color: '#1976d2', marginRight: '12px' }} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '11px', color: '#1976d2', fontWeight: '600', textTransform: 'uppercase' }}>Layer</span>
              <strong style={{ fontSize: '15px', color: '#0d47a1', marginTop: '2px' }}>
                {data.layer_1_name}
              </strong>
            </div>
          </div>
        )}

        {/* Display all other attributes in a grid */}
        {filteredEntries.length > 0 ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '10px'
          }}>
            {filteredEntries.map(([key, value], index) => {
              const formattedKey = formatKeyName(key);
              const formattedValue = formatValue(value);
              
              if (!formattedValue || formattedValue === '-') {
                return null;
              }

              // Special styling for change category
              const isCategory = key.toLowerCase().includes('category') || key.toLowerCase().includes('change');
              const isNDVI = key.toLowerCase().includes('ndvi');

              return (
                <div key={index} style={{
                  padding: '12px',
                  backgroundColor: '#fff',
                  border: '1px solid #eee',
                  borderRadius: '8px',
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ marginRight: '6px', display: 'flex' }}>
                      {getIconForKey(key, formattedValue)}
                    </span>
                    <span style={{ fontSize: '12px', color: '#666', fontWeight: '500' }}>{formattedKey}</span>
                  </div>
                  <div style={{ 
                    fontSize: isNDVI ? '18px' : '14px', 
                    fontWeight: isNDVI ? '700' : '600', 
                    color: isNDVI ? '#2e7d32' : '#333',
                    textAlign: 'center',
                    marginTop: 'auto'
                  }}>
                    {isCategory ? (
                      <span style={{
                        display: 'inline-block',
                        padding: '4px 10px',
                        backgroundColor: '#fff4e5',
                        color: '#f57c00',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: '600'
                      }}>
                        {formattedValue}
                      </span>
                    ) : (
                      formattedValue
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{
            padding: '20px',
            textAlign: 'center',
            color: '#999',
            fontStyle: 'italic'
          }}>
            No attribute data available
          </div>
        )}
      </div>
    </div>
  );
});

const GEOSERVER_WMS = "/geoserver/wms";

// Complete nested data structure
const layersData = {
  groups: [
    {
      title: "Gujarat Boundaries",
      type: "flat",
      children: [
        { Name: "Gujarat_district", Layer: "District" },
        { Name: "Gujarat_Forest_Area_Boundary_March_2023", Layer: "Forest Area" }
      ]
    },
    {
      title: "Wildlife Forest",
      type: "nested",
      children: [
        { Name: "Wildlife_Circle_Boundary", Layer: "Wildlife Circle" },
        { Name: "Wildlife_Circle_Division_Boundary", Layer: "Wildlife Division" },
        { Name: "Wildlife_Circle_Range_Boundary", Layer: "Wildlife Range" },
        {
          title: "Gandhinagar Wildlife Circle",
          type: "group",
          children: [
            { Name: "gandhinagar_wildlife_circle", Layer: "Gandhinagar Wildlife Circle" },
            {
              title: "Banaskantha Forest Division",
              type: "group",
              children: [
                { Name: "banaskantha_forest_division", Layer: "Banaskantha Forest Division" },
                {
                  title: "Ranges",
                  type: "group",
                  children: [
                    { Name: "ambaji_north", Layer: "Ambaji North" },
                    { Name: "ambaji_south", Layer: "Ambaji South" },
                    { Name: "amirgadh", Layer: "Amirgadh" },
                    { Name: "danta_east", Layer: "Danta East" },
                    { Name: "danta_west", Layer: "Danta West" },
                    { Name: "dantiwada", Layer: "Dantiwada" },
                    { Name: "iqbalgadh_wl", Layer: "Iqbalgadh" },
                    { Name: "palanpur", Layer: "Palanpur" },
                    { Name: "tharad", Layer: "Tharad" }
                  ]
                }
              ]
            },
            {
              title: "Nalsarovar & Thol Bird Sanctuary",
              type: "group",
              children: [
                { Name: "nalsarovar___thol_bird_sanctuary__wildlife_divisio", Layer: "Nalsarovar Wildlife" },
                {
                  title: "Ranges",
                  type: "group",
                  children: [
                    { Name: "nalsarovar", Layer: "Nalsarovar" },
                    { Name: "nalsarovar_west", Layer: "Nalsarovar West" },
                    { Name: "wildlife_kadi", Layer: "Wildlife Kadi" }
                  ]
                }
              ]
            },
            {
              title: "Wild Ass Sanctuary",
              type: "group",
              children: [
                { Name: "wild_ass_sanctuary", Layer: "Wild Ass Sanctuary" },
                {
                  title: "Ranges",
                  type: "group",
                  children: [
                    { Name: "adesar_wl", Layer: "Adesar WL" },
                    { Name: "bajana", Layer: "Bajana" },
                    { Name: "dhrangadhra_wl", Layer: "Dhrangadhra WL" },
                    { Name: "halvad_wl", Layer: "Halvad WL" }
                  ]
                }
              ]
            }
          ]
        },
        {
          title: "Junagadh Wildlife Circle",
          type: "group",
          children: [
            { Name: "junagadh_wildlife_circle", Layer: "Junagadh Wildlife Circle" },
            {
              title: "Gir East Wildlife Division",
              type: "group",
              children: [
                { Name: "gir_east_forest_division__dhari", Layer: "Gir East WL" },
                {
                  title: "Ranges",
                  type: "group",
                  children: [
                    { Name: "dalkhaniya", Layer: "Dalkhaniya" },
                    { Name: "hadala", Layer: "Hadala" },
                    { Name: "jasadhar", Layer: "Jasadhar" },
                    { Name: "paniya", Layer: "Paniya" },
                    { Name: "sarasiya", Layer: "Sarasiya" },
                    { Name: "savar_kundlagir", Layer: "Savar Kundala" },
                    { Name: "tulsishyam", Layer: "Tulsishyam" }
                  ]
                }
              ]
            },
            {
              title: "Gir West Forest Division",
              type: "group",
              children: [
                { Name: "gir_west_forest_division", Layer: "Gir West Forest Division" },
                {
                  title: "Ranges",
                  type: "group",
                  children: [
                    { Name: "ankolvadi", Layer: "Ankolvadi" },
                    { Name: "babariya", Layer: "Babariya" },
                    { Name: "chhodavadi", Layer: "Chhodavadi" },
                    { Name: "dedakadi", Layer: "Dedakadi" },
                    { Name: "devaliya", Layer: "Devaliya" },
                    { Name: "jamvala", Layer: "Jamvala" },
                    { Name: "maliya_hatina", Layer: "Maliya Hatina" },
                    { Name: "sasan", Layer: "Sasan" },
                    { Name: "talala", Layer: "Talala" },
                    { Name: "visavadar", Layer: "Visavadar" }
                  ]
                }
              ]
            },
            {
              title: "Porbandar Forest Division",
              type: "group",
              children: [
                { Name: "porbandar_forest_division", Layer: "Porbandar Forest Division" },
                {
                  title: "Ranges",
                  type: "group",
                  children: [
                    { Name: "bhanvadporbandar", Layer: "Bhanvad" },
                    { Name: "ranavavporbandar", Layer: "Ranavav" }
                  ]
                }
              ]
            },
            {
              title: "Shetranjee Wildlife Division",
              type: "group",
              children: [
                {
                  title: "Ranges",
                  type: "group",
                  children: [
                    { Name: "talajashetranjee", Layer: "Talaja" }
                  ]
                }
              ]
            },
            {
              title: "Black Buck National Park (Velavadar)",
              type: "group",
              children: [
                { Name: "black_buck_national_park___velavadar", Layer: "Velavadar National Park" },
                {
                  title: "Ranges",
                  type: "group",
                  children: [
                    { Name: "velavadar", Layer: "Velavadar" }
                  ]
                }
              ]
            }
          ]
        },
        {
          title: "Vadodara Wildlife Circle",
          type: "group",
          children: [
            { Name: "vadodara_wildlife_circle", Layer: "Vadodara Wildlife Circle" },
            {
              title: "Narmada Forest Division",
              type: "group",
              children: [
                { Name: "narmada_forest_division", Layer: "Narmada Forest Division" },
                {
                  title: "Ranges",
                  type: "group",
                  children: [
                    { Name: "dediyapadanarmada", Layer: "Dediyapada" },
                    { Name: "fulsar", Layer: "Fulsar" },
                    { Name: "piplod", Layer: "Piplod" },
                    { Name: "rajpiplanarmada", Layer: "Rajpipla" },
                    { Name: "sagai", Layer: "Sagai" },
                    { Name: "sagbaranarmada", Layer: "Sagbara" },
                    { Name: "sorapada", Layer: "Sorapada" }
                  ]
                }
              ]
            },
            {
              title: "Vadodara Wildlife Division",
              type: "group",
              children: [
                { Name: "jambughoda", Layer: "Jambughoda" },
                { Name: "kanjeta", Layer: "Kanjeta" },
                { Name: "shivrajpur", Layer: "Shivrajpur" }
              ]
            }
          ]
        }
      ]
    },
    {
      title: "Social Forest",
      type: "nested",
      children: [
        { Name: "Social_Forestry_Circle_Boundary", Layer: "Social Forestry Circle" },
        { Name: "Social_Forestry_Range_Boundary", Layer: "Social Forestry Range" },
        {
          title: "Bharuch Social Forestry Circle",
          type: "group",
          children: [
            { Name: "bharuch_social_forestry_circle", Layer: "Bharuch Social Forestry Circle" },
            {
              title: "Bharuch SF Division",
              type: "group",
              children: [
                { Name: "bharuch_sf_division", Layer: "Bharuch SF Division" },
                {
                  title: "Ranges",
                  type: "group",
                  children: [
                    { Name: "amod_sf", Layer: "Amod SF" },
                    { Name: "anklesvar_sf", Layer: "Anklesvar SF" },
                    { Name: "bharuch_sf", Layer: "Bharuch SF" },
                    { Name: "jambusar_sf", Layer: "Jambusar SF" },
                    { Name: "jhagadia_sf", Layer: "Jhagadia SF" },
                    { Name: "vagra_sf", Layer: "Vagra SF" },
                    { Name: "valia_sf", Layer: "Valia SF" }
                  ]
                }
              ]
            },
            {
              title: "Narmada Social Forestry",
              type: "group",
              children: [
                { Name: "narmada_social_forest", Layer: "Narmada Social Forest" },
                {
                  title: "Ranges",
                  type: "group",
                  children: [
                    { Name: "dediyapada", Layer: "Dediyapada" },
                    { Name: "rajpipla", Layer: "Rajpipla" },
                    { Name: "sagbara", Layer: "Sagbara" },
                    { Name: "tilakwada", Layer: "Tilakwada" }
                  ]
                }
              ]
            },
            {
              title: "Navsari Forest Division",
              type: "group",
              children: [
                { Name: "navsari_forest_division", Layer: "Navsari Forest Division" },
                {
                  title: "Ranges",
                  type: "group",
                  children: [
                    { Name: "chikhli", Layer: "Chikhli" },
                    { Name: "gandevi", Layer: "Gandevi" },
                    { Name: "supa", Layer: "Supa" }
                  ]
                }
              ]
            },
            {
              title: "Surat Social Forest Division",
              type: "group",
              children: [
                { Name: "surat_social_forest_division", Layer: "Surat Social Forest Division" },
                {
                  title: "Ranges",
                  type: "group",
                  children: [
                    { Name: "kamrej", Layer: "Kamrej" },
                    { Name: "surat_mahuva_new", Layer: "Mahuva" },
                    { Name: "mandavi", Layer: "Mandavi" },
                    { Name: "mangrol", Layer: "Mangrol" },
                    { Name: "olpad", Layer: "Olpad" },
                    { Name: "palsana", Layer: "Palsana" },
                    { Name: "bardoli", Layer: "Bardoli" },
                    { Name: "choryasi", Layer: "Choryasi" }
                  ]
                }
              ]
            },
            {
              title: "Valsad SF Division",
              type: "group",
              children: [
                { Name: "valsad_sf_division", Layer: "Valsad SF Division" },
                {
                  title: "Ranges",
                  type: "group",
                  children: [
                    { Name: "dharampur_sf", Layer: "Dharampur SF" },
                    { Name: "pardi_sf", Layer: "Pardi SF" },
                    { Name: "umargam_sf", Layer: "Umargam SF" },
                    { Name: "valsad_sf", Layer: "Valsad SF" }
                  ]
                }
              ]
            }
          ]
        },
        {
          title: "Ahmedabad Social Forestry Circle",
          type: "group",
          children: [
            { Name: "ahmedabad_social_forestry_circle", Layer: "Ahmedabad Social Forestry Circle" },
            {
              title: "Ahmedabad Social Forestry Division",
              type: "group",
              children: [
                { Name: "ahmedabad_social_forestry_division", Layer: "Ahmedabad Social Forestry Division" },
                {
                  title: "Ranges",
                  type: "group",
                  children: [
                    { Name: "ahmedabad_city_sf", Layer: "Ahmedabad City SF" },
                    { Name: "bavla_sf", Layer: "Bavla SF" },
                    { Name: "daskroi_sf", Layer: "Daskroi SF" },
                    { Name: "detroj_sf", Layer: "Detroj SF" },
                    { Name: "dhandhuka_sf", Layer: "Dhandhuka SF" },
                    { Name: "dholera_sf", Layer: "Dholera SF" },
                    { Name: "dholka_sf", Layer: "Dholka SF" },
                    { Name: "mandal_sf", Layer: "Mandal SF" },
                    { Name: "sanand_sf", Layer: "Sanand SF" },
                    { Name: "viramgam_sf", Layer: "Viramgam SF" }
                  ]
                }
              ]
            },
            {
              title: "Anand Social Forestry Division",
              type: "group",
              children: [
                { Name: "anand_social_forestry_division", Layer: "Anand Social Forestry Division" },
                {
                  title: "Ranges",
                  type: "group",
                  children: [
                    { Name: "anand_sf", Layer: "Anand SF" },
                    { Name: "anklav_sf", Layer: "Anklav SF" },
                    { Name: "borsad_sf", Layer: "Borsad SF" },
                    { Name: "khambhat_sf", Layer: "Khambhat SF" },
                    { Name: "petlad_sf", Layer: "Petlad SF" },
                    { Name: "sojitra_sf", Layer: "Sojitra SF" },
                    { Name: "tarapur_sf", Layer: "Tarapur SF" },
                    { Name: "umreth_sf", Layer: "Umreth SF" }
                  ]
                }
              ]
            },
            {
              title: "Nadiad Social Forestry Division",
              type: "group",
              children: [
                { Name: "nadiad_social_forestry_division", Layer: "Nadiad Social Forestry Division" },
                {
                  title: "Ranges",
                  type: "group",
                  children: [
                    { Name: "kapadvanj_sf", Layer: "Kapadvanj SF" },
                    { Name: "kathlal_sf", Layer: "Kathlal SF" },
                    { Name: "kheda_sf", Layer: "Kheda SF" },
                    { Name: "mahudha_sf", Layer: "Mahudha SF" },
                    { Name: "matar_sf", Layer: "Matar SF" },
                    { Name: "mehmedabad_sf", Layer: "Mehmedabad SF" },
                    { Name: "nadiad_sf", Layer: "Nadiad SF" },
                    { Name: "thasra_sf", Layer: "Thasra SF" }
                  ]
                }
              ]
            },
            {
              title: "Surendranagar Social Forestry Division",
              type: "group",
              children: [
                { Name: "surendranagar_social_forestry_division", Layer: "Surendranagar Social Forestry Division" },
                {
                  title: "Ranges",
                  type: "group",
                  children: [
                    { Name: "chotila_sf", Layer: "Chotila SF" },
                    { Name: "chuda_sf", Layer: "Chuda SF" },
                    { Name: "dhrangadhra_sf", Layer: "Dhrangadhra SF" },
                    { Name: "lakhatar_sf", Layer: "Lakhatar SF" },
                    { Name: "limbadi_sf", Layer: "Limbadi SF" },
                    { Name: "muli_sf", Layer: "Muli SF" },
                    { Name: "patadi_sf", Layer: "Patadi SF" },
                    { Name: "sayla_sf", Layer: "Sayla SF" },
                    { Name: "surendranagar_sf", Layer: "Surendranagar SF" }
                  ]
                }
              ]
            }
          ]
        },
        {
          title: "Godhra Social Forestry Circle",
          type: "group",
          children: [
            { Name: "godhra_social_forestry_circle", Layer: "Godhra Social Forestry Circle" },
            {
              title: "Dahod SF Division",
              type: "group",
              children: [
                { Name: "dahod_sf_division", Layer: "Dahod SF Division" },
                {
                  title: "Ranges",
                  type: "group",
                  children: [
                    { Name: "baria", Layer: "Baria" },
                    { Name: "dahod", Layer: "Dahod" },
                    { Name: "dhanpur", Layer: "Dhanpur" },
                    { Name: "fatepura", Layer: "Fatepura" },
                    { Name: "garbada", Layer: "Garbada" },
                    { Name: "jhalod", Layer: "Jhalod" },
                    { Name: "limkheda", Layer: "Limkheda" }
                  ]
                }
              ]
            },
            {
              title: "Godhra SF Division",
              type: "group",
              children: [
                { Name: "godhra_sf_division", Layer: "Godhra SF Division" },
                {
                  title: "Ranges",
                  type: "group",
                  children: [
                    { Name: "ghoghamba", Layer: "Ghogamba" },
                    { Name: "godhara", Layer: "Godhara" },
                    { Name: "halol", Layer: "Halol" },
                    { Name: "kadana", Layer: "Kadana" },
                    { Name: "khanpur", Layer: "Khanpur" },
                    { Name: "lunawada", Layer: "Lunawada" },
                    { Name: "morwa_hadaf", Layer: "Morwa Hadaf" },
                    { Name: "santrampur", Layer: "Santrampur" },
                    { Name: "shehera", Layer: "Shehera" },
                    { Name: "virpur", Layer: "Virpur" }
                  ]
                }
              ]
            },
            {
              title: "Vadodara SF Division",
              type: "group",
              children: [
                { Name: "vadodara_sf_division", Layer: "Vadodara SF Division" },
                {
                  title: "Ranges",
                  type: "group",
                  children: [
                    { Name: "chhotaudepur", Layer: "Chhotaudepur" },
                    { Name: "dabhoi", Layer: "Dabhoi" },
                    { Name: "karjan", Layer: "Karjan" },
                    { Name: "nasvadi", Layer: "Nasvadi" },
                    { Name: "padra", Layer: "Padra" },
                    { Name: "pavi_jetpur", Layer: "Pavi Jetpur" },
                    { Name: "sankheda", Layer: "Sankheda" },
                    { Name: "savli", Layer: "Savli" },
                    { Name: "shinor", Layer: "Shinor" },
                    { Name: "vadodara", Layer: "Vadodara" },
                    { Name: "vaghodia", Layer: "Vaghodia" }
                  ]
                }
              ]
            }
          ]
        },
        {
          title: "Mahesana Social Forestry Circle",
          type: "group",
          children: [
            { Name: "mahesana_social_forestry_circle", Layer: "Mahesana Social Forestry Circle" },
            {
              title: "Banaskantha SF Division",
              type: "group",
              children: [
                { Name: "banaskantha_sf_division", Layer: "Banaskantha SF Division" },
                {
                  title: "Ranges",
                  type: "group",
                  children: [
                    { Name: "amirgadh", Layer: "Amirgadh" },
                    { Name: "bhabhar", Layer: "Bhabhar" },
                    { Name: "danta", Layer: "Danta" },
                    { Name: "dantiwada", Layer: "Dantiwada" },
                    { Name: "deesa", Layer: "Deesa" },
                    { Name: "deodar", Layer: "Deodar" },
                    { Name: "dhanera", Layer: "Dhanera" },
                    { Name: "palanpur", Layer: "Palanpur" },
                    { Name: "shihori", Layer: "Shihori" },
                    { Name: "tharad", Layer: "Tharad" },
                    { Name: "vadgam", Layer: "Vadgam" },
                    { Name: "vav", Layer: "Vav" }
                  ]
                }
              ]
            },
            {
              title: "Mahesana SF Division",
              type: "group",
              children: [
                { Name: "mahesana_sf_division", Layer: "Mahesana SF Division" },
                {
                  title: "Ranges",
                  type: "group",
                  children: [
                    { Name: "becharaji", Layer: "Becharaji" },
                    { Name: "kadi", Layer: "Kadi" },
                    { Name: "kheralu", Layer: "Kheralu" },
                    { Name: "mehsana", Layer: "Mehsana" },
                    { Name: "unjha", Layer: "Unjha" },
                    { Name: "vadanagar", Layer: "Vadanagar" },
                    { Name: "vijapur", Layer: "Vijapur" },
                    { Name: "visnagar", Layer: "Visnagar" }
                  ]
                }
              ]
            },
            {
              title: "Sabarkantha North SF Division",
              type: "group",
              children: [
                { Name: "sabarkantha_north_sf_division", Layer: "Sabarkantha North SF Division" },
                {
                  title: "Ranges",
                  type: "group",
                  children: [
                    { Name: "bayad", Layer: "Bayad" },
                    { Name: "bhiloda", Layer: "Bhiloda" },
                    { Name: "dhansura", Layer: "Dhansura" },
                    { Name: "himatnagar", Layer: "Himatnagar" },
                    { Name: "idar", Layer: "Idar" },
                    { Name: "khedbrahma", Layer: "Khedbrahma" },
                    { Name: "malpur", Layer: "Malpur" },
                    { Name: "megharaj", Layer: "Megharaj" },
                    { Name: "modasa", Layer: "Modasa" },
                    { Name: "prantij", Layer: "Prantij" },
                    { Name: "talod", Layer: "Talod" },
                    { Name: "vadali", Layer: "Vadali" },
                    { Name: "vijaynagar", Layer: "Vijaynagar" }
                  ]
                }
              ]
            }
          ]
        },
        {
          title: "Rajkot Social Forestry Circle",
          type: "group",
          children: [
            { Name: "rajkot_social_forestry_circle", Layer: "Rajkot Social Forestry Circle" },
            {
              title: "Amreli Social Forestry Division",
              type: "group",
              children: [
                { Name: "amreli_social_forestry_division", Layer: "Amreli Social Forestry Division" },
                {
                  title: "Ranges",
                  type: "group",
                  children: [
                    { Name: "amreli", Layer: "Amreli" },
                    { Name: "babra", Layer: "Babra" },
                    { Name: "dhari", Layer: "Dhari" },
                    { Name: "kunkavav", Layer: "Kunkavav" },
                    { Name: "lathi", Layer: "Lathi" },
                    { Name: "rajula", Layer: "Rajula" },
                    { Name: "savar_kundla", Layer: "Savar Kundla" }
                  ]
                }
              ]
            },
            {
              title: "Botad Social Forestry Division",
              type: "group",
              children: [
                { Name: "botad_social_forestry_division", Layer: "Botad Social Forestry Division" },
                {
                  title: "Ranges",
                  type: "group",
                  children: [
                    { Name: "barwala", Layer: "Barwala" },
                    { Name: "bhavnagar", Layer: "Bhavnagar" },
                    { Name: "botad", Layer: "Botad" },
                    { Name: "gadhada", Layer: "Gadhada" },
                    { Name: "gariyadhar", Layer: "Gariyadhar" },
                    { Name: "ghogha", Layer: "Ghogha" },
                    { Name: "palitana", Layer: "Palitana" },
                    { Name: "ranpur", Layer: "Ranpur" },
                    { Name: "sihora", Layer: "Sihor" },
                    { Name: "talaja", Layer: "Talaja" },
                    { Name: "umrala", Layer: "Umrala" }
                  ]
                }
              ]
            },
            {
              title: "Devbhumi Dwarka Social Forestry Division",
              type: "group",
              children: [
                { Name: "devbhumi_dwarka_social_forestry_division", Layer: "Devbhumi Dwarka Social Forestry Division" },
                {
                  title: "Ranges",
                  type: "group",
                  children: [
                    { Name: "bhanvad", Layer: "Bhanvad" },
                    { Name: "dhrol", Layer: "Dhrol" },
                    { Name: "dwarka", Layer: "Dwarka" },
                    { Name: "jamjodhpur", Layer: "Jamjodhpur" },
                    { Name: "jamnagar", Layer: "Jamnagar" },
                    { Name: "kalavad", Layer: "Kalavad" },
                    { Name: "kalyanpur", Layer: "Kalyanpur" },
                    { Name: "khambhalia", Layer: "Khambhalia" },
                    { Name: "lalpur", Layer: "Lalpur" },
                    { Name: "porbandar", Layer: "Porbandar" },
                    { Name: "ranavav", Layer: "Ranavav" }
                  ]
                }
              ]
            },
            {
              title: "Gir Somnath Social Forestry Division",
              type: "group",
              children: [
                { Name: "gir_somnath_social_forestry_division", Layer: "Gir Somnath Social Forestry Division" },
                {
                  title: "Ranges",
                  type: "group",
                  children: [
                    { Name: "bhesan", Layer: "Bhesan" },
                    { Name: "junagadh", Layer: "Junagadh" },
                    { Name: "keshod", Layer: "Keshod" },
                    { Name: "kodinar", Layer: "Kodinar" },
                    { Name: "maliya", Layer: "Maliya" },
                    { Name: "manavadar", Layer: "Manavadar" },
                    { Name: "mangrola", Layer: "Mangrol" },
                    { Name: "mendarda", Layer: "Mendarda" },
                    { Name: "prabhash_patan", Layer: "Prabhash Patan" },
                    { Name: "una", Layer: "Una" },
                    { Name: "visavadar", Layer: "Visavadar" }
                  ]
                }
              ]
            },
            {
              title: "Rajkot Social Forestry Division",
              type: "group",
              children: [
                { Name: "rajkot_social_forestry_division", Layer: "Rajkot Social Forestry Division" },
                {
                  title: "Ranges",
                  type: "group",
                  children: [
                    { Name: "dhoraji", Layer: "Dhoraji" },
                    { Name: "halvad", Layer: "Halvad" },
                    { Name: "jamkandorna", Layer: "Jamkandorna" },
                    { Name: "jetpur", Layer: "Jetpur" },
                    { Name: "kotda_sangani", Layer: "Kotda Sangani" },
                    { Name: "morbi", Layer: "Morbi" },
                    { Name: "paddhari", Layer: "Paddhari" },
                    { Name: "rajkot_n", Layer: "Rajkot N" },
                    { Name: "rajkot_s", Layer: "Rajkot S" },
                    { Name: "tankara", Layer: "Tankara" },
                    { Name: "upleta", Layer: "Upleta" },
                    { Name: "vinchiya", Layer: "Vinchiya" },
                    { Name: "wankaner", Layer: "Wankaner" }
                  ]
                }
              ]
            }
          ]
        }
      ]
    },
    {
      title: "Territorial Forest",
      type: "nested",
      children: [
        { Name: "Teritorial_Circle_Division_Boundary", Layer: "Territorial Circle Division" },
        { Name: "Teritorial_Circle_Range_Boundary", Layer: "Territorial Circle Range" },
        {
          title: "Gandhinagar Circle",
          type: "group",
          children: [
            { Name: "gandhinagar", Layer: "Gandhinagar Circle" },
            {
              title: "Arvalli (Sabarkantha South Forest)",
              type: "group",
              children: [
                {
                  title: "Ranges",
                  type: "group",
                  children: [
                    { Name: "bhiloda", Layer: "Bhiloda" },
                    { Name: "malpur", Layer: "Malpur" },
                    { Name: "meghraj", Layer: "Meghraj" },
                    { Name: "modasa", Layer: "Modasa" },
                    { Name: "shamalaji", Layer: "Shamlaji" }
                  ]
                }
              ]
            },
            {
              title: "Gandhinagar Forest",
              type: "group",
              children: [
                { Name: "gandhinagar_forest_division", Layer: "Gandhinagar Forest Division" },
                {
                  title: "Ranges",
                  type: "group",
                  children: [
                    { Name: "atarsumba", Layer: "Atarsumba" },
                    { Name: "borij", Layer: "Borij" },
                    { Name: "dehgam", Layer: "Dehgam" },
                    { Name: "dharoi", Layer: "Dharoi" },
                    { Name: "kalol", Layer: "Kalol" },
                    { Name: "mansa", Layer: "Mansa" },
                    { Name: "urja", Layer: "Urja" }
                  ]
                }
              ]
            },
            {
              title: "Sabarkantha Forest",
              type: "group",
              children: [
                { Name: "sabarkantha_forest_division", Layer: "Sabarkantha Forest Division" },
                {
                  title: "Ranges",
                  type: "group",
                  children: [
                    { Name: "dholwani", Layer: "Dholwani" },
                    { Name: "poshina", Layer: "Poshina" },
                    { Name: "raygadh", Layer: "Raygadh" },
                    { Name: "rdf_khedbrahma", Layer: "RDF Khedbrahma" },
                    { Name: "rdf_poshina", Layer: "RDF Poshina" },
                    { Name: "vadali", Layer: "Vadali" },
                    { Name: "vijaynagar", Layer: "Vijaynagar" }
                  ]
                }
              ]
            }
          ]
        },
        {
          title: "Junagadh Circle",
          type: "group",
          children: [
            { Name: "junagadh", Layer: "Junagadh" },
            {
              title: "Bhavnagar Forest Division",
              type: "group",
              children: [
                { Name: "bhavnagar_forest_division", Layer: "Bhavnagar Forest Division" },
                {
                  title: "Ranges",
                  type: "group",
                  children: [
                    { Name: "bhavnagar", Layer: "Bhavnagar" },
                    { Name: "bhanvnagar_mahuva_new", Layer: "Mahuva" },
                    { Name: "palitana", Layer: "Palitana" },
                    { Name: "sihor", Layer: "Sihor" },
                    { Name: "vallabhipur", Layer: "Vallabhipur" }
                  ]
                }
              ]
            },
            {
              title: "Jamnagar Forest Division",
              type: "group",
              children: [
                { Name: "jamnagar_forest_division", Layer: "Jamnagar Forest Division" },
                {
                  title: "Ranges",
                  type: "group",
                  children: [
                    { Name: "dhrol", Layer: "Dhrol" },
                    { Name: "dwarka", Layer: "Dwarka" },
                    { Name: "jamjodhpur", Layer: "Jamjodhpur" },
                    { Name: "jamnagar", Layer: "Jamnagar" }
                  ]
                }
              ]
            },
            {
              title: "Junagadh Forest Division",
              type: "group",
              children: [
                { Name: "junagadh_forest_division", Layer: "Junagadh Forest Division" },
                {
                  title: "Ranges",
                  type: "group",
                  children: [
                    { Name: "dungar_north", Layer: "Dungar North" },
                    { Name: "dungar_south", Layer: "Dungar South" },
                    { Name: "kutiyana", Layer: "Kutiyana" },
                    { Name: "mangrol", Layer: "Mangrol" },
                    { Name: "veraval", Layer: "Veraval" }
                  ]
                }
              ]
            },
            {
              title: "Morbi Forest",
              type: "group",
              children: [
                {
                  title: "Ranges",
                  type: "group",
                  children: [
                    { Name: "gondal", Layer: "Gondal" },
                    { Name: "morbi", Layer: "Morbi" },
                    { Name: "rajkot", Layer: "Rajkot" },
                    { Name: "wankaner", Layer: "Wankaner" }
                  ]
                }
              ]
            },
            {
              title: "Surendranagar Forest Division",
              type: "group",
              children: [
                { Name: "surendranagar_forest_division", Layer: "Surendranagar Forest Division" },
                {
                  title: "Ranges",
                  type: "group",
                  children: [
                    { Name: "chotila", Layer: "Chotila" },
                    { Name: "dhrangadhra", Layer: "Dhrangadhra" },
                    { Name: "muli", Layer: "Muli" },
                    { Name: "patdi", Layer: "Patdi" },
                    { Name: "thangadh", Layer: "Thangadh" },
                    { Name: "wadhwan", Layer: "Wadhwan" }
                  ]
                }
              ]
            }
          ]
        },
        {
          title: "Kutchh Circle",
          type: "group",
          children: [
            { Name: "kachchh", Layer: "Kachchh" },
            {
              title: "Kachchh East Forest Division",
              type: "group",
              children: [
                { Name: "kachchh_east_forest_division", Layer: "Kachchh East Forest Division" },
                {
                  title: "Ranges",
                  type: "group",
                  children: [
                    { Name: "adesar", Layer: "Adesar" },
                    { Name: "anjar", Layer: "Anjar" },
                    { Name: "bhachau", Layer: "Bhachau" },
                    { Name: "bhuj_south", Layer: "Bhuj South" },
                    { Name: "mundra", Layer: "Mundra" },
                    { Name: "rapar_north", Layer: "Rapar North" },
                    { Name: "rapar_south", Layer: "Rapar South" }
                  ]
                }
              ]
            },
            {
              title: "Kachchh West Forest Division",
              type: "group",
              children: [
                { Name: "kachchh_west_forest_division", Layer: "Kachchh West Forest Division" },
                {
                  title: "Ranges",
                  type: "group",
                  children: [
                    { Name: "bhuj_west", Layer: "Bhuj West" },
                    { Name: "dayapar_north", Layer: "Dayapar North" },
                    { Name: "dayapar_south", Layer: "Dayapar South" },
                    { Name: "mandvi", Layer: "Mandvi" },
                    { Name: "nakhatrana_east", Layer: "Nakhatrana East" },
                    { Name: "nakhatrana_west", Layer: "Nakhatrana West" },
                    { Name: "naliya_north", Layer: "Naliya North" },
                    { Name: "naliya_south", Layer: "Naliya South" }
                  ]
                }
              ]
            },
            {
              title: "Patan Forest Division",
              type: "group",
              children: [
                { Name: "patan_forest_division", Layer: "Patan Forest Division" },
                {
                  title: "Ranges",
                  type: "group",
                  children: [
                    { Name: "radhanpur", Layer: "Radhanpur" },
                    { Name: "sami", Layer: "Sami" },
                    { Name: "santalpur", Layer: "Santalpur" },
                    { Name: "varahi", Layer: "Varahi" }
                  ]
                }
              ]
            }
          ]
        },
        {
          title: "Surat Circle",
          type: "group",
          children: [
            { Name: "surat", Layer: "Surat" },
            {
              title: "Bharuch Sub Forest Division",
              type: "group",
              children: [
                { Name: "bharuch_sub_forest_division", Layer: "Bharuch Sub Forest Division" },
                {
                  title: "Ranges",
                  type: "group",
                  children: [
                    { Name: "bharuch", Layer: "Bharuch" },
                    { Name: "jaghadiya", Layer: "Jaghadiya" },
                    { Name: "netrang", Layer: "Netrang" }
                  ]
                }
              ]
            },
            {
              title: "Surat Forest Division",
              type: "group",
              children: [
                { Name: "surat_forest_division", Layer: "Surat Forest Division" },
                {
                  title: "Ranges",
                  type: "group",
                  children: [
                    { Name: "dummas", Layer: "Dumas" },
                    { Name: "mahuva", Layer: "Mahuva" },
                    { Name: "mandvi_north", Layer: "Mandvi North" },
                    { Name: "mandvi_south", Layer: "Mandvi South" },
                    { Name: "umarpada", Layer: "Umarpada" },
                    { Name: "vadpada", Layer: "Vadpada" },
                    { Name: "vankal", Layer: "Vankal" }
                  ]
                }
              ]
            },
            {
              title: "Vyara Forest Division",
              type: "group",
              children: [
                { Name: "vyara_forest_division", Layer: "Vyara Forest Division" },
                {
                  title: "Ranges",
                  type: "group",
                  children: [
                    { Name: "fort_songadh", Layer: "Fort Songadh" },
                    { Name: "kherwada", Layer: "Kherwada" },
                    { Name: "malangdev", Layer: "Malangdev" },
                    { Name: "nessu_east", Layer: "Nessu East" },
                    { Name: "nessu_west", Layer: "Nessu West" },
                    { Name: "sadadvel", Layer: "Sadadvel" },
                    { Name: "unai", Layer: "Unai" },
                    { Name: "vajpur", Layer: "Vajpur" },
                    { Name: "vyara", Layer: "Vyara" }
                  ]
                }
              ]
            }
          ]
        },
        {
          title: "Vadodara Circle",
          type: "group",
          children: [
            { Name: "vadodara", Layer: "Vadodara" },
            {
              title: "Baria Forest Division",
              type: "group",
              children: [
                { Name: "baria_forest_division", Layer: "Baria Forest Division" },
                {
                  title: "Ranges",
                  type: "group",
                  children: [
                    { Name: "baria", Layer: "Baria" },
                    { Name: "dahod", Layer: "Dahod" },
                    { Name: "dhanpur", Layer: "Dhanpur" },
                    { Name: "fatepura", Layer: "Fatepura" },
                    { Name: "garbada", Layer: "Garbada" },
                    { Name: "limkheda", Layer: "Limkheda" },
                    { Name: "rampura", Layer: "Rampura" },
                    { Name: "sanjeli", Layer: "Sanjeli" },
                    { Name: "sarjumi", Layer: "Sarjumi" },
                    { Name: "va_dungri", Layer: "Vansiya Dungari" },
                    { Name: "zalod", Layer: "Zalod" }
                  ]
                }
              ]
            },
            {
              title: "Chhotaudepur Forest Division",
              type: "group",
              children: [
                { Name: "chhotaudepur_forest_division", Layer: "Chhota Udepur Forest Division" },
                {
                  title: "Ranges",
                  type: "group",
                  children: [
                    { Name: "boriyad", Layer: "Boriyad" },
                    { Name: "chhotaudepur", Layer: "Chhotaudepur" },
                    { Name: "dolariya", Layer: "Dolariya" },
                    { Name: "jetpur_pavi", Layer: "Jetpur Pavi" },
                    { Name: "kavant", Layer: "Kavant" },
                    { Name: "nasvadi", Layer: "Nasvadi" },
                    { Name: "panvad", Layer: "Panvad" },
                    { Name: "rangpur", Layer: "Rangpur" },
                    { Name: "vadodara", Layer: "Vadodara" }
                  ]
                }
              ]
            },
            {
              title: "Godhra Forest Division",
              type: "group",
              children: [
                { Name: "godhra_forest_division", Layer: "Godhra Forest Division" },
                {
                  title: "Ranges",
                  type: "group",
                  children: [
                    { Name: "godhra_east", Layer: "Godhra East" },
                    { Name: "godhra_west", Layer: "Godhra West" },
                    { Name: "halol", Layer: "Halol" },
                    { Name: "morwa_hadaf", Layer: "Morwa Hadaf" },
                    { Name: "rajgadh", Layer: "Rajgadh" },
                    { Name: "shahera", Layer: "Shahera" },
                    { Name: "vejalpur", Layer: "Vejalpur" }
                  ]
                }
              ]
            },
            {
              title: "Mahisagar Forest Division",
              type: "group",
              children: [
                {
                  title: "Ranges",
                  type: "group",
                  children: [
                    { Name: "ditwas", Layer: "Ditwas" },
                    { Name: "khanpur", Layer: "Khanpur" },
                    { Name: "lunawada", Layer: "Lunawada" },
                    { Name: "munpur", Layer: "Munpur" },
                    { Name: "santrampur_east", Layer: "Santrampur East" },
                    { Name: "santrampur_west", Layer: "Santrampur West" }
                  ]
                }
              ]
            }
          ]
        },
        {
          title: "Valsad Circle",
          type: "group",
          children: [
            { Name: "valsad", Layer: "Valsad" },
            {
              title: "The Dang North Forest Division",
              type: "group",
              children: [
                { Name: "the_dang_north_forest_division", Layer: "Dang North Forest" },
                {
                  title: "Ranges",
                  type: "group",
                  children: [
                    { Name: "ahwa_w_", Layer: "Ahwa W" },
                    { Name: "bardipada_saja", Layer: "Bardipada Saja" },
                    { Name: "bheskatri", Layer: "Bheskatri" },
                    { Name: "kalibel", Layer: "Kalibel" },
                    { Name: "lavchali", Layer: "Lavchali" },
                    { Name: "pipalaidevi", Layer: "Pipalaidevi" },
                    { Name: "singana", Layer: "Singana" },
                    { Name: "subir", Layer: "Subir" }
                  ]
                }
              ]
            },
            {
              title: "The Dang South Forest Division",
              type: "group",
              children: [
                { Name: "the_dang_south_forest_division", Layer: "The Dang South Forest Division" },
                {
                  title: "Ranges",
                  type: "group",
                  children: [
                    { Name: "ahwa_east", Layer: "Ahwa East" },
                    { Name: "chichigaontha", Layer: "Chichigaontha" },
                    { Name: "chikhali", Layer: "Chikhali" },
                    { Name: "galkund", Layer: "Galkund" },
                    { Name: "sakarpatal", Layer: "Sakarpatal" },
                    { Name: "shamghan", Layer: "Shamghan" },
                    { Name: "waghai", Layer: "Waghai" }
                  ]
                }
              ]
            },
            {
              title: "Valsad North Forest Division",
              type: "group",
              children: [
                { Name: "valsad_north_forest_division", Layer: "Valsad North Forest Division" },
                {
                  title: "Ranges",
                  type: "group",
                  children: [
                    { Name: "chikhali", Layer: "Chikhali" },
                    { Name: "dharampur", Layer: "Dharampur" },
                    { Name: "hanmatmal", Layer: "Hanmatmal" },
                    { Name: "pangarbari", Layer: "Pangarbari" },
                    { Name: "valsad", Layer: "Valsad" },
                    { Name: "vansda_east", Layer: "Vansda East" },
                    { Name: "vansda_west", Layer: "Vansda West" }
                  ]
                }
              ]
            },
            {
              title: "Valsad South Forest Division",
              type: "group",
              children: [
                { Name: "valsad_south_forest_division", Layer: "Valsad South Forest Division" },
                {
                  title: "Ranges",
                  type: "group",
                  children: [
                    { Name: "fatepur", Layer: "Fatepur" },
                    { Name: "kaprada", Layer: "Kaprada" },
                    { Name: "lavkar", Layer: "Lavkar" },
                    { Name: "nana_pondha", Layer: "Nana Pondha" },
                    { Name: "sanjan", Layer: "Sanjan" },
                    { Name: "vapi", Layer: "Vapi" }
                  ]
                }
              ]
            }
          ]
        }
      ]
    },
    {
      title: "Coupe Boundaries",
      type: "flat",
      children: [
        { Name: "baria_coupe", Layer: "Baria" },
        { Name: "bharuchsubdivision_coupe", Layer: "Bharuchsubdivision" },
        { Name: "godhara_coupe", Layer: "Godhara" },
        { Name: "junagadh_coupe", Layer: "Junagadh" },
        { Name: "surat_coupe", Layer: "Surat" },
        { Name: "vyara_coupe", Layer: "Vyara" },
        { Name: "banaskantha_coupe", Layer: "Banaskantha" },
        { Name: "bhavnagar_coupe", Layer: "Bhavnagar" },
        { Name: "chhotaudepur_coupe", Layer: "Chhotaudepur" },
        { Name: "gandhinagar_coupe", Layer: "Gandhinagar" },
        { Name: "jamnagar_coupe", Layer: "Jamnagar" },
        { Name: "morbi_coupe", Layer: "Morbi" },
        { Name: "narmada_coupe", Layer: "Narmada" },
        { Name: "sabarkantha_coupe", Layer: "Sabarkantha" },
        { Name: "aravalli_coupe", Layer: "Aravalli" },
        { Name: "surendranagar_coupe", Layer: "Surendranagar" },
      ]
    },
    
  ]
};

const text = {
  en: {
    exploreData: "Explore Data",
    coupesData: "NDVI Change",
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
    selectMonth: "Select Month for NDVI Change:",
    currentMonth: "Current Month:",
    legend: "Map Legend",
    noLayers: "No layers added",
    coupeLegend: "Coupe NDVI Change",
    showLegend: "Show Legend",
  hideLegend: "Hide Legend",
  clearAll: "Clear All"
  },
  gu: {
    exploreData: "ડેટા શોધો",
    coupesData: "NDVI Change",
    forestCoverChange: "વન આવરણમાં ફેરફાર",
    selectLayer: "લેયર પસંદ કરો:",
    selectBoundaries: "સીમા પસંદ કરો:",
    selectPatrollingIncident: "પેટ્રોલિંગ / ઘટના પસંద કરો:",
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
    selectMonth: "NDVI ફેરફાર માટે મહિનો પસંદ કરો:",
    currentMonth: "વર્તમાન મહિનો:",
    legend: "નકશા સમજૂતી",
    noLayers: "કોઈ લેયર ઉમેરાયા નથી",
    coupeLegend: "કૂપ NDVI ફેરફાર",
    showLegend: "સમજૂતી બતાવો",
  hideLegend: "સમજૂતી છુપાવો",
  clearAll: "બધું ક્લિયર કરો"
  },
};

// Component for Coupe Group with checkbox on the group title - FIXED
const CoupeGroupWithoutCheckbox = ({ 
  group, 
  groupId, 
  selection, 
  onMonthChange, 
  language, 
  addedLayers, 
  toggleLayer,
  openGroups,
  toggleGroup,
  layerManager,
  mapRef,
  setAddedLayers,
  setOpacity,
  setActiveCoupeGroups,
  getLayerBoundsFromAPI,
  setIsLayerLoading,
  getAvailableMonthsForCoupe
}) => {
  const isExpanded = openGroups[groupId] || false;
  const firstLayer = group.children[0];
  const baseName = firstLayer.baseName || firstLayer.Name;
  const availableMonths = getAvailableMonthsForCoupe(baseName);
  
  const monthNames = {
    en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    gu: ['જાન', 'ફેબ', 'માર્ચ', 'એપ્રિલ', 'મે', 'જૂન', 'જુલાઈ', 'ઑગસ્ટ', 'સપ્ટે', 'ઑક્ટો', 'નવે', 'ડિસે']
  };
  
  const months = monthNames[language] || monthNames.en;
  
  // Get unique years
  const availableYears = useMemo(() => {
    return [...new Set(availableMonths.map(item => item.year))].sort();
  }, [availableMonths]);

  // Find the first available month/year if current selection is invalid
  const validSelection = useMemo(() => {
    if (!selection) return { month: 0, year: availableYears[0] || 2025 };
    
    const isValid = availableMonths.some(m => 
      m.month === selection.month && m.year === selection.year
    );
    
    if (isValid) return selection;
    
    // Return first available month/year
    const firstAvailable = availableMonths[0];
    return firstAvailable 
      ? { month: firstAvailable.month, year: firstAvailable.year }
      : { month: 0, year: availableYears[0] || 2025 };
  }, [selection, availableMonths, availableYears]);

  // Get the layer name for the current selection
  const currentLayerName = useMemo(() => {
    const selectedMonthData = availableMonths.find(m => 
      m.month === validSelection.month && m.year === validSelection.year
    );
    return selectedMonthData?.layerName;
  }, [availableMonths, validSelection]);

  // Check if this group has any active layer
  const isChecked = useMemo(() => {
    return Object.keys(addedLayers).some(key => key.includes(`-${groupId}-`));
  }, [addedLayers, groupId]);

  // Get the currently active month/year for display
  const activeInfo = useMemo(() => {
    const activeKey = Object.keys(addedLayers).find(key => key.includes(`-${groupId}-`));
    if (!activeKey) return null;
    
    // Extract month and year from layer name
    const match = activeKey.match(/(\d{4})[_-](\d{2})/);
    if (match) {
      const year = parseInt(match[1]);
      const month = parseInt(match[2]) - 1;
      return { month, year };
    }
    return null;
  }, [addedLayers, groupId]);

  // Handle checkbox toggle
// In the handleGroupCheckbox function inside CoupeGroupWithoutCheckbox, update the zoom call:

// Handle checkbox toggle - with NDVI change layer bounds
const handleGroupCheckbox = useCallback(async (e) => {
  e.stopPropagation();

  console.log(`[handleGroupCheckbox] CLICKED — groupId="${groupId}", isChecked=${isChecked}, currentLayerName="${currentLayerName}"`);
  console.log(`[handleGroupCheckbox] group.title="${group.title}", validSelection=`, validSelection);
  console.log(`[handleGroupCheckbox] availableMonths=`, availableMonths);

  if (isChecked) {
    // Remove all layers from this group
    const keysToRemove = Object.keys(addedLayers).filter(key => key.includes(`-${groupId}-`));
    
    for (const key of keysToRemove) {
      const layer = addedLayers[key];
      if (layer && mapRef.current) {
        mapRef.current.removeLayer(layer);
        layer.off();
      }
    }
    
    // Update state
    setAddedLayers((prev) => {
      const newState = { ...prev };
      keysToRemove.forEach(key => delete newState[key]);
      return newState;
    });
    
    setOpacity((prev) => {
      const newState = { ...prev };
      keysToRemove.forEach(key => delete newState[key]);
      return newState;
    });
    
    setActiveCoupeGroups((prev) => ({
      ...prev,
      [groupId]: false
    }));
  } else {
    // Add the current layer
    if (!currentLayerName) {
      console.warn(`[handleGroupCheckbox] ⚠️ No currentLayerName — cannot add layer. validSelection=`, validSelection, 'availableMonths=', availableMonths);
      return;
    }

    console.log(`[handleGroupCheckbox] Adding layer "${currentLayerName}"...`);
    // Set loading to true BEFORE adding layer
    setIsLayerLoading(true);

    try {
      const layer = await layerManager.addLayer(
        currentLayerName,
        `${group.title} (${months[validSelection.month]} ${validSelection.year})`
      );
      console.log(`[handleGroupCheckbox] addLayer returned:`, layer);

      if (layer) {
        const newKey = `${currentLayerName}-${groupId}-0`;
        console.log(`[handleGroupCheckbox] ✅ Layer added with key "${newKey}"`);
        setAddedLayers((prev) => ({ ...prev, [newKey]: layer }));
        setOpacity((prev) => ({ ...prev, [newKey]: 1 }));
        layer.setOpacity(1);
        
        setActiveCoupeGroups((prev) => ({
          ...prev,
          [groupId]: true
        }));

        // Get bounds and zoom
        try {
          const bounds = await getLayerBoundsFromAPI(currentLayerName, true);
          
          if (bounds && mapRef.current) {
            const sw = L.latLng(bounds.minY, bounds.minX);
            const ne = L.latLng(bounds.maxY, bounds.maxX);
            const layerBounds = L.latLngBounds(sw, ne);
            
            // Create a promise that resolves when zoom animation completes
            await new Promise((resolve) => {
              const onZoomEnd = () => {
                mapRef.current.off('zoomend', onZoomEnd);
                // Add a small delay to ensure everything is rendered
                setTimeout(resolve, 300);
              };
              
              mapRef.current.on('zoomend', onZoomEnd);
              
              // Start the initial fitBounds animation
              mapRef.current.fitBounds(layerBounds, {
                padding: [50, 50],
                animate: true,
                duration: 1
              });
            });
            
          }
        } catch (error) {
          console.error('Error zooming to layer:', error);
        } finally {
          // Turn off loader ONLY after zoom animation is complete
          setIsLayerLoading(false);
        }
      }
    } catch (error) {
      console.error('Error adding layer:', error);
      setIsLayerLoading(false);
    }
  }
}, [isChecked, groupId, addedLayers, currentLayerName, group.title, validSelection, months, layerManager, mapRef, setAddedLayers, setOpacity, setActiveCoupeGroups, getLayerBoundsFromAPI]);

  return (
    <div className="layer-group flat-group coupe-group-no-checkbox">
      <button
        type="button"
        className="group-title"
        onClick={() => toggleGroup(groupId)}
        aria-expanded={isExpanded ? "true" : "false"}
      >
        <span className="group-title-content">
          {/* Checkbox for the group */}
          <input
            type="checkbox"
            checked={isChecked}
            onChange={handleGroupCheckbox}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.preventDefault()}
            style={{ marginRight: "8px", cursor: 'pointer' }}
          />
          {/* <MdLayers style={{ marginRight: "8px" }} /> */}
          {group.title}
          {isChecked && activeInfo && (
            <span className="active-indicator" style={{
              marginLeft: '8px',
              color: '#4CAF50',
              fontSize: '12px'
            }}>
              ● Active ({months[activeInfo.month]} {activeInfo.year})
            </span>
          )}
        </span>
        <span className="arrow-icon">
          {isExpanded ? <MdExpandLess /> : <MdExpandMore />}
        </span>
      </button>
      
      {isExpanded && (
        <div className="layer-list-wrapper expanded">
          <MonthRangeSelector
            onMonthSelect={(month, year) => onMonthChange(groupId, month, year)}
            selectedMonth={validSelection.month}
            selectedYear={validSelection.year}
            language={language}
            groupTitle={group.title}
            availableMonths={availableMonths}
          />
         
        </div>
      )}
    </div>
  );
};

const LayerTogglePanel = ({ mapRef, activeBasemap, setActiveBasemap, activeToolSidebar, isInfoToolActive, setIsInfoToolActive   }) => {
  const { language } = useLanguage();
  const [addedLayers, setAddedLayers] = useState({});
  const [opacity, setOpacity] = useState({});
  const [openGroups, setOpenGroups] = useState({});
  const [isLayerLoading, setIsLayerLoading] = useState(false);
  const [clickPosition, setClickPosition] = useState(null);
  const [attributeData, setAttributeData] = useState(null);
  const [showAttributeTable, setShowAttributeTable] = useState(false);
  const [isCoupesDataOpen, setIsCoupesDataOpen] = useState(false);
  const [groupMonths, setGroupMonths] = useState({});
  const [activeCoupeGroups, setActiveCoupeGroups] = useState({});
  const [availableCoupeLayers, setAvailableCoupeLayers] = useState([]);
  const [coupeGroups, setCoupeGroups] = useState([]);
  const [adminCoupeBoundaryLayers, setAdminCoupeBoundaryLayers] = useState([]);
  const [isLoadingCoupes, setIsLoadingCoupes] = useState(false);
  // Add state for legend visibility
  const [isLegendVisible, setIsLegendVisible] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  const layerCounterRef = useRef(0);
  const clickHandlerRef = useRef(null);
  const layersInfoCache = useRef(new Map());

  const [groupSelections, setGroupSelections] = useState({});

  // Fetch available NDVI change layers from API
  useEffect(() => {
    const fetchNDVIChangeLayers = async () => {
      setIsLoadingCoupes(true);
      try {
        const response = await fetch(`${API_BASE_URL}/api/ndvi-change-tables`);
        if (!response.ok) throw new Error('Failed to fetch NDVI change layers');
        
        const result = await response.json();
        if (result.success && result.data) {
          setAvailableCoupeLayers(result.data);
          
          // Generate coupe groups from the available layers
          generateCoupeGroups(result.data);
        }
      } catch (error) {
        console.error('Error fetching NDVI change layers:', error);
      } finally {
        setIsLoadingCoupes(false);
      }
    };

    fetchNDVIChangeLayers();
  }, []);

  useEffect(() => {
    const fetchAdminCoupeBoundaries = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await fetch(`${API_BASE_URL}/api/admincoupes`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!response.ok) throw new Error('Failed to fetch uploaded coupe boundaries');

        const result = await response.json();
        const dynamicLayers = (result.data || [])
          .map((item) => item.coupe_name)
          .filter(Boolean)
          .map((tableName) => {
            const cleanName = tableName.replace(/^Recap4NDC:/, '');
            const label = cleanName
              .replace(/_table$/i, '')
              .replace(/_coupe$/i, '')
              .replace(/_/g, ' ')
              .replace(/\b\w/g, (char) => char.toUpperCase());

            return {
              Name: cleanName,
              Layer: label,
              wmsLayer: `Recap4NDC:${cleanName}`,
            };
          });

        setAdminCoupeBoundaryLayers(dynamicLayers);
      } catch (error) {
        console.error('Error fetching uploaded coupe boundaries:', error);
      }
    };

    fetchAdminCoupeBoundaries();
  }, []);

  // Merge dynamic admin-uploaded coupe boundary layers into the static "Coupe Boundaries" group
  const mergedGroups = useMemo(() => {
    if (!adminCoupeBoundaryLayers.length) return layersData.groups;

    return layersData.groups.map((group) => {
      if (group.title !== "Coupe Boundaries") return group;

      const existingNames = new Set(
        (group.children || []).map((c) => (c.Name || "").toLowerCase())
      );

      const dynamicChildren = adminCoupeBoundaryLayers.filter(
        (layer) => !existingNames.has((layer.Name || "").toLowerCase())
      );

      return {
        ...group,
        children: [...(group.children || []), ...dynamicChildren],
      };
    });
  }, [adminCoupeBoundaryLayers]);

  // Initialize open groups for nested structure
  useEffect(() => {
    const initialOpenState = {};
    
    const initializeNestedGroups = (groups, prefix = '') => {
      groups.forEach((group, index) => {
        const groupId = prefix ? `${prefix}-${index}` : `layers-${index}`;
        initialOpenState[groupId] = false;
        
        if (group.type === "nested" && group.children) {
          initializeNestedGroups(group.children, groupId);
        } else if (group.type === "group" && group.children) {
          initializeNestedGroups(group.children, groupId);
        }
      });
    };
    
    initializeNestedGroups(mergedGroups);
    
    setOpenGroups(initialOpenState);
  }, [mergedGroups]);

// Generate coupe groups dynamically from available layers
const generateCoupeGroups = (layers) => {
  // Extract unique coupe names from layer names
  const coupeNames = new Set();
  
  layers.forEach(layerName => {
    // Try multiple patterns to extract coupe name
    let match = null;
    
    // Pattern with hyphens: YYYY-MM-DD_coupename_coupe_NDVI_Change
    match = layerName.match(/\d{4}-\d{2}-\d{2}_([a-zA-Z_]+?)(?:_coupe_NDVI_Change|$)/);
    
    // Pattern with underscores: YYYY_MM_DD_coupename_coupe_NDVI_Change
    if (!match) {
      match = layerName.match(/\d{4}_\d{2}_\d{2}_([a-zA-Z_]+?)_coupe_NDVI_Change/);
    }
    
    if (match && match[1]) {
      // Clean up the name
      let coupeName = match[1].replace(/_/g, ' ');
      // Capitalize first letter of each word
      coupeName = coupeName.split(' ').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      ).join(' ');
      
      coupeNames.add(coupeName);
    }
  });

  // Convert to array and sort
  const sortedCoupeNames = Array.from(coupeNames).sort();

  // Filter out superseded coupe names
  const filteredCoupeNames = sortedCoupeNames.filter(name => {
    if (name === 'Bharuch' && sortedCoupeNames.includes('Bharuchsubdivision')) return false;
    return true;
  });

  // Generate coupe groups
  const generatedGroups = filteredCoupeNames.map((coupeName, index) => {
    // Create a base name for the coupe (lowercase, underscores)
    const baseName = coupeName.toLowerCase().replace(/\s+/g, '_');
    
    return {
      title: coupeName,
      type: "flat",
      children: [
        { 
          Name: baseName, 
          Layer: coupeName,
          baseName: baseName // Store for layer generation
        }
      ]
    };
  });

  setCoupeGroups(generatedGroups);

  // Initialize group months and active states for new groups
  const initialGroupMonths = {};
  const initialActiveGroups = {};
  const initialSelections = {}; // Moved outside the loop
  
  generatedGroups.forEach((_, idx) => {
    const groupId = `coupes-${idx}`;
    initialGroupMonths[groupId] = 0; // Default to January
    initialActiveGroups[groupId] = false;
    initialSelections[groupId] = { month: 0, year: 2025 }; // Default to Jan 2025
  });

  setGroupMonths(prev => ({ ...prev, ...initialGroupMonths }));
  setActiveCoupeGroups(prev => ({ ...prev, ...initialActiveGroups }));
  setGroupSelections(prev => ({ ...prev, ...initialSelections }));
  
};

  // Get available months for a specific coupe
// Get available months for a specific coupe
const getAvailableMonthsForCoupe = useCallback((baseName) => {
  const months = [];
  
  availableCoupeLayers.forEach(layerName => {
    // Try multiple regex patterns to match different formats
    let match = null;
    
    // Pattern 1: YYYY-MM-DD_coupename_coupe_NDVI_Change (with hyphens)
    match = layerName.match(/(\d{4})-(\d{2})-\d{2}_([a-zA-Z_]+?)(?:_coupe_NDVI_Change|$)/);
    
    // Pattern 2: YYYY_MM_DD_coupename_coupe_NDVI_Change (with underscores)
    if (!match) {
      match = layerName.match(/(\d{4})_(\d{2})_\d{2}_([a-zA-Z_]+?)(?:_coupe_NDVI_Change|$)/);
    }
    
    // Pattern 3: Handle the specific case from your data "2026_01_01_bhavnagar_coupe_NDVI_Change"
    if (!match) {
      match = layerName.match(/(\d{4})_(\d{2})_\d{2}_([a-zA-Z_]+?)_coupe_NDVI_Change/);
    }
    
    if (match) {
      const year = parseInt(match[1]);
      const month = parseInt(match[2]) - 1; // Convert to 0-based index
      const coupeNameFromLayer = match[3];
      
      // Check if this coupe name matches our baseName (case insensitive)
      if (coupeNameFromLayer.toLowerCase() === baseName.toLowerCase() ||
          coupeNameFromLayer.replace(/_/g, '').toLowerCase() === baseName.replace(/_/g, '').toLowerCase()) {
        months.push({
          year: year,
          month: month,
          layerName: layerName
        });
      }
    }
  });

  // Sort by year and month
  return months.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.month - b.month;
  });
}, [availableCoupeLayers]);

  const getLegendUrl = (layerName) => {
    // Determine the correct workspace for the legend request
    let legendLayer = layerName;
    if (!layerName.includes(':')) {
      if (/^\d{4}[_-]/.test(layerName)) {
        legendLayer = `Recap4NDC:${layerName}`;
      } else {
        legendLayer = `cite:${layerName}`;
      }
    }
    return `${GEOSERVER_WMS}?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&WIDTH=20&HEIGHT=20&LAYER=${legendLayer}`;
  };

  const getFeatureInfo = useCallback(async (latlng, layerName) => {
    const map = mapRef.current;
    if (!map) return null;
    
    const cacheKey = `${layerName}-${latlng.lat.toFixed(6)}-${latlng.lng.toFixed(6)}`;
    
    // Check cache first
    if (layersInfoCache.current.has(cacheKey)) {
      return layersInfoCache.current.get(cacheKey);
    }

    try {
      const bounds = map.getBounds();
      const size = map.getSize();
      const point = map.latLngToContainerPoint(latlng);

      // Determine the correct WMS layer name with workspace prefix
      let wmsLayerName = layerName;
      if (!layerName.includes(':')) {
        if (/^\d{4}[_-]/.test(layerName)) {
          wmsLayerName = `Recap4NDC:${layerName}`;
        } else {
          wmsLayerName = `cite:${layerName}`;
        }
      }

      const params = new URLSearchParams({
        REQUEST: 'GetFeatureInfo',
        SERVICE: 'WMS',
        VERSION: '1.1.1',
        LAYERS: wmsLayerName,
        STYLES: '',
        SRS: 'EPSG:4326',
        BBOX: `${bounds.getSouthWest().lng},${bounds.getSouthWest().lat},${bounds.getNorthEast().lng},${bounds.getNorthEast().lat}`,
        WIDTH: size.x,
        HEIGHT: size.y,
        QUERY_LAYERS: wmsLayerName,
        INFO_FORMAT: 'application/json',
        X: Math.round(point.x),
        Y: Math.round(point.y),
        FEATURE_COUNT: 10,
        BUFFER: 10
      });

      const url = `${GEOSERVER_WMS}?${params.toString()}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.features && data.features.length > 0) {
        const combinedProperties = {};
        
        data.features.forEach((feature, index) => {
          if (feature.properties) {
            Object.entries(feature.properties).forEach(([key, value]) => {
              if (key !== 'geometry' && value !== null && value !== undefined) {
                const prefixedKey = `${key}`;
                combinedProperties[prefixedKey] = value;
              }
            });
          }
        });

        if (data.features[0]?.geometry) {
          combinedProperties.geometry = data.features[0].geometry;
        }

        layersInfoCache.current.set(cacheKey, combinedProperties);
        return combinedProperties;
      }
      
      return null;
    } catch (error) {
      console.error(`Error fetching feature info for ${layerName}:`, error);
      return null;
    }
  }, [mapRef]);

  // Map click handler for info tool
  // Update the handleMapClick function in LayerTogglePanel.js
const handleMapClick = useCallback(async (e) => {
  if (!isInfoToolActive || !mapRef.current) return;
  
  // Prevent duplicate clicks
  if (clickHandlerRef.current?.isProcessing) return;
  
  const { latlng } = e;
  const containerPoint = mapRef.current.latLngToContainerPoint(latlng);
  
  // Set processing flag
  if (clickHandlerRef.current) {
    clickHandlerRef.current.isProcessing = true;
  }
  
  // Get all visible layers
  const visibleLayers = Object.values(addedLayers);
  if (visibleLayers.length === 0) {
    setAttributeData({ 
      message: "No visible layers to query.",
      coordinates: `Lat: ${latlng.lat.toFixed(6)}, Lng: ${latlng.lng.toFixed(6)}`
    });
    setClickPosition({ x: containerPoint.x, y: containerPoint.y });
    
    // Reset processing flag after delay
    setTimeout(() => {
      if (clickHandlerRef.current) {
        clickHandlerRef.current.isProcessing = false;
      }
    }, 500);
    return;
  }

  // Query each visible layer
  const queries = visibleLayers.map(async (layer) => {
    const layerName = layer._metadata?.name;
    if (!layerName) return null;
    
    const featureInfo = await getFeatureInfo(latlng, layerName);
    if (featureInfo) {
      return {
        layerName: layer._metadata?.label || layerName,
        data: featureInfo
      };
    }
    return null;
  });

  try {
    const results = await Promise.all(queries);
    const validResults = results.filter(result => result !== null);
    
    if (validResults.length === 0) {
      setAttributeData({ 
        message: "No data found at this location.",
        coordinates: `Lat: ${latlng.lat.toFixed(6)}, Lng: ${latlng.lng.toFixed(6)}`
      });
    } else {
      // Combine all results
      const combinedData = {};
      
      combinedData.coordinates = `Lat: ${latlng.lat.toFixed(6)}, Lng: ${latlng.lng.toFixed(6)}`;
      
      validResults.forEach((result, index) => {
        const layerKey = `layer_${index + 1}`;
        combinedData[`${layerKey}_name`] = result.layerName;
        
        Object.entries(result.data).forEach(([key, value]) => {
          if (key !== 'geometry') {
            combinedData[`${layerKey}_${key}`] = value;
          }
        });
        
        if (result.data.geometry) {
          combinedData[`${layerKey}_geometry`] = JSON.stringify(result.data.geometry.coordinates);
        }
      });
      
      setAttributeData(combinedData);
    }
    
    setClickPosition({ x: containerPoint.x, y: containerPoint.y });
  } catch (error) {
    console.error('Error querying layers:', error);
    setAttributeData({ 
      error: "Failed to query layers. Please try again.",
      coordinates: `Lat: ${latlng.lat.toFixed(6)}, Lng: ${latlng.lng.toFixed(6)}`
    });
    setClickPosition({ x: containerPoint.x, y: containerPoint.y });
  } finally {
    // Reset processing flag after delay
    setTimeout(() => {
      if (clickHandlerRef.current) {
        clickHandlerRef.current.isProcessing = false;
      }
    }, 500);
  }
}, [isInfoToolActive, mapRef, addedLayers, getFeatureInfo]);

  // Setup map click handler
  useEffect(() => {
    if (!mapRef.current) return;

    const setupClickHandler = () => {
      if (isInfoToolActive && !clickHandlerRef.current) {
        clickHandlerRef.current = (e) => {
          handleMapClick(e);
        };
        mapRef.current.on('click', clickHandlerRef.current);
      } else if (!isInfoToolActive && clickHandlerRef.current) {
        mapRef.current.off('click', clickHandlerRef.current);
        clickHandlerRef.current = null;
        
        // Close any open popup when info tool is deactivated
        if (attributeData || clickPosition) {
          setAttributeData(null);
          setClickPosition(null);
        }
      }
    };

    setupClickHandler();

    // Cleanup on unmount
    return () => {
      if (clickHandlerRef.current && mapRef.current) {
        mapRef.current.off('click', clickHandlerRef.current);
      }
    };
  }, [isInfoToolActive, mapRef.current, handleMapClick, attributeData, clickPosition]);

  const getLayerTitle = (layerName) => {
    // First, check in regular layers
    const findInLayers = (groups) => {
      for (const group of groups) {
        if (group.children) {
          for (const child of group.children) {
            if (child.Name === layerName) {
              return child.Layer;
            }
            if (child.children) {
              const found = findInLayers([child]);
              if (found) return found;
            }
          }
        } else if (group.Name === layerName) {
          return group.Layer;
        }
      }
      return null;
    };
    
    const layerTitle = findInLayers(mergedGroups);
    if (layerTitle) return layerTitle;
    
    // If not found in regular layers, check in dynamic coupe layers
    const match = layerName.match(/\d{4}-\d{2}-\d{2}_([a-zA-Z_]+?)(?:_coupe_NDVI_Change|$)/);
    if (match && match[1]) {
      return match[1].replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    
    return layerName;
  };

  const calculateZIndex = () => {
    layerCounterRef.current += 1;
    return 1000 + layerCounterRef.current;
  };

  const createLayer = (layerName, layerLabel, zIndex, wmsLayerName) => {
    try {
      // Determine the correct WMS layer name with workspace prefix
      let wmsLayers = wmsLayerName || layerName;

      // If no explicit wmsLayerName, add the appropriate workspace prefix
      if (!wmsLayerName) {
        if (/^\d{4}[_-]/.test(layerName)) {
          // NDVI change layers (e.g. "2026-07-01_bhavnagar_coupe_NDVI_Change") are in Recap4NDC workspace
          wmsLayers = `Recap4NDC:${layerName}`;
        } else {
          // Static boundary layers (e.g. "Gujarat_district") are in cite workspace
          wmsLayers = `cite:${layerName}`;
        }
      }

      console.log(`[createLayer] layerName="${layerName}", wmsLayers="${wmsLayers}", GEOSERVER_WMS="${GEOSERVER_WMS}", zIndex=${zIndex}`);

      // Use standard Leaflet tileLayer.wms (built-in, reliable, used by GeoDashboard)
      // instead of nonTiledLayer which makes a single large image request that can fail
      const layer = L.tileLayer.wms(GEOSERVER_WMS, {
        layers: wmsLayers,
        format: "image/png",
        transparent: true,
        version: "1.1.0",
        tileSize: 512,
        zIndex: zIndex || 1000,
        // Log every tile URL so we can see exactly what's being requested
        detectRetina: false
      });

      // Log the full WMS URL template that Leaflet will use for tiles
      console.log(`[createLayer] WMS base URL: ${GEOSERVER_WMS}`);
      console.log(`[createLayer] Full layer config:`, { layers: wmsLayers, format: "image/png", transparent: true, version: "1.1.0", tileSize: 512 });

      return layer;
    } catch (error) {
      console.error(`[createLayer] Error creating layer ${layerName}:`, error);
      return null;
    }
  };

const layerManager = {
  addLayer: async (layerName, layerLabel, wmsLayerName) => {
    if (!mapRef.current) {
      console.error("[addLayer] Map reference not initialized.");
      return null;
    }

    try {
      const zIndex = calculateZIndex();
      console.log(`[addLayer] START — layerName="${layerName}", label="${layerLabel}", wmsLayerName="${wmsLayerName}", zIndex=${zIndex}`);
      const newLayer = createLayer(layerName, layerLabel, zIndex, wmsLayerName);
      if (!newLayer) throw new Error("Layer creation failed");

      console.log(`[addLayer] Layer object created, adding to map...`);
      newLayer.addTo(mapRef.current);
      console.log(`[addLayer] Layer added to map. Map has layer: ${mapRef.current.hasLayer(newLayer)}`);

      newLayer._metadata = {
        name: layerName,
        label: layerLabel
      };
      
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.warn(`[addLayer] ⚠️ Timeout while loading "${layerName}" (15s) — layer may not have rendered`);
          resolve(newLayer);
        }, 15000);

        newLayer.on("load", () => {
          console.log(`[addLayer] ✅ Layer "${layerName}" loaded successfully`);
          clearTimeout(timeout);
          resolve(newLayer);
        });

        newLayer.on("tileload", (e) => {
          console.log(`[addLayer] 🟢 tileload "${layerName}" — tile URL:`, e?.coords, e?.url || '(no url)');
        });

        newLayer.on("tileerror", (error) => {
          console.error(`[addLayer] 🔴 tileerror in "${layerName}":`, {
            error: error?.error || error,
            tile: error?.tile,
            coords: error?.coords,
            url: error?.url || error?.tile?.src || '(no url)'
          });
          clearTimeout(timeout);
          resolve(newLayer);
        });

        newLayer.on("tileabort", (error) => {
          console.warn(`[addLayer] 🟡 tileabort in "${layerName}":`, error);
        });
      });
    } catch (error) {
      console.error("[addLayer] Error adding layer:", error);
      throw error;
    }
  },

  removeLayer: async (layerName) => {
    // Find all layers with this name (there should only be one, but just in case)
    const layersToRemove = Object.values(addedLayers).filter(
      layer => layer._metadata?.name === layerName
    );
    
    if (layersToRemove.length > 0 && mapRef.current) {
      for (const layer of layersToRemove) {
        if (mapRef.current.hasLayer(layer)) {
          mapRef.current.removeLayer(layer);
        }
        layer.off(); // Remove all event listeners
      }
      return Promise.resolve(true);
    }
    return Promise.resolve(false);
  },
  
  setLayerOpacity: (uniqueKey, opacityValue) => {
    const layer = addedLayers[uniqueKey];
    if (layer && mapRef.current?.hasLayer(layer)) {
      layer.setOpacity(opacityValue);
    }
  },
};

const clearAllLayers = useCallback(async () => {
  try {
    // Set loading state if you have one
    setIsLayerLoading(true);
    
    // Clear cache
    layersInfoCache.current.clear();
    
    // Get all unique layer names to remove (to avoid duplicate removal attempts)
    const layersToRemove = new Set();
    Object.values(addedLayers).forEach(layer => {
      if (layer && layer._metadata?.name) {
        layersToRemove.add(layer._metadata.name);
      }
    });

    // Remove each unique layer from the map
    const removePromises = Array.from(layersToRemove).map(async (layerName) => {
      if (mapRef.current) {
        // Find all layers with this name and remove them
        const layersToRemove = Object.values(addedLayers).filter(
          layer => layer._metadata?.name === layerName
        );
        
        layersToRemove.forEach(layer => {
          if (mapRef.current.hasLayer(layer)) {
            mapRef.current.removeLayer(layer);
          }
          layer.off(); // Remove all event listeners
        });
      }
    });
    
    await Promise.all(removePromises);
    
    // Clear all states
    setAddedLayers({});
    setOpacity({});
    
    // Reset coupe-related states
    const resetSelections = {};
    const resetActiveGroups = {};
    
    coupeGroups.forEach((_, idx) => {
      const groupId = `coupes-${idx}`;
      resetSelections[groupId] = { month: 0, year: 2025 };
      resetActiveGroups[groupId] = false;
    });
    
    setGroupSelections(resetSelections);
    setActiveCoupeGroups(resetActiveGroups);
    
  } catch (error) {
    console.error("Error clearing all layers:", error);
  } finally {
    setIsLayerLoading(false);
  }
}, [addedLayers, mapRef, coupeGroups]);

// Add this function to LayerTogglePanel.js - Modified to handle NDVI change layers separately
// Add this function to LayerTogglePanel.js - FIXED to handle your API response format
const getLayerBoundsFromAPI = useCallback(async (layerName, isNdviChangeLayer = false) => {
  try {
    const cleanLayerName = layerName.replace(/^cite:/, '');
    
    // Use different API endpoint for NDVI change layers
    const apiEndpoint = isNdviChangeLayer 
      ? `${API_BASE_URL}/api/ndvi-change-layer-bounds/${cleanLayerName}`
      : `${API_BASE_URL}/api/layer-bounds/${cleanLayerName}`;
    
    const response = await fetch(apiEndpoint);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    // Handle your API response format (direct bounds object, not wrapped in success.data)
    if (result && result.minX !== undefined && result.minY !== undefined && 
        result.maxX !== undefined && result.maxY !== undefined) {
      return {
        minX: result.minX,
        minY: result.minY,
        maxX: result.maxX,
        maxY: result.maxY
      };
    }
    
    // If we get here, no valid bounds were found
    console.warn('No valid bounds found in response:', result);
    return null;
  } catch (error) {
    console.error('Error fetching layer bounds:', error);
    return null;
  }
}, []);

const toggleLayer = useCallback(
  async (layerConfig, groupId) => {
    const uniqueKey = `${layerConfig.Name}-${groupId}`;
    console.log(`[toggleLayer] CLICKED — Name="${layerConfig.Name}", Layer="${layerConfig.Layer}", wmsLayer="${layerConfig.wmsLayer}", groupId="${groupId}", uniqueKey="${uniqueKey}"`);
    console.log(`[toggleLayer] layerConfig:`, layerConfig);
    console.log(`[toggleLayer] Already added? ${!!addedLayers[uniqueKey]}`);

    try {
      if (addedLayers[uniqueKey]) {
        // Remove the layer
        console.log(`[toggleLayer] Removing layer "${layerConfig.Name}"...`);
        await layerManager.removeLayer(layerConfig.Name);
        setAddedLayers((prev) => {
          const { [uniqueKey]: removedLayer, ...rest } = prev;
          return rest;
        });
        setOpacity((prev) => {
          const { [uniqueKey]: removedOpacity, ...rest } = prev;
          return rest;
        });
      } else {
        // Set loading to true BEFORE adding layer
        console.log(`[toggleLayer] Adding new layer...`);
        setIsLayerLoading(true);

        // Add the new layer
        const layer = await layerManager.addLayer(layerConfig.Name, layerConfig.Layer, layerConfig.wmsLayer);
        if (!layer) {
          setIsLayerLoading(false); // Turn off loading if layer addition fails
          throw new Error(`Failed to add layer: ${layerConfig.Name}`);
        }

        const layerOpacity = 1;
        setAddedLayers((prev) => ({ ...prev, [uniqueKey]: layer }));
        setOpacity((prev) => ({ ...prev, [uniqueKey]: layerOpacity }));
        layer.setOpacity(layerOpacity);

        // Determine if this is an NDVI change layer
        const isNdviChangeLayer = layerConfig.Name.includes('NDVI_Change') ||
                                  layerConfig.Name.includes('coupe_NDVI_Change');
        console.log(`[toggleLayer] isNdviChangeLayer=${isNdviChangeLayer} for "${layerConfig.Name}"`);

        // Get bounds from API and zoom
        try {
          console.log(`[toggleLayer] Fetching bounds for "${layerConfig.Name}"...`);
          const bounds = await getLayerBoundsFromAPI(layerConfig.Name, isNdviChangeLayer);
          console.log(`[toggleLayer] Bounds received:`, bounds);

          if (bounds && mapRef.current) {
            const sw = L.latLng(bounds.minY, bounds.minX);
            const ne = L.latLng(bounds.maxY, bounds.maxX);
            const layerBounds = L.latLngBounds(sw, ne);

            // Create a promise that resolves when zoom animation completes
            await new Promise((resolve) => {
              const onZoomEnd = () => {
                mapRef.current.off('zoomend', onZoomEnd);
                // Add a small delay to ensure everything is rendered
                setTimeout(resolve, 300);
              };

              mapRef.current.on('zoomend', onZoomEnd);

              // Start the initial fitBounds animation
              mapRef.current.fitBounds(layerBounds, {
                padding: [50, 50],
                animate: true,
                duration: 1
              });
            });

          }
        } catch (error) {
          console.error(`❌ Error zooming to layer ${layerConfig.Name}:`, error);
        } finally {
          // Turn off loader ONLY after zoom animation is complete
          setIsLayerLoading(false);
        }
      }
    } catch (err) {
      console.error(`❌ Layer toggle failed for ${layerConfig.Name}:`, err);
      setIsLayerLoading(false);
    }
  },
  [addedLayers, layerManager, mapRef, getLayerBoundsFromAPI]
);


  const toggleGroup = useCallback((groupId) => {
    setOpenGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  }, []);

  const handleOpacityChange = useCallback(
    (e, uniqueKey) => {
      const newOpacity = parseFloat(e.target.value);
      setOpacity((prev) => ({ ...prev, [uniqueKey]: newOpacity }));
      
      const layer = addedLayers[uniqueKey];
      if (layer) {
        layer.setOpacity(newOpacity);
      }
    },
    [addedLayers]
  );
// Handle month change for coupe groups - FIXED with proper loader timing
const handleGroupMonthChange = useCallback(async (groupId, month, year) => {
  const prevSelection = groupSelections[groupId];

  // Update the selection state
  setGroupSelections((prev) => ({
    ...prev,
    [groupId]: { month, year }
  }));

  const groupIndex = parseInt(groupId.split('-')[1]);
  const group = coupeGroups[groupIndex];
  if (!group || !group.children || group.children.length === 0) return;

  const firstLayer = group.children[0];
  const baseName = firstLayer.baseName || firstLayer.Name;

  // Get available layers for this coupe
  const availableMonths = getAvailableMonthsForCoupe(baseName);

  // Find the layer name for the selected month and year
  const selectedMonthData = availableMonths.find(m => m.month === month && m.year === year);
  if (!selectedMonthData) {
    console.warn(`No layer available for ${month + 1}/${year} for coupe ${baseName}`);
    return;
  }

  const newMonthlyLayerName = selectedMonthData.layerName;

  // Check if this group has any active layer
  const hasActiveLayer = Object.keys(addedLayers).some(key => key.includes(`-${groupId}-`));

  // If the group has an active layer, we need to update it
  if (hasActiveLayer) {
    // Find the old layer key
    const oldLayerKey = Object.keys(addedLayers).find(key => key.includes(`-${groupId}-`));

    // Set loading to true before updating
    setIsLayerLoading(true);

    try {
      // Remove the old layer
      if (oldLayerKey) {
        const oldLayer = addedLayers[oldLayerKey];
        if (oldLayer && mapRef.current) {
          mapRef.current.removeLayer(oldLayer);
          oldLayer.off();
        }

        setAddedLayers((prev) => {
          const { [oldLayerKey]: removed, ...rest } = prev;
          return rest;
        });

        setOpacity((prev) => {
          const { [oldLayerKey]: removed, ...rest } = prev;
          return rest;
        });
      }

      // Add the new layer
      const layer = await layerManager.addLayer(newMonthlyLayerName, group.title);

      if (layer) {
        const newKey = `${newMonthlyLayerName}-${groupId}-0`;
        setAddedLayers((prev) => ({ ...prev, [newKey]: layer }));
        setOpacity((prev) => ({ ...prev, [newKey]: 1 }));
        layer.setOpacity(1);

        setActiveCoupeGroups((prev) => ({
          ...prev,
          [groupId]: true
        }));

        // Zoom to bounds with loader
        try {
          const bounds = await getLayerBoundsFromAPI(newMonthlyLayerName, true);

          if (bounds && mapRef.current) {
            const sw = L.latLng(bounds.minY, bounds.minX);
            const ne = L.latLng(bounds.maxY, bounds.maxX);
            const layerBounds = L.latLngBounds(sw, ne);

            // Create a promise that resolves when zoom animation completes
            await new Promise((resolve) => {
              const onZoomEnd = () => {
                mapRef.current.off('zoomend', onZoomEnd);
                // Add a small delay to ensure everything is rendered
                setTimeout(resolve, 300);
              };

              mapRef.current.on('zoomend', onZoomEnd);

              // Start the initial fitBounds animation
              mapRef.current.fitBounds(layerBounds, {
                padding: [50, 50],
                animate: true,
                duration: 1
              });
            });

          }
        } catch (error) {
          console.error('Error zooming to layer:', error);
        } finally {
          // Turn off loader ONLY after zoom animation is complete
          setIsLayerLoading(false);
        }
      }
    } catch (error) {
      console.error('Error updating layer for month change:', error);
      setIsLayerLoading(false);
    }
  }
}, [coupeGroups, getAvailableMonthsForCoupe, layerManager, mapRef, groupSelections, addedLayers, getLayerBoundsFromAPI]);






  // Render groups based on type
// Render groups based on type - FIXED
const renderGroup = (group, index, section = "layers") => {
  const groupId = `${section}-${index}`;
  
  if (section === "coupes") {
    return (
      <CoupeGroupWithoutCheckbox
        key={groupId}
        group={group}
        groupId={groupId}
        selection={groupSelections[groupId] || { month: 0, year: 2025 }}
        onMonthChange={handleGroupMonthChange}
        language={language}
        addedLayers={addedLayers}
        toggleLayer={toggleLayer}
        openGroups={openGroups}
        toggleGroup={toggleGroup}
        layerManager={layerManager}
        mapRef={mapRef}
        setAddedLayers={setAddedLayers}
        setOpacity={setOpacity}
        setActiveCoupeGroups={setActiveCoupeGroups}
        getLayerBoundsFromAPI={getLayerBoundsFromAPI}
        setIsLayerLoading={setIsLayerLoading} 
        getAvailableMonthsForCoupe={getAvailableMonthsForCoupe}
      />
    );
  }
  
  if (group.type === "nested" || group.type === "group") {
    return (
      <NestedLayerGroup
        key={groupId}
        group={group}
        groupId={groupId}
        addedLayers={addedLayers}
        toggleLayer={toggleLayer}
        opacity={opacity}
        handleOpacityChange={handleOpacityChange}
        openGroups={openGroups}
        toggleGroup={toggleGroup}
        isLayerLoading={isLayerLoading}
        nestingLevel={0}
        language={language}
      />
    );
  } else {
    // Flat group for regular layers
    return (
      <div key={groupId} className="layer-group flat-group">
        <div role="button" tabIndex={0}
          className="group-title"
          onClick={() => toggleGroup(groupId)}
          aria-expanded={openGroups[groupId] ? "true" : "false"}
        >
          <span className="group-title-content" style={{ display: 'flex', alignItems: 'center' }}>
            {getGroupIcon(group.title)}
            <span style={{ fontWeight: 600, color: '#111' }}>{group.title}</span>
            {group.children && (
              <span className="badge" style={{ marginLeft: '8px', background: '#e8f5e9', color: '#2e7d32', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}>
                {group.children.length}
              </span>
            )}
          </span>
          <span className="arrow-icon">
            {openGroups[groupId] ? <MdExpandLess /> : <MdExpandMore />}
          </span>
        </div>
        
        {openGroups[groupId] && (
          <div className="layer-list-wrapper expanded">
            {group.children && group.children.map((layer, layerIndex) => {
              const uniqueKey = `${layer.Name}-${groupId}-${layerIndex}`;
              const isChecked = !!addedLayers[uniqueKey];
              
              return (
                <div key={`${uniqueKey}`} className={`layer-item ${isChecked ? "active" : ""}`}>
                  <label className="layer-label-container">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleLayer(layer, `${groupId}-${layerIndex}`)}
                    />
                    <span className={`layer-label ${isChecked ? "layer-label-bold" : ""}`}>
                      {layer.Layer}
                    </span>
                  </label>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }
};

  // Legend Component
  const LegendPanel = () => {
    const activeLayers = Object.keys(addedLayers);
    
    if (activeLayers.length === 0) {
      return (
        <div className="legend-panel">
          <h4 className="legend-title">{text[language].legend}</h4>
          <div className="legend-empty">
            <h6 style={{margin: "10px"}}>{text[language].noLayers}</h6>
          </div>
        </div>
      );
    }

    return (
      <div className="legend-panel">
        <h4 className="legend-title">{text[language].legend}</h4>
        <div className="legend-items-container">
          {activeLayers.map((layerKey) => {
            const layer = addedLayers[layerKey];
            if (!layer) return null;
            
            const layerName = layer._metadata?.name || layerKey.split('-')[0];
            const layerTitle = getLayerTitle(layerName);
            
            // Check if this is a coupe layer
            const isCoupeLayer = layerName.includes('coupe_NDVI_Change') || layerName.includes('2025-');
            
            // Extract month and year from layer name if it's a coupe layer
            let monthDisplay = '';
            let yearDisplay = '';
            if (isCoupeLayer) {
              const match = layerName.match(/(\d{4})-(\d{2})-\d{2}/);
              if (match && match[1] && match[2]) {
                const year = match[1];
                const monthNum = parseInt(match[2]) - 1;
                const months = language === 'en' 
                  ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
                  : ['જાન', 'ફેબ', 'માર્ચ', 'એપ્રિલ', 'મે', 'જૂન', 'જુલાઈ', 'ઑગસ્ટ', 'સપ્ટે', 'ઑક્ટો', 'નવે', 'ડિસે'];
                monthDisplay = ` (${months[monthNum]}`;
                yearDisplay = ` ${year})`;
              }
            }
            
            return (
              <div key={layerKey} className="legend-item">
                <h5 className="legend-layer-title">
                  {layerTitle}
                  {monthDisplay && <span className="legend-month-badge">{monthDisplay}{yearDisplay}</span>}
                </h5>
                <div className="legend-image-container">
                  <img
                    src={getLegendUrl(layerName)}
                    alt={`${layerTitle} legend`}
                    className="legend-image"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.style.display = 'none';
                      const parent = e.target.parentNode;
                      const fallback = document.createElement('div');
                      fallback.className = 'legend-fallback';
                      fallback.textContent = 'Legend not available';
                      parent.appendChild(fallback);
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <>
      {isLegendVisible && <LegendPanel />}
      
    <aside className="leftpanel">
        <div className="sidebar-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '10px', marginBottom: '10px' }}>
          <h3 className="sidebar-title" style={{ margin: 0, display: 'flex', alignItems: 'center', fontSize: '18px', color: '#111' }}>
            <MdLayers style={{ marginRight: "10px", fontSize: '20px', color: '#2e7d32' }} />
            Layer Explorer
          </h3>
      
        </div>

        <div className="search-container" style={{ position: 'relative', marginBottom: '15px' }}>
          <MdSearch style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#888', fontSize: '18px' }} />
          <input 
            type="text" 
            placeholder="Search layers..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px 10px 35px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', outline: 'none' }}
          />
        </div>

        <div className="action-buttons" style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
          <button 
            className="action-btn collapse-btn"
            onClick={() => setOpenGroups({})}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px', borderRadius: '8px', border: '1px solid #4CAF50', color: '#2e7d32', background: '#e8f5e9', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
          >
            <MdFullscreenExit style={{ fontSize: '16px' }} /> Collapse all
          </button>
          <button 
            className="action-btn clear-btn"
            onClick={clearAllLayers}
            disabled={Object.keys(addedLayers).length === 0}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px', borderRadius: '8px', border: '1px solid #e74c3c', color: '#e74c3c', background: '#ffebee', cursor: 'pointer', fontWeight: 600, fontSize: '13px', opacity: Object.keys(addedLayers).length === 0 ? 0.5 : 1 }}
          >
            <MdDelete style={{ fontSize: '16px' }} /> Clear
          </button>
        </div>
        
        <div className="layer-groups-container">
          {mergedGroups.filter(g => 
            g.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
            (g.children && g.children.some(c => (c.Name || c.title || "").toLowerCase().includes(searchQuery.toLowerCase())))
          ).map((group, idx) => renderGroup(group, idx, "layers"))}
        </div>
        
        <div className="coupe-section">
          <div className="coupe-header" onClick={() => setIsCoupesDataOpen(!isCoupesDataOpen)}>
            <h3 style={{ cursor: 'pointer', fontSize: "14px", marginLeft: "5px", fontWeight: 600 }}>
              <MdTrendingDown style={{ marginLeft: "8px", fontSize: "16px" }} />
              <span style={{ marginLeft: "8px" }}>{text[language].coupesData}</span>
            </h3>
            <span style={{ cursor: 'pointer', marginRight: "15px" }}>
              {isCoupesDataOpen ? <MdExpandLess /> : <MdExpandMore />}
            </span>
          </div>

          {isCoupesDataOpen && (
            <div className="coupe-content">
              {isLoadingCoupes ? (
                <div style={{ padding: '20px', textAlign: 'center' }}>
                  <Loader />
                </div>
              ) : (
                <div className="layer-groups-container coupe-groups">
                  {coupeGroups.filter(g => 
                    g.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                    (g.children && g.children.some(c => (c.Name || c.title || "").toLowerCase().includes(searchQuery.toLowerCase())))
                  ).map((group, idx) => renderGroup(group, idx, "coupes"))}
                </div>
              )}
            </div>
          )}
        </div>
        
        <div style={{ position: 'sticky', bottom: '-10px', left: 0, right: 0, padding: '12px', background: 'rgba(232, 245, 233, 0.95)', borderTop: '1px solid #c8e6c9', borderRadius: '0 0 12px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#1b5e20', fontSize: '13px', fontWeight: 500, backdropFilter: 'blur(5px)', marginTop: 'auto', zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <MdLayers style={{ fontSize: '16px' }} /> 
            <span>{Object.keys(addedLayers).length} active {Object.keys(addedLayers).length === 1 ? 'layer' : 'layers'}</span>
          </div>
          <button 
            onClick={() => setIsLegendVisible(!isLegendVisible)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'white', border: '1px solid #c8e6c9', borderRadius: '20px', padding: '4px 12px', color: '#2e7d32', cursor: 'pointer', fontWeight: 600, fontSize: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
            title="Toggle Legend"
          >
            <MdMap style={{ fontSize: '16px' }} /> {isLegendVisible ? "Hide Legend" : "Show Legend"}
          </button>
        </div>

        {isLayerLoading && <Loader />}
      </aside>
      
      <AttributePopup
  position={clickPosition}
  data={attributeData}
  mapRef={mapRef}
  onClose={() => {
    setAttributeData(null);
    setClickPosition(null);
  }}
  setIsInfoToolActive={setIsInfoToolActive} // Add this prop
/>
    </>
  );
};

export default LayerTogglePanel;
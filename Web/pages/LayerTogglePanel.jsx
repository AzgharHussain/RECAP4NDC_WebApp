import React, { useState, useEffect, useRef,useMemo, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { FaChevronDown, FaChevronUp, FaLayerGroup } from "react-icons/fa";
import { MdForest } from "react-icons/md";
import "./LayerTogglePanel.css";
import { useLanguage } from "../context/LanguageContext";
import L from "leaflet";
import { debounce, set, size } from 'lodash';

const Loader = () => {

  console.log("loading")
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


const AttributePopup = React.memo(({ position, data, onClose }) => {
  if (!position || !data) return null;

console.log("AttributePopup data", data);


  const features = data[0]?.features || [];
  const layerName = data[0]?.layerName || 'Unknown Layer';
  
  const popupRef = useRef(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [popupPosition, setPopupPosition] = useState({
    x: 465,
    y: 110
  });

  // Format property keys
  const formatKey = (key) => {
    return key
      .replace(/_/g, ' ')          // Replace underscores with spaces
      .replace(/([a-z])([A-Z])/g, '$1 $2') // Add space between camelCase
      .replace(/\b\w/g, (char) => char.toUpperCase()) // Capitalize first letters
      .trim();
  };

  // Format property values
  const formatValue = (value,key) => {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'boolean') return value.toString();
    if (typeof value === 'number') return value.toLocaleString();

       if (key === 'suitabilityclass' && typeof value === 'string') {
      if (value === 'Moderately Suitable') return 'Highly Suitable';
      if (value === 'Highly Suitable') return 'Moderately Suitable';
    }
    console.log("key", key ,"value", value)
    if(key === 'STANA2011' && typeof value === 'string'){
      if(value === "Nct Of Delhi") return "NCT of Delhi"
    }
    
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return `[${value.length} items]`;
    if (typeof value === 'object') return `{${Object.keys(value).length} properties}`;
    return value.toString();
  };

  // Handle drag start
  const handleMouseDown = (e) => {
    if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
    
    setIsDragging(true);
    const rect = popupRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  // Handle dragging
  const handleMouseMove = (e) => {
    if (!isDragging) return;
    
    setPopupPosition({
      x: Math.max(0, Math.min(e.clientX - dragOffset.x, window.innerWidth - 280)),
      y: Math.max(0, Math.min(e.clientY - dragOffset.y, window.innerHeight - 320))
    });
  };

const keyMappings = {
  "STANA2011": "State Name",
  "villna2011": "Village Name",
  "DISTNA2011": "District Name",
  "dist_upd": "District Name",
  "stana2011": "State Name",
  "distna2011": "District Name",
  "SW_Index_2016": "Surface Water Availability Index",
  "soc_gkg": "Soil Organic Carbon (g/kg)",
  "Net_Groundwater_Available": "Net Groundwater Available (MCM)",
  "Net_Groundwater_Category": "Net Groundwater Category",
  "Water_Risk_Index": "Water Risk Index",
  "precipitation_mm": "Precipitation (mm)",
  "st_celsius": "Temperature (°C)", 
 "Status_2020": "Status",
"village_prec": "Precipitation (mm)",
"descriptio": "Description"



};



  // Handle drag end
  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Add event listeners for dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragOffset]);

  // Minimized view (just the header)
  if (isMinimized) {
    return (
      <div
        ref={popupRef}
        className="attribute-popup-minimized"
        style={{
          position: 'fixed',
          left: `${popupPosition.x}px`,
          top: `${popupPosition.y}px`,
          zIndex: 10000,
          width: '200px',
          backgroundColor: '#0B3C4D',
         
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          border: '1px solid rgba(255,255,255,0.1)',
          cursor: 'grab',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 12px',
          backdropFilter: 'blur(2px)',
          transition: 'transform 0.2s',
          transform: isDragging ? 'scale(1.02)' : 'none',
          boxShadow: isDragging ? '0 6px 24px rgba(0,0,0,0.3)' : '0 4px 20px rgba(0,0,0,0.2)'
        }}
        onMouseDown={handleMouseDown}
      >
        <div>
          <h4 style={{ 
            margin: 0,
            fontSize: '14px',
            fontWeight: 600,
            color: 'white',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: '140px'
          }}>{layerName}</h4>
          <p style={{
            margin: '2px 0 0',
            fontSize: '11px',
            color: 'rgba(255,255,255,0.7)',
            fontWeight: 500
          }}>{features.length} feature{features.length !== 1 ? 's' : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button 
            type="button" 
            onClick={() => setIsMinimized(false)}
            style={{
              background: 'rgba(255,255,255,0.15)',
              border: 'none',
              cursor: 'pointer',
              fontSize: '12px',
              color: 'white',
              padding: '4px 8px',
              borderRadius: '4px',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '24px',
              height: '24px',
              ':hover': {
                backgroundColor: 'rgba(255,255,255,0.25)',
                transform: 'scale(1.1)'
              }
            }}
            aria-label="Restore"
          >
            ↑
          </button>
          <button 
            type="button" 
            onClick={onClose} 
            style={{
              background: 'rgba(255,255,255,0.15)',
              border: 'none',
              cursor: 'pointer',
              fontSize: '12px',
              color: 'white',
              padding: '4px 8px',
              borderRadius: '4px',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '24px',
              height: '24px',
              ':hover': {
                backgroundColor: 'rgba(255,99,71,0.8)',
                transform: 'scale(1.1)'
              }
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>
      </div>
    );
  }

  // Full view
  return (
    <div
      ref={popupRef}
      className="attribute-popup"
      style={{
        position: 'fixed',
        left: `${popupPosition.x}px`,
        top: `${popupPosition.y}px`,
        zIndex: 10000,
        width: '300px',
        maxHeight: '400px',
        background: 'linear-gradient(160deg, #0B3C4D 0%, #005D57 100%)',
       
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        border: '1px solid rgba(255,255,255,0.1)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        cursor: 'grab',
        transition: 'transform 0.2s',
        transform: isDragging ? 'scale(1.01)' : 'none',
        boxShadow: isDragging ? '0 12px 36px rgba(0,0,0,0.3)' : '0 8px 32px rgba(0,0,0,0.2)'
      }}
      onMouseDown={handleMouseDown}
    >
      <div className="popup-header" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 14px',
        background: 'rgba(0,0,0,0.2)',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
      }}>
        <div style={{ overflow: 'hidden' }}>
          <h4 style={{ 
            margin: 0,
            fontSize: '15px',
            fontWeight: 600,
            color: 'white',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>{layerName}</h4>
          <p style={{
            margin: '3px 0 0',
            fontSize: '11px',
            color: 'rgba(255,255,255,0.7)',
            fontWeight: 500
          }}>{features.length} feature{features.length !== 1 ? 's' : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button 
            type="button" 
            onClick={() => setIsMinimized(true)}
            style={{
              background: 'rgba(255,255,255,0.15)',
              border: 'none',
              cursor: 'pointer',
              fontSize: '12px',
              color: 'white',
              padding: '6px 8px',
              borderRadius: '5px',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              ':hover': {
                backgroundColor: 'rgba(255,255,255,0.25)',
                transform: 'translateY(-1px)'
              }
            }}
            aria-label="Minimize"
          >
            ↓
          </button>
          <button 
            type="button" 
            onClick={onClose} 
            style={{
              background: 'rgba(255,255,255,0.15)',
              border: 'none',
              cursor: 'pointer',
              fontSize: '12px',
              color: 'white',
              padding: '6px 8px',
              borderRadius: '5px',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              ':hover': {
                backgroundColor: 'rgba(255,99,71,0.8)',
                transform: 'translateY(-1px)'
              }
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>
      </div>
      
      <div className="popup-content" style={{ 
        flex: 1,
        overflowY: 'auto',
        fontSize: '13px',
        backgroundColor: 'white',
        '&::-webkit-scrollbar': {
          width: '8px'
        },
        '&::-webkit-scrollbar-track': {
          background: '#f1f1f1'
        },
        '&::-webkit-scrollbar-thumb': {
          background: '#ccc',
          borderRadius: '4px'
        },
        '&::-webkit-scrollbar-thumb:hover': {
          background: '#aaa'
        }
      }}>
        {features.length === 0 ? (
          <div style={{ 
            padding: '20px',
            textAlign: 'center',
            color: '#666',
            fontSize: '14px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px'
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
        ℹ️ No feature at this location.<br/>
         Try a nearby spot or zoom in further.
           </div>
        ) : (
          features.map((feature, idx) => (
            <div key={`feature-${idx}`} style={{ 
              margin: '10px',
              padding: '12px',
              border: '1px solid #e8e8e8',
              borderRadius: '8px',
              backgroundColor: '#fff',
              boxShadow: '0 2px 6px rgba(0,0,0,0.05)'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '10px',
                paddingBottom: '8px',
                borderBottom: '1px solid #f0f0f0'
              }}>
                <span style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '20px',
                  height: '20px',
                  backgroundColor: '#0B3C4D',
                  borderRadius: '6px',
                  fontSize: '12px',
                  color: 'white',
                  fontWeight: 'bold',
                  flexShrink: 0
                }}>
                  {idx + 1}
                </span>
                <h5 style={{ 
                  margin: 0,
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#333',
                }}>
                  Feature Properties
                </h5>
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(100px, 1fr) 2fr',
                gap: '6px',
                fontSize: '12px'
              }}>
             {Object.entries(feature)
  .filter(([key, value]) => {
    // Filter out null/undefined values and other unwanted properties
    return value !== null && 
           value !== undefined && 
           value !== '' &&
           key !== '__proto__' && 
           typeof value !== 'function';
  })
  .map(([key, value]) => {
    const cleanKey = keyMappings[key] || formatKey(key);
    const formattedValue = formatValue(value, key);
    
    return (
      <React.Fragment key={key}>
        <div style={{ 
          padding: '4px 6px',
          color: '#555',
          fontWeight: 500,
          backgroundColor: '#f9f9f9',
          borderRadius: '4px',
          wordBreak: 'break-word'
        }}>
          {cleanKey}
        </div>
        <div style={{ 
          padding: '4px 6px',
          wordBreak: 'break-word',
          color: '#222',
          backgroundColor: '#f9f9f9',
          borderRadius: '4px',
          fontFamily: typeof value === 'object' ? 'monospace' : 'inherit',
          fontSize: typeof value === 'object' ? '11px' : '12px'
        }}>
          {typeof value === 'object' && value !== null ? (
            <details>
              <summary style={{ cursor: 'pointer' }}>
                {formattedValue}
              </summary>
              <pre style={{
                margin: '6px 0 0',
                padding: '6px',
                backgroundColor: '#f0f0f0',
                borderRadius: '4px',
                overflow: 'auto',
                maxHeight: '150px',
                whiteSpace: 'pre-wrap'
              }}>
                {JSON.stringify(value, null, 2)}
              </pre>
            </details>
          ) : (
            formattedValue
          )}
        </div>
      </React.Fragment>
    );
  })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
});

const GEOSERVER_WMS = "https://www.gisfy.co.in:8443/geoserver/wms";

const layersData = {
  groups: [
    {
      title: "Gujarat State Boundaries",
      layerList: [
        
        { Name:"Gujarat_district", Layer: "District" },
        { Name: "Gujarat_Forest_Area_Boundary_March_2023", Layer: "Forest Area" }
      
      ]
    },
      {
      title: "Wildlife Forest ",
      layerList: [
        { Name: "Wildlife_Circle_Boundary", Layer: "Wildlife Circle" },
        { Name: "Wildlife_Circle_Division_Boundary", Layer: "Wildlife Circle Division" },
        { Name: "Wildlife_Circle_Range_Boundary", Layer: "Wildlife Circle Range" },
        { Name: "Wildlife_Circle_Round_Boundary", Layer: "Wildlife Circle Round" },
        { Name: "Wildlife_Circle_Beat_Boundary", Layer: "Wildlife Circle Beat" },
        { Name: "Wildlife_Circle_Village_Boundary", Layer: "Wildlife Circle Village" },
      ]
    },
    {
      title: "Social Forestry ",
      layerList: [
        { Name: "Social_Forestry_Circle_Boundary", Layer: "Social Forestry Circle" },
        { Name: "Social_Forestry_Range_Boundary", Layer: "Social Forestry Range" },
        { Name: "Social_Forestry_Round_Boundary", Layer: "Social Forestry Round" },
        { Name: "Social_Forestry_Beat_Boundary", Layer: "Social Forestry Beat" },
        { Name: "Social_Forestry_Village_Boundary", Layer: "Social Forestry Village" },
      ]
    },
    {
      title: "Territorial Forest ",
      layerList: [
        { Name: "Teritorial_Circle_Division_Boundary", Layer: "Territorial Circle Division" },
        { Name: "Teritorial_Circle_Range_Boundary", Layer: "Territorial Circle Range" },
        { Name: "Teritorial_Circle_Round_Boundary", Layer: "Territorial Circle Round" },
        { Name: "Teritorial_Circle_Beat_Boundary", Layer: "Territorial Circle Beat" },
        { Name: "Teritorial_Circle_Village_Boundary", Layer: "Territorial Circle Village" },
      
      ]
    },
  
    
  ]
};

const coupesData = {
  groups: [    
    {
      title: "Banaskantha",
      layerList: [
        { Name: "Con_Cum_Imp_WC_OVLP", Layer: "Banaskantha Con Cum Imp WC OVLP" },
        { Name: "Banaskantha_DesDev_WL_WC", Layer: "Banaskantha DesDev WL WC" },
        { Name: "Banaskantha_RWD_WC_final", Layer: "Banaskantha RWD WC Final" },
        { Name: "Banaskantha_Wild Life_WC", Layer: "Banaskantha Wildlife WC" },
      ]
    },
    {
      title: "Banni",
      layerList: [
        { Name: "Banni Forest", Layer: "Banni Forest" },
      ]
    },
    {
      title: "Baria",
      layerList: [
        { Name: "Baria_DEV_AFF COUPE", Layer: "Baria Dev Aff Coupe" },
        { Name: "Baria_DEV_DEV&CON W.C COUPE", Layer: "Baria Dev Dev&Con W.C Coupe" },
        { Name: "Baria_Danpur_AFF W.C COUPE", Layer: "Baria Danpur Aff W.C Coupe" },
        { Name: "Baria_Danpur_BIO W.C COUPE", Layer: "Baria Danpur Bio W.C Coupe" },
        { Name: "Baria_Danpur_DEV&CON W.C COUPE", Layer: "Baria Danpur Dev&Con W.C Coupe" },
        { Name: "Baria_Danpur_Rev", Layer: "Baria Danpur Revenue" },
        { Name: "Baria_Dev_Revenue", Layer: "Baria Dev Revenue" },

        { Name: "Jhalod_AFFORESTATION W.C_COUPE", Layer: "Jhalod Afforestation W.C Coupe" },
        { Name: "Jhalod_GRASSBIR W.C COUPE", Layer: "Jhalod Grassbir W.C Coupe" },
        { Name: "Jhalod_J_DEVELO&CON W.C COUPE", Layer: "Jhalod Dev&Con W.C Coupe" },
        { Name: "Jhalod_Revenue", Layer: "Jhalod Revenue" },

        { Name: "Vansi_AFF W.C COUPE", Layer: "Vansi Aff W.C Coupe" },
        { Name: "Vansi_BIO W.C COUPE", Layer: "Vansi Bio W.C Coupe" },
        { Name: "Vansi_DEV&CON W.C  COUPE", Layer: "Vansi Dev&Con W.C Coupe" },
        { Name: "Vansi_Revenue", Layer: "Vansi Revenue" },

        { Name: "DOHAD_AFFORESTATION W.C COUPE", Layer: "Dohad Afforestation W.C Coupe" },
        { Name: "DOHAD_D_DEVELOPMENT&CONSERVATION COUPE", Layer: "Dohad Dev&Conservation Coupe" },
        { Name: "DOHAD_GRASSBIR W.C COUPE", Layer: "Dohad Grassbir W.C Coupe" },
        { Name: "DOHAD_PRO", Layer: "Dohad Pro" },
        { Name: "DOHAD_REVENUE", Layer: "Dohad Revenue" },

        { Name: "FATEPURA_AFFORESTATION W.C _COUPE", Layer: "Fatepura Afforestation W.C Coupe" },
        { Name: "FATEPURA_Revenu_Boundary", Layer: "Fatepura Revenue Boundary" },

        { Name: "Kanjeta_AFF W.C COUPE", Layer: "Kanjeta Aff W.C Coupe" },
        { Name: "Kanjeta_DEVELOPMENT&CONSERVATION W.C COUPE", Layer: "Kanjeta Dev&Conservation W.C Coupe" },
        { Name: "Kanjeta_Revenue", Layer: "Kanjeta Revenue" },

        { Name: "Raaampura_R_AFFORESTATION COUPE", Layer: "Raampura Afforestation Coupe" },
        { Name: "Rampura_R_GRASSBIR COUPE", Layer: "Rampura Grassbir Coupe" },
        { Name: "Rampura_Revenue", Layer: "Rampura Revenue" },

        { Name: "Randhikpur_RAN_AFFO W.C COUPE", Layer: "Randhikpur Affo W.C Coupe" },
        { Name: "Randhikpur_RAN_DEV&CON W.C COUPE", Layer: "Randhikpur Dev&Con W.C Coupe" },
        { Name: "Randhikpur_RAN_GRASSBIR W.C COUPE", Layer: "Randhikpur Grassbir W.C Coupe" },
        { Name: "Randhikpur_REVENUE", Layer: "Randhikpur Revenue" },

        { Name: "Sarjumi_AFFORESTATION W.C COUPE", Layer: "Sarjumi Afforestation W.C Coupe" },
        { Name: "Sarjumi_DEV&CON W.C COUPE", Layer: "Sarjumi Dev&Con W.C Coupe" },
        { Name: "Sarjumi_GRASSBIR W.C COUPE", Layer: "Sarjumi Grassbir W.C Coupe" },
        { Name: "Sarjumi_REVENUE", Layer: "Sarjumi Revenue" },

         { Name: "Limkhed_Revenue", Layer: "Limkhed Revenue" },
        { Name: "Limkheda_DEVELOPMENT&CONSERVATION W.C COUPE", Layer: "Limkheda Dev&Conservation W.C Coupe" },
        { Name: "Limkheda_L_AFFORESTATION W.C COUPE", Layer: "Limkheda Afforestation W.C Coupe" },
        { Name: "Limkheda_L_GRASSBIR W.C COUPE", Layer: "Limkheda Grassbir W.C Coupe" },

        { Name: "SAGTALA_BIODI W.C COUPE", Layer: "Sagtala Biodi W.C Coupe" },
        { Name: "SAGTALA_DEV&CON W.C COUPE", Layer: "Sagtala Dev&Con W.C Coupe" },

        { Name: "Sanjeli_AFFORESTATION W.C _COUPE", Layer: "Sanjeli Afforestation W.C Coupe" },
        { Name: "Sanjeli_DEVELO&CON W.C COUPE", Layer: "Sanjeli Dev&Con W.C Coupe" },
        { Name: "Sanjeli_G.S.F.D.C.AREA", Layer: "Sanjeli GSFDC Area" },
        { Name: "Sanjeli_GRASSBIR W.C COUPE", Layer: "Sanjeli Grassbir W.C Coupe" },
        { Name: "Sanjeli_Revenu_Boundary", Layer: "Sanjeli Revenue Boundary" },
      ]
    },
    {
      title: "Bharuch",
      layerList: [
        { Name: "Bharuch_Coupe_joined", Layer: "Bharuch Coupe Joined" },
      ]
    },
    {
      title: "Bhavnagar",
      layerList: [
        { Name: "Bhavnagar_coupes", Layer: "Bhavnagar Coupes" },
        { Name: "Bhavnagr_Shetrunjay_Ranges", Layer: "Bhavnagar Shetrunjay Ranges" },
        { Name: "Bhavnagr_Shetrunjay_WL_Divi", Layer: "Bhavnagar Shetrunjay WL Divi" },
      ]
    },
    {
      title: "Chhotaudepur",
      layerList: [
        { Name: "Chhotaudepur_CUD_Coupe_bdn", Layer: "Chhotaudepur CUD Coupe BDN" },
      ]
    },
    // {
    //   title: "Dohad",
    //   layerList: [
        
    //   ]
    // },
    // {
    //   title: "Fatepura",
    //   layerList: [
        
    //   ]
    // },
    {
      title: "Gandhinagar",
      layerList: [
        { Name: "Gandhinagar_MM_Coupe", Layer: "Gandhinagar MM Coupe" },
      ]
    },
    {
      title: "Garbada",
      layerList: [
        { Name: "Garbada_Afforestation_Coupe", Layer: "Garbada Afforestation Coupe" },
        { Name: "Garbada_Develop &Conser Coupe", Layer: "Garbada Develop &Conser Coupe" },
        { Name: "Garbada_GR W.C COUPE", Layer: "Garbada GR W.C Coupe" },
        { Name: "Garbada_Revenue", Layer: "Garbada Revenue" },
      ]
    },
    {
      title: "Jamnagar",
      layerList: [
        { Name: "Jamnagar_coupes", Layer: "Jamnagar Coupes" },
      ]
    },
    // {
    //   title: "Jhalod",
    //   layerList: [
        
    //   ]
    // },
    {
      title: "Junagadh",
      layerList: [
        { Name: "Junagadh coupes", Layer: "Junagadh Coupes" },
      ]
    },
    // {
    //   title: "Kanjeta",
    //   layerList: [
        
    //   ]
    // },
    // {
    //   title: "Limkheda",
    //   layerList: [
       
    //   ]
    // },
    {
      title: "Mahisagar",
      layerList: [
        { Name: "Mahisagar_all_Coupe_FF", Layer: "Mahisagar All Coupe FF" },
      ]
    },
    {
      title: "Merged Layers",
      layerList: [
        { Name: "Merged2", Layer: "Merged 2" },
        { Name: "Merged_coupes", Layer: "Merged Coupes" },
      ]
    },
    {
      title: "Morbi",
      layerList: [
        { Name: "Morbi_coupe_map", Layer: "Morbi Coupe Map" },
      ]
    },
    {
      title: "Narmada",
      layerList: [
        { Name: "Narmada_CP_FS2_compt4_RRB", Layer: "Narmada CP FS2 Compt4 RRB" },
      ]
    },
    // {
    //   title: "Raampura",
    //   layerList: [
        
    //   ]
    // },
    // {
    //   title: "Randhikpur",
    //   layerList: [
        
    //   ]
    // },
    // {
    //   title: "Sagtala",
    //   layerList: [
        
    //   ]
    // },
    {
      title: "Sabarkantha",
      layerList: [
        { Name: "Sabarkantha_North_Aravalli", Layer: "Sabarkantha North Aravalli" },
        { Name: "Sabarkantha_South_Aravalli", Layer: "Sabarkantha South Aravalli" },
      ]
    },
    // {
    //   title: "Sanjeli",
    //   layerList: [
        
    //   ]
    // },
    // {
    //   title: "Sarjumi",
    //   layerList: [
        
    //   ]
    // },
    {
      title: "Surat",
      layerList: [
        { Name: "Surat_all_Range_Coupe", Layer: "Surat All Range Coupe" },
      ]
    },
    {
      title: "Surendranagar",
      layerList: [
        { Name: "Surendranagar_coupe", Layer: "Surendranagar Coupe" },
      ]
    },
    // {
    //   title: "Vansi",
    //   layerList: [
        
    //   ]
    // },
    {
      title: "Vyara",
      layerList: [
        { Name: "Vyara_MM_Coupe_Boundary", Layer: "Vyara MM Coupe Boundary" },
      ]
    },
  ]
};

// Text content
const text = {
  en: {
    exploreData: "Explore Data",
    coupesData: "Coupe Boundaries",
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
    coupesData: "કૂપ સીમાઓ",
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

const getLayerName = (layer, groupIndex, layerIndex) => {
  // Create a unique key by combining group index and layer name
  return `${layer.Name}-${groupIndex}-${layerIndex}`;
};

const LayerTogglePanel = ({ mapRef, activeBasemap, setActiveBasemap,activeToolSidebar }) => {
  const { language } = useLanguage();
  const [addedLayers, setAddedLayers] = useState({});
  const [opacity, setOpacity] = useState({});
  const [openGroups, setOpenGroups] = useState({});
  const [isLayerLoading, setIsLayerLoading] = useState(false);
  const layerCounterRef = useRef(0);
    const [clickPosition, setClickPosition] = useState(null);
  const [attributeData, setAttributeData] = useState(null);
const [showAttributeTable, setShowAttributeTable] = useState(false);
  // Generate unique IDs for groups and layers on mount
  const [layersGroupIds, setLayersGroupIds] = useState({});
  const [coupesGroupIds, setCoupesGroupIds] = useState({});
  const [layerIds, setLayerIds] = useState({});

   useEffect(() => {
    const layersGroupIdMap = {};
    const coupesGroupIdMap = {};
    const layerIdMap = {};

    // Generate IDs for layersData groups
    layersData.groups.forEach((group, groupIndex) => {
      const groupId = uuidv4();
      layersGroupIdMap[groupIndex] = groupId;

      group.layerList.forEach((layer, layerIndex) => {
        const layerName = getLayerName(layer);
        layerIdMap[`layers-${groupIndex}-${layerName}`] = uuidv4();
      });
    });

    // Generate IDs for coupesData groups
    coupesData.groups.forEach((group, groupIndex) => {
      const groupId = uuidv4();
      coupesGroupIdMap[groupIndex] = groupId;

      group.layerList.forEach((layer, layerIndex) => {
        const layerName = getLayerName(layer);
        layerIdMap[`coupes-${groupIndex}-${layerName}`] = uuidv4();
      });
    });

    setLayersGroupIds(layersGroupIdMap);
    setCoupesGroupIds(coupesGroupIdMap);
    setLayerIds(layerIdMap);
  }, []);

  // Initialize open groups
  useEffect(() => {
    const initialOpenState = {};
    layersData.groups.forEach((_, idx) => {
      initialOpenState[`layers-${idx}`] = false;
    });
    coupesData.groups.forEach((_, idx) => {
      initialOpenState[`coupes-${idx}`] = false;
    });
    setOpenGroups(initialOpenState);
  }, []);

  const getLegendUrl = (layerName) => {
    return `${GEOSERVER_WMS}?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&WIDTH=20&HEIGHT=20&LAYER=${layerName}`;
  };

  const getLayerTitle = (layerName) => {
    for (const group of layersData.groups) {
      for (const layer of group.layerList) {
        if (layer.Name === layerName) {
          return layer.Layer;
        }
      }
    }
    return layerName;
  };

  // Calculate z-index
  const calculateZIndex = () => {
    layerCounterRef.current += 1;
    return 1000 + layerCounterRef.current;
  };

  // Create WMS layer
  const createLayer = (layerName, layerLabel, zIndex) => {
    try {
      return L.tileLayer.wms(GEOSERVER_WMS, {
        layers: layerName,
        format: "image/png",
        transparent: true,
        version: "1.3.0",
        zIndex,
        attribution: `© ${layerLabel}`,
        tiled: true
      });
    } catch (error) {
      console.error(`Error creating layer ${layerName}:`, error);
      return null;
    }
  };

  // Layer manager
  const layerManager = {
    addLayer: async (layerName, layerLabel) => {
      if (!mapRef.current) {
        console.error("[addLayer] Map reference not initialized.");
        return null;
      }

      setIsLayerLoading(true);
      try {
        const zIndex = calculateZIndex();
        const newLayer = createLayer(layerName, layerLabel, zIndex);
        if (!newLayer) throw new Error("Layer creation failed");

        newLayer.addTo(mapRef.current);

        layer._metadata = {
          name: layerName,
          label: layerLabel
        };
        
        return new Promise((resolve) => {
          const timeout = setTimeout(() => {
            console.warn(`[addLayer] Timeout while loading "${layerName}" (15s)`);
            setIsLayerLoading(false);
            resolve(newLayer);
          }, 15999000);

          newLayer.on("load", () => {
            console.log(`[addLayer] Layer "${layerName}" fully loaded`);
            clearTimeout(timeout);
            setIsLayerLoading(false);
            resolve(newLayer);
          });

          newLayer.on("tileerror", (error) => {
            console.warn(`[addLayer] Tile error in "${layerName}"`, error);
            clearTimeout(timeout);
            setIsLayerLoading(false);
            resolve(newLayer);
          });
        });
      } catch (error) {
        console.error("[addLayer] Error adding layer:", error);
        setIsLayerLoading(false);
        throw error;
      }
    },

    removeLayer: async (layerName) => {
    const layerToRemove = Object.values(addedLayers).find(
      layer => layer._metadata?.name === layerName
    );
    
    if (layerToRemove && mapRef.current?.hasLayer(layerToRemove)) {
      return new Promise((resolve) => {
        mapRef.current.removeLayer(layerToRemove);
        layerToRemove.off();
        setTimeout(() => resolve(true), 0);
      });
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

  // Toggle layer
  const toggleLayer = useCallback(
  async (layerConfig, groupIndex, layerIndex) => {
    const uniqueKey = `${layerConfig.Name}-${groupIndex}-${layerIndex}`;
    
    try {
      if (addedLayers[uniqueKey]) {
        // Remove the layer
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
        // Add the new layer
        const layer = await layerManager.addLayer(layerConfig.Name, layerConfig.Layer);
        if (!layer) throw new Error(`Failed to add layer: ${layerConfig.Name}`);
        
        const layerOpacity = 0.7;
        setAddedLayers((prev) => ({ ...prev, [uniqueKey]: layer }));
        setOpacity((prev) => ({ ...prev, [uniqueKey]: layerOpacity }));
        layer.setOpacity(layerOpacity);
      }
    } catch (err) {
      console.error(`Layer toggle failed for ${layerConfig.Name}:`, err);
      setIsLayerLoading(false);
    }
  },
  [addedLayers, layerManager]
);

  // Toggle group
  const toggleGroup = useCallback((section, idx) => {
    const groupId = `${section}-${idx}`;
    setOpenGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  }, []);

  const layerNameMapping222 ={

  }
 
// REPLACE the existing fetchFeatureInfo function with this:
const fetchFeatureInfo = useCallback(async (layerName, latlng) => {
    const map = mapRef.current;
    if (!map) return { features: [] };

    try {
        const bounds = map.getBounds();
        const size = map.getSize();
        const point = latlng ? map.latLngToContainerPoint(latlng) : { 
            x: Math.floor(size.x / 2),
            y: Math.floor(size.y / 2)
        };

        // CORRECTED WMS GetFeatureInfo parameters
        const params = new URLSearchParams({
            service: 'WMS',
            version: '1.1.1',
            request: 'GetFeatureInfo',
            layers: layerName,
            query_layers: layerName,
            info_format: 'application/json',
            feature_count: 50,
            srs: 'EPSG:4326',
            bbox: `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`,
            width: size.x,
            height: size.y,
            x: Math.round(point.x),
            y: Math.round(point.y),
            buffer: 10,  // IMPORTANT: Increased from 5 to 10
            exceptions: 'application/json'
        });

        // USE CORRECT GEOSERVER URL (same as in createLayer function)
        const wmsUrl = `${GEOSERVER_WMS}?${params}`;
        console.log('Fetching from:', wmsUrl);  // DEBUG: See the actual URL

        const response = await fetch(wmsUrl);
        
        if (!response.ok) {
            console.error('Response error:', response.status, response.statusText);
            return { features: [] };
        }

        const data = await response.json();
        console.log('GeoServer response for', layerName, ':', data);  // DEBUG
        
        return data;
    } catch (error) {
        console.error(`Error fetching feature info for ${layerName}:`, error);
        return { features: [] };
    }
}, [mapRef]);

  const handleMapClick = useCallback(async (e) => {
  if (activeToolSidebar !== "info") return;

  const selectedLayerNames = Object.keys(addedLayers);
  if (selectedLayerNames.length === 0) return;

  const map = mapRef.current;
  if (!map) return;

  const containerPoint = map.latLngToContainerPoint(e.latlng);
  setClickPosition({ x: containerPoint.x, y: containerPoint.y });
  setIsLayerLoading(true);

  try {
    const allFeatures = [];

    for (let layerName of selectedLayerNames) {
      const fetchLayerName = layerNameMapping222[layerName] || layerName;
      const displayName = addedLayers[layerName]?.options?.attribution || layerName;

      console.log(`Fetching data for: ${fetchLayerName}`);

      try {
        const data = await fetchFeatureInfo(fetchLayerName, e.latlng);
        console.log(data);

        if (data.features?.length > 0) {
          const allowedAttributes = layersData[displayName];

          allFeatures.push({
            layerName: displayName,
            features: data.features.map(f => {
              const props = allowedAttributes
                ? Object.fromEntries(
                    Object.entries(f.properties).filter(([key]) =>
                      allowedAttributes.includes(key)
                    )
                  )
                : { ...f.properties };

              return props;
            }),
          });
        } else {
          console.warn(`No features found for layer ${fetchLayerName}`);
        }
      } catch (layerErr) {
        console.error(`Error fetching ${fetchLayerName}:`, layerErr);
      }
    }

    setAttributeData(allFeatures);
    console.log("Filtered features:", allFeatures);
  } catch (error) {
    console.error("Error in handleMapClick:", error);
  } finally {
    setIsLayerLoading(false);
  }
}, [
  activeToolSidebar,
  addedLayers,
  fetchFeatureInfo,
  mapRef,
  layerNameMapping222,
  layersData,
  setClickPosition,
  setIsLayerLoading,
  setAttributeData,
]);

  const debouncedClickHandler = useMemo(
    () => debounce(handleMapClick, 200, { leading: true, trailing: false }),
    [handleMapClick]
  );

  

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    map.on("click", debouncedClickHandler);
    return () => {
      map.off("click", debouncedClickHandler);
      debouncedClickHandler.cancel();
    };
  }, [debouncedClickHandler, mapRef]);

  const closeAttributePopup = useCallback(() => {
    setAttributeData(null);
    setClickPosition(null);
  }, []);

  const fetchAllLayerData = useCallback(async () => {
    const results = {};
    for (const layerName in addedLayers) {
      try {
        const url = `${REACT_APP_GEOSERVER_URL}?service=WFS&version=1.1.0&request=GetFeature&typeName=${layerName}&outputFormat=application/json&srsName=EPSG:4326&`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Network response was not ok: ${response.status}`);
        const data = await response.json();
        results[layerName] = data.features?.map(f => f.properties) || [];
      } catch (error) {
        console.error(`Error fetching data for layer ${layerName}:`, error);
        results[layerName] = [];
      }
    }
    console.log("Fetched attribute data for all layers:99999999999999999999999999999999999999999999999999999999999999999", results);
    setTotalAttributeData(results);
  }, [addedLayers]);

  useEffect(() => {
    if (showAttributeTable) {
      fetchAllLayerData();
    }
  }, [showAttributeTable, fetchAllLayerData]);



  // Handle opacity change
  const handleOpacityChange = useCallback(
  (e, uniqueKey) => {
    const newOpacity = parseFloat(e.target.value);
    setOpacity((prev) => ({ ...prev, [uniqueKey]: newOpacity }));
    
    // Extract the actual layer name from the unique key
    const layer = addedLayers[uniqueKey];
    if (layer) {
      layer.setOpacity(newOpacity);
    }
  },
  [addedLayers]
);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const map = mapRef?.current;
      if (map) {
        Object.values(addedLayers).forEach((layer) => {
          try {
            map.removeLayer(layer);
          } catch (e) {
            console.warn("Error removing layer during cleanup:", e);
          }
        });
      }
    };
  }, [mapRef]);

  // LayerGroup component with UUID keys
 const LayerGroup = React.memo(({
  group,
  idx,
  openGroups,
  toggleGroup,
  addedLayers,
  toggleLayer,
  opacity,
  handleOpacityChange,
  icon,
  loadingLayers,
  groupId,
  section = "layers"
}) => {
  const prefixedIdx = `${section}-${idx}`;
  
  return (
    <div className="layer-group">
      <button
        type="button"
        className="group-title"
        onClick={() => toggleGroup(section, idx)}
        aria-expanded={openGroups[prefixedIdx] ? "true" : "false"}
      >
        <span className="group-title-content">
          {icon && <span style={{ marginRight: 8, fontSize: 18, color: "#0b9700" }}>{icon}</span>}
          {group.title}
        </span>
        <span className="arrow-icon">
          {openGroups[prefixedIdx] ? <FaChevronUp /> : <FaChevronDown />}
        </span>
      </button>

      <div className={`layer-list-wrapper ${openGroups[prefixedIdx] ? "expanded" : "collapsed"}`}>
        {group.layerList.map((layer, layerIndex) => {
          const uniqueKey = `${layer.Name}-${idx}-${layerIndex}`;
          const isChecked = !!addedLayers[uniqueKey];
          const layerId = layerIds[`${section}-${idx}-${uniqueKey}`] || uuidv4();

          return (
            <div key={layerId} className={`layer-item ${isChecked ? "active" : ""}`}>
              <label className="layer-label-container">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleLayer(layer, idx, layerIndex)}
                />
                <span
                  className={`layer-label ${isChecked ? "layer-label-bold" : ""}`}
                >
                  {layer.Layer}
                </span>
              </label>

              {isChecked && (
                <div className="opacity-control">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={opacity[uniqueKey] ?? 0.7}
                    onChange={(e) => handleOpacityChange(e, uniqueKey)}
                  />
                  <span className="opacity-value">
                    {Math.round((opacity[uniqueKey] ?? 0.7) * 100)}%
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

  // Legend Component
  const LegendPanel = () => {
    const activeLayers = Object.keys(addedLayers);
    
    if (activeLayers.length === 0) {
      return null;
    }

    return (
      <div className="legend-panel">
        <h4 className="legend-title">Layer Legends</h4>
        <div className="legend-items-container">
          {activeLayers.map((layerName) => (
            <div key={layerName} className="legend-item">
              <h5 className="legend-layer-title">{getLayerTitle(layerName)}</h5>
              <div className="legend-image-container">
                <img
                  src={getLegendUrl(layerName)}
                  alt={`${getLayerTitle(layerName)} legend`}
                  className="legend-image"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.style.display = 'none';
                    const fallback = document.createElement('div');
                    fallback.className = 'legend-fallback';
                    fallback.textContent = 'Legend not available';
                    e.target.parentNode.appendChild(fallback);
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const [isCoupesDataOpen, setIsCoupesDataOpen] = useState(false);

  // Toggle function for coupes data section
  const toggleCoupesData = () => {
    setIsCoupesDataOpen(!isCoupesDataOpen);
  };

  return (
    <> 
      <LegendPanel />
      
      <aside className="leftpanel">
        <h3 className="sidebar-title">
          <FaLayerGroup style={{ marginRight: "8px" }} />
          {text[language].exploreData}
        </h3>
        <div className="layer-groups-container">
          {layersData.groups.map((group, idx) => (
            <LayerGroup
              key={layersGroupIds[idx]}
              group={group}
              idx={idx}
              openGroups={openGroups}
              toggleGroup={toggleGroup}
              addedLayers={addedLayers}
              toggleLayer={toggleLayer}
              opacity={opacity}
              handleOpacityChange={handleOpacityChange}
              icon={<FaLayerGroup />}
              loadingLayers={isLayerLoading}
              groupId={layersGroupIds[idx]}
              section="layers" // Pass section prop
            />
          ))}
        </div>
        
        <div className="coupeboundary" onClick={toggleCoupesData}>
          <h3 style={{ cursor: 'pointer', fontSize: "14px", marginLeft: "10px" }}>
            <MdForest style={{ marginLeft: "8px", fontSize: "17px" }} />
            <span style={{ marginLeft: "8px" }}>{text[language].coupesData}</span>
          </h3>
          <span style={{ cursor: 'pointer', marginRight: "15px" }}>
            {isCoupesDataOpen ? '▼' : '▶'}
          </span>
        </div>
      
        {isCoupesDataOpen && (
          <div className="layer-groups-container">
            {coupesData.groups.map((group, idx) => (
              <LayerGroup
                key={coupesGroupIds[idx]}
                group={group}
                idx={idx}
                openGroups={openGroups}
                toggleGroup={toggleGroup}
                addedLayers={addedLayers}
                toggleLayer={toggleLayer}
                opacity={opacity}
                handleOpacityChange={handleOpacityChange}
                icon={<FaLayerGroup />}
                loadingLayers={isLayerLoading}
                groupId={coupesGroupIds[idx]}
                section="coupes" // Pass section prop
              />
            ))}
          </div>
        )}
        
        {isLayerLoading && (
          <Loader />
        )}
      </aside>
         <AttributePopup
        position={clickPosition}
        data={attributeData}
        onClose={closeAttributePopup}
      />
    </>
  );
};

export default LayerTogglePanel;
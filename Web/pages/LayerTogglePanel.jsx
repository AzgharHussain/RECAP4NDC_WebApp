import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { FaChevronDown, FaChevronUp, FaLayerGroup, FaCircle, FaFolder, FaFolderOpen } from "react-icons/fa";
import { MdForest } from "react-icons/md";
import "./LayerTogglePanel.css";
import { useLanguage } from "../context/LanguageContext";
import L from "leaflet";
import { debounce } from 'lodash';
import { API_BASE_URL } from "../config";

const Loader = () => {
  console.log("loading");
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

// Nested Layer Group Component
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
  nestingLevel = 0
}) => {
  const isExpanded = openGroups[groupId] || false;

  return (
    <div className="nested-layer-group" >
      {/* Group Header */}
      <button
        type="button"
        className="group-title nested-group-title"
        onClick={() => toggleGroup(groupId)}
        aria-expanded={isExpanded}
      >
        <span className="group-title-content">
              <FaLayerGroup style={{ marginRight: "8px" }} />
              {group.title}
            </span>
        <span className="arrow-icon">
          {isExpanded ? <FaChevronUp /> : <FaChevronDown />}
        </span>
      </button>

      {/* Group Content */}
      {isExpanded && (
        <div className="nested-group-content">
          {/* Render layers if they exist */}
          {group.layer && (
            <LayerItem
              layer={group.layer}
              groupId={groupId}
              addedLayers={addedLayers}
              toggleLayer={toggleLayer}
              opacity={opacity}
              handleOpacityChange={handleOpacityChange}
              nestingLevel={nestingLevel + 1}
            />
          )}

          {/* Render child layers */}
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
                />
              );
            } else if (child.Name) {
              // Render leaf layer
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

// Individual Layer Item Component
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
  const layerId = `${layer.Name}-${groupId}`;

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
});

const AttributePopup = React.memo(({ position, data, onClose }) => {
  if (!position || !data) return null;

  const popupRef = useRef(null);

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (popupRef.current && !popupRef.current.contains(event.target)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const formatValue = (value) => {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'number') {
      return value % 1 === 0 ? value.toString() : value.toFixed(2);
    }
    return value.toString();
  };

  // Clean the key name for display
  const formatKeyName = (key) => {
    // Remove layer prefix and clean up
    let cleanKey = key
      .replace(/^layer_\d+_/, '') // Remove layer_1_, layer_2_, etc.
      .replace(/^Wildlife_Circle_Boundary_/, '') // Remove layer name prefix
      .replace(/_/g, ' ') // Replace underscores with spaces
      .replace(/\b\w/g, char => char.toUpperCase()); // Capitalize first letter of each word
    
    return cleanKey;
  };

  // Filter out geometry and long coordinate strings
  const filteredEntries = Object.entries(data).filter(([key, value]) => {
    // Skip geometry, coordinates, and any key containing 'geometry' or 'coord'
    if (key.toLowerCase().includes('geometry') || 
        key.toLowerCase().includes('coord') ||
        key === 'layer_1_geometry' ||
        key.includes('geometry')) {
      return false;
    }
    
    // Skip very long string values (likely coordinates)
    if (typeof value === 'string' && value.length > 100) {
      return false;
    }
    
    return true;
  });

  // Separate coordinates for display at the top
  const coordinates = data.coordinates || 
                     (data.layer_1_coordinates ? data.layer_1_coordinates : null);

  return (
    <div
      ref={popupRef}
      className="attribute-popup"
      style={{
        position: 'absolute',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 10000,
        backgroundColor: 'white',
        border: '1px solid #ccc',
        borderRadius: '4px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        padding: '15px',
        minWidth: '300px',
        maxWidth: '400px',
        maxHeight: '300px',
        overflow: 'auto',
        fontFamily:'arial'
      }}
    >
      <div className="attribute-popup-header" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '10px',
        borderBottom: '1px solid #eee',
        paddingBottom: '8px'
      }}>
        <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>
          Feature Information
        </h4>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '20px',
            cursor: 'pointer',
            color: '#666',
            padding: '0 5px'
          }}
        >
          ×
        </button>
      </div>
      
      <div className="attribute-popup-content">
        {/* Display coordinates at the top if available */}
        {coordinates && (
          <div style={{
            marginBottom: '15px',
            padding: '8px',
            backgroundColor: '#f5f5f5',
            borderRadius: '4px',
            fontSize: '12px'
          }}>
            <strong style={{ color: '#333' }}>Location:</strong>
            <span style={{ marginLeft: '8px', color: '#666' }}>
              {coordinates}
            </span>
          </div>
        )}

        {/* Display layer name if available */}
        {data.layer_1_name && (
          <div style={{
            marginBottom: '10px',
            padding: '8px',
            backgroundColor: '#e3f2fd',
            borderRadius: '4px',
            borderLeft: '4px solid #2196f3'
          }}>
            <strong style={{ color: '#1976d2' }}>Layer:</strong>
            <span style={{ marginLeft: '8px', color: '#0d47a1' }}>
              {data.layer_1_name}
            </span>
          </div>
        )}

        {/* Display all other attributes in a clean table */}
        {filteredEntries.length > 0 ? (
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '13px'
          }}>
            <tbody>
              {filteredEntries.map(([key, value], index) => {
                // Skip if this is coordinates or layer name (already displayed)
                if (key === 'coordinates' || key === 'layer_1_name') {
                  return null;
                }
                
                const formattedKey = formatKeyName(key);
                const formattedValue = formatValue(value);
                
                // Skip empty values
                if (!formattedValue || formattedValue === 'N/A') {
                  return null;
                }

                return (
                  <tr key={index} style={{
                    borderBottom: '1px solid #f0f0f0'
                  }}>
                    <td style={{
                      padding: '8px 8px 8px 0',
                      fontWeight: '600',
                      color: '#555',
                      verticalAlign: 'top',
                      width: '40%',
                      whiteSpace: 'nowrap'
                    }}>
                      {formattedKey}
                    </td>
                    <td style={{
                      padding: '8px 0 8px 8px',
                      color: '#333',
                      verticalAlign: 'top',
                      wordBreak: 'break-word'
                    }}>
                      {formattedValue}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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

const GEOSERVER_WMS = "https://www.gisfy.co.in:8445/geoserver/wms";



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
            // { Name: "Wildlife_Circle_Round_Boundary", Layer: "Wildlife Circle Round" },
            // { Name: "Wildlife_Circle_Beat_Boundary", Layer: "Wildlife Circle Beat" },
            // { Name: "Wildlife_Circle_Village_Boundary", Layer: "Wildlife Circle Village" },
        // {
        //   title: "Wildlife Boundaries",
        //   type: "group",
        //   children: [
        //     { Name: "Wildlife_Circle_Boundary", Layer: "Wildlife Circle" },
        //     { Name: "Wildlife_Circle_Division_Boundary", Layer: "Wildlife Circle Division" },
        //     { Name: "Wildlife_Circle_Range_Boundary", Layer: "Wildlife Circle Range" },
        //     { Name: "Wildlife_Circle_Round_Boundary", Layer: "Wildlife Circle Round" },
        //     { Name: "Wildlife_Circle_Beat_Boundary", Layer: "Wildlife Circle Beat" },
        //     { Name: "Wildlife_Circle_Village_Boundary", Layer: "Wildlife Circle Village" }
        //   ]
        // },
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
                    { Name: "savar_kundla", Layer: "Savar Kundala" },
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
                    { Name: "bhanvad", Layer: "Bhanvad" },
                    { Name: "ranavav", Layer: "Ranavav" }
                  ]
                }
              ]
            },
            {
              title: "Shetranjee Wildlife Division",
              type: "group",
              children: [
                // { Name: "shetranjee_wl", Layer: "Shetranjee WL" },
                {
                  title: "Ranges",
                  type: "group",
                  children: [
                    { Name: "talaja", Layer: "Talaja" }
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
                    { Name: "dediyapada", Layer: "Dediyapada" },
                    { Name: "fulsar", Layer: "Fulsar" },
                    { Name: "piplod", Layer: "Piplod" },
                    { Name: "rajpipla", Layer: "Rajpipla" },
                    { Name: "sagai", Layer: "Sagai" },
                    { Name: "sagbara", Layer: "Sagbara" },
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
        // {
        //   title: "Social Forestry Boundaries",
        //   type: "group",
        //   children: [
        //     { Name: "Social_Forestry_Circle_Boundary", Layer: "Social Forestry Circle" },
        //     { Name: "Social_Forestry_Range_Boundary", Layer: "Social Forestry Range" },
        //     { Name: "Social_Forestry_Round_Boundary", Layer: "Social Forestry Round" },
        //     { Name: "Social_Forestry_Beat_Boundary", Layer: "Social Forestry Beat" },
        //     { Name: "Social_Forestry_Village_Boundary", Layer: "Social Forestry Village" }
        //   ]
        // },
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
                    // { Name: "kalol", Layer: "Kalol" },
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
                    // { Name: "gadhada", Layer: "Gadhada" },
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
                    // { Name: "malia", Layer: "Malia" },
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
        // {
        //   title: "Territorial Boundaries",
        //   type: "group",
        //   children: [
        //     { Name: "Teritorial_Circle_Division_Boundary", Layer: "Territorial Circle Division" },
        //     { Name: "Teritorial_Circle_Range_Boundary", Layer: "Territorial Circle Range" },
        //     { Name: "Teritorial_Circle_Round_Boundary", Layer: "Territorial Circle Round" },
        //     { Name: "Teritorial_Circle_Beat_Boundary", Layer: "Territorial Circle Beat" },
        //     { Name: "Teritorial_Circle_Village_Boundary", Layer: "Territorial Circle Village" }
        //   ]
        // },
        {
          title: "Gandhinagar Circle",
          type: "group",
          children: [
            { Name: "gandhinagar", Layer: "Gandhinagar Circle" },
            {
              title: "Arvalli (Sabarkantha South Forest)",
              type: "group",
              children: [
                // { Name: "arvalli_forest_division", Layer: "Arvalli Forest Division" },
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
    { Name: "bharuch_coupe", Layer: "Bharuch" },
    { Name: "godhara_coupe", Layer: "Godhara" },
    { Name: "junagadh_coupe", Layer: "Junagadh" },
    { Name: "surat_coupe", Layer: "Surat" },
    { Name: "vyara_coupe", Layer: "Vyara" },
    { Name: "banaskantha_coupe", Layer: "Banaskantha" },
    { Name: "bhavnagar_coupe", Layer: "Bhavnagar" },
    { Name: "chhotaudepur_coupe_main", Layer: "Chhotaudepur" },
    { Name: "gandhinagar_coupe", Layer: "Gandhinagar" },
    { Name: "jamnagar_coupe", Layer: "Jamnagar" },
    { Name: "morbi_coupe", Layer: "Morbi" },
    { Name: "narmada_coupe", Layer: "Narmada" },
    { Name: "sabarkantha_coupe_", Layer: "Sabarkantha" },
    { Name: "sabarkantha_south_coupe", Layer: "Sabarkantha_South" },
    { Name: "surendranagar_coupe_main", Layer: "Surendranagar" },
  ]
}
  ]
};

// Coupes data (flat structure for now)
const coupesData = {
  groups: [
    {
      title: "Banaskantha",
      type: "flat",
      children: [
        { Name: "Con_Cum_Imp_WC_OVLP", Layer: "Banaskantha Con Cum Imp WC OVLP" },
        { Name: "Banaskantha_DesDev_WL_WC", Layer: "Banaskantha DesDev WL WC" },
        { Name: "Banaskantha_RWD_WC_final", Layer: "Banaskantha RWD WC Final" },
        { Name: "Banaskantha_Wild Life_WC", Layer: "Banaskantha Wildlife WC" }
      ]
    },
    {
      title: "Banni",
      type: "flat",
      children: [
        { Name: "Banni Forest", Layer: "Banni Forest" }
      ]
    },
    {
      title: "Baria",
      type: "flat",
      children: [
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
        { Name: "Vansi_DEV&CON W.C COUPE", Layer: "Vansi Dev&Con W.C Coupe" },
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
        { Name: "Sanjeli_Revenu_Boundary", Layer: "Sanjeli Revenue Boundary" }
      ]
    },
    {
      title: "Bharuch",
      type: "flat",
      children: [
        { Name: "Bharuch_Coupe_joined", Layer: "Bharuch Coupe Joined" }
      ]
    },
    {
      title: "Bhavnagar",
      type: "flat",
      children: [
        { Name: "Bhavnagar_coupes", Layer: "Bhavnagar Coupes" },
        { Name: "Bhavnagr_Shetrunjay_Ranges", Layer: "Bhavnagar Shetrunjay Ranges" },
        { Name: "Bhavnagr_Shetrunjay_WL_Divi", Layer: "Bhavnagar Shetrunjay WL Divi" }
      ]
    },
    {
      title: "Chhotaudepur",
      type: "flat",
      children: [
        { Name: "Chhotaudepur_CUD_Coupe_bdn", Layer: "Chhotaudepur CUD Coupe BDN" }
      ]
    },
    {
      title: "Gandhinagar",
      type: "flat",
      children: [
        { Name: "Gandhinagar_MM_Coupe", Layer: "Gandhinagar MM Coupe" }
      ]
    },
    {
      title: "Garbada",
      type: "flat",
      children: [
        { Name: "Garbada_Afforestation_Coupe", Layer: "Garbada Afforestation Coupe" },
        { Name: "Garbada_Develop &Conser Coupe", Layer: "Garbada Develop &Conser Coupe" },
        { Name: "Garbada_GR W.C COUPE", Layer: "Garbada GR W.C Coupe" },
        { Name: "Garbada_Revenue", Layer: "Garbada Revenue" }
      ]
    },
    {
      title: "Jamnagar",
      type: "flat",
      children: [
        { Name: "Jamnagar_coupes", Layer: "Jamnagar Coupes" }
      ]
    },
    {
      title: "Junagadh",
      type: "flat",
      children: [
        { Name: "Junagadh coupes", Layer: "Junagadh Coupes" }
      ]
    },
    {
      title: "Mahisagar",
      type: "flat",
      children: [
        { Name: "Mahisagar_all_Coupe_FF", Layer: "Mahisagar All Coupe FF" }
      ]
    },
    {
      title: "Merged Layers",
      type: "flat",
      children: [
        { Name: "Merged2", Layer: "Merged 2" },
        { Name: "Merged_coupes", Layer: "Merged Coupes" }
      ]
    },
    {
      title: "Morbi",
      type: "flat",
      children: [
        { Name: "Morbi_coupe_map", Layer: "Morbi Coupe Map" }
      ]
    },
    {
      title: "Narmada",
      type: "flat",
      children: [
        { Name: "Narmada_CP_FS2_compt4_RRB", Layer: "Narmada CP FS2 Compt4 RRB" }
      ]
    },
    {
      title: "Sabarkantha",
      type: "flat",
      children: [
        { Name: "Sabarkantha_North_Aravalli", Layer: "Sabarkantha North Aravalli" },
        { Name: "Sabarkantha_South_Aravalli", Layer: "Sabarkantha South Aravalli" }
      ]
    },
    {
      title: "Surat",
      type: "flat",
      children: [
        { Name: "Surat_all_Range_Coupe", Layer: "Surat All Range Coupe" }
      ]
    },
    {
      title: "Surendranagar",
      type: "flat",
      children: [
        { Name: "Surendranagar_coupe", Layer: "Surendranagar Coupe" }
      ]
    },
    {
      title: "Vyara",
      type: "flat",
      children: [
        { Name: "Vyara_MM_Coupe_Boundary", Layer: "Vyara MM Coupe Boundary" }
      ]
    }
  ]
};

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

const LayerTogglePanel = ({ mapRef, activeBasemap, setActiveBasemap, activeToolSidebar, isInfoToolActive }) => {
  const { language } = useLanguage();
  const [addedLayers, setAddedLayers] = useState({});
  const [opacity, setOpacity] = useState({});
  const [openGroups, setOpenGroups] = useState({});
  const [isLayerLoading, setIsLayerLoading] = useState(false);
  const [clickPosition, setClickPosition] = useState(null);
  const [attributeData, setAttributeData] = useState(null);
  const [showAttributeTable, setShowAttributeTable] = useState(false);
  const [isCoupesDataOpen, setIsCoupesDataOpen] = useState(false);
  
  const layerCounterRef = useRef(0);
  const clickHandlerRef = useRef(null);
  const layersInfoCache = useRef(new Map()); // Cache for GetFeatureInfo responses
  
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
    
    initializeNestedGroups(layersData.groups);
    
    coupesData.groups.forEach((_, idx) => {
      initialOpenState[`coupes-${idx}`] = false;
    });
    
    setOpenGroups(initialOpenState);
  }, []);

  const getLegendUrl = (layerName) => {
    return `${GEOSERVER_WMS}?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&WIDTH=20&HEIGHT=20&LAYER=${layerName}`;
  };






// Replace your entire getFeatureInfo function with this:

const getFeatureInfo = useCallback(async (latlng, layerName) => {
  const map = mapRef.current;
  if (!map) return null;
  
  const cacheKey = `${layerName}-${latlng.lat.toFixed(6)}-${latlng.lng.toFixed(6)}`;
  
  // Check cache first
  if (layersInfoCache.current.has(cacheKey)) {
    console.log(`Cache hit for ${layerName}`);
    return layersInfoCache.current.get(cacheKey);
  }

  try {
    const bounds = map.getBounds();
    const size = map.getSize();
    const point = map.latLngToContainerPoint(latlng);
    
    const params = new URLSearchParams({
      REQUEST: 'GetFeatureInfo',
      SERVICE: 'WMS',
      VERSION: '1.1.1',
      LAYERS: layerName,
      STYLES: '',
      SRS: 'EPSG:4326',
      BBOX: `${bounds.getSouthWest().lng},${bounds.getSouthWest().lat},${bounds.getNorthEast().lng},${bounds.getNorthEast().lat}`,
      WIDTH: size.x,
      HEIGHT: size.y,
      QUERY_LAYERS: layerName,
      INFO_FORMAT: 'application/json',
      X: Math.round(point.x),
      Y: Math.round(point.y),
      FEATURE_COUNT: 10,
      BUFFER: 10
    });

    const url = `${GEOSERVER_WMS}?${params.toString()}`;
    console.log('GetFeatureInfo URL:', url);
    
    // Simple fetch - proxy will handle CORS
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
    console.log('GetFeatureInfo response:', data);
    
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
  const handleMapClick = useCallback(async (e) => {
    if (!isInfoToolActive || !mapRef.current) return;
    
    const { latlng } = e;
    const containerPoint = mapRef.current.latLngToContainerPoint(latlng);
    
    // Get all visible layers
    const visibleLayers = Object.values(addedLayers);
    if (visibleLayers.length === 0) {
      // No layers to query
      setAttributeData({ 
        message: "No visible layers to query.",
        coordinates: `Lat: ${latlng.lat.toFixed(6)}, Lng: ${latlng.lng.toFixed(6)}`
      });
      setClickPosition({ x: containerPoint.x, y: containerPoint.y });
      return;
    }

    // Query each visible layer
    const queries = visibleLayers.map(async (layer) => {
      const layerName = layer._metadata?.name;
      if (!layerName) return null;
      
      console.log('Querying layer:', layerName);
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
        
        // Add coordinates first
        combinedData.coordinates = `Lat: ${latlng.lat.toFixed(6)}, Lng: ${latlng.lng.toFixed(6)}`;
        
        // Add layer results
        validResults.forEach((result, index) => {
          const layerKey = `layer_${index + 1}`;
          combinedData[`${layerKey}_name`] = result.layerName;
          
          // Add all properties from the feature info
          Object.entries(result.data).forEach(([key, value]) => {
            if (key !== 'geometry') {
              combinedData[`${layerKey}_${key}`] = value;
            }
          });
          
          // Add geometry if available
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
        console.log('Map click handler added for info tool');
      } else if (!isInfoToolActive && clickHandlerRef.current) {
        mapRef.current.off('click', clickHandlerRef.current);
        clickHandlerRef.current = null;
        console.log('Map click handler removed');
        
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
    // Search for layer title in all groups
    const findLayer = (groups) => {
      for (const group of groups) {
        if (group.children) {
          for (const child of group.children) {
            if (child.Name === layerName) {
              return child.Layer;
            }
            if (child.children) {
              const found = findLayer([child]);
              if (found) return found;
            }
          }
        } else if (group.Name === layerName) {
          return group.Layer;
        }
      }
      return layerName;
    };
    
    return findLayer(layersData.groups) || findLayer(coupesData.groups.map(g => ({ children: g.children }))) || layerName;
  };

  const calculateZIndex = () => {
    layerCounterRef.current += 1;
    return 1000 + layerCounterRef.current;
  };

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

        newLayer._metadata = {
          name: layerName,
          label: layerLabel
        };
        
        return new Promise((resolve) => {
          const timeout = setTimeout(() => {
            console.warn(`[addLayer] Timeout while loading "${layerName}" (15s)`);
            setIsLayerLoading(false);
            resolve(newLayer);
          }, 15000);

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

  const clearAllLayers = useCallback(async () => {
    try {
      // Clear cache when clearing all layers
      layersInfoCache.current.clear();
      
      // Remove all layers from the map
      const removePromises = Object.keys(addedLayers).map(async (uniqueKey) => {
        const layerName = uniqueKey.split('-')[0];
        await layerManager.removeLayer(layerName);
      });
      
      await Promise.all(removePromises);
      
      // Clear all states
      setAddedLayers({});
      setOpacity({});
      
      console.log("All layers cleared successfully");
    } catch (error) {
      console.error("Error clearing all layers:", error);
    }
  }, [addedLayers, layerManager]);


// In LayerTogglePanel.js - Update the API call to use proxy
const getLayerBoundsFromAPI = async (layerName) => {
  try {
    const cleanLayerName = layerName.replace(/^cite:/, '');
    
    // Use proxy URL - this will go through Vite proxy
    const response = await fetch(`${API_BASE_URL}/api/layer-bounds/${cleanLayerName}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error:', error);
    return null;
  }
};
// Update your toggleLayer function
const toggleLayer = useCallback(
  async (layerConfig, groupId) => {
    const uniqueKey = `${layerConfig.Name}-${groupId}`;

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

        // Get bounds from API and zoom
        setTimeout(async () => {
          try {
            const bounds = await getLayerBoundsFromAPI(layerConfig.Name);
            
            if (bounds && mapRef.current) {
              // Create bounds from the API response
              const sw = L.latLng(bounds.minY, bounds.minX);
              const ne = L.latLng(bounds.maxY, bounds.maxX);
              const layerBounds = L.latLngBounds(sw, ne);
              
              console.log(`🎯 Zooming to ${layerConfig.Name}:`, {
                sw: [bounds.minY, bounds.minX],
                ne: [bounds.maxY, bounds.maxX]
              });
              
              // Zoom to bounds with animation
              mapRef.current.fitBounds(layerBounds, {
                padding: [50, 50],
                maxZoom: 14,
                animate: true,
                duration: 1
              });
              
              // Optional: Add a marker at the centroid
              // if (bounds.centroid) {
              //   L.marker([bounds.centroid.y, bounds.centroid.x], {
              //     title: layerConfig.Layer,
              //     icon: L.divIcon({
              //       className: 'centroid-marker',
              //       html: '📍',
              //       iconSize: [20, 20]
              //     })
              //   }).addTo(mapRef.current)
              //     .bindPopup(`
              //       <div style="font-family: Arial, sans-serif; padding: 5px;">
              //         <h4 style="margin: 0 0 5px 0; color: #2c3e50;">${layerConfig.Layer}</h4>
              //         <hr style="margin: 5px 0;">
              //         <table style="border-collapse: collapse; width: 100%;">
              //           <tr><td><strong>Division:</strong></td><td>${bounds.metadata?.division || 'N/A'}</td></tr>
              //           <tr><td><strong>Range:</strong></td><td>${bounds.metadata?.range || 'N/A'}</td></tr>
              //           <tr><td><strong>Circle:</strong></td><td>${bounds.metadata?.circle || 'N/A'}</td></tr>
              //           <tr><td><strong>Features:</strong></td><td>${bounds.featureCount || 'N/A'}</td></tr>
              //           <tr><td><strong>Centroid:</strong></td><td>${bounds.centroid.y.toFixed(6)}, ${bounds.centroid.x.toFixed(6)}</td></tr>
              //         </table>
              //       </div>
              //     `);
              // }
              
              console.log(`✅ Successfully zoomed to ${layerConfig.Name}`);
            } else {
              console.warn(`⚠️ No bounds found for ${layerConfig.Name}, using fallback`);
              // Fallback to WMS GetCapabilities
              const wmsBounds = await getLayerBoundsSimple(layerConfig.Name);
              if (wmsBounds && mapRef.current) {
                const sw = L.latLng(wmsBounds.minY, wmsBounds.minX);
                const ne = L.latLng(wmsBounds.maxY, wmsBounds.maxX);
                mapRef.current.fitBounds(L.latLngBounds(sw, ne), {
                  padding: [50, 50],
                  maxZoom: 12
                });
              }
            }
          } catch (error) {
            console.error(`❌ Error zooming to layer ${layerConfig.Name}:`, error);
          }
        }, 1000); // Wait 1 second for layer to load
      }
    } catch (err) {
      console.error(`❌ Layer toggle failed for ${layerConfig.Name}:`, err);
      setIsLayerLoading(false);
    }
  },
  [addedLayers, layerManager, mapRef]
);

// Add this function to get layer bounds via WFS
// Add this function to get layer bounds via WFS
const getLayerBounds = async (layerName) => {
  try {
    // Try WFS GetFeature with JSON output first
    const params = new URLSearchParams({
      SERVICE: 'WFS',
      VERSION: '2.0.0', // Try newer version
      REQUEST: 'GetFeature',
      TYPENAME: layerName,
      OUTPUTFORMAT: 'application/json', // Explicitly request JSON
      SRSNAME: 'EPSG:4326',
      COUNT: 1, // Only get 1 feature
      PROPERTYNAME: 'none' // Don't fetch attributes, just geometry/bbox
    });

    const url = `${GEOSERVER_WMS}?${params.toString()}`;
    console.log('Getting bounds for layer:', url);
    
    const response = await fetch(url);
    const contentType = response.headers.get('content-type');
    
    // Handle JSON response
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      return extractBoundsFromGeoJSON(data, layerName);
    } 
    // Handle XML response (capabilities or error)
    else {
      const text = await response.text();
      
      // Check if it's an error XML
      if (text.includes('ServiceException')) {
        console.warn('WFS GetFeature failed, trying WMS GetCapabilities...');
        // Fallback to WMS GetCapabilities
        return await getLayerBoundsFromWMSCapabilities(layerName);
      }
      
      // Try to parse as WFS GetFeature response in XML format
      return extractBoundsFromWFSXML(text, layerName);
    }
  } catch (error) {
    console.error('Error in primary bounds method:', error);
    
    // Fallback to WMS GetCapabilities
    try {
      return await getLayerBoundsFromWMSCapabilities(layerName);
    } catch (fallbackError) {
      console.error('All bounds retrieval methods failed:', fallbackError);
      return null;
    }
  }
};

// Extract bounds from GeoJSON response
const extractBoundsFromGeoJSON = (data, layerName) => {
  if (data.bbox) {
    return {
      minX: data.bbox[0],
      minY: data.bbox[1],
      maxX: data.bbox[2],
      maxY: data.bbox[3]
    };
  } else if (data.features && data.features.length > 0) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    data.features.forEach(feature => {
      if (feature.bbox) {
        minX = Math.min(minX, feature.bbox[0]);
        minY = Math.min(minY, feature.bbox[1]);
        maxX = Math.max(maxX, feature.bbox[2]);
        maxY = Math.max(maxY, feature.bbox[3]);
      } else if (feature.geometry) {
        // Calculate bounds from geometry
        const bounds = calculateBoundsFromGeometry(feature.geometry);
        if (bounds) {
          minX = Math.min(minX, bounds.minX);
          minY = Math.min(minY, bounds.minY);
          maxX = Math.max(maxX, bounds.maxX);
          maxY = Math.max(maxY, bounds.maxY);
        }
      }
    });
    
    if (minX !== Infinity) {
      return { minX, minY, maxX, maxY };
    }
  }
  return null;
};

// Extract bounds from WFS XML response
const extractBoundsFromWFSXML = (xmlText, layerName) => {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    
    // Check for wfs:FeatureCollection
    const featureCollection = xmlDoc.querySelector('FeatureCollection, wfs\\:FeatureCollection');
    if (featureCollection) {
      const bbox = featureCollection.querySelector('bbox, ogc\\:bbox, gml\\:boundedBy');
      if (bbox) {
        const corners = bbox.querySelectorAll('coord, gml\\:coord, coordinates, gml\\:coordinates');
        // Extract bounds from GML format
        // This is simplified - you might need to adjust based on your GML format
      }
    }
    
    // If we can't parse XML bounds, try WMS capabilities as fallback
    return null;
  } catch (error) {
    console.error('Error parsing WFS XML:', error);
    return null;
  }
};

// Get bounds from WMS GetCapabilities
const getLayerBoundsFromWMSCapabilities = async (layerName) => {
  try {
    const params = new URLSearchParams({
      SERVICE: 'WMS',
      VERSION: '1.3.0',
      REQUEST: 'GetCapabilities'
    });

    const url = `${GEOSERVER_WMS}?${params.toString()}`;
    console.log('Getting bounds from WMS capabilities:', url);
    
    const response = await fetch(url);
    const text = await response.text();
    
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(text, 'text/xml');
    
    // Find the layer by name
    const layers = xmlDoc.getElementsByTagName('Layer');
    for (let layer of layers) {
      const name = layer.getElementsByTagName('Name')[0]?.textContent;
      const title = layer.getElementsByTagName('Title')[0]?.textContent;
      
      if (name === layerName || title === layerName) {
        // Try different bounding box formats
        const bbox = layer.getElementsByTagName('LatLonBoundingBox')[0] ||
                    layer.getElementsByTagName('EX_GeographicBoundingBox')[0] ||
                    layer.getElementsByTagName('BoundingBox')[0];
        
        if (bbox) {
          // For LatLonBoundingBox
          if (bbox.tagName === 'LatLonBoundingBox') {
            return {
              minX: parseFloat(bbox.getAttribute('minx')),
              minY: parseFloat(bbox.getAttribute('miny')),
              maxX: parseFloat(bbox.getAttribute('maxx')),
              maxY: parseFloat(bbox.getAttribute('maxy'))
            };
          }
          // For EX_GeographicBoundingBox
          else if (bbox.tagName === 'EX_GeographicBoundingBox') {
            const westBound = bbox.getElementsByTagName('westBoundLongitude')[0]?.textContent;
            const eastBound = bbox.getElementsByTagName('eastBoundLongitude')[0]?.textContent;
            const southBound = bbox.getElementsByTagName('southBoundLatitude')[0]?.textContent;
            const northBound = bbox.getElementsByTagName('northBoundLatitude')[0]?.textContent;
            
            if (westBound && eastBound && southBound && northBound) {
              return {
                minX: parseFloat(westBound),
                minY: parseFloat(southBound),
                maxX: parseFloat(eastBound),
                maxY: parseFloat(northBound)
              };
            }
          }
          // For generic BoundingBox
          else {
            return {
              minX: parseFloat(bbox.getAttribute('minx') || bbox.getAttribute('minX')),
              minY: parseFloat(bbox.getAttribute('miny') || bbox.getAttribute('minY')),
              maxX: parseFloat(bbox.getAttribute('maxx') || bbox.getAttribute('maxX')),
              maxY: parseFloat(bbox.getAttribute('maxy') || bbox.getAttribute('maxY'))
            };
          }
        }
      }
    }
    
    // If layer not found or no bounds, try to get from WMS DescribeLayer
    return await getLayerBoundsFromWMSDescribeLayer(layerName);
  } catch (error) {
    console.error('Error getting bounds from WMS capabilities:', error);
    return null;
  }
};

// Additional fallback using WMS DescribeLayer
const getLayerBoundsFromWMSDescribeLayer = async (layerName) => {
  try {
    const params = new URLSearchParams({
      SERVICE: 'WMS',
      VERSION: '1.1.1',
      REQUEST: 'DescribeLayer',
      LAYERS: layerName,
      OUTPUTFORMAT: 'application/json'
    });

    const url = `${GEOSERVER_WMS}?${params.toString()}`;
    const response = await fetch(url);
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      if (data.owsType === 'WFS' && data.wfs) {
        // If it points to a WFS layer, try to get bounds from there
        return await getLayerBounds(data.wfs.typeName || layerName);
      }
    }
  } catch (error) {
    console.error('Error in DescribeLayer:', error);
  }
  return null;
};

// Helper function to calculate bounds from geometry
const calculateBoundsFromGeometry = (geometry) => {
  if (!geometry) return null;
  
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  
  const processCoordinates = (coords) => {
    if (Array.isArray(coords) && Array.isArray(coords[0])) {
      coords.forEach(coord => processCoordinates(coord));
    } else if (Array.isArray(coords) && typeof coords[0] === 'number') {
      minX = Math.min(minX, coords[0]);
      minY = Math.min(minY, coords[1]);
      maxX = Math.max(maxX, coords[0]);
      maxY = Math.max(maxY, coords[1]);
    }
  };
  
  if (geometry.coordinates) {
    processCoordinates(geometry.coordinates);
  }
  
  if (minX !== Infinity) {
    return { minX, minY, maxX, maxY };
  }
  return null;
};

// Simplified version if you just want something that works quickly:
const getLayerBoundsSimple = async (layerName) => {
  try {
    const cleanLayerName = layerName.replace(/^cite:/, '');
    
    // Use WMS GetCapabilities
    const capsUrl = `${GEOSERVER_WMS}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities`;
    const response = await fetch(capsUrl);
    const text = await response.text();
    
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(text, 'text/xml');
    
    // Find the layer
    const layers = xmlDoc.getElementsByTagName('Layer');
    for (let layer of layers) {
      const nameElement = layer.getElementsByTagName('Name')[0];
      if (!nameElement) continue;
      
      const name = nameElement.textContent;
      if (name === cleanLayerName || name === `cite:${cleanLayerName}`) {
        const bbox = layer.getElementsByTagName('LatLonBoundingBox')[0];
        if (bbox) {
          return {
            minX: parseFloat(bbox.getAttribute('minx')),
            minY: parseFloat(bbox.getAttribute('miny')),
            maxX: parseFloat(bbox.getAttribute('maxx')),
            maxY: parseFloat(bbox.getAttribute('maxy'))
          };
        }
      }
    }
    
    // Default Gujarat bounds
    return {
      minX: 68.5,
      minY: 20.5,
      maxX: 74.5,
      maxY: 24.5
    };
    
  } catch (error) {
    console.error('Error:', error);
    return {
      minX: 68.5,
      minY: 20.5,
      maxX: 74.5,
      maxY: 24.5
    };
  }
};


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

  // Render groups based on type
  const renderGroup = (group, index, section = "layers") => {
    const groupId = `${section}-${index}`;
    
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
        />
      );
    } else {
      // Flat group (for backward compatibility)
      return (
        <div key={groupId} className="layer-group flat-group">
          <button
            type="button"
            className="group-title"
            onClick={() => toggleGroup(groupId)}
            aria-expanded={openGroups[groupId] ? "true" : "false"}
          >
            <span className="group-title-content">
              <FaLayerGroup style={{ marginRight: "8px" }} />
              {group.title}
            </span>
            <span className="arrow-icon">
              {openGroups[groupId] ? <FaChevronUp /> : <FaChevronDown />}
            </span>
          </button>
          
          {openGroups[groupId] && group.children && (
            <div className="layer-list-wrapper expanded">
              {group.children.map((layer, layerIndex) => {
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
          )}
        </div>
      );
    }
  };

  // Legend Component
  const LegendPanel = () => {
    const activeLayers = Object.keys(addedLayers);
    
    if (activeLayers.length === 0) {
      return null;
    }

    return (
      <div className="legend-panel">
        <h4 className="legend-title">Map Legend</h4>
        <div className="legend-items-container">
          {activeLayers.map((layerKey) => {
            const layerName = layerKey.split('-')[0]; // Extract layer name from key
            return (
              <div key={layerKey} className="legend-item">
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
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <>
      <LegendPanel />
      
      <aside className="leftpanel">
        <h3 className="sidebar-title">
          <FaLayerGroup style={{ marginRight: "8px" }} />
          {text[language].exploreData}
          <button 
          style={{
            alignItems: 'end',
            marginLeft: 'auto',
            backgroundColor: '#e74c3c',
            color: '#fff',
            border: 'none', 
            padding: '5px 10px',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
            onClick={clearAllLayers}
            className="clear-all-btn"
            title="Clear all layers"
            disabled={Object.keys(addedLayers).length === 0}
          >
            Clear All
          </button>
        </h3>
        
        <div className="layer-groups-container">
          {layersData.groups.map((group, idx) => renderGroup(group, idx, "layers"))}
        </div>
        
        {/* <div className="coupeboundary" onClick={() => setIsCoupesDataOpen(!isCoupesDataOpen)}>
          <h3 style={{ cursor: 'pointer', fontSize: "14px", marginLeft: "10px" }}>
            <MdForest style={{ marginLeft: "8px", fontSize: "17px" }} />
            <span style={{ marginLeft: "8px" }}>{text[language].coupesData}</span>
          </h3>
          <span style={{ cursor: 'pointer', marginRight: "15px" }}>
            {isCoupesDataOpen ? '▼' : '▶'}
          </span>
        </div> */}
      
        {isCoupesDataOpen && (
          <div className="layer-groups-container">
            {coupesData.groups.map((group, idx) => renderGroup(group, idx, "coupes"))}
          </div>
        )}
        
        {isLayerLoading && <Loader />}
      </aside>
      
      <AttributePopup
        position={clickPosition}
        data={attributeData}
        onClose={() => {
          setAttributeData(null);
          setClickPosition(null);
        }}
      />
    </>
  );
};

export default LayerTogglePanel;
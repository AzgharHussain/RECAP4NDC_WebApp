import React, { useState, useEffect, useRef, useCallback } from "react";
import { FaChevronDown, FaChevronUp, FaLayerGroup } from "react-icons/fa";
import "./LayerTogglePanel.css";
import { useLanguage } from "../context/LanguageContext";
import L from "leaflet";

const GEOSERVER_WMS = "https://www.gisfy.co.in:8443/geoserver/wms";

   const layersData = {
  groups: [
    {
      title: "Gujarat State Boundaries",
      layerList: [
        { Name: "Gujarat_Forest_Area_Boundary_March_2023", Layer: "Gujarat Forest Area Boundary" },
       
        { Name: "Gujarat_State_Boundary", Layer: "Gujarat State Boundary" },
      ]
    },
 {
      title: "Territorial Circle Boundaries",
      layerList: [
        { Name: "Teritorial Circle_Beat_Boundary", Layer: "Territorial Circle Beat Boundary" },
        { Name: "Teritorial Circle_Division_Boundary", Layer: "Territorial Circle Division Boundary" },
        { Name: "Teritorial Circle_Range_Boundary", Layer: "Territorial Circle Range Boundary" },
        { Name: "Teritorial Circle_Round_Boundary", Layer: "Territorial Circle Round Boundary" },
        { Name: "Teritorial Circle_Village_Boundary", Layer: "Territorial Circle Village Boundary" },
        { Name: "Teritorial_Circle_Boundary", Layer: "Territorial Circle Boundary" },
      ]
    },{
      title: "Wildlife Circle Boundaries",
      layerList: [
        { Name: "Wildlife_Circle_Beat_Boundary", Layer: "Wildlife Circle Beat Boundary" },
        { Name: "Wildlife_Circle_Boundary", Layer: "Wildlife Circle Boundary" },
        { Name: "Wildlife_Circle_Division_Boundary", Layer: "Wildlife Circle Division Boundary" },
        { Name: "Wildlife_Circle_Range_Boundary", Layer: "Wildlife Circle Range Boundary" },
        { Name: "Wildlife_Circle_Round_Boundary", Layer: "Wildlife Circle Round Boundary" },
        { Name: "Wildlife_Circle_Village_Boundary", Layer: "Wildlife Circle Village Boundary" },
      ]
    },
      
    {
      title:"social Forestry Boundaries",
      layerList:[
       { Name: "Gujarat_Social_Forestry_Beat_Boundary", Layer: "Social Forestry Beat Boundary" },
        { Name: "Gujarat_Social_Forestry_Circle_Boundary", Layer: "Social Forestry Circle Boundary" },
        { Name: "Gujarat_Social_Forestry_Range_Boundary", Layer: "Social Forestry Range Boundary" },
        { Name: "Gujarat_Social_Forestry_Round_Boundary", Layer: "Social Forestry Round Boundary" },
        { Name: "Gujarat_Social_Forestry_Village_Boundary", Layer: "Social Forestry Village Boundary" },
      ]
    },
    {
      title: "Banaskantha",
      layerList: [
        { Name: "Banaskantha_Con_Cum_Imp_WC_OVLP", Layer: "Banaskantha Con Cum Imp WC OVLP" },
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
    {
      title: "Dohad",
      layerList: [
        { Name: "DOHAD_AFFORESTATION W.C COUPE", Layer: "Dohad Afforestation W.C Coupe" },
        { Name: "DOHAD_D_DEVELOPMENT&CONSERVATION COUPE", Layer: "Dohad Dev&Conservation Coupe" },
        { Name: "DOHAD_GRASSBIR W.C COUPE", Layer: "Dohad Grassbir W.C Coupe" },
        { Name: "DOHAD_PRO", Layer: "Dohad Pro" },
        { Name: "DOHAD_REVENUE", Layer: "Dohad Revenue" },
      ]
    },
    {
      title: "Fatepura",
      layerList: [
        { Name: "FATEPURA_AFFORESTATION W.C _COUPE", Layer: "Fatepura Afforestation W.C Coupe" },
        { Name: "FATEPURA_Revenu_Boundary", Layer: "Fatepura Revenue Boundary" },
      ]
    },
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
    {
      title: "Jhalod",
      layerList: [
        { Name: "Jhalod_AFFORESTATION W.C_COUPE", Layer: "Jhalod Afforestation W.C Coupe" },
        { Name: "Jhalod_GRASSBIR W.C COUPE", Layer: "Jhalod Grassbir W.C Coupe" },
        { Name: "Jhalod_J_DEVELO&CON W.C COUPE", Layer: "Jhalod Dev&Con W.C Coupe" },
        { Name: "Jhalod_Revenue", Layer: "Jhalod Revenue" },
      ]
    },
    {
      title: "Junagadh",
      layerList: [
        { Name: "Junagadh coupes", Layer: "Junagadh Coupes" },
      ]
    },
    {
      title: "Kanjeta",
      layerList: [
        { Name: "Kanjeta_AFF W.C COUPE", Layer: "Kanjeta Aff W.C Coupe" },
        { Name: "Kanjeta_DEVELOPMENT&CONSERVATION W.C COUPE", Layer: "Kanjeta Dev&Conservation W.C Coupe" },
        { Name: "Kanjeta_Revenue", Layer: "Kanjeta Revenue" },
      ]
    },
    {
      title: "Limkheda",
      layerList: [
        { Name: "Limkhed_Revenue", Layer: "Limkhed Revenue" },
        { Name: "Limkheda_DEVELOPMENT&CONSERVATION W.C COUPE", Layer: "Limkheda Dev&Conservation W.C Coupe" },
        { Name: "Limkheda_L_AFFORESTATION W.C COUPE", Layer: "Limkheda Afforestation W.C Coupe" },
        { Name: "Limkheda_L_GRASSBIR W.C COUPE", Layer: "Limkheda Grassbir W.C Coupe" },
      ]
    },
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
    {
      title: "Raampura",
      layerList: [
        { Name: "Raaampura_R_AFFORESTATION COUPE", Layer: "Raampura Afforestation Coupe" },
        { Name: "Rampura_R_GRASSBIR COUPE", Layer: "Rampura Grassbir Coupe" },
        { Name: "Rampura_Revenue", Layer: "Rampura Revenue" },
      ]
    },
    {
      title: "Randhikpur",
      layerList: [
        { Name: "Randhikpur_RAN_AFFO W.C COUPE", Layer: "Randhikpur Affo W.C Coupe" },
        { Name: "Randhikpur_RAN_DEV&CON W.C COUPE", Layer: "Randhikpur Dev&Con W.C Coupe" },
        { Name: "Randhikpur_RAN_GRASSBIR W.C COUPE", Layer: "Randhikpur Grassbir W.C Coupe" },
        { Name: "Randhikpur_REVENUE", Layer: "Randhikpur Revenue" },
      ]
    },
    {
      title: "Sagtala",
      layerList: [
        { Name: "SAGTALA_BIODI W.C COUPE", Layer: "Sagtala Biodi W.C Coupe" },
        { Name: "SAGTALA_DEV&CON W.C COUPE", Layer: "Sagtala Dev&Con W.C Coupe" },
      ]
    },
    {
      title: "Sabarkantha",
      layerList: [
        { Name: "Sabarkantha_North_Aravalli", Layer: "Sabarkantha North Aravalli" },
        { Name: "Sabarkantha_South_Aravalli", Layer: "Sabarkantha South Aravalli" },
      ]
    },
    {
      title: "Sanjeli",
      layerList: [
        { Name: "Sanjeli_AFFORESTATION W.C _COUPE", Layer: "Sanjeli Afforestation W.C Coupe" },
        { Name: "Sanjeli_DEVELO&CON W.C COUPE", Layer: "Sanjeli Dev&Con W.C Coupe" },
        { Name: "Sanjeli_G.S.F.D.C.AREA", Layer: "Sanjeli GSFDC Area" },
        { Name: "Sanjeli_GRASSBIR W.C COUPE", Layer: "Sanjeli Grassbir W.C Coupe" },
        { Name: "Sanjeli_Revenu_Boundary", Layer: "Sanjeli Revenue Boundary" },
      ]
    },
    {
      title: "Sarjumi",
      layerList: [
        { Name: "Sarjumi_AFFORESTATION W.C COUPE", Layer: "Sarjumi Afforestation W.C Coupe" },
        { Name: "Sarjumi_DEV&CON W.C COUPE", Layer: "Sarjumi Dev&Con W.C Coupe" },
        { Name: "Sarjumi_GRASSBIR W.C COUPE", Layer: "Sarjumi Grassbir W.C Coupe" },
        { Name: "Sarjumi_REVENUE", Layer: "Sarjumi Revenue" },
      ]
    },
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
   
    {
      title: "Vansi",
      layerList: [
        { Name: "Vansi_AFF W.C COUPE", Layer: "Vansi Aff W.C Coupe" },
        { Name: "Vansi_BIO W.C COUPE", Layer: "Vansi Bio W.C Coupe" },
        { Name: "Vansi_DEV&CON W.C  COUPE", Layer: "Vansi Dev&Con W.C Coupe" },
        { Name: "Vansi_Revenue", Layer: "Vansi Revenue" },
      ]
    },
    {
      title: "Vyara",
      layerList: [
        { Name: "Vyara_MM_Coupe_Boundary", Layer: "Vyara MM Coupe Boundary" },
      ]
    },
    
  ]
}






  // Text content
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


const getLayerName = (layer) => layer.Name || layer.layer || layer;

const LayerTogglePanel = ({ mapRef, activeBasemap, setActiveBasemap }) => {
  const { language } = useLanguage();
  const [addedLayers, setAddedLayers] = useState({});
  const [opacity, setOpacity] = useState({});
  const [openGroups, setOpenGroups] = useState({});
  const [isLayerLoading, setIsLayerLoading] = useState(false);

  // Initialize open groups
  useEffect(() => {
    const initialOpenState = {};
    layersData.groups.forEach((_, idx) => {
      initialOpenState[idx] = false;
    });
    setOpenGroups(initialOpenState);
  }, []);

 

  // Calculate z-index
  const calculateZIndex = (layerName, currentLayers) => 1000 + Object.keys(currentLayers).length;

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
      });
    } catch (error) {
      console.error(`Error creating layer ${layerName}:`, error);
      return null;
    }
  };

  // Layer manager
  const layerManager = useCallback(
    {
      addLayer: async (layerName, layerLabel) => {
        if (!mapRef.current) {
          console.error("[addLayer] Map reference not initialized.");
          return null;
        }

        setIsLayerLoading(true);
        try {
          const zIndex = calculateZIndex(layerName, addedLayers);
          const newLayer = createLayer(layerName, layerLabel, zIndex);
          if (!newLayer) throw new Error("Layer creation failed");

          newLayer.addTo(mapRef.current);
          return new Promise((resolve) => {
            const timeout = setTimeout(() => {
              console.warn(`[addLayer] Timeout while loading "${layerName}" (15s)`);
              setIsLayerLoading(false);
              resolve(newLayer);
            }, 995000);

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
        const layer = addedLayers[layerName];
        if (layer && mapRef.current?.hasLayer(layer)) {
          return new Promise((resolve) => {
            mapRef.current.removeLayer(layer);
            layer.off();
            setTimeout(() => resolve(true), 0);
          });
        }
        return Promise.resolve(false);
      },

      setLayerOpacity: (layerName, opacityValue) => {
        const layer = addedLayers[layerName];
        if (layer && mapRef.current?.hasLayer(layer)) {
          layer.setOpacity(opacityValue);
        }
      },
    },
    [mapRef, addedLayers]
  );

  // Toggle layer
  const toggleLayer = useCallback(
    async (layerName, layerLabel) => {
      const previousBasemap = activeBasemap;
      try {
        if (addedLayers[layerName]) {
          await layerManager.removeLayer(layerName);
          setAddedLayers((prev) => {
            const { [layerName]: _, ...rest } = prev;
            return rest;
          });
          setOpacity((prev) => {
            const { [layerName]: _, ...rest } = prev;
            return rest;
          });
        } else {
          const layer = await layerManager.addLayer(layerName, layerLabel);
          if (!layer) throw new Error(`Failed to add layer: ${layerName}`);
          const layerOpacity = 0.7;
          setAddedLayers((prev) => ({ ...prev, [layerName]: layer }));
          setOpacity((prev) => ({ ...prev, [layerName]: layerOpacity }));
          layer.setOpacity(layerOpacity);
        }
      } catch (err) {
        console.error(`Layer toggle failed for ${layerName}:`, err);
        setActiveBasemap(previousBasemap);
        setIsLayerLoading(false);
      }
    },
    [addedLayers, layerManager, setActiveBasemap, activeBasemap]
  );

  // Toggle group
  const toggleGroup = useCallback((idx) => {
    setOpenGroups((prev) => ({ ...prev, [idx]: !prev[idx] }));
  }, []);

  // Handle opacity change
  const handleOpacityChange = useCallback(
    (e, layerName) => {
      const newOpacity = parseFloat(e.target.value);
      setOpacity((prev) => ({ ...prev, [layerName]: newOpacity }));
      layerManager.setLayerOpacity(layerName, newOpacity);
    },
    [layerManager]
  );

  // Cleanup on unmount
  useEffect(
    () => () => {
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
    },
    [mapRef, addedLayers]
  );

  // LayerGroup component
  const LayerGroup = React.memo(
    ({
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
    }) => {
      return (
        <div className="layer-group">
          <button
            type="button"
            className="group-title"
            onClick={() => toggleGroup(idx)}
            aria-expanded={openGroups[idx] ? "true" : "false"}
          >
            <span className="group-title-content">
              {icon && <span style={{ marginRight: 8, fontSize: 18, color: "#0b9700" }}>{icon}</span>}
              {group.title}
            </span>
            <span className="arrow-icon">
              {openGroups[idx] ? <FaChevronUp /> : <FaChevronDown />}
            </span>
          </button>

          <div className={`layer-list-wrapper ${openGroups[idx] ? "expanded" : "collapsed"}`}>
            {group.layerList.map((layer, index) => {
              const layerName = getLayerName(layer);
              const isChecked = !!addedLayers[layerName];
              const isDisabled = loadingLayers && !isChecked;

              return (
                <div key={`${group.title}-${layerName}-${index}`} className="layer-item">
                  <label className="layer-label-container">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleLayer(layerName, layer.Layer)}
                      disabled={isDisabled}
                    />
                    <span
                      className={`layer-label ${isChecked ? "layer-label-bold" : ""} ${
                        isDisabled ? "layer-label-disabled" : ""
                      }`}
                    >
                      {layer.Layer}
                      {isDisabled && <span className="loading-dots">...</span>}
                    </span>
                  </label>

                  {isChecked && (
                    <div className="opacity-control">
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={opacity[layerName] ?? 0.7}
                        onChange={(e) => handleOpacityChange(e, layerName)}
                      />
                      <span className="opacity-value">
                        {Math.round((opacity[layerName] ?? 0.7) * 100)}%
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
    }
  );

  return (
    <aside className="leftpanel">
      <h3 className="sidebar-title">
        <FaLayerGroup style={{ marginRight: "8px" }} />
        {text[language].exploreData}
      </h3>
      <div className="layer-groups-container">
        {layersData.groups.map((group, idx) => (
          <LayerGroup
            key={`${group.title}-${idx}`}
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
          />
        ))}
      </div>
      {isLayerLoading && (
        <div className="global-loading-indicator">
          <div className="loading-spinner"></div>
          <span>Loading layer...</span>
        </div>
      )}
    </aside>
  );
};

export default LayerTogglePanel;
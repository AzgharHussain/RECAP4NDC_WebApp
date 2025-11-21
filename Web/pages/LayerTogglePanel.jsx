import React, { useState, useEffect, useRef, useCallback } from "react";
import { FaChevronDown, FaChevronUp } from "react-icons/fa";
import "./LayerTogglePanel.css";
import { useLanguage } from "../context/LanguageContext";
import ForestHierarchyDropdowns from "./dropdown";
import L from "leaflet";

const GEOSERVER_WMS = "https://www.gisfy.co.in:8443/geoserver/wms";
const CAPABILITIES_URL = `${GEOSERVER_WMS}?service=WMS&version=1.3.0&request=GetCapabilities`;
const LEGEND_BASE = `${GEOSERVER_WMS}?REQUEST=GetLegendGraphic&FORMAT=image/png&VERSION=1.0.0&TRANSPARENT=true&WIDTH=20&HEIGHT=200&LAYER=`;

const LeftSidebar = ({
  mapRef,
  showDistrictLayer,
  setShowDistrictLayer,
  setShowPatrollingLayer,
  showPatrollingLayer,
  showIncidentLayer,
  setShowIncidentLayer,
  onFilter,
}) => {
  const { language } = useLanguage();

  const [selectedYear, setSelectedYear] = useState("2025");
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

  // refs to store created layers and capabilities cache
  const layersRef = useRef({}); // { layerKey: L.TileLayer.WMS }
  const capabilitiesRef = useRef(null);
  const legendControlRef = useRef(null);
  const mapAddedLegend = useRef(false);

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

  const toggleSection = (section) =>
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));

  const handleFilterClick = () => {
    if (!fromDate && !toDate) return;
    onFilter({ fromDate, toDate });
  };

  // Utility: fetch and cache capabilities
  const ensureCapabilities = useCallback(async () => {
    if (capabilitiesRef.current) return capabilitiesRef.current;
    try {
      const res = await fetch(CAPABILITIES_URL);
      const textDoc = await res.text();
      const parser = new DOMParser();
      const xml = parser.parseFromString(textDoc, "text/xml");
      capabilitiesRef.current = xml;
      return xml;
    } catch (err) {
      console.error("GetCapabilities failed:", err);
      return null;
    }
  }, []);

  // Utility: find bounding box for a layer from capabilities xml
  const getLayerBoundsFromCapabilities = async (layerName) => {
    const xml = await ensureCapabilities();
    if (!xml) return null;
    const layers = xml.getElementsByTagName("Layer");
    for (let i = 0; i < layers.length; i++) {
      const nameEl = layers[i].getElementsByTagName("Name")[0];
      if (!nameEl) continue;
      const name = nameEl.textContent;
      if (name === layerName) {
        // try EX_GeographicBoundingBox (WMS 1.3.0) or LatLonBoundingBox (1.1.1)
        const ex = layers[i].getElementsByTagName("EX_GeographicBoundingBox")[0];
        if (ex) {
          const west = parseFloat(ex.getElementsByTagName("westBoundLongitude")[0].textContent);
          const east = parseFloat(ex.getElementsByTagName("eastBoundLongitude")[0].textContent);
          const south = parseFloat(ex.getElementsByTagName("southBoundLatitude")[0].textContent);
          const north = parseFloat(ex.getElementsByTagName("northBoundLatitude")[0].textContent);
          return [[south, west], [north, east]];
        }
        const latlon = layers[i].getElementsByTagName("LatLonBoundingBox")[0];
        if (latlon) {
          const minx = parseFloat(latlon.getAttribute("minx"));
          const miny = parseFloat(latlon.getAttribute("miny"));
          const maxx = parseFloat(latlon.getAttribute("maxx"));
          const maxy = parseFloat(latlon.getAttribute("maxy"));
          return [[miny, minx], [maxy, maxx]];
        }
        // fallback: any BoundingBox with CRS=EPSG:4326
        const bboxes = layers[i].getElementsByTagName("BoundingBox");
        for (let j = 0; j < bboxes.length; j++) {
          const bb = bboxes[j];
          const crs = bb.getAttribute("CRS") || bb.getAttribute("SRS");
          if (crs && (crs.includes("4326") || crs.toLowerCase().includes("epsg"))) {
            const minx = parseFloat(bb.getAttribute("minx") || bb.getAttribute("minx"));
            const miny = parseFloat(bb.getAttribute("miny") || bb.getAttribute("miny"));
            const maxx = parseFloat(bb.getAttribute("maxx") || bb.getAttribute("maxx"));
            const maxy = parseFloat(bb.getAttribute("maxy") || bb.getAttribute("maxy"));
            return [[miny, minx], [maxy, maxx]];
          }
        }
      }
    }
    return null;
  };

  // Create a legend control and add to map if not already
  const ensureLegendControl = (map) => {
    if (!map || !map._container) return;
    if (legendControlRef.current) return legendControlRef.current;
    const control = L.control({ position: "bottomright" });
    control.onAdd = function () {
      const container = L.DomUtil.create("div", "wms-legend-container");
      container.style.background = "rgba(255,255,255,0.9)";
      container.style.padding = "6px";
      container.style.borderRadius = "4px";
      container.style.boxShadow = "0 1px 4px rgba(0,0,0,0.3)";
      container.style.maxWidth = "220px";
      const img = L.DomUtil.create("img", "wms-legend-image", container);
      img.style.maxWidth = "200px";
      img.style.display = "none";
      img.id = "wms-legend-image";
      return container;
    };
    control.addTo(map);
    legendControlRef.current = control;
    mapAddedLegend.current = true;
    return control;
  };

  const updateLegend = (map, layerName) => {
    if (!map) return;
    const control = ensureLegendControl(map);
    if (!control) return;
    const img = map.getContainer().querySelector("#wms-legend-image");
    if (!img) return;
    if (!layerName) {
      img.style.display = "none";
      img.src = "";
      return;
    }
    const legendUrl = LEGEND_BASE + encodeURIComponent(layerName);
    img.src = legendUrl;
    img.style.display = "block";
  };

  // Create or get existing WMS tile layer for a name
 // Create or get existing WMS tile layer for a name
const getOrCreateLayer = (map, layerName, zIndex = 1000) => {
  if (!layerName || !map) return null;
  
  // Show loader
  showLoader(true);
  
  if (layersRef.current[layerName]) {
    // If layer already exists, just show it and zoom to bounds
    const existingLayer = layersRef.current[layerName];
    map.addLayer(existingLayer);
    zoomToLayerBounds(map, layerName, existingLayer);
    return existingLayer;
  }

  const tile = L.tileLayer.wms(GEOSERVER_WMS, {
    layers: layerName,
    format: "image/png",
    transparent: true,
    version: "1.1.1",
    isDynamic: true,
    attribution: "",
  });
  tile.setZIndex(zIndex);

  // Track loading state
  let isLoading = true;
  let hasLoaded = false;

  // Show loader when tiles start loading
  tile.on('loading', () => {
    isLoading = true;
    showLoader(true);
  });

  // Handle tile load completion
  const onLoad = async () => {
    if (hasLoaded) return; // Prevent multiple calls
    
    isLoading = false;
    hasLoaded = true;
    
    try {
      const bounds = await getLayerBoundsFromCapabilities(layerName);
      if (bounds && map && map.fitBounds) {
        // Small timeout so tiles are visible when we fit
        setTimeout(() => {
          map.fitBounds(bounds, { maxZoom: 17 });
          // Hide loader after zoom animation
          setTimeout(() => showLoader(false), 300);
        }, 50);
      } else {
        showLoader(false);
      }
    } catch (e) {
      console.error('Error loading layer bounds:', e);
      showLoader(false);
    } finally {
      tile.off("load", onLoad);
      tile.off("loading", onLoad);
    }
  };

  // Also handle tile load errors
  const onError = () => {
    isLoading = false;
    showLoader(false);
    tile.off("load", onLoad);
    tile.off("loading", onLoad);
    console.error(`Failed to load layer: ${layerName}`);
  };

  tile.on("load", onLoad);
  tile.on("tileerror", onError);

  layersRef.current[layerName] = tile;
  return tile;
};

// Helper function to zoom to layer bounds
const zoomToLayerBounds = async (map, layerName, layer) => {
  showLoader(true);
  try {
    const bounds = await getLayerBoundsFromCapabilities(layerName);
    if (bounds && map && map.fitBounds) {
      setTimeout(() => {
        map.fitBounds(bounds, { maxZoom: 17 });
        setTimeout(() => showLoader(false), 300);
      }, 50);
    } else {
      showLoader(false);
    }
  } catch (e) {
    console.error('Error zooming to layer bounds:', e);
    showLoader(false);
  }
};

// Loader management functions
const showLoader = (show) => {
  // Create or get loader element
  let loader = document.getElementById('map-loader');
  
  if (!loader && show) {
    loader = document.createElement('div');
    loader.id = 'map-loader';
    loader.innerHTML = `
      <div style="
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0,0,0,0.7);
        color: white;
        padding: 20px;
        border-radius: 8px;
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 10px;
      ">
        <div class="spinner" style="
          width: 20px;
          height: 20px;
          border: 2px solid transparent;
          border-top: 2px solid white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        "></div>
        Loading layer...
      </div>
    `;
    
    // Add CSS animation
    if (!document.querySelector('#loader-styles')) {
      const style = document.createElement('style');
      style.id = 'loader-styles';
      style.textContent = `
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
    }
    
    // Add to map container or body
    const mapContainer = document.querySelector('.leaflet-container');
    if (mapContainer) {
      mapContainer.style.position = 'relative';
      mapContainer.appendChild(loader);
    } else {
      document.body.appendChild(loader);
    }
  } else if (loader && !show) {
    loader.remove();
  }
};




  // Remove layer by name if exists
  const removeLayerByName = (map, layerName) => {
    if (!map || !layersRef.current[layerName]) return;
    try {
      map.removeLayer(layersRef.current[layerName]);
    } catch (e) {
      // ignore if already removed
    }
    delete layersRef.current[layerName];
  };

  


  // Preferred NDVI/Change layer names (these were hardcoded in your original)
  const NDVI_LAYER_NAME = "2025-02-01_Con_Cum_Imp_WC_OVLP_NDVI";
  const CHANGE_LAYER_NAME = "2025-02-01_Con_Cum_Imp_WC_OVLP_NDVI_Change";

  // Main function that applies toggles: adds or removes appropriate layers
  const applyLayers = useCallback(async () => {
    const map = mapRef?.current;
    if (!map) return;

    // Ensure legend control exists
    ensureLegendControl(map);

    // Determine desired layers and the order (zIndex)
    const desired = [];
    console.log(selectedCoupe)

    if (showCoupeLayer && selectedCoupe) {
      desired.push({ name: selectedCoupe, z: 1100 });
    }
    if (showNdviLayer) {
      desired.push({ name: NDVI_LAYER_NAME, z: 1150 });
    }
    if (showNdwiLayer && selectedCoupe) {
      const ndwiName = resolveNdwiLayerName(selectedCoupe, selectedYear);
      if (ndwiName) desired.push({ name: ndwiName, z: 1160 });
    }
    if (showChangeLayer) {
      desired.push({ name: CHANGE_LAYER_NAME, z: 1170 });
    }

    // Remove layers that are not desired
    Object.keys(layersRef.current).forEach((key) => {
      const stillWanted = desired.find((d) => d.name === key);
      if (!stillWanted) {
        removeLayerByName(map, key);
      }
    });

    // Add desired layers (if not already present)
    for (const d of desired) {
      console.log("Adding layer:", d.name, "with zIndex:", d.z);
      if (!layersRef.current[d.name]) {
        const layer = getOrCreateLayer(map, d.name, d.z);
        if (layer) layer.addTo(map);
      } else {
        // ensure zIndex is correct
        try {
          layersRef.current[d.name].setZIndex(d.z);
        } catch (e) {}
      }
    }

    // Update legend: prefer NDVI, then NDWI, then CHANGE, then coupe
    let legendTarget = null;
    if (showNdviLayer) legendTarget = NDVI_LAYER_NAME;
    else if (showNdwiLayer) legendTarget = resolveNdwiLayerName(selectedCoupe, selectedYear);
    else if (showChangeLayer) legendTarget = CHANGE_LAYER_NAME;
    else if (showCoupeLayer) legendTarget = selectedCoupe;

    updateLegend(map, legendTarget);
  }, [
    mapRef,
    showCoupeLayer,
    showNdviLayer,
    showNdwiLayer,
    showChangeLayer,
    selectedCoupe,
    selectedYear,
  ]);

  // React to toggles, year or coupe changes
  useEffect(() => {
    applyLayers();
  }, [applyLayers]);

  // Handle selection change from dropdown
  const handleSelectionChange = (selectedValues) => {
    if (selectedValues.coupe) {
      setSelectedCoupe(selectedValues.coupe);
    } else {
      setSelectedCoupe(null);
    }
    // applyLayers will run due to effect dependency on selectedCoupe
  };

  // Cleanup on unmount: remove dynamic layers and legend
  useEffect(() => {
    return () => {
      const map = mapRef?.current;
      if (map) {
        Object.keys(layersRef.current).forEach((k) => {
          try {
            map.removeLayer(layersRef.current[k]);
          } catch (e) {}
        });
        layersRef.current = {};
        if (legendControlRef.current && map) {
          try {
            legendControlRef.current.remove();
          } catch (e) {}
          legendControlRef.current = null;
        }
      }
    };
  }, [mapRef]);

  return (
    <aside className="leftpanel">
      <h3 className="sidebar-title">
        <img src="../assets/Explor1.png" alt="Icon" style={{ width: "20px", marginRight: "8px" }} />
        {text[language].exploreData}
      </h3>

      {/* Forest Cover Change */}
      <div className="sidebar-section">
        <div className="section-header" onClick={() => toggleSection("forest")}>
          <img src="../assets/forest.png" alt="Forest Icon" style={{ width: "20px", marginRight: "8px" }} />
          <span>{text[language].forestCoverChange}</span>
          {openSections.forest ? <FaChevronUp /> : <FaChevronDown />}
        </div>

        {openSections.forest && (
          <div className="section-content">
            <div>
              <ForestHierarchyDropdowns language={language} onSelectionChange={handleSelectionChange} />
            </div>

            <div className="section-content">
              <label className="green-label">{text[language].selectLayer}</label>
              <div className="checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    className="checkbox"
                    checked={showCoupeLayer}
                    onChange={() => setShowCoupeLayer((prev) => !prev)}
                  />
                  {text[language].coupe}
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    className="checkbox"
                    checked={showNdviLayer}
                    onChange={() => setShowNdviLayer((prev) => !prev)}
                  />
                  {text[language].ndvi}
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    className="checkbox"
                    checked={showNdwiLayer}
                    onChange={() => setShowNdwiLayer((prev) => !prev)}
                  />
                  {text[language].ndwi}
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    className="checkbox"
                    checked={showChangeLayer}
                    onChange={() => setShowChangeLayer((prev) => !prev)}
                  />
                  {text[language].ndviChange}
                </label>
              </div>

              <div className="year-selection" style={{ marginTop: "10px" }}>
                <label className="green-label">Select Year</label>
                <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="year-select">
                  <option value="2023">2023</option>
                  <option value="2024">2024</option>
                  <option value="2025">2025</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Boundaries */}
      <div className="sidebar-section">
        <div className="section-header" onClick={() => toggleSection("boundaries")}>
          <img src="../assets/Boundry.png" alt="Boundaries Icon" style={{ width: "20px", marginRight: "8px" }} />
          <span>{text[language].boundaries}</span>
          {openSections.boundaries ? <FaChevronUp /> : <FaChevronDown />}
        </div>

        {openSections.boundaries && (
          <div className="section-content">
            <label className="green-label">{text[language].selectBoundaries}</label>
            <div className="checkbox-group">
              <label className="checkbox-label">
                <input type="checkbox" checked={showDistrictLayer} onChange={() => setShowDistrictLayer((p) => !p)} />
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
            </div>
          </div>
        )}
      </div>

      {/* Field Data */}
      <div className="sidebar-section">
        <div className="section-header" onClick={() => toggleSection("field")}>
          <img src="../assets/field.png" alt="Field Data Icon" style={{ width: "20px", marginRight: "8px" }} />
          <span>{text[language].fieldData}</span>
          {openSections.field ? <FaChevronUp /> : <FaChevronDown />}
        </div>

        {openSections.field && (
          <div className="section-content">
            <label className="green-label">{text[language].selectPatrollingIncident}</label>
            <div className="checkbox-group">
              <label className="checkbox-label">
                <input type="checkbox" checked={showPatrollingLayer} onChange={() => setShowPatrollingLayer((p) => !p)} />
                {text[language].patrollingRoute}
              </label>
              <label className="checkbox-label">
                <input type="checkbox" checked={showIncidentLayer} onChange={(e) => setShowIncidentLayer(e.target.checked)} />
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
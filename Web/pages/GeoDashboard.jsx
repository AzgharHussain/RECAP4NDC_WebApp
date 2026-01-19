import React, { useEffect, useRef, useState, lazy, Suspense } from "react";
import { MapContainer, TileLayer, useMap,ScaleControl ,WMSTileLayer  } from "react-leaflet";
import {FaInfoCircle} from 'react-icons/fa';
import html2canvas from "html2canvas";
import L, { icon } from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-easyprint";
import PrintControl from "./PrintControl";
import axios from 'axios';
import "leaflet-draw";
import "leaflet-draw/dist/leaflet.draw.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import 'leaflet-geometryutil';
import Cookies from "js-cookie";
import "./GeoDashboard.css";
import { useNavigate } from 'react-router-dom';
import { saveAs } from 'file-saver';
import 'leaflet-measure/dist/leaflet-measure.css';
import "./RightSidebar.css";
import SearchControlWithInput from './SearchControl';
import Swal from "sweetalert2";
import  DraggableZoomControl from "./DraggableZoomControl";
import LatLngDisplay from "./LatLngDisplay";
import 'leaflet/dist/leaflet.css';
import 'leaflet-measure';
import 'leaflet-measure/dist/leaflet-measure.css';


const LayerTogglePanel = lazy(() => import("./LayerTogglePanel"));
const RightSidebar = lazy(() => import("./RightSidebar"));
const BasemapGallery = lazy(() => import("./Basemapgallery"));

import legendIcon from "../assets/Legend.png"; // <<--- correct import for legend button
const position = [22.7531, 71.8046];

const customCRS = L.CRS.EPSG4326;
const basemaps = {
  LightGray: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  DarkGray: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
  Imagery: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
  Oceans: 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}',
  Streets: 'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
  NationalGeo: 'https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}',
  positron:"https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png"
};


// Utility function to fetch legend for a WMS layer
const getLegendUrl = (layerName) =>
  `https://www.gisfy.co.in:8443/geoserver/cite/wms?SERVICE=WMS&REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=${encodeURIComponent(
    layerName
  )}`;
export default function MapView() {
  const mapRef = useRef(null);
  const [activeBasemap, setActiveBasemap] = useState("Imagery");
  const [activeTool, setActiveTool] = useState("layers");
  const [activetoolone, setActivetoolone] = useState("");
  const [userdata, setuserdata] = useState("");
  const [isInfoToolActive, setIsInfoToolActive] = useState(false);
  const [showStateLayer, setShowStateLayer] = useState(true);
  const [showDistrictLayer, setShowDistrictLayer] = useState(false); 
  const [showCoupeLayer, setShowCoupeLayer] = useState(false);
  const [showNdviLayer, setShowNdviLayer] = useState(false);
  const [showNdwiLayer, setShowNdwiLayer] = useState(false);
  const [showChangeLayer, setShowChangeLayer] = useState(false);
  const [showPatrollingLayer, setShowPatrollingLayer] = useState(false);
  const [showIncidentLayer, setShowIncidentLayer] = useState(false);
  const [incidentsData, setIncidentsData] = useState([]);
  const [showLayerTogglePanel, setShowLayerTogglePanel] = useState(true); // default open
  const [selectedDate, setSelectedDate] = useState("");
  const [showLegend, setShowLegend] = useState(false);
  const [layerLegends, setLayerLegends] = useState({});
  const [filteredNdviLayers, setFilteredNdviLayers] = useState([]);
  const [filteredNdwiLayers, setFilteredNdwiLayers] = useState([]);
  const [filteredChangeLayers, setFilteredChangeLayers] = useState([]);
  const [coupeLayers, setCoupeLayers] = useState([]);
  const navigate = useNavigate();
const ndviLayers = [
  "cite:2025_09_01_BIO_W_C_COUPE_ndvi",
  "cite:2025_09_01_AFF_W_C_COUPE_ndvi_",
  "cite:2025_09_01_AFFORESTATION_W_C_COUPE_ndvi",
  "cite:2025_08_01_BIO_W_C_COUPE_ndvi",
  "cite:2025_08_01_AFF_W_C_COUPE_ndvi",
  "cite:2025_08_01_AFFORESTATION_W_C_COUPE_ndvi",
  "cite:2025_09_01_Adapur_view_ndvi",
  "cite:2025_08_01_Abhapur_view_ndvi"
];
const ndwiLayers = [
  "cite:2025_09_01_BIO_W_C_COUPE_ndwi",
  "cite:2025_09_01_AFF_W_C_COUPE_ndwi",
  "cite:2025_09_01_AFFORESTATION_W_C_COUPE_ndwi",
  "cite:2025_08_01_BIO_W_C_COUPE_ndwi",
  "cite:2025_08_01_AFF_W_C_COUPE_ndwi",
  "cite:2025_08_01_AFFORESTATION_W_C_COUPE_ndwi",
  "cite:2025_09_01_Adapur_view_ndwi",
 " cite:2025_08_01_Abhapur_view_ndwi"
];
const changeLayers = [
  "cite:2025_09_01_BIO_W_C_COUPE_ndvi_change",
  "cite:2025_09_01_Adapur_view_ndvi_change",
  "cite:2025_09_01_AGAR_view_ndvi_change"
 
];
  const fetchCoupeLayers = async () => {
    try {
      const response = await axios.get("http://68.178.167.39:5000/api/coupe_metadata/location");
      setCoupeLayers(response.data || []);
    } catch (error) {
      console.error("Error fetching coupe layers:", error);
    }
  };

  useEffect(() => {
    fetchCoupeLayers();
  }, []);
  useEffect(() => {
    if (showIncidentLayer) {
      fetch("http://68.178.167.39:5000/api/incidents-with-images?user_id=2")
        .then((res) => res.json())
        .then((data) => setIncidentsData(data))
        .catch((err) => console.error("Error fetching incidents", err));
    } else {
      setIncidentsData([]);
    }
  }, [showIncidentLayer]);
  // Toggle legend visibility
  const toggleLegend = () => {
    setShowLegend((s) => !s);
  };
  // Normalizes a layer name to ensure a workspace prefix exists (if missing).
  // If layer already has a colon (workspace:layer) we return as-is.
  const normalizeLayerName = (raw) => {
    if (!raw) return raw;
    if (raw.includes(":")) return raw;
    // default workspace 'cite' if none provided
    return `cite:${raw}`;
  };
  // Build dynamic legend list whenever layers are toggled or coupe/ndvi data changes
  useEffect(() => {
    const legends = {};

    const getSingleLegend = (layerList, fallbackLayer) =>
    layerList.length > 0
      ? getLegendUrl(normalizeLayerName(layerList[0].replace(/^cite:/, "")))
      : getLegendUrl(fallbackLayer);

    if (showDistrictLayer) {
      legends["District Layer"] = getLegendUrl("cite:Gujarat_district");
    }

     legends["State Layer"] = getLegendUrl("cite:Gujarat_State");

    if (showPatrollingLayer) {
      legends["Patrolling"] = getLegendUrl("cite:patrols");
    }

    if (showIncidentLayer) {
      legends["Incidents"] = getLegendUrl("cite:incidents");
    }
    // --- NDVI / NDWI / Change: Single legend per category ---
  if (showNdviLayer) {
    legends["NDVI"] = getSingleLegend(
      filteredNdviLayers,
      "cite:2025_09_01_BIO_W_C_COUPE_ndvi"
    );
  }

  if (showNdwiLayer) {
    legends["NDWI"] = getSingleLegend(
      filteredNdwiLayers,
      "cite:2025_09_01_BIO_W_C_COUPE_ndwi"
    );
  }

  if (showChangeLayer) {
    legends["Change"] = getSingleLegend(
      filteredChangeLayers,
      "cite:2025_09_01_BIO_W_C_COUPE_ndvi_change"
    );
  }

    // Coupe layers (dynamic list from backend). coupeLayers likely contains objects with input_table_name
    if (showCoupeLayer && Array.isArray(coupeLayers) && coupeLayers.length > 0) {
    const names = coupeLayers
      .map((c) => {
        if (typeof c === "string") return normalizeLayerName(c.replace(/^cite:/, ""));
        if (c && c.input_table_name)
          return normalizeLayerName(c.input_table_name.replace(/^cite:/, ""));
        return null;
      })
      .filter(Boolean);

    if (names.length) {
      // Show only one Coupe legend (avoid repetition)
      legends["Coupes"] = getLegendUrl(names[0]);
    }
  }
    setLayerLegends(legends);
  }, [
    showDistrictLayer,
    // showStateLayer,
    showPatrollingLayer,
    showIncidentLayer,
    showNdviLayer,
    showNdwiLayer,
    showChangeLayer,
    showCoupeLayer,
    filteredNdviLayers,
    filteredNdwiLayers,
    filteredChangeLayers,
    coupeLayers,
  ]);

const handleFilter = ({ fromDate, toDate }) => {
  if (!fromDate && !toDate) {
    setFilteredNdviLayers(ndviLayers);
    setFilteredNdwiLayers(ndwiLayers);
    setFilteredChangeLayers(changeLayers);
    return;
  }

  // 🔧 Utility to parse either "YYYY-MM-DD" or "DD-MM-YYYY"
  const parseInputDate = (dateStr) => {
    if (!dateStr) return null;
    const parts = dateStr.split("-");
    if (parts[0].length === 4) {
      // YYYY-MM-DD
      return new Date(parts[0], parts[1] - 1, parts[2]);
    } else if (parts[2].length === 4) {
      // DD-MM-YYYY
      return new Date(parts[2], parts[1] - 1, parts[0]);
    }
    return null;
  };

  // 🧠 Extract date (YYYY_MM_DD) from layer name
  const extractDate = (layer) => {
    const clean = layer.replace(/^cite:/, "");
    const parts = clean.split("_");
    if (parts.length >= 3) {
      const [y, m, d] = parts.slice(0, 3);
      return new Date(y, m - 1, d);
    }
    return null;
  };

  const from = parseInputDate(fromDate);
  const to = parseInputDate(toDate);

  const isWithinRange = (layer) => {
    const layerDate = extractDate(layer);
    if (!layerDate) return false;
    if (from && to) return layerDate >= from && layerDate <= to;
    if (from) return layerDate >= from;
    if (to) return layerDate <= to;
    return true;
  };

  const filterLayers = (layers) => layers.filter(isWithinRange);

  setFilteredNdviLayers(filterLayers(ndviLayers));
  setFilteredNdwiLayers(filterLayers(ndwiLayers));
  setFilteredChangeLayers(filterLayers(changeLayers));
};




 // minimal map controls & utilities
  const zoomIn = () => mapRef.current?.zoomIn();
  const zoomOut = () => mapRef.current?.zoomOut();
  const resetView = () => mapRef.current?.setView(position, 7);
  const toggleInfoTool = () => setIsInfoToolActive((s) => !s);

  useEffect(() => {
    const token = Cookies.get("token");
    if (!token) {
      navigate("");
      return;
    }
    // fetchUser(); // left as you had it
  }, [navigate]);

  const AddControls = () => {
    const map = useMap();
    useEffect(() => {
      mapRef.current = map;
      window.leafletTools = { map };
    }, [map]);
    return null;
  };

const GeomanTools = () => {
    const map = useMap();
    useEffect(() => {
      if (!map) return;
      const onCreate = (e) => {
        if (e.layerType === "Line") {
          const latlngs = e.layer.getLatLngs();
          const length = L.GeometryUtil.length(latlngs);
          e.layer.bindPopup(`Length: ${length.toFixed(2)} m`).openPopup();
        }
      };
      map.on("pm:create", onCreate);
      return () => map.off("pm:create", onCreate);
    }, [map]);

    return null;
  };
const handleDrawingToolClick = (toolType) => {
  const map = mapRef.current;
  if (!map) return;

  // Deactivate all tools first
  map.pm.disableDraw();
  
  if (activeTool === toolType) {
    // If clicking the same tool, deactivate it
    setActiveTool(null);
  } else {
    // Activate the selected tool
    setActiveTool(toolType);
    map.pm.enableDraw(toolType, {
      snappable: true,
      snapDistance: 20,
      // Add other options as needed
    });
  }
};
  // Function to handle button click
  const handleButtonClick = (toolName, title) => {
    setActiveTool(toolName);
  };

  const toggleFullscreen = () => {
    const elem = document.querySelector(".map-wrapper");
    if (!document.fullscreenElement) {
      elem.requestFullscreen().catch(err => console.error(err));
    } else {
      document.exitFullscreen();
    }
  };
  

  useEffect(() => {
    const token = Cookies.get("token");
    if (!token) {
      navigate("");
      return;
    }
    const id = Cookies.get("id");
    fetchUser();
  }, [navigate]);
  const locate = () => {
    const map = mapRef.current;
    if (map) {
      map.locate({ setView: true, maxZoom: 16 });
      map.once("locationfound", (e) => {
        L.marker(e.latlng).addTo(map).bindPopup("You are here").openPopup();
      });
      map.once("locationerror", () => {
        alert("Location not found or permission denied.");
      });
    }
  };
  const handleLogout = () => {
    Cookies.remove("token");
    Cookies.remove("role");
 
    Cookies.remove("id");
    setIsOpenlogout(false);
    navigate("");
  };

  const handleFeedbackChange = (event) => { 
    const { name, value } = event.target;
    setFeedback((prevFeedback) => ({
      ...prevFeedback,
      [name]: value,
    }));
  };

  const handleSubmitFeedback = async () => {
    if (!feedback.subject.trim() || !feedback.comments.trim()) {
      setFeedbackStatus('error');
      return;
    }

    setIsSubmitting(true);
    setFeedbackStatus(null);

    try {
      const response = await axios.post(`${BASE_URL}/tnc-users/feedback`, {
        user_id: userdata?.user_id,
        subject: feedback.subject.trim(),
        comments: feedback.comments.trim(),
      });

      setFeedbackStatus('success');
      setFeedback({ subject: "", comments: "" });
      setTimeout(() => {
        setIsFeedbackOpen(false);
        setFeedbackStatus(null);
      }, 2000);
    } catch (error) {
      console.error("Error submitting feedback:", JSON.stringify(error, null, 2));
      setFeedbackStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };


    const handleDelete = async (id) => {
      try {
        const result = await Swal.fire({
          title: 'Are you sure?',
          text: 'You will not be able to Login again',
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: 'Yes, delete it!',
          cancelButtonText: 'No, cancel!',
        });
  
        if (result.isConfirmed) {
          const response = await fetch(`${BASE_URL}/tnc-users/${id}`, {
            method: 'DELETE',
          });
    Cookies.remove("token");
    Cookies.remove("role");

    Cookies.remove("id");
    setIsOpenlogout(false);
    navigate("");
          
          Swal.fire(
            'Deleted!',
            'User has been deleted.',
            'success'
          );
        }
      } catch (error) {
        console.error('Error deleting user:', error);
        
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: `Error deleting user: ${error.message}`,
        });
      }
    }
    const [activeTab, setActiveTab] = useState('Forest Landscape Restoration');

  const handleTabClick = (tabName) => {
    setActiveTab(tabName);
  };

  const [activeCategory, setActiveCategory] = useState(null);


  const toggleCategory = (category) => {
    setActiveCategory(activeCategory === category ? null : category);
  };

  const handleDownload = (file) => {
    // Trigger the file download
    console.log(`Downloading file: ${file}`);
    saveAs(file); // FileSaver.js download function
  };

        const [activeToolSidebar, setActiveToolSidebar] = useState('searchIconArea');

const handleToolSidebarClick = (toolName) => {
  setActiveToolSidebar(prevTool => prevTool === toolName ? null : toolName);
};

  const zoomToLayer = (layerName) => {
  const map = mapRef.current;
  if (!map) return;

  let bounds;

  switch(layerName) {
    case 'stateLayer':
      bounds = L.latLngBounds([[20.0, 70.0], [24.0, 80.0]]); // Define the bounds for Gujarat, update with real bounds
      break;
    case 'districtLayer':
      bounds = L.latLngBounds([[21.5, 72.5], [23.5, 75.5]]); // Define the bounds for the district, update with real bounds
      break;
    // Define bounds for other layers similarly
    default:
      bounds = L.latLngBounds([[22.6093, 74.4097], [22.6093, 74.4097]]); // Default view, replace with the layer's bounds
  }

  map.fitBounds(bounds, { padding: [50, 50] }); // You can adjust padding
};

  const handleLayerToggle = (layerType, isChecked) => {
    // keep your UI state toggles here & legend effect will pick up those changes
    switch (layerType) {
      case "stateLayer":
        setShowStateLayer(isChecked);
        break;
      case "districtLayer":
        setShowDistrictLayer(isChecked);
        break;
      case "coupeLayer":
        setShowCoupeLayer(isChecked);
        break;
      case "ndviLayer":
        setShowNdviLayer(isChecked);
        break;
      case "ndwiLayer":
        setShowNdwiLayer(isChecked);
        break;
      case "changeLayer":
        setShowChangeLayer(isChecked);
        break;
      case "patrollingLayer":
        setShowPatrollingLayer(isChecked);
        break;
      case "incidentLayer":
        setShowIncidentLayer(isChecked);
        break;
      default:
        break;
    }
  };

  // Print handler (kept same)
  const mapWrapperRef = useRef();
  const headerRef = useRef(null);
  const [headerHeight, setHeaderHeight] = useState(0);

  useEffect(() => {
    if (!headerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { height } = entry.contentRect;
        setHeaderHeight(height);
      }
    });
    resizeObserver.observe(headerRef.current);
    return () => {
      if (headerRef.current) resizeObserver.unobserve(headerRef.current);
    };
  }, []);

  const handlePrint = async () => {
    if (!mapWrapperRef.current) return;
    const canvas = await html2canvas(mapWrapperRef.current, { useCORS: true });
    const link = document.createElement("a");
    link.download = "map_with_legend_compass.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  };


  const fetchUser = async () => {
  try {
    const token = Cookies.get("token");
    const id = Cookies.get("id");
    
    if (!token || !id) {
      navigate("");
      return;
    }

    const response = await axios.get(`http://68.178.167.39:5000/api/tnc-users/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    setuserdata(response.data);
  } catch (error) {
    console.error("Error fetching user data:", error);
    // Handle error - maybe redirect to login
    Cookies.remove("token");
    Cookies.remove("role");
    Cookies.remove("id");
    navigate("");
  }
};
  return (
    <div
     className="map-wrapper" 
    >
      <div className="map-layout">
        <div className="map-top-left">
<aside className="left-sidebar">
   {/* Search Icon Area */}
  {/* <button
    title="Filter"
    type="button"
    onClick={() => handleToolSidebarClick("searchIconArea")}
    className={activeToolSidebar === "searchIconArea" ? "tool-button-active" : "tool-button"}
  >
    <svg width="16" height="16" viewBox="0 0 24 24">
      <path
        d="M4 6H20M7 12H17M10 18H14"
        stroke={activeToolSidebar === "searchIconArea" ? "#ffffff" : "#39E23C"}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  </button> */}

  {/* Search */}
 {/* <button
  title="Search"
  type="button"
  onClick={() => handleToolSidebarClick("search")}
  className={activeToolSidebar === "search" ? "tool-button-active" : "tool-button"}
>
  <i className="bi bi-search" />
</button> */}


  {/* Zoom In */}
  <button
    title="Zoom In"
    type="button"
    onClick={() => {
      zoomIn();
      handleToolSidebarClick("zoomIn");
    }}
    className={activeToolSidebar === "zoomIn" ? "tool-button-active" : "tool-button"}
  >
    <i className="bi bi-plus-lg" />
  </button>

  {/* Zoom Out */}
  <button
    title="Zoom Out"
    type="button"
    onClick={() => {
      zoomOut();
      handleToolSidebarClick("zoomOut");
    }}
    className={activeToolSidebar === "zoomOut" ? "tool-button-active" : "tool-button"}
  >
    <i className="bi bi-dash-lg"/>
  </button>

  {/* Pan Tool */}
  <button
    title="Pan/Drag"
    type="button"
    onClick={() => handleToolSidebarClick("pan")}
    className={activeToolSidebar === "pan" ? "tool-button-active" : "tool-button"}
  >
    <span className="material-icons-outlined">pan_tool_alt</span>
  </button>

  {/* Measurement Tool */}
  <button
    title="Measurement"
    type="button"
    onClick={() => {
      const newTool = activeToolSidebar === "measure" ? null : "measure";
      setActiveToolSidebar(newTool);

      if (newTool !== "measure" && mapRef.current) {
        mapRef.current.pm.removeControls();
      }
    }}
    className={activeToolSidebar === "measure" ? "tool-button-active" : "tool-button"}
  >
    <span className="material-icons-outlined">straighten</span>
  </button>

  {/* <button
    title="Attribute Infomation"
    type="button"
    onClick={() => {
      const newTool = activeToolSidebar === "info" ? null : "info";
      setActiveToolSidebar(newTool);

      if (newTool !== "info" && mapRef.current) {
        mapRef.current.pm.removeControls();
      }
    }}
    className={activeToolSidebar === "info" ? "tool-button-active" : "tool-button"}
  >
   <FaInfoCircle />
  </button> */}


  {/* Home */}
  <button
    title="Home"
    type="button"
    onClick={() => {
      resetView();
      handleToolSidebarClick("home");
    }}
    className={activeToolSidebar === "home" ? "tool-button-active" : "tool-button"}
  >
    <i className="bi bi-house-fill" />
  </button>

      
</aside>
        </div>      
          {/* <SearchControlWithInput mapRef={mapRef} />        */}
      <Suspense fallback={<div>Loading...</div>}>
        <BasemapGallery
          activeBasemap={activeBasemap}
          setActiveBasemap={setActiveBasemap}
          setActiveTool={setActiveTool}
          map={mapRef.current} // Pass the map instance here
        />
      </Suspense>
{activeToolSidebar === "measure" && (
           <Suspense fallback={<div>Loading...</div>}>
          <RightSidebar mapRef={mapRef}  
              setActiveToolSidebar={setActiveToolSidebar} />
        </Suspense>
        )}

        <div className="main-container" ref={mapWrapperRef}>
  
      {/* <button
        title="Layers Panel"
        type="button"
        onClick={() => setShowLayerTogglePanel((p) => !p)}
        className="tool-button"
        style={{ maxHeight: "27px",marginTop:"-9px",marginLeft:"-7px" }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24">
          <path
                d="M3 6H21M3 12H21M3 18H21"
                stroke="#fff"
                strokeWidth="2"
                strokeLinecap="round"
              />
        </svg>
      </button> */}
         {/* {showLayerTogglePanel && ( */}
            <div>
              <Suspense fallback={<div>Loading...</div>}>
                <LayerTogglePanel
                 activeToolSidebar={activeToolSidebar}
                
                  mapRef={mapRef}
                />
              </Suspense>
            </div>
          {/* )} */}
     <div style={{ display: "flex", width: "auto", height: "auto" }}>
            <MapContainer
              center={position}
              zoom={6.8}
          style={{
  height: "92vh",
  width:  "80vw" ,
}}

              whenCreated={(mapInstance) => {
                mapRef.current = mapInstance;
                mapInstance.rotate = true;
                if (typeof mapInstance.setBearing === "function") {
                  mapInstance.setBearing(0);
                }
              }}
              rotate={true}
              bearing={0}
            >
      <PrintControl mapRef={mapRef} />
              <TileLayer url={basemaps[activeBasemap]} />
             <SearchControlWithInput />

              <WMSTileLayer
                key="gujarat-difference"
                url="http://68.178.167.39:8081/geoserver/cite/wms"
                layers="cite:Gujarat_difference"
                format="image/png"
                transparent={true}
                version="1.1.0"
                opacity={0.7}
              />

              <WMSTileLayer
                key="Gujarat_State"
                url="http://68.178.167.39:8081/geoserver/cite/wms"
                layers="cite:Gujarat_State"
                format="image/png"
                transparent={true}
                version="1.1.0"
                opacity={1}
              />

              <WMSTileLayer
                key="tblIndia"
                url="http://68.178.167.39:8081/geoserver/cite/wms"
                layers="cite:tblIndia"
                format="image/png"
                transparent={true}
                version="1.1.0"
                opacity={1}
              />

              {showDistrictLayer && (
                <WMSTileLayer
                  url="https://gisfy.co.in:8443/geoserver/cite/wms"
                  layers="cite:Gujarat_district"
                  format="image/png"
                  transparent
                />
              )}

              {showCoupeLayer &&
                coupeLayers.map((layer) => (
                  <WMSTileLayer
                    key={layer.input_table_name || layer}
                    url="https://gisfy.co.in:8443/geoserver/cite/wms"
                    layers={layer.input_table_name || layer}
                    format="image/png"
                    transparent={true}
                    version="1.1.0"
                    opacity={1}
                  />
                ))}

              {showNdviLayer &&
                (filteredNdviLayers.length > 0
                  ? filteredNdviLayers.map((layer) => (
                      <WMSTileLayer
                        key={layer}
                        url="https://gisfy.co.in:8443/geoserver/cite/wms"
                        layers={layer}
                        format="image/png"
                        transparent={true}
                        version="1.1.0"
                        opacity={1}
                      />
                    ))
                  : ndviLayers.map((layer) => (
                      <WMSTileLayer
                        key={layer}
                        url="https://gisfy.co.in:8443/geoserver/cite/wms"
                        layers={layer}
                        format="image/png"
                        transparent={true}
                        version="1.1.0"
                        opacity={1}
                      />
                    )))}

              {showNdwiLayer &&
                (filteredNdwiLayers.length > 0
                  ? filteredNdwiLayers.map((layer) => (
                      <WMSTileLayer
                        key={layer}
                        url="https://gisfy.co.in:8443/geoserver/cite/wms"
                        layers={layer}
                        format="image/png"
                        transparent={true}
                        version="1.1.0"
                        opacity={1}
                      />
                    ))
                  : ndwiLayers.map((layer) => (
                      <WMSTileLayer
                        key={layer}
                        url="https://gisfy.co.in:8443/geoserver/cite/wms"
                        layers={layer}
                        format="image/png"
                        transparent={true}
                        version="1.1.0"
                        opacity={1}
                      />
                    )))}

              {showChangeLayer &&
                (filteredChangeLayers.length > 0
                  ? filteredChangeLayers.map((layer) => (
                      <WMSTileLayer
                        key={layer}
                        url="https://gisfy.co.in:8443/geoserver/cite/wms"
                        layers={layer}
                        format="image/png"
                        transparent={true}
                        version="1.1.0"
                        opacity={1}
                      />
                    ))
                  : changeLayers.map((layer) => (
                      <WMSTileLayer
                        key={layer}
                        url="https://gisfy.co.in:8443/geoserver/cite/wms"
                        layers={layer}
                        format="image/png"
                        transparent={true}
                        version="1.1.0"
                        opacity={1}
                      />
                    )))}

              {showPatrollingLayer && (
                <WMSTileLayer
                  key="patrols"
                  url="https://gisfy.co.in:8443/geoserver/cite/wms"
                  layers="cite:patrols"
                  format="image/png"
                  transparent={true}
                  version="1.1.0"
                  opacity={1}
                />
              )}

              {showIncidentLayer && (
                <WMSTileLayer
                  key="incidents"
                  url="https://gisfy.co.in:8443/geoserver/cite/wms"
                  layers="cite:incidents"
                  format="image/png"
                  transparent={true}
                  version="1.1.0"
                  opacity={1}
                />
              )}

      <AddControls />
      <GeomanTools />
       <ScaleControl position="bottomleft" 
      //  className="custom-scale-control" 
       />
              {activeToolSidebar === "search" && <DraggableZoomControl mapRef={mapRef} />}

              <LatLngDisplay />
      </MapContainer>
      </div>       
        </div>
        {/* Legend panel */}
        {/* {showLegend && (
          <div
            className="map-legend"
            style={{
              position: "fixed",
              bottom: "80px",
              right: "20px",
              backgroundColor: "rgba(255, 255, 255, 0.03)",
              padding: "10px",
              borderRadius: "8px",
              boxShadow: "-6.479px -6.479px 3.24px -7.559px #B3B3B3 inset, -6.479px -6.479px 3.24px -7.559px #B3B3B3 inset, -6.479px -6.479px 3.24px -7.559px #B3B3B3 inset, 8.639px 8.639px 4.86px -9.719px #FFF inset",
              overflowY: "auto",
              width: "229px",
              zIndex: 10000,
              height:"152px",

            }}
          >
            <h4 style={{ margin: "6px 0" }}>Map Legend</h4>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {Object.keys(layerLegends).length === 0 && (
                <li style={{ color: "#333", padding: "6px 0" }}>No legends available — toggle layers to show legends.</li>
              )}
              {Object.entries(layerLegends).map(([layerKey, legend]) => (
              <li key={layerKey} style={{ marginBottom: 8 }}>
                <strong style={{ display: "block", marginBottom: 6 }}>{layerKey}</strong>

                {Array.isArray(legend)
                  ? legend.map((url, idx) =>
                      url ? (
                                            <img
                        key={idx}
                        src={url}
                        alt={`${layerKey} legend ${idx}`}
                        className={["NDVI", "NDWI", "Change"].includes(layerKey) ? "large-legend" : ""}
                        style={{
                          width: "100%",
                          objectFit: "contain",
                          imageRendering: "pixelated",
                          marginBottom: 6,
                        }}
                      />

                      ) : null
                    )
                  : legend ? (
                      <img
                        src={legend}
                        alt={`${layerKey} legend`}
                        style={{
                          width: "100%",
                          height:
                            ["NDVI", "NDWI", "Change"].includes(layerKey)
                              ? "64px"
                              : "16px",
                          objectFit: "contain",
                          imageRendering: "pixelated",
                        }}
                      />
                    ) : (
                      <div style={{ color: "#666" }}>Legend not available</div>
                    )}
              </li>
            ))}


            </ul>
          </div>
        )} */}
     
        {activetoolone === "Edit" && (
          <Suspense fallback={<div>Loading...</div>}>
            <ForestDegradationAnalysis 
              setActivetoolone={setActivetoolone}  
              mapRef={mapRef} 
            />
          </Suspense>
        )}

        {activetoolone === "Suitability" && (
          <Suspense fallback={<div>Loading...</div>}>
            <SuitabilityDecisionModels
              mapRef={mapRef}
              activetoolone={activetoolone}
              setActivetoolone={setActivetoolone}
            />
          </Suspense>
        )}
      </div>
    </div>
  );
}
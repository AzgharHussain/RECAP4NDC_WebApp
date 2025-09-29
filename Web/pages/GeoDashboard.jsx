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
// import IncidentLayer from "./IncidentLayer";
import 'leaflet-measure';
import 'leaflet-measure/dist/leaflet-measure.css';

const LayerTogglePanel = lazy(() => import("./LayerTogglePanel"));
const RightSidebar = lazy(() => import("./RightSidebar"));
const BasemapGallery = lazy(() => import("./Basemapgallery"));
const position = [22.6093, 74.4097];
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
export default function MapView() {
  const mapRef = useRef(null);
  const [activeBasemap, setActiveBasemap] = useState("LightGray");
  const [activeTool, setActiveTool] = useState("layers");
  const [activetoolone, setActivetoolone] = useState("");
  const [userdata, setuserdata] = useState("");
  const [isInfoToolActive, setIsInfoToolActive] = useState(false);
  const [showStateLayer, setShowStateLayer] = useState(false);
  const [showDistrictLayer, setShowDistrictLayer] = useState(false); 
  const [showCoupeLayer, setShowCoupeLayer] = useState(false);
  const [showNdviLayer, setShowNdviLayer] = useState(false);
  const [showNdwiLayer, setShowNdwiLayer] = useState(false);
  const [showPatrollingLayer, setShowPatrollingLayer] = useState(false);
  const [showIncidentLayer, setShowIncidentLayer] = useState(false);
  const [incidentsData, setIncidentsData] = useState([]);
// inside MapView component
const [showLayerTogglePanel, setShowLayerTogglePanel] = useState(true); // default open

const coupeLayers = [
  
 "Arvalli_all_Range_all_WC_all_Coupe",
 "AFF_W_C_COUPE",
 "AFFORESTATION_W_C_COUPE",
  "Bhavnagar_coupes",
  "Gandhinagar_MM_Coupe",
  "Jamnagar_coupes",
  "Junagadh coupes SHP",
  "Mahisagar_all_Coupe_FF",
  "Morbi_coupe_map",
  "Narmada_CP_FS2_compt4_RRB",
   "SK_North_all_Range_all_WC_all_Coupe",
   "Surat_all_Range_Coupe",
  "Surendranagar_coupe",
  "Vyara_MM_Coupe_Boundary_qgis",
  "CUD_Coupe_bdn",
  "AFF W.C COUPE",
  "AFFORESTATION W.C _COUPE",
  "BIO_W_C_COUPE",
  "Bharuch_Coupe_joined",
  "DEV&CON_W_C_COUPE",
  "DEVELO&CON_W_C_COUPE",
  "DEV_AFF_COUPE",
  "DEV_DEV&CON_W_C_COUPE",
  "D_AFFORESTATION_W_C_COUPE",
  "D_DEVELOPMENT&CONSERVATION_COUPE",
  "D_GRASSBIR_W_C_COUPE",
  "DesDev_WL_WC",
  "Dev_Revenue",
  "G_S_F_D_C_AREA",
  "GR_W_C_COUPE",
  "GRASSBIR_W_C_COUPE",
  "Garbada_Afforestation_Coupe",
  "Garbada_Develop&Conser_Coupe",
   "Garbada_Revenue",
  "J_AFFORESTATION_W_C_COUPE",
  "J_GRASSBIR_W_C_COUPE",
  "K_DEVELOPMENT&CONSERVATION_W_C_COUPE",
  "L_AFFORESTATION_W_C_COUPE",
  "L_DEVELOPMENT&CONSERVATION_W_C_COUPE",
  "L_GRASSBIR_W_C_COUPE",
  "PRO",
  "RAN_AFFO_W_C_COUPE",
  "RAN_DEV&CON_W_C_COUPE",
  "RAN_GRASSBIR_W_C_COUPE",
  "REV",
  "REVENUE",
  "REVENUE_Limkheda",
  "REVENUE_Rampura",
  "REVENUE_Randhikpur",
  "REV_Sagtala",
  "R_AFFORESTATION_COUPE",
  "R_GRASSBIR_COUPE",
  "Rev",
  "Revenu",
  "Revenu_Boundary",
  "Revenu_Boundary_Sanjeli",
  "SAG_BIODI_W_C_COUPE",
  "SAG_DEV&CON_W_C_COUPE",
  "S_AFFORESTATION_W_C_COUPE",
  "S_DEV&CON_W_C_COUPE",
  "S_GRASSBIR_W_C_COUPE",
  "S_REVENUE",
  "Vansi_AFF_W_C_COUPE",
  "Vansi_BIO_W_C_COUPE",
  "Vansi_DEV&CON_W_C_COUPE",
  "Vansi_REV",
  "Wild_Life_WC",
   "con_cum_lmp",
  "Kanjeta_AFF_W_C_COUPE",
  "Sanjeli_AFFORESTATION_W_C_COUPE"
];

const ndviLayers = [
  "cite:2025_09_01_BIO_W_C_COUPE_ndvi",
  "cite:2025_09_01_AFF_W_C_COUPE_ndvi_",
  "cite:2025_09_01_AFFORESTATION_W_C_COUPE_ndvi",
  "cite:2025_08_01_BIO_W_C_COUPE_ndvi",
  "cite:2025_08_01_AFF_W_C_COUPE_ndvi",
  "cite:2025_08_01_AFFORESTATION_W_C_COUPE_ndvi",
];

const ndwiLayers = [
  "cite:2025_09_01_BIO_W_C_COUPE_ndwi",
  "cite:2025_09_01_AFF_W_C_COUPE_ndwi",
  "cite:2025_09_01_AFFORESTATION_W_C_COUPE_ndwi",
  "cite:2025_08_01_BIO_W_C_COUPE_ndwi",
  "cite:2025_08_01_AFF_W_C_COUPE_ndwi",
  "cite:2025_08_01_AFFORESTATION_W_C_COUPE_ndwi",
];

  const navigate = useNavigate();

const GeomanTools = () => {
  const map = useMap();
  
  useEffect(() => {
    if (!map) return;

    // Handle when a line is created
    const handleLineCreated = (e) => {
      const layer = e.layer;
      const latlngs = layer.getLatLngs();
      
      // Calculate length if needed
      const length = L.GeometryUtil.length(latlngs);
      
      // You can store the line or do something with it
      console.log('Line created:', latlngs, 'Length:', length);
      
      // Optionally add a popup with the length
      layer.bindPopup(`Line length: ${length.toFixed(2)} meters`).openPopup();
    };

    map.on('pm:create', (e) => {
      if (e.layerType === 'Line') {
        handleLineCreated(e);
      }
      // Handle other shape types if needed
    });

    return () => {
      map.off('pm:create');
    };
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
  const zoomIn = () => mapRef.current?.zoomIn();
  const zoomOut = () => mapRef.current?.zoomOut();
  const resetView = () => mapRef.current?.setView(position, 7);
  const toggleFullscreen = () => {
    const elem = document.querySelector(".map-wrapper");
    if (!document.fullscreenElement) {
      elem.requestFullscreen().catch(err => console.error(err));
    } else {
      document.exitFullscreen();
    }
  };

  const toggleInfoTool = () => {
    setIsInfoToolActive(!isInfoToolActive);
  };

  useEffect(() => {
    const hasSeenTutorial = localStorage.getItem('hasSeenTutorial');
    if (!hasSeenTutorial) {
      setShowTutorial(true);
      localStorage.setItem('hasSeenTutorial', 'true');
    }
  }, []);

  const handleCloseTutorial = () => {
    setShowTutorial(false);
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
  const AddControls = () => {
    const map = useMap();
    useEffect(() => {
      mapRef.current = map;
      window.leafletTools = { map };
    }, [map]);
    return null;
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
      if (headerRef.current) {
        resizeObserver.unobserve(headerRef.current);
      }
    };
  }, []);
const mapWrapperRef = useRef();

  const handlePrint = async () => {
    if (!mapWrapperRef.current) return;

    const canvas = await html2canvas(mapWrapperRef.current, {
      useCORS: true, // important for map tiles
    });

    const link = document.createElement("a");
    link.download = "map_with_legend_compass.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
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
  const map = mapRef.current;

  if (isChecked) {
    // If the checkbox is checked, show the layer and zoom to it
    if (layerType === 'stateLayer') {
      setShowStateLayer(true);
      zoomToLayer('stateLayer'); // Zoom to this layer
    } else if (layerType === 'districtLayer') {
      setShowDistrictLayer(true);
      zoomToLayer('districtLayer');
    }
    // Add similar logic for other layers
  } else {
    // If the checkbox is unchecked, hide the layer
    if (layerType === 'stateLayer') {
      setShowStateLayer(false);
    } else if (layerType === 'districtLayer') {
      setShowDistrictLayer(false);
    }
    // Add similar logic for other layers
  }
};
   // Fetch incidents whenever layer is toggled ON
  useEffect(() => {
    if (showIncidentLayer) {
      fetch("http://68.178.167.39:5000/api/incidents-with-images?user_id=2")
        .then(res => res.json())
        .then(data => {
          console.log("Fetched incidents:", data); // debug
          setIncidentsData(data);
        })
        .catch(err => console.error("Error fetching incidents", err));
    }
  }, [showIncidentLayer]);
  return (
    <div className="map-wrapper" >


      <div className="map-layout">
        <div className="map-top-left">
 
<aside className="left-sidebar">

  {/* Search Icon Area */}
  <button
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
  </button>

  {/* Search */}
  <button
    title="Search"
    type="button"
    onClick={() => handleToolSidebarClick("search")}
    className={activeToolSidebar === "search" ? "tool-button-active" : "tool-button"}
  >
    <i className="bi bi-search" />
  </button>

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

  <button
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
  </button>


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
          <SearchControlWithInput mapRef={mapRef} />       
        {activeToolSidebar === "searchIconArea" && (
          <div  style={{    }}>      
            </div>
        )}       
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
        <div className="main-container" ref={mapWrapperRef} style={{ height: `calc(90vh - ${headerHeight}px)` }}>
  {/* Toggle Layer Panel button */}
      <button
        title="Layers Panel"
        type="button"
        onClick={() => setShowLayerTogglePanel(prev => !prev)}
        className={activeToolSidebar === "layersPanel" ? "tool-button-active" : "tool-button"}
        style={{ maxHeight: "27px",marginTop:"-9px",marginLeft:"-7px" }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24">
          <path
            d="M3 6H21M3 12H21M3 18H21" // hamburger icon
            stroke={activeToolSidebar === "layersPanel" ? "#ffffff" : "#39E23E"}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>


        {showLayerTogglePanel && (
        <div className="leftpanel-container" style={{ overflow: 'auto' }}>
          <LayerTogglePanel
            showStateLayer={showStateLayer} 
            setShowStateLayer={setShowStateLayer} 
            showDistrictLayer={showDistrictLayer}          
            setShowDistrictLayer={setShowDistrictLayer} 
            showCoupeLayer={showCoupeLayer}           
            setShowCoupeLayer={setShowCoupeLayer}  
            showNdviLayer={showNdviLayer}           
            setShowNdviLayer={setShowNdviLayer}     
            showNdwiLayer={showNdwiLayer}           
            setShowNdwiLayer={setShowNdwiLayer} 
            showPatrollingLayer={showPatrollingLayer}            
            setShowPatrollingLayer={setShowPatrollingLayer} 
            showIncidentLayer={showIncidentLayer}        
            setShowIncidentLayer={setShowIncidentLayer}  
          />
        </div>
      )}
     <div style={{display: "flex", width: "auto" ,height:"auto"}}>

      <MapContainer
        center={position}
        zoom={7.3}
      style={{
        height:"100%",
        width:"83vw"

      }}

  whenCreated={(mapInstance) => {
    mapRef.current = mapInstance;
    // crs={customCRS} 
    // Enable rotation
    mapInstance.rotate = true;
    mapInstance.setBearing(0); // Initialize with 0 degrees rotation
  }}
  rotate={true} // Enable rotation capability
  bearing={0} // Initial bearing
>
 <PrintControl mapRef={mapRef} />
   <TileLayer
   
    url={basemaps[activeBasemap]}
  />
 <WMSTileLayer
    key="gujarat-difference"
    url="https://gisfy.co.in:8443/geoserver/cite/wms"
    layers="cite:Gujarat_difference"
    format="image/png"
    transparent={true}
    version="1.1.0"
    opacity={0.7}
  />

  <WMSTileLayer
      key="Gujarat_State"
      url="https://gisfy.co.in:8443/geoserver/cite/wms"
      layers="cite:Gujarat_State"
      format="image/png"
      transparent={true}
      version="1.1.0"
      opacity={1}
    />

    <WMSTileLayer
      key="Gujarat_State"
      url="https://www.gisfy.co.in:8443/geoserver_tnc_agwl/cite/wms"
      layers="cite:Gujarat_State"
      format="image/png"
      transparent={true}
      version="1.1.0"
      opacity={1}
    />
  {/* {showStateLayer && (
    <WMSTileLayer
      key="Gujarat_State"
      url="https://gisfy.co.in:8443/geoserver/cite/wms"
      layers="cite:Gujarat_State"
      format="image/png"
      transparent={true}
      version="1.1.0"
      opacity={1}
    />
  )} */}
  {showDistrictLayer && (
  <WMSTileLayer
    key="district-layer"
    url="https://gisfy.co.in:8443/geoserver/cite/wms"
    layers="cite:Gujarat_district"   // <-- your district layer
    format="image/png"
    transparent={true}
    version="1.1.0"
    opacity={1}
  />
  )}
  {showCoupeLayer && coupeLayers.map((layerName) => (
    <WMSTileLayer
      key={layerName}
      url="https://gisfy.co.in:8443/geoserver/cite/wms"
      layers={layerName}
      format="image/png"
      transparent={true}
      version="1.1.0"
      opacity={1}  // Adjust opacity if needed
    />
  ))}

  {showNdviLayer &&
    ndviLayers.map((layer) => (
      <WMSTileLayer
        key={layer}
        url="https://gisfy.co.in:8443/geoserver/cite/wms"
        layers={layer}               // single layer each time
        format="image/png"
        transparent={true}
        version="1.1.0"
        opacity={1}                  // adjust individually if needed
      />
    ))}
    {showNdwiLayer &&
      ndwiLayers.map((layer) => (
        <WMSTileLayer
          key={layer}
          url="https://gisfy.co.in:8443/geoserver/cite/wms"
          layers={layer}               // single NDWI layer each
          format="image/png"
          transparent={true}
          version="1.1.0"
          opacity={1}                  // adjust individually if needed
        />
      ))}    
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
    {/* <PatrollingLayer show={showPatrollingLayer} /> */}
    {/* <IncidentLayer show={showIncidentLayer} incidents={incidentsData} /> */}
      <AddControls />
      <GeomanTools />
      <ScaleControl  
        position="bottomleft" 
        className="custom-scale-control" 
      />
       {activeToolSidebar === "search"  && (
          <DraggableZoomControl mapRef={mapRef} />
        )} 
        <LatLngDisplay />
      </MapContainer>
      </div>       
        </div>
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
import React, { useEffect, useRef, useState, lazy, Suspense } from "react";
import { MapContainer, TileLayer, useMap,ScaleControl  } from "react-leaflet";
// import 'leaflet-rotate'; // Import the rotation functionality
import { FaLeaf, FaSeedling, FaSolarPanel, FaTree,FaWater,  FaChevronUp, 
  FaChevronDown, 
  FaFolder, 
  FaFilePdf, 
  FaCalendarAlt, 
  FaUpload, 
  FaExternalLinkAlt, 
  FaDownload,
  FaFileExcel, FaFileAlt,FaChalkboardTeacher, FaFileSignature ,FaUsers,FaCommentDots,FaInfoCircle} from 'react-icons/fa';
import html2canvas from "html2canvas";
import L, { icon } from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-easyprint";
import domtoimage from "dom-to-image";
import PrintControl from "./PrintControl";
import axios from 'axios';
import { FaImages } from 'react-icons/fa';
import "leaflet-draw";
import "leaflet-draw/dist/leaflet.draw.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import 'leaflet-geometryutil';
import Cookies from "js-cookie";
import "./GeoDashboard.css";
import { useNavigate } from 'react-router-dom';

import { FaSignOutAlt } from "react-icons/fa";

import { saveAs } from 'file-saver';
import 'leaflet-measure/dist/leaflet-measure.css';

// import report from "./Resources/Technical Reports/Ecological Scoping Study SPWD.pdf"
import "./RightSidebar.css";

import SearchControlWithInput from './SearchControl';

import Swal from "sweetalert2";
import  DraggableZoomControl from "./DraggableZoomControl";
// import CompassControl from "./CompassControl";
import LatLngDisplay from "./LatLngDisplay";

import 'leaflet/dist/leaflet.css';

// Update your imports at the top
import 'leaflet-measure';
import 'leaflet-measure/dist/leaflet-measure.css';
import { Flex } from "antd";


const LayerTogglePanel = lazy(() => import("./LayerTogglePanel"));
const RightSidebar = lazy(() => import("./RightSidebar"));
const BasemapGallery = lazy(() => import("./Basemapgallery"));

const position = [25.8499, 74.6399];
const customCRS = L.CRS.EPSG4326;

// Basemap URLs
const basemaps = {
  LightGray: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  DarkGray: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
  Imagery: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',

  Oceans: 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}',
  Streets: 'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
  NationalGeo: 'https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}',
  positron:"https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png"
  
};
const Loader2 = () => {
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



export default function MapView() {
  const mapRef = useRef(null);
  const [activeBasemap, setActiveBasemap] = useState("LightGray");
  const [activeTool, setActiveTool] = useState("layers");
 // const [addedLayers, setAddedLayers] = useState({});
  const [legendlist, setLegendlist] = useState([]);
  const [attributetables, setAttributetables] = useState([]);
  const [activetoolone, setActivetoolone] = useState("");
  const [layers, setLayers] = useState("");
  const [userdata, setuserdata] = useState("");
  const [mapTitle, setMapTitle] = useState('');
  const [layout, setLayout] = useState('Letter ANSI A Landscape');
  const [format, setFormat] = useState('PDF');
  const [isOpenlogout, setIsOpenlogout] = useState(false);
  const [drawnPolygons, setDrawnPolygons] = useState([]);
  const [showTutorial, setShowTutorial] = useState(true);
  const [intropopup, setIntropopup] = useState(true);
  const [showsearchicnon, setShowsearchicnon] = useState(false);
   const [showsearchicnonarea, setShowsearchicnonarea] = useState(false);
  const [showdraggableZoomControl, setShowDraggableZoomControl] = useState(false);
 const [featureInfo, setFeatureInfo] = useState(null);
  const [featureInfoPosition, setFeatureInfoPosition] = useState(null);
  const [isInfoToolActive, setIsInfoToolActive] = useState(false);
  const [isLayerLoading2, setIsLayerLoading2] = useState(true);

// const districtsKmlUrl = "/KML/tbldistricts.kml"
// const  villagesKmlUrl = "/KML/Aravali_village_list.kml"



  const [feedback, setFeedback] = useState({ 
    subject: "", 
    comments: "" 
  });
  const [feedbackStatus, setFeedbackStatus] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

  const navigate = useNavigate();
  const dropdownRef = useRef(null);
// Measure tool using leaflet-active-area

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
    };




    const [activeTab, setActiveTab] = useState('Forest Landscape Restoration');

  const handleTabClick = (tabName) => {
    setActiveTab(tabName);
  };


  const village_id=null
  const setvillage_id =null

 const [showreports, setshowreports] = useState(false);
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
          <div  style={{
      // position: 'absolute',
      //     top: '2%',
      //     right: '6%',
      //     zIndex: 1000,
      //     color:"black",
      //     padding: '5px',
      //     borderRadius: '5px',
      //     width: '450px',
      //     boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
      //     backgroundColor: "rgba(0, 0, 0, 0.5)"
    }}>
         
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

       

   
        <div className="main-container" ref={mapWrapperRef} style={{ height: `calc(100vh - ${headerHeight}px)` }}>
  {/* <Suspense fallback={<div>Loading...</div>}>
             <LayerTogglePanel
            mapRef={mapRef}
            layers={layers}
            setActiveTool={setActiveTool}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            setActiveBasemap={setActiveBasemap}
            activeBasemap={activeBasemap}
            // isLayerLoading2={isLayerLoading2}
            // setIsLayerLoading2={setIsLayerLoading2}
            activeToolSidebar={activeToolSidebar}
          />
          </Suspense> */}
<LayerTogglePanel />
     <div style={{display:Flex, }}>

          
{/* <LocationSelector mapRef={mapRef} /> */}


<MapContainer
  center={position}
  zoom={7.3}
 style={{
  height:"100%",
  width:"70vw"

//  height: "85.4vh",
//   width: activeTab === "Renewable Energy" || activeTab === "Climate Adaptations and Finance (NbS)" ? "100vw" : "70vw"
}}

  whenCreated={(mapInstance) => {
    mapRef.current = mapInstance;
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
  <AddControls />
  {/* <DefaultLayers /> */}
  <GeomanTools />
  {/* <AutoKMLLayers
    districtsKmlUrl={districtsKmlUrl}
    villagesKmlUrl={villagesKmlUrl}
   
  /> */}
  <ScaleControl  
    position="bottomleft" 
    className="custom-scale-control" 
  />
       {activeToolSidebar === "search"  && (
          <DraggableZoomControl mapRef={mapRef} />
        )} 
  <LatLngDisplay />
  {/* <CompassControl rotationEnabled={true} /> */}
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
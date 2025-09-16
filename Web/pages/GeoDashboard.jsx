import React, { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-control-geocoder";
import "leaflet-draw";
import "leaflet-draw/dist/leaflet.draw.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import 'leaflet-geometryutil';
import Legend from "./Legend";

import "./GeoDashboard.css";

import LayerTogglePanel from "./LayerTogglePanel";
import RightSidebar from "./RightSidebar";
import BasemapGallery from "./Basemapgallery";



const position = [25.5, 78];

// Basemap URLs
const basemaps = {
  LightGray: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  DarkGray: 'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png',
  Imagery: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  Oceans: 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}',
  Streets: 'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
  NationalGeo: 'https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}',
};

export default function MapView() {
  const mapRef = useRef(null);
  const [activeBasemap, setActiveBasemap] = useState("LightGray");
  const [activeTool, setActiveTool] = useState(null);
  const [addedLayers, setAddedLayers] = useState({});
  const [drawControl, setDrawControl] = useState(null);
  const [legendlist , setLegendlist] = useState([]);
  const [attributetables , setAttributetables] = useState([]);
  const [addedDrawings, setAddedDrawings] = useState({});
  const [activetoolone, setActivetoolone] = useState(null);


  const [activeTitle, setActiveTitle] = useState(""); // To track the active button title

  // Function to handle button click
  const handleButtonClick = (toolName, title) => {
      setActiveTool(toolName);
      setActiveTitle(title);
  };


  const zoomIn = () => mapRef.current?.zoomIn();
  const zoomOut = () => mapRef.current?.zoomOut();
  const resetView = () => mapRef.current?.setView(position, 6);
  const toggleDrag = () => {
    const map = mapRef.current;
    if (map) {
      const isDragging = map.dragging.enabled();
      isDragging ? map.dragging.disable() : map.dragging.enable();
    }
  };

  const toggleFullscreen = () => {
    const elem = document.querySelector(".map-wrapper");
    if (!document.fullscreenElement) {
      elem.requestFullscreen().catch(err => console.error(err));
    } else {
      document.exitFullscreen();
    }
  };

  const handleToolClick = (tool) => {
    setActiveTool(tool);
    const map = mapRef.current;
    if (map) {
      let drawControl;
      if (tool === "line") {
        drawControl = new L.Draw.Polyline(map);
      } else if (tool === "polygon") {
        drawControl = new L.Draw.Polygon(map);
      } else if (tool === "circle") {
        drawControl = new L.Draw.Circle(map);
      } else if (tool === "marker") {
        drawControl = new L.Draw.Marker(map);
      }
      drawControl.enable();
    }
  };
  
  useEffect(() => {
    const map = mapRef.current;
    if (map && activeTool) {
      const control = drawControl;
      map.on("draw:created", (e) => {
        setAddedLayers((prevLayers) => ({
          ...prevLayers,
          [e.layer._leaflet_id]: e.layer,
        }));
      });
    }
  }, [activeTool]);
  
  // This will log whenever the activeBasemap state changes
  

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

  // AddControls Component Definition
  const AddControls = () => {
    const map = useMap(); // useMap hook provides map instance

    useEffect(() => {
      mapRef.current = map;
      window.leafletTools = { map };
    }, [map]);

    return null;
  };


  return (
    <div className="map-wrapper">

      {/* Layout */}
      <div className="map-layout">
        <div className="map-top-left">
          <aside className="left-sidebar">
            <div className="zoom-controls">
              <button title="Zoom In" onClick={zoomIn}><i className="bi bi-plus-lg"></i></button>
              <button title="Zoom Out" onClick={zoomOut}><i className="bi bi-dash-lg"></i></button>
            </div>
            <div className="tool-button">
              <button title="Home" onClick={resetView}><i className="bi bi-house-fill"></i></button>
            </div>
            <div className="tool-button">
  <button title="Pan/Drag Tool" onClick={toggleDrag}>
    <span className="material-icons-outlined" style={{ color: 'white' }}>pan_tool_alt</span>
  </button>
</div>
<div className="tool-button">
  <button title="Fullscreen Toggle" onClick={toggleFullscreen}>
    <span className="material-icons-outlined" style={{ color: 'white' }}>fullscreen</span>
  </button>
</div>
<div className="tool-button">
  <button title="Locate Me" onClick={locate}>
    <span className="material-icons-outlined" style={{ color: 'white' }}>gps_fixed</span>
  </button>
</div>

          </aside>

          <div className="search-bar">
            <input type="text" placeholder="Search here..." />
            <button className="search-btn" title="Search">
              <i className="bi bi-search"></i>
            </button>
          </div>
        </div>

        {/* Sidebar Buttons */}
        <div className="sidebar-icon-set sidebar-icon-left">
          <button
            title="Basemap Gallery"
            onClick={() => setActiveTool("gallery")}
            className={`basegallery ${activeTool === "gallery" ? "active-btn" : ""}`}
          >
            <span className="material-icons-outlined">grid_view</span>
          </button>

          <button
            title="Layers"
            onClick={() => setActiveTool("layers")}
            className={activeTool === "layers" ? "active-btn" : ""}
          >
            <span className="material-icons-outlined">layers</span>
          </button>

          <button
            title="Print"
            onClick={() => setActiveTool("print")}
            className={activeTool === "print" ? "active-btn" : ""}
          >
            <span className="material-icons-outlined">print</span>
          </button>

          <button
            title="Legend"
            onClick={() => setActiveTool("legend")}
            className={`listcss ${activeTool === "legend" ? "active-btn" : ""}`}
          >
            <span className="material-icons-outlined">list</span>
          </button>
        </div>

        {/* Basemap Gallery */}
        {activeTool === "gallery" && ( <BasemapGallery
        activeBasemap={activeBasemap}
  setActiveBasemap={setActiveBasemap}
  addedLayers={addedLayers}
  setAddedLayers={setAddedLayers}

  setActiveTool={setActiveTool}
/>

         
        )}

        {activeTool === "layers" && <LayerTogglePanel mapRef={mapRef} addedLayers={addedLayers} setAddedLayers={setAddedLayers} legendlist={legendlist} attributetables={attributetables} setAttributeTables={setAttributetables} setLegendList={setLegendlist} setActiveTool={setActiveTool} />}

   
        {activeTool === "legend" && <Legend mapRef={mapRef} addedLayers={addedLayers} setAddedLayers={setAddedLayers} legendlist={legendlist} attributetables={attributetables} setAttributeTables={setAttributetables} setLegendList={setLegendlist} setActiveTool={setActiveTool}/>}

     
        {/* Map Display */}
        <MapContainer key={activeBasemap}  center={position} zoom={6} style={{ height: "100vh", width: "100%" }}>
          <TileLayer
            attribution="© OpenStreetMap / Esri contributors"
            url={basemaps[activeBasemap]}
            
          />
          <AddControls />
        </MapContainer>
        <div className="right-sidebar">
            <button 
                title={activetoolone === "Edit" ? "Cancel" : "Edit"} 
                onClick={() => setActivetoolone(activetoolone === "Edit" ? "" : "Edit")} 
                className="right-sidebar-button"
            >
                <span className="material-icons-outlined">
                    {activetoolone === "Edit" ? "cancel" : "edit"}
                </span>
            </button>
            <button 
                className="right-sidebar-button"
                title="Suitability & Decision Models"
                onClick={() => setActivetoolone("Suitability")}
            >
                <span className="material-icons-outlined">assessment</span>
            </button>
            <button
                className="right-sidebar-button"
                title="Proximity Widget"
                onClick={() => setActivetoolone("Proximity")}
            >
                <span className="material-icons-outlined">near_me</span>
            </button>
            <button
                className="right-sidebar-button"
                title="Spatial Analysis"
                onClick={() => setActivetoolone("SpatialAnalysis")}
            >
                <span className="material-icons-outlined">map</span>
            </button>
            <button
                className="right-sidebar-button"
                title="Overlays Widget"
                onClick={() => setActivetoolone("Overlays")}
            >
                <span className="material-icons-outlined">layers</span>
            </button>
            <button
                className="right-sidebar-button"
                title="Zoning Widget"
                onClick={() => setActivetoolone("Zoning Widget")}
            >
          <span className="material-icons-outlined">account_tree</span>
            </button>
        </div>

        {activetoolone=== "Edit" && (
  
  <RightSidebar mapRef={mapRef} addedDrawings={addedDrawings} setAddedDrawings={setAddedDrawings}  addedLayers={addedLayers}
   setAddedLayers={setAddedLayers}/>
)}

       
        {activetoolone === "Suitability" && (
           <SuitabilityDecisionModels activetoolone={activetoolone}  setActivetoolone={setActivetoolone} addedLayers={addedLayers} setAddedLayers={setAddedLayers} legendlist={legendlist} attributetables={attributetables} setAttributeTables={setAttributetables} setLegendList={setLegendlist} />
        )}
        {activetoolone === "Proximity" && (
            <ProximityWidget activetoolone={activetoolone}  setActivetoolone={setActivetoolone} addedLayers={addedLayers} setAddedLayers={setAddedLayers} legendlist={legendlist} attributetables={attributetables} setAttributeTables={setAttributetables} setLegendList={setLegendlist} />
        )}
        {activetoolone === "SpatialAnalysis" && (
            <Spatialanalysis activetoolone={activetoolone}  setActivetoolone={setActivetoolone} addedLayers={addedLayers} setAddedLayers={setAddedLayers} legendlist={legendlist} attributetables={attributetables} setAttributeTables={setAttributetables} setLegendList={setLegendlist} /> 
        )}
        {activetoolone === "Overlays" && (
           <OverlaysWidget activetoolone={activetoolone}  setActivetoolone={setActivetoolone} addedLayers={addedLayers} setAddedLayers={setAddedLayers} legendlist={legendlist} attributetables={attributetables} setAttributeTables={setAttributetables} setLegendList={setLegendlist} />
        )}
 {activetoolone === "Zoning Widget" && (
           <ZoningWidget activetoolone={activetoolone}  setActivetoolone={setActivetoolone} addedLayers={addedLayers} setAddedLayers={setAddedLayers} legendlist={legendlist} attributetables={attributetables} setAttributeTables={setAttributetables} setLegendList={setLegendlist} />
        )}

      </div>
    </div>
  );
}


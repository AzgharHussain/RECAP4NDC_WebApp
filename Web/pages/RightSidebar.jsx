import React, { useState, useEffect } from "react";
import L from "leaflet";
import "leaflet-draw";
import "./RightSidebar.css";

const RightSidebar = ({ mapRef,setActiveToolSidebar }) => {
  const [activeTool, setActiveTool] = useState(null);
  const [drawControl, setDrawControl] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentMeasurement, setCurrentMeasurement] = useState(null);

  // Calculate distance for a polyline
  const calculatePolylineDistance = (latlngs) => {
    let distance = 0;
    for (let i = 0; i < latlngs.length - 1; i++) {
      const pointA = latlngs[i];
      const pointB = latlngs[i + 1];
      distance += pointA.distanceTo(pointB);
    }
    return distance;
  };

  // Calculate area for a polygon
  const calculatePolygonArea = (latlngs) => {
    return L.GeometryUtil.geodesicArea(latlngs);
  };

  // Calculate area for a circle
  const calculateCircleArea = (radius) => {
    return Math.PI * Math.pow(radius, 2);
  };

  // Handle tool clicks to enable the respective drawing tool
  const handleToolClick = (tool) => {
    if (isDrawing) return;

    // Clear previous measurement if exists
    if (currentMeasurement) {
      mapRef.current.removeLayer(currentMeasurement);
      setCurrentMeasurement(null);
    }

    if (drawControl) {
      drawControl.disable();
    }

    setIsDrawing(true);
    setActiveTool(tool);
    const map = mapRef.current;
    if (map) {
      let newDrawControl;
      if (tool === "line") {
        newDrawControl = new L.Draw.Polyline(map);
      } else if (tool === "polygon") {
        newDrawControl = new L.Draw.Polygon(map);
      } else if (tool === "circle") {
        newDrawControl = new L.Draw.Circle(map);
      }

      newDrawControl.enable();
      setDrawControl(newDrawControl);
    }
  };

  useEffect(() => {
    const map = mapRef.current;
    if (map) {
      const handleDrawCreated = (e) => {
        const { layer } = e;

        if (layer instanceof L.Layer) {
          layer.addTo(map);
          setCurrentMeasurement(layer);

          // Calculate and show measurement immediately
          if (layer instanceof L.Polyline) {
            const distance = calculatePolylineDistance(layer.getLatLngs());
            layer.bindPopup(`Distance: ${distance.toFixed(2)} meters`).openPopup();
          } else if (layer instanceof L.Polygon) {
            const area = calculatePolygonArea(layer.getLatLngs());
            layer.bindPopup(`Area: ${Math.abs(area).toFixed(2)} square meters`).openPopup();
          } else if (layer instanceof L.Circle) {
            const radius = layer.getRadius();
            const area = calculateCircleArea(radius);
            layer.bindPopup(`Area: ${area.toFixed(2)} square meters`).openPopup();
          }
        }

        setIsDrawing(false);
        if (drawControl) {
          drawControl.disable();
        }

        const tooltipElement = document.querySelector('.leaflet-draw-tooltip');
        if (tooltipElement) {
          tooltipElement.style.display = 'none';
        }
      };

      map.on("draw:created", handleDrawCreated);

      return () => {
        map.off("draw:created", handleDrawCreated);
      };
    }
  }, [activeTool, mapRef, drawControl]);

  const clearMeasurement = () => {
       setActiveToolSidebar("")
      mapRef.current.removeLayer(currentMeasurement);
      
      setCurrentMeasurement(null);
  
  };

  return (
    <div className="tool-sidebar22222">
      <button
        title="Measure Distance"
        onClick={() => handleToolClick("line")}
        className="right-sidebar-button"
      >
        <span className="material-icons-outlined">straighten</span>
      </button>
      <button
        title="Measure Area"
        onClick={() => handleToolClick("polygon")}
        className="right-sidebar-button"
      >
        <span className="material-icons-outlined">crop_square</span>
      </button>
      <button
        title="Measure Circular Area"
        onClick={() => handleToolClick("circle")}
        className="right-sidebar-button"
      >
        <span className="material-icons-outlined">radio_button_unchecked</span>
      </button>
      <button
        title="Clear Measurement"
        onClick={clearMeasurement}
        className="right-sidebar-button"
        
      >
        <span className="material-icons-outlined">clear</span>
      </button>
    </div>
  );
};

export default RightSidebar;

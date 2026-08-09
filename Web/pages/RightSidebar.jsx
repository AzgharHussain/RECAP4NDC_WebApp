import React, { useState, useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet-draw";
import "./RightSidebar.css";

const RightSidebar = ({ mapRef, setActiveToolSidebar, isActive, onClear }) => {
  const [activeTool, setActiveTool] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [measurementLayers, setMeasurementLayers] = useState([]);
  const drawControlRef = useRef(null);

  // Calculate distance for a polyline (in meters)
  const calculatePolylineDistance = (latlngs) => {
    let distance = 0;
    const flatLatLngs = Array.isArray(latlngs[0]) ? latlngs[0] : latlngs;
    
    for (let i = 0; i < flatLatLngs.length - 1; i++) {
      const pointA = flatLatLngs[i];
      const pointB = flatLatLngs[i + 1];
      distance += pointA.distanceTo(pointB);
    }
    return distance;
  };

  // Calculate area for a polygon (in square meters)
  const calculatePolygonArea = (latlngs) => {
    const flatLatLngs = Array.isArray(latlngs[0]) && !(latlngs[0] instanceof L.LatLng) 
      ? latlngs[0] 
      : latlngs;
    
    if (flatLatLngs.length < 3) return 0;
    
    try {
      const area = L.GeometryUtil.geodesicArea(flatLatLngs);
      return Math.abs(area);
    } catch (error) {
      console.error("Error calculating area:", error);
      return 0;
    }
  };

  // Calculate area for a circle (in square meters)
  const calculateCircleArea = (radius) => {
    return Math.PI * Math.pow(radius, 2);
  };

  // Format distance for display
  const formatDistance = (meters) => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(2)} km`;
    }
    return `${meters.toFixed(2)} m`;
  };

  // Format area for display
  const formatArea = (squareMeters) => {
    if (squareMeters >= 1000000) {
      return `${(squareMeters / 1000000).toFixed(2)} km²`;
    } else if (squareMeters >= 10000) {
      return `${(squareMeters / 10000).toFixed(2)} hectares`;
    }
    return `${squareMeters.toFixed(2)} m²`;
  };

  // Clear all measurement layers
// Clear all measurement layers
const clearAllMeasurements = () => {
  const map = mapRef.current;
  if (!map) return;

  
  // Close any open popup
  map.closePopup();
  
  measurementLayers.forEach(layer => {
    if (map.hasLayer(layer)) {
      // Remove popup if bound to layer
      if (layer.getPopup) {
        layer.unbindPopup();
      }
      map.removeLayer(layer);
    }
  });
  
  setMeasurementLayers([]);
  setActiveTool(null);
  setIsDrawing(false);
  
  // Disable any active drawing
  if (drawControlRef.current) {
    drawControlRef.current.disable();
    drawControlRef.current = null;
  }
  
  // Remove any drawing tooltips
  const tooltipElement = document.querySelector('.leaflet-draw-tooltip');
  if (tooltipElement) {
    tooltipElement.style.display = 'none';
  }
  
  // Call the onClear callback if provided
  if (onClear) {
    onClear();
  }
};

  // Handle tool clicks to enable the respective drawing tool
  const handleToolClick = (tool) => {
    const map = mapRef.current;
    if (!map) return;

    // If already drawing with same tool, disable it
    if (activeTool === tool && isDrawing) {
      if (drawControlRef.current) {
        drawControlRef.current.disable();
        drawControlRef.current = null;
      }
      setIsDrawing(false);
      setActiveTool(null);
      return;
    }

    // Disable previous drawing if any
    if (drawControlRef.current) {
      drawControlRef.current.disable();
      drawControlRef.current = null;
    }

    setIsDrawing(true);
    setActiveTool(tool);

    let newDrawControl;
    if (tool === "line") {
      newDrawControl = new L.Draw.Polyline(map, {
        shapeOptions: {
          color: '#ff4444',
          weight: 4,
          opacity: 0.8
        },
        showLength: true,
        metric: true
      });
    } else if (tool === "polygon") {
      newDrawControl = new L.Draw.Polygon(map, {
        shapeOptions: {
          color: '#ff4444',
          weight: 3,
          opacity: 0.8,
          fillColor: '#ff4444',
          fillOpacity: 0.2
        },
        showArea: true,
        metric: true
      });
    } else if (tool === "circle") {
      newDrawControl = new L.Draw.Circle(map, {
        shapeOptions: {
          color: '#ff4444',
          weight: 3,
          opacity: 0.8,
          fillColor: '#ff4444',
          fillOpacity: 0.2
        },
        showRadius: true,
        metric: true
      });
    }

    if (newDrawControl) {
      newDrawControl.enable();
      drawControlRef.current = newDrawControl;
    }
  };

  // Effect to handle when the sidebar is closed/toggled off
  useEffect(() => {
    if (!isActive) {
      // Clear all measurements when sidebar is closed
      clearAllMeasurements();
    }
  }, [isActive]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleDrawCreated = (e) => {
      const { layer } = e;
      
      if (!(layer instanceof L.Layer)) return;

      // Add the layer to map
      layer.addTo(map);
      
      // Store the layer for later cleanup
      setMeasurementLayers(prev => [...prev, layer]);

      // Calculate and show measurement
      let measurementText = "";

      if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
        const latlngs = layer.getLatLngs();
        const distanceMeters = calculatePolylineDistance(latlngs);
        measurementText = `📏 Distance: ${formatDistance(distanceMeters)}`;
      } 
      else if (layer instanceof L.Polygon) {
        const latlngs = layer.getLatLngs();
        const areaSqMeters = calculatePolygonArea(latlngs);
        measurementText = `📐 Area: ${formatArea(areaSqMeters)}`;
      } 
      else if (layer instanceof L.Circle) {
        const radius = layer.getRadius();
        const areaSqMeters = calculateCircleArea(radius);
        measurementText = `⚪ Circle\nRadius: ${radius >= 1000 ? `${(radius / 1000).toFixed(2)} km` : `${radius.toFixed(2)} m`}\nArea: ${formatArea(areaSqMeters)}`;
      }

      // Create popup with measurement
      if (measurementText) {
        // For lines, show popup at the midpoint
        if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
          const latlngs = layer.getLatLngs();
          const flatLatLngs = Array.isArray(latlngs[0]) ? latlngs[0] : latlngs;
          if (flatLatLngs.length > 0) {
            const midPoint = flatLatLngs[Math.floor(flatLatLngs.length / 2)];
            L.popup()
              .setLatLng(midPoint)
              .setContent(measurementText)
              .openOn(map);
          }
        } else {
          // For polygons and circles, show popup at the center
          try {
            const center = layer.getBounds().getCenter();
            L.popup()
              .setLatLng(center)
              .setContent(measurementText)
              .openOn(map);
          } catch (error) {
            console.error("Error showing popup:", error);
          }
        }
        
        // Also bind popup to the layer for later viewing
        layer.bindPopup(measurementText);
      }

      // Reset drawing state
      setIsDrawing(false);
      setActiveTool(null);
      
      if (drawControlRef.current) {
        drawControlRef.current.disable();
        drawControlRef.current = null;
      }

      // Hide drawing tooltip
      const tooltipElement = document.querySelector('.leaflet-draw-tooltip');
      if (tooltipElement) {
        tooltipElement.style.display = 'none';
      }
    };

    map.on("draw:created", handleDrawCreated);

    return () => {
      map.off("draw:created", handleDrawCreated);
      clearAllMeasurements();
    };
  }, [mapRef]);

  return (
    <div className="tool-sidebar22222">
      <button
        title="Measure Distance (Line)"
        onClick={() => handleToolClick("line")}
        className={`right-sidebar-button ${activeTool === "line" && isDrawing ? 'active' : ''}`}
      >
        <span className="material-icons-outlined">straighten</span>
      </button>
      <button
        title="Measure Area (Polygon)"
        onClick={() => handleToolClick("polygon")}
        className={`right-sidebar-button ${activeTool === "polygon" && isDrawing ? 'active' : ''}`}
      >
        <span className="material-icons-outlined">crop_square</span>
      </button>
      <button
        title="Measure Area (Circle)"
        onClick={() => handleToolClick("circle")}
        className={`right-sidebar-button ${activeTool === "circle" && isDrawing ? 'active' : ''}`}
      >
        <span className="material-icons-outlined">radio_button_unchecked</span>
      </button>
      <button
        title="Clear All Measurements"
        onClick={clearAllMeasurements}
        className="right-sidebar-button clear-button"
      >
        <span className="material-icons-outlined">delete_sweep</span>
      </button>
    </div>
  );
};

export default RightSidebar;
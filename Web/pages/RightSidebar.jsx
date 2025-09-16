import React, { useState, useEffect } from "react";
import L from "leaflet";
import "./RightSidebar.css";

const RightSidebar = ({ mapRef, addedDrawings = {}, setAddedDrawings }) => {
  const [activeTool, setActiveTool] = useState(null);
  const [drawControl, setDrawControl] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false); // To control multiple prompts issue
  const [editingDrawing, setEditingDrawing] = useState(null); // For keeping track of which drawing is being edited
  const [isDrawingListVisible, setIsDrawingListVisible] = useState(true); // State to toggle drawing list visibilit
  // Save all drawn items to localStorage
  const saveDrawings = () => {
    const savedData = Object.values(addedDrawings).map((item) => ({
      id: item.id,
      type: item.type,
      name: item.name,
      latlng: item.drawing.getLatLng ? item.drawing.getLatLng() : item.drawing.getLatLngs(),
    }));
    localStorage.setItem("drawnItems", JSON.stringify(savedData));
  };

  // Load saved items from localStorage
  const loadDrawings = () => {
    const savedData = JSON.parse(localStorage.getItem("drawnItems")) || [];
    const map = mapRef.current;
    const newDrawings = {};

    savedData.forEach((data) => {
      let drawing;
      if (data.type === "line") {
        drawing = L.polyline(data.latlng);
      } else if (data.type === "polygon") {
        drawing = L.polygon(data.latlng);
      } else if (data.type === "circle") {
        drawing = L.circle(data.latlng, { radius: 500 });
      } else if (data.type === "marker") {
        drawing = L.marker(data.latlng);
      }

      drawing.addTo(map);
      newDrawings[data.id] = { id: data.id, type: data.type, name: data.name, drawing };
    });
    setAddedDrawings(newDrawings);
  };

  useEffect(() => {
    const map = mapRef.current;
    if (map && drawControl) {
      map.on("draw:created", (e) => {
        const { layer } = e;
        const id = Date.now(); // Use current timestamp as ID for unique reference
        const name = prompt("Enter a name for the drawing:"); // Optional: prompt for name
  
        if (name && layer) {
          // Ensure drawing is a valid Leaflet object before adding
          if (layer instanceof L.Layer) {
            setAddedDrawings((prevDrawings) => ({
              ...prevDrawings,
              [id]: { id, type: activeTool, name, drawing: layer },
            }));
  
            layer.addTo(map); // Add the drawing to the map
          } else {
            console.error("Created drawing is not a valid Leaflet object", layer);
          }
        }
  
        setIsDrawing(false); // Reset drawing state after completing the drawing
  
        // Disable the drawing tool after the drawing is created
        if (drawControl) {
          drawControl.disable(); // Disable the drawing control
        }
  
        // Optionally, you can hide or remove the tooltip manually if needed
        const tooltipElement = document.querySelector('.leaflet-draw-tooltip');
        if (tooltipElement) {
          tooltipElement.style.display = 'none'; // Hide the tooltip
        }
      });
    }
  }, [activeTool, mapRef, drawControl, setAddedDrawings]);

  // Toggle the visibility of the drawing list
  const toggleDrawingListVisibility = () => {
    setIsDrawingListVisible(!isDrawingListVisible);
  };

  // Toggle individual drawing visibility
  const toggleDrawingVisibility = (id) => {
    const drawing = addedDrawings[id]?.drawing; // Get the drawing object by ID
    const map = mapRef.current;

    if (drawing && map) {
      if (map.hasLayer(drawing)) {
        map.removeLayer(drawing); // Remove the drawing if it's already on the map
      } else {
        map.addLayer(drawing); // Add it back if it's not on the map
      }
    } else {
      console.error("Invalid drawing object or map is undefined:", drawing);
    }
  };   

  // Handle tool clicks to enable the respective drawing tool
const handleToolClick = (tool) => {
  if (isDrawing) return; // Prevent multiple draws if one is in progress

  // Disable the previous draw control if it exists
  if (drawControl) {
    drawControl.disable(); // Disable the drawing control of the previous tool
  }

  setIsDrawing(true); // Set drawing state to true
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
    } else if (tool === "marker") {
      newDrawControl = new L.Draw.Marker(map);
    }

    // Enable the respective drawing tool
    newDrawControl.enable();
    setDrawControl(newDrawControl);
  }
};

// Handle editing of a drawing from the drawing list
const handleEditClick = (id) => {
  const map = mapRef.current;
  const drawing = addedDrawings[id]?.drawing; // Get the drawing object by ID

  if (drawing) {
    setEditingDrawing(id); // Set the drawing being edited

    // Disable the draw control before editing
    if (drawControl) {
      drawControl.disable(); // Disable the drawing control
    }

    const featureGroup = new L.FeatureGroup([drawing]); // Create a feature group for the drawing

    // Initialize the edit toolbar for the feature group
    const editControl = new L.EditToolbar.Edit(map, {
      featureGroup: featureGroup, // Attach the feature group to the editing toolbar
    });

    editControl.enable(); // Enable editing mode for the drawing
  } else {
    console.error("Drawing (object) not found for editing.");
  }
};

// Handle save when done editing
const handleSaveClick = (id) => {
  const map = mapRef.current;
  const drawing = addedDrawings[id]?.drawing; // Get the drawing object by ID

  if (drawing && drawing instanceof L.Layer) {
    drawing.addTo(map); // Add the drawing to the map
  } else {
    console.error("Drawing not found or invalid: ", drawing);
  }

  // Disable the draw control (stop drawing mode)
  if (drawControl) {
    drawControl.disable();
  }

  map.dragging.enable(); // Re-enable map dragging if needed

  // If using L.Editable or any editing tool, stop editing manually
  if (drawing && drawing.editing) {
    drawing.editing.disable(); // Disable editing of the drawing (if editing is enabled)
  }

  setEditingDrawing(null); // Reset the editing state
  setIsDrawing(false); // Reset drawing state after saving
};

// Handle delete click to remove a drawing
const handleDeleteClick = (id) => {
  const map = mapRef.current;
  const drawing = addedDrawings[id]?.drawing; // Get the drawing object by ID

  if (drawing) {
    map.removeLayer(drawing); // Remove the drawing from the map
    setAddedDrawings((prevDrawings) => {
      const newDrawings = { ...prevDrawings };
      delete newDrawings[id]; // Delete the drawing by ID
      return newDrawings;
    });
  }

  // Disable the drawing control and hide the tooltip
  if (drawControl) {
    drawControl.disable(); // Disable the draw control
  }

  const tooltipElement = document.querySelector('.leaflet-draw-tooltip');
  if (tooltipElement) {
    tooltipElement.style.display = 'none'; // Hide the tooltip
  }
};


  return (
    <div>
      {/* Right Sidebar */}
      <div className="tool-sidebar">
        <button title="Draw Line" onClick={() => handleToolClick("line")} className="right-sidebar-button">
          <span className="material-icons-outlined">timeline</span>
        </button>
        <button title="Draw Polygon" onClick={() => handleToolClick("polygon")}  className="right-sidebar-button">
          <span className="material-icons-outlined">polyline</span>
        </button>
        <button title="Draw Circle" onClick={() => handleToolClick("circle")}  className="right-sidebar-button">
          <span className="material-icons-outlined">circle</span>
        </button>
        <button title="Draw Point" onClick={() => handleToolClick("marker")}  className="right-sidebar-button">
          <span className="material-icons-outlined">location_on</span>
        </button>

        {/* Add Text Tool */}
        <button
          title="Add Text"
          onClick={() => {
            const map = mapRef.current;
            if (map) {
              const center = map.getCenter();
              const text = prompt("Enter label text:");
              if (text) {
                L.marker(center).addTo(map).bindPopup(text).openPopup();
              }
            }
          }}
          className="right-sidebar-button"
        >
          <span className="material-icons-outlined">title</span>
        </button>

        {/* Toggle Drawing List Visibility */}
        <button title="Toggle Drawing List" onClick={toggleDrawingListVisibility} className="right-sidebar-button">
          <span className="material-icons-outlined">list</span>
        </button>
      </div>

      {/* Drawing List displayed below the sidebar */}
      {isDrawingListVisible && Object.keys(addedDrawings || {}).length > 0 && (
        <div className="drawing-list">
          <h4>Added Drawings:</h4>
          <div className="drawing-items">
            {Object.keys(addedDrawings).map((key) => (
              <div key={key} className="drawing-item">
                <span>{addedDrawings[key].name}</span>
                {editingDrawing !== key ? (
                  <>
                    <button onClick={() => handleEditClick(key)} className="drawing-btn edit-btn">
                      Edit
                    </button>
                    <button onClick={() => handleDeleteClick(key)} className="drawing-btn delete-btn">
                      Delete
                    </button>
                    <button onClick={() => toggleDrawingVisibility(key)} className="drawing-btn hide-btn">
                      {mapRef.current.hasLayer(addedDrawings[key].drawing) ? "Hide" : "Show"}
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => handleSaveClick(key)} className="drawing-btn save-btn">
                      Save
                    </button>
                    <button onClick={() => setEditingDrawing(null)} className="drawing-btn cancel-btn">
                      Cancel
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default RightSidebar;
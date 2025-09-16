import React, { useState, useEffect } from "react";
import L from "leaflet";
import "./LayerTogglePanel.css";
import Swal from "sweetalert2";

export default function LayerTogglePanel({
  mapRef,
  addedLayers,
  setAddedLayers,
  legendlist,
  attributetables,
  setLegendList,
  setAttributeTables,
  setActiveTool
}) {
  const [isOpen, setIsOpen] = useState(true);
  const [opacity, setOpacity] = useState({});
  const [selectedLayer, setSelectedLayer] = useState(null);
  const [attributeData, setAttributeData] = useState(null);
  const [isLayerLoading, setIsLayerLoading] = useState(false);
  const [isTableLoading, setIsTableLoading] = useState(false);
  const geoserverUrl = "https://www.gisfy.co.in:8443/geoserver/ows";
  const [openGroups, setOpenGroups] = useState({});
  const [selectedLayers, setSelectedLayers] = useState([]);
  
  const [isContainerVisible, setContainerVisible] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [clickPosition, setClickPosition] = useState(null); // Store multiple selected layers

  // Toggle the visibility of the group in the sidebar
  const toggleGroup = (idx) => {
    setOpenGroups((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const toggleLayer = (layerName, label) => {
    const map = mapRef.current;
    if (!map) return;

    setIsLayerLoading(true);

    if (addedLayers[layerName]) {
      map.removeLayer(addedLayers[layerName]);
      const updated = { ...addedLayers };
      delete updated[layerName];
      setAddedLayers(updated);
      setSelectedLayer(null);
      setIsLayerLoading(false);
      setSelectedLayers((prevLayers) => prevLayers.filter((layer) => layer !== layerName)); // Remove from selectedLayers
    } else {
      const layer = L.tileLayer.wms(geoserverUrl, {
        layers: layerName,
        format: "image/png",
        transparent: true,
        attribution: label,
        version: "1.1.1",
        styles: "",
        zIndex: 1000,
      }).addTo(map);
      setAddedLayers((prev) => ({ ...prev, [layerName]: layer }));
      setIsLayerLoading(false);

      setOpacity((prev) => ({ ...prev, [layerName]: 1 }));
      setSelectedLayers((prevLayers) => [...prevLayers, layerName]); // Add to selectedLayers
    }
  };

  // Handle opacity change for layers
  const handleOpacityChange = (e, layerName) => {
    const map = mapRef.current;
    if (!map) return;

    const newOpacity = e.target.value;
    setOpacity((prev) => ({ ...prev, [layerName]: newOpacity }));

    if (addedLayers[layerName]) {
      addedLayers[layerName].setOpacity(newOpacity);
    }
  };

  const handleViewAttributes = (layerName) => {
    const map = mapRef.current;
    if (!map) return;

    const params = {
      REQUEST: "GetFeatureInfo",
      SERVICE: "WMS",
      VERSION: "1.1.1",
      LAYERS: layerName,
      STYLES: "",
      SRS: "EPSG:4326",
      BBOX: map.getBounds().toBBoxString(),
      WIDTH: map.getSize().x,
      HEIGHT: map.getSize().y,
      QUERY_LAYERS: layerName,
      INFO_FORMAT: "application/json",

    };

    const url = `${geoserverUrl}?${new URLSearchParams(params).toString()}`;

    fetch(url)
      .then((response) => response.text())
      .then((data) => {
        try {
          if (data.startsWith("<?xml")) {
            console.error("Error: Received XML instead of JSON.", data);
            Swal.fire("Error", "Received XML instead of expected JSON.", "error");
            return;
          }

          const jsonData = JSON.parse(data);
          if (jsonData.features.length > 0) {
            setAttributeData(jsonData.features.map((feature) => feature.properties));
            setSelectedLayer(layerName);

            setAttributeTables((prev) => ({
              ...prev,
              [layerName]: jsonData.features
            }));
          } else {
            Swal.fire("No data found", "No attributes found for this layer.", "info");
          }
        } catch (error) {
          console.error("Error parsing JSON:", error);
          Swal.fire("Error", "Failed to parse attribute data.", "error");
        }
      })
      .catch((error) => {
        console.error("Error fetching attributes:", error);
        Swal.fire("Error", "Failed to fetch attribute data.", "error");
      });
  };

  const getLegendUrl = (layerName) => {
    return `${geoserverUrl}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetLegendGraphic&FORMAT=image/png&LAYER=${layerName}`;
  };

  const closePanel = () => {
    setIsOpen(false);
  };

  const toggleDrawingListVisibility = () => {
    setIsOpen(!isOpen);
  };

  const safeGet = (value) => {
    return value !== undefined && value !== null && value !== "" ? value : "Not available";
  };

  const closeAttributeTable = () => {
    setSelectedLayer(null);
    setAttributeData(null);
  };

  const Loader = () => (
    <div className="green-loader">Loading...</div>
  );

  // Handle map click to display attribute data of the selected layer
  const handleMapClick = (e) => {
    const map = mapRef.current;
    if (!map) return;

    const latlng = e.latlng;
    console.log("Clicked Lat/Lng:", latlng);

    // Get the first selected layer (if any)
    const firstSelectedLayer = selectedLayers[0];
    if (!firstSelectedLayer) {
      Swal.fire("No Layer Selected", "Please select a layer first.", "info");
      return;
    }

    const params = {
      REQUEST: "GetFeatureInfo",
      SERVICE: "WMS",
      VERSION: "1.1.1",
      LAYERS: firstSelectedLayer,
      STYLES: "",
      SRS: "EPSG:4326",
      BBOX: map.getBounds().toBBoxString(),
      WIDTH: map.getSize().x,
      HEIGHT: map.getSize().y,
      QUERY_LAYERS: firstSelectedLayer,
      INFO_FORMAT: "application/json",
      X: map.latLngToContainerPoint(latlng).x, // Convert lat/lng to pixel coordinates
      Y: map.latLngToContainerPoint(latlng).y,
    };

    console.log("Generated WMS Request URL:", `${geoserverUrl}?${new URLSearchParams(params).toString()}`);

    fetch(`${geoserverUrl}?${new URLSearchParams(params).toString()}`)
      .then((response) => response.text())
      .then((data) => {
        console.log("Received Data:", data);
        try {
          const jsonData = JSON.parse(data);
          if (jsonData.features.length > 0) {
            setAttributeData(jsonData.features.map((feature) => feature.properties));
            setClickPosition(latlng); // Store click position
            setContainerVisible(true); // Show the attribute container

            setAttributeTables((prev) => ({
              ...prev,
              [firstSelectedLayer]: jsonData.features,
            }));

            // Hide the container after 5 seconds
            setTimeout(() => {
              if (!hovered) setContainerVisible(false); // Hide if not hovered
            }, 5000);
          } else {
            Swal.fire("No data found", "No attributes found for this point.", "info");
          }
        } catch (error) {
          console.error("Error parsing JSON:", error);
          Swal.fire("Error", "Failed to parse attribute data.", "error");
        }
      })
      .catch((error) => {
        console.error("Error fetching attributes:", error);
        Swal.fire("Error", "Failed to fetch attribute data.", "error");
      });
  };

  // Show container when hovered over
  const handleMouseEnter = () => {
    setHovered(true);
  };

  const handleMouseLeave = () => {
    setHovered(false);
    // Hide the container after 5 seconds if not hovered
    if (!hovered) setContainerVisible(false);
  };

  useEffect(() => {
    const map = mapRef.current;
    if (map) {
      map.on("click", handleMapClick);
    }
    return () => {
      const map = mapRef.current;
      if (map) {
        map.off("click", handleMapClick);
      }
    };
  }, [selectedLayers]);

  
  let configlist = {
    groups: {
        group_title: [
            {
                title: "",
               
                layerList: [
                    
                ]
            }
,
            {
                title: "",
               
                layerList: [
                   
                ]
            },
            {
                title: "",
               
                layerList: [
                  
                ]
            },
            {
                title: "",
                
                layerList: [
                    
                ]
            },
            {
                title: "",
               
                layerList: [
                    
                ]

            },
            {
                title: "",
              
                layerList: [
                   
                ]
            },
            {
                title: "",
               
                layerList: [
                  
                ]
            }
            //{
            //    title: "Forests",
            //    keepToggleState: false,
            //    id: "dd_Layer_9",
            //    groupSwitch: "dd_group_1",
            //    SwitchType: "checkbox",
            //    index: 10,
            //    keepLegend: true,
            //    KeepGroup: true,
            //    layerList: [
            //        { Name: "ForestFSI_State", Layer: "State-wise Forest Cover (FSI)" },
            //        { Name: "Forest_Reserved_boundaries", Layer: "Reserved Forest Boundaries" },
            //        { Name: "Forest_etah_blocks", Layer: "Etah Forest Blocks" },
            //        { Name: "Forest_etah_compartments", Layer: "Etah Forest Compartments" },
            //        { Name: "Forest_etah_division", Layer: "Etah Forest Division" },
            //        { Name: "Forest_etah_ranges", Layer: "Etah Forest Ranges" }
            //    ]
            //}
        ]
    }
};
return (
  <>
    {isOpen && (
      <div className="layer-toggle-panel">
        <div className="panel-header">
          <h4>Available Layers</h4>
          <button onClick={() => setActiveTool(null)} style={{ backgroundColor: 'transparent', border: 'none' }}>
            <span className="material-icons-outlined" style={{ color: 'black' }}>close</span>
          </button>
        </div>

        {isLayerLoading ? (
          <Loader />
        ) : (
          configlist.groups.group_title.map((group, idx) => (
            <div key={idx} className="layer-group">
              <div
                className="group-title"
                onClick={() => toggleGroup(idx)}
                style={{ cursor: "pointer" }}
              >
                <span>{group.title}</span>
                <span className="arrow-icon">{openGroups[idx] ? "▾" : "▸"}</span>
              </div>

              <div
                className={`layer-list-wrapper ${openGroups[idx] ? "expanded" : "collapsed"}`}
              >
                {group.layerList.map((layer, lid) => {
                  const isChecked = !!addedLayers[layer.Name];
                  return (
                    <div key={lid} className="layer-item">
                      <label>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleLayer(layer.Name, layer.Layer)}
                        />
                        <span
                          title={layer.Name}
                          style={{
                            fontWeight: isChecked ? "bold" : "normal",
                            marginLeft: "8px",
                          }}
                        >
                          {layer.Layer}
                        </span>
                      </label>

                      {isChecked && (
                        <div>
                          {/* Opacity Control */}
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={opacity[layer.Name] || 1}
                            onChange={(e) => handleOpacityChange(e, layer.Name)}
                          />
                          <span>{(opacity[layer.Name] || 1) * 100}% Opacity</span>
                        </div>
                      )}

                      {isChecked && (
                        <button
                          onClick={() => handleViewAttributes(layer.Name)}
                          className="view-attributes-btn"
                        >
                          View Attribute Table
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    )}

    
      

    {/* Display selected layer's attribute table */}
    {selectedLayer && attributeData && (
      <div className="attribute-table-container">
        <button onClick={closeAttributeTable} className="close-table-btn">
          Close Table
        </button>
        <h3>Attributes for {selectedLayer}</h3>
        {isTableLoading ? (
          <Loader />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Attribute Name</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(attributeData).map((key) => (
                <tr key={key}>
                  <td>{key}</td>
                  <td>{safeGet(attributeData[key])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {isContainerVisible && attributeData && clickPosition && (
        <div
          className="attribute-data-container"
          style={{
            position: "absolute",
            top: `${clickPosition.lat}px`,
            left: `${clickPosition.lng}px`,
            background: "white",
            padding: "10px",
            border: "1px solid black",
            zIndex: 9999,
          }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div>
            <h4>Attribute Data:</h4>
            {attributeData.map((attr, index) => (
              <div key={index}>
                <strong>{attr.name}:</strong> {attr.value || "Not Available"}
              </div>
            ))}
          </div>
        </div>
      )}
      {attributeData && (
  <table>
    <thead>
      <tr>
        <th>Attribute Name</th>
        <th>Value</th>
      </tr>
    </thead>
    <tbody>
      {attributeData.map((attr, index) => (
        <tr key={index}>
          <td>{attr.name}</td>
          <td>{attr.value}</td>
        </tr>
      ))}
    </tbody>
  </table>
)}

      </div>
    )}
  </>
);
}
import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Polyline, Popup, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import { Card, Tag, Typography, Row, Col, Button } from "antd";
import { CloseOutlined } from "@ant-design/icons";
import { useLanguage } from "../context/LanguageContext";
import { API_BASE_URL } from "../config";
import "./RouterMap.css";

const { Title, Text } = Typography;

// Custom icons
const startIcon = new L.Icon({
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const endIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
  iconSize: [25, 25],
  iconAnchor: [12, 12],
  popupAnchor: [0, -12],
});

// Loader Component
const Loader = () => {
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

// Component to resize map and fit bounds
function ResizeMapOnShow({ coords }) {
  const map = useMap();
  
  useEffect(() => {
    const resizeAndFit = () => {
      map.invalidateSize();
      if (coords && coords.length > 0) {
        const bounds = L.latLngBounds(coords);
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    };
    
    // Small delay to ensure DOM is ready
    const timer = setTimeout(resizeAndFit, 100);
    
    return () => clearTimeout(timer);
  }, [map, coords]);
  
  return null;
}

// Patrol Route Popup Component
const PatrolRoutePopup = ({ patrol, language }) => {
  const formatDateTime = (datetime) => {
    try {
      const date = new Date(datetime);
      if (isNaN(date.getTime())) return { date: "Invalid Date", time: "" };
      
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const year = date.getFullYear();
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      return { date: `${day}-${month}-${year}`, time: `${hours}:${minutes}` };
    } catch (error) {
      return { date: "Error", time: "" };
    }
  };

  const getTypeDisplayName = (type) => {
    if (!type) return "";
    
    if (language === "gu") {
      switch (type) {
        case "Day patrolling": return "દિવસ પેટ્રોલિંગ";
        case "Night patrolling": return "રાત પેટ્રોલિંગ";
        case "Beat checking": return "બીટ ચેકિંગ";
        default: return type;
      }
    }
    return type;
  };

  const getTypeColor = (type) => {
    if (!type) return "default";
    
    switch (type) {
      case "Day patrolling": return "blue";
      case "Night patrolling": return "purple";
      case "Beat checking": return "green";
      default: return "default";
    }
  };

  const { date: startDate, time: startTime } = formatDateTime(patrol.start_time);
  const { date: endDate, time: endTime } = formatDateTime(patrol.end_time);

  return (
    <div style={{ width: 300 }}>
      <Card
        title={
          <div style={{ textAlign: "center", fontWeight: "bold" }}>
            {language === "gu" ? "પેટ્રોલ વિગતો" : "Patrol Details"}
          </div>
        }
        style={{ boxShadow: "none" }}
      >
        <Row gutter={[8, 8]}>
          <Col span={24}>
            <Text strong>{language === "gu" ? "પેટ્રોલ આઈડી:" : "Patrol ID:"} {patrol.patrol_id || "N/A"}</Text>
          </Col>
          <Col span={24}>
            <Tag color={getTypeColor(patrol.type_name)}>
              {getTypeDisplayName(patrol.type_name)}
            </Tag>
          </Col>
          <Col span={24}>
            <Text strong>{language === "gu" ? "અધિકારી:" : "Officer:"} {patrol.patrol_officer_name || "N/A"}</Text>
          </Col>
          <Col span={12}>
            <Text type="secondary">{language === "gu" ? "શરૂઆત:" : "Start:"}</Text>
            <div>{startDate}</div>
            <div>{startTime}</div>
          </Col>
          <Col span={12}>
            <Text type="secondary">{language === "gu" ? "સમાપ્તિ:" : "End:"}</Text>
            <div>{endDate}</div>
            <div>{endTime}</div>
          </Col>
          <Col span={12}>
            <Text type="secondary">{language === "gu" ? "અંતર:" : "Distance:"}</Text>
            <div>{patrol.distance_kms || 0} km</div>
          </Col>
          <Col span={12}>
            <Text type="secondary">{language === "gu" ? "સ્ટાફ:" : "Staff:"}</Text>
            <div>{patrol.number_of_staff || 1}</div>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

// Main RouterMap Component
const RouterMap = ({ language, setShowMapRoute ,showmaproute}) => {
  const [patrolData, setPatrolData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPatrol, setSelectedPatrol] = useState(null);
  const [mapCenter] = useState([22.3039, 70.8022]); // Default center (Rajkot, Gujarat)
  const [mapZoom] = useState(12);

  const fetchPatrolData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/patrol-info?user_id=1`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const data = await response.json();
      const formattedData = Array.isArray(data.data) 
        ? data.data.filter(item => item && item.geom) 
        : (data.data && data.data.geom ? [data.data] : []);
      
      setPatrolData(formattedData);
    } catch (error) {
      console.error("Error fetching Patrol data:", error);
      setPatrolData([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPatrolData();
  }, []);

  // Parse coordinates from geom string
const parseGeomCoordinates = (geom) => {
  if (!geom) return [];
  try {
    // NEW: Format is "lat lng,lat lng"
    return geom
      .split(",")
      .map(coord => {
        // Directly map to [lat, lng] without swapping
        const [lat, lng] = coord.trim().split(" ").map(Number);
        return [lat, lng];
      })
      .filter(([lat, lng]) => !isNaN(lat) && !isNaN(lng));
  } catch (error) {
    console.error("Error parsing geom coordinates:", error, geom);
    return [];
  }
};

  // Get all coordinates for map bounds
  const getAllCoordinates = () => {
    const allCoords = patrolData.flatMap(patrol => 
      parseGeomCoordinates(patrol.geom)
    );
    return allCoords.length > 0 ? allCoords : [mapCenter];
  };

  const getRouteColor = (type) => {
    switch (type) {
      case "Day patrolling": return "#0084ff";
      case "Night patrolling": return "#6a00ff";
      case "Beat checking": return "#55ff00";
      default: return "#d9d9d9";
    }
  };

 

  const handleMarkerClick = (patrol) => {
    const coords = parseGeomCoordinates(patrol.geom);
    const start = coords[0] || mapCenter;
    
    // Create and open popup
    L.popup()
      .setLatLng(start)
      .setContent(<PatrolRoutePopup patrol={patrol} language={language} />)
      .openOn(document.querySelector('.leaflet-container')._leaflet_map);
  };

  return (
    <div className="router-map-container">
      {/* Close Button */}
      <Button
        type="primary"
        danger
        shape="circle"
        icon={<CloseOutlined />}
       onClick={() => {
    setShowMapRoute(!showmaproute);
  }}
        style={{
          position: "absolute",
          top: "10px",
          right: "10px",
          zIndex: 1000,
        }}
      />
      
      {isLoading ? (
        <Loader />
      ) : (
      <MapContainer
  style={{ height: "100%", width: "100%" }}
  center={mapCenter}
  zoom={mapZoom}
  scrollWheelZoom={true}
  whenCreated={(map) => {
    // ✅ ADD GEOSERVER WMS DIRECTLY
    const beatBoundaryLayer = L.tileLayer.wms(
      "https://www.gisfy.co.in:8443/geoserver/wms",
      {
        layers: "Recap4NDC:Teritorial_Circle_Beat_Boundary",
        format: "image/png",
        transparent: true,
        version: "1.1.1",
        zIndex: 100000, // stays above base map
      }
    );

    beatBoundaryLayer.addTo(map);
  }}
>

          <ResizeMapOnShow coords={getAllCoordinates()} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
            url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
          />
          
          {patrolData.map((patrol) => {
            const routeCoords = parseGeomCoordinates(patrol.geom);
            
            if (routeCoords.length === 0) return null;
            
            const start = routeCoords[0];
            const end = routeCoords.length > 1 ? routeCoords[routeCoords.length - 1] : start;
            
            return (
              <React.Fragment key={patrol.patrol_id || patrol.id || Math.random()}>
                {/* Route Polyline */}
                <Polyline
                  positions={routeCoords}
                  pathOptions={{
                    color: getRouteColor(patrol.type_name),
                    weight: 4,
                    opacity: 0.8,
                  }}
                  eventHandlers={{
                    click: () => handleMarkerClick(patrol),
                  }}
                />
                
                {/* Start Marker */}
                <Marker 
                  position={start} 
                  icon={startIcon}
                  eventHandlers={{
                    click: () => handleMarkerClick(patrol),
                  }}
                >
                  <Popup>
                    <div>
                      <Text strong>{language === "gu" ? "શરૂઆત" : "Start"}</Text>
                      <div>{patrol.start_location || "Start Location"}</div>
                    </div>
                  </Popup>
                </Marker>
                
                {/* End Marker (only if different from start) */}
                {routeCoords.length > 1 && (
                  <Marker 
                    position={end} 
                    icon={endIcon}
                    eventHandlers={{
                      click: () => handleMarkerClick(patrol),
                    }}
                  >
                    <Popup>
                      <div>
                        <Text strong>{language === "gu" ? "અંત" : "End"}</Text>
                        <div>{patrol.end_location || "End Location"}</div>
                      </div>
                    </Popup>
                  </Marker>
                )}
              </React.Fragment>
            );
          })}
          
          {/* Show message if no patrol data */}
          {patrolData.length === 0 && !isLoading && (
            <div style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              backgroundColor: "white",
              padding: "20px",
              borderRadius: "5px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
              zIndex: 1000,
            }}>
              <Text>{language === "gu" ? "કોઈ પેટ્રોલ ડેટા મળ્યો નથી" : "No patrol data found"}</Text>
            </div>
          )}
        </MapContainer>
      )}
    </div>
  );
};

export default RouterMap;
import React, { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";

const startIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const endIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Component to zoom & render patrol route
function PatrolRoute({ patrol }) {
  const map = useMap();

  let coords = [];
  if (patrol.cover_distance?.coordinates) {
    // GeoJSON [lng, lat] → Leaflet [lat, lng]
    coords = patrol.cover_distance.coordinates.map(([lat, lng]) => [lat, lng]);
  } else if (patrol.route_points) {
    coords = patrol.route_points.map((p) => p.split(",").map(Number));
  } else {
    const start = patrol.start_location.split(",").map(Number);
    const end = patrol.end_location.split(",").map(Number);
    coords = [start, end];
  }

  const start = coords[0];
  const end = coords[coords.length - 1];

  // Auto zoom
  useEffect(() => {
    if (coords.length > 0) {
      map.fitBounds(coords, { padding: [50, 50] });
    }
  }, [coords, map]);

  return (
    <>
      <Marker position={start} icon={startIcon}>
        <Popup>Start</Popup>
      </Marker>
      <Marker position={end} icon={endIcon}>
        <Popup>End</Popup>
      </Marker>
      <Polyline positions={coords} pathOptions={{ color: "white", weight: 4 }} />
    </>
  );
}

export default function PatrolMap({ patrol }) {
  if (!patrol) return null;

  return (
    <div style={{ width: "100%", height: "500px" }}>
      <h3>
        Patrol Route - {patrol.patrol_officer_name} (Distance:{" "}
        {parseFloat(patrol.distance_kms).toFixed(3)} km)
      </h3>

      <MapContainer
        center={[33.5453, 75.2291]} // fallback center
        zoom={17}
        style={{ width: "100%", height: "450px" }}
      >
        {/* Satellite basemap (Google-style) */}
        <TileLayer
          url="https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
          subdomains={["mt0", "mt1", "mt2", "mt3"]}
        />
        <PatrolRoute patrol={patrol} />
      </MapContainer>
    </div>
  );
}

import React from "react";
import { MapContainer, TileLayer } from "react-leaflet";
import 'leaflet/dist/leaflet.css';

const ViewCoupeBoundaries = () => {
  // Map center coordinates (can be dynamic based on your data)
  const mapCenter = [21.943, 70.931];

  return (
    <div>
      <h3 className="main-heading">Working Plan Areas (View Coupe Boundaries)</h3>
      <MapContainer
        center={mapCenter} // Set the center of the map to the mapCenter variable
        zoom={12}
        scrollWheelZoom={false}
        style={{ height: "600px", width: "100%",borderRadius: "12px", }}
      >
        {/* TileLayer provides the base map from OpenStreetMap */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors"
        />
      </MapContainer>
    </div>
  );
};

export default ViewCoupeBoundaries;

import React from "react";
import { MapContainer, TileLayer } from "react-leaflet";
import 'leaflet/dist/leaflet.css';
import { useLanguage } from "../context/LanguageContext"; // Import language context

const ViewCoupeBoundaries = () => {
  const mapCenter = [21.943, 70.931];
  const { language } = useLanguage(); // Use language context

  // Define text for English and Gujarati
  const text = {
    en: {
      title: "Working Plan Areas (View Coupe Boundaries)",
    },
    gu: {
      title: "કાર્ય યોજના ક્ષેત્રો (કોપ બાઉન્ડરીઝ જુઓ)",
    },
  };

  return (
    <div className="view-coupe-boundaries-container">
      {/* ✅ Added container (no style change inside) */}
      <div className="view-coupe-boundaries-content">
        <h3 className="main-heading">{text[language].title}</h3>
        <MapContainer
          center={mapCenter}
          zoom={12}
          scrollWheelZoom={false}
          style={{ height: "550px", width: "100%", borderRadius: "12px" }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors"
          />
        </MapContainer>
      </div>
    </div>
  );
};

export default ViewCoupeBoundaries;

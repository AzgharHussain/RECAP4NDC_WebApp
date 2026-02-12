import React, { useState } from 'react';
import { useMapEvents } from 'react-leaflet';
import "./LatLngDisplay.css";

const LatLngDisplay = () => {
  const [latLng, setLatLng] = useState({ lat: 0, lng: 0 });

  useMapEvents({
    mousemove(e) {
      setLatLng(e.latlng);
    },
  });

  // Function to get compass direction
  const getDirection = (lat, lng) => {
    const latDirection = lat >= 0 ? 'N' : 'S';
    const lngDirection = lng >= 0 ? 'E' : 'W';
    return {
      lat: `${Math.abs(lat).toFixed(4)}° ${latDirection}`,
      lng: `${Math.abs(lng).toFixed(4)}° ${lngDirection}`
    };
  };

  const directions = getDirection(latLng.lat, latLng.lng);

  return (
    <div className="lat-lng-display"
    >
     {directions.lat},  {directions.lng}
    </div>
  );
};

export default LatLngDisplay;
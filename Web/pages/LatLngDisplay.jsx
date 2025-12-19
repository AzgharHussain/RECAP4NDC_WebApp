import React, { useState } from 'react';
import { useMapEvents } from 'react-leaflet';

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
     style={{
      position: 'absolute',
      bottom: '12%',
      left: '4%',
      zIndex: 10000,
      backgroundColor: 'white',
      padding: '5px 10px',
      borderRadius: '4px',
      boxShadow: '0 0 5px rgba(0,0,0,0.3)',
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px'
    }}
    >
     {directions.lat},  {directions.lng}
    </div>
  );
};

export default LatLngDisplay;
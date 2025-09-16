// BasemapGallery.js
import React, { useState, useEffect } from "react";
import baseimageone from "../assets/images1.png";
import baseimagetwo from "../assets/images2.png";
import baseimagethree from "../assets/images3.png";
import baseimagefour from "../assets/images4.png";
import baseimgfive from "../assets/images5.png";
import baseimgsix from "../assets/images6.png";
import "./Basemapgallery.css";

const basemaps = [
  { key: "DarkGray", image: baseimagetwo, alt: "Dark Gray Map" },
  { key: "LightGray", image: baseimageone, alt: "World Street Map" },
  { key: "Imagery", image: baseimagethree, alt: "Imagery Map" },
  { key: "Oceans", image: baseimagefour, alt: "Oceans Map" },
  { key: "Streets", image: baseimgfive, alt: "Terrain Labels Map" },
  { key: "NationalGeo", image: baseimgsix, alt: "National Geographic Map" }
];

const BasemapGallery = ({ activeBasemap, setActiveBasemap, setActiveTool, map }) => {
  const [deck, setDeck] = useState(basemaps);
  
  // Initialize activeBasemap to "LightGray" if it's not set
  useEffect(() => {
    if (!activeBasemap) {
      setActiveBasemap("LightGray");
    }
  }, [activeBasemap, setActiveBasemap]);

  const switchBasemap = (key) => {
    if (activeBasemap === key) return;
    
    // Move clicked basemap to the end of the array (which will appear on top due to z-index)
    const clickedBasemap = deck.find(b => b.key === key);
    const otherBasemaps = deck.filter(b => b.key !== key);
    const newDeck = [...otherBasemaps, clickedBasemap];
    
    setDeck(newDeck);
    setActiveBasemap(key);
    setActiveTool(null);

    // Add labels to Imagery basemap if selected
    // if (key === "Imagery") {
    //   const ImageryLabels = L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
    //     attribution: 'Tiles &copy; Esri'
    //   });
    //   ImageryLabels.addTo(map);
    // }
  };

  return (
    <div className="basemap-deck">
      {deck.map((basemap, index) => (
        <div 
          key={basemap.key}
          className={`basemap-card ${activeBasemap === basemap.key ? "active" : ""}`}
          style={{ 
            zIndex: deck.length - index,
            transform: `translateY(${index * 4}px) scale(${1 - index * 0.04})`,
            opacity: 1 - index * 0.15,
            boxShadow: `0 ${2 + index * 0.5}px ${5 + index * 1}px rgba(0, 0, 0, ${0.3 - index * 0.05})`,
            cursor: "pointer"
          }}
          onClick={() => switchBasemap(basemap.key)}
        >
          <img src={basemap.image} alt={basemap.alt} />
        </div>
      ))}
    </div>
  );
};

export default BasemapGallery;
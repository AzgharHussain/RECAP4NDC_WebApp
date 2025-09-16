import React, { useState } from "react";

// Image imports for basemaps
import baseimageone from "../assets/images1.png";
import baseimagetwo from "../assets/images2.png";
import baseimagethree from "../assets/images3.png";
import baseimagefour from "../assets/images4.png";
import baseimgfive from "../assets/images5.png";
import baseimgsix from "../assets/images6.png";

import "./Basemapgallery.css"; // Import CSS for styling



const BasemapGallery = ({ activeBasemap, setActiveBasemap,  setActiveTool, addedLayers,
  setAddedLayers }) => {
    const switchBasemap = (key) => {
        console.log(`Switching basemap to: ${key}`);  // Debugging line
        setActiveBasemap(key);
        setActiveTool(null);  // Close the basemap gallery after selection
      };
  return (
    <div className="basemap-gallery">
      <div className="gallery-header">
        <span>Basemap Gallery</span>
        <button onClick={() => setActiveTool(null)} style={{ backgroundColor: 'transparent', border: 'none' }}>
  <span className="material-icons-outlined" style={{ color: 'white' }}>close</span>
</button>

      </div>
      <div className="gallery-options">
        {/* Render each basemap option */}
        <div
          className={`basemap-option ${activeBasemap === "LightGray" ? "active" : ""}`}
          onClick={() => switchBasemap("LightGray")}
        >
          <img src={baseimageone} alt="World Street Map" />
          <label>World Street Map</label>
        </div>

        <div
          className={`basemap-option ${activeBasemap === "DarkGray" ? "active" : ""}`}
          onClick={() => switchBasemap("DarkGray")}
        >
          <img src={baseimagetwo} alt="Dark Gray Map" />
          <label>Dark Gray Map</label>
        </div>

        <div
          className={`basemap-option ${activeBasemap === "Imagery" ? "active" : ""}`}
          onClick={() => switchBasemap("Imagery")}
        >
          <img src={baseimagethree} alt="Imagery Map" />
          <label>Imagery Map</label>
        </div>

        <div
          className={`basemap-option ${activeBasemap === "Oceans" ? "active" : ""}`}
          onClick={() => switchBasemap("Oceans")}
        >
          <img src={baseimagefour} alt="Oceans Map" />
          <label>Oceans Map</label>
        </div>

        <div
          className={`basemap-option ${activeBasemap === "Streets" ? "active" : ""}`}
          onClick={() => switchBasemap("Streets")}
        >
          <img src={baseimgfive} alt="Terrain Labels Map" />
          <label>Terrain Labels</label>
        </div>

        <div
          className={`basemap-option ${activeBasemap === "NationalGeo" ? "active" : ""}`}
          onClick={() => switchBasemap("NationalGeo")}
        >
          <img src={baseimgsix} alt="National Geographic Map" />
          <label>National Geographic Map</label>
        </div>
      </div>
    </div>
  );
};

export default BasemapGallery;

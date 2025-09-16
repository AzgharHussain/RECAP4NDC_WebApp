import React, { useRef } from "react";
import { FaCloudUploadAlt } from "react-icons/fa";
import "./UploadCoupe.css"; // Import the CSS for styling

const UploadCoupe = () => {
  const fileInputRef = useRef(null); // Create a reference for the file input

  // Define the handleClick function
  const handleClick = () => {
    fileInputRef.current.click(); // Trigger the file input click
  };

  return (
    <div className="upload-container">
      <div className="heading-container">
        <h3 className="main-heading">Working Plan Areas (Upload Coupe Boundaries)</h3>
      </div>
      <div className="content-container">
        <div className="left-section">
         <h2 style={{ textDecoration: "underline", color: "white" }}>
          How to upload coupe boundaries?
        </h2>
          <p>
            Coupees belong to the predefined forest management hierarchy:
            <br />
            <b>Division → Range → Block → Compartment → Coupe</b>
          </p>
          <p>
            You only need to upload the coupe boundaries. The high-level boundaries (Division, Range, Block, and
            Compartment) are already managed in the system.
          </p>
          <p>
            Once uploaded, the shapefile needs to be verified.{" "}
           <a
              href="https://example.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                textDecoration: "none",  // Removes the underline
                color: "#0254D2"         // Sets the text color to the desired shade of blue
              }}
            >
              Click here to Verify
            </a>

          </p>
          <h3>Supported File Formats</h3>
        <ul>
          <li>Shapefile (.zip) - must include .shp, .shx, .dbf, .prj</li>
          <li>GeoJSON (.geojson)</li>
          <li>KML (.kml)</li>
        </ul>

        <h3>Requirements</h3>
        <ul>
          <li>Geometry type must be Polygon/Multipolygon</li>
          <li>Coordinate Reference System (CRS) -- WGS84 (EPSG:4326)</li>
          <li>Maximum file size: 50 MB</li>
        </ul>

        <h3>Shapefile format (attribute required):</h3>
        <ul>
          <li>Field 1: id</li>
          <li>Field 2: name</li>
          <li>Field 3: geom</li>
        </ul>
        </div>
        <div className="right-section">
         <h2 style={{ textDecoration: "underline", color: "white" }}>
              Upload Coupe Boundaries
            </h2>

          <div className="under-section">
            <div className="file-upload">
              <div className="upload-area">
              <FaCloudUploadAlt style={{ marginRight: "10px",fontSize: "32px" }} /> 
              <p style={{ display: "inline", marginRight: "10px", color: "#009245" }}>Drag and Drop file here or</p>
              <a
                  href="#"
                  onClick={handleClick}
                  className="choose-file-link"
                  style={{
                    display: "inline",
                    textDecoration: "none",  // Removes the underline
                    color: "#0254D2"         // Sets the text color to the desired shade of blue
                  }}
                >
                  Choose file
                </a>

              <input
                type="file"
                ref={fileInputRef}
                style={{ display: "none" }} // Hide the input
              />
            </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadCoupe;

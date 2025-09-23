import React, { useState, useRef } from "react";
import { FaCloudUploadAlt } from "react-icons/fa";
import "./UploadCoupe.css"; // Import the CSS for styling

const UploadCoupe = () => {
  const fileInputRef = useRef(null); // Create a reference for the file input
  const [fileName, setFileName] = useState(""); // State to hold the file name
  const [message, setMessage] = useState(""); // State for messages (success/failure)

  // Define the handleClick function to trigger file input click
  const handleClick = () => {
    fileInputRef.current.click(); // Trigger the file input click
  };

  // Handle file upload
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    
    if (file) {
      const fileSize = file.size / 1024 / 1024; // in MB
      const fileType = file.name.split(".").pop().toLowerCase(); // get the file type

      // Check if the file is within the size limit and has a valid type
      if (fileSize > 50) {
        setMessage("Error: File size exceeds the maximum limit of 50MB.");
      } else if (!["zip", "geojson", "kml"].includes(fileType)) {
        setMessage("Error: Invalid file format. Please upload a valid Shapefile (.zip), GeoJSON (.geojson), or KML (.kml).");
      } else {
        // If file is valid, store file name and show success message
        setFileName(file.name);
        setMessage("File successfully uploaded and  Click here to Verify.");
        
        // Here you would typically store the file in your backend or a table.
        // Example: You can use an API call or local storage to store the file data.
        storeFileData(file);
      }
    }
  };

  // Function to simulate storing the file in a table or database
  const storeFileData = (file) => {
    // You can implement a real API call here to store file data in a database.
    console.log("Storing file data:", file);
    // For now, simulate storing the data.
  };

  return (
    <div className="upload-container">
      <div className="heading-container">
        <h3 className="main-heading">Working Plan Areas (Upload Coupe Boundaries)</h3>
      </div>
      <div className="content-container">
        <div className="left-section">
          <h2 style={{ textDecoration: "underline", color: "#00442c !important;" }}>
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
                textDecoration: "none",
                color: "#0254D2",
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
          <h2 style={{ textDecoration: "underline", color: "#00442c !important;" }}>
            Upload Coupe Boundaries
          </h2>

          <div className="under-section">
            <div className="file-upload">
              <div className="upload-area">
                <FaCloudUploadAlt style={{ marginRight: "10px", fontSize: "32px" }} />
                <p style={{ display: "inline", marginRight: "10px", color: "#009245" }}>
                  Drag and Drop file here or
                </p>
                <a
                  href="#"
                  onClick={handleClick}
                  className="choose-file-link"
                  style={{
                    display: "inline",
                    textDecoration: "none",
                    color: "#0254D2",
                  }}
                >
                  Choose file
                </a>

                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: "none" }} // Hide the input
                  onChange={handleFileUpload}
                />
              </div>
            </div>
            <div className="message-container">
            {/* Display message based on upload status */}
            {message && <p style={{ color: message.includes("Error") ? "red" : "green" }}>{message}</p>}
            {fileName && <p>Uploaded File: {fileName}</p>}
          </div>
          </div>
          
        </div>
      </div>
    </div>
  );
};

export default UploadCoupe;

import React, { useState, useRef } from "react";
import { FaCloudUploadAlt } from "react-icons/fa";
import "./UploadCoupe.css";

const UploadCoupe = () => {
  const fileInputRef = useRef(null);
  const [fileName, setFileName] = useState("");
  const [message, setMessage] = useState("");

  const handleClick = (e) => {
    e.preventDefault();
    fileInputRef.current.click();
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const fileSizeMB = file.size / 1024 / 1024;
    const ext = file.name.split(".").pop().toLowerCase();

    if (fileSizeMB > 50) {
      setMessage("Error: File size exceeds the maximum limit of 50MB.");
      return;
    }
    if (!["zip", "geojson", "kml"].includes(ext)) {
      setMessage("Error: Invalid file format. Please upload a .zip (shapefile), .geojson or .kml.");
      return;
    }

    setMessage("Uploading...");
    setFileName(file.name);

    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: fd,
      });

      const data = await res.json();
      if (res.ok) {
        setMessage("Upload succeeded: " + (data.message || "File processed. Layer published."));
      } else {
        setMessage("Upload failed: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      console.error(err);
      setMessage("Upload failed: " + err.message);
    }
  };

  return (
    <div className="upload-container">
      <div className="heading-container">
        <h3 className="main-heading">Working Plan Areas (Upload Coupe Boundaries)</h3>
      </div>
      <div className="content-container" style={{display: "flex", gap: 20}}>
        <div className="left-section" style={{flex: 1}}>
          <h2 style={{ textDecoration: "underline", color: "#00442c" }}>
            How to upload coupe boundaries?
          </h2>
          <p>
            Coupes belong to the predefined forest management hierarchy:
            <br />
            <b>Division → Range → Block → Compartment → Coupe</b>
          </p>
          <p>Only upload coupe boundaries.</p>
          <p>
            Once uploaded, the shapefile will be imported to the database and published to GeoServer automatically.
          </p>

          <h3>Supported File Formats</h3>
          <ul>
            <li>Shapefile (.zip) - must include .shp, .shx, .dbf, .prj</li>
            <li>GeoJSON (.geojson)</li>
            <li>KML (.kml)</li>
          </ul>

          <h3>Requirements</h3>
          <ul>
            <li>Geometry type must be Polygon/MultiPolygon</li>
            <li>Coordinate Reference System (CRS) -- WGS84 (EPSG:4326)</li>
            <li>Maximum file size: 50 MB</li>
          </ul>
          <h3>Shapefile format (attribute required):</h3>
          <ul>
            <li>Field 1: id</li>
            <li>Field 2: name</li>
            <li>Field 3: geom (geometry)</li>
          </ul>
        </div>

        <div className="right-section" style={{flex: 1}}>
          <h2 style={{ textDecoration: "underline", color: "#00442c" }}>
            Upload Coupe Boundaries
          </h2>

          <div className="under-section">
            <div className="file-upload">
              <div className="upload-area" style={{border: "2px dashed #ccc", padding: 20, borderRadius: 8}}>
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
                  style={{ display: "none" }}
                  onChange={handleFileUpload}
                />
              </div>
            </div>

            <div className="message-container" style={{marginTop: 12}}>
              {message && <p style={{ color: message.startsWith("Error") ? "red" : "green" }}>{message}</p>}
              {fileName && <p>Selected File: {fileName}</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadCoupe;

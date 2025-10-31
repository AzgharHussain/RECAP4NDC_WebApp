import React, { useState, useRef } from "react";
import { FaCloudUploadAlt } from "react-icons/fa";
import { Link } from "react-router-dom"; // <--- Add this
import "./UploadCoupe.css";
import { useLanguage } from "../context/LanguageContext"; // Import language context

const UploadCoupe = () => {
  const fileInputRef = useRef(null);
  const [fileName, setFileName] = useState("");
  const [message, setMessage] = useState("");
  const { language } = useLanguage(); // Use the language context
   

  // Define text for English and Gujarati
  const text = {
    en: {
      title: "Working Plan Areas (Upload Coupe Boundaries)",
      howToUpload: "How to upload coupe boundaries?",
      description:
        "Coupes belong to the predefined forest management hierarchy:",
      boundres: "Division → Range → Block → Compartment → Coupe",
      onlyUploadBoundaries:
        "You only reed to upload the coupe boundaries Tha high-level boundaries (Division , Range , Bock, and Compartment) ara already managed in the system.",
      uploadInfo: "Once uploaded, the shapefile needs to be verified",
      supportedFormats: "Supported File Formats",
      shapefileInfo: "Shapefile (.zip) - must include .shp, .shx, .dbf, .prj",
      geojsonInfo: "GeoJSON (.geojson)",
      kmlInfo: "KML (.kml)",
      requirements: "Requirements",
      geometryType: "Geometry type must be Polygon/MultiPolygon",
      crsInfo: "Coordinate Reference System (CRS) -- WGS84 (EPSG:4326)",
      maxFileSize: "Maximum file size: 50 MB",
      shapefileFields: "Shapefile format (attribute required):",
      field1: "Field 1: id",
      field2: "Field 2: name",
      field3: "Field 3: geom (geometry)",
      uploadBoundaries: "Upload Coupe Boundaries",
      dragAndDrop: "Drag and Drop file here or",
      chooseFile: "Choose file",
      errorMessage: "Error: File size exceeds the maximum limit of 50MB.",
      invalidFile:
        "Error: Invalid file format. Please upload a .zip (shapefile), .geojson or .kml.",
      uploading: "Uploading...",
      uploadSuccess: "Upload succeeded: ",
      uploadFailed: "Upload failed: ",
      clickHereToVerify: "Click here to Verify",
    },
    gu: {
      title: "કાર્ય યોજના ક્ષેત્રો (કોપ બાઉન્ડરીઝ અપલોડ કરો)",
      howToUpload: "કોપ બાઉન્ડરીઝ કેવી રીતે અપલોડ કરશો?",
      description: "કોપો પૂર્વ નિર્ધારિત જંગલ વ્યવસ્થાપન રચનામાં આવેછે:",
      boundres: "વિભાગ → રેંજ → બ્લોક → ખંડ → કોપ",
      onlyUploadBoundaries: "ફક્ત કોપ બાઉન્ડરીઝ અપલોડ કરો.",
      uploadInfo:
        "એકવાર અપલોડ થયા પછી, shapefileને ડેટાબેઝમાં આયાત કરવામાં આવશે અને GeoServer પર આપોઆપ પ્રકાશિત કરવામાં આવશે.",
      supportedFormats: "સમર્થિત ફાઈલ ફોર્મેટ્સ",
      shapefileInfo:
        "Shapefile (.zip) - તેમાં .shp, .shx, .dbf, .prj સામેલ હોવું જોઈએ",
      geojsonInfo: "GeoJSON (.geojson)",
      kmlInfo: "KML (.kml)",
      requirements: "આવશ્યકતાઓ",
      geometryType: "જ્યાં સુધી ભૂમિતિ પ્રકાર પોલિગન/મલ્ટીપોલિગન હોવો જોઈએ",
      crsInfo: "કોઓર્ડિનેટ રેફરન્સ સિસ્ટમ (CRS) -- WGS84 (EPSG:4326)",
      maxFileSize: "ગરીમ ફાઈલ કદ: 50 MB",
      shapefileFields: "Shapefile ફોર્મેટ (આવશ્યક ગુણધર્મ):",
      field1: "વિશેષ 1: id",
      field2: "વિશેષ 2: નામ",
      field3: "વિશેષ 3: geom (ભૂમિતિ)",
      uploadBoundaries: "કોપ બાઉન્ડરીઝ અપલોડ કરો",
      dragAndDrop: "ફાઈલ અહીં ડ્રેગ અને ડ્રોપ કરો અથવા",
      chooseFile: "ફાઈલ પસંદ કરો",
      errorMessage: "ભૂલ: ફાઈલ કદ 50MB ની મહત્તમ મર્યાદાને અદૃષ્ટ કરે છે.",
      invalidFile:
        "ભૂલ: અયોગ્ય ફાઈલ ફોર્મેટ. કૃપા કરી .zip (shapefile), .geojson અથવા .kml અપલોડ કરો.",
      uploading: "અપલોડ કરી રહ્યા છે...",
      uploadSuccess: "અપલોડ સફળ થયું: ",
      uploadFailed: "અપલોડ નિષ્ફળ: ",
      clickHereToVerify: "તસદીક કરવા માટે અહીં ક્લિક કરો",
    },
  };

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
      setMessage(text[language].errorMessage);
      return;
    }
    if (!["zip", "geojson", "kml"].includes(ext)) {
      setMessage(text[language].invalidFile);
      return;
    }

    // Generate coupeName automatically
    const baseName = file.name.split(".")[0]; // Gandhinagar_MM_Map
    const prefix = baseName.split("_")[0]; // Gandhinagar
    const coupeName = `${prefix}_Coupe`; // Gandhinagar_Coupe

    console.log("Auto-generated coupeName:", coupeName);

    setMessage(text[language].uploading);
    setFileName(file.name);

    try {
      const fd = new FormData();
      fd.append("shapefile", file);
      fd.append("coupeName", coupeName);

      const res = await fetch("http://68.178.167.39:6000/uploadShapefile", {
        method: "POST",
        body: fd,
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setMessage(`${text[language].uploadSuccess}${data.message}`);
      } else {
        setMessage(`${text[language].uploadFailed}${data.message || "Unknown error"}`);
      }
    } catch (err) {
      console.error(err);
      setMessage(`${text[language].uploadFailed}${err.message}`);
    }
  };

  return (
    <div className="upload-container">
      <div className="heading-container">
        <h4 className="main-heading">{text[language].title}</h4>
      </div>
      <div className="content-container" style={{ display: "flex", gap: 20 }}>
        <div className="left-section" style={{ flex: 1 }}>
          <h3 style={{ textDecoration: "underline", color: "#000" }}>
            {text[language].howToUpload}
          </h3>
          <p>{text[language].description}</p>
          <p>
            <strong>{text[language].boundres}</strong>
          </p>
          <p>{text[language].onlyUploadBoundaries}</p>
          <p>
            {text[language].uploadInfo.split("verified")[0]}
            <strong>verified</strong>
            {text[language].uploadInfo.split("verified")[1]}

            <div className="verification-link">
              <Link
                to="/working-plan/view" // This is the route you want to navigate to
                style={{
                  textDecoration: "underline",
                  color: "#005C03",
                  fontWeight: "bold",
                }}
              >
                {text[language].clickHereToVerify}
              </Link>
            </div>
          </p>

          <h4>{text[language].supportedFormats}</h4>

          <ul>
            <li>
              <strong>{text[language].shapefileInfo.split(" - ")[0]}</strong> -{" "}
              {text[language].shapefileInfo.split(" - ")[1]}
            </li>
            <li>
              <strong>{text[language].geojsonInfo}</strong>
            </li>
            <li>
              <strong>{text[language].kmlInfo}</strong>
            </li>
          </ul>
          <h4>{text[language].requirements}</h4>
          <ul>
            <li>
              {text[language].geometryType.split("Polygon/MultiPolygon")[0]}
              <strong>Polygon/MultiPolygon</strong>
            </li>
            <li>
              {text[language].crsInfo.split("WGS84 (EPSG:4326)")[0]}
              <strong>WGS84 (EPSG:4326)</strong>
            </li>
            <li>
              {" "}
              {text[language].maxFileSize.split("50 MB")[0]}
              <strong>50 MB</strong>
            </li>
          </ul>
          <h4>{text[language].shapefileFields}</h4>

          <ul>
            <li>
              <strong>{text[language].field1.split(":")[0]}</strong>:{" "}
              {text[language].field1.split(":")[1]}
            </li>
            <li>
              <strong>{text[language].field2.split(":")[0]}</strong>:{" "}
              {text[language].field2.split(":")[1]}
            </li>
            <li>
              <strong>{text[language].field3.split(":")[0]}</strong>:{" "}
              {text[language].field3.split(":")[1]}
            </li>
          </ul>
        </div>

        <div className="right-section" style={{ flex: 1 }}>
          <h3 style={{ textDecoration: "underline", color: "#000" }}>
            {text[language].uploadBoundaries}
          </h3>

          <div className="under-section">
            <div className="file-upload">
              <div
                className="upload-area"
                style={{
                  border: "2px dashed #ccc",
                  padding: 20,
                  borderRadius: 8,
                }}
              >
                <FaCloudUploadAlt
                  style={{ marginRight: "10px", fontSize: "32px" }}
                />
                <p
                  style={{
                    display: "inline",
                    marginRight: "10px",
                    color: "#000",
                  }}
                >
                  {text[language].dragAndDrop}
                </p>
                <a
                  href="#"
                  onClick={handleClick}
                  className="choose-file-link"
                  style={{
                    display: "inline",
                    // textDecoration: "none",
                    color: "#005C03",
                    textDecoration: "underline",
                  }}
                >
                  {text[language].chooseFile}
                </a>

                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: "none" }}
                  onChange={handleFileUpload}
                />
              </div>
            </div>

            <div className="message-container" style={{ marginTop: 12 }}>
              {message && (
                <p
                  style={{
                    color: message.startsWith("Error") ? "red" : "green",
                  }}
                >
                  {message}
                </p>
              )}
              {fileName && <p>Selected File: {fileName}</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadCoupe;

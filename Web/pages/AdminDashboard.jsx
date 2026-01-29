// src/pages/AdminDashboard.jsx
import React, { useState, useEffect } from "react";
import { useLanguage } from "../context/LanguageContext";
import axios from "axios";
import "../App.css";
import "./Login.css";
import { API_BASE_URL } from '../config';

function AdminDashboard() {
  const { language } = useLanguage();
  const [coupes, setCoupes] = useState([]);
  const [loading, setLoading] = useState(true); // Single loading state
  const [error, setError] = useState(null);
  const [files, setFiles] = useState([]);
  const [selectedColor, setSelectedColor] = useState("#00ff00");
  const [uploadStatus, setUploadStatus] = useState(null);

  // Language text objects
  const text = {
    en: {
      title: "Admin Dashboard",
      welcome: "Welcome, Administrator",
      footer: "RECAP4NDC © 2024. All Rights Reserved.",
      coupeList: "Coupe List",
      loading: "Loading coupes...",
      error: "Failed to load coupes",
      retry: "Retry"
    },
    gu: {
      title: "એડમિન ડેશબોર્ડ",
      welcome: "સ્વાગત છે, વ્યવસ્થાપક",
      footer: "RECAP4NDC © 2024. બધા હક્કો અરક્ષિત.",
      coupeList: "કૂપ સૂચિ",
      loading: "કૂપ લોડ થઈ રહ્યા છે...",
      error: "કૂપ લોડ કરવામાં નિષ્ફળ",
      retry: "ફરી પ્રયાસ કરો"
    }
  };

  // Fetch coupes from API
  useEffect(() => {
    const fetchCoupes = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await axios.get(`${API_BASE_URL}/api/coupes`);
        
        if (response.data && response.data.data) {
          // Extract coupe_name from the result
          const coupeList = response.data.data.map(item => item.coupe_name);
          setCoupes(coupeList);
        } else {
          setError("No data received from server");
        }
      } catch (err) {
        console.error("Error fetching coupes:", err);
        setError(err.message || "Failed to fetch coupes");
      } finally {
        setLoading(false);
      }
    };

    fetchCoupes();
  }, []); // Empty dependency array - runs once on mount

  // Function to retry fetching data
  const handleRetry = () => {
    setLoading(true);
    setError(null);
    // Re-fetch the data
    axios.get(`${API_BASE_URL}/api/coupes`)
      .then(response => {
        if (response.data && response.data.data) {
          const coupeList = response.data.data.map(item => item.coupe_name);
          setCoupes(coupeList);
        } else {
          setError("No data received from server");
        }
      })
      .catch(err => {
        console.error("Error fetching coupes:", err);
        setError(err.message || "Failed to fetch coupes");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  // Upload shapefile
  const uploadFiles = async () => {
    if (!files || files.length === 0) {
      setUploadStatus({
        success: false,
        message: "Select shapefile components (.shp .shx .dbf [ .prj ]) before upload."
      });
      return;
    }

    setLoading(true);
    setUploadStatus(null);

    const form = new FormData();
    Array.from(files).forEach(f => form.append("files", f));
    form.append("color", selectedColor);

    try {
      const res = await axios.post("http://localhost:4000/upload-shp", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setUploadStatus({
        success: res.data.success,
        message: res.data.message
      });

      setFiles([]); // reset file input

    } catch (err) {
      console.error(err);
      setUploadStatus({
        success: false,
        message: "Upload failed: " + (err.response?.data?.message || err.message)
      });
    } finally {
      setLoading(false);
    }
  };

  // Color options
  const colorOptions = [
    { name: "Green", value: "#00ff00" },
    { name: "Black", value: "#000000" },
    { name: "Red", value: "#ff0000" },
    { name: "Blue", value: "#0000ff" },
    { name: "Orange", value: "#ffa500" },
    { name: "Yellow", value: "#ffff00" },
    { name: "Pink", value: "#ffc0cb" }
  ];

  return (
    <div className="admin-container" >
      {/* Main Content Area */}
      <div className="admin-content">
        
        {/* Statistics */}
        <div className="dashboard-stats">
          <div className="stat-card">
            <h3>Total Coupes</h3>
            <p className="stat-number">{coupes.length}</p>
          </div>
          
        </div>
        
      </div>
      {/* Left Panel with coupe names */}
      <div className="left-panel">
        <div className="coupe-list">
          <h3>{text[language].coupeList}</h3>
          
          {loading ? (
            <div className="loading-message">
              <p>{text[language].loading}</p>
              <div className="loader"></div>
            </div>
          ) : error ? (
            <div className="error-message">
              <p>{text[language].error}</p>
              <button 
                className="retry-btn"
                onClick={handleRetry}
              >
                {text[language].retry}
              </button>
            </div>
          ) : (
            <ul>
              {coupes.map((coupe, index) => (
                <li key={index}>
                  <div className="coupe-item">
                    <span className="coupe-name">{coupe}</span>
                    
                  </div>
                </li>
              ))}
              
              {coupes.length === 0 && (
                <li className="no-data">No coupes found</li>
              )}
            </ul>
          )}
        </div>


        <div style={{ 
      padding: 40, 
      maxWidth: 600, 
      margin: "0 auto",
      fontFamily: "Arial, sans-serif" 
    }}>
      <h2>Upload Shapefile</h2>
      
      <div style={{ 
        backgroundColor: "#f5f5f5", 
        padding: 20, 
        borderRadius: 8,
        marginBottom: 20 
      }}>
        <div style={{ marginBottom: 15 }}>
          <label style={{ display: "block", marginBottom: 5, fontWeight: "bold" }}>
            Select Shapefile Components:
          </label>
          <input
            type="file"
            multiple
            accept=".shp,.shx,.dbf,.prj"
            onChange={e => setFiles(e.target.files)}
            style={{ padding: 8, width: "100%" }}
          />
          <small style={{ color: "#666" }}>
            Select .shp, .shx, .dbf files (and optionally .prj)
          </small>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", marginBottom: 5, fontWeight: "bold" }}>
            Select Color:
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <select 
              value={selectedColor} 
              onChange={e => setSelectedColor(e.target.value)}
              style={{ padding: "8px 12px", flex: 1 }}
            >
              {colorOptions.map(color => (
                <option key={color.value} value={color.value}>
                  {color.name}
                </option>
              ))}
            </select>
            <div 
              style={{
                width: "30px",
                height: "30px",
                backgroundColor: selectedColor,
                border: "2px solid #000",
                borderRadius: 4
              }}
              title={selectedColor}
            />
          </div>
        </div>

        <button 
          onClick={uploadFiles}
          disabled={loading}
          style={{
            padding: "10px 20px",
            backgroundColor: "#007bff",
            color: "white",
            border: "none",
            borderRadius: 4,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1,
            width: "100%",
            fontSize: "16px"
          }}
        >
          {loading ? "Uploading..." : "Upload & Publish Shapefile"}
        </button>
      </div>

      {/* Status Message */}
      {uploadStatus && (
        <div style={{
          padding: 15,
          borderRadius: 4,
          backgroundColor: uploadStatus.success ? "#d4edda" : "#f8d7da",
          color: uploadStatus.success ? "#155724" : "#721c24",
          border: `1px solid ${uploadStatus.success ? "#c3e6cb" : "#f5c6cb"}`,
          marginTop: 20
        }}>
          <div style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: 10 
          }}>
            <div style={{
              width: 20,
              height: 20,
              borderRadius: "50%",
              backgroundColor: uploadStatus.success ? "#28a745" : "#dc3545",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontWeight: "bold"
            }}>
              {uploadStatus.success ? "✓" : "✗"}
            </div>
            <div>
              <strong>{uploadStatus.success ? "Success!" : "Error!"}</strong>
              <div>{uploadStatus.message}</div>
            </div>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div style={{ 
        backgroundColor: "#e7f3ff", 
        padding: 15, 
        borderRadius: 4,
        marginTop: 30,
        borderLeft: "4px solid #007bff"
      }}>
        <h4 style={{ marginTop: 0 }}>How it works:</h4>
        <ol style={{ marginBottom: 0, paddingLeft: 20 }}>
          <li>Select all shapefile components (.shp, .shx, .dbf)</li>
          <li>Choose a color (Green, Red, or Blue)</li>
          <li>Click "Upload & Publish Shapefile"</li>
          <li>The shapefile will be automatically:
            <ul>
              <li>Imported to PostgreSQL database</li>
              <li>Published to GeoServer</li>
              <li>Styled with your selected color</li>
            </ul>
          </li>
        </ol>
        <p style={{ margin: "10px 0 0 0", fontStyle: "italic" }}>
          Note: The shapefile name will be used as the table name in the database.
        </p>
      </div>
    </div>
      </div>

      
    </div>
  );
}

export default AdminDashboard;
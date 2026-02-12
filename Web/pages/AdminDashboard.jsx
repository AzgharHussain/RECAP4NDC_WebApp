import React, { useState, useEffect } from "react";
import { useLanguage } from "../context/LanguageContext";
import axios from "axios";
import { API_BASE_URL } from '../config';
import {
  FiUpload, FiMap, FiDatabase, FiServer, FiCheckCircle,
  FiAlertCircle, FiRefreshCw, FiEye, FiTrash2, FiEdit,
  FiLayers, FiPieChart, FiGrid, FiCalendar, FiUsers,
  FiSettings, FiChevronRight, FiCopy, FiFilter
} from "react-icons/fi";
import { RiAdminFill } from "react-icons/ri";
import "./AdminDashboard.css";

function AdminDashboard() {
  const { language } = useLanguage();
  const [coupes, setCoupes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [files, setFiles] = useState([]);
  const [selectedColor, setSelectedColor] = useState("#10b981");
  const [uploadStatus, setUploadStatus] = useState(null);
  const [activeTab, setActiveTab] = useState("coupes");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [stats, setStats] = useState({
    totalCoupes: 0,
    published: 0,
    pending: 0,
    totalSize: "0 MB"
  });

  // Language text objects
  const text = {
    en: {
      title: "Admin Dashboard",
      welcome: "Welcome back, Administrator",
      footer: "RECAP4NDC © 2024. All Rights Reserved.",
      coupeList: "Coupe List",
      loading: "Loading coupes...",
      error: "Failed to load coupes",
      retry: "Retry",
      totalCoupes: "Total Coupes",
      published: "Published",
      pending: "Pending",
      uploadShp: "Upload Shapefile",
      uploadTitle: "Upload & Publish Shapefile",
      recentActivity: "Recent Activity",
      quickStats: "Quick Stats",
      systemHealth: "System Health",
      database: "Database",
      geoserver: "GeoServer",
      api: "API"
    },
    gu: {
      title: "એડમિન ડેશબોર્ડ",
      welcome: "સ્વાગત છે, વ્યવસ્થાપક",
      footer: "RECAP4NDC © 2024. બધા હક્કો અરક્ષિત.",
      coupeList: "કૂપ સૂચિ",
      loading: "કૂપ લોડ થઈ રહ્યા છે...",
      error: "કૂપ લોડ કરવામાં નિષ્ફળ",
      retry: "ફરી પ્રયાસ કરો",
      totalCoupes: "કુલ કૂપ",
      published: "પ્રકાશિત",
      pending: "બાકી",
      uploadShp: "શેપફાઇલ અપલોડ કરો",
      uploadTitle: "શેપફાઇલ અપલોડ અને પ્રકાશિત કરો",
      recentActivity: "તાજી પ્રવૃત્તિ",
      quickStats: "ઝડપી આંકડા",
      systemHealth: "સિસ્ટમ સ્વાસ્થ્ય",
      database: "ડેટાબેઝ",
      geoserver: "જીઓસર્વર",
      api: "API"
    }
  };

  // Fetch coupes from API
  useEffect(() => {
    fetchCoupes();
  }, []);

  const fetchCoupes = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem("token");

const response = await axios.get(
  `${API_BASE_URL}/api/admincoupes`,
  {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }
);
      
      if (response.data && response.data.data) {
        const coupeList = response.data.data.map(item => item.coupe_name);
        setCoupes(coupeList);
        setStats(prev => ({
          ...prev,
          totalCoupes: coupeList.length,
          published: Math.floor(coupeList.length * 0.8),
          pending: Math.floor(coupeList.length * 0.2)
        }));
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

  // Upload shapefile with progress simulation
  const uploadFiles = async () => {
    if (!files || files.length === 0) {
      setUploadStatus({
        success: false,
        message: "Select shapefile components (.shp .shx .dbf [ .prj ]) before upload."
      });
      return;
    }

    setLoading(true);
    setUploadProgress(0);
    setUploadStatus(null);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return prev;
        }
        return prev + 10;
      });
    }, 300);

    const form = new FormData();
    Array.from(files).forEach(f => form.append("files", f));
    form.append("color", selectedColor);

    try {
      const res = await axios.post(`${API_BASE_URL}/api/upload-shp`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      setUploadStatus({
        success: res.data.success,
        message: res.data.message
      });

      setFiles([]);
      fetchCoupes(); // Refresh coupe list

      // Reset progress after success
      setTimeout(() => setUploadProgress(0), 2000);

    } catch (err) {
      clearInterval(progressInterval);
      console.error(err);
      setUploadStatus({
        success: false,
        message: "Upload failed: " + (err.response?.data?.message || err.message)
      });
    } finally {
      setLoading(false);
    }
  };

  // Color options with better names
  const colorOptions = [
    { name: "Emerald", value: "#10b981", icon: "🟢" },
    { name: "Sapphire", value: "#3b82f6", icon: "🔵" },
    { name: "Ruby", value: "#ef4444", icon: "🔴" },
    { name: "Amber", value: "#f59e0b", icon: "🟠" },
    { name: "Violet", value: "#8b5cf6", icon: "🟣" },
    { name: "Graphite", value: "#374151", icon: "⚫" },
    { name: "Rose", value: "#f472b6", icon: "🌸" }
  ];

  // Mock recent activity
  const recentActivity = [
    { id: 1, action: "Shapefile Upload", name: "Forest_Coupe_01.shp", time: "2 min ago", status: "success" },
    { id: 2, action: "Database Update", name: "Coupe metadata", time: "15 min ago", status: "success" },
    { id: 3, action: "GeoServer Publish", name: "Layer: coupes_2024", time: "1 hour ago", status: "success" },
    { id: 4, action: "Shapefile Upload", name: "Water_Bodies.shp", time: "2 hours ago", status: "pending" }
  ];

  // System health status
  const systemHealth = [
    { service: "Database", status: "healthy", icon: <FiDatabase />, color: "#10b981" },
    { service: "GeoServer", status: "healthy", icon: <FiServer />, color: "#10b981" },
    { service: "API", status: "degraded", icon: <FiSettings />, color: "#f59e0b" }
  ];

  return (
    <div className="admin-dashboard">
      {/* Top Navigation */}
     

      <div className="dashboard-main">
        {/* Left Sidebar */}


        {/* Main Content */}
        <main className="admin-content">
          {/* Quick Stats Cards */}


          {/* Two Column Layout */}
          <div className="content-columns">
            {/* Left Column - Coupe List */}
            <div className="column">
              <div className="card">
                <div className="card-header">
                  <h3><FiMap /> {text[language].coupeList}</h3>
                  <div className="card-actions">
                    <FiFilter />
                    <FiCopy />
                  </div>
                </div>
                
                <div className="coupe-list-container">
                  {loading ? (
                    <div className="loading-state">
                      <div className="spinner"></div>
                      <p>{text[language].loading}</p>
                    </div>
                  ) : error ? (
                    <div className="error-state">
                      <FiAlertCircle />
                      <p>{text[language].error}</p>
                      <button onClick={fetchCoupes} className="btn-retry">
                        <FiRefreshCw /> {text[language].retry}
                      </button>
                    </div>
                  ) : (
                    <div className="coupe-table">
                      <div className="table-header">
                        <span>Coupe Name</span>
                        <span>Status</span>
                        <span>Actions</span>
                      </div>
                      <div className="table-body">
                        {coupes.slice(0, 16).map((coupe, index) => (
                          <div key={index} className="table-row">
                            <div className="coupe-name-cell">
                              <div className="color-indicator" 
                                   style={{ backgroundColor: colorOptions[index % colorOptions.length].value }} />
                              <span className="coupe-name">{coupe}</span>
                            </div>
                            <div className="status-cell">
                              <span className="status-badge published">Published</span>
                            </div>
                            <div className="actions-cell">
                              <button className="btn-action view" title="View">
                                <FiEye />
                              </button>
                              <button className="btn-action edit" title="Edit">
                                <FiEdit />
                              </button>
                              <button className="btn-action delete" title="Delete">
                                <FiTrash2 />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {coupes.length === 0 && !loading && (
                    <div className="empty-state">
                      <FiMap />
                      <p>No coupes found. Upload your first shapefile!</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Recent Activity */}

            </div>

            {/* Right Column - Upload Section */}
            <div className="column">
              <div className="card upload-card">
                <div className="card-header">
                  <h3><FiUpload /> {text[language].uploadTitle}</h3>
                </div>

                {/* File Upload Area */}
                <div className="upload-area" 
                     onClick={() => document.getElementById('fileInput').click()}
                     onDragOver={(e) => e.preventDefault()}
                     onDrop={(e) => {
                       e.preventDefault();
                       setFiles(e.dataTransfer.files);
                     }}>
                  <input
                    id="fileInput"
                    type="file"
                    multiple
                    accept=".shp,.shx,.dbf,.prj"
                    onChange={e => setFiles(e.target.files)}
                    style={{ display: 'none' }}
                  />
                  
                  {files.length > 0 ? (
                    <div className="files-selected">
                      <FiCheckCircle className="success-icon" />
                      <h4>{files.length} files selected</h4>
                      <div className="file-list">
                        {Array.from(files).map((file, index) => (
                          <div key={index} className="file-item">
                            <span>{file.name}</span>
                            <span className="file-size">({(file.size / 1024).toFixed(1)} KB)</span>
                          </div>
                        ))}
                      </div>
                      <button 
                        className="btn-clear"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFiles([]);
                        }}
                      >
                        Clear Selection
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="upload-icon">
                        <FiUpload />
                      </div>
                      <h4>Drag & Drop or Click to Upload</h4>
                      <p className="upload-hint">
                        Select .shp, .shx, .dbf files (and optionally .prj)
                      </p>
                    </>
                  )}
                </div>

                {/* Color Selection */}
                <div className="color-selection">
                  <h4>Choose Layer Color</h4>
                  <div className="color-grid">
                    {colorOptions.map((color, index) => (
                      <button
                        key={index}
                        className={`color-option ${selectedColor === color.value ? "selected" : ""}`}
                        style={{ backgroundColor: color.value }}
                        onClick={() => setSelectedColor(color.value)}
                        title={`${color.name} (${color.value})`}
                      >
                        {selectedColor === color.value && <FiCheckCircle />}
                        <span className="color-name">{color.icon}</span>
                      </button>
                    ))}
                  </div>
                  <div className="selected-color-preview">
                    <div className="color-box" style={{ backgroundColor: selectedColor }} />
                    <span className="color-value">{selectedColor}</span>
                  </div>
                </div>

                {/* Upload Progress */}
                {uploadProgress > 0 && (
                  <div className="upload-progress">
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <span className="progress-text">{uploadProgress}%</span>
                  </div>
                )}

                {/* Upload Button */}
                <button 
                  className="btn-upload"
                  onClick={uploadFiles}
                  disabled={loading || files.length === 0}
                >
                  {loading ? (
                    <>
                      <div className="spinner-small"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <FiUpload /> {text[language].uploadTitle}
                    </>
                  )}
                </button>

                {/* Status Message */}
                {uploadStatus && (
                  <div className={`status-message ${uploadStatus.success ? "success" : "error"}`}>
                    <div className="status-icon">
                      {uploadStatus.success ? <FiCheckCircle /> : <FiAlertCircle />}
                    </div>
                    <div className="status-content">
                      <h4>{uploadStatus.success ? "Success!" : "Error!"}</h4>
                      <p>{uploadStatus.message}</p>
                    </div>
                  </div>
                )}

                {/* Process Steps */}
                <div className="process-steps">
                  <h4>Upload Process</h4>
                  <div className="steps">
                    <div className="step active">
                      <div className="step-number">1</div>
                      <div className="step-text">Select Files</div>
                    </div>
                    <div className="step-line" />
                    <div className="step">
                      <div className="step-number">2</div>
                      <div className="step-text">Import to Database</div>
                    </div>
                    <div className="step-line" />
                    <div className="step">
                      <div className="step-number">3</div>
                      <div className="step-text">Publish to GeoServer</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>


    </div>
  );
}

export default AdminDashboard;
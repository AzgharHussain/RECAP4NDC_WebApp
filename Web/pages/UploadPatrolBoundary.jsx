import React, { useState, useEffect } from "react";
import axios from "axios";
import { API_BASE_URL } from "../config";
import {
  FiMap,
  FiUpload,
  FiFilter,
  FiRefreshCw,
  FiEye,
  FiEdit,
  FiTrash2,
  FiCheckCircle,
  FiAlertCircle,
  FiX
} from "react-icons/fi";
import { useLanguage } from "../context/LanguageContext";
import "./AdminDashboard.css";
import gisfylogo from "../assets/gisfylogo.png";

const UploadPatrolBoundary = () => {
  const { language } = useLanguage();

  // Translations
  const translations = {
    en: {
      title: "Plantation Boundary List",
      uploadTitle: "Upload Plantation Boundary",
      loading: "Loading plantation boundaries...",
      errorLoading: "Error loading plantation boundaries",
      retry: "Retry",
      boundaryName: "Boundary Name",
      status: "Status",
      actions: "Actions",
      published: "Published",
      noBoundaries: "No plantation boundaries found.",
      selectFiles: "Please select shapefile components",
      uploadSuccess: "Plantation Boundary Uploaded Successfully",
      uploadFailed: "Upload failed",
      dragDrop: "Drag & Drop or Click to Upload",
      fileHint: "Select .kml .shp, .shx, .dbf files (optional .prj)",
      filesSelected: "files selected",
      clearSelection: "Clear Selection",
      boundaryColor: "Boundary Color",
      processing: "Processing...",
      uploadButton: "Upload Plantation Boundary",
      success: "Success!",
      error: "Error!",
      editing: "Editing:",
      cancel: "Cancel",
      replace: "Replace",
      edit: "Edit",
      delete: "Delete",
      deleteConfirm: "Are you sure you want to delete this boundary?",
      deleteSuccess: "Boundary deleted successfully",
      deleteFailed: "Failed to delete boundary"
    },
    gu: {
      title: "પ્લાન્ટેશન બાઉન્ડરી સૂચિ",
      uploadTitle: "પ્લાન્ટેશન બાઉન્ડરી અપલોડ કરો",
      loading: "પ્લાન્ટેશન બાઉન્ડરી લોડ થઈ રહી છે...",
      errorLoading: "પ્લાન્ટેશન બાઉન્ડરી લોડ કરવામાં ભૂલ",
      retry: "ફરી પ્રયાસ કરો",
      boundaryName: "બાઉન્ડરી નામ",
      status: "સ્થિતિ",
      actions: "ક્રિયાઓ",
      published: "પ્રકાશિત",
      noBoundaries: "કોઈ પ્લાન્ટેશન બાઉન્ડરી મળી નથી.",
      selectFiles: "કૃપા કરીને શેપફાઇલ ઘટકો પસંદ કરો",
      uploadSuccess: "પ્લાન્ટેશન બાઉન્ડરી સફળતાપૂર્વક અપલોડ થઈ",
      uploadFailed: "અપલોડ નિષ્ફળ",
      dragDrop: "ખેંચો અને છોડો અથવા અપલોડ કરવા ક્લિક કરો",
      fileHint: ".kml .shp, .shx, .dbf ફાઇલો પસંદ કરો (વૈકલ્પિક .prj)",
      filesSelected: "ફાઇલો પસંદ કરી",
      clearSelection: "પસંદગી સાફ કરો",
      boundaryColor: "બાઉન્ડ્રી રંગ",
      processing: "પ્રક્રિયા કરી રહ્યા છે...",
      uploadButton: "પ્લાન્ટેશન બાઉન્ડરી અપલોડ કરો",
      success: "સફળતા!",
      error: "ભૂલ!",
      editing: "સંપાદન કરી રહ્યા છે:",
      cancel: "રદ કરો",
      replace: "બદલો",
      edit: "સંપાદન કરો",
      delete: "કાઢી નાખો",
      deleteConfirm: "શું તમે ખરેખર આ બાઉન્ડરી કાઢી નાખવા માંગો છો?",
      deleteSuccess: "બાઉન્ડરી સફળતાપૂર્વક કાઢી નાખવામાં આવી",
      deleteFailed: "બાઉન્ડરી કાઢી નાખવામાં નિષ્ફળ"
    }
  };

  const t = translations[language] || translations.en;

  const [files, setFiles] = useState([]);
  const [color, setColor] = useState("#ff0000");

  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const [boundaries, setBoundaries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  // New state for edit mode
  const [selectedBoundary, setSelectedBoundary] = useState(null);

  /* =========================
     Fetch Patrol Boundaries
  ========================== */
  const fetchPatrolBoundaries = async () => {
    try {
      setLoading(true);
      setError(false);

      const token = localStorage.getItem("token");

      const res = await axios.get(
        `${API_BASE_URL}/api/patrol-boundaries`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setBoundaries(res.data.data || []);

    } catch (err) {
      console.error(err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatrolBoundaries();
  }, []);

  /* =========================
     File Change
  ========================== */
  const handleFileChange = (e) => {
    setFiles(Array.from(e.target.files));
    setMessage("");
  };

  /* =========================
     Handle Edit Boundary
  ========================== */
  const handleEditBoundary = (boundary) => {
    setSelectedBoundary(boundary);
    setColor(boundary.color || "#ff0000");
    // Scroll to upload section
    document.querySelector('.upload-card').scrollIntoView({ behavior: 'smooth' });
  };

  /* =========================
     Handle Delete Boundary
  ========================== */
  const handleDeleteBoundary = async (boundary) => {
    if (!window.confirm(t.deleteConfirm)) {
      return;
    }

    try {
      const token = localStorage.getItem("token");
      
      await axios.delete(
        `${API_BASE_URL}/api/patrol-boundaries/${boundary.id || boundary._id}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setMessageType("success");
      setMessage(t.deleteSuccess);
      
      // Refresh the list
      fetchPatrolBoundaries();

      // Clear message after 3 seconds
      setTimeout(() => setMessage(""), 3000);

    } catch (err) {
      console.error(err);
      setMessageType("error");
      setMessage(t.deleteFailed);
    }
  };

  /* =========================
     Upload/Replace Patrol Boundary
  ========================== */
  const uploadBoundary = async () => {
    if (files.length === 0) {
      setMessageType("error");
      setMessage(t.selectFiles);
      return;
    }

    const formData = new FormData();

    files.forEach((file) => {
      formData.append("files", file);
    });

    formData.append("color", color);
    
    // Add boundary name if editing
    if (selectedBoundary) {
      formData.append("boundary_name", selectedBoundary.name);
    }

    try {
      setUploading(true);
      setMessage("");

      const token = localStorage.getItem("token");
      
      // Determine if this is a replace operation
      const endpoint = selectedBoundary 
        ? `${API_BASE_URL}/api/patrol-boundaries/${selectedBoundary.id || selectedBoundary._id}`
        : `${API_BASE_URL}/api/upload-patrol-boundary`;
      
      const method = selectedBoundary ? "put" : "post";

      const res = await axios({
        method: method,
        url: endpoint,
        data: formData,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data"
        }
      });

      if (res.data.success) {
        setMessageType("success");
        setMessage(selectedBoundary ? t.replace + " " + selectedBoundary.name : t.uploadSuccess);

        // Clear files and selected boundary
        setFiles([]);
        setSelectedBoundary(null);
        
        // Reset color if needed
        if (!selectedBoundary) {
          setColor("#ff0000");
        }

        const input = document.getElementById("patrol-file-input");
        if (input) input.value = "";

        fetchPatrolBoundaries();
      } else {
        setMessageType("error");
        setMessage(res.data.message || t.uploadFailed);
      }
    } catch (err) {
      console.error(err);
      setMessageType("error");
      setMessage(err.response?.data?.message || t.uploadFailed);
    } finally {
      setUploading(false);
    }
  };

  /* =========================
     Cancel Edit
  ========================== */
  const cancelEdit = () => {
    setSelectedBoundary(null);
    setFiles([]);
    setColor("#ff0000");
    setMessage("");
    
    // Clear file input
    const input = document.getElementById("patrol-file-input");
    if (input) input.value = "";
  };

  return (
    <div className="admin-content">
      <div className="content-columns">
        {/* LEFT COLUMN - Boundary List */}
        <div className="column">
          <div className="card">
            <div className="card-header">
              <h3><FiMap /> {t.title}</h3>
              <div className="card-actions">
                <FiFilter />
                <FiRefreshCw 
                  onClick={fetchPatrolBoundaries} 
                  style={{ cursor: "pointer" }} 
                />
              </div>
            </div>

            <div className="coupe-list-container">
              {loading ? (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <p>{t.loading}</p>
                </div>
              ) : error ? (
                <div className="error-state">
                  <FiAlertCircle />
                  <p>{t.errorLoading}</p>
                  <button
                    onClick={fetchPatrolBoundaries}
                    className="btn-retry"
                  >
                    <FiRefreshCw /> {t.retry}
                  </button>
                </div>
              ) : (
                <div className="coupe-table">
                  <div className="table-header">
                    <span>{t.boundaryName}</span>
                    <span>{t.status}</span>
                    <span>{t.actions}</span>
                  </div>

                  <div className="table-body">
                    {boundaries.slice(0, 16).map((boundary, index) => (
                      <div key={index} className="table-row">
                        <div className="coupe-name-cell">
                          <div
                            className="color-indicator"
                            style={{
                              backgroundColor: boundary.color || "#1890ff"
                            }}
                          />
                          <span className="coupe-name">
                            {boundary.name || `${t.boundaryName} ${index + 1}`}
                          </span>
                        </div>

                        <div className="status-cell">
                          <span className="status-badge published">
                            {t.published}
                          </span>
                        </div>

                        <div className="actions-cell">
                          <button 
                            className="btn-action edit" 
                            title={t.edit}
                            onClick={() => handleEditBoundary(boundary)}
                          >
                            <FiEdit />
                          </button>
                          <button 
                            className="btn-action delete" 
                            title={t.delete}
                            onClick={() => handleDeleteBoundary(boundary)}
                          >
                            <FiTrash2 />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {boundaries.length === 0 && !loading && (
                <div className="empty-state">
                  <FiMap />
                  <p>{t.noBoundaries}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN - Upload Section */}
        <div className="column">
          <div className="card upload-card">
            <div className="card-header">
              <h3><FiUpload /> {t.uploadTitle}</h3>
            </div>

            {/* Edit mode indicator */}
            {selectedBoundary && (
              <div className="edit-mode-indicator">
                <FiEdit /> {t.editing} <strong>{selectedBoundary.name}</strong>
                <button 
                  className="btn-clear-selection"
                  onClick={cancelEdit}
                >
                  <FiX /> {t.cancel}
                </button>
              </div>
            )}

            {/* Upload Area */}
            <div
              className="upload-area"
              onClick={() =>
                document.getElementById("patrol-file-input").click()
              }
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                setFiles(Array.from(e.dataTransfer.files));
              }}
            >
              <input
                id="patrol-file-input"
                type="file"
                multiple
                accept=".shp,.shx,.dbf,.prj,.kml"
                onChange={handleFileChange}
                style={{ display: "none" }}
              />

              {files.length > 0 ? (
                <div className="files-selected">
                  <FiCheckCircle className="success-icon" />
                  <h4>{files.length} {t.filesSelected}</h4>
                  <div className="file-list">
                    {files.map((file, index) => (
                      <div key={index} className="file-item">
                        <span>{file.name}</span>
                        <span className="file-size">
                          ({(file.size / 1024).toFixed(1)} KB)
                        </span>
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
                    {t.clearSelection}
                  </button>
                </div>
              ) : (
                <>
                  <div className="upload-icon">
                    <FiUpload />
                  </div>
                  <h4>{t.dragDrop}</h4>
                  <p className="upload-hint">
                    {t.fileHint}
                  </p>
                </>
              )}
            </div>

            {/* Color Picker */}
            <div className="color-selection">
              <h4>{t.boundaryColor}</h4>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  style={{
                    width: "60px",
                    height: "40px",
                    cursor: "pointer",
                    borderRadius: "6px",
                    border: "2px solid #e2e8f0"
                  }}
                />
                <span className="color-value">{color}</span>
              </div>
            </div>

            {/* Upload Button */}
            <button
              className="btn-upload"
              onClick={uploadBoundary}
              disabled={uploading || files.length === 0}
            >
              {uploading ? (
                <>
                  <div className="spinner-small"></div>
                  {t.processing}
                </>
              ) : (
                <>
                  <FiUpload /> 
                  {selectedBoundary 
                    ? `${t.replace} ${selectedBoundary.name}`
                    : t.uploadButton}
                </>
              )}
            </button>

            {/* Status Message */}
            {message && (
              <div
                className={`status-message ${
                  messageType === "success" ? "success" : "error"
                }`}
              >
                <div className="status-icon">
                  {messageType === "success"
                    ? <FiCheckCircle />
                    : <FiAlertCircle />}
                </div>
                <div className="status-content">
                  <h4>
                    {messageType === "success" ? t.success : t.error}
                  </h4>
                  <p>{message}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <footer className="footer" style={{color:'black',
            textAlign:'center',
            padding:'15px',
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'center'}}>
                <p> © 2026 Gujarat Forest Department | RECAP4NDC Initiative    </p>
                <div style={{display:'flex', alignItems:'center'}}>
                      <p>Powered by  </p>
            <a href="https://www.gisfy.co.in/" target="_blank" rel="noopener noreferrer">
                <img 
                  src={gisfylogo} 
                  alt="logo picture" 
                  style={{ width: '100px', height: '40px' }} 
                /></a>    </div>
            
            </footer>
    </div>
  );
};

export default UploadPatrolBoundary;
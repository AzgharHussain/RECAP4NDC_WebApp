// EditBoundaryModal.js
import React, { useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../config";
import {
  FiX,
  FiUpload,
  FiCheckCircle,
  FiAlertCircle,
  FiTrash2
} from "react-icons/fi";
import { useLanguage } from "../context/LanguageContext";
import "./EditBoundaryModal.css";

const EditBoundaryModal = ({ isOpen, onClose, boundary, onSuccess }) => {
  const { language } = useLanguage();
  
  const translations = {
    en: {
      title: "Edit Plantation Boundary",
      replaceTitle: "Replace Boundary",
      currentBoundary: "Current Boundary",
      uploadNewBoundary: "Upload New Boundary",
      replaceWarning: "This will replace the existing boundary. The old boundary data will be permanently deleted.",
      dragDrop: "Drag & Drop or Click to Upload",
      fileHint: "Select .kml .shp, .shx, .dbf files (optional .prj)",
      filesSelected: "files selected",
      clearSelection: "Clear Selection",
      boundaryColor: "Boundary Color",
      processing: "Processing...",
      replaceButton: "Replace Boundary",
      cancel: "Cancel",
      success: "Success!",
      error: "Error!",
      replaceSuccess: "Boundary replaced successfully",
      replaceFailed: "Replace failed",
      selectFiles: "Please select shapefile components",
      confirmReplace: "Are you sure you want to replace this boundary?",
      confirmDelete: "Confirm Delete",
      deleteButton: "Delete Boundary",
      deleteConfirm: "Are you sure you want to permanently delete this boundary?",
      deleteSuccess: "Boundary deleted successfully",
      deleteFailed: "Delete failed"
    },
    gu: {
      title: "પ્લાન્ટેશન બાઉન્ડરી સંપાદિત કરો",
      replaceTitle: "બાઉન્ડરી બદલો",
      currentBoundary: "વર્તમાન બાઉન્ડરી",
      uploadNewBoundary: "નવી બાઉન્ડરી અપલોડ કરો",
      replaceWarning: "આ હાલની બાઉન્ડરીને બદલશે. જૂનો ડેટા કાયમી ધોરણે ડિલીટ થઈ જશે.",
      dragDrop: "ખેંચો અને છોડો અથવા અપલોડ કરવા ક્લિક કરો",
      fileHint: ".kml .shp, .shx, .dbf ફાઇલો પસંદ કરો (વૈકલ્પિક .prj)",
      filesSelected: "ફાઇલો પસંદ કરી",
      clearSelection: "પસંદગી સાફ કરો",
      boundaryColor: "બાઉન્ડ્રી રંગ",
      processing: "પ્રક્રિયા કરી રહ્યા છે...",
      replaceButton: "બાઉન્ડરી બદલો",
      cancel: "રદ કરો",
      success: "સફળતા!",
      error: "ભૂલ!",
      replaceSuccess: "બાઉન્ડરી સફળતાપૂર્વક બદલાઈ",
      replaceFailed: "બદલવામાં નિષ્ફળ",
      selectFiles: "કૃપા કરીને શેપફાઇલ ઘટકો પસંદ કરો",
      confirmReplace: "શું તમે ખરેખર આ બાઉન્ડરીને બદલવા માંગો છો?",
      confirmDelete: "કાઢી નાખવાની પુષ્ટિ કરો",
      deleteButton: "બાઉન્ડરી કાઢી નાખો",
      deleteConfirm: "શું તમે ખરેખર આ બાઉન્ડરીને કાયમી ધોરણે કાઢી નાખવા માંગો છો?",
      deleteSuccess: "બાઉન્ડરી સફળતાપૂર્વક કાઢી નાખવામાં આવી",
      deleteFailed: "કાઢી નાખવામાં નિષ્ફળ"
    }
  };

  const t = translations[language] || translations.en;

  const [files, setFiles] = useState([]);
  const [color, setColor] = useState(boundary?.color || "#ff0000");
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    setFiles(Array.from(e.target.files));
    setMessage("");
  };

  const handleReplace = async () => {
    if (files.length === 0) {
      setMessageType("error");
      setMessage(t.selectFiles);
      return;
    }

    if (!window.confirm(t.confirmReplace)) {
      return;
    }

    const formData = new FormData();
    files.forEach((file) => {
      formData.append("files", file);
    });
    formData.append("color", color);
    formData.append("boundaryId", boundary.id);
    formData.append("oldTableName", boundary.table_name);

    try {
      setUploading(true);
      setMessage("");

      const token = localStorage.getItem("token");

      const res = await axios.put(
        `${API_BASE_URL}/api/replace-patrol-boundary/${boundary.id}`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data"
          }
        }
      );

      if (res.data.success) {
        setMessageType("success");
        setMessage(t.replaceSuccess);
        
        // Clear files after successful upload
        setFiles([]);
        const input = document.getElementById("edit-file-input");
        if (input) input.value = "";
        
        // Notify parent component to refresh the list
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1500);
      } else {
        setMessageType("error");
        setMessage(res.data.message || t.replaceFailed);
      }
    } catch (err) {
      console.error(err);
      setMessageType("error");
      setMessage(err.response?.data?.message || t.replaceFailed);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(t.deleteConfirm)) {
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const res = await axios.delete(
        `${API_BASE_URL}/api/patrol-boundaries/${boundary.id}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (res.data.success) {
        onSuccess();
        onClose();
      } else {
        setMessageType("error");
        setMessage(res.data.message || t.deleteFailed);
      }
    } catch (err) {
      console.error(err);
      setMessageType("error");
      setMessage(err.response?.data?.message || t.deleteFailed);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{t.title}</h3>
          <button className="close-btn" onClick={onClose}>
            <FiX />
          </button>
        </div>

        <div className="modal-body">
          {/* Current Boundary Info */}
          <div className="current-boundary-info">
            <h4>{t.currentBoundary}</h4>
            <div className="boundary-details">
              <div className="detail-row">
                <strong>Name:</strong> {boundary.name}
              </div>
              <div className="detail-row">
                <strong>Color:</strong>
                <div
                  className="color-preview"
                  style={{ backgroundColor: boundary.color }}
                />
                <span>{boundary.color}</span>
              </div>
              <div className="detail-row">
                <strong>Created:</strong> {new Date(boundary.created_at).toLocaleDateString()}
              </div>
            </div>
          </div>

          <div className="replace-section">
            <h4>{t.replaceTitle}</h4>
            <p className="warning-text">{t.replaceWarning}</p>

            {/* Upload Area */}
            <div
              className="upload-area"
              onClick={() => document.getElementById("edit-file-input").click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                setFiles(Array.from(e.dataTransfer.files));
              }}
            >
              <input
                id="edit-file-input"
                type="file"
                multiple
                accept=".shp,.shx,.dbf,.prj,.kml,.kmz"
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
                  <p className="upload-hint">{t.fileHint}</p>
                </>
              )}
            </div>

            {/* Color Picker */}
            <div className="color-selection">
              <h4>{t.boundaryColor}</h4>
              <div className="color-picker-wrapper">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="color-input"
                />
                <span className="color-value">{color}</span>
              </div>
            </div>

            {/* Status Message */}
            {message && (
              <div className={`status-message ${messageType}`}>
                <div className="status-icon">
                  {messageType === "success" ? <FiCheckCircle /> : <FiAlertCircle />}
                </div>
                <div className="status-content">
                  <h4>{messageType === "success" ? t.success : t.error}</h4>
                  <p>{message}</p>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="modal-actions">
              <button
                className="btn-delete"
                onClick={handleDelete}
                disabled={uploading}
              >
                <FiTrash2 /> {t.deleteButton}
              </button>
              <button
                className="btn-replace"
                onClick={handleReplace}
                disabled={uploading || files.length === 0}
              >
                {uploading ? (
                  <>
                    <div className="spinner-small"></div>
                    {t.processing}
                  </>
                ) : (
                  <>
                    <FiUpload /> {t.replaceButton}
                  </>
                )}
              </button>
              <button className="btn-cancel" onClick={onClose}>
                {t.cancel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditBoundaryModal;
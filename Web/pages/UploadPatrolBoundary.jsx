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
  FiAlertCircle
} from "react-icons/fi";

import "./AdminDashboard.css";

const UploadPatrolBoundary = () => {

  const [files, setFiles] = useState([]);
  const [color, setColor] = useState("#ff0000");

  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const [boundaries, setBoundaries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);


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
     Upload Patrol Boundary
  ========================== */
  const uploadBoundary = async () => {

    if (files.length === 0) {
      setMessageType("error");
      setMessage("Please select shapefile components");
      return;
    }

    const formData = new FormData();

    files.forEach((file) => {
      formData.append("files", file);
    });

    formData.append("color", color);

    try {

      setUploading(true);
      setMessage("");

      const token = localStorage.getItem("token");

      const res = await axios.post(
        `${API_BASE_URL}/api/upload-patrol-boundary`,
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
        setMessage("Patrol Boundary Uploaded Successfully");

        setFiles([]);

        const input = document.getElementById("patrol-file-input");
        if (input) input.value = "";

        fetchPatrolBoundaries();

      } else {

        setMessageType("error");
        setMessage(res.data.message || "Upload failed");

      }

    } catch (err) {

      console.error(err);

      setMessageType("error");
      setMessage(err.response?.data?.message || "Upload failed");

    } finally {

      setUploading(false);

    }
  };


  return (
    <div className="admin-content">

      <div className="content-columns">

        {/* LEFT COLUMN */}
        <div className="column">
          <div className="card">

            <div className="card-header">
              <h3><FiMap /> Patrol Boundary List</h3>

              <div className="card-actions">
                <FiFilter />
                <FiRefreshCw onClick={fetchPatrolBoundaries} />
              </div>
            </div>

            <div className="coupe-list-container">

              {loading ? (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <p>Loading patrol boundaries...</p>
                </div>
              ) : error ? (
                <div className="error-state">
                  <FiAlertCircle />
                  <p>Error loading patrol boundaries</p>

                  <button
                    onClick={fetchPatrolBoundaries}
                    className="btn-retry"
                  >
                    <FiRefreshCw /> Retry
                  </button>
                </div>
              ) : (
                <div className="coupe-table">

                  <div className="table-header">
                    <span>Boundary Name</span>
                    <span>Status</span>
                    <span>Actions</span>
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
                            {boundary.name || `Boundary ${index + 1}`}
                          </span>

                        </div>

                        <div className="status-cell">
                          <span className="status-badge published">
                            Published
                          </span>
                        </div>

                        <div className="actions-cell">

                         

                          <button className="btn-action edit">
                            <FiEdit />
                          </button>

                          <button className="btn-action delete">
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
                  <p>No patrol boundaries found.</p>
                </div>
              )}

            </div>
          </div>
        </div>



        {/* RIGHT COLUMN */}
        <div className="column">

          <div className="card upload-card">

            <div className="card-header">
              <h3><FiUpload /> Upload Patrol Boundary</h3>
            </div>


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
                accept=".shp,.shx,.dbf,.prj"
                onChange={handleFileChange}
                style={{ display: "none" }}
              />

              {files.length > 0 ? (

                <div className="files-selected">

                  <FiCheckCircle className="success-icon" />

                  <h4>{files.length} files selected</h4>

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
                    Select .shp, .shx, .dbf files (optional .prj)
                  </p>
                </>

              )}

            </div>


            {/* Color Picker */}
            <div className="color-selection">

              <h4>Boundary Color</h4>

              <div style={{ display: "flex", gap: "10px" }}>

                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  style={{
                    width: "60px",
                    height: "40px",
                    cursor: "pointer"
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
                  Processing...
                </>
              ) : (
                <>
                  <FiUpload /> Upload Patrol Boundary
                </>
              )}

            </button>


            {/* Status Message */}
            {message && (

              <div
                className={`status-message ${
                  messageType === "success"
                    ? "success"
                    : "error"
                }`}
              >

                <div className="status-icon">
                  {messageType === "success"
                    ? <FiCheckCircle />
                    : <FiAlertCircle />}
                </div>

                <div className="status-content">
                  <h4>
                    {messageType === "success"
                      ? "Success!"
                      : "Error!"}
                  </h4>

                  <p>{message}</p>
                </div>

              </div>

            )}

          </div>
        </div>

      </div>
    </div>
  );
};

export default UploadPatrolBoundary;
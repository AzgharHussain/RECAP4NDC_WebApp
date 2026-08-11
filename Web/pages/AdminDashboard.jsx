import React, { useState, useEffect } from "react";
import { useLanguage } from "../context/LanguageContext";
import axios from "axios";
import { API_BASE_URL } from '../config';
import {
  FiUpload, FiMap, FiDatabase, FiServer, FiCheckCircle,
  FiAlertCircle, FiRefreshCw, FiEye, FiTrash2, FiEdit,
  FiLayers, FiPieChart, FiGrid, FiCalendar, FiUsers,
  FiSettings, FiChevronRight, FiCopy, FiFilter, FiLifeBuoy,
  FiMail, FiClock, FiX, FiChevronDown, FiChevronUp
} from "react-icons/fi";
import { RiAdminFill } from "react-icons/ri";
import "./AdminDashboard.css";
import UploadPatrolBoundary from "./UploadPatrolBoundary";
import gisfylogo from "../assets/Gisfylogo.png";
import gujaratlogo from "../assets/FOREST DEPT.jpg";


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

  const [divisions, setDivisions] = useState([]);
  const [divisionsLoading, setDivisionsLoading] = useState(false);
  const [selectedOption, setSelectedOption] = useState("");
  const [divisionsError, setDivisionsError] = useState(null);

  // New state for edit mode
  const [selectedCoupe, setSelectedCoupe] = useState(null);

  // Support tickets state
  const [tickets, setTickets] = useState([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketsError, setTicketsError] = useState(null);
  const [expandedTicket, setExpandedTicket] = useState(null);
  const [ticketFilter, setTicketFilter] = useState('all');

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
      api: "API",
      selectDivision: "Select Division:",
      chooseDivision: "-- Choose a division --",
      loadingDivisions: "Loading divisions...",
      errorDivisions: "Error loading divisions",
      noDivisions: "No divisions available",
      editing: "Editing:",
      cancel: "Cancel",
      dragDrop: "Drag & Drop or Click to Upload",
      fileHint: "Select .shp, .shx, .dbf files (and optionally .prj)",
      filesSelected: "files selected",
      clearSelection: "Clear Selection",
      chooseLayerColor: "Choose Layer Color",
      processing: "Processing...",
      replace: "Replace",
      uploadButton: "Upload & Publish Shapefile",
      success: "Success!",
      errorMessage: "Error!",
      uploadProcess: "Upload Process",
      selectFiles: "Select Files",
      importDatabase: "Import to Database",
      publishGeoserver: "Publish to GeoServer",
      actions: "Actions",
      status: "Status",
      edit: "Edit",
      delete: "Delete",
      noCoupes: "No coupes found. Upload your first shapefile!",
      uploadFailed: "Upload failed: ",
      fileValidation: "Select shapefile components (.shp .shx .dbf [ .prj ]) before upload.",
      coupeName: "Coupe Name",
      publishedStatus: "Published",
      pendingStatus: "Pending",
      supportTickets: "Support Tickets",
      noTickets: "No support tickets found.",
      loadingTickets: "Loading tickets...",
      ticketId: "Ticket ID",
      issueType: "Issue Type",
      submittedBy: "Submitted By",
      submittedAt: "Submitted",
      deleteTicket: "Delete Ticket",
      confirmDelete: "Are you sure you want to delete this support ticket?",
      allTickets: "All",
      openTickets: "Open",
      inProgress: "In Progress",
      resolvedTickets: "Resolved",
      closedTickets: "Closed"
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
      api: "API",
      selectDivision: "વિભાગ પસંદ કરો:",
      chooseDivision: "-- વિભાગ પસંદ કરો --",
      loadingDivisions: "વિભાગો લોડ થઈ રહ્યા છે...",
      errorDivisions: "વિભાગો લોડ કરવામાં ભૂલ",
      noDivisions: "કોઈ વિભાગ ઉપલબ્ધ નથી",
      editing: "સંપાદન કરી રહ્યા છે:",
      cancel: "રદ કરો",
      dragDrop: "ખેંચો અને છોડો અથવા અપલોડ કરવા ક્લિક કરો",
      fileHint: ".shp, .shx, .dbf ફાઇલો પસંદ કરો (વૈકલ્પિક .prj)",
      filesSelected: "ફાઇલો પસંદ કરી",
      clearSelection: "પસંદગી સાફ કરો",
      chooseLayerColor: "લેયર રંગ પસંદ કરો",
      processing: "પ્રક્રિયા કરી રહ્યા છે...",
      replace: "બદલો",
      uploadButton: "શેપફાઇલ અપલોડ અને પ્રકાશિત કરો",
      success: "સફળતા!",
      errorMessage: "ભૂલ!",
      uploadProcess: "અપલોડ પ્રક્રિયા",
      selectFiles: "ફાઇલો પસંદ કરો",
      importDatabase: "ડેટાબેઝમાં આયાત કરો",
      publishGeoserver: "જીઓસર્વર પર પ્રકાશિત કરો",
      actions: "ક્રિયાઓ",
      status: "સ્થિતિ",
      edit: "સંપાદન કરો",
      delete: "કાઢી નાખો",
      noCoupes: "કોઈ કૂપ મળ્યા નથી. તમારી પ્રથમ શેપફાઇલ અપલોડ કરો!",
      uploadFailed: "અપલોડ નિષ્ફળ: ",
      fileValidation: "અપલોડ કરતા પહેલા શેપફાઇલ ઘટકો (.shp .shx .dbf [ .prj ]) પસંદ કરો.",
      coupeName: "કૂપ નામ",
      publishedStatus: "પ્રકાશિત",
      pendingStatus: "બાકી",
      supportTickets: "સપોર્ટ ટિકટ",
      noTickets: "કોઈ સપોર્ટ ટિકટ મળ્યા નથી.",
      loadingTickets: "ટિકટ લોડ થઈ રહ્યા છે...",
      ticketId: "ટિકટ ID",
      issueType: "સમસ્યાનો પ્રકાર",
      submittedBy: "સબમિટ કર્યું",
      submittedAt: "સમય",
      deleteTicket: "ટિકટ કાઢી નાખો",
      confirmDelete: "શું તમે ખરેખર આ સપોર્ટ ટિકટ કાઢી નાખવા માંગો છો?",
      allTickets: "બધા",
      openTickets: "ખુલ્લા",
      inProgress: "પ્રગતિમાં",
      resolvedTickets: "ઉકેલાયેલ",
      closedTickets: "બંધ"
    }
  };

  const t = text[language];

  // Fetch coupes from API
  useEffect(() => {
    fetchCoupes();
    fetchDivisions();
    fetchTickets();
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

  const fetchDivisions = async () => {
    try {
      setDivisionsLoading(true);
      setDivisionsError(null);
      
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${API_BASE_URL}/api/coupe-divisions`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      
      
      let divisionsData = [];
      
      if (response.data) {
        if (Array.isArray(response.data)) {
          if (response.data.length > 0 && Array.isArray(response.data[0])) {
            divisionsData = response.data[0];
          } else {
            divisionsData = response.data;
          }
        } else if (response.data.data && Array.isArray(response.data.data)) {
          divisionsData = response.data.data;
        }
      }
      
      setDivisions(divisionsData);
      
    } catch (err) {
      console.error("Error fetching divisions:", err);
      if (err.response) {
        console.error("Error response:", err.response.data);
        console.error("Error status:", err.response.status);
      }
      setDivisionsError(t.errorDivisions);
    } finally {
      setDivisionsLoading(false);
    }
  };

  // Fetch support tickets
  const fetchTickets = async () => {
    try {
      setTicketsLoading(true);
      setTicketsError(null);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/api/support/tickets`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTickets(response.data.data || []);
    } catch (err) {
      console.error('Error fetching tickets:', err);
      setTicketsError(err.message || 'Failed to fetch tickets');
    } finally {
      setTicketsLoading(false);
    }
  };

  // Delete a support ticket
  const handleDeleteTicket = async (id) => {
    if (!window.confirm('Are you sure you want to delete this support ticket?')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_BASE_URL}/api/support/tickets/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTickets(tickets.filter(t => t.id !== id));
      if (expandedTicket === id) setExpandedTicket(null);
    } catch (err) {
      console.error('Error deleting ticket:', err);
      alert('Failed to delete ticket');
    }
  };

  // Update ticket status
  const handleTicketStatusChange = async (id, newStatus) => {
    try {
      const token = localStorage.getItem('token');
      await axios.patch(`${API_BASE_URL}/api/support/tickets/${id}/status`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setTickets(tickets.map(t => t.id === id ? { ...t, status: newStatus } : t));
    } catch (err) {
      console.error('Error updating ticket status:', err);
      alert('Failed to update status');
    }
  };

  const filteredTickets = ticketFilter === 'all'
    ? tickets
    : tickets.filter(t => t.status === ticketFilter);

  const ticketStatusColors = {
    open: '#f59e0b',
    in_progress: '#3b82f6',
    resolved: '#10b981',
    closed: '#6b7280',
  };

  const ticketStatusLabels = {
    open: language === 'gu' ? 'ખુલ્લું' : 'Open',
    in_progress: language === 'gu' ? 'પ્રગતિમાં' : 'In Progress',
    resolved: language === 'gu' ? 'ઉકેલાયેલ' : 'Resolved',
    closed: language === 'gu' ? 'બંધ' : 'Closed',
  };

  const issueTypeLabels = {
    login: 'Login / Auth',
    mobile_app: 'Mobile App',
    web_app: 'Web App',
    ndvi: 'NDVI / Forest Cover',
    patrolling: 'Patrolling',
    coupe: 'Coupe',
    data_sync: 'Data Sync',
    other: 'Other',
  };

  // Handle edit button click
  const handleEditCoupe = (coupeName) => {
    setSelectedCoupe({ name: coupeName });
    document.querySelector('.upload-card').scrollIntoView({ behavior: 'smooth' });
  };

  // Upload shapefile with progress simulation
  const uploadFiles = async () => {
    if (!files || files.length === 0) {
      setUploadStatus({
        success: false,
        message: t.fileValidation
      });
      return;
    }

    setLoading(true);
    setUploadProgress(0);
    setUploadStatus(null);

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
    if (selectedCoupe) {
      form.append("coupe_name", selectedCoupe.name);
    }

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
      setSelectedCoupe(null);
      fetchCoupes();

      setTimeout(() => setUploadProgress(0), 2000);

    } catch (err) {
      clearInterval(progressInterval);
      console.error(err);
      setUploadStatus({
        success: false,
        message: t.uploadFailed + (err.response?.data?.message || err.message)
      });
    } finally {
      setLoading(false);
    }
  };

  // Color options with better names
  const colorOptions = [
    { nameEn: "Emerald", nameGu: "પન્ના", value: "#10b981", icon: "🟢" },
    { nameEn: "Sapphire", nameGu: "નીલમ", value: "#3b82f6", icon: "🔵" },
    { nameEn: "Ruby", nameGu: "માણેક", value: "#ef4444", icon: "🔴" },
    { nameEn: "Amber", nameGu: "એમ્બર", value: "#f59e0b", icon: "🟠" },
    { nameEn: "Violet", nameGu: "વાયોલેટ", value: "#8b5cf6", icon: "🟣" },
    { nameEn: "Graphite", nameGu: "ગ્રેફાઇટ", value: "#374151", icon: "⚫" },
    { nameEn: "Rose", nameGu: "ગુલાબી", value: "#f472b6", icon: "🌸" }
  ];

  // Mock recent activity with translations
  const recentActivity = [
    { id: 1, actionEn: "Shapefile Upload", actionGu: "શેપફાઇલ અપલોડ", name: "Forest_Coupe_01.shp", time: "2 min ago", timeGu: "2 મિનિટ પહેલા", status: "success" },
    { id: 2, actionEn: "Database Update", actionGu: "ડેટાબેઝ અપડેટ", name: "Coupe metadata", time: "15 min ago", timeGu: "15 મિનિટ પહેલા", status: "success" },
    { id: 3, actionEn: "GeoServer Publish", actionGu: "જીઓસર્વર પ્રકાશન", name: "Layer: coupes_2024", time: "1 hour ago", timeGu: "1 કલાક પહેલા", status: "success" },
    { id: 4, actionEn: "Shapefile Upload", actionGu: "શેપફાઇલ અપલોડ", name: "Water_Bodies.shp", time: "2 hours ago", timeGu: "2 કલાક પહેલા", status: "pending" }
  ];

  // System health status with translations
  const systemHealth = [
    { serviceEn: "Database", serviceGu: "ડેટાબેઝ", status: "healthy", icon: <FiDatabase />, color: "#10b981" },
    { serviceEn: "GeoServer", serviceGu: "જીઓસર્વર", status: "healthy", icon: <FiServer />, color: "#10b981" },
    { serviceEn: "API", serviceGu: "API", status: "degraded", icon: <FiSettings />, color: "#f59e0b" }
  ];

  return (
    <div className="admin-dashboard">
      <div className="dashboard-main">
        <main className="admin-content">
          <div className="content-columns">
            {/* Left Column - Coupe List */}
            <div className="column">
              <div className="card">
                <div className="card-header">
                  <h3><FiMap /> {t.coupeList}</h3>
                  
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
                      <p>{t.error}</p>
                      <button onClick={fetchCoupes} className="btn-retry">
                        <FiRefreshCw /> {t.retry}
                      </button>
                    </div>
                  ) : (
                    <div className="coupe-table">
                      <div className="table-header">
                        <span>{t.coupeName}</span>
                        <span>{t.status}</span>
                        <span>{t.actions}</span>
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
                              <span className="status-badge published">{t.publishedStatus}</span>
                            </div>
                            <div className="actions-cell">
                              
                              <button className="btn-action delete" title={t.delete}>
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
                      <p>{t.noCoupes}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column - Upload Section */}
            <div className="column">
              <div className="card upload-card">
                <div className="card-header">
                  <h3><FiUpload /> {t.uploadTitle}</h3>
                </div>

                {/* <div className="division-selector">
                  <label htmlFor="division-dropdown">{t.selectDivision}</label>
                  <select 
                    id="division-dropdown"
                    className="dropdown-select"
                    value={selectedOption}
                    onChange={(e) => setSelectedOption(e.target.value)}
                  >
                    <option value="">{t.chooseDivision}</option>
                    {divisionsLoading ? (
                      <option disabled>{t.loadingDivisions}</option>
                    ) : divisionsError ? (
                      <option disabled>{t.errorDivisions}</option>
                    ) : divisions.length > 0 ? (
                      divisions.map((division, index) => {
                        const divisionName = division.division || Object.values(division)[0] || "Unknown";
                        return (
                          <option key={index} value={divisionName}>
                            {divisionName}
                          </option>
                        );
                      })
                    ) : (
                      <option disabled>{t.noDivisions}</option>
                    )}
                  </select>
                </div> */}

                {/* Edit mode indicator */}
                {selectedCoupe && (
                  <div className="edit-mode-indicator">
                    <FiEdit /> {t.editing} <strong>{selectedCoupe.name}</strong>
                    <button 
                      className="btn-clear-selection"
                      onClick={() => setSelectedCoupe(null)}
                    >
                      {t.cancel}
                    </button>
                  </div>
                )}

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
                      <h4>{files.length} {t.filesSelected}</h4>
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

                {/* Color Selection */}
                <div className="color-selection">
                  <h4>{t.chooseLayerColor}</h4>
                  <div className="color-grid">
                    {colorOptions.map((color, index) => (
                      <button
                        key={index}
                        className={`color-option ${selectedColor === color.value ? "selected" : ""}`}
                        style={{ backgroundColor: color.value }}
                        onClick={() => setSelectedColor(color.value)}
                        title={language === 'gu' ? color.nameGu : color.nameEn}
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
                      {t.processing}
                    </>
                  ) : (
                    <>
                      <FiUpload /> {selectedCoupe ? `${t.replace} ${selectedCoupe.name}` : t.uploadTitle}
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
                      <h4>{uploadStatus.success ? t.success : t.errorMessage}</h4>
                      <p>{uploadStatus.message}</p>
                    </div>
                  </div>
                )}

                {/* Process Steps */}
                <div className="process-steps">
                  <h4>{t.uploadProcess}</h4>
                  <div className="steps">
                    <div className="step active">
                      <div className="step-number">1</div>
                      <div className="step-text">{t.selectFiles}</div>
                    </div>
                    <div className="step-line" />
                    <div className="step">
                      <div className="step-number">2</div>
                      <div className="step-text">{t.importDatabase}</div>
                    </div>
                    <div className="step-line" />
                    <div className="step">
                      <div className="step-number">3</div>
                      <div className="step-text">{t.publishGeoserver}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ===== SUPPORT TICKETS SECTION ===== */}
          <div className="support-tickets-section">
            <div className="card">
              <div className="card-header">
                <h3><FiLifeBuoy /> {t.supportTickets}</h3>
                <div className="ticket-filter-buttons">
                  <button
                    className={`ticket-filter-btn ${ticketFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setTicketFilter('all')}
                  >
                    {t.allTickets} ({tickets.length})
                  </button>
                  <button
                    className={`ticket-filter-btn ${ticketFilter === 'open' ? 'active' : ''}`}
                    onClick={() => setTicketFilter('open')}
                  >
                    {t.openTickets} ({tickets.filter(t => t.status === 'open').length})
                  </button>
                  <button
                    className={`ticket-filter-btn ${ticketFilter === 'in_progress' ? 'active' : ''}`}
                    onClick={() => setTicketFilter('in_progress')}
                  >
                    {t.inProgress} ({tickets.filter(t => t.status === 'in_progress').length})
                  </button>
                  <button
                    className={`ticket-filter-btn ${ticketFilter === 'resolved' ? 'active' : ''}`}
                    onClick={() => setTicketFilter('resolved')}
                  >
                    {t.resolvedTickets} ({tickets.filter(t => t.status === 'resolved').length})
                  </button>
                  <button
                    className={`ticket-filter-btn ${ticketFilter === 'closed' ? 'active' : ''}`}
                    onClick={() => setTicketFilter('closed')}
                  >
                    {t.closedTickets} ({tickets.filter(t => t.status === 'closed').length})
                  </button>
                </div>
              </div>

              <div className="tickets-container">
                {ticketsLoading ? (
                  <div className="loading-state">
                    <div className="spinner"></div>
                    <p>{t.loadingTickets}</p>
                  </div>
                ) : ticketsError ? (
                  <div className="error-state">
                    <FiAlertCircle />
                    <p>{ticketsError}</p>
                    <button onClick={fetchTickets} className="btn-retry">
                      <FiRefreshCw /> {t.retry}
                    </button>
                  </div>
                ) : filteredTickets.length === 0 ? (
                  <div className="empty-state">
                    <FiLifeBuoy />
                    <p>{t.noTickets}</p>
                  </div>
                ) : (
                  <div className="tickets-list">
                    {filteredTickets.map((ticket) => (
                      <div key={ticket.id} className="ticket-item">
                        <div
                          className="ticket-summary"
                          onClick={() => setExpandedTicket(expandedTicket === ticket.id ? null : ticket.id)}
                        >
                          <div className="ticket-main-info">
                            <span className="ticket-id">{ticket.ticket_id}</span>
                            <span
                              className="ticket-status-badge"
                              style={{
                                backgroundColor: ticketStatusColors[ticket.status] || '#6b7280',
                                color: '#fff',
                              }}
                            >
                              {ticketStatusLabels[ticket.status] || ticket.status}
                            </span>
                            <span className="ticket-subject">{ticket.subject}</span>
                          </div>
                          <div className="ticket-meta">
                            <span className="ticket-name">
                              <FiMail size={12} /> {ticket.name}
                            </span>
                            <span className="ticket-date">
                              <FiClock size={12} /> {new Date(ticket.created_at).toLocaleDateString()}
                            </span>
                            <span className="ticket-chevron">
                              {expandedTicket === ticket.id ? <FiChevronUp /> : <FiChevronDown />}
                            </span>
                          </div>
                        </div>

                        {expandedTicket === ticket.id && (
                          <div className="ticket-details">
                            <div className="ticket-detail-row">
                              <div className="ticket-detail-group">
                                <label>{t.submittedBy}</label>
                                <span>{ticket.name}</span>
                              </div>
                              <div className="ticket-detail-group">
                                <label>Email</label>
                                <a href={`mailto:${ticket.email}`}>{ticket.email}</a>
                              </div>
                              <div className="ticket-detail-group">
                                <label>{t.issueType}</label>
                                <span>{issueTypeLabels[ticket.issue_type] || ticket.issue_type}</span>
                              </div>
                              <div className="ticket-detail-group">
                                <label>{t.submittedAt}</label>
                                <span>{new Date(ticket.created_at).toLocaleString()}</span>
                              </div>
                            </div>
                            <div className="ticket-description">
                              <label>{language === 'gu' ? 'વર્ણન' : 'Description'}</label>
                              <p>{ticket.description}</p>
                            </div>
                            <div className="ticket-actions-bar">
                              <select
                                className="ticket-status-select"
                                value={ticket.status}
                                onChange={(e) => handleTicketStatusChange(ticket.id, e.target.value)}
                              >
                                <option value="open">{ticketStatusLabels.open}</option>
                                <option value="in_progress">{ticketStatusLabels.in_progress}</option>
                                <option value="resolved">{ticketStatusLabels.resolved}</option>
                                <option value="closed">{ticketStatusLabels.closed}</option>
                              </select>
                              <button
                                className="btn-action delete"
                                onClick={() => handleDeleteTicket(ticket.id)}
                                title={t.deleteTicket}
                              >
                                <FiTrash2 /> {t.deleteTicket}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
      <footer className="footer" style={{color:'black',
              textAlign:'center',
              padding:'15px',
              display: 'flex',
              justifyContent: 'space-around',
              alignItems: 'center'}}>
                <div>
              <p style={{display: 'flex',alignItems: 'center',gap: '6px' }}> © 2026 Gujarat Forest Department <img src={gujaratlogo} alt="logo picture" style={{width:'40px'}}></img> </p>
      
                </div>
              <div style={{display:'flex', alignItems:'center',gap: '6px'}}>
                <p>Powered by  </p>
                <a href="https://www.gisfy.co.in/" target="_blank" rel="noopener noreferrer">
                  <img 
                    src={gisfylogo} 
                    alt="logo picture" 
                    style={{ width: '100px', height: '40px' }} 
                  />
                </a>
              </div>
            </footer>
    </div>
  );
}

export default AdminDashboard;
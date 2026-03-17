import React, { useEffect, useState } from "react";
import {
  CloseOutlined,
  DownloadOutlined,
  EyeOutlined,
  CalendarOutlined,
  UserOutlined,
  ClockCircleOutlined,
  PictureOutlined,
  SearchOutlined,
  RotateLeftOutlined,
  RotateRightOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  UndoOutlined,
  CloseCircleOutlined
} from "@ant-design/icons";
import axios from "axios";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import "./RouterMap.css";
import { API_BASE_URL } from "../config";
import Select from 'react-select';
import { Image } from 'antd';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import UploadPatrolBoundary from "./UploadPatrolBoundary";

// Helper to format date/time
const formatDateTime = (dateTime) => {
  if (!dateTime) return "N/A";
  return new Date(dateTime).toLocaleString();
};

const formatDuration = (startTime, endTime) => {
  if (!startTime || !endTime) return "N/A";
  const start = new Date(startTime);
  const end = new Date(endTime);
  const durationMs = end - start;
  const hours = Math.floor(durationMs / (1000 * 60 * 60));
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
};

const getImageUrl = (imageData) => {
  if (!imageData) return null;
  return `data:image/jpeg;base64,${imageData}`;
};

const PatrolLoader = () => (
  <div style={{
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "100%",
    width: "100%"
  }}>
    <div style={{
      border: "6px solid #f3f3f3",
      borderTop: "6px solid #3498db",
      borderRadius: "50%",
      width: "40px",
      height: "40px",
      animation: "spin 1s linear infinite"
    }}></div>
  </div>
);

const BeatPatrolCoverage = ({ language, setShowMapRoute, showmaproute }) => {
  // Beat selection states
  const [selectedDivision, setSelectedDivision] = useState(null);
  const [selectedRange, setSelectedRange] = useState(null);
  const [selectedRound, setSelectedRound] = useState(null);
  const [selectedBeat, setSelectedBeat] = useState(null);
  
  // Data states for dropdowns
  const [divisions, setDivisions] = useState([]);
  const [ranges, setRanges] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [beats, setBeats] = useState([]);
  
  // Boundary selection
  const [selectedBoundary, setSelectedBoundary] = useState(null);
  const [boundaries, setBoundaries] = useState([]);
  
  const [selectedMonth, setSelectedMonth] = useState("");
  
  const [loading, setLoading] = useState({
    divisions: false,
    ranges: false,
    rounds: false,
    beats: false,
    boundaries: false,
    coverage: false,
    patrol: false
  });
  
  const [coverageData, setCoverageData] = useState(null);
  const [patrols, setPatrols] = useState([]);

  // Patrol details modal
  const [selectedPatrol, setSelectedPatrol] = useState(null);
  const [patrolDetails, setPatrolDetails] = useState(null);
  const [showPatrolModal, setShowPatrolModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [setshowloader, setSetShowLoader] = useState(false);
  const [imageRotation, setImageRotation] = useState(0);
  const [imageScale, setImageScale] = useState(1);

  // Selection mode: 'beat' or 'boundary'
  const [selectionMode, setSelectionMode] = useState('beat'); // 'beat' or 'boundary'

  // Fetch divisions (Beat Coupe)
  const fetchDivisions = async () => {
    setLoading(prev => ({ ...prev, divisions: true }));
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${API_BASE_URL}/api/beat-coupe-divisions`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      // Handle the response format from the API
      const divisionsData = response.data[0] || response.data || [];
      const divisionList = divisionsData.map(item => ({
        value: item.division,
        label: item.division
      }));
      setDivisions(divisionList);
    } catch (error) {
      console.error("Error fetching divisions:", error);
      alert("Failed to load divisions list");
    } finally {
      setLoading(prev => ({ ...prev, divisions: false }));
    }
  };

  // Fetch ranges based on selected division
// Fetch ranges based on selected division
const fetchRanges = async (division) => {
  if (!division) return;
  
  setLoading(prev => ({ ...prev, ranges: true }));
  setSelectedRange(null);
  setSelectedRound(null);
  setSelectedBeat(null);
  setRounds([]);
  setBeats([]);
  
  try {
    const token = localStorage.getItem("token");
    const response = await axios.post(
      `${API_BASE_URL}/api/beat-coupe-ranges`,
      { division: division.value },
      {
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      }
    );

    // Handle the response correctly - it might be an array directly or have data property
    let rangesData = [];
    if (Array.isArray(response.data)) {
      rangesData = response.data;
    } else if (response.data && Array.isArray(response.data.data)) {
      rangesData = response.data.data;
    } else if (response.data && Array.isArray(response.data[0])) {
      rangesData = response.data[0];
    }

    const rangeList = rangesData.map(item => ({
      value: item.range,
      label: item.range
    }));
    setRanges(rangeList);
  } catch (error) {
    console.error("Error fetching ranges:", error);
    alert("Failed to load ranges");
  } finally {
    setLoading(prev => ({ ...prev, ranges: false }));
  }
};

// Fetch rounds based on selected division and range
const fetchRounds = async (division, range) => {
  if (!division || !range) return;
  
  setLoading(prev => ({ ...prev, rounds: true }));
  setSelectedRound(null);
  setSelectedBeat(null);
  setBeats([]);
  
  try {
    const token = localStorage.getItem("token");
    const response = await axios.post(
      `${API_BASE_URL}/api/beat-coupe-rounds`,
      { 
        division: division.value,
        range: range.value 
      },
      {
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      }
    );

    // Handle the response correctly
    let roundsData = [];
    if (Array.isArray(response.data)) {
      roundsData = response.data;
    } else if (response.data && Array.isArray(response.data.data)) {
      roundsData = response.data.data;
    } else if (response.data && Array.isArray(response.data[0])) {
      roundsData = response.data[0];
    }

    const roundList = roundsData.map(item => ({
      value: item.round,
      label: item.round
    }));
    setRounds(roundList);
  } catch (error) {
    console.error("Error fetching rounds:", error);
    alert("Failed to load rounds");
  } finally {
    setLoading(prev => ({ ...prev, rounds: false }));
  }
};

// Fetch beats based on selected division, range, and round
const fetchBeats = async (division, range, round) => {
  if (!division || !range || !round) return;
  
  setLoading(prev => ({ ...prev, beats: true }));
  setSelectedBeat(null);
  
  try {
    const token = localStorage.getItem("token");
    const response = await axios.post(
      `${API_BASE_URL}/api/beat-coupe-beats`,
      { 
        division: division.value,
        range: range.value,
        round: round.value
      },
      {
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      }
    );

    // Handle the response correctly
    let beatsData = [];
    if (Array.isArray(response.data)) {
      beatsData = response.data;
    } else if (response.data && Array.isArray(response.data.data)) {
      beatsData = response.data.data;
    } else if (response.data && Array.isArray(response.data[0])) {
      beatsData = response.data[0];
    }

    const beatList = beatsData.map(item => ({
      value: item.beat,
      label: item.beat
    }));
    setBeats(beatList);
  } catch (error) {
    console.error("Error fetching beats:", error);
    alert("Failed to load beats");
  } finally {
    setLoading(prev => ({ ...prev, beats: false }));
  }
};


  // Fetch patrol boundaries
  const fetchPatrolBoundaries = async () => {
    setLoading(prev => ({ ...prev, boundaries: true }));
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(
        `${API_BASE_URL}/api/patrol-boundaries`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      const boundaryList = (res.data.data || []).map(item => ({
        value: item.id || item._id,
        label: item.name || item.boundary_name || `Boundary ${item.id}`,
        data: item
      }));

      setBoundaries(boundaryList);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(prev => ({ ...prev, boundaries: false }));
    }
  };

  useEffect(() => {
    fetchDivisions();
    fetchPatrolBoundaries();
  }, []);

  // Handle division change
  const handleDivisionChange = (selectedOption) => {
    setSelectedDivision(selectedOption);
    setSelectedRange(null);
    setSelectedRound(null);
    setSelectedBeat(null);
    setRanges([]);
    setRounds([]);
    setBeats([]);
    resetData();
    
    if (selectedOption) {
      fetchRanges(selectedOption);
    }
  };

  // Handle range change
  const handleRangeChange = (selectedOption) => {
    setSelectedRange(selectedOption);
    setSelectedRound(null);
    setSelectedBeat(null);
    setRounds([]);
    setBeats([]);
    resetData();
    
    if (selectedOption && selectedDivision) {
      fetchRounds(selectedDivision, selectedOption);
    }
  };

  // Handle round change
  const handleRoundChange = (selectedOption) => {
    setSelectedRound(selectedOption);
    setSelectedBeat(null);
    setBeats([]);
    resetData();
    
    if (selectedOption && selectedDivision && selectedRange) {
      fetchBeats(selectedDivision, selectedRange, selectedOption);
    }
  };

  // Handle beat change
  const handleBeatChange = (selectedOption) => {
    setSelectedBeat(selectedOption);
    resetData();
  };

  // Handle boundary change
  const handleBoundaryChange = (selectedOption) => {
    setSelectedBoundary(selectedOption);
    if (selectedOption) {
      // Clear beat selection when boundary is selected
      setSelectedDivision(null);
      setSelectedRange(null);
      setSelectedRound(null);
      setSelectedBeat(null);
      setSelectionMode('boundary');
    }
    resetData();
  };

  // Toggle selection mode
  const toggleSelectionMode = (mode) => {
    setSelectionMode(mode);
    // Clear all selections when switching modes
    setSelectedDivision(null);
    setSelectedRange(null);
    setSelectedRound(null);
    setSelectedBeat(null);
    setSelectedBoundary(null);
    resetData();
  };

  // Handle month change
  const handleMonthChange = (e) => {
    setSelectedMonth(e.target.value);
    resetData();
  };

  // Reset all data
  const resetData = () => {
    setCoverageData(null);
    setPatrols([]);
    setSelectedPatrol(null);
    setPatrolDetails(null);
    setShowPatrolModal(false);
    setSelectedImage(null);
    setImageRotation(0);
    setImageScale(1);
  };

  // Fetch coverage data
  const fetchCoverageData = async () => {
    if (selectionMode === 'beat' && !selectedBeat) {
      alert("Please complete the beat selection (Division → Range → Round → Beat)");
      return;
    }
    if (selectionMode === 'boundary' && !selectedBoundary) {
      alert("Please select a Boundary");
      return;
    }
    if (!selectedMonth) {
      alert("Please select a month");
      return;
    }

    setLoading(prev => ({ ...prev, coverage: true }));
    setSelectedImage(null);
    
    try {
      const token = localStorage.getItem("token");
      
      // Determine which API to call based on selection mode
      const endpoint = selectionMode === 'beat'
        ? `${API_BASE_URL}/api/coupe-patrol-coverage`
        : `${API_BASE_URL}/api/boundary-patrol-coverage`;
      
      const payload = selectionMode === 'beat'
        ? { 
            coupe_table: selectedBeat.value, 
            month: selectedMonth 
          }
        : { 
            boundary: selectedBoundary.label, 
            month: selectedMonth 
          };

      const response = await axios.post(
        endpoint,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        }
      );

      if (response.data.success) {
        const data = response.data.data;
        setCoverageData(data);
        setPatrols(data.patrols_covering_coupe || []);
      } else {
        alert(response.data.message || "No coverage data found");
      }
    } catch (err) {
      console.error("Error fetching coverage data:", err);
      alert("Failed to load coverage data");
    } finally {
      setLoading(prev => ({ ...prev, coverage: false }));
    }
  };

  // Fetch patrol details
  const fetchPatrolDetails = async (patrolId) => {
    setLoading(prev => ({ ...prev, patrol: true }));
    setSetShowLoader(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_BASE_URL}/api/patrols/${patrolId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data && response.data.data) {
        setPatrolDetails(response.data.data);
        setSelectedPatrol(patrolId);
        setShowPatrolModal(true);
      } else {
        alert("Failed to load patrol details: Invalid data format");
      }
    } catch (error) {
      console.error("Error fetching patrol details:", error);
      alert("Failed to load patrol details");
    } finally {
      setLoading(prev => ({ ...prev, patrol: false }));
      setSetShowLoader(false);
    }
  };

  const closePatrolModal = () => {
    setShowPatrolModal(false);
    setSelectedPatrol(null);
    setPatrolDetails(null);
    setSelectedImage(null);
    setImageRotation(0);
    setImageScale(1);
  };

  // Export to Excel
  const exportToExcel = () => {
    if (!coverageData) return;

    const summaryData = [
      {
        [selectionMode === 'beat' ? "Beat" : "Boundary"]: selectionMode === 'beat' ? selectedBeat.label : selectedBoundary.label,
        "Area (sq m)": selectionMode === 'beat' ? coverageData.coupe_area_sq_m : coverageData.boundary_area_sq_m,
        "Patrol Covered Area (sq m)": coverageData.patrol_area_sq_m,
        "Coverage %": coverageData.coverage_percentage,
      },
    ];

    const patrolData = patrols.map((patrol) => ({
      "Patrol ID": patrol.patrol_id,
      "Start Time": formatDateTime(patrol.start_time),
      "End Time": formatDateTime(patrol.end_time),
      "Duration": formatDuration(patrol.start_time, patrol.end_time),
      "Patrol Officer": patrol.patrol_officer_name,
      "Distance (kms)": patrol.distance_kms,
      "Start Location": patrol.start_location,
      "End Location": patrol.end_location,
    }));

    const wb = XLSX.utils.book_new();
    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summarySheet, "Coverage Summary");

    if (patrolData.length > 0) {
      const patrolSheet = XLSX.utils.json_to_sheet(patrolData);
      XLSX.utils.book_append_sheet(wb, patrolSheet, "Patrols");
    }

    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array", cellStyles: true });
    const fileName = selectionMode === 'beat'
      ? `${selectedBeat.value}_patrol_coverage.xlsx`
      : `${selectedBoundary.label}_patrol_coverage.xlsx`;
    
    saveAs(
      new Blob([excelBuffer], { type: "application/octet-stream" }),
      fileName
    );
  };

  // Custom styles for react-select
  const customSelectStyles = {
    control: (base, state) => ({
      ...base,
      minHeight: '40px',
      borderRadius: '8px',
      border: '2px solid #e2e8f0',
      boxShadow: state.isFocused ? '0 0 0 3px rgba(66, 153, 225, 0.1)' : 'none',
      borderColor: state.isFocused ? '#4299e1' : '#e2e8f0',
      '&:hover': { borderColor: state.isFocused ? '#4299e1' : '#cbd5e0' },
      backgroundColor: state.isDisabled ? '#f7fafc' : 'white',
    }),
    valueContainer: (base) => ({ ...base, padding: '0 12px' }),
    input: (base) => ({ ...base, margin: 0, padding: 0 }),
    placeholder: (base) => ({ ...base, color: '#a0aec0', fontSize: '14px' }),
    singleValue: (base) => ({ ...base, fontSize: '14px', color: '#2d3748' }),
    menu: (base) => ({ ...base, borderRadius: '8px', zIndex: 9999 }),
    option: (base, state) => ({
      ...base,
      fontSize: '14px',
      padding: '10px 12px',
      backgroundColor: state.isSelected ? '#4299e1' : state.isFocused ? '#ebf8ff' : 'white',
      color: state.isSelected ? 'white' : '#2d3748',
    }),
  };

  return (
    <div>
      {setshowloader && <PatrolLoader />}
      
      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideIn { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }
        .glow-button { background: linear-gradient(135deg, #b1ea66ff 0%, #6ea24bff 100%); color: white; border: none; padding: 5px 10px; border-radius: 4px; font-weight: 600; cursor: pointer; transition: all 0.3s ease; box-shadow: 0 4px 6px rgba(50, 50, 93, 0.11), 0 1px 3px rgba(0, 0, 0, 0.08); }
        .glow-button:hover { transform: translateY(-2px); box-shadow: 0 7px 14px rgba(50, 50, 93, 0.1), 0 3px 6px rgba(0, 0, 0, 0.08); }
        .glow-button:disabled { opacity: 0.6; cursor: not-allowed; transform: none; box-shadow: none; }
        .stats-card { background: linear-gradient(135deg, #66ea99ff 0%, #9ca24bff 100%); color: white; border-radius: 6px; padding: 10px; box-shadow: 0 10px 20px rgba(102, 126, 234, 0.15); transition: all 0.3s ease; }
        .stats-card:hover { transform: translateY(-5px); box-shadow: 0 15px 30px rgba(102, 126, 234, 0.25); }
        .patrol-card { background: white; border-radius: 5px; padding: 16px; margin-bottom: 6px; border: 2px solid #e2e8f0; transition: all 0.3s ease; cursor: pointer; }
        .patrol-card:hover { border-color: #9e8122ff; transform: translateY(-3px); box-shadow: 0 10px 20px rgba(66, 153, 225, 0.15); }
        .patrol-card.active { border-color: #93bb48ff; background: linear-gradient(135deg, #f0fff4 0%, #c6f6d5 100%); }
        .image-card { border-radius: 8px; overflow: hidden; border: 2px solid #e2e8f0; transition: all 0.3s ease; }
        .image-card:hover { border-color: #c9e142ff; transform: scale(1.05); }
        .modal-overlay { animation: fadeIn 0.3s ease-out; }
        .modal-content { animation: slideIn 0.3s ease-out; }
        .mode-toggle { display: flex; gap: 10px; margin-bottom: 20px; }
        .mode-button { padding: 10px 20px; border: 2px solid #e2e8f0; border-radius: 8px; cursor: pointer; font-weight: 600; transition: all 0.3s ease; }
        .mode-button.active { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-color: transparent; }
      `}</style>

      {/* Image Preview Modal - Same as before */}
      {selectedImage && (
        <div
          style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            display: "flex", justifyContent: "center", alignItems: "center",
            zIndex: 9999, padding: "5px", fontFamily: "arial"
          }}
          onClick={(e) => { if (e.target === e.currentTarget) { setSelectedImage(null); setShowPatrolModal(true); setImageRotation(0); setImageScale(1); } }}
        >
          <button
            style={{
              position: "absolute", top: "20px", right: "370px",
              background: "rgba(255,255,255,0.9)", border: "none", borderRadius: "50%",
              width: "50px", height: "50px", fontSize: "24px", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)", zIndex: 10000,
            }}
            onClick={(e) => { e.stopPropagation(); setSelectedImage(null); setShowPatrolModal(true); setImageRotation(0); setImageScale(1); }}
          >
            <CloseCircleOutlined />
          </button>

          {patrolDetails?.images && (
            <div style={{
              position: "absolute", top: "20px", left: "20px",
              background: "rgba(0,0,0,0.7)", color: "white", padding: "8px 16px",
              borderRadius: "20px", fontSize: "14px", fontWeight: "600", zIndex: 10000, fontFamily: "arial"
            }}>
              Image {patrolDetails.images.findIndex(img => img.image_data === selectedImage) + 1} / {patrolDetails.images.length}
            </div>
          )}

          <div style={{
            position: "absolute", bottom: "30px", left: "50%", transform: "translateX(-50%)",
            display: "flex", gap: "10px", background: "rgba(0,0,0,0.7)", padding: "10px 20px",
            borderRadius: "30px", zIndex: 10000, alignItems: "center",
          }}>
            <button onClick={(e) => { e.stopPropagation(); setImageScale(prev => Math.max(0.5, prev - 0.25)); }}><ZoomOutOutlined /></button>
            <button onClick={(e) => { e.stopPropagation(); setImageRotation(prev => prev - 90); }}><RotateLeftOutlined /></button>
            <button onClick={(e) => { e.stopPropagation(); setImageRotation(0); setImageScale(1); }}><UndoOutlined /></button>
            <button onClick={(e) => { e.stopPropagation(); setImageRotation(prev => prev + 90); }}><RotateRightOutlined /></button>
            <button onClick={(e) => { e.stopPropagation(); setImageScale(prev => Math.min(3, prev + 0.25)); }}><ZoomInOutlined /></button>
            <div style={{ marginLeft: "10px", color: "white", fontSize: "14px", fontWeight: "600", minWidth: "50px", textAlign: "center" }}>
              {Math.round(imageScale * 100)}%
            </div>
          </div>

          <div style={{ position: "relative", maxWidth: "90%", maxHeight: "90%", display: "flex", justifyContent: "center", alignItems: "center" }}>
            <img
              src={getImageUrl(selectedImage)}
              alt="Preview"
              style={{
                maxWidth: "100%", maxHeight: "100%", objectFit: "contain",
                borderRadius: "8px", boxShadow: "0 25px 50px rgba(0, 0, 0, 0.5)",
                transform: `rotate(${imageRotation}deg) scale(${imageScale})`,
                transition: "transform 0.3s ease", transformOrigin: "center center",
              }}
              onClick={(e) => e.stopPropagation()}
              onWheel={(e) => { e.stopPropagation(); e.preventDefault(); setImageScale(prev => Math.max(0.1, Math.min(5, prev + (e.deltaY > 0 ? -0.1 : 0.1)))); }}
            />
          </div>

          {patrolDetails?.images?.length > 1 && (
            <>
              <button
                style={{ position: "absolute", left: "370px", top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,0.9)", border: "none", borderRadius: "50%", width: "50px", height: "50px", cursor: "pointer", zIndex: 10000 }}
                onClick={(e) => {
                  e.stopPropagation();
                  const idx = patrolDetails.images.findIndex(img => img.image_data === selectedImage);
                  const prev = (idx - 1 + patrolDetails.images.length) % patrolDetails.images.length;
                  setSelectedImage(patrolDetails.images[prev].image_data);
                  setImageRotation(0); setImageScale(1);
                }}
              ><ArrowBackIcon /></button>
              <button
                style={{ position: "absolute", right: "370px", top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,0.9)", border: "none", borderRadius: "50%", width: "50px", height: "50px", cursor: "pointer", zIndex: 10000 }}
                onClick={(e) => {
                  e.stopPropagation();
                  const idx = patrolDetails.images.findIndex(img => img.image_data === selectedImage);
                  const next = (idx + 1) % patrolDetails.images.length;
                  setSelectedImage(patrolDetails.images[next].image_data);
                  setImageRotation(0); setImageScale(1);
                }}
              ><ArrowForwardIcon /></button>
            </>
          )}
        </div>
      )}

      {/* Patrol Details Modal - Same as before */}
      {showPatrolModal && patrolDetails && !selectedImage && (
        <div className="modal-overlay" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, fontFamily: "arial" }} onClick={closePatrolModal}>
          <div className="modal-content" style={{ backgroundColor: "white", borderRadius: "12px", width: "90%", maxWidth: "800px", maxHeight: "60vh", overflow: "auto", position: "relative", boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "10px", borderBottom: "1px solid #f0f0f0", display: "flex", justifyContent: "space-between", alignItems: "center", background: "linear-gradient(135deg, #00c853 0%, #bcc758ff 100%)", color: "white", borderRadius: "12px 12px 0 0" }}>
              <h2 style={{ fontSize: "24px", fontWeight: "600", margin: 0 }}>{language === "gu" ? "પેટ્રોલ વિગતો" : "Patrol Details"}</h2>
              <button onClick={closePatrolModal} style={{ background: "rgba(255,255,255,0.2)", border: "none", fontSize: "20px", cursor: "pointer", color: "white", width: "40px", height: "40px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            </div>
            <div style={{ padding: "10px" }}>
              {loading.patrol ? (
                <div style={{ textAlign: "center", padding: "40px" }}><div style={{ border: "4px solid #f3f3f3", borderTop: "4px solid #2ada2aff", borderRadius: "50%", width: "60px", height: "60px", animation: "spin 1s linear infinite", margin: "0 auto 10px" }} /><p>Loading...</p></div>
              ) : (
                <>
                  <div style={{ backgroundColor: "#fff", borderRadius: "10px", padding: "10px", marginBottom: "10px", border: "1px solid #e2e8f0" }}>
                    <div style={{ display: "flex", alignItems: "center", marginBottom: "10px", borderBottom: "2px solid #e1bc42ff" }}>
                      <div style={{ backgroundColor: "#9ce142ff", width: "40px", height: "40px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", marginRight: "12px", color: "white" }}><UserOutlined /></div>
                      <h3 style={{ margin: 0, fontSize: "20px", color: "#2d3748" }}>Patrol Information</h3>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "15px" }}>
                      <div><label>Patrol Officer</label><div>{patrolDetails.patrol_officer_name || "N/A"}</div></div>
                      <div><label>Patrol ID</label><div>{patrolDetails.patrol_id}</div></div>
                      <div><label>Distance</label><div>{patrolDetails.distance_kms ? `${Number(patrolDetails.distance_kms).toFixed(2)} km` : "N/A"}</div></div>
                      <div><label>Patrol Type</label><div>{patrolDetails.type_name}</div></div>
                    </div>
                    {patrolDetails.note && (
                      <div style={{ marginTop: "20px" }}>
                        <label>Notes</label>
                        <div>{patrolDetails.note}</div>
                      </div>
                    )}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "15px", marginTop: "20px" }}>
                      <div><label><CalendarOutlined /> Date</label><div>{new Date(patrolDetails.start_time).toLocaleDateString()}</div></div>
                      <div><label><ClockCircleOutlined /> Start Time</label><div>{formatDateTime(patrolDetails.start_time)}</div></div>
                      <div><label><ClockCircleOutlined /> End Time</label><div>{formatDateTime(patrolDetails.end_time)}</div></div>
                      <div><label>Duration</label><div>{formatDuration(patrolDetails.start_time, patrolDetails.end_time)}</div></div>
                    </div>
                  </div>

                  {patrolDetails.images?.length > 0 && (
                    <div style={{ backgroundColor: "#fff", borderRadius: "10px", padding: "10px", border: "1px solid #e2e8f0" }}>
                      <div style={{ display: "flex", alignItems: "center", marginBottom: "10px", borderBottom: "2px solid #4299e1" }}>
                        <div style={{ backgroundColor: "#4299e1", width: "40px", height: "40px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", marginRight: "6px", color: "white" }}><PictureOutlined /></div>
                        <h3 style={{ margin: 0, fontSize: "20px", color: "#2d3748" }}>Patrol Images ({patrolDetails.images.length})</h3>
                      </div>
                      <Image.PreviewGroup>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "15px" }}>
                          {patrolDetails.images.map((image, index) => (
                            <div key={index} className="image-card" style={{ border: "2px solid #e2e8f0", borderRadius: "8px", overflow: "hidden", cursor: "pointer", position: "relative" }} onClick={() => { setSelectedImage(image.image_data); setShowPatrolModal(false); setImageRotation(0); setImageScale(1); }}>
                              <div style={{ width: "100%", height: "140px", overflow: "hidden", position: "relative" }}>
                                <Image width="100%" height="100%" style={{ objectFit: "cover" }} src={getImageUrl(image.image_data)} alt={`Image ${index + 1}`} preview={{ mask: <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "white" }}><SearchOutlined style={{ fontSize: "20px", marginBottom: "5px" }} /><span>View</span></div> }} />
                                <div style={{ position: "absolute", top: "8px", right: "8px", backgroundColor: "rgba(0,0,0,0.7)", color: "white", fontSize: "12px", padding: "1px 4px", borderRadius: "4px", zIndex: 1 }}>{index + 1}</div>
                              </div>
                              <div style={{ padding: "5px", backgroundColor: "#f8fafc", textAlign: "center" }}>{image.image_category || "Uncategorized"}</div>
                            </div>
                          ))}
                        </div>
                      </Image.PreviewGroup>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Container */}
      <div style={{ padding: "20px", fontFamily: "arial" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "30px" }}>
          <div>
            <h1 style={{ fontSize: "32px", fontWeight: "700", marginBottom: "8px", background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              {language === "gu" ? "પેટ્રોલ કવરેજ વિશ્લેષણ" : "Patrol Coverage Analysis"}
            </h1>
          </div>
        </div>

        {/* Mode Toggle */}
        <div className="mode-toggle">
          <button
            className={`mode-button ${selectionMode === 'beat' ? 'active' : ''}`}
            onClick={() => toggleSelectionMode('beat')}
          >
            {language === "gu" ? "બીટ દ્વારા" : "By Beat"}
          </button>
          <button
            className={`mode-button ${selectionMode === 'boundary' ? 'active' : ''}`}
            onClick={() => toggleSelectionMode('boundary')}
          >
            {language === "gu" ? "બાઉન્ડ્રી દ્વારા" : "By Boundary"}
          </button>
        </div>

        {/* Selection Card */}
        <div style={{ backgroundColor: "#fff", borderRadius: "12px", padding: "25px", marginBottom: "25px", border: "1px solid #e2e8f0", boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.05)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "20px", flexWrap: "wrap" }}>
            
            {selectionMode === 'beat' ? (
              /* Beat Selection (Division → Range → Round → Beat) */
              <>
                {/* Division Dropdown */}
                <div style={{ width: "200px" }}>
                  <label style={{ display: "block", fontWeight: "600", marginBottom: "10px", fontSize: "14px", color: "#2d3748", textTransform: "uppercase" }}>
                    {language === "gu" ? "ડિવિઝન" : "Division"}
                  </label>
                  <Select
                    value={selectedDivision}
                    onChange={handleDivisionChange}
                    options={divisions}
                    isSearchable
                    isClearable
                    placeholder={loading.divisions ? "Loading..." : "Select Division"}
                    isLoading={loading.divisions}
                    styles={customSelectStyles}
                    noOptionsMessage={() => "No divisions available"}
                  />
                </div>

                {/* Range Dropdown */}
                <div style={{ width: "200px" }}>
                  <label style={{ display: "block", fontWeight: "600", marginBottom: "10px", fontSize: "14px", color: "#2d3748", textTransform: "uppercase" }}>
                    {language === "gu" ? "રેંજ" : "Range"}
                  </label>
                  <Select
                    value={selectedRange}
                    onChange={handleRangeChange}
                    options={ranges}
                    isSearchable
                    isClearable
                    placeholder={loading.ranges ? "Loading..." : "Select Range"}
                    isLoading={loading.ranges}
                    styles={customSelectStyles}
                    noOptionsMessage={() => "No ranges available"}
                    isDisabled={!selectedDivision}
                  />
                </div>

                {/* Round Dropdown */}
                <div style={{ width: "200px" }}>
                  <label style={{ display: "block", fontWeight: "600", marginBottom: "10px", fontSize: "14px", color: "#2d3748", textTransform: "uppercase" }}>
                    {language === "gu" ? "રાઉન્ડ" : "Round"}
                  </label>
                  <Select
                    value={selectedRound}
                    onChange={handleRoundChange}
                    options={rounds}
                    isSearchable
                    isClearable
                    placeholder={loading.rounds ? "Loading..." : "Select Round"}
                    isLoading={loading.rounds}
                    styles={customSelectStyles}
                    noOptionsMessage={() => "No rounds available"}
                    isDisabled={!selectedRange}
                  />
                </div>

                {/* Beat Dropdown */}
                <div style={{ width: "200px" }}>
                  <label style={{ display: "block", fontWeight: "600", marginBottom: "10px", fontSize: "14px", color: "#2d3748", textTransform: "uppercase" }}>
                    {language === "gu" ? "બીટ" : "Beat"}
                  </label>
                  <Select
                    value={selectedBeat}
                    onChange={handleBeatChange}
                    options={beats}
                    isSearchable
                    isClearable
                    placeholder={loading.beats ? "Loading..." : "Select Beat"}
                    isLoading={loading.beats}
                    styles={customSelectStyles}
                    noOptionsMessage={() => "No beats available"}
                    isDisabled={!selectedRound}
                  />
                </div>
              </>
            ) : (
              /* Boundary Selection */
              <div style={{ width: "300px" }}>
                <label style={{ display: "block", fontWeight: "600", marginBottom: "10px", fontSize: "14px", color: "#2d3748", textTransform: "uppercase" }}>
                  {language === "gu" ? "બાઉન્ડ્રી" : "Boundary"}
                </label>
                <Select
                  value={selectedBoundary}
                  onChange={handleBoundaryChange}
                  options={boundaries}
                  isSearchable
                  isClearable
                  placeholder={loading.boundaries ? "Loading boundaries..." : "Select Boundary..."}
                  isLoading={loading.boundaries}
                  styles={customSelectStyles}
                  noOptionsMessage={() => "No boundaries available"}
                />
              </div>
            )}

            {/* Month Picker */}
            <div style={{ width: "200px" }}>
              <label style={{ display: "block", fontWeight: "600", marginBottom: "10px", fontSize: "14px", color: "#2d3748", textTransform: "uppercase" }}>
                {language === "gu" ? "મહિનો" : "Month"}
              </label>
              <input
                type="month"
                value={selectedMonth}
                onChange={handleMonthChange}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "2px solid #e2e8f0",
                  fontSize: "14px",
                  outline: "none",
                  transition: "all 0.2s ease",
                }}
              />
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", gap: "12px", marginTop: "10px", marginLeft: "auto" }}>
              <button
                className="glow-button"
                onClick={fetchCoverageData}
                disabled={
                  (selectionMode === 'beat' && !selectedBeat) ||
                  (selectionMode === 'boundary' && !selectedBoundary) ||
                  !selectedMonth || 
                  loading.coverage
                }
                style={{ fontFamily: "arial", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "12px 24px", marginLeft: "auto" }}
              >
                {loading.coverage ? (
                  <>
                    <div style={{ border: "2px solid rgba(255,255,255,0.3)", borderTop: "2px solid white", borderRadius: "50%", width: "20px", height: "20px", animation: "spin 1s linear infinite" }} />
                    {language === "gu" ? "વિશ્લેષણ કરી રહ્યા છીએ..." : "Analyzing..."}
                  </>
                ) : (
                  <>
                    <EyeOutlined />
                    {language === "gu" ? "કવરેજ વિશ્લેષણ કરો" : "Analyze Coverage"}
                  </>
                )}
              </button>
              <button
                onClick={resetData}
                disabled={loading.coverage}
                style={{ padding: "12px 24px", borderRadius: "8px", border: "2px solid #e2e8f0", fontSize: "14px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "8px", backgroundColor: "white", color: "#4a5568", fontWeight: "600" }}
              >
                {language === "gu" ? "રીસેટ" : "Reset"}
              </button>
            </div>
          </div>
        </div>

        {/* Loading indicator */}
        {loading.coverage && (
          <div style={{ textAlign: "center", padding: "60px" }}>
            <div style={{ border: "6px solid #f3f3f3", borderTop: "6px solid #4299e1", borderRadius: "50%", width: "80px", height: "80px", animation: "spin 1s linear infinite", margin: "0 auto 20px" }} />
            <p style={{ color: "#718096", fontSize: "18px" }}>Loading coverage data...</p>
          </div>
        )}

        {/* Coverage Data Display */}
        {coverageData && !loading.coverage && (
          <div style={{ backgroundColor: "#fff", borderRadius: "12px", padding: "25px", border: "1px solid #e2e8f0", boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.05)" }}>
            {/* Summary Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "20px", marginBottom: "30px" }}>
              <div className="stats-card">
                <p style={{ fontSize: "14px", margin: "0 0 12px 0", opacity: 0.9 }}>
                  {selectionMode === 'beat' ? "Beat" : "Boundary"}
                </p>
                <div style={{ display: "inline-block", padding: "8px 20px", borderRadius: "20px", backgroundColor: "rgba(255,255,255,0.2)", border: "2px solid rgba(255,255,255,0.3)", fontSize: "18px", fontWeight: "600", backdropFilter: "blur(10px)" }}>
                  {selectionMode === 'beat' ? selectedBeat.label : selectedBoundary.label}
                </div>
              </div>
              <div className="stats-card" style={{ background: "linear-gradient(135deg, #fbdf93ff 0%, #b8f557ff 100%)" }}>
                <p style={{ fontSize: "14px", margin: "0 0 12px 0", opacity: 0.9 }}>
                  {selectionMode === 'beat' ? "Beat Area" : "Boundary Area"}
                </p>
                <h3 style={{ margin: "0", fontSize: "28px", fontWeight: "700" }}>
                  {(Number(selectionMode === 'beat' ? coverageData.coupe_area_sq_m : coverageData.boundary_area_sq_m) / 1000000).toFixed(2)} km²
                </h3>
                <p style={{ fontSize: "12px", margin: "8px 0 0 0", opacity: 0.8 }}>
                  {Number(selectionMode === 'beat' ? coverageData.coupe_area_sq_m : coverageData.boundary_area_sq_m).toLocaleString()} m²
                </p>
              </div>
              <div className="stats-card" style={{ background: "linear-gradient(135deg, #fec14fff 0%, #6fb834ff 100%)" }}>
                <p style={{ fontSize: "14px", margin: "0 0 12px 0", opacity: 0.9 }}>Patrol Covered Area</p>
                <h3 style={{ margin: "0", fontSize: "28px", fontWeight: "700" }}>
                  {(Number(coverageData.patrol_area_sq_m) / 1000000).toFixed(2)} km²
                </h3>
                <p style={{ fontSize: "12px", margin: "8px 0 0 0", opacity: 0.8 }}>
                  {Number(coverageData.patrol_area_sq_m).toLocaleString()} m²
                </p>
              </div>
              <div className="stats-card" style={{ background: coverageData.coverage_percentage > 70 ? "linear-gradient(135deg, #e9e643ff 0%, #f93838ff 100%)" : coverageData.coverage_percentage > 40 ? "linear-gradient(135deg, #f8fa70ff 0%, #8cfe40ff 100%)" : "linear-gradient(135deg, #ffb108ff 0%, #dbff99ff 100%)" }}>
                <p style={{ fontSize: "14px", margin: "0 0 12px 0", opacity: 0.9 }}>Coverage</p>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <h3 style={{ margin: "0", fontSize: "36px", fontWeight: "700" }}>
                    {Number(coverageData.coverage_percentage).toFixed(2)}%
                  </h3>
                  <div style={{ width: "60px", height: "60px", borderRadius: "25%", backgroundColor: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", border: "3px solid rgba(255,255,255,0.3)" }}>
                    <span style={{ fontSize: "24px" }}>
                      {coverageData.coverage_percentage > 70 ? "✓" : coverageData.coverage_percentage > 40 ? "⚡" : "⚠"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Export Button */}
            <button className="glow-button" onClick={exportToExcel} style={{ marginBottom: "30px", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", padding: "12px 30px" }}>
              <DownloadOutlined /> {language === "gu" ? "એક્સેલમાં નિકાલ કરો" : "Export to Excel"}
            </button>

            {/* Patrols List */}
            {patrols.length > 0 ? (
              <div style={{ marginTop: "20px" }}>
                <h3 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "20px", color: "#2d3748", display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ backgroundColor: "#a5e06eff", color: "white", width: "32px", height: "32px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px" }}>
                    {patrols.length}
                  </span>
                  {language === "gu" 
                    ? `આ ${selectionMode === 'beat' ? "બીટ" : "બાઉન્ડ્રી"}ની અંદરના પેટ્રોલ`
                    : `Patrols Inside This ${selectionMode === 'beat' ? "Beat" : "Boundary"}`
                  }
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "15px" }}>
                  {patrols.map((patrol, index) => (
                    <div key={patrol.patrol_id || index} className={`patrol-card ${selectedPatrol === patrol.patrol_id ? 'active' : ''}`} onClick={() => fetchPatrolDetails(patrol.patrol_id)}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <p style={{ fontWeight: "700", margin: "0 0 8px 0", fontSize: "16px", color: selectedPatrol === patrol.patrol_id ? "#276749" : "#2d3748" }}>
                            Patrol #{patrol.patrol_id}
                          </p>
                          {patrol.patrol_type && (
                            <span style={{ display: "inline-block", padding: "4px 12px", borderRadius: "12px", fontSize: "12px", fontWeight: "600", backgroundColor: patrol.patrol_type === "Day" ? "#ebf8ff" : "#faf5ff", color: patrol.patrol_type === "Day" ? "#2b6cb0" : "#6b46c1", border: `1px solid ${patrol.patrol_type === "Day" ? "#bee3f8" : "#e9d8fd"}` }}>
                              {patrol.patrol_type} Patrol
                            </span>
                          )}
                        </div>
                        <div style={{ backgroundColor: selectedPatrol === patrol.patrol_id ? "#48bb78" : "#d0eb5bff", color: "white", width: "32px", height: "32px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: "600" }}>
                          {index + 1}
                        </div>
                      </div>
                      {patrol.start_time && (
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #e2e8f0" }}>
                          <CalendarOutlined style={{ color: "#a0aec0" }} />
                          <span style={{ fontSize: "12px", color: "#718096" }}>{new Date(patrol.start_time).toLocaleDateString()}</span>
                        </div>
                      )}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px" }}>
                        <span style={{ fontSize: "11px", color: "#a0aec0", fontStyle: "italic" }}>Click to view details</span>
                        <span style={{ fontSize: "20px", color: selectedPatrol === patrol.patrol_id ? "#48bb78" : "#4299e1" }}>→</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div> 
            ) : (
              <div style={{ textAlign: "center", padding: "40px", backgroundColor: "#fff", borderRadius: "12px", border: "2px dashed #e2e8f0" }}>
                <div style={{ width: "60px", height: "60px", backgroundColor: "#fed7d7", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", color: "#e53e3e", fontSize: "24px" }}>⚡</div>
                <p style={{ color: "#718096", fontSize: "16px", fontWeight: "500" }}>
                  {language === "gu" 
                    ? `આ ${selectionMode === 'beat' ? "બીટ" : "બાઉન્ડ્રી"}ની અંદર કોઈ પેટ્રોલ મળ્યા નથી`
                    : `No patrols found inside this ${selectionMode === 'beat' ? "beat" : "boundary"}`
                  }
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BeatPatrolCoverage;
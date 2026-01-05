import React, { useEffect, useState } from "react";
import { 
  CloseOutlined, 
  DownloadOutlined, 
  EyeOutlined,
  CalendarOutlined,
  UserOutlined,
  ClockCircleOutlined,
  PictureOutlined,
  CloseCircleOutlined,
  SearchOutlined,
  RotateLeftOutlined,
  RotateRightOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  UndoOutlined
} from "@ant-design/icons";
import axios from "axios";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { MapContainer, TileLayer, Polyline, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "./RouterMap.css";
import { API_BASE_URL } from "../config";
import Select from 'react-select';
import { Image } from 'antd';

// Helper function to parse WKT (Well-Known Text) geometry to lat/lng array
const parseGeomCoordinates = (geom) => {
  if (!geom) return [];
  try {
    return geom
      .split(",")
      .map(coord => {
        const [lat, lng] = coord.trim().split(" ").map(Number);
        return [lat, lng];
      })
      .filter(([lat, lng]) => !isNaN(lat) && !isNaN(lng));
  } catch (error) {
    console.error("Error parsing geom coordinates:", error, geom);
    return [];
  }
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
)

const BeatPatrolCoverage = ({ language, setShowMapRoute, showmaproute }) => {
  const [forestTypes, setForestTypes] = useState([]);
  const [selectedForest, setSelectedForest] = useState(null);
  const [hierarchyData, setHierarchyData] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [ranges, setRanges] = useState([]);
  const [beats, setBeats] = useState([]);
  
  const [selectedDivision, setSelectedDivision] = useState(null);
  const [selectedRange, setSelectedRange] = useState(null);
  const [selectedBeat, setSelectedBeat] = useState(null);
  
  const [loading, setLoading] = useState({
    forest: false,
    divisions: false,
    coverage: false,
    patrol: false
  });
  const [coverageData, setCoverageData] = useState(null);
  const [patrolLines, setPatrolLines] = useState([]);
  const [selectedPatrol, setSelectedPatrol] = useState(null);
  const [patrolDetails, setPatrolDetails] = useState(null);
  const [showPatrolModal, setShowPatrolModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [setshowloader, setSetShowLoader] = useState(false);
  const [imageRotation, setImageRotation] = useState(0);
  const [imageScale, setImageScale] = useState(1);

  /* =========================
     Fetch Forest Types on mount
  ========================= */
  useEffect(() => {
    const fetchForestTypes = async () => {
      setLoading(prev => ({ ...prev, forest: true }));
      try {
        const response = await axios.get(`${API_BASE_URL}/api/forest-types`);
        setForestTypes(response.data);
      } catch (error) {
        console.error("Error fetching forest types:", error);
        alert("Failed to load forest types");
      } finally {
        setLoading(prev => ({ ...prev, forest: false }));
      }
    };
    
    fetchForestTypes();
  }, []);

  /* =========================
     Handle Forest Selection
  ========================= */
  const handleForestChange = async (e) => {
    const forestId = e.target.value;
    setSelectedForest(forestId);
    
    // Reset all selections
    setSelectedDivision(null);
    setSelectedRange(null);
    setSelectedBeat(null);
    setDivisions([]);
    setRanges([]);
    setBeats([]);
    setHierarchyData([]);
    setCoverageData(null);
    setPatrolLines([]);
    setSelectedPatrol(null);
    setPatrolDetails(null);
    setShowPatrolModal(false);
    setSelectedImage(null);
    setImageRotation(0);
    setImageScale(1);
    
    if (!forestId) return;
    
    setLoading(prev => ({ ...prev, divisions: true }));
    try {
      const response = await axios.post(`${API_BASE_URL}/api/get-divisions`, {
        forest_id: forestId,
      });
      
      if (Array.isArray(response.data)) {
        // Extract unique divisions
        const uniqueDivisions = [...new Set(response.data.map(item => item.DIVISION))];
        setDivisions(uniqueDivisions.map(div => ({
          value: div,
          label: div
        })));
        
        // Reset ranges and beats
        setRanges([]);
        setBeats([]);
      } else {
        console.error("Unexpected hierarchy response format:", response.data);
        alert("Unexpected data format from server");
        setHierarchyData([]);
        setDivisions([]);
      }
    } catch (error) {
      console.error("Error fetching hierarchy:", error);
      alert("Failed to load hierarchy data");
      setHierarchyData([]);
      setDivisions([]);
    } finally {
      setLoading(prev => ({ ...prev, divisions: false }));
    }
  };

  /* =========================
     Handle Division Selection
  ========================= */
  const handleDivisionChange = async (selectedOption) => {
    setSelectedDivision(selectedOption);
    setSelectedRange(null);
    setSelectedBeat(null);
    setRanges([]);
    setBeats([]);
    setSelectedImage(null);
    setImageRotation(0);
    setImageScale(1);
    
    if (!selectedOption) return;

    let divisionname = selectedOption.value;
    
    try {
        const response = await axios.post(`${API_BASE_URL}/api/hierarchy`, {
            forest_id: selectedForest,
            division_name: divisionname
        });
        
        // FIRST: Set the hierarchy data
        setHierarchyData(response.data);
        
        // THEN: Filter ranges based on the response data
        const divisionRanges = response.data
            .filter(item => item.DIVISION === selectedOption.value)
            .map(item => item.RANGE);
        
        const uniqueRanges = [...new Set(divisionRanges)];
        setRanges(uniqueRanges.map(range => ({
            value: range,
            label: range
        })));
        
    } catch (error) {
        console.error("Error fetching hierarchy:", error);
        alert("Failed to load hierarchy data");
        setHierarchyData([]);
        setRanges([]);
    }
  };

  /* =========================
     Handle Range Selection
  ========================= */
  const handleRangeChange = (selectedOption) => {
    setSelectedRange(selectedOption);
    setSelectedBeat(null);
    setBeats([]);
    setSelectedImage(null);
    setImageRotation(0);
    setImageScale(1);
    
    if (!selectedOption || !hierarchyData.length || !selectedDivision) return;
    
    // Filter beats based on selected division and range
    const divisionBeats = hierarchyData
      .filter(item => 
        item.DIVISION === selectedDivision.value && 
        item.RANGE === selectedOption.value
      )
      .map(item => item.BEAT);
    
    const uniqueBeats = [...new Set(divisionBeats)];
    setBeats(uniqueBeats.map(beat => ({
      value: beat,
      label: beat
    })));
  };

  /* =========================
     Handle Beat Selection
  ========================= */
  const handleBeatChange = (selectedOption) => {
    setSelectedBeat(selectedOption);
    setCoverageData(null);
    setPatrolLines([]);
    setSelectedPatrol(null);
    setPatrolDetails(null);
    setShowPatrolModal(false);
    setSelectedImage(null);
    setImageRotation(0);
    setImageScale(1);
  };

  /* =========================
     Fetch Beat Patrol Coverage
  ========================= */
  const fetchCoverageData = async () => {
    if (!selectedBeat) {
      alert("Please select a beat first");
      return;
    }
    
    setLoading(prev => ({ ...prev, coverage: true }));
    setSelectedImage(null);
    setImageRotation(0);
    setImageScale(1);
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/beat-patrol-coverage`,
        { 
          beat: selectedBeat.value,
          forest_id: selectedForest,
          division: selectedDivision?.value,
          range: selectedRange?.value
        }
      );

      if (res.data.success) {
        setCoverageData(res.data.data);

        if (res.data.data.patrols_covering_beat && res.data.data.patrols_covering_beat.length > 0) {
          const lines = res.data.data.patrols_covering_beat.map((p) =>
            parseGeomCoordinates(p.patrol_geom)
          ).filter(line => line.length > 0);
          setPatrolLines(lines);
        } else {
          setPatrolLines([]);
        }
        
      } else {
        alert(res.data.message || "No coverage data found");
      }
    } catch (err) {
      console.error("Error fetching patrol coverage:", err);
      alert("Failed to load patrol coverage data");
    } finally {
      setLoading(prev => ({ ...prev, coverage: false }));
    }
  };

  /* =========================
     Fetch Patrol Details
  ========================= */
  const fetchPatrolDetails = async (patrolId) => {
    setLoading(prev => ({ ...prev, patrol: true }));
    setSetShowLoader(true);
    setSelectedImage(null);
    setImageRotation(0);
    setImageScale(1);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/patrols/${patrolId}`);
      
      if (response.data && response.data.data) {
        setPatrolDetails(response.data.data);
        setSelectedPatrol(patrolId);
        setShowPatrolModal(true);
      } else {
        console.error("Unexpected patrol details response structure:", response.data);
        alert("Failed to load patrol details: Invalid data format");
      }
    } catch (error) {
      console.error("Error fetching patrol details:", error);
      alert("Failed to load patrol details. Please try again.");
    } finally {
      setLoading(prev => ({ ...prev, patrol: false }));
    }
    setSetShowLoader(false);
  };

  /* =========================
     Close Patrol Modal
  ========================= */
  const closePatrolModal = () => {
    setShowPatrolModal(false);
    setSelectedPatrol(null);
    setPatrolDetails(null);
    setSelectedImage(null);
    setImageRotation(0);
    setImageScale(1);
  };

  /* =========================
     Export to Excel
  ========================= */
  const exportToExcel = () => {
    if (!coverageData) return;

    const summaryData = [
      {
        "Beat": coverageData.beat_name,
        "Beat Area (sq m)": coverageData.beat_area_sq_m,
        "Patrol Covered Area (sq m)": coverageData.patrol_beat_area_sq_m,
        "Coverage %": coverageData.coverage_percentage,
      },
    ];

    const patrolData = coverageData.patrols_covering_beat.map((patrol) => ({
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

    /* ------------------ Coverage Summary Sheet ------------------ */
    const summarySheet = XLSX.utils.json_to_sheet(summaryData);

    // Header style
    const headerStyle = {
      font: { bold: true },
      fill: { fgColor: { rgb: "D9E1F2" } },
      alignment: { horizontal: "center", vertical: "center" }
    };

    // Apply header styles
    const summaryHeaders = Object.keys(summaryData[0]);
    summaryHeaders.forEach((_, i) => {
      const cellRef = XLSX.utils.encode_cell({ r: 0, c: i });
      summarySheet[cellRef].s = headerStyle;
    });

    // Column widths
    summarySheet["!cols"] = [
      { wch: 25 },
      { wch: 20 },
      { wch: 28 },
      { wch: 15 },
    ];

    // Number formats
    summarySheet["B2"].z = "#,##0";
    summarySheet["C2"].z = "#,##0";
    summarySheet["D2"].z = "0.00%";

    XLSX.utils.book_append_sheet(wb, summarySheet, "Coverage Summary");

    /* ------------------ Patrols Sheet ------------------ */
    if (patrolData.length > 0) {
      const patrolSheet = XLSX.utils.json_to_sheet(patrolData);

      const patrolHeaders = Object.keys(patrolData[0]);
      patrolHeaders.forEach((_, i) => {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c: i });
        patrolSheet[cellRef].s = headerStyle;
      });

      patrolSheet["!cols"] = [
        { wch: 15 },
        { wch: 22 },
        { wch: 22 },
        { wch: 15 },
        { wch: 25 },
        { wch: 18 },
        { wch: 30 },
        { wch: 30 },
      ];

      XLSX.utils.book_append_sheet(wb, patrolSheet, "Patrols");
    }

    /* ------------------ Export ------------------ */
    const excelBuffer = XLSX.write(wb, {
      bookType: "xlsx",
      type: "array",
      cellStyles: true
    });

    saveAs(
      new Blob([excelBuffer], { type: "application/octet-stream" }),
      `${selectedBeat.value}_patrol_coverage.xlsx`
    );
  };

  /* =========================
     Reset Selections
  ========================= */
  const handleReset = () => {
    setSelectedForest(null);
    setSelectedDivision(null);
    setSelectedRange(null);
    setSelectedBeat(null);
    setDivisions([]);
    setRanges([]);
    setBeats([]);
    setHierarchyData([]);
    setCoverageData(null);
    setPatrolLines([]);
    setSelectedPatrol(null);
    setPatrolDetails(null);
    setShowPatrolModal(false);
    setSelectedImage(null);
    setImageRotation(0);
    setImageScale(1);
  };

  /* =========================
     Format Date Time
  ========================= */
  const formatDateTime = (dateTime) => {
    if (!dateTime) return "N/A";
    return new Date(dateTime).toLocaleString();
  };

  /* =========================
     Format Duration
  ========================= */
  const formatDuration = (startTime, endTime) => {
    if (!startTime || !endTime) return "N/A";
    const start = new Date(startTime);
    const end = new Date(endTime);
    const durationMs = end - start;
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  /* =========================
     Get Image URL from Base64
  ========================= */
  const getImageUrl = (imageData) => {
    if (!imageData) return null;
    return `data:image/jpeg;base64,${imageData}`;
  };

  // Custom styles for React Select
  const customSelectStyles = {
    control: (base, state) => ({
      ...base,
      minHeight: '40px',
      borderRadius: '8px',
      border: '2px solid #e2e8f0',
      boxShadow: state.isFocused ? '0 0 0 3px rgba(66, 153, 225, 0.1)' : 'none',
      borderColor: state.isFocused ? '#4299e1' : '#e2e8f0',
      '&:hover': {
        borderColor: state.isFocused ? '#4299e1' : '#cbd5e0',
      },
      backgroundColor: state.isDisabled ? '#f7fafc' : 'white',
      transition: 'all 0.2s ease',
    }),
    valueContainer: (base) => ({
      ...base,
      padding: '0 12px',
    }),
    input: (base) => ({
      ...base,
      margin: 0,
      padding: 0,
    }),
    placeholder: (base) => ({
      ...base,
      color: '#a0aec0',
      fontSize: '14px',
    }),
    singleValue: (base) => ({
      ...base,
      fontSize: '14px',
      color: '#2d3748',
    }),
    menu: (base) => ({
      ...base,
      borderRadius: '8px',
      border: '1px solid #e2e8f0',
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      zIndex: 9999,
    }),
    menuList: (base) => ({
      ...base,
      padding: 0,
      maxHeight: '200px',
    }),
    option: (base, state) => ({
      ...base,
      fontSize: '14px',
      padding: '10px 12px',
      backgroundColor: state.isSelected ? '#4299e1' : state.isFocused ? '#ebf8ff' : 'white',
      color: state.isSelected ? 'white' : '#2d3748',
      cursor: 'pointer',
      '&:active': {
        backgroundColor: '#4299e1',
        color: 'white',
      },
    }),
    indicatorSeparator: (base) => ({
      ...base,
      backgroundColor: '#e2e8f0',
    }),
    dropdownIndicator: (base) => ({
      ...base,
      color: '#a0aec0',
      '&:hover': {
        color: '#718096',
      },
    }),
    loadingIndicator: (base) => ({
      ...base,
      color: '#4299e1',
    }),
    noOptionsMessage: (base) => ({
      ...base,
      fontSize: '14px',
      color: '#a0aec0',
    }),
  };

  return (
    <div className="router-map-container">
      {setshowloader && <PatrolLoader />}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .glow-button {
          background: linear-gradient(135deg, #b1ea66ff 0%, #6ea24bff 100%);
          color: white;
          border: none;
          padding: 5px 10px;
          border-radius: 4px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 4px 6px rgba(50, 50, 93, 0.11), 0 1px 3px rgba(0, 0, 0, 0.08);
        }
        .glow-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 7px 14px rgba(50, 50, 93, 0.1), 0 3px 6px rgba(0, 0, 0, 0.08);
        }
        .glow-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }
        .stats-card {
          background: linear-gradient(135deg, #66ea99ff 0%, #9ca24bff 100%);
          color: white;
          border-radius: 6px;
          padding: 10px;
          boxShadow: 0 10px 20px rgba(102, 126, 234, 0.15);
          transition: all 0.3s ease;
        }
        .stats-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 15px 30px rgba(102, 126, 234, 0.25);
        }
        .patrol-card {
          background: white;
          border-radius: 5px;
          padding: 16px;
          margin-bottom: 6px;
          border: 2px solid #e2e8f0;
          transition: all 0.3s ease;
          cursor: pointer;
        }
        .patrol-card:hover {
          border-color: #9e8122ff;
          transform: translateY(-3px);
          box-shadow: 0 10px 20px rgba(66, 153, 225, 0.15);
        }
        .patrol-card.active {
          border-color: #93bb48ff;
          background: linear-gradient(135deg, #f0fff4 0%, #c6f6d5 100%);
        }
        .image-card {
          border-radius: 8px;
          overflow: hidden;
          border: 2px solid #e2e8f0;
          transition: all 0.3s ease;
        }
        .image-card:hover {
          border-color: #c9e142ff;
          transform: scale(1.05);
        }
        .modal-overlay {
          animation: fadeIn 0.3s ease-out;
        }
        .modal-content {
          animation: slideIn 0.3s ease-out;
        }
        .custom-preview-mask {
          background: rgba(0, 0, 0, 0.5) !important;
          opacity: 0;
          transition: opacity 0.3s ease !important;
        }
        .image-card:hover .custom-preview-mask {
          opacity: 1 !important;
        }
      `}</style>
      
      {/* Image Preview Modal with Rotation Controls */}
      {selectedImage && (
        <div 
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            // backgroundColor: "rgba(0,0,0,0.95)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
            padding: "5px",
          }} 
          onClick={(e) => {
            // Only close if clicking on overlay (not on image or controls)
            if (e.target === e.currentTarget) {
              setSelectedImage(null);
              setShowPatrolModal(true);
              setImageRotation(0);
              setImageScale(1);
            }
          }}
        >
          {/* Close button - Top Right */}
          <button 
            style={{
              position: "absolute",
              top: "20px",
              right: "20px",
              background: "rgba(255,255,255,0.9)",
              border: "none",
              borderRadius: "50%",
              width: "50px",
              height: "50px",
              fontSize: "24px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)",
              transition: "all 0.3s ease",
              zIndex: 10000,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.1)";
              e.currentTarget.style.background = "#f56565";
              e.currentTarget.style.color = "white";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.background = "rgba(255,255,255,0.9)";
              e.currentTarget.style.color = "#333";
            }}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedImage(null);
              setShowPatrolModal(true);
              setImageRotation(0);
              setImageScale(1);
            }}
          >
            <CloseCircleOutlined />
          </button>
          
          {/* Image counter - Top Left */}
          {patrolDetails?.images && (
            <div style={{
              position: "absolute",
              top: "20px",
              left: "20px",
              background: "rgba(0,0,0,0.7)",
              color: "white",
              padding: "8px 16px",
              borderRadius: "20px",
              fontSize: "14px",
              fontWeight: "600",
              zIndex: 10000,
            }}>
              Image {patrolDetails.images.findIndex(img => 
                img.image_data === selectedImage) + 1} / {patrolDetails.images.length}
            </div>
          )}
          
          {/* Rotation Controls - Bottom Center */}
          <div style={{
            position: "absolute",
            bottom: "30px",
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            gap: "10px",
            background: "rgba(0,0,0,0.7)",
            padding: "10px 20px",
            borderRadius: "30px",
            zIndex: 10000,
            alignItems: "center",
          }}>
            {/* Zoom Out */}
            <button
              style={{
                background: "rgba(255,255,255,0.9)",
                border: "none",
                borderRadius: "50%",
                width: "40px",
                height: "40px",
                fontSize: "18px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.3s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.1)";
                e.currentTarget.style.background = "#4299e1";
                e.currentTarget.style.color = "white";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.background = "rgba(255,255,255,0.9)";
                e.currentTarget.style.color = "#333";
              }}
              onClick={(e) => {
                e.stopPropagation();
                setImageScale(prev => Math.max(0.5, prev - 0.25));
              }}
            >
              <ZoomOutOutlined />
            </button>
            
            {/* Rotate Left */}
            <button
              style={{
                background: "rgba(255,255,255,0.9)",
                border: "none",
                borderRadius: "50%",
                width: "40px",
                height: "40px",
                fontSize: "18px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.3s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.1)";
                e.currentTarget.style.background = "#4299e1";
                e.currentTarget.style.color = "white";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.background = "rgba(255,255,255,0.9)";
                e.currentTarget.style.color = "#333";
              }}
              onClick={(e) => {
                e.stopPropagation();
                setImageRotation(prev => prev - 90);
              }}
            >
              <RotateLeftOutlined />
            </button>
            
            {/* Reset Rotation & Zoom */}
            <button
              style={{
                background: "rgba(255,255,255,0.9)",
                border: "none",
                borderRadius: "50%",
                width: "40px",
                height: "40px",
                fontSize: "18px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.3s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.1)";
                e.currentTarget.style.background = "#48bb78";
                e.currentTarget.style.color = "white";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.background = "rgba(255,255,255,0.9)";
                e.currentTarget.style.color = "#333";
              }}
              onClick={(e) => {
                e.stopPropagation();
                setImageRotation(0);
                setImageScale(1);
              }}
            >
              <UndoOutlined />
            </button>
            
            {/* Rotate Right */}
            <button
              style={{
                background: "rgba(255,255,255,0.9)",
                border: "none",
                borderRadius: "50%",
                width: "40px",
                height: "40px",
                fontSize: "18px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.3s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.1)";
                e.currentTarget.style.background = "#4299e1";
                e.currentTarget.style.color = "white";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.background = "rgba(255,255,255,0.9)";
                e.currentTarget.style.color = "#333";
              }}
              onClick={(e) => {
                e.stopPropagation();
                setImageRotation(prev => prev + 90);
              }}
            >
              <RotateRightOutlined />
            </button>
            
            {/* Zoom In */}
            <button
              style={{
                background: "rgba(255,255,255,0.9)",
                border: "none",
                borderRadius: "50%",
                width: "40px",
                height: "40px",
                fontSize: "18px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.3s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.1)";
                e.currentTarget.style.background = "#4299e1";
                e.currentTarget.style.color = "white";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.background = "rgba(255,255,255,0.9)";
                e.currentTarget.style.color = "#333";
              }}
              onClick={(e) => {
                e.stopPropagation();
                setImageScale(prev => Math.min(3, prev + 0.25));
              }}
            >
              <ZoomInOutlined />
            </button>
            
            {/* Display current zoom level */}
            <div style={{
              marginLeft: "10px",
              color: "white",
              fontSize: "14px",
              fontWeight: "600",
              minWidth: "50px",
              textAlign: "center"
            }}>
              {Math.round(imageScale * 100)}%
            </div>
          </div>
          
          {/* The Image with Rotation and Scale */}
          <div style={{
            position: "relative",
            maxWidth: "90%",
            maxHeight: "90%",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}>
            <img 
              src={getImageUrl(selectedImage)} 
              alt="Preview" 
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: "contain",
                borderRadius: "8px",
                boxShadow: "0 25px 50px rgba(0, 0, 0, 0.5)",
                cursor: "move",
                transform: `rotate(${imageRotation}deg) scale(${imageScale})`,
                transition: "transform 0.3s ease",
                transformOrigin: "center center",
              }}
              onClick={(e) => e.stopPropagation()}
              onWheel={(e) => {
                e.stopPropagation();
                e.preventDefault();
                const delta = e.deltaY > 0 ? -0.1 : 0.1;
                setImageScale(prev => {
                  const newScale = prev + delta;
                  return Math.max(0.1, Math.min(5, newScale));
                });
              }}
            />
            
            {/* Rotation indicator */}
            {imageRotation !== 0 && (
              <div style={{
                position: "absolute",
                top: "10px",
                right: "10px",
                background: "rgba(0,0,0,0.7)",
                color: "white",
                padding: "5px 10px",
                borderRadius: "15px",
                fontSize: "12px",
                fontWeight: "600",
              }}>
                {Math.abs(imageRotation)}°
              </div>
            )}
          </div>
          
          {/* Navigation buttons for next/previous image */}
          {patrolDetails?.images && patrolDetails.images.length > 1 && (
            <>
              {/* Previous button */}
              <button
                style={{
                  position: "absolute",
                  left: "30px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "rgba(255,255,255,0.9)",
                  border: "none",
                  borderRadius: "50%",
                  width: "50px",
                  height: "50px",
                  fontSize: "24px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)",
                  transition: "all 0.3s ease",
                  zIndex: 10000,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-50%) scale(1.1)";
                  e.currentTarget.style.background = "#4299e1";
                  e.currentTarget.style.color = "white";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(-50%) scale(1)";
                  e.currentTarget.style.background = "rgba(255,255,255,0.9)";
                  e.currentTarget.style.color = "#333";
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  const currentIndex = patrolDetails.images.findIndex(img => 
                    img.image_data === selectedImage);
                  const prevIndex = (currentIndex - 1 + patrolDetails.images.length) % patrolDetails.images.length;
                  setSelectedImage(patrolDetails.images[prevIndex].image_data);
                  setImageRotation(0);
                  setImageScale(1);
                }}
              >
                ◀
              </button>
              
              {/* Next button */}
              <button
                style={{
                  position: "absolute",
                  right: "30px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "rgba(255,255,255,0.9)",
                  border: "none",
                  borderRadius: "50%",
                  width: "50px",
                  height: "50px",
                  fontSize: "24px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)",
                  transition: "all 0.3s ease",
                  zIndex: 10000,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-50%) scale(1.1)";
                  e.currentTarget.style.background = "#4299e1";
                  e.currentTarget.style.color = "white";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(-50%) scale(1)";
                  e.currentTarget.style.background = "rgba(255,255,255,0.9)";
                  e.currentTarget.style.color = "#333";
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  const currentIndex = patrolDetails.images.findIndex(img => 
                    img.image_data === selectedImage);
                  const nextIndex = (currentIndex + 1) % patrolDetails.images.length;
                  setSelectedImage(patrolDetails.images[nextIndex].image_data);
                  setImageRotation(0);
                  setImageScale(1);
                }}
              >
                ▶
              </button>
            </>
          )}
        </div>
      )}

      {/* Patrol Details Modal */}
      {showPatrolModal && patrolDetails && !selectedImage && (
        <div 
          className="modal-overlay"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
            padding: "5px",
          }} 
          onClick={closePatrolModal}
        >
          <div 
            className="modal-content"
            style={{
              backgroundColor: "white",
              borderRadius: "12px",
              width: "90%",
              maxWidth: "800px",
              maxHeight: "60vh",
              overflow: "auto",
              position: "relative",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            }} 
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              padding: "10px",
              borderBottom: "1px solid #f0f0f0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "linear-gradient(135deg, #00c853 0%, #bcc758ff 100%)",
              color: "white",
              borderRadius: "12px 12px 0 0",
            }}>
              <h2 style={{ fontSize: "24px", fontWeight: "600", margin: 0 }}>
               {language === "gu" ? "બીટ પેટ્રોલ કવરેજ વિશ્લેષણ" : "Patrol Details"}
              </h2>
              <button 
                onClick={closePatrolModal}
                style={{
                  background: "rgba(255,255,255,0.2)",
                  border: "none",
                  fontSize: "20px",
                  cursor: "pointer",
                  color: "white",
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.3s ease",
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.3)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.2)"}
              >
                ✕
              </button>
            </div>
            
            <div style={{ padding: "10px" }}>
              {loading.patrol ? (
                <div style={{ textAlign: "center", padding: "40px" }}>
                  <div style={{
                    border: "4px solid #f3f3f3",
                    borderTop: "4px solid #2ada2aff",
                    borderRadius: "50%",
                    width: "60px",
                    height: "60px",
                    animation: "spin 1s linear infinite",
                    margin: "0 auto 10px",
                  }} />
                  <p style={{ color: "#666", fontSize: "16px" }}>{language === "gu" ? "પેટ્રોલ વિગતો લોડ કરી રહ્યા છીએ..." : "Loading patrol details..."}</p>
                </div>
              ) : (
                <>
                  {/* Basic Information */}
                  <div style={{
                    backgroundColor: "#fff",
                    borderRadius: "10px",
                    padding: "10px",
                    marginBottom: "10px",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.05)",
                  }}>
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      marginBottom: "10px",
                      paddingBottom: "5px",
                      borderBottom: "2px solid #e1bc42ff",
                    }}>
                      <div style={{
                        backgroundColor: "#9ce142ff",
                        width: "40px",
                        height: "40px",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: "12px",
                        color: "white",
                      }}>
                        <UserOutlined />
                      </div>
                      <h3 style={{ margin: 0, fontSize: "20px", color: "#2d3748" }}>
                        {language === "gu" ? "બીટ પેટ્રોલ કવરેજ વિશ્લેષણ" : "Patrol Information"}
                      </h3>
                    </div>
                    
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "15px" }}>
                      <div>
                        <label style={{ fontSize: "12px", color: "#718096", fontWeight: "600", textTransform: "uppercase", marginBottom: "4px" }}>
                          {language === "gu" ? "પેટ્રોલ ઑફિસર" : "Patrol Officer"}
                        </label>
                        <div style={{
                          fontSize: "16px",
                          fontWeight: "500",
                          color: "#2d3748",
                          padding: "5px",
                          backgroundColor: "#f7fafc",
                          borderRadius: "6px",
                          border: "1px solid #e2e8f0",
                        }}>
                          {patrolDetails.patrol_officer_name || "N/A"}
                        </div>
                      </div>
                      
                      <div>
                        <label style={{ fontSize: "12px", color: "#718096", fontWeight: "600", textTransform: "uppercase", marginBottom: "4px" }}>
                          {language === "gu" ? "પેટ્રોલ આઈડી" : "Patrol ID"}
                        </label>
                        <div style={{
                          fontSize: "16px",
                          fontWeight: "500",
                          color: "#2d3748",
                          padding: "5px",
                          backgroundColor: "#f7fafc",
                          borderRadius: "6px",
                          border: "1px solid #e2e8f0",
                        }}>
                          {patrolDetails.patrol_id}
                        </div>
                      </div>
                      
                      <div>
                        <label style={{ fontSize: "12px", color: "#718096", fontWeight: "600", textTransform: "uppercase", marginBottom: "4px" }}>
                          {language === "gu" ? "અંતર" : "Distance"}
                        </label>
                        <div style={{
                          fontSize: "16px",
                          fontWeight: "500",
                          color: "#2d3748",
                          padding: "5px",
                          backgroundColor: "#f7fafc",
                          borderRadius: "6px",
                          border: "1px solid #e2e8f0",
                        }}>
                          {patrolDetails.distance_kms ? `${Number(patrolDetails.distance_kms).toFixed(2)} km` : "N/A"}
                        </div>
                      </div>
                      
                      <div>
                        <label style={{ fontSize: "12px", color: "#718096", fontWeight: "600", textTransform: "uppercase", marginBottom: "4px" }}>
                          {language === "gu" ? "પેટ્રોલ પ્રકાર" : "Patrol Type"}
                        </label>
                        <div style={{
                          display: "inline-block",
                          padding: "4px 8px",
                          borderRadius: "10px",
                          fontSize: "14px",
                          fontWeight: "600",
                          backgroundColor: patrolDetails.type_name === "Day patrolling" ? "#ebf8ff" : 
                                        patrolDetails.type_name === "Night patrolling" ? "#faf5ff" : "#f0fff4",
                          color: patrolDetails.type_name === "Day patrolling" ? "#2b6cb0" : 
                               patrolDetails.type_name === "Night patrolling" ? "#6b46c1" : "#276749",
                          border: `2px solid ${patrolDetails.type_name === "Day patrolling" ? "#bee3f8" : 
                                  patrolDetails.type_name === "Night patrolling" ? "#e9d8fd" : "#c6f6d5"}`,
                        }}>
                          {patrolDetails.type_name}
                        </div>
                      </div>
                    </div>
                    
                    {patrolDetails.note && (
                      <div style={{ marginTop: "20px" }}>
                        <label style={{ fontSize: "12px", color: "#718096", fontWeight: "600", textTransform: "uppercase", marginBottom: "4px" }}>
                          {language === "gu" ? "નોટ્સ" : "Notes"}
                        </label>
                        <div style={{
                          fontSize: "14px",
                          color: "#4a5568",
                          padding: "7px",
                          backgroundColor: "#f7fafc",
                          borderRadius: "8px",
                          border: "1px solid #e2e8f0",
                          lineHeight: "1.6",
                        }}>
                          {patrolDetails.note}
                        </div>
                      </div>
                    )}
                    
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "15px", marginTop: "20px" }}>
                      <div>
                        <label style={{ fontSize: "12px", color: "#718096", fontWeight: "600", textTransform: "uppercase", marginBottom: "4px" }}>
                          <CalendarOutlined /> {language === "gu" ? "તારીખ" : "Date"}
                        </label>
                        <div style={{
                          fontSize: "14px",
                          fontWeight: "500",
                          color: "#2d3748",
                          padding: "5px",
                          backgroundColor: "#f7fafc",
                          borderRadius: "6px",
                          border: "1px solid #e2e8f0",
                        }}>
                          {new Date(patrolDetails.start_time).toLocaleDateString()}
                        </div>
                      </div>
                      
                      <div>
                        <label style={{ fontSize: "12px", color: "#718096", fontWeight: "600", textTransform: "uppercase", marginBottom: "4px" }}>
                          <ClockCircleOutlined /> {language === "gu" ? "સ્ટાર્ટ ટાઇમ" : "Start Time"}
                        </label>
                        <div style={{
                          fontSize: "14px",
                          fontWeight: "500",
                          color: "#2d3748",
                          padding: "5px",
                          backgroundColor: "#f7fafc",
                          borderRadius: "6px",
                          border: "1px solid #e2e8f0",
                        }}>
                          {formatDateTime(patrolDetails.start_time)}
                        </div>
                      </div>
                      
                      <div>
                        <label style={{ fontSize: "12px", color: "#718096", fontWeight: "600", textTransform: "uppercase", marginBottom: "4px" }}>
                          <ClockCircleOutlined /> {language === "gu" ? "એન્ડ ટાઇમ" : "End Time"}
                        </label>
                        <div style={{
                          fontSize: "14px",
                          fontWeight: "500",
                          color: "#2d3748",
                          padding: "5px",
                          backgroundColor: "#f7fafc",
                          borderRadius: "6px",
                          border: "1px solid #e2e8f0",
                        }}>
                          {formatDateTime(patrolDetails.end_time)}
                        </div>
                      </div>
                      
                      <div>
                        <label style={{ fontSize: "12px", color: "#718096", fontWeight: "600", textTransform: "uppercase", marginBottom: "4px" }}>
                          {language === "gu" ? "સમયગાળો" : "Duration"}
                        </label>
                        <div style={{
                          fontSize: "14px",
                          fontWeight: "500",
                          color: "#2d3748",
                          padding: "5px",
                          backgroundColor: "#f7fafc",
                          borderRadius: "6px",
                          border: "1px solid #e2e8f0",
                        }}>
                          {formatDuration(patrolDetails.start_time, patrolDetails.end_time)}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Images Section */}
                  {patrolDetails.images && patrolDetails.images.length > 0 && (
                    <div style={{
                      backgroundColor: "#fff",
                      borderRadius: "10px",
                      padding: "10px",
                      border: "1px solid #e2e8f0",
                      boxShadow: "0 4px 6px rgba(0, 0, 0, 0.05)",
                    }}>
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        marginBottom: "10px",
                        paddingBottom: "5px",
                        borderBottom: "2px solid #4299e1",
                      }}>
                        <div style={{
                          backgroundColor: "#4299e1",
                          width: "40px",
                          height: "40px",
                          borderRadius: "50%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          marginRight: "6px",
                          color: "white",
                        }}>
                          <PictureOutlined />
                        </div>
                        <h3 style={{ margin: 0, fontSize: "20px", color: "#2d3748" }}>
                          {language === "gu" ? "પેટ્રોલ ચિત્રો" : "Patrol Images"} ({patrolDetails.images.length})
                        </h3>
                      </div>
                      
                      {/* Use Ant Design Image.PreviewGroup for gallery preview */}
                      <Image.PreviewGroup>
                        <div style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                          gap: "15px",
                        }}>
                          {patrolDetails.images.map((image, index) => (
                            <div 
                              key={index} 
                              className="image-card"
                              style={{
                                border: "2px solid #e2e8f0",
                                borderRadius: "8px",
                                overflow: "hidden",
                                cursor: "pointer",
                                transition: "all 0.3s ease",
                                position: "relative",
                              }}
                              onClick={() => {
                                setSelectedImage(image.image_data);
                                setShowPatrolModal(false);
                                setImageRotation(0);
                                setImageScale(1);
                              }}
                            >
                              <div style={{
                                width: "100%",
                                height: "140px",
                                overflow: "hidden",
                                position: "relative",
                              }}>
                                <Image
                                  width="100%"
                                  height="100%"
                                  style={{
                                    objectFit: "cover",
                                    transition: "transform 0.3s ease",
                                  }}
                                  src={getImageUrl(image.image_data)}
                                  alt={`Patrol Image ${index + 1}`}
                                  onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.05)"}
                                  onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
                                  preview={{
                                    mask: (
                                      <div style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        height: "100%",
                                        color: "white",
                                      }}>
                                        <SearchOutlined style={{ fontSize: "20px", marginBottom: "5px" }} />
                                        <span>{language === "gu" ? "જુઓ" : "View"}</span>
                                      </div>
                                    ),
                                    maskClassName: "custom-preview-mask"
                                  }}
                                />
                                
                                <div style={{
                                  position: "absolute",
                                  top: "8px",
                                  right: "8px",
                                  backgroundColor: "rgba(0,0,0,0.7)",
                                  color: "white",
                                  fontSize: "12px",
                                  padding: "1px 4px",
                                  borderRadius: "4px",
                                  zIndex: 1,
                                }}>
                                  {index + 1}
                                </div>
                              </div>
                              
                              <div style={{ padding: "5px", backgroundColor: "#f8fafc" }}>
                                <div style={{ 
                                  fontWeight: "600", 
                                  fontSize: "12px", 
                                  color: "#2d3748", 
                                  marginBottom: "4px",
                                  textAlign: "center"
                                }}>
                                  {image.image_category || "Uncategorized"}
                                </div>
                              </div>
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

      <button
        style={{
          position: "absolute",
          top: "15px",
          right: "15px",
          width: "45px",
          height: "45px",
          borderRadius: "50%",
          background: "linear-gradient(135deg, #f56565 0%, #e53e3e 100%)",
          border: "none",
          color: "white",
          fontSize: "18px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1001,
          boxShadow: "0 4px 6px rgba(245, 101, 101, 0.3)",
          transition: "all 0.3s ease",
        }}
        onMouseEnter={(e) => e.currentTarget.style.transform = "rotate(90deg)"}
        onMouseLeave={(e) => e.currentTarget.style.transform = "rotate(0deg)"}
        onClick={() => {
          setShowMapRoute(!showmaproute);
          handleReset();
        }}
      >
        <CloseOutlined />
      </button>
              
      <div style={{
        padding: "20px",
        overflow: "auto",
        height: "calc(100% - 40px)",
      }}>
        <h1 style={{
          fontSize: "32px",
          fontWeight: "700",
          marginBottom: "8px",
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}>
          {language === "gu" ? "બીટ પેટ્રોલ કવરેજ વિશ્લેષણ" : "Beat Patrol Coverage Analysis"}
        </h1>
        <p style={{
          fontSize: "16px",
          color: "#718096",
          marginBottom: "30px",
        }}>
          {language === "gu" ? "ફોરેસ્ટ પ્રકાર અને બીટ પસંદ કરો અને પેટ્રોલ કવરેજ વિશ્લેષણ કરો" : "Select forest type and beat to analyze patrol coverage"}
        </p>

        {/* Selection Card */}
        <div style={{
          backgroundColor: "#fff",
          borderRadius: "12px",
          padding: "25px",
          marginBottom: "25px",
          border: "1px solid #e2e8f0",
          boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.025)",
        }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: "20px",
            alignItems: "end",
          }}>
            {/* Forest Type Selection */}
            <div>
              <label style={{
                display: "block",
                fontWeight: "600",
                marginBottom: "10px",
                fontSize: "14px",
                color: "#2d3748",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}>
                {language === "gu" ? "ફોરેસ્ટ પ્રકાર" : "Forest Type"}
              </label>
              <div style={{ position: "relative" }}>
                <select
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    borderRadius: "8px",
                    border: "2px solid #e2e8f0",
                    fontSize: "14px",
                    backgroundColor: loading.divisions ? "#f7fafc" : "white",
                    cursor: loading.divisions ? "not-allowed" : "pointer",
                    appearance: "none",
                    transition: "all 0.3s ease",
                  }}
                  value={selectedForest || ""}
                  onChange={handleForestChange}
                  disabled={loading.divisions}
                  onFocus={(e) => e.target.style.borderColor = "#4299e1"}
                  onBlur={(e) => e.target.style.borderColor = "#e2e8f0"}
                >
                  <option value="">{language === "gu" ? "ફોરેસ્ટ પ્રકાર પસંદ કરો" : "Select Forest Type"}</option>
                  {forestTypes.map((forest) => (
                    <option key={forest.forest_id} value={forest.forest_id}>
                      {forest.forest_type}
                    </option>
                  ))}
                </select>
                <div style={{
                  position: "absolute",
                  right: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  pointerEvents: "none",
                  color: "#a0aec0",
                }}>
                  ▼
                </div>
              </div>
            </div>

            {/* Division Selection */}
            <div>
              <label style={{
                display: "block",
                fontWeight: "600",
                marginBottom: "10px",
                fontSize: "14px",
                color: "#2d3748",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}>
                {language === "gu" ? "વિભાગ" : "Division"}
              </label>
              <Select
                value={selectedDivision}
                onChange={handleDivisionChange}
                options={divisions}
                isSearchable
                isClearable
                placeholder={selectedForest ? "Select Division..." : "Select forest type first"}
                isLoading={loading.divisions}
                isDisabled={!selectedForest || loading.divisions}
                styles={customSelectStyles}
                noOptionsMessage={() => "No divisions available"}
              />
            </div>

            {/* Range Selection */}
            <div>
              <label style={{
                display: "block",
                fontWeight: "600",
                marginBottom: "10px",
                fontSize: "14px",
                color: "#2d3748",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}>
                {language === "gu" ? "રેન્જ" : "Range"}
              </label>
              <Select
                value={selectedRange}
                onChange={handleRangeChange}
                options={ranges}
                isSearchable
                isClearable
                placeholder={selectedDivision ? "Select Range..." : "Select division first"}
                isDisabled={!selectedDivision}
                styles={customSelectStyles}
                noOptionsMessage={() => "No ranges available"}
              />
            </div>

            {/* Beat Selection */}
            <div>
              <label style={{
                display: "block",
                fontWeight: "600",
                marginBottom: "10px",
                fontSize: "14px",
                color: "#2d3748",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}>
                {language === "gu" ? "બીટ" : "Beat"}
              </label>
              <Select
                value={selectedBeat}
                onChange={handleBeatChange}
                options={beats}
                isSearchable
                isClearable
                placeholder={selectedRange ? "Select Beat..." : "Select range first"}
                isDisabled={!selectedRange}
                styles={customSelectStyles}
                noOptionsMessage={() => "No beats available"}
              />
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", gap: "12px", gridColumn: "span 2" }}>
              <button
                className="glow-button"
                onClick={fetchCoverageData}
                disabled={!selectedBeat || loading.coverage}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  padding: "12px 24px",
                }}
              >
                {loading.coverage ? (
                  <>
                    <div style={{
                      border: "2px solid rgba(255,255,255,0.3)",
                      borderTop: "2px solid white",
                      borderRadius: "50%",
                      width: "20px",
                      height: "20px",
                      animation: "spin 1s linear infinite",
                    }} />
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
                onClick={handleReset}
                disabled={loading.coverage}
                style={{
                  padding: "12px 24px",
                  borderRadius: "8px",
                  border: "2px solid #e2e8f0",
                  fontSize: "14px",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  backgroundColor: "white",
                  color: "#4a5568",
                  fontWeight: "600",
                  transition: "all 0.3s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.backgroundColor = "#f7fafc";
                  e.currentTarget.borderColor = "#cbd5e0";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.backgroundColor = "white";
                  e.currentTarget.borderColor = "#e2e8f0";
                }}
              >
                {language === "gu" ? "રીસેટ" : "Reset"}
              </button>
            </div>
          </div>
        </div>

        {/* Loading Spinner for hierarchy */}
        {loading.divisions && (
          <div style={{ textAlign: "center", padding: "40px" }}>
            <div style={{
              border: "4px solid #f3f3f3",
              borderTop: "4px solid #4299e1",
              borderRadius: "50%",
              width: "60px",
              height: "60px",
              animation: "spin 1s linear infinite",
              margin: "0 auto 20px",
            }} />
            <p style={{ marginTop: "10px", color: "#718096", fontSize: "16px" }}>
              {language === "gu" ? "હાયરાર્કી ડેટા લોડ કરી રહ્યા છીએ..." : "Loading hierarchy data..."}
            </p>
          </div>
        )}

        {/* Loading Spinner for coverage */}
        {loading.coverage && (
          <div style={{ textAlign: "center", padding: "60px" }}>
            <div style={{
              border: "6px solid #f3f3f3",
              borderTop: "6px solid #4299e1",
              borderRadius: "50%",
              width: "80px",
              height: "80px",
              animation: "spin 1s linear infinite",
              margin: "0 auto 20px",
            }} />
            <p style={{ marginTop: "20px", color: "#718096", fontSize: "18px" }}>
              {language === "gu" ? "પેટ્રોલ કવરેજ ડેટા વિશ્લેષણ કરી રહ્યા છીએ..." : "Analyzing patrol coverage data..."}
            </p>
          </div>
        )}

        {/* Coverage Data & Map Display */}
        {coverageData && !loading.coverage && (
          <div style={{
            backgroundColor: "#fff",
            borderRadius: "12px",
            padding: "25px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.025)",
          }}>
            <div style={{ position: "relative" }}>
              {/* Summary Cards */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: "20px",
                marginBottom: "30px",
              }}>
                <div className="stats-card">
                  <p style={{ fontSize: "14px", margin: "0 0 12px 0", opacity: 0.9 }}>Beat</p>
                  <div style={{
                    display: "inline-block",
                    padding: "8px 20px",
                    borderRadius: "20px",
                    backgroundColor: "rgba(255,255,255,0.2)",
                    border: "2px solid rgba(255,255,255,0.3)",
                    fontSize: "18px",
                    fontWeight: "600",
                    backdropFilter: "blur(10px)",
                  }}>
                    {coverageData.beat_name}
                  </div>
                </div>
                <div className="stats-card" style={{ background: "linear-gradient(135deg, #fbdf93ff 0%, #b8f557ff 100%)" }}>
                  <p style={{ fontSize: "14px", margin: "0 0 12px 0", opacity: 0.9 }}>Beat Area</p>
                  <h3 style={{ margin: "0", fontSize: "28px", fontWeight: "700" }}>
                    {(Number(coverageData.beat_area_sq_m) / 1000000).toFixed(2)} km²
                  </h3>
                  <p style={{ fontSize: "12px", margin: "8px 0 0 0", opacity: 0.8 }}>
                    {Number(coverageData.beat_area_sq_m).toLocaleString()} m²
                  </p>
                </div>
                <div className="stats-card" style={{ background: "linear-gradient(135deg, #fec14fff 0%, #6fb834ff 100%)" }}>
                  <p style={{ fontSize: "14px", margin: "0 0 12px 0", opacity: 0.9 }}>Patrol Covered Area</p>
                  <h3 style={{ margin: "0", fontSize: "28px", fontWeight: "700" }}>
                    {(Number(coverageData.patrol_beat_area_sq_m) / 1000000).toFixed(2)} km²
                  </h3>
                  <p style={{ fontSize: "12px", margin: "8px 0 0 0", opacity: 0.8 }}>
                    {Number(coverageData.patrol_beat_area_sq_m).toLocaleString()} m²
                  </p>
                </div>
                <div className="stats-card" style={{ 
                  background: coverageData.coverage_percentage > 70 ? 
                    "linear-gradient(135deg, #e9e643ff 0%, #f93838ff 100%)" : 
                    coverageData.coverage_percentage > 40 ? 
                    "linear-gradient(135deg, #f8fa70ff 0%, #8cfe40ff 100%)" : 
                    "linear-gradient(135deg, #ffb108ff 0%, #dbff99ff 100%)"
                }}>
                  <p style={{ fontSize: "14px", margin: "0 0 12px 0", opacity: 0.9 }}>Coverage</p>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <h3 style={{ margin: "0", fontSize: "36px", fontWeight: "700" }}>
                      {Number(coverageData.coverage_percentage).toFixed(1)}%
                    </h3>
                    <div style={{
                      width: "60px",
                      height: "60px",
                      borderRadius: "25%",
                      backgroundColor: "rgba(255,255,255,0.2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "3px solid rgba(255,255,255,0.3)",
                    }}>
                      <span style={{ fontSize: "24px" }}>
                        {coverageData.coverage_percentage > 70 ? "✓" : 
                         coverageData.coverage_percentage > 40 ? "⚡" : "⚠"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Export Button */}
              <button
                className="glow-button"
                onClick={exportToExcel}
                style={{
                  marginBottom: "30px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "10px",
                  padding: "12px 30px",
                }}
              >
                <DownloadOutlined />
                {language === "gu" ? "એક્સેલમાં નિકાલ કરો" : "Export to Excel"}
              </button>

              {/* Map Container */}
              <div style={{ 
                height: "450px", 
                width: "100%", 
                border: "2px solid #e2e8f0", 
                borderRadius: "12px",
                marginBottom: "30px",
                overflow: "hidden",
                boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
              }}>
                <MapContainer
                  center={patrolLines[0]?.[0] || [22.3, 70.8]}
                  zoom={13}
                  style={{ height: "100%", width: "100%" }}
                  scrollWheelZoom={true}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
                    url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
                  />

                  {patrolLines.map((line, idx) => {
                    const patrolId = coverageData.patrols_covering_beat[idx]?.patrol_id;
                    return (
                      <Polyline
                        key={patrolId || idx}
                        positions={line}
                        color={selectedPatrol === patrolId ? "#ff0000" : "#4299e1"}
                        weight={selectedPatrol === patrolId ? 6 : 4}
                        opacity={selectedPatrol === patrolId ? 1 : 0.8}
                      >
                        <Popup>
                          <div style={{ padding: "10px", minWidth: "200px" }}>
                            <strong style={{ color: "#2d3748", fontSize: "14px" }}>
                              Patrol {patrolId ? `#${patrolId}` : `Route #${idx + 1}`}
                            </strong>
                            <br />
                            <button
                              onClick={() => patrolId && fetchPatrolDetails(patrolId)}
                              style={{
                                padding: "8px 16px",
                                borderRadius: "6px",
                                border: "none",
                                backgroundColor: "#4299e1",
                                color: "white",
                                fontSize: "12px",
                                cursor: "pointer",
                                marginTop: "8px",
                                fontWeight: "600",
                                transition: "all 0.3s ease",
                              }}
                              onMouseEnter={(e) => e.currentTarget.backgroundColor = "#3182ce"}
                              onMouseLeave={(e) => e.currentTarget.backgroundColor = "#4299e1"}
                            >
                              {language === "gu" ? "વિગતો જુઓ" : "View Details"}
                            </button>
                          </div>
                        </Popup>
                      </Polyline>
                    );
                  })}
                </MapContainer>
              </div>

              {/* Patrol Info */}
              {coverageData.patrols_covering_beat && coverageData.patrols_covering_beat.length > 0 && (
                <div style={{ marginTop: "20px" }}>
                  <h3 style={{
                    fontSize: "20px",
                    fontWeight: "600",
                    marginBottom: "20px",
                    color: "#2d3748",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                  }}>
                    <span style={{
                      backgroundColor: "#a5e06eff",
                      color: "white",
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "14px",
                    }}>
                      {coverageData.patrols_covering_beat.length}
                    </span>
                    {language === "gu" ? "આ બીટની કવરેજ કરતા પેટ્રોલ" : "Patrols Covering This Beat"}
                  </h3>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                    gap: "15px",
                  }}>
                    {coverageData.patrols_covering_beat.map((patrol, index) => (
                      <div 
                        key={patrol.patrol_id || index}
                        className={`patrol-card ${selectedPatrol === patrol.patrol_id ? 'active' : ''}`}
                        onClick={() => fetchPatrolDetails(patrol.patrol_id)}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div>
                            <p style={{ 
                              fontWeight: "700", 
                              margin: "0 0 8px 0", 
                              fontSize: "16px",
                              color: selectedPatrol === patrol.patrol_id ? "#276749" : "#2d3748"
                            }}>
                              {language === "gu" ? `પેટ્રોલ #${patrol.patrol_id}` : `Patrol #${patrol.patrol_id}`}
                            </p>
                            {patrol.patrol_type && (
                              <span style={{
                                display: "inline-block",
                                padding: "4px 12px",
                                borderRadius: "12px",
                                fontSize: "12px",
                                fontWeight: "600",
                                backgroundColor: patrol.patrol_type === "Day" ? "#ebf8ff" : "#faf5ff",
                                color: patrol.patrol_type === "Day" ? "#2b6cb0" : "#6b46c1",
                                border: `1px solid ${patrol.patrol_type === "Day" ? "#bee3f8" : "#e9d8fd"}`,
                                marginBottom: "8px",
                              }}>
                                {patrol.patrol_type} {language === "gu" ? "પેટ્રોલ" : "Patrol"}
                              </span>
                            )}
                          </div>
                          <div style={{
                            backgroundColor: selectedPatrol === patrol.patrol_id ? "#48bb78" : "#d0eb5bff",
                            color: "white",
                            width: "32px",
                            height: "32px",
                            borderRadius: "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "12px",
                            fontWeight: "600",
                          }}>
                            {index + 1}
                          </div>
                        </div>
                        
                        {patrol.start_time && (
                          <div style={{ 
                            display: "flex", 
                            alignItems: "center", 
                            gap: "8px",
                            marginTop: "12px",
                            paddingTop: "12px",
                            borderTop: "1px solid #e2e8f0",
                          }}>
                            <CalendarOutlined style={{ color: "#a0aec0" }} />
                            <span style={{ fontSize: "12px", color: "#718096" }}>
                              {new Date(patrol.start_time).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                        
                        <div style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginTop: "10px",
                        }}>
                          <span style={{ fontSize: "11px", color: "#a0aec0", fontStyle: "italic" }}>
                            {language === "gu" ? "વિગતો જુઓ" : "Click to view details"}
                          </span>
                          <span style={{
                            fontSize: "20px",
                            color: selectedPatrol === patrol.patrol_id ? "#48bb78" : "#4299e1",
                            transition: "transform 0.3s ease",
                          }}>
                            →
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {coverageData.patrols_covering_beat && coverageData.patrols_covering_beat.length === 0 && (
                <div style={{
                  textAlign: "center",
                  padding: "40px",
                  backgroundColor: "#fff",
                  borderRadius: "12px",
                  border: "2px dashed #e2e8f0",
                  margin: "20px 0",
                }}>
                  <div style={{
                    width: "60px",
                    height: "60px",
                    backgroundColor: "#fed7d7",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 20px",
                    color: "#e53e3e",
                    fontSize: "24px",
                  }}>
                    ⚡
                  </div>
                  <p style={{ color: "#718096", fontSize: "16px", fontWeight: "500" }}>
                    {language === "gu" ? "આ બીટની કવરેજ કરતા પેટ્રોલ મળ્યા નથી" : "No patrols found covering this beat"}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BeatPatrolCoverage;
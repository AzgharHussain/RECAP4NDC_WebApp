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
  CloseCircleOutlined,
  FileExcelOutlined,
  
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
import vector from '../assets/Vector.png';

// Helper to format date/time
const formatDateTime = (dateTime, language = 'en') => {
  if (!dateTime) return "N/A";
  return new Date(dateTime).toLocaleString(language === 'gu' ? 'gu-IN' : 'en-US');
};

const formatDuration = (startTime, endTime, language = 'en') => {
  if (!startTime || !endTime) return "N/A";
  const start = new Date(startTime);
  const end = new Date(endTime);
  const durationMs = end - start;
  const hours = Math.floor(durationMs / (1000 * 60 * 60));
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (language === 'gu') {
    return `${hours} કલાક ${minutes} મિનિટ`;
  }
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
  // Translations
  const translations = {
    en: {
      title: "Plantation Coverage Analysis",
      loading: "Loading...",
      analyzing: "Analyzing...",
      analyzeCoverage: "Analyze Coverage",
      reset: "Reset",
      exportToExcel: "Export",
      patrolDetails: "Patrol Details",
      patrolInformation: "Patrol Information",
      patrolOfficer: "Patrol Officer",
      patrolId: "Patrol ID",
      distance: "Distance",
      patrolType: "Patrol Type",
      notes: "Notes",
      date: "Date",
      startTime: "Start Time",
      endTime: "End Time",
      duration: "Duration",
      patrolImages: "Patrol Images",
      images: "Images",
      view: "View",
      uncategorized: "Uncategorized",
      division: "Division",
      range: "Range",
      round: "Round",
      beat: "Beat",
      boundary: "Plantation Boundary",
      month: "Month",
      selectDivision: "Select Division",
      selectRange: "Select Range",
      selectRound: "Select Round",
      selectBeat: "Select Beat",
      selectBoundary: "Select Boundary...",
      loadingBoundaries: "Loading boundaries...",
      noDivisions: "No divisions available",
      noRanges: "No ranges available",
      noRounds: "No rounds available",
      noBeats: "No beats available",
      noBoundaries: "No boundaries available",
      beatArea: "Beat Area",
      boundaryArea: "Boundary Area",
      patrolCoveredArea: "Patrol Covered Area",
      coverage: "Coverage",
      patrolsInside: "Patrols Inside This",
      beatLabel: "Beat",
      boundaryLabel: "Boundary",
      noPatrolsFound: "No patrols found inside this",
      clickToView: "Click to view details",
      dayPatrol: "Day Patrol",
      nightPatrol: "Night Patrol",
      areaUnit: "km²",
      squareMeters: "m²",
      loadingCoverage: "Loading coverage data...",
      completeSelection: "Please complete the beat selection (Division → Range → Round → Beat)",
      selectBoundaryFirst: "Please select a Boundary",
      selectMonthFirst: "Please select a month",
      noCoverageData: "No coverage data found",
      failedToLoad: "Failed to load coverage data",
      failedToLoadDivisions: "Failed to load divisions list",
      failedToLoadRanges: "Failed to load ranges",
      failedToLoadRounds: "Failed to load rounds",
      failedToLoadBeats: "Failed to load beats",
      failedToLoadBoundaries: "Failed to load patrol boundaries",
      failedToLoadPatrolDetails: "Failed to load patrol details",
      invalidDataFormat: "Failed to load patrol details: Invalid data format"
    },
    gu: {
      title: "પ્લાન્ટેશન કવરેજ વિશ્લેષણ",
      loading: "લોડ થઈ રહ્યું છે...",
      analyzing: "વિશ્લેષણ કરી રહ્યા છીએ...",
      analyzeCoverage: "કવરેજ વિશ્લેષણ કરો",
      reset: "રીસેટ",
      exportToExcel: "એક્સેલ",
      patrolDetails: "પેટ્રોલ વિગતો",
      patrolInformation: "પેટ્રોલ માહિતી",
      patrolOfficer: "પેટ્રોલ અધિકારી",
      patrolId: "પેટ્રોલ ID",
      distance: "અંતર",
      patrolType: "પેટ્રોલ પ્રકાર",
      notes: "નોંધ",
      date: "તારીખ",
      startTime: "શરૂઆતનો સમય",
      endTime: "સમાપ્તિ સમય",
      duration: "અવધિ",
      patrolImages: "પેટ્રોલ છબીઓ",
      images: "છબીઓ",
      view: "જુઓ",
      uncategorized: "શ્રેણી વગરનું",
      division: "ડિવિઝન",
      range: "રેંજ",
      round: "રાઉન્ડ",
      beat: "બીટ",
      boundary: "પ્લાન્ટેશન બાઉન્ડ્રી",
      month: "મહિનો",
      selectDivision: "ડિવિઝન પસંદ કરો",
      selectRange: "રેંજ પસંદ કરો",
      selectRound: "રાઉન્ડ પસંદ કરો",
      selectBeat: "બીટ પસંદ કરો",
      selectBoundary: "બાઉન્ડ્રી પસંદ કરો...",
      loadingBoundaries: "બાઉન્ડ્રીઓ લોડ થઈ રહી છે...",
      noDivisions: "કોઈ ડિવિઝન ઉપલબ્ધ નથી",
      noRanges: "કોઈ રેંજ ઉપલબ્ધ નથી",
      noRounds: "કોઈ રાઉન્ડ ઉપલબ્ધ નથી",
      noBeats: "કોઈ બીટ ઉપલબ્ધ નથી",
      noBoundaries: "કોઈ બાઉન્ડ્રી ઉપલબ્ધ નથી",
      beatArea: "બીટ વિસ્તાર",
      boundaryArea: "બાઉન્ડ્રી વિસ્તાર",
      patrolCoveredArea: "પેટ્રોલ કવરેજ વિસ્તાર",
      coverage: "કવરેજ",
      patrolsInside: "આની અંદરના પેટ્રોલ",
      beatLabel: "બીટ",
      boundaryLabel: "બાઉન્ડ્રી",
      noPatrolsFound: "આની અંદર કોઈ પેટ્રોલ મળ્યા નથી",
      clickToView: "વિગતો જોવા ક્લિક કરો",
      dayPatrol: "દિવસનો પેટ્રોલ",
      nightPatrol: "રાત્રિનો પેટ્રોલ",
      areaUnit: "કિમી²",
      squareMeters: "મી²",
      loadingCoverage: "કવરેજ ડેટા લોડ થઈ રહ્યો છે...",
      completeSelection: "કૃપા કરીને બીટ પસંદગી પૂર્ણ કરો (ડિવિઝન → રેંજ → રાઉન્ડ → બીટ)",
      selectBoundaryFirst: "કૃપા કરીને બાઉન્ડ્રી પસંદ કરો",
      selectMonthFirst: "કૃપા કરીને મહિનો પસંદ કરો",
      noCoverageData: "કોઈ કવરેજ ડેટા મળ્યો નથી",
      failedToLoad: "કવરેજ ડેટા લોડ કરવામાં નિષ્ફળતા",
      failedToLoadDivisions: "ડિવિઝન સૂચિ લોડ કરવામાં નિષ્ફળ",
      failedToLoadRanges: "રેંજ લોડ કરવામાં નિષ્ફળતા",
      failedToLoadRounds: "રાઉન્ડ લોડ કરવામાં નિષ્ફળતા",
      failedToLoadBeats: "બીટ લોડ કરવામાં નિષ્ફળતા",
      failedToLoadBoundaries: "પેટ્રોલ બાઉન્ડ્રીઓ લોડ કરવામાં નિષ્ફળતા",
      failedToLoadPatrolDetails: "પેટ્રોલ વિગતો લોડ કરવામાં નિષ્ફળતા",
      invalidDataFormat: "પેટ્રોલ વિગતો લોડ કરવામાં નિષ્ફળતા: અમાન્ય ડેટા ફોર્મેટ"
    }
  };

  const t = translations[language] || translations.en;

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
  const [selectionMode, setSelectionMode] = useState('boundary'); // 'beat' or 'boundary'

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

      const divisionsData = response.data[0] || response.data || [];
      const divisionList = divisionsData.map(item => ({
        value: item.division,
        label: item.division
      }));
      setDivisions(divisionList);
    } catch (error) {
      console.error("Error fetching divisions:", error);
      alert(t.failedToLoadDivisions);
    } finally {
      setLoading(prev => ({ ...prev, divisions: false }));
    }
  };

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
      alert(t.failedToLoadRanges);
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
      alert(t.failedToLoadRounds);
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
      alert(t.failedToLoadBeats);
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
      alert(t.failedToLoadBoundaries);
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
    setSelectedMonth("");
        setSelectedBoundary(null);

  };

  // Fetch coverage data
// Fetch coverage data
const fetchCoverageData = async () => {
  if (selectionMode === 'beat' && !selectedBeat) {
    alert(t.completeSelection);
    return;
  }
  if (selectionMode === 'boundary' && !selectedBoundary) {
    alert(t.selectBoundaryFirst);
    return;
  }
  if (!selectedMonth) {
    alert(t.selectMonthFirst);
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
      console.log("Coverage data response:", response.data);
      const data = response.data.data;
      setCoverageData(data);
      
      // Filter out patrols with null patrol_id
      const validPatrols = (data.patrols_covering_coupe || []).filter(
        patrol => patrol.patrol_id !== null && patrol.patrol_id !== undefined && patrol.patrol_id !== ""
      );
      
      setPatrols(validPatrols);
      
      // If you want to show a message when there are no valid patrols
      if (validPatrols.length === 0 && (data.patrols_covering_coupe || []).length > 0) {
        // Optional: Show a console warning or set a state for showing a message
        console.log("No valid patrols found (all patrol_ids are null)");
      }
    } else {
      alert(response.data.message || t.noCoverageData);
    }
  } catch (err) {
    console.error("Error fetching coverage data:", err);
    alert(t.failedToLoad);
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
        alert(t.invalidDataFormat);
      }
    } catch (error) {
      console.error("Error fetching patrol details:", error);
      alert(t.failedToLoadPatrolDetails);
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
        [selectionMode === 'beat' ? t.beatLabel : t.boundaryLabel]: selectionMode === 'beat' ? selectedBeat.label : selectedBoundary.label,
        [t.areaUnit === "km²" ? "Area (sq m)" : "વિસ્તાર (ચો.મી.)"]: selectionMode === 'beat' ? coverageData.coupe_area_sq_m : coverageData.boundary_area_sq_m,
        [t.patrolCoveredArea === "Patrol Covered Area" ? "Patrol Covered Area (sq m)" : "પેટ્રોલ કવરેજ વિસ્તાર (ચો.મી.)"]: coverageData.patrol_area_sq_m,
        [t.coverage === "Coverage" ? "Coverage %" : "કવરેજ %"]: coverageData.coverage_percentage,
      },
    ];

    const patrolData = patrols.map((patrol) => ({
      [t.patrolId === "Patrol ID" ? "Patrol ID" : "પેટ્રોલ ID"]: patrol.patrol_id,
      [t.startTime === "Start Time" ? "Start Time" : "શરૂઆતનો સમય"]: formatDateTime(patrol.start_time, language),
      [t.endTime === "End Time" ? "End Time" : "સમાપ્તિ સમય"]: formatDateTime(patrol.end_time, language),
      [t.duration === "Duration" ? "Duration" : "અવધિ"]: formatDuration(patrol.start_time, patrol.end_time, language),
      [t.patrolOfficer === "Patrol Officer" ? "Patrol Officer" : "પેટ્રોલ અધિકારી"]: patrol.patrol_officer_name,
      [t.distance === "Distance" ? "Distance (kms)" : "અંતર (કિમી)"]: patrol.distance_kms,
      ["Start Location"]: patrol.start_location,
      ["End Location"]: patrol.end_location,
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
        .glow-button { background: #00A651; color: white; padding: 5px 10px; border-radius: 14px; font-weight: 600; cursor: pointer; transition: all 0.3s ease;border:none; }
        .glow-button:disabled { opacity: 0.6; cursor: not-allowed; transform: none; box-shadow: none; }
        .stats-card { background: linear-gradient(180deg, #2E7D32 0%, #66BB6A 100%);

; color: white; border-radius: 6px; padding: 25px; box-shadow: 0 10px 20px rgba(102, 126, 234, 0.15); transition: all 0.3s ease; }
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

      {/* Image Preview Modal */}
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
              {language === "gu" ? "છબી" : "Image"} {patrolDetails.images.findIndex(img => img.image_data === selectedImage) + 1} / {patrolDetails.images.length}
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

      {/* Patrol Details Modal */}
      {showPatrolModal && patrolDetails && !selectedImage && (
        <div className="modal-overlay" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, fontFamily: "arial" }} onClick={closePatrolModal}>
          <div className="modal-content" style={{ backgroundColor: "white", borderRadius: "12px", width: "90%", maxWidth: "800px", maxHeight: "60vh", overflow: "auto", position: "relative", boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "10px", borderBottom: "1px solid #f0f0f0", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#00A651", color: "white", borderRadius: "12px 12px 0 0" }}>
              <h2 style={{ fontSize: "24px", fontWeight: "600", margin: 0 }}>{t.patrolDetails}</h2>
              <button onClick={closePatrolModal} style={{ background: "rgba(255,255,255,0.2)", border: "none", fontSize: "20px", cursor: "pointer", color: "white", width: "40px", height: "40px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            </div>
            <div style={{ padding: "10px" }}>
              {loading.patrol ? (
                <div style={{ textAlign: "center", padding: "40px" }}><div style={{ border: "4px solid #f3f3f3", borderTop: "4px solid #2ada2aff", borderRadius: "50%", width: "60px", height: "60px", animation: "spin 1s linear infinite", margin: "0 auto 10px" }} /><p>{t.loading}</p></div>
              ) : (
                <>
                  <div style={{ backgroundColor: "#fff", borderRadius: "10px", padding: "10px", marginBottom: "10px", border: "1px solid #e2e8f0" }}>
                    <div style={{ display: "flex", alignItems: "center", marginBottom: "10px", borderBottom: "1px solid #B3B3B3" }}>
                      <div style={{ backgroundColor: "#9ce142ff", width: "40px", height: "40px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", marginRight: "12px", color: "white" }}><UserOutlined /></div>
                      <h3 style={{ margin: 0, fontSize: "20px", color: "#2d3748" }}>{t.patrolInformation}</h3>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "15px" }}>
                      <div><label>{t.patrolOfficer}</label><div>{patrolDetails.patrol_officer_name || "N/A"}</div></div>
                      <div><label>{t.patrolId}</label><div>{patrolDetails.patrol_id}</div></div>
                      <div><label>{t.distance}</label><div>{patrolDetails.distance_kms ? `${Number(patrolDetails.distance_kms).toFixed(2)} km` : "N/A"}</div></div>
                      <div><label>{t.patrolType}</label><div>{patrolDetails.type_name}</div></div>
                    </div>
                    {patrolDetails.note && (
                      <div style={{ marginTop: "20px" }}>
                        <label>{t.notes}</label>
                        <div>{patrolDetails.note}</div>
                      </div>
                    )}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "15px", marginTop: "20px" }}>
                      <div><label><CalendarOutlined /> {t.date}</label><div>{new Date(patrolDetails.start_time).toLocaleDateString(language === 'gu' ? 'gu-IN' : 'en-US')}</div></div>
                      <div><label><ClockCircleOutlined /> {t.startTime}</label><div>{formatDateTime(patrolDetails.start_time, language)}</div></div>
                      <div><label><ClockCircleOutlined /> {t.endTime}</label><div>{formatDateTime(patrolDetails.end_time, language)}</div></div>
                      <div><label>{t.duration}</label><div>{formatDuration(patrolDetails.start_time, patrolDetails.end_time, language)}</div></div>
                    </div>
                  </div>

                  {patrolDetails.images?.length > 0 && (
                    <div style={{ backgroundColor: "#fff", borderRadius: "10px", padding: "10px", border: "1px solid #e2e8f0" }}>
                      <div style={{ display: "flex", alignItems: "center", marginBottom: "10px", borderBottom: "2px solid #4299e1" }}>
                        <div style={{ backgroundColor: "#4299e1", width: "40px", height: "40px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", marginRight: "6px", color: "white" }}><PictureOutlined /></div>
                        <h3 style={{ margin: 0, fontSize: "20px", color: "#2d3748" }}>{t.patrolImages} ({patrolDetails.images.length})</h3>
                      </div>
                      <Image.PreviewGroup>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "15px" }}>
                          {patrolDetails.images.map((image, index) => (
                            <div key={index} className="image-card" style={{ border: "2px solid #e2e8f0", borderRadius: "8px", overflow: "hidden", cursor: "pointer", position: "relative" }} onClick={() => { setSelectedImage(image.image_data); setShowPatrolModal(false); setImageRotation(0); setImageScale(1); }}>
                              <div style={{ width: "100%", height: "140px", overflow: "hidden", position: "relative" }}>
                                <Image width="100%" height="100%" style={{ objectFit: "cover" }} src={getImageUrl(image.image_data)} alt={`${t.images} ${index + 1}`} preview={{ mask: <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "white" }}><SearchOutlined style={{ fontSize: "20px", marginBottom: "5px" }} /><span>{t.view}</span></div> }} />
                                <div style={{ position: "absolute", top: "8px", right: "8px", backgroundColor: "rgba(0,0,0,0.7)", color: "white", fontSize: "12px", padding: "1px 4px", borderRadius: "4px", zIndex: 1 }}>{index + 1}</div>
                              </div>
                              <div style={{ padding: "5px", backgroundColor: "#f8fafc", textAlign: "center" }}>{image.image_category || t.uncategorized}</div>
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
              {t.title}
            </h1>
          </div>
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
                    {t.division}
                  </label>
                  <Select
                    value={selectedDivision}
                    onChange={handleDivisionChange}
                    options={divisions}
                    isSearchable
                    isClearable
                    placeholder={loading.divisions ? t.loading : t.selectDivision}
                    isLoading={loading.divisions}
                    styles={customSelectStyles}
                    noOptionsMessage={() => t.noDivisions}
                  />
                </div>

                {/* Range Dropdown */}
                <div style={{ width: "200px" }}>
                  <label style={{ display: "block", fontWeight: "600", marginBottom: "10px", fontSize: "14px", color: "#2d3748", textTransform: "uppercase" }}>
                    {t.range}
                  </label>
                  <Select
                    value={selectedRange}
                    onChange={handleRangeChange}
                    options={ranges}
                    isSearchable
                    isClearable
                    placeholder={loading.ranges ? t.loading : t.selectRange}
                    isLoading={loading.ranges}
                    styles={customSelectStyles}
                    noOptionsMessage={() => t.noRanges}
                    isDisabled={!selectedDivision}
                  />
                </div>

                {/* Round Dropdown */}
                <div style={{ width: "200px" }}>
                  <label style={{ display: "block", fontWeight: "600", marginBottom: "10px", fontSize: "14px", color: "#2d3748", textTransform: "uppercase" }}>
                    {t.round}
                  </label>
                  <Select
                    value={selectedRound}
                    onChange={handleRoundChange}
                    options={rounds}
                    isSearchable
                    isClearable
                    placeholder={loading.rounds ? t.loading : t.selectRound}
                    isLoading={loading.rounds}
                    styles={customSelectStyles}
                    noOptionsMessage={() => t.noRounds}
                    isDisabled={!selectedRange}
                  />
                </div>

                {/* Beat Dropdown */}
                <div style={{ width: "200px" }}>
                  <label style={{ display: "block", fontWeight: "600", marginBottom: "10px", fontSize: "14px", color: "#2d3748", textTransform: "uppercase" }}>
                    {t.beat}
                  </label>
                  <Select
                    value={selectedBeat}
                    onChange={handleBeatChange}
                    options={beats}
                    isSearchable
                    isClearable
                    placeholder={loading.beats ? t.loading : t.selectBeat}
                    isLoading={loading.beats}
                    styles={customSelectStyles}
                    noOptionsMessage={() => t.noBeats}
                    isDisabled={!selectedRound}
                  />
                </div>
              </>
            ) : (
              /* Boundary Selection */
              <div style={{ width: "300px" }}>
                <label style={{ display: "block", fontWeight: "600", marginBottom: "10px", fontSize: "14px", color: "#2d3748", textTransform: "uppercase" }}>
                  {t.boundary}
                </label>
                <Select
                  value={selectedBoundary}
                  onChange={handleBoundaryChange}
                  options={boundaries}
                  isSearchable
                  isClearable
                  placeholder={loading.boundaries ? t.loadingBoundaries : t.selectBoundary}
                  isLoading={loading.boundaries}
                  styles={customSelectStyles}
                  noOptionsMessage={() => t.noBoundaries}
                />
              </div>
            )}

            {/* Month Picker */}
            <div style={{ width: "200px" }}>
              <label style={{ display: "block", fontWeight: "600", marginBottom: "10px", fontSize: "14px", color: "#2d3748", textTransform: "uppercase" }}>
                {t.month}
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
                style={{ fontFamily: "arial", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "12px 24px", marginLeft: "auto", boxShadow: '-10.261px -10.261px 5.13px -11.971px #fff inset, -10.261px -10.261px 5.13px -11.971px #fff inset, -10.261px -10.261px 5.13px -11.971px #fff inset, 13.681px 13.681px 7.696px -15.391px #fff inset' }}
              >
                {loading.coverage ? (
                  <>
                    <div style={{ border: "2px solid rgba(255,255,255,0.3)", borderTop: "2px solid white", borderRadius: "50%", width: "20px", height: "20px", animation: "spin 1s linear infinite" }} />
                    {t.analyzing}
                  </>
                ) : (
                  <>
                    {t.analyzeCoverage}
                  </>
                )}
              </button>
              <button
                onClick={resetData}
                disabled={loading.coverage}
                style={{ padding: "12px 24px", borderRadius: "8px", border: "2px solid #e2e8f0", fontSize: "14px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "8px", background: "#E7E4E4", color: "#4a5568", fontWeight: "600" }}
              >
                {t.reset}
              </button>
            </div>
          </div>
        </div>

        {/* Loading indicator */}
        {loading.coverage && (
          <div style={{ textAlign: "center", padding: "60px" }}>
            <div style={{ border: "6px solid #f3f3f3", borderTop: "6px solid #4299e1", borderRadius: "50%", width: "80px", height: "80px", animation: "spin 1s linear infinite", margin: "0 auto 20px" }} />
            <p style={{ color: "#718096", fontSize: "18px" }}>{t.loadingCoverage}</p>
          </div>
        )}

        {/* Coverage Data Display */}
        {coverageData && !loading.coverage && (
          <div style={{ backgroundColor: "#fff", borderRadius: "12px", padding: "25px", border: "1px solid #e2e8f0", boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.05)" }}>
            {/* Summary Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "20px", marginBottom: "30px" }}>
              <div className="stats-card">
                <p style={{ fontSize: "14px", margin: "0 0 12px 0", opacity: 0.9 }}>
                  {selectionMode === 'beat' ? t.beatLabel : t.boundaryLabel}
                </p>
                <div style={{ display: "inline-block", padding: "8px 20px", borderRadius: "20px", backgroundColor: "rgba(255,255,255,0.2)", border: "2px solid rgba(255,255,255,0.3)", fontSize: "18px", fontWeight: "600", backdropFilter: "blur(10px)" }}>
                  {selectionMode === 'beat' ? selectedBeat.label : selectedBoundary.label}
                </div>
              </div>
              <div className="stats-card" style={{ background: "linear-gradient(180deg, #33691E 0%, #8BC34A 100%)" }}>
                <p style={{ fontSize: "14px", margin: "0 0 12px 0", opacity: 0.9 }}>
                  {selectionMode === 'beat' ? t.beatArea : t.boundaryArea}
                </p>
                <h3 style={{ margin: "0", fontSize: "28px", fontWeight: "700" }}>
                  {(Number(selectionMode === 'beat' ? coverageData.coupe_area_sq_m : coverageData.coupe_area_sq_m) / 1000000).toFixed(2)} {t.areaUnit}
                </h3>
                <p style={{ fontSize: "12px", margin: "8px 0 0 0", opacity: 0.8 }}>
                  {Number(selectionMode === 'beat' ? coverageData.coupe_area_sq_m : coverageData.coupe_area_sq_m).toLocaleString()} {t.squareMeters}
                </p>
              </div>
              <div className="stats-card" style={{ background: "linear-gradient(180deg, #0F766E 0%, #2DD4BF 100%)" }}>
                <p style={{ fontSize: "14px", margin: "0 0 12px 0", opacity: 0.9 }}>{t.patrolCoveredArea}</p>
                <h3 style={{ margin: "0", fontSize: "28px", fontWeight: "700" }}>
                  {(Number(coverageData.patrol_area_sq_m) / 1000000).toFixed(2)} {t.areaUnit}
                </h3>
                <p style={{ fontSize: "12px", margin: "8px 0 0 0", opacity: 0.8 }}>
                  {Number(coverageData.patrol_area_sq_m).toLocaleString()} {t.squareMeters}
                </p>
              </div>
              <div className="stats-card" style={{ background: "linear-gradient(180deg, #F9A825 0%, #FDD835 100%)" }}>
                <p style={{ fontSize: "14px", margin: "0 0 12px 0", opacity: 0.9 }}>{t.coverage}</p>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <h3 style={{ margin: "0", fontSize: "36px", fontWeight: "700" }}>
                    {Number(coverageData.coverage_percentage).toFixed(2)}%
                  </h3>
                  
                </div>
              </div>
            </div>

            {/* Export Button */}
            <button className="glow-button" onClick={exportToExcel} style={{ marginBottom: "30px", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", padding: "12px 20px", boxShadow: '-10.261px -10.261px 5.13px -11.971px #fff inset, -10.261px -10.261px 5.13px -11.971px #fff inset, -10.261px -10.261px 5.13px -11.971px #fff inset, 13.681px 13.681px 7.696px -15.391px #fff inset' }}>
              <img src={vector} alt="Excel" style={{ width: "20px", height: "20px" }} /> {t.exportToExcel}
            </button>

            {/* Patrols List */}
            {/* Patrols List */}
{patrols.filter(patrol => patrol.patrol_id).length > 0 ? (
  <div style={{ marginTop: "20px" }}>
    <h3 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "20px", color: "#2d3748", display: "flex", alignItems: "center", gap: "10px" }}>
      <span style={{ backgroundColor: "#a5e06eff", color: "white", width: "32px", height: "32px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px" }}>
        {patrols.filter(patrol => patrol.patrol_id).length}
      </span>
      {t.patrolsInside} {selectionMode === 'beat' ? t.beatLabel : t.boundaryLabel}
    </h3>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "15px" }}>
      {patrols.map((patrol, index) => (
        patrol.patrol_id ? (
          <div 
            key={patrol.patrol_id || index} 
            className={`patrol-card ${selectedPatrol === patrol.patrol_id ? 'active' : ''}`} 
            onClick={() => fetchPatrolDetails(patrol.patrol_id)}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <p style={{ fontWeight: "700", margin: "0 0 8px 0", fontSize: "16px", color: selectedPatrol === patrol.patrol_id ? "#276749" : "#2d3748" }}>
                  {t.patrolId} #{patrol.patrol_id}
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
                    border: `1px solid ${patrol.patrol_type === "Day" ? "#bee3f8" : "#e9d8fd"}`
                  }}>
                    {patrol.patrol_type === "Day" ? t.dayPatrol : t.nightPatrol}
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
                fontWeight: "600" 
              }}>
                {patrols.filter(p => p.patrol_id).findIndex(p => p.patrol_id === patrol.patrol_id) + 1}
              </div>
            </div>
            {patrol.start_time && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #e2e8f0" }}>
                <CalendarOutlined style={{ color: "#a0aec0" }} />
                <span style={{ fontSize: "12px", color: "#718096" }}>
                  {new Date(patrol.start_time).toLocaleDateString(language === 'gu' ? 'gu-IN' : 'en-US')}
                </span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px" }}>
              <span style={{ fontSize: "11px", color: "#a0aec0", fontStyle: "italic" }}>{t.clickToView}</span>
              <span style={{ fontSize: "20px", color: selectedPatrol === patrol.patrol_id ? "#48bb78" : "#4299e1" }}>→</span>
            </div>
          </div>
        ) : null
      ))}
    </div>
  </div> 
) : (
  <div style={{ textAlign: "center", padding: "40px", backgroundColor: "#fff", borderRadius: "12px", border: "2px dashed #e2e8f0" }}>
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
      fontSize: "24px" 
    }}>
      ⚡
    </div>
    <p style={{ color: "#718096", fontSize: "16px", fontWeight: "500" }}>
      {t.noPatrolsFound} {selectionMode === 'beat' ? t.beatLabel : t.boundaryLabel}
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
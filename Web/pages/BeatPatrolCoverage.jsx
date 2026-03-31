import React, { useEffect, useState, useRef } from "react";
import {
  CloseOutlined,
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
} from "@ant-design/icons";
import { Table, Tag, Image as AntImage, Modal, Button, message } from "antd";
import axios from "axios";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import "./RouterMap.css";
import { API_BASE_URL } from "../config";
import Select from 'react-select';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import vector from '../assets/Vector.png';
import gisfylogo from "../assets/gisfylogo.png";
import noDataImage from "../assets/no-data.png";
import startIconImg from "../assets/marker-icon.png";
import endIconImg from "../assets/marker-icon-end.png";
import gujaratlogo from "../assets/FOREST DEPT.jpg";

import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Popup,
  useMap,
} from "react-leaflet";

// Helper to format date/time
const formatDateTime = (dateTime, language = 'en') => {
  if (!dateTime) return "N/A";
  const date = new Date(dateTime);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return { date: `${day}-${month}-${year}`, time: `${hours}:${minutes}` };
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

const startIcon = new L.Icon({
  iconUrl: startIconImg,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});
 
const endIcon = new L.Icon({
  iconUrl: endIconImg,
  iconSize: [25, 25],
  iconAnchor: [12, 12],
  popupAnchor: [0, -12],
});

function ResizeMapOnShow({ coords }) {
  const map = useMap();
  useEffect(() => {
    setTimeout(() => {
      map.invalidateSize();
      if (coords && coords.length > 1) {
        map.fitBounds(L.latLngBounds(coords), { padding: [50, 50] });
      }
    }, 700);
  }, [map, coords]);
  return null;
}

function PatrolMap({ patrol }) {
  if (!patrol?.geom) {
    return <p>No route available</p>;
  }

  const routeCoords = patrol.geom
    .split(",")
    .map((coord) => coord.trim().split(" ").map(Number))
    .map(([lat, lng]) => [lat, lng]);

  const start = routeCoords[0];
  const end = routeCoords[routeCoords.length - 1] || start;
  const initialZoom = 15;

  return (
    <MapContainer
      style={{ height: "400px", width: "100%" }}
      center={start}
      zoom={initialZoom}
      scrollWheelZoom={true}
    >
      <ResizeMapOnShow coords={routeCoords} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
        url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
      />
      <Marker position={start} icon={startIcon}>
        <Popup>Start</Popup>
      </Marker>
      {routeCoords.length > 1 && (
        <>
          <Marker position={end} icon={endIcon}>
            <Popup>End</Popup>
          </Marker>
          <Polyline
            positions={routeCoords}
            pathOptions={{ color: "blue", weight: 3, opacity: 1 }}
          />
        </>
      )}
      {routeCoords.length === 1 && (
        <Popup position={start}>Only one location point logged.</Popup>
      )}
    </MapContainer>
  );
}

const BeatPatrolCoverage = ({ language }) => {
  // Translations
  const translations = {
    en: {
      title: "Patrol Coverage Analysis",
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
      beat: "Beat",
      boundary: "Boundary",
      month: "Month",
      selectDivision: "Select Division",
      selectRange: "Select Range",
      selectBeat: "Select Beat",
      selectBoundary: "Select Boundary...",
      loadingBoundaries: "Loading boundaries...",
      noDivisions: "No divisions available",
      noRanges: "No ranges available",
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
      dayPatrol: "Day Patrol",
      nightPatrol: "Night Patrol",
      areaUnit: "km²",
      squareMeters: "m²",
      loadingCoverage: "Loading coverage data...",
      completeSelection: "Please complete the beat selection (Division → Range → Beat)",
      selectBoundaryFirst: "Please select a Boundary",
      selectMonthFirst: "Please select a month",
      noCoverageData: "No coverage data found",
      failedToLoad: "Failed to load coverage data",
      failedToLoadDivisions: "Failed to load divisions list",
      failedToLoadRanges: "Failed to load ranges",
      failedToLoadBeats: "Failed to load beats",
      failedToLoadBoundaries: "Failed to load patrol boundaries",
      failedToLoadPatrolDetails: "Failed to load patrol details",
      invalidDataFormat: "Failed to load patrol details: Invalid data format",
      srNo: "Sr. No.",
      startLocation: "Start Location",
      endLocation: "End Location",
      startDateTime: "Start Date",
      startTimeCol: "Start Time",
      endDateTime: "End Date",
      endTimeCol: "End Time",
      showRoute: "Route",
      patrolList: "Patrol List",
      patrolRoute: "Patrol Route",
      staff: "Staff",
      loadingPatrols: "Loading patrol details...",
      showing: "Showing",
      of: "of",
      items: "items",
      noDataAvailable: "No data available",
      noImagesFound: "No images found"
    },
    gu: {
      title: "પેટ્રોલ કવરેજ વિશ્લેષણ",
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
      beat: "બીટ",
      boundary: "બાઉન્ડ્રી",
      month: "મહિનો",
      selectDivision: "ડિવિઝન પસંદ કરો",
      selectRange: "રેંજ પસંદ કરો",
      selectBeat: "બીટ પસંદ કરો",
      selectBoundary: "બાઉન્ડ્રી પસંદ કરો...",
      loadingBoundaries: "બાઉન્ડ્રીઓ લોડ થઈ રહી છે...",
      noDivisions: "કોઈ ડિવિઝન ઉપલબ્ધ નથી",
      noRanges: "કોઈ રેંજ ઉપલબ્ધ નથી",
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
      dayPatrol: "દિવસનો પેટ્રોલ",
      nightPatrol: "રાત્રિનો પેટ્રોલ",
      areaUnit: "કિમી²",
      squareMeters: "મી²",
      loadingCoverage: "કવરેજ ડેટા લોડ થઈ રહ્યો છે...",
      completeSelection: "કૃપા કરીને બીટ પસંદગી પૂર્ણ કરો (ડિવિઝન → રેંજ → બીટ)",
      selectBoundaryFirst: "કૃપા કરીને બાઉન્ડ્રી પસંદ કરો",
      selectMonthFirst: "કૃપા કરીને મહિનો પસંદ કરો",
      noCoverageData: "કોઈ કવરેજ ડેટા મળ્યો નથી",
      failedToLoad: "કવરેજ ડેટા લોડ કરવામાં નિષ્ફળતા",
      failedToLoadDivisions: "ડિવિઝન સૂચિ લોડ કરવામાં નિષ્ફળ",
      failedToLoadRanges: "રેંજ લોડ કરવામાં નિષ્ફળતા",
      failedToLoadBeats: "બીટ લોડ કરવામાં નિષ્ફળતા",
      failedToLoadBoundaries: "પેટ્રોલ બાઉન્ડ્રીઓ લોડ કરવામાં નિષ્ફળતા",
      failedToLoadPatrolDetails: "પેટ્રોલ વિગતો લોડ કરવામાં નિષ્ફળતા",
      invalidDataFormat: "પેટ્રોલ વિગતો લોડ કરવામાં નિષ્ફળતા: અમાન્ય ડેટા ફોર્મેટ",
      srNo: "ક્રમાંક",
      startLocation: "શરૂઆતનું સ્થાન",
      endLocation: "અંતિમ સ્થાન",
      startDateTime: "શરૂઆતની તારીખ",
      startTimeCol: "શરૂઆતનો સમય",
      endDateTime: "સમાપ્તિ તારીખ",
      endTimeCol: "સમાપ્તિ સમય",
      showRoute: "રસ્તો",
      patrolList: "પેટ્રોલ યાદી",
      patrolRoute: "પેટ્રોલ માર્ગ",
      staff: "સ્ટાફ",
      loadingPatrols: "પેટ્રોલ વિગતો લોડ થઈ રહી છે...",
      showing: "બતાવી રહ્યા છીએ",
      of: "ના",
      items: "રેકોર્ડ",
      noDataAvailable: "કોઈ ડેટા ઉપલબ્ધ નથી",
      noImagesFound: "કોઈ છબીઓ મળી નથી"
    }
  };

  const t = translations[language] || translations.en;

  // Selection states
  const [selectedDivision, setSelectedDivision] = useState(null);
  const [selectedRange, setSelectedRange] = useState(null);
  const [selectedBeat, setSelectedBeat] = useState(null);
  const [selectedBoundary, setSelectedBoundary] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectionMode, setSelectionMode] = useState('boundary');

  // Data states
  const [divisions, setDivisions] = useState([]);
  const [ranges, setRanges] = useState([]);
  const [beats, setBeats] = useState([]);
  const [boundaries, setBoundaries] = useState([]);
  
  const [loading, setLoading] = useState({
    divisions: false,
    ranges: false,
    beats: false,
    boundaries: false,
    coverage: false,
    patrolDetails: false
  });
  
  const [coverageData, setCoverageData] = useState(null);
  const [patrols, setPatrols] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isLoadingPatrols, setIsLoadingPatrols] = useState(false);

  // Modal states
  const [selectedPatrolForRoute, setSelectedPatrolForRoute] = useState(null);
  const [isRouteModalVisible, setIsRouteModalVisible] = useState(false);
  const [selectedPatrolForImages, setSelectedPatrolForImages] = useState(null);
  const [patrolDetails, setPatrolDetails] = useState(null);
  const [showImagesModal, setShowImagesModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageRotation, setImageRotation] = useState(0);
  const [imageScale, setImageScale] = useState(1);

  const getTypeColor = (type) => {
    switch (type) {
      case "Day patrolling": return "blue";
      case "Night patrolling": return "purple";
      case "Beat checking": return "green";
      default: return "default";
    }
  };

  const getTypeDisplayName = (type) => {
    if (language === "gu") {
      switch (type) {
        case "Day patrolling": return "દિવસ પેટ્રોલિંગ";
        case "Night patrolling": return "રાત પેટ્રોલિંગ";
        case "Beat checking": return "બીટ ચેકિંગ";
        default: return type;
      }
    }
    return type;
  };

  // Fetch full patrol details for all patrols in coverage result
  const fetchFullPatrolDetails = async (patrolIds) => {
    setIsLoadingPatrols(true);
    const token = localStorage.getItem("token");
    const fullPatrols = [];
    
    try {
      for (const patrolId of patrolIds) {
        const response = await axios.get(`${API_BASE_URL}/api/patrols/${patrolId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.data && response.data.data) {
          fullPatrols.push(response.data.data);
        }
      }
      setPatrols(fullPatrols);
    } catch (error) {
      console.error("Error fetching patrol details:", error);
      message.error(t.failedToLoadPatrolDetails);
    } finally {
      setIsLoadingPatrols(false);
    }
  };

  // Fetch patrol images
  const fetchPatrolImages = async (patrolId) => {
    setLoading(prev => ({ ...prev, patrolDetails: true }));
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_BASE_URL}/api/patrols/${patrolId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data && response.data.data) {
        setPatrolDetails(response.data.data);
        setSelectedPatrolForImages(patrolId);
        setShowImagesModal(true);
      } else {
        message.error(t.invalidDataFormat);
      }
    } catch (error) {
      console.error("Error fetching patrol details:", error);
      message.error(t.failedToLoadPatrolDetails);
    } finally {
      setLoading(prev => ({ ...prev, patrolDetails: false }));
    }
  };

  const closeImagesModal = () => {
    setShowImagesModal(false);
    setSelectedPatrolForImages(null);
    setPatrolDetails(null);
    setSelectedImage(null);
    setImageRotation(0);
    setImageScale(1);
  };

  const closeRouteModal = () => {
    setIsRouteModalVisible(false);
    setSelectedPatrolForRoute(null);
  };

  // Table columns
  const getPatrolTableColumns = () => [
    {
      title: t.srNo,
      key: "serial",
      align: "center",
      width: 80,
      render: (text, record, index) => (currentPage - 1) * pageSize + index + 1,
    },
    {
      title: t.patrolType,
      dataIndex: "type_name",
      key: "type_name",
      align: "center",
      render: (type) => <Tag color={getTypeColor(type)}>{getTypeDisplayName(type)}</Tag>,
    },
    {
      title: t.patrolOfficer,
      dataIndex: "patrol_officer_name",
      key: "patrol_officer_name",
      align: "center",
    },
    {
      title: t.division,
      dataIndex: "division",
      key: "division",
      align: "center",
    },
    {
      title: t.range,
      dataIndex: "range",
      key: "range",
      align: "center",
    },
    {
      title: t.beat,
      dataIndex: "beat",
      key: "beat",
      align: "center",
    },
    {
      title: t.startDateTime,
      key: "start_date",
      align: "center",
      render: (record) => formatDateTime(record.start_time, language).date,
      sorter: (a, b) => new Date(a.start_time) - new Date(b.start_time),
    },
    {
      title: t.startTimeCol,
      key: "start_time",
      align: "center",
      render: (record) => formatDateTime(record.start_time, language).time,
    },
    {
      title: t.endDateTime,
      key: "end_date",
      align: "center",
      render: (record) => formatDateTime(record.end_time, language).date,
      sorter: (a, b) => new Date(a.end_time) - new Date(b.end_time),
    },
    {
      title: t.endTimeCol,
      key: "end_time",
      align: "center",
      render: (record) => formatDateTime(record.end_time, language).time,
    },
    {
      title: t.startLocation,
      dataIndex: "start_location",
      key: "start_location",
      align: "center",
    },
    {
      title: t.endLocation,
      dataIndex: "end_location",
      key: "end_location",
      align: "center",
    },
    {
      title: t.distance,
      dataIndex: "distance_kms",
      key: "distance_kms",
      align: "center",
      render: (distance) => distance ? `${Number(distance).toFixed(2)}` : "N/A",
      sorter: (a, b) => parseFloat(a.distance_kms) - parseFloat(b.distance_kms),
    },
    {
      title: t.staff,
      dataIndex: "number_of_staff",
      key: "number_of_staff",
      align: "center",
    },
    {
      title: t.showRoute,
      key: "route",
      align: "center",
      render: (record) => (
        <Button
          style={{
            borderRadius: "4.618px",
            border: "1.961px solid rgba(255, 255, 255, 0.23)",
            background: "rgba(116, 190, 0, 0.40)",
            color: "#000",
          }}
          icon={<EyeOutlined />}
          onClick={() => {
            setSelectedPatrolForRoute(record);
            setIsRouteModalVisible(true);
          }}
        >
          {t.view}
        </Button>
      ),
    },
    {
      title: t.images,
      key: "images",
      align: "center",
      render: (record) => (
        <Button
          style={{
            borderRadius: "4.618px",
            border: "1.961px solid rgba(255, 255, 255, 0.23)",
            background: "rgba(0, 166, 81, 0.40)",
            color: "#000",
          }}
          icon={<PictureOutlined />}
          onClick={() => fetchPatrolImages(record.patrol_id)}
        >
          {t.view}
        </Button>
      ),
    },
  ];

  // Fetch boundaries
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
      console.log(res.data.data);

      setBoundaries(boundaryList);
    } catch (err) {
      console.error(err);
      message.error(t.failedToLoadBoundaries);
    } finally {
      setLoading(prev => ({ ...prev, boundaries: false }));
    }
  };

  // Fetch divisions
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
      message.error(t.failedToLoadDivisions);
    } finally {
      setLoading(prev => ({ ...prev, divisions: false }));
    }
  };

  // Fetch ranges
  const fetchRanges = async (division) => {
    if (!division) return;
    
    setLoading(prev => ({ ...prev, ranges: true }));
    setSelectedRange(null);
    setSelectedBeat(null);
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
      message.error(t.failedToLoadRanges);
    } finally {
      setLoading(prev => ({ ...prev, ranges: false }));
    }
  };

  // Fetch beats
  const fetchBeats = async (division, range) => {
    if (!division || !range) return;
    
    setLoading(prev => ({ ...prev, beats: true }));
    setSelectedBeat(null);
    
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${API_BASE_URL}/api/beat-coupe-beats`,
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
      message.error(t.failedToLoadBeats);
    } finally {
      setLoading(prev => ({ ...prev, beats: false }));
    }
  };

  useEffect(() => {
    fetchDivisions();
    fetchPatrolBoundaries();
  }, []);

  const handleDivisionChange = (selectedOption) => {
    setSelectedDivision(selectedOption);
    setSelectedRange(null);
    setSelectedBeat(null);
    setRanges([]);
    setBeats([]);
    resetData();
    
    if (selectedOption) {
      fetchRanges(selectedOption);
    }
  };

  const handleRangeChange = (selectedOption) => {
    setSelectedRange(selectedOption);
    setSelectedBeat(null);
    setBeats([]);
    resetData();
    
    if (selectedOption && selectedDivision) {
      fetchBeats(selectedDivision, selectedOption);
    }
  };

  const handleBeatChange = (selectedOption) => {
    setSelectedBeat(selectedOption);
    resetData();
  };

  const handleBoundaryChange = (selectedOption) => {
    setSelectedBoundary(selectedOption);
    if (selectedOption) {
      setSelectedDivision(null);
      setSelectedRange(null);
      setSelectedBeat(null);
      setSelectionMode('boundary');
    }
  };

  const handleMonthChange = (e) => {
    setSelectedMonth(e.target.value);
  };

  const resetData = () => {
    setCoverageData(null);
    setPatrols([]);
    setSelectedPatrolForRoute(null);
    setSelectedPatrolForImages(null);
    setPatrolDetails(null);
    setShowImagesModal(false);
    setSelectedImage(null);
    setImageRotation(0);
    setImageScale(1);
    setSelectedMonth("");
    setCurrentPage(1);
  };

  // Fetch coverage data
  const fetchCoverageData = async () => {
    if (selectionMode === 'beat' && !selectedBeat) {
      message.warning(t.completeSelection);
      return;
    }
    if (selectionMode === 'boundary' && !selectedBoundary) {
      message.warning(t.selectBoundaryFirst);
      return;
    }
    if (!selectedMonth) {
      message.warning(t.selectMonthFirst);
      return;
    }

    setLoading(prev => ({ ...prev, coverage: true }));
    
    try {
      const token = localStorage.getItem("token");
      
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
        console.log(data);
        setCoverageData(data);
        
        // Extract patrol IDs from the response
        const patrolIds = [];
        if (data.patrols_covering_coupe && Array.isArray(data.patrols_covering_coupe)) {
          data.patrols_covering_coupe.forEach(patrol => {
            if (patrol.patrol_id) {
              patrolIds.push(patrol.patrol_id);
            }
          });
        }
        
        if (patrolIds.length > 0) {
          await fetchFullPatrolDetails(patrolIds);
        } else {
          setPatrols([]);
          message.info(t.noPatrolsFound);
        }
      } else {
        message.error(response.data.message || t.noCoverageData);
      }
    } catch (err) {
      console.error("Error fetching coverage data:", err);
      message.error(t.failedToLoad);
    } finally {
      setLoading(prev => ({ ...prev, coverage: false }));
    }
  };

  const handlePageChange = (page, newPageSize) => {
    setCurrentPage(page);
    setPageSize(newPageSize);
  };

  // Export to Excel
  const exportToExcel = () => {
    if (!coverageData) return;

    const summaryData = [
      {
        [selectionMode === 'beat' ? t.beatLabel : t.boundaryLabel]: selectionMode === 'beat' ? selectedBeat.label : selectedBoundary.label,
        "Boundary Area (sq m)": selectionMode === 'beat' ? coverageData.coupe_area_sq_m : coverageData.coupe_area_sq_m,
        "Patrol Covered Area (sq m)": coverageData.patrol_area_sq_m,
        "Coverage %": coverageData.coverage_percentage,
      },
    ];

    const patrolData = patrols.map((patrol, idx) => ({
      [t.srNo]: idx + 1,
      [t.patrolType]: patrol.type_name,
      [t.patrolOfficer]: patrol.patrol_officer_name,
      [t.division]: patrol.division,
      [t.range]: patrol.range,
      [t.beat]: patrol.beat,
      [t.startDateTime]: formatDateTime(patrol.start_time, language).date,
      [t.startTimeCol]: formatDateTime(patrol.start_time, language).time,
      [t.endDateTime]: formatDateTime(patrol.end_time, language).date,
      [t.endTimeCol]: formatDateTime(patrol.end_time, language).time,
      [t.startLocation]: patrol.start_location,
      [t.endLocation]: patrol.end_location,
      [t.distance]: patrol.distance_kms,
      [t.staff]: patrol.number_of_staff,
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
      ? `${selectedBeat.value}_patrol_coverage_${selectedMonth}.xlsx`
      : `${selectedBoundary.label}_patrol_coverage_${selectedMonth}.xlsx`;
    
    saveAs(
      new Blob([excelBuffer], { type: "application/octet-stream" }),
      fileName
    );
  };

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
      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideIn { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }
        .glow-button { background: #00A651; color: white; padding: 5px 10px; border-radius: 14px; font-weight: 600; cursor: pointer; transition: all 0.3s ease; border: none; }
        .glow-button:disabled { opacity: 0.6; cursor: not-allowed; transform: none; box-shadow: none; }
        .stats-card { background: linear-gradient(180deg, #2E7D32 0%, #66BB6A 100%); color: black; border-radius: 16px; padding: 25px; }
        .stats-card:hover { transform: translateY(-5px); box-shadow: 0 15px 30px rgba(102, 126, 234, 0.25); }
        .transparent-table .ant-table {
          background: transparent !important;
        }
        .transparent-table .ant-table-thead > tr > th {
          background: #00A651 !important;
          font-weight: 600;
          color: white;
        }
        .transparent-table .ant-table-tbody > tr > td {
          background: rgba(255, 255, 255, 0.7) !important;
        }
        
      `}</style>

      {/* Route Modal */}
      <Modal
        open={isRouteModalVisible}
        onCancel={closeRouteModal}
        footer={null}
        width={800}
        title={
          selectedPatrolForRoute
            ? `${t.patrolRoute} - ${selectedPatrolForRoute.patrol_officer_name} (${t.distance}: ${selectedPatrolForRoute.distance_kms} km)`
            : t.patrolRoute
        }
      >
        {selectedPatrolForRoute && (
          <PatrolMap patrol={selectedPatrolForRoute} />
        )}
      </Modal>

      {/* Images Modal */}
      {showImagesModal && patrolDetails && !selectedImage && (
        <div className="modal-overlay" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }} onClick={closeImagesModal}>
          <div className="modal-content" style={{ backgroundColor: "white", borderRadius: "12px", width: "90%", maxWidth: "800px", maxHeight: "80vh", overflow: "auto", position: "relative", boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "10px", borderBottom: "1px solid #f0f0f0", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#00A651", color: "white", borderRadius: "12px 12px 0 0" }}>
              <h2 style={{ fontSize: "24px", fontWeight: "600", margin: 0 }}>{t.patrolImages}</h2>
              <button onClick={closeImagesModal} style={{ background: "rgba(255,255,255,0.2)", border: "none", fontSize: "20px", cursor: "pointer", width: "40px", height: "40px", borderRadius: "50%" }}>✕</button>
            </div>
            <div style={{ padding: "10px" }}>
              {patrolDetails.images?.length > 0 ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "15px" }}>
                  {patrolDetails.images.map((image, index) => (
                    <div key={index} style={{ border: "2px solid #e2e8f0", borderRadius: "8px", overflow: "hidden", cursor: "pointer" }} onClick={() => { setSelectedImage(image.image_data); setShowImagesModal(false); setImageRotation(0); setImageScale(1); }}>
                      <div style={{ width: "100%", height: "140px", overflow: "hidden", position: "relative" }}>
                        <AntImage width="100%" height="100%" style={{ objectFit: "cover" }} src={getImageUrl(image.image_data)} alt={`${t.images} ${index + 1}`} preview={false} />
                        <div style={{ position: "absolute", top: "8px", right: "8px", backgroundColor: "rgba(0,0,0,0.7)", color: "white", fontSize: "12px", padding: "2px 6px", borderRadius: "4px" }}>{index + 1}</div>
                      </div>
                      <div style={{ padding: "5px", backgroundColor: "#f8fafc", textAlign: "center" }}>{image.image_category || t.uncategorized}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: "40px", color: "#999" }}>{t.noImagesFound}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {selectedImage && (
        <div 
          style={{ 
            position: "fixed", 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            backgroundColor: "rgba(0,0,0,0.9)", 
            display: "flex", 
            justifyContent: "center", 
            alignItems: "center", 
            zIndex: 10000 
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedImage(null); 
              setShowImagesModal(true); 
              setImageRotation(0); 
              setImageScale(1);
            }
          }}
        >
          <button 
            style={{ 
              position: "absolute", 
              top: "20px", 
              right: "20px", 
              background: "white", 
              border: "none", 
              borderRadius: "50%", 
              width: "40px", 
              height: "40px", 
              cursor: "pointer", 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center",
              zIndex: 10001
            }} 
            onClick={(e) => {
              e.stopPropagation();
              setSelectedImage(null); 
              setShowImagesModal(true); 
              setImageRotation(0); 
              setImageScale(1);
            }}
          >
            <CloseOutlined style={{ fontSize: "20px" }} />
          </button>
          
          <img 
            src={getImageUrl(selectedImage)} 
            alt="Preview" 
            style={{ 
              maxWidth: "90%", 
              maxHeight: "90%", 
              transform: `rotate(${imageRotation}deg) scale(${imageScale})`, 
              transition: "transform 0.3s ease",
              cursor: "pointer"
            }} 
            onClick={(e) => e.stopPropagation()}
          />
          
          <div 
            style={{ 
              position: "absolute", 
              bottom: "20px", 
              left: "50%", 
              transform: "translateX(-50%)", 
              display: "flex", 
              gap: "10px", 
              background: "rgba(0,0,0,0.7)", 
              padding: "10px 20px", 
              borderRadius: "30px",
              zIndex: 10001
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setImageScale(prev => Math.max(0.5, prev - 0.25));
              }}
              style={{ 
                background: "rgba(255,255,255,0.2)", 
                border: "none", 
                width: "40px", 
                height: "40px", 
                borderRadius: "50%", 
                cursor: "pointer", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center", 
                color: "white", 
                transition: "all 0.3s ease",
                fontSize: "18px"
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.4)"}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.2)"}
              title="Zoom Out"
            >
              <ZoomOutOutlined />
            </button>
            
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setImageRotation(prev => prev - 90);
              }}
              style={{ 
                background: "rgba(255,255,255,0.2)", 
                border: "none", 
                width: "40px", 
                height: "40px", 
                borderRadius: "50%", 
                cursor: "pointer", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center", 
                color: "white", 
                transition: "all 0.3s ease",
                fontSize: "18px"
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.4)"}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.2)"}
              title="Rotate Left"
            >
              <RotateLeftOutlined />
            </button>
            
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setImageRotation(0);
                setImageScale(1);
              }}
              style={{ 
                background: "rgba(255,255,255,0.2)", 
                border: "none", 
                width: "40px", 
                height: "40px", 
                borderRadius: "50%", 
                cursor: "pointer", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center", 
                color: "white", 
                transition: "all 0.3s ease",
                fontSize: "18px"
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.4)"}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.2)"}
              title="Reset"
            >
              <UndoOutlined />
            </button>
            
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setImageRotation(prev => prev + 90);
              }}
              style={{ 
                background: "rgba(255,255,255,0.2)", 
                border: "none", 
                width: "40px", 
                height: "40px", 
                borderRadius: "50%", 
                cursor: "pointer", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center", 
                color: "white", 
                transition: "all 0.3s ease",
                fontSize: "18px"
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.4)"}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.2)"}
              title="Rotate Right"
            >
              <RotateRightOutlined />
            </button>
            
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setImageScale(prev => Math.min(3, prev + 0.25));
              }}
              style={{ 
                background: "rgba(255,255,255,0.2)", 
                border: "none", 
                width: "40px", 
                height: "40px", 
                borderRadius: "50%", 
                cursor: "pointer", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center", 
                color: "white", 
                transition: "all 0.3s ease",
                fontSize: "18px"
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.4)"}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.2)"}
              title="Zoom In"
            >
              <ZoomInOutlined />
            </button>
          </div>
        </div>
      )}

      {/* Main Container */}
      <div style={{ padding: "20px" }}>
        <h1 style={{ fontSize: "26px", fontWeight: "700", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" , backgroundColor:'black'}}>
          {t.title}
        </h1>
        <p style={{ fontSize: "12px",}}>{language === "gu" ? "કૃપા કરીને પેટ્રોલ કવરેજ વિશ્લેષણ માટે બાઉન્ડ્રી અને મહિનો પસંદ કરો" : "Please select the Boundary and month for patrol coverage analysis."}</p>

        {/* Selection Card */}
        <div style={{ backgroundColor: "#fff", borderRadius: "12px", paddingTop: "25px", marginBottom: "25px" }}>
          <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", alignItems: "flex-end" }}>
              {selectionMode === 'beat' ? (
                <>
                  <div style={{ width: "200px" }}>
                    <label style={{ display: "block", fontWeight: "600", marginBottom: "8px" }}>{t.division}</label>
                    <Select value={selectedDivision} onChange={handleDivisionChange} options={divisions} isClearable placeholder={t.selectDivision} styles={customSelectStyles} />
                  </div>
                  <div style={{ width: "200px" }}>
                    <label style={{ display: "block", fontWeight: "600", marginBottom: "8px" }}>{t.range}</label>
                    <Select value={selectedRange} onChange={handleRangeChange} options={ranges} isClearable placeholder={t.selectRange} styles={customSelectStyles} isDisabled={!selectedDivision} />
                  </div>
                  <div style={{ width: "200px" }}>
                    <label style={{ display: "block", fontWeight: "600", marginBottom: "8px" }}>{t.beat}</label>
                    <Select value={selectedBeat} onChange={handleBeatChange} options={beats} isClearable placeholder={t.selectBeat} styles={customSelectStyles} isDisabled={!selectedRange} />
                  </div>
                </>
              ) : (
                <div style={{ width: "300px" }}>
                  <label style={{ display: "block", fontWeight: "600", marginBottom: "8px" }}>{t.boundary}</label>
                  <Select value={selectedBoundary} onChange={handleBoundaryChange} options={boundaries} isClearable placeholder={t.selectBoundary} styles={customSelectStyles} />
                </div>
              )}
              <div style={{ width: "200px" }}>
                <label style={{ display: "block", fontWeight: "600", marginBottom: "8px" }}>{t.month}</label>
                <input type="month" value={selectedMonth} onChange={handleMonthChange} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "2px solid #e2e8f0" }} />
              </div>
            </div>
            
            <div style={{ display: "flex", gap: "10px", alignItems: "center", marginRight: '50px' }}>
              <button 
                className="glow-button" 
                onClick={fetchCoverageData} 
                disabled={loading.coverage} 
                style={{ padding: "10px 24px", boxShadow: '-10.261px -10.261px 5.13px -11.971px #fff inset,-10.261px -10.261px 5.13px -11.971px #fff inset,-10.261px -10.261px 5.13px -11.971px #fff inset,13.681px 13.681px 7.696px -15.391px #fff inset' }}
              >
                {loading.coverage ? t.analyzing : t.analyzeCoverage}
              </button>
              <button 
                onClick={resetData} 
                style={{ 
                  padding: "10px 24px", 
                  borderRadius: "8px", 
                  border: "2px solid #e2e8f0", 
                  background: "#E7E4E4", 
                  cursor: "pointer",
                  transition: "all 0.3s ease"
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "#d4d4d4"}
                onMouseLeave={(e) => e.currentTarget.style.background = "#E7E4E4"}
              >
                {t.reset}
              </button>
            </div>
          </div>
        </div>

        {/* Patrols Table */}
            {isLoadingPatrols ? (
              <div style={{ textAlign: "center", padding: "60px" }}>
                <div style={{ border: "6px solid #f3f3f3", borderTop: "6px solid #4299e1", borderRadius: "50%", width: "60px", height: "60px", animation: "spin 1s linear infinite", margin: "0 auto 20px" }} />
                <p>{t.loadingPatrols}</p>
              </div>
            ) : patrols.length > 0 ? (
              <>
                <h3 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "20px", display: "flex", alignItems: "center", gap: "10px" }}>
                  {t.patrolsInside} {selectionMode === 'beat' ? t.beatLabel : t.boundaryLabel}
                </h3>
                <Table
                  className="transparent-table"
                  columns={getPatrolTableColumns()}
                  dataSource={patrols}
                  pagination={{
                    current: currentPage,
                    pageSize: pageSize,
                    total: patrols.length,
                    onChange: handlePageChange,
                    showSizeChanger: true,
                    showQuickJumper: true,
                    showTotal: (total, range) => `${t.showing} ${range[0]}-${range[1]} ${t.of} ${total} ${t.items}`,
                    pageSizeOptions: ['5', '10', '20', '50'],
                  }}
                  bordered
                  scroll={{ x: 'max-content' }}
                  rowKey="patrol_id"
                  locale={{
                    emptyText: (
                      <div style={{ textAlign: "center", padding: "50px 0" }}>
                        <img src={noDataImage} alt="No Data" style={{ width: 60, marginBottom: 16 }} />
                        <div style={{ fontSize: 16, color: "#000", fontWeight: 500 }}>{t.noDataAvailable}</div>
                      </div>
                    ),
                  }}
                />
              </>
            ) : (
              <div style={{ textAlign: "center", padding: "40px", border: "2px dashed #e2e8f0", borderRadius: "12px", marginBottom: '50px' }}>
                <div style={{ width: "60px", height: "60px", backgroundColor: "#fed7d7", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: "24px" }}>⚡</div>
                <p style={{ color: "#718096" }}>{t.noPatrolsFound} {selectionMode === 'beat' ? t.beatLabel : t.boundaryLabel}</p>
              </div>
            )}

        {/* Coverage Data Display */}
        {coverageData && (
          <div style={{ backgroundColor: "#fff", borderRadius: "12px" }}>

            
            {/* Summary Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "20px", marginBottom: "30px" }}>
              <div className="stats-card" style={{ background: "rgba(56, 189, 248, 0.3)"}}>
                <p style={{ fontSize: "14px", marginBottom: "8px", opacity: 0.9 }}>{selectionMode === 'beat' ? t.beatLabel : t.boundaryLabel}</p>
                <div style={{ padding: "8px 20px", borderRadius: "20px", backgroundColor: "rgba(255,255,255,0.5)", display: "inline-block" }}>
                  {selectionMode === 'beat' ? selectedBeat.label : selectedBoundary.label}
                </div>
              </div>
              <div className="stats-card" style={{ background: "rgba(0, 255, 162, 0.3)" }}>
                <p style={{ fontSize: "14px", marginBottom: "8px", opacity: 0.9 }}>{selectionMode === 'beat' ? t.beatArea : t.boundaryArea}</p>
                <h3 style={{ fontSize: "28px", margin: 0 }}>{(Number(selectionMode === 'beat' ? coverageData.coupe_area_sq_m : coverageData.coupe_area_sq_m) / 1000000).toFixed(2)} {t.areaUnit}</h3>
              </div>
              <div className="stats-card" style={{ background: "rgba(64, 0, 255, 0.3)" }}>
                <p style={{ fontSize: "14px", marginBottom: "8px", opacity: 0.9 }}>{t.patrolCoveredArea}</p>
                <h3 style={{ fontSize: "28px", margin: 0 }}>{(Number(coverageData.patrol_area_sq_m) / 1000000).toFixed(2)} {t.areaUnit}</h3>
              </div>
              <div className="stats-card" style={{ background: "linear-gradient(180deg, #F9A825 0%, #FDD835 100%)" }}>
                <p style={{ fontSize: "14px", marginBottom: "8px", opacity: 0.9 }}>{t.coverage}</p>
                <h3 style={{ fontSize: "36px", margin: 0 }}>{Number(coverageData.coverage_percentage).toFixed(2)}%</h3>
              </div>
            </div>

            {/* Export Button */}
            <button className="glow-button" onClick={exportToExcel} style={{ marginBottom: "30px", padding: "10px 24px", display: "flex", alignItems: "center", gap: "8px", boxShadow: '-10.261px -10.261px 5.13px -11.971px #fff inset,-10.261px -10.261px 5.13px -11.971px #fff inset,-10.261px -10.261px 5.13px -11.971px #fff inset,13.681px 13.681px 7.696px -15.391px #fff inset' }}>
              <img src={vector} alt="Excel" style={{ width: "20px" }} /> {t.exportToExcel}
            </button>

            
          </div>
        )}
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
};

export default BeatPatrolCoverage;
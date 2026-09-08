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
import { Table, Tag, Image as AntImage, Modal, Button, message, Row, Col, Pagination } from "antd";
import axios from "axios";
import "./RouterMap.css";
import "./BeatPatrolCoverage.css";
import { API_BASE_URL } from "../config";
import { getUserDivision, matchesDivision, getMostSpecificLevel } from "../utils/authUtils";
import Select from 'react-select';
import vector from '../assets/Vector.png';
import gisfylogo from "../assets/Gisfylogo.png";
import noDataImage from "../assets/no-data.png";
import startIconImg from "../assets/marker-icon.png";
import endIconImg from "../assets/marker-icon-end.png";
import gujaratlogo from "../assets/FOREST DEPT.jpg";
import { useLanguage } from "../context/LanguageContext";

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
const parsePatrolTimestamp = (dateTime) => {
  if (!dateTime) return null;
  if (dateTime instanceof Date) return Number.isNaN(dateTime.getTime()) ? null : dateTime;
  if (typeof dateTime === "string") {
    const match = dateTime.match(/^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2})$/);
    if (match) {
      const [, day, month, year, hour, minute] = match;
      return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
    }
  }
  const date = new Date(dateTime);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDateTime = (dateTime, language = 'en') => {
  if (!dateTime) return "-";
  if (typeof dateTime === "string") {
    const match = dateTime.match(/^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2})$/);
    if (match) {
      const [, day, month, year, hour, minute] = match;
      return { date: `${day}-${month}-${year}`, time: `${hour}:${minute}` };
    }
  }
  const date = parsePatrolTimestamp(dateTime);
  if (!date) return { date: "-", time: "-" };
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});
  return { date: `${parts.day}-${parts.month}-${parts.year}`, time: `${parts.hour}:${parts.minute}` };
};

const formatDuration = (startTime, endTime, language = 'en') => {
  if (!startTime || !endTime) return "-";
  const start = parsePatrolTimestamp(startTime);
  const end = parsePatrolTimestamp(endTime);
  if (!start || !end) return "-";
  const durationMs = end - start;
  if (!Number.isFinite(durationMs) || durationMs < 0) return "-";
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
        attribution='&copy; <a href="https://s2maps.eu">Sentinel-2 cloudless - https://s2maps.eu</a> by EOX'
        url="https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg"
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

const BeatPatrolCoverage = () => {
  const { language } = useLanguage();
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
      noImagesFound: "No images found",
      details: "Details",
      route: "Route",
      photos: "Photos"
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
      noImagesFound: "કોઈ છબીઓ મળી નથી",
      details: "વિગતો",
      route: "રસ્તો",
      photos: "ફોટા"
    }
  };

  const t = translations[language] || translations.en;

  // Selection states
  // Use state + useEffect to avoid stale reads when component mounts before
  // userData is set in localStorage (right after login).
  // undefined = not yet resolved, null = no division (PCCF), string = locked division
  const [lockedDivision, setLockedDivision] = useState(undefined);
  const [selectedDivision, setSelectedDivision] = useState(null);
  const [selectedRange, setSelectedRange] = useState(null);
  const [selectedBeat, setSelectedBeat] = useState(null);
  const [selectedBoundary, setSelectedBoundary] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectionMode, setSelectionMode] = useState('boundary');
  const [validationError, setValidationError] = useState(false);

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
  const [pageSize, setPageSize] = useState(5);
  const [totalItems, setTotalItems] = useState(0);
  const [isLoadingPatrols, setIsLoadingPatrols] = useState(false);

  // Modal states - Single modal for both photos and map
  const [selectedPatrolForDetails, setSelectedPatrolForDetails] = useState(null);
  const [isDetailsModalVisible, setIsDetailsModalVisible] = useState(false);
  const [combinedPatrolDetails, setCombinedPatrolDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Image preview states
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

  const getAuthToken = async () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const token = localStorage.getItem("token");
      if (token) return token;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return localStorage.getItem("token");
  };

  // Fetch full patrol details for all patrols in coverage result
  const fetchFullPatrolDetails = async (patrolIds) => {
    setIsLoadingPatrols(true);
    const token = await getAuthToken();
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
      setTotalItems(fullPatrols.length);
    } catch (error) {
      console.error("Error fetching patrol details:", error);
      message.error(t.failedToLoadPatrolDetails);
    } finally {
      setIsLoadingPatrols(false);
    }
  };

  // Fetch patrol details for modal (photos + map)
  const fetchPatrolDetails = async (patrol) => {
    setLoadingDetails(true);
    setSelectedPatrolForDetails(patrol);
    
    try {
      const token = await getAuthToken();
      const response = await axios.get(`${API_BASE_URL}/api/patrols/${patrol.patrol_id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data && response.data.data) {
        setCombinedPatrolDetails(response.data.data);
        setIsDetailsModalVisible(true);
      } else {
        message.error(t.invalidDataFormat);
      }
    } catch (error) {
      console.error("Error fetching patrol details:", error);
      message.error(t.failedToLoadPatrolDetails);
    } finally {
      setLoadingDetails(false);
    }
  };

  const closeDetailsModal = () => {
    setIsDetailsModalVisible(false);
    setSelectedPatrolForDetails(null);
    setCombinedPatrolDetails(null);
    setSelectedImage(null);
    setImageRotation(0);
    setImageScale(1);
  };

  const closeImagePreview = () => {
    setSelectedImage(null);
    setImageRotation(0);
    setImageScale(1);
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
      sorter: (a, b) => (parsePatrolTimestamp(a.start_time)?.getTime() || 0) - (parsePatrolTimestamp(b.start_time)?.getTime() || 0),
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
      sorter: (a, b) => (parsePatrolTimestamp(a.end_time)?.getTime() || 0) - (parsePatrolTimestamp(b.end_time)?.getTime() || 0),
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
      title: t.distance + " (km)",
      dataIndex: "distance_kms",
      key: "distance_kms",
      align: "center",
      render: (distance) => distance ? `${Number(distance).toFixed(2)}` : "-",
      sorter: (a, b) => parseFloat(a.distance_kms) - parseFloat(b.distance_kms),
    },
    {
      title: t.details,
      key: "details",
      align: "center",
      render: (record) => (
        <Button
          style={{
            borderRadius: "4.618px",
            border: "1.961px solid rgba(255, 255, 255, 0.23)",
            background: "linear-gradient(135deg, rgba(116, 190, 0, 0.40), rgba(0, 166, 81, 0.40))",
            color: "#000",
          }}
          icon={<EyeOutlined />}
          onClick={() => fetchPatrolDetails(record)}
        >
          {t.view}
        </Button>
      ),
    },
  ];

  // Custom Pagination Component
  const CustomPagination = () => (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      marginTop: 16,
      padding: '16px',
      borderRadius: '8px',
      flexWrap: 'wrap',
      gap: '16px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ color: '#666', fontSize: '14px' }}>
          {t.showing} <strong>{Math.min(currentPage * pageSize, totalItems)}</strong> {t.of} <strong>{totalItems}</strong> {t.items}
        </span>
      </div>
      
      <Pagination
        current={currentPage}
        pageSize={pageSize}
        total={totalItems}
        onChange={handlePageChange}
        showSizeChanger
        showQuickJumper
        showTotal={(total, range) => 
          `${t.showing} ${range[0]}-${range[1]} ${t.of} ${total} ${t.items}`
        }
        pageSizeOptions={['5', '10', '20', '50', '100']}
      />
    </div>
  );

  const handlePageChange = (page, newPageSize) => {
    setCurrentPage(page);
    setPageSize(newPageSize);
  };

  // Get current page data
  const getCurrentPageData = () => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return patrols.slice(startIndex, endIndex);
  };

  // Fetch boundaries
  const fetchPatrolBoundaries = async () => {
    setLoading(prev => ({ ...prev, boundaries: true }));
    try {
      const token = await getAuthToken();
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
      message.error(t.failedToLoadBoundaries);
    } finally {
      setLoading(prev => ({ ...prev, boundaries: false }));
    }
  };

  // Fetch divisions
  const fetchDivisions = async () => {
    setLoading(prev => ({ ...prev, divisions: true }));
    try {
      const token = await getAuthToken();
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

      // Auto-select the user's locked division if they have one
      if (lockedDivision) {
        const matched = divisionList.find(d =>
          matchesDivision(d.value, lockedDivision)
        );
        if (matched) {
          handleDivisionChange(matched);
        }
      }
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
      const token = await getAuthToken();
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
      const token = await getAuthToken();
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
    // Use the most specific hierarchy level (beat → round → range → division → circle)
    setLockedDivision(getMostSpecificLevel());
  }, []);

  useEffect(() => {
    if (lockedDivision === undefined) return; // Wait until division is resolved
    fetchDivisions();
    fetchPatrolBoundaries();

    const refetchInitialDropdowns = () => {
      if (document.visibilityState === 'visible') {
        fetchDivisions();
        fetchPatrolBoundaries();
      }
    };

    window.addEventListener('focus', refetchInitialDropdowns);
    document.addEventListener('visibilitychange', refetchInitialDropdowns);

    return () => {
      window.removeEventListener('focus', refetchInitialDropdowns);
      document.removeEventListener('visibilitychange', refetchInitialDropdowns);
    };
  }, [lockedDivision]);

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
      if (!lockedDivision) setSelectedDivision(null);
      setSelectedRange(null);
      setSelectedBeat(null);
      setSelectionMode('boundary');
      setValidationError(false);
    }
  };

  const handleMonthChange = (e) => {
    setSelectedMonth(e.target.value);
    if (e.target.value) {
      setValidationError(false); // Clear validation error when month is selected
    }
  };

  const resetData = () => {
    setCoverageData(null);
    setPatrols([]);
    setTotalItems(0);
    setCurrentPage(1);
    setSelectedPatrolForDetails(null);
    setCombinedPatrolDetails(null);
    setIsDetailsModalVisible(false);
    setSelectedImage(null);
    setImageRotation(0);
    setImageScale(1);
    setSelectedMonth("");
    setSelectedBoundary(null);
  };

  // Fetch coverage data
  const fetchCoverageData = async () => {
    let hasError = false;
    if (selectionMode === 'beat' && !selectedBeat) {
      message.warning(t.completeSelection);
      hasError = true;
    }
    if (selectionMode === 'boundary' && !selectedBoundary) {
      message.warning(t.selectBoundaryFirst);
      hasError = true;
    }
    if (!selectedMonth) {
      message.warning(t.selectMonthFirst);
      hasError = true;
    }
    
    if (hasError) {
      setValidationError(true);
      return;
    }

    // Reset validation error if all fields are filled
    setValidationError(false);

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
          setTotalItems(0);
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

  // Export to Excel
  const exportToExcel = async () => {
    if (!coverageData) return;

    window.dispatchEvent(new CustomEvent('global-data-loading-start', { detail: { message: 'Data is exporting...' } }));
    try {
      await new Promise((resolve) => setTimeout(resolve, 0));
      const [XLSX, { saveAs }] = await Promise.all([
        import("xlsx"),
        import("file-saver"),
      ]);

      const summaryData = [{
        [selectionMode === 'beat' ? t.beatLabel : t.boundaryLabel]:
          selectionMode === 'beat' ? selectedBeat.label : selectedBoundary.label,
        "Area (km²)": (Number(coverageData.coupe_area_sq_m) / 1000000).toFixed(2),
        "Patrol Covered Area (km²)": (Number(coverageData.patrol_area_sq_m) / 1000000).toFixed(2),
        "Coverage %": Number(coverageData.coverage_percentage).toFixed(2),
        "Month": selectedMonth
      }];

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
    } finally {
      window.dispatchEvent(new Event('global-data-loading-end'));
    }
  };

  const customSelectStyles = {
    control: (base, state) => ({
      ...base,
      width: '100%',
      minHeight: '44px',
      borderRadius: '10px',
      border: '1px solid #dfe9e2',
      boxShadow: state.isFocused ? '0 0 0 4px rgba(34, 128, 71, 0.12)' : 'none',
      borderColor: state.isFocused ? '#228047' : '#dfe9e2',
      '&:hover': { borderColor: state.isFocused ? '#228047' : '#b9d5c3' },
      backgroundColor: state.isDisabled ? '#f7faf8' : 'white',
    }),
    valueContainer: (base) => ({ ...base, padding: '0 14px' }),
    input: (base) => ({ ...base, margin: 0, padding: 0 }),
    placeholder: (base) => ({ ...base, color: '#8a9a90', fontSize: '14px' }),
    singleValue: (base) => ({ ...base, fontSize: '14px', color: '#173b25', fontWeight: 600 }),
    menu: (base) => ({ ...base, borderRadius: '12px', zIndex: 9999, overflow: 'hidden' }),
    option: (base, state) => ({
      ...base,
      fontSize: '14px',
      padding: '10px 12px',
      backgroundColor: state.isSelected ? '#228047' : state.isFocused ? '#eef8f1' : 'white',
      color: state.isSelected ? 'white' : '#173b25',
    }),
  };

  return (
    <div style={{ 
      minHeight: "80vh", 
      display: "flex", 
      flexDirection: "column" 
    }}>
      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>

      {/* Combined Details Modal - Photos first, then Map */}
      {isDetailsModalVisible && combinedPatrolDetails && (
        <div 
          style={{ 
            position: "fixed", 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            backgroundColor: "rgba(0,0,0,0.7)", 
            display: "flex", 
            justifyContent: "center", 
            alignItems: "center", 
            zIndex: 1000,
            overflow: "auto"
          }} 
          onClick={closeDetailsModal}
        >
          <div 
            style={{ 
              backgroundColor: "white", 
              borderRadius: "16px", 
              width: "90%", 
              maxWidth: "900px", 
              maxHeight: "90vh", 
              overflow: "auto", 
              position: "relative",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)"
            }} 
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ 
              padding: "20px", 
              borderBottom: "2px solid #f0f0f0", 
              display: "flex", 
              justifyContent: "space-between", 
              alignItems: "center", 
              background: "linear-gradient(135deg, #00A651, #008840)", 
              color: "white", 
              borderRadius: "16px 16px 0 0"
            }}>
              <div>
                <h2 style={{ fontSize: "24px", fontWeight: "600", margin: 0 }}>
                  {t.patrolDetails}
                </h2>
                <p style={{ margin: "5px 0 0 0", opacity: 0.9 }}>
                  {combinedPatrolDetails.patrol_officer_name} - {formatDateTime(combinedPatrolDetails.start_time, language).date}
                </p>
              </div>
              <button 
                onClick={closeDetailsModal} 
                style={{ 
                  background: "rgba(255,255,255,0.2)", 
                  border: "none", 
                  fontSize: "20px", 
                  cursor: "pointer", 
                  width: "40px", 
                  height: "40px", 
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  transition: "all 0.3s ease"
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.4)"}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.2)"}
              >
                ✕
              </button>
            </div>

            {/* Modal Content - Photos Section First */}
            <div style={{ padding: "20px" }}>
              {/* Photos Section */}
              <div style={{ marginBottom: "30px" }}>
                <h3 style={{ 
                  marginBottom: "15px", 
                  color: "#2d3748",
                  fontSize: "18px",
                  fontWeight: "600",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px"
                }}>
                  <PictureOutlined /> {t.photos} ({combinedPatrolDetails.images?.length || 0})
                </h3>
                {loadingDetails ? (
                  <div style={{ textAlign: "center", padding: "40px" }}>
                    <div style={{ border: "6px solid #f3f3f3", borderTop: "6px solid #4299e1", borderRadius: "50%", width: "40px", height: "40px", animation: "spin 1s linear infinite", margin: "0 auto" }} />
                  </div>
                ) : combinedPatrolDetails.images?.length > 0 ? (
                  <Row gutter={[16, 16]}>
                    {combinedPatrolDetails.images.map((image, index) => (
                      <Col xs={12} sm={8} md={6} key={index}>
                        <div 
                          style={{ 
                            border: "2px solid #e2e8f0", 
                            borderRadius: "8px", 
                            overflow: "hidden", 
                            cursor: "pointer",
                            transition: "transform 0.3s ease",
                            backgroundColor: "#fff"
                          }} 
                          onClick={() => {
                            setSelectedImage(image.image_data);
                            setIsDetailsModalVisible(false);
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.05)"}
                          onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
                        >
                          <div style={{ width: "100%", height: "140px", overflow: "hidden", position: "relative" }}>
                            <AntImage 
                              width="100%" 
                              height="100%" 
                              style={{ objectFit: "cover" }} 
                              src={getImageUrl(image.image_data)} 
                              alt={`${t.images} ${index + 1}`} 
                              preview={false} 
                            />
                            <div style={{ 
                              position: "absolute", 
                              top: "8px", 
                              right: "8px", 
                              backgroundColor: "rgba(0,0,0,0.7)", 
                              color: "white", 
                              fontSize: "12px", 
                              padding: "2px 6px", 
                              borderRadius: "4px" 
                            }}>
                              {index + 1}
                            </div>
                          </div>
                          <div style={{ 
                            padding: "8px", 
                            backgroundColor: "#f8fafc", 
                            textAlign: "center",
                            fontSize: "12px",
                            fontWeight: "500"
                          }}>
                            {image.image_category || t.uncategorized}
                          </div>
                        </div>
                      </Col>
                    ))}
                  </Row>
                ) : (
                  <div style={{ textAlign: "center", padding: "40px", color: "#999", background: "#f8fafc", borderRadius: "8px" }}>
                    <div style={{ fontSize: "48px", marginBottom: "16px" }}>📷</div>
                    {t.noImagesFound}
                  </div>
                )}
              </div>

              {/* Map Section */}
              <div>
                <h3 style={{ 
                  marginBottom: "15px", 
                  color: "#2d3748",
                  fontSize: "18px",
                  fontWeight: "600",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px"
                }}>
                  🗺️ {t.route}
                </h3>
                <PatrolMap patrol={combinedPatrolDetails} />
              </div>
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
              closeImagePreview();
              setIsDetailsModalVisible(true);
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
              closeImagePreview();
              setIsDetailsModalVisible(true);
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
              title="Zoom In"
            >
              <ZoomInOutlined />
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="coverage-page-content">
        <div className="coverage-page-header">
          <div className="coverage-title-icon"><SearchOutlined /></div>
          <div>
            <h1>{t.title}</h1>
            <p className={validationError ? "coverage-subtitle coverage-subtitle-error" : "coverage-subtitle"}>
              {language === "gu" ? "કૃપા કરીને પેટ્રોલ કવરેજ વિશ્લેષણ માટે બાઉન્ડ્રી અને મહિનો પસંદ કરો" : "Select a boundary and month to analyze patrol coverage within the selected area."}
            </p>
          </div>
        </div>

        {/* Selection Card */}
        <div className="coverage-filter-card">
          <div className="coverage-filter-grid">
            <div className="coverage-filter-fields">
              {selectionMode === 'beat' ? (
                <>
                  <div className="coverage-field">
                    <label>{t.division}</label>
                    <Select value={selectedDivision} onChange={handleDivisionChange} options={divisions} isClearable placeholder={t.selectDivision} styles={customSelectStyles} isDisabled={!!lockedDivision} />
                  </div>
                  <div className="coverage-field">
                    <label>{t.range}</label>
                    <Select value={selectedRange} onChange={handleRangeChange} options={ranges} isClearable placeholder={t.selectRange} styles={customSelectStyles} isDisabled={!selectedDivision} />
                  </div>
                  <div className="coverage-field">
                    <label>{t.beat}</label>
                    <Select value={selectedBeat} onChange={handleBeatChange} options={beats} isClearable placeholder={t.selectBeat} styles={customSelectStyles} isDisabled={!selectedRange} />
                  </div>
                </>
              ) : (
                <div className="coverage-field">
                  <label>{t.boundary} <span>*</span></label>
                  <Select value={selectedBoundary} onChange={handleBoundaryChange} options={boundaries} isClearable placeholder={t.selectBoundary} styles={customSelectStyles} />
                </div>
              )}
              <div className="coverage-field">
                <label>{t.month} <span>*</span></label>
                <input className="coverage-month-input" type="month" value={selectedMonth} onChange={handleMonthChange} />
              </div>
            </div>
            
            <div className="coverage-filter-actions">
              <button 
                className="glow-button coverage-primary-btn" 
                onClick={fetchCoverageData} 
                disabled={loading.coverage} 
              >
                <SearchOutlined /> {loading.coverage ? t.analyzing : t.analyzeCoverage}
              </button>
              <button className="coverage-reset-btn" onClick={resetData}>
                <UndoOutlined /> {t.reset}
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
            <div className="coverage-table-card">
              <div className="coverage-section-title">
                <div className="coverage-section-icon"><UserOutlined /></div>
                <h3>{t.patrolsInside} {selectionMode === 'beat' ? t.beatLabel : t.boundaryLabel}</h3>
              </div>
              <Table
              className="transparent-table coverage-modern-table"
              columns={getPatrolTableColumns()}
              dataSource={getCurrentPageData()}
              pagination={false}
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
              {totalItems > 0 && <CustomPagination />}
            </div>
          </>
        ) : coverageData && (
          <div style={{ textAlign: "center", padding: "40px", border: "2px dashed #e2e8f0", borderRadius: "12px", marginBottom: '50px' }}>
            <div style={{ width: "60px", height: "60px", backgroundColor: "#fed7d7", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: "24px" }}>⚡</div>
            <p style={{ color: "#718096" }}>{t.noPatrolsFound} {selectionMode === 'beat' ? t.beatLabel : t.boundaryLabel}</p>
          </div>
        )}

        {/* Coverage Data Display */}
        {coverageData && (
          <div className="coverage-results-card">
            {/* Summary Cards */}
            <div className="coverage-summary-grid">
              <div className="stats-card coverage-summary-card coverage-summary-boundary">
                <div className="coverage-summary-icon"><SearchOutlined /></div>
                <div>
                  <p>{selectionMode === 'beat' ? t.beatLabel : t.boundaryLabel}</p>
                  <h3>{selectionMode === 'beat' ? selectedBeat.label : selectedBoundary.label}</h3>
                </div>
              </div>
              <div className="stats-card coverage-summary-card coverage-summary-area">
                <div className="coverage-summary-icon"><CalendarOutlined /></div>
                <div>
                  <p>{selectionMode === 'beat' ? t.beatArea : t.boundaryArea}</p>
                  <h3>{(Number(selectionMode === 'beat' ? coverageData.coupe_area_sq_m : coverageData.coupe_area_sq_m) / 1000000).toFixed(2)} {t.areaUnit}</h3>
                </div>
              </div>
              <div className="stats-card coverage-summary-card coverage-summary-covered">
                <div className="coverage-summary-icon"><EyeOutlined /></div>
                <div>
                  <p>{t.patrolCoveredArea}</p>
                  <h3>{(Number(coverageData.patrol_area_sq_m) / 1000000).toFixed(2)} {t.areaUnit}</h3>
                </div>
              </div>
              <div className="stats-card coverage-summary-card coverage-summary-percent">
                <div className="coverage-summary-icon"><ClockCircleOutlined /></div>
                <div>
                  <p>{t.coverage}</p>
                  <h3>{Number(coverageData.coverage_percentage).toFixed(2)}%</h3>
                </div>
              </div>
            </div>

            {/* Export Button */}
            <button className="glow-button coverage-export-btn" onClick={exportToExcel}>
              <img src={vector} alt="Excel" /> {t.exportToExcel}
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer style={{
        textAlign:'center',
                  padding:'15px',
                  display: 'flex',
                  justifyContent: 'space-around',
                  alignItems: 'center',
        marginTop: 'auto',
        background: 'white',
      }}>
        <div>
          <p style={{display: 'flex', alignItems: 'center', gap: '6px'}}> 
            © 2026 Gujarat Forest Department 
            <img src={gujaratlogo} alt="logo picture" style={{width:'40px'}} />
          </p>
        </div>
        <div style={{display:'flex', alignItems:'center', gap: '6px'}}>
          <p>Powered by</p>
          <a href="https://www.gisfy.co.in/" target="_blank" rel="noopener noreferrer">
            <img src={gisfylogo} alt="logo picture" style={{ width: '100px', height: '40px' }} />
          </a>
        </div>
      </footer>
    </div>
  );
};

export default BeatPatrolCoverage;
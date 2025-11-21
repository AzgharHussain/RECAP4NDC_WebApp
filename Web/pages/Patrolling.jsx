import React, { useState, useEffect } from "react";
import { Table, Button, Input, DatePicker, Modal, Image, Select, Tag } from "antd";
import { SearchOutlined, EyeOutlined } from "@ant-design/icons";
import "./PatrolIncidentLogs.css";
import exportIcon from "../assets/excel.png";
import dayjs from "dayjs";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import noDataImage from "../assets/no-data.png";
import { useLanguage } from "../context/LanguageContext";
import { API_BASE_URL } from "../config";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";

const { Option } = Select;

const startIcon = new L.Icon({
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const endIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
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
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
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

const PatrolIncidentLogs = () => {
  const [patrolData, setPatrolData] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [startFilter, setStartFilter] = useState(null);
  const [endFilter, setEndFilter] = useState(null);
  const [typeFilter, setTypeFilter] = useState("");
  const [filteredData, setFilteredData] = useState([]);
  const [selectedPatrol, setSelectedPatrol] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const { language } = useLanguage();

  const fetchPatrolData = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/patrol-info?user_id=1`
      );
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      console.log("Fetched Patrol data:", data);
      
      let formattedData = Array.isArray(data.data)
        ? data.data
        : data.data && typeof data.data === "object"
        ? [data.data]
        : [];
      
      formattedData = formattedData.map((item, index) => ({
        key: item.patrol_id || index,
        ...item,
      }));
      
      setPatrolData(formattedData);
    } catch (error) {
      console.error("Error fetching Patrol data:", error);
      setPatrolData([]);
    }
  };

  useEffect(() => {
    fetchPatrolData();
  }, []);

  const formatDateTime = (datetime) => {
    const date = new Date(datetime);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return { date: `${day}-${month}-${year}`, time: `${hours}:${minutes}` };
  };

  useEffect(() => {
    let data = patrolData;
    
    if (searchText.trim() !== "") {
      const lower = searchText.toLowerCase();
      data = data.filter((item) =>
        item.patrol_officer_name?.toLowerCase().includes(lower)
      );
    }
    
    if (startFilter) {
      data = data.filter((item) =>
        dayjs(item.start_time).isSame(startFilter, "day")
      );
    }
    
    if (endFilter) {
      data = data.filter((item) =>
        dayjs(item.end_time).isSame(endFilter, "day")
      );
    }
    
    if (typeFilter) {
      data = data.filter((item) => item.type_name === typeFilter);
    }
    
    setFilteredData(data);
  }, [searchText, startFilter, endFilter, typeFilter, patrolData]);

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

  const getTypeColor = (type) => {
    switch (type) {
      case "Day patrolling": return "blue";
      case "Night patrolling": return "purple";
      case "Beat checking": return "green";
      default: return "default";
    }
  };

  const columns = [
    {
      title: language === "gu" ? "પેટ્રોલિંગ આઈડી" : "Patrol ID",
      dataIndex: "patrol_id",
      key: "patrol_id",
      align: "center",
      sorter: (a, b) => a.patrol_id - b.patrol_id,
    },
    {
      title: language === "gu" ? "પેટ્રોલિંગ પ્રકાર" : "Patrol Type",
      dataIndex: "type_name",
      key: "type_name",
      align: "center",
      render: (type) => (
        <Tag color={getTypeColor(type)}>
          {getTypeDisplayName(type)}
        </Tag>
      ),
      filters: [
        { text: language === "gu" ? "દિવસ પેટ્રોલિંગ" : "Day Patrolling", value: "Day patrolling" },
        { text: language === "gu" ? "રાત પેટ્રોલિંગ" : "Night Patrolling", value: "Night patrolling" },
        { text: language === "gu" ? "બીટ ચેકિંગ" : "Beat Checking", value: "Beat checking" },
      ],
      onFilter: (value, record) => record.type_name === value,
    },
    {
      title: language === "gu" ? "અધિકારીનું નામ" : "Officer Name",
      dataIndex: "patrol_officer_name",
      key: "patrol_officer_name",
      align: "center",
    },
    {
      title: language === "gu" ? "શરૂઆતની તારીખ" : "Start Date",
      key: "start_date",
      align: "center",
      render: (record) => formatDateTime(record.start_time).date,
      sorter: (a, b) => new Date(a.start_time) - new Date(b.start_time),
    },
    {
      title: language === "gu" ? "શરૂઆતનો સમય" : "Start Time",
      key: "start_time",
      align: "center",
      render: (record) => formatDateTime(record.start_time).time,
    },
    {
      title: language === "gu" ? "સમાપ્તિ તારીખ" : "End Date",
      key: "end_date",
      align: "center",
      render: (record) => formatDateTime(record.end_time).date,
      sorter: (a, b) => new Date(a.end_time) - new Date(b.end_time),
    },
    {
      title: language === "gu" ? "સમાપ્તિ સમય" : "End Time",
      key: "end_time",
      align: "center",
      render: (record) => formatDateTime(record.end_time).time,
    },
    {
      title: language === "gu" ? "શરૂઆતનું સ્થાન" : "Start Location",
      dataIndex: "start_location",
      key: "start_location",
      align: "center",
    },
    {
      title: language === "gu" ? "અંતિમ સ્થાન" : "End Location",
      dataIndex: "end_location",
      key: "end_location",
      align: "center",
    },
    {
      title: language === "gu" ? "અંતર (કિ.મી.)" : "Distance (km)",
      dataIndex: "distance_kms",
      key: "distance_kms",
      align: "center",
      sorter: (a, b) => parseFloat(a.distance_kms) - parseFloat(b.distance_kms),
    },
    {
      title: language === "gu" ? "રસ્તો" : "Route",
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
            setSelectedPatrol(record);
            setIsModalVisible(true);
          }}
        >
          {language === "gu" ? "દેખાવ" : "View"}
        </Button>
      ),
    },
  ];

 

const handleExport = () => {
  if (!filteredData.length) {
    alert(language === "gu" ? "નિકાસ કરવા માટે કોઈ ડેટા નથી" : "No data to export");
    return;
  }

  // Group data by officer name
  const officers = {};
  filteredData.forEach((item) => {
    if (!officers[item.patrol_officer_name]) {
      officers[item.patrol_officer_name] = {
        dayPatrols: [],
        nightPatrols: [],
        beatChecks: []
      };
    }
    
    if (item.type_name === "Day patrolling") {
      officers[item.patrol_officer_name].dayPatrols.push(item);
    } else if (item.type_name === "Night patrolling") {
      officers[item.patrol_officer_name].nightPatrols.push(item);
    } else if (item.type_name === "Beat checking") {
      officers[item.patrol_officer_name].beatChecks.push(item);
    }
  });

  // Calculate statistics for each officer
  const calculateStats = (patrols) => {
    if (!patrols.length) {
      return { total: 0, avgStaff: 0, avgHours: 0, avgDist: 0 };
    }

    const total = patrols.length;
    const avgStaff = patrols.reduce((sum, item) => sum + (item.number_of_staff || 1), 0) / total;
    
    const totalHours = patrols.reduce((sum, item) => {
      const start = new Date(item.start_time);
      const end = new Date(item.end_time);
      const hours = (end - start) / (1000 * 60 * 60);
      return sum + hours;
    }, 0);
    const avgHours = totalHours / total;
    
    const avgDist = patrols.reduce((sum, item) => sum + parseFloat(item.distance_kms || 0), 0) / total;

    return {
      total,
      avgStaff: avgStaff.toFixed(1),
      avgHours: avgHours.toFixed(1),
      avgDist: avgDist.toFixed(0) + 'km'
    };
  };

  // Prepare data for Excel export
  const exportData = [
    // Title row
    ['Officer Patrol Summary Report', '', '', '', '', '', '', '', '', '', '', '', ''],
    
    // Empty row for spacing
    ['', '', '', '', '', '', '', '', '', '', '', '', ''],
    
    // Header row
    [
      'Officer Name',
      'Day Patrolling', '', '', '',
      'Night Patrolling', '', '', '',
      'Beat Checking', '', '', ''
    ],
    // Sub-header row
    [
      '',
      'Total Patrols', 'Avg Staff', 'Avg Hours', 'Avg Dist',
      'Total Patrols', 'Avg Staff', 'Avg Hours', 'Avg Dist',
      'Total Checks', 'Avg Staff', 'Avg Hours', 'Avg Dist'
    ]
  ];

  // Add data for each officer
  Object.keys(officers).forEach(officerName => {
    const officerData = officers[officerName];
    const dayStats = calculateStats(officerData.dayPatrols);
    const nightStats = calculateStats(officerData.nightPatrols);
    const beatStats = calculateStats(officerData.beatChecks);

    exportData.push([
      officerName,
      dayStats.total, dayStats.avgStaff, dayStats.avgHours, dayStats.avgDist,
      nightStats.total, nightStats.avgStaff, nightStats.avgHours, nightStats.avgDist,
      beatStats.total, beatStats.avgStaff, beatStats.avgHours, beatStats.avgDist
    ]);
  });

  // Calculate totals row
  const allOfficers = Object.keys(officers);
  const totalDayPatrols = allOfficers.reduce((sum, officer) => sum + officers[officer].dayPatrols.length, 0);
  const totalNightPatrols = allOfficers.reduce((sum, officer) => sum + officers[officer].nightPatrols.length, 0);
  const totalBeatChecks = allOfficers.reduce((sum, officer) => sum + officers[officer].beatChecks.length, 0);

  // Add empty row before totals
  exportData.push(['', '', '', '', '', '', '', '', '', '', '', '', '']);
  
  // Add totals row
  exportData.push([
    'TOTAL',
    totalDayPatrols, '-', '-', '-',
    totalNightPatrols, '-', '-', '-',
    totalBeatChecks, '-', '-', '-'
  ]);

  // Add timestamp
  exportData.push(['', '', '', '', '', '', '', '', '', '', '', '', '']);
  exportData.push(['Report Generated:', new Date().toLocaleString(), '', '', '', '', '', '', '', '', '', '', '']);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(exportData);
  
  // Apply comprehensive styling
  const range = XLSX.utils.decode_range(ws['!ref']);
  
  // Style all cells
  for (let R = range.s.r; R <= range.e.r; R++) {
    for (let C = range.s.c; C <= range.e.c; C++) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
      if (!ws[cellAddress]) ws[cellAddress] = { v: '' };
      
      const cell = ws[cellAddress];
      
      // Default cell style
      cell.s = {
        border: {
          top: { style: "thin", color: { rgb: "000000" } },
          left: { style: "thin", color: { rgb: "000000" } },
          bottom: { style: "thin", color: { rgb: "000000" } },
          right: { style: "thin", color: { rgb: "000000" } }
        },
        alignment: { horizontal: "center", vertical: "center" },
        font: { sz: 10 }
      };

      // Title row (Row 0)
      if (R === 0) {
        cell.s = {
          ...cell.s,
          font: { bold: true, sz: 16, color: { rgb: "FFFFFF" } },
          fill: { fgColor: { rgb: "2F75B5" } },
          alignment: { horizontal: "center", vertical: "center" }
        };
      }

      // Main header row (Row 2)
      if (R === 2) {
        cell.s = {
          ...cell.s,
          font: { bold: true, sz: 12, color: { rgb: "FFFFFF" } },
          fill: { fgColor: { rgb: "2F75B5" } },
          alignment: { horizontal: "center", vertical: "center" }
        };
      }

      // Sub-header row (Row 3)
      if (R === 3) {
        cell.s = {
          ...cell.s,
          font: { bold: true, sz: 10, color: { rgb: "000000" } },
          fill: { fgColor: { rgb: "BDD7EE" } },
          alignment: { horizontal: "center", vertical: "center" }
        };
      }

      // Data rows (Row 4 to second last row - 3)
      if (R >= 4 && R <= range.e.r - 3) {
        // Officer name column (Column 0)
        if (C === 0) {
          cell.s = {
            ...cell.s,
            font: { bold: true, sz: 10 },
            fill: { fgColor: { rgb: "F2F2F2" } },
            alignment: { horizontal: "left", vertical: "center" }
          };
        } else {
          // Alternate row coloring for data
          if (R % 2 === 0) {
            cell.s.fill = { fgColor: { rgb: "FFFFFF" } };
          } else {
            cell.s.fill = { fgColor: { rgb: "F8F9FA" } };
          }
        }
      }

      // Totals row (second last row - 2)
      if (R === range.e.r - 2) {
        cell.s = {
          ...cell.s,
          font: { bold: true, sz: 11, color: { rgb: "FFFFFF" } },
          fill: { fgColor: { rgb: "70AD47" } },
          alignment: { horizontal: "center", vertical: "center" }
        };
      }

      // Timestamp row (last row)
      if (R === range.e.r) {
        if (C === 0) {
          cell.s = {
            ...cell.s,
            font: { bold: true, italic: true, sz: 9 },
            alignment: { horizontal: "left", vertical: "center" }
          };
        } else if (C === 1) {
          cell.s = {
            ...cell.s,
            font: { italic: true, sz: 9 },
            alignment: { horizontal: "left", vertical: "center" }
          };
        }
      }
    }
  }

  // Merge cells for better layout
  ws['!merges'] = [
    // Title merge
    { s: { r: 0, c: 0 }, e: { r: 0, c: 12 } },
    
    // Day Patrolling header merge
    { s: { r: 2, c: 1 }, e: { r: 2, c: 4 } },
    // Night Patrolling header merge  
    { s: { r: 2, c: 5 }, e: { r: 2, c: 8 } },
    // Beat Checking header merge
    { s: { r: 2, c: 9 }, e: { r: 2, c: 12 } },
    
    // Timestamp merge
    { s: { r: range.e.r, c: 1 }, e: { r: range.e.r, c: 12 } }
  ];

  // Set column widths for better readability
  ws['!cols'] = [
    { wch: 20 }, // Officer Name
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, // Day Patrolling
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, // Night Patrolling  
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }  // Beat Checking
  ];

  // Set row heights
  ws['!rows'] = [
    { hpt: 30 }, // Title row
    { hpt: 10 }, // Spacing row
    { hpt: 25 }, // Main header
    { hpt: 20 }, // Sub-header
  ];

  // Add more rows for data (you can extend this as needed)
  for (let i = 4; i <= range.e.r; i++) {
    if (!ws['!rows']) ws['!rows'] = [];
    ws['!rows'][i] = { hpt: 20 };
  }

  XLSX.utils.book_append_sheet(wb, ws, "Officer Patrol Summary");

  // Also keep the original detailed data in a separate sheet with better styling
  const detailedData = filteredData.map((item) => ({
    "Patrol ID": item.patrol_id,
    "Officer Name": item.patrol_officer_name,
    "Patrol Type": item.type_name,
    "Patrol Start Date": formatDateTime(item.start_time).date,
    "Patrol Start Time": formatDateTime(item.start_time).time,
    "Patrol End Date": formatDateTime(item.end_time).date,
    "Patrol End Time": formatDateTime(item.end_time).time,
    "Start Location": item.start_location,
    "End Location": item.end_location,
    "Distance (Kms)": item.distance_kms,
    "Number of Staff": item.number_of_staff || 1
  }));

  const detailedSheet = XLSX.utils.json_to_sheet(detailedData);
  
  // Style the detailed sheet
  const detailedRange = XLSX.utils.decode_range(detailedSheet['!ref']);
  
  // Add header styling for detailed sheet
  for (let C = detailedRange.s.c; C <= detailedRange.e.c; C++) {
    const headerCell = XLSX.utils.encode_cell({ r: 0, c: C });
    if (detailedSheet[headerCell]) {
      detailedSheet[headerCell].s = {
        font: { bold: true, sz: 11, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "4472C4" } },
        alignment: { horizontal: "center", vertical: "center" },
        border: {
          top: { style: "thin", color: { rgb: "000000" } },
          left: { style: "thin", color: { rgb: "000000" } },
          bottom: { style: "thin", color: { rgb: "000000" } },
          right: { style: "thin", color: { rgb: "000000" } }
        }
      };
    }
  }

  // Style data rows in detailed sheet
  for (let R = 1; R <= detailedRange.e.r; R++) {
    for (let C = detailedRange.s.c; C <= detailedRange.e.c; C++) {
      const cell = XLSX.utils.encode_cell({ r: R, c: C });
      if (detailedSheet[cell]) {
        detailedSheet[cell].s = {
          border: {
            top: { style: "thin", color: { rgb: "D0D0D0" } },
            left: { style: "thin", color: { rgb: "D0D0D0" } },
            bottom: { style: "thin", color: { rgb: "D0D0D0" } },
            right: { style: "thin", color: { rgb: "D0D0D0" } }
          },
          alignment: { horizontal: "center", vertical: "center" },
          font: { sz: 9 }
        };
        
        // Alternate row colors
        if (R % 2 === 0) {
          detailedSheet[cell].s.fill = { fgColor: { rgb: "F8F9FA" } };
        }
      }
    }
  }

  // Set column widths for detailed sheet
  detailedSheet['!cols'] = [
    { wch: 12 }, // Patrol ID
    { wch: 20 }, // Officer Name
    { wch: 15 }, // Patrol Type
    { wch: 12 }, // Start Date
    { wch: 12 }, // Start Time
    { wch: 12 }, // End Date
    { wch: 12 }, // End Time
    { wch: 20 }, // Start Location
    { wch: 20 }, // End Location
    { wch: 12 }, // Distance
    { wch: 12 }  // Number of Staff
  ];

  XLSX.utils.book_append_sheet(wb, detailedSheet, "Detailed Patrol Data");

  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  saveAs(
    new Blob([wbout], { type: "application/octet-stream" }),
    `Officer_Patrol_Summary_${new Date().toISOString().split('T')[0]}.xlsx`
  );
};

  return (
    <div className="container">
      <div className="section">
        <div className="heading-container">
          <h3 className="main-heading">
            {language === "gu" ? "પેટ્રોલિંગ નોંધણી" : "Patrolling Logs"}
          </h3>
          <div className="filters">
            <Input
              placeholder={
                language === "gu"
                  ? "અધિકારીના નામ પ્રમાણે શોધો"
                  : "Search by Officer Name"
              }
              style={{
                width: "200px",
                background: "rgba(255, 255, 255, 0.2)",
                border: "none",
              }}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              suffix={
                <SearchOutlined
                  style={{ color: "rgba(0, 0, 0, 0.25)", fontSize: "16px" }}
                />
              }
            />
            <DatePicker
              placeholder={
                language === "gu"
                  ? "શરૂઆતની તારીખથી શોધો"
                  : "Search by Start Date"
              }
              style={{
                width: "200px",
                border: "2.21px solid rgba(255, 255, 255, 0.23)",
                background: "rgba(255, 255, 255, 0.02)",
              }}
              value={startFilter}
              onChange={(date) => setStartFilter(date)}
            />
            <DatePicker
              placeholder={
                language === "gu" ? "સમાપ્ત તારીખથી શોધો" : "Search by End Date"
              }
              style={{
                width: "200px",
                color: "#fff",
                border: "2.21px solid rgba(255, 255, 255, 0.23)",
                background: "rgba(255, 255, 255, 0.02)",
              }}
              value={endFilter}
              onChange={(date) => setEndFilter(date)}
            />
            <Select
              placeholder={language === "gu" ? "પેટ્રોલિંગ પ્રકારથી શોધો" : "Search by Patrolling Type"}
              style={{
                width: "200px",
                border: "2.21px solid rgba(255, 255, 255, 0.23)",
                background: "rgba(255, 255, 255, 0.02)",
              }}
              value={typeFilter}
              onChange={(value) => setTypeFilter(value)}
            >
              <Option value="">{language === "gu" ? "બધા" : "All"}</Option>
              <Option value="Day patrolling">{language === "gu" ? "દિવસ પેટ્રોલિંગ" : "Day Patrolling"}</Option>
              <Option value="Night patrolling">{language === "gu" ? "રાત પેટ્રોલિંગ" : "Night Patrolling"}</Option>
              <Option value="Beat checking">{language === "gu" ? "બીટ ચેકિંગ" : "Beat Checking"}</Option>
            </Select>
            <Button className="btn-Export" onClick={handleExport}>
              {language === "gu" ? "નિકાસ કરો" : "Export"}
              <img src={exportIcon} alt="Export Icon" className="btn-icon" />
            </Button>
          </div>
        </div>
        
        <Table
          className="transparent-table"
          columns={columns}
          dataSource={filteredData}
          pagination={{ pageSize: 5 }}
          bordered
          scroll={{ x: 'max-content' }}
          locale={{
            emptyText: (
              <div style={{ textAlign: "center", padding: "50px 0" }}>
                <img
                  src={noDataImage}
                  alt="No Data"
                  style={{ width: 60, marginBottom: 16 }}
                />
                <div style={{ fontSize: 16, color: "#000", fontWeight: 500 }}>
                  {language === "gu" ? "કોઈ ડેટા ઉપલબ્ધ નથી" : "No data available"}
                </div>
              </div>
            ),
          }}
        />
      </div>
      
      <Modal
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        width={800}
        title={
          selectedPatrol
            ? `${language === "gu" ? "પેટ્રોલ માર્ગ" : "Patrol Route"} - ${
                selectedPatrol.patrol_officer_name
              } (${language === "gu" ? "અંતર" : "Distance"}: ${
                selectedPatrol.distance_kms
              } km)`
            : language === "gu"
            ? "પેટ્રોલ માર્ગ"
            : "Patrol Route"
        }
      >
        {selectedPatrol && (
          <>
            <div style={{ marginBottom: 16 }}>
              <h4>{language === "gu" ? "શરૂઆતની છબી" : "Start Image"}</h4>
              <Image
                src={selectedPatrol.start_image}
                alt="Start Location"
                style={{ maxHeight: 200 }}
              />
              <h4>{language === "gu" ? "અંતિમ છબી" : "End Image"}</h4>
              <Image
                src={selectedPatrol.end_image}
                alt="End Location"
                style={{ maxHeight: 200 }}
              />
            </div>
            <PatrolMap patrol={selectedPatrol} />
          </>
        )}
      </Modal>
    </div>
  );
};

export default PatrolIncidentLogs;
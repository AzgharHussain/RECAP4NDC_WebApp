import React, { useState, useEffect } from "react";
import { Table, Button, Input, DatePicker,Modal } from "antd";
import { SearchOutlined, EyeOutlined } from '@ant-design/icons';
import './PatrolIncidentLogs.css';  
import exportIcon from '../assets/excel.png';
import dayjs from "dayjs";
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import noDataImage from '../assets/no-data.png';

// ✅ Leaflet imports
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import "leaflet/dist/leaflet.css";

// ✅ custom icons for start and end
const startIcon = new L.Icon({
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});
const endIcon = new L.Icon({
  iconUrl:
    "https://cdn-icons-png.flaticon.com/512/684/684908.png", // different icon
  iconSize: [25, 25],
  iconAnchor: [12, 12],
  popupAnchor: [0, -12],
});

// ✅ force map to resize after modal opens
function ResizeMapOnShow({ bounds }) {
  const map = useMap();
  useEffect(() => {
    setTimeout(() => {
      map.invalidateSize();
      if (bounds && bounds.length > 1) {
        map.fitBounds(bounds, { padding: [20, 20] });
      }
    }, 300);
  }, [map, bounds]);
  return null;
}



// ✅ helper: parse "lat,lng" string → [lat, lng]
const parseLocation = (value) => {
  if (!value) return null;
  if (typeof value === "string" && value.includes(",")) {
    const [lat, lng] = value.split(",").map((v) => parseFloat(v.trim()));
    if (!isNaN(lat) && !isNaN(lng)) return [lat, lng];
  }
  return null;
};

// ✅ Map Component
const PatrolMap = ({ patrol }) => {
  if (!patrol) return null;

  // Parse start and end
  const start = parseLocation(patrol.start_location);
  const end = parseLocation(patrol.end_location);

  if (!start || !end) return <p>No valid coordinates</p>;

  const bounds = [start, end];

  return (
    <MapContainer
      style={{ height: "400px", width: "100%" }}
      center={start}
      zoom={15}
      scrollWheelZoom={true}
    >
      {/* Auto zoom to fit start and end */}
      <ResizeMapOnShow bounds={bounds} />

      {/* Base map */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
        url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
      />

      {/* Start marker */}
      <Marker position={start} icon={startIcon}>
        <Popup>
          Start: {start[0].toFixed(5)}, {start[1].toFixed(5)}
        </Popup>
      </Marker>

      {/* End marker */}
      <Marker position={end} icon={endIcon}>
        <Popup>
          End: {end[0].toFixed(5)}, {end[1].toFixed(5)}
        </Popup>
      </Marker>

      {/* Navigation line start → end */}
      <Polyline positions={[start, end]} color="blue" />
    </MapContainer>
  );
};




const PatrolIncidentLogs = () => {
  const [patrolData, setPatrolData] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [startFilter, setStartFilter] = useState(null);
  const [endFilter, setEndFilter] = useState(null);
  const [filteredData, setFilteredData] = useState([]);
  const [selectedPatrol, setSelectedPatrol] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);


  // ✅ for map view
  const [selectedRoute, setSelectedRoute] = useState(null);

  const fetchPatrolData = async () => {
    try {
      const response = await fetch("http://68.178.167.39:5000/api/patrols-by-user?user_id=1");
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      let formattedData = Array.isArray(data) ? data : data && typeof data === "object" ? [data] : [];
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
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return { date: `${day}-${month}-${year}`, time: `${hours}:${minutes}` };
  };

  // ✅ Filtering logic
  useEffect(() => {
    let data = patrolData;
    if (searchText.trim() !== "") {
      const lower = searchText.toLowerCase();
      data = data.filter(item => item.patrol_officer_name?.toLowerCase().includes(lower));
    }
    if (startFilter) {
      data = data.filter(item => dayjs(item.start_time).isSame(startFilter, 'day'));
    }
    if (endFilter) {
      data = data.filter(item => dayjs(item.end_time).isSame(endFilter, 'day'));
    }
    setFilteredData(data);
  }, [searchText, startFilter, endFilter, patrolData]);

  // ✅ Export to Excel handler
  const handleExport = () => {
    if (!filteredData.length) {
      alert("No data to export");
      return;
    }

    const exportData = filteredData.map(item => ({
      'Patrol ID': item.patrol_id,
      'Officer Name': item.patrol_officer_name,
      'Patrol Start Date': formatDateTime(item.start_time).date,
      'Patrol Start Time': formatDateTime(item.start_time).time,
      'Patrol End Date': formatDateTime(item.end_time).date,
      'Patrol End Time': formatDateTime(item.end_time).time,
      'Start Location': item.start_location,
      'End Location': item.end_location,
      'Distance (Kms)': item.distance_kms,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Patrol Logs");
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout], { type: "application/octet-stream" }), 'Patrol_Incident_Logs.xlsx');
  };

  const columns = [
    { title: "Patrol ID", dataIndex: "patrol_id", key: "patrol_id", sorter: (a, b) => a.patrol_id - b.patrol_id, align: 'center' },
    { title: "Officer Name", dataIndex: "patrol_officer_name", key: "patrol_officer_name", sorter: (a, b) => a.patrol_officer_name.localeCompare(b.patrol_officer_name), align: 'center' },
    { title: "Patrol Start Date", dataIndex: "start_time", key: "start_date", render: (text) => formatDateTime(text).date, sorter: (a, b) => new Date(a.start_time) - new Date(b.start_time), align: 'center' },
    { title: "Patrol Start Time", dataIndex: "start_time", key: "start_time", render: (text) => formatDateTime(text).time, align: 'center' },
    { title: "Patrol End Date", dataIndex: "end_time", key: "end_date", render: (text) => formatDateTime(text).date, sorter: (a, b) => new Date(a.end_time) - new Date(b.end_time), align: 'center' },
    { title: "Patrol End Time", dataIndex: "end_time", key: "end_time", render: (text) => formatDateTime(text).time, align: 'center' },
    { title: "Starting Point Location", dataIndex: "start_location", key: "start_location", align: 'center' },
    { title: "End Point Location", dataIndex: "end_location", key: "end_location", align: 'center' },
    { title: "Distance (in Kms)", dataIndex: "distance_kms", key: "distance_kms", sorter: (a, b) => parseFloat(a.distance_kms) - parseFloat(b.distance_kms), align: 'center' },
    {
      title: "Route",
      dataIndex: "route",
      key: "route",
      render: (_, record) => (
        <Button
          style={{
            borderRadius: "4.618px",
            border: "1.961px solid rgba(255, 255, 255, 0.23)",
            background: "rgba(127, 234, 131, 0.40)",
            color: "#1B75BA",
          }}
          icon={<EyeOutlined />}
          onClick={() => {
            setSelectedPatrol(record);
            setIsModalVisible(true);
          }}
        >
          View
        </Button>
      ),
      align: "center",
    },
  ];

  return (
    <div className="container">
      <div className="section">
        <div className="heading-container">
          <h3 className="main-heading">Patrolling Logs</h3>
          <div className="filters">
            <Input
              placeholder="Search by Officer Name"
              style={{ width: "200px", background: 'rgba(255, 255, 255, 0.2)', border: 'none' }}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              suffix={<SearchOutlined style={{ color: 'rgba(0, 0, 0, 0.25)', fontSize: '16px' }} />}
            />
            <DatePicker placeholder="Search by Start Date" style={{ width: "200px", border: '2.21px solid rgba(255, 255, 255, 0.23)', background: 'rgba(255, 255, 255, 0.02)' }} value={startFilter} onChange={(date) => setStartFilter(date)} />
            <DatePicker placeholder="Search by End Date" style={{ width: "200px", color: '#fff', border: '2.21px solid rgba(255, 255, 255, 0.23)', background: 'rgba(255, 255, 255, 0.02)' }} value={endFilter} onChange={(date) => setEndFilter(date)} />
            <Button className="btn-Export" onClick={handleExport}>
              Export
              <img src={exportIcon} alt="Export Icon" className="btn-icon" />
            </Button>
          </div>
        </div>
        <Table className="transparent-table" columns={columns} dataSource={filteredData} pagination={{ pageSize: 5 }} bordered 
        locale={{
            emptyText: (
              <div style={{ textAlign: 'center', padding: '50px 0' }}>
                <img
                  src={noDataImage}
                  alt="No Data"
                  style={{ width: 60, marginBottom: 16 }}
                />
                <div style={{ fontSize: 16, color: '#00442c', fontWeight: 500 }}>
                  No data available
                </div>
              </div>
            ),
          }}/>
      </div>

      {/* Map display */}
       <Modal
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        width={800}
        title={
          selectedPatrol
            ? `Patrol Route - ${selectedPatrol.patrol_officer_name} (Distance: ${selectedPatrol.distance_kms} km)`
            : "Patrol Route"
        }
      >
        {selectedPatrol && <PatrolMap patrol={selectedPatrol} />}
      </Modal>
    </div>
  );
};
export default PatrolIncidentLogs;

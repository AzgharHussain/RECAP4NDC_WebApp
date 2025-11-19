import React, { useState, useEffect } from "react";
import { Table, Button, Input, DatePicker, Modal, Image, Select } from "antd";
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

  const handleExport = () => {
    if (!filteredData.length) {
      alert(language === "gu" ? "નિકાસ કરવા માટે કોઈ ડેટા નથી" : "No data to export");
      return;
    }
    const exportData = filteredData.map((item) => ({
      "Patrol ID": item.patrol_id,
      "Officer Name": item.patrol_officer_name,
      "Patrol Start Date": formatDateTime(item.start_time).date,
      "Patrol Start Time": formatDateTime(item.start_time).time,
      "Patrol End Date": formatDateTime(item.end_time).date,
      "Patrol End Time": formatDateTime(item.end_time).time,
      "Start Location": item.start_location,
      "End Location": item.end_location,
      "Distance (Kms)": item.distance_kms,
      "Patrolling Type": item.type_name || (language === "gu" ? "ઉપલબ્ધ નથી" : "N/A"),
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Patrol Logs");
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(
      new Blob([wbout], { type: "application/octet-stream" }),
      "Patrol_Incident_Logs.xlsx"
    );
  };

  const columns = [
    {
      title: language === "gu" ? "પેટ્રોલિંગ આઈડી" : "Patrol ID",
      dataIndex: "patrol_id",
      key: "patrol_id",
      sorter: (a, b) => a.patrol_id - b.patrol_id,
      align: "center",
    },
    {
      title: language === "gu" ? "અધિકારીનું નામ" : "Officer Name",
      dataIndex: "patrol_officer_name",
      key: "patrol_officer_name",
      sorter: (a, b) =>
        a.patrol_officer_name.localeCompare(b.patrol_officer_name),
      align: "center",
    },
    {
      title: language === "gu" ? "પેટ્રોલિંગ પ્રકાર" : "Patrolling Type",
      dataIndex: "type_name",
      key: "type_name",
      align: "center",
      render: (text) => text || (language === "gu" ? "ઉપલબ્ધ નથી" : "N/A"),
    },
    {
      title: language === "gu" ? "પેટ્રોલિંગ શરૂ થવાની તારીખ" : "Patrol Start Date",
      dataIndex: "start_time",
      key: "start_date",
      render: (text) => formatDateTime(text).date,
      sorter: (a, b) => new Date(a.start_time) - new Date(b.start_time),
      align: "center",
    },
    {
      title: language === "gu" ? "પેટ્રોલિંગ શરૂ થવાનો સમય" : "Patrol Start Time",
      dataIndex: "start_time",
      key: "start_time",
      render: (text) => formatDateTime(text).time,
      align: "center",
    },
    {
      title: language === "gu" ? "પેટ્રોલિંગ પૂર્ણ થવાની તારીખ" : "Patrol End Date",
      dataIndex: "end_time",
      key: "end_date",
      render: (text) => formatDateTime(text).date,
      sorter: (a, b) => new Date(a.end_time) - new Date(b.end_time),
      align: "center",
    },
    {
      title: language === "gu" ? "પેટ્રોલિંગ પૂર્ણ થવાનો સમય" : "Patrol End Time",
      dataIndex: "end_time",
      key: "end_time",
      render: (text) => formatDateTime(text).time,
      align: "center",
    },
    {
      title: language === "gu" ? "શરૂઆતનું સ્થાન" : "Starting Point Location",
      dataIndex: "start_location",
      key: "start_location",
      align: "center",
    },
    {
      title: language === "gu" ? "અંતિમ સ્થાન" : "End Point Location",
      dataIndex: "end_location",
      key: "end_location",
      align: "center",
    },
    {
      title: language === "gu" ? "અંતર" : "Distance (in Kms)",
      dataIndex: "distance_kms",
      key: "distance_kms",
      sorter: (a, b) => parseFloat(a.distance_kms) - parseFloat(b.distance_kms),
      align: "center",
    },
    {
      title: language === "gu" ? "રસ્તો" : "Route",
      dataIndex: "geom",
      key: "geom",
      render: (_, record) => (
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
      align: "center",
    },
  ];

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

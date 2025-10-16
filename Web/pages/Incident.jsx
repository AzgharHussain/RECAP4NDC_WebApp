import React, { useState, useEffect } from "react";
import { Table, Button, Input, Select, DatePicker, Modal } from "antd";
import { SearchOutlined, EyeOutlined } from "@ant-design/icons";
import "./PatrolIncidentLogs.css"; // Import the CSS for styling
import exportIcon from "../assets/excel.png";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import noDataImage from "../assets/no-data.png";
import { useLanguage } from "../context/LanguageContext";

const { Option } = Select;

const PatrolIncidentLogs = () => {
  const [incidentData, setIncidentData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [incidentDate, setIncidentDate] = useState(null);
  const [expandedRows, setExpandedRows] = useState({});
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  
  const { language } = useLanguage(); // use global language

  const text = {
    en: {
      title: "Incident Logs",
      searchPlaceholder: "Search by Officer Name",
      categoryFilterPlaceholder: "Select Incident Category",
      dateFilterPlaceholder: "Search by Incident Date",
      exportButton: "Export",
      noDataText: "No data available",
      incidentId: "Incident ID",
      patrolId: "Patrol ID",
      officerName: "Officer Name",
      category: "Incident Category",
      incidentDate: "Incident Date",
      incidentTime: "Incident Time",
      location: "Location (GPS)",
      description: "Incident Description",
      images: "Images",
      viewImages: "View Images",
    },
    gu: {
      title: "અકપાસના લોગ્સ",
      searchPlaceholder: "કર્મચારી નામ દ્વારા શોધો",
      categoryFilterPlaceholder: "અકસ્માત શ્રેણી પસંદ કરો",
      dateFilterPlaceholder: "અકસ્માત તારીખ દ્વારા શોધો",
      exportButton: "નિકાલ",
      noDataText: "કોઈ માહિતી ઉપલબ્ધ નથી",
      incidentId: "અકસ્માત ID",
      patrolId: "પેટ્રોલ ID",
      officerName: "કર્મચારીનું નામ",
      category: "શ્રેણી",
      incidentDate: "અકસ્માત તારીખ",
      incidentTime: "અકસ્માત સમય",
      location: "સ્થળ (GPS)",
      description: "અકસ્માત વર્ણન",
      images: "ચિત્રો",
      viewImages: "ચિત્રો જુઓ",
    },
  };

  // Fetch incident data
  const fetchIncidentData = async () => {
    try {
      const response = await fetch(
        "http://68.178.167.39:5000/api/incidents-with-images?user_id=1"
      );
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();

      let formatted = Array.isArray(data) ? data : [data];
      formatted = formatted.map((item, index) => ({
        key: item.p_incident_id || index,
        ...item,
      }));
      setIncidentData(formatted);
    } catch (error) {
      console.error("Error fetching incident data:", error);
      setIncidentData([]);
    }
  };

  useEffect(() => {
    fetchIncidentData();
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
    let data = [...incidentData];

    if (searchText.trim() !== "") {
      const lower = searchText.toLowerCase();
      data = data.filter((item) =>
        item.p_incident_reported_by?.toLowerCase().includes(lower)
      );
    }

    if (categoryFilter !== "All") {
      data = data.filter((item) => item.p_category_name === categoryFilter);
    }

    if (incidentDate) {
      const selected = incidentDate.format("DD-MM-YYYY");
      data = data.filter(
        (item) => formatDateTime(item.p_incident_time).date === selected
      );
    }

    setFilteredData(data);
  }, [searchText, categoryFilter, incidentDate, incidentData]);

  const handleExport = () => {
    if (!filteredData.length) {
      alert(text[language].noDataText);
      return;
    }

    const exportData = filteredData.map((item) => ({
      [text[language].incidentId]: item.p_incident_id,
      [text[language].patrolId]: item.p_patrol_id,
      [text[language].officerName]: item.p_incident_reported_by,
      [text[language].category]: item.p_category_name,
      [text[language].incidentDate]: formatDateTime(item.p_incident_time).date,
      [text[language].incidentTime]: formatDateTime(item.p_incident_time).time,
      [text[language].location]: item.p_location_gps?.coordinates
        ? `${item.p_location_gps.coordinates[1]}, ${item.p_location_gps.coordinates[0]}`
        : "N/A",
      [text[language].description]: item.p_incident_description,
      [text[language].images]: item.p_image_urls?.length || 0,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Incident Logs");

    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(
      new Blob([wbout], { type: "application/octet-stream" }),
      "Incident_Logs.xlsx"
    );
  };

  const columns = [
    {
      title: text[language].incidentId,
      dataIndex: "p_incident_id",
      key: "p_incident_id",
      sorter: (a, b) => a.p_incident_id - b.p_incident_id,
      align: "center",
    },
    {
      title: text[language].patrolId,
      dataIndex: "p_patrol_id",
      key: "p_patrol_id",
      sorter: (a, b) => a.p_patrol_id - b.p_patrol_id,
      align: "center",
    },
    {
      title: text[language].officerName,
      dataIndex: "p_incident_reported_by",
      key: "p_incident_reported_by",
      sorter: (a, b) =>
        a.p_incident_reported_by.localeCompare(b.p_incident_reported_by),
      align: "center",
    },
    {
      title: text[language].category,
      dataIndex: "p_category_name",
      key: "p_category_name",
      sorter: (a, b) => a.p_category_name.localeCompare(b.p_category_name),
      align: "center",
    },
    {
      title: text[language].incidentDate,
      dataIndex: "p_incident_time",
      key: "p_incident_time_date",
      render: (text) => formatDateTime(text).date,
      sorter: (a, b) =>
        new Date(a.p_incident_time) - new Date(b.p_incident_time),
      align: "center",
    },
    {
      title: text[language].incidentTime,
      dataIndex: "p_incident_time",
      key: "p_incident_time",
      render: (text) => formatDateTime(text).time,
      align: "center",
    },
    {
      title: text[language].location,
      dataIndex: "p_location_gps",
      key: "p_location_gps",
      render: (text) => {
        if (text && text.coordinates) {
          const lat = text.coordinates[1];
          const lon = text.coordinates[0];
          const latDirection = lat >= 0 ? "N" : "S";
          const lonDirection = lon >= 0 ? "E" : "W";
          const formattedLat = Math.abs(lat).toFixed(4);
          const formattedLon = Math.abs(lon).toFixed(4);
          return `${formattedLat}°${latDirection}, ${formattedLon}°${lonDirection}`;
        }
        return "N/A";
      },
      align: "center",
    },
    {
      title: text[language].description,
      dataIndex: "p_incident_description",
      key: "p_incident_description",
    },
    {
      title: text[language].images,
      dataIndex: "p_image_urls",
      key: "p_image_urls",
      render: (images) => (
        // <Button
        //   icon={<EyeOutlined />}
        //   onClick={() => showModal(images)} // Open the modal with the images
        //   style={{ border: "none", backgroundColor: "transparent" }}
        // />
        
        <Button
                  style={{
                    borderRadius: "4.618px",
                    border: "1.961px solid rgba(255, 255, 255, 0.23)",
                    background: "rgba(116, 190, 0, 0.40)",
                    color: "#000",
                  }}
                  icon={<EyeOutlined />}
                onClick={() => showModal(images)}
                >
                  {language === "gu" ? "દેખાવ" : "View"}
                </Button>
      ),
    },
  ];

  const showModal = (images) => {
    setSelectedImages(images);
    setIsModalVisible(true);
  };

  const handleCancel = () => {
    setIsModalVisible(false);
  };

  return (
    <div className="container">
      <div className="section">
        <div className="heading-container">
          <h3 className="main-heading">{text[language].title}</h3>
          <div className="filters">
            <Input
              placeholder={text[language].searchPlaceholder}
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
            <Select
              value={categoryFilter}
              onChange={(val) => setCategoryFilter(val)}
              style={{ width: "200px" }}
            >
              <Option value="All">{text[language].categoryFilterPlaceholder}</Option>
              <Option value="Poaching">Poaching</Option>
              <Option value="Illegal Logging">Illegal Logging</Option>
              <Option value="Encroachment">Encroachment</Option>
              <Option value="Other">Other</Option>
            </Select>
            <DatePicker
              placeholder={text[language].dateFilterPlaceholder}
              style={{
                width: "200px",
                border: "2.21px solid rgba(255, 255, 255, 0.23)",
                background: "rgba(255, 255, 255, 0.02)",
              }}
              value={incidentDate}
              onChange={(val) => setIncidentDate(val)}
              format="DD-MM-YYYY"
            />
            <Button className="btn-Export" onClick={handleExport}>
              {text[language].exportButton}
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
                  {text[language].noDataText}
                </div>
              </div>
            ),
          }}
        />
        <Modal
          open={isModalVisible}
          onCancel={handleCancel}
          footer={null}
          width={800}
          title={text[language].viewImages}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            {selectedImages.map((image, index) => (
              <img
                key={index}
                src={image}
                alt={`Image ${index}`}
                style={{
                  width: "100%",
                  maxHeight: "500px",
                  objectFit: "contain",
                  marginBottom: "15px",
                }}
              />
            ))}
          </div>
        </Modal>
      </div>
    </div>
  );
};

export default PatrolIncidentLogs;

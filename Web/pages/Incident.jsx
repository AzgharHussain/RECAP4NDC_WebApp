import React, { useState, useEffect } from "react";
import { Table, Button, Input, Select, DatePicker } from "antd";
import { SearchOutlined, EyeOutlined } from '@ant-design/icons';
import './PatrolIncidentLogs.css';  // Import the CSS for styling
import exportIcon from '../assets/excel.png';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import noDataImage from '../assets/no-data.png';

const { Option } = Select;

const PatrolIncidentLogs = () => {
  const [incidentData, setIncidentData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [incidentDate, setIncidentDate] = useState(null);
  const [expandedRows, setExpandedRows] = useState({});

  // ✅ Fetch incident data
  const fetchIncidentData = async () => {
    try {
      const response = await fetch("http://68.178.167.39:5000/api/incidents-with-images?user_id=2");
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();

      let formatted = Array.isArray(data) ? data : [data];
      formatted = formatted.map((item, index) => ({ key: item.p_incident_id || index, ...item }));
      setIncidentData(formatted);
    } catch (error) {
      console.error("Error fetching incident data:", error);
      setIncidentData([]);
    }
  };

  useEffect(() => {
    fetchIncidentData();
  }, []);

  // ✅ Format date and time
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
    let data = [...incidentData];

    if (searchText.trim() !== "") {
      const lower = searchText.toLowerCase();
      data = data.filter(item => item.p_incident_reported_by?.toLowerCase().includes(lower));
    }

    if (categoryFilter !== "All") {
      data = data.filter(item => item.p_category_name === categoryFilter);
    }

    if (incidentDate) {
      const selected = incidentDate.format("DD-MM-YYYY");
      data = data.filter(item => formatDateTime(item.p_incident_time).date === selected);
    }

    setFilteredData(data);
  }, [searchText, categoryFilter, incidentDate, incidentData]);

  // ✅ Export to Excel handler
  const handleExport = () => {
    if (!filteredData.length) {
      alert("No data to export");
      return;
    }

    // Prepare data
    const exportData = filteredData.map(item => ({
      'Incident ID': item.p_incident_id,
      'Patrol ID': item.p_patrol_id,
      'Officer Name': item.p_incident_reported_by,
      'Category': item.p_category_name,
      'Incident Date': formatDateTime(item.p_incident_time).date,
      'Incident Time': formatDateTime(item.p_incident_time).time,
      'Location (GPS)': item.p_location_gps?.coordinates
        ? `${item.p_location_gps.coordinates[1]}, ${item.p_location_gps.coordinates[0]}`
        : 'N/A',
      'Description': item.p_incident_description,
      'Images Count': item.p_image_urls?.length || 0,
    }));

    // Convert to sheet & workbook
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Incident Logs");

    // Save file
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout], { type: "application/octet-stream" }), 'Incident_Logs.xlsx');
  };

  // ✅ Table columns
  const columns = [
    {
      title: "Incident ID",
      dataIndex: "p_incident_id",
      key: "p_incident_id",
      sorter: (a, b) => a.p_incident_id - b.p_incident_id,
      align: 'center'
    },
    {
      title: "Patrol ID",
      dataIndex: "p_patrol_id",
      key: "p_patrol_id",
      sorter: (a, b) => a.p_patrol_id - b.p_patrol_id,
      align: 'center'
    },
    {
      title: "Officer Name",
      dataIndex: "p_incident_reported_by",
      key: "p_incident_reported_by",
      sorter: (a, b) => a.p_incident_reported_by.localeCompare(b.p_incident_reported_by),
      align: 'center'
    },
    {
      title: "Incident Category",
      dataIndex: "p_category_name",
      key: "p_category_name",
      sorter: (a, b) => a.p_category_name.localeCompare(b.p_category_name),
      align: 'center'
    },
    {
      title: "Incident Date",
      dataIndex: "p_incident_time",
      key: "p_incident_time_date",
      render: (text) => formatDateTime(text).date,
      sorter: (a, b) => new Date(a.p_incident_time) - new Date(b.p_incident_time),
      align: 'center'
    },
    {
      title: "Incident Time",
      dataIndex: "p_incident_time",
      key: "p_incident_time",
      render: (text) => formatDateTime(text).time,
      align: 'center'
    },
    {
      title: "Location (GPS)",
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
      align: 'center'
    },
    {
      title: "Incident Description",
      dataIndex: "p_incident_description",
      key: "p_incident_description"
    },
    {
      title: "Images",
      dataIndex: "p_image_urls",
      key: "p_image_urls",
      render: (images, record) => {
        if (!images || images.length === 0) return "No images available";
        const rowExpanded = expandedRows[record.key] || false;
        const displayImages = rowExpanded ? images : images.slice(0, 1);

        return (
          <div className="image-row">
            {displayImages.map((image, index) => (
              <img
                key={index}
                src={image}
                alt={`Incident ${index}`}
                style={{ width: 100, height: 80, marginRight: 5, borderRadius: '5px', objectFit: 'cover' }}
              />
            ))}
            {images.length > 1 && !rowExpanded && (
              <Button
                icon={<EyeOutlined />}
                onClick={() => setExpandedRows(prev => ({ ...prev, [record.key]: true }))}
              />
            )}
          </div>
        );
      },
      align: 'center'
    },
  ];

  return (
    <div className="container">
      <div className="section">
        <div className="heading-container">
          <h3 className="main-heading">Incident Logs</h3>
          <div className="filters">
            <Input
              placeholder="Search by Officer Name"
              style={{ width: "200px", background: 'rgba(255, 255, 255, 0.2)', border: 'none' }}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              suffix={<SearchOutlined style={{ color: 'rgba(0, 0, 0, 0.25)', fontSize: '16px' }} />}
            />
            <Select value={categoryFilter} onChange={(val) => setCategoryFilter(val)} style={{ width: "200px" }}>
              <Option value="All">All Incident Categories</Option>
              <Option value="Poaching">Poaching</Option>
              <Option value="Illegal Logging">Illegal Logging</Option>
              <Option value="Encroachment">Encroachment</Option>
               <Option value="Other">Other</Option>
            </Select>
            <DatePicker
              placeholder="Search by Incident Date"
              style={{ width: "200px", border: '2.21px solid rgba(255, 255, 255, 0.23)', background: 'rgba(255, 255, 255, 0.02)' }}
              value={incidentDate}
              onChange={(val) => setIncidentDate(val)}
              format="DD-MM-YYYY"
            />
            <Button className="btn-Export" onClick={handleExport}>
              Export
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
            }}
        />
      </div>
    </div>
  );
};

export default PatrolIncidentLogs;

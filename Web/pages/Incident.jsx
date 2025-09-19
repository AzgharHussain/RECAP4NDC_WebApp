import React, { useState, useEffect } from "react";
import { Table, Button, Input, Select, DatePicker } from "antd";
import { SearchOutlined } from '@ant-design/icons';
import './PatrolIncidentLogs.css';  // Import the CSS for styling
import exportIcon from '../assets/excel.png';
import { EyeOutlined } from '@ant-design/icons';

const { Option } = Select;

const PatrolIncidentLogs = () => {
  
  const [incidentData, setIncidentData] = useState([]);
  const [showAllImages, setShowAllImages] = useState(false);
  
  // Fetch incident data
  const fetchIncidentData = async () => {
    try {
      const response = await fetch("http://68.178.167.39:5000/api/incidents-with-images?user_id=2");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setIncidentData(data);
    } catch (error) {
      console.error("Error fetching incident data:", error);
    }
  };

  // Fetch data when component mounts
  useEffect(() => {
    fetchIncidentData();
  }, []);

  // Function to format date and time
  const formatDateTime = (datetime) => {
    const date = new Date(datetime);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-based
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return {
      date: `${day}-${month}-${year}`,
      time: `${hours}:${minutes}`,
    };
  };

  // Table columns with sorting and pagination
  const columns = [
    { 
      title: "Incident ID", 
      dataIndex: "p_incident_id", 
      key: "p_incident_id",
      sorter: (a, b) => a.p_incident_id - b.p_incident_id, // Sort by Incident ID
       align: 'center'
    },
    { 
      title: "Patrol ID", 
      dataIndex: "p_patrol_id", 
      key: "p_patrol_id",
      sorter: (a, b) => a.p_patrol_id - b.p_patrol_id, // Sort by Patrol ID
       align: 'center'
    },
    { 
      title: "Officer Name", 
      dataIndex: "p_incident_reported_by", 
      key: "p_incident_reported_by",
      sorter: (a, b) => a.p_incident_reported_by.localeCompare(b.p_incident_reported_by), // Sort by Officer Name
       align: 'center'
    },
    { 
      title: "Incident Category", 
      dataIndex: "p_category_name", 
      key: "p_category_name",
      sorter: (a, b) => a.p_category_name.localeCompare(b.p_category_name), // Sort by Category Name
       align: 'center'
    },
    { 
      title: "Incident Date", 
      dataIndex: "p_incident_time", 
      key: "p_incident_time",
      render: (text) => formatDateTime(text).date,
      sorter: (a, b) => new Date(a.p_incident_time) - new Date(b.p_incident_time), // Sort by Incident Date
       align: 'center'
    },
    { 
      title: "Incident Time", 
      dataIndex: "p_incident_time", 
      key: "p_incident_time",
      render: (text) => formatDateTime(text).time,
      sorter: (a, b) => new Date(a.p_incident_time) - new Date(b.p_incident_time), // Sort by Incident Time
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

          // Determine the direction (N/S for Latitude, E/W for Longitude)
          const latDirection = lat >= 0 ? "N" : "S";
          const lonDirection = lon >= 0 ? "E" : "W";

          // Convert lat/lon to positive values for display
          const formattedLat = Math.abs(lat).toFixed(4); 
          const formattedLon = Math.abs(lon).toFixed(4); 

          // Use template literals for correct concatenation
          return `${formattedLat}°${latDirection}, ${formattedLon}°${lonDirection}`;
        }
        return "N/A"; // Fallback in case location_gps or coordinates are missing
      } ,
       align: 'center'
    },
    { 
      title: "Incident Description", 
      dataIndex: "p_incident_description", 
      key: "p_incident_description" ,
       
    },
    {
      title: "Images",
      dataIndex: "p_image_urls",
      key: "p_image_urls",
      render: (images) => {
        if (!images || images.length === 0) return "No images available";
        
        // Show only the first image by default
        const displayImages = showAllImages ? images : images.slice(0, 1);

        return (
          <div className="image-row">
            {displayImages.map((image, index) => (
              <img
                key={index}
                src={image}
                alt={`Incident ${index}`}
                style={{
                  width: 100,
                  height: 80,
                  marginRight: 5,
                  borderRadius: '5px',
                  objectFit: 'cover',
                }}
              />
            ))}
            {images.length > 1 && !showAllImages && (
              <Button 
                icon={<EyeOutlined />}
                onClick={() => setShowAllImages(true)}
              >
                
              </Button>
            )}
          </div>
        );
      },
       align: 'center'
    },
  ];

  return (
    <div className="container">
      {/* Incident Logs */}
      <div className="section">
        <div className="heading-container">
          <h3 className="main-heading">Incident Logs</h3>
          <div className="filters">
            <Input
              placeholder="Search by Officer Name"
              style={{
                width: "200px",
                background: 'rgba(255, 255, 255, 0.2)',
                border: 'none',
              }}
              suffix={<SearchOutlined style={{ color: 'rgba(0, 0, 0, 0.25)', fontSize: '16px' }} />}
            />
            <Select defaultValue="All" style={{ width: "200px" }}>
              <Option value="All">All Incident Categories</Option>
              <Option value="Poaching">Poaching</Option>
              <Option value="Illegal Logging">Illegal Logging</Option>
              <Option value="Encroachment">Encroachment</Option>
            </Select>
            <DatePicker placeholder="Search by Incident Date & Time" style={{
              width: "200px",
              border: '2.21px solid rgba(255, 255, 255, 0.23)',
              background: 'rgba(255, 255, 255, 0.02)',
            }} />
            <Button className="btn-Export">
              Export
              <img src={exportIcon} alt="Export Icon" className="btn-icon" />
            </Button>
          </div>
        </div>
        <Table
          className="transparent-table"
          columns={columns}
          dataSource={incidentData}  // Pass the fetched incidentData here
          pagination={{ pageSize: 5 }}  // Pagination with 5 items per page
          bordered
          onChange={(pagination, filters, sorter) => {
            console.log('Table changes:', pagination, filters, sorter);
          }}
        />
      </div>
    </div>
  );
};

export default PatrolIncidentLogs;

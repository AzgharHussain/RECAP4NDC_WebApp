import React, { useState, useEffect } from "react";
import { Table, Button, Input, Select, DatePicker } from "antd";
import { SearchOutlined } from '@ant-design/icons';
import './PatrolIncidentLogs.css';  // Import the CSS for styling
import exportIcon from '../assets/excel.png';
import { EyeOutlined } from '@ant-design/icons';

const { Option } = Select;

const PatrolIncidentLogs = () => {
  const [patrolData, setPatrolData] = useState([]);

  // Fetch patrol data by user ID
  const fetchPatrolData = async () => {
    try {
      const response = await fetch("http://68.178.167.39:5000/api/patrols-by-user?user_id=2");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setPatrolData(data);
    } catch (error) {
      console.error("Error fetching patrol data:", error);
    }
  };

  // Fetch data when component mounts
  useEffect(() => {
    fetchPatrolData();
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
      title: "Patrol ID", 
      dataIndex: "patrol_id", 
      key: "patrol_id",
      sorter: (a, b) => a.patrol_id - b.patrol_id, // Sort by Patrol ID
       align: 'center'
    },
    { 
      title: "Officer Name", 
      dataIndex: "patrol_officer_name", 
      key: "patrol_officer_name",
      sorter: (a, b) => a.patrol_officer_name.localeCompare(b.patrol_officer_name), // Sort by Officer Name
       align: 'center'
    },
    { 
      title: "Patrol Start Date", 
      dataIndex: "start_time", 
      key: "start_time", 
      render: (text) => formatDateTime(text).date,
      sorter: (a, b) => new Date(a.start_time) - new Date(b.start_time), // Sort by Patrol Start Date
       align: 'center'
    },
    { 
      title: "Patrol Start Time", 
      dataIndex: "start_time", 
      key: "start_time", 
      render: (text) => formatDateTime(text).time,
       align: 'center'
    },
    { 
      title: "Patrol End Date", 
      dataIndex: "end_time", 
      key: "end_time", 
      render: (text) => formatDateTime(text).date,
      sorter: (a, b) => new Date(a.end_time) - new Date(b.end_time), // Sort by Patrol End Date
       align: 'center'
    },
    { 
      title: "Patrol End Time", 
      dataIndex: "end_time", 
      key: "end_time", 
      render: (text) => formatDateTime(text).time,
       align: 'center'
    },
    { 
      title: "Starting Point Location", 
      dataIndex: "start_location", 
      key: "start_location",
       align: 'center'
    },
    { 
      title: "End Point Location", 
      dataIndex: "end_location", 
      key: "end_location",
       align: 'center'
    },
    { 
      title: "Distance (in Kms)", 
      dataIndex: "distance_kms", 
      key: "distance_kms",
      sorter: (a, b) => a.distance_kms - b.distance_kms, // Sort by Distance
       align: 'center'
    },
    {
      title: "Route",
      dataIndex: "route",
      key: "route",
      render: (_, record) => (
        <Button
          style={{
            borderRadius: '4.618px',
            border: '1.961px solid rgba(255, 255, 255, 0.23)',
            background: 'rgba(127, 234, 131, 0.40)',
            boxShadow: '-9.106px -9.106px 4.553px -10.624px #B3B3B3 inset, 12.141px 12.141px 6.829px -13.659px #FFF inset',
            display: 'flex',
            alignItems: 'center',
            padding: '5px 10px',
            color: '#1B75BA',
          }}
          icon={<EyeOutlined />}
        >
          <h4>View</h4>
        </Button>
      ),
       align: 'center'
    },
  ];

  return (
    <div className="container">
      {/* Patrolling Logs */}
      <div className="section">
        <div className="heading-container">
          <h3 className="main-heading">Patrolling Logs</h3>
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
            <DatePicker placeholder="Search by Start Date & Time" style={{
              width: "200px",
              border: '2.21px solid rgba(255, 255, 255, 0.23)',
              background: 'rgba(255, 255, 255, 0.02)',
            }} />
            <DatePicker placeholder="Search by End Date & Time" style={{
              width: "200px",
              color: '#fff',
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
          dataSource={patrolData}  // Pass the fetched patrolData here
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

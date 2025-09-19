import React, { useState, useEffect } from "react";
import { Table, Button, Input, DatePicker } from "antd";
import { SearchOutlined, EyeOutlined } from '@ant-design/icons';
import './PatrolIncidentLogs.css';  
import exportIcon from '../assets/excel.png';
import dayjs from "dayjs";

const PatrolIncidentLogs = () => {
  const [patrolData, setPatrolData] = useState([]);

  // ✅ Filters state
  const [searchText, setSearchText] = useState("");
  const [startFilter, setStartFilter] = useState(null);  // dayjs object
  const [endFilter, setEndFilter] = useState(null);      // dayjs object
  const [filteredData, setFilteredData] = useState([]);

  // ✅ Fetch incident data
  const fetchPatrolData = async () => {
    try {
      const response = await fetch("http://68.178.167.39:5000/api/patrols-by-user?user_id=2");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      console.log("Fetched data:", data);

      // ✅ Always convert to array
      let formattedData = [];
      if (Array.isArray(data)) {
        formattedData = data;
      } else if (data && typeof data === "object") {
        formattedData = [data];
      } else {
        formattedData = [];
      }

      // ✅ Add 'key' for AntD Table
      formattedData = formattedData.map((item, index) => ({
        key: item.patrol_id || index,
        ...item,
      }));

      setPatrolData(formattedData);
    } catch (error) {
      console.error("Error fetching Patrol data:", error);
      setPatrolData([]); // fallback empty array on error
    }
  };

  // Fetch data when component mounts
  useEffect(() => {
    fetchPatrolData();
  }, []);

  // ✅ Format date and time for display
  const formatDateTime = (datetime) => {
    const date = new Date(datetime);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return {
      date: `${day}-${month}-${year}`,
      time: `${hours}:${minutes}`,
    };
  };

  // ✅ Filtering logic runs whenever filters or patrolData changes
  useEffect(() => {
    let data = patrolData;

    // Officer name filter
    if (searchText.trim() !== "") {
      const lower = searchText.toLowerCase();
      data = data.filter(item =>
        item.patrol_officer_name?.toLowerCase().includes(lower)
      );
    }

    // Start date filter
    if (startFilter) {
      data = data.filter(item =>
        dayjs(item.start_time).isSame(startFilter, 'day')
      );
    }

    // End date filter
    if (endFilter) {
      data = data.filter(item =>
        dayjs(item.end_time).isSame(endFilter, 'day')
      );
    }

    setFilteredData(data);
  }, [searchText, startFilter, endFilter, patrolData]);

  // ✅ Table columns
  const columns = [
    { 
      title: "Patrol ID", 
      dataIndex: "patrol_id", 
      key: "patrol_id",
      sorter: (a, b) => a.patrol_id - b.patrol_id,
      align: 'center'
    },
    { 
      title: "Officer Name", 
      dataIndex: "patrol_officer_name", 
      key: "patrol_officer_name",
      sorter: (a, b) => a.patrol_officer_name.localeCompare(b.patrol_officer_name),
      align: 'center'
    },
    { 
      title: "Patrol Start Date", 
      dataIndex: "start_time", 
      key: "start_date",
      render: (text) => formatDateTime(text).date,
      sorter: (a, b) => new Date(a.start_time) - new Date(b.start_time),
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
      key: "end_date", 
      render: (text) => formatDateTime(text).date,
      sorter: (a, b) => new Date(a.end_time) - new Date(b.end_time),
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
      sorter: (a, b) => parseFloat(a.distance_kms) - parseFloat(b.distance_kms),
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
          <h4 style={{margin: 0}}>View</h4>
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
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              suffix={<SearchOutlined style={{ color: 'rgba(0, 0, 0, 0.25)', fontSize: '16px' }} />}
            />
            <DatePicker 
              placeholder="Search by Start Date" 
              style={{
                width: "200px",
                border: '2.21px solid rgba(255, 255, 255, 0.23)',
                background: 'rgba(255, 255, 255, 0.02)',
              }}
              value={startFilter}
              onChange={(date) => setStartFilter(date)}
            />
            <DatePicker 
              placeholder="Search by End Date" 
              style={{
                width: "200px",
                color: '#fff',
                border: '2.21px solid rgba(255, 255, 255, 0.23)',
                background: 'rgba(255, 255, 255, 0.02)',
              }}
              value={endFilter}
              onChange={(date) => setEndFilter(date)}
            />
            <Button className="btn-Export">
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
        />
      </div>
    </div>
  );
};

export default PatrolIncidentLogs;

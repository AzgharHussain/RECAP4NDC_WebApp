import React, { useState } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { DatePicker, Select } from 'antd'; // Import DatePicker and Select from antd
import "./Dashboard.css";
import filterIcon from "../assets/filter.png";


const { Option } = Select; // Destructuring Select's Option component

export default function Dashboard() {
  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);

  // Empty placeholders (replace with backend data later)
  const forestCoverData = []; 
  const patrolData = [];
  const incidentsData = [];
  const forestTypeData = [];
  const soilTypeData = [];
  const observationData = [];

  const COLORS = ["#ff6b6b", "#51cf66", "#339af0", "#ffa94d"];

  const handleFromDateChange = (date) => {
    setFromDate(date);
  };

  const handleToDateChange = (date) => {
    setToDate(date);
  };

  return (
    <div className="dashboard-container">
<div className="heading-container">
  <h3 className="main-heading">Overview</h3>

  <div className="filters">
    {/* From Date */}
    <div className="filter-item">
      <DatePicker
        value={fromDate}
        onChange={handleFromDateChange}
        placeholder="Select From Date"
        style={{
          width: "200px",
          color: '#fff',
          border: '2.21px solid rgba(255, 255, 255, 0.23)',
          background: 'rgba(255, 255, 255, 0.02)',
          boxShadow: '-10.261px -10.261px 5.13px -11.971px #B3B3B3 inset, -10.261px -10.261px 5.13px -11.971px #B3B3B3 inset, -10.261px -10.261px 5.13px -11.971px #B3B3B3 inset, 13.681px 13.681px 7.696px -15.391px #FFF inset'
        }}
      />
    </div>

    {/* To Date */}
    <div className="filter-item">
      <DatePicker
        value={toDate}
        onChange={handleToDateChange}
        placeholder="Select To Date"
        style={{
          width: "200px",
          color: '#fff',
          border: '2.21px solid rgba(255, 255, 255, 0.23)',
          background: 'rgba(255, 255, 255, 0.02)',
          boxShadow: '-10.261px -10.261px 5.13px -11.971px #B3B3B3 inset, -10.261px -10.261px 5.13px -11.971px #B3B3B3 inset, -10.261px -10.261px 5.13px -11.971px #B3B3B3 inset, 13.681px 13.681px 7.696px -15.391px #FFF inset'
        }}
      />
    </div>


    {/* Select Division */}
    <div className="filter-item">
      <Select
        defaultValue="all"
        style={{width: "200px",
          color: '#fff',
          border: '2.21px solid rgba(255, 255, 255, 0.23)',
          background: 'rgba(255, 255, 255, 0.02)',
          boxShadow: '-10.261px -10.261px 5.13px -11.971px #B3B3B3 inset, -10.261px -10.261px 5.13px -11.971px #B3B3B3 inset, -10.261px -10.261px 5.13px -11.971px #B3B3B3 inset, 13.681px 13.681px 7.696px -15.391px #FFF inset' }}
      >
        <Option value="all">All Divisions</Option>
        <Option value="north">North Division</Option>
        <Option value="south">South Division</Option>
        <Option value="east">East Division</Option>
        <Option value="west">West Division</Option>
      </Select>
    </div>

    {/* Select Range */}
    <div className="filter-item">
      <Select defaultValue="all" style={{width: "200px",
          color: '#fff',
          border: '2.21px solid rgba(255, 255, 255, 0.23)',
          background: 'rgba(255, 255, 255, 0.02)',
          boxShadow: '-10.261px -10.261px 5.13px -11.971px #B3B3B3 inset, -10.261px -10.261px 5.13px -11.971px #B3B3B3 inset, -10.261px -10.261px 5.13px -11.971px #B3B3B3 inset, 13.681px 13.681px 7.696px -15.391px #FFF inset' }}>
        <Option value="all">All Ranges</Option>
        <Option value="range1">Range 1</Option>
        <Option value="range2">Range 2</Option>
        <Option value="range3">Range 3</Option>
      </Select>
    </div>

    {/* Filter Button */}
    <button>
      <img src={filterIcon} alt="Filter Icon" className="FilterIcon" />
    </button>
  </div>
</div>

<div className="charts-grid">
    {/* Forest Cover Change */}
    <div className="chart-card" style={{ width: "71%" }}>
        <h3>Forest Cover Change</h3>
        <ResponsiveContainer width="100%" height={250}>
            <PieChart>
                <Pie
                    data={forestCoverData}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={90}
                    label
                >
                    {forestCoverData.map((_, index) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                </Pie>
                <Legend />
                <Tooltip />
            </PieChart>
        </ResponsiveContainer>
    </div>

    {/* Patrolling and Incidents */}
   <div className="chart-card" style={{ width: "128%" , marginLeft:"-28%"}}>
        <h3>Patrolling and Incidents</h3>
        <ResponsiveContainer width="50%" height={250}>
            <BarChart data={patrolData}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#339af0" />
            </BarChart>
        </ResponsiveContainer>

        <ResponsiveContainer width="50%" height={250}>
            <PieChart>
                <Pie
                    data={incidentsData}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={90}
                    label
                >
                    {incidentsData.map((_, index) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                </Pie>
                <Legend />
                <Tooltip />
            </PieChart>
        </ResponsiveContainer>
    </div>

    {/* Forest Type and Soil Type */}
    <div className="chart-card">
        <ResponsiveContainer width="100%" height={250}>
            <PieChart>
                <Pie
                    data={forestTypeData}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={90}
                    label
                >
                    {forestTypeData.map((_, index) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                </Pie>
                <Legend />
                <Tooltip />
            </PieChart>
        </ResponsiveContainer>

        <ResponsiveContainer width="100%" height={250}>
            <PieChart>
                <Pie
                    data={soilTypeData}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={90}
                    label
                >
                    {soilTypeData.map((_, index) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                </Pie>
                <Legend />
                <Tooltip />
            </PieChart>
        </ResponsiveContainer>
    </div>
</div>

    </div>
  );
}

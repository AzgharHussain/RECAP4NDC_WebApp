import React, { useState, useEffect } from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { DatePicker, Select } from "antd";
import "./Dashboard.css";
import filterIcon from "../assets/filter.png";

const { Option } = Select;

// A custom tooltip component to style the tooltip in the BarChart.
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div
        style={{
          background: "rgba(255, 255, 255, 0.8)",
          border: "1px solid #ccc",
          padding: "10px",
          borderRadius: "5px",
          color: "#000",
        }}
      >
        <p className="label">{`${label}`}</p>
        <p
          className="intro"
          style={{ color: "#339af0" }}
        >{`${payload[0].name}: ${payload[0].value}`}</p>
      </div>
    );
  }
  return null;
};

// A custom label for the PieChart to show the value.
const renderCustomizedLabel = ({ name, percent, value }) => {
  return `${name}: ${value}`;
};

// 🎨 Color Palette for charts
const COLORS = [
   "#ff5722", // Deep Orange
  "#607d8b", // Blue Grey
  "#795548", // Brown Accent
  "#c2185b", // Berry Pink
  "#8bc34a", // Light Green
  "#2196f3", // Blue
  "#f44336", // Red
  "#e91e63", // Pink Accent
  "#009688", // Teal Accent
  "#edc949", // Yellow
  "#9c755f", // Brown
  "#bab0ac", // Grey
  "#af7aa1", // Purple
  "#ff9da7", // Pink
  "#76b7b2", // Teal
  "#59a14f", // Green
  "#f0a5bc", // Light Pink
  "#ff6361", // Coral
  "#3f51b5", // Indigo
  "#00bcd4", // Cyan
  "#4caf50", // Green
  "#ffeb3b", // Yellow Accent
  "#9e9e9e", // Grey Accent
  "#673ab7", // Deep Purple
 
];


export default function Dashboard() {
  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);
  const [patrolData, setPatrolData] = useState([]);
  const [incidentsData, setIncidentsData] = useState([]);
  const [loadingPatrols, setLoadingPatrols] = useState(false);
  const [loadingIncidents, setLoadingIncidents] = useState(false);
  const [loadingIssues, setLoadingIssues] = useState(false); // Loading state for issue type data
  const [issueTypeData, setIssueTypeData] = useState([]); 

  // Fetch patrol data with a loading state
useEffect(() => {
  const fetchPatrolData = async () => {
    setLoadingPatrols(true);
    try {
      const res = await fetch(
        "http://68.178.167.39:5000/api/patrols-by-user?user_id=1"
      );
      const patrols = await res.json();

      let filtered = patrols;

      if (fromDate && toDate) {
        // Both From and To selected
        filtered = patrols.filter((item) => {
          const d = new Date(item.start_time);
          return d >= fromDate.toDate() && d <= toDate.toDate();
        });
      } else if (fromDate) {
        // Only From Date
        filtered = patrols.filter((item) => {
          const d = new Date(item.start_time);
          return d >= fromDate.toDate();
        });
      } else if (toDate) {
        // Only To Date
        filtered = patrols.filter((item) => {
          const d = new Date(item.start_time);
          return d <= toDate.toDate();
        });
      }

      // Group by month
      const monthlyMap = {};
      filtered.forEach((p) => {
        const d = new Date(p.start_time);
        const month = d.toLocaleString("default", { month: "short", year: "numeric" });
        monthlyMap[month] = (monthlyMap[month] || 0) + 1;
      });

      const chartData = Object.keys(monthlyMap)
        .map((month) => ({ name: month, value: monthlyMap[month] }))
        .sort((a, b) => new Date(a.name) - new Date(b.name));

      setPatrolData(chartData);
    } catch (error) {
      console.error("Error fetching patrol data:", error);
      setPatrolData([]);
    } finally {
      setLoadingPatrols(false);
    }
  };

  fetchPatrolData();
}, [fromDate, toDate]);




  // Fetch incident data with a loading state
useEffect(() => {
  const fetchIncidentData = async () => {
    setLoadingIncidents(true);
    try {
      const res = await fetch(
        "http://68.178.167.39:5000/api/incidents-with-images?user_id=2"
      );
      const incidents = await res.json();

      let filtered = incidents;

      if (fromDate && toDate) {
        filtered = incidents.filter((item) => {
          const d = new Date(item.p_incident_time);
          return d >= fromDate.toDate() && d <= toDate.toDate();
        });
      } else if (fromDate) {
        filtered = incidents.filter((item) => {
          const d = new Date(item.p_incident_time);
          return d >= fromDate.toDate();
        });
      } else if (toDate) {
        filtered = incidents.filter((item) => {
          const d = new Date(item.p_incident_time);
          return d <= toDate.toDate();
        });
      }

      // Group by category
      const categoryMap = {};
      filtered.forEach((item) => {
        const cat = item.p_category_name || "Unknown";
        categoryMap[cat] = (categoryMap[cat] || 0) + 1;
      });

      const chartData = Object.keys(categoryMap).map((cat) => ({
        name: cat,
        value: categoryMap[cat],
      }));

      setIncidentsData(chartData);
    } catch (error) {
      console.error("Error fetching incident data:", error);
    } finally {
      setLoadingIncidents(false);
    }
  };

  fetchIncidentData();
}, [fromDate, toDate]);


// Fetch issue type data from the new API URL
  useEffect(() => {
    const fetchIssueTypeData = async () => {
      setLoadingIssues(true);
      try {
        const res = await fetch(
          "http://68.178.167.39:5000/api/coupe/log-with-images?user_id=2"
        );
        const logs = await res.json();

        // Group by issue type
        const issueTypeMap = {};
        logs.forEach((log) => {
          const issueType = log.p_issue_type || "Unknown";
          issueTypeMap[issueType] = (issueTypeMap[issueType] || 0) + 1;
        });

        const chartData = Object.keys(issueTypeMap).map((type) => ({
          name: type,
          value: issueTypeMap[type],
        }));

        setIssueTypeData(chartData); // Now this works because issueTypeData is initialized
      } catch (error) {
        console.error("Error fetching issue type data:", error);
        setIssueTypeData([]);
      } finally {
        setLoadingIssues(false);
      }
    };

    fetchIssueTypeData();
  }, [fromDate, toDate]);

  // A helper function to check if the data is empty for the bar chart.
  const isPatrolDataEmpty =
    patrolData.length === 0 || patrolData[0].value === 0;

  return (
    <div className="dashboard-container">
      <div className="heading-container">
        <h3 className="main-heading">Overview</h3>
        <div className="filters">
          {/* From Date */}
          <div className="filter-item">
            <DatePicker
              value={fromDate}
              onChange={setFromDate}
              placeholder="Select From Date"
              style={{
                width: "200px",
                color: "#fff",
                border: "2.21px solid rgba(255, 255, 255, 0.23)",
                background: "rgba(255, 255, 255, 0.02)",
                boxShadow:
                  "-10.261px -10.261px 5.13px -11.971px #B3B3B3 inset, 13.681px 13.681px 7.696px -15.391px #FFF inset",
              }}
              dropdownClassName="custom-date-picker-dropdown"
            />
          </div>
          {/* To Date */}
          <div className="filter-item">
            <DatePicker
              value={toDate}
              onChange={setToDate}
              placeholder="Select To Date"
              style={{
                width: "200px",
                color: "#fff",
                border: "2.21px solid rgba(255, 255, 255, 0.23)",
                background: "rgba(255, 255, 255, 0.02)",
                boxShadow:
                  "-10.261px -10.261px 5.13px -11.971px #B3B3B3 inset, 13.681px 13.681px 7.696px -15.391px #FFF inset",
              }}
              dropdownClassName="custom-date-picker-dropdown"
            />
          </div>
          {/* Division */}
          <div className="filter-item">
            <Select
              defaultValue="all"
              style={{
                width: "200px",
                color: "#fff",
                border: "2.21px solid rgba(255, 255, 255, 0.23)",
                background: "rgba(255, 255, 255, 0.02)",
                boxShadow:
                  "-10.261px -10.261px 5.13px -11.971px #B3B3B3 inset",
              }}
            >
              <Option value="all">All Divisions</Option>
              <Option value="north">North Division</Option>
              <Option value="south">South Division</Option>
            </Select>
          </div>
          {/* Range */}
          <div className="filter-item">
            <Select
              defaultValue="all"
              style={{
                width: "200px",
                color: "#fff",
                border: "2.21px solid rgba(255, 255, 255, 0.23)",
                background: "rgba(255, 255, 255, 0.02)",
                boxShadow:
                  "-10.261px -10.261px 5.13px -11.971px #B3B3B3 inset",
              }}
            >
              <Option value="all">All Ranges</Option>
              <Option value="range1">Range 1</Option>
              <Option value="range2">Range 2</Option>
            </Select>
          </div>
          <button>
            <img src={filterIcon} alt="Filter Icon" className="FilterIcon" />
          </button>
        </div>
      </div>
      <div className="charts-grid">
         <div className="chart-card">
          <h3>Forest Cover Change</h3>
          <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  
                >
                  
                
                </Pie>
                <Legend 
                layout="vertical"
          verticalAlign="top"  // Align it to the top
          align="right"  // Align legend to the right
          wrapperStyle={{
            marginTop: 20, // Add margin space between Pie chart and Legend
          }}
                />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        {/* Patrolling Count */}
        <div className="chart-card">
          <h3>Total number of Patrols Conducted</h3>
          {loadingPatrols ? (
            <div className="loading-state">Loading...</div>
          ) : isPatrolDataEmpty ? (
            <div className="no-data-state">
              No patrol data available for the selected period.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={patrolData}>
                <XAxis dataKey="name" stroke="#fff" />
                <YAxis stroke="#fff" />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value">
                  {patrolData.map((entry, index) => (
                    <Cell
                      key={`cell-bar-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
       
      </div>
      {/* Issue Type Chart - Change Pie to Bar */}
      <div className="charts-grid">
         {/* Incidents */}
        <div className="chart-card">
          <h3>Total number of Incidents</h3>
          {loadingIncidents ? (
            <div className="loading-state">Loading...</div>
          ) : incidentsData.length === 0 ? (
            <div className="no-data-state">
              No incident data available for the selected period.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={incidentsData}
                dataKey="value"
                nameKey="name"
                outerRadius="80%" // Adjust size to avoid overcrowding
                labelLine={false} // Disable label lines for mobile devices
                label={({ name, percent, value }) => `${name}: ${value}`} // Custom label
              >
                {incidentsData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Legend 
                layout="vertical"
                verticalAlign="top" // Align legend at the top
                align="right" // Align legend to the right
                wrapperStyle={{
                  marginTop: 20, // Add margin space
                  fontSize: "12px", // Reduce font size on mobile
                }}
              />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>

          )}
        </div>
        <div className="chart-card">
          <h3>Observation Issues Reported</h3>
          {loadingIssues ? (
            <div className="loading-state">Loading...</div>
          ) : issueTypeData.length === 0 ? (
            <div className="no-data-state">No issue type data available.</div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={issueTypeData}>
                <XAxis dataKey="name" stroke="#fff" />
                <YAxis stroke="#fff" />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value">
                  {issueTypeData.map((entry, index) => (
                    <Cell
                      key={`cell-bar-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}

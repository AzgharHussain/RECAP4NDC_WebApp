import React, { useState, useEffect, useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Label,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Select, Table } from "antd";
import { useLanguage } from "../context/LanguageContext";
import "./Dashboard.css";
import filterIcon from "../assets/filter.png";
import { API_BASE_URL } from "../config";

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
        <p className="intro" style={{ color: "#339af0" }}>
          {`${payload[0].name}: ${payload[0].value}`}
        </p>
      </div>
    );
  }
  return null;
};

// 🎨 Color Palette for charts
const COLORS = [
  "#59a14f",
  "#f44336",
  "#607d8b",
  "#795548",
  "#c2185b",
  "#8bc34a",
  "#2196f3",
  "#e91e63",
  "#009688",
  "#edc949",
  "#9c755f",
  "#bab0ac",
  "#af7aa1",
  "#ff9da7",
  "#76b7b2",
  "#f0a5bc",
  "#ff6361",
  "#3f51b5",
  "#00bcd4",
  "#4caf50",
  "#ffeb3b",
  "#9e9e9e",
  "#673ab7",
];

export default function Dashboard() {
  const { language } = useLanguage();
  const text = {
    en: {
      overview: "Overview",
      selectFromDate: "Select From Date",
      selectToDate: "Select To Date",
      allDivisions: "All Divisions",
      allRanges: "All Ranges",
      forestChange: "Forest Cover Change",
      totalPatrols: "Total Number of Patrols Conducted",
      totalIncidents: "Total Number of Incidents",
      observationIssues: "Observation Issues Reported",
      totalArea: "Total Area of Forest Change",
      noForestData: "No forest change data available.",
      noPatrolData: "No patrol data available for the selected filters.",
      noIncidentData: "No incident data available for the selected period.",
      noIssueData: "No issue type data available.",
      loading: "Loading...",
      patrolDetails: "Patrol Details",
      officerName: "Officer Name",
      startTime: "Start Time",
      endTime: "End Time",
      distance: "Distance (km)",
      startLocation: "Start Location",
      endLocation: "End Location",
      patrolId: "Patrol ID",
      noTableData: "No patrol data available",
      dayPatrolling: "Day Patrolling",
      nightPatrolling: "Night Patrolling",
      beatChecking: "Beat Checking",
      allForests: "All Forest Types",
      selectForest: "Select Forest Type",
      allPatrolTypes: "All Patrol Types",
      selectPatrolType: "Select Patrol Type",
      selectDivision: "Select Division",
      selectRange: "Select Range",
    },
    gu: {
      overview: "સારાંશ",
      selectFromDate: "થી તારીખ પસંદ કરો",
      selectToDate: "સુધી તારીખ પસંદ કરો",
      allDivisions: "બધી ડિવિઝન",
      allRanges: "બધા રેન્જ",
      forestChange: "વન આવરણમાં ફેરફાર",
      totalPatrols: "કુલ પેટ્રોલિંગ કામગીરી",
      totalIncidents: "કુલ ઘટનાઓની સંખ્યા",
      observationIssues: "અવલોકન મુદ્દા નોંધાયા",
      totalArea: "વન આવરણમાં કુલ ફેરફાર વિસ્તાર",
      noForestData: "વન ફેરફારના ડેટા ઉપલબ્ધ નથી.",
      noPatrolData: "પસંદ કરેલા ફિલ્ટર્સ માટે પેટ્રોલિંગ ડેટા ઉપલબ્ધ નથી.",
      noIncidentData: "પસંદ કરેલા સમયગાળા માટે ઘટનાઓનો ડેટા ઉપલબ્ધ નથી.",
      noIssueData: "મુદ્દાના પ્રકારનો ડેટા ઉપલબ્ધ નથી.",
      loading: "લોડ થઈ રહ્યું છે...",
      patrolDetails: "પેટ્રોલ વિગતો",
      officerName: "અધિકારીનું નામ",
      startTime: "શરૂઆતનો સમય",
      endTime: "સમાપ્તિનો સમય",
      distance: "અંતર (કિ.મી.)",
      startLocation: "શરૂઆતનું સ્થાન",
      endLocation: "સમાપ્તિનું સ્થાન",
      patrolId: "પેટ્રોલ આઈડી",
      noTableData: "પેટ્રોલ ડેટા ઉપલબ્ધ નથી",
      dayPatrolling: "દિવસ પેટ્રોલિંગ",
      nightPatrolling: "રાત્રિ પેટ્રોલિંગ",
      beatChecking: "બીટ ચેકિંગ",
      allForests: "બધા વન પ્રકાર",
      selectForest: "વન પ્રકાર પસંદ કરો",
      allPatrolTypes: "બધા પેટ્રોલ પ્રકાર",
      selectPatrolType: "પેટ્રોલ પ્રકાર પસંદ કરો",
      selectDivision: "ડિવિઝન પસંદ કરો",
      selectRange: "રેન્જ પસંદ કરો",
    },
  };

  // Data and filter states
  const [rawPatrolsData, setRawPatrolsData] = useState([]);
  const [patrolDataLoading, setPatrolDataLoading] = useState(false);

  const [forestTypes, setForestTypes] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [ranges, setRanges] = useState([]);
  const [patrollingTypes, setPatrollingTypes] = useState([]);

  const [selectedForest, setSelectedForest] = useState("all");
  const [selectedDivision, setSelectedDivision] = useState("all");
  const [selectedRange, setSelectedRange] = useState("all");
  const [selectedPatrolType, setSelectedPatrolType] = useState("all");

  const [forestChangeData, setForestChangeData] = useState([]);
  const [loadingForest, setLoadingForest] = useState(false);

  const [tableLoading, setTableLoading] = useState(false);

  // Utility to attempt many possible keys when filtering unknown payload structures
  const matchesValue = (item, candidates, selectedVal) => {
    if (!selectedVal || selectedVal === "all") return true;
    
    for (const key of candidates) {
      if (item == null) continue;
      const val = item[key];
      if (val == null) continue;
      
      // Normalize both values for comparison
      const normalizedVal = String(val).toLowerCase().trim();
      const normalizedSelected = String(selectedVal).toLowerCase().trim();
      
      // Exact match
      if (normalizedVal === normalizedSelected) return true;
      
      // Allow partial matching for text fields
      if (normalizedVal.includes(normalizedSelected) || normalizedSelected.includes(normalizedVal)) {
        return true;
      }
      
      // Numeric match
      if (!Number.isNaN(Number(selectedVal)) && Number(val) === Number(selectedVal)) return true;
    }
    return false;
  };

  // Improved patrol type matching function
  const matchesPatrolType = (patrolItem, selectedType) => {
    if (!selectedType || selectedType === "all") return true;
    
    // Get the patrol type from the item using various possible keys
    const patrolTypeValue = patrolItem.type_name || patrolItem.type || patrolItem.patrol_type || "";
    const patrolTypeId = patrolItem.type_id || patrolItem.patrol_type_id;
    
    // If selectedType is a number (ID), check against both ID and name
    if (!isNaN(selectedType)) {
      const selectedPatrolType = patrollingTypes.find(t => 
        String(t.id) === String(selectedType) || 
        String(t.type_id) === String(selectedType)
      );
      
      if (selectedPatrolType) {
        const selectedName = selectedPatrolType.type_name || selectedPatrolType.name;
        // Compare both ID and name
        return String(patrolTypeId) === String(selectedType) || 
               patrolTypeValue.toString().toLowerCase().trim() === 
               selectedName.toString().toLowerCase().trim();
      }
      return false;
    }
    
    // If selectedType is a string, do direct comparison
    return patrolTypeValue.toString().toLowerCase().trim() === 
           selectedType.toString().toLowerCase().trim();
  };

  // Fetch patrols once (no date filters anymore). Filtering will be applied on client side.
  useEffect(() => {
    const fetchPatrols = async () => {
      setPatrolDataLoading(true);
      setTableLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/api/patrol-info`);
        const json = await res.json();
        const data = json?.data || json || [];
        console.log("Fetched patrol data:", data);
        console.log("Available patrol types in data:", 
          [...new Set(data.map(p => 
            p.type_name || p.type || p.patrol_type || "Unknown"
          ))]
        );
        setRawPatrolsData(data);
      } catch (err) {
        console.error("Error fetching patrol data:", err);
        setRawPatrolsData([]);
      } finally {
        setPatrolDataLoading(false);
        setTableLoading(false);
      }
    };
    fetchPatrols();
  }, []);

  // Fetch forest types and patrolling types on mount
  useEffect(() => {
    const fetchForestTypes = async () => {
      try {
        setLoadingForest(true);
        const response = await fetch(`${API_BASE_URL}/api/forest-types`);
        const data = await response.json();
        setForestTypes(data?.data || data || []);
      } catch (error) {
        console.error("Error fetching forest types:", error);
        setForestTypes([]);
      } finally {
        setLoadingForest(false);
      }
    };

    const fetchPatrollingTypes = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/patrolling-types`);
        const data = await response.json();
        console.log("Fetched patrolling types:", data);
        setPatrollingTypes(data?.data || data || []);
      } catch (error) {
        console.error("Error fetching patrolling types:", error);
        setPatrollingTypes([]);
      }
    };

    fetchForestTypes();
    fetchPatrollingTypes();
  }, []);

  // Fetch divisions when a forest type is chosen (dependent select)
  const fetchDivisions = async (forestId) => {
    if (!forestId || forestId === "all") {
      setDivisions([]);
      setRanges([]);
      return;
    }
    try {
      setLoadingForest(true);
      const response = await fetch(`${API_BASE_URL}/api/get-divisions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forest_id: forestId }),
      });
      const data = await response.json();
      setDivisions(data?.data || data || []);
    } catch (error) {
      console.error("Error fetching divisions:", error);
      setDivisions([]);
    } finally {
      setLoadingForest(false);
    }
  };

  // Fetch ranges when a division is chosen (dependent select)
  const fetchRanges = async (divisionId) => {
    if (!divisionId || divisionId === "all") {
      setRanges([]);
      return;
    }
    try {
      setLoadingForest(true);
      const response = await fetch(`${API_BASE_URL}/api/get-ranges`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ division_id: divisionId }),
      });
      const data = await response.json();
      setRanges(data?.data || data || []);
    } catch (error) {
      console.error("Error fetching ranges:", error);
      // Fallback: extract ranges from patrol data
      const rangesFromData = rawPatrolsData
        .filter(patrol => {
          const divisionCandidates = ["division_id", "divisionId", "division_name", "divisionName"];
          return matchesValue(patrol, divisionCandidates, divisionId);
        })
        .reduce((uniqueRanges, patrol) => {
          const rangeCandidates = ["range", "range_id", "rangeId", "range_name", "rangeName"];
          for (const key of rangeCandidates) {
            if (patrol[key]) {
              const rangeValue = patrol[key];
              if (!uniqueRanges.some(r => r.id === rangeValue || r.name === rangeValue)) {
                uniqueRanges.push({ id: rangeValue, name: rangeValue });
              }
              break;
            }
          }
          return uniqueRanges;
        }, []);
      setRanges(rangesFromData);
    } finally {
      setLoadingForest(false);
    }
  };

  // when user selects forest, load divisions
  useEffect(() => {
    if (selectedForest && selectedForest !== "all") {
      fetchDivisions(selectedForest);
      setSelectedDivision("all"); // reset division on forest change
      setSelectedRange("all"); // reset range on forest change
    } else {
      setDivisions([]);
      setRanges([]);
      setSelectedDivision("all");
      setSelectedRange("all");
    }
  }, [selectedForest]);

  // when user selects division, load ranges
  useEffect(() => {
    if (selectedDivision && selectedDivision !== "all") {
      fetchRanges(selectedDivision);
      setSelectedRange("all"); // reset range on division change
    } else {
      setRanges([]);
      setSelectedRange("all");
    }
  }, [selectedDivision]);

  // Filter rawPatrolsData according to selects
  const filteredPatrols = useMemo(() => {
    if (!rawPatrolsData || !rawPatrolsData.length) return [];
    
    return rawPatrolsData.filter((p) => {
      // Guess multiple candidate keys because backend shape can vary
      const forestCandidates = ["forest_id", "forestId", "forest_type_id", "forest_type", "forest_type_name", "forestName"];
      const divisionCandidates = ["division_id", "divisionId", "division_name", "divisionName"];
      const rangeCandidates = ["range", "range_id", "rangeId", "range_name", "rangeName"];

      const forestMatches = matchesValue(p, forestCandidates, selectedForest);
      const divisionMatches = matchesValue(p, divisionCandidates, selectedDivision);
      const rangeMatches = matchesValue(p, rangeCandidates, selectedRange);
      
      // Use the specialized function for patrol types
      const patrolTypeMatches = matchesPatrolType(p, selectedPatrolType);

      return forestMatches && divisionMatches && rangeMatches && patrolTypeMatches;
    });
  }, [rawPatrolsData, selectedForest, selectedDivision, selectedRange, selectedPatrolType, patrollingTypes]);

  // Build monthly chart data from filteredPatrols
  const patrolChartData = useMemo(() => {
    const monthlyMap = {};
    filteredPatrols.forEach((p) => {
      const d = new Date(p.start_time || p.started_at || p.created_at || p.startTime);
      if (isNaN(d)) return;
      const month = d.toLocaleString("default", { month: "short", year: "numeric" });
      monthlyMap[month] = (monthlyMap[month] || 0) + 1;
    });
    const chartData = Object.keys(monthlyMap)
      .map((month) => ({ name: month, value: monthlyMap[month] }))
      .sort((a, b) => new Date(a.name) - new Date(b.name));
    return chartData;
  }, [filteredPatrols]);

  // Debug effect to monitor filtering
  useEffect(() => {
    console.log("=== FILTER DEBUGGING ===");
    console.log("Selected Filters:", {
      forest: selectedForest,
      division: selectedDivision,
      range: selectedRange,
      patrolType: selectedPatrolType
    });
    console.log("Total raw patrols:", rawPatrolsData.length);
    console.log("Filtered patrols count:", filteredPatrols.length);
    console.log("Available patrol types in filtered data:", 
      [...new Set(filteredPatrols.map(p => 
        p.type_name || p.type || p.patrol_type || "Unknown"
      ))]
    );
    
    // Log table counts
    console.log("Day patrols:", dayPatrollingData.length);
    console.log("Night patrols:", nightPatrollingData.length);
    console.log("Beat checking:", beatCheckingData.length);
  }, [selectedForest, selectedDivision, selectedRange, selectedPatrolType, filteredPatrols]);

  // Prepare table data helpers
  const formatDate = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    if (isNaN(date)) return dateString;
    return date.toLocaleDateString(language === "gu" ? "gu-IN" : "en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatLocation = (location) => {
    if (!location) return "-";
    return location;
  };

  const prepareTableData = (data) =>
    data.map((patrol, index) => ({
      key: patrol.patrol_id || patrol.id || index,
      patrolId: patrol.patrol_id || patrol.id || "-",
      officerName: patrol.patrol_officer_name || patrol.officer_name || patrol.officer || "-",
      startTime: formatDate(patrol.start_time || patrol.startTime || patrol.started_at),
      endTime: formatDate(patrol.end_time || patrol.endTime || patrol.ended_at),
      distance: parseFloat(patrol.distance_kms || patrol.distance || 0).toFixed(2),
      startLocation: formatLocation(patrol.start_location || patrol.startLocation),
      endLocation: formatLocation(patrol.end_location || patrol.endLocation),
      rawData: patrol,
    }));

  // split filtered patrols by patrol type name (using common keys)
  const dayPatrollingData = filteredPatrols.filter((p) =>
    (p.type_name || p.type || p.patrol_type || "").toString().toLowerCase().includes("day")
  );
  const nightPatrollingData = filteredPatrols.filter((p) =>
    (p.type_name || p.type || p.patrol_type || "").toString().toLowerCase().includes("night")
  );
  const beatCheckingData = filteredPatrols.filter((p) =>
    (p.type_name || p.type || p.patrol_type || "").toString().toLowerCase().includes("beat")
  );

  const dayPatrollingTableData = prepareTableData(dayPatrollingData);
  const nightPatrollingTableData = prepareTableData(nightPatrollingData);
  const beatCheckingTableData = prepareTableData(beatCheckingData);

  // Table columns configuration
  const columns = [
    {
      title: text[language].patrolId,
      dataIndex: "patrolId",
      key: "patrolId",
      width: 100,
      sorter: (a, b) => {
        const na = Number(a.patrolId) || 0;
        const nb = Number(b.patrolId) || 0;
        return na - nb;
      },
    },
    {
      title: text[language].officerName,
      dataIndex: "officerName",
      key: "officerName",
      width: 150,
    },
    {
      title: text[language].startTime,
      dataIndex: "startTime",
      key: "startTime",
      width: 180,
      sorter: (a, b) => new Date(a.rawData?.start_time || a.rawData?.started_at || 0) - new Date(b.rawData?.start_time || b.rawData?.started_at || 0),
    },
    {
      title: text[language].endTime,
      dataIndex: "endTime",
      key: "endTime",
      width: 180,
      sorter: (a, b) => new Date(a.rawData?.end_time || a.rawData?.ended_at || 0) - new Date(b.rawData?.end_time || b.rawData?.ended_at || 0),
    },
    {
      title: text[language].distance,
      dataIndex: "distance",
      key: "distance",
      width: 120,
      sorter: (a, b) => parseFloat(a.distance) - parseFloat(b.distance),
      render: (distance) => `${distance} km`,
    },
    {
      title: text[language].startLocation,
      dataIndex: "startLocation",
      key: "startLocation",
      width: 200,
      ellipsis: true,
    },
    {
      title: text[language].endLocation,
      dataIndex: "endLocation",
      key: "endLocation",
      width: 200,
      ellipsis: true,
    },
  ];

  const isPatrolDataEmpty = patrolChartData.length === 0 || patrolChartData[0]?.value === 0;

  return (
    <div className="dashboard-container">
      <div className="heading-container">
        <h3 className="main-heading">{text[language].overview}</h3>
        <div className="filters" style={{ alignItems: "center" }}>
          {/* Forest type select */}
          {/* <div className="filter-item" style={{ minWidth: 200 }}>
            <Select
              value={selectedForest}
              onChange={setSelectedForest}
              placeholder={text[language].selectForest}
              style={{
                width: "100%",
                color: "#fff",
                border: "2.21px solid rgba(255, 255, 255, 0.23)",
                background: "rgba(255, 255, 255, 0.02)",
                boxShadow: "-10.261px -10.261px 5.13px -11.971px #B3B3B3 inset",
              }}
            >
              <Option value="all">{text[language].allForests}</Option>
              {forestTypes.map((forest) => {
                const id = forest.forest_id ?? forest.id ?? forest.value ?? forest.key;
                const name = forest.forest_type_name ?? forest.name ?? forest.label ?? forest.forest_name;
                return (
                  <Option key={id || name} value={id || name}>
                    {name || id}
                  </Option>
                );
              })}
            </Select>
          </div> */}

          {/* Division select */}
          {/* <div className="filter-item" style={{ minWidth: 200 }}>
            <Select
              value={selectedDivision}
              onChange={setSelectedDivision}
              placeholder={text[language].selectDivision}
              disabled={!selectedForest || selectedForest === "all" || divisions.length === 0}
              style={{
                width: "100%",
                color: "#fff",
                border: "2.21px solid rgba(255, 255, 255, 0.23)",
                background: "rgba(255, 255, 255, 0.02)",
                boxShadow: "-10.261px -10.261px 5.13px -11.971px #B3B3B3 inset",
              }}
            >
              <Option value="all">{text[language].allDivisions}</Option>
              {divisions.map((division) => {
                const id = division.division_id ?? division.id ?? division.value ?? division.key;
                const name = division.division_name ?? division.name ?? division.label;
                return (
                  <Option key={id || name} value={id || name}>
                    {name || id}
                  </Option>
                );
              })}
            </Select>
          </div> */}

          {/* Range select */}
          {/* <div className="filter-item" style={{ minWidth: 200 }}>
            <Select
              value={selectedRange}
              onChange={setSelectedRange}
              placeholder={text[language].selectRange}
              disabled={!selectedDivision || selectedDivision === "all" || ranges.length === 0}
              style={{
                width: "100%",
                color: "#fff",
                border: "2.21px solid rgba(255, 255, 255, 0.23)",
                background: "rgba(255, 255, 255, 0.02)",
                boxShadow: "-10.261px -10.261px 5.13px -11.971px #B3B3B3 inset",
              }}
            >
              <Option value="all">{text[language].allRanges}</Option>
              {ranges.map((range) => {
                const id = range.range_id ?? range.id ?? range.value ?? range.key;
                const name = range.range_name ?? range.name ?? range.label;
                return (
                  <Option key={id || name} value={id || name}>
                    {name || id}
                  </Option>
                );
              })}
            </Select>
          </div> */}

          {/* Patrolling type select */}
          <div className="filter-item" style={{ minWidth: 200 }}>
            <Select
              value={selectedPatrolType}
              onChange={setSelectedPatrolType}
              placeholder={text[language].selectPatrolType}
              style={{
                width: "100%",
                color: "#fff",
                border: "2.21px solid rgba(255, 255, 255, 0.23)",
                background: "rgba(255, 255, 255, 0.02)",
                boxShadow: "-10.261px -10.261px 5.13px -11.971px #B3B3B3 inset",
              }}
            >
              <Option value="all">{text[language].allPatrolTypes}</Option>
              {patrollingTypes.map((t) => {
                const id = t.type_id ?? t.id ?? t.value ?? t.key;
                const name = t.type_name ?? t.name ?? t.label;
                
                return (
                  <Option key={id || name} value={id || name}>
                    {name || id}
                  </Option>
                );
              })}
            </Select>
          </div>

          <button
            onClick={() => {
              // reset all filters
              setSelectedForest("all");
              setSelectedDivision("all");
              setSelectedRange("all");
              setSelectedPatrolType("all");
            }}
            style={{
              marginLeft: 8,
              background: "transparent",
              border: "none",
              cursor: "pointer",
            }}
            title="Reset filters"
          >
            <img src={filterIcon} alt="Filter Icon" className="FilterIcon" />
          </button>
        </div>
      </div>

      {/* Charts grid */}
      <div className="charts-grid">
        {/* Forest Cover Change Chart */}
        <div className="chart-card" style={{ textAlign: "center" }}>
          <h3 style={{ marginBottom: "8px", color: "#000", fontWeight: 600 }}>
            {text[language].forestChange}
          </h3>
          <div
            style={{
              width: "100%",
              height: "1.5px",
              backgroundColor: "rgba(255, 255, 255, 0.13)",
              margin: "0 0 -15px 0",
              borderRadius: "2px",
              boxShadow:
                "-9.048px -9.048px 4.524px -10.556px #B3B3B3 inset, " +
                "12.064px 12.064px 6.786px -13.572px #FFF inset",
              border: "0.949px solid rgba(255, 255, 255, 0.30)",
            }}
          ></div>
          {loadingForest ? (
            <div className="loading-state">{text[language].loading}</div>
          ) : forestChangeData.length === 0 ? (
            <div className="no-data-state">{text[language].noForestData}</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={forestChangeData}
                    dataKey="percentage"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={110}
                    startAngle={90}
                    endAngle={-270}
                    labelLine={false}
                  >
                    {forestChangeData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.name === "Afforestation" ? "#008125" : "#C5443E"}
                      />
                    ))}
                    <Label
                      value={forestChangeData.reduce((acc, cur) => acc + (cur.value || 0), 0).toLocaleString()}
                      position="center"
                      style={{
                        fontSize: "26px",
                        fontWeight: "bold",
                        fill: "#333",
                      }}
                    />
                  </Pie>
                  <Tooltip
                    formatter={(value) =>
                      typeof value === "number" ? `${value.toFixed(2)}%` : value
                    }
                    contentStyle={{
                      backgroundColor: "rgba(255,255,255,0.85)",
                      border: "1px solid #ddd",
                      borderRadius: "6px",
                      color: "#000",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <p style={{ marginTop: "-10px", fontSize: "16px", color: "#333", fontWeight: 500 }}>
                {text[language].totalArea}
              </p>
            </>
          )}
        </div>

        {/* Patrolling Count Chart */}
        <div className="chart-card" style={{ textAlign: "center" }}>
          <h3>{text[language].totalPatrols}</h3>
          <div
            style={{
              width: "100%",
              height: "1.5px",
              backgroundColor: "rgba(255, 255, 255, 0.13)",
              margin: "0 0 10px 0",
              borderRadius: "2px",
              boxShadow:
                "-9.048px -9.048px 4.524px -10.556px #B3B3B3 inset, " +
                "12.064px 12.064px 6.786px -13.572px #FFF inset",
              border: "0.949px solid rgba(255, 255, 255, 0.30)",
            }}
          ></div>
          {patrolDataLoading ? (
            <div className="loading-state">{text[language].loading}</div>
          ) : isPatrolDataEmpty ? (
            <div className="no-data-state">{text[language].noPatrolData}</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={patrolChartData}>
                  <XAxis dataKey="name" stroke="#fff" interval={0} angle={-30} textAnchor="end" height={60} />
                  <YAxis stroke="#000" />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value">
                    {patrolChartData.map((entry, index) => (
                      <Cell key={`cell-bar-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <p style={{ marginTop: "8px", fontSize: "16px", color: "#333", fontWeight: 500 }}>
                {text[language].totalPatrols}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Patrols Data Tables Section */}
      <div className="tables-section">
        {/* Day Patrolling Table */}
        <div className="table-card">
          <h3 style={{ marginBottom: "16px", color: "#000", fontWeight: 600 }}>
            {text[language].dayPatrolling}
          </h3>
          <div
            style={{
              width: "100%",
              height: "1.5px",
              backgroundColor: "rgba(255, 255, 255, 0.13)",
              borderRadius: "2px",
              boxShadow:
                "-9.048px -9.048px 4.524px -10.556px #B3B3B3 inset, " +
                "12.064px 12.064px 6.786px -13.572px #FFF inset",
              border: "0.949px solid rgba(255, 255, 255, 0.30)",
            }}
          ></div>
          {tableLoading ? (
            <div className="loading-state">{text[language].loading}</div>
          ) : dayPatrollingTableData.length === 0 ? (
            <div className="no-data-state">{text[language].noTableData}</div>
          ) : (
            <Table
              dataSource={dayPatrollingTableData}
              columns={columns}
              pagination={{
                pageSize: 5,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} ${text[language].patrolDetails}`,
              }}
              scroll={{ x: 1000 }}
              size="middle"
              style={{
                background: "rgba(255, 255, 255, 0.02)",
                borderRadius: "8px",
              }}
            />
          )}
        </div>

        {/* Night Patrolling Table */}
        <div className="table-card">
          <h3 style={{ marginBottom: "16px", color: "#000", fontWeight: 600 }}>
            {text[language].nightPatrolling}
          </h3>
          <div
            style={{
              width: "100%",
              height: "1.5px",
              backgroundColor: "rgba(255, 255, 255, 0.13)",
              borderRadius: "2px",
              boxShadow:
                "-9.048px -9.048px 4.524px -10.556px #B3B3B3 inset, " +
                "12.064px 12.064px 6.786px -13.572px #FFF inset",
              border: "0.949px solid rgba(255, 255, 255, 0.30)",
            }}
          ></div>
          {tableLoading ? (
            <div className="loading-state">{text[language].loading}</div>
          ) : nightPatrollingTableData.length === 0 ? (
            <div className="no-data-state">{text[language].noTableData}</div>
          ) : (
            <Table
              dataSource={nightPatrollingTableData}
              columns={columns}
              pagination={{
                pageSize: 5,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} ${text[language].patrolDetails}`,
              }}
              scroll={{ x: 1000 }}
              size="middle"
              style={{
                background: "rgba(255, 255, 255, 0.02)",
                borderRadius: "8px",
              }}
            />
          )}
        </div>

        {/* Beat Checking Table */}
        <div className="table-card">
          <h3 style={{ marginBottom: "16px", color: "#000", fontWeight: 600 }}>
            {text[language].beatChecking}
          </h3>
          <div
            style={{
              width: "100%",
              height: "1.5px",
              backgroundColor: "rgba(255, 255, 255, 0.13)",
              borderRadius: "2px",
              boxShadow:
                "-9.048px -9.048px 4.524px -10.556px #B3B3B3 inset, " +
                "12.064px 12.064px 6.786px -13.572px #FFF inset",
              border: "0.949px solid rgba(255, 255, 255, 0.30)",
            }}
          ></div>
          {tableLoading ? (
            <div className="loading-state">{text[language].loading}</div>
          ) : beatCheckingTableData.length === 0 ? (
            <div className="no-data-state">{text[language].noTableData}</div>
          ) : (
            <Table
              dataSource={beatCheckingTableData}
              columns={columns}
              pagination={{
                pageSize: 5,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} ${text[language].patrolDetails}`,
              }}
              scroll={{ x: 1000 }}
              size="middle"
              style={{
                background: "rgba(255, 255, 255, 0.02)",
                borderRadius: "8px",
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
import React, { useEffect, useState } from "react";
import axios from "axios";

import { API_BASE_URL } from '../config';

const NDVIMyCoups_dropdown = () => {
  const [divisions, setDivisions] = useState([]);
  const [ranges, setRanges] = useState([]);
  const [beats, setBeats] = useState([]);

  const [division, setDivision] = useState("");
  const [range, setRange] = useState("");
  const [beat, setBeat] = useState("");

  /* ------------------ Load Divisions from coupe_dropdown_master ------------------ */
  useEffect(() => {
    const fetchDivisions = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get(
          `${API_BASE_URL}/api/coupe-divisions`,
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );
        console.log("api/coupe-divisions", res.data);
        setDivisions(res.data[0]);
      } catch (error) {
        console.error("Error fetching divisions:", error);
      }
    };

    fetchDivisions();
  }, []);

  /* ------------------ Load Ranges based on selected Division ------------------ */
  const handleDivisionChange = async (e) => {
    const selectedDivision = e.target.value;
    setDivision(selectedDivision);
    setRange("");
    setBeat("");
    setRanges([]);
    setBeats([]);

    if (!selectedDivision) return;

    try {
      const token = localStorage.getItem("token");
      // Send division directly in the request body, not inside params
      const res = await axios.post(
        `${API_BASE_URL}/api/coupe-ranges`,
        {
          division: selectedDivision  // Direct body data
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );
      console.log("api/coupe-ranges", res.data);
      setRanges(res.data);
    } catch (error) {
      console.error("Error fetching ranges:", error);
    }
  };

  /* ------------------ Load Beats based on selected Division and Range ------------------ */
  const handleRangeChange = async (e) => {
    const selectedRange = e.target.value;
    setRange(selectedRange);
    setBeat("");
    setBeats([]);

    if (!selectedRange || !division) return;

    try {
      const token = localStorage.getItem("token");
      // Send division and range directly in the request body
      const res = await axios.post(
        `${API_BASE_URL}/api/coupe-beats`,
        {
          division: division,
          range: selectedRange
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );
      console.log("api/coupe-beats", res.data);
      setBeats(res.data);
    } catch (error) {
      console.error("Error fetching beats:", error);
    }
  };

  /* ------------------ Handle Beat Selection ------------------ */
  const handleBeatChange = (e) => {
    setBeat(e.target.value);
  };

  return (
    <div style={{ maxWidth: 400, paddingTop: "20px",paddingLeft: "20px", borderRadius: "5px", display: "flex", gap: "50px" }}>
      
      {/* Division Dropdown */}
      <div style={{ marginBottom: "15px" }}>
        <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Division</label>
        <select 
          value={division} 
          onChange={handleDivisionChange}
          style={{ width: "auto", padding: "8px", borderRadius: "4px", border: "1px solid #ddd" }}
        >
          <option value="">Select Division</option>
          {divisions.map((d, index) => (
            <option key={index} value={d.division}>
              {d.division}
            </option>
          ))}
        </select>
      </div>

      {/* Range Dropdown */}
      <div style={{ marginBottom: "15px" }}>
        <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Range</label>
        <select 
          value={range} 
          onChange={handleRangeChange}
          disabled={!division}
          style={{ width: "auto", padding: "8px", borderRadius: "4px", border: "1px solid #ddd", backgroundColor: !division ? "#f5f5f5" : "white" }}
        >
          <option value="">Select Range</option>
          {ranges.map((r, index) => (
            <option key={index} value={r.range}>
              {r.range}
            </option>
          ))}
        </select>
      </div>

      {/* Beat Dropdown */}
      <div style={{ marginBottom: "15px" }}>
        <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Beat</label>
        <select 
          value={beat} 
          onChange={handleBeatChange}
          disabled={!range}
          style={{ width: "auto", padding: "8px", borderRadius: "4px", border: "1px solid #ddd", backgroundColor: !range ? "#f5f5f5" : "white" }}
        >
          <option value="">Select Beat</option>
          {beats.map((b, index) => (
            <option key={index} value={b.beat}>
              {b.beat}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default NDVIMyCoups_dropdown;
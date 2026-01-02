import React, { useEffect, useState } from "react";
import axios from "axios";

export const API_BASE_URL = "http://68.178.167.39:5002";

const MyCoups_dropdown = () => {
  const [forestTypes, setForestTypes] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [beats, setBeats] = useState([]);
  const [coupes, setCoupes] = useState([]);

  const [forestId, setForestId] = useState("");
  const [division, setDivision] = useState("");
  const [beat, setBeat] = useState("");
  const [coupe, setCoupe] = useState("");

  const [hierarchyData, setHierarchyData] = useState([]);

  /* ------------------ Load Forest Types ------------------ */
  useEffect(() => {
    axios
      .get(`${API_BASE_URL}/api/forest-types`)
      .then((res) => setForestTypes(res.data))
      .catch((err) => console.error(err));
  }, []);

  /* ------------------ Load Divisions ------------------ */
  const handleForestChange = async (e) => {
    const id = e.target.value;
    setForestId(id);
    setDivision("");
    setBeat("");
    setCoupe("");
    setDivisions([]);
    setBeats([]);
    setCoupes([]);

    if (!id) return;
     
    const res = await axios.post(`${API_BASE_URL}/api/get-divisions`, {
      forest_id: id,
    });
       
    setDivisions(res.data);
  };

  /* ------------------ Load Hierarchy ------------------ */
  const handleDivisionChange = async (e) => {
    const div = e.target.value;
    setDivision(div);
    setBeat("");
    setCoupe("");
    setBeats([]);
    setCoupes([]);

    if (!div) return;

    const res = await axios.post(`${API_BASE_URL}/api/hierarchy`, {
      forest_id: forestId,
      division_name: div,
    });

    setHierarchyData(res.data);

    // Extract unique beats
    const uniqueBeats = [
      ...new Set(res.data.map((item) => item.BEAT)),
    ];

    setBeats(uniqueBeats);
  };

  /* ------------------ Load Coupes ------------------ */
  const handleBeatChange = (e) => {
    const selectedBeat = e.target.value;
    setBeat(selectedBeat);
    setCoupe("");

    const filteredCoupes = hierarchyData
      .filter((item) => item.BEAT === selectedBeat)
      .map((item) => item.coupe_name);

    setCoupes([...new Set(filteredCoupes)]);
  };

  return (
    <div style={{ maxWidth: 400 }}>
      {/* Forest Type */}
      <label>Forest Type</label>
      <select value={forestId} onChange={handleForestChange}>
        <option value="">Select Forest Type</option>
        {forestTypes.map((f) => (
          <option key={f.forest_id} value={f.forest_id}>
            {f.forest_type}
          </option>
        ))}
      </select>

      {/* Division */}
      <label>Division</label>
      <select value={division} onChange={handleDivisionChange}>
        <option value="">Select Division</option>
        {divisions.map((d, index) => (
          <option key={index} value={d.DIVISION}>
            {d.DIVISION}
          </option>
        ))}
      </select>

      {/* Beat */}
      <label>Beat</label>
      <select value={beat} onChange={handleBeatChange}>
        <option value="">Select Beat</option>
        {beats.map((b, index) => (
          <option key={index} value={b}>
            {b}
          </option>
        ))} 
      </select>

      {/* Coupe */}
      <label>Coupe</label>
      <select value={coupe} onChange={(e) => setCoupe(e.target.value)}>
        <option value="">Select Coupe</option>
        {coupes.map((c, index) => (
          <option key={index} value={c}>
            {c}
          </option>
        ))}
      </select>
    </div>
  );
};

export default MyCoups_dropdown;

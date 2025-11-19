import React, { useState, useEffect } from 'react';
import { Select, Row, Col, Spin, message } from 'antd';

const { Option } = Select;

const base_url = "http://localhost:5000";

const ForestHierarchyDropdowns = ({ language = 'en', onSelectionChange }) => {
  const [loading, setLoading] = useState(false);
  const [forestTypes, setForestTypes] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [ranges, setRanges] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [beats, setBeats] = useState([]);
  const [villages, setVillages] = useState([]);
  const [coupes, setCoupes] = useState([]);
  
  const [selectedValues, setSelectedValues] = useState({
    forest_id: null,
    division: null,
    range: null,
    round: null,
    beat: null,
    village: null,
    village_id: null,
    coupe: null
  });

  // Fetch forest types on component mount
  useEffect(() => {
    fetchForestTypes();
  }, []);

  const fetchForestTypes = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${base_url}/api/forest-types`);
      const data = await response.json();
      setForestTypes(data);
    } catch (error) {
      console.error('Error fetching forest types:', error);
      message.error('Failed to load forest types');
    } finally {
      setLoading(false);
    }
  };

  const fetchDivisions = async (forestId) => {
    if (!forestId) {
      setDivisions([]);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${base_url}/api/get-divisions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ forest_id: forestId }),
      });
      const data = await response.json();
      setDivisions(data);
    } catch (error) {
      console.error('Error fetching divisions:', error);
      message.error('Failed to load divisions');
    } finally {
      setLoading(false);
    }
  };

  const fetchRanges = async (forestId, divisionName) => {
    if (!forestId || !divisionName) {
      setRanges([]);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${base_url}/api/hierarchy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          forest_id: forestId, 
          division_name: divisionName 
        }),
      });
      const data = await response.json();
      
      // Extract unique ranges from the hierarchy data
      const uniqueRanges = Array.from(new Set(data
        .filter(item => item.RANGE)
        .map(item => item.RANGE)
      )).map(range => ({ RANGE: range }));
      
      setRanges(uniqueRanges);
    } catch (error) {
      console.error('Error fetching ranges:', error);
      message.error('Failed to load ranges');
    } finally {
      setLoading(false);
    }
  };

  const fetchRounds = async (forestId, rangeName) => {
    if (!forestId || !rangeName) {
      setRounds([]);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${base_url}/api/hierarchy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          forest_id: forestId, 
          division_name: selectedValues.division,
          range_name: rangeName 
        }),
      });
      const data = await response.json();
      
      // Extract unique rounds for the selected range
      const uniqueRounds = Array.from(new Set(data
        .filter(item => item.RANGE === rangeName && item.ROUND)
        .map(item => item.ROUND)
      )).map(round => ({ ROUND: round }));
      
      setRounds(uniqueRounds);
    } catch (error) {
      console.error('Error fetching rounds:', error);
      message.error('Failed to load rounds');
    } finally {
      setLoading(false);
    }
  };

  const fetchBeats = async (forestId, roundName) => {
    if (!forestId || !roundName) {
      setBeats([]);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${base_url}/api/hierarchy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          forest_id: forestId, 
          division_name: selectedValues.division,
          range_name: selectedValues.range,
          round_name: roundName
        }),
      });
      const data = await response.json();
      
      // Extract unique beats for the selected round
      const uniqueBeats = Array.from(new Set(data
        .filter(item => item.ROUND === roundName && item.BEAT)
        .map(item => item.BEAT)
      )).map(beat => ({ BEAT: beat }));
      
      setBeats(uniqueBeats);
    } catch (error) {
      console.error('Error fetching beats:', error);
      message.error('Failed to load beats');
    } finally {
      setLoading(false);
    }
  };

  const fetchVillages = async (forestId, beatName) => {
    if (!forestId || !beatName) {
      setVillages([]);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${base_url}/api/hierarchy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          forest_id: forestId, 
          division_name: selectedValues.division,
          range_name: selectedValues.range,
          round_name: selectedValues.round,
          beat_name: beatName
        }),
      });
      const data = await response.json();
      
      // FIXED: Remove duplicates based on village_id to handle duplicate village names
      const villageMap = new Map();
      data.forEach(item => {
        if (item.Village && item.Village_id) {
          // Use village_id as the key to ensure uniqueness
          if (!villageMap.has(item.Village_id)) {
            villageMap.set(item.Village_id, {
              village_id: item.Village_id,
              Village: item.Village,
              village_name: item.Village
            });
          }
        }
      });
      
      const uniqueVillages = Array.from(villageMap.values());
      setVillages(uniqueVillages);
    } catch (error) {
      console.error('Error fetching villages:', error);
      message.error('Failed to load villages');
    } finally {
      setLoading(false);
    }
  };

  const fetchCoupes = async (forestId, villageId) => {
    if (!forestId || !villageId) {
      setCoupes([]);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${base_url}/api/hierarchy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          forest_id: forestId, 
          division_name: selectedValues.division,
          range_name: selectedValues.range,
          round_name: selectedValues.round,
          beat_name: selectedValues.beat,
          village_id: villageId
        }),
      });
      const data = await response.json();
      
      // Extract unique coupes for the selected village
      const uniqueCoupes = Array.from(new Set(data
        .filter(item => item.Village_id === villageId && item.coupe_name)
        .map(item => ({
          coupe_name: item.coupe_name,
          coupe_code: item.coupe_code
        }))
      ));
      
      setCoupes(uniqueCoupes);
    } catch (error) {
      console.error('Error fetching coupes:', error);
      message.error('Failed to load coupes');
    } finally {
      setLoading(false);
    }
  };

  const handleForestChange = (forestId) => {
    const newValues = {
      forest_id: forestId,
      division: null,
      range: null,
      round: null,
      beat: null,
      village: null,
      village_id: null,
      coupe: null
    };
    
    setSelectedValues(newValues);
    setDivisions([]);
    setRanges([]);
    setRounds([]);
    setBeats([]);
    setVillages([]);
    setCoupes([]);
    
    fetchDivisions(forestId);
    onSelectionChange?.(newValues);
  };

  const handleDivisionChange = (divisionName) => {
    const newValues = {
      ...selectedValues,
      division: divisionName,
      range: null,
      round: null,
      beat: null,
      village: null,
      village_id: null,
      coupe: null
    };
    
    setSelectedValues(newValues);
    setRanges([]);
    setRounds([]);
    setBeats([]);
    setVillages([]);
    setCoupes([]);
    
    fetchRanges(selectedValues.forest_id, divisionName);
    onSelectionChange?.(newValues);
  };

  const handleRangeChange = (rangeName) => {
    const newValues = {
      ...selectedValues,
      range: rangeName,
      round: null,
      beat: null,
      village: null,
      village_id: null,
      coupe: null
    };
    
    setSelectedValues(newValues);
    setRounds([]);
    setBeats([]);
    setVillages([]);
    setCoupes([]);
    
    fetchRounds(selectedValues.forest_id, rangeName);
    onSelectionChange?.(newValues);
  };

  const handleRoundChange = (roundName) => {
    const newValues = {
      ...selectedValues,
      round: roundName,
      beat: null,
      village: null,
      village_id: null,
      coupe: null
    };
    
    setSelectedValues(newValues);
    setBeats([]);
    setVillages([]);
    setCoupes([]);
    
    fetchBeats(selectedValues.forest_id, roundName);
    onSelectionChange?.(newValues);
  };

  const handleBeatChange = (beatName) => {
    const newValues = {
      ...selectedValues,
      beat: beatName,
      village: null,
      village_id: null,
      coupe: null
    };
    
    setSelectedValues(newValues);
    setVillages([]);
    setCoupes([]);
    
    fetchVillages(selectedValues.forest_id, beatName);
    onSelectionChange?.(newValues);
  };

  const handleVillageChange = (villageId) => {
    if (!villageId || !villages || villages.length === 0) {
      const newValues = {
        ...selectedValues,
        village: null,
        village_id: null,
        coupe: null
      };
      setSelectedValues(newValues);
      setCoupes([]);
      onSelectionChange?.(newValues);
      return;
    }

    const selectedVillage = villages.find(v => v && v.village_id === villageId);
    
    if (!selectedVillage) {
      const newValues = {
        ...selectedValues,
        village: null,
        village_id: null,
        coupe: null
      };
      setSelectedValues(newValues);
      setCoupes([]);
      onSelectionChange?.(newValues);
      return;
    }

    const newValues = {
      ...selectedValues,
      village: selectedVillage.Village || selectedVillage.village_name,
      village_id: selectedVillage.village_id,
      coupe: null
    };
    
    setSelectedValues(newValues);
    setCoupes([]);
    
    fetchCoupes(selectedValues.forest_id, selectedVillage.village_id);
    onSelectionChange?.(newValues);
  };

  const handleCoupeChange = (coupeName) => {
    const newValues = {
      ...selectedValues,
      coupe: coupeName
    };
    
    setSelectedValues(newValues);
    onSelectionChange?.(newValues);
  };

  const dropdownStyle = {
    width: "100px",
    color: "#fff",
    border: "2.21px solid rgba(255, 255, 255, 0.23)",
    background: "rgba(255, 255, 255, 0.02)",
    boxShadow: "-10.261px -10.261px 5.13px -11.971px #B3B3B3 inset",
  };

  const selectProps = {
    style: dropdownStyle,
    loading: loading
  };

  return (
    <div style={{ padding: '10px', width: "80%" }}>
      <Spin spinning={loading}>
        <Row gutter={[14, 14]} align="right">
          {/* Forest Type */}
          <Col>
            <Select
              {...selectProps}
              placeholder={language === "gu" ? "વન પ્રકાર" : "Forest Type"}
              value={selectedValues.forest_id}
              onChange={handleForestChange}
            >
              {forestTypes.map(forest => (
                <Option key={forest.forest_id} value={forest.forest_id}>
                  {forest.forest_type}
                </Option>
              ))}
            </Select>
          </Col>

          {/* Division */}
          <Col>
            <Select
              {...selectProps}
              placeholder={language === "gu" ? "વિભાગ" : "Division"}
              value={selectedValues.division}
              onChange={handleDivisionChange}
              disabled={!selectedValues.forest_id}
            >
              {divisions.map(division => (
                <Option key={division.DIVISION} value={division.DIVISION}>
                  {division.DIVISION}
                </Option>
              ))}
            </Select>
          </Col>

          {/* Range */}
          <Col>
            <Select
              {...selectProps}
              placeholder={language === "gu" ? "રેન્જ" : "Range"}
              value={selectedValues.range}
              onChange={handleRangeChange}
              disabled={!selectedValues.division}
            >
              {ranges.map(range => (
                <Option key={range.RANGE} value={range.RANGE}>
                  {range.RANGE}
                </Option>
              ))}
            </Select>
          </Col>

          {/* Round */}
          <Col>
            <Select
              {...selectProps}
              placeholder={language === "gu" ? "રાઉન્ડ" : "Round"}
              value={selectedValues.round}
              onChange={handleRoundChange}
              disabled={!selectedValues.range}
            >
              {rounds.map(round => (
                <Option key={round.ROUND} value={round.ROUND}>
                  {round.ROUND}
                </Option>
              ))}
            </Select>
          </Col>

          {/* Beat */}
          <Col>
            <Select
              {...selectProps}
              placeholder={language === "gu" ? "બીટ" : "Beat"}
              value={selectedValues.beat}
              onChange={handleBeatChange}
              disabled={!selectedValues.round}
            >
              {beats.map(beat => (
                <Option key={beat.BEAT} value={beat.BEAT}>
                  {beat.BEAT}
                </Option>
              ))}
            </Select>
          </Col>

          {/* Village */}
          <Col>
            <Select
              {...selectProps}
              placeholder={language === "gu" ? "ગામ" : "Village"}
              value={selectedValues.village_id}
              onChange={handleVillageChange}
              disabled={!selectedValues.beat}
            >
              {villages.map(village => (
                <Option key={village.village_id} value={village.village_id}>
                  {village.Village || village.village_name}
                </Option>
              ))}
            </Select>
          </Col>

          {/* Coupe */}
          <Col>
            <Select
              {...selectProps}
              placeholder={language === "gu" ? "કૂપ" : "Coupe"}
              value={selectedValues.coupe}
              onChange={handleCoupeChange}
              disabled={!selectedValues.village_id}
            >
              {coupes.map(coupe => (
                <Option key={coupe.coupe_name} value={coupe.coupe_name}>
                  {coupe.coupe_name}
                </Option>
              ))}
            </Select>
          </Col>
        </Row>
      </Spin>
    </div>
  );
};

export default ForestHierarchyDropdowns;
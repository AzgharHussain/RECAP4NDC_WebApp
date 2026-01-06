import React, { useState, useEffect } from 'react';
import { Select, Row, Col, Spin, message } from 'antd';
import { API_BASE_URL } from '../config';

const { Option } = Select;

const base_url = API_BASE_URL;



const ForestHierarchyDropdowns = ({ language = 'en', onSelectionChange,setSelectedCoupe }) => {
  const [loading, setLoading] = useState({
    forest: false,
    division: false,
    range: false,
    round: false,
    beat: false,
    village: false,
    coupe: false
  });
  
  const [forestTypes, setForestTypes] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [ranges, setRanges] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [beats, setBeats] = useState([]);
  const [villages, setVillages] = useState([]);
  const [coupes, setCoupes] = useState([]);
  
  // Store all hierarchy data for client-side filtering
  const [hierarchyData, setHierarchyData] = useState([]);
  
  const [selectedValues, setSelectedValues] = useState({
    forest_id: null,
    division: null,
    range: null,
    round: null,
    beat: null,
    village: null,
    coupe: null
  });

  // Fetch forest types on component mount
  useEffect(() => {
    const fetchForestTypes = async () => {
      try {
        setLoading(prev => ({ ...prev, forest: true }));
        const response = await fetch(`${base_url}/api/forest-types`);
        const data = await response.json();
        console.log("Forest types data:", data);
        setForestTypes(data);
      } catch (error) {
        console.error('Error fetching forest types:', error);
        message.error('Failed to load forest types');
      } finally {
        setLoading(prev => ({ ...prev, forest: false }));
      }
    };
    
    fetchForestTypes();
  }, []);


  

  // Handle Forest Selection
  const handleForestChange = async (forestId) => {
    const newValues = {
      forest_id: forestId,
      division: null,
      range: null,
      round: null,
      beat: null,
      village: null,
      coupe: null
    };
    
    setSelectedValues(newValues);
    setDivisions([]);
    setRanges([]);
    setRounds([]);
    setBeats([]);
    setVillages([]);
    setCoupes([]);
    setHierarchyData([]);
    
    if (!forestId) {
      onSelectionChange?.(newValues);
      return;
    }
    
    try {
      setLoading(prev => ({ ...prev, division: true }));
      const response = await fetch(`${base_url}/api/get-divisions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ forest_id: forestId }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("Divisions data:", data);
      
      // Assuming the API returns an array of objects with DIVISION field
      if (Array.isArray(data)) {
        // Extract unique divisions
        const uniqueDivisions = [...new Set(data
          .filter(item => item.DIVISION)
          .map(item => item.DIVISION)
        )];
        
        setDivisions(uniqueDivisions.map(division => ({
          value: division,
          label: division
        })));
      } else {
        console.error("Unexpected divisions response format:", data);
        message.error("Unexpected data format from server");
        setDivisions([]);
      }
      
      onSelectionChange?.(newValues);
    } catch (error) {
      console.error('Error fetching divisions:', error);
      message.error('Failed to load divisions');
      setDivisions([]);
    } finally {
      setLoading(prev => ({ ...prev, division: false }));
    }
  };

  // Handle Division Selection
  const handleDivisionChange = async (divisionName) => {
    const newValues = {
      ...selectedValues,
      division: divisionName,
      range: null,
      round: null,
      beat: null,
      village: null,
      coupe: null
    };
    
    setSelectedValues(newValues);
    setRanges([]);
    setRounds([]);
    setBeats([]);
    setVillages([]);
    setCoupes([]);
    
    if (!divisionName || !selectedValues.forest_id) {
      onSelectionChange?.(newValues);
      return;
    }
    
    try {
      setLoading(prev => ({ ...prev, range: true, round: true }));
      const response = await fetch(`${base_url}/api/hierarchy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          forest_id: selectedValues.forest_id,
          division_name: divisionName
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("Hierarchy data for division:", data);
      
      // Store the hierarchy data for this division
      setHierarchyData(data);
      
      // Extract unique ranges from the hierarchy data
      const divisionRanges = data
        .filter(item => item.RANGE)
        .map(item => item.RANGE);
      
      const uniqueRanges = [...new Set(divisionRanges)];
      setRanges(uniqueRanges.map(range => ({
        value: range,
        label: range
      })));
      
      // Extract unique rounds from the hierarchy data
      const divisionRounds = data
        .filter(item => item.ROUND)
        .map(item => item.ROUND);
      
      const uniqueRounds = [...new Set(divisionRounds)];
      setRounds(uniqueRounds.map(round => ({
        value: round,
        label: round
      })));
      
      onSelectionChange?.(newValues);
    } catch (error) {
      console.error('Error fetching division hierarchy:', error);
      message.error('Failed to load division hierarchy');
      setRanges([]);
      setRounds([]);
    } finally {
      setLoading(prev => ({ ...prev, range: false, round: false }));
    }
  };

  // Handle Range Selection
  const handleRangeChange = (rangeName) => {
    const newValues = {
      ...selectedValues,
      range: rangeName,
      round: null,
      beat: null,
      village: null,
      coupe: null
    };
    
    setSelectedValues(newValues);
    setRounds([]);
    setBeats([]);
    setVillages([]);
    setCoupes([]);
    
    if (!rangeName || !selectedValues.division) {
      onSelectionChange?.(newValues);
      return;
    }
    
    try {
      // Filter data for the selected division and range
      const filteredData = hierarchyData.filter(item => 
        item.DIVISION === selectedValues.division && 
        item.RANGE === rangeName
      );
      
      // Extract unique rounds for this specific range
      const rangeRounds = filteredData
        .filter(item => item.ROUND)
        .map(item => item.ROUND);
      
      const uniqueRounds = [...new Set(rangeRounds)];
      setRounds(uniqueRounds.map(round => ({
        value: round,
        label: round
      })));
      
      // Extract unique beats for this specific range
      const rangeBeats = filteredData
        .filter(item => item.BEAT)
        .map(item => item.BEAT);
      
      const uniqueBeats = [...new Set(rangeBeats)];
      setBeats(uniqueBeats.map(beat => ({
        value: beat,
        label: beat
      })));
      
      onSelectionChange?.(newValues);
    } catch (error) {
      console.error('Error filtering range data:', error);
      message.error('Failed to load range data');
    }
  };

  // Handle Round Selection
  const handleRoundChange = (roundName) => {
    const newValues = {
      ...selectedValues,
      round: roundName,
      beat: null,
      village: null,
      coupe: null
    };
    
    setSelectedValues(newValues);
    setBeats([]);
    setVillages([]);
    setCoupes([]);
    
    if (!roundName || !selectedValues.division || !selectedValues.range) {
      onSelectionChange?.(newValues);
      return;
    }
    
    try {
      // Filter data for the selected division, range, and round
      const filteredData = hierarchyData.filter(item => 
        item.DIVISION === selectedValues.division && 
        item.RANGE === selectedValues.range &&
        item.ROUND === roundName
      );
      
      // Extract unique beats for this specific round
      const roundBeats = filteredData
        .filter(item => item.BEAT)
        .map(item => item.BEAT);
      
      const uniqueBeats = [...new Set(roundBeats)];
      setBeats(uniqueBeats.map(beat => ({
        value: beat,
        label: beat
      })));
      
      // Extract unique villages for this round
      const roundVillages = filteredData
        .filter(item => item.Village);
      
      // Remove duplicate village names
      const uniqueVillages = [...new Set(roundVillages
        .map(item => item.Village)
        .filter(Boolean)
      )].map(village => ({
        value: village,
        label: village
      }));
      
      setVillages(uniqueVillages);
      
      onSelectionChange?.(newValues);
    } catch (error) {
      console.error('Error filtering round data:', error);
      message.error('Failed to load round data');
    }
  };

  // Handle Beat Selection
  const handleBeatChange = (beatName) => {
    const newValues = {
      ...selectedValues,
      beat: beatName,
      village: null,
      coupe: null
    };
    
    setSelectedValues(newValues);
    setVillages([]);
    setCoupes([]);
    
    if (!beatName || !selectedValues.division || !selectedValues.range || !selectedValues.round) {
      onSelectionChange?.(newValues);
      return;
    }
    
    try {
      // Filter data for the selected division, range, round, and beat
      const filteredData = hierarchyData.filter(item => 
        item.DIVISION === selectedValues.division && 
        item.RANGE === selectedValues.range &&
        item.ROUND === selectedValues.round &&
        item.BEAT === beatName
      );
      
      // Extract unique villages for this beat
      const beatVillages = filteredData
        .filter(item => item.Village);
      
      // Remove duplicate village names
      const uniqueVillages = [...new Set(beatVillages
        .map(item => item.Village)
        .filter(Boolean)
      )].map(village => ({
        value: village,
        label: village
      }));
      
      setVillages(uniqueVillages);
      
      onSelectionChange?.(newValues);
    } catch (error) {
      console.error('Error filtering beat data:', error);
      message.error('Failed to load beat data');
    }
  };

  // Handle Village Selection
  const handleVillageChange = (villageName) => {
    if (!villageName || !villages || villages.length === 0) {
      const newValues = {
        ...selectedValues,
        village: null,
        coupe: null
      };
      setSelectedValues(newValues);
      setCoupes([]);
      onSelectionChange?.(newValues);
      return;
    }

    const selectedVillage = villages.find(v => v && v.value === villageName);
    
    if (!selectedVillage) {
      const newValues = {
        ...selectedValues,
        village: null,
        coupe: null
      };
      setSelectedValues(newValues);
      setCoupes([]);
      onSelectionChange?.(newValues);
      return;
    }

    const newValues = {
      ...selectedValues,
      village: villageName,
      coupe: null
    };
    
    setSelectedValues(newValues);
    setCoupes([]);
    
    // Filter coupes for the selected village
    if (hierarchyData.length > 0) {
      const villageCoupes = hierarchyData.filter(item => 
        item.DIVISION === selectedValues.division && 
        item.RANGE === selectedValues.range &&
        item.ROUND === selectedValues.round &&
        item.BEAT === selectedValues.beat &&
        item.Village === villageName &&
        item.coupe_name
      );
      
      // Extract unique coupes
      const uniqueCoupes = [...new Set(villageCoupes
        .map(item => item.coupe_name)
        .filter(Boolean)
      )].map(coupeName => ({
        value: coupeName,
        label: coupeName
      }));
      
      setCoupes(uniqueCoupes);
    }
    
    onSelectionChange?.(newValues);
  };

const handleCoupeChange = (coupeName) => {
  const newValues = {
    ...selectedValues,
    coupe: coupeName
  };
  
  // Update local state
  setSelectedValues(newValues);
  
  // Update parent's selectedCoupe state
  if (setSelectedCoupe) {
    setSelectedCoupe(coupeName);
  }
  
  // Call the callback with all values
  onSelectionChange?.(newValues);
};

  const dropdownStyle = {
    // width: "100px",
    minWidth: "150px",
    color: "#fff",
    // border: "2.21px solid rgba(255, 255, 255, 0.23)",
    background: "rgba(255, 255, 255, 0.02)",
    boxShadow: "-10.261px -10.261px 5.13px -11.971px #B3B3B3 inset",
  };

  const selectProps = {
    style: dropdownStyle,
    loading: loading.forest || loading.division || loading.range || loading.round || loading.beat || loading.village || loading.coupe
  };

  return (
    <div style={{ padding: '20px', width: "80%" }}>
      <Spin spinning={selectProps.loading}>
        <Row align="space-between">
          {/* Forest Type */}
          <Col>
            <Select
              {...selectProps}
              placeholder={language === "gu" ? "વન પ્રકાર" : "Forest Type"}
              value={selectedValues.forest_id}
              onChange={handleForestChange}
              dropdownStyle={{
              background: "#fff",
              borderRadius: "0px",
            }}
            dropdownRender={(menu) => (
              <div style={{ background: "#fff" }}>
                {menu}
              </div>
            )}
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
              dropdownStyle={{
              background: "#fff",
              borderRadius: "0px",

            }}
            dropdownRender={(menu) => (
              <div style={{ background: "#fff" }}>
                {menu}
              </div>
            )}
            >
              {divisions.map(division => (
                <Option key={division.value} value={division.value}>
                  {division.label}
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
              dropdownStyle={{
              background: "#fff",
              borderRadius: "0px",

            }}
            dropdownRender={(menu) => (
              <div style={{ background: "#fff" }}>
                {menu}
              </div>
            )}
            >
              {ranges.map(range => (
                <Option key={range.value} value={range.value}>
                  {range.label}
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
              dropdownStyle={{
              background: "#fff",
              borderRadius: "0px",
            }}
            dropdownRender={(menu) => (
              <div style={{ background: "#fff" }}>
                {menu}
              </div>
            )}
            >
              {rounds.map(round => (
                <Option key={round.value} value={round.value}>
                  {round.label}
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
              dropdownStyle={{
              background: "#fff",
              borderRadius: "0px",
            }}
            dropdownRender={(menu) => (
              <div style={{ background: "#fff" }}>
                {menu}
              </div>
            )}
            >
              {beats.map(beat => (
                <Option key={beat.value} value={beat.value}>
                  {beat.label}
                </Option>
              ))}
            </Select>
          </Col>

          {/* Village */}
          <Col>
            <Select
              {...selectProps}
              placeholder={language === "gu" ? "ગામ" : "Village"}
              value={selectedValues.village}
              onChange={handleVillageChange}
              disabled={!selectedValues.beat}
              dropdownStyle={{
              background: "#fff",
              borderRadius: "0px",
            }}
            dropdownRender={(menu) => (
              <div style={{ background: "#fff" }}>
                {menu}
              </div>
            )}
            >
              {villages.map(village => (
                <Option key={village.value} value={village.value}>
                  {village.label}
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
              disabled={!selectedValues.village}
              dropdownStyle={{
              background: "#fff",
              borderRadius: "0px",
            }}
            dropdownRender={(menu) => (
              <div style={{ background: "#fff" }}>
                {menu}
              </div>
            )}
            >
              {coupes.map(coupe => (
                <Option key={coupe.value} value={coupe.value}>
                  {coupe.label}
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
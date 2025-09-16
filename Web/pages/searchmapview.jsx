import React, { useState, useEffect } from 'react';
import { notification } from 'antd';
// import { BASE_URL } from '../config';
import './search.css';

const LocationSelector = ({ mapRef, village_id, setvillage_id }) => {
  const [selectedState, setSelectedState] = useState(null);
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [states, setStates] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [isLoading, setIsLoading] = useState({
    states: false,
    districts: false,
    villages: false
  });
  const [villages, setVillages] = useState([]);
  const [selectvillageisclicked, setselectvillageisclicked] = useState(false);
  const [villageSearch, setVillageSearch] = useState("");

  useEffect(() => {
    const fetchStates = async () => {
      setIsLoading(prev => ({ ...prev, states: true }));
      try {
        const response = await fetch(`${BASE_URL}/api/states`);
        if (!response.ok) throw new Error('Failed to fetch states');

        const data = await response.json();
        setStates(data.map(state => ({
          value: state.STANA2011,
          label: state.STANA2011
        })));
      } catch (error) {
        console.error('Error fetching states:', error);
        notification.error({
          message: 'Failed to fetch states',
          description: 'There was an error fetching the list of states.',
        });
      } finally {
        setIsLoading(prev => ({ ...prev, states: false }));
      }
    };
    fetchStates();
  }, []);

  useEffect(() => {
    if (selectedState) {
      const fetchDistricts = async () => {
        setIsLoading(prev => ({ ...prev, districts: true }));
        try {
          const response = await fetch(
            `${BASE_URL}/api/districts?state=${encodeURIComponent(selectedState.value)}`
          );
          if (!response.ok) throw new Error('Failed to fetch districts');

          const data = await response.json();
          setDistricts(data.map(district => ({
            value: district.DISTNA2011,
            label: district.DISTNA2011
          })));
          setSelectedDistrict(null);
          setVillages([]);

          zoomToLocation(`${selectedState.label}, India`, 8);
        } catch (error) {
          console.error('Error fetching districts:', error);
          notification.error({
            message: 'Failed to fetch districts',
            description: 'There was an error fetching the list of districts.',
          });
        } finally {
          setIsLoading(prev => ({ ...prev, districts: false }));
        }
      };
      fetchDistricts();
    } else {
      setDistricts([]);
      setVillages([]);
    }
  }, [selectedState]);

  useEffect(() => {
    if (selectedState && selectedDistrict) {
      const fetchVillages = async () => {
        setIsLoading(prev => ({ ...prev, villages: true }));
        try {
          const response = await fetch(
            `${BASE_URL}/api/villages?state=${encodeURIComponent(selectedState.value)}&district=${encodeURIComponent(selectedDistrict.value)}`
          );
          if (!response.ok) throw new Error('Failed to fetch villages');

          const data = await response.json();

          const villagesMap = new Map();

          data.forEach(village => {
            if (!villagesMap.has(village.villageid)) {
              villagesMap.set(village.villageid, {
                value: village.villageid,
                label: village.villna2011 || 'Unnamed Village'
              });
            }
          });

          const uniqueVillages = Array.from(villagesMap.values()).sort((a, b) => {
            return (a.label || '').localeCompare(b.label || '');
          });
          setVillages(uniqueVillages);

          zoomToLocation(`${selectedDistrict.label}, ${selectedState.label}, India`, 9);
        } catch (error) {
          console.error('Error fetching villages:', error);
          notification.error({
            message: 'Failed to fetch villages',
            description: 'There was an error fetching the list of villages.',
          });
        } finally {
          setIsLoading(prev => ({ ...prev, villages: false }));
        }
      };
      fetchVillages();
    } else {
      setVillages([]);
    }
  }, [selectedDistrict, selectedState]);

  const zoomToLocation = async (locationName, zoomLevel) => {
    if (!locationName || !mapRef?.current) return;

    // Handle special cases
    if (locationName === "Haryana, India") {
      locationName = "Rewari";
    } else if (locationName === "Mahesana, Gujarat, India") {
      locationName = "satlasana";
    } else if (locationName === "Delhi") {
      locationName = "new delhi";
    } else if (locationName === "Gujarat, India") {
      locationName = "poshira taluka";
    }

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationName)}&countrycodes=in&limit=1`
      );
      const data = await response.json();
      if (data.length > 0) {
        const { lat, lon } = data[0];
        mapRef.current.flyTo([lat, lon], zoomLevel);
      }
    } catch (error) {
      console.error('Geocoding error:', error);
    }
  };

  const handleStateChange = (e) => {
    const selectedOption = e.target.value ? JSON.parse(e.target.value) : null;
    setSelectedState(selectedOption);
    setSelectedDistrict(null);
    setVillages([]);
    setselectvillageisclicked(false);

    if (selectedOption) {
      zoomToLocation(`${selectedOption.label}, India`, 8);
    }
  };

  const handleDistrictChange = (e) => {
    const selectedOption = e.target.value ? JSON.parse(e.target.value) : null;
    setSelectedDistrict(selectedOption);
    setVillages([]);
    setselectvillageisclicked(false);

    if (selectedOption && selectedState) {
      zoomToLocation(`${selectedOption.label}, ${selectedState.label}, India`, 9);
    }
  };

  const handleCheckboxChange = (villageObj) => {
    const found = village_id.find(v => v.value === villageObj.value);

    if (found) {
      setvillage_id(village_id.filter(v => v.value !== villageObj.value));
    } else {
      const villageWithLocation = {
        ...villageObj,
        state: selectedState,
        district: selectedDistrict
      };
      setvillage_id([...village_id, villageWithLocation]);
    }
  };

  const filteredVillages = villages.filter(v =>
    v.label.toLowerCase().includes(villageSearch.toLowerCase())
  );

  return (
    <div className="search-container2">
      <div className="search-controls">
        
        <div className='search-select-containers'>
          <select
            className="search-select"
            value={selectedState ? JSON.stringify(selectedState) : ''}
            onChange={handleStateChange}
            disabled={isLoading.states}
          >
            <option value="">State</option>
            {states.map(state => (
              <option key={state.value} value={JSON.stringify(state)}>
                {state.label}
              </option>
            ))}
          </select>
          
          <select
            className="search-select-District"
            value={selectedDistrict ? JSON.stringify(selectedDistrict) : ''}
            onChange={handleDistrictChange}
            disabled={!selectedState || isLoading.districts}
          >
            <option value="">District</option>
            {districts.map(district => (
              <option key={district.value} value={JSON.stringify(district)}>
                {district.label}
              </option>
            ))}
          </select>

          <div style={{ display: 'flex', alignItems: 'center', flexDirection: "column" }}>
            <button 
              className="search-select-villages"  
              onClick={() => setselectvillageisclicked(!selectvillageisclicked)}
              disabled={!selectedDistrict || isLoading.villages}
            >
              Village
            </button>

            {selectvillageisclicked && (
              <div style={{
                maxHeight: '280px',
                overflowY: "auto",
                background: "#fafcff",
                border: '1px solid #d1e4e8',
                padding: 4,
                borderRadius: 2,
                boxShadow: "0 2px 6px 0 rgba(20,40,90,.06)",
                width: "140px",
                overflowX: "hidden",
                wordBreak: "break-word",
                whiteSpace: "normal",
                display: "flex",
                flexDirection: "column"
              }}>
                <input
                  type="text"
                  placeholder="Search villages..."
                  value={villageSearch}
                  onChange={e => setVillageSearch(e.target.value)}
                  style={{
                    margin: "5px 0",
                    padding: "4px 5px",
                    borderRadius: 6,
                    border: "1px solid #c6e2fa",
                    fontSize: 12,
                    outline: "none",
                    background: "#fff"
                  }}
                />
                <ul style={{
                  listStyle: 'none',
                  margin: 0,
                  padding: 0,
                  maxHeight: 160,
                }}>
                  {filteredVillages.length === 0 ? (
                    <li style={{ color: "#777", padding: "6px 0", textAlign: "center" }}>No villages found</li>
                  ) : filteredVillages.map(v => (
                    <li 
                      key={v.value} 
                      style={{
                        marginBottom: 8,
                        background: village_id.some(sel => sel.value === v.value) ? "#e6f2ff" : "transparent",
                        borderRadius: 5,
                        padding: "1px 3px",
                        transition: "background 0.2s"
                      }}  
                      className="search-select-villages2"
                    >
                      <label style={{ display: "flex", alignItems: "center", fontWeight: 500, cursor: "pointer", fontSize: "0.88rem" }}>
                        <input
                          type="checkbox"
                          checked={village_id.some(selected => selected.value === v.value)}
                          onChange={() => handleCheckboxChange(v)}
                          style={{ marginRight: 8, width: 10, height: 10, accentColor: "#155a8a" }}
                        />
                        {v.label}
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LocationSelector;
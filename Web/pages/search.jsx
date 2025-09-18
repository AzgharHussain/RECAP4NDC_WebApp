import React, { useState, useEffect } from 'react';
import { notification } from 'antd';
import { BASE_URL } from "../config";
import './search.css';

const LocationSelector = ({ mapRef }) => {
  const [selectedState, setSelectedState] = useState(null);
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [selectedVillage, setSelectedVillage] = useState(null);
  const [states, setStates] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [isLoading, setIsLoading] = useState({
    states: false,
    districts: false,
    villages: false
  });
  const [villages, setVillages] = useState([]);
  const [villageSearch, setVillageSearch] = useState("");

  const fetchCentroid = async (type, name) => {
    try {
      const options= {
        method: 'POST',
        headers: {  
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ [type]: name })

      }
      console.log('Fetching centroid for:', type, name);
      const response = await fetch(`${BASE_URL}/api/centroid/${type}`, options);

      if (!response.ok) throw new Error(`Failed to fetch ${type} centroid`);
      return await response.json();
    } catch (error) {
      console.error(`Error fetching ${type} centroid:`, error);
      return null;
    }
  };

  const zoomToLocation = async (type, name, zoomLevel) => {
    if (!name || !mapRef?.current) return;

    const centroid = await fetchCentroid(type, name);
    if (centroid && centroid.longitude && centroid.latitude) {
      mapRef.current.flyTo([centroid.latitude, centroid.longitude], zoomLevel);
    } else {
      // Fallback to Nominatim if centroid not found
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(name)}&countrycodes=in&limit=1`
        );
        const data = await response.json();
        if (data.length > 0) {
          const { lat, lon } = data[0];
          mapRef.current.flyTo([lat, lon], zoomLevel);
        }
      } catch (error) {
        console.error('Geocoding error:', error);
      }
    }
  };

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
          setSelectedVillage(null);
          setVillages([]);
          zoomToLocation('state', selectedState.value, 8);
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
      setSelectedVillage(null);
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
                label: village.villna2011 || 'Unnamed Village',
                lat: village.latitude,
                lon: village.longitude
              });
            }
          });
          const uniqueVillages = Array.from(villagesMap.values()).sort((a, b) => {
            return (a.label || '').localeCompare(b.label || '');
          });
          setVillages(uniqueVillages);
          zoomToLocation('district', selectedDistrict.value, 9);
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
      setSelectedVillage(null);
      setVillages([]);
    }
  }, [selectedDistrict, selectedState]);

  const handleStateChange = (e) => {
    const selectedOption = e.target.value ? JSON.parse(e.target.value) : null;
    setSelectedState(selectedOption);
    setSelectedDistrict(null);
    setSelectedVillage(null);
    setVillages([]);
    if (selectedOption) {
      zoomToLocation('state', selectedOption.value, 8);
    }
  };

  const handleDistrictChange = (e) => {
    const selectedOption = e.target.value ? JSON.parse(e.target.value) : null;
    setSelectedDistrict(selectedOption);
    setSelectedVillage(null);
    setVillages([]);
    if (selectedOption && selectedState) {
      zoomToLocation('district', selectedOption.value, 9);
    }
  };

  const handleVillageChange = (e) => {
    const selectedOption = e.target.value ? JSON.parse(e.target.value) : null;
    setSelectedVillage(selectedOption);

    if (selectedOption) {
      if (selectedOption.lat && selectedOption.lon) {
        mapRef.current.flyTo([selectedOption.lat, selectedOption.lon], 16);
      } else {
        zoomToLocation('village', selectedOption.label, 16);
      }
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
          <div style={{ position: 'relative' }}>
            <select
              className="search-select-villages"
              value={selectedVillage ? JSON.stringify(selectedVillage) : ''}
              onChange={handleVillageChange}
              disabled={!selectedDistrict || isLoading.villages}
            >
              <option value="">Village</option>
              {filteredVillages.map(village => (
                <option key={village.value} value={JSON.stringify(village)}>
                  {village.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LocationSelector;

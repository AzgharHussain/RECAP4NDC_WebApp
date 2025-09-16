import React, { useState, useEffect } from 'react';
import L from 'leaflet';

const SearchControlWithInput = ({ mapRef }) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);

  const fetchSuggestions = async (input) => {
    if (!input) {
      setSuggestions([]);
      return;
    }

    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(input)}&limit=3&countrycodes=IN`);
      const data = await res.json();
      setSuggestions(data);
    } catch (err) {
      console.error('Suggestion fetch error:', err);
      setSuggestions([]);
    }
  };

  const handleSearch = async (place) => {
    const searchQuery = place || query;
    if (!searchQuery || !mapRef.current) return;

    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1&countrycodes=IN`);
      const data = await res.json();

      if (data.length > 0) {
        const { lat, lon } = data[0];
        const center = L.latLng(lat, lon);
        mapRef.current.setView(center, 14);
        setSuggestions([]);
      } else {
        alert('Location not found!');
      }
    } catch (err) {
      console.error('Search failed:', err);
    }
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchSuggestions(query);
    }, 300); // debounce input
    return () => clearTimeout(timeout);
  }, [query]);

  return (
    <div style={{
      position: 'absolute',
      top: '0.5%',
      left: '30.5%',
      zIndex: 1000,
      backgroundColor: '#fff',
      padding: '5px',
      borderRadius: '5px',
      width: '150px',
      boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
    }}>
      <input
        type="text"
        placeholder="Search for a place..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{
          width: '100%',
          padding: '4px',
          borderRadius: '3px',
          border: '1px solid #0B3C4D',
          outline: 'none',
          fontSize:'10px',
          marginBottom: '2px'
        }}
      />
    
      {suggestions.length > 0 && (
        <ul style={{
          listStyle: 'none',
          padding: 0,
          marginTop: '5px',
          maxHeight: '100px',
          overflowY: 'auto',
          border: '1px solid #ddd',
          borderRadius: '6px',
           fontSize:'8px',
        }}>
          {suggestions.map((s, i) => (
            <li
              key={i}
              onClick={() => handleSearch(`${s.display_name}`)}
              style={{
                padding: '4px',
                cursor: 'pointer',
                backgroundColor: '#ee8f8fff',
                borderBottom: '1px solid #eee',
                 fontSize:'8px',
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#b3edb3ff'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#f1adadff'}
            >
              {s.display_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default SearchControlWithInput;

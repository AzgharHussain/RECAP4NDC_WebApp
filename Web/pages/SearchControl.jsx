import React, { useState, useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

const SearchControlWithInput = () => {
  const map = useMap();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);

  const fetchSuggestions = async (input) => {
    if (!input) {
      setSuggestions([]);
      return;
    }

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          input
        )}&limit=3&countrycodes=IN`
      );
      const data = await res.json();
      setSuggestions(data);
    } catch (err) {
      console.error("Suggestion fetch error:", err);
      setSuggestions([]);
    }
  };

  const handleSearch = async (place) => {
    const searchQuery = place || query;
    if (!searchQuery || !map) return;

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchQuery
        )}&limit=1&countrycodes=IN`
      );
      const data = await res.json();

      if (data.length > 0) {
        const { lat, lon, display_name } = data[0];
        const center = L.latLng(parseFloat(lat), parseFloat(lon));

        map.flyTo(center, 14, { animate: true, duration: 1.5 });

        L.marker(center)
          .addTo(map)
          .bindPopup(`<b>${display_name}</b>`)
          .openPopup();

        setSuggestions([]);
        setQuery("");
      } else {
        alert("Location not found!");
      }
    } catch (err) {
      console.error("Search failed:", err);
    }
  };

  useEffect(() => {
    const timeout = setTimeout(() => fetchSuggestions(query), 300);
    return () => clearTimeout(timeout);
  }, [query]);

  return (
    <div
      style={{
        position: "absolute",
        top: "10px",
        left: "5%",
        zIndex: 1000,
        backgroundColor: "#fff",
       
        borderRadius: "5px",
        width: "200px",
        boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
      }}
    >
      <input
        type="text"
        placeholder="Search for a place..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        style={{
          width: "100%",
          padding: "4px",
          borderRadius: "3px",
          border: "1px solid #0B3C4D",
          outline: "none",
          fontSize: "10px",
          
        }}
      />

      {suggestions.length > 0 && (
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            marginTop: "5px",
            maxHeight: "100px",
            overflowY: "auto",
            border: "1px solid #ddd",
            borderRadius: "6px",
            fontSize: "9px",
          }}
        >
          {suggestions.map((s, i) => (
            <li
              key={i}
              onClick={() => handleSearch(s.display_name)}
              style={{
                padding: "4px",
                cursor: "pointer",
                backgroundColor: "#f9f9f9",
                borderBottom: "1px solid #eee",
              }}
              onMouseOver={(e) =>
                (e.currentTarget.style.backgroundColor = "#e6ffe6")
              }
              onMouseOut={(e) =>
                (e.currentTarget.style.backgroundColor = "#f9f9f9")
              }
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

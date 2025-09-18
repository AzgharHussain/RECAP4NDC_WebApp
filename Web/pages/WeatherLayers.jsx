import React, { useState, useEffect, useCallback, useMemo } from "react";
import L from "leaflet";
import "leaflet-openweathermap";
import "./WeatherLayers.css";
import { FaCloudSun } from 'react-icons/fa';

const OWM_API_KEY = "d890cedbd5c4db6842f9ccd44993cd05";

// Memoize the weather layers configuration to prevent unnecessary re-renders
const WEATHER_LAYERS_CONFIG = [
  { Name: "clouds", Label: "Clouds" },
  { Name: "temp", Label: "Temperature" },
  { Name: "wind", Label: "Wind" },
  { Name: "airquality", Label: "Air Quality Stations" },
];

// Memoize pollutant data to prevent recreation on every render
const POLLUTANTS = [
  { key: "co", name: "Carbon Monoxide", symbol: "CO", unit: "μg/m³" },
  { key: "no", name: "Nitrogen Monoxide", symbol: "NO", unit: "μg/m³" },
  { key: "no2", name: "Nitrogen Dioxide", symbol: "NO₂", unit: "μg/m³" },
  { key: "o3", name: "Ozone", symbol: "O₃", unit: "μg/m³" },
  { key: "so2", name: "Sulphur Dioxide", symbol: "SO₂", unit: "μg/m³" },
  { key: "pm2_5", name: "Fine Particulate Matter", symbol: "PM2.5", unit: "μg/m³" },
  { key: "pm10", name: "Coarse Particulate Matter", symbol: "PM10", unit: "μg/m³" },
  { key: "nh3", name: "Ammonia", symbol: "NH₃", unit: "μg/m³" },
];

const WeatherLayers = ({ mapRef }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [addedLayers, setAddedLayers] = useState({});
  const [layers, setLayers] = useState({});
  const [selectedStation, setSelectedStation] = useState(null);
  const [weatherData, setWeatherData] = useState(null);
  const [activeLayer, setActiveLayer] = useState(null);
  const [loadingAQI, setLoadingAQI] = useState(false);

  // Memoize the toggle function to prevent unnecessary re-renders of child components
  const toggleGroup = useCallback(() => setIsOpen(prev => !prev), []);

  // Optimized layer toggling with proper cleanup
  const toggleLayer = useCallback((layerName) => {
    const map = mapRef.current;
    const layer = layers[layerName];
    if (!map || !layer) return;

    setAddedLayers(prev => {
      const isActive = prev[layerName];
      
      if (isActive) {
        if (map.hasLayer(layer)) {
          map.removeLayer(layer);
        }
        setActiveLayer(null);
      } else {
        // Remove any existing active layer first
        if (activeLayer && layers[activeLayer] && map.hasLayer(layers[activeLayer])) {
          map.removeLayer(layers[activeLayer]);
        }
        layer.addTo(map);
        setActiveLayer(layerName);
      }

      return {
        ...prev,
        [layerName]: !isActive,
        ...(activeLayer && activeLayer !== layerName ? { [activeLayer]: false } : {}),
      };
    });
  }, [mapRef, layers, activeLayer]);

  // Memoize the AQI level calculation
  const getAQILevel = useCallback((aqi) => {
    if (!aqi) return { label: "No data", color: "#777" };
    if (aqi <= 1) return { label: "Good", color: "#009900" };
    if (aqi <= 2) return { label: "Fair", color: "#bfa800" };
    if (aqi <= 3) return { label: "Moderate", color: "#e67300" };
    if (aqi <= 4) return { label: "Poor", color: "#cc0000" };
    return { label: "Very Poor", color: "#800040" };
  }, []);

  // Memoize the pollutant table rendering
  const renderPollutants = useCallback((components) => {
    return (
      <div className="pollutant-table">
        <table>
          <thead>
            <tr>
              <th>Pollutant</th>
              <th>Symbol</th>
              <th>Concentration</th>
            </tr>
          </thead>
          <tbody>
            {POLLUTANTS.map(({ key, name, symbol, unit }) => (
              <tr key={key}>
                <td className="pollutant-name">{name}</td>
                <td className="pollutant-symbol">{symbol}</td>
                <td className="pollutant-value">
                  {components?.[key] ? `${components[key].toFixed(2)} ${unit}` : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }, []);

  // Debounced API calls to prevent rapid successive requests
  const fetchAirQualityData = useCallback(async (lat, lon) => {
    setLoadingAQI(true);
    try {
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${OWM_API_KEY}`
      );
      const data = await response.json();
      return data.list?.[0] || null;
    } catch (err) {
      console.error("AQI Fetch Error:", err);
      return null;
    } finally {
      setLoadingAQI(false);
    }
  }, []);

  const fetchWeatherData = useCallback(async (lat, lon) => {
    try {
      const res = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${OWM_API_KEY}`
      );
      const data = await res.json();
      setWeatherData({
        temp: data.main.temp,
        humidity: data.main.humidity,
        pressure: data.main.pressure,
        wind: data.wind.speed,
        clouds: data.clouds.all,
        weather: data.weather?.[0]?.description,
      });
    } catch (err) {
      console.error("Weather Fetch Error:", err);
    }
  }, []);

  // Combined data fetching with error handling
  const fetchAirQualityData2 = useCallback(async (lat, lon) => {
    try {
      const [aqi] = await Promise.all([
        fetchAirQualityData(lat, lon),
        fetchWeatherData(lat, lon)
      ]);
      
      if (aqi) {
        setSelectedStation({
          name: "Selected Station",
          aqi: aqi.main.aqi,
          components: aqi.components,
          aqiDt: aqi.dt,
        });
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    }
  }, [fetchAirQualityData, fetchWeatherData]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const layerMap = {
      clouds: L.OWM.clouds({ interval: 11, opacity: 0.9, appId: OWM_API_KEY }),
      temp: L.OWM.temperature({ interval: 11, opacity: 0.9, appId: OWM_API_KEY }),
      wind: L.OWM.wind({ interval: 11, opacity: 0.9, appId: OWM_API_KEY }),
      airquality: L.OWM.current({
        interval: 11,
        appId: OWM_API_KEY,
        lang: "en",
        minZoom: 5,
        imageLoadingUrl: "dist/img/owmloading.gif",
        popup: false // Disable automatic popups
      }),
    };

    // Add click handler only to airquality layer
    if (layerMap.airquality) {
      layerMap.airquality.on('click', async (e) => {
        const { lat, lng } = e.latlng;
        await fetchAirQualityData2(lat, lng);
      });
    }

    setLayers(layerMap);

    return () => {
      // Clean up click handlers
      if (layerMap.airquality) {
        layerMap.airquality.off('click');
      }
      
      // Clean up layers
      Object.values(layerMap).forEach(layer => {
        if (map.hasLayer(layer)) {
          map.removeLayer(layer);
        }
      });
    };
  }, [mapRef, fetchAirQualityData2]);


  
  // Memoize the modal content to prevent unnecessary re-renders
  const modalContent = useMemo(() => {
    if (!selectedStation) return null;

    return (
      <div className="modal-overlay">
        <div className="modal-content">
          <button onClick={() => setSelectedStation(null)} className="close-btn">×</button>

          <div className="modal-header">
            {selectedStation.aqiDt && (
              <div className="timestamp">
                Updated: {new Date(selectedStation.aqiDt * 1000).toLocaleString()}
              </div>
            )}
          </div>

          {loadingAQI ? (
            <div className="loading-spinner">Loading air quality data...</div>
          ) : (
            <>
              <div className="aqi-indicator" style={{ backgroundColor: getAQILevel(selectedStation.aqi).color }}>
                Air Quality Index: {selectedStation.aqi}
                <span className="aqi-label">({getAQILevel(selectedStation.aqi).label})</span>
              </div>

              <div className="pollutant-section">
                <h4>Pollutant Concentrations</h4>
                {renderPollutants(selectedStation.components)}
              </div>
            </>
          )}

          {weatherData && (
            <div className="weather-info">
              <h4>Current Weather</h4>
              <ul>
                <li><span>Temperature:</span> {weatherData.temp}°C</li>
                <li><span>Humidity:</span> {weatherData.humidity}%</li>
                <li><span>Pressure:</span> {weatherData.pressure} hPa</li>
                <li><span>Wind Speed:</span> {weatherData.wind} m/s</li>
                <li><span>Cloud Cover:</span> {weatherData.clouds}%</li>
                <li><span>Conditions:</span> {weatherData.weather}</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  }, [selectedStation, loadingAQI, weatherData, getAQILevel, renderPollutants]);

  return (
    <div className="weather-layers">
      <button onClick={toggleGroup} className="group-title">
        <div>
          <FaCloudSun style={{ marginRight: "8px", width: "16px", color: "green" }} />
          <span>Weather & Air Quality Layers</span>
        </div>
        <span>{isOpen ? "▾" : "▸"}</span>
      </button>

      {isOpen && (
        <div className="layers-container">
          {WEATHER_LAYERS_CONFIG.map(({ Name, Label }) => (
            <div key={Name} className="layer-item">
              <label>
                <input
                  type="checkbox"
                  checked={!!addedLayers[Name]}
                  onChange={() => toggleLayer(Name)}
                />{" "}
                {Label}
              </label>
            </div>
          ))}
        </div>
      )}

      {modalContent}
    </div>
  );
};

export default React.memo(WeatherLayers);
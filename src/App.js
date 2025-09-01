import { useState } from 'react';
import './App.css';

const App = () => {
  const [coordinates, setCoordinates] = useState('');
  const [geometry, setGeometry] = useState(null);
  const [startDate, setStartDate] = useState('2023-01-01');
  const [endDate, setEndDate] = useState('2023-12-31');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Parse and set geometry from input string
  const handleCoordinateSubmit = () => {
    try {
      const coordsArray = coordinates.split(';').map((coord) => {
        const [lat, lng] = coord.trim().split(',').map(Number);
        if (isNaN(lat) || isNaN(lng)) throw new Error('Invalid coordinate format');
        return [lng, lat]; // Note GeoJSON order is [lng, lat]
      });

      if (coordsArray.length < 3) {
        setError('Please enter at least 3 coordinate points to form a polygon');
        return;
      }
      // Close polygon by repeating first coordinate at end if not closed
      if (
        coordsArray[0][0] !== coordsArray[coordsArray.length - 1][0] ||
        coordsArray[0][1] !== coordsArray[coordsArray.length - 1][1]
      ) {
        coordsArray.push(coordsArray[0]);
      }

      setGeometry({
        type: 'Polygon',
        coordinates: [coordsArray],
      });
      setError(null);
    } catch (e) {
      setError('Invalid coordinate format. Use: lat,lng; lat,lng; ...');
    }
  };

  // Call backend API
  const handleAnalyze = async () => {
    if (!geometry) {
      setError('Please define an area of interest first');
      return;
    }
    if (!startDate || !endDate) {
      setError('Please select start and end dates');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:3000/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          geometry,
          startDate,
          endDate,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch analysis');
      }

      setResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Export results
  const exportResults = () => {
    if (!results) return;
    const dataStr = JSON.stringify(results, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'earth-engine-results.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container py-4">
      <h1>Earth Engine Analysis Tool</h1>

      <div>
        <label>Enter coordinates (lat,lng; lat,lng; ...):</label>
        <input
          type="text"
          value={coordinates}
          onChange={(e) => setCoordinates(e.target.value)}
          placeholder="28.6139,77.2090; 28.6139,77.3090; 28.7139,77.3090"
        />
        <button onClick={handleCoordinateSubmit}>Set Area</button>
      </div>

      <div>
        <label>Start Date:</label>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <label>End Date:</label>
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
      </div>

      <button onClick={handleAnalyze} disabled={loading || !geometry}>
        {loading ? 'Processing...' : 'Analyze Area'}
      </button>

      {error && <div style={{ color: 'red' }}>{error}</div>}

      {results && (
        <div>
          <h2>Results</h2>
         
          <p>Date Range: {results.metadata.dateRange.startDate} to {results.metadata.dateRange.endDate}</p>
          <div>
            <h3>NDVI</h3>
            <img src={results.images.ndvi} alt="NDVI" />
          </div>
          <div>
            <h3>NDWI</h3>
            <img src={results.images.ndwi} alt="NDWI" />
          </div>
          <div>
            <h3>RGB</h3>
            <img src={results.images.rgb} alt="RGB" />
          </div>
          <button onClick={exportResults}>Export Results as JSON</button>
        </div>
      )}
    </div>
  );
};

export default App;

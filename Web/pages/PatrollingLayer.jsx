import React, { useEffect, useState } from "react";
import { Polyline, Marker, Popup } from "react-leaflet";
import L from "leaflet";

const startIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const endIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export default function PatrollingLayer({ show }) {
  const [patrols, setPatrols] = useState([]);

  useEffect(() => {
    if (show) {
      fetch("http://68.178.167.39:5000/api/patrols-by-user?user_id=1")
        .then((res) => res.json())
        .then((data) => setPatrols(data))
        .catch((err) => console.error("Error fetching patrol data", err));
    }
  }, [show]);

  if (!show) return null;

  return (
    <>
      {patrols.map((patrol, i) => {
        // --------------------------------------------------------
        // NEW LOGIC: Use 'geom.coordinates' for the full route
        // --------------------------------------------------------

        // The coordinates array is in the format [[lat, lon], [lat, lon], ...]
        const routeCoordinates = patrol.geom?.coordinates || [];

        // Use the full route coordinates for the polyline
        const coords = routeCoordinates;
        
        // Determine start and end points from the route
        let startLat, startLon, endLat, endLon;

        if (coords.length > 0) {
            // Start is the first coordinate in the array: [lat, lon]
            [startLat, startLon] = coords[0];
            // End is the last coordinate in the array: [lat, lon]
            [endLat, endLon] = coords[coords.length - 1];
        } else {
            // Fallback to existing start/end strings if geom is empty,
            // though it should not be if this data is used.
            const [sLat, sLon] = patrol.start_location?.split(",").map(Number) || [0, 0];
            const [eLat, eLon] = patrol.end_location?.split(",").map(Number) || [0, 0];
            startLat = sLat;
            startLon = sLon;
            endLat = eLat;
            endLon = eLon;
        }

        // Skip rendering if we couldn't find any coordinates
        if (coords.length === 0) {
            return null;
        }
        
        return (
          <React.Fragment key={i}>
            <Marker position={[startLat, startLon]} icon={startIcon}>
              <Popup>Start: {patrol.patrol_officer_name}</Popup>
            </Marker>

            <Marker position={[endLat, endLon]} icon={endIcon}>
              <Popup>End: {patrol.patrol_officer_name}</Popup>
            </Marker>

            {/* The Polyline now uses the full coordinates array */}
            <Polyline positions={coords} color="blue" />
          </React.Fragment>
        );
      })}
    </>
  );
}
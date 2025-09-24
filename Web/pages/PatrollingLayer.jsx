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
      fetch("http://68.178.167.39:5000/api/patrols-by-user?user_id=2")
        .then((res) => res.json())
        .then((data) => setPatrols(data))
        .catch((err) => console.error("Error fetching patrol data", err));
    }
  }, [show]);

  if (!show) return null;

  return (
    <>
      {patrols.map((patrol, i) => {
        const [startLat, startLon] = patrol.start_location
          .split(",")
          .map(Number);
        const [endLat, endLon] = patrol.end_location.split(",").map(Number);

        // Only connect start to end
        const coords = [
          [startLat, startLon],
          [endLat, endLon],
        ];

        return (
          <React.Fragment key={i}>
            <Marker position={[startLat, startLon]} icon={startIcon}>
              <Popup>Start: {patrol.patrol_officer_name}</Popup>
            </Marker>

            <Marker position={[endLat, endLon]} icon={endIcon}>
              <Popup>End: {patrol.patrol_officer_name}</Popup>
            </Marker>

            <Polyline positions={coords} color="blue" />
          </React.Fragment>
        );
      })}
    </>
  );
}

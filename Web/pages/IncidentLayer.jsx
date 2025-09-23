import React from "react";
import { Marker, Popup } from "react-leaflet";
import L from "leaflet";

const incidentIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export default function IncidentLayer({ show, incidents }) {
  if (!show || !incidents || incidents.length === 0) return null;

  return (
    <>
      {incidents.map((incident) => {
        const [lng, lat] = incident.p_location_gps.coordinates;

        return (
          <Marker key={incident.p_incident_id} position={[lat, lng]} icon={incidentIcon}>
            <Popup>
              <strong>{incident.p_category_name}</strong>
              <br />
              Reported by: {incident.p_incident_reported_by}
              <br />
              {incident.p_incident_description}
              <br />
              {incident.p_image_urls.map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt={`incident-${i}`}
                  style={{ width: "100px", marginTop: "5px" }}
                />
              ))}
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}

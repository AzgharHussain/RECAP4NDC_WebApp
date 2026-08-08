import { useMap } from "react-leaflet";
import { useEffect } from "react";
import L from "leaflet";
import axios from "axios";
import { geoserverUrl } from "../config";

export default function AttributeInformation({
  isActive,
  queryableLayers = []   // ✅ default empty array
}) {
  const map = useMap();

  useEffect(() => {
    if (!isActive) return;

    const handleClick = async (e) => {
      try {
        // ✅ Check layers
        if (!queryableLayers || queryableLayers.length === 0) {
          L.popup()
            .setLatLng(e.latlng)
            .setContent("No queryable layers active")
            .openOn(map);
          return;
        }

        // Convert click to pixel
        const point = map.latLngToContainerPoint(e.latlng, map.getZoom());
        const size = map.getSize();

        const layerList = queryableLayers.join(",");

        // ✅ GeoServer URL (use SAME port as WMS tiles → 8445)
        const url =
          `${geoserverUrl}/cite/wms` +
          "?SERVICE=WMS" +
          "&VERSION=1.1.1" +
          "&REQUEST=GetFeatureInfo" +
          `&LAYERS=${layerList}` +
          `&QUERY_LAYERS=${layerList}` +
          "&INFO_FORMAT=application/json" +
          "&FEATURE_COUNT=10" +
          `&X=${Math.round(point.x)}` +
          `&Y=${Math.round(point.y)}` +
          `&WIDTH=${size.x}` +
          `&HEIGHT=${size.y}` +
          "&SRS=EPSG:4326" +
          `&BBOX=${map.getBounds().toBBoxString()}`;

        console.log("GetFeatureInfo URL:", url);

        const res = await axios.get(url);

        if (!res.data || !res.data.features || res.data.features.length === 0) {
          L.popup()
            .setLatLng(e.latlng)
            .setContent("No feature info found")
            .openOn(map);
          return;
        }

        const features = res.data.features;

        // Build popup HTML
        let html = "";

        features.forEach((feature, index) => {
          html += `<div style="margin-bottom:8px;">`;
          html += `<b>Feature ${index + 1}</b><br/>`;

          Object.entries(feature.properties).forEach(([key, value]) => {
            html += `<b>${key}:</b> ${value ?? "-"}<br/>`;
          });

          html += `</div>`;
        });

        L.popup()
          .setLatLng(e.latlng)
          .setContent(html)
          .openOn(map);

      } catch (err) {
        console.error("GetFeatureInfo Error:", err);

        L.popup()
          .setLatLng(e.latlng)
          .setContent("Error fetching attribute data")
          .openOn(map);
      }
    };

    map.on("click", handleClick);

    return () => {
      map.off("click", handleClick);
    };

  }, [isActive, queryableLayers, map]);

  return null;
}

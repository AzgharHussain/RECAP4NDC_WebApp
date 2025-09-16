import { useRef } from "react";
import { useMap, useMapEvents } from "react-leaflet";

function DrawingZoomMap() {
  const map = useMap();
  const isDrawingRef = useRef(false);
  const startPointRef = useRef(null);

  const cleanup = () => {
    isDrawingRef.current = false;
    startPointRef.current = null;
    map.dragging.enable();
    map.getContainer().style.cursor = "";
  };

  useMapEvents({
    mousedown: (e) => {
      if (e.originalEvent.button !== 0) return;

      isDrawingRef.current = true;
      startPointRef.current = e.latlng;
      map.getContainer().style.cursor = "crosshair";
      map.dragging.disable();
    },
    mouseup: (e) => {
      if (!isDrawingRef.current || !startPointRef.current) {
        cleanup();
        return;
      }

      const endPoint = e.latlng;
      const newBounds = [startPointRef.current, endPoint];

      const latDiff = Math.abs(newBounds[0].lat - newBounds[1].lat);
      const lngDiff = Math.abs(newBounds[0].lng - newBounds[1].lng);

      if (latDiff < 0.001 && lngDiff < 0.001) {
        map.setView(endPoint, Math.max(map.getZoom(), 14));
      } else {
        map.fitBounds(newBounds, { padding: [20, 20] });
      }

      cleanup();
    },
  });

  return null; // 👈 no Rectangle, no Poly
}

export default DrawingZoomMap;

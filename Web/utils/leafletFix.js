// Fixes Leaflet's default marker icon when bundled with Vite.
// Leaflet resolves marker-icon.png via a relative "images/" path that does
// not exist in the Vite build, so the <img> 404s and shows a broken image
// with alt text "Marker". Importing the PNGs here lets Vite bundle them and
// mergeOptions() points L.Icon.Default at the bundled URLs.
// Import this module once (side effect) before any L.marker(...) call.
import L from "leaflet";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

export default L;

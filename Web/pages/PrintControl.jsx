import React, { useEffect, useCallback, useRef } from "react";
import L from "leaflet";
import * as htmlToImage from "html-to-image";
import "./PrintControl.css";

const PrintControl = ({ mapRef }) => {
  const isExportingRef = useRef(false);
  const timeoutRef = useRef(null);

  // Export function
  const handleExport = useCallback(() => {
    if (isExportingRef.current) {
      console.log("Export already in progress");
      return;
    }

    const mapContainer = document.querySelector(".leaflet-container");
    if (!mapContainer) return;

    isExportingRef.current = true;

    // Clone legend
    const legend = document.querySelector(".legend-control");
    let tempLegend = null;

    if (legend) {
      tempLegend = legend.cloneNode(true);
      tempLegend.classList.add("legend-container");
      tempLegend.style.position = "absolute";
      tempLegend.style.zIndex = "1000";
      mapContainer.appendChild(tempLegend);
    }

    // Add compass
    const compass = document.createElement("div");
    compass.className = "compass-export";
    compass.style.position = "absolute";
    compass.style.top = "10px";
    compass.style.left = "10px";
    compass.style.zIndex = "1000";
    compass.style.width = "100px";
    compass.style.height = "100px";
    compass.style.borderRadius = "50%";
    compass.style.backgroundImage =
      "url('https://tse1.mm.bing.net/th/id/OIP.K_Myuhg_T1PHcwiVTW2_ywHaI7?r=0&rs=1&pid=ImgDetMain&o=7&rm=3')";
    compass.style.backgroundSize = "cover";
    compass.style.backgroundRepeat = "no-repeat";
    compass.style.backgroundPosition = "center";
    mapContainer.appendChild(compass);

    // Clear timeout if already running
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      htmlToImage
        .toPng(mapContainer, {
          quality: 1,
          pixelRatio: 2,
          backgroundColor: "#ffffff",
          useCORS: true,
          skipFonts: true,
        })
        .then((dataUrl) => {
          // Cleanup
          if (tempLegend && mapContainer.contains(tempLegend)) {
            mapContainer.removeChild(tempLegend);
          }
          if (mapContainer.contains(compass)) {
            mapContainer.removeChild(compass);
          }

          const link = document.createElement("a");
          link.download = "Aravalli_Green_Wall_Map.png";
          link.href = dataUrl;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          isExportingRef.current = false;
        })
        .catch((err) => {
          if (tempLegend && mapContainer.contains(tempLegend)) {
            mapContainer.removeChild(tempLegend);
          }
          if (mapContainer.contains(compass)) {
            mapContainer.removeChild(compass);
          }
          console.error("Export failed:", err);
          alert("Failed to export map. See console for details.");
          isExportingRef.current = false;
        });
    }, 1000);
  }, []);

  useEffect(() => {
    if (!mapRef?.current) return;

    // Print control
    const printControl = L.control({ position: "bottomleft" });
    printControl.onAdd = function () {
      const div = L.DomUtil.create(
        "div",
        "leaflet-bar leaflet-control print-control-container"
      );
      const button = L.DomUtil.create("a", "", div);
      button.innerHTML = "🖨️";
      button.href = "#";
      button.title = "Print Map";
      button.className = "print-control-button";

      L.DomEvent.on(button, "click", (e) => {
        L.DomEvent.preventDefault(e);
        L.DomEvent.stopPropagation(e);
        handleExport();
      });

      return div;
    };
    printControl.addTo(mapRef.current);

    // Legend control
    const legendControl = L.control({ position: "bottomright" });
    let legendDiv = null;

    legendControl.onAdd = function () {
      legendDiv = L.DomUtil.create("div", "legend-control");
      return legendDiv;
    };
    legendControl.addTo(mapRef.current);

    // Update legend
    const updateLegend = () => {
      const legendElement = document.getElementById("legend-container");
      if (legendElement && legendDiv) {
        legendDiv.innerHTML = legendElement.innerHTML;
      }
    };

    updateLegend();
    const legendInterval = setInterval(updateLegend, 2000);

    // Cleanup
    return () => {
      clearInterval(legendInterval);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      mapRef.current.removeControl(printControl);
      mapRef.current.removeControl(legendControl);
      
    };
  }, [mapRef, handleExport]);

  return null;
};

export default PrintControl;

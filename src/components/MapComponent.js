// src/components/MapComponent.js
import React, { useEffect, useRef, useState } from 'react';

const MapComponent = ({ layers, dates }) => {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);

  useEffect(() => {
    // Initialize the map
    if (!map && mapRef.current && window.google) {
      const newMap = new window.google.maps.Map(mapRef.current, {
        center: { lat: 20, lng: 0 },
        zoom: 3
      });
      setMap(newMap);
    }
  }, [map]);

  useEffect(() => {
    // Update map layers when layers or dates change
    if (!window.ee || !map || !window.eeInitialized) return;

    // Function to add Earth Engine layers
    const updateEELayers = async () => {
      try {
        // Clear existing layers
        if (window.eeLayers) {
          window.eeLayers.forEach(layer => {
            if (layer && layer.setMap) {
              layer.setMap(null);
            }
          });
        }
        
        window.eeLayers = [];
        
        // Define geometry (using a default point for now)
        const geometry = window.ee.Geometry.Point([0, 0]);
        
        // Function to create and add a layer
        const addEELayer = (eeObject, visParams, name) => {
          window.ee.data.getMapId(visParams, (mapId) => {
            const overlay = new window.google.maps.ImageMapType({
              getTileUrl: (tile, zoom) => {
                if (!mapId || !mapId.url) return '';
                return mapId.url.replace('{x}', tile.x)
                               .replace('{y}', tile.y)
                               .replace('{z}', zoom);
              },
              tileSize: new window.google.maps.Size(256, 256),
              name: name
            });
            
            map.overlayMapTypes.push(overlay);
            window.eeLayers.push(overlay);
          });
        };
        
        // Load the 2018 data if any 2018 layer is visible
        if (layers.composite2018 || layers.ndvi2018 || layers.ndwi2018) {
          const filtered2018 = window.ee.ImageCollection('COPERNICUS/S2_HARMONIZED')
            .filter(window.ee.Filter.date(dates.startDate2018, dates.endDate2018))
            .filter(window.ee.Filter.bounds(geometry))
            .filter(window.ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 30));
          
          const medianComposite2018 = filtered2018.median();
          
          if (layers.composite2018) {
            addEELayer(medianComposite2018, {
              min: 0,
              max: 3000,
              bands: ['B4', 'B3', 'B2']
            }, "2018 Median Composite");
          }
          
          if (layers.ndvi2018) {
            const ndvi2018 = medianComposite2018.normalizedDifference(['B8', 'B4']);
            addEELayer(ndvi2018, {
              min: -0.2,
              max: 0.8,
              palette: ['white', 'green'].join(',')
            }, "NDVI 2018");
          }
          
          if (layers.ndwi2018) {
            const ndwi2018 = medianComposite2018.normalizedDifference(['B3', 'B8']);
            addEELayer(ndwi2018, {
              min: -0.2,
              max: 0.8,
              palette: ['white', 'blue'].join(',')
            }, "NDWI 2018");
          }
        }
        
        // Load the 2024 data if any 2024 layer is visible
        if (layers.composite2024 || layers.ndvi2024 || layers.ndwi2024) {
          const filtered2024 = window.ee.ImageCollection('COPERNICUS/S2_HARMONIZED')
            .filter(window.ee.Filter.date(dates.startDate2024, dates.endDate2024))
            .filter(window.ee.Filter.bounds(geometry))
            .filter(window.ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 30));
          
          const medianComposite2024 = filtered2024.median();
          
          if (layers.composite2024) {
            addEELayer(medianComposite2024, {
              min: 0,
              max: 3000,
              bands: ['B4', 'B3', 'B2']
            }, "2024 Median Composite");
          }
          
          if (layers.ndvi2024) {
            const ndvi2024 = medianComposite2024.normalizedDifference(['B8', 'B4']);
            addEELayer(ndvi2024, {
              min: -0.2,
              max: 0.8,
              palette: ['white', 'green'].join(',')
            }, "NDVI 2024");
          }
          
          if (layers.ndwi2024) {
            const ndwi2024 = medianComposite2024.normalizedDifference(['B3', 'B8']);
            addEELayer(ndwi2024, {
              min: -0.2,
              max: 0.8,
              palette: ['white', 'blue'].join(',')
            }, "NDWI 2024");
          }
        }
      } catch (error) {
        console.error('Error loading Earth Engine data:', error);
      }
    };
    
    updateEELayers();
  }, [layers, dates, map]);

  return <div ref={mapRef} style={{ width: '100%', height: '100%' }} />;
};

export default MapComponent;
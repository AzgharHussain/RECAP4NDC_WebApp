// components/LayerControls.js
import React from 'react';

const LayerControls = ({ layers, onLayerToggle }) => {
  const layerOptions = [
    { id: 'composite2018', label: '2018 Median Composite' },
    { id: 'ndvi2018', label: 'NDVI 2018' },
    { id: 'ndwi2018', label: 'NDWI 2018' },
    { id: 'composite2024', label: '2024 Median Composite' },
    { id: 'ndvi2024', label: 'NDVI 2024' },
    { id: 'ndwi2024', label: 'NDWI 2024' }
  ];

  return (
    <div className="layer-controls">
      <h3>Map Layers</h3>
      {layerOptions.map(layer => (
        <div key={layer.id} className="layer-checkbox">
          <label>
            <input
              type="checkbox"
              checked={layers[layer.id]}
              onChange={() => onLayerToggle(layer.id)}
            />
            {layer.label}
          </label>
        </div>
      ))}
    </div>
  );
};

export default LayerControls;
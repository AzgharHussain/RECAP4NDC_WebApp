import React from 'react';


// Function to get the legend URL for a given layer
const getLegendUrl = (layerName) => {
  const geoserverUrl = "https://www.gisfy.co.in:8443/geoserver/ows";
  return `${geoserverUrl}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetLegendGraphic&FORMAT=image/png&LAYER=${layerName}`;
};

// Legend Component
function Legend({ legendlist, addedLayers,setActiveTool }) {
  return (
    
    <div className="legend-container">
       <div className="panel-header">
          <h1>Legend</h1>
          <button onClick={() => setActiveTool(null)} style={{ backgroundColor: 'transparent', border: 'none' }}>
            <span className="material-icons-outlined" style={{ color: 'black' }}>close</span>
          </button>
        </div>
   
    {Object.keys(addedLayers).map((layerName) => (
       
      <div key={layerName} className="legend-item">
         <h6>{layerName}</h6>
        <img
          src={getLegendUrl(layerName)}
          alt={`${layerName} legend`}
        />
      </div>
    ))}
  </div>
  );
}

export default Legend;

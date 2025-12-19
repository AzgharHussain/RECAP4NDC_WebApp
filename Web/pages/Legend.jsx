import React, { useState } from 'react';
import { REACT_APP_GEOSERVER_URL } from '../config';
import {FaChevronUp ,FaChevronDown } from  'react-icons/fa';
import './Legend.css';

const weatherLayers = {
  clouds: "Cloud Coverage",
  temp: "Temperature",
  wind: "Wind Speed",
  airquality: "Air Quality"
};

const OWM_API_KEY = "d890cedbd5c4db6842f9ccd44993cd05";
const getLegendUrl = (layerName) => {
  // Handle weather layers
  if (weatherLayers[layerName]) {
    return `https://tile.openweathermap.org/map/${layerName}_new/0/0/0.png?appid=${OWM_API_KEY}`;
  }

  // Handle specific NDVI layers
  if (
    layerName === "mahendragarh_ndvi_2016" ||
    layerName === "mahendragarh_ndvi_2025" ||
    layerName === "NDVI_Analytics"
  ) {
    const geoserverUrl = REACT_APP_GEOSERVER_URL;
    // Adjust the layer name parameter based on your actual GeoServer layer names
    const geoServerLayerName =
      layerName === "NDVI_Analytics"
        ? "Mahendragarh_tblvilage_landsat_2025_739_Analytics"
        : layerName === "mahendragarh_ndvi_2016"
        ? "Mahendragarh_tblvilage_landsat_2016_739"
        : "Mahendragarh_tblvilage_landsat_2016_739";

    return `${geoserverUrl}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetLegendGraphic&FORMAT=image/png&LAYER=${geoServerLayerName}`;
  }

  // Handle suitability layers
  if (
    layerName === "Highly Suitable_Analytics" ||
    layerName === "Moderately_Suitable_Analytics"
  ) {
    const geoserverUrl = REACT_APP_GEOSERVER_URL;
    const geoServerLayerName =
      layerName === "Highly Suitable_Analytics"
        ? "Mahendragarh_tblvilage_soil_739_Highly Suitable"
        : "Mahendragarh_tblvilage_soil_739_Moderately_Suitable";

    return `${geoserverUrl}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetLegendGraphic&FORMAT=image/png&LAYER=${geoServerLayerName}`;
  }

  // Default case for other layers
  const geoserverUrl = REACT_APP_GEOSERVER_URL;
  return `${geoserverUrl}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetLegendGraphic&FORMAT=image/png&LAYER=${layerName}`;
};


const formatLayerName = (layerName) => {
  if (weatherLayers[layerName]) {
    return weatherLayers[layerName];
  }
  return layerName
    .replace(/_/g, ' ')
    .replace(/(?:^|\s)\S/g, (match) => match.toUpperCase());
};

const LAYER_CONFIG = {
  groups: [
    {
      title: "Gujarat State Boundaries",
      layerList: [
        
        { Name:"Gujarat_district", Layer: "District" },
        { Name: "Gujarat_Forest_Area_Boundary_March_2023", Layer: "Forest Area" }
      
      ]
    },
      {
      title: "Wildlife Circle ",
      layerList: [
        { Name: "Wildlife_Circle_Beat_Boundary", Layer: "Wildlife Circle Beat" },
        { Name: "Wildlife_Circle_Boundary", Layer: "Wildlife Circle" },
        { Name: "Wildlife_Circle_Division_Boundary", Layer: "Wildlife Circle Division" },
        { Name: "Wildlife_Circle_Range_Boundary", Layer: "Wildlife Circle Range" },
        { Name: "Wildlife_Circle_Round_Boundary", Layer: "Wildlife Circle Round" },
        { Name: "Wildlife_Circle_Village_Boundary", Layer: "Wildlife Circle Village" },
      ]
    },
    {
      title: "Social Forestry ",
      layerList: [
        { Name: "Social_Forestry_Beat_Boundary", Layer: "Social Forestry Beat" },
        { Name: "Gujarat_Social_Forestry_Circle_Boundary", Layer: "Social Forestry Circle" },
        { Name: "Gujarat_Social_Forestry_Range_Boundary", Layer: "Social Forestry Range" },
        { Name: "Gujarat_Social_Forestry_Round_Boundary", Layer: "Social Forestry Round" },
        { Name: "GujaratSocial_Forestry_Village_Boundary", Layer: "Social Forestry Village" },
      ]
    },
    {
      title: "Territorial Circle ",
      layerList: [
        { Name: "Teritorial_Circle_Beat_Boundary", Layer: "Territorial Circle Beat" },
        { Name: "Teritorial_Circle_Division_Boundary", Layer: "Territorial Circle Division" },
        { Name: "Teritorial_Circle_Range_Boundary", Layer: "Territorial Circle Range" },
        { Name: "Teritorial_Circle_Round_Boundary", Layer: "Territorial Circle Round" },
        { Name: "Teritorial_Circle_Village_Boundary", Layer: "Territorial Circle Village" },
      
      ]
    },
  
    {
      title: "Banaskantha",
      layerList: [
        { Name: "Con_Cum_Imp_WC_OVLP", Layer: "Banaskantha Con Cum Imp WC OVLP" },
        { Name: "Banaskantha_DesDev_WL_WC", Layer: "Banaskantha DesDev WL WC" },
        { Name: "Banaskantha_RWD_WC_final", Layer: "Banaskantha RWD WC Final" },
        { Name: "Banaskantha_Wild Life_WC", Layer: "Banaskantha Wildlife WC" },
      ]
    },
    {
      title: "Banni",
      layerList: [
        { Name: "Banni Forest", Layer: "Banni Forest" },
      ]
    },
    {
      title: "Baria",
      layerList: [
        { Name: "Baria_DEV_AFF COUPE", Layer: "Baria Dev Aff Coupe" },
        { Name: "Baria_DEV_DEV&CON W.C COUPE", Layer: "Baria Dev Dev&Con W.C Coupe" },
        { Name: "Baria_Danpur_AFF W.C COUPE", Layer: "Baria Danpur Aff W.C Coupe" },
        { Name: "Baria_Danpur_BIO W.C COUPE", Layer: "Baria Danpur Bio W.C Coupe" },
        { Name: "Baria_Danpur_DEV&CON W.C COUPE", Layer: "Baria Danpur Dev&Con W.C Coupe" },
        { Name: "Baria_Danpur_Rev", Layer: "Baria Danpur Revenue" },
        { Name: "Baria_Dev_Revenue", Layer: "Baria Dev Revenue" },
      ]
    },
    {
      title: "Bharuch",
      layerList: [
        { Name: "Bharuch_Coupe_joined", Layer: "Bharuch Coupe Joined" },
      ]
    },
    {
      title: "Bhavnagar",
      layerList: [
        { Name: "Bhavnagar_coupes", Layer: "Bhavnagar Coupes" },
        { Name: "Bhavnagr_Shetrunjay_Ranges", Layer: "Bhavnagar Shetrunjay Ranges" },
        { Name: "Bhavnagr_Shetrunjay_WL_Divi", Layer: "Bhavnagar Shetrunjay WL Divi" },
      ]
    },
    {
      title: "Chhotaudepur",
      layerList: [
        { Name: "Chhotaudepur_CUD_Coupe_bdn", Layer: "Chhotaudepur CUD Coupe BDN" },
      ]
    },
    {
      title: "Dohad",
      layerList: [
        { Name: "DOHAD_AFFORESTATION W.C COUPE", Layer: "Dohad Afforestation W.C Coupe" },
        { Name: "DOHAD_D_DEVELOPMENT&CONSERVATION COUPE", Layer: "Dohad Dev&Conservation Coupe" },
        { Name: "DOHAD_GRASSBIR W.C COUPE", Layer: "Dohad Grassbir W.C Coupe" },
        { Name: "DOHAD_PRO", Layer: "Dohad Pro" },
        { Name: "DOHAD_REVENUE", Layer: "Dohad Revenue" },
      ]
    },
    {
      title: "Fatepura",
      layerList: [
        { Name: "FATEPURA_AFFORESTATION W.C _COUPE", Layer: "Fatepura Afforestation W.C Coupe" },
        { Name: "FATEPURA_Revenu_Boundary", Layer: "Fatepura Revenue Boundary" },
      ]
    },
    {
      title: "Gandhinagar",
      layerList: [
        { Name: "Gandhinagar_MM_Coupe", Layer: "Gandhinagar MM Coupe" },
      ]
    },
    {
      title: "Garbada",
      layerList: [
        { Name: "Garbada_Afforestation_Coupe", Layer: "Garbada Afforestation Coupe" },
        { Name: "Garbada_Develop &Conser Coupe", Layer: "Garbada Develop &Conser Coupe" },
        { Name: "Garbada_GR W.C COUPE", Layer: "Garbada GR W.C Coupe" },
        { Name: "Garbada_Revenue", Layer: "Garbada Revenue" },
      ]
    },
    {
      title: "Jamnagar",
      layerList: [
        { Name: "Jamnagar_coupes", Layer: "Jamnagar Coupes" },
      ]
    },
    {
      title: "Jhalod",
      layerList: [
        { Name: "Jhalod_AFFORESTATION W.C_COUPE", Layer: "Jhalod Afforestation W.C Coupe" },
        { Name: "Jhalod_GRASSBIR W.C COUPE", Layer: "Jhalod Grassbir W.C Coupe" },
        { Name: "Jhalod_J_DEVELO&CON W.C COUPE", Layer: "Jhalod Dev&Con W.C Coupe" },
        { Name: "Jhalod_Revenue", Layer: "Jhalod Revenue" },
      ]
    },
    {
      title: "Junagadh",
      layerList: [
        { Name: "Junagadh coupes", Layer: "Junagadh Coupes" },
      ]
    },
    {
      title: "Kanjeta",
      layerList: [
        { Name: "Kanjeta_AFF W.C COUPE", Layer: "Kanjeta Aff W.C Coupe" },
        { Name: "Kanjeta_DEVELOPMENT&CONSERVATION W.C COUPE", Layer: "Kanjeta Dev&Conservation W.C Coupe" },
        { Name: "Kanjeta_Revenue", Layer: "Kanjeta Revenue" },
      ]
    },
    {
      title: "Limkheda",
      layerList: [
        { Name: "Limkhed_Revenue", Layer: "Limkhed Revenue" },
        { Name: "Limkheda_DEVELOPMENT&CONSERVATION W.C COUPE", Layer: "Limkheda Dev&Conservation W.C Coupe" },
        { Name: "Limkheda_L_AFFORESTATION W.C COUPE", Layer: "Limkheda Afforestation W.C Coupe" },
        { Name: "Limkheda_L_GRASSBIR W.C COUPE", Layer: "Limkheda Grassbir W.C Coupe" },
      ]
    },
    {
      title: "Mahisagar",
      layerList: [
        { Name: "Mahisagar_all_Coupe_FF", Layer: "Mahisagar All Coupe FF" },
      ]
    },
    {
      title: "Merged Layers",
      layerList: [
        { Name: "Merged2", Layer: "Merged 2" },
        { Name: "Merged_coupes", Layer: "Merged Coupes" },
      ]
    },
    {
      title: "Morbi",
      layerList: [
        { Name: "Morbi_coupe_map", Layer: "Morbi Coupe Map" },
      ]
    },
    {
      title: "Narmada",
      layerList: [
        { Name: "Narmada_CP_FS2_compt4_RRB", Layer: "Narmada CP FS2 Compt4 RRB" },
      ]
    },
    {
      title: "Raampura",
      layerList: [
        { Name: "Raaampura_R_AFFORESTATION COUPE", Layer: "Raampura Afforestation Coupe" },
        { Name: "Rampura_R_GRASSBIR COUPE", Layer: "Rampura Grassbir Coupe" },
        { Name: "Rampura_Revenue", Layer: "Rampura Revenue" },
      ]
    },
    {
      title: "Randhikpur",
      layerList: [
        { Name: "Randhikpur_RAN_AFFO W.C COUPE", Layer: "Randhikpur Affo W.C Coupe" },
        { Name: "Randhikpur_RAN_DEV&CON W.C COUPE", Layer: "Randhikpur Dev&Con W.C Coupe" },
        { Name: "Randhikpur_RAN_GRASSBIR W.C COUPE", Layer: "Randhikpur Grassbir W.C Coupe" },
        { Name: "Randhikpur_REVENUE", Layer: "Randhikpur Revenue" },
      ]
    },
    {
      title: "Sagtala",
      layerList: [
        { Name: "SAGTALA_BIODI W.C COUPE", Layer: "Sagtala Biodi W.C Coupe" },
        { Name: "SAGTALA_DEV&CON W.C COUPE", Layer: "Sagtala Dev&Con W.C Coupe" },
      ]
    },
    {
      title: "Sabarkantha",
      layerList: [
        { Name: "Sabarkantha_North_Aravalli", Layer: "Sabarkantha North Aravalli" },
        { Name: "Sabarkantha_South_Aravalli", Layer: "Sabarkantha South Aravalli" },
      ]
    },
    {
      title: "Sanjeli",
      layerList: [
        { Name: "Sanjeli_AFFORESTATION W.C _COUPE", Layer: "Sanjeli Afforestation W.C Coupe" },
        { Name: "Sanjeli_DEVELO&CON W.C COUPE", Layer: "Sanjeli Dev&Con W.C Coupe" },
        { Name: "Sanjeli_G.S.F.D.C.AREA", Layer: "Sanjeli GSFDC Area" },
        { Name: "Sanjeli_GRASSBIR W.C COUPE", Layer: "Sanjeli Grassbir W.C Coupe" },
        { Name: "Sanjeli_Revenu_Boundary", Layer: "Sanjeli Revenue Boundary" },
      ]
    },
    {
      title: "Sarjumi",
      layerList: [
        { Name: "Sarjumi_AFFORESTATION W.C COUPE", Layer: "Sarjumi Afforestation W.C Coupe" },
        { Name: "Sarjumi_DEV&CON W.C COUPE", Layer: "Sarjumi Dev&Con W.C Coupe" },
        { Name: "Sarjumi_GRASSBIR W.C COUPE", Layer: "Sarjumi Grassbir W.C Coupe" },
        { Name: "Sarjumi_REVENUE", Layer: "Sarjumi Revenue" },
      ]
    },
    {
      title: "Surat",
      layerList: [
        { Name: "Surat_all_Range_Coupe", Layer: "Surat All Range Coupe" },
      ]
    },
    {
      title: "Surendranagar",
      layerList: [
        { Name: "Surendranagar_coupe", Layer: "Surendranagar Coupe" },
      ]
    },
    {
      title: "Vansi",
      layerList: [
        { Name: "Vansi_AFF W.C COUPE", Layer: "Vansi Aff W.C Coupe" },
        { Name: "Vansi_BIO W.C COUPE", Layer: "Vansi Bio W.C Coupe" },
        { Name: "Vansi_DEV&CON W.C  COUPE", Layer: "Vansi Dev&Con W.C Coupe" },
        { Name: "Vansi_Revenue", Layer: "Vansi Revenue" },
      ]
    },
    {
      title: "Vyara",
      layerList: [
        { Name: "Vyara_MM_Coupe_Boundary", Layer: "Vyara MM Coupe Boundary" },
      ]
    },
  ]
};
         

function Legend({ addedLayers }) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

 
  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  // Create a lookup map for layer names to their display titles
  const layerTitleMap = {};
  LAYER_CONFIG.groups.forEach(group => {
    group.layerList.forEach(layer => {
      layerTitleMap[layer.Name] = layer.Layer;
    });
  });

  const getLayerTitle = (layerName) => {
    // First check if it's a weather layer
    if (weatherLayers[layerName]) {
      return weatherLayers[layerName];
    }
    // Then check our layer title map
    if (layerTitleMap[layerName]) {
      return layerTitleMap[layerName];
    }

  if (layerName.startsWith("tblvilage_landsat_2025_")) {
    return "NDVI 2025";
}

if (layerName.startsWith("tblvilage_landsat_2016_")) {
    return "NDVI 2016";
}
if (layerName.startsWith("degradations_")) {
    return "Degraded Forest";
}


if (layerName.startsWith("Regeneration forest_")){
  return "Regenerated Forest";
}

if (layerName.startsWith("Stable Non-Vegetation_")){
  return "Stable Non-Vegetation";
}

if (layerName.startsWith("Mahendragarh_tblvilage_soil_")){
  return "Stable Vegetation";
}

if (layerName == "Simplified_Dessolve_soil_Highly_Suitable_Section"){
  return "Highly Suitable";
}

if (layerName== "Simplified_Dessolve_soil_Moderately_Suitable_Section"){
  return "Moderately Suitable";
}

if (layerName=="NDVI_Analytics"){
  return "vegetation changes"
}

if (layerName=="mahendragarh_ndvi_2016"){
  return "vegetation 2016"
}

if (layerName=="Simplified_DissolvedLandSat_2016_others_Section"){
  return "Others"
}

if (layerName=="Simplified_Dissolvedlandsat_2016_Open_Vegetation_Section"){
  return "Open Vegetation"
}

if (layerName=="Simplified_DissolvedLandsat_2016Moderately_Dense_Vegetation_Sec"){
  return "Moderately Dense Vegetation"
}
if (layerName=="Simplified_DissolvedLanSat_2016_Dense_Vegetation_Section"){
  return "Dense Vegetation"
}



if (layerName=="Simplified_DissolvedLanSat_2025_Others_Section"){
  return "Others"
}

if (layerName=="Simplified_DissolvedLandSat_2025_OpenVegetation_Section"){
  return "Open Vegetation"
}

if (layerName=="Simplified_DissolvedLandSat_2025_Moderately_Dense_Vegetation_Se"){
  return "Moderately Dense Vegetation"
}
if (layerName=="Simplified_DissolvedlandSat_2025_Dense_Vegetation_Section"){
  return "Dense Vegetation"
}

if (layerName=="Simplified_Dissolved_Landat_2025_Degradation_Section"){
  return "Degradation"
}

if (layerName=="Simplified_Dissolvedladsat_2025_Afforestion_Section"){
  return "Afforestion"
}
if(layerName == "Arawali_SOIL_Final"){
  return "Soil organic carbon"
}
if (layerName=="Simplified_Dissolved_Landat_2025_Stable_non_vegetation_Section"){
  return "Stable non vegetation"
}
if (layerName=="Simplified_Dissolved_LandSat_2025_Stable_vegetation_Section"){
  return "Stable vegetation"
}


 


    // Fallback to formatted layer name
    return layerName
      .replace(/_/g, ' ')
      .replace(/(?:^|\s)\S/g, match => match.toUpperCase());
  };


  return (
    <div className={`legend-container ${isMinimized ? 'minimized' : ''}`} id="legend-container">
      <div className="panel-header2">
        <h4 className="panel-title">Map Legend</h4>
        <div className="legend-controls">
          <button
            className="control-button"
            onClick={toggleCollapse}
            aria-label={isCollapsed ? "Collapse legend" : "Expand legend"}
          >
            <span >
              {isCollapsed ? <FaChevronUp /> : <FaChevronDown />}
            </span>
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div className='custom-scroll'>

        <div className="legend-items">
          {Object.keys(addedLayers).map((layerName) => (<>
          
        <div key={layerName} className="legend-item">
                <h5 className="legend-title">{getLayerTitle(layerName)}</h5>
                <div>

           
                <img
                  src={getLegendUrl(layerName)}
                  alt={`${getLayerTitle(layerName)} legend`}
                  className="legend-image"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='80' viewBox='0 0 100 30'%3E%3Crect width='100' height='30' fill='%23f5f5f5'/%3E%3Ctext x='50%' y='50%' font-family='Arial' font-size='10' fill='%23666' text-anchor='middle' dominant-baseline='middle'%3ELegend not available%3C/text%3E%3C/svg%3E";
                  }}
                />
                  </div>
            </div>
          </>  ))}
        </div>
        </div>
      )}
    </div>
  );
}

export default Legend;

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
  groups:  [
            {
              title:"Land Ownership",
              layerList:[
                { Name:"Rajasthan_Forest", Layer: "Forest Department" },
                // {Name:"Village Community" , Layer: "Village Community" }
              ]
            },
    //             {
    // title: "NDVI Land Cover Classification - 2016",
    // layerList: [
    //   { Name: "Water / Non-vegetation", Layer: "Water / Non-vegetation" },
    //   { Name: "Scrub / Sparse Non-vegetation", Layer: "Scrub / Sparse Non-vegetation" },
    //   { Name: "Open Vegetation (Crown Cover >10%)", Layer: "Open Vegetation (Crown Cover >10%)" },
    //   { Name: "Moderately Dense Vegetation (10-60%)", Layer: "Moderately Dense Vegetation (10-60%)" },
    //   { Name: "Dense Vegetation (>60%)", Layer: "Dense Vegetation (>60%)" },
    //   { Name: "Very Dense Vegetation (>60%)", Layer: "Very Dense Vegetation (>60%)" }
    // ],
    //             },
    //             {
    //   title: "NDVI Land Cover Classification - 2025",
    //    layerList: [
    //   { Name: "Water / Non-vegetation", Layer: "Water / Non-vegetation" },
    //   { Name: "Scrub / Sparse Non-vegetation", Layer: "Scrub / Sparse Non-vegetation" },
    //   { Name: "Open Vegetation (Crown Cover >10%)", Layer: "Open Vegetation (Crown Cover >10%)" },
    //   { Name: "Moderately Dense Vegetation (10-60%)", Layer: "Moderately Dense Vegetation (10-60%)" },
    //   { Name: "Dense Vegetation (>60%)", Layer: "Dense Vegetation (>60%)" },
    //   { Name: "Very Dense Vegetation (>60%)", Layer: "Very Dense Vegetation (>60%)" }
    //   ]
    // }
  
  // ,
  //           {
  //             title:"Suitable Lands for Vegetation",
  //             layerList:[
  //               { Name:"Highly Suitable Areas", Layer: "Highly Suitable Areas" },
  //               { Name:"Moderately Suitable Areas", Layer: "Moderately Suitable Areas" },
  //               { Name:"Marginally Suitable Areas", Layer: "Marginally Suitable Areas" },
  //               { Name:"Unsuitable Areas", Layer: "Unsuitable Areas" }
  //             ]
  //           },
  //           {
          
          {
            
        title: "Land Use/Land Cover",
        layerList: [
          { Name: "view_lulctype_agricultural_land", Layer: "Agricultural Land" },
          { Name: "view_lulctype_built_up", Layer: "Built-up" },
          { Name: "view_lulctype_built_up___agricultural", Layer: "Built-up / Agricultural" },
          { Name: "view_lulctype_built_up___degraded_land", Layer: "Built-up / Degraded Land" },
          { Name: "view_lulctype_degraded_forest", Layer: "Degraded Forest" },
          { Name: "view_lulctype_degraded_land", Layer: "Degraded Land" },
          { Name: "view_lulctype_forest", Layer: "Forest" },
          { Name: "view_lulctype_grassland", Layer: "Grassland" },
          { Name: "view_lulctype_open_and_barren_land", Layer: "Open and Barren Land" },
          { Name: "view_lulctype_water_body", Layer: "Water Body" },
          { Name: "view_lulctype_wetland", Layer: "Wetlands" }
        ]
      },
      {
        title: "Soil Type and Composition",
        layerList: [
          { Name: "view_soiltype_alluvial", Layer: "Alluvial" },
          { Name: "view_soiltype_loamy", Layer: "Loamy" },
          { Name: "view_soiltype_rocky", Layer: "Rocky" },
          { Name: "view_soiltype_sandy", Layer: "Sandy" },
         {Name:"Arawali_SOIL_Final",Layer:"Soil Organic Carbon"}
        ]
      },
      {
        title: "Topography",
        layerList: [
          // { Name: "AGWL_tiff_Aspect", Layer: "Aspect" },
          { Name: "AGWL_tiff_DEM", Layer: "Elevation" },
          // { Name: "AGWL_tiff_Elevation", Layer: "Elevation2" },
          { Name: "AGWL_tiff_Slope", Layer: "Slope" },
        //   { Name: "AGWL_tiff_color_relief", Layer: "Color Relief" },
        //   { Name: "AGWL_tiff_color_hillshade", Layer: "Hillshade" },
        //  { Name: "Envapotranspiration_MODIS", Layer: "Evapotranspiration" }
        ]
      },
      // {
      //   title: "Aravali Range",
      //   layerList: [
      //     { Name: "AGWL_tiff_mining", Layer: "Mining Areas" },
      //     { Name: "LULC_Arawali", Layer: "Land Use Land Cover" },
      //     { Name: "Aravali_soil_type", Layer: "Soil Types" },
      //     { Name: "Aravali_leadZink", Layer: "Lead-Zinc Deposits" },
      //     { Name: "Baryte_deposit", Layer: "Baryte Deposits" },
      //     { Name: "coper1", Layer: "Copper Deposits" },
      //     { Name: "Aravali_hydro", Layer: "Hydrogeology" },
      //     { Name: "Arvali_Carbon", Layer: "Carbon" },
      //     { Name: "Envapotranspiration_MODIS", Layer: "Evapotranspiration (MODIS)" }
      //   ]
      // },
       {
             title: "Administrative Boundaries",
          layerList: [
       { Name: "tblstate", Layer: "State" },
       { Name: "tbldistrict", Layer: "District" },
       { Name: "tblblock", Layer: "Block" },
      //  { Name: "tblTaluk", Layer: "Taluk" },
       { Name: "Arawali_Village_List3", Layer: "Village" },
   
   ]
   
           },
           {
             title: "Infrastructure",
             layerList: [
               { Name: "Infra_ROAD_MULTILANE", Layer: "Road Network" },
               { Name: "Infra_RAIL", Layer: "Railway Network" },
              //  { Name: "Infra_Airport", Layer: "Airport Points" }
             ]
           },
             {
             title: "Agro Crops Production",
             layerList: [
               { Name: "Agro_Crops_Production_districtwise_cotton_production", Layer: "Cotton" },
               { Name: "Agro_Crops_Production_districtwise_potato_production", Layer: "Potato" },
               { Name: "Agro_Crops_Production_districtwise_maize_production", Layer: "Maize" },
               { Name: "Agro_Crops_Production_districtwise_sugarcane_production", Layer: "Sugarcane" },
               { Name: "Agro_Crops_Production_districtwise_chickpea_production", Layer: "Chickpea" },
               { Name: "Agro_Crops_Production_districtwise_pigeonpea_production", Layer: "Pigeonpea" },
               { Name: "Agro_Crops_Production_districtwise_groundnut_production", Layer: "Groundnut" },
               { Name: "Agro_Crops_Production_districtwise_wheat_production", Layer: "Wheat" },
               { Name: "Agro_Crops_Production_districtwise_rice_production", Layer: "Rice" }
             ]
           },
          //  {
          //    title: "Agro Crops Suitability & Potential Productivity",
          //    layerList: [
          //      { Name: "Agro_Crops_cotton_suitable_potential_working_productivity", Layer: "Cotton Suitability & Productivity" },
          //      { Name: "Agro_Crops_potato_suitable_potential_working_productivity", Layer: "Potato Suitability & Productivity" },
          //      { Name: "Agro_Crops_sugarcane_suitable_potential_working_productivity", Layer: "Sugarcane Suitability & Productivity" },
          //      { Name: "Agro_Crops_maize_suitable_potential_working_productivity", Layer: "Maize Suitability & Productivity" },
          //      { Name: "Agro_Crops_chickpea_suitable_potential_working_productivity", Layer: "Chickpea Suitability & Productivity" },
          //      { Name: "Agro_Crops_pigeonpea_suitable_potential_working_productivity", Layer: "Pigeonpea Suitability & Productivity" },
          //      { Name: "Agro_Crops_groundnut_suitable_potential_working_productivity", Layer: "Groundnut Suitability & Productivity" },
          //      { Name: "Agro_Crops_mustard_suitable_potential_working_productivity", Layer: "Mustard Suitability & Productivity" },
          //      { Name: "Agro_Crops_wheat_suitable_potential_working_productivity", Layer: "Wheat Suitability & Productivity" },
          //      { Name: "Agro_Crops_rice_suitable_potential_working_productivity", Layer: "Rice Suitability & Productivity" },
          //      {Name:"Haryana_Rabi_Wheat_2022_2023" , Layer: "Haryana Rabi Wheat" }
          //    ]
          //  },
  //   {
  //    title: "Aravali Range old",
  //    layerList: [
  //      { Name: "AGWL_tiff_DEM", Layer: "DEM" },
  //      { Name: "AGWL_tiff_Aspect", Layer: "Aspect" },
  //      { Name: "AGWL_tiff_color_relief", Layer: "Hillshade relief (Color)" },
  //      { Name: "AGWL_tiff_color_hillshade", Layer: "Hillshade" },
  //      { Name: "AGWL_tiff_Slope", Layer: "Slope" },
  //      { Name: "AGWL_tiff_Elevation", Layer: "Elevation" },
  //      { Name: "AGWL_tiff_mining", Layer: "Mining" },
  //      { Name: "LULC_Arawali", Layer: "Land Use Land Cover (LULC)" },
  //      { Name: "Aravali_soil_type", Layer: "Soil Type" },
       
  //      // ✅ Newly added layers
  //      { Name: "Aravali_leadZink", Layer: "Lead-Zinc Deposits" },
  //      { Name: "Baryte_deposit", Layer: "Baryte Deposits" },
  //      { Name: "coper1", Layer: "Copper Deposits" },
  //      {Name:"Aravali_hydro", Layer: "Hydrogeology" },
  //      {Name:"Arvali_Carbon", Layer: "Carbon" },
  //      {Name:"Envapotranspiration_MODIS", Layer: "Evapotranspiration" }
  //    ]
  //  }
  //  ,
  
  
  
  
  {
        title: "Ground Water",
        layerList: [
          { Name: "GW_Aquifer_System_Aquifer_type", Layer: "Aquifer Types" },
          { Name: "GW_Aquifer_System_yield", Layer: "Yield" },
          { Name: "GW_DISTRICT_WM_PROJANDD_Net_Groundwater_Category_Available_2016", Layer: "Net Groundwater Availability" },
          { Name: "GW_Block_Categorization_Status_2020", Layer: "Block Categorization - Status" },
        ]
      },
      {
        title: "Surface Water",
        layerList: [
          { Name: "SW_Rivers", Layer: "Major Rivers" },
          { Name: "India_Dams", Layer: "Dams" },
          { Name: "SW_BASELINE_WATER_STRESS_Water_Risk_Index", Layer: "Baseline Water Stress - Water Risk Index" },
          { Name: "GW_CWCSUBBASIN_main_basins", Layer: "Main Basins" },
          { Name: "SW_AVAILABILITY_INDEX_2016", Layer: "Surface Water Availability Index" }
        ]
      },
      {
        title: "Biodiversity",
        layerList: [
          { Name: "ProtectedArea_Aravli", Layer: "Protected Areas" },
          { Name: "SacredGroves", Layer: "Sacred Groves" },
          { Name: "Important Bird and Biodiversity Areas", Layer: "Important Bird and Biodiversity Areas" },
          { Name: "Population_data", Layer: "Population" }
        ]
      },
      {
        title: "Climate",
        layerList: [
          { Name: "Envapotranspiration_MODIS", Layer: "Evapotranspiration" },
          { Name: "AvgTemp_Celsius", Layer: "Temperature" },
          { Name: "india_prec", Layer: "Precipitation" }
        ]
      },
      {
        title: "Threat",
        layerList: [
          { Name: "Fire_Data", Layer: "Fire" }
        ]
      },
      {
        title: "Livestock",
        layerList: [
          { Name: "view_livestock_cattle", Layer: "Cattle" },
          { Name: "view_livestock_buffalo", Layer: "Buffalo" },
          { Name: "view_livestock_sheep", Layer: "Sheep" },
          { Name: "view_livestock_goat", Layer: "Goat" },
          { Name: "view_livestock_horse", Layer: "Horse" },
          { Name: "view_livestock_pony", Layer: "Pony" },
          { Name: "view_livestock_mule", Layer: "Mule" },
          { Name: "view_livestock_donkey", Layer: "Donkey" },
          { Name: "view_livestock_camel", Layer: "Camel" },
          { Name: "view_livestock_pig", Layer: "Pig" },
          { Name: "view_livestock_total_poultry", Layer: "Total Poultry" }
        ]
      },
      {
        title: "Intervention Points",
        layerList: [
              { Name: "Intervention sites_9_april_2025_BOTH_Aravali", Layer: "Haryana Land and Water Intervention points" },
          { Name: "Intervention sites_9_april_2025_LAND_Aravli", Layer: "Haryana Land Intervention points" },
          { Name: "Intervention_site_9_april_2025_waterbody_Aravali", Layer: "Haryana Water Intervention points" }
        ]
      },
  //          {
  //            title: "Ground Water",
  //            layerList: [
  //              { Name: "GW_Aquifer_System_Aquifer_type", Layer: "Aquifer Types" },
  //              { Name: "GW_Aquifer_System_Aquifers", Layer: "Aquifers" },
  //              { Name: "GW_Aquifer_System_yield", Layer: "Yield" },
  //              { Name: "GW_BASIN_CWC", Layer: "Ground Water Basin - Central Water Commission (CWC)" },
  //              { Name: "GW_Block_Categorization_Fluoride", Layer: "Block Categorization - Fluoride Presence" },
  //              { Name: "GW_Block_Categorization_Gw_Level_Category", Layer: "Block Categorization - Groundwater Level Category" },
            
  //              { Name: "GW_Block_Categorization_Status_2020", Layer: "Block Categorization - Status" },
  //              { Name: "GW_Block_Categorization_Arsenic_Presence", Layer: "Block Categorization - Arsenic Presence" },
  //              { Name: "GW_Block_Categorization_Salinity_Presence", Layer: "Block Categorization - Salinity Presence" },
          
  //              { Name: "GW_DISTRICT_WM_PROJANDD_Annual_Recharge", Layer: "District Water Management - Annual Groundwater Recharge" },
  //              { Name: "GW_DISTRICT_WM_PROJANDD_Annual_Report", Layer: "District Water Management - Annual Groundwater Report" },
  //              { Name: "GW_DISTRICT_WM_PROJANDD_Domestic_Index", Layer: "District Water Management - Domestic Groundwater Index" },
  //              { Name: "GW_DISTRICT_WM_PROJANDD_Net_Current_Recharge", Layer: "District Water Management - Net Current Groundwater Recharge" },
  //              { Name: "GW_DISTRICT_WM_PROJANDD_Projected_Demend", Layer: "District Water Management - Projected Groundwater Demand" },
  //              { Name: "GW_DISTRICT_WM_PROJANDD_Recharge_Availability_Category", Layer: "District Water Management - Recharge Availability Category" },
  //              { Name: "GW_DISTRICT_WM_PROJANDD_Net_Groundwater_Category_Available_2016", Layer: "Net Groundwater Availability" },
  //              { Name: "GW_DISTRICT_WM_PROJANDD_Net_Groundwater_Category", Layer: "District Water Management - Net Groundwater Availability Category" },
              
  //              { Name: "GW_DISTRICT_WM_PROJANDD_Flood_Recharge", Layer: "District Water Management - Flood Groundwater Recharge" },
  //              { Name: "GW_DISTRICT_WM_PROJANDD_Net_Infiltration_Recharge", Layer: "District Water Management - Net Infiltration Groundwater Recharge" },
  //              { Name: "GW_DISTRICT_WM_PROJANDD_Irrigation_Recharge", Layer: "District Water Management - Irrigation Groundwater Recharge" }
  //            ]
  //          },
  //          {
  //            title: "Surface Water",
  //            layerList: [
  //              { Name: "SW_BASELINE_WATER_STRESS_Water_Stress_score_of_seasonal_variabi", Layer: "Baseline Water Stress - Seasonal Variability Score" },
  //              { Name: "SW_BASELINE_WATER_STRESS_Historic_Flood_Occurrence", Layer: "Baseline Water Stress - Historic Flood Occurrence" },
  //              { Name: "SW_BASELINE_WATER_STRESS_Drought _Occurrence", Layer: "Baseline Water Stress - Drought Occurrence" },
  //              { Name: "SW_BASELINE_WATER_STRESS_Water_Storage", Layer: "Baseline Water Stress - Water Storage" },
  //              { Name: "SW_BASELINE_WATER_STRESS_Baseline_Threat", Layer: "Baseline Water Stress - Overall Threat" },
  //              { Name: "SW_Coast_Surge_Data_final", Layer: "Coastal Surge Data" },
  //              { Name: "SW_SURFACE_WATER_AVAILABILITY", Layer: "Surface Water Availability Zones" },
  //                   { Name: "GW_CWCSUBBASIN_main_basins", Layer: "Main Basins" },
  //              { Name: "GW_CWCSUBBASIN_main_sub_basins", Layer: "CWC Sub-Basin - Main Sub-Basins" },
  //              { Name: "SW_Rivers", Layer: "Major Rivers" },
  //              { Name: "SW_National_Development_Classification_Qualitative_Total_urban_", Layer: "National Dev. Classification - Total Urban Population" },
  //              { Name: "SW_National_Development_Classification_Qualitative_Total_Rural_", Layer: "National Dev. Classification - Total Rural Population" },
  //              { Name: "SW_Link_All", Layer: "Water Link Infrastructure" },
  //              { Name: "SW_BASELINE_WATER_STRESS_Water_Risk_Index", Layer: "Baseline Water Stress - Water Risk Index" },
  //              { Name: "SW_Drought", Layer: "Drought-Prone Areas" },
  //              { Name: "SW_BASELINE_WATER_STRESS_Annual_water_withdrawn", Layer: "Baseline Water Stress - Annual Water Withdrawn" },
  //              { Name: "SW_AVAILABILITY_INDEX_2016", Layer: "Surface Water Availability Index " },
  //              { Name: "SW_National_Development_Classification", Layer: "National Development Classification" },
  //              { Name: "SW_National_Development_Index", Layer: "National Development Index" },
  //              { Name:"SW_Watershed", Layer: "Watershed Areas/Drainage pattern" },
  //              { Name:"India_Dams", Layer: "Dams" },
  //              {Name:"Env_Reservoir_Region" , Layer: "Reservoir Regions" }
  //            ]
  //          },
  //          {
  //            title: "Forest Cover ",
  //            layerList: [
  //              { Name: "Agri_State_ForestFSI_Very_Dense_Forest(2019)", Layer: "Very Dense Forest Cover " },
  //              { Name: "Agri_State_ForestFSI_Moderately_Dense_Forest(2019)", Layer: "Moderately Dense Forest Cover " },
  //              { Name: "Agri_State_ForestFSI_open_Forest(2019)", Layer: "Open Forest Cover " },
  //              { Name: "Agri_State_ForestFSI_Scrub_Area(2019)", Layer: "Scrub Area " },
  //              { Name: "Agri_State_ForestFSI_Tree_Cover(2019)", Layer: "Tree Cover " }
  //            ]
  //          },
  //          {
  //   "title": "Livestock",
  //   "layerList": [
  //     { "Name": "view_livestock_cattle", "Layer": "Cattle" },
  //     { "Name": "view_livestock_buffalo", "Layer": "Buffalo" },
  //     { "Name": "view_livestock_sheep", "Layer": "Sheep" },
  //     { "Name": "view_livestock_goat", "Layer": "Goat" },
  //     { "Name": "view_livestock_horse", "Layer": "Horse" },
  //     { "Name": "view_livestock_pony", "Layer": "Pony" },
  //     { "Name": "view_livestock_mule", "Layer": "Mule" },
  //     { "Name": "view_livestock_donkey", "Layer": "Donkey" },
  //     { "Name": "view_livestock_camel", "Layer": "Camel" },
  //     { "Name": "view_livestock_pig", "Layer": "Pig" },
  //     { "Name": "view_livestock_total_poultry", "Layer": "Total Poultry" }
  //   ]
  // }
  // ,
  //           {
  //   "title": "Climate",
  //  "layerList": [
  //     { "Name": "Envapotranspiration_MODIS", "Layer": "Evapotranspiration" },
  //     { "Name": "AvgTemp_Celsius", "Layer": " Temperature" },
     
  //     { "Name": "india_prec", "Layer": "Precipitation" }
  //   ]
  // }
  
  // , {
  //   "title": "Threat",
  //   "layerList": [
  //     { "Name": "Fire_Data", "Layer": "Fire" }
  //   ]
  // },
  
  //          {
  //            title: "Biodiversity",
  //            layerList: [
  //              { Name: "India_biogeographic_zones", Layer: "Biogeographic Zones of India" },
  //             // //  { Name: "India_biogeographic_Province", Layer: "Biogeographic Provinces of India" },
  //             // //  { Name: "Biodiversity_india_terrestrial_ecoregions", Layer: "India Terrestrial Ecoregions" },
  //             // //  { Name: "Biodiversity_state_protect", Layer: "State-wise Protected Areas" },
  //              { Name: "ProtectedArea_Aravli", Layer: "Protected Areas" },
  //             //  { Name:"Global Critical Habitat Screening Layer UNEP-WCMC" , Layer:"biodiversity habitation zones"},
  //              {Name:"SacredGrovesinRajasthan" , Layer: "Sacred Groves in Rajasthan" },
  //               {Name:"Arawali_location" , Layer: "Sacred Groves" },
  //               {Name:"SacredGroves" , Layer: "Sacred Groves" },
  //               {Name:"Population_data",Layer:"Population"},
  //              {Name:"Important Bird and Biodiversity Areas",Layer:"Important Bird and Biodiversity Areas"}
  //            ]
  //          },
  //          {
  //            title: "Agro-Climatic and Agro-Ecological Zones",
  //            layerList: [
  //              { Name: "Agro_Climatic_Regions_regions_name", Layer: "Agro-Climatic Zones" },
  //              { Name: "Agro_Climatic_Regions_soil_type", Layer: "Agro-Climatic Zones - Soil Type" },
  //              { Name: "Agro_Climatic_Regions_major_crops", Layer: "Agro-Climatic Zones - Major Crops" },
  //              { Name: "Agro_Climatic_Regions_avg_annual_rainfall", Layer: "Agro-Climatic Zones - Average Annual Rainfall" },
  //              { Name: "Agro_Ecological_SubRegions_new_soil_type", Layer: "Agro-Ecological Sub-Regions - Soil Type" },
  //              { Name: "Agro_Ecological_SubRegions_new_climate", Layer: "Agro-Ecological Sub-Regions - Climate Type" }
  //            ]
  //          },
  //          {
  //            title: "Environment",
  //            layerList: [
  //              { Name: "Env_Annual_Rainfall_Rainfall_Days", Layer: "Annual Rainfall - Rainfall Days" },
  //              { Name: "Env_Annual_Rainfall_Area_Layer", Layer: "Annual Rainfall - Area Layer" },
  //              { Name: "Env_IMD_Station", Layer: "IMD Weather Stations" },
  //              { Name: "Env_iw_reservoir_centroid", Layer: "Reservoir Centroids (Inland Water)" },
  //              { Name: "Env_MeteorologicalSubDivisions_Annual_Rainfall_mm", Layer: "Meteorological Sub-Divisions - Annual Rainfall (mm)" },
  //              { Name: "Env_Siesmic_zones", Layer: "Seismic Hazard Zones" },
  //              { Name: "Env_Siesmic_zones_Seismic_Intensity", Layer: "Seismic Intensity Zones" },
  //              { Name: "GWR_SOD_DT2017_Status_of_Degradation", Layer: "Status of Degradation " },
  //                  {Name:"population_state" , Layer: "Population by State"}
  //            ]
  //          },
  //          {
  //           title:"Intervention points",
  //           layerList:[
  //             {Name:"Intervention",Layer:"Haryana Intervention points"},
  //              {Name:"Intervention_water",Layer:"Haryana Water Intervention points"}
  //           ]
  //          }
         ]}

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

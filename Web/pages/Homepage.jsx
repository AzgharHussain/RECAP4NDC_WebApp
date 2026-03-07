


import React, { useState, useEffect, useRef } from "react";
import { useNavigate ,NavLink} from "react-router-dom";
import "../App.css";
import { useLanguage } from "../context/LanguageContext";
import "./Login.css";
import axios from "axios";
import { API_BASE_URL } from '../config';
import "./Homepage.css";

// === Images ===
import brand from "../assets/logo-giz.png";
import backImage from "../assets/G2.jpg";
import leftLogos from "../assets/Logo.png";
import Eyeclose from "../assets/Eyeclose.png";
import user from "../assets/user.png";

import "../layouts/DashboardLayout.css";

import gujaratlogo from "../assets/FOREST DEPT.jpg";
import Moef from "../assets/Moef.jpg";
import giz from "../assets/giz.png";
import recap4NDC from "../assets/RE.png";

import Geospacial from "../assets/Geospacial.png";
import Vegetation from "../assets/vegetation.jpg";
import Incident from "../assets/incident-monitoring.png";
import forestmonitoring from "../assets/forest-m.png";
import pm from "../assets/p-m.png";
import fm from "../assets/f-m.png";
import nv from "../assets/n-v.png";
import gisfylogo from "../assets/GISFY Main LOGO.png";
import cb from "../assets/cb.png";
import curve from "../assets/curve.png";


const Homepage = () => {

  const cards = [
    {
      title: "Geospatial Forest Monitoring Map",
      img: Geospacial,
      desc: "Interactive WebGIS interface for exploring forest cover changes, administrative boundaries, working plan areas, and field patrol routes across Gujarat.",
      desc1: "The GeoServer integration publishes spatial layers including beat boundaries, patrol routes, and vegetation datasets for visualization and analysis."
    },
    {
      title: " PATROLLING MONITORING",
      img: pm,
      desc: "Real-time monitoring of field patrol operations including route coverage, patrol frequency, officer participation, and patrol utilization across forest divisions.",
      desc1: "Patrolling integration captures GPS-based field movements and activity logs for monitoring and enforcement planning."
    },
    {
      title: "INCIDENT & OBSERVATION MONITORING",
      img: Incident,
      desc: "Overview of field-reported incidents including illegal logging, encroachment, wildlife threats, and ecological observations submitted through the mobile application with geo-tagged multimedia evidenc.",
      desc1: "The patrolling module integrates field observations and incident reporting workflows into the monitoring platform."
    },
    {
      title: "Forest Monitoring Insights",
      img: fm,
      desc: "Integrated analytics combining NDVI vegetation trends, patrolling coverage, incident distribution, and working plan status to support restoration planning, enforcement prioritization, and forest protection strategies.",
      desc1: "The application layer delivers analytical dashboards transforming integrated datasets into decision-support insights."
    },
    {
      title: "NDVI VEGETATION MONITORING",
      img: nv,
      desc: "Satellite-based NDVI analysis visualizing vegetation density, degradation patterns, and restoration progress across forest coupes using Sentinel-2 imagery and temporal analysis.",
      desc1: "The NDVI module integrates satellite vegetation indicators for forest health and climate monitoring."
    },
    {
      title: "COUPE MONITORING",
      img: cb,
      desc: "Monitoring of working plan areas and coupe-level observations including uploaded spatial boundaries and field-reported ecological conditions such as tree disease or degradation.",
      desc1: "Users can visualize coupe boundaries and record observations linked to forest management hierarchy."
    }
  ];

  return (
    <>
      {/* HEADER (UNCHANGED) */}
 <header id="header" style={{height:"13vh"}} >
                 <div className="newcontainer">
                     <div className="headAssets" style={{display:'flex',justifyContent:'space-between', alignItems:'center', gap:'10px',   padding:'2px',width:'97%'}}>
                         <div className="logo" style={{display:'flex', alignItems:'center', gap:'10px',paddingLeft:'35px'}}>
                             {/* <a href="indexs.aspx">
                                 </a> */}
                                 <img src={gujaratlogo} alt="logo picture" style={{width:'50px'}}></img>
                       
                         <div className="portal-header">
                             <div className="icon" aria-hidden="true"></div>
                             <h2 style={{letterSpacing:"2px"}}><b style={{fontFamily: '"arial', fontWeight: 700,}}>FOREST PATROLLING & MONITORING SYSTEM</b></h2>
                         </div>  </div>
                       
                         <div className="ministryLogo" style={{display:'flex', alignItems:'center', gap:'23px', paddingRight:'45px'}}>
                             <div className="l_1">
                                 {/* <a href="https://moef.gov.in/" target="_blank">
                                     </a> */}
                                     <img src={Moef} alt="picture" style={{width:'120px'}}></img>
                             </div>
                             <div className="l_2">
                                 {/* <a href="https://www.giz.de/de/html/index.html" target="_blank">
                                     </a> */}
                                     <img src={giz} alt="giz logo" style={{width:'160px'}}></img>
                             </div>
                             <div className="l_3">
                                 {/* <a href="#!" target="_blank">
                                     </a> */}
                                     <img src={recap4NDC} alt="recap4NDC" style={{ height:'60px'}}></img>
                             </div>
                             {/* <div>
 <button
               className="logout-btn"
               onClick={handleLogout}
             >
               {text[language].logout}
             </button>
                             </div> */}
                             
                         </div>
                     </div>
                     <div style={{textAlign: 'center', paddingTop: '20px'}}>
                    <a href="/login" style={{ color: 'white'}}>Login</a>
                 </div>
                 </div>
                 
             </header>

      {/* HERO SECTION */}
{/* HERO SECTION */}
<section className="hero-section">
  <div className="hero-overlay">
    <h1>RECAP4NDC Forest Patrolling </h1>
    <h1>Monitoring Platform</h1>

    <p>
      The Forest Patrolling & Monitoring System developed under the RECAP4NDC initiative provides a unified web-based monitoring environment integrating satellite-derived vegetation indicators, field patrolling data, incident reporting, and working plan spatial boundaries. The platform enables Gujarat Forest Department officials to visualize forest conditions, monitor patrol coverage, track incidents, and assess restoration progress through interactive geospatial dashboards and analytics tools.
</p><br></br>
<p>
The WebGIS dashboard integrates spatial data services and field intelligence for operational forest management.
    </p>

    
  </div>

  <div className="hero-overlay2">
<p>Implemented by: Gujarat Forest Department</p>
    <p>Supported by: GIZ | ICIMOD | IKI | IUCN | TERI</p>
    <p>Programme: RECAP4NDC – Restore to Prosper</p>
</div >
</section>



{/* WAVE */}
{/* <div className="green-wave"></div> */}


{/* FOREST OVERVIEW */}
<section className="overview-section">
<div className="overview-header">
                                 <h2 className="overview-heading">Forest Monitoring Overview</h2>
  <p>The application dashboards transform integrated spatial and field data into actionable monitoring indicators.</p>

</div>
 
  <div className="overview-container">

    <div className="overview-image">
      <img src={forestmonitoring} alt="forest patrol"/>
    </div>

    <div className="overview-text-grid">

      <div className="overview-item">
        <h4>Forest Cover Change Alerts</h4>
        <p>Satellite-derived vegetation change hotspots detected using NDVI-based temporal analysis of forest condition.</p>
      </div>

      <div className="overview-item">
        <h4>Total Patrols Conducted</h4>
        <p>Field patrol activities captured through mobile patrolling integration and synchronized to the web dashboard.</p>
      </div>

      <div className="overview-item">
        <h4>Incidents Reported</h4>
        <p>Geo-tagged incidents such as encroachment, illegal logging, or forest degradation reported during patrol operations.</p>
      </div>

      <div className="overview-item">
        <h4>Active Monitoring Coupes</h4>
        <p>Working plan coupes currently under vegetation monitoring and restoration assessment.</p>
      </div>

    </div>

  </div>

</section>


{/* MODULE CARDS */}
<section className="modules-section">

  <div className="modules-grid">

    {cards.map((card,index)=>(
      <div className="module-card" key={index}>

        <div className="module-image">
          {card.img && <img src={card.img} alt={card.title}/>}
        </div>
        <div className="module-title">
            <h3>{card.title}</h3>

        <p>{card.desc}</p>
        <p>{card.desc1}</p>
        </div>
        

      </div>
    ))}

  </div>

</section>



{/* FOOTER */}
<footer className="footer">
    <p> © 2026 Gujarat Forest Department | RECAP4NDC Initiative    </p>
    <img src={gisfylogo} alt="logo picture" style={{width:'200px'}}></img>
</footer>

    </>
  );
};

export default Homepage;
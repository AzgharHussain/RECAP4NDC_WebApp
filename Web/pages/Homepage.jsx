


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

import gujaratlogo from "../assets/FOREST DEPT.jpg";
import Moef from "../assets/Moef.jpg";
import giz from "../assets/giz.png";
import recap4NDC from "../assets/RE.png";

import Geospacial from "../assets/Geospacial.png";
import Vegetation from "../assets/vegetation.jpg";
import Incident from "../assets/incident-monitoring.png";
import forestmonitoring from "../assets/p1.jpg";
import pm from "../assets/p-m.png";
import fm from "../assets/f-m.png";
import nv from "../assets/n-v.png";
import gisfylogo from "../assets/gisfylogo.png";
import cb from "../assets/cb.png";
import curve from "../assets/curve.png";


const FAQ_CATEGORIES = [
  { id: 'general',         label: 'General & Setup' },
  { id: 'forest-cover',   label: 'Forest Cover Module' },
  { id: 'patrolling',     label: 'Patrolling Module' },
  { id: 'coupe',          label: 'Coupe Module' },
  { id: 'activities',     label: 'Activities & Profile' },
  { id: 'web',            label: 'Web Application' },
  { id: 'troubleshooting', label: 'Troubleshooting & Logout' },
];

const FAQ_DATA = [
  { id: 1,  category: 'general',         q: 'What is the RECAP4NDC Forest Patrolling & Monitoring System?', a: "It's a mobile and web-based application designed for the forest department to monitor forest areas, track vegetation changes using NDVI, and manage patrolling activities. It helps in forest protection, management, and evidence-based decision-making." },
  { id: 2,  category: 'general',         q: 'How do I install the mobile application?', a: 'You need to install the "Forest Patrolling & Monitoring Mobile App" from the Google Play Store. Once installed, open the app to begin the setup process.' },
  { id: 3,  category: 'general',         q: 'What languages does the application support?', a: 'The application supports two languages: English and Gujarati. You can select your preferred language on the initial screen. You can also switch languages later from the "Profile" section.' },
  { id: 4,  category: 'general',         q: 'What permissions does the app require?', a: 'The app requires several permissions to function correctly:', list: ['Notification Permission: To receive alerts and updates.', 'Location Permission: To track your patrolling routes and pinpoint your location on the map. It is recommended to select "Allow While Using the App."', 'Camera and Audio Permission: To capture photos during patrolling and field visits.'] },
  { id: 5,  category: 'general',         q: 'How do I log in to the mobile application?', a: 'After selecting your language, you will be directed to the Login Page. You must enter your eGuj Username and Password and click the login button.' },
  { id: 6,  category: 'general',         q: 'What happens after I log in?', a: 'The application will start "fetching data." Please wait until the loading reaches 100%. You will then be asked to select your administrative details (like Division, Range, Beat, and Village). After that, the map will zoom into your designated area, and you will enter the main application interface.' },
  { id: 7,  category: 'forest-cover',   q: 'What is the "Forest Cover Change" module?', a: 'This module shows monthly NDVI (Normalized Difference Vegetation Index) changes. It helps officers identify areas where forest cover has been lost (degradation) or improved.' },
  { id: 8,  category: 'forest-cover',   q: 'How do I check for forest cover changes?', a: 'From the main dashboard, click the "Forest Cover" module. You can then select a month. The system will compare the selected month with the previous month. Any areas that have lost vegetation will be highlighted with red boxes on the map.' },
  { id: 9,  category: 'forest-cover',   q: 'What should I do if I see a red box indicating NDVI loss?', a: 'Click on the red box. A dialog box will appear with the details. You have two options:', list: ['If the change is valid: Click the "Update Status" button to confirm it.', 'If the change is NOT valid: Turn the "Negative NDVI Status" OFF, write a remark in the notes box, capture photos of the actual site, and upload them before clicking "Update Status."'] },
  { id: 10, category: 'forest-cover',   q: 'What are the different map tools available?', a: 'On the map screen, you can use the following tools:', list: ['Map Type Button: Switch between a standard map view and a Satellite view.', 'Legend: Shows what different colors on the map mean.', 'Current Location Button: Centers the map on your current GPS location.'] },
  { id: 11, category: 'patrolling',     q: 'How do I start a patrolling session?', a: 'Navigate to the "Patrolling" module at the bottom of the screen and tap the "Start" button.' },
  { id: 12, category: 'patrolling',     q: 'What are the different patrolling types?', a: 'You can select from three types:', list: ['Day Patrolling', 'Night Patrolling', 'Beat Checking'], extra: 'The system will suggest a type based on the time of day, but you can manually change it from the dropdown menu.' },
  { id: 13, category: 'patrolling',     q: 'What information do I need to provide before starting a patrol?', a: 'You need to:', list: ['Select the Patrolling Type.', 'Enter the Number of Staff Members participating.', 'Take a mandatory photo at the starting point.'] },
  { id: 14, category: 'patrolling',     q: 'What information is displayed during a patrol?', a: 'While you are on patrol, the system tracks and displays your:', list: ['Distance travelled in real-time.', 'Patrol time.', 'Route on the map.'] },
  { id: 15, category: 'patrolling',     q: 'How do I capture photos during the patrol?', a: 'You can tap the Camera Button located on the bottom-right side of the screen. You can capture multiple photos at different points during your patrol.' },
  { id: 16, category: 'patrolling',     q: 'How do I stop and complete a patrolling session?', a: "When your patrol is finished, press the Stop button. The app will require you to take a mandatory ending photo. Once submitted, the patrol data (distance, time, photos, route) will be saved locally on your device." },
  { id: 17, category: 'patrolling',     q: 'What is "Data Sync"?', a: '"Data Sync" is the process of uploading your saved patrol data to the central server. You must have an active internet connection for this. It\'s recommended to sync your data immediately after completing a patrol to validate it.' },
  { id: 18, category: 'patrolling',     q: 'Where can I view my old patrolling records?', a: 'You can view your history by going to the Patrolling Module and selecting "Patrolling Record." You can also search for specific records using the Patrol ID.' },
  { id: 19, category: 'coupe',          q: 'What is the "Coupe" module used for?', a: 'This module displays the boundaries of forest coupes (a forest compartment or area of work) on the map. It helps forest guards identify the exact location of a specific coupe.' },
  { id: 20, category: 'coupe',          q: 'How do I get directions to a specific coupe?', a: 'Follow these steps:', list: ['Tap the "Coupe" button.', 'A dialog box will appear showing a list of "Coupe Numbers." Select the one you need.', 'The system will then calculate and display the route from your current location to the selected coupe, along with the distance in kilometers.'] },
  { id: 21, category: 'activities',     q: 'What is the "Activities" section for?', a: 'This section is for general record-keeping. You can:', list: ['Field Visit: Record field visits by adding photos and notes.', "Saved Photos: View all the photos you have captured during field visits. You can also save these photos to your phone's gallery."] },
  { id: 22, category: 'activities',     q: 'For how long are my photos and data stored in the app?', a: 'Photos and other data saved within the app are stored for 30 days, after which they are automatically and permanently deleted.' },
  { id: 23, category: 'activities',     q: 'How do I update my profile or administrative details?', a: 'Go to the "Profile Section." Here, you can view your information and change details like your Village, Round, Range, or Beat. The options available depend on your user role. The system will update the map data accordingly.' },
  { id: 24, category: 'web',            q: 'What is the web application used for?', a: 'The web application is a Geo-Dashboard for supervisors and administrators. It allows for:', list: ['Centralized Monitoring: Viewing all patrolling data and forest cover changes on a larger screen.', 'Data Analysis: Generating reports and analyzing patrolling performance.', 'Explore Data: Viewing detailed administrative layers (State, Circle, Division, Range, Beat, Village).', 'NDVI Dashboard: Analyzing vegetation health across larger areas like a whole state or division.'] },
  { id: 25, category: 'web',            q: 'What kind of reports can I generate from the web app?', a: 'You can generate detailed reports, including:', list: ['Patrolling Logs: A detailed table of all patrols with filters.', 'Officer Patrol Summary: A summarized report on officer performance and patrol distribution.', 'NDVI Reports: Analytical results showing degraded and afforested areas, division-wise breakdowns, and geotagged field records.'] },
  { id: 26, category: 'troubleshooting', q: 'How do I log out of the mobile application?', a: 'Click the Logout button in the Profile section. This will redirect you to the Login Screen.' },
];

const Homepage = () => {

  const cards = [
    {
      title: "GEOSPATIAL FOREST MONITORING MAP",
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
      desc: "Overview of field-reported incidents including illegal logging, encroachment, wildlife threats, and ecological observations submitted through the mobile application with geo-tagged multimedia evidence.",
      desc1: "The patrolling module integrates field observations and incident reporting workflows into the monitoring platform."
    },
    {
      title: "FOREST MONITORING INSIGHTS",
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

  const [activeFaqCat, setActiveFaqCat] = useState('general');
  const [openFaqId, setOpenFaqId] = useState(null);

  return (
    <>
      {/* HEADER (UNCHANGED) */}
 <header id="header" >
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
                                     <a href="/" ><img src={recap4NDC} alt="recap4NDC" style={{ height:'60px'}}></img></a>
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
<div style={{ 
  display: 'flex', 
  justifyContent: 'flex-end', 
  padding: '1rem 9rem',
}}>
  <a 
    href="/login" 
    style={{ 
      color: 'white', 
      textDecoration: 'none',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontWeight: 500,
      padding: '1rem 1rem',
      borderRadius: '14px',
      transition: 'all 0.3s ease',
  backgroundImage: 'linear-gradient(180.29deg, #5CFFA9 0.25%, rgba(0, 146, 69, 0.8) 99.75%)'
    }}
    onMouseEnter={(e) => {
      e.target.style.background = 'rgba(255, 255, 255, 0.2)';
    }}
    onMouseLeave={(e) => {
      e.target.style.background = 'linear-gradient(180.29deg, #5CFFA9 0.25%, rgba(0, 146, 69, 0.8) 99.75%)';
    }}
  >
    Launch App
  </a>
</div>
    
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



{/* FAQ SECTION */}
<section className="faq-section">
  <div className="faq-header">
    <h2 className="faq-heading">Frequently Asked Questions</h2>
    <p className="faq-subheading">These FAQs are organized by topic for easy reference.</p>
  </div>

  <div className="faq-categories">
    {FAQ_CATEGORIES.map(cat => (
      <button
        key={cat.id}
        className={`faq-cat-btn${activeFaqCat === cat.id ? ' faq-cat-btn--active' : ''}`}
        onClick={() => { setActiveFaqCat(cat.id); setOpenFaqId(null); }}
      >
        {cat.label}
        <span className="faq-cat-count">
          {FAQ_DATA.filter(f => f.category === cat.id).length}
        </span>
      </button>
    ))}
  </div>

  <div className="faq-list">
    {FAQ_DATA.filter(f => f.category === activeFaqCat).map(faq => (
      <div key={faq.id} className={`faq-item${openFaqId === faq.id ? ' faq-item--open' : ''}`}>
        <button
          className="faq-question"
          onClick={() => setOpenFaqId(openFaqId === faq.id ? null : faq.id)}
          aria-expanded={openFaqId === faq.id}
        >
          <span className="faq-q-num">Q{faq.id}</span>
          <span className="faq-q-text">{faq.q}</span>
          <span className="faq-chevron" aria-hidden="true">{openFaqId === faq.id ? '▲' : '▼'}</span>
        </button>
        <div className="faq-answer">
          <div className="faq-answer-inner">
            <p>{faq.a}</p>
            {faq.list && (
              <ul>
                {faq.list.map((item, i) => <li key={i}>{item}</li>)}
              </ul>
            )}
            {faq.extra && <p className="faq-extra">{faq.extra}</p>}
          </div>
        </div>
      </div>
    ))}
  </div>
</section>

{/* FOOTER */}
<footer className="footer" style={{color:'black',
        textAlign:'center',
        padding:'15px',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center'}}>
          <div>
        <p style={{display: 'flex',alignItems: 'center',gap: '6px' }}> © 2026 Gujarat Forest Department <img src={gujaratlogo} alt="logo picture" style={{width:'40px'}}></img> </p>

          </div>
        <div style={{display:'flex', alignItems:'center',gap: '6px'}}>
          <p>Powered by  </p>
          <a href="https://www.gisfy.co.in/" target="_blank" rel="noopener noreferrer">
            <img 
              src={gisfylogo} 
              alt="logo picture" 
              style={{ width: '100px', height: '40px' }} 
            />
          </a>
        </div>
      </footer>

    </>
  );
};

export default Homepage;

import React, { useState } from "react";
import "../App.css";
import { useLanguage } from "../context/LanguageContext";
import "./Login.css";
import "./Homepage.css";

// === Images ===
import gujaratlogo from "../assets/FOREST DEPT.jpg";
import Moef from "../assets/Moef.jpg";
import giz from "../assets/giz.png";
import recap4NDC from "../assets/re.png";

import Geospacial from "../assets/Geospacial.png";
import Incident from "../assets/incident-monitoring.png";
import pm from "../assets/p-m.png";
import fm from "../assets/f-m.png";
import nv from "../assets/n-v.png";
import gisfylogo from "../assets/Gisfylogo.png";
import cb from "../assets/cb.png";
import heroVideo from "../assets/download.mp4";
import forestmonitoring from "../assets/p1.jpg";

// === FAQ DATA (static, no language dependency) ===
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
  const { language, toggleLanguage } = useLanguage();

  // faqCategories must be INSIDE the component so `language` is accessible
  const faqCategories = [
    { id: 'general',         label: language === 'gu' ? 'સામાન્ય અને સેટઅપ' : 'General & Setup' },
    { id: 'forest-cover',   label: language === 'gu' ? 'વન આવરણ મોડ્યુલ' : 'Forest Cover Module' },
    { id: 'patrolling',     label: language === 'gu' ? 'પેટ્રોલિંગ મોડ્યુલ' : 'Patrolling Module' },
    { id: 'coupe',          label: language === 'gu' ? 'કૂપ મોડ્યુલ' : 'Coupe Module' },
    { id: 'activities',     label: language === 'gu' ? 'પ્રવૃત્તિઓ અને પ્રોફાઇલ' : 'Activities & Profile' },
    { id: 'web',            label: language === 'gu' ? 'વેબ એપ્લિકેશન' : 'Web Application' },
    { id: 'troubleshooting', label: language === 'gu' ? 'સમસ્યા નિવારણ અને લોગઆઉટ' : 'Troubleshooting & Logout' },
  ];

  const translations = {
    en: {
      headerTitle: "FOREST PATROLLING & MONITORING SYSTEM",
      heroTag: "Implemented by Gujarat Forest Department",
      heroTitle1: "Forest Patrolling",
      heroTitle2: "Monitoring Platform",
      heroDesc: "The Forest Patrolling & Monitoring System under the RECAP4NDC initiative integrates satellite-derived vegetation indicators, field patrolling data, incident reporting, and working plan spatial boundaries into a unified web-based monitoring environment. The WebGIS dashboard integrates spatial data services and geo-intelligence for operational forest management.",
      launchApp: "Launch App",
      overviewTitle: "Forest Monitoring",
      overviewTitleHighlight: "Overview",
      overviewSubtitle: "The application dashboards transform integrated spatial and field data into actionable monitoring indicators.",
      overview1: "Real-time Monitoring",
      overview1Desc: "Track forest health through integrated satellite and field data streams for proactive forest protection.",
      overview2: "Forest Intelligence",
      overview2Desc: "Data-driven analytics that reveal vegetation trends, patrol coverage, and restoration progress.",
      overview3: "Incident Management",
      overview3Desc: "Log, track, and respond to forest incidents with geo-tagged evidence and mobile field reports.",
      overview4: "Stakeholder Collaboration",
      overview4Desc: "Shared dashboards and reports enable coordinated action across departments and partners.",
      toolsLabel: "PLATFORM",
      toolsTitle1: "Comprehensive Tools for",
      toolsTitle2: "Forest Monitoring",
      faqTitle1: "Frequently Asked",
      faqTitle2: "Questions",
      faqSubtitle: "These FAQs are organized by topic for easy reference.",
      footerCopy: "© 2026 Gujarat Forest Department",
      footerPowered: "Powered by",
      langEn: "English",
      langGu: "ગુજ"
    },
    gu: {
      headerTitle: "વન પેટ્રોલિંગ અને મોનિટરિંગ સિસ્ટમ",
      heroTag: "ગુજરાત વન વિભાગ દ્વારા અમલમાં મૂકાયેલ",
      heroTitle1: "વન પેટ્રોલિંગ",
      heroTitle2: "મોનિટરિંગ પ્લેટફોર્મ",
      heroDesc: "RECAP4NDC પહેલ હેઠળ વન પેટ્રોલિંગ અને મોનિટરિંગ સિસ્ટમ ઉપગ્રહ-આધારિત વનસ્પતિ સૂચકાંક, ક્ષેત્ર પેટ્રોલિંગ ડેટા, ઘટના રિપોર્ટિંગ અને કામગીરી પ્લાન સ્પેશિયલ બાઉન્ડરીઝને એકીકૃત વેબ-આધારિત મોનિટરિંગ વાતાવરણમાં જોડે છે.",
      launchApp: "એપ શરૂ કરો",
      overviewTitle: "વન મોનિટરિંગ",
      overviewTitleHighlight: "અવલોકન",
      overviewSubtitle: "એપ્લિકેશન ડેશબોર્ડ સંકલિત સ્પેશિયલ અને ક્ષેત્ર ડેટાને કાર્યક્ષમ મોનિટરિંગ સૂચકાંકોમાં રૂપાંતરિત કરે છે.",
      overview1: "રિયલ-ટાઇમ મોનિટરિંગ",
      overview1Desc: "સંકલિત ઉપગ્રહ અને ક્ષેત્ર ડેટા સ્ટ્રીમ દ્વારા વન સ્વાસ્થ્ય ટ્રૅક કરો.",
      overview2: "વન બુદ્ધિ",
      overview2Desc: "ડેટા-આધારિત ઍનલિટિક્સ જે વનસ્પતિ વલણો, પેટ્રોલ કવરેજ અને પુનઃસ્થાપન પ્રગતિ દર્શાવે છે.",
      overview3: "ઘટના વ્યવસ્થાપન",
      overview3Desc: "જીઓ-ટૅગ કરેલ પુરાવા અને મોબાઇલ ક્ષેત્ર રિપોર્ટ સાથે વન ઘટનાઓ નોંધો, ટ્રૅક કરો અને જવાબ આપો.",
      overview4: "હિતધારક સહયોગ",
      overview4Desc: "સામૂહિક ડેશબોર્ડ અને રિપોર્ટ વિભાગો અને ભાગીદારો વચ્ચે સુસંગત કાર્યવાહી સક્ષમ બનાવે છે.",
      toolsLabel: "પ્લેટફોર્મ",
      toolsTitle1: "વન મોનિટરિંગ માટે",
      toolsTitle2: "વ્યાપક સાધનો",
      faqTitle1: "વારંવાર પૂછાતા",
      faqTitle2: "પ્રશ્નો",
      faqSubtitle: "આ FAQ વિષયો અનુસાર ગોઠવાયેલ છે સરળ સંદર્ભ માટે.",
      footerCopy: "© 2026 ગુજરાત વન વિભાગ",
      footerPowered: "Powered by",
      langEn: "English",
      langGu: "ગુજ"
    }
  };

  const t = translations[language];

  const cards = [
    {
      title: "GEOSPATIAL FOREST MONITORING MAP",
      img: Geospacial,
      desc: "Interactive WebGIS interface for exploring forest cover changes, administrative boundaries, working plan areas, and field patrol routes across Gujarat.",
    },
    {
      title: "PATROLLING MONITORING",
      img: pm,
      desc: "Real-time monitoring of field patrol operations including route coverage, patrol frequency, officer participation, and patrol utilization across forest divisions.",
    },
    {
      title: "INCIDENT & OBSERVATION MONITORING",
      img: Incident,
      desc: "Overview of field-reported incidents including illegal logging, encroachment, wildlife threats, and ecological observations submitted through the mobile application.",
    },
    {
      title: "FOREST MONITORING INSIGHTS",
      img: fm,
      desc: "Integrated analytics combining NDVI vegetation trends, patrolling coverage, incident distribution, and working plan status to support restoration planning.",
    },
    {
      title: "NDVI VEGETATION MONITORING",
      img: nv,
      desc: "Satellite-based NDVI analysis visualizing vegetation density, degradation patterns, and restoration progress across forest coupes using Sentinel-2 imagery.",
    },
    {
      title: "COUPE MONITORING",
      img: cb,
      desc: "Monitoring of working plan areas and coupe-level observations including uploaded spatial boundaries and field-reported ecological conditions.",
    }
  ];

  const [activeFaqCat, setActiveFaqCat] = useState('general');
  const [openFaqId, setOpenFaqId] = useState(null);

  return (
    <>
      {/* ===== HEADER ===== */}
      <header id="header">
        <div className="newcontainer">
          <div className="headAssets">
            {/* Left: Logo + Title */}
            <div className="logo">
              <img src={gujaratlogo} alt="Gujarat Forest Department logo" style={{ width: '50px' }} />
              <div className="portal-header">
                <h2><b>{t.headerTitle}</b></h2>
              </div>
            </div>

            {/* Right: Language selector + Ministry logos */}
            <div className="ministryLogo">
              <div className="header-lang-selector">
                <button
                  id="home-lang-en"
                  className={`header-lang-btn ${language === "en" ? "active" : ""}`}
                  onClick={() => toggleLanguage("en")}
                  title="English"
                >
                  {t.langEn}
                </button>
                <button
                  id="home-lang-gu"
                  className={`header-lang-btn ${language === "gu" ? "active" : ""}`}
                  onClick={() => toggleLanguage("gu")}
                  title="ગુજરાતી"
                >
                  {t.langGu}
                </button>
              </div>
              <div className="l_1">
                <img src={Moef} alt="Ministry of Environment, Forest and Climate Change" style={{ width: '120px' }} />
              </div>
              <div className="l_2">
                <img src={giz} alt="GIZ logo" style={{ width: '160px' }} />
              </div>
              <div className="l_3">
                <a href="/"><img src={recap4NDC} alt="RECAP4NDC" style={{ height: '60px' }} /></a>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ===== HERO SECTION — Full-width video background ===== */}
      <section className="hero-section-new" id="hero">
        <video
          src={heroVideo}
          className="hero-bg-video"
          autoPlay
          muted
          loop
          playsInline
          poster={forestmonitoring}
          aria-label="Forest Patrolling and Monitoring background video"
        />
        <div className="hero-bg-overlay" />
        <div className="hero-content hero-content--over-video">
          <div className="hero-left">
            <div className="hero-tag">
              <span className="hero-tag-dot">●</span>
              <span>{t.heroTag}</span>
            </div>
            <h1 className="hero-title">
              {t.heroTitle1}
              <br />
              <span className="hero-title-green">{t.heroTitle2}</span>
            </h1>
            <p className="hero-desc">{t.heroDesc}</p>
            <a href="/login" className="hero-cta" id="hero-launch-btn">
              {t.launchApp} →
            </a>
          </div>
        </div>
      </section>

      {/* ===== FOREST MONITORING OVERVIEW ===== */}
      <section className="overview-section-new" id="overview">
        <div className="section-header">
          <h2 className="section-title">
            {t.overviewTitle}
            <br />
            <span className="section-title-green">{t.overviewTitleHighlight}</span>
          </h2>
          <p className="section-subtitle">{t.overviewSubtitle}</p>
        </div>

        <div className="overview-grid">
          <div className="overview-card">
            <div className="overview-icon">📡</div>
            <h4>{t.overview1}</h4>
            <p>{t.overview1Desc}</p>
          </div>
          <div className="overview-card">
            <div className="overview-icon">🌿</div>
            <h4>{t.overview2}</h4>
            <p>{t.overview2Desc}</p>
          </div>
          <div className="overview-card">
            <div className="overview-icon">⚠️</div>
            <h4>{t.overview3}</h4>
            <p>{t.overview3Desc}</p>
          </div>
          <div className="overview-card">
            <div className="overview-icon">🤝</div>
            <h4>{t.overview4}</h4>
            <p>{t.overview4Desc}</p>
          </div>
        </div>
      </section>

      {/* ===== COMPREHENSIVE TOOLS ===== */}
      <section className="tools-section-new" id="tools">
        <div className="section-header">
          <p className="tools-label">{t.toolsLabel}</p>
          <h2 className="section-title">
            {t.toolsTitle1}
            <br />
            <span className="section-title-green">{t.toolsTitle2}</span>
          </h2>
        </div>

        <div className="tools-grid">
          {cards.map((card, index) => (
            <div className="tool-card" key={index}>
              <div className="tool-icon">
                {card.img && <img src={card.img} alt={card.title} />}
              </div>
              <div className="tool-card-body">
                <h4>{card.title}</h4>
                <p>{card.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ===== FAQ SECTION ===== */}
      <section className="faq-section" id="faq">
        <div className="faq-header">
          <h2 className="faq-heading">
            {t.faqTitle1}
            <br />
            <span className="faq-heading-green">{t.faqTitle2}</span>
          </h2>
          <p className="faq-subheading">{t.faqSubtitle}</p>
        </div>

        <div className="faq-categories">
          {faqCategories.map(cat => (
            <button
              key={cat.id}
              id={`faq-cat-${cat.id}`}
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
                id={`faq-q-${faq.id}`}
                onClick={() => setOpenFaqId(openFaqId === faq.id ? null : faq.id)}
                aria-expanded={openFaqId === faq.id}
              >
                <span className="faq-q-num">Q{faq.id}</span>
                <span className="faq-q-text">{faq.q}</span>
                <span className="faq-chevron" aria-hidden="true">{openFaqId === faq.id ? '▲' : '▼'}</span>
              </button>
              <div className="faq-answer" style={{ maxHeight: openFaqId === faq.id ? '500px' : '0' }}>
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

      {/* ===== FOOTER ===== */}
      <footer className="footer-new">
        <div className="footer-left">
          <img src={gujaratlogo} alt="Gujarat Forest Department" />
          <p>{t.footerCopy}</p>
        </div>
        <div className="footer-right">
          <p>{t.footerPowered}</p>
          <a href="https://www.gisfy.co.in/" target="_blank" rel="noopener noreferrer">
            <img src={gisfylogo} alt="GISFY" />
          </a>
        </div>
      </footer>
    </>
  );
};

export default Homepage;
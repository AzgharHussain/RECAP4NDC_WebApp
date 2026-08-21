
import React, { useState, useRef, useEffect } from "react";
import Cookies from "js-cookie";
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
import heroVideo from "../assets/homesectionvideo.mp4";
import { FiArrowRight, FiChevronUp, FiChevronDown, FiRadio, FiMap, FiAlertTriangle, FiUsers } from "react-icons/fi";

// === FAQ DATA (static, no language dependency) ===
// FAQ data is now language-aware — defined inside the component

const Homepage = () => {
  const { language, toggleLanguage } = useLanguage();

  // === Cookie consent ===
  const [showCookieBanner, setShowCookieBanner] = useState(false);

  useEffect(() => {
    const consent = Cookies.get('cookie-consent');
    if (!consent) {
      setShowCookieBanner(true);
    }
  }, []);

  const handleAcceptCookies = () => {
    Cookies.set('cookie-consent', 'accepted', { expires: 365, sameSite: 'Lax' });
    setShowCookieBanner(false);
  };

  const handleRejectCookies = () => {
    Cookies.set('cookie-consent', 'rejected', { expires: 90, sameSite: 'Lax' });
    // Clear any non-essential cookies
    const essentialCookies = ['cookie-consent', 'session', 'token', 'authToken'];
    document.cookie.split(';').forEach(c => {
      const name = c.split('=')[0].trim();
      if (!essentialCookies.includes(name)) {
        Cookies.remove(name);
      }
    });
    setShowCookieBanner(false);
  };

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
      headerTitle: "FOREST MONITORING AND PATROLLING SYSTEM",
      heroTag: "Implemented by Gujarat Forest Department",
      heroTitle1: "Forest Monitoring",
      heroTitle2: "& Patrolling Platform",
      heroDesc: "The Forest Monitoring and Patrolling System under the RECAP4NDC initiative integrates satellite-derived vegetation indicators, field patrolling data, incident reporting, and working plan spatial boundaries into a unified web-based monitoring environment. The WebGIS dashboard integrates spatial data services and geo-intelligence for operational forest management.",
      launchApp: "Login",
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
      headerTitle: "વન મોનિટરિંગ અને પેટ્રોલિંગ સિસ્ટમ",
      heroTag: "ગુજરાત વન વિભાગ દ્વારા અમલમાં મૂકાયેલ",
      heroTitle1: "વન મોનિટરિંગ",
      heroTitle2: "અને પેટ્રોલિંગ પ્લેટફોર્મ",
      heroDesc: "RECAP4NDC પહેલ હેઠળ વન પેટ્રોલિંગ અને મોનિટરિંગ સિસ્ટમ ઉપગ્રહ-આધારિત વનસ્પતિ સૂચકાંક, ક્ષેત્ર પેટ્રોલિંગ ડેટા, ઘટના રિપોર્ટિંગ અને કામગીરી પ્લાન સ્પેશિયલ બાઉન્ડરીઝને એકીકૃત વેબ-આધારિત મોનિટરિંગ વાતાવરણમાં જોડે છે.",
      launchApp: "એપ શરૂ કરો",
      overviewTitle: "વન મોનિટરિંગ",
      overviewTitleHighlight: "અવલોકન",
      overviewSubtitle: "એપ્લિકેશન ડેશબોર્ડ સંકલિત સ્પેશિયલ અને ક્ષેત્ર ડેટાને કાર્યક્ષમ મોનિટરિંગ સૂચકાંકોમાં રૂપાંતરિત કરે છે.",
      overview1: "રિયલ-ટાઇમ મોનિટરિંગ",
      overview1Desc: "સંકલિત ઉપગ્રહ અને ક્ષેત્ર ડેટા સ્ટ્રીમ દ્વારા વન સ્વાસ્થ્ય ટ્રૅક કરો.",
      overview2: "વન માહિતી",
      overview2Desc: "ડેટા-આધારિત ઍનલિટિક્સ જે વનસ્પતિ વલણો, પેટ્રોલ કવરેજ અને પુનઃસ્થાપન પ્રગતિ દર્શાવે છે.",
      overview3: "ઘટના વ્યવસ્થાપન",
      overview3Desc: "જીઓ-ટેગ કરેલા પુરાવા અને મોબાઇલ ફિલ્ડ રિપોર્ટ દ્વારા વન સંબંધિત ઘટનાઓની નોંધણી કરો, દેખરેખ રાખો અને યોગ્ય કાર્યવાહી કરો.",
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

  // Language-aware FAQ data
  const FAQ_DATA = language === 'gu' ? [
    { id: 1,  category: 'general',         q: 'RECAP4NDC વન મોનિટરિંગ અને પેટ્રોલિંગ સિસ્ટમ શું છે?', a: 'આ એક મોબાઇલ અને વેબ-આધારિત એપ્લિકેશન છે જે વન વિભાગ માટે વન વિસ્તારોનું નિરીક્ષણ, NDVI દ્વારા વનસ્પતિ ફેરફારો ટ્રૅક, અને પેટ્રોલિંગ પ્રવૃત્તિઓ સંચાલિત કરવા માટે ડિઝાઇન કરવામાં આવી છે.' },
    { id: 2,  category: 'general',         q: 'મોબાઇલ એપ્લિકેશન કેવી રીતે ઇન્સ્ટોલ કરવી?', a: 'Google Play Store માંથી "FMPS" ઇન્સ્ટોલ કરો. ઇન્સ્ટોલ થયા પછી, સેટઅપ પ્રક્રિયા શરૂ કરવા એપ ખોલો.' },
    { id: 3,  category: 'general',         q: 'એપ્લિકેશન કઈ ભાષાઓ સપોર્ટ કરે છે?', a: 'એપ્લિકેશન બે ભાષાઓ સપોર્ટ કરે છે: અંગ્રેજી અને ગુજરાતી. પ્રારંભિક સ્ક્રીન પર તમારી પસંદગીની ભાષા પસંદ કરો. "Profile" સેક્શન માંથી પછીથી ભાષા બદલી શકાય છે.' },
    { id: 4,  category: 'general',         q: 'એપ્લિકેશન કઈ પરવાનગી માંગે છે?', a: 'એપ્લિકેશનને સાચી રીતે કામ કરવા માટે કેટલીક પરવાનગી જોઈએ:', list: ['સૂચના પરવાનગી: ચેતવણી અને અપડેટ મળવા.', 'સ્થાન પરવાનગી: પેટ્રોલ રૂટ ટ્રૅક અને નકશામાં સ્થાન નક્કી કરવા. "Allow While Using the App" પસંદ કરવાની ભલામણ.', 'કેમેરા અને ઑડિઓ: ક્ષેત્ર મુલાકાત દરમ્યાન ફોટો પાડવા.'] },
    { id: 5,  category: 'general',         q: 'મોબાઇલ એપ્લિકેશનમાં લૉગ ઇન કેવી રીતે કરવું?', a: 'ભાષા પસંદ કર્યા પછી, Login Page પર જવાશે. eGuj Username અને Password દાખલ કરી Login button ક્લિક કરો.' },
    { id: 6,  category: 'general',         q: 'લૉગ ઇન થઈ ગયા પછી શું થાય?', a: 'એપ "fetching data" શરૂ કરશે. 100% લોડ થવાની રાહ જુઓ. ત્યારબાદ Division, Range, Beat, Village જેવી વિગત પસંદ કરવી. નકશો નિર્ધારિત ક્ષેત્ર પર ઝૂમ થઈ જશે.' },
    { id: 7,  category: 'forest-cover',   q: '"Forest Cover Change" મોડ્યુલ શું છે?', a: 'આ મોડ્યુલ માસિક NDVI ફેરફાર દર્શાવે છે. અધિકારીઓ જ્યાં વન આવરણ ઘટ્યું (degradation) અથવા સુધર્યું ત્યાં ઓળખ કરી શકે છે.' },
    { id: 8,  category: 'forest-cover',   q: 'વન આવરણ ફેરફાર કેવી રીતે તપાસવો?', a: 'Main dashboard માંથી "Forest Cover" module ક્લિક કરો. મહિનો પસંદ કરો. સિસ્ટમ અગાઉના મહિના સાથે સરખામણી કરશે. ઘટ થયેલ ક્ષેત્ર નકશા પર red box થી ચિહ્નિત થશે.' },
    { id: 9,  category: 'forest-cover',   q: 'NDVI ઘટ સૂચવતો red box જોઉ ત્યારે શું કરવું?', a: 'Red box ક્લિક કરો. Dialog box વિગત સાથે ખૂલશે. બે વિકલ્પ:', list: ['ફેરફાર સાચો હોય: "Update Status" button ક્લિક કરો.', 'ફેરફાર સાચો ન હોય: "Negative NDVI Status" OFF કરો, notes box માં ટિપ્પણી લખો, ફોટો કૅપ્ચર કરી અપલોડ કરો, પછી "Update Status" ક્લિક કરો.'] },
    { id: 10, category: 'forest-cover',   q: 'નકશામાં ઉપલબ્ધ સાધનો કઈ?', a: 'નકશા સ્ક્રીન પર:', list: ['Map Type Button: Standard map અને Satellite view વચ્ચે ફેરવો.', 'Legend: નકશાના વિવિધ રંગોનો અર્થ.', 'Current Location Button: GPS સ્થાન પર નકશો કેન્દ્રિત કરો.'] },
    { id: 11, category: 'patrolling',     q: 'Patrolling session કેવી રીતે શરૂ કરવું?', a: 'Screen ના નીચે "Patrolling" module માં જઈ "Start" button ટૅપ કરો.' },
    { id: 12, category: 'patrolling',     q: 'પેટ્રોલિંગ પ્રકાર કેટલા?', a: 'ત્રણ પ્રકાર:', list: ['Day Patrolling', 'Night Patrolling', 'Beat Checking'], extra: 'સિસ્ટમ સમય અનુસાર સૂચવે છે, dropdown menu માંથી ફેરવી શકાય.' },
    { id: 13, category: 'patrolling',     q: 'Patrol શરૂ કરતા પહેલા કઈ માહિતી આપવી?', a: 'જરૂરી:', list: ['Patrolling Type પસંદ કરો.', 'સ્ટાફ સભ્ય સંખ્યા દાખલ કરો.', 'શરૂ કરવાના સ્થળે ફરજિયાત ફોટો.'] },
    { id: 14, category: 'patrolling',     q: 'Patrol દરમ્યાન કઈ માહિતી દેખાય?', a: 'Patrol દરમ્યાન ટ્રૅક:', list: ['Real-time distance.', 'Patrol time.', 'નકશામાં Route.'] },
    { id: 15, category: 'patrolling',     q: 'Patrol દરમ્યાન ફોટો કેવી રીતે પાડવો?', a: 'Screen ના નીચે-જમણા Camera Button ટૅપ કરો. Patrol ના વિભિન્ન સ્થળે ઘણા ફોટો પાડી શકાય.' },
    { id: 16, category: 'patrolling',     q: 'Patrolling session કેવી રીતે પૂર્ણ કરવું?', a: 'Patrol સમાપ્ત થાય ત્યારે Stop button દબાવો. ફરજિયાત ending photo લો. Submit થઈ જાય ત્યારે data device પર save થશે.' },
    { id: 17, category: 'patrolling',     q: '"Data Sync" શું છે?', a: '"Data Sync" save કરેલ patrol data central server પર upload કરવાની પ્રક્રિયા. Internet connection જરૂરી. Patrol complete થઈ તરત sync કરવાની ભલામણ.' },
    { id: 18, category: 'patrolling',     q: 'જૂના patrolling record ક્યાં જોવા?', a: 'Patrolling Module માં "Patrolling Record" પસંદ કરો. Patrol ID થી ચોક્કસ record શોધી શકાય.' },
    { id: 19, category: 'coupe',          q: '"Coupe" module શેના માટે?', a: 'આ module નકશા પર forest coupes ની સીમા દર્શાવે છે. Forest guards ચોક્કસ coupe ની જગ્યા ઓળખી શકે.' },
    { id: 20, category: 'coupe',          q: 'ચોક્કસ coupe ના directions કેવી રીતે મળે?', a: 'પગલાં:', list: ['"Coupe" button ટૅપ કરો.', 'Dialog box "Coupe Numbers" ની list સાથે ખૂલશે. જોઈતો coupe પસંદ કરો.', 'સિસ્ટમ current location થી selected coupe સુધી route અને km distance ગણીને દર્શાવશે.'] },
    { id: 21, category: 'activities',     q: '"Activities" section શું છે?', a: 'General record-keeping section:', list: ['Field Visit: ફોટો અને notes સાથે field visits નોંધો.', 'Saved Photos: Field visits ના ફોટો જુઓ. ફોટો phone gallery માં save પણ કરી શકો.'] },
    { id: 22, category: 'activities',     q: 'ફોટો અને data કેટલા સમય સ્ટોર રહે?', a: 'App ની ફોટો અને data 30 દિવસ store રહે, ત્યારબાદ automatically delete.' },
    { id: 23, category: 'activities',     q: 'Profile/administrative details કેવી રીતે update?', a: '"Profile Section" માં જઈ Village, Round, Range, Beat ફેરવો. ઉપલબ્ધ વિકલ્પ user role અનુસાર. Map data automatically update.' },
    { id: 24, category: 'web',            q: 'Web application શું કામ આવે?', a: 'Geo-Dashboard supervisors/administrators માટે:', list: ['Centralized Monitoring: Patrolling data અને forest cover changes.', 'Data Analysis: Reports અને patrolling performance.', 'Explore Data: State, Circle, Division, Range, Beat, Village layers.', 'NDVI Dashboard: Vegetation health analysis.'] },
    { id: 25, category: 'web',            q: 'Web app માંથી કઈ reports?', a: 'Reports:', list: ['Patrolling Logs: Filters સહ patrols table.', 'Officer Patrol Summary: Officer performance report.', 'NDVI Reports: Degraded/afforested areas, division breakdown, geotagged records.'] },
    { id: 26, category: 'troubleshooting', q: 'Mobile application માંથી log out કેવી રીતે?', a: 'Profile section માં Logout button ક્લિક કરો. Login Screen પર redirect.' },
  ] : [
    { id: 1,  category: 'general',         q: 'What is the RECAP4NDC Forest Monitoring and Patrolling System?', a: "It's a mobile and web-based application designed for the forest department to monitor forest areas, track vegetation changes using NDVI, and manage patrolling activities. It helps in forest protection, management, and evidence-based decision-making." },
    { id: 2,  category: 'general',         q: 'How do I install the mobile application?', a: 'You need to install the "FMPS" from the Google Play Store. Once installed, open the app to begin the setup process.' },
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

  // Language-aware cards
  const cards = language === 'gu' ? [
    { title: "ભૂ-સ્થાનિક વન મોનિટરિંગ નકશો", img: Geospacial, desc: "ગુજરાત ભરમાં વન આવરણ ફેરફારો, વહીવટી સીમાઓ, working plan વિસ્તારો અને ક્ષેત્ર patrol routes explore કરવા ઇન્ટરેક્ટિવ WebGIS ઇન્ટરફેસ." },
    { title: "પેટ્રોલિંગ મોનિટરિંગ", img: pm, desc: "Route coverage, patrol frequency, officer participation અને forest divisions ભરમાં patrol utilization સહ field patrol operations ની real-time monitoring." },
    { title: "ઘટના અને અવલોકન મોનિટરિંગ", img: Incident, desc: "મોબાઇલ એપ્લિકેશન દ્વારા નોંધાયેલી ગેરકાયદેસર વૃક્ષ કાપણી, અતિક્રમણ, વન્યજીવોને લગતા જોખમો અને પર્યાવરણ સંબંધિત ઘટનાઓની માહિતી." },
    { title: "વન મોનિટરિંગ ઇનસાઇટ", img: fm, desc: "પુનઃસ્થાપન આયોજન માટે NDVI વનસ્પતિના વલણો, પેટ્રોલિંગ કવરેજ, ઘટનાઓનું વિતરણ અને વર્કિંગ પ્લાનની સ્થિતિનું સંકલિત વિશ્લેષણ." },
    { title: "NDVI વનસ્પતિ મોનિટરિંગ", img: nv, desc: "Sentinel-2 ઉપગ્રહ છબીઓનો ઉપયોગ કરીને વન કૂપોમાં વનસ્પતિની ઘનતા, વનસ્પતિના ઘટાડાના વિસ્તારો અને પુનઃસ્થાપનની પ્રગતિ દર્શાવતું ઉપગ્રહ આધારિત NDVI વિશ્લેષણ." },
    { title: "કૂપ મોનિટરિંગ", img: cb, desc: "વર્કિંગ પ્લાન વિસ્તારો અને કૂપ સ્તરની નોંધોનું નિરીક્ષણ, જેમાં અપલોડ કરેલી વિસ્તારની સીમાઓ અને ક્ષેત્રમાંથી નોંધાયેલી પર્યાવરણીય સ્થિતિનો સમાવેશ થાય છે." },
  ] : [
    { title: "GEOSPATIAL FOREST MONITORING MAP", img: Geospacial, desc: "Interactive WebGIS interface for exploring forest cover changes, administrative boundaries, working plan areas, and field patrol routes across Gujarat." },
    { title: "PATROLLING MONITORING", img: pm, desc: "Real-time monitoring of field patrol operations including route coverage, patrol frequency, officer participation, and patrol utilization across forest divisions." },
    { title: "INCIDENT & OBSERVATION MONITORING", img: Incident, desc: "Overview of field-reported incidents including illegal logging, encroachment, wildlife threats, and ecological observations submitted through the mobile application." },
    { title: "FOREST MONITORING INSIGHTS", img: fm, desc: "Integrated analytics combining NDVI vegetation trends, patrolling coverage, incident distribution, and working plan status to support restoration planning." },
    { title: "NDVI VEGETATION MONITORING", img: nv, desc: "Satellite-based NDVI analysis visualizing vegetation density, degradation patterns, and restoration progress across forest coupes using Sentinel-2 imagery." },
    { title: "COUPE MONITORING", img: cb, desc: "Monitoring of working plan areas and coupe-level observations including uploaded spatial boundaries and field-reported ecological conditions." },
  ];

  const [activeFaqCat, setActiveFaqCat] = useState('general');
  const [openFaqId, setOpenFaqId] = useState(null);

  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Smooth slow-motion playback
    const setSmoothSlowMotion = () => {
      video.playbackRate = 0.5;     // Half speed
      video.defaultPlaybackRate = 0.5; // Ensure rate persists after seeks/loops
      // Smooth playback hint — tells browser to prioritize smooth rendering
      if ('requestVideoFrameCallback' in video) {
        video.requestVideoFrameCallback(() => {});
      }
    };

    // Apply as soon as metadata is available
    if (video.readyState >= 1) {
      setSmoothSlowMotion();
    }

    // Re-apply on metadata load and each loop restart
    video.addEventListener('loadedmetadata', setSmoothSlowMotion);
    video.addEventListener('play', setSmoothSlowMotion);
    video.addEventListener('seeked', setSmoothSlowMotion);

    // Ensure video plays smoothly even if autoplay is blocked
    const tryPlay = () => video.play().catch(() => {});
    video.addEventListener('canplaythrough', tryPlay);

    return () => {
      video.removeEventListener('loadedmetadata', setSmoothSlowMotion);
      video.removeEventListener('play', setSmoothSlowMotion);
      video.removeEventListener('seeked', setSmoothSlowMotion);
      video.removeEventListener('canplaythrough', tryPlay);
    };
  }, []);

  return (
    <>
      {/* ===== HEADER ===== */}
      <header id="header">
        <div className="before-login-container">
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
              {/* <div className="l_1">
                <img src={Moef} alt="Ministry of Environment, Forest and Climate Change" style={{ width: '120px' }} />
              </div> */}
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
          ref={videoRef}
          src={heroVideo}
          className="hero-bg-video"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
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
            <a href="/login" className="hero-cta" id="hero-launch-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              {t.launchApp} <FiArrowRight />
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
            <div className="overview-icon" style={{ fontSize: '24px', color: '#2e7d32' }}><FiRadio /></div>
            <h4>{t.overview1}</h4>
            <p>{t.overview1Desc}</p>
          </div>
          <div className="overview-card">
            <div className="overview-icon" style={{ fontSize: '24px', color: '#2e7d32' }}><FiMap /></div>
            <h4>{t.overview2}</h4>
            <p>{t.overview2Desc}</p>
          </div>
          <div className="overview-card">
            <div className="overview-icon" style={{ fontSize: '24px', color: '#2e7d32' }}><FiAlertTriangle /></div>
            <h4>{t.overview3}</h4>
            <p>{t.overview3Desc}</p>
          </div>
          <div className="overview-card">
            <div className="overview-icon" style={{ fontSize: '24px', color: '#2e7d32' }}><FiUsers /></div>
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
          {cards.map((card) => (
            <div className="tool-card" key={card.title}>
              <div className="tool-icon">
                {card.img && <img src={card.img} alt={card.title} loading="lazy" decoding="async" />}
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
                <span className="faq-chevron" aria-hidden="true">{openFaqId === faq.id ? <FiChevronUp /> : <FiChevronDown />}</span>
              </button>
              <div className="faq-answer" style={{ maxHeight: openFaqId === faq.id ? '500px' : '0' }}>
                <div className="faq-answer-inner">
                  <p>{faq.a}</p>
                  {faq.list && (
                    <ul>
                      {faq.list.map((item) => <li key={item}>{item}</li>)}
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
          <img src={gujaratlogo} alt="Gujarat Forest Department" loading="lazy" decoding="async" />
          <p>{t.footerCopy}</p>
        </div>
        <div className="footer-center">
          <a href="/support" className="footer-support-link">
            {language === 'gu' ? 'સપોર્ટ' : 'Support'}
          </a>
          <a href="/privacy-policy" className="footer-support-link">
            {language === 'gu' ? 'ગોપનીયતા નીતિ' : 'Privacy Policy'}
          </a>
        </div>
        <div className="footer-right">
          <p>{t.footerPowered}</p>
          <a href="https://www.gisfy.co.in/" target="_blank" rel="noopener noreferrer">
            <img src={gisfylogo} alt="GISFY" loading="lazy" decoding="async" />
          </a>
        </div>
      </footer>

      {/* Cookie Consent Banner */}
      {showCookieBanner && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 99999,
          backgroundColor: '#1a1a2e',
          color: '#fff',
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          flexWrap: 'wrap',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.3)',
          fontFamily: "'Inter', 'Arial', sans-serif",
        }}>
          <div style={{ flex: 1, minWidth: '280px', fontSize: '14px', lineHeight: '1.5' }}>
            <span style={{ fontWeight: 600, fontSize: '15px' }}>
              {language === 'gu' ? 'કૂકીઝ પરવાનગી' : 'Cookie Consent'}
            </span>
            <p style={{ margin: '4px 0 0', color: '#bbb', fontSize: '13px' }}>
              {language === 'gu'
                ? 'અમે તમારા અનુભવને સુધારવા માટે કૂકીઝનો ઉપયોગ કરીએ છીએ. આવશ્યક કૂકીઝ વેબસાઇટના કાર્ય માટે જરૂરી છે. તમે બિન-આવશ્યક કૂકીઝને સ્વીકાર અથવા નકારી શકો છો.'
                : 'We use cookies to improve your experience. Essential cookies are required for the website to function. You can accept or reject non-essential cookies.'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px', flexShrink: 0 }}>
            <button
              onClick={handleRejectCookies}
              style={{
                padding: '10px 20px',
                backgroundColor: 'transparent',
                color: '#ccc',
                border: '1px solid #555',
                borderRadius: '8px',
                fontSize: '14px',
                cursor: 'pointer',
                fontWeight: 500,
                transition: 'all 0.2s',
              }}
              onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#333'; e.currentTarget.style.color = '#fff'; }}
              onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#ccc'; }}
            >
              {language === 'gu' ? 'નકારો' : 'Reject'}
            </button>
            <button
              onClick={handleAcceptCookies}
              style={{
                padding: '10px 24px',
                backgroundColor: '#2e7d32',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                cursor: 'pointer',
                fontWeight: 600,
                transition: 'all 0.2s',
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1b5e20'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#2e7d32'}
            >
              {language === 'gu' ? 'સ્વીકારો' : 'Accept'}
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default Homepage;
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import {
  FiChevronDown,
  FiChevronUp,
  FiMail,
  FiUser,
  FiMessageSquare,
  FiSend,
  FiCheckCircle,
  FiAlertCircle,
  FiPhone,
  FiClock,
  FiLifeBuoy,
} from "react-icons/fi";
import "./SupportPage.css";

import gujaratlogo from "../assets/FOREST DEPT.jpg";
import gizfylogo from "../assets/Gisfylogo.png";

function SupportPage() {
  const { language } = useLanguage();
  const isGu = language === "gu";

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    issueType: "",
    description: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);
  const [errors, setErrors] = useState({});
  const [openFaqId, setOpenFaqId] = useState(null);
  const [activeCategory, setActiveCategory] = useState("general");

  const t = {
    en: {
      title: "Support Center",
      subtitle: "FMPS (Forest Monitoring and Patrolling System)",
      intro: "If you have any issues or questions, please fill out the form below. Our team will respond as soon as possible.",
      formTitle: "Submit a Support Request",
      nameLabel: "Your Name",
      namePlaceholder: "Enter your name",
      emailLabel: "Your Email",
      emailPlaceholder: "abc@gmail.com",
      subjectLabel: "Subject",
      subjectPlaceholder: "Brief subject of your issue",
      issueTypeLabel: "Issue Type",
      issueTypePlaceholder: "Select issue type",
      descLabel: "Describe your issue",
      descPlaceholder: "Describe your issue...",
      submit: "Submit Request",
      submitting: "Submitting...",
      success: "Your support request has been submitted successfully. Our team will get back to you soon.",
      error: "Failed to submit request. Please try again or contact us directly.",
      faqTitle1: "Frequently Asked",
      faqTitle2: "Questions",
      faqSubtitle: "Quick answers to common questions about FMPS.",
      contactTitle: "Contact Information",
      contactEmail: "gujfdp@gmail.com",
      contactPhone: "+91 79 2325 0222",
      contactHours: "Mon - Fri, 9:00 AM - 6:00 PM IST",
      backToLogin: "← Back to Login",
      backToHome: "← Back to Home",
      issueTypes: [
        { value: "login", label: "Login / Authentication" },
        { value: "mobile_app", label: "Mobile App Issue" },
        { value: "web_app", label: "Web Application Issue" },
        { value: "ndvi", label: "NDVI / Forest Cover" },
        { value: "patrolling", label: "Patrolling Module" },
        { value: "coupe", label: "Coupe Module" },
        { value: "data_sync", label: "Data Sync Issue" },
        { value: "other", label: "Other" },
      ],
      validation: {
        nameRequired: "Name is required",
        emailRequired: "Email is required",
        emailInvalid: "Please enter a valid email address",
        subjectRequired: "Subject is required",
        descRequired: "Please describe your issue",
        descMin: "Description must be at least 10 characters",
      },
    },
    gu: {
      title: "સપોર્ટ સેન્ટર",
      subtitle: "FMPS (વન મોનિટરિંગ અને પેટ્રોલિંગ સિસ્ટમ)",
      intro: "જો તમને કોઈ સમસ્યા અથવા પ્રશ્ન હોય, તો કૃપા કરીને નીચેનું ફોર્મ ભરો. અમારી ટીમ શક્ય તેટલી વહેલી પ્રતિસાદ આપશે.",
      formTitle: "સપોર્ટ વિનંતી સબમિટ કરો",
      nameLabel: "તમારું નામ",
      namePlaceholder: "તમારું નામ દાખલ કરો",
      emailLabel: "તમારો ઈમેલ",
      emailPlaceholder: "abc@gmail.com",
      subjectLabel: "વિષય",
      subjectPlaceholder: "તમારી સમસ્યાનો સંક્ષિપ્ત વિષય",
      issueTypeLabel: "સમસ્યાનો પ્રકાર",
      issueTypePlaceholder: "સમસ્યાનો પ્રકાર પસંદ કરો",
      descLabel: "તમારી સમસ્યાનું વર્ણન કરો",
      descPlaceholder: "તમારી સમસ્યાનું વર્ણન કરો...",
      submit: "વિનંતી સબમિટ કરો",
      submitting: "સબમિટ થઈ રહ્યું છે...",
      success: "તમારી સપોર્ટ વિનંતી સફળતાપૂર્વક સબમિટ થઈ ગઈ છે. અમારી ટીમ ટાળે જ તમને સંપર્ક કરશે.",
      error: "વિનંતી સબમિટ કરવામાં નિષ્ફળ. કૃપા કરીને ફરી પ્રયાસ કરો અથવા સીધો સંપર્ક કરો.",
      faqTitle1: "વારંવાર પૂછાતા",
      faqTitle2: "પ્રશ્નો",
      faqSubtitle: "FMPS વિશે સામાન્ય પ્રશ્નોના ઝડપી જવાબો.",
      contactTitle: "સંપર્ક માહિતી",
      contactEmail: "gujfdp@gmail.com",
      contactPhone: "+91 79 2325 0222",
      contactHours: "સોમ - શુક્ર, સવારે 9:00 - સાંજે 6:00 IST",
      backToLogin: "← લોગિન પર પાછા જાઓ",
      backToHome: "← હોમ પર પાછા જાઓ",
      issueTypes: [
        { value: "login", label: "લોગિન / પ્રમાણીકરણ" },
        { value: "mobile_app", label: "મોબાઇલ એપ સમસ્યા" },
        { value: "web_app", label: "વેબ એપ્લિકેશન સમસ્યા" },
        { value: "ndvi", label: "NDVI / વન આવરણ" },
        { value: "patrolling", label: "પેટ્રોલિંગ મોડ્યુલ" },
        { value: "coupe", label: "કૂપ મોડ્યુલ" },
        { value: "data_sync", label: "ડેટા સિંક સમસ્યા" },
        { value: "other", label: "અન્ય" },
      ],
      validation: {
        nameRequired: "નામ જરૂરી છે",
        emailRequired: "ઈમેલ જરૂરી છે",
        emailInvalid: "માન્ય ઈમેલ એડ્રેસ દાખલ કરો",
        subjectRequired: "વિષય જરૂરી છે",
        descRequired: "કૃપા કરીને તમારી સમસ્યાનું વર્ણન કરો",
        descMin: "વર્ણન ઓછામાં ઓછા 10 અક્ષરોનું હોવું જોઈએ",
      },
    },
  };

  const tt = isGu ? t.gu : t.en;

  const faqCategories = [
    { id: "general", label: isGu ? "સામાન્ય" : "General" },
    { id: "account", label: isGu ? "એકાઉન્ટ" : "Account" },
    { id: "technical", label: isGu ? "તકનીકી" : "Technical" },
    { id: "data", label: isGu ? "ડેટા" : "Data" },
  ];

  const FAQ_DATA = isGu ? [
    { id: 1, category: "general", q: "FMPS એપ્લિકેશન શું છે?", a: "FMPS (વન મોનિટરિંગ અને પેટ્રોલિંગ સિસ્ટમ) ગુજરાત વન વિભાગ માટે વિકસાવવામાં આવેલ મોબાઇલ અને વેબ એપ્લિકેશન છે, જે વન નિરીક્ષણ, NDVI ટ્રૅકિંગ અને પેટ્રોલિંગ પ્રવૃત્તિઓનું સંચાલન કરે છે." },
    { id: 2, category: "general", q: "એપ્લિકેશન કઈ ભાષાઓ આધાર આપે છે?", a: "એપ્લિકેશન બે ભાષાઓને આધાર આપે છે: અંગ્રેજી અને ગુજરાતી. તમે પ્રારંભિક સ્ક્રીન પર અથવા પ્રોફાઇલ વિભાગમાંથી ભાષા બદલી શકો છો." },
    { id: 3, category: "general", q: "મોબાઇલ એપ કેવી રીતે ડાઉનલોડ કરવી?", a: 'Google Play Store માં "FMPS" શોધીને ઇન્સ્ટોલ કરો.' },
    { id: 4, category: "account", q: "લોગિન કેવી રીતે કરવું?", a: "ભાષા પસંદ કર્યા પછી, લોગિન પેજ પર તમારો eGuj Username અને Password દાખલ કરી લોગિન બટન ક્લિક કરો." },
    { id: 5, category: "account", q: "પાસવર્ડ ભૂલી ગયો હોય તો શું કરવું?", a: "જો તમે પાસવર્ડ ભૂલી ગયા હોવ, તો કૃપા કરીને ઉપરનું સપોર્ટ ફોર્મ ભરો અથવા gujfdp@gmail.com પર સંપર્ક કરો. અમારી ટીમ તમારો પાસવર્ડ રીસેટ કરવામાં મદદ કરશે." },
    { id: 6, category: "account", q: "વેબ એપ્લિકેશનમાં પાસવર્ડ કેવી રીતે બદલવો?", a: 'લોગિન પછી, એડમિન પેનલમાં "Change Password" વિકલ્પ પર જાઓ. જૂનો પાસવર્ડ અને નવો પાસવર્ડ દાખલ કરી અપડેટ કરો.' },
    { id: 7, category: "technical", q: "એપ્લિકેશન ક્રેશ થાય છે તો શું કરવું?", a: "પહેલા એપને બંધ કરી ફરીથી ખોલો. જો સમસ્યા રહે, તો એપ અપડેટ કરો. હજુ પણ સમસ્યા હોય તો સપોર્ટ ફોર્મ ભરો." },
    { id: 8, category: "technical", q: "GPS સ્થાન બરાબર નથી દેખાતું?", a: 'ખાતરી કરો કે સ્થાન પરવાનગી "Allow While Using the App" પર સેટ છે. ડિવાઇસની GPS સેટિંગસ ચાલુ છે કે નહીં તે તપાસો.' },
    { id: 9, category: "technical", q: "નકશો લોડ નથી થઈ રહ્યો?", a: "ઇન્ટરનેટ કનેક્શન તપાસો. જો કનેક્શન સારું હોય અને નકશો લોડ ન થાય, તો એપ રીસ્ટાર્ટ કરો અથવા સપોર્ટથી સંપર્ક કરો." },
    { id: 10, category: "data", q: "પેટ્રોલ ડેટા સિંક નથી થઈ રહ્યો?", a: 'ખાતરી કરો કે ઇન્ટરનેટ કનેક્શન સક્રિય છે. "Data Sync" બટન દબાવો. જો સમસ્યા રહે, તો એપ રીસ્ટાર્ટ કરી ફરી પ્રયાસ કરો.' },
    { id: 11, category: "data", q: "ફોટો અને ડેટા કેટલા સમય સ્ટોર રહે છે?", a: "એપનો ફોટો અને ડેટા 30 દિવસ સ્ટોર રહે છે, ત્યારબાદ આપમેળે ડિલીટ થાય છે. ડેટા સિંક કરવાની ભલામણ કરવામાં આવે છે." },
    { id: 12, category: "data", q: "NDVI રિપોર્ટ ક્યાંથી જોવા?", a: "વેબ એપ્લિકેશનમાં NDVI ડેશબોર્ડ પર જાઓ. તમે મહિનો પસંદ કરી વન આવરણ ફેરફારની સરખામણી જોઈ શકો છો." },
  ] : [
    { id: 1, category: "general", q: "What is the FMPS application?", a: "FMPS (Forest Monitoring and Patrolling System) is a mobile and web application developed for the Gujarat Forest Department to monitor forest areas, track NDVI vegetation changes, and manage patrolling activities." },
    { id: 2, category: "general", q: "What languages does the application support?", a: "The application supports two languages: English and Gujarati. You can switch languages from the initial screen or the Profile section." },
    { id: 3, category: "general", q: "How do I download the mobile app?", a: 'Search for "FMPS" on the Google Play Store and install it.' },
    { id: 4, category: "account", q: "How do I log in?", a: "After selecting your language, enter your eGuj Username and Password on the Login Page and click the login button." },
    { id: 5, category: "account", q: "What should I do if I forgot my password?", a: "If you forgot your password, please fill out the support form above or contact us at gujfdp@gmail.com. Our team will help you reset your password." },
    { id: 6, category: "account", q: "How do I change my password in the web application?", a: 'After logging in, go to the Admin panel and click "Change Password." Enter your old password and new password to update.' },
    { id: 7, category: "technical", q: "What should I do if the app keeps crashing?", a: "First, close and reopen the app. If the issue persists, check for app updates in the Play Store. If the problem continues, submit a support request with details about what you were doing when the crash occurred." },
    { id: 8, category: "technical", q: "GPS location is not accurate?", a: 'Ensure location permission is set to "Allow While Using the App." Check that your device\'s GPS settings are enabled. Try moving to an open area for better GPS signal.' },
    { id: 9, category: "technical", q: "The map is not loading?", a: "Check your internet connection. If the connection is fine and the map still doesn't load, try restarting the app or clearing the app cache. Contact support if the issue persists." },
    { id: 10, category: "data", q: "Patrol data is not syncing?", a: 'Ensure you have an active internet connection. Tap the "Data Sync" button. If sync still fails, restart the app and try again. It is recommended to sync data immediately after completing a patrol.' },
    { id: 11, category: "data", q: "How long are photos and data stored?", a: "App photos and data are stored for 30 days, after which they are automatically deleted. It is recommended to sync your data regularly." },
    { id: 12, category: "data", q: "Where can I view NDVI reports?", a: "Navigate to the NDVI Dashboard in the web application. You can select a month and compare forest cover changes between months." },
  ];

  const filteredFaqs = FAQ_DATA.filter((f) => f.category === activeCategory);
  const categoryCounts = faqCategories.map((cat) => ({
    ...cat,
    count: FAQ_DATA.filter((f) => f.category === cat.id).length,
  }));

  const validate = () => {
    const e = {};
    if (!formData.name.trim()) e.name = tt.validation.nameRequired;
    if (!formData.email.trim()) e.email = tt.validation.emailRequired;
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) e.email = tt.validation.emailInvalid;
    if (!formData.subject.trim()) e.subject = tt.validation.subjectRequired;
    if (!formData.description.trim()) e.description = tt.validation.descRequired;
    else if (formData.description.trim().length < 10) e.description = tt.validation.descMin;
    return e;
  };

  const handleChange = (field) => (e) => {
    setFormData({ ...formData, [field]: e.target.value });
    if (errors[field]) setErrors({ ...errors, [field]: undefined });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setSubmitting(true);
    setSubmitStatus(null);
    try {
      const API_BASE = process.env.REACT_APP_API_URL || "";
      const response = await fetch(`${API_BASE}/api/support/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!response.ok) throw new Error("Request failed");
      setSubmitStatus("success");
      setFormData({ name: "", email: "", subject: "", issueType: "", description: "" });
    } catch (err) {
      setSubmitStatus("error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="support-page">
      <div className="support-container">
        <Link to="/" className="support-back-link">
          {tt.backToHome}
        </Link>

        {/* ===== HEADER ===== */}
        <div className="support-header">
          <div className="support-header-icon">
            <FiLifeBuoy size={32} />
          </div>
          <h1 className="support-title">{tt.title}</h1>
          <h2 className="support-subtitle">{tt.subtitle}</h2>
          <p className="support-intro">{tt.intro}</p>
        </div>

        {/* ===== SUPPORT FORM + CONTACT INFO ===== */}
        <div className="support-form-section">
          <div className="support-form-wrapper">
            <h3 className="support-form-title">
              <FiMessageSquare size={20} style={{ marginRight: 8, verticalAlign: "middle" }} />
              {tt.formTitle}
            </h3>

            {submitStatus === "success" && (
              <div className="support-alert support-alert-success">
                <FiCheckCircle size={20} />
                <span>{tt.success}</span>
              </div>
            )}
            {submitStatus === "error" && (
              <div className="support-alert support-alert-error">
                <FiAlertCircle size={20} />
                <span>{tt.error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="support-form" noValidate>
              <div className="support-form-row">
                <div className="support-form-group">
                  <label className="support-label">
                    <FiUser size={14} style={{ marginRight: 6, verticalAlign: "middle" }} />
                    {tt.nameLabel}
                  </label>
                  <input
                    type="text"
                    className={`support-input ${errors.name ? "support-input-error" : ""}`}
                    placeholder={tt.namePlaceholder}
                    value={formData.name}
                    onChange={handleChange("name")}
                    disabled={submitting}
                  />
                  {errors.name && <span className="support-error-text">{errors.name}</span>}
                </div>

                <div className="support-form-group">
                  <label className="support-label">
                    <FiMail size={14} style={{ marginRight: 6, verticalAlign: "middle" }} />
                    {tt.emailLabel}
                  </label>
                  <input
                    type="email"
                    className={`support-input ${errors.email ? "support-input-error" : ""}`}
                    placeholder={tt.emailPlaceholder}
                    value={formData.email}
                    onChange={handleChange("email")}
                    disabled={submitting}
                  />
                  {errors.email && <span className="support-error-text">{errors.email}</span>}
                </div>
              </div>

              <div className="support-form-row">
                <div className="support-form-group">
                  <label className="support-label">{tt.subjectLabel}</label>
                  <input
                    type="text"
                    className={`support-input ${errors.subject ? "support-input-error" : ""}`}
                    placeholder={tt.subjectPlaceholder}
                    value={formData.subject}
                    onChange={handleChange("subject")}
                    disabled={submitting}
                  />
                  {errors.subject && <span className="support-error-text">{errors.subject}</span>}
                </div>

                <div className="support-form-group">
                  <label className="support-label">{tt.issueTypeLabel}</label>
                  <select
                    className="support-input support-select"
                    value={formData.issueType}
                    onChange={handleChange("issueType")}
                    disabled={submitting}
                  >
                    <option value="">{tt.issueTypePlaceholder}</option>
                    {tt.issueTypes.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="support-form-group">
                <label className="support-label">{tt.descLabel}</label>
                <textarea
                  className={`support-textarea ${errors.description ? "support-input-error" : ""}`}
                  placeholder={tt.descPlaceholder}
                  value={formData.description}
                  onChange={handleChange("description")}
                  rows={5}
                  disabled={submitting}
                />
                {errors.description && <span className="support-error-text">{errors.description}</span>}
              </div>

              <button
                type="submit"
                className="support-submit-btn"
                disabled={submitting}
              >
                <FiSend size={16} style={{ marginRight: 8 }} />
                {submitting ? tt.submitting : tt.submit}
              </button>
            </form>
          </div>

          {/* ===== CONTACT INFO SIDEBAR ===== */}
          <div className="support-contact-card">
            <h3 className="support-contact-title">
              <FiMail size={20} style={{ marginRight: 8, verticalAlign: "middle" }} />
              {tt.contactTitle}
            </h3>
            <div className="support-contact-item">
              <div className="support-contact-icon"><FiMail size={18} /></div>
              <div>
                <div className="support-contact-label">{isGu ? "ઈમેલ" : "Email"}</div>
                <a href={`mailto:${tt.contactEmail}`} className="support-contact-value">{tt.contactEmail}</a>
              </div>
            </div>
            <div className="support-contact-item">
              <div className="support-contact-icon"><FiPhone size={18} /></div>
              <div>
                <div className="support-contact-label">{isGu ? "ફોન" : "Phone"}</div>
                <span className="support-contact-value">{tt.contactPhone}</span>
              </div>
            </div>
            <div className="support-contact-item">
              <div className="support-contact-icon"><FiClock size={18} /></div>
              <div>
                <div className="support-contact-label">{isGu ? "સમય" : "Hours"}</div>
                <span className="support-contact-value">{tt.contactHours}</span>
              </div>
            </div>

            <div className="support-contact-logos">
              <img src={gujaratlogo} alt="Gujarat Forest Department" loading="lazy" />
              <img src={gizfylogo} alt="GISFY" loading="lazy" />
            </div>
          </div>
        </div>

        {/* ===== FAQ SECTION ===== */}
        <div className="support-faq-section">
          <div className="support-faq-header">
            <h2 className="support-faq-heading">
              {tt.faqTitle1} <span className="support-faq-heading-green">{tt.faqTitle2}</span>
            </h2>
            <p className="support-faq-subheading">{tt.faqSubtitle}</p>
          </div>

          <div className="support-faq-categories">
            {categoryCounts.map((cat) => (
              <button
                key={cat.id}
                className={`support-faq-cat-btn ${activeCategory === cat.id ? "support-faq-cat-btn--active" : ""}`}
                onClick={() => { setActiveCategory(cat.id); setOpenFaqId(null); }}
              >
                {cat.label}
                <span className="support-faq-cat-count">{cat.count}</span>
              </button>
            ))}
          </div>

          <div className="support-faq-list">
            {filteredFaqs.map((faq) => (
              <div
                key={faq.id}
                className={`support-faq-item ${openFaqId === faq.id ? "support-faq-item--open" : ""}`}
              >
                <button
                  className="support-faq-question"
                  onClick={() => setOpenFaqId(openFaqId === faq.id ? null : faq.id)}
                  aria-expanded={openFaqId === faq.id}
                >
                  <span className="support-faq-q-num">Q{faq.id}</span>
                  <span className="support-faq-q-text">{faq.q}</span>
                  <span className="support-faq-chevron">
                    {openFaqId === faq.id ? <FiChevronUp /> : <FiChevronDown />}
                  </span>
                </button>
                <div
                  className="support-faq-answer"
                  style={{ maxHeight: openFaqId === faq.id ? "300px" : "0" }}
                >
                  <div className="support-faq-answer-inner">
                    <p>{faq.a}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ===== FOOTER ===== */}
        <div className="support-footer">
          <Link to="/login" className="support-back-link support-back-link-bottom">
            {tt.backToLogin}
          </Link>
          <p>© 2026 Gujarat Forest Department</p>
        </div>
      </div>
    </div>
  );
}

export default SupportPage;

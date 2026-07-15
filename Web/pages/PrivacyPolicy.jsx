import React from "react";
import { Link } from "react-router-dom";
import "./PrivacyPolicy.css";

function PrivacyPolicy() {
  return (
    <div className="legal-page">
      <div className="legal-container">
        <Link to="/login" className="legal-back-link">&larr; Back to Login</Link>

        {/* ===================== PRIVACY POLICY ===================== */}
        <h1 className="legal-title">PRIVACY POLICY</h1>
        <h2 className="legal-subtitle">FOREST MONITORING &amp; PATROLLING SYSTEM</h2>
        <p className="legal-updated">Last Updated: 9 July 2026</p>

        <p>The Forest Monitoring &amp; Patrolling System is developed for the Gujarat Forest Department under the RECAP4NDC Project, implemented by Deutsche Gesellschaft f&uuml;r Internationale Zusammenarbeit (GIZ) GmbH. The application is managed and maintained by the Gujarat Forest Department to support official forest patrolling, monitoring, conservation, and enforcement activities.</p>
        <p>We are committed to protecting the privacy and security of all authorized users. This Privacy Policy explains how we collect, use, store, disclose, and safeguard information when you access and use the Forest Patrolling &amp; Monitoring System.</p>

        <h3>1. Developer Information</h3>
        <p>Organization: Gujarat Forest Department<br />Project: RECAP4NDC &ndash; Forest Patrolling &amp; Monitoring System<br />Website: https://forestrecap.gisfy.co.in/<br />Email: gujfd@gmail.com</p>

        <h3>2. Information We Collect</h3>
        <p>The application collects only the information necessary to perform official forest patrolling and monitoring activities.</p>
        <p>Depending on the features used, we may collect:</p>
        <ul>
          <li>GPS Location</li>
          <li>Patrol Routes</li>
          <li>Date and Time of Patrol Activities</li>
          <li>Camera Images</li>
        </ul>
        <p>We collect only the information required for official operational purposes.</p>

        <h3>3. Permissions Used</h3>
        <p>The application may request the following permissions:</p>

        <h4>Camera</h4>
        <p>Used for:</p>
        <ul>
          <li>Capturing patrol photographs</li>
        </ul>
        <p>The camera is accessed only with your permission.</p>

        <h4>Location</h4>
        <p>Used for:</p>
        <ul>
          <li>Recording patrol routes</li>
          <li>Verifying patrol locations</li>
          <li>Coupe Navigation</li>
        </ul>
        <p>Location permission is essential for the proper functioning of the application.</p>

        <h4>Storage / Photos</h4>
        <p>Used for:</p>
        <ul>
          <li>Uploading patrol image from Camera only</li>
        </ul>

        <h3>4. How We Use Your Information</h3>
        <p>The collected information is used exclusively for official purposes, including:</p>
        <ul>
          <li>Recording and monitoring patrol activities</li>
          <li>Tracking patrol routes and field visits</li>
          <li>Supporting forest protection and monitoring operations</li>
          <li>Improving application performance</li>
          <li>Maintaining application security</li>
        </ul>
        <p>We do not sell or use your personal information for commercial purposes.</p>

        <h3>5. Information Sharing</h3>
        <p>Your information may be shared only under the following circumstances:</p>
        <ul>
          <li>With authorized officers of the Gujarat Forest Department</li>
          <li>With authorized service providers responsible for application hosting, cloud infrastructure, mapping services, or technical support</li>
          <li>With RECAP4NDC project partners (such as GIZ) in aggregated or anonymized form for reporting, monitoring, and evaluation</li>
          <li>To protect legal rights, prevent fraud, or ensure system security</li>
        </ul>
        <p>We never sell user information to third parties.</p>

        <h3>6. Data Security</h3>
        <p>We implement appropriate administrative, technical, and physical safeguards to protect information from unauthorized access, misuse, disclosure, alteration, or destruction.</p>
        <p>Although no electronic system can guarantee absolute security, we follow industry-standard security practices to safeguard user information.</p>

        <h3>7. Third-Party Services</h3>
        <p>To ensure reliable application performance and operational efficiency, the Forest Patrolling &amp; Monitoring System may integrate trusted third-party services such as:</p>
        <ul>
          <li>Cloud hosting services</li>
          <li>Mapping and GIS services</li>
          <li>Analytics and diagnostic tools</li>
          <li>Technical support services</li>
        </ul>
        <p>These services process data in accordance with their respective privacy policies and only as necessary for operating the application.</p>

        <h3>8. Children&rsquo;s Privacy</h3>
        <p>The Forest Patrolling &amp; Monitoring System is intended exclusively for authorized government officials, forest personnel, and other authorized users.</p>
        <p>It is not intended for individuals under 18 years of age, and we do not knowingly collect information from minors.</p>

        <h3>9. Contact Us</h3>
        <p>For questions regarding this Privacy Policy, data security, or account deletion requests, please contact:</p>
        <p>Gujarat Forest Department<br />RECAP4NDC &ndash; Forest Patrolling &amp; Monitoring System<br />Website: https://forestrecap.gisfy.co.in/<br />Email: gujfd@gmail.com</p>

       
        
        <Link to="/login" className="legal-back-link legal-back-link-bottom">&larr; Back to Login</Link>
      </div>
    </div>
  );
}

export default PrivacyPolicy;

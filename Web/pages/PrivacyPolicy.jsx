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
        <p>We are committed to protecting the privacy and security of all authorized users. This Privacy Policy explains how we collect, use, store, disclose, and safeguard information when you access and use the Forest Monitoring &amp; Patrolling System.</p>

        <h3>1. Developer Information</h3>
        <p>Organization:<br />Project: RECAP4NDC &ndash; Forest Monitoring &amp; Patrolling System<br />Website: https://forestrecap.gisfy.co.in/<br />Email: gujfd@gmail.com</p>

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
        <p>To ensure reliable application performance and operational efficiency, the Forest Monitoring &amp; Patrolling System may integrate trusted third-party services such as:</p>
        <ul>
          <li>Cloud hosting services</li>
          <li>Mapping and GIS services</li>
          <li>Analytics and diagnostic tools</li>
          <li>Technical support services</li>
        </ul>
        <p>These services process data in accordance with their respective privacy policies and only as necessary for operating the application.</p>

        <h3>8. Children&rsquo;s Privacy</h3>
        <p>The Forest Monitoring &amp; Patrolling System is intended exclusively for authorized government officials, forest personnel, and other authorized users.</p>
        <p>It is not intended for individuals under 18 years of age, and we do not knowingly collect information from minors.</p>

        <h3>9. Contact Us</h3>
        <p>For questions regarding this Privacy Policy, data security, or account deletion requests, please contact:</p>
        <p>Gujarat Forest Department<br />RECAP4NDC &ndash; Forest Monitoring &amp; Patrolling System<br />Website: https://forestrecap.gisfy.co.in/<br />Email: gujfd@gmail.com</p>

        <hr className="legal-divider" />

        {/* ===================== TERMS OF USE ===================== */}
        <h1 className="legal-title">TERMS OF USE</h1>
        <h2 className="legal-subtitle">FOREST PATROLLING &amp; MONITORING SYSTEM</h2>
        <p className="legal-updated">Last Updated: 9 July 2026</p>

        <p>These Terms of Use govern access to and use of the Gujarat Forest Department's Forest Patrolling &amp; Monitoring System.</p>
        <p>By accessing or using the Forest Patrolling &amp; Monitoring System, you agree to comply with these Terms.</p>

        <h3>1. Eligibility and Authorization</h3>
        <p>Access to the Forest Patrolling &amp; Monitoring System is restricted to authorized personnel, employees, contractors, or agents of the Gujarat Forest Department acting within the scope of their official responsibilities.</p>
        <p>Users are responsible for maintaining the confidentiality and security of their login credentials. Credential sharing with unauthorized individuals is strictly prohibited.</p>

        <h3>2. Permitted Use</h3>
        <p>The Forest Patrolling &amp; Monitoring System may only be used for official forest patrolling, monitoring, conservation, and enforcement activities.</p>
        <p>Users agree that they will not:</p>
        <ul>
          <li>Use the Forest Patrolling &amp; Monitoring System for personal or commercial purposes;</li>
          <li>Circumvent or disable security controls or location tracking mechanisms;</li>
          <li>Attempt to reverse engineer, modify, or interfere with the Forest Patrolling &amp; Monitoring System; or</li>
          <li>Share patrol data or operational information without authorization.</li>
        </ul>

        <h3>3. Ownership of Data</h3>
        <p>All patrol information, location records, operational data, and derived outputs generated through the Forest Patrolling &amp; Monitoring System are the property of the Gujarat Forest Department.</p>
        <p>Unauthorized copying, extraction, publication, or distribution of such information is prohibited.</p>

        <h3>4. Availability and Accuracy</h3>
        <p>The Forest Patrolling &amp; Monitoring System is provided on an "AS IS" and "AS AVAILABLE" basis.</p>
        <p>The Gujarat Forest Department, GIZ, RECAP4NDC, and the system developers do not guarantee uninterrupted service availability or the accuracy of GPS positioning, particularly in areas with limited network connectivity or satellite coverage.</p>

        <h3>5. Limitation of Liability</h3>
        <p>To the fullest extent permitted by applicable law, the Gujarat Forest Department, GIZ, RECAP4NDC, and associated developers shall not be liable for any indirect, incidental, consequential, or special damages arising from the use of the Forest Patrolling &amp; Monitoring System.</p>

        <h3>6. Indemnification</h3>
        <p>Users agree to indemnify and hold harmless the Gujarat Forest Department, GIZ, RECAP4NDC, and their respective officers, employees, and representatives against claims arising from unauthorized use or misuse of the Forest Patrolling &amp; Monitoring System.</p>

        <h3>7. Intellectual Property</h3>
        <p>The Forest Patrolling &amp; Monitoring System software, interface, documentation, source code, maps, and associated datasets are protected by applicable intellectual property laws.</p>
        <p>Unless otherwise specified, ownership remains with the Gujarat Forest Department, RECAP4NDC, GIZ, or their licensors.</p>

        <h3>8. Governing Law</h3>
        <p>These Terms shall be governed by the laws of India.</p>
        <p>Any disputes arising from these Terms or the use of the Forest Patrolling &amp; Monitoring System shall be subject to the exclusive jurisdiction of the competent courts located in Gandhinagar, Gujarat.</p>

        <h3>9. Privacy Notice</h3>
        <p>By using the Forest Patrolling &amp; Monitoring System, users acknowledge that location information is processed in accordance with the Privacy Notice described above.</p>

        <Link to="/login" className="legal-back-link legal-back-link-bottom">&larr; Back to Login</Link>
      </div>
    </div>
  );
}

export default PrivacyPolicy;

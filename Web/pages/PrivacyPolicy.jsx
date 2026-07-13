import React from "react";
import { Link } from "react-router-dom";
import "./PrivacyPolicy.css";

function PrivacyPolicy() {
  return (
    <div className="legal-page">
      <div className="legal-container">
        <Link to="/login" className="legal-back-link">&larr; Back to Login</Link>

        {/* ===================== PRIVACY NOTICE ===================== */}
        <h1 className="legal-title">PRIVACY NOTICE &ndash; INDIA</h1>
        <h2 className="legal-subtitle">FOREST PATROLLING &amp; MONITORING SYSTEM</h2>
        <p className="legal-updated">Last Updated: 9 July 2026</p>

        <p>This Privacy Notice explains how the Gujarat Forest Department collects, uses, stores, and shares information in connection with the provision of forest patrolling and monitoring services through the Forest Patrolling &amp; Monitoring System.</p>
        <p>The Forest Patrolling &amp; Monitoring System has been developed for the Gujarat Forest Department under the RECAP4NDC Project implemented by Deutsche Gesellschaft f&uuml;r Internationale Zusammenarbeit (GIZ) GmbH.</p>
        <p>This Privacy Notice applies to the Forest Patrolling &amp; Monitoring System available at https://forestrecap.gisfy.co.in/ and all related services associated with the Gujarat Forest Department.</p>

        <h3>1. Information We Collect</h3>
        <p>The Gujarat Forest Department is designed to minimize data collection and only collects information that is necessary for operational forest patrolling activities.</p>
        <h4>Location Information</h4>
        <p>During active patrol operations, the Gujarat Forest Department collects:</p>
        <ul>
          <li>GPS coordinates of patrol locations;</li>
          <li>Patrol route information;</li>
          <li>Date and time stamps associated with location events; and</li>
          <li>Device identifiers required for synchronization, authentication, and operational continuity.</li>
        </ul>
        <h4>Technical Device Information</h4>
        <p>The Gujarat Forest Department may collect limited technical information required for system functionality and troubleshooting, including:</p>
        <ul>
          <li>Device model;</li>
          <li>Operating system version;</li>
          <li>Application version; and</li>
          <li>Error and diagnostic logs.</li>
        </ul>

        <h3>2. Information We Do Not Collect</h3>
        <p>The Gujarat Forest Department is not designed to collect or process the following information unless separately provided through departmental systems:</p>
        <ul>
          <li>Personal contact information such as email addresses or phone numbers;</li>
          <li>Demographic information;</li>
          <li>Biometric information;</li>
          <li>Audio recordings;</li>
          <li>Photographs or videos captured for personal purposes; or</li>
          <li>Any other information not required for official forest patrolling operations.</li>
        </ul>

        <h3>3. How We Use Information</h3>
        <p>Collected information is used exclusively for official purposes, including:</p>
        <ul>
          <li>Recording and monitoring patrol routes and coverage areas;</li>
          <li>Supporting forest protection, monitoring, and enforcement activities;</li>
          <li>Providing operational oversight to authorized officers of the Gujarat Forest Department;</li>
          <li>Generating anonymized and aggregated reports for project monitoring and evaluation under RECAP4NDC; and</li>
          <li>Maintaining, securing, and improving the Forest Patrolling &amp; Monitoring System.</li>
        </ul>

        <h3>4. Sharing of Information</h3>
        <p>Information collected through the Gujarat Forest Department's system may be shared only in the following circumstances:</p>
        <h4>Gujarat Forest Department</h4>
        <p>Location information and patrol records are accessible to authorized officers of the Gujarat Forest Department for operational supervision and management purposes.</p>
        <h4>Service Providers</h4>
        <p>Information may be processed by authorized hosting, cloud infrastructure, mapping, or technical support providers strictly for the purpose of operating and maintaining the Forest Patrolling &amp; Monitoring System.</p>
        <h4>Project Partners</h4>
        <p>Aggregated and anonymized information, such as patrol coverage statistics and heat maps, may be shared with GIZ and RECAP4NDC partners for project reporting, monitoring, and evaluation purposes.</p>
        <h4>Legal Requirements</h4>
        <p>Information may be disclosed where required by applicable law, court order, or governmental authority.</p>

        <h3>5. Location Permissions</h3>
        <p>Location access is essential for the intended functionality of the Forest Patrolling &amp; Monitoring System.</p>
        <p>Disabling location permissions may prevent the Gujarat Forest Department from recording patrol activities and may limit or disable core operational features required for official duties.</p>

        <h3>6. Data Storage and Retention</h3>
        <p>Data collected through the Forest Patrolling &amp; Monitoring System is stored on infrastructure located in India and retained in accordance with:</p>
        <ul>
          <li>Gujarat Forest Department record retention policies;</li>
          <li>Applicable legal requirements; and</li>
          <li>RECAP4NDC project obligations.</li>
        </ul>
        <p>Following the expiry of retention requirements, data may be securely deleted or anonymized.</p>

        <h3>7. International Data Transfers</h3>
        <p>The Gujarat Forest Department primarily stores and processes data within India. Any international access for technical support or project management purposes will be subject to appropriate safeguards and applicable legal requirements.</p>

        <h3>8. Changes to this Privacy Notice</h3>
        <p>This Privacy Notice may be updated from time to time to reflect operational, legal, or technical changes. Updated versions will be published through the Forest Patrolling &amp; Monitoring System.</p>

        <h3>9. Contact Information</h3>
        <p>For questions regarding this Privacy Notice, please contact:</p>
        <p>Gujarat Forest Department<br />RECAP4NDC Project<br />Email: [Project Coordinator Email]</p>

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

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
        <h2 className="legal-subtitle">FMPS (Forest Monitoring &amp; Patrolling System)</h2>
        <p className="legal-updated">Last Updated: 20 July 2026</p>

        <p>The FMPS (Forest Monitoring &amp; Patrolling System) is developed for the Gujarat Forest Department under the RECAP4NDC Project, implemented by Deutsche Gesellschaft f&uuml;r Internationale Zusammenarbeit (GIZ) GmbH. The application is managed and maintained by the Gujarat Forest Department to support official forest patrolling, monitoring, conservation, and enforcement activities.</p>
        <p>The Gujarat Forest Department is committed to protecting the privacy and security of all authorized users. This Privacy Policy explains how information is collected, used, stored, disclosed, and safeguarded when you access and use the FMPS (Forest Monitoring &amp; Patrolling System).</p>
<p>FMPS (The Forest Monitoring and Patrolling System)  is a mobile application developed to support forest patrolling and monitoring activities. The application enables authorized forest personnel to record patrolling activities, maintain digital patrolling records, view coupe boundaries and patrolling routes, capture geo-tagged photographs, and monitor changes in forest cover. These features help improve the efficiency, transparency, and effectiveness of forest field operations.  </p>
        <h3>1. Developer Information</h3>
        <p>Organization: Gujarat Forest Department<br />Project:&ndash; FMPS (Forest Monitoring &amp; Patrolling System)<br />Email: gujfdp@gmail.com</p>

        <h3>2. Information We Collect</h3>
        <p>The application collects only the information necessary to perform official forest patrolling and monitoring activities.</p>
        <p>Depending on the features used, the application may collect:</p>
        <ul>
          <li>GPS location</li>
          <li>Background location (during active patrols only)</li>
          <li>Patrol routes</li>
          <li>Date and time of patrol activities</li>
          <li>Patrol photographs captured using the device camera</li>
        </ul>
        <p>The application does not collect information that is not required for official operational purposes.</p>

        <h3>3. Permissions Used</h3>

        <h4>Camera</h4>
        <p>Used for:</p>
        <ul>
          <li>Capturing patrol photographs during official field activities</li>
        </ul>
        <p>The camera is accessed only after your permission is granted.</p>

        <h4>Location (Foreground)</h4>
        <p>Used for:</p>
        <ul>
          <li>Recording patrol routes</li>
          <li>Verifying patrol locations</li>
          <li>Supporting Coupe Boundary Navigation</li>
        </ul>
        <p>Location access is essential for the proper functioning of the application.</p>

        <h4>Background Location</h4>
        <p>During an active patrol, the application may continue to access your location while running in the background to:</p>
        <ul>
          <li>Continuously record patrol routes</li>
          <li>Verify patrol locations</li>
          <li>Support Coupe Boundary Navigation</li>
          <li>Ensure uninterrupted patrol tracking when the application is minimized or the device screen is turned off</li>
        </ul>
        <p>Background location is used only during official forest patrolling activities.</p>

        <h4>Storage / Photos</h4>
        <p>Used for:</p>
        <ul>
          <li>Uploading patrol photographs captured through the application</li>
        </ul>

        <h3>4. How We Use Your Information</h3>
        <p>The collected information is used exclusively for official government purposes, including:</p>
        <ul>
          <li>Recording and monitoring forest patrol activities</li>
          <li>Tracking patrol routes and field visits</li>
          <li>Supporting forest protection and monitoring operations</li>
          <li>Verifying field activity records</li>
          <li>Improving application performance and reliability</li>
          <li>Maintaining application security</li>
        </ul>
        <p>Your personal information is never sold or used for commercial advertising.</p>

        <h3>5. Information Sharing</h3>
        <p>Information may be shared only when necessary:</p>
        <ul>
          <li>With authorized officers of the Gujarat Forest Department</li>
          <li>With authorized service providers responsible for application hosting, mapping services, cloud infrastructure, or technical support</li>
          <li>With RECAP4NDC project partners (such as GIZ) only in aggregated or anonymized form for monitoring, reporting, and evaluation purposes</li>
          <li>When required by applicable law or to protect the security and integrity of the application</li>
        </ul>
        <p>User information is never sold to third parties.</p>

        <h3>6. Data Security</h3>
        <p>Appropriate administrative, technical, and physical safeguards are implemented to protect information from unauthorized access, misuse, disclosure, alteration, or destruction.</p>
        <p>Although no electronic system can guarantee absolute security, industry-standard security practices are followed to safeguard user information.</p>

        <h3>7. Third-Party Services</h3>
        <p>The application may use trusted third-party services necessary for its operation, including:</p>
        <ul>
          <li>Cloud hosting services</li>
          <li>Mapping and GIS services</li>
          <li>Technical support services</li>
        </ul>
        <p>These services process data only as required for operating the application and in accordance with applicable privacy and security requirements.</p>

        <h3>8. Children&rsquo;s Privacy</h3>
        <p>The FMPS (Forest Monitoring &amp; Patrolling System) is intended exclusively for authorized government officials, forest personnel, and other authorized users.</p>
        <p>It is not intended for individuals under 18 years of age, and the application does not knowingly collect information from children.</p>

        <h3>9. Contact Us</h3>
        <p>For questions regarding this Privacy Policy or data protection practices, please contact:</p>
        <p>Gujarat Forest Department<br /> &ndash; FMPS (Forest Monitoring &amp; Patrolling System)<br />Email: gujfdp@gmail.com</p>

       
        <Link to="/login" className="legal-back-link legal-back-link-bottom">&larr; Back to Login</Link>
      </div>
    </div>
  );
}

export default PrivacyPolicy;

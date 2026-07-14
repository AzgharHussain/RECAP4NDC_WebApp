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
        <h2 className="legal-subtitle">VKY WORK TRACKER</h2>

        <p>VKY WORK TRACKER is developed, managed, and maintained by the Commissionerate of Tribal Development, Gujarat. We are committed to maintaining the highest standards of privacy protection for our users and ensuring that your personal and professional information is handled with absolute security, transparency, and responsibility.</p>
        <p>This Privacy Policy outlines how VKY WORK TRACKER collects, uses, stores, discloses, and safeguards your data when you install and interact with our mobile application.</p>

        <h3>1. Developer Information</h3>
        <p><strong>Developer Name:</strong> Commissionerate of Tribal Development, Gujarat</p>
        <p><strong>Developer Website:</strong> <a href="https://vky.gujarat.gov.in/" target="_blank" rel="noopener noreferrer">https://vky.gujarat.gov.in/</a></p>
        <p><strong>Office Address:</strong><br />1st Floor, Birsa Munda Bhavan, Sector-10/A, Gandhinagar, Gujarat, India.</p>
        <p><strong>Email:</strong> <a href="mailto:jasvantm@gujarat.gov.in">jasvantm@gujarat.gov.in</a></p>
        <p><strong>Phone:</strong> +91 9662511327</p>

        <h3>2. Information We Collect</h3>
        <p>Depending on the features you use, the application may collect:</p>
        <ul>
          <li>Username</li>
          <li>Location</li>
          <li>Camera Images</li>
          <li>Work Reports</li>
          <li>Usage Logs</li>
        </ul>
        <p>We collect only the information necessary for providing official application services.</p>

        <h3>3. Permissions Used</h3>
        <p>The application may request the following permissions:</p>
        <h4>Camera</h4>
        <p>Used for:</p>
        <ul>
          <li>Capturing work photographs</li>
          <li>Attendance verification</li>
          <li>Document uploads</li>
        </ul>
        <p>The camera is never accessed without your permission.</p>
        <h4>Location</h4>
        <p>Used for:</p>
        <ul>
          <li>Attendance marking</li>
          <li>Field visit tracking</li>
          <li>Work location verification</li>
        </ul>
        <h4>Storage / Photos</h4>
        <p>Used for:</p>
        <ul>
          <li>Uploading images</li>
          <li>Selecting files</li>
        </ul>

        <h3>4. How We Use Your Information</h3>
        <p>We use collected information to:</p>
        <ul>
          <li>Authenticate users</li>
          <li>Track work</li>
          <li>Verify work location</li>
          <li>Generate work reports</li>
          <li>Improve application performance</li>
          <li>Resolve technical issues</li>
          <li>Ensure application security</li>
        </ul>
        <p>We do not sell your personal information.</p>

        <h3>5. Information Sharing</h3>
        <p>Your information may be shared only:</p>
        <ul>
          <li>With authorized government departments</li>
          <li>With service providers working on behalf of the application</li>
          <li>When required by law</li>
          <li>To protect legal rights or prevent fraud</li>
        </ul>
        <p>We never sell user data to third parties.</p>

        <h3>6. Data Security</h3>
        <p>We implement reasonable administrative, technical, and physical safeguards to protect your information against unauthorized access, misuse, or disclosure.</p>
        <p>Although no method of electronic transmission is completely secure, we strive to use industry standard security practices.</p>

        <h3>7. Data Retention and Account Deletion</h3>
        <p>Your information is stored in active databases only for the period necessary to execute official workflows, fulfill compliance audits, or maintain institutional history.</p>
        <p><strong>Account &amp; Data Deletion:</strong> To comply with Google Play Console guidelines, users can request the complete deletion of their account profile and associated personal details. Deletion requests are subject to institutional verification and record-retention laws. To initiate an account or data deletion request, please reach out to your department supervisor or contact us directly at <a href="mailto:jasvantm@gujarat.gov.in">jasvantm@gujarat.gov.in</a>.</p>

        <h3>8. Third-Party Services</h3>
        <p>To optimize operational framework and stability, the app embeds a minimal number of trusted third-party Software Development Kits (SDKs) which manage data under their independent privacy frameworks:</p>

        <h3>9. Children's Privacy</h3>
        <p>VKY WORK TRACKER is structured strictly for authorized adult professionals and government workforce personnel. It is not intended for individuals below the age of 18, and we do not knowingly track or record information belonging to minors.</p>

        <h3>10. Contact Us</h3>
        <p>For data deletion executions, general privacy concerns, or security inquiries, please contact:</p>
        <p>Commissionerate of Tribal Development, Gujarat<br />1st Floor, Birsa Munda Bhavan, Sector-10/A<br />Gandhinagar, Gujarat, India<br />Website: <a href="https://vky.gujarat.gov.in/" target="_blank" rel="noopener noreferrer">https://vky.gujarat.gov.in/</a><br />Email: <a href="mailto:jasvantm@gujarat.gov.in">jasvantm@gujarat.gov.in</a><br />Phone: +91 9662511327</p>

        <Link to="/login" className="legal-back-link legal-back-link-bottom">&larr; Back to Login</Link>
      </div>
    </div>
  );
}

export default PrivacyPolicy;

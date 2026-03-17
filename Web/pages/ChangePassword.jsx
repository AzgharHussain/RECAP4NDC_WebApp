import React, { useState, useEffect } from "react";
import { useLanguage } from "../context/LanguageContext";
import axios from "axios";
import { API_BASE_URL } from '../config';
import {
  FiLock, FiCheckCircle, FiAlertCircle, FiRefreshCw, 
  FiEye, FiKey, FiUser, FiSave, FiX, FiShield
} from "react-icons/fi";
import "./Changepassword.css";

function ChangePassword() {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState({
    current: false,
    new: false,
    confirm: false
  });
  
  // Get username from token/session
  const [userData, setUserData] = useState({
    username: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });

  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    hasLower: false,
    hasUpper: false,
    hasNumber: false,
    hasSpecial: false,
    minLength: false
  });

  useEffect(() => {
    // Get username from token or localStorage
    const getUserFromToken = () => {
      try {
        // First try to get from localStorage (your existing session)
        const token = localStorage.getItem('token');
        const userStr = localStorage.getItem('user');
        
        if (token) {
          try {
            // Decode JWT token to get username
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
              return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            const decoded = JSON.parse(jsonPayload);
            
            if (decoded.username) {
              setUserData(prev => ({ ...prev, username: decoded.username }));
              return;
            }
          } catch (e) {
            console.error("Error decoding token:", e);
          }
        }
        
        // Fallback to user object in localStorage
        if (userStr) {
          const user = JSON.parse(userStr);
          if (user.username) {
            setUserData(prev => ({ ...prev, username: user.username }));
            return;
          }
        }
        
        // If still no username, check session from your previous code
        const sessionData = localStorage.getItem('session');
        if (sessionData) {
          const parsed = JSON.parse(sessionData);
          if (parsed.user && parsed.user.username) {
            setUserData(prev => ({ ...prev, username: parsed.user.username }));
            return;
          }
        }
        
        console.warn("Could not find username in session");
        setError("Unable to identify user. Please log in again.");
        
      } catch (error) {
        console.error("Error parsing user data:", error);
        setError("Error loading user information");
      }
    };

    getUserFromToken();
  }, []);

  // Check password strength in real-time
  useEffect(() => {
    const password = userData.newPassword;
    if (password) {
      setPasswordStrength({
        hasLower: /[a-z]/.test(password),
        hasUpper: /[A-Z]/.test(password),
        hasNumber: /[0-9]/.test(password),
        hasSpecial: /[!@#$%^&*]/.test(password),
        minLength: password.length >= 6
      });
    } else {
      setPasswordStrength({
        score: 0,
        hasLower: false,
        hasUpper: false,
        hasNumber: false,
        hasSpecial: false,
        minLength: false
      });
    }
  }, [userData.newPassword]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setUserData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear messages when user starts typing
    setError("");
    setSuccess("");
  };

  const togglePasswordVisibility = (field) => {
    setShowPassword(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const validateForm = () => {
    if (!userData.username) {
      setError("User not identified. Please log in again.");
      return false;
    }
    
    if (!userData.currentPassword) {
      setError("Current password is required");
      return false;
    }
    
    if (!userData.newPassword) {
      setError("New password is required");
      return false;
    }
    
    if (userData.newPassword.length < 6) {
      setError("New password must be at least 6 characters long");
      return false;
    }
    
    // Check password complexity
    const hasLower = /[a-z]/.test(userData.newPassword);
    const hasUpper = /[A-Z]/.test(userData.newPassword);
    const hasNumber = /[0-9]/.test(userData.newPassword);
    const hasSpecial = /[!@#$%^&*]/.test(userData.newPassword);
    
    if (!(hasLower && hasUpper && hasNumber && hasSpecial)) {
      setError("Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character");
      return false;
    }
    
    if (userData.newPassword !== userData.confirmPassword) {
      setError("New passwords do not match");
      return false;
    }
    
    if (userData.currentPassword === userData.newPassword) {
      setError("New password must be different from current password");
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        setError("No authentication token found. Please log in again.");
        setLoading(false);
        return;
      }

      console.log("Sending password change request for:", userData.username);
      
      // Make API call to change password
      const response = await axios.post(
        `${API_BASE_URL}/api/changepassword`,
        {
          username: userData.username,
          currentPassword: userData.currentPassword,
          newPassword: userData.newPassword
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log("Password change response:", response.data);
      
      if (response.data.success) {
        setSuccess(response.data.message || "Password changed successfully!");
        // Clear password fields
        setUserData(prev => ({
          ...prev,
          currentPassword: "",
          newPassword: "",
          confirmPassword: ""
        }));
        
        // Optionally redirect to login after 3 seconds
        setTimeout(() => {
          // You might want to logout the user and redirect to login
          // localStorage.clear();
          // window.location.href = '/login';
        }, 3000);
      } else {
        setError(response.data.error || "Failed to change password");
      }
    } catch (err) {
      console.error("Error changing password:", err);
      
      if (err.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.error("Error response:", err.response.data);
        console.error("Error status:", err.response.status);
        
        if (err.response.status === 401) {
          setError(err.response.data.error || "Current password is incorrect");
        } else if (err.response.status === 403) {
          setError(err.response.data.error || "You don't have permission to change this password");
        } else if (err.response.status === 400) {
          setError(err.response.data.error || "Invalid password format");
        } else {
          setError(err.response.data.error || "Server error occurred");
        }
      } else if (err.request) {
        // The request was made but no response was received
        console.error("No response received:", err.request);
        setError("No response from server. Please check your connection.");
      } else {
        // Something happened in setting up the request that triggered an Error
        console.error("Error setting up request:", err.message);
        setError("Failed to change password. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setUserData(prev => ({
      ...prev,
      currentPassword: "",
      newPassword: "",
      confirmPassword: ""
    }));
    setError("");
    setSuccess("");
  };

  const calculateStrengthScore = () => {
    const { hasLower, hasUpper, hasNumber, hasSpecial, minLength } = passwordStrength;
    const criteria = [hasLower, hasUpper, hasNumber, hasSpecial, minLength];
    const metCount = criteria.filter(Boolean).length;
    
    if (metCount <= 2) return "weak";
    if (metCount <= 4) return "medium";
    return "strong";
  };

  return (
    <div className="change-password-container">
      <div className="page-header">
        <h2>
          <FiLock className="page-icon" />
          Change Password
        </h2>
        <p className="page-description">
          Update your account password. Choose a strong password that you don't use elsewhere.
        </p>
      </div>

      <div className="change-password-content">
        <div className="password-form-wrapper">
          <form onSubmit={handleSubmit} className="password-form">
            {error && (
              <div className="error-message">
                <FiAlertCircle className="error-icon" />
                <span>{error}</span>
              </div>
            )}
            
            {success && (
              <div className="success-message">
                <FiCheckCircle className="success-icon" />
                <span>{success}</span>
              </div>
            )}

            <div className="form-group">
              <label>
                <FiUser className="field-icon" />
                Username
              </label>
              <input
                type="text"
                value={userData.username}
                readOnly
                disabled
                className="username-input"
              />
            </div>

            <div className="form-group">
              <label>
                <FiKey className="field-icon" />
                Current Password
              </label>
              <div className="password-input-wrapper">
                <input
                  type={showPassword.current ? "text" : "password"}
                  name="currentPassword"
                  value={userData.currentPassword}
                  onChange={handleInputChange}
                  placeholder="Enter your current password"
                  className="password-input"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility('current')}
                  className="password-toggle"
                  tabIndex="-1"
                >
                  <FiEye />
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>
                <FiShield className="field-icon" />
                New Password
              </label>
              <div className="password-input-wrapper">
                <input
                  type={showPassword.new ? "text" : "password"}
                  name="newPassword"
                  value={userData.newPassword}
                  onChange={handleInputChange}
                  placeholder="Enter new password"
                  className="password-input"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility('new')}
                  className="password-toggle"
                  tabIndex="-1"
                >
                  <FiEye />
                </button>
              </div>
              
              {userData.newPassword && (
                <div className="password-strength-meter">
                  <div className="strength-bars">
                    <div className={`strength-bar ${passwordStrength.minLength ? 'met' : ''}`} />
                    <div className={`strength-bar ${passwordStrength.hasLower ? 'met' : ''}`} />
                    <div className={`strength-bar ${passwordStrength.hasUpper ? 'met' : ''}`} />
                    <div className={`strength-bar ${passwordStrength.hasNumber ? 'met' : ''}`} />
                    <div className={`strength-bar ${passwordStrength.hasSpecial ? 'met' : ''}`} />
                  </div>
                  <span className={`strength-text strength-${calculateStrengthScore()}`}>
                    Password Strength: {calculateStrengthScore()}
                  </span>
                </div>
              )}

              <div className="password-requirements">
                <p>Password must contain:</p>
                <ul>
                  <li className={passwordStrength.minLength ? 'requirement-met' : ''}>
                    ✓ At least 6 characters
                  </li>
                  <li className={passwordStrength.hasLower ? 'requirement-met' : ''}>
                    ✓ One lowercase letter
                  </li>
                  <li className={passwordStrength.hasUpper ? 'requirement-met' : ''}>
                    ✓ One uppercase letter
                  </li>
                  <li className={passwordStrength.hasNumber ? 'requirement-met' : ''}>
                    ✓ One number
                  </li>
                  <li className={passwordStrength.hasSpecial ? 'requirement-met' : ''}>
                    ✓ One special character (!@#$%^&*)
                  </li>
                </ul>
              </div>
            </div>

            <div className="form-group">
              <label>
                <FiLock className="field-icon" />
                Confirm New Password
              </label>
              <div className="password-input-wrapper">
                <input
                  type={showPassword.confirm ? "text" : "password"}
                  name="confirmPassword"
                  value={userData.confirmPassword}
                  onChange={handleInputChange}
                  placeholder="Confirm new password"
                  className="password-input"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility('confirm')}
                  className="password-toggle"
                  tabIndex="-1"
                >
                  <FiEye />
                </button>
              </div>
              {userData.confirmPassword && userData.newPassword !== userData.confirmPassword && (
                <small className="password-mismatch">Passwords do not match</small>
              )}
            </div>

            <div className="form-actions">
              <button 
                type="submit" 
                className="submit-btn"
                disabled={loading || !userData.username}
              >
                {loading ? (
                  <>
                    <FiRefreshCw className="spin" />
                    Changing Password...
                  </>
                ) : (
                  <>
                    <FiSave />
                    Change Password
                  </>
                )}
              </button>
              
              <button 
                type="button" 
                onClick={handleCancel}
                className="cancel-btn"
                disabled={loading}
              >
                <FiX />
                Clear
              </button>
            </div>
          </form>
        </div>

        <div className="password-info-panel">
          <h3>Password Guidelines</h3>
          <div className="info-section">
            <h4>Requirements:</h4>
            <ul>
              <li>Minimum 6 characters</li>
              <li>At least one uppercase letter (A-Z)</li>
              <li>At least one lowercase letter (a-z)</li>
              <li>At least one number (0-9)</li>
              <li>At least one special character (!@#$%^&*)</li>
            </ul>
          </div>
          
          <div className="info-section">
            <h4>Recommendations:</h4>
            <ul>
              <li>Use a unique password</li>
              <li>Avoid common words or phrases</li>
              <li>Don't reuse passwords from other sites</li>
              <li>Consider using a password manager</li>
            </ul>
          </div>
          
          <div className="info-note">
            <FiAlertCircle />
            <p>
              After changing your password, you'll need to use the new password 
              for your next login.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChangePassword;
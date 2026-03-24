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
  const { language } = useLanguage();
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

  // Translations
  const translations = {
    en: {
      title: "Change Password",
      description: "Update your account password. Choose a strong password that you don't use elsewhere.",
      errorTitle: "Error",
      successTitle: "Success",
      username: "Username",
      currentPassword: "Current Password",
      currentPasswordPlaceholder: "Enter your current password",
      newPassword: "New Password",
      newPasswordPlaceholder: "Enter new password",
      confirmPassword: "Confirm New Password",
      confirmPasswordPlaceholder: "Confirm new password",
      passwordStrength: "Password Strength",
      weak: "Weak",
      medium: "Medium",
      strong: "Strong",
      passwordRequirements: "Password must contain:",
      minLength: "At least 6 characters",
      lowercase: "One lowercase letter",
      uppercase: "One uppercase letter",
      number: "One number",
      specialChar: "One special character (!@#$%^&*)",
      passwordMismatch: "Passwords do not match",
      changePassword: "Change Password",
      clear: "Clear",
      changingPassword: "Changing Password...",
      passwordGuidelines: "Password Guidelines",
      requirements: "Requirements:",
      recommendations: "Recommendations:",
      uniquePassword: "Use a unique password",
      avoidCommon: "Avoid common words or phrases",
      dontReuse: "Don't reuse passwords from other sites",
      usePasswordManager: "Consider using a password manager",
      infoNote: "After changing your password, you'll need to use the new password for your next login.",
      userNotIdentified: "User not identified. Please log in again.",
      currentPasswordRequired: "Current password is required",
      newPasswordRequired: "New password is required",
      passwordMinLength: "New password must be at least 6 characters long",
      passwordComplexity: "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
      passwordMatch: "New passwords do not match",
      passwordSame: "New password must be different from current password",
      noToken: "No authentication token found. Please log in again.",
      successMessage: "Password changed successfully!",
      failedToChange: "Failed to change password",
      currentPasswordIncorrect: "Current password is incorrect",
      noPermission: "You don't have permission to change this password",
      invalidFormat: "Invalid password format",
      serverError: "Server error occurred",
      connectionError: "No response from server. Please check your connection.",
      tryAgain: "Failed to change password. Please try again."
    },
    gu: {
      title: "પાસવર્ડ બદલો",
      description: "તમારા એકાઉન્ટનો પાસવર્ડ અપડેટ કરો. એક મજબૂત પાસવર્ડ પસંદ કરો જેનો તમે બીજે ક્યાંય ઉપયોગ કરતા નથી.",
      errorTitle: "ભૂલ",
      successTitle: "સફળતા",
      username: "યૂઝરનામ",
      currentPassword: "વર્તમાન પાસવર્ડ",
      currentPasswordPlaceholder: "તમારો વર્તમાન પાસવર્ડ દાખલ કરો",
      newPassword: "નવો પાસવર્ડ",
      newPasswordPlaceholder: "નવો પાસવર્ડ દાખલ કરો",
      confirmPassword: "નવો પાસવર્ડ ચકાસો",
      confirmPasswordPlaceholder: "નવો પાસવર્ડ ચકાસો",
      passwordStrength: "પાસવર્ડની મજબૂતાઈ",
      weak: "નબળો",
      medium: "મધ્યમ",
      strong: "મજબૂત",
      passwordRequirements: "પાસવર્ડમાં આ હોવું જરૂરી છે:",
      minLength: "ઓછામાં ઓછા 6 અક્ષરો",
      lowercase: "એક નાનો અક્ષર (a-z)",
      uppercase: "એક મોટો અક્ષર (A-Z)",
      number: "એક આંકડો (0-9)",
      specialChar: "એક વિશેષ અક્ષર (!@#$%^&*)",
      passwordMismatch: "પાસવર્ડ મેળ ખાતા નથી",
      changePassword: "પાસવર્ડ બદલો",
      clear: "સાફ કરો",
      changingPassword: "પાસવર્ડ બદલાઈ રહ્યો છે...",
      passwordGuidelines: "પાસવર્ડ માર્ગદર્શિકા",
      requirements: "જરૂરીયાતો:",
      recommendations: "ભલામણો:",
      uniquePassword: "અનોખો પાસવર્ડ ઉપયોગ કરો",
      avoidCommon: "સામાન્ય શબ્દો અથવા શબ્દસમૂહો ટાળો",
      dontReuse: "અન્ય સાઇટ્સના પાસવર્ડનો પુનઃઉપયોગ કરશો નહીં",
      usePasswordManager: "પાસવર્ડ મેનેજરનો ઉપયોગ કરવાનું વિચારો",
      infoNote: "પાસવર્ડ બદલ્યા પછી, તમારે આગામી લોગિન માટે નવા પાસવર્ડનો ઉપયોગ કરવો પડશે.",
      userNotIdentified: "યુઝર ઓળખી શકાયો નથી. કૃપા કરીને ફરીથી લોગિન કરો.",
      currentPasswordRequired: "વર્તમાન પાસવર્ડ જરૂરી છે",
      newPasswordRequired: "નવો પાસવર્ડ જરૂરી છે",
      passwordMinLength: "નવો પાસવર્ડ ઓછામાં ઓછા 6 અક્ષરોનો હોવો જોઈએ",
      passwordComplexity: "પાસવર્ડમાં ઓછામાં ઓછો એક મોટો અક્ષર, એક નાનો અક્ષર, એક આંકડો અને એક વિશેષ અક્ષર હોવો જોઈએ",
      passwordMatch: "નવા પાસવર્ડ મેળ ખાતા નથી",
      passwordSame: "નવો પાસવર્ડ વર્તમાન પાસવર્ડથી અલગ હોવો જોઈએ",
      noToken: "પ્રમાણીકરણ ટોકન મળ્યું નથી. કૃપા કરીને ફરીથી લોગિન કરો.",
      successMessage: "પાસવર્ડ સફળતાપૂર્વક બદલાઈ ગયો!",
      failedToChange: "પાસવર્ડ બદલવામાં નિષ્ફળતા",
      currentPasswordIncorrect: "વર્તમાન પાસવર્ડ ખોટો છે",
      noPermission: "આ પાસવર્ડ બદલવાની તમારી પાસે પરવાનગી નથી",
      invalidFormat: "અમાન્ય પાસવર્ડ ફોર્મેટ",
      serverError: "સર્વર ભૂલ આવી",
      connectionError: "સર્વર તરફથી કોઈ પ્રતિસાદ નથી. કૃપા કરીને તમારું કનેક્શન ચેક કરો.",
      tryAgain: "પાસવર્ડ બદલવામાં નિષ્ફળતા. કૃપા કરીને ફરીથી પ્રયાસ કરો."
    }
  };

  const t = translations[language] || translations.en;

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
        setError(t.userNotIdentified);
        
      } catch (error) {
        console.error("Error parsing user data:", error);
        setError(t.userNotIdentified);
      }
    };

    getUserFromToken();
  }, [t.userNotIdentified]);

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
      setError(t.userNotIdentified);
      return false;
    }
    
    if (!userData.currentPassword) {
      setError(t.currentPasswordRequired);
      return false;
    }
    
    if (!userData.newPassword) {
      setError(t.newPasswordRequired);
      return false;
    }
    
    if (userData.newPassword.length < 6) {
      setError(t.passwordMinLength);
      return false;
    }
    
    // Check password complexity
    const hasLower = /[a-z]/.test(userData.newPassword);
    const hasUpper = /[A-Z]/.test(userData.newPassword);
    const hasNumber = /[0-9]/.test(userData.newPassword);
    const hasSpecial = /[!@#$%^&*]/.test(userData.newPassword);
    
    if (!(hasLower && hasUpper && hasNumber && hasSpecial)) {
      setError(t.passwordComplexity);
      return false;
    }
    
    if (userData.newPassword !== userData.confirmPassword) {
      setError(t.passwordMatch);
      return false;
    }
    
    if (userData.currentPassword === userData.newPassword) {
      setError(t.passwordSame);
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
        setError(t.noToken);
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
        setSuccess(t.successMessage);
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
        setError(response.data.error || t.failedToChange);
      }
    } catch (err) {
      console.error("Error changing password:", err);
      
      if (err.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.error("Error response:", err.response.data);
        console.error("Error status:", err.response.status);
        
        if (err.response.status === 401) {
          setError(err.response.data.error || t.currentPasswordIncorrect);
        } else if (err.response.status === 403) {
          setError(err.response.data.error || t.noPermission);
        } else if (err.response.status === 400) {
          setError(err.response.data.error || t.invalidFormat);
        } else {
          setError(err.response.data.error || t.serverError);
        }
      } else if (err.request) {
        // The request was made but no response was received
        console.error("No response received:", err.request);
        setError(t.connectionError);
      } else {
        // Something happened in setting up the request that triggered an Error
        console.error("Error setting up request:", err.message);
        setError(t.tryAgain);
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
    
    if (metCount <= 2) return t.weak;
    if (metCount <= 4) return t.medium;
    return t.strong;
  };

  const getStrengthClass = () => {
    const strength = calculateStrengthScore();
    if (strength === t.weak) return "weak";
    if (strength === t.medium) return "medium";
    return "strong";
  };

  return (
    <div className="change-password-container">
      <div className="page-header">
        <h2>
          <FiLock className="page-icon" />
          {t.title}
        </h2>
        <p className="page-description">
          {t.description}
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
                {t.username}
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
                {t.currentPassword}
              </label>
              <div className="password-input-wrapper">
                <input
                  type={showPassword.current ? "text" : "password"}
                  name="currentPassword"
                  value={userData.currentPassword}
                  onChange={handleInputChange}
                  placeholder={t.currentPasswordPlaceholder}
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
                {t.newPassword}
              </label>
              <div className="password-input-wrapper">
                <input
                  type={showPassword.new ? "text" : "password"}
                  name="newPassword"
                  value={userData.newPassword}
                  onChange={handleInputChange}
                  placeholder={t.newPasswordPlaceholder}
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
                  <span className={`strength-text strength-${getStrengthClass()}`}>
                    {t.passwordStrength}: {calculateStrengthScore()}
                  </span>
                </div>
              )}

              <div className="password-requirements">
                <p>{t.passwordRequirements}</p>
                <ul>
                  <li className={passwordStrength.minLength ? 'requirement-met' : ''}>
                    ✓ {t.minLength}
                  </li>
                  <li className={passwordStrength.hasLower ? 'requirement-met' : ''}>
                    ✓ {t.lowercase}
                  </li>
                  <li className={passwordStrength.hasUpper ? 'requirement-met' : ''}>
                    ✓ {t.uppercase}
                  </li>
                  <li className={passwordStrength.hasNumber ? 'requirement-met' : ''}>
                    ✓ {t.number}
                  </li>
                  <li className={passwordStrength.hasSpecial ? 'requirement-met' : ''}>
                    ✓ {t.specialChar}
                  </li>
                </ul>
              </div>
            </div>

            <div className="form-group">
              <label>
                <FiLock className="field-icon" />
                {t.confirmPassword}
              </label>
              <div className="password-input-wrapper">
                <input
                  type={showPassword.confirm ? "text" : "password"}
                  name="confirmPassword"
                  value={userData.confirmPassword}
                  onChange={handleInputChange}
                  placeholder={t.confirmPasswordPlaceholder}
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
                <small className="password-mismatch">{t.passwordMismatch}</small>
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
                    {t.changingPassword}
                  </>
                ) : (
                  <>
                    <FiSave />
                    {t.changePassword}
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
                {t.clear}
              </button>
            </div>
          </form>
        </div>

        <div className="password-info-panel">
          <h3>{t.passwordGuidelines}</h3>
          <div className="info-section">
            <h4>{t.requirements}</h4>
            <ul>
              <li>{t.minLength}</li>
              <li>{t.uppercase}</li>
              <li>{t.lowercase}</li>
              <li>{t.number}</li>
              <li>{t.specialChar}</li>
            </ul>
          </div>
          
          <div className="info-section">
            <h4>{t.recommendations}</h4>
            <ul>
              <li>{t.uniquePassword}</li>
              <li>{t.avoidCommon}</li>
              <li>{t.dontReuse}</li>
              <li>{t.usePasswordManager}</li>
            </ul>
          </div>
          
          <div className="info-note">
            <FiAlertCircle />
            <p>{t.infoNote}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChangePassword;
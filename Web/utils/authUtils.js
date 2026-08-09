// utils/authUtils.js
// Shared authentication utilities for API calls.
// Provides token retrieval (localStorage + cookie fallback), auth header
// construction, and auto-logout when the token is missing/invalid or a 401
// response is received.
import Cookies from 'js-cookie';

/**
 * Clears all auth-related storage and redirects to the login page.
 * Called when the token is missing/null or when a 401 response is received.
 */
export const autoLogout = () => {
  // Clear all auth-related storage
  ['session', 'userData', 'token', 'authToken', 'forest_authenticated', 'user', 'admin_token'].forEach(item => {
    localStorage.removeItem(item);
    sessionStorage.removeItem(item);
  });

  // Clear cookies
  ['authToken', 'token', 'role', 'id'].forEach(name => {
    Cookies.remove(name);
    Cookies.remove(name, { path: '/' });
  });

  // Redirect to login page (use replace so user can't go back)
  if (window.location.pathname !== '/') {
    window.location.href = '/';
  }
};

/**
 * Retrieves the auth token from localStorage, with cookie as fallback.
 * Checks localStorage first, then the "authToken" cookie.
 * If both are missing/invalid, triggers auto-logout and returns null.
 * @returns {string|null} The token, or null if auto-logout was triggered.
 */
export const getAuthToken = () => {
  // 1) Try localStorage
  let token = localStorage.getItem('token');

  // 2) Fallback: try authToken cookie
  if (!token || token === 'null' || token === 'undefined' || token.trim() === '') {
    token = Cookies.get('authToken');
  }

  if (!token || token === 'null' || token === 'undefined' || token.trim() === '') {
    console.warn('Auth token is missing or invalid (localStorage + cookie). Auto-logging out.');
    autoLogout();
    return null;
  }

  // Sync: if token came from cookie, restore it to localStorage
  if (!localStorage.getItem('token')) {
    localStorage.setItem('token', token);
  }

  return token;
};

/**
 * Builds the authorization headers for API requests.
 * If the token is missing, auto-logout is triggered and an empty object is returned.
 * @param {Object} extraHeaders - Additional headers to merge (e.g. { 'Content-Type': 'application/json' })
 * @returns {Object} Headers object suitable for fetch/axios.
 */
export const getAuthHeaders = (extraHeaders = {}) => {
  const token = getAuthToken();
  if (!token) return {};
  return {
    Authorization: `Bearer ${token}`,
    ...extraHeaders,
  };
};

/**
 * Checks if an HTTP response status is 401 (Unauthorized).
 * If so, triggers auto-logout.
 * @param {number} status - The HTTP response status code.
 * @returns {boolean} True if auto-logout was triggered, false otherwise.
 */
export const handleUnauthorized = (status) => {
  if (status === 401 || status === 403) {
    console.warn(`Received ${status} response. Auto-logging out.`);
    autoLogout();
    return true;
  }
  return false;
};

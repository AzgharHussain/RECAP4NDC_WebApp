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

/**
 * Returns the logged-in user's division from localStorage userData.
 * Returns null if the user has no division (PCCF/Circle level users with "-").
 * @returns {string|null} The division name, or null if not applicable.
 */
export const getUserDivision = () => {
  try {
    const userDataStr = localStorage.getItem('userData');
    if (!userDataStr) return null;
    const userData = JSON.parse(userDataStr);
    const division = userData?.division;
    if (!division || division === '-' || division.trim() === '') return null;
    return division.trim();
  } catch {
    return null;
  }
};

/**
 * Returns the logged-in user's range from localStorage userData.
 * Returns null if the user has no range.
 * @returns {string|null} The range name, or null if not applicable.
 */
export const getUserRange = () => {
  try {
    const userDataStr = localStorage.getItem('userData');
    if (!userDataStr) return null;
    const userData = JSON.parse(userDataStr);
    const range = userData?.range;
    if (!range || range === '-' || range.trim() === '') return null;
    return range.trim();
  } catch {
    return null;
  }
};

/**
 * Returns the logged-in user's circle from localStorage userData.
 * Returns null if the user has no circle.
 * @returns {string|null} The circle name, or null if not applicable.
 */
export const getUserCircle = () => {
  try {
    const userDataStr = localStorage.getItem('userData');
    if (!userDataStr) return null;
    const userData = JSON.parse(userDataStr);
    const circle = userData?.circle;
    if (!circle || circle === '-' || circle.trim() === '') return null;
    return circle.trim();
  } catch {
    return null;
  }
};

/**
 * Normalizes a division name for fuzzy matching.
 * Removes spaces, hyphens, underscores, and converts to lowercase.
 * "Dahod SF" -> "dahodsf", "Dahod_SF" -> "dahodsf", "dahod-sf" -> "dahodsf"
 */
const normalizeDivision = (str) => {
  if (!str) return '';
  return String(str).toLowerCase().replace(/[\s\-_]+/g, '');
};

/**
 * Extracts meaningful tokens from a division name for fuzzy matching.
 * "Dahod SF" -> ["dahod", "sf"]
 * "Bharuch Sub Division" -> ["bharuch", "sub", "division"]
 */
const getDivisionTokens = (str) => {
  if (!str) return [];
  return String(str).toLowerCase()
    .split(/[\s\-_]+/)
    .filter(t => t.length > 0);
};

/**
 * Fuzzy-matches a target string against the user's division name.
 * Handles variations like:
 *   "Dahod SF" matches: "dahod", "dahodsf", "Dahodsf", "Dahod", "sf",
 *   "dahod_sf", "dahod-sf", "DAHOD SF", etc.
 *
 * Matching logic:
 *   1. Exact match (case-insensitive, ignoring spaces/hyphens/underscores)
 *   2. Normalized division is contained in normalized target (or vice versa)
 *   3. The primary token (first word, length > 2) of the division is contained
 *      in the target — e.g. "dahod" matches "dahod_sf_coupe_NDVI_Change"
 *
 * @param {string} target - The string to check (layer name, division field, etc.)
 * @param {string} division - The user's division name (e.g. "Dahod SF")
 * @returns {boolean} True if the target matches the division.
 */
export const matchesDivision = (target, division) => {
  if (!target || !division) return false;

  const normTarget = normalizeDivision(target);
  const normDivision = normalizeDivision(division);

  if (!normTarget || !normDivision) return false;

  // 1) Exact normalized match
  if (normTarget === normDivision) return true;

  // 2) Containment check (either direction) — handles "dahodsf" in "2025-11-01_dahod_sf_coupe..."
  if (normTarget.includes(normDivision) || normDivision.includes(normTarget)) return true;

  // 3) Token-based matching: check if the primary token (first meaningful word)
  //    of the division appears in the target. Skip very short tokens (<=2 chars)
  //    like "SF" to avoid false positives, UNLESS the division is only that token.
  const tokens = getDivisionTokens(division);
  const meaningfulTokens = tokens.filter(t => t.length > 2);

  // If there are meaningful tokens, require at least one to match
  if (meaningfulTokens.length > 0) {
    if (meaningfulTokens.some(token => normTarget.includes(token))) return true;
  } else if (tokens.length > 0) {
    // Division is only short tokens (e.g. "SF"), match on those
    if (tokens.some(token => normTarget.includes(token))) return true;
  }

  return false;
};

/**
 * Returns true if the logged-in user has a locked division AND the target matches it.
 * Convenience wrapper: if user has no division (PCCF/Circle), always returns true.
 * @param {string} target - The string to check
 * @returns {boolean} True if no division lock, or if target matches user's division.
 */
export const matchesUserDivision = (target) => {
  const division = getUserDivision();
  if (!division) return true; // No lock — show everything
  return matchesDivision(target, division);
};

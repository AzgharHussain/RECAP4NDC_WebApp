/**
 * apiClient.js — Centralized axios instance for high-concurrency production use.
 *
 * Features:
 *   1. Request timeout (30s) — prevents hung requests from accumulating
 *   2. Automatic retry on network errors / 5xx (max 2 retries with backoff)
 *   3. Request deduplication — identical in-flight GET requests share one response
 *   4. Automatic auth token injection from localStorage / cookies
 *   5. Global 401/403 auto-logout (moved from main.jsx interceptor)
 *
 * Usage (replace `import axios from 'axios'` with):
 *   import apiClient from '../utils/apiClient';
 *   const { data } = await apiClient.get('/api/patrol-info');
 *   const { data } = await apiClient.post('/api/forest-login', body);
 *
 * For file uploads (large payloads), use apiClient.post(url, body, { timeout: 120000 })
 */
import axios from 'axios';
import { autoLogout } from './authUtils';

// --- Configuration ---
const DEFAULT_TIMEOUT = 30000;       // 30s for normal API calls
const MAX_RETRIES = 2;                // retry twice on network errors / 5xx
const RETRY_DELAY_BASE = 1000;        // 1s, 2s backoff
const DEDUP_WINDOW_MS = 2000;         // dedup identical GETs within 2s

function dispatchGlobalLoadingStart() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('global-data-loading-start'));
  }
}

function dispatchGlobalLoadingEnd() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('global-data-loading-end'));
  }
}

// Auth endpoints that legitimately return 401 — don't auto-logout on these
const AUTH_ENDPOINTS = [
  '/api/admin',
  '/api/forest-login',
  '/api/saveuser',
  '/api/send-pending-notifications',
];

// --- Create axios instance ---
const apiClient = axios.create({
  timeout: DEFAULT_TIMEOUT,
  // Don't send credentials cross-origin by default
  withCredentials: false,
});

// --- Request deduplication for GET requests ---
const pendingGets = new Map(); // key: url+params → promise

function getDedupKey(config) {
  if (config.method !== 'get') return null;
  const params = config.params ? JSON.stringify(config.params) : '';
  return `${config.url}?${params}`;
}

// --- Request interceptor: inject auth token ---
apiClient.interceptors.request.use(
  (config) => {
    dispatchGlobalLoadingStart();
    config.__globalLoadingTracked = true;

    // Inject token from localStorage (fallback to cookie)
    const token = localStorage.getItem('token') || localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Dedup identical GET requests that are in-flight
    const dedupKey = getDedupKey(config);
    if (dedupKey && config._dedup !== false) {
      const existing = pendingGets.get(dedupKey);
      if (existing) {
        // Return the existing promise — caller shares the same response
        return existing.then(
          (response) => ({ ...response, config }),
          (error) => Promise.reject({ ...error, config })
        );
      }
    }

    return config;
  },
  (error) => {
    dispatchGlobalLoadingEnd();
    return Promise.reject(error);
  }
);

// --- Response interceptor: retry, dedup cleanup, auto-logout ---
apiClient.interceptors.response.use(
  (response) => {
    if (response.config?.__globalLoadingTracked) dispatchGlobalLoadingEnd();

    // Clean up dedup map
    const dedupKey = getDedupKey(response.config);
    if (dedupKey) pendingGets.delete(dedupKey);
    return response;
  },
  async (error) => {
    if (error.config?.__globalLoadingTracked) dispatchGlobalLoadingEnd();

    const config = error.config || {};
    const dedupKey = getDedupKey(config);
    if (dedupKey) pendingGets.delete(dedupKey);

    // --- Auto-logout on 401/403 (except auth endpoints) ---
    const status = error.response?.status;
    const url = config.url || '';
    const isAuthEndpoint = AUTH_ENDPOINTS.some((ep) => url.includes(ep));
    if ((status === 401 || status === 403) && !isAuthEndpoint) {
      console.warn(`apiClient: received ${status} from ${url}. Auto-logging out.`);
      autoLogout();
      return Promise.reject(error);
    }

    // --- Retry on network errors or 5xx ---
    const isNetworkError = !error.response && error.code !== 'ECONNABORTED';
    const isServerError = status >= 500;
    const isTimeout = error.code === 'ECONNABORTED';

    // Don't retry: timeouts (could overload a struggling server), 4xx errors, auth endpoints
    if (isTimeout || (!isNetworkError && !isServerError) || isAuthEndpoint) {
      return Promise.reject(error);
    }

    // Check retry count
    config.__retryCount = config.__retryCount || 0;
    if (config.__retryCount >= MAX_RETRIES) {
      return Promise.reject(error);
    }

    config.__retryCount++;
    const delay = RETRY_DELAY_BASE * config.__retryCount;
    console.warn(
      `apiClient: retrying ${config.method?.toUpperCase()} ${url} (attempt ${config.__retryCount}/${MAX_RETRIES}) in ${delay}ms`
    );

    // Wait then retry
    await new Promise((resolve) => setTimeout(resolve, delay));
    return apiClient.request(config);
  }
);

// Override get() to support dedup at the promise level
const originalGet = apiClient.get.bind(apiClient);
apiClient.get = function (url, config = {}) {
  const dedupKey = getDedupKey({ method: 'get', url, params: config.params });
  if (dedupKey && config._dedup !== false) {
    const existing = pendingGets.get(dedupKey);
    if (existing) {
      return existing; // share the in-flight promise
    }
    const promise = originalGet(url, config);
    pendingGets.set(dedupKey, promise);
    // Auto-clean after dedup window even if response interceptor doesn't fire
    setTimeout(() => pendingGets.delete(dedupKey), DEDUP_WINDOW_MS);
    return promise;
  }
  return originalGet(url, config);
};

export default apiClient;

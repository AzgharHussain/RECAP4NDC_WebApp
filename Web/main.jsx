import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import 'leaflet/dist/leaflet.css';
import './fonts.css';
import './index.css';

// === Centralized axios instance ===
// Importing this initializes global interceptors (timeout, retry, dedup,
// auto-logout on 401/403). All pages should use `apiClient` instead of raw `axios`.
import './utils/apiClient';

// === Register Service Worker for offline caching ===
// Caches static assets so repeat visits don't hit the server at all.
// Only register in production (not during development with Vite HMR).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => {
        // Check for updates every 60 seconds
        setInterval(() => reg.update(), 60 * 1000);
        // If a new SW takes over, reload to get latest assets
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          window.location.reload();
        });
      })
      .catch((err) => console.warn('SW registration failed:', err));
  });
}

const rootElement = document.getElementById('root');
const root = ReactDOM.createRoot(rootElement);

root.render(
  <BrowserRouter>
    <App />   {/* ✅ App contains Routes */}
  </BrowserRouter>
);

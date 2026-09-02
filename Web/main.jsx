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

// === Unregister any existing service worker ===
// Clear old service workers that may be causing caching issues
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => {
        registration.unregister();
      });
    });
  });
}

const rootElement = document.getElementById('root');
const root = ReactDOM.createRoot(rootElement);

root.render(
  <BrowserRouter>
    <App />   {/* ✅ App contains Routes */}
  </BrowserRouter>
);

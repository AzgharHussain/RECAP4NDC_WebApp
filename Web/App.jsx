import React, { Suspense, lazy, useEffect, useState } from "react";
import { Routes, Route } from "react-router-dom";
import axios from "axios";
import { LanguageProvider } from "./context/LanguageContext";
import { AccessibilityProvider, A11yPageWrapper } from "./context/AccessibilityContext";
import AccessibilityWidget from "./components/AccessibilityWidget";
import ProtectedRoute from "./pages/components/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";
import './fonts.css';

// === Components ===
import LoadingSpinner from "./components/LoadingSpinner";

// === Lazy-loaded Pages ===
const Login = lazy(() => import("./pages/Login"));
const DashboardLayout = lazy(() => import("./layouts/DashboardLayout"));
const DashboardLayoutAdmin = lazy(() => import("./layouts/DashboardLayoutAdmin"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const GeoDashboard = lazy(() => import("./pages/GeoDashboard"));
const Patrolling = lazy(() => import("./pages/Patrolling"));
const Incident = lazy(() => import("./pages/Incident"));
const UploadCoupe = lazy(() => import("./pages/UploadCoupe"));
const ViewCoupe = lazy(() => import("./pages/ViewCoupe"));
const CoupeObservation = lazy(() => import("./pages/CoupeObservation"));
const NDVIChangeDashboard = lazy(() => import("./pages/NDVIDashboard"));
const NDVINotifications = lazy(() => import("./pages/NDVINotifications"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const Homepage = lazy(() => import("./pages/Homepage"));
const BeatPatrolCoverage = lazy(() => import("./pages/BeatPatrolCoverage"));
const ChangePassword = lazy(() => import("./pages/ChangePassword"));
const UploadPatrolBoundary = lazy(() => import("./pages/UploadPatrolBoundary"));
const IncidentLogs = lazy(() => import("./pages/IncidentLogs"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const SupportPage = lazy(() => import("./pages/SupportPage"));


const LoadingFallback = () => (
  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
    <LoadingSpinner />
  </div>
);

const GlobalDataLoadingOverlay = () => {
  const [activeRequests, setActiveRequests] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState("Loading...");

  useEffect(() => {
    const beginLoading = (event) => {
      setLoadingMessage(event?.detail?.message || "Loading...");
      setActiveRequests((count) => count + 1);
    };
    const endLoading = () => setActiveRequests((count) => Math.max(0, count - 1));

    const requestInterceptor = axios.interceptors.request.use(
      (config) => {
        beginLoading();
        config.__globalLoadingTracked = true;
        return config;
      },
      (error) => {
        endLoading();
        return Promise.reject(error);
      }
    );

    const responseInterceptor = axios.interceptors.response.use(
      (response) => {
        if (response.config?.__globalLoadingTracked) endLoading();
        return response;
      },
      (error) => {
        if (error.config?.__globalLoadingTracked) endLoading();
        return Promise.reject(error);
      }
    );

    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      beginLoading();
      try {
        return await originalFetch(...args);
      } finally {
        endLoading();
      }
    };

    window.addEventListener('global-data-loading-start', beginLoading);
    window.addEventListener('global-data-loading-end', endLoading);

    return () => {
      axios.interceptors.request.eject(requestInterceptor);
      axios.interceptors.response.eject(responseInterceptor);
      window.fetch = originalFetch;
      window.removeEventListener('global-data-loading-start', beginLoading);
      window.removeEventListener('global-data-loading-end', endLoading);
    };
  }, []);

  if (activeRequests === 0) return null;

  return (
    <div className="global-data-loader-overlay" role="status" aria-live="polite" aria-label="Loading data">
      <div className="global-data-loader-box">
        <div className="global-data-loader-spinner" />
        <div className="global-data-loader-text">{loadingMessage}</div>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AccessibilityProvider>
      <LanguageProvider>
        <A11yPageWrapper>
        <ErrorBoundary>
        <GlobalDataLoadingOverlay />
        <Suspense fallback={<LoadingFallback />}>
          <Routes>

          {/* Public */}
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Homepage />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/support" element={<SupportPage />} />

          {/* Protected User Routes */}
          <Route
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/geo" element={<GeoDashboard />} />
            <Route path="/petrolling-incident/patrolling" element={<Patrolling />} />
            <Route path="/petrolling-incident/incident" element={<Incident />} />
            <Route path="/working-plan/upload" element={<UploadCoupe />} />
            <Route path="/working-plan/view" element={<ViewCoupe />} />
            <Route path="/working-plan/log" element={<CoupeObservation />} />
            <Route path="/ndvi-dashboard" element={<NDVIChangeDashboard />} />
            <Route path="/ndvi-notifications" element={<NDVINotifications />} />
           <Route path="/PatrolCoverageAnalysis" element={<BeatPatrolCoverage />} />
          <Route path="/incident-logs" element={<IncidentLogs />} />
          </Route>

          <Route
            element={
              <ProtectedRoute>
                <DashboardLayoutAdmin />
              </ProtectedRoute>
            }
          >
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/UploadPatrolBoundary" element={<UploadPatrolBoundary />} />
            <Route path="/changepassword" element={<ChangePassword />} />
            <Route path="/incident-logs" element={<IncidentLogs />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Homepage />} />

          </Routes>
        </Suspense>
        </ErrorBoundary>
        </A11yPageWrapper>
        <AccessibilityWidget />
      </LanguageProvider>
    </AccessibilityProvider>
  );
}

import React, { Suspense, lazy } from "react";
import { Routes, Route } from "react-router-dom";
import { LanguageProvider } from "./context/LanguageContext";

// === Components ===
import LoadingSpinner from "./components/LoadingSpinner"; // Create this component for loading states

// === Lazy-loaded Pages ===
const Login = lazy(() => import("./pages/Login"));
const DashboardLayout = lazy(() => import("./layouts/DashboardLayout"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const GeoDashboard = lazy(() => import("./pages/GeoDashboard"));
const Patrolling = lazy(() => import("./pages/Patrolling"));
const Incident = lazy(() => import("./pages/Incident"));
const UploadCoupe = lazy(() => import("./pages/UploadCoupe"));
const ViewCoupe = lazy(() => import("./pages/ViewCoupe"));
const CoupeObservation = lazy(() => import("./pages/CoupeObservation"));
const NDVIChangeDashboard = lazy(() => import("./pages/NDVIDashboard"));

// Loading fallback component
const LoadingFallback = () => (
  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
    <LoadingSpinner /> {/* You can replace this with any loading component */}
  </div>
);

export default function App() {
  return (
    <LanguageProvider>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          {/* Login without sidebar */}
          <Route path="/" element={<Login />} />

          {/* Protected pages with master layout */}
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/geo" element={<GeoDashboard />} />
            <Route path="/petrolling-incident/patrolling" element={<Patrolling />} />
            <Route path="/petrolling-incident/incident" element={<Incident />} />
            <Route path="/working-plan/upload" element={<UploadCoupe />} />
            <Route path="/working-plan/view" element={<ViewCoupe />} />
            <Route path="/working-plan/log" element={<CoupeObservation />} />
            <Route path="/ndvi-dashboard" element={<NDVIChangeDashboard />} />
          </Route>

          {/* Catch-all fallback */}
          <Route path="*" element={<Login />} />
        </Routes>
      </Suspense>
    </LanguageProvider>
  );
}
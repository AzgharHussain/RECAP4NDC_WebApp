import React, { Suspense, lazy } from "react";
import { Routes, Route } from "react-router-dom";
import { LanguageProvider } from "./context/LanguageContext";

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
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));

const LoadingFallback = () => (
  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
    <LoadingSpinner />
  </div>
);

export default function App() {
  return (
    <LanguageProvider>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          {/* Public Routes (no layout) */}
          <Route path="/" element={<Login />} />
          
          {/* Admin Route - SEPARATE layout (no sidebar) */}
          

          {/* Protected Routes with DashboardLayout (sidebar) */}
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

          <Route element={<DashboardLayoutAdmin />}>
            <Route path="/admin" element={<AdminDashboard />} />
            
          </Route>

          {/* Catch-all fallback */}
          <Route path="*" element={<Login />} />
        </Routes>
      </Suspense>
    </LanguageProvider>
  );
}
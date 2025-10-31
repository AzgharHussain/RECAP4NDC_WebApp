import React from "react";
import { Routes, Route } from "react-router-dom"; // ✅ no BrowserRouter here
import { LanguageProvider } from "./context/LanguageContext";  
// ✅ import context

// === Pages ===
import Login from "./pages/Login";
import DashboardLayout from "./layouts/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import GeoDashboard from "./pages/GeoDashboard";
import Patrolling from "./pages/Patrolling";
import Incident from "./pages/Incident";
import UploadCoupe from "./pages/UploadCoupe";
import ViewCoupe from "./pages/ViewCoupe";
import CoupeObservation from "./pages/CoupeObservation";

export default function App() {
  return (
    <LanguageProvider>
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
        </Route>

        {/* Catch-all fallback */}
        <Route path="*" element={<Login />} />
      </Routes>
    </LanguageProvider>
  );
}

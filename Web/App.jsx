import React from "react";  // <-- Add this import
import { Routes, Route } from "react-router-dom";
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
        {/* Uncomment this route once CoupeObservation is available */}
        {<Route path="/working-plan/log" element={<CoupeObservation />} /> }
      </Route>
    </Routes>
  );
}

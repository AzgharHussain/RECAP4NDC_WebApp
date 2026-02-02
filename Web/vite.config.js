import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  
  server: {
    proxy: {
      // For your backend API (localhost:5002)
      "/api": {
        target: "http://68.178.167.216:5002",
        changeOrigin: true,
        secure: false,
      },
      // For SOAP calls to Gujarat Forest Service
      "/FMIS": {
        target: "https://egujforest.gujarat.gov.in",
        changeOrigin: true,
        secure: false,
      }
    },
  },
  
  optimizeDeps: {
    include: ["react", "react-dom", "react-router-dom", "axios"]
  }
});
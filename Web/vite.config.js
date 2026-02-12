import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  
  server: {
    proxy: {
      // For your backend API (localhost:5002)
      "/api": {
        target: "http://localhost:5002",
        // target: "http://68.178.167.216:5002",
        changeOrigin: true,
        secure: false,
      },
      // For SOAP calls to Gujarat Forest Service - FIXED PATH
      "/forest-proxy": {
        target: "https://egujforest.gujarat.gov.in",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/forest-proxy/, '')
      },
      '/geoserver': {
        target: 'https://www.gisfy.co.in:8445',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/geoserver/, '/geoserver'),
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            // Add CORS headers
            proxyReq.setHeader('Origin', 'https://www.gisfy.co.in:8445');
          });
        }
      }
    },
  },
  
  optimizeDeps: {
    include: ["react", "react-dom", "react-router-dom", "axios"]
  }
});
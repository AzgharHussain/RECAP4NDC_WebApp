import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  // Load env variables based on current mode
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
    
    server: {
      proxy: {
        // Backend API proxy
        "/api": {
          target: env.VITE_API_URL,
          changeOrigin: true,
          secure: false,
        },
        // SOAP calls to Gujarat Forest Service
        "/forest-proxy": {
          target: env.VITE_FOREST_URL,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/forest-proxy/, '')
        },
        // Geoserver proxy
        '/geoserver': {
          target: env.VITE_GEOSERVER_URL,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/geoserver/, '/geoserver'),
          configure: (proxy, _options) => {
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              // Add CORS headers
              proxyReq.setHeader('Origin', env.VITE_GEOSERVER_URL);
            });
          }
        }
      },
    },
    
    optimizeDeps: {
      include: ["react", "react-dom", "react-router-dom", "axios"]
    }
  };
});
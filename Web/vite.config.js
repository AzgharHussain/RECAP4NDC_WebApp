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
    },

    // ** ADD THIS SECTION FOR PRODUCTION BUILD **
    build: {
      // Use esbuild minification (faster, good enough for version stripping)
      minify: 'esbuild',
      
      // Target modern browsers for better optimization
      target: 'es2020',
      
      // Generate source maps only in development
      sourcemap: mode === 'development',
      
      // Rollup specific options
      rollupOptions: {
        output: {
          // Remove comments from chunks
          sanitizeFileName: true,
          
          // Custom chunk naming to avoid exposing paths
          entryFileNames: 'assets/[name].[hash].js',
          chunkFileNames: 'assets/[name].[hash].js',
          assetFileNames: 'assets/[name].[hash].[ext]',
          
          // Split vendor chunks for better caching (optional but recommended)
          manualChunks: {
            // Core React libraries
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            
            // UI libraries
            'vendor-mui': ['@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled'],
            'vendor-antd': ['antd', '@ant-design/icons'],
            
            // Mapping libraries
            'vendor-leaflet': ['leaflet', 'react-leaflet', 'leaflet-draw', 'leaflet-measure'],
            
            // Chart libraries
            'vendor-charts': ['recharts', 'chart.js', 'react-chartjs-2'],
            
            // GIS libraries
            'vendor-turf': ['@turf/turf'],
            
            // Utility libraries
            'vendor-utils': ['axios', 'dayjs', 'date-fns', 'zustand']
          }
        }
      },
      
      // Chunk size warning limit (adjust as needed)
      chunkSizeWarningLimit: 1000,
    },

    // ** ADD THIS TO FURTHER STRIP VERSION INFO **
    esbuild: {
      // Drop console and debugger in production
      drop: mode === 'production' ? ['console', 'debugger'] : [],
      
      // Legal comments (versions, licenses) handling
      legalComments: 'none', // Removes legal comments (including version info)
      
      // Pure annotations
      pure: mode === 'production' ? ['console.log', 'console.info', 'console.debug'] : []
    }
  };
});
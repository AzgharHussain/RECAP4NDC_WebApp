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
          // Timeouts — geoserver can be slow, give it up to 60s
          timeout: 60000,
          proxyTimeout: 60000,
          rewrite: (path) => path.replace(/^\/geoserver/, '/geoserver'),
          configure: (proxy, _options) => {
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              // Add CORS headers
              proxyReq.setHeader('Origin', env.VITE_GEOSERVER_URL);
            });
            // Log proxy errors but don't crash
            proxy.on('error', (err, req, res) => {
              console.warn('[geoserver proxy] ', err.code || err.message, req?.url);
              if (res && !res.headersSent) {
                res.writeHead(502, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Geoserver unavailable', code: err.code }));
              }
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
      // Completely disable modulepreload hint injection — Vite's auto-injected
      // <link rel="modulepreload"> tags cause "cross-world service worker
      // resource mismatch" warnings in the browser console on every page.
      // Setting to `false` removes the <link> tags entirely from the built HTML.
      // Chunks are still split and loaded correctly via dynamic import().
      modulePreload: false,

      // Use terser for better minification (smaller bundles than esbuild)
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: mode === 'production',
          drop_debugger: mode === 'production',
          pure_funcs: ['console.log', 'console.info', 'console.debug'],
        },
        mangle: {
          safari10: true,
        },
        format: {
          comments: false,
        },
      },

      // Target modern browsers for better optimization
      target: 'es2020',

      // Generate source maps only in development
      sourcemap: mode === 'development',

      // CSS code splitting — extract CSS per chunk for better caching
      cssCodeSplit: true,

      // Rollup specific options
      rollupOptions: {
        output: {
          // Remove comments from chunks
          sanitizeFileName: true,

          // Custom chunk naming to avoid exposing paths
          entryFileNames: 'assets/[name].[hash].js',
          chunkFileNames: 'assets/[name].[hash].js',
          assetFileNames: 'assets/[name].[hash].[ext]',

          // Split vendor chunks for better caching
          manualChunks: {
            // Core React libraries — loaded on every page
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],

            // UI libraries — only loaded on pages that use them
            'vendor-mui': ['@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled'],
            'vendor-antd': ['antd', '@ant-design/icons'],

            // Mapping libraries — only loaded on map pages
            'vendor-leaflet': ['leaflet', 'react-leaflet', 'leaflet-draw', 'leaflet-measure',
              'leaflet-control-geocoder', 'leaflet-easyprint', 'leaflet-geometryutil',
              'leaflet-polylinedecorator', 'leaflet.fullscreen', 'leaflet.nontiledlayer'],

            // Chart libraries — only loaded on dashboard pages
            'vendor-charts': ['recharts', 'chart.js', 'react-chartjs-2'],

            // GIS libraries — only loaded on geo pages
            'vendor-turf': ['@turf/turf'],

            // Utility libraries
            'vendor-utils': ['axios', 'dayjs', 'date-fns', 'zustand', 'js-cookie', 'uuid'],

            // Export utilities — only loaded when exporting
            'vendor-export': ['xlsx', 'file-saver', 'html-to-image', 'html2canvas', 'xml2js'],
          }
        }
      },

      // Chunk size warning limit (adjust as needed)
      chunkSizeWarningLimit: 1000,
    },

    // esbuild config — used for dev server transforms only.
    // Production minification is handled by terser (above).
    esbuild: {
      legalComments: 'none',
    }
  };
});
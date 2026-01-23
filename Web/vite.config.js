import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  
  server: {
    proxy: {
      "/api": {
        target: "https://egujforest.gujarat.gov.in",
        changeOrigin: true,
        secure: false, // Add this for HTTPS
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  
  optimizeDeps: {
    include: ["antd", "react-router-dom"]
  }
});
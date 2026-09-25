import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return;
          }

          if (
            id.includes("react/") ||
            id.includes("react-dom/") ||
            id.includes("scheduler/")
          ) {
            return "vendor-react";
          }

          if (id.includes("react-router") || id.includes("@remix-run")) {
            return "vendor-router";
          }

          if (id.includes("@mui") || id.includes("@emotion")) {
            return "vendor-mui";
          }

          if (id.includes("axios")) {
            return "vendor-network";
          }
        },
      },
    },
  },
  server: {
    port: 5173,
  },
});

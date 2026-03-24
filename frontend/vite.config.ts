import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
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

          if (id.includes("axios")) {
            return "vendor-network";
          }

          if (id.includes("lucide-react")) {
            return "vendor-icons";
          }
        },
      },
    },
  },
  server: {
    port: 5173,
  },
});

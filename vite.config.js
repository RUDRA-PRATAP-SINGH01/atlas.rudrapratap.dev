import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Split guide pages into two lazy chunks so the initial bundle stays small.
        // The landing page, hub, and reference pages load their own minimal chunks.
        // All 60+ PebbleDB pages share one chunk; all 17 Rate Limiter pages share another.
        manualChunks(id) {
          if (id.includes("/features/docs/pages/rate-limiter/")) {
            return "rate-limiter-guide";
          }
          if (id.includes("/features/docs/pages/")) {
            return "pebbledb-guide";
          }
          if (id.includes("/features/landing/")) {
            return "hub";
          }
          // Vendor splitting: mermaid is large (~1MB), isolate it
          if (id.includes("node_modules/mermaid")) {
            return "mermaid-vendor";
          }
          if (id.includes("node_modules/")) {
            return "vendor";
          }
        },
      },
    },
  },
});

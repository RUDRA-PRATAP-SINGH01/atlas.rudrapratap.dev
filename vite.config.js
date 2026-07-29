import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "./src"),
    },
  },
  build: {
    // Mermaid vendor is intentionally large and lazy-loaded; don't fail CI noise.
    chunkSizeWarningLimit: 3500,
    sourcemap: false,
    rollupOptions: {
      output: {
        // Route-isolated docs chunks: RL shell stays light; each registry section
        // and Mermaid load only when needed. Architecture project datasets split
        // so inactive project data is not downloaded with the explorer UI.
        manualChunks(id) {
          if (
            id.includes("/architecture-design/data/rate-limiter/") ||
            id.includes("/architecture-design/data/projects/rate-limiter")
          ) {
            return "arch-data-rate-limiter";
          }
          if (
            id.includes("/architecture-design/data/projects/pebbledb") ||
            (id.includes("/architecture-design/data/") &&
              !id.includes("/architecture-design/data/loadProject"))
          ) {
            return "arch-data-pebbledb";
          }
          if (id.includes("/features/docs/pages/architecture-design/")) {
            return "architecture-design";
          }
          if (id.includes("/features/docs/pages/rate-limiter/registry/")) {
            const match = id.match(/rate-limiter\/registry\/([^/]+)\./);
            if (match && match[1] !== "nav" && match[1] !== "index") {
              return `rl-section-${match[1]}`;
            }
            return "rate-limiter-nav";
          }
          if (id.includes("/features/docs/pages/rate-limiter/")) {
            return "rate-limiter-shell";
          }
          if (id.includes("/features/docs/components/system/")) {
            return "docs-system";
          }
          if (id.includes("/features/docs/pages/")) {
            const match = id.match(/\/features\/docs\/pages\/([^/]+)\//);
            if (match && match[1]) {
              return `pdb-section-${match[1]}`;
            }
            return "pebbledb-guide";
          }
          if (id.includes("/features/landing/")) {
            return "hub";
          }
          if (id.includes("node_modules/mermaid")) {
            return "mermaid-vendor";
          }
          if (id.includes("node_modules/gsap")) {
            return "vendor-gsap";
          }
          if (
            id.includes("node_modules/locomotive-scroll") ||
            id.includes("node_modules/lenis")
          ) {
            return "vendor-scroll";
          }
          if (id.includes("node_modules/react") || id.includes("node_modules/react-dom") || id.includes("node_modules/react-router")) {
            return "vendor-react";
          }
          if (id.includes("node_modules/")) {
            return "vendor";
          }
        },
      },
    },
  },
});

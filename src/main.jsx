import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/core/styles/index.css";
import App from "@/app/App";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Register PWA Service Worker for offline capability
if (typeof window !== "undefined" && "serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

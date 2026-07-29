import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/core/styles/index.css";
import App from "@/app/App";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Pause CSS infinite animations while the document is hidden (saves CPU/GPU).
if (typeof document !== "undefined") {
  const syncHiddenClass = () => {
    document.documentElement.classList.toggle("is-doc-hidden", document.hidden);
  };
  syncHiddenClass();
  document.addEventListener("visibilitychange", syncHiddenClass);
}

// Register PWA Service Worker for offline capability
if (typeof window !== "undefined" && "serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

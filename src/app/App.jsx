import { Suspense } from "react";
import { BrowserRouter } from "react-router-dom";
import RouteFallback from "@/core/components/RouteFallback";
import AppRoutes from "@/core/routing/AppRoutes";
import { useCopyClipboard } from "@/core/hooks/useCopyClipboard";

function AppContent() {
  useCopyClipboard();
  return <AppRoutes />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
        <AppContent />
      </Suspense>
    </BrowserRouter>
  );
}

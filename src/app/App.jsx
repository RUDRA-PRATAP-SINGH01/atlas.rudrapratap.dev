import { Suspense } from "react";
import { BrowserRouter } from "react-router-dom";
import RouteFallback from "@/components/common/RouteFallback";
import AppRoutes from "@/routes/AppRoutes";

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
        <AppRoutes />
      </Suspense>
    </BrowserRouter>
  );
}

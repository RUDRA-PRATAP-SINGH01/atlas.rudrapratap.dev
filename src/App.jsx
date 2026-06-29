import LandingPage from "./components/LandingPage";
import { useLocomotiveScroll } from "./hooks/useLocomotiveScroll";

export default function App() {
  useLocomotiveScroll();

  return <LandingPage />;
}

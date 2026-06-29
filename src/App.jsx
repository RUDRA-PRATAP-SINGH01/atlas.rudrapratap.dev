import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from "./components/LandingPage";
import ProjectDocsPage from "./pages/ProjectDocsPage";
import GuideDocsPage from "./pages/GuideDocsPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/project-docs" element={<ProjectDocsPage />} />
        <Route path="/project-docs/guide" element={<GuideDocsPage />} />
      </Routes>
    </BrowserRouter>
  );
}

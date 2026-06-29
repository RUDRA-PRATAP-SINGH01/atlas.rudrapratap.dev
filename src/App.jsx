import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from "./components/LandingPage";
import ProjectDocsPage from "./pages/ProjectDocsPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/project-docs" element={<ProjectDocsPage />} />
      </Routes>
    </BrowserRouter>
  );
}

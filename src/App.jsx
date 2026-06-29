import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from "./components/LandingPage";
import ProjectDocsPage from "./pages/ProjectDocsPage";
import GuideDocsPage from "./pages/GuideDocsPage";
import SetupDocsPage from "./pages/SetupDocsPage";
import LsmFundamentalsDocsPage from "./pages/LsmFundamentalsDocsPage";
import SystemOverviewDocsPage from "./pages/SystemOverviewDocsPage";
import WritePathDocsPage from "./pages/WritePathDocsPage";
import ReadPathDocsPage from "./pages/ReadPathDocsPage";
import ScanPathDocsPage from "./pages/ScanPathDocsPage";
import CrashRecoveryDocsPage from "./pages/CrashRecoveryDocsPage";
import ShutdownSequenceDocsPage from "./pages/ShutdownSequenceDocsPage";
import ConcurrencyModelDocsPage from "./pages/ConcurrencyModelDocsPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/project-docs" element={<ProjectDocsPage />} />
        <Route path="/project-docs/guide" element={<GuideDocsPage />} />
        <Route path="/project-docs/guide/setup" element={<SetupDocsPage />} />
        <Route path="/project-docs/guide/lsm-fundamentals" element={<LsmFundamentalsDocsPage />} />
        <Route path="/project-docs/guide/architecture/system-overview" element={<SystemOverviewDocsPage />} />
        <Route path="/project-docs/guide/architecture/write-path" element={<WritePathDocsPage />} />
        <Route path="/project-docs/guide/architecture/read-path" element={<ReadPathDocsPage />} />
        <Route path="/project-docs/guide/architecture/scan-path" element={<ScanPathDocsPage />} />
        <Route path="/project-docs/guide/architecture/crash-recovery" element={<CrashRecoveryDocsPage />} />
        <Route path="/project-docs/guide/architecture/shutdown-sequence" element={<ShutdownSequenceDocsPage />} />
        <Route path="/project-docs/guide/architecture/concurrency-model" element={<ConcurrencyModelDocsPage />} />
      </Routes>
    </BrowserRouter>
  );
}

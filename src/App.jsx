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
import WalDocsPage from "./pages/WalDocsPage";
import MemtableDocsPage from "./pages/MemtableDocsPage";
import SkipListDocsPage from "./pages/SkipListDocsPage";
import SstableDocsPage from "./pages/SstableDocsPage";
import ManifestDocsPage from "./pages/ManifestDocsPage";
import BloomFilterDocsPage from "./pages/BloomFilterDocsPage";
import BlockCacheDocsPage from "./pages/BlockCacheDocsPage";

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
        <Route path="/project-docs/guide/core-components/wal" element={<WalDocsPage />} />
        <Route path="/project-docs/guide/core-components/memtable" element={<MemtableDocsPage />} />
        <Route path="/project-docs/guide/core-components/skiplist" element={<SkipListDocsPage />} />
        <Route path="/project-docs/guide/core-components/sstable" element={<SstableDocsPage />} />
        <Route path="/project-docs/guide/core-components/manifest" element={<ManifestDocsPage />} />
        <Route path="/project-docs/guide/core-components/bloom-filter" element={<BloomFilterDocsPage />} />
        <Route path="/project-docs/guide/core-components/block-cache" element={<BlockCacheDocsPage />} />
      </Routes>
    </BrowserRouter>
  );
}

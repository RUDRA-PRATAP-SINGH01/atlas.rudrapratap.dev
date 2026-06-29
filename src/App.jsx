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
import MergeIteratorDocsPage from "./pages/MergeIteratorDocsPage";
import SstableLayoutDocsPage from "./pages/SstableLayoutDocsPage";
import WalRecordFormatDocsPage from "./pages/WalRecordFormatDocsPage";
import ManifestFormatDocsPage from "./pages/ManifestFormatDocsPage";
import BlockFormatDocsPage from "./pages/BlockFormatDocsPage";
import FileLayoutDocsPage from "./pages/FileLayoutDocsPage";
import PackageStructureDocsPage from "./pages/PackageStructureDocsPage";
import DbLifecycleDocsPage from "./pages/DbLifecycleDocsPage";
import FlushPipelineDocsPage from "./pages/FlushPipelineDocsPage";
import WalTruncationDocsPage from "./pages/WalTruncationDocsPage";
import CompactionPipelineDocsPage from "./pages/CompactionPipelineDocsPage";
import RecoveryPipelineDocsPage from "./pages/RecoveryPipelineDocsPage";
import DesignDecisionsDocsPage from "./pages/DesignDecisionsDocsPage";
import SystemInvariantsDocsPage from "./pages/SystemInvariantsDocsPage";
import EngineeringTradeoffsDocsPage from "./pages/EngineeringTradeoffsDocsPage";
import EvolutionDocsPage from "./pages/EvolutionDocsPage";
import LessonsLearnedDocsPage from "./pages/LessonsLearnedDocsPage";
import PerformanceOverviewDocsPage from "./pages/PerformanceOverviewDocsPage";
import BenchmarkMethodologyDocsPage from "./pages/BenchmarkMethodologyDocsPage";
import BenchmarkResultsDocsPage from "./pages/BenchmarkResultsDocsPage";
import MemoryUsageDocsPage from "./pages/MemoryUsageDocsPage";
import TestingStrategyDocsPage from "./pages/TestingStrategyDocsPage";
import CrashTestingDocsPage from "./pages/CrashTestingDocsPage";
import FailureInjectionDocsPage from "./pages/FailureInjectionDocsPage";
import RaceDetectionDocsPage from "./pages/RaceDetectionDocsPage";
import WalReplayBugDocsPage from "./pages/WalReplayBugDocsPage";
import ManifestConsistencyDocsPage from "./pages/ManifestConsistencyDocsPage";
import CompactionRaceDocsPage from "./pages/CompactionRaceDocsPage";
import ReaderLifecycleDocsPage from "./pages/ReaderLifecycleDocsPage";
import ScanLockContentionDocsPage from "./pages/ScanLockContentionDocsPage";
import ShutdownOrderingDocsPage from "./pages/ShutdownOrderingDocsPage";
import ConfigurationDocsPage from "./pages/ConfigurationDocsPage";
import CliDocsPage from "./pages/CliDocsPage";
import ProjectStructureDocsPage from "./pages/ProjectStructureDocsPage";
import SourceCodeTourDocsPage from "./pages/SourceCodeTourDocsPage";
import DevelopmentTimelineDocsPage from "./pages/DevelopmentTimelineDocsPage";
import MilestonesDocsPage from "./pages/MilestonesDocsPage";

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
        <Route path="/project-docs/guide/core-components/merge-iterator" element={<MergeIteratorDocsPage />} />
        <Route path="/project-docs/guide/internals/sstable-layout" element={<SstableLayoutDocsPage />} />
        <Route path="/project-docs/guide/internals/wal-record-format" element={<WalRecordFormatDocsPage />} />
        <Route path="/project-docs/guide/internals/manifest-format" element={<ManifestFormatDocsPage />} />
        <Route path="/project-docs/guide/internals/block-format" element={<BlockFormatDocsPage />} />
        <Route path="/project-docs/guide/internals/file-layout" element={<FileLayoutDocsPage />} />
        <Route path="/project-docs/guide/implementation/package-structure" element={<PackageStructureDocsPage />} />
        <Route path="/project-docs/guide/implementation/db-lifecycle" element={<DbLifecycleDocsPage />} />
        <Route path="/project-docs/guide/implementation/flush-pipeline" element={<FlushPipelineDocsPage />} />
        <Route path="/project-docs/guide/implementation/wal-truncate" element={<WalTruncationDocsPage />} />
        <Route path="/project-docs/guide/implementation/compaction-pipeline" element={<CompactionPipelineDocsPage />} />
        <Route path="/project-docs/guide/implementation/recovery-pipeline" element={<RecoveryPipelineDocsPage />} />
        <Route path="/project-docs/guide/design-decisions" element={<DesignDecisionsDocsPage />} />
        <Route path="/project-docs/guide/system-invariants" element={<SystemInvariantsDocsPage />} />
        <Route path="/project-docs/guide/engineering-tradeoffs" element={<EngineeringTradeoffsDocsPage />} />
        <Route path="/project-docs/guide/evolution" element={<EvolutionDocsPage />} />
        <Route path="/project-docs/guide/lessons-learned" element={<LessonsLearnedDocsPage />} />
        <Route path="/project-docs/guide/performance/benchmark-methodology" element={<BenchmarkMethodologyDocsPage />} />
        <Route path="/project-docs/guide/performance/benchmark-results" element={<BenchmarkResultsDocsPage />} />
        <Route path="/project-docs/guide/performance/memory-usage" element={<MemoryUsageDocsPage />} />
        <Route path="/project-docs/guide/performance/read-write-performance" element={<PerformanceOverviewDocsPage />} />
        <Route path="/project-docs/guide/testing/testing-strategy" element={<TestingStrategyDocsPage />} />
        <Route path="/project-docs/guide/testing/crash-testing" element={<CrashTestingDocsPage />} />
        <Route path="/project-docs/guide/testing/failure-injection" element={<FailureInjectionDocsPage />} />
        <Route path="/project-docs/guide/testing/race-detection" element={<RaceDetectionDocsPage />} />
        <Route path="/project-docs/guide/debugging/wal-replay-bug" element={<WalReplayBugDocsPage />} />
        <Route path="/project-docs/guide/debugging/manifest-consistency" element={<ManifestConsistencyDocsPage />} />
        <Route path="/project-docs/guide/debugging/compaction-race" element={<CompactionRaceDocsPage />} />
        <Route path="/project-docs/guide/debugging/reader-lifecycle" element={<ReaderLifecycleDocsPage />} />
        <Route path="/project-docs/guide/debugging/scan-lock-contention" element={<ScanLockContentionDocsPage />} />
        <Route path="/project-docs/guide/debugging/shutdown-ordering" element={<ShutdownOrderingDocsPage />} />
        <Route path="/project-docs/guide/reference/configuration" element={<ConfigurationDocsPage />} />
        <Route path="/project-docs/guide/reference/cli" element={<CliDocsPage />} />
        <Route path="/project-docs/guide/reference/project-structure" element={<ProjectStructureDocsPage />} />
        <Route path="/project-docs/guide/reference/source-code-tour" element={<SourceCodeTourDocsPage />} />
        <Route path="/project-docs/guide/reference/development-timeline" element={<DevelopmentTimelineDocsPage />} />
        <Route path="/project-docs/guide/reference/milestones" element={<MilestonesDocsPage />} />
      </Routes>
    </BrowserRouter>
  );
}

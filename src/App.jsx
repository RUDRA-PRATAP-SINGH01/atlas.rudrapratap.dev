import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

const LandingPage = lazy(() => import("./components/LandingPage"));
const BlogPage = lazy(() => import("./pages/BlogPage"));
const ProjectDocsPage = lazy(() => import("./pages/ProjectDocsPage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));
const IntroDocsPage = lazy(() => import("./pages/IntroDocsPage"));
const GuideDocsPage = lazy(() => import("./pages/GuideDocsPage"));
const SetupDocsPage = lazy(() => import("./pages/SetupDocsPage"));
const LsmFundamentalsDocsPage = lazy(() => import("./pages/LsmFundamentalsDocsPage"));
const SystemOverviewDocsPage = lazy(() => import("./pages/SystemOverviewDocsPage"));
const WritePathDocsPage = lazy(() => import("./pages/WritePathDocsPage"));
const ReadPathDocsPage = lazy(() => import("./pages/ReadPathDocsPage"));
const ScanPathDocsPage = lazy(() => import("./pages/ScanPathDocsPage"));
const CrashRecoveryDocsPage = lazy(() => import("./pages/CrashRecoveryDocsPage"));
const ShutdownSequenceDocsPage = lazy(() => import("./pages/ShutdownSequenceDocsPage"));
const ConcurrencyModelDocsPage = lazy(() => import("./pages/ConcurrencyModelDocsPage"));
const WalDocsPage = lazy(() => import("./pages/WalDocsPage"));
const MemtableDocsPage = lazy(() => import("./pages/MemtableDocsPage"));
const SkipListDocsPage = lazy(() => import("./pages/SkipListDocsPage"));
const SstableDocsPage = lazy(() => import("./pages/SstableDocsPage"));
const ManifestDocsPage = lazy(() => import("./pages/ManifestDocsPage"));
const BloomFilterDocsPage = lazy(() => import("./pages/BloomFilterDocsPage"));
const BlockCacheDocsPage = lazy(() => import("./pages/BlockCacheDocsPage"));
const MergeIteratorDocsPage = lazy(() => import("./pages/MergeIteratorDocsPage"));
const SstableLayoutDocsPage = lazy(() => import("./pages/SstableLayoutDocsPage"));
const WalRecordFormatDocsPage = lazy(() => import("./pages/WalRecordFormatDocsPage"));
const ManifestFormatDocsPage = lazy(() => import("./pages/ManifestFormatDocsPage"));
const BlockFormatDocsPage = lazy(() => import("./pages/BlockFormatDocsPage"));
const FileLayoutDocsPage = lazy(() => import("./pages/FileLayoutDocsPage"));
const PackageStructureDocsPage = lazy(() => import("./pages/PackageStructureDocsPage"));
const DbLifecycleDocsPage = lazy(() => import("./pages/DbLifecycleDocsPage"));
const FlushPipelineDocsPage = lazy(() => import("./pages/FlushPipelineDocsPage"));
const WalTruncationDocsPage = lazy(() => import("./pages/WalTruncationDocsPage"));
const CompactionPipelineDocsPage = lazy(() => import("./pages/CompactionPipelineDocsPage"));
const RecoveryPipelineDocsPage = lazy(() => import("./pages/RecoveryPipelineDocsPage"));
const DesignDecisionsDocsPage = lazy(() => import("./pages/DesignDecisionsDocsPage"));
const SystemInvariantsDocsPage = lazy(() => import("./pages/SystemInvariantsDocsPage"));
const EngineeringTradeoffsDocsPage = lazy(() => import("./pages/EngineeringTradeoffsDocsPage"));
const EvolutionDocsPage = lazy(() => import("./pages/EvolutionDocsPage"));
const LessonsLearnedDocsPage = lazy(() => import("./pages/LessonsLearnedDocsPage"));
const PerformanceOverviewDocsPage = lazy(() => import("./pages/PerformanceOverviewDocsPage"));
const BenchmarkMethodologyDocsPage = lazy(() => import("./pages/BenchmarkMethodologyDocsPage"));
const BenchmarkResultsDocsPage = lazy(() => import("./pages/BenchmarkResultsDocsPage"));
const MemoryUsageDocsPage = lazy(() => import("./pages/MemoryUsageDocsPage"));
const TestingStrategyDocsPage = lazy(() => import("./pages/TestingStrategyDocsPage"));
const CrashTestingDocsPage = lazy(() => import("./pages/CrashTestingDocsPage"));
const FailureInjectionDocsPage = lazy(() => import("./pages/FailureInjectionDocsPage"));
const RaceDetectionDocsPage = lazy(() => import("./pages/RaceDetectionDocsPage"));
const WalReplayBugDocsPage = lazy(() => import("./pages/WalReplayBugDocsPage"));
const ManifestConsistencyDocsPage = lazy(() => import("./pages/ManifestConsistencyDocsPage"));
const CompactionRaceDocsPage = lazy(() => import("./pages/CompactionRaceDocsPage"));
const ReaderLifecycleDocsPage = lazy(() => import("./pages/ReaderLifecycleDocsPage"));
const ScanLockContentionDocsPage = lazy(() => import("./pages/ScanLockContentionDocsPage"));
const ShutdownOrderingDocsPage = lazy(() => import("./pages/ShutdownOrderingDocsPage"));
const ConfigurationDocsPage = lazy(() => import("./pages/ConfigurationDocsPage"));
const CliDocsPage = lazy(() => import("./pages/CliDocsPage"));
const ProjectStructureDocsPage = lazy(() => import("./pages/ProjectStructureDocsPage"));
const SourceCodeTourDocsPage = lazy(() => import("./pages/SourceCodeTourDocsPage"));
const DevelopmentTimelineDocsPage = lazy(() => import("./pages/DevelopmentTimelineDocsPage"));
const MilestonesDocsPage = lazy(() => import("./pages/MilestonesDocsPage"));
const ReferenceDocsPage = lazy(() => import("./pages/ReferenceDocsPage"));

function RouteFallback() {
  return (
    <div className="route-fallback" aria-live="polite" aria-busy="true">
      <span className="route-fallback-spinner" aria-hidden="true" />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/project-docs" element={<ProjectDocsPage />} />
          <Route path="/project-docs/reference" element={<ReferenceDocsPage />} />
          <Route path="/project-docs/guide" element={<IntroDocsPage />} />
          <Route path="/project-docs/guide/pebbledb/introduction" element={<GuideDocsPage />} />
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
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

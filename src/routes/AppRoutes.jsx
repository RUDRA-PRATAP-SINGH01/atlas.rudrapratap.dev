import { Routes, Route } from "react-router-dom";
import * as Pages from "./lazyPages";

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Pages.LandingPage />} />
      <Route path="/blog" element={<Pages.BlogPage />} />
      <Route path="/project-docs" element={<Pages.ProjectDocsPage />} />
      <Route path="/project-docs/reference" element={<Pages.ReferenceDocsPage />} />
      <Route path="/project-docs/guide" element={<Pages.IntroDocsPage />} />
      <Route path="/project-docs/guide/pebbledb/introduction" element={<Pages.GuideDocsPage />} />
      <Route path="/project-docs/guide/setup" element={<Pages.SetupDocsPage />} />
      <Route path="/project-docs/guide/lsm-fundamentals" element={<Pages.LsmFundamentalsDocsPage />} />
      <Route path="/project-docs/guide/architecture/system-overview" element={<Pages.SystemOverviewDocsPage />} />
      <Route path="/project-docs/guide/architecture/write-path" element={<Pages.WritePathDocsPage />} />
      <Route path="/project-docs/guide/architecture/read-path" element={<Pages.ReadPathDocsPage />} />
      <Route path="/project-docs/guide/architecture/scan-path" element={<Pages.ScanPathDocsPage />} />
      <Route path="/project-docs/guide/architecture/crash-recovery" element={<Pages.CrashRecoveryDocsPage />} />
      <Route path="/project-docs/guide/architecture/shutdown-sequence" element={<Pages.ShutdownSequenceDocsPage />} />
      <Route path="/project-docs/guide/architecture/concurrency-model" element={<Pages.ConcurrencyModelDocsPage />} />
      <Route path="/project-docs/guide/core-components/wal" element={<Pages.WalDocsPage />} />
      <Route path="/project-docs/guide/core-components/memtable" element={<Pages.MemtableDocsPage />} />
      <Route path="/project-docs/guide/core-components/skiplist" element={<Pages.SkipListDocsPage />} />
      <Route path="/project-docs/guide/core-components/sstable" element={<Pages.SstableDocsPage />} />
      <Route path="/project-docs/guide/core-components/manifest" element={<Pages.ManifestDocsPage />} />
      <Route path="/project-docs/guide/core-components/bloom-filter" element={<Pages.BloomFilterDocsPage />} />
      <Route path="/project-docs/guide/core-components/block-cache" element={<Pages.BlockCacheDocsPage />} />
      <Route path="/project-docs/guide/core-components/merge-iterator" element={<Pages.MergeIteratorDocsPage />} />
      <Route path="/project-docs/guide/internals/sstable-layout" element={<Pages.SstableLayoutDocsPage />} />
      <Route path="/project-docs/guide/internals/wal-record-format" element={<Pages.WalRecordFormatDocsPage />} />
      <Route path="/project-docs/guide/internals/manifest-format" element={<Pages.ManifestFormatDocsPage />} />
      <Route path="/project-docs/guide/internals/block-format" element={<Pages.BlockFormatDocsPage />} />
      <Route path="/project-docs/guide/internals/file-layout" element={<Pages.FileLayoutDocsPage />} />
      <Route path="/project-docs/guide/implementation/package-structure" element={<Pages.PackageStructureDocsPage />} />
      <Route path="/project-docs/guide/implementation/db-lifecycle" element={<Pages.DbLifecycleDocsPage />} />
      <Route path="/project-docs/guide/implementation/flush-pipeline" element={<Pages.FlushPipelineDocsPage />} />
      <Route path="/project-docs/guide/implementation/wal-truncate" element={<Pages.WalTruncationDocsPage />} />
      <Route path="/project-docs/guide/implementation/compaction-pipeline" element={<Pages.CompactionPipelineDocsPage />} />
      <Route path="/project-docs/guide/implementation/recovery-pipeline" element={<Pages.RecoveryPipelineDocsPage />} />
      <Route path="/project-docs/guide/design-decisions" element={<Pages.DesignDecisionsDocsPage />} />
      <Route path="/project-docs/guide/system-invariants" element={<Pages.SystemInvariantsDocsPage />} />
      <Route path="/project-docs/guide/engineering-tradeoffs" element={<Pages.EngineeringTradeoffsDocsPage />} />
      <Route path="/project-docs/guide/evolution" element={<Pages.EvolutionDocsPage />} />
      <Route path="/project-docs/guide/lessons-learned" element={<Pages.LessonsLearnedDocsPage />} />
      <Route path="/project-docs/guide/performance/benchmark-methodology" element={<Pages.BenchmarkMethodologyDocsPage />} />
      <Route path="/project-docs/guide/performance/benchmark-results" element={<Pages.BenchmarkResultsDocsPage />} />
      <Route path="/project-docs/guide/performance/memory-usage" element={<Pages.MemoryUsageDocsPage />} />
      <Route path="/project-docs/guide/performance/read-write-performance" element={<Pages.PerformanceOverviewDocsPage />} />
      <Route path="/project-docs/guide/testing/testing-strategy" element={<Pages.TestingStrategyDocsPage />} />
      <Route path="/project-docs/guide/testing/crash-testing" element={<Pages.CrashTestingDocsPage />} />
      <Route path="/project-docs/guide/testing/failure-injection" element={<Pages.FailureInjectionDocsPage />} />
      <Route path="/project-docs/guide/testing/race-detection" element={<Pages.RaceDetectionDocsPage />} />
      <Route path="/project-docs/guide/debugging/wal-replay-bug" element={<Pages.WalReplayBugDocsPage />} />
      <Route path="/project-docs/guide/debugging/manifest-consistency" element={<Pages.ManifestConsistencyDocsPage />} />
      <Route path="/project-docs/guide/debugging/compaction-race" element={<Pages.CompactionRaceDocsPage />} />
      <Route path="/project-docs/guide/debugging/reader-lifecycle" element={<Pages.ReaderLifecycleDocsPage />} />
      <Route path="/project-docs/guide/debugging/scan-lock-contention" element={<Pages.ScanLockContentionDocsPage />} />
      <Route path="/project-docs/guide/debugging/shutdown-ordering" element={<Pages.ShutdownOrderingDocsPage />} />
      <Route path="/project-docs/guide/reference/configuration" element={<Pages.ConfigurationDocsPage />} />
      <Route path="/project-docs/guide/reference/cli" element={<Pages.CliDocsPage />} />
      <Route path="/project-docs/guide/reference/project-structure" element={<Pages.ProjectStructureDocsPage />} />
      <Route path="/project-docs/guide/reference/source-code-tour" element={<Pages.SourceCodeTourDocsPage />} />
      <Route path="/project-docs/guide/reference/development-timeline" element={<Pages.DevelopmentTimelineDocsPage />} />
      <Route path="/project-docs/guide/reference/milestones" element={<Pages.MilestonesDocsPage />} />
      <Route path="*" element={<Pages.NotFoundPage />} />
    </Routes>
  );
}

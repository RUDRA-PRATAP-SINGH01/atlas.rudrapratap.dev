import { lazy } from "react";

export const LandingPage = lazy(() => import("@/pages/landing/LandingPage"));
export const BlogPage = lazy(() => import("@/pages/BlogPage"));
export const ProjectDocsPage = lazy(() => import("@/pages/docs/hub/ProjectDocsPage"));
export const NotFoundPage = lazy(() => import("@/pages/NotFoundPage"));
export const ReferenceDocsPage = lazy(() => import("@/pages/docs/reference/ReferenceDocsPage"));

export const IntroDocsPage = lazy(() => import("@/pages/docs/guide/IntroDocsPage"));
export const GuideDocsPage = lazy(() => import("@/pages/docs/guide/pebbledb/GuideDocsPage"));
export const SetupDocsPage = lazy(() => import("@/pages/docs/guide/SetupDocsPage"));
export const LsmFundamentalsDocsPage = lazy(() => import("@/pages/docs/guide/LsmFundamentalsDocsPage"));

export const SystemOverviewDocsPage = lazy(() => import("@/pages/docs/guide/architecture/SystemOverviewDocsPage"));
export const WritePathDocsPage = lazy(() => import("@/pages/docs/guide/architecture/WritePathDocsPage"));
export const ReadPathDocsPage = lazy(() => import("@/pages/docs/guide/architecture/ReadPathDocsPage"));
export const ScanPathDocsPage = lazy(() => import("@/pages/docs/guide/architecture/ScanPathDocsPage"));
export const CrashRecoveryDocsPage = lazy(() => import("@/pages/docs/guide/architecture/CrashRecoveryDocsPage"));
export const ShutdownSequenceDocsPage = lazy(() => import("@/pages/docs/guide/architecture/ShutdownSequenceDocsPage"));
export const ConcurrencyModelDocsPage = lazy(() => import("@/pages/docs/guide/architecture/ConcurrencyModelDocsPage"));

export const WalDocsPage = lazy(() => import("@/pages/docs/guide/core-components/WalDocsPage"));
export const MemtableDocsPage = lazy(() => import("@/pages/docs/guide/core-components/MemtableDocsPage"));
export const SkipListDocsPage = lazy(() => import("@/pages/docs/guide/core-components/SkipListDocsPage"));
export const SstableDocsPage = lazy(() => import("@/pages/docs/guide/core-components/SstableDocsPage"));
export const ManifestDocsPage = lazy(() => import("@/pages/docs/guide/core-components/ManifestDocsPage"));
export const BloomFilterDocsPage = lazy(() => import("@/pages/docs/guide/core-components/BloomFilterDocsPage"));
export const BlockCacheDocsPage = lazy(() => import("@/pages/docs/guide/core-components/BlockCacheDocsPage"));
export const MergeIteratorDocsPage = lazy(() => import("@/pages/docs/guide/core-components/MergeIteratorDocsPage"));

export const SstableLayoutDocsPage = lazy(() => import("@/pages/docs/guide/internals/SstableLayoutDocsPage"));
export const WalRecordFormatDocsPage = lazy(() => import("@/pages/docs/guide/internals/WalRecordFormatDocsPage"));
export const ManifestFormatDocsPage = lazy(() => import("@/pages/docs/guide/internals/ManifestFormatDocsPage"));
export const BlockFormatDocsPage = lazy(() => import("@/pages/docs/guide/internals/BlockFormatDocsPage"));
export const FileLayoutDocsPage = lazy(() => import("@/pages/docs/guide/internals/FileLayoutDocsPage"));

export const PackageStructureDocsPage = lazy(() => import("@/pages/docs/guide/implementation/PackageStructureDocsPage"));
export const DbLifecycleDocsPage = lazy(() => import("@/pages/docs/guide/implementation/DbLifecycleDocsPage"));
export const FlushPipelineDocsPage = lazy(() => import("@/pages/docs/guide/implementation/FlushPipelineDocsPage"));
export const WalTruncationDocsPage = lazy(() => import("@/pages/docs/guide/implementation/WalTruncationDocsPage"));
export const CompactionPipelineDocsPage = lazy(() => import("@/pages/docs/guide/implementation/CompactionPipelineDocsPage"));
export const RecoveryPipelineDocsPage = lazy(() => import("@/pages/docs/guide/implementation/RecoveryPipelineDocsPage"));

export const DesignDecisionsDocsPage = lazy(() => import("@/pages/docs/guide/design/DesignDecisionsDocsPage"));
export const SystemInvariantsDocsPage = lazy(() => import("@/pages/docs/guide/design/SystemInvariantsDocsPage"));
export const EngineeringTradeoffsDocsPage = lazy(() => import("@/pages/docs/guide/design/EngineeringTradeoffsDocsPage"));
export const EvolutionDocsPage = lazy(() => import("@/pages/docs/guide/design/EvolutionDocsPage"));
export const LessonsLearnedDocsPage = lazy(() => import("@/pages/docs/guide/design/LessonsLearnedDocsPage"));

export const PerformanceOverviewDocsPage = lazy(() => import("@/pages/docs/guide/performance/PerformanceOverviewDocsPage"));
export const BenchmarkMethodologyDocsPage = lazy(() => import("@/pages/docs/guide/performance/BenchmarkMethodologyDocsPage"));
export const BenchmarkResultsDocsPage = lazy(() => import("@/pages/docs/guide/performance/BenchmarkResultsDocsPage"));
export const MemoryUsageDocsPage = lazy(() => import("@/pages/docs/guide/performance/MemoryUsageDocsPage"));

export const TestingStrategyDocsPage = lazy(() => import("@/pages/docs/guide/testing/TestingStrategyDocsPage"));
export const CrashTestingDocsPage = lazy(() => import("@/pages/docs/guide/testing/CrashTestingDocsPage"));
export const FailureInjectionDocsPage = lazy(() => import("@/pages/docs/guide/testing/FailureInjectionDocsPage"));
export const RaceDetectionDocsPage = lazy(() => import("@/pages/docs/guide/testing/RaceDetectionDocsPage"));

export const WalReplayBugDocsPage = lazy(() => import("@/pages/docs/guide/debugging/WalReplayBugDocsPage"));
export const ManifestConsistencyDocsPage = lazy(() => import("@/pages/docs/guide/debugging/ManifestConsistencyDocsPage"));
export const CompactionRaceDocsPage = lazy(() => import("@/pages/docs/guide/debugging/CompactionRaceDocsPage"));
export const ReaderLifecycleDocsPage = lazy(() => import("@/pages/docs/guide/debugging/ReaderLifecycleDocsPage"));
export const ScanLockContentionDocsPage = lazy(() => import("@/pages/docs/guide/debugging/ScanLockContentionDocsPage"));
export const ShutdownOrderingDocsPage = lazy(() => import("@/pages/docs/guide/debugging/ShutdownOrderingDocsPage"));

export const ConfigurationDocsPage = lazy(() => import("@/pages/docs/guide/reference/ConfigurationDocsPage"));
export const CliDocsPage = lazy(() => import("@/pages/docs/guide/reference/CliDocsPage"));
export const ProjectStructureDocsPage = lazy(() => import("@/pages/docs/guide/reference/ProjectStructureDocsPage"));
export const SourceCodeTourDocsPage = lazy(() => import("@/pages/docs/guide/reference/SourceCodeTourDocsPage"));
export const DevelopmentTimelineDocsPage = lazy(() => import("@/pages/docs/guide/reference/DevelopmentTimelineDocsPage"));
export const MilestonesDocsPage = lazy(() => import("@/pages/docs/guide/reference/MilestonesDocsPage"));

import { lazy } from "react";

// ── Navigation / Hub pages — always eagerly loaded ──────────────────────────
// These are small and needed immediately on any URL entry point.
export const LandingPage     = lazy(() => import("@/features/landing/LandingPage"));
export const BlogPage        = lazy(() => import("@/features/blog/BlogPage"));
export const ProjectDocsPage = lazy(() => import("@/features/docs/pages/ProjectDocsPage"));
export const NotFoundPage    = lazy(() => import("@/features/landing/NotFoundPage"));
export const ReferenceDocsPage = lazy(() => import("@/features/docs/pages/ReferenceDocsPage"));

// ── PebbleDB guide pages ─────────────────────────────────────────────────────
// Loaded as a single chunk the first time any /project-docs/guide route is hit.
// All subsequent navigations within this chunk are instant (already in memory).
export const IntroDocsPage             = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/features/docs/pages/IntroDocsPage"));
export const GuideDocsPage             = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/features/docs/pages/pebbledb/GuideDocsPage"));
export const SetupDocsPage             = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/features/docs/pages/SetupDocsPage"));
export const LsmFundamentalsDocsPage   = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/features/docs/pages/LsmFundamentalsDocsPage"));
export const SystemOverviewDocsPage    = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/features/docs/pages/architecture/SystemOverviewDocsPage"));
export const WritePathDocsPage         = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/features/docs/pages/architecture/WritePathDocsPage"));
export const ReadPathDocsPage          = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/features/docs/pages/architecture/ReadPathDocsPage"));
export const ScanPathDocsPage          = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/features/docs/pages/architecture/ScanPathDocsPage"));
export const CrashRecoveryDocsPage     = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/features/docs/pages/architecture/CrashRecoveryDocsPage"));
export const ShutdownSequenceDocsPage  = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/features/docs/pages/architecture/ShutdownSequenceDocsPage"));
export const ConcurrencyModelDocsPage  = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/features/docs/pages/architecture/ConcurrencyModelDocsPage"));
export const WalDocsPage               = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/features/docs/pages/core-components/WalDocsPage"));
export const MemtableDocsPage          = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/features/docs/pages/core-components/MemtableDocsPage"));
export const SkipListDocsPage          = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/features/docs/pages/core-components/SkipListDocsPage"));
export const SstableDocsPage           = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/features/docs/pages/core-components/SstableDocsPage"));
export const ManifestDocsPage          = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/features/docs/pages/core-components/ManifestDocsPage"));
export const BloomFilterDocsPage       = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/features/docs/pages/core-components/BloomFilterDocsPage"));
export const BlockCacheDocsPage        = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/features/docs/pages/core-components/BlockCacheDocsPage"));
export const MergeIteratorDocsPage     = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/features/docs/pages/core-components/MergeIteratorDocsPage"));
export const SstableLayoutDocsPage     = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/features/docs/pages/internals/SstableLayoutDocsPage"));
export const WalRecordFormatDocsPage   = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/features/docs/pages/internals/WalRecordFormatDocsPage"));
export const ManifestFormatDocsPage    = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/features/docs/pages/internals/ManifestFormatDocsPage"));
export const BlockFormatDocsPage       = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/features/docs/pages/internals/BlockFormatDocsPage"));
export const FileLayoutDocsPage        = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/features/docs/pages/internals/FileLayoutDocsPage"));
export const PackageStructureDocsPage  = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/features/docs/pages/implementation/PackageStructureDocsPage"));
export const DbLifecycleDocsPage       = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/features/docs/pages/implementation/DbLifecycleDocsPage"));
export const FlushPipelineDocsPage     = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/features/docs/pages/implementation/FlushPipelineDocsPage"));
export const WalTruncationDocsPage     = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/features/docs/pages/implementation/WalTruncationDocsPage"));
export const CompactionPipelineDocsPage = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/features/docs/pages/implementation/CompactionPipelineDocsPage"));
export const RecoveryPipelineDocsPage  = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/features/docs/pages/implementation/RecoveryPipelineDocsPage"));
export const DesignDecisionsDocsPage   = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/features/docs/pages/design/DesignDecisionsDocsPage"));
export const SystemInvariantsDocsPage  = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/features/docs/pages/design/SystemInvariantsDocsPage"));
export const EngineeringTradeoffsDocsPage = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/features/docs/pages/design/EngineeringTradeoffsDocsPage"));
export const EvolutionDocsPage         = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/features/docs/pages/design/EvolutionDocsPage"));
export const LessonsLearnedDocsPage    = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/features/docs/pages/design/LessonsLearnedDocsPage"));
export const PerformanceOverviewDocsPage  = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/features/docs/pages/performance/PerformanceOverviewDocsPage"));
export const BenchmarkMethodologyDocsPage = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/features/docs/pages/performance/BenchmarkMethodologyDocsPage"));
export const BenchmarkResultsDocsPage  = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/features/docs/pages/performance/BenchmarkResultsDocsPage"));
export const MemoryUsageDocsPage       = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/features/docs/pages/performance/MemoryUsageDocsPage"));
export const TestingStrategyDocsPage   = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/features/docs/pages/testing/TestingStrategyDocsPage"));
export const CrashTestingDocsPage      = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/features/docs/pages/testing/CrashTestingDocsPage"));
export const FailureInjectionDocsPage  = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/features/docs/pages/testing/FailureInjectionDocsPage"));
export const RaceDetectionDocsPage     = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/features/docs/pages/testing/RaceDetectionDocsPage"));
export const WalReplayBugDocsPage      = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/features/docs/pages/debugging/WalReplayBugDocsPage"));
export const ManifestConsistencyDocsPage = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/features/docs/pages/debugging/ManifestConsistencyDocsPage"));
export const CompactionRaceDocsPage    = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/features/docs/pages/debugging/CompactionRaceDocsPage"));
export const ReaderLifecycleDocsPage   = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/features/docs/pages/debugging/ReaderLifecycleDocsPage"));
export const ScanLockContentionDocsPage = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/features/docs/pages/debugging/ScanLockContentionDocsPage"));
export const ShutdownOrderingDocsPage  = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/features/docs/pages/debugging/ShutdownOrderingDocsPage"));
export const ConfigurationDocsPage     = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/features/docs/pages/reference/ConfigurationDocsPage"));
export const CliDocsPage               = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/features/docs/pages/reference/CliDocsPage"));
export const ProjectStructureDocsPage  = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/features/docs/pages/reference/ProjectStructureDocsPage"));
export const SourceCodeTourDocsPage    = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/features/docs/pages/reference/SourceCodeTourDocsPage"));
export const DevelopmentTimelineDocsPage = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/features/docs/pages/reference/DevelopmentTimelineDocsPage"));
export const MilestonesDocsPage        = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/features/docs/pages/reference/MilestonesDocsPage"));
export const ProductionFailuresPage    = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/features/docs/pages/improvements/ProductionFailuresPage"));
export const RequiredFeaturesPage      = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/features/docs/pages/improvements/RequiredFeaturesPage"));
export const ProposedFixesPage         = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/features/docs/pages/improvements/ProposedFixesPage"));

// ── Distributed Rate Limiter guide pages ─────────────────────────────────────
// Separate chunk — users who enter through the landing page or PebbleDB docs
// never download this code until they navigate to a rate-limiter route.
export const RateLimiterDocPage = lazy(() => import(/* webpackChunkName: "rate-limiter-guide" */ "@/features/docs/pages/rate-limiter/RateLimiterDocPage"));
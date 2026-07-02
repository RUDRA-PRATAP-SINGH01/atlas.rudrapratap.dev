import { lazy } from "react";

// ── Navigation / Hub pages — always eagerly loaded ──────────────────────────
// These are small and needed immediately on any URL entry point.
export const LandingPage     = lazy(() => import("@/pages/landing/LandingPage"));
export const BlogPage        = lazy(() => import("@/pages/BlogPage"));
export const ProjectDocsPage = lazy(() => import("@/pages/docs/hub/ProjectDocsPage"));
export const NotFoundPage    = lazy(() => import("@/pages/NotFoundPage"));
export const ReferenceDocsPage = lazy(() => import("@/pages/docs/reference/ReferenceDocsPage"));

// ── PebbleDB guide pages ─────────────────────────────────────────────────────
// Loaded as a single chunk the first time any /project-docs/guide route is hit.
// All subsequent navigations within this chunk are instant (already in memory).
export const IntroDocsPage             = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/pages/docs/guide/IntroDocsPage"));
export const GuideDocsPage             = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/pages/docs/guide/pebbledb/GuideDocsPage"));
export const SetupDocsPage             = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/pages/docs/guide/SetupDocsPage"));
export const LsmFundamentalsDocsPage   = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/pages/docs/guide/LsmFundamentalsDocsPage"));
export const SystemOverviewDocsPage    = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/pages/docs/guide/architecture/SystemOverviewDocsPage"));
export const WritePathDocsPage         = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/pages/docs/guide/architecture/WritePathDocsPage"));
export const ReadPathDocsPage          = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/pages/docs/guide/architecture/ReadPathDocsPage"));
export const ScanPathDocsPage          = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/pages/docs/guide/architecture/ScanPathDocsPage"));
export const CrashRecoveryDocsPage     = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/pages/docs/guide/architecture/CrashRecoveryDocsPage"));
export const ShutdownSequenceDocsPage  = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/pages/docs/guide/architecture/ShutdownSequenceDocsPage"));
export const ConcurrencyModelDocsPage  = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/pages/docs/guide/architecture/ConcurrencyModelDocsPage"));
export const WalDocsPage               = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/pages/docs/guide/core-components/WalDocsPage"));
export const MemtableDocsPage          = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/pages/docs/guide/core-components/MemtableDocsPage"));
export const SkipListDocsPage          = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/pages/docs/guide/core-components/SkipListDocsPage"));
export const SstableDocsPage           = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/pages/docs/guide/core-components/SstableDocsPage"));
export const ManifestDocsPage          = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/pages/docs/guide/core-components/ManifestDocsPage"));
export const BloomFilterDocsPage       = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/pages/docs/guide/core-components/BloomFilterDocsPage"));
export const BlockCacheDocsPage        = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/pages/docs/guide/core-components/BlockCacheDocsPage"));
export const MergeIteratorDocsPage     = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/pages/docs/guide/core-components/MergeIteratorDocsPage"));
export const SstableLayoutDocsPage     = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/pages/docs/guide/internals/SstableLayoutDocsPage"));
export const WalRecordFormatDocsPage   = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/pages/docs/guide/internals/WalRecordFormatDocsPage"));
export const ManifestFormatDocsPage    = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/pages/docs/guide/internals/ManifestFormatDocsPage"));
export const BlockFormatDocsPage       = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/pages/docs/guide/internals/BlockFormatDocsPage"));
export const FileLayoutDocsPage        = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/pages/docs/guide/internals/FileLayoutDocsPage"));
export const PackageStructureDocsPage  = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/pages/docs/guide/implementation/PackageStructureDocsPage"));
export const DbLifecycleDocsPage       = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/pages/docs/guide/implementation/DbLifecycleDocsPage"));
export const FlushPipelineDocsPage     = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/pages/docs/guide/implementation/FlushPipelineDocsPage"));
export const WalTruncationDocsPage     = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/pages/docs/guide/implementation/WalTruncationDocsPage"));
export const CompactionPipelineDocsPage = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/pages/docs/guide/implementation/CompactionPipelineDocsPage"));
export const RecoveryPipelineDocsPage  = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/pages/docs/guide/implementation/RecoveryPipelineDocsPage"));
export const DesignDecisionsDocsPage   = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/pages/docs/guide/design/DesignDecisionsDocsPage"));
export const SystemInvariantsDocsPage  = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/pages/docs/guide/design/SystemInvariantsDocsPage"));
export const EngineeringTradeoffsDocsPage = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/pages/docs/guide/design/EngineeringTradeoffsDocsPage"));
export const EvolutionDocsPage         = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/pages/docs/guide/design/EvolutionDocsPage"));
export const LessonsLearnedDocsPage    = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/pages/docs/guide/design/LessonsLearnedDocsPage"));
export const PerformanceOverviewDocsPage  = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/pages/docs/guide/performance/PerformanceOverviewDocsPage"));
export const BenchmarkMethodologyDocsPage = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/pages/docs/guide/performance/BenchmarkMethodologyDocsPage"));
export const BenchmarkResultsDocsPage  = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/pages/docs/guide/performance/BenchmarkResultsDocsPage"));
export const MemoryUsageDocsPage       = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/pages/docs/guide/performance/MemoryUsageDocsPage"));
export const TestingStrategyDocsPage   = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/pages/docs/guide/testing/TestingStrategyDocsPage"));
export const CrashTestingDocsPage      = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/pages/docs/guide/testing/CrashTestingDocsPage"));
export const FailureInjectionDocsPage  = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/pages/docs/guide/testing/FailureInjectionDocsPage"));
export const RaceDetectionDocsPage     = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/pages/docs/guide/testing/RaceDetectionDocsPage"));
export const WalReplayBugDocsPage      = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/pages/docs/guide/debugging/WalReplayBugDocsPage"));
export const ManifestConsistencyDocsPage = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/pages/docs/guide/debugging/ManifestConsistencyDocsPage"));
export const CompactionRaceDocsPage    = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/pages/docs/guide/debugging/CompactionRaceDocsPage"));
export const ReaderLifecycleDocsPage   = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/pages/docs/guide/debugging/ReaderLifecycleDocsPage"));
export const ScanLockContentionDocsPage = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/pages/docs/guide/debugging/ScanLockContentionDocsPage"));
export const ShutdownOrderingDocsPage  = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/pages/docs/guide/debugging/ShutdownOrderingDocsPage"));
export const ConfigurationDocsPage     = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/pages/docs/guide/reference/ConfigurationDocsPage"));
export const CliDocsPage               = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/pages/docs/guide/reference/CliDocsPage"));
export const ProjectStructureDocsPage  = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/pages/docs/guide/reference/ProjectStructureDocsPage"));
export const SourceCodeTourDocsPage    = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/pages/docs/guide/reference/SourceCodeTourDocsPage"));
export const DevelopmentTimelineDocsPage = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/pages/docs/guide/reference/DevelopmentTimelineDocsPage"));
export const MilestonesDocsPage        = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/pages/docs/guide/reference/MilestonesDocsPage"));
export const ProductionFailuresPage    = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/pages/docs/guide/improvements/ProductionFailuresPage"));
export const RequiredFeaturesPage      = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/pages/docs/guide/improvements/RequiredFeaturesPage"));
export const ProposedFixesPage         = lazy(() => import(/* webpackChunkName: "pebbledb-guide" */ "@/pages/docs/guide/improvements/ProposedFixesPage"));

// ── Distributed Rate Limiter guide pages ─────────────────────────────────────
// Separate chunk — users who enter through the landing page or PebbleDB docs
// never download this code until they navigate to a rate-limiter route.
export const RLIntroductionPage        = lazy(() => import(/* webpackChunkName: "rate-limiter-guide" */ "@/pages/docs/guide/rate-limiter/RLIntroductionPage"));
export const RLArchitecturePage        = lazy(() => import(/* webpackChunkName: "rate-limiter-guide" */ "@/pages/docs/guide/rate-limiter/RLArchitecturePage"));
export const RLRequestLifecyclePage    = lazy(() => import(/* webpackChunkName: "rate-limiter-guide" */ "@/pages/docs/guide/rate-limiter/RLRequestLifecyclePage"));
export const RLLuaScriptsPage          = lazy(() => import(/* webpackChunkName: "rate-limiter-guide" */ "@/pages/docs/guide/rate-limiter/RLLuaScriptsPage"));
export const RLCircuitBreakerPage      = lazy(() => import(/* webpackChunkName: "rate-limiter-guide" */ "@/pages/docs/guide/rate-limiter/RLCircuitBreakerPage"));
export const RLConfigurationPage       = lazy(() => import(/* webpackChunkName: "rate-limiter-guide" */ "@/pages/docs/guide/rate-limiter/RLConfigurationPage"));
export const RLHierarchicalPage        = lazy(() => import(/* webpackChunkName: "rate-limiter-guide" */ "@/pages/docs/guide/rate-limiter/RLHierarchicalPage"));
export const RLIdempotencyPage         = lazy(() => import(/* webpackChunkName: "rate-limiter-guide" */ "@/pages/docs/guide/rate-limiter/RLIdempotencyPage"));
export const RLRedisHaPage             = lazy(() => import(/* webpackChunkName: "rate-limiter-guide" */ "@/pages/docs/guide/rate-limiter/RLRedisHaPage"));
export const RLRoutingPage             = lazy(() => import(/* webpackChunkName: "rate-limiter-guide" */ "@/pages/docs/guide/rate-limiter/RLRoutingPage"));
export const RLObservabilityPage       = lazy(() => import(/* webpackChunkName: "rate-limiter-guide" */ "@/pages/docs/guide/rate-limiter/RLObservabilityPage"));
export const RLBenchmarksPage          = lazy(() => import(/* webpackChunkName: "rate-limiter-guide" */ "@/pages/docs/guide/rate-limiter/RLBenchmarksPage"));
export const RLDesignDecisionsPage     = lazy(() => import(/* webpackChunkName: "rate-limiter-guide" */ "@/pages/docs/guide/rate-limiter/RLDesignDecisionsPage"));
export const RLSystemInvariantsPage    = lazy(() => import(/* webpackChunkName: "rate-limiter-guide" */ "@/pages/docs/guide/rate-limiter/RLSystemInvariantsPage"));
export const RLEngineeringTradeoffsPage = lazy(() => import(/* webpackChunkName: "rate-limiter-guide" */ "@/pages/docs/guide/rate-limiter/RLEngineeringTradeoffsPage"));
export const RLOperationsRunbooksPage  = lazy(() => import(/* webpackChunkName: "rate-limiter-guide" */ "@/pages/docs/guide/rate-limiter/RLOperationsRunbooksPage"));
export const RLChaosTestingPage        = lazy(() => import(/* webpackChunkName: "rate-limiter-guide" */ "@/pages/docs/guide/rate-limiter/RLChaosTestingPage"));
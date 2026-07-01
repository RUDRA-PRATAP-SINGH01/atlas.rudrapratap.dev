import { lazy } from "react";

export const LandingPage = lazy(() => import("@/pages/landing/LandingPage"));
export const BlogPage = lazy(() => import("@/pages/BlogPage"));
export const ProjectDocsPage = lazy(() => import("@/pages/docs/hub/ProjectDocsPage"));
export const NotFoundPage = lazy(() => import("@/pages/NotFoundPage"));
export const ReferenceDocsPage = lazy(() => import("@/pages/docs/reference/ReferenceDocsPage"));











// Improvements and Fallbacks Pages

// Distributed Rate Limiter Pages

// Statically imported guide pages for instant transition performance
import IntroDocsPage_mod from "@/pages/docs/guide/IntroDocsPage";
import GuideDocsPage_mod from "@/pages/docs/guide/pebbledb/GuideDocsPage";
import SetupDocsPage_mod from "@/pages/docs/guide/SetupDocsPage";
import LsmFundamentalsDocsPage_mod from "@/pages/docs/guide/LsmFundamentalsDocsPage";
import SystemOverviewDocsPage_mod from "@/pages/docs/guide/architecture/SystemOverviewDocsPage";
import WritePathDocsPage_mod from "@/pages/docs/guide/architecture/WritePathDocsPage";
import ReadPathDocsPage_mod from "@/pages/docs/guide/architecture/ReadPathDocsPage";
import ScanPathDocsPage_mod from "@/pages/docs/guide/architecture/ScanPathDocsPage";
import CrashRecoveryDocsPage_mod from "@/pages/docs/guide/architecture/CrashRecoveryDocsPage";
import ShutdownSequenceDocsPage_mod from "@/pages/docs/guide/architecture/ShutdownSequenceDocsPage";
import ConcurrencyModelDocsPage_mod from "@/pages/docs/guide/architecture/ConcurrencyModelDocsPage";
import WalDocsPage_mod from "@/pages/docs/guide/core-components/WalDocsPage";
import MemtableDocsPage_mod from "@/pages/docs/guide/core-components/MemtableDocsPage";
import SkipListDocsPage_mod from "@/pages/docs/guide/core-components/SkipListDocsPage";
import SstableDocsPage_mod from "@/pages/docs/guide/core-components/SstableDocsPage";
import ManifestDocsPage_mod from "@/pages/docs/guide/core-components/ManifestDocsPage";
import BloomFilterDocsPage_mod from "@/pages/docs/guide/core-components/BloomFilterDocsPage";
import BlockCacheDocsPage_mod from "@/pages/docs/guide/core-components/BlockCacheDocsPage";
import MergeIteratorDocsPage_mod from "@/pages/docs/guide/core-components/MergeIteratorDocsPage";
import SstableLayoutDocsPage_mod from "@/pages/docs/guide/internals/SstableLayoutDocsPage";
import WalRecordFormatDocsPage_mod from "@/pages/docs/guide/internals/WalRecordFormatDocsPage";
import ManifestFormatDocsPage_mod from "@/pages/docs/guide/internals/ManifestFormatDocsPage";
import BlockFormatDocsPage_mod from "@/pages/docs/guide/internals/BlockFormatDocsPage";
import FileLayoutDocsPage_mod from "@/pages/docs/guide/internals/FileLayoutDocsPage";
import PackageStructureDocsPage_mod from "@/pages/docs/guide/implementation/PackageStructureDocsPage";
import DbLifecycleDocsPage_mod from "@/pages/docs/guide/implementation/DbLifecycleDocsPage";
import FlushPipelineDocsPage_mod from "@/pages/docs/guide/implementation/FlushPipelineDocsPage";
import WalTruncationDocsPage_mod from "@/pages/docs/guide/implementation/WalTruncationDocsPage";
import CompactionPipelineDocsPage_mod from "@/pages/docs/guide/implementation/CompactionPipelineDocsPage";
import RecoveryPipelineDocsPage_mod from "@/pages/docs/guide/implementation/RecoveryPipelineDocsPage";
import DesignDecisionsDocsPage_mod from "@/pages/docs/guide/design/DesignDecisionsDocsPage";
import SystemInvariantsDocsPage_mod from "@/pages/docs/guide/design/SystemInvariantsDocsPage";
import EngineeringTradeoffsDocsPage_mod from "@/pages/docs/guide/design/EngineeringTradeoffsDocsPage";
import EvolutionDocsPage_mod from "@/pages/docs/guide/design/EvolutionDocsPage";
import LessonsLearnedDocsPage_mod from "@/pages/docs/guide/design/LessonsLearnedDocsPage";
import PerformanceOverviewDocsPage_mod from "@/pages/docs/guide/performance/PerformanceOverviewDocsPage";
import BenchmarkMethodologyDocsPage_mod from "@/pages/docs/guide/performance/BenchmarkMethodologyDocsPage";
import BenchmarkResultsDocsPage_mod from "@/pages/docs/guide/performance/BenchmarkResultsDocsPage";
import MemoryUsageDocsPage_mod from "@/pages/docs/guide/performance/MemoryUsageDocsPage";
import TestingStrategyDocsPage_mod from "@/pages/docs/guide/testing/TestingStrategyDocsPage";
import CrashTestingDocsPage_mod from "@/pages/docs/guide/testing/CrashTestingDocsPage";
import FailureInjectionDocsPage_mod from "@/pages/docs/guide/testing/FailureInjectionDocsPage";
import RaceDetectionDocsPage_mod from "@/pages/docs/guide/testing/RaceDetectionDocsPage";
import WalReplayBugDocsPage_mod from "@/pages/docs/guide/debugging/WalReplayBugDocsPage";
import ManifestConsistencyDocsPage_mod from "@/pages/docs/guide/debugging/ManifestConsistencyDocsPage";
import CompactionRaceDocsPage_mod from "@/pages/docs/guide/debugging/CompactionRaceDocsPage";
import ReaderLifecycleDocsPage_mod from "@/pages/docs/guide/debugging/ReaderLifecycleDocsPage";
import ScanLockContentionDocsPage_mod from "@/pages/docs/guide/debugging/ScanLockContentionDocsPage";
import ShutdownOrderingDocsPage_mod from "@/pages/docs/guide/debugging/ShutdownOrderingDocsPage";
import ConfigurationDocsPage_mod from "@/pages/docs/guide/reference/ConfigurationDocsPage";
import CliDocsPage_mod from "@/pages/docs/guide/reference/CliDocsPage";
import ProjectStructureDocsPage_mod from "@/pages/docs/guide/reference/ProjectStructureDocsPage";
import SourceCodeTourDocsPage_mod from "@/pages/docs/guide/reference/SourceCodeTourDocsPage";
import DevelopmentTimelineDocsPage_mod from "@/pages/docs/guide/reference/DevelopmentTimelineDocsPage";
import MilestonesDocsPage_mod from "@/pages/docs/guide/reference/MilestonesDocsPage";
import ProductionFailuresPage_mod from "@/pages/docs/guide/improvements/ProductionFailuresPage";
import RequiredFeaturesPage_mod from "@/pages/docs/guide/improvements/RequiredFeaturesPage";
import ProposedFixesPage_mod from "@/pages/docs/guide/improvements/ProposedFixesPage";
import RLIntroductionPage_mod from "@/pages/docs/guide/rate-limiter/RLIntroductionPage";
import RLArchitecturePage_mod from "@/pages/docs/guide/rate-limiter/RLArchitecturePage";
import RLRequestLifecyclePage_mod from "@/pages/docs/guide/rate-limiter/RLRequestLifecyclePage";
import RLLuaScriptsPage_mod from "@/pages/docs/guide/rate-limiter/RLLuaScriptsPage";
import RLCircuitBreakerPage_mod from "@/pages/docs/guide/rate-limiter/RLCircuitBreakerPage";
import RLConfigurationPage_mod from "@/pages/docs/guide/rate-limiter/RLConfigurationPage";
import RLHierarchicalPage_mod from "@/pages/docs/guide/rate-limiter/RLHierarchicalPage";
import RLIdempotencyPage_mod from "@/pages/docs/guide/rate-limiter/RLIdempotencyPage";
import RLRedisHaPage_mod from "@/pages/docs/guide/rate-limiter/RLRedisHaPage";
import RLRoutingPage_mod from "@/pages/docs/guide/rate-limiter/RLRoutingPage";
import RLObservabilityPage_mod from "@/pages/docs/guide/rate-limiter/RLObservabilityPage";
import RLBenchmarksPage_mod from "@/pages/docs/guide/rate-limiter/RLBenchmarksPage";
import RLDesignDecisionsPage_mod from "@/pages/docs/guide/rate-limiter/RLDesignDecisionsPage";
import RLSystemInvariantsPage_mod from "@/pages/docs/guide/rate-limiter/RLSystemInvariantsPage";
import RLEngineeringTradeoffsPage_mod from "@/pages/docs/guide/rate-limiter/RLEngineeringTradeoffsPage";
import RLOperationsRunbooksPage_mod from "@/pages/docs/guide/rate-limiter/RLOperationsRunbooksPage";
import RLChaosTestingPage_mod from "@/pages/docs/guide/rate-limiter/RLChaosTestingPage";

export const IntroDocsPage = IntroDocsPage_mod;
export const GuideDocsPage = GuideDocsPage_mod;
export const SetupDocsPage = SetupDocsPage_mod;
export const LsmFundamentalsDocsPage = LsmFundamentalsDocsPage_mod;
export const SystemOverviewDocsPage = SystemOverviewDocsPage_mod;
export const WritePathDocsPage = WritePathDocsPage_mod;
export const ReadPathDocsPage = ReadPathDocsPage_mod;
export const ScanPathDocsPage = ScanPathDocsPage_mod;
export const CrashRecoveryDocsPage = CrashRecoveryDocsPage_mod;
export const ShutdownSequenceDocsPage = ShutdownSequenceDocsPage_mod;
export const ConcurrencyModelDocsPage = ConcurrencyModelDocsPage_mod;
export const WalDocsPage = WalDocsPage_mod;
export const MemtableDocsPage = MemtableDocsPage_mod;
export const SkipListDocsPage = SkipListDocsPage_mod;
export const SstableDocsPage = SstableDocsPage_mod;
export const ManifestDocsPage = ManifestDocsPage_mod;
export const BloomFilterDocsPage = BloomFilterDocsPage_mod;
export const BlockCacheDocsPage = BlockCacheDocsPage_mod;
export const MergeIteratorDocsPage = MergeIteratorDocsPage_mod;
export const SstableLayoutDocsPage = SstableLayoutDocsPage_mod;
export const WalRecordFormatDocsPage = WalRecordFormatDocsPage_mod;
export const ManifestFormatDocsPage = ManifestFormatDocsPage_mod;
export const BlockFormatDocsPage = BlockFormatDocsPage_mod;
export const FileLayoutDocsPage = FileLayoutDocsPage_mod;
export const PackageStructureDocsPage = PackageStructureDocsPage_mod;
export const DbLifecycleDocsPage = DbLifecycleDocsPage_mod;
export const FlushPipelineDocsPage = FlushPipelineDocsPage_mod;
export const WalTruncationDocsPage = WalTruncationDocsPage_mod;
export const CompactionPipelineDocsPage = CompactionPipelineDocsPage_mod;
export const RecoveryPipelineDocsPage = RecoveryPipelineDocsPage_mod;
export const DesignDecisionsDocsPage = DesignDecisionsDocsPage_mod;
export const SystemInvariantsDocsPage = SystemInvariantsDocsPage_mod;
export const EngineeringTradeoffsDocsPage = EngineeringTradeoffsDocsPage_mod;
export const EvolutionDocsPage = EvolutionDocsPage_mod;
export const LessonsLearnedDocsPage = LessonsLearnedDocsPage_mod;
export const PerformanceOverviewDocsPage = PerformanceOverviewDocsPage_mod;
export const BenchmarkMethodologyDocsPage = BenchmarkMethodologyDocsPage_mod;
export const BenchmarkResultsDocsPage = BenchmarkResultsDocsPage_mod;
export const MemoryUsageDocsPage = MemoryUsageDocsPage_mod;
export const TestingStrategyDocsPage = TestingStrategyDocsPage_mod;
export const CrashTestingDocsPage = CrashTestingDocsPage_mod;
export const FailureInjectionDocsPage = FailureInjectionDocsPage_mod;
export const RaceDetectionDocsPage = RaceDetectionDocsPage_mod;
export const WalReplayBugDocsPage = WalReplayBugDocsPage_mod;
export const ManifestConsistencyDocsPage = ManifestConsistencyDocsPage_mod;
export const CompactionRaceDocsPage = CompactionRaceDocsPage_mod;
export const ReaderLifecycleDocsPage = ReaderLifecycleDocsPage_mod;
export const ScanLockContentionDocsPage = ScanLockContentionDocsPage_mod;
export const ShutdownOrderingDocsPage = ShutdownOrderingDocsPage_mod;
export const ConfigurationDocsPage = ConfigurationDocsPage_mod;
export const CliDocsPage = CliDocsPage_mod;
export const ProjectStructureDocsPage = ProjectStructureDocsPage_mod;
export const SourceCodeTourDocsPage = SourceCodeTourDocsPage_mod;
export const DevelopmentTimelineDocsPage = DevelopmentTimelineDocsPage_mod;
export const MilestonesDocsPage = MilestonesDocsPage_mod;
export const ProductionFailuresPage = ProductionFailuresPage_mod;
export const RequiredFeaturesPage = RequiredFeaturesPage_mod;
export const ProposedFixesPage = ProposedFixesPage_mod;
export const RLIntroductionPage = RLIntroductionPage_mod;
export const RLArchitecturePage = RLArchitecturePage_mod;
export const RLRequestLifecyclePage = RLRequestLifecyclePage_mod;
export const RLLuaScriptsPage = RLLuaScriptsPage_mod;
export const RLCircuitBreakerPage = RLCircuitBreakerPage_mod;
export const RLConfigurationPage = RLConfigurationPage_mod;
export const RLHierarchicalPage = RLHierarchicalPage_mod;
export const RLIdempotencyPage = RLIdempotencyPage_mod;
export const RLRedisHaPage = RLRedisHaPage_mod;
export const RLRoutingPage = RLRoutingPage_mod;
export const RLObservabilityPage = RLObservabilityPage_mod;
export const RLBenchmarksPage = RLBenchmarksPage_mod;
export const RLDesignDecisionsPage = RLDesignDecisionsPage_mod;
export const RLSystemInvariantsPage = RLSystemInvariantsPage_mod;
export const RLEngineeringTradeoffsPage = RLEngineeringTradeoffsPage_mod;
export const RLOperationsRunbooksPage = RLOperationsRunbooksPage_mod;
export const RLChaosTestingPage = RLChaosTestingPage_mod;
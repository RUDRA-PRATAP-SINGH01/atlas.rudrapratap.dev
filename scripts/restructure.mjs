import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "src");

const pageMoves = {
  "BlogPage.jsx": "pages/BlogPage.jsx",
  "NotFoundPage.jsx": "pages/NotFoundPage.jsx",
  "ProjectDocsPage.jsx": "pages/docs/hub/ProjectDocsPage.jsx",
  "ReferenceDocsPage.jsx": "pages/docs/reference/ReferenceDocsPage.jsx",
  "IntroDocsPage.jsx": "pages/docs/guide/IntroDocsPage.jsx",
  "SetupDocsPage.jsx": "pages/docs/guide/SetupDocsPage.jsx",
  "LsmFundamentalsDocsPage.jsx": "pages/docs/guide/LsmFundamentalsDocsPage.jsx",
  "GuideDocsPage.jsx": "pages/docs/guide/pebbledb/GuideDocsPage.jsx",
  "SystemOverviewDocsPage.jsx": "pages/docs/guide/architecture/SystemOverviewDocsPage.jsx",
  "WritePathDocsPage.jsx": "pages/docs/guide/architecture/WritePathDocsPage.jsx",
  "ReadPathDocsPage.jsx": "pages/docs/guide/architecture/ReadPathDocsPage.jsx",
  "ScanPathDocsPage.jsx": "pages/docs/guide/architecture/ScanPathDocsPage.jsx",
  "CrashRecoveryDocsPage.jsx": "pages/docs/guide/architecture/CrashRecoveryDocsPage.jsx",
  "ShutdownSequenceDocsPage.jsx": "pages/docs/guide/architecture/ShutdownSequenceDocsPage.jsx",
  "ConcurrencyModelDocsPage.jsx": "pages/docs/guide/architecture/ConcurrencyModelDocsPage.jsx",
  "WalDocsPage.jsx": "pages/docs/guide/core-components/WalDocsPage.jsx",
  "MemtableDocsPage.jsx": "pages/docs/guide/core-components/MemtableDocsPage.jsx",
  "SkipListDocsPage.jsx": "pages/docs/guide/core-components/SkipListDocsPage.jsx",
  "SstableDocsPage.jsx": "pages/docs/guide/core-components/SstableDocsPage.jsx",
  "ManifestDocsPage.jsx": "pages/docs/guide/core-components/ManifestDocsPage.jsx",
  "BloomFilterDocsPage.jsx": "pages/docs/guide/core-components/BloomFilterDocsPage.jsx",
  "BlockCacheDocsPage.jsx": "pages/docs/guide/core-components/BlockCacheDocsPage.jsx",
  "MergeIteratorDocsPage.jsx": "pages/docs/guide/core-components/MergeIteratorDocsPage.jsx",
  "SstableLayoutDocsPage.jsx": "pages/docs/guide/internals/SstableLayoutDocsPage.jsx",
  "WalRecordFormatDocsPage.jsx": "pages/docs/guide/internals/WalRecordFormatDocsPage.jsx",
  "ManifestFormatDocsPage.jsx": "pages/docs/guide/internals/ManifestFormatDocsPage.jsx",
  "BlockFormatDocsPage.jsx": "pages/docs/guide/internals/BlockFormatDocsPage.jsx",
  "FileLayoutDocsPage.jsx": "pages/docs/guide/internals/FileLayoutDocsPage.jsx",
  "PackageStructureDocsPage.jsx": "pages/docs/guide/implementation/PackageStructureDocsPage.jsx",
  "DbLifecycleDocsPage.jsx": "pages/docs/guide/implementation/DbLifecycleDocsPage.jsx",
  "FlushPipelineDocsPage.jsx": "pages/docs/guide/implementation/FlushPipelineDocsPage.jsx",
  "WalTruncationDocsPage.jsx": "pages/docs/guide/implementation/WalTruncationDocsPage.jsx",
  "CompactionPipelineDocsPage.jsx": "pages/docs/guide/implementation/CompactionPipelineDocsPage.jsx",
  "RecoveryPipelineDocsPage.jsx": "pages/docs/guide/implementation/RecoveryPipelineDocsPage.jsx",
  "DesignDecisionsDocsPage.jsx": "pages/docs/guide/design/DesignDecisionsDocsPage.jsx",
  "SystemInvariantsDocsPage.jsx": "pages/docs/guide/design/SystemInvariantsDocsPage.jsx",
  "EngineeringTradeoffsDocsPage.jsx": "pages/docs/guide/design/EngineeringTradeoffsDocsPage.jsx",
  "EvolutionDocsPage.jsx": "pages/docs/guide/design/EvolutionDocsPage.jsx",
  "LessonsLearnedDocsPage.jsx": "pages/docs/guide/design/LessonsLearnedDocsPage.jsx",
  "PerformanceOverviewDocsPage.jsx": "pages/docs/guide/performance/PerformanceOverviewDocsPage.jsx",
  "BenchmarkMethodologyDocsPage.jsx": "pages/docs/guide/performance/BenchmarkMethodologyDocsPage.jsx",
  "BenchmarkResultsDocsPage.jsx": "pages/docs/guide/performance/BenchmarkResultsDocsPage.jsx",
  "MemoryUsageDocsPage.jsx": "pages/docs/guide/performance/MemoryUsageDocsPage.jsx",
  "TestingStrategyDocsPage.jsx": "pages/docs/guide/testing/TestingStrategyDocsPage.jsx",
  "CrashTestingDocsPage.jsx": "pages/docs/guide/testing/CrashTestingDocsPage.jsx",
  "FailureInjectionDocsPage.jsx": "pages/docs/guide/testing/FailureInjectionDocsPage.jsx",
  "RaceDetectionDocsPage.jsx": "pages/docs/guide/testing/RaceDetectionDocsPage.jsx",
  "WalReplayBugDocsPage.jsx": "pages/docs/guide/debugging/WalReplayBugDocsPage.jsx",
  "ManifestConsistencyDocsPage.jsx": "pages/docs/guide/debugging/ManifestConsistencyDocsPage.jsx",
  "CompactionRaceDocsPage.jsx": "pages/docs/guide/debugging/CompactionRaceDocsPage.jsx",
  "ReaderLifecycleDocsPage.jsx": "pages/docs/guide/debugging/ReaderLifecycleDocsPage.jsx",
  "ScanLockContentionDocsPage.jsx": "pages/docs/guide/debugging/ScanLockContentionDocsPage.jsx",
  "ShutdownOrderingDocsPage.jsx": "pages/docs/guide/debugging/ShutdownOrderingDocsPage.jsx",
  "ConfigurationDocsPage.jsx": "pages/docs/guide/reference/ConfigurationDocsPage.jsx",
  "CliDocsPage.jsx": "pages/docs/guide/reference/CliDocsPage.jsx",
  "ProjectStructureDocsPage.jsx": "pages/docs/guide/reference/ProjectStructureDocsPage.jsx",
  "SourceCodeTourDocsPage.jsx": "pages/docs/guide/reference/SourceCodeTourDocsPage.jsx",
  "DevelopmentTimelineDocsPage.jsx": "pages/docs/guide/reference/DevelopmentTimelineDocsPage.jsx",
  "MilestonesDocsPage.jsx": "pages/docs/guide/reference/MilestonesDocsPage.jsx",
};

const componentMoves = {
  "components/DocsNavbar.jsx": "components/docs/DocsNavbar.jsx",
  "components/DocsSidebar.jsx": "components/docs/DocsSidebar.jsx",
  "components/DocsMermaid.jsx": "components/docs/DocsMermaid.jsx",
  "components/GoCodeBlock.jsx": "components/docs/GoCodeBlock.jsx",
  "components/Navbar.jsx": "components/layout/Navbar.jsx",
  "components/PillButton.jsx": "components/ui/PillButton.jsx",
  "components/LandingPage.jsx": "pages/landing/LandingPage.jsx",
};

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function moveFile(fromRel, toRel) {
  const from = path.join(src, fromRel);
  const to = path.join(src, toRel);
  if (!fs.existsSync(from)) {
    if (fs.existsSync(to)) return;
    throw new Error(`Missing source file: ${fromRel}`);
  }
  ensureDir(to);
  fs.renameSync(from, to);
}

for (const [from, to] of Object.entries(pageMoves)) {
  moveFile(`pages/${from}`, to);
}

for (const [from, to] of Object.entries(componentMoves)) {
  moveFile(from, to);
}

if (fs.existsSync(path.join(src, "index.css"))) {
  ensureDir(path.join(src, "styles/index.css"));
  fs.renameSync(path.join(src, "index.css"), path.join(src, "styles/index.css"));
}

if (fs.existsSync(path.join(src, "App.css"))) {
  fs.unlinkSync(path.join(src, "App.css"));
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.(jsx?|css)$/.test(entry.name)) files.push(full);
  }
  return files;
}

const replacements = [
  [/from "\.\.\/components\/DocsNavbar"/g, 'from "@/components/docs/DocsNavbar"'],
  [/from "\.\.\/components\/DocsSidebar"/g, 'from "@/components/docs/DocsSidebar"'],
  [/from "\.\.\/components\/DocsMermaid"/g, 'from "@/components/docs/DocsMermaid"'],
  [/from "\.\.\/components\/GoCodeBlock"/g, 'from "@/components/docs/GoCodeBlock"'],
  [/from "\.\.\/components\/Navbar"/g, 'from "@/components/layout/Navbar"'],
  [/from "\.\.\/components\/PillButton"/g, 'from "@/components/ui/PillButton"'],
  [/from "\.\.\/data\/docsIndex"/g, 'from "@/data/docsIndex"'],
  [/from "\.\.\/data\/pebbledbReferences"/g, 'from "@/data/pebbledbReferences"'],
  [/from "\.\.\/hooks\/useLocomotiveScroll"/g, 'from "@/hooks/useLocomotiveScroll"'],
  [/from "\.\/Navbar"/g, 'from "@/components/layout/Navbar"'],
  [/from "\.\/PillButton"/g, 'from "@/components/ui/PillButton"'],
  [/from "\.\.\/\.\.\/components\/DocsNavbar"/g, 'from "@/components/docs/DocsNavbar"'],
  [/from "\.\.\/\.\.\/components\/DocsSidebar"/g, 'from "@/components/docs/DocsSidebar"'],
  [/from "\.\.\/\.\.\/components\/DocsMermaid"/g, 'from "@/components/docs/DocsMermaid"'],
  [/from "\.\.\/\.\.\/components\/GoCodeBlock"/g, 'from "@/components/docs/GoCodeBlock"'],
  [/from "\.\.\/\.\.\/data\/pebbledbReferences"/g, 'from "@/data/pebbledbReferences"'],
];

for (const file of walk(src)) {
  let content = fs.readFileSync(file, "utf8");
  let next = content;
  for (const [pattern, value] of replacements) {
    next = next.replace(pattern, value);
  }
  if (next !== content) fs.writeFileSync(file, next);
}

console.log("Restructure complete.");

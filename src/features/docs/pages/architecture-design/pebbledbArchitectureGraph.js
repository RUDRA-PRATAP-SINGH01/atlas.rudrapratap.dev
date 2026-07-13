/**
 * PebbleDB system-design graph for the Architecture Design canvas.
 * Source: PebbleDB docs/architecture/SYSTEM_OVERVIEW.md + docs/diagrams/architecture.mmd
 * Do not invent packages, workers, or on-disk files beyond that evidence.
 */

export const GRAPH_META = {
  project: "PebbleDB",
  subtitle: "Single-node embedded LSM key-value store in Go",
  evidence: "SOURCE-PROVEN — docs/architecture/SYSTEM_OVERVIEW.md",
  github: "https://github.com/RUDRA-PRATAP-SINGH01/PebbleDB",
  guideEntry: "/project-docs/guide/architecture/system-overview",
};

/** @typedef {{ id: string, label: string, kind: string, x: number, y: number, w?: number, h?: number, path?: string, summary: string, guideHref?: string }} ArchNode */
/** @typedef {{ id: string, from: string, to: string }} ArchEdge */
/** @typedef {{ id: string, label: string, x: number, y: number, w: number, h: number }} ArchGroup */

export const groups = /** @type {ArchGroup[]} */ ([
  { id: "g-client", label: "Client", x: 120, y: 40, w: 720, h: 160 },
  { id: "g-memory", label: "In-memory LSM state", x: 40, y: 260, w: 880, h: 160 },
  { id: "g-workers", label: "Background workers", x: 120, y: 480, w: 720, h: 160 },
  { id: "g-packages", label: "Engine packages", x: 20, y: 700, w: 920, h: 180 },
  { id: "g-disk", label: "On disk", x: 20, y: 940, w: 920, h: 200 },
]);

export const nodes = /** @type {ArchNode[]} */ ([
  {
    id: "cli",
    label: "cmd/pebbledb",
    kind: "client",
    x: 200,
    y: 90,
    w: 200,
    h: 64,
    path: "cmd/pebbledb",
    summary: "CLI entrypoint for the embedded engine. Talks to the internal/db API.",
    guideHref: "/project-docs/guide/reference/cli",
  },
  {
    id: "api",
    label: "internal/db API",
    kind: "core",
    x: 520,
    y: 90,
    w: 220,
    h: 64,
    path: "internal/db",
    summary:
      "Public engine surface: Open, Close, Put, Get, Delete, Scan, Sync. Single writer (db.mu); concurrent Get/Scan with snapshots.",
    guideHref: "/project-docs/guide/architecture/system-overview",
  },

  {
    id: "active-mt",
    label: "active memtable",
    kind: "memory",
    x: 80,
    y: 320,
    w: 200,
    h: 64,
    path: "internal/memtable",
    summary: "Writable in-memory skiplist receiving applied WAL batches.",
    guideHref: "/project-docs/guide/core-components/memtable",
  },
  {
    id: "pending-flush",
    label: "pendingFlush queue",
    kind: "memory",
    x: 360,
    y: 320,
    w: 220,
    h: 64,
    path: "internal/db",
    summary: "Immutable memtables waiting for the flusher worker to drain into SSTables.",
    guideHref: "/project-docs/guide/implementation/flush-pipeline",
  },
  {
    id: "sst-list",
    label: "sstables[] + snapshot",
    kind: "memory",
    x: 660,
    y: 320,
    w: 220,
    h: 64,
    path: "internal/db",
    summary: "In-process SST reader list plus atomic snapshot used by concurrent readers.",
    guideHref: "/project-docs/guide/core-components/sstable",
  },

  {
    id: "batch-flusher",
    label: "batchFlusher",
    kind: "worker",
    x: 160,
    y: 540,
    w: 180,
    h: 64,
    path: "internal/db",
    summary:
      "Triggered by timer (~1ms), batch size, or memtable pressure. AppendBatch + fsync, then apply to memtable.",
    guideHref: "/project-docs/guide/architecture/write-path",
  },
  {
    id: "flusher",
    label: "flusher",
    kind: "worker",
    x: 420,
    y: 540,
    w: 160,
    h: 64,
    path: "internal/db",
    summary: "Wakes on flushCh (coalesced). Drains the entire pendingFlush queue per wakeup into SST + manifest.",
    guideHref: "/project-docs/guide/implementation/flush-pipeline",
  },
  {
    id: "compactor",
    label: "compactor",
    kind: "worker",
    x: 660,
    y: 540,
    w: 160,
    h: 64,
    path: "internal/db",
    summary: "Merges oldest two SSTs while count ≥ threshold; updates manifest under compactMu.",
    guideHref: "/project-docs/guide/implementation/compaction-pipeline",
  },

  {
    id: "wal",
    label: "internal/wal",
    kind: "package",
    x: 40,
    y: 770,
    w: 140,
    h: 56,
    path: "internal/wal",
    summary: "Append-only write-ahead log. Durability boundary for writes.",
    guideHref: "/project-docs/guide/core-components/wal",
  },
  {
    id: "memtable-pkg",
    label: "internal/memtable",
    kind: "package",
    x: 200,
    y: 770,
    w: 160,
    h: 56,
    path: "internal/memtable",
    summary: "Skiplist memtable + iterators + snapshots.",
    guideHref: "/project-docs/guide/core-components/skiplist",
  },
  {
    id: "sstable",
    label: "internal/sstable",
    kind: "package",
    x: 380,
    y: 770,
    w: 150,
    h: 56,
    path: "internal/sstable",
    summary: "Immutable sorted SST writer/reader, blocks, index, cache adapters.",
    guideHref: "/project-docs/guide/core-components/sstable",
  },
  {
    id: "manifest",
    label: "internal/manifest",
    kind: "package",
    x: 550,
    y: 770,
    w: 150,
    h: 56,
    path: "internal/manifest",
    summary: "Append-only live SST set log; CURRENT points at the active MANIFEST file.",
    guideHref: "/project-docs/guide/core-components/manifest",
  },
  {
    id: "iterator",
    label: "internal/iterator",
    kind: "package",
    x: 720,
    y: 770,
    w: 150,
    h: 56,
    path: "internal/iterator",
    summary: "Merge iterators over memtables and SST readers for Get/Scan.",
    guideHref: "/project-docs/guide/core-components/merge-iterator",
  },
  {
    id: "bloom",
    label: "internal/bloom",
    kind: "package",
    x: 400,
    y: 850,
    w: 140,
    h: 48,
    path: "internal/bloom",
    summary: "Bloom filter used by the SSTable layer to skip irrelevant files.",
    guideHref: "/project-docs/guide/core-components/bloom-filter",
  },

  {
    id: "lock",
    label: "LOCK",
    kind: "disk",
    x: 40,
    y: 1020,
    w: 100,
    h: 48,
    path: "data/LOCK",
    summary: "Exclusive open lock (flock / LockFileEx). One process per database directory.",
    guideHref: "/project-docs/guide/architecture/system-overview",
  },
  {
    id: "wal-log",
    label: "wal.log",
    kind: "disk",
    x: 160,
    y: 1020,
    w: 110,
    h: 48,
    path: "data/wal.log",
    summary: "Append-only WAL file on disk.",
    guideHref: "/project-docs/guide/internals/wal-record-format",
  },
  {
    id: "wal-flush",
    label: "wal.flush",
    kind: "disk",
    x: 290,
    y: 1020,
    w: 120,
    h: 48,
    path: "data/wal.flush",
    summary: "Transient flush checkpoint file (usually absent).",
    guideHref: "/project-docs/guide/implementation/wal-truncate",
  },
  {
    id: "current",
    label: "CURRENT",
    kind: "disk",
    x: 430,
    y: 1020,
    w: 110,
    h: 48,
    path: "data/CURRENT",
    summary: "Points at the active MANIFEST-* filename.",
    guideHref: "/project-docs/guide/internals/manifest-format",
  },
  {
    id: "manifest-file",
    label: "MANIFEST-*",
    kind: "disk",
    x: 560,
    y: 1020,
    w: 130,
    h: 48,
    path: "data/MANIFEST-*",
    summary: "Append-only live SST set log.",
    guideHref: "/project-docs/guide/internals/manifest-format",
  },
  {
    id: "sst-file",
    label: "sst_*.sst",
    kind: "disk",
    x: 710,
    y: 1020,
    w: 120,
    h: 48,
    path: "data/sst_*.sst",
    summary: "Immutable sorted runs on disk.",
    guideHref: "/project-docs/guide/internals/sstable-layout",
  },
  {
    id: "quarantine",
    label: "quarantine/",
    kind: "disk",
    x: 400,
    y: 1090,
    w: 140,
    h: 48,
    path: "data/quarantine/",
    summary: "Orphan SST files moved here on open.",
    guideHref: "/project-docs/guide/architecture/crash-recovery",
  },
]);

export const edges = /** @type {ArchEdge[]} */ ([
  { id: "e1", from: "cli", to: "api" },
  { id: "e2", from: "api", to: "active-mt" },
  { id: "e3", from: "api", to: "wal" },
  { id: "e4", from: "batch-flusher", to: "wal" },
  { id: "e5", from: "batch-flusher", to: "active-mt" },
  { id: "e6", from: "flusher", to: "pending-flush" },
  { id: "e7", from: "flusher", to: "sstable" },
  { id: "e8", from: "flusher", to: "manifest" },
  { id: "e9", from: "flusher", to: "wal" },
  { id: "e10", from: "compactor", to: "sstable" },
  { id: "e11", from: "compactor", to: "manifest" },
  { id: "e12", from: "wal", to: "wal-log" },
  { id: "e13", from: "wal", to: "wal-flush" },
  { id: "e14", from: "manifest", to: "manifest-file" },
  { id: "e15", from: "manifest", to: "current" },
  { id: "e16", from: "sstable", to: "sst-file" },
  { id: "e17", from: "sstable", to: "bloom" },
  { id: "e18", from: "api", to: "iterator" },
  { id: "e19", from: "api", to: "lock" },
  { id: "e20", from: "api", to: "quarantine" },
  { id: "e21", from: "api", to: "sst-list" },
  { id: "e22", from: "memtable-pkg", to: "active-mt" },
]);

export function getNodeMap() {
  return Object.fromEntries(nodes.map((n) => [n.id, n]));
}

export function getGraphBounds(padding = 120) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const g of groups) {
    minX = Math.min(minX, g.x);
    minY = Math.min(minY, g.y);
    maxX = Math.max(maxX, g.x + g.w);
    maxY = Math.max(maxY, g.y + g.h);
  }
  return {
    minX: minX - padding,
    minY: minY - padding,
    maxX: maxX + padding,
    maxY: maxY + padding,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2,
  };
}

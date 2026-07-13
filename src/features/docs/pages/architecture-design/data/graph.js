/**
 * PebbleDB architecture graph topology — nodes, edges, groups, and helpers.
 *
 * This file owns graph layout only: positions, dimensions, labels, kinds.
 * Architecture decisions are in data/decisions/.
 * Flow definitions are in data/flows.js.
 *
 * Evidence: SOURCE VERIFIED — directly inspected against:
 *   internal/db/db.go, internal/db/batch.go, internal/db/flush.go,
 *   internal/db/compactor.go, internal/db/get.go, internal/db/scan.go,
 *   internal/db/wal_state.go, internal/db/sst_cleanup.go,
 *   internal/db/dir_lock.go, internal/wal/wal.go, internal/wal/limits.go,
 *   internal/manifest/manifest.go, internal/memtable/skiplist.go,
 *   internal/bloom/bloom.go, internal/sstable/reader.go,
 *   internal/iterator/merge.go, cmd/pebbledb/cli.go
 */

export const GRAPH_META = {
  project: "PebbleDB",
  subtitle: "Single-node embedded LSM key-value store in Go",
  // Note: "SOURCE-PROVEN" in the original was overstated.
  // Evidence level corrected: SOURCE VERIFIED for all displayed relationships.
  evidence: "SOURCE VERIFIED — github.com/RUDRA-PRATAP-SINGH01/PebbleDB",
  github: "https://github.com/RUDRA-PRATAP-SINGH01/PebbleDB",
  guideEntry: "/project-docs/guide/architecture/system-overview",
};

/** @typedef {{ id: string, label: string, kind: string, x: number, y: number, w?: number, h?: number, path?: string, summary: string, guideHref?: string }} ArchNode */
/** @typedef {{ id: string, from: string, to: string, kind?: string, timing?: string, label?: string, description?: string }} ArchEdge */
/** @typedef {{ id: string, label: string, x: number, y: number, w: number, h: number }} ArchGroup */

export const groups = /** @type {ArchGroup[]} */ ([
  { id: "g-client",   label: "Client",                x: 120, y: 40,   w: 720, h: 160 },
  { id: "g-memory",  label: "In-memory LSM state",   x: 40,  y: 260,  w: 880, h: 160 },
  { id: "g-workers", label: "Background workers",     x: 120, y: 480,  w: 720, h: 160 },
  { id: "g-packages",label: "Engine packages",        x: 20,  y: 700,  w: 920, h: 180 },
  { id: "g-disk",    label: "On disk",                x: 20,  y: 940,  w: 920, h: 200 },
]);

export const nodes = /** @type {ArchNode[]} */ ([
  // ── Client layer ────────────────────────────────────────────────────────────
  {
    id: "cli",
    label: "cmd/pebbledb",
    kind: "client",
    x: 200, y: 90, w: 200, h: 64,
    path: "cmd/pebbledb",
    summary: "CLI entrypoint. Parses commands and delegates to internal/db API.",
    guideHref: "/project-docs/guide/reference/cli",
  },
  {
    id: "api",
    label: "internal/db API",
    kind: "core",
    x: 520, y: 90, w: 220, h: 64,
    path: "internal/db",
    summary: "Public engine surface: Open, Close, Put, Get, Delete, Scan, Sync. Single writer (db.mu RWMutex); concurrent Get/Scan via atomic snapshot.",
    guideHref: "/project-docs/guide/architecture/system-overview",
  },

  // ── In-memory LSM state ──────────────────────────────────────────────────────
  {
    id: "active-mt",
    label: "active memtable",
    kind: "memory",
    x: 80, y: 320, w: 200, h: 64,
    path: "internal/memtable",
    summary: "Writable concurrent SkipList receiving applied WAL batch records.",
    guideHref: "/project-docs/guide/core-components/memtable",
  },
  {
    id: "pending-flush",
    label: "pendingFlush queue",
    kind: "memory",
    x: 360, y: 320, w: 220, h: 64,
    path: "internal/db",
    summary: "[]flushQueueEntry: immutable SkipLists plus their WAL cutoff offset, waiting to be drained by the flusher goroutine.",
    guideHref: "/project-docs/guide/implementation/flush-pipeline",
  },
  {
    id: "sst-list",
    label: "sstables[] + snapshot",
    kind: "memory",
    x: 660, y: 320, w: 220, h: 64,
    path: "internal/db",
    summary: "db.sstables protected by db.mu, plus db.sstablesSnap atomic.Pointer for lock-free concurrent reads.",
    guideHref: "/project-docs/guide/core-components/sstable",
  },

  // ── Background workers ───────────────────────────────────────────────────────
  {
    id: "batch-flusher",
    label: "batchFlusher",
    kind: "worker",
    x: 160, y: 540, w: 180, h: 64,
    path: "internal/db/batch.go",
    summary: "Single goroutine. Wakes on timer (1ms default), batch size ≥64 records, or syncWrites. Calls wal.AppendBatch + fsync, then applies records to active memtable.",
    guideHref: "/project-docs/guide/architecture/write-path",
  },
  {
    id: "flusher",
    label: "flusher",
    kind: "worker",
    x: 420, y: 540, w: 160, h: 64,
    path: "internal/db/flush.go",
    summary: "Single goroutine. Wakes on flushCh (buffered, capacity 8). Calls drainPendingFlush() — processes every queued memtable per wakeup.",
    guideHref: "/project-docs/guide/implementation/flush-pipeline",
  },
  {
    id: "compactor",
    label: "compactor",
    kind: "worker",
    x: 660, y: 540, w: 160, h: 64,
    path: "internal/db/compactor.go",
    summary: "Single goroutine. Wakes on compactCh. Locks compactMu. Picks oldest 2 SSTs (defaultCompactPickCount=2), merges via MergeReadersKeepTombstones, commits via AppendSetFileSet.",
    guideHref: "/project-docs/guide/implementation/compaction-pipeline",
  },

  // ── Engine packages ──────────────────────────────────────────────────────────
  {
    id: "wal",
    label: "internal/wal",
    kind: "package",
    x: 40, y: 770, w: 140, h: 56,
    path: "internal/wal",
    summary: "Append-only WAL: record format keyLen(4B)+key+valueLen(4B)+value+tombstone(1B)+crc32(4B). AppendBatch writes all records then fsyncs once. TruncateBefore uses copy-then-rename.",
    guideHref: "/project-docs/guide/core-components/wal",
  },
  {
    id: "memtable-pkg",
    label: "internal/memtable",
    kind: "package",
    x: 200, y: 770, w: 160, h: 56,
    path: "internal/memtable",
    summary: "Concurrent SkipList (sync.RWMutex, maxHeight=20, p=0.25). Stores tombstones in-place. Size() tracks approximate byte usage for flush threshold.",
    guideHref: "/project-docs/guide/core-components/skiplist",
  },
  {
    id: "sstable",
    label: "internal/sstable",
    kind: "package",
    x: 380, y: 770, w: 150, h: 56,
    path: "internal/sstable",
    summary: "Immutable sorted runs. Writer: blocks + index + bloom + footer. Reader: MayContain (bloom) → binary search index → block read → block cache.",
    guideHref: "/project-docs/guide/core-components/sstable",
  },
  {
    id: "manifest",
    label: "internal/manifest",
    kind: "package",
    x: 550, y: 770, w: 150, h: 56,
    path: "internal/manifest",
    summary: "Append-only live SST set log. AppendNewFile (flush commit) and AppendSetFileSet (compaction commit). MaybeCompact rotates to MANIFEST-NNNNNN when ≥64 records or ≥64 KiB.",
    guideHref: "/project-docs/guide/core-components/manifest",
  },
  {
    id: "iterator",
    label: "internal/iterator",
    kind: "package",
    x: 720, y: 770, w: 150, h: 56,
    path: "internal/iterator",
    summary: "MergeIterator merges sources by priority (newest wins). Tombstones are skipped for callers. Used by Scan; Get uses direct lookups instead.",
    guideHref: "/project-docs/guide/core-components/merge-iterator",
  },
  {
    id: "bloom",
    label: "internal/bloom",
    kind: "package",
    x: 400, y: 850, w: 140, h: 48,
    path: "internal/bloom",
    summary: "Bloom filter (FNV-64a, double-hash). Used by SSTable reader.MayContain() before index binary search. Encoded/decoded with bloom.Encode/Decode.",
    guideHref: "/project-docs/guide/core-components/bloom-filter",
  },

  // ── On-disk files ────────────────────────────────────────────────────────────
  {
    id: "lock",
    label: "LOCK",
    kind: "disk",
    x: 40, y: 1020, w: 100, h: 48,
    path: "data/LOCK",
    summary: "Exclusive directory lock (flock on Unix, LockFileEx on Windows). Enforces single-process database access. Acquired at Open(); released at Close().",
    guideHref: "/project-docs/guide/architecture/system-overview",
  },
  {
    id: "wal-log",
    label: "wal.log",
    kind: "disk",
    x: 160, y: 1020, w: 110, h: 48,
    path: "data/wal.log",
    summary: "Single append-only WAL file. Opened with O_APPEND. Replayed from wal.flush checkpoint offset (if present) on recovery.",
    guideHref: "/project-docs/guide/internals/wal-record-format",
  },
  {
    id: "wal-flush",
    label: "wal.flush",
    kind: "disk",
    x: 290, y: 1020, w: 120, h: 48,
    path: "data/wal.flush",
    summary: "Transient 16-byte crash-recovery checkpoint: FreezeOffset (int64) + SSTID (uint64). Written before WAL truncation; removed after truncation completes.",
    guideHref: "/project-docs/guide/implementation/wal-truncate",
  },
  {
    id: "current",
    label: "CURRENT",
    kind: "disk",
    x: 430, y: 1020, w: 110, h: 48,
    path: "data/CURRENT",
    summary: "Single-line text file pointing at the active MANIFEST-NNNNNN filename. Updated atomically via write-tmp + rename.",
    guideHref: "/project-docs/guide/internals/manifest-format",
  },
  {
    id: "manifest-file",
    label: "MANIFEST-*",
    kind: "disk",
    x: 560, y: 1020, w: 130, h: 48,
    path: "data/MANIFEST-*",
    summary: "Active manifest log (e.g. MANIFEST-000001). Each record: 4-byte length prefix + payload. Salvaged on open if truncated.",
    guideHref: "/project-docs/guide/internals/manifest-format",
  },
  {
    id: "sst-file",
    label: "sst_*.sst",
    kind: "disk",
    x: 710, y: 1020, w: 120, h: 48,
    path: "data/sst_*.sst",
    summary: "Immutable sorted runs on disk. Pattern: sst_%08d.sst. Contain data blocks, a block index, bloom filter, and footer.",
    guideHref: "/project-docs/guide/internals/sstable-layout",
  },
  {
    id: "quarantine",
    label: "quarantine/",
    kind: "disk",
    x: 400, y: 1090, w: 140, h: 48,
    path: "data/quarantine/",
    summary: "On-disk SST files not listed in the manifest are moved here (not deleted) during Open(), preserving them for inspection.",
    guideHref: "/project-docs/guide/architecture/crash-recovery",
  },
]);

/**
 * Edges with metadata derived directly from source inspection.
 *
 * kind:    data-flow | control-flow | persistence | recovery | metadata | dependency
 * timing:  sync | async | not-verified
 * label:   short human-readable description
 */
export const edges = /** @type {ArchEdge[]} */ ([
  // cli → api
  {
    id: "e1", from: "cli", to: "api",
    kind: "control-flow", timing: "sync",
    label: "CLI command dispatch",
    description: "cmd/pebbledb parses flags and calls db.Open / Put / Get / Delete / Scan on the internal/db API.",
  },
  // api → active-mt (Get reads directly from active memtable)
  {
    id: "e2", from: "api", to: "active-mt",
    kind: "data-flow", timing: "sync",
    label: "Get reads active memtable",
    description: "db.Get checks pendingBatch, then db.active (SkipList), then pendingFlush entries, then SSTs. No merge iterator used for Get.",
  },
  // api → wal (via batchFlusher, not direct — e3 is indirect)
  {
    id: "e3", from: "api", to: "wal",
    kind: "control-flow", timing: "async",
    label: "Schedules WAL batch flush",
    description: "writeRecord appends to pendingBatch and schedules the batchFlusher timer. WAL write happens asynchronously in the batchFlusher goroutine unless syncWrites=true or batch is full.",
  },
  // batch-flusher → wal
  {
    id: "e4", from: "batch-flusher", to: "wal",
    kind: "persistence", timing: "async",
    label: "AppendBatch + fsync",
    description: "batchFlusher calls wal.AppendBatch(batch) which writes all records then calls file.Sync(). One fsync per batch.",
  },
  // batch-flusher → active-mt
  {
    id: "e5", from: "batch-flusher", to: "active-mt",
    kind: "data-flow", timing: "async",
    label: "Apply batch to memtable",
    description: "After WAL fsync succeeds, batchFlusher calls applyRecordToMemtable for each record. WAL must succeed before memtable is written.",
  },
  // flusher → pending-flush
  {
    id: "e6", from: "flusher", to: "pending-flush",
    kind: "data-flow", timing: "async",
    label: "Drains pendingFlush queue",
    description: "drainPendingFlush pops entries from db.pendingFlush[0] one by one. After successful SST write + manifest commit, entry is removed.",
  },
  // flusher → sstable
  {
    id: "e7", from: "flusher", to: "sstable",
    kind: "persistence", timing: "async",
    label: "Writes SST file",
    description: "flushImmutable calls sstable.NewWriter, iterates the frozen SkipList, appends entries, then closes the writer to flush blocks+index+bloom+footer.",
  },
  // flusher → manifest
  {
    id: "e8", from: "flusher", to: "manifest",
    kind: "metadata", timing: "async",
    label: "AppendNewFile (durability boundary)",
    description: "manifest.AppendNewFile(id) is the durability boundary. After this call the SST must remain visible even if WAL cleanup fails.",
  },
  // flusher → wal (WAL truncation after flush)
  {
    id: "e9", from: "flusher", to: "wal",
    kind: "control-flow", timing: "async",
    label: "TruncateBefore (WAL cleanup)",
    description: "completeWalAfterFlush writes wal.flush checkpoint, calls wal.TruncateBefore(walCutoff) to remove records now durably captured in SST.",
  },
  // compactor → sstable
  {
    id: "e10", from: "compactor", to: "sstable",
    kind: "data-flow", timing: "async",
    label: "Merges SSTs",
    description: "mergeSSTables uses sstable.MergeReadersKeepTombstones to merge picked readers into a new SST. Old readers are Discard()ed after manifest commit.",
  },
  // compactor → manifest
  {
    id: "e11", from: "compactor", to: "manifest",
    kind: "metadata", timing: "async",
    label: "AppendSetFileSet (atomic replacement)",
    description: "manifest.AppendSetFileSet(newListIDs) atomically replaces the live SST set. On failure before publishSSTables, old manifest IDs are restored.",
  },
  // wal → wal-log
  {
    id: "e12", from: "wal", to: "wal-log",
    kind: "persistence", timing: "sync",
    label: "Appends to wal.log",
    description: "wal.AppendBatch writes encoded records to wal.log (O_APPEND) and fsyncs. TruncateBefore creates wal.log.truncate.tmp then renames.",
  },
  // wal → wal-flush
  {
    id: "e13", from: "wal", to: "wal-flush",
    kind: "recovery", timing: "sync",
    label: "Writes wal.flush checkpoint",
    description: "completeWalAfterFlush writes FreezeOffset+SSTID to wal.flush (16 bytes). Present only between manifest commit and WAL truncation completion.",
  },
  // manifest → manifest-file
  {
    id: "e14", from: "manifest", to: "manifest-file",
    kind: "persistence", timing: "sync",
    label: "Appends records to MANIFEST-*",
    description: "manifest.append writes length-prefixed record, fsyncs, then applies to in-memory liveSet. MaybeCompact rotates to a new MANIFEST file.",
  },
  // manifest → current
  {
    id: "e15", from: "manifest", to: "current",
    kind: "metadata", timing: "sync",
    label: "Updates CURRENT on rotation",
    description: "writeCurrent writes new manifest name to CURRENT.tmp, fsyncs, then renames to CURRENT. Used during manifest rotation (MaybeCompact).",
  },
  // sstable → sst-file
  {
    id: "e16", from: "sstable", to: "sst-file",
    kind: "persistence", timing: "sync",
    label: "Reads/writes sst_*.sst files",
    description: "SSTable writer creates sst_NNNNNNNN.sst with blocks, index, bloom, footer. Reader opens existing files for Get and Scan operations.",
  },
  // sstable → bloom
  {
    id: "e17", from: "sstable", to: "bloom",
    kind: "dependency", timing: "sync",
    label: "Uses bloom filter for MayContain",
    description: "sstable.Reader.MayContain calls bloom.Filter.MayContain before binary-search index lookup. Eliminates irrelevant SST block reads on misses.",
  },
  // api → iterator
  {
    id: "e18", from: "api", to: "iterator",
    kind: "data-flow", timing: "sync",
    label: "Scan builds MergeIterator",
    description: "db.Scan constructs a MergeIterator over pendingBatch snapshot, active SkipList snapshot, pendingFlush snapshots (newest-first), and SST readers.",
  },
  // api → lock
  {
    id: "e19", from: "api", to: "lock",
    kind: "control-flow", timing: "sync",
    label: "Acquires LOCK on Open",
    description: "acquireDirLock creates LOCK file and applies exclusive lock. Prevents two processes from opening the same directory. Released on Close.",
  },
  // api → quarantine
  {
    id: "e20", from: "api", to: "quarantine",
    kind: "recovery", timing: "sync",
    label: "Moves orphan SSTs on Open",
    description: "removeOrphanSSTFiles called during Open. SST files on disk but absent from manifest are renamed into quarantine/ rather than deleted.",
  },
  // api → sst-list
  {
    id: "e21", from: "api", to: "sst-list",
    kind: "data-flow", timing: "sync",
    label: "Publishes atomic SST snapshot",
    description: "publishSSTables stores a copy of db.sstables into db.sstablesSnap (atomic.Pointer). Readers call snapshotSSTables() lock-free.",
  },
  // memtable-pkg → active-mt
  {
    id: "e22", from: "memtable-pkg", to: "active-mt",
    kind: "dependency", timing: "sync",
    label: "SkipList implements active memtable",
    description: "active memtable IS a *memtable.SkipList. The package provides Put, Get, Delete, Size, Len, Iterator, Snapshot methods used directly by internal/db.",
  },
]);

export function getNodeMap() {
  return Object.fromEntries(nodes.map((n) => [n.id, n]));
}

export function getGraphBounds(padding = 120) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
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

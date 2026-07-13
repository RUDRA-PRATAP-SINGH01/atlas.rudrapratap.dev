/**
 * Architecture decision records for PebbleDB's flush/compaction workers,
 * SSTable package, Manifest package, and Bloom filter.
 *
 * Evidence sources (SOURCE VERIFIED):
 *   internal/db/flush.go — flusher, drainPendingFlush, flushImmutable,
 *     completeWalAfterFlush, maybeFlushLocked, flushRetryDelay (100ms),
 *     flushRetryDelayMax (2s)
 *   internal/db/compactor.go — compactor, doCompaction, compactRetryDelay (100ms)
 *   internal/db/compaction.go — maybeTriggerCompaction, pickSSTablesForCompactionLocked,
 *     mergeSSTables, defaultCompactThreshold=4, defaultCompactPickCount=2
 *   internal/sstable/writer.go — NewWriter
 *   internal/sstable/reader.go — OpenReader, MayContain, Get, Ref, Unref, Discard
 *   internal/sstable/block.go, footer.go, index.go, cache.go
 *   internal/manifest/manifest.go — Log, Open, AppendNewFile, AppendSetFileSet,
 *     MaybeCompact, compactRecordThreshold=64, compactSizeThreshold=64KiB
 *   internal/bloom/bloom.go — New, Add, MayContain, Encode, Decode
 *   internal/db/sst_cleanup.go — removeOrphanSSTFiles, quarantineDir
 */

/** @type {import('../schema').ArchitectureDecision} */
export const flusherDecision = {
  id: "decision-flusher",
  nodeId: "flusher",
  title: "Flusher Goroutine",
  category: "Background Worker",
  sourcePath: "internal/db/flush.go",
  summary: "A dedicated background goroutine that drains the pendingFlush queue by writing each frozen memtable to a new SST file and committing the SST to the manifest. It is the bridge between volatile in-memory state and durable on-disk storage.",

  responsibility: {
    owns: [
      "Draining db.pendingFlush queue (oldest-first)",
      "Writing frozen SkipList contents to sst_NNNNNNNN.sst via sstable.NewWriter",
      "Committing new SST to manifest via manifest.AppendNewFile (durability boundary)",
      "Publishing updated SST list via publishSSTables",
      "Truncating the WAL after SST is committed via completeWalAfterFlush",
      "Triggering compaction check after each flush via maybeTriggerCompaction",
      "Retrying flush on transient errors with exponential backoff",
    ],
    doesNotOwn: [
      "Deciding when to freeze the active memtable — internal/db.maybeFlushLocked",
      "WAL encoding — internal/wal",
      "SST file format — internal/sstable.NewWriter / sstable.Writer",
      "Manifest record encoding — internal/manifest",
    ],
    details: "The flusher is the serialization point between volatile and durable state. It runs as a single goroutine — only one flush is in-flight at a time.",
  },

  whyItExists: {
    problem: "Memtable contents are volatile. They must be persisted to immutable SST files on disk for durability and to reclaim memtable memory.",
    constraint: "SST writes are I/O-heavy. Doing them on the write path would stall Put/Delete operations. Flush must be asynchronous.",
    decision: "Dedicate a background goroutine to draining the pendingFlush queue. The goroutine wakes on a buffered channel signal (flushCh, capacity 8) and processes all queued entries per wakeup.",
    result: "Write path is not blocked by SST I/O. Flush happens asynchronously without interrupting ongoing writes.",
  },

  classification: {
    level: "HLD + LLD",
    explanation: "HLD: the flusher is the mechanism that moves the LSM-tree's volatile state to durable storage. LLD: the drainPendingFlush loop, flushImmutable sequence, retry logic, and WAL truncation are concrete implementation decisions.",
  },

  hld: {
    architecturalRole: "Bridge between in-memory LSM state and on-disk SST files.",
    upstream: ["pending-flush"],
    downstream: ["sstable", "manifest", "wal"],
    concurrencyResponsibility: "Single goroutine — no concurrent flush. compactMu not held during flush. db.mu held briefly at start (pop entry) and end (append to db.sstables).",
    failureBoundary: "Flush errors are retried. After blockWritesOnFlushError kicks in, new writes are blocked. The frozen memtable is never discarded on error — it remains in pendingFlush for retry.",
    lifecycle: "Started as go db.flusher() in Open. Stopped by closing flushCh in Close.",
  },

  lld: {
    implementation: [
      "flusher() (flush.go:31-36): loops over flushCh; calls drainPendingFlush() on each signal.",
      "drainPendingFlush() (flush.go:40-72): loops until pendingFlush is empty. Locks db.mu briefly to peek at [0], unlocks before I/O. Retries on error with flushRetrySleep.",
      "flushImmutable(imm, walCutoff) (flush.go:98-168): ①atomic ID increment, ②sstable.NewWriter, ③iterate SkipList, ④w.Close(), ⑤sstable.OpenReader, ⑥manifest.AppendNewFile (DURABILITY BOUNDARY), ⑦db.sstables append + publishSSTables, ⑧manifest.MaybeCompact, ⑨completeWalAfterFlush, ⑩maybeTriggerCompaction.",
      "completeWalAfterFlush(walCutoff, sstID) (flush.go:170-182): writeWalFlushState, wal.TruncateBefore(walCutoff), removeWalFlushState.",
      "flushRetryDelay = 100ms initial, flushRetryDelayMax = 2s max (exponential scaling).",
    ],
    errorHandling: [
      "On flushImmutable error: setBackgroundErr('flush', err), increment retries, flushRetrySleep, retry.",
      "On manifest commit failure: SST file is removed. No partial state committed.",
      "On WAL truncation failure: setBackgroundErr('wal_cleanup', err) — logged but not fatal. Data is durable (SST committed). Next open will recover correctly via wal.flush checkpoint.",
    ],
    sourceReferences: [
      {
        label: "flusher — goroutine loop",
        path: "internal/db/flush.go",
        symbol: "flusher",
        lineStart: 31,
        lineEnd: 36,
        evidenceStatus: "source-verified",
      },
      {
        label: "flushImmutable — full flush sequence",
        path: "internal/db/flush.go",
        symbol: "flushImmutable",
        lineStart: 98,
        lineEnd: 168,
        evidenceStatus: "source-verified",
      },
      {
        label: "completeWalAfterFlush — WAL truncation",
        path: "internal/db/flush.go",
        symbol: "completeWalAfterFlush",
        lineStart: 170,
        lineEnd: 182,
        evidenceStatus: "source-verified",
      },
    ],
  },

  rationale: {
    evidenceStatus: "source-verified",
    selectedApproach: "Single goroutine, drains full pendingFlush queue per wakeup, coalesced wakeup channel.",
    whyItFits: [
      "Single goroutine: no concurrent flush race conditions. SST files have monotonically increasing IDs (atomic counter).",
      "Drain all queued entries per wakeup: prevents starvation if flush signals are dropped from the bounded channel (capacity 8).",
      "Coalesced channel: multiple maybeFlushLocked calls produce at most one pending signal in flushCh — avoids redundant wakeups.",
    ],
    acceptedTradeoffs: [
      "Single goroutine: flush throughput is limited to one SST write at a time. Under sustained write pressure, pendingFlush can grow.",
      "No explicit backpressure on pendingFlush depth — relies on blockWritesOnFlushError to eventually halt writes.",
    ],
  },

  metrics: [
    {
      name: "Flush retry initial delay",
      value: 100,
      unit: "ms",
      evidenceType: "configured",
      source: { label: "internal/db/flush.go — flushRetryDelay", path: "internal/db/flush.go", symbol: "flushRetryDelay", lineStart: 15, lineEnd: 15, evidenceStatus: "source-verified" },
    },
    {
      name: "Flush retry max delay",
      value: 2000,
      unit: "ms",
      evidenceType: "configured",
      source: { label: "internal/db/flush.go — flushRetryDelayMax", path: "internal/db/flush.go", symbol: "flushRetryDelayMax", lineStart: 16, lineEnd: 16, evidenceStatus: "source-verified" },
    },
    { name: "Flush throughput (bytes/s)", evidenceType: "not-measured" },
    { name: "Time to flush 4 MiB memtable", evidenceType: "not-measured" },
  ],

  failureWithoutComponent: [
    "Without the flusher, pendingFlush would grow unbounded, consuming all available memory.",
    "WAL would grow without truncation, consuming all available disk space.",
    "Compaction would never trigger (maybeTriggerCompaction is called after each flush).",
    "All data would remain in RAM and WAL — no durable SST files would be created.",
  ],

  relatedNodes: ["pending-flush", "sstable", "manifest", "wal", "sst-list", "compactor"],
  sources: [
    { label: "internal/db/flush.go", path: "internal/db/flush.go", evidenceStatus: "source-verified" },
    { label: "internal/db/compaction.go — maybeTriggerCompaction", path: "internal/db/compaction.go", symbol: "maybeTriggerCompaction", evidenceStatus: "source-verified" },
  ],
  evidenceStatus: "source-verified",
};

/** @type {import('../schema').ArchitectureDecision} */
export const compactorDecision = {
  id: "decision-compactor",
  nodeId: "compactor",
  title: "Compactor Goroutine",
  category: "Background Worker",
  sourcePath: "internal/db/compactor.go",
  summary: "A dedicated background goroutine that merges the oldest SSTables when their count reaches the compaction threshold. Compaction reclaims space occupied by superseded values and tombstones, and bounds read amplification.",

  responsibility: {
    owns: [
      "Waiting for compaction signals on compactCh",
      "Serializing compaction runs via db.compactMu",
      "Selecting oldest N SSTs for merge (pickSSTablesForCompactionLocked)",
      "Merging selected SSTs via sstable.MergeReadersKeepTombstones into a new SST",
      "Atomically replacing the live SST set via manifest.AppendSetFileSet",
      "Publishing the updated SST list via publishSSTables",
      "Discarding compacted SST readers (Discard — deferred deletion)",
      "Retry on transient errors (compactRetryDelay = 100ms)",
    ],
    doesNotOwn: [
      "Deciding when compaction is needed — maybeTriggerCompaction (called after each flush)",
      "SST file format — internal/sstable",
      "Manifest record encoding — internal/manifest",
    ],
    details: "The compactor is triggered by SST count, not by time. It always picks the oldest N SSTs (N=2 by default). Tombstones are preserved during compaction to avoid resurrecting deleted values from older SSTs.",
  },

  whyItExists: {
    problem: "Each flush creates a new SST file. Without compaction, the number of SSTs grows unboundedly. Reading requires checking all SSTs — read amplification grows linearly with SST count.",
    constraint: "LSM-tree correctness requires that newer values shadow older ones. Merging SSTs must preserve this invariant while eliminating duplicate and deleted keys.",
    decision: "Background compaction merges oldest SSTs when count ≥ threshold (default 4). Uses a merge iterator that keeps tombstones during merge to preserve delete correctness. Atomic manifest replacement prevents partial state.",
    result: "SST count stays bounded near the threshold. Read amplification is bounded by the compaction threshold. Tombstones are eventually consolidated.",
  },

  classification: {
    level: "HLD + LLD",
    explanation: "HLD: compaction is the space reclamation and read amplification control mechanism — a core LSM-tree property. LLD: the threshold=4, pick count=2, MergeReadersKeepTombstones strategy, and the two-phase manifest commit are concrete implementation choices.",
  },

  lld: {
    implementation: [
      "compactor() (compactor.go:13-35): for range compactCh, locks compactMu, calls doCompaction in a loop while count ≥ threshold.",
      "doCompaction() (compactor.go:37-129): ①lock db.mu + pickSSTablesForCompactionLocked, ②capture oldLiveIDs for rollback, ③unlock + mergeSSTables, ④re-lock + check readersStillPresent (concurrent compaction guard), ⑤build newList, ⑥unlock + manifest.AppendSetFileSet, ⑦re-lock + check again + db.sstables = newList + publishSSTables, ⑧Discard compacted readers.",
      "Rollback: if AppendSetFileSet succeeds but re-lock check fails, manifest.AppendSetFileSet(oldLiveIDs) is called to restore the old file set.",
      "Discard() (sstable.Reader): marks reader for deletion. Actual file removal deferred until all Ref holders call Unref.",
    ],
    concurrency: [
      "compactMu: serializes compaction runs (channel capacity 8 means signals coalesce, but doCompaction runs once per wakeup)",
      "db.mu: held briefly to pick SSTs and to update db.sstables. Released during mergeSSTables I/O.",
      "readersStillPresent: guards against TOCTTOU — picked SSTs could be replaced by another compaction between pick and merge.",
    ],
    errorHandling: [
      "mergeSSTables error: new SST removed, original SSTs untouched. compactRetryDelay sleep, then retry.",
      "manifest.AppendSetFileSet error: new SST removed. Original state unchanged (manifest not modified).",
      "Rollback (manifest.AppendSetFileSet(oldLiveIDs)) on concurrent modification: if rollback fails, logs warning — potential manifest inconsistency.",
    ],
    sourceReferences: [
      {
        label: "compactor — goroutine loop",
        path: "internal/db/compactor.go",
        symbol: "compactor",
        lineStart: 13,
        lineEnd: 35,
        evidenceStatus: "source-verified",
      },
      {
        label: "doCompaction — full compaction sequence",
        path: "internal/db/compactor.go",
        symbol: "doCompaction",
        lineStart: 37,
        lineEnd: 129,
        evidenceStatus: "source-verified",
      },
      {
        label: "pickSSTablesForCompactionLocked",
        path: "internal/db/compaction.go",
        symbol: "pickSSTablesForCompactionLocked",
        lineStart: 36,
        lineEnd: 50,
        evidenceStatus: "source-verified",
      },
      {
        label: "mergeSSTables — merge with MergeReadersKeepTombstones",
        path: "internal/db/compaction.go",
        symbol: "mergeSSTables",
        lineStart: 68,
        lineEnd: 109,
        evidenceStatus: "source-verified",
      },
    ],
  },

  rationale: {
    evidenceStatus: "source-verified",
    selectedApproach: "Threshold-triggered background goroutine. Always picks oldest 2 SSTs. Preserves tombstones during merge.",
    whyItFits: [
      "Picking the oldest SSTs first converges toward a smaller, more consolidated SST set over time.",
      "MergeReadersKeepTombstones preserves tombstones so that deleted keys are not resurrected from older SSTs that have not yet been compacted.",
      "Atomic manifest replacement (AppendSetFileSet) ensures either the old or new file set is live — never a partial merge state.",
    ],
    acceptedTradeoffs: [
      "Tombstones are preserved across compaction rounds. They are only removed when all SSTs containing the same key have been merged — potentially many rounds for old tombstones.",
      "Pick count=2 (defaultCompactPickCount): pairs of SSTs are merged one at a time. This is simple but may not be optimal for reducing read amplification efficiently.",
      "No level-based compaction — all SSTs are in a single flat level. Read amplification in the worst case is proportional to total SST count.",
    ],
  },

  qualityImpacts: [
    {
      quality: "Read amplification",
      direction: "moderate-positive",
      explanation: "Compaction reduces SST count toward the threshold (4 by default), bounding the number of SSTs that Get must check. Without compaction, every Get would scan all accumulated SSTs.",
      evidenceStatus: "source-verified",
    },
    {
      quality: "Write amplification",
      direction: "moderate-negative",
      explanation: "Each compaction rewrites the content of N SSTs into 1. Data is written multiple times across its lifetime. Write amplification factor is NOT YET MEASURED.",
      evidenceStatus: "theoretical",
    },
    {
      quality: "Space amplification",
      direction: "moderate-positive",
      explanation: "Compaction reclaims space from superseded values and eventually allows tombstones to be resolved. Between compaction rounds, space amplification exists. NOT YET MEASURED.",
      evidenceStatus: "theoretical",
    },
  ],

  metrics: [
    {
      name: "Default compaction threshold (SST count)",
      value: 4,
      unit: "SST files",
      evidenceType: "configured",
      source: { label: "internal/db/compaction.go — defaultCompactThreshold", path: "internal/db/compaction.go", symbol: "defaultCompactThreshold", lineStart: 14, lineEnd: 14, evidenceStatus: "source-verified" },
    },
    {
      name: "Default compaction pick count",
      value: 2,
      unit: "SST files",
      evidenceType: "configured",
      source: { label: "internal/db/compaction.go — defaultCompactPickCount", path: "internal/db/compaction.go", symbol: "defaultCompactPickCount", lineStart: 15, lineEnd: 15, evidenceStatus: "source-verified" },
    },
    {
      name: "Compaction retry delay",
      value: 100,
      unit: "ms",
      evidenceType: "configured",
      source: { label: "internal/db/compactor.go — compactRetryDelay", path: "internal/db/compactor.go", symbol: "compactRetryDelay", lineStart: 11, lineEnd: 11, evidenceStatus: "source-verified" },
    },
    { name: "Compaction write amplification factor", evidenceType: "not-measured" },
    { name: "Space reclaimed per compaction", evidenceType: "not-measured" },
  ],

  failureWithoutComponent: [
    "SST files accumulate indefinitely — read amplification grows linearly with write volume.",
    "Disk space is never reclaimed from deleted or overwritten keys.",
    "Get latency degrades as more SSTs must be checked per lookup.",
    "Tombstones are never resolved, occupying space in all SSTables that contain them.",
  ],

  relatedNodes: ["sst-list", "sstable", "manifest", "sst-file"],
  sources: [
    { label: "internal/db/compactor.go", path: "internal/db/compactor.go", evidenceStatus: "source-verified" },
    { label: "internal/db/compaction.go", path: "internal/db/compaction.go", evidenceStatus: "source-verified" },
  ],
  evidenceStatus: "source-verified",
};

/** @type {import('../schema').ArchitectureDecision} */
export const sstableDecision = {
  id: "decision-sstable",
  nodeId: "sstable",
  title: "SSTable Package (internal/sstable)",
  category: "Engine Package",
  sourcePath: "internal/sstable",
  summary: "Provides immutable sorted file writer and reader. The writer serializes sorted key-value entries into data blocks, a block index, a bloom filter, and a fixed footer. The reader uses the bloom filter and binary-searched block index to efficiently locate keys.",

  responsibility: {
    owns: [
      "Writer: encoding entries into data blocks (defaultBlockSize = 4096 bytes), building block index, building bloom filter, writing footer",
      "Reader: loading footer + index + bloom at open time; MayContain (bloom check) + binary-search index + block read + block cache",
      "Block cache: LRU block cache keyed by (fileID, blockOffset)",
      "Ref/Unref reference counting for safe concurrent access and deferred deletion",
      "Discard: marks reader for deletion when all Ref holders have released",
      "MergeReadersKeepTombstones: merge iterator across multiple readers (used by compaction)",
    ],
    doesNotOwn: [
      "Bloom filter algorithm — internal/bloom",
      "Deciding when to create an SST — internal/db.flushImmutable",
      "Manifest commitment — internal/db.flushImmutable calls manifest.AppendNewFile",
    ],
    details: "internal/sstable is a pure file format and I/O library. It has no knowledge of the engine state.",
  },

  whyItExists: {
    problem: "Memtable contents must be persisted in a format that supports efficient point lookups and range scans without loading the entire file into memory.",
    constraint: "The file must be immutable (written once, read many times). It must support bloom filter pre-check to avoid reading blocks for absent keys.",
    decision: "Implement an SSTable with a block-based layout: sorted data blocks for cache-friendly sequential reads, a block index for binary search, an embedded bloom filter for membership test, and a fixed-size footer for locating the index and filter.",
    result: "Get: bloom check → binary search index → single block read. Scan: sequential block reads from seek position. Block cache reduces repeated disk reads.",
  },

  classification: {
    level: "HLD + LLD",
    explanation: "HLD: the SSTable is the immutable on-disk representation of LSM-tree data. LLD: block size (4096), index format, bloom filter encoding, block cache, and Ref/Unref lifecycle are concrete implementation choices.",
  },

  lld: {
    implementation: [
      "Reader struct (reader.go): {file *os.File, path, footer Footer, index []IndexEntry, bloom *bloom.Filter, fileID uint64, blockCache *BlockCache, refs atomic.Int32, closePending/discardPending/fileClosed atomic.Bool, closeMu sync.RWMutex}",
      "OpenReader: reads footer (fixed size at file end), validates index/bloom bounds, loads full index into memory, loads full bloom into memory. O(index_size) at open.",
      "MayContain(key): bloom.Filter.MayContain if present, else true. Called before index binary search.",
      "Get(key): MayContain check → sort.Search on index (binary search by LastKey) → readBlock(offset, length) → NewBlockIterator → linear scan within block.",
      "readBlock: consults blockCache first (keyed by fileID+offset). On miss, pfile.ReadAt, insert into cache.",
      "Ref()/Unref(): atomic counter. On Unref to 0 with closePending, closeFile() is called.",
      "Discard(): sets discardPending=true + closePending=true. closeFile removes the backing file after the last Unref.",
    ],
    persistence: [
      "SST file format: [data blocks] [block index] [bloom filter] [footer(fixed)]",
      "Footer contains: IndexOffset, IndexLength, BloomOffset, BloomLength",
      "Block index entry: keyLen(4B) + lastKey(keyLen B) + offset(8B) + length(8B)",
      "Block cache: LRU implementation keyed by (fileID uint64, blockOffset uint64)",
    ],
    sourceReferences: [
      {
        label: "Reader struct",
        path: "internal/sstable/reader.go",
        symbol: "Reader",
        lineStart: 16,
        lineEnd: 29,
        evidenceStatus: "source-verified",
      },
      {
        label: "OpenReader — load index + bloom",
        path: "internal/sstable/reader.go",
        symbol: "OpenReader",
        lineStart: 32,
        lineEnd: 102,
        evidenceStatus: "source-verified",
      },
      {
        label: "Get — bloom + index + block",
        path: "internal/sstable/reader.go",
        symbol: "Get",
        lineStart: 168,
        lineEnd: 194,
        evidenceStatus: "source-verified",
      },
      {
        label: "Discard — deferred deletion",
        path: "internal/sstable/reader.go",
        symbol: "Discard",
        lineStart: 220,
        lineEnd: 227,
        evidenceStatus: "source-verified",
      },
    ],
  },

  rationale: {
    evidenceStatus: "source-verified",
    selectedApproach: "Block-based immutable file with in-memory index and bloom filter loaded at open time.",
    whyItFits: [
      "Loading the full index at open time eliminates random I/O during Get — only one block read needed after the binary search.",
      "Bloom filter pre-check eliminates block reads for keys absent from the file — important when many SSTs must be checked.",
      "Block cache (LRU) reduces repeated disk reads for hot keys.",
      "Ref/Unref allows safe concurrent readers while Discard defers file deletion until no goroutine is reading.",
    ],
    acceptedTradeoffs: [
      "Full index in memory: for very large SSTs, this could consume significant RAM. Acceptable for an embedded engine with bounded SST sizes.",
      "Full bloom filter in memory at open time: same tradeoff.",
      "Linear scan within a block: blocks are small (4096 bytes); linear scan is fast in practice.",
    ],
  },

  metrics: [
    {
      name: "Default block size",
      value: 4096,
      unit: "bytes",
      evidenceType: "configured",
      source: { label: "internal/db/db.go — defaultBlockSize", path: "internal/db/db.go", symbol: "defaultBlockSize", lineStart: 24, lineEnd: 24, evidenceStatus: "source-verified" },
    },
    {
      name: "Default block cache size",
      value: 32,
      unit: "MiB",
      evidenceType: "documented",
      source: { label: "internal/db/db.go — Options.BlockCacheSize comment", path: "internal/db/db.go", symbol: "Options.BlockCacheSize", lineStart: 86, lineEnd: 87, evidenceStatus: "documented" },
    },
    { name: "SST read throughput", evidenceType: "not-measured" },
    { name: "Block cache hit rate", evidenceType: "not-measured" },
  ],

  failureWithoutComponent: [
    "Without SST files, all data lives only in RAM and WAL. A database restart with no recovery mechanism would start empty.",
    "Without immutable sorted files, compaction has nothing to merge — the data model cannot converge.",
    "Without bloom filters, every Get would perform a binary search and block read on every SST — read amplification unbounded.",
  ],

  relatedNodes: ["flusher", "compactor", "bloom", "sst-file", "sst-list"],
  sources: [
    { label: "internal/sstable/reader.go", path: "internal/sstable/reader.go", evidenceStatus: "source-verified" },
    { label: "internal/sstable/writer.go", path: "internal/sstable/writer.go", evidenceStatus: "source-verified" },
    { label: "internal/sstable/cache.go", path: "internal/sstable/cache.go", evidenceStatus: "source-verified" },
    { label: "internal/db/flush.go — flushImmutable", path: "internal/db/flush.go", symbol: "flushImmutable", evidenceStatus: "source-verified" },
  ],
  evidenceStatus: "source-verified",
};

/** @type {import('../schema').ArchitectureDecision} */
export const manifestDecision = {
  id: "decision-manifest",
  nodeId: "manifest",
  title: "Manifest (internal/manifest)",
  category: "Engine Package",
  sourcePath: "internal/manifest",
  summary: "An append-only log that tracks which SST files are live. It is the durability boundary for compaction and the recovery mechanism for the live SST set after a crash. CURRENT points to the active manifest file.",

  responsibility: {
    owns: [
      "Tracking the live SST ID set in an in-memory liveSet map",
      "AppendNewFile(id): records a new SST (after flush) — the flush durability boundary",
      "AppendSetFileSet(ids): atomically replaces the live set (after compaction)",
      "MaybeCompact: rotates to a new MANIFEST-NNNNNN file when ≥64 records or ≥64 KiB",
      "Replay: rebuilds liveSet from the manifest on Open",
      "Salvage: truncates trailing partial manifest records on open (same recovery approach as WAL)",
      "LiveIDs(): sorted list of live SST IDs",
    ],
    doesNotOwn: [
      "SST file content — internal/sstable",
      "Deciding when to flush or compact — internal/db",
      "CURRENT file update on non-rotation appends — CURRENT is only updated on rotation",
    ],
    details: "The manifest guarantees that the live SST set is recoverable. Without it, after a crash, there is no authoritative list of which SST files are valid.",
  },

  whyItExists: {
    problem: "After a crash, the database directory may contain SST files from incomplete operations. Without an authoritative list of live SSTs, recovery cannot distinguish valid files from orphaned ones.",
    constraint: "The live SST set must be durable and consistent. Any change to the set (flush or compaction) must be atomically committed to stable storage before the change is made visible.",
    decision: "Maintain an append-only manifest log that records SST set changes. Each record is fsynced before the change is applied in memory. On recovery, replay the manifest to rebuild the live set.",
    result: "After any crash, replaying the manifest produces the exact live SST set at the time of the last committed change. Orphaned SSTs are moved to quarantine/.",
  },

  classification: {
    level: "HLD + LLD",
    explanation: "HLD: the manifest is the recovery-critical metadata store for the SST set — analogous to a transaction log for file set changes. LLD: the length-prefix record format, CURRENT indirection, rotation threshold (64 records / 64 KiB), and liveSet map are concrete implementation choices.",
  },

  lld: {
    implementation: [
      "Log struct (manifest.go): {dir, path, file *os.File, mu sync.Mutex, liveSet map[uint64]struct{}, recordCount int}",
      "Record format: 4-byte BigEndian length prefix + payload. Payload encodes add or set-file-set operations.",
      "append(record, apply): acquires l.mu, writes record, fsyncs, calls apply() to update liveSet.",
      "AppendNewFile: encodes NewFile operation, calls append.",
      "AppendSetFileSet: sorts IDs, encodes SetFileSet operation, calls append.",
      "MaybeCompact: if recordCount >= 64 OR file size >= 64 KiB, calls rotateSnapshotLocked.",
      "rotateSnapshotLocked: writes new MANIFEST-NNNNNN with current SetFileSet snapshot, fsyncs, writes CURRENT (write-tmp + rename), opens new file, removes old file.",
      "Replay: reads length-prefixed records, applies each to liveSet, tracks validEnd. Truncates trailing partial record.",
    ],
    persistence: [
      "MANIFEST-NNNNNN: append-only, length-prefixed records, fsynced per append",
      "CURRENT: single-line text file updated atomically via write-tmp + rename",
      "Rotation threshold: 64 records or 64 KiB — whichever comes first",
    ],
    sourceReferences: [
      {
        label: "Log struct",
        path: "internal/manifest/manifest.go",
        symbol: "Log",
        lineStart: 26,
        lineEnd: 33,
        evidenceStatus: "source-verified",
      },
      {
        label: "append — write + fsync + apply",
        path: "internal/manifest/manifest.go",
        symbol: "append",
        lineStart: 242,
        lineEnd: 255,
        evidenceStatus: "source-verified",
      },
      {
        label: "rotateSnapshotLocked — CURRENT update",
        path: "internal/manifest/manifest.go",
        symbol: "rotateSnapshotLocked",
        lineStart: 296,
        lineEnd: 346,
        evidenceStatus: "source-verified",
      },
      {
        label: "MaybeCompact thresholds",
        path: "internal/manifest/manifest.go",
        symbol: "compactRecordThreshold, compactSizeThreshold",
        lineStart: 21,
        lineEnd: 22,
        evidenceStatus: "source-verified",
      },
    ],
  },

  rationale: {
    evidenceStatus: "source-verified",
    selectedApproach: "Append-only log with per-record fsync. Separate CURRENT file for manifest location. Rotation via snapshot + CURRENT update.",
    whyItFits: [
      "Append-only + fsync-per-record: every committed SST set change is immediately durable.",
      "CURRENT indirection: allows atomic rotation — new MANIFEST is fully written and CURRENT is updated atomically (write-tmp + rename) before the old one is removed.",
      "Rotation on size/record count: bounds replay time and prevents indefinite manifest growth.",
    ],
    acceptedTradeoffs: [
      "One fsync per manifest append (AppendNewFile, AppendSetFileSet) — adds latency to each flush/compaction commit.",
      "Full liveSet in memory: for very large SST counts, this could be significant. Acceptable for an embedded engine.",
    ],
  },

  metrics: [
    {
      name: "Manifest rotation record threshold",
      value: 64,
      unit: "records",
      evidenceType: "configured",
      source: { label: "internal/manifest/manifest.go — compactRecordThreshold", path: "internal/manifest/manifest.go", symbol: "compactRecordThreshold", lineStart: 21, lineEnd: 21, evidenceStatus: "source-verified" },
    },
    {
      name: "Manifest rotation size threshold",
      value: 64,
      unit: "KiB",
      evidenceType: "configured",
      source: { label: "internal/manifest/manifest.go — compactSizeThreshold", path: "internal/manifest/manifest.go", symbol: "compactSizeThreshold", lineStart: 22, lineEnd: 22, evidenceStatus: "source-verified" },
    },
  ],

  failureWithoutComponent: [
    "After a crash, no authoritative list of live SSTs exists — all SST files are equally suspect.",
    "Recovery cannot distinguish valid SSTs from orphaned ones — database cannot be safely reopened.",
    "Compaction cannot atomically replace the SST set — partial compaction would corrupt the visible data set.",
  ],

  relatedNodes: ["flusher", "compactor", "manifest-file", "current", "sst-file"],
  sources: [
    { label: "internal/manifest/manifest.go", path: "internal/manifest/manifest.go", evidenceStatus: "source-verified" },
    { label: "internal/db/flush.go — flushImmutable manifest commit", path: "internal/db/flush.go", symbol: "flushImmutable", evidenceStatus: "source-verified" },
    { label: "internal/db/sst_cleanup.go — removeOrphanSSTFiles", path: "internal/db/sst_cleanup.go", symbol: "removeOrphanSSTFiles", evidenceStatus: "source-verified" },
  ],
  evidenceStatus: "source-verified",
};

/** @type {import('../schema').ArchitectureDecision} */
export const bloomDecision = {
  id: "decision-bloom",
  nodeId: "bloom",
  title: "Bloom Filter (internal/bloom)",
  category: "Engine Package",
  sourcePath: "internal/bloom",
  summary: "A probabilistic membership test embedded in each SSTable. Returns MayContain=false definitively when a key is absent, eliminating block reads. Cannot return false negatives. False positives cause an unnecessary block read.",

  responsibility: {
    owns: [
      "Building the filter: New(expectedEntries, falsePositiveRate) computes optimal m (bits) and k (hash functions)",
      "Add(key): inserts a key using k double-hash positions in the bit array",
      "MayContain(key): returns true if all k bit positions are set (key may be present); false if any is unset (key is definitely absent)",
      "Encode/Decode: serialize/deserialize the filter for embedding in SST footer",
    ],
    doesNotOwn: [
      "Deciding which false positive rate to use — internal/sstable.NewWriter",
      "Persisting the filter — internal/sstable embeds it in the SST file footer region",
    ],
    details: "internal/bloom is a pure in-memory probabilistic data structure library. It is used exclusively by internal/sstable.",
  },

  whyItExists: {
    problem: "On Get, every SST must be checked for a key. Without a filter, each check requires at minimum a binary search of the in-memory index followed by a block read. For a miss, this is wasted I/O.",
    constraint: "Must be fast (no disk I/O), compact (embedded in the SST file), and correct in one direction (no false negatives).",
    decision: "Use a Bloom filter per SSTable. A false negative (missing a key that exists) is unacceptable. A false positive (reading a block for an absent key) is tolerable.",
    result: "Get on a key not in the SST: bloom.MayContain returns false → block read skipped. False positive rate depends on filter size and expected entries.",
  },

  classification: {
    level: "LLD",
    explanation: "The bloom filter is an internal implementation detail of the SSTable layer — it is not independently visible in the architecture at the HLD level.",
  },

  lld: {
    implementation: [
      "Filter struct: {bits []byte, k uint, n uint, m uint}",
      "m (bit array size) = -expectedEntries * ln(falsePositiveRate) / (ln(2))^2",
      "k (hash functions) = ceil((m/n) * ln(2)), clamped to [1, 30]",
      "Hash: FNV-64a double-hash: h1 = sum64, h2 = sum64 >> 32. Bit index = (h1 + i*h2) % m for i in [0, k).",
      "Encode: [k uint32 (4B)] [m uint32 (4B)] [bits (ceil(m/8) B)]",
      "Decode: validates k > 0, m > 0, data length >= expected bit array size.",
      "If bloom is nil (no filter present), MayContain returns true — safe default.",
    ],
    sourceReferences: [
      {
        label: "Filter struct and sizing formulas",
        path: "internal/bloom/bloom.go",
        symbol: "Filter, New",
        lineStart: 10,
        lineEnd: 37,
        evidenceStatus: "source-verified",
      },
      {
        label: "MayContain — double-hash lookup",
        path: "internal/bloom/bloom.go",
        symbol: "MayContain",
        lineStart: 57,
        lineEnd: 73,
        evidenceStatus: "source-verified",
      },
      {
        label: "Encode / Decode",
        path: "internal/bloom/bloom.go",
        symbol: "Encode, Decode",
        lineStart: 76,
        lineEnd: 107,
        evidenceStatus: "source-verified",
      },
    ],
  },

  rationale: {
    evidenceStatus: "source-verified",
    selectedApproach: "Standard Bloom filter with FNV-64a double-hash. Optimal m and k computed from expected entries and target false positive rate.",
    whyItFits: [
      "O(k) check with no disk I/O — eliminates block reads for absent keys.",
      "Compact: bit array is much smaller than the data it indexes.",
      "FNV-64a is fast and uniformly distributed on byte-slice keys.",
      "No false negatives: guaranteed not to miss a key that exists in the filter.",
    ],
    acceptedTradeoffs: [
      "False positives: a small percentage of Get calls will read a block and find the key is absent. Rate depends on filter sizing.",
      "Filter is per-SST, not global: a key deleted in a newer SST can still trigger a false positive in an older SST's filter.",
      "Filter is loaded entirely into memory at reader open time: adds to per-reader RAM overhead.",
    ],
  },

  failureWithoutComponent: [
    "Every Get must perform a binary search and block read on every SST, regardless of whether the key is present.",
    "Read amplification grows directly with SST count — unacceptable without compaction keeping count bounded.",
  ],

  relatedNodes: ["sstable", "sst-file"],
  sources: [
    { label: "internal/bloom/bloom.go", path: "internal/bloom/bloom.go", evidenceStatus: "source-verified" },
    { label: "internal/sstable/reader.go — MayContain usage", path: "internal/sstable/reader.go", symbol: "MayContain, Get", evidenceStatus: "source-verified" },
  ],
  evidenceStatus: "source-verified",
};

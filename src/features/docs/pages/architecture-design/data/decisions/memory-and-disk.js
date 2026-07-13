/**
 * Architecture decision records for iterator, memory state components,
 * background workers (batchFlusher), and disk artifacts.
 *
 * Evidence sources (SOURCE VERIFIED):
 *   internal/iterator/merge.go — MergeIterator, NewMergeIterator, advance, mergeStep
 *   internal/iterator/merge_core.go — mergeStep
 *   internal/iterator/iterator.go — Iterator interface
 *   internal/db/scan.go — Scan, ScanIterator, priorities (1_000_001 / 1_000_000 / 999_999)
 *   internal/db/get.go — Get, lookupPendingBatch, lookupMemtable, lookupSSTReaders
 *   internal/db/batch.go — batchFlusher, batchFlushDelayDefault=1ms, batchMaxRecords=64,
 *     batchMaxBytes=16KiB, batchPersistBarrier, scheduleBatchFlushLocked
 *   internal/db/db.go — DB.pendingFlush, DB.sstablesSnap, DB.sstables, Open recovery
 *   internal/db/wal_state.go — walFlushState (16 bytes: FreezeOffset int64 + SSTID uint64)
 *   internal/db/sst_cleanup.go — quarantineDir, removeOrphanSSTFiles
 *   internal/db/dir_lock.go — acquireDirLock, lockFileName="LOCK"
 *   internal/manifest/manifest.go — currentFileName="CURRENT", initialManifest="MANIFEST-000001"
 */

/** @type {import('../schema').ArchitectureDecision} */
export const iteratorDecision = {
  id: "decision-iterator",
  nodeId: "iterator",
  title: "Merge Iterator (internal/iterator)",
  category: "Engine Package",
  sourcePath: "internal/iterator",
  summary: "Implements priority-based merge iteration across multiple sorted sources (memtable snapshots and SSTable iterators). Used exclusively by Scan. Get uses direct layered lookups instead.",

  responsibility: {
    owns: [
      "MergeIterator: merging multiple Iterator sources by priority (higher priority = newer data)",
      "Tombstone filtering: MergeIterator skips tombstone entries — callers never see deleted keys",
      "Seek: positions all sources at or after a key, finds the first visible entry",
      "Next: advances to the next unique key, picking the highest-priority value among duplicates",
    ],
    doesNotOwn: [
      "Individual source iteration — each source implements the Iterator interface independently",
      "Deciding which sources to include — internal/db.Scan constructs the source list",
      "Snapshot isolation — memtable snapshots are taken by internal/db.Scan before constructing the iterator",
    ],
    details: "internal/iterator is used only for Scan. Get (point lookup) uses direct layered lookups without a MergeIterator — this is a concrete source-verified distinction.",
  },

  whyItExists: {
    problem: "Data for a given key may exist in multiple layers: the active memtable, one or more frozen memtables, and multiple SST files. A range scan must present a consistent, deduplicated, tombstone-free view.",
    constraint: "Sources must be merged in priority order (newest wins). Deleted keys (tombstones) must be invisible to callers. The merge must not require loading all data into memory.",
    decision: "Implement a priority-based merge iterator that advances all sources simultaneously, picks the lowest key among current heads, and among duplicate keys, picks the highest-priority (newest) value.",
    result: "Scan presents a point-in-time, sorted, tombstone-free view of all data layers without loading all data into memory.",
  },

  classification: {
    level: "LLD",
    explanation: "MergeIterator is an internal implementation detail of the scan path. The HLD decision is 'use a layered LSM read path'. The MergeIterator is the concrete mechanism.",
  },

  lld: {
    implementation: [
      "Iterator interface (iterator.go): Valid, Key, Value, IsTombstone, Next, Seek, Close, Err",
      "MergeIterator struct: {sources []source, key []byte, value []byte, valid bool, err error}",
      "source struct: {it Iterator, priority int}",
      "advance(): calls mergeStep(sources, skipTombstones=true) — picks lowest key, highest priority, skips tombstones.",
      "Priorities in Scan (scan.go): pendingBatch=1_000_001, active=1_000_000, pendingFlush[0..n]=999_999..999_999-n, SSTs[i]=i (0=oldest).",
      "Tombstones: MergeIterator.IsTombstone() always returns false — tombstones are consumed internally and never surfaced to callers.",
    ],
    sourceReferences: [
      {
        label: "MergeIterator struct",
        path: "internal/iterator/merge.go",
        symbol: "MergeIterator",
        lineStart: 10,
        lineEnd: 16,
        evidenceStatus: "source-verified",
      },
      {
        label: "Scan source priorities",
        path: "internal/db/scan.go",
        symbol: "scanPriorityPendingBatch, scanPriorityActive, scanPriorityImmutable",
        lineStart: 11,
        lineEnd: 15,
        evidenceStatus: "source-verified",
      },
    ],
  },

  rationale: {
    evidenceStatus: "source-verified",
    selectedApproach: "Priority-based merge with tombstone filtering. Sources passed in from internal/db.Scan.",
    whyItFits: [
      "Priority-based merge naturally handles the LSM 'newest wins' invariant without explicit deduplication logic.",
      "Tombstone filtering at the iterator level means callers (Scan) never need to check tombstone flags.",
      "Snapshot-based: all source iterators are created from point-in-time snapshots, so concurrent writes do not affect an in-progress scan.",
    ],
    acceptedTradeoffs: [
      "Get does not use MergeIterator — it uses direct layered lookups (pendingBatch → active → pendingFlush → SSTs). MergeIterator would be unnecessary overhead for point lookups.",
      "Range scan priority constants (1_000_001, 1_000_000, 999_999...) are magic numbers — documented in scan.go via constant names.",
    ],
  },

  qualityImpacts: [
    {
      quality: "Range-scan efficiency",
      direction: "strong-positive",
      explanation: "Priority-based merge allows sequential reads from all sources simultaneously, eliminating the need to load all data for deduplication. NOT YET MEASURED in terms of actual throughput.",
      evidenceStatus: "source-verified",
    },
    {
      quality: "Read amplification",
      direction: "context-dependent",
      explanation: "Scan touches all live sources. For a key range that spans many SSTs, all SSTs are iterated. This is bounded by the SST count (controlled by compaction). NOT YET MEASURED.",
      evidenceStatus: "source-verified",
    },
  ],

  failureWithoutComponent: [
    "Range scans would require loading all memtable and SST data into a single sorted structure — impractical for large datasets.",
    "Deduplication and tombstone filtering would need to be implemented separately for each caller.",
  ],

  relatedNodes: ["api", "active-mt", "pending-flush", "sst-list", "sstable"],
  sources: [
    { label: "internal/iterator/merge.go", path: "internal/iterator/merge.go", evidenceStatus: "source-verified" },
    { label: "internal/db/scan.go — Scan, priorities", path: "internal/db/scan.go", symbol: "Scan", evidenceStatus: "source-verified" },
  ],
  evidenceStatus: "source-verified",
};

/** @type {import('../schema').ArchitectureDecision} */
export const batchFlusherDecision = {
  id: "decision-batch-flusher",
  nodeId: "batch-flusher",
  title: "batchFlusher Goroutine",
  category: "Background Worker",
  sourcePath: "internal/db/batch.go",
  summary: "A dedicated goroutine that implements group commit for WAL writes. It batches Put/Delete mutations and fsyncs the WAL once per batch rather than once per operation, then applies the batch to the active memtable.",

  responsibility: {
    owns: [
      "Group commit: batching pendingBatch records and calling wal.AppendBatch (single fsync per batch)",
      "Applying the batch to the active memtable after WAL fsync success",
      "Triggering maybeFlushLocked after each batch application",
      "Signaling flushCh if a flush is needed",
      "Three wakeup modes: timer (batchFlushDelay), explicit sync (batchSyncCh), and stop",
      "batchPersistBarrier: tracking in-flight batches so Sync() can wait correctly",
    ],
    doesNotOwn: [
      "WAL encoding — internal/wal.AppendBatch",
      "Deciding whether to flush the memtable — maybeFlushLocked makes that decision",
      "Compaction — separate goroutine",
    ],
    details: "batchFlusher is the serialization point for WAL writes. All Put/Delete operations land in pendingBatch; batchFlusher drains it in batches with a single fsync.",
  },

  whyItExists: {
    problem: "Each Put/Delete must be fsynced to the WAL before its memtable application. If every Put triggered a separate fsync, write throughput would be extremely low (one fsync per write).",
    constraint: "Durability requires WAL fsync before memtable application. Throughput requires batching. These must be reconciled.",
    decision: "Dedicate a goroutine to collect mutations for ~1ms (configurable), then write all of them to the WAL and fsync once. Apply all records to the memtable after the single fsync. This is the group commit pattern.",
    result: "Write throughput is amortized over the batch. Each individual Put/Delete adds to the batch and returns quickly (async default) or waits for the next batch flush (SyncWrites=true / Sync() call).",
  },

  classification: {
    level: "LLD",
    explanation: "The existence of a group-commit WAL is an HLD decision. The batchFlusher goroutine, timer, channel model, and batchPersistBarrier are the LLD implementation.",
  },

  lld: {
    implementation: [
      "batchFlusher() (batch.go:78-96): select on batchStop / batchSyncCh / batchFlushCh.",
      "scheduleBatchFlushLocked() (batch.go:64-76): creates or resets batchTimer (time.AfterFunc) to signal batchFlushCh after batchFlushDelay.",
      "flushPendingBatch() (batch.go:107-145): acquires db.mu → takePendingBatchLocked → unlock → batchPersist.begin() → wal.AppendBatch → re-lock → applyRecordToMemtable for each → maybeFlushLocked → unlock. On WAL error: restorePendingBatchLocked.",
      "batchPersistBarrier (batch_persist.go): {mu sync.Mutex, inflight int, cond sync.Cond}. begin/end track in-flight batches. wait() used by Sync().",
      "lookupPendingBatch(batch, key): reverse scan (newest first) for point lookup visibility of unflushed batch.",
    ],
    concurrency: [
      "db.mu held during takePendingBatchLocked and applyRecordToMemtable",
      "batchPersistBarrier.begin() called before WAL write, end() called after apply. Sync() waits via barrier.wait().",
      "batchSyncCh: unbuffered reply channel pattern — batchSyncCh <- reply, then <-reply for sync writes",
    ],
    errorHandling: [
      "WAL AppendBatch error: restorePendingBatchLocked prepends failed batch back. setBackgroundErr('wal', err). Returns error.",
      "Timer-triggered async flush error: logged, not returned to writer.",
    ],
    sourceReferences: [
      {
        label: "batchFlusher — goroutine loop",
        path: "internal/db/batch.go",
        symbol: "batchFlusher",
        lineStart: 78,
        lineEnd: 96,
        evidenceStatus: "source-verified",
      },
      {
        label: "flushPendingBatch — group commit sequence",
        path: "internal/db/batch.go",
        symbol: "flushPendingBatch",
        lineStart: 107,
        lineEnd: 145,
        evidenceStatus: "source-verified",
      },
      {
        label: "batchPersistBarrier — Sync() coordination",
        path: "internal/db/batch_persist.go",
        symbol: "batchPersistBarrier",
        evidenceStatus: "source-verified",
      },
    ],
  },

  rationale: {
    evidenceStatus: "source-verified",
    selectedApproach: "Single goroutine, timer-based group commit with configurable delay (default 1ms). Three flush triggers: timer, explicit sync request, and max batch size/records.",
    whyItFits: [
      "Group commit amortizes fsync cost across concurrent writers — a fundamental technique for write-heavy embedded databases.",
      "Single goroutine: no concurrent WAL writes, no ordering issues.",
      "batchSyncCh enables Sync() to piggyback on the next batch flush and wait for its completion — correct durability barrier without a dedicated sync goroutine.",
    ],
    acceptedTradeoffs: [
      "Default async mode: puts return before WAL fsync — up to ~1ms of data at risk on crash. Acceptable for many use cases; SyncWrites=true available for stricter durability.",
      "Single goroutine: maximum WAL write throughput is bounded by one goroutine's fsync speed.",
    ],
  },

  metrics: [
    {
      name: "Default batch flush delay",
      value: 1,
      unit: "ms",
      evidenceType: "configured",
      source: { label: "internal/db/batch.go — batchFlushDelayDefault", path: "internal/db/batch.go", symbol: "batchFlushDelayDefault", lineStart: 16, lineEnd: 16, evidenceStatus: "source-verified" },
    },
    {
      name: "Max records per batch (forced flush)",
      value: 64,
      unit: "records",
      evidenceType: "configured",
      source: { label: "internal/db/batch.go — batchMaxRecords", path: "internal/db/batch.go", symbol: "batchMaxRecords", lineStart: 14, lineEnd: 14, evidenceStatus: "source-verified" },
    },
    {
      name: "Max bytes per batch (forced flush)",
      value: 16,
      unit: "KiB",
      evidenceType: "configured",
      source: { label: "internal/db/batch.go — batchMaxBytes", path: "internal/db/batch.go", symbol: "batchMaxBytes", lineStart: 15, lineEnd: 15, evidenceStatus: "source-verified" },
    },
    { name: "Write throughput with group commit", evidenceType: "not-measured" },
    { name: "Effective durability window (async mode)", evidenceType: "not-measured", methodology: "Approximately batchFlushDelay (1ms default) in normal operation, subject to OS scheduler jitter." },
  ],

  failureWithoutComponent: [
    "Without group commit, every Put/Delete would require a separate WAL fsync — write throughput degrades to one-fsync-per-write.",
    "Without the batchPersistBarrier, Sync() cannot safely wait for in-flight WAL batches — race condition under -race.",
  ],

  relatedNodes: ["api", "wal", "active-mt", "pending-flush"],
  sources: [
    { label: "internal/db/batch.go", path: "internal/db/batch.go", evidenceStatus: "source-verified" },
    { label: "internal/db/batch_persist.go", path: "internal/db/batch_persist.go", evidenceStatus: "source-verified" },
    { label: "internal/db/write.go", path: "internal/db/write.go", evidenceStatus: "source-verified" },
  ],
  evidenceStatus: "source-verified",
};

/** @type {import('../schema').ArchitectureDecision} */
export const pendingFlushDecision = {
  id: "decision-pending-flush",
  nodeId: "pending-flush",
  title: "pendingFlush Queue",
  category: "In-memory LSM State",
  sourcePath: "internal/db",
  summary: "A FIFO queue of frozen memtables ([]flushQueueEntry) waiting to be written to SST files. Entries include the memtable and the WAL cutoff offset captured at freeze time.",

  responsibility: {
    owns: [
      "Holding frozen SkipLists between memtable swap and SST flush completion",
      "Recording the WAL cutoff offset (walCutoff int64) for WAL truncation after flush",
      "Providing the data source for drainPendingFlush (flusher goroutine)",
      "Being searched (newest-first) during Get for reads of unflushed data",
      "Being snapshot-iterated by Scan for point-in-time range reads",
    ],
    doesNotOwn: [
      "Deciding when to freeze — maybeFlushLocked in internal/db",
      "Writing to SST — flusher via flushImmutable",
    ],
    details: "pendingFlush is db.pendingFlush []flushQueueEntry, protected by db.mu. It is a plain Go slice acting as a FIFO queue.",
  },

  whyItExists: {
    problem: "Freezing the active memtable (to flush it) must happen quickly on the write path. But writing to disk takes time. The frozen memtable must be stored somewhere accessible to both reads and the flusher goroutine.",
    constraint: "Frozen memtables must remain searchable for Get and Scan until they are fully flushed and the SST is visible. They cannot be discarded before that.",
    decision: "Use a simple FIFO slice (pendingFlush). Frozen memtables enter from the tail; the flusher drains from the head. Get searches newest-first (tail to head). Scan snapshots all entries.",
    result: "Zero extra allocation for the queue. Reads of recently-written keys find them in pendingFlush when the active memtable has been swapped. The flusher has an ordered sequence of work to drain.",
  },

  classification: {
    level: "HLD",
    explanation: "pendingFlush is the state boundary between the write path (memtable swap) and the flush path (SST write). Its existence is a structural HLD decision.",
  },

  failureWithoutComponent: [
    "Without the pendingFlush queue, frozen memtables would need to be flushed synchronously on the write path, stalling puts during flush I/O.",
    "Recently-written unflushed keys would not be visible on Get until the flush completed — breaking read consistency.",
  ],

  relatedNodes: ["active-mt", "flusher", "api", "wal"],
  sources: [
    { label: "internal/db/db.go — DB.pendingFlush, flushQueueEntry", path: "internal/db/db.go", symbol: "pendingFlush, flushQueueEntry", evidenceStatus: "source-verified" },
    { label: "internal/db/flush.go — drainPendingFlush, maybeFlushLocked", path: "internal/db/flush.go", evidenceStatus: "source-verified" },
    { label: "internal/db/get.go — pendingFlush search", path: "internal/db/get.go", symbol: "Get", lineStart: 44, lineEnd: 52, evidenceStatus: "source-verified" },
  ],
  evidenceStatus: "source-verified",
};

/** @type {import('../schema').ArchitectureDecision} */
export const sstListDecision = {
  id: "decision-sst-list",
  nodeId: "sst-list",
  title: "sstables[] + atomic snapshot",
  category: "In-memory LSM State",
  sourcePath: "internal/db",
  summary: "db.sstables is the canonical live SST reader list (protected by db.mu). db.sstablesSnap is an atomic.Pointer snapshot that allows Get and Scan to access SST readers without holding db.mu during I/O.",

  responsibility: {
    owns: [
      "db.sstables: canonical ordered list of *sstable.Reader, protected by db.mu",
      "db.sstablesSnap (atomic.Pointer[[]*sstable.Reader]): lock-free snapshot for concurrent reads",
      "publishSSTables: creates a copy of db.sstables and stores it atomically",
      "snapshotSSTables: loads the atomic pointer — O(1), no lock required",
    ],
    doesNotOwn: [
      "SST file content — internal/sstable.Reader",
      "Manifest — the manifest is the durable source of truth; sstables[] is the in-memory view",
    ],
    details: "The two-level structure (canonical list + atomic snapshot) allows concurrent readers to access SST readers without holding db.mu during potentially-slow block reads.",
  },

  whyItExists: {
    problem: "Multiple goroutines need to read SST files concurrently. Holding db.mu (an RWMutex) for the duration of a block read would serialize all concurrent reads.",
    constraint: "db.sstables is modified by the flusher and compactor under db.mu. Readers need a stable view without holding the lock for I/O.",
    decision: "Maintain an atomic.Pointer snapshot (sstablesSnap) updated every time db.sstables changes (publishSSTables). Readers load the snapshot without a lock, pin each reader with Ref(), then release the lock.",
    result: "Get and Scan hold db.mu only briefly (to snapshot SST readers and Ref them), then release it before any block reads. db.mu is not held during disk I/O.",
  },

  classification: {
    level: "LLD",
    explanation: "This is a concrete concurrency optimization — the use of atomic.Pointer for a lock-free read path alongside a mutex-protected canonical list.",
  },

  lld: {
    implementation: [
      "publishSSTables (db.go:295-302): snap := append([]*sstable.Reader(nil), db.sstables...); db.sstablesSnap.Store(&snap)",
      "snapshotSSTables (db.go:304-310): ptr := db.sstablesSnap.Load(); if ptr == nil return nil; return *ptr",
      "Get (get.go:54-63): readers := db.snapshotSSTables(); for _, r := range readers { r.Ref() }; db.mu.RUnlock(); defer Unref. Block reads happen after lock release.",
    ],
    sourceReferences: [
      {
        label: "publishSSTables — atomic store",
        path: "internal/db/db.go",
        symbol: "publishSSTables",
        lineStart: 295,
        lineEnd: 302,
        evidenceStatus: "source-verified",
      },
      {
        label: "snapshotSSTables — atomic load",
        path: "internal/db/db.go",
        symbol: "snapshotSSTables",
        lineStart: 304,
        lineEnd: 310,
        evidenceStatus: "source-verified",
      },
    ],
  },

  relatedNodes: ["api", "flusher", "compactor", "sstable"],
  sources: [
    { label: "internal/db/db.go — sstables, sstablesSnap, publishSSTables", path: "internal/db/db.go", evidenceStatus: "source-verified" },
    { label: "internal/db/get.go — snapshotSSTables usage", path: "internal/db/get.go", evidenceStatus: "source-verified" },
  ],
  evidenceStatus: "source-verified",
};

// ── Disk artifact decisions ────────────────────────────────────────────────────

/** @type {import('../schema').ArchitectureDecision} */
export const lockDecision = {
  id: "decision-lock",
  nodeId: "lock",
  title: "LOCK File",
  category: "On-disk Artifact",
  sourcePath: "data/LOCK",
  summary: "An exclusive lock file that prevents two processes from opening the same database directory concurrently. Acquired at Open(), released at Close().",

  responsibility: {
    owns: ["Single-process database access enforcement"],
    doesNotOwn: ["Data storage of any kind"],
    details: "The LOCK file (internal/db/dir_lock.go) is created/opened and locked exclusively. On Unix: flock. On Windows: LockFileEx. Returns ErrDatabaseLocked on contention.",
  },

  whyItExists: {
    problem: "Multiple processes writing to the same WAL, manifest, and SST files would corrupt them — the database file format is not designed for concurrent multi-process access.",
    constraint: "Only one process may open a database directory at a time.",
    decision: "Use an OS-provided exclusive file lock (flock/LockFileEx) on a dedicated LOCK file.",
    result: "Any second Open() attempt on the same directory returns ErrDatabaseLocked immediately.",
  },

  classification: { level: "HLD", explanation: "Process isolation boundary — a system-level constraint." },
  sources: [
    { label: "internal/db/dir_lock.go — acquireDirLock", path: "internal/db/dir_lock.go", symbol: "acquireDirLock, lockFileName", evidenceStatus: "source-verified" },
  ],
  evidenceStatus: "source-verified",
};

/** @type {import('../schema').ArchitectureDecision} */
export const walLogDecision = {
  id: "decision-wal-log",
  nodeId: "wal-log",
  title: "wal.log File",
  category: "On-disk Artifact",
  sourcePath: "data/wal.log",
  summary: "The single append-only WAL file. Contains all mutations (Put/Delete) since the last truncation. Replayed on Open to reconstruct the active memtable.",
  responsibility: {
    owns: ["Storing WAL records on disk"],
    doesNotOwn: ["Record encoding — internal/wal"],
    details: "Single file, O_APPEND mode. Truncated after each successful flush via TruncateBefore (copy-rename pattern).",
  },
  whyItExists: {
    problem: "Durability of mutations before SST flush.",
    constraint: "Must survive process crash.",
    decision: "Append-only file with per-batch fsync.",
    result: "Crash-safe durability for acknowledged writes.",
  },
  classification: { level: "LLD", explanation: "The WAL file is the concrete on-disk representation of the WAL package's durability contract." },
  sources: [
    { label: "internal/wal/wal.go — wal.log path, O_APPEND open", path: "internal/wal/wal.go", symbol: "OpenWithLimits", evidenceStatus: "source-verified" },
    { label: "internal/db/db.go — walPath := filepath.Join(opts.Dir, \"wal.log\")", path: "internal/db/db.go", lineStart: 202, lineEnd: 202, evidenceStatus: "source-verified" },
  ],
  evidenceStatus: "source-verified",
};

/** @type {import('../schema').ArchitectureDecision} */
export const walFlushDecision = {
  id: "decision-wal-flush",
  nodeId: "wal-flush",
  title: "wal.flush Checkpoint",
  category: "On-disk Artifact",
  sourcePath: "data/wal.flush",
  summary: "A transient 16-byte crash-recovery file written between manifest commit and WAL truncation. Contains FreezeOffset (int64) + SSTID (uint64). Present only during the truncation window.",
  responsibility: {
    owns: ["Providing bounded WAL replay on recovery if truncation did not complete"],
    doesNotOwn: ["Data storage — it is a coordination marker, not a data file"],
    details: "writeWalFlushState (wal_state.go) writes FreezeOffset+SSTID. walReplayStartOffset reads it and validates SSTID is in the live manifest. If present and valid, replay starts at FreezeOffset instead of 0.",
  },
  whyItExists: {
    problem: "After SST is committed to manifest but before WAL truncation completes, a crash leaves the WAL with records already captured in the SST. Replaying from 0 would not lose data but wastes time.",
    constraint: "Cannot assume truncation completed on recovery. Must detect and handle partial truncation.",
    decision: "Write a 16-byte checkpoint file atomically (write-tmp + rename) before truncation. On recovery, if present and SSTID is in manifest, use FreezeOffset as replay start.",
    result: "Bounded WAL replay. After a crash mid-truncation, recovery skips WAL bytes already in the SST.",
  },
  classification: { level: "LLD", explanation: "A concrete crash-safety mechanism for the truncation window." },
  sources: [
    { label: "internal/db/wal_state.go — walFlushState, writeWalFlushState, walReplayStartOffset", path: "internal/db/wal_state.go", evidenceStatus: "source-verified" },
    { label: "internal/db/flush.go — completeWalAfterFlush", path: "internal/db/flush.go", symbol: "completeWalAfterFlush", evidenceStatus: "source-verified" },
  ],
  evidenceStatus: "source-verified",
};

/** @type {import('../schema').ArchitectureDecision} */
export const currentDecision = {
  id: "decision-current",
  nodeId: "current",
  title: "CURRENT File",
  category: "On-disk Artifact",
  sourcePath: "data/CURRENT",
  summary: "A single-line text file that names the active MANIFEST-NNNNNN file. Updated atomically (write-tmp + rename) on manifest rotation.",
  responsibility: {
    owns: ["Pointing to the active manifest file"],
    doesNotOwn: ["Manifest content — MANIFEST-* file"],
    details: "On Open, manifest.Open reads CURRENT. If absent, defaults to MANIFEST-000001. On rotation (MaybeCompact), writeCurrent writes CURRENT.tmp and renames.",
  },
  whyItExists: {
    problem: "Manifest files rotate (MANIFEST-000001 → MANIFEST-000002 → ...). On recovery, the database must find the active manifest.",
    constraint: "CURRENT update must be atomic — a crash mid-update cannot leave both old and new manifest active simultaneously.",
    decision: "Write CURRENT.tmp with new name, fsync, close, rename to CURRENT.",
    result: "Recovery always finds a valid manifest name in CURRENT.",
  },
  classification: { level: "LLD", explanation: "Concrete pointer-file pattern for atomic manifest rotation." },
  sources: [
    { label: "internal/manifest/manifest.go — readCurrentManifest, writeCurrent", path: "internal/manifest/manifest.go", symbol: "readCurrentManifest, writeCurrent", evidenceStatus: "source-verified" },
  ],
  evidenceStatus: "source-verified",
};

/** @type {import('../schema').ArchitectureDecision} */
export const manifestFileDecision = {
  id: "decision-manifest-file",
  nodeId: "manifest-file",
  title: "MANIFEST-* Files",
  category: "On-disk Artifact",
  sourcePath: "data/MANIFEST-*",
  summary: "Append-only log files tracking the live SST set. Each record is length-prefixed (4-byte BigEndian). Rotated when ≥64 records or ≥64 KiB. Old manifest is deleted after CURRENT is updated.",
  responsibility: {
    owns: ["Durable record of which SST files are live"],
    doesNotOwn: ["SST file content"],
    details: "Format: [recordLen uint32 BigEndian] [payload]. Two operation types: AddFile (flush) and SetFileSet (compaction). Tail is salvaged on open if partially written.",
  },
  whyItExists: {
    problem: "The live SST set must survive crashes. Append-only log provides durability with minimal overhead.",
    constraint: "Atomic commit: either the full record is durable or nothing changes.",
    decision: "Append-only + fsync per record. AppendNewFile for flush, AppendSetFileSet for compaction.",
    result: "Crash-safe SST set management.",
  },
  classification: { level: "LLD", explanation: "Concrete file format implementing the manifest durability contract." },
  sources: [
    { label: "internal/manifest/manifest.go", path: "internal/manifest/manifest.go", evidenceStatus: "source-verified" },
  ],
  evidenceStatus: "source-verified",
};

/** @type {import('../schema').ArchitectureDecision} */
export const sstFileDecision = {
  id: "decision-sst-file",
  nodeId: "sst-file",
  title: "sst_*.sst Files",
  category: "On-disk Artifact",
  sourcePath: "data/sst_*.sst",
  summary: "Immutable sorted SSTable files. Created by flush (one per memtable) or compaction (one per merge). Pattern: sst_%08d.sst. Contain data blocks + block index + bloom filter + footer.",
  responsibility: {
    owns: ["Durable, sorted, immutable key-value storage"],
    doesNotOwn: ["Any in-memory state"],
    details: "Written once. Never modified. Deleted only after manifest commit removes them from the live set and all Reader refs are released (via Discard).",
  },
  whyItExists: {
    problem: "Memtable data must be persisted to survive crashes and to reclaim RAM.",
    constraint: "Files must be sorted for efficient lookup and compaction. Files must be immutable for safe concurrent reads.",
    decision: "Write immutable sorted SST files with block-based layout, bloom filter, and index.",
    result: "Durable, efficiently-searchable sorted storage.",
  },
  classification: { level: "LLD", explanation: "Concrete on-disk file format for the SSTable package." },
  sources: [
    { label: "internal/sstable/writer.go — NewWriter", path: "internal/sstable/writer.go", evidenceStatus: "source-verified" },
    { label: "internal/sstable/reader.go — OpenReader", path: "internal/sstable/reader.go", evidenceStatus: "source-verified" },
    { label: "internal/db/db.go — sstFilePath, sst_%08d.sst pattern", path: "internal/db/db.go", symbol: "sstFilePath", lineStart: 267, lineEnd: 269, evidenceStatus: "source-verified" },
  ],
  evidenceStatus: "source-verified",
};

/** @type {import('../schema').ArchitectureDecision} */
export const quarantineDecision = {
  id: "decision-quarantine",
  nodeId: "quarantine",
  title: "quarantine/ Directory",
  category: "On-disk Artifact",
  sourcePath: "data/quarantine/",
  summary: "A directory where orphaned SST files (present on disk but absent from the manifest) are moved on Open. Files are renamed here rather than deleted, preserving them for inspection.",
  responsibility: {
    owns: ["Safe storage of potentially-corrupt or orphaned SST files"],
    doesNotOwn: ["Normal database operations — quarantine is only touched during Open"],
    details: "removeOrphanSSTFiles (sst_cleanup.go) moves orphans here via os.Rename. quarantineDir = filepath.Join(dir, 'quarantine'). Created if absent.",
  },
  whyItExists: {
    problem: "After a crash, SST files may exist on disk that are not in the manifest (e.g., written by a flush that crashed before manifest commit). Deleting them immediately would destroy potentially-valuable data.",
    constraint: "Orphan detection must be conservative — it is safer to preserve orphans than to delete them.",
    decision: "Move orphaned SSTs to quarantine/ rather than deleting them. Preserves them for inspection or manual recovery.",
    result: "No orphaned SST file is silently deleted. quarantine/ can be inspected after an unexpected crash.",
  },
  classification: { level: "LLD", explanation: "A concrete crash-safety pattern: rename instead of delete for suspect files." },
  sources: [
    { label: "internal/db/sst_cleanup.go — quarantineDir, removeOrphanSSTFiles", path: "internal/db/sst_cleanup.go", evidenceStatus: "source-verified" },
  ],
  evidenceStatus: "source-verified",
};

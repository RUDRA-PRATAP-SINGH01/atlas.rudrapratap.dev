/**
 * Architecture decision records for PebbleDB's WAL and Memtable.
 *
 * Evidence sources (SOURCE VERIFIED):
 *   internal/wal/wal.go — Append, AppendBatch, encodeRecord, TruncateBefore,
 *     ReplayFromWithRecovery, readOneRecord
 *   internal/wal/limits.go — DefaultMaxWALFileSize (64 MiB), DefaultMaxKeySize (1 MiB),
 *     DefaultMaxValueSize (16 MiB), recordHeaderSize = 4+4+1+4 = 13
 *   internal/db/batch.go — batchFlusher, flushPendingBatch, batchFlushDelayDefault (1ms),
 *     batchMaxRecords (64), batchMaxBytes (16 KiB)
 *   internal/db/flush.go — completeWalAfterFlush, maybeFlushLocked, flushImmutable
 *   internal/db/wal_state.go — walFlushState, writeWalFlushState, readWalFlushState,
 *     walReplayStartOffset
 *   internal/memtable/skiplist.go — SkipList struct, Put, Get, Delete, Size, Len,
 *     maxHeight=20, p=0.25
 *   internal/memtable/memtable.go (if exists), internal/memtable/iterator.go,
 *     internal/memtable/snapshot.go
 */

/** @type {import('../schema').ArchitectureDecision} */
export const walDecision = {
  id: "decision-wal",
  nodeId: "wal",
  title: "Write-Ahead Log (internal/wal)",
  category: "Persistence",
  sourcePath: "internal/wal",
  summary: "The WAL is the durability boundary for all mutations. A write is only applied to the memtable after a successful WAL fsync. Records are checksummed. The WAL is truncated after memtable contents are flushed to SSTs.",

  responsibility: {
    owns: [
      "Record encoding: keyLen(4B, BigEndian) + key + valueLen(4B, BigEndian) + value + tombstone(1B) + crc32(4B, IEEE, BigEndian)",
      "AppendBatch: writes all records in a batch, fsyncs once per batch",
      "TruncateBefore: copy-then-rename truncation to preserve the WAL tail",
      "ReplayFromWithRecovery: replays from a start offset; truncates trailing partial record",
      "Size limits: MaxFileSize (64 MiB), MaxKeySize (1 MiB), MaxValueSize (16 MiB)",
    ],
    doesNotOwn: [
      "Deciding when to flush or truncate — internal/db controls that",
      "Applying records to the memtable — internal/db/batch.go does that after WAL success",
      "WAL replay start offset — walReplayStartOffset in internal/db",
    ],
    details: "internal/wal is a pure append-only log library. It knows nothing about memtables, SSTables, or the engine state.",
  },

  whyItExists: {
    problem: "Memtable data is volatile (RAM). A process crash or power loss destroys it. Without durability, every acknowledged write is at risk.",
    constraint: "PebbleDB must survive crashes without losing acknowledged writes. The constraint: no write is applied to the memtable until it is safely recorded on stable storage.",
    decision: "Implement a write-ahead log that fsyncs before memtable application. Every mutation is appended to the WAL and checksummed before the memtable is updated.",
    result: "Crash durability: replaying the WAL on restart recreates the last memtable state. CRC32 checksum detects corrupt or partially-written records at recovery time.",
  },

  classification: {
    level: "HLD + LLD",
    explanation: "HLD: the WAL is the system's durability boundary. LLD: the record wire format, CRC32 checksum, batch fsync strategy, and copy-rename truncation are concrete implementation choices.",
  },

  hld: {
    architecturalRole: "Durability boundary between volatile memtable state and stable storage.",
    upstream: ["batch-flusher"],
    downstream: ["wal-log", "wal-flush"],
    dataOwnership: ["wal.log file on disk"],
    persistenceResponsibility: "Sole owner of wal.log. Writes, fsyncs, truncates, and replays it.",
    concurrencyResponsibility: "WAL struct has its own sync.Mutex. All operations (Append, AppendBatch, TruncateBefore) are mutex-serialized.",
    failureBoundary: "If AppendBatch fails (write or Sync error), the error is returned to flushPendingBatch, which restores the batch to pendingBatch and records the error in bgErrs.",
    lifecycle: "Opened once per database open (wal.OpenWithLimits). Closed on database close. Truncated after each successful flush.",
  },

  lld: {
    implementation: [
      "WAL struct (wal.go): {path, file *os.File, mu sync.Mutex, limits ReplayLimits}",
      "AppendBatch: acquires w.mu, encodes + writes each record (no fsync per record), calls file.Sync() once at end.",
      "encodeRecord: buf = keyLen(4) | key | valueLen(4) | value | tombstone(1) | crc32.ChecksumIEEE(buf)(4)",
      "TruncateBefore: acquires w.mu, calls copyWalTailLocked (64 KiB chunks), fsync on tmp file, close original, os.Rename(tmp, wal.log), reopen for append.",
      "ReplayFromWithRecovery: seeks to startOffset, reads records, advances validEnd on success. On io.ErrUnexpectedEOF (partial record), truncates to validEnd. On CRC mismatch, returns error.",
      "recordHeaderSize = 13 bytes: 4 (keyLen) + 4 (valueLen) + 1 (tombstone) + 4 (crc32)",
    ],
    dataStructures: [
      "Record struct: {Key []byte, Value []byte, Tombstone bool}",
      "ReplayLimits struct: {MaxFileSize int64, MaxKeySize uint32, MaxValueSize uint32, MaxRecordSize uint32}",
    ],
    interfaces: [
      "WAL.Append(Record) error — single-record append (not used for group commit)",
      "WAL.AppendBatch([]Record) error — batch append with single fsync",
      "WAL.TruncateBefore(int64) error — remove prefix bytes",
      "WAL.Size() (int64, error) — captured at flush trigger time",
      "ReplayFromWithRecovery(path, limits, startOffset, fn) (int64, error)",
    ],
    persistence: [
      "wal.log opened with O_CREATE|O_RDWR|O_APPEND",
      "AppendBatch calls file.Sync() — OS-level fsync, not just flush",
      "TruncateBefore: copy → fsync tmp → rename (atomic replacement on POSIX-like systems)",
    ],
    errorHandling: [
      "AppendBatch returns error on any write or Sync failure — batch is not applied",
      "ReplayFromWithRecovery truncates trailing partial record (io.ErrUnexpectedEOF) — not an error",
      "CRC32 mismatch during replay returns an error — data is corrupt, not merely truncated",
      "MaxFileSize exceeded returns ErrWALTooLarge — prevents OOM on corrupt data",
    ],
    sourceReferences: [
      {
        label: "encodeRecord — wire format",
        path: "internal/wal/wal.go",
        symbol: "encodeRecord",
        lineStart: 86,
        lineEnd: 107,
        evidenceStatus: "source-verified",
      },
      {
        label: "AppendBatch — group commit fsync",
        path: "internal/wal/wal.go",
        symbol: "AppendBatch",
        lineStart: 60,
        lineEnd: 75,
        evidenceStatus: "source-verified",
      },
      {
        label: "TruncateBefore — copy-rename truncation",
        path: "internal/wal/wal.go",
        symbol: "TruncateBefore",
        lineStart: 300,
        lineEnd: 342,
        evidenceStatus: "source-verified",
      },
      {
        label: "ReplayFromWithRecovery — recovery with partial record handling",
        path: "internal/wal/wal.go",
        symbol: "ReplayFromWithRecovery",
        lineStart: 139,
        lineEnd: 191,
        evidenceStatus: "source-verified",
      },
      {
        label: "ReplayLimits defaults",
        path: "internal/wal/limits.go",
        symbol: "DefaultReplayLimits",
        evidenceStatus: "source-verified",
      },
    ],
  },

  rationale: {
    evidenceStatus: "source-verified",
    selectedApproach: "Append-only file with per-batch fsync (group commit). Records include CRC32 checksum. Truncation uses copy-then-rename.",
    whyItFits: [
      "Group commit (AppendBatch + one fsync) amortizes fsync cost across multiple writes batched by batchFlusher.",
      "CRC32 checksum detects partial writes and disk corruption during replay.",
      "Copy-rename truncation is crash-safe: a crash mid-truncation leaves either the original WAL or the completed truncated WAL, never a corrupt intermediate state.",
      "Simple file format: no framing overhead beyond a 13-byte header per record.",
    ],
    acceptedTradeoffs: [
      "Asynchronous default: puts can return before WAL fsync completes (batchFlusher timer). In-flight writes since last fsync are at risk on crash. Call Sync() or set SyncWrites=true for per-write durability.",
      "Sequential write: WAL is a bottleneck for high-throughput concurrent writers. Acceptable for an embedded single-process engine.",
      "WAL grows unbounded until a flush completes. TruncateBefore requires a full file read (copy) — O(WAL size).",
    ],
  },

  alternatives: [
    {
      name: "Per-record fsync (SyncWrites=true)",
      status: "implemented",
      advantages: ["Strongest durability: every write is durable before returning"],
      disadvantages: ["Dramatically lower write throughput — one fsync per Put/Delete"],
      fitForPebbleDB: "Available via Options.SyncWrites=true. Default is false (group commit).",
      evidenceStatus: "source-verified",
    },
    {
      name: "Write-ahead log with fixed-size segments",
      status: "plausible-alternative",
      advantages: ["Bounded truncation cost: discard whole segments instead of copying"],
      disadvantages: ["More complex segment management; more files on disk"],
      fitForPebbleDB: "Not implemented. Current single-file design is simpler for an embedded engine.",
      evidenceStatus: "theoretical",
    },
    {
      name: "No WAL (memtable-only, no crash safety)",
      status: "plausible-alternative",
      advantages: ["Fastest writes — no disk I/O on Put/Delete"],
      disadvantages: ["Any crash loses all in-memory data — unacceptable for a durable store"],
      fitForPebbleDB: "Incompatible with PebbleDB's durability requirement.",
      evidenceStatus: "theoretical",
    },
  ],

  qualityImpacts: [
    {
      quality: "Durability",
      direction: "strong-positive",
      explanation: "Every write is checksummed and fsynced before memtable application. CRC32 detects corruption. Partial-record tail is handled gracefully during recovery.",
      evidenceStatus: "source-verified",
    },
    {
      quality: "Write latency",
      direction: "context-dependent",
      explanation: "Default (async): batchFlusher batches writes and fsyncs once per ~1ms. SyncWrites=true: every Put/Delete waits for fsync. Actual latency numbers are NOT YET MEASURED.",
      evidenceStatus: "source-verified",
    },
    {
      quality: "Write throughput",
      direction: "context-dependent",
      explanation: "Group commit amortizes fsync cost. Throughput depends on batch size and write rate. NOT YET MEASURED.",
      evidenceStatus: "source-verified",
    },
    {
      quality: "Recovery time",
      direction: "moderate-positive",
      explanation: "walReplayStartOffset limits replay to WAL bytes not yet captured in flushed SSTs. Recovery cost is proportional to unflushed WAL bytes, not total WAL size.",
      evidenceStatus: "source-verified",
    },
    {
      quality: "Space amplification",
      direction: "context-dependent",
      explanation: "WAL grows until a flush completes. Under write pressure, it can grow to memtableSize (4 MiB by default) before truncation. Exact growth pattern depends on workload. NOT YET MEASURED.",
      evidenceStatus: "source-verified",
    },
  ],

  metrics: [
    {
      name: "Default batch flush delay",
      value: 1,
      unit: "ms",
      evidenceType: "configured",
      source: {
        label: "internal/db/batch.go — batchFlushDelayDefault",
        path: "internal/db/batch.go",
        symbol: "batchFlushDelayDefault",
        lineStart: 16,
        lineEnd: 16,
        evidenceStatus: "source-verified",
      },
    },
    {
      name: "Max batch records before forced flush",
      value: 64,
      unit: "records",
      evidenceType: "configured",
      source: {
        label: "internal/db/batch.go — batchMaxRecords",
        path: "internal/db/batch.go",
        symbol: "batchMaxRecords",
        lineStart: 14,
        lineEnd: 14,
        evidenceStatus: "source-verified",
      },
    },
    {
      name: "Max batch size before forced flush",
      value: 16,
      unit: "KiB",
      evidenceType: "configured",
      source: {
        label: "internal/db/batch.go — batchMaxBytes",
        path: "internal/db/batch.go",
        symbol: "batchMaxBytes",
        lineStart: 15,
        lineEnd: 15,
        evidenceStatus: "source-verified",
      },
    },
    {
      name: "Max WAL file size",
      value: 64,
      unit: "MiB",
      evidenceType: "configured",
      source: {
        label: "internal/wal/limits.go — DefaultMaxWALFileSize",
        path: "internal/wal/limits.go",
        symbol: "DefaultMaxWALFileSize",
        lineStart: 6,
        lineEnd: 6,
        evidenceStatus: "source-verified",
      },
    },
    {
      name: "Max key size",
      value: 1,
      unit: "MiB",
      evidenceType: "configured",
      source: {
        label: "internal/wal/limits.go — DefaultMaxKeySize",
        path: "internal/wal/limits.go",
        symbol: "DefaultMaxKeySize",
        lineStart: 7,
        lineEnd: 7,
        evidenceStatus: "source-verified",
      },
    },
    {
      name: "Max value size",
      value: 16,
      unit: "MiB",
      evidenceType: "configured",
      source: {
        label: "internal/wal/limits.go — DefaultMaxValueSize",
        path: "internal/wal/limits.go",
        symbol: "DefaultMaxValueSize",
        lineStart: 8,
        lineEnd: 8,
        evidenceStatus: "source-verified",
      },
    },
    {
      name: "WAL record header overhead",
      value: 13,
      unit: "bytes",
      evidenceType: "configured",
      methodology: "recordHeaderSize = 4 (keyLen) + 4 (valueLen) + 1 (tombstone) + 4 (crc32) = 13",
      source: {
        label: "internal/wal/limits.go — recordHeaderSize",
        path: "internal/wal/limits.go",
        symbol: "recordHeaderSize",
        lineStart: 10,
        lineEnd: 10,
        evidenceStatus: "source-verified",
      },
    },
    {
      name: "WAL write throughput",
      evidenceType: "not-measured",
    },
    {
      name: "fsync latency",
      evidenceType: "not-measured",
    },
  ],

  failureWithoutComponent: [
    "Without the WAL, all writes are lost on any process crash or power loss.",
    "No recovery: restarting the process would start with an empty memtable, losing all data not yet flushed to SSTables.",
    "Any in-flight write operation would silently discard acknowledged data.",
  ],

  failureModes: [
    {
      name: "Partial record at WAL tail (crash mid-write)",
      status: "handled",
      explanation: "ReplayFromWithRecovery detects io.ErrUnexpectedEOF (incomplete read) and truncates to the last valid record boundary. This is the normal crash-recovery path.",
      sources: [
        { label: "internal/wal/wal.go — ReplayFromWithRecovery", path: "internal/wal/wal.go", symbol: "ReplayFromWithRecovery", evidenceStatus: "source-verified" },
      ],
    },
    {
      name: "CRC32 mismatch during replay (disk corruption)",
      status: "handled",
      explanation: "readOneRecord returns io.ErrUnexpectedEOF on checksum mismatch (mapped to an error by mapRecordEOF). Replay stops and returns an error. Recovery does NOT silently skip corrupt records.",
      sources: [
        { label: "internal/wal/wal.go — readOneRecord, CRC check", path: "internal/wal/wal.go", symbol: "readOneRecord", lineStart: 249, lineEnd: 251, evidenceStatus: "source-verified" },
      ],
    },
    {
      name: "WAL file exceeds MaxFileSize",
      status: "handled",
      explanation: "ReplayFromWithRecovery returns ErrWALTooLarge if fi.Size() > limits.MaxFileSize. Prevents OOM on a corrupt or excessively large WAL file.",
      sources: [
        { label: "internal/wal/wal.go — ReplayFromWithRecovery size check", path: "internal/wal/wal.go", symbol: "ReplayFromWithRecovery", evidenceStatus: "source-verified" },
      ],
    },
    {
      name: "Crash during TruncateBefore (mid-copy)",
      status: "handled",
      explanation: "wal.flush checkpoint is written before truncation. On next Open, walReplayStartOffset reads wal.flush and verifies the corresponding SST is in the manifest. If truncation completed, FreezeOffset is the replay start. If truncation was incomplete, the original WAL is intact and replay covers the full range.",
      sources: [
        { label: "internal/db/wal_state.go — walReplayStartOffset", path: "internal/db/wal_state.go", symbol: "walReplayStartOffset", evidenceStatus: "source-verified" },
        { label: "internal/db/flush.go — completeWalAfterFlush", path: "internal/db/flush.go", symbol: "completeWalAfterFlush", evidenceStatus: "source-verified" },
      ],
    },
  ],

  relatedNodes: ["batch-flusher", "wal-log", "wal-flush", "active-mt", "api"],

  sources: [
    { label: "internal/wal/wal.go", path: "internal/wal/wal.go", evidenceStatus: "source-verified" },
    { label: "internal/wal/limits.go", path: "internal/wal/limits.go", evidenceStatus: "source-verified" },
    { label: "internal/db/batch.go", path: "internal/db/batch.go", symbol: "batchFlusher, flushPendingBatch", evidenceStatus: "source-verified" },
    { label: "internal/db/flush.go", path: "internal/db/flush.go", symbol: "completeWalAfterFlush", evidenceStatus: "source-verified" },
    { label: "internal/db/wal_state.go", path: "internal/db/wal_state.go", symbol: "walFlushState, walReplayStartOffset", evidenceStatus: "source-verified" },
  ],

  evidenceStatus: "source-verified",
};

/** @type {import('../schema').ArchitectureDecision} */
export const memtableDecision = {
  id: "decision-memtable",
  nodeId: "active-mt",
  title: "Active Memtable (internal/memtable.SkipList)",
  category: "In-memory LSM State",
  sourcePath: "internal/memtable",
  summary: "The active memtable is a concurrent SkipList that accumulates applied WAL batch records in sorted key order. It is the first layer queried on Get and Scan, and the source of data for SST flush.",

  responsibility: {
    owns: [
      "Storing applied mutations (Put as key-value, Delete as tombstone) in sorted key order",
      "Concurrent-safe reads and writes (sync.RWMutex)",
      "Tracking approximate byte size for flush threshold comparison (Size())",
      "Providing sorted iteration (Iterator) for SST flush",
      "Providing point-in-time snapshot (Snapshot) for range scan without holding locks",
    ],
    doesNotOwn: [
      "WAL writes — that is internal/db/batch.go",
      "Deciding when to flush — that is internal/db.maybeFlushLocked",
      "Writing to disk — that is internal/db.flushImmutable via internal/sstable",
    ],
    details: "The active memtable is a *memtable.SkipList instance held at db.active. It is never written to disk directly — it is iterated by flushImmutable and its contents are written as an SSTable.",
  },

  whyItExists: {
    problem: "SST files are immutable and expensive to write — you cannot append a single key-value pair to an SST. Yet writes must return quickly.",
    constraint: "All mutations must be buffered in sorted order in RAM so they can be written to a sorted SST in one pass. They must also be searchable for concurrent reads.",
    decision: "Use an in-memory concurrent SkipList as the write buffer. It accepts unsorted writes efficiently (O(log n) insert), maintains sorted order for sequential flush, and supports concurrent readers via a RWMutex.",
    result: "Writes land in RAM in O(log n). Reads find the latest value for a key in O(log n). Flush iterates in sorted order in O(n).",
  },

  classification: {
    level: "HLD + LLD",
    explanation: "HLD: the memtable is the volatile, in-memory write buffer — a fundamental LSM-tree structural element. LLD: the choice of SkipList (vs B-tree or red-black tree), the maxHeight=20, probability p=0.25, in-place tombstones, and approximate size tracking are concrete implementation choices.",
  },

  hld: {
    architecturalRole: "Volatile write buffer and first read layer in the LSM stack.",
    upstream: ["batch-flusher"],
    downstream: ["pending-flush", "flusher"],
    dataOwnership: ["All key-value pairs and tombstones applied since the last memtable swap"],
    persistenceResponsibility: "None — all memtable state is volatile. Durability comes from the WAL.",
    concurrencyResponsibility: "sync.RWMutex: Put/Delete hold full write Lock; Get holds RLock; Iterator and Snapshot take a read snapshot.",
    failureBoundary: "Crash destroys all in-memory data. WAL provides recovery.",
    lifecycle: "Created by memtable.NewSkipList() on Open and on each swap (maybeFlushLocked). Frozen (moved to pendingFlush) when Size() > memtableSize (default 4 MiB). Iterated and discarded by flusher after SST is written.",
  },

  lld: {
    implementation: [
      "SkipList struct (skiplist.go): {mu sync.RWMutex, head *node, height int, length int, size int64, rng *rand.Rand}",
      "maxHeight = 20 levels, promotion probability p = 0.25",
      "Put: acquires write lock, descends to find insert position, updates existing node or inserts new node with randomHeight(). Copies key+value to avoid aliasing.",
      "Delete: acquires write lock, marks existing node with tombstone=true, value=nil. If key absent, inserts a tombstone node.",
      "Get: acquires read lock, descends, returns (valueCopy, found, isTombstone).",
      "Size(): read-locked approximate byte count. Counts key+value+8 bytes overhead per entry. Used ONLY for flush threshold — not exact.",
      "Snapshot(): returns []SnapshotEntry sorted by key. Used by Scan to take a point-in-time copy without holding the lock.",
    ],
    dataStructures: [
      "node struct: {key []byte, value []byte, tombstone bool, next []*node}",
      "SnapshotEntry: {Key []byte, Value []byte, Tombstone bool}",
    ],
    concurrency: [
      "sync.RWMutex: Put/Delete hold write lock, Get/Size/Len/Iterator hold read lock",
      "No compare-and-swap: all operations are mutex-guarded",
      "Snapshot() copies entries under read lock into a plain slice — safe to use after lock release",
    ],
    errorHandling: [
      "No error returns from Put/Delete/Get — SkipList never fails internally",
      "Size() is approximate — only used for threshold comparison, not exact accounting",
    ],
    sourceReferences: [
      {
        label: "SkipList struct and constants",
        path: "internal/memtable/skiplist.go",
        symbol: "SkipList",
        lineStart: 9,
        lineEnd: 22,
        evidenceStatus: "source-verified",
      },
      {
        label: "Put — insert or update",
        path: "internal/memtable/skiplist.go",
        symbol: "Put",
        lineStart: 45,
        lineEnd: 95,
        evidenceStatus: "source-verified",
      },
      {
        label: "Delete — in-place tombstone",
        path: "internal/memtable/skiplist.go",
        symbol: "Delete",
        lineStart: 123,
        lineEnd: 166,
        evidenceStatus: "source-verified",
      },
      {
        label: "Size — approximate byte count",
        path: "internal/memtable/skiplist.go",
        symbol: "Size",
        lineStart: 168,
        lineEnd: 174,
        evidenceStatus: "source-verified",
      },
    ],
  },

  rationale: {
    evidenceStatus: "source-verified",
    selectedApproach: "Concurrent SkipList with RWMutex, maxHeight=20, p=0.25, in-place tombstones.",
    whyItFits: [
      "SkipList provides O(log n) insert/search in a sorted structure — same asymptotic complexity as a balanced BST but simpler to implement correctly with concurrent access.",
      "In-place tombstones (value=nil, tombstone=true) avoid a second lookup during flush or scan — the tombstone is preserved and written to the SST.",
      "Approximate size (Size()) is sufficient for the flush threshold — it does not need to be exact, only monotonically increasing per write.",
      "Snapshot() enables lock-free range scans: once the snapshot is taken, the scan holds no locks.",
    ],
    acceptedTradeoffs: [
      "sync.RWMutex: writes are serialized. High write concurrency is not supported at the memtable level.",
      "Approximate size accounting: the flush threshold (4 MiB) may be exceeded slightly before swap occurs.",
      "SkipList is probabilistic: worst-case O(n) for an adversarial key sequence, though this is not a practical concern with random promotion.",
      "Tombstones persist in the memtable and in SSTs until compaction. Deleted keys occupy memory until flush and disk space until compaction.",
    ],
  },

  alternatives: [
    {
      name: "Red-black tree (e.g., Go's sort.Search on a sorted slice)",
      status: "plausible-alternative",
      advantages: ["Deterministic O(log n) worst case (no probability)"],
      disadvantages: ["Harder to implement correctly with concurrent access; rebalancing under a RWMutex has high lock contention"],
      fitForPebbleDB: "Not implemented. SkipList is a common LSM memtable choice for its simplicity with concurrent access.",
      evidenceStatus: "theoretical",
    },
    {
      name: "Hash map (for O(1) point lookups)",
      status: "plausible-alternative",
      advantages: ["O(1) average Get"],
      disadvantages: ["No sorted order — cannot support ordered flush or range scans without sorting on flush"],
      fitForPebbleDB: "Incompatible with LSM design: sorted order is required for SST generation and Scan.",
      evidenceStatus: "theoretical",
    },
  ],

  qualityImpacts: [
    {
      quality: "Write throughput",
      direction: "moderate-positive",
      explanation: "In-memory writes are fast (O(log n) SkipList insert). The bottleneck is WAL fsync, not memtable insertion. NOT YET MEASURED.",
      evidenceStatus: "source-verified",
    },
    {
      quality: "Write latency",
      direction: "moderate-positive",
      explanation: "Memtable write itself is in-memory and microsecond-scale. Overall write latency is dominated by WAL fsync. NOT YET MEASURED.",
      evidenceStatus: "source-verified",
    },
    {
      quality: "Point-read latency",
      direction: "moderate-positive",
      explanation: "Active memtable is checked before any SST read. A cache-warm memtable hit avoids all disk I/O. NOT YET MEASURED.",
      evidenceStatus: "source-verified",
    },
    {
      quality: "Memory usage",
      direction: "context-dependent",
      explanation: "Memtable is bounded by memtableSize (default 4 MiB). Tombstones occupy memory until flush. Multiple frozen memtables can be queued in pendingFlush under flush pressure. NOT YET MEASURED.",
      evidenceStatus: "source-verified",
    },
    {
      quality: "Recovery time",
      direction: "context-dependent",
      explanation: "Larger active memtable = more WAL records to replay on recovery. Bounded by memtableSize. NOT YET MEASURED.",
      evidenceStatus: "source-verified",
    },
  ],

  metrics: [
    {
      name: "SkipList max height",
      value: 20,
      unit: "levels",
      evidenceType: "configured",
      source: {
        label: "internal/memtable/skiplist.go — maxHeight",
        path: "internal/memtable/skiplist.go",
        symbol: "maxHeight",
        lineStart: 10,
        lineEnd: 10,
        evidenceStatus: "source-verified",
      },
    },
    {
      name: "SkipList level promotion probability",
      value: 0.25,
      unit: "probability",
      evidenceType: "configured",
      source: {
        label: "internal/memtable/skiplist.go — p",
        path: "internal/memtable/skiplist.go",
        symbol: "p",
        lineStart: 11,
        lineEnd: 11,
        evidenceStatus: "source-verified",
      },
    },
    {
      name: "Flush threshold (memtableSize default)",
      value: 4,
      unit: "MiB",
      evidenceType: "configured",
      source: {
        label: "internal/db/db.go — defaultMemtableSize",
        path: "internal/db/db.go",
        symbol: "defaultMemtableSize",
        lineStart: 23,
        lineEnd: 23,
        evidenceStatus: "source-verified",
      },
    },
    {
      name: "Memtable write throughput",
      evidenceType: "not-measured",
    },
    {
      name: "Memtable point-read latency",
      evidenceType: "not-measured",
    },
  ],

  failureWithoutComponent: [
    "Without an in-memory write buffer, every write would require an immediate SST file creation — thousands of tiny SST files would accumulate.",
    "Without sorted in-memory state, range scans would require merging all SSTs on every query, dramatically increasing read amplification.",
    "Without memtable tombstones, deletes would leave stale values visible in older SSTs until compaction removes them.",
  ],

  failureModes: [
    {
      name: "Memtable overflow (write faster than flush)",
      status: "partially-handled",
      explanation: "maybeFlushLocked enqueues to pendingFlush when active.Size() > memtableSize and creates a new active memtable. Multiple frozen memtables can queue. blockWritesOnFlushError (default true) eventually blocks writes if flusher is permanently failing. No explicit backpressure on pendingFlush queue depth.",
      sources: [
        { label: "internal/db/flush.go — maybeFlushLocked", path: "internal/db/flush.go", symbol: "maybeFlushLocked", evidenceStatus: "source-verified" },
        { label: "internal/db/bg_errors.go — writeBlockingBackgroundErr", path: "internal/db/bg_errors.go", evidenceStatus: "source-verified" },
      ],
    },
    {
      name: "Crash before memtable flush",
      status: "handled",
      explanation: "Active memtable data is always preceded by WAL fsync. On restart, WAL replay (from walReplayStartOffset) reconstructs the active memtable.",
      sources: [
        { label: "internal/db/db.go — Open, WAL replay", path: "internal/db/db.go", symbol: "Open", lineStart: 209, lineEnd: 216, evidenceStatus: "source-verified" },
      ],
    },
  ],

  relatedNodes: ["batch-flusher", "pending-flush", "flusher", "wal", "memtable-pkg", "active-mt"],

  sources: [
    { label: "internal/memtable/skiplist.go", path: "internal/memtable/skiplist.go", evidenceStatus: "source-verified" },
    { label: "internal/db/db.go — db.active field", path: "internal/db/db.go", symbol: "DB.active", evidenceStatus: "source-verified" },
    { label: "internal/db/flush.go — maybeFlushLocked", path: "internal/db/flush.go", symbol: "maybeFlushLocked", evidenceStatus: "source-verified" },
    { label: "internal/db/batch.go — applyRecordToMemtable", path: "internal/db/batch.go", symbol: "applyRecordToMemtable", evidenceStatus: "source-verified" },
  ],

  evidenceStatus: "source-verified",
};

/** @type {import('../schema').ArchitectureDecision} */
export const memtablePkgDecision = {
  ...memtableDecision,
  id: "decision-memtable-pkg",
  nodeId: "memtable-pkg",
  title: "Memtable Package (internal/memtable)",
};


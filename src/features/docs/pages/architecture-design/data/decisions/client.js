/**
 * Architecture decision records for PebbleDB's Client layer.
 *
 * Evidence sources (SOURCE VERIFIED):
 *   cmd/pebbledb/cli.go, cmd/pebbledb/main.go
 *   internal/db/db.go (Open, Options, Put, Get, Delete, Scan, Sync, Close)
 *   internal/db/write.go (writeRecord, writeBlockingBackgroundErr)
 *   internal/db/get.go (Get, lookupPendingBatch, lookupMemtable)
 *   internal/db/scan.go (Scan, ScanIterator)
 *   internal/db/sync.go (Sync)
 *   internal/db/close.go (Close)
 *   internal/db/errors.go (ErrClosed, ErrNotFound, ErrDatabaseLocked)
 */

/** @type {import('../data/schema').ArchitectureDecision} */
export const cliDecision = {
  id: "decision-cli",
  nodeId: "cli",
  title: "Command-Line Client",
  category: "Client",
  sourcePath: "cmd/pebbledb",
  summary: "A thin CLI wrapper that parses user commands and delegates to the internal/db API. It does not contain storage logic.",

  responsibility: {
    owns: [
      "Command-line argument parsing",
      "Formatting output for human consumption",
      "Selecting which internal/db API method to call",
    ],
    doesNotOwn: [
      "Storage logic — all write, read, and recovery is in internal/db",
      "WAL management",
      "Memtable management",
      "Concurrency control",
    ],
    details: "cmd/pebbledb is the outer shell that translates CLI commands into db.Put, db.Get, db.Delete, or db.Scan calls. All engine behavior is in internal/db.",
  },

  whyItExists: {
    problem: "The internal/db package is a library API, not directly invocable from a terminal.",
    constraint: "PebbleDB is an embedded engine — it has no network server. The only interactive entry point is a process-local CLI.",
    decision: "Provide a minimal CLI that opens the database and translates string commands into API calls.",
    result: "Users can interact with PebbleDB from the command line for testing and development without writing Go code.",
  },

  classification: {
    level: "HLD",
    explanation: "cmd/pebbledb is a deployment and UX boundary, not an implementation concern. It defines how external actors reach the engine, not how the engine works internally.",
  },

  hld: {
    architecturalRole: "Process entry point and single client of the internal/db API.",
    upstream: [],
    downstream: ["api"],
    dataOwnership: ["Holds db.Options at startup"],
    controlOwnership: ["Parses flags; directs to appropriate db.* method"],
    persistenceResponsibility: "None — delegates entirely to internal/db",
    concurrencyResponsibility: "None — single-threaded CLI, single command per invocation",
    failureBoundary: "CLI exits with non-zero status if db.Open or any API call returns an error.",
    lifecycle: "Opens database on start; closes on exit.",
  },

  rationale: {
    evidenceStatus: "source-verified",
    selectedApproach: "Thin wrapper with no embedded logic.",
    whyItFits: [
      "Keeps the engine API clean: internal/db is testable without a CLI.",
      "CLI can be replaced or omitted entirely — the engine works as a library without it.",
    ],
    acceptedTradeoffs: [
      "No network access. Cannot be queried remotely without a separate server layer.",
      "No interactive REPL by default — one command per invocation.",
    ],
  },

  alternatives: [
    {
      name: "Embedded REPL (interactive shell)",
      status: "plausible-alternative",
      advantages: ["More convenient for iterative manual testing"],
      disadvantages: ["More code to maintain; not needed for an embedded engine"],
      fitForPebbleDB: "Not implemented; the current single-command CLI is sufficient for a library-focused engine.",
      evidenceStatus: "theoretical",
    },
    {
      name: "HTTP/gRPC server",
      status: "plausible-alternative",
      advantages: ["Enables remote access"],
      disadvantages: ["Adds significant complexity; contradicts the single-process embedded design"],
      fitForPebbleDB: "Not implemented and not consistent with the embedded design goal.",
      evidenceStatus: "theoretical",
    },
  ],

  qualityImpacts: [
    {
      quality: "Implementation complexity",
      direction: "strong-positive",
      explanation: "Thin wrapper keeps the engine API clean and independently testable.",
      evidenceStatus: "source-verified",
    },
  ],

  failureWithoutComponent: [
    "No interactive access to PebbleDB without writing a custom Go program.",
    "Engine library is still fully functional — this is a UX tool, not a core engine component.",
  ],

  sources: [
    {
      label: "cmd/pebbledb/cli.go",
      path: "cmd/pebbledb/cli.go",
      description: "CLI command dispatch",
      evidenceStatus: "source-verified",
    },
    {
      label: "cmd/pebbledb/main.go",
      path: "cmd/pebbledb/main.go",
      description: "Entry point",
      evidenceStatus: "source-verified",
    },
  ],

  evidenceStatus: "source-verified",
};

/** @type {import('../data/schema').ArchitectureDecision} */
export const apiDecision = {
  id: "decision-api",
  nodeId: "api",
  title: "Database API (internal/db)",
  category: "Core Engine",
  sourcePath: "internal/db",
  summary: "The central engine package. Owns the DB struct, all concurrency primitives, the write pipeline, read pipeline, background worker channels, recovery logic, and the public API surface.",

  responsibility: {
    owns: [
      "Public API: Open, Close, Put, Get, Delete, Scan, Sync, BackgroundError",
      "DB struct and all fields: db.mu (sync.RWMutex), db.active, db.pendingFlush, db.sstables, db.sstablesSnap",
      "Write pipeline coordination (pendingBatch, batchFlusher goroutine, maybeFlushLocked)",
      "Read coordination (Get lookups, Scan MergeIterator construction)",
      "Recovery sequence (acquireDirLock, manifest.Open, loadSSTables, removeOrphanSSTFiles, walReplayStartOffset, ReplayFromWithRecovery)",
      "Background worker lifecycle (goroutine start/stop on Open/Close)",
      "Background error propagation (bgErrs, writeBlockingBackgroundErr)",
    ],
    doesNotOwn: [
      "WAL encoding — internal/wal",
      "SkipList data structure — internal/memtable",
      "SST file format — internal/sstable",
      "Manifest record encoding — internal/manifest",
      "Merge iterator logic — internal/iterator",
      "Bloom filter logic — internal/bloom",
    ],
    details: "internal/db is the integration layer. It assembles every sub-package into a functional storage engine and exposes a single coherent API.",
  },

  whyItExists: {
    problem: "An LSM storage engine requires coordinating writes, reads, background flushes, compaction, and recovery across multiple sub-packages. Without a central coordinator, each subsystem would need to know about the others.",
    constraint: "PebbleDB is an embedded engine: one package must own the overall state and provide a clean external API.",
    decision: "Create internal/db as the authoritative owner of engine state. All other packages are pure libraries with no DB struct dependency.",
    result: "Clean package boundaries: internal/wal, internal/memtable, internal/sstable, internal/manifest, internal/iterator, internal/bloom have no knowledge of internal/db.",
  },

  classification: {
    level: "HLD + LLD",
    explanation: "HLD: defines the system boundary and the coordination contract between all sub-packages. LLD: the DB struct fields, locking protocol, goroutine lifecycle, write and read paths are concrete implementation decisions.",
  },

  hld: {
    architecturalRole: "Central coordinator and public API surface for the entire storage engine.",
    upstream: ["cli"],
    downstream: ["active-mt", "pending-flush", "sst-list", "batch-flusher", "flusher", "compactor", "wal", "manifest", "iterator", "lock", "quarantine"],
    dataOwnership: [
      "db.active (*memtable.SkipList) — writable memtable",
      "db.pendingFlush ([]flushQueueEntry) — immutable memtable queue",
      "db.sstables ([]*sstable.Reader) — live SST reader list",
      "db.sstablesSnap (atomic.Pointer) — lock-free SST snapshot for reads",
      "db.pendingBatch ([]wal.Record) — in-flight WAL batch",
    ],
    controlOwnership: [
      "db.mu (sync.RWMutex) — guards all mutable state",
      "db.compactMu (sync.Mutex) — serializes compaction runs",
      "db.flushCh, db.compactCh, db.batchFlushCh — goroutine communication",
      "db.bgErrs — background error store",
    ],
    persistenceResponsibility: "None directly — delegates to internal/wal, internal/sstable, internal/manifest",
    concurrencyResponsibility: "Owns all locking: db.mu for writes/reads, compactMu for compaction, atomic snapshot for lock-free reads, batchPersistBarrier for Sync().",
    failureBoundary: "writeBlockingBackgroundErr blocks new writes when a fatal WAL error is recorded. blockWritesOnFlushError (default true) blocks writes after persistent flush failure.",
    lifecycle: "Open: lock → manifest.Open → loadSSTables → removeOrphanSSTFiles → WAL replay → wal.Open → start 3 goroutines → return. Close: stop goroutines → flush → close sub-packages → release lock.",
  },

  lld: {
    implementation: [
      "DB struct (db.go:30-69): 25 fields covering all state, channels, and configuration.",
      "writeRecord (write.go): acquires db.mu, appends to pendingBatch, calls scheduleBatchFlushLocked, optionally awaits batchPersist.",
      "Get (get.go): acquires db.mu.RLock, checks pendingBatch → active → pendingFlush (newest-first) → snapshotSSTables → lookupSSTReaders.",
      "Scan (scan.go): acquires db.mu.RLock, snapshots all memtable layers + SSTs, constructs MergeIterator, returns ScanIterator.",
      "publishSSTables (db.go:295-302): stores a copy of db.sstables into db.sstablesSnap via atomic.Pointer.Store.",
      "Open (db.go:108-237): full recovery sequence including walReplayStartOffset for bounded WAL replay.",
    ],
    dataStructures: [
      "flushQueueEntry: {mem *memtable.SkipList, walCutoff int64, retries int} — captures WAL cutoff at swap time",
      "backgroundErrStore: stores per-operation named errors",
      "batchPersistBarrier: mutex+cond for Sync() to wait for in-flight WAL batches",
    ],
    concurrency: [
      "db.mu (sync.RWMutex): Write path holds full Lock; Get/Scan hold RLock only while snapshotting",
      "db.sstablesSnap (atomic.Pointer[[]*sstable.Reader]): allows Get/Scan to release db.mu before SST reads",
      "db.compactMu: serializes concurrent compaction signals (compactCh capacity 8)",
      "db.batchFlushCh (capacity 1): coalesces timer-triggered batch flush signals",
      "db.flushCh (capacity 8): coalesced flush signals",
      "db.compactCh (capacity 8): coalesced compaction signals",
    ],
    stateTransitions: [
      "active memtable → pendingFlush: maybeFlushLocked when active.Size() > memtableSize",
      "pendingFlush → SST: flushImmutable in flusher goroutine",
      "SSTs → compacted SST: doCompaction in compactor goroutine",
    ],
    errorHandling: [
      "writeBlockingBackgroundErr: blocks writer if bgErrs has a WAL error",
      "blockWritesOnFlushError (default true): blocks writers after persistent flush failure",
      "Flush errors: logged, retried with exponential backoff (100ms → 2s)",
      "Compaction errors: logged, retried after 100ms",
    ],
    sourceReferences: [
      {
        label: "DB struct definition",
        path: "internal/db/db.go",
        symbol: "DB",
        lineStart: 30,
        lineEnd: 69,
        evidenceStatus: "source-verified",
      },
      {
        label: "Open — full recovery sequence",
        path: "internal/db/db.go",
        symbol: "Open",
        lineStart: 108,
        lineEnd: 237,
        evidenceStatus: "source-verified",
      },
      {
        label: "writeRecord — write pipeline entry",
        path: "internal/db/write.go",
        symbol: "writeRecord",
        evidenceStatus: "source-verified",
      },
      {
        label: "Get — read path",
        path: "internal/db/get.go",
        symbol: "Get",
        evidenceStatus: "source-verified",
      },
      {
        label: "Scan — range scan with MergeIterator",
        path: "internal/db/scan.go",
        symbol: "Scan",
        evidenceStatus: "source-verified",
      },
    ],
  },

  rationale: {
    evidenceStatus: "source-verified",
    selectedApproach: "Central coordinator with clean sub-package dependencies. Sub-packages (wal, memtable, sstable, manifest, iterator, bloom) have no knowledge of internal/db.",
    whyItFits: [
      "Sub-packages are independently testable without opening a DB.",
      "All concurrency policy lives in one place — easier to audit.",
      "Atomic snapshot (db.sstablesSnap) allows lock-free concurrent reads without duplicating locking in every SST reader.",
    ],
    acceptedTradeoffs: [
      "internal/db is a large package — db.go alone has 334 lines plus many files (batch.go, flush.go, compactor.go, get.go, scan.go, write.go, etc.).",
      "Any sub-package change that affects the DB struct requires changes here.",
    ],
  },

  alternatives: [
    {
      name: "Actor model (message-passing between sub-components)",
      status: "plausible-alternative",
      advantages: ["Decouples sub-package coordination", "Easier to add new workers"],
      disadvantages: ["Higher latency from channel round-trips", "More complex error propagation", "Go's sync primitives are well-suited to the current model"],
      fitForPebbleDB: "Not implemented. The current model is appropriate for a single-node embedded engine.",
      evidenceStatus: "theoretical",
    },
    {
      name: "Per-operation locking (optimistic concurrency)",
      status: "plausible-alternative",
      advantages: ["Higher write concurrency in theory"],
      disadvantages: ["Complex conflict detection; harder to audit correctness"],
      fitForPebbleDB: "Not implemented. The existing RWMutex model is simpler and sufficient for an embedded engine.",
      evidenceStatus: "theoretical",
    },
  ],

  qualityImpacts: [
    {
      quality: "Durability",
      direction: "strong-positive",
      explanation: "writeBlockingBackgroundErr ensures no writes proceed after a fatal WAL error. blockWritesOnFlushError (default true) prevents data from accumulating in memtables that cannot be flushed.",
      evidenceStatus: "source-verified",
    },
    {
      quality: "Write throughput",
      direction: "context-dependent",
      explanation: "db.mu is a single RWMutex. Write path holds a full Lock for pendingBatch mutation and memtable application. Read path holds RLock only briefly for snapshotting. Actual throughput is NOT YET MEASURED.",
      evidenceStatus: "source-verified",
    },
    {
      quality: "Read latency",
      direction: "moderate-positive",
      explanation: "Atomic SST snapshot (db.sstablesSnap) allows Get to release db.mu before SST binary search and block reads. Actual latency is NOT YET MEASURED.",
      evidenceStatus: "source-verified",
    },
    {
      quality: "Implementation complexity",
      direction: "moderate-negative",
      explanation: "internal/db is the largest and most complex package — it owns goroutine lifecycles, multi-layer locking, background error propagation, and recovery sequencing.",
      evidenceStatus: "source-verified",
    },
  ],

  metrics: [
    {
      name: "Default memtable size threshold",
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
      name: "Default block size",
      value: 4096,
      unit: "bytes",
      evidenceType: "configured",
      source: {
        label: "internal/db/db.go — defaultBlockSize",
        path: "internal/db/db.go",
        symbol: "defaultBlockSize",
        lineStart: 24,
        lineEnd: 24,
        evidenceStatus: "source-verified",
      },
    },
    {
      name: "Default compaction threshold (SST count)",
      value: 4,
      unit: "SST files",
      evidenceType: "configured",
      source: {
        label: "internal/db/compaction.go — defaultCompactThreshold",
        path: "internal/db/compaction.go",
        symbol: "defaultCompactThreshold",
        lineStart: 14,
        lineEnd: 14,
        evidenceStatus: "source-verified",
      },
    },
    {
      name: "Default block cache size",
      value: 32,
      unit: "MiB",
      evidenceType: "documented",
      source: {
        label: "internal/db/db.go — Options.BlockCacheSize comment",
        path: "internal/db/db.go",
        symbol: "Options.BlockCacheSize",
        lineStart: 86,
        lineEnd: 87,
        evidenceStatus: "documented",
      },
    },
    {
      name: "Write throughput",
      evidenceType: "not-measured",
    },
    {
      name: "Get latency",
      evidenceType: "not-measured",
    },
    {
      name: "Scan throughput",
      evidenceType: "not-measured",
    },
  ],

  failureWithoutComponent: [
    "Without internal/db there is no storage engine. All other packages are isolated libraries.",
    "The open/close/write/read/recover lifecycle would have no coordinator.",
  ],

  failureModes: [
    {
      name: "WAL append failure",
      status: "handled",
      explanation: "bgErrs records the error. writeBlockingBackgroundErr blocks subsequent writes. The WAL batch is restored to pendingBatch for retry.",
      sources: [
        { label: "internal/db/batch.go — flushPendingBatch error path", path: "internal/db/batch.go", symbol: "flushPendingBatch", evidenceStatus: "source-verified" },
      ],
    },
    {
      name: "Flush failure (SST write / manifest commit)",
      status: "handled",
      explanation: "drainPendingFlush retries with exponential backoff (100ms→2s). blockWritesOnFlushError (default true) eventually blocks new writes. The frozen memtable is not lost — it remains in pendingFlush.",
      sources: [
        { label: "internal/db/flush.go — drainPendingFlush", path: "internal/db/flush.go", symbol: "drainPendingFlush", evidenceStatus: "source-verified" },
      ],
    },
    {
      name: "Compaction failure",
      status: "handled",
      explanation: "compactor logs the error and retries after compactRetryDelay (100ms). No data is lost; the input SSTs remain live.",
      sources: [
        { label: "internal/db/compactor.go — compactor", path: "internal/db/compactor.go", symbol: "compactor", evidenceStatus: "source-verified" },
      ],
    },
    {
      name: "Directory already locked",
      status: "handled",
      explanation: "acquireDirLock returns ErrDatabaseLocked if another process holds the LOCK file. Open fails immediately.",
      sources: [
        { label: "internal/db/dir_lock.go — acquireDirLock", path: "internal/db/dir_lock.go", symbol: "acquireDirLock", evidenceStatus: "source-verified" },
      ],
    },
  ],

  relatedNodes: ["active-mt", "pending-flush", "sst-list", "batch-flusher", "flusher", "compactor", "wal", "manifest", "iterator", "lock", "quarantine"],

  sources: [
    { label: "internal/db/db.go", path: "internal/db/db.go", symbol: "DB, Open", evidenceStatus: "source-verified" },
    { label: "internal/db/write.go", path: "internal/db/write.go", symbol: "writeRecord", evidenceStatus: "source-verified" },
    { label: "internal/db/get.go", path: "internal/db/get.go", symbol: "Get", evidenceStatus: "source-verified" },
    { label: "internal/db/scan.go", path: "internal/db/scan.go", symbol: "Scan", evidenceStatus: "source-verified" },
    { label: "internal/db/batch.go", path: "internal/db/batch.go", symbol: "batchFlusher, flushPendingBatch", evidenceStatus: "source-verified" },
    { label: "internal/db/flush.go", path: "internal/db/flush.go", symbol: "flusher, drainPendingFlush", evidenceStatus: "source-verified" },
    { label: "internal/db/compactor.go", path: "internal/db/compactor.go", symbol: "compactor, doCompaction", evidenceStatus: "source-verified" },
  ],

  evidenceStatus: "source-verified",
};

/**
 * Operational flow definitions for PebbleDB.
 *
 * Each flow describes a complete operational path as a sequence of steps.
 * Each step references a node (component) and describes what happens.
 *
 * Evidence: SOURCE VERIFIED — derived from direct source inspection.
 */

/** @typedef {{ id: string, label: string, nodeId: string, description: string, codeRef?: { path: string, symbol?: string, lineStart?: number, lineEnd?: number } }} FlowStep */
/** @typedef {{ id: string, title: string, description: string, kind: 'write' | 'read' | 'flush' | 'compaction' | 'recovery', steps: FlowStep[] }} OperationalFlow */

/** @type {OperationalFlow[]} */
export const flows = [
  // ── WRITE PATH ──────────────────────────────────────────────────────────────
  {
    id: "flow-write",
    title: "Write Path (Put / Delete)",
    description: "How a Put or Delete operation travels from the API through the WAL to the active memtable.",
    kind: "write",
    steps: [
      {
        id: "w1",
        label: "1. Caller → writeRecord",
        nodeId: "api",
        description: "db.Put or db.Delete calls writeRecord(rec). writeRecord acquires db.mu (full write lock), appends to db.pendingBatch, increments db.batchSizeBytes, calls scheduleBatchFlushLocked (timer or forced flush if batch is full), then releases db.mu.",
        codeRef: { path: "internal/db/write.go", symbol: "writeRecord" },
      },
      {
        id: "w2",
        label: "2. batchFlusher wakes",
        nodeId: "batch-flusher",
        description: "The batchFlusher goroutine wakes on batchFlushCh (timer signal, typically ~1ms) or batchSyncCh (Sync() call). It calls flushPendingBatch().",
        codeRef: { path: "internal/db/batch.go", symbol: "batchFlusher", lineStart: 78, lineEnd: 96 },
      },
      {
        id: "w3",
        label: "3. WAL append + fsync",
        nodeId: "wal",
        description: "flushPendingBatch acquires db.mu, takes the pending batch (takePendingBatchLocked), releases db.mu, then calls wal.AppendBatch(batch). AppendBatch writes all records to wal.log and calls file.Sync() once. If Sync fails, the batch is restored to pendingBatch and the error is recorded in bgErrs.",
        codeRef: { path: "internal/wal/wal.go", symbol: "AppendBatch", lineStart: 60, lineEnd: 75 },
      },
      {
        id: "w4",
        label: "4. Apply to active memtable",
        nodeId: "active-mt",
        description: "After WAL fsync succeeds, flushPendingBatch re-acquires db.mu and calls applyRecordToMemtable for each record. Put calls db.active.Put(key, value). Delete calls db.active.Delete(key) (inserts tombstone).",
        codeRef: { path: "internal/db/batch.go", symbol: "applyRecordToMemtable", lineStart: 35, lineEnd: 41 },
      },
      {
        id: "w5",
        label: "5. maybeFlushLocked",
        nodeId: "pending-flush",
        description: "After applying the batch, flushPendingBatch calls maybeFlushLocked while still holding db.mu. If active.Size() > memtableSize (default 4 MiB), the active SkipList is frozen: walCutoff is recorded, the entry is appended to db.pendingFlush, and a new SkipList is installed as db.active.",
        codeRef: { path: "internal/db/flush.go", symbol: "maybeFlushLocked" },
      },
      {
        id: "w6",
        label: "6. Notify flusher (if threshold reached)",
        nodeId: "flusher",
        description: "If maybeFlushLocked returns shouldFlush=true, notifyFlush() sends a signal on flushCh (non-blocking, buffered capacity 8). The flusher goroutine picks it up asynchronously.",
        codeRef: { path: "internal/db/flush.go", symbol: "notifyFlush" },
      },
    ],
  },

  // ── READ PATH ───────────────────────────────────────────────────────────────
  {
    id: "flow-read",
    title: "Read Path (Get)",
    description: "How a Get operation searches across all LSM layers from newest to oldest.",
    kind: "read",
    steps: [
      {
        id: "r1",
        label: "1. Get — pendingBatch lookup",
        nodeId: "api",
        description: "db.Get acquires db.mu.RLock. First checks db.pendingBatch via lookupPendingBatch (reverse scan — newest record for key). If found as a value, returns it. If found as tombstone, returns ErrNotFound.",
        codeRef: { path: "internal/db/get.go", symbol: "Get" },
      },
      {
        id: "r2",
        label: "2. Active memtable lookup",
        nodeId: "active-mt",
        description: "If not in pendingBatch, Get calls db.active.Get(key). SkipList descends from maxHeight to level 0 under RLock. If found as value, returns a copy. If tombstone, returns ErrNotFound.",
        codeRef: { path: "internal/memtable/skiplist.go", symbol: "Get" },
      },
      {
        id: "r3",
        label: "3. pendingFlush search (newest-first)",
        nodeId: "pending-flush",
        description: "If not found in active, Get iterates db.pendingFlush from newest (tail) to oldest (head), calling lookupMemtable on each frozen SkipList. First hit wins.",
        codeRef: { path: "internal/db/get.go", symbol: "Get", lineStart: 44, lineEnd: 52 },
      },
      {
        id: "r4",
        label: "4. Snapshot SST readers (lock-free)",
        nodeId: "sst-list",
        description: "If not found in any memtable, Get calls db.snapshotSSTables() (atomic.Pointer load — no lock), Refs each reader, then releases db.mu.RUnlock. All SST I/O happens without holding db.mu.",
        codeRef: { path: "internal/db/get.go", symbol: "Get", lineStart: 54, lineEnd: 63 },
      },
      {
        id: "r5",
        label: "5. Bloom filter check",
        nodeId: "sstable",
        description: "For each SST reader (newest first), calls reader.MayContain(key). Uses the bloom.Filter embedded in the reader. If MayContain returns false, the block read is skipped — the key is definitely not in that SST.",
        codeRef: { path: "internal/sstable/reader.go", symbol: "MayContain", lineStart: 161, lineEnd: 166 },
      },
      {
        id: "r6",
        label: "6. Binary search index → block read",
        nodeId: "sstable",
        description: "If MayContain=true, reader.Get binary-searches the block index (sort.Search on IndexEntry.LastKey) to find the block, reads the block (from cache or disk via ReadAt), then scans the block linearly for the key.",
        codeRef: { path: "internal/sstable/reader.go", symbol: "Get", lineStart: 168, lineEnd: 194 },
      },
    ],
  },

  // ── FLUSH PATH ──────────────────────────────────────────────────────────────
  {
    id: "flow-flush",
    title: "Flush Path (Memtable → SST)",
    description: "How a frozen memtable is written to a sorted SSTable and committed to the manifest.",
    kind: "flush",
    steps: [
      {
        id: "f1",
        label: "1. flusher wakes on flushCh",
        nodeId: "flusher",
        description: "The flusher goroutine receives a signal from flushCh (buffered, capacity 8). Calls drainPendingFlush(), which loops until db.pendingFlush is empty.",
        codeRef: { path: "internal/db/flush.go", symbol: "flusher" },
      },
      {
        id: "f2",
        label: "2. Pop oldest frozen memtable",
        nodeId: "pending-flush",
        description: "drainPendingFlush acquires db.mu briefly to read db.pendingFlush[0] (oldest entry, captured walCutoff). Releases db.mu before SST I/O.",
        codeRef: { path: "internal/db/flush.go", symbol: "drainPendingFlush" },
      },
      {
        id: "f3",
        label: "3. Write SST file",
        nodeId: "sstable",
        description: "flushImmutable calls sstable.NewWriter(path, blockSize, bloomRate). Iterates the frozen SkipList via Iterator. For each entry, calls w.Add(key, value, tombstone). Closes the writer to flush blocks, index, bloom, and footer to sst_NNNNNNNN.sst.",
        codeRef: { path: "internal/db/flush.go", symbol: "flushImmutable" },
      },
      {
        id: "f4",
        label: "4. Commit to manifest (DURABILITY BOUNDARY)",
        nodeId: "manifest",
        description: "flushImmutable calls manifest.AppendNewFile(id). This fsyncs the manifest record. After this call, the SST is permanently part of the live set and must survive even if the process crashes next.",
        codeRef: { path: "internal/db/flush.go", symbol: "flushImmutable" },
      },
      {
        id: "f5",
        label: "5. Publish SST list",
        nodeId: "sst-list",
        description: "flushImmutable acquires db.mu, appends the new reader to db.sstables, pops db.pendingFlush[0], calls publishSSTables (atomic.Pointer update). The new SST is now visible to Get and Scan.",
        codeRef: { path: "internal/db/db.go", symbol: "publishSSTables" },
      },
      {
        id: "f6",
        label: "6. Truncate WAL",
        nodeId: "wal",
        description: "completeWalAfterFlush: writeWalFlushState(walCutoff, sstID), then wal.TruncateBefore(walCutoff) (copy-rename), then removeWalFlushState. WAL records before walCutoff are now redundant — the data is in the SST.",
        codeRef: { path: "internal/db/flush.go", symbol: "completeWalAfterFlush" },
      },
      {
        id: "f7",
        label: "7. Trigger compaction check",
        nodeId: "compactor",
        description: "After completeWalAfterFlush, flushImmutable calls maybeTriggerCompaction. If len(db.sstables) >= compactThreshold (default 4), signals compactCh.",
        codeRef: { path: "internal/db/compaction.go", symbol: "maybeTriggerCompaction" },
      },
    ],
  },

  // ── COMPACTION PATH ─────────────────────────────────────────────────────────
  {
    id: "flow-compaction",
    title: "Compaction Path (SST Merge)",
    description: "How oldest SSTables are merged to reclaim space and bound read amplification.",
    kind: "compaction",
    steps: [
      {
        id: "c1",
        label: "1. compactor wakes on compactCh",
        nodeId: "compactor",
        description: "The compactor goroutine receives a signal on compactCh (buffered, capacity 8). Acquires compactMu. Loops calling doCompaction while len(db.sstables) >= compactThreshold.",
        codeRef: { path: "internal/db/compactor.go", symbol: "compactor" },
      },
      {
        id: "c2",
        label: "2. Pick oldest N SSTs",
        nodeId: "sst-list",
        description: "pickSSTablesForCompactionLocked (under db.mu) picks db.sstables[0:compactPickCount] (default 2). These are the oldest files. Returns them and their manifest IDs for rollback.",
        codeRef: { path: "internal/db/compaction.go", symbol: "pickSSTablesForCompactionLocked" },
      },
      {
        id: "c3",
        label: "3. Merge SSTs",
        nodeId: "sstable",
        description: "mergeSSTables calls sstable.MergeReadersKeepTombstones(readers, newWriter). Uses a MergeIterator that preserves tombstones (callers of Scan see them filtered, but compaction must keep them to prevent resurrection of deleted keys from older non-merged SSTs).",
        codeRef: { path: "internal/db/compaction.go", symbol: "mergeSSTables" },
      },
      {
        id: "c4",
        label: "4. Commit new file set to manifest",
        nodeId: "manifest",
        description: "manifest.AppendSetFileSet(newListIDs) atomically replaces the live SST set. This is the compaction durability boundary. On success, the new merged SST is permanently live and the old SSTs are permanently retired.",
        codeRef: { path: "internal/db/compactor.go", symbol: "doCompaction" },
      },
      {
        id: "c5",
        label: "5. Publish new SST list",
        nodeId: "sst-list",
        description: "Under db.mu, db.sstables is replaced with the new list. publishSSTables updates the atomic snapshot. Get and Scan now use the merged SST.",
        codeRef: { path: "internal/db/db.go", symbol: "publishSSTables" },
      },
      {
        id: "c6",
        label: "6. Discard old readers (deferred delete)",
        nodeId: "sstable",
        description: "reader.Discard() is called on each compacted reader. Defers physical file deletion until all in-flight Ref holders (active Gets/Scans) call Unref. Prevents use-after-free on SST files.",
        codeRef: { path: "internal/sstable/reader.go", symbol: "Discard" },
      },
    ],
  },

  // ── RECOVERY PATH ──────────────────────────────────────────────────────────
  {
    id: "flow-recovery",
    title: "Recovery Path (Open after crash)",
    description: "How PebbleDB reconstructs a consistent state after a crash or unclean shutdown.",
    kind: "recovery",
    steps: [
      {
        id: "rec1",
        label: "1. Acquire directory lock",
        nodeId: "lock",
        description: "acquireDirLock creates LOCK file and applies exclusive OS lock (flock/LockFileEx). Returns ErrDatabaseLocked if another process holds it. This is the first action on Open.",
        codeRef: { path: "internal/db/dir_lock.go", symbol: "acquireDirLock" },
      },
      {
        id: "rec2",
        label: "2. Open manifest + rebuild live SST set",
        nodeId: "manifest",
        description: "manifest.Open reads CURRENT, opens MANIFEST-NNNNNN, replays all records to rebuild liveSet. Truncates trailing partial record (salvageManifestTail). The live SST set is now known.",
        codeRef: { path: "internal/manifest/manifest.go", symbol: "Open, replay" },
      },
      {
        id: "rec3",
        label: "3. Bootstrap manifest if empty",
        nodeId: "manifest",
        description: "If the manifest liveSet is empty but SST files exist on disk, manifest.BootstrapIfEmpty records them. This handles upgrading directories created before manifest tracking was added.",
        codeRef: { path: "internal/manifest/manifest.go", symbol: "BootstrapIfEmpty" },
      },
      {
        id: "rec4",
        label: "4. Load live SST readers",
        nodeId: "sst-list",
        description: "loadSSTables opens an sstable.Reader for each ID in manifest.LiveIDs(). Loads their footer, block index, and bloom filter into memory. publishSSTables makes them available.",
        codeRef: { path: "internal/db/db.go", symbol: "loadSSTables" },
      },
      {
        id: "rec5",
        label: "5. Quarantine orphan SST files",
        nodeId: "quarantine",
        description: "removeOrphanSSTFiles discovers all sst_*.sst files in the directory. Any file NOT in manifest.LiveIDs() is renamed into quarantine/. Not deleted — preserved for inspection.",
        codeRef: { path: "internal/db/sst_cleanup.go", symbol: "removeOrphanSSTFiles" },
      },
      {
        id: "rec6",
        label: "6. Read wal.flush checkpoint",
        nodeId: "wal-flush",
        description: "walReplayStartOffset reads wal.flush (if present). If SSTID is in the manifest, replay starts at FreezeOffset (skipping WAL bytes already captured in the SST). If absent or invalid, replay starts at 0.",
        codeRef: { path: "internal/db/wal_state.go", symbol: "walReplayStartOffset" },
      },
      {
        id: "rec7",
        label: "7. Replay WAL into active memtable",
        nodeId: "active-mt",
        description: "wal.ReplayFromWithRecovery(walPath, limits, startOffset, fn) replays WAL records starting at startOffset. Each valid record is applied to db.active (Put or Delete). A trailing partial record (crash mid-write) is truncated and ignored — correct behavior.",
        codeRef: { path: "internal/wal/wal.go", symbol: "ReplayFromWithRecovery" },
      },
      {
        id: "rec8",
        label: "8. Start background goroutines",
        nodeId: "api",
        description: "After recovery, Open starts go db.batchFlusher(), go db.flusher(), and go db.compactor(). The database is now operational.",
        codeRef: { path: "internal/db/db.go", symbol: "Open", lineStart: 226, lineEnd: 231 },
      },
    ],
  },
];

/** @returns {Map<string, OperationalFlow>} */
export function getFlowMap() {
  return new Map(flows.map((f) => [f.id, f]));
}

/** @returns {string[]} Node IDs that participate in a given flow */
export function getFlowNodeIds(flowId) {
  const flow = flows.find((f) => f.id === flowId);
  if (!flow) return [];
  return [...new Set(flow.steps.map((s) => s.nodeId))];
}

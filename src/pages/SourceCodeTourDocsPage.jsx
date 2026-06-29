import React from "react";
import DocsNavbar from "../components/DocsNavbar";
import DocsSidebar from "../components/DocsSidebar";
import GoCodeBlock from "../components/GoCodeBlock";

const pageTopics = [
  { label: "1. Database Initialization", href: "#db-init" },
  { label: "2. Group Commit", href: "#group-commit" },
  { label: "3. Memtable Flush", href: "#memtable-flush" },
  { label: "4. Background Compaction", href: "#bg-compaction" },
  { label: "5. Read Path", href: "#read-path" },
];

const CODE_OPEN = `func Open(opts Options) (*DB, error) {
	// ... directory verification and creation ...
	dirLock, err := acquireDirLock(opts.Dir) // Invariant R1: flock file locking
	if err != nil { return nil, err }
	
	// ... load configuration defaults and create DB struct ...
	m, err := manifest.Open(opts.Dir) // Open/create MANIFEST log
	if err != nil { return nil, err }
	db.manifest = m
	existing, err := discoverSSTIDs(opts.Dir) // Read candidate SST files from disk
	if err != nil { ... }
	
	// Invariant D3: Manifest defines live set. Bootstrap if database is upgraded
	if err := db.manifest.BootstrapIfEmpty(existing); err != nil { ... }
	if err := db.loadSSTables(); err != nil { ... } // Load live readers from manifest IDs
	db.removeOrphanSSTFiles() // Invariant R2: Move untracked SSTs to quarantine/
	walPath := filepath.Join(opts.Dir, "wal.log")
	replayStart, err := db.walReplayStartOffset() // Invariant R4/D5: Check wal.flush checkpoint
	if err != nil { ... }
	
	// Invariant R3: Bounded WAL Replay, salvage partial tail records
	_, err = wal.ReplayFromWithRecovery(walPath, walLimits, replayStart, func(rec wal.Record) error {
		if rec.Tombstone {
			db.active.Delete(rec.Key)
		} else {
			db.active.Put(rec.Key, rec.Value)
		}
		return nil
	})
	
	w, err := wal.OpenWithLimits(walPath, walLimits) // Open WAL in append mode
	if err != nil { ... }
	db.wal = w
	// Start background workers
	go db.batchFlusher()
	go db.flusher()
	go db.compactor()
	db.maybeTriggerCompaction()
	
	return db, nil
}`;

const CODE_FLUSH_PENDING = `func (db *DB) flushPendingBatch() error {
	db.mu.Lock()
	if len(db.pendingBatch) == 0 {
		db.mu.Unlock(); return nil
	}
	batch := db.pendingBatch
	db.pendingBatch = make([]wal.Record, 0, batchMaxRecords) // Invariant W1: Swap buffer
	db.mu.Unlock()
	// Append batch to WAL and fsync (Durability boundary)
	err := db.wal.AppendBatch(batch)
	db.mu.Lock()
	if err != nil {
		// Restore batch if write failed
		db.restorePendingBatchLocked(batch)
		db.mu.Unlock()
		return err
	}
	db.mu.Unlock()
	// Signal batch flusher that writes are completed and safe
	db.batchPersist.complete()
	return nil
}`;

const CODE_FLUSH_IMM = `func (db *DB) flushImmutable(imm *memtable.SkipList, walCutoff int64) error {
	id := atomic.AddUint64(&db.nextSSTID, 1)
	path := filepath.Join(db.dir, fmt.Sprintf("sst_%08d.sst", id))
	// Invariant D6: Write to .tmp, close fully, then open reader
	w, err := sstable.NewWriter(path, defaultBlockSize, expectedEntries)
	// ... iterate SkipList and call w.Add() ...
	if err := w.Close(); err != nil { ... }
	r, err := sstable.OpenReader(path, db.blockCache)
	if err != nil { ... }
	// Invariant D4: Commit to manifest before swapping memory
	if err := db.manifest.AppendNewFile(id); err != nil {
		r.Close(); os.Remove(path); return err
	}
	db.mu.Lock()
	db.sstables = append(db.sstables, r)
	db.publishSSTables() // Publish updated active readers slice
	db.mu.Unlock()
	db.trackReader(r) // Track for global shutdown closures
	// Invariant D5: Checkpoint wal.flush and truncate WAL
	if err := db.completeWalAfterFlush(walCutoff, id); err != nil {
		db.setBackgroundErr("wal_cleanup", err)
	}
	db.maybeTriggerCompaction()
	return nil
}`;

const CODE_COMPACTION = `func (db *DB) doCompaction() error {
	db.mu.Lock()
	toCompact := db.pickSSTablesForCompactionLocked() // Select oldest 2 SSTables
	if len(toCompact) < 2 {
		db.mu.Unlock(); return nil
	}
	// ... copy pick state under lock ...
	db.mu.Unlock() // Unlock db.mu during merge to unblock reads/writes
	newReader, _, err := db.mergeSSTables(compReaders) // Merge files (disk I/O)
	if err != nil { return err }
	db.mu.Lock()
	// Concurrency Check: Verify picked files haven't changed
	if !readersStillPresent(db.sstables, compReaders) {
		db.mu.Unlock(); newReader.Close(); os.Remove(newReader.Path()); return nil
	}
	// Update list: remove compacted files, append merged file
	newList := buildNewSSTList(db.sstables, compReaders, newReader)
	db.mu.Unlock()
	// Invariant D4: Manifest SetFileSet write before memory update
	if err := db.manifest.AppendSetFileSet(liveIDs); err != nil {
		newReader.Close(); os.Remove(newReader.Path()); return err
	}
	db.mu.Lock()
	if !readersStillPresent(db.sstables, compReaders) {
		db.manifest.AppendSetFileSet(oldLiveIDs) // Roll back manifest if check fails
		db.mu.Unlock(); newReader.Close(); os.Remove(newReader.Path()); return nil
	}
	db.sstables = newList
	db.publishSSTables() // Publish memory swap
	db.mu.Unlock()
	db.trackReader(newReader)
	// Invariant V2: Discard compacted inputs (deferred deletion until refs reach zero)
	for _, r := range compReaders {
		r.Discard()
	}
	return nil
}`;

const CODE_GET = `func (db *DB) Get(key []byte) ([]byte, error) {
	// 1. Search volatile memory layers
	if val, found, tomb := lookupPendingBatch(db.pendingBatch, key); found { ... }
	if val, found, tomb := db.active.Get(key); found { ... }
	db.mu.RLock()
	// Copy snapshot of live SST readers and increment refs under lock
	snap := db.snapshotSSTables()
	for _, r := range snap { r.Ref() }
	db.mu.RUnlock()
	defer func() {
		for _, r := range snap { r.Unref() } // Invariant V2: Decrement refs outside lock
	}()
	// 2. Iterate SST readers (newest first)
	for _, r := range snap {
		if val, found, tomb, err := r.Get(key); found {
			if tomb { return nil, ErrNotFound }
			return val, nil
		}
	}
	return nil, ErrNotFound
}`;

const CODE_SCAN = `func (db *DB) Scan(start, end []byte) (Iterator, error) {
	db.mu.Lock()
	defer db.mu.Unlock()
	// Invariant V3: Snapshot memtable node pointers under lock to unblock writes
	activeSnap := db.active.Snapshot()
	pendingSnap := make([]*memtable.SkipList, len(db.pendingFlush))
	for i, entry := range db.pendingFlush {
		pendingSnap[i] = entry.mem.Snapshot()
	}
	// Ref live SST readers to prevent closed-handle errors during scan
	ssts := db.snapshotSSTables()
	for _, r := range ssts { r.Ref() }
	// Create merge iterator over memtable copies + ref-pinned SSTs
	return NewScanIterator(activeSnap, pendingSnap, ssts, start, end), nil
}`;

export default function SourceCodeTourDocsPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="source-code-tour-title">
              PebbleDB Subsystem: Source Code Tour
            </h1>

            <div className="guide-body-text" style={{ marginTop: 24 }}>
              <p>
                This document provides a line-level walkthrough of the core code paths in PebbleDB, highlighting design choices, invariants, and implementation patterns.
              </p>

              {/* ── 1. Database Initialization ── */}
              <h2 className="guide-sub-heading" id="db-init" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                1. Database Initialization Tour
              </h2>
              <p>
                Located in <code className="inline-code">db.go</code> inside the <code className="inline-code">Open</code> function:
              </p>
              <GoCodeBlock>{CODE_OPEN}</GoCodeBlock>

              {/* ── 2. Group Commit Tour ── */}
              <h2 className="guide-sub-heading" id="group-commit" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                2. Group Commit Tour
              </h2>
              <p>
                Located in <code className="inline-code">batch.go</code> inside the <code className="inline-code">flushPendingBatch</code> function:
              </p>
              <GoCodeBlock>{CODE_FLUSH_PENDING}</GoCodeBlock>

              {/* ── 3. Memtable Flush Tour ── */}
              <h2 className="guide-sub-heading" id="memtable-flush" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                3. Memtable Flush Tour
              </h2>
              <p>
                Located in <code className="inline-code">flush.go</code> inside the <code className="inline-code">flushImmutable</code> function:
              </p>
              <GoCodeBlock>{CODE_FLUSH_IMM}</GoCodeBlock>

              {/* ── 4. Background Compaction Tour ── */}
              <h2 className="guide-sub-heading" id="bg-compaction" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                4. Background Compaction Tour
              </h2>
              <p>
                Located in <code className="inline-code">compactor.go</code> inside the <code className="inline-code">doCompaction</code> function:
              </p>
              <GoCodeBlock>{CODE_COMPACTION}</GoCodeBlock>

              {/* ── 5. Read Path Tour ── */}
              <h2 className="guide-sub-heading" id="read-path" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                5. Read Path Tour
              </h2>

              <h3 style={{ color: "#ffffff", marginTop: 16 }}>5.1 Point Lookup (Get)</h3>
              <p>
                Located in <code className="inline-code">get.go</code>:
              </p>
              <GoCodeBlock>{CODE_GET}</GoCodeBlock>

              <h3 style={{ color: "#ffffff", marginTop: 16 }}>5.2 Range Scan Snapshot</h3>
              <p>
                Located in <code className="inline-code">scan.go</code>:
              </p>
              <GoCodeBlock>{CODE_SCAN}</GoCodeBlock>

            </div>
          </div>
        </main>

        <aside className="guide-sidebar-right" aria-label="Page Outline">
          <div className="guide-sidebar-right-content">
            <h4 className="guide-sidebar-right-title">Outline</h4>
            <ul className="guide-sidebar-right-list">
              {pageTopics.map((topic) => (
                <li key={topic.label} className="guide-sidebar-right-item">
                  <a href={topic.href} className="guide-sidebar-right-link">
                    {topic.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

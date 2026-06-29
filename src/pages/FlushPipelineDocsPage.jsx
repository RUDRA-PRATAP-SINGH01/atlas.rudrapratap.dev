import React from "react";
import DocsNavbar from "../components/DocsNavbar";
import DocsSidebar from "../components/DocsSidebar";
import DocsMermaid from "../components/DocsMermaid";
import GoCodeBlock from "../components/GoCodeBlock";

const pageTopics = [
  { label: "Pipeline Execution Flow", href: "#execution-flow" },
  { label: "Swap Trigger & Queueing", href: "#swap-trigger" },
  { label: "Background Flush Execution", href: "#background-flush" },
  { label: "Error Recovery & Retries", href: "#error-recovery" },
];

const PIPELINE_FLOW_CHART = `flowchart TD
    A["Write Ingested"] --> B{"active.Size() > memtableSize?"}
    B -->|no| C["Skip Swap"]
    B -->|yes| D["Lock db.mu: get current wal.Size()"]
    D --> E["Append active SkipList to db.pendingFlush"]
    E --> F["active = NewSkipList()"]
    F --> G["Signal db.flushCh"]
    G --> H["flusher: Pop oldest entry from pendingFlush"]
    H --> I["sstable.NewWriter: write entries to sst_NNNN.sst"]
    I --> J["manifest.AppendNewFile(SSTID)"]
    J --> K["Add Reader to db.sstables, call publishSSTables()"]
    K --> L["completeWalAfterFlush(walCutoff, SSTID)"]`;

const MAYBE_FLUSH_CODE = `func (db *DB) maybeFlushLocked() (bool, error) {
	if db.active.Size() <= db.memtableSize {
		return false, nil
	}
	offset, err := db.wal.Size() // Capture cutoff point for WAL truncation
	if err != nil {
		return false, err
	}
	db.pendingFlush = append(db.pendingFlush, flushQueueEntry{
		mem:       db.active,
		walCutoff: offset,
	})
	db.active = memtable.NewSkipList() // Swap with a fresh, empty SkipList
	return true, nil
}`;

const FLUSH_IMMUTABLE_CODE = `func (db *DB) flushImmutable(imm *memtable.SkipList, walCutoff int64) error {
	if db.manifest == nil {
		return fmt.Errorf("manifest unavailable")
	}
	id := atomic.AddUint64(&db.nextSSTID, 1)
	path := filepath.Join(db.dir, fmt.Sprintf("sst_%08d.sst", id))
	expectedEntries := uint(imm.Len())
	if expectedEntries < 1 { expectedEntries = 1 }
	
	w, err := sstable.NewWriter(path, defaultBlockSize, expectedEntries)
	if err != nil { return err }
	// Iterate SkipList entries and append to SST writer
	it := imm.Iterator()
	for it.Valid() {
		if err := w.Add(it.Key(), it.Value(), it.IsTombstone()); err != nil {
			it.Close(); w.Close(); os.Remove(path)
			return err
		}
		it.Next()
	}
	it.Close()
	if err := w.Close(); err != nil {
		os.Remove(path)
		return err
	}
	
	// Load the new SSTable
	r, err := sstable.OpenReader(path, db.blockCache)
	if err != nil {
		os.Remove(path)
		return err
	}
	// Commit to manifest (Durability Boundary)
	if err := db.manifest.AppendNewFile(id); err != nil {
		r.Close(); os.Remove(path); return err
	}
	// Update live SSTable list and publish snapshot
	db.mu.Lock()
	db.sstables = append(db.sstables, r)
	db.publishSSTables()
	db.mu.Unlock()
	db.trackReader(r)
	// Compact manifest file if needed
	if err := db.manifest.MaybeCompact(); err != nil {
		log.Printf("pebbledb: manifest compaction after flush: %v", err)
	}
	// Truncate the WAL
	if err := db.completeWalAfterFlush(walCutoff, id); err != nil {
		db.setBackgroundErr("wal_cleanup", err)
	} else {
		db.clearBackgroundErrOp("wal_cleanup")
	}
	db.maybeTriggerCompaction()
	return nil
}`;

const RETRY_CODE = `func flushRetrySleep(retries int) {
	delay := flushRetryDelay // Starts at 100ms
	if retries > 10 {
		scaled := flushRetryDelay * time.Duration(retries/10)
		if scaled > flushRetryDelayMax {
			delay = flushRetryDelayMax // Caps at 2s
		} else {
			delay = scaled
		}
	}
	time.Sleep(delay)
}`;

export default function FlushPipelineDocsPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="flush-pipeline-title">
              PebbleDB Subsystem: Flush Pipeline
            </h1>

            <div className="guide-body-text" style={{ marginTop: 24 }}>
              <p>
                This document specifies the design, execution, and error handling of PebbleDB's Memtable Flush pipeline,
                detailing the step-by-step process of converting volatile in-memory SkipLists into durable on-disk SSTables.
              </p>

              {/* ── 1. Pipeline Execution Flow ── */}
              <h2 className="guide-sub-heading" id="execution-flow" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                1. Pipeline Execution Flow
              </h2>
              <DocsMermaid chart={PIPELINE_FLOW_CHART} />

              {/* ── 2. Swap Trigger & Queueing ── */}
              <h2 className="guide-sub-heading" id="swap-trigger" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                2. Swap Trigger & Queueing
              </h2>
              <p>
                Swapping occurs under <code className="inline-code">db.mu</code> inside the write path when the active memtable exceeds the configured size limit (default 4 MiB).
              </p>
              <GoCodeBlock>{MAYBE_FLUSH_CODE}</GoCodeBlock>

              {/* ── 3. Background Flush Execution ── */}
              <h2 className="guide-sub-heading" id="background-flush" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                3. Background Flush Execution
              </h2>
              <p>
                The background <code className="inline-code">flusher()</code> goroutine processes queued memtables sequentially, serializing their entries to SSTables:
              </p>
              <GoCodeBlock>{FLUSH_IMMUTABLE_CODE}</GoCodeBlock>

              {/* ── 4. Error Recovery & Retries ── */}
              <h2 className="guide-sub-heading" id="error-recovery" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                4. Error Recovery & Retries
              </h2>
              <p>
                If an I/O error occurs (such as a full disk or permissions issue) during a flush, the flusher retains the failed memtable at the head of <code className="inline-code">pendingFlush</code> and retries using a scaled delay to prevent error storms:
              </p>
              <GoCodeBlock>{RETRY_CODE}</GoCodeBlock>

              <div style={{ background: "rgba(255, 92, 173, 0.06)", border: "1px solid rgba(255, 92, 173, 0.25)", borderRadius: 8, padding: "16px 20px", marginTop: 16, marginBottom: 20 }}>
                <p style={{ color: "#ff5cad", fontWeight: 600, marginBottom: 6, fontSize: 13 }}>💡 WRITE BLOCK STRATEGY</p>
                <p style={{ fontSize: 13, lineHeight: 1.7 }}>
                  If <code className="inline-code">BlockWritesOnFlushError</code> is enabled (default true), writes block when a background flush error is active. This prevents memory exhaustion from incoming writes while the database is unable to write to disk. Point lookups and range scans continue to function normally.
                </p>
              </div>

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

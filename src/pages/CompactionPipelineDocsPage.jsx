import React from "react";
import DocsNavbar from "../components/DocsNavbar";
import DocsSidebar from "../components/DocsSidebar";
import DocsMermaid from "../components/DocsMermaid";
import GoCodeBlock from "../components/GoCodeBlock";

const pageTopics = [
  { label: "Pipeline Execution Flow", href: "#execution-flow" },
  { label: "Triggering & Selection", href: "#triggering" },
  { label: "Merge Execution", href: "#merge-execution" },
  { label: "Manifest Commit & Rollbacks", href: "#manifest-commit" },
  { label: "SSTable Updates & Async Deletion", href: "#sstable-updates" },
];

const COMPACTION_FLOW_CHART = `flowchart TD
    A["maybeTriggerCompaction()"] --> B{"len(sstables) >= compactThreshold?"}
    B -->|yes| C["Signal db.compactCh"]
    C --> D["compactor: Lock db.compactMu"]
    D --> E["Lock db.mu: pickSSTablesForCompactionLocked()"]
    E --> F["Unlock db.mu: mergeSSTables() via merge iterator"]
    F --> G["Lock db.mu: check if input SSTs are still present"]
    G --> H["Build newList, unlock db.mu"]
    H --> I["manifest.AppendSetFileSet(newListIDs)"]
    I --> J["Lock db.mu: check input SSTs and update db.sstables"]
    J --> K["publishSSTables() (update atomic pointer), unlock db.mu"]
    K --> L["r.Discard() on compacted readers (async removal)"]`;

const TRIGGER_CODE = `func (db *DB) maybeTriggerCompaction() {
	db.mu.RLock()
	closed := db.closed
	threshold := db.compactThreshold
	count := len(db.sstables)
	db.mu.RUnlock()
	if closed || threshold <= 0 || count < threshold {
		return
	}
	select {
	case db.compactCh <- struct{}{}:
	default:
	}
}`;

const SELECTION_CODE = `func (db *DB) pickSSTablesForCompactionLocked() []*sstable.Reader {
	if len(db.sstables) < db.compactThreshold {
		return nil
	}
	n := defaultCompactPickCount // Default is 2
	if len(db.sstables) < n {
		n = len(db.sstables)
	}
	if n < 2 { return nil }
	picked := make([]*sstable.Reader, n)
	copy(picked, db.sstables[:n])
	return picked
}`;

const MERGE_CODE = `func (db *DB) mergeSSTables(readers []*sstable.Reader) (*sstable.Reader, uint64, error) {
	if len(readers) < 2 { return nil, 0, nil }
	// Calculate expected entries to optimize bloom sizing
	var expectedEntries uint
	for _, r := range readers {
		n, err := r.EntryCount()
		if err != nil { return nil, 0, err }
		expectedEntries += n
	}
	if expectedEntries < 1 { expectedEntries = 1 }
	id := atomic.AddUint64(&db.nextSSTID, 1)
	path := filepath.Join(db.dir, fmt.Sprintf("sst_%08d.sst", id))
	w, err := sstable.NewWriter(path, defaultBlockSize, expectedEntries)
	if err != nil { return nil, 0, err }
	// Consolidate entries using a merge iterator, preserving tombstones
	if err := sstable.MergeReadersKeepTombstones(readers, w); err != nil {
		w.Close(); os.Remove(path); return nil, 0, err
	}
	if err := w.Close(); err != nil {
		os.Remove(path); return nil, 0, err
	}
	merged, err := sstable.OpenReader(path, db.blockCache)
	if err != nil {
		os.Remove(path); return nil, 0, err
	}
	return merged, id, nil
}`;

const VERIFY_CODE = `if !readersStillPresent(db.sstables, compReaders) {
	newReader.Close()
	os.Remove(newReader.Path())
	return nil
}`;

const ROTATION_CODE = `if err := db.manifest.AppendSetFileSet(liveIDs); err != nil {
	newReader.Close()
	os.Remove(newReader.Path())
	return err
}`;

const DISCARD_CODE = `for _, r := range compReaders {
	if err := r.Discard(); err != nil {
		log.Printf("pebbledb: discard compacted SST: %v", err)
	}
}`;

export default function CompactionPipelineDocsPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="compaction-pipeline-title">
              PebbleDB Subsystem: Compaction Pipeline
            </h1>

            <div className="guide-body-text" style={{ marginTop: 24 }}>
              <p>
                This document specifies the background Compaction Pipeline in PebbleDB, explaining how the database merges overlapping SSTables to limit read amplification and reclaim disk space.
              </p>

              {/* ── 1. Pipeline Execution Flow ── */}
              <h2 className="guide-sub-heading" id="execution-flow" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                1. Pipeline Execution Flow
              </h2>
              <DocsMermaid chart={COMPACTION_FLOW_CHART} />

              {/* ── 2. Triggering and Selection ── */}
              <h2 className="guide-sub-heading" id="triggering" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                2. Triggering and Selection
              </h2>
              <p>
                Compactions are checked after every memtable flush or compaction completion.
              </p>
              <GoCodeBlock>{TRIGGER_CODE}</GoCodeBlock>

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>2.1 File Selection Policy</h3>
              <p>
                To keep things simple, PebbleDB merges the two oldest active SSTables (at index 0 and 1 in <code className="inline-code">db.sstables</code>):
              </p>
              <GoCodeBlock>{SELECTION_CODE}</GoCodeBlock>

              {/* ── 3. Merge Execution ── */}
              <h2 className="guide-sub-heading" id="merge-execution" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                3. Merge Execution (Lock-Free Processing)
              </h2>
              <p>
                The database releases <code className="inline-code">db.mu</code> before beginning the merge. This is critical: it prevents blocking concurrent user writes and point reads while compactions perform disk I/O.
              </p>
              <GoCodeBlock>{MERGE_CODE}</GoCodeBlock>

              {/* ── 4. Manifest Commit & Transaction Rollbacks ── */}
              <h2 className="guide-sub-heading" id="manifest-commit" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                4. Manifest Commit & Transaction Rollbacks
              </h2>
              <p>
                Once the merge completes, the compactor attempts to commit the change to the manifest.
              </p>

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>4.1 Check Invariants Under Lock</h3>
              <p>
                Before updating the manifest, the database acquires <code className="inline-code">db.mu</code> and verifies that the input SSTables have not been modified (e.g., by another background routine or during a recovery path).
              </p>
              <GoCodeBlock>{VERIFY_CODE}</GoCodeBlock>

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>4.2 Update Manifest</h3>
              <p>
                The compactor writes the new active file set IDs to the manifest using <code className="inline-code">manifest.AppendSetFileSet(liveIDs)</code>.
              </p>

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>4.3 Rollback Handling</h3>
              <p>
                If the manifest append fails, the compactor rolls back the transaction. It closes the new reader, deletes the merged file, and restores the old active ID configuration:
              </p>
              <GoCodeBlock>{ROTATION_CODE}</GoCodeBlock>

              {/* ── 5. SSTable Updates & Async Deletion ── */}
              <h2 className="guide-sub-heading" id="sstable-updates" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                5. SSTable Updates & Async Deletion
              </h2>
              <p>
                Once the manifest is committed, the compactor updates the database state:
              </p>
              <ul className="guide-bullets-list">
                <li>
                  <span className="highlight-text">State Swap</span>: Updates <code className="inline-code">db.sstables</code> with the new file list and publishes the updated active pointer using <code className="inline-code">publishSSTables()</code>.
                </li>
                <li>
                  <span className="highlight-text">Discard Readers</span>: Call <code className="inline-code">r.Discard()</code> for each old reader. This marks the reader for deletion and decrements its reference count. The files are removed from disk once all active user query handles release their references (Invariant V2).
                </li>
              </ul>
              <GoCodeBlock>{DISCARD_CODE}</GoCodeBlock>

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

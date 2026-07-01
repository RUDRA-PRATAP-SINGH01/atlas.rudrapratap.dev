import React from "react";
import DocsNavbar from "@/components/docs/DocsNavbar";
import DocsSidebar from "@/components/docs/DocsSidebar";
import DocsMermaid from "@/components/docs/DocsMermaid";
import GoCodeBlock from "@/components/docs/GoCodeBlock";

const pageTopics = [
  { label: "Pipeline Execution Flow", href: "#execution-flow" },
  { label: "Manifest Replay & Bootstrap", href: "#manifest-replay" },
  { label: "Orphan File Cleanup", href: "#orphan-cleanup" },
  { label: "WAL Replay Offset Calculation", href: "#wal-offset" },
  { label: "WAL Tail Replay & Salvaging", href: "#wal-replay" },
];

const RECOVERY_FLOW_CHART = `flowchart TD
    A["Open(Options)"] --> B["Acquire LOCK file"]
    B --> C["manifest.Open(): read CURRENT and replay manifest log"]
    C --> D["BootstrapIfEmpty(): scan directory and match SSTs if manifest empty"]
    D --> E["loadSSTables(): load active reader for each live ID"]
    E --> F["removeOrphanSSTFiles(): delete unreferenced SSTs"]
    F --> G["walReplayStartOffset(): check wal.flush to find replay offset"]
    G --> H["ReplayFromWithRecovery(): apply WAL entries to active memtable"]
    H --> I["wal.Open(): open WAL handle in append mode"]
    I --> J["Start background workers"]`;

const ORPHAN_CODE = `func (db *DB) removeOrphanSSTFiles() {
	entries, err := os.ReadDir(db.dir)
	if err != nil { return }
	
	db.mu.RLock()
	live := make(map[uint64]struct{}, len(db.sstables))
	for _, r := range db.sstables {
		id, err := sstIDFromPath(r.Path())
		if err == nil { live[id] = struct{}{} }
	}
	db.mu.RUnlock()
	for _, e := range entries {
		m := sstFilePattern.FindStringSubmatch(e.Name())
		if m == nil { continue }
		id, err := strconv.ParseUint(m[1], 10, 64)
		if err != nil { continue }
		
		if _, ok := live[id]; !ok {
			// Delete SST file not tracked by the manifest
			os.Remove(filepath.Join(db.dir, e.Name()))
		}
	}
}`;

const WAL_OFFSET_CODE = `func (db *DB) walReplayStartOffset() (int64, error) {
	st, ok, err := readWalFlushState(db.dir)
	if err != nil || !ok {
		return 0, err // No checkpoint: replay from the beginning
	}
	if !db.manifest.Contains(st.SSTID) {
		return 0, nil // Stale checkpoint (SST ID not in manifest): replay from 0
	}
	if st.FreezeOffset < 0 {
		return 0, nil
	}
	walPath := filepath.Join(db.dir, "wal.log")
	fi, err := os.Stat(walPath)
	if err != nil {
		if os.IsNotExist(err) { return 0, nil }
		return 0, err
	}
	if fi.Size() < st.FreezeOffset {
		return 0, nil // WAL was truncated below the freeze point: replay from 0
	}
	return st.FreezeOffset, nil // Safe checkpoint: replay from FreezeOffset
}`;

const REPLAY_WITH_RECOVERY_CODE = `func ReplayFromWithRecovery(path string, limits ReplayLimits, startOffset int64, fn func(Record) error) (int64, error) {
	limits = limits.WithDefaults()
	f, err := os.OpenFile(path, os.O_RDWR, 0644)
	if err != nil {
		if os.IsNotExist(err) { return 0, nil }
		return 0, err
	}
	defer f.Close()
	fi, err := f.Stat()
	if err != nil { return 0, err }
	if fi.Size() > limits.MaxFileSize { return 0, ErrWALTooLarge }
	if startOffset > fi.Size() { startOffset = fi.Size() }
	if _, err := f.Seek(startOffset, io.SeekStart); err != nil { return 0, err }
	validEnd := startOffset
	for {
		recordStart, err := f.Seek(0, io.SeekCurrent)
		if err != nil { return validEnd, err }
		rec, n, err := readOneRecord(f, limits)
		if err == io.EOF { break }
		if err == io.ErrUnexpectedEOF {
			// Crash mid-write: truncate the partial tail record and complete recovery
			if truncErr := f.Truncate(validEnd); truncErr != nil {
				return validEnd, truncErr
			}
			break
		}
		if err != nil { return validEnd, err }
		validEnd = recordStart + n
		
		// Apply mutations to the active memtable SkipList
		if err := fn(rec); err != nil { return validEnd, err }
	}
	return validEnd, nil
}`;

export default function RecoveryPipelineDocsPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="recovery-pipeline-title">
              PebbleDB Subsystem: Recovery Pipeline
            </h1>

            <div className="guide-body-text" style={{ marginTop: 24 }}>
              <p>
                This document specifies the Recovery Pipeline in PebbleDB, explaining how the database restores itself to a consistent state during boot, replays metadata logs, cleans up orphaned files, and recovers mutations from the WAL.
              </p>

              {/* ── 1. Pipeline Execution Flow ── */}
              <h2 className="guide-sub-heading" id="execution-flow" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                1. Pipeline Execution Flow
              </h2>
              <DocsMermaid chart={RECOVERY_FLOW_CHART} />

              {/* ── 2. Manifest Replay & Bootstrap ── */}
              <h2 className="guide-sub-heading" id="manifest-replay" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                2. Manifest Replay & Bootstrap
              </h2>
              <ul className="guide-bullets-list">
                <li>
                  <span className="highlight-text">Read CURRENT File</span>: Reads the CURRENT pointer file to identify the active manifest log name (e.g., MANIFEST-000001).
                </li>
                <li>
                  <span className="highlight-text">Replay Edits</span>: Replays manifest records sequentially to reconstruct the live SSTable set (liveSet). If the file ends with a partial record (e.g., from a crash mid-write), it truncates the file to the last valid byte and completes replay.
                </li>
                <li>
                  <span className="highlight-text">Bootstrap Empty Directory</span>: If the database was upgraded from a version without a manifest, the bootstrap scanner scans the directory for .sst files, registers their IDs, and commits them to a new manifest snapshot using BootstrapIfEmpty().
                </li>
              </ul>

              {/* ── 3. Orphan File Cleanup ── */}
              <h2 className="guide-sub-heading" id="orphan-cleanup" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                3. Orphan File Cleanup
              </h2>
              <p>
                To reclaim space and maintain directory hygiene, PebbleDB scans the directory and deletes any .sst files that are not registered in the manifest's live set (Invariant D8).
              </p>
              <GoCodeBlock>{ORPHAN_CODE}</GoCodeBlock>

              {/* ── 4. WAL Replay Offset Calculation ── */}
              <h2 className="guide-sub-heading" id="wal-offset" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                4. WAL Replay Offset Calculation
              </h2>
              <p>
                To avoid replaying mutations that are already stored in durable SSTables, PebbleDB evaluates the wal.flush checkpoint file to determine the starting offset for the WAL replay:
              </p>
              <GoCodeBlock>{WAL_OFFSET_CODE}</GoCodeBlock>

              {/* ── 5. WAL Tail Replay & Salvaging ── */}
              <h2 className="guide-sub-heading" id="wal-replay" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                5. WAL Tail Replay & Salvaging
              </h2>
              <p>
                PebbleDB seek-reads the WAL starting at the computed offset. If it encounters a partial record at the end of the log (from an interrupted write during a crash), the recovery routine truncates the WAL file to discard the partial record and completes recovery successfully.
              </p>
              <GoCodeBlock>{REPLAY_WITH_RECOVERY_CODE}</GoCodeBlock>

              <div style={{ background: "rgba(192, 132, 252, 0.06)", border: "1px solid rgba(192, 132, 252, 0.25)", borderRadius: 8, padding: "16px 20px", marginTop: 16, marginBottom: 20 }}>
                <p style={{ color: "#c084fc", fontWeight: 600, marginBottom: 6, fontSize: 13 }}> NOTE</p>
                <p style={{ fontSize: 13, lineHeight: 1.7 }}>
                  The replayed mutations are applied to the database's active memtable using standard Put and Delete calls.
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

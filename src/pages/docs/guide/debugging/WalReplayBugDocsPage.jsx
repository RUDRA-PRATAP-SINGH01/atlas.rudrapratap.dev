import React from "react";
import DocsNavbar from "@/components/docs/DocsNavbar";
import DocsSidebar from "@/components/docs/DocsSidebar";
import DocsMermaid from "@/components/docs/DocsMermaid";
import GoCodeBlock from "@/components/docs/GoCodeBlock";

const pageTopics = [
  { label: "Context & Symptoms", href: "#symptoms" },
  { label: "Root Cause", href: "#root-cause" },
  { label: "The Solution: Checkpoints", href: "#solution" },
  { label: "Recovery Start Offset Tour", href: "#recovery-tour" },
];

const SEQUENCE_CHART = `sequenceDiagram
    autonumber
    participant FL as db.flusher
    participant M as manifest.Log
    participant C as wal.flush (Checkpoint)
    participant W as wal.log

    FL->>M: AppendNewFile(sstID) & fsync
    FL->>C: Write checkpoint {FreezeOffset, sstID} & fsync
    FL->>W: TruncateBefore(FreezeOffset)
    FL->>C: Remove checkpoint`;

const REPLAY_OFFSET_CODE = `func (db *DB) walReplayStartOffset() (int64, error) {
	st, ok, err := readWalFlushState(db.dir)
	if err != nil || !ok {
		return 0, err // No checkpoint: replay from start
	}
	if !db.manifest.Contains(st.SSTID) {
		return 0, nil // Checkpoint references non-live SST: replay from 0
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
		return 0, nil // WAL is smaller than freeze offset (already truncated): replay from 0
	}
	return st.FreezeOffset, nil // Safe checkpoint: replay from FreezeOffset
}`;

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  textAlign: "left",
  fontSize: 13,
  border: "1px solid rgba(255, 255, 255, 0.08)",
};

const thStyle = {
  padding: "10px 16px",
  color: "#ff5cad",
  fontWeight: 600,
};

const theadRowStyle = {
  background: "rgba(255, 92, 173, 0.08)",
  borderBottom: "1px solid rgba(255, 255, 255, 0.15)",
};

const tdStyle = { padding: "10px 16px" };
const tdMonoStyle = { padding: "10px 16px", fontFamily: "monospace" };
const tdBoldStyle = { padding: "10px 16px", fontWeight: 500, color: "#ffffff" };

export default function WalReplayBugDocsPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="wal-replay-bug-title">
              PebbleDB Postmortem: WAL Replay Bug
            </h1>

            <div className="guide-body-text" style={{ marginTop: 24 }}>
              <p>
                This document details the investigation, root cause, and fix for the WAL Replay Bug, where database recovery replayed redundant mutations that were already stored in durable SSTables.
              </p>

              {/* ── 1. Context & Symptoms ── */}
              <h2 className="guide-sub-heading" id="symptoms" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                1. Context & Symptoms
              </h2>
              <p>
                Early in development, after implementing flushes and SSTables, database restarts caused incorrect reads, duplicate keys, and resurrected deletions:
              </p>
              <ul className="guide-bullets-list">
                <li>
                  <span className="highlight-text">Stale Value Shadowing</span>: Values in the replayed memtable shadowed newer values that were stored in SSTable runs.
                </li>
                <li>
                  <span className="highlight-text">Duplicate Memory Entries</span>: Keys flushed to SSTables appeared in both the active memtable (via replay) and the SSTable layers.
                </li>
                <li>
                  <span className="highlight-text">Reappearing Deletions</span>: Deleted keys resurrected on restart because tombstones were re-ordered across layers during full replay.
                </li>
              </ul>

              {/* ── 2. Root Cause ── */}
              <h2 className="guide-sub-heading" id="root-cause" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                2. Root Cause
              </h2>
              <p>
                PebbleDB had two recovery design errors:
              </p>
              <ul className="guide-bullets-list">
                <li>
                  <span className="highlight-text">Full Replay</span>: On open, recovery replayed the entire <code className="inline-code">wal.log</code> from byte 0, regardless of whether the writes had already been flushed to an SSTable.
                </li>
                <li>
                  <span className="highlight-text">No Checkpoint Boundary</span>: There was no durable metadata tracking which WAL bytes were already captured on disk. Even if the WAL was truncated, there was no crash-safe indicator of where to start replaying if a crash occurred mid-truncation.
                </li>
              </ul>
              <p>
                In an LSM tree, once a memtable is flushed to an SSTable, those records are durable on disk. Replaying WAL bytes written before the flush re-applies redundant mutations, violating the newest-wins read ordering (Invariant V1).
              </p>

              {/* ── 3. The Solution: Checkpoints ── */}
              <h2 className="guide-sub-heading" id="solution" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                3. The Solution: wal.flush Checkpoints
              </h2>
              <p>
                To resolve this, PebbleDB introduced a 16-byte checkpoint file (<code className="inline-code">wal.flush</code>) that bounds the replay range:
              </p>
              <div style={{ overflowX: "auto", marginTop: 12, marginBottom: 20 }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={theadRowStyle}>
                      <th style={thStyle}>Field</th>
                      <th style={thStyle}>Size</th>
                      <th style={thStyle}>Format</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>FreezeOffset</td>
                      <td style={tdMonoStyle}>8 bytes</td>
                      <td style={tdStyle}>Big-Endian U64</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>SSTID</td>
                      <td style={tdMonoStyle}>8 bytes</td>
                      <td style={tdStyle}>Big-Endian U64</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>3.1 Checkpoint Sequence</h3>
              <p>
                The flush pipeline writes the checkpoint file after committing the SSTable to the manifest, but before truncating the WAL:
              </p>
              <DocsMermaid chart={SEQUENCE_CHART} />

              {/* ── 4. Recovery Start Offset Tour ── */}
              <h2 className="guide-sub-heading" id="recovery-tour" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                4. Recovery Start Offset Decision
              </h2>
              <p>
                During recovery, PebbleDB evaluates the checkpoint file to determine where to start replaying the WAL:
              </p>
              <GoCodeBlock>{REPLAY_OFFSET_CODE}</GoCodeBlock>

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

import React from "react";
import DocsNavbar from "@/components/docs/DocsNavbar";
import DocsSidebar from "@/components/docs/DocsSidebar";
import DocsMermaid from "@/components/docs/DocsMermaid";
import GoCodeBlock from "@/components/docs/GoCodeBlock";

const pageTopics = [
  { label: "Why Subprocess Termination", href: "#why-subprocess" },
  { label: "Subprocess Crash Architecture", href: "#architecture" },
  { label: "The Crash Hook", href: "#crash-hook" },
  { label: "Crash Points and Invariant Coverage", href: "#crash-points" },
  { label: "How to Run Crash Tests", href: "#run-tests" },
];

const ARCH_CHART = `sequenceDiagram
    autonumber
    participant Parent as Parent Test Goroutine
    participant Sub as Subprocess (exec.Command)
    participant Dir as Data Directory

    Parent->>Sub: Spawn subprocess with PEBBLEDB_CRASH_AT = <point>
    Sub->>Dir: Write WAL, SSTs, or Manifest
    Sub->>Sub: Reaches crash point
    Sub->>Parent: os.Exit(2) (Immediate termination)
    Parent->>Parent: Exit code 2 returned
    Parent->>Dir: Open(Options) same directory
    Parent->>Parent: Assert keys, files, and manifest live set`;

const HOOK_CODE = `package db
import (
	"os"
)
type CrashPoint string
const (
	CrashAfterSSTClose             = "flush_after_sst_close"
	CrashAfterManifestNewFile      = "flush_after_manifest"
	CrashAfterWalFlushState        = "flush_after_wal_state"
	CrashAfterWalTruncate          = "flush_after_wal_truncate"
	CrashAfterMergeClose           = "compact_after_merge_close"
	CrashAfterManifestSetFileSet   = "compact_after_manifest"
	CrashAfterSSTablesUpdate       = "compact_after_sstables_update"
	CrashAfterDeleteOldSSTs        = "compact_after_delete_old"
)
func maybeCrash(point CrashPoint) {
	if os.Getenv("PEBBLEDB_CRASH_AT") == string(point) {
		os.Exit(2) // Exit code 2 signifies an intentional crash test exit
	}
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

export default function CrashTestingDocsPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="crash-testing-title">
              PebbleDB Testing Specification: Crash Testing
            </h1>

            <div className="guide-body-text" style={{ marginTop: 24 }}>
              <p>
                This document specifies the crash testing subsystem of PebbleDB, which enforces durability guarantees by terminating the database process at specific write points and asserting recovery consistency.
              </p>

              {/* ── 1. Why Subprocess Termination is Used ── */}
              <h2 className="guide-sub-heading" id="why-subprocess" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                1. Why Subprocess Termination is Used
              </h2>
              <p>
                Simulating a crash with Go&apos;s panic or in-process mock failures is insufficient for verifying system correctness:
              </p>
              <ul className="guide-bullets-list">
                <li>
                  <span className="highlight-text">Handle Reclamation</span>: Operating systems reclaim file handles and locks differently on process exit than on standard panic recoveries.
                </li>
                <li>
                  <span className="highlight-text">Disk Cache Invariants</span>: A clean panicking shutdown can still allow deferred writes or sync buffers to flush.
                </li>
                <li>
                  <span className="highlight-text">State Cleanliness</span>: Background threads (like flusher/compactor) must be hard-killed to simulate real power loss.
                </li>
              </ul>
              <p>
                PebbleDB tests crash recovery by actually exiting the process via <code className="inline-code">os.Exit(2)</code> at key I/O boundaries and verifying that the database can recover.
              </p>

              {/* ── 2. Subprocess Crash Architecture ── */}
              <h2 className="guide-sub-heading" id="architecture" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                2. Subprocess Crash Architecture
              </h2>
              <DocsMermaid chart={ARCH_CHART} />

              {/* ── 3. The Crash Hook ── */}
              <h2 className="guide-sub-heading" id="crash-hook" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                3. The Crash Hook (internal/db/crashpoint.go)
              </h2>
              <p>
                PebbleDB includes compile-time crash points in its pipeline. If the environment variable <code className="inline-code">PEBBLEDB_CRASH_AT</code> matches the current code path, the process terminates immediately:
              </p>
              <GoCodeBlock>{HOOK_CODE}</GoCodeBlock>

              {/* ── 4. Crash Points and Invariant Coverage ── */}
              <h2 className="guide-sub-heading" id="crash-points" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                4. Crash Points and Invariant Coverage
              </h2>
              <div style={{ overflowX: "auto", marginTop: 16, marginBottom: 20 }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={theadRowStyle}>
                      <th style={thStyle}>Crash Point</th>
                      <th style={thStyle}>Location</th>
                      <th style={thStyle}>Description</th>
                      <th style={thStyle}>Assertions on Recovery</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>flush_after_sst_close</td>
                      <td style={tdMonoStyle}>flush.go:131</td>
                      <td style={tdStyle}>SST is durable, but not registered in manifest</td>
                      <td style={tdStyle}>SST is quarantined; WAL is replayed from start to rebuild memtable.</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>flush_after_manifest</td>
                      <td style={tdMonoStyle}>flush.go:146</td>
                      <td style={tdStyle}>SST registered in manifest, but wal.flush checkpoint is missing</td>
                      <td style={tdStyle}>Replay offset defaults to 0. Recovery loads SST + replayed WAL; correct keys merged.</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>flush_after_wal_state</td>
                      <td style={tdMonoStyle}>flush.go:177</td>
                      <td style={tdStyle}>wal.flush checkpoint is durable, WAL not yet truncated</td>
                      <td style={tdStyle}>Recovery seek-reads WAL starting from FreezeOffset, bypassing redundant writes.</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>flush_after_wal_truncate</td>
                      <td style={tdMonoStyle}>flush.go:163</td>
                      <td style={tdStyle}>WAL truncated, but checkpoint sidecar still exists</td>
                      <td style={tdStyle}>Replay reads from 0 on the shortened WAL. Correct key visibility.</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>compact_after_merge_close</td>
                      <td style={tdMonoStyle}>compactor.go:61</td>
                      <td style={tdStyle}>Merged SST is written, but not committed to manifest</td>
                      <td style={tdStyle}>Old SSTs remain live. New SST is quarantined as an orphan.</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>compact_after_manifest</td>
                      <td style={tdMonoStyle}>compactor.go:97</td>
                      <td style={tdStyle}>Manifest updated to new set, but memory not swapped</td>
                      <td style={tdStyle}>Recovery loads new merged SST; old SSTs ignored.</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>compact_after_sstables_update</td>
                      <td style={tdMonoStyle}>compactor.go:113</td>
                      <td style={tdStyle}>Memory swapped, but old files not deleted</td>
                      <td style={tdStyle}>Old SST files exist but manifest excludes them; they are deleted or quarantined.</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>compact_after_delete_old</td>
                      <td style={tdMonoStyle}>compactor.go:126</td>
                      <td style={tdStyle}>Compaction fully completed</td>
                      <td style={tdStyle}>Normal operation.</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* ── 5. How to Run Crash Tests ── */}
              <h2 className="guide-sub-heading" id="run-tests" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                5. How to Run Crash Tests
              </h2>
              <p>
                Crash tests are run by targeting the Crash run filter:
              </p>
              <pre className="guide-code-pre" style={{ background: "#18181b", padding: "12px", borderRadius: "6px", overflowX: "auto", margin: "16px 0" }}>
                <code>{`# Run the crash recovery suite
go test ./internal/db -run Crash -v`}</code>
              </pre>
              <p>
                This runs <code className="inline-code">TestCrashRecoveryFlushBoundaries</code> and <code className="inline-code">TestCrashRecoveryCompactBoundaries</code> in <code className="inline-code">crash_recovery_test.go</code>. These tests spawn the child processes, pass the correct <code className="inline-code">PEBBLEDB_CRASH_AT</code> environment variables, and perform recovery assertions.
              </p>

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

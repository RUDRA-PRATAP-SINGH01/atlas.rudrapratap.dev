import React from "react";
import DocsNavbar from "../components/DocsNavbar";
import DocsSidebar from "../components/DocsSidebar";

const pageTopics = [
  { label: "Durability Ordering", href: "#ordering" },
  { label: "Test Crashes, Not Just Shutdown", href: "#crash-testing" },
  { label: "-race CI Catches Real Bugs", href: "#race-detector" },
  { label: "Windows File Locking Constraints", href: "#windows-locking" },
  { label: "API Return Value Contracts", href: "#api-contracts" },
  { label: "Manifest Before Memory", href: "#manifest-before-memory" },
  { label: "Immutability vs Close", href: "#immutability-vs-close" },
  { label: "Scan Isolation Memory Cost", href: "#scan-isolation" },
  { label: "No glob-ing for Truth", href: "#no-globbing" },
  { label: "Quarantine vs Delete", href: "#quarantine-vs-delete" },
  { label: "Shutdown Vigilance", href: "#shutdown-vigilance" },
  { label: "Scope Discipline", href: "#scope-discipline" },
];

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
const tdBoldStyle = { padding: "10px 16px", fontWeight: 500, color: "#ffffff" };

export default function LessonsLearnedDocsPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="lessons-learned-title">
              PebbleDB Engineering: Lessons Learned
            </h1>

            <div className="guide-body-text" style={{ marginTop: 24 }}>
              <p>
                This document synthesizes every engineering lesson from PebbleDB&apos;s development, drawn from postmortems, evolutionary phases, and dozens of crash injection tests.
              </p>

              {/* ── 1. Durability Ordering ── */}
              <h2 className="guide-sub-heading" id="ordering" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                1. Durability Ordering Is the Product
              </h2>
              <p>
                The core insight of building a storage engine: the order in which bytes hit different files is the product, not the data structures.
              </p>
              <div style={{ overflowX: "auto", marginTop: 16, marginBottom: 20 }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={theadRowStyle}>
                      <th style={thStyle}>Durability Boundary</th>
                      <th style={thStyle}>What It Means</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>WAL fsync</td>
                      <td style={tdStyle}>Record is durable in the log</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>Manifest fsync</td>
                      <td style={tdStyle}>SSTable is officially live</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>wal.flush write</td>
                      <td style={tdStyle}>Replay range metadata is bounded</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p>
                <strong>Lesson:</strong> Unnamed boundaries are untested boundaries. If there&apos;s no crash injection point between two operations, the ordering contract is unverified.
              </p>

              {/* ── 2. Test Crashes ── */}
              <h2 className="guide-sub-heading" id="crash-testing" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                2. Test Crashes, Not Just Clean Shutdown
              </h2>
              <p>
                Subprocess crash injection (triggered via the <code className="inline-code">PEBBLEDB_CRASH_AT</code> environment variable) found critical bugs that standard unit tests missed. <code className="inline-code">Close()</code> does not exercise crash paths — it only exercises the clean shutdown state machine.
              </p>
              <p>
                Crash points tested during hardening:
              </p>
              <ul className="guide-bullets-list">
                <li>
                  <span className="highlight-text">flush_after_sst_close</span> — crash between SSTable write and manifest commit.
                </li>
                <li>
                  <span className="highlight-text">flush_after_manifest</span> — crash between manifest commit and WAL truncation.
                </li>
                <li>
                  <span className="highlight-text">flush_after_wal_state</span> — crash between checkpoint write and WAL truncation.
                </li>
                <li>
                  <span className="highlight-text">flush_after_wal_truncate</span> — crash between WAL truncation and checkpoint removal.
                </li>
                <li>
                  <span className="highlight-text">compact_after_manifest</span> — crash between manifest SetFileSet and memory swap.
                </li>
                <li>
                  <span className="highlight-text">compact_after_delete_old</span> — crash after discarding compacted inputs.
                </li>
              </ul>

              {/* ── 3. -race CI ── */}
              <h2 className="guide-sub-heading" id="race-detector" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                3. -race CI Catches Real Bugs
              </h2>
              <p>
                Every <code className="inline-code">-race</code> failure during PebbleDB development was a real bug, not a false positive:
              </p>
              <div style={{ overflowX: "auto", marginTop: 16, marginBottom: 20 }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={theadRowStyle}>
                      <th style={thStyle}>Race Condition</th>
                      <th style={thStyle}>Root Cause</th>
                      <th style={thStyle}>Resolution</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>Compaction vs Get</td>
                      <td style={tdStyle}>Close() on reader still held by in-flight read</td>
                      <td style={tdStyle}>Ref-counting reader lifecycle</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>Scan vs Write</td>
                      <td style={tdStyle}>Iterator held RLock for entire lifetime</td>
                      <td style={tdStyle}>Copy-on-read memtable snapshots</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>Block read vs Discard</td>
                      <td style={tdStyle}>No distinction between &quot;removed&quot; and &quot;safe to close&quot;</td>
                      <td style={tdStyle}>Deferred filesystem cleanup</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p>
                <strong>Lesson:</strong> CI must run <code className="inline-code">-race -shuffle=on</code> on every commit. The Go race detector is a first-class correctness tool.
              </p>

              {/* ── 4. Windows File Locking ── */}
              <h2 className="guide-sub-heading" id="windows-locking" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                4. Windows File Locking Changes Everything
              </h2>
              <p>
                Rename/delete with open handles fails differently on Windows than on Linux. This is not a &quot;portability problem&quot; — it is a primary design constraint.
              </p>
              <div style={{ overflowX: "auto", marginTop: 16, marginBottom: 20 }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={theadRowStyle}>
                      <th style={thStyle}>Operation</th>
                      <th style={thStyle}>Linux Behaviour</th>
                      <th style={thStyle}>Windows Behaviour</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>os.Rename over open file</td>
                      <td style={tdStyle}>Succeeds (inode swap)</td>
                      <td style={tdStyle}>ACCESS_DENIED</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>os.Remove on open handle</td>
                      <td style={tdStyle}>Succeeds (deferred unlink)</td>
                      <td style={tdStyle}>ERROR_SHARING_VIOLATION</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>os.Truncate with open writer</td>
                      <td style={tdStyle}>Works</td>
                      <td style={tdStyle}>May fail depending on sharing flags</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p>
                <strong>Lesson:</strong> Close handles before manifest truncate, WAL truncate, or SST delete. The WAL copy-rename pattern (<code className="inline-code">TruncateBefore</code>) exists specifically because of Windows.
              </p>

              {/* ── 5. API Contracts ── */}
              <h2 className="guide-sub-heading" id="api-contracts" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                5. API Return Values Imply Contracts
              </h2>
              <p>
                Put returning nil under async group commit is valid internally — but callers assumed it meant &quot;durable.&quot; This led to confusion and incorrect benchmarks.
                <br />
                <strong>Resolution:</strong> Added <code className="inline-code">Sync()</code> as an explicit durability barrier, documented that async Put is not durable until <code className="inline-code">Sync()</code> completes, and added <code className="inline-code">SyncWrites</code> option for per-op fsync.
              </p>

              {/* ── 6. Manifest Before Memory ── */}
              <h2 className="guide-sub-heading" id="manifest-before-memory" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                6. Manifest Before Memory
              </h2>
              <p>
                The single most impactful ordering fix: manifest fsync before in-memory SST swap.
                <br />
                <strong>Before:</strong> Crash between memory swap and manifest write left manifest listing stale SSTs while process believed they were gone.
                <br />
                <strong>After:</strong> If crash occurs between manifest write and memory swap, re-open replays the manifest and reaches the correct state.
              </p>

              {/* ── 7. Immutability vs Close ── */}
              <h2 className="guide-sub-heading" id="immutability-vs-close" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                7. Immutability ≠ Safe to Close
              </h2>
              <p>
                SSTable files are immutable after creation, but <code className="inline-code">sstable.Reader</code> handles wrap open file descriptors. Removing a reader from <code className="inline-code">db.sstables</code> is not destruction — in-flight Get/Scan may still be using it.
                <br />
                <strong>Solution:</strong> Reference counting (Ref/Unref/Discard) on readers. Physical Close happens only when refs reach zero and close-pending is set.
              </p>

              {/* ── 8. Scan Isolation ── */}
              <h2 className="guide-sub-heading" id="scan-isolation" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                8. Scan Isolation Has a Memory Cost
              </h2>
              <p>
                Snapshot copy unblocked writers — but at the cost of duplicating the entire memtable state at scan creation time.
              </p>
              <div style={{ overflowX: "auto", marginTop: 16, marginBottom: 20 }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={theadRowStyle}>
                      <th style={thStyle}>Approach</th>
                      <th style={thStyle}>Write Throughput</th>
                      <th style={thStyle}>Memory Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>Long-held RLock</td>
                      <td style={tdStyle}>Blocked</td>
                      <td style={tdStyle}>Zero extra</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>Snapshot copy</td>
                      <td style={tdStyle}>Unblocked</td>
                      <td style={tdStyle}>Proportional to memtable</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p>
                <strong>Lesson:</strong> For educational scope, snapshot copy is acceptable. Production would require MVCC.
              </p>

              {/* ── 9. Globbing ── */}
              <h2 className="guide-sub-heading" id="no-globbing" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                9. Do Not Glob the Data Directory for Truth
              </h2>
              <p>
                Using <code className="inline-code">filepath.Glob(&quot;sst_*.sst&quot;)</code> as the source of truth for live files broke after compaction crashes left orphan files on disk. The manifest is the authority.
                <br />
                <strong>Rule:</strong> Directory listing is recovery input (discover candidates), not authority (define liveness).
              </p>

              {/* ── 10. Quarantine ── */}
              <h2 className="guide-sub-heading" id="quarantine-vs-delete" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                10. Quarantine Beats Delete
              </h2>
              <p>
                When an SST file exists on disk but is not in the manifest, PebbleDB moves it to <code className="inline-code">quarantine/</code> instead of deleting. This preserves forensic evidence for post-crash debugging.
              </p>

              {/* ── 11. Shutdown Vigilance ── */}
              <h2 className="guide-sub-heading" id="shutdown-vigilance" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                11. Shutdown Paths Need the Same Attention as Write Paths
              </h2>
              <p>
                Early <code className="inline-code">Close()</code> implementations were afterthoughts:
              </p>
              <ul className="guide-bullets-list">
                <li>Infinite loops when flush queue had errors.</li>
                <li>Races between Close nil-ing manifest and flusher still appending.</li>
                <li>No upper bound on flush drain wait.</li>
              </ul>
              <p>
                <strong>Solution:</strong> Bounded drain timeouts (30s), <code className="inline-code">ErrCloseIncomplete</code> abort path that keeps WAL/manifest open, and explicit worker join checks.
              </p>

              {/* ── 12. Scope Discipline ── */}
              <h2 className="guide-sub-heading" id="scope-discipline" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                12. Scope Discipline Ships Features
              </h2>
              <p>
                PebbleDB shipped recovery, compaction, and correct crash handling specifically because it did not attempt replication, SQL, or multi-tenant isolation. Every rejected feature made the shipped features more correct.
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

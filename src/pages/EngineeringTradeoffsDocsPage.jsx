import React from "react";
import DocsNavbar from "../components/DocsNavbar";
import DocsSidebar from "../components/DocsSidebar";

const pageTopics = [
  { label: "Core Tradeoff Philosophy", href: "#philosophy" },
  { label: "Tradeoff Catalog", href: "#tradeoff-catalog" },
  { label: "Durability vs Latency Spectrum", href: "#durability-latency" },
  { label: "Explicit Non-Goals", href: "#non-goals" },
  { label: "Teaching vs Production Gap", href: "#teaching-vs-production" },
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

export default function EngineeringTradeoffsDocsPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="engineering-tradeoffs-title">
              PebbleDB Engineering: Trade-offs
            </h1>

            <div className="guide-body-text" style={{ marginTop: 24 }}>
              <p>
                This document catalogs every engineering tradeoff that shaped PebbleDB, organized by what was gained, what was sacrificed, and the explicit non-goals that define the project&apos;s scope.
              </p>

              {/* ── 1. Philosophy ── */}
              <h2 className="guide-sub-heading" id="philosophy" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                1. Core Tradeoff Philosophy
              </h2>
              <p>
                PebbleDB optimizes for understandable durability over feature breadth and peak performance.
              </p>

              {/* ── 2. Tradeoff Catalog ── */}
              <h2 className="guide-sub-heading" id="tradeoff-catalog" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                2. Tradeoff Catalog
              </h2>
              <div style={{ overflowX: "auto", marginTop: 16, marginBottom: 20 }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={theadRowStyle}>
                      <th style={thStyle}>#</th>
                      <th style={thStyle}>Decision</th>
                      <th style={thStyle}>What PebbleDB Gains</th>
                      <th style={thStyle}>What PebbleDB Sacrifices</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>1</td>
                      <td style={tdStyle}>LSM architecture</td>
                      <td style={tdStyle}>Sequential writes, immutable files, clear crash story</td>
                      <td style={tdStyle}>Compaction required; read amplification vs B-tree</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>2</td>
                      <td style={tdStyle}>Skip list memtable</td>
                      <td style={tdStyle}>Simple concurrent inserts with O(log n) complexity</td>
                      <td style={tdStyle}>Approximate Size() tracking (no exact byte accounting)</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>3</td>
                      <td style={tdStyle}>Single writer lock</td>
                      <td style={tdStyle}>Easy reasoning about state transitions</td>
                      <td style={tdStyle}>No parallel Put throughput; single-goroutine write path</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>4</td>
                      <td style={tdStyle}>Group commit (default)</td>
                      <td style={tdStyle}>~20× write throughput vs per-op fsync</td>
                      <td style={tdStyle}>Put may return before fsync; last milliseconds lost on crash</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>5</td>
                      <td style={tdStyle}>WAL fsync before memtable</td>
                      <td style={tdStyle}>Replay correctness (WAL is source of truth)</td>
                      <td style={tdStyle}>Latency when sync required (each batch waits for fsync)</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>6</td>
                      <td style={tdStyle}>Manifest fsync per flush/compact</td>
                      <td style={tdStyle}>Crash-consistent live set</td>
                      <td style={tdStyle}>Extra fsync latency on every structural change</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>7</td>
                      <td style={tdStyle}>wal.flush sidecar</td>
                      <td style={tdStyle}>Correct replay offset after crash</td>
                      <td style={tdStyle}>Extra file; 4 crash windows to test</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>8</td>
                      <td style={tdStyle}>Oldest-2 compaction</td>
                      <td style={tdStyle}>Simplest implementation and test surface</td>
                      <td style={tdStyle}>Suboptimal write/read amplification vs leveled/tiered</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>9</td>
                      <td style={tdStyle}>Per-SST bloom filter</td>
                      <td style={tdStyle}>Cheap negative lookups; skip entire files</td>
                      <td style={tdStyle}>Space overhead + false positive block reads</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>10</td>
                      <td style={tdStyle}>Tombstones in SST</td>
                      <td style={tdStyle}>Correct delete semantics across crash and compaction</td>
                      <td style={tdStyle}>Space consumed until compaction merges tombstones</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>11</td>
                      <td style={tdStyle}>Scan snapshot copy</td>
                      <td style={tdStyle}>Writers not blocked during range scans</td>
                      <td style={tdStyle}>Memory spike proportional to memtable size; stale iterator view</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>12</td>
                      <td style={tdStyle}>Block cache (optional)</td>
                      <td style={tdStyle}>Hot block reuse across repeated reads</td>
                      <td style={tdStyle}>Memory budget; eviction complexity</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>13</td>
                      <td style={tdStyle}>Scoped background errors</td>
                      <td style={tdStyle}>Reads continue during partial failure</td>
                      <td style={tdStyle}>Caller must handle write errors distinctly</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>14</td>
                      <td style={tdStyle}>No network server</td>
                      <td style={tdStyle}>Smaller attack surface; simpler binary</td>
                      <td style={tdStyle}>CLI/library only; no remote access</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>15</td>
                      <td style={tdStyle}>No MVCC</td>
                      <td style={tdStyle}>Simpler key format; no version management</td>
                      <td style={tdStyle}>No snapshot isolation across time</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>16</td>
                      <td style={tdStyle}>Quarantine vs delete</td>
                      <td style={tdStyle}>Debuggable recovery; forensic evidence preserved</td>
                      <td style={tdStyle}>Disk clutter until manual cleanup</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>17</td>
                      <td style={tdStyle}>Close timeout (30s)</td>
                      <td style={tdStyle}>Bounded shutdown; no infinite hangs</td>
                      <td style={tdStyle}>ErrCloseIncomplete leaves handles open</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* ── 3. Durability vs Latency Spectrum ── */}
              <h2 className="guide-sub-heading" id="durability-latency" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                3. Durability vs Latency Spectrum
              </h2>
              <p>
                PebbleDB exposes three levels intentionally:
              </p>

              <pre className="guide-code-pre" style={{ background: "#18181b", padding: "12px", borderRadius: "6px", overflowX: "auto", margin: "16px 0" }}>
                <code>{`  ~20× faster ────────────────────────► Barrier for prior writes ────────► Per-op fsync
  1. Async Put                          2. Sync()                          3. SyncWrites: true
  Lowest latency                                                           Highest latency`}</code>
              </pre>

              <div style={{ overflowX: "auto", marginTop: 16, marginBottom: 20 }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={theadRowStyle}>
                      <th style={thStyle}>Level</th>
                      <th style={thStyle}>Durability</th>
                      <th style={thStyle}>Performance</th>
                      <th style={thStyle}>When to Use</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>Async Put</td>
                      <td style={tdStyle}>May lose last ms on crash</td>
                      <td style={tdStyle}>~37,000 ops/sec</td>
                      <td style={tdStyle}>Bulk load, non-critical data</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>Sync()</td>
                      <td style={tdStyle}>Barrier for all prior async writes</td>
                      <td style={tdStyle}>Per-call fsync</td>
                      <td style={tdStyle}>After batch of important writes</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>SyncWrites: true</td>
                      <td style={tdStyle}>Per-op fsync guarantee</td>
                      <td style={tdStyle}>~1,800 ops/sec</td>
                      <td style={tdStyle}>Financial transactions, critical metadata</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* ── 4. Explicit Non-Goals ── */}
              <h2 className="guide-sub-heading" id="non-goals" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                4. Explicit Non-Goals
              </h2>
              <p>
                These are features PebbleDB intentionally does not provide:
              </p>
              <div style={{ overflowX: "auto", marginTop: 16, marginBottom: 20 }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={theadRowStyle}>
                      <th style={thStyle}>Not Guaranteed</th>
                      <th style={thStyle}>Why</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>Multi-process consistency</td>
                      <td style={tdStyle}>LOCK enforces one writer; no cross-process coherence</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>Transactions</td>
                      <td style={tdStyle}>No atomic multi-key commit or rollback</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>Snapshot isolation / MVCC</td>
                      <td style={tdStyle}>Scan is point-in-time at creation, not versioned across time</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>Distributed replication</td>
                      <td style={tdStyle}>Single node only</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>Durability before Sync()</td>
                      <td style={tdStyle}>Explicit API contract, not a violation</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>Durability if fsync lies</td>
                      <td style={tdStyle}>Assumes OS/storage stack honors fsync</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>Immediate compaction</td>
                      <td style={tdStyle}>Compaction is background; SST count can exceed threshold</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>Read-after-flush for iterators</td>
                      <td style={tdStyle}>Scan does not see keys flushed after creation</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>Bounded read amplification</td>
                      <td style={tdStyle}>Oldest-2 policy does not minimize read amp</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>Production multi-tenant SLOs</td>
                      <td style={tdStyle}>Educational scope</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* ── 5. Teaching vs Production Gap ── */}
              <h2 className="guide-sub-heading" id="teaching-vs-production" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                5. Teaching vs Production Gap
              </h2>
              <p>
                What PebbleDB would need to become production-grade:
              </p>
              <div style={{ overflowX: "auto", marginTop: 16, marginBottom: 20 }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={theadRowStyle}>
                      <th style={thStyle}>Missing Feature</th>
                      <th style={thStyle}>Why It Matters</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>Leveled or tiered compaction</td>
                      <td style={tdStyle}>Controls read amplification and space amplification</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>MVCC or snapshot timestamps</td>
                      <td style={tdStyle}>Enables repeatable reads and transactional semantics</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>Rigorous fuzzing / Jepsen-style testing</td>
                      <td style={tdStyle}>Explores edge cases that deterministic crash tests miss</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>Operational metrics and backpressure</td>
                      <td style={tdStyle}>Prevents runaway memory/disk usage under sustained load</td>
                    </tr>
                  </tbody>
                </table>
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

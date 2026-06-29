import React from "react";
import DocsNavbar from "../components/DocsNavbar";
import DocsSidebar from "../components/DocsSidebar";

const pageTopics = [
  { label: "Engineering Phases", href: "#phases" },
  { label: "Development Timeline", href: "#timeline" },
  { label: "Major Milestones", href: "#milestones" },
];

function TimelineSvg() {
  return (
    <svg viewBox="0 0 800 240" className="w-full h-auto bg-[#0e0e11] border border-zinc-800 rounded-lg p-4 my-6" style={{ marginTop: 24, marginBottom: 24 }}>
      {/* Horizontal Axis line */}
      <line x1="50" y1="120" x2="750" y2="120" stroke="#52525b" strokeWidth="2" />

      {/* Axis markers */}
      {[
        { x: 50, date: "June 1", phase: "P1: WAL + Mem" },
        { x: 137.5, date: "June 4", phase: "P2: SSTables" },
        { x: 225, date: "June 7", phase: "P3: Manifest" },
        { x: 312.5, date: "June 10", phase: "P4: Compact" },
        { x: 400, date: "June 13", phase: "P5: Bloom" },
        { x: 487.5, date: "June 16", phase: "P6: Recovery" },
        { x: 575, date: "June 19", phase: "P7: Concur" },
        { x: 662.5, date: "June 22", phase: "P8: Perf API" },
        { x: 750, date: "June 25", phase: "P9: Shutdown" }
      ].map((pt, idx) => (
        <g key={pt.phase}>
          <circle cx={pt.x} cy="120" r={idx % 2 === 0 ? "6" : "5"} fill={idx % 2 === 0 ? "#ff5cad" : "#38bdf8"} stroke="#0e0e11" strokeWidth="1.5" />
          
          {/* Alternating labels top/bottom to prevent overlap */}
          {idx % 2 === 0 ? (
            <>
              <text x={pt.x} y="95" fill="#ffffff" fontSize="9" textAnchor="middle" fontWeight="bold">{pt.phase}</text>
              <text x={pt.x} y="80" fill="#a1a1aa" fontSize="8" textAnchor="middle">{pt.date}</text>
              <line x1={pt.x} y1="102" x2={pt.x} y2="114" stroke="#ff5cad" strokeWidth="0.8" strokeDasharray="2,2" />
            </>
          ) : (
            <>
              <text x={pt.x} y="145" fill="#ffffff" fontSize="9" textAnchor="middle" fontWeight="bold">{pt.phase}</text>
              <text x={pt.x} y="160" fill="#a1a1aa" fontSize="8" textAnchor="middle">{pt.date}</text>
              <line x1={pt.x} y1="126" x2={pt.x} y2="138" stroke="#38bdf8" strokeWidth="0.8" strokeDasharray="2,2" />
            </>
          )}
        </g>
      ))}

      {/* Bracket categorizations */}
      {/* Foundation */}
      <path d="M 50 185 L 50 195 H 225 L 225 185" fill="none" stroke="#71717a" strokeWidth="1" />
      <text x="137.5" y="210" fill="#71717a" fontSize="10" textAnchor="middle">Foundation</text>

      {/* LSM Features */}
      <path d="M 225 185 L 225 195 H 487.5 L 487.5 185" fill="none" stroke="#71717a" strokeWidth="1" />
      <text x="356.25" y="210" fill="#71717a" fontSize="10" textAnchor="middle">LSM Features</text>

      {/* Hardening */}
      <path d="M 487.5 185 L 487.5 195 H 750 L 750 185" fill="none" stroke="#71717a" strokeWidth="1" />
      <text x="618.75" y="210" fill="#71717a" fontSize="10" textAnchor="middle">Hardening</text>

      {/* Title */}
      <text x="400" y="25" fill="#ffffff" fontSize="12" fontWeight="bold" textAnchor="middle">PebbleDB Development Phases</text>
    </svg>
  );
}

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

export default function EvolutionDocsPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="evolution-title">
              PebbleDB Engineering: Evolution
            </h1>

            <div className="guide-body-text" style={{ marginTop: 24 }}>
              <p>
                This document traces the evolutionary history of PebbleDB through nine engineering phases, logging key mutations, failures, fixes, and insights.
              </p>

              {/* ── 1. Engineering Phases ── */}
              <h2 className="guide-sub-heading" id="phases" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                1. Engineering Phases
              </h2>

              <div className="guide-evolution-phase" style={{ margin: "24px 0", borderLeft: "3px solid #ff5cad", paddingLeft: 16 }}>
                <h3 style={{ color: "#ffffff", fontSize: 18, margin: "0 0 8px 0" }}>Phase 1: WAL + Memtable</h3>
                <p>
                  <strong>Motivation:</strong> Prove append-only durability and sorted in-memory store.
                  <br />
                  <strong>Built:</strong> <code className="inline-code">internal/wal</code> CRC records, <code className="inline-code">internal/memtable</code> skip list, Put/Get against active memtable only.
                  <br />
                  <strong>Problems:</strong> No persistence beyond RAM if WAL replay was wrong. Windows WAL truncate failed with open handles.
                  <br />
                  <strong>Fixes:</strong> Cross-platform truncate via close-truncate-reopen (commit 78e8eb8). Unified writeRecord path for put/delete.
                  <br />
                  <strong>Insight:</strong> Platform file semantics are part of the storage engine.
                </p>
              </div>

              <div className="guide-evolution-phase" style={{ margin: "24px 0", borderLeft: "3px solid #ff5cad", paddingLeft: 16 }}>
                <h3 style={{ color: "#ffffff", fontSize: 18, margin: "0 0 8px 0" }}>Phase 2: SSTables</h3>
                <p>
                  <strong>Motivation:</strong> Memtable must become immutable on-disk runs.
                  <br />
                  <strong>Built:</strong> Block-based SST writer/reader, index, footer v2, flush from memtable iterator.
                  <br />
                  <strong>Problems:</strong> Tombstones invisible to early readers. Partial files visible if renamed too early.
                  <br />
                  <strong>Fixes:</strong> Tombstone byte in block entries. Write to .tmp, rename on Close, manifest learns file only after rename.
                  <br />
                  <strong>Insight:</strong> Immutability starts at rename + manifest, not at last byte written.
                </p>
              </div>

              <div className="guide-evolution-phase" style={{ margin: "24px 0", borderLeft: "3px solid #ff5cad", paddingLeft: 16 }}>
                <h3 style={{ color: "#ffffff", fontSize: 18, margin: "0 0 8px 0" }}>Phase 3: Manifest</h3>
                <p>
                  <strong>Motivation:</strong> Glob-based SST discovery broke after crashes left orphan files.
                  <br />
                  <strong>Built:</strong> Append-only MANIFEST-*, CURRENT pointer, NewFile / SetFileSet records.
                  <br />
                  <strong>Problems:</strong> Memory/manifest ordering bugs. Rotation truncated open files on Windows.
                  <br />
                  <strong>Fixes:</strong> Manifest-before-memory rule. Atomic CURRENT update (commit fd701a3).
                  <br />
                  <strong>Insight:</strong> The manifest is law — disk files are candidates until listed.
                </p>
              </div>

              <div className="guide-evolution-phase" style={{ margin: "24px 0", borderLeft: "3px solid #ff5cad", paddingLeft: 16 }}>
                <h3 style={{ color: "#ffffff", fontSize: 18, margin: "0 0 8px 0" }}>Phase 4: Compaction</h3>
                <p>
                  <strong>Motivation:</strong> SST count grew without bound.
                  <br />
                  <strong>Built:</strong> Background compactor, oldest-2 merge, tombstones preserved.
                  <br />
                  <strong>Problems:</strong> Race with Get. Manifest/memory divergence on crash.
                  <br />
                  <strong>Fixes:</strong> Reader Ref/Unref, readersStillPresent, manifest rollback (commits 0b2baf0, cfbbf5a).
                  <br />
                  <strong>Insight:</strong> Compaction is concurrent with reads even if SSTs are &quot;immutable.&quot;
                </p>
              </div>

              <div className="guide-evolution-phase" style={{ margin: "24px 0", borderLeft: "3px solid #ff5cad", paddingLeft: 16 }}>
                <h3 style={{ color: "#ffffff", fontSize: 18, margin: "0 0 8px 0" }}>Phase 5: Bloom Filters</h3>
                <p>
                  <strong>Motivation:</strong> Get latency linear in SST count.
                  <br />
                  <strong>Built:</strong> Per-file bloom in footer, MayContain gate before block IO.
                  <br />
                  <strong>Problems:</strong> Corrupt bloom metadata caused divide-by-zero panic.
                  <br />
                  <strong>Fixes:</strong> Reject m==0/k==0 on decode (commit 054e6f7).
                  <br />
                  <strong>Insight:</strong> Defensive decode on untrusted disk bytes.
                </p>
              </div>

              <div className="guide-evolution-phase" style={{ margin: "24px 0", borderLeft: "3px solid #ff5cad", paddingLeft: 16 }}>
                <h3 style={{ color: "#ffffff", fontSize: 18, margin: "0 0 8px 0" }}>Phase 6: Recovery Redesign</h3>
                <p>
                  <strong>Motivation:</strong> Full WAL replay after flush duplicated state.
                  <br />
                  <strong>Built:</strong> wal.flush checkpoint, walReplayStartOffset, SST-first open.
                  <br />
                  <strong>Problems:</strong> Truncated WAL below freeze offset, unknown SST id in checkpoint.
                  <br />
                  <strong>Fixes:</strong> Replay from 0 when wal.size &lt; FreezeOffset. Ignore checkpoint if SST not in manifest.
                  <br />
                  <strong>Insight:</strong> Recovery is a byte-range problem, not a boolean &quot;replay WAL yes/no.&quot;
                </p>
              </div>

              <div className="guide-evolution-phase" style={{ margin: "24px 0", borderLeft: "3px solid #ff5cad", paddingLeft: 16 }}>
                <h3 style={{ color: "#ffffff", fontSize: 18, margin: "0 0 8px 0" }}>Phase 7: Concurrency Fixes</h3>
                <p>
                  <strong>Motivation:</strong> Scan blocked writes; compaction raced with reads; flush queue stuck.
                  <br />
                  <strong>Built:</strong> Memtable snapshots, pendingFlush queue with drain-all flusher, reader lifecycle.
                  <br />
                  <strong>Problems:</strong> Long-held iterator locks. Coalesced flush signals dropping work.
                  <br />
                  <strong>Fixes:</strong> Snapshot copy (scan-lock-contention postmortem). Drain entire queue per wakeup.
                  <br />
                  <strong>Insight:</strong> Liveness bugs show up in benchmarks before correctness tests fail.
                </p>
              </div>

              <div className="guide-evolution-phase" style={{ margin: "24px 0", borderLeft: "3px solid #ff5cad", paddingLeft: 16 }}>
                <h3 style={{ color: "#ffffff", fontSize: 18, margin: "0 0 8px 0" }}>Phase 8: Performance &amp; Durability API</h3>
                <p>
                  <strong>Motivation:</strong> Write throughput and explicit durability contracts.
                  <br />
                  <strong>Built:</strong> Group commit (commit 01eef8e), async batch flusher, LRU block cache (commit 052812d), Sync() / SyncWrites (commit 0a7a5fa).
                  <br />
                  <strong>Problems:</strong> Callers thought Put return meant durable. CI bench wrappers lied about metrics (commit 4ceee30).
                  <br />
                  <strong>Fixes:</strong> Documented async semantics. CLI sync command. Removed broken bench helpers.
                  <br />
                  <strong>Insight:</strong> Performance work without API clarity creates operational bugs.
                </p>
              </div>

              <div className="guide-evolution-phase" style={{ margin: "24px 0", borderLeft: "3px solid #ff5cad", paddingLeft: 16 }}>
                <h3 style={{ color: "#ffffff", fontSize: 18, margin: "0 0 8px 0" }}>Phase 9: Hardening for Real Shutdown</h3>
                <p>
                  <strong>Motivation:</strong> Close hung or tore down resources while workers ran.
                  <br />
                  <strong>Built:</strong> Bounded drain timeouts, ErrCloseIncomplete, abort path keeps WAL/manifest open (commit 505578a).
                  <br />
                  <strong>Problems:</strong> Stuck flush infinite loop on close. Directory lock errno mapping on Linux (commit 95541a8).
                  <br />
                  <strong>Fixes:</strong> Worker join timeouts. Unix EWOULDBLOCK → ErrDatabaseLocked.
                  <br />
                  <strong>Insight:</strong> Shutdown paths need the same attention as write paths.
                </p>
              </div>

              {/* ── 2. Development Timeline ── */}
              <h2 className="guide-sub-heading" id="timeline" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                2. Development Timeline
              </h2>
              <TimelineSvg />

              {/* ── 3. Major Milestones ── */}
              <h2 className="guide-sub-heading" id="milestones" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                3. Major Milestones
              </h2>
              <div style={{ overflowX: "auto", marginTop: 16, marginBottom: 20 }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={theadRowStyle}>
                      <th style={thStyle}>Milestone</th>
                      <th style={thStyle}>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>M1</td>
                      <td style={tdStyle}>Durable write loop: WAL + skip list memtable + Put/Get</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>M2</td>
                      <td style={tdStyle}>Immutable SST layer: block SSTables with flush from memtable</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>M3</td>
                      <td style={tdStyle}>Authoritative manifest: live SST set in MANIFEST-*, not directory glob</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>M4</td>
                      <td style={tdStyle}>Background compaction: bounded SST count via oldest-2 merge</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>M5</td>
                      <td style={tdStyle}>Correct recovery: wal.flush + bounded WAL replay tail</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>M6</td>
                      <td style={tdStyle}>Concurrent reads: bloom filters, reader refs, scan snapshots</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>M7</td>
                      <td style={tdStyle}>Durability API: group commit, Sync(), SyncWrites, directory lock</td>
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

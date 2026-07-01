import React from "react";
import DocsNavbar from "@/components/docs/DocsNavbar";
import DocsSidebar from "@/components/docs/DocsSidebar";

const pageTopics = [
  { label: "Chronological Timeline", href: "#timeline" },
  { label: "Phase 1: Foundation", href: "#phase1" },
  { label: "Phase 2: LSM Features", href: "#phase2" },
  { label: "Phase 3: Hardening & Performance", href: "#phase3" },
];

function PhaseTimelineChart() {
  const phases = [
    {
      title: "Phase 1: Foundation",
      period: "Early June 2026",
      color: "#ff5cad",
      items: [
        "Skip list memtable",
        "WAL with CRC",
        "Basic Put/Get",
        "Windows WAL truncate handle-swap fixes"
      ]
    },
    {
      title: "Phase 2: LSM Features",
      period: "Mid June 2026",
      color: "#c084fc",
      items: [
        "Background flusher goroutine",
        "Bloom filters per-SSTable",
        "Compaction oldest-2 merge",
        "Range scan & MergeIterator"
      ]
    },
    {
      title: "Phase 3: Hardening & Performance",
      period: "Late June 2026",
      color: "#a855f7",
      items: [
        "Group commit batching (20× speedup)",
        "Manifest atomicity & CURRENT renames",
        "Close timeouts & ErrCloseIncomplete",
        "Block cache (32 MiB LRU)"
      ]
    }
  ];

  return (
    <div className="my-8 p-6 bg-[#0e0e11] border border-zinc-800 rounded-lg">
      <h3 style={{ color: "#ffffff", fontSize: 15, fontWeight: "bold", marginBottom: 20 }}>
        PebbleDB Development Timeline Overview
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 24, position: "relative" }}>
        {/* Connect line */}
        <div style={{ position: "absolute", left: 16, top: 12, bottom: 12, width: 2, background: "rgba(255, 255, 255, 0.08)" }} />

        {phases.map((phase) => (
          <div key={phase.title} style={{ display: "flex", gap: 16, position: "relative", zIndex: 1 }}>
            {/* Dot */}
            <div style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: "#0e0e11",
              border: `2px solid ${phase.color}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0
            }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: phase.color }} />
            </div>

            {/* Info */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h4 style={{ color: "#ffffff", fontSize: 14, fontWeight: "bold", margin: 0 }}>{phase.title}</h4>
                <span style={{ color: phase.color, fontSize: 11, background: `${phase.color}15`, padding: "2px 8px", borderRadius: 10, fontWeight: "bold" }}>
                  {phase.period}
                </span>
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, color: "#a1a1aa", fontSize: 13, lineHeight: 1.6 }}>
                {phase.items.map((it) => <li key={it}>{it}</li>)}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
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
const tdMonoStyle = { padding: "10px 16px", fontFamily: "monospace" };
const tdBoldStyle = { padding: "10px 16px", fontWeight: 500, color: "#ffffff" };

export default function DevelopmentTimelineDocsPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="timeline-title">
              PebbleDB Specification: Development Timeline
            </h1>

            <div className="guide-body-text" style={{ marginTop: 24 }}>
              <p>
                This document specifies the chronological development timeline of PebbleDB, tracking how each component grew, broke, and was refined from the initial commits to the final hardened release.
              </p>

              {/* ── 1. Chronological Timeline ── */}
              <h2 className="guide-sub-heading" id="timeline" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                1. Chronological Timeline
              </h2>
              <PhaseTimelineChart />

              {/* ── 2. Phase 1: Foundation ── */}
              <h2 className="guide-sub-heading" id="phase1" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                2. Phase 1: Foundation (Early June 2026)
              </h2>
              <p>
                The initial phase focused on proving in-memory sorting and append-only disk durability.
              </p>

              <div style={{ overflowX: "auto", marginTop: 16, marginBottom: 20 }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={theadRowStyle}>
                      <th style={thStyle}>Period</th>
                      <th style={thStyle}>Target Subsystem / Task</th>
                      <th style={thStyle}>Key Commits / PRs</th>
                      <th style={thStyle}>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>Early June</td>
                      <td style={tdStyle}>Volatile SkipList &amp; WAL</td>
                      <td style={tdMonoStyle}>eee97de</td>
                      <td style={tdStyle}>Implemented basic SkipList structure for memtable inserts, binary WAL format with CRC32-IEEE checksum verification, and Put/Get operations.</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>Mid June</td>
                      <td style={tdStyle}>SSTable Blocks</td>
                      <td style={tdMonoStyle}>5a34ff1, 5df52e0</td>
                      <td style={tdStyle}>Implemented block-level formatting for SSTs, index block serialization, validating footer, and memtable flush iteration.</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>Mid June</td>
                      <td style={tdStyle}>Windows Handle Locks</td>
                      <td style={tdMonoStyle}>ca28f73, 78e8eb8</td>
                      <td style={tdStyle}>Resolved file rename and truncation failures on Windows by implementing the close-truncate-reopen handle swap.</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>Mid June</td>
                      <td style={tdStyle}>WAL Replay Scope</td>
                      <td style={tdMonoStyle}>d0a4a0a</td>
                      <td style={tdStyle}>Addressed the issue where recovery replayed redundant writes by restricting recovery replay to the un-flushed WAL tail.</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* ── 3. Phase 2: LSM Features ── */}
              <h2 className="guide-sub-heading" id="phase2" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                3. Phase 2: LSM Features (Mid June 2026)
              </h2>
              <p>
                The second phase introduced background routines to bound disk storage and optimize lookups.
              </p>

              <div style={{ overflowX: "auto", marginTop: 16, marginBottom: 20 }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={theadRowStyle}>
                      <th style={thStyle}>Period</th>
                      <th style={thStyle}>Target Subsystem / Task</th>
                      <th style={thStyle}>Key Commits / PRs</th>
                      <th style={thStyle}>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>Mid June</td>
                      <td style={tdStyle}>Background Flusher</td>
                      <td style={tdMonoStyle}>ec4cee5</td>
                      <td style={tdStyle}>Introduced the background <code className="inline-code">flusher()</code> goroutine to serialize memtables concurrently and write SSTs.</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>Mid June</td>
                      <td style={tdStyle}>Bloom Filters</td>
                      <td style={tdMonoStyle}>ec4cee5</td>
                      <td style={tdStyle}>Implemented per-SSTable bloom filters to bypass disk block reads on negative point lookups.</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>Mid June</td>
                      <td style={tdStyle}>Background Compaction</td>
                      <td style={tdMonoStyle}>e65cf72, 7590b2c</td>
                      <td style={tdStyle}>Implemented the background <code className="inline-code">compactor()</code> goroutine using the oldest-2 merge policy, preserving delete tombstones.</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>Mid June</td>
                      <td style={tdStyle}>Range Scan</td>
                      <td style={tdMonoStyle}>05f073d</td>
                      <td style={tdStyle}>Introduced range scans (Scan), the MergeIterator (k-way merge stream), and the CLI commands.</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>Mid June</td>
                      <td style={tdStyle}>Recovery Audits</td>
                      <td style={tdMonoStyle}>7c420c7, 054e6f7</td>
                      <td style={tdStyle}>Fixed concurrency bugs in recovery and added check guards against corrupted bloom filters.</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* ── 4. Phase 3: Hardening & Performance ── */}
              <h2 className="guide-sub-heading" id="phase3" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                4. Phase 3: Hardening &amp; Performance (Late June 2026)
              </h2>
              <p>
                The final phase optimized write/read paths and hardened the engine against crash corruptions and deadlocks.
              </p>

              <div style={{ overflowX: "auto", marginTop: 16, marginBottom: 20 }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={theadRowStyle}>
                      <th style={thStyle}>Period</th>
                      <th style={thStyle}>Target Subsystem / Task</th>
                      <th style={thStyle}>Key Commits / PRs</th>
                      <th style={thStyle}>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>Late June</td>
                      <td style={tdStyle}>Group Commit Batching</td>
                      <td style={tdMonoStyle}>01eef8e</td>
                      <td style={tdStyle}>Implemented the batch flusher to group concurrent WAL writes and call fsync once per batch, improving throughput by 20×.</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>Late June</td>
                      <td style={tdStyle}>Compaction Atomicity</td>
                      <td style={tdMonoStyle}>0b2baf0, fd701a3</td>
                      <td style={tdStyle}>Enforced the manifest-before-memory rule to prevent metadata-disk state divergence after a compaction crash.</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>Late June</td>
                      <td style={tdStyle}>Close Boundedness</td>
                      <td style={tdMonoStyle}>1336b21</td>
                      <td style={tdStyle}>Added upper bound timeouts (30s) during shutdown to prevent deadlocks when closing the database.</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>Late June</td>
                      <td style={tdStyle}>Block Cache</td>
                      <td style={tdMonoStyle}>052812d</td>
                      <td style={tdStyle}>Implemented the LRU block cache to reuse hot data blocks across read queries.</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>Late June</td>
                      <td style={tdStyle}>Durability APIs</td>
                      <td style={tdMonoStyle}>0a7a5fa</td>
                      <td style={tdStyle}>Added explicit Sync() and SyncWrites options, and implemented the directory lock file.</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>Late June</td>
                      <td style={tdStyle}>Unix flock &amp; CI fixes</td>
                      <td style={tdMonoStyle}>f9833ad–95541a8</td>
                      <td style={tdStyle}>Resolved lock file races on Unix and optimized GitHub Actions test runs.</td>
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

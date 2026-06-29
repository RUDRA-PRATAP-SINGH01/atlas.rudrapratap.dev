import React from "react";
import DocsNavbar from "../components/DocsNavbar";
import DocsSidebar from "../components/DocsSidebar";
import DocsMermaid from "../components/DocsMermaid";

const pageTopics = [
  { label: "Performance Architecture", href: "#architecture" },
  { label: "Throughput Summary", href: "#throughput" },
  { label: "Write Amplification Profile", href: "#write-amplification" },
  { label: "Read Amplification Profile", href: "#read-amplification" },
  { label: "Memory Budget Breakdown", href: "#memory-budget" },
  { label: "Latency Characteristics", href: "#latency" },
];

const ARCH_CHART = `flowchart TD
    subgraph Write Path
    W1[WAL Append sequential] --> W2[Memtable Insert O log n]
    end

    subgraph Read Path
    R1[Check pendingBatch] --> R2[Check active memtable]
    R2 --> R3[Check pendingFlush]
    R3 --> R4{Bloom filter?}
    R4 -->|miss| R5[Skip SST]
    R4 -->|hit| R6{Block cache?}
    R6 -->|hit| R7[Return value]
    R6 -->|miss| R8[Read block from disk]
    R8 --> R7
    end`;

function MemoryBudgetChartSvg() {
  const budget = [
    { label: "Active Memtable", val: 76, color: "#ff5cad" },
    { label: "Pending Flush Queue", val: 10, color: "#38bdf8" },
    { label: "Block Cache", val: 10, color: "#a855f7" },
    { label: "Bloom Filters (all SSTs)", val: 3, color: "#eab308" },
    { label: "Index Blocks (all SSTs)", val: 1, color: "#10b981" },
  ];

  return (
    <div className="my-6 p-6 bg-[#0e0e11] border border-zinc-800 rounded-lg">
      <h4 style={{ color: "#ffffff", fontSize: 13, fontWeight: "bold", marginBottom: 16 }}>
        Memory Budget Allocation (Typical 1M Key Database)
      </h4>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {budget.map((item) => (
          <div key={item.label} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
              <span style={{ color: "#a1a1aa" }}>{item.label}</span>
              <span style={{ color: "#ffffff", fontWeight: "bold" }}>{item.val}%</span>
            </div>
            <div style={{ height: 8, background: "#18181b", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ width: `${item.val}%`, height: "100%", background: item.color, borderRadius: 4 }} />
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

export default function PerformanceOverviewDocsPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="performance-overview-title">
              PebbleDB Performance: Overview
            </h1>

            <div className="guide-body-text" style={{ marginTop: 24 }}>
              <p>
                This document provides a high-level performance profile of PebbleDB, summarizing throughput characteristics, latency profiles, and memory budget allocation across the engine&apos;s subsystems.
              </p>

              {/* ── 1. Performance Architecture ── */}
              <h2 className="guide-sub-heading" id="architecture" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                1. Performance Architecture
              </h2>
              <p>
                PebbleDB&apos;s performance is shaped by its LSM-tree architecture. Writes are always sequential (append to WAL, insert into skip list). Reads may touch multiple layers (memtable, pending flush queue, SSTable chain).
              </p>
              <DocsMermaid chart={ARCH_CHART} />

              {/* ── 2. Throughput Summary ── */}
              <h2 className="guide-sub-heading" id="throughput" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                2. Throughput Summary
              </h2>
              <div style={{ overflowX: "auto", marginTop: 16, marginBottom: 20 }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={theadRowStyle}>
                      <th style={thStyle}>Operation</th>
                      <th style={thStyle}>Throughput</th>
                      <th style={thStyle}>Conditions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>Sequential Write (async)</td>
                      <td style={tdMonoStyle}>~37,000 ops/sec</td>
                      <td style={tdStyle}>Group commit, 128B values, NVMe</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>Sequential Write (sync)</td>
                      <td style={tdMonoStyle}>~1,800 ops/sec</td>
                      <td style={tdStyle}>SyncWrites: true, per-op fsync</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>Random Read (hot memtable)</td>
                      <td style={tdMonoStyle}>~3,083,000 ops/sec</td>
                      <td style={tdStyle}>4 goroutines, 50k keys in memory</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>Range Scan (50k keys)</td>
                      <td style={tdMonoStyle}>~7,638,000 keys/sec</td>
                      <td style={tdStyle}>Memtable-only, single goroutine</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div style={{ background: "rgba(255, 92, 173, 0.06)", border: "1px solid rgba(255, 92, 173, 0.25)", borderRadius: 8, padding: "16px 20px", marginTop: 16, marginBottom: 20 }}>
                <p style={{ color: "#ff5cad", fontWeight: 600, marginBottom: 6, fontSize: 13 }}>⚠ IMPORTANT</p>
                <p style={{ fontSize: 13, lineHeight: 1.7 }}>
                  These numbers measure hot paths (memtable-resident data). Full LSM depth with cold SSTable reads would show lower throughput for reads.
                </p>
              </div>

              {/* ── 3. Write Amplification ── */}
              <h2 className="guide-sub-heading" id="write-amplification" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                3. Write Amplification Profile
              </h2>
              <div style={{ overflowX: "auto", marginTop: 16, marginBottom: 20 }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={theadRowStyle}>
                      <th style={thStyle}>Source</th>
                      <th style={thStyle}>Amplification</th>
                      <th style={thStyle}>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>WAL append</td>
                      <td style={tdMonoStyle}>1×</td>
                      <td style={tdStyle}>+ 13 bytes header/CRC overhead per record. Sequential, batch-fsynced</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>Memtable → SST flush</td>
                      <td style={tdMonoStyle}>1×</td>
                      <td style={tdStyle}>Rewrite data into block format. One-time conversion</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>Compaction (oldest-2)</td>
                      <td style={tdMonoStyle}>~2× per merge round</td>
                      <td style={tdStyle}>Each key rewritten per compaction round</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p>
                <strong>Total worst-case write amplification:</strong> For a key that survives N compaction rounds: approximately <code className="inline-code">N + 2</code> (1 WAL + 1 flush + N compactions).
              </p>

              {/* ── 4. Read Amplification ── */}
              <h2 className="guide-sub-heading" id="read-amplification" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                4. Read Amplification Profile
              </h2>
              <div style={{ overflowX: "auto", marginTop: 16, marginBottom: 20 }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={theadRowStyle}>
                      <th style={thStyle}>Scenario</th>
                      <th style={thStyle}>Layers Checked</th>
                      <th style={thStyle}>Disk Reads</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>Key in active memtable</td>
                      <td style={tdMonoStyle}>1</td>
                      <td style={tdStyle}>0</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>Key in pendingFlush</td>
                      <td style={tdMonoStyle}>2</td>
                      <td style={tdStyle}>0</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>Key in most recent SST</td>
                      <td style={tdMonoStyle}>3+</td>
                      <td style={tdStyle}>1 block (if not cached)</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>Key absent from all</td>
                      <td style={tdMonoStyle}>All layers</td>
                      <td style={tdStyle}>0 (Bloom filters reject)</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>Key in oldest SST</td>
                      <td style={tdMonoStyle}>All layers</td>
                      <td style={tdStyle}>1 block per false-positive SST + 1 hit</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* ── 5. Memory Budget Breakdown ── */}
              <h2 className="guide-sub-heading" id="memory-budget" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                5. Memory Budget Breakdown
              </h2>
              <MemoryBudgetChartSvg />

              <div style={{ overflowX: "auto", marginTop: 16, marginBottom: 20 }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={theadRowStyle}>
                      <th style={thStyle}>Component</th>
                      <th style={thStyle}>Default Size</th>
                      <th style={thStyle}>Configurable?</th>
                      <th style={thStyle}>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>Active memtable</td>
                      <td style={tdMonoStyle}>≤ 4 MiB</td>
                      <td style={tdStyle}>Yes (MemtableSize)</td>
                      <td style={tdStyle}>Skip list nodes + key/value bytes</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>Pending flush queue</td>
                      <td style={tdMonoStyle}>0–N × 4 MiB</td>
                      <td style={tdStyle}>Indirect</td>
                      <td style={tdStyle}>Frozen memtables awaiting flush</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>Block cache</td>
                      <td style={tdMonoStyle}>32 MiB</td>
                      <td style={tdStyle}>Yes (BlockCacheSize)</td>
                      <td style={tdStyle}>LRU of SST data blocks</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>Bloom filters</td>
                      <td style={tdMonoStyle}>~1.2 bytes/key/SST</td>
                      <td style={tdStyle}>No</td>
                      <td style={tdStyle}>Loaded on SST open, stays in memory</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>Index blocks</td>
                      <td style={tdMonoStyle}>~34B/data block</td>
                      <td style={tdStyle}>No</td>
                      <td style={tdStyle}>Loaded on SST open, stays in memory</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>WAL write buffer</td>
                      <td style={tdMonoStyle}>≤ batch × rec size</td>
                      <td style={tdStyle}>No</td>
                      <td style={tdStyle}>Transient; freed after fsync</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>5.1 Memory Scaling Formula</h3>
              <p>
                For a database with <code className="inline-code">K</code> total keys across <code className="inline-code">S</code> SSTables, each with <code className="inline-code">B</code> data blocks:
              </p>
              <pre className="guide-code-pre" style={{ background: "#18181b", padding: "12px", borderRadius: "6px", overflowX: "auto", margin: "16px 0" }}>
                <code>
                  Memory ≈ MemtableSize + BlockCacheSize + S × (1.2K/S + B × (20 + keyLen))
                </code>
              </pre>

              {/* ── 6. Latency Characteristics ── */}
              <h2 className="guide-sub-heading" id="latency" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                6. Latency Characteristics
              </h2>
              
              <h3 style={{ color: "#ffffff", marginTop: 16 }}>6.1 Write Latency</h3>
              <div style={{ overflowX: "auto", marginTop: 12, marginBottom: 20 }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={theadRowStyle}>
                      <th style={thStyle}>Mode</th>
                      <th style={thStyle}>p50</th>
                      <th style={thStyle}>p99</th>
                      <th style={thStyle}>Driver</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>Async group commit</td>
                      <td style={tdMonoStyle}>~27 µs</td>
                      <td style={tdMonoStyle}>~100 µs</td>
                      <td style={tdStyle}>Batch timer + memtable insert (flush stall)</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>SyncWrites: true</td>
                      <td style={tdMonoStyle}>~550 µs</td>
                      <td style={tdMonoStyle}>~2 ms</td>
                      <td style={tdStyle}>Per-op fsync to NVMe</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h3 style={{ color: "#ffffff", marginTop: 16 }}>6.2 Read Latency</h3>
              <div style={{ overflowX: "auto", marginTop: 12, marginBottom: 20 }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={theadRowStyle}>
                      <th style={thStyle}>Scenario</th>
                      <th style={thStyle}>p50</th>
                      <th style={thStyle}>Driver</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>Memtable hit</td>
                      <td style={tdMonoStyle}>~324 ns</td>
                      <td style={tdStyle}>Skip list binary search</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>Block cache hit</td>
                      <td style={tdMonoStyle}>~1–5 µs</td>
                      <td style={tdStyle}>LRU lookup + block scan</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>Block cache miss</td>
                      <td style={tdMonoStyle}>~50–200 µs</td>
                      <td style={tdStyle}>Disk read + block decode</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>Bloom filter rejection</td>
                      <td style={tdMonoStyle}>~100–500 ns</td>
                      <td style={tdStyle}>Hash computation only</td>
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

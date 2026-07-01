import React from "react";
import DocsNavbar from "@/components/docs/DocsNavbar";
import DocsSidebar from "@/components/docs/DocsSidebar";

const pageTopics = [
  { label: "Sequential Write (Async Group Commit)", href: "#sequential-write" },
  { label: "Random Read (Parallel Get, Memtable-Only)", href: "#random-read" },
  { label: "Scan Throughput (Memtable-Only)", href: "#scan-throughput" },
  { label: "Bottleneck Summary", href: "#bottleneck" },
];

function WriteScalingChartSvg() {
  return (
    <svg viewBox="0 0 500 240" className="w-full h-auto bg-[#0e0e11] border border-zinc-800 rounded-lg p-4 my-6">
      <text x="250" y="20" fill="#ffffff" fontSize="12" fontWeight="bold" textAnchor="middle">
        Write Throughput vs Dataset Size (ops/sec)
      </text>

      {/* Grid lines */}
      <line x1="60" y1="180" x2="460" y2="180" stroke="#27272a" strokeWidth="1" />
      <line x1="60" y1="130" x2="460" y2="130" stroke="#27272a" strokeWidth="1" />
      <line x1="60" y1="80" x2="460" y2="80" stroke="#27272a" strokeWidth="1" />

      {/* Bars */}
      {/* 100k: 37,709 (height: ~130px) */}
      <rect x="100" y="55" width="40" height="125" rx="3" fill="#ff5cad" />
      <text x="120" y="45" fill="#ffffff" fontSize="10" textAnchor="middle" fontWeight="bold">37.7k</text>
      <text x="120" y="196" fill="#a1a1aa" fontSize="9" textAnchor="middle">100k</text>

      {/* 500k: 36,667 */}
      <rect x="230" y="59" width="40" height="121" rx="3" fill="#ff5cad" />
      <text x="250" y="49" fill="#ffffff" fontSize="10" textAnchor="middle" fontWeight="bold">36.6k</text>
      <text x="250" y="196" fill="#a1a1aa" fontSize="9" textAnchor="middle">500k</text>

      {/* 1M: 33,495 */}
      <rect x="360" y="69" width="40" height="111" rx="3" fill="#ff5cad" />
      <text x="380" y="59" fill="#ffffff" fontSize="10" textAnchor="middle" fontWeight="bold">33.5k</text>
      <text x="380" y="196" fill="#a1a1aa" fontSize="9" textAnchor="middle">1M</text>

      {/* Axes */}
      <line x1="60" y1="40" x2="60" y2="180" stroke="#52525b" strokeWidth="1" />
      <line x1="60" y1="180" x2="460" y2="180" stroke="#52525b" strokeWidth="1" />

      {/* Axis values */}
      <text x="50" y="183" fill="#71717a" fontSize="8" textAnchor="end">0</text>
      <text x="50" y="133" fill="#71717a" fontSize="8" textAnchor="end">20k</text>
      <text x="50" y="83" fill="#71717a" fontSize="8" textAnchor="end">40k</text>
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
const tdMonoStyle = { padding: "10px 16px", fontFamily: "monospace" };
const tdBoldStyle = { padding: "10px 16px", fontWeight: 500, color: "#ffffff" };

export default function BenchmarkResultsDocsPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="benchmark-results-title">
              PebbleDB Performance: Benchmark Results
            </h1>

            <div className="guide-body-text" style={{ marginTop: 24 }}>
              <p>
                Measured on 2026-06-23 · Intel i9-14900HX · Windows 11 · Go 1.23.4 · Local NVMe.
              </p>

              {/* ── 1. Sequential Write ── */}
              <h2 className="guide-sub-heading" id="sequential-write" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                1. Sequential Write (Async Group Commit)
              </h2>
              <p>
                Each sub-benchmark runs one timed loop over the full dataset. Default memtable size (4 MiB), compaction held off at threshold 100.
              </p>

              <div style={{ overflowX: "auto", marginTop: 16, marginBottom: 20 }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={theadRowStyle}>
                      <th style={thStyle}>Dataset</th>
                      <th style={thStyle}>ops/sec</th>
                      <th style={thStyle}>MB/sec</th>
                      <th style={thStyle}>ns/op (per key)</th>
                      <th style={thStyle}>B/op (total)</th>
                      <th style={thStyle}>allocs/op (total)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>100k</td>
                      <td style={tdMonoStyle}>37,709</td>
                      <td style={tdMonoStyle}>5.11</td>
                      <td style={tdMonoStyle}>26,519</td>
                      <td style={tdMonoStyle}>83,454,424</td>
                      <td style={tdMonoStyle}>1,045,268</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>500k</td>
                      <td style={tdMonoStyle}>36,667</td>
                      <td style={tdMonoStyle}>4.97</td>
                      <td style={tdMonoStyle}>27,273</td>
                      <td style={tdMonoStyle}>436,613,456</td>
                      <td style={tdMonoStyle}>5,454,917</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>1M</td>
                      <td style={tdMonoStyle}>33,495</td>
                      <td style={tdMonoStyle}>4.54</td>
                      <td style={tdMonoStyle}>29,855</td>
                      <td style={tdMonoStyle}>883,065,984</td>
                      <td style={tdMonoStyle}>11,024,440</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>1.1 Scaling Analysis</h3>
              <WriteScalingChartSvg />

              <ul className="guide-bullets-list">
                <li>
                  <span className="highlight-text">~10% throughput drop from 100k → 1M</span>: As dataset grows, more memtable flushes occur, creating brief stalls while the flusher writes SSTables.
                </li>
                <li>
                  <span className="highlight-text">~11 allocs per key</span>: Dominated by WAL record encoding (<code className="inline-code">make([]byte, ...)</code> in <code className="inline-code">encodeRecord</code>) and skip list node allocation.
                </li>
                <li>
                  <span className="highlight-text">~83 B/key total memory</span>: Includes skip list pointers, WAL buffer, and transient allocations.
                </li>
              </ul>

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>1.2 Group Commit vs Sync Writes</h3>
              <div style={{ overflowX: "auto", marginTop: 16, marginBottom: 20 }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={theadRowStyle}>
                      <th style={thStyle}>Mode</th>
                      <th style={thStyle}>Measured ops/sec</th>
                      <th style={thStyle}>Relative</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>Async group commit (default)</td>
                      <td style={tdMonoStyle}>~37,000</td>
                      <td style={tdStyle}>1× (baseline)</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>SyncWrites: true</td>
                      <td style={tdMonoStyle}>~1,800</td>
                      <td style={tdStyle}>~20× slower</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div style={{ background: "rgba(192, 132, 252, 0.06)", border: "1px solid rgba(192, 132, 252, 0.25)", borderRadius: 8, padding: "16px 20px", marginTop: 16, marginBottom: 20 }}>
                <p style={{ color: "#c084fc", fontWeight: 600, marginBottom: 6, fontSize: 13 }}>Note: TIP</p>
                <p style={{ fontSize: 13, lineHeight: 1.7 }}>
                  The 20× gap is entirely due to fsync latency. Each sync write waits for the NVMe controller to acknowledge the write, while group commit batches multiple records per fsync.
                </p>
              </div>

              {/* ── 2. Random Read ── */}
              <h2 className="guide-sub-heading" id="random-read" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                2. Random Read (Parallel Get, Memtable-Only)
              </h2>
              <p>
                50k keys preloaded into 128 MiB memtable. GOMAXPROCS=4, 4 parallel goroutines, -benchtime=3s.
              </p>
              <div style={{ overflowX: "auto", marginTop: 16, marginBottom: 20 }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={theadRowStyle}>
                      <th style={thStyle}>Dataset</th>
                      <th style={thStyle}>ops/sec</th>
                      <th style={thStyle}>MB/sec</th>
                      <th style={thStyle}>ns/op</th>
                      <th style={thStyle}>B/op</th>
                      <th style={thStyle}>allocs/op</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>50k</td>
                      <td style={tdMonoStyle}>~3,083,000</td>
                      <td style={tdMonoStyle}>438</td>
                      <td style={tdMonoStyle}>324</td>
                      <td style={tdMonoStyle}>129</td>
                      <td style={tdMonoStyle}>1</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>2.1 Read Performance Analysis</h3>
              <div style={{ overflowX: "auto", marginTop: 16, marginBottom: 20 }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={theadRowStyle}>
                      <th style={thStyle}>Metric</th>
                      <th style={thStyle}>Value</th>
                      <th style={thStyle}>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>Throughput</td>
                      <td style={tdMonoStyle}>~3.1M ops/sec</td>
                      <td style={tdStyle}>4 goroutines on 4 cores</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>Per-read latency</td>
                      <td style={tdMonoStyle}>324 ns</td>
                      <td style={tdStyle}>Skip list O(log n) lookup</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>Memory per read</td>
                      <td style={tdMonoStyle}>129 bytes</td>
                      <td style={tdStyle}>Single allocation for value copy</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>Allocs per read</td>
                      <td style={tdMonoStyle}>1</td>
                      <td style={tdStyle}>Value slice returned to caller</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div style={{ background: "rgba(255, 92, 173, 0.06)", border: "1px solid rgba(255, 92, 173, 0.25)", borderRadius: 8, padding: "16px 20px", marginTop: 16, marginBottom: 20 }}>
                <p style={{ color: "#ff5cad", fontWeight: 600, marginBottom: 6, fontSize: 13 }}>Warning: IMPORTANT</p>
                <p style={{ fontSize: 13, lineHeight: 1.7 }}>
                  This benchmark measures hot memtable reads only. Data is never flushed to SSTables. Full LSM depth with cold block reads would show 10–100× higher latency per read.
                </p>
              </div>

              {/* ── 3. Scan Throughput ── */}
              <h2 className="guide-sub-heading" id="scan-throughput" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                3. Scan Throughput (Memtable-Only)
              </h2>
              <p>
                50k keys preloaded. Each iteration scans the listed key range once. ops/sec is keys/sec.
              </p>
              <div style={{ overflowX: "auto", marginTop: 16, marginBottom: 20 }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={theadRowStyle}>
                      <th style={thStyle}>Range</th>
                      <th style={thStyle}>ops/sec (keys)</th>
                      <th style={thStyle}>MB/sec</th>
                      <th style={thStyle}>ns/op (per scan)</th>
                      <th style={thStyle}>B/op</th>
                      <th style={thStyle}>allocs/op</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>1k</td>
                      <td style={tdMonoStyle}>199,455</td>
                      <td style={tdMonoStyle}>27.0</td>
                      <td style={tdMonoStyle}>5,013,656</td>
                      <td style={tdMonoStyle}>10,002,070</td>
                      <td style={tdMonoStyle}>100,010</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>10k</td>
                      <td style={tdMonoStyle}>1,915,905</td>
                      <td style={tdMonoStyle}>259.5</td>
                      <td style={tdMonoStyle}>5,219,465</td>
                      <td style={tdMonoStyle}>10,002,068</td>
                      <td style={tdMonoStyle}>100,010</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>50k</td>
                      <td style={tdMonoStyle}>7,638,287</td>
                      <td style={tdMonoStyle}>1,034</td>
                      <td style={tdMonoStyle}>6,545,970</td>
                      <td style={tdMonoStyle}>10,002,056</td>
                      <td style={tdMonoStyle}>100,009</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>3.1 Scan Scaling Analysis</h3>
              <ul className="guide-bullets-list">
                <li>
                  <span className="highlight-text">Keys/sec scales linearly with range size</span>: Amortized iterator setup cost. Larger scans are more efficient per-key.
                </li>
                <li>
                  <span className="highlight-text">~10 MB fixed overhead per scan</span>: Dominated by memtable snapshot copy (Snapshot() allocates a full copy).
                </li>
                <li>
                  <span className="highlight-text">~100k allocs per scan regardless of range</span>: Snapshot node copying. This is the cost of scan isolation.
                </li>
                <li>
                  <span className="highlight-text">~1 GB/sec at 50k keys</span>: Limited by memory allocation throughput, not disk I/O.
                </li>
              </ul>

              {/* ── 4. Bottleneck Summary ── */}
              <h2 className="guide-sub-heading" id="bottleneck" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                4. Bottleneck Summary
              </h2>
              <div style={{ overflowX: "auto", marginTop: 16, marginBottom: 20 }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={theadRowStyle}>
                      <th style={thStyle}>Operation</th>
                      <th style={thStyle}>Primary Bottleneck</th>
                      <th style={thStyle}>Secondary Bottleneck</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>Sequential Write</td>
                      <td style={tdStyle}>Fsync latency (WAL batch)</td>
                      <td style={tdStyle}>Skip list allocation</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>Random Read</td>
                      <td style={tdStyle}>Skip list traversal depth</td>
                      <td style={tdStyle}>—</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>Range Scan</td>
                      <td style={tdStyle}>Snapshot copy allocation</td>
                      <td style={tdStyle}>Iterator advance</td>
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

import React from "react";
import DocsNavbar from "@/components/docs/DocsNavbar";
import DocsSidebar from "@/components/docs/DocsSidebar";
import GoCodeBlock from "@/components/docs/GoCodeBlock";

const pageTopics = [
  { label: "Benchmark Environment", href: "#environment" },
  { label: "Benchmark Suite", href: "#suite" },
  { label: "Running Benchmarks", href: "#running" },
  { label: "Async vs Sync Write Semantics", href: "#semantics" },
  { label: "Reproducibility Practices", href: "#reproducibility" },
];

const PRELOAD_CODE = `func benchPreload(b *testing.B, opts Options, dataset int) (*DB, [][]byte) {
    dir := b.TempDir()
    opts.Dir = dir
    if opts.MemtableSize == 0 {
        opts.MemtableSize = 128 << 20  // 128 MiB to keep data in memtable
    }
    if opts.CompactionThreshold == 0 {
        opts.CompactionThreshold = benchCompactionHoldoff // 100
    }
    db, err := Open(opts)
    // ... load keys, await batch persist, verify first+last key
}`;

const REPORT_CODE = `func reportThroughput(b *testing.B, ops int, bytesPerOp int) {
    secs := b.Elapsed().Seconds()
    b.ReportMetric(float64(ops)/secs, "ops/sec")
    if bytesPerOp > 0 {
        b.ReportMetric(float64(ops*bytesPerOp)/secs/(1024*1024), "MB/sec")
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
const tdBoldStyle = { padding: "10px 16px", fontWeight: 500, color: "#ffffff" };
const tdMonoStyle = { padding: "10px 16px", fontFamily: "monospace" };

export default function BenchmarkMethodologyDocsPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="benchmark-methodology-title">
              PebbleDB Performance: Benchmark Methodology
            </h1>

            <div className="guide-body-text" style={{ marginTop: 24 }}>
              <p>
                This document specifies how PebbleDB benchmarks are structured, run, and interpreted, including environment configuration, test isolation, durability mode semantics, and reproducibility practices.
              </p>

              {/* ── 1. Benchmark Environment ── */}
              <h2 className="guide-sub-heading" id="environment" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                1. Benchmark Environment
              </h2>
              <div style={{ overflowX: "auto", marginTop: 16, marginBottom: 20 }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={theadRowStyle}>
                      <th style={thStyle}>Setting</th>
                      <th style={thStyle}>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>CPU</td>
                      <td style={tdStyle}>Intel Core i9-14900HX</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>OS</td>
                      <td style={tdStyle}>Windows 11 amd64</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>Go version</td>
                      <td style={tdStyle}>1.23.4 (go.mod)</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>Disk</td>
                      <td style={tdStyle}>Local NVMe (laptop SSD)</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>GOMAXPROCS</td>
                      <td style={tdStyle}>32 (default); BenchmarkRandomRead sets 4</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>MemtableSize</td>
                      <td style={tdStyle}>4 MiB default; 128 MiB in read/scan preload</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>CompactionThreshold</td>
                      <td style={tdStyle}>100 in benches (compaction held off)</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>Value size</td>
                      <td style={tdStyle}>128 bytes (benchPayload)</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>Key format</td>
                      <td style={tdStyle}>key-%010d (14 bytes)</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* ── 2. Benchmark Suite ── */}
              <h2 className="guide-sub-heading" id="suite" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                2. Benchmark Suite
              </h2>
              <p>
                All benchmarks live in <code className="inline-code">bench_test.go</code>.
              </p>
              <div style={{ overflowX: "auto", marginTop: 16, marginBottom: 20 }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={theadRowStyle}>
                      <th style={thStyle}>Benchmark</th>
                      <th style={thStyle}>What It Measures</th>
                      <th style={thStyle}>Includes</th>
                      <th style={thStyle}>Excludes</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>BenchmarkSequentialWrite</td>
                      <td style={tdStyle}>Put throughput at 100k/500k/1M keys</td>
                      <td style={tdStyle}>Memtable insert, batch WAL, background flush</td>
                      <td style={tdStyle}>Per-key sync (unless batch threshold fires)</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>BenchmarkRandomRead</td>
                      <td style={tdStyle}>Parallel Get (4 goroutines) over 50k keys</td>
                      <td style={tdStyle}>Bloom + memtable lookup</td>
                      <td style={tdStyle}>SST cold path (preload stays in memtable)</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>BenchmarkScanThroughput</td>
                      <td style={tdStyle}>Range scans of 1k/10k/50k keys</td>
                      <td style={tdStyle}>Merge iterator over memtable snapshot</td>
                      <td style={tdStyle}>Concurrent writes during scan</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>2.1 Key Implementation Details</h3>
              <p>
                Preloading dataset into memtable (<code className="inline-code">benchPreload</code>):
              </p>
              <GoCodeBlock>{PRELOAD_CODE}</GoCodeBlock>

              <p>
                Custom throughput reporting helper (<code className="inline-code">reportThroughput</code>):
              </p>
              <GoCodeBlock>{REPORT_CODE}</GoCodeBlock>

              {/* ── 3. Running Benchmarks ── */}
              <h2 className="guide-sub-heading" id="running" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                3. Running Benchmarks
              </h2>
              <p>
                Use standard Go tools to execute the benchmarks:
              </p>
              <pre className="guide-code-pre" style={{ background: "#18181b", padding: "12px", borderRadius: "6px", overflowX: "auto", margin: "16px 0" }}>
                <code>{`# Full Suite
go test -bench=. -benchmem -count=1 ./internal/db

# Targeted Runs
go test -bench=BenchmarkSequentialWrite -benchmem -count=1 -benchtime=3s ./internal/db
go test -bench=BenchmarkRandomRead -benchmem -count=1 -benchtime=3s ./internal/db
go test -bench=BenchmarkScanThroughput -benchmem -count=1 ./internal/db`}</code>
              </pre>

              <p>
                For PowerShell on Windows:
              </p>
              <pre className="guide-code-pre" style={{ background: "#18181b", padding: "12px", borderRadius: "6px", overflowX: "auto", margin: "16px 0" }}>
                <code>{`go test ./internal/db -run=NonExistent "-bench=." -benchmem -count=1`}</code>
              </pre>

              <div style={{ background: "rgba(255, 92, 173, 0.06)", border: "1px solid rgba(255, 92, 173, 0.25)", borderRadius: 8, padding: "16px 20px", marginTop: 16, marginBottom: 20 }}>
                <p style={{ color: "#ff5cad", fontWeight: 600, marginBottom: 6, fontSize: 13 }}>Warning: WARNING & CAUTION</p>
                <p style={{ fontSize: 13, lineHeight: 1.7 }}>
                  <code className="inline-code">-count=1</code> is critical to prevent cached results.
                  <br />
                  Do <strong>NOT</strong> run timing benchmarks with <code className="inline-code">-race</code> enabled; it introduces roughly ~10× profiling overhead.
                </p>
              </div>

              {/* ── 4. Durability Semantics ── */}
              <h2 className="guide-sub-heading" id="semantics" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                4. Async vs Sync Write Semantics
              </h2>
              <div style={{ overflowX: "auto", marginTop: 16, marginBottom: 20 }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={theadRowStyle}>
                      <th style={thStyle}>Mode</th>
                      <th style={thStyle}>How to Benchmark</th>
                      <th style={thStyle}>What It Measures</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>Default group commit</td>
                      <td style={tdMonoStyle}>BenchmarkSequentialWrite as-is</td>
                      <td style={tdStyle}>Batch WAL throughput</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>Per-op durable</td>
                      <td style={tdMonoStyle}>Options{`{SyncWrites: true}`} in custom bench</td>
                      <td style={tdStyle}>Fsync-per-write throughput</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* ── 5. Reproducibility ── */}
              <h2 className="guide-sub-heading" id="reproducibility" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                5. Reproducibility Practices
              </h2>
              <div style={{ overflowX: "auto", marginTop: 16, marginBottom: 20 }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={theadRowStyle}>
                      <th style={thStyle}>Practice</th>
                      <th style={thStyle}>Implementation Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>Directory isolation</td>
                      <td style={tdStyle}><code className="inline-code">b.TempDir()</code> per benchmark run</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>Per-goroutine RNG</td>
                      <td style={tdStyle}><code className="inline-code">rand.New(rand.NewSource(...))</code> in parallel read bench</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>Statistical validity</td>
                      <td style={tdStyle}>Run ≥ 3 times, report median</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>Flush stall awareness</td>
                      <td style={tdStyle}>Write benchmark variance is expected due to background flush</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>Compaction holdoff</td>
                      <td style={tdStyle}><code className="inline-code">CompactionThreshold: 100</code> prevents background compaction noise</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>Cache warmth</td>
                      <td style={tdStyle}>Read/scan benchmarks preload into a large (128 MiB) memtable</td>
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

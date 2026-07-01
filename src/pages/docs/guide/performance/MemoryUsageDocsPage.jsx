import React from "react";
import DocsNavbar from "@/components/docs/DocsNavbar";
import DocsSidebar from "@/components/docs/DocsSidebar";
import GoCodeBlock from "@/components/docs/GoCodeBlock";

const pageTopics = [
  { label: "Memory Architecture", href: "#architecture" },
  { label: "Component-Level Analysis", href: "#components" },
  { label: "Memory Scaling Table", href: "#scaling-table" },
  { label: "Configuration Knobs", href: "#configuration" },
];

const BLOCK_CACHE_CODE = `type BlockCache struct {
    inner *lru.Cache[blockCacheKey, []byte]
    mu    sync.Mutex
    bytes int
    max   int
}`;

const EVICTION_CODE = `func (c *BlockCache) add(key blockCacheKey, block []byte) {
    // ... add to cache ...
    for c.bytes > c.max {
        _, v, ok := c.inner.RemoveOldest()
        if !ok { break }
        c.bytes -= len(v)
    }
}`;

function MemoryBudgetChartSvg() {
  const budget = [
    { label: "Active Memtable", val: 76, color: "#ff5cad" },
    { label: "Pending Flush Queue", val: 10, color: "#c084fc" },
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

export default function MemoryUsageDocsPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="memory-usage-title">
              PebbleDB Performance: Memory Usage
            </h1>

            <div className="guide-body-text" style={{ marginTop: 24 }}>
              <p>
                This document analyzes PebbleDB&apos;s memory consumption across all subsystems, detailing allocation patterns, sizing formulas, and configuration knobs.
              </p>

              {/* ── 1. Memory Architecture ── */}
              <h2 className="guide-sub-heading" id="architecture" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                1. Memory Architecture
              </h2>
              <MemoryBudgetChartSvg />

              {/* ── 2. Component-Level Analysis ── */}
              <h2 className="guide-sub-heading" id="components" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                2. Component-Level Analysis
              </h2>

              <h3 style={{ color: "#ffffff", marginTop: 16 }}>2.1 Active Memtable (memtable.SkipList)</h3>
              <p>
                <strong>Default cap:</strong> 4 MiB (defaultMemtableSize)
                <br />
                <strong>Configurable:</strong> Yes (Options.MemtableSize)
                <br />
                <strong>Structure:</strong> Probabilistic skip list with per-node tower allocations.
                <br />
                <strong>Size tracking:</strong> Approximate: key + value + 64 bytes per node (estimated tower overhead).
              </p>
              <p>
                Per-entry memory formula:
              </p>
              <pre className="guide-code-pre" style={{ background: "#18181b", padding: "12px", borderRadius: "6px", overflowX: "auto", margin: "12px 0" }}>
                <code>
                  entryMem ≈ keyLen + valueLen + 64
                </code>
              </pre>
              <p style={{ fontSize: 13, color: "#a1a1aa", marginLeft: 8 }}>
                * The 64 bytes accounts for skip list node struct, forward pointers (average height ~1.3 levels × pointer size), and Go object header.
              </p>

              <h3 style={{ color: "#ffffff", marginTop: 16 }}>2.2 Pending Flush Queue</h3>
              <p>
                <strong>Size:</strong> 0 to N frozen memtables (each ≤ MemtableSize)
                <br />
                <strong>Freed when:</strong> After successful <code className="inline-code">flushImmutable()</code> dequeues the entry.
                <br />
                <strong>Worst case:</strong> If flush stalls, multiple frozen memtables accumulate.
              </p>

              <h3 style={{ color: "#ffffff", marginTop: 16 }}>2.3 Block Cache (sstable.BlockCache)</h3>
              <p>
                <strong>Default cap:</strong> 32 MiB (DefaultBlockCacheBytes)
                <br />
                <strong>Configurable:</strong> Yes (Options.BlockCacheSize); negative disables.
                <br />
                <strong>Eviction:</strong> Byte-bounded LRU (evicts oldest blocks when byte total exceeds max).
                <br />
                <strong>Key format:</strong> <code className="inline-code">{`{fileID uint64, offset uint64}`}</code> — unique per block per file.
              </p>
              <GoCodeBlock>{BLOCK_CACHE_CODE}</GoCodeBlock>
              <p>Eviction loop implementation:</p>
              <GoCodeBlock>{EVICTION_CODE}</GoCodeBlock>

              <h3 style={{ color: "#ffffff", marginTop: 16 }}>2.4 Bloom Filters (Per SST, Resident in Memory)</h3>
              <p>
                Each SSTable&apos;s bloom filter is loaded into memory on <code className="inline-code">OpenReader</code> and stays resident for the reader&apos;s lifetime.
                <br />
                <strong>Bits per key:</strong> ~10 bits (at 1% FPR)
                <br />
                <strong>Bytes per key:</strong> ~1.2 bytes
                <br />
                <strong>Hash functions:</strong> ~7 (calculated from bits/key)
              </p>
              <p>Sizing formula:</p>
              <pre className="guide-code-pre" style={{ background: "#18181b", padding: "12px", borderRadius: "6px", overflowX: "auto", margin: "12px 0" }}>
                <code>
                  bloomBytes = ceil( -n * ln(p) / ( (ln 2)^2 * 8 ) )
                </code>
              </pre>
              <p style={{ fontSize: 13, color: "#a1a1aa", marginLeft: 8 }}>
                * For 10,000 keys at 1% FPR: ~12,000 bytes (11.7 KiB).
              </p>

              <h3 style={{ color: "#ffffff", marginTop: 16 }}>2.5 Index Blocks (Per SST, Resident in Memory)</h3>
              <p>
                Each SSTable&apos;s index is loaded on <code className="inline-code">OpenReader</code>. One index entry per data block.
                <br />
                <strong>Entry size:</strong> 4 + keyLen + 8 + 8 = 20 + keyLen bytes
                <br />
                <strong>Entries per SST:</strong> ceil(dataSize / blockSize)
                <br />
                * For 4 KiB blocks, 14-byte keys: ~34 bytes per data block.
              </p>

              <h3 style={{ color: "#ffffff", marginTop: 16 }}>2.6 WAL Write Buffers</h3>
              <p>
                <strong>Per-record:</strong> 13 + keyLen + valueLen bytes (transient; freed after write)
                <br />
                <strong>Batch buffer:</strong> <code className="inline-code">pendingBatch</code> slice of <code className="inline-code">wal.Record</code> structs
                <br />
                <strong>Max accumulation:</strong> Until batch timer fires (1 ms) or batch threshold reached.
              </p>

              <h3 style={{ color: "#ffffff", marginTop: 16 }}>2.7 Scan Snapshot Memory</h3>
              <p>
                Each <code className="inline-code">Scan()</code> creates a snapshot copy of the active memtable under brief RLock:
                <br />
                <strong>Size:</strong> Proportional to active memtable size at creation time.
                <br />
                <strong>Lifetime:</strong> Until <code className="inline-code">Iterator.Close()</code> is called.
                <br />
                <strong>Freed:</strong> GC collects after close.
              </p>

              <div style={{ background: "rgba(255, 92, 173, 0.06)", border: "1px solid rgba(255, 92, 173, 0.25)", borderRadius: 8, padding: "16px 20px", marginTop: 16, marginBottom: 20 }}>
                <p style={{ color: "#ff5cad", fontWeight: 600, marginBottom: 6, fontSize: 13 }}>Warning: WARNING</p>
                <p style={{ fontSize: 13, lineHeight: 1.7 }}>
                  Large memtables (e.g., 128 MiB for benchmarks) create proportionally large scan snapshots. In production, this is the primary memory-spike source.
                </p>
              </div>

              {/* ── 3. Memory Scaling Table ── */}
              <h2 className="guide-sub-heading" id="scaling-table" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                3. Memory Scaling Table
              </h2>
              <div style={{ overflowX: "auto", marginTop: 16, marginBottom: 20 }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={theadRowStyle}>
                      <th style={thStyle}>Keys in DB</th>
                      <th style={thStyle}>Active Memtable</th>
                      <th style={thStyle}>Block Cache</th>
                      <th style={thStyle}>Bloom Filters (all SSTs)</th>
                      <th style={thStyle}>Index Blocks (all SSTs)</th>
                      <th style={thStyle}>Total Estimate</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>10k</td>
                      <td style={tdStyle}>~1 MiB</td>
                      <td style={tdStyle}>32 MiB</td>
                      <td style={tdStyle}>~12 KiB</td>
                      <td style={tdStyle}>~3 KiB</td>
                      <td style={tdBoldStyle}>~33 MiB</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>100k</td>
                      <td style={tdStyle}>~4 MiB</td>
                      <td style={tdStyle}>32 MiB</td>
                      <td style={tdStyle}>~120 KiB</td>
                      <td style={tdStyle}>~30 KiB</td>
                      <td style={tdBoldStyle}>~36 MiB</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>1M</td>
                      <td style={tdStyle}>~4 MiB</td>
                      <td style={tdStyle}>32 MiB</td>
                      <td style={tdStyle}>~1.2 MiB</td>
                      <td style={tdStyle}>~300 KiB</td>
                      <td style={tdBoldStyle}>~37.5 MiB</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>10M</td>
                      <td style={tdStyle}>~4 MiB</td>
                      <td style={tdStyle}>32 MiB</td>
                      <td style={tdStyle}>~12 MiB</td>
                      <td style={tdStyle}>~3 MiB</td>
                      <td style={tdBoldStyle}>~51 MiB</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div style={{ background: "rgba(192, 132, 252, 0.06)", border: "1px solid rgba(192, 132, 252, 0.25)", borderRadius: 8, padding: "16px 20px", marginTop: 16, marginBottom: 20 }}>
                <p style={{ color: "#c084fc", fontWeight: 600, marginBottom: 6, fontSize: 13 }}>Note: NOTE</p>
                <p style={{ fontSize: 13, lineHeight: 1.7 }}>
                  Block cache dominates at small dataset sizes. Bloom filter memory dominates at larger dataset sizes. The memtable is constant because it flushes at the configured threshold.
                </p>
              </div>

              {/* ── 4. Configuration Knobs ── */}
              <h2 className="guide-sub-heading" id="configuration" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                4. Configuration Knobs
              </h2>
              <div style={{ overflowX: "auto", marginTop: 16, marginBottom: 20 }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={theadRowStyle}>
                      <th style={thStyle}>Knob</th>
                      <th style={thStyle}>Default</th>
                      <th style={thStyle}>Effect on Memory</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>MemtableSize</td>
                      <td style={tdMonoStyle}>4 MiB</td>
                      <td style={tdStyle}>Directly controls active + pending flush memory</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>BlockCacheSize</td>
                      <td style={tdMonoStyle}>32 MiB</td>
                      <td style={tdStyle}>Directly controls cache memory; negative disables</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>CompactionThreshold</td>
                      <td style={tdMonoStyle}>4</td>
                      <td style={tdStyle}>Lower = fewer SSTs = less bloom/index memory but more compaction I/O</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>Bloom filter FPR</td>
                      <td style={tdMonoStyle}>1% (hardcoded)</td>
                      <td style={tdStyle}>Lower FPR = more bits per key = more memory</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>Block size</td>
                      <td style={tdMonoStyle}>4 KiB (hardcoded)</td>
                      <td style={tdStyle}>Larger blocks = fewer index entries = less index memory</td>
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

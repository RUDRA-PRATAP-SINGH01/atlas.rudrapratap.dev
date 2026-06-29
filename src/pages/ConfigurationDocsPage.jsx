import React from "react";
import DocsNavbar from "../components/DocsNavbar";
import DocsSidebar from "../components/DocsSidebar";
import GoCodeBlock from "../components/GoCodeBlock";

const pageTopics = [
  { label: "Options Struct", href: "#options-struct" },
  { label: "Configuration Parameters", href: "#parameters" },
];

const OPTIONS_CODE = `type Options struct {
	Dir                     string
	MemtableSize            int64
	CompactionThreshold     int
	WALReplayLimits         wal.ReplayLimits
	BlockCacheSize          int64
	SyncWrites              bool
	BlockWritesOnFlushError *bool
	BatchFlushDelay         time.Duration
}`;

const REPLAY_LIMITS_CODE = `type ReplayLimits struct {
	MaxFileSize   int64
	MaxKeySize    uint32
	MaxValueSize  uint32
	MaxRecordSize uint32
}`;

export default function ConfigurationDocsPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="configuration-title">
              PebbleDB Subsystem: Configuration
            </h1>

            <div className="guide-body-text" style={{ marginTop: 24 }}>
              <p>
                This document specifies the database configuration options in PebbleDB, detailing parameter ranges, default values, and environment variables.
              </p>

              {/* ── 1. Options Struct ── */}
              <h2 className="guide-sub-heading" id="options-struct" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                1. Options Struct
              </h2>
              <p>
                The database configuration is controlled via the <code className="inline-code">db.Options</code> struct:
              </p>
              <GoCodeBlock>{OPTIONS_CODE}</GoCodeBlock>

              {/* ── 2. Configuration Parameters ── */}
              <h2 className="guide-sub-heading" id="parameters" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                2. Configuration Parameters
              </h2>

              <h3 style={{ color: "#ffffff", marginTop: 16 }}>2.1 Dir (Data Directory)</h3>
              <ul className="guide-bullets-list">
                <li><strong>Type:</strong> string</li>
                <li><strong>Default:</strong> Required (returns <code className="inline-code">ErrEmptyDir</code> if empty).</li>
                <li><strong>CLI Fallback:</strong> <code className="inline-code">./pebbledb-data</code> (or the environment variable <code className="inline-code">PEBBLEDB_DIR</code>).</li>
                <li><strong>Description:</strong> The filesystem directory where all database files (WAL, SSTables, Manifest, LOCK) are stored.</li>
              </ul>

              <h3 style={{ color: "#ffffff", marginTop: 16 }}>2.2 MemtableSize</h3>
              <ul className="guide-bullets-list">
                <li><strong>Type:</strong> int64</li>
                <li><strong>Default:</strong> <code className="inline-code">4 &lt;&lt; 20</code> (4 MiB) if ≤ 0.</li>
                <li><strong>Description:</strong> The maximum size in bytes of the active memtable before it is frozen and flushed to an SSTable.</li>
                <li><strong>Performance Impact:</strong> Larger memtables improve write throughput by reducing flush stalls, but increase memory usage and scan snapshot copy times.</li>
              </ul>

              <h3 style={{ color: "#ffffff", marginTop: 16 }}>2.3 CompactionThreshold</h3>
              <ul className="guide-bullets-list">
                <li><strong>Type:</strong> int</li>
                <li><strong>Default:</strong> 4 if 0. Set to -1 to disable background compaction.</li>
                <li><strong>Description:</strong> The number of live SSTables on disk that triggers background compaction.</li>
                <li><strong>Performance Impact:</strong> Lower thresholds reduce read amplification, but increase write amplification due to frequent compactions.</li>
              </ul>

              <h3 style={{ color: "#ffffff", marginTop: 16 }}>2.4 WALReplayLimits</h3>
              <ul className="guide-bullets-list">
                <li><strong>Type:</strong> wal.ReplayLimits</li>
                <li><strong>Default:</strong> Verified by <code className="inline-code">wal.DefaultReplayLimits()</code>.</li>
                <li><strong>Description:</strong> Enforces size limits during WAL replay to prevent out-of-memory (OOM) errors on corrupt logs.</li>
              </ul>
              <GoCodeBlock>{REPLAY_LIMITS_CODE}</GoCodeBlock>
              <p>Defaults:</p>
              <ul className="guide-bullets-list">
                <li><strong>MaxFileSize:</strong> 64 MiB</li>
                <li><strong>MaxKeySize:</strong> 1 MiB</li>
                <li><strong>MaxValueSize:</strong> 16 MiB</li>
                <li><strong>MaxRecordSize:</strong> 17 MiB</li>
              </ul>

              <h3 style={{ color: "#ffffff", marginTop: 16 }}>2.5 BlockCacheSize</h3>
              <ul className="guide-bullets-list">
                <li><strong>Type:</strong> int64</li>
                <li><strong>Default:</strong> <code className="inline-code">32 &lt;&lt; 20</code> (32 MiB) if 0. Set to a negative value to disable caching.</li>
                <li><strong>Description:</strong> The maximum byte size of the LRU data-block cache.</li>
                <li><strong>Performance Impact:</strong> Larger block caches reduce read I/O latency for frequently read keys.</li>
              </ul>

              <h3 style={{ color: "#ffffff", marginTop: 16 }}>2.6 SyncWrites</h3>
              <ul className="guide-bullets-list">
                <li><strong>Type:</strong> bool</li>
                <li><strong>Default:</strong> false</li>
                <li><strong>Description:</strong> When enabled, the database calls Sync() on the WAL before Put or Delete operations return.</li>
                <li><strong>Performance Impact:</strong> When disabled (default), writes are batched and group-committed asynchronously, improving write throughput by up to 20×.</li>
              </ul>

              <h3 style={{ color: "#ffffff", marginTop: 16 }}>2.7 BlockWritesOnFlushError</h3>
              <ul className="guide-bullets-list">
                <li><strong>Type:</strong> *bool</li>
                <li><strong>Default:</strong> true if nil.</li>
                <li><strong>Description:</strong> When enabled, the database blocks new writes if a background flush failure occurs, preventing memory exhaustion.</li>
                <li><strong>Performance Impact:</strong> When disabled, writes are allowed to continue during background errors, which can lead to out-of-memory errors if the flush queue stalls.</li>
              </ul>

              <h3 style={{ color: "#ffffff", marginTop: 16 }}>2.8 BatchFlushDelay</h3>
              <ul className="guide-bullets-list">
                <li><strong>Type:</strong> time.Duration</li>
                <li><strong>Default:</strong> 1ms if ≤ 0.</li>
                <li><strong>Description:</strong> The maximum delay before the batch flusher writes a pending WAL batch to disk.</li>
                <li><strong>Performance Impact:</strong> Larger delays improve write throughput under concurrent workloads by batching more writes, but increase write latency.</li>
              </ul>

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

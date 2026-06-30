import React from "react";
import DocsNavbar from "@/components/docs/DocsNavbar";
import DocsSidebar from "@/components/docs/DocsSidebar";

const pageTopics = [
  { label: "Directory Tree", href: "#directory-tree" },
  { label: "Component File Map", href: "#file-map" },
];

export default function ProjectStructureDocsPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="project-structure-title">
              PebbleDB Subsystem: Project Structure
            </h1>

            <div className="guide-body-text" style={{ marginTop: 24 }}>
              <p>
                This document details the file directory layout and repository organization of PebbleDB, mapping every package, internal component, and configuration file.
              </p>

              {/* ── 1. Directory Tree ── */}
              <h2 className="guide-sub-heading" id="directory-tree" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                1. Directory Tree
              </h2>
              <pre className="guide-code-pre" style={{ background: "#18181b", padding: "12px", borderRadius: "6px", overflowX: "auto", margin: "16px 0" }}>
                <code>{`PebbleDB/
├── .github/workflows/          ← CI workflow configurations
├── cmd/
│   └── pebbledb/               ← CLI Entrypoint package (main, cli, main_test)
├── docs/
│   ├── architecture/           ← Detailed diagrams and design specifications
│   ├── benchmarks/             ← Benchmark methodologies and results
│   ├── design/                 ← Core invariants, design decisions, and tradeoffs
│   └── postmortems/            ← Technical postmortems of concurrency/recovery bugs
├── internal/
│   ├── bloom/                  ← Bloom filter implementation
│   ├── db/                     ← Database engine core and orchestration
│   ├── iterator/               ← K-way merge iterator implementation
│   ├── manifest/               ← Manifest log and live SSTable set tracking
│   ├── memtable/               ← Concurrent SkipList implementation
│   ├── sstable/                ← Block-level SST reader, writer, and caches
│   └── wal/                    ← Write-Ahead Log reader, writer, and limits
├── go.mod                      ← Go module definition
├── go.sum                      ← Go dependency checksums
├── LICENSE                     ← MIT license file
└── README.md                   ← Project overview and getting started guide`}</code>
              </pre>

              {/* ── 2. Component File Map ── */}
              <h2 className="guide-sub-heading" id="file-map" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                2. Component File Map
              </h2>

              <h3 style={{ color: "#ffffff", marginTop: 16 }}>2.1 Core Database Engine (internal/db/)</h3>
              <ul className="guide-bullets-list">
                <li><span className="highlight-text">db.go</span>: DB struct definition, database initialization (Open), directory LOCK file hooks, SST loading, and background worker threads.</li>
                <li><span className="highlight-text">close.go</span>: Shutdown sequence (Close), bounded timeouts, incomplete close abort state preservation.</li>
                <li><span className="highlight-text">write.go / put.go / delete.go</span>: Write paths, write blocking on background errors, and tombstones insertion.</li>
                <li><span className="highlight-text">batch.go / batch_persist.go</span>: Group commits, batch synchronization barriers, and WAL write grouping.</li>
                <li><span className="highlight-text">flush.go</span>: Memtable swapping, immutable queue management, SSTable serialization, manifest registration, and WAL truncation triggers.</li>
                <li><span className="highlight-text">wal_state.go</span>: wal.flush checkpoint serialization, validation, and recovery start offset calculation.</li>
                <li><span className="highlight-text">compactor.go / compaction.go</span>: Background compaction, selection of files, and manifest update.</li>
                <li><span className="highlight-text">get.go / scan.go</span>: Read paths, point lookup hierarchy, and copy-on-read memtable snapshots.</li>
                <li><span className="highlight-text">dir_lock.go / dir_lock_windows.go / dir_lock_unix.go</span>: Platform-specific file locking configurations.</li>
                <li><span className="highlight-text">bg_errors.go</span>: Background error stores, write blocking rules.</li>
                <li><span className="highlight-text">crashpoint.go</span>: Compile-time crash recovery exits.</li>
              </ul>

              <h3 style={{ color: "#ffffff", marginTop: 16 }}>2.2 Volatile Storage (internal/memtable/)</h3>
              <ul className="guide-bullets-list">
                <li><span className="highlight-text">memtable.go</span>: Thread-safe probabilistic SkipList implementation.</li>
                <li><span className="highlight-text">iterator.go</span>: SkipList iterator.</li>
              </ul>

              <h3 style={{ color: "#ffffff", marginTop: 16 }}>2.3 Immutable Storage (internal/sstable/)</h3>
              <ul className="guide-bullets-list">
                <li><span className="highlight-text">writer.go / reader.go</span>: Block-level SSTable writer and reader.</li>
                <li><span className="highlight-text">block.go</span>: Binary data block formats, block iterators, and seek operations.</li>
                <li><span className="highlight-text">index.go</span>: SST index entry serialization.</li>
                <li><span className="highlight-text">footer.go</span>: 48-byte validating footer format.</li>
                <li><span className="highlight-text">cache.go</span>: LRU block cache.</li>
              </ul>

              <h3 style={{ color: "#ffffff", marginTop: 16 }}>2.4 Recovery Logs (internal/wal/ &amp; internal/manifest/)</h3>
              <ul className="guide-bullets-list">
                <li><span className="highlight-text">wal.go</span>: Write-Ahead Log writer, seek-reader, recovery tail-salvaging, and copy-rename truncation.</li>
                <li><span className="highlight-text">limits.go</span>: WAL size limits, OOM prevention validation.</li>
                <li><span className="highlight-text">manifest.go / format.go</span>: Manifest edit tag serialization, replay state machines, and log rotations.</li>
              </ul>

              <h3 style={{ color: "#ffffff", marginTop: 16 }}>2.5 CLI Utility (cmd/pebbledb/)</h3>
              <ul className="guide-bullets-list">
                <li><span className="highlight-text">main.go</span>: CLI application main entrypoint.</li>
                <li><span className="highlight-text">cli.go</span>: CLI parsing, command routing, exit code mappings.</li>
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

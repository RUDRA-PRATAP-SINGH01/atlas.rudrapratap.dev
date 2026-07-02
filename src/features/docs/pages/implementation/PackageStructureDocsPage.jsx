import React from "react";
import DocsNavbar from "@/features/docs/components/DocsNavbar";
import DocsSidebar from "@/features/docs/components/DocsSidebar";
import DocsMermaid from "@/features/docs/components/DocsMermaid";
import GoCodeBlock from "@/features/docs/components/GoCodeBlock";

const pageTopics = [
  { label: "Package Tree & Directory Roles", href: "#directory-roles" },
  { label: "Dependency Graph", href: "#dependency-graph" },
  { label: "Structural Ownership Mapping", href: "#structural-ownership" },
];

const DEPENDENCY_GRAPH_CHART = `flowchart TD
    db["internal/db"] --> wal["internal/wal"]
    db --> memtable["internal/memtable"]
    db --> sstable["internal/sstable"]
    db --> manifest["internal/manifest"]
    db --> iterator["internal/iterator"]
    sstable --> bloom["internal/bloom"]
    
    style db fill:#18181b,stroke:#ff5cad,stroke-width:1.5px
    style wal fill:#18181b,stroke:#52525b,stroke-width:1px
    style memtable fill:#18181b,stroke:#52525b,stroke-width:1px
    style sstable fill:#18181b,stroke:#52525b,stroke-width:1px
    style manifest fill:#18181b,stroke:#52525b,stroke-width:1px
    style iterator fill:#18181b,stroke:#52525b,stroke-width:1px
    style bloom fill:#18181b,stroke:#52525b,stroke-width:1px`;

const OWNERSHIP_CODE = `type DB struct {
    mu           sync.RWMutex
    dir          string
    
    // Volatile RAM Structures
    active       *memtable.SkipList
    pendingFlush []flushQueueEntry
    
    // Durable WAL & Manifest Logs
    wal          *wal.WAL
    manifest     *manifest.Log
    
    // On-Disk Readers (protected by Atomic Snapshot)
    sstables     []*sstable.Reader
    sstablesSnap atomic.Pointer[[]*sstable.Reader]
    
    // Caches & Shared Systems
    blockCache   *sstable.BlockCache
    bgErrs       *backgroundErrStore
    dirLock      *os.File
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
const tdMonoStyle = { padding: "10px 16px", fontFamily: "monospace" };
const tdBoldStyle = { padding: "10px 16px", fontWeight: 500, color: "#ffffff" };

export default function PackageStructureDocsPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="package-structure-title">
              PebbleDB Architecture: Package Structure
            </h1>

            <div className="guide-body-text" style={{ marginTop: 24 }}>
              <p>
                This document details the modular layout of PebbleDB, mapping package directories,
                subsystem roles, and import hierarchies, complete with dependency diagrams and structural
                ownership mappings.
              </p>

              {/* ── 1. Package Tree and Directory Roles ── */}
              <h2 className="guide-sub-heading" id="directory-roles" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                1. Package Tree and Directory Roles
              </h2>
              <p>
                PebbleDB decomposes its LSM-tree features into isolated, focused packages within the
                <code className="inline-code">internal/</code> directory to prevent circular imports:
              </p>

              <pre className="guide-code-pre" style={{ background: "#18181b", padding: "12px", borderRadius: "6px", overflowX: "auto", margin: "16px 0" }}>
                <code>{`internal/
├── bloom/          ← Space-efficient membership filters (probabilistic indices)
├── db/             ← Orchestration core: group-commit, background routines, and user APIs
├── iterator/       ← Multi-source k-way merge stream and adapters
├── manifest/       ← Version control: commit logs for live file tracking
├── memtable/       ← RAM-backed SkipList buffers (volatile write targets)
├── sstable/        ← Immutable on-disk data blocks, read index blocks, and caches
└── wal/            ← Disk-backed sequential Write-Ahead Log for durability`}</code>
              </pre>

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>1.1 Structural Packages Catalog</h3>
              <div style={{ overflowX: "auto", marginTop: 16, marginBottom: 20 }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={theadRowStyle}>
                      <th style={thStyle}>Package</th>
                      <th style={thStyle}>Role</th>
                      <th style={thStyle}>Key Types</th>
                      <th style={thStyle}>Exported APIs</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>wal</td>
                      <td style={tdStyle}>Durable write serialization</td>
                      <td style={tdMonoStyle}>WAL, Record, ReplayLimits</td>
                      <td style={tdMonoStyle}>Open(), AppendBatch(), ReplayFromWithRecovery()</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>memtable</td>
                      <td style={tdStyle}>In-memory sorted buffer</td>
                      <td style={tdMonoStyle}>SkipList, node, SkipListIterator</td>
                      <td style={tdMonoStyle}>Put(), Get(), Delete(), Snapshot(), Iterator()</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>sstable</td>
                      <td style={tdStyle}>Static read-only run-files</td>
                      <td style={tdMonoStyle}>Reader, Writer, Block, Footer</td>
                      <td style={tdMonoStyle}>OpenReader(), NewWriter(), ReadFooter(), NewBlockCache()</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>bloom</td>
                      <td style={tdStyle}>Key filtering logic</td>
                      <td style={tdMonoStyle}>Filter</td>
                      <td style={tdMonoStyle}>New(), Add(), MayContain(), Encode(), Decode()</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>manifest</td>
                      <td style={tdStyle}>Version database state</td>
                      <td style={tdMonoStyle}>Log</td>
                      <td style={tdMonoStyle}>Open(), AppendNewFile(), AppendSetFileSet(), MaybeCompact()</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>iterator</td>
                      <td style={tdStyle}>Stream merging interface</td>
                      <td style={tdMonoStyle}>Iterator, MergeIterator</td>
                      <td style={tdMonoStyle}>NewMergeIterator(), ForEachMerged()</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>db</td>
                      <td style={tdStyle}>Coordination system</td>
                      <td style={tdMonoStyle}>DB, Options, Batch</td>
                      <td style={tdMonoStyle}>Open(), Put(), Delete(), Get(), Scan(), Close()</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* ── 2. Package Dependency Graph ── */}
              <h2 className="guide-sub-heading" id="dependency-graph" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                2. Package Dependency Graph
              </h2>
              <DocsMermaid chart={DEPENDENCY_GRAPH_CHART} />

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>2.1 Dependency Invariant Constraints</h3>
              <ul className="guide-bullets-list">
                <li>
                  <span className="highlight-text">Lower-level Isolation</span>: The packages
                  <code className="inline-code">bloom</code>, <code className="inline-code">wal</code>,
                  <code className="inline-code">memtable</code>, and <code className="inline-code">iterator</code>
                  have zero dependencies on other internal packages, keeping them easily testable.
                </li>
                <li>
                  <span className="highlight-text">SSTable & Bloom Connection</span>:
                  <code className="inline-code">sstable</code> imports and calls <code className="inline-code">bloom</code>
                  for key indexing and filter serialization.
                </li>
                <li>
                  <span className="highlight-text">Core Orchestration</span>:
                  <code className="inline-code">internal/db</code> is the root coordinator. No package under
                  <code className="inline-code">internal/</code> (like <code className="inline-code">wal</code> or
                  <code className="inline-code">sstable</code>) may import <code className="inline-code">internal/db</code>.
                </li>
              </ul>

              {/* ── 3. Structural Ownership Mapping ── */}
              <h2 className="guide-sub-heading" id="structural-ownership" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                3. Structural Ownership Mapping
              </h2>
              <p>
                The <code className="inline-code">DB</code> struct acts as the central coordinator, owning
                handles to all other components:
              </p>
              <GoCodeBlock>{OWNERSHIP_CODE}</GoCodeBlock>

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

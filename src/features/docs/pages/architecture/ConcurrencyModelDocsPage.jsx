import DocsNavbar from "@/features/docs/components/DocsNavbar";
import DocsSidebar from "@/features/docs/components/DocsSidebar";

const pageTopics = [
  { label: "Mutex and Synchronization Directory", href: "#mutex-directory" },
  { label: "Lock-Free Reader Path via Atomic Snapshots", href: "#lock-free-snapshots" },
  { label: "Lock Ordering Rules", href: "#lock-ordering" },
];

function CowSnapshotSvg() {
  return (
    <svg viewBox="0 0 500 220" className="w-full h-auto bg-[#0e0e11] border border-zinc-800 rounded-lg p-6 my-6" style={{ marginTop: 24, marginBottom: 24 }}>
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#71717a" />
        </marker>
      </defs>

      {/* Compactor */}
      <rect x="20" y="20" width="160" height="34" rx="4" fill="#18181b" stroke="#52525b" strokeWidth="1" />
      <text x="100" y="41" fill="#ffffff" fontSize="10" textAnchor="middle">Compactor Worker</text>

      {/* Merge new SST */}
      <path d="M 180 37 H 230" stroke="#71717a" strokeWidth="1.2" markerEnd="url(#arrow)" />
      <rect x="230" y="20" width="250" height="34" rx="4" fill="#18181b" stroke="#52525b" strokeWidth="1" />
      <text x="355" y="41" fill="#ffffff" fontSize="10" textAnchor="middle">Publish New SSTable Handle List</text>

      {/* Atomic Snapshot */}
      <path d="M 355 54 L 355 94" stroke="#71717a" strokeWidth="1.2" markerEnd="url(#arrow)" />
      <rect x="230" y="94" width="250" height="34" rx="4" fill="#18181b" stroke="#ff5cad" strokeWidth="1.2" />
      <text x="355" y="115" fill="#ffffff" fontSize="10" textAnchor="middle" fontWeight="bold">db.sstablesSnap.Store(&snap)</text>

      {/* Lock free reads */}
      <path d="M 180 167 H 230" stroke="#71717a" strokeWidth="1.2" markerEnd="url(#arrow)" />
      <rect x="230" y="150" width="250" height="34" rx="4" fill="#18181b" stroke="#ff5cad" strokeWidth="1" />
      <text x="355" y="171" fill="#ffffff" fontSize="10" textAnchor="middle">sstablesSnap.Load() (Lock-free)</text>

      {/* Reader Thread */}
      <rect x="20" y="150" width="160" height="34" rx="4" fill="#18181b" stroke="#52525b" strokeWidth="1" />
      <text x="100" y="171" fill="#ffffff" fontSize="10" textAnchor="middle">Reader Get / Scan</text>

      {/* Arrow down loading snap */}
      <path d="M 355 128 L 355 150" stroke="#71717a" strokeWidth="1.2" />
    </svg>
  );
}

export default function ConcurrencyModelDocsPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="concurrency-model-title">PebbleDB Subsystem: Concurrency Model</h1>
            
            <div className="guide-body-text" style={{ marginTop: 24 }}>
              <p>
                This document specifies the concurrency model of PebbleDB, detailing how the database coordinates multiple concurrent user requests and background workers without data races or deadlocks.
              </p>

              <h2 className="guide-sub-heading" id="mutex-directory" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>1. Mutex and Synchronization Directory</h2>
              <p>
                PebbleDB manages synchronization using a structured lock inventory, with each lock protecting a specific subsystem:
              </p>

              {/* Lock Table */}
              <div style={{ overflowX: "auto", marginTop: 16, marginBottom: 20 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13, border: "1px solid rgba(255, 255, 255, 0.08)" }}>
                  <thead>
                    <tr style={{ background: "rgba(255, 92, 173, 0.08)", borderBottom: "1px solid rgba(255, 255, 255, 0.15)" }}>
                      <th style={{ padding: "10px 16px", color: "#ff5cad", fontWeight: 600 }}>Lock</th>
                      <th style={{ padding: "10px 16px", color: "#ff5cad", fontWeight: 600 }}>Package</th>
                      <th style={{ padding: "10px 16px", color: "#ff5cad", fontWeight: 600 }}>Type</th>
                      <th style={{ padding: "10px 16px", color: "#ff5cad", fontWeight: 600 }}>Protects</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace", fontWeight: 500, color: "#ffffff" }}>db.mu</td>
                      <td style={{ padding: "10px 16px" }}>internal/db</td>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace" }}>sync.RWMutex</td>
                      <td style={{ padding: "10px 16px" }}>active, pendingFlush, sstables, closed, and pendingBatch</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace", fontWeight: 500, color: "#ffffff" }}>wal.mu</td>
                      <td style={{ padding: "10px 16px" }}>internal/wal</td>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace" }}>sync.Mutex</td>
                      <td style={{ padding: "10px 16px" }}>Appends and truncates on active WAL file handle</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace", fontWeight: 500, color: "#ffffff" }}>manifest.mu</td>
                      <td style={{ padding: "10px 16px" }}>internal/manifest</td>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace" }}>sync.Mutex</td>
                      <td style={{ padding: "10px 16px" }}>Appends, rotations, and status checks on manifest log</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace", fontWeight: 500, color: "#ffffff" }}>SkipList.mu</td>
                      <td style={{ padding: "10px 16px" }}>internal/memtable</td>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace" }}>sync.RWMutex</td>
                      <td style={{ padding: "10px 16px" }}>Reads and updates to skip-list nodes</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace", fontWeight: 500, color: "#ffffff" }}>compactMu</td>
                      <td style={{ padding: "10px 16px" }}>internal/db</td>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace" }}>sync.Mutex</td>
                      <td style={{ padding: "10px 16px" }}>Serializes background compactions (one run at a time)</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace", fontWeight: 500, color: "#ffffff" }}>readersMu</td>
                      <td style={{ padding: "10px 16px" }}>internal/db</td>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace" }}>sync.Mutex</td>
                      <td style={{ padding: "10px 16px" }}>The active allReaders registry slice</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace", fontWeight: 500, color: "#ffffff" }}>Reader.closeMu</td>
                      <td style={{ padding: "10px 16px" }}>internal/sstable</td>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace" }}>sync.RWMutex</td>
                      <td style={{ padding: "10px 16px" }}>Closes and removes backing SSTable files on disk</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h2 className="guide-sub-heading" id="lock-free-snapshots" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>2. Lock-Free Reader Path via Atomic Snapshots</h2>
              <p>
                To maximize read throughput on multi-core systems, PebbleDB avoids holding global locks while reading from disk. It accomplishes this using a copy-on-write pointer strategy:
              </p>

              <CowSnapshotSvg />

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>2.1 The Copy-On-Write Protocol</h3>
              <ul className="guide-bullets-list">
                <li>
                  <span className="highlight-text">Read Path</span>: When Get() or Scan() queries SSTables, it loads the active list of reader handles from the atomic snapshot pointer (db.sstablesSnap.Load()) under a brief read lock. This load is lock-free and does not block concurrent writes or compactions.
                </li>
                <li>
                  <span className="highlight-text">Compaction Path</span>: When a compaction worker finishes merging SSTables, it builds a new list of reader handles, locks db.mu, updates db.sstables, and updates the atomic pointer (db.publishSSTables()).
                </li>
                <li>
                  <span className="highlight-text">Reference Counting</span>: Reads increment the reference counts of the readers (Reader.Ref()) under the read lock. Once the lookup completes, the thread calls Reader.Unref(). If a reader is discarded by a compaction worker during the lookup, the compactor calls Reader.Discard(), marking it for deletion. The file is deleted from disk only after the active reader thread releases its reference.
                </li>
              </ul>

              <h2 className="guide-sub-heading" id="lock-ordering" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>3. Lock Ordering Rules</h2>
              <p>
                To prevent deadlocks, PebbleDB enforces a strict lock acquisition order:
              </p>

              <div className="guide-code-block-container" style={{ marginTop: 12, marginBottom: 20 }}>
                <pre className="guide-code-pre">
                  <code className="guide-code-lines">
                    <span className="code-line"><span className="code-comment">Lock Acquisition Order:</span></span>
                    <span className="code-line">db.mu (RWMutex) ──&gt; compactMu (Mutex) ──&gt; manifest.mu (Mutex) ──&gt; Reader.closeMu (RWMutex)</span>
                  </code>
                </pre>
              </div>

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>3.1 Lock Acquisition Rules</h3>
              <ul className="guide-bullets-list">
                <li>
                  <span className="highlight-text">Rule 1</span>: If both db.mu and compactMu are required, the thread must acquire db.mu first.
                </li>
                <li>
                  <span className="highlight-text">Rule 2</span>: If both db.mu and manifest.mu are required, the thread must acquire db.mu first.
                </li>
                <li>
                  <span className="highlight-text">Rule 3</span>: Background workers must release db.mu before executing blocking disk writes to prevent stalling active reads.
                </li>
                <li>
                  <span className="highlight-text">Rule 4</span>: Compactions must verify that chosen input files are still present in db.sstables via readersStillPresent() under lock before committing the compaction to the manifest.
                </li>
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

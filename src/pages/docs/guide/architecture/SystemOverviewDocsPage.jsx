import DocsNavbar from "@/components/docs/DocsNavbar";
import DocsSidebar from "@/components/docs/DocsSidebar";

const pageTopics = [
  { label: "Subsystem Architecture", href: "#subsystem-architecture" },
  { label: "State Mapping: Volatile vs. Durable", href: "#state-mapping" },
  { label: "API Signature Specification", href: "#api-specification" },
  { label: "Structural Correctness Rules", href: "#structural-correctness" },
];

function SubsystemSvg() {
  return (
    <svg viewBox="0 0 600 340" className="w-full h-auto bg-[#0e0e11] border border-zinc-800 rounded-lg p-6 my-6" style={{ marginTop: 24, marginBottom: 24 }}>
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#71717a" />
        </marker>
      </defs>

      {/* CLI Box */}
      <rect x="200" y="20" width="200" height="36" rx="4" fill="#18181b" stroke="#3f3f46" strokeWidth="1" />
      <text x="300" y="42" fill="#ffffff" fontSize="11" textAnchor="middle" fontWeight="bold">cmd/pebbledb (CLI)</text>

      {/* API Box */}
      <rect x="200" y="90" width="200" height="36" rx="4" fill="#18181b" stroke="#ff5cad" strokeWidth="1.2" />
      <text x="300" y="112" fill="#ffffff" fontSize="11" textAnchor="middle" fontWeight="bold">internal/db (API)</text>

      {/* Sub-packages */}
      <rect x="20" y="180" width="110" height="34" rx="4" fill="#18181b" stroke="#52525b" strokeWidth="1" />
      <text x="75" y="201" fill="#ffffff" fontSize="10" textAnchor="middle">internal/wal</text>

      <rect x="160" y="180" width="110" height="34" rx="4" fill="#18181b" stroke="#52525b" strokeWidth="1" />
      <text x="215" y="201" fill="#ffffff" fontSize="10" textAnchor="middle">memtable</text>

      <rect x="300" y="180" width="110" height="34" rx="4" fill="#18181b" stroke="#52525b" strokeWidth="1" />
      <text x="355" y="201" fill="#ffffff" fontSize="10" textAnchor="middle">manifest</text>

      <rect x="440" y="180" width="140" height="34" rx="4" fill="#18181b" stroke="#52525b" strokeWidth="1" />
      <text x="510" y="201" fill="#ffffff" fontSize="10" textAnchor="middle">iterator</text>

      {/* SSTable & Bloom */}
      <rect x="300" y="250" width="110" height="34" rx="4" fill="#18181b" stroke="#ff5cad" strokeWidth="1" />
      <text x="355" y="271" fill="#ffffff" fontSize="10" textAnchor="middle">sstable</text>

      <rect x="440" y="250" width="140" height="34" rx="4" fill="#18181b" stroke="#52525b" strokeWidth="1" />
      <text x="510" y="271" fill="#ffffff" fontSize="10" textAnchor="middle">bloom</text>

      {/* Arrows */}
      <path d="M 300 56 L 300 90" stroke="#71717a" strokeWidth="1.2" markerEnd="url(#arrow)" />
      
      <path d="M 300 126 L 300 150" stroke="#71717a" strokeWidth="1.2" />
      <path d="M 75 150 H 510" stroke="#71717a" strokeWidth="1.2" />
      
      <path d="M 75 150 L 75 180" stroke="#71717a" strokeWidth="1.2" markerEnd="url(#arrow)" />
      <path d="M 215 150 L 215 180" stroke="#71717a" strokeWidth="1.2" markerEnd="url(#arrow)" />
      <path d="M 355 150 L 355 180" stroke="#71717a" strokeWidth="1.2" markerEnd="url(#arrow)" />
      <path d="M 510 150 L 510 180" stroke="#71717a" strokeWidth="1.2" markerEnd="url(#arrow)" />

      <path d="M 355 214 L 355 250" stroke="#71717a" strokeWidth="1.2" markerEnd="url(#arrow)" />
      <path d="M 510 214 L 510 250" stroke="#71717a" strokeWidth="1.2" markerEnd="url(#arrow)" />
      <path d="M 440 267 H 410" stroke="#71717a" strokeWidth="1.2" markerEnd="url(#arrow)" />
    </svg>
  );
}

export default function SystemOverviewDocsPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="system-overview-title">PebbleDB Subsystem: System Overview</h1>
            
            <div className="guide-body-text" style={{ marginTop: 24 }}>
              <p>
                PebbleDB is my embedded, single-process, Log-Structured Merge (LSM) key-value engine written in Go. This document provides a comprehensive structural specification of the storage engine, defining the state layouts, structural components, and Go interfaces.
              </p>

              <h2 className="guide-sub-heading" id="subsystem-architecture" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>1. Subsystem Architecture</h2>
              <p>
                PebbleDB decouples the LSM architecture into separate components to ensure execution isolation and clean package boundaries:
              </p>

              <SubsystemSvg />

              <h3 id="state-mapping" style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>1.1 State Mapping: Volatile (RAM) vs. Durable (Disk)</h3>
              <p>
                I enforce strict write-ahead boundaries where volatile changes only happen after confirming durable checkpoints on disk.
              </p>

              <h4 style={{ fontSize: 15, color: "#ff5cad", marginTop: 16, marginBottom: 8 }}>1.1.1 Volatile Memory Components (Lossy)</h4>
              <ul className="guide-bullets-list">
                <li>
                  <span className="highlight-text">pendingBatch</span>: Buffers mutations that are queued for group commit but not yet fsynced to the WAL.
                </li>
                <li>
                  <span className="highlight-text">active Memtable</span>: Standard concurrent skip list sorted lexicographically. It handles point lookups and range scans.
                </li>
                <li>
                  <span className="highlight-text">pendingFlush Queue</span>: List of frozen, read-only skip lists waiting to be flushed to disk as SSTables.
                </li>
                <li>
                  <span className="highlight-text">sstablesSnap</span>: Atomic pointer to the active slice of SSTable reader handles. Permits lock-free queries.
                </li>
                <li>
                  <span className="highlight-text">Block Cache</span>: Byte-bounded LRU cache storing raw, uncompressed 4 KiB SSTable data blocks.
                </li>
              </ul>

              <h4 style={{ fontSize: 15, color: "#ff5cad", marginTop: 16, marginBottom: 8 }}>1.1.2 Durable Disk Components (Persistent)</h4>
              <ul className="guide-bullets-list">
                <li>
                  <span className="highlight-text">LOCK</span>: Exclusive lock file. Prevents directory sharing between processes.
                </li>
                <li>
                  <span className="highlight-text">wal.log</span>: Sequential, append-only log recording mutations. Each record contains length descriptors and a CRC32 checksum.
                </li>
                <li>
                  <span className="highlight-text">wal.flush</span>: Transient binary checkpoint containing FreezeOffset and SSTID. Written during memtable flushes to bound recovery replays.
                </li>
                <li>
                  <span className="highlight-text">MANIFEST-00000X</span>: The authoritative transaction log recording file system mutations (additions and deletions of SSTables).
                </li>
                <li>
                  <span className="highlight-text">CURRENT</span>: Pointer file containing the name of the active manifest file.
                </li>
                <li>
                  <span className="highlight-text">sst_XXXXXXXX.sst</span>: Immutable sorted runs comprising data blocks, block index entries, a Bloom filter, and a validating footer.
                </li>
                <li>
                  <span className="highlight-text">quarantine/</span>: A subdirectory where unreferenced/orphaned SSTables found during recovery are isolated for diagnostic safety.
                </li>
              </ul>

              <h2 className="guide-sub-heading" id="api-specification" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>2. API Signature Specification</h2>
              <p>
                The database interface is exposed via the internal/db package:
              </p>

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 8 }}>2.1 Configuration Options</h3>
              <div className="guide-code-block-container" style={{ marginTop: 8, marginBottom: 20 }}>
                <pre className="guide-code-pre">
                  <code className="guide-code-lines">
                    <span className="code-line"><span className="code-keyword">type</span> Options <span className="code-keyword">struct</span> {"{"}</span>
                    <span className="code-line">    Dir                     <span className="code-keyword">string</span>        <span className="code-comment">// Path to the database data directory</span></span>
                    <span className="code-line">    MemtableSize            <span className="code-keyword">int64</span>         <span className="code-comment">// Max active memtable size in bytes</span></span>
                    <span className="code-line">    CompactionThreshold     <span className="code-keyword">int</span>           <span className="code-comment">// Live SSTable count that triggers compaction</span></span>
                    <span className="code-line">    WALReplayLimits         ReplayLimits  <span className="code-comment">// Bounds on sizes during recovery</span></span>
                    <span className="code-line">    BlockCacheSize          <span className="code-keyword">int64</span>         <span className="code-comment">// Size of block cache in bytes</span></span>
                    <span className="code-line">    SyncWrites              <span className="code-keyword">bool</span>          <span className="code-comment">// If true, forces fsync of WAL before Put/Delete</span></span>
                    <span className="code-line">    BlockWritesOnFlushError *<span className="code-keyword">bool</span>         <span className="code-comment">// If true, blocks writes on flush error</span></span>
                    <span className="code-line">    BatchFlushDelay         time.Duration <span className="code-comment">// Group commit delay before flushing writes</span></span>
                    <span className="code-line">{"}"}</span>
                  </code>
                </pre>
              </div>

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 8 }}>2.2 Core Methods</h3>
              <div className="guide-code-block-container" style={{ marginTop: 8, marginBottom: 20 }}>
                <pre className="guide-code-pre">
                  <code className="guide-code-lines">
                    <span className="code-line"><span className="code-comment">// Open opens or creates a database at Dir.</span></span>
                    <span className="code-line"><span className="code-keyword">func</span> <span className="code-function">Open</span>(opts Options) (*DB, <span className="code-keyword">error</span>)</span>
                    <span className="code-line"><span className="code-comment">// Put writes a key-value pair.</span></span>
                    <span className="code-line"><span className="code-keyword">func</span> (db *DB) <span className="code-function">Put</span>(key, value []<span className="code-keyword">byte</span>) <span className="code-keyword">error</span></span>
                    <span className="code-line"><span className="code-comment">// Get retrieves the value associated with a key.</span></span>
                    <span className="code-line"><span className="code-keyword">func</span> (db *DB) <span className="code-function">Get</span>(key []<span className="code-keyword">byte</span>) ([]<span className="code-keyword">byte</span>, <span className="code-keyword">error</span>)</span>
                    <span className="code-line"><span className="code-comment">// Delete writes a tombstone marker for the key.</span></span>
                    <span className="code-line"><span className="code-keyword">func</span> (db *DB) <span className="code-function">Delete</span>(key []<span className="code-keyword">byte</span>) <span className="code-keyword">error</span></span>
                    <span className="code-line"><span className="code-comment">// Scan returns an iterator over keys in range [start, end).</span></span>
                    <span className="code-line"><span className="code-keyword">func</span> (db *DB) <span className="code-function">Scan</span>(start, end []<span className="code-keyword">byte</span>) (*ScanIterator, <span className="code-keyword">error</span>)</span>
                    <span className="code-line"><span className="code-comment">// Sync blocks until all queued writes are fsynced.</span></span>
                    <span className="code-line"><span className="code-keyword">func</span> (db *DB) <span className="code-function">Sync</span>() <span className="code-keyword">error</span></span>
                    <span className="code-line"><span className="code-comment">// Close stops workers, flushes tables, and releases lock.</span></span>
                    <span className="code-line"><span className="code-keyword">func</span> (db *DB) <span className="code-function">Close</span>() <span className="code-keyword">error</span></span>
                  </code>
                </pre>
              </div>

              <h2 className="guide-sub-heading" id="structural-correctness" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>3. Structural Correctness Rules</h2>
              <p>
                Every subsystem in PebbleDB conforms to structural safety rules defined in the system invariants:
              </p>
              <ul className="guide-bullets-list">
                <li>
                  <span className="highlight-text">Durable Integrity</span>: Write operations must be logged to wal.log and fsynced before they are applied to the active memtable.
                </li>
                <li>
                  <span className="highlight-text">SST Durability</span>: An SSTable file must be completely written and fsynced to disk with a valid footer before it is added to the manifest.
                </li>
                <li>
                  <span className="highlight-text">Compaction Decoupling</span>: Background compaction failures must never block active user reads.
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

import DocsNavbar from "@/components/docs/DocsNavbar";
import DocsSidebar from "@/components/docs/DocsSidebar";

const pageTopics = [
  { label: "What is PebbleDB?", href: "#what-is-pebbledb" },
  { label: "Why databases exist", href: "#why-databases-exist" },
  { label: "What a key-value store is", href: "#what-a-key-value-store-is" },
  { label: "Why LSM Trees were invented", href: "#why-lsm-trees-were-invented" },
  { label: "Where PebbleDB fits", href: "#where-pebbledb-fits" },
  { label: "What features your implementation supports", href: "#features-supported" },
  { label: "Overall architecture diagram", href: "#architecture-diagram" },
];

function ArchitectureDiagram() {
  return (
    <svg viewBox="0 0 800 420" className="w-full h-auto bg-[#0e0e11] border border-zinc-800 rounded-lg p-6 my-6" style={{ marginTop: 24, marginBottom: 24 }}>
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#71717a" />
        </marker>
      </defs>

      {/* Client Process Group */}
      <rect x="20" y="20" width="350" height="90" rx="6" fill="#18181b" stroke="#3f3f46" strokeWidth="1" />
      <text x="35" y="42" fill="#a1a1aa" fontSize="11" fontWeight="bold">Client Process</text>
      <rect x="40" y="58" width="140" height="34" rx="4" fill="#27272a" stroke="#52525b" strokeWidth="1" />
      <text x="110" y="79" fill="#ffffff" fontSize="11" textAnchor="middle">cmd/pebbledb CLI</text>
      <rect x="210" y="58" width="140" height="34" rx="4" fill="#27272a" stroke="#52525b" strokeWidth="1" />
      <text x="280" y="79" fill="#ffffff" fontSize="11" textAnchor="middle">internal/db (API)</text>

      {/* Memory Group */}
      <rect x="20" y="140" width="350" height="150" rx="6" fill="#18181b" stroke="#ff5cad" strokeWidth="1" />
      <text x="35" y="162" fill="#ff5cad" fontSize="11" fontWeight="bold">In-Memory State (Locked)</text>
      <rect x="40" y="178" width="310" height="28" rx="4" fill="#27272a" stroke="#52525b" strokeWidth="1" />
      <text x="195" y="195" fill="#ffffff" fontSize="11" textAnchor="middle">Active Memtable (SkipList)</text>
      <rect x="40" y="212" width="310" height="28" rx="4" fill="#27272a" stroke="#52525b" strokeWidth="1" />
      <text x="195" y="229" fill="#ffffff" fontSize="11" textAnchor="middle">pendingFlush Queue</text>
      <rect x="40" y="246" width="310" height="28" rx="4" fill="#27272a" stroke="#52525b" strokeWidth="1" />
      <text x="195" y="263" fill="#ffffff" fontSize="11" textAnchor="middle">sstables[] (COW Slice)</text>

      {/* Workers Group */}
      <rect x="410" y="20" width="370" height="120" rx="6" fill="#18181b" stroke="#3f3f46" strokeWidth="1" />
      <text x="425" y="42" fill="#a1a1aa" fontSize="11" fontWeight="bold">Background Goroutines</text>
      <rect x="430" y="54" width="330" height="24" rx="4" fill="#27272a" stroke="#52525b" strokeWidth="1" />
      <text x="595" y="70" fill="#ffffff" fontSize="10" textAnchor="middle">batchFlusher (Group WAL Syncs)</text>
      <rect x="430" y="82" width="330" height="24" rx="4" fill="#27272a" stroke="#52525b" strokeWidth="1" />
      <text x="595" y="98" fill="#ffffff" fontSize="10" textAnchor="middle">flusher (drains Memtable to SSTs)</text>
      <rect x="430" y="110" width="330" height="24" rx="4" fill="#27272a" stroke="#52525b" strokeWidth="1" />
      <text x="595" y="126" fill="#ffffff" fontSize="10" textAnchor="middle">compactor (oldest-2 merge)</text>

      {/* Disk Group */}
      <rect x="410" y="160" width="370" height="240" rx="6" fill="#18181b" stroke="#3f3f46" strokeWidth="1" />
      <text x="425" y="182" fill="#a1a1aa" fontSize="11" fontWeight="bold">On-Disk Storage (Durable)</text>
      <rect x="430" y="198" width="155" height="28" rx="4" fill="#27272a" stroke="#52525b" strokeWidth="1" />
      <text x="507" y="215" fill="#fbcfe8" fontSize="10" textAnchor="middle">LOCK (Exclusive OS lock)</text>
      <rect x="600" y="198" width="160" height="28" rx="4" fill="#27272a" stroke="#52525b" strokeWidth="1" />
      <text x="680" y="215" fill="#fbcfe8" fontSize="10" textAnchor="middle">wal.log (Append WAL)</text>
      <rect x="430" y="234" width="155" height="28" rx="4" fill="#27272a" stroke="#52525b" strokeWidth="1" />
      <text x="507" y="251" fill="#ffffff" fontSize="10" textAnchor="middle">wal.flush (Checkpoint)</text>
      <rect x="600" y="234" width="160" height="28" rx="4" fill="#27272a" stroke="#52525b" strokeWidth="1" />
      <text x="680" y="251" fill="#ffffff" fontSize="10" textAnchor="middle">MANIFEST-XXXXXX</text>
      <rect x="430" y="270" width="155" height="28" rx="4" fill="#27272a" stroke="#52525b" strokeWidth="1" />
      <text x="507" y="287" fill="#ffffff" fontSize="10" textAnchor="middle">CURRENT (Registry Pointer)</text>
      <rect x="600" y="270" width="160" height="28" rx="4" fill="#27272a" stroke="#52525b" strokeWidth="1" />
      <text x="680" y="287" fill="#ffffff" fontSize="10" textAnchor="middle">sst_XXXX.sst (Sorted SST)</text>
      <rect x="430" y="306" width="330" height="28" rx="4" fill="#27272a" stroke="#52525b" strokeWidth="1" />
      <text x="595" y="323" fill="#a1a1aa" fontSize="10" textAnchor="middle">quarantine/ (Orphan files registry)</text>

      {/* Connectors / Arrows */}
      <path d="M 110 110 L 110 140" stroke="#71717a" strokeWidth="1.2" markerEnd="url(#arrow)" />
      <path d="M 280 110 L 280 140" stroke="#71717a" strokeWidth="1.2" markerEnd="url(#arrow)" />
      <path d="M 370 65 H 410" stroke="#71717a" strokeWidth="1.2" markerEnd="url(#arrow)" />
      <path d="M 370 215 H 410" stroke="#71717a" strokeWidth="1.2" markerEnd="url(#arrow)" />
    </svg>
  );
}

export default function GuideDocsPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        {/* Left Sidebar */}
        <DocsSidebar />

        {/* Main Content Area */}
        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="introduction">Introduction</h1>
            
            <div className="warning-banner" style={{
              background: "rgba(219, 39, 119, 0.08)",
              border: "1px solid rgba(219, 39, 119, 0.25)",
              borderRadius: "8px",
              padding: "16px",
              marginTop: "20px",
              marginBottom: "24px",
              color: "#fbcfe8",
              fontSize: "14px",
              lineHeight: "1.6"
            }}>
              <strong style={{ color: "#ec4899", display: "block", fontSize: "15px", marginBottom: "6px" }}>Warning: Not Production Ready</strong>
              PebbleDB is an educational, first-principles implementation of an LSM-tree storage engine. While executed cleanly according to correct design patterns, it is a learning project containing critical limitations that make it unsuitable for production environments or handling valuable data.
            </div>

            <div className="guide-body-text" style={{ marginTop: 24 }}>
              <h2 className="guide-sub-heading" id="what-is-pebbledb" style={{ fontSize: 22, color: "#ffffff", marginTop: 28, marginBottom: 12 }}>What is PebbleDB?</h2>
              <p>
                In simple terms, PebbleDB is a lightweight, embedded key-value database built completely from scratch in Go.
              </p>
              <p>
                To understand what it is, here is the breakdown:
              </p>
              <p>
                It is a library, not a server: It does not run as a separate process that you connect to over a network (like MySQL or Redis). Instead, you import it directly into your Go application code (like SQLite). It runs inside your program and writes data straight to your local hard drive.
              </p>
              <p>
                It is an LSM-Tree database: It stores data using a Log-Structured Merge-tree pattern. All writes are extremely fast because they are appended sequentially to a Log (wal.log) and kept in a memory buffer. In the background, it flushes and organizes these records into sorted files (.sst) on disk.
              </p>
              <p>
                It is written from scratch for learning: While CockroachDB has a popular database engine called "Pebble" (which is a Go port of RocksDB), this PebbleDB is not a fork of that. It is an independent, custom-built educational storage engine designed to explore how complex storage engine concepts (like manifest logs, compaction, thread synchronization, and crash recovery) work under the hood.
              </p>

              <h2 className="guide-sub-heading" id="why-databases-exist" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>Why Databases Exist</h2>
              <p>
                At their core, databases exist to solve hard problems that simple flat files cannot handle reliably:
              </p>
              <ul className="guide-bullets-list">
                <li>
                  <span className="highlight-text">Durability and Persistence</span>: Ensuring data survives system crashes, power losses, and hardware failures.
                </li>
                <li>
                  <span className="highlight-text">Safe Concurrency</span>: Allowing hundreds of users or threads to read and write data simultaneously without corrupting the files or seeing partial, inconsistent states.
                </li>
                <li>
                  <span className="highlight-text">Transaction Guarantees (ACID)</span>: Bundling multiple operations together so they either all succeed or none do (Atomicity), leaving the system in a valid state (Consistency).
                </li>
                <li>
                  <span className="highlight-text">Querying & Efficiency</span>: Finding a specific piece of data in milliseconds among terabytes of records without scanning the entire disk.
                </li>
              </ul>

              <h2 className="guide-sub-heading" id="what-a-key-value-store-is" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>What a Key-Value Store Is</h2>
              <p>
                A key-value (KV) store is the simplest and most fundamental type of database.
              </p>
              <p>
                It operates like a massive, persistent associative array (hash map or dictionary).
              </p>
              <p>
                Every data entry is stored as a unique Key pointing to an arbitrary payload called the Value (e.g., user_id_99 pointing to name: "Rudra", age: 24).
              </p>
              <p>
                Unlike relational databases (SQL), KV stores do not natively understand tables, columns, or relationships. They optimize exclusively for raw speed, high scale, and simple operations: Put(key, value), Get(key), Delete(key), and sometimes Scan(start, end).
              </p>

              <h2 className="guide-sub-heading" id="why-lsm-trees-were-invented" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>Why LSM Trees Were Invented</h2>
              <p>
                Traditional storage engines use B-Trees to manage data on disk. When you update a record in a B-Tree, it modifies pages in-place. On disk, this causes random writes.
              </p>
              <p>
                Random disk writes are extremely slow on Hard Disk Drives (HDDs) due to physical disk head movement. On modern Solid State Drives (SSDs), random writes cause high Write Amplification, wearing out the flash cells quickly.
              </p>
              <p>
                The LSM Tree Solution: Invented in 1996 by Patrick O'Neil, Edward O'Neil, and Gerhard Weikum, the Log-Structured Merge (LSM) Tree converts random writes into high-speed sequential writes.
              </p>
              <p>
                How it works: Instead of writing directly to disk, updates are appended to a Write-Ahead Log (WAL) and stored in a sorted in-memory buffer (the Memtable). Once the buffer is full, it is flushed sequentially to disk as an immutable sorted run (SSTable). Background workers later merge these sorted files (Compaction) to clean up old versions and deletes.
              </p>

              <h2 className="guide-sub-heading" id="where-pebbledb-fits" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>Where PebbleDB Fits</h2>
              <p>
                PebbleDB is an embedded, single-node LSM key-value store written in Go.
              </p>
              <p>
                Embedded: It runs inside the caller's application process (similar to SQLite, LevelDB, or RocksDB). There is no network server, network socket latency, or client-server protocol.
              </p>
              <p>
                Single-node: It manages data on a single local disk. It does not handle replication, clustering, or network consensus (like Raft).
              </p>
              <p>
                Educational Context: It is designed from scratch to serve as a clean, race-tested reference implementation for understanding the core layers of LSM storage engines without the extreme optimization complexities found in industrial engines.
              </p>

              <h2 className="guide-sub-heading" id="features-supported" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>What Features the PebbleDB Implementation Supports</h2>
              <p>
                PebbleDB implements all essential subsystems of a production LSM database:
              </p>
              <ul className="guide-bullets-list">
                <li>
                  <span className="highlight-text">Writes & Durability</span>: Default asynchronous Group Commit batching (writes are grouped and flushed to disk every 1ms or 64 writes for ~20× throughput). Escape hatches are provided via synchronous writes (SyncWrites option) and manual Sync().
                </li>
                <li>
                  <span className="highlight-text">Memory Buffer (Memtable)</span>: Thread-safe, sorted in-memory SkipList. Point-in-time Snapshot generation allows reads/scans to proceed without holding write locks.
                </li>
                <li>
                  <span className="highlight-text">On-disk Storage (SSTable)</span>: Immutable files formatted into 4 KiB data blocks, index blocks, version records, magic validation numbers, and per-file Bloom Filters to prevent reading files that do not contain the target key.
                </li>
                <li>
                  <span className="highlight-text">State Authority (Manifest)</span>: An append-only MANIFEST log tracking live SSTable IDs. Complete directory recovery is driven entirely by the manifest, while unreferenced files are safely moved to a quarantine/ folder.
                </li>
                <li>
                  <span className="highlight-text">Compaction</span>: Background Oldest-2 size-tiered compaction that merges overlapping SSTables together to discard tombstones and duplicate keys.
                </li>
                <li>
                  <span className="highlight-text">Fault Tolerance</span>: A custom 16-byte wal.flush checkpoint mechanism that tracks flush state and bounds WAL replay on recovery, guaranteeing no duplicate WAL records are re-applied.
                </li>
                <li>
                  <span className="highlight-text">Process Concurrency Safety</span>: Single-writer process lock using exclusive Windows kernel file locking (LockFileEx) and Unix flock bounds.
                </li>
              </ul>

              <h2 className="guide-sub-heading" id="architecture-diagram" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>Overall Architecture Diagram</h2>
              <ArchitectureDiagram />

            </div>
          </div>
        </main>

        {/* Right Sidebar */}
        <aside className="guide-sidebar-right" aria-label="Page Outline">
          <div className="guide-sidebar-right-content">
            <h4 className="guide-sidebar-right-title">Introduction</h4>
            <ul className="guide-sidebar-right-list">
              {pageTopics.map((topic) => (
                <li key={topic.label} className="guide-sidebar-right-item">
                  <a
                    href={topic.href}
                    className="guide-sidebar-right-link"
                  >
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

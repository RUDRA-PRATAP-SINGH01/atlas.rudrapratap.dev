import DocsNavbar from "../components/DocsNavbar";
import DocsSidebar from "../components/DocsSidebar";

const pageTopics = [
  { label: "Why B-Trees Become Expensive for Writes", href: "#why-btrees-expensive" },
  { label: "Sequential vs. Random Disk I/O", href: "#sequential-vs-random-io" },
  { label: "Write Amplification", href: "#write-amplification" },
  { label: "Read Amplification", href: "#read-amplification" },
  { label: "The LSM Tree Philosophy: Out-of-Place Updates", href: "#lsm-tree-philosophy" },
  { label: "Immutable Files (SSTables)", href: "#immutable-sstables" },
  { label: "Compaction", href: "#compaction" },
];

function WritePathDiagram() {
  return (
    <svg viewBox="0 0 500 220" className="w-full h-auto bg-[#0e0e11] border border-zinc-800 rounded-lg p-6 my-6" style={{ marginTop: 24, marginBottom: 24 }}>
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#71717a" />
        </marker>
      </defs>

      {/* User Write Box */}
      <rect x="175" y="10" width="150" height="34" rx="4" fill="#27272a" stroke="#ff5cad" strokeWidth="1.2" />
      <text x="250" y="31" fill="#ffffff" fontSize="12" fontWeight="bold" textAnchor="middle">User Write</text>

      {/* Arrows split */}
      <path d="M 250 44 L 250 70" stroke="#71717a" strokeWidth="1.2" />
      <path d="M 110 70 H 390" stroke="#71717a" strokeWidth="1.2" />
      <path d="M 110 70 L 110 94" stroke="#71717a" strokeWidth="1.2" markerEnd="url(#arrow)" />
      <path d="M 390 70 L 390 94" stroke="#71717a" strokeWidth="1.2" markerEnd="url(#arrow)" />

      {/* WAL Box */}
      <rect x="35" y="94" width="150" height="34" rx="4" fill="#18181b" stroke="#52525b" strokeWidth="1" />
      <text x="110" y="115" fill="#ffffff" fontSize="11" textAnchor="middle">Append to wal.log</text>

      {/* Memtable Box */}
      <rect x="315" y="94" width="150" height="34" rx="4" fill="#18181b" stroke="#52525b" strokeWidth="1" />
      <text x="390" y="115" fill="#ffffff" fontSize="11" textAnchor="middle">Insert into Memtable</text>

      {/* Arrow Memtable to Flush */}
      <path d="M 390 128 L 390 160" stroke="#71717a" strokeWidth="1.2" markerEnd="url(#arrow)" />
      <text x="400" y="148" fill="#a1a1aa" fontSize="10">(When Full)</text>

      {/* Flush Box */}
      <rect x="315" y="160" width="150" height="34" rx="4" fill="#18181b" stroke="#ff5cad" strokeWidth="1" />
      <text x="390" y="181" fill="#ffffff" fontSize="11" textAnchor="middle">Flush to SSTable (.sst)</text>
    </svg>
  );
}

export default function LsmFundamentalsDocsPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        {/* Left Sidebar */}
        <DocsSidebar />

        {/* Main Content Area */}
        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="lsm-fundamentals-title">LSM Tree Fundamentals: A Guide to Log-Structured Merge-Trees</h1>
            
            <div className="guide-body-text" style={{ marginTop: 24 }}>
              <p>
                Before diving into how databases like PebbleDB are implemented, it is essential to understand the core database theory that inspired them. This guide explains the fundamental engineering challenges of database storage engines and why the Log-Structured Merge-Tree (LSM Tree) was invented.
              </p>

              <h2 className="guide-sub-heading" id="why-btrees-expensive" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>1. Why B-Trees Become Expensive for Writes</h2>
              <p>
                Traditional databases (like PostgreSQL, MySQL, and SQLite) use B-Trees or B+Trees as their underlying storage structure.
              </p>
              <p>
                In a B-Tree, data is organized into fixed-size blocks called pages (usually 4 KiB to 16 KiB). When a user inserts, updates, or deletes a record:
              </p>
              <ul className="guide-bullets-list">
                <li>
                  The database finds the specific page containing the target key.
                </li>
                <li>
                  It modifies that page in memory (in a buffer pool).
                </li>
                <li>
                  Eventually, it writes that modified page back to the disk.
                </li>
              </ul>
              <p>
                This is known as <span className="highlight-text">in-place update</span>.
              </p>

              <div className="guide-code-block-container" style={{ marginTop: 12, marginBottom: 20 }}>
                <pre className="guide-code-pre">
                  <code className="guide-code-lines">
                    <span className="code-line"><span className="code-comment">B-Tree In-Place Update:</span></span>
                    <span className="code-line">User writes key "apple" ──&gt; Find Page 4 ──&gt; Rewrite Page 4 in-place on Disk</span>
                  </code>
                </pre>
              </div>

              <p style={{ fontWeight: 500, color: "#ffffff" }}>The Problem:</p>
              <p>
                If updates are scattered randomly across the key range, the database must write to different, random pages on disk. Writing a tiny 100-byte update forces the database to rewrite the entire 4 KiB or 16 KiB page.
              </p>
              <p>
                As the database grows larger than the available RAM, page eviction starts. Updating keys turns into a bottleneck of constantly reading pages from disk, modifying them, and flushing them back to random positions. This is highly inefficient.
              </p>

              <h2 className="guide-sub-heading" id="sequential-vs-random-io" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>2. Sequential vs. Random Disk I/O</h2>
              <p>
                The performance gap between B-Trees and LSM Trees is rooted in physical hardware design: sequential disk access is orders of magnitude faster than random disk access.
              </p>

              <div className="guide-code-block-container" style={{ marginTop: 12, marginBottom: 20 }}>
                <pre className="guide-code-pre">
                  <code className="guide-code-lines">
                    <span className="code-line">RANDOM I/O (B-Tree):</span>
                    <span className="code-line">Disk block 12 ──&gt; Disk block 952 ──&gt; Disk block 43</span>
                    <span className="code-line">&nbsp;</span>
                    <span className="code-line">SEQUENTIAL I/O (LSM):</span>
                    <span className="code-line">Disk block 100 ──&gt; Disk block 101 ──&gt; Disk block 102</span>
                  </code>
                </pre>
              </div>

              <p>
                Hard Disk Drives (HDDs): Random access requires physically moving a mechanical arm (seek time) and waiting for the disk platter to spin (rotational latency). This takes ~10 milliseconds per seek, capping random writes at ~100 operations per second. Sequential access bypassing seeks can achieve hundreds of megabytes per second.
              </p>
              <p>
                Solid State Drives (SSDs): SSDs have no moving parts, but they still prefer sequential access. Flash memory cannot be overwritten directly; it must be erased in large blocks (typically 2 MiB to 8 MiB) before being written in smaller pages (4 KiB to 16 KiB). Random updates force the SSD's flash controller to constantly move data around, performing garbage collection, which severely degrades performance.
              </p>
              <p>
                LSM Trees exploit this by converting all random user writes into <span className="highlight-text">sequential disk appends</span>.
              </p>

              <h2 className="guide-sub-heading" id="write-amplification" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>3. Write Amplification</h2>
              <p>
                Write Amplification (WA) is a metric defined as:
              </p>

              <div className="guide-code-block-container" style={{ marginTop: 12, marginBottom: 20 }}>
                <pre className="guide-code-pre">
                  <code className="guide-code-lines">
                    <span className="code-line">Write Amplification = (Total bytes written to disk storage) / (Total bytes written by application)</span>
                  </code>
                </pre>
              </div>

              <p>
                In a B-Tree, if you update a single 50-byte record, the database must write a 4,096-byte page to disk. Write Amplification is equal to 4,096 bytes divided by 50 bytes, which is approximately 82. This high write amplification degrades write performance and degrades the life expectancy of SSD flash memory cells.
              </p>
              <p>
                LSM Trees group multiple updates in memory and write them sequentially, yielding a low write amplification for writes. However, LSM Trees perform background operations (compaction) to clean up and sort data, which writes data back to disk again. Even with compaction, LSM Trees maintain lower write amplification for highly write-intensive workloads compared to B-Trees.
              </p>

              <h2 className="guide-sub-heading" id="read-amplification" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>4. Read Amplification</h2>
              <p>
                Read Amplification (RA) is defined as:
              </p>

              <div className="guide-code-block-container" style={{ marginTop: 12, marginBottom: 20 }}>
                <pre className="guide-code-pre">
                  <code className="guide-code-lines">
                    <span className="code-line">Read Amplification = (Total bytes read from disk storage) / (Total bytes returned to application)</span>
                  </code>
                </pre>
              </div>

              <p>
                Because B-Trees keep keys sorted globally across structured pages, finding a key requires traversing a single path from the root node to the leaf page.
              </p>
              <ul className="guide-bullets-list">
                <li>
                  B-Tree Read: logarithmic page reads. Once the leaf page is loaded, the query is complete.
                </li>
                <li>
                  LSM Tree Read: Since data is written in separate chronological files, the target key could exist in any of those files. To perform a lookup, the engine may have to check the active memtable, the frozen memtables, and multiple sorted disk runs. Read Amplification in LSM is equal to the number of active runs searched.
                </li>
              </ul>
              <p>
                To mitigate this high read amplification, LSM Trees utilize:
              </p>
              <p>
                <span className="highlight-text">Bloom Filters</span>: In-memory probabilistic structures that instantly tell the engine if a key is guaranteed not to exist in a specific file.
              </p>
              <p>
                <span className="highlight-text">Block Indexes</span>: Caching indexes in memory to pinpoint exactly which page within a file holds the key.
              </p>

              <h2 className="guide-sub-heading" id="lsm-tree-philosophy" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>5. The LSM Tree Philosophy: Out-of-Place Updates</h2>
              <p>
                The core philosophy of the LSM Tree is out-of-place updates:
              </p>
              <ul className="guide-bullets-list">
                <li>
                  Never overwrite data.
                </li>
                <li>
                  Treat the disk as an append-only medium.
                </li>
                <li>
                  Defer sorting and deduplication to background threads.
                </li>
              </ul>
              
              <p style={{ fontWeight: 500, color: "#ffffff", marginTop: 16 }}>The Write Path Architecture:</p>
              <p>
                Write-Ahead Log (WAL): When a write arrives, it is appended sequentially to the WAL for crash-durability.
              </p>
              <p>
                Memtable: The record is then added to a sorted in-memory data structure (typically a SkipList or Red-Black Tree). The write is now complete and acknowledged to the user.
              </p>
              <p>
                Flush: When the Memtable reaches a size limit (e.g., 4 MiB), it is frozen, and a background thread writes its sorted contents to disk as an immutable file.
              </p>

              <WritePathDiagram />

              <h2 className="guide-sub-heading" id="immutable-sstables" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>6. Immutable Files (SSTables)</h2>
              <p>
                Once a memtable is written to disk, it becomes an SSTable (Sorted String Table).
              </p>
              <ul className="guide-bullets-list">
                <li>
                  <span className="highlight-text">Immutable</span>: SSTables are never modified. Changing a value or deleting a key is done by appending a new record (or a tombstone delete marker).
                </li>
                <li>
                  <span className="highlight-text">Sorted</span>: Because they are sorted, finding keys inside an SSTable is fast (binary search on block indexes).
                </li>
              </ul>
              <p>
                Immutability simplifies concurrency: readers (clients running Get or Scan) can access SSTables without acquiring locks, as the files will never change under them.
              </p>

              <h2 className="guide-sub-heading" id="compaction" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>7. Compaction</h2>
              <p>
                Because SSTables are immutable, outdated values and delete tombstones accumulate over time. If a user updates key x ten times, there will be ten different versions of x scattered across different SSTables.
              </p>
              <p>
                This causes read performance to deteriorate. To solve this, LSM Trees run a background process called Compaction.
              </p>

              <div className="guide-code-block-container" style={{ marginTop: 12, marginBottom: 20 }}>
                <pre className="guide-code-pre">
                  <code className="guide-code-lines">
                    <span className="code-line">SSTable A: [apple: v1], [banana: v3] ──┐</span>
                    <span className="code-line">                                       ├─&gt; Compaction (Merge Sort) ─&gt; SSTable C: [apple: v1], [banana: v4], [cherry: v2]</span>
                    <span className="code-line">SSTable B: [banana: v4], [cherry: v2] ──┘</span>
                  </code>
                </pre>
              </div>

              <p style={{ fontWeight: 500, color: "#ffffff" }}>What Compaction Does:</p>
              <ul className="guide-bullets-list">
                <li>
                  Selects Files: It picks two or more overlapping SSTable files.
                </li>
                <li>
                  Merges (K-Way Merge Sort): It reads them in sorted order, keeping only the newest version of each key and discarding tombstones.
                </li>
                <li>
                  Writes New SSTable: It writes the merged, deduplicated data into a new SSTable.
                </li>
                <li>
                  Updates Registry: It atomically updates the database manifest to point to the new file and discards the old input SSTables.
                </li>
              </ul>

              <p style={{ fontWeight: 500, color: "#ffffff", marginTop: 16 }}>Compaction Policies:</p>
              <p>
                Size-Tiered Compaction (PebbleDB default): Merges files of similar sizes when the total file count in a tier exceeds a limit. Simpler to implement but has higher temporary space requirements.
              </p>
              <p>
                Leveled Compaction (LevelDB/RocksDB): Divides disk storage into levels, where each level has a size limit (e.g., L1 is 10 MiB, L2 is 100 MiB). Keys within levels &gt; 0 are guaranteed to be non-overlapping.
              </p>
            </div>
          </div>
        </main>

        {/* Right Sidebar */}
        <aside className="guide-sidebar-right" aria-label="Page Outline">
          <div className="guide-sidebar-right-content">
            <h4 className="guide-sidebar-right-title">Outline</h4>
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

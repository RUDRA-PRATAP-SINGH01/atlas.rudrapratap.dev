import DocsNavbar from "@/components/docs/DocsNavbar";
import DocsSidebar from "@/components/docs/DocsSidebar";

const pageTopics = [
  { label: "Lookup Hierarchy", href: "#lookup-hierarchy" },
  { label: "Lock-Free SSTable Search", href: "#lock-free-search" },
  { label: "SSTable Internal Probing", href: "#internal-probing" },
];

function LookupFlowSvg() {
  return (
    <svg viewBox="0 0 500 280" className="w-full h-auto bg-[#0e0e11] border border-zinc-800 rounded-lg p-6 my-6" style={{ marginTop: 24, marginBottom: 24 }}>
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#71717a" />
        </marker>
      </defs>

      {/* Start Get(key) */}
      <rect x="180" y="10" width="140" height="30" rx="4" fill="#27272a" stroke="#ff5cad" strokeWidth="1.2" />
      <text x="250" y="29" fill="#ffffff" fontSize="11" fontWeight="bold" textAnchor="middle">Get(key)</text>

      {/* Probe 1: pendingBatch */}
      <path d="M 250 40 L 250 66" stroke="#71717a" strokeWidth="1.2" markerEnd="url(#arrow)" />
      <rect x="160" y="66" width="180" height="28" rx="4" fill="#18181b" stroke="#52525b" strokeWidth="1" />
      <text x="250" y="83" fill="#ffffff" fontSize="10" textAnchor="middle">1. Search pendingBatch</text>

      {/* Probe 2: active memtable */}
      <path d="M 250 94 L 250 120" stroke="#71717a" strokeWidth="1.2" markerEnd="url(#arrow)" />
      <rect x="160" y="120" width="180" height="28" rx="4" fill="#18181b" stroke="#52525b" strokeWidth="1" />
      <text x="250" y="137" fill="#ffffff" fontSize="10" textAnchor="middle">2. Search Active Memtable</text>

      {/* Probe 3: pendingFlush */}
      <path d="M 250 148 L 250 174" stroke="#71717a" strokeWidth="1.2" markerEnd="url(#arrow)" />
      <rect x="160" y="174" width="180" height="28" rx="4" fill="#18181b" stroke="#52525b" strokeWidth="1" />
      <text x="250" y="191" fill="#ffffff" fontSize="10" textAnchor="middle">3. Search pendingFlush Queue</text>

      {/* Probe 4: SSTables */}
      <path d="M 250 202 L 250 228" stroke="#71717a" strokeWidth="1.2" markerEnd="url(#arrow)" />
      <rect x="160" y="228" width="180" height="28" rx="4" fill="#18181b" stroke="#ff5cad" strokeWidth="1" />
      <text x="250" y="245" fill="#ffffff" fontSize="10" textAnchor="middle">4. Search Disk SSTables</text>

      {/* Direct Returns */}
      <path d="M 340 80 H 420 V 242 H 340" stroke="#71717a" strokeWidth="1" fill="none" />
      <text x="380" y="75" fill="#a1a1aa" fontSize="8" textAnchor="middle">Found</text>
      <text x="380" y="129" fill="#a1a1aa" fontSize="8" textAnchor="middle">Found</text>
      <text x="380" y="183" fill="#a1a1aa" fontSize="8" textAnchor="middle">Found</text>
    </svg>
  );
}

export default function ReadPathDocsPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="read-path-title">PebbleDB Subsystem: Read Path</h1>
            
            <div className="guide-body-text" style={{ marginTop: 24 }}>
              <p>
                This document specifies the read path of PebbleDB, detailing how the database searches for a key across volatile memory tables and immutable disk files.
              </p>

              <h2 className="guide-sub-heading" id="lookup-hierarchy" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>1. Lookup Hierarchy</h2>
              <p>
                PebbleDB performs point queries by searching storage layers sequentially from newest to oldest:
              </p>

              <LookupFlowSvg />

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>1.1 Search Order (Newest to Oldest)</h3>
              <ul className="guide-bullets-list">
                <li>
                  <span className="highlight-text">db.pendingBatch</span>: Searches the active write queue before updates are written to the active memtable. This ensures read-your-writes consistency for synchronous operations.
                </li>
                <li>
                  <span className="highlight-text">db.active Memtable</span>: Searches the active SkipList.
                </li>
                <li>
                  <span className="highlight-text">db.pendingFlush</span>: Searches frozen, read-only SkipLists waiting to be flushed to disk, starting with the newest entries.
                </li>
                <li>
                  <span className="highlight-text">db.sstables</span>: Searches SSTables on disk, starting with the newest files.
                </li>
              </ul>

              <h2 className="guide-sub-heading" id="lock-free-search" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>2. Lock-Free SSTable Search</h2>
              <p>
                To keep read operations scalable across multiple CPU cores, PebbleDB avoids holding global locks while reading from disk.
              </p>
              
              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>2.1 Pinned Readers and Reference Counting</h3>
              <ul className="guide-bullets-list">
                <li>
                  <span className="highlight-text">Acquire Read Lock</span>: The reader thread acquires db.mu.RLock().
                </li>
                <li>
                  <span className="highlight-text">Probing memory</span>: The thread searches memory tables. If a match is found, it releases the lock and returns the value.
                </li>
                <li>
                  <span className="highlight-text">Copy Active Readers</span>: If a cache miss occurs in memory, the thread takes a copy-on-write snapshot of the active SSTable readers (db.snapshotSSTables()).
                </li>
                <li>
                  <span className="highlight-text">Pin Files</span>: Iterates through the readers and calls Reader.Ref(). This increments the reference count on the reader handles, ensuring they remain open.
                </li>
                <li>
                  <span className="highlight-text">Release Read Lock</span>: Releases db.mu.RUnlock(). This allows background flush and compaction workers to continue running in parallel while the thread performs disk I/O.
                </li>
                <li>
                  <span className="highlight-text">De-referencing</span>: Once the lookup completes, the thread calls Reader.Unref() on the readers in a defer block. If a reader is discarded by a compaction worker during the lookup, its file is deleted from disk only after this query thread releases its reference.
                </li>
              </ul>

              <h2 className="guide-sub-heading" id="internal-probing" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>3. SSTable Internal Probing</h2>
              <p>
                For each pinned SSTable reader, the search runs along a strict progression:
              </p>

              <div className="guide-code-block-container" style={{ marginTop: 12, marginBottom: 20 }}>
                <pre className="guide-code-pre">
                  <code className="guide-code-lines">
                    <span className="code-line"><span className="code-comment">SSTable Reader Search Path:</span></span>
                    <span className="code-line">Bloom Probing ──&gt; Index Binary Search ──&gt; Block Cache ──&gt; Key Scan</span>
                  </code>
                </pre>
              </div>

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>3.1 Step-by-Step Search</h3>
              <ul className="guide-bullets-list">
                <li>
                  <span className="highlight-text">Bloom Probing</span>: The reader queries the Bloom filter via bloom.MayContain(key). If it returns false, the file is skipped, avoiding unnecessary disk reads.
                </li>
                <li>
                  <span className="highlight-text">Index Probing</span>: Performs a binary search on the index block (idx []IndexEntry). It finds the first entry where the block's last key is greater than or equal to the target key.
                  <div className="guide-code-block-container" style={{ marginTop: 12, marginBottom: 12 }}>
                    <pre className="guide-code-pre">
                      <code className="guide-code-lines">
                        <span className="code-line">idx := sort.Search(len(r.index), <span className="code-keyword">func</span>(i <span className="code-keyword">int</span>) <span className="code-keyword">bool</span> {"{"}</span>
                        <span className="code-line">    <span className="code-keyword">return</span> bytes.Compare(key, r.index[i].LastKey) &lt;= <span className="code-integer">0</span></span>
                        <span className="code-line">{"}"})</span>
                      </code>
                    </pre>
                  </div>
                  If idx is equal to the index length, the key is outside the file range, and the reader returns.
                </li>
                <li>
                  <span className="highlight-text">Block Retrieval</span>: Checks the LRU block cache using the compound key {"{"}FileID, BlockOffset{"}"}.
                  <ul style={{ paddingLeft: 16, marginTop: 8, listStyleType: "circle" }}>
                    <li>Cache Hit: Returns the cached data block immediately.</li>
                    <li>Cache Miss: Reads the raw block data from disk using file.ReadAt(), adds it to the block cache, and returns it.</li>
                  </ul>
                </li>
                <li>
                  <span className="highlight-text">Key Scan</span>: Instantiates a BlockIterator over the block data and scans the entries. If it finds a matching key, it returns the value (or ErrNotFound if the entry is a tombstone). If it encounters a key greater than the target key, the search in this file ends.
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

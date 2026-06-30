import DocsNavbar from "@/components/docs/DocsNavbar";
import DocsSidebar from "@/components/docs/DocsSidebar";

const pageTopics = [
  { label: "Snapshot Isolation Mechanics", href: "#snapshot-mechanics" },
  { label: "Multi-Source Merge Iterator", href: "#merge-iterator" },
  { label: "Boundary & Resource Cleanup", href: "#cleanup" },
];

function ScanFlowSvg() {
  return (
    <svg viewBox="0 0 500 220" className="w-full h-auto bg-[#0e0e11] border border-zinc-800 rounded-lg p-6 my-6" style={{ marginTop: 24, marginBottom: 24 }}>
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#71717a" />
        </marker>
      </defs>

      {/* Start Scan */}
      <rect x="20" y="10" width="130" height="30" rx="4" fill="#27272a" stroke="#ff5cad" strokeWidth="1.2" />
      <text x="85" y="29" fill="#ffffff" fontSize="11" fontWeight="bold" textAnchor="middle">Scan(start, end)</text>

      {/* RLock */}
      <path d="M 150 25 H 200" stroke="#71717a" strokeWidth="1.2" markerEnd="url(#arrow)" />
      <rect x="200" y="10" width="280" height="30" rx="4" fill="#18181b" stroke="#52525b" strokeWidth="1" />
      <text x="340" y="28" fill="#ffffff" fontSize="10" textAnchor="middle">1. Acquire db.mu.RLock()</text>

      {/* Snapshots */}
      <path d="M 340 40 L 340 70" stroke="#71717a" strokeWidth="1.2" markerEnd="url(#arrow)" />
      <rect x="200" y="70" width="280" height="66" rx="4" fill="#18181b" stroke="#52525b" strokeWidth="1" />
      <text x="210" y="88" fill="#ffffff" fontSize="9" textAnchor="start">2. Snapshot Memory Tables:</text>
      <text x="220" y="104" fill="#a1a1aa" fontSize="9" textAnchor="start">• activeSnap = active.Snapshot()</text>
      <text x="220" y="120" fill="#a1a1aa" fontSize="9" textAnchor="start">• Pin active SSTable Readers</text>

      {/* RUnlock */}
      <path d="M 340 136 L 340 166" stroke="#71717a" strokeWidth="1.2" markerEnd="url(#arrow)" />
      <rect x="200" y="166" width="280" height="30" rx="4" fill="#18181b" stroke="#ff5cad" strokeWidth="1.2" />
      <text x="340" y="184" fill="#ffffff" fontSize="10" textAnchor="middle">3. Release db.mu.RUnlock()</text>
    </svg>
  );
}

export default function ScanPathDocsPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="scan-path-title">PebbleDB Subsystem: Scan Path</h1>
            
            <div className="guide-body-text" style={{ marginTop: 24 }}>
              <p>
                This document specifies the range-scan pipeline in PebbleDB, detailing how the database executes range queries (Scan) while maintaining point-in-time snapshot isolation.
              </p>

              <h2 className="guide-sub-heading" id="snapshot-mechanics" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>1. Snapshot Isolation Mechanics</h2>
              <p>
                To prevent scans from blocking concurrent writes, PebbleDB takes a snapshot of the database state when Scan() is called, releasing global locks before iteration begins.
              </p>

              <ScanFlowSvg />

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>1.1 Step-by-Step Snapshot Sequence</h3>
              <ul className="guide-bullets-list">
                <li>
                  <span className="highlight-text">Acquire Lock</span>: The thread acquires the database read lock (db.mu.RLock()).
                </li>
                <li>
                  <span className="highlight-text">Snapshot Memory Tables</span>:
                  <ul style={{ paddingLeft: 16, marginTop: 8, listStyleType: "circle" }}>
                    <li>Active Memtable: Copies the active memtable skip list by traversing its base level and deep-copying all nodes (active.Snapshot()).</li>
                    <li>Pending Batch: Takes a snapshot of db.pendingBatch, resolving duplicate updates to keep only the latest version of each key.</li>
                    <li>Pending Flush: Iterates through db.pendingFlush queue entries and takes snapshots of their frozen memtables.</li>
                  </ul>
                </li>
                <li>
                  <span className="highlight-text">Pin SSTables</span>: Copies the active list of SSTable readers and increments their reference counts via Reader.Ref().
                </li>
                <li>
                  <span className="highlight-text">Release Lock</span>: Releases db.mu.RUnlock(). Any new writes, flushes, or compactions that occur after this point are invisible to the scan, preserving point-in-time snapshot isolation.
                </li>
              </ul>

              <h2 className="guide-sub-heading" id="merge-iterator" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>2. Multi-Source Merge Iterator</h2>
              <p>
                Once the snapshots are created, the database builds an array of iterator.Iterator interfaces and wraps them in a single merge-sort iterator.
              </p>

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>2.1 Priority Ordering</h3>
              <p>
                Each source is assigned a clear priority hierarchy:
              </p>

              {/* Table of Merge Iterator Priority */}
              <div style={{ overflowX: "auto", marginTop: 16, marginBottom: 20 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13, border: "1px solid rgba(255, 255, 255, 0.08)" }}>
                  <thead>
                    <tr style={{ background: "rgba(255, 92, 173, 0.08)", borderBottom: "1px solid rgba(255, 255, 255, 0.15)" }}>
                      <th style={{ padding: "10px 16px", color: "#ff5cad", fontWeight: 600 }}>Priority</th>
                      <th style={{ padding: "10px 16px", color: "#ff5cad", fontWeight: 600 }}>Source</th>
                      <th style={{ padding: "10px 16px", color: "#ff5cad", fontWeight: 600 }}>Sample Key</th>
                      <th style={{ padding: "10px 16px", color: "#ff5cad", fontWeight: 600 }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace" }}>1,000,001</td>
                      <td style={{ padding: "10px 16px" }}>pendingBatch (Newest data)</td>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace" }}>"apple"</td>
                      <td style={{ padding: "10px 16px", color: "#22c55e" }}>Active</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace" }}>1,000,000</td>
                      <td style={{ padding: "10px 16px" }}>active memtable</td>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace" }}>"banana"</td>
                      <td style={{ padding: "10px 16px", color: "#22c55e" }}>Active</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace" }}>999,999</td>
                      <td style={{ padding: "10px 16px" }}>pendingFlush memtables</td>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace" }}>"cherry"</td>
                      <td style={{ padding: "10px 16px", color: "#22c55e" }}>Active</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace" }}>0</td>
                      <td style={{ padding: "10px 16px" }}>sst_0001.sst (Oldest run)</td>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace" }}>"banana"</td>
                      <td style={{ padding: "10px 16px", color: "#22c55e" }}>Active</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>2.2 Merging Protocol</h3>
              <p>
                When the iterator is advanced, the merging protocol runs as follows:
              </p>
              <ul className="guide-bullets-list">
                <li>
                  <span className="highlight-text">Find Minimum Key</span>: Scans all active source iterators and finds the lexicographically smallest key.
                </li>
                <li>
                  <span className="highlight-text">Select Winner</span>: If the same key is present in multiple iterators, it selects the iterator with the highest priority as the winner.
                </li>
                <li>
                  <span className="highlight-text">Advance Iterators</span>: Advances all iterators positioned at this minimum key to their next entry. This discards duplicate, older values in lower-priority streams.
                </li>
                <li>
                  <span className="highlight-text">Tombstone Filtering</span>: If the winner key is marked as a tombstone, the iterator repeats the search loop internally, skipping the deleted key.
                </li>
              </ul>

              <h2 className="guide-sub-heading" id="cleanup" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>3. Boundary & Resource Cleanup</h2>
              <p>
                Range Limit: During iteration, the calling thread validates that the current key has not crossed the end key boundary:
              </p>

              <div className="guide-code-block-container" style={{ marginTop: 12, marginBottom: 20 }}>
                <pre className="guide-code-pre">
                  <code className="guide-code-lines">
                    <span className="code-line"><span className="code-keyword">func</span> (it *ScanIterator) <span className="code-function">Valid</span>() <span className="code-keyword">bool</span> {"{"}</span>
                    <span className="code-line">    <span className="code-keyword">if</span> it.closed {"{"} <span className="code-keyword">return</span> <span className="code-keyword">false</span> {"}"}</span>
                    <span className="code-line">    <span className="code-keyword">if</span> it.merge == nil || !it.merge.Valid() {"{"} <span className="code-keyword">return</span> <span className="code-keyword">false</span> {"}"}</span>
                    <span className="code-line">    <span className="code-keyword">if</span> len(it.end) == <span className="code-integer">0</span> {"{"} <span className="code-keyword">return</span> <span className="code-keyword">true</span> {"}"}</span>
                    <span className="code-line">    <span className="code-keyword">return</span> bytes.Compare(it.merge.Key(), it.end) &lt; <span className="code-integer">0</span></span>
                    <span className="code-line">{"}"}</span>
                  </code>
                </pre>
              </div>

              <p style={{ fontWeight: 500, color: "#ffffff", marginTop: 16 }}>Iterator Closure:</p>
              <p>
                When the client calls Close():
              </p>
              <ul className="guide-bullets-list">
                <li>
                  Closes the underlying merging iterator.
                </li>
                <li>
                  Iterates through the pinned SSTable readers and decrements their reference counts (Reader.Unref()), allowing obsolete files to be deleted from disk.
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

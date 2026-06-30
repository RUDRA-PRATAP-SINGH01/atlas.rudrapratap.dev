import DocsNavbar from "@/components/docs/DocsNavbar";
import DocsSidebar from "@/components/docs/DocsSidebar";

const pageTopics = [
  { label: "Subsystem Role & Lifecycle", href: "#role-lifecycle" },
  { label: "Memtable Snapshot Isolation", href: "#snapshot-isolation" },
  { label: "SkipList Iterator Integration", href: "#iterator-integration" },
];

function LifecycleSvg() {
  return (
    <svg viewBox="0 0 500 240" className="w-full h-auto bg-[#0e0e11] border border-zinc-800 rounded-lg p-6 my-6" style={{ marginTop: 24, marginBottom: 24 }}>
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#71717a" />
        </marker>
      </defs>

      {/* Put/Delete */}
      <rect x="180" y="10" width="140" height="30" rx="4" fill="#27272a" stroke="#52525b" strokeWidth="1" />
      <text x="250" y="29" fill="#ffffff" fontSize="10" textAnchor="middle" fontWeight="bold">Put / Delete (Active)</text>

      {/* Active Memtable */}
      <path d="M 250 40 L 250 66" stroke="#71717a" strokeWidth="1.2" markerEnd="url(#arrow)" />
      <rect x="150" y="66" width="200" height="32" rx="4" fill="#18181b" stroke="#ff5cad" strokeWidth="1.2" />
      <text x="250" y="86" fill="#ffffff" fontSize="11" textAnchor="middle" fontWeight="bold">active Memtable</text>

      {/* Exceeds threshold */}
      <path d="M 250 98 L 250 130" stroke="#71717a" strokeWidth="1.2" markerEnd="url(#arrow)" />
      <text x="260" y="117" fill="#a1a1aa" fontSize="8">Exceeds size limit (4 MiB)</text>

      {/* pendingFlush */}
      <rect x="150" y="130" width="200" height="32" rx="4" fill="#18181b" stroke="#52525b" strokeWidth="1" />
      <text x="250" y="150" fill="#ffffff" fontSize="11" textAnchor="middle" fontWeight="bold">pendingFlush Queue</text>

      {/* flusher writes */}
      <path d="M 250 162 L 250 194" stroke="#71717a" strokeWidth="1.2" markerEnd="url(#arrow)" />
      <text x="260" y="181" fill="#a1a1aa" fontSize="8">flusher thread writes</text>

      {/* sst file */}
      <rect x="150" y="194" width="200" height="32" rx="4" fill="#18181b" stroke="#ff5cad" strokeWidth="1" />
      <text x="250" y="214" fill="#ffffff" fontSize="11" textAnchor="middle" fontWeight="bold">sst_*.sst file (Disk)</text>
    </svg>
  );
}

export default function MemtableDocsPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="memtable-title">PebbleDB Subsystem: Memtable</h1>
            
            <div className="guide-body-text" style={{ marginTop: 24 }}>
              <p>
                This document specifies the design, lifecycle, and concurrency control of PebbleDB's in-memory storage buffer (the Memtable), detailing the memory management, frozen table queuing, snapshotting logic, and iterator mechanics.
              </p>

              <h2 className="guide-sub-heading" id="role-lifecycle" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>1. Subsystem Role and Lifecycle</h2>
              <p>
                The Memtable is the volatile write buffer that processes incoming database mutations before they are serialized to disk as SSTables. It manages data in sorted order using a concurrent SkipList.
              </p>

              <LifecycleSvg />

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>1.1 Lifecycle Transitions</h3>
              <ul className="guide-bullets-list">
                <li>
                  <span className="highlight-text">Active</span>: Accepts concurrent writes (Put/Delete). Point reads (Get) and snapshot scans can query it concurrently.
                </li>
                <li>
                  <span className="highlight-text">Frozen (pendingFlush)</span>: When the size of the active memtable exceeds MemtableSize (default 4 MiB), the database swaps the active SkipList with a fresh one and places the frozen table in db.pendingFlush.
                </li>
                <li>
                  <span className="highlight-text">Serialized</span>: The background flusher goroutine reads frozen memtables, writes them sequentially to an SSTable file on disk, commits the changes to the manifest, and removes the memtable from db.pendingFlush.
                </li>
              </ul>

              <h2 className="guide-sub-heading" id="snapshot-isolation" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>2. Memtable Snapshot Isolation</h2>
              <p>
                To prevent scans from blocking concurrent writes, range queries (Scan) create a point-in-time snapshot of the memtable under a brief read lock.
              </p>

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>2.1 Go Implementation: Snapshot Deep Copy</h3>
              <p>
                The snapshot method deep-copies all active elements. The returned slice can be read concurrently without acquiring locks or blocking updates to the active SkipList:
              </p>

              <div className="guide-code-block-container" style={{ marginTop: 8, marginBottom: 20 }}>
                <pre className="guide-code-pre">
                  <code className="guide-code-lines">
                    <span className="code-line"><span className="code-keyword">type</span> SnapshotEntry <span className="code-keyword">struct</span> {"{"}</span>
                    <span className="code-line">	Key       []<span className="code-keyword">byte</span></span>
                    <span className="code-line">	Value     []<span className="code-keyword">byte</span></span>
                    <span className="code-line">	Tombstone <span className="code-keyword">bool</span></span>
                    <span className="code-line">{"}"}</span>
                    <span className="code-line"><span className="code-keyword">func</span> (sl *SkipList) <span className="code-function">Snapshot</span>() []SnapshotEntry {"{"}</span>
                    <span className="code-line">	sl.mu.RLock()</span>
                    <span className="code-line">	<span className="code-keyword">defer</span> sl.mu.RUnlock()</span>
                    <span className="code-line">	out := make([]SnapshotEntry, <span className="code-integer">0</span>, sl.length)</span>
                    <span className="code-line">	<span className="code-keyword">for</span> x := sl.head.next[<span className="code-integer">0</span>]; x != nil; x = x.next[<span className="code-integer">0</span>] {"{"}</span>
                    <span className="code-line">		e := SnapshotEntry{"{"}</span>
                    <span className="code-line">			Key:       append([]<span className="code-keyword">byte</span>(nil), x.key...),</span>
                    <span className="code-line">			Tombstone: x.tombstone,</span>
                    <span className="code-line">		{"}"}</span>
                    <span className="code-line">		<span className="code-keyword">if</span> !x.tombstone {"{"}</span>
                    <span className="code-line">			e.Value = append([]<span className="code-keyword">byte</span>(nil), x.value...)</span>
                    <span className="code-line">		{"}"}</span>
                    <span className="code-line">		out = append(out, e)</span>
                    <span className="code-line">	{"}"}</span>
                    <span className="code-line">	<span className="code-keyword">return</span> out</span>
                    <span className="code-line">{"}"}</span>
                  </code>
                </pre>
              </div>

              <h2 className="guide-sub-heading" id="iterator-integration" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>3. SkipList Iterator Integration</h2>
              <p>
                For operations that require replaying or sequential scanning, the database utilizes a SkipListIterator.
              </p>

              <div className="guide-warning-banner" style={{ borderLeft: "4px solid #ff5cad", background: "rgba(255, 92, 173, 0.05)", padding: 12, borderRadius: 4, marginBottom: 20 }}>
                <p style={{ fontWeight: 600, color: "#ffffff", margin: 0 }}>WARNING</p>
                <p style={{ margin: "4px 0 0 0" }}>
                  The SkipListIterator holds a shared read lock on the SkipList until Close() is called. Callers must call Close() (typically in a defer block) to prevent deadlocks on write threads.
                </p>
              </div>

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>3.1 Go Implementation: SkipList Iterator</h3>
              <div className="guide-code-block-container" style={{ marginTop: 8, marginBottom: 20 }}>
                <pre className="guide-code-pre">
                  <code className="guide-code-lines">
                    <span className="code-line"><span className="code-keyword">type</span> SkipListIterator <span className="code-keyword">struct</span> {"{"}</span>
                    <span className="code-line">	sl   *SkipList</span>
                    <span className="code-line">	node *node</span>
                    <span className="code-line">{"}"}</span>
                    <span className="code-line"><span className="code-keyword">func</span> (sl *SkipList) <span className="code-function">Iterator</span>() *SkipListIterator {"{"}</span>
                    <span className="code-line">	sl.mu.RLock()</span>
                    <span className="code-line">	<span className="code-keyword">return</span> &amp;SkipListIterator{"{"}</span>
                    <span className="code-line">		sl:   sl,</span>
                    <span className="code-line">		node: sl.head.next[<span className="code-integer">0</span>],</span>
                    <span className="code-line">	{"}"}</span>
                    <span className="code-line">{"}"}</span>
                    <span className="code-line"><span className="code-keyword">func</span> (it *SkipListIterator) <span className="code-function">Valid</span>() <span className="code-keyword">bool</span> {"{"}</span>
                    <span className="code-line">	<span className="code-keyword">return</span> it.node != nil</span>
                    <span className="code-line">{"}"}</span>
                    <span className="code-line"><span className="code-keyword">func</span> (it *SkipListIterator) <span className="code-function">Next</span>() {"{"}</span>
                    <span className="code-line">	<span className="code-keyword">if</span> it.node != nil {"{"}</span>
                    <span className="code-line">		it.node = it.node.next[<span className="code-integer">0</span>]</span>
                    <span className="code-line">	{"}"}</span>
                    <span className="code-line">{"}"}</span>
                    <span className="code-line"><span className="code-keyword">func</span> (it *SkipListIterator) <span className="code-function">Key</span>() []<span className="code-keyword">byte</span> {"{"}</span>
                    <span className="code-line">	<span className="code-keyword">if</span> it.node == nil {"{"}</span>
                    <span className="code-line">		<span className="code-keyword">return</span> nil</span>
                    <span className="code-line">	{"}"}</span>
                    <span className="code-line">	<span className="code-keyword">return</span> append([]<span className="code-keyword">byte</span>(nil), it.node.key...)</span>
                    <span className="code-line">{"}"}</span>
                    <span className="code-line"><span className="code-keyword">func</span> (it *SkipListIterator) <span className="code-function">Value</span>() []<span className="code-keyword">byte</span> {"{"}</span>
                    <span className="code-line">	<span className="code-keyword">if</span> it.node == nil || it.node.tombstone {"{"}</span>
                    <span className="code-line">		<span className="code-keyword">return</span> nil</span>
                    <span className="code-line">	{"}"}</span>
                    <span className="code-line">	<span className="code-keyword">return</span> append([]<span className="code-keyword">byte</span>(nil), it.node.value...)</span>
                    <span className="code-line">{"}"}</span>
                    <span className="code-line"><span className="code-keyword">func</span> (it *SkipListIterator) <span className="code-function">Close</span>() {"{"}</span>
                    <span className="code-line">	<span className="code-keyword">if</span> it.sl != nil {"{"}</span>
                    <span className="code-line">		it.sl.mu.RUnlock()</span>
                    <span className="code-line">		it.sl = nil</span>
                    <span className="code-line">	{"}"}</span>
                    <span className="code-line">{"}"}</span>
                  </code>
                </pre>
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

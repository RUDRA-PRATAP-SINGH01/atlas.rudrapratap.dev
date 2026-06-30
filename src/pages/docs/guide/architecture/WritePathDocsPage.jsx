import DocsNavbar from "@/components/docs/DocsNavbar";
import DocsSidebar from "@/components/docs/DocsSidebar";

const pageTopics = [
  { label: "Sequential Operation Analysis", href: "#operation-analysis" },
  { label: "Ingestion Flow", href: "#ingestion-flow" },
  { label: "Group Commit & the batchFlusher", href: "#group-commit" },
  { label: "Memtable Flush Queuing", href: "#flush-queuing" },
];

function SequenceSvg() {
  return (
    <svg viewBox="0 0 600 400" className="w-full h-auto bg-[#0e0e11] border border-zinc-800 rounded-lg p-6 my-6" style={{ marginTop: 24, marginBottom: 24 }}>
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#71717a" />
        </marker>
        <marker id="dashed-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#a1a1aa" />
        </marker>
      </defs>

      {/* Vertical Lifelines */}
      <line x1="100" y1="40" x2="100" y2="370" stroke="#3f3f46" strokeWidth="1" strokeDasharray="4 4" />
      <line x1="300" y1="40" x2="300" y2="370" stroke="#3f3f46" strokeWidth="1" strokeDasharray="4 4" />
      <line x1="500" y1="40" x2="500" y2="370" stroke="#3f3f46" strokeWidth="1" strokeDasharray="4 4" />

      {/* Lifeline Labels */}
      <rect x="30" y="10" width="140" height="26" rx="4" fill="#18181b" stroke="#3f3f46" />
      <text x="100" y="26" fill="#ffffff" fontSize="10" textAnchor="middle" fontWeight="bold">App Goroutine</text>

      <rect x="230" y="10" width="140" height="26" rx="4" fill="#18181b" stroke="#ff5cad" />
      <text x="300" y="26" fill="#ffffff" fontSize="10" textAnchor="middle" fontWeight="bold">DB Ingestion API</text>

      <rect x="430" y="10" width="140" height="26" rx="4" fill="#18181b" stroke="#3f3f46" />
      <text x="500" y="26" fill="#ffffff" fontSize="10" textAnchor="middle" fontWeight="bold">batchFlusher Worker</text>

      {/* Step 1: Put/Delete */}
      <path d="M 100 65 H 294" stroke="#ff5cad" strokeWidth="1.2" markerEnd="url(#arrow)" />
      <text x="190" y="58" fill="#ff5cad" fontSize="9" textAnchor="middle">Put / Delete</text>

      {/* API Active Box */}
      <rect x="294" y="75" width="12" height="110" fill="#27272a" stroke="#52525b" />
      <text x="312" y="90" fill="#ffffff" fontSize="8">Acquire db.mu</text>
      <text x="312" y="110" fill="#ffffff" fontSize="8">Append to pendingBatch</text>
      <text x="312" y="130" fill="#ffffff" fontSize="8">Schedule Ingestion Timer</text>
      <text x="312" y="150" fill="#ffffff" fontSize="8">Release db.mu</text>

      {/* Step 2: Send Sync Request */}
      <path d="M 306 170 H 494" stroke="#71717a" strokeWidth="1.2" markerEnd="url(#arrow)" />
      <text x="400" y="163" fill="#a1a1aa" fontSize="9" textAnchor="middle">Send Sync Request</text>

      {/* Worker Active Box */}
      <rect x="494" y="180" width="12" height="130" fill="#27272a" stroke="#52525b" />
      <text x="480" y="200" fill="#ffffff" fontSize="8" textAnchor="end">Swap pendingBatch</text>
      <text x="480" y="220" fill="#ffffff" fontSize="8" textAnchor="end">wal.AppendBatch()</text>
      <text x="480" y="240" fill="#ffffff" fontSize="8" textAnchor="end">file.Sync() [fsync]</text>
      <text x="480" y="260" fill="#ffffff" fontSize="8" textAnchor="end">Apply to Memtable</text>
      <text x="480" y="280" fill="#ffffff" fontSize="8" textAnchor="end">Check size limit</text>

      {/* Step 3: Sync Complete */}
      <path d="M 494 300 H 306" stroke="#71717a" strokeWidth="1.2" strokeDasharray="3 3" markerEnd="url(#dashed-arrow)" />
      <text x="400" y="293" fill="#a1a1aa" fontSize="9" textAnchor="middle">Sync Complete</text>

      {/* Step 4: Acknowledge */}
      <path d="M 294 330 H 106" stroke="#ff5cad" strokeWidth="1.2" strokeDasharray="3 3" markerEnd="url(#dashed-arrow)" />
      <text x="190" y="323" fill="#ff5cad" fontSize="9" textAnchor="middle">Acknowledge</text>
    </svg>
  );
}

export default function WritePathDocsPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="write-path-title">PebbleDB Subsystem: Write Path</h1>
            
            <div className="guide-body-text" style={{ marginTop: 24 }}>
              <p>
                This document specifies the write pipeline in PebbleDB, detailing how user mutations (Put and Delete) are ingested, batched, written to disk, applied to memory, and eventually scheduled for serialization to disk.
              </p>

              <h2 className="guide-sub-heading" id="operation-analysis" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>1. Sequential Operation Analysis</h2>
              <p>
                The database ingest pipeline is designed around a single constraint: WAL persistence must precede memtable modifications.
              </p>

              <SequenceSvg />

              <h3 id="ingestion-flow" style={{ fontSize: 18, color: "#ffffff", marginTop: 28, marginBottom: 12 }}>1.1 Ingestion Flow</h3>
              <ul className="guide-bullets-list">
                <li>
                  <span className="highlight-text">Block Validation</span>: The writer thread calls writeBlockingBackgroundErr() to verify that no background worker has reported a fatal error (such as a WAL append failure or disk capacity exhaustion).
                </li>
                <li>
                  <span className="highlight-text">Locking</span>: The thread locks db.mu to serialize operations on the active batch array.
                </li>
                <li>
                  <span className="highlight-text">Queueing</span>: Appends a new wal.Record to db.pendingBatch. The key and value are deep-copied into new byte slices (ownedRecord) to prevent aliasing issues if the caller modifies the slice after return.
                </li>
                <li>
                  <span className="highlight-text">Timer Scheduling</span>: The thread calls db.scheduleBatchFlushLocked(). If no timer is active, a background time.AfterFunc timer is scheduled with a delay of BatchFlushDelay (default 1 ms). This delay groups multiple concurrent writes into a single disk I/O operation.
                </li>
                <li>
                  <span className="highlight-text">Synchronous Threshold Assessment</span>: The thread evaluates whether this write should bypass the timer and trigger an immediate group sync. A sync is triggered if:
                  <ul style={{ paddingLeft: 16, marginTop: 8, listStyleType: "circle" }}>
                    <li>SyncWrites is enabled (via Options or the CLI -sync-writes flag).</li>
                    <li>The batch record count exceeds batchMaxRecords = 64.</li>
                    <li>The batch byte size exceeds batchMaxBytes = 16 KB.</li>
                    <li>The estimated memtable size exceeds MemtableSize.</li>
                  </ul>
                </li>
                <li>
                  <span className="highlight-text">Awaiting Sync</span>: If any threshold is met, the thread releases db.mu, creates a reply channel, sends it to db.batchSyncCh, and blocks waiting for the group sync to complete. Otherwise, the thread releases the lock and returns nil (asynchronous commit mode).
                </li>
              </ul>

              <h2 className="guide-sub-heading" id="group-commit" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>2. Group Commit & the batchFlusher</h2>
              <p>
                The group-commit protocol is managed by the batchFlusher goroutine, which serializes pending database mutations.
              </p>

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 8 }}>2.1 Worker Loop</h3>
              <div className="guide-code-block-container" style={{ marginTop: 8, marginBottom: 20 }}>
                <pre className="guide-code-pre">
                  <code className="guide-code-lines">
                    <span className="code-line"><span className="code-keyword">func</span> (db *DB) <span className="code-function">batchFlusher</span>() {"{"}</span>
                    <span className="code-line">    <span className="code-keyword">defer</span> close(db.batchDone)</span>
                    <span className="code-line">    <span className="code-keyword">for</span> {"{"}</span>
                    <span className="code-line">        <span className="code-keyword">select</span> {"{"}</span>
                    <span className="code-line">        <span className="code-keyword">case</span> &lt;-db.batchStop:</span>
                    <span className="code-line">            <span className="code-keyword">if</span> err := db.flushPendingBatch(); err != nil {"{"}</span>
                    <span className="code-line">                db.batchStopErr = err</span>
                    <span className="code-line">            {"}"}</span>
                    <span className="code-line">            <span className="code-keyword">return</span></span>
                    <span className="code-line">        <span className="code-keyword">case</span> reply := &lt;-db.batchSyncCh:</span>
                    <span className="code-line">            reply &lt;- db.flushPendingBatch()</span>
                    <span className="code-line">        <span className="code-keyword">case</span> &lt;-db.batchFlushCh:</span>
                    <span className="code-line">            <span className="code-keyword">if</span> err := db.flushPendingBatch(); err != nil {"{"}</span>
                    <span className="code-line">                log.Printf(<span className="code-string">"pebbledb: async batch flush: %v"</span>, err)</span>
                    <span className="code-line">            {"}"}</span>
                    <span className="code-line">        {"}"}</span>
                    <span className="code-line">    {"}"}</span>
                    <span className="code-line">{"}"}</span>
                  </code>
                </pre>
              </div>

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 8 }}>2.2 Execution Steps of flushPendingBatch</h3>
              <p>
                The flusher drains the active write queue via the following sequential steps:
              </p>
              <ul className="guide-bullets-list">
                <li>
                  <span className="highlight-text">Extract Batch</span>: Locks db.mu and checks if db.pendingBatch is empty. If not, it copies the reference to a local slice, clears db.pendingBatch, and releases the lock to keep it free during disk I/O.
                </li>
                <li>
                  <span className="highlight-text">Acquire Barrier</span>: Calls db.batchPersist.begin(). This updates the active write count, preventing concurrent Sync() calls from returning before this batch is durable.
                </li>
                <li>
                  <span className="highlight-text">Append to WAL</span>: Writes all records in the batch to disk in a single write operation via db.wal.AppendBatch(batch).
                </li>
                <li>
                  <span className="highlight-text">Hardware Sync</span>: Invokes file.Sync() on the WAL file. This blocks until the storage controller confirms the data is physically written to non-volatile storage.
                </li>
                <li>
                  <span className="highlight-text">Rollback Handle</span>: If the WAL append or sync fails, it locks db.mu and restores the local batch back to the front of db.pendingBatch, registers the error in the background error store, and returns the error to the calling threads.
                </li>
                <li>
                  <span className="highlight-text">Apply to Memtable</span>: If the write succeeds, the worker locks db.mu and iterates through the batch, applying each mutation to the active memtable SkipList.
                </li>
                <li>
                  <span className="highlight-text">Evaluate Memtable Flush</span>: Invokes db.maybeFlushLocked().
                </li>
              </ul>

              <h2 className="guide-sub-heading" id="flush-queuing" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>3. Memtable Flush Queuing</h2>
              <p>
                When the memory footprint of the active memtable exceeds MemtableSize, it must be frozen and scheduled for flush to prevent memory exhaustion.
              </p>

              <p style={{ fontWeight: 500, color: "#ffffff", marginTop: 16 }}>Swapping Steps (maybeFlushLocked):</p>
              <ul className="guide-bullets-list">
                <li>
                  <span className="highlight-text">Size Check</span>: Compares db.active.Size() against db.memtableSize. If it is smaller, it returns.
                </li>
                <li>
                  <span className="highlight-text">Measure WAL Cutoff</span>: Calls db.wal.Size(). This byte offset marks the boundary of the WAL. Any WAL records located before this offset are captured in the frozen memtable.
                </li>
                <li>
                  <span className="highlight-text">Queue frozen table</span>: Appends a flushQueueEntry containing the frozen active table and its WAL boundary cutoff offset to db.pendingFlush.
                </li>
                <li>
                  <span className="highlight-text">Re-instantiate Active table</span>: Replaces db.active with a fresh SkipList.
                </li>
                <li>
                  <span className="highlight-text">Signal Flusher</span>: Triggers a non-blocking notification on the flusher channel (db.flushCh).
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

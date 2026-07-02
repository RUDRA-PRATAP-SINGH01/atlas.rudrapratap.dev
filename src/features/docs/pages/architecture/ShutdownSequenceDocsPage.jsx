import DocsNavbar from "@/features/docs/components/DocsNavbar";
import DocsSidebar from "@/features/docs/components/DocsSidebar";

const pageTopics = [
  { label: "Sequential Shutdown Execution", href: "#sequential-execution" },
  { label: "Resource & Thread Safety", href: "#thread-safety" },
  { label: "Error Handling and Abnormal Exits", href: "#error-handling" },
];

function ShutdownFlowSvg() {
  return (
    <svg viewBox="0 0 500 240" className="w-full h-auto bg-[#0e0e11] border border-zinc-800 rounded-lg p-6 my-6" style={{ marginTop: 24, marginBottom: 24 }}>
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#71717a" />
        </marker>
      </defs>

      {/* Start Close */}
      <rect x="180" y="10" width="140" height="30" rx="4" fill="#27272a" stroke="#ff5cad" strokeWidth="1.2" />
      <text x="250" y="29" fill="#ffffff" fontSize="11" fontWeight="bold" textAnchor="middle">Close()</text>

      {/* Lock/Closed */}
      <path d="M 250 40 L 250 66" stroke="#71717a" strokeWidth="1.2" markerEnd="url(#arrow)" />
      <rect x="150" y="66" width="200" height="28" rx="4" fill="#18181b" stroke="#52525b" strokeWidth="1" />
      <text x="250" y="83" fill="#ffffff" fontSize="10" textAnchor="middle">1. Acquire lock & Set db.closed = true</text>

      {/* Stop Writers */}
      <path d="M 250 94 L 250 120" stroke="#71717a" strokeWidth="1.2" markerEnd="url(#arrow)" />
      <rect x="150" y="120" width="200" height="28" rx="4" fill="#18181b" stroke="#52525b" strokeWidth="1" />
      <text x="250" y="137" fill="#ffffff" fontSize="10" textAnchor="middle">2. Stop batchFlusher & Freeze active table</text>

      {/* Stop Workers */}
      <path d="M 250 148 L 250 174" stroke="#71717a" strokeWidth="1.2" markerEnd="url(#arrow)" />
      <rect x="150" y="174" width="200" height="28" rx="4" fill="#18181b" stroke="#52525b" strokeWidth="1" />
      <text x="250" y="191" fill="#ffffff" fontSize="10" textAnchor="middle">3. Stop flusher & compactor sequentially</text>

      {/* Release */}
      <path d="M 250 202 L 250 228" stroke="#71717a" strokeWidth="1.2" markerEnd="url(#arrow)" />
      <rect x="150" y="228" width="200" height="28" rx="4" fill="#18181b" stroke="#ff5cad" strokeWidth="1.2" />
      <text x="250" y="245" fill="#ffffff" fontSize="10" textAnchor="middle">4. Close file descriptors & Release LOCK</text>
    </svg>
  );
}

export default function ShutdownSequenceDocsPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="shutdown-sequence-title">PebbleDB Subsystem: Shutdown Sequence</h1>
            
            <div className="guide-body-text" style={{ marginTop: 24 }}>
              <p>
                This document specifies the shutdown sequence of PebbleDB, detailing how the database stops background workers, flushes volatile tables, and releases system resources safely when Close() is called.
              </p>

              <h2 className="guide-sub-heading" id="sequential-execution" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>1. Sequential Shutdown Execution</h2>
              <p>
                The shutdown pipeline coordinates the termination of foreground requests, the serialization of active memtables, and the release of OS locks.
              </p>

              <ShutdownFlowSvg />

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>1.1 Step-by-Step Shutdown</h3>
              <ul className="guide-bullets-list">
                <li>
                  <span className="highlight-text">Acquire Lock</span>: Locks db.mu to block incoming writes.
                </li>
                <li>
                  <span className="highlight-text">Set Closed Flag</span>: Sets db.closed = true. Subsequent user operations (Put, Delete, Sync, or Scan) return ErrClosed immediately.
                </li>
                <li>
                  <span className="highlight-text">Terminate batchFlusher</span>: Closes the db.batchStop channel and releases the lock. This worker writes any pending records in pendingBatch to the WAL, executes a final fsync, applies them to the active memtable, and exits. The database blocks waiting for db.batchDone to close.
                </li>
                <li>
                  <span className="highlight-text">Freeze Active Memtable</span>: Re-acquires the lock, freezes the active memtable SkipList, and appends it to db.pendingFlush.
                </li>
                <li>
                  <span className="highlight-text">Signal Flusher</span>: Calls db.notifyFlushForce() to trigger the background flusher.
                </li>
                <li>
                  <span className="highlight-text">Wait for Flush Drain</span>: Releases the lock and blocks waiting for the flusher queue to empty.
                </li>
                <li>
                  <span className="highlight-text">Timeout Guard</span>: If the queue is not drained within 30 seconds, the shutdown aborts and returns ErrCloseIncomplete. File handles are kept open to prevent background threads from racing with nil pointers.
                </li>
                <li>
                  <span className="highlight-text">Terminate Flusher</span>: Closes the flusher channel (db.flushCh) and waits for db.flushDone to close.
                </li>
                <li>
                  <span className="highlight-text">Terminate Compactor</span>: Closes the compactor channel (db.compactCh) and waits for db.compactDone to close.
                </li>
                <li>
                  <span className="highlight-text">Release Lock and File Handles</span>:
                  <ul style={{ paddingLeft: 16, marginTop: 8, listStyleType: "circle" }}>
                    <li>Releases db.mu.</li>
                    <li>Closes the manifest log file handle.</li>
                    <li>Closes the WAL file handle.</li>
                    <li>Closes the directory LOCK file and unlocks it.</li>
                  </ul>
                </li>
              </ul>

              <h2 className="guide-sub-heading" id="thread-safety" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>2. Resource & Thread Safety</h2>
              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>2.1 The Shutdown Race Condition</h3>
              <p>
                PebbleDB prevents a common LSM race condition during shutdown: if background threads are not stopped before file handles are closed, they may attempt to write to closed descriptors, causing panics or data corruption.
              </p>
              <p>
                PebbleDB prevents this by stopping the threads in a strict, sequential order:
              </p>
              <ul className="guide-bullets-list">
                <li>
                  <span className="highlight-text">Stop Writers</span>: The batchFlusher is stopped first. This prevents new updates from modifying the active memtable while it is being flushed.
                </li>
                <li>
                  <span className="highlight-text">Stop Flusher</span>: The flusher is stopped only after it has finished writing all frozen memtables to disk.
                </li>
                <li>
                  <span className="highlight-text">Stop Compactor</span>: The compactor is stopped last. It finishes any active compaction run and exits.
                </li>
                <li>
                  <span className="highlight-text">Close Files</span>: Once all threads are stopped, the database closes the manifest, WAL, and SSTable file handles.
                </li>
                <li>
                  <span className="highlight-text">Release Lock</span>: The directory lock is released only after all file handles are closed.
                </li>
              </ul>

              <h2 className="guide-sub-heading" id="error-handling" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>3. Error Handling and Abnormal Exits</h2>
              <p>
                <span className="highlight-text">ErrCloseIncomplete</span>: If the database fails to flush frozen memtables to disk within the 30-second timeout, it returns ErrCloseIncomplete. In this state:
              </p>
              <ul className="guide-bullets-list">
                <li>
                  The database is partially closed but remains safe.
                </li>
                <li>
                  The WAL contains all uncommitted writes.
                </li>
                <li>
                  On the next startup (Open()), the engine will recover the uncommitted data by replaying the WAL tail.
                </li>
              </ul>
              <p>
                <span className="highlight-text">Double Close</span>: If Close() is called multiple times, the database returns ErrClosed on subsequent calls without throwing panics or deadlocks.
              </p>
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

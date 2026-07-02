import React from "react";
import DocsNavbar from "@/features/docs/components/DocsNavbar";
import DocsSidebar from "@/features/docs/components/DocsSidebar";
import DocsMermaid from "@/features/docs/components/DocsMermaid";
import GoCodeBlock from "@/features/docs/components/GoCodeBlock";

const pageTopics = [
  { label: "Directory Lock & Setup Boot", href: "#boot-lock" },
  { label: "Background Goroutine Spawning", href: "#background-workers" },
  { label: "The Shutdown Synchronization Sequence", href: "#shutdown-sequence" },
];

const BOOT_LOCK_CHART = `flowchart LR
    open["Open(Options)"] --> mkdir["MkdirAll"]
    mkdir --> lock["Acquire LOCK"]
    lock --> manifest["Load Manifest"]
    manifest --> sst["Discover SSTs"]
    sst --> replay["Replay WAL"]
    replay --> workers["Run Background Workers"]
    replay --> open_wal["Open WAL Append"]
    replay --> load_readers["Load live SST Readers"]
    
    style open fill:#18181b,stroke:#ff5cad,stroke-width:1.5px
    style workers fill:#18181b,stroke:#ff5cad,stroke-width:1.5px`;

const SHUTDOWN_SEQUENCE_CHART = `sequenceDiagram
    autonumber
    actor User as User Goroutine
    participant BF as batchFlusher
    participant FL as flusher
    participant CO as compactor
    participant D as Disk

    User->>User: Set db.closed = true
    User->>BF: Stop and close batchStop channel
    BF->>D: Flush remaining records in pendingBatch
    BF->>BF: Exit batchFlusher
    User->>FL: Swap active SkipList → pendingFlush
    User->>FL: Notify flush via db.flushCh
    FL->>D: Write SkipList to SSTable
    FL->>FL: Exit flusher
    User->>CO: Close db.compactCh
    CO->>CO: Exit compactor
    User->>D: Sync and Close wal.log
    User->>D: Close manifest.log
    User->>D: Release file lock (os.Remove LOCK)`;

const BOOT_LOCK_CODE = `func acquireDirLock(dir string) (*os.File, error) {
	lockPath := filepath.Join(dir, "LOCK")
	f, err := os.OpenFile(lockPath, os.O_CREATE|os.O_RDWR, 0666)
	if err != nil {
		return nil, err
	}
	if err := lockFile(f); err != nil { // platform-specific syscall wrapper
		f.Close()
		return nil, fmt.Errorf("pebbledb: acquire lock on %s: %w", lockPath, ErrDirLocked)
	}
	return f, nil
}`;

const WORKER_SPAWN_CODE = `go db.batchFlusher() // Coordinates group commits
go db.flusher()      // Writes immutable memtables to SSTables on disk
go db.compactor()    // Consolidates overlapping SSTables in the background`;

const GRACE_PERIOD_CODE = `var (
	closeFlushDrainTimeout = 30 * time.Second
	closeWorkerJoinTimeout = 30 * time.Second
)`;

export default function DbLifecycleDocsPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="db-lifecycle-title">
              PebbleDB Subsystem: Database Lifecycle
            </h1>

            <div className="guide-body-text" style={{ marginTop: 24 }}>
              <p>
                This document specifies the complete lifetime cycle of a PebbleDB instance, covering directory boot locks,
                background worker scheduling, write/read operation periods, and the shutdown synchronization sequence.
              </p>

              {/* ── 1. Directory Lock & Setup Boot ── */}
              <h2 className="guide-sub-heading" id="boot-lock" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                1. Directory Lock & Setup Boot
              </h2>
              <p>
                PebbleDB restricts access to its data directory to a single process at a time using a file lock (<code className="inline-code">LOCK</code> file) to prevent data corruption.
              </p>
              <DocsMermaid chart={BOOT_LOCK_CHART} />

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>1.1 Go Implementation: Boot locking</h3>
              <p>
                PebbleDB coordinates locks depending on the host OS platform (Windows vs Unix-specific implementations):
              </p>
              <GoCodeBlock>{BOOT_LOCK_CODE}</GoCodeBlock>

              {/* ── 2. Background Goroutine Spawning ── */}
              <h2 className="guide-sub-heading" id="background-workers" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                2. Background Goroutine Spawning
              </h2>
              <p>
                Once metadata, SSTable readers, and WAL replays have successfully loaded, PebbleDB launches three background worker goroutines:
              </p>
              <GoCodeBlock>{WORKER_SPAWN_CODE}</GoCodeBlock>

              {/* ── 3. The Shutdown Synchronization Sequence ── */}
              <h2 className="guide-sub-heading" id="shutdown-sequence" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                3. The Shutdown Synchronization Sequence
              </h2>
              <p>
                Shutting down the database must be done in a strict sequence to ensure that in-flight mutations are written to disk,
                background compactions are halted, and file handles are safely released.
              </p>
              <DocsMermaid chart={SHUTDOWN_SEQUENCE_CHART} />

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>3.1 Worker Terminations & Grace Periods</h3>
              <p>
                PebbleDB protects against resource leaks and hung processes by enforcing strict timeout limits:
              </p>
              <GoCodeBlock>{GRACE_PERIOD_CODE}</GoCodeBlock>

              <ul className="guide-bullets-list">
                <li>
                  <span className="highlight-text">Batch Flusher Stop</span>: The database closes <code className="inline-code">batchStop</code> and drains any remaining entries in the batch queue using <code className="inline-code">stopBatchFlusher()</code> and <code className="inline-code">flushPendingBatch()</code>.
                </li>
                <li>
                  <span className="highlight-text">Active Memtable Swap</span>: The active SkipList is moved to <code className="inline-code">pendingFlush</code> and a new empty SkipList is initialized.
                </li>
                <li>
                  <span className="highlight-text">Flush Worker Drain</span>: The database notifies the flusher and loops until <code className="inline-code">pendingFlush</code> is empty, waiting up to <code className="inline-code">closeFlushDrainTimeout</code>.
                </li>
                <li>
                  <span className="highlight-text">Channel Termination</span>: The database closes the <code className="inline-code">flushCh</code> and <code className="inline-code">compactCh</code> coordination channels.
                </li>
                <li>
                  <span className="highlight-text">Thread Join Check</span>: The database blocks until all three background worker threads exit, waiting up to <code className="inline-code">closeWorkerJoinTimeout</code>.
                </li>
                <li>
                  <span className="highlight-text">Resource Cleanup</span>: All SSTable file handles, the WAL, and the Manifest file are synced and closed, and the directory lock is released.
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

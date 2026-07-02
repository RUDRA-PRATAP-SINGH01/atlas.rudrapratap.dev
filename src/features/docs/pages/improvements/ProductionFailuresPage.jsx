import React from "react";
import DocsNavbar from "@/features/docs/components/DocsNavbar";
import DocsSidebar from "@/features/docs/components/DocsSidebar";

const pageTopics = [
  { label: "1. Memory Leaks & OOM", href: "#memory-leaks" },
  { label: "2. Thread Deadlocks & Races", href: "#deadlocks-races" },
  { label: "3. Read Consistency Violations", href: "#read-consistency" },
  { label: "4. Silent Data Loss Risks", href: "#silent-data-loss" },
  { label: "5. Disk Full & I/O Vulnerabilities", href: "#io-vulnerabilities" },
];

export default function ProductionFailuresPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="failures-title">
              PebbleDB Production Failures &amp; Limitations
            </h1>

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
              <strong>Warning: Production Audit Warning:</strong> Under sustained load, stress testing, or environment constraints, this educational engine will fail due to memory leaks, read inconsistencies, or lack of proper file checksum verification.
            </div>

            <div className="guide-body-text" style={{ marginTop: 24 }}>
              <p>
                An exhaustive architectural audit of the current PebbleDB implementation reveals several critical areas where it fails to meet the safety, correctness, and performance benchmarks required for production-level deployments.
              </p>

              {/* ── 1. Memory Leaks & OOM ── */}
              <h2 className="guide-sub-heading" id="memory-leaks" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                1. Memory Leaks &amp; Out-Of-Memory (OOM)
              </h2>
              <p>
                The primary threat to long-running server reliability is a slow, structural memory leak within reader tracking:
              </p>
              <ul className="guide-bullets-list">
                <li>
                  <span className="highlight-text">Dangling Reader References</span>: Active SSTable readers are tracked globally in the <code className="inline-code">db.allReaders</code> slice inside <code className="inline-code">db.go</code>. When background compactions merge and discard old SSTables, it calls <code className="inline-code">r.Discard()</code> on those readers but fails to remove them from <code className="inline-code">allReaders</code>.
                </li>
                <li>
                  <span className="highlight-text">Unbounded Growth</span>: The memory holding block indexes, bloom filters, and file descriptors for all compacted SSTables remains anchored. Under write-heavy workloads, this results in continuous heap expansion until the OS kills the process.
                </li>
              </ul>

              {/* ── 2. Thread Deadlocks & Races ── */}
              <h2 className="guide-sub-heading" id="deadlocks-races" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                2. Thread Deadlocks &amp; Goroutine Leaks
              </h2>
              <p>
                The concurrency model suffers from race conditions during database shutdown:
              </p>
              <ul className="guide-bullets-list">
                <li>
                  <span className="highlight-text">Close-Write Interlock</span>: If a client write is executing concurrently when the database <code className="inline-code">Close()</code> is called, the writing thread calls <code className="inline-code">awaitBatchPersist()</code> and waits on the channel <code className="inline-code">db.batchSyncCh</code>.
                </li>
                <li>
                  <span className="highlight-text">Dangling Writers</span>: Because the batch flusher background goroutine is terminated first during shutdown, no worker is left to drain <code className="inline-code">db.batchSyncCh</code>, causing the writing client thread to hang indefinitely.
                </li>
              </ul>

              {/* ── 3. Read Consistency Violations ── */}
              <h2 className="guide-sub-heading" id="read-consistency" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                3. Read Visibility Gap
              </h2>
              <p>
                PebbleDB violates fundamental read consistency properties during write batch flushing:
              </p>
              <ul className="guide-bullets-list">
                <li>
                  <span className="highlight-text">The Visibility Gap Window</span>: Inside <code className="inline-code">batch.go</code>, when <code className="inline-code">flushPendingBatch()</code> runs, it clears the batch from <code className="inline-code">db.pendingBatch</code> and begins writing to the Write-Ahead Log (WAL).
                </li>
                <li>
                  <span className="highlight-text">Temporary Missing Keys</span>: During this I/O window, the write lock is released. A concurrent <code className="inline-code">Get()</code> request searching for a key within this batch will find it in neither the active memtable nor the pending batch, returning <code className="inline-code">ErrNotFound</code>. The key then "resurrects" once the WAL write finishes.
                </li>
              </ul>

              {/* ── 4. Silent Data Loss Risks ── */}
              <h2 className="guide-sub-heading" id="silent-data-loss" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                4. Silent Data Loss Risks
              </h2>
              <p>
                Durable database engines must expect filesystem block corruption. PebbleDB is completely blind to it:
              </p>
              <ul className="guide-bullets-list">
                <li>
                  <span className="highlight-text">Missing Block Checksums</span>: SSTable blocks on disk are not written with CRC32 or xxHash checksums.
                </li>
                <li>
                  <span className="highlight-text">Stale Reads and EOF Masking</span>: If storage block corruption alters SSTable binary data, <code className="inline-code">BlockIterator.Next()</code> simply returns <code className="inline-code">false</code>, treating the corrupt boundary as a clean End-Of-File (EOF). This leads to silent omission of remaining keys, returning stale records or <code className="inline-code">ErrNotFound</code> rather than bubble up I/O errors.
                </li>
              </ul>

              {/* ── 5. Disk Full & I/O Vulnerabilities ── */}
              <h2 className="guide-sub-heading" id="io-vulnerabilities" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                5. Disk Full &amp; Durability Flaws
              </h2>
              <p>
                Standard file system operations are lacking durability safety guarantees:
              </p>
              <ul className="guide-bullets-list">
                <li>
                  <span className="highlight-text">No Parent Directory Fsync</span>: After creating files, writing manifest logs, or renaming the <code className="inline-code">CURRENT</code> file, PebbleDB does not call <code className="inline-code">fsync</code> on the parent directory. A sudden system power loss can result in empty directory nodes or lost pointers, corrupting the database on reboot.
                </li>
                <li>
                  <span className="highlight-text">LOCK Leak on Disk-Full Timeout</span>: When the disk fills up, the background flusher enters an infinite retry loop. If <code className="inline-code">Close()</code> is called, it times out after 30 seconds, releases the kernel <code className="inline-code">LOCK</code> file, and exits. The flusher goroutine remains active in the background, capable of colliding with any newly opened DB process.
                </li>
              </ul>

            </div>
          </div>
        </main>

        <aside className="guide-sidebar-right" aria-label="Page Outline">
          <div className="guide-sidebar-right-content">
            <h4 className="guide-sidebar-right-title">Topics</h4>
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

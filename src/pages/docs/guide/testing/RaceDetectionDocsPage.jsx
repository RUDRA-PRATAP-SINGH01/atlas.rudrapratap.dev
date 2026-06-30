import React from "react";
import DocsNavbar from "@/components/docs/DocsNavbar";
import DocsSidebar from "@/components/docs/DocsSidebar";
import GoCodeBlock from "@/components/docs/GoCodeBlock";

const pageTopics = [
  { label: "Concurrency Verification in CI", href: "#ci-verification" },
  { label: "Race Conditions Caught & Resolved", href: "#races-resolved" },
  { label: "Concurrency Patterns for Race Safety", href: "#safety-patterns" },
];

const READ_PATH_LOCK_CODE = `// Example read path: Lock, copy pointers, increment ref, unlock, perform I/O
db.mu.RLock()
snap := db.snapshotSSTables() // copy pointers
for _, r := range snap {
    r.Ref() // Increment ref count under lock
}
db.mu.RUnlock()
// Perform block reads from disk outside the lock
for _, r := range snap {
    val, found, err := r.Get(key)
    r.Unref() // Release ref when I/O completes
}`;

const COMPACTION_VALIDATE_CODE = `db.mu.Lock()
if !readersStillPresent(db.sstables, compReaders) {
    db.mu.Unlock()
    newReader.Close()
    os.Remove(newReader.Path())
    return nil
}`;

export default function RaceDetectionDocsPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="race-detection-title">
              PebbleDB Testing Specification: Race Detection
            </h1>

            <div className="guide-body-text" style={{ marginTop: 24 }}>
              <p>
                This document specifies the concurrency verification strategy of PebbleDB, explaining how the Go race detector is integrated into the test workflow and describing the concurrent design patterns that keep the engine race-clean.
              </p>

              {/* ── 1. Concurrency Verification in CI ── */}
              <h2 className="guide-sub-heading" id="ci-verification" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                1. Concurrency Verification in CI
              </h2>
              <p>
                The Go race detector compiles the engine with memory access tracking. PebbleDB runs all tests under the race detector in CI:
              </p>
              <pre className="guide-code-pre" style={{ background: "#18181b", padding: "12px", borderRadius: "6px", overflowX: "auto", margin: "16px 0" }}>
                <code>{`go test -race -count=1 -shuffle=on ./...`}</code>
              </pre>
              <ul className="guide-bullets-list">
                <li>
                  <span className="highlight-text">-shuffle=on</span>: Randomizes test execution order. This exposes ordering bugs in integration tests where background workers (like compaction or the batch flusher) might interact across test boundaries.
                </li>
                <li>
                  <span className="highlight-text">Race Cleanliness Invariant</span>: Any compilation warning or race report is treated as a build-blocking failure.
                </li>
              </ul>

              {/* ── 2. Race Conditions Caught & Resolved ── */}
              <h2 className="guide-sub-heading" id="races-resolved" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                2. Race Conditions Caught & Resolved
              </h2>
              
              <h3 style={{ color: "#ffffff", marginTop: 16 }}>2.1 Concurrent SST Read + Close (compaction vs read)</h3>
              <p>
                <strong>Symptom:</strong> The race detector flagged concurrent memory access in <code className="inline-code">sstable.Reader</code> block reads during background compactions.
                <br />
                <strong>Root Cause:</strong> Compaction picked two SSTables, merged them, and immediately called <code className="inline-code">Close()</code> on the inputs. Concurrently, an in-flight Get or Scan was still reading data blocks from those same readers.
                <br />
                <strong>Fix:</strong> Replaced immediate reader closes with a reference-counting lifecycle (Ref/Unref/Discard). Compaction calls <code className="inline-code">Discard()</code>, and the file handle is closed only when all active reads release their references (Invariant V2).
              </p>

              <h3 style={{ color: "#ffffff", marginTop: 16 }}>2.2 Scan vs Put Lock Contention</h3>
              <p>
                <strong>Symptom:</strong> Long-running scans stalled concurrent writes, reducing write throughput during scans.
                <br />
                <strong>Root Cause:</strong> Range scans held the memtable read lock (RLock) for the entire lifetime of the iterator. This blocked Put operations, which require the write lock.
                <br />
                <strong>Fix:</strong> Implemented copy-on-read memtable snapshots (<code className="inline-code">memtable.Snapshot()</code>). Scans acquire the read lock briefly, copy the memtable node pointers, and release the lock. The scan then iterates over the copy without blocking writers.
              </p>

              {/* ── 3. Concurrency Patterns for Race Safety ── */}
              <h2 className="guide-sub-heading" id="safety-patterns" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                3. Concurrency Patterns for Race Safety
              </h2>
              <p>
                To maintain concurrent correctness, PebbleDB follows three rules:
              </p>

              <h3 style={{ color: "#ffffff", marginTop: 16 }}>Rule 1: Release Locks Before Disk I/O</h3>
              <p>
                PebbleDB never performs filesystem reads or writes while holding <code className="inline-code">db.mu</code>. Locks are held only to update in-memory state or copy pointers.
              </p>
              <GoCodeBlock>{READ_PATH_LOCK_CODE}</GoCodeBlock>

              <h3 style={{ color: "#ffffff", marginTop: 16 }}>Rule 2: Validate State After Lock Reacquisition</h3>
              <p>
                Because locks are released during merging or writing, state can change. Background workers must validate that their selected files are still present in the active list after reacquiring the lock:
              </p>
              <GoCodeBlock>{COMPACTION_VALIDATE_CODE}</GoCodeBlock>

              <h3 style={{ color: "#ffffff", marginTop: 16 }}>Rule 3: Unidirectional Channel Ownership</h3>
              <ul className="guide-bullets-list">
                <li>
                  <code className="inline-code">flushCh</code> and <code className="inline-code">compactCh</code> are closed only by the owner thread inside the <code className="inline-code">Close()</code> sequence.
                </li>
                <li>
                  The worker goroutines never close coordination channels; they only signal completion by closing their respective Done channels.
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

import React from "react";
import DocsNavbar from "@/components/docs/DocsNavbar";
import DocsSidebar from "@/components/docs/DocsSidebar";
import DocsMermaid from "@/components/docs/DocsMermaid";
import GoCodeBlock from "@/components/docs/GoCodeBlock";

const pageTopics = [
  { label: "Symptoms & Worker Hangs", href: "#symptoms" },
  { label: "Root Cause", href: "#root-cause" },
  { label: "The Fix: Bounded Shutdown State Machine", href: "#solution" },
  { label: "Abort Sequence & ErrCloseIncomplete", href: "#abort-sequence" },
];

const SHUTDOWN_CHART = `stateDiagram-v2
    [*] --> ClosedFlag : Set closed = true
    ClosedFlag --> StopBatch : stopBatchFlusher()
    StopBatch --> DrainBatch : flushPendingBatch()
    DrainBatch --> SwapMemtable : Swap active memtable to queue
    SwapMemtable --> WaitFlush : waitForPendingFlushDrain(30s)
    
    WaitFlush --> WaitWorkers : Success
    WaitFlush --> AbortClose : Timeout (30s)
    
    WaitWorkers --> CleanupSuccess : Success
    WaitWorkers --> AbortClose : Timeout (30s)
    
    CleanupSuccess --> [*] : Close WAL & Manifest, Release LOCK
    AbortClose --> [*] : Keep WAL & Manifest open, Release LOCK (ErrCloseIncomplete)`;

const TIMEOUT_CODE = `var (
	closeFlushDrainTimeout = 30 * time.Second
	closeWorkerJoinTimeout = 30 * time.Second
)`;

const ABORT_CODE = `func (db *DB) abortClose(err error) error {
	if shutdownErr := db.shutdownBackgroundWorkers(); shutdownErr != nil {
		err = errors.Join(err, shutdownErr)
	}
	return errors.Join(err, ErrCloseIncomplete)
}`;

export default function ShutdownOrderingDocsPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="shutdown-ordering-title">
              PebbleDB Postmortem: Shutdown Ordering
            </h1>

            <div className="guide-body-text" style={{ marginTop: 24 }}>
              <p>
                This document details the issues, root causes, and fixes for Shutdown Ordering, preventing deadlocks, hangs, and resource leaks during database closure.
              </p>

              {/* ── 1. Symptoms & Worker Hangs ── */}
              <h2 className="guide-sub-heading" id="symptoms" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                1. Symptoms &amp; Worker Hangs
              </h2>
              <p>
                During integration tests and shutdown verification runs, <code className="inline-code">Close()</code> occasionally failed or hung:
              </p>
              <ul className="guide-bullets-list">
                <li>
                  <span className="highlight-text">Infinite Hangs</span>: <code className="inline-code">Close()</code> blocked indefinitely when background flushes were retrying errors (e.g., from a full disk).
                </li>
                <li>
                  <span className="highlight-text">Nil Pointer Panics</span>: Workers panicked when trying to access the manifest or WAL after the main thread had closed and set them to nil.
                </li>
                <li>
                  <span className="highlight-text">Resource Leaks</span>: The directory <code className="inline-code">LOCK</code> file was not released on failure, preventing subsequent <code className="inline-code">Open</code> calls from succeeding.
                </li>
                <li>
                  <span className="highlight-text">Test Timeouts</span>: Go test runs timed out during shutdown assertions.
                </li>
              </ul>

              {/* ── 2. Root Cause ── */}
              <h2 className="guide-sub-heading" id="root-cause" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                2. Root Cause
              </h2>
              <ul className="guide-bullets-list">
                <li>
                  <span className="highlight-text">Unbounded Waits</span>: The shutdown sequence did not specify a timeout when waiting for pending flushes to complete.
                </li>
                <li>
                  <span className="highlight-text">Premature Resource Cleanup</span>: The database closed the WAL and manifest files before background workers had fully stopped.
                </li>
                <li>
                  <span className="highlight-text">Mismatched Stop Signaling</span>: Background flusher and compaction threads were not coordinated during shutdown, leading to race conditions.
                </li>
              </ul>

              {/* ── 3. The Fix: Bounded Shutdown State Machine ── */}
              <h2 className="guide-sub-heading" id="solution" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                3. The Fix: Bounded Shutdown State Machine
              </h2>
              <p>
                PebbleDB resolved this by implementing a bounded shutdown state machine:
              </p>
              <div className="my-6">
                <DocsMermaid chart={SHUTDOWN_CHART} />
              </div>

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>3.1 Timeout Protections</h3>
              <p>
                PebbleDB defines two timeout parameters:
              </p>
              <GoCodeBlock>{TIMEOUT_CODE}</GoCodeBlock>

              {/* ── 4. Abort Sequence & ErrCloseIncomplete ── */}
              <h2 className="guide-sub-heading" id="abort-sequence" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                4. Recovery via ErrCloseIncomplete
              </h2>
              <p>
                If the database cannot complete flushes within the 30-second window, it aborts the cleanup sequence and returns <code className="inline-code">ErrCloseIncomplete</code>:
              </p>
              <GoCodeBlock>{ABORT_CODE}</GoCodeBlock>
              <p>
                By returning <code className="inline-code">ErrCloseIncomplete</code> and leaving the WAL and manifest files open, PebbleDB prevents background threads from crashing on nil pointers. The directory lock is still released, allowing the database to be re-opened and recovered.
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

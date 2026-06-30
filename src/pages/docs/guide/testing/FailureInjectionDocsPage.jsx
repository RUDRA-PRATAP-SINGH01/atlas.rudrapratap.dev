import React from "react";
import DocsNavbar from "@/components/docs/DocsNavbar";
import DocsSidebar from "@/components/docs/DocsSidebar";
import GoCodeBlock from "@/components/docs/GoCodeBlock";

const pageTopics = [
  { label: "Background Error Injection", href: "#bg-errors" },
  { label: "Close Failure Injection", href: "#close-failure" },
  { label: "Flush Queue Invalidation & Retries", href: "#flush-queue" },
  { label: "WAL and Disk Faults", href: "#wal-faults" },
];

const STORE_CODE = `type backgroundErrStore struct {
	mu   sync.RWMutex
	byOp map[string]error
}

// Tests can inject errors on a running *DB instance by calling the internal setBackgroundErr(op, err) method.`;

const BLOCKING_CODE = `var writeBlockingBackgroundOps = map[string]struct{}{
	"wal":   {},
	"flush": {},
}

func (db *DB) writeBlockingBackgroundErr() error {
	if !db.blockWritesOnFlushError {
		// Only WAL errors block writes
		return db.bgErrs.join(map[string]struct{}{"wal": {}})
	}
	// Both WAL and Flush errors block writes
	return db.bgErrs.join(writeBlockingBackgroundOps)
}`;

export default function FailureInjectionDocsPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="failure-injection-title">
              PebbleDB Testing Specification: Failure Injection
            </h1>

            <div className="guide-body-text" style={{ marginTop: 24 }}>
              <p>
                This document specifies the failure injection techniques used to verify PebbleDB&apos;s error propagation, background queue behavior, and durability interfaces.
              </p>

              {/* ── 1. Background Error Injection ── */}
              <h2 className="guide-sub-heading" id="bg-errors" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                1. Background Error Injection (bgErrs)
              </h2>
              <p>
                PebbleDB includes an internal background error store (<code className="inline-code">backgroundErrStore</code>) to simulate file system or I/O errors without mocking the OS:
              </p>
              <GoCodeBlock>{STORE_CODE}</GoCodeBlock>

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>1.1 Invariant: Writes Block, Reads Continue</h3>
              <p>
                When a background error occurs in the write path (e.g., WAL write failure or flush failure), PebbleDB blocks new writes. However, reads continue to serve data from the memory layers and existing SSTables.
              </p>
              <GoCodeBlock>{BLOCKING_CODE}</GoCodeBlock>
              <ul className="guide-bullets-list">
                <li>
                  <span className="highlight-text">WAL Error Injection</span>: Checked in <code className="inline-code">TestWalBackgroundErrorBlocksWritesOnly</code>.
                </li>
                <li>
                  <span className="highlight-text">Flush Error Injection</span>: Checked in <code className="inline-code">TestFlushErrorBlocksWrites</code>.
                </li>
              </ul>

              {/* ── 2. Close Failure Injection ── */}
              <h2 className="guide-sub-heading" id="close-failure" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                2. Close Failure Injection
              </h2>
              <p>
                PebbleDB tests inject I/O errors during shutdown to ensure resource cleanup does not deadlock:
              </p>
              <ul className="guide-bullets-list">
                <li>
                  <span className="highlight-text">TestCloseShutsDownWorkersOnWalSizeError</span>: Closes the active WAL handle before calling <code className="inline-code">db.Close()</code>. This forces the WAL size check inside the close sequence to fail, verifying that the shutdown sequence can handle the failure without leaking goroutines.
                </li>
                <li>
                  <span className="highlight-text">TestCloseIncompleteWhenWalSizeFails</span>: Verifies that when a WAL size check fails during shutdown, <code className="inline-code">Close()</code> returns <code className="inline-code">ErrCloseIncomplete</code>. This keeps the WAL and manifest files open in a safe state, preventing background threads from racing against nil pointers (Invariant S1).
                </li>
              </ul>

              {/* ── 3. Flush Queue Invalidation & Retries ── */}
              <h2 className="guide-sub-heading" id="flush-queue" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                3. Flush Queue Invalidation & Retries
              </h2>
              <p>
                PebbleDB guarantees that a memtable is never dropped from the flush queue until it has been successfully written to disk and committed to the manifest.
              </p>
              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>3.1 Stuck Queue Verification (TestFlushNeverAbandonsQueueEntry)</h3>
              <p>
                To verify this, the test:
              </p>
              <ol className="guide-bullets-list">
                <li>Forces a flush error by closing the manifest handle.</li>
                <li>Triggers a swap of the active memtable.</li>
                <li>Attempts to write, which fails.</li>
                <li>Asserts that the memtable remains at the head of <code className="inline-code">pendingFlush</code> and retries.</li>
                <li>Re-opens the manifest and verifies that the flush eventually completes and clears the queue.</li>
              </ol>

              {/* ── 4. WAL and Disk Faults ── */}
              <h2 className="guide-sub-heading" id="wal-faults" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                4. WAL and Disk Faults
              </h2>
              <ul className="guide-bullets-list">
                <li>
                  <span className="highlight-text">Corruption Recovery</span>: Tests write garbage bytes or truncate files to simulate partial sector writes. PebbleDB seeks to the end of the last complete record, truncates the corrupted tail, and recovers successfully.
                </li>
                <li>
                  <span className="highlight-text">Invalid Checkpoints</span>: Tests write partial or corrupt 16-byte <code className="inline-code">wal.flush</code> files. PebbleDB detects the corrupt state, removes the checkpoint file, and replays the WAL from offset 0 to ensure consistency.
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

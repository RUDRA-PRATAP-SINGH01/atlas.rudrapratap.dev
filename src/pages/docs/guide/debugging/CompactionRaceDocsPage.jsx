import React from "react";
import DocsNavbar from "@/components/docs/DocsNavbar";
import DocsSidebar from "@/components/docs/DocsSidebar";
import GoCodeBlock from "@/components/docs/GoCodeBlock";

const pageTopics = [
  { label: "Symptoms & Race Flags", href: "#symptoms" },
  { label: "Root Cause", href: "#root-cause" },
  { label: "The Fix: Reference Counting", href: "#solution" },
  { label: "Lifecycle Protocol Details", href: "#protocol" },
];

const CODE_RACE = `WARNING: DATA RACE
Read at 0x00c00012e120 by goroutine 8 (Get):
  github.com/RUDRA-PRATAP-SINGH01/PebbleDB/internal/sstable.(*Reader).Get()
Previous write at 0x00c00012e120 by goroutine 12 (compactor):
  github.com/RUDRA-PRATAP-SINGH01/PebbleDB/internal/sstable.(*Reader).Close()`;

const READER_STRUCT = `type Reader struct {
	file         *os.File
	refs         atomic.Int32
	closePending atomic.Bool
	// ...
}`;

const INCREMENT_CODE = `db.mu.RLock()
snap := db.snapshotSSTables()
for _, r := range snap {
    r.Ref() // Increment ref count
}
db.mu.RUnlock()`;

const DISCARD_CODE = `func (r *Reader) Discard() error {
    r.closePending.Store(true)
    return r.decRef()
}`;

export default function CompactionRaceDocsPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="compaction-race-title">
              PebbleDB Postmortem: Compaction Race
            </h1>

            <div className="guide-body-text" style={{ marginTop: 24 }}>
              <p>
                This document details the investigation and resolution of the Compaction Race, a concurrent access conflict between in-flight Get lookups and background compactions.
              </p>

              {/* ── 1. Symptoms & Race Flags ── */}
              <h2 className="guide-sub-heading" id="symptoms" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                1. Symptoms &amp; Race Flags
              </h2>
              <p>
                After introducing background compaction, the Go race detector flagged concurrent memory accesses:
              </p>
              <pre className="guide-code-pre" style={{ background: "#18181b", padding: "12px", borderRadius: "6px", overflowX: "auto", margin: "16px 0", color: "#f87171", fontSize: "12px" }}>
                <code>{CODE_RACE}</code>
              </pre>
              <ul className="guide-bullets-list">
                <li>
                  <span className="highlight-text">Race Detector Warnings</span>: Flashing red flags during parallel write/read stress runs.
                </li>
                <li>
                  <span className="highlight-text">Intermittent Read Crashes</span>: Get lookups occasionally failed with file closed or invalid memory address errors.
                </li>
                <li>
                  <span className="highlight-text">Windows Sharing Violations</span>: Compaction failed to remove old SSTable files with ACCESS_DENIED errors because file handles were still open for reading.
                </li>
              </ul>

              {/* ── 2. Root Cause ── */}
              <h2 className="guide-sub-heading" id="root-cause" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                2. Root Cause
              </h2>
              <ul className="guide-bullets-list">
                <li>
                  <span className="highlight-text">Immediate Close</span>: The original design picked the two oldest readers from <code className="inline-code">db.sstables</code>, merged them, updated the slice, and immediately called <code className="inline-code">Close()</code> on the inputs.
                </li>
                <li>
                  <span className="highlight-text">Lock-Free Read Traversal</span>: The read path (Get) copied the <code className="inline-code">sstables</code> slice under <code className="inline-code">db.mu.RLock</code>, released the lock, and then iterated over the reader pointers without holding the lock.
                </li>
              </ul>
              <p>
                If Get copied the slice, compaction merged the files, and called <code className="inline-code">Close()</code> on the inputs while Get was still reading their data blocks, a race condition occurred.
              </p>

              {/* ── 3. The Fix: Reference Counting ── */}
              <h2 className="guide-sub-heading" id="solution" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                3. The Fix: Reference Counting
              </h2>
              <p>
                PebbleDB decoupled logical removal from physical closure by introducing reference counting on <code className="inline-code">sstable.Reader</code> handles:
              </p>
              <GoCodeBlock>{READER_STRUCT}</GoCodeBlock>

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }} id="protocol">3.1 Lifecycle Protocol</h3>
              <p>
                <strong>Increment Refs:</strong> The read path increments the ref count under <code className="inline-code">db.mu</code> before releasing the lock:
              </p>
              <GoCodeBlock>{INCREMENT_CODE}</GoCodeBlock>

              <p>
                <strong>Decrement Refs:</strong> Once the read completes, Get/Scan decrements the ref count:
              </p>
              <pre className="guide-code-pre" style={{ background: "#18181b", padding: "12px", borderRadius: "6px", overflowX: "auto", margin: "12px 0" }}>
                <code>{`defer r.Unref()`}</code>
              </pre>

              <p>
                <strong>Safe Discard:</strong> Compaction calls <code className="inline-code">r.Discard()</code>, which sets <code className="inline-code">closePending = true</code>. The file handle is closed only when the ref count reaches zero:
              </p>
              <GoCodeBlock>{DISCARD_CODE}</GoCodeBlock>

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

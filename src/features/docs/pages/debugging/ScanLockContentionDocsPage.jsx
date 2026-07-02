import React from "react";
import DocsNavbar from "@/features/docs/components/DocsNavbar";
import DocsSidebar from "@/features/docs/components/DocsSidebar";
import DocsMermaid from "@/features/docs/components/DocsMermaid";
import GoCodeBlock from "@/features/docs/components/GoCodeBlock";

const pageTopics = [
  { label: "Symptoms & Ingestion Stalls", href: "#symptoms" },
  { label: "Root Cause", href: "#root-cause" },
  { label: "The Fix: Copy-on-Read Snapshots", href: "#solution" },
  { label: "Snapshot Copy Implementation", href: "#implementation" },
  { label: "Trade-offs", href: "#trade-offs" },
];

const BLOCKING_CHART = `sequenceDiagram
    autonumber
    participant S as Scan Goroutine
    participant M as Memtable (sync.RWMutex)
    participant W as Put/Delete Goroutine

    Note over S,M: Old Design (Blocking)
    S->>M: RLock() (Hold lock during iteration)
    W->>M: Lock() (Blocked waiting for writers)
    Note over W: Put blocks / times out
    S->>M: RUnlock()
    W->>M: Lock() acquired after scan completes`;

const SNAPSHOT_CHART = `sequenceDiagram
    autonumber
    participant S as Scan Goroutine
    participant M as Memtable (sync.RWMutex)
    participant W as Put/Delete Goroutine

    Note over S,M: New Design (Copy-on-Read)
    S->>M: RLock()
    S->>S: Copy skip list node pointers
    S->>M: RUnlock() (Total lock time ~100ns)
    par Scan Walks Copy
        S->>S: Iterate over copied nodes
    and Put Proceeds Concurrently
        W->>M: Lock() acquired immediately
        W->>M: Put completes and releases Lock
    end`;

const SNAPSHOT_CODE = `func (s *SkipList) Snapshot() *SkipList {
	s.mu.RLock()
	defer s.mu.RUnlock()
	snap := &SkipList{
		head:  &node{forward: make([]*node, maxLevel)},
		level: s.level,
		len:   s.len,
	}
	currSnap := snap.head
	currLive := s.head.forward[0]
	for currLive != nil {
		newNode := &node{
			key:       currLive.key,
			value:     currLive.value,
			tombstone: currLive.tombstone,
			forward:   make([]*node, 1),
		}
		currSnap.forward[0] = newNode
		currSnap = newNode
		currLive = currLive.forward[0]
	}
	return snap
}`;

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  textAlign: "left",
  fontSize: 13,
  border: "1px solid rgba(255, 255, 255, 0.08)",
};

const thStyle = {
  padding: "10px 16px",
  color: "#ff5cad",
  fontWeight: 600,
};

const theadRowStyle = {
  background: "rgba(255, 92, 173, 0.08)",
  borderBottom: "1px solid rgba(255, 255, 255, 0.15)",
};

const tdStyle = { padding: "10px 16px" };
const tdBoldStyle = { padding: "10px 16px", fontWeight: 500, color: "#ffffff" };

export default function ScanLockContentionDocsPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="scan-lock-title">
              PebbleDB Postmortem: Scan Lock Contention
            </h1>

            <div className="guide-body-text" style={{ marginTop: 24 }}>
              <p>
                This document details the investigation and resolution of Scan Lock Contention, where range scans blocked concurrent database writes.
              </p>

              {/* ── 1. Symptoms & Ingestion Stalls ── */}
              <h2 className="guide-sub-heading" id="symptoms" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                1. Symptoms &amp; Ingestion Stalls
              </h2>
              <p>
                During concurrency testing and benchmarking, range scans (<code className="inline-code">Scan</code>) caused writes to stall:
              </p>
              <ul className="guide-bullets-list">
                <li>
                  <span className="highlight-text">Write Latency Spikes</span>: Write latency spiked to match the duration of concurrent scans.
                </li>
                <li>
                  <span className="highlight-text">Blocked Ingestion</span>: Sustained scans blocked memtable writes, eventually stalling the write path.
                </li>
                <li>
                  <span className="highlight-text">Test Failures</span>: <code className="inline-code">TestScanDoesNotBlockWrites</code> failed in stress runs due to write timeouts.
                </li>
              </ul>

              {/* ── 2. Root Cause ── */}
              <h2 className="guide-sub-heading" id="root-cause" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                2. Root Cause
              </h2>
              <p>
                <strong>Long-Held Read Locks:</strong> The original design used a memtable iterator that held the skip list read lock (RLock) for its entire lifetime.
                <br />
                <strong>Writer Exclusion:</strong> Put and Delete operations require the memtable write lock (Lock). Under Go&apos;s <code className="inline-code">sync.RWMutex</code>, writers are excluded as long as any read lock is active.
              </p>
              
              <div className="my-6">
                <DocsMermaid chart={BLOCKING_CHART} />
              </div>

              <p>
                Coupling the iterator&apos;s lifetime to the memtable&apos;s read lock meant that range scans blocked all concurrent write operations.
              </p>

              {/* ── 3. The Fix: Copy-on-Read Snapshots ── */}
              <h2 className="guide-sub-heading" id="solution" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                3. The Fix: Copy-on-Read Snapshots
              </h2>
              <p>
                PebbleDB uncoupled the iterator from the read lock by implementing a copy-on-read memtable snapshot (<code className="inline-code">memtable.Snapshot()</code>):
              </p>
              <div className="my-6">
                <DocsMermaid chart={SNAPSHOT_CHART} />
              </div>

              {/* ── 4. Snapshot Copy Implementation ── */}
              <h2 className="guide-sub-heading" id="implementation" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                4. Go Implementation: Snapshot Copying
              </h2>
              <p>
                When a scan is created, the database acquires the read lock briefly, copies the skip list nodes, and releases the lock:
              </p>
              <GoCodeBlock>{SNAPSHOT_CODE}</GoCodeBlock>
              <p>
                The scan iterator then walks this copy. Because the read lock is held only during the copy operation, writes can proceed concurrently on the live skip list.
              </p>

              {/* ── 5. Trade-offs ── */}
              <h2 className="guide-sub-heading" id="trade-offs" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                5. Trade-offs
              </h2>
              <div style={{ overflowX: "auto", marginTop: 16, marginBottom: 20 }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={theadRowStyle}>
                      <th style={thStyle}>Trade-off</th>
                      <th style={thStyle}>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>Write Liveness</td>
                      <td style={tdStyle}>Writes are no longer blocked during scans.</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>Memory Spike</td>
                      <td style={tdStyle}>Memory usage increases proportionally to the memtable size during scans.</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>Point-in-Time view</td>
                      <td style={tdStyle}>The scan sees a snapshot of the memtable at the moment the scan was created, ignoring subsequent writes.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p>
                For educational scope and small memtables (≤ 4 MiB), copy-on-read is a reasonable trade-off. In production, this would be replaced with MVCC or sequence numbers.
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

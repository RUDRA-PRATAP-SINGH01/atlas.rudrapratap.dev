import React from "react";
import DocsNavbar from "@/features/docs/components/DocsNavbar";
import DocsSidebar from "@/features/docs/components/DocsSidebar";

const pageTopics = [
  { label: "Decision Philosophy", href: "#philosophy" },
  { label: "Decision Catalog (D-01 to D-14)", href: "#catalog" },
];

export default function DesignDecisionsDocsPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="design-decisions-title">
              PebbleDB Engineering: Design Decisions
            </h1>

            <div className="guide-body-text" style={{ marginTop: 24 }}>
              <p>
                This document catalogs every major architectural and API decision made during PebbleDB&apos;s development,
                explaining the rationale, the alternatives that were considered and rejected, and the design constraints
                that shaped the final codebase.
              </p>

              {/* ── 1. Decision Philosophy ── */}
              <h2 className="guide-sub-heading" id="philosophy" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                1. Decision Philosophy
              </h2>
              <p>
                PebbleDB optimizes for understandable durability over feature breadth and peak performance. Every choice below
                was made through that lens: if it makes the crash-recovery story clearer, it wins over a more complex
                alternative — even at the cost of throughput.
              </p>

              {/* ── 2. Decision Catalog ── */}
              <h2 className="guide-sub-heading" id="catalog" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                2. Decision Catalog
              </h2>

              <div className="guide-decision-card" style={{ background: "rgba(255, 92, 173, 0.03)", border: "1px solid rgba(255, 92, 173, 0.15)", borderRadius: 8, padding: 20, marginBottom: 20 }}>
                <h3 style={{ color: "#ff5cad", margin: 0, fontSize: 16 }}>D-01: LSM-Tree Over B-Tree</h3>
                <p style={{ margin: "10px 0" }}>
                  <strong>Chosen:</strong> LSM-tree with append-only WAL + immutable SSTables
                  <br />
                  <strong>Rejected:</strong> BoltDB-style single-file B+ tree
                  <br />
                  <strong>Rationale:</strong> Append-only WAL + immutable SSTs map directly to how crash recovery works. B-trees would have required page-oriented write amplification and obscured the durability story.
                </p>
              </div>

              <div className="guide-decision-card" style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: 8, padding: 20, marginBottom: 20 }}>
                <h3 style={{ color: "#ffffff", margin: 0, fontSize: 16 }}>D-02: Skip List Memtable</h3>
                <p style={{ margin: "10px 0" }}>
                  <strong>Chosen:</strong> Probabilistic skip list with concurrent Put and sorted order
                  <br />
                  <strong>Rejected:</strong> Sorted slice (O(n) inserts), red-black tree (rotation complexity under concurrency)
                  <br />
                  <strong>Rationale:</strong> Simpler to implement correctly under concurrency than a balanced tree. O(log n) insert/lookup with minimal locking.
                </p>
              </div>

              <div className="guide-decision-card" style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: 8, padding: 20, marginBottom: 20 }}>
                <h3 style={{ color: "#ffffff", margin: 0, fontSize: 16 }}>D-03: Single Writer Lock (db.mu)</h3>
                <p style={{ margin: "10px 0" }}>
                  <strong>Chosen:</strong> One <code className="inline-code">sync.RWMutex</code> for the write path and all structural changes
                  <br />
                  <strong>Rejected:</strong> Per-memtable locks without a clear plan for flush handoff
                  <br />
                  <strong>Rationale:</strong> Correctness over throughput. A single lock makes reasoning about state transitions (active → pendingFlush → SSTable) trivial.
                </p>
              </div>

              <div className="guide-decision-card" style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: 8, padding: 20, marginBottom: 20 }}>
                <h3 style={{ color: "#ffffff", margin: 0, fontSize: 16 }}>D-04: Group Commit Default (Async WAL)</h3>
                <p style={{ margin: "10px 0" }}>
                  <strong>Chosen:</strong> Async WAL batching with 1 ms timer delay (commit 01eef8e)
                  <br />
                  <strong>Rejected:</strong> Synchronous-only API (per-op fsync)
                  <br />
                  <strong>Rationale:</strong> Measured ~20× write throughput vs per-op fsync. Explicit escape hatches via Sync() and SyncWrites option.
                </p>
              </div>

              <div className="guide-decision-card" style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: 8, padding: 20, marginBottom: 20 }}>
                <h3 style={{ color: "#ffffff", margin: 0, fontSize: 16 }}>D-05: Manifest as Live Set Authority</h3>
                <p style={{ margin: "10px 0" }}>
                  <strong>Chosen:</strong> Manifest log defines the live SSTable set; directory glob is advisory only
                  <br />
                  <strong>Rejected:</strong> Directory listing (*.sst) as source of truth
                  <br />
                  <strong>Rationale:</strong> Glob-based discovery breaks after compaction crashes leave orphan files. The manifest is a CRC-checked, append-only log that survives crash.
                </p>
              </div>

              <div className="guide-decision-card" style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: 8, padding: 20, marginBottom: 20 }}>
                <h3 style={{ color: "#ffffff", margin: 0, fontSize: 16 }}>D-06: Manifest-Before-Memory on Compaction</h3>
                <p style={{ margin: "10px 0" }}>
                  <strong>Chosen:</strong> <code className="inline-code">manifest.AppendSetFileSet()</code> + fsync before swapping <code className="inline-code">db.sstables</code> in memory
                  <br />
                  <strong>Rejected:</strong> Memory-first swap (caused post-crash divergence — see manifest-consistency postmortem)
                  <br />
                  <strong>Rationale:</strong> A crash between memory swap and manifest write would leave the manifest listing stale SSTs.
                </p>
              </div>

              <div className="guide-decision-card" style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: 8, padding: 20, marginBottom: 20 }}>
                <h3 style={{ color: "#ffffff", margin: 0, fontSize: 16 }}>D-07: wal.flush Checkpoint</h3>
                <p style={{ margin: "10px 0" }}>
                  <strong>Chosen:</strong> 16-byte sidecar file to bound WAL replay after flush
                  <br />
                  <strong>Rejected:</strong> Replay entire WAL forever; WAL sequence numbers embedded in records (heavier format change)
                  <br />
                  <strong>Rationale:</strong> Minimal format change. A 16-byte file is cheap to write atomically and trivial to validate on recovery.
                </p>
              </div>

              <div className="guide-decision-card" style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: 8, padding: 20, marginBottom: 20 }}>
                <h3 style={{ color: "#ffffff", margin: 0, fontSize: 16 }}>D-08: Tombstones Everywhere</h3>
                <p style={{ margin: "10px 0" }}>
                  <strong>Chosen:</strong> Deletes are WAL records + SSTable entries (tombstone = 0x01), not physical removal
                  <br />
                  <strong>Rejected:</strong> Immediate purge (breaks snapshot semantics and crash recovery)
                  <br />
                  <strong>Rationale:</strong> Tombstones propagate through compaction to mask older values. Without them, a delete-before-crash could resurrect the old value on replay.
                </p>
              </div>

              <div className="guide-decision-card" style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: 8, padding: 20, marginBottom: 20 }}>
                <h3 style={{ color: "#ffffff", margin: 0, fontSize: 16 }}>D-09: Oldest-2 Compaction Policy</h3>
                <p style={{ margin: "10px 0" }}>
                  <strong>Chosen:</strong> Pick the 2 oldest SSTables, merge, replace
                  <br />
                  <strong>Rejected:</strong> Leveled compaction (too many moving parts before recovery was solid)
                  <br />
                  <strong>Rationale:</strong> Simplest merge policy to implement and test. Bounded SST count without level management complexity.
                </p>
              </div>

              <div className="guide-decision-card" style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: 8, padding: 20, marginBottom: 20 }}>
                <h3 style={{ color: "#ffffff", margin: 0, fontSize: 16 }}>D-10: Per-SSTable Bloom Filter</h3>
                <p style={{ margin: "10px 0" }}>
                  <strong>Chosen:</strong> Bloom filter embedded in each SSTable file, checked before any block read
                  <br />
                  <strong>Rejected:</strong> No filter (read amplification too high); global filter (invalidation hard after compaction)
                  <br />
                  <strong>Rationale:</strong> Skips entire files on negative lookup. Per-file granularity means compaction naturally produces a fresh filter for the merged output.
                </p>
              </div>

              <div className="guide-decision-card" style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: 8, padding: 20, marginBottom: 20 }}>
                <h3 style={{ color: "#ffffff", margin: 0, fontSize: 16 }}>D-11: Scan via Memtable Snapshot</h3>
                <p style={{ margin: "10px 0" }}>
                  <strong>Chosen:</strong> Copy-on-read under brief RLock, then iterate the copy without locks
                  <br />
                  <strong>Rejected:</strong> Long-held RLock on memtable for iterator lifetime (blocked all writes — see scan-lock-contention postmortem)
                  <br />
                  <strong>Rationale:</strong> Unblocks writers during scan. Tradeoff: memory proportional to memtable size at scan creation.
                </p>
              </div>

              <div className="guide-decision-card" style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: 8, padding: 20, marginBottom: 20 }}>
                <h3 style={{ color: "#ffffff", margin: 0, fontSize: 16 }}>D-12: Scoped Background Errors</h3>
                <p style={{ margin: "10px 0" }}>
                  <strong>Chosen:</strong> WAL/flush errors block writes; compaction errors do not. Reads never blocked.
                  <br />
                  <strong>Rejected:</strong> Global read-only mode on any background error
                  <br />
                  <strong>Rationale:</strong> Compaction is non-critical for immediate correctness; only read amplification grows temporarily.
                </p>
              </div>

              <div className="guide-decision-card" style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: 8, padding: 20, marginBottom: 20 }}>
                <h3 style={{ color: "#ffffff", margin: 0, fontSize: 16 }}>D-13: Directory LOCK File</h3>
                <p style={{ margin: "10px 0" }}>
                  <strong>Chosen:</strong> Platform-specific file lock (flock / LockFileEx) for single-process access
                  <br />
                  <strong>Rejected:</strong> No lock (silent corruption risk with two processes)
                  <br />
                  <strong>Rationale:</strong> Two processes appending to one WAL corrupts both. The lock is the cheapest way to prevent this entirely.
                </p>
              </div>

              <div className="guide-decision-card" style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: 8, padding: 20, marginBottom: 20 }}>
                <h3 style={{ color: "#ffffff", margin: 0, fontSize: 16 }}>D-14: Quarantine Orphan SSTs</h3>
                <p style={{ margin: "10px 0" }}>
                  <strong>Chosen:</strong> Move unknown SST files to quarantine/ instead of deleting
                  <br />
                  <strong>Rejected:</strong> os.Remove on open (destroys forensic evidence)
                  <br />
                  <strong>Rationale:</strong> Preserves files for post-crash inspection without polluting the live set.
                </p>
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

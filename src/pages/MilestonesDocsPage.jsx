import React from "react";
import DocsNavbar from "../components/DocsNavbar";
import DocsSidebar from "../components/DocsSidebar";
import DocsMermaid from "../components/DocsMermaid";

const pageTopics = [
  { label: "Milestone Flowchart", href: "#flowchart" },
  { label: "M1: Durable Write Loop", href: "#m1" },
  { label: "M2: Immutable SSTable Layer", href: "#m2" },
  { label: "M3: Authoritative Manifest", href: "#m3" },
  { label: "M4: Background Compaction", href: "#m4" },
  { label: "M5: Correct Recovery", href: "#m5" },
  { label: "M6: Concurrent Reads", href: "#m6" },
  { label: "M7: Durability API", href: "#m7" },
];

const FLOWCHART = `graph LR
    M1[M1: Durable Writes] --> M2[M2: SSTable Layer]
    M2 --> M3[M3: Manifest Log]
    M3 --> M4[M4: Compact Merge]
    M4 --> M5[M5: Recovery Checkpoint]
    M5 --> M6[M6: Reads Cache]
    M6 --> M7[M7: API Group]

    style M1 fill:#18181b,stroke:#ff5cad,stroke-width:1.5px
    style M2 fill:#18181b,stroke:#ff5cad,stroke-width:1.5px
    style M3 fill:#18181b,stroke:#ff5cad,stroke-width:1.5px
    style M4 fill:#18181b,stroke:#ff5cad,stroke-width:1.5px
    style M5 fill:#18181b,stroke:#ff5cad,stroke-width:1.5px
    style M6 fill:#18181b,stroke:#ff5cad,stroke-width:1.5px
    style M7 fill:#18181b,stroke:#ff5cad,stroke-width:1.5px`;

export default function MilestonesDocsPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="milestones-title">
              PebbleDB Specification: Major Milestones
            </h1>

            <div className="guide-body-text" style={{ marginTop: 24 }}>
              <p>
                This document details the major milestones (M1–M7) achieved during the development of PebbleDB, mapping each milestone to its core components, key invariants, and validation tests.
              </p>

              {/* ── Flowchart ── */}
              <h2 className="guide-sub-heading" id="flowchart" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                Milestone Catalog
              </h2>
              <div className="my-6">
                <DocsMermaid chart={FLOWCHART} />
              </div>

              {/* ── M1 ── */}
              <h2 className="guide-sub-heading" id="m1" style={{ fontSize: 20, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                M1: Durable Write Loop
              </h2>
              <p>
                <strong>Objective:</strong> Build a basic write-ahead log and in-memory sorted buffer to guarantee write durability.
              </p>
              <p><strong>Key Components:</strong></p>
              <ul className="guide-bullets-list">
                <li><code className="inline-code">internal/wal</code>: CRC32-IEEE checksum verification and sequential record serialization.</li>
                <li><code className="inline-code">internal/memtable</code>: SkipList implementation with concurrent node updates.</li>
              </ul>
              <p><strong>Proven Invariants:</strong></p>
              <ul className="guide-bullets-list">
                <li><span className="highlight-text">D1</span>: WAL fsync occurs before memtable apply.</li>
                <li><span className="highlight-text">R3</span>: Bounded WAL replay with tail salvaging on recovery.</li>
              </ul>
              <p><strong>Validation Tests:</strong></p>
              <ul className="guide-bullets-list">
                <li><code className="inline-code">TestDBPutGet</code> (basic write loop verification)</li>
                <li><code className="inline-code">TestWalAppendFailurePreservesPendingBatch</code></li>
              </ul>

              {/* ── M2 ── */}
              <h2 className="guide-sub-heading" id="m2" style={{ fontSize: 20, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                M2: Immutable SSTable Layer
              </h2>
              <p>
                <strong>Objective:</strong> Convert frozen in-memory memtables into durable, read-only on-disk SSTable run files.
              </p>
              <p><strong>Key Components:</strong></p>
              <ul className="guide-bullets-list">
                <li><code className="inline-code">internal/sstable/writer.go</code>: Block formatting pipeline and index block serialization.</li>
                <li><code className="inline-code">internal/sstable/reader.go</code>: Block-level point lookup and footer verification.</li>
              </ul>
              <p><strong>Proven Invariants:</strong></p>
              <ul className="guide-bullets-list">
                <li><span className="highlight-text">D6</span>: SSTables are fully closed and opened as readers before they are exposed to queries.</li>
                <li><span className="highlight-text">C1</span>: Compaction and merge iterations preserve tombstones to prevent deleted keys from resurrecting.</li>
              </ul>
              <p><strong>Validation Tests:</strong></p>
              <ul className="guide-bullets-list">
                <li><code className="inline-code">TestFlusher</code> (checks memtable-to-SSTable serialization)</li>
                <li><code className="inline-code">TestSSTableReadWrite</code></li>
              </ul>

              {/* ── M3 ── */}
              <h2 className="guide-sub-heading" id="m3" style={{ fontSize: 20, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                M3: Authoritative Manifest
              </h2>
              <p>
                <strong>Objective:</strong> Enforce the manifest log as the sole source of truth for live files to prevent crash inconsistency.
              </p>
              <p><strong>Key Components:</strong></p>
              <ul className="guide-bullets-list">
                <li><code className="inline-code">internal/manifest/manifest.go</code>: Append-only metadata edit records (MANIFEST-*).</li>
                <li><code className="inline-code">internal/manifest/format.go</code>: <code className="inline-code">tagNewFile</code>, <code className="inline-code">tagDeleteFile</code>, and <code className="inline-code">tagSetFileSet</code> tag encoding.</li>
              </ul>
              <p><strong>Proven Invariants:</strong></p>
              <ul className="guide-bullets-list">
                <li><span className="highlight-text">D3</span>: Manifest defines the live SSTable set (directory glob is ignored).</li>
                <li><span className="highlight-text">D4</span>: Manifest update completes successfully before memory swaps or file deletions occur.</li>
              </ul>
              <p><strong>Validation Tests:</strong></p>
              <ul className="guide-bullets-list">
                <li><code className="inline-code">TestFlushWritesManifestRecord</code></li>
                <li><code className="inline-code">TestManifestIgnoresOrphanSSTAfterCompactionCrash</code></li>
              </ul>

              {/* ── M4 ── */}
              <h2 className="guide-sub-heading" id="m4" style={{ fontSize: 20, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                M4: Background Compaction
              </h2>
              <p>
                <strong>Objective:</strong> Bounded SSTable run counts via background merges to limit read amplification.
              </p>
              <p><strong>Key Components:</strong></p>
              <ul className="guide-bullets-list">
                <li><code className="inline-code">internal/db/compactor.go</code>: Compaction selection logic (oldest-2 policy) and coordinate channels.</li>
                <li><code className="inline-code">internal/iterator/merge.go</code>: K-way merge iteration.</li>
              </ul>
              <p><strong>Proven Invariants:</strong></p>
              <ul className="guide-bullets-list">
                <li><span className="highlight-text">C2</span>: Input files are not deleted until manifest commit completes.</li>
                <li><span className="highlight-text">C3</span>: Compaction failures do not block the concurrent write path.</li>
              </ul>
              <p><strong>Validation Tests:</strong></p>
              <ul className="guide-bullets-list">
                <li><code className="inline-code">TestCompactionMergesDuplicateKeys</code></li>
                <li><code className="inline-code">TestCompactionDropsDeletedKeys</code></li>
              </ul>

              {/* ── M5 ── */}
              <h2 className="guide-sub-heading" id="m5" style={{ fontSize: 20, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                M5: Correct Recovery
              </h2>
              <p>
                <strong>Objective:</strong> Prevent recovery paths from replaying redundant writes or writing corrupt data.
              </p>
              <p><strong>Key Components:</strong></p>
              <ul className="guide-bullets-list">
                <li><code className="inline-code">internal/db/wal_state.go</code>: 16-byte <code className="inline-code">wal.flush</code> checkpoint serialization.</li>
                <li><code className="inline-code">walReplayStartOffset()</code> logic in recovery.</li>
              </ul>
              <p><strong>Proven Invariants:</strong></p>
              <ul className="guide-bullets-list">
                <li><span className="highlight-text">D5</span>: WAL bytes written before FreezeOffset are redundant with flushed SSTs.</li>
                <li><span className="highlight-text">R4</span>: WAL replay starts only after manifest load and offset selection are verified.</li>
              </ul>
              <p><strong>Validation Tests:</strong></p>
              <ul className="guide-bullets-list">
                <li><code className="inline-code">TestCrashRecoveryFlushBoundaries</code></li>
                <li><code className="inline-code">TestCrashRecoveryCompactBoundaries</code></li>
              </ul>

              {/* ── M6 ── */}
              <h2 className="guide-sub-heading" id="m6" style={{ fontSize: 20, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                M6: Concurrent Reads
              </h2>
              <p>
                <strong>Objective:</strong> Allow point lookups and range scans to run concurrently with background compactions without blocking.
              </p>
              <p><strong>Key Components:</strong></p>
              <ul className="guide-bullets-list">
                <li><code className="inline-code">internal/bloom/bloom.go</code>: Per-SSTable bloom membership filters.</li>
                <li><code className="inline-code">sstable.Reader</code> reference counting (Ref/Unref/Discard).</li>
                <li><code className="inline-code">internal/db/scan.go</code>: Copy-on-read memtable snapshots (Snapshot()).</li>
              </ul>
              <p><strong>Proven Invariants:</strong></p>
              <ul className="guide-bullets-list">
                <li><span className="highlight-text">V2</span>: Compaction does not close readers that are still referenced by in-flight reads.</li>
                <li><span className="highlight-text">V3</span>: Scan iterators walk a point-in-time snapshot, allowing writes to proceed concurrently.</li>
              </ul>
              <p><strong>Validation Tests:</strong></p>
              <ul className="guide-bullets-list">
                <li><code className="inline-code">TestGetSurvivesCompactionWithHeldRefs</code></li>
                <li><code className="inline-code">TestScanDoesNotBlockWrites</code></li>
              </ul>

              {/* ── M7 ── */}
              <h2 className="guide-sub-heading" id="m7" style={{ fontSize: 20, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                M7: Durability API
              </h2>
              <p>
                <strong>Objective:</strong> Provide high-throughput group commits alongside explicit durability boundaries.
              </p>
              <p><strong>Key Components:</strong></p>
              <ul className="guide-bullets-list">
                <li><code className="inline-code">internal/db/batch.go</code>: Group-commit batch flusher.</li>
                <li><code className="inline-code">internal/db/sync.go</code>: Sync and fsync write boundaries.</li>
                <li><code className="inline-code">internal/db/dir_lock.go</code>: Platform-specific file locking.</li>
              </ul>
              <p><strong>Proven Invariants:</strong></p>
              <ul className="guide-bullets-list">
                <li><span className="highlight-text">R1</span>: Enforces single-process access to the data directory.</li>
                <li><span className="highlight-text">W1</span>: Queued writes in pendingBatch are not lost during async flushes.</li>
                <li><span className="highlight-text">W2</span>: Write calls do not guarantee durability unless SyncWrites or Sync() completes.</li>
              </ul>
              <p><strong>Validation Tests:</strong></p>
              <ul className="guide-bullets-list">
                <li><code className="inline-code">TestRapidPutNoLossDuringAsyncFlush</code></li>
                <li><code className="inline-code">TestSyncWritesOptionWaitsForFsync</code></li>
                <li><code className="inline-code">TestOpenRejectsSecondProcessLock</code></li>
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

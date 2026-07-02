import React from "react";
import DocsNavbar from "@/features/docs/components/DocsNavbar";
import DocsSidebar from "@/features/docs/components/DocsSidebar";
import DocsMermaid from "@/features/docs/components/DocsMermaid";

const pageTopics = [
  { label: "Correctness Goal", href: "#correctness-goal" },
  { label: "Invariant Dependency Graph", href: "#dependency-graph" },
  { label: "Durability Invariants", href: "#durability-invariants" },
  { label: "Visibility Invariants", href: "#visibility-invariants" },
  { label: "Write Path Invariants", href: "#write-path" },
  { label: "Compaction Invariants", href: "#compaction" },
  { label: "Recovery & Shutdown Invariants", href: "#recovery-shutdown" },
  { label: "Summary Table", href: "#summary" },
];

const GRAPH_CHART = `flowchart TD
    D1[D1: WAL before memtable]
    W1[W1: pendingBatch safety]
    D3[D3: Manifest authority]
    D4[D4: Manifest before memory]
    D5[D5: WAL checkpoint]
    D6[D6: Complete SST first]
    V2[V2: Reader refs]
    S1[S1: Bounded shutdown]
    D2[D2: Durable key placement]
    R4[R4: SST-first open]
    C2[C2: Input delete order]
    V1[V1: Newest-wins reads]
    C1[C1: Tombstones in merge]

    D1 --> D2
    W1 --> D2
    D3 --> D2
    D4 --> D2
    D5 --> D2
    D6 --> D2
    S1 --> D2
    V2 --> V1
    R4 --> V1
    C2 --> V1
    C1 --> V1
    
    style D2 fill:#18181b,stroke:#ff5cad,stroke-width:1.5px
    style V1 fill:#18181b,stroke:#ff5cad,stroke-width:1.5px`;

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
const tdMonoStyle = { padding: "10px 16px", fontFamily: "monospace" };
const tdBoldStyle = { padding: "10px 16px", fontWeight: 500, color: "#ffffff" };

export default function SystemInvariantsDocsPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="system-invariants-title">
              PebbleDB Engineering: System Invariants
            </h1>

            <div className="guide-body-text" style={{ marginTop: 24 }}>
              <p>
                This document catalogs every system invariant that PebbleDB must maintain across crash, concurrent reads, and background compaction. Each invariant maps to specific code, tests, and crash injection points.
              </p>

              {/* ── 1. Correctness Goal ── */}
              <h2 className="guide-sub-heading" id="correctness-goal" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                1. Correctness Goal
              </h2>
              <p>
                After a successful durability boundary, acknowledged user data survives process crash and power loss, and reads observe a coherent newest-wins view across memtable and SST layers.
              </p>

              {/* ── 2. Invariant Dependency Graph ── */}
              <h2 className="guide-sub-heading" id="dependency-graph" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                2. Invariant Dependency Graph
              </h2>
              <p>
                Some invariants are primitive; others are composite correctness properties built on top of them.
              </p>
              <DocsMermaid chart={GRAPH_CHART} />

              {/* ── 3. Durability Invariants ── */}
              <h2 className="guide-sub-heading" id="durability-invariants" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                3. Durability Invariants
              </h2>
              
              <h3 style={{ color: "#ffffff", marginTop: 16 }}>D1 — WAL fsync Before Memtable Apply</h3>
              <p style={{ marginLeft: 8 }}>
                <strong>Statement:</strong> After <code className="inline-code">awaitBatchPersist()</code> or <code className="inline-code">Sync()</code> returns successfully, every record in the flushed batch has been appended to <code className="inline-code">wal.log</code> and fsync has completed. Memtable apply happens only after WAL append succeeds.
                <br />
                <strong>Violation Symptom:</strong> Keys visible in memtable after restart but absent from WAL replay.
                <br />
                <strong>Enforced By:</strong> <code className="inline-code">flushPendingBatch()</code> in <code className="inline-code">batch.go</code>: AppendBatch then apply loop.
                <br />
                <strong>Tests:</strong> <code className="inline-code">TestSyncPersistsPendingBatch</code>, <code className="inline-code">TestWalAppendFailurePreservesPendingBatch</code>
              </p>

              <h3 style={{ color: "#ffffff", marginTop: 16 }}>D2 — A User-Visible Key Exists in WAL or a Live SST (or Both)</h3>
              <p style={{ marginLeft: 8 }}>
                <strong>Statement:</strong> For any key that Get would return after successful Sync() or Close(): it appears in <code className="inline-code">wal.log</code> at some offset, or in an SSTable whose ID is in the manifest live set, or in active/pendingFlush that will be flushed before shutdown.
                <br />
                <strong>Violation Symptom:</strong> Get succeeds, crash, reopen → ErrNotFound with no WAL record and no SST entry.
                <br />
                <strong>Dependencies:</strong> D1, D3, D4, D5, D6, W1, W2, S1
              </p>

              <h3 style={{ color: "#ffffff", marginTop: 16 }}>D3 — Manifest is Authoritative for the Live SST Set</h3>
              <p style={{ marginLeft: 8 }}>
                <strong>Statement:</strong> An <code className="inline-code">sst_XXXXXXXX.sst</code> file on disk is live if and only if its ID is in the manifest live set after replay. Directory glob alone does not define liveness.
                <br />
                <strong>Violation Symptom:</strong> Disk has SST files not in manifest; Get misses keys that exist only in orphans.
                <br />
                <strong>Enforced By:</strong> <code className="inline-code">loadSSTables()</code> loads only manifest IDs; <code className="inline-code">removeOrphanSSTFiles()</code> quarantines extras.
              </p>

              <h3 style={{ color: "#ffffff", marginTop: 16 }}>D4 — Manifest fsync Precedes In-Memory SST Set Update</h3>
              <p style={{ marginLeft: 8 }}>
                <strong>Statement:</strong> For flush: <code className="inline-code">manifest.AppendNewFile(id)</code> + fsync completes before <code className="inline-code">db.sstables</code> is updated. For compaction: <code className="inline-code">manifest.AppendSetFileSet(liveIDs)</code> + fsync completes before <code className="inline-code">db.sstables</code> is replaced.
                <br />
                <strong>Violation Symptom:</strong> Post-crash manifest and disk disagree; keys lost or duplicated.
                <br />
                <strong>Enforced By:</strong> <code className="inline-code">flush.go</code>, <code className="inline-code">compactor.go</code>
              </p>

              <h3 style={{ color: "#ffffff", marginTop: 16 }}>D5 — WAL Bytes Before FreezeOffset Are Redundant With a Flushed SST</h3>
              <p style={{ marginLeft: 8 }}>
                <strong>Statement:</strong> When <code className="inline-code">wal.flush</code> exists: SST SSTID is in the manifest live set, <code className="inline-code">wal.log</code> size ≥ FreezeOffset, and all user records in WAL [0, FreezeOffset) are represented in that SST.
              </p>

              <div style={{ overflowX: "auto", marginTop: 12, marginBottom: 20 }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={theadRowStyle}>
                      <th style={thStyle}>Crash Window</th>
                      <th style={thStyle}>Crash After</th>
                      <th style={thStyle}>On Reopen</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>1</td>
                      <td style={tdStyle}>Manifest commit, before wal.flush</td>
                      <td style={tdStyle}>Full WAL replay; duplicates possible until read path merges</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>2</td>
                      <td style={tdStyle}>wal.flush written, before truncate</td>
                      <td style={tdStyle}>Replay from FreezeOffset; correct</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>3</td>
                      <td style={tdStyle}>Truncate done, before remove wal.flush</td>
                      <td style={tdStyle}>wal.size &lt; FreezeOffset → replay from 0; correct</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h3 style={{ color: "#ffffff", marginTop: 16 }}>D6 — SST Files Are Complete Before Manifest Learns Them</h3>
              <p style={{ marginLeft: 8 }}>
                <strong>Statement:</strong> An SST is fully written (footer + bloom), closed, and opened as Reader before <code className="inline-code">manifest.AppendNewFile()</code> is called.
                <br />
                <strong>Violation Symptom:</strong> Manifest references ID; file truncated or bad footer → open fails.
              </p>

              {/* ── 4. Visibility Invariants ── */}
              <h2 className="guide-sub-heading" id="visibility-invariants" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                4. Visibility Invariants
              </h2>
              
              <h3 style={{ color: "#ffffff", marginTop: 16 }}>V1 — Get Observes Newest Visible Version Across Layers</h3>
              <p style={{ marginLeft: 8 }}>
                <strong>Search Order:</strong> <code className="inline-code">pendingBatch</code> → active memtable → pendingFlush (newest first) → SST readers (newest first)
                <br />
                <strong>Enforced By:</strong> <code className="inline-code">get.go</code>
              </p>

              <h3 style={{ color: "#ffffff", marginTop: 16 }}>V2 — Compaction Does Not Close a Reader Still Referenced by In-Flight Get/Scan</h3>
              <p style={{ marginLeft: 8 }}>
                <strong>Statement:</strong> <code className="inline-code">Discard()</code> marks close-pending; physical Close happens only when <code className="inline-code">Ref()</code> count reaches zero.
                <br />
                <strong>Enforced By:</strong> Ref/Unref in <code className="inline-code">get.go</code> and <code className="inline-code">scan.go</code>; <code className="inline-code">readersStillPresent</code> in compaction.
              </p>

              <h3 style={{ color: "#ffffff", marginTop: 16 }}>V3 — Scan Iterators See a Snapshot at Creation Time</h3>
              <p style={{ marginLeft: 8 }}>
                <strong>Statement:</strong> Scan copies memtable state under lock and pins SST readers with Ref. Writes after iterator creation are not required to appear in the scan.
              </p>

              {/* ── 5. Write Path Invariants ── */}
              <h2 className="guide-sub-heading" id="write-path" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                5. Write Path Invariants
              </h2>
              
              <h3 style={{ color: "#ffffff", marginTop: 16 }}>W1 — pendingBatch Records Are Not Dropped During Async Flush</h3>
              <p style={{ marginLeft: 8 }}>
                <strong>Statement:</strong> Records appended to <code className="inline-code">pendingBatch</code> while the batch flusher holds an in-flight batch must remain queued after flush completes.
                <br />
                <strong>Root Cause:</strong> <code className="inline-code">db.pendingBatch = batch[:0]</code> during concurrent append dropped keys under stress test.
                <br />
                <strong>Test:</strong> <code className="inline-code">TestRapidPutNoLossDuringAsyncFlush</code>
              </p>

              <h3 style={{ color: "#ffffff", marginTop: 16 }}>W2 — Put Return Does Not Imply Durability</h3>
              <p style={{ marginLeft: 8 }}>
                <strong>Statement:</strong> Default async Put may return while records sit in <code className="inline-code">pendingBatch</code>. <code className="inline-code">Sync()</code> or <code className="inline-code">SyncWrites: true</code> forces transition to durable.
              </p>

              {/* ── 6. Compaction Invariants ── */}
              <h2 className="guide-sub-heading" id="compaction" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                6. Compaction Invariants
              </h2>

              <h3 style={{ color: "#ffffff", marginTop: 16 }}>C1 — Compaction Merge Preserves Tombstones</h3>
              <p style={{ marginLeft: 8 }}>
                <strong>Statement:</strong> <code className="inline-code">MergeReadersKeepTombstones</code> emits tombstone entries. Duplicate keys resolve to the newer file.
                <br />
                <strong>Violation Symptom:</strong> Deleted keys reappear after compaction.
              </p>

              <h3 style={{ color: "#ffffff", marginTop: 16 }}>C2 — Input SST Files Not Deleted Until Manifest Commits and Refs Drain</h3>
              <p style={{ marginLeft: 8 }}>
                <strong>Order:</strong> Merge to disk → manifest SetFileSet + fsync → update db.sstables → Discard inputs → delete when refs=0.
              </p>

              <h3 style={{ color: "#ffffff", marginTop: 16 }}>C3 — Compaction Failure Does Not Block Writes</h3>
              <p style={{ marginLeft: 8 }}>
                <strong>Statement:</strong> Compaction errors set background compaction error and retry. Unlike flush, writes continue (read amplification may grow).
              </p>

              {/* ── 7. Recovery & Shutdown Invariants ── */}
              <h2 className="guide-sub-heading" id="recovery-shutdown" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                7. Recovery & Shutdown Invariants
              </h2>
              <ul className="guide-bullets-list">
                <li>
                  <span className="highlight-text">R1 — Single Process Per Database Directory</span>: LOCK file via flock / LockFileEx. Second Open returns ErrDatabaseLocked.
                </li>
                <li>
                  <span className="highlight-text">R2 — Orphan SSTs Never Become Live on Open</span>: Files not in manifest are quarantined, not loaded.
                </li>
                <li>
                  <span className="highlight-text">R3 — WAL Replay is Bounded and Salvageable</span>: Replay respects ReplayLimits. Partial tail records at EOF are truncated to last valid checksum.
                </li>
                <li>
                  <span className="highlight-text">R4 — Open Replays WAL Only After SST Load and Offset Selection</span>: Sequence: LOCK → manifest → load SSTs → quarantine orphans → walReplayStartOffset → replay.
                </li>
                <li>
                  <span className="highlight-text">S1 — Close Does Not Destroy WAL/Manifest Until Workers Stop or Timeout</span>: On ErrCloseIncomplete, abort path keeps WAL and manifest handles open so background goroutines cannot race with nil manifest.
                </li>
              </ul>

              {/* ── 8. Summary Table ── */}
              <h2 className="guide-sub-heading" id="summary" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                8. Summary Table
              </h2>
              <div style={{ overflowX: "auto", marginTop: 16, marginBottom: 20 }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={theadRowStyle}>
                      <th style={thStyle}>ID</th>
                      <th style={thStyle}>Statement</th>
                      <th style={thStyle}>Primary Enforcement</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>D1</td>
                      <td style={tdStyle}>WAL fsync before memtable apply</td>
                      <td style={tdMonoStyle}>batch.go</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>D2</td>
                      <td style={tdStyle}>Durable keys in WAL ∪ live SSTs</td>
                      <td style={tdMonoStyle}>D1 + D3 + D4</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>D3</td>
                      <td style={tdStyle}>Manifest defines live SST set</td>
                      <td style={tdMonoStyle}>manifest.go, loadSSTables</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>D4</td>
                      <td style={tdStyle}>Manifest fsync before memory swap</td>
                      <td style={tdMonoStyle}>flush.go, compactor.go</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>D5</td>
                      <td style={tdStyle}>WAL prefix redundant after checkpoint</td>
                      <td style={tdMonoStyle}>wal_state.go</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>D6</td>
                      <td style={tdStyle}>Complete SST before manifest</td>
                      <td style={tdMonoStyle}>sstable.Writer, flush</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>V1</td>
                      <td style={tdStyle}>Newest-wins read ordering</td>
                      <td style={tdMonoStyle}>get.go</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>V2</td>
                      <td style={tdStyle}>No close of referenced readers</td>
                      <td style={tdMonoStyle}>Ref/Discard</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>V3</td>
                      <td style={tdStyle}>Scan snapshot isolation</td>
                      <td style={tdMonoStyle}>scan.go</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>W1</td>
                      <td style={tdStyle}>No pendingBatch loss on flush</td>
                      <td style={tdMonoStyle}>batch.go</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>W2</td>
                      <td style={tdStyle}>Async Put ≠ durable</td>
                      <td style={tdMonoStyle}>sync.go, docs</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>C1</td>
                      <td style={tdStyle}>Tombstones survive merge</td>
                      <td style={tdMonoStyle}>MergeReadersKeepTombstones</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>C2</td>
                      <td style={tdStyle}>Delete inputs after manifest</td>
                      <td style={tdMonoStyle}>compactor.go</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>C3</td>
                      <td style={tdStyle}>Compaction errors scoped</td>
                      <td style={tdMonoStyle}>background_err</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>R1</td>
                      <td style={tdStyle}>One process per dir</td>
                      <td style={tdMonoStyle}>dir_lock_*.go</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>R2</td>
                      <td style={tdStyle}>Orphans quarantined</td>
                      <td style={tdMonoStyle}>removeOrphanSSTFiles</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>R3</td>
                      <td style={tdStyle}>Bounded WAL replay</td>
                      <td style={tdMonoStyle}>wal/limits.go</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>R4</td>
                      <td style={tdStyle}>SST-first open</td>
                      <td style={tdMonoStyle}>db.go Open</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>S1</td>
                      <td style={tdStyle}>Bounded shutdown</td>
                      <td style={tdMonoStyle}>close.go</td>
                    </tr>
                  </tbody>
                </table>
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

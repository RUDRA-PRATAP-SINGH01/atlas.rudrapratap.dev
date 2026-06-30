import DocsNavbar from "@/components/docs/DocsNavbar";
import DocsSidebar from "@/components/docs/DocsSidebar";

const pageTopics = [
  { label: "Complete Recovery Sequence", href: "#recovery-sequence" },
  { label: "Bounded WAL Replay via Checkpoints", href: "#wal-checkpoints" },
  { label: "Crash Recovery Matrix", href: "#recovery-matrix" },
];

function RecoveryFlowSvg() {
  return (
    <svg viewBox="0 0 500 300" className="w-full h-auto bg-[#0e0e11] border border-zinc-800 rounded-lg p-6 my-6" style={{ marginTop: 24, marginBottom: 24 }}>
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#71717a" />
        </marker>
      </defs>

      {/* Start Open */}
      <rect x="180" y="10" width="140" height="30" rx="4" fill="#27272a" stroke="#ff5cad" strokeWidth="1.2" />
      <text x="250" y="29" fill="#ffffff" fontSize="11" fontWeight="bold" textAnchor="middle">Open(dir)</text>

      {/* Lock */}
      <path d="M 250 40 L 250 66" stroke="#71717a" strokeWidth="1.2" markerEnd="url(#arrow)" />
      <rect x="150" y="66" width="200" height="28" rx="4" fill="#18181b" stroke="#52525b" strokeWidth="1" />
      <text x="250" y="83" fill="#ffffff" fontSize="10" textAnchor="middle">1. Acquire lock (flock/LockFileEx)</text>

      {/* Manifest */}
      <path d="M 250 94 L 250 120" stroke="#71717a" strokeWidth="1.2" markerEnd="url(#arrow)" />
      <rect x="150" y="120" width="200" height="28" rx="4" fill="#18181b" stroke="#52525b" strokeWidth="1" />
      <text x="250" y="137" fill="#ffffff" fontSize="10" textAnchor="middle">2. Replay MANIFEST for live sstables</text>

      {/* Quarantine */}
      <path d="M 250 148 L 250 174" stroke="#71717a" strokeWidth="1.2" markerEnd="url(#arrow)" />
      <rect x="150" y="174" width="200" height="28" rx="4" fill="#18181b" stroke="#52525b" strokeWidth="1" />
      <text x="250" y="191" fill="#ffffff" fontSize="10" textAnchor="middle">3. Move orphaned SSTs to quarantine/</text>

      {/* WAL Checkpoint */}
      <path d="M 250 202 L 250 228" stroke="#71717a" strokeWidth="1.2" markerEnd="url(#arrow)" />
      <rect x="150" y="228" width="200" height="28" rx="4" fill="#18181b" stroke="#ff5cad" strokeWidth="1" />
      <text x="250" y="245" fill="#ffffff" fontSize="10" textAnchor="middle">4. Replay WAL from wal.flush checkpoint</text>
    </svg>
  );
}

export default function CrashRecoveryDocsPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="crash-recovery-title">PebbleDB Subsystem: Crash Recovery</h1>
            
            <div className="guide-body-text" style={{ marginTop: 24 }}>
              <p>
                This document specifies the crash recovery engine of PebbleDB, detailing how the database restores state after clean shutdowns, process crashes, or power losses.
              </p>

              <h2 className="guide-sub-heading" id="recovery-sequence" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>1. Complete Recovery Sequence</h2>
              <p>
                The database recovery pipeline runs on a single thread during Open() execution before background workers start.
              </p>

              <RecoveryFlowSvg />

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>1.1 Step-by-Step Recovery</h3>
              <ul className="guide-bullets-list">
                <li>
                  <span className="highlight-text">Acquire Directory Lock</span>: The engine opens the LOCK file and locks it exclusively (using Unix flock or Windows LockFileEx). This prevents multiple processes from accessing the database directory concurrently.
                </li>
                <li>
                  <span className="highlight-text">Locate Active Manifest</span>: Reads the CURRENT file to locate the active manifest file path (e.g., MANIFEST-000002). If the file is missing, the engine defaults to MANIFEST-000001.
                </li>
                <li>
                  <span className="highlight-text">Replay Manifest Entries</span>: Opens the manifest log and reads it sequentially.
                  <ul style={{ paddingLeft: 16, marginTop: 8, listStyleType: "circle" }}>
                    <li>Record Header: Reads the 4-byte record length and parses the payload.</li>
                    <li>Payload Types: Applies edits to rebuild the active SSTable ID set (liveSet).</li>
                    <li>Corruption Check: Verifies payload integrity using CRC32 checksums. If a corrupted tail record is encountered due to a crash, recovery truncates the file to the last valid byte offset.</li>
                  </ul>
                </li>
                <li>
                  <span className="highlight-text">Load SSTables</span>: Iterates through the manifest liveSet and opens a reader handle for each SSTable file. If a file is missing, recovery fails.
                </li>
                <li>
                  <span className="highlight-text">Quarantine Orphan Files</span>: Scans the directory for files matching the pattern sst_XXXXXXXX.sst. Any file found on disk that is absent from the manifest liveSet is moved to the quarantine/ directory. This isolates obsolete or incomplete files for diagnostics.
                </li>
                <li>
                  <span className="highlight-text">Verify WAL Replay Checkpoint</span>: Reads the wal.flush checkpoint to evaluate the safe WAL replay offset boundaries.
                </li>
                <li>
                  <span className="highlight-text">Replay WAL Tail</span>: Opens wal.log and replays mutations to populate the active memtable.
                </li>
                <li>
                  <span className="highlight-text">Open Log for Append</span>: Opens the WAL for appending, starts background workers, and completes the initialization.
                </li>
              </ul>

              <h2 className="guide-sub-heading" id="wal-checkpoints" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>2. Bounded WAL Replay via Checkpoints</h2>
              <p>
                Replaying the entire Write-Ahead Log on recovery is inefficient and can re-apply records already flushed to disk, causing key shadowing and delete resurrection bugs. PebbleDB solves this using a checkpointing protocol:
              </p>

              <div className="guide-code-block-container" style={{ marginTop: 12, marginBottom: 20 }}>
                <pre className="guide-code-pre">
                  <code className="guide-code-lines">
                    <span className="code-line"><span className="code-comment">Checkpoint Protocol Progress:</span></span>
                    <span className="code-line">Flush Complete ──&gt; Write wal.flush ──&gt; Truncate WAL ──&gt; Delete wal.flush</span>
                  </code>
                </pre>
              </div>

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>2.1 Checkpoint Lifecycle</h3>
              <p>
                Once the flusher worker successfully writes a frozen memtable to disk and registers the new SSTable in the manifest, it writes a wal.flush checkpoint file.
              </p>
              <ul className="guide-bullets-list">
                <li>
                  FreezeOffset (8 bytes): The byte offset of the WAL at the time the memtable was frozen.
                </li>
                <li>
                  SSTID (8 bytes): The ID of the newly written SSTable.
                </li>
                <li>
                  Write Isolation: The file is written to a temporary path, fsynced, and renamed to wal.flush to ensure durability.
                </li>
                <li>
                  WAL Truncation: The flusher truncates the WAL up to FreezeOffset and deletes the wal.flush file.
                </li>
              </ul>

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>2.2 Replay Offset Evaluation</h3>
              <p>
                Upon recovery, the database evaluates the start offset using the checkpoint:
              </p>
              <ul className="guide-bullets-list">
                <li>
                  Stale Checkpoint: If the checkpoint's SSTID is absent from the manifest, recovery starts from offset 0.
                </li>
                <li>
                  Truncation Complete: If the WAL size is smaller than FreezeOffset, the WAL has already been truncated. Replay starts from offset 0 on the truncated file.
                </li>
                <li>
                  Valid Checkpoint: If the WAL size is greater than or equal to FreezeOffset, replay starts from FreezeOffset. This skips replaying records already persisted in the SSTable.
                </li>
              </ul>

              <h2 className="guide-sub-heading" id="recovery-matrix" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>3. Crash Recovery Matrix</h2>
              <p>
                Below is the recovery matrix for crashes at different execution boundaries:
              </p>

              {/* Table of Crash Recovery Matrix */}
              <div style={{ overflowX: "auto", marginTop: 16, marginBottom: 20 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13, border: "1px solid rgba(255, 255, 255, 0.08)" }}>
                  <thead>
                    <tr style={{ background: "rgba(255, 92, 173, 0.08)", borderBottom: "1px solid rgba(255, 255, 255, 0.15)" }}>
                      <th style={{ padding: "10px 16px", color: "#ff5cad", fontWeight: 600 }}>Crash Boundary</th>
                      <th style={{ padding: "10px 16px", color: "#ff5cad", fontWeight: 600 }}>Disk State</th>
                      <th style={{ padding: "10px 16px", color: "#ff5cad", fontWeight: 600 }}>Reopen Recovery Behavior</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={{ padding: "10px 16px", fontWeight: 500, color: "#ffffff" }}>SST Written, Manifest pending</td>
                      <td style={{ padding: "10px 16px" }}>sst_0003.sst exists. Manifest does not record it.</td>
                      <td style={{ padding: "10px 16px" }}>The SST is recognized as an orphan and moved to quarantine/. Replay parses the WAL from offset 0. No data is lost.</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={{ padding: "10px 16px", fontWeight: 500, color: "#ffffff" }}>Manifest committed, Checkpoint pending</td>
                      <td style={{ padding: "10px 16px" }}>sst_0003.sst is registered in the manifest. No wal.flush exists.</td>
                      <td style={{ padding: "10px 16px" }}>Manifest loads sst_0003.sst. Replay runs from offset 0. Duplicate keys are loaded into the active memtable, shadowing old duplicates.</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={{ padding: "10px 16px", fontWeight: 500, color: "#ffffff" }}>Checkpoint written, Truncate pending</td>
                      <td style={{ padding: "10px 16px" }}>Checkpoint {"{"}1MB, 3{"}"} exists. WAL is intact (2MB).</td>
                      <td style={{ padding: "10px 16px" }}>Replay skips the first 1MB of the WAL, replaying only the tail. Stale records are skipped, and recovery is fast.</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={{ padding: "10px 16px", fontWeight: 500, color: "#ffffff" }}>Truncate completed, Checkpoint pending</td>
                      <td style={{ padding: "10px 16px" }}>WAL is truncated to 1MB. Checkpoint exists on disk.</td>
                      <td style={{ padding: "10px 16px" }}>Replay starts from offset 0 on the truncated WAL, replaying only the tail.</td>
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

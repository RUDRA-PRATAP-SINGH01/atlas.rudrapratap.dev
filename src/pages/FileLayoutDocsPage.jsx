import DocsNavbar from "../components/DocsNavbar";
import DocsSidebar from "../components/DocsSidebar";
import DocsMermaid from "../components/DocsMermaid";
import GoCodeBlock from "../components/GoCodeBlock";

const pageTopics = [
  { label: "Purpose", href: "#purpose" },
  { label: "Complete Directory Listing", href: "#directory-listing" },
  { label: "File Catalog", href: "#file-catalog" },
  { label: "File Lifecycle State Machine", href: "#lifecycle" },
  { label: "Crash Recovery", href: "#crash-recovery" },
  { label: "Atomic Write Protocols", href: "#atomic-writes" },
];

const HEALTHY_DIRECTORY = `<db-directory>/
├── CURRENT                     ← Pointer to the active manifest file
├── MANIFEST-000001             ← Append-only binary log of live SSTable edits
├── wal.log                     ← Write-ahead log for in-flight mutations
├── sst_00000001.sst            ← SSTable file (sorted, immutable)
├── sst_00000002.sst
├── sst_00000003.sst
└── ...`;

const TRANSIENT_DIRECTORY = `<db-directory>/
├── CURRENT.tmp                 ← Staging file for CURRENT pointer update
├── MANIFEST-000002             ← New manifest being rotated into place
├── wal.log.truncate.tmp        ← WAL tail copy during truncation
├── wal.flush                   ← Checkpoint: WAL bytes already in an SSTable
├── wal.flush.tmp               ← Staging file for wal.flush write
├── sst_00000004.sst.tmp        ← SSTable being written (not yet committed)
└── ...`;

const WAL_FLUSH_ASCII = `┌─────────────────────────┬─────────────────────────┐
│  FreezeOffset (8 bytes) │  SSTID (8 bytes)        │
│  Big-Endian U64         │  Big-Endian U64         │
└─────────────────────────┴─────────────────────────┘`;

const LIFECYCLE_CHART = `flowchart TD
    A["Writer creates .sst.tmp"] --> B["os.Rename(.tmp → .sst)"]
    B --> C["manifest.AppendNewFile(id)"]
    C --> D["Serving reads"]
    D --> E["Selected for compaction"]
    E --> F["Compaction completes, manifest deletes"]
    F --> G["os.Remove() after refs drop to 0"]

    A -.-> H["TmpFile"]
    B -.-> I["LiveSST"]
    C -.-> J["Manifest"]
    E -.-> K["Compacting"]
    F -.-> L["Discarded"]`;

const WAL_REPLAY_OFFSET_CHART = `flowchart TD
    A["walReplayStartOffset()"] --> B{"Read wal.flush"}
    B -->|not found| C["return offset 0"]
    B -->|found| D{"SSTID in manifest?"}
    D -->|no| C
    D -->|yes| E{"FreezeOffset < 0?"}
    E -->|yes| C
    E -->|no| F{"wal.log size < FreezeOffset?"}
    F -->|yes| C
    F -->|no| G["return FreezeOffset"]`;

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

export default function FileLayoutDocsPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="file-layout-title">
              PebbleDB Format Specification: File Layout
            </h1>

            <div className="guide-body-text" style={{ marginTop: 24 }}>
              <p>
                This document specifies the complete on-disk directory layout of a PebbleDB database instance, detailing every file type, naming convention, lifecycle state, and crash-safety protocol.
              </p>

              {/* ── 1. Purpose ── */}
              <h2 className="guide-sub-heading" id="purpose" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                1. Purpose
              </h2>
              <p>
                PebbleDB stores all persistent state in a single user-configured directory. Understanding the file layout is essential for:
              </p>
              <ul className="guide-bullets-list">
                <li><span className="highlight-text">Recovery</span>: Knowing which files to replay and which are orphans.</li>
                <li><span className="highlight-text">Debugging</span>: Inspecting the database state after a crash.</li>
                <li><span className="highlight-text">Operations</span>: Backup, restore, and migration procedures.</li>
              </ul>

              {/* ── 2. Directory Listing ── */}
              <h2 className="guide-sub-heading" id="directory-listing" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                2. Complete Directory Listing
              </h2>
              <p>A healthy PebbleDB data directory looks like this:</p>

              <GoCodeBlock>{HEALTHY_DIRECTORY}</GoCodeBlock>

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>
                2.1 Transient Files (Present During Operations)
              </h3>
              <p>
                These files exist only during in-progress operations. Their presence after a crash indicates an interrupted operation:
              </p>

              <GoCodeBlock>{TRANSIENT_DIRECTORY}</GoCodeBlock>

              {/* ── 3. File Catalog ── */}
              <h2 className="guide-sub-heading" id="file-catalog" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                3. File Catalog
              </h2>

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>3.1 CURRENT</h3>
              <div style={{ overflowX: "auto", marginTop: 8, marginBottom: 20 }}>
                <table style={tableStyle}>
                  <tbody>
                    {[
                      ["Format", "Single-line text: manifest filename + newline"],
                      ["Example", "MANIFEST-000001\\n"],
                      ["Updated By", "writeCurrent() via tmp + fsync + atomic rename"],
                      ["Read By", "readCurrentManifest() on database open"],
                    ].map(([prop, val], i) => (
                      <tr key={prop} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: i % 2 === 0 ? "rgba(255, 255, 255, 0.02)" : "transparent" }}>
                        <td style={tdBoldStyle}>{prop}</td>
                        <td style={tdStyle}>{val}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>3.2 MANIFEST-NNNNNN</h3>
              <div style={{ overflowX: "auto", marginTop: 8, marginBottom: 20 }}>
                <table style={tableStyle}>
                  <tbody>
                    {[
                      ["Format", "Binary append-only log of length-prefixed, CRC-checked records"],
                      ["Tags", "0x01 NewFile, 0x02 DeleteFile, 0x03 SetFileSet"],
                      ["Naming", "MANIFEST- prefix + 6-digit zero-padded sequence number"],
                      ["Rotation", "When ≥ 64 records or ≥ 64 KiB, compacted to new sequence number"],
                      ["Concurrency", "Protected by manifest.mu"],
                    ].map(([prop, val], i) => (
                      <tr key={prop} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: i % 2 === 0 ? "rgba(255, 255, 255, 0.02)" : "transparent" }}>
                        <td style={tdBoldStyle}>{prop}</td>
                        <td style={tdStyle}>{val}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>3.3 wal.log</h3>
              <div style={{ overflowX: "auto", marginTop: 8, marginBottom: 20 }}>
                <table style={tableStyle}>
                  <tbody>
                    {[
                      ["Format", "Binary sequential log of CRC32-checked WAL records"],
                      ["Record Size", "13 + keyLen + valueLen bytes per record"],
                      ["Max File Size", "64 MiB (enforced on replay)"],
                      ["Truncation", "After flush, prefix bytes are removed via copy-rename"],
                      ["Concurrency", "Protected by wal.mu"],
                    ].map(([prop, val], i) => (
                      <tr key={prop} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: i % 2 === 0 ? "rgba(255, 255, 255, 0.02)" : "transparent" }}>
                        <td style={tdBoldStyle}>{prop}</td>
                        <td style={tdStyle}>{val}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>3.4 sst_NNNNNNNN.sst</h3>
              <div style={{ overflowX: "auto", marginTop: 8, marginBottom: 20 }}>
                <table style={tableStyle}>
                  <tbody>
                    {[
                      ["Format", "Binary SSTable: data blocks + index + Bloom filter + 48-byte footer"],
                      ["Naming", "sst_ prefix + 8-digit zero-padded ID + .sst extension"],
                      ["Lifecycle", "Created by flush/compaction → committed via manifest → deleted by compaction"],
                      ["Immutability", "Never modified after atomic rename from .tmp"],
                    ].map(([prop, val], i) => (
                      <tr key={prop} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: i % 2 === 0 ? "rgba(255, 255, 255, 0.02)" : "transparent" }}>
                        <td style={tdBoldStyle}>{prop}</td>
                        <td style={tdStyle}>{val}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>3.5 wal.flush (Checkpoint)</h3>
              <div style={{ overflowX: "auto", marginTop: 8, marginBottom: 12 }}>
                <table style={tableStyle}>
                  <tbody>
                    {[
                      ["Format", "Fixed 16 bytes: FreezeOffset (8B BE U64) + SSTID (8B BE U64)"],
                      ["Purpose", "Records that WAL bytes [0, FreezeOffset) are captured in SSTable SSTID"],
                      ["Written By", "writeWalFlushState() after manifest commit, before WAL truncation"],
                      ["Removed By", "removeWalFlushState() after successful WAL truncation"],
                    ].map(([prop, val], i) => (
                      <tr key={prop} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: i % 2 === 0 ? "rgba(255, 255, 255, 0.02)" : "transparent" }}>
                        <td style={tdBoldStyle}>{prop}</td>
                        <td style={tdStyle}>{val}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <GoCodeBlock>{`type walFlushState struct {
    FreezeOffset int64
    SSTID        uint64
}`}</GoCodeBlock>

              <GoCodeBlock>{WAL_FLUSH_ASCII}</GoCodeBlock>

              {/* ── 4. Lifecycle ── */}
              <h2 className="guide-sub-heading" id="lifecycle" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                4. File Lifecycle State Machine
              </h2>

              <DocsMermaid chart={LIFECYCLE_CHART} />

              {/* ── 5. Crash Recovery ── */}
              <h2 className="guide-sub-heading" id="crash-recovery" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                5. Crash Recovery: File Presence Truth Table
              </h2>
              <p>
                On database open, PebbleDB inspects the directory and handles each combination:
              </p>

              <div style={{ overflowX: "auto", marginTop: 16, marginBottom: 20 }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={theadRowStyle}>
                      <th style={thStyle}>CURRENT</th>
                      <th style={thStyle}>MANIFEST</th>
                      <th style={thStyle}>wal.log</th>
                      <th style={thStyle}>wal.flush</th>
                      <th style={thStyle}>.sst.tmp files</th>
                      <th style={thStyle}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["✓", "✓", "✓", "✗", "✗", "Normal open: replay manifest, replay WAL from 0"],
                      ["✓", "✓", "✓", "✓", "✗", "Interrupted flush: compute walReplayStartOffset(), replay WAL from offset"],
                      ["✓", "✓", "✗", "✗", "✗", "WAL was fully flushed: open with empty memtable"],
                      ["✓", "✓", "✓", "✗", "✓", "Orphan tmp: delete .sst.tmp files, normal open"],
                      ["✗", "✗", "✗", "✗", "✗", "Fresh database: create CURRENT + MANIFEST-000001"],
                    ].map((row, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: i % 2 === 0 ? "rgba(255, 255, 255, 0.02)" : "transparent" }}>
                        {row.map((cell, j) => (
                          <td key={j} style={j === 5 ? tdStyle : tdMonoStyle}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>
                5.1 wal.flush Replay Offset Decision Tree
              </h3>

              <DocsMermaid chart={WAL_REPLAY_OFFSET_CHART} />

              {/* ── 6. Atomic Writes ── */}
              <h2 className="guide-sub-heading" id="atomic-writes" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                6. Atomic Write Protocols Summary
              </h2>
              <p>
                Every durable state change in PebbleDB uses one of these crash-safe patterns:
              </p>

              <div style={{ overflowX: "auto", marginTop: 16, marginBottom: 20 }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={theadRowStyle}>
                      <th style={thStyle}>File</th>
                      <th style={thStyle}>Protocol</th>
                      <th style={thStyle}>Steps</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["CURRENT", "Write-tmp + fsync + rename", "Write to CURRENT.tmp → fsync → os.Rename"],
                      ["MANIFEST-N", "Append + fsync", "Append record → file.Sync()"],
                      ["wal.log", "Append + batch fsync", "Append records → file.Sync() (once per batch)"],
                      ["wal.log truncation", "Copy-tail + fsync + rename", "Copy [offset, EOF) to .truncate.tmp → fsync → rename"],
                      ["wal.flush", "Write-tmp + fsync + rename", "Write 16 bytes to .tmp → fsync → rename"],
                      ["sst_N.sst", "Write-tmp + fsync + rename", "Write complete file to .tmp → fsync → rename"],
                      ["Manifest rotation", "Write-new + fsync + update CURRENT + delete old", "Full snapshot → new file → CURRENT update → remove old"],
                    ].map(([file, protocol, steps], i) => (
                      <tr key={file} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: i % 2 === 0 ? "rgba(255, 255, 255, 0.02)" : "transparent" }}>
                        <td style={tdMonoStyle}>{file}</td>
                        <td style={tdStyle}>{protocol}</td>
                        <td style={tdStyle}>{steps}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div
                style={{
                  marginTop: 16,
                  marginBottom: 20,
                  padding: "16px 20px",
                  background: "rgba(255, 92, 173, 0.06)",
                  border: "1px solid rgba(255, 92, 173, 0.2)",
                  borderRadius: 8,
                }}
              >
                <p style={{ margin: 0, fontSize: 13, color: "#d4d4d8" }}>
                  <span style={{ color: "#ff5cad", fontWeight: 600 }}>IMPORTANT</span> — Every file mutation follows the pattern: write to temporary → fsync temporary → atomic rename. This ensures that a crash at any point leaves either the old state or the new state on disk, never a partially-written file.
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

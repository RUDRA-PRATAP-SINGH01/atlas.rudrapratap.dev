import DocsNavbar from "../components/DocsNavbar";
import DocsSidebar from "../components/DocsSidebar";
import DocsMermaid from "../components/DocsMermaid";
import GoCodeBlock from "../components/GoCodeBlock";

const pageTopics = [
  { label: "Purpose", href: "#purpose" },
  { label: "Record Envelope Format", href: "#record-envelope" },
  { label: "Edit Tag Payloads", href: "#edit-tags" },
  { label: "Edit Application State Machine", href: "#edit-state-machine" },
  { label: "Manifest Replay & Tail Salvaging", href: "#replay" },
  { label: "Log Rotation Protocol", href: "#rotation" },
  { label: "CURRENT Pointer File", href: "#current-pointer" },
  { label: "Walkthrough", href: "#walkthrough" },
];

const RECORD_ENVELOPE_ASCII = `┌────────────────────────┬─────────────────────────┬─────────────────────────┐
│   recordLen (4 bytes)  │   checksum (4 bytes)    │   payload (variable)    │
│   Big-Endian U32       │   CRC32-IEEE of payload │   Tag + tag-specific    │
└────────────────────────┴─────────────────────────┴─────────────────────────┘`;

const TAG_NEW_FILE_ASCII = `┌─────────────┬─────────────────────┐
│  Tag (1B)   │  SSTable ID (8B)    │
│  0x01       │  Big-Endian U64     │
└─────────────┴─────────────────────┘`;

const TAG_DELETE_FILE_ASCII = `┌─────────────┬─────────────────────┐
│  Tag (1B)   │  SSTable ID (8B)    │
│  0x02       │  Big-Endian U64     │
└─────────────┴─────────────────────┘`;

const TAG_SET_FILESET_ASCII = `┌─────────────┬──────────────────┬──────────────────┬────────────────────┬─────┐
│  Tag (1B)   │  Count (4B)      │  SST ID 0 (8B)   │  SST ID 1 (8B)    │ ... │
│  0x03       │  Big-Endian U32  │  Big-Endian U64  │  Big-Endian U64   │     │
└─────────────┴──────────────────┴──────────────────┴────────────────────┴─────┘`;

const EDIT_STATE_MACHINE_CHART = `flowchart TD
    A["Read payload[0]"] --> B{"Tag?"}
    B -->|"0x01 NewFile"| C["liveSet[id] = struct{}{}"]
    B -->|"0x02 DeleteFile"| D["delete(liveSet, id)"]
    B -->|"0x03 SetFileSet"| E["Clear liveSet, add all IDs"]
    B -->|unknown| F["return io.ErrUnexpectedEOF"]`;

const REPLAY_CHART = `flowchart TD
    A["manifest.Open(dir)"] --> B["Read CURRENT file → manifest filename"]
    B --> C["Open MANIFEST-NNNNNN for R/W/Append"]
    C --> D["Read recordLen bytes"]
    D -->|EOF| E["Replay complete"]
    D -->|UnexpectedEOF| F["Truncate to last valid record"]
    F --> E
    D -->|ok| G["decodeRecord() → payload"]
    G -->|CRC mismatch| F
    G -->|ok| H["applyEdit(liveSet, payload)"]
    H --> I["recordCount++, validEnd = current offset"]
    I --> D`;

const ROTATION_CHART = `flowchart TD
    A["Threshold exceeded (≥ 64 records or ≥ 64 KiB)"] --> B["Create MANIFEST-NNNNNN (next ID)"]
    B --> C["Write single SetFileSet snapshot"]
    C --> D["fsync + Close new manifest"]
    D --> E["writeCurrent: tmp + rename CURRENT pointer"]
    E --> F["Close old manifest handle"]
    F --> G["os.Remove() old MANIFEST file"]
    G --> H["Reopen new manifest for append"]`;

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

export default function ManifestFormatDocsPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="manifest-format-title">
              PebbleDB Format Specification: Manifest Format
            </h1>

            <div className="guide-body-text" style={{ marginTop: 24 }}>
              <p>
                This document specifies the binary format of PebbleDB&apos;s Manifest log, detailing the record envelope structure, edit tag payloads, CRC integrity verification, replay state machine, log rotation protocol, and CURRENT pointer mechanics.
              </p>

              {/* ── 1. Purpose ── */}
              <h2 className="guide-sub-heading" id="purpose" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                1. Purpose
              </h2>
              <p>
                The Manifest is PebbleDB&apos;s single source of truth for which SSTable files are currently live. It is an append-only binary log (<span className="highlight-text">MANIFEST-NNNNNN</span>) that records structural edits:
              </p>
              <ul className="guide-bullets-list">
                <li><span className="highlight-text">Flush</span>: adds a new SSTable file.</li>
                <li><span className="highlight-text">Compaction</span>: removes obsolete SSTable files and adds the merged result.</li>
                <li><span className="highlight-text">Rotation</span>: replaces the entire log with a single snapshot record.</li>
              </ul>

              {/* ── 2. Record Envelope ── */}
              <h2 className="guide-sub-heading" id="record-envelope" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                2. Record Envelope Format
              </h2>
              <p>Every manifest record uses a uniform envelope structure:</p>

              <GoCodeBlock>{RECORD_ENVELOPE_ASCII}</GoCodeBlock>

              <ul className="guide-bullets-list">
                <li>
                  <span className="highlight-text">recordLen (4 bytes)</span>: Length of checksum + payload combined. So recordLen = 4 + len(payload).
                </li>
                <li>
                  <span className="highlight-text">checksum (4 bytes)</span>: CRC32-IEEE computed over the payload bytes only.
                </li>
                <li>
                  <span className="highlight-text">payload (variable)</span>: Starts with a 1-byte command tag, followed by tag-specific data.
                </li>
              </ul>

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>2.1 Go Implementation: Record Encoding</h3>
              <GoCodeBlock>{`func encodeRecord(payload []byte) []byte {
    checksum := crc32.ChecksumIEEE(payload)
    recordLen := uint32(len(payload) + 4)
    buf := make([]byte, 4+4+len(payload))
    binary.BigEndian.PutUint32(buf[0:4], recordLen)
    binary.BigEndian.PutUint32(buf[4:8], checksum)
    copy(buf[8:], payload)
    return buf
}`}</GoCodeBlock>

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>2.2 Go Implementation: Record Decoding</h3>
              <GoCodeBlock>{`func decodeRecord(data []byte) (payload []byte, err error) {
    if len(data) < 8 {
        return nil, io.ErrUnexpectedEOF
    }
    recordLen := binary.BigEndian.Uint32(data[0:4])
    if recordLen < 4 {
        return nil, io.ErrUnexpectedEOF
    }
    total := int(4 + recordLen)
    if len(data) < total {
        return nil, io.ErrUnexpectedEOF
    }
    checksum := binary.BigEndian.Uint32(data[4:8])
    payload = data[8:total]
    if crc32.ChecksumIEEE(payload) != checksum {
        return nil, io.ErrUnexpectedEOF
    }
    return payload, nil
}`}</GoCodeBlock>

              {/* ── 3. Edit Tags ── */}
              <h2 className="guide-sub-heading" id="edit-tags" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                3. Edit Tag Payloads
              </h2>
              <p>The first byte of every payload is a command tag. PebbleDB defines three tags:</p>

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>3.1 tagNewFile (0x01) — Add a Live SSTable</h3>
              <p>Written after a flush or compaction adds a new SSTable.</p>
              <GoCodeBlock>{TAG_NEW_FILE_ASCII}</GoCodeBlock>
              <p>Payload size: 9 bytes.</p>
              <GoCodeBlock>{`const (
    tagNewFile    byte = 0x01
    tagDeleteFile byte = 0x02
    tagSetFileSet byte = 0x03
)

func encodeNewFile(sstID uint64) []byte {
    payload := make([]byte, 1+8)
    payload[0] = tagNewFile
    binary.BigEndian.PutUint64(payload[1:9], sstID)
    return encodeRecord(payload)
}`}</GoCodeBlock>

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>3.2 tagDeleteFile (0x02) — Remove an SSTable</h3>
              <p>Written when compaction removes an obsolete SSTable.</p>
              <GoCodeBlock>{TAG_DELETE_FILE_ASCII}</GoCodeBlock>
              <p>Payload size: 9 bytes. Format is identical to tagNewFile; semantics differ.</p>

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>3.3 tagSetFileSet (0x03) — Snapshot Replace</h3>
              <p>Written during manifest rotation. Replaces the entire live set atomically.</p>
              <GoCodeBlock>{TAG_SET_FILESET_ASCII}</GoCodeBlock>
              <p>Payload size: 1 + 4 + (count × 8) bytes.</p>
              <GoCodeBlock>{`func encodeSetFileSet(ids []uint64) []byte {
    payload := make([]byte, 1+4+8*len(ids))
    payload[0] = tagSetFileSet
    binary.BigEndian.PutUint32(payload[1:5], uint32(len(ids)))
    for i, id := range ids {
        binary.BigEndian.PutUint64(payload[5+i*8:5+(i+1)*8], id)
    }
    return encodeRecord(payload)
}`}</GoCodeBlock>

              {/* ── 4. Edit State Machine ── */}
              <h2 className="guide-sub-heading" id="edit-state-machine" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                4. Edit Application State Machine
              </h2>
              <DocsMermaid chart={EDIT_STATE_MACHINE_CHART} />

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>4.1 Go Implementation</h3>
              <GoCodeBlock>{`func applyEdit(liveSet map[uint64]struct{}, payload []byte) error {
    if len(payload) < 1 {
        return io.ErrUnexpectedEOF
    }
    switch payload[0] {
    case tagNewFile:
        if len(payload) < 9 { return io.ErrUnexpectedEOF }
        id := binary.BigEndian.Uint64(payload[1:9])
        liveSet[id] = struct{}{}
    case tagDeleteFile:
        if len(payload) < 9 { return io.ErrUnexpectedEOF }
        id := binary.BigEndian.Uint64(payload[1:9])
        delete(liveSet, id)
    case tagSetFileSet:
        if len(payload) < 5 { return io.ErrUnexpectedEOF }
        count := binary.BigEndian.Uint32(payload[1:5])
        need := 5 + int(count)*8
        if len(payload) < need { return io.ErrUnexpectedEOF }
        next := make(map[uint64]struct{}, count)
        for i := uint32(0); i < count; i++ {
            id := binary.BigEndian.Uint64(payload[5+i*8 : 5+(i+1)*8])
            next[id] = struct{}{}
        }
        clear(liveSet)
        for id := range next {
            liveSet[id] = struct{}{}
        }
    default:
        return io.ErrUnexpectedEOF
    }
    return nil
}`}</GoCodeBlock>

              {/* ── 5. Replay ── */}
              <h2 className="guide-sub-heading" id="replay" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                5. Manifest Replay &amp; Tail Salvaging
              </h2>
              <p>On database open, PebbleDB replays the manifest to reconstruct the live SSTable set:</p>
              <DocsMermaid chart={REPLAY_CHART} />

              {/* ── 6. Rotation ── */}
              <h2 className="guide-sub-heading" id="rotation" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                6. Log Rotation Protocol
              </h2>
              <p>When the manifest exceeds thresholds (≥ 64 records or ≥ 64 KiB), it is compacted:</p>
              <DocsMermaid chart={ROTATION_CHART} />

              <div style={{ overflowX: "auto", marginTop: 16, marginBottom: 20 }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={theadRowStyle}>
                      <th style={thStyle}>Rotation Threshold</th>
                      <th style={thStyle}>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>Record count</td>
                      <td style={tdMonoStyle}>≥ 64 records</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>File size</td>
                      <td style={tdMonoStyle}>≥ 64 KiB</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* ── 7. CURRENT Pointer ── */}
              <h2 className="guide-sub-heading" id="current-pointer" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                7. CURRENT Pointer File
              </h2>
              <p>
                The CURRENT file is a single-line text file containing the active manifest filename (e.g., <span className="highlight-text">MANIFEST-000001\n</span>). It is updated atomically via write-to-temp + fsync + rename:
              </p>
              <GoCodeBlock>{`func writeCurrent(dir, manifestFile string) error {
    currentPath := filepath.Join(dir, currentFileName)
    tmpPath := currentPath + ".tmp"
    f, err := os.OpenFile(tmpPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0644)
    if err != nil { return err }
    content := []byte(manifestFile + "\\n")
    if _, err := f.Write(content); err != nil {
        f.Close(); os.Remove(tmpPath); return err
    }
    if err := f.Sync(); err != nil {
        f.Close(); os.Remove(tmpPath); return err
    }
    f.Close()
    return os.Rename(tmpPath, currentPath)
}`}</GoCodeBlock>

              {/* ── 8. Walkthrough ── */}
              <h2 className="guide-sub-heading" id="walkthrough" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                8. Walkthrough: Manifest After Three Flushes
              </h2>

              <div style={{ overflowX: "auto", marginTop: 16, marginBottom: 20 }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={theadRowStyle}>
                      <th style={thStyle}>Record #</th>
                      <th style={thStyle}>Tag</th>
                      <th style={thStyle}>Payload</th>
                      <th style={thStyle}>Live Set After</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdMonoStyle}>1</td>
                      <td style={tdMonoStyle}>0x01 NewFile</td>
                      <td style={tdStyle}>SST ID = 1</td>
                      <td style={tdMonoStyle}>{"{1}"}</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdMonoStyle}>2</td>
                      <td style={tdMonoStyle}>0x01 NewFile</td>
                      <td style={tdStyle}>SST ID = 2</td>
                      <td style={tdMonoStyle}>{"{1, 2}"}</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdMonoStyle}>3</td>
                      <td style={tdMonoStyle}>0x01 NewFile</td>
                      <td style={tdStyle}>SST ID = 3</td>
                      <td style={tdMonoStyle}>{"{1, 2, 3}"}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <p>After a compaction merges SST 1 + SST 2 → SST 4:</p>

              <div style={{ overflowX: "auto", marginTop: 16, marginBottom: 20 }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={theadRowStyle}>
                      <th style={thStyle}>Record #</th>
                      <th style={thStyle}>Tag</th>
                      <th style={thStyle}>Payload</th>
                      <th style={thStyle}>Live Set After</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdMonoStyle}>4</td>
                      <td style={tdMonoStyle}>0x01 NewFile</td>
                      <td style={tdStyle}>SST ID = 4</td>
                      <td style={tdMonoStyle}>{"{1, 2, 3, 4}"}</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdMonoStyle}>5</td>
                      <td style={tdMonoStyle}>0x02 DeleteFile</td>
                      <td style={tdStyle}>SST ID = 1</td>
                      <td style={tdMonoStyle}>{"{2, 3, 4}"}</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdMonoStyle}>6</td>
                      <td style={tdMonoStyle}>0x02 DeleteFile</td>
                      <td style={tdStyle}>SST ID = 2</td>
                      <td style={tdMonoStyle}>{"{3, 4}"}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <p>If rotation triggers at this point, the new manifest contains a single record:</p>

              <div style={{ overflowX: "auto", marginTop: 16, marginBottom: 20 }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={theadRowStyle}>
                      <th style={thStyle}>Record #</th>
                      <th style={thStyle}>Tag</th>
                      <th style={thStyle}>Payload</th>
                      <th style={thStyle}>Live Set After</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdMonoStyle}>1</td>
                      <td style={tdMonoStyle}>0x03 SetFileSet</td>
                      <td style={tdStyle}>Count=2, IDs=[3, 4]</td>
                      <td style={tdMonoStyle}>{"{3, 4}"}</td>
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

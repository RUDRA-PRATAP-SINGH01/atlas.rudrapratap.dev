import DocsNavbar from "@/components/docs/DocsNavbar";
import DocsSidebar from "@/components/docs/DocsSidebar";
import DocsMermaid from "@/components/docs/DocsMermaid";
import GoCodeBlock from "@/components/docs/GoCodeBlock";

const pageTopics = [
  { label: "Purpose", href: "#purpose" },
  { label: "Binary Field Map", href: "#binary-map" },
  { label: "Encoding Pipeline", href: "#encoding" },
  { label: "Decoding Pipeline", href: "#decoding" },
  { label: "Size Limit Boundaries", href: "#size-limits" },
  { label: "Walkthrough: Concrete Encoding Example", href: "#walkthrough" },
];

const BINARY_FIELD_MAP_DIAGRAM = `Byte Offset    Field           Size          Encoding         Description
───────────    ─────           ────          ────────         ───────────
0              keyLen          4 bytes       Big-Endian U32   Length of the key payload
4              key             keyLen bytes  Raw bytes        Key data
4+keyLen       valueLen        4 bytes       Big-Endian U32   Length of the value payload
8+keyLen       value           valueLen B    Raw bytes        Value data (empty for deletes)
8+keyLen+valL  tombstone       1 byte        0x00 or 0x01     0 = Put, 1 = Delete
9+keyLen+valL  crc32           4 bytes       Big-Endian U32   CRC32-IEEE over bytes [0, 9+kL+vL)`;

const ENCODING_PIPELINE_CHART = `flowchart TD
    A["Record{Key, Value, Tombstone}"] --> B["validateRecord(keyLen, valueLen)"]
    B --> C{"Pass?"}
    C -->|fail| D["return ErrKeyTooLarge / ErrValueTooLarge"]
    C -->|pass| E["Write keyLen (4B BE)"]
    E --> F["Append key bytes"]
    F --> G["Write valueLen (4B BE)"]
    G --> H["Append value bytes"]
    H --> I["Append tombstone byte"]
    I --> J["CRC32-IEEE over all preceding bytes"]
    J --> K["Append checksum (4B BE)"]
    K --> L["Return encoded []byte"]`;

const DECODING_PIPELINE_CHART = `flowchart TD
    A["readOneRecord(file, limits)"] --> B["binary.Read → keyLen (4B)"]
    B --> C{"keyLen > MaxKeySize?"}
    C -->|yes| D["return ErrKeyTooLarge"]
    C -->|no| E["io.ReadFull → key (keyLen B)"]
    E --> F["binary.Read → valueLen (4B)"]
    F --> G{"valueLen > MaxValueSize?"}
    G -->|yes| H["return ErrValueTooLarge"]
    G -->|no| I["limits.validateRecord(keyLen, valueLen)"]
    I --> J["io.ReadFull → value (valueLen B)"]
    J --> K["binary.Read → tombByte (1B)"]
    K --> L["binary.Read → checksum (4B)"]
    L --> M["Recompute CRC32-IEEE over [keyLen..tombByte]"]
    M --> N{"computed == stored?"}
    N -->|no| O["return io.ErrUnexpectedEOF"]
    N -->|yes| P["return Record{Key, Value, Tombstone}"]`;

const ENCODE_RECORD_CODE = `func encodeRecord(rec Record, limits ReplayLimits) ([]byte, error) {
    keyLen := len(rec.Key)
    valueLen := len(rec.Value)
    if err := limits.validateRecord(uint32(keyLen), uint32(valueLen)); err != nil {
        return nil, err
    }
    tombByte := byte(0)
    if rec.Tombstone {
        tombByte = 1
    }
    buf := make([]byte, 0, 4+keyLen+4+valueLen+1+4)
    buf = binary.BigEndian.AppendUint32(buf, uint32(keyLen))
    buf = append(buf, rec.Key...)
    buf = binary.BigEndian.AppendUint32(buf, uint32(valueLen))
    buf = append(buf, rec.Value...)
    buf = append(buf, tombByte)
    checksum := crc32.ChecksumIEEE(buf)
    buf = binary.BigEndian.AppendUint32(buf, checksum)
    return buf, nil
}`;

const READ_ONE_RECORD_CODE = `func readOneRecord(f *os.File, limits ReplayLimits) (Record, int64, error) {
    start, _ := f.Seek(0, io.SeekCurrent)
    var keyLen uint32
    if err := binary.Read(f, binary.BigEndian, &keyLen); err != nil {
        return Record{}, 0, err
    }
    if keyLen > limits.MaxKeySize {
        return Record{}, 0, ErrKeyTooLarge
    }
    key := make([]byte, keyLen)
    if _, err := io.ReadFull(f, key); err != nil {
        return Record{}, 0, mapRecordEOF(err, start)
    }
    var valueLen uint32
    if err := binary.Read(f, binary.BigEndian, &valueLen); err != nil {
        return Record{}, 0, mapRecordEOF(err, start)
    }
    if valueLen > limits.MaxValueSize {
        return Record{}, 0, ErrValueTooLarge
    }
    if err := limits.validateRecord(keyLen, valueLen); err != nil {
        return Record{}, 0, err
    }
    value := make([]byte, valueLen)
    if _, err := io.ReadFull(f, value); err != nil {
        return Record{}, 0, mapRecordEOF(err, start)
    }
    var tombByte byte
    binary.Read(f, binary.BigEndian, &tombByte)
    var checksum uint32
    binary.Read(f, binary.BigEndian, &checksum)
    end, _ := f.Seek(0, io.SeekCurrent)
    // Recompute CRC over all fields except the checksum itself
    buf := make([]byte, 0, 4+int(keyLen)+4+int(valueLen)+1)
    buf = binary.BigEndian.AppendUint32(buf, keyLen)
    buf = append(buf, key...)
    buf = binary.BigEndian.AppendUint32(buf, valueLen)
    buf = append(buf, value...)
    buf = append(buf, tombByte)
    if crc32.ChecksumIEEE(buf) != checksum {
        return Record{}, 0, io.ErrUnexpectedEOF
    }
    return Record{
        Key: key, Value: value, Tombstone: tombByte == 1,
    }, end - start, nil
}`;

const VALIDATE_RECORD_CODE = `const recordHeaderSize = 4 + 4 + 1 + 4  // keyLen + valueLen + tombstone + crc32

func (l ReplayLimits) validateRecord(keyLen, valueLen uint32) error {
    if keyLen > l.MaxKeySize {
        return ErrKeyTooLarge
    }
    if valueLen > l.MaxValueSize {
        return ErrValueTooLarge
    }
    recSize := uint64(recordHeaderSize) + uint64(keyLen) + uint64(valueLen)
    if recSize > uint64(l.MaxRecordSize) {
        return ErrRecordTooLarge
    }
    return nil
}`;

export default function WalRecordFormatDocsPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="wal-record-format-title">
              PebbleDB Format Specification: WAL Record Format
            </h1>

            <div className="guide-body-text" style={{ marginTop: 24 }}>
              <p>
                This document specifies the binary record format used by PebbleDB&apos;s Write-Ahead Log,
                detailing every field, byte offset, encoding/decoding logic, CRC integrity checks, and
                size validation boundaries.
              </p>

              {/* ── 1. Purpose ── */}
              <h2
                className="guide-sub-heading"
                id="purpose"
                style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}
              >
                1. Purpose
              </h2>
              <p>
                Every <span className="highlight-text">Put</span> and{" "}
                <span className="highlight-text">Delete</span> operation is serialized into a WAL record
                before being committed to the active memtable. The record format is designed to be:
              </p>
              <ul className="guide-bullets-list">
                <li>
                  <span className="highlight-text">Self-contained</span>: Each record carries all
                  information needed to reconstruct the mutation.
                </li>
                <li>
                  <span className="highlight-text">Integrity-checked</span>: A trailing CRC32-IEEE
                  checksum detects corruption during replay.
                </li>
                <li>
                  <span className="highlight-text">Compact</span>: No padding, alignment, or framing
                  beyond the length-prefix fields.
                </li>
              </ul>

              {/* ── 2. Binary Field Map ── */}
              <h2
                className="guide-sub-heading"
                id="binary-map"
                style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}
              >
                2. Binary Field Map
              </h2>
              <p>
                Each record is a contiguous byte sequence with no separators:
              </p>

              <GoCodeBlock>{BINARY_FIELD_MAP_DIAGRAM}</GoCodeBlock>

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>
                2.1 Total Record Size Formula
              </h3>
              <p>
                The fixed overhead per record is 13 bytes (two 4-byte length fields + 1-byte tombstone
                + 4-byte checksum). Total size is computed as:
              </p>
              <pre
                className="guide-code-pre"
                style={{ background: "#18181b", padding: "12px", borderRadius: "6px", overflowX: "auto", marginTop: 8, marginBottom: 16 }}
              >
                <code className="guide-code-lines">{`RecordSize = 13 + keyLen + valueLen`}</code>
              </pre>
              <p>
                Equivalently:{" "}
                <code className="inline-code">{`4 + keyLen + 4 + valueLen + 1 + 4 = 13 + keyLen + valueLen`}</code>
              </p>

              {/* ── 3. Encoding Pipeline ── */}
              <h2
                className="guide-sub-heading"
                id="encoding"
                style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}
              >
                3. Encoding Pipeline
              </h2>
              <p>
                Serialization follows a strict validation-then-write sequence enforced by{" "}
                <span className="highlight-text">encodeRecord</span>:
              </p>

              <DocsMermaid chart={ENCODING_PIPELINE_CHART} />

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>
                3.1 Go Implementation: Encoding
              </h3>
              <GoCodeBlock>{ENCODE_RECORD_CODE}</GoCodeBlock>

              {/* ── 4. Decoding Pipeline ── */}
              <h2
                className="guide-sub-heading"
                id="decoding"
                style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}
              >
                4. Decoding Pipeline
              </h2>
              <p>
                During WAL replay, each record is parsed field-by-field with size checks and CRC
                verification via <span className="highlight-text">readOneRecord</span>:
              </p>

              <DocsMermaid chart={DECODING_PIPELINE_CHART} />

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>
                4.1 Go Implementation: Decoding
              </h3>
              <GoCodeBlock>{READ_ONE_RECORD_CODE}</GoCodeBlock>

              {/* ── 5. Size Limit Boundaries ── */}
              <h2
                className="guide-sub-heading"
                id="size-limits"
                style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}
              >
                5. Size Limit Boundaries
              </h2>
              <p>
                To prevent corrupted file headers from triggering large memory allocations, the WAL
                enforces size limits (<span className="highlight-text">ReplayLimits</span>) during both
                writes and replay:
              </p>

              <div style={{ overflowX: "auto", marginTop: 16, marginBottom: 20 }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    textAlign: "left",
                    fontSize: 13,
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        background: "rgba(255, 92, 173, 0.08)",
                        borderBottom: "1px solid rgba(255, 255, 255, 0.15)",
                      }}
                    >
                      <th style={{ padding: "10px 16px", color: "#ff5cad", fontWeight: 600 }}>Limit</th>
                      <th style={{ padding: "10px 16px", color: "#ff5cad", fontWeight: 600 }}>Constant</th>
                      <th style={{ padding: "10px 16px", color: "#ff5cad", fontWeight: 600 }}>Default</th>
                      <th style={{ padding: "10px 16px", color: "#ff5cad", fontWeight: 600 }}>Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      style={{
                        borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
                        background: "rgba(255, 255, 255, 0.02)",
                      }}
                    >
                      <td style={{ padding: "10px 16px", fontWeight: 500, color: "#ffffff" }}>
                        Max WAL file size
                      </td>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace" }}>DefaultMaxWALFileSize</td>
                      <td style={{ padding: "10px 16px" }}>64 MiB</td>
                      <td style={{ padding: "10px 16px" }}>ErrWALTooLarge</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={{ padding: "10px 16px", fontWeight: 500, color: "#ffffff" }}>Max key size</td>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace" }}>DefaultMaxKeySize</td>
                      <td style={{ padding: "10px 16px" }}>1 MiB</td>
                      <td style={{ padding: "10px 16px" }}>ErrKeyTooLarge</td>
                    </tr>
                    <tr
                      style={{
                        borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
                        background: "rgba(255, 255, 255, 0.02)",
                      }}
                    >
                      <td style={{ padding: "10px 16px", fontWeight: 500, color: "#ffffff" }}>Max value size</td>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace" }}>DefaultMaxValueSize</td>
                      <td style={{ padding: "10px 16px" }}>16 MiB</td>
                      <td style={{ padding: "10px 16px" }}>ErrValueTooLarge</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={{ padding: "10px 16px", fontWeight: 500, color: "#ffffff" }}>Max record size</td>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace" }}>DefaultMaxRecordSize</td>
                      <td style={{ padding: "10px 16px" }}>17 MiB</td>
                      <td style={{ padding: "10px 16px" }}>ErrRecordTooLarge</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>
                5.1 Go Implementation: Validation
              </h3>
              <GoCodeBlock>{VALIDATE_RECORD_CODE}</GoCodeBlock>

              {/* ── 6. Walkthrough ── */}
              <h2
                className="guide-sub-heading"
                id="walkthrough"
                style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}
              >
                6. Walkthrough: Concrete Encoding Example
              </h2>
              <p>
                Encoding <span className="highlight-text">Put(&quot;hello&quot;, &quot;world&quot;)</span>:
              </p>

              <div style={{ overflowX: "auto", marginTop: 16, marginBottom: 20 }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    textAlign: "left",
                    fontSize: 13,
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        background: "rgba(255, 92, 173, 0.08)",
                        borderBottom: "1px solid rgba(255, 255, 255, 0.15)",
                      }}
                    >
                      <th style={{ padding: "10px 16px", color: "#ff5cad", fontWeight: 600 }}>Step</th>
                      <th style={{ padding: "10px 16px", color: "#ff5cad", fontWeight: 600 }}>Field</th>
                      <th style={{ padding: "10px 16px", color: "#ff5cad", fontWeight: 600 }}>Hex Bytes</th>
                      <th style={{ padding: "10px 16px", color: "#ff5cad", fontWeight: 600 }}>Decimal</th>
                      <th style={{ padding: "10px 16px", color: "#ff5cad", fontWeight: 600 }}>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      style={{
                        borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
                        background: "rgba(255, 255, 255, 0.02)",
                      }}
                    >
                      <td style={{ padding: "10px 16px", fontWeight: 500, color: "#ffffff" }}>1</td>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace" }}>keyLen</td>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace" }}>00 00 00 05</td>
                      <td style={{ padding: "10px 16px" }}>5</td>
                      <td style={{ padding: "10px 16px" }}>Key is 5 bytes</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={{ padding: "10px 16px", fontWeight: 500, color: "#ffffff" }}>2</td>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace" }}>key</td>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace" }}>68 65 6C 6C 6F</td>
                      <td style={{ padding: "10px 16px" }}>—</td>
                      <td style={{ padding: "10px 16px" }}>ASCII &quot;hello&quot;</td>
                    </tr>
                    <tr
                      style={{
                        borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
                        background: "rgba(255, 255, 255, 0.02)",
                      }}
                    >
                      <td style={{ padding: "10px 16px", fontWeight: 500, color: "#ffffff" }}>3</td>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace" }}>valueLen</td>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace" }}>00 00 00 05</td>
                      <td style={{ padding: "10px 16px" }}>5</td>
                      <td style={{ padding: "10px 16px" }}>Value is 5 bytes</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={{ padding: "10px 16px", fontWeight: 500, color: "#ffffff" }}>4</td>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace" }}>value</td>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace" }}>77 6F 72 6C 64</td>
                      <td style={{ padding: "10px 16px" }}>—</td>
                      <td style={{ padding: "10px 16px" }}>ASCII &quot;world&quot;</td>
                    </tr>
                    <tr
                      style={{
                        borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
                        background: "rgba(255, 255, 255, 0.02)",
                      }}
                    >
                      <td style={{ padding: "10px 16px", fontWeight: 500, color: "#ffffff" }}>5</td>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace" }}>tombstone</td>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace" }}>00</td>
                      <td style={{ padding: "10px 16px" }}>0</td>
                      <td style={{ padding: "10px 16px" }}>Put operation</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={{ padding: "10px 16px", fontWeight: 500, color: "#ffffff" }}>6</td>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace" }}>crc32</td>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace" }}>XX XX XX XX</td>
                      <td style={{ padding: "10px 16px" }}>—</td>
                      <td style={{ padding: "10px 16px" }}>CRC32-IEEE over bytes 1–5</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <p>
                Total record size:{" "}
                <code className="inline-code">{`4 + 5 + 4 + 5 + 1 + 4 = 23 bytes`}</code> (equivalently{" "}
                <code className="inline-code">{`RecordSize = 13 + keyLen + valueLen = 13 + 5 + 5 = 23`}</code>
                ).
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

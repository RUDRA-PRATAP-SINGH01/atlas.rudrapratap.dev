import DocsNavbar from "@/components/docs/DocsNavbar";
import DocsSidebar from "@/components/docs/DocsSidebar";
import DocsMermaid from "@/components/docs/DocsMermaid";
import GoCodeBlock from "@/components/docs/GoCodeBlock";

const pageTopics = [
  { label: "Purpose", href: "#purpose" },
  { label: "Data Block Entry Format", href: "#data-block-entry" },
  { label: "Block Iteration State Machine", href: "#iteration" },
  { label: "Block Seek Algorithm", href: "#seek" },
  { label: "Index Block Entry Format", href: "#index-block" },
  { label: "Block Lookup via Index", href: "#block-lookup" },
  { label: "Walkthrough", href: "#walkthrough" },
];

const DATA_BLOCK_ENTRY_ASCII = `┌───────────────┬─────────────────┬─────────────────┬───────────────────┬────────────────┐
│  keyLen (4B)  │  key (keyLen B) │  valueLen (4B)  │ value (valueLen B)│ tombstone (1B) │
│  Big-Endian   │  Raw bytes      │  Big-Endian     │  Raw bytes        │ 0x00 or 0x01   │
└───────────────┴─────────────────┴─────────────────┴───────────────────┴────────────────┘
│◄──────────────────── Entry N ─────────────────────────────────────────►│
│◄──── Entry N+1 ──────────────────────────── ...`;

const INDEX_BLOCK_ENTRY_ASCII = `┌───────────────┬─────────────────┬─────────────────┬─────────────────┐
│  keyLen (4B)  │ lastKey (keyLen)│  offset (8B)    │  length (8B)    │
│  Big-Endian   │  Raw bytes      │  Big-Endian U64 │  Big-Endian U64 │
└───────────────┴─────────────────┴─────────────────┴─────────────────┘
│◄────────────────────── Index Entry ──────────────────────────────────►│`;

const ITERATION_STATE_MACHINE_CHART = `flowchart TD
    A["BlockIterator.Next()"] --> B{"pos + 4 <= len(data)?"}
    B -->|no| Z["return false"]
    B -->|yes| C["keyLen = BigEndian.U32(data[pos:])"]
    C --> D["pos += 4"]
    D --> E{"pos + keyLen <= len(data)?"}
    E -->|no| Z
    E -->|yes| F["key = data[pos : pos+keyLen]"]
    F --> G["pos += keyLen"]
    G --> H{"pos + 4 <= len(data)?"}
    H -->|no| Z
    H -->|yes| I["valLen = BigEndian.U32(data[pos:])"]
    I --> J["pos += 4"]
    J --> K{"pos + valLen <= len(data)?"}
    K -->|no| Z
    K -->|yes| L["val = data[pos : pos+valLen]"]
    L --> M["pos += valLen"]
    M --> N{"pos < len(data)?"}
    N -->|no| Z
    N -->|yes| O["tombstone = data[pos] == 1"]
    O --> P["pos += 1"]
    P --> Q["return true"]`;

const BLOCK_LOOKUP_CHART = `flowchart LR
    KEY["Target key"] --> BSEARCH["sort.Search: first index entry where LastKey gte key"]
    BSEARCH -->|idx equals len index| NOT_FOUND["Key greater than all blocks — absent"]
    BSEARCH -->|idx found| LOAD["readBlock(index idx Offset, index idx Length)"]
    LOAD --> SCAN["BlockIterator linear scan within block"]`;

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

export default function BlockFormatDocsPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="block-format-title">
              PebbleDB Format Specification: Block Format
            </h1>

            <div className="guide-body-text" style={{ marginTop: 24 }}>
              <p>
                This document specifies the binary format of PebbleDB&apos;s SSTable data blocks and index blocks, detailing entry encoding, iteration state machines, seek algorithms, and block-level I/O boundaries.
              </p>

              {/* ── 1. Purpose ── */}
              <h2 className="guide-sub-heading" id="purpose" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                1. Purpose
              </h2>
              <p>
                SSTables partition sorted key-value entries into fixed-size data blocks (default <span className="highlight-text">4 KiB</span>). Each block is an independently readable unit — the reader can load a single block from disk without parsing the entire file. This design enables:
              </p>
              <ul className="guide-bullets-list">
                <li><span className="highlight-text">Selective I/O</span>: Only the block containing the target key is read.</li>
                <li><span className="highlight-text">Block-level caching</span>: The LRU cache stores individual blocks, not entire files.</li>
                <li><span className="highlight-text">Streaming writes</span>: The writer flushes blocks incrementally as they fill.</li>
              </ul>

              {/* ── 2. Data Block Entry Format ── */}
              <h2 className="guide-sub-heading" id="data-block-entry" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                2. Data Block Entry Format
              </h2>
              <p>
                Within a data block, entries are stored sequentially without prefix compression or separators:
              </p>

              <GoCodeBlock>{DATA_BLOCK_ENTRY_ASCII}</GoCodeBlock>

              <p>
                Entry size formula:{" "}
                <span className="highlight-text">{`4 + keyLen + 4 + valueLen + 1`}</span>
              </p>

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>
                2.1 Go Implementation: Block Append
              </h3>
              <GoCodeBlock>{`type Block struct {
    data []byte
}

func (b *Block) Append(key, value []byte, tombstone bool) error {
    if len(key) > math.MaxUint32 || len(value) > math.MaxUint32 {
        return ErrKeyTooLarge
    }
    keyLen := uint32(len(key))
    valLen := uint32(len(value))
    tombByte := byte(0)
    if tombstone {
        tombByte = 1
    }
    buf := make([]byte, 0, 4+keyLen+4+valLen+1)
    buf = binary.BigEndian.AppendUint32(buf, keyLen)
    buf = append(buf, key...)
    buf = binary.BigEndian.AppendUint32(buf, valLen)
    buf = append(buf, value...)
    buf = append(buf, tombByte)
    b.data = append(b.data, buf...)
    return nil
}`}</GoCodeBlock>

              {/* ── 3. Block Iteration ── */}
              <h2 className="guide-sub-heading" id="iteration" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                3. Block Iteration State Machine
              </h2>
              <p>
                The <span className="highlight-text">BlockIterator</span> reads entries one at a time using a position cursor (<span className="highlight-text">pos</span>) that advances through the raw byte slice:
              </p>

              <DocsMermaid chart={ITERATION_STATE_MACHINE_CHART} />

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>
                3.1 Go Implementation: Block Iterator
              </h3>
              <GoCodeBlock>{`type BlockIterator struct {
    data      []byte
    pos       int
    key       []byte
    val       []byte
    tombstone bool
}

func (it *BlockIterator) Next() bool {
    if it.pos+4 > len(it.data) { return false }
    keyLen := binary.BigEndian.Uint32(it.data[it.pos:])
    it.pos += 4
    if it.pos+int(keyLen) > len(it.data) { return false }
    it.key = it.data[it.pos : it.pos+int(keyLen)]
    it.pos += int(keyLen)
    if it.pos+4 > len(it.data) { return false }
    valLen := binary.BigEndian.Uint32(it.data[it.pos:])
    it.pos += 4
    if it.pos+int(valLen) > len(it.data) { return false }
    it.val = it.data[it.pos : it.pos+int(valLen)]
    it.pos += int(valLen)
    if it.pos >= len(it.data) { return false }
    tombByte := it.data[it.pos]
    it.pos += 1
    it.tombstone = tombByte == 1
    return true
}`}</GoCodeBlock>

              {/* ── 4. Block Seek ── */}
              <h2 className="guide-sub-heading" id="seek" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                4. Block Seek Algorithm
              </h2>
              <p>
                <span className="highlight-text">Seek(target)</span> resets the iterator to position 0 and performs a linear scan until it finds the first key ≥ target:
              </p>

              <GoCodeBlock>{`func (it *BlockIterator) Seek(key []byte) bool {
    it.pos = 0
    it.key = nil
    it.val = nil
    it.tombstone = false
    for it.Next() {
        if bytes.Compare(it.key, key) >= 0 {
            return true
        }
    }
    it.key = nil
    it.val = nil
    return false
}`}</GoCodeBlock>

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
                  <span style={{ color: "#ff5cad", fontWeight: 600 }}>TIP</span> — Since entries within a block are sorted, a binary search would be theoretically faster. However, blocks are small (≤ 4 KiB), containing typically 20–100 entries. Linear scan over a contiguous memory region is cache-friendly and fast in practice.
                </p>
              </div>

              {/* ── 5. Index Block ── */}
              <h2 className="guide-sub-heading" id="index-block" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                5. Index Block Entry Format
              </h2>
              <p>
                The index block stores one entry per data block. Each entry maps a block&apos;s last key (the largest key in that block) to its file offset and byte length:
              </p>

              <GoCodeBlock>{INDEX_BLOCK_ENTRY_ASCII}</GoCodeBlock>

              <p>
                Index entry size formula:{" "}
                <span className="highlight-text">{`4 + keyLen + 8 + 8`}</span>
              </p>

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>
                5.1 Go Implementation: Index Types
              </h3>
              <GoCodeBlock>{`type IndexEntry struct {
    LastKey []byte
    Offset  uint64
    Length  uint64
}

type IndexBlock struct {
    entries []IndexEntry
}`}</GoCodeBlock>

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>
                5.2 Go Implementation: Index Encoding
              </h3>
              <GoCodeBlock>{`func (idx *IndexBlock) Encode() []byte {
    buf := make([]byte, 0)
    for _, e := range idx.entries {
        keyLen := uint32(len(e.LastKey))
        buf = binary.BigEndian.AppendUint32(buf, keyLen)
        buf = append(buf, e.LastKey...)
        buf = binary.BigEndian.AppendUint64(buf, e.Offset)
        buf = binary.BigEndian.AppendUint64(buf, e.Length)
    }
    return buf
}`}</GoCodeBlock>

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>
                5.3 Go Implementation: Index Decoding
              </h3>
              <GoCodeBlock>{`func decodeIndex(data []byte) ([]IndexEntry, error) {
    var entries []IndexEntry
    pos := 0
    for pos < len(data) {
        if pos+4 > len(data) { return nil, ErrCorruptIndex }
        keyLen := binary.BigEndian.Uint32(data[pos:])
        pos += 4
        if pos+int(keyLen) > len(data) { return nil, ErrCorruptIndex }
        lastKey := data[pos : pos+int(keyLen)]
        pos += int(keyLen)
        if pos+16 > len(data) { return nil, ErrCorruptIndex }
        offset := binary.BigEndian.Uint64(data[pos:])
        pos += 8
        length := binary.BigEndian.Uint64(data[pos:])
        pos += 8
        entries = append(entries, IndexEntry{
            LastKey: append([]byte(nil), lastKey...),
            Offset:  offset,
            Length:  length,
        })
    }
    return entries, nil
}`}</GoCodeBlock>

              {/* ── 6. Block Lookup ── */}
              <h2 className="guide-sub-heading" id="block-lookup" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                6. Block Lookup via Index: Binary Search
              </h2>
              <p>
                When performing a point lookup, the reader uses <span className="highlight-text">sort.Search</span> on the index to find the candidate block in O(log B) time where B is the number of blocks:
              </p>

              <DocsMermaid chart={BLOCK_LOOKUP_CHART} />

              {/* ── 7. Walkthrough ── */}
              <h2 className="guide-sub-heading" id="walkthrough" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                7. Walkthrough: A Block With 3 Entries
              </h2>
              <p>
                Consider a block containing Put(&quot;cat&quot;, &quot;meow&quot;), Put(&quot;dog&quot;, &quot;woof&quot;), Delete(&quot;fish&quot;):
              </p>

              <div style={{ overflowX: "auto", marginTop: 16, marginBottom: 20 }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={theadRowStyle}>
                      <th style={thStyle}>Offset</th>
                      <th style={thStyle}>Field</th>
                      <th style={thStyle}>Hex</th>
                      <th style={thStyle}>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["0", "keyLen", "00 00 00 03", "3"],
                      ["4", "key", "63 61 74", '"cat"'],
                      ["7", "valueLen", "00 00 00 04", "4"],
                      ["11", "value", "6D 65 6F 77", '"meow"'],
                      ["15", "tombstone", "00", "Put"],
                      ["16", "keyLen", "00 00 00 03", "3"],
                      ["20", "key", "64 6F 67", '"dog"'],
                      ["23", "valueLen", "00 00 00 04", "4"],
                      ["27", "value", "77 6F 6F 66", '"woof"'],
                      ["31", "tombstone", "00", "Put"],
                      ["32", "keyLen", "00 00 00 04", "4"],
                      ["36", "key", "66 69 73 68", '"fish"'],
                      ["40", "valueLen", "00 00 00 00", "0"],
                      ["44", "value", "(empty)", "—"],
                      ["44", "tombstone", "01", "Delete"],
                    ].map(([offset, field, hex, value], i) => (
                      <tr
                        key={`${offset}-${field}`}
                        style={{
                          borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
                          background: i % 2 === 0 ? "rgba(255, 255, 255, 0.02)" : "transparent",
                        }}
                      >
                        <td style={tdMonoStyle}>{offset}</td>
                        <td style={tdStyle}>{field}</td>
                        <td style={tdMonoStyle}>{hex}</td>
                        <td style={tdStyle}>{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p>
                Block total: <span className="highlight-text">45 bytes</span>. The corresponding index entry would record LastKey=&quot;fish&quot;, Offset=&lt;block start&gt;, Length=45.
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

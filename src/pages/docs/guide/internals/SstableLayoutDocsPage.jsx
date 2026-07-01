import DocsNavbar from "@/components/docs/DocsNavbar";
import DocsSidebar from "@/components/docs/DocsSidebar";
import DocsMermaid from "@/components/docs/DocsMermaid";

const pageTopics = [
  { label: "Purpose", href: "#purpose" },
  { label: "High-Level File Structure", href: "#file-structure" },
  { label: "Write Sequence", href: "#write-sequence" },
  { label: "Read Sequence", href: "#read-sequence" },
  { label: "Crash Safety", href: "#crash-safety" },
];

/* ──────────────────────────────────────────────
   SVG: SSTable File Layout Diagram
   ────────────────────────────────────────────── */
function FileLayoutSvg() {
  return (
    <svg viewBox="0 0 660 340" className="w-full h-auto bg-[#0e0e11] border border-zinc-800 rounded-lg p-4 my-6" style={{ marginTop: 24, marginBottom: 24 }}>
      {/* Data Blocks region */}
      <rect x="60" y="10" width="540" height="150" rx="4" fill="#18181b" stroke="#52525b" strokeWidth="1" />
      <rect x="80" y="24" width="500" height="24" rx="3" fill="rgba(255,92,173,0.08)" stroke="#ff5cad" strokeWidth="0.7" />
      <text x="330" y="40" fill="#ffffff" fontSize="10" textAnchor="middle">Data Block 0 ─── offset 0</text>
      <rect x="80" y="54" width="500" height="24" rx="3" fill="rgba(255,255,255,0.03)" stroke="#52525b" strokeWidth="0.7" />
      <text x="330" y="70" fill="#ffffff" fontSize="10" textAnchor="middle">Data Block 1 ─── offset += len(Block 0)</text>
      <rect x="80" y="84" width="500" height="24" rx="3" fill="rgba(255,92,173,0.08)" stroke="#ff5cad" strokeWidth="0.7" />
      <text x="330" y="100" fill="#ffffff" fontSize="10" textAnchor="middle">Data Block 2 ─── offset += len(Block 1)</text>
      <text x="330" y="126" fill="#a1a1aa" fontSize="10" textAnchor="middle">...</text>
      <rect x="80" y="134" width="500" height="20" rx="3" fill="rgba(255,255,255,0.03)" stroke="#52525b" strokeWidth="0.7" />
      <text x="330" y="148" fill="#ffffff" fontSize="10" textAnchor="middle">Data Block N-1</text>

      {/* Index Block */}
      <rect x="60" y="170" width="540" height="36" rx="4" fill="#18181b" stroke="#ff5cad" strokeWidth="1.2" />
      <text x="330" y="192" fill="#ffffff" fontSize="11" textAnchor="middle" fontWeight="bold">Index Block ─── offset = indexOffset</text>

      {/* Bloom Filter Block */}
      <rect x="60" y="216" width="540" height="36" rx="4" fill="#18181b" stroke="#ff5cad" strokeWidth="1.2" />
      <text x="330" y="238" fill="#ffffff" fontSize="11" textAnchor="middle" fontWeight="bold">Bloom Filter Block ─── offset = bloomOffset</text>

      {/* Footer */}
      <rect x="60" y="262" width="540" height="36" rx="4" fill="#18181b" stroke="#ff5cad" strokeWidth="1.2" />
      <text x="330" y="284" fill="#ffffff" fontSize="11" textAnchor="middle" fontWeight="bold">Footer (48 bytes) ─── offset = fileSize - 48</text>

      {/* Labels on right */}
      <text x="20" y="90" fill="#a1a1aa" fontSize="9" textAnchor="middle" transform="rotate(-90,20,90)">Data Blocks</text>
      <text x="30" y="188" fill="#a1a1aa" fontSize="8">Index</text>
      <text x="30" y="234" fill="#a1a1aa" fontSize="8">Bloom</text>
      <text x="25" y="280" fill="#a1a1aa" fontSize="8">Footer</text>

      {/* Outer frame label */}
      <text x="330" y="320" fill="#71717a" fontSize="10" textAnchor="middle">SSTable File (.sst)</text>
    </svg>
  );
}

const WRITER_PIPELINE_CHART = `flowchart TD
    A["NewWriter(path, blockSize, expectedEntries)"] --> B["Create path.tmp"]
    B --> C{"More entries?"}
    C -->|yes| D["Writer.Add(key, value, tombstone)"]
    D --> E{"current.Size() + entry > blockSize?"}
    E -->|yes| F["flushBlock(): write block, record index"]
    E -->|no| G["current.Append(key, value, tombstone)"]
    F --> H["bloom.Add(key)"]
    G --> H
    H --> C
    C -->|no| I["Flush remaining block"]
    I --> J["Write index block → file"]
    J --> K["Write bloom filter → file"]
    K --> L["Write 48-byte footer → file"]
    L --> M["file.Sync()"]
    M --> N["file.Close()"]
    N --> O["os.Rename(path.tmp → path)"]`;

const READER_PIPELINE_CHART = `flowchart TD
    A["OpenReader(path, cache)"] --> B["Seek -48 from EOF, read Footer"]
    B --> C{"Magic == 0x88e241b3?"}
    C -->|no| D["return ErrBadMagic"]
    C -->|yes| E{"Version == 2?"}
    E -->|no| F["return ErrUnsupportedVersion"]
    E -->|yes| G["Seek to IndexOffset, read IndexLength bytes"]
    G --> H["decodeIndex() → []IndexEntry"]
    H --> I{"BloomLength > 0?"}
    I -->|yes| J["ReadAt BloomOffset, bloom.Decode()"]
    I -->|no| K["bloom = nil"]
    J --> L["Reader ready for Get/Scan"]
    K --> L`;

export default function SstableLayoutDocsPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="sstable-layout-title">PebbleDB Format Specification: SSTable Layout</h1>

            <div className="guide-body-text" style={{ marginTop: 24 }}>
              <p>
                This document specifies the complete on-disk layout of a PebbleDB Sorted String Table (SSTable) file, detailing the sequential arrangement and byte-level encoding of every section.
              </p>

              {/* ── 1. Purpose ── */}
              <h2 className="guide-sub-heading" id="purpose" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>1. Purpose</h2>
              <p>
                An SSTable is an immutable, sorted file that stores key-value entries flushed from the memtable or produced by compaction. Once written and committed via atomic rename, the file is never modified — only read or deleted.
              </p>

              {/* ── 2. File Structure ── */}
              <h2 className="guide-sub-heading" id="file-structure" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>2. High-Level File Structure</h2>
              <p>An SSTable file is composed of four sequential regions:</p>

              <FileLayoutSvg />

              <div style={{ overflowX: "auto", marginTop: 16, marginBottom: 20 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13, border: "1px solid rgba(255, 255, 255, 0.08)" }}>
                  <thead>
                    <tr style={{ background: "rgba(255, 92, 173, 0.08)", borderBottom: "1px solid rgba(255, 255, 255, 0.15)" }}>
                      <th style={{ padding: "10px 16px", color: "#ff5cad", fontWeight: 600 }}>Region</th>
                      <th style={{ padding: "10px 16px", color: "#ff5cad", fontWeight: 600 }}>Size</th>
                      <th style={{ padding: "10px 16px", color: "#ff5cad", fontWeight: 600 }}>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={{ padding: "10px 16px", fontWeight: 500, color: "#ffffff" }}>Data Blocks</td>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace" }}>Variable (≤ blockSize each, default 4 KiB)</td>
                      <td style={{ padding: "10px 16px" }}>Sorted key-value entries, serialized sequentially</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={{ padding: "10px 16px", fontWeight: 500, color: "#ffffff" }}>Index Block</td>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace" }}>Variable</td>
                      <td style={{ padding: "10px 16px" }}>One entry per data block: last key + offset + length</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={{ padding: "10px 16px", fontWeight: 500, color: "#ffffff" }}>Bloom Filter</td>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace" }}>Variable</td>
                      <td style={{ padding: "10px 16px" }}>Probabilistic key-presence bitmap</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={{ padding: "10px 16px", fontWeight: 500, color: "#ffffff" }}>Footer</td>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace" }}>Fixed 48 bytes</td>
                      <td style={{ padding: "10px 16px" }}>Pointers to index and bloom, format version, magic number</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* ── 3. Write Sequence ── */}
              <h2 className="guide-sub-heading" id="write-sequence" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>3. Write Sequence (Writer Pipeline)</h2>
              <p>The SSTable is constructed by the <span className="highlight-text">Writer</span> in a strict sequential pipeline:</p>

              <DocsMermaid chart={WRITER_PIPELINE_CHART} />

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>3.1 Go Implementation: Writer Structure</h3>
              <div className="guide-code-block-container" style={{ marginTop: 8, marginBottom: 20 }}>
                <pre className="guide-code-pre">
                  <code className="guide-code-lines">
                    <span className="code-line"><span className="code-keyword">type</span> Writer <span className="code-keyword">struct</span> {"{"}</span>
                    <span className="code-line">{"    "}file      *os.File</span>
                    <span className="code-line">{"    "}tmpPath   <span className="code-keyword">string</span></span>
                    <span className="code-line">{"    "}finalPath <span className="code-keyword">string</span></span>
                    <span className="code-line">{"    "}blockSize <span className="code-keyword">int</span></span>
                    <span className="code-line">{"    "}current   *Block</span>
                    <span className="code-line">{"    "}index     *IndexBlock</span>
                    <span className="code-line">{"    "}bloom     *bloom.Filter</span>
                    <span className="code-line">{"    "}lastKey   []<span className="code-keyword">byte</span></span>
                    <span className="code-line">{"    "}offset    <span className="code-keyword">uint64</span></span>
                    <span className="code-line">{"}"}</span>
                  </code>
                </pre>
              </div>

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>3.2 Go Implementation: Add Entry</h3>
              <div className="guide-code-block-container" style={{ marginTop: 8, marginBottom: 20 }}>
                <pre className="guide-code-pre">
                  <code className="guide-code-lines">
                    <span className="code-line"><span className="code-keyword">func</span> (w *Writer) <span className="code-function">Add</span>(key, value []<span className="code-keyword">byte</span>, tombstone <span className="code-keyword">bool</span>) <span className="code-keyword">error</span> {"{"}</span>
                    <span className="code-line">{"    "}<span className="code-keyword">if</span> w.lastKey != nil && bytes.Compare(key, w.lastKey) {"<"}= <span className="code-integer">0</span> {"{"}</span>
                    <span className="code-line">{"        "}<span className="code-keyword">return</span> ErrKeyOutOfOrder</span>
                    <span className="code-line">{"    "}{"}"}</span>
                    <span className="code-line">{"    "}entrySize := <span className="code-integer">4</span> + len(key) + <span className="code-integer">4</span> + len(value) + <span className="code-integer">1</span></span>
                    <span className="code-line">{"    "}<span className="code-keyword">if</span> w.current.Size()+entrySize {">"} w.blockSize && w.current.Size() {">"} <span className="code-integer">0</span> {"{"}</span>
                    <span className="code-line">{"        "}<span className="code-keyword">if</span> err := w.flushBlock(); err != nil {"{"}</span>
                    <span className="code-line">{"            "}<span className="code-keyword">return</span> err</span>
                    <span className="code-line">{"        "}{"}"}</span>
                    <span className="code-line">{"    "}{"}"}</span>
                    <span className="code-line">{"    "}<span className="code-keyword">if</span> err := w.current.Append(key, value, tombstone); err != nil {"{"}</span>
                    <span className="code-line">{"        "}<span className="code-keyword">return</span> err</span>
                    <span className="code-line">{"    "}{"}"}</span>
                    <span className="code-line">{"    "}w.bloom.Add(key)</span>
                    <span className="code-line">{"    "}w.lastKey = append([]<span className="code-keyword">byte</span>(nil), key...)</span>
                    <span className="code-line">{"    "}<span className="code-keyword">return</span> nil</span>
                    <span className="code-line">{"}"}</span>
                  </code>
                </pre>
              </div>

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>3.3 Go Implementation: Finalize & Atomic Commit</h3>
              <div className="guide-code-block-container" style={{ marginTop: 8, marginBottom: 20 }}>
                <pre className="guide-code-pre">
                  <code className="guide-code-lines">
                    <span className="code-line"><span className="code-keyword">func</span> (w *Writer) <span className="code-function">Close</span>() <span className="code-keyword">error</span> {"{"}</span>
                    <span className="code-line">{"    "}<span className="code-keyword">if</span> w.current.Size() {">"} <span className="code-integer">0</span> {"{"}</span>
                    <span className="code-line">{"        "}<span className="code-keyword">if</span> err := w.flushBlock(); err != nil {"{"}</span>
                    <span className="code-line">{"            "}w.cleanup()</span>
                    <span className="code-line">{"            "}<span className="code-keyword">return</span> err</span>
                    <span className="code-line">{"        "}{"}"}</span>
                    <span className="code-line">{"    "}{"}"}</span>
                    <span className="code-line">{"    "}indexData := w.index.Encode()</span>
                    <span className="code-line">{"    "}indexOffset := w.offset</span>
                    <span className="code-line">{"    "}<span className="code-keyword">if</span> _, err := w.file.Write(indexData); err != nil {"{"}</span>
                    <span className="code-line">{"        "}w.cleanup()</span>
                    <span className="code-line">{"        "}<span className="code-keyword">return</span> err</span>
                    <span className="code-line">{"    "}{"}"}</span>
                    <span className="code-line">{"    "}w.offset += <span className="code-keyword">uint64</span>(len(indexData))</span>
                    <span className="code-line"> </span>
                    <span className="code-line">{"    "}bloomData := w.bloom.Encode()</span>
                    <span className="code-line">{"    "}bloomOffset := w.offset</span>
                    <span className="code-line">{"    "}<span className="code-keyword">if</span> _, err := w.file.Write(bloomData); err != nil {"{"}</span>
                    <span className="code-line">{"        "}w.cleanup()</span>
                    <span className="code-line">{"        "}<span className="code-keyword">return</span> err</span>
                    <span className="code-line">{"    "}{"}"}</span>
                    <span className="code-line">{"    "}w.offset += <span className="code-keyword">uint64</span>(len(bloomData))</span>
                    <span className="code-line"> </span>
                    <span className="code-line">{"    "}footer := Footer{"{"}</span>
                    <span className="code-line">{"        "}IndexOffset: indexOffset, IndexLength: <span className="code-keyword">uint64</span>(len(indexData)),</span>
                    <span className="code-line">{"        "}BloomOffset: bloomOffset, BloomLength: <span className="code-keyword">uint64</span>(len(bloomData)),</span>
                    <span className="code-line">{"        "}Version: currentVersion, Magic: magicNumber,</span>
                    <span className="code-line">{"    "}{"}"}</span>
                    <span className="code-line">{"    "}<span className="code-comment">// Write footer, sync, close, then atomic rename</span></span>
                    <span className="code-line">{"    "}<span className="code-keyword">if</span> _, err := w.file.Write(footer.Encode()); err != nil {"{"}</span>
                    <span className="code-line">{"        "}w.cleanup(); <span className="code-keyword">return</span> err</span>
                    <span className="code-line">{"    "}{"}"}</span>
                    <span className="code-line">{"    "}<span className="code-keyword">if</span> err := w.file.Sync(); err != nil {"{"} w.cleanup(); <span className="code-keyword">return</span> err {"}"}</span>
                    <span className="code-line">{"    "}<span className="code-keyword">if</span> err := w.file.Close(); err != nil {"{"} w.cleanup(); <span className="code-keyword">return</span> err {"}"}</span>
                    <span className="code-line">{"    "}w.file = nil</span>
                    <span className="code-line">{"    "}<span className="code-keyword">return</span> os.Rename(w.tmpPath, w.finalPath)</span>
                    <span className="code-line">{"}"}</span>
                  </code>
                </pre>
              </div>

              {/* ── 4. Read Sequence ── */}
              <h2 className="guide-sub-heading" id="read-sequence" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>4. Read Sequence (Reader Pipeline)</h2>
              <p>Opening an SSTable reads the file from the end:</p>

              <DocsMermaid chart={READER_PIPELINE_CHART} />

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>4.1 Go Implementation: Point Lookup</h3>
              <div className="guide-code-block-container" style={{ marginTop: 8, marginBottom: 20 }}>
                <pre className="guide-code-pre">
                  <code className="guide-code-lines">
                    <span className="code-line"><span className="code-keyword">func</span> (r *Reader) <span className="code-function">Get</span>(key []<span className="code-keyword">byte</span>) (value []<span className="code-keyword">byte</span>, found <span className="code-keyword">bool</span>, tombstone <span className="code-keyword">bool</span>, err <span className="code-keyword">error</span>) {"{"}</span>
                    <span className="code-line">{"    "}<span className="code-keyword">if</span> !r.MayContain(key) {"{"}</span>
                    <span className="code-line">{"        "}<span className="code-keyword">return</span> nil, <span className="code-keyword">false</span>, <span className="code-keyword">false</span>, nil  <span className="code-comment">// Bloom filter says absent</span></span>
                    <span className="code-line">{"    "}{"}"}</span>
                    <span className="code-line">{"    "}idx := sort.Search(len(r.index), <span className="code-keyword">func</span>(i <span className="code-keyword">int</span>) <span className="code-keyword">bool</span> {"{"}</span>
                    <span className="code-line">{"        "}<span className="code-keyword">return</span> bytes.Compare(key, r.index[i].LastKey) {"<"}= <span className="code-integer">0</span></span>
                    <span className="code-line">{"    "}{"}"}</span>
                    <span className="code-line">{"    "}<span className="code-keyword">if</span> idx == len(r.index) {"{"}</span>
                    <span className="code-line">{"        "}<span className="code-keyword">return</span> nil, <span className="code-keyword">false</span>, <span className="code-keyword">false</span>, nil  <span className="code-comment">// Key {">"} all blocks</span></span>
                    <span className="code-line">{"    "}{"}"}</span>
                    <span className="code-line">{"    "}entry := r.index[idx]</span>
                    <span className="code-line">{"    "}blockData, err := r.readBlock(entry.Offset, entry.Length)</span>
                    <span className="code-line">{"    "}<span className="code-keyword">if</span> err != nil {"{"}</span>
                    <span className="code-line">{"        "}<span className="code-keyword">return</span> nil, <span className="code-keyword">false</span>, <span className="code-keyword">false</span>, err</span>
                    <span className="code-line">{"    "}{"}"}</span>
                    <span className="code-line">{"    "}it := NewBlockIterator(blockData)</span>
                    <span className="code-line">{"    "}<span className="code-keyword">for</span> it.Next() {"{"}</span>
                    <span className="code-line">{"        "}cmp := bytes.Compare(key, it.Key())</span>
                    <span className="code-line">{"        "}<span className="code-keyword">if</span> cmp == <span className="code-integer">0</span> {"{"}</span>
                    <span className="code-line">{"            "}<span className="code-keyword">return</span> it.Value(), <span className="code-keyword">true</span>, it.IsTombstone(), nil</span>
                    <span className="code-line">{"        "}{"}"}</span>
                    <span className="code-line">{"        "}<span className="code-keyword">if</span> cmp {"<"} <span className="code-integer">0</span> {"{"} <span className="code-keyword">break</span> {"}"}</span>
                    <span className="code-line">{"    "}{"}"}</span>
                    <span className="code-line">{"    "}<span className="code-keyword">return</span> nil, <span className="code-keyword">false</span>, <span className="code-keyword">false</span>, nil</span>
                    <span className="code-line">{"}"}</span>
                  </code>
                </pre>
              </div>

              {/* ── 5. Crash Safety ── */}
              <h2 className="guide-sub-heading" id="crash-safety" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>5. Crash Safety: The Temporary File Protocol</h2>
              <p>SSTable creation uses a <span className="highlight-text">write-to-temp / fsync / atomic-rename</span> pattern:</p>

              <div style={{ overflowX: "auto", marginTop: 16, marginBottom: 20 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13, border: "1px solid rgba(255, 255, 255, 0.08)" }}>
                  <thead>
                    <tr style={{ background: "rgba(255, 92, 173, 0.08)", borderBottom: "1px solid rgba(255, 255, 255, 0.15)" }}>
                      <th style={{ padding: "10px 16px", color: "#ff5cad", fontWeight: 600 }}>Step</th>
                      <th style={{ padding: "10px 16px", color: "#ff5cad", fontWeight: 600 }}>File on Disk</th>
                      <th style={{ padding: "10px 16px", color: "#ff5cad", fontWeight: 600 }}>Crash Consequence</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={{ padding: "10px 16px", fontWeight: 500, color: "#ffffff" }}>1. os.Create(path.tmp)</td>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace" }}>sst_NNNNNNNN.sst.tmp exists</td>
                      <td style={{ padding: "10px 16px" }}>Orphan temp file; cleaned on next open</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={{ padding: "10px 16px", fontWeight: 500, color: "#ffffff" }}>2. Write blocks + index + bloom + footer</td>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace" }}>sst_NNNNNNNN.sst.tmp growing</td>
                      <td style={{ padding: "10px 16px" }}>Same as above</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={{ padding: "10px 16px", fontWeight: 500, color: "#ffffff" }}>3. file.Sync()</td>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace" }}>Data durable in .tmp</td>
                      <td style={{ padding: "10px 16px" }}>Same as above</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={{ padding: "10px 16px", fontWeight: 500, color: "#ffffff" }}>4. file.Close()</td>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace" }}>Handle released</td>
                      <td style={{ padding: "10px 16px" }}>Same as above</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={{ padding: "10px 16px", fontWeight: 500, color: "#ffffff" }}>5. os.Rename(.tmp → .sst)</td>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace" }}>Atomic swap</td>
                      <td style={{ padding: "10px 16px" }}>SSTable visible; manifest records it next</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div style={{ background: "rgba(255, 92, 173, 0.06)", border: "1px solid rgba(255, 92, 173, 0.25)", borderRadius: 8, padding: "16px 20px", marginTop: 16, marginBottom: 20 }}>
                <p style={{ color: "#ff5cad", fontWeight: 600, marginBottom: 6, fontSize: 13 }}>Warning: IMPORTANT</p>
                <p style={{ fontSize: 13, lineHeight: 1.7 }}>
                  The SSTable file is not visible to the database until the manifest records it via <span className="highlight-text">AppendNewFile</span>. A crash between rename and manifest commit leaves an orphan .sst file that is quarantined during recovery.
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

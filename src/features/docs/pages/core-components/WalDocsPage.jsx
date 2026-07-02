import DocsNavbar from "@/features/docs/components/DocsNavbar";
import DocsSidebar from "@/features/docs/components/DocsSidebar";

const pageTopics = [
  { label: "Subsystem Directory & Roles", href: "#directory-roles" },
  { label: "Binary Record Layout & Encoding", href: "#binary-layout" },
  { label: "Size Limits & Protection Rules", href: "#size-limits" },
  { label: "Concurrent Append & Group Commit", href: "#group-commit" },
  { label: "Tail Salvaging Mechanics", href: "#tail-salvaging" },
  { label: "Copy-Rename Truncation", href: "#truncation-algorithm" },
];

function RecordLayoutSvg() {
  return (
    <svg viewBox="0 0 600 80" className="w-full h-auto bg-[#0e0e11] border border-zinc-800 rounded-lg p-4 my-6" style={{ marginTop: 24, marginBottom: 24 }}>
      {/* keyLen */}
      <rect x="10" y="10" width="70" height="36" fill="#18181b" stroke="#ff5cad" strokeWidth="1" />
      <text x="45" y="26" fill="#ffffff" fontSize="9" textAnchor="middle" fontWeight="bold">keyLen (4B)</text>
      <text x="45" y="38" fill="#a1a1aa" fontSize="7" textAnchor="middle">BigEndian U32</text>

      {/* key */}
      <rect x="80" y="10" width="110" height="36" fill="#18181b" stroke="#52525b" strokeWidth="1" />
      <text x="135" y="26" fill="#ffffff" fontSize="9" textAnchor="middle" fontWeight="bold">key (keyLen B)</text>
      <text x="135" y="38" fill="#a1a1aa" fontSize="7" textAnchor="middle">Raw Bytes</text>

      {/* valueLen */}
      <rect x="190" y="10" width="80" height="36" fill="#18181b" stroke="#ff5cad" strokeWidth="1" />
      <text x="230" y="26" fill="#ffffff" fontSize="9" textAnchor="middle" fontWeight="bold">valueLen (4B)</text>
      <text x="230" y="38" fill="#a1a1aa" fontSize="7" textAnchor="middle">BigEndian U32</text>

      {/* value */}
      <rect x="270" y="10" width="130" height="36" fill="#18181b" stroke="#52525b" strokeWidth="1" />
      <text x="335" y="26" fill="#ffffff" fontSize="9" textAnchor="middle" fontWeight="bold">value (valueLen B)</text>
      <text x="335" y="38" fill="#a1a1aa" fontSize="7" textAnchor="middle">Raw Bytes</text>

      {/* tombstone */}
      <rect x="400" y="10" width="90" height="36" fill="#18181b" stroke="#52525b" strokeWidth="1" />
      <text x="445" y="26" fill="#ffffff" fontSize="9" textAnchor="middle" fontWeight="bold">tombstone (1B)</text>
      <text x="445" y="38" fill="#a1a1aa" fontSize="7" textAnchor="middle">0 = Put / 1 = Del</text>

      {/* crc32 */}
      <rect x="490" y="10" width="100" height="36" fill="#18181b" stroke="#ff5cad" strokeWidth="1" />
      <text x="540" y="26" fill="#ffffff" fontSize="9" textAnchor="middle" fontWeight="bold">crc32 (4B)</text>
      <text x="540" y="38" fill="#a1a1aa" fontSize="7" textAnchor="middle">IEEE Checksum</text>
    </svg>
  );
}

function RecoverySalvageSvg() {
  return (
    <svg viewBox="0 0 600 120" className="w-full h-auto bg-[#0e0e11] border border-zinc-800 rounded-lg p-6 my-6" style={{ marginTop: 24, marginBottom: 24 }}>
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#71717a" />
        </marker>
      </defs>

      {/* Parse Record */}
      <rect x="10" y="40" width="100" height="30" rx="4" fill="#18181b" stroke="#52525b" strokeWidth="1" />
      <text x="60" y="58" fill="#ffffff" fontSize="10" textAnchor="middle">Parse Record</text>

      {/* Split Point */}
      <path d="M 110 55 H 174" stroke="#71717a" strokeWidth="1.2" markerEnd="url(#arrow)" />

      {/* Checksum Match */}
      <line x1="180" y1="55" x2="350" y2="55" stroke="#71717a" strokeWidth="1.2" markerEnd="url(#arrow)" />
      <rect x="350" y="40" width="220" height="30" rx="4" fill="#18181b" stroke="#ff5cad" strokeWidth="1" />
      <text x="460" y="58" fill="#ffffff" fontSize="10" textAnchor="middle">Advance validEnd pointer</text>
      <text x="260" y="48" fill="#a1a1aa" fontSize="8" textAnchor="middle">Checksum Matches</text>

      {/* Unexpected EOF */}
      <path d="M 180 55 L 260 15 H 350" stroke="#71717a" strokeWidth="1.2" fill="none" markerEnd="url(#arrow)" />
      <text x="240" y="24" fill="#a1a1aa" fontSize="8">Unexpected EOF</text>
      <rect x="350" y="2" width="220" height="30" rx="4" fill="#18181b" stroke="#52525b" strokeWidth="1" />
      <text x="460" y="20" fill="#ffffff" fontSize="10" textAnchor="middle">Truncate WAL to validEnd offset</text>

      {/* CRC32 Mismatch */}
      <path d="M 180 55 L 260 95 H 350" stroke="#71717a" strokeWidth="1.2" fill="none" markerEnd="url(#arrow)" />
      <text x="240" y="86" fill="#a1a1aa" fontSize="8">CRC32 Mismatch</text>
      <rect x="350" y="78" width="220" height="30" rx="4" fill="#18181b" stroke="#ff5cad" strokeWidth="1.2" />
      <text x="460" y="96" fill="#ffffff" fontSize="10" textAnchor="middle">Stop Replay & Return Error</text>
    </svg>
  );
}

export default function WalDocsPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="wal-title">PebbleDB Subsystem: Write-Ahead Log (WAL)</h1>
            
            <div className="guide-body-text" style={{ marginTop: 24 }}>
              <p>
                This document provides a detailed specification of the Write-Ahead Log (wal package) in PebbleDB, explaining its record layout, validation rules, concurrency synchronization, truncation algorithm, and tail-salvaging recovery, accompanied by the actual Go source implementations.
              </p>

              <h2 className="guide-sub-heading" id="directory-roles" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>1. Subsystem Directory and Roles</h2>
              <p>
                The WAL is PebbleDB's first durability layer. Every mutation must be written to disk in the WAL before it can be applied to the active memtable. The subsystem is implemented in two source files:
              </p>
              <ul className="guide-bullets-list">
                <li>
                  <span className="highlight-text">internal/wal/wal.go</span>: Handles file open, append, synchronization, replay, and truncation.
                </li>
                <li>
                  <span className="highlight-text">internal/wal/limits.go</span>: Defines size boundaries, error codes, and record validation logic.
                </li>
              </ul>

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>1.1 Structural Types</h3>
              <div className="guide-code-block-container" style={{ marginTop: 8, marginBottom: 20 }}>
                <pre className="guide-code-pre">
                  <code className="guide-code-lines">
                    <span className="code-line"><span className="code-comment">// Record represents a single entry in the WAL.</span></span>
                    <span className="code-line"><span className="code-keyword">type</span> Record <span className="code-keyword">struct</span> {"{"}</span>
                    <span className="code-line">	Key       []<span className="code-keyword">byte</span></span>
                    <span className="code-line">	Value     []<span className="code-keyword">byte</span></span>
                    <span className="code-line">	Tombstone <span className="code-keyword">bool</span></span>
                    <span className="code-line">{"}"}</span>
                    <span className="code-line"><span className="code-comment">// WAL manages the write-ahead log file.</span></span>
                    <span className="code-line"><span className="code-keyword">type</span> WAL <span className="code-keyword">struct</span> {"{"}</span>
                    <span className="code-line">	path   <span className="code-keyword">string</span></span>
                    <span className="code-line">	file   *os.File</span>
                    <span className="code-line">	mu     sync.Mutex</span>
                    <span className="code-line">	limits ReplayLimits</span>
                    <span className="code-line">{"}"}</span>
                  </code>
                </pre>
              </div>

              <h2 className="guide-sub-heading" id="binary-layout" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>2. Binary Record Layout & Encoding</h2>
              <p>
                The WAL is stored as a single flat file (wal.log) containing sequential, length-prefixed records.
              </p>

              <RecordLayoutSvg />

              <ul className="guide-bullets-list">
                <li>
                  <span className="highlight-text">keyLen</span> (4 bytes, Big-Endian uint32): Length of the key in bytes.
                </li>
                <li>
                  <span className="highlight-text">key</span> (keyLen bytes): Raw key bytes.
                </li>
                <li>
                  <span className="highlight-text">valueLen</span> (4 bytes, Big-Endian uint32): Length of the value in bytes.
                </li>
                <li>
                  <span className="highlight-text">value</span> (valueLen bytes): Raw value bytes. For deletes, this field is typically empty (0 bytes).
                </li>
                <li>
                  <span className="highlight-text">tombstone</span> (1 byte): Flag indicating mutation type: 0 for writes, 1 for deletes.
                </li>
                <li>
                  <span className="highlight-text">crc32</span> (4 bytes, Big-Endian uint32): CRC32-IEEE checksum calculated over all preceding fields in the record (header + payload).
                </li>
              </ul>

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>2.1 Go Implementation: Record Serialization</h3>
              <div className="guide-code-block-container" style={{ marginTop: 8, marginBottom: 20 }}>
                <pre className="guide-code-pre">
                  <code className="guide-code-lines">
                    <span className="code-line"><span className="code-keyword">func</span> <span className="code-function">encodeRecord</span>(rec Record, limits ReplayLimits) ([]<span className="code-keyword">byte</span>, <span className="code-keyword">error</span>) {"{"}</span>
                    <span className="code-line">	keyLen := len(rec.Key)</span>
                    <span className="code-line">	valueLen := len(rec.Value)</span>
                    <span className="code-line">	<span className="code-keyword">if</span> err := limits.validateRecord(uint32(keyLen), uint32(valueLen)); err != nil {"{"}</span>
                    <span className="code-line">		<span className="code-keyword">return</span> nil, err</span>
                    <span className="code-line">	{"}"}</span>
                    <span className="code-line">	tombByte := <span className="code-keyword">byte</span>(<span className="code-integer">0</span>)</span>
                    <span className="code-line">	<span className="code-keyword">if</span> rec.Tombstone {"{"}</span>
                    <span className="code-line">		tombByte = <span className="code-integer">1</span></span>
                    <span className="code-line">	{"}"}</span>
                    <span className="code-line">	buf := make([]<span className="code-keyword">byte</span>, <span className="code-integer">0</span>, <span className="code-integer">4</span>+keyLen+<span className="code-integer">4</span>+valueLen+<span className="code-integer">1</span>+<span className="code-integer">4</span>)</span>
                    <span className="code-line">	buf = binary.BigEndian.AppendUint32(buf, uint32(keyLen))</span>
                    <span className="code-line">	buf = append(buf, rec.Key...)</span>
                    <span className="code-line">	buf = binary.BigEndian.AppendUint32(buf, uint32(valueLen))</span>
                    <span className="code-line">	buf = append(buf, rec.Value...)</span>
                    <span className="code-line">	buf = append(buf, tombByte)</span>
                    <span className="code-line">	checksum := crc32.ChecksumIEEE(buf)</span>
                    <span className="code-line">	buf = binary.BigEndian.AppendUint32(buf, checksum)</span>
                    <span className="code-line">	<span className="code-keyword">return</span> buf, nil</span>
                    <span className="code-line">{"}"}</span>
                  </code>
                </pre>
              </div>

              <h2 className="guide-sub-heading" id="size-limits" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>3. Size Limits and Protection Rules</h2>
              <p>
                To prevent corrupted file headers from triggering large memory allocations, the WAL enforces size limits (ReplayLimits) during replay and writes:
              </p>

              {/* Limits Table */}
              <div style={{ overflowX: "auto", marginTop: 16, marginBottom: 20 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13, border: "1px solid rgba(255, 255, 255, 0.08)" }}>
                  <thead>
                    <tr style={{ background: "rgba(255, 92, 173, 0.08)", borderBottom: "1px solid rgba(255, 255, 255, 0.15)" }}>
                      <th style={{ padding: "10px 16px", color: "#ff5cad", fontWeight: 600 }}>Parameter</th>
                      <th style={{ padding: "10px 16px", color: "#ff5cad", fontWeight: 600 }}>Configuration Constant</th>
                      <th style={{ padding: "10px 16px", color: "#ff5cad", fontWeight: 600 }}>Default Value</th>
                      <th style={{ padding: "10px 16px", color: "#ff5cad", fontWeight: 600 }}>Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={{ padding: "10px 16px", fontWeight: 500, color: "#ffffff" }}>Max WAL File Size</td>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace" }}>DefaultMaxWALFileSize</td>
                      <td style={{ padding: "10px 16px" }}>64 MiB</td>
                      <td style={{ padding: "10px 16px" }}>Max size allowed for replay. Prevents OOM when parsing corrupt directories.</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={{ padding: "10px 16px", fontWeight: 500, color: "#ffffff" }}>Max Key Size</td>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace" }}>DefaultMaxKeySize</td>
                      <td style={{ padding: "10px 16px" }}>1 MiB</td>
                      <td style={{ padding: "10px 16px" }}>Max key size allowed. Oversized keys return ErrKeyTooLarge.</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={{ padding: "10px 16px", fontWeight: 500, color: "#ffffff" }}>Max Value Size</td>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace" }}>DefaultMaxValueSize</td>
                      <td style={{ padding: "10px 16px" }}>16 MiB</td>
                      <td style={{ padding: "10px 16px" }}>Max value size allowed. Oversized values return ErrValueTooLarge.</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={{ padding: "10px 16px", fontWeight: 500, color: "#ffffff" }}>Max Record Size</td>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace" }}>DefaultMaxRecordSize</td>
                      <td style={{ padding: "10px 16px" }}>17 MiB</td>
                      <td style={{ padding: "10px 16px" }}>Max total record size (keyLen + valueLen + overhead).</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>3.1 Go Implementation: Size Validation (limits.go)</h3>
              <div className="guide-code-block-container" style={{ marginTop: 8, marginBottom: 20 }}>
                <pre className="guide-code-pre">
                  <code className="guide-code-lines">
                    <span className="code-line"><span className="code-keyword">type</span> ReplayLimits <span className="code-keyword">struct</span> {"{"}</span>
                    <span className="code-line">	MaxFileSize   <span className="code-keyword">int64</span></span>
                    <span className="code-line">	MaxKeySize    <span className="code-keyword">uint32</span></span>
                    <span className="code-line">	MaxValueSize  <span className="code-keyword">uint32</span></span>
                    <span className="code-line">	MaxRecordSize <span className="code-keyword">uint32</span></span>
                    <span className="code-line">{"}"}</span>
                    <span className="code-line"><span className="code-keyword">func</span> (l ReplayLimits) <span className="code-function">validateRecord</span>(keyLen, valueLen <span className="code-keyword">uint32</span>) <span className="code-keyword">error</span> {"{"}</span>
                    <span className="code-line">	<span className="code-keyword">if</span> keyLen &gt; l.MaxKeySize {"{"}</span>
                    <span className="code-line">		<span className="code-keyword">return</span> ErrKeyTooLarge</span>
                    <span className="code-line">	{"}"}</span>
                    <span className="code-line">	<span className="code-keyword">if</span> valueLen &gt; l.MaxValueSize {"{"}</span>
                    <span className="code-line">		<span className="code-keyword">return</span> ErrValueTooLarge</span>
                    <span className="code-line">	{"}"}</span>
                    <span className="code-line">	recSize := uint64(recordHeaderSize) + uint64(keyLen) + uint64(valueLen)</span>
                    <span className="code-line">	<span className="code-keyword">if</span> recSize &gt; uint64(l.MaxRecordSize) {"{"}</span>
                    <span className="code-line">		<span className="code-keyword">return</span> ErrRecordTooLarge</span>
                    <span className="code-line">	{"}"}</span>
                    <span className="code-line">	<span className="code-keyword">return</span> nil</span>
                    <span className="code-line">{"}"}</span>
                  </code>
                </pre>
              </div>

              <h2 className="guide-sub-heading" id="group-commit" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>4. Concurrent Append and Group Commit</h2>
              <p>
                The WAL guarantees thread-safe writes using a global mutex (w.mu).
              </p>

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>4.1 Go Implementation: Group Commit Append</h3>
              <p>
                The AppendBatch method serializes all records in the batch into a single write buffer and appends them sequentially, invoking fsync once at the end of the batch:
              </p>
              <div className="guide-code-block-container" style={{ marginTop: 8, marginBottom: 20 }}>
                <pre className="guide-code-pre">
                  <code className="guide-code-lines">
                    <span className="code-line"><span className="code-keyword">func</span> (w *WAL) <span className="code-function">AppendBatch</span>(records []Record) <span className="code-keyword">error</span> {"{"}</span>
                    <span className="code-line">	<span className="code-keyword">if</span> len(records) == <span className="code-integer">0</span> {"{"}</span>
                    <span className="code-line">		<span className="code-keyword">return</span> nil</span>
                    <span className="code-line">	{"}"}</span>
                    <span className="code-line">	w.mu.Lock()</span>
                    <span className="code-line">	<span className="code-keyword">defer</span> w.mu.Unlock()</span>
                    <span className="code-line">	<span className="code-keyword">for</span> _, rec := <span className="code-keyword">range</span> records {"{"}</span>
                    <span className="code-line">		<span className="code-keyword">if</span> _, err := w.appendRecordLocked(rec); err != nil {"{"}</span>
                    <span className="code-line">			<span className="code-keyword">return</span> err</span>
                    <span className="code-line">		{"}"}</span>
                    <span className="code-line">	{"}"}</span>
                    <span className="code-line">	<span className="code-keyword">if</span> BeforeBatchSync != nil {"{"}</span>
                    <span className="code-line">		BeforeBatchSync()</span>
                    <span className="code-line">	{"}"}</span>
                    <span className="code-line">	<span className="code-keyword">return</span> w.file.Sync()</span>
                    <span className="code-line">{"}"}</span>
                    <span className="code-line"><span className="code-keyword">func</span> (w *WAL) <span className="code-function">appendRecordLocked</span>(rec Record) (<span className="code-keyword">int</span>, <span className="code-keyword">error</span>) {"{"}</span>
                    <span className="code-line">	buf, err := encodeRecord(rec, w.limits)</span>
                    <span className="code-line">	<span className="code-keyword">if</span> err != nil {"{"}</span>
                    <span className="code-line">		<span className="code-keyword">return</span> <span className="code-integer">0</span>, err</span>
                    <span className="code-line">	{"}"}</span>
                    <span className="code-line">	n, err := w.file.Write(buf)</span>
                    <span className="code-line">	<span className="code-keyword">return</span> n, err</span>
                    <span className="code-line">{"}"}</span>
                  </code>
                </pre>
              </div>

              <h2 className="guide-sub-heading" id="tail-salvaging" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>5. Tail Salvaging Mechanics</h2>
              <p>
                If a process crash occurs while the database is writing to the WAL, it may leave an incomplete record at the end of the file. The WAL recovery path handles this using a tail-salvaging algorithm:
              </p>

              <RecoverySalvageSvg />

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>5.1 Go Implementation: Replay State Machine</h3>
              <div className="guide-code-block-container" style={{ marginTop: 8, marginBottom: 20 }}>
                <pre className="guide-code-pre">
                  <code className="guide-code-lines">
                    <span className="code-line"><span className="code-keyword">func</span> <span className="code-function">ReplayFromWithRecovery</span>(path <span className="code-keyword">string</span>, limits ReplayLimits, startOffset <span className="code-keyword">int64</span>, fn <span className="code-keyword">func</span>(Record) <span className="code-keyword">error</span>) (<span className="code-keyword">int64</span>, <span className="code-keyword">error</span>) {"{"}</span>
                    <span className="code-line">	limits = limits.WithDefaults()</span>
                    <span className="code-line">	f, err := os.OpenFile(path, os.O_RDWR, <span className="code-integer">0644</span>)</span>
                    <span className="code-line">	<span className="code-keyword">if</span> err != nil {"{"}</span>
                    <span className="code-line">		<span className="code-keyword">if</span> os.IsNotExist(err) {"{"}</span>
                    <span className="code-line">			<span className="code-keyword">return</span> <span className="code-integer">0</span>, nil</span>
                    <span className="code-line">		{"}"}</span>
                    <span className="code-line">		<span className="code-keyword">return</span> <span className="code-integer">0</span>, err</span>
                    <span className="code-line">	{"}"}</span>
                    <span className="code-line">	<span className="code-keyword">defer</span> f.Close()</span>
                    <span className="code-line">	fi, err := f.Stat()</span>
                    <span className="code-line">	<span className="code-keyword">if</span> err != nil {"{"}</span>
                    <span className="code-line">		<span className="code-keyword">return</span> <span className="code-integer">0</span>, err</span>
                    <span className="code-line">	{"}"}</span>
                    <span className="code-line">	<span className="code-keyword">if</span> fi.Size() &gt; limits.MaxFileSize {"{"}</span>
                    <span className="code-line">		<span className="code-keyword">return</span> <span className="code-integer">0</span>, ErrWALTooLarge</span>
                    <span className="code-line">	{"}"}</span>
                    <span className="code-line">	<span className="code-keyword">if</span> startOffset &gt; fi.Size() {"{"}</span>
                    <span className="code-line">		startOffset = fi.Size()</span>
                    <span className="code-line">	{"}"}</span>
                    <span className="code-line">	<span className="code-keyword">if</span> _, err := f.Seek(startOffset, io.SeekStart); err != nil {"{"}</span>
                    <span className="code-line">		<span className="code-keyword">return</span> <span className="code-integer">0</span>, err</span>
                    <span className="code-line">	{"}"}</span>
                    <span className="code-line">	validEnd := startOffset</span>
                    <span className="code-line">	<span className="code-keyword">for</span> {"{"}</span>
                    <span className="code-line">		recordStart, err := f.Seek(<span className="code-integer">0</span>, io.SeekCurrent)</span>
                    <span className="code-line">		<span className="code-keyword">if</span> err != nil {"{"}</span>
                    <span className="code-line">			<span className="code-keyword">return</span> validEnd, err</span>
                    <span className="code-line">		{"}"}</span>
                    <span className="code-line">		rec, n, err := readOneRecord(f, limits)</span>
                    <span className="code-line">		<span className="code-keyword">if</span> err == io.EOF {"{"}</span>
                    <span className="code-line">			<span className="code-keyword">break</span></span>
                    <span className="code-line">		{"}"}</span>
                    <span className="code-line">		<span className="code-keyword">if</span> err == io.ErrUnexpectedEOF {"{"}</span>
                    <span className="code-line">			<span className="code-keyword">if</span> truncErr := f.Truncate(validEnd); truncErr != nil {"{"}</span>
                    <span className="code-line">				<span className="code-keyword">return</span> validEnd, truncErr</span>
                    <span className="code-line">			{"}"}</span>
                    <span className="code-line">			<span className="code-keyword">break</span></span>
                    <span className="code-line">		{"}"}</span>
                    <span className="code-line">		<span className="code-keyword">if</span> err != nil {"{"}</span>
                    <span className="code-line">			<span className="code-keyword">return</span> validEnd, err</span>
                    <span className="code-line">		{"}"}</span>
                    <span className="code-line">		validEnd = recordStart + n</span>
                    <span className="code-line">		<span className="code-keyword">if</span> err := fn(rec); err != nil {"{"}</span>
                    <span className="code-line">			<span className="code-keyword">return</span> validEnd, err</span>
                    <span className="code-line">		{"}"}</span>
                    <span className="code-line">	{"}"}</span>
                    <span className="code-line">	<span className="code-keyword">return</span> validEnd, nil</span>
                    <span className="code-line">{"}"}</span>
                  </code>
                </pre>
              </div>

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>5.2 Go Implementation: Record Decoding</h3>
              <div className="guide-code-block-container" style={{ marginTop: 8, marginBottom: 20 }}>
                <pre className="guide-code-pre">
                  <code className="guide-code-lines">
                    <span className="code-line"><span className="code-keyword">func</span> <span className="code-function">readOneRecord</span>(f *os.File, limits ReplayLimits) (Record, <span className="code-keyword">int64</span>, <span className="code-keyword">error</span>) {"{"}</span>
                    <span className="code-line">	start, err := f.Seek(<span className="code-integer">0</span>, io.SeekCurrent)</span>
                    <span className="code-line">	<span className="code-keyword">if</span> err != nil {"{"}</span>
                    <span className="code-line">		<span className="code-keyword">return</span> Record{}, <span className="code-integer">0</span>, err</span>
                    <span className="code-line">	{"}"}</span>
                    <span className="code-line">	<span className="code-keyword">var</span> keyLen <span className="code-keyword">uint32</span></span>
                    <span className="code-line">	<span className="code-keyword">if</span> err := binary.Read(f, binary.BigEndian, &keyLen); err != nil {"{"}</span>
                    <span className="code-line">		<span className="code-keyword">return</span> Record{}, <span className="code-integer">0</span>, err</span>
                    <span className="code-line">	{"}"}</span>
                    <span className="code-line">	<span className="code-keyword">if</span> keyLen &gt; limits.MaxKeySize {"{"}</span>
                    <span className="code-line">		<span className="code-keyword">return</span> Record{}, <span className="code-integer">0</span>, ErrKeyTooLarge</span>
                    <span className="code-line">	{"}"}</span>
                    <span className="code-line">	key := make([]<span className="code-keyword">byte</span>, keyLen)</span>
                    <span className="code-line">	<span className="code-keyword">if</span> _, err := io.ReadFull(f, key); err != nil {"{"}</span>
                    <span className="code-line">		<span className="code-keyword">return</span> Record{}, <span className="code-integer">0</span>, mapRecordEOF(err, start)</span>
                    <span className="code-line">	{"}"}</span>
                    <span className="code-line">	<span className="code-keyword">var</span> valueLen <span className="code-keyword">uint32</span></span>
                    <span className="code-line">	<span className="code-keyword">if</span> err := binary.Read(f, binary.BigEndian, &valueLen); err != nil {"{"}</span>
                    <span className="code-line">		<span className="code-keyword">return</span> Record{}, <span className="code-integer">0</span>, mapRecordEOF(err, start)</span>
                    <span className="code-line">	{"}"}</span>
                    <span className="code-line">	<span className="code-keyword">if</span> valueLen &gt; limits.MaxValueSize {"{"}</span>
                    <span className="code-line">		<span className="code-keyword">return</span> Record{}, <span className="code-integer">0</span>, ErrValueTooLarge</span>
                    <span className="code-line">	{"}"}</span>
                    <span className="code-line">	<span className="code-keyword">if</span> err := limits.validateRecord(keyLen, valueLen); err != nil {"{"}</span>
                    <span className="code-line">		<span className="code-keyword">return</span> Record{}, <span className="code-integer">0</span>, err</span>
                    <span className="code-line">	{"}"}</span>
                    <span className="code-line">	value := make([]<span className="code-keyword">byte</span>, valueLen)</span>
                    <span className="code-line">	<span className="code-keyword">if</span> _, err := io.ReadFull(f, value); err != nil {"{"}</span>
                    <span className="code-line">		<span className="code-keyword">return</span> Record{}, <span className="code-integer">0</span>, mapRecordEOF(err, start)</span>
                    <span className="code-line">	{"}"}</span>
                    <span className="code-line">	<span className="code-keyword">var</span> tombByte <span className="code-keyword">byte</span></span>
                    <span className="code-line">	<span className="code-keyword">if</span> err := binary.Read(f, binary.BigEndian, &tombByte); err != nil {"{"}</span>
                    <span className="code-line">		<span className="code-keyword">return</span> Record{}, <span className="code-integer">0</span>, mapRecordEOF(err, start)</span>
                    <span className="code-line">	{"}"}</span>
                    <span className="code-line">	<span className="code-keyword">var</span> checksum <span className="code-keyword">uint32</span></span>
                    <span className="code-line">	<span className="code-keyword">if</span> err := binary.Read(f, binary.BigEndian, &checksum); err != nil {"{"}</span>
                    <span className="code-line">		<span className="code-keyword">return</span> Record{}, <span className="code-integer">0</span>, mapRecordEOF(err, start)</span>
                    <span className="code-line">	{"}"}</span>
                    <span className="code-line">	end, err := f.Seek(<span className="code-integer">0</span>, io.SeekCurrent)</span>
                    <span className="code-line">	<span className="code-keyword">if</span> err != nil {"{"}</span>
                    <span className="code-line">		<span className="code-keyword">return</span> Record{}, <span className="code-integer">0</span>, err</span>
                    <span className="code-line">	{"}"}</span>
                    <span className="code-line">	buf := make([]<span className="code-keyword">byte</span>, <span className="code-integer">0</span>, <span className="code-integer">4</span>+int(keyLen)+<span className="code-integer">4</span>+int(valueLen)+<span className="code-integer">1</span>)</span>
                    <span className="code-line">	buf = binary.BigEndian.AppendUint32(buf, keyLen)</span>
                    <span className="code-line">	buf = append(buf, key...)</span>
                    <span className="code-line">	buf = binary.BigEndian.AppendUint32(buf, valueLen)</span>
                    <span className="code-line">	buf = append(buf, value...)</span>
                    <span className="code-line">	buf = append(buf, tombByte)</span>
                    <span className="code-line">	<span className="code-keyword">if</span> crc32.ChecksumIEEE(buf) != checksum {"{"}</span>
                    <span className="code-line">		<span className="code-keyword">return</span> Record{}, <span className="code-integer">0</span>, io.ErrUnexpectedEOF</span>
                    <span className="code-line">	{"}"}</span>
                    <span className="code-line">	<span className="code-keyword">return</span> Record{"{"}</span>
                    <span className="code-line">		Key:       key,</span>
                    <span className="code-line">		Value:     value,</span>
                    <span className="code-line">		Tombstone: tombByte == <span className="code-integer">1</span>,</span>
                    <span className="code-line">	{"}"}, end - start, nil</span>
                    <span className="code-line">{"}"}</span>
                  </code>
                </pre>
              </div>

              <h2 className="guide-sub-heading" id="truncation-algorithm" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>6. The Copy-Rename Truncation Algorithm</h2>
              <p>
                When the active memtable is flushed to disk as an SSTable, the portion of the WAL containing those writes is no longer needed. To reclaim space, the database truncates the WAL up to the cutoff offset (walCutoff).
              </p>
              <p>
                PebbleDB avoids in-place file truncations (which can be blocked by file locks on Windows) by using a copy-rename strategy:
              </p>

              <div className="guide-code-block-container" style={{ marginTop: 12, marginBottom: 20 }}>
                <pre className="guide-code-pre">
                  <code className="guide-code-lines">
                    <span className="code-line"><span className="code-keyword">func</span> (w *WAL) <span className="code-function">TruncateBefore</span>(truncateAt <span className="code-keyword">int64</span>) <span className="code-keyword">error</span> {"{"}</span>
                    <span className="code-line">	w.mu.Lock()</span>
                    <span className="code-line">	<span className="code-keyword">defer</span> w.mu.Unlock()</span>
                    <span className="code-line">	<span className="code-keyword">if</span> truncateAt &lt;= <span className="code-integer">0</span> {"{"}</span>
                    <span className="code-line">		<span className="code-keyword">return</span> nil</span>
                    <span className="code-line">	{"}"}</span>
                    <span className="code-line">	<span className="code-keyword">if</span> err := w.file.Sync(); err != nil {"{"}</span>
                    <span className="code-line">		<span className="code-keyword">return</span> err</span>
                    <span className="code-line">	{"}"}</span>
                    <span className="code-line">	fi, err := w.file.Stat()</span>
                    <span className="code-line">	<span className="code-keyword">if</span> err != nil {"{"}</span>
                    <span className="code-line">		<span className="code-keyword">return</span> err</span>
                    <span className="code-line">	{"}"}</span>
                    <span className="code-line">	size := fi.Size()</span>
                    <span className="code-line">	<span className="code-keyword">if</span> truncateAt &gt;= size {"{"}</span>
                    <span className="code-line">		<span className="code-keyword">return</span> w.reopenEmptyLocked()</span>
                    <span className="code-line">	{"}"}</span>
                    <span className="code-line">	tmpPath := w.path + <span className="code-string">".truncate.tmp"</span></span>
                    <span className="code-line">	<span className="code-keyword">if</span> err := w.copyWalTailLocked(truncateAt, size, tmpPath); err != nil {"{"}</span>
                    <span className="code-line">		os.Remove(tmpPath)</span>
                    <span className="code-line">		<span className="code-keyword">return</span> err</span>
                    <span className="code-line">	{"}"}</span>
                    <span className="code-line">	<span className="code-keyword">if</span> err := w.file.Close(); err != nil {"{"}</span>
                    <span className="code-line">		os.Remove(tmpPath)</span>
                    <span className="code-line">		<span className="code-keyword">return</span> w.reopenAppendAfterTruncateErr(err)</span>
                    <span className="code-line">	{"}"}</span>
                    <span className="code-line">	w.file = nil</span>
                    <span className="code-line">	<span className="code-keyword">if</span> err := os.Rename(tmpPath, w.path); err != nil {"{"}</span>
                    <span className="code-line">		os.Remove(tmpPath)</span>
                    <span className="code-line">		<span className="code-keyword">if</span> reopenErr := w.reopenAppend(); reopenErr != nil {"{"}</span>
                    <span className="code-line">			<span className="code-keyword">return</span> errors.Join(err, reopenErr)</span>
                    <span className="code-line">		{"}"}</span>
                    <span className="code-line">		<span className="code-keyword">return</span> err</span>
                    <span className="code-line">	{"}"}</span>
                    <span className="code-line">	<span className="code-keyword">return</span> w.reopenAppend()</span>
                    <span className="code-line">{"}"}</span>
                  </code>
                </pre>
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

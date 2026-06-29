import DocsNavbar from "../components/DocsNavbar";
import DocsSidebar from "../components/DocsSidebar";

const pageTopics = [
  { label: "Role in the LSM", href: "#lsm-role" },
  { label: "Manifest Record & Edit Formats", href: "#record-formats" },
  { label: "Log Representation & Rotation", href: "#log-rotation" },
];

function ManifestLsmSvg() {
  return (
    <svg viewBox="0 0 500 220" className="w-full h-auto bg-[#0e0e11] border border-zinc-800 rounded-lg p-6 my-6" style={{ marginTop: 24, marginBottom: 24 }}>
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#71717a" />
        </marker>
      </defs>

      {/* CURRENT File */}
      <rect x="20" y="90" width="100" height="32" rx="4" fill="#18181b" stroke="#52525b" strokeWidth="1" />
      <text x="70" y="110" fill="#ffffff" fontSize="10" textAnchor="middle" fontWeight="bold">CURRENT File</text>

      {/* active manifest */}
      <path d="M 120 106 H 180" stroke="#ff5cad" strokeWidth="1.2" markerEnd="url(#arrow)" />
      <rect x="180" y="80" width="130" height="52" rx="4" fill="#18181b" stroke="#ff5cad" strokeWidth="1.2" />
      <text x="245" y="103" fill="#ffffff" fontSize="10" textAnchor="middle" fontWeight="bold">MANIFEST-XXXXXX</text>
      <text x="245" y="117" fill="#a1a1aa" fontSize="8" textAnchor="middle">Append-only Transaction Log</text>

      {/* operations */}
      <path d="M 310 106 H 370" stroke="#71717a" strokeWidth="1.2" />
      <path d="M 370 40 V 170" stroke="#71717a" strokeWidth="1.2" />
      
      <path d="M 370 40 H 400" stroke="#71717a" strokeWidth="1.2" markerEnd="url(#arrow)" />
      <text x="410" y="43" fill="#ffffff" fontSize="8" textAnchor="start">Flush Added: tagNewFile (0x01)</text>

      <path d="M 370 106 H 400" stroke="#71717a" strokeWidth="1.2" markerEnd="url(#arrow)" />
      <text x="410" y="109" fill="#ffffff" fontSize="8" textAnchor="start">Compact Deleted: tagDeleteFile (0x02)</text>

      <path d="M 370 170 H 400" stroke="#71717a" strokeWidth="1.2" markerEnd="url(#arrow)" />
      <text x="410" y="173" fill="#ffffff" fontSize="8" textAnchor="start">Snapshot: tagSetFileSet (0x03)</text>
    </svg>
  );
}

export default function ManifestDocsPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="manifest-title">PebbleDB Subsystem: Manifest</h1>
            
            <div className="guide-body-text" style={{ marginTop: 24 }}>
              <p>
                This document specifies the Manifest subsystem in PebbleDB, detailing its on-disk transaction log format, edit application rules, log replay recovery, and snapshot compaction rotation mechanisms.
              </p>

              <h2 className="guide-sub-heading" id="lsm-role" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>1. Role in the LSM</h2>
              <p>
                The Manifest is the source of truth for the active set of SSTables. It records edits to the file set, such as additions from flushes and deletions from compactions:
              </p>

              <ManifestLsmSvg />

              <h2 className="guide-sub-heading" id="record-formats" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>2. Manifest Record & Edit Formats</h2>
              <p>
                The manifest is an append-only binary log. Each record consists of:
              </p>
              <ul className="guide-bullets-list">
                <li>
                  <span className="highlight-text">RecordLength (4 bytes, Big-Endian uint32)</span>: Length of the payload + checksum.
                </li>
                <li>
                  <span className="highlight-text">Checksum (4 bytes, Big-Endian uint32)</span>: CRC32-IEEE checksum calculated over the payload.
                </li>
                <li>
                  <span className="highlight-text">Payload (Variable length)</span>: Starts with a 1-byte command tag.
                </li>
              </ul>

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>2.1 Edit Tags</h3>
              {/* Table of Edit Tags */}
              <div style={{ overflowX: "auto", marginTop: 16, marginBottom: 20 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13, border: "1px solid rgba(255, 255, 255, 0.08)" }}>
                  <thead>
                    <tr style={{ background: "rgba(255, 92, 173, 0.08)", borderBottom: "1px solid rgba(255, 255, 255, 0.15)" }}>
                      <th style={{ padding: "10px 16px", color: "#ff5cad", fontWeight: 600 }}>Tag Value</th>
                      <th style={{ padding: "10px 16px", color: "#ff5cad", fontWeight: 600 }}>Tag Constant</th>
                      <th style={{ padding: "10px 16px", color: "#ff5cad", fontWeight: 600 }}>Format Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace" }}>0x01</td>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace" }}>tagNewFile</td>
                      <td style={{ padding: "10px 16px" }}>Followed by an 8-byte uint64 representation of the new SSTable ID.</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace" }}>0x02</td>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace" }}>tagDeleteFile</td>
                      <td style={{ padding: "10px 16px" }}>Followed by an 8-byte uint64 representation of the obsolete SSTable ID.</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace" }}>0x03</td>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace" }}>tagSetFileSet</td>
                      <td style={{ padding: "10px 16px" }}>Followed by a 4-byte count and a list of 8-byte SSTable IDs.</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>2.2 Go Implementation: Record Serialization</h3>
              <div className="guide-code-block-container" style={{ marginTop: 8, marginBottom: 20 }}>
                <pre className="guide-code-pre">
                  <code className="guide-code-lines">
                    <span className="code-line"><span className="code-keyword">const</span> {"("}</span>
                    <span className="code-line">	tagNewFile    <span className="code-keyword">byte</span> = <span className="code-integer">0x01</span></span>
                    <span className="code-line">	tagDeleteFile <span className="code-keyword">byte</span> = <span className="code-integer">0x02</span></span>
                    <span className="code-line">	tagSetFileSet <span className="code-keyword">byte</span> = <span className="code-integer">0x03</span></span>
                    <span className="code-line">{")"}</span>
                    <span className="code-line"><span className="code-keyword">func</span> <span className="code-function">encodeRecord</span>(payload []<span className="code-keyword">byte</span>) []<span className="code-keyword">byte</span> {"{"}</span>
                    <span className="code-line">	checksum := crc32.ChecksumIEEE(payload)</span>
                    <span className="code-line">	recordLen := uint32(len(payload) + <span className="code-integer">4</span>)</span>
                    <span className="code-line">	buf := make([]<span className="code-keyword">byte</span>, <span className="code-integer">4</span>+<span className="code-integer">4</span>+len(payload))</span>
                    <span className="code-line">	binary.BigEndian.PutUint32(buf[<span className="code-integer">0</span>:<span className="code-integer">4</span>], recordLen)</span>
                    <span className="code-line">	binary.BigEndian.PutUint32(buf[<span className="code-integer">4</span>:<span className="code-integer">8</span>], checksum)</span>
                    <span className="code-line">	copy(buf[<span className="code-integer">8</span>:], payload)</span>
                    <span className="code-line">	<span className="code-keyword">return</span> buf</span>
                    <span className="code-line">{"}"}</span>
                  </code>
                </pre>
              </div>

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>2.3 Go Implementation: Edit Application</h3>
              <div className="guide-code-block-container" style={{ marginTop: 8, marginBottom: 20 }}>
                <pre className="guide-code-pre">
                  <code className="guide-code-lines">
                    <span className="code-line"><span className="code-keyword">func</span> <span className="code-function">applyEdit</span>(liveSet <span className="code-keyword">map</span>[<span className="code-keyword">uint64</span>]<span className="code-keyword">struct</span>{"{}"}, payload []<span className="code-keyword">byte</span>) <span className="code-keyword">error</span> {"{"}</span>
                    <span className="code-line">	<span className="code-keyword">if</span> len(payload) &lt; <span className="code-integer">1</span> {"{"}</span>
                    <span className="code-line">		<span className="code-keyword">return</span> io.ErrUnexpectedEOF</span>
                    <span className="code-line">	{"}"}</span>
                    <span className="code-line">	<span className="code-keyword">switch</span> payload[<span className="code-integer">0</span>] {"{"}</span>
                    <span className="code-line">	<span className="code-keyword">case</span> tagNewFile:</span>
                    <span className="code-line">		<span className="code-keyword">if</span> len(payload) &lt; <span className="code-integer">9</span> {"{"} <span className="code-keyword">return</span> io.ErrUnexpectedEOF {"}"}</span>
                    <span className="code-line">		id := binary.BigEndian.Uint64(payload[<span className="code-integer">1</span>:<span className="code-integer">9</span>])</span>
                    <span className="code-line">		liveSet[id] = <span className="code-keyword">struct</span>{"{}"}</span>
                    <span className="code-line">	<span className="code-keyword">case</span> tagDeleteFile:</span>
                    <span className="code-line">		<span className="code-keyword">if</span> len(payload) &lt; <span className="code-integer">9</span> {"{"} <span className="code-keyword">return</span> io.ErrUnexpectedEOF {"}"}</span>
                    <span className="code-line">		id := binary.BigEndian.Uint64(payload[<span className="code-integer">1</span>:<span className="code-integer">9</span>])</span>
                    <span className="code-line">		delete(liveSet, id)</span>
                    <span className="code-line">	<span className="code-keyword">case</span> tagSetFileSet:</span>
                    <span className="code-line">		<span className="code-keyword">if</span> len(payload) &lt; <span className="code-integer">5</span> {"{"} <span className="code-keyword">return</span> io.ErrUnexpectedEOF {"}"}</span>
                    <span className="code-line">		count := binary.BigEndian.Uint32(payload[<span className="code-integer">1</span>:<span className="code-integer">5</span>])</span>
                    <span className="code-line">		need := <span className="code-integer">5</span> + int(count)*<span className="code-integer">8</span></span>
                    <span className="code-line">		<span className="code-keyword">if</span> len(payload) &lt; need {"{"} <span className="code-keyword">return</span> io.ErrUnexpectedEOF {"}"}</span>
                    <span className="code-line">		next := make(<span className="code-keyword">map</span>[<span className="code-keyword">uint64</span>]<span className="code-keyword">struct</span>{"{}"}, count)</span>
                    <span className="code-line">		<span className="code-keyword">for</span> i := uint32(<span className="code-integer">0</span>); i &lt; count; i++ {"{"}</span>
                    <span className="code-line">			id := binary.BigEndian.Uint64(payload[<span className="code-integer">5</span>+i*<span className="code-integer">8</span> : <span className="code-integer">5</span>+(i+<span className="code-integer">1</span>)*<span className="code-integer">8</span>])</span>
                    <span className="code-line">			next[id] = <span className="code-keyword">struct</span>{"{}"}</span>
                    <span className="code-line">		{"}"}</span>
                    <span className="code-line">		clear(liveSet)</span>
                    <span className="code-line">		<span className="code-keyword">for</span> id := <span className="code-keyword">range</span> next {"{"}</span>
                    <span className="code-line">			liveSet[id] = <span className="code-keyword">struct</span>{"{}"}</span>
                    <span className="code-line">		{"}"}</span>
                    <span className="code-line">	<span className="code-keyword">default</span>:</span>
                    <span className="code-line">		<span className="code-keyword">return</span> io.ErrUnexpectedEOF</span>
                    <span className="code-line">	{"}"}</span>
                    <span className="code-line">	<span className="code-keyword">return</span> nil</span>
                    <span className="code-line">{"}"}</span>
                  </code>
                </pre>
              </div>

              <h2 className="guide-sub-heading" id="log-rotation" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>3. Log Representation & Current Rotation</h2>
              <p>
                Access to the manifest is serialized using a mutex (l.mu):
              </p>
              <div className="guide-code-block-container" style={{ marginTop: 8, marginBottom: 20 }}>
                <pre className="guide-code-pre">
                  <code className="guide-code-lines">
                    <span className="code-line"><span className="code-keyword">type</span> Log <span className="code-keyword">struct</span> {"{"}</span>
                    <span className="code-line">	dir         <span className="code-keyword">string</span></span>
                    <span className="code-line">	path        <span className="code-keyword">string</span></span>
                    <span className="code-line">	file        *os.File</span>
                    <span className="code-line">	mu          sync.Mutex</span>
                    <span className="code-line">	liveSet     <span className="code-keyword">map</span>[<span className="code-keyword">uint64</span>]<span className="code-keyword">struct</span>{"{}"}</span>
                    <span className="code-line">	recordCount <span className="code-keyword">int</span></span>
                    <span className="code-line">{"}"}</span>
                  </code>
                </pre>
              </div>

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>3.1 Atomic Manifest Rotation (MaybeCompact)</h3>
              <p>
                As compaction and flush workers run, the manifest grows. If it contains too many records (exceeding 64 records) or its file size exceeds 64 KiB, the database compacts the log:
              </p>
              <div className="guide-code-block-container" style={{ marginTop: 8, marginBottom: 20 }}>
                <pre className="guide-code-pre">
                  <code className="guide-code-lines">
                    <span className="code-line"><span className="code-keyword">func</span> (l *Log) <span className="code-function">MaybeCompact</span>() <span className="code-keyword">error</span> {"{"}</span>
                    <span className="code-line">	l.mu.Lock()</span>
                    <span className="code-line">	<span className="code-keyword">defer</span> l.mu.Unlock()</span>
                    <span className="code-line">	<span className="code-keyword">if</span> !l.compactionNeededLocked() {"{"}</span>
                    <span className="code-line">		<span className="code-keyword">return</span> nil</span>
                    <span className="code-line">	{"}"}</span>
                    <span className="code-line">	<span className="code-keyword">return</span> l.rotateSnapshotLocked()</span>
                    <span className="code-line">{"}"}</span>
                  </code>
                </pre>
              </div>

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>3.2 Updating the CURRENT pointer</h3>
              <div className="guide-code-block-container" style={{ marginTop: 8, marginBottom: 20 }}>
                <pre className="guide-code-pre">
                  <code className="guide-code-lines">
                    <span className="code-line"><span className="code-keyword">func</span> <span className="code-function">writeCurrent</span>(dir, manifestFile <span className="code-keyword">string</span>) <span className="code-keyword">error</span> {"{"}</span>
                    <span className="code-line">	currentPath := filepath.Join(dir, currentFileName)</span>
                    <span className="code-line">	tmpPath := currentPath + <span className="code-string">".tmp"</span></span>
                    <span className="code-line">	f, err := os.OpenFile(tmpPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, <span className="code-integer">0644</span>)</span>
                    <span className="code-line">	<span className="code-keyword">if</span> err != nil {"{"} <span className="code-keyword">return</span> err {"}"}</span>
                    <span className="code-line">	</span>
                    <span className="code-line">	content := []byte(manifestFile + <span className="code-string">"\n"</span>)</span>
                    <span className="code-line">	<span className="code-keyword">if</span> _, err := f.Write(content); err != nil {"{"}</span>
                    <span className="code-line">		f.Close()</span>
                    <span className="code-line">		os.Remove(tmpPath)</span>
                    <span className="code-line">		<span className="code-keyword">return</span> err</span>
                    <span className="code-line">	{"}"}</span>
                    <span className="code-line"><span className="code-keyword">if</span> err := f.Sync(); err != nil {"{"}</span>
                    <span className="code-line">		f.Close()</span>
                    <span className="code-line">		os.Remove(tmpPath)</span>
                    <span className="code-line">		<span className="code-keyword">return</span> err</span>
                    <span className="code-line">	{"}"}</span>
                    <span className="code-line">	f.Close()</span>
                    <span className="code-line">	<span className="code-keyword">return</span> os.Rename(tmpPath, currentPath)</span>
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

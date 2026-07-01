import DocsNavbar from "@/components/docs/DocsNavbar";
import DocsSidebar from "@/components/docs/DocsSidebar";

const pageTopics = [
  { label: "Role in the LSM", href: "#role-in-lsm" },
  { label: "Iterator Interface Contract", href: "#iterator-interface" },
  { label: "Structural Definitions", href: "#structural-defs" },
  { label: "Core Merge Algorithm", href: "#merge-algorithm" },
  { label: "Priority Resolution Walkthrough", href: "#priority-walkthrough" },
  { label: "Dual-Mode Operation", href: "#dual-mode" },
  { label: "SSTable Adapter Bridge", href: "#adapter-bridge" },
  { label: "Complexity Analysis", href: "#complexity" },
];

/* ──────────────────────────────────────────────
   SVG: mergeStep Flowchart
   ────────────────────────────────────────────── */
function MergeStepFlowSvg() {
  return (
    <svg viewBox="0 0 700 520" className="w-full h-auto bg-[#0e0e11] border border-zinc-800 rounded-lg p-4 my-6" style={{ marginTop: 24, marginBottom: 24 }}>
      <defs>
        <marker id="arrowMerge" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#71717a" />
        </marker>
      </defs>

      {/* 1. mergeStep() */}
      <rect x="250" y="10" width="200" height="34" rx="4" fill="#18181b" stroke="#ff5cad" strokeWidth="1.2" />
      <text x="350" y="31" fill="#ffffff" fontSize="12" textAnchor="middle" fontWeight="bold">mergeStep()</text>

      {/* Arrow down */}
      <line x1="350" y1="44" x2="350" y2="68" stroke="#71717a" strokeWidth="1.2" markerEnd="url(#arrowMerge)" />

      {/* 2. minKeyAcrossSources */}
      <rect x="220" y="68" width="260" height="34" rx="4" fill="#18181b" stroke="#52525b" strokeWidth="1" />
      <text x="350" y="89" fill="#ffffff" fontSize="11" textAnchor="middle">minKeyAcrossSources(srcs)</text>

      {/* Arrow down */}
      <line x1="350" y1="102" x2="350" y2="130" stroke="#71717a" strokeWidth="1.2" markerEnd="url(#arrowMerge)" />

      {/* 3. Diamond: minKey == nil? */}
      <polygon points="350,130 430,160 350,190 270,160" fill="#18181b" stroke="#52525b" strokeWidth="1" />
      <text x="350" y="164" fill="#ffffff" fontSize="10" textAnchor="middle">minKey == nil?</text>

      {/* yes → return empty */}
      <line x1="430" y1="160" x2="530" y2="160" stroke="#71717a" strokeWidth="1.2" markerEnd="url(#arrowMerge)" />
      <text x="470" y="152" fill="#a1a1aa" fontSize="9" textAnchor="middle">yes</text>
      <rect x="530" y="143" width="160" height="34" rx="4" fill="#18181b" stroke="#52525b" strokeWidth="1" />
      <text x="610" y="164" fill="#ffffff" fontSize="9" textAnchor="middle">return (nil, nil, false, false, nil)</text>

      {/* no → continue */}
      <line x1="350" y1="190" x2="350" y2="218" stroke="#71717a" strokeWidth="1.2" markerEnd="url(#arrowMerge)" />
      <text x="360" y="208" fill="#a1a1aa" fontSize="9">no</text>

      {/* 4. For each source where key == minKey */}
      <rect x="170" y="218" width="360" height="34" rx="4" fill="#18181b" stroke="#52525b" strokeWidth="1" />
      <text x="350" y="239" fill="#ffffff" fontSize="11" textAnchor="middle">For each source where key == minKey</text>

      {/* Arrow down */}
      <line x1="350" y1="252" x2="350" y2="278" stroke="#71717a" strokeWidth="1.2" markerEnd="url(#arrowMerge)" />

      {/* 5. Diamond: priority > bestPri? */}
      <polygon points="350,278 440,308 350,338 260,308" fill="#18181b" stroke="#52525b" strokeWidth="1" />
      <text x="350" y="312" fill="#ffffff" fontSize="10" textAnchor="middle">priority {">"} bestPri?</text>

      {/* yes → winner */}
      <line x1="440" y1="308" x2="540" y2="308" stroke="#71717a" strokeWidth="1.2" markerEnd="url(#arrowMerge)" />
      <text x="480" y="300" fill="#a1a1aa" fontSize="9" textAnchor="middle">yes</text>
      <rect x="540" y="291" width="150" height="34" rx="4" fill="#18181b" stroke="#ff5cad" strokeWidth="1" />
      <text x="615" y="312" fill="#ffffff" fontSize="10" textAnchor="middle">winner = this entry</text>

      {/* no → skip */}
      <line x1="260" y1="308" x2="160" y2="308" stroke="#71717a" strokeWidth="1.2" markerEnd="url(#arrowMerge)" />
      <text x="220" y="300" fill="#a1a1aa" fontSize="9" textAnchor="middle">no</text>
      <rect x="80" y="291" width="80" height="34" rx="4" fill="#18181b" stroke="#52525b" strokeWidth="1" />
      <text x="120" y="312" fill="#ffffff" fontSize="10" textAnchor="middle">skip</text>

      {/* Arrow from winner diamond down → Advance */}
      <line x1="350" y1="338" x2="350" y2="368" stroke="#71717a" strokeWidth="1.2" markerEnd="url(#arrowMerge)" />

      {/* 6. Advance ALL sources at minKey */}
      <rect x="160" y="368" width="380" height="34" rx="4" fill="#18181b" stroke="#52525b" strokeWidth="1" />
      <text x="350" y="389" fill="#ffffff" fontSize="11" textAnchor="middle">Advance ALL sources at minKey via Next()</text>

      {/* Arrow down */}
      <line x1="350" y1="402" x2="350" y2="430" stroke="#71717a" strokeWidth="1.2" markerEnd="url(#arrowMerge)" />

      {/* 7. Diamond: tombstone AND omitTombstones? */}
      <polygon points="350,430 470,460 350,490 230,460" fill="#18181b" stroke="#52525b" strokeWidth="1" />
      <text x="350" y="458" fill="#ffffff" fontSize="9" textAnchor="middle">tombstone AND</text>
      <text x="350" y="470" fill="#ffffff" fontSize="9" textAnchor="middle">omitTombstones?</text>

      {/* yes → loop back (skip) */}
      <line x1="230" y1="460" x2="100" y2="460" stroke="#71717a" strokeWidth="1.2" />
      <line x1="100" y1="460" x2="100" y2="85" stroke="#71717a" strokeWidth="1.2" />
      <line x1="100" y1="85" x2="220" y2="85" stroke="#71717a" strokeWidth="1.2" markerEnd="url(#arrowMerge)" />
      <text x="160" y="452" fill="#a1a1aa" fontSize="9" textAnchor="middle">yes (loop)</text>

      {/* no → return */}
      <line x1="470" y1="460" x2="530" y2="460" stroke="#71717a" strokeWidth="1.2" markerEnd="url(#arrowMerge)" />
      <text x="495" y="452" fill="#a1a1aa" fontSize="9" textAnchor="middle">no</text>
      <rect x="530" y="443" width="160" height="34" rx="4" fill="#18181b" stroke="#ff5cad" strokeWidth="1.2" />
      <text x="610" y="458" fill="#ffffff" fontSize="9" textAnchor="middle">return (key, value,</text>
      <text x="610" y="470" fill="#ffffff" fontSize="9" textAnchor="middle">tombstone, true, nil)</text>
    </svg>
  );
}

/* ──────────────────────────────────────────────
   SVG: Scan Mode Flow
   ────────────────────────────────────────────── */
function ScanModeFlowSvg() {
  return (
    <svg viewBox="0 0 700 320" className="w-full h-auto bg-[#0e0e11] border border-zinc-800 rounded-lg p-4 my-6" style={{ marginTop: 24, marginBottom: 24 }}>
      <defs>
        <marker id="arrowScan" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#71717a" />
        </marker>
      </defs>

      {/* 1. db.Scan() */}
      <rect x="20" y="20" width="120" height="34" rx="4" fill="#18181b" stroke="#ff5cad" strokeWidth="1.2" />
      <text x="80" y="41" fill="#ffffff" fontSize="11" textAnchor="middle" fontWeight="bold">db.Scan()</text>

      <line x1="140" y1="37" x2="175" y2="37" stroke="#71717a" strokeWidth="1.2" markerEnd="url(#arrowScan)" />

      {/* 2. Snapshot */}
      <rect x="175" y="20" width="210" height="34" rx="4" fill="#18181b" stroke="#52525b" strokeWidth="1" />
      <text x="280" y="41" fill="#ffffff" fontSize="10" textAnchor="middle">Snapshot memtable + pin SST readers</text>

      <line x1="385" y1="37" x2="420" y2="37" stroke="#71717a" strokeWidth="1.2" markerEnd="url(#arrowScan)" />

      {/* 3. NewMergeIterator */}
      <rect x="420" y="20" width="260" height="34" rx="4" fill="#18181b" stroke="#52525b" strokeWidth="1" />
      <text x="550" y="41" fill="#ffffff" fontSize="10" textAnchor="middle">NewMergeIterator(sources, priorities)</text>

      <line x1="550" y1="54" x2="550" y2="84" stroke="#71717a" strokeWidth="1.2" markerEnd="url(#arrowScan)" />

      {/* 4. Seek */}
      <rect x="450" y="84" width="200" height="34" rx="4" fill="#18181b" stroke="#52525b" strokeWidth="1" />
      <text x="550" y="105" fill="#ffffff" fontSize="11" textAnchor="middle">merge.Seek(startKey)</text>

      <line x1="550" y1="118" x2="550" y2="150" stroke="#71717a" strokeWidth="1.2" markerEnd="url(#arrowScan)" />

      {/* 5. Diamond: Valid? */}
      <polygon points="550,150 630,180 550,210 470,180" fill="#18181b" stroke="#52525b" strokeWidth="1" />
      <text x="550" y="184" fill="#ffffff" fontSize="10" textAnchor="middle">merge.Valid()?</text>

      {/* yes → yield */}
      <line x1="550" y1="210" x2="550" y2="240" stroke="#71717a" strokeWidth="1.2" markerEnd="url(#arrowScan)" />
      <text x="562" y="228" fill="#a1a1aa" fontSize="9">yes</text>

      <rect x="400" y="240" width="300" height="34" rx="4" fill="#18181b" stroke="#ff5cad" strokeWidth="1" />
      <text x="550" y="261" fill="#ffffff" fontSize="10" textAnchor="middle">Yield merge.Key() / merge.Value() → merge.Next()</text>

      {/* loop back */}
      <line x1="400" y1="257" x2="370" y2="257" stroke="#71717a" strokeWidth="1.2" />
      <line x1="370" y1="257" x2="370" y2="180" stroke="#71717a" strokeWidth="1.2" />
      <line x1="370" y1="180" x2="470" y2="180" stroke="#71717a" strokeWidth="1.2" markerEnd="url(#arrowScan)" />

      {/* no → close */}
      <line x1="630" y1="180" x2="670" y2="180" stroke="#71717a" strokeWidth="1.2" />
      <text x="648" y="172" fill="#a1a1aa" fontSize="9">no</text>
      <line x1="670" y1="180" x2="670" y2="290" stroke="#71717a" strokeWidth="1.2" markerEnd="url(#arrowScan)" />
      <rect x="600" y="290" width="140" height="28" rx="4" fill="#18181b" stroke="#52525b" strokeWidth="1" />
      <text x="670" y="308" fill="#ffffff" fontSize="10" textAnchor="middle">merge.Close()</text>
    </svg>
  );
}

export default function MergeIteratorDocsPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="merge-iterator-title">PebbleDB Subsystem: Merge Iterator</h1>

            <div className="guide-body-text" style={{ marginTop: 24 }}>
              <p>
                This document specifies the Merge Iterator subsystem in PebbleDB, detailing the Iterator interface contract, priority-based k-way merging, tombstone filtering modes, the compaction adapter bridge, and step-by-step execution flow diagrams.
              </p>

              {/* ── 1. Role in the LSM ── */}
              <h2 className="guide-sub-heading" id="role-in-lsm" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>1. Role in the LSM</h2>
              <p>
                An LSM database stores data across multiple overlapping structures — the active memtable, frozen memtables, and a stack of SSTables on disk. A single key may exist in several of these structures simultaneously, each with a different value or tombstone status. The Merge Iterator is the subsystem that unifies all of these sources into a single, deduplicated, sorted stream.
              </p>
              <p style={{ marginTop: 12 }}>It is invoked in two critical paths:</p>

              {/* Invocation table */}
              <div style={{ overflowX: "auto", marginTop: 16, marginBottom: 20 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13, border: "1px solid rgba(255, 255, 255, 0.08)" }}>
                  <thead>
                    <tr style={{ background: "rgba(255, 92, 173, 0.08)", borderBottom: "1px solid rgba(255, 255, 255, 0.15)" }}>
                      <th style={{ padding: "10px 16px", color: "#ff5cad", fontWeight: 600 }}>Path</th>
                      <th style={{ padding: "10px 16px", color: "#ff5cad", fontWeight: 600 }}>Entry Point</th>
                      <th style={{ padding: "10px 16px", color: "#ff5cad", fontWeight: 600 }}>Tombstone Mode</th>
                      <th style={{ padding: "10px 16px", color: "#ff5cad", fontWeight: 600 }}>Purpose</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={{ padding: "10px 16px", fontWeight: 500, color: "#ffffff" }}>Scan</td>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace" }}>db.Scan() → NewMergeIterator</td>
                      <td style={{ padding: "10px 16px" }}>omitTombstones = true</td>
                      <td style={{ padding: "10px 16px" }}>Returns only live keys to the user</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={{ padding: "10px 16px", fontWeight: 500, color: "#ffffff" }}>Compaction</td>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace" }}>compactFiles() → ForEachMerged</td>
                      <td style={{ padding: "10px 16px" }}>omitTombstones = false</td>
                      <td style={{ padding: "10px 16px" }}>Preserves tombstones to shadow older SSTables</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* ── 2. Iterator Interface ── */}
              <h2 className="guide-sub-heading" id="iterator-interface" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>2. The Iterator Interface Contract</h2>
              <p>
                Every data source (memtable snapshots, SSTable readers) must implement this interface to participate in a merge:
              </p>
              <div className="guide-code-block-container" style={{ marginTop: 8, marginBottom: 20 }}>
                <pre className="guide-code-pre">
                  <code className="guide-code-lines">
                    <span className="code-line"><span className="code-keyword">type</span> Iterator <span className="code-keyword">interface</span> {"{"}</span>
                    <span className="code-line">{"    "}Valid() <span className="code-keyword">bool</span>            <span className="code-comment">// Is the cursor positioned at a valid entry?</span></span>
                    <span className="code-line">{"    "}Next() <span className="code-keyword">error</span>            <span className="code-comment">// Advance to the next entry</span></span>
                    <span className="code-line">{"    "}Key() []<span className="code-keyword">byte</span>            <span className="code-comment">// Current key (undefined if !Valid)</span></span>
                    <span className="code-line">{"    "}Value() []<span className="code-keyword">byte</span>          <span className="code-comment">// Current value (nil for tombstones)</span></span>
                    <span className="code-line">{"    "}IsTombstone() <span className="code-keyword">bool</span>      <span className="code-comment">// Is the current entry a deletion marker?</span></span>
                    <span className="code-line">{"    "}Seek(key []<span className="code-keyword">byte</span>) <span className="code-keyword">error</span>  <span className="code-comment">// Position at the first key {">"}= target</span></span>
                    <span className="code-line">{"    "}Close() <span className="code-keyword">error</span>           <span className="code-comment">// Release resources</span></span>
                    <span className="code-line">{"}"}</span>
                  </code>
                </pre>
              </div>

              {/* ── 3. Structural Definitions ── */}
              <h2 className="guide-sub-heading" id="structural-defs" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>3. Structural Definitions</h2>

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>3.1 Source: An Iterator With Priority</h3>
              <p>
                Each source pairs an iterator with a numeric priority. Higher priority values represent newer data and win conflict resolution:
              </p>
              <div className="guide-code-block-container" style={{ marginTop: 8, marginBottom: 20 }}>
                <pre className="guide-code-pre">
                  <code className="guide-code-lines">
                    <span className="code-line"><span className="code-keyword">type</span> source <span className="code-keyword">struct</span> {"{"}</span>
                    <span className="code-line">{"    "}it       Iterator</span>
                    <span className="code-line">{"    "}priority <span className="code-keyword">int</span></span>
                    <span className="code-line">{"}"}</span>
                  </code>
                </pre>
              </div>

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>3.2 MergeIterator: The Unified Stream</h3>
              <p>
                The merge iterator holds an array of sources and caches the current winning key/value:
              </p>
              <div className="guide-code-block-container" style={{ marginTop: 8, marginBottom: 20 }}>
                <pre className="guide-code-pre">
                  <code className="guide-code-lines">
                    <span className="code-line"><span className="code-keyword">type</span> MergeIterator <span className="code-keyword">struct</span> {"{"}</span>
                    <span className="code-line">{"    "}sources []source</span>
                    <span className="code-line">{"    "}key     []<span className="code-keyword">byte</span></span>
                    <span className="code-line">{"    "}value   []<span className="code-keyword">byte</span></span>
                    <span className="code-line">{"    "}valid   <span className="code-keyword">bool</span></span>
                    <span className="code-line">{"    "}err     <span className="code-keyword">error</span></span>
                    <span className="code-line">{"}"}</span>
                    <span className="code-line"> </span>
                    <span className="code-line"><span className="code-keyword">func</span> <span className="code-function">NewMergeIterator</span>(sources []Iterator, priorities []<span className="code-keyword">int</span>) (*MergeIterator, <span className="code-keyword">error</span>) {"{"}</span>
                    <span className="code-line">{"    "}<span className="code-keyword">if</span> len(sources) != len(priorities) {"{"}</span>
                    <span className="code-line">{"        "}<span className="code-keyword">return</span> nil, ErrPriorityMismatch</span>
                    <span className="code-line">{"    "}{"}"}</span>
                    <span className="code-line">{"    "}m := &MergeIterator{"{"}</span>
                    <span className="code-line">{"        "}sources: make([]source, len(sources)),</span>
                    <span className="code-line">{"    "}{"}"}</span>
                    <span className="code-line">{"    "}<span className="code-keyword">for</span> i := <span className="code-keyword">range</span> sources {"{"}</span>
                    <span className="code-line">{"        "}m.sources[i] = source{"{"}it: sources[i], priority: priorities[i]{"}"}</span>
                    <span className="code-line">{"    "}{"}"}</span>
                    <span className="code-line">{"    "}<span className="code-keyword">return</span> m, nil</span>
                    <span className="code-line">{"}"}</span>
                  </code>
                </pre>
              </div>

              {/* ── 4. Core Merge Algorithm ── */}
              <h2 className="guide-sub-heading" id="merge-algorithm" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>4. The Core Merge Algorithm (mergeStep)</h2>
              <p>
                The heart of the system is the <span className="highlight-text">mergeStep</span> function. It finds the lexicographically smallest key across all sources, resolves conflicts using priority, and advances all tied sources past that key.
              </p>

              <MergeStepFlowSvg />

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>4.1 Go Implementation</h3>
              <div className="guide-code-block-container" style={{ marginTop: 8, marginBottom: 20 }}>
                <pre className="guide-code-pre">
                  <code className="guide-code-lines">
                    <span className="code-line"><span className="code-keyword">func</span> <span className="code-function">mergeStep</span>(srcs []source, omitTombstones <span className="code-keyword">bool</span>) (key, value []<span className="code-keyword">byte</span>, tombstone <span className="code-keyword">bool</span>, ok <span className="code-keyword">bool</span>, err <span className="code-keyword">error</span>) {"{"}</span>
                    <span className="code-line">{"    "}<span className="code-keyword">for</span> {"{"}</span>
                    <span className="code-line">{"        "}minKey := minKeyAcrossSources(srcs)</span>
                    <span className="code-line">{"        "}<span className="code-keyword">if</span> minKey == nil {"{"}</span>
                    <span className="code-line">{"            "}<span className="code-keyword">return</span> nil, nil, <span className="code-keyword">false</span>, <span className="code-keyword">false</span>, nil</span>
                    <span className="code-line">{"        "}{"}"}</span>
                    <span className="code-line">{"        "}bestPri := <span className="code-integer">-1</span></span>
                    <span className="code-line">{"        "}<span className="code-keyword">var</span> winnerKey, winnerVal []<span className="code-keyword">byte</span></span>
                    <span className="code-line">{"        "}winnerTomb := <span className="code-keyword">false</span></span>
                    <span className="code-line">{"        "}<span className="code-keyword">var</span> toAdvance []Iterator</span>
                    <span className="code-line">{"        "}<span className="code-keyword">for</span> _, s := <span className="code-keyword">range</span> srcs {"{"}</span>
                    <span className="code-line">{"            "}<span className="code-keyword">if</span> !s.it.Valid() {"{"}</span>
                    <span className="code-line">{"                "}<span className="code-keyword">continue</span></span>
                    <span className="code-line">{"            "}{"}"}</span>
                    <span className="code-line">{"            "}<span className="code-keyword">if</span> !bytes.Equal(s.it.Key(), minKey) {"{"}</span>
                    <span className="code-line">{"                "}<span className="code-keyword">continue</span></span>
                    <span className="code-line">{"            "}{"}"}</span>
                    <span className="code-line">{"            "}<span className="code-keyword">if</span> s.priority {">"} bestPri {"{"}</span>
                    <span className="code-line">{"                "}bestPri = s.priority</span>
                    <span className="code-line">{"                "}winnerKey = s.it.Key()</span>
                    <span className="code-line">{"                "}winnerVal = s.it.Value()</span>
                    <span className="code-line">{"                "}winnerTomb = s.it.IsTombstone()</span>
                    <span className="code-line">{"            "}{"}"}</span>
                    <span className="code-line">{"            "}toAdvance = append(toAdvance, s.it)</span>
                    <span className="code-line">{"        "}{"}"}</span>
                    <span className="code-line">{"        "}<span className="code-keyword">for</span> _, it := <span className="code-keyword">range</span> toAdvance {"{"}</span>
                    <span className="code-line">{"            "}<span className="code-keyword">if</span> err := it.Next(); err != nil {"{"}</span>
                    <span className="code-line">{"                "}<span className="code-keyword">return</span> nil, nil, <span className="code-keyword">false</span>, <span className="code-keyword">false</span>, err</span>
                    <span className="code-line">{"            "}{"}"}</span>
                    <span className="code-line">{"        "}{"}"}</span>
                    <span className="code-line">{"        "}<span className="code-keyword">if</span> winnerTomb && omitTombstones {"{"}</span>
                    <span className="code-line">{"            "}<span className="code-keyword">continue</span>  <span className="code-comment">// silently skip; loop again for next key</span></span>
                    <span className="code-line">{"        "}{"}"}</span>
                    <span className="code-line">{"        "}<span className="code-keyword">return</span> winnerKey, winnerVal, winnerTomb, <span className="code-keyword">true</span>, nil</span>
                    <span className="code-line">{"    "}{"}"}</span>
                    <span className="code-line">{"}"}</span>
                  </code>
                </pre>
              </div>

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>4.2 Minimum Key Discovery</h3>
              <div className="guide-code-block-container" style={{ marginTop: 8, marginBottom: 20 }}>
                <pre className="guide-code-pre">
                  <code className="guide-code-lines">
                    <span className="code-line"><span className="code-keyword">func</span> <span className="code-function">minKeyAcrossSources</span>(srcs []source) []<span className="code-keyword">byte</span> {"{"}</span>
                    <span className="code-line">{"    "}<span className="code-keyword">var</span> minKey []<span className="code-keyword">byte</span></span>
                    <span className="code-line">{"    "}<span className="code-keyword">for</span> _, s := <span className="code-keyword">range</span> srcs {"{"}</span>
                    <span className="code-line">{"        "}<span className="code-keyword">if</span> !s.it.Valid() {"{"}</span>
                    <span className="code-line">{"            "}<span className="code-keyword">continue</span></span>
                    <span className="code-line">{"        "}{"}"}</span>
                    <span className="code-line">{"        "}k := s.it.Key()</span>
                    <span className="code-line">{"        "}<span className="code-keyword">if</span> minKey == nil || bytes.Compare(k, minKey) {"<"} <span className="code-integer">0</span> {"{"}</span>
                    <span className="code-line">{"            "}minKey = k</span>
                    <span className="code-line">{"        "}{"}"}</span>
                    <span className="code-line">{"    "}{"}"}</span>
                    <span className="code-line">{"    "}<span className="code-keyword">return</span> minKey</span>
                    <span className="code-line">{"}"}</span>
                  </code>
                </pre>
              </div>

              {/* ── 5. Priority Resolution Walkthrough ── */}
              <h2 className="guide-sub-heading" id="priority-walkthrough" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>5. Walkthrough: Priority Resolution With Tombstones</h2>
              <p>
                The following table traces a <span className="highlight-text">mergeStep</span> execution over three sources. Source priorities are: SST-old = 0, SST-new = 1, Memtable = 2.
              </p>

              <div style={{ overflowX: "auto", marginTop: 16, marginBottom: 20 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13, border: "1px solid rgba(255, 255, 255, 0.08)" }}>
                  <thead>
                    <tr style={{ background: "rgba(255, 92, 173, 0.08)", borderBottom: "1px solid rgba(255, 255, 255, 0.15)" }}>
                      <th style={{ padding: "10px 16px", color: "#ff5cad", fontWeight: 600 }}>Step</th>
                      <th style={{ padding: "10px 16px", color: "#ff5cad", fontWeight: 600 }}>minKey</th>
                      <th style={{ padding: "10px 16px", color: "#ff5cad", fontWeight: 600 }}>Sources at minKey</th>
                      <th style={{ padding: "10px 16px", color: "#ff5cad", fontWeight: 600 }}>Winner</th>
                      <th style={{ padding: "10px 16px", color: "#ff5cad", fontWeight: 600 }}>Tombstone?</th>
                      <th style={{ padding: "10px 16px", color: "#ff5cad", fontWeight: 600 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={{ padding: "10px 16px", fontWeight: 500, color: "#ffffff" }}>1</td>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace" }}>"a"</td>
                      <td style={{ padding: "10px 16px" }}>SST-old("a"→"1"), Memtable("a"→"9")</td>
                      <td style={{ padding: "10px 16px" }}>Memtable (pri=2)</td>
                      <td style={{ padding: "10px 16px" }}>No</td>
                      <td style={{ padding: "10px 16px" }}>Yield "a"→"9", advance both</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={{ padding: "10px 16px", fontWeight: 500, color: "#ffffff" }}>2</td>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace" }}>"b"</td>
                      <td style={{ padding: "10px 16px" }}>SST-old("b"→"2")</td>
                      <td style={{ padding: "10px 16px" }}>SST-old (pri=0)</td>
                      <td style={{ padding: "10px 16px" }}>No</td>
                      <td style={{ padding: "10px 16px" }}>Yield "b"→"2", advance SST-old</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 92, 173, 0.05)" }}>
                      <td style={{ padding: "10px 16px", fontWeight: 500, color: "#ffffff" }}>3</td>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace" }}>"c"</td>
                      <td style={{ padding: "10px 16px" }}>SST-new("c"→∅ tomb), Memtable("c"→∅ tomb)</td>
                      <td style={{ padding: "10px 16px" }}>Memtable (pri=2)</td>
                      <td style={{ padding: "10px 16px", color: "#ff5cad" }}>Yes</td>
                      <td style={{ padding: "10px 16px" }}>Skip silently, advance both</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={{ padding: "10px 16px", fontWeight: 500, color: "#ffffff" }}>4</td>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace" }}>"d"</td>
                      <td style={{ padding: "10px 16px" }}>SST-new("d"→"4")</td>
                      <td style={{ padding: "10px 16px" }}>SST-new (pri=1)</td>
                      <td style={{ padding: "10px 16px" }}>No</td>
                      <td style={{ padding: "10px 16px" }}>Yield "d"→"4", advance SST-new</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={{ padding: "10px 16px", fontWeight: 500, color: "#ffffff" }}>5</td>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace" }}>nil</td>
                      <td style={{ padding: "10px 16px" }}>All exhausted</td>
                      <td style={{ padding: "10px 16px" }}>—</td>
                      <td style={{ padding: "10px 16px" }}>—</td>
                      <td style={{ padding: "10px 16px" }}>Return ok=false</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Important callout */}
              <div style={{ background: "rgba(255, 92, 173, 0.06)", border: "1px solid rgba(255, 92, 173, 0.25)", borderRadius: 8, padding: "16px 20px", marginTop: 16, marginBottom: 20 }}>
                <p style={{ color: "#ff5cad", fontWeight: 600, marginBottom: 6, fontSize: 13 }}>Warning: IMPORTANT</p>
                <p style={{ fontSize: 13, lineHeight: 1.7 }}>
                  At step 3, key "c" exists in two sources as a tombstone. The highest-priority source (Memtable) wins. Because <span className="highlight-text">omitTombstones = true</span> (scan mode), the tombstone is consumed but never returned to the caller. Both sources are still advanced past "c".
                </p>
              </div>

              {/* ── 6. Dual-Mode Operation ── */}
              <h2 className="guide-sub-heading" id="dual-mode" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>6. Dual-Mode Operation</h2>

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>6.1 Scan Mode (NewMergeIterator + Seek/Next)</h3>
              <p>
                Used by <span className="highlight-text">db.Scan()</span>. Returns only live entries. Tombstones are silently consumed.
              </p>

              <ScanModeFlowSvg />

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>6.2 Compaction Mode (ForEachMerged)</h3>
              <p>
                Used by the compactor to merge overlapping SSTable files. Tombstones are preserved so they can shadow older values in lower-level SSTables.
              </p>
              <div className="guide-code-block-container" style={{ marginTop: 8, marginBottom: 20 }}>
                <pre className="guide-code-pre">
                  <code className="guide-code-lines">
                    <span className="code-line"><span className="code-keyword">func</span> <span className="code-function">ForEachMerged</span>(sources []Iterator, priorities []<span className="code-keyword">int</span>, omitTombstones <span className="code-keyword">bool</span>,</span>
                    <span className="code-line">{"    "}fn <span className="code-keyword">func</span>(key, value []<span className="code-keyword">byte</span>, tombstone <span className="code-keyword">bool</span>) <span className="code-keyword">error</span>) <span className="code-keyword">error</span> {"{"}</span>
                    <span className="code-line">{"    "}<span className="code-keyword">if</span> len(sources) != len(priorities) {"{"}</span>
                    <span className="code-line">{"        "}<span className="code-keyword">return</span> ErrPriorityMismatch</span>
                    <span className="code-line">{"    "}{"}"}</span>
                    <span className="code-line">{"    "}srcs := make([]source, len(sources))</span>
                    <span className="code-line">{"    "}<span className="code-keyword">for</span> i := <span className="code-keyword">range</span> sources {"{"}</span>
                    <span className="code-line">{"        "}srcs[i] = source{"{"}it: sources[i], priority: priorities[i]{"}"}</span>
                    <span className="code-line">{"    "}{"}"}</span>
                    <span className="code-line">{"    "}<span className="code-keyword">for</span> {"{"}</span>
                    <span className="code-line">{"        "}key, value, tomb, ok, err := mergeStep(srcs, omitTombstones)</span>
                    <span className="code-line">{"        "}<span className="code-keyword">if</span> err != nil {"{"}</span>
                    <span className="code-line">{"            "}<span className="code-keyword">return</span> err</span>
                    <span className="code-line">{"        "}{"}"}</span>
                    <span className="code-line">{"        "}<span className="code-keyword">if</span> !ok {"{"}</span>
                    <span className="code-line">{"            "}<span className="code-keyword">return</span> nil</span>
                    <span className="code-line">{"        "}{"}"}</span>
                    <span className="code-line">{"        "}<span className="code-keyword">if</span> err := fn(key, value, tomb); err != nil {"{"}</span>
                    <span className="code-line">{"            "}<span className="code-keyword">return</span> err</span>
                    <span className="code-line">{"        "}{"}"}</span>
                    <span className="code-line">{"    "}{"}"}</span>
                    <span className="code-line">{"}"}</span>
                  </code>
                </pre>
              </div>

              {/* ── 7. SSTable Adapter Bridge ── */}
              <h2 className="guide-sub-heading" id="adapter-bridge" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>7. SSTable Adapter Bridge</h2>
              <p>
                SSTable <span className="highlight-text">*Iterator</span> uses a different interface than <span className="highlight-text">iterator.Iterator</span> (its Next() returns nothing, errors are accessed via Err()). An adapter bridges the gap:
              </p>
              <div className="guide-code-block-container" style={{ marginTop: 8, marginBottom: 20 }}>
                <pre className="guide-code-pre">
                  <code className="guide-code-lines">
                    <span className="code-line"><span className="code-keyword">type</span> iterAdapter <span className="code-keyword">struct</span> {"{"}</span>
                    <span className="code-line">{"    "}it *Iterator  <span className="code-comment">// sstable.Iterator</span></span>
                    <span className="code-line">{"}"}</span>
                    <span className="code-line"> </span>
                    <span className="code-line"><span className="code-keyword">func</span> (a *iterAdapter) <span className="code-function">Valid</span>() <span className="code-keyword">bool</span>       {"{"} <span className="code-keyword">return</span> a.it.Valid() {"}"}</span>
                    <span className="code-line"><span className="code-keyword">func</span> (a *iterAdapter) <span className="code-function">Key</span>() []<span className="code-keyword">byte</span>       {"{"} <span className="code-keyword">return</span> a.it.Key() {"}"}</span>
                    <span className="code-line"><span className="code-keyword">func</span> (a *iterAdapter) <span className="code-function">Value</span>() []<span className="code-keyword">byte</span>     {"{"} <span className="code-keyword">return</span> a.it.Value() {"}"}</span>
                    <span className="code-line"><span className="code-keyword">func</span> (a *iterAdapter) <span className="code-function">IsTombstone</span>() <span className="code-keyword">bool</span> {"{"} <span className="code-keyword">return</span> a.it.IsTombstone() {"}"}</span>
                    <span className="code-line"> </span>
                    <span className="code-line"><span className="code-keyword">func</span> (a *iterAdapter) <span className="code-function">Next</span>() <span className="code-keyword">error</span> {"{"}</span>
                    <span className="code-line">{"    "}a.it.Next()</span>
                    <span className="code-line">{"    "}<span className="code-keyword">return</span> a.it.Err()</span>
                    <span className="code-line">{"}"}</span>
                    <span className="code-line"> </span>
                    <span className="code-line"><span className="code-keyword">func</span> (a *iterAdapter) <span className="code-function">Seek</span>(key []<span className="code-keyword">byte</span>) <span className="code-keyword">error</span> {"{"}</span>
                    <span className="code-line">{"    "}<span className="code-keyword">return</span> a.it.Seek(key)</span>
                    <span className="code-line">{"}"}</span>
                    <span className="code-line"> </span>
                    <span className="code-line"><span className="code-keyword">func</span> (a *iterAdapter) <span className="code-function">Close</span>() <span className="code-keyword">error</span> {"{"}</span>
                    <span className="code-line">{"    "}<span className="code-keyword">return</span> a.it.Close()</span>
                    <span className="code-line">{"}"}</span>
                  </code>
                </pre>
              </div>

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>7.1 Compaction Wiring (mergeReaders)</h3>
              <div className="guide-code-block-container" style={{ marginTop: 8, marginBottom: 20 }}>
                <pre className="guide-code-pre">
                  <code className="guide-code-lines">
                    <span className="code-line"><span className="code-keyword">func</span> <span className="code-function">mergeReaders</span>(readers []*Reader, w *Writer, keepTombstones <span className="code-keyword">bool</span>) <span className="code-keyword">error</span> {"{"}</span>
                    <span className="code-line">{"    "}<span className="code-keyword">if</span> len(readers) == <span className="code-integer">0</span> {"{"}</span>
                    <span className="code-line">{"        "}<span className="code-keyword">return</span> nil</span>
                    <span className="code-line">{"    "}{"}"}</span>
                    <span className="code-line">{"    "}adapters := make([]iterator.Iterator, len(readers))</span>
                    <span className="code-line">{"    "}priorities := make([]<span className="code-keyword">int</span>, len(readers))</span>
                    <span className="code-line">{"    "}<span className="code-keyword">for</span> i, r := <span className="code-keyword">range</span> readers {"{"}</span>
                    <span className="code-line">{"        "}adapters[i] = &iterAdapter{"{"}it: r.NewIterator(){"}"}</span>
                    <span className="code-line">{"        "}priorities[i] = i  <span className="code-comment">// higher index = newer file</span></span>
                    <span className="code-line">{"    "}{"}"}</span>
                    <span className="code-line">{"    "}<span className="code-keyword">defer</span> <span className="code-keyword">func</span>() {"{"}</span>
                    <span className="code-line">{"        "}<span className="code-keyword">for</span> _, a := <span className="code-keyword">range</span> adapters {"{"}</span>
                    <span className="code-line">{"            "}a.Close()</span>
                    <span className="code-line">{"        "}{"}"}</span>
                    <span className="code-line">{"    "}{"}"}</span>
                    <span className="code-line">{"    "}<span className="code-keyword">return</span> iterator.ForEachMerged(adapters, priorities, !keepTombstones,</span>
                    <span className="code-line">{"        "}<span className="code-keyword">func</span>(key, value []<span className="code-keyword">byte</span>, tombstone <span className="code-keyword">bool</span>) <span className="code-keyword">error</span> {"{"}</span>
                    <span className="code-line">{"            "}<span className="code-keyword">return</span> w.Add(key, value, tombstone)</span>
                    <span className="code-line">{"        "}{"}"}</span>
                    <span className="code-line">{"    "})</span>
                    <span className="code-line">{"}"}</span>
                  </code>
                </pre>
              </div>

              {/* ── 8. Complexity Analysis ── */}
              <h2 className="guide-sub-heading" id="complexity" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>8. Complexity Analysis</h2>

              <div style={{ overflowX: "auto", marginTop: 16, marginBottom: 20 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13, border: "1px solid rgba(255, 255, 255, 0.08)" }}>
                  <thead>
                    <tr style={{ background: "rgba(255, 92, 173, 0.08)", borderBottom: "1px solid rgba(255, 255, 255, 0.15)" }}>
                      <th style={{ padding: "10px 16px", color: "#ff5cad", fontWeight: 600 }}>Operation</th>
                      <th style={{ padding: "10px 16px", color: "#ff5cad", fontWeight: 600 }}>Time Complexity</th>
                      <th style={{ padding: "10px 16px", color: "#ff5cad", fontWeight: 600 }}>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={{ padding: "10px 16px", fontWeight: 500, color: "#ffffff" }}>minKeyAcrossSources</td>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace" }}>O(k)</td>
                      <td style={{ padding: "10px 16px" }}>Linear scan over k sources</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={{ padding: "10px 16px", fontWeight: 500, color: "#ffffff" }}>mergeStep (one call)</td>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace" }}>O(k)</td>
                      <td style={{ padding: "10px 16px" }}>Find min + scan ties + advance ties</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={{ padding: "10px 16px", fontWeight: 500, color: "#ffffff" }}>Full merge of N entries</td>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace" }}>O(N · k)</td>
                      <td style={{ padding: "10px 16px" }}>Each entry triggers one mergeStep</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={{ padding: "10px 16px", fontWeight: 500, color: "#ffffff" }}>Seek</td>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace" }}>O(k · log nᵢ)</td>
                      <td style={{ padding: "10px 16px" }}>Each source performs its own seek</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Tip callout */}
              <div style={{ background: "rgba(192, 132, 252, 0.06)", border: "1px solid rgba(192, 132, 252, 0.25)", borderRadius: 8, padding: "16px 20px", marginTop: 16, marginBottom: 20 }}>
                <p style={{ color: "#c084fc", fontWeight: 600, marginBottom: 6, fontSize: 13 }}>Note: TIP</p>
                <p style={{ fontSize: 13, lineHeight: 1.7 }}>
                  For large k (many SSTables), a min-heap would reduce per-step cost from O(k) to O(log k). PebbleDB uses the linear scan approach because compaction bounds k to a small number of overlapping files.
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

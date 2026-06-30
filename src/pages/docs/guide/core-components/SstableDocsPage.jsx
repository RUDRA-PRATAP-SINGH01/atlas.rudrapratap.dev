import DocsNavbar from "@/components/docs/DocsNavbar";
import DocsSidebar from "@/components/docs/DocsSidebar";

const pageTopics = [
  { label: "On-Disk Layout", href: "#ondisk-layout" },
  { label: "Block Formatting & Structure", href: "#block-formatting" },
  { label: "SSTable Writer Pipeline", href: "#writer-pipeline" },
  { label: "SSTable Reader & LRU Cache", href: "#reader-cache" },
];

function SstableLayoutSvg() {
  return (
    <svg viewBox="0 0 500 240" className="w-full h-auto bg-[#0e0e11] border border-zinc-800 rounded-lg p-6 my-6" style={{ marginTop: 24, marginBottom: 24 }}>
      {/* Block 0 */}
      <rect x="50" y="10" width="400" height="30" fill="#18181b" stroke="#52525b" strokeWidth="1" />
      <text x="250" y="28" fill="#ffffff" fontSize="10" textAnchor="middle" fontWeight="bold">Data Block 0 (≤ 4 KiB keys/values)</text>

      {/* Block 1 */}
      <rect x="50" y="48" width="400" height="30" fill="#18181b" stroke="#52525b" strokeWidth="1" />
      <text x="250" y="66" fill="#ffffff" fontSize="10" textAnchor="middle" fontWeight="bold">Data Block 1 (≤ 4 KiB keys/values)</text>

      {/* dots */}
      <text x="250" y="98" fill="#a1a1aa" fontSize="12" textAnchor="middle">...</text>

      {/* Index */}
      <rect x="50" y="114" width="400" height="30" fill="#18181b" stroke="#ff5cad" strokeWidth="1" />
      <text x="250" y="132" fill="#ffffff" fontSize="10" textAnchor="middle" fontWeight="bold">Index Block (Offset & length of each data block)</text>

      {/* Bloom */}
      <rect x="50" y="152" width="400" height="30" fill="#18181b" stroke="#52525b" strokeWidth="1" />
      <text x="250" y="170" fill="#ffffff" fontSize="10" textAnchor="middle" fontWeight="bold">Bloom Filter Block (Key presence bitmap)</text>

      {/* Footer */}
      <rect x="50" y="190" width="400" height="30" rx="2" fill="#18181b" stroke="#ff5cad" strokeWidth="1.2" />
      <text x="250" y="208" fill="#ffffff" fontSize="10" textAnchor="middle" fontWeight="bold">Footer (48 Bytes: index & bloom offsets, magic)</text>
    </svg>
  );
}

export default function SstableDocsPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="sstable-title">PebbleDB Subsystem: SSTable</h1>
            
            <div className="guide-body-text" style={{ marginTop: 24 }}>
              <p>
                This document specifies the Sorted String Table (SSTable) subsystem in PebbleDB, detailing the on-disk file layout, data block structures, binary indexing, Bloom filters, LRU block caching, and reader/writer execution pipelines.
              </p>

              <h2 className="guide-sub-heading" id="ondisk-layout" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>1. On-Disk Layout</h2>
              <p>
                An SSTable is an immutable file containing sorted key-value entries. The file layout consists of sequential data blocks, followed by an index block, a Bloom filter block, and a terminal validating footer.
              </p>

              <SstableLayoutSvg />

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>1.1 Footer Format</h3>
              <p>
                The last 48 bytes of the file are reserved for the database footer:
              </p>
              <ul className="guide-bullets-list">
                <li>
                  <span className="highlight-text">IndexOffset (8 bytes)</span>: File offset where the index block starts.
                </li>
                <li>
                  <span className="highlight-text">IndexLength (8 bytes)</span>: Byte length of the index block.
                </li>
                <li>
                  <span className="highlight-text">BloomOffset (8 bytes)</span>: File offset where the Bloom filter starts.
                </li>
                <li>
                  <span className="highlight-text">BloomLength (8 bytes)</span>: Byte length of the Bloom filter.
                </li>
                <li>
                  <span className="highlight-text">Version (4 bytes)</span>: File format version (current version is 2).
                </li>
                <li>
                  <span className="highlight-text">Magic (4 bytes)</span>: Validating signature magic value (0x88e241b3).
                </li>
              </ul>

              <div className="guide-code-block-container" style={{ marginTop: 8, marginBottom: 20 }}>
                <pre className="guide-code-pre">
                  <code className="guide-code-lines">
                    <span className="code-line"><span className="code-keyword">type</span> Footer <span className="code-keyword">struct</span> {"{"}</span>
                    <span className="code-line">	IndexOffset <span className="code-keyword">uint64</span></span>
                    <span className="code-line">	IndexLength <span className="code-keyword">uint64</span></span>
                    <span className="code-line">	BloomOffset <span className="code-keyword">uint64</span></span>
                    <span className="code-line">	BloomLength <span className="code-keyword">uint64</span></span>
                    <span className="code-line">	Version     <span className="code-keyword">uint32</span></span>
                    <span className="code-line">	Magic       <span className="code-keyword">uint32</span></span>
                    <span className="code-line">{"}"}</span>
                  </code>
                </pre>
              </div>

              <h2 className="guide-sub-heading" id="block-formatting" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>2. Block Formatting & Binary Structure</h2>
              <p>
                Data is stored in fixed-size blocks (default 4 KiB). Within a block, records are serialized sequentially without prefix compression:
              </p>

              <div className="guide-code-block-container" style={{ marginTop: 8, marginBottom: 20 }}>
                <pre className="guide-code-pre">
                  <code className="guide-code-lines">
                    <span className="code-line">┌───────────────┬─────────────────┬─────────────────┬───────────────────┬────────────────┐</span>
                    <span className="code-line">│  keyLen (4B)  │  key (keyLen B) │  valueLen (4B)  │ value (valueLen B)│ tombstone (1B) │</span>
                    <span className="code-line">│  BigEndian U32│  Raw Byte Slice │  BigEndian U32  │  Raw Byte Slice   │ 0=Put / 1=Del  │</span>
                    <span className="code-line">└───────────────┴─────────────────┴─────────────────┴───────────────────┴────────────────┘</span>
                  </code>
                </pre>
              </div>

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>2.1 Go Implementation: Block Serialization</h3>
              <div className="guide-code-block-container" style={{ marginTop: 8, marginBottom: 20 }}>
                <pre className="guide-code-pre">
                  <code className="guide-code-lines">
                    <span className="code-line"><span className="code-keyword">type</span> Block <span className="code-keyword">struct</span> {"{"}</span>
                    <span className="code-line">	data []<span className="code-keyword">byte</span></span>
                    <span className="code-line">{"}"}</span>
                    <span className="code-line"><span className="code-keyword">func</span> (b *Block) <span className="code-function">Append</span>(key, value []<span className="code-keyword">byte</span>, tombstone <span className="code-keyword">bool</span>) <span className="code-keyword">error</span> {"{"}</span>
                    <span className="code-line">	<span className="code-keyword">if</span> len(key) &gt; math.MaxUint32 || len(value) &gt; math.MaxUint32 {"{"}</span>
                    <span className="code-line">		<span className="code-keyword">return</span> ErrKeyTooLarge</span>
                    <span className="code-line">	{"}"}</span>
                    <span className="code-line">	keyLen := uint32(len(key))</span>
                    <span className="code-line">	valLen := uint32(len(value))</span>
                    <span className="code-line">	tombByte := <span className="code-keyword">byte</span>(<span className="code-integer">0</span>)</span>
                    <span className="code-line">	<span className="code-keyword">if</span> tombstone {"{"}</span>
                    <span className="code-line">		tombByte = <span className="code-integer">1</span></span>
                    <span className="code-line">	{"}"}</span>
                    <span className="code-line">	buf := make([]<span className="code-keyword">byte</span>, <span className="code-integer">0</span>, <span className="code-integer">4</span>+keyLen+<span className="code-integer">4</span>+valLen+<span className="code-integer">1</span>)</span>
                    <span className="code-line">	buf = binary.BigEndian.AppendUint32(buf, keyLen)</span>
                    <span className="code-line">	buf = append(buf, key...)</span>
                    <span className="code-line">	buf = binary.BigEndian.AppendUint32(buf, valLen)</span>
                    <span className="code-line">	buf = append(buf, value...)</span>
                    <span className="code-line">	buf = append(buf, tombByte)</span>
                    <span className="code-line">	b.data = append(b.data, buf...)</span>
                    <span className="code-line">	<span className="code-keyword">return</span> nil</span>
                    <span className="code-line">{"}"}</span>
                  </code>
                </pre>
              </div>

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>2.2 Go Implementation: Block Iteration</h3>
              <div className="guide-code-block-container" style={{ marginTop: 8, marginBottom: 20 }}>
                <pre className="guide-code-pre">
                  <code className="guide-code-lines">
                    <span className="code-line"><span className="code-keyword">type</span> BlockIterator <span className="code-keyword">struct</span> {"{"}</span>
                    <span className="code-line">	data      []<span className="code-keyword">byte</span></span>
                    <span className="code-line">	pos       <span className="code-keyword">int</span></span>
                    <span className="code-line">	key       []<span className="code-keyword">byte</span></span>
                    <span className="code-line">	val       []<span className="code-keyword">byte</span></span>
                    <span className="code-line">	tombstone <span className="code-keyword">bool</span></span>
                    <span className="code-line">{"}"}</span>
                    <span className="code-line"><span className="code-keyword">func</span> (it *BlockIterator) <span className="code-function">Next</span>() <span className="code-keyword">bool</span> {"{"}</span>
                    <span className="code-line">	<span className="code-keyword">if</span> it.pos+<span className="code-integer">4</span> &gt; len(it.data) {"{"}</span>
                    <span className="code-line">		<span className="code-keyword">return</span> <span className="code-keyword">false</span></span>
                    <span className="code-line">	{"}"}</span>
                    <span className="code-line">	keyLen := binary.BigEndian.Uint32(it.data[it.pos:])</span>
                    <span className="code-line">	it.pos += <span className="code-integer">4</span></span>
                    <span className="code-line">	<span className="code-keyword">if</span> it.pos+int(keyLen) &gt; len(it.data) {"{"}</span>
                    <span className="code-line">		<span className="code-keyword">return</span> <span className="code-keyword">false</span></span>
                    <span className="code-line">	{"}"}</span>
                    <span className="code-line">	it.key = it.data[it.pos : it.pos+int(keyLen)]</span>
                    <span className="code-line">	it.pos += int(keyLen)</span>
                    <span className="code-line">	<span className="code-keyword">if</span> it.pos+<span className="code-integer">4</span> &gt; len(it.data) {"{"}</span>
                    <span className="code-line">		<span className="code-keyword">return</span> <span className="code-keyword">false</span></span>
                    <span className="code-line">	{"}"}</span>
                    <span className="code-line">	valLen := binary.BigEndian.Uint32(it.data[it.pos:])</span>
                    <span className="code-line">	it.pos += <span className="code-integer">4</span></span>
                    <span className="code-line">	<span className="code-keyword">if</span> it.pos+int(valLen) &gt; len(it.data) {"{"}</span>
                    <span className="code-line">		<span className="code-keyword">return</span> <span className="code-keyword">false</span></span>
                    <span className="code-line">	{"}"}</span>
                    <span className="code-line">	it.val = it.data[it.pos : it.pos+int(valLen)]</span>
                    <span className="code-line">	it.pos += int(valLen)</span>
                    <span className="code-line">	<span className="code-keyword">if</span> it.pos &gt;= len(it.data) {"{"}</span>
                    <span className="code-line">		<span className="code-keyword">return</span> <span className="code-keyword">false</span></span>
                    <span className="code-line">	{"}"}</span>
                    <span className="code-line">	tombByte := it.data[it.pos]</span>
                    <span className="code-line">	it.pos += <span className="code-integer">1</span></span>
                    <span className="code-line">	it.tombstone = tombByte == <span className="code-integer">1</span></span>
                    <span className="code-line">	<span className="code-keyword">return</span> <span className="code-keyword">true</span></span>
                    <span className="code-line">{"}"}</span>
                  </code>
                </pre>
              </div>

              <h2 className="guide-sub-heading" id="writer-pipeline" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>3. SSTable Writer Pipeline</h2>
              <p>
                The Writer creates files sequentially, keeping tracking structures in memory until final serialization:
              </p>
              <div className="guide-code-block-container" style={{ marginTop: 8, marginBottom: 20 }}>
                <pre className="guide-code-pre">
                  <code className="guide-code-lines">
                    <span className="code-line"><span className="code-keyword">type</span> Writer <span className="code-keyword">struct</span> {"{"}</span>
                    <span className="code-line">	file      *os.File</span>
                    <span className="code-line">	tmpPath   <span className="code-keyword">string</span></span>
                    <span className="code-line">	finalPath <span className="code-keyword">string</span></span>
                    <span className="code-line">	blockSize <span className="code-keyword">int</span></span>
                    <span className="code-line">	current   *Block</span>
                    <span className="code-line">	index     *IndexBlock</span>
                    <span className="code-line">	bloom     *bloom.Filter</span>
                    <span className="code-line">	lastKey   []<span className="code-keyword">byte</span></span>
                    <span className="code-line">	offset    <span className="code-keyword">uint64</span></span>
                    <span className="code-line">{"}"}</span>
                    <span className="code-line"><span className="code-keyword">func</span> (w *Writer) <span className="code-function">Add</span>(key, value []<span className="code-keyword">byte</span>, tombstone <span className="code-keyword">bool</span>) <span className="code-keyword">error</span> {"{"}</span>
                    <span className="code-line">	<span className="code-keyword">if</span> w.lastKey != nil &amp;&amp; bytes.Compare(key, w.lastKey) &lt;= <span className="code-integer">0</span> {"{"}</span>
                    <span className="code-line">		<span className="code-keyword">return</span> ErrKeyOutOfOrder</span>
                    <span className="code-line">	{"}"}</span>
                    <span className="code-line">	entrySize := <span className="code-integer">4</span> + len(key) + <span className="code-integer">4</span> + len(value) + <span className="code-integer">1</span></span>
                    <span className="code-line">	<span className="code-keyword">if</span> w.current.Size()+entrySize &gt; w.blockSize &amp;&amp; w.current.Size() &gt; <span className="code-integer">0</span> {"{"}</span>
                    <span className="code-line">		<span className="code-keyword">if</span> err := w.flushBlock(); err != nil {"{"}</span>
                    <span className="code-line">			<span className="code-keyword">return</span> err</span>
                    <span className="code-line">		{"}"}</span>
                    <span className="code-line">	{"}"}</span>
                    <span className="code-line">	<span className="code-keyword">if</span> err := w.current.Append(key, value, tombstone); err != nil {"{"}</span>
                    <span className="code-line">			<span className="code-keyword">return</span> err</span>
                    <span className="code-line">	{"}"}</span>
                    <span className="code-line">	w.bloom.Add(key)</span>
                    <span className="code-line">	w.lastKey = append([]<span className="code-keyword">byte</span>(nil), key...)</span>
                    <span className="code-line">	<span className="code-keyword">return</span> nil</span>
                    <span className="code-line">{"}"}</span>
                    <span className="code-line"><span className="code-keyword">func</span> (w *Writer) <span className="code-function">flushBlock</span>() <span className="code-keyword">error</span> {"{"}</span>
                    <span className="code-line">	blockData := w.current.Bytes()</span>
                    <span className="code-line">	n, err := w.file.Write(blockData)</span>
                    <span className="code-line">	<span className="code-keyword">if</span> err != nil {"{"}</span>
                    <span className="code-line">		<span className="code-keyword">return</span> err</span>
                    <span className="code-line">	{"}"}</span>
                    <span className="code-line">	w.index.Add(IndexEntry{"{"}</span>
                    <span className="code-line">		LastKey: append([]<span className="code-keyword">byte</span>(nil), w.lastKey...),</span>
                    <span className="code-line">		Offset:  w.offset,</span>
                    <span className="code-line">		Length:  uint64(n),</span>
                    <span className="code-line">	{"}"})</span>
                    <span className="code-line">	w.offset += uint64(n)</span>
                    <span className="code-line">	w.current.Reset()</span>
                    <span className="code-line">	<span className="code-keyword">return</span> nil</span>
                    <span className="code-line">{"}"}</span>
                  </code>
                </pre>
              </div>

              <h2 className="guide-sub-heading" id="reader-cache" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>4. SSTable Reader & LRU Block Cache</h2>
              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>4.1 Reader Representation</h3>
              <p>
                Reads check Bloom filters and search the block index to minimize disk access:
              </p>
              <div className="guide-code-block-container" style={{ marginTop: 8, marginBottom: 20 }}>
                <pre className="guide-code-pre">
                  <code className="guide-code-lines">
                    <span className="code-line"><span className="code-keyword">type</span> Reader <span className="code-keyword">struct</span> {"{"}</span>
                    <span className="code-line">	file           *os.File</span>
                    <span className="code-line">	path           <span className="code-keyword">string</span></span>
                    <span className="code-line">	footer         Footer</span>
                    <span className="code-line">	index          []IndexEntry</span>
                    <span className="code-line">	bloom          *bloom.Filter</span>
                    <span className="code-line">	fileID         <span className="code-keyword">uint64</span></span>
                    <span className="code-line">	blockCache     *BlockCache</span>
                    <span className="code-line">	refs           atomic.Int32</span>
                    <span className="code-line">	closePending   atomic.Bool</span>
                    <span className="code-line">	discardPending atomic.Bool</span>
                    <span className="code-line">	fileClosed     atomic.Bool</span>
                    <span className="code-line">	closeMu        sync.RWMutex</span>
                    <span className="code-line">{"}"}</span>
                  </code>
                </pre>
              </div>

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>4.2 LRU Block Cache</h3>
              <p>
                To prevent redundant disk reads, the BlockCache caches decompressed blocks. It uses the compound key {"{"}fileID, offset{"}"}:
              </p>
              <div className="guide-code-block-container" style={{ marginTop: 8, marginBottom: 20 }}>
                <pre className="guide-code-pre">
                  <code className="guide-code-lines">
                    <span className="code-line"><span className="code-keyword">type</span> blockCacheKey <span className="code-keyword">struct</span> {"{"}</span>
                    <span className="code-line">	fileID <span className="code-keyword">uint64</span></span>
                    <span className="code-line">	offset <span className="code-keyword">uint64</span></span>
                    <span className="code-line">{"}"}</span>
                    <span className="code-line"><span className="code-keyword">type</span> BlockCache <span className="code-keyword">struct</span> {"{"}</span>
                    <span className="code-line">	inner *lru.Cache[blockCacheKey, []<span className="code-keyword">byte</span>]</span>
                    <span className="code-line">	mu    sync.Mutex</span>
                    <span className="code-line">	bytes <span className="code-keyword">int</span></span>
                    <span className="code-line">	max   <span className="code-keyword">int</span></span>
                    <span className="code-line">{"}"}</span>
                    <span className="code-line"><span className="code-keyword">func</span> (c *BlockCache) <span className="code-function">add</span>(key blockCacheKey, block []<span className="code-keyword">byte</span>) {"{"}</span>
                    <span className="code-line">	<span className="code-keyword">if</span> c == nil {"{"} <span className="code-keyword">return</span> {"}"}</span>
                    <span className="code-line">	c.mu.Lock()</span>
                    <span className="code-line">	<span className="code-keyword">defer</span> c.mu.Unlock()</span>
                    <span className="code-line">	<span className="code-keyword">if</span> existing, ok := c.inner.Get(key); ok {"{"}</span>
                    <span className="code-line">		c.bytes -= len(existing)</span>
                    <span className="code-line">	{"}"}</span>
                    <span className="code-line">	stored := append([]<span className="code-keyword">byte</span>(nil), block...)</span>
                    <span className="code-line">	c.inner.Add(key, stored)</span>
                    <span className="code-line">	c.bytes += len(stored)</span>
                    <span className="code-line">	<span className="code-keyword">for</span> c.bytes &gt; c.max {"{"}</span>
                    <span className="code-line">		_, v, ok := c.inner.RemoveOldest()</span>
                    <span className="code-line">		<span className="code-keyword">if</span> !ok {"{"} <span className="code-keyword">break</span> {"}"}</span>
                    <span className="code-line">		c.bytes -= len(v)</span>
                    <span className="code-line">	{"}"}</span>
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

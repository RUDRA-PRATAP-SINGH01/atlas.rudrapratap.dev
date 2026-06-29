import DocsNavbar from "../components/DocsNavbar";
import DocsSidebar from "../components/DocsSidebar";

const pageTopics = [
  { label: "SkipList Architecture", href: "#skiplist-architecture" },
  { label: "Core Struct Definitions", href: "#struct-definitions" },
  { label: "Key Algorithms & Go Code", href: "#key-algorithms" },
];

function SkipListLevelsSvg() {
  return (
    <svg viewBox="0 0 500 160" className="w-full h-auto bg-[#0e0e11] border border-zinc-800 rounded-lg p-6 my-6" style={{ marginTop: 24, marginBottom: 24 }}>
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#71717a" />
        </marker>
      </defs>

      {/* Level 3 */}
      <text x="10" y="24" fill="#ff5cad" fontSize="9" fontWeight="bold">Level 3:</text>
      <rect x="60" y="12" width="40" height="18" fill="#18181b" stroke="#52525b" />
      <text x="80" y="24" fill="#ffffff" fontSize="9" textAnchor="middle">Head</text>

      <path d="M 100 21 H 274" stroke="#ff5cad" strokeWidth="1" markerEnd="url(#arrow)" />
      
      <rect x="274" y="12" width="50" height="18" fill="#18181b" stroke="#ff5cad" />
      <text x="299" y="24" fill="#ffffff" fontSize="9" textAnchor="middle">Node(C)</text>

      <path d="M 324 21 H 430" stroke="#71717a" strokeWidth="1" markerEnd="url(#arrow)" />
      <text x="450" y="24" fill="#a1a1aa" fontSize="9">Nil</text>

      {/* Level 2 */}
      <text x="10" y="60" fill="#a1a1aa" fontSize="9">Level 2:</text>
      <rect x="60" y="48" width="40" height="18" fill="#18181b" stroke="#52525b" />
      <text x="80" y="60" fill="#ffffff" fontSize="9" textAnchor="middle">Head</text>

      <path d="M 100 57 H 164" stroke="#71717a" strokeWidth="1" markerEnd="url(#arrow)" />

      <rect x="164" y="48" width="50" height="18" fill="#18181b" stroke="#52525b" />
      <text x="189" y="60" fill="#ffffff" fontSize="9" textAnchor="middle">Node(B)</text>

      <path d="M 214 57 H 274" stroke="#71717a" strokeWidth="1" markerEnd="url(#arrow)" />

      <rect x="274" y="48" width="50" height="18" fill="#18181b" stroke="#ff5cad" strokeWidth="1" />
      <text x="299" y="60" fill="#ffffff" fontSize="9" textAnchor="middle">Node(C)</text>

      <path d="M 324 57 H 430" stroke="#71717a" strokeWidth="1" markerEnd="url(#arrow)" />
      <text x="450" y="60" fill="#a1a1aa" fontSize="9">Nil</text>

      {/* Level 1 */}
      <text x="10" y="96" fill="#a1a1aa" fontSize="9">Level 1:</text>
      <rect x="60" y="84" width="40" height="18" fill="#18181b" stroke="#52525b" />
      <text x="80" y="96" fill="#ffffff" fontSize="9" textAnchor="middle">Head</text>

      <path d="M 100 93 H 114" stroke="#71717a" strokeWidth="1" markerEnd="url(#arrow)" />

      <rect x="114" y="84" width="50" height="18" fill="#18181b" stroke="#52525b" />
      <text x="139" y="96" fill="#ffffff" fontSize="9" textAnchor="middle">Node(A)</text>

      <path d="M 164 93 H 180" stroke="#71717a" strokeWidth="1" markerEnd="url(#arrow)" />

      {/* Level 0 */}
      <text x="10" y="132" fill="#a1a1aa" fontSize="9">Level 0:</text>
      <rect x="60" y="120" width="40" height="18" fill="#18181b" stroke="#52525b" />
      <text x="80" y="132" fill="#ffffff" fontSize="9" textAnchor="middle">Head</text>
      
      <path d="M 100 129 H 114" stroke="#71717a" strokeWidth="1" markerEnd="url(#arrow)" />
      
      <rect x="114" y="120" width="50" height="18" fill="#18181b" stroke="#52525b" />
      <text x="139" y="132" fill="#ffffff" fontSize="9" textAnchor="middle">Node(A)</text>
      
      <path d="M 164 129 H 174" stroke="#71717a" strokeWidth="1" />
    </svg>
  );
}

export default function SkipListDocsPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="skiplist-title">PebbleDB Subsystem: SkipList</h1>
            
            <div className="guide-body-text" style={{ marginTop: 24 }}>
              <p>
                This document specifies the design and implementation of PebbleDB's core concurrent SkipList data structure, detailing its probabilistic level design, node search traversal, pointer updates, and synchronization mechanisms.
              </p>

              <h2 className="guide-sub-heading" id="skiplist-architecture" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>1. SkipList Architecture</h2>
              <p>
                A SkipList is a probabilistic alternative to balanced trees. It maintains a linked list of nodes sorted lexicographically. To speed up searches, it maintains an array of forward pointers (next) representing the node's presence across different heights, allowing searches to bypass subsets of elements.
              </p>

              <SkipListLevelsSvg />

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>1.1 Structural Constants</h3>
              <p>
                PebbleDB configures the SkipList with two primary parameters:
              </p>
              <ul className="guide-bullets-list">
                <li>
                  <span className="highlight-text">maxHeight = 20</span>: The maximum height allowed for a node. This handles up to 1,000,000 active entries efficiently.
                </li>
                <li>
                  <span className="highlight-text">p = 0.25</span>: The probability that a node is promoted to the next level during insertion. This balances memory overhead and lookup performance.
                </li>
              </ul>

              <h2 className="guide-sub-heading" id="struct-definitions" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>2. Core Struct Definitions</h2>
              
              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>2.1 Node Representation</h3>
              <p>
                Each SkipList node stores a single key-value record and maintains an array of forward pointers (next) representing the node's presence across different levels of the SkipList.
              </p>
              <div className="guide-code-block-container" style={{ marginTop: 8, marginBottom: 20 }}>
                <pre className="guide-code-pre">
                  <code className="guide-code-lines">
                    <span className="code-line"><span className="code-keyword">type</span> node <span className="code-keyword">struct</span> {"{"}</span>
                    <span className="code-line">	key       []<span className="code-keyword">byte</span></span>
                    <span className="code-line">	value     []<span className="code-keyword">byte</span></span>
                    <span className="code-line">	tombstone <span className="code-keyword">bool</span></span>
                    <span className="code-line">	next      []*node <span className="code-comment">// pointers to next nodes at each level</span></span>
                    <span className="code-line">{"}"}</span>
                  </code>
                </pre>
              </div>

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>2.2 SkipList Representation</h3>
              <p>
                The SkipList uses a readers-writer lock (sync.RWMutex) to synchronize access across thread boundaries.
              </p>
              <div className="guide-code-block-container" style={{ marginTop: 8, marginBottom: 20 }}>
                <pre className="guide-code-pre">
                  <code className="guide-code-lines">
                    <span className="code-line"><span className="code-keyword">type</span> SkipList <span className="code-keyword">struct</span> {"{"}</span>
                    <span className="code-line">	mu     sync.RWMutex</span>
                    <span className="code-line">	head   *node</span>
                    <span className="code-line">	height <span className="code-keyword">int</span>   <span className="code-comment">// current max level</span></span>
                    <span className="code-line">	length <span className="code-keyword">int</span>   <span className="code-comment">// number of entries (including tombstones)</span></span>
                    <span className="code-line">	size   <span className="code-keyword">int64</span> <span className="code-comment">// approximate byte size (used only for flush threshold)</span></span>
                    <span className="code-line">	rng    *rand.Rand</span>
                    <span className="code-line">{"}"}</span>
                  </code>
                </pre>
              </div>

              <h2 className="guide-sub-heading" id="key-algorithms" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>3. Key Algorithms & Go Implementations</h2>
              
              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>3.1 Random Height Generation</h3>
              <div className="guide-code-block-container" style={{ marginTop: 8, marginBottom: 20 }}>
                <pre className="guide-code-pre">
                  <code className="guide-code-lines">
                    <span className="code-line"><span className="code-keyword">func</span> (sl *SkipList) <span className="code-function">randomHeight</span>() <span className="code-keyword">int</span> {"{"}</span>
                    <span className="code-line">	h := <span className="code-integer">1</span></span>
                    <span className="code-line">	<span className="code-keyword">for</span> sl.rng.Float64() &lt; p &amp;&amp; h &lt; maxHeight {"{"}</span>
                    <span className="code-line">		h++</span>
                    <span className="code-line">	{"}"}</span>
                    <span className="code-line">	<span className="code-keyword">return</span> h</span>
                    <span className="code-line">{"}"}</span>
                  </code>
                </pre>
              </div>

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>3.2 Key Traversal and Insertion (Put)</h3>
              <p>
                Insertion locks the SkipList exclusively. It starts at the top level and searches forward until the next key is greater than or equal to the target key. It repeats this search at lower levels to build a list of update positions, then updates the forward pointers:
              </p>
              <div className="guide-code-block-container" style={{ marginTop: 8, marginBottom: 20 }}>
                <pre className="guide-code-pre">
                  <code className="guide-code-lines">
                    <span className="code-line"><span className="code-keyword">func</span> (sl *SkipList) <span className="code-function">Put</span>(key, value []<span className="code-keyword">byte</span>) {"{"}</span>
                    <span className="code-line">	sl.mu.Lock()</span>
                    <span className="code-line">	<span className="code-keyword">defer</span> sl.mu.Unlock()</span>
                    <span className="code-line">	update := make([]*node, maxHeight)</span>
                    <span className="code-line">	x := sl.head</span>
                    <span className="code-line">	<span className="code-keyword">for</span> i := sl.height - <span className="code-integer">1</span>; i &gt;= <span className="code-integer">0</span>; i-- {"{"}</span>
                    <span className="code-line">		<span className="code-keyword">for</span> x.next[i] != nil &amp;&amp; less(x.next[i].key, key) {"{"}</span>
                    <span className="code-line">			x = x.next[i]</span>
                    <span className="code-line">		{"}"}</span>
                    <span className="code-line">		update[i] = x</span>
                    <span className="code-line">	{"}"}</span>
                    <span className="code-line">	x = x.next[<span className="code-integer">0</span>]</span>
                    <span className="code-line">	<span className="code-keyword">if</span> x != nil &amp;&amp; equal(x.key, key) {"{"}</span>
                    <span className="code-line">		<span className="code-comment">// update existing – copy both key and value to avoid aliasing</span></span>
                    <span className="code-line">		oldSize := int64(len(x.key) + len(x.value) + <span className="code-integer">8</span>)</span>
                    <span className="code-line">		newKey := append([]<span className="code-keyword">byte</span>(nil), key...)</span>
                    <span className="code-line">		newVal := append([]<span className="code-keyword">byte</span>(nil), value...)</span>
                    <span className="code-line">		sl.size -= oldSize</span>
                    <span className="code-line">		x.key = newKey</span>
                    <span className="code-line">		x.value = newVal</span>
                    <span className="code-line">		x.tombstone = <span className="code-keyword">false</span></span>
                    <span className="code-line">		sl.size += int64(len(newKey) + len(newVal) + <span className="code-integer">8</span>)</span>
                    <span className="code-line">		<span className="code-keyword">return</span></span>
                    <span className="code-line">	{"}"}</span>
                    <span className="code-line">	height := sl.randomHeight()</span>
                    <span className="code-line">	<span className="code-keyword">if</span> height &gt; sl.height {"{"}</span>
                    <span className="code-line">		<span className="code-keyword">for</span> i := sl.height; i &lt; height; i++ {"{"}</span>
                    <span className="code-line">			update[i] = sl.head</span>
                    <span className="code-line">		{"}"}</span>
                    <span className="code-line">		sl.height = height</span>
                    <span className="code-line">	{"}"}</span>
                    <span className="code-line">	<span className="code-comment">// copy key and value to avoid aliasing</span></span>
                    <span className="code-line">	keyCopy := append([]<span className="code-keyword">byte</span>(nil), key...)</span>
                    <span className="code-line">	valCopy := append([]<span className="code-keyword">byte</span>(nil), value...)</span>
                    <span className="code-line">	newNode := &amp;node{"{"}</span>
                    <span className="code-line">		key:   keyCopy,</span>
                    <span className="code-line">		value: valCopy,</span>
                    <span className="code-line">		next:  make([]*node, height),</span>
                    <span className="code-line">	{"}"}</span>
                    <span className="code-line">	<span className="code-keyword">for</span> i := <span className="code-integer">0</span>; i &lt; height; i++ {"{"}</span>
                    <span className="code-line">		newNode.next[i] = update[i].next[i]</span>
                    <span className="code-line">		update[i].next[i] = newNode</span>
                    <span className="code-line">	{"}"}</span>
                    <span className="code-line">	sl.length++</span>
                    <span className="code-line">	sl.size += int64(len(keyCopy) + len(valCopy) + <span className="code-integer">8</span>)</span>
                    <span className="code-line">{"}"}</span>
                  </code>
                </pre>
              </div>

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>3.3 Traversal and Probing (Get)</h3>
              <p>
                Point lookups acquire a shared read lock, allowing concurrent read threads to traverse the levels without blocking each other:
              </p>
              <div className="guide-code-block-container" style={{ marginTop: 8, marginBottom: 20 }}>
                <pre className="guide-code-pre">
                  <code className="guide-code-lines">
                    <span className="code-line"><span className="code-keyword">func</span> (sl *SkipList) <span className="code-function">Get</span>(key []<span className="code-keyword">byte</span>) (value []<span className="code-keyword">byte</span>, found <span className="code-keyword">bool</span>, isTombstone <span className="code-keyword">bool</span>) {"{"}</span>
                    <span className="code-line">	sl.mu.RLock()</span>
                    <span className="code-line">	<span className="code-keyword">defer</span> sl.mu.RUnlock()</span>
                    <span className="code-line">	x := sl.head</span>
                    <span className="code-line">	<span className="code-keyword">for</span> i := sl.height - <span className="code-integer">1</span>; i &gt;= <span className="code-integer">0</span>; i-- {"{"}</span>
                    <span className="code-line">		<span className="code-keyword">for</span> x.next[i] != nil &amp;&amp; less(x.next[i].key, key) {"{"}</span>
                    <span className="code-line">			x = x.next[i]</span>
                    <span className="code-line">		{"}"}</span>
                    <span className="code-line">	{"}"}</span>
                    <span className="code-line">	x = x.next[<span className="code-integer">0</span>]</span>
                    <span className="code-line">	<span className="code-keyword">if</span> x != nil &amp;&amp; equal(x.key, key) {"{"}</span>
                    <span className="code-line">		<span className="code-keyword">if</span> x.tombstone {"{"}</span>
                    <span className="code-line">			<span className="code-keyword">return</span> nil, <span className="code-keyword">true</span>, <span className="code-keyword">true</span></span>
                    <span className="code-line">		{"}"}</span>
                    <span className="code-line">		valCopy := append([]<span className="code-keyword">byte</span>(nil), x.value...)</span>
                    <span className="code-line">		<span className="code-keyword">return</span> valCopy, <span className="code-keyword">true</span>, <span className="code-keyword">false</span></span>
                    <span className="code-line">	{"}"}</span>
                    <span className="code-line">	<span className="code-keyword">return</span> nil, <span className="code-keyword">false</span>, <span className="code-keyword">false</span></span>
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

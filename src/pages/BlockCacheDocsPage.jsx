import DocsNavbar from "../components/DocsNavbar";
import DocsSidebar from "../components/DocsSidebar";

const pageTopics = [
  { label: "Block Cache Overview", href: "#overview" },
  { label: "Cache Architecture", href: "#architecture" },
  { label: "Memory Management & Eviction", href: "#memory" },
  { label: "Configuration & Tuning", href: "#config" },
];

export default function BlockCacheDocsPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />
        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="block-cache-title">
              PebbleDB Subsystem: Block Cache
            </h1>
            <div className="guide-body-text" style={{ marginTop: 24 }}>
              <p>
                The block cache subsystem stores recently accessed data blocks from SSTables in memory.
                By caching these blocks, PebbleDB avoids repeated disk reads for hot data, dramatically
                reducing read latency and improving overall throughput.
              </p>
              <h2 className="guide-sub-heading" id="overview" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                1. Overview
              </h2>
              <p>
                PebbleDB uses a byte‑bounded LRU (Least Recently Used) cache. Each cached block is keyed
                by a compound identifier (file number + offset) and the cache tracks total byte usage.
                When the configured limit is reached, the least‑recently accessed blocks are evicted.
              </p>
              <h2 className="guide-sub-heading" id="architecture" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                2. Cache Architecture
              </h2>
              <p>
                Internally the cache is a map from a <code className="inline-code">cacheKey</code> struct to
                a <code className="inline-code">cacheEntry</code> that holds the raw bytes and a reference count.
                The reference count prevents eviction while a block is in use by an iterator.
              </p>
              <pre className="guide-code-pre" style={{ background: "#18181b", padding: "12px", borderRadius: "6px", overflowX: "auto" }}>
                <code className="guide-code-lines">{`type cacheKey struct {
    fileNum uint64
    offset  uint64
}

type cacheEntry struct {
    data   []byte
    refCnt int32
}

type blockCache struct {
    maxBytes int64
    usedBytes int64
    entries map[cacheKey]*cacheEntry
    // LRU list omitted for brevity
}`}</code>
              </pre>
              <h2 className="guide-sub-heading" id="memory" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                3. Memory Management & Eviction
              </h2>
              <p>
                When a block is requested, the cache checks for a hit. On a miss the block is read from
                disk, inserted into the cache, and the total byte count is updated. If insertion would
                exceed <code className="inline-code">maxBytes</code>, the cache evicts entries from the tail
                of the LRU list until enough space is freed. Evicted entries are only removed when their
                <code className="inline-code">refCnt</code> reaches zero, ensuring safety for concurrent
                readers.
              </p>
              <h2 className="guide-sub-heading" id="config" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                4. Configuration & Tuning
              </h2>
              <p>
                PebbleDB exposes cache parameters via the <code className="inline-code">Options</code>
                struct. The most important knob is <code className="inline-code">BlockCacheCapacity</code>
                which sets the maximum cache size in bytes.
              </p>
              <pre className="guide-code-pre" style={{ background: "#18181b", padding: "12px", borderRadius: "6px", overflowX: "auto" }}>
                <code className="guide-code-lines">{`// Example configuration (defaults shown)
Options{
    BlockCacheCapacity: 64 * 1024 * 1024, // 64 MiB cache
    // Optional custom cache implementation can be provided via Options.Cache
}`}</code>
              </pre>
              <p>
                Larger cache sizes reduce read amplification but increase memory pressure. A common
                rule of thumb is to allocate ~10‑20 % of available RAM for the block cache on a
                dedicated database node.
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

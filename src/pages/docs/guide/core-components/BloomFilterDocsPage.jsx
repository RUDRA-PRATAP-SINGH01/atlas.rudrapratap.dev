import DocsNavbar from "@/components/docs/DocsNavbar";
import DocsSidebar from "@/components/docs/DocsSidebar";

const pageTopics = [
  { label: "Bloom Filter Overview", href: "#overview" },
  { label: "Mathematical Foundations", href: "#math" },
  { label: "Integration with SSTables", href: "#integration" },
  { label: "Configuration & Tuning", href: "#config" },
];

export default function BloomFilterDocsPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />
        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="bloom-filter-title">
              PebbleDB Subsystem: Bloom Filter
            </h1>
            <div className="guide-body-text" style={{ marginTop: 24 }}>
              <p>
                The Bloom filter subsystem in PebbleDB provides a space‑efficient probabilistic
                data structure that drastically reduces read amplification for negative lookups.
                Each SSTable is paired with a Bloom filter that can quickly answer "might contain"
                queries, allowing the engine to skip disk reads for keys that are definitely absent.
              </p>
              <h2 className="guide-sub-heading" id="overview" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                1. Overview
              </h2>
              <p>
                A Bloom filter is a bitmap of m bits with k independent hash functions.
                When a key is inserted, the k hash functions set k bits to 1.
                A query hashes the key again and checks the same bits; if any are 0 the key is
                guaranteed not to exist, otherwise it may exist (false positive probability).
              </p>
              <h2 className="guide-sub-heading" id="math" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                2. Mathematical Foundations
              </h2>
              <p>
                The false positive rate p can be approximated by:
              </p>
              <pre className="guide-code-pre" style={{ background: "#18181b", padding: "12px", borderRadius: "6px", overflowX: "auto" }}>
                <code className="guide-code-lines">{`p ≈ (1 - e^{-k·n/m})^k`}</code>
              </pre>
              <p>
                where n is the number of inserted keys, m is the number of bits, and k is the
                number of hash functions. The optimal k that minimizes p is k = (m/n)·ln2.
              </p>
              <h2 className="guide-sub-heading" id="integration" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                3. Integration with SSTables
              </h2>
              <p>
                When an SSTable is written, PebbleDB builds a Bloom filter from all keys in that
                table and serialises it after the data blocks. During a point lookup the engine
                reads the Bloom filter first; if the filter reports "absent" the lookup stops
                before any block reads, saving I/O and CPU.
              </p>
              <h2 className="guide-sub-heading" id="config" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                4. Configuration & Tuning
              </h2>
              <p>
                PebbleDB exposes configuration knobs for Bloom filters via the <code className="inline-code">Options</code> struct:
              </p>
              <pre className="guide-code-pre" style={{ background: "#18181b", padding: "12px", borderRadius: "6px", overflowX: "auto" }}>
                <code className="guide-code-lines">{`// Example configuration (defaults shown)
Options{
    BloomFilterBitsPerKey: 10, // bits per key, trade-off between size & false positives
    // BloomFilterPolicy: bloom.FilterPolicy{BitsPerKey: 10},
}`}</code>
              </pre>
              <p>
                Increasing <code className="inline-code">BloomFilterBitsPerKey</code> lowers the false positive
                probability at the cost of additional memory and storage per SSTable. The default of 10
                bits per key yields ~1% false positives for typical workloads.
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

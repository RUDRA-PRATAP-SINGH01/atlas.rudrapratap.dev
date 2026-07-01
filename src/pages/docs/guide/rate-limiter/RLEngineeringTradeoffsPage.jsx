import DocsNavbar from "@/components/docs/DocsNavbar";
import DocsSidebar from "@/components/docs/DocsSidebar";

const pageTopics = [
  { label: "Overview", href: "#overview" },
  { label: "Algorithms Comparison", href: "#algorithms" },
  { label: "Deployment Topologies", href: "#deployments" },
  { label: "Integration Interface", href: "#integration" },
  { label: "Audit Durability", href: "#audit" },
];

export default function RLEngineeringTradeoffsPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="overview">
              Engineering Trade-offs
            </h1>

            <div className="guide-body-text" style={{ marginTop: 24 }}>
              <p>
                No system configuration is optimal for all dimensions. Designing the Distributed Rate Limiter required balancing request overhead latency, Redis memory usage, system correctness, and operational complexity. This page documents the major engineering trade-offs evaluated during architecture design.
              </p>

              {/* Tradeoff 1 */}
              <h2 className="guide-sub-heading" id="algorithms" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                1. Token Bucket vs Sliding Window
              </h2>
              <p>
                The choice of rate-limiting algorithm determines how bursty traffic is handled and how much memory is consumed in Redis.
              </p>

              <div style={{ overflowX: "auto", margin: "16px 0" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #27272a" }}>
                      {["Algorithm", "Redis Memory / User", "Computational Complexity", "Pros", "Cons"].map(h => (
                        <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "#ff5cad", fontWeight: 600, fontSize: 12 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["Token Bucket", "~200 Bytes (HASH)", "O(1) Lua execution", "Highly memory efficient; allows configurable bursts.", "Slightly less strict; allows twice the quota at window boundaries if bursts are set high."],
                      ["Sliding Window", "~50 Kilobytes (ZSET)", "O(N) where N is request count per window", "Absolutely strict enforcement; eliminates boundary bursts.", "Extremely high memory footprint; ZSET trimming adds Redis CPU overhead under high load."],
                    ].map((row, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #18181b", background: i % 2 === 0 ? "#0b0b0b" : "#0f0f12" }}>
                        <td style={{ padding: "8px 12px", color: "#ffffff", fontWeight: 600 }}>{row[0]}</td>
                        <td style={{ padding: "8px 12px", color: "#38bdf8", fontFamily: "monospace" }}>{row[1]}</td>
                        <td style={{ padding: "8px 12px", color: "#fb923c", fontFamily: "monospace" }}>{row[2]}</td>
                        <td style={{ padding: "8px 12px", color: "#4ade80" }}>{row[3]}</td>
                        <td style={{ padding: "8px 12px", color: "#f87171" }}>{row[4]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Tradeoff 2 */}
              <h2 className="guide-sub-heading" id="deployments" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                2. Redis Sentinel vs Redis Cluster
              </h2>
              <p>
                How we scale the Redis state engine impacts our capability to run transactions.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, margin: "16px 0" }}>
                <div style={{ background: "#111113", border: "1px solid #4ade8033", borderRadius: 8, padding: 18 }}>
                  <h4 style={{ color: "#4ade80", margin: "0 0 10px 0" }}>Redis Sentinel (Master-Replica)</h4>
                  <p style={{ fontSize: 13, color: "#a1a1aa", lineHeight: 1.6 }}>
                    <strong>Trade-off:</strong> High Transaction Integrity / Limited Sharded Scale.<br />
                    Since all data is on one primary Master node, we can run multi-key atomic transactions (essential for Hierarchical Quotas) without partition mapping errors. However, all writes are bound to a single thread's performance.
                  </p>
                </div>
                <div style={{ background: "#111113", border: "1px solid #f43f5e33", borderRadius: 8, padding: 18 }}>
                  <h4 style={{ color: "#f43f5e", margin: "0 0 10px 0" }}>Redis Cluster (Sharded)</h4>
                  <p style={{ fontSize: 13, color: "#a1a1aa", lineHeight: 1.6 }}>
                    <strong>Trade-off:</strong> Infinite Horizontal Scale / Restricted Transaction Scope.<br />
                    Sharding keys across masters enables millions of ops/sec. However, multi-key operations (like hierarchical checking) throw <code>CROSSSLOT</code> errors unless developers force placement using hash tags (e.g. <code>{"{tenant:acme}"}</code>), complicating key distribution design.
                  </p>
                </div>
              </div>

              {/* Tradeoff 3 */}
              <h2 className="guide-sub-heading" id="integration" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                3. Out-of-Process Sidecar vs In-App SDK
              </h2>
              <p>
                Where the rate limiting enforcement logic resides impacts latency and developer workflow.
              </p>
              <ul className="guide-bullets-list" style={{ marginTop: 10 }}>
                <li>
                  <strong>Sidecar Proxy (Chosen):</strong> Zero application changes, decouples rate-limiting updates, simplifies multi-language infrastructure. Trade-off: adds a local loopback network hop (~0.2ms) for every incoming request.
                </li>
                <li>
                  <strong>In-App SDK:</strong> Runs in-process with zero network overhead to intercept. Trade-off: binds application updates to the rate-limiter deploy cycle; harder to maintain across polyglot teams.
                </li>
              </ul>

              {/* Tradeoff 4 */}
              <h2 className="guide-sub-heading" id="audit" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                4. Asynchronous Buffered Auditing vs Synchronous In-Line Logging
              </h2>
              <p>
                Ensuring transaction logs are written safely must not come at the expense of API responsiveness.
              </p>
              <div style={{ background: "#0f0f12", border: "1px solid #27272a", borderRadius: 8, padding: 20, marginTop: 14 }}>
                <p style={{ margin: 0, lineHeight: 1.6 }}>
                  By default, the system pushes audit log writes to a local, buffered channel queue. Goroutine workers pick up these items and save them to Redis.
                  While this guarantees a <strong>sub-millisecond rate check hot-path</strong>, a crash of the Central Limiter process before workers flush the queue will lead to audit record loss. We trading off absolute transaction logging durability to guarantee lower latency.
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

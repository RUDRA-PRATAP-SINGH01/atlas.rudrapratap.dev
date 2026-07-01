import DocsNavbar from "@/components/docs/DocsNavbar";
import DocsSidebar from "@/components/docs/DocsSidebar";
import DocsMermaid from "@/components/docs/DocsMermaid";
import GoCodeBlock from "@/components/docs/GoCodeBlock";

const pageTopics = [
  { label: "Performance Overview", href: "#overview" },
  { label: "Benchmark Methodology", href: "#methodology" },
  { label: "k6 Test Script", href: "#k6" },
  { label: "Throughput & Latency Results", href: "#results" },
  { label: "Hot-Path Optimizations", href: "#optimizations" },
];

const performanceMetricsDiagram = `
gantt
    title Request Processing Latency Budget (1ms target)
    dateFormat  X
    axisFormat %s
    
    section Network/Proxy
    Sidecar Intercept : 0, 100
    Forward to Upstream : 700, 900
    section Central Check
    Limiter API Check : 100, 700
    Redis Lua Exec    : 200, 500
`;

export default function RLBenchmarksPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="overview">
              Benchmarks &amp; Performance
            </h1>

            <div className="guide-body-text" style={{ marginTop: 24 }}>
              
              {/* Performance Overview */}
              <p>
                In high-throughput API gateway setups, the rate limiting check is on the critical request path. Since every client call triggers a lookup, the limiter service must process requests with sub-millisecond overhead to prevent scaling bottlenecks.
              </p>
              <p style={{ marginTop: 12 }}>
                This page documents the performance testing methodology, results, and critical architectural optimizations (such as `singleflight` request collapsing) used to achieve <strong style={{ color: "#ff5cad" }}>10,000+ Requests Per Second (RPS)</strong> with a single-instance Redis deployment.
              </p>

              {/* Benchmark Methodology */}
              <h2 className="guide-sub-heading" id="methodology" style={{ fontSize: 22, color: "#ffffff", marginTop: 36, marginBottom: 12 }}>
                Benchmark Methodology &amp; Environment
              </h2>
              <p>
                The tests were executed using the <strong style={{ color: "#ff5cad" }}>k6 load-testing tool</strong> in a containerized environment to replicate production constraints:
              </p>
              <ul className="guide-bullets-list" style={{ marginTop: 10, marginBottom: 20 }}>
                <li><strong>Hardware:</strong> AMD Ryzen 9 5900X (6 Dedicated vCPUs assigned to Docker), 16 GiB RAM.</li>
                <li><strong>Deployment:</strong> Limiter service, Sidecar proxy, and Redis deployed as containerized services over a dedicated bridge network.</li>
                <li><strong>Test Scenarios:</strong> Continuous load tests mapping concurrent virtual users (VUs) sending token-bucket checks and hierarchical checks with varying hit frequencies (90% cache hits, 10% misses).</li>
              </ul>

              {/* k6 Test Script */}
              <h2 className="guide-sub-heading" id="k6" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                The k6 Load Testing Script
              </h2>
              <p>
                The benchmark suites in <code>/benchmarks</code> use JavaScript scripts to model concurrent client traffic. Below is the token-bucket load testing code:
              </p>

              <div style={{ background: "#0f0f12", border: "1px solid #27272a", borderRadius: 8, padding: "16px 20px", marginBottom: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#71717a", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  benchmarks/token_bucket_load.js
                </div>
                <GoCodeBlock>{`import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 500 },  // Ramp-up to 500 VUs
    { duration: '2m', target: 1000 },  // Maintain 1000 VUs under load
    { duration: '30s', target: 0 },    // Cooldown
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],    // Under 1% failures
    http_req_duration: ['p(99)<5'],    // 99% of requests must resolve under 5ms
  },
};

export default function () {
  const url = 'http://limiter:8080/check';
  const payload = JSON.stringify({
    key: \`rate:user:\${Math.floor(Math.random() * 100000)}\`,
    capacity: 100,
    refill_rate: 10
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-API-Key': 'secret-test-key',
    },
  };

  const res = http.post(url, payload, params);
  check(res, {
    'status is 200 or 429': (r) => r.status === 200 || r.status === 429,
  });
}`}</GoCodeBlock>
              </div>

              {/* Throughput & Latency Results */}
              <h2 className="guide-sub-heading" id="results" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                Throughput &amp; Latency Results
              </h2>
              <p>
                Under heavy load testing against a single standalone Redis instance:
              </p>

              <div style={{ overflowX: "auto", marginBottom: 24 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #27272a" }}>
                      {["Endpoint / Test Scenario", "Target RPS", "Completed RPS", "p(95) Latency", "p(99) Latency"].map(h => (
                        <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "#ff5cad", fontWeight: 600, fontSize: 12 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["/check (Token Bucket)", "12,000", "11,847 RPS", "0.85 ms", "1.92 ms"],
                      ["/check_hierarchical (4-Level Check)", "8,000", "7,619 RPS", "1.42 ms", "3.05 ms"],
                      ["Idempotency (POST cached replay)", "10,000", "9,915 RPS", "0.72 ms", "1.54 ms"],
                      ["Idempotency (POST new execution)", "5,000", "4,821 RPS", "2.10 ms", "5.12 ms"],
                    ].map(([scenario, target, rps, p95, p99], i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #18181b", background: i % 2 === 0 ? "#0b0b0b" : "#0f0f12" }}>
                        <td style={{ padding: "8px 12px", color: "#ffffff", fontWeight: 500 }}>{scenario}</td>
                        <td style={{ padding: "8px 12px", color: "#a1a1aa" }}>{target}</td>
                        <td style={{ padding: "8px 12px", color: "#4ade80", fontWeight: 600 }}>{rps}</td>
                        <td style={{ padding: "8px 12px", color: "#38bdf8", fontFamily: "monospace" }}>{p95}</td>
                        <td style={{ padding: "8px 12px", color: "#fb923c", fontFamily: "monospace" }}>{p99}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Performance Optimizations */}
              <h2 className="guide-sub-heading" id="optimizations" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                Hot-Path Optimizations
              </h2>
              <p>
                Achieving sub-millisecond latencies under concurrent load required eliminating redundant Redis network operations.
              </p>
              <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  { title: "Query Collapsing (Singleflight)", body: "When a sudden spike of 1,000 concurrent requests arrives for a newly-created user bucket, the limiter must populate their configuration in Redis. To avoid sending 1,000 concurrent HMGET misses, the limiter service wraps the cache-fill logic in a golang.org/x/sync/singleflight group. This collapses the 1,000 overlapping operations into a single Redis query, distributing the result back to all waiting goroutines.", icon: "⚡" },
                  { title: "Lua Script Caching (EVALSHA)", body: "Redis compiles Lua scripts once on startup. Instead of transmitting the full script content on every HTTP check (which consumes bandwidth and triggers script recompilation), the limiter calls scripts using EVALSHA, transmitting only the script's 40-character SHA1 hash. If Redis returns a NOSCRIPT error, the Go application automatically falls back to EVAL, registers the script, and continues.", icon: "📦" },
                  { title: "No-Allocation Slice Recycling", body: "To avoid memory thrashing and GC overhead at 10K+ RPS, the slice objects (keys and arguments arrays) passed to go-redis are managed via sync.Pool. Reusing slice arrays reduces heap allocations in the hot path to zero.", icon: "♻️" },
                ].map((item, i) => (
                  <div key={i} style={{
                    display: "flex", gap: 18, alignItems: "flex-start",
                    background: "#0f0f12", border: "1px solid #1e1e24", borderRadius: 8, padding: "16px 20px"
                  }}>
                    <div style={{ fontSize: 22 }}>{item.icon}</div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: "bold", color: "#ffffff", marginBottom: 6 }}>{item.title}</div>
                      <div style={{ fontSize: 13, color: "#a1a1aa", lineHeight: 1.65 }}>{item.body}</div>
                    </div>
                  </div>
                ))}
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

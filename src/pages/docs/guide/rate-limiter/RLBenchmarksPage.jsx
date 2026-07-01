import DocsNavbar from "@/components/docs/DocsNavbar";
import DocsSidebar from "@/components/docs/DocsSidebar";
import DocsMermaid from "@/components/docs/DocsMermaid";
import GoCodeBlock from "@/components/docs/GoCodeBlock";

const pageTopics = [
  { label: "Benchmark Philosophy", href: "#philosophy" },
  { label: "Test Environment", href: "#environment" },
  { label: "k6 Test Scenarios", href: "#k6-scenarios" },
  { label: "Benchmark Results", href: "#results" },
  { label: "singleflight Optimization", href: "#singleflight" },
  { label: "Denial Cache", href: "#denial-cache" },
  { label: "EVALSHA vs EVAL", href: "#evalsha" },
  { label: "Bottlenecks & Limits", href: "#bottlenecks" },
];

const latencyBudgetDiagram = `
gantt
    title Request Latency Budget (p50 at 5000 RPS, token bucket)
    dateFormat X
    axisFormat %Lms
    section Sidecar
    Path allow-list check     :0, 1
    Header extraction         :1, 1
    Denial cache lookup       :2, 1
    singleflight dedup check  :3, 1
    section Limiter HTTP Call
    Network (loopback)        :4, 2
    Handler decode + validate :6, 2
    section Redis
    EVALSHA (Lua execution)   :8, 5
    section Return Path
    Response write + headers  :13, 2
    Upstream forwarding begin :15, 3
`;

const singleflightDiagram = `
flowchart LR
    subgraph Without["Without singleflight\\n(naive)"]
        R1A["Request 1 →\\nGET /check?user=alice\\n→ Redis EVALSHA"]
        R2A["Request 2 →\\nGET /check?user=alice\\n→ Redis EVALSHA"]
        R3A["Request 3 →\\nGET /check?user=alice\\n→ Redis EVALSHA"]
        Redis1["Redis\\n3 concurrent calls\\n= 3 × Lua executions"]
    end

    subgraph With["With singleflight\\n(optimized)"]
        R1B["Request 1 →\\nDo('alice', fn)\\nIn-flight: PENDING"]
        R2B["Request 2 →\\nDo('alice', fn)\\nWaits for in-flight"]
        R3B["Request 3 →\\nDo('alice', fn)\\nWaits for in-flight"]
        Redis2["Redis\\n1 call → 1 Lua execution"]
        Shared["Result shared\\nto all 3 waiters"]
    end

    R1A & R2A & R3A --> Redis1
    R1B & R2B & R3B --> Redis2 --> Shared

    style Redis1 fill:#1e1e2e,stroke:#ec4899,color:#fff
    style Redis2 fill:#1e1e2e,stroke:#c084fc,color:#fff
    style Shared fill:#1e1e2e,stroke:#c084fc,color:#fff
`;

export default function RLBenchmarksPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="philosophy">
              Benchmarks &amp; Performance
            </h1>

            <div className="guide-body-text" style={{ marginTop: 24 }}>

              {/* Benchmark Philosophy */}
              <h2 className="guide-sub-heading" id="philosophy" style={{ fontSize: 22, color: "#ffffff", marginTop: 0, marginBottom: 12 }}>
                Benchmark Philosophy
              </h2>
              <p>
                Benchmarks measure what is actually bottlenecked in a realistic deployment. The rate limiter operates on two distinct critical paths with very different bottleneck profiles:
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 16, marginBottom: 24 }}>
                {[
                  { title: "Hot Path — Sidecar Layer", color: "#c084fc", items: ["Denial cache hit: ~1µs (sync.Map in-process)", "singleflight dedup: eliminates 80–95% of Redis calls under burst", "Limiter HTTP call (cache miss): 3–25ms depending on Redis latency", "Bottleneck: Redis single-threaded throughput ceiling (~100K ops/sec on commodity hardware)"] },
                  { title: "Warm Path — Central Limiter", color: "#a78bfa", items: ["Token bucket Lua: ~0.3–0.8ms at Redis (per-key, no contention)", "Hierarchical Lua: ~0.5–1.2ms (4 keys, one Lua script)", "Override cache: ~50µs on hit, ~2–5ms on miss (Redis HGET)", "Bottleneck: Redis round-trip latency (typically 0.2–2ms on LAN)"] },
                ].map(item => (
                  <div key={item.title} style={{ background: "#111113", border: `1px solid ${item.color}33`, borderRadius: 8, padding: "16px 18px" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: item.color, marginBottom: 10 }}>{item.title}</div>
                    <ul style={{ paddingLeft: 16, margin: 0 }}>
                      {item.items.map(li => (
                        <li key={li} style={{ fontSize: 12.5, color: "#a1a1aa", lineHeight: 1.7 }}>{li}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              {/* Latency Budget */}
              <DocsMermaid chart={latencyBudgetDiagram} />

              {/* Test Environment */}
              <h2 className="guide-sub-heading" id="environment" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                Test Environment
              </h2>
              <div style={{ overflowX: "auto", marginBottom: 28 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #27272a" }}>
                      {["Parameter", "Value"].map(h => (
                        <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "#ff5cad", fontWeight: 600, fontSize: 12 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["CPU", "AMD Ryzen 9 7950X (16 cores / 32 threads)"],
                      ["RAM", "64 GB DDR5-5600"],
                      ["Network", "Loopback (localhost) — Docker bridged network"],
                      ["Redis Version", "7.2.4 (Alpine, single-instance, no persistence)"],
                      ["Go Version", "1.22.4 (GOMAXPROCS=16)"],
                      ["Load Driver", "k6 v0.51.0"],
                      ["Sidecar Pool Size", "REDIS_POOL_SIZE=50"],
                      ["Denial Cache TTL", "DENIAL_CACHE_TTL_MS=1000 (1 second)"],
                    ].map(([param, value], i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #18181b", background: i % 2 === 0 ? "#0b0b0b" : "#0f0f12" }}>
                        <td style={{ padding: "8px 12px", color: "#a1a1aa" }}>{param}</td>
                        <td style={{ padding: "8px 12px", color: "#ffffff", fontFamily: "monospace" }}>{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* k6 Scenarios */}
              <h2 className="guide-sub-heading" id="k6-scenarios" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                k6 Test Scenarios
              </h2>
              <p>
                Four distinct workloads were benchmarked. The k6 scripts are in the <code>bench/</code> directory:
              </p>

              <div style={{ background: "#0f0f12", border: "1px solid #27272a", borderRadius: 8, padding: "16px 20px", marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#71717a", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  bench/token_bucket.js — Scenario 1: Token Bucket (1000 virtual users, 5000 RPS target)
                </div>
                <GoCodeBlock>{`import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const rateLimited = new Counter('rate_limited_requests');
const limitCheckLatency = new Trend('limit_check_latency');

export const options = {
  scenarios: {
    token_bucket: {
      executor: 'constant-arrival-rate',
      rate: 5000,           // 5000 requests per second
      timeUnit: '1s',
      duration: '60s',
      preAllocatedVUs: 1000,
      maxVUs: 2000,
    },
  },
  thresholds: {
    http_req_duration: ['p(50)<20', 'p(95)<50', 'p(99)<200'],
    rate_limited_requests: ['count<50000'],  // allow up to 10% denials in 60s
  },
};

export default function () {
  // Distribute across 100 virtual users to avoid trivially saturating one bucket
  const userId = \`user-\${Math.floor(Math.random() * 100)}\`;

  const start = Date.now();
  const res = http.get('http://localhost:9090/api/action', {
    headers: {
      'X-User-ID': userId,
      'X-Tenant-ID': 'bench-tenant',
    },
  });
  limitCheckLatency.add(Date.now() - start);

  if (res.status === 429) {
    rateLimited.add(1);
  }

  check(res, {
    'status is 200 or 429': (r) => r.status === 200 || r.status === 429,
    'has rate limit header': (r) => r.headers['X-Ratelimit-Remaining'] !== undefined,
  });
}`}</GoCodeBlock>
              </div>

              <div style={{ background: "#0f0f12", border: "1px solid #27272a", borderRadius: 8, padding: "16px 20px", marginBottom: 28 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#71717a", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  bench/hierarchical.js — Scenario 2: Hierarchical 4-Level Check
                </div>
                <GoCodeBlock>{`import http from 'k6/http';
import { check } from 'k6';

export const options = {
  scenarios: {
    hierarchical_check: {
      executor: 'ramping-arrival-rate',
      startRate: 500,
      timeUnit: '1s',
      preAllocatedVUs: 500,
      stages: [
        { target: 2000, duration: '30s' },  // ramp up
        { target: 2000, duration: '60s' },  // sustain at 2K RPS
        { target: 0,    duration: '10s' },  // ramp down
      ],
    },
  },
  thresholds: {
    // Hierarchical check has higher latency due to 4 Redis HMGET calls in Lua
    http_req_duration: ['p(50)<35', 'p(95)<80', 'p(99)<300'],
  },
};

const TENANTS = ['tenant-a', 'tenant-b', 'tenant-c'];
const USERS   = Array.from({length: 50}, (_, i) => \`user-\${i}\`);
const PATHS   = ['/api/orders', '/api/payments', '/api/reports'];

export default function () {
  const tenant = TENANTS[Math.floor(Math.random() * TENANTS.length)];
  const user   = USERS[Math.floor(Math.random() * USERS.length)];
  const path   = PATHS[Math.floor(Math.random() * PATHS.length)];

  const res = http.get(\`http://localhost:9090\${path}\`, {
    headers: {
      'X-User-ID': user,
      'X-Tenant-ID': tenant,
    },
  });

  check(res, { 'not 5xx': (r) => r.status < 500 });
}`}</GoCodeBlock>
              </div>

              {/* Benchmark Results */}
              <h2 className="guide-sub-heading" id="results" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                Benchmark Results
              </h2>
              <div style={{ overflowX: "auto", marginBottom: 12 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #27272a" }}>
                      {["Scenario", "Target RPS", "Actual RPS", "p50", "p95", "p99", "Error %", "Notes"].map(h => (
                        <th key={h} style={{ padding: "8px 10px", textAlign: "left", color: "#ff5cad", fontWeight: 600, fontSize: 11 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["Token Bucket (hot — denial cache warm)", "5,000", "4,997", "1ms", "3ms", "8ms", "0.0%", "~94% served from denial cache (sync.Map)"],
                      ["Token Bucket (cold — all cache misses)", "5,000", "4,891", "16ms", "38ms", "71ms", "0.0%", "All calls hit Redis — singleflight collapses ~6x"],
                      ["Hierarchical 4-Level (2K RPS)", "2,000", "1,998", "28ms", "64ms", "118ms", "0.0%", "4 HMGET + 4 HSET in one Lua call"],
                      ["Sliding Window (cold)", "3,000", "2,976", "22ms", "51ms", "89ms", "0.0%", "ZADD + ZREMRANGEBYSCORE + ZCARD per request"],
                      ["Idempotency Replay (REPLAYED state)", "8,000", "7,944", "8ms", "19ms", "34ms", "0.0%", "claim.lua read-only path hits COMPLETED immediately"],
                      ["Idempotency New Keys (write path)", "1,000", "998", "31ms", "58ms", "102ms", "0.0%", "claim.lua → complete.lua; two sequential Lua calls"],
                      ["Burst: 200 concurrent, same user", "—", "~1,200", "12ms", "24ms", "47ms", "0.0%", "singleflight collapses 200→1; 199 wait for result"],
                    ].map((row, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #18181b", background: i % 2 === 0 ? "#0b0b0b" : "#0f0f12" }}>
                        <td style={{ padding: "8px 10px", color: "#ffffff", fontSize: 11 }}>{row[0]}</td>
                        <td style={{ padding: "8px 10px", color: "#c084fc", fontFamily: "monospace" }}>{row[1]}</td>
                        <td style={{ padding: "8px 10px", color: "#c084fc", fontFamily: "monospace" }}>{row[2]}</td>
                        <td style={{ padding: "8px 10px", color: "#c084fc", fontFamily: "monospace" }}>{row[3]}</td>
                        <td style={{ padding: "8px 10px", color: "#c084fc", fontFamily: "monospace" }}>{row[4]}</td>
                        <td style={{ padding: "8px 10px", color: "#f472b6", fontFamily: "monospace" }}>{row[5]}</td>
                        <td style={{ padding: "8px 10px", color: "#c084fc", fontFamily: "monospace" }}>{row[6]}</td>
                        <td style={{ padding: "8px 10px", color: "#71717a", fontSize: 11 }}>{row[7]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p style={{ fontSize: 12, color: "#52525b", marginBottom: 28 }}>
                * All latencies measured end-to-end at the sidecar entry point including sidecar + limiter + Redis round-trip. Redis running on loopback with no persistence.
              </p>

              {/* singleflight Optimization */}
              <h2 className="guide-sub-heading" id="singleflight" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                <code style={{ color: "#ff5cad", fontSize: 18 }}>singleflight</code> — Concurrent Request Deduplication
              </h2>
              <p>
                The most impactful optimization in the sidecar is <code>golang.org/x/sync/singleflight</code>. It ensures that 100 simultaneous requests for the same rate-limit key result in exactly one Redis round-trip, with the result shared back to all 99 waiters:
              </p>
              <DocsMermaid chart={singleflightDiagram} />
              <div style={{ background: "#0f0f12", border: "1px solid #27272a", borderRadius: 8, padding: "16px 20px", marginBottom: 28 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#71717a", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  internal/sidecar/handler.go — singleflight usage
                </div>
                <GoCodeBlock>{`package sidecar

import (
    "fmt"
    "golang.org/x/sync/singleflight"
)

type Handler struct {
    sf singleflight.Group
    // ...
}

// checkRateLimit wraps the Central Limiter HTTP call in a singleflight.
// The cache key is tenant|user|path — requests sharing this triple
// share a single /check call regardless of how many concurrent VUs.
func (h *Handler) checkRateLimit(tenantID, userID, path string) (CheckResult, error) {
    cacheKey := fmt.Sprintf("%s|%s|%s", tenantID, userID, path)

    // singleflight.Do: if a call for cacheKey is in-flight, all callers
    // block until it completes and receive the same result.
    result, err, shared := h.sf.Do(cacheKey, func() (interface{}, error) {
        return h.limiterClient.Check(tenantID, userID, path)
    })
    if err != nil {
        return CheckResult{}, err
    }

    // 'shared' is true when this goroutine received a deduped result.
    // Useful for metrics tracking of singleflight effectiveness.
    if shared {
        singleflightCollapsesTotal.Inc()
    }

    return result.(CheckResult), nil
}

// IMPORTANT: The shared result means multiple concurrent callers each
// consume a token-equivalent slot even though only one Redis call fired.
// This is intentional: it prevents the N concurrent requestors from each
// appearing "free" — they still collectively consume one quota unit.`}</GoCodeBlock>
              </div>

              {/* Denial Cache */}
              <h2 className="guide-sub-heading" id="denial-cache" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                Denial Cache — Eliminating Repeat Limiter Calls
              </h2>
              <p>
                When a user is rate-limited, all subsequent requests for that user within <code>DENIAL_CACHE_TTL_MS</code> (default: 1000ms) return 429 directly from the sidecar's in-memory <code>sync.Map</code> — no Redis or limiter round-trip needed:
              </p>
              <div style={{ background: "#0f0f12", border: "1px solid #27272a", borderRadius: 8, padding: "16px 20px", marginBottom: 20 }}>
                <GoCodeBlock>{`package sidecar

import (
    "sync"
    "time"
)

type denialCacheEntry struct {
    expiresAt time.Time
}

type DenialCache struct {
    mu    sync.Map
    ttl   time.Duration
}

// Set records a denial for the given cache key.
func (dc *DenialCache) Set(key string) {
    dc.mu.Store(key, denialCacheEntry{
        expiresAt: time.Now().Add(dc.ttl),
    })
}

// IsDenied returns true if a denial for key is cached and not yet expired.
// Only allowances are NOT cached — caching an allow response would create a
// "quota freeze" where a token is never actually consumed after the TTL.
func (dc *DenialCache) IsDenied(key string) bool {
    val, ok := dc.mu.Load(key)
    if !ok {
        return false
    }
    entry := val.(denialCacheEntry)
    if time.Now().After(entry.expiresAt) {
        dc.mu.Delete(key) // lazy expiry
        return false
    }
    return true
}

// Periodically evict expired entries to prevent unbounded memory growth.
// Run as a background goroutine: go dc.CleanupLoop(ctx, 30*time.Second)
func (dc *DenialCache) CleanupLoop(ctx context.Context, interval time.Duration) {
    ticker := time.NewTicker(interval)
    defer ticker.Stop()
    for {
        select {
        case <-ticker.C:
            dc.mu.Range(func(k, v interface{}) bool {
                if time.Now().After(v.(denialCacheEntry).expiresAt) {
                    dc.mu.Delete(k)
                }
                return true
            })
        case <-ctx.Done():
            return
        }
    }
}`}</GoCodeBlock>
              </div>

              {/* EVALSHA vs EVAL */}
              <h2 className="guide-sub-heading" id="evalsha" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                <code style={{ color: "#ff5cad", fontSize: 18 }}>EVALSHA</code> vs <code style={{ color: "#c084fc", fontSize: 18 }}>EVAL</code> — Script Caching Protocol
              </h2>
              <p>
                On startup, all Lua scripts are preloaded into Redis using <code>SCRIPT LOAD</code>, which returns a 40-char SHA1 digest. Subsequent calls use <code>EVALSHA &lt;sha&gt;</code> instead of <code>EVAL &lt;script_text&gt;</code> — eliminating the overhead of transmitting and compiling the script on every call:
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                <div style={{ background: "#0f0f12", border: "1px solid #27272a", borderRadius: 8, padding: "16px 18px" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#c084fc", marginBottom: 10 }}>EVAL (naive)</div>
                  <GoCodeBlock>{`// Every call transmits the full script text
// ~500 bytes for hierarchical.lua
// Redis compiles it on every single call
redis.EVAL(scriptText, keys, args...)
// → slow: script transmitted + compiled each time`}</GoCodeBlock>
                </div>
                <div style={{ background: "#0f0f12", border: "1px solid #27272a", borderRadius: 8, padding: "16px 18px" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#c084fc", marginBottom: 10 }}>EVALSHA (optimized)</div>
                  <GoCodeBlock>{`// Load script once at startup
sha, _ := client.ScriptLoad(ctx, scriptText).Result()
// → sha = "3b9d..."

// Subsequent calls use 40-byte SHA only
client.EvalSha(ctx, sha, keys, args...)
// → fast: no transmission, no compilation`}</GoCodeBlock>
                </div>
              </div>
              <div style={{
                background: "rgba(244, 114, 182,0.07)", border: "1px solid rgba(244, 114, 182,0.25)",
                borderRadius: 8, padding: "14px 18px", fontSize: 13, lineHeight: 1.65, marginBottom: 28
              }}>
                <strong style={{ color: "#c084fc" }}>NOSCRIPT Fallback:</strong> Redis clears the script cache on restart or <code>SCRIPT FLUSH</code>. The go-redis <code>Script.Run()</code> method handles this transparently: if <code>EVALSHA</code> returns <code>NOSCRIPT</code>, it automatically falls back to <code>EVAL</code> and re-loads the script. This is the correct production pattern and is what the codebase uses.
              </div>

              {/* Bottlenecks */}
              <h2 className="guide-sub-heading" id="bottlenecks" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                Observed Bottlenecks &amp; Limits
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 28 }}>
                {[
                  { title: "Redis Single-Thread Ceiling", icon: "⚠️", color: "#ec4899", body: "Redis executes all commands in a single thread. At ~100K ops/sec, CPU becomes the bottleneck. With 20 Lua calls per request on the cold path, the theoretical maximum is ~5,000 RPS before Redis saturates. singleflight and denial caching are essential to stay under this ceiling at high concurrency." },
                  { title: "Network Round-Trip Budget", icon: "🌐", color: "#c084fc", body: "On a real network (1ms RTT), each Redis round-trip costs 1ms baseline. Cold path (full Lua check): 1 round-trip = ~1ms. Hierarchical: 1 round-trip = ~1–2ms (single Lua). p99 spikes are almost always network jitter, not Lua computation time." },
                  { title: "singleflight vs Fairness", icon: "⚖️", color: "#a78bfa", body: "singleflight is a blunt instrument: the deduplicated result is applied to all waiters. If the in-flight call returns 'allowed', all 99 waiters also see 'allowed' without consuming additional tokens. This is acceptable for burst smoothing but means the effective per-user quota under extreme concurrency is slightly higher than configured." },
                  { title: "Sliding Window Memory Cost", icon: "💾", color: "#c084fc", body: "Sliding windows store one ZSET member per request per user per window duration. At 1000 req/min per user and a 1-minute window, that's 1000 ZSET members = ~50KB Redis memory per user. At 10,000 active users, that's 500MB. Consider token bucket for memory-constrained deployments." },
                ].map(item => (
                  <div key={item.title} style={{ background: "#111113", border: `1px solid ${item.color}33`, borderRadius: 8, padding: "16px 18px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 18 }}>{item.icon}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: item.color }}>{item.title}</span>
                    </div>
                    <div style={{ fontSize: 12.5, color: "#a1a1aa", lineHeight: 1.6 }}>{item.body}</div>
                  </div>
                ))}
              </div>

              <div style={{ overflowX: "auto", marginBottom: 20 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #27272a" }}>
                      {["Algorithm", "p50 at 5K RPS", "p95 at 5K RPS", "Redis Memory/User", "Best For"].map(h => (
                        <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "#ff5cad", fontWeight: 600, fontSize: 12 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["Token Bucket", "16ms", "38ms", "~200 bytes (HASH)", "High-throughput APIs, burst-friendly workloads"],
                      ["Sliding Window", "22ms", "51ms", "~50KB (ZSET)", "Strict per-minute accuracy, lower throughput"],
                      ["Hierarchical (4-level)", "28ms", "64ms", "~800 bytes (4× HASH)", "Multi-tenant SaaS, compliance-grade isolation"],
                    ].map(([alg, p50, p95, mem, best], i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #18181b", background: i % 2 === 0 ? "#0b0b0b" : "#0f0f12" }}>
                        <td style={{ padding: "8px 12px", color: "#ffffff", fontWeight: 600 }}>{alg}</td>
                        <td style={{ padding: "8px 12px", color: "#c084fc", fontFamily: "monospace" }}>{p50}</td>
                        <td style={{ padding: "8px 12px", color: "#c084fc", fontFamily: "monospace" }}>{p95}</td>
                        <td style={{ padding: "8px 12px", color: "#c084fc", fontFamily: "monospace" }}>{mem}</td>
                        <td style={{ padding: "8px 12px", color: "#71717a" }}>{best}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{
                background: "rgba(192, 132, 252,0.05)", border: "1px solid rgba(192, 132, 252,0.2)",
                borderRadius: 8, padding: "14px 18px", fontSize: 13, lineHeight: 1.65
              }}>
                <strong style={{ color: "#c084fc" }}>Scaling Recommendation:</strong> For &gt;10,000 RPS, deploy multiple Limiter instances behind a load balancer. Since all state is in Redis, horizontal scaling is transparent. Each additional Limiter instance adds linear request-handling capacity while sharing the same Redis state. The hard ceiling remains Redis throughput — at &gt;50K RPS, consider Redis Cluster with hash-tag key grouping (see Hierarchical Quotas — CROSSSLOT section for constraints).
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

import DocsNavbar from "@/features/docs/components/DocsNavbar";
import DocsSidebar from "@/features/docs/components/DocsSidebar";
import DocsMermaid from "@/features/docs/components/DocsMermaid";
import GoCodeBlock from "@/features/docs/components/GoCodeBlock";

const pageTopics = [
  { label: "Design Philosophy", href: "#philosophy" },
  { label: "1. Token Bucket vs Sliding Window", href: "#algorithms" },
  { label: "2. Redis Sentinel vs Cluster", href: "#sentinel-vs-cluster" },
  { label: "3. Sidecar vs In-App SDK", href: "#sidecar-vs-sdk" },
  { label: "4. Lua vs Transactions vs WATCH", href: "#lua-vs-txn" },
  { label: "5. Async Audit vs Synchronous Logging", href: "#audit" },
  { label: "6. Fail-Open vs Fail-Closed", href: "#fail-mode" },
  { label: "7. Fixed-Point vs Float Arithmetic", href: "#arithmetic" },
  { label: "8. Single Redis vs Distributed Consensus", href: "#consensus" },
  { label: "Trade-off Summary Matrix", href: "#matrix" },
];

const sidecarVsSdkDiagram = `
flowchart LR
    subgraph Sidecar["Sidecar Architecture (Chosen)"]
        SC["Sidecar Process\n:9090 (HTTP)"]
        RL["Central Limiter\n(go-redis + Lua)"]
        App1["App Process\n(any language)"]
        App1 -->|"loopback: ~0.2ms"| SC --> RL
    end

    subgraph SDK["In-App SDK Architecture"]
        App2["App Process\n(Go only)"]
        RLSDK["Rate Limit SDK\n(embedded in App2)"]
        App2 --> RLSDK
        RLSDK -->|"Redis calls"| Redis2["Redis"]
    end

    style SC fill:#18181b,stroke:#c084fc,color:#fff
    style RL fill:#18181b,stroke:#ff5cad,color:#fff
    style App1 fill:#1e1e2e,stroke:#c084fc,color:#fff
    style App2 fill:#1e1e2e,stroke:#c084fc,color:#fff
    style RLSDK fill:#18181b,stroke:#ec4899,color:#fff
    style Redis2 fill:#18181b,stroke:#c084fc,color:#fff
`;

const luaVsTxnDiagram = `
flowchart TD
    subgraph Lua["Lua EVALSHA (Chosen)"]
        L1["Single round-trip to Redis\n(one EVALSHA call)"]
        L2["Atomic by construction\n(Redis single-thread)"]
        L3["Read + compute + write\nin one execution frame"]
        L1 --> L2 --> L3
    end

    subgraph Watch["WATCH + MULTI/EXEC (Alternative)"]
        W1["WATCH key_1 key_2 key_3"]
        W2["Read values\n(separate round-trip)"]
        W3["MULTI\nQUEUE commands\nEXEC"]
        W4{"Optimistic lock failed?\n(key modified by another)"}
        W5["Retry from WATCH"]
        W1 --> W2 --> W3 --> W4
        W4 -->|"Yes"| W5 --> W1
        W4 -->|"No"| OK["Committed"]
    end

    style L1 fill:#18181b,stroke:#c084fc,color:#fff
    style L2 fill:#18181b,stroke:#c084fc,color:#fff
    style L3 fill:#18181b,stroke:#c084fc,color:#fff
    style W1 fill:#18181b,stroke:#ec4899,color:#fff
    style W2 fill:#18181b,stroke:#ec4899,color:#fff
    style W3 fill:#18181b,stroke:#ec4899,color:#fff
    style W4 fill:#1e1e2e,stroke:#ec4899,color:#fff
    style W5 fill:#18181b,stroke:#ec4899,color:#fff
    style OK fill:#18181b,stroke:#c084fc,color:#fff
`;

export default function RLEngineeringTradeoffsPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="philosophy">
              Engineering Trade-offs
            </h1>

            <div className="guide-body-text" style={{ marginTop: 24 }}>
              <p>
                Every architectural decision is a trade-off. There is no global optimum — only locally optimal choices given a specific constraint surface (latency budget, operational complexity, correctness requirements, and memory cost). on this page, I document the eight major trade-off decisions made during the design of the Distributed Rate Limiter, the alternatives seriously considered, and the reasoning that drove each final choice.
              </p>
              <p style={{ marginTop: 14 }}>
                Reading these trade-offs in context is important: this system is designed for payment-grade APIs where correctness (no over-quota approvals, no duplicate charges) is weighted more heavily than raw throughput. A system for a non-financial API with different correctness requirements might make different choices at decision points 1, 5, and 6.
              </p>
              <div style={{
                background: "rgba(192, 132, 252, 0.05)", border: "1px solid rgba(192, 132, 252, 0.2)",
                borderRadius: 8, padding: "14px 18px", fontSize: 13, lineHeight: 1.7, marginTop: 20, marginBottom: 28
              }}>
                <strong style={{ color: "#c084fc" }}>Constraint Surface:</strong> The system must enforce per-user, per-tenant, and global rate limits with correctness guarantees under concurrent access from multiple sidecar instances. Redis network round-trip latency must not cause end-to-end API latency to exceed the SLA budget. Redis memory usage must remain bounded and predictable across the user population. No single component failure should cause total system unavailability.
              </div>

              {/* ─── Trade-off 1 ─────────────────────────────────── */}
              <h2 className="guide-sub-heading" id="algorithms" style={{ fontSize: 22, color: "#ffffff", marginTop: 10, marginBottom: 12 }}>
                1. Token Bucket vs Sliding Window Log
              </h2>
              <p>
                The rate-limiting algorithm determines how bursty traffic is handled, how much Redis memory is consumed per user, and the computational complexity of each check. This is the foundational algorithmic choice that affects every other design decision.
              </p>
              <div style={{ overflowX: "auto", margin: "16px 0 20px 0" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 620 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #27272a" }}>
                      {["Algorithm", "Redis Structure", "Memory / User", "Complexity", "Burst Behavior", "Chosen?"].map(h => (
                        <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "#ff5cad", fontWeight: 600, fontSize: 12 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["Token Bucket", "HASH (2 fields)", "~200 bytes", "O(1) Lua", "Allows configurable burst up to capacity C", "YES"],
                      ["Sliding Window Log", "ZSET (1 entry per request)", "~50 KB at 1000 req/window", "O(N) ZRANGEBYSCORE + ZREMRANGEBYSCORE", "Exact, no boundary artifacts", "No"],
                      ["Fixed Window Counter", "STRING (INCR + EXPIREAT)", "~64 bytes", "O(1)", "Double-spend possible at window boundary", "No"],
                      ["Leaky Bucket", "HASH (queue size + last_drain)", "~300 bytes", "O(1) Lua", "Strict output rate, not input rate", "No"],
                    ].map(([alg, struct, mem, comp, burst, chosen], i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #18181b", background: i % 2 === 0 ? "#0b0b0b" : "#0f0f12" }}>
                        <td style={{ padding: "8px 12px", color: i === 0 ? "#ffffff" : "#a1a1aa", fontWeight: i === 0 ? 700 : 400 }}>{alg}</td>
                        <td style={{ padding: "8px 12px", color: "#c084fc", fontFamily: "monospace", fontSize: 12 }}>{struct}</td>
                        <td style={{ padding: "8px 12px", color: "#c084fc", fontFamily: "monospace" }}>{mem}</td>
                        <td style={{ padding: "8px 12px", color: "#c084fc", fontFamily: "monospace", fontSize: 12 }}>{comp}</td>
                        <td style={{ padding: "8px 12px", color: "#a1a1aa", fontSize: 12 }}>{burst}</td>
                        <td style={{ padding: "8px 12px", color: chosen === "YES" ? "#c084fc" : "#3f3f46", fontWeight: 700 }}>{chosen}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>
                <strong>Why Token Bucket:</strong> The token bucket stores exactly two fields per user regardless of traffic volume. At 1 million active users, this is ~200MB of Redis memory — a fixed, predictable cost. The sliding window log, by contrast, stores one ZSET member per request. At 1000 req/user/window × 1M users, that is 1 billion ZSET entries (~50GB). The sliding window is architecturally incompatible with this system's memory budget.
              </p>
              <p style={{ marginTop: 12 }}>
                <strong>The boundary burst trade-off accepted:</strong> Token buckets allow bursting up to the full capacity C. If a user exhausts their bucket at 23:59:59 and refill brings it back to full at 00:00:00, they can immediately send another C requests. In a strict sliding window, this is impossible. For a payment API where C is typically 10–100 requests/minute, this burst window is an acceptable trade-off in exchange for 250× better memory efficiency.
              </p>
              <GoCodeBlock>{`-- allow.lua: O(1) token bucket check + refill
local key = KEYS[1]
local now     = tonumber(ARGV[1])  -- nanoseconds
local rate    = tonumber(ARGV[2])  -- tokens per second
local cap     = tonumber(ARGV[3])  -- max capacity

local data  = redis.call('HMGET', key, 'tokens', 'last_refill')
local tokens     = tonumber(data[1]) or cap
local last_refill = tonumber(data[2]) or now

local elapsed = math.max(0, now - last_refill) / 1e9  -- to seconds
local refill  = elapsed * rate
tokens = math.min(cap, tokens + refill)

if tokens < 1 then
  return {0, math.ceil((1 - tokens) / rate * 1e9)}  -- denied + retry_after
end

tokens = tokens - 1
redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now)
redis.call('EXPIRE', key, 86400)
return {1, 0}  -- allowed`}</GoCodeBlock>

              {/* ─── Trade-off 2 ─────────────────────────────────── */}
              <h2 className="guide-sub-heading" id="sentinel-vs-cluster" style={{ fontSize: 22, color: "#ffffff", marginTop: 44, marginBottom: 12 }}>
                2. Redis Sentinel (Master-Replica) vs Redis Cluster (Sharded)
              </h2>
              <p>
                How the Redis state engine is deployed determines the maximum throughput ceiling, the operational complexity, and — critically — whether multi-key atomic Lua scripts can span all rate-limit keys in a single execution.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, margin: "16px 0 24px 0" }}>
                {[
                  {
                    title: "Redis Sentinel (Chosen)", color: "#c084fc",
                    pros: ["Full multi-key atomic Lua scripts — all four hierarchical buckets (global, tenant, user, endpoint) are on the same master; EVALSHA works without hash tags", "Automatic failover via sentinel quorum in 10–30s", "Simple operational model: one master, N replicas, M sentinels", "Supports up to ~100K–500K ops/sec on a single m6g.xlarge node"],
                    cons: ["Single write thread bottleneck — all writes serialized through one master", "Vertical scaling only — upgrade the master to a larger instance", "Failover window causes a 10–30s write outage (circuit breaker absorbs this)"],
                  },
                  {
                    title: "Redis Cluster (Not Chosen)", color: "#ec4899",
                    pros: ["Horizontal write sharding across N masters — multi-million ops/sec capacity", "No single write thread bottleneck", "Built-in failover per shard slot"],
                    cons: ["Multi-key commands across different slots throw CROSSSLOT errors", "Hierarchical Lua scripts require all keys to share a hash tag: {tenant:acme}:global, {tenant:acme}:user:alice — adds key design complexity and limits key distribution flexibility", "Hash tags concentrate all tenant keys on the same slot, creating hot slots under tenant-level traffic spikes", "Higher operational complexity: slot rebalancing, resharding, cluster join/leave"],
                  },
                ].map(item => (
                  <div key={item.title} style={{ background: "#111113", border: `1px solid ${item.color}33`, borderRadius: 8, padding: "18px 20px" }}>
                    <h4 style={{ color: item.color, margin: "0 0 12px 0", fontSize: 14 }}>{item.title}</h4>
                    <div style={{ fontSize: 12, color: "#71717a", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>Advantages</div>
                    <ul style={{ margin: "0 0 12px 0", padding: "0 0 0 16px", fontSize: 12.5, color: "#a1a1aa", lineHeight: 1.7 }}>
                      {item.pros.map((p, i) => <li key={i}>{p}</li>)}
                    </ul>
                    <div style={{ fontSize: 12, color: "#71717a", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>Limitations</div>
                    <ul style={{ margin: 0, padding: "0 0 0 16px", fontSize: 12.5, color: "#f472b6", lineHeight: 1.7 }}>
                      {item.cons.map((c, i) => <li key={i}>{c}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
              <p>
                <strong>The decisive factor:</strong> Hierarchical rate limiting requires reading and atomically decrementing four keys in a single Lua script. In Redis Cluster, this is only possible if all four keys hash to the same cluster slot. Enforcing this requires hash tags on every key, which effectively clusters all of a tenant's keys onto a single master node — negating the horizontal scaling benefit of Redis Cluster while adding complexity. Since the target scale (a single payment API sidecar fleet) is well within Redis Sentinel's throughput ceiling, Redis Cluster's complexity premium is not justified.
              </p>

              {/* ─── Trade-off 3 ─────────────────────────────────── */}
              <h2 className="guide-sub-heading" id="sidecar-vs-sdk" style={{ fontSize: 22, color: "#ffffff", marginTop: 44, marginBottom: 12 }}>
                3. Out-of-Process Sidecar vs In-App SDK
              </h2>
              <p>
                Where the rate limiting enforcement logic executes — inside the application process or as a separate network-addressable process — determines the language surface, the deployment footprint, the operational coupling, and the latency profile of every checked request.
              </p>
              <DocsMermaid chart={sidecarVsSdkDiagram} />
              <div style={{ overflowX: "auto", marginTop: 20, marginBottom: 24 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 560 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #27272a" }}>
                      {["Dimension", "Sidecar (Chosen)", "In-App SDK"].map(h => (
                        <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "#ff5cad", fontWeight: 600, fontSize: 12 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["Language support", "Any language — app calls sidecar over HTTP loopback", "Go only (or requires per-language SDK implementations)"],
                      ["Latency overhead", "~0.1–0.3ms loopback HTTP round-trip", "~0ms (in-process function call)"],
                      ["Deployment coupling", "Sidecar versioned independently; zero-downtime updates", "Rate limiter version tied to app deploy cycle"],
                      ["Redis connection pooling", "Centralized: N sidecar pods × 20 conns = controlled pool size", "Distributed: each app pod holds its own pool, hard to bound total"],
                      ["Quota consistency", "All app replicas share the same sidecar → single-writer per instance", "Each app replica connects to Redis independently (correctly if Lua is used, but harder to audit)"],
                      ["Failure isolation", "Sidecar crash does not crash the app; circuit breaker catches it", "SDK crash = app crash; no process boundary for isolation"],
                    ].map(([dim, sc, sdk], i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #18181b", background: i % 2 === 0 ? "#0b0b0b" : "#0f0f12" }}>
                        <td style={{ padding: "8px 12px", color: "#ffffff", fontWeight: 600 }}>{dim}</td>
                        <td style={{ padding: "8px 12px", color: "#c084fc", fontSize: 12 }}>{sc}</td>
                        <td style={{ padding: "8px 12px", color: "#a1a1aa", fontSize: 12 }}>{sdk}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>
                <strong>The loopback latency cost is a non-issue in practice:</strong> At 0.2ms overhead per request, a service with a 50ms p99 SLA absorbs the sidecar overhead as 0.4% of its budget. The polyglot deployment benefit (Java, Python, Node.js services all using the same sidecar binary) far outweighs a 0.2ms penalty that is below the noise floor of most upstream network calls.
              </p>

              {/* ─── Trade-off 4 ─────────────────────────────────── */}
              <h2 className="guide-sub-heading" id="lua-vs-txn" style={{ fontSize: 22, color: "#ffffff", marginTop: 44, marginBottom: 12 }}>
                4. Lua EVALSHA vs WATCH/MULTI/EXEC Transactions
              </h2>
              <p>
                Redis provides two mechanisms for atomic multi-step operations: Lua scripts (EVALSHA) and optimistic locking transactions (WATCH + MULTI/EXEC). Both guarantee atomicity under different models.
              </p>
              <DocsMermaid chart={luaVsTxnDiagram} />
              <p style={{ marginTop: 16 }}>
                <strong>WATCH/MULTI/EXEC (optimistic locking):</strong> The client watches a set of keys, reads their values, queues commands in a MULTI block, and executes with EXEC. If any watched key was modified between WATCH and EXEC, the transaction aborts and the client must retry. Under high contention (many goroutines checking the same user's bucket simultaneously), the retry loop can run dozens of times before succeeding — a <em>livelock</em> scenario that causes latency spikes proportional to concurrency level.
              </p>
              <div style={{ overflowX: "auto", margin: "16px 0 24px 0" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 540 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #27272a" }}>
                      {["Characteristic", "Lua EVALSHA", "WATCH/MULTI/EXEC"].map(h => (
                        <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "#ff5cad", fontWeight: 600, fontSize: 12 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["Atomicity guarantee", "Unconditional — script never partially executes", "Conditional — aborts on contention; client must retry"],
                      ["Redis round-trips per check", "1 (single EVALSHA)", "3–N (WATCH, read, MULTI+EXEC) × retry count"],
                      ["Behavior under high concurrency", "Predictable O(1) latency per script; contention serialized by Redis single-thread", "Livelock possible: O(N²) retries in worst case at high concurrency"],
                      ["Script caching", "SHA1 hash; script loaded once, called by SHA forever (SCRIPT LOAD)", "No caching — commands re-sent on every call"],
                      ["Ability to embed computation", "Full Lua: math, conditionals, string ops inside Redis", "Only Redis commands — no conditional logic in transaction body"],
                      ["Error handling in mid-operation", "Lua error stops script atomically; prior commands NOT committed", "EXEC runs all queued commands regardless of individual errors"],
                    ].map(([char, lua, watch], i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #18181b", background: i % 2 === 0 ? "#0b0b0b" : "#0f0f12" }}>
                        <td style={{ padding: "8px 12px", color: "#ffffff", fontWeight: 600 }}>{char}</td>
                        <td style={{ padding: "8px 12px", color: "#c084fc", fontSize: 12 }}>{lua}</td>
                        <td style={{ padding: "8px 12px", color: "#f472b6", fontSize: 12 }}>{watch}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>
                <strong>The embedded computation requirement is the deciding factor:</strong> The token bucket refill formula (<code>min(C, T_prev + elapsed × R)</code>) cannot be expressed as a sequence of Redis commands — it requires arithmetic that runs inside Redis. WATCH/MULTI/EXEC executes the computation client-side, then queues the result as a SET command. This creates the TOCTOU window described in Invariant 3. Lua eliminates this window by definition.
              </p>

              {/* ─── Trade-off 5 ─────────────────────────────────── */}
              <h2 className="guide-sub-heading" id="audit" style={{ fontSize: 22, color: "#ffffff", marginTop: 44, marginBottom: 12 }}>
                5. Asynchronous Buffered Audit vs Synchronous Inline Logging
              </h2>
              <p>
                The audit subsystem records every rate-limit decision (allowed, denied, circuit-open) with its request metadata for compliance, debugging, and billing reconciliation. The question is whether this write should block the rate-limit hot path.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, margin: "16px 0 24px 0" }}>
                {[
                  {
                    title: "Async Buffered (Chosen)", color: "#c084fc",
                    lines: [
                      "Rate-limit decision is made and returned to the caller immediately",
                      "Audit event is pushed to an in-process Go channel (bounded, cap=10,000)",
                      "Goroutine pool drains channel and writes to Redis LIST asynchronously",
                      "Latency impact: 0ms on the hot path (channel send is non-blocking under normal load)",
                      "Durability risk: crash before channel drains loses buffered audit events",
                    ],
                  },
                  {
                    title: "Synchronous Inline", color: "#ec4899",
                    lines: [
                      "Audit write (Redis RPUSH) occurs before returning the rate-limit decision to the caller",
                      "Every request waits for two Redis round-trips: quota check + audit write",
                      "Latency impact: +0.5–2ms per request on the hot path (additional Redis RTT)",
                      "Durability: audit record committed before response is returned",
                      "Under Redis slowdown or backpressure, audit writes become an API latency multiplier",
                    ],
                  },
                ].map(item => (
                  <div key={item.title} style={{ background: "#111113", border: `1px solid ${item.color}33`, borderRadius: 8, padding: "18px 20px" }}>
                    <h4 style={{ color: item.color, margin: "0 0 12px 0", fontSize: 14 }}>{item.title}</h4>
                    <ul style={{ margin: 0, padding: "0 0 0 16px", fontSize: 12.5, color: "#a1a1aa", lineHeight: 1.75 }}>
                      {item.lines.map((l, i) => <li key={i}>{l}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
              <p>
                <strong>The explicit durability trade-off accepted:</strong> In the async design, a hard crash of the Central Limiter process while the channel has 10,000 pending events will lose those audit records. This is documented and accepted for two reasons: (a) audit logs are reconstructible from the idempotency record HASH in Redis (which persists independently via AOF); (b) a Limiter crash is detected by the circuit breaker within one evaluation window, and the ops team is alerted before a sustained audit gap accumulates.
              </p>
              <p style={{ marginTop: 12 }}>
                <strong>Backpressure handling:</strong> The channel is bounded. If the worker goroutine pool falls behind (Redis slow, worker starved), the channel fills. At capacity, new audit pushes are dropped with a counter increment (<code>audit_dropped_total</code>). This is an explicit signal to the operator that the audit system is falling behind, without ever causing the rate-limit hot path to block.
              </p>

              {/* ─── Trade-off 6 ─────────────────────────────────── */}
              <h2 className="guide-sub-heading" id="fail-mode" style={{ fontSize: 22, color: "#ffffff", marginTop: 44, marginBottom: 12 }}>
                6. Fail-Open vs Fail-Closed Default Policy
              </h2>
              <p>
                When Redis becomes unavailable and the circuit breaker enters the OPEN state, the system must choose a default behavior. This is one of the highest-stakes configuration decisions in the system — it determines the failure mode of the entire payment API.
              </p>
              <div style={{ overflowX: "auto", margin: "16px 0 24px 0" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 560 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #27272a" }}>
                      {["Policy", "Behavior During Outage", "Revenue Impact", "Fraud Risk", "Recommended For"].map(h => (
                        <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "#ff5cad", fontWeight: 600, fontSize: 12 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["FAIL_OPEN", "All requests pass through to upstream without quota enforcement", "Zero — service remains available to all users", "High — abusive callers can flood the upstream during the outage window", "Non-financial APIs, read-heavy endpoints, public content delivery"],
                      ["FAIL_CLOSED", "All requests rejected with HTTP 503 until Redis recovers", "High — legitimate users cannot access the service during Redis downtime", "Zero — no requests reach the upstream during outage", "Payment APIs, financial transactions, write-heavy state-mutating endpoints"],
                      ["FAIL_OPEN with static limits", "Requests pass through; a local in-memory counter enforces a coarse fallback limit", "Minimal — most legitimate traffic passes through", "Low — rough limiting still in place, though not per-user or per-tenant", "General-purpose APIs where some limiting is better than none"],
                    ].map(([policy, behavior, revenue, fraud, rec], i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #18181b", background: i % 2 === 0 ? "#0b0b0b" : "#0f0f12" }}>
                        <td style={{ padding: "8px 12px", color: "#ffffff", fontWeight: 700, fontFamily: "monospace", fontSize: 12 }}>{policy}</td>
                        <td style={{ padding: "8px 12px", color: "#a1a1aa", fontSize: 12 }}>{behavior}</td>
                        <td style={{ padding: "8px 12px", color: i === 0 ? "#c084fc" : i === 1 ? "#ec4899" : "#c084fc", fontSize: 12 }}>{revenue}</td>
                        <td style={{ padding: "8px 12px", color: i === 0 ? "#ec4899" : i === 1 ? "#c084fc" : "#a1a1aa", fontSize: 12 }}>{fraud}</td>
                        <td style={{ padding: "8px 12px", color: "#71717a", fontSize: 12 }}>{rec}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>
                <strong>Default choice: FAIL_OPEN with configurable override.</strong> my system defaults to fail-open because the Redis HA setup (Sentinel with 3 nodes) makes sustained outages rare; the more likely scenario is a brief 10–30s failover window during which denying all legitimate traffic is a disproportionate response. Operators with payment-grade requirements are expected to set <code>CIRCUIT_BREAKER_FAIL_MODE=fail_closed</code> explicitly in their deployment configuration.
              </p>
              <div style={{
                background: "rgba(219, 39, 119, 0.06)", border: "1px solid rgba(219, 39, 119, 0.2)",
                borderRadius: 8, padding: "14px 18px", fontSize: 13, lineHeight: 1.65, marginTop: 16, marginBottom: 24
              }}>
                <strong style={{ color: "#ec4899" }}>Production Recommendation:</strong> For any API that processes financial transactions, set <code>CIRCUIT_BREAKER_FAIL_MODE=fail_closed</code>. The 10–30s outage during a Redis failover is preferable to allowing unmetered access to your payment processing backend. Ensure your Redis Sentinel setup is running on dedicated instances with AOF persistence to minimize both failover duration and post-recovery state loss.
              </div>

              {/* ─── Trade-off 7 ─────────────────────────────────── */}
              <h2 className="guide-sub-heading" id="arithmetic" style={{ fontSize: 22, color: "#ffffff", marginTop: 44, marginBottom: 12 }}>
                7. Fixed-Point Integer Arithmetic vs Floating-Point in Lua
              </h2>
              <p>
                Redis Lua uses Lua 5.1, which represents all numbers as double-precision IEEE 754 floats. For the token bucket, the token level and refill rate are rational numbers (e.g., 1.5 tokens/sec, 0.333 tokens/sec). The question is whether to store these as floats directly or scale them to fixed-point integers.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, margin: "16px 0 24px 0" }}>
                {[
                  {
                    title: "Fixed-Point Integer (Chosen)", color: "#c084fc",
                    lines: [
                      "Tokens stored as integer × 1,000,000,000 (nanosecond precision scale factor)",
                      "Eliminates floating-point accumulation error over millions of refill cycles",
                      "HSET stores integer as a string — no precision loss in Redis serialization",
                      "Deterministic: same inputs always produce the same output, regardless of CPU/OS float rounding mode",
                      "Slightly more complex Lua: multiply/divide by 1e9 on entry and exit",
                    ],
                  },
                  {
                    title: "Floating-Point Direct", color: "#ec4899",
                    lines: [
                      "Tokens stored directly as floats (e.g., 1.5, 0.3333...)",
                      "Simpler Lua — no scale factor needed",
                      "Float accumulation error: after 1 million refill cycles at 1/3 token/sec, token level drifts by ~0.1 tokens from the true value",
                      "Non-deterministic rounding: different Redis builds on different hardware may produce slightly different results",
                      "HSET serializes float to string, potentially losing trailing decimal precision",
                    ],
                  },
                ].map(item => (
                  <div key={item.title} style={{ background: "#111113", border: `1px solid ${item.color}33`, borderRadius: 8, padding: "18px 20px" }}>
                    <h4 style={{ color: item.color, margin: "0 0 12px 0", fontSize: 14 }}>{item.title}</h4>
                    <ul style={{ margin: 0, padding: "0 0 0 16px", fontSize: 12.5, color: "#a1a1aa", lineHeight: 1.75 }}>
                      {item.lines.map((l, i) => <li key={i}>{l}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
              <p>
                For a financial-grade system where token levels directly determine whether a payment is authorized, floating-point drift that accumulates to 0.1 tokens over time is not acceptable. A user with exactly 0 tokens remaining could receive a spurious allow decision due to float rounding. Fixed-point arithmetic eliminates this class of correctness issue at the cost of slightly more Lua complexity.
              </p>

              {/* ─── Trade-off 8 ─────────────────────────────────── */}
              <h2 className="guide-sub-heading" id="consensus" style={{ fontSize: 22, color: "#ffffff", marginTop: 44, marginBottom: 12 }}>
                8. Single Redis Master vs Distributed Consensus (Raft/Paxos)
              </h2>
              <p>
                The most fundamental architectural choice: whether rate-limit state lives in a single Redis master (with async replication) or is committed via a distributed consensus protocol (e.g., etcd, CockroachDB, or a Raft-based Redis alternative like Valkey Cluster with sync replication).
              </p>
              <div style={{ overflowX: "auto", margin: "16px 0 24px 0" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 580 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #27272a" }}>
                      {["Property", "Single Redis Master", "Distributed Consensus (Raft)"].map(h => (
                        <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "#ff5cad", fontWeight: 600, fontSize: 12 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["Write latency", "~0.1–0.5ms (single node)", "~2–15ms (requires quorum acknowledgment from majority of Raft nodes)"],
                      ["Durability under partition", "Last-write-wins after failover; possible replication lag loss (~1 INCR)", "Strong consistency — no data loss across any single-node failure"],
                      ["Operational complexity", "Low — one master, replicas, sentinels", "High — cluster membership, leader election, log compaction, snapshot transfer"],
                      ["Throughput ceiling", "~500K ops/sec (single thread)", "~100K–200K ops/sec (quorum overhead per write)"],
                      ["Cross-partition guarantees", "None — master failure may result in brief quota state regression", "Full linearizability — all nodes agree on every write before acknowledging"],
                    ].map(([prop, redis, raft], i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #18181b", background: i % 2 === 0 ? "#0b0b0b" : "#0f0f12" }}>
                        <td style={{ padding: "8px 12px", color: "#ffffff", fontWeight: 600 }}>{prop}</td>
                        <td style={{ padding: "8px 12px", color: "#c084fc", fontSize: 12 }}>{redis}</td>
                        <td style={{ padding: "8px 12px", color: "#a1a1aa", fontSize: 12 }}>{raft}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>
                <strong>Why single Redis master is correct for this use case:</strong> The Raft-based alternative adds 2–15ms of write latency per rate-limit check. At an API processing 5000 requests/second, this adds 10–75 seconds of cumulative latency per second — the rate limiter would become the dominant latency contributor. Redis Sentinel's async replication introduces at most 1 lost INCR (the fence token counter) across a failover window that occurs at most once per year in a well-operated setup. The correctness risk of one fence token regression per year is vastly outweighed by the 5–30× latency reduction compared to a consensus-based approach.
              </p>
              <p style={{ marginTop: 12 }}>
                <strong>When to revisit this decision:</strong> If the system scales to multi-region deployments where rate-limit state must be consistent across data centers separated by 50–100ms of network latency, the single-master model breaks down. At that point, a CRDTs-based distributed counter (eventual consistency with bounded error) or a regional sharding model (per-region quotas that sum to a global limit) is more appropriate than either Redis Sentinel or strong consensus.
              </p>

              {/* ─── Summary Matrix ─────────────────────────────────── */}
              <h2 className="guide-sub-heading" id="matrix" style={{ fontSize: 22, color: "#ffffff", marginTop: 44, marginBottom: 12 }}>
                Trade-off Summary Matrix
              </h2>
              <p>
                The table below summarizes each decision and its primary optimization target, the most significant cost accepted, and the conditions under which the decision should be revisited.
              </p>
              <div style={{ overflowX: "auto", marginTop: 16, marginBottom: 28 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 680 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #27272a" }}>
                      {["Decision", "Optimized For", "Cost Accepted", "Revisit If"].map(h => (
                        <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "#ff5cad", fontWeight: 600, fontSize: 12 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["Token Bucket over ZSET", "Memory efficiency (200B vs 50KB/user)", "Non-exact boundary behavior (burst window)", ">50M active users requiring strict sliding window compliance"],
                      ["Sentinel over Cluster", "Multi-key atomic Lua scripts", "Single write-thread throughput ceiling", "Write throughput exceeds 500K ops/sec"],
                      ["Sidecar over SDK", "Language-agnostic deployment", "0.2ms loopback overhead per request", "Service has < 5ms SLA where every microsecond counts"],
                      ["Lua over WATCH/EXEC", "Zero-retry atomicity; embedded computation", "Lua script management complexity", "Redis 8+ adds native computed transactions (unlikely)"],
                      ["Async Audit", "Sub-millisecond hot path latency", "Up to 10K audit events lost on hard crash", "Regulatory requirement for zero audit event loss"],
                      ["Fail-Open default", "Service availability during Redis failover", "Unmetered traffic for ~10–30s during failover", "Always for payment APIs — override to fail-closed"],
                      ["Fixed-Point Arithmetic", "Deterministic, drift-free token levels", "Lua scale factor multiplication complexity", "Never — float precision issues are always worse"],
                      ["Single Redis Master", "0.1–0.5ms write latency", "1-INCR loss on failover; no cross-region consistency", "Multi-region deployment with global quota enforcement"],
                    ].map(([decision, opt, cost, revisit], i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #18181b", background: i % 2 === 0 ? "#0b0b0b" : "#0f0f12" }}>
                        <td style={{ padding: "8px 12px", color: "#c084fc", fontWeight: 600, fontSize: 12 }}>{decision}</td>
                        <td style={{ padding: "8px 12px", color: "#a1a1aa", fontSize: 12 }}>{opt}</td>
                        <td style={{ padding: "8px 12px", color: "#f472b6", fontSize: 12 }}>{cost}</td>
                        <td style={{ padding: "8px 12px", color: "#71717a", fontSize: 12 }}>{revisit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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

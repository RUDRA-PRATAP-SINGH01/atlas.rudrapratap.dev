import React from "react";
import DocsMermaid from "@/features/docs/components/DocsMermaid";

export const introductionPages = {
  "start-here": {
    title: "Start Here",
    topics: [
      { label: "System Definition", href: "#definition" },
      { label: "Core Capabilities", href: "#capabilities" },
      { label: "Architectural Overview", href: "#overview" },
      { label: "Reader Paths", href: "#paths" }
    ],
    content: (
      <div>
        <div style={{
          background: "linear-gradient(135deg, rgba(255,92,173,0.08) 0%, rgba(219,69,119,0.04) 100%)",
          border: "1px solid rgba(255,92,173,0.25)",
          borderRadius: 10,
          padding: "24px 28px",
          marginBottom: 28
        }}>
          <p style={{ fontSize: 15, lineHeight: 1.75, color: "#e4e4e7", margin: 0 }}>
            This technical case study explores a <strong style={{ color: "#ff5cad" }}>production-grade distributed rate limiting platform</strong> written in Go. Operating across a fleet of microservices, it coordinates token-refill calculations and multi-key quota decisions atomically inside Redis via custom Lua scripts. The system features a sidecar proxy model, Stripe-style idempotency, automated failover, dynamic runtime overrides, and structured OpenTelemetry tracing.
          </p>
        </div>

        <h2 className="guide-sub-heading" id="definition">System Definition</h2>
        <p>
          At its core, the Distributed Rate Limiter coordinates quota decisions across horizontally scaled application servers. Unlike process-local limiters, it prevents API abuse, shields downstreams from cascades, and enforces precise tier-based quotas globally, even as replicas scale dynamically.
        </p>

        <div style={{
          background: "rgba(39, 39, 42, 0.2)",
          border: "1px solid rgba(255,255,255,0.05)",
          borderRadius: 8,
          padding: 16,
          marginTop: 20,
          marginBottom: 20
        }}>
          <strong style={{ color: "#fff" }}>Key Design Principle:</strong> Global rate coordination requires an atomic authority. To prevent race conditions under concurrent workloads, this platform makes Redis its source of truth, shifting mathematical evaluation directly into the database engine using Lua scripting.
        </div>

        <h2 className="guide-sub-heading" id="capabilities">Core Capabilities & Limits</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginTop: 16, marginBottom: 24 }}>
          <div style={{ background: "#111113", border: "1px solid #27272a", borderRadius: 8, padding: 16 }}>
            <h3 style={{ color: "#ffffff", fontSize: 14, fontWeight: "bold", margin: "0 0 8px 0" }}>Atomic Multi-Tier Quotas</h3>
            <p style={{ margin: 0, fontSize: 13, color: "#a1a1aa", lineHeight: 1.6 }}>
              Evaluates Global, Tenant, User, and Endpoint buckets in a single round-trip. If any tier fails, the entire request is rejected and no tokens are deducted.
            </p>
          </div>
          <div style={{ background: "#111113", border: "1px solid #27272a", borderRadius: 8, padding: 16 }}>
            <h3 style={{ color: "#ffffff", fontSize: 14, fontWeight: "bold", margin: "0 0 8px 0" }}>Resilient Local Offloading</h3>
            <p style={{ margin: 0, fontSize: 13, color: "#a1a1aa", lineHeight: 1.6 }}>
              Employs process-local singleflight collapsing and a denial cache to shield the database under rate-limited key-hammering.
            </p>
          </div>
          <div style={{ background: "#111113", border: "1px solid #27272a", borderRadius: 8, padding: 16 }}>
            <h3 style={{ color: "#ffffff", fontSize: 14, fontWeight: "bold", margin: "0 0 8px 0" }}>Stripe-Style Idempotency</h3>
            <p style={{ margin: 0, fontSize: 13, color: "#a1a1aa", lineHeight: 1.6 }}>
              Lease-locked idempotency keys prevent duplicate execution. Uses distributed fencing tokens to block slow, late-finishing writers.
            </p>
          </div>
          <div style={{ background: "#111113", border: "1px solid #27272a", borderRadius: 8, padding: 16 }}>
            <h3 style={{ color: "#ffffff", fontSize: 14, fontWeight: "bold", margin: "0 0 8px 0" }}>Dynamic Overrides</h3>
            <p style={{ margin: 0, fontSize: 13, color: "#a1a1aa", lineHeight: 1.6 }}>
              Permits operators to override limits dynamically using a monotonic version counter, skipping Pub/Sub dependencies.
            </p>
          </div>
        </div>

        <h2 className="guide-sub-heading" id="overview">Architectural Overview</h2>
        <p>
          The architecture segregates concerns across three runtime tiers: the edge transparent sidecar proxy, the stateless central limiter pool, and the backing high-availability Redis Sentinel cluster.
        </p>

        <DocsMermaid chart={`
flowchart TD
    Client(["Client HTTP Request"])
    Sidecar["Sidecar Proxy (:9090)\\n(cmd/sidecar)"]
    Limiter["Central Limiter Pool (:8080)\\n(cmd/limiter)"]
    Redis[("Redis Master (:6379)\\n(State & Lua Engine)")]
    Upstream["Upstream Service"]

    Client --> Sidecar
    Sidecar -->|"/check_hierarchical"| Limiter
    Limiter -->|"Run atomic script"| Redis
    Redis -->|"Result {allowed, remaining}"| Limiter
    Limiter --> Sidecar
    Sidecar -->|"Proxy forward (if allowed)"| Upstream
    Sidecar -->|"429 Too Many Requests (if denied)"| Client
    style Client fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style Sidecar fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style Limiter fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style Redis fill:#18181b,stroke:#ec4899,color:#fff
    style Upstream fill:#18181b,stroke:#52525b,color:#a1a1aa
        `} />

        <h2 className="guide-sub-heading" id="paths">Choose Your Path</h2>
        <p>
          We suggest exploring this systems architecture using one of the following curated engineering paths:
        </p>
        <ul className="guide-bullets-list">
          <li><strong>5-Minute Technical Tour:</strong> Get a rapid, high-fidelity overview of request pathways, Lua execution, and observed latency statistics.</li>
          <li><strong>Deep-Dive Architecture:</strong> Investigate distributed state mapping, database invariants, and system invariants.</li>
          <li><strong>Performance Lab:</strong> Examine raw, verified benchmark data capturing peak loads, soak testing, and recovery profiles.</li>
        </ul>
      </div>
    )
  },

  "the-problem": {
    title: "The Problem",
    topics: [
      { label: "Why Local Counters Fail", href: "#local-fail" },
      { label: "Race Conditions & TOCTOU", href: "#races" },
      { label: "Consistency vs. Latency", href: "#tradeoffs" }
    ],
    content: (
      <div>
        <p>
          Understanding why rate limiting in a distributed system is difficult requires analyzing why typical process-local structures fall apart when stretched across replicas.
        </p>

        <h2 className="guide-sub-heading" id="local-fail">Why Local Counters Fail (Over-Admission)</h2>
        <p>
          In a single-process application, rate limiting is a solved problem. A local mutex wraps an in-memory token bucket. But when application servers are scaled horizontally behind a load balancer, process-local limiting causes massive quota over-admission.
        </p>
        <p>
          If a tenant is capped at 1,000 requests/minute, and we run 5 application replicas, a naive local counter would allow up to 1,000 requests * 5 instances = 5,000 requests/minute to hit our database upstreams. Alternatively, hard-allocating 200 requests/replica fails under uneven traffic distribution: if Replica 1 is idle while Replica 2 is flooded, requests are rejected even though the overall tenant limit is not exhausted.
        </p>

        <DocsMermaid chart={`
sequenceDiagram
    autonumber
    actor Client 1
    actor Client 2
    participant Replica 1 as sidecar-replica-1
    participant Replica 2 as sidecar-replica-2
    participant Redis as Shared Redis Master

    Client 1->>Replica 1: GET /api/checkout (Key: user_12)
    Client 2->>Replica 2: GET /api/checkout (Key: user_12)
    Note over Replica 1, Redis: Parallel Read
    Replica 1->>Redis: HGET rate:user_12 tokens (Returns 1)
    Replica 2->>Redis: HGET rate:user_12 tokens (Returns 1)
    Note over Replica 1, Replica 2: Both replicas think 1 token is available!
    Replica 1->>Redis: HSET rate:user_12 tokens 0 (Allow)
    Replica 2->>Redis: HSET rate:user_12 tokens 0 (Allow)
    Note over Redis: Race Condition: Over-admission occurred!
        `} />

        <h2 className="guide-sub-heading" id="races">Race Conditions & TOCTOU</h2>
        <p>
          As demonstrated above, simply centralizing state in a shared database does not resolve the coordination problem. A standard check-then-act flow (Time-of-Check to Time-of-Use or <strong>TOCTOU</strong>) creates catastrophic race conditions.
        </p>
        <p>
          Under parallel workloads, multiple worker nodes read the same balance, calculate remaining tokens, and write back updates. If two concurrent writes overlap, one updates the other's state, leading to token leakage and system over-admission. Protecting this write using a distributed lock introduces enormous latency overhead, turning the rate limiter into a massive system bottleneck.
        </p>

        <h2 className="guide-sub-heading" id="tradeoffs">Consistency vs. Latency Tension</h2>
        <p>
          To maintain strict correctness, every API call must complete a network hop to the central state store before proceeding. This introduces a direct trade-off:
        </p>
        <ul className="guide-bullets-list">
          <li><strong>Strong Consistency:</strong> Query the database atomically. Guarantees that limits are never bypassed, but adds network latency (p99 ~11 ms) to every inbound request.</li>
          <li><strong>High Availability / Local Buffering:</strong> Batch tokens locally to reduce hops. Dramatically cuts latency, but permits over-admission during traffic bursts and partitions.</li>
        </ul>
      </div>
    )
  },

  "guarantees-and-limitations": {
    title: "Guarantees & Limitations",
    topics: [
      { label: "Guarantee Matrix", href: "#matrix" },
      { label: "Strong Guarantees", href: "#strong" },
      { label: "Documented Limitations", href: "#limitations" }
    ],
    content: (
      <div>
        <p>
          Before designing or deploying distributed rate limiters, we must align on precisely what the system guarantees under normal and failure states, and what remains explicitly out of scope.
        </p>

        <h2 className="guide-sub-heading" id="matrix">Distributed Systems Guarantee Matrix</h2>
        <div style={{ overflowX: "auto", margin: "20px 0" }}>
          <table className="guide-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #27272a", textAlign: "left" }}>
                <th style={{ padding: "12px 8px" }}>System Property</th>
                <th style={{ padding: "12px 8px" }}>Guarantee Level</th>
                <th style={{ padding: "12px 8px" }}>Coordinating Mechanism</th>
                <th style={{ padding: "12px 8px" }}>Proven Evidence</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Atomic Quota Check</td>
                <td><span style={{ background: "#22c55e20", color: "#22c55e", padding: "2px 6px", borderRadius: 4, fontSize: 11, fontWeight: "bold" }}>STRONG</span></td>
                <td>Redis atomic Lua script execution</td>
                <td>SOURCE + TEST-PROVEN</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Multi-Replica Correctness</td>
                <td><span style={{ background: "#22c55e20", color: "#22c55e", padding: "2px 6px", borderRadius: 4, fontSize: 11, fontWeight: "bold" }}>STRONG</span></td>
                <td>Shared Redis master state coordinator</td>
                <td>RUNTIME-PROVEN</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Idempotency Replay</td>
                <td><span style={{ background: "#eab30820", color: "#eab308", padding: "2px 6px", borderRadius: 4, fontSize: 11, fontWeight: "bold" }}>CONDITIONAL</span></td>
                <td>Redis metadata lookup + body caching</td>
                <td>TEST + RUNTIME</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Upstream Side Effects</td>
                <td><span style={{ background: "#ef444420", color: "#ef4444", padding: "2px 6px", borderRadius: 4, fontSize: 11, fontWeight: "bold" }}>NONE</span></td>
                <td>Best-effort only (crash window exist)</td>
                <td>DESIGN DECISION</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Audit Log Delivery</td>
                <td><span style={{ background: "#ef444420", color: "#ef4444", padding: "2px 6px", borderRadius: 4, fontSize: 11, fontWeight: "bold" }}>BEST-EFFORT</span></td>
                <td>Bounded memory queue + async workers</td>
                <td>SOURCE + TEST</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2 className="guide-sub-heading" id="strong">Strong Guarantees</h2>
        <ul className="guide-bullets-list">
          <li><strong>Zero Over-Admission under Redis Availability:</strong> Quota calculations run sequentially in a single-threaded Redis execution window. Parallel client requests on duplicate keys cannot bypass limits.</li>
          <li><strong>Atomic Multi-Level Rolls:</strong> On hierarchical check `/check_hierarchical`, either ALL levels (global, tenant, user, endpoint) approve, or the request fails. No partial token leakage occurs.</li>
          <li><strong>Concurrent Duplicate Rejection:</strong> Concurrent idempotency requests submit fencing tokens. Only the winner obtains the lease, while duplicate concurrent calls block or fail fast.</li>
        </ul>

        <h2 className="guide-sub-heading" id="limitations">Documented Limitations</h2>
        <div style={{
          background: "rgba(239, 68, 68, 0.05)",
          border: "1px solid rgba(239, 68, 68, 0.2)",
          borderRadius: 8,
          padding: "16px 20px",
          marginTop: 16
        }}>
          <h4 style={{ color: "#ef4444", margin: "0 0 8px 0", fontSize: 14, fontWeight: "bold" }}>Not Exactly-Once Upstream Side Effects</h4>
          <p style={{ margin: 0, fontSize: 13, color: "#fca5a5", lineHeight: 1.6 }}>
            If a client sends an idempotent POST request, the sidecar claims the key, proxies it to the backend, and the backend succeeds. If the sidecar crashes before writing the completion status to Redis, the idempotency lease eventually expires. A subsequent client retry will reclaim the expired lock, calling the upstream service a second time. At-most-once side-effects must be handled inside the upstream application database.
          </p>
        </div>
      </div>
    )
  },

  "five-minute-technical-tour": {
    title: "5-Minute Technical Tour",
    topics: [
      { label: "Request Path Summary", href: "#path-tour" },
      { label: "Lua Engine Decision", href: "#lua-tour" },
      { label: "Resilience Mechanics", href: "#resilience-tour" },
      { label: "Observe Performance", href: "#stats-tour" }
    ],
    content: (
      <div>
        <p>
          Let's run through the system architecture, code invariants, and verified benchmark results.
        </p>

        <h2 className="guide-sub-heading" id="path-tour">1. The Request Pathway</h2>
        <p>
          When a request arrives at the Transparent Sidecar Proxy (`cmd/sidecar`), the proxy extracts target identifiers (like User IDs or Tenant headers) and does a local fast check:
        </p>
        <ol className="guide-bullets-list" style={{ listStyleType: "decimal" }}>
          <li><strong>Denial Cache Check:</strong> If this client was recently denied (within past 1s), the sidecar rejects it immediately, bypassing Redis.</li>
          <li><strong>Singleflight Collapse:</strong> If 100 concurrent requests on the same key hit the sidecar simultaneously, they collapse into a single RPC call to the Limiter service.</li>
          <li><strong>Limiter Check:</strong> The Limiter service (`cmd/limiter`) queries Redis using a SHA-hashed Lua script.</li>
        </ol>

        <h2 className="guide-sub-heading" id="lua-tour">2. The Lua Database Engine</h2>
        <p>
          Redis evaluates token bucket balances inside an atomic transaction. A sample execution structure for the single token bucket is:
        </p>
        <pre style={{ background: "#0e0e11", border: "1px solid #27272a", padding: 14, borderRadius: 6, fontSize: 12, overflowX: "auto" }}>
{`-- Read state
local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
local tokens = tonumber(bucket[1]) or capacity
local last_refill = tonumber(bucket[2]) or now

-- Calculate elapsed time and refill
local elapsed = (now - last_refill) / 1000.0
local new_tokens = math.min(capacity, tokens + (elapsed * refill_rate))

-- Check & decrement
local allowed = 0
if new_tokens >= requested then
    new_tokens = new_tokens - requested
    allowed = 1
end
redis.call('HMSET', key, 'tokens', new_tokens, 'last_refill', now)
return {allowed, math.floor(new_tokens)}`}
        </pre>

        <h2 className="guide-sub-heading" id="resilience-tour">3. Failure Hardening</h2>
        <p>
          Resilience is built into the proxy layers:
        </p>
        <ul className="guide-bullets-list">
          <li><strong>Circuit Breakers:</strong> If Redis or Limiter fails, the sidecar trips its circuit breaker, failing closed to block traffic and protect backends, or failing open if configured.</li>
          <li><strong>Timeouts:</strong> The sidecar bounds connection paths. Redis timeouts are capped at 1,000 ms, and Limiter HTTP timeouts are capped at 500 ms.</li>
        </ul>

        <h2 className="guide-sub-heading" id="stats-tour">4. Key Measured Benchmark Results</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginTop: 16 }}>
          <div style={{ background: "#111113", border: "1px solid #27272a", borderRadius: 8, padding: 16, textAlign: "center" }}>
            <div style={{ fontSize: 28, fontWeight: "bold", color: "#ff5cad" }}>872 RPS</div>
            <div style={{ fontSize: 12, color: "#a1a1aa", marginTop: 4 }}>Max Sustainable Load (p99 = 11 ms)</div>
          </div>
          <div style={{ background: "#111113", border: "1px solid #27272a", borderRadius: 8, padding: 16, textAlign: "center" }}>
            <div style={{ fontSize: 28, fontWeight: "bold", color: "#c084fc" }}>+3.7 ms</div>
            <div style={{ fontSize: 12, color: "#a1a1aa", marginTop: 4 }}>Sidecar Proxy Overhead (p50)</div>
          </div>
          <div style={{ background: "#111113", border: "1px solid #27272a", borderRadius: 8, padding: 16, textAlign: "center" }}>
            <div style={{ fontSize: 28, fontWeight: "bold", color: "#22c55e" }}>7 ms</div>
            <div style={{ fontSize: 12, color: "#a1a1aa", marginTop: 4 }}>Denial Cache Response (p99)</div>
          </div>
        </div>
      </div>
    )
  }
};

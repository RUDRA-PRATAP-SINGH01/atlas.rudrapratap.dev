import React from "react";
import DocsMermaid from "@/features/docs/components/DocsMermaid";
import {
  RLThesis,
  RLQuickModel,
  RLEvidenceBadge,
  RLCallout,
  RLSourceExcerpt,
  RLRelatedPages,
  RLStatGrid
} from "../components/RLDocBlocks.jsx";

export const introductionPages = {
  "start-here": {
    title: "Start Here",
    topics: [
      { label: "System Definition", href: "#definition" },
      { label: "Core Capabilities", href: "#capabilities" },
      { label: "Architectural Overview", href: "#overview" },
      { label: "Verified Defaults", href: "#defaults" },
      { label: "Reader Paths", href: "#paths" }
    ],
    content: (
      <div>
        <RLThesis>
          This technical case study documents a <strong style={{ color: "#ff5cad" }}>production-grade distributed rate limiting platform</strong> written in Go. A transparent sidecar proxy delegates quota decisions to a central limiter that evaluates token-bucket or sliding-window logic atomically inside Redis via Lua scripts. The stack ships with Stripe-style idempotency replay, configurable fail-open/fail-closed policies, dynamic runtime overrides, and OpenTelemetry tracing — with every headline claim traceable to source or benchmark artifacts (commit <code style={{ color: "#ff5cad" }}>a1de9ec</code>).
        </RLThesis>

        <RLQuickModel>
          Think of three tiers: the <strong>sidecar</strong> (:9090) intercepts HTTP, applies safe process-local optimizations, and forwards allowed traffic; the <strong>central limiter</strong> (:8080) is a stateless connection concentrator that runs Lua quota scripts; <strong>Redis</strong> (:6379) is the single atomic authority for all distributed state. Quota correctness is global; denial-cache and singleflight optimizations are per-process only.
        </RLQuickModel>

        <h2 className="guide-sub-heading" id="definition">System Definition</h2>
        <p>
          At its core, the Distributed Rate Limiter coordinates quota decisions across horizontally scaled application servers. Unlike process-local limiters, it prevents API abuse, shields downstreams from cascades, and enforces precise tier-based quotas globally, even as replicas scale dynamically.
        </p>

        <RLCallout variant="info" title="Key design principle">
          Global rate coordination requires an atomic authority. To prevent race conditions under concurrent workloads, this platform makes Redis its source of truth, shifting mathematical evaluation directly into the database engine using Lua scripting.
        </RLCallout>

        <h2 className="guide-sub-heading" id="capabilities">Core Capabilities & Limits</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginTop: 16, marginBottom: 24 }}>
          <div style={{ background: "#111113", border: "1px solid #27272a", borderRadius: 8, padding: 16 }}>
            <h3 style={{ color: "#ffffff", fontSize: 14, fontWeight: "bold", margin: "0 0 8px 0" }}>Atomic Multi-Tier Quotas</h3>
            <p style={{ margin: 0, fontSize: 13, color: "#a1a1aa", lineHeight: 1.6 }}>
              Evaluates Global, Tenant, User, and Endpoint buckets in a single Lua round-trip. If any tier fails, the entire request is rejected and no tokens are deducted.
            </p>
          </div>
          <div style={{ background: "#111113", border: "1px solid #27272a", borderRadius: 8, padding: 16 }}>
            <h3 style={{ color: "#ffffff", fontSize: 14, fontWeight: "bold", margin: "0 0 8px 0" }}>Denial-Only Local Shielding</h3>
            <p style={{ margin: 0, fontSize: 13, color: "#a1a1aa", lineHeight: 1.6 }}>
              Process-local singleflight collapses concurrent misses on the same key into one limiter call. The denial cache (<code style={{ color: "#ff5cad" }}>CACHE_TTL_MS</code>, default 30 ms) serves only denials — allowed entries are stored but ignored on hit so token counts stay accurate.
            </p>
          </div>
          <div style={{ background: "#111113", border: "1px solid #27272a", borderRadius: 8, padding: 16 }}>
            <h3 style={{ color: "#ffffff", fontSize: 14, fontWeight: "bold", margin: "0 0 8px 0" }}>Stripe-Style Idempotency Replay</h3>
            <p style={{ margin: 0, fontSize: 13, color: "#a1a1aa", lineHeight: 1.6 }}>
              Lease-locked idempotency keys prevent duplicate response replay. Fencing tokens block stale writers — but idempotency does <em>not</em> guarantee exactly-once upstream side effects if the sidecar crashes before completion.
            </p>
          </div>
          <div style={{ background: "#111113", border: "1px solid #27272a", borderRadius: 8, padding: 16 }}>
            <h3 style={{ color: "#ffffff", fontSize: 14, fontWeight: "bold", margin: "0 0 8px 0" }}>Dynamic Overrides</h3>
            <p style={{ margin: 0, fontSize: 13, color: "#a1a1aa", lineHeight: 1.6 }}>
              Operators override limits via a monotonic <code style={{ color: "#ff5cad" }}>config:generation</code> counter. The limiter reads overrides through a local TTL cache (<code style={{ color: "#ff5cad" }}>OVERRIDE_CACHE_TTL_MS</code>, default 5000 ms) without Pub/Sub.
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

        <h2 className="guide-sub-heading" id="defaults">Verified Defaults Snapshot</h2>
        <div style={{ overflowX: "auto", margin: "20px 0" }}>
          <table className="guide-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #27272a", textAlign: "left" }}>
                <th style={{ padding: "12px 8px" }}>Parameter</th>
                <th style={{ padding: "12px 8px" }}>Code Default</th>
                <th style={{ padding: "12px 8px" }}>Docker Compose</th>
                <th style={{ padding: "12px 8px" }}>Evidence</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}><code>ALGORITHM</code></td>
                <td><code>token</code></td>
                <td><code>sliding</code></td>
                <td><RLEvidenceBadge type="SOURCE-PROVEN" /></td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}><code>CACHE_TTL_MS</code></td>
                <td>30 ms</td>
                <td>(unset — inherits 30 ms)</td>
                <td><RLEvidenceBadge type="SOURCE-PROVEN" /></td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}><code>FAIL_OPEN</code></td>
                <td><code>false</code></td>
                <td><code>false</code></td>
                <td><RLEvidenceBadge type="SOURCE-PROVEN" /></td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Max sustainable throughput</td>
                <td colSpan={2}>~872 actual RPS (sidecar e2e @ 1000 target, p99 11 ms)</td>
                <td><RLEvidenceBadge type="BENCHMARK-PROVEN" /></td>
              </tr>
            </tbody>
          </table>
        </div>

        <RLSourceExcerpt
          source="cmd/limiter/config.go — LoadConfig()"
          establishes="Code default algorithm is token; docker-compose.yml overrides to sliding for benchmark topology."
        >{`Algorithm: getEnv("ALGORITHM", "token"),`}</RLSourceExcerpt>

        <h2 className="guide-sub-heading" id="paths">Choose Your Path</h2>
        <p>
          We suggest exploring this systems architecture using one of the following curated engineering paths:
        </p>
        <ul className="guide-bullets-list">
          <li><strong>5-Minute Technical Tour:</strong> Rapid overview of request pathways, Lua execution, verified timeout defaults, and benchmark statistics.</li>
          <li><strong>Deep-Dive Architecture:</strong> Investigate distributed state mapping, database invariants, and system invariants.</li>
          <li><strong>Performance Lab:</strong> Examine raw, verified benchmark data capturing peak loads, soak testing, and recovery profiles.</li>
        </ul>

        <RLRelatedPages pages={[
          { slug: "the-problem", section: "introduction", title: "The Problem", note: "Why local counters and naive Redis reads fail" },
          { slug: "guarantees-and-limitations", section: "introduction", title: "Guarantees & Limitations", note: "What the system does and does not promise" },
          { slug: "five-minute-technical-tour", section: "introduction", title: "5-Minute Technical Tour", note: "Request path, resilience, and benchmark numbers" },
          { slug: "system-at-a-glance", section: "architecture", title: "System at a Glance", note: "Three-level topology map" }
        ]} />
      </div>
    )
  },

  "the-problem": {
    title: "The Problem",
    topics: [
      { label: "Why Local Counters Fail", href: "#local-fail" },
      { label: "Race Conditions & TOCTOU", href: "#races" },
      { label: "Consistency vs. Latency", href: "#tradeoffs" },
      { label: "Why Atomic Lua", href: "#atomic-lua" }
    ],
    content: (
      <div>
        <RLThesis>
          Rate limiting in a distributed system is hard because <strong style={{ color: "#ff5cad" }}>quota is a shared resource</strong> contended by many replicas simultaneously. Process-local counters over-admit; naive shared-database reads create TOCTOU races. The fix is not more locking — it is moving check-and-deduct into Redis's single-threaded Lua execution window.
        </RLThesis>

        <RLQuickModel>
          Imagine five app replicas each holding a local counter for the same tenant. Under uneven load, either they collectively allow 5× the quota (over-admission) or one hot replica exhausts its slice while others sit idle (under-utilization). A central atomic store eliminates both failure modes at the cost of one network hop per cache miss.
        </RLQuickModel>

        <h2 className="guide-sub-heading" id="local-fail">Why Local Counters Fail (Over-Admission)</h2>
        <p>
          In a single-process application, rate limiting is a solved problem. A local mutex wraps an in-memory token bucket. But when application servers are scaled horizontally behind a load balancer, process-local limiting causes massive quota over-admission.
        </p>
        <p>
          If a tenant is capped at 1,000 requests/minute, and we run 5 application replicas, a naive local counter would allow up to 1,000 requests × 5 instances = 5,000 requests/minute to hit our database upstreams. Alternatively, hard-allocating 200 requests/replica fails under uneven traffic distribution: if Replica 1 is idle while Replica 2 is flooded, requests are rejected even though the overall tenant limit is not exhausted.
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
          To maintain strict correctness, every API call on a cache miss must complete a network hop to the central state store before proceeding. This introduces a direct trade-off:
        </p>
        <ul className="guide-bullets-list">
          <li><strong>Strong Consistency:</strong> Query Redis atomically via Lua. Guarantees that limits are never bypassed when Redis is available. At sustainable load (~872 RPS sidecar e2e), measured p99 is ~11 ms — not a fixed per-request tax at all throughput levels.</li>
          <li><strong>Process-Local Buffering:</strong> The sidecar denial cache and singleflight reduce Redis load under abuse bursts, but they are <em>per-process only</em>. Cross-replica deduplication does not occur; correctness is preserved, optimization is lost.</li>
        </ul>

        <RLCallout variant="warning" title="Process-local optimizations are not distributed">
          <code>singleflight.Group</code> and the denial <code>sync.Map</code> live inside each sidecar process. Two replicas hammering the same key can each issue a limiter round-trip. Quota math remains correct because Redis is authoritative; only the shielding efficiency differs.
        </RLCallout>

        <h2 className="guide-sub-heading" id="atomic-lua">Why Atomic Lua Solves It</h2>
        <p>
          Redis executes Lua scripts inline and atomically — no other command can interleave between token check and deduct. This eliminates TOCTOU without distributed locks.
        </p>

        <RLSourceExcerpt
          source="internal/limiter/lua/token_bucket.lua"
          language="lua"
          establishes="Read, refill, check, and write happen in one atomic Redis execution — no interleaved commands."
        >{`local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
-- ... refill math ...
if new_tokens >= requested then
    new_tokens = new_tokens - requested
    allowed = 1
end
redis.call('HMSET', key, 'tokens', new_tokens, 'last_refill', now)
return {allowed, math.floor(new_tokens)}`}</RLSourceExcerpt>

        <RLRelatedPages pages={[
          { slug: "start-here", section: "introduction", title: "Start Here", note: "Platform overview and verified defaults" },
          { slug: "guarantees-and-limitations", section: "introduction", title: "Guarantees & Limitations", note: "Formal guarantee matrix" },
          { slug: "redis-lua-atomicity", section: "rate-limiting-engine", title: "Redis Lua Atomicity", note: "Script internals and key patterns" },
          { slug: "multi-replica-correctness", section: "rate-limiting-engine", title: "Multi-Replica Correctness", note: "Proof that shared Redis prevents over-admission" }
        ]} />
      </div>
    )
  },

  "guarantees-and-limitations": {
    title: "Guarantees & Limitations",
    topics: [
      { label: "Guarantee Matrix", href: "#matrix" },
      { label: "Strong Guarantees", href: "#strong" },
      { label: "Documented Limitations", href: "#limitations" },
      { label: "Idempotency Scope", href: "#idempotency-scope" }
    ],
    content: (
      <div>
        <RLThesis>
          Before designing or deploying distributed rate limiters, align on precisely what the system <strong style={{ color: "#ff5cad" }}>guarantees under normal and failure states</strong> — and what remains explicitly out of scope. Quota atomicity is strong when Redis is available; idempotency replay is strong; upstream side-effect exactly-once is not.
        </RLThesis>

        <RLQuickModel>
          Redis Lua gives you <em>at-most-one token deduct per allowed request</em> globally. The sidecar denial cache can only make you <em>more restrictive</em> (serve a cached 429), never more permissive. Idempotency replays cached HTTP responses but cannot rewind a backend that already committed work.
        </RLQuickModel>

        <h2 className="guide-sub-heading" id="matrix">Distributed Systems Guarantee Matrix</h2>
        <div style={{ overflowX: "auto", margin: "20px 0" }}>
          <table className="guide-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #27272a", textAlign: "left" }}>
                <th style={{ padding: "12px 8px" }}>System Property</th>
                <th style={{ padding: "12px 8px" }}>Guarantee Level</th>
                <th style={{ padding: "12px 8px" }}>Coordinating Mechanism</th>
                <th style={{ padding: "12px 8px" }}>Evidence</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Atomic Quota Check</td>
                <td><span style={{ background: "#22c55e20", color: "#22c55e", padding: "2px 6px", borderRadius: 4, fontSize: 11, fontWeight: "bold" }}>STRONG</span></td>
                <td>Redis atomic Lua script execution</td>
                <td><RLEvidenceBadge type="SOURCE-PROVEN" /> <RLEvidenceBadge type="TEST-PROVEN" /></td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Multi-Replica Correctness</td>
                <td><span style={{ background: "#22c55e20", color: "#22c55e", padding: "2px 6px", borderRadius: 4, fontSize: 11, fontWeight: "bold" }}>STRONG</span></td>
                <td>Shared Redis master state coordinator</td>
                <td><RLEvidenceBadge type="RUNTIME-PROVEN" /></td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Denial Cache Safety</td>
                <td><span style={{ background: "#22c55e20", color: "#22c55e", padding: "2px 6px", borderRadius: 4, fontSize: 11, fontWeight: "bold" }}>STRONG</span></td>
                <td>Only cached denials served; allowed entries ignored on hit</td>
                <td><RLEvidenceBadge type="SOURCE-PROVEN" /></td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Singleflight Dedup</td>
                <td><span style={{ background: "#eab30820", color: "#eab308", padding: "2px 6px", borderRadius: 4, fontSize: 11, fontWeight: "bold" }}>PROCESS-LOCAL</span></td>
                <td><code>golang.org/x/sync/singleflight</code> per sidecar instance</td>
                <td><RLEvidenceBadge type="TEST-PROVEN" /></td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Idempotency Replay</td>
                <td><span style={{ background: "#eab30820", color: "#eab308", padding: "2px 6px", borderRadius: 4, fontSize: 11, fontWeight: "bold" }}>CONDITIONAL</span></td>
                <td>Redis metadata lookup + body caching + fencing tokens</td>
                <td><RLEvidenceBadge type="TEST-PROVEN" /> <RLEvidenceBadge type="RUNTIME-PROVEN" /></td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Upstream Side Effects</td>
                <td><span style={{ background: "#ef444420", color: "#ef4444", padding: "2px 6px", borderRadius: 4, fontSize: 11, fontWeight: "bold" }}>NONE</span></td>
                <td>Best-effort only — crash-before-complete window exists</td>
                <td><RLEvidenceBadge type="DOCUMENTED LIMITATION" /></td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Audit Log Delivery</td>
                <td><span style={{ background: "#ef444420", color: "#ef4444", padding: "2px 6px", borderRadius: 4, fontSize: 11, fontWeight: "bold" }}>BEST-EFFORT</span></td>
                <td>Bounded memory queue + async workers</td>
                <td><RLEvidenceBadge type="SOURCE-PROVEN" /> <RLEvidenceBadge type="TEST-PROVEN" /></td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Sustainable Throughput</td>
                <td><span style={{ background: "#f59e0b20", color: "#fbbf24", padding: "2px 6px", borderRadius: 4, fontSize: 11, fontWeight: "bold" }}>~872 RPS</span></td>
                <td>Sidecar e2e @ 1000 target, p99 &lt; 100 ms, 0% non-429 errors</td>
                <td><RLEvidenceBadge type="BENCHMARK-PROVEN" /></td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2 className="guide-sub-heading" id="strong">Strong Guarantees</h2>
        <ul className="guide-bullets-list">
          <li><strong>Zero Over-Admission under Redis Availability:</strong> Quota calculations run sequentially in a single-threaded Redis execution window. Parallel client requests on duplicate keys cannot bypass limits.</li>
          <li><strong>Atomic Multi-Level Rolls:</strong> On hierarchical check <code>/check_hierarchical</code>, either ALL levels (global, tenant, user, endpoint) approve, or the request fails. No partial token leakage occurs.</li>
          <li><strong>Denial Cache Cannot Over-Allow:</strong> Only <code>Allowed=false</code> entries are served from cache. Allowed entries stored in the map are explicitly ignored on subsequent hits — token accuracy is preserved.</li>
          <li><strong>Concurrent Duplicate Rejection:</strong> Concurrent idempotency requests submit fencing tokens. Only the winner obtains the lease, while duplicate concurrent calls block or fail fast.</li>
        </ul>

        <RLSourceExcerpt
          source="cmd/sidecar/main.go — serveNormal()"
          establishes="Denial cache serves only rejections; allowed cache hits are logged and ignored, forcing a fresh limiter check."
        >{`if !entry.Allowed {
    metrics.RecordCacheHit()
    s.writeDenial(w, entry.Limit, entry.Remaining, entry.RetryAfter)
    return
}
logging.Debug(ctx, "allowed cache entry ignored", ...)`}</RLSourceExcerpt>

        <h2 className="guide-sub-heading" id="limitations">Documented Limitations</h2>
        <RLCallout variant="limitation" title="Not exactly-once upstream side effects">
          If a client sends an idempotent POST request, the sidecar claims the key, proxies it to the backend, and the backend succeeds. If the sidecar crashes before writing the completion status to Redis, the idempotency lease eventually expires. A subsequent client retry will reclaim the expired lock, calling the upstream service a second time. At-most-once side-effects must be handled inside the upstream application database.
        </RLCallout>

        <h2 className="guide-sub-heading" id="idempotency-scope">Idempotency Scope</h2>
        <p>
          Idempotency guarantees <strong>response replay</strong> for identical requests within the completed TTL (default 24 h). It does <em>not</em> guarantee that the upstream service executed exactly once. Operators requiring payment-grade deduplication must implement application-level idempotency keys in the backend datastore.
        </p>

        <RLRelatedPages pages={[
          { slug: "the-problem", section: "introduction", title: "The Problem", note: "Why naive approaches fail" },
          { slug: "five-minute-technical-tour", section: "introduction", title: "5-Minute Technical Tour", note: "Operational defaults and measured performance" },
          { slug: "idempotency", section: "resilience", title: "Idempotency", note: "Lease lifecycle, fencing, and completion" },
          { slug: "what-has-been-proven", section: "correctness-and-verification", title: "What Has Been Proven?", note: "Evidence categories and test coverage" }
        ]} />
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
        <RLThesis>
          This tour walks the <strong style={{ color: "#ff5cad" }}>verified request path</strong> from sidecar interception through Lua quota evaluation to upstream forwarding — including the process-local optimizations, timeout budgets, and benchmark numbers that define operational reality.
        </RLThesis>

        <RLQuickModel>
          Normal path: denial cache (denials only) → singleflight collapse → <code>GET /check</code> or <code>/check_hierarchical</code> → Lua in Redis → forward or 429. On infrastructure failure the default is <strong>fail-closed</strong> (503) unless <code>FAIL_OPEN=true</code>.
        </RLQuickModel>

        <h2 className="guide-sub-heading" id="path-tour">1. The Request Pathway</h2>
        <p>
          When a request arrives at the Transparent Sidecar Proxy (<code>cmd/sidecar</code>), the proxy extracts target identifiers (User IDs, Tenant headers) and runs <code>serveNormal</code>:
        </p>
        <ol className="guide-bullets-list" style={{ listStyleType: "decimal" }}>
          <li><strong>Denial Cache Check:</strong> If this key was recently denied (within <code>CACHE_TTL_MS</code>, default <strong>30 ms</strong>), the sidecar returns 429 immediately. Allowed entries in cache are ignored — every allowance triggers a fresh limiter check.</li>
          <li><strong>Singleflight Collapse:</strong> If 100 concurrent requests on the same key hit this sidecar process simultaneously, they collapse into a single HTTP call to the limiter. This is process-local only; a second replica does not share the collapse.</li>
          <li><strong>Limiter Check:</strong> The limiter (<code>cmd/limiter</code>) queries Redis using a SHA-hashed Lua script. Default algorithm in code is <code>token</code>; docker-compose benchmarks use <code>sliding</code>.</li>
        </ol>

        <RLSourceExcerpt
          source="cmd/sidecar/main.go — serveNormal() + limitFlight.Do"
          establishes="Denial-only cache read, then singleflight-wrapped checkRateLimit for cache misses."
        >{`// singleflight: 100 concurrent requests for the same user share one limiter round-trip.
resultAny, err, _ := s.limitFlight.Do(cacheKey, func() (interface{}, error) {
    return s.checkRateLimit(ctx, r, userID, false)
})`}</RLSourceExcerpt>

        <h2 className="guide-sub-heading" id="lua-tour">2. The Lua Database Engine</h2>
        <p>
          Redis evaluates token bucket balances inside an atomic transaction. A sample execution structure for the single token bucket is:
        </p>
        <RLSourceExcerpt
          source="internal/limiter/lua/token_bucket.lua"
          language="lua"
          establishes="Atomic read-refill-check-write in one Redis script execution."
        >{`local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
local tokens = tonumber(bucket[1]) or capacity
local last_refill = tonumber(bucket[2]) or now

local elapsed = (now - last_refill) / 1000.0
local new_tokens = math.min(capacity, tokens + (elapsed * refill_rate))

local allowed = 0
if new_tokens >= requested then
    new_tokens = new_tokens - requested
    allowed = 1
end
redis.call('HMSET', key, 'tokens', new_tokens, 'last_refill', now)
return {allowed, math.floor(new_tokens)}`}</RLSourceExcerpt>

        <h2 className="guide-sub-heading" id="resilience-tour">3. Failure Hardening</h2>
        <p>
          Resilience is built into both the sidecar and limiter layers with explicit timeout budgets:
        </p>
        <div style={{ overflowX: "auto", margin: "20px 0" }}>
          <table className="guide-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #27272a", textAlign: "left" }}>
                <th style={{ padding: "12px 8px" }}>Layer</th>
                <th style={{ padding: "12px 8px" }}>Timeout</th>
                <th style={{ padding: "12px 8px" }}>Default</th>
                <th style={{ padding: "12px 8px" }}>Evidence</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Redis dial / read / write</td>
                <td><code>REDIS_*_TIMEOUT_MS</code></td>
                <td>500 ms each</td>
                <td><RLEvidenceBadge type="SOURCE-PROVEN" /></td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Redis pool wait</td>
                <td><code>REDIS_POOL_TIMEOUT_MS</code></td>
                <td>1000 ms</td>
                <td><RLEvidenceBadge type="SOURCE-PROVEN" /></td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Sidecar → limiter HTTP</td>
                <td><code>SIDECAR_LIMITER_HTTP_TIMEOUT_MS</code></td>
                <td>1500 ms</td>
                <td><RLEvidenceBadge type="SOURCE-PROVEN" /></td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Fail-open policy</td>
                <td><code>FAIL_OPEN</code></td>
                <td><code>false</code> (fail-closed)</td>
                <td><RLEvidenceBadge type="SOURCE-PROVEN" /></td>
              </tr>
            </tbody>
          </table>
        </div>

        <RLSourceExcerpt
          source="internal/redis/timeouts.go — defaultClientTimeouts()"
          establishes="Redis client dial/read/write default 500 ms; pool timeout default 1000 ms; max retries 0."
        >{`defaultDialTimeout   = 500 * time.Millisecond
defaultReadTimeout   = 500 * time.Millisecond
defaultWriteTimeout  = 500 * time.Millisecond
defaultPoolTimeout   = 1 * time.Second`}</RLSourceExcerpt>

        <RLSourceExcerpt
          source="cmd/sidecar/limiter_http.go — defaultLimiterHTTPConfig()"
          establishes="Sidecar outbound limiter client timeout defaults to 1500 ms."
        >{`ClientTimeout: 1500 * time.Millisecond,
DialTimeout:   500 * time.Millisecond,`}</RLSourceExcerpt>

        <ul className="guide-bullets-list">
          <li><strong>Circuit Breakers:</strong> If Redis or the limiter fails repeatedly, the circuit opens and subsequent checks fail fast (~23 ms measured). Expected 429 denials are excluded from breaker statistics.</li>
          <li><strong>Fail-Closed Default:</strong> When <code>FAIL_OPEN=false</code> (default), limiter errors return 503. Set <code>FAIL_OPEN=true</code> explicitly to forward upstream during outages — never in production for payment paths.</li>
        </ul>

        <h2 className="guide-sub-heading" id="stats-tour">4. Key Measured Benchmark Results</h2>
        <p>
          Numbers below are from commit <code style={{ color: "#ff5cad" }}>a1de9ec</code> (k6 constant-arrival workloads, Docker Compose on i9-14900HX). Sustainable means actual throughput within 15% of target, p99 &lt; 100 ms, and 0% non-429 errors.
        </p>

        <RLStatGrid stats={[
          { value: "~872 RPS", label: "Max sustainable load (sidecar e2e @ 1000 target, p99 11 ms)", color: "#ff5cad", evidence: "BENCHMARK-PROVEN" },
          { value: "+3.7 ms", label: "Sidecar proxy overhead (p50 vs direct limiter @ ~871 RPS)", color: "#c084fc", evidence: "BENCHMARK-PROVEN" },
          { value: "7.11 ms", label: "Denial cache hammer p99 (in-memory 429, no Redis RTT)", color: "#22c55e", evidence: "BENCHMARK-PROVEN" }
        ]} />

        <RLCallout variant="info" title="Algorithm context">
          Benchmarks ran with <code>ALGORITHM=sliding</code> in docker-compose. Code default is <code>token</code> — both algorithms share the same atomic Lua pattern but differ in Redis key structure (<code>rate:{"{userID}"}</code> vs <code>sw:{"{userID}"}</code>).
        </RLCallout>

        <RLRelatedPages pages={[
          { slug: "start-here", section: "introduction", title: "Start Here", note: "Platform overview" },
          { slug: "guarantees-and-limitations", section: "introduction", title: "Guarantees & Limitations", note: "Formal promise matrix" },
          { slug: "anatomy-of-a-request", section: "architecture", title: "Anatomy of a Request", note: "Step-by-step lifecycle traces" },
          { slug: "throughput-and-saturation", section: "performance-lab", title: "Throughput & Saturation", note: "Full benchmark tables and saturation knee" },
          { slug: "denial-cache-and-singleflight", section: "resilience", title: "Denial Cache & Singleflight", note: "Process-local optimization details" }
        ]} />
      </div>
    )
  }
};

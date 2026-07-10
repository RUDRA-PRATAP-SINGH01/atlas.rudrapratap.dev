import React from "react";
import DocsMermaid from "@/features/docs/components/DocsMermaid";

export const architecturePages = {
  "system-at-a-glance": {
    title: "System at a Glance",
    topics: [
      { label: "Level 1: Logical Flow", href: "#level-1" },
      { label: "Level 2: Internal Architecture", href: "#level-2" },
      { label: "Level 3: Sentinel HA Deployment", href: "#level-3" },
      { label: "Service Boundaries & Roles", href: "#boundaries" }
    ],
    content: (
      <div>
        <p>
          This section maps the multi-replica, high-availability topology of the rate limiting platform, stepping through three levels of granularity.
        </p>

        <h2 className="guide-sub-heading" id="level-1">Level 1: Logical Flow</h2>
        <p>
          At a high level, rate limiting coordinates traffic before it reaches the backend. The sidecar proxy acts as the gatekeeper, while the central limiter evaluates quotas against the Redis master.
        </p>
        <DocsMermaid chart={`
flowchart LR
    Client([Client Request]) --> Sidecar[Sidecar Proxy]
    Sidecar -->|"/check"| Limiter[Central Limiter]
    Limiter -->|"Atomic Lua"| Redis[(Redis Master)]
    Sidecar -->|Forward| Upstream[Upstream Backend]
    style Client fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style Sidecar fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style Limiter fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style Redis fill:#18181b,stroke:#ec4899,color:#fff
    style Upstream fill:#18181b,stroke:#52525b,color:#a1a1aa
        `} />

        <h2 className="guide-sub-heading" id="level-2">Level 2: Internal Services & Infrastructure</h2>
        <p>
          Moving inward, the transparent sidecar intercepts traffic and coordinates local caching (denial cache), duplicate suppression (singleflight), idempotency leases, and routing logic before consulting the limiter.
        </p>
        <DocsMermaid chart={`
flowchart TD
    Client([Client]) -->|Port :9090| SC["Sidecar Proxy\\n- denial_cache (sync.Map)\\n- singleflight.Group\\n- idempotency_store\\n- gateway_router"]
    SC -->|"/check_hierarchical"| LM["Central Limiter Pool\\n- Token Bucket Engine\\n- Override Loader\\n- OTel & Prometheus metrics"]
    LM -->|"EVALSHA (atomic)"| Redis[("Redis Master\\n- rate:* (Hash)\\n- config:* (Hash)\\n- idem:* (Hash)")]
    SC -->|Proxy forwarding| Upstream["Upstream APIs\\n(demo-backend)"]
    style Client fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style SC fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style LM fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style Redis fill:#18181b,stroke:#ec4899,color:#fff
    style Upstream fill:#18181b,stroke:#52525b,color:#a1a1aa
        `} />

        <h2 className="guide-sub-heading" id="level-3">Level 3: HA Sentinel Topology</h2>
        <p>
          For production deployments, the single Redis instance is replaced with a Sentinel-coordinated replication group. Limiter replicas query the active Redis Master while Sentinel sentries monitor health and automate failovers.
        </p>
        <DocsMermaid chart={`
flowchart TB
    SC1[Sidecar Replica 1] --> LM1[Limiter Replica 1]
    SC2[Sidecar Replica 2] --> LM2[Limiter Replica 2]
    LM1 & LM2 -->|Read/Write| Master[(Redis Master)]
    Sentinel1[Sentinel Sentry 1] & Sentinel2[Sentinel Sentry 2] & Sentinel3[Sentinel Sentry 3] -.->|Monitor & Failover| Master
    Master -->|Asynchronous Replication| Replica[(Redis Replica)]
    style SC1 fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style SC2 fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style LM1 fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style LM2 fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style Master fill:#18181b,stroke:#ec4899,color:#fff
    style Replica fill:#18181b,stroke:#a78bfa,color:#fff
        `} />

        <h2 className="guide-sub-heading" id="boundaries">Service Boundaries & Roles</h2>
        <ul className="guide-bullets-list">
          <li><strong>Transparent Sidecar:</strong> Transparently handles edge routing, response replay (idempotency), process-local rate shielding, and fallback circuit-breaking.</li>
          <li><strong>Limiter Pool:</strong> Stateless, scales linearly. Responsible for parsing override configurations and preparing bulk arguments for Redis Lua runs.</li>
          <li><strong>Redis Master:</strong> The single, serializing bottleneck. Validates all quota deductions and persists lease states.</li>
        </ul>
      </div>
    )
  },

  "anatomy-of-a-request": {
    title: "Anatomy of a Request",
    topics: [
      { label: "Allowed Pathway", href: "#allowed" },
      { label: "Rate-Limited Pathway", href: "#limited" },
      { label: "Idempotent Replay", href: "#idempotency" },
      { label: "Resilience Breakpoints", href: "#resilience" }
    ],
    content: (
      <div>
        <p>
          To trace request lifecycles, let's analyze the exact sequence of events occurring during key request types.
        </p>

        <h2 className="guide-sub-heading" id="allowed">1. The Allowed Request</h2>
        <ol className="guide-bullets-list" style={{ listStyleType: "decimal" }}>
          <li>Client sends `GET /items` to sidecar (`:9090`).</li>
          <li>Sidecar scans memory: denial cache miss, idempotency cache miss.</li>
          <li>Sidecar triggers `GET /check_hierarchical` call to Limiter (`:8080`).</li>
          <li>Limiter pulls override version. It is fresh.</li>
          <li>Limiter issues `EVALSHA` run containing client keys (Global, Tenant, User).</li>
          <li>Redis Lua updates balances, returns {"{allowed: 1, remaining: 8}"}.</li>
          <li>Limiter responds `200 OK` with rate limit headers.</li>
          <li>Sidecar forwards the original request to the backend.</li>
        </ol>

        <h2 className="guide-sub-heading" id="limited">2. The Rate-Limited Request</h2>
        <p>
          When Redis Lua detects that a key has run out of tokens:
        </p>
        <ol className="guide-bullets-list" style={{ listStyleType: "decimal" }}>
          <li>Redis Lua returns {"{allowed: 0, remaining: 0}"}.</li>
          <li>Limiter returns `429 Too Many Requests` back to the sidecar.</li>
          <li>Sidecar stores a local 1-second denial cache key.</li>
          <li>Sidecar rejects the client request immediately with `429 Too Many Requests`, appending `Retry-After` headers.</li>
          <li>Subsequent client requests within 1s fail directly at the sidecar, completely bypassing the Limiter and Redis.</li>
        </ol>

        <h2 className="guide-sub-heading" id="idempotency">3. The Idempotent Request</h2>
        <p>
          If a client issues a POST containing an `Idempotency-Key`:
        </p>
        <ol className="guide-bullets-list" style={{ listStyleType: "decimal" }}>
          <li>Sidecar calls Redis to claim the key.</li>
          <li>If key exists and status is `completed`, sidecar immediately replays the cached status, headers, and body. No backend call is triggered.</li>
          <li>If status is `processing`, sidecar blocks and returns `409 Conflict` or a retry-after signal.</li>
          <li>If new, sidecar acquires a fence lease, forwards request to backend, writes response to Redis via Lua, and returns to client.</li>
        </ol>

        <h2 className="guide-sub-heading" id="resilience">4. Resilience Breakpoints</h2>
        <p>
          If Redis crashes during a transaction:
        </p>
        <ul className="guide-bullets-list">
          <li>The Limiter's Redis client reaches its timeout limit (1,000 ms) and returns a connection error.</li>
          <li>The Limiter propagates a `500 Internal Server Error` to the sidecar.</li>
          <li>The sidecar's gateway router records a failure, incrementing the circuit breaker failure counter.</li>
          <li>The sidecar returns `503 Service Unavailable` (fail-closed). After consecutive failures, the breaker opens, fast-failing subsequent traffic in ~23 ms.</li>
        </ul>
      </div>
    )
  },

  "why-this-architecture": {
    title: "Why This Architecture?",
    topics: [
      { label: "Why Sidecar Boundary?", href: "#sidecar-why" },
      { label: "Why Central Limiter?", href: "#limiter-why" },
      { label: "Why Redis + Lua?", href: "#redis-why" },
      { label: "Why Circuit Breaker?", href: "#cb-why" }
    ],
    content: (
      <div>
        <p>
          Every architectural boundary is chosen to satisfy specific operational and performance constraints.
        </p>

        <h2 className="guide-sub-heading" id="sidecar-why">Why Sidecar Boundary?</h2>
        <p>
          Integrating rate limiting directly into application code couples business logic with network coordination libraries. A separate sidecar proxy decouples applications, allowing language-agnostic enforcement, standardized trace propagation, and independent deployment scaling.
        </p>

        <h2 className="guide-sub-heading" id="limiter-why">Why Central Limiter?</h2>
        <p>
          Running rate calculations directly in the sidecar would require every sidecar instance to connect to Redis. In a cluster of 1,000 sidecars, this creates a massive connection pool exhaustion risk on the Redis server. The central limiter acts as a stateless connection concentrator and protocol shield, translating HTTP check queries into Redis commands.
        </p>

        <h2 className="guide-sub-heading" id="redis-why">Why Redis + Lua?</h2>
        <p>
          Redis provides highly optimized, single-threaded execution per key. Executing token bucket calculations inside a Lua script shifts checking and writing into the database itself. Since Redis runs Lua scripts inline and atomically, it guarantees that no other command can execute between token checking and updating, completely eliminating concurrency race conditions.
        </p>

        <h2 className="guide-sub-heading" id="cb-why">Why Distributed Circuit Breakers?</h2>
        <p>
          If the rate limiter itself experiences an outage, it must not cascade. The distributed circuit breaker monitors downstream health in Redis. If the limiter fails consecutively, it opens the circuit, allowing sidecars to either fail-closed or fail-open quickly, preserving client latencies.
        </p>
      </div>
    )
  },

  "distributed-state-model": {
    title: "Distributed State Model",
    topics: [
      { label: "State Ownership Matrix", href: "#matrix" },
      { label: "Synchronization Models", href: "#sync" },
      { label: "Restart Behavior", href: "#restart" }
    ],
    content: (
      <div>
        <p>
          Managing rate limits requires coordinating distinct categories of state across physical boundaries.
        </p>

        <h2 className="guide-sub-heading" id="matrix">Authoritative State Ownership Matrix</h2>
        <div style={{ overflowX: "auto", margin: "20px 0" }}>
          <table className="guide-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #27272a", textAlign: "left" }}>
                <th style={{ padding: "12px 8px" }}>State Category</th>
                <th style={{ padding: "12px 8px" }}>Primary Owner</th>
                <th style={{ padding: "12px 8px" }}>Location</th>
                <th style={{ padding: "12px 8px" }}>Consistency model</th>
                <th style={{ padding: "12px 8px" }}>Restart Durability</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Rate Quotas</td>
                <td>Redis Master</td>
                <td>Redis Hash (`rate:*`)</td>
                <td>Strong consistency</td>
                <td>Durable (AOF/RDB)</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Overrides</td>
                <td>Redis Master</td>
                <td>Redis Hash (`config:*`)</td>
                <td>Optimistic generation validation</td>
                <td>Durable (AOF/RDB)</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Circuit State</td>
                <td>Shared Redis</td>
                <td>Redis Hash (`cb:*`)</td>
                <td>Eventual consistency</td>
                <td>Durable (AOF/RDB)</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Idempotency Locks</td>
                <td>Shared Redis</td>
                <td>Redis Hash (`idem:*`)</td>
                <td>Strict owner lock (fencing)</td>
                <td>Durable (AOF/RDB)</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Denial Cache</td>
                <td>Sidecar Proxy</td>
                <td>Memory (`sync.Map`)</td>
                <td>Local-only (no sync)</td>
                <td>Ephemeral (wiped)</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2 className="guide-sub-heading" id="sync">Synchronization Model</h2>
        <p>
          State synchronization leverages two patterns:
        </p>
        <ul className="guide-bullets-list">
          <li><strong>Database Atomic Serialization:</strong> Standard quota checks coordinate state inline by executing Lua scripts sequentially on the single Redis thread.</li>
          <li><strong>Optimistic Generation Checking:</strong> Config overrides are cached locally to avoid Redis polling. The sidecar queries a version counter (`config:generation`) on every call. If it changes, the cache invalidates instantly.</li>
        </ul>
      </div>
    )
  },

  "system-invariants": {
    title: "System Invariants",
    topics: [
      { label: "Defined Invariants", href: "#invariants" },
      { label: "Correctness Proofs", href: "#proofs" }
    ],
    content: (
      <div>
        <p>
          Invariants are correctness properties that must remain true under all operating conditions, including concurrency, network partitions, and node failures.
        </p>

        <h2 className="guide-sub-heading" id="invariants">Core System Invariants</h2>
        <ul className="guide-bullets-list">
          <li><strong>Invariant 1: Quota Upper Bound</strong> — The number of allowed requests for a given key cannot exceed the algorithm limit under a connected Redis state. Over-admission is mathematically impossible due to Lua's atomic thread serialization.</li>
          <li><strong>Invariant 2: Multi-Key Atomicity</strong> — On a hierarchical check, if a request lacks global tokens but has user tokens, no tokens are deducted from *any* level. Commit is all-or-nothing.</li>
          <li><strong>Invariant 3: Idempotency Lease Integrity</strong> — A late-writing sidecar replica whose lease has expired cannot overwrite the results of a newer lease-holder. The fencing token check guarantees stale writes are aborted.</li>
          <li><strong>Invariant 4: Safe Denial Cache Offloading</strong> — The sidecar process-local denial cache only records rate-limited states. It can cause a request to be rejected even if quota refilled early, but it can *never* cause a request to be allowed if quota is exhausted.</li>
        </ul>

        <h2 className="guide-sub-heading" id="proofs">Verification Mechanisms</h2>
        <p>
          These invariants are validated at build time by Go race-detector test suites (`go test -race ./...`) and runtime chaos injection scenarios targeting Redis Sentinel master re-elections.
        </p>
      </div>
    )
  },

  "engineering-trade-offs": {
    title: "Engineering Trade-offs",
    topics: [
      { label: "Consistency vs. Availability", href: "#cap" },
      { label: "Lua vs. Redis Cluster", href: "#cluster" },
      { label: "Suppressing duplicates vs. Exactly Once", href: "#suppression" }
    ],
    content: (
      <div>
        <p>
          Every system design decision requires choosing which constraints to prioritize and which costs to accept.
        </p>

        <h2 className="guide-sub-heading" id="cap">Consistency vs. Availability (Fail-Closed default)</h2>
        <p>
          In rate limiting, if the database fails, you have two choices:
        </p>
        <ul className="guide-bullets-list">
          <li><strong>Fail-Open:</strong> Allow traffic to pass when the rate limiter is down. This protects customer experience during limiter failures, but hazards overloading downstream backends, risking a complete cascade.</li>
          <li><strong>Fail-Closed (Selected):</strong> Block requests when rate state is unreachable. This shields downstreams from overload, but turns limiter availability into a hard blocker for client traffic.</li>
        </ul>

        <h2 className="guide-sub-heading" id="cluster">Lua Scripting vs. Redis Cluster Incompatibility</h2>
        <p>
          Using multi-key Lua scripts enforces atomic multi-tier quotas. However, it binds all checked keys to the same Redis process. Since Redis Cluster shards keys across slots, a Lua script referencing keys in different slots fails. We accepted this trade-off: preserving atomic hierarchical correctness limits throughput scaling to a single master Redis process (~870 sustainable RPS).
        </p>

        <h2 className="guide-sub-heading" id="suppression">Duplicate Suppression vs. Exactly-Once Upstreams</h2>
        <p>
          The idempotency layer guarantees concurrent request suppression and caching. It does *not* guarantee exactly-once upstream side effects. If a proxy crashes after forwarding to the backend but before writing back the result, a retry will execute the backend call a second time. True exactly-once side-effects must be handled inside the upstream application database.
        </p>
      </div>
    )
  }
};

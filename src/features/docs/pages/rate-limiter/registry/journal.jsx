import React from "react";
import DocsMermaid from "@/features/docs/components/DocsMermaid";

export const journalPages = {
  "major-design-decisions": {
    title: "Major Design Decisions",
    topics: [
      { label: "1. Edge Sidecar Proxies vs. Library Integrations", href: "#sidecar-choice" },
      { label: "2. Atomic Lua Scripts vs. Distributed Locking", href: "#lua-choice" },
      { label: "3. Monotonic Generations vs. Pub/Sub", href: "#generation-choice" }
    ],
    content: (
      <div>
        <p>
          Building a high-throughput, low-latency rate limiter requires making significant architectural trade-offs. This journal outlines the core engineering choices made during development.
        </p>

        <h2 className="guide-sub-heading" id="sidecar-choice">1. Edge Sidecar Proxies vs. Library Integrations</h2>
        <p>
          We chose an edge sidecar proxy pattern (`cmd/sidecar`) over native language coordination libraries. 
        </p>
        <ul className="guide-bullets-list">
          <li><strong>The Trade-off:</strong> Intercepting request routing introduces a network hop, adding **+3.7 ms p50** latency overhead.</li>
          <li><strong>The Rationale:</strong> Library integrations tightly couple rate limiting logic and Redis connection management with the application's runtime. If an application instance is busy with garbage collection or high CPU usage, connection drops propagate. The sidecar isolates this logic completely, allowing independent scaling, clean upgrades, and language-agnostic integration.</li>
        </ul>

        <h2 className="guide-sub-heading" id="lua-choice">2. Atomic Lua Scripts vs. Distributed Locking</h2>
        <p>
          We evaluated coordinating token bucket updates using Redis transactions (`MULTI`/`EXEC`) or distributed locks (Redlock).
        </p>
        <ul className="guide-bullets-list">
          <li><strong>The Trade-off:</strong> Lua scripts block all commands in the Redis engine during execution, serialized to a single thread.</li>
          <li><strong>The Rationale:</strong> Distributed locks require multiple network round-trips to acquire, verify, and release locks, increasing check latency from **~1.1 ms** to over **15 ms** under load. Running checks inside Lua scripts allows evaluating limits, updating tokens, and writing keys in a single atomic database operation, ensuring high throughput.</li>
        </ul>

        <h2 className="guide-sub-heading" id="generation-choice">3. Monotonic Generations vs. Pub/Sub</h2>
        <p>
          For runtime configuration overrides, we rejected Redis Pub/Sub channels in favor of a monotonic version generation counter (`config:generation`).
        </p>
        <ul className="guide-bullets-list">
          <li><strong>The Trade-off:</strong> Replicas query `config:generation` before running checks, adding a fast lookup call (though typically collapsed via local caches).</li>
          <li><strong>The Rationale:</strong> Pub/Sub is a fire-and-forget channel. If a rate-limiter replica is temporarily offline or disconnected during a VPC network partition, it will miss the invalidation message, resulting in permanent configuration drift. Monotonic version checks guarantee consistency: a recovering replica compares generations, detects a mismatch, and immediately invalidates its local cache.</li>
        </ul>
      </div>
    )
  },

  "bugs-found-through-audits": {
    title: "Bugs Found Through Audits",
    topics: [
      { label: "1. Overlap Race Condition under Concurrency", href: "#race-bug" },
      { label: "2. Idempotency Key Re-play Collisions", href: "#idem-bug" },
      { label: "3. Lua Precision Floating-Point Drift", href: "#float-bug" }
    ],
    content: (
      <div>
        <p>
          Detailed code reviews and chaos testing revealed critical concurrency bugs in initial implementations. This section documents those issues, their root causes, and their fixes.
        </p>

        <h2 className="guide-sub-heading" id="race-bug">1. Overlap Race Condition under Concurrency</h2>
        <p>
          <strong>Symptom:</strong> During active Redis outage recovery, concurrent client requests bypassed the circuit breaker, overloading recovering downstream backends.
        </p>
        <p>
          <strong>Root Cause:</strong> The client circuit breaker used a check-then-set logic pattern across two Go functions (`Allow()` and `Record()`). When the circuit transitioned to half-open, multiple concurrent threads read the state as half-open and initiated backend probes simultaneously, bypassing the max probe limit.
        </p>
        <p>
          <strong>Fix:</strong> Shifted health checks and probe counters into an atomic Lua script (`allow.lua`). The script atomically increments the probe counter and denies requests once the cap is reached, locking execution at the database layer.
        </p>

        <h2 className="guide-sub-heading" id="idem-bug">2. Idempotency Key Re-play Collisions</h2>
        <p>
          <strong>Symptom:</strong> Replaying a request key containing a modified payload bypassed body validations, returning the cached response of the original transaction.
        </p>
        <p>
          <strong>Root Cause:</strong> The idempotency middleware checked key existence but did not validate body signatures, exposing the system to payload collisions.
        </p>
        <p>
          <strong>Fix:</strong> Modified the idempotency claim script to calculate and store body signatures. If a retried request payload does not match the stored signature, the system rejects it, preventing collision issues.
        </p>
        <pre style={{ background: "#0e0e11", border: "1px solid #27272a", padding: 14, borderRadius: 6, fontSize: 12, overflowX: "auto" }}>
{`-- Inside claim.lua
local stored_hash = redis.call('HGET', KEYS[1], 'body_hash')
if stored_hash and stored_hash != ARGV[2] then
    return { "ERROR_PAYLOAD_MISMATCH", "" }
end`}
        </pre>

        <h2 className="guide-sub-heading" id="float-bug">3. Lua Precision Floating-Point Drift</h2>
        <p>
          <strong>Symptom:</strong> Token balances occasionally drifted into negative values, resulting in spurious `429 Too Many Requests` errors under low traffic volume.
        </p>
        <p>
          <strong>Root Cause:</strong> Lua handles numbers as double-precision floats. Lazy mathematical refills computed elapsed times as fractional seconds, leading to minor precision loss. Under high concurrency, these fractional errors accumulated, causing token balances to drift below zero.
        </p>
        <p>
          <strong>Fix:</strong> Refactored calculations to use millisecond timestamps and clamped token values strictly between `0` and `capacity`, ensuring numerical consistency.
        </p>
      </div>
    )
  },

  "performance-evolution": {
    title: "Performance Evolution",
    topics: [
      { label: "1. Early Prototype Baseline", href: "#proto-baseline" },
      { label: "2. Shifting to Atomic Lua Scripts", href: "#lua-refactor" },
      { label: "3. Implementing Local In-Memory Cache layers", href: "#cache-refactor" }
    ],
    content: (
      <div>
        <p>
          This section details how optimization steps improved performance metrics and latency bounds from early prototypes to the current release.
        </p>

        <h2 className="guide-sub-heading" id="proto-baseline">1. Early Prototype Baseline</h2>
        <p>
          Our initial prototype queried keys, computed refills in Go, and wrote values back using standard Redis pipelines. 
        </p>
        <ul className="guide-bullets-list">
          <li><strong>Throughput:</strong> Capped at **200 target RPS**.</li>
          <li><strong>Latency:</strong> p99 latency exceeded **250 ms** under active concurrency.</li>
          <li><strong>Over-Admission Rate:</strong> Up to **18%** of requests bypassed limits due to read-modify-write race conditions.</li>
        </ul>

        <h2 className="guide-sub-heading" id="lua-refactor">2. Shifting to Atomic Lua Scripts</h2>
        <p>
          Moving the check-and-refill logic into Lua scripts executed directly inside Redis eliminated concurrency races.
        </p>
        <ul className="guide-bullets-list">
          <li><strong>Throughput:</strong> Scaled to **872 target RPS** (sliding window) and **4,161 target RPS** (token bucket).</li>
          <li><strong>Latency:</strong> p99 latency dropped to **8 ms** (sliding window) and **11 ms** (token bucket).</li>
          <li><strong>Over-Admission Rate:</strong> Reduced to strictly **0%**, ensuring exact limit compliance.</li>
        </ul>

        <h2 className="guide-sub-heading" id="cache-refactor">3. Implementing Local In-Memory Cache Layers</h2>
        <p>
          Adding process-local denial caches and singleflight request collapsing to the sidecar proxy protected Redis during traffic bursts.
        </p>
        <ul className="guide-bullets-list">
          <li><strong>Throughput:</strong> Handled bursts up to **17,662 RPS** targeting denied keys.</li>
          <li><strong>Latency:</strong> p99 latency for denied calls remained under **7.1 ms**.</li>
          <li><strong>Database Load:</strong> Network calls to Redis dropped by **99.9%** during active rate limiting, protecting database performance.</li>
        </ul>
      </div>
    )
  },

  "what-i-would-change-at-10x-scale": {
    title: "What I Would Change at 10× Scale",
    topics: [
      { label: "1. Decentralized Quotas & Local Token Slices", href: "#local-slices" },
      { label: "2. Consistent Hashing Cluster Rings", href: "#cluster-sharding" },
      { label: "3. Hybrid Memory Models & RocksDB", href: "#hybrid-storage" }
    ],
    content: (
      <div>
        <p>
          Scaling this rate limiter to handle 100,000+ RPS requires addressing the synchronization bottlenecks of centralized Redis architectures.
        </p>

        <h2 className="guide-sub-heading" id="local-slices">1. Decentralized Quotas & Local Token Slices</h2>
        <p>
          Rather than querying Redis on every request, sidecar proxies should acquire quota slices (e.g. 100 tokens at a time) from the central database.
        </p>
        <p>
          The proxy evaluates limits locally against its cached slice, syncing consumption asynchronously in the background. This shifts the majority of checks to memory-speed lookups, reducing database network traffic.
        </p>

        <h2 className="guide-sub-heading" id="cluster-sharding">2. Consistent Hashing Cluster Rings</h2>
        <p>
          To scale past a single master database instance, we must shard key spaces across a Redis Cluster.
        </p>
        <p>
          Using consistent hashing rings at the sidecar routing layer allows mapping keys directly to the correct shard. This eliminates multi-key slot hashes and avoids slot hotspots, distributing load evenly across cluster nodes.
        </p>
        <DocsMermaid chart={`
graph TD
    Client[Proxy Client] -->|Hash Key: user_993| Ring[Consistent Hash Ring]
    Ring -->|Slot 4821| Shard1[Redis Shard Master 1]
    Ring -->|Slot 11200| Shard2[Redis Shard Master 2]
    Ring -->|Slot 15900| Shard3[Redis Shard Master 3]
        `} />

        <h2 className="guide-sub-heading" id="hybrid-storage">3. Hybrid Memory Models</h2>
        <p>
          For high-volume transaction audits, Redis's in-memory storage becomes cost-prohibitive. We would replace the audit logger with a LSM-tree engine (like RocksDB) deployed on SSD storage, streaming logs asynchronously to maintain high-throughput rate checks.
        </p>
      </div>
    )
  }
};

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

const COMMIT = "a1de9ec";

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
        <RLThesis>
          High-throughput rate limiting demands explicit trade-offs between isolation, consistency, and latency. Three
          decisions anchor the current architecture: an edge sidecar proxy for language-agnostic integration, atomic Lua
          scripts for single round-trip quota math, and a monotonic <code>config:generation</code> counter for
          self-healing override invalidation.
        </RLThesis>

        <RLQuickModel>
          Sidecar = isolated hot path (+3.7 ms p50 at sustainable load). Lua = one EVALSHA, no lock acquire/release
          dance. Generation counter = pull-based cache invalidation that survives offline replicas; Pub/Sub does not.
        </RLQuickModel>

        <RLStatGrid stats={[
          { value: "+3.73 ms", label: "Sidecar p50 overhead vs direct /check @ ~871 RPS", color: "#ff5cad", evidence: "BENCHMARK-PROVEN" },
          { value: "1 RTT", label: "Lua quota check (vs 2–3 RTTs for Redlock)", color: "#22c55e", evidence: "SOURCE-PROVEN" },
          { value: "config:generation", label: "Monotonic override invalidation key", color: "#c084fc", evidence: "SOURCE-PROVEN" }
        ]} />

        <h2 className="guide-sub-heading" id="sidecar-choice">1. Edge Sidecar Proxies vs. Library Integrations</h2>
        <p>
          We chose an edge sidecar proxy pattern (<code>cmd/sidecar</code>) over native language coordination libraries.
        </p>
        <ul className="guide-bullets-list">
          <li>
            <strong>The Trade-off:</strong> Intercepting request routing introduces a network hop, adding approximately{" "}
            <strong>+3.7 ms p50</strong> latency overhead at sustainable throughput.{" "}
            <RLEvidenceBadge type="BENCHMARK-PROVEN" />
          </li>
          <li>
            <strong>The Rationale:</strong> Library integrations tightly couple rate limiting logic and Redis connection
            management with the application runtime. If an application instance is busy with garbage collection or high
            CPU usage, connection drops propagate. The sidecar isolates this logic completely, allowing independent
            scaling, clean upgrades, and language-agnostic integration.
          </li>
        </ul>

        <RLSourceExcerpt
          source="benchmarks — latency comparison @ 1000 target RPS (commit a1de9ec)"
          establishes="Direct limiter p50 1.13 ms vs sidecar e2e p50 4.86 ms — delta +3.73 ms from proxy routing."
        >{`Direct Limiter /check : p50 1.13 ms, p95 3.14 ms
Sidecar Proxy e2e   : p50 4.86 ms, p95 8.21 ms
Delta (approx.)     : p50 +3.73 ms`}</RLSourceExcerpt>

        <h2 className="guide-sub-heading" id="lua-choice">2. Atomic Lua Scripts vs. Distributed Locking</h2>
        <p>
          We evaluated coordinating token bucket updates using Redis transactions (<code>MULTI</code>/<code>EXEC</code>)
          or distributed locks (Redlock).
        </p>
        <ul className="guide-bullets-list">
          <li>
            <strong>The Trade-off:</strong> Lua scripts block all commands in the Redis engine during execution,
            serialized to a single thread.
          </li>
          <li>
            <strong>The Rationale:</strong> Distributed locks require multiple network round-trips to acquire, verify,
            and release locks, increasing check latency from ~1.1 ms to over 15 ms under load. Running checks inside Lua
            scripts evaluates limits, updates tokens, and writes keys in a <strong>single atomic round-trip</strong>,
            ensuring high throughput. <RLEvidenceBadge type="SOURCE-PROVEN" />
          </li>
        </ul>

        <RLSourceExcerpt
          source="internal/limiter/lua/token_bucket.lua — atomic read-refill-check-write"
          language="lua"
          establishes="Entire quota decision executes in one EVALSHA — no separate lock acquire or WATCH retry loop."
        >{`local data        = redis.call('HMGET', key, 'tokens', 'last_refill')
local tokens      = tonumber(data[1]) or capacity
local last_refill = tonumber(data[2]) or now

local elapsed    = math.max(0, now - last_refill)
local new_tokens = math.min(capacity, tokens + elapsed * refill_rate)

if new_tokens < 1 then
    redis.call('HMSET', key, 'tokens', new_tokens, 'last_refill', now)
    return {0, 0}
end

new_tokens = new_tokens - 1
redis.call('HMSET', key, 'tokens', new_tokens, 'last_refill', now)
return {1, math.floor(new_tokens)}`}</RLSourceExcerpt>

        <RLCallout variant="info" title="Why not Redlock?">
          Redlock adds 2–3 round-trips for acquire/release and introduces clock-skew edge cases. With a single Redis
          master serializing all quota state, Lua inside Redis achieves the same mutual exclusion without network
          amplification.
        </RLCallout>

        <h2 className="guide-sub-heading" id="generation-choice">3. Monotonic Generations vs. Pub/Sub</h2>
        <p>
          For runtime configuration overrides, we rejected Redis Pub/Sub channels in favor of a monotonic version
          generation counter (<code>config:generation</code>).
        </p>
        <ul className="guide-bullets-list">
          <li>
            <strong>The Trade-off:</strong> Replicas query <code>config:generation</code> before running checks, adding
            a fast lookup call (typically collapsed via local caches between invalidations).
          </li>
          <li>
            <strong>The Rationale:</strong> Pub/Sub is a fire-and-forget channel. If a rate-limiter replica is
            temporarily offline or disconnected during a VPC network partition, it will <strong>miss the invalidation
            message</strong>, resulting in permanent configuration drift. Monotonic version checks guarantee consistency:
            a recovering replica compares generations, detects a mismatch, and immediately invalidates its local cache.{" "}
            <RLEvidenceBadge type="SOURCE-PROVEN" />
          </li>
        </ul>

        <RLSourceExcerpt
          source="internal/override/store.go — RefreshGeneration"
          language="go"
          establishes="Pull-based invalidation: offline replica self-heals on next GET after reconnect."
        >{`func (s *Store) RefreshGeneration(ctx context.Context) error {
    remote, err := s.rdb.Get(ctx, "config:generation").Int64()
    if err != nil {
        return err  // caller falls back to cached overrides
    }
    if remote != s.localGeneration {
        s.cache.Clear()
        s.localGeneration = remote
    }
    return nil
}`}</RLSourceExcerpt>

        <RLRelatedPages pages={[
          { section: "architecture", slug: "why-this-architecture", title: "Why This Architecture", note: "sidecar isolation rationale" },
          { section: "rate-limiting-engine", slug: "redis-lua-atomicity", title: "Redis Lua Atomicity", note: "Lua vs Redlock comparison" },
          { section: "rate-limiting-engine", slug: "configuration-overrides", title: "Configuration Overrides", note: "generation invalidation mechanics" },
          { section: "performance-lab", slug: "latency-analysis", title: "Latency Analysis", note: "+3.7 ms p50 sidecar overhead proof" }
        ]} />
      </div>
    )
  },

  "bugs-found-through-audits": {
    title: "Bugs Found Through Audits",
    topics: [
      { label: "1. Half-Open Probe Race Condition", href: "#race-bug" },
      { label: "2. Idempotency Body Fingerprint Mismatch", href: "#idem-bug" },
      { label: "3. Lua Precision Floating-Point Drift", href: "#float-bug" }
    ],
    content: (
      <div>
        <RLThesis>
          Detailed code reviews and chaos testing revealed three concurrency bugs in early implementations. Each was
          fixed by moving the contested state transition into an atomic Lua script — probe counting, fingerprint
          validation, and token clamping now execute inside Redis, not across split Go functions.
        </RLThesis>

        <RLQuickModel>
          Half-open stampede = check-then-set race in Go → fixed by <code>allow.lua</code> HINCRBY probe counter. Key
          reuse with different body = missing fingerprint check → fixed in <code>claim.lua</code>. Token drift below
          zero = float accumulation → fixed with <code>math.max(0, …)</code> elapsed guard and <code>math.min(capacity, …)</code> clamp.
        </RLQuickModel>

        <h2 className="guide-sub-heading" id="race-bug">1. Half-Open Probe Race Condition</h2>
        <p>
          <strong>Symptom:</strong> During active Redis outage recovery, concurrent client requests bypassed the circuit
          breaker, overloading recovering downstream backends.
        </p>
        <p>
          <strong>Root Cause:</strong> The client circuit breaker used a check-then-set logic pattern across two Go
          functions (<code>Allow()</code> and <code>Record()</code>). When the circuit transitioned to half-open, multiple
          concurrent threads read the state as half-open and initiated backend probes simultaneously, bypassing the max
          probe limit.
        </p>
        <p>
          <strong>Fix:</strong> Shifted health checks and probe counters into an atomic Lua script (<code>allow.lua</code>).
          The script atomically increments the probe counter via <code>HINCRBY</code> and denies requests once{" "}
          <code>CB_HALF_OPEN_MAX_PROBES</code> is reached, locking execution at the database layer.{" "}
          <RLEvidenceBadge type="SOURCE-PROVEN" /> <RLEvidenceBadge type="TEST-PROVEN" />
        </p>

        <RLSourceExcerpt
          source="internal/circuitbreaker/lua/allow.lua — half-open probe bound"
          language="lua"
          establishes="Probe counter incremented atomically inside Redis; requests beyond max_probes receive denied=0."
        >{`-- state == 'half_open'
if probe_count < max_probes then
    redis.call('HINCRBY', key, 'probe_count', 1)
    return {1, 'half_open', probe_count + 1, tonumber(fields[4]) or 0}
end
return {0, 'half_open', probe_count, tonumber(fields[4]) or 0}  -- probes full`}</RLSourceExcerpt>

        <h2 className="guide-sub-heading" id="idem-bug">2. Idempotency Body Fingerprint Mismatch</h2>
        <p>
          <strong>Symptom:</strong> Replaying a request key containing a modified payload bypassed body validations,
          returning the cached response of the original transaction.
        </p>
        <p>
          <strong>Root Cause:</strong> The idempotency middleware checked key existence but did not validate body
          fingerprints, exposing the system to payload collisions (same <code>Idempotency-Key</code>, different body).
        </p>
        <p>
          <strong>Fix:</strong> Modified <code>claim.lua</code> to store a SHA-256 fingerprint of the request body on
          first claim. If a retried request payload does not match the stored fingerprint, the script returns{" "}
          <code>FINGERPRINT_MISMATCH</code>, rejecting the collision. <RLEvidenceBadge type="SOURCE-PROVEN" />
        </p>

        <RLSourceExcerpt
          source="internal/sidecar/idempotency/lua/claim.lua — fingerprint validation"
          language="lua"
          establishes="Same key with different body hash is rejected before any upstream forward or replay."
        >{`local stored_fp = data[3]

-- Fingerprint mismatch: same key, different payload → reject
if stored_fp ~= fp then
    return {'FINGERPRINT_MISMATCH', '', '', ''}
end`}</RLSourceExcerpt>

        <h2 className="guide-sub-heading" id="float-bug">3. Lua Precision Floating-Point Drift</h2>
        <p>
          <strong>Symptom:</strong> Token balances occasionally drifted into negative values, resulting in spurious{" "}
          <code>429 Too Many Requests</code> errors under low traffic volume.
        </p>
        <p>
          <strong>Root Cause:</strong> Lua handles numbers as double-precision floats. Lazy mathematical refills computed
          elapsed times as fractional seconds, leading to minor precision loss. Under high concurrency, these fractional
          errors accumulated, causing token balances to drift below zero.
        </p>
        <p>
          <strong>Fix:</strong> Refactored calculations to use millisecond-resolution timestamps where sub-second
          precision matters, and clamped token values strictly: elapsed time guarded with{" "}
          <code>math.max(0, now - last_refill)</code> and token level bounded with{" "}
          <code>math.min(capacity, …)</code>, ensuring numerical consistency. <RLEvidenceBadge type="SOURCE-PROVEN" />
        </p>

        <RLSourceExcerpt
          source="internal/limiter/lua/token_bucket.lua — drift guards"
          language="lua"
          establishes="Negative elapsed (clock skew) clamped to zero; token level never exceeds capacity."
        >{`local elapsed    = math.max(0, now - last_refill)
local new_tokens = math.min(capacity, tokens + elapsed * refill_rate)

if new_tokens < 1 then
    redis.call('HMSET', key, 'tokens', new_tokens, 'last_refill', now)
    return {0, 0}
end`}</RLSourceExcerpt>

        <RLCallout variant="warning" title="Residual float limitation">
          Lua still uses double-precision floats internally. The clamp guards prevent visible drift below zero or above
          capacity, but operators requiring sub-second refill granularity should ensure scripts receive millisecond
          timestamps (<code>UnixMilli()</code>) rather than whole-second values.
        </RLCallout>

        <RLRelatedPages pages={[
          { section: "resilience", slug: "circuit-breaker", title: "Circuit Breaker", note: "allow.lua probe mechanics" },
          { section: "resilience", slug: "idempotency", title: "Idempotency", note: "full claim.lua lifecycle" },
          { section: "correctness-and-verification", slug: "what-has-been-proven", title: "What Has Been Proven?", note: "CB half-open bounds TEST-PROVEN" },
          { section: "correctness-and-verification", slug: "concurrency-and-race-safety", title: "Concurrency & Race Safety", note: "race condition test suites" }
        ]} />
      </div>
    )
  },

  "performance-evolution": {
    title: "Performance Evolution",
    topics: [
      { label: "1. Early Prototype Baseline", href: "#proto-baseline" },
      { label: "2. Shifting to Atomic Lua Scripts", href: "#lua-refactor" },
      { label: "3. Implementing Local In-Memory Cache Layers", href: "#cache-refactor" }
    ],
    content: (
      <div>
        <RLThesis>
          Three optimization phases transformed the rate limiter from a race-prone Go pipeline to a benchmark-verified
          production system: Go read-modify-write (historical ~200 RPS), atomic Lua scripts (872 RPS sustainable sliding,
          4,161 RPS token peak), and denial-cache offloading (17,662 RPS hammer on denied keys).
        </RLThesis>

        <RLQuickModel>
          Phase 1 = pipeline races, ~18% over-admission. Phase 2 = Lua eliminates races, 0% over-admission. Phase 3 =
          denial cache + singleflight shields Redis during abuse bursts without weakening quota correctness.
        </RLQuickModel>

        <RLStatGrid stats={[
          { value: "~200 RPS", label: "Early prototype ceiling (journal narrative)", color: "#71717a" },
          { value: "872 RPS", label: "Sustainable sliding window (sidecar e2e @ 1K target)", color: "#22c55e", evidence: "BENCHMARK-PROVEN" },
          { value: "4,161 RPS", label: "Token bucket peak (direct @ 5K target)", color: "#fbbf24", evidence: "BENCHMARK-PROVEN" },
          { value: "17,662 RPS", label: "Denial cache hammer throughput", color: "#ff5cad", evidence: "BENCHMARK-PROVEN" }
        ]} />

        <h2 className="guide-sub-heading" id="proto-baseline">1. Early Prototype Baseline</h2>
        <RLCallout variant="warning" title="Historical narrative — not benchmark-archived">
          The ~200 RPS prototype ceiling and 18% over-admission rate are documented in this engineering journal only.
          No k6 summary JSON exists for the pre-Lua prototype. Treat these numbers as directional history, not
          reproducible benchmark evidence.
        </RLCallout>
        <p>
          Our initial prototype queried keys, computed refills in Go, and wrote values back using standard Redis pipelines.
        </p>
        <ul className="guide-bullets-list">
          <li><strong>Throughput:</strong> Capped at approximately <strong>200 target RPS</strong>.</li>
          <li><strong>Latency:</strong> p99 latency exceeded <strong>250 ms</strong> under active concurrency.</li>
          <li><strong>Over-Admission Rate:</strong> Up to <strong>18%</strong> of requests bypassed limits due to read-modify-write race conditions.</li>
        </ul>

        <h2 className="guide-sub-heading" id="lua-refactor">2. Shifting to Atomic Lua Scripts</h2>
        <p>
          Moving the check-and-refill logic into Lua scripts executed directly inside Redis eliminated concurrency races.
          Verified at commit <code style={{ color: "#ff5cad" }}>{COMMIT}</code>.{" "}
          <RLEvidenceBadge type="BENCHMARK-PROVEN" />
        </p>
        <ul className="guide-bullets-list">
          <li>
            <strong>Throughput:</strong> Scaled to <strong>872 actual RPS</strong> sustainable (sliding window, sidecar
            e2e @ 1,000 target) and <strong>4,161 actual RPS</strong> peak (token bucket, direct @ 5,000 target).
          </li>
          <li><strong>Latency:</strong> p99 dropped to <strong>8 ms</strong> (sliding window) and <strong>148 ms</strong> at token-bucket peak (exceeds 100 ms sustainable threshold).</li>
          <li><strong>Over-Admission Rate:</strong> Reduced to strictly <strong>0%</strong>, ensuring exact limit compliance.</li>
        </ul>

        <div style={{ overflowX: "auto", margin: "20px 0" }}>
          <table className="guide-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #27272a", textAlign: "left" }}>
                <th style={{ padding: "12px 8px" }}>Phase</th>
                <th style={{ padding: "12px 8px" }}>Algorithm / Path</th>
                <th style={{ padding: "12px 8px" }}>Actual RPS</th>
                <th style={{ padding: "12px 8px" }}>Evidence</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Post-Lua</td>
                <td style={{ padding: "12px 8px" }}>Sliding window, sidecar e2e @ 1K target</td>
                <td style={{ padding: "12px 8px" }}>871.38</td>
                <td style={{ padding: "12px 8px" }}><RLEvidenceBadge type="BENCHMARK-PROVEN" /></td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Post-Lua peak</td>
                <td style={{ padding: "12px 8px" }}>Token bucket, direct @ 5K target</td>
                <td style={{ padding: "12px 8px" }}>4,156</td>
                <td style={{ padding: "12px 8px" }}><RLEvidenceBadge type="BENCHMARK-PROVEN" /></td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2 className="guide-sub-heading" id="cache-refactor">3. Implementing Local In-Memory Cache Layers</h2>
        <p>
          Adding process-local denial caches and singleflight request collapsing to the sidecar proxy protected Redis
          during traffic bursts. <RLEvidenceBadge type="BENCHMARK-PROVEN" />
        </p>
        <ul className="guide-bullets-list">
          <li><strong>Throughput:</strong> Handled bursts up to <strong>17,662 actual RPS</strong> targeting denied keys (denial cache hammer).</li>
          <li><strong>Latency:</strong> p99 latency for denied calls remained under <strong>7.11 ms</strong> (stream parser).</li>
          <li><strong>Database Load:</strong> Network calls to Redis dropped by <strong>99.9%</strong> during active rate limiting on cache hits, protecting database performance.</li>
        </ul>

        <RLCallout variant="info" title="Denials-only invariant preserved">
          The denial cache only accelerates <code>429</code> responses. Allowed entries never skip the limiter — quota
          correctness is unchanged; only Redis shielding efficiency improves.
        </RLCallout>

        <RLRelatedPages pages={[
          { section: "performance-lab", slug: "throughput-and-saturation", title: "Throughput & Saturation", note: "872 RPS knee and 4,161 peak" },
          { section: "performance-lab", slug: "concurrency-experiments", title: "Concurrency Experiments", note: "17,662 RPS denial hammer" },
          { section: "rate-limiting-engine", slug: "redis-lua-atomicity", title: "Redis Lua Atomicity", note: "why Lua eliminated over-admission" },
          { section: "resilience", slug: "denial-cache-and-singleflight", title: "Denial Cache & Singleflight", note: "cache safety invariant" }
        ]} />
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
        <RLThesis>
          <RLEvidenceBadge type="FUTURE DESIGN" /> Scaling this rate limiter to handle 100,000+ RPS requires addressing
          the synchronization bottlenecks of centralized Redis architectures. The three proposals below are{" "}
          <strong>not implemented</strong> — they document the engineering direction at 10× current verified throughput.
        </RLThesis>

        <RLCallout variant="warning" title="FUTURE DESIGN — not implemented">
          Nothing in this section exists in the current codebase or benchmark suite. These are architectural proposals
          for a future scale tier. Verified today: ~872 RPS sustainable (sliding), 4,161 RPS token peak, 17,662 RPS
          denial hammer. <RLEvidenceBadge type="FUTURE DESIGN" />
        </RLCallout>

        <RLQuickModel>
          At 10× scale: prefetch token slices to sidecar memory (fewer Redis RTTs), shard keys across Redis Cluster via
          consistent hashing, and offload audit logs to an LSM engine (RocksDB) to decouple write amplification from
          hot-path latency.
        </RLQuickModel>

        <h2 className="guide-sub-heading" id="local-slices">
          1. Decentralized Quotas &amp; Local Token Slices <RLEvidenceBadge type="FUTURE DESIGN" />
        </h2>
        <p>
          Rather than querying Redis on every request, sidecar proxies would acquire quota slices (e.g. 100 tokens at a
          time) from the central database.
        </p>
        <p>
          The proxy evaluates limits locally against its cached slice, syncing consumption asynchronously in the
          background. This shifts the majority of checks to memory-speed lookups, reducing database network traffic.
        </p>
        <RLCallout variant="limitation" title="Consistency trade-off">
          Local slices introduce eventual consistency between sidecar replicas. Over-admission is bounded by slice size
          but non-zero — acceptable only for soft quotas, not hard billing limits.
        </RLCallout>

        <h2 className="guide-sub-heading" id="cluster-sharding">
          2. Consistent Hashing Cluster Rings <RLEvidenceBadge type="FUTURE DESIGN" />
        </h2>
        <p>
          To scale past a single master database instance, key spaces would be sharded across a Redis Cluster.
        </p>
        <p>
          Using consistent hashing rings at the sidecar routing layer would map keys directly to the correct shard. This
          eliminates multi-key slot hash conflicts and avoids slot hotspots, distributing load evenly across cluster
          nodes. Hash tags (e.g. <code>rate:{"{tenant}"}:user:123</code>) would be required for hierarchical multi-key
          Lua scripts.
        </p>
        <DocsMermaid chart={`
graph TD
    Client[Proxy Client] -->|Hash Key: user_993| Ring[Consistent Hash Ring]
    Ring -->|Slot 4821| Shard1[Redis Shard Master 1]
    Ring -->|Slot 11200| Shard2[Redis Shard Master 2]
    Ring -->|Slot 15900| Shard3[Redis Shard Master 3]
        `} />

        <h2 className="guide-sub-heading" id="hybrid-storage">
          3. Hybrid Memory Models <RLEvidenceBadge type="FUTURE DESIGN" />
        </h2>
        <p>
          For high-volume transaction audits, Redis&apos;s in-memory storage becomes cost-prohibitive. A future design
          would replace the audit logger with an LSM-tree engine (like RocksDB) deployed on SSD storage, streaming logs
          asynchronously to maintain high-throughput rate checks.
        </p>
        <p>
          Hot-path quota state would remain in Redis; only cold audit and compliance data would migrate to durable
          block storage, separating latency-sensitive checks from write-heavy observability.
        </p>

        <RLRelatedPages pages={[
          { section: "performance-lab", slug: "throughput-and-saturation", title: "Throughput & Saturation", note: "current verified ceiling before 10× proposals" },
          { section: "architecture", slug: "engineering-trade-offs", title: "Engineering Trade-offs", note: "today's consistency vs latency choices" },
          { section: "rate-limiting-engine", slug: "redis-lua-atomicity", title: "Redis Lua Atomicity", note: "Cluster hash-tag constraint for multi-key scripts" },
          { section: "correctness-and-verification", slug: "known-limitations", title: "Known Limitations", note: "documented constraints at current scale" }
        ]} />
      </div>
    )
  }
};

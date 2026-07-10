import React from "react";

export const enginePages = {
  "algorithm-explorer": {
    title: "Algorithm Explorer",
    topics: [
      { label: "Token Bucket Engine", href: "#token-bucket" },
      { label: "Sliding Window Log", href: "#sliding-window" },
      { label: "Mathematical Comparison", href: "#math" }
    ],
    content: (
      <div>
        <p>
          This system implements two distinct rate limiting algorithms directly inside Redis Lua: the Token Bucket and the Sliding Window Log.
        </p>

        <h2 className="guide-sub-heading" id="token-bucket">1. Token Bucket Engine</h2>
        <p>
          The Token Bucket algorithm represents state in a Redis HASH containing two fields: `tokens` (floating-point balance) and `last_refill` (millisecond timestamp).
        </p>
        <p>
          Refill calculations run lazily when a request arrives, avoiding the need for background cron tickers. The elapsed seconds since the last refill is calculated, multiplied by the fill rate, and added to the token balance up to the configured capacity.
        </p>
        <ul className="guide-bullets-list">
          <li><strong>Refill Precision:</strong> Evaluates refilling as a continuous float. If the rate is 1.5 tokens/sec, and 2.5 seconds elapse, the user gains 3.75 tokens.</li>
          <li><strong>Complexity:</strong> O(1) memory and computational complexity. It reads two fields, computes a float, and writes back.</li>
          <li><strong>Bursty Traffic:</strong> Naturally allows bursty traffic since a full bucket allows a sudden surge of requests equal to the capacity.</li>
        </ul>

        <h2 className="guide-sub-heading" id="sliding-window">2. Sliding Window Log</h2>
        <p>
          The Sliding Window Log coordinates a rolling window (e.g. 10 requests per 60 seconds). It is stored as a Redis Sorted Set (ZSET) per user key.
        </p>
        <p>
          When a request arrives:
        </p>
        <ol className="guide-bullets-list" style={{ listStyleType: "decimal" }}>
          <li>Prunes log entries older than the window start (e.g., `now - 60s`) using `ZREMRANGEBYSCORE`.</li>
          <li>Calculates current requests in the window using `ZCARD`.</li>
          <li>If the card is below the limit, adds the request's timestamp to the sorted set with a unique value (timestamp + GUID string) to prevent collision.</li>
          <li>Sets a Redis TTL on the key to clean up idle sorted sets.</li>
        </ol>
        <ul className="guide-bullets-list">
          <li><strong>Complexity:</strong> Computational complexity is O(log(N) + M), where N is the number of elements in the ZSET and M is the number of pruned elements. Under high volume, memory usage can grow quickly.</li>
          <li><strong>Smoothness:</strong> Prevents window-edge burst abuse (common with Fixed Window algorithms), offering tight compliance.</li>
        </ul>

        <h2 className="guide-sub-heading" id="math">Mathematical Comparison</h2>
        <div style={{ overflowX: "auto", margin: "20px 0" }}>
          <table className="guide-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #27272a", textAlign: "left" }}>
                <th style={{ padding: "12px 8px" }}>Metric / Feature</th>
                <th style={{ padding: "12px 8px" }}>Token Bucket</th>
                <th style={{ padding: "12px 8px" }}>Sliding Window Log</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Redis Structure</td>
                <td>HASH (`tokens`, `last_refill`)</td>
                <td>ZSET (sorted elements)</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Time Complexity</td>
                <td>O(1)</td>
                <td>O(log N + M)</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Memory Footprint</td>
                <td>Constant (minimal)</td>
                <td>Variable (proportional to limit)</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Traffic Shape</td>
                <td>Accommodates bursts</td>
                <td>Uniformly distributed</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    )
  },

  "redis-lua-atomicity": {
    title: "Redis + Lua Atomicity",
    topics: [
      { label: "The Read-Modify-Write Race", href: "#race" },
      { label: "Lua Single-Threaded execution", href: "#single-thread" },
      { label: "EVALSHA & Script Caching", href: "#evalsha" },
      { label: "Script Flush & Recovery", href: "#flush" }
    ],
    content: (
      <div>
        <p>
          Enforcing distributed rate limits requires executing transaction check-and-act operations atomically.
        </p>

        <h2 className="guide-sub-heading" id="race">The Read-Modify-Write Race</h2>
        <p>
          In a distributed system, querying database state, evaluating logic in Go, and writing back changes introduces a data race. If two API workers concurrently query user `X` who has 1 token left, both read `1`, both think the request is allowed, and both write `0` back, over-admitting quota.
        </p>

        <h2 className="guide-sub-heading" id="single-thread">Lua Single-Threaded Execution</h2>
        <p>
          Redis evaluates Lua scripts synchronously. When a script runs, Redis blocks all other commands. This shifts transaction boundaries directly into the database engine, locking execution without distributed lock overhead.
        </p>

        <h2 className="guide-sub-heading" id="evalsha">EVALSHA & Script Caching</h2>
        <p>
          Sending the full Lua script string on every request consumes network bandwidth. To optimize execution, sidecars use script caching:
        </p>
        <ol className="guide-bullets-list">
          <li>The Go client calculates the SHA-1 hash of the script text on startup.</li>
          <li>It sends `EVALSHA &lt;SHA-1&gt;` with arguments to Redis.</li>
          <li>If the script is cached, Redis executes it immediately.</li>
          <li>If not cached (returns `NOSCRIPT`), the Go client falls back to sending the full script text via `EVAL`, priming the cache.</li>
        </ol>

        <h2 className="guide-sub-heading" id="flush">Script Flush & Recovery</h2>
        <p>
          During Redis operations, a `SCRIPT FLUSH` command deletes all cached scripts in Redis. The Go limiter handles this scenario. Upon receiving a `NOSCRIPT` error, it automatically catches the failure and falls back to a full `EVAL` execution, restoring script caching seamlessly.
        </p>
      </div>
    )
  },

  "hierarchical-quotas": {
    title: "Hierarchical Quotas",
    topics: [
      { label: "Hierarchical Check Rules", href: "#rules" },
      { label: "Atomic Multi-Key Lua", href: "#multi-key" },
      { label: "Redis Cluster Limitations", href: "#cluster-limit" }
    ],
    content: (
      <div>
        <p>
          Practical microservice architectures require layered limit structures (e.g. scoping limits globally, per tenant, per user, and per endpoint).
        </p>

        <h2 className="guide-sub-heading" id="rules">Hierarchical Check Rules</h2>
        <p>
          The Hierarchical Limiter evaluates four stacked token buckets:
        </p>
        <ol className="guide-bullets-list">
          <li><strong>Global Tier:</strong> Overall system protection (e.g. 50,000 req/sec total capacity).</li>
          <li><strong>Tenant Tier:</strong> Bounded capacity scoped per tenant (e.g. 5,000 req/sec).</li>
          <li><strong>User Tier:</strong> Scoped per individual user (e.g. 100 req/sec).</li>
          <li><strong>Endpoint Tier:</strong> Per-endpoint limits within a tenant (e.g. 10 req/sec on `/checkout`).</li>
        </ol>
        <p>
          <strong>All-or-Nothing Rule:</strong> A request is only allowed if it passes the checks of ALL four tiers. If any level is exhausted, no tokens are deducted from any tier, preventing leakage on blocked requests.
        </p>

        <h2 className="guide-sub-heading" id="multi-key">Atomic Multi-Key Lua Execution</h2>
        <p>
          Multi-key validation runs inside `internal/limiter/lua/hierarchical.lua`. The script takes 4 keys (global, tenant, user, endpoint) and 8 arguments (capacities and refill rates). It loops through each tier, calculates refilled tokens, and performs validations.
        </p>
        <p>
          If all tiers approve:
        </p>
        <pre style={{ background: "#0e0e11", border: "1px solid #27272a", padding: 14, borderRadius: 6, fontSize: 12, overflowX: "auto" }}>
{`for i = 1, levels do
    local updated_tokens = level_new_tokens[i] - requested
    redis.call('HMSET', KEYS[i], 'tokens', updated_tokens, 'last_refill', now)
    redis.call('EXPIRE', KEYS[i], 3600)
end`}
        </pre>

        <h2 className="guide-sub-heading" id="cluster-limit">Redis Cluster Incompatibility</h2>
        <p>
          Since Redis Cluster distributes keys across 16,384 slots based on hash calculations, multi-key transactions are only supported if all keys map to the same hash slot (e.g. using hash tags like `rate:{"{tenant_123}"}`). Because our hierarchical key patterns (`config:global`, `config:tenant:abc`, `config:user:xyz`) cannot realistically share a single slot without concentrating all system traffic onto a single node, this hierarchical Lua engine requires a single-master Redis topology.
        </p>
      </div>
    )
  },

  "multi-replica-correctness": {
    title: "Multi-Replica Correctness",
    topics: [
      { label: "Coordinated State Correctness", href: "#correctness" },
      { label: "Process-Local Safety Boundaries", href: "#boundaries" },
      { label: "Verified Multi-Replica Results", href: "#results" }
    ],
    content: (
      <div>
        <p>
          Scaling transparent sidecars and limiters horizontally must not compromise global quota correctness.
        </p>

        <h2 className="guide-sub-heading" id="correctness">Coordinated State Correctness</h2>
        <p>
          Limiter replicas run as stateless processes. All state is centralized in the active Redis master. This architecture guarantees that even if a tenant's requests are spread across 20 sidecars and limiters, they coordinate on the same Redis key, avoiding over-admission.
        </p>

        <h2 className="guide-sub-heading" id="boundaries">Process-Local Safety Boundaries</h2>
        <p>
          To maintain correctness, we bound local optimizations:
        </p>
        <ul className="guide-bullets-list">
          <li><strong>Denial Cache Scope:</strong> Cache entries are stored local to each sidecar replica. A denial on Replica 1 is not immediately visible to Replica 2. This is safe: it may allow Replica 2 to execute a check against Redis, but Redis will still correctly deny it if tokens are exhausted.</li>
          <li><strong>Singleflight Scope:</strong> Collapsing concurrent identical keys is local to each sidecar replica. It collapses 100 concurrent requests on Replica 1 into 1 network hop, but does not affect Replica 2's queries.</li>
        </ul>

        <h2 className="guide-sub-heading" id="results">Verified Multi-Replica Results</h2>
        <p>
          In verification tests, concurrent bursts were issued across two sidecars sharing a Redis backend:
        </p>
        <div style={{
          background: "rgba(34, 197, 94, 0.05)",
          border: "1px solid rgba(34, 197, 94, 0.2)",
          borderRadius: 8,
          padding: 16,
          marginTop: 16
        }}>
          <strong>Multi-Replica Correctness Verified:</strong> Under a 60 concurrent request burst, the system permitted exactly 10 requests (matching the bucket capacity of 10) and rejected 50, verifying strict coordination.
        </div>
      </div>
    )
  },

  "configuration-overrides": {
    title: "Configuration Overrides",
    topics: [
      { label: "Dynamic Overrides Flow", href: "#override-flow" },
      { label: "Monotonic Version Invalidation", href: "#version-invalidation" },
      { label: "Fallback Behaviors", href: "#fallback" }
    ],
    content: (
      <div>
        <p>
          This section analyzes how rate limits are updated at runtime without requiring process restarts.
        </p>

        <h2 className="guide-sub-heading" id="override-flow">Dynamic Overrides Flow</h2>
        <p>
          Admin overrides are written to Redis hashes (`config:&lt;level&gt;:&lt;id&gt;`) via the Admin API (`:8082`). This writes capacity and refill rate overrides that the Limiter uses instead of static configuration defaults.
        </p>

        <h2 className="guide-sub-heading" id="version-invalidation">Monotonic Version Invalidation</h2>
        <p>
          Polling Redis on every override check adds latency, while relying on Pub/Sub exposes the system to missed-message risks if a replica goes offline briefly. The override store uses version checking:
        </p>
        <ol className="guide-bullets-list" style={{ listStyleType: "decimal" }}>
          <li>A single monotonic key `config:generation` tracks configuration versions.</li>
          <li>On every admin write, the system updates the override configuration and increments `config:generation` atomically in a pipeline.</li>
          <li>Replicas cache overrides in memory. Before running a check, they query `config:generation`. If it matches their local snapshot, they serve overrides from cache.</li>
          <li>If the generation has incremented, they invalidate their entire local cache, fetching fresh overrides from Redis on demand.</li>
        </ol>

        <h2 className="guide-sub-heading" id="fallback">Fallback Behaviors</h2>
        <p>
          If querying the generation key fails due to a temporary Redis timeout, the Limiter falls back to using cached override states until `OVERRIDE_CACHE_TTL_MS` expires, bounding configuration staleness.
        </p>
      </div>
    )
  }
};

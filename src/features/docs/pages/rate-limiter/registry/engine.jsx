import React from "react";
import {
  RLThesis,
  RLQuickModel,
  RLCallout,
  RLSourceExcerpt,
  RLRelatedPages,
  RLStatGrid
} from "../components/RLDocBlocks.jsx";

export const enginePages = {
  "algorithm-explorer": {
    title: "Algorithm Explorer",
    topics: [
      { label: "Token Bucket Engine", href: "#token-bucket" },
      { label: "Sliding Window Log", href: "#sliding-window" },
      { label: "Mathematical Comparison", href: "#math" },
      { label: "Design Rationale", href: "#rationale" },
      { label: "Alternatives Considered", href: "#alternatives" },
      { label: "Limitations", href: "#limitations" }
    ],
    content: (
      <div>
        <RLThesis>
          The rate limiting engine implements two Redis Lua algorithms — Token Bucket and Sliding Window Log — each optimized for different traffic shapes. Token bucket stores O(1) HASH state with lazy refill; sliding window stores per-request timestamps in a ZSET pruned by score. Both run atomically inside Redis on every check.
        </RLThesis>

        <RLQuickModel>
          Token bucket answers: "Does this caller have a token right now, accounting for elapsed refill time?" Sliding window answers: "How many requests landed in the last W seconds?" Pick token bucket for burst tolerance and throughput; pick sliding window for strict window compliance without edge doubling.
        </RLQuickModel>

        <h2 className="guide-sub-heading" id="token-bucket">1. Token Bucket Engine</h2>
        <p>
          State lives in a Redis HASH with two fields: <code>tokens</code> (floating-point balance) and <code>last_refill</code> (second-resolution timestamp). Refill is lazy — computed on arrival, not by a background ticker. Each successful or denied check refreshes a 3600-second TTL so idle keys are reclaimed.
        </p>

        <RLSourceExcerpt
          source="internal/limiter/lua/token_bucket.lua"
          language="lua"
          establishes="HASH storage (tokens/last_refill), lazy refill math, conditional decrement, and EXPIRE 3600 on every write."
        >{`-- KEYS[1] = rate:{user_id}
-- ARGV[1] = now_sec, ARGV[2] = capacity, ARGV[3] = refill_rate

local key         = KEYS[1]
local now         = tonumber(ARGV[1])
local capacity    = tonumber(ARGV[2])
local refill_rate = tonumber(ARGV[3])

local data        = redis.call('HMGET', key, 'tokens', 'last_refill')
local tokens      = tonumber(data[1]) or capacity
local last_refill = tonumber(data[2]) or now

-- Lazy refill: add tokens proportional to elapsed seconds
local elapsed    = math.max(0, now - last_refill)
local new_tokens = math.min(capacity, tokens + elapsed * refill_rate)

if new_tokens < 1 then
    redis.call('HMSET', key, 'tokens', new_tokens, 'last_refill', now)
    redis.call('EXPIRE', key, 3600)
    return {0, 0}
end

new_tokens = new_tokens - 1
redis.call('HMSET', key, 'tokens', new_tokens, 'last_refill', now)
redis.call('EXPIRE', key, 3600)
return {1, math.floor(new_tokens)}`}</RLSourceExcerpt>

        <ul className="guide-bullets-list">
          <li><strong>Refill precision:</strong> Continuous float math — a rate of 1.5 tokens/sec over 2.5 seconds yields 3.75 tokens added.</li>
          <li><strong>Complexity:</strong> O(1) memory and compute — two HMGET fields, one float calculation, one HMSET.</li>
          <li><strong>Burst allowance:</strong> A full bucket permits a surge up to capacity before steady-state throttling resumes.</li>
        </ul>

        <RLStatGrid stats={[
          { value: "4,161", label: "Peak RPS (direct token bucket @ 5K target)", color: "#fbbf24", evidence: "BENCHMARK-PROVEN" },
          { value: "148ms", label: "p99 latency at peak capacity", color: "#fbbf24", evidence: "BENCHMARK-PROVEN" },
          { value: "O(1)", label: "Redis memory per key (2 HASH fields)", evidence: "SOURCE-PROVEN" }
        ]} />

        <h2 className="guide-sub-heading" id="sliding-window">2. Sliding Window Log</h2>
        <p>
          The sliding window algorithm enforces a strict <em>N requests per W seconds</em> limit. State is a Redis Sorted Set keyed as <code>sw:{"{userID}"}</code>. Each member is a unique request ID scored by nanosecond timestamp. On every check, entries older than the window are pruned with <code>ZREMRANGEBYSCORE</code>, then the current count is evaluated.
        </p>

        <RLCallout variant="warning" title="Not a fixed window">
          Despite occasional comments elsewhere that describe this as a fixed window, the implementation is a true sliding window log. The cutoff is always <code>now - window</code>, not an epoch-aligned bucket boundary. This prevents the classic fixed-window edge burst where a client sends 2× the limit at a window rollover.
        </RLCallout>

        <RLSourceExcerpt
          source="internal/limiter/lua/sliding_window.lua"
          language="lua"
          establishes="ZSET key pattern sw:{userID}, ZREMRANGEBYSCORE pruning, tentative ZADD with rollback on deny, and PEXPIRE keyed to window duration."
        >{`-- KEYS[1] = sw:{user_id}
-- ARGV[1] = now_ns, ARGV[2] = window_ns, ARGV[3] = limit, ARGV[4] = unique_id

local key    = KEYS[1]
local now    = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit  = tonumber(ARGV[3])
local uid    = ARGV[4]
local cutoff = now - window

-- Prune entries outside the sliding window
redis.call('ZREMRANGEBYSCORE', key, 0, cutoff)

-- Tentatively record this request
redis.call('ZADD', key, 'NX', now, uid)
local count = redis.call('ZCARD', key)

if count > tonumber(limit) then
    redis.call('ZREM', key, uid)
    return {0, 0}
end

redis.call('PEXPIRE', key, math.ceil(window / 1000000))
return {1, limit - count}`}</RLSourceExcerpt>

        <ul className="guide-bullets-list">
          <li><strong>Complexity:</strong> O(log N + M) where N is ZSET size and M is pruned entries.</li>
          <li><strong>Memory:</strong> Grows with request volume inside the window — one ZSET member per allowed request.</li>
          <li><strong>Smoothness:</strong> No window-edge doubling; compliance is tight across rolling intervals.</li>
        </ul>

        <RLStatGrid stats={[
          { value: "872", label: "Sustainable RPS (sliding window, sidecar e2e)", color: "#22c55e", evidence: "BENCHMARK-PROVEN" },
          { value: "11ms", label: "p99 latency at sustainable load (sidecar e2e)", color: "#22c55e", evidence: "BENCHMARK-PROVEN" },
          { value: "O(N)", label: "Redis memory per key (1 ZSET member per request in window)", evidence: "SOURCE-PROVEN" }
        ]} />

        <h2 className="guide-sub-heading" id="math">3. Mathematical Comparison</h2>
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
                <td>HASH (<code>tokens</code>, <code>last_refill</code>)</td>
                <td>ZSET (<code>sw:{"{userID}"}</code>)</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Time Complexity</td>
                <td>O(1)</td>
                <td>O(log N + M)</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Memory Footprint</td>
                <td>Constant (~200 bytes)</td>
                <td>Variable (proportional to limit × window traffic)</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Traffic Shape</td>
                <td>Accommodates bursts up to capacity</td>
                <td>Uniformly distributed — no burst accumulation</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Peak / Sustainable RPS</td>
                <td>4,161 peak (p99 148ms)</td>
                <td>872 sustainable (p99 11ms e2e)</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Hierarchical Support</td>
                <td>Yes — <code>hierarchical.lua</code> uses token bucket logic</td>
                <td>Flat checks only (<code>/check</code> endpoint)</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2 className="guide-sub-heading" id="rationale">Design Rationale</h2>
        <ul className="guide-bullets-list">
          <li><strong>Lazy refill over cron tickers:</strong> No background goroutine or Redis keyspace notifications are needed. Refill math runs only when a request arrives, eliminating timer drift and reducing idle Redis writes.</li>
          <li><strong>Two algorithms, one engine:</strong> <code>ALGORITHM=token_bucket</code> (default) and <code>ALGORITHM=sliding</code> share the same EVALSHA execution path. Operators pick the trade-off without redeploying infrastructure.</li>
          <li><strong>EXPIRE 3600 on token buckets:</strong> Idle rate-limit keys are automatically reclaimed after one hour, bounding long-term Redis memory growth for churning user populations.</li>
          <li><strong>Sliding window for strict SLAs:</strong> Login, payment, and webhook endpoints benefit from the ZSET log because burst accumulation is impossible — every request in the last W seconds counts.</li>
        </ul>

        <h2 className="guide-sub-heading" id="alternatives">Alternatives Considered</h2>
        <ul className="guide-bullets-list">
          <li><strong>Fixed window counter:</strong> Simpler (INCR + EXPIRE on epoch bucket), but permits 2× limit at window boundaries. Rejected for compliance-sensitive endpoints.</li>
          <li><strong>Leaky bucket:</strong> Smooths output rate but cannot express "allow burst up to capacity." Token bucket provides the same steady-state rate with better burst semantics for API clients.</li>
          <li><strong>Sliding window counter (hybrid):</strong> Approximates sliding behavior with two fixed windows and weighted average. Lower memory than ZSET log but introduces approximation error. Rejected in favor of exact ZSET counting.</li>
          <li><strong>In-process token bucket:</strong> Zero network latency but causes over-admission across replicas. All quota math must run in Redis Lua for correctness.</li>
        </ul>

        <h2 className="guide-sub-heading" id="limitations">Limitations</h2>
        <RLCallout variant="limitation" title="Documented constraints">
          <ul style={{ margin: "8px 0 0 0", paddingLeft: 16 }}>
            <li>Token bucket uses whole-second timestamps (<code>time.Now().Unix()</code>). Intra-second refill granularity requires switching to millisecond timestamps.</li>
            <li>Sliding window memory scales with active request volume. At 1,000 req/min per user, expect ~50 KB Redis memory per active user.</li>
            <li>Token bucket peak throughput (4,161 RPS) exceeds the sustainable p99 threshold (100ms). For latency-sensitive paths, operate below peak or prefer sliding window at 872 RPS sustainable.</li>
            <li>Neither algorithm supports Redis Cluster multi-key atomicity without hash tags. Hierarchical checks require standalone Redis or Sentinel.</li>
          </ul>
        </RLCallout>

        <RLRelatedPages pages={[
          { slug: "redis-lua-atomicity", section: "rate-limiting-engine", title: "Redis + Lua Atomicity", note: "why check-and-decrement must be one script" },
          { slug: "throughput-and-saturation", section: "performance-lab", title: "Throughput & Saturation", note: "benchmark numbers cited above" },
          { slug: "hierarchical-quotas", section: "rate-limiting-engine", title: "Hierarchical Quotas", note: "token bucket extended to four tiers" }
        ]} />
      </div>
    )
  },

  "redis-lua-atomicity": {
    title: "Redis + Lua Atomicity",
    topics: [
      { label: "The Read-Modify-Write Race", href: "#race" },
      { label: "Lua Single-Threaded Execution", href: "#single-thread" },
      { label: "EVALSHA & Script Caching", href: "#evalsha" },
      { label: "NOSCRIPT Fallback", href: "#noscript" },
      { label: "Design Rationale", href: "#rationale" },
      { label: "Alternatives Considered", href: "#alternatives" },
      { label: "Limitations", href: "#limitations" }
    ],
    content: (
      <div>
        <RLThesis>
          Distributed rate limiting requires atomic check-and-act operations. The engine shifts transaction boundaries into Redis by executing all quota logic inside Lua scripts via EVALSHA, with automatic NOSCRIPT fallback to EVAL when the script cache is cold.
        </RLThesis>

        <RLQuickModel>
          Without Lua, two workers can both read "1 token remaining" and both allow the request. With Lua, Redis runs the entire script without interleaving other commands — one round-trip, zero races, no distributed lock.
        </RLQuickModel>

        <h2 className="guide-sub-heading" id="race">The Read-Modify-Write Race</h2>
        <p>
          A naive Go-side flow — HGET tokens, compute refill, HSET tokens — creates a TOCTOU (time-of-check to time-of-use) race. Two API workers querying user X with 1 token remaining both read 1, both allow, and both write 0, over-admitting by one request.
        </p>
        <p>
          At 60 concurrent requests against a bucket of capacity 10, a non-atomic implementation would permit far more than 10. The Lua engine prevents this entirely.
        </p>

        <h2 className="guide-sub-heading" id="single-thread">Lua Single-Threaded Execution</h2>
        <p>
          Redis evaluates Lua scripts synchronously on its single event-loop thread. While a script runs, no other command executes on that node. This provides mutex-like isolation without explicit lock acquisition, release, or retry loops.
        </p>
        <ul className="guide-bullets-list">
          <li><strong>Atomicity scope:</strong> All Redis calls within one script are one indivisible operation.</li>
          <li><strong>Single round-trip:</strong> The Go client sends one EVALSHA with keys and arguments; Redis returns the decision.</li>
          <li><strong>Serialization cost:</strong> Concurrent scripts queue behind each other — this is the Redis single-thread ceiling.</li>
        </ul>

        <h2 className="guide-sub-heading" id="evalsha">EVALSHA and Script Caching</h2>
        <p>
          Transmitting full Lua source on every request wastes bandwidth and forces recompilation. At startup, the Go limiter embeds scripts via <code>go:embed</code>, loads them with SCRIPT LOAD, and caches the SHA-1 digest.
        </p>

        <RLSourceExcerpt
          source="internal/limiter/redis_atomic_token_bucket.go"
          language="go"
          establishes="SCRIPT LOAD at startup stores SHA-1; hot path uses EvalSha with automatic NOSCRIPT recovery."
        >{`func NewRedisTokenBucket(rdb redis.UniversalClient, cfg Config) (*RedisTokenBucket, error) {
    script, err := scripts.ReadFile("lua/token_bucket.lua")
    if err != nil {
        return nil, fmt.Errorf("read token_bucket.lua: %w", err)
    }
    sha, err := rdb.ScriptLoad(ctx, string(script)).Result()
    if err != nil {
        return nil, fmt.Errorf("load token bucket script: %w", err)
    }
    return &RedisTokenBucket{rdb: rdb, sha: sha, cfg: cfg}, nil
}

func (b *RedisTokenBucket) Allow(ctx context.Context, key string) (Result, error) {
    vals, err := b.script.Run(ctx, b.rdb, []string{key},
        now.Unix(), b.cfg.Capacity, b.cfg.RefillRate,
    ).Int64Slice()
    // script.Run: EVALSHA first; on NOSCRIPT → EVAL + re-cache
    ...
}`}</RLSourceExcerpt>

        <ol className="guide-bullets-list">
          <li>Go client computes SHA-1 of script text on startup via SCRIPT LOAD.</li>
          <li>Hot path sends <code>EVALSHA {"<SHA-1>"}</code> with keys and arguments (~40 bytes overhead).</li>
          <li>If cached, Redis executes immediately without re-parsing Lua source.</li>
          <li>If not cached, Redis returns <code>NOSCRIPT</code> and the client falls back (see below).</li>
        </ol>

        <h2 className="guide-sub-heading" id="noscript">NOSCRIPT Fallback</h2>
        <p>
          Redis clears the script cache on restart or <code>SCRIPT FLUSH</code>. The go-redis <code>Script.Run()</code> wrapper handles this transparently: on NOSCRIPT, it sends the full script via EVAL, re-primes the cache, and returns the result. Quota checks recover without operator intervention.
        </p>

        <RLSourceExcerpt
          source="internal/limiter/redis_atomic_token_bucket.go (via go-redis Script.Run)"
          language="go"
          establishes="NOSCRIPT error triggers automatic EVAL fallback, restoring script cache on the next successful execution."
        >{`// go-redis Script.Run() protocol (simplified):
result, err := c.EvalSha(ctx, sha, keys, args...).Result()
if err != nil && isNoScriptError(err) {
    // Cache miss: send full script text, Redis compiles and caches
    result, err = c.Eval(ctx, scriptSrc, keys, args...).Result()
}
return result, err`}</RLSourceExcerpt>

        <RLCallout variant="info" title="Production behavior">
          A NOSCRIPT during normal operation adds one extra round-trip (EVAL instead of EVALSHA). After the fallback, subsequent calls resume EVALSHA. This is logged but does not affect quota correctness.
        </RLCallout>

        <h2 className="guide-sub-heading" id="rationale">Design Rationale</h2>
        <ul className="guide-bullets-list">
          <li><strong>Lua over WATCH/MULTI/EXEC:</strong> Optimistic transactions require 3+ round-trips with retry loops under contention. Lua completes in one round-trip with zero retries.</li>
          <li><strong>Lua over Redlock:</strong> Distributed locks add 2–3 round-trips for acquire/release and introduce clock-skew edge cases. Lua runs entirely inside Redis.</li>
          <li><strong>EVALSHA over EVAL:</strong> Avoids transmitting ~500 bytes of hierarchical.lua source on every request. At 872+ RPS, this saves measurable network bandwidth and CPU compilation cost.</li>
          <li><strong>Embedded scripts over Redis Functions:</strong> go:embed keeps scripts version-locked to the binary. Deploying a new script version is an application rollout, not a separate Redis admin step.</li>
        </ul>

        <h2 className="guide-sub-heading" id="alternatives">Alternatives Considered</h2>
        <ul className="guide-bullets-list">
          <li><strong>WATCH/MULTI/EXEC:</strong> Standard Redis optimistic locking. Rejected due to retry storms under high concurrency — p99 latency exceeded 15ms vs ~1ms for Lua.</li>
          <li><strong>Redlock (distributed lock):</strong> Requires majority quorum across Redis nodes. Rejected — adds complexity without benefit when a single Redis master serializes all quota state.</li>
          <li><strong>Application-level mutex (sync.Mutex):</strong> Only protects within one process. Useless across sidecar/limiter replicas.</li>
          <li><strong>CRDT / gossip counters:</strong> Eventually consistent, permits over-admission. Rejected — rate limiting demands strong consistency.</li>
        </ul>

        <h2 className="guide-sub-heading" id="limitations">Limitations</h2>
        <RLCallout variant="limitation" title="Documented constraints">
          <ul style={{ margin: "8px 0 0 0", paddingLeft: 16 }}>
            <li>Lua scripts block the Redis event loop during execution. Long scripts or high concurrency create serialization queues.</li>
            <li>Multi-key scripts (hierarchical.lua) require all KEYS to reside on the same Redis node — incompatible with Redis Cluster without hash tags.</li>
            <li>Script cache is per-node. After failover to a replica promoted to master, the first request per script pays an EVAL fallback cost.</li>
            <li>Lua uses double-precision floats. Token calculations can drift fractionally under extreme concurrency; values are clamped to [0, capacity].</li>
          </ul>
        </RLCallout>

        <RLRelatedPages pages={[
          { slug: "algorithm-explorer", section: "rate-limiting-engine", title: "Algorithm Explorer", note: "the Lua scripts being executed" },
          { slug: "hierarchical-quotas", section: "rate-limiting-engine", title: "Hierarchical Quotas", note: "multi-key atomic Lua" },
          { slug: "failure-model", section: "resilience", title: "Failure Model", note: "NOSCRIPT recovery row in resilience matrix" }
        ]} />
      </div>
    )
  },

  "hierarchical-quotas": {
    title: "Hierarchical Quotas",
    topics: [
      { label: "Four-Tier Model", href: "#tiers" },
      { label: "All-or-Nothing Rule", href: "#all-or-nothing" },
      { label: "Atomic Multi-Key Lua", href: "#multi-key" },
      { label: "Design Rationale", href: "#rationale" },
      { label: "Alternatives Considered", href: "#alternatives" },
      { label: "Limitations", href: "#limitations" }
    ],
    content: (
      <div>
        <RLThesis>
          Production microservices need layered limits — global, tenant, user, and endpoint — evaluated atomically in a single Lua script. A request is allowed only if all four token buckets pass; on deny, refilled state is written back but no tokens are deducted from any tier.
        </RLThesis>

        <RLQuickModel>
          Think of four nested gates. The script reads and refills all four buckets (Phase 1). If any gate is closed, the request is denied and Phase 2 is skipped. If all gates are open, one token is deducted from each bucket simultaneously (Phase 2).
        </RLQuickModel>

        <h2 className="guide-sub-heading" id="tiers">Four-Tier Model</h2>
        <p>
          The hierarchical limiter evaluates four stacked token buckets in one EVALSHA call:
        </p>
        <ol className="guide-bullets-list">
          <li><strong>Global:</strong> <code>rate:global:default</code> — system-wide protection (e.g. 50,000 req/sec).</li>
          <li><strong>Tenant:</strong> <code>rate:tenant:{"{tenantID}"}</code> — per-organization cap (e.g. 5,000 req/sec).</li>
          <li><strong>User:</strong> <code>rate:user:{"{userID}"}</code> — per-user cap (e.g. 100 req/sec).</li>
          <li><strong>Endpoint:</strong> <code>rate:ep:{"{tenantID}"}:{"{path}"}</code> — per-path cap (e.g. 10 req/sec on /checkout).</li>
        </ol>

        <h2 className="guide-sub-heading" id="all-or-nothing">All-or-Nothing Rule</h2>
        <p>
          Partial deduction is forbidden. If the user tier is exhausted but the tenant tier has tokens, the request is denied and the tenant tier loses nothing. Phase 1 writes back refilled token counts (keeping clocks current) but Phase 2 decrement runs only when <code>allowed == 1</code>.
        </p>

        <RLSourceExcerpt
          source="internal/limiter/lua/hierarchical.lua — Phase 1 (check + write-back)"
          language="lua"
          establishes="On deny, refilled token state is persisted (HMSET + EXPIRE) but no decrement occurs. All four KEYS are read in one atomic frame."
        >{`local level_count = tonumber(ARGV[#ARGV])
local now = tonumber(ARGV[#ARGV - 1])
local allowed = 1
local min_remaining = math.huge

-- Phase 1: speculative check across all levels
for i = 1, level_count do
    local key         = KEYS[i]
    local cap         = tonumber(ARGV[i])
    local rate        = tonumber(ARGV[level_count + i])
    local data        = redis.call('HMGET', key, 'tokens', 'last_refill')
    local tokens      = tonumber(data[1]) or cap
    local last_refill = tonumber(data[2]) or now
    local elapsed     = math.max(0, now - last_refill)
    local refilled    = math.min(cap, tokens + elapsed * rate)

    -- Write back refilled state (even on eventual deny)
    redis.call('HMSET', key, 'tokens', refilled, 'last_refill', now)
    redis.call('EXPIRE', key, 3600)

    if refilled < 1 then
        allowed = 0
    end
    min_remaining = math.min(min_remaining, refilled)
end`}</RLSourceExcerpt>

        <RLSourceExcerpt
          source="internal/limiter/lua/hierarchical.lua — Phase 2 (conditional deduct)"
          language="lua"
          establishes="Decrement runs only when all levels passed. Denied requests return {0, floor(min_remaining)} without consuming tokens."
        >{`-- Phase 2: all-or-nothing deduct
if allowed == 1 then
    for i = 1, level_count do
        local current = tonumber(redis.call('HGET', KEYS[i], 'tokens'))
        redis.call('HSET', KEYS[i], 'tokens', current - 1)
    end
    return {1, math.floor(min_remaining - 1)}
end

return {0, math.floor(min_remaining)}`}</RLSourceExcerpt>

        <h2 className="guide-sub-heading" id="multi-key">Atomic Multi-Key Lua Execution</h2>
        <p>
          The script accepts 4 KEYS and 10 ARGV values (4 capacities, 4 refill rates, timestamp, level count). All four buckets are read, refilled, checked, and optionally decremented within a single Lua execution — no other client can interleave.
        </p>
        <p>
          Before each hierarchical check, the Go limiter calls <code>RefreshGeneration()</code> to verify the override cache is current (see Configuration Overrides page). Override capacities and refill rates are resolved into the ARGV array at call time.
        </p>

        <h2 className="guide-sub-heading" id="rationale">Design Rationale</h2>
        <ul className="guide-bullets-list">
          <li><strong>Single script, not four sequential checks:</strong> Four separate EVALSHA calls would create a TOCTOU window — tenant tokens could be consumed between the user check and the endpoint decrement.</li>
          <li><strong>Write-back on deny:</strong> Updating <code>last_refill</code> even on denied requests keeps idle buckets from accumulating phantom tokens across long idle periods followed by a burst.</li>
          <li><strong>Minimum remaining tracking:</strong> Returning the tightest constraint across all tiers enables accurate <code>X-RateLimit-Remaining</code> and <code>Retry-After</code> headers.</li>
          <li><strong>Variable level count:</strong> <code>ARGV[level_count]</code> allows 1–4 levels without duplicating script files — flat checks reuse the same script with <code>levels=1</code>.</li>
        </ul>

        <h2 className="guide-sub-heading" id="alternatives">Alternatives Considered</h2>
        <ul className="guide-bullets-list">
          <li><strong>Sequential per-tier checks:</strong> Check global, then tenant, then user, then endpoint as four Redis calls. Rejected — TOCTOU race and 4× network round-trips.</li>
          <li><strong>Check-all then deduct-all (two scripts):</strong> Two EVALSHA calls still leave a race window between scripts. Rejected — both phases must be one script.</li>
          <li><strong>Hash tags for Redis Cluster:</strong> Force all keys into one slot via <code>{"{rl}"}:global</code>, <code>{"{rl}"}:tenant:X</code>. Rejected — concentrates all traffic on one cluster node, defeating horizontal scaling.</li>
          <li><strong>Application-side hierarchy in Go:</strong> Evaluate tiers in Go with Redis pipelines. Rejected — cannot guarantee atomicity across keys.</li>
        </ul>

        <h2 className="guide-sub-heading" id="limitations">Limitations</h2>
        <RLCallout variant="limitation" title="Redis Cluster incompatibility">
          Redis Cluster distributes keys across 16,384 hash slots. Multi-key Lua scripts fail with <code>CROSSSLOT Keys in request don't hash to the same slot</code> when KEYS hash to different slots. Key patterns like <code>rate:global:default</code>, <code>rate:tenant:abc</code>, and <code>rate:user:xyz</code> cannot share a slot without hash tags. The hierarchical engine requires standalone Redis or Sentinel (single master topology).
        </RLCallout>
        <ul className="guide-bullets-list">
          <li>Hierarchical checks use token bucket math only — sliding window is not supported for multi-tier evaluation.</li>
          <li>Four HASH reads + four potential writes per request increases Redis CPU vs a flat single-tier check.</li>
          <li>Override resolution adds a generation lookup before the EVALSHA call (typically cached locally).</li>
        </ul>

        <RLRelatedPages pages={[
          { slug: "redis-lua-atomicity", section: "rate-limiting-engine", title: "Redis + Lua Atomicity", note: "why single-script atomicity matters" },
          { slug: "configuration-overrides", section: "rate-limiting-engine", title: "Configuration Overrides", note: "RefreshGeneration before each check" },
          { slug: "system-invariants", section: "architecture", title: "System Invariants", note: "formal all-or-nothing invariant" }
        ]} />
      </div>
    )
  },

  "multi-replica-correctness": {
    title: "Multi-Replica Correctness",
    topics: [
      { label: "Coordinated State Correctness", href: "#correctness" },
      { label: "Process-Local Safety Boundaries", href: "#boundaries" },
      { label: "Verified Multi-Replica Results", href: "#results" },
      { label: "Design Rationale", href: "#rationale" },
      { label: "Alternatives Considered", href: "#alternatives" },
      { label: "Limitations", href: "#limitations" }
    ],
    content: (
      <div>
        <RLThesis>
          Horizontal scaling of sidecars and limiters must not compromise global quota correctness. All replicas are stateless; Redis master holds authoritative state. Runtime verification proves that 60 concurrent requests across two sidecars against a capacity-10 bucket yield exactly 10 allowed and 50 denied.
        </RLThesis>

        <RLQuickModel>
          Replicas are interchangeable workers. They never trust local token counts. Every allow/deny decision goes to the same Redis key on the same master, so replica count is irrelevant to correctness — only to throughput and latency.
        </RLQuickModel>

        <h2 className="guide-sub-heading" id="correctness">Coordinated State Correctness</h2>
        <p>
          Limiter replicas run as stateless processes. All quota state is centralized on the active Redis master. Whether a tenant's requests hit sidecar replica 1 or replica 2, both coordinate on the same Redis key via EVALSHA — preventing over-admission regardless of load balancer distribution.
        </p>
        <ul className="guide-bullets-list">
          <li><strong>Single writer:</strong> Redis master is the sole authority for token balances.</li>
          <li><strong>No local token state:</strong> Sidecars and limiters hold no quota counters in memory (only denial cache entries for rejected keys).</li>
          <li><strong>Linearizable reads:</strong> All EVALSHA calls target the master, not read replicas, avoiding stale token counts.</li>
        </ul>

        <h2 className="guide-sub-heading" id="boundaries">Process-Local Safety Boundaries</h2>
        <p>
          Local optimizations are explicitly bounded so they cannot weaken global correctness:
        </p>
        <ul className="guide-bullets-list">
          <li><strong>Denial cache (per-replica):</strong> A denial on replica 1 is not visible to replica 2. Replica 2 may send an extra Redis round-trip, but Redis still correctly denies if tokens are exhausted. Safe — may add latency, never adds over-admission.</li>
          <li><strong>Singleflight (per-replica):</strong> Collapses 100 concurrent identical keys on one replica into 1 network hop. Does not cross replica boundaries. Safe — the collapsed result reflects the true Redis state at that moment.</li>
          <li><strong>Override cache (per-replica):</strong> Stale overrides may persist until generation check or TTL expiry. Safe for quota correctness (uses last-known-good config), but may briefly apply outdated limits.</li>
        </ul>

        <h2 className="guide-sub-heading" id="results">Verified Multi-Replica Results</h2>
        <p>
          The multi-replica test topology runs two sidecar instances (ports :9090 and :9092) and two limiter instances (ports :8080 and :8083) against a shared Redis master. A bucket with capacity 10 receives 60 concurrent requests split across both sidecars.
        </p>

        <RLStatGrid stats={[
          { value: "60", label: "Concurrent requests (split across 2 sidecars)", evidence: "RUNTIME-PROVEN" },
          { value: "10", label: "Requests allowed (matches bucket capacity)", color: "#22c55e", evidence: "RUNTIME-PROVEN" },
          { value: "50", label: "Requests denied (429 Too Many Requests)", color: "#ef4444", evidence: "RUNTIME-PROVEN" }
        ]} />

        <RLCallout variant="info" title="Correctness invariant">
          Allowed count + denied count = total concurrent requests. Allowed count = bucket capacity (assuming no refill during the burst). Zero over-admission observed across all test runs.
        </RLCallout>

        <RLSourceExcerpt
          source="internal/limiter/redis_atomic_token_bucket_test.go (multi-replica integration)"
          language="go"
          establishes="Concurrent burst against shared Redis key from multiple clients must yield exactly capacity allowed requests."
        >{`// 60 goroutines, 2 sidecar endpoints, capacity = 10
var allowed, denied int64
var wg sync.WaitGroup
for i := 0; i < 60; i++ {
    wg.Add(1)
    go func(endpoint string) {
        defer wg.Done()
        resp, _ := http.Get(endpoint + "/api/test")
        if resp.StatusCode == 200 {
            atomic.AddInt64(&allowed, 1)
        } else {
            atomic.AddInt64(&denied, 1)
        }
    }(sidecars[i%2])
}
wg.Wait()
// Runtime result: allowed=10, denied=50`}</RLSourceExcerpt>

        <h2 className="guide-sub-heading" id="rationale">Design Rationale</h2>
        <ul className="guide-bullets-list">
          <li><strong>Centralized state over partitioned quotas:</strong> Hard-allocating capacity/N to each replica fails under uneven load distribution. One shared counter enforces the true global limit.</li>
          <li><strong>Master-only reads for quota:</strong> Reading token counts from Redis replicas risks stale "allowed" responses. All quota EVALSHA calls go to the master.</li>
          <li><strong>Process-local caches are denial-only:</strong> Caching "allowed" locally would cause over-admission. Only denials (which are safe to repeat) are cached.</li>
        </ul>

        <h2 className="guide-sub-heading" id="alternatives">Alternatives Considered</h2>
        <ul className="guide-bullets-list">
          <li><strong>Per-replica token allocation:</strong> Divide global limit by replica count. Rejected — uneven traffic causes false denials and over-admission simultaneously.</li>
          <li><strong>Gossip-based approximate counters:</strong> Replicas sync counts periodically. Rejected — approximation window permits burst over-admission.</li>
          <li><strong>Sticky sessions to one limiter:</strong> Route all requests for a user to one replica. Rejected — load balancer stickiness breaks on replica failure and does not survive autoscaling events.</li>
        </ul>

        <h2 className="guide-sub-heading" id="limitations">Limitations</h2>
        <RLCallout variant="limitation" title="Documented constraints">
          <ul style={{ margin: "8px 0 0 0", paddingLeft: 16 }}>
            <li>Correctness depends on Redis master availability. During failover (~1–30s), checks fail closed (503) rather than over-admit.</li>
            <li>Singleflight on one replica may cause all waiters to share one "allowed" result — effective per-user quota under extreme single-replica concurrency can slightly exceed configured limits until Redis serializes subsequent checks.</li>
            <li>Multi-replica test verified burst correctness, not sustained multi-hour soak under churning key populations.</li>
            <li>Denial cache (1 second TTL) means replica 2 may send redundant Redis calls during the cache miss window on replica 1 — a performance concern, not a correctness one.</li>
          </ul>
        </RLCallout>

        <RLRelatedPages pages={[
          { slug: "multi-replica-verification", section: "correctness-and-verification", title: "Multi-Replica Verification", note: "full test topology and methodology" },
          { slug: "denial-cache-and-singleflight", section: "resilience", title: "Denial Cache & Singleflight", note: "process-local optimization boundaries" },
          { slug: "redis-and-sentinel-ha", section: "production-engineering", title: "Redis & Sentinel HA", note: "master-only quota reads" }
        ]} />
      </div>
    )
  },

  "configuration-overrides": {
    title: "Configuration Overrides",
    topics: [
      { label: "Dynamic Overrides Flow", href: "#override-flow" },
      { label: "Monotonic Version Invalidation", href: "#version-invalidation" },
      { label: "RefreshGeneration", href: "#refresh-generation" },
      { label: "Fallback Behaviors", href: "#fallback" },
      { label: "Design Rationale", href: "#rationale" },
      { label: "Alternatives Considered", href: "#alternatives" },
      { label: "Limitations", href: "#limitations" }
    ],
    content: (
      <div>
        <RLThesis>
          Rate limits can be changed at runtime without process restarts. Admin writes land in Redis hashes and atomically increment a monotonic generation counter. Each limiter replica calls RefreshGeneration before hierarchical checks, invalidating stale local caches when the generation has advanced.
        </RLThesis>

        <RLQuickModel>
          Admin API writes override → Redis pipeline sets config hash + INCR config:generation. Limiter compares local generation snapshot to Redis on each check. Match → serve from cache. Mismatch → flush cache, fetch fresh overrides on demand.
        </RLQuickModel>

        <h2 className="guide-sub-heading" id="override-flow">Dynamic Overrides Flow</h2>
        <p>
          Admin overrides are written to Redis hashes (<code>config:{"{level}"}:{"{id}"}</code>) via the Admin API (:8082). Each hash stores <code>capacity</code> and <code>refill_rate</code> fields that the limiter prefers over static environment defaults.
        </p>
        <div style={{ overflowX: "auto", margin: "16px 0" }}>
          <table className="guide-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #27272a", textAlign: "left" }}>
                <th style={{ padding: "10px 8px" }}>Level</th>
                <th style={{ padding: "10px 8px" }}>Admin API</th>
                <th style={{ padding: "10px 8px" }}>Redis Key</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Global", "POST /admin/limits/global/default", "config:global:default"],
                ["Tenant", "POST /admin/limits/tenant/{id}", "config:tenant:{id}"],
                ["User", "POST /admin/limits/user/{id}", "config:user:{id}"],
                ["Endpoint", "POST /admin/limits/endpoint/{tenantID}:{path}", "config:endpoint:{tenantID}:{path}"]
              ].map(([level, api, key]) => (
                <tr key={level} style={{ borderBottom: "1px solid #27272a" }}>
                  <td style={{ padding: "10px 8px", fontWeight: "bold" }}>{level}</td>
                  <td style={{ padding: "10px 8px", fontFamily: "monospace", fontSize: 12 }}>{api}</td>
                  <td style={{ padding: "10px 8px", fontFamily: "monospace", fontSize: 12, color: "#c084fc" }}>{key}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="guide-sub-heading" id="version-invalidation">Monotonic Version Invalidation</h2>
        <p>
          Polling Redis on every override lookup adds latency. Pub/Sub risks missed messages if a replica is temporarily offline. The override store uses a monotonic generation counter instead:
        </p>
        <ol className="guide-bullets-list" style={{ listStyleType: "decimal" }}>
          <li>A single key <code>config:generation</code> tracks the global configuration version.</li>
          <li>On every admin write, the system updates the override hash and INCRs <code>config:generation</code> atomically in a Redis pipeline.</li>
          <li>Limiter replicas cache overrides in memory with a local generation snapshot.</li>
          <li>When the remote generation exceeds the local snapshot, the entire override cache is invalidated and fresh values are fetched on the next lookup.</li>
        </ol>

        <RLSourceExcerpt
          source="internal/override/store.go — admin write pipeline"
          language="go"
          establishes="Admin writes atomically persist override hash and increment config:generation in one pipeline."
        >{`func (s *Store) WriteOverride(ctx context.Context, level, id string, cfg Override) error {
    key := fmt.Sprintf("config:%s:%s", level, id)
    pipe := s.rdb.Pipeline()
    pipe.HSet(ctx, key, "capacity", cfg.Capacity, "refill_rate", cfg.RefillRate)
    pipe.Incr(ctx, "config:generation")   // monotonic invalidation signal
    _, err := pipe.Exec(ctx)
    return err
}`}</RLSourceExcerpt>

        <h2 className="guide-sub-heading" id="refresh-generation">RefreshGeneration</h2>
        <p>
          Before each hierarchical check, the limiter calls <code>RefreshGeneration()</code> to compare its local generation snapshot against Redis. This is a single GET on <code>config:generation</code> — typically sub-millisecond when not invalidated.
        </p>

        <RLSourceExcerpt
          source="internal/override/store.go — RefreshGeneration"
          language="go"
          establishes="Called before every hierarchical check; mismatch triggers full local cache invalidation."
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
}

// Called at the start of AllowWithParams (hierarchical check):
func (l *HierarchicalLimiter) AllowWithParams(ctx context.Context, levels []LevelConfig) (Result, error) {
    _ = l.overrides.RefreshGeneration(ctx)
    // resolve capacities/rates from override cache or env defaults
    ...
}`}</RLSourceExcerpt>

        <h2 className="guide-sub-heading" id="fallback">Fallback Behaviors</h2>
        <ul className="guide-bullets-list">
          <li><strong>Generation GET failure:</strong> If Redis times out fetching <code>config:generation</code>, the limiter continues using cached override values until <code>OVERRIDE_CACHE_TTL_MS</code> (default 5000ms) expires, bounding staleness.</li>
          <li><strong>Override hash miss:</strong> If no override exists for a level, environment defaults from <code>CAPACITY</code> and <code>REFILL_RATE</code> are used.</li>
          <li><strong>Manual invalidation:</strong> Operators can force global cache flush by incrementing generation directly: <code>redis-cli INCR config:generation</code>.</li>
        </ul>

        <h2 className="guide-sub-heading" id="rationale">Design Rationale</h2>
        <ul className="guide-bullets-list">
          <li><strong>Generation over Pub/Sub:</strong> Pub/Sub is fire-and-forget. A replica that misses the message permanently drifts. Generation comparison is pull-based and self-healing on recovery.</li>
          <li><strong>Pipeline write + INCR:</strong> Atomic pipeline ensures no replica observes a new override hash with a stale generation counter.</li>
          <li><strong>Per-check RefreshGeneration:</strong> Called on every hierarchical check, not on a timer. This bounds propagation delay to one request latency rather than OVERRIDE_CACHE_TTL_MS when generation changes.</li>
          <li><strong>Local cache with TTL backstop:</strong> Even if generation checks fail, OVERRIDE_CACHE_TTL_MS ensures overrides cannot be stale indefinitely.</li>
        </ul>

        <h2 className="guide-sub-heading" id="alternatives">Alternatives Considered</h2>
        <ul className="guide-bullets-list">
          <li><strong>Redis Pub/Sub invalidation:</strong> Instant propagation when connected, but missed messages during partitions cause permanent drift. Rejected.</li>
          <li><strong>Poll-all-overrides on every check:</strong> Reads four config hashes per request. Rejected — 4× Redis reads on hot path; generation check is one GET.</li>
          <li><strong>Config reload via SIGHUP:</strong> Requires process restart or signal handling per replica. Rejected — no runtime flexibility for operators.</li>
          <li><strong>etcd / Consul watch:</strong> External coordination service. Rejected — adds deployment dependency when Redis already stores state.</li>
        </ul>

        <h2 className="guide-sub-heading" id="limitations">Limitations</h2>
        <RLCallout variant="limitation" title="Documented constraints">
          <ul style={{ margin: "8px 0 0 0", paddingLeft: 16 }}>
            <li>Override propagation is eventually consistent. Worst case: OVERRIDE_CACHE_TTL_MS (5s) if generation check fails silently.</li>
            <li>Generation is global — any override write at any level invalidates the entire local cache, not just the changed level. Simple but coarse.</li>
            <li>Admin API (:8082) is a separate service boundary — its availability does not affect rate checking, but override writes require it to be reachable.</li>
            <li>Deleting an override reverts to env defaults only after cache invalidation propagates.</li>
          </ul>
        </RLCallout>

        <RLRelatedPages pages={[
          { slug: "hierarchical-quotas", section: "rate-limiting-engine", title: "Hierarchical Quotas", note: "where resolved overrides feed into Lua ARGV" },
          { slug: "configuration-reference", section: "production-engineering", title: "Configuration Reference", note: "OVERRIDE_CACHE_TTL_MS and env defaults" },
          { slug: "major-design-decisions", section: "engineering-journal", title: "Major Design Decisions", note: "generation vs Pub/Sub trade-off journal entry" }
        ]} />
      </div>
    )
  }
};

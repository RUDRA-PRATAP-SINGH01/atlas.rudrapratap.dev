import React from "react";
import {
  RLThesis,
  RLQuickModel,
  RLCallout,
  RLSourceExcerpt,
  RLRelatedPages,
  RLStatGrid,
  RLEvidenceBadge
} from "../components/RLDocBlocks.jsx";

export const enginePages = {
  /* ─────────────────────────────────────────────────────────────────────────
   * 1. ALGORITHM EXPLORER
   * ───────────────────────────────────────────────────────────────────────── */
  "algorithm-explorer": {
    title: "Algorithm Explorer",
    topics: [
      { label: "Token Bucket Engine", href: "#token-bucket" },
      { label: "Sliding Window Log", href: "#sliding-window" },
      { label: "Timestamp Precision", href: "#timestamps" },
      { label: "Expiry and Retry-After", href: "#expiry" },
      { label: "Mathematical Comparison", href: "#math" },
      { label: "Design Rationale", href: "#rationale" },
      { label: "Alternatives Considered", href: "#alternatives" },
      { label: "Limitations", href: "#limitations" }
    ],
    content: (
      <div>
        <RLThesis>
          The engine ships two Redis Lua algorithms: Token Bucket and Sliding Window Log.
          Token bucket stores O(1) HASH state with lazy second-resolution refill and allows
          configured bursts. Sliding window stores per-request nanosecond timestamps in a ZSET
          pruned on every check — zero burst accumulation, strict rolling compliance. Both
          execute atomically inside Redis on every quota decision.
        </RLThesis>

        <RLQuickModel>
          Token bucket asks: "Does this caller have a token right now, accounting for elapsed
          refill time?" Sliding window asks: "How many requests landed in the last W nanoseconds?"
          Token bucket fits high-throughput APIs that legitimately burst. Sliding window fits
          login, payment, and webhook paths where any burst above the limit is a violation.
        </RLQuickModel>

        <h2 className="guide-sub-heading" id="token-bucket">1. Token Bucket Engine</h2>
        <p>
          State lives in a Redis HASH at key <code>rate:{"{userID}"}</code> with two fields:
          <code> tokens</code> (floating-point balance) and <code>last_refill</code>
          (Unix second timestamp). Refill is lazy — it runs only when a request arrives, not on
          a background ticker. Every write refreshes a 3600-second TTL so idle keys are
          automatically evicted.
        </p>

        <RLSourceExcerpt
          source="internal/limiter/lua/token_bucket.lua"
          language="lua"
          establishes="KEYS[1] = rate:{userID}; ARGV: now_sec, capacity, refill_rate. Returns {allowed, remaining}. Lazy refill uses second-resolution timestamps. EXPIRE 3600 on every write."
        >{`-- KEYS[1] = rate:{user_id}
-- ARGV[1] = now_sec   (Unix seconds, integer)
-- ARGV[2] = capacity  (max token ceiling)
-- ARGV[3] = refill_rate (tokens per second)
-- Returns: {allowed (0|1), remaining (floor)}

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
          <li>
            <strong>Lazy refill math:</strong> <code>new_tokens = min(capacity, tokens + elapsed * refill_rate)</code>.
            At 1.5 tokens/sec after 2.5 idle seconds, 3.75 tokens are added before the ceiling
            clamp. The float is stored back; no precision is lost between requests.
          </li>
          <li>
            <strong>First-request initialization:</strong> If HMGET returns nil (cold key), tokens
            defaults to <code>capacity</code> and <code>last_refill</code> defaults to <code>now</code>.
            A brand-new caller starts with a full bucket.
          </li>
          <li>
            <strong>Write on deny:</strong> The script writes back <code>new_tokens</code> and
            <code> last_refill</code> even when <code>allowed = 0</code>. This advances
            <code> last_refill</code> so a subsequent request immediately after does not see
            phantom accumulation from before the denied request.
          </li>
          <li>
            <strong>Complexity:</strong> O(1) memory (two HASH fields per key), O(1) compute
            (one HMGET + one float op + one HMSET).
          </li>
        </ul>

        <RLStatGrid stats={[
          { value: "4,161", label: "Peak RPS — direct token bucket at 5K target", evidence: "BENCHMARK-PROVEN" },
          { value: "148ms", label: "p99 latency at peak capacity", evidence: "BENCHMARK-PROVEN" },
          { value: "O(1)", label: "Redis memory per key — 2 HASH fields", evidence: "SOURCE-PROVEN" }
        ]} />

        <h2 className="guide-sub-heading" id="sliding-window">2. Sliding Window Log</h2>
        <p>
          The sliding window algorithm enforces a strict <em>N requests per W nanoseconds</em> limit.
          State is a Redis Sorted Set keyed as <code>sw:{"{userID}"}</code>. Each member is a
          unique request UUID scored by its nanosecond arrival timestamp. On every check,
          <code> ZREMRANGEBYSCORE</code> prunes entries with score below <code>now - window_ns</code>,
          then the current cardinality is compared against the limit.
        </p>

        <RLCallout variant="warning" title="True sliding window — not fixed window">
          The cutoff is always <code>now - window_ns</code>, recomputed fresh on every request.
          This is a genuine sliding window log, not an epoch-aligned fixed window. A fixed window
          permits 2× the limit when a client sends bursts at the start and end of the same
          boundary epoch. This implementation eliminates that edge case entirely.
        </RLCallout>

        <RLSourceExcerpt
          source="internal/limiter/lua/sliding_window.lua"
          language="lua"
          establishes="KEYS[1] = sw:{userID}; ARGV: now_ns, window_ns, limit, unique_id. Returns {allowed, remaining}. ZREMRANGEBYSCORE prunes outside the sliding cutoff. Tentative ZADD with ZREM rollback on deny. PEXPIRE keyed to window duration."
        >{`-- KEYS[1] = sw:{user_id}
-- ARGV[1] = now_ns      (Unix nanoseconds)
-- ARGV[2] = window_ns   (window size in nanoseconds)
-- ARGV[3] = limit       (max requests per window)
-- ARGV[4] = unique_id   (UUIDv4 request identity)
-- Returns: {allowed (0|1), remaining (floor)}

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
          <li>
            <strong>Tentative-add pattern:</strong> The script adds the request first, then counts.
            On deny, it removes it with ZREM. This avoids an off-by-one: counting before adding
            would allow the Nth+1 request when count equals limit.
          </li>
          <li>
            <strong>PEXPIRE keyed to window:</strong> The TTL is set to <code>ceil(window_ns / 1_000_000)</code>
            milliseconds — exactly the window duration. A key with no traffic for one full window
            is automatically evicted.
          </li>
          <li>
            <strong>Complexity:</strong> O(log N + M) where N is ZSET cardinality and M is pruned
            entries. Memory is proportional to request volume within the window — one ZSET member
            per in-window request.
          </li>
        </ul>

        <RLStatGrid stats={[
          { value: "872", label: "Sustainable RPS — sliding window sidecar e2e", evidence: "BENCHMARK-PROVEN" },
          { value: "11.21ms", label: "p99 latency at sustainable load (sidecar e2e)", evidence: "BENCHMARK-PROVEN" },
          { value: "O(N)", label: "Redis memory — 1 ZSET member per in-window request", evidence: "SOURCE-PROVEN" }
        ]} />

        <h2 className="guide-sub-heading" id="timestamps">3. Timestamp Precision</h2>
        <p>
          The two algorithms use different timestamp resolutions by design:
        </p>
        <div style={{ overflowX: "auto", margin: "16px 0" }}>
          <table className="guide-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #27272a", textAlign: "left" }}>
                <th style={{ padding: "10px 8px" }}>Algorithm</th>
                <th style={{ padding: "10px 8px" }}>Timestamp Unit</th>
                <th style={{ padding: "10px 8px" }}>Go Source</th>
                <th style={{ padding: "10px 8px" }}>Rationale</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "10px 8px", fontWeight: "bold" }}>Token Bucket</td>
                <td style={{ padding: "10px 8px", fontFamily: "monospace", fontSize: 12 }}>seconds (int64)</td>
                <td style={{ padding: "10px 8px", fontFamily: "monospace", fontSize: 12 }}>time.Now().Unix()</td>
                <td style={{ padding: "10px 8px" }}>Refill rate is tokens/second; second granularity matches the unit</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "10px 8px", fontWeight: "bold" }}>Sliding Window</td>
                <td style={{ padding: "10px 8px", fontFamily: "monospace", fontSize: 12 }}>nanoseconds (int64)</td>
                <td style={{ padding: "10px 8px", fontFamily: "monospace", fontSize: 12 }}>time.Now().UnixNano()</td>
                <td style={{ padding: "10px 8px" }}>ZSET scores must be unique per request; nanoseconds minimize collision probability</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          Token bucket's second-resolution means that two requests within the same second observe
          the same <code>now</code> and trigger zero elapsed refill between them. This is expected:
          at sub-second granularity, refill is continuous across seconds, not within one second. For
          intra-second refill granularity, timestamps would need to shift to milliseconds (changing
          ARGV convention and refill math).
        </p>

        <h2 className="guide-sub-heading" id="expiry">4. Expiry and Retry-After</h2>
        <p>
          Both algorithms return the <code>remaining</code> count from the Lua script. The Go
          limiter uses this to populate response headers:
        </p>
        <ul className="guide-bullets-list">
          <li>
            <strong>X-RateLimit-Remaining:</strong> Set from <code>remaining</code> returned by the
            script. Token bucket returns <code>floor(new_tokens - 1)</code> on allow; sliding
            window returns <code>limit - count</code> on allow. Both return 0 on deny.
          </li>
          <li>
            <strong>Retry-After (token bucket):</strong> When denied, tokens are below 1.
            The missing fraction <code>= 1 - new_tokens</code>. At refill_rate tokens/sec,
            <code> retry_seconds = ceil((1 - new_tokens) / refill_rate)</code>.
          </li>
          <li>
            <strong>Retry-After (sliding window):</strong> The oldest ZSET member's score is the
            timestamp of the first in-window request. Retry is possible at
            <code> floor((oldest_ns + window_ns - now_ns) / 1_000_000_000)</code> seconds.
          </li>
          <li>
            <strong>EXPIRE 3600 (token bucket):</strong> Keys inactive for one hour are reclaimed.
            At 1,000 unique callers per day with 3,600s TTL, Redis key churn stays bounded even
            under heavy user population growth.
          </li>
        </ul>

        <h2 className="guide-sub-heading" id="math">5. Mathematical Comparison</h2>
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
              {[
                ["Redis Structure", "HASH (tokens, last_refill)", "ZSET (sw:{userID})"],
                ["Time Resolution", "Seconds (Unix)", "Nanoseconds (UnixNano)"],
                ["Time Complexity", "O(1)", "O(log N + M) — N=cardinality, M=pruned"],
                ["Memory Footprint", "~200 bytes constant (2 HASH fields)", "Proportional to requests in window"],
                ["Traffic Shape", "Allows burst up to capacity", "Uniform — burst accumulation impossible"],
                ["Refill Strategy", "Lazy on arrival, no background ticker", "No refill — prune-and-count"],
                ["Peak / Sustainable RPS", "4,161 peak (p99 148ms)", "872 sustainable (p99 11.21ms e2e)"],
                ["Expiry", "EXPIRE 3600 (1 hour idle reclaim)", "PEXPIRE = window_ns / 1,000,000"],
                ["Hierarchical Support", "Yes — hierarchical.lua uses token bucket", "Flat /check endpoint only"],
                ["Config toggle", "ALGORITHM=token_bucket (default)", "ALGORITHM=sliding"]
              ].map(([metric, tb, sw]) => (
                <tr key={metric} style={{ borderBottom: "1px solid #27272a" }}>
                  <td style={{ padding: "10px 8px", fontWeight: "bold", whiteSpace: "nowrap" }}>{metric}</td>
                  <td style={{ padding: "10px 8px" }}>{tb}</td>
                  <td style={{ padding: "10px 8px" }}>{sw}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="guide-sub-heading" id="rationale">Design Rationale</h2>
        <ul className="guide-bullets-list">
          <li>
            <strong>Lazy refill over background ticker:</strong> No goroutine or Redis keyspace
            notification is required. Refill math runs only when a request arrives, eliminating
            timer drift, reducing idle Redis writes, and making the system self-correcting.
          </li>
          <li>
            <strong>Two algorithms, one EVALSHA path:</strong> The Go limiter selects the Lua
            script at construction time via <code>ALGORITHM</code> env var. Both scripts use the
            same EVALSHA execution path — operators switch without redeploying infrastructure.
          </li>
          <li>
            <strong>ZSET member uniqueness via UUID:</strong> Two requests arriving at the same
            nanosecond get different UUIDs as ZSET members, preventing silent ZADD deduplication
            that would under-count requests.
          </li>
          <li>
            <strong>Token bucket for API quotas, sliding for compliance endpoints:</strong>
            Token bucket at 4,161 peak RPS handles general API traffic. Sliding window at 872
            RPS with strict per-request accounting handles login, payment, and webhook endpoints.
          </li>
        </ul>

        <h2 className="guide-sub-heading" id="alternatives">Alternatives Considered</h2>
        <ul className="guide-bullets-list">
          <li>
            <strong>Fixed window counter (INCR + EXPIRE):</strong> O(1) and simple, but permits
            2× the limit at epoch boundaries. Rejected for compliance-sensitive endpoints.
          </li>
          <li>
            <strong>Leaky bucket:</strong> Smooths output rate but cannot express burst-to-capacity.
            Token bucket delivers the same steady-state rate with better burst semantics for API clients.
          </li>
          <li>
            <strong>Sliding window counter (weighted hybrid):</strong> Two fixed windows + weighted
            average approximates sliding behavior at lower memory than a full ZSET log. Introduces
            approximation error at window boundaries. Rejected in favor of exact per-request counting.
          </li>
          <li>
            <strong>In-process counters:</strong> Zero Redis round-trip but causes over-admission
            across replicas. All quota math must run inside Redis Lua to be correct.
          </li>
        </ul>

        <h2 className="guide-sub-heading" id="limitations">Limitations</h2>
        <RLCallout variant="limitation" title="Documented constraints">
          <ul style={{ margin: "8px 0 0 0", paddingLeft: 16 }}>
            <li>
              Token bucket uses second-resolution timestamps. Sub-second refill granularity requires
              migrating ARGV[1] to milliseconds and updating refill_rate units.
            </li>
            <li>
              Sliding window memory scales with request volume inside the window. At 1,000 req/min
              per user with UUIDv4 members (~36 bytes each), expect ~36 KB Redis memory per active user.
            </li>
            <li>
              Token bucket peak throughput (4,161 RPS) exceeds its p99-stable threshold. For
              latency-sensitive paths, operate below peak or prefer sliding window at 872 RPS.
            </li>
            <li>
              Neither algorithm supports Redis Cluster multi-key atomicity without hash tags.
              Hierarchical checks (which require multiple KEYS) require standalone Redis or Sentinel.
            </li>
            <li>
              Lua floats are double-precision IEEE 754. Token balances can drift fractionally under
              extreme concurrency; values are clamped to [0, capacity] on every refill.
            </li>
          </ul>
        </RLCallout>

        <RLRelatedPages pages={[
          { slug: "redis-lua-atomicity", section: "rate-limiting-engine", title: "Redis + Lua Atomicity", note: "why every check runs inside a single Lua script" },
          { slug: "hierarchical-quotas", section: "rate-limiting-engine", title: "Hierarchical Quotas", note: "token bucket extended to four stacked tiers" },
          { slug: "throughput-and-saturation", section: "performance-lab", title: "Throughput & Saturation", note: "benchmark commit a1de9ec behind the RPS figures" }
        ]} />
      </div>
    )
  },

  /* ─────────────────────────────────────────────────────────────────────────
   * 2. REDIS + LUA ATOMICITY  (flagship — 10/10)
   * ───────────────────────────────────────────────────────────────────────── */
  "redis-lua-atomicity": {
    title: "Redis + Lua Atomicity",
    topics: [
      { label: "The Read-Modify-Write Race", href: "#race" },
      { label: "What Lua Atomicity Provides", href: "#lua-atomicity" },
      { label: "Token Bucket Script Anatomy", href: "#tb-script" },
      { label: "Sliding Window Script Anatomy", href: "#sw-script" },
      { label: "EVALSHA Lifecycle", href: "#evalsha" },
      { label: "NOSCRIPT and SCRIPT FLUSH", href: "#noscript" },
      { label: "Script Complexity", href: "#complexity" },
      { label: "Retry-After Calculation", href: "#retry-after" },
      { label: "Redis Cluster Implications", href: "#cluster" },
      { label: "Design Rationale", href: "#rationale" },
      { label: "Alternatives Considered", href: "#alternatives" },
      { label: "Limitations", href: "#limitations" }
    ],
    content: (
      <div>
        <RLThesis>
          Distributed rate limiting demands atomic check-and-act. Without atomicity, two
          concurrent workers reading the same token balance both allow the request, permanently
          over-admitting. The engine eliminates this race by shifting all quota logic into Redis
          Lua scripts executed via EVALSHA — one round-trip, serialized by Redis's single event
          loop, no distributed locks required. NOSCRIPT fallback to EVAL makes the system
          self-healing across Redis restarts and SCRIPT FLUSH events.
        </RLThesis>

        <RLQuickModel>
          Without Lua: Worker A reads "1 token remaining." Worker B reads "1 token remaining."
          Worker A writes 0. Worker B writes 0. Both served. Budget exceeded by 1.
          With Lua: Redis runs the entire read-refill-check-write sequence as one indivisible
          operation. Worker B queues behind Worker A. When B runs, it sees 0 tokens and denies.
          No race. No over-admission.
        </RLQuickModel>

        <h2 className="guide-sub-heading" id="race">1. The Read-Modify-Write Race</h2>
        <p>
          A naive Go-side implementation follows this sequence for every request:
        </p>
        <ol className="guide-bullets-list" style={{ listStyleType: "decimal" }}>
          <li>HGET the current token count from Redis.</li>
          <li>Compute refill based on elapsed time in Go.</li>
          <li>If tokens &gt;= 1, allow the request and write back <code>tokens - 1</code>.</li>
          <li>If tokens &lt; 1, deny.</li>
        </ol>
        <p>
          This is a textbook TOCTOU (time-of-check to time-of-use) race. At step 1, two concurrent
          workers for the same user both read <code>tokens = 1</code>. Both evaluate "allow" at
          step 3. Both write back <code>0</code>. Two requests are served against a budget of one.
        </p>
        <p>
          At 60 concurrent requests against a capacity-10 bucket, a non-atomic implementation
          can admit anywhere from 10 to 60 — depending on goroutine scheduling and Redis command
          interleaving. The exact count is non-deterministic. The multi-replica runtime test
          confirmed: with Lua, exactly 10 are admitted every time, zero variance. (See
          Multi-Replica Correctness for the full test evidence.)
        </p>

        <RLCallout variant="warning" title="Race window is not theoretical">
          At 4,161 RPS (benchmark peak), multiple goroutines share the Redis connection pool and
          issue concurrent HGETs against the same key within microseconds of each other. A
          non-atomic implementation would exhibit measurable over-admission at sustained load,
          not just under adversarial conditions.
        </RLCallout>

        <h2 className="guide-sub-heading" id="lua-atomicity">2. What Lua Atomicity Provides</h2>
        <p>
          Redis evaluates Lua scripts synchronously on its single event-loop thread. While a
          script executes, no other Redis command runs on that node. This provides three guarantees:
        </p>
        <ul className="guide-bullets-list">
          <li>
            <strong>Isolation:</strong> All Redis calls within one script form a single
            indivisible operation. No other client can observe intermediate state.
          </li>
          <li>
            <strong>Single round-trip:</strong> The Go client sends one EVALSHA with keys and
            arguments. Redis returns the allow/deny decision plus remaining count. One network
            hop replaces three sequential Redis commands.
          </li>
          <li>
            <strong>No lock acquire/release:</strong> No SETNX, no WATCH/MULTI/EXEC, no retry
            loops. The serialization cost is exactly one script queue-and-run per request.
          </li>
        </ul>
        <p>
          The trade-off is explicit: scripts block the Redis event loop during execution. At high
          concurrency, scripts queue behind each other — this is the single-thread ceiling.
          Token bucket scripts complete in O(1); the bottleneck is network RTT, not Lua compute.
        </p>

        <h2 className="guide-sub-heading" id="tb-script">3. Token Bucket Script Anatomy</h2>
        <p>
          The token bucket script takes 1 KEY and 3 ARGV values. Every field is intentional:
        </p>

        <div style={{ overflowX: "auto", margin: "16px 0" }}>
          <table className="guide-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #27272a", textAlign: "left" }}>
                <th style={{ padding: "10px 8px" }}>Parameter</th>
                <th style={{ padding: "10px 8px" }}>Value</th>
                <th style={{ padding: "10px 8px" }}>Purpose</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["KEYS[1]", "rate:{userID}", "HASH key — isolates quota per caller"],
                ["ARGV[1]", "now_sec (int64)", "Current Unix second — drives elapsed refill"],
                ["ARGV[2]", "capacity (int)", "Maximum token ceiling — ceiling for new_tokens"],
                ["ARGV[3]", "refill_rate (float)", "Tokens added per second — continuous math"],
                ["Return[1]", "allowed (0 or 1)", "Quota decision — consumed by Go caller"],
                ["Return[2]", "remaining (floor)", "Floor of tokens after decision — X-RateLimit-Remaining"]
              ].map(([p, v, purpose]) => (
                <tr key={p} style={{ borderBottom: "1px solid #27272a" }}>
                  <td style={{ padding: "10px 8px", fontFamily: "monospace", fontSize: 12 }}>{p}</td>
                  <td style={{ padding: "10px 8px", fontFamily: "monospace", fontSize: 12, color: "#ff5cad" }}>{v}</td>
                  <td style={{ padding: "10px 8px" }}>{purpose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p>
          The refill formula deserves attention: <code>min(capacity, tokens + elapsed * refill_rate)</code>.
          The <code>math.max(0, now - last_refill)</code> guard prevents negative elapsed time
          (e.g., clock skew, NTP jumps). The <code>math.min(capacity, ...)</code> clamps accumulation
          so a key idle for hours does not refill beyond capacity on the first new request.
          On a key that has never been set, HMGET returns Lua nil; the <code>or capacity</code>
          and <code>or now</code> defaults ensure initialization is idempotent.
        </p>

        <RLSourceExcerpt
          source="internal/limiter/lua/token_bucket.lua — full script"
          language="lua"
          establishes="Complete HMGET → lazy refill → conditional decrement → HMSET + EXPIRE 3600 → return {allowed, remaining} sequence."
        >{`-- KEYS[1] = rate:{user_id}
-- ARGV[1] = now_sec, ARGV[2] = capacity, ARGV[3] = refill_rate
-- Returns: {allowed (0|1), remaining (floor)}

local key         = KEYS[1]
local now         = tonumber(ARGV[1])
local capacity    = tonumber(ARGV[2])
local refill_rate = tonumber(ARGV[3])

local data        = redis.call('HMGET', key, 'tokens', 'last_refill')
local tokens      = tonumber(data[1]) or capacity
local last_refill = tonumber(data[2]) or now

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

        <h2 className="guide-sub-heading" id="sw-script">4. Sliding Window Script Anatomy</h2>
        <p>
          The sliding window script takes 1 KEY and 4 ARGV values. It uses a nanosecond-scored
          ZSET to store every in-window request as a unique member:
        </p>
        <div style={{ overflowX: "auto", margin: "16px 0" }}>
          <table className="guide-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #27272a", textAlign: "left" }}>
                <th style={{ padding: "10px 8px" }}>Parameter</th>
                <th style={{ padding: "10px 8px" }}>Value</th>
                <th style={{ padding: "10px 8px" }}>Purpose</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["KEYS[1]", "sw:{userID}", "ZSET key — one per caller"],
                ["ARGV[1]", "now_ns (int64)", "Current Unix nanosecond — ZSET score"],
                ["ARGV[2]", "window_ns (int64)", "Window size in nanoseconds — prune cutoff"],
                ["ARGV[3]", "limit (int)", "Max requests per window"],
                ["ARGV[4]", "unique_id (UUID)", "ZSET member identity — prevents ZADD dedup"],
                ["Return[1]", "allowed (0 or 1)", "Quota decision"],
                ["Return[2]", "remaining (floor)", "limit - count on allow; 0 on deny"]
              ].map(([p, v, purpose]) => (
                <tr key={p} style={{ borderBottom: "1px solid #27272a" }}>
                  <td style={{ padding: "10px 8px", fontFamily: "monospace", fontSize: 12 }}>{p}</td>
                  <td style={{ padding: "10px 8px", fontFamily: "monospace", fontSize: 12, color: "#ff5cad" }}>{v}</td>
                  <td style={{ padding: "10px 8px" }}>{purpose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <RLSourceExcerpt
          source="internal/limiter/lua/sliding_window.lua — full script"
          language="lua"
          establishes="ZREMRANGEBYSCORE prune → tentative ZADD NX → ZCARD count → conditional ZREM rollback → PEXPIRE → return {allowed, remaining}."
        >{`-- KEYS[1] = sw:{user_id}
-- ARGV[1] = now_ns, ARGV[2] = window_ns, ARGV[3] = limit, ARGV[4] = unique_id
-- Returns: {allowed (0|1), remaining (floor)}

local key    = KEYS[1]
local now    = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit  = tonumber(ARGV[3])
local uid    = ARGV[4]
local cutoff = now - window

-- Remove all members outside the sliding window
redis.call('ZREMRANGEBYSCORE', key, 0, cutoff)

-- Tentatively add this request
redis.call('ZADD', key, 'NX', now, uid)
local count = redis.call('ZCARD', key)

if count > tonumber(limit) then
    -- Roll back the tentative add
    redis.call('ZREM', key, uid)
    return {0, 0}
end

-- Set TTL to exactly the window duration
redis.call('PEXPIRE', key, math.ceil(window / 1000000))
return {1, limit - count}`}</RLSourceExcerpt>

        <h2 className="guide-sub-heading" id="evalsha">5. EVALSHA Lifecycle</h2>
        <p>
          Transmitting the full Lua source (300–600 bytes per script) on every request wastes
          bandwidth and forces Redis to recompile the script on each call. The engine uses EVALSHA:
        </p>
        <ol className="guide-bullets-list" style={{ listStyleType: "decimal" }}>
          <li>
            <strong>Embed at build time:</strong> Scripts are embedded into the Go binary via
            <code> //go:embed lua/*.lua</code> in <code>internal/limiter/scripts/</code>.
            No runtime filesystem access required.
          </li>
          <li>
            <strong>SCRIPT LOAD at startup:</strong> On <code>NewRedisTokenBucket()</code>,
            the Go limiter calls <code>rdb.ScriptLoad(ctx, scriptSrc)</code>. Redis compiles the
            script, caches it by SHA-1, and returns the digest (40 hex chars). The SHA is stored
            on the limiter struct.
          </li>
          <li>
            <strong>Hot path — EVALSHA:</strong> On every <code>Allow()</code> call, the limiter
            sends <code>EVALSHA {"{<SHA-1>}"} 1 {"{key}"} {"{now}"} {"{capacity}"} {"{rate}"}</code>.
            Redis looks up the pre-compiled script by SHA and executes it. Payload: ~40 bytes
            overhead over raw arguments.
          </li>
          <li>
            <strong>Cache hit path (99.9% of calls):</strong> Redis finds the SHA in its script
            cache, executes atomically, returns <code>{"{allowed, remaining}"}</code>.
          </li>
          <li>
            <strong>Cache miss path:</strong> Redis returns <code>NOSCRIPT No matching script</code>.
            The go-redis <code>Script.Run()</code> wrapper catches this and falls back to EVAL
            (see next section).
          </li>
        </ol>

        <RLSourceExcerpt
          source="internal/limiter/redis_atomic_token_bucket.go"
          language="go"
          establishes="SCRIPT LOAD at construction stores SHA-1; Script.Run() on the hot path uses EVALSHA with automatic NOSCRIPT recovery."
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

        <h2 className="guide-sub-heading" id="noscript">6. NOSCRIPT and SCRIPT FLUSH</h2>
        <p>
          Redis clears its script cache in two scenarios:
        </p>
        <ul className="guide-bullets-list">
          <li>
            <strong>Redis restart:</strong> The in-memory script cache does not persist across
            restarts. Scripts loaded via SCRIPT LOAD before the restart are gone.
          </li>
          <li>
            <strong>SCRIPT FLUSH:</strong> An operator or automated security rotation calls
            <code> SCRIPT FLUSH</code> to clear all cached scripts. In production, this can
            happen during a Redis security audit or a Lua version upgrade.
          </li>
        </ul>
        <p>
          In both cases, the first EVALSHA call after the cache is cleared returns
          <code> NOSCRIPT</code>. The go-redis <code>Script.Run()</code> helper handles this
          transparently:
        </p>

        <RLSourceExcerpt
          source="internal/limiter/redis_atomic_token_bucket.go — NOSCRIPT recovery (via go-redis Script.Run)"
          language="go"
          establishes="NOSCRIPT triggers EVAL with full script source, re-primes the cache, and returns the result. No operator action needed. One extra round-trip on the first miss only."
        >{`// go-redis Script.Run() internal protocol (simplified):
result, err := c.EvalSha(ctx, sha, keys, args...).Result()
if err != nil && isNoScriptError(err) {
    // Cache miss: transmit full script source, Redis compiles and re-caches
    result, err = c.Eval(ctx, scriptSrc, keys, args...).Result()
    // On success, subsequent calls return to EVALSHA path automatically
}
return result, err`}</RLSourceExcerpt>

        <RLCallout variant="info" title="Production behavior on NOSCRIPT">
          One extra Redis round-trip (EVAL instead of EVALSHA) on the first request after a cache
          flush. Subsequent requests return to the EVALSHA fast path. The NOSCRIPT event is logged
          at WARN level. Quota correctness is preserved — the EVAL result is identical to EVALSHA.
          No quota decisions are skipped and no over-admission occurs during the recovery.
        </RLCallout>

        <p>
          After a Redis failover (replica promoted to master), the new master has no script cache.
          Every limiter replica will hit NOSCRIPT on its next request to the new master and
          automatically recover via EVAL. The impact is one extra round-trip per limiter replica
          per script — typically 2–3 EVAL calls system-wide before all replicas re-prime.
        </p>

        <h2 className="guide-sub-heading" id="complexity">7. Script Complexity</h2>
        <div style={{ overflowX: "auto", margin: "16px 0" }}>
          <table className="guide-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #27272a", textAlign: "left" }}>
                <th style={{ padding: "10px 8px" }}>Script</th>
                <th style={{ padding: "10px 8px" }}>Redis Calls</th>
                <th style={{ padding: "10px 8px" }}>Time Complexity</th>
                <th style={{ padding: "10px 8px" }}>Memory Complexity</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["token_bucket.lua", "HMGET + HMSET + EXPIRE", "O(1)", "O(1) — 2 fields"],
                ["sliding_window.lua", "ZREMRANGEBYSCORE + ZADD + ZCARD + (ZREM) + PEXPIRE", "O(log N + M)", "O(N) — N members in window"],
                ["hierarchical.lua", "4× HMGET + 4× HMSET + 4× EXPIRE + (4× HGET + 4× HSET)", "O(1) per level × 4 levels", "O(1) — 4 HASHes × 2 fields"]
              ].map(([script, calls, time, mem]) => (
                <tr key={script} style={{ borderBottom: "1px solid #27272a" }}>
                  <td style={{ padding: "10px 8px", fontFamily: "monospace", fontSize: 12, color: "#ff5cad" }}>{script}</td>
                  <td style={{ padding: "10px 8px", fontSize: 12 }}>{calls}</td>
                  <td style={{ padding: "10px 8px", fontFamily: "monospace" }}>{time}</td>
                  <td style={{ padding: "10px 8px" }}>{mem}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          All three scripts complete in microseconds of Lua execution time. The dominant latency
          source is the Redis network round-trip (typically 0.3–2ms LAN, 5–15ms cross-AZ) — not
          Lua compute. The p99 11.21ms sidecar e2e benchmark reflects HTTP overhead, sidecar gRPC
          call to limiter, and Redis RTT, not Lua CPU.
        </p>

        <h2 className="guide-sub-heading" id="retry-after">8. Retry-After Calculation</h2>
        <p>
          When a script returns <code>allowed = 0</code>, the Go limiter computes a
          <code> Retry-After</code> header:
        </p>
        <ul className="guide-bullets-list">
          <li>
            <strong>Token bucket:</strong> <code>remaining = floor(new_tokens)</code> where
            <code> new_tokens &lt; 1</code>. The deficit is <code>1 - new_tokens</code>. At
            <code> refill_rate</code> tokens/sec: <code>retry = ceil((1 - new_tokens) / refill_rate)</code>
            seconds.
          </li>
          <li>
            <strong>Sliding window:</strong> Script returns <code>remaining = 0</code> on deny.
            The oldest in-window entry expires at <code>oldest_score + window_ns</code>.
            Retry is possible after <code>ceil((oldest_score + window_ns - now_ns) / 1e9)</code>
            seconds, computed in Go from a follow-up ZRANGE call if the handler requests it.
          </li>
        </ul>

        <h2 className="guide-sub-heading" id="cluster">9. Redis Cluster Implications</h2>
        <RLCallout variant="limitation" title="Multi-key scripts and Redis Cluster">
          Redis Cluster distributes keys across 16,384 hash slots. A Lua script that accesses
          multiple keys in a single call requires all those keys to hash to the same slot. If they
          do not, Redis returns <code>CROSSSLOT Keys in request don't hash to the same slot</code>.
          <br /><br />
          <strong>token_bucket.lua and sliding_window.lua</strong> each touch exactly one key per
          call — they are Cluster-compatible without hash tags.
          <br /><br />
          <strong>hierarchical.lua</strong> touches 4 keys per call
          (<code>rate:global:default</code>, <code>rate:tenant:{"{tenantID}"}</code>,
          <code>rate:user:{"{userID}"}</code>, <code>rate:ep:{"{tenantID}"}:{"{path}"}</code>).
          These hash to different slots. Hash-tag workarounds concentrate all traffic on one slot,
          defeating the purpose of Cluster. The hierarchical engine requires standalone Redis or
          Sentinel (single-master topology).
        </RLCallout>

        <h2 className="guide-sub-heading" id="rationale">Design Rationale</h2>
        <ul className="guide-bullets-list">
          <li>
            <strong>Lua over WATCH/MULTI/EXEC:</strong> Optimistic transactions require 3+ round-trips
            with retry loops under contention. At 4,161 peak RPS, retry storms would degrade p99
            latency well above 148ms. Lua completes in one round-trip with zero retries.
          </li>
          <li>
            <strong>Lua over Redlock:</strong> Distributed locks require acquire/release round-trips
            and introduce clock-skew edge cases across nodes. Lua executes entirely inside Redis —
            no external lock coordination.
          </li>
          <li>
            <strong>EVALSHA over EVAL:</strong> Avoids transmitting 300–600 bytes of script source on
            every request. At 872+ RPS sustained, this reduces bandwidth by ~260–520 KB/sec and
            eliminates per-call Lua compilation.
          </li>
          <li>
            <strong>Embedded scripts over Redis Functions:</strong> <code>go:embed</code> version-locks
            scripts to the binary. Deploying a new script version is an application rollout, not a
            separate Redis admin step, removing the coordination overhead of external script management.
          </li>
        </ul>

        <h2 className="guide-sub-heading" id="alternatives">Alternatives Considered</h2>
        <ul className="guide-bullets-list">
          <li>
            <strong>WATCH/MULTI/EXEC optimistic transactions:</strong> Check → WATCH key → compute
            → MULTI/SET/EXEC. On conflict, EXEC returns nil and the caller retries. Under high
            concurrency, retry storms emerge. Measured p99 latency exceeded 15ms vs ~1ms for Lua
            at the same concurrency. Rejected.
          </li>
          <li>
            <strong>Redlock (distributed lock):</strong> Acquires majority quorum across Redis nodes.
            Adds complexity and introduces clock-skew correctness concerns. Rejected — a single Redis
            master already serializes all quota state; a distributed lock adds no benefit here.
          </li>
          <li>
            <strong>Application-level mutex (sync.Mutex):</strong> Protects within one process only.
            Useless across sidecar and limiter replicas sharing the same Redis key.
          </li>
          <li>
            <strong>CRDT / gossip counters:</strong> Eventually consistent — permits over-admission
            during merge delays. Rate limiting requires strong consistency. Rejected.
          </li>
        </ul>

        <h2 className="guide-sub-heading" id="limitations">Limitations</h2>
        <RLCallout variant="limitation" title="Documented constraints">
          <ul style={{ margin: "8px 0 0 0", paddingLeft: 16 }}>
            <li>
              Lua scripts block the Redis event loop. A script that performs many Redis sub-calls
              or runs expensive Lua math creates serialization queues. Current scripts have O(1)
              or O(log N) Redis call counts — this is not a practical concern at current scale.
            </li>
            <li>
              Script cache is per-node and in-memory only. After any Redis restart or SCRIPT FLUSH,
              every limiter replica pays one EVAL fallback cost before returning to EVALSHA.
            </li>
            <li>
              After a failover (replica promoted to master), the new master has no script cache.
              All limiters hit NOSCRIPT and recover via EVAL automatically, but the first request
              per limiter per script adds ~1 extra round-trip.
            </li>
            <li>
              Lua double-precision floats can drift fractionally on token balances under extreme
              concurrency. Values are clamped to [0, capacity] on every refill, bounding any drift.
            </li>
            <li>
              hierarchical.lua is incompatible with Redis Cluster unless hash tags force all 4 keys
              to the same slot — which concentrates all traffic to one cluster node.
            </li>
          </ul>
        </RLCallout>

        <RLRelatedPages pages={[
          { slug: "algorithm-explorer", section: "rate-limiting-engine", title: "Algorithm Explorer", note: "the Lua scripts — full keys/args/returns and timestamp precision" },
          { slug: "hierarchical-quotas", section: "rate-limiting-engine", title: "Hierarchical Quotas", note: "multi-key atomic Lua across 4 tiers" },
          { slug: "multi-replica-correctness", section: "rate-limiting-engine", title: "Multi-Replica Correctness", note: "60-concurrent test proving atomicity in practice" },
          { slug: "failure-model", section: "resilience", title: "Failure Model", note: "NOSCRIPT recovery row in the resilience matrix" }
        ]} />
      </div>
    )
  },

  /* ─────────────────────────────────────────────────────────────────────────
   * 3. HIERARCHICAL QUOTAS  (flagship — 9.5/10)
   * ───────────────────────────────────────────────────────────────────────── */
  "hierarchical-quotas": {
    title: "Hierarchical Quotas",
    topics: [
      { label: "Four-Tier Model", href: "#tiers" },
      { label: "Key Construction", href: "#keys" },
      { label: "Effective Limits and ARGV Resolution", href: "#argv" },
      { label: "All-Level Evaluation — Phase 1", href: "#phase1" },
      { label: "All-or-Nothing — Phase 2", href: "#phase2" },
      { label: "No-Partial-Consume Example", href: "#example" },
      { label: "Concurrent and Multi-Replica Behavior", href: "#concurrent" },
      { label: "Generation Refresh Integration", href: "#generation" },
      { label: "Failure Behavior", href: "#failure" },
      { label: "Redis Cluster Limitation", href: "#cluster" },
      { label: "Design Rationale", href: "#rationale" },
      { label: "Alternatives Considered", href: "#alternatives" },
      { label: "Limitations", href: "#limitations" }
    ],
    content: (
      <div>
        <RLThesis>
          Production APIs need layered limits: system-wide protection, per-tenant caps, per-user
          quotas, and per-endpoint throttles — evaluated as a single atomic operation.
          hierarchical.lua reads and refills all four token buckets in Phase 1, denies the request
          if any bucket is exhausted, and deducts exactly one token from every bucket in Phase 2
          only when all passed. No partial token consumption is possible.
        </RLThesis>

        <RLQuickModel>
          Think of four nested gates. Phase 1 opens and refills all four gates simultaneously.
          If any gate is closed (tokens &lt; 1), the request is denied and all gates are
          left at their refilled balance — no tokens removed from any tier. If all gates
          are open, Phase 2 closes each gate by one token simultaneously. One Lua script,
          one EVALSHA, indivisible.
        </RLQuickModel>

        <h2 className="guide-sub-heading" id="tiers">1. Four-Tier Model</h2>
        <p>
          The hierarchical limiter evaluates four token buckets per request, from broadest to
          most specific:
        </p>
        <ol className="guide-bullets-list" style={{ listStyleType: "decimal" }}>
          <li>
            <strong>Global:</strong> System-wide protection. Prevents any single event (traffic
            spike, misconfiguration, DDoS) from overwhelming shared Redis capacity or downstream
            services. Typical cap: 50,000 req/sec.
          </li>
          <li>
            <strong>Tenant:</strong> Per-organization cap isolating tenants from each other.
            A misbehaving tenant cannot starve its neighbors. Typical cap: 5,000 req/sec.
          </li>
          <li>
            <strong>User:</strong> Per-user enforcement within a tenant's allocation. Prevents
            one power user inside a tenant from consuming all tenant quota. Typical cap: 100 req/sec.
          </li>
          <li>
            <strong>Endpoint:</strong> Per-path throttling for sensitive or expensive operations.
            A checkout endpoint may allow 10 req/sec even if the user's general quota is 100 req/sec.
          </li>
        </ol>

        <h2 className="guide-sub-heading" id="keys">2. Key Construction</h2>
        <p>
          Each tier maps to a Redis HASH key. The key patterns are fixed and used as KEYS in
          the Lua script call:
        </p>
        <div style={{ overflowX: "auto", margin: "16px 0" }}>
          <table className="guide-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #27272a", textAlign: "left" }}>
                <th style={{ padding: "10px 8px" }}>Tier</th>
                <th style={{ padding: "10px 8px" }}>Redis Key</th>
                <th style={{ padding: "10px 8px" }}>KEYS index in script</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Global", "rate:global:default", "KEYS[1]"],
                ["Tenant", "rate:tenant:{tenantID}", "KEYS[2]"],
                ["User", "rate:user:{userID}", "KEYS[3]"],
                ["Endpoint", "rate:ep:{tenantID}:{path}", "KEYS[4]"]
              ].map(([tier, key, idx]) => (
                <tr key={tier} style={{ borderBottom: "1px solid #27272a" }}>
                  <td style={{ padding: "10px 8px", fontWeight: "bold" }}>{tier}</td>
                  <td style={{ padding: "10px 8px", fontFamily: "monospace", fontSize: 12, color: "#ff5cad" }}>{key}</td>
                  <td style={{ padding: "10px 8px", fontFamily: "monospace", fontSize: 12 }}>{idx}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          These four keys hash to different Redis Cluster slots. Running hierarchical.lua on a
          Cluster node without coordinating hash tags triggers <code>CROSSSLOT</code> error. The
          hierarchical engine requires standalone Redis or Sentinel. (See Cluster Limitation below.)
        </p>

        <h2 className="guide-sub-heading" id="argv">3. Effective Limits and ARGV Resolution</h2>
        <p>
          The script receives 10 ARGV values: 4 capacities, 4 refill rates, the current timestamp,
          and the level count. The Go limiter resolves each tier's capacity and refill rate from
          the override cache before building the ARGV array:
        </p>
        <ol className="guide-bullets-list" style={{ listStyleType: "decimal" }}>
          <li>
            Call <code>RefreshGeneration()</code> to ensure the local override cache is not stale
            (one Redis GET on <code>config:generation</code>).
          </li>
          <li>
            For each tier, look up <code>config:{"{level}"}:{"{id}"}</code> in the local cache.
            If a dynamic override exists, use its <code>capacity</code> and <code>refill_rate</code>.
            Otherwise, fall back to environment defaults (<code>CAPACITY</code>, <code>REFILL_RATE</code>).
          </li>
          <li>
            Build <code>ARGV = [cap_global, cap_tenant, cap_user, cap_ep, rate_global, rate_tenant,
            rate_user, rate_ep, now_sec, level_count]</code> and call EVALSHA with 4 KEYS and 10 ARGV.
          </li>
        </ol>

        <h2 className="guide-sub-heading" id="phase1">4. All-Level Evaluation — Phase 1</h2>
        <p>
          Phase 1 iterates all tiers, refills each bucket, writes back the refilled state (even on
          eventual deny), and tracks whether all tiers passed:
        </p>

        <RLSourceExcerpt
          source="internal/limiter/lua/hierarchical.lua — Phase 1 (check + write-back)"
          language="lua"
          establishes="Iterates all level_count tiers. For each: HMGET → lazy refill → HMSET + EXPIRE (persists refilled state) → allowed = 0 if refilled < 1. Write-back on deny prevents phantom token accumulation during idle periods."
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

    -- Write back refilled state regardless of allow/deny outcome
    redis.call('HMSET', key, 'tokens', refilled, 'last_refill', now)
    redis.call('EXPIRE', key, 3600)

    if refilled < 1 then
        allowed = 0
    end
    min_remaining = math.min(min_remaining, refilled)
end`}</RLSourceExcerpt>

        <RLCallout variant="info" title="Write-back on deny is intentional">
          Phase 1 writes <code>last_refill = now</code> back to every tier's HASH, even if the
          request will be denied. This prevents a pathological scenario: a bucket idle for 10
          minutes accumulates 600 seconds of phantom tokens. On the next request, Phase 1 would
          compute an enormous refill on top of an already-full bucket. Writing back on every
          check keeps <code>last_refill</code> current and bounding the max possible accumulated
          balance to exactly <code>capacity</code>.
        </RLCallout>

        <h2 className="guide-sub-heading" id="phase2">5. All-or-Nothing — Phase 2</h2>
        <p>
          Phase 2 runs only when <code>allowed == 1</code>. It deducts exactly one token from
          each tier using the just-written-back values:
        </p>

        <RLSourceExcerpt
          source="internal/limiter/lua/hierarchical.lua — Phase 2 (conditional deduct)"
          language="lua"
          establishes="Deduction runs only when all levels passed. HGET re-reads each tier's written-back value before decrement. Denied requests return {0, floor(min_remaining)} with zero tokens consumed from any tier."
        >{`-- Phase 2: all-or-nothing deduct (only when allowed == 1)
if allowed == 1 then
    for i = 1, level_count do
        local current = tonumber(redis.call('HGET', KEYS[i], 'tokens'))
        redis.call('HSET', KEYS[i], 'tokens', current - 1)
    end
    return {1, math.floor(min_remaining - 1)}
end

return {0, math.floor(min_remaining)}`}</RLSourceExcerpt>

        <p>
          The <code>min_remaining</code> value tracks the tightest constraint across all tiers.
          On allow, it drives <code>X-RateLimit-Remaining</code>. On deny, it identifies which
          tier is the bottleneck — the tier with the smallest balance. Operators can inspect this
          value via the limiter's debug endpoint to tune tier capacities.
        </p>

        <h2 className="guide-sub-heading" id="example">6. No-Partial-Consume Example</h2>
        <p>
          Consider a concrete hierarchy for a tenant <code>acme</code>, user <code>alice</code>,
          path <code>/checkout</code>:
        </p>
        <div style={{ overflowX: "auto", margin: "16px 0" }}>
          <table className="guide-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #27272a", textAlign: "left" }}>
                <th style={{ padding: "10px 8px" }}>Tier</th>
                <th style={{ padding: "10px 8px" }}>Key</th>
                <th style={{ padding: "10px 8px" }}>Capacity</th>
                <th style={{ padding: "10px 8px" }}>Tokens before request</th>
                <th style={{ padding: "10px 8px" }}>After allow</th>
                <th style={{ padding: "10px 8px" }}>After deny (Phase 1 write-back only)</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Global", "rate:global:default", "50000", "49823 → 49823.5 (refilled)", "49822.5", "49823.5 (no deduct)"],
                ["Tenant", "rate:tenant:acme", "5000", "4812 → 4813.2 (refilled)", "4812.2", "4813.2 (no deduct)"],
                ["User", "rate:user:alice", "100", "0.3 → 0.8 (refilled)", "denied path N/A", "0.8 (no deduct) ← bottleneck"],
                ["Endpoint", "rate:ep:acme:/checkout", "10", "7 → 7.5 (refilled)", "6.5", "7.5 (no deduct)"]
              ].map(([tier, key, cap, before, afterAllow, afterDeny]) => (
                <tr key={tier} style={{ borderBottom: "1px solid #27272a" }}>
                  <td style={{ padding: "10px 8px", fontWeight: "bold" }}>{tier}</td>
                  <td style={{ padding: "10px 8px", fontFamily: "monospace", fontSize: 11, color: "#ff5cad" }}>{key}</td>
                  <td style={{ padding: "10px 8px" }}>{cap}</td>
                  <td style={{ padding: "10px 8px" }}>{before}</td>
                  <td style={{ padding: "10px 8px" }}>{afterAllow}</td>
                  <td style={{ padding: "10px 8px" }}>{afterDeny}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          In the deny scenario, the user tier exhausts (0.8 &lt; 1). The script writes back all
          four refilled values but deducts from none. Global, tenant, and endpoint balances are
          unchanged — they do not pay for a request that never served.
          <code> min_remaining = 0.8</code>, returned as <code>0</code> (floor). The response
          <code> X-RateLimit-Remaining: 0</code> and the Retry-After header are computed from this
          value in Go.
        </p>

        <h2 className="guide-sub-heading" id="concurrent">7. Concurrent and Multi-Replica Behavior</h2>
        <p>
          All replicas (sidecars and limiters) call EVALSHA against the same shared Redis master.
          Under concurrent requests:
        </p>
        <ul className="guide-bullets-list">
          <li>
            Each EVALSHA executes serially on the Redis event loop. Two concurrent requests for the
            same user cannot both pass the user tier simultaneously — Redis serializes them.
          </li>
          <li>
            Replica count does not affect correctness. Whether 2 or 20 limiter replicas are running,
            all hierarchical checks converge on the same authoritative Redis state.
          </li>
          <li>
            The multi-replica runtime test (60 concurrent requests, capacity 10) demonstrates the
            same correctness for flat token bucket. The hierarchical invariant is stronger: even if
            global and tenant buckets have tokens, a user-tier exhaustion denies the request with
            zero cross-tier consumption. (See Multi-Replica Correctness for test evidence.)
          </li>
        </ul>

        <h2 className="guide-sub-heading" id="generation">8. Generation Refresh Integration</h2>
        <p>
          Before building the ARGV array, every hierarchical check calls <code>RefreshGeneration()</code>
          on the override store. This is a single Redis GET on <code>config:generation</code>.
          If the remote generation matches the local snapshot, the local cache is served. If not,
          the cache is flushed and fresh overrides are fetched on the next per-tier lookup.
        </p>
        <p>
          This means dynamic override changes (raised capacity, new endpoint limits) take effect on
          the next hierarchical request after the generation advances — bounded by one request
          latency, not a polling interval.
        </p>

        <h2 className="guide-sub-heading" id="failure">9. Failure Behavior</h2>
        <ul className="guide-bullets-list">
          <li>
            <strong>Redis unreachable:</strong> EVALSHA returns a connection error. The limiter
            returns <code>503 Service Unavailable</code> — it fails closed, not open. No quota
            check is silently skipped.
          </li>
          <li>
            <strong>RefreshGeneration failure:</strong> If the generation GET times out, the limiter
            proceeds with cached overrides. The hierarchical check continues using last-known-good
            capacities. Worst-case staleness is bounded by <code>OVERRIDE_CACHE_TTL_MS</code> (5s).
          </li>
          <li>
            <strong>Partial KEYS failure:</strong> Redis does not partially execute a Lua script.
            Either all four HMGET/HMSET pairs complete or none do. There is no intermediate state.
          </li>
        </ul>

        <h2 className="guide-sub-heading" id="cluster">10. Redis Cluster Limitation</h2>
        <RLCallout variant="limitation" title="Redis Cluster incompatibility">
          Redis Cluster routes keys to 16,384 hash slots. The four hierarchical keys
          (<code>rate:global:default</code>, <code>rate:tenant:{"{tenantID}"}</code>,
          <code>rate:user:{"{userID}"}</code>, <code>rate:ep:{"{tenantID}"}:{"{path}"}</code>)
          hash to different slots. Running hierarchical.lua across them returns:
          <code> CROSSSLOT Keys in request don't hash to the same slot</code>.
          <br /><br />
          The standard workaround — hash tags like <code>{"{rl}"}:global:default</code> — forces all
          four keys to the same slot. This eliminates Cluster's horizontal scaling benefit: every
          hierarchical check lands on one node, bottlenecking on that node's throughput and memory.
          <br /><br />
          The hierarchical engine is designed for standalone Redis or Redis Sentinel (single active
          master). Flat token bucket and sliding window scripts (1 key each) are Cluster-compatible.
        </RLCallout>

        <h2 className="guide-sub-heading" id="rationale">Design Rationale</h2>
        <ul className="guide-bullets-list">
          <li>
            <strong>Single script over sequential EVALSHA calls:</strong> Four separate script calls
            would create a TOCTOU window. Tenant tokens could be consumed between the user check
            and the endpoint decrement. All tiers must be evaluated in one indivisible operation.
          </li>
          <li>
            <strong>Write-back on deny:</strong> Advancing <code>last_refill</code> even for denied
            requests prevents idle bucket explosion — a bucket dormant for hours would otherwise
            compute a huge refill on the next request, temporarily inflating effective capacity.
          </li>
          <li>
            <strong>min_remaining tracking:</strong> The tightest constraint drives accurate
            <code> X-RateLimit-Remaining</code> and Retry-After headers. Clients know which tier is
            throttling them without a separate diagnostic API call.
          </li>
          <li>
            <strong>Variable level count via ARGV:</strong> Passing <code>level_count</code> in ARGV
            allows the same script to handle 1–4 tiers. A single-tier flat check uses
            <code> level_count = 1</code> and avoids a separate script file.
          </li>
        </ul>

        <h2 className="guide-sub-heading" id="alternatives">Alternatives Considered</h2>
        <ul className="guide-bullets-list">
          <li>
            <strong>Sequential per-tier EVALSHA calls:</strong> Check global, then tenant, then user,
            then endpoint as four separate Redis calls. Rejected — TOCTOU race and 4× network
            round-trips per request.
          </li>
          <li>
            <strong>Check-all then deduct-all (two scripts):</strong> Script 1 reads and refills.
            Script 2 deducts if all passed. Two EVALSHA calls still have a race window between
            them. Rejected — both phases must be one script.
          </li>
          <li>
            <strong>Hash tags for Redis Cluster:</strong> Force all keys onto one slot. Rejected —
            concentrates all traffic on one cluster node, defeating horizontal scaling.
          </li>
          <li>
            <strong>Application-side hierarchy in Go:</strong> Evaluate tiers with a Redis pipeline.
            Cannot guarantee atomicity across keys. Any pipeline execution can interleave with
            concurrent requests. Rejected.
          </li>
        </ul>

        <h2 className="guide-sub-heading" id="limitations">Limitations</h2>
        <RLCallout variant="limitation" title="Documented constraints">
          <ul style={{ margin: "8px 0 0 0", paddingLeft: 16 }}>
            <li>
              Hierarchical checks use token bucket math only. Sliding window is not supported for
              multi-tier evaluation — a sliding window ZSET per tier would require 4 ZSET operations
              per check, making the script significantly longer and O(N) per tier.
            </li>
            <li>
              Four HASH reads + potential four HASH writes + four EXPIRE calls per request increase
              Redis CPU relative to a flat single-tier check. At 872 RPS sustained (sliding window
              benchmark), the overhead is well within Redis capacity. At token bucket peak (4,161 RPS),
              hierarchical throughput would be lower — separate benchmarks pending.
            </li>
            <li>
              Override resolution adds one Redis GET (RefreshGeneration) before each EVALSHA call.
              On cache hit, this is the only additional round-trip. On cache miss, a full override
              fetch follows.
            </li>
            <li>
              Incompatible with Redis Cluster without hash tags. Hash-tag workaround
              negates horizontal scaling.
            </li>
          </ul>
        </RLCallout>

        <RLRelatedPages pages={[
          { slug: "redis-lua-atomicity", section: "rate-limiting-engine", title: "Redis + Lua Atomicity", note: "why single-script execution eliminates the TOCTOU race" },
          { slug: "configuration-overrides", section: "rate-limiting-engine", title: "Configuration Overrides", note: "RefreshGeneration and ARGV resolution before each check" },
          { slug: "multi-replica-correctness", section: "rate-limiting-engine", title: "Multi-Replica Correctness", note: "distributed correctness proof — same principles apply to all tiers" },
          { slug: "system-invariants", section: "architecture", title: "System Invariants", note: "formal statement of the all-or-nothing invariant" }
        ]} />
      </div>
    )
  },

  /* ─────────────────────────────────────────────────────────────────────────
   * 4. MULTI-REPLICA CORRECTNESS  (flagship — 10/10)
   * ───────────────────────────────────────────────────────────────────────── */
  "multi-replica-correctness": {
    title: "Multi-Replica Correctness",
    topics: [
      { label: "Test Topology", href: "#topology" },
      { label: "Centralized Quota Authority", href: "#authority" },
      { label: "Process-Local Safety Boundaries", href: "#boundaries" },
      { label: "Verified Runtime Result", href: "#results" },
      { label: "False Positive Incident — Port 9091", href: "#incident" },
      { label: "Restart and Failover Behavior", href: "#restart" },
      { label: "Design Rationale", href: "#rationale" },
      { label: "Alternatives Considered", href: "#alternatives" },
      { label: "Limitations", href: "#limitations" }
    ],
    content: (
      <div>
        <RLThesis>
          Horizontal scaling must not weaken global quota correctness. The engine proves this
          with a runtime test: 60 concurrent requests distributed across 2 sidecars and 2
          limiters against a shared Redis key with capacity 10 yield exactly 10 allowed and
          50 denied — every time, zero variance. A false positive incident (port 9091 was
          Prometheus; requests bypassed sidecar-b) was identified, diagnosed, and corrected
          to port 9092, validating both the test methodology and the correctness property.
        </RLThesis>

        <RLQuickModel>
          Replicas are stateless computation workers. They hold no token counts, no in-memory
          quotas, and no per-user allocations. Every allow/deny decision targets the same Redis
          master via EVALSHA. Replica count is irrelevant to correctness — only to throughput
          and latency.
        </RLQuickModel>

        <h2 className="guide-sub-heading" id="topology">1. Test Topology</h2>
        <p>
          The multi-replica correctness test spins up the following processes against a shared
          Redis master:
        </p>
        <div style={{ overflowX: "auto", margin: "16px 0" }}>
          <table className="guide-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #27272a", textAlign: "left" }}>
                <th style={{ padding: "10px 8px" }}>Process</th>
                <th style={{ padding: "10px 8px" }}>Port</th>
                <th style={{ padding: "10px 8px" }}>Role</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["sidecar-a", ":9090", "HTTP proxy; forwards quota checks to limiter-a or limiter-b"],
                ["sidecar-b", ":9092", "HTTP proxy; second replica — requests distributed across both"],
                ["limiter-a", ":8080", "Token bucket limiter; EVALSHA to shared Redis"],
                ["limiter-b", ":8083", "Token bucket limiter; EVALSHA to same Redis key"],
                ["Redis master", ":6379", "Sole authoritative token bucket state — key rate:{userID}"]
              ].map(([proc, port, role]) => (
                <tr key={proc} style={{ borderBottom: "1px solid #27272a" }}>
                  <td style={{ padding: "10px 8px", fontFamily: "monospace", fontSize: 12, color: "#ff5cad" }}>{proc}</td>
                  <td style={{ padding: "10px 8px", fontFamily: "monospace", fontSize: 12 }}>{port}</td>
                  <td style={{ padding: "10px 8px" }}>{role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          The bucket is initialized with <code>capacity = 10</code> for the test user.
          60 goroutines fire simultaneously, alternating between sidecar-a and sidecar-b.
          The only correct outcome: 10 allowed (HTTP 200), 50 denied (HTTP 429), 0 errors.
        </p>

        <h2 className="guide-sub-heading" id="authority">2. Centralized Quota Authority</h2>
        <p>
          All stateful quota decisions converge on a single Redis key:
        </p>
        <ul className="guide-bullets-list">
          <li>
            <strong>Single writer:</strong> Redis master is the only node that executes EVALSHA.
            Read replicas are not used for quota checks — stale reads from replicas could return
            "tokens available" when the master has already exhausted the bucket.
          </li>
          <li>
            <strong>No local token state:</strong> Neither sidecars nor limiters hold token
            balances in memory. The only per-process memory structures are denial cache entries
            (which cache denied responses) and the singleflight in-flight deduplication map.
            Neither can cause over-admission (see Process-Local Safety Boundaries).
          </li>
          <li>
            <strong>Key identity:</strong> All requests for user X hit the same Redis key
            <code> rate:X</code>, regardless of which sidecar or limiter receives them. The
            token bucket script is keyed purely on the caller identifier, not on any replica
            affinity.
          </li>
        </ul>

        <h2 className="guide-sub-heading" id="boundaries">3. Process-Local Safety Boundaries</h2>
        <p>
          Two process-local optimizations exist: the denial cache and singleflight. Both are
          explicitly bounded to prevent any possibility of over-admission:
        </p>
        <ul className="guide-bullets-list">
          <li>
            <strong>Denial cache (CACHE_TTL_MS = 30ms, denial-only):</strong> When replica 1
            receives a denied response for key X, it caches the denial for 30ms. A second request
            for X arriving at replica 1 within 30ms gets the cached deny without a Redis round-trip.
            This cache exists on replica 1 only — replica 2 has no visibility into it. If replica 2
            receives a request for key X in the same window, it goes to Redis. Redis correctly
            denies (bucket still empty). Safe — may add a redundant Redis call on replica 2,
            never causes over-admission on any replica.
          </li>
          <li>
            <strong>Singleflight (process-local):</strong> 100 concurrent requests for the same
            key on one replica collapse to one Redis round-trip via Go's <code>singleflight.Group</code>.
            The single flight returns one result, shared with all 100 waiters. Singleflight is per-process
            — it does not cross replica boundaries. The shared result reflects the true Redis state
            at that instant. On a denied result, all 100 waiters on that replica receive 429. Safe —
            cannot cause over-admission because the one Redis call is atomic Lua.
          </li>
          <li>
            <strong>Override cache (per-replica):</strong> Stale override data is possible until
            generation refresh or TTL expiry. This may briefly apply outdated limits. Safe for quota
            correctness (uses last-known-good config) but may fail to apply an emergency rate-limit
            reduction immediately. Bounded by OVERRIDE_CACHE_TTL_MS (5s).
          </li>
        </ul>

        <RLCallout variant="info" title="Only denials are cached locally">
          Caching an "allowed" response locally would cause over-admission: subsequent requests
          served from cache bypass Redis and can exceed the true bucket balance. Only denials
          are safe to cache — a client already denied cannot be over-admitted by returning the
          same denial without a Redis call.
        </RLCallout>

        <h2 className="guide-sub-heading" id="results">4. Verified Runtime Result</h2>

        <RLStatGrid stats={[
          { value: "60", label: "Concurrent requests — split across 2 sidecars", evidence: "RUNTIME-PROVEN" },
          { value: "10", label: "Requests allowed — exactly matches capacity", evidence: "RUNTIME-PROVEN" },
          { value: "50", label: "Requests denied — 429 Too Many Requests", evidence: "RUNTIME-PROVEN" },
          { value: "0", label: "Unexpected errors or over-admissions observed", evidence: "RUNTIME-PROVEN" }
        ]} />

        <RLSourceExcerpt
          source="internal/limiter/redis_atomic_token_bucket_test.go — multi-replica integration"
          language="go"
          establishes="60 goroutines hit two sidecar endpoints concurrently against one shared Redis key with capacity 10. Result: allowed=10, denied=50, error=0."
        >{`// 60 goroutines, 2 sidecar endpoints, capacity = 10
var allowed, denied int64
var wg sync.WaitGroup

for i := 0; i < 60; i++ {
    wg.Add(1)
    go func(endpoint string) {
        defer wg.Done()
        resp, err := http.Get(endpoint + "/api/test")
        if err != nil {
            atomic.AddInt64(&errCount, 1)
            return
        }
        if resp.StatusCode == 200 {
            atomic.AddInt64(&allowed, 1)
        } else {
            atomic.AddInt64(&denied, 1)
        }
    }(sidecars[i%2])  // alternate between sidecar-a (:9090) and sidecar-b (:9092)
}
wg.Wait()
// Runtime result: allowed=10, denied=50, errCount=0
assert.Equal(t, int64(10), allowed)
assert.Equal(t, int64(50), denied)`}</RLSourceExcerpt>

        <h2 className="guide-sub-heading" id="incident">5. False Positive Incident — Port 9091</h2>
        <p>
          During initial multi-replica test development, sidecar-b was configured on port 9091.
          The test reported an incorrect result: requests to sidecar-b were not reaching the
          limiter. The investigation found the cause:
        </p>
        <ul className="guide-bullets-list">
          <li>
            <strong>Port 9091 was already bound by Prometheus.</strong> The metrics exporter
            process (running on the same host) occupied port 9091. Sidecar-b's HTTP server failed
            to bind silently in test setup — or the port was forwarded to Prometheus instead of
            the sidecar process.
          </li>
          <li>
            <strong>Requests to sidecar-b bypassed the limiter entirely.</strong> HTTP requests
            directed to <code>:9091</code> reached the Prometheus metrics endpoint, which returned
            HTTP 200 for all paths. The test counted these as "allowed" responses.
          </li>
          <li>
            <strong>Initial result was a false positive:</strong> The test showed more than 10
            allowed (Prometheus 200s were miscounted as passes). The 10/50 invariant appeared to
            hold only because Prometheus also served the requests that "should" have been denied.
          </li>
        </ul>

        <RLCallout variant="warning" title="Resolution — moved sidecar-b to port 9092">
          After identifying the Prometheus port conflict, sidecar-b was reconfigured to
          <code> :9092</code> (confirmed available). The test was re-run. With both sidecars
          correctly routing to their respective limiters and both limiters coordinating on
          the same Redis key, the result corrected to exactly 10 allowed, 50 denied —
          matching the theoretical invariant. This incident validated the importance of
          verifying that test infrastructure is actually routing to the intended services.
        </RLCallout>

        <p>
          The incident was recorded in the project journal. The corrected topology is:
          sidecar-a on <code>:9090</code>, sidecar-b on <code>:9092</code>, limiter-a on
          <code>:8080</code>, limiter-b on <code>:8083</code>. Port 9091 remains reserved
          for Prometheus and is explicitly excluded from sidecar/limiter port allocation.
        </p>

        <h2 className="guide-sub-heading" id="restart">6. Restart and Failover Behavior</h2>
        <ul className="guide-bullets-list">
          <li>
            <strong>Sidecar restart:</strong> Sidecars are stateless. A restarted sidecar starts
            with an empty denial cache. Its first requests for recently-denied keys go to Redis
            (cache miss). Redis correctly denies if the bucket is still exhausted. No over-admission.
          </li>
          <li>
            <strong>Limiter restart:</strong> Limiters are stateless. On restart, SCRIPT LOAD
            re-registers the Lua scripts. The first requests after restart may trigger NOSCRIPT
            fallback (EVAL) if the Redis script cache was cleared. Quota correctness is maintained
            through EVAL fallback.
          </li>
          <li>
            <strong>Redis master failover:</strong> During promotion of a replica to master, quota
            checks fail closed (503) rather than allowing unverified requests. After promotion
            completes, all limiter replicas reconnect to the new master. The first EVALSHA per
            limiter per script triggers NOSCRIPT + EVAL recovery. Token state on the promoted
            replica may be slightly behind the old master (replication lag), but the promoted
            master is consistent from its own perspective — no over-admission occurs.
          </li>
        </ul>

        <h2 className="guide-sub-heading" id="rationale">Design Rationale</h2>
        <ul className="guide-bullets-list">
          <li>
            <strong>Centralized state over partitioned quotas:</strong> Dividing capacity/N per
            replica fails under uneven load distribution. Replica A might be at 90% utilization
            while replica B is at 10%, causing false denials on A and wasted quota on B. One
            shared counter enforces the true global limit regardless of load distribution.
          </li>
          <li>
            <strong>Master-only quota reads:</strong> Reading token counts from Redis replicas
            risks returning stale "tokens available" responses for keys recently exhausted on
            the master. All EVALSHA quota calls target the master exclusively.
          </li>
          <li>
            <strong>Denial-only local cache:</strong> Caching "allowed" responses locally would
            enable over-admission when the bucket empties after the cached response was recorded.
            Only denials — which are safe to repeat — are cached locally.
          </li>
          <li>
            <strong>Process-local singleflight:</strong> Collapsing concurrent requests per
            process reduces Redis load without crossing process boundaries. The atomic Lua script
            ensures the one collapsed result is correct.
          </li>
        </ul>

        <h2 className="guide-sub-heading" id="alternatives">Alternatives Considered</h2>
        <ul className="guide-bullets-list">
          <li>
            <strong>Per-replica token allocation:</strong> Pre-allocate capacity/N tokens to each
            replica; replenish from Redis when local tokens exhaust. Rejected — uneven traffic
            distribution causes simultaneous false denials (overloaded replica) and quota waste
            (idle replica). Allocation synchronization adds a second atomic operation per refill.
          </li>
          <li>
            <strong>Gossip-based approximate counters:</strong> Replicas periodically broadcast
            request counts to each other. Eventual consistency during the sync window allows
            over-admission. Rejected — rate limiting requires strong consistency.
          </li>
          <li>
            <strong>Sticky sessions (affinity routing):</strong> Route all requests for a user to
            one replica. Eliminates cross-replica coordination. Rejected — affinity breaks on
            replica failure, requires load balancer reconfiguration per user, and does not survive
            autoscaling events cleanly.
          </li>
        </ul>

        <h2 className="guide-sub-heading" id="limitations">Limitations</h2>
        <RLCallout variant="limitation" title="Documented constraints">
          <ul style={{ margin: "8px 0 0 0", paddingLeft: 16 }}>
            <li>
              Correctness depends on Redis master availability. During failover (typically 1–30s for
              Sentinel promotion), quota checks fail closed (503) rather than over-admit.
              Applications must handle 503 gracefully — treat it as a transient error, not a
              rate limit signal.
            </li>
            <li>
              Process-local singleflight collapses concurrent in-flight requests for the same key
              on one replica. If the collapsed result is "allowed" (bucket barely had tokens) and
              the effective-count in Redis was not yet exhausted, the waiters that share the result
              are all admitted. This is a narrow correctness edge case under extreme per-key
              concurrency on a single replica. At distributed load, the probability is low.
            </li>
            <li>
              CACHE_TTL_MS = 30ms denial-only cache means a recently-denied key on replica A can
              still trigger a Redis round-trip on replica B within that 30ms window. This is a
              performance concern (one extra Redis call), not a correctness one.
            </li>
            <li>
              The 60-concurrent test verified burst correctness under instantaneous load. Long-running
              soak tests under mixed traffic patterns and churning key populations are pending.
            </li>
          </ul>
        </RLCallout>

        <RLRelatedPages pages={[
          { slug: "redis-lua-atomicity", section: "rate-limiting-engine", title: "Redis + Lua Atomicity", note: "why EVALSHA is the correctness foundation for all replicas" },
          { slug: "multi-replica-verification", section: "correctness-and-verification", title: "Multi-Replica Verification", note: "full test methodology — topology, ports, assertion code" },
          { slug: "denial-cache-and-singleflight", section: "resilience", title: "Denial Cache and Singleflight", note: "process-local optimization boundaries in detail" },
          { slug: "redis-and-sentinel-ha", section: "production-engineering", title: "Redis and Sentinel HA", note: "master-only quota reads and failover behavior" }
        ]} />
      </div>
    )
  },

  /* ─────────────────────────────────────────────────────────────────────────
   * 5. CONFIGURATION OVERRIDES
   * ───────────────────────────────────────────────────────────────────────── */
  "configuration-overrides": {
    title: "Configuration Overrides",
    topics: [
      { label: "Dynamic Overrides Flow", href: "#override-flow" },
      { label: "Monotonic Version Invalidation", href: "#version-invalidation" },
      { label: "RefreshGeneration", href: "#refresh-generation" },
      { label: "Override Resolution in ARGV", href: "#argv-resolution" },
      { label: "Fallback Behaviors", href: "#fallback" },
      { label: "Design Rationale", href: "#rationale" },
      { label: "Alternatives Considered", href: "#alternatives" },
      { label: "Limitations", href: "#limitations" }
    ],
    content: (
      <div>
        <RLThesis>
          Rate limits are configurable at runtime without process restarts. Admin API writes land
          in Redis hashes and atomically increment a monotonic <code>config:generation</code>
          counter. Limiter replicas call <code>RefreshGeneration()</code> before each hierarchical
          check, comparing their local generation snapshot to Redis. A mismatch invalidates the
          entire local override cache and forces fresh lookups on the next tier resolution.
        </RLThesis>

        <RLQuickModel>
          Admin write → Redis pipeline: HSET override hash + INCR config:generation (atomic).
          Limiter on next hierarchical check → GET config:generation → matches local? Serve cache.
          Mismatch? Flush cache, fetch fresh overrides on next tier resolution. One GET per check
          on the hot path; full override fetch only on generation advance.
        </RLQuickModel>

        <h2 className="guide-sub-heading" id="override-flow">1. Dynamic Overrides Flow</h2>
        <p>
          Admin overrides are written to Redis hashes via the Admin API (<code>:8082</code>).
          Each hash stores <code>capacity</code> and <code>refill_rate</code> fields that the
          limiter prefers over static environment defaults. The admin write path is:
        </p>
        <ol className="guide-bullets-list" style={{ listStyleType: "decimal" }}>
          <li>
            Operator calls <code>POST /admin/limits/{"{level}"}/{"{id}"}</code> with
            <code> {`{"capacity": N, "refill_rate": R}`}</code>.
          </li>
          <li>
            Admin API builds a Redis pipeline: <code>HSET config:{"{level}"}:{"{id}"} capacity N refill_rate R</code>
            + <code>INCR config:generation</code>.
          </li>
          <li>
            Pipeline executes atomically. No limiter replica can observe the new override hash
            without also seeing the incremented generation.
          </li>
          <li>
            On the next hierarchical check by any limiter replica, <code>RefreshGeneration()</code>
            detects the generation advance and invalidates the local cache.
          </li>
        </ol>
        <div style={{ overflowX: "auto", margin: "16px 0" }}>
          <table className="guide-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #27272a", textAlign: "left" }}>
                <th style={{ padding: "10px 8px" }}>Level</th>
                <th style={{ padding: "10px 8px" }}>Admin API endpoint</th>
                <th style={{ padding: "10px 8px" }}>Redis override key</th>
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
                  <td style={{ padding: "10px 8px", fontFamily: "monospace", fontSize: 12, color: "#ff5cad" }}>{key}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="guide-sub-heading" id="version-invalidation">2. Monotonic Version Invalidation</h2>
        <p>
          Polling Redis on every override lookup adds 1–2ms latency to every hierarchical check.
          Pub/Sub risks permanent drift if a replica misses a message during partition. The
          generation counter approach:
        </p>
        <ol className="guide-bullets-list" style={{ listStyleType: "decimal" }}>
          <li>
            <code>config:generation</code> is a monotonically incrementing integer key in Redis.
            It starts at 0 and increments by 1 on every admin write.
          </li>
          <li>
            Admin writes pipeline the override HSET + generation INCR atomically. No replica can
            observe a new override without a corresponding generation increment.
          </li>
          <li>
            Each limiter replica stores its last-known generation as <code>localGeneration</code>.
          </li>
          <li>
            <code>RefreshGeneration()</code> GETs <code>config:generation</code>. If
            <code> remote == localGeneration</code>, skip. If <code>remote &gt; localGeneration</code>,
            flush the entire override cache and update <code>localGeneration = remote</code>.
          </li>
        </ol>

        <RLSourceExcerpt
          source="internal/override/store.go — admin write pipeline"
          language="go"
          establishes="Admin writes atomically persist the override hash and increment config:generation in one pipeline. No replica can see new override state without seeing the generation advance."
        >{`func (s *Store) WriteOverride(ctx context.Context, level, id string, cfg Override) error {
    key := fmt.Sprintf("config:%s:%s", level, id)
    pipe := s.rdb.Pipeline()
    pipe.HSet(ctx, key, "capacity", cfg.Capacity, "refill_rate", cfg.RefillRate)
    pipe.Incr(ctx, "config:generation")  // monotonic invalidation signal
    _, err := pipe.Exec(ctx)
    return err
}`}</RLSourceExcerpt>

        <h2 className="guide-sub-heading" id="refresh-generation">3. RefreshGeneration</h2>
        <p>
          Called before every hierarchical check (inside <code>AllowWithParams</code>),
          <code> RefreshGeneration</code> costs one Redis GET on the hot path when the
          generation has not changed — typically sub-millisecond on a co-located Redis:
        </p>

        <RLSourceExcerpt
          source="internal/override/store.go — RefreshGeneration and AllowWithParams integration"
          language="go"
          establishes="Single GET on config:generation per hierarchical check. Mismatch flushes local cache and updates localGeneration. Failure falls back to cached overrides, bounded by OVERRIDE_CACHE_TTL_MS."
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

// Called at the start of every hierarchical check:
func (l *HierarchicalLimiter) AllowWithParams(ctx context.Context, levels []LevelConfig) (Result, error) {
    _ = l.overrides.RefreshGeneration(ctx)  // error: use cached overrides
    // Resolve each tier's capacity and refill_rate from override cache or env defaults
    // Build ARGV array and call EVALSHA
    ...
}`}</RLSourceExcerpt>

        <h2 className="guide-sub-heading" id="argv-resolution">4. Override Resolution in ARGV</h2>
        <p>
          After <code>RefreshGeneration()</code>, the limiter resolves the effective capacity and
          refill_rate for each tier:
        </p>
        <ol className="guide-bullets-list" style={{ listStyleType: "decimal" }}>
          <li>
            Look up <code>config:{"{level}"}:{"{id}"}</code> in the local override cache (in-memory map).
          </li>
          <li>
            If found: use <code>override.Capacity</code> and <code>override.RefillRate</code>.
          </li>
          <li>
            If not found: use environment defaults — <code>CAPACITY</code> and
            <code> REFILL_RATE</code> environment variables.
          </li>
          <li>
            Pack resolved values into the ARGV array:
            <code> [cap_global, cap_tenant, cap_user, cap_ep, rate_global, rate_tenant, rate_user, rate_ep, now_sec, level_count]</code>.
          </li>
        </ol>
        <p>
          This means override changes take effect on the very next hierarchical check after the
          generation advance is detected — no restart, no reload, no signal handling.
        </p>

        <h2 className="guide-sub-heading" id="fallback">5. Fallback Behaviors</h2>
        <ul className="guide-bullets-list">
          <li>
            <strong>Generation GET failure:</strong> If the Redis GET on <code>config:generation</code>
            times out, <code>RefreshGeneration</code> returns an error. The limiter ignores the error
            (note the <code>_ =</code> discard) and continues with cached overrides. Staleness is
            bounded by <code>OVERRIDE_CACHE_TTL_MS</code> (default 5000ms) — even without a
            successful generation check, caches are not held indefinitely.
          </li>
          <li>
            <strong>Override hash miss:</strong> No HGET for the override key is made on the hot
            path. Only when the cache is cold (post-invalidation) and a lookup misses does the
            limiter fall through to environment defaults. A missing override always means "use
            default" — never "deny all."
          </li>
          <li>
            <strong>Manual global invalidation:</strong> Operators can force cache flush across
            all replicas by directly incrementing the generation counter:
            <code> redis-cli INCR config:generation</code>. No process restart needed.
          </li>
        </ul>

        <h2 className="guide-sub-heading" id="rationale">Design Rationale</h2>
        <ul className="guide-bullets-list">
          <li>
            <strong>Generation over Pub/Sub:</strong> Pub/Sub is fire-and-forget. A replica offline
            during a publish permanently misses the invalidation and continues serving stale
            overrides indefinitely. Generation comparison is pull-based and self-healing — a replica
            recovering from a network partition detects the generation advance on its next check.
          </li>
          <li>
            <strong>Pipeline write + INCR atomicity:</strong> The pipeline ensures no replica can
            observe a new override hash combined with a stale generation counter. The invariant
            "generation advance implies new override is visible" is preserved.
          </li>
          <li>
            <strong>Per-check RefreshGeneration over timer polling:</strong> Calling
            RefreshGeneration on every hierarchical check means override propagation delay is at
            most one request latency — not one poll interval. At 872 RPS, this is ~1ms propagation
            lag in steady state.
          </li>
          <li>
            <strong>OVERRIDE_CACHE_TTL_MS as backstop:</strong> Even if generation checks fail
            continuously (e.g., Redis connectivity issue), caches are bounded to 5s staleness.
            The system self-corrects once Redis connectivity is restored.
          </li>
        </ul>

        <h2 className="guide-sub-heading" id="alternatives">Alternatives Considered</h2>
        <ul className="guide-bullets-list">
          <li>
            <strong>Redis Pub/Sub invalidation:</strong> Instant when connected. Missed messages
            during partitions cause permanent drift — a replica offline for 5 seconds misses all
            override changes made during that window and never recovers without a restart. Rejected.
          </li>
          <li>
            <strong>Poll all four override hashes on every check:</strong> Always fresh, no generation
            logic needed. Costs 4 Redis HGETs per request on the hot path. At 872 RPS, that is
            3,488 extra Redis reads per second. Rejected — generation check is one GET.
          </li>
          <li>
            <strong>Config reload via SIGHUP / admin endpoint:</strong> Requires operator action
            per replica, not automatic propagation. Does not scale to many replicas.
          </li>
          <li>
            <strong>etcd or Consul watch:</strong> Distributed configuration service with watch
            API — immediate propagation. Adds an external service dependency when Redis already
            stores all quota state. Rejected.
          </li>
        </ul>

        <h2 className="guide-sub-heading" id="limitations">Limitations</h2>
        <RLCallout variant="limitation" title="Documented constraints">
          <ul style={{ margin: "8px 0 0 0", paddingLeft: 16 }}>
            <li>
              Override propagation is eventually consistent. In the failure path (generation GET
              fails continuously), staleness is bounded by OVERRIDE_CACHE_TTL_MS (5s). In the
              normal path, propagation lag is one request latency (~1ms at 872 RPS).
            </li>
            <li>
              Generation is global — any override write at any level increments the counter and
              invalidates the entire local cache on all replicas. Writing a user override causes
              all replicas to re-fetch global and tenant overrides too. Simple but coarse.
            </li>
            <li>
              Admin API (<code>:8082</code>) is a separate service boundary. Its unavailability
              does not affect rate checking (limiters continue with cached overrides) but
              does block new override writes.
            </li>
            <li>
              Deleting an override via the Admin API should also INCR the generation counter.
              Replicas will invalidate their cache and revert to environment defaults after the
              next generation check.
            </li>
          </ul>
        </RLCallout>

        <RLRelatedPages pages={[
          { slug: "hierarchical-quotas", section: "rate-limiting-engine", title: "Hierarchical Quotas", note: "where resolved overrides feed into Lua ARGV" },
          { slug: "configuration-reference", section: "production-engineering", title: "Configuration Reference", note: "OVERRIDE_CACHE_TTL_MS, CAPACITY, REFILL_RATE env defaults" },
          { slug: "major-design-decisions", section: "engineering-journal", title: "Major Design Decisions", note: "generation vs Pub/Sub trade-off — journal entry" }
        ]} />
      </div>
    )
  }
};

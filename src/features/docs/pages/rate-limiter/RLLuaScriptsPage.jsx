import DocsNavbar from "@/features/docs/components/DocsNavbar";
import DocsSidebar from "@/features/docs/components/DocsSidebar";
import DocsMermaid from "@/features/docs/components/DocsMermaid";
import GoCodeBlock from "@/features/docs/components/GoCodeBlock";

const pageTopics = [
  { label: "Why Lua?", href: "#why-lua" },
  { label: "Token Bucket Algorithm", href: "#token-bucket" },
  { label: "Sliding Window Algorithm", href: "#sliding-window" },
  { label: "Hierarchical Lua Script", href: "#hierarchical" },
  { label: "Script Loading Pattern", href: "#loading" },
  { label: "Algorithm Comparison", href: "#comparison" },
];

const tokenBucketDiagram = `
flowchart LR
    subgraph Redis["Redis (Lua script — single thread)"]
        Load["HMGET key\\n'tokens','last_refill'"]
        Calc["elapsed = now - last_refill\\nnew_tokens = min(tokens + elapsed×rate, capacity)"]
        Check{"new_tokens >= 1?"}
        Decrement["new_tokens -= 1\\nHMSET key tokens new_tokens\\nlast_refill now"]
        Return1(["return {1, new_tokens}\\nAllowed"])
        Return0(["return {0, 0}\\nDenied"])
    end
    
    Load --> Calc --> Check
    Check -->|"yes"| Decrement --> Return1
    Check -->|"no"| Return0

    style Load fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style Decrement fill:#1e1e2e,stroke:#c084fc,color:#fff
    style Return1 fill:#1e1e2e,stroke:#c084fc,color:#fff
    style Return0 fill:#1e1e2e,stroke:#ec4899,color:#fff
`;

const slidingWindowDiagram = `
flowchart LR
    subgraph Redis["Redis (Lua script — single thread)"]
        Trim["ZREMRANGEBYSCORE key 0 now-window_ns"]
        Count["ZADD key NX now unique_id\\ncount = ZCARD key"]
        Check{"count <= limit?"}
        Expire["PEXPIRE key window_ms"]
        Return1(["return {1, limit-count}\\nAllowed"])
        Return0(["ZREM key unique_id\\nreturn {0, 0}\\nDenied"])
    end
    
    Trim --> Count --> Check
    Check -->|"yes"| Expire --> Return1
    Check -->|"no"| Return0

    style Trim fill:#1e1e2e,stroke:#c084fc,color:#fff
    style Return1 fill:#1e1e2e,stroke:#c084fc,color:#fff
    style Return0 fill:#1e1e2e,stroke:#ec4899,color:#fff
`;

export default function RLLuaScriptsPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="why-lua">
              Rate Limiting Algorithms &amp; Lua Scripts
            </h1>

            <div className="guide-body-text" style={{ marginTop: 24 }}>

              {/* Why Lua */}
              <h2 className="guide-sub-heading" id="why-lua" style={{ fontSize: 22, color: "#ffffff", marginTop: 0, marginBottom: 12 }}>
                Why Lua Scripts?
              </h2>
              <p>
                The core challenge of distributed rate limiting is atomicity: two concurrent requests for the same user must not both read "1 token remaining", both decide "allowed", and both decrement — leaving the counter at -1. The naive solution is to use a distributed lock, but locks add a full round-trip per request.
              </p>
              <p style={{ marginTop: 12, marginBottom: 16 }}>
                The solution used here is <strong style={{ color: "#ff5cad" }}>Redis Lua scripting</strong>. Lua scripts run inside Redis's single event loop. They are:
              </p>
              <ul className="guide-bullets-list" style={{ marginBottom: 20 }}>
                <li><strong style={{ color: "#ff5cad" }}>Atomic</strong> — no other Redis command can execute between lines of a Lua script</li>
                <li><strong style={{ color: "#ff5cad" }}>Single-round-trip</strong> — the entire check-and-decrement happens in one <code>EVALSHA</code> call</li>
                <li><strong style={{ color: "#ff5cad" }}>Serialized per key</strong> — Redis is single-threaded for Lua; multiple concurrent scripts queue behind each other</li>
                <li><strong style={{ color: "#ff5cad" }}>No lock overhead</strong> — unlike WATCH/MULTI/EXEC optimistic locking, there is no retry loop</li>
              </ul>

              <div style={{
                background: "rgba(255,92,173,0.06)",
                border: "1px solid rgba(255,92,173,0.2)",
                borderRadius: 8, padding: "14px 18px",
                fontSize: 13, lineHeight: 1.65, marginBottom: 28
              }}>
                <strong style={{ color: "#ff5cad" }}>The TOCTOU Problem (Without Lua):</strong> Time-of-Check to Time-of-Use. Without atomicity, two concurrent reads can both see "1 remaining", both decide "allowed", both write "0" — resulting in 2 requests getting through when only 1 should.  Lua eliminates this by making the check and decrement one indivisible operation.
              </div>

              {/* Token Bucket */}
              <h2 className="guide-sub-heading" id="token-bucket" style={{ fontSize: 22, color: "#ffffff", marginTop: 36, marginBottom: 12 }}>
                Algorithm 1: Token Bucket
              </h2>
              <p>
                The token bucket algorithm models a bucket that fills at a constant rate (the <em>refill rate</em>) up to a maximum (the <em>capacity</em>). Each request consumes one token. If the bucket is empty, the request is denied.
              </p>
              <p style={{ marginTop: 10, marginBottom: 16 }}>
                The key insight is <strong style={{ color: "#ff5cad" }}>lazy refill</strong>: instead of a background goroutine adding tokens every second, the Lua script computes how many tokens should have been added since the last request and adds them all at once. This means the bucket only touches Redis when a request arrives.
              </p>

              <DocsMermaid chart={tokenBucketDiagram} />

              <div style={{ background: "#0f0f12", border: "1px solid #27272a", borderRadius: 8, padding: "16px 20px", marginBottom: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#71717a", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  internal/limiter/lua/token_bucket.lua
                </div>
                <GoCodeBlock>{`-- KEYS[1] = rate:{user_id}  (or endpoint, tenant, etc.)
-- ARGV[1] = now_sec  (Unix timestamp in whole seconds)
-- ARGV[2] = capacity (max tokens the bucket holds)
-- ARGV[3] = refill_rate (tokens added per second)

local key         = KEYS[1]
local now         = tonumber(ARGV[1])
local capacity    = tonumber(ARGV[2])
local refill_rate = tonumber(ARGV[3])

-- Read current state
local data       = redis.call('HMGET', key, 'tokens', 'last_refill')
local tokens     = tonumber(data[1]) or capacity    -- default: full bucket
local last_refill = tonumber(data[2]) or now

-- Lazy refill: add tokens proportional to time elapsed
local elapsed   = math.max(0, now - last_refill)
local new_tokens = math.min(capacity, tokens + elapsed * refill_rate)

-- Check and conditionally decrement
if new_tokens < 1 then
    -- Not enough tokens — update state (but don't decrement below 0)
    redis.call('HMSET', key, 'tokens', new_tokens, 'last_refill', now)
    return {0, 0}    -- denied, 0 remaining
end

new_tokens = new_tokens - 1
redis.call('HMSET', key, 'tokens', new_tokens, 'last_refill', now)
return {1, math.floor(new_tokens)}   -- allowed, remaining`}</GoCodeBlock>
              </div>

              {/* Properties of token bucket */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14, marginBottom: 28 }}>
                {[
                  { title: "Burst Handling", body: "If no requests arrive for 10 seconds and refill_rate=1, the bucket refills by 10 tokens (up to capacity). This allows short bursts after idle periods — good for API clients.", icon: "", color: "#c084fc" },
                  { title: "Smooth Steady-State", body: "At exactly refill_rate requests/second in steady state, the bucket stays near-full. Clients get predictable throughput without jitter.", icon: "", color: "#c084fc" },
                  { title: "Second-Resolution", body: "The current implementation uses time.Now().Unix() (whole seconds). This means intra-second refills are not visible. Sub-second precision requires switching to UnixMilli().", icon: "Warning:", color: "#c084fc" },
                  { title: "Redis Storage", body: "Each bucket is a Redis HASH with 2 fields: 'tokens' and 'last_refill'. Storage is O(1) per user — no sorted sets, no list growth.", icon: "", color: "#a78bfa" },
                ].map(item => (
                  <div key={item.title} style={{ background: "#0f0f12", border: `1px solid ${item.color}22`, borderRadius: 8, padding: "14px 16px" }}>
                    <div style={{ fontSize: 20, marginBottom: 6 }}>{item.icon}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#ffffff", marginBottom: 5 }}>{item.title}</div>
                    <div style={{ fontSize: 13, color: "#a1a1aa", lineHeight: 1.6 }}>{item.body}</div>
                  </div>
                ))}
              </div>

              {/* Sliding Window */}
              <h2 className="guide-sub-heading" id="sliding-window" style={{ fontSize: 22, color: "#ffffff", marginTop: 36, marginBottom: 12 }}>
                Algorithm 2: Sliding Window (Fixed Request Count)
              </h2>
              <p>
                The sliding window algorithm enforces a strict <em>N requests per W seconds</em> limit with no burst allowance. It uses a Redis Sorted Set where each member is a unique request ID and its score is the nanosecond timestamp of the request.
              </p>
              <p style={{ marginTop: 10, marginBottom: 16 }}>
                On each request, the script trims entries older than the window, counts remaining entries, and either adds the new request or rejects it. The window always covers the last W seconds from "now" — not from a fixed epoch boundary.
              </p>

              <DocsMermaid chart={slidingWindowDiagram} />

              <div style={{ background: "#0f0f12", border: "1px solid #27272a", borderRadius: 8, padding: "16px 20px", marginBottom: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#71717a", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  internal/limiter/lua/sliding_window.lua
                </div>
                <GoCodeBlock>{`-- KEYS[1] = sw:{user_id}         (sorted set key)
-- ARGV[1] = now_ns               (current time in nanoseconds)
-- ARGV[2] = window_ns            (window size in nanoseconds)
-- ARGV[3] = limit                (max requests in window)
-- ARGV[4] = unique_id            (UUID for this specific request)

local key       = KEYS[1]
local now       = tonumber(ARGV[1])
local window    = tonumber(ARGV[2])
local limit     = tonumber(ARGV[3])
local uid       = ARGV[4]
local cutoff    = now - window

-- Remove expired entries (outside the window)
redis.call('ZREMRANGEBYSCORE', key, 0, cutoff)

-- Add this request tentatively
redis.call('ZADD', key, 'NX', now, uid)

-- Count requests in window (including this one)
local count = redis.call('ZCARD', key)

if count > tonumber(limit) then
    -- Over limit: remove this request and deny
    redis.call('ZREM', key, uid)
    return {0, 0}
end

-- Under limit: set expiry and allow
redis.call('PEXPIRE', key, math.ceil(window / 1000000))
return {1, limit - count}`}</GoCodeBlock>
              </div>

              {/* Hierarchical Lua Script */}
              <h2 className="guide-sub-heading" id="hierarchical" style={{ fontSize: 22, color: "#ffffff", marginTop: 36, marginBottom: 12 }}>
                The Hierarchical Lua Script
              </h2>
              <p>
                The hierarchical script is the most complex script in the system. It performs two distinct phases within a single atomic Lua execution: a read-and-check phase across all 4 levels, then a decrement phase only if all levels passed.
              </p>

              <div style={{
                display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8, marginTop: 16, marginBottom: 20
              }}>
                {[
                  { level: "Global", key: "rate:global:default", desc: "System-wide cap. Protects Redis and upstream from total overload." },
                  { level: "Tenant", key: "rate:tenant:{tenantID}", desc: "Per-organization cap. A noisy-neighbor tenant cannot starve others." },
                  { level: "User", key: "rate:user:{userID}", desc: "Per-user cap. A single abusive user cannot exhaust tenant quota." },
                  { level: "Endpoint", key: "rate:ep:{tenantID}:{path}", desc: "Per-path cap. Expensive endpoints get tighter limits than cheap ones." },
                ].map((item, i) => (
                  <div key={i} style={{
                    background: "#0f0f12", border: "1px solid rgba(255,92,173,0.2)",
                    borderRadius: 8, padding: "12px 14px", textAlign: "center"
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#ff5cad", marginBottom: 6, textTransform: "uppercase" }}>Level {i+1}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#ffffff", marginBottom: 6 }}>{item.level}</div>
                    <code style={{ fontSize: 10, color: "#c084fc", display: "block", wordBreak: "break-all", marginBottom: 8 }}>{item.key}</code>
                    <div style={{ fontSize: 11.5, color: "#71717a", lineHeight: 1.5 }}>{item.desc}</div>
                  </div>
                ))}
              </div>

              <div style={{
                background: "rgba(219, 39, 119,0.06)",
                border: "1px solid rgba(219, 39, 119,0.2)",
                borderRadius: 8, padding: "14px 18px",
                fontSize: 13, lineHeight: 1.65, marginBottom: 20
              }}>
                <strong style={{ color: "#f472b6" }}>Warning: Redis Cluster Caveat:</strong> The hierarchical script uses 4 different KEYS (different key namespaces). In Redis Cluster mode, these keys may hash to different slots, causing a <code>CROSSSLOT Keys in request don't hash to the same slot</code> error. The system currently only supports standalone Redis or Redis Sentinel. To support cluster mode, all keys would need hash tags (e.g., <code>{"{rl}"}:global</code>, <code>{"{rl}"}:tenant:X</code>).
              </div>

              <div style={{ background: "#0f0f12", border: "1px solid #27272a", borderRadius: 8, padding: "16px 20px", marginBottom: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#71717a", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  internal/limiter/lua/hierarchical.lua — Phase 1 (Check All Levels)
                </div>
                <GoCodeBlock>{`-- KEYS[1..N] = rate keys for each level (global, tenant, user, endpoint)
-- ARGV[1..N] = capacity for each level
-- ARGV[N+1..2N] = refill_rate for each level
-- ARGV[2N+1] = now_sec (Unix timestamp)
-- ARGV[2N+2] = levels (count of levels to check, 1-4)

local now    = tonumber(ARGV[2*levels+1])
local levels = tonumber(ARGV[2*levels+2])
local allowed = 1
local min_remaining = math.huge

-- Phase 1: Check all levels, track minimum remaining tokens
for i = 1, levels do
    local key         = KEYS[i]
    local cap         = tonumber(ARGV[i])
    local rate        = tonumber(ARGV[levels + i])
    local data        = redis.call('HMGET', key, 'tokens', 'last_refill')
    local tokens      = tonumber(data[1]) or cap
    local last_refill = tonumber(data[2]) or now
    local elapsed     = math.max(0, now - last_refill)
    local new_tokens  = math.min(cap, tokens + elapsed * rate)
    
    -- Write back refilled state (even if denied — keeps clock current)
    redis.call('HMSET', key, 'tokens', new_tokens, 'last_refill', now)
    
    if new_tokens < 1 then
        allowed = 0     -- this level denied, but keep checking others
    end
    min_remaining = math.min(min_remaining, new_tokens)
end

-- Phase 2: If ALL levels allowed, decrement each
if allowed == 1 then
    for i = 1, levels do
        local tokens = tonumber(redis.call('HGET', KEYS[i], 'tokens'))
        redis.call('HSET', KEYS[i], 'tokens', tokens - 1)
    end
    return {1, math.floor(min_remaining - 1)}
end

return {0, 0}`}</GoCodeBlock>
              </div>

              {/* Script loading pattern */}
              <h2 className="guide-sub-heading" id="loading" style={{ fontSize: 22, color: "#ffffff", marginTop: 36, marginBottom: 12 }}>
                Script Loading Pattern
              </h2>
              <p>
                Scripts are loaded using <code style={{ color: "#ff5cad" }}>SCRIPT LOAD</code> at startup and executed with <code style={{ color: "#ff5cad" }}>EVALSHA</code> on each request. The SHA1 hash is cached in the Go struct. On a Redis restart (scripts are cleared from script cache), the scripts are transparently reloaded.
              </p>

              <GoCodeBlock>{`// internal/limiter/redis_atomic_token_bucket.go
type RedisTokenBucket struct {
    rdb    redis.UniversalClient
    sha    string  // SHA1 of the Lua script — loaded once at startup
    cfg    Config
}

func NewRedisTokenBucket(rdb redis.UniversalClient, cfg Config) (*RedisTokenBucket, error) {
    ctx := context.Background()
    // Embed the Lua script via go:embed
    script, err := scripts.ReadFile("lua/token_bucket.lua")
    if err != nil {
        return nil, fmt.Errorf("read token_bucket.lua: %w", err)
    }
    // SCRIPT LOAD returns the SHA1 hash
    sha, err := rdb.ScriptLoad(ctx, string(script)).Result()
    if err != nil {
        return nil, fmt.Errorf("load token bucket script: %w", err)
    }
    return &RedisTokenBucket{rdb: rdb, sha: sha, cfg: cfg}, nil
}

func (b *RedisTokenBucket) Allow(ctx context.Context, key string) (Result, error) {
    // EVALSHA is faster than EVAL — avoids re-parsing Lua on every call
    vals, err := b.rdb.EvalSha(ctx, b.sha, []string{key},
        now.Unix(), b.cfg.Capacity, b.cfg.RefillRate,
    ).Int64Slice()
    if err != nil {
        return Result{}, fmt.Errorf("evalsha token_bucket: %w", err)
    }
    return Result{Allowed: vals[0] == 1, Remaining: vals[1]}, nil
}`}</GoCodeBlock>

              {/* Algorithm comparison */}
              <h2 className="guide-sub-heading" id="comparison" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                Algorithm Comparison
              </h2>
              <div style={{ overflowX: "auto", marginBottom: 24 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #27272a" }}>
                      {["Property", "Token Bucket", "Sliding Window"].map(h => (
                        <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "#ff5cad", fontWeight: 600, fontSize: 12 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["Burst Allowance", "[OK] Yes — accumulates tokens during idle", "[Error] No — strict count in any window"],
                      ["Redis Data Structure", "HASH (2 fields per user)", "ZSET (1 member per request in window)"],
                      ["Storage Growth", "O(1) fixed — always 2 fields", "O(N) — grows with requests in window"],
                      ["Time Precision", "1-second granularity (fixable to ms)", "Nanosecond (UUID deduplication)"],
                      ["Best For", "APIs with legitimate burst patterns (e.g., mobile sync)", "Strict SLA enforcement (e.g., /login, /payments)"],
                      ["Cluster Safe", "Warning: Only with hash tags on keys", "Warning: Only with hash tags on keys"],
                      ["Config (env)", "ALGORITHM=token_bucket (default)", "ALGORITHM=sliding"],
                      ["Hierarchical Support", "[OK] hierarchical.lua uses token bucket logic", "[Error] Hierarchical uses token bucket only"],
                    ].map(([prop, tb, sw], i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #18181b", background: i % 2 === 0 ? "#0b0b0b" : "#0f0f12" }}>
                        <td style={{ padding: "8px 12px", color: "#a1a1aa" }}>{prop}</td>
                        <td style={{ padding: "8px 12px", color: "#e4e4e7" }}>{tb}</td>
                        <td style={{ padding: "8px 12px", color: "#e4e4e7" }}>{sw}</td>
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

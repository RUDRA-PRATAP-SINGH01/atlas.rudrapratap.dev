import DocsNavbar from "@/components/docs/DocsNavbar";
import DocsSidebar from "@/components/docs/DocsSidebar";
import DocsMermaid from "@/components/docs/DocsMermaid";
import GoCodeBlock from "@/components/docs/GoCodeBlock";

const pageTopics = [
  { label: "The Noisy-Neighbor Problem", href: "#noisy-neighbor" },
  { label: "The 4-Level Quota Tree", href: "#quota-tree" },
  { label: "Two-Phase Lua Execution", href: "#two-phase" },
  { label: "The Hierarchical Lua Script", href: "#lua-script" },
  { label: "Go Integration", href: "#go-integration" },
  { label: "Runtime Overrides", href: "#overrides" },
  { label: "Redis Cluster Caveat", href: "#cluster-caveat" },
  { label: "Response Headers", href: "#headers" },
];

const quotaTreeDiagram = `
flowchart TD
    Global[" Global Bucket\\nrate:global:default\\ncap=10000/min\\nProtects: Redis + all upstream infra"]
    
    TenantA[" Tenant A\\nrate:tenant:acme\\ncap=2000/min\\n(Enterprise tier)"]
    TenantB[" Tenant B\\nrate:tenant:startup\\ncap=200/min\\n(Free tier)"]

    UserA1[" user-alice\\nrate:user:alice\\ncap=500/min"]
    UserA2[" user-bob\\nrate:user:bob\\ncap=500/min"]
    UserB1[" user-carlos\\nrate:user:carlos\\ncap=50/min"]
    
    EndpointHeavy[" /api/reports/export\\nrate:ep:acme:/api/reports\\ncap=10/min (expensive)"]
    EndpointLight[" /api/heartbeat\\nrate:ep:acme:/api/heartbeat\\ncap=1000/min (cheap)"]

    Global --> TenantA
    Global --> TenantB
    TenantA --> UserA1
    TenantA --> UserA2
    TenantB --> UserB1
    UserA1 --> EndpointHeavy
    UserA1 --> EndpointLight

    style Global fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style TenantA fill:#1e1e2e,stroke:#c084fc,color:#fff
    style TenantB fill:#1e1e2e,stroke:#c084fc,color:#fff
    style UserA1 fill:#1e1e2e,stroke:#a78bfa,color:#fff
    style UserA2 fill:#18181b,stroke:#52525b,color:#71717a
    style UserB1 fill:#18181b,stroke:#52525b,color:#71717a
    style EndpointHeavy fill:#1e1e2e,stroke:#ec4899,color:#fff
    style EndpointLight fill:#1e1e2e,stroke:#c084fc,color:#fff
`;

const twoPhaseFlowDiagram = `
flowchart TD
    Start(["AllowWithParams called\\nKEYS=[global,tenant,user,endpoint]"])
    
    subgraph Phase1["Phase 1 — Check (Read-Only Evaluation)"]
        L1["HMGET global_key 'tokens','last_refill'\\nRefill → elapsed × rate\\nCheck: new_tokens ≥ 1?"]
        L2["HMGET tenant_key 'tokens','last_refill'\\nRefill → elapsed × rate\\nCheck: new_tokens ≥ 1?"]
        L3["HMGET user_key 'tokens','last_refill'\\nRefill → elapsed × rate\\nCheck: new_tokens ≥ 1?"]
        L4["HMGET endpoint_key 'tokens','last_refill'\\nRefill → elapsed × rate\\nCheck: new_tokens ≥ 1?"]
        F1{"All 4 levels passed?"}
    end

    subgraph Phase2["Phase 2 — Commit (Conditional Decrement)"]
        D1["HSET global_key tokens tokens-1"]
        D2["HSET tenant_key tokens tokens-1"]
        D3["HSET user_key tokens tokens-1"]
        D4["HSET endpoint_key tokens tokens-1"]
    end

    Allow(["return {1, min_remaining-1}\\nX-RateLimit-Remaining: N"])
    Deny(["return {0, 0}\\nHTTP 429 Too Many Requests"])

    Start --> L1 --> L2 --> L3 --> L4 --> F1
    F1 -->|"YES — all levels have tokens"| D1 --> D2 --> D3 --> D4 --> Allow
    F1 -->|"NO — at least one level exhausted"| Deny

    style Start fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style F1 fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style Allow fill:#1e1e2e,stroke:#c084fc,color:#fff
    style Deny fill:#1e1e2e,stroke:#ec4899,color:#fff
    style Phase1 fill:#0b0b0b,stroke:#27272a,color:#fff
    style Phase2 fill:#0b0b0b,stroke:#c084fc,color:#fff
`;

const singleflightDiagram = `
flowchart LR
    R1["Request 1\\nGET /check_hierarchical\\nuser=alice"] --> SF
    R2["Request 2\\nGET /check_hierarchical\\nuser=alice"] --> SF
    R3["Request 3\\nGET /check_hierarchical\\nuser=alice"] --> SF

    SF{"singleflight.Group\\nDo(cacheKey, fn)\\n— one in-flight per key"}

    SF -->|"Deduplicated to 1 call"| Redis["Redis\\nEVALSHA hierarchical.lua"]
    Redis -->|"Result"| SF
    SF -->|"Shared result"| R1
    SF -->|"Shared result"| R2
    SF -->|"Shared result"| R3

    style SF fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style Redis fill:#1e1e2e,stroke:#ec4899,color:#fff
`;

export default function RLHierarchicalPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="noisy-neighbor">
              Hierarchical Multi-Tenant Quotas
            </h1>

            <div className="guide-body-text" style={{ marginTop: 24 }}>

              {/* Noisy Neighbor */}
              <h2 className="guide-sub-heading" id="noisy-neighbor" style={{ fontSize: 22, color: "#ffffff", marginTop: 0, marginBottom: 12 }}>
                The Noisy-Neighbor Problem
              </h2>
              <p>
                In multi-tenant SaaS systems, simple per-user rate limits are insufficient. Imagine an Enterprise tenant (<code>acme</code>) with 500 active users — if each user has a 2000 req/min limit, the combined load from that one tenant is 1,000,000 req/min. That is the quota of one tenant against the shared Redis backend and upstream infrastructure. A second tenant can still be crushed by a single runaway customer inside <code>acme</code>.
              </p>
              <p style={{ marginTop: 12 }}>
                The core problems flat limits fail to solve:
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 16, marginBottom: 24 }}>
                {[
                  { icon: "", title: "Noisy Neighbor", body: "One high-volume tenant consumes so much Redis CPU that key lookups for other tenants begin to queue. They suffer elevated latency without exceeding their own limits." },
                  { icon: "", title: "Runaway Script", body: "A single user inside a tenant runs a batch job that hammers the API. Per-user limits help, but without a tenant cap, the tenant as a whole can still saturate upstream." },
                  { icon: "", title: "Endpoint Abuse", body: "A cheap endpoint like /heartbeat and an expensive endpoint like /reports/export share the same bucket. A user blasting /reports causes 10× the upstream DB load of a user blasting /heartbeat." },
                  { icon: "", title: "Contract Enforcement", body: "SaaS tiers (Free, Starter, Enterprise) need hard throughput guarantees. A Free-tier user must never consume Enterprise-tier quota — even if they find a way to forge request headers." },
                ].map(item => (
                  <div key={item.title} style={{ background: "#111113", border: "1px solid #27272a", borderRadius: 8, padding: "16px 18px" }}>
                    <div style={{ fontSize: 22, marginBottom: 8 }}>{item.icon}</div>
                    <div style={{ fontSize: 13, fontWeight: "bold", color: "#ffffff", marginBottom: 6 }}>{item.title}</div>
                    <div style={{ fontSize: 13, color: "#a1a1aa", lineHeight: 1.6 }}>{item.body}</div>
                  </div>
                ))}
              </div>

              <div style={{
                background: "rgba(255,92,173,0.06)", border: "1px solid rgba(255,92,173,0.2)",
                borderRadius: 8, padding: "14px 18px", fontSize: 13, lineHeight: 1.65, marginBottom: 28
              }}>
                <strong style={{ color: "#ff5cad" }}>The Hierarchical Solution:</strong> Instead of one limit per user, enforce four independent token buckets simultaneously: Global → Tenant → User → Endpoint. A request must pass ALL four checks before a single token is consumed from any level. This eliminates every category of noisy-neighbor attack.
              </div>

              {/* 4-Level Quota Tree */}
              <h2 className="guide-sub-heading" id="quota-tree" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                The 4-Level Quota Tree
              </h2>
              <p>
                Every request carries enough metadata (tenant ID, user ID, endpoint path) for the limiter to construct four Redis HASH keys and check all four simultaneously in one atomic Lua invocation. Each level represents a different isolation boundary:
              </p>

              <DocsMermaid chart={quotaTreeDiagram} />

              <div style={{ overflowX: "auto", marginTop: 20, marginBottom: 24 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #27272a" }}>
                      {["Level", "Redis Key Pattern", "Default Cap", "Protects Against"].map(h => (
                        <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "#ff5cad", fontWeight: 600, fontSize: 12 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["1 — Global", "rate:global:default", "10,000/min", "Redis saturation, upstream infrastructure overload"],
                      ["2 — Tenant", "rate:tenant:{tenantID}", "Per-tier SLA (env config)", "Cross-tenant noisy neighbors, contract enforcement"],
                      ["3 — User", "rate:user:{userID}", "Per-user env config", "Runaway scripts, abusive individual accounts"],
                      ["4 — Endpoint", "rate:ep:{tenantID}:{path}", "Per-path env config", "Expensive endpoint abuse, DB query storms"],
                    ].map(([level, key, cap, protects], i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #18181b", background: i % 2 === 0 ? "#0b0b0b" : "#0f0f12" }}>
                        <td style={{ padding: "8px 12px", color: "#ffffff", fontWeight: 600 }}>{level}</td>
                        <td style={{ padding: "8px 12px", color: "#c084fc", fontFamily: "monospace", fontSize: 11 }}>{key}</td>
                        <td style={{ padding: "8px 12px", color: "#c084fc", fontFamily: "monospace" }}>{cap}</td>
                        <td style={{ padding: "8px 12px", color: "#a1a1aa" }}>{protects}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Two-Phase Lua Execution */}
              <h2 className="guide-sub-heading" id="two-phase" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                Two-Phase Lua Execution
              </h2>
              <p>
                The core algorithmic challenge is preventing <strong>partial quota consumption</strong>. Consider a naive implementation that checks levels one-by-one and decrements as it goes:
              </p>
              <ul className="guide-bullets-list" style={{ marginTop: 10, marginBottom: 12 }}>
                <li>Request passes Global check → 1 global token consumed</li>
                <li>Request passes Tenant check → 1 tenant token consumed</li>
                <li>Request <strong style={{ color: "#f472b6" }}>fails</strong> User check → Request denied</li>
                <li>But global and tenant tokens were <strong style={{ color: "#f472b6" }}>already decremented</strong> → quota leak</li>
              </ul>
              <p>
                At 10,000 RPS, a user near their user-level limit causes hundreds of orphaned decrements per second at the Global and Tenant levels — effectively making tenant-wide and global quotas lower than configured.
              </p>
              <p style={{ marginTop: 12 }}>
                The solution is a strict <strong style={{ color: "#ff5cad" }}>two-phase, all-or-nothing</strong> Lua script:
              </p>

              <DocsMermaid chart={twoPhaseFlowDiagram} />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 20, marginBottom: 28 }}>
                {[
                  { title: "Phase 1: Speculative Check", color: "#c084fc", body: "Read all four buckets, lazily refill them based on elapsed time, and evaluate all four checks. Track the minimum remaining tokens across all levels. No tokens are consumed yet." },
                  { title: "Phase 2: Conditional Commit", color: "#c084fc", body: "Only if Phase 1 concludes that ALL four levels have ≥ 1 token does the script decrement each bucket. If any level fails, the script skips Phase 2 entirely and returns denied." },
                ].map(item => (
                  <div key={item.title} style={{ background: "#0f0f12", border: `1px solid ${item.color}33`, borderRadius: 8, padding: "16px 18px" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: item.color, marginBottom: 8 }}>{item.title}</div>
                    <div style={{ fontSize: 13, color: "#a1a1aa", lineHeight: 1.6 }}>{item.body}</div>
                  </div>
                ))}
              </div>

              {/* The Hierarchical Lua Script */}
              <h2 className="guide-sub-heading" id="lua-script" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                The Hierarchical Lua Script
              </h2>
              <p>
                The script accepts variable number of levels (1–4) controlled by <code>ARGV[2N+2]</code>. This makes it reusable for flat single-level checks and hierarchical 4-level checks without duplicating code.
              </p>

              <div style={{ background: "#0f0f12", border: "1px solid #27272a", borderRadius: 8, padding: "16px 20px", marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#71717a", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  internal/limiter/lua/hierarchical.lua
                </div>
                <GoCodeBlock>{`-- ============================================================
-- Hierarchical Token Bucket Rate Limiter (2-Phase)
-- ============================================================
-- KEYS[1..N]      = Redis HASH keys for each level
--                   (global, tenant, user, endpoint)
-- ARGV[1..N]      = capacity (max tokens) for each level
-- ARGV[N+1..2N]   = refill_rate (tokens/sec) for each level
-- ARGV[2N+1]      = now_sec  (Unix timestamp, whole seconds)
-- ARGV[2N+2]      = levels   (number of levels to check, 1-4)
-- ============================================================

local levels = tonumber(ARGV[1 + 2 * tonumber(ARGV[#ARGV])])
-- Re-read cleanly:
local level_count = tonumber(ARGV[#ARGV])
local now = tonumber(ARGV[#ARGV - 1])

local allowed = 1          -- innocent until proven guilty
local min_remaining = math.huge   -- track tightest constraint

-- ── PHASE 1: Speculative check across all configured levels ──
for i = 1, level_count do
    local key         = KEYS[i]
    local cap         = tonumber(ARGV[i])
    local rate        = tonumber(ARGV[level_count + i])

    -- Read current bucket state (or defaults for new keys)
    local data        = redis.call('HMGET', key, 'tokens', 'last_refill')
    local tokens      = tonumber(data[1]) or cap    -- new key → full bucket
    local last_refill = tonumber(data[2]) or now

    -- Lazy refill: compute tokens that should have accumulated
    local elapsed  = math.max(0, now - last_refill)
    local refilled = math.min(cap, tokens + elapsed * rate)

    -- Write back updated refill state (keeps clock current even on deny)
    redis.call('HMSET', key, 'tokens', refilled, 'last_refill', now)

    if refilled < 1 then
        allowed = 0   -- this level is exhausted — mark as denied
    end
    min_remaining = math.min(min_remaining, refilled)
end

-- ── PHASE 2: Conditional commit — only if all levels passed ──
if allowed == 1 then
    for i = 1, level_count do
        -- Re-read each level (state may have been updated by Phase 1 write)
        local current = tonumber(redis.call('HGET', KEYS[i], 'tokens'))
        redis.call('HSET', KEYS[i], 'tokens', current - 1)
    end
    -- Return: {allowed, min_remaining_after_decrement}
    return {1, math.floor(min_remaining - 1)}
end

-- Denied: return tightest remaining (useful for Retry-After computation)
return {0, math.floor(min_remaining)}`}</GoCodeBlock>
              </div>
              <p style={{ fontSize: 13, color: "#71717a", marginBottom: 28 }}>
                The script is loaded into Redis at startup via <code>SCRIPT LOAD</code>, and called on every hot-path request via <code>EVALSHA &lt;sha&gt;</code> to skip script re-compilation.
              </p>

              {/* Go Integration */}
              <h2 className="guide-sub-heading" id="go-integration" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                Go Integration: <code style={{ color: "#ff5cad", fontSize: 18 }}>AllowWithParams()</code>
              </h2>
              <p>
                The Go-side of the hierarchical limiter takes an HTTP request, resolves the applicable limits for each level (checking for runtime overrides), constructs the KEYS and ARGV arrays, and calls the Lua script:
              </p>

              <div style={{ background: "#0f0f12", border: "1px solid #27272a", borderRadius: 8, padding: "16px 20px", marginBottom: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#71717a", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  internal/limiter/hierarchical.go — AllowWithParams()
                </div>
                <GoCodeBlock>{`package limiter

import (
    "context"
    "fmt"
    "time"
    "github.com/redis/go-redis/v9"
)

type LevelConfig struct {
    Key      string
    Capacity int64   // max tokens the bucket holds
    Rate     int64   // tokens refilled per second
}

// AllowWithParams runs the two-phase hierarchical Lua check.
// configs: ordered slice of LevelConfig (global first, endpoint last).
// Returns: (allowed bool, minRemaining int64, err error)
func (h *HierarchicalLimiter) AllowWithParams(
    ctx context.Context,
    configs []LevelConfig,
) (bool, int64, error) {

    n := len(configs)
    keys := make([]string, n)
    // ARGV layout: [cap_0..cap_n-1, rate_0..rate_n-1, now_sec, level_count]
    args := make([]interface{}, 2*n+2)

    for i, cfg := range configs {
        keys[i] = cfg.Key
        args[i] = cfg.Capacity          // cap for level i
        args[n+i] = cfg.Rate            // rate for level i
    }
    args[2*n] = time.Now().Unix()       // now_sec
    args[2*n+1] = int64(n)             // level_count

    result, err := h.luaScript.Run(ctx, h.client, keys, args...).Int64Slice()
    if err != nil {
        return false, 0, fmt.Errorf("hierarchical check failed: %w", err)
    }
    return result[0] == 1, result[1], nil
}

// effectiveHierarchicalLimits merges base env config with runtime overrides.
// Override values fetched from Redis via OverrideStore (5s TTL local cache).
func (h *HierarchicalLimiter) effectiveHierarchicalLimits(
    ctx context.Context,
    tenantID, userID, path string,
) []LevelConfig {
    // Override store returns zero if no override set → falls back to env
    globalCap, globalRate := h.overrides.GetOrDefault(ctx, "global", "default",
        h.cfg.GlobalCapacity, h.cfg.GlobalRate)
    tenantCap, tenantRate := h.overrides.GetOrDefault(ctx, "tenant", tenantID,
        h.cfg.TenantCapacity, h.cfg.TenantRate)
    userCap, userRate := h.overrides.GetOrDefault(ctx, "user", userID,
        h.cfg.UserCapacity, h.cfg.UserRate)
    epCap, epRate := h.overrides.GetOrDefault(ctx, "endpoint",
        fmt.Sprintf("%s:%s", tenantID, path),
        h.cfg.EndpointCapacity, h.cfg.EndpointRate)

    return []LevelConfig{
        {Key: "rate:global:default",                  Capacity: globalCap, Rate: globalRate},
        {Key: fmt.Sprintf("rate:tenant:%s", tenantID), Capacity: tenantCap, Rate: tenantRate},
        {Key: fmt.Sprintf("rate:user:%s", userID),    Capacity: userCap,   Rate: userRate},
        {Key: fmt.Sprintf("rate:ep:%s:%s", tenantID, path), Capacity: epCap, Rate: epRate},
    }
}`}</GoCodeBlock>
              </div>

              {/* singleflight dedup */}
              <p>
                Because every sidecar instance calls the limiter for every request, a spike of 500 concurrent requests for the same user creates 500 redundant Redis round-trips. The sidecar uses a <code>singleflight.Group</code> to collapse these into one:
              </p>

              <DocsMermaid chart={singleflightDiagram} />

              {/* Runtime Overrides */}
              <h2 className="guide-sub-heading" id="overrides" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                Runtime Overrides via Admin API
              </h2>
              <p>
                Every limit in the hierarchy can be changed at runtime without a service restart. The Admin API writes override values to Redis; the limiter reads them via a local TTL cache (<code>OVERRIDE_CACHE_TTL_MS</code>, default 5 seconds):
              </p>

              <div style={{ background: "#0f0f12", border: "1px solid #27272a", borderRadius: 8, padding: "16px 20px", marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#71717a", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Example — Override tenant "acme" to 10× capacity for a flash sale
                </div>
                <GoCodeBlock>{`# Set override via Admin API (no restart required)
curl -X POST http://localhost:8082/admin/limits/tenant/acme \\
  -H "X-API-Key: $ADMIN_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"capacity": 20000, "refill_rate": 333}'

# Result: within OVERRIDE_CACHE_TTL_MS (default 5s),
# all limiter instances pick up the new tenant quota.
# To remove the override and revert to env defaults:
curl -X DELETE http://localhost:8082/admin/limits/tenant/acme \\
  -H "X-API-Key: $ADMIN_API_KEY"`}</GoCodeBlock>
              </div>

              <div style={{ overflowX: "auto", marginBottom: 24 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #27272a" }}>
                      {["Level", "Admin API Path", "Redis Key Written", "Effective After"].map(h => (
                        <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "#ff5cad", fontWeight: 600, fontSize: 12 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["Global", "POST /admin/limits/global/default", "config:global:default", "≤ OVERRIDE_CACHE_TTL_MS"],
                      ["Tenant", "POST /admin/limits/tenant/{id}", "config:tenant:{id}", "≤ OVERRIDE_CACHE_TTL_MS"],
                      ["User", "POST /admin/limits/user/{id}", "config:user:{id}", "≤ OVERRIDE_CACHE_TTL_MS"],
                      ["Endpoint", "POST /admin/limits/endpoint/{tenantID}:{path}", "config:endpoint:{tenantID}:{path}", "≤ OVERRIDE_CACHE_TTL_MS"],
                    ].map(([level, path, key, after], i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #18181b", background: i % 2 === 0 ? "#0b0b0b" : "#0f0f12" }}>
                        <td style={{ padding: "8px 12px", color: "#ffffff", fontWeight: 600 }}>{level}</td>
                        <td style={{ padding: "8px 12px", color: "#c084fc", fontFamily: "monospace", fontSize: 11 }}>{path}</td>
                        <td style={{ padding: "8px 12px", color: "#a78bfa", fontFamily: "monospace", fontSize: 11 }}>{key}</td>
                        <td style={{ padding: "8px 12px", color: "#c084fc" }}>{after}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Redis Cluster Caveat */}
              <h2 className="guide-sub-heading" id="cluster-caveat" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                Redis Cluster CROSSSLOT Limitation
              </h2>
              <p>
                Redis Cluster distributes keys across 16,384 hash slots. A Lua script that touches keys mapped to different slots is rejected with a <code>CROSSSLOT Keys in request don't hash to the same slot</code> error — because the cluster cannot route a single command to multiple shards atomically.
              </p>
              <p style={{ marginTop: 12 }}>
                The four hierarchical keys (<code>rate:global:default</code>, <code>rate:tenant:acme</code>, <code>rate:user:alice</code>, <code>rate:ep:acme:/orders</code>) will almost certainly hash to different slots.
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16, marginBottom: 24 }}>
                <div style={{ background: "#111113", border: "1px solid #c084fc33", borderRadius: 8, padding: "16px 18px" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#c084fc", marginBottom: 8 }}>[OK] Supported: Redis Sentinel HA</div>
                  <p style={{ fontSize: 12.5, color: "#a1a1aa", lineHeight: 1.6, margin: 0 }}>
                    A single Redis master (with replicas) processes all keys in a single process. Multi-key Lua scripts work with no restrictions. This is the recommended production configuration (<code>REDIS_MODE=sentinel</code>).
                  </p>
                </div>
                <div style={{ background: "#111113", border: "1px solid #f4405033", borderRadius: 8, padding: "16px 18px" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#ec4899", marginBottom: 8 }}>[Error] Not Supported: Redis Cluster</div>
                  <p style={{ fontSize: 12.5, color: "#a1a1aa", lineHeight: 1.6, margin: 0 }}>
                    Redis Cluster mode will throw CROSSSLOT errors for the hierarchical Lua script. Workaround: use hash tags to pin all four keys to the same slot — e.g. <code>{"{rl:acme}"}:global</code>, <code>{"{rl:acme}"}:tenant</code>, etc. This requires key naming changes throughout.
                  </p>
                </div>
              </div>

              {/* Response Headers */}
              <h2 className="guide-sub-heading" id="headers" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                Response Headers
              </h2>
              <p>
                The sidecar injects standard rate limit headers on every response — both allowed and denied:
              </p>

              <div style={{ overflowX: "auto", marginBottom: 20 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #27272a" }}>
                      {["Header", "Example Value", "Description"].map(h => (
                        <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "#ff5cad", fontWeight: 600, fontSize: 12 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["X-RateLimit-Limit", "500", "The configured capacity of the tightest bucket that applied."],
                      ["X-RateLimit-Remaining", "47", "Minimum tokens remaining across all hierarchy levels after this request."],
                      ["X-RateLimit-Reset", "1751481600", "Unix timestamp when the tightest bucket is expected to fully refill."],
                      ["Retry-After", "3", "On 429: seconds until the tightest bucket will have ≥ 1 token. Computed as: ceil((1 − remaining) / rate)."],
                      ["X-RateLimit-Policy", "hierarchical; levels=4", "Signals to clients which policy was applied (hierarchical vs flat)."],
                    ].map(([header, val, desc], i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #18181b", background: i % 2 === 0 ? "#0b0b0b" : "#0f0f12" }}>
                        <td style={{ padding: "8px 12px", color: "#c084fc", fontFamily: "monospace", fontSize: 11 }}>{header}</td>
                        <td style={{ padding: "8px 12px", color: "#c084fc", fontFamily: "monospace" }}>{val}</td>
                        <td style={{ padding: "8px 12px", color: "#a1a1aa" }}>{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{
                background: "rgba(192, 132, 252,0.05)", border: "1px solid rgba(192, 132, 252,0.2)",
                borderRadius: 8, padding: "14px 18px", fontSize: 13, lineHeight: 1.65
              }}>
                <strong style={{ color: "#c084fc" }}>Design Note — Minimum Remaining:</strong> The <code>X-RateLimit-Remaining</code> header reports the <em>minimum</em> across all 4 levels after decrement, not the user-level remaining. This is intentional — it correctly represents how many more requests will be allowed under the tightest current constraint, regardless of which level is the bottleneck.
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

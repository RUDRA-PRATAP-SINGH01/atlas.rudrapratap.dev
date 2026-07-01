import DocsNavbar from "@/components/docs/DocsNavbar";
import DocsSidebar from "@/components/docs/DocsSidebar";
import DocsMermaid from "@/components/docs/DocsMermaid";
import GoCodeBlock from "@/components/docs/GoCodeBlock";

const pageTopics = [
  { label: "Concept & Scope", href: "#concept" },
  { label: "Hierarchy Levels", href: "#levels" },
  { label: "Atomic Lua Check", href: "#lua-check" },
  { label: "Redis Cluster Caveat", href: "#cluster-caveat" },
  { label: "Go Implementation", href: "#go-impl" },
];

const hierarchicalCheckDiagram = `
flowchart TD
    Start(["AllowWithParams called"])
    Load1["HMGET global_key 'tokens','last_refill'"]
    Refill1["Refill global bucket\\nelapsed × global_rate + tokens"]
    Check1{"global tokens ≥ 1?"}
    Load2["HMGET tenant_key 'tokens','last_refill'"]
    Refill2["Refill tenant bucket"]
    Check2{"tenant tokens ≥ 1?"}
    Load3["HMGET user_key 'tokens','last_refill'"]
    Refill3["Refill user bucket"]
    Check3{"user tokens ≥ 1?"}
    Load4["HMGET endpoint_key 'tokens','last_refill'"]
    Refill4["Refill endpoint bucket"]
    Check4{"endpoint tokens ≥ 1?"}
    
    AllAllowed{"all 4 levels\\nallowed?"}
    Decrement["Decrement each level by 1\\n(4 × HSET)"]
    ReturnAllow(["return {1, min_remaining-1}"])
    ReturnDeny(["return {0, 0}"])
    
    Start --> Load1 --> Refill1
    Refill1 --> Check1
    Check1 -->|"no → set allowed=0"| Load2
    Check1 -->|"yes"| Load2
    Load2 --> Refill2 --> Check2
    Check2 -->|"no → set allowed=0"| Load3
    Check2 -->|"yes"| Load3
    Load3 --> Refill3 --> Check3
    Check3 -->|"no → set allowed=0"| Load4
    Check3 -->|"yes"| Load4
    Load4 --> Refill4 --> Check4
    Check4 --> AllAllowed
    AllAllowed -->|"yes"| Decrement --> ReturnAllow
    AllAllowed -->|"no"| ReturnDeny

    style Start fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style AllAllowed fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style Decrement fill:#1e1e2e,stroke:#4ade80,color:#fff
    style ReturnAllow fill:#1e1e2e,stroke:#4ade80,color:#fff
    style ReturnDeny fill:#1e1e2e,stroke:#f43f5e,color:#fff
`;

export default function RLHierarchicalPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="concept">
              Hierarchical Multi-Tenant Quotas
            </h1>

            <div className="guide-body-text" style={{ marginTop: 24 }}>
              
              {/* Concept Intro */}
              <p>
                In multi-tenant SaaS environments, flat rate limiting is insufficient. If limits are only applied at a tenant level, a single misbehaving client user could consume the entire organization's rate quota, starving their coworkers. Conversely, limiting only at the individual user level exposes the system to a coordinate attack where thousands of users of a single tenant overwhelm downstream databases.
              </p>
              <p style={{ marginTop: 12 }}>
                To solve this, the Distributed Rate Limiter enforces a <strong style={{ color: "#ff5cad" }}>4-level hierarchical quota tree</strong>. Every incoming request must simultaneously pass checks across all levels before any token is consumed.
              </p>

              {/* Levels Section */}
              <h2 className="guide-sub-heading" id="levels" style={{ fontSize: 22, color: "#ffffff", marginTop: 36, marginBottom: 12 }}>
                The Hierarchy Levels
              </h2>
              <p>
                The system checks four namespaces of token buckets from top to bottom:
              </p>

              <div style={{
                display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14, marginTop: 16, marginBottom: 24
              }}>
                {[
                  { level: "Global Limit", key: "rate:global:default", desc: "A system-wide guardrail protecting the overall database capacity and external third-party gateways from complete service degradation.", badge: "Level 1" },
                  { level: "Tenant Limit", key: "rate:tenant:{tenantID}", desc: "Per-organization cap. Ensures contract-tier compliance (e.g. Free Tier: 60/min, Enterprise: 5000/sec) and prevents cross-tenant resource starvation.", badge: "Level 2" },
                  { level: "User Limit", key: "rate:user:{userID}", desc: "Per-user cap inside a tenant. Isolates abusive or runaway scripts within a single user account without impacting other users in the same organization.", badge: "Level 3" },
                  { level: "Endpoint Limit", key: "rate:ep:{tenantID}:{path}", desc: "Per-endpoint path cap. Applies tighter restrictions to resource-heavy paths (like /reports/export) compared to lighter paths (like /heartbeat).", badge: "Level 4" },
                ].map((item, i) => (
                  <div key={i} style={{
                    background: "#0f0f12", border: "1px solid rgba(255,92,173,0.15)",
                    borderRadius: 8, padding: "16px 18px"
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: "bold", color: "#ffffff" }}>{item.level}</span>
                      <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 999, background: "rgba(255,92,173,0.15)", color: "#ff5cad", fontWeight: 600 }}>{item.badge}</span>
                    </div>
                    <code style={{ fontSize: 11, color: "#38bdf8", display: "block", marginBottom: 10, wordBreak: "break-all" }}>{item.key}</code>
                    <p style={{ fontSize: 12.5, color: "#a1a1aa", lineHeight: 1.6, margin: 0 }}>{item.desc}</p>
                  </div>
                ))}
              </div>

              {/* Atomic Lua Check */}
              <h2 className="guide-sub-heading" id="lua-check" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                Atomic Check-and-Decrement Flow
              </h2>
              <p>
                A key challenge with multi-level rate limiting is preventing partial consumption. If you check levels sequentially and consume tokens as you go, a request might consume a token from Level 1 and Level 2, but fail at Level 3. This would leak tokens from the parent levels, artificially starving parent limits.
              </p>
              <p style={{ marginTop: 12 }}>
                To solve this, the limiter executes an atomic two-phase Lua script:
              </p>
              <ul className="guide-bullets-list" style={{ marginTop: 12, marginBottom: 20 }}>
                <li><strong>Phase 1 (Check & Refill):</strong> The script dry-runs the check on all four keys, lazily refilling them based on elapsed time, and tracks if any level fails.</li>
                <li><strong>Phase 2 (Conditional Commit):</strong> If and only if all levels have at least 1 token, the script decrements all four buckets and returns <code>allowed=1</code>. If any level fails, no tokens are decremented.</li>
              </ul>

              <DocsMermaid chart={hierarchicalCheckDiagram} />

              <div style={{ background: "#0f0f12", border: "1px solid #27272a", borderRadius: 8, padding: "16px 20px", marginTop: 24, marginBottom: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#71717a", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  internal/limiter/lua/hierarchical.lua
                </div>
                <GoCodeBlock>{`-- KEYS[1..N] = rate keys (global, tenant, user, endpoint)
-- ARGV[1..N] = capacity per level
-- ARGV[N+1..2N] = refill_rate per level
-- ARGV[2N+1] = now_sec (timestamp)
-- ARGV[2N+2] = levels count (1 to 4)

local now = tonumber(ARGV[2*levels+1])
local levels = tonumber(ARGV[2*levels+2])
local allowed = 1
local min_remaining = math.huge

-- Phase 1: Dry-run check across all active buckets
for i = 1, levels do
    local key = KEYS[i]
    local cap = tonumber(ARGV[i])
    local rate = tonumber(ARGV[levels + i])
    
    local data = redis.call('HMGET', key, 'tokens', 'last_refill')
    local tokens = tonumber(data[1]) or cap
    local last_refill = tonumber(data[2]) or now
    local elapsed = math.max(0, now - last_refill)
    local refilled = math.min(cap, tokens + elapsed * rate)
    
    -- Keep time updated even if check fails
    redis.call('HMSET', key, 'tokens', refilled, 'last_refill', now)
    
    if refilled < 1 then
        allowed = 0
    end
    min_remaining = math.min(min_remaining, refilled)
end

-- Phase 2: If authorized, commit changes to all levels
if allowed == 1 then
    for i = 1, levels do
        local tokens = tonumber(redis.call('HGET', KEYS[i], 'tokens'))
        redis.call('HSET', KEYS[i], 'tokens', tokens - 1)
    end
    return {1, math.floor(min_remaining - 1)}
end

return {0, 0}`}</GoCodeBlock>
              </div>

              {/* Cluster Caveat */}
              <h2 className="guide-sub-heading" id="cluster-caveat" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                Redis Cluster CROSSSLOT Limitation
              </h2>
              <p>
                In Redis Cluster configurations, the keys are distributed across 16,384 slots based on the hash of the key name. Since hierarchical limiting acts on separate keys (e.g. <code>rate:global</code>, <code>rate:tenant:abc</code>, etc.), these keys will hash to different slots.
              </p>
              <div style={{
                background: "rgba(244,63,94,0.06)",
                border: "1px solid rgba(244,63,94,0.2)",
                borderRadius: 8, padding: "14px 18px",
                fontSize: 13, lineHeight: 1.65, marginTop: 12, marginBottom: 20
              }}>
                <strong style={{ color: "#f87171" }}>⚠️ The CROSSSLOT Error:</strong> Redis prohibits executing a Lua script that references keys mapped to different cluster slots. Running the hierarchical script unmodified on a Redis Cluster will crash with a <code>CROSSSLOT Keys in request don't hash to the same slot</code> error.
              </div>
              <p>
                To work around this constraint, the project provides two solutions:
              </p>
              <ul className="guide-bullets-list" style={{ marginTop: 12, marginBottom: 24 }}>
                <li><strong style={{ color: "#ff5cad" }}>Sentinel Topology:</strong> Standard HA routing via Redis Sentinel, which maintains a single primary node, allowing cross-key Lua atomic runs safely.</li>
                <li><strong style={{ color: "#ff5cad" }}>Hash Tags:</strong> For Cluster configurations, key naming can use braces to force all hierarchical keys onto the same slot (e.g. <code>{"{tenantID}"}:rate:global</code>, <code>{"{tenantID}"}:rate:tenant</code>, etc.). This ensures they all hash to the same cluster slot.</li>
              </ul>

              {/* Go Implementation */}
              <h2 className="guide-sub-heading" id="go-impl" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                Go Implementation Spec
              </h2>
              <p>
                The limiter service exposes the <code>/check_hierarchical</code> path to run the evaluation. In Go, the limits are compiled into arrays and sent directly to Redis:
              </p>
              <GoCodeBlock>{`package limiter

import (
	"context"
	"time"
	"github.com/redis/go-redis/v9"
)

type HierarchicalLimiter struct {
	client     redis.Cmdable
	luaScript  *redis.Script
}

type LimitConfig struct {
	Key      string
	Capacity int64
	Rate     int64
}

func (hl *HierarchicalLimiter) Allow(ctx context.Context, configs []LimitConfig) (bool, int64, error) {
	keys := make([]string, len(configs))
	args := make([]interface{}, 2*len(configs)+2)
	
	// Pack capacities
	for i, cfg := range configs {
		keys[i] = cfg.Key
		args[i] = cfg.Capacity
		args[len(configs)+i] = cfg.Rate
	}
	
	// Add common args (now, levelCount)
	args[2*len(configs)] = time.Now().Unix()
	args[2*len(configs)+1] = int64(len(configs))
	
	res, err := hl.luaScript.Run(ctx, hl.client, keys, args...).Int64Slice()
	if err != nil {
		return false, 0, err
	}
	
	return res[0] == 1, res[1], nil
}`}</GoCodeBlock>

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

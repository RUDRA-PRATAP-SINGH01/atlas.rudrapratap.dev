import DocsNavbar from "@/features/docs/components/DocsNavbar";
import DocsSidebar from "@/features/docs/components/DocsSidebar";
import DocsMermaid from "@/features/docs/components/DocsMermaid";
import GoCodeBlock from "@/features/docs/components/GoCodeBlock";

const pageTopics = [
  { label: "Request Entry Points", href: "#entry-points" },
  { label: "Normal Request Flow", href: "#normal-flow" },
  { label: "Idempotent Request Flow", href: "#idem-flow" },
  { label: "Hierarchical Check Flow", href: "#hierarchical-flow" },
  { label: "Rate Limit Headers", href: "#headers" },
  { label: "Failure Modes", href: "#failure-modes" },
  { label: "Sequence Diagram", href: "#sequence" },
];

const normalFlowDiagram = `
sequenceDiagram
    participant C as Client
    participant SC as Sidecar (:9090)
    participant LIM as Limiter (:8080)
    participant R as Redis

    C->>SC: GET /api/orders (X-User-ID: user123)
    SC->>SC: ResolveUserID → "user123"
    SC->>SC: cache.Load("default|user123|/api/orders") → miss
    
    Note over SC: singleflight.Do collapses concurrent misses
    
    SC->>LIM: GET /check_hierarchical?endpoint=/api/orders<br/>X-User-ID: user123, X-Tenant-ID: acme
    LIM->>LIM: effectiveHierarchicalLimits(cfg, overrideStore, ...)
    LIM->>R: EVALSHA hierarchical.lua KEYS[global,tenant,user,endpoint]
    
    Note over R: Single Lua execution — atomic across all 4 buckets
    R-->>LIM: [1, 47] (allowed=true, remaining=47)
    
    LIM-->>SC: 200 OK {allowed:true, remaining:47}<br/>X-RateLimit-Limit: 100<br/>X-RateLimit-Remaining: 47
    
    SC->>SC: cache.Store(key, CacheEntry{Allowed:true, ...})
    SC->>SC: writeRateLimitHeaders(w, 100, 47)
    SC->>C: Forward request → upstream backend
    Note over SC: proxy.ServeHTTP or router.Forward
`;

const idemFlowDiagram = `
sequenceDiagram
    participant C as Client
    participant SC as Sidecar
    participant R as Redis
    participant UP as Upstream

    C->>SC: POST /payments (Idempotency-Key: pay-xyz-001)
    SC->>SC: ValidateKey("pay-xyz-001") [OK]
    SC->>SC: ReadBody(r, maxBytes) → body bytes
    SC->>SC: BuildScope(tenantID, userID) → SHA256 prefix
    SC->>SC: Fingerprint(method, path, query, body) → SHA256

    SC->>R: EVALSHA claim.lua KEYS[meta_key, body_key]<br/>ARGV[req_hash, now_ms, lock_ttl, completed_ttl, fence_token]
    
    alt First-time claim (status = nil)
        R-->>SC: {1, "fence-abc-123"} → ResultClaimed
        SC->>SC: checkRateLimit() → allowed
        SC->>UP: POST /payments (proxied)
        UP-->>SC: 201 Created {id: "pay-001"}
        SC->>R: EVALSHA complete.lua<br/>ARGV[201, headers, body, ttl, now, threshold, fence_token]
        R-->>SC: {1} [OK] stored
        SC-->>C: 201 Created {id: "pay-001"}
    
    else Retry — already completed
        R-->>SC: {2, 201, headers, body} → ResultReplay
        SC-->>C: 201 Created {id: "pay-001"} (from cache)
        Note over SC,C: X-Idempotency-Status: replay
    
    else Still in progress
        R-->>SC: {3, retry_after_ms} → ResultInProgress
        SC-->>C: 409 Conflict (Retry-After header)
    
    else Hash mismatch (different body, same key)
        R-->>SC: {0} → ResultHashMismatch
        SC-->>C: 422 Unprocessable Entity
    end
`;

const hierarchicalLuaFlow = `
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
    style Decrement fill:#1e1e2e,stroke:#c084fc,color:#fff
    style ReturnAllow fill:#1e1e2e,stroke:#c084fc,color:#fff
    style ReturnDeny fill:#1e1e2e,stroke:#ec4899,color:#fff
`;

export default function RLRequestLifecyclePage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="entry-points">
              Request Lifecycle
            </h1>

            <div className="guide-body-text" style={{ marginTop: 24 }}>

              <p>
                Every client request enters the system at the sidecar proxy and passes through a defined pipeline before either being forwarded to the upstream or rejected with a 429. Understanding this lifecycle is essential for diagnosing latency issues, debugging incorrect rejections, and reasoning about quota consumption.
              </p>

              {/* Entry points */}
              <h2 className="guide-sub-heading" id="entry-points" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                Request Entry Points
              </h2>

              <p>Requests enter the system at one of two entry points:</p>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginTop: 14, marginBottom: 28 }}>
                <div style={{ background: "#0f0f12", border: "1px solid rgba(255,92,173,0.25)", borderRadius: 8, padding: "16px 20px" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#ff5cad", marginBottom: 8 }}>Via Sidecar Proxy</div>
                  <p style={{ fontSize: 13, color: "#a1a1aa", lineHeight: 1.6, margin: 0 }}>
                    All client-facing traffic goes through the sidecar on port <code style={{ color: "#ff5cad" }}>:9090</code>. The sidecar intercepts, checks quota, and either forwards or rejects. This is the standard production flow.
                  </p>
                </div>
                <div style={{ background: "#0f0f12", border: "1px solid rgba(192, 132, 252,0.2)", borderRadius: 8, padding: "16px 20px" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#c084fc", marginBottom: 8 }}>Direct to Central Limiter</div>
                  <p style={{ fontSize: 13, color: "#a1a1aa", lineHeight: 1.6, margin: 0 }}>
                    Internal services (like other microservices) can call the limiter directly on port <code style={{ color: "#c084fc" }}>:8080</code>. They must present the <code style={{ color: "#c084fc" }}>X-Internal-API-Key</code> header.
                  </p>
                </div>
              </div>

              {/* Normal request flow */}
              <h2 className="guide-sub-heading" id="normal-flow" style={{ fontSize: 22, color: "#ffffff", marginTop: 36, marginBottom: 12 }}>
                Normal Request Flow (Sequence Diagram)
              </h2>
              <p>This shows the complete lifecycle of a non-idempotent, hierarchical-mode request:</p>
              <DocsMermaid chart={normalFlowDiagram} />

              {/* Key code path */}
              <div style={{
                background: "#0f0f12", border: "1px solid #27272a", borderRadius: 8,
                padding: "16px 20px", marginBottom: 24
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#71717a", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Key Code Path (cmd/sidecar/main.go)
                </div>
                <GoCodeBlock>{`func (s *Sidecar) ServeHTTP(w http.ResponseWriter, r *http.Request) {
    // 1. Skip internal paths
    if r.URL.Path == "/health" || r.URL.Path == "/metrics" {
        http.NotFound(w, r)
        return
    }
    // 2. Path allowlist
    if !s.pathAllowed(r.URL.Path) {
        http.Error(w, "path not allowed", http.StatusNotFound)
        return
    }
    // 3. Resolve user identity
    userID, err := identity.ResolveUserID(r, s.allowQueryUserID)
    if err != nil {
        http.Error(w, err.Error(), http.StatusBadRequest)
        return
    }
    // 4. Branch: idempotent vs normal
    idemKey := strings.TrimSpace(r.Header.Get("Idempotency-Key"))
    if s.idempotency != nil && idemKey != "" && idempotency.IsMutatingMethod(r.Method) {
        s.serveIdempotent(w, r, userID, idemKey)
        return
    }
    s.serveNormal(w, r, userID)
}`}</GoCodeBlock>
              </div>

              {/* Cache and singleflight */}
              <h3 style={{ fontSize: 17, color: "#ffffff", marginBottom: 10 }}>The Denial Cache and singleflight</h3>
              <p>
                The sidecar maintains a <code style={{ color: "#ff5cad" }}>sync.Map</code> cache keyed by <code style={{ color: "#ff5cad" }}>tenantID|userID|path</code>. Only <strong>denials</strong> are cached, never allowances. This is a deliberate security decision:
              </p>
              <ul className="guide-bullets-list" style={{ marginTop: 10, marginBottom: 16 }}>
                <li>Caching denials reduces Redis load during abuse. A user that has exceeded quota will trigger repeated 429s without hitting the limiter on every retry.</li>
                <li>Caching allowances is dangerous: if a user sends one request, is cached as "allowed", and then exhausts their quota — subsequent requests during the cache TTL window would bypass enforcement.</li>
                <li><code style={{ color: "#ff5cad" }}>singleflight.Group</code> ensures that 100 concurrent misses for the same key result in only 1 limiter call. All 100 goroutines share the single result.</li>
              </ul>

              <GoCodeBlock>{`// Only cache denials — never cache "allowed" (quota freeze attack vector)
resultAny, err, _ := s.limitFlight.Do(cacheKey, func() (interface{}, error) {
    return s.checkRateLimit(ctx, r, userID, false)
})
// ...
result := resultAny.(limitResult)
s.cache.Store(cacheKey, CacheEntry{
    Allowed:    result.allowed,  // stored but ignored on cache hit if Allowed=true
    Remaining:  result.remaining,
    ExpiresAt:  time.Now().Add(s.ttl),
})
// Cache hit handling — only serve denial from cache:
if !entry.Allowed {
    s.writeDenial(w, entry.Limit, entry.Remaining, entry.RetryAfter)
    return
}
// Allowed entries in cache: fall through to central limiter anyway`}</GoCodeBlock>

              {/* Idempotent request flow */}
              <h2 className="guide-sub-heading" id="idem-flow" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                Idempotent Request Flow
              </h2>
              <p>
                When a request carries an <code style={{ color: "#ff5cad" }}>Idempotency-Key</code> header and uses a mutating HTTP method (POST, PUT, PATCH), the sidecar routes it through the idempotency pipeline before the normal rate limit check. This ensures exactly-once execution semantics for retried requests.
              </p>
              <DocsMermaid chart={idemFlowDiagram} />

              <div style={{
                background: "rgba(192, 132, 252,0.06)",
                border: "1px solid rgba(192, 132, 252,0.2)",
                borderRadius: 8, padding: "14px 18px",
                fontSize: 13, lineHeight: 1.65, marginBottom: 24
              }}>
                <strong style={{ color: "#c084fc" }}>Fence Tokens:</strong> The <code style={{ color: "#c084fc" }}>claim.lua</code> script generates a UUID fence token and stores it alongside the idempotency record. The <code style={{ color: "#c084fc" }}>complete.lua</code> and <code style={{ color: "#c084fc" }}>fail.lua</code> scripts check the fence token before writing. This prevents a stale sidecar instance (e.g., mid-crash) from overwriting the result written by a different instance that won the claim race.
              </div>

              {/* Hierarchical check */}
              <h2 className="guide-sub-heading" id="hierarchical-flow" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                Hierarchical Check Flow (Inside Lua)
              </h2>
              <p>
                The <code style={{ color: "#ff5cad" }}>/check_hierarchical</code> endpoint runs a single Lua script that checks all four token bucket levels in sequence. If <em>any</em> level is exhausted, the entire request is denied and <em>no</em> tokens are decremented from any level. This two-phase approach prevents partial quota consumption.
              </p>
              <DocsMermaid chart={hierarchicalLuaFlow} />

              <div style={{
                background: "#0f0f12", border: "1px solid #27272a", borderRadius: 8,
                padding: "16px 20px", marginBottom: 24
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#71717a", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  hierarchical.lua — Phase 2 (Decrement)
                </div>
                <GoCodeBlock>{`-- Step 2: If all levels allowed, decrement each by 1
local remaining = 0
if allowed == 1 then
    for i = 1, levels do
        local key = KEYS[i]
        -- Re-read tokens (already refilled in step 1)
        local tokens = tonumber(redis.call('HGET', key, 'tokens'))
        redis.call('HSET', key, 'tokens', tokens - 1)
    end
    remaining = math.floor(min_remaining - 1)
else
    remaining = 0
end

return {allowed, remaining}`}</GoCodeBlock>
              </div>

              {/* Rate limit headers */}
              <h2 className="guide-sub-heading" id="headers" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                Rate Limit Response Headers
              </h2>
              <p>Every response from the sidecar includes these standard headers:</p>
              <div style={{ overflowX: "auto", marginBottom: 24 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #27272a" }}>
                      {["Header", "Value Example", "Description"].map(h => (
                        <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "#ff5cad", fontWeight: 600, fontSize: 12 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["X-RateLimit-Limit", "100", "The maximum number of requests allowed in the current bucket period."],
                      ["X-RateLimit-Remaining", "47", "Tokens remaining in the tightest-constrained bucket (minimum across all hierarchical levels)."],
                      ["Retry-After", "1", "Seconds until quota refills (only sent on 429 responses)."],
                      ["X-Idempotency-Status", "created / replay", "Idempotency requests only. 'created' = first execution; 'replay' = cached response."],
                      ["X-Gateway-ID", "gateway-a", "Routing mode only. The gateway that served the upstream request."],
                      ["X-Gateway-Score", "1.83", "Routing mode only. The computed score of the selected gateway."],
                      ["X-Gateway-Failover", "true", "Routing mode only. Present if the primary gateway was skipped."],
                    ].map(([header, val, desc], i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #18181b", background: i % 2 === 0 ? "#0b0b0b" : "#0f0f12" }}>
                        <td style={{ padding: "8px 12px", color: "#ff5cad", fontFamily: "monospace", fontSize: 12 }}>{header}</td>
                        <td style={{ padding: "8px 12px", color: "#c084fc", fontFamily: "monospace" }}>{val}</td>
                        <td style={{ padding: "8px 12px", color: "#a1a1aa" }}>{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Failure modes */}
              <h2 className="guide-sub-heading" id="failure-modes" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                Failure Modes &amp; Fallbacks
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
                {[
                  {
                    scenario: "Central Limiter unreachable (network error)",
                    failOpen: "Forward request (FAIL_OPEN=true)",
                    failClosed: "Return 503 (FAIL_OPEN=false, default)",
                    recommendation: "Use fail-closed in production. Fail-open allows quota bypass."
                  },
                  {
                    scenario: "Redis timeout during Lua script",
                    failOpen: "Circuit breaker records timeout; limiter returns 503",
                    failClosed: "Sidecar circuit breaker trips after threshold; future requests fast-fail",
                    recommendation: "The circuit breaker prevents Redis from being hammered during degradation."
                  },
                  {
                    scenario: "Idempotency store unavailable",
                    failOpen: "Proceed without dedup (IDEMPOTENCY_FAIL_OPEN=true)",
                    failClosed: "Return 503 Idempotency store unavailable",
                    recommendation: "Depends on business requirements. Financial transactions should fail closed."
                  },
                  {
                    scenario: "All gateways unhealthy (routing mode)",
                    failOpen: "N/A — router always fails closed",
                    failClosed: "Return 503 'all gateways unavailable'",
                    recommendation: "Add at least 3 gateways. The router will attempt each in score order."
                  },
                ].map((fm, i) => (
                  <div key={i} style={{ background: "#0f0f12", border: "1px solid #1e1e24", borderRadius: 8, padding: "14px 18px" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#ffffff", marginBottom: 8 }}>{fm.scenario}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 8 }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "#c084fc", marginBottom: 3 }}>FAIL OPEN</div>
                        <div style={{ fontSize: 12.5, color: "#a1a1aa" }}>{fm.failOpen}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "#f472b6", marginBottom: 3 }}>FAIL CLOSED</div>
                        <div style={{ fontSize: 12.5, color: "#a1a1aa" }}>{fm.failClosed}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: "#c084fc", borderTop: "1px solid #18181b", paddingTop: 8 }}>
                      Note: {fm.recommendation}
                    </div>
                  </div>
                ))}
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

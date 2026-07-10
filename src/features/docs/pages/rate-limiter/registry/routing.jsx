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

const routingMiddlewareFlow = `
flowchart TD
    In([Inbound :9090]) --> Path{"/health or /metrics?"}
    Path -->|yes| NF[404 NotFound]
    Path -->|no| Allow{pathAllowed?}
    Allow -->|no| P404[404 path not allowed]
    Allow -->|yes| User[ResolveUserID]
    User --> Idem{Idempotency-Key +\\nmutating method?}
    Idem -->|yes| SI[serveIdempotent\\nspan: sidecar.idempotency]
    Idem -->|no| SN[serveNormal\\nspan: sidecar.proxy]
    SI --> Claim[claim.lua]
    Claim -->|replay| Replay([Cached response])
    Claim -->|claimed| RL1[checkRateLimit\\nspan: sidecar.rate_limit_check]
    RL1 --> FwdI[forwardIdempotent\\nspan: sidecar.upstream_proxy]
    SN --> Cache{Denial cache hit?\\nAllowed=false only}
    Cache -->|yes| Deny429[429 denial]
    Cache -->|no| SF[singleflight.Do]
    SF --> RL2[checkRateLimit\\nspan: sidecar.rate_limit_check]
    RL2 -->|denied| Deny429
    RL2 -->|allowed| FwdN[forwardRequest\\nspan: sidecar.upstream_proxy]
    FwdI --> Route{router != nil?}
    FwdN --> Route
    Route -->|yes| IR[Router.Forward\\nspan: sidecar.intelligent_route]
    Route -->|no| RP[httputil.ReverseProxy\\nUPSTREAM_URL]
    IR --> Out([Client response])
    RP --> Out
    style In fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style Out fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style IR fill:#1e1e2e,stroke:#c084fc,color:#fff
    style Deny429 fill:#1e1e2e,stroke:#ec4899,color:#fff
`;

const failoverSequence = `
sequenceDiagram
    autonumber
    participant SC as Sidecar Router
    participant CB as cb:gateway-id
    participant GA as Gateway Alpha
    participant GB as Gateway Beta
    participant R as Redis route:gw:*

    SC->>R: ListGateways (SMEMBERS route:index)
    SC->>SC: PickPrimary — weighted random on ComputeScore
    SC->>CB: Allow(ctx, alpha)
    CB-->>SC: allowed
    SC->>GA: Forward request
    GA-->>SC: 504 / transport error
    SC->>R: record_outcome.lua (failure)
    SC->>CB: Record(failure)
    Note over SC: FailoverOrder — score descending, MaxFailoverTries=3
    SC->>CB: Allow(ctx, beta)
    SC->>GB: Forward with X-Gateway-Failover: true
    GB-->>SC: 200 OK
    SC->>R: record_outcome.lua (success)
    SC-->>Client: 200 + X-Gateway-ID + X-Gateway-Score
`;

export const routingPages = {
  "sidecar-architecture": {
    title: "Sidecar Architecture",
    topics: [
      { label: "Proxy Boundary & Interception", href: "#boundary" },
      { label: "Middleware Sequence", href: "#middleware" },
      { label: "OTel Span Hierarchy", href: "#tracing" },
      { label: "ServeHTTP Entry Point", href: "#serve-http" },
      { label: "serveNormal Pipeline", href: "#serve-normal" },
      { label: "serveIdempotent Pipeline", href: "#serve-idempotent" },
      { label: "Sidecar /health Semantics", href: "#health" },
      { label: "Design Rationale", href: "#rationale" },
      { label: "Limitations", href: "#limitations" }
    ],
    content: (
      <div>
        <RLThesis>
          The sidecar (<code>cmd/sidecar</code>, default <code>:9090</code>) is the sole client-facing HTTP boundary.
          Every proxied request enters through <code>Sidecar.ServeHTTP</code>, which branches into{" "}
          <code>serveIdempotent</code> (mutating method + <code>Idempotency-Key</code>) or{" "}
          <code>serveNormal</code> (all other traffic). Both paths call <code>checkRateLimit</code> before forwarding;
          routing mode delegates upstream proxying to <code>Router.Forward</code> when{" "}
          <code>ENABLE_ROUTING=true</code>.
        </RLThesis>

        <RLQuickModel>
          Client → <code>ServeHTTP</code> → (optional idempotency claim) → denial cache / singleflight →{" "}
          <code>checkRateLimit</code> → <code>forwardRequest</code> or <code>forwardIdempotent</code> → either{" "}
          <code>UPSTREAM_URL</code> reverse proxy or intelligent router. Internal paths <code>/health</code> and{" "}
          <code>/metrics</code> are handled by a separate mux — not the proxy handler.
        </RLQuickModel>

        <RLStatGrid stats={[
          { value: ":9090", label: "Sidecar listen port (PORT env)", evidence: "SOURCE-PROVEN" },
          { value: "30ms", label: "Denial cache TTL (CACHE_TTL_MS)", evidence: "SOURCE-PROVEN" },
          { value: "5 spans", label: "OTel spans on hot path", evidence: "SOURCE-PROVEN" }
        ]} />

        <h2 className="guide-sub-heading" id="boundary">Proxy Boundary & Interception</h2>
        <p>
          The sidecar runs as a separate process beside application containers. It intercepts inbound HTTP on{" "}
          <code>:9090</code>, enforces path allowlists (<code>ALLOWED_PATHS</code>), resolves tenant/user identity,
          performs rate-limit checks against the central limiter, and forwards allowed traffic upstream. Proxy logic
          is isolated from application code — upgrades and policy changes deploy independently of service binaries.{" "}
          <RLEvidenceBadge type="SOURCE-PROVEN" />
        </p>

        <h2 className="guide-sub-heading" id="middleware">Middleware Sequence</h2>
        <p>
          The diagram below reflects the verified handler chain from <code>cmd/sidecar/main.go</code> — not a
          conceptual proxy struct. Idempotency runs <em>before</em> the denial cache; rate limiting always precedes
          upstream forwarding.
        </p>
        <DocsMermaid chart={routingMiddlewareFlow} />

        <h2 className="guide-sub-heading" id="tracing">OTel Span Hierarchy</h2>
        <p>
          When <code>OTEL_ENABLED=true</code>, the sidecar creates nested spans on the hot path. These are the
          verified span names from source — not inferred aliases:
        </p>
        <ul className="guide-bullets-list">
          <li><code>sidecar.proxy</code> — wraps <code>serveNormal</code> (path attribute set)</li>
          <li><code>sidecar.idempotency</code> — wraps <code>serveIdempotent</code></li>
          <li><code>sidecar.rate_limit_check</code> — wraps every <code>checkRateLimit</code> RPC</li>
          <li><code>sidecar.upstream_proxy</code> — wraps <code>forwardRequest</code> and <code>forwardIdempotent</code></li>
          <li><code>sidecar.intelligent_route</code> — wraps <code>Router.Forward</code> when routing is enabled</li>
        </ul>

        <h2 className="guide-sub-heading" id="serve-http">ServeHTTP Entry Point</h2>
        <RLSourceExcerpt
          source="cmd/sidecar/main.go — ServeHTTP"
          establishes="Single entry point; /health and /metrics return 404 on the proxy handler; idempotency vs serveNormal branch."
        >{`func (s *Sidecar) ServeHTTP(w http.ResponseWriter, r *http.Request) {
    if r.URL.Path == "/health" || r.URL.Path == "/metrics" {
        http.NotFound(w, r)
        return
    }

    if !s.pathAllowed(r.URL.Path) {
        http.Error(w, "path not allowed", http.StatusNotFound)
        return
    }

    userID, err := identity.ResolveUserID(r, s.allowQueryUserID)
    if err != nil {
        http.Error(w, err.Error(), http.StatusBadRequest)
        return
    }

    idemKey := strings.TrimSpace(r.Header.Get("Idempotency-Key"))
    if s.idempotency != nil && idemKey != "" && idempotency.IsMutatingMethod(r.Method) {
        s.serveIdempotent(w, r, userID, idemKey)
        return
    }

    s.serveNormal(w, r, userID)
}`}</RLSourceExcerpt>

        <h2 className="guide-sub-heading" id="serve-normal">serveNormal Pipeline</h2>
        <p>
          Non-idempotent requests traverse denial cache → <code>singleflight</code> → <code>checkRateLimit</code> →{" "}
          <code>forwardRequest</code>. Only denials are served from cache; allowed cache entries always fall through
          to the limiter (quota-freeze attack prevention).
        </p>
        <RLSourceExcerpt
          source="cmd/sidecar/main.go — serveNormal"
          establishes="sidecar.proxy span, denial-only cache serving, singleflight collapse, and forward on allow."
        >{`func (s *Sidecar) serveNormal(w http.ResponseWriter, r *http.Request, userID string) {
    ctx := r.Context()
    ctx, span := telemetry.StartSpan(ctx, "sidecar.proxy",
        attribute.String("http.path", r.URL.Path),
    )
    defer span.End()
    r = r.WithContext(ctx)

    cacheKey := s.cacheKey(r, userID)

    if val, ok := s.cache.Load(cacheKey); ok {
        entry := val.(CacheEntry)
        if time.Now().Before(entry.ExpiresAt) {
            if !entry.Allowed {
                metrics.RecordCacheHit()
                s.writeDenial(w, entry.Limit, entry.Remaining, entry.RetryAfter)
                return
            }
        } else {
            s.cache.Delete(cacheKey)
        }
    }

    metrics.RecordCacheMiss()

    resultAny, err, _ := s.limitFlight.Do(cacheKey, func() (interface{}, error) {
        return s.checkRateLimit(ctx, r, userID, false)
    })
    if err != nil {
        if s.failOpen {
            s.forwardRequest(w, r)
            return
        }
        http.Error(w, "Rate limiter unavailable", http.StatusServiceUnavailable)
        return
    }

    result := resultAny.(limitResult)
    s.cache.Store(cacheKey, CacheEntry{
        Allowed: result.allowed, Remaining: result.remaining,
        Limit: result.limit, RetryAfter: result.retryAfter,
        ExpiresAt: time.Now().Add(s.ttl),
    })

    if !result.allowed {
        s.writeDenial(w, result.limit, result.remaining, result.retryAfter)
        return
    }

    s.writeRateLimitHeaders(w, result.limit, result.remaining)
    s.forwardRequest(w, r)
}`}</RLSourceExcerpt>

        <h2 className="guide-sub-heading" id="serve-idempotent">serveIdempotent Pipeline</h2>
        <p>
          Mutating requests with an <code>Idempotency-Key</code> claim a Redis lease first. Replays return cached
          responses without upstream calls. New claims proceed through rate limiting, then forward via the same
          routing or reverse-proxy path as <code>serveNormal</code>.
        </p>
        <RLSourceExcerpt
          source="cmd/sidecar/main.go — serveIdempotent (claim + rate check + forward)"
          establishes="sidecar.idempotency span, claim/replay branching, rate limit before forward, complete.lua on success."
        >{`func (s *Sidecar) serveIdempotent(w http.ResponseWriter, r *http.Request, userID, idemKey string) {
    ctx := r.Context()
    ctx, span := telemetry.StartSpan(ctx, "sidecar.idempotency")
    defer span.End()
    r = r.WithContext(ctx)

    claim, err := s.idempotency.Claim(ctx, scope, idemKey, reqHash)
    // ... validation and fail-open handling omitted

    switch claim.Result {
    case idempotency.ResultReplay:
        idempotency.WriteClaimResponse(w, claim)
        return
    case idempotency.ResultInProgress, idempotency.ResultHashMismatch:
        idempotency.WriteClaimResponse(w, claim)
        return
    case idempotency.ResultClaimed:
        // proceed
    }

    result, err := s.checkRateLimit(ctx, r, userID, false)
    if !result.allowed {
        s.writeDenial(w, result.limit, result.remaining, result.retryAfter)
        return
    }

    s.writeRateLimitHeaders(w, result.limit, result.remaining)
    s.forwardIdempotent(w, r, scope, idemKey, claim.FenceToken)
}`}</RLSourceExcerpt>

        <RLSourceExcerpt
          source="cmd/sidecar/main.go — forwardRequest"
          establishes="When router is set (ENABLE_ROUTING=true), upstream goes through Router.Forward; otherwise httputil.ReverseProxy to UPSTREAM_URL."
        >{`func (s *Sidecar) forwardRequest(w http.ResponseWriter, r *http.Request) {
    ctx, span := telemetry.StartSpan(r.Context(), "sidecar.upstream_proxy",
        attribute.String("http.path", r.URL.Path),
    )
    defer span.End()

    if s.router != nil {
        body, _ := readRequestBody(r)
        if err := s.router.Forward(ctx, w, r, body); err != nil {
            http.Error(w, "all gateways unavailable", http.StatusServiceUnavailable)
        }
        return
    }

    target, _ := url.Parse(s.upstreamURL)
    r.Host = target.Host
    s.proxy.ServeHTTP(w, r)
}`}</RLSourceExcerpt>

        <h2 className="guide-sub-heading" id="health">Sidecar /health Semantics</h2>
        <p>
          The sidecar exposes <code>/health</code> on the main mux (not through <code>ServeHTTP</code>). Readiness
          always requires the central limiter to respond <code>200</code> on <code>{"{RATE_LIMITER_URL}"}/health</code>.
          When idempotency or routing is enabled, Redis must also be reachable.
        </p>
        <RLSourceExcerpt
          source="cmd/sidecar/health.go — evaluateSidecarHealth"
          establishes="Limiter /health is mandatory; Redis checked only when needsRedis (ENABLE_IDEMPOTENCY or ENABLE_ROUTING)."
        >{`func evaluateSidecarHealth(ctx context.Context, deps sidecarHealthDeps) (int, map[string]interface{}) {
    limiterOK := checkLimiterHealth(ctx, deps.httpClient, deps.limiterURL)
    if !limiterOK {
        return http.StatusServiceUnavailable, map[string]interface{}{"status": "unhealthy"}
    }

    if deps.needsRedis {
        if deps.redisClient == nil {
            return http.StatusServiceUnavailable, map[string]interface{}{
                "status": "unhealthy",
                "redis":  redisclient.Health{Error: "redis client not configured"},
            }
        }
        h := redisclient.CheckHealth(ctx, deps.redisClient, deps.redisCfg)
        if !h.Connected {
            return http.StatusServiceUnavailable, map[string]interface{}{
                "status": "unhealthy", "redis": h,
            }
        }
        return http.StatusOK, map[string]interface{}{"status": "healthy", "redis": h}
    }

    return http.StatusOK, map[string]interface{}{"status": "healthy"}
}`}</RLSourceExcerpt>

        <h2 className="guide-sub-heading" id="rationale">Design Rationale</h2>
        <ul className="guide-bullets-list">
          <li><strong>Separate process boundary:</strong> Language-agnostic enforcement without embedding limiter SDKs in every service.</li>
          <li><strong>Idempotency before rate limit on claimed keys:</strong> Replays skip both limiter and upstream — duplicate suppression is cheaper than re-checking quota.</li>
          <li><strong>Denial-only cache:</strong> Prevents quota-freeze attacks where a cached "allowed" would bypass enforcement after quota exhaustion.</li>
          <li><strong>Router as optional forward path:</strong> Single <code>UPSTREAM_URL</code> mode keeps simple deployments zero-config; routing activates only when explicitly enabled.</li>
        </ul>

        <h2 className="guide-sub-heading" id="limitations">Limitations</h2>
        <RLCallout variant="limitation" title="Proxy handler does not serve /health">
          <code>ServeHTTP</code> returns <code>404</code> for <code>/health</code> and <code>/metrics</code>. Load balancers
          must probe the mux-mounted endpoints, not proxied application paths.{" "}
          <RLEvidenceBadge type="DOCUMENTED LIMITATION" />
        </RLCallout>
        <RLCallout variant="limitation" title="Body buffering on routing path">
          When <code>ENABLE_ROUTING=true</code>, <code>forwardRequest</code> reads the full request body into memory
          before <code>Router.Forward</code> — required for retry across gateways. Large payloads increase sidecar memory
          footprint. <RLEvidenceBadge type="DOCUMENTED LIMITATION" />
        </RLCallout>

        <RLRelatedPages pages={[
          { section: "architecture", slug: "anatomy-of-a-request", title: "Anatomy of a Request", note: "full allowed/denied/idempotent walkthrough" },
          { section: "resilience", slug: "denial-cache-and-singleflight", title: "Denial Cache & Singleflight" },
          { section: "resilience", slug: "idempotency", title: "Idempotency" },
          { section: "request-routing", slug: "intelligent-routing", title: "Intelligent Routing" }
        ]} />
      </div>
    )
  },

  "intelligent-routing": {
    title: "Intelligent Routing",
    topics: [
      { label: "Activation & Gateway Registration", href: "#activation" },
      { label: "Scoring Formula", href: "#scoring" },
      { label: "Weighted Random Selection", href: "#selection" },
      { label: "Redis State Keys", href: "#redis-keys" },
      { label: "Response Headers", href: "#headers" },
      { label: "Design Rationale", href: "#rationale" },
      { label: "Limitations", href: "#limitations" }
    ],
    content: (
      <div>
        <RLThesis>
          Intelligent routing activates when <code>ENABLE_ROUTING=true</code> and <code>GATEWAYS</code> is set.
          Gateways register in Redis (<code>route:gw:{"{id}"}</code>, <code>route:index</code>); each request computes
          a score via <code>ComputeScore</code> —{" "}
          <code>weight × latencyFactor × healthFactor × errorFactor</code> — then selects a primary gateway by
          weighted random spin. Failover retries follow score-descending order capped at{" "}
          <code>MaxFailoverTries=3</code>.
        </RLThesis>

        <RLQuickModel>
          Rate limit passes → <code>Router.Forward</code> lists gateways from Redis → <code>PickPrimary</code> weighted
          random → try primary, on failure walk <code>FailoverOrder</code> (up to 3 alternates) → inject{" "}
          <code>X-Gateway-*</code> headers → <code>record_outcome.lua</code> updates EMA and health score atomically.
        </RLQuickModel>

        <RLStatGrid stats={[
          { value: "100ms", label: "TargetLatencyMs default", evidence: "SOURCE-PROVEN" },
          { value: "3", label: "MaxFailoverTries default", evidence: "SOURCE-PROVEN" },
          { value: "15s", label: "ProbeIntervalSec default", evidence: "SOURCE-PROVEN" }
        ]} />

        <h2 className="guide-sub-heading" id="activation">Activation & Gateway Registration</h2>
        <p>
          Routing mode replaces the single <code>UPSTREAM_URL</code> requirement. At startup the sidecar parses{" "}
          <code>GATEWAYS=id|url|weight,id|url|weight</code>, seeds Redis, starts background health probes, and wires
          the same distributed circuit breaker used for gateway targets.
        </p>
        <RLSourceExcerpt
          source="cmd/sidecar/main.go — ENABLE_ROUTING bootstrap"
          establishes="ENABLE_ROUTING=true requires GATEWAYS env; circuit breaker uses circuitbreaker.LoadConfigFromEnv (CB_* vars)."
        >{`if os.Getenv("ENABLE_ROUTING") == "true" {
    rdb := sharedRdb
    routeCfg := routing.LoadConfigFromEnv()
    cbCfg := circuitbreaker.LoadConfigFromEnv()
    breaker := circuitbreaker.NewBreaker(circuitbreaker.NewRedisStore(rdb, cbCfg))
    store := routing.NewRedisStore(rdb, routeCfg)
    store.SetBreaker(breaker)
    router := routing.NewRouter(store, sidecar.httpClient, routeCfg, breaker)
    sidecar.SetLimiterCircuit(breaker)
    gateways := routing.GatewaysFromEnv()
    if len(gateways) == 0 {
        logging.Fatal("ENABLE_ROUTING=true requires GATEWAYS env")
    }
    if err := router.Seed(context.Background(), gateways); err != nil {
        logging.Fatal("gateway seed failed", "error", err)
    }
    router.StartHealthProbes(probeCtx)
    sidecar.SetRouter(router)
}`}</RLSourceExcerpt>

        <RLSourceExcerpt
          source="internal/routing/config.go — ParseGatewaysEnv"
          establishes="GATEWAYS format: comma-separated id|url|weight triples; default weight 100 when missing or zero."
        >{`// ParseGatewaysEnv parses GATEWAYS=id|url|weight,id|url|weight
func ParseGatewaysEnv(raw string) ([]Gateway, error) {
    // ...
    out = append(out, Gateway{
        ID:     strings.TrimSpace(fields[0]),
        URL:    strings.TrimSpace(fields[1]),
        Weight: weight, // defaults to 100 if <= 0
    })
}`}</RLSourceExcerpt>

        <h2 className="guide-sub-heading" id="scoring">Scoring Formula</h2>
        <p>
          The score is a multiplicative product — not a weighted sum of success/latency/timeout components. Higher
          score means more traffic in weighted random selection. Zero score excludes the gateway.{" "}
          <RLEvidenceBadge type="SOURCE-PROVEN" />
        </p>
        <div style={{
          background: "#111113",
          border: "1px solid #27272a",
          padding: "16px 20px",
          borderRadius: 8,
          margin: "16px 0",
          fontFamily: "monospace",
          fontSize: 14,
          color: "#e4e4e7"
        }}>
          Score = BaseWeight × latencyFactor × healthFactor × errorFactor
        </div>
        <ul className="guide-bullets-list">
          <li><strong>BaseWeight:</strong> Static <code>weight</code> from GATEWAYS config (default 100 if zero).</li>
          <li><strong>latencyFactor:</strong> <code>TargetLatencyMs / LatencyEMA</code>, clamped to [0.1, 2.0]. Default target: 100ms.</li>
          <li><strong>healthFactor:</strong> <code>HealthScore / 100.0</code> (0–100 scale in Redis).</li>
          <li><strong>errorFactor:</strong> <code>1.0 − (ErrorRate × ErrorPenalty)</code>, floor 0.05. Default penalty: 2.0.</li>
        </ul>

        <RLSourceExcerpt
          source="internal/routing/scorer.go — ComputeScore"
          establishes="Verified multiplicative formula with latency clamp, health normalization, and error penalty floor."
        >{`func ComputeScore(state GatewayState, cfg Config) float64 {
    if !state.Selectable(cfg) {
        return 0
    }

    weight := float64(state.Weight)
    if weight <= 0 {
        weight = 1
    }

    latency := state.LatencyEMAMs
    if latency < 1 {
        latency = 1
    }
    latencyFactor := cfg.TargetLatencyMs / latency
    if latencyFactor > 2.0 {
        latencyFactor = 2.0
    }
    if latencyFactor < 0.1 {
        latencyFactor = 0.1
    }

    healthFactor := state.HealthScore / 100.0

    errRate := state.ErrorRate()
    errorFactor := 1.0 - (errRate * cfg.ErrorPenalty)
    if errorFactor < 0.05 {
        errorFactor = 0.05
    }

    return weight * latencyFactor * healthFactor * errorFactor
}`}</RLSourceExcerpt>

        <RLSourceExcerpt
          source="internal/routing/types.go — Selectable"
          establishes="Gateways excluded when disabled, circuit open/unknown, or health_score below MinHealthScore (default 20)."
        >{`func (s GatewayState) Selectable(cfg Config) bool {
    if !s.Enabled {
        return false
    }
    if s.CircuitState == circuitbreaker.StateOpen || s.CircuitState == circuitbreaker.StateUnknown {
        return false
    }
    if s.HealthScore < cfg.MinHealthScore {
        return false
    }
    return true
}`}</RLSourceExcerpt>

        <h2 className="guide-sub-heading" id="selection">Weighted Random Selection</h2>
        <p>
          <code>PickPrimary</code> ranks all gateways via <code>RankScores</code> (insertion sort — tuned for small
          pools of 3–10), filters to score &gt; 0, then performs a weighted random roll. This preserves proportional
          traffic distribution: a gateway with 2× the score receives roughly 2× the probability, without rigid
          round-robin obliviousness to health.
        </p>
        <RLSourceExcerpt
          source="internal/routing/selector.go — PickPrimary"
          establishes="Weighted random among selectable gateways; zero-score gateways excluded."
        >{`func (s *Selector) PickPrimary(states []GatewayState) (ScoredGateway, bool) {
    ranked := RankScores(states, s.cfg)
    var candidates []ScoredGateway
    var total float64
    for _, g := range ranked {
        if g.Score > 0 {
            candidates = append(candidates, g)
            total += g.Score
        }
    }
    if len(candidates) == 0 || total <= 0 {
        return ScoredGateway{}, false
    }

    roll := s.rng.Float64() * total
    var acc float64
    for _, c := range candidates {
        acc += c.Score
        if roll <= acc {
            return c, true
        }
    }
    return candidates[len(candidates)-1], true
}`}</RLSourceExcerpt>

        <h2 className="guide-sub-heading" id="redis-keys">Redis State Keys</h2>
        <div style={{ overflowX: "auto", margin: "16px 0" }}>
          <table className="guide-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #27272a", textAlign: "left" }}>
                <th style={{ padding: "10px 8px" }}>Key</th>
                <th style={{ padding: "10px 8px" }}>Type</th>
                <th style={{ padding: "10px 8px" }}>Fields</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "10px 8px" }}><code>route:gw:{"{id}"}</code></td>
                <td>HASH</td>
                <td><code>id, url, weight, enabled, health_score, latency_ema_ms, success_count, error_count, total_requests, updated_at</code></td>
              </tr>
              <tr>
                <td style={{ padding: "10px 8px" }}><code>route:index</code></td>
                <td>SET</td>
                <td>Gateway IDs registered at seed time</td>
              </tr>
            </tbody>
          </table>
        </div>
        <RLSourceExcerpt
          source="internal/routing/store.go — RegisterGateway"
          establishes="New gateways seed with health_score=100, latency_ema_ms=0; ID added to route:index SET."
        >{`func (s *RedisStore) RegisterGateway(ctx context.Context, gw Gateway) error {
    key := gwKey(gw.ID) // route:gw:{"{id}"}
    // ...
    err = s.rdb.HSet(ctx, key, map[string]interface{}{
        "id": gw.ID, "url": gw.URL, "weight": gw.Weight,
        "enabled": 1, "health_score": 100, "latency_ema_ms": 0,
        "success_count": 0, "error_count": 0, "total_requests": 0,
    }).Err()
    return s.rdb.SAdd(ctx, indexKey(), gw.ID).Err() // route:index
}`}</RLSourceExcerpt>

        <h2 className="guide-sub-heading" id="headers">Response Headers</h2>
        <p>On successful upstream forward in routing mode, the sidecar injects gateway metadata into the client response:</p>
        <ul className="guide-bullets-list">
          <li><code>X-Gateway-ID</code> — ID of the gateway that served the request</li>
          <li><code>X-Gateway-Score</code> — computed score at selection time (2 decimal places)</li>
          <li><code>X-Gateway-Failover: true</code> — present only when a retry hop succeeded (not the primary pick)</li>
        </ul>
        <RLSourceExcerpt
          source="internal/routing/router.go — Forward (header injection)"
          establishes="Verified header constants and failover flag on retry hops."
        >{`w.Header().Set(HeaderGatewayID, candidate.State.ID)
w.Header().Set(HeaderGatewayScore, fmt.Sprintf("%.2f", candidate.Score))
if failover {
    w.Header().Set(HeaderGatewayFailover, "true")
}`}</RLSourceExcerpt>

        <h2 className="guide-sub-heading" id="rationale">Design Rationale</h2>
        <ul className="guide-bullets-list">
          <li><strong>Multiplicative scoring:</strong> A single degraded dimension (high latency, low health, or high errors) compounds — unhealthy gateways lose traffic faster than additive models allow.</li>
          <li><strong>Weighted random over strict top-1:</strong> Prevents thundering herd on the single best gateway while still biasing toward healthy targets.</li>
          <li><strong>Redis-backed state:</strong> All sidecar replicas share the same gateway metrics view — no per-replica routing divergence.</li>
          <li><strong>Insertion sort in RankScores:</strong> Gateway pools are small (3–10); O(n²) sort avoids allocation overhead of generic sort for tiny slices.</li>
        </ul>

        <h2 className="guide-sub-heading" id="limitations">Limitations</h2>
        <RLCallout variant="warning" title="ROUTING_CIRCUIT_* env vars are loaded but unused">
          <code>routing.LoadConfigFromEnv()</code> parses <code>ROUTING_CIRCUIT_ERROR_RATE</code>,{" "}
          <code>ROUTING_CIRCUIT_MIN_SAMPLES</code>, and <code>ROUTING_CIRCUIT_COOLDOWN_MS</code> into{" "}
          <code>routing.Config</code>, but no routing code reads these fields. Gateway circuit breaking uses the
          shared <code>circuitbreaker.Breaker</code> initialized via <code>circuitbreaker.LoadConfigFromEnv()</code> —
          tune <code>CB_FAILURE_RATE</code>, <code>CB_MIN_SAMPLES</code>, <code>CB_OPEN_COOLDOWN_MS</code>, etc.{" "}
          <RLEvidenceBadge type="DOCUMENTED LIMITATION" />
        </RLCallout>
        <RLCallout variant="limitation" title="ROUTING_ERROR_PENALTY not env-configurable">
          <code>ErrorPenalty</code> defaults to <code>2.0</code> in <code>DefaultConfig()</code> but has no{" "}
          <code>ROUTING_ERROR_PENALTY</code> env loader in <code>LoadConfigFromEnv()</code>. Changing error
          sensitivity requires a code change. <RLEvidenceBadge type="DOCUMENTED LIMITATION" />
        </RLCallout>

        <RLRelatedPages pages={[
          { section: "request-routing", slug: "gateway-health-and-failover", title: "Gateway Health & Failover" },
          { section: "resilience", slug: "circuit-breaker", title: "Circuit Breaker" },
          { section: "architecture", slug: "distributed-state-model", title: "Distributed State Model" },
          { section: "observability", slug: "distributed-tracing", title: "Distributed Tracing" }
        ]} />
      </div>
    )
  },

  "gateway-health-and-failover": {
    title: "Gateway Health & Failover",
    topics: [
      { label: "Health Probing Lifecycle", href: "#probing" },
      { label: "record_outcome.lua", href: "#record-outcome" },
      { label: "Failover Execution Flow", href: "#failover" },
      { label: "Circuit Breaker Integration", href: "#circuit" },
      { label: "Design Rationale", href: "#rationale" },
      { label: "Limitations", href: "#limitations" }
    ],
    content: (
      <div>
        <RLThesis>
          Gateway health is maintained by two complementary signals: passive background probes every{" "}
          <code>ProbeIntervalSec=15</code> seconds hitting each gateway&apos;s <code>/health</code>, and active{" "}
          <code>record_outcome.lua</code> updates after every forwarded request. On primary failure, the router walks
          score-descending alternatives up to <code>MaxFailoverTries=3</code>, consulting per-gateway circuit breakers
          (<code>cb:{"{gateway-id}"}</code>) before each attempt.
        </RLThesis>

        <RLQuickModel>
          Background ticker → GET <code>{"{gateway-url}"}/health</code> → <code>UpdateHealthProbe</code> → Redis EMA
          update. Request path: primary fails → record outcome + circuit Record → try next gateway in{" "}
          <code>FailoverOrder</code> → set <code>X-Gateway-Failover: true</code> on retry success → all fail → 503.
        </RLQuickModel>

        <RLStatGrid stats={[
          { value: "15s", label: "ROUTING_PROBE_INTERVAL_SEC default", evidence: "SOURCE-PROVEN" },
          { value: "3", label: "ROUTING_MAX_FAILOVER_TRIES default", evidence: "SOURCE-PROVEN" },
          { value: "20", label: "ROUTING_MIN_HEALTH_SCORE exclusion floor", evidence: "SOURCE-PROVEN" }
        ]} />

        <h2 className="guide-sub-heading" id="probing">Health Probing Lifecycle</h2>
        <p>
          <code>StartHealthProbes</code> launches a background goroutine when <code>ProbeIntervalSec &gt; 0</code>
          (default 15). Each tick lists all gateways from <code>route:index</code>, probes{" "}
          <code>{"{url}"}/health</code>, and records the outcome. Success means no transport error and HTTP status
          &lt; 500.
        </p>
        <DocsMermaid chart={`
flowchart LR
    Ticker["Ticker every ProbeIntervalSec=15s"] --> List["ListGateways\\nSMEMBERS route:index"]
    List --> Probe["GET gateway/health"]
    Probe --> Update["UpdateHealthProbe\\n→ record_outcome.lua"]
    Update --> Redis[("route:gw:{id}")]
    style Ticker fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style Redis fill:#18181b,stroke:#ec4899,color:#fff
        `} />

        <RLSourceExcerpt
          source="internal/routing/router.go — StartHealthProbes + probeAll"
          establishes="Background probe interval from ProbeIntervalSec; probes target /health on each gateway URL."
        >{`func (r *Router) StartHealthProbes(ctx context.Context) {
    if r.cfg.ProbeIntervalSec <= 0 {
        return
    }
    go func() {
        ticker := time.NewTicker(time.Duration(r.cfg.ProbeIntervalSec) * time.Second)
        defer ticker.Stop()
        for {
            select {
            case <-ctx.Done():
                return
            case <-ticker.C:
                r.probeAll(ctx)
            }
        }
    }()
}

func (r *Router) probeAll(ctx context.Context) {
    states, _ := r.store.ListGateways(ctx)
    for _, st := range states {
        probeURL := strings.TrimRight(st.URL, "/") + "/health"
        resp, err := r.client.Do(req)
        success := err == nil && resp != nil && resp.StatusCode < 500
        _ = r.store.UpdateHealthProbe(ctx, st.ID, success, latency)
    }
}`}</RLSourceExcerpt>

        <h2 className="guide-sub-heading" id="record-outcome">record_outcome.lua</h2>
        <p>
          Every probe and request outcome atomically updates latency EMA, counters, and health score in one Redis
          round-trip. Circuit breaker state lives separately in <code>cb:{"{gateway-id}"}</code>.
        </p>
        <RLSourceExcerpt
          source="internal/routing/lua/record_outcome.lua"
          language="lua"
          establishes="Atomic EMA update, counter increment, health_score recomputation on route:gw:{id} HASH."
        >{`-- KEYS[1] = route:gw:{"{id}"}
local ema = tonumber(redis.call('HGET', key, 'latency_ema_ms') or '0')
if ema <= 0 then
  ema = latency
else
  ema = alpha * latency + (1 - alpha) * ema
end

if success == 1 then
  redis.call('HINCRBY', key, 'success_count', 1)
else
  redis.call('HINCRBY', key, 'error_count', 1)
end

local error_rate = err / total
local latency_penalty = math.min(ema / 200.0, 1.0)
local health = (1 - error_rate) * (1 - latency_penalty * 0.3) * 100

redis.call('HSET', key,
  'health_score', string.format('%.2f', health),
  'latency_ema_ms', string.format('%.2f', ema)
)`}</RLSourceExcerpt>

        <h2 className="guide-sub-heading" id="failover">Failover Execution Flow</h2>
        <p>
          <code>Router.Forward</code> picks a primary via weighted random, then appends{" "}
          <code>FailoverOrder</code> candidates. Each attempt checks the gateway circuit breaker, executes the HTTP
          forward, records the outcome, and continues on failure. The client sees <code>503 all gateways unavailable</code>{" "}
          only when every candidate is exhausted.
        </p>
        <DocsMermaid chart={failoverSequence} />

        <RLSourceExcerpt
          source="internal/routing/router.go — Forward failover loop"
          establishes="Primary + FailoverOrder attempts; circuit Allow before each hop; headers set on first success."
        >{`primary, ok := r.selector.PickPrimary(states)
tried := []ScoredGateway{primary}
tried = append(tried, r.selector.FailoverOrder(states, primary.State.ID)...)

for i, candidate := range tried {
    if i > 0 {
        failover = true
    }
    if r.breaker != nil {
        allow, err := r.breaker.Allow(ctx, candidate.State.ID)
        if !allow.Allowed {
            continue
        }
    }
    resp, err := r.execute(ctx, req, body, candidate.State)
    success := err == nil && resp != nil && resp.StatusCode < 500
    _ = r.store.RecordOutcome(ctx, Outcome{...})
    if !success {
        continue
    }
    w.Header().Set(HeaderGatewayID, candidate.State.ID)
    w.Header().Set(HeaderGatewayScore, fmt.Sprintf("%.2f", candidate.Score))
    if failover {
        w.Header().Set(HeaderGatewayFailover, "true")
    }
    copyResponse(w, resp)
    return nil
}
return lastErr // → 503 at forwardRequest`}</RLSourceExcerpt>

        <RLSourceExcerpt
          source="internal/routing/selector.go — FailoverOrder"
          establishes="Failover candidates ranked by score descending; capped at MaxFailoverTries (default 3)."
        >{`func (s *Selector) FailoverOrder(states []GatewayState, excludeID string) []ScoredGateway {
    ranked := RankScores(states, s.cfg)
    for _, g := range ranked {
        if g.State.ID == excludeID || g.Score <= 0 {
            continue
        }
        out = append(out, g)
        if len(out) >= s.cfg.MaxFailoverTries {
            break
        }
    }
    return out
}`}</RLSourceExcerpt>

        <h2 className="guide-sub-heading" id="circuit">Circuit Breaker Integration</h2>
        <p>
          Each gateway target has a distributed circuit breaker keyed <code>cb:{"{gateway-id}"}</code> in Redis.
          Before every forward attempt, <code>breaker.Allow(ctx, gatewayID)</code> fast-fails open circuits. After
          each response, <code>breaker.Record</code> classifies success, failure, or timeout.
        </p>
        <RLCallout variant="warning" title="Tune CB_* not ROUTING_CIRCUIT_*">
          Gateway circuits use <code>circuitbreaker.LoadConfigFromEnv()</code> at routing bootstrap — the same{" "}
          <code>CB_FAILURE_RATE</code>, <code>CB_MIN_SAMPLES</code>, <code>CB_CONSECUTIVE_FAILURES</code>,{" "}
          <code>CB_LATENCY_THRESHOLD_MS</code>, and <code>CB_OPEN_COOLDOWN_MS</code> vars as limiter and sidecar
          limiter circuits. The <code>ROUTING_CIRCUIT_*</code> fields in <code>routing.Config</code> are parsed
          from env but never referenced by router, selector, or store code.{" "}
          <RLEvidenceBadge type="DOCUMENTED LIMITATION" />
        </RLCallout>
        <RLSourceExcerpt
          source="internal/routing/router.go — circuit guard per attempt"
          establishes="breaker.Allow before forward; ClassifyHTTP for timeout detection; Record after outcome."
        >{`if r.breaker != nil {
    allow, err := r.breaker.Allow(ctx, candidate.State.ID)
    if !allow.Allowed {
        lastErr = fmt.Errorf("circuit %s for gateway %s", allow.State, candidate.State.ID)
        continue
    }
}
// ... execute forward ...
if r.breaker != nil {
    kind := circuitbreaker.OutcomeFailure
    if outcome.Success {
        kind = circuitbreaker.OutcomeSuccess
    } else if outcome.Timeout {
        kind = circuitbreaker.OutcomeTimeout
    }
    _ = r.breaker.Record(ctx, candidate.State.ID, circuitbreaker.RecordInput{Kind: kind, Latency: latency})
}`}</RLSourceExcerpt>

        <h2 className="guide-sub-heading" id="rationale">Design Rationale</h2>
        <ul className="guide-bullets-list">
          <li><strong>Passive + active health:</strong> Probes detect outages before user traffic hits a dead gateway; request outcomes capture real latency under load.</li>
          <li><strong>Score-descending failover:</strong> Retries prefer the next-best gateway, not arbitrary list order — degraded primaries do not block better alternatives.</li>
          <li><strong>MaxFailoverTries cap:</strong> Bounds tail latency — at most 3 alternate attempts after primary failure, preventing unbounded retry storms.</li>
          <li><strong>Circuit breaker per gateway:</strong> Open circuits skip connection timeouts entirely — failover moves to healthy targets in ~23ms (benchmarked fast-fail) instead of waiting for TCP timeouts.</li>
        </ul>

        <h2 className="guide-sub-heading" id="limitations">Limitations</h2>
        <RLCallout variant="limitation" title="Health score formula mismatch">
          <code>record_outcome.lua</code> computes <code>health_score</code> with a fixed 200ms latency baseline
          and 0.3 penalty weight, while <code>ComputeScore</code> uses <code>ROUTING_TARGET_LATENCY_MS</code> (default
          100ms) for selection. Probe-driven health and selection scoring use different math — operators should treat
          <code>health_score</code> as a relative signal, not a direct input to the selection formula.{" "}
          <RLEvidenceBadge type="DOCUMENTED LIMITATION" />
        </RLCallout>
        <RLCallout variant="limitation" title="No request-level retry to client">
          Failover is transparent inside the sidecar. If all gateways fail, the client receives a single{" "}
          <code>503</code> — there is no partial response or per-gateway error detail in the body.{" "}
          <RLEvidenceBadge type="DOCUMENTED LIMITATION" />
        </RLCallout>

        <RLRelatedPages pages={[
          { section: "request-routing", slug: "intelligent-routing", title: "Intelligent Routing", note: "scoring formula and selection" },
          { section: "request-routing", slug: "sidecar-architecture", title: "Sidecar Architecture", note: "forwardRequest → Router.Forward wiring" },
          { section: "resilience", slug: "circuit-breaker", title: "Circuit Breaker", note: "CB_* env vars and state machine" },
          { section: "production-engineering", slug: "health-and-readiness", title: "Health & Readiness", note: "sidecar /health probe contract" }
        ]} />
      </div>
    )
  }
};

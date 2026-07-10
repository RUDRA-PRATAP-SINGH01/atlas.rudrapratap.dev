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

export const architecturePages = {

  /* ═══════════════════════════════════════════════════════════════════════
     PAGE 1 — system-at-a-glance  (FLAGSHIP)
     ═══════════════════════════════════════════════════════════════════════ */
  "system-at-a-glance": {
    title: "System at a Glance",
    topics: [
      { label: "High-Level Logical Flow", href: "#level-1" },
      { label: "Full Production Architecture", href: "#level-2" },
      { label: "Single-Replica Topology", href: "#single-replica" },
      { label: "Multi-Replica Topology", href: "#multi-replica" },
      { label: "Sentinel HA Topology", href: "#sentinel-ha" },
      { label: "Required vs Optional Components", href: "#required-optional" },
      { label: "Component Responsibility Matrix", href: "#component-matrix" },
      { label: "Protocol Boundaries", href: "#protocol-boundaries" },
      { label: "State Ownership, Scaling & Failure", href: "#state-scaling" },
      { label: "Ports & Redis Key Reference", href: "#ports-keys" },
    ],
    content: (
      <div>
        <RLThesis>
          The platform is divided across three explicit runtime boundaries: a client-facing sidecar proxy
          (<code>:9090</code>) that provides language-agnostic enforcement, denial offloading, and idempotency
          replay; a stateless central limiter pool (<code>:8080</code> hot path, <code>:8082</code> admin) that
          concentrates Redis connections and resolves override logic before each Lua invocation; and a Redis master
          (<code>:6379</code>) where every quota, override, circuit-breaker, and idempotency record is serialized
          atomically through Lua scripts. Every decision with correctness consequences lives in Redis.
        </RLThesis>

        <RLQuickModel>
          Client &rarr; Sidecar (<code>:9090</code>) &rarr; Limiter (<code>:8080</code>) &rarr; Redis
          (<code>:6379</code>) &rarr; Upstream (<code>:8081</code> demo). Quota decisions are atomic in Redis;
          the sidecar only accelerates denial repetition (30 ms) and suppresses duplicate in-flight requests via
          singleflight. Allowed entries are never served from cache — they always re-hit the limiter.
        </RLQuickModel>

        <RLStatGrid stats={[
          { value: ":9090", label: "Sidecar proxy  cmd/sidecar", evidence: "SOURCE-PROVEN" },
          { value: ":8080", label: "Limiter hot path  cmd/limiter", evidence: "SOURCE-PROVEN" },
          { value: ":8082", label: "Admin API — isolated port", evidence: "SOURCE-PROVEN" },
          { value: ":8081", label: "Demo upstream backend", evidence: "SOURCE-PROVEN" },
          { value: ":6379", label: "Redis master", evidence: "SOURCE-PROVEN" },
          { value: ":9091", label: "Prometheus host metrics", evidence: "SOURCE-PROVEN" },
          { value: ":3000", label: "Grafana dashboard", evidence: "SOURCE-PROVEN" },
          { value: "16686", label: "Jaeger UI / :4318 OTLP", evidence: "SOURCE-PROVEN" },
        ]} />

        {/* ── Level 1 ─────────────────────────────────────────────────── */}
        <h2 className="guide-sub-heading" id="level-1">High-Level Logical Flow</h2>
        <p>
          At the highest level, every inbound request is intercepted by the sidecar before any upstream service
          is reached. The sidecar delegates quota evaluation to the central limiter, which issues a single Lua
          script invocation to Redis. The upstream is contacted only after explicit admission.
        </p>
        <DocsMermaid chart={`
flowchart LR
    Client(["Client Request"]) --> SC["Sidecar Proxy\\n:9090"]
    SC -->|"GET /check_hierarchical"| LM["Central Limiter\\n:8080"]
    LM -->|"EVALSHA hierarchical.lua\\natomic multi-key"| RD[("Redis Master\\n:6379")]
    SC -->|"Admitted only"| UP["Upstream\\n:8081"]
    OB["Prometheus · Grafana · Jaeger"] -.->|"scrape / trace"| SC & LM
    style Client fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style SC fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style LM fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style RD fill:#18181b,stroke:#ec4899,color:#fff
    style UP fill:#18181b,stroke:#52525b,color:#a1a1aa
    style OB fill:#18181b,stroke:#3f3f46,color:#a1a1aa
        `} />

        {/* ── Level 2 ─────────────────────────────────────────────────── */}
        <h2 className="guide-sub-heading" id="level-2">Full Production Architecture</h2>
        <p>
          Expanding inward: the sidecar executes a four-stage pipeline called <code>serveNormal</code> — denial
          cache check &rarr; singleflight deduplication &rarr; <code>checkRateLimit</code> with circuit guard
          &rarr; upstream proxy. The observability stack (Prometheus, Grafana, Jaeger) spans all layers but has
          zero impact on the hot path. The admin port is network-isolated from the hot path.
        </p>
        <DocsMermaid chart={`
flowchart TD
    Client(["Client"]) -->|":9090"| SC["Sidecar Proxy — cmd/sidecar\\n─ denial_cache  sync.Map  30ms TTL\\n─ singleflight.Group  per cacheKey\\n─ idempotency_store\\n─ gateway_router\\n─ cb:central-limiter circuit"]
    SC -->|"GET /check_hierarchical\\nHTTP timeout 1500ms"| LM["Central Limiter Pool — cmd/limiter :8080\\n─ override loader (config:generation check)\\n─ token bucket / sliding window engine\\n─ OTel spans + Prometheus counters"]
    LM -->|"EVALSHA Lua\\ndial/read/write 500ms  pool 1000ms"| RD[("Redis Master :6379\\nrate:*  config:*  cb:*  idem:*\\nroute:*  audit:*")]
    SC -->|"Admitted request"| UP["Upstream — demo-backend :8081"]
    ADM["Admin API :8082\\n(override CRUD)"] -->|"config:{level}:{id}\\nconfig:generation"| RD
    PROM["Prometheus :9091"] -.->|scrape| SC & LM
    GRAF["Grafana :3000"] -.->|query| PROM
    JAEG["Jaeger :16686 / OTLP :4318"] -.->|traces| SC & LM
    style Client fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style SC fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style LM fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style RD fill:#18181b,stroke:#ec4899,color:#fff
    style UP fill:#18181b,stroke:#52525b,color:#a1a1aa
    style ADM fill:#1e1e2e,stroke:#ff5cad,color:#a1a1aa
    style PROM fill:#18181b,stroke:#3f3f46,color:#a1a1aa
    style GRAF fill:#18181b,stroke:#3f3f46,color:#a1a1aa
    style JAEG fill:#18181b,stroke:#3f3f46,color:#a1a1aa
        `} />

        <RLSourceExcerpt
          source="cmd/sidecar/main.go — ServeHTTP routing entry"
          establishes="Verified hot-path branching: identity resolution first, then idempotency branch for mutating requests with an Idempotency-Key header, else serveNormal."
        >{`func (s *Sidecar) ServeHTTP(w http.ResponseWriter, r *http.Request) {
    userID, err := identity.ResolveUserID(r, s.allowQueryUserID)
    // ...
    idemKey := strings.TrimSpace(r.Header.Get("Idempotency-Key"))
    if s.idempotency != nil && idemKey != "" && idempotency.IsMutatingMethod(r.Method) {
        s.serveIdempotent(w, r, userID, idemKey)
        return
    }
    s.serveNormal(w, r, userID)
}`}</RLSourceExcerpt>

        {/* ── Single-Replica Topology ──────────────────────────────────── */}
        <h2 className="guide-sub-heading" id="single-replica">Single-Replica Topology</h2>
        <p>
          The baseline <code>docker-compose.yml</code> topology runs one sidecar, one limiter, and one Redis
          master. All quota state is authoritative in that master; both stateless processes restart cleanly
          against it without any state recovery logic.
        </p>
        <DocsMermaid chart={`
flowchart LR
    Client(["Client"]) --> SC["Sidecar\\n:9090"]
    SC --> LM["Limiter\\n:8080"]
    SC --> ADM["Admin\\n:8082"]
    LM -->|"EVALSHA"| RD[("Redis Master\\n:6379")]
    ADM --> RD
    SC -->|"Admitted"| UP["Upstream\\n:8081"]
    style Client fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style SC fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style LM fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style ADM fill:#1e1e2e,stroke:#ff5cad,color:#a1a1aa
    style RD fill:#18181b,stroke:#ec4899,color:#fff
    style UP fill:#18181b,stroke:#52525b,color:#a1a1aa
        `} />

        {/* ── Multi-Replica Topology ───────────────────────────────────── */}
        <h2 className="guide-sub-heading" id="multi-replica">Multi-Replica Topology</h2>
        <p>
          The scale overlay in <code>docker-compose.scale.yml</code> adds a second sidecar replica on port{" "}
          <code>:9092</code> (sidecar-b) and a second limiter replica on port <code>:8083</code> (limiter-b).
          Both limiter replicas write to the same Redis master — correctness is preserved because all quota token
          deductions are serialized inside Redis Lua scripts regardless of which replica issues the{" "}
          <code>EVALSHA</code>. The denial cache is local to each sidecar replica; a cold-cache replica incurs
          one extra limiter round-trip before the 30 ms denial window materializes.
        </p>
        <DocsMermaid chart={`
flowchart TB
    LB(["Load Balancer"]) --> SCA["Sidecar-A\\n:9090"]
    LB --> SCB["Sidecar-B\\n:9092"]
    SCA & SCB -->|"HTTP /check_hierarchical"| LMA["Limiter-A\\n:8080"]
    SCA & SCB --> LMB["Limiter-B\\n:8083"]
    LMA & LMB -->|"EVALSHA — serialized inside Redis"| RD[("Redis Master :6379\\nSingle serializing authority")]
    SCA & SCB -->|"Admitted"| UP["Upstream\\n:8081"]
    style LB fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style SCA fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style SCB fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style LMA fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style LMB fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style RD fill:#18181b,stroke:#ec4899,color:#fff
    style UP fill:#18181b,stroke:#52525b,color:#a1a1aa
        `} />

        <RLCallout variant="info" title="Multi-replica correctness guarantee">
          Because all token deductions execute inside a single Lua script on Redis's single-threaded execution
          model, two limiter replicas cannot race to over-admit the same user. The multi-replica integration
          test confirms zero over-admission under concurrent load against two limiter instances.{" "}
          <RLEvidenceBadge type="TEST-PROVEN" />
        </RLCallout>

        {/* ── Sentinel HA ──────────────────────────────────────────────── */}
        <h2 className="guide-sub-heading" id="sentinel-ha">Sentinel HA Topology</h2>
        <p>
          For high-availability deployments, the single Redis master is replaced by a Sentinel-coordinated
          replication group. Three Sentinel sentries monitor master health and execute automatic failover by
          promoting a replica. Limiter replicas resolve the active master address through Sentinel at startup
          and reconnect on failover. Replicas receive asynchronous replication from the master; during failover
          the brief write gap is bounded by Redis replication lag.
        </p>
        <DocsMermaid chart={`
flowchart TB
    SCA["Sidecar-A :9090"] & SCB["Sidecar-B :9092"] -->|"HTTP"| LMA["Limiter-A :8080"] & LMB["Limiter-B :8083"]
    LMA & LMB -->|"Read / Write"| Master[("Redis Master :6379")]
    Master -->|"Async replication"| Rep1[("Redis Replica-1")]
    Master -->|"Async replication"| Rep2[("Redis Replica-2")]
    SEN1["Sentinel-1"] & SEN2["Sentinel-2"] & SEN3["Sentinel-3"] -.->|"Monitor + Failover"| Master & Rep1 & Rep2
    style SCA fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style SCB fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style LMA fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style LMB fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style Master fill:#18181b,stroke:#ec4899,color:#fff
    style Rep1 fill:#18181b,stroke:#a78bfa,color:#fff
    style Rep2 fill:#18181b,stroke:#a78bfa,color:#fff
    style SEN1 fill:#18181b,stroke:#ff5cad,color:#a1a1aa
    style SEN2 fill:#18181b,stroke:#ff5cad,color:#a1a1aa
    style SEN3 fill:#18181b,stroke:#ff5cad,color:#a1a1aa
        `} />

        {/* ── Required vs Optional ─────────────────────────────────────── */}
        <h2 className="guide-sub-heading" id="required-optional">Required vs Optional Components</h2>
        <div style={{ overflowX: "auto", margin: "20px 0" }}>
          <table className="guide-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #27272a", textAlign: "left" }}>
                <th style={{ padding: "12px 8px" }}>Component</th>
                <th style={{ padding: "12px 8px" }}>Port</th>
                <th style={{ padding: "12px 8px" }}>Status</th>
                <th style={{ padding: "12px 8px" }}>Role</th>
                <th style={{ padding: "12px 8px" }}>Failure Impact</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Sidecar Proxy", ":9090", "Required", "Client-facing proxy, denial cache, idempotency, gateway routing", "Total request-path failure for that replica"],
                ["Central Limiter", ":8080", "Required", "Stateless quota evaluator; Redis connection concentrator", "503 to all sidecars (FAIL_OPEN=false default)"],
                ["Redis Master", ":6379", "Required", "Authoritative quota, override, circuit, idempotency state", "Quota enforcement impossible; cb:redis trips"],
                ["Admin API", ":8082", "Optional", "Override CRUD; increments config:generation for cache invalidation", "Overrides cannot be changed; hot path unaffected"],
                ["Demo Upstream", ":8081", "Optional (demo)", "Test backend for end-to-end request verification", "No production impact"],
                ["Prometheus", ":9091", "Optional (observability)", "Metrics scrape target for sidecar and limiter", "No request-path impact"],
                ["Grafana", ":3000", "Optional (observability)", "Dashboard over Prometheus data source", "No request-path impact"],
                ["Jaeger / OTLP", ":16686 / :4318", "Optional (observability)", "Distributed tracing collector", "No request-path impact"],
              ].map(([component, port, status, role, impact]) => (
                <tr key={component} style={{ borderBottom: "1px solid #27272a" }}>
                  <td style={{ padding: "12px 8px", fontWeight: 600 }}>{component}</td>
                  <td style={{ padding: "12px 8px", fontFamily: "monospace", color: "#ff5cad" }}>{port}</td>
                  <td style={{ padding: "12px 8px", color: status === "Required" ? "#ff5cad" : "#71717a" }}>{status}</td>
                  <td style={{ padding: "12px 8px", color: "#a1a1aa", fontSize: 12 }}>{role}</td>
                  <td style={{ padding: "12px 8px", color: "#71717a", fontSize: 12 }}>{impact}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Component Matrix ─────────────────────────────────────────── */}
        <h2 className="guide-sub-heading" id="component-matrix">Component Responsibility Matrix</h2>
        <div style={{ overflowX: "auto", margin: "20px 0" }}>
          <table className="guide-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #27272a", textAlign: "left" }}>
                <th style={{ padding: "12px 8px" }}>Dimension</th>
                <th style={{ padding: "12px 8px" }}>Sidecar :9090</th>
                <th style={{ padding: "12px 8px" }}>Limiter :8080</th>
                <th style={{ padding: "12px 8px" }}>Admin :8082</th>
                <th style={{ padding: "12px 8px" }}>Redis :6379</th>
              </tr>
            </thead>
            <tbody>
              {[
                [
                  "Protocol",
                  "HTTP/1.1 reverse proxy (transparent)",
                  "HTTP/1.1 query API (/check, /check_hierarchical)",
                  "HTTP/1.1 CRUD REST",
                  "Redis binary protocol (EVALSHA, HSET, INCR, …)"
                ],
                [
                  "State ownership",
                  "denial_cache sync.Map (ephemeral, denial-only, 30ms TTL), idempotency_store, gateway_router, cb:central-limiter (Redis-backed)",
                  "Override local cache (in-memory, ≤5000ms TTL, ephemeral), cb:redis (Redis-backed)",
                  "None — writes config:* keys to Redis only",
                  "All durable authoritative state: rate:*, sw:*, config:*, cb:*, idem:*, route:*, audit:*"
                ],
                [
                  "Scaling model",
                  "Horizontally stateless for quota; each replica carries its own ephemeral denial cache",
                  "Horizontally stateless; more replicas increase Redis connection count",
                  "Single instance recommended (admin isolation from hot path)",
                  "Single master; Sentinel for HA; vertical scaling; incompatible with Redis Cluster multi-key Lua"
                ],
                [
                  "Failure behavior",
                  "FAIL_OPEN=false → 503 if limiter unreachable; cb:central-limiter Open → immediate 503",
                  "CIRCUIT_FAIL_OPEN=false → propagates Redis failure as error back to sidecar",
                  "Outage only prevents new override writes; hot path continues from cached / Redis state",
                  "Redis down → cb:redis trips in limiter; limiter errors back; sidecars apply FAIL_OPEN logic"
                ],
                [
                  "Graceful shutdown",
                  "5s HTTP drain on SIGTERM/SIGINT",
                  "5s HTTP drain on SIGTERM/SIGINT",
                  "5s HTTP drain",
                  "AOF/RDB persistence; no application-layer drain required"
                ],
              ].map(([dim, sc, lm, adm, rd]) => (
                <tr key={dim} style={{ borderBottom: "1px solid #27272a" }}>
                  <td style={{ padding: "12px 8px", fontWeight: 700, color: "#ff5cad", whiteSpace: "nowrap" }}>{dim}</td>
                  <td style={{ padding: "12px 8px", color: "#d4d4d8" }}>{sc}</td>
                  <td style={{ padding: "12px 8px", color: "#d4d4d8" }}>{lm}</td>
                  <td style={{ padding: "12px 8px", color: "#d4d4d8" }}>{adm}</td>
                  <td style={{ padding: "12px 8px", color: "#d4d4d8" }}>{rd}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Protocol Boundaries ──────────────────────────────────────── */}
        <h2 className="guide-sub-heading" id="protocol-boundaries">Protocol Boundaries</h2>
        <ul className="guide-bullets-list">
          <li>
            <strong>Client &rarr; Sidecar (<code>:9090</code>):</strong> HTTP/1.1. Any HTTP client is
            supported. The sidecar reads <code>X-User-ID</code> (or <code>?user_id</code> query param when{" "}
            <code>ALLOW_QUERY_USER_ID=true</code>) and <code>Idempotency-Key</code> headers from every
            request.
          </li>
          <li>
            <strong>Sidecar &rarr; Limiter (<code>:8080</code>):</strong> HTTP/1.1 GET{" "}
            <code>/check_hierarchical</code>. The sidecar HTTP client timeout is{" "}
            <code>SIDECAR_LIMITER_HTTP_TIMEOUT_MS</code> (default <strong>1500 ms</strong>). Every call is
            guarded by the <code>cb:central-limiter</code> circuit breaker.
          </li>
          <li>
            <strong>Limiter &rarr; Redis (<code>:6379</code>):</strong> Redis protocol. Connection pool:
            dial/read/write timeout <strong>500 ms</strong>, pool timeout <strong>1000 ms</strong>. Scripts are
            pre-loaded via <code>SCRIPT LOAD</code> and invoked with <code>EVALSHA</code>. Guarded by{" "}
            <code>cb:redis</code>.
          </li>
          <li>
            <strong>Admin API &rarr; Redis (<code>:6379</code>):</strong> Redis protocol. Writes{" "}
            <code>config:{"{level}"}:{"{id}"}</code> HASH fields and increments{" "}
            <code>config:generation</code> atomically. The limiter detects the generation increment on the
            next request and invalidates its local override cache.
          </li>
          <li>
            <strong>Sidecar &rarr; Upstream (<code>:8081</code>):</strong> HTTP/1.1 forwarded request. Only
            reached after explicit limiter admission. When gateway routing is active, the sidecar resolves the
            target endpoint via <code>route:gw:{"{id}"}</code> keys and the request is guarded by a
            per-gateway circuit breaker.
          </li>
        </ul>

        {/* ── State / Scaling / Failure ─────────────────────────────────── */}
        <h2 className="guide-sub-heading" id="state-scaling">State Ownership, Scaling, and Failure Boundaries</h2>

        <h3 style={{ color: "#ff5cad", fontSize: 14, marginTop: 20, marginBottom: 8 }}>State Ownership</h3>
        <p>
          Redis is the single authoritative source of truth for all correctness-critical state. Neither the
          sidecar nor the limiter can produce incorrect admission decisions in isolation — both defer to Redis for
          all quota checks. The sidecar&rsquo;s in-memory denial cache is conservative: it can only accelerate
          a denial that Redis has already issued, never produce an incorrect admission.
        </p>

        <h3 style={{ color: "#ff5cad", fontSize: 14, marginTop: 20, marginBottom: 8 }}>Scaling Boundaries</h3>
        <ul className="guide-bullets-list">
          <li>
            <strong>Sidecar:</strong> Horizontally scalable. Each replica carries its own ephemeral denial
            cache. A newly started replica sees cache misses on first contact for each user, causing one extra
            limiter round-trip before the 30 ms denial window materializes. No shared sidecar state exists
            between replicas.
          </li>
          <li>
            <strong>Limiter:</strong> Horizontally scalable. More replicas increase the Redis connection count
            proportionally; ensure Redis pool settings can accommodate the total across all replicas. Quota
            correctness is unaffected by scale because all serialization happens inside Redis Lua.
          </li>
          <li>
            <strong>Redis:</strong> Single-master vertical scaling. Sentinel provides HA failover but not
            horizontal write throughput. Redis Cluster is structurally incompatible with the multi-key Lua
            scripts used by hierarchical quotas unless hash tags are applied uniformly (not currently
            implemented).
          </li>
        </ul>

        <h3 style={{ color: "#ff5cad", fontSize: 14, marginTop: 20, marginBottom: 8 }}>Failure Boundaries</h3>
        <ul className="guide-bullets-list">
          <li>
            <strong>Sidecar failure:</strong> Requests to that replica fail; other replicas are unaffected.
            No shared in-process state exists between sidecar replicas.
          </li>
          <li>
            <strong>Limiter failure:</strong> Sidecars detect via <code>cb:central-limiter</code>. With{" "}
            <code>FAIL_OPEN=false</code> (default), all requests to affected sidecars return 503 until the
            circuit closes or the limiter recovers.
          </li>
          <li>
            <strong>Redis failure:</strong> Limiters detect via <code>cb:redis</code>. With{" "}
            <code>CIRCUIT_FAIL_OPEN=false</code>, limiters surface errors back to sidecars. The sidecar then
            applies its own <code>FAIL_OPEN</code> policy. Denial cache provides no protection during Redis
            outages — cached denials are short-lived (30 ms) and expire quickly.
          </li>
          <li>
            <strong>Admin API failure:</strong> No impact on the quota enforcement hot path. Overrides cannot
            be mutated, but the limiter continues serving from its local in-memory cache (up to{" "}
            <code>OVERRIDE_CACHE_TTL_MS</code> = 5000 ms) and Redis until TTL expires.
          </li>
        </ul>

        {/* ── Ports & Redis Keys ───────────────────────────────────────── */}
        <h2 className="guide-sub-heading" id="ports-keys">Ports and Redis Key Reference</h2>
        <div style={{ overflowX: "auto", margin: "20px 0" }}>
          <table className="guide-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #27272a", textAlign: "left" }}>
                <th style={{ padding: "12px 8px" }}>Redis Key Pattern</th>
                <th style={{ padding: "12px 8px" }}>Type</th>
                <th style={{ padding: "12px 8px" }}>Writer</th>
                <th style={{ padding: "12px 8px" }}>Evidence</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["rate:{userID}", "HASH", "Flat token bucket  /check", "SOURCE-PROVEN"],
                ["sw:{userID}", "ZSET", "Sliding window  /check", "SOURCE-PROVEN"],
                ["rate:global", "HASH", "Hierarchical — global tier", "SOURCE-PROVEN"],
                ["rate:tenant:{t}", "HASH", "Hierarchical — tenant tier", "SOURCE-PROVEN"],
                ["rate:user:{u}", "HASH", "Hierarchical — user tier", "SOURCE-PROVEN"],
                ["rate:endpoint:{t}:{ep}", "HASH", "Hierarchical — endpoint tier", "SOURCE-PROVEN"],
                ["config:{level}:{id}", "HASH", "Admin API — capacity / refill_rate overrides", "SOURCE-PROVEN"],
                ["config:generation", "STRING", "Admin API — monotonic override version counter", "SOURCE-PROVEN"],
                ["cb:{target}", "HASH", "Circuit breaker store  (redis, central-limiter, gateway IDs)", "SOURCE-PROVEN"],
                ["idem:{scope}:{key}", "HASH", "Idempotency — lease + fence token + cached response body", "SOURCE-PROVEN"],
                ["route:gw:{id}", "HASH", "Gateway routing table entry", "SOURCE-PROVEN"],
                ["route:index", "SET", "Gateway routing index", "SOURCE-PROVEN"],
                ["audit:event:{id}", "HASH", "Audit log event (append-only)", "SOURCE-PROVEN"],
              ].map(([key, type, owner, evidence]) => (
                <tr key={key} style={{ borderBottom: "1px solid #27272a" }}>
                  <td style={{ padding: "12px 8px", fontFamily: "monospace", color: "#ff5cad" }}>{key}</td>
                  <td style={{ padding: "12px 8px" }}>{type}</td>
                  <td style={{ padding: "12px 8px", color: "#a1a1aa" }}>{owner}</td>
                  <td style={{ padding: "12px 8px" }}><RLEvidenceBadge type={evidence} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <RLSourceExcerpt
          source="internal/circuitbreaker/types.go — well-known circuit targets"
          establishes="Circuit breaker state key cb:{target} uses compile-time constants for redis and central-limiter; gateway IDs are dynamic string values at runtime."
        >{`const (
    TargetRedis          = "redis"
    TargetCentralLimiter = "central-limiter"
)

// Redis key pattern: cb:{"{target}"}  (internal/circuitbreaker/store.go)`}</RLSourceExcerpt>

        <RLRelatedPages pages={[
          { section: "introduction", slug: "start-here", title: "Start Here", note: "Platform introduction and terminology" },
          { section: "architecture", slug: "anatomy-of-a-request", title: "Anatomy of a Request", note: "Detailed per-stage request trace with sequence diagrams" },
          { section: "architecture", slug: "distributed-state-model", title: "Distributed State Model", note: "Full state ownership and consistency analysis" },
          { section: "production-engineering", slug: "deployment-topology", title: "Deployment Topology", note: "Docker Compose and Kubernetes topologies" },
        ]} />
      </div>
    )
  },

  /* ═══════════════════════════════════════════════════════════════════════
     PAGE 2 — anatomy-of-a-request  (FLAGSHIP)
     ═══════════════════════════════════════════════════════════════════════ */
  "anatomy-of-a-request": {
    title: "Anatomy of a Request",
    topics: [
      { label: "serveNormal Pipeline", href: "#serve-normal" },
      { label: "Allowed Request Path", href: "#allowed-path" },
      { label: "Rate-Limited Path", href: "#denied-path" },
      { label: "Dependency Failure Paths", href: "#dependency-failures" },
      { label: "Idempotent Request Path", href: "#idempotency-path" },
      { label: "Stage Ownership Table", href: "#stage-ownership" },
    ],
    content: (
      <div>
        <RLThesis>
          Every non-idempotent request flows through <code>serveNormal</code>: denial cache (denied-only)
          &rarr; singleflight deduplication &rarr; <code>checkRateLimit</code> with{" "}
          <code>cb:central-limiter</code> circuit guard &rarr; upstream forward or 429. Idempotent requests
          (mutating method + <code>Idempotency-Key</code> header) take a parallel branch through{" "}
          <code>serveIdempotent</code>, which claims an <code>idem:{"{scope}"}:{"{key}"}</code> lease in Redis
          before any rate-limit check, and replays the cached response on re-delivery.
        </RLThesis>

        <RLQuickModel>
          Denial cache hit (Allowed=false) &rarr; immediate 429, limiter bypassed. Denial cache hit
          (Allowed=true) &rarr; ignored, limiter always re-checked (prevents quota-freeze attacks). Cache miss
          &rarr; singleflight collapses all concurrent requests for the same key into one limiter round-trip.
          429 from limiter is excluded from circuit-breaker failure counts (it is an expected signal, not an
          error).
        </RLQuickModel>

        {/* ── serveNormal pipeline ─────────────────────────────────────── */}
        <h2 className="guide-sub-heading" id="serve-normal">serveNormal Pipeline</h2>
        <DocsMermaid chart={`
flowchart TD
    Entry(["serveNormal called"]) --> IC{Denial cache hit?\\nAllowed=false only}
    IC -->|"yes — Allowed=false"| D429["writeDenial 429\\n+ Retry-After header"]
    IC -->|"miss or Allowed=true"| SF["singleflight.Do(cacheKey)\\ncollapses N concurrent calls → 1"]
    SF --> CB{cb:central-limiter\\nAllow check}
    CB -->|"Open"| E503["503 Service Unavailable\\nFAIL_OPEN=false"]
    CB -->|"Closed / Allowed"| LIM["HTTP GET /check_hierarchical\\nto Limiter :8080\\ntimeout 1500ms"]
    LIM --> REC["cb:central-limiter Record\\n(429 excluded from failure counts)"]
    REC --> ST["cache.Store result\\n(Allowed + 30ms TTL)"]
    ST --> AD{admitted?}
    AD -->|"no"| D429
    AD -->|"yes"| FWD["forwardRequest upstream\\n:8081"]
    style Entry fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style D429 fill:#1e1e2e,stroke:#ec4899,color:#fff
    style FWD fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style E503 fill:#18181b,stroke:#ec4899,color:#a1a1aa
        `} />

        <RLSourceExcerpt
          source="cmd/sidecar/main.go — serveNormal (lines 361-445)"
          establishes="Source-verified hot-path order: denial-only cache check, singleflight deduplication, checkRateLimit, cache.Store, then forward or writeDenial. Allowed=true cache entries are logged but never skip the limiter."
        >{`func (s *Sidecar) serveNormal(w http.ResponseWriter, r *http.Request, userID string) {
    cacheKey := s.cacheKey(r, userID)

    if val, ok := s.cache.Load(cacheKey); ok {
        entry := val.(CacheEntry)
        if time.Now().Before(entry.ExpiresAt) {
            if !entry.Allowed {
                s.writeDenial(w, entry.Limit, entry.Remaining, entry.RetryAfter)
                return
            }
            // Allowed entries never skip the limiter — logged but not acted on.
        }
    }

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
        Allowed: result.allowed, ExpiresAt: time.Now().Add(s.ttl),
    })
    if !result.allowed {
        s.writeDenial(w, result.limit, result.remaining, result.retryAfter)
        return
    }
    s.forwardRequest(w, r)
}`}</RLSourceExcerpt>

        <RLCallout variant="info" title="Denial cache TTL: 30 ms — not 1 s">
          <code>CACHE_TTL_MS</code> defaults to <strong>30 ms</strong> (hardcoded as{" "}
          <code>30 * time.Millisecond</code> in <code>cmd/sidecar/main.go main()</code>). The environment
          variable overrides this at runtime. Previous documentation citing 1000 ms or 1 s was incorrect.{" "}
          <RLEvidenceBadge type="SOURCE-PROVEN" />
        </RLCallout>

        {/* ── Allowed Path ─────────────────────────────────────────────── */}
        <h2 className="guide-sub-heading" id="allowed-path">1. The Allowed Request Path</h2>
        <DocsMermaid chart={`
sequenceDiagram
    participant C as Client
    participant S as Sidecar :9090
    participant L as Limiter :8080
    participant R as Redis :6379
    participant U as Upstream :8081

    C->>S: GET /items  X-User-ID: u1
    S->>S: identity.ResolveUserID(r)
    S->>S: denial cache miss
    S->>S: singleflight.Do(cacheKey) — first caller wins
    S->>L: GET /check_hierarchical?user=u1&tenant=t1&endpoint=items
    L->>L: read config:generation — check override cache
    L->>R: EVALSHA hierarchical.lua KEYS [rate:global, rate:tenant:t1, rate:user:u1, rate:endpoint:t1:items]
    R-->>L: [1, 42]  allowed=1  remaining=42
    L-->>S: 200 OK  X-RateLimit-Remaining: 42
    S->>S: cache.Store(key, Allowed=true, TTL=30ms)
    S->>U: GET /items  (forwarded with original headers)
    U-->>S: 200 OK  response body
    S-->>C: 200 OK  response body + rate-limit headers
        `} />

        <ol className="guide-bullets-list" style={{ listStyleType: "decimal" }}>
          <li>Client sends <code>GET /items</code> to the sidecar (<code>:9090</code>).</li>
          <li>
            <code>ServeHTTP</code> calls <code>identity.ResolveUserID</code>; no{" "}
            <code>Idempotency-Key</code> header present for a GET &rarr; <code>serveNormal</code> branch.
          </li>
          <li>Denial cache lookup misses (or finds an Allowed=true entry, which is ignored).</li>
          <li>
            <code>singleflight.Do(cacheKey)</code> is called. If 100 concurrent goroutines share this
            cacheKey, only one <code>/check_hierarchical</code> RPC is issued; all 100 share the result.
          </li>
          <li>
            The limiter reads <code>config:generation</code> from Redis; if it has changed since the last
            check, the local override cache is invalidated and overrides are reloaded within{" "}
            <code>OVERRIDE_CACHE_TTL_MS</code> (5000 ms).
          </li>
          <li>
            The limiter issues <code>EVALSHA hierarchical.lua</code> with four KEYS:{" "}
            <code>rate:global</code>, <code>rate:tenant:{"{t}"}</code>, <code>rate:user:{"{u}"}</code>,{" "}
            <code>rate:endpoint:{"{t}"}:{"{ep}"}</code>. Redis executes the script atomically — all four
            tiers are checked and decremented in a single serialized operation.
          </li>
          <li>
            Redis returns <code>[1, 42]</code> (allowed, remaining). The limiter responds with{" "}
            <code>200 OK</code> and rate-limit headers.
          </li>
          <li>
            The sidecar stores the result with a 30 ms TTL (Allowed=true). On the next request for this key
            within 30 ms, the Allowed=true entry is found but silently ignored — the limiter is still
            consulted.
          </li>
          <li>The sidecar forwards the original request to the upstream (<code>:8081</code>).</li>
        </ol>

        {/* ── Denied Path ──────────────────────────────────────────────── */}
        <h2 className="guide-sub-heading" id="denied-path">2. The Rate-Limited Path</h2>
        <DocsMermaid chart={`
sequenceDiagram
    participant C as Client
    participant S as Sidecar :9090
    participant L as Limiter :8080
    participant R as Redis :6379

    C->>S: GET /items  X-User-ID: u1
    S->>S: denial cache miss
    S->>L: GET /check_hierarchical
    L->>R: EVALSHA hierarchical.lua
    Note over R: tenant tier exhausted — allowed=0
    R-->>L: [0, 0]  no tokens deducted from any tier
    L-->>S: 429 Too Many Requests  Retry-After: N
    S->>S: cache.Store(key, Allowed=false, TTL=30ms)
    S-->>C: 429  Retry-After: N

    Note over C,S: Second request within 30 ms window
    C->>S: GET /items  X-User-ID: u1
    S->>S: denial cache HIT — Allowed=false
    S-->>C: 429  (limiter + Redis bypassed entirely)
        `} />

        <ol className="guide-bullets-list" style={{ listStyleType: "decimal" }}>
          <li>
            The limiter runs <code>hierarchical.lua</code>; one tier (e.g., tenant) has insufficient tokens.
          </li>
          <li>
            The Lua script writes updated refill state to all tiers but <strong>deducts zero tokens</strong>{" "}
            from any tier — the all-or-nothing invariant. Returns <code>[0, 0]</code>.
          </li>
          <li>The limiter returns <code>429 Too Many Requests</code> with a <code>Retry-After</code> header.</li>
          <li>
            The sidecar stores <code>Allowed=false</code> with a 30 ms TTL. The 429 response is classified as
            an expected signal by <code>ClassifyHTTP</code> and is excluded from{" "}
            <code>cb:central-limiter</code> failure accounting.
          </li>
          <li>The client receives <code>429</code> plus the <code>Retry-After</code> value.</li>
          <li>
            Any subsequent request for the same cacheKey within 30 ms hits the denial cache directly — the
            limiter and Redis are bypassed, dramatically reducing load during burst denial floods.
          </li>
        </ol>

        <RLSourceExcerpt
          source="internal/limiter/lua/hierarchical.lua — denied path (lines 55-72)"
          establishes="On denial, no tier loses tokens — only refill state (last_refill timestamp) is written. This is the source-proven all-or-nothing invariant."
          language="lua"
        >{`if allowed == 1 then
    for i = 1, levels do
        local updated_tokens = level_new_tokens[i] - requested
        redis.call('HMSET', keys[i], 'tokens', updated_tokens, 'last_refill', now)
    end
    remaining = math.floor(min_remaining - requested)
else
    -- Denied: update refill state only, deduct nothing from any tier.
    for i = 1, levels do
        redis.call('HMSET', keys[i], 'tokens', level_new_tokens[i], 'last_refill', now)
    end
    remaining = 0
end
return {allowed, remaining}`}</RLSourceExcerpt>

        {/* ── Dependency Failures ──────────────────────────────────────── */}
        <h2 className="guide-sub-heading" id="dependency-failures">3. Dependency Failure Paths</h2>
        <p>
          Four distinct failure modes exist below the sidecar. Each has a separate circuit breaker state and
          configurable fail-open/fail-closed behavior.
        </p>

        <h3 style={{ color: "#ff5cad", fontSize: 14, marginTop: 20, marginBottom: 8 }}>3a. Limiter Unavailable</h3>
        <DocsMermaid chart={`
sequenceDiagram
    participant C as Client
    participant S as Sidecar :9090
    participant L as Limiter :8080

    C->>S: GET /items
    S->>S: denial cache miss
    S->>S: cb:central-limiter Allow() — circuit CLOSED
    S->>L: GET /check_hierarchical
    L--xS: timeout > 1500ms or connection refused
    S->>S: cb:central-limiter Record(failure)
    alt FAIL_OPEN=false (default)
        S-->>C: 503 Service Unavailable
    else FAIL_OPEN=true
        S->>S: forwardRequest (bypass limiter)
        S-->>C: upstream response
    end

    Note over S: After threshold failures — circuit OPEN
    C->>S: GET /items
    S->>S: cb:central-limiter Allow() — circuit OPEN
    S-->>C: 503 (no limiter RPC attempted)
        `} />

        <h3 style={{ color: "#ff5cad", fontSize: 14, marginTop: 20, marginBottom: 8 }}>3b. Redis Unavailable</h3>
        <p>
          When Redis is unreachable from the limiter, the <code>cb:redis</code> circuit breaker trips inside
          the limiter process (dial/read/write timeout = 500 ms, pool timeout = 1000 ms). With{" "}
          <code>CIRCUIT_FAIL_OPEN=false</code>, the limiter returns an error to the sidecar. The sidecar then
          applies its own <code>FAIL_OPEN</code> policy — returning 503 by default. During a Redis outage,
          denial cache entries expire quickly (30 ms), providing no sustained protection.
        </p>

        <h3 style={{ color: "#ff5cad", fontSize: 14, marginTop: 20, marginBottom: 8 }}>3c. Circuit Open</h3>
        <p>
          Once the <code>cb:central-limiter</code> circuit is open, the sidecar&rsquo;s{" "}
          <code>checkRateLimit</code> returns immediately without making an HTTP call to the limiter.
          With <code>FAIL_OPEN=false</code> this causes a 503. The circuit transitions to half-open after a
          configured cool-down and re-tests with a single probe request. A 429 from the limiter does{" "}
          <em>not</em> count as a failure — only connection errors and timeouts affect the circuit.
        </p>

        <h3 style={{ color: "#ff5cad", fontSize: 14, marginTop: 20, marginBottom: 8 }}>3d. Gateway Unavailable (Routing Mode)</h3>
        <p>
          When the sidecar&rsquo;s gateway router is active, each upstream gateway has its own circuit breaker
          keyed as <code>cb:{"{gateway-id}"}</code> in Redis. If a gateway&rsquo;s circuit opens, the router
          selects an alternate gateway from the <code>route:index</code> set. If all gateways are in open
          state, the request fails with 503.
        </p>

        <RLSourceExcerpt
          source="cmd/sidecar/main.go — checkRateLimit circuit guard"
          establishes="Source-verified: cb:central-limiter Allow() and Record() bracket every limiter HTTP call. ClassifyHTTP excludes 429 from failure counts."
        >{`if s.limiterCircuit != nil {
    allow, err := s.limiterCircuit.Allow(ctx, circuitbreaker.TargetCentralLimiter)
    if err != nil && !s.limiterCircuit.Config().FailOpen {
        return limitResult{}, fmt.Errorf("circuit breaker unavailable: %w", err)
    } else if !allow.Allowed {
        return limitResult{}, fmt.Errorf("central limiter circuit %s", allow.State)
    }
}

start := time.Now()
// ... HTTP GET to limiter /check_hierarchical (timeout: SIDECAR_LIMITER_HTTP_TIMEOUT_MS = 1500ms)

defer func() {
    input := circuitbreaker.ClassifyHTTP(callErr, statusCode, time.Since(start), ...)
    // 429 is an expected signal — ClassifyHTTP does not count it as a failure.
    _ = s.limiterCircuit.Record(ctx, circuitbreaker.TargetCentralLimiter, input)
}()`}</RLSourceExcerpt>

        {/* ── Idempotent Path ──────────────────────────────────────────── */}
        <h2 className="guide-sub-heading" id="idempotency-path">4. The Idempotent Request Path</h2>
        <DocsMermaid chart={`
sequenceDiagram
    participant C as Client
    participant S as Sidecar :9090
    participant R as Redis :6379
    participant L as Limiter :8080
    participant U as Upstream :8081

    C->>S: POST /payments  Idempotency-Key: k1
    S->>S: serveIdempotent branch — IsMutatingMethod + header present
    S->>R: claim.lua  idem:payments:k1  scope=payments

    alt New claim — never seen before
        R-->>S: status=processing  fence_token=1
        S->>L: checkRateLimit (rate-limit applies to idempotent requests too)
        L-->>S: admitted
        S->>U: POST /payments  fence_token=1
        U-->>S: 201 Created  body={...}
        S->>R: complete.lua  fence=1  store status + response body
        R-->>S: OK
        S-->>C: 201 Created
    else Already completed — replay
        R-->>S: status=completed  cached status + body
        S-->>C: 200  (exact replay — no upstream call)
    else In-progress duplicate — concurrent retry
        R-->>S: status=processing
        S-->>C: 409 Conflict  (or wait based on config)
    end
        `} />

        <ol className="guide-bullets-list" style={{ listStyleType: "decimal" }}>
          <li>
            <code>ServeHTTP</code> detects a mutating method (POST/PUT/PATCH/DELETE) and a non-empty{" "}
            <code>Idempotency-Key</code> header &rarr; routes to <code>serveIdempotent</code>.
          </li>
          <li>
            <code>claim.lua</code> is called against Redis key{" "}
            <code>idem:{"{scope}"}:{"{key}"}</code>. If the key does not exist, the script atomically sets
            <code>status=processing</code> and generates a <code>fence_token</code> (monotonic counter).
          </li>
          <li>
            For a new claim, <code>checkRateLimit</code> runs exactly as in <code>serveNormal</code> — the
            rate limit applies to idempotent requests as well.
          </li>
          <li>
            After successful upstream execution, <code>complete.lua</code> atomically verifies the fence token
            matches before writing the response body and changing status to <code>completed</code>. This
            prevents a stale sidecar from overwriting results from a newer fence holder.
          </li>
          <li>
            On re-delivery (same key, any sidecar replica): <code>claim.lua</code> returns{" "}
            <code>status=completed</code> and the cached body. The upstream is never called again.
          </li>
          <li>
            On concurrent re-delivery while still processing: <code>claim.lua</code> returns{" "}
            <code>status=processing</code> and the sidecar returns <code>409 Conflict</code>.
          </li>
        </ol>

        <RLCallout variant="info" title="IDEMPOTENCY_FAIL_OPEN=false">
          If Redis is unavailable during a lease claim attempt, <code>IDEMPOTENCY_FAIL_OPEN=false</code>{" "}
          (the default) causes the request to fail with 503 rather than proceeding without idempotency
          protection. Setting it to <code>true</code> allows the request to fall through to{" "}
          <code>serveNormal</code>.
        </RLCallout>

        {/* ── Stage Ownership ──────────────────────────────────────────── */}
        <h2 className="guide-sub-heading" id="stage-ownership">Stage Ownership Table</h2>
        <div style={{ overflowX: "auto", margin: "20px 0" }}>
          <table className="guide-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #27272a", textAlign: "left" }}>
                <th style={{ padding: "12px 8px" }}>Stage</th>
                <th style={{ padding: "12px 8px" }}>Owner</th>
                <th style={{ padding: "12px 8px" }}>Latency Budget</th>
                <th style={{ padding: "12px 8px" }}>Can Short-Circuit?</th>
                <th style={{ padding: "12px 8px" }}>Failure Mode</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Identity resolution", "Sidecar — identity pkg", "~0ms (header read)", "No", "Missing user ID: 400"],
                ["Idempotency claim", "Sidecar + Redis — claim.lua", "Redis RTT (~1ms)", "Yes — replay or 409", "IDEMPOTENCY_FAIL_OPEN governs"],
                ["Denial cache lookup", "Sidecar — sync.Map", "<1 µs", "Yes — 429 immediately", "None (in-process)"],
                ["Singleflight dedup", "Sidecar — singleflight.Group", "0ms overhead", "No (collapses, not skips)", "None (in-process)"],
                ["Circuit Allow()", "Sidecar — cb:central-limiter", "Redis RTT", "Yes — 503 if Open", "FAIL_OPEN governs"],
                ["Limiter HTTP call", "Sidecar → Limiter :8080", "≤1500ms timeout", "No", "503 (fail-closed)"],
                ["Override generation check", "Limiter — config:generation GET", "Redis RTT", "No", "Stale cache serves ≤5s"],
                ["Lua quota evaluation", "Redis — hierarchical.lua", "~0.5ms in Redis", "Yes — [0,0] denied", "Redis circuit trips"],
                ["Cache.Store result", "Sidecar — sync.Map", "<1 µs", "No", "None"],
                ["Upstream forward", "Sidecar — HTTP proxy", "Upstream RTT", "No", "Upstream error propagated"],
                ["Idempotency complete", "Sidecar + Redis — complete.lua", "Redis RTT", "No", "Fence mismatch: discard write"],
              ].map(([stage, owner, lat, sc, fail]) => (
                <tr key={stage} style={{ borderBottom: "1px solid #27272a" }}>
                  <td style={{ padding: "12px 8px", fontWeight: 600, color: "#ff5cad" }}>{stage}</td>
                  <td style={{ padding: "12px 8px", color: "#d4d4d8", fontSize: 12 }}>{owner}</td>
                  <td style={{ padding: "12px 8px", color: "#a1a1aa", fontSize: 12 }}>{lat}</td>
                  <td style={{ padding: "12px 8px", color: sc.startsWith("Yes") ? "#ff5cad" : "#71717a", fontSize: 12 }}>{sc}</td>
                  <td style={{ padding: "12px 8px", color: "#71717a", fontSize: 12 }}>{fail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <RLRelatedPages pages={[
          { section: "resilience", slug: "denial-cache-and-singleflight", title: "Denial Cache & Singleflight", note: "Deep-dive into denial offloading mechanics" },
          { section: "resilience", slug: "circuit-breaker", title: "Circuit Breaker", note: "cb:redis, cb:central-limiter, cb:{gateway-id}" },
          { section: "resilience", slug: "idempotency", title: "Idempotency", note: "Lease lifecycle, fence tokens, replay semantics" },
          { section: "rate-limiting-engine", slug: "hierarchical-quotas", title: "Hierarchical Quotas", note: "Lua all-or-nothing deduction mechanics" },
        ]} />
      </div>
    )
  },

  /* ═══════════════════════════════════════════════════════════════════════
     PAGE 3 — distributed-state-model  (FLAGSHIP)
     ═══════════════════════════════════════════════════════════════════════ */
  "distributed-state-model": {
    title: "Distributed State Model",
    topics: [
      { label: "Full Ownership Matrix", href: "#ownership-matrix" },
      { label: "State Type Taxonomy", href: "#state-taxonomy" },
      { label: "Strong vs Eventual Visibility", href: "#visibility" },
      { label: "Consistency Boundary Diagram", href: "#consistency-diagram" },
      { label: "Restart & Failure Behavior", href: "#restart-behavior" },
      { label: "Stale Cache & Replica Addition", href: "#stale-replica" },
    ],
    content: (
      <div>
        <RLThesis>
          The rate limiter coordinates three distinct tiers of state: authoritative Redis state (quota counters,
          override configs, circuit health, idempotency leases, gateway routes, audit events); process-local
          ephemeral caches (denial-only <code>sync.Map</code> in the sidecar, override in-memory TTL map in the
          limiter); and coordination primitives (singleflight in-process deduplication). Only Redis state
          survives process restarts. Correctness invariants require that every admission decision — regardless
          of replica, network partition state, or cache freshness — defer to Redis as the final authority.
        </RLThesis>

        <RLQuickModel>
          Redis = authoritative truth for quota, overrides, circuits, idempotency, routing, auditing.
          Sidecar sync.Map = conservative denial shield (30 ms, Allowed=false only). Limiter override cache =
          reduces Redis reads; invalidated within 5000 ms on generation change. Singleflight = in-process
          only; never persisted; invisible to other replicas.
        </RLQuickModel>

        {/* ── Full Ownership Matrix ────────────────────────────────────── */}
        <h2 className="guide-sub-heading" id="ownership-matrix">Full State Ownership Matrix</h2>
        <div style={{ overflowX: "auto", margin: "20px 0" }}>
          <table className="guide-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #27272a", textAlign: "left" }}>
                <th style={{ padding: "10px 8px" }}>State</th>
                <th style={{ padding: "10px 8px" }}>Storage</th>
                <th style={{ padding: "10px 8px" }}>Scope</th>
                <th style={{ padding: "10px 8px" }}>Authority</th>
                <th style={{ padding: "10px 8px" }}>Synchronization</th>
                <th style={{ padding: "10px 8px" }}>Replica Consistency</th>
                <th style={{ padding: "10px 8px" }}>Restart Behavior</th>
                <th style={{ padding: "10px 8px" }}>Correctness Impact</th>
              </tr>
            </thead>
            <tbody>
              {[
                [
                  "Flat quotas  (rate:{userID}, sw:{userID})",
                  "Redis HASH / ZSET",
                  "Per user ID",
                  "Authoritative — Redis master",
                  "Lua atomic EVALSHA; single-threaded Redis serialization",
                  "Strong — all replicas read same master",
                  "Durable (AOF/RDB); no data loss on process restart",
                  "Critical — over-admission impossible while Redis is reachable"
                ],
                [
                  "Hierarchical quotas  (rate:global, rate:tenant:*, rate:user:*, rate:endpoint:*:*)",
                  "Redis HASH ×4 per request",
                  "Tenant / user / endpoint cross-tier",
                  "Authoritative — Redis master",
                  "Multi-key Lua script; all tiers checked and written in one EVALSHA",
                  "Strong — all limiter replicas share same master",
                  "Durable; token counters persist across limiter restarts",
                  "Critical — all-or-nothing deduction enforced by Lua branch logic"
                ],
                [
                  "Configuration overrides  (config:{level}:{id}, config:generation)",
                  "Redis HASH + STRING",
                  "Per level+ID override; global generation counter",
                  "Authoritative — Redis master; limiter carries derived cache",
                  "Optimistic: limiter reads config:generation on every request; mismatch invalidates local cache",
                  "Eventual — limiter cache may serve stale overrides up to OVERRIDE_CACHE_TTL_MS (5000 ms)",
                  "Durable; local cache wiped on restart, reloaded from Redis",
                  "Significant — stale override may over- or under-admit for up to 5000 ms"
                ],
                [
                  "Circuit breaker  (cb:{target})",
                  "Redis HASH",
                  "Per circuit target (redis, central-limiter, gateway IDs)",
                  "Shared Redis — all replicas observe same circuit state",
                  "Redis HASH SET/GET; no Lua; eventual propagation via Redis read",
                  "Eventual — replicas may briefly disagree on circuit state between reads",
                  "Durable; circuit state persists across process restarts (may start in Open state)",
                  "High — open circuit prevents all limiter calls (fail-closed by default)"
                ],
                [
                  "Idempotency records  (idem:{scope}:{key})",
                  "Redis HASH",
                  "Per idempotency scope + client key",
                  "Authoritative — Redis master; claim/complete Lua ensures fence integrity",
                  "Lua atomic claim + complete; fence token prevents stale overwrites",
                  "Strong — all sidecar replicas share same idem:* keys",
                  "Durable; completed responses survive sidecar restarts",
                  "Critical — prevents duplicate upstream execution; fence ensures exactly-one-write semantics"
                ],
                [
                  "Denial cache  (sidecar sync.Map)",
                  "Process memory — sync.Map per sidecar replica",
                  "Per sidecar process",
                  "Derived — populated from limiter responses; denial-only",
                  "None — not shared between replicas; no synchronization",
                  "None — each replica has independent cold start",
                  "Ephemeral — wiped on sidecar restart; cold-cache miss incurs one limiter RTT",
                  "Conservative — can only accelerate denial, never produce incorrect admission"
                ],
                [
                  "Singleflight  (limitFlight singleflight.Group)",
                  "Process memory — per sidecar goroutine group",
                  "Per sidecar process, per cacheKey",
                  "Local optimization — no Redis backing",
                  "Go singleflight: concurrent callers for same key share one RPC result",
                  "None — invisible to other replicas",
                  "Ephemeral — wiped on restart; no state to recover",
                  "None for correctness — only reduces limiter load; result is same as N individual calls"
                ],
                [
                  "Override local cache  (limiter in-memory TTL map)",
                  "Process memory — per limiter replica",
                  "Per limiter process",
                  "Derived — populated from Redis config:* reads; generation-validated",
                  "Reads config:generation on each /check_hierarchical call; mismatch triggers reload",
                  "Eventual — up to OVERRIDE_CACHE_TTL_MS (5000 ms) stale across replicas",
                  "Ephemeral — wiped on restart; reloaded from Redis within next request cycle",
                  "Moderate — stale override window bounded by OVERRIDE_CACHE_TTL_MS"
                ],
                [
                  "Gateway state  (route:gw:{id}, route:index)",
                  "Redis HASH + SET",
                  "Per gateway ID; global index",
                  "Authoritative — Redis master",
                  "Redis HASH GET/SET; gateway router reads on request",
                  "Eventual — router reads route:gw:{id} per request; Redis propagation lag applies",
                  "Durable; routes survive sidecar restarts",
                  "Operational — incorrect route causes wrong upstream; circuit breaker per gateway mitigates"
                ],
                [
                  "Audit queue  (audit:event:{id})",
                  "Redis HASH (append-only)",
                  "Per audit event UUID",
                  "Authoritative — Redis master",
                  "Atomic HSETNX or similar; event IDs are UUIDs preventing collision",
                  "Strong — all writers share same Redis master",
                  "Durable; events persist across any process restart",
                  "None for admission — observability only"
                ],
              ].map(([state, storage, scope, authority, sync, consistency, restart, impact]) => (
                <tr key={state} style={{ borderBottom: "1px solid #27272a" }}>
                  <td style={{ padding: "10px 8px", fontWeight: 600, color: "#ff5cad", whiteSpace: "nowrap", verticalAlign: "top" }}>{state}</td>
                  <td style={{ padding: "10px 8px", color: "#d4d4d8", verticalAlign: "top" }}>{storage}</td>
                  <td style={{ padding: "10px 8px", color: "#a1a1aa", verticalAlign: "top" }}>{scope}</td>
                  <td style={{ padding: "10px 8px", color: "#d4d4d8", verticalAlign: "top" }}>{authority}</td>
                  <td style={{ padding: "10px 8px", color: "#a1a1aa", verticalAlign: "top" }}>{sync}</td>
                  <td style={{ padding: "10px 8px", color: "#d4d4d8", verticalAlign: "top" }}>{consistency}</td>
                  <td style={{ padding: "10px 8px", color: "#a1a1aa", verticalAlign: "top" }}>{restart}</td>
                  <td style={{ padding: "10px 8px", color: "#d4d4d8", verticalAlign: "top" }}>{impact}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── State Taxonomy ───────────────────────────────────────────── */}
        <h2 className="guide-sub-heading" id="state-taxonomy">State Type Taxonomy</h2>
        <p>
          The system uses five distinct state categories, each with different consistency and durability
          requirements:
        </p>
        <ul className="guide-bullets-list">
          <li>
            <strong>Authoritative state:</strong> Redis-owned records whose value is the ground truth for
            correctness. Includes flat/hierarchical quotas, idempotency leases, and audit events. Any replica
            reading this state reads the same master; atomicity is enforced by Lua scripts.
          </li>
          <li>
            <strong>Derived cached state:</strong> Process-local copies of authoritative state with bounded
            staleness. Includes the limiter&rsquo;s override cache (≤5000 ms) and the sidecar&rsquo;s denial
            cache (≤30 ms). Both are invalidated conservatively — the denial cache only caches denials, never
            admissions; the override cache is invalidated on any generation mismatch.
          </li>
          <li>
            <strong>Coordination state:</strong> Circuit breaker records (<code>cb:{"{target}"}</code>) and
            gateway routing tables (<code>route:gw:{"{id}"}</code>). Stored in Redis for cross-replica
            visibility but updated through normal Redis SET/GET — not Lua — so consistency is eventual within
            Redis propagation lag.
          </li>
          <li>
            <strong>Local optimization state:</strong> Singleflight groups. Purely in-process, process-local.
            Invisible to other replicas. No correctness consequence — result is identical to N individual calls.
          </li>
          <li>
            <strong>Append-only audit state:</strong> Audit events in <code>audit:event:{"{id}"}</code>. Durable,
            Redis-authoritative, but read-only for quota logic. Written as a side-effect of quota decisions.
          </li>
        </ul>

        {/* ── Visibility ───────────────────────────────────────────────── */}
        <h2 className="guide-sub-heading" id="visibility">Strong vs Eventual Visibility</h2>
        <div style={{ overflowX: "auto", margin: "20px 0" }}>
          <table className="guide-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #27272a", textAlign: "left" }}>
                <th style={{ padding: "12px 8px" }}>Operation</th>
                <th style={{ padding: "12px 8px" }}>Visibility Model</th>
                <th style={{ padding: "12px 8px" }}>Max Staleness</th>
                <th style={{ padding: "12px 8px" }}>Correctness Risk</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Quota token deduction", "Strong — Lua atomic", "0ms — Redis serialized", "None"],
                ["Override config read", "Eventual — local cache + gen check", "OVERRIDE_CACHE_TTL_MS = 5000ms", "May use stale capacity/rate"],
                ["Circuit state read", "Eventual — Redis HASH GET", "Redis read propagation (~1ms)", "Brief circuit state disagreement across replicas"],
                ["Denial cache read", "Local-only — no cross-replica", "CACHE_TTL_MS = 30ms", "None — conservative (denial only)"],
                ["Idempotency claim", "Strong — Lua claim.lua", "0ms — Redis serialized", "None"],
                ["Gateway route read", "Eventual — Redis HASH GET", "Redis read propagation (~1ms)", "Brief routing inconsistency"],
              ].map(([op, model, staleness, risk]) => (
                <tr key={op} style={{ borderBottom: "1px solid #27272a" }}>
                  <td style={{ padding: "12px 8px", color: "#ff5cad", fontWeight: 600 }}>{op}</td>
                  <td style={{ padding: "12px 8px", color: "#d4d4d8" }}>{model}</td>
                  <td style={{ padding: "12px 8px", color: "#a1a1aa" }}>{staleness}</td>
                  <td style={{ padding: "12px 8px", color: "#71717a", fontSize: 12 }}>{risk}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Consistency Diagram ──────────────────────────────────────── */}
        <h2 className="guide-sub-heading" id="consistency-diagram">Consistency Boundary Diagram</h2>
        <DocsMermaid chart={`
flowchart LR
    subgraph SC["Sidecar Process (per replica)"]
        DC["denial_cache\\nsync.Map\\n30ms TTL\\ndenial-only"]
        SF["singleflight.Group\\nper cacheKey\\nprocess-local only"]
    end
    subgraph LM["Limiter Process (per replica)"]
        OC["override cache\\nin-memory TTL map\\n≤5000ms staleness"]
    end
    subgraph RD["Redis Master (single authority)"]
        QU["rate:*  sw:*\\nStrong — Lua atomic"]
        CF["config:*\\nStrong writes\\nEven reads via cache"]
        CB["cb:*\\nEventual — HASH GET/SET"]
        ID["idem:*\\nStrong — Lua atomic"]
        GW["route:*\\nEventual — HASH GET/SET"]
        AU["audit:*\\nAppend-only"]
    end
    SC -->|"checkRateLimit HTTP"| LM
    LM -->|"EVALSHA"| RD
    SC -.->|"idempotency claim.lua"| RD
    SC -.->|"cb:central-limiter record"| RD
    LM -->|"config:generation GET"| RD
    style SC fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style LM fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style RD fill:#18181b,stroke:#ec4899,color:#fff
        `} />

        {/* ── Restart & Failure ────────────────────────────────────────── */}
        <h2 className="guide-sub-heading" id="restart-behavior">Restart and Failure Behavior</h2>

        <h3 style={{ color: "#ff5cad", fontSize: 14, marginTop: 20, marginBottom: 8 }}>Process Restart (Sidecar or Limiter)</h3>
        <ul className="guide-bullets-list">
          <li>All in-process state (denial cache, singleflight groups, override local cache) is lost on restart.</li>
          <li>
            The sidecar restarts with a cold denial cache. The first request for each user incurs a full
            limiter round-trip. After the first denial, the 30 ms window resumes normally.
          </li>
          <li>
            The limiter restarts with an empty override cache. The first request reads <code>config:generation</code>{" "}
            from Redis and reloads all applicable overrides. Override logic is immediately correct.
          </li>
          <li>
            Both processes receive a graceful shutdown signal (SIGTERM/SIGINT) and drain in-flight HTTP
            requests for up to <strong>5 seconds</strong> before forcing exit.
          </li>
        </ul>

        <RLSourceExcerpt
          source="cmd/limiter/main.go — graceful shutdown"
          establishes="SIGTERM/SIGINT triggers a 5-second context timeout for HTTP server drain. Value is 5s, not 15s."
        >{`ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()
if err := srv.Shutdown(ctx); err != nil {
    logging.Fatal("Server forced to shutdown", "error", err)
}`}</RLSourceExcerpt>

        <h3 style={{ color: "#ff5cad", fontSize: 14, marginTop: 20, marginBottom: 8 }}>Redis Restart</h3>
        <ul className="guide-bullets-list">
          <li>
            With AOF/RDB persistence, all quota counters, overrides, circuit states, idempotency records, and
            routes are recovered on restart. No application-layer replay is required.
          </li>
          <li>
            During the Redis restart window: limiter requests fail; <code>cb:redis</code> trips. With{" "}
            <code>CIRCUIT_FAIL_OPEN=false</code>, sidecars return 503 until Redis recovers and the circuit
            closes.
          </li>
          <li>
            Denial cache entries on sidecars expire independently (30 ms TTL). By the time Redis recovers
            (typically &gt;30 ms), denial cache entries are already stale.
          </li>
        </ul>

        <h3 style={{ color: "#ff5cad", fontSize: 14, marginTop: 20, marginBottom: 8 }}>Replica Addition (Limiter or Sidecar)</h3>
        <ul className="guide-bullets-list">
          <li>
            A new limiter replica starts with a cold override cache. On its first request it reads{" "}
            <code>config:generation</code> and loads overrides — immediately serving correct quota logic.
            Adding limiter replicas does not require any coordination with existing replicas.
          </li>
          <li>
            A new sidecar replica starts with a cold denial cache. It correctly interacts with the limiter
            immediately; it simply lacks the 30 ms short-circuit window for already-denied users until their
            first denial is observed.
          </li>
          <li>
            Both replica types are stateless for correctness purposes — they can be added or removed without
            any data migration or rebalancing.
          </li>
        </ul>

        {/* ── Stale Cache ──────────────────────────────────────────────── */}
        <h2 className="guide-sub-heading" id="stale-replica">Stale Cache and Override Invalidation</h2>
        <p>
          The limiter&rsquo;s override cache uses an optimistic generation-based invalidation strategy.
          On every <code>/check_hierarchical</code> call, the limiter reads <code>config:generation</code>{" "}
          from Redis. If the value differs from the locally cached generation, the entire override cache is
          invalidated and overrides are reloaded. This bounds staleness to at most{" "}
          <code>OVERRIDE_CACHE_TTL_MS</code> (default 5000 ms) regardless of how many overrides changed.
        </p>

        <RLSourceExcerpt
          source="cmd/limiter/config.go — OVERRIDE_CACHE_TTL_MS default"
          establishes="Override local cache TTL defaults to 5000ms. Configurable via OVERRIDE_CACHE_TTL_MS environment variable."
        >{`OverrideCacheTTLMs: mustParseIntEnv("OVERRIDE_CACHE_TTL_MS", "5000", strict),`}</RLSourceExcerpt>

        <RLSourceExcerpt
          source="cmd/limiter/main.go — hierarchical key construction"
          establishes="Verified four-key pattern for hierarchical EVALSHA calls."
        >{`globalKey := "rate:global"
tenantKey := fmt.Sprintf("rate:tenant:%s", tenantID)
userKey   := fmt.Sprintf("rate:user:%s", userID)
endpointKey := fmt.Sprintf("rate:endpoint:%s:%s", tenantID, endpoint)`}</RLSourceExcerpt>

        <RLSourceExcerpt
          source="internal/override/override.go — key patterns"
          establishes="config:generation is a well-known string key; config:{level}:{id} format is source-verified."
        >{`const generationKey = "config:generation"

func configKey(level, id string) string {
    return fmt.Sprintf("config:%s:%s", level, id)
}`}</RLSourceExcerpt>

        <RLRelatedPages pages={[
          { section: "rate-limiting-engine", slug: "configuration-overrides", title: "Configuration Overrides", note: "Generation-based override invalidation mechanics" },
          { section: "production-engineering", slug: "graceful-shutdown", title: "Graceful Shutdown", note: "5s drain window details" },
          { section: "correctness-and-verification", slug: "multi-replica-verification", title: "Multi-Replica Verification", note: "Test suite proving no over-admission under scale" },
          { section: "architecture", slug: "system-invariants", title: "System Invariants", note: "Formal correctness properties derived from this state model" },
        ]} />
      </div>
    )
  },

  /* ═══════════════════════════════════════════════════════════════════════
     PAGE 4 — why-this-architecture
     ═══════════════════════════════════════════════════════════════════════ */
  "why-this-architecture": {
    title: "Why This Architecture?",
    topics: [
      { label: "Why Sidecar Boundary?", href: "#sidecar-why" },
      { label: "Why Central Limiter?", href: "#limiter-why" },
      { label: "Why Redis + Lua?", href: "#redis-why" },
      { label: "Why Distributed Circuit Breakers?", href: "#cb-why" },
    ],
    content: (
      <div>
        <RLThesis>
          Every architectural boundary was chosen to satisfy a specific operational or performance constraint:
          language-agnostic edge enforcement via sidecar, connection concentration and stateless scaling via
          central limiter, atomic multi-tier quota via Redis Lua, and cascading failure prevention via
          distributed circuit breakers stored in <code>cb:{"{target}"}</code>.
        </RLThesis>

        <RLQuickModel>
          Sidecar = language-agnostic edge shield + denial offload. Limiter = stateless Redis connection
          concentrator. Redis + Lua = single-threaded atomicity for multi-key quota. Circuit breakers =
          shared state in <code>cb:redis</code>, <code>cb:central-limiter</code>,{" "}
          <code>cb:{"{gateway-id}"}</code> — all replicas observe the same health signal.
        </RLQuickModel>

        <h2 className="guide-sub-heading" id="sidecar-why">Why Sidecar Boundary?</h2>
        <p>
          Embedding rate-limiting logic inside application code couples business logic to network transport
          libraries and makes it impossible to enforce limits uniformly across polyglot services. A separate
          sidecar process (<code>cmd/sidecar</code>, <code>:9090</code>) provides language-agnostic
          enforcement, standardized trace context propagation, and independent deploy-time scaling. The sidecar
          can be updated or replaced without touching application code.
        </p>
        <RLSourceExcerpt
          source="cmd/sidecar/main.go — ServeHTTP entry"
          establishes="The sidecar is the sole client-facing entry point for all proxied traffic. Branching at ServeHTTP ensures all requests — regardless of HTTP method or path — are subject to identity resolution, idempotency, and rate-limiting."
        >{`func (s *Sidecar) ServeHTTP(w http.ResponseWriter, r *http.Request) {
    userID, err := identity.ResolveUserID(r, s.allowQueryUserID)
    idemKey := strings.TrimSpace(r.Header.Get("Idempotency-Key"))
    if s.idempotency != nil && idemKey != "" && idempotency.IsMutatingMethod(r.Method) {
        s.serveIdempotent(w, r, userID, idemKey)
        return
    }
    s.serveNormal(w, r, userID)
}`}</RLSourceExcerpt>

        <h2 className="guide-sub-heading" id="limiter-why">Why Central Limiter?</h2>
        <p>
          Having every sidecar instance maintain a direct Redis connection pool would lead to connection pool
          exhaustion at scale (1000+ sidecar replicas each holding pool connections). The central limiter
          (<code>:8080</code>) acts as a stateless connection concentrator — it translates HTTP quota queries
          into Redis Lua invocations, allowing the Redis connection count to be bounded by the number of limiter
          replicas rather than the number of sidecar replicas. The admin API (<code>:8082</code>) runs on a
          separate port to prevent admin CRUD traffic from competing with hot-path quota checks.
        </p>

        <h2 className="guide-sub-heading" id="redis-why">Why Redis + Lua?</h2>
        <p>
          Redis provides per-key single-threaded execution. Encoding the token bucket calculation inside a Lua
          script makes the check-and-write operation indivisible — no two clients can observe a token count
          between the read and the decrement. This eliminates the TOCTOU race condition that afflicts
          compare-and-swap approaches. Multi-key Lua (used by hierarchical quotas) extends this atomicity
          across four keys in one invocation.
        </p>
        <RLCallout variant="limitation" title="Redis Cluster incompatibility">
          <code>hierarchical.lua</code> touches four keys across separate namespaces (
          <code>rate:global</code>, <code>rate:tenant:*</code>, <code>rate:user:*</code>,{" "}
          <code>rate:endpoint:*:*</code>) in a single <code>EVALSHA</code>. Redis Cluster hashes these keys to
          different slots, triggering a <code>CROSSSLOT</code> error. Atomic multi-tier quota requires a
          single-master or Sentinel topology. Cluster support would require a shared hash tag on all keys (e.g.,{" "}
          <code>{"{rl}"}</code>), which concentrates all slot traffic to one shard — functionally equivalent to
          single-master. <RLEvidenceBadge type="DOCUMENTED LIMITATION" />
        </RLCallout>

        <h2 className="guide-sub-heading" id="cb-why">Why Distributed Circuit Breakers?</h2>
        <p>
          A limiter or Redis outage should not cascade into unbounded retries from sidecars. Circuit breaker
          state is stored in Redis (<code>cb:{"{target}"}</code>), making it visible to all sidecar and limiter
          replicas simultaneously. When the <code>cb:central-limiter</code> circuit opens on one sidecar, all
          sidecars observing that same Redis key see the same health signal on their next read. Three circuit
          targets are defined:
        </p>
        <ul className="guide-bullets-list">
          <li><code>cb:redis</code> — guards the limiter&rsquo;s Redis connection; trips on Redis timeouts.</li>
          <li><code>cb:central-limiter</code> — guards the sidecar&rsquo;s HTTP call to the limiter; trips on connection errors and timeouts (but not 429).</li>
          <li><code>cb:{"{gateway-id}"}</code> — per-upstream circuit in routing mode; allows alternate gateway selection.</li>
        </ul>

        <RLRelatedPages pages={[
          { section: "introduction", slug: "the-problem", title: "The Problem", note: "TOCTOU and over-admission problem statement" },
          { section: "rate-limiting-engine", slug: "redis-lua-atomicity", title: "Redis + Lua Atomicity", note: "Script loading, EVALSHA, single-thread model" },
          { section: "resilience", slug: "failure-model", title: "Failure Model", note: "Full failure mode taxonomy" },
        ]} />
      </div>
    )
  },

  /* ═══════════════════════════════════════════════════════════════════════
     PAGE 5 — system-invariants
     ═══════════════════════════════════════════════════════════════════════ */
  "system-invariants": {
    title: "System Invariants",
    topics: [
      { label: "Core Invariants", href: "#invariants" },
      { label: "Hierarchical All-or-Nothing Proof", href: "#hierarchical-proof" },
      { label: "Denial Cache Safety", href: "#denial-safety" },
      { label: "Verification Mechanisms", href: "#verification" },
    ],
    content: (
      <div>
        <RLThesis>
          System invariants are correctness properties that must hold under parallelism, network partitions,
          and node failures. The four core invariants are: quota upper-bound (no over-admission while Redis is
          reachable), hierarchical all-or-nothing token deduction (no partial tier deduction on denial),
          idempotency lease integrity (fence token prevents stale overwrites), and denial cache safety
          (conservative — can never produce an incorrect admission).
        </RLThesis>

        <RLQuickModel>
          Lua atomic = quota upper-bound. hierarchical.lua denied branch = zero token deduction across all
          tiers. Denial cache = Allowed=false only — can never short-circuit an admission. Fence token =
          stale writer cannot overwrite a newer lease holder&rsquo;s result.
        </RLQuickModel>

        <h2 className="guide-sub-heading" id="invariants">Core System Invariants</h2>
        <ul className="guide-bullets-list">
          <li>
            <strong>Invariant 1 — Quota Upper Bound:</strong> While Redis is reachable, admitted requests
            never exceed the configured capacity for any tier. Redis single-threaded Lua execution serializes
            all token deductions; no two concurrent callers can both observe sufficient tokens when only one
            token remains. <RLEvidenceBadge type="SOURCE-PROVEN" /> <RLEvidenceBadge type="TEST-PROVEN" />
          </li>
          <li>
            <strong>Invariant 2 — Hierarchical All-or-Nothing:</strong> In a hierarchical check, if any one
            tier denies the request, zero tokens are deducted from any tier. The <code>hierarchical.lua</code>{" "}
            script has a binary branch: the deduction loop only executes when <code>allowed == 1</code>. On
            denial, only refill timestamps are updated. <RLEvidenceBadge type="SOURCE-PROVEN" />
          </li>
          <li>
            <strong>Invariant 3 — Idempotency Lease Integrity:</strong> A sidecar that acquired a lease with
            fence token N cannot write a completion result after a newer fence holder with token N+1 has
            written. The <code>complete.lua</code> script verifies the fence value atomically before any write.{" "}
            <RLEvidenceBadge type="TEST-PROVEN" />
          </li>
          <li>
            <strong>Invariant 4 — Denial Cache Safety:</strong> The sidecar denial cache can only accelerate
            a denial that Redis has already issued. It never produces an admission. Allowed=true entries are
            stored but ignored — the limiter is always re-consulted on the next request.{" "}
            <RLEvidenceBadge type="SOURCE-PROVEN" />
          </li>
        </ul>

        <h2 className="guide-sub-heading" id="hierarchical-proof">Hierarchical All-or-Nothing Proof</h2>
        <p>
          <code>hierarchical.lua</code> executes in two phases: (1) refill and check all four tiers, tracking
          whether any tier has insufficient tokens; (2) only if <code>allowed == 1</code>, subtract{" "}
          <code>requested</code> (always 1) from all tiers. If phase 1 sets <code>allowed = 0</code>, phase 2
          is skipped entirely — no tier loses a token.
        </p>
        <RLSourceExcerpt
          source="internal/limiter/lua/hierarchical.lua — Step 1 check"
          establishes="Any tier with floor(new_tokens) less than requested sets allowed=0. The check continues through all tiers to update refill state, but the deduction phase is governed by this flag."
          language="lua"
        >{`if math.floor(new_tokens) < requested then
    allowed = 0
end`}</RLSourceExcerpt>

        <RLSourceExcerpt
          source="internal/limiter/lua/hierarchical.lua — Step 2 deduction gate"
          establishes="Token deduction (HMSET with updated_tokens) only executes inside the allowed==1 branch. The else branch writes only refill state — tokens field receives the recomputed new_tokens, not (new_tokens - requested)."
          language="lua"
        >{`if allowed == 1 then
    for i = 1, levels do
        local updated_tokens = level_new_tokens[i] - requested
        redis.call('HMSET', keys[i], 'tokens', updated_tokens, 'last_refill', now)
    end
    remaining = math.floor(min_remaining - requested)
else
    for i = 1, levels do
        redis.call('HMSET', keys[i], 'tokens', level_new_tokens[i], 'last_refill', now)
    end
    remaining = 0
end
return {allowed, remaining}`}</RLSourceExcerpt>

        <h2 className="guide-sub-heading" id="denial-safety">Denial Cache Safety</h2>
        <RLSourceExcerpt
          source="cmd/sidecar/main.go — denial-only cache hit (lines 377-393)"
          establishes="Source-verified: the early-return path inside the cache-hit block is guarded by !entry.Allowed. An Allowed=true cache hit is logged but falls through to the limiter."
        >{`if !entry.Allowed {
    s.writeDenial(w, entry.Limit, entry.Remaining, entry.RetryAfter)
    return
}
logging.Debug(ctx, "allowed cache entry ignored — will re-check limiter", ...)`}</RLSourceExcerpt>

        <RLCallout variant="warning" title="Intentional over-denial window">
          During the 30 ms denial cache TTL, a quota that has already refilled in Redis may still be reported
          as denied by the sidecar. This is a deliberate trade-off: abuse shielding and load reduction take
          priority over sub-30 ms staleness. The invariant holds: the sidecar can only over-deny (conservative),
          never under-deny (incorrect admission).
        </RLCallout>

        <h2 className="guide-sub-heading" id="verification">Verification Mechanisms</h2>
        <p>
          The invariants are verified by three complementary mechanisms: the Go race detector
          (<code>go test -race ./...</code>) validates that no concurrent accesses to shared state produce
          data races; the multi-replica integration test runs two limiter replicas against a shared Redis and
          confirms no over-admission; and Redis Sentinel chaos tests verify that failover does not corrupt
          quota counters or allow spurious admissions during the master transition window.{" "}
          <RLEvidenceBadge type="RUNTIME-PROVEN" />
        </p>

        <RLRelatedPages pages={[
          { section: "rate-limiting-engine", slug: "multi-replica-correctness", title: "Multi-Replica Correctness", note: "Test results for 2-replica concurrent load" },
          { section: "correctness-and-verification", slug: "multi-replica-verification", title: "Multi-Replica Verification" },
          { section: "rate-limiting-engine", slug: "hierarchical-quotas", title: "Hierarchical Quotas", note: "Lua script deep-dive" },
          { section: "resilience", slug: "denial-cache-and-singleflight", title: "Denial Cache & Singleflight", note: "TTL configuration and safety analysis" },
        ]} />
      </div>
    )
  },

  /* ═══════════════════════════════════════════════════════════════════════
     PAGE 6 — engineering-trade-offs
     ═══════════════════════════════════════════════════════════════════════ */
  "engineering-trade-offs": {
    title: "Engineering Trade-offs",
    topics: [
      { label: "Fail-Closed vs Fail-Open", href: "#fail-closed" },
      { label: "Lua Atomicity vs Redis Cluster", href: "#cluster-tradeoff" },
      { label: "Denial Cache Staleness", href: "#denial-stale" },
      { label: "Idempotency: At-Most-Once vs Exactly-Once", href: "#idem-tradeoff" },
    ],
    content: (
      <div>
        <RLThesis>
          Each design decision prioritizes one constraint over another: fail-closed defaults protect downstream
          services at the cost of availability during limiter outages; multi-key Lua atomicity sacrifices Redis
          Cluster compatibility for correctness; 30 ms denial caching reduces limiter load at the cost of
          sub-30 ms staleness; and idempotency provides at-most-once upstream execution, not exactly-once.
        </RLThesis>

        <RLQuickModel>
          Fail-closed (default) over fail-open. Single Redis master over Cluster (hierarchical Lua requires it).
          30 ms denial cache for load reduction — allowed entries never cached. At-most-once idempotency — not
          exactly-once (upstream must be idempotent itself for financial workloads).
        </RLQuickModel>

        <h2 className="guide-sub-heading" id="fail-closed">Fail-Closed vs Fail-Open</h2>
        <RLStatGrid stats={[
          { value: "false", label: "FAIL_OPEN default", evidence: "SOURCE-PROVEN" },
          { value: "false", label: "CIRCUIT_FAIL_OPEN default", evidence: "SOURCE-PROVEN" },
          { value: "false", label: "IDEMPOTENCY_FAIL_OPEN default", evidence: "SOURCE-PROVEN" },
        ]} />
        <ul className="guide-bullets-list">
          <li>
            <strong>Fail-Open (<code>FAIL_OPEN=true</code>):</strong> When the limiter is unreachable, traffic
            is forwarded without rate-limit enforcement. Preserves request availability; risks downstream
            overload if the limiter is down during a traffic spike.
          </li>
          <li>
            <strong>Fail-Closed (default, <code>FAIL_OPEN=false</code>):</strong> Limiter unreachable &rarr;
            503. Protects downstream systems; makes the limiter a hard availability dependency. The operational
            posture: it is safer to drop traffic than to flood an unprotected backend.
          </li>
        </ul>
        <RLSourceExcerpt
          source="cmd/sidecar/main.go — FAIL_OPEN default"
          establishes="FAIL_OPEN is false unless the environment variable is explicitly set to the string 'true'. The default path always fails closed."
        >{`failOpen := os.Getenv("FAIL_OPEN") == "true"
// ...
if err != nil {
    if s.failOpen {
        s.forwardRequest(w, r)
        return
    }
    http.Error(w, "Rate limiter unavailable", http.StatusServiceUnavailable)
}`}</RLSourceExcerpt>

        <h2 className="guide-sub-heading" id="cluster-tradeoff">Lua Atomicity vs Redis Cluster Compatibility</h2>
        <p>
          Multi-key Lua scripts require all keys to hash to the same Redis slot. The four hierarchical quota
          keys (<code>rate:global</code>, <code>rate:tenant:{"{t}"}</code>, <code>rate:user:{"{u}"}</code>,{" "}
          <code>rate:endpoint:{"{t}"}:{"{ep}"}</code>) have different prefixes and therefore hash to different
          slots in Redis Cluster, resulting in a <code>CROSSSLOT</code> error.
        </p>
        <RLCallout variant="limitation" title="Accepted throughput ceiling">
          The single-master topology was accepted as the cost of atomic hierarchical correctness. Benchmarks
          show approximately 870 sustainable RPS with p99 latency around 11 ms. Adding a shared hash tag
          (e.g., <code>{"{rl}"}</code>) to all keys would permit Cluster usage but route all traffic to a
          single shard — no throughput benefit over single-master.{" "}
          <RLEvidenceBadge type="DOCUMENTED LIMITATION" /> <RLEvidenceBadge type="BENCHMARK-PROVEN" />
        </RLCallout>

        <h2 className="guide-sub-heading" id="denial-stale">Denial Cache Staleness Trade-off</h2>
        <RLStatGrid stats={[
          { value: "30ms", label: "CACHE_TTL_MS default — denial window", evidence: "SOURCE-PROVEN" },
          { value: "5000ms", label: "OVERRIDE_CACHE_TTL_MS default", evidence: "SOURCE-PROVEN" },
          { value: "5s", label: "Graceful shutdown drain", evidence: "SOURCE-PROVEN" },
        ]} />
        <p>
          A 30 ms denial window reduces repeated calls to the limiter during burst rejections — if a user
          sends 1000 requests/s while denied, only one request per 30 ms hits the limiter, a 30&times;
          reduction. The cost is that a quota refill occurring inside a 30 ms window may be invisible to the
          sidecar for up to 30 ms. Allowed entries are explicitly never cached, preventing the inverse problem:
          a quota-freeze attack where a cached admission is replayed after the quota is exhausted.
        </p>
        <RLSourceExcerpt
          source="cmd/sidecar/main.go — CACHE_TTL_MS default"
          establishes="Hardcoded 30ms default; overridable via CACHE_TTL_MS environment variable."
        >{`ttl := 30 * time.Millisecond
if raw := os.Getenv("CACHE_TTL_MS"); raw != "" {
    if ms, err := strconv.Atoi(raw); err == nil && ms > 0 {
        ttl = time.Duration(ms) * time.Millisecond
    }
}`}</RLSourceExcerpt>

        <h2 className="guide-sub-heading" id="idem-tradeoff">Idempotency: At-Most-Once vs Exactly-Once</h2>
        <p>
          The idempotency layer (<code>idem:{"{scope}"}:{"{key}"}</code>) suppresses concurrent duplicate
          requests and caches the response for re-delivery. It provides at-most-once upstream execution under
          normal conditions. However, it does not provide exactly-once semantics: if the sidecar crashes after
          the upstream receives the request but before <code>complete.lua</code> writes the result, a retry
          can trigger a second upstream call.
        </p>
        <RLCallout variant="limitation" title="At-most-once, not exactly-once">
          For workloads such as financial transactions where upstream side effects must be truly idempotent,
          the upstream service itself must implement idempotent database operations. The sidecar layer
          provides duplicate request suppression and response replay, not exactly-once delivery
          guarantees. <RLEvidenceBadge type="DOCUMENTED LIMITATION" />
        </RLCallout>

        <RLRelatedPages pages={[
          { section: "introduction", slug: "guarantees-and-limitations", title: "Guarantees & Limitations", note: "Full limitation surface" },
          { section: "performance-lab", slug: "throughput-and-saturation", title: "Throughput & Saturation", note: "~870 RPS benchmark data" },
          { section: "production-engineering", slug: "configuration-reference", title: "Configuration Reference", note: "All env vars including FAIL_OPEN, CACHE_TTL_MS, OVERRIDE_CACHE_TTL_MS" },
        ]} />
      </div>
    )
  },
};

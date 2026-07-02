import DocsNavbar from "@/features/docs/components/DocsNavbar";
import DocsSidebar from "@/features/docs/components/DocsSidebar";
import DocsMermaid from "@/features/docs/components/DocsMermaid";

const pageTopics = [
  { label: "System-Level View", href: "#system-view" },
  { label: "Component Breakdown", href: "#components" },
  { label: "The Central Limiter", href: "#central-limiter" },
  { label: "The Sidecar Proxy", href: "#sidecar" },
  { label: "Redis as State Layer", href: "#redis-layer" },
  { label: "Admin API", href: "#admin-api" },
  { label: "Service Ports", href: "#ports" },
  { label: "Deployment Topologies", href: "#deployments" },
];

const systemMapDiagram = `
flowchart LR
    subgraph Client["Client Layer"]
        C1["Browser / API Client"]
        C2["Mobile App"]
        C3["Microservice Caller"]
    end

    subgraph Sidecar["Sidecar Layer (:9090)"]
        SP["Sidecar Proxy\\n(Reverse Proxy)"]
        IC["Idempotency\\nClaimant"]
        LCache["Denial Cache\\n(sync.Map)"]
        SF["singleflight\\n(dedupe concurrent misses)"]
        RT["Intelligent\\nRouter"]
    end

    subgraph Limiter["Central Limiter (:8080 / :8082)"]
        HC["/health"]
        CK["/check"]
        CHK["/check_hierarchical"]
        Admin["Admin API\\n(:8082)"]
        Ovr["Override Store\\n(local TTL cache)"]
        Aud["Audit Logger\\n(async worker pool)"]
        CB["Redis Circuit\\nBreaker"]
    end

    subgraph RedisLayer["Redis State Layer"]
        TB["Token Buckets\\n(HMSET/HMGET)"]
        SW["Sliding Windows\\n(ZADD/ZCARD)"]
        IdemStore["Idempotency\\nRecords (HASH)"]
        CBState["Circuit Breaker\\nState (HASH)"]
        AuditLog["Audit Log\\n(ZSET + HASH)"]
        GWMetrics["Gateway\\nMetrics (HASH)"]
        OvrStore["Override\\nConfigs (HASH)"]
    end

    subgraph Upstreams["Upstream Backends"]
        GWA["Gateway A\\n(low latency)"]
        GWB["Gateway B\\n(medium latency)"]
        GWC["Gateway C\\n(high error rate)"]
        Demo["Demo Backend"]
    end

    C1 & C2 & C3 -->|HTTP| SP
    SP --> IC
    IC -->|"Idempotency-Key?"| IdemStore
    SP --> LCache
    SP --> SF
    SF -->|"GET /check"| CK
    SF -->|"GET /check_hierarchical"| CHK
    CK & CHK -->|"Lua scripts"| TB
    CK & CHK -->|"Lua scripts"| SW
    CK & CHK --> Aud
    CK & CHK --> CB
    CB --> CBState
    Aud -->|"async"| AuditLog
    Admin --> Ovr
    Ovr -->|"read-through"| OvrStore
    RT -->|"score-based"| GWA & GWB & GWC
    RT -->|"record outcome"| GWMetrics
    SP -->|"direct upstream"| Demo

    style SP fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style CK fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style CHK fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style Admin fill:#1e1e2e,stroke:#c084fc,color:#fff
    style TB fill:#18181b,stroke:#ec4899,color:#fff
    style SW fill:#18181b,stroke:#ec4899,color:#fff
`;

const sentinelDiagram = `
flowchart TD
    subgraph SentinelCluster["Redis Sentinel Cluster"]
        S1["Sentinel 1\\n(:26379)"]
        S2["Sentinel 2\\n(:26380)"]
        S3["Sentinel 3\\n(:26381)"]
    end
    Master["Redis Master\\n(:6379)"]
    R1["Replica 1\\n(:6380)"]
    R2["Replica 2\\n(:6381)"]
    GoClient["go-redis\\nFailoverClient"]

    S1 & S2 & S3 -->|"MONITOR"| Master
    Master -->|"replication"| R1 & R2
    GoClient -->|"SENTINEL get-master-addr-by-name"| S1
    GoClient -->|"writes → master"| Master
    GoClient -.->|"reads (optional)"| R1

    style Master fill:#1e1e2e,stroke:#ec4899,color:#fff
    style GoClient fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style S1 fill:#18181b,stroke:#c084fc,color:#fff
    style S2 fill:#18181b,stroke:#c084fc,color:#fff
    style S3 fill:#18181b,stroke:#c084fc,color:#fff
`;

export default function RLArchitecturePage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="system-view">
              System Architecture
            </h1>

            <div className="guide-body-text" style={{ marginTop: 24 }}>

              <p>
                The Distributed Rate Limiter is a <strong style={{ color: "#ff5cad" }}>three-tier system</strong>: a sidecar proxy tier that intercepts traffic, a central limiter service tier that owns enforcement logic, and a Redis state tier that provides atomic, distributed counter storage. Each tier has a distinct responsibility with explicit interface boundaries.
              </p>

              {/* Full system map */}
              <h2 className="guide-sub-heading" id="system-view" style={{ fontSize: 22, color: "#ffffff", marginTop: 36, marginBottom: 12 }}>
                System-Level View
              </h2>
              <p>The diagram below shows all components and their data flows:</p>
              <DocsMermaid chart={systemMapDiagram} />

              {/* Component breakdown */}
              <h2 className="guide-sub-heading" id="components" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                Component Breakdown
              </h2>

              <div style={{ overflowX: "auto", marginBottom: 24 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #27272a" }}>
                      {["Component", "Binary / Package", "Port", "Responsibility"].map(h => (
                        <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "#ff5cad", fontWeight: 600, fontSize: 12 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["Central Limiter", "cmd/limiter", ":8080", "Authoritative quota enforcement. Owns /check and /check_hierarchical endpoints. Never cached."],
                      ["Admin API", "cmd/limiter (shared)", ":8082", "Runtime override CRUD. Separated to enable network-level isolation from hot path."],
                      ["Sidecar Proxy", "cmd/sidecar", ":9090", "Transparent HTTP proxy. Intercepts requests, enforces limits, optionally routes to multiple gateways."],
                      ["Demo Backend", "cmd/demo-backend", ":8081", "Toy upstream application. Returns JSON responses for end-to-end testing."],
                      ["Gateway Sim", "cmd/gateway-sim", ":8081", "Simulated payment gateway with configurable latency and error rate injection."],
                      ["Redis", "redis:7-alpine", ":6379", "All stateful data: token buckets, sliding windows, idempotency records, circuit state, audit log."],
                      ["Jaeger", "jaegertracing/all-in-one", ":16686 / :4318", "OTLP trace receiver and UI. All spans from limiter and sidecar flow here."],
                    ].map(([comp, pkg, port, resp], i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #18181b", background: i % 2 === 0 ? "#0b0b0b" : "#0f0f12" }}>
                        <td style={{ padding: "8px 12px", color: "#ffffff", fontWeight: 500 }}>{comp}</td>
                        <td style={{ padding: "8px 12px", color: "#ff5cad", fontFamily: "monospace", fontSize: 12 }}>{pkg}</td>
                        <td style={{ padding: "8px 12px", color: "#c084fc", fontFamily: "monospace", fontSize: 12 }}>{port}</td>
                        <td style={{ padding: "8px 12px", color: "#a1a1aa", lineHeight: 1.5 }}>{resp}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Central Limiter deep-dive */}
              <h2 className="guide-sub-heading" id="central-limiter" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                The Central Limiter (<code style={{ fontSize: 16, color: "#ff5cad" }}>cmd/limiter</code>)
              </h2>

              <p>
                The central limiter is the <strong>single source of truth</strong> for all quota decisions. It is a pure HTTP service with no persistent disk state of its own — all state lives in Redis. This makes it horizontally scalable: multiple limiter replicas can run in parallel, all reading and writing to the same Redis backend atomically.
              </p>

              <p style={{ marginTop: 12 }}>
                On startup, the limiter:
              </p>
              <ol style={{ paddingLeft: 20, lineHeight: 1.8, color: "#a1a1aa", fontSize: 14, marginTop: 8, marginBottom: 16 }}>
                <li>Initializes OpenTelemetry (fails fast if OTel is broken)</li>
                <li>Connects to Redis and runs a <code style={{ color: "#ff5cad" }}>PING</code> — refuses to start if Redis is unreachable</li>
                <li>Initializes the audit store, circuit breaker, and override store</li>
                <li>Selects the rate limiting algorithm (token bucket or sliding window) from env</li>
                <li>Optionally initializes the hierarchical limiter if <code style={{ color: "#ff5cad" }}>ENABLE_HIERARCHICAL=true</code></li>
                <li>Starts both HTTP servers (hot path :8080 + admin :8082)</li>
                <li>Registers <code style={{ color: "#ff5cad" }}>SIGINT</code> / <code style={{ color: "#ff5cad" }}>SIGTERM</code> handlers for graceful shutdown (5s drain)</li>
              </ol>

              <div style={{
                background: "rgba(219, 39, 119,0.06)",
                border: "1px solid rgba(219, 39, 119,0.2)",
                borderRadius: 8,
                padding: "14px 18px",
                fontSize: 13,
                marginBottom: 24,
                lineHeight: 1.6,
                color: "#fbcfe8"
              }}>
                <strong>Warning: Fail-Fast By Design:</strong> If Redis is unreachable at startup, the limiter calls <code>log.Fatalf</code> immediately. A limiter that starts without verified Redis connectivity would silently mis-report health and operate without state — both failure modes are worse than refusing to start.
              </div>

              {/* Key endpoints */}
              <div style={{ background: "#0f0f12", border: "1px solid #1e1e24", borderRadius: 8, padding: "18px 22px", marginBottom: 24 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#ff5cad", marginBottom: 14 }}>Limiter HTTP Endpoints</div>
                {[
                  { method: "GET", path: "/health", desc: "Pings Redis, reads replication INFO, returns role + connectivity. Used by Docker healthchecks and k8s probes." },
                  { method: "GET", path: "/metrics", desc: "Prometheus scrape endpoint. Optionally protected by METRICS_REQUIRE_AUTH." },
                  { method: "GET", path: "/check", desc: "Flat per-user token bucket or sliding window check. Protected by INTERNAL_API_KEY. Returns 200 (allowed) or 429 (denied)." },
                  { method: "GET", path: "/check_hierarchical", desc: "Four-level hierarchical check (global → tenant → user → endpoint) in one Lua round-trip. Accepts override params via query string." },
                  { method: "GET/POST/DELETE", path: "/admin/limits/{level}/{id}", desc: "Runtime quota override CRUD. Level is one of: global, tenant, user, endpoint. Protected by ADMIN_API_KEY." },
                  { method: "GET", path: "/admin/circuit", desc: "List all circuit breaker states." },
                  { method: "POST", path: "/admin/circuit/{target}/reset", desc: "Force-close a circuit breaker (ops recovery)." },
                  { method: "GET", path: "/admin/audit", desc: "Search audit trail events with filters (tenant, user, decision, time range)." },
                ].map((ep, i) => (
                  <div key={i} style={{
                    display: "flex", gap: 12, alignItems: "flex-start",
                    padding: "10px 0", borderBottom: i < 7 ? "1px solid #18181b" : "none"
                  }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 4,
                      background: ep.method.includes("/") ? "rgba(244, 114, 182,0.15)" : ep.method === "GET" ? "rgba(192, 132, 252,0.15)" : ep.method === "POST" ? "rgba(167, 139, 250,0.15)" : "rgba(248,113,113,0.15)",
                      color: ep.method.includes("/") ? "#c084fc" : ep.method === "GET" ? "#c084fc" : ep.method === "POST" ? "#c084fc" : "#f472b6",
                      minWidth: 60, textAlign: "center", fontFamily: "monospace"
                    }}>{ep.method}</span>
                    <div>
                      <code style={{ fontSize: 13, color: "#ff5cad" }}>{ep.path}</code>
                      <div style={{ fontSize: 12.5, color: "#71717a", marginTop: 3, lineHeight: 1.5 }}>{ep.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Sidecar */}
              <h2 className="guide-sub-heading" id="sidecar" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                The Sidecar Proxy (<code style={{ fontSize: 16, color: "#ff5cad" }}>cmd/sidecar</code>)
              </h2>
              <p>
                The sidecar is a <strong>transparent HTTP reverse proxy</strong> that intercepts all client requests before they reach the upstream application. It is the enforcement point closest to the client and is deployed as a companion container (sidecar pattern) alongside each application instance.
              </p>

              <p style={{ marginTop: 12 }}>The sidecar request handling pipeline (in order):</p>

              <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 0 }}>
                {[
                  { step: "1", title: "Path Allow-list Check", detail: "If ALLOWED_PATHS is set, reject any path not matching. Prevents path traversal abuse." },
                  { step: "2", title: "User ID Resolution", detail: "Extracts user identity from X-User-ID header (or X-API-Key if configured). Rejects if missing." },
                  { step: "3", title: "Idempotency Gate", detail: "If Idempotency-Key header is present and method is POST/PUT/PATCH, routes to the idempotency sub-pipeline." },
                  { step: "4", title: "Denial Cache Check", detail: "If a recent denial for this cache key (tenant|user|path) is cached, serve 429 immediately without hitting the limiter." },
                  { step: "5", title: "singleflight Dedup", detail: "100 concurrent requests for the same cache key collapse into a single /check call. The result is shared by all waiters." },
                  { step: "6", title: "Central Limiter Call", detail: "HTTP GET to /check or /check_hierarchical with user identity in headers. Protected by INTERNAL_API_KEY." },
                  { step: "7", title: "Circuit Breaker Check", detail: "Before the limiter call, check whether the central limiter circuit is Open. If open, return 503 immediately." },
                  { step: "8", title: "Cache Write", detail: "Store the result (allowed or denied) in sync.Map with TTL expiry. Denials are cached; allowances are NOT (to prevent quota freeze attacks)." },
                  { step: "9", title: "Upstream Forwarding", detail: "If allowed: forward to upstream via httputil.ReverseProxy (or intelligent router if ENABLE_ROUTING=true)." },
                ].map((item, i) => (
                  <div key={i} style={{
                    display: "flex", gap: 0, alignItems: "stretch",
                  }}>
                    <div style={{
                      display: "flex", flexDirection: "column", alignItems: "center", minWidth: 40
                    }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: "50%",
                        background: "rgba(255,92,173,0.15)", border: "1px solid rgba(255,92,173,0.4)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 11, fontWeight: 700, color: "#ff5cad", flexShrink: 0, zIndex: 1
                      }}>{item.step}</div>
                      {i < 8 && <div style={{ width: 1, flex: 1, background: "rgba(255,92,173,0.15)", margin: "0 auto" }} />}
                    </div>
                    <div style={{
                      padding: "4px 0 20px 16px", flex: 1
                    }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#ffffff" }}>{item.title}</div>
                      <div style={{ fontSize: 13, color: "#71717a", lineHeight: 1.55, marginTop: 2 }}>{item.detail}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Redis as state layer */}
              <h2 className="guide-sub-heading" id="redis-layer" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                Redis as the State Layer
              </h2>
              <p>
                Redis is not just a cache in this system — it is the <strong>primary persistent state store</strong>. Everything that needs to be shared across service instances lives in Redis:
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16, marginBottom: 24 }}>
                {[
                  { title: "Token Buckets", type: "HASH", key: "rate:{level}:{id}", fields: "tokens, last_refill", detail: "Atomic refill + decrement in one Lua script per request." },
                  { title: "Sliding Windows", type: "ZSET", key: "sw:{user}", fields: "score=timestamp, member=uuid", detail: "ZREMRANGEBYSCORE trims expired entries; ZCARD counts requests in window." },
                  { title: "Idempotency Records", type: "HASH + STRING", key: "idem:{scope}:{key}", fields: "status, fence_token, http_status, resp_body", detail: "claim.lua/complete.lua/fail.lua manage the lifecycle atomically." },
                  { title: "Circuit Breaker State", type: "HASH", key: "cb:{target}", fields: "state, failure_count, total_count, latency_ema_ms", detail: "allow.lua and record.lua manage state machine transitions atomically." },
                  { title: "Audit Log", type: "HASH + ZSET", key: "audit:event:{id}, audit:idx:ts", fields: "decision, tenant_id, user_id, timestamp_ms", detail: "append.lua writes event and updates all indexes in one atomic script." },
                  { title: "Override Configs", type: "HASH", key: "config:{level}:{id}", fields: "capacity, refill_rate", detail: "Set by Admin API. Cached locally in the limiter process for 5s (OVERRIDE_CACHE_TTL_MS)." },
                  { title: "Gateway Metrics", type: "HASH", key: "route:gw:{id}", fields: "health_score, latency_ema_ms, error_count, total_requests", detail: "record_outcome.lua updates EMA and health score atomically per response." },
                  { title: "Gateway Index", type: "SET", key: "route:index", fields: "gateway IDs", detail: "SMEMBERS returns all registered gateways for scoring and selection." },
                ].map(item => (
                  <div key={item.title} style={{
                    background: "#0f0f12",
                    border: "1px solid #1e1e24",
                    borderRadius: 8,
                    padding: "14px 16px"
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#ffffff" }}>{item.title}</span>
                      <span style={{ fontSize: 10, padding: "2px 6px", background: "rgba(219, 39, 119,0.15)", color: "#ec4899", borderRadius: 4, fontFamily: "monospace", fontWeight: 700 }}>{item.type}</span>
                    </div>
                    <code style={{ fontSize: 11, color: "#c084fc", display: "block", marginBottom: 4 }}>{item.key}</code>
                    <div style={{ fontSize: 11, color: "#71717a", fontFamily: "monospace", marginBottom: 6 }}>{item.fields}</div>
                    <div style={{ fontSize: 12, color: "#a1a1aa", lineHeight: 1.5 }}>{item.detail}</div>
                  </div>
                ))}
              </div>

              {/* Admin API */}
              <h2 className="guide-sub-heading" id="admin-api" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                Admin API (<code style={{ fontSize: 16, color: "#ff5cad" }}>:8082</code>)
              </h2>
              <p>
                The Admin API runs on a separate port to enable network-level isolation. In Kubernetes, this port can be restricted to internal cluster traffic while the hot path port (:8080) is exposed to sidecars. Enabled via <code style={{ color: "#ff5cad" }}>ENABLE_ADMIN_API=true</code>.
              </p>
              <p style={{ marginTop: 10, marginBottom: 16 }}>
                All Admin API routes require the <code style={{ color: "#ff5cad" }}>X-API-Key: {"{ADMIN_API_KEY}"}</code> header. The key is checked via plain string comparison — see the security notes in the production readiness section for the timing attack caveat.
              </p>

              {/* Service ports */}
              <h2 className="guide-sub-heading" id="ports" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                Service Ports Reference
              </h2>
              <div style={{ overflowX: "auto", marginBottom: 24 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #27272a" }}>
                      {["Service", "Port", "Protocol", "Purpose"].map(h => (
                        <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "#ff5cad", fontWeight: 600, fontSize: 12 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["Central Limiter", "8080", "HTTP", "Rate check hot path (/check, /check_hierarchical, /health, /metrics)"],
                      ["Admin API", "8082", "HTTP", "Override CRUD, circuit management, audit search"],
                      ["Sidecar", "9090", "HTTP", "Client-facing proxy, /health, /metrics"],
                      ["Demo Backend", "8081", "HTTP", "Toy upstream for end-to-end testing"],
                      ["Redis", "6379", "TCP/RESP", "Primary state store"],
                      ["Sentinel 1/2/3", "26379–26381", "TCP/RESP", "HA mode only (docker-compose.ha.yml)"],
                      ["Jaeger UI", "16686", "HTTP", "Trace viewer"],
                      ["Jaeger OTLP", "4318", "HTTP", "OTLP trace ingest endpoint"],
                    ].map(([svc, port, proto, purpose], i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #18181b", background: i % 2 === 0 ? "#0b0b0b" : "#0f0f12" }}>
                        <td style={{ padding: "8px 12px", color: "#ffffff", fontWeight: 500 }}>{svc}</td>
                        <td style={{ padding: "8px 12px", color: "#c084fc", fontFamily: "monospace" }}>{port}</td>
                        <td style={{ padding: "8px 12px", color: "#c084fc", fontFamily: "monospace", fontSize: 11 }}>{proto}</td>
                        <td style={{ padding: "8px 12px", color: "#a1a1aa" }}>{purpose}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Deployment topologies */}
              <h2 className="guide-sub-heading" id="deployments" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                Deployment Topologies
              </h2>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
                {[
                  {
                    title: "Standalone Mode",
                    file: "docker-compose.yml",
                    desc: "Single Redis node. Good for development, CI, and low-traffic production. Redis restart causes brief unavailability.",
                    bullets: ["1× Redis (no replicas)", "1× Limiter", "1× Sidecar", "1× Demo Backend", "3× Gateway Sims", "1× Jaeger"]
                  },
                  {
                    title: "Sentinel HA Mode",
                    file: "docker-compose.ha.yml",
                    desc: "Redis Sentinel with 1 master + 2 replicas + 3 sentinels. Automatic master failover. go-redis FailoverClient handles promotion transparently.",
                    bullets: ["1× Redis Master + 2× Replicas", "3× Sentinel nodes", "1× Limiter", "1× Sidecar", "Failover tested with chaos scripts"]
                  }
                ].map(topo => (
                  <div key={topo.title} style={{
                    background: "#0f0f12", border: "1px solid #27272a", borderRadius: 8, padding: "18px 20px"
                  }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#ffffff", marginBottom: 4 }}>{topo.title}</div>
                    <code style={{ fontSize: 11, color: "#ff5cad" }}>{topo.file}</code>
                    <p style={{ fontSize: 13, color: "#a1a1aa", lineHeight: 1.6, margin: "10px 0" }}>{topo.desc}</p>
                    <ul style={{ paddingLeft: 16, margin: 0 }}>
                      {topo.bullets.map(b => (
                        <li key={b} style={{ fontSize: 12.5, color: "#71717a", lineHeight: 1.7 }}>{b}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <h3 style={{ fontSize: 16, color: "#ffffff", marginBottom: 12 }}>Redis Sentinel Architecture (HA Mode)</h3>
              <DocsMermaid chart={sentinelDiagram} />

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

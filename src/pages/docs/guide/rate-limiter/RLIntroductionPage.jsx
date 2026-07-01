import DocsNavbar from "@/components/docs/DocsNavbar";
import DocsSidebar from "@/components/docs/DocsSidebar";
import DocsMermaid from "@/components/docs/DocsMermaid";

const pageTopics = [
  { label: "Architectural Scope & Objectives", href: "#what-is-this" },
  { label: "Distributed Coordination Challenges & Race Conditions", href: "#why-hard" },
  { label: "Distributed Request Lifecycle & Topology", href: "#architecture" },
  { label: "Engine Invariants & Resilience Guarantees", href: "#features" },
  { label: "System Infrastructure Stack", href: "#tech-stack" },
  { label: "Design Philosophy", href: "#design-philosophy" },
  { label: "Repository Layout", href: "#repo-layout" },
];

const architectureDiagram = `
flowchart TD
    Client(["Client"])
    Sidecar["Sidecar Proxy\\n(cmd/sidecar)"]
    CentralLimiter["Central Limiter\\n(cmd/limiter)"]
    Redis[("Redis\\n(Token Buckets / CB State)")]
    Upstream["Upstream Backend"]
    AdminAPI["Admin API\\n(:8082)"]
    Jaeger["Jaeger\\n(OTel Traces)"]
    Prometheus["Prometheus\\n(/metrics)"]

    Client -->|"HTTP Request"| Sidecar
    Sidecar -->|"GET /check_hierarchical"| CentralLimiter
    CentralLimiter -->|"Lua Scripts (atomic)"| Redis
    Redis -->|"allowed / remaining"| CentralLimiter
    CentralLimiter -->|"200 OK / 429"| Sidecar
    Sidecar -->|"Proxy forward (if allowed)"| Upstream
    Upstream -->|"Response"| Sidecar
    Sidecar -->|"Response + RateLimit headers"| Client

    AdminAPI -->|"Override CRUD"| Redis
    CentralLimiter -->|"Spans"| Jaeger
    Sidecar -->|"Spans"| Jaeger
    CentralLimiter -->|"Counters"| Prometheus
    Sidecar -->|"Counters"| Prometheus

    style Client fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style Sidecar fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style CentralLimiter fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style Redis fill:#1e1e2e,stroke:#ec4899,color:#fff
    style Upstream fill:#18181b,stroke:#52525b,color:#a1a1aa
    style AdminAPI fill:#18181b,stroke:#c084fc,color:#fff
    style Jaeger fill:#18181b,stroke:#c084fc,color:#fff
    style Prometheus fill:#18181b,stroke:#a78bfa,color:#fff
`;

export default function RLIntroductionPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="what-is-this">
              Distributed Rate Limiter — Introduction
            </h1>

            <div className="guide-body-text" style={{ marginTop: 24 }}>

              {/* Hero banner */}
              <div style={{
                background: "linear-gradient(135deg, rgba(255,92,173,0.08) 0%, rgba(219, 39, 119,0.04) 100%)",
                border: "1px solid rgba(255,92,173,0.25)",
                borderRadius: 10,
                padding: "24px 28px",
                marginBottom: 28
              }}>
                <p style={{ fontSize: 15, lineHeight: 1.75, color: "#e4e4e7", margin: 0 }}>
                  A <strong style={{ color: "#ff5cad" }}>production-grade distributed rate limiting platform</strong> written in Go. It enforces per-user, per-tenant, and per-endpoint quotas across a fleet of services using Redis-backed atomic Lua scripts, a central limiter service, and a sidecar proxy — all wired together with OpenTelemetry tracing, Prometheus metrics, Redis Sentinel HA, a circuit breaker, Stripe-style idempotency, and an immutable audit trail.
                </p>
              </div>

              {/* What is this project */}
              <h2 className="guide-sub-heading" id="what-is-this" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                Architectural Scope &amp; Objectives
              </h2>
              <p>
                The Distributed Rate Limiter is a multi-component Go platform designed to answer one question at high throughput: <em style={{ color: "#ff5cad" }}>should this request be allowed right now?</em>
              </p>
              <p style={{ marginTop: 12 }}>
                Unlike simple in-process rate limiters (like a token bucket inside a single Go server), this system coordinates quota enforcement across <strong>many service instances</strong> simultaneously. A sidecar proxy intercepts every incoming request, consults a central limiter service, which runs atomic Lua scripts against Redis — all before the request reaches the upstream application.
              </p>

              <ul className="guide-bullets-list" style={{ marginTop: 12 }}>
                <li><strong style={{ color: "#ff5cad" }}>Central Limiter Service</strong> — the authoritative quota engine, running HTTP endpoints that sidecars call to check or consume tokens.</li>
                <li><strong style={{ color: "#ff5cad" }}>Sidecar Proxy</strong> — a transparent HTTP proxy that sits in front of your application, intercepting all traffic and enforcing limits before forwarding.</li>
                <li><strong style={{ color: "#ff5cad" }}>Redis Backend</strong> — the distributed state store; all rate limit counters, circuit breaker state, idempotency records, and audit events live here.</li>
                <li><strong style={{ color: "#ff5cad" }}>Admin API</strong> — a separate port that allows runtime overrides of any quota limit without restarts.</li>
              </ul>

              {/* Why hard */}
              <h2 className="guide-sub-heading" id="why-hard" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                Distributed Coordination Challenges &amp; Race Conditions
              </h2>
              <p>
                In a single-process system, a rate limiter is trivial: a mutex-protected counter. At scale, everything becomes harder:
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16, marginBottom: 24 }}>
                {[
                  { title: "Race Conditions", body: "Two concurrent requests must not both be granted the last token. Without true atomicity, you over-issue quota.", icon: "" },
                  { title: "Network Partitions", body: "If the central limiter is unreachable, do you fail open (allow everything) or fail closed (block everything)?", icon: "" },
                  { title: "Clock Skew", body: "Token bucket refill rates use timestamps. If multiple nodes have different clocks, quota calculations diverge.", icon: "" },
                  { title: "Hot Keys", body: "A single global bucket key accessed by 10K RPS creates a Redis hotspot. The system must collapse those reads.", icon: "" },
                  { title: "Hierarchy", body: "Global → Tenant → User → Endpoint buckets must ALL pass atomically. A partial check is a security hole.", icon: "" },
                  { title: "Idempotency", body: "A client retrying a failed POST must not double-charge or double-execute the upstream action.", icon: "" },
                ].map(card => (
                  <div key={card.title} style={{
                    background: "#111113",
                    border: "1px solid #27272a",
                    borderRadius: 8,
                    padding: "16px 18px"
                  }}>
                    <div style={{ fontSize: 22, marginBottom: 8 }}>{card.icon}</div>
                    <div style={{ fontSize: 13, fontWeight: "bold", color: "#ffffff", marginBottom: 6 }}>{card.title}</div>
                    <div style={{ fontSize: 13, color: "#a1a1aa", lineHeight: 1.6 }}>{card.body}</div>
                  </div>
                ))}
              </div>

              {/* High-level architecture */}
              <h2 className="guide-sub-heading" id="architecture" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                Distributed Request Lifecycle &amp; Topology
              </h2>
              <p>
                Every production request flows through this pipeline. The sidecar is the entry point; the central limiter is the brain; Redis is the atomic state store.
              </p>

              <DocsMermaid chart={architectureDiagram} />

              <p style={{ fontSize: 13, color: "#71717a", marginTop: -8, marginBottom: 24 }}>
                The sidecar calls the limiter over HTTP. The limiter runs Lua scripts directly against Redis. All services emit traces to Jaeger and metrics to Prometheus.
              </p>

              {/* Key Features */}
              <h2 className="guide-sub-heading" id="features" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 16 }}>
                Engine Invariants &amp; Resilience Guarantees
              </h2>

              {[
                {
                  title: "Atomic Lua Rate Limiting",
                  desc: "Every quota check and decrement is a single Lua script executed on Redis. No TOCTOU race possible — Lua is single-threaded per key on Redis.",
                  badge: "core",
                },
                {
                  title: "Hierarchical Multi-Tenant Quotas",
                  desc: "4-level hierarchy: Global → Tenant → User → Endpoint. All four token buckets are checked and decremented in a single Lua script execution.",
                  badge: "core",
                },
                {
                  title: "Stripe-Style Idempotency",
                  desc: "Clients attach an Idempotency-Key header. The sidecar claims a fence token, forwards the request, captures the response, and stores it. Retries replay the cached response without re-executing.",
                  badge: "reliability",
                },
                {
                  title: "Distributed Circuit Breaker",
                  desc: "Redis-backed state machine with Closed → Open → Half-Open transitions. Tracks failure rate, timeout rate, consecutive failures, and latency EMA — all computed atomically in Lua.",
                  badge: "reliability",
                },
                {
                  title: "Intelligent Traffic Routing",
                  desc: "Juspay-style gateway scoring. Routes requests to the best upstream gateway based on weighted health score, latency EMA, and error rate. Automatic failover when primary gateway fails.",
                  badge: "routing",
                },
                {
                  title: "Redis Sentinel HA",
                  desc: "Connects via go-redis FailoverClient. Master election, replica promotion, and automatic reconnection handled transparently. Configurable via REDIS_MODE=sentinel.",
                  badge: "ha",
                },
                {
                  title: "Immutable Audit Trail",
                  desc: "Every rate limit decision is appended to a Redis-backed immutable log via Lua. Searchable by tenant, user, request ID, or timestamp. Async worker pool for zero-latency hot path.",
                  badge: "observability",
                },
                {
                  title: "OpenTelemetry Tracing",
                  desc: "Every component (sidecar, limiter, Redis ops, idempotency, circuit breaker) emits OTLP spans to Jaeger. Distributed trace IDs propagate across the sidecar→limiter→Redis call chain.",
                  badge: "observability",
                },
              ].map((feature, i) => {
                const badgeColors = {
                  core: "#ff5cad",
                  reliability: "#ec4899",
                  routing: "#f472b6",
                  ha: "#c084fc",
                  observability: "#a78bfa",
                };
                return (
                  <div key={i} style={{
                    background: "#0f0f12",
                    border: "1px solid #1e1e24",
                    borderLeft: `3px solid ${badgeColors[feature.badge]}`,
                    borderRadius: 8,
                    padding: "16px 20px",
                    marginBottom: 12,
                    display: "flex",
                    gap: 16,
                    alignItems: "flex-start"
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                        <span style={{ fontSize: 14, fontWeight: "bold", color: "#ffffff" }}>{feature.title}</span>
                        <span style={{
                          fontSize: 10,
                          padding: "2px 7px",
                          borderRadius: 999,
                          background: `${badgeColors[feature.badge]}22`,
                          color: badgeColors[feature.badge],
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em"
                        }}>{feature.badge}</span>
                      </div>
                      <p style={{ fontSize: 13, color: "#a1a1aa", lineHeight: 1.65, margin: 0 }}>{feature.desc}</p>
                    </div>
                  </div>
                );
              })}

              {/* Tech Stack */}
              <h2 className="guide-sub-heading" id="tech-stack" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 16 }}>
                System Infrastructure Stack
              </h2>

              <div style={{ overflowX: "auto", marginBottom: 24 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #27272a" }}>
                      {["Layer", "Technology", "Version / Notes"].map(h => (
                        <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "#ff5cad", fontWeight: 600, fontSize: 12 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["Language", "Go", "1.25+"],
                      ["State Store", "Redis", "v7 Alpine (Lua 5.1 scripting)"],
                      ["HA / Failover", "Redis Sentinel", "3-node sentinel cluster in docker-compose.ha.yml"],
                      ["Redis Client", "go-redis/v9", "UniversalClient (standalone + sentinel)"],
                      ["Tracing", "OpenTelemetry (OTel)", "OTLP HTTP → Jaeger all-in-one 1.58"],
                      ["Metrics", "Prometheus", "client_golang v1.23"],
                      ["Load Testing", "k6", "JavaScript test scripts in /benchmarks"],
                      ["Unique IDs", "google/uuid", "v1.6 — fence tokens, audit event IDs"],
                      ["Concurrency", "golang.org/x/sync", "singleflight.Group for cache-miss collapsing"],
                      ["Testing (Redis mock)", "miniredis/v2", "v2.38 — in-process Redis for unit tests"],
                    ].map(([layer, tech, notes], i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #18181b", background: i % 2 === 0 ? "#0b0b0b" : "#0f0f12" }}>
                        <td style={{ padding: "8px 12px", color: "#a1a1aa" }}>{layer}</td>
                        <td style={{ padding: "8px 12px", color: "#ffffff", fontWeight: 500 }}>{tech}</td>
                        <td style={{ padding: "8px 12px", color: "#71717a", fontFamily: "monospace" }}>{notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Design Philosophy */}
              <h2 className="guide-sub-heading" id="design-philosophy" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                Design Philosophy
              </h2>
              <p>The system was designed around four principles:</p>

              <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  { num: "01", title: "Atomicity over performance", body: "Every quota mutation is a Lua script. Lua on Redis is single-threaded, meaning no two concurrent scripts for the same key ever interleave. Correctness comes first." },
                  { num: "02", title: "Fail fast, fail loudly", body: "If Redis is unreachable at startup, the limiter refuses to start. If the circuit is open, the sidecar returns 503 immediately rather than queueing. Fail-open is a configurable opt-in, never a default." },
                  { num: "03", title: "Zero-hot-path overhead from optional features", body: "Audit logging is async via a bounded worker pool. Idempotency is only activated on requests with an Idempotency-Key header. Tracing is only emitted when OTel is enabled." },
                  { num: "04", title: "Runtime overridability", body: "Every quota limit can be overridden at runtime through the Admin API, stored in Redis, and cached locally for 5 seconds. No restarts, no redeploys needed to change a tenant's quota." },
                ].map(item => (
                  <div key={item.num} style={{
                    display: "flex", gap: 18, alignItems: "flex-start",
                    background: "#0f0f12", border: "1px solid #1e1e24", borderRadius: 8, padding: "16px 20px"
                  }}>
                    <div style={{
                      fontSize: 24, fontWeight: 800, color: "rgba(255,92,173,0.25)",
                      fontFamily: "monospace", lineHeight: 1, minWidth: 32
                    }}>{item.num}</div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: "bold", color: "#ffffff", marginBottom: 6 }}>{item.title}</div>
                      <div style={{ fontSize: 13, color: "#a1a1aa", lineHeight: 1.65 }}>{item.body}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Repo Layout */}
              <h2 className="guide-sub-heading" id="repo-layout" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                Repository Layout
              </h2>
              <p>The project follows standard Go project layout conventions:</p>

              <div className="guide-code-block-container" style={{ marginTop: 12, marginBottom: 24 }}>
                <pre className="guide-code-pre" style={{ background: "#0e0e11", border: "1px solid #27272a", borderRadius: 8, padding: 20, overflowX: "auto" }}>
                  <code style={{ fontFamily: "monospace", fontSize: 13, lineHeight: 1.7, color: "#e4e4e7" }}>
{`Distributed-Rate-Limiter/
├── cmd/
│   ├── limiter/         ← central limiter service (main entrypoint)
│   │   ├── main.go      ← HTTP server, /check, /check_hierarchical
│   │   ├── admin_api.go ← Admin CRUD routes (:8082)
│   │   ├── config.go    ← env-driven configuration
│   │   └── circuit.go   ← circuit breaker middleware helpers
│   ├── sidecar/         ← transparent HTTP reverse proxy
│   │   └── main.go      ← singleflight cache, idempotency, routing
│   ├── demo-backend/    ← toy upstream for local testing
│   └── gateway-sim/     ← simulated payment gateway (latency + error rate)
│
├── internal/
│   ├── limiter/         ← token bucket + sliding window algorithms
│   │   ├── lua/         ← embedded Lua scripts (token_bucket, sliding_window, hierarchical)
│   │   ├── hierarchical.go
│   │   ├── redis_atomic_token_bucket.go
│   │   └── redis_sliding_window.go
│   ├── circuitbreaker/  ← distributed CB state machine
│   │   ├── lua/         ← allow.lua, record.lua
│   │   ├── breaker.go
│   │   ├── store.go     ← RedisStore (Lua script runner)
│   │   └── config.go
│   ├── idempotency/     ← Stripe-style idempotency layer
│   │   ├── lua/         ← claim.lua, complete.lua, fail.lua
│   │   ├── store.go
│   │   ├── fingerprint.go
│   │   └── headers.go
│   ├── routing/         ← intelligent gateway scoring + failover
│   │   ├── lua/         ← record_outcome.lua
│   │   ├── router.go
│   │   ├── scorer.go    ← ComputeScore (weight × latency × health × error)
│   │   └── store.go
│   ├── audit/           ← immutable decision log
│   │   ├── lua/         ← append.lua
│   │   └── store.go
│   ├── override/        ← runtime limit override cache
│   │   └── override.go
│   ├── redis/           ← client factory (standalone + sentinel)
│   ├── auth/            ← API key middleware
│   ├── identity/        ← user ID header extraction
│   ├── metrics/         ← Prometheus counter / histogram helpers
│   └── telemetry/       ← OTel init, span helpers, HTTP transport
│
├── benchmarks/          ← k6 test scripts + result summaries
├── chaos/               ← chaos engineering test scenarios
├── deploy/              ← prometheus.yml, k8s-ready configs
├── dockerfiles/         ← per-service Dockerfiles
├── docker-compose.yml   ← full stack (standalone Redis)
└── docker-compose.ha.yml← full stack (Redis Sentinel HA)`}
                  </code>
                </pre>
              </div>

              {/* Quick links to other pages */}
              <div style={{
                background: "#0f0f12",
                border: "1px solid #27272a",
                borderRadius: 8,
                padding: "20px 24px",
                marginTop: 8
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#ff5cad", marginBottom: 12 }}>Continue Reading →</div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {[
                    { label: "System Architecture", href: "/project-docs/guide/rate-limiter/architecture" },
                    { label: "Request Lifecycle", href: "/project-docs/guide/rate-limiter/request-lifecycle" },
                    { label: "Lua Atomicity", href: "/project-docs/guide/rate-limiter/lua-scripts" },
                    { label: "Circuit Breaker", href: "/project-docs/guide/rate-limiter/circuit-breaker" },
                    { label: "Configuration Reference", href: "/project-docs/guide/rate-limiter/configuration" },
                  ].map(link => (
                    <a key={link.href} href={link.href} style={{
                      fontSize: 13, color: "#ff5cad", textDecoration: "none", fontWeight: 500,
                      padding: "5px 12px", borderRadius: 6,
                      background: "rgba(255,92,173,0.08)",
                      border: "1px solid rgba(255,92,173,0.2)"
                    }}>{link.label} →</a>
                  ))}
                </div>
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

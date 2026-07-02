import DocsNavbar from "@/components/docs/DocsNavbar";
import DocsSidebar from "@/components/docs/DocsSidebar";
import DocsMermaid from "@/components/docs/DocsMermaid";
import GoCodeBlock from "@/components/docs/GoCodeBlock";

const pageTopics = [
  { label: "Three Pillars", href: "#pillars" },
  { label: "OpenTelemetry Setup", href: "#otel" },
  { label: "Trace Propagation", href: "#trace-propagation" },
  { label: "Span Attributes", href: "#span-attributes" },
  { label: "Prometheus Metrics", href: "#prometheus" },
  { label: "Audit Log Architecture", href: "#audit" },
  { label: "append.lua Script", href: "#append-lua" },
  { label: "Jaeger Integration", href: "#jaeger" },
];

const tracePropagationDiagram = `
sequenceDiagram
    participant C as Client
    participant S as Sidecar Proxy
    participant L as Central Limiter
    participant R as Redis
    participant J as Jaeger

    C->>S: HTTP Request\\n(no trace context yet)
    Note over S: Sidecar starts root span\\nspan: sidecar.handle_request\\nattr: http.method, http.path, user.id

    S->>L: GET /check?user=alice\\nW3C traceparent header injected
    Note over L: Limiter creates child span\\nspan: limiter.check_rate_limit\\nattr: rate.limit.key, rate.limit.algorithm

    L->>R: EVALSHA lua_sha keys args
    Note over L: Child span for Redis\\nspan: redis.evalsha\\nattr: db.system=redis, db.statement

    R-->>L: {1, 47} (allowed, remaining=47)
    L-->>S: 200 OK\\n(X-RateLimit-Remaining: 47)
    S-->>C: Forward upstream response\\nX-RateLimit-Remaining: 47

    Note over S,J: Spans flushed to Jaeger via OTLP/HTTP
    S->>J: Trace batch (OTLP HTTP :4318)
    L->>J: Trace batch (OTLP HTTP :4318)
`;

const auditFlowDiagram = `
flowchart LR
    subgraph LimiterProcess["Central Limiter Process"]
        HC["/check handler\\nreturns decision"]
        AB["Audit Buffer\\n(buffered chan, cap=1024)"]
        W1["Worker 1\\n(goroutine)"]
        W2["Worker 2\\n(goroutine)"]
        W3["Worker 3\\n(goroutine)"]
    end

    subgraph RedisAuditStore["Redis Audit Store"]
        Events["audit:events\\n(RPUSH / capped list)"]
        TSIdx["audit:idx:ts\\n(ZADD score=ts)"]
        TenIdx["audit:idx:tenant:{id}\\n(ZADD score=ts)"]
        UserIdx["audit:idx:user:{id}\\n(ZADD score=ts)"]
    end

    Admin["Admin API\\nGET /admin/audit\\n?tenant=acme&from=..."]

    HC -->|"non-blocking send"| AB
    AB --> W1 & W2 & W3
    W1 & W2 & W3 -->|"append.lua\\n(atomic)"| Events
    W1 & W2 & W3 -->|"append.lua\\n(indexes)"| TSIdx
    W1 & W2 & W3 --> TenIdx & UserIdx
    Admin -->|"ZRANGEBYSCORE"| TSIdx
    Admin -->|"HMGET event fields"| Events

    style HC fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style AB fill:#1e1e2e,stroke:#c084fc,color:#fff
    style W1 fill:#18181b,stroke:#c084fc,color:#fff
    style W2 fill:#18181b,stroke:#c084fc,color:#fff
    style W3 fill:#18181b,stroke:#c084fc,color:#fff
    style Admin fill:#1e1e2e,stroke:#c084fc,color:#fff
`;

export default function RLObservabilityPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="pillars">
              Observability
            </h1>

            <div className="guide-body-text" style={{ marginTop: 24 }}>

              {/* Three Pillars */}
              <h2 className="guide-sub-heading" id="pillars" style={{ fontSize: 22, color: "#ffffff", marginTop: 0, marginBottom: 12 }}>
                Three Pillars of Observability
              </h2>
              <p>
                The distributed rate limiter is fully instrumented across three observability dimensions. Each addresses a different question during incident response:
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginTop: 16, marginBottom: 28 }}>
                {[
                  { icon: "", title: "Distributed Traces", subtitle: "(OpenTelemetry + Jaeger)", body: "Answers: What happened to this specific request? How long did each phase take? Which component is the bottleneck? Spans propagated via W3C traceparent headers across sidecar → limiter → Redis.", color: "#a78bfa" },
                  { icon: "", title: "Metrics", subtitle: "(Prometheus + Grafana)", body: "Answers: What is the system doing right now in aggregate? How many requests per second? What fraction are being rate-limited? Counters and histograms scraped by Prometheus.", color: "#c084fc" },
                  { icon: "", title: "Audit Log", subtitle: "(Redis-backed + Admin API)", body: "Answers: What decisions were made for tenant X between time T₁ and T₂? Who was rate-limited and why? Append-only event log with queryable indexes for compliance and debugging.", color: "#c084fc" },
                ].map(item => (
                  <div key={item.title} style={{ background: "#111113", border: `1px solid ${item.color}33`, borderRadius: 8, padding: "16px 18px" }}>
                    <div style={{ fontSize: 22, marginBottom: 6 }}>{item.icon}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: item.color, marginBottom: 2 }}>{item.title}</div>
                    <div style={{ fontSize: 11, color: "#71717a", marginBottom: 8 }}>{item.subtitle}</div>
                    <div style={{ fontSize: 12.5, color: "#a1a1aa", lineHeight: 1.6 }}>{item.body}</div>
                  </div>
                ))}
              </div>

              {/* OpenTelemetry Setup */}
              <h2 className="guide-sub-heading" id="otel" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                OpenTelemetry Setup — <code style={{ color: "#ff5cad", fontSize: 16 }}>InitTracer()</code>
              </h2>
              <p>
                Both the limiter and sidecar call <code>InitTracer()</code> at startup. It configures an OTLP/HTTP exporter pointing at Jaeger and sets up the global OpenTelemetry provider. Startup fails fast if the OTLP endpoint is misconfigured:
              </p>
              <div style={{ background: "#0f0f12", border: "1px solid #27272a", borderRadius: 8, padding: "16px 20px", marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#71717a", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  internal/telemetry/tracer.go
                </div>
                <GoCodeBlock>{`package telemetry

import (
    "context"
    "fmt"
    "os"
    "time"

    "go.opentelemetry.io/otel"
    "go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
    "go.opentelemetry.io/otel/propagation"
    "go.opentelemetry.io/otel/sdk/resource"
    sdktrace "go.opentelemetry.io/otel/sdk/trace"
    semconv "go.opentelemetry.io/otel/semconv/v1.21.0"
)

// InitTracer sets up the global OpenTelemetry tracer provider with OTLP/HTTP export.
// Panics if OTEL_EXPORTER_OTLP_ENDPOINT is set but unreachable.
func InitTracer(serviceName string) (func(context.Context) error, error) {
    endpoint := os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
    if endpoint == "" {
        endpoint = "http://localhost:4318" // default Jaeger OTLP/HTTP
    }

    // Create OTLP HTTP exporter
    exporter, err := otlptracehttp.New(context.Background(),
        otlptracehttp.WithEndpointURL(endpoint+"/v1/traces"),
        otlptracehttp.WithTimeout(5*time.Second),
    )
    if err != nil {
        return nil, fmt.Errorf("failed to create OTLP exporter: %w", err)
    }

    // Resource: describes the service producing the telemetry
    res, _ := resource.Merge(
        resource.Default(),
        resource.NewWithAttributes(
            semconv.SchemaURL,
            semconv.ServiceName(serviceName),
            semconv.ServiceVersion(os.Getenv("SERVICE_VERSION")),
        ),
    )

    // Tracer provider with batch export (non-blocking hot path)
    tp := sdktrace.NewTracerProvider(
        sdktrace.WithBatcher(exporter,
            sdktrace.WithMaxExportBatchSize(512),
            sdktrace.WithBatchTimeout(5*time.Second),
        ),
        sdktrace.WithResource(res),
        sdktrace.WithSampler(sdktrace.AlwaysSample()), // 100% sampling
    )

    // Register as global provider
    otel.SetTracerProvider(tp)
    // W3C TraceContext + Baggage propagation
    otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
        propagation.TraceContext{},
        propagation.Baggage{},
    ))

    // Return shutdown function for graceful flush at exit
    return tp.Shutdown, nil
}`}</GoCodeBlock>
              </div>

              {/* Trace Propagation */}
              <h2 className="guide-sub-heading" id="trace-propagation" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                Trace Propagation Across Services
              </h2>
              <p>
                The W3C <code>traceparent</code> header is injected by the sidecar into every outgoing call to the Central Limiter. This creates a single unified trace spanning both services for every request:
              </p>
              <DocsMermaid chart={tracePropagationDiagram} />

              {/* Span Attributes */}
              <h2 className="guide-sub-heading" id="span-attributes" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                Key Span Attributes
              </h2>
              <div style={{ overflowX: "auto", marginBottom: 28 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #27272a" }}>
                      {["Span Name", "Service", "Key Attributes", "Purpose"].map(h => (
                        <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "#ff5cad", fontWeight: 600, fontSize: 12 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["sidecar.handle_request", "Sidecar", "http.method, http.path, user.id, tenant.id", "Root span for every client request entering the sidecar."],
                      ["sidecar.check_idempotency", "Sidecar", "idempotency.key, idempotency.status", "Child span for the claim.lua Redis round-trip."],
                      ["sidecar.forward_upstream", "Sidecar", "upstream.url, upstream.latency_ms, http.status_code", "Upstream forwarding span; records gateway selection."],
                      ["limiter.check_rate_limit", "Limiter", "rate.limit.key, rate.limit.algorithm, rate.limit.remaining", "Limiter's quota check span; captures the decision."],
                      ["limiter.redis_evalsha", "Limiter", "db.system=redis, db.statement=EVALSHA, db.operation", "Redis Lua execution span; measures script latency."],
                      ["limiter.override_lookup", "Limiter", "override.level, override.id, override.hit=true|false", "Override store cache hit/miss span."],
                    ].map(([span, svc, attrs, purpose], i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #18181b", background: i % 2 === 0 ? "#0b0b0b" : "#0f0f12" }}>
                        <td style={{ padding: "8px 12px", color: "#a78bfa", fontFamily: "monospace", fontSize: 11 }}>{span}</td>
                        <td style={{ padding: "8px 12px", color: "#c084fc", fontWeight: 600 }}>{svc}</td>
                        <td style={{ padding: "8px 12px", color: "#c084fc", fontFamily: "monospace", fontSize: 10 }}>{attrs}</td>
                        <td style={{ padding: "8px 12px", color: "#71717a" }}>{purpose}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Prometheus Metrics */}
              <h2 className="guide-sub-heading" id="prometheus" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                Prometheus Metrics Reference
              </h2>
              <p>
                Both the sidecar (<code>:9090/metrics</code>) and limiter (<code>:8080/metrics</code>) expose Prometheus metrics. The <code>METRICS_REQUIRE_AUTH</code> env var gates the endpoint behind the <code>X-API-Key</code> header:
              </p>
              <div style={{ overflowX: "auto", marginBottom: 28 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #27272a" }}>
                      {["Metric Name", "Type", "Labels", "Description"].map(h => (
                        <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "#ff5cad", fontWeight: 600, fontSize: 12 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["rate_limiter_requests_total", "Counter", "service, decision={allowed,denied}, algorithm", "Total requests processed. decision=denied → rate limited."],
                      ["rate_limiter_request_duration_seconds", "Histogram", "service, handler, status_code", "Request duration from receipt to response. Buckets: 5ms–2s."],
                      ["rate_limiter_redis_operations_total", "Counter", "operation={evalsha,hget,hset,...}, status={ok,error}", "Redis command count. status=error triggers circuit breaker."],
                      ["rate_limiter_redis_duration_seconds", "Histogram", "operation", "Redis round-trip latency. High p99 indicates Redis overload."],
                      ["rate_limiter_circuit_breaker_state", "Gauge", "target, state={closed,open,half_open}", "Current circuit state per target. Alerts when state=open."],
                      ["rate_limiter_idempotency_operations_total", "Counter", "status={executed,replayed,in_flight,mismatch}", "Idempotency claim outcomes. replayed → dedup working."],
                      ["rate_limiter_override_cache_hits_total", "Counter", "level, hit={true,false}", "Override cache hit rate. Low hit rate → increase TTL."],
                      ["rate_limiter_singleflight_collapses_total", "Counter", "—", "How many concurrent /check calls were deduplicated by singleflight."],
                      ["rate_limiter_denial_cache_hits_total", "Counter", "—", "Denials served from sync.Map cache, bypassing limiter entirely."],
                      ["routing_gateway_health_score", "Gauge", "gateway_id", "Current health score of each registered gateway (0–1)."],
                      ["routing_requests_total", "Counter", "gateway_id, status={success,error,timeout}", "Requests forwarded per gateway and outcome."],
                    ].map(([name, type_, labels, desc], i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #18181b", background: i % 2 === 0 ? "#0b0b0b" : "#0f0f12" }}>
                        <td style={{ padding: "8px 12px", color: "#c084fc", fontFamily: "monospace", fontSize: 10 }}>{name}</td>
                        <td style={{ padding: "8px 12px", color: "#c084fc", fontFamily: "monospace", fontSize: 11 }}>{type_}</td>
                        <td style={{ padding: "8px 12px", color: "#a78bfa", fontFamily: "monospace", fontSize: 10 }}>{labels}</td>
                        <td style={{ padding: "8px 12px", color: "#71717a", lineHeight: 1.5 }}>{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Audit Log Architecture */}
              <h2 className="guide-sub-heading" id="audit" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                Audit Log Architecture
              </h2>
              <p>
                The audit log is a compliance-grade append-only event store backed by Redis. It uses an async worker pool to avoid adding audit-write latency to the hot path — the <code>/check</code> handler sends events to a buffered Go channel and returns immediately:
              </p>
              <DocsMermaid chart={auditFlowDiagram} />

              <div style={{ overflowX: "auto", marginTop: 20, marginBottom: 28 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #27272a" }}>
                      {["Field", "Type", "Description"].map(h => (
                        <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "#ff5cad", fontWeight: 600, fontSize: 12 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["event_id", "UUID (string)", "Unique identifier for the audit event. Used as HASH key: audit:event:{event_id}."],
                      ["decision", "string: allowed | denied", "The rate limiter's verdict for this request."],
                      ["algorithm", "string: token_bucket | sliding_window | hierarchical", "Which algorithm produced the decision."],
                      ["tenant_id", "string", "Tenant identifier for multi-tenant audit searches."],
                      ["user_id", "string", "User identifier within the tenant."],
                      ["endpoint", "string", "HTTP path that was checked (hierarchical mode only)."],
                      ["timestamp_ms", "int64 (Unix ms)", "Request timestamp. Used as ZSET score in all index keys."],
                      ["remaining", "int64", "Tokens remaining after this request (0 if denied)."],
                      ["override_applied", "bool", "Whether a runtime override config was active for this check."],
                    ].map(([field, type_, desc], i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #18181b", background: i % 2 === 0 ? "#0b0b0b" : "#0f0f12" }}>
                        <td style={{ padding: "8px 12px", color: "#c084fc", fontFamily: "monospace", fontWeight: 600 }}>{field}</td>
                        <td style={{ padding: "8px 12px", color: "#c084fc", fontSize: 11 }}>{type_}</td>
                        <td style={{ padding: "8px 12px", color: "#a1a1aa" }}>{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* append.lua */}
              <h2 className="guide-sub-heading" id="append-lua" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                <code style={{ color: "#ff5cad", fontSize: 18 }}>append.lua</code> — Atomic Audit Write
              </h2>
              <p>
                The append script writes the event HASH, updates the timestamp index, tenant index, and user index — all in one atomic round-trip. It also enforces a maximum log size to prevent unbounded Redis memory growth:
              </p>
              <div style={{ background: "#0f0f12", border: "1px solid #27272a", borderRadius: 8, padding: "16px 20px", marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#71717a", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  internal/limiter/audit/lua/append.lua
                </div>
                <GoCodeBlock>{`-- ============================================================
-- Audit Log Append Script (atomic multi-index write)
-- ============================================================
-- KEYS[1] = event HASH key:       audit:event:{event_id}
-- KEYS[2] = timestamp index ZSET: audit:idx:ts
-- KEYS[3] = tenant index ZSET:    audit:idx:tenant:{tenant_id}
-- KEYS[4] = user index ZSET:      audit:idx:user:{user_id}
-- ARGV[1..N] = field-value pairs for the event HASH
-- ARGV[N+1] = timestamp_ms (ZSET score)
-- ARGV[N+2] = event_id (ZSET member)
-- ARGV[N+3] = max_log_size (e.g. "100000" events)
-- ============================================================

local event_key  = KEYS[1]
local ts_idx     = KEYS[2]
local tenant_idx = KEYS[3]
local user_idx   = KEYS[4]
local n          = tonumber(ARGV[#ARGV - 2])  -- field count
local ts         = tonumber(ARGV[#ARGV - 1])
local event_id   = ARGV[#ARGV - 0]  -- note: Lua 1-indexed, careful
local max_size   = tonumber(ARGV[#ARGV])

-- Write event fields as HASH (all fields passed as ARGV pairs)
local hset_args = {}
for i = 1, n * 2 do
    table.insert(hset_args, ARGV[i])
end
redis.call('HSET', event_key, unpack(hset_args))
redis.call('EXPIRE', event_key, 86400 * 7)  -- 7-day TTL on event data

-- Update all indexes with timestamp as score (for range queries)
local member = event_id
redis.call('ZADD', ts_idx,     ts, member)
redis.call('ZADD', tenant_idx, ts, member)
redis.call('ZADD', user_idx,   ts, member)

-- Cap log size: remove oldest entries if over max_size
local total = redis.call('ZCARD', ts_idx)
if total > max_size then
    local to_remove = total - max_size
    -- Remove oldest members (lowest scores) from the global index
    local old_members = redis.call('ZRANGE', ts_idx, 0, to_remove - 1)
    redis.call('ZREMRANGEBYRANK', ts_idx, 0, to_remove - 1)
    -- Delete the underlying HASH keys for evicted events
    for _, m in ipairs(old_members) do
        redis.call('DEL', 'audit:event:' .. m)
    end
end

return {1, total}`}</GoCodeBlock>
              </div>

              {/* Jaeger Integration */}
              <h2 className="guide-sub-heading" id="jaeger" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                Jaeger Integration &amp; Prometheus Scraping
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                <div style={{ background: "#0f0f12", border: "1px solid #27272a", borderRadius: 8, padding: "16px 18px" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#a78bfa", marginBottom: 10 }}>Jaeger via Docker Compose</div>
                  <GoCodeBlock>{`# docker-compose.yml
jaeger:
  image: jaegertracing/all-in-one:latest
  environment:
    COLLECTOR_OTLP_ENABLED: "true"
  ports:
    - "16686:16686"  # Jaeger UI
    - "4318:4318"    # OTLP HTTP

# Limiter environment
limiter:
  environment:
    OTEL_EXPORTER_OTLP_ENDPOINT: "http://jaeger:4318"
    SERVICE_VERSION: "1.0.0"`}</GoCodeBlock>
                </div>
                <div style={{ background: "#0f0f12", border: "1px solid #27272a", borderRadius: 8, padding: "16px 18px" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#c084fc", marginBottom: 10 }}>Prometheus Scrape Config</div>
                  <GoCodeBlock>{`# prometheus.yml
scrape_configs:
  - job_name: rate-limiter
    static_configs:
      - targets:
          - limiter:8080   # limiter /metrics
          - sidecar:9090   # sidecar /metrics
    metrics_path: /metrics
    scrape_interval: 15s
    # If METRICS_REQUIRE_AUTH=true:
    authorization:
      credentials: "\${INTERNAL_API_KEY}"`}</GoCodeBlock>
                </div>
              </div>

              <div style={{
                background: "rgba(192, 132, 252,0.05)", border: "1px solid rgba(192, 132, 252,0.2)",
                borderRadius: 8, padding: "14px 18px", fontSize: 13, lineHeight: 1.65
              }}>
                <strong style={{ color: "#c084fc" }}>Recommended Alerts:</strong> Configure Prometheus alerting rules for:
                (1) <code>rate_limiter_circuit_breaker_state{"{state='open'}"} == 1</code> → circuit open, page immediately;
                (2) <code>rate(rate_limiter_requests_total{"{decision='denied'}"}[5m]) / rate(rate_limiter_requests_total[5m]) &gt; 0.25</code> → &gt;25% denial rate;
                (3) <code>histogram_quantile(0.99, rate_limiter_redis_duration_seconds) &gt; 0.05</code> → Redis p99 &gt; 50ms.
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

import DocsNavbar from "@/components/docs/DocsNavbar";
import DocsSidebar from "@/components/docs/DocsSidebar";
import DocsMermaid from "@/components/docs/DocsMermaid";
import GoCodeBlock from "@/components/docs/GoCodeBlock";

const pageTopics = [
  { label: "Overview", href: "#overview" },
  { label: "Distributed Tracing", href: "#tracing" },
  { label: "Prometheus Metrics", href: "#metrics" },
  { label: "Immutable Audit Trail", href: "#audit" },
];

const tracingArchitecture = `
sequenceDiagram
    autonumber
    actor Client
    participant Proxy as Sidecar Proxy
    participant Limiter as Central Limiter
    participant Redis as Redis Backend

    Client->>Proxy: GET /orders (traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01)
    Note over Proxy: Span: Sidecar Intercept<br/>Trace ID: 4bf92f3577b3...
    
    Proxy->>Limiter: GET /check_hierarchical (Propagated trace headers)
    Note over Limiter: Span: Limiter Check<br/>Parent: Sidecar Intercept
    
    Limiter->>Redis: EVALSHA hierarchical.lua
    Note over Limiter: Span: Redis Query (db.statement)
    Redis-->>Limiter: allowed=1
    
    Limiter-->>Proxy: 200 OK
    Proxy->>Client: Forwarded upstream & Response
`;

export default function RLObservabilityPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="overview">
              Observability &amp; Audit Logging
            </h1>

            <div className="guide-body-text" style={{ marginTop: 24 }}>
              
              {/* Overview Section */}
              <p>
                In high-throughput distributed architectures, understanding *why* a request was blocked or dropped is critical. Observability cannot be an afterthought: the limiter must trace request pathways, expose health metrics, and maintain a detailed, tamper-resistant log of every rate check decision.
              </p>
              <p style={{ marginTop: 12 }}>
                The Distributed Rate Limiter accomplishes this using a three-tier observability stack: <strong style={{ color: "#ff5cad" }}>OpenTelemetry tracing</strong>, <strong style={{ color: "#ff5cad" }}>Prometheus metrics</strong>, and an <strong style={{ color: "#ff5cad" }}>Immutable Audit Trail</strong>.
              </p>

              {/* Distributed Tracing */}
              <h2 className="guide-sub-heading" id="tracing" style={{ fontSize: 22, color: "#ffffff", marginTop: 36, marginBottom: 12 }}>
                OpenTelemetry Tracing Propagation
              </h2>
              <p>
                Distributed trace contexts propagate down the entire request cycle. If a client spans an HTTP trace context, the Sidecar extracts the context, generates child spans, and transmits the headers down to the Limiter.
              </p>

              <DocsMermaid chart={tracingArchitecture} />

              <p style={{ marginTop: 16 }}>
                Every internal client query (including connection pools, Redis command evaluations, and database locks) yields trace spans, exported directly to Jaeger via OTLP HTTP.
              </p>

              {/* Prometheus Metrics */}
              <h2 className="guide-sub-heading" id="metrics" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                Prometheus Metrics
              </h2>
              <p>
                The sidecar and limiter services expose a Prometheus <code>/metrics</code> scrape target over an independent administrative port (<code>:8081</code> or <code>:8082</code>). Standard hot-path latency and rate counters are implemented in Go:
              </p>
              <ul className="guide-bullets-list" style={{ marginTop: 10, marginBottom: 20 }}>
                <li><code>rate_limit_checks_total</code> — Counter tracking all checks, partitioned by labels: <code>tenant_id</code>, <code>status</code> (allowed, blocked, error).</li>
                <li><code>rate_limit_latency_seconds</code> — Histogram tracking connection and Lua execution times.</li>
                <li><code>circuit_breaker_state</code> — Gauge reporting the circuit breaker status (0 = Closed, 1 = Half-Open, 2 = Open).</li>
                <li><code>idempotency_hits_total</code> — Counter logging deduplicated cache matches.</li>
              </ul>

              <div style={{ background: "#0f0f12", border: "1px solid #27272a", borderRadius: 8, padding: "16px 20px", marginBottom: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#71717a", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  internal/metrics/metrics.go
                </div>
                <GoCodeBlock>{`package metrics

import "github.com/prometheus/client_golang/prometheus"

var (
	RateLimitChecks = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "rate_limit_checks_total",
			Help: "Total number of rate limit check evaluations",
		},
		[]string{"tenant", "status"},
	)

	RequestLatency = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "rate_limit_latency_seconds",
			Help:    "Execution latencies for rate limit checks",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"endpoint"},
	)
)

func init() {
	prometheus.MustRegister(RateLimitChecks)
	prometheus.MustRegister(RequestLatency)
}`}</GoCodeBlock>
              </div>

              {/* Immutable Audit Trail */}
              <h2 className="guide-sub-heading" id="audit" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                Asymmetric Immutable Audit Logging
              </h2>
              <p>
                For security compliance and debugging billing disputes, the platform captures every single rate check decision in an immutable log.
              </p>
              <p style={{ marginTop: 12 }}>
                To support high throughput, the audit log avoids heavy file IO on the request hot path. Instead, the limiter performs <strong style={{ color: "#ff5cad" }}>asymmetric pipeline writing</strong>:
              </p>
              <ol className="guide-bullets-list" style={{ marginTop: 10, marginBottom: 20, listStyleType: "decimal", paddingLeft: 20 }}>
                <li><strong>Log Generation (Lua):</strong> During the rate limit check, the Lua script appends the outcome details (timestamp, request ID, tenant ID, remaining tokens) to a Redis LIST (<code>audit:events</code>) using <code>RPUSH</code>. This adds almost zero latency.</li>
                <li><strong>Async Consumption (Go):</strong> A pool of background worker goroutines poll the Redis list using <code>BLPOP</code> (blocking pop) and stream the logs to persistent cold storage (such as Elasticsearch or S3).</li>
              </ol>

              <div style={{ background: "#0f0f12", border: "1px solid #27272a", borderRadius: 8, padding: "16px 20px", marginBottom: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#71717a", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  internal/audit/lua/append.lua
                </div>
                <GoCodeBlock>{`-- KEYS[1] = audit:events (list namespace)
-- ARGV[1] = json_payload (serialized event details)

local key = KEYS[1]
local payload = ARGV[1]

-- Append the immutable log entry
redis.call('RPUSH', key, payload)

-- Enforce cap to prevent memory leaks in case consumer falls behind
local size = redis.call('LLEN', key)
if size > 100000 then
    -- Trim older events
    redis.call('LPOP', key)
end

return size`}</GoCodeBlock>
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

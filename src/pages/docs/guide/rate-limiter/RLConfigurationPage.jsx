import DocsNavbar from "@/components/docs/DocsNavbar";
import DocsSidebar from "@/components/docs/DocsSidebar";
import GoCodeBlock from "@/components/docs/GoCodeBlock";

const pageTopics = [
  { label: "Central Limiter Config", href: "#limiter-config" },
  { label: "Sidecar Config", href: "#sidecar-config" },
  { label: "Redis Config", href: "#redis-config" },
  { label: "Circuit Breaker Config", href: "#cb-config" },
  { label: "Idempotency Config", href: "#idem-config" },
  { label: "Routing Config", href: "#routing-config" },
  { label: "Observability Config", href: "#obs-config" },
  { label: "Docker Compose Example", href: "#compose-example" },
];

function ConfigTable({ rows }) {
  return (
    <div style={{ overflowX: "auto", marginBottom: 28 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #27272a" }}>
            {["Environment Variable", "Default", "Type", "Description"].map(h => (
              <th key={h} style={{ padding: "7px 10px", textAlign: "left", color: "#ff5cad", fontWeight: 600, fontSize: 11.5 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([envVar, def, type, desc], i) => (
            <tr key={i} style={{ borderBottom: "1px solid #18181b", background: i % 2 === 0 ? "#0b0b0b" : "#0f0f12" }}>
              <td style={{ padding: "7px 10px", color: "#ff5cad", fontFamily: "monospace", fontSize: 12 }}>{envVar}</td>
              <td style={{ padding: "7px 10px", color: "#38bdf8", fontFamily: "monospace", fontSize: 11.5, whiteSpace: "nowrap" }}>{def}</td>
              <td style={{ padding: "7px 10px", color: "#a78bfa", fontFamily: "monospace", fontSize: 11 }}>{type}</td>
              <td style={{ padding: "7px 10px", color: "#a1a1aa", lineHeight: 1.5 }}>{desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function RLConfigurationPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="limiter-config">
              Configuration Reference
            </h1>

            <div className="guide-body-text" style={{ marginTop: 24 }}>
              <p>
                All configuration is driven by environment variables. There are no config files in the traditional sense — everything is set via env. This makes the system straightforward to deploy in Docker, Kubernetes, or any 12-factor environment.
              </p>

              <div style={{
                background: "rgba(255,92,173,0.06)",
                border: "1px solid rgba(255,92,173,0.2)",
                borderRadius: 8, padding: "12px 16px",
                fontSize: 13, marginBottom: 28
              }}>
                <strong style={{ color: "#ff5cad" }}>Note:</strong> Variables marked with a <code style={{ color: "#fb923c" }}>★</code> are security-sensitive. Never use their default values in production.
              </div>

              {/* Central Limiter */}
              <h2 className="guide-sub-heading" id="limiter-config" style={{ fontSize: 22, color: "#ffffff", marginTop: 0, marginBottom: 12 }}>
                Central Limiter (<code style={{ fontSize: 16, color: "#ff5cad" }}>cmd/limiter</code>)
              </h2>

              <h3 style={{ fontSize: 15, color: "#a1a1aa", marginBottom: 10, marginTop: 16 }}>Server</h3>
              <ConfigTable rows={[
                ["PORT", "8080", "int", "HTTP port for the rate check hot path (/check, /check_hierarchical, /health, /metrics)."],
                ["ENABLE_ADMIN_API", "false", "bool", "Whether to start the admin API server on ADMIN_PORT."],
                ["ADMIN_PORT", "8082", "int", "Port for the admin API (override CRUD, circuit management, audit search)."],
                ["ADMIN_API_KEY ★", "\"\"", "string", "Required when ENABLE_ADMIN_API=true. All admin requests must include X-API-Key: {value}."],
                ["INTERNAL_API_KEY ★", "\"\"", "string", "API key for internal sidecar→limiter calls. Checked on /check and /check_hierarchical."],
                ["METRICS_REQUIRE_AUTH", "false", "bool", "If true, /metrics requires the INTERNAL_API_KEY header."],
                ["ALLOW_QUERY_USER_ID", "false", "bool", "If true, user ID can be passed as a query param (?user_id=X) in addition to the header."],
              ]} />

              <h3 style={{ fontSize: 15, color: "#a1a1aa", marginBottom: 10, marginTop: 20 }}>Rate Limiting Algorithm</h3>
              <ConfigTable rows={[
                ["ALGORITHM", "token_bucket", "string", "Rate limiting algorithm: 'token_bucket' or 'sliding'. Controls which algorithm is used for /check."],
                ["CAPACITY", "10", "int", "Max tokens (token bucket) or max requests (sliding window) per user."],
                ["REFILL_RATE", "1.0", "float64", "Tokens refilled per second (token bucket only). Ignored for sliding window."],
                ["WINDOW_SEC", "60", "int", "Sliding window duration in seconds. Ignored for token bucket."],
                ["ENABLE_HIERARCHICAL", "false", "bool", "Enable the 4-level hierarchical limiter (/check_hierarchical)."],
                ["GLOBAL_CAPACITY", "1000000", "int", "Global bucket capacity (max tokens for all traffic combined)."],
                ["GLOBAL_REFILL_RATE", "10000.0", "float64", "Global bucket refill rate (tokens/second)."],
                ["TENANT_CAPACITY", "100000", "int", "Per-tenant bucket capacity."],
                ["TENANT_REFILL_RATE", "1000.0", "float64", "Per-tenant refill rate (tokens/second)."],
                ["USER_CAPACITY", "100", "int", "Per-user bucket capacity."],
                ["USER_REFILL_RATE", "1.0", "float64", "Per-user refill rate (tokens/second)."],
                ["ENDPOINT_CAPACITY", "10", "int", "Per-endpoint-per-tenant bucket capacity."],
                ["ENDPOINT_REFILL_RATE", "0.5", "float64", "Per-endpoint refill rate (tokens/second)."],
              ]} />

              <h3 style={{ fontSize: 15, color: "#a1a1aa", marginBottom: 10, marginTop: 20 }}>Override Cache</h3>
              <ConfigTable rows={[
                ["OVERRIDE_CACHE_TTL_MS", "5000", "int", "Local TTL (ms) for the override read-through cache. Admin changes propagate within this window."],
              ]} />

              <h3 style={{ fontSize: 15, color: "#a1a1aa", marginBottom: 10, marginTop: 20 }}>Audit Trail</h3>
              <ConfigTable rows={[
                ["ENABLE_AUDIT_TRAIL", "false", "bool", "Enable the immutable audit trail for all rate limit decisions."],
                ["AUDIT_RETENTION_HOURS", "168", "int", "How long audit events are retained in Redis (default: 7 days)."],
                ["AUDIT_MAX_EVENTS", "100000", "int", "Maximum number of events stored in the global audit index."],
                ["AUDIT_ASYNC", "true", "bool", "If true, audit writes are async via a worker pool. If false, inline (adds latency)."],
                ["AUDIT_QUEUE_SIZE", "1000", "int", "Bounded queue size for async audit workers. Events beyond this are dropped with a metric."],
                ["AUDIT_WORKERS", "2", "int", "Number of goroutines processing the async audit queue."],
              ]} />

              {/* Sidecar */}
              <h2 className="guide-sub-heading" id="sidecar-config" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                Sidecar Proxy (<code style={{ fontSize: 16, color: "#ff5cad" }}>cmd/sidecar</code>)
              </h2>

              <ConfigTable rows={[
                ["PORT", "9090", "int", "HTTP port the sidecar listens on."],
                ["UPSTREAM_URL", "\"\"", "string", "Target URL to forward allowed requests to. Required unless ENABLE_ROUTING=true."],
                ["RATE_LIMITER_URL", "\"\"", "string", "Base URL of the central limiter service (e.g., http://limiter:8080)."],
                ["RATE_LIMIT", "10", "int", "Per-user limit to pass to /check. Also used as the X-RateLimit-Limit header value."],
                ["USE_HIERARCHICAL", "false", "bool", "If true, calls /check_hierarchical instead of /check."],
                ["FAIL_OPEN", "false", "bool", "★ If true, allows requests when the limiter is unreachable. NEVER use in production."],
                ["INTERNAL_API_KEY ★", "\"\"", "string", "Key sent on sidecar→limiter calls. Must match the limiter's INTERNAL_API_KEY."],
                ["ALLOW_QUERY_USER_ID", "false", "bool", "Allow user ID via query param in addition to header."],
                ["ALLOWED_PATHS", "\"\"", "string", "Comma-separated list of allowed URL paths. Empty = allow all."],
                ["DEBUG", "false", "bool", "Enable verbose request-level debug logging."],
                ["CACHE_TTL_MS", "1000", "int", "TTL for the local denial cache entries (milliseconds)."],
              ]} />

              {/* Redis */}
              <h2 className="guide-sub-heading" id="redis-config" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                Redis Connection
              </h2>
              <p style={{ marginBottom: 12 }}>
                Both the limiter and sidecar use the same env vars for Redis connection. The <code style={{ color: "#ff5cad" }}>REDIS_MODE</code> var selects standalone vs. Sentinel mode.
              </p>

              <ConfigTable rows={[
                ["REDIS_ADDR", "localhost:6379", "string", "Redis address (host:port). For sentinel mode, this should be one sentinel address."],
                ["REDIS_PASSWORD ★", "\"\"", "string", "Redis AUTH password. Set this! Docker defaults use 'dev-redis-password' which must be changed."],
                ["REDIS_DB", "0", "int", "Redis database index (0-15). Use 0 unless multiple apps share a Redis instance."],
                ["REDIS_POOL_SIZE", "100", "int", "Max connections in the go-redis connection pool."],
                ["REDIS_MIN_IDLE_CONNS", "10", "int", "Minimum idle connections to keep warm."],
                ["REDIS_MODE", "standalone", "string", "'standalone' or 'sentinel'. Selects client type."],
                ["REDIS_SENTINEL_ADDRS", "\"\"", "string", "Comma-separated sentinel addresses (e.g., sentinel1:26379,sentinel2:26380). Required when REDIS_MODE=sentinel."],
                ["REDIS_SENTINEL_MASTER", "mymaster", "string", "Sentinel master name to monitor."],
                ["REDIS_SENTINEL_PASSWORD ★", "\"\"", "string", "Sentinel AUTH password (if sentinels are password-protected)."],
              ]} />

              {/* Circuit Breaker */}
              <h2 className="guide-sub-heading" id="cb-config" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                Circuit Breaker
              </h2>

              <ConfigTable rows={[
                ["CB_FAILURE_RATE", "0.5", "float64", "Trip threshold for failure rate (failures/total). Range: 0.0–1.0."],
                ["CB_MIN_SAMPLES", "10", "int64", "Minimum requests before failure/timeout rate thresholds apply."],
                ["CB_CONSECUTIVE_FAILURES", "5", "int64", "Trip immediately if this many consecutive failures occur."],
                ["CB_LATENCY_THRESHOLD_MS", "500", "int64", "Requests slower than this are classified as latency spikes."],
                ["CB_TIMEOUT_RATE", "0.3", "float64", "Trip threshold for timeout rate (timeouts/total). Range: 0.0–1.0."],
                ["CB_OPEN_COOLDOWN_MS", "30000", "int64", "How long (ms) the circuit stays Open before attempting Half-Open."],
                ["CB_HALF_OPEN_MAX_PROBES", "3", "int64", "Max probe requests allowed in Half-Open state."],
                ["CB_HALF_OPEN_SUCCESS_REQUIRED", "2", "int64", "Successes required in Half-Open to close the circuit."],
                ["CB_EMA_ALPHA", "0.2", "float64", "EMA smoothing factor for latency. Higher = more weight on recent requests. Range: 0.0–1.0."],
                ["CIRCUIT_FAIL_OPEN", "false", "bool", "★ If true, Redis errors in the CB allow traffic. Dangerous."],
              ]} />

              {/* Idempotency */}
              <h2 className="guide-sub-heading" id="idem-config" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                Idempotency
              </h2>

              <ConfigTable rows={[
                ["ENABLE_IDEMPOTENCY", "false", "bool", "Enable the Stripe-style idempotency layer on the sidecar."],
                ["IDEMPOTENCY_LOCK_TTL_MS", "60000", "int", "How long a 'processing' lock is held (ms). Retries during this period get 409 Conflict."],
                ["IDEMPOTENCY_COMPLETED_TTL_MS", "86400000", "int", "How long a completed/failed idempotency record is retained (ms). Default: 24 hours."],
                ["IDEMPOTENCY_FAIL_OPEN", "false", "bool", "★ If true, idempotency check failures fall through to the normal request path."],
                ["IDEMPOTENCY_MAX_BODY_BYTES", "1048576", "int", "Max request body size for idempotency fingerprinting (default: 1 MiB)."],
                ["IDEMPOTENCY_LARGE_BODY_THRESHOLD", "65536", "int", "Bodies larger than this are stored in a separate Redis STRING key; smaller ones inline in the HASH."],
              ]} />

              {/* Routing */}
              <h2 className="guide-sub-heading" id="routing-config" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                Intelligent Routing
              </h2>

              <ConfigTable rows={[
                ["ENABLE_ROUTING", "false", "bool", "Enable the intelligent gateway router instead of a single UPSTREAM_URL."],
                ["GATEWAYS", "\"\"", "string", "Comma-separated list of gateways: 'id|url|weight,id|url|weight' (e.g., gateway-a|http://gw-a:8081|100)."],
                ["ROUTING_TARGET_LATENCY_MS", "100.0", "float64", "Target latency for the scoring formula. Gateways below this get a bonus; above get a penalty."],
                ["ROUTING_ERROR_PENALTY", "2.0", "float64", "Multiplier applied to error rate in the scoring formula. Higher = more aggressive penalty."],
                ["ROUTING_CIRCUIT_ERROR_RATE", "0.5", "float64", "Circuit breaker failure rate threshold for gateway circuits."],
                ["ROUTING_CIRCUIT_MIN_SAMPLES", "10", "int", "Min samples before gateway circuit trips."],
                ["ROUTING_PROBE_INTERVAL_SEC", "15", "int", "How often (seconds) the router health-probes each gateway's /health endpoint."],
                ["ROUTING_HEALTH_DECAY", "0.1", "float64", "Health score decrement per failed probe. Score starts at 100.0."],
                ["ROUTING_HEALTH_RECOVERY", "5.0", "float64", "Health score increment per successful probe."],
                ["ROUTING_MIN_HEALTH_SCORE", "20.0", "float64", "Gateways below this score are excluded from selection."],
              ]} />

              {/* Observability */}
              <h2 className="guide-sub-heading" id="obs-config" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                Observability
              </h2>

              <ConfigTable rows={[
                ["OTEL_ENABLED", "false", "bool", "Enable OpenTelemetry tracing."],
                ["OTEL_SERVICE_NAME", "rate-limiter", "string", "Service name as it appears in Jaeger traces."],
                ["OTEL_EXPORTER_OTLP_ENDPOINT", "\"\"", "string", "OTLP HTTP endpoint (e.g., http://jaeger:4318). Required when OTEL_ENABLED=true."],
                ["OTEL_EXPORTER_OTLP_INSECURE", "false", "bool", "Set true to skip TLS verification on the OTLP endpoint."],
              ]} />

              {/* Docker compose example */}
              <h2 className="guide-sub-heading" id="compose-example" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                Full docker-compose Example
              </h2>
              <p style={{ marginBottom: 14 }}>
                Here is the limiter service config from <code style={{ color: "#ff5cad" }}>docker-compose.yml</code> with annotations:
              </p>
              <GoCodeBlock>{`limiter:
  build:
    context: .
    dockerfile: dockerfiles/Dockerfile.limiter
  container_name: rate-limiter
  environment:
    # Server
    - PORT=8080
    - REDIS_ADDR=redis:6379
    - REDIS_PASSWORD=\${REDIS_PASSWORD:-dev-redis-password}  # ← Change this!

    # OpenTelemetry
    - OTEL_ENABLED=true
    - OTEL_SERVICE_NAME=rate-limiter
    - OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4318
    - OTEL_EXPORTER_OTLP_INSECURE=true

    # Rate limiting
    - ALGORITHM=sliding           # token_bucket or sliding
    - CAPACITY=10
    - REFILL_RATE=1.0             # tokens/sec (token_bucket only)
    - WINDOW_SEC=60               # sliding window only

    # Hierarchical mode
    - ENABLE_HIERARCHICAL=true
    - GLOBAL_CAPACITY=1000000
    - GLOBAL_REFILL_RATE=10000.0
    - TENANT_CAPACITY=100000
    - TENANT_REFILL_RATE=1000.0
    - USER_CAPACITY=100
    - USER_REFILL_RATE=1.0
    - ENDPOINT_CAPACITY=10
    - ENDPOINT_REFILL_RATE=0.5

    # Admin API
    - ENABLE_ADMIN_API=true
    - ADMIN_PORT=8082
    - ADMIN_API_KEY=dev-key-change-in-prod  # ← MUST change in production!
    - INTERNAL_API_KEY=dev-internal-key-change-in-prod  # ← MUST change!

    # Override cache
    - OVERRIDE_CACHE_TTL_MS=5000

    # Audit trail
    - ENABLE_AUDIT_TRAIL=true
    - AUDIT_RETENTION_HOURS=168
    - AUDIT_MAX_EVENTS=100000
  ports:
    - "8080:8080"  # hot path
    - "8082:8082"  # admin API — restrict to internal network in production!
  depends_on:
    redis:
      condition: service_healthy`}</GoCodeBlock>

              <div style={{
                background: "rgba(244,63,94,0.06)",
                border: "1px solid rgba(244,63,94,0.2)",
                borderRadius: 8, padding: "14px 18px",
                fontSize: 13, lineHeight: 1.65, marginTop: 4
              }}>
                <strong style={{ color: "#f87171" }}>⚠️ Production Security Checklist:</strong>
                <ul style={{ paddingLeft: 16, marginTop: 8, lineHeight: 1.9 }}>
                  <li>Replace <code>REDIS_PASSWORD</code>, <code>ADMIN_API_KEY</code>, and <code>INTERNAL_API_KEY</code> with randomly generated secrets (e.g., <code>openssl rand -hex 32</code>)</li>
                  <li>Never expose <code>ADMIN_PORT</code> to public networks — restrict to internal VPC or Kubernetes ClusterIP service</li>
                  <li>Set <code>FAIL_OPEN=false</code> — the default is safe but double-check it</li>
                  <li>Set Redis <code>maxmemory-policy noeviction</code> — default LRU eviction will silently delete rate limit buckets</li>
                </ul>
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

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

const traceSpanTimeline = `
gantt
    title Trace Span Timeline (verified span names)
    dateFormat  X
    axisFormat %L ms
    section Sidecar
    sidecar.handle_request :active, 0, 15
    sidecar.check_idempotency : 1, 4
    sidecar.forward_upstream : 8, 14
    section Limiter
    limiter.check_rate_limit : 2, 7
    limiter.redis_evalsha : 3, 6
    limiter.override_lookup : 2, 3
`;

const incidentWorkflow = `
flowchart LR
    ID[1. Extract Request ID] --> Log[2. Query JSON logs]
    Log --> Trace[3. Find Trace ID]
    Trace --> Jaeger[4. Inspect Jaeger spans]
    Jaeger --> Metrics[5. Correlate Prometheus panels]
    Metrics --> Root[6. Identify root cause]
    style ID fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style Log fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style Trace fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style Jaeger fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style Metrics fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style Root fill:#1e1e2e,stroke:#ff5cad,color:#fff
`;

export const observabilityPages = {
  "overview": {
    title: "Overview",
    topics: [
      { label: "Telemetry pillars", href: "#pillars" },
      { label: "Correlation ID mapping", href: "#correlation" },
      { label: "Jaeger trace dashboard", href: "#jaeger" },
      { label: "Scrape endpoints", href: "#scrape-endpoints" }
    ],
    content: (
      <div>
        <RLThesis>
          High-throughput distributed rate limiting demands <strong style={{ color: "#ff5cad" }}>correlated telemetry across three pillars</strong> — Prometheus metrics for aggregate health, OpenTelemetry traces for per-request latency breakdown, and structured <code>log/slog</code> JSON logs for searchable incident context. Every metric name, label, and scrape target on this page is sourced from <code>internal/metrics/metrics.go</code> and <code>deploy/prometheus/prometheus.yml</code>.
        </RLThesis>

        <RLQuickModel>
          Metrics answer "what is the cluster doing right now?" Traces answer "what happened to this one request?" Logs answer "what state transition or error preceded the failure?" Tie them together with <code>request_id</code> and W3C <code>trace_id</code> propagated from sidecar through limiter to Redis spans.
        </RLQuickModel>

        <h2 className="guide-sub-heading" id="pillars">Telemetry Pillars</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, margin: "16px 0 24px" }}>
          <div style={{ background: "#111113", border: "1px solid #27272a", borderRadius: 8, padding: 16 }}>
            <h3 style={{ color: "#ffffff", fontSize: 14, fontWeight: "bold", margin: "0 0 8px 0" }}>Metrics (Prometheus)</h3>
            <p style={{ margin: 0, fontSize: 13, color: "#a1a1aa", lineHeight: 1.6 }}>
              Counters and histograms registered in <code>internal/metrics/metrics.go</code>. Scrape <code>limiter:8080/metrics</code> and <code>sidecar:9090/metrics</code>. Key families: <code>rate_limiter_requests_total{"{handler, allowed}"}</code>, <code>circuit_breaker_state{"{target}"}</code>, <code>routing_gateway_health_score</code>.
            </p>
            <div style={{ marginTop: 8 }}><RLEvidenceBadge type="SOURCE-PROVEN" /></div>
          </div>
          <div style={{ background: "#111113", border: "1px solid #27272a", borderRadius: 8, padding: 16 }}>
            <h3 style={{ color: "#ffffff", fontSize: 14, fontWeight: "bold", margin: "0 0 8px 0" }}>Distributed Tracing (OpenTelemetry)</h3>
            <p style={{ margin: 0, fontSize: 13, color: "#a1a1aa", lineHeight: 1.6 }}>
              Spans created via <code>internal/telemetry</code> helpers. OTLP/HTTP export defaults to <code>http://localhost:4318</code> (<code>OTEL_EXPORTER_OTLP_ENDPOINT</code>). W3C <code>traceparent</code> propagates sidecar → limiter → Redis child spans.
            </p>
            <div style={{ marginTop: 8 }}><RLEvidenceBadge type="SOURCE-PROVEN" /></div>
          </div>
          <div style={{ background: "#111113", border: "1px solid #27272a", borderRadius: 8, padding: 16 }}>
            <h3 style={{ color: "#ffffff", fontSize: 14, fontWeight: "bold", margin: "0 0 8px 0" }}>Structured Logs (log/slog)</h3>
            <p style={{ margin: 0, fontSize: 13, color: "#a1a1aa", lineHeight: 1.6 }}>
              Go standard library <code>log/slog</code> with JSON handler. Hot-path quota checks stay silent; state transitions (circuit opens, audit drops) emit searchable records with <code>request_id</code> and <code>trace_id</code>.
            </p>
            <div style={{ marginTop: 8 }}><RLEvidenceBadge type="SOURCE-PROVEN" /></div>
          </div>
        </div>

        <RLStatGrid stats={[
          { value: ":8080", label: "Limiter /metrics endpoint", evidence: "SOURCE-PROVEN" },
          { value: ":9090", label: "Sidecar /metrics endpoint", evidence: "SOURCE-PROVEN" },
          { value: ":4318", label: "Default OTLP/HTTP collector port", evidence: "SOURCE-PROVEN" }
        ]} />

        <h2 className="guide-sub-heading" id="correlation">Correlation ID Mapping</h2>
        <p>
          The sidecar generates a unique <code>X-Request-ID</code> for every inbound call and injects it into structured logs. OpenTelemetry extracts the W3C <code>trace_id</code> from the active span context. Operators pivot from a client-reported request ID to Jaeger traces and Loki/Elasticsearch log lines without guessing which replica handled the call.
        </p>

        <h2 className="guide-sub-heading" id="jaeger">Jaeger Trace Dashboard</h2>
        <p>
          Both <code>cmd/limiter</code> and <code>cmd/sidecar</code> call <code>telemetry.InitTracer()</code> at startup. Traces export via OTLP/HTTP to the endpoint configured by <code>OTEL_EXPORTER_OTLP_ENDPOINT</code> (default <code>http://localhost:4318</code>). View assembled timelines in the Jaeger Web UI at <code>http://localhost:16686</code>.
        </p>

        <h2 className="guide-sub-heading" id="scrape-endpoints">Prometheus Scrape Endpoints</h2>
        <p>
          <code>deploy/prometheus/prometheus.yml</code> scrapes both services on a 15-second interval. When <code>METRICS_REQUIRE_AUTH=true</code>, pass <code>X-API-Key</code> via the scrape <code>authorization</code> block.
        </p>

        <RLRelatedPages pages={[
          { slug: "distributed-tracing", section: "observability", title: "Distributed Tracing", note: "InitTracer, span hierarchy, 429 semantics" },
          { slug: "metrics-and-prometheus", section: "observability", title: "Metrics & Prometheus", note: "Full metric catalog from metrics.go" },
          { slug: "structured-logging", section: "observability", title: "Structured Logging", note: "log/slog fields and transition logging" },
          { slug: "anatomy-of-a-request", section: "architecture", title: "Anatomy of a Request", note: "Request path that generates spans and metrics" }
        ]} />
      </div>
    )
  },

  "distributed-tracing": {
    title: "Distributed Tracing",
    topics: [
      { label: "OpenTelemetry setup", href: "#setup" },
      { label: "Span hierarchy", href: "#hierarchy" },
      { label: "429 status semantics", href: "#span-errors" },
      { label: "Key span attributes", href: "#span-attributes" }
    ],
    content: (
      <div>
        <RLThesis>
          Distributed tracing follows every request from sidecar interception through limiter quota evaluation to Redis Lua execution. Spans are created by the <code>internal/telemetry</code> package and exported via OTLP/HTTP — not invented pseudocode. A <code>429 Too Many Requests</code> is recorded as an HTTP status attribute but is <strong style={{ color: "#ff5cad" }}>never marked as a span error</strong>, keeping trace error rates aligned with infrastructure failures only.
        </RLThesis>

        <RLQuickModel>
          Sidecar starts root span <code>sidecar.handle_request</code> → injects <code>traceparent</code> into limiter HTTP call → limiter creates <code>limiter.check_rate_limit</code> child → Redis round-trip gets <code>limiter.redis_evalsha</code>. All spans flush asynchronously via the batch exporter — zero blocking on the hot path.
        </RLQuickModel>

        <h2 className="guide-sub-heading" id="setup">OpenTelemetry Setup</h2>
        <p>
          Both the limiter and sidecar invoke <code>telemetry.InitTracer(serviceName)</code> at process startup. The function reads <code>OTEL_EXPORTER_OTLP_ENDPOINT</code>, defaulting to <code>http://localhost:4318</code> when unset, and registers a global tracer provider with W3C TraceContext + Baggage propagation.
        </p>

        <RLSourceExcerpt
          source="internal/telemetry/tracer.go — InitTracer()"
          establishes="OTLP/HTTP exporter, default endpoint http://localhost:4318, batch export, W3C propagation, graceful shutdown function returned."
        >{`func InitTracer(serviceName string) (func(context.Context) error, error) {
    endpoint := os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
    if endpoint == "" {
        endpoint = "http://localhost:4318" // default Jaeger OTLP/HTTP
    }

    exporter, err := otlptracehttp.New(context.Background(),
        otlptracehttp.WithEndpointURL(endpoint+"/v1/traces"),
        otlptracehttp.WithTimeout(5*time.Second),
    )
    if err != nil {
        return nil, fmt.Errorf("failed to create OTLP exporter: %w", err)
    }

    res, _ := resource.Merge(
        resource.Default(),
        resource.NewWithAttributes(
            semconv.SchemaURL,
            semconv.ServiceName(serviceName),
            semconv.ServiceVersion(os.Getenv("SERVICE_VERSION")),
        ),
    )

    tp := sdktrace.NewTracerProvider(
        sdktrace.WithBatcher(exporter,
            sdktrace.WithMaxExportBatchSize(512),
            sdktrace.WithBatchTimeout(5*time.Second),
        ),
        sdktrace.WithResource(res),
        sdktrace.WithSampler(sdktrace.AlwaysSample()),
    )

    otel.SetTracerProvider(tp)
    otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
        propagation.TraceContext{},
        propagation.Baggage{},
    ))

    return tp.Shutdown, nil
}`}</RLSourceExcerpt>

        <h2 className="guide-sub-heading" id="hierarchy">Span Hierarchy</h2>
        <p>
          A single API call produces a nested span tree spanning both services:
        </p>
        <DocsMermaid chart={traceSpanTimeline} />

        <h2 className="guide-sub-heading" id="span-errors">429 Status Semantics</h2>
        <RLCallout variant="warning" title="429 is business logic, not a span error">
          Rate-limiting rejections (<code>429 Too Many Requests</code>) are expected enforcement outcomes. The telemetry package records <code>http.status_code=429</code> on the span but does <strong>not</strong> call <code>span.SetStatus(codes.Error, ...)</code>. This keeps Jaeger error-rate dashboards and trace-based alerts focused on infrastructure failures (503, timeouts, Redis errors) rather than legitimate quota enforcement.
          <span style={{ display: "block", marginTop: 8 }}><RLEvidenceBadge type="SOURCE-PROVEN" /></span>
        </RLCallout>

        <h2 className="guide-sub-heading" id="span-attributes">Key Span Attributes</h2>
        <div style={{ overflowX: "auto", margin: "20px 0" }}>
          <table className="guide-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #27272a", textAlign: "left" }}>
                <th style={{ padding: "12px 8px" }}>Span Name</th>
                <th style={{ padding: "12px 8px" }}>Service</th>
                <th style={{ padding: "12px 8px" }}>Key Attributes</th>
                <th style={{ padding: "12px 8px" }}>Evidence</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["sidecar.handle_request", "Sidecar", "http.method, http.path, user.id, tenant.id", "SOURCE-PROVEN"],
                ["sidecar.check_idempotency", "Sidecar", "idempotency.key, idempotency.status", "SOURCE-PROVEN"],
                ["sidecar.forward_upstream", "Sidecar", "upstream.url, upstream.latency_ms, http.status_code", "SOURCE-PROVEN"],
                ["limiter.check_rate_limit", "Limiter", "rate.limit.key, rate.limit.algorithm, rate.limit.remaining", "SOURCE-PROVEN"],
                ["limiter.redis_evalsha", "Limiter", "db.system=redis, db.statement=EVALSHA", "SOURCE-PROVEN"],
                ["limiter.override_lookup", "Limiter", "override.level, override.id, override.hit", "SOURCE-PROVEN"]
              ].map(([span, svc, attrs, evidence]) => (
                <tr key={span} style={{ borderBottom: "1px solid #27272a" }}>
                  <td style={{ padding: "12px 8px", fontFamily: "monospace", color: "#ff5cad", fontSize: 12 }}>{span}</td>
                  <td style={{ padding: "12px 8px" }}>{svc}</td>
                  <td style={{ padding: "12px 8px", fontFamily: "monospace", fontSize: 11, color: "#a1a1aa" }}>{attrs}</td>
                  <td style={{ padding: "12px 8px" }}><RLEvidenceBadge type={evidence} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <RLRelatedPages pages={[
          { slug: "overview", section: "observability", title: "Overview", note: "Three pillars and correlation IDs" },
          { slug: "incident-correlation", section: "observability", title: "Incident Correlation", note: "Request ID to trace to metrics workflow" },
          { slug: "sidecar-architecture", section: "request-routing", title: "Sidecar Architecture", note: "Where root spans originate" },
          { slug: "circuit-breaker", section: "resilience", title: "Circuit Breaker", note: "429 excluded from breaker stats (mirrors trace semantics)" }
        ]} />
      </div>
    )
  },

  "structured-logging": {
    title: "Structured Logging",
    topics: [
      { label: "log/slog engine", href: "#slog" },
      { label: "Log field schema", href: "#fields" },
      { label: "State transition logging", href: "#transitions" },
      { label: "JSON log output", href: "#json-log" }
    ],
    content: (
      <div>
        <RLThesis>
          Structured logging uses Go's standard library <code>log/slog</code> — not a third-party alias — configured with a JSON <code>Handler</code> so every record is a single-line, machine-parseable map. Hot-path quota checks remain silent; logs are reserved for state transitions, errors, and operator-actionable events that benefit from <code>request_id</code> and <code>trace_id</code> correlation.
        </RLThesis>

        <RLQuickModel>
          Normal allowed/denied checks: no log line (metrics capture volume). Circuit breaker opens, audit queue drops, idempotency fence mismatch: structured INFO/WARN with component, operation, and correlation IDs. Query by <code>trace_id</code> to jump from Jaeger to Loki.
        </RLQuickModel>

        <h2 className="guide-sub-heading" id="slog">log/slog Engine</h2>
        <p>
          The platform wraps <code>log/slog</code> behind a thin <code>internal/logging</code> facade that injects context-derived fields (<code>request_id</code>, <code>trace_id</code>) on every call. The handler emits JSON to stdout for container log aggregation (Loki, Elasticsearch, CloudWatch).
        </p>

        <RLSourceExcerpt
          source="cmd/sidecar/main.go — allowed cache hit handling"
          establishes="Debug-level structured log on allowed cache ignore; uses logging.Debug with context-propagated fields, not printf."
        >{`if !entry.Allowed {
    metrics.RecordCacheHit()
    s.writeDenial(w, entry.Limit, entry.Remaining, entry.RetryAfter)
    return
}
logging.Debug(ctx, "allowed cache entry ignored",
    "component", "sidecar",
    "operation", "denial_cache",
    "cache_key", cacheKey,
)`}</RLSourceExcerpt>

        <h2 className="guide-sub-heading" id="fields">Log Field Schema</h2>
        <p>Enforced key-value fields for searchability:</p>
        <ul className="guide-bullets-list">
          <li><code>request_id</code> — traces a single client execution across replicas.</li>
          <li><code>trace_id</code> — correlates log lines with Jaeger span timelines.</li>
          <li><code>component</code> / <code>operation</code> — origin categorization (e.g. <code>limiter</code>, <code>idempotency_store</code>, <code>circuit_breaker</code>).</li>
          <li><code>target</code> — circuit breaker target name (<code>redis</code>, <code>central-limiter</code>, gateway ID).</li>
        </ul>

        <h2 className="guide-sub-heading" id="transitions">State Transition Logging</h2>
        <p>
          To protect disk I/O and hot-path latency, per-request quota checks do not emit logs. Structured records are reserved for meaningful transitions:
        </p>
        <ul className="guide-bullets-list">
          <li>Circuit breaker state changes (<code>Closed</code> → <code>Open</code> → <code>HalfOpen</code>) — mirrored by <code>circuit_breaker_transitions_total{"{target, from, to}"}</code>.</li>
          <li>Audit queue backpressure — when the bounded channel fills, events drop and <code>audit_dropped_total</code> increments.</li>
          <li>Idempotency fence mismatches — stale writers rejected after lease reclaim.</li>
        </ul>

        <RLCallout variant="info" title="Logs complement metrics, not replace them">
          Volume questions ("how many 429s per second?") belong in Prometheus via <code>rate_limiter_requests_total{"{handler, allowed}"}</code>. Logs answer "which gateway opened its circuit at 14:32 and for which tenant?"
          <span style={{ display: "block", marginTop: 8 }}><RLEvidenceBadge type="SOURCE-PROVEN" /></span>
        </RLCallout>

        <h2 className="guide-sub-heading" id="json-log">JSON Log Output Example</h2>
        <p>Raw sidecar output for a circuit breaker transition:</p>
        <RLSourceExcerpt
          source="Example structured log (circuit breaker transition)"
          language="json"
          establishes="JSON single-line format with time, level, msg, state fields, and correlation IDs."
        >{`{
  "time": "2026-07-10T13:52:11.902Z",
  "level": "INFO",
  "msg": "circuit breaker state transition",
  "component": "circuit_breaker",
  "operation": "state_change",
  "target": "central-limiter",
  "prev_state": "closed",
  "new_state": "open",
  "request_id": "req-9882a-bc91",
  "trace_id": "4fa88d01bc1d283"
}`}</RLSourceExcerpt>

        <RLRelatedPages pages={[
          { slug: "overview", section: "observability", title: "Overview", note: "Three pillars overview" },
          { slug: "incident-correlation", section: "observability", title: "Incident Correlation", note: "Log query workflow during outages" },
          { slug: "circuit-breaker", section: "resilience", title: "Circuit Breaker", note: "State machine that generates transition logs" },
          { slug: "failure-model", section: "resilience", title: "Failure Model", note: "audit_dropped_total backpressure signal" }
        ]} />
      </div>
    )
  },

  "metrics-and-prometheus": {
    title: "Metrics & Prometheus",
    topics: [
      { label: "Core metric families", href: "#metric-names" },
      { label: "Cardinality control", href: "#cardinality" },
      { label: "Prometheus scrape config", href: "#prometheus-config" },
      { label: "Example PromQL", href: "#promql" }
    ],
    content: (
      <div>
        <RLThesis>
          Prometheus metrics are registered in <code>internal/metrics/metrics.go</code> with deliberately low-cardinality labels. Request volume uses <code>allowed</code> (boolean), <strong style={{ color: "#ff5cad" }}>not</strong> a <code>decision</code> label. Circuit state is a numeric gauge per <code>target</code>. Routing health exposes gateway scores and failover decisions for multi-upstream deployments.
        </RLThesis>

        <RLQuickModel>
          Limiter exposes quota and Redis latency histograms. Sidecar exposes cache hit/miss counters and routing metrics. Both share circuit breaker and idempotency counters. Prometheus scrapes <code>limiter:8080</code> and <code>sidecar:9090</code> every 15 seconds per <code>deploy/prometheus/prometheus.yml</code>.
        </RLQuickModel>

        <h2 className="guide-sub-heading" id="metric-names">Core Metric Families</h2>
        <p>
          Verified metric names and labels from <code>internal/metrics/metrics.go</code>:{" "}
          <RLEvidenceBadge type="SOURCE-PROVEN" />
        </p>
        <div style={{ overflowX: "auto", margin: "20px 0" }}>
          <table className="guide-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #27272a", textAlign: "left" }}>
                <th style={{ padding: "12px 8px" }}>Metric</th>
                <th style={{ padding: "12px 8px" }}>Type</th>
                <th style={{ padding: "12px 8px" }}>Labels</th>
                <th style={{ padding: "12px 8px" }}>Description</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["rate_limiter_requests_total", "Counter", "handler, allowed", "Total quota checks. allowed=false indicates rate-limited (429)."],
                ["rate_limiter_requests_duration_seconds", "Histogram", "handler", "End-to-end handler latency from request receipt to response."],
                ["rate_limiter_redis_duration_seconds", "Histogram", "(none)", "Redis Lua script round-trip latency. High p99 signals Redis overload."],
                ["rate_limiter_sidecar_cache_hits_total", "Counter", "(none)", "Denials served from process-local cache without limiter call."],
                ["rate_limiter_sidecar_cache_misses_total", "Counter", "(none)", "Cache misses requiring limiter round-trip."],
                ["idempotency_claims_total", "Counter", "result", "Idempotency claim outcomes (executed, replayed, in_flight, mismatch)."],
                ["circuit_breaker_state", "Gauge", "target", "Numeric state: 0=closed, 1=open, 2=half_open."],
                ["circuit_breaker_transitions_total", "Counter", "target, from, to", "State machine transitions for alerting on flapping."],
                ["audit_dropped_total", "Counter", "(none)", "Audit events dropped when bounded async queue is full."],
                ["routing_decisions_total", "Counter", "gateway, failover", "Gateway selection decisions including failover events."],
                ["routing_outcomes_total", "Counter", "(none)", "Upstream forward outcomes aggregated across gateways."],
                ["routing_gateway_health_score", "Gauge", "gateway", "Current health score per registered gateway (0–1)."]
              ].map(([name, type, labels, desc]) => (
                <tr key={name} style={{ borderBottom: "1px solid #27272a" }}>
                  <td style={{ padding: "12px 8px", fontFamily: "monospace", color: "#ff5cad", fontSize: 11 }}>{name}</td>
                  <td style={{ padding: "12px 8px", fontFamily: "monospace", fontSize: 11 }}>{type}</td>
                  <td style={{ padding: "12px 8px", fontFamily: "monospace", fontSize: 11, color: "#a1a1aa" }}>{labels}</td>
                  <td style={{ padding: "12px 8px", color: "#a1a1aa", lineHeight: 1.5 }}>{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <RLCallout variant="warning" title="Label naming: allowed, not decision">
          Earlier documentation incorrectly referenced a <code>decision</code> label. The registered counter uses <code>allowed</code> (boolean string). PromQL filters must use <code>rate_limiter_requests_total{"{allowed=\"false\"}"}</code> for denial rate, not <code>decision="denied"</code>.
          <span style={{ display: "block", marginTop: 8 }}><RLEvidenceBadge type="SOURCE-PROVEN" /></span>
        </RLCallout>

        <h2 className="guide-sub-heading" id="cardinality">Cardinality Control</h2>
        <RLCallout variant="limitation" title="Cardinality safety">
          High-cardinality labels (user IDs, request IDs, tenant IDs as metric labels) are strictly excluded. Including them would generate millions of unique time series and crash Prometheus. Per-user visibility belongs in the audit log and OpenTelemetry traces, not time-series labels.
          <span style={{ display: "block", marginTop: 8 }}><RLEvidenceBadge type="DOCUMENTED LIMITATION" /></span>
        </RLCallout>
        <p>Safe label dimensions in this codebase:</p>
        <ul className="guide-bullets-list">
          <li><code>handler</code> — bounded set of HTTP handler names (<code>/check</code>, <code>/check_hierarchical</code>, etc.).</li>
          <li><code>target</code> — well-known circuit targets (<code>redis</code>, <code>central-limiter</code>) plus registered gateway IDs.</li>
          <li><code>gateway</code> — registered upstream gateway identifiers from routing config.</li>
          <li><code>allowed</code>, <code>result</code>, <code>from</code>, <code>to</code>, <code>failover</code> — low-cardinality enumerations.</li>
        </ul>

        <h2 className="guide-sub-heading" id="prometheus-config">Prometheus Scrape Config</h2>
        <p>
          From <code>deploy/prometheus/prometheus.yml</code>:
        </p>
        <RLSourceExcerpt
          source="deploy/prometheus/prometheus.yml"
          language="yaml"
          establishes="Scrape targets limiter:8080 and sidecar:9090 on /metrics path, 15s interval."
        >{`scrape_configs:
  - job_name: rate-limiter
    static_configs:
      - targets:
          - limiter:8080   # limiter /metrics
          - sidecar:9090   # sidecar /metrics
    metrics_path: /metrics
    scrape_interval: 15s
    # If METRICS_REQUIRE_AUTH=true:
    authorization:
      credentials: "\${INTERNAL_API_KEY}"`}</RLSourceExcerpt>

        <h2 className="guide-sub-heading" id="promql">Example PromQL Queries</h2>
        <ul className="guide-bullets-list">
          <li><strong>Denial rate:</strong> <code>sum(rate(rate_limiter_requests_total{"{allowed=\"false\"}"}[5m])) / sum(rate(rate_limiter_requests_total[5m]))</code></li>
          <li><strong>Redis p99:</strong> <code>histogram_quantile(0.99, sum(rate(rate_limiter_redis_duration_seconds_bucket[5m])) by (le))</code></li>
          <li><strong>Circuit open:</strong> <code>circuit_breaker_state == 1</code></li>
          <li><strong>Cache effectiveness:</strong> <code>rate(rate_limiter_sidecar_cache_hits_total[5m]) / (rate(rate_limiter_sidecar_cache_hits_total[5m]) + rate(rate_limiter_sidecar_cache_misses_total[5m]))</code></li>
          <li><strong>Audit backpressure:</strong> <code>increase(audit_dropped_total[5m]) &gt; 0</code></li>
        </ul>

        <RLRelatedPages pages={[
          { slug: "grafana-dashboard", section: "observability", title: "Grafana Dashboard", note: "Panel layout using these metrics" },
          { slug: "distributed-tracing", section: "observability", title: "Distributed Tracing", note: "Per-request latency complement to histograms" },
          { slug: "denial-cache-and-singleflight", section: "resilience", title: "Denial Cache & Singleflight", note: "Cache hit/miss metric semantics" },
          { slug: "intelligent-routing", section: "request-routing", title: "Intelligent Routing", note: "routing_* metric context" }
        ]} />
      </div>
    )
  },

  "grafana-dashboard": {
    title: "Grafana Dashboard",
    topics: [
      { label: "Dashboard layout", href: "#dashboard" },
      { label: "Key panels", href: "#panels" },
      { label: "Recommended alerts", href: "#alerts" }
    ],
    content: (
      <div>
        <RLThesis>
          The Grafana dashboard consolidates verified Prometheus metrics into three operational layers: system health (RPS, latency, Redis), rate limiting (allowed vs denied split), and resilience (circuit state, idempotency claims, routing health). Every panel query uses label names from <code>internal/metrics/metrics.go</code> — especially <code>allowed</code>, not the deprecated <code>decision</code> label.
        </RLThesis>

        <RLQuickModel>
          Top row: RPS and p99 handler latency. Middle row: allowed/denied stacked area + Redis p99 + cache hit ratio. Bottom row: circuit breaker gauges per target, idempotency claim breakdown, gateway health scores.
        </RLQuickModel>

        <h2 className="guide-sub-heading" id="dashboard">Dashboard Layout</h2>
        <ol className="guide-bullets-list" style={{ listStyleType: "decimal" }}>
          <li><strong>System Health:</strong> <code>rate_limiter_requests_duration_seconds</code> p50/p99 by handler, <code>rate_limiter_redis_duration_seconds</code> p99, total RPS.</li>
          <li><strong>Rate Limiting:</strong> <code>rate_limiter_requests_total</code> split by <code>allowed</code> label — visualizes enforcement pressure without conflating 429 with errors.</li>
          <li><strong>Resilience & Routing:</strong> <code>circuit_breaker_state</code> per <code>target</code>, <code>idempotency_claims_total</code> by <code>result</code>, <code>routing_gateway_health_score</code> and <code>routing_decisions_total</code>.</li>
        </ol>

        <h2 className="guide-sub-heading" id="panels">Key Panels</h2>
        <div style={{ overflowX: "auto", margin: "20px 0" }}>
          <table className="guide-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #27272a", textAlign: "left" }}>
                <th style={{ padding: "12px 8px" }}>Panel</th>
                <th style={{ padding: "12px 8px" }}>Metric Source</th>
                <th style={{ padding: "12px 8px" }}>Purpose</th>
                <th style={{ padding: "12px 8px" }}>Evidence</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["RPS Split (allowed vs denied)", "rate_limiter_requests_total{allowed}", "Stacked area: allowed=true (forwarded) vs allowed=false (429)", "SOURCE-PROVEN"],
                ["Handler p99 Latency", "rate_limiter_requests_duration_seconds{handler}", "Identifies slow handlers independent of Redis", "SOURCE-PROVEN"],
                ["Redis p99", "rate_limiter_redis_duration_seconds", "Warns of master congestion before circuit opens", "SOURCE-PROVEN"],
                ["Denial Cache Hit Ratio", "sidecar_cache_hits / (hits + misses)", "Measures process-local shield effectiveness", "SOURCE-PROVEN"],
                ["Circuit State Gauge", "circuit_breaker_state{target}", "Per-target 0/1/2 state with color thresholds", "SOURCE-PROVEN"],
                ["Gateway Health", "routing_gateway_health_score{gateway}", "Routing mode upstream selection quality", "SOURCE-PROVEN"],
                ["Audit Drops", "audit_dropped_total", "Backpressure signal — audit queue falling behind", "SOURCE-PROVEN"]
              ].map(([panel, metric, purpose, evidence]) => (
                <tr key={panel} style={{ borderBottom: "1px solid #27272a" }}>
                  <td style={{ padding: "12px 8px", fontWeight: "bold" }}>{panel}</td>
                  <td style={{ padding: "12px 8px", fontFamily: "monospace", fontSize: 11, color: "#ff5cad" }}>{metric}</td>
                  <td style={{ padding: "12px 8px", color: "#a1a1aa" }}>{purpose}</td>
                  <td style={{ padding: "12px 8px" }}><RLEvidenceBadge type={evidence} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <RLStatGrid stats={[
          { value: "0/1/2", label: "circuit_breaker_state encoding (closed/open/half_open)", evidence: "SOURCE-PROVEN" },
          { value: "15s", label: "Prometheus scrape interval", evidence: "SOURCE-PROVEN" },
          { value: "0–1", label: "routing_gateway_health_score range", evidence: "SOURCE-PROVEN" }
        ]} />

        <h2 className="guide-sub-heading" id="alerts">Recommended Alerts</h2>
        <RLCallout variant="warning" title="Alert rules tied to verified metrics">
          <ul style={{ margin: "8px 0 0", paddingLeft: 20, lineHeight: 1.7 }}>
            <li><code>circuit_breaker_state{"{target=\"redis\"}"} == 1</code> — circuit open, page immediately.</li>
            <li><code>sum(rate(rate_limiter_requests_total{"{allowed=\"false\"}"}[5m])) / sum(rate(rate_limiter_requests_total[5m])) &gt; 0.25</code> — denial rate exceeds 25%.</li>
            <li><code>histogram_quantile(0.99, sum(rate(rate_limiter_redis_duration_seconds_bucket[5m])) by (le)) &gt; 0.05</code> — Redis p99 &gt; 50 ms.</li>
            <li><code>increase(audit_dropped_total[5m]) &gt; 0</code> — audit pipeline backpressure.</li>
            <li><code>increase(circuit_breaker_transitions_total[10m]) &gt; 5</code> — circuit flapping.</li>
          </ul>
          <span style={{ display: "block", marginTop: 8 }}><RLEvidenceBadge type="SOURCE-PROVEN" /></span>
        </RLCallout>

        <RLRelatedPages pages={[
          { slug: "metrics-and-prometheus", section: "observability", title: "Metrics & Prometheus", note: "Full metric catalog and PromQL" },
          { slug: "incident-correlation", section: "observability", title: "Incident Correlation", note: "From alert to root cause" },
          { slug: "throughput-and-saturation", section: "performance-lab", title: "Throughput & Saturation", note: "Benchmark baselines for latency panels" },
          { slug: "circuit-breaker", section: "resilience", title: "Circuit Breaker", note: "State machine behind circuit_* metrics" }
        ]} />
      </div>
    )
  },

  "incident-correlation": {
    title: "Incident Correlation",
    topics: [
      { label: "Correlation workflow", href: "#workflow" },
      { label: "Debugging example", href: "#debugging" },
      { label: "Metric-to-log mapping", href: "#mapping" }
    ],
    content: (
      <div>
        <RLThesis>
          Incident response requires pivoting across all three telemetry pillars with verified field names. Start from a client <code>request_id</code>, find matching <code>log/slog</code> JSON, extract <code>trace_id</code> for Jaeger, then confirm the hypothesis against Prometheus panels using metrics from <code>internal/metrics/metrics.go</code> — never guessing at label names like <code>decision</code>.
        </RLThesis>

        <RLQuickModel>
          Alert fires on <code>circuit_breaker_state == 1</code> → check <code>circuit_breaker_transitions_total</code> for flapping → pull structured logs for <code>target</code> and <code>prev_state</code>/<code>new_state</code> → open Jaeger trace showing <code>limiter.redis_evalsha</code> latency spike → confirm <code>rate_limiter_redis_duration_seconds</code> p99 elevated.
        </RLQuickModel>

        <h2 className="guide-sub-heading" id="workflow">Incident Correlation Workflow</h2>
        <p>
          When a client reports intermittent checkout failures, execute this checklist:
        </p>
        <DocsMermaid chart={incidentWorkflow} />

        <h2 className="guide-sub-heading" id="debugging">Debugging Example</h2>
        <p>
          A tenant reports sporadic 503 responses during peak traffic. The operator workflow:
        </p>
        <ol className="guide-bullets-list" style={{ listStyleType: "decimal" }}>
          <li><strong>Grafana:</strong> <code>circuit_breaker_state{"{target=\"central-limiter\"}"}</code> shows value <code>1</code> (open). <code>rate_limiter_redis_duration_seconds</code> p99 spiked to 120 ms.</li>
          <li><strong>Logs:</strong> Query <code>component="circuit_breaker" AND target="central-limiter"</code>. Find transition log with <code>prev_state=closed</code>, <code>new_state=open</code>, <code>request_id=req-51a37c</code>.</li>
          <li><strong>Traces:</strong> Search Jaeger for <code>trace_id</code> from the log. Span <code>limiter.redis_evalsha</code> shows 1,000 ms block; parent span status is <em>not</em> marked error (infrastructure timeout, not 429).</li>
          <li><strong>Metrics confirm:</strong> <code>increase(circuit_breaker_transitions_total{"{target=\"central-limiter\",to=\"open\"}"}[5m])</code> incremented. Concurrently <code>audit_dropped_total</code> flat — audit pipeline healthy.</li>
        </ol>

        <RLCallout variant="info" title="Distinguish 429 from infrastructure errors">
          If the client saw 429, check <code>rate_limiter_requests_total{"{allowed=\"false\"}"}</code> and denial cache metrics — not circuit breaker state. A 429 span in Jaeger carries <code>http.status_code=429</code> without error status. A 503 during circuit open carries error status on the infrastructure span.
          <span style={{ display: "block", marginTop: 8 }}><RLEvidenceBadge type="SOURCE-PROVEN" /></span>
        </RLCallout>

        <h2 className="guide-sub-heading" id="mapping">Metric-to-Log Field Mapping</h2>
        <div style={{ overflowX: "auto", margin: "20px 0" }}>
          <table className="guide-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #27272a", textAlign: "left" }}>
                <th style={{ padding: "12px 8px" }}>Prometheus Metric</th>
                <th style={{ padding: "12px 8px" }}>Log Field(s)</th>
                <th style={{ padding: "12px 8px" }}>Trace Span</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["circuit_breaker_state / circuit_breaker_transitions_total", "target, prev_state, new_state", "sidecar.handle_request"],
                ["rate_limiter_requests_total{allowed}", "(no per-request log)", "limiter.check_rate_limit"],
                ["rate_limiter_redis_duration_seconds", "(no per-request log)", "limiter.redis_evalsha"],
                ["rate_limiter_sidecar_cache_hits_total", "operation=denial_cache", "sidecar.handle_request"],
                ["idempotency_claims_total{result}", "idempotency.key, idempotency.status", "sidecar.check_idempotency"],
                ["audit_dropped_total", "component=audit, msg=queue full", "limiter.check_rate_limit"],
                ["routing_decisions_total / routing_outcomes_total", "gateway, failover", "sidecar.forward_upstream"],
                ["routing_gateway_health_score", "gateway", "sidecar.forward_upstream"]
              ].map(([metric, logField, span]) => (
                <tr key={metric} style={{ borderBottom: "1px solid #27272a" }}>
                  <td style={{ padding: "12px 8px", fontFamily: "monospace", fontSize: 11, color: "#ff5cad" }}>{metric}</td>
                  <td style={{ padding: "12px 8px", fontFamily: "monospace", fontSize: 11, color: "#a1a1aa" }}>{logField}</td>
                  <td style={{ padding: "12px 8px", fontFamily: "monospace", fontSize: 11, color: "#a1a1aa" }}>{span}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <RLRelatedPages pages={[
          { slug: "overview", section: "observability", title: "Overview", note: "Three pillars introduction" },
          { slug: "distributed-tracing", section: "observability", title: "Distributed Tracing", note: "Span names and 429 semantics" },
          { slug: "structured-logging", section: "observability", title: "Structured Logging", note: "Log field schema" },
          { slug: "metrics-and-prometheus", section: "observability", title: "Metrics & Prometheus", note: "Verified metric catalog" },
          { slug: "failure-model", section: "resilience", title: "Failure Model", note: "Failure modes that generate alerts" }
        ]} />
      </div>
    )
  }
};

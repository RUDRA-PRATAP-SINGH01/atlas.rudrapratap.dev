import React from "react";
import DocsMermaid from "@/features/docs/components/DocsMermaid";

export const observabilityPages = {
  "overview": {
    title: "Overview",
    topics: [
      { label: "Telemetry pillars", href: "#pillars" },
      { label: "Correlation ID mapping", href: "#correlation" }
    ],
    content: (
      <div>
        <p>
          Managing high-throughput systems requires structured, correlated telemetry across all execution layers.
        </p>

        <h2 className="guide-sub-heading" id="pillars">Telemetry Pillars</h2>
        <ul className="guide-bullets-list">
          <li><strong>Metrics (Prometheus):</strong> Aggregates system metrics (RPS, errors, latencies, circuit states, audit queue size). Used for dashboards and alerting.</li>
          <li><strong>Distributed Tracing (OpenTelemetry):</strong> Tracks request pathways across sidecars, limiters, and upstreams. Provides high-fidelity latency analysis.</li>
          <li><strong>Structured Logs (slog):</strong> Emits structured JSON logs containing correlation IDs (Request IDs, Trace IDs) to support search indexing and log parsing.</li>
        </ul>

        <h2 className="guide-sub-heading" id="correlation">Correlation ID Mapping</h2>
        <p>
          To trace an execution path, the sidecar generates a unique `X-Request-ID` UUID for every inbound call. This ID is propagated through headers to downstreams, matching spans in Jaeger and log entries in Elasticsearch or Loki.
        </p>
      </div>
    )
  },

  "distributed-tracing": {
    title: "Distributed Tracing",
    topics: [
      { label: "OpenTelemetry Setup", href: "#setup" },
      { label: "Span Hierarchy", href: "#hierarchy" },
      { label: "429 Error Semantics", href: "#span-errors" }
    ],
    content: (
      <div>
        <p>
          Distributed tracing tracks execution pathways, capturing trace states across microservice boundaries.
        </p>

        <h2 className="guide-sub-heading" id="setup">OpenTelemetry Setup</h2>
        <p>
          Stateless limiters and sidecars initialize the OpenTelemetry SDK on startup. The services establish trace exports to a central collector (like Jaeger) and implement W3C tracecontext propagation.
        </p>

        <h2 className="guide-sub-heading" id="hierarchy">Span Hierarchy</h2>
        <p>
          A single API call generates a nested span tree:
        </p>
        <DocsMermaid chart={`
gantt
    title Trace Span Timeline
    dateFormat  X
    axisFormat %L ms
    section Sidecar Proxy
    sidecar.proxy :active, 0, 15
    section Limiter RPC
    limiter.check : 2, 7
    section Redis Lua
    redis.lua : 3, 6
    section Upstream API
    upstream.forward : 8, 14
        `} />

        <h2 className="guide-sub-heading" id="span-errors">429 Status Semantics</h2>
        <div style={{
          background: "rgba(234, 179, 8, 0.05)",
          border: "1px solid rgba(234, 179, 8, 0.2)",
          borderRadius: 8,
          padding: 16,
          marginTop: 16
        }}>
          <strong>Correct Span Status:</strong> A rate-limiting rejection (`429 Too Many Requests`) is expected business logic, not a server infrastructure crash. Therefore, spans representing a 429 write back the status code but are **not** marked as errored in the trace system, keeping alert statistics clean.
        </div>
      </div>
    )
  },

  "structured-logging": {
    title: "Structured Logging",
    topics: [
      { label: "Go slog Engine", href: "#slog" },
      { label: "Log Structuring", href: "#fields" },
      { label: "State Transition Logging", href: "#transitions" }
    ],
    content: (
      <div>
        <p>
          Structured logs enable automated log aggregation, parsing, and searching across high-throughput services.
        </p>

        <h2 className="guide-sub-heading" id="slog">Go slog Engine</h2>
        <p>
          The system uses Go's structured logging package (`char/slog`) configured with a JSON handler. This formats all log records as structured single-line JSON maps, ready for parsing by aggregators.
        </p>

        <h2 className="guide-sub-heading" id="fields">Log Structuring</h2>
        <p>
          To maintain utility, log structures enforce key-value fields:
        </p>
        <ul className="guide-bullets-list">
          <li>`request_id`: Traces request executions across nodes.</li>
          <li>`trace_id`: Correlates log statements directly with traces.</li>
          <li>`component` / `operation`: Categorizes where the log statement originated (e.g. `limiter`, `idempotency_store`).</li>
        </ul>

        <h2 className="guide-sub-heading" id="transitions">State Transition Logging</h2>
        <p>
          To protect disk storage and avoid performance degradation, logs are kept clean. Standard checks do not write logs. System logs are reserved for transition events, such as a circuit breaker changing state (`Closed` &rarr; `Open`), warning operators of potential issues.
        </p>
      </div>
    )
  },

  "metrics-and-prometheus": {
    title: "Metrics & Prometheus",
    topics: [
      { label: "Metric Names", href: "#metric-names" },
      { label: "Cardinality Control", href: "#cardinality" }
    ],
    content: (
      <div>
        <p>
          Prometheus metrics monitor rate checking frequency, errors, and system state changes.
        </p>

        <h2 className="guide-sub-heading" id="metric-names">Core Metric Families</h2>
        <ul className="guide-bullets-list">
          <li>`rate_limiter_requests_total`: Counter tracking total quota checks, labeled by `decision` (`allowed`/`denied`) and `handler`.</li>
          <li>`rate_limiter_redis_duration_seconds`: Histogram tracking Redis Lua script execution latency.</li>
          <li>`circuit_breaker_state`: Gauge indicating the active circuit state (`0=closed`, `1=open`, `2=half_open`).</li>
          <li>`audit_dropped_events_total`: Counter tracking events dropped due to async queue overflows.</li>
        </ul>

        <h2 className="guide-sub-heading" id="cardinality">Cardinality Control</h2>
        <div style={{
          background: "rgba(239, 68, 68, 0.05)",
          border: "1px solid rgba(239, 68, 68, 0.2)",
          borderRadius: 8,
          padding: 16,
          marginTop: 16
        }}>
          <strong>Cardinality Safety:</strong> High cardinality labels (like User IDs or Request IDs) are strictly excluded from Prometheus metrics. Including them would generate millions of unique time series, crashing Prometheus servers. User-specific traces are reserved for OpenTelemetry.
        </div>
      </div>
    )
  },

  "grafana-dashboard": {
    title: "Grafana Dashboard",
    topics: [
      { label: "Dashboard Layout", href: "#dashboard" },
      { label: "Key Panels", href: "#panels" }
    ],
    content: (
      <div>
        <p>
          The Grafana dashboard consolidates Prometheus metrics to provide real-time operational visibility.
        </p>

        <h2 className="guide-sub-heading" id="dashboard">Dashboard Layout</h2>
        <p>
          The dashboard is organized into logical layers:
        </p>
        <ol className="guide-bullets-list">
          <li><strong>System Health:</strong> Focuses on RPS, server error rates, and p99 proxy latency.</li>
          <li><strong>Rate Limiting:</strong> Visualizes allowed vs. denied requests, identifying active quota limit triggers.</li>
          <li><strong>Resilience:</strong> Traces circuit breaker state changes and idempotency claim statistics.</li>
        </ol>

        <h2 className="guide-sub-heading" id="panels">Key Panels</h2>
        <ul className="guide-bullets-list">
          <li><strong>RPS Split:</strong> Stacked area chart showing allowed (200) vs rate-limited (429) requests.</li>
          <li><strong>Redis Latency (p99):</strong> Monitors database response time, warning of master congestion.</li>
          <li><strong>Circuit State Gauge:</strong> Highlights active circuit health per target gateway.</li>
        </ul>
      </div>
    )
  },

  "incident-correlation": {
    title: "Incident Correlation",
    topics: [
      { label: "Seeded Outage Workflow", href: "#workflow" },
      { label: "Debugging Paths", href: "#debugging" }
    ],
    content: (
      <div>
        <p>
          Correlating telemetry allows operators to diagnose and resolve incidents quickly.
        </p>

        <h2 className="guide-sub-heading" id="workflow">Incident Correlation Workflow</h2>
        <p>
          If a client reports intermittent checkout failures, an operator executes the following troubleshooting checklist:
        </p>
        <DocsMermaid chart={`
flowchart LR
    ID[1. Extract Request ID] --> Log[2. Query JSON logs]
    Log --> Trace[3. Find Trace ID]
    Trace --> Jaeger[4. Trace Jaeger Spans]
    Jaeger --> Redis[5. Identify Redis Latency/CB Open]
    style ID fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style Log fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style Trace fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style Jaeger fill:#1e1e2e,stroke:#ff5cad,color:#fff
        `} />

        <h2 className="guide-sub-heading" id="debugging">Diagnosis Example</h2>
        <p>
          Querying the logs for `request_id = "51a37c"` reveals a timeout error: `redis client timeout: connection deadline exceeded`. The log entry contains a `trace_id = "t_88a"`.
        </p>
        <p>
          Loading the trace in Jaeger shows a 1,000 ms block in `redis.lua` followed by a `503 Service Unavailable` returned by the sidecar. The corresponding Prometheus panel reveals a latency spike, confirming a temporary database outage.
        </p>
      </div>
    )
  }
};

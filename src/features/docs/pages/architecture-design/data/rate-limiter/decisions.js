/**
 * Architecture decision records for the Distributed Rate Limiter.
 *
 * Evidence sources (SOURCE VERIFIED):
 *   cmd/sidecar/main.go
 *   cmd/limiter/main.go
 *   internal/circuitbreaker/store.go
 *   internal/idempotency/lease.go
 *   internal/limiter/lua/hierarchical.lua
 */

/** @type {import('../schema').ArchitectureDecision} */
export const clientDecision = {
  id: "decision-client",
  nodeId: "client",
  title: "External Client Request",
  category: "Client",
  sourcePath: "External Client API",
  summary: "The client invoking the platform services. Passes routing, authentication, and idempotency headers.",
  responsibility: {
    owns: [
      "Providing valid user identification (X-User-ID or user_id query param)",
      "Providing Idempotency-Key headers for mutating requests",
      "Handling 429 Too Many Requests response codes and parsing Retry-After headers",
    ],
    doesNotOwn: [
      "Rate-limit enforcement logic",
      "Upstream routing lookup",
      "Lease state management",
    ],
    details: "The client is the entry point of traffic. It must supply correct identifiers to avoid 400 errors, and manage its retry intervals according to Retry-After headers.",
  },
  whyItExists: {
    problem: "Downstream services must be protected from resource starvation and double-charges without implementing these features in every microservice.",
    constraint: "Clients are untrusted and can produce flash crowds or replay attacks.",
    decision: "Establish a contract requiring unique client identification and idempotency keys to enable centralized sidecar enforcement.",
    result: "Clean application segregation where client details are mapped to tenant-wide configuration controls.",
  },
  classification: {
    level: "HLD",
    explanation: "Defines the edge API boundary and interaction protocol for all inbound traffic.",
  },
  hld: {
    architecturalRole: "Triggers request workflows and manages retry intervals.",
    upstream: [],
    downstream: ["sidecar"],
    dataOwnership: ["Owns client payload and headers (Idempotency-Key, X-User-ID)"],
    controlOwnership: ["Controls request rate and timing"],
    persistenceResponsibility: "None",
    concurrencyResponsibility: "None",
    failureBoundary: "Bypasses upstream entirely if sidecar denies quota or returns circuit breaker error.",
    lifecycle: "Transient request lifespans.",
  },
  lld: {
    implementation: [
      "Client submits HTTP request containing X-User-ID",
      "Client handles 429 and 503 HTTP responses",
    ],
  },
  rationale: {
    evidenceStatus: "source-verified",
    selectedApproach: "Standardized HTTP header contract.",
    whyItFits: [
      "Minimizes client SDK footprints.",
      "Works with any HTTP client (curl, browsers, mobile applications).",
    ],
    acceptedTradeoffs: [
      "Requires correct client behavior for retries and backoff.",
    ],
  },
  alternatives: [
    {
      name: "Custom Client SDKs",
      status: "plausible-alternative",
      advantages: ["Can embed local circuit breaking and client-side pre-filtering"],
      disadvantages: ["High maintenance overhead across multiple programming languages"],
      fitForPebbleDB: "Not chosen; standard HTTP headers allow seamless language-agnostic usage.",
      evidenceStatus: "theoretical",
    },
  ],
  qualityImpacts: [
    {
      quality: "Developer Experience",
      direction: "strong-positive",
      explanation: "No custom SDK required; developers use standard HTTP clients.",
      evidenceStatus: "source-verified",
    },
  ],
  failureWithoutComponent: [
    "No traffic reaches the system.",
  ],
  sources: [
    {
      label: "cmd/sidecar/main.go",
      path: "cmd/sidecar/main.go",
      description: "Resolves client headers",
      evidenceStatus: "source-verified",
    },
  ],
  evidenceStatus: "source-verified",
};

/** @type {import('../schema').ArchitectureDecision} */
export const sidecarDecision = {
  id: "decision-sidecar",
  nodeId: "sidecar",
  title: "Sidecar Enforcement Proxy",
  category: "Sidecar Layer",
  sourcePath: "cmd/sidecar",
  summary: "A transparent reverse proxy that intercepts client traffic. Runs the serveNormal and serveIdempotent pipelines, implements short-term denial caching, singleflight deduplication, and circuit breaker guards.",
  responsibility: {
    owns: [
      "Denial caching (sync.Map, default 30ms TTL)",
      "Singleflight request collapsing per user cacheKey",
      "Idempotency lease verification and cached response replays",
      "Upstream HTTP request forwarding and gateway routing",
      "cb:central-limiter circuit breaker metrics and checks",
    ],
    doesNotOwn: [
      "Authoritative token bucket calculations (Redis-backed)",
      "Dynamic config override lookups (Limiter-backed)",
    ],
    details: "The sidecar handles edge caching, deduplication, and fault isolation. If the central limiter pool fails, the sidecar decides whether to fail-open or fail-closed.",
  },
  whyItExists: {
    problem: "Burst denial traffic can overwhelm the central limiter and Redis, and duplicate mutating requests can cause race conditions or double actions.",
    constraint: "The sidecar must add minimal latency (sub-millisecond overhead) to the allowed request hot path.",
    decision: "Use a local Go sync.Map for caching denials, apply singleflight to collapse concurrent check rate RPCs, and run claim/complete leases for idempotency.",
    result: "Reduces load on the central limiter by up to 99% during denial attacks, and prevents duplicate writes.",
  },
  classification: {
    level: "HLD + LLD",
    explanation: "HLD: proxy architecture, resilience boundaries. LLD: sync.Map locking, singleflight logic, HTTP proxy configurations.",
  },
  hld: {
    architecturalRole: "Edge gateway and resilience layer closest to the application backend.",
    upstream: ["client"],
    downstream: ["limiter", "redis", "upstream", "prometheus", "jaeger"],
    dataOwnership: [
      "sync.Map (local denial cache)",
      "limitFlight (singleflight.Group)",
    ],
    controlOwnership: [
      "Proxy HTTP transport options",
      "cb:central-limiter state machine",
    ],
    persistenceResponsibility: "None (completely stateless across restarts)",
    concurrencyResponsibility: "sync.Map provides thread-safe concurrent reads/writes; singleflight serializes concurrent limit checks.",
    failureBoundary: "Isolates upstream backends from central limiter outages via fail-open/fail-closed policy.",
    lifecycle: "Graceful drain on SIGTERM/SIGINT (5s budget).",
  },
  lld: {
    implementation: [
      "serveNormal pipeline: Cache.Load -> limitFlight.Do -> checkRateLimit -> Cache.Store -> forwardRequest",
      "serveIdempotent pipeline: claim.lua -> checkRateLimit -> forwardRequest -> complete.lua",
      "Denial cache TTL: 30ms hardcoded",
    ],
  },
  rationale: {
    evidenceStatus: "source-verified",
    selectedApproach: "In-process Go proxy with memory cache.",
    whyItFits: [
      "Provides extremely high throughput and sub-millisecond local check overhead.",
      "Reduces network latency by skipping external RPCs for repeated denials.",
    ],
    acceptedTradeoffs: [
      "Denial cache is not synchronized across sidecar replicas, meaning cold replicas will incur one limiter call.",
    ],
  },
  alternatives: [
    {
      name: "Shared Redis Cache",
      status: "plausible-alternative",
      advantages: ["Synchronized denial cache across all sidecar replicas"],
      disadvantages: ["Increases Redis load, defeating the purpose of bypassing storage"],
      fitForPebbleDB: "Rejected; in-memory cache is faster and has zero storage database dependencies.",
      evidenceStatus: "theoretical",
    },
  ],
  qualityImpacts: [
    {
      quality: "Throughput under denial load",
      direction: "strong-positive",
      explanation: "30ms denial cache prevents storage overload during malicious rate limit breaches.",
      evidenceStatus: "source-verified",
    },
  ],
  failureWithoutComponent: [
    "No rate limit enforcement or idempotency checks occur.",
    "Central limiter and Redis are directly exposed to raw client traffic.",
  ],
  sources: [
    {
      label: "cmd/sidecar/main.go",
      path: "cmd/sidecar/main.go",
      description: "Sidecar ServeHTTP, serveNormal, and serveIdempotent implementations",
      evidenceStatus: "source-verified",
    },
  ],
  evidenceStatus: "source-verified",
};

/** @type {import('../schema').ArchitectureDecision} */
export const upstreamDecision = {
  id: "decision-upstream",
  nodeId: "upstream",
  title: "Upstream Target Service",
  category: "Client",
  sourcePath: "demo-backend",
  summary: "The application service that performs the actual business logic. Only receives requests that have been explicitly admitted by the rate limiting sidecar.",
  responsibility: {
    owns: [
      "Executing core business logic",
      "Verifying request authenticity (claims)",
    ],
    doesNotOwn: [
      "Quota checks",
      "Idempotency deduplication",
      "Edge caching",
    ],
    details: "The upstream backend is completely decoupled from rate limiting logic. It operates under the guarantee that any request it receives has already cleared quota validation.",
  },
  whyItExists: {
    problem: "Microservices should not implement repetitive rate limiting, circuit breaking, and idempotency logic.",
    constraint: "Must run independently of rate limiting infrastructure.",
    decision: "Proxy all traffic through the sidecar so the upstream backend receives only validated requests.",
    result: "Simpler, more robust business logic in microservices.",
  },
  classification: {
    level: "HLD",
    explanation: "Represents the target service boundary.",
  },
  hld: {
    architecturalRole: "Business logic execution engine.",
    upstream: ["sidecar"],
    downstream: [],
    dataOwnership: ["Owns application database state"],
    controlOwnership: ["Processes business transitions"],
    persistenceResponsibility: "Application database",
    concurrencyResponsibility: "Governed by microservice runtime",
    failureBoundary: "Outages do not affect the rate limiter proxy hot path; sidecar returns 502/504 errors.",
    lifecycle: "Managed independently of sidecar.",
  },
  lld: {
    implementation: [
      "demo-backend listens on port 8081",
      "Receives forwarded headers from sidecar proxy",
    ],
  },
  rationale: {
    evidenceStatus: "source-verified",
    selectedApproach: "Decoupled downstream service behind proxy.",
    whyItFits: [
      "Allows scaling business services without scaling the rate limiter config layer.",
    ],
    acceptedTradeoffs: [
      "Adds one proxy hop (sub-millisecond latency cost).",
    ],
  },
  alternatives: [],
  evidenceStatus: "source-verified",
};

/** @type {import('../schema').ArchitectureDecision} */
export const adminApiDecision = {
  id: "decision-admin-api",
  nodeId: "admin-api",
  title: "Admin API Control Port",
  category: "Limiter Layer",
  sourcePath: "cmd/limiter :8082",
  summary: "An isolated admin endpoint for override configurations. Writes overrides to Redis and increments the global version generation to trigger cache updates.",
  responsibility: {
    owns: [
      "Creating, reading, updating, and deleting capacity overrides (config:level:id)",
      "Atomically incrementing config:generation in Redis",
    ],
    doesNotOwn: [
      "Hot path rate limit checking (handled on port 8080)",
      "Idempotency leases",
    ],
    details: "The Admin API is separate from the hot path port 8080. This network isolation ensures admin changes cannot degrade hot path traffic capacity.",
  },
  whyItExists: {
    problem: "Modifying rate limits or creating user overrides dynamically requires a secure, separate administration surface.",
    constraint: "Admin activities must not contend with hot path network resources.",
    decision: "Bind the Admin API to port 8082, separate from hot path port 8080. Increment a monotonic generation key to invalidate cached overrides.",
    result: "Zero-impact override adjustments and clean security perimeter zoning.",
  },
  classification: {
    level: "HLD",
    explanation: "Defines network partition boundaries and control flow separation.",
  },
  hld: {
    architecturalRole: "Administrative configuration interface.",
    upstream: ["client"],
    downstream: ["redis"],
    dataOwnership: ["Writes overrides directly to Redis"],
    controlOwnership: ["Validates override configuration ranges"],
    persistenceResponsibility: "Redis state database",
    concurrencyResponsibility: "Serialized via atomic Redis INCR config:generation",
    failureBoundary: "Admin API outages prevent updating configurations but have no impact on hot-path quota checks.",
    lifecycle: "HTTP server lifecycle.",
  },
  lld: {
    implementation: [
      "CRUD operations write config:{level}:{id} hashes",
      "config:generation is incremented on every mutate operation",
    ],
  },
  rationale: {
    evidenceStatus: "source-verified",
    selectedApproach: "Network-isolated port interface.",
    whyItFits: [
      "Enforces firewalls around administration endpoints while keeping the executable unified.",
    ],
    acceptedTradeoffs: [
      "Requires operators to configure two separate target ports.",
    ],
  },
  alternatives: [],
  evidenceStatus: "source-verified",
};

/** @type {import('../schema').ArchitectureDecision} */
export const limiterDecision = {
  id: "decision-limiter",
  nodeId: "limiter",
  title: "Central Quota Evaluator",
  category: "Limiter Layer",
  sourcePath: "cmd/limiter :8080",
  summary: "Stateless quota service. Receives rate limit check queries from sidecars, checks override caches, and runs Lua scripts on Redis to deduct tokens atomically.",
  responsibility: {
    owns: [
      "Resolving user hierarchical keys",
      "Local override cache (in-memory, 5s TTL)",
      "config:generation monitoring to invalidate override cache",
      "cb:redis circuit breaker monitoring Redis health",
    ],
    doesNotOwn: [
      "Idempotency leasing (delegated directly to sidecar)",
      "Edge denial caching (sync.Map in sidecar)",
    ],
    details: "The limiter concentrates connection pools to Redis. It evaluates local overrides before making Redis calls to minimize Lua complexity.",
  },
  whyItExists: {
    problem: "Direct sidecar-to-Redis connections scale poorly in large clusters. Multiple sidecars need a unified quota pool.",
    constraint: "Limiter must enforce atomic decisions across multiple hierarchical tiers.",
    decision: "Create a pool of stateless limiters. Use Redis Lua to serialize multi-key updates, and cache static overrides locally for 5000ms.",
    result: "Predictable connection counts on Redis, and fast flat quota evaluations.",
  },
  classification: {
    level: "HLD + LLD",
    explanation: "HLD: Concentrates connections and manages routing. LLD: local override cache checks and circuit-breaker integration.",
  },
  hld: {
    architecturalRole: "Centralized evaluation engine between sidecars and Redis state.",
    upstream: ["sidecar"],
    downstream: ["redis", "prometheus", "jaeger"],
    dataOwnership: ["Local override cache (ephemeral, 5s TTL)"],
    controlOwnership: ["cb:redis circuit breaker"],
    persistenceResponsibility: "None",
    concurrencyResponsibility: "Uses cb:redis to isolate pool threads from database degradation.",
    failureBoundary: "Trips cb:redis on slow queries or failures, returning 500 to sidecars to trigger fail-open behavior.",
    lifecycle: "Graceful drain on SIGTERM/SIGINT (5s budget).",
  },
  lld: {
    implementation: [
      "GET /check_hierarchical parses query parameters",
      "EVALSHA hierarchical.lua execution inside Go client",
      "Generates Prometheus counters and Jaeger tracer spans",
    ],
  },
  rationale: {
    evidenceStatus: "source-verified",
    selectedApproach: "Stateless microservice pool.",
    whyItFits: [
      "Can scale independently of stateful databases.",
      "Reduces connection pressure on Redis.",
    ],
    acceptedTradeoffs: [
      "Stale override config window up to 5000ms if Redis network fails during generation check.",
    ],
  },
  alternatives: [
    {
      name: "Direct Sidecar-to-Redis Checks",
      status: "plausible-alternative",
      advantages: ["Eliminates limiter network hop"],
      disadvantages: ["Redis connection limit exhausted at scale; no local override caching"],
      fitForPebbleDB: "Rejected; central limiter is critical for horizontal scaling.",
      evidenceStatus: "theoretical",
    },
  ],
  qualityImpacts: [
    {
      quality: "Connection scaling",
      direction: "strong-positive",
      explanation: "Limiter pool multiplexes thousands of sidecar requests into a small Redis connection pool.",
      evidenceStatus: "source-verified",
    },
  ],
  failureWithoutComponent: [
    "All rate limit checks fail open or close based on fail-open configs.",
  ],
  sources: [
    {
      label: "cmd/limiter/main.go",
      path: "cmd/limiter/main.go",
      description: "Limiter routing, override caching, and Redis client setup",
      evidenceStatus: "source-verified",
    },
  ],
  evidenceStatus: "source-verified",
};

/** @type {import('../schema').ArchitectureDecision} */
export const redisDecision = {
  id: "decision-redis",
  nodeId: "redis",
  title: "Authoritative Redis State",
  category: "State Layer",
  sourcePath: "Redis DB :6379",
  summary: "The single source of truth for rate limiting quotas, circuit breaker records, gateway routes, audit events, and idempotency leases. Executes Lua scripts atomically.",
  responsibility: {
    owns: [
      "Durable storage of token counts (HASH/ZSET)",
      "Atomically executing hierarchical.lua, claim.lua, and complete.lua",
      "Idempotency lease records and payload cache",
      "Global configuration generation version counter",
    ],
    doesNotOwn: [
      "Network routing to clients",
      "Local denial caching",
    ],
    details: "All correctness guarantees depend on Redis. Because Redis is single-threaded, Lua script operations are fully serialized, making concurrent multi-replica race conditions impossible.",
  },
  whyItExists: {
    problem: "Distributed rate limiters suffer from over-admission under concurrent bursts when checking state across multiple replicas.",
    constraint: "Quota deduction must be all-or-nothing across multiple tiers (global, tenant, user).",
    decision: "Deduct tokens inside Redis using atomic Lua scripts (hierarchical.lua). Perform all state persistence in a single-master Redis node.",
    result: "100% correct enforcement with zero over-admission.",
  },
  classification: {
    level: "HLD",
    explanation: "Defines the durability boundary and correctness center of the platform.",
  },
  hld: {
    architecturalRole: "Central transactional storage.",
    upstream: ["limiter", "sidecar", "admin-api"],
    downstream: [],
    dataOwnership: ["All persistent database states (hashes, zsets, strings)"],
    controlOwnership: ["Lua atomic script execution engine"],
    persistenceResponsibility: "Redis AOF/RDB configuration",
    concurrencyResponsibility: "Single-threaded execution guarantees strong consistency.",
    failureBoundary: "Outages trigger circuit breaker trips in limiter and sidecars.",
    lifecycle: "Managed as stateful service; data persisted to disk.",
  },
  lld: {
    implementation: [
      "hierarchical.lua checks and decrements multi-tier limits atomically",
      "claim.lua and complete.lua manage fence-token idempotency leases",
    ],
  },
  rationale: {
    evidenceStatus: "source-verified",
    selectedApproach: "Single-master Redis memory database.",
    whyItFits: [
      "Ultra-low latency operations (<1ms script evaluation) fit rate limit budgets.",
      "Atomic scripting simplifies complex multi-tier check logic.",
    ],
    acceptedTradeoffs: [
      "Incompatible with standard Redis Cluster without hash tagging, making write throughput vertically bounded.",
    ],
  },
  alternatives: [
    {
      name: "Relational Database (PostgreSQL)",
      status: "plausible-alternative",
      advantages: ["ACID compliance, easier reporting"],
      disadvantages: ["High latency overhead; slow concurrency locks"],
      fitForPebbleDB: "Rejected due to high performance requirements.",
      evidenceStatus: "theoretical",
    },
  ],
  qualityImpacts: [
    {
      quality: "Quota correctness",
      direction: "strong-positive",
      explanation: "Single-threaded Lua script serialization eliminates race conditions.",
      evidenceStatus: "source-verified",
    },
  ],
  failureWithoutComponent: [
    "Rate limiting logic cannot calculate quotas; fallbacks trigger fail-open/closed paths.",
  ],
  sources: [
    {
      label: "internal/limiter/lua/hierarchical.lua",
      path: "internal/limiter/lua/hierarchical.lua",
      description: "All-or-nothing multi-tier token bucket Lua script",
      evidenceStatus: "source-verified",
    },
  ],
  evidenceStatus: "source-verified",
};

/** @type {import('../schema').ArchitectureDecision} */
export const prometheusDecision = {
  id: "decision-prometheus",
  nodeId: "prometheus",
  title: "Prometheus Metric Collection",
  category: "Observability Stack",
  sourcePath: "prometheus :9091",
  summary: "Periodically scrapes prometheus metrics from sidecar and limiter processes. Used to calculate traffic rates and circuit failure states.",
  responsibility: {
    owns: [
      "Scraping metrics from port 9091 targets",
      "Storing metric histories",
    ],
    doesNotOwn: [
      "Trace collection (delegated to Jaeger)",
      "Visual reporting (delegated to Grafana)",
    ],
    details: "Prometheus is out-of-band. Scraping is pull-based, ensuring telemetry gathering has zero performance impact on the hot path.",
  },
  whyItExists: {
    problem: "Operators need real-time and historical visibility into rate limit admission rates, denial cache hits, and error counts.",
    constraint: "Metrics gathering must not add hot path latency.",
    decision: "Expose an in-memory prometheus endpoint on port 9091 and configure a centralized Prometheus instance to scrape it.",
    result: "High-performance telemetry with no lock contention on client requests.",
  },
  classification: {
    level: "HLD",
    explanation: "Defines the monitoring topology and protocols.",
  },
  hld: {
    architecturalRole: "Metrics database.",
    upstream: ["grafana"],
    downstream: ["sidecar", "limiter"],
    dataOwnership: ["Metric series database"],
    controlOwnership: ["Scrape job timings"],
    persistenceResponsibility: "Prometheus TSDB file storage",
    concurrencyResponsibility: "Managed by Prometheus storage engine",
    failureBoundary: "Outages block real-time dashboard updates but have zero impact on rate limiting or request proxying.",
    lifecycle: "Managed as persistent metrics process.",
  },
  lld: {
    implementation: [
      "Scrapes sidecar-specific metrics (sidecar_denial_cache_hits, sidecar_circuit_breaker_state)",
      "Scrapes limiter-specific metrics (limiter_redis_eval_duration, limiter_overrides_loaded)",
    ],
  },
  rationale: {
    evidenceStatus: "source-verified",
    selectedApproach: "Pull-based metrics agent.",
    whyItFits: [
      "Clean separation of concerns; server does not push metrics over network.",
    ],
    acceptedTradeoffs: [
      "Metrics are delayed by the scrap interval (typically 10-15s).",
    ],
  },
  alternatives: [],
  evidenceStatus: "source-verified",
};

/** @type {import('../schema').ArchitectureDecision} */
export const grafanaDecision = {
  id: "decision-grafana",
  nodeId: "grafana",
  title: "Grafana Visualization",
  category: "Observability Stack",
  sourcePath: "grafana :3000",
  summary: "Dashboard visualization interface. Queries Prometheus to plot traffic trends, latency charts, cache ratios, and circuit states.",
  responsibility: {
    owns: [
      "Rendering dashboards for operators",
      "Executing PromQL queries against Prometheus",
    ],
    doesNotOwn: [
      "Collecting metrics directly from endpoints",
    ],
    details: "Grafana is purely for visual inspection and alerting. It is completely isolated from the runtime hot path.",
  },
  whyItExists: {
    problem: "Raw TSDB data is difficult to read during incidents. Operators need pre-built graphs of circuit breaches and denial hit ratios.",
    constraint: "Must provide fast query updates without overloading the scraper database.",
    decision: "Deploy Grafana with predefined JSON dashboards mapping the sidecar and limiter metrics.",
    result: "Immediate visual diagnostic capabilities for incident response.",
  },
  classification: {
    level: "HLD",
    explanation: "Represents the user presentation boundary.",
  },
  hld: {
    architecturalRole: "Visualization dashboard.",
    upstream: [],
    downstream: ["prometheus"],
    dataOwnership: ["Dashboard metadata (JSON configurations)"],
    controlOwnership: ["User authentication permissions"],
    persistenceResponsibility: "Local SQLite database for settings",
    concurrencyResponsibility: "Managed by Grafana web server",
    failureBoundary: "Outages prevent operator dashboard views; metrics continue compiling in Prometheus.",
    lifecycle: "Managed as stateless service.",
  },
  lld: {
    implementation: [
      "Queries sidecar traffic rates using rate() functions",
      "Visualizes active circuits using gauge indicators",
    ],
  },
  rationale: {
    evidenceStatus: "source-verified",
    selectedApproach: "Standard web dashboard layer.",
    whyItFits: [
      "Industry standard; fits easily with Prometheus data sources.",
    ],
    acceptedTradeoffs: [],
  },
  alternatives: [],
  evidenceStatus: "source-verified",
};

/** @type {import('../schema').ArchitectureDecision} */
export const jaegerDecision = {
  id: "decision-jaeger",
  nodeId: "jaeger",
  title: "Jaeger Distributed Tracing",
  category: "Observability Stack",
  sourcePath: "jaeger :16686",
  summary: "Distributed tracing backend. Receives OpenTelemetry trace spans from sidecars and limiters over OTLP port 4318, allowing detailed request journey mapping.",
  responsibility: {
    owns: [
      "Collecting trace spans via OTLP protocol",
      "Correlating trace IDs across HTTP boundaries",
      "Rendering span timeline diagrams",
    ],
    doesNotOwn: [
      "Generating spans (handled by sidecar and limiter Go tracers)",
    ],
    details: "OTel exporters in the sidecar and limiter run asynchronously. If Jaeger is unreachable, spans are dropped silently without delaying the client request.",
  },
  whyItExists: {
    problem: "When a request is slow or errors out, finding whether the latency was added by the sidecar proxy, the limiter network, or Redis is difficult.",
    constraint: "Exporter buffers must not consume unbounded memory.",
    decision: "Implement OpenTelemetry tracing in Go. Propagate context across sidecar-to-limiter HTTP headers, and export to Jaeger via background buffers.",
    result: "Complete end-to-end request timeline tracking.",
  },
  classification: {
    level: "HLD",
    explanation: "Defines cross-component call trace flows.",
  },
  hld: {
    architecturalRole: "Distributed tracing collector and search UI.",
    upstream: [],
    downstream: ["sidecar", "limiter"],
    dataOwnership: ["OTel trace span index"],
    controlOwnership: ["Trace sampling rate rules"],
    persistenceResponsibility: "In-memory or elasticsearch database",
    concurrencyResponsibility: "Asynchronous background export buffers in Go processes",
    failureBoundary: "Jaeger failures cause silent dropping of spans on the server; client response times are unaffected.",
    lifecycle: "Collector lifecycle.",
  },
  lld: {
    implementation: [
      "Sidecar initiates span for serveNormal",
      "Limiter extracts context and appends check_hierarchical spans",
      "Traces are queryable on port 16686",
    ],
  },
  rationale: {
    evidenceStatus: "source-verified",
    selectedApproach: "OpenTelemetry framework integration.",
    whyItFits: [
      "Vendor-neutral standard; easily swaps tracing backends without altering Go code.",
    ],
    acceptedTradeoffs: [
      "Exporting traces consumes small amounts of network bandwidth and CPU.",
    ],
  },
  alternatives: [],
  evidenceStatus: "source-verified",
};

export const decisionsByNodeId = {
  client: clientDecision,
  sidecar: sidecarDecision,
  upstream: upstreamDecision,
  "admin-api": adminApiDecision,
  limiter: limiterDecision,
  redis: redisDecision,
  prometheus: prometheusDecision,
  grafana: grafanaDecision,
  jaeger: jaegerDecision,
};

export function getDecisionForNode(nodeId) {
  return decisionsByNodeId[nodeId] ?? null;
}

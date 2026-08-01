/**
 * Distributed Rate Limiter architecture graph topology — nodes, edges, groups, and helpers.
 *
 * This file owns graph layout only: positions, dimensions, labels, kinds.
 *
 * Evidence: SOURCE VERIFIED — directly inspected against:
 *   cmd/sidecar/main.go, cmd/limiter/main.go, internal/circuitbreaker/store.go,
 *   internal/limiter/lua/hierarchical.lua, internal/idempotency/lease.go
 */

export const GRAPH_META = {
  project: "Distributed Rate Limiter",
  subtitle: "Go Sidecar + Redis/Lua Rate Limiting Platform",
  evidence: "SOURCE VERIFIED — github.com/RUDRA-PRATAP-SINGH01/Distributed-rate-limiter",
  github: "https://github.com/RUDRA-PRATAP-SINGH01/Distributed-rate-limiter",
  docsEntry: "/docs/distributed-rate-limiter/introduction/start-here",
  guideEntry: "/docs/distributed-rate-limiter/introduction/start-here",
};

/** @typedef {{ id: string, label: string, kind: string, x: number, y: number, w?: number, h?: number, path?: string, summary: string, guideHref?: string }} ArchNode */
/** @typedef {{ id: string, from: string, to: string, kind?: string, timing?: string, label?: string, description?: string }} ArchEdge */
/** @typedef {{ id: string, label: string, x: number, y: number, w: number, h: number }} ArchGroup */

export const groups = /** @type {ArchGroup[]} */ ([
  { id: "g-client",  label: "Client layer",                x: 423, y: 48,  w: 295,  h: 152 },
  { id: "g-sidecar", label: "Sidecar proxy layer",         x: 40,  y: 256, w: 1060, h: 162 },
  { id: "g-limiter", label: "Central limiter pool",        x: 177, y: 474, w: 786,  h: 156 },
  { id: "g-state",   label: "Authoritative central state", x: 282, y: 686, w: 576,  h: 156 },
  { id: "g-obs",     label: "Observability stack",         x: 220, y: 898, w: 701,  h: 142 },
]);

export const nodes = /** @type {ArchNode[]} */ ([
  {
    id: "client",
    label: "Client Request",
    kind: "client",
    x: 463, y: 96, w: 215, h: 76,
    path: "External Client",
    summary: "Any HTTP client initiating requests with X-User-ID or Idempotency-Key headers.",
    guideHref: "/docs/distributed-rate-limiter/introduction/start-here",
  },
  {
    id: "denial-cache",
    label: "Denial Cache",
    kind: "memory",
    x: 80, y: 304, w: 190, h: 68,
    path: "cmd/sidecar (sync.Map)",
    summary: "In-memory sync.Map fast-path denial cache. Stores rejected keys (TTL ~30ms) to reject abusive traffic locally without remote limiter RPCs.",
    guideHref: "/docs/distributed-rate-limiter/resilience/denial-cache-and-singleflight",
  },
  {
    id: "sidecar",
    label: "Sidecar Proxy",
    kind: "core",
    x: 318, y: 304, w: 248, h: 86,
    path: "cmd/sidecar",
    summary: "Transparent proxy intercepting traffic. Runs four-stage serveNormal pipeline: denial cache check, singleflight deduplication, rate limit check, and upstream forward.",
    guideHref: "/docs/distributed-rate-limiter/resilience/denial-cache-and-singleflight",
  },
  {
    id: "singleflight",
    label: "Singleflight Engine",
    kind: "worker",
    x: 614, y: 304, w: 220, h: 70,
    path: "golang.org/x/sync/singleflight",
    summary: "Deduplicates concurrent check requests for identical rate-limit keys during cache misses, suppressing downstream RPC spikes.",
    guideHref: "/docs/distributed-rate-limiter/resilience/denial-cache-and-singleflight",
  },
  {
    id: "upstream",
    label: "Upstream Service",
    kind: "client",
    x: 882, y: 304, w: 178, h: 68,
    path: "demo-backend",
    summary: "Target backend service (e.g. port 8081). Reached only after explicit sidecar quota check and admission.",
    guideHref: "/docs/distributed-rate-limiter/routing/gateway-routing",
  },
  {
    id: "admin-api",
    label: "Admin API",
    kind: "worker",
    x: 217, y: 522, w: 192, h: 70,
    path: "cmd/limiter :8082",
    summary: "Isolated administrative endpoint for override CRUD. Writes config hash keys and increments config:generation for cache invalidation.",
    guideHref: "/docs/distributed-rate-limiter/rate-limiting-engine/admin-control",
  },
  {
    id: "limiter",
    label: "Central Limiter",
    kind: "core",
    x: 457, y: 522, w: 220, h: 80,
    path: "cmd/limiter :8080",
    summary: "Stateless service pool. Invokes hierarchical.lua on Redis. Integrates local override cache with config:generation verification and cb:redis circuit breaker.",
    guideHref: "/docs/distributed-rate-limiter/rate-limiting-engine/hierarchical-quotas",
  },
  {
    id: "cb-store",
    label: "Circuit Breaker Store",
    kind: "memory",
    x: 725, y: 522, w: 198, h: 70,
    path: "internal/circuitbreaker",
    summary: "Tracks failure rates and state machine (Closed, Open, Half-Open). Protects Redis and limiter pool during downstream outages.",
    guideHref: "/docs/distributed-rate-limiter/resilience/circuit-breaking",
  },
  {
    id: "config-gen",
    label: "Config Generation Counter",
    kind: "memory",
    x: 322, y: 734, w: 220, h: 68,
    path: "Redis key config:generation",
    summary: "Atomic integer incremented on override updates. Central limiters poll or check this version to instantly invalidate stale local caches.",
    guideHref: "/docs/distributed-rate-limiter/rate-limiting-engine/admin-control",
  },
  {
    id: "redis",
    label: "Redis Master",
    kind: "disk",
    x: 590, y: 734, w: 228, h: 80,
    path: "Redis DB :6379",
    summary: "Authoritative single-master state storage. Holds quota counts (HASH/ZSET), config override keys, circuit status, and idempotency leases.",
    guideHref: "/docs/distributed-rate-limiter/architecture/distributed-state-model",
  },
  {
    id: "prometheus",
    label: "Prometheus",
    kind: "memory",
    x: 260, y: 946, w: 175, h: 66,
    path: "prometheus :9091",
    summary: "Scrapes runtime metrics (counters, histogram latencies) from sidecar and limiter endpoints on port 9091.",
    guideHref: "/docs/distributed-rate-limiter/observability/prometheus-metrics",
  },
  {
    id: "grafana",
    label: "Grafana",
    kind: "memory",
    x: 483, y: 946, w: 175, h: 66,
    path: "grafana :3000",
    summary: "Dashboard visualization querying Prometheus for traffic rates, denial cache hits, circuit states, and CPU/memory statistics.",
    guideHref: "/docs/distributed-rate-limiter/observability/grafana-dashboards",
  },
  {
    id: "jaeger",
    label: "Jaeger / OTLP",
    kind: "memory",
    x: 706, y: 946, w: 175, h: 66,
    path: "jaeger :16686",
    summary: "Distributed tracing backend. Gathers OpenTelemetry spans from sidecar and limiter processes for hot-path latency breakdowns.",
    guideHref: "/docs/distributed-rate-limiter/observability/distributed-tracing",
  },
]);

export const edges = /** @type {ArchEdge[]} */ ([
  {
    id: "e-client-sidecar", from: "client", to: "sidecar",
    kind: "control-flow", timing: "sync",
    label: "Inbound request",
    description: "Inbound request intercepted by the sidecar on port 9090.",
  },
  {
    id: "e-sidecar-denial", from: "sidecar", to: "denial-cache",
    kind: "data-flow", timing: "sync",
    label: "Denial cache lookup",
    description: "Fast-path check in local sync.Map denial cache; bypasses remote limiter if cached rejection found.",
  },
  {
    id: "e-sidecar-sf", from: "sidecar", to: "singleflight",
    kind: "control-flow", timing: "sync",
    label: "Singleflight deduplicate",
    description: "Deduplicates concurrent identical key queries to prevent stampedes to central limiter.",
  },
  {
    id: "e-sidecar-limiter", from: "sidecar", to: "limiter",
    kind: "control-flow", timing: "sync",
    label: "/check_hierarchical RPC",
    description: "HTTP GET query to limiter check endpoint. Bypassed on denial cache hits.",
  },
  {
    id: "e-limiter-cbstore", from: "limiter", to: "cb-store",
    kind: "control-flow", timing: "sync",
    label: "Circuit status check",
    description: "Limiter checks local circuit breaker state before contacting Redis.",
  },
  {
    id: "e-limiter-redis", from: "limiter", to: "redis",
    kind: "data-flow", timing: "sync",
    label: "Lua EVALSHA",
    description: "Invokes hierarchical.lua script inside Redis to perform atomic multi-tier quota checks and token deduction.",
  },
  {
    id: "e-sidecar-upstream", from: "sidecar", to: "upstream",
    kind: "data-flow", timing: "sync",
    label: "Forward admitted request",
    description: "Sidecar forwards the admitted request with original headers to upstream backend.",
  },
  {
    id: "e-admin-configgen", from: "admin-api", to: "config-gen",
    kind: "metadata", timing: "sync",
    label: "Increment config:generation",
    description: "Increments config:generation counter in Redis whenever rules are updated.",
  },
  {
    id: "e-admin-redis", from: "admin-api", to: "redis",
    kind: "metadata", timing: "sync",
    label: "Write override rule",
    description: "Writes config values to config:level:id hash keys.",
  },
  {
    id: "e-limiter-configgen", from: "limiter", to: "config-gen",
    kind: "metadata", timing: "sync",
    label: "Check generation version",
    description: "Limiter verifies local cache version against config:generation to invalidate stale local overrides.",
  },
  {
    id: "e-sidecar-redis", from: "sidecar", to: "redis",
    kind: "data-flow", timing: "sync",
    label: "Idempotency leases",
    description: "Sidecar claim/complete scripts interact directly with Redis idem: keys to enforce idempotency constraints.",
  },
  {
    id: "e-prom-sidecar", from: "prometheus", to: "sidecar",
    kind: "control-flow", timing: "async",
    label: "Metrics scrape",
    description: "Prometheus scrapes metrics from the sidecar metrics endpoint.",
  },
  {
    id: "e-prom-limiter", from: "prometheus", to: "limiter",
    kind: "control-flow", timing: "async",
    label: "Metrics scrape",
    description: "Prometheus scrapes metrics from the limiter metrics endpoint.",
  },
  {
    id: "e-grafana-prom", from: "grafana", to: "prometheus",
    kind: "control-flow", timing: "async",
    label: "Query metrics",
    description: "Grafana queries metrics from Prometheus to populate dashboard panels.",
  },
  {
    id: "e-sidecar-jaeger", from: "sidecar", to: "jaeger",
    kind: "data-flow", timing: "async",
    label: "OTel traces",
    description: "Sidecar exports trace spans to Jaeger backend over OTLP.",
  },
  {
    id: "e-limiter-jaeger", from: "limiter", to: "jaeger",
    kind: "data-flow", timing: "async",
    label: "OTel traces",
    description: "Limiter exports trace spans to Jaeger backend over OTLP.",
  },
]);

export function getNodeMap() {
  return Object.fromEntries(nodes.map((n) => [n.id, n]));
}

export function getGraphBounds(padding = 120) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const g of groups) {
    minX = Math.min(minX, g.x);
    minY = Math.min(minY, g.y);
    maxX = Math.max(maxX, g.x + g.w);
    maxY = Math.max(maxY, g.y + g.h);
  }
  return {
    minX: minX - padding,
    minY: minY - padding,
    maxX: maxX + padding,
    maxY: maxY + padding,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2,
  };
}

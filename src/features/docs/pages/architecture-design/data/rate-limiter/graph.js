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
  guideEntry: "/docs/distributed-rate-limiter/introduction/start-here",
};

/** @typedef {{ id: string, label: string, kind: string, x: number, y: number, w?: number, h?: number, path?: string, summary: string, guideHref?: string }} ArchNode */
/** @typedef {{ id: string, from: string, to: string, kind?: string, timing?: string, label?: string, description?: string }} ArchEdge */
/** @typedef {{ id: string, label: string, x: number, y: number, w: number, h: number }} ArchGroup */

export const groups = /** @type {ArchGroup[]} */ ([
  { id: "g-client",    label: "Client layer",                 x: 20,  y: 40,   w: 920, h: 160 },
  { id: "g-sidecar",   label: "Sidecar proxy layer",          x: 20,  y: 260,  w: 920, h: 180 },
  { id: "g-limiter",   label: "Central limiter pool",         x: 20,  y: 500,  w: 920, h: 180 },
  { id: "g-state",     label: "Authoritative central state",  x: 20,  y: 740,  w: 920, h: 180 },
  { id: "g-obs",       label: "Observability stack",          x: 20,  y: 980,  w: 920, h: 160 },
]);

export const nodes = /** @type {ArchNode[]} */ ([
  {
    id: "client",
    label: "Client Request",
    kind: "client",
    x: 380, y: 90, w: 200, h: 64,
    path: "External Client",
    summary: "Any HTTP client initiating requests with X-User-ID or Idempotency-Key headers.",
    guideHref: "/docs/distributed-rate-limiter/introduction/start-here",
  },
  {
    id: "sidecar",
    label: "Sidecar Proxy",
    kind: "core",
    x: 380, y: 310, w: 200, h: 64,
    path: "cmd/sidecar",
    summary: "Transparent proxy intercepting traffic. Runs four-stage serveNormal pipeline: denial cache, singleflight, checkRateLimit with central-limiter circuit breaker, upstream forward.",
    guideHref: "/docs/distributed-rate-limiter/resilience/denial-cache-and-singleflight",
  },
  {
    id: "upstream",
    label: "Upstream Service",
    kind: "client",
    x: 680, y: 310, w: 200, h: 64,
    path: "demo-backend",
    summary: "Target backend service (e.g. port 8081). Reached only after explicit sidecar quota check and admission.",
    guideHref: "/docs/distributed-rate-limiter/routing/gateway-routing",
  },
  {
    id: "admin-api",
    label: "Admin API",
    kind: "worker",
    x: 80, y: 550, w: 200, h: 64,
    path: "cmd/limiter :8082",
    summary: "Isolated administrative endpoint for override CRUD. Writes config hash keys and increments config:generation for cache invalidation.",
    guideHref: "/docs/distributed-rate-limiter/rate-limiting-engine/admin-control",
  },
  {
    id: "limiter",
    label: "Central Limiter",
    kind: "core",
    x: 380, y: 550, w: 200, h: 64,
    path: "cmd/limiter :8080",
    summary: "Stateless service pool. Invokes hierarchical.lua on Redis. Integrates local override cache with config:generation verification and cb:redis circuit breaker.",
    guideHref: "/docs/distributed-rate-limiter/rate-limiting-engine/hierarchical-quotas",
  },
  {
    id: "redis",
    label: "Redis Master",
    kind: "disk",
    x: 380, y: 790, w: 200, h: 64,
    path: "Redis DB :6379",
    summary: "Authoritative single-master state storage. Holds quota counts (HASH/ZSET), config override keys, circuit status, and idempotency leases.",
    guideHref: "/docs/distributed-rate-limiter/architecture/distributed-state-model",
  },
  {
    id: "prometheus",
    label: "Prometheus",
    kind: "memory",
    x: 120, y: 1030, w: 180, h: 56,
    path: "prometheus :9091",
    summary: "Scrapes runtime metrics (counters, histogram latencies) from sidecar and limiter endpoints on port 9091.",
    guideHref: "/docs/distributed-rate-limiter/observability/prometheus-metrics",
  },
  {
    id: "grafana",
    label: "Grafana",
    kind: "memory",
    x: 390, y: 1030, w: 180, h: 56,
    path: "grafana :3000",
    summary: "Dashboard visualization querying Prometheus for traffic rates, denial cache hits, circuit states, and CPU/memory statistics.",
    guideHref: "/docs/distributed-rate-limiter/observability/grafana-dashboards",
  },
  {
    id: "jaeger",
    label: "Jaeger / OTLP",
    kind: "memory",
    x: 660, y: 1030, w: 180, h: 56,
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
    id: "e-sidecar-limiter", from: "sidecar", to: "limiter",
    kind: "control-flow", timing: "sync",
    label: "/check_hierarchical RPC",
    description: "HTTP GET query to limiter check endpoint. Bypassed on denial cache hits.",
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
    id: "e-admin-redis", from: "admin-api", to: "redis",
    kind: "metadata", timing: "sync",
    label: "Write override / increment gen",
    description: "Writes config values to config:level:id and increments config:generation to invalidate limiter local caches.",
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

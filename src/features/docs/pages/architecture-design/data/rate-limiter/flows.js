/**
 * Operational flow definitions for the Distributed Rate Limiter.
 *
 * Each flow describes a complete operational path as a sequence of steps.
 * Each step references a node (component) and describes what happens.
 *
 * Evidence: SOURCE VERIFIED — derived from direct source inspection.
 */

/** @typedef {{ id: string, label: string, nodeId: string, description: string, codeRef?: { path: string, symbol?: string, lineStart?: number, lineEnd?: number } }} FlowStep */
/** @typedef {{ id: string, title: string, description: string, kind: 'write' | 'read' | 'flush' | 'compaction' | 'recovery', steps: FlowStep[] }} OperationalFlow */

/** @type {OperationalFlow[]} */
export const flows = [
  // ── RATE LIMIT CHECK (serveNormal) ──────────────────────────────────────────
  {
    id: "flow-normal-limit",
    title: "Rate Limit Check (serveNormal)",
    description: "How a request is checked for quota admission, utilizing local cache and the central limiter.",
    kind: "read",
    steps: [
      {
        id: "nl1",
        label: "1. serveNormal Entry",
        nodeId: "sidecar",
        description: "Client request intercepted on port 9090. serveNormal is called, resolving the client user ID and generating the unique cache key.",
        codeRef: { path: "cmd/sidecar/main.go", symbol: "serveNormal" },
      },
      {
        id: "nl2",
        label: "2. Denial Cache Check",
        nodeId: "sidecar",
        description: "Sidecar checks in-memory sync.Map denial cache. If an Allowed=false entry exists and is active, it returns 429 immediately, bypassing the limiter and Redis.",
        codeRef: { path: "cmd/sidecar/main.go", symbol: "serveNormal", lineStart: 522, lineEnd: 531 },
      },
      {
        id: "nl3",
        label: "3. Singleflight Deduplication",
        nodeId: "sidecar",
        description: "If a denial cache miss occurs, singleflight.Do collapses concurrent duplicate user checks so only one request goes to the limiter.",
        codeRef: { path: "cmd/sidecar/main.go", symbol: "serveNormal", lineStart: 533, lineEnd: 535 },
      },
      {
        id: "nl4",
        label: "4. Circuit Breaker Allow Check",
        nodeId: "sidecar",
        description: "Sidecar checks the cb:central-limiter state. If the circuit is open, it fails-closed with 503 (or fails-open if configured).",
        codeRef: { path: "cmd/sidecar/main.go", symbol: "checkRateLimit", lineStart: 749, lineEnd: 755 },
      },
      {
        id: "nl5",
        label: "5. HTTP /check_hierarchical",
        nodeId: "limiter",
        description: "Sidecar sends an HTTP GET check query to the central limiter. Request has a 1500ms timeout budget.",
        codeRef: { path: "cmd/sidecar/main.go", symbol: "checkRateLimit", lineStart: 758, lineEnd: 760 },
      },
      {
        id: "nl6",
        label: "6. Redis EVALSHA",
        nodeId: "redis",
        description: "Limiter verifies config:generation, then executes hierarchical.lua. Redis verifies quota across global, tenant, user, and endpoint tiers atomically.",
        codeRef: { path: "internal/limiter/lua/hierarchical.lua", lineStart: 55, lineEnd: 85 },
      },
      {
        id: "nl7",
        label: "7. Cache Result & Forward",
        nodeId: "upstream",
        description: "If admitted, sidecar saves Allowed=true in cache (TTL 30ms) and proxies the request to the upstream backend service.",
        codeRef: { path: "cmd/sidecar/main.go", symbol: "forwardRequest" },
      },
    ],
  },

  // ── IDEMPOTENT REQUEST PATH ──────────────────────────────────────────────────
  {
    id: "flow-idempotency",
    title: "Idempotent Request Lifecycle",
    description: "Ensures mutating requests (POST/PUT/PATCH/DELETE) execute exactly-once via lease and fence tokens.",
    kind: "write",
    steps: [
      {
        id: "idem1",
        label: "1. serveIdempotent Entry",
        nodeId: "sidecar",
        description: "ServeHTTP detects a mutating method and a non-empty Idempotency-Key header, branching execution to serveIdempotent.",
        codeRef: { path: "cmd/sidecar/main.go", symbol: "ServeHTTP", lineStart: 121, lineEnd: 125 },
      },
      {
        id: "idem2",
        label: "2. Claim Lease in Redis",
        nodeId: "redis",
        description: "Calls claim.lua. Sets key status to processing, and generates a monotonic fence token if the key is empty.",
        codeRef: { path: "internal/idempotency/lease.go", symbol: "Claim" },
      },
      {
        id: "idem3",
        label: "3. Rate Limit Check",
        nodeId: "limiter",
        description: "Applies standard quota check via checkRateLimit to prevent abuse on idempotent requests.",
        codeRef: { path: "cmd/sidecar/main.go", symbol: "checkRateLimit" },
      },
      {
        id: "idem4",
        label: "4. Call Upstream",
        nodeId: "upstream",
        description: "If admitted, Sidecar forwards the request to the upstream service with the fence token.",
        codeRef: { path: "cmd/sidecar/main.go", symbol: "forwardRequest" },
      },
      {
        id: "idem5",
        label: "5. Complete Lease in Redis",
        nodeId: "redis",
        description: "Calls complete.lua to verify the fence token, store the response status + body, and set status to completed.",
        codeRef: { path: "internal/idempotency/lease.go", symbol: "Complete" },
      },
      {
        id: "idem6",
        label: "6. Replay Response",
        nodeId: "sidecar",
        description: "Subsequent retries hit claim.lua, return status completed with cached body, and the sidecar replays it immediately.",
        codeRef: { path: "cmd/sidecar/main.go", symbol: "serveIdempotent" },
      },
    ],
  },

  // ── CIRCUIT BREAKER FAILURE & RECOVERY ───────────────────────────────────────
  {
    id: "flow-circuit-breaker",
    title: "Circuit Breaker Tripping & Recovery",
    description: "Handles downstream component failures cleanly, maintaining platform resilience.",
    kind: "recovery",
    steps: [
      {
        id: "cb1",
        label: "1. Redis Outage",
        nodeId: "redis",
        description: "Redis master becomes unreachable. Central Limiter connection pool requests timeout (500ms dial/read/write limit).",
        codeRef: { path: "cmd/limiter/main.go" },
      },
      {
        id: "cb2",
        label: "2. cb:redis Trips",
        nodeId: "limiter",
        description: "The limiter's internal cb:redis circuit breaker registers pool failures and transitions to Open state.",
        codeRef: { path: "internal/circuitbreaker/store.go" },
      },
      {
        id: "cb3",
        label: "3. Limiter HTTP 500",
        nodeId: "limiter",
        description: "Limiter returns HTTP 500 Internal Server Error to the sidecar, indicating that backend storage is offline.",
        codeRef: { path: "cmd/limiter/main.go" },
      },
      {
        id: "cb4",
        label: "4. cb:central-limiter Trips",
        nodeId: "sidecar",
        description: "Sidecar registers limiter failures and opens the cb:central-limiter circuit breaker.",
        codeRef: { path: "cmd/sidecar/main.go" },
      },
      {
        id: "cb5",
        label: "5. Fail-Closed Response",
        nodeId: "sidecar",
        description: "With FAIL_OPEN=false (default), sidecar blocks future limiter RPCs and immediately responds to the client with a 503.",
        codeRef: { path: "cmd/sidecar/main.go" },
      },
      {
        id: "cb6",
        label: "6. Half-Open Recovery Probe",
        nodeId: "sidecar",
        description: "After a cool-down period, cb:central-limiter enters Half-Open and allows a single probe. If it succeeds, the circuit closes.",
        codeRef: { path: "internal/circuitbreaker/circuit.go", symbol: "Allow" },
      },
    ],
  },

  // ── OVERRIDE SYNCHRONIZATION ──────────────────────────────────────────────────
  {
    id: "flow-override-sync",
    title: "Override Config Synchronization",
    description: "How capacity / refill overrides are pushed dynamically with minimum polling overhead.",
    kind: "flush",
    steps: [
      {
        id: "ov1",
        label: "1. CRUD Write",
        nodeId: "admin-api",
        description: "Operator submits an override. Admin API writes config:level:id key to Redis.",
        codeRef: { path: "cmd/limiter/main.go" },
      },
      {
        id: "ov2",
        label: "2. Increment Generation",
        nodeId: "redis",
        description: "Admin API increments the config:generation counter key in Redis atomically.",
        codeRef: { path: "cmd/limiter/main.go" },
      },
      {
        id: "ov3",
        label: "3. Generation Check on Hot Path",
        nodeId: "limiter",
        description: "On next request, limiter gets config:generation from Redis. If different, invalidates local cache.",
        codeRef: { path: "cmd/limiter/main.go" },
      },
      {
        id: "ov4",
        label: "4. Reload and Apply Overrides",
        nodeId: "limiter",
        description: "Limiter pulls fresh overrides from Redis, caches them, and applies them to subsequent quota checks.",
        codeRef: { path: "cmd/limiter/main.go" },
      },
    ],
  },

  // ── INTELLIGENT TRAFFIC ROUTING ──────────────────────────────────────────────
  {
    id: "flow-intelligent-routing",
    title: "Intelligent Traffic Routing (Gateway)",
    description: "How requests are dynamically routed across weighted gateways with automated health probing and failover.",
    kind: "read",
    steps: [
      {
        id: "ir1",
        label: "1. Routing Enabled Request",
        nodeId: "sidecar",
        description: "Client request arrives at the sidecar proxy. Under ENABLE_ROUTING=true, the request is dispatched to the gateway router.",
        codeRef: { path: "cmd/sidecar/main.go", symbol: "ServeHTTP" },
      },
      {
        id: "ir2",
        label: "2. Load Gateway States",
        nodeId: "redis",
        description: "Router calls ListGateways to query candidate gateway metrics (ID, URL, health, latency, etc.) from the Redis store.",
        codeRef: { path: "internal/routing/router.go", symbol: "Forward" },
      },
      {
        id: "ir3",
        label: "3. Pick Best Gateway",
        nodeId: "sidecar",
        description: "Router's selector uses PickPrimary to select the best target gateway based on active score and weights.",
        codeRef: { path: "internal/routing/router.go", symbol: "Forward" },
      },
      {
        id: "ir4",
        label: "4. Gateway Circuit Check",
        nodeId: "sidecar",
        description: "Checks cb:{gateway-id} circuit breaker. If Open, it selects the next best gateway in FailoverOrder.",
        codeRef: { path: "internal/routing/router.go", symbol: "Forward" },
      },
      {
        id: "ir5",
        label: "5. Forward & Record Outcome",
        nodeId: "upstream",
        description: "Forwards request to the selected gateway. Records latency and success status in the Redis routing store.",
        codeRef: { path: "internal/routing/router.go", symbol: "Forward" },
      },
      {
        id: "ir6",
        label: "6. Background Health Probing",
        nodeId: "sidecar",
        description: "A background probe loop periodically queries /health on all gateways, reporting results back to Redis.",
        codeRef: { path: "internal/routing/router.go", symbol: "StartHealthProbes" },
      },
    ],
  },
];

/** @returns {Map<string, OperationalFlow>} */
export function getFlowMap() {
  return new Map(flows.map((f) => [f.id, f]));
}

/** @returns {string[]} Node IDs that participate in a given flow */
export function getFlowNodeIds(flowId) {
  const flow = flows.find((f) => f.id === flowId);
  if (!flow) return [];
  return [...new Set(flow.steps.map((s) => s.nodeId))];
}

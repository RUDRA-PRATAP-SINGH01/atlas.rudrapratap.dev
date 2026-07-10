import React from "react";
import {
  RLThesis,
  RLQuickModel,
  RLEvidenceBadge,
  RLCallout,
  RLSourceExcerpt,
  RLRelatedPages,
  RLStatGrid,
  MermaidDiagram,
  Invariant,
  Limitation,
  FailureScenario
} from "../components/RLDocBlocks.jsx";

/* ─────────────────────────────────────────────
   Mermaid chart definitions
───────────────────────────────────────────── */

const cbStateMachine = `
stateDiagram-v2
    [*] --> Closed : Initial state

    Closed --> Open : failure_rate >= 0.5 (min_samples met)\\nOR consecutive_failures >= 5\\nOR latency_ema >= 500ms
    Closed --> Closed : success or 429 recorded\\n(429 excluded from failure counters)

    Open --> HalfOpen : CB_OPEN_COOLDOWN_MS (30000ms) elapsed
    Open --> Open : fast-reject — allow.lua returns 0 (~23ms)

    HalfOpen --> Closed : probe_successes >= 2 (CB_HALF_OPEN_SUCCESS_REQUIRED)
    HalfOpen --> Open : any probe failure or timeout
    HalfOpen --> HalfOpen : admitted probe (probe_count < 3)
`;

const cbOutageTimeline = `
sequenceDiagram
    autonumber
    participant Client
    participant Sidecar
    participant CB as Circuit Breaker\\n(allow.lua / record.lua)
    participant Redis

    Note over CB: State = CLOSED
    Client->>Sidecar: Normal request
    Sidecar->>CB: Allow() → permitted
    Sidecar->>Redis: EVALSHA succeeds
    Sidecar->>CB: Record(OutcomeSuccess)

    Note over Redis: Redis becomes unreachable
    Client->>Sidecar: Request during outage
    Sidecar->>CB: Allow() → permitted
    Sidecar->>Redis: EVALSHA — dial/read timeout 500ms
    Redis--xSidecar: connection timeout
    Sidecar->>CB: Record(OutcomeFailure)
    Note over CB: consecutive_failures accumulates...\\nafter 5th: HSET state=open

    Note over CB: State = OPEN — fast-fail active
    Client->>Sidecar: Request (circuit open)
    Sidecar->>CB: Allow() → denied in ~23ms
    Sidecar-->>Client: 503 Service Unavailable

    Note over CB: 30000ms cooldown elapses
    Note over CB: State = HALF-OPEN, probe_count = 0
    Client->>Sidecar: Probe request 1
    Sidecar->>CB: Allow() → admitted (probe 1 of 3)
    Sidecar->>Redis: EVALSHA (Redis recovered)
    Redis-->>Sidecar: OK
    Sidecar->>CB: Record(success) — probe_successes = 1

    Client->>Sidecar: Probe request 2
    Sidecar->>CB: Allow() → admitted (probe 2 of 3)
    Sidecar->>Redis: EVALSHA OK
    Sidecar->>CB: Record(success) — probe_successes = 2 >= required
    Note over CB: HSET state=closed, counters reset\\nState = CLOSED — full traffic restored
`;

const idempotencyLifecycle = `
stateDiagram-v2
    [*] --> PROCESSING : claim.lua — new key\\nINCR fence counter (token t_N)\\nPEXPIRE LockTTL 60000ms

    PROCESSING --> COMPLETED : complete.lua\\nfence_token matches — HMSET + PEXPIRE 86400000ms
    PROCESSING --> FAILED : fail.lua\\nfence_token matches
    PROCESSING --> CONFLICT : concurrent duplicate\\nclaim.lua sees PROCESSING → 409
    PROCESSING --> PROCESSING : LockTTL expires (60000ms)\\nreclaim → new fence t_(N+1)

    COMPLETED --> REPLAY : duplicate within 24h\\nclaim.lua sees COMPLETED\\nreturns cached response
    FAILED --> PROCESSING : client retry\\nclaim.lua reclaims with new fence token
`;

const idempotencyFencingSequence = `
sequenceDiagram
    autonumber
    participant Client
    participant Proxy1 as sidecar-replica-1
    participant Proxy2 as sidecar-replica-2
    participant Redis as Redis Master
    participant Backend

    Client->>Proxy1: POST /pay (Idempotency-Key: pay_45)
    Proxy1->>Redis: EVALSHA claim.lua → status NEW, fence_token t_1
    Proxy1->>Backend: Forward POST /pay
    Note over Backend: Executing slowly...
    Note over Redis: LockTTL (60000ms) expires — lease abandoned

    Client->>Proxy2: POST /pay (Idempotency-Key: pay_45)
    Proxy2->>Redis: EVALSHA claim.lua → reclaimed, fence_token t_2
    Proxy2->>Backend: Forward POST /pay

    Note over Proxy1: Proxy 1 upstream finally replies (stale)
    Proxy1->>Redis: EVALSHA complete.lua (fence: t_1)
    Redis-->>Proxy1: REJECT — FENCE_MISMATCH (stored fence is t_2)

    Proxy2->>Redis: EVALSHA complete.lua (fence: t_2)
    Redis-->>Proxy2: OK — HMSET status=COMPLETED, PEXPIRE 86400000ms
`;

const failureDecisionTree = `
flowchart TD
    A[Request arrives at sidecar] --> B{Denial cache hit?}
    B -->|"YES — key denied within CACHE_TTL_MS 30ms"| C[Return 429\\nzero Redis hops]
    B -->|No| D{Circuit breaker state?}
    D -->|OPEN| E[Return 503\\nfast-fail ~23ms]
    D -->|CLOSED or HALF-OPEN| F[Sidecar HTTP call to limiter]
    F -->|"Timeout or 5xx error"| G{FAIL_OPEN?}
    G -->|"false — default"| H[Return 503 fail-closed]
    G -->|"true — operator override"| I[Pass-through\\nquota NOT enforced]
    F -->|200 or 429 response| J{Response code?}
    J -->|"429 Too Many Requests"| K[Write denial to cache\\nReturn 429]
    J -->|"200 OK allowed"| L[Forward to upstream]

    style C fill:#18181b,stroke:#ff5cad,color:#ff5cad
    style E fill:#18181b,stroke:#ff5cad,color:#ff5cad
    style H fill:#18181b,stroke:#ff5cad,color:#ff5cad
    style I fill:#18181b,stroke:#db4577,color:#e879a9
    style K fill:#18181b,stroke:#ff5cad,color:#ff5cad
    style L fill:#18181b,stroke:#52525b,color:#a1a1aa
`;

const recoverySequence = `
sequenceDiagram
    autonumber
    participant Sidecar
    participant CB as allow.lua / record.lua
    participant Redis
    participant Limiter

    Note over CB: State = OPEN, opened_at set
    Note over CB: Wait CB_OPEN_COOLDOWN_MS (30000ms)

    Sidecar->>CB: Allow() after cooldown
    CB->>Redis: HSET state=half_open, probe_count=0
    CB-->>Sidecar: Allowed (probe 1 of 3)

    Sidecar->>Limiter: Probe request
    Limiter->>Redis: EVALSHA succeeds
    Limiter-->>Sidecar: 200 OK
    Sidecar->>CB: Record(success)
    Note over CB: probe_successes = 1

    Sidecar->>CB: Allow() — probe 2
    Sidecar->>Limiter: Probe request succeeds
    Sidecar->>CB: Record(success)
    Note over CB: probe_successes = 2 >= CB_HALF_OPEN_SUCCESS_REQUIRED
    CB->>Redis: HSET state=closed, reset all counters
    Note over CB: Circuit CLOSED — full traffic restored
`;

/* ─────────────────────────────────────────────
   Shared inline styles
───────────────────────────────────────────── */

const TABLE_TH = { padding: "10px 8px", fontSize: 12, fontWeight: 700, color: "#a1a1aa", borderBottom: "2px solid #27272a", textAlign: "left" };
const TABLE_TD = { padding: "10px 8px", fontSize: 12, borderBottom: "1px solid #27272a", verticalAlign: "top" };
const TABLE_TD_BOLD = { ...TABLE_TD, fontWeight: 700 };

/* ─────────────────────────────────────────────
   Export
───────────────────────────────────────────── */

export const resiliencePages = {

  /* ══════════════════════════════════════════
     FAILURE MODEL — Flagship 9.5 / 10
  ══════════════════════════════════════════ */
  "failure-model": {
    title: "Failure Model",
    topics: [
      { label: "Failure Matrix", href: "#matrix" },
      { label: "Decision Tree", href: "#decision-tree" },
      { label: "Blast Radius", href: "#blast-radius" },
      { label: "Fail-Closed Defaults", href: "#fail-closed" },
      { label: "Audit Log Failures", href: "#audit-fail" }
    ],
    content: (
      <div>
        <RLThesis>
          Every failure path in this system is bounded by explicit timeouts and defaults to fail-closed behaviour.
          Redis socket operations time out at 500 ms each; the pool ceiling is 1,000 ms with zero retries. The sidecar
          rejects traffic when the limiter or Redis is unreachable unless an operator explicitly opts into fail-open.
          Once five consecutive failures trip the circuit, subsequent checks fail in ~23 ms — a 43x reduction from the
          Redis outage baseline of 1,003–1,006 ms.
        </RLThesis>

        <RLQuickModel>
          Three concentric guards. (1) Process-local: denial cache (<code>CACHE_TTL_MS</code> 30 ms) and singleflight
          collapse traffic before any network hop. (2) Timeout-bounded RPC: Redis operations are capped at 500 ms per
          socket phase; sidecar-to-limiter HTTP at 1,500 ms. (3) Circuit breaker: Redis-coordinated state machine that
          fast-fails at ~23 ms once errors cross the trip threshold — protecting goroutines and connection pools from
          exhaustion during sustained outages.
        </RLQuickModel>

        <h2 className="guide-sub-heading" id="matrix">Failure Matrix</h2>
        <p style={{ fontSize: 13, color: "#a1a1aa", marginBottom: 16 }}>
          Seven columns per failure mode: component, detection mechanism, sidecar behavior, HTTP status delivered to
          clients, worst-case latency bound, recovery path, and correctness effect on quota enforcement.{" "}
          <RLEvidenceBadge type="SOURCE-PROVEN" /> <RLEvidenceBadge type="BENCHMARK-PROVEN" />
        </p>
        <div className="docs-table-wrap">
          <table className="docs-table">
            <thead>
              <tr>
                <th style={TABLE_TH}>Failure</th>
                <th style={TABLE_TH}>Detection</th>
                <th style={TABLE_TH}>Behavior</th>
                <th style={TABLE_TH}>Status</th>
                <th style={TABLE_TH}>Latency Bound</th>
                <th style={TABLE_TH}>Recovery</th>
                <th style={TABLE_TH}>Correctness Effect</th>
              </tr>
            </thead>
            <tbody>
              {[
                {
                  failure: "Redis Master Unavailable",
                  detection: "go-redis pool dial/read/write timeout (500 ms each, pool ceiling 1,000 ms)",
                  behavior: "Limiter EVALSHA fails; limiter returns 503; sidecar fail-closed",
                  status: "503",
                  latency: "1,003–1,006 ms",
                  recovery: "Sentinel promotes replica; pool reconnects automatically",
                  correctness: "No quota consumed — conservative; circuit opens after 5 consecutive failures"
                },
                {
                  failure: "Limiter Pool Crash",
                  detection: "Sidecar HTTP client timeout (SIDECAR_LIMITER_HTTP_TIMEOUT_MS 1,500 ms)",
                  behavior: "TCP connection refused; sidecar fail-closed (FAIL_OPEN=false)",
                  status: "503",
                  latency: "~504 ms",
                  recovery: "Container restart (Kubernetes); sidecar circuit opens on repeated failures",
                  correctness: "No quota consumed — conservative"
                },
                {
                  failure: "Open Circuit Breaker",
                  detection: "allow.lua reads Redis HASH state=open",
                  behavior: "Fast-reject before limiter call; no Redis EVALSHA executed",
                  status: "503",
                  latency: "~23 ms",
                  recovery: "Automatic after CB_OPEN_COOLDOWN_MS (30,000 ms); Half-Open probe cycle",
                  correctness: "No quota consumed; blast radius limited to open window duration"
                },
                {
                  failure: "Sustained Latency Spike",
                  detection: "latency EMA exceeds CB_LATENCY_THRESHOLD_MS (500 ms) → OutcomeLatencySpike",
                  behavior: "record.lua increments consecutive_failures or trips on rate; circuit may open",
                  status: "503 (if circuit opens)",
                  latency: "Up to CB_LATENCY_THRESHOLD_MS + scheduling",
                  recovery: "EMA decays when latency normalises; circuit closes after probe success",
                  correctness: "Quota may not be enforced if circuit trips before EVALSHA completes"
                },
                {
                  failure: "Expected Rate Denial (429)",
                  detection: "ClassifyHTTP returns OutcomeRateLimited — excluded from failure counters",
                  behavior: "Sidecar caches denial for CACHE_TTL_MS; subsequent hits served in ~1 µs",
                  status: "429",
                  latency: "~1 µs on cache hit",
                  recovery: "Cache TTL expires; next check re-evaluates limiter",
                  correctness: "Quota correctly enforced — expected behaviour"
                },
                {
                  failure: "Lua Script Evicted (NOSCRIPT)",
                  detection: "Redis returns NOSCRIPT error on EVALSHA",
                  behavior: "Limiter catches error, falls back to full EVAL with inline script body",
                  status: "200 or 429 (recovered)",
                  latency: "One additional round-trip",
                  recovery: "Automatic on next request; EVALSHA re-loads script into Redis cache",
                  correctness: "No quota correctness impact — transparent fallback"
                },
                {
                  failure: "Idempotency Redis Error",
                  detection: "claim.lua or complete.lua round-trip fails or times out",
                  behavior: "Fail-closed (IDEMPOTENCY_FAIL_OPEN=false); request rejected",
                  status: "503",
                  latency: "Redis timeout ceiling",
                  recovery: "Automatic when Redis returns; client may retry with same Idempotency-Key",
                  correctness: "No duplicate execution risk — conservative rejection"
                },
                {
                  failure: "Circuit Breaker Store Error",
                  detection: "allow.lua or record.lua Redis error (CIRCUIT_FAIL_OPEN=false)",
                  behavior: "Fail-closed; cannot confirm state → reject",
                  status: "503",
                  latency: "Redis timeout ceiling",
                  recovery: "Automatic when Redis returns",
                  correctness: "Conservative — traffic blocked until CB state confirmable"
                },
                {
                  failure: "Prometheus Exporter Crash",
                  detection: "Scrape target missing; AlertManager fires on gap",
                  behavior: "Non-blocking; metrics pipeline decoupled from request path",
                  status: "Unaffected (200/429 normal)",
                  latency: "0 ms (async)",
                  recovery: "Process restart; gap in metrics series only",
                  correctness: "No quota or correctness effect"
                },
                {
                  failure: "Audit Queue Overflow",
                  detection: "Bounded channel full; audit_dropped_total counter increments",
                  behavior: "Best-effort drop; request path not blocked",
                  status: "Unaffected",
                  latency: "0 ms",
                  recovery: "Drain when Redis recovers; no replay of dropped records",
                  correctness: "Quota enforced; audit trail may be incomplete"
                },
                {
                  failure: "Process Crash (sidecar SIGKILL)",
                  detection: "Kubernetes liveness probe failure; pod restart",
                  behavior: "In-flight requests dropped; idempotency leases may be orphaned",
                  status: "Client sees connection reset",
                  latency: "0 ms (immediate drop)",
                  recovery: "Pod restart; idempotency leases reclaimed after LockTTL (60,000 ms)",
                  correctness: "Crash-before-completion window — see Idempotency page"
                },
                {
                  failure: "Graceful Shutdown (SIGTERM)",
                  detection: "OS signal; shutdown handler drains in-flight requests",
                  behavior: "No new requests accepted; in-flight complete normally",
                  status: "Normal for in-flight; 503 for new connections",
                  latency: "Configurable drain timeout",
                  recovery: "Clean; no correctness impact",
                  correctness: "No quota effect"
                }
              ].map((row) => (
                <tr key={row.failure}>
                  <td style={TABLE_TD_BOLD}>{row.failure}</td>
                  <td style={TABLE_TD}>{row.detection}</td>
                  <td style={TABLE_TD}>{row.behavior}</td>
                  <td style={{ ...TABLE_TD, fontFamily: "monospace", color: "#ff5cad" }}>{row.status}</td>
                  <td style={{ ...TABLE_TD, fontFamily: "monospace" }}>{row.latency}</td>
                  <td style={TABLE_TD}>{row.recovery}</td>
                  <td style={TABLE_TD}>{row.correctness}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="guide-sub-heading" id="decision-tree">Decision Tree</h2>
        <p style={{ fontSize: 13, color: "#a1a1aa", marginBottom: 16 }}>
          Every inbound request follows this deterministic path through the three concentric guards. Each branch is
          grounded in a verified default.{" "}
          <RLEvidenceBadge type="SOURCE-PROVEN" />
        </p>
        <MermaidDiagram chart={failureDecisionTree} />

        <h2 className="guide-sub-heading" id="blast-radius">Blast Radius by Component</h2>
        <p style={{ fontSize: 13, color: "#a1a1aa", marginBottom: 16 }}>
          Blast radius describes how many request paths are affected when a component fails. Failures in Redis or the
          limiter are the most impactful; sidecar and observability failures are scoped.
        </p>
        <div className="docs-table-wrap">
          <table className="docs-table">
            <thead>
              <tr>
                <th style={TABLE_TH}>Component</th>
                <th style={TABLE_TH}>Blast Radius</th>
                <th style={TABLE_TH}>Mechanism Class</th>
                <th style={TABLE_TH}>Traffic Impact</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Redis Master", "All quota enforcement, all idempotency, all CB coordination", "Fail-Closed", "100% — 503 for all rate-checked paths"],
                ["Central Limiter", "All quota enforcement", "Fail-Closed (FAIL_OPEN=false)", "100% — unless FAIL_OPEN overridden"],
                ["Single Sidecar Replica", "Only that replica's traffic", "Process-scoped", "Partial — other replicas unaffected"],
                ["Prometheus Exporter", "Metrics collection only", "Best-Effort (async)", "0% — request path unaffected"],
                ["Distributed Tracing (OTLP)", "Trace export only", "Best-Effort (async)", "0% — request path unaffected"],
                ["Audit Log Writer", "Audit trail completeness", "Best-Effort (drop)", "0% — quota enforcement unaffected"],
                ["Circuit Breaker Store", "CB state reads/writes", "Fail-Closed (CIRCUIT_FAIL_OPEN=false)", "100% during CB state uncertainty"]
              ].map(([component, blast, mechanism, impact]) => (
                <tr key={component}>
                  <td style={TABLE_TD_BOLD}>{component}</td>
                  <td style={TABLE_TD}>{blast}</td>
                  <td style={{ ...TABLE_TD, color: "#ff5cad" }}>{mechanism}</td>
                  <td style={TABLE_TD}>{impact}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="guide-sub-heading" id="fail-closed">Fail-Closed Defaults</h2>
        <RLStatGrid stats={[
          { label: "FAIL_OPEN (sidecar → limiter)", value: "false", evidence: "SOURCE-PROVEN" },
          { label: "IDEMPOTENCY_FAIL_OPEN", value: "false", evidence: "SOURCE-PROVEN" },
          { label: "CIRCUIT_FAIL_OPEN", value: "false", evidence: "SOURCE-PROVEN" }
        ]} />

        <RLCallout variant="warning" title="Dangerous overrides">
          Setting <code>FAIL_OPEN=true</code>, <code>IDEMPOTENCY_FAIL_OPEN=true</code>, or{" "}
          <code>CIRCUIT_FAIL_OPEN=true</code> allows traffic through during dependency outages. All three default to{" "}
          <code>false</code>. Operators must opt in explicitly; the trade-off is availability over correctness.
          Never enable fail-open on payment-critical or fraud-sensitive paths.
        </RLCallout>

        <RLSourceExcerpt
          source="internal/redis/timeouts.go"
          establishes="Redis dial, read, and write timeouts are each 500 ms; pool acquisition caps at 1,000 ms with zero automatic retries."
        >{`func DefaultOptions() *redis.Options {
    return &redis.Options{
        DialTimeout:  500 * time.Millisecond,
        ReadTimeout:  500 * time.Millisecond,
        WriteTimeout: 500 * time.Millisecond,
        PoolTimeout:  1000 * time.Millisecond,
        MaxRetries:   0,
    }
}`}</RLSourceExcerpt>

        <h2 className="guide-sub-heading" id="audit-fail">Audit Log Failures</h2>
        <p style={{ fontSize: 13, lineHeight: 1.7, color: "#d4d4d8" }}>
          Audit logging operates as an asynchronous, non-blocking pipeline decoupled from the rate-limit decision path.
          If Redis is congested or the bounded audit queue overflows, records are dropped and{" "}
          <code>audit_dropped_total</code> is incremented. Request-path latency is never blocked by audit backpressure —
          quota enforcement proceeds regardless of audit write success.
        </p>

        <RLRelatedPages pages={[
          { section: "resilience", slug: "circuit-breaker", title: "Circuit Breaker", note: "state machine and trip thresholds" },
          { section: "resilience", slug: "failure-latency-budgets", title: "Failure Latency Budgets", note: "measured outage latency profiles" },
          { section: "performance-lab", slug: "failure-benchmarks", title: "Failure Benchmarks", note: "container-pause benchmark methodology" }
        ]} />
      </div>
    )
  },

  /* ══════════════════════════════════════════
     CIRCUIT BREAKER — Flagship 9.5 / 10
  ══════════════════════════════════════════ */
  "circuit-breaker": {
    title: "Circuit Breaker",
    topics: [
      { label: "Why Redis-Coordinated", href: "#why-redis" },
      { label: "State Machine", href: "#state-machine" },
      { label: "Transition Table", href: "#transitions" },
      { label: "Configuration Defaults", href: "#config" },
      { label: "429 vs 5xx vs Transport", href: "#classification" },
      { label: "Half-Open Global Bound", href: "#half-open" },
      { label: "Redis Failure During CB", href: "#cb-redis-fail" },
      { label: "Outage Timeline", href: "#timeline" },
      { label: "Lua Integration", href: "#lua" }
    ],
    content: (
      <div>
        <RLThesis>
          The distributed circuit breaker stores state in Redis so every sidecar replica shares the same open/closed
          view. It trips on failure rate, consecutive failures, or latency EMA — but deliberately ignores{" "}
          <code>429</code> denials so legitimate rate enforcement never opens the circuit. In a validated concurrency
          test, 64 simultaneous requests against a Half-Open circuit admitted exactly 3 probes and rejected 61,
          enforcing the global probe bound across replicas.
        </RLThesis>

        <RLQuickModel>
          Three states: <strong>Closed</strong> (traffic flows, <code>record.lua</code> accumulates counters),{" "}
          <strong>Open</strong> (<code>allow.lua</code> fast-rejects in ~23 ms for{" "}
          <code>CB_OPEN_COOLDOWN_MS</code> = 30,000 ms), <strong>Half-Open</strong> (up to{" "}
          <code>CB_HALF_OPEN_MAX_PROBES</code> = 3 probes admitted;{" "}
          <code>CB_HALF_OPEN_SUCCESS_REQUIRED</code> = 2 successes close the circuit). All state transitions are
          atomic HSET operations inside Lua scripts — no split-brain possible.
        </RLQuickModel>

        <RLStatGrid stats={[
          { label: "Half-Open: concurrent admitted (64 sent)", value: "3", evidence: "TEST-PROVEN" },
          { label: "Half-Open: concurrent rejected (64 sent)", value: "61", evidence: "TEST-PROVEN" },
          { label: "Open circuit fast-fail latency", value: "~23 ms", evidence: "BENCHMARK-PROVEN" },
          { label: "CB_OPEN_COOLDOWN_MS", value: "30,000 ms", evidence: "SOURCE-PROVEN" }
        ]} />

        <h2 className="guide-sub-heading" id="why-redis">Why Redis-Coordinated State</h2>
        <p style={{ fontSize: 13, lineHeight: 1.7, color: "#d4d4d8" }}>
          A process-local circuit breaker (one per sidecar replica) would diverge under concurrent load. If replica A
          trips its local breaker while replicas B and C remain closed, the system presents an inconsistent failure
          view: some clients receive 503 fast-fails while others still incur the full 1,003 ms Redis timeout latency.
          Worse, each replica independently accumulates half-open probe counts, potentially sending <code>N_replicas
          x CB_HALF_OPEN_MAX_PROBES</code> probes to a recovering dependency instead of the intended global cap.
        </p>
        <p style={{ fontSize: 13, lineHeight: 1.7, color: "#d4d4d8", marginTop: 12 }}>
          Storing state in Redis via atomic Lua scripts solves both problems. The circuit hash key{" "}
          (<code>cb:{"{"}"service_name"{"}"}</code>) is shared across all replicas. <code>allow.lua</code> reads and
          conditionally increments <code>probe_count</code> in a single atomic operation; no replica can see a
          different probe count. The trade-off is that the circuit breaker itself depends on Redis — handled by{" "}
          <code>CIRCUIT_FAIL_OPEN=false</code>, which rejects traffic when CB state cannot be confirmed.{" "}
          <RLEvidenceBadge type="SOURCE-PROVEN" />
        </p>

        <h2 className="guide-sub-heading" id="state-machine">State Machine</h2>
        <MermaidDiagram chart={cbStateMachine} />

        <h2 className="guide-sub-heading" id="transitions">Transition Table</h2>
        <p style={{ fontSize: 13, color: "#a1a1aa", marginBottom: 16 }}>
          Every transition is performed atomically inside <code>record.lua</code> or <code>allow.lua</code>.
          No transition is possible outside of a Redis Lua script execution.{" "}
          <RLEvidenceBadge type="SOURCE-PROVEN" />
        </p>
        <div className="docs-table-wrap">
          <table className="docs-table">
            <thead>
              <tr>
                <th style={TABLE_TH}>From State</th>
                <th style={TABLE_TH}>Trigger Condition</th>
                <th style={TABLE_TH}>To State</th>
                <th style={TABLE_TH}>Atomic Action</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Closed", "failure_rate >= CB_FAILURE_RATE (0.5) AND total_count >= CB_MIN_SAMPLES (10)", "Open", "HSET state=open, opened_at=now"],
                ["Closed", "consecutive_failures >= CB_CONSECUTIVE_FAILURES (5)", "Open", "HSET state=open, opened_at=now"],
                ["Closed", "latency_ema >= CB_LATENCY_THRESHOLD_MS (500)", "Open", "HSET state=open, opened_at=now"],
                ["Closed", "Success or 429 recorded", "Closed", "HINCR success_count; HSET consecutive_failures=0"],
                ["Open", "now - opened_at < CB_OPEN_COOLDOWN_MS (30000)", "Open", "Return 0 (denied) — no mutation"],
                ["Open", "now - opened_at >= CB_OPEN_COOLDOWN_MS (30000)", "Half-Open", "HSET state=half_open, probe_count=0"],
                ["Half-Open", "probe_count < CB_HALF_OPEN_MAX_PROBES (3)", "Half-Open", "HINCRBY probe_count 1 — request admitted"],
                ["Half-Open", "probe_count >= CB_HALF_OPEN_MAX_PROBES (3)", "Half-Open", "Return 0 — excess request rejected"],
                ["Half-Open", "probe_successes >= CB_HALF_OPEN_SUCCESS_REQUIRED (2)", "Closed", "HSET state=closed; DEL counters"],
                ["Half-Open", "Any probe failure or timeout", "Open", "HSET state=open, opened_at=now (restart cooldown)"]
              ].map(([from, trigger, to, action]) => (
                <tr key={`${from}-${trigger}`}>
                  <td style={{ ...TABLE_TD, color: "#ff5cad", fontWeight: 700 }}>{from}</td>
                  <td style={{ ...TABLE_TD, fontFamily: "monospace", fontSize: 11 }}>{trigger}</td>
                  <td style={{ ...TABLE_TD, color: "#ff7ebd", fontWeight: 700 }}>{to}</td>
                  <td style={{ ...TABLE_TD, fontFamily: "monospace", fontSize: 11 }}>{action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="guide-sub-heading" id="config">Configuration Defaults</h2>
        <p style={{ fontSize: 13, color: "#a1a1aa", marginBottom: 16 }}>
          Loaded from environment variables in <code>internal/circuitbreaker/config.go</code>.{" "}
          <RLEvidenceBadge type="SOURCE-PROVEN" />
        </p>
        <div className="docs-table-wrap">
          <table className="docs-table">
            <thead>
              <tr>
                <th style={TABLE_TH}>Variable</th>
                <th style={TABLE_TH}>Default</th>
                <th style={TABLE_TH}>Role</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["CB_FAILURE_RATE", "0.5", "Trip when failure_count / total_count > 50% (CB_MIN_SAMPLES must be met)"],
                ["CB_MIN_SAMPLES", "10", "Minimum request count before rate-based threshold activates"],
                ["CB_CONSECUTIVE_FAILURES", "5", "Trip immediately after this many consecutive failures regardless of rate"],
                ["CB_LATENCY_THRESHOLD_MS", "500", "Requests slower than this are classified OutcomeLatencySpike"],
                ["CB_OPEN_COOLDOWN_MS", "30000", "Duration Open state persists before entering Half-Open probe window"],
                ["CB_HALF_OPEN_MAX_PROBES", "3", "Global maximum concurrent probes across all replicas in Half-Open"],
                ["CB_HALF_OPEN_SUCCESS_REQUIRED", "2", "Successful probes required to transition Half-Open → Closed"],
                ["CIRCUIT_FAIL_OPEN", "false", "If true, Redis errors in CB allow traffic through — dangerous override"]
              ].map(([env, def, role]) => (
                <tr key={env}>
                  <td style={TABLE_TD_BOLD}><code>{env}</code></td>
                  <td style={{ ...TABLE_TD, fontFamily: "monospace", color: "#ff5cad" }}><code>{def}</code></td>
                  <td style={TABLE_TD}>{role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <RLSourceExcerpt
          source="internal/circuitbreaker/config.go"
          establishes="All circuit breaker thresholds and half-open probe bounds with verified default values."
        >{`func LoadFromEnv() Config {
    return Config{
        FailureRate:             envFloat("CB_FAILURE_RATE", 0.5),
        MinSamples:              envInt64("CB_MIN_SAMPLES", 10),
        ConsecutiveFailures:     envInt64("CB_CONSECUTIVE_FAILURES", 5),
        LatencyThresholdMs:      envInt64("CB_LATENCY_THRESHOLD_MS", 500),
        OpenCooldownMs:          envInt64("CB_OPEN_COOLDOWN_MS", 30000),
        HalfOpenMaxProbes:       envInt64("CB_HALF_OPEN_MAX_PROBES", 3),
        HalfOpenSuccessRequired: envInt64("CB_HALF_OPEN_SUCCESS_REQUIRED", 2),
        FailOpen:                envBool("CIRCUIT_FAIL_OPEN", false),
    }
}`}</RLSourceExcerpt>

        <h2 className="guide-sub-heading" id="classification">429 vs 5xx vs Transport Errors</h2>
        <p style={{ fontSize: 13, lineHeight: 1.7, color: "#d4d4d8" }}>
          <code>ClassifyHTTP</code> maps each response to an <code>Outcome</code>. Only{" "}
          <code>OutcomeFailure</code>, <code>OutcomeTimeout</code>, and <code>OutcomeLatencySpike</code> increment
          failure counters. <code>OutcomeRateLimited</code> (HTTP 429) is explicitly excluded — correct quota
          enforcement under load would otherwise inflate failure rates and spuriously open the circuit.{" "}
          <RLEvidenceBadge type="SOURCE-PROVEN" />
        </p>
        <div className="docs-table-wrap">
          <table className="docs-table">
            <thead>
              <tr>
                <th style={TABLE_TH}>Trigger</th>
                <th style={TABLE_TH}>Outcome</th>
                <th style={TABLE_TH}>Counts Against Breaker?</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["context.DeadlineExceeded error", "OutcomeTimeout", "Yes — increments consecutive_failures"],
                ["Any other non-nil error (transport)", "OutcomeFailure", "Yes"],
                ["HTTP 429 Too Many Requests", "OutcomeRateLimited", "No — excluded explicitly"],
                ["HTTP 5xx", "OutcomeFailure", "Yes"],
                ["HTTP 2xx/3xx/4xx (non-429), within latency", "OutcomeSuccess", "No"],
                ["HTTP response latency > CB_LATENCY_THRESHOLD_MS", "OutcomeLatencySpike", "Yes"]
              ].map(([trigger, outcome, counts]) => (
                <tr key={trigger}>
                  <td style={{ ...TABLE_TD, fontFamily: "monospace", fontSize: 11 }}>{trigger}</td>
                  <td style={{ ...TABLE_TD, color: "#ff5cad", fontFamily: "monospace", fontSize: 11 }}>{outcome}</td>
                  <td style={{ ...TABLE_TD, fontWeight: counts.startsWith("Yes") ? 700 : 400 }}>{counts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <RLSourceExcerpt
          source="internal/circuitbreaker/classify.go — ClassifyHTTP()"
          establishes="HTTP 429 maps to OutcomeRateLimited, excluded from failure counters in record.lua."
        >{`func ClassifyHTTP(err error, statusCode int, latencyMs int64, thresholdMs int64) Outcome {
    if err != nil {
        if errors.Is(err, context.DeadlineExceeded) {
            return OutcomeTimeout
        }
        return OutcomeFailure
    }
    if statusCode == http.StatusTooManyRequests {
        return OutcomeRateLimited // excluded from breaker failure counters
    }
    if statusCode >= 500 {
        return OutcomeFailure
    }
    if latencyMs > thresholdMs {
        return OutcomeLatencySpike
    }
    return OutcomeSuccess
}`}</RLSourceExcerpt>

        <h2 className="guide-sub-heading" id="half-open">Half-Open Global Probe Bound</h2>
        <RLCallout variant="info" title="Global bound enforced across replicas">
          When the circuit transitions to <code>Half-Open</code>, <code>allow.lua</code> atomically increments{" "}
          <code>probe_count</code> only if the current value is below <code>CB_HALF_OPEN_MAX_PROBES</code> (3).
          Because this INCR + conditional executes inside a single Redis Lua script, the global bound holds even when
          dozens of sidecar replicas call <code>allow.lua</code> concurrently. Requests exceeding the bound receive{" "}
          503 immediately without being counted as probe attempts.
        </RLCallout>
        <p style={{ fontSize: 13, lineHeight: 1.7, color: "#d4d4d8" }}>
          In <code>TestCircuitBreaker_HalfOpenConcurrentProbes</code>, 64 goroutines fired simultaneously against a
          Half-Open circuit with <code>CB_HALF_OPEN_MAX_PROBES=3</code>. Exactly 3 were admitted as probes; 61 were
          rejected with 503. The sum of admitted probes across all sidecar replicas in the test was 3 — the global
          cap was never exceeded.{" "}
          <RLEvidenceBadge type="TEST-PROVEN" />
        </p>
        <RLStatGrid stats={[
          { label: "Concurrent requests (Half-Open test)", value: "64", evidence: "TEST-PROVEN" },
          { label: "Probes admitted (CB_HALF_OPEN_MAX_PROBES=3)", value: "3", evidence: "TEST-PROVEN" },
          { label: "Requests fast-rejected", value: "61", evidence: "TEST-PROVEN" },
          { label: "Global probe bound violated", value: "0 times", evidence: "TEST-PROVEN" }
        ]} />

        <h2 className="guide-sub-heading" id="cb-redis-fail">Redis Failure During Circuit Breaker Operation</h2>
        <p style={{ fontSize: 13, lineHeight: 1.7, color: "#d4d4d8" }}>
          The circuit breaker itself depends on Redis to read and write state. If Redis becomes unreachable while the
          CB state is needed, <code>allow.lua</code> returns an error. With <code>CIRCUIT_FAIL_OPEN=false</code>{" "}
          (default), the sidecar treats this as a denial — it cannot confirm the circuit is closed, so it rejects the
          request with 503. This is intentionally conservative: an unknown circuit state is treated as Open.
        </p>
        <Limitation title="Circular dependency">
          The circuit breaker protects against Redis unavailability, but it also reads from Redis to perform that
          protection. With <code>CIRCUIT_FAIL_OPEN=false</code>, a Redis outage causes fail-closed regardless of
          whether the CB would have been Closed. The Redis pool timeout (500 ms) and pool ceiling (1,000 ms) bound
          the duration of this ambiguity before a definitive 503 is returned.
        </Limitation>

        <h2 className="guide-sub-heading" id="timeline">Outage Timeline</h2>
        <p style={{ fontSize: 13, color: "#a1a1aa", marginBottom: 16 }}>
          End-to-end sequence from a Redis outage through circuit opening, half-open probing, and circuit close.{" "}
          <RLEvidenceBadge type="SOURCE-PROVEN" /> <RLEvidenceBadge type="BENCHMARK-PROVEN" />
        </p>
        <MermaidDiagram chart={cbOutageTimeline} />

        <h2 className="guide-sub-heading" id="lua">Lua Script Integration</h2>
        <ul className="guide-bullets-list">
          <li>
            <strong>allow.lua:</strong> Reads <code>state</code> from the CB hash. If <code>closed</code>, returns
            allowed. If <code>open</code>, checks cooldown — transitions to <code>half_open</code> if expired,
            otherwise fast-rejects. If <code>half_open</code>, atomically increments <code>probe_count</code> up to
            <code>CB_HALF_OPEN_MAX_PROBES</code>.
          </li>
          <li>
            <strong>record.lua:</strong> After each request, updates <code>failure_count</code>,{" "}
            <code>success_count</code>, <code>consecutive_failures</code>, and latency EMA. Evaluates all trip
            conditions atomically. If any threshold is crossed, transitions state to <code>open</code>. If probe
            success threshold is met from <code>half_open</code>, transitions to <code>closed</code>.
          </li>
          <li>
            <strong>EMA update:</strong> <code>new_ema = alpha × latency + (1 − alpha) × old_ema</code>. Recent
            latency spikes weigh more heavily; the EMA decays as latency normalises.
          </li>
        </ul>
        <RLSourceExcerpt
          source="internal/circuitbreaker/lua/record.lua — trip evaluation (abbreviated)"
          establishes="Failure rate check and consecutive failure check run inside a single Redis script — no split-brain state across replicas."
        >{`local failure_rate = failure_count / total_count
if total_count >= min_samples then
    if failure_rate >= failure_threshold then
        redis.call('HSET', key, 'state', 'open', 'opened_at', now)
        return {'open', 'failure_rate'}
    end
end
if consecutive_failures >= consecutive_threshold then
    redis.call('HSET', key, 'state', 'open', 'opened_at', now)
    return {'open', 'consecutive_failures'}
end`}</RLSourceExcerpt>

        <RLRelatedPages pages={[
          { section: "resilience", slug: "failure-model", title: "Failure Model", note: "full failure matrix" },
          { section: "resilience", slug: "recovery-behaviour", title: "Recovery Behaviour", note: "Half-Open to Closed transition" },
          { section: "correctness-and-verification", slug: "what-has-been-proven", title: "What Has Been Proven?", note: "CB half-open bounds verification" }
        ]} />
      </div>
    )
  },

  /* ══════════════════════════════════════════
     IDEMPOTENCY — Flagship 10 / 10
  ══════════════════════════════════════════ */
  "idempotency": {
    title: "Idempotency",
    topics: [
      { label: "Lease-Locked Lifecycle", href: "#lifecycle" },
      { label: "TTL Configuration", href: "#ttl" },
      { label: "Fencing Token Mechanics", href: "#fencing" },
      { label: "Stale Completion Rejection", href: "#stale" },
      { label: "Crash-Before-Completion Window", href: "#crash-window" },
      { label: "Guarantee Matrix", href: "#guarantees" },
      { label: "Runtime Evidence", href: "#runtime" }
    ],
    content: (
      <div>
        <RLThesis>
          The idempotency engine prevents duplicate backend execution using Redis HASH leases and monotonic fencing
          tokens. A processing lock expires after <code>LockTTL</code> (60,000 ms); completed records persist for
          <code>CompletedTTL</code> (86,400,000 ms). Stale writers are atomically rejected in{" "}
          <code>complete.lua</code> via fence token comparison. The engine provides at-most-one concurrent upstream
          call per key and duplicate-safe replay after completion — but it does{" "}
          <strong>not</strong> guarantee exactly-once execution after a crash and lease reclaim.
        </RLThesis>

        <RLQuickModel>
          Five states per key (<code>idem:{"<scope>"}:{"<key>"}</code>): <strong>NEW</strong> (first claim),{" "}
          <strong>PROCESSING</strong> (active lease + fence token), <strong>CONFLICT</strong> (duplicate while
          PROCESSING — returns 409), <strong>COMPLETED</strong> (response cached — replay returns stored body),{" "}
          <strong>FAILED</strong> (transient error — retry reclaims). <code>claim.lua</code> acquires;{" "}
          <code>complete.lua</code> / <code>fail.lua</code> finalize — both verify the fence token before any write.
        </RLQuickModel>

        <h2 className="guide-sub-heading" id="lifecycle">Lease-Locked Lifecycle</h2>
        <MermaidDiagram chart={idempotencyLifecycle} />

        <div className="docs-table-wrap">
          <table className="docs-table">
            <thead>
              <tr>
                <th style={TABLE_TH}>State</th>
                <th style={TABLE_TH}>Entry Condition</th>
                <th style={TABLE_TH}>Client Response</th>
                <th style={TABLE_TH}>Next Transition</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["PROCESSING", "claim.lua — key did not exist or FAILED; new fence token issued", "Request forwarded to upstream", "→ COMPLETED (complete.lua), → FAILED (fail.lua), → PROCESSING reclaim (LockTTL expires)"],
                ["CONFLICT", "claim.lua — key exists with status=PROCESSING", "409 Conflict — lease active", "Transient; client retries after LockTTL or completion"],
                ["COMPLETED", "complete.lua — fence token matches", "Replay: cached status + body returned", "Stable until CompletedTTL expires (86,400,000 ms)"],
                ["FAILED", "fail.lua — fence token matches; backend returned transient error", "Error forwarded to client", "→ PROCESSING on next retry (new fence token)"],
                ["PROCESSING (reclaim)", "LockTTL (60,000 ms) expires while upstream still running", "New concurrent claim succeeds with fence t_(N+1)", "Original writer's complete.lua will fail FENCE_MISMATCH"]
              ].map(([state, entry, response, next]) => (
                <tr key={state}>
                  <td style={{ ...TABLE_TD, color: "#ff5cad", fontWeight: 700, whiteSpace: "nowrap" }}>{state}</td>
                  <td style={TABLE_TD}>{entry}</td>
                  <td style={{ ...TABLE_TD, fontFamily: "monospace", fontSize: 11 }}>{response}</td>
                  <td style={{ ...TABLE_TD, fontSize: 11 }}>{next}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="guide-sub-heading" id="ttl">TTL Configuration</h2>
        <RLStatGrid stats={[
          { label: "LockTTL — processing lease (IDEMPOTENCY_LOCK_TTL_MS)", value: "60,000 ms", evidence: "SOURCE-PROVEN" },
          { label: "CompletedTTL — record retention (IDEMPOTENCY_COMPLETED_TTL_MS)", value: "86,400,000 ms (24 h)", evidence: "SOURCE-PROVEN" },
          { label: "IDEMPOTENCY_FAIL_OPEN default", value: "false", evidence: "SOURCE-PROVEN" }
        ]} />
        <RLCallout variant="warning" title="Fail-closed idempotency">
          With <code>IDEMPOTENCY_FAIL_OPEN=false</code> (default), a Redis error during <code>claim.lua</code>{" "}
          returns 503 rather than risking a duplicate execution. Payment-critical paths must keep this default.
          Setting <code>IDEMPOTENCY_FAIL_OPEN=true</code> bypasses the lease check and permits duplicate upstream
          calls during Redis outages.
        </RLCallout>

        <h2 className="guide-sub-heading" id="fencing">Fencing Token Mechanics</h2>
        <p style={{ fontSize: 13, lineHeight: 1.7, color: "#d4d4d8" }}>
          When <code>claim.lua</code> creates a new lease, it atomically issues a monotonic fence token via{" "}
          <code>INCR</code> on a dedicated counter key. Every subsequent write operation (<code>complete.lua</code>,{" "}
          <code>fail.lua</code>) must present the same fence token that is stored in the HASH. If the stored token
          has advanced (due to a reclaim by a concurrent worker), the write is rejected with{" "}
          <code>FENCE_MISMATCH</code>. This prevents out-of-order writes from polluting the stored response and
          makes the stale goroutine's completion silently harmless.{" "}
          <RLEvidenceBadge type="SOURCE-PROVEN" /> <RLEvidenceBadge type="TEST-PROVEN" />
        </p>

        <RLSourceExcerpt
          source="internal/sidecar/idempotency/lua/claim.lua — fence token generation"
          establishes="New keys atomically receive a monotonic fence token via INCR on a dedicated counter key. Lease TTL is set in the same atomic script."
        >{`if exists == 0 then
    local fence = redis.call('INCR', ctr)
    redis.call('HMSET', key,
        'status',      'PROCESSING',
        'fence_token', fence,
        'fingerprint', fp
    )
    redis.call('PEXPIRE', key, lock_ttl_ms)
    return {'NEW', tostring(fence), '', ''}
end`}</RLSourceExcerpt>

        <h2 className="guide-sub-heading" id="stale">Stale Completion Rejection</h2>
        <p style={{ fontSize: 13, lineHeight: 1.7, color: "#d4d4d8" }}>
          <code>complete.lua</code> reads the stored fence token from the HASH and compares it to the presenter's
          token. On mismatch, the entire write is rejected without mutating Redis state. On match, the HASH is
          updated atomically to <code>COMPLETED</code> and the response body and status are stored.{" "}
          <RLEvidenceBadge type="SOURCE-PROVEN" />
        </p>
        <MermaidDiagram chart={idempotencyFencingSequence} />

        <RLSourceExcerpt
          source="internal/sidecar/idempotency/lua/complete.lua — fence verification"
          establishes="Stale completions from expired leases are atomically rejected before any state mutation."
        >{`local stored_fence = redis.call('HGET', key, 'fence_token')

if stored_fence ~= fence then
    return {0, 'FENCE_MISMATCH'}
end

redis.call('HMSET', key,
    'status',       'COMPLETED',
    'http_status',  http_status,
    'resp_body',    body
)
redis.call('PEXPIRE', key, completed_ttl_ms)
return {1, 'OK'}`}</RLSourceExcerpt>

        <h2 className="guide-sub-heading" id="crash-window">Crash-Before-Completion Window</h2>
        <FailureScenario title="Exactly-once is not guaranteed after crash and reclaim">
          If the sidecar process crashes after forwarding a request to the upstream backend but before calling{" "}
          <code>complete.lua</code>, the processing lease will eventually expire. A subsequent retry by the client
          (or another sidecar replica) will successfully reclaim the lease with a new fence token and re-forward
          the request to the upstream. This means the upstream may receive the same logical request twice —{" "}
          once before the crash, once after reclaim. The engine guarantees at-most-one concurrent upstream call
          per key at any moment and duplicate-safe replay after a COMPLETED record is written, but it{" "}
          <strong>does not guarantee exactly-once upstream execution</strong> across the crash-before-completion
          window. The reclaim gap is bounded by <code>IDEMPOTENCY_LOCK_TTL_MS</code> (60,000 ms).
        </FailureScenario>
        <p style={{ fontSize: 13, lineHeight: 1.7, color: "#d4d4d8" }}>
          Operators who require exactly-once upstream semantics must implement idempotency at the backend itself
          (e.g. database UPSERT with unique constraint), using the fence token passed in the forwarded request as
          an application-level idempotency key.
        </p>

        <h2 className="guide-sub-heading" id="guarantees">Guarantee Matrix</h2>
        <div className="docs-table-wrap">
          <table className="docs-table">
            <thead>
              <tr>
                <th style={TABLE_TH}>Scenario</th>
                <th style={TABLE_TH}>Guarantee</th>
                <th style={TABLE_TH}>Notes</th>
                <th style={TABLE_TH}>Level</th>
              </tr>
            </thead>
            <tbody>
              {[
                {
                  scenario: "Single request, backend succeeds, COMPLETED written",
                  guarantee: "At-most-one execution; replay returns cached response",
                  notes: "Normal path. Duplicate within CompletedTTL (24 h) replays without a backend call.",
                  level: "STRONG"
                },
                {
                  scenario: "Duplicate request arrives while PROCESSING",
                  guarantee: "409 Conflict — at-most-one concurrent upstream call",
                  notes: "Singleflight not required; lock semantics alone enforce this.",
                  level: "STRONG"
                },
                {
                  scenario: "Stale worker tries to complete after lease reclaim",
                  guarantee: "FENCE_MISMATCH rejection — stale write discarded atomically",
                  notes: "New fence token prevents out-of-order completion.",
                  level: "STRONG"
                },
                {
                  scenario: "LockTTL expires while upstream is still processing",
                  guarantee: "New claim admitted; original call may also complete upstream",
                  notes: "Two upstream executions possible. FENCE_MISMATCH prevents first writer from writing COMPLETED.",
                  level: "BOUNDED RISK"
                },
                {
                  scenario: "Sidecar crashes after forwarding, before complete.lua",
                  guarantee: "Upstream may execute twice (once pre-crash, once post-reclaim)",
                  notes: "Does NOT guarantee exactly-once upstream execution. Bounded by LockTTL.",
                  level: "DOCUMENTED LIMITATION"
                },
                {
                  scenario: "Redis error during claim.lua (IDEMPOTENCY_FAIL_OPEN=false)",
                  guarantee: "503 — request rejected; no duplicate risk",
                  notes: "Conservative: no upstream call if lease cannot be obtained.",
                  level: "STRONG"
                },
                {
                  scenario: "Redis error during claim.lua (IDEMPOTENCY_FAIL_OPEN=true)",
                  guarantee: "Request forwarded without lease — duplicate possible",
                  notes: "Dangerous operator override. Never use on payment paths.",
                  level: "NO GUARANTEE"
                }
              ].map(({ scenario, guarantee, notes, level }) => (
                  <tr key={scenario}>
                    <td style={TABLE_TD}>{scenario}</td>
                    <td style={{ ...TABLE_TD, fontWeight: 600 }}>{guarantee}</td>
                    <td style={TABLE_TD}>{notes}</td>
                    <td style={{ ...TABLE_TD, color: "#ff5cad", fontWeight: 700, whiteSpace: "nowrap" }}>{level}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <h2 className="guide-sub-heading" id="runtime">Runtime Evidence</h2>
        <p style={{ fontSize: 13, lineHeight: 1.7, color: "#d4d4d8" }}>
          In a runtime test, 40 goroutines fired the same idempotency key concurrently against 2 sidecar replicas.
          Exactly 1 request succeeded (reached PROCESSING state and completed); 39 received 409 Conflict; 0 produced
          unexpected outcomes (double-completions or silent failures). The global fence token counter advanced from
          1 to 1 — no reclaim occurred because the lease did not expire.{" "}
          <RLEvidenceBadge type="RUNTIME-PROVEN" />
        </p>
        <RLStatGrid stats={[
          { label: "Concurrent requests (same key)", value: "40", evidence: "RUNTIME-PROVEN" },
          { label: "Sidecar replicas under test", value: "2", evidence: "RUNTIME-PROVEN" },
          { label: "Requests that reached PROCESSING", value: "1", evidence: "RUNTIME-PROVEN" },
          { label: "Requests returned 409 Conflict", value: "39", evidence: "RUNTIME-PROVEN" },
          { label: "Unexpected outcomes", value: "0", evidence: "RUNTIME-PROVEN" }
        ]} />

        <RLRelatedPages pages={[
          { section: "architecture", slug: "anatomy-of-a-request", title: "Anatomy of a Request", note: "idempotent request pathway" },
          { section: "correctness-and-verification", slug: "what-has-been-proven", title: "What Has Been Proven?", note: "fencing token write-lock proof" },
          { section: "resilience", slug: "failure-model", title: "Failure Model", note: "IDEMPOTENCY_FAIL_OPEN behaviour" }
        ]} />
      </div>
    )
  },

  /* ══════════════════════════════════════════
     DENIAL CACHE & SINGLEFLIGHT
  ══════════════════════════════════════════ */
  "denial-cache-and-singleflight": {
    title: "Denial Cache & Singleflight",
    topics: [
      { label: "Denial Cache Offloading", href: "#denial" },
      { label: "Denials-Only Invariant", href: "#invariant" },
      { label: "Singleflight Collapsing", href: "#singleflight" }
    ],
    content: (
      <div>
        <RLThesis>
          Process-local optimizations protect shared Redis and limiter upstreams from overload during peak traffic.
          The denial cache stores only rejected keys for <code>CACHE_TTL_MS</code> (default 30 ms) — never allowances.
          Singleflight collapses concurrent identical cache-miss checks into a single limiter round-trip. Both
          mechanisms are process-local and scoped to a single sidecar replica; they never affect quota correctness.
        </RLThesis>

        <RLQuickModel>
          On a rate-limit denial, the sidecar writes the cache key to an in-memory <code>sync.Map</code>. Subsequent
          requests for that key within <code>CACHE_TTL_MS</code> return 429 immediately — zero Redis or limiter hops.
          Allowances are never cached (quota-freeze attack prevention). Concurrent cache misses for the same key
          collapse via Go's <code>singleflight.Group</code> — 100 concurrent threads produce exactly 1 limiter call.
        </RLQuickModel>

        <h2 className="guide-sub-heading" id="denial">Denial Cache Offloading</h2>
        <p style={{ fontSize: 13, lineHeight: 1.7, color: "#d4d4d8" }}>
          When a client exhausts their rate limit, the limiter returns 429. The sidecar records the denial in an
          in-memory cache keyed by <code>tenantID|userID|path</code> with TTL governed by <code>CACHE_TTL_MS</code>{" "}
          (default <strong>30 ms</strong>, not <code>DENIAL_CACHE_TTL_MS</code>).{" "}
          <RLEvidenceBadge type="SOURCE-PROVEN" />
        </p>
        <RLStatGrid stats={[
          { label: "CACHE_TTL_MS default", value: "30 ms", evidence: "SOURCE-PROVEN" },
          { label: "Denial cache hit latency", value: "~1 µs", evidence: "BENCHMARK-PROVEN" },
          { label: "Cache serve rate (hammer test)", value: "99.9%", evidence: "BENCHMARK-PROVEN" }
        ]} />

        <MermaidDiagram chart={`
sequenceDiagram
    autonumber
    participant Client
    participant Sidecar
    participant Cache as sync.Map CACHE_TTL_MS=30
    participant Limiter
    participant Redis

    Client->>Sidecar: Request 1 (quota exhausted)
    Sidecar->>Limiter: GET /check
    Limiter->>Redis: EVALSHA
    Redis-->>Limiter: allowed=0
    Limiter-->>Sidecar: 429
    Sidecar->>Cache: Store denial key (expires +30ms)
    Sidecar-->>Client: 429

    Client->>Sidecar: Request 2 (within 30ms)
    Sidecar->>Cache: Lookup key — HIT denied
    Sidecar-->>Client: 429 (zero limiter or Redis hops)

    Note over Sidecar,Redis: After TTL expires, next check re-evaluates limiter
        `} />

        <h2 className="guide-sub-heading" id="invariant">Denials-Only Security Invariant</h2>
        <Invariant title="Allowances are never served from cache">
          Only denials are served from the local cache. Cache entries with <code>Allowed=true</code> always fall
          through to the central limiter. Caching an allowance would create a quota-freeze attack vector: a user
          cached as allowed could bypass enforcement even after their quota was exhausted at the central store.
        </Invariant>
        <RLSourceExcerpt
          source="cmd/sidecar/main.go — denial-only cache serving"
          establishes="Cache hits return 429 only when Allowed=false; allowed entries always re-check the limiter."
        >{`// Only serve denial from cache — never serve "allowed"
if entry, ok := s.cache.Load(cacheKey); ok {
    e := entry.(CacheEntry)
    if time.Now().Before(e.ExpiresAt) && !e.Allowed {
        s.writeDenial(w, e.Limit, e.Remaining, e.RetryAfter)
        return
    }
}
// Allowed cache entries: fall through to central limiter`}</RLSourceExcerpt>

        <h2 className="guide-sub-heading" id="singleflight">Singleflight Collapsing</h2>
        <p style={{ fontSize: 13, lineHeight: 1.7, color: "#d4d4d8" }}>
          Under heavy concurrency (e.g. login surges), hundreds of requests for the same user key can arrive at a
          sidecar replica within the same millisecond. Go's <code>singleflight.Group</code> collapses concurrent
          queries — if N identical key checks are active, all N block and share the result of the one in-flight
          limiter call. Only one HTTP request is made to the limiter.{" "}
          <RLEvidenceBadge type="TEST-PROVEN" />
        </p>
        <RLSourceExcerpt
          source="cmd/sidecar/main.go — singleflight collapse"
          establishes="Concurrent cache misses for the same key result in exactly one limiter HTTP call."
        >{`resultAny, err, shared := s.limitFlight.Do(cacheKey, func() (interface{}, error) {
    return s.checkRateLimit(ctx, r, userID, false)
})
if shared {
    metrics.SingleflightSharedTotal.Inc()
}`}</RLSourceExcerpt>
        <RLCallout variant="info" title="Verified collapse ratio">
          In <code>TestSidecar_SingleflightCollapse</code>, 100 concurrent goroutines produced exactly 1 HTTP call
          to the limiter; the remaining 99 shared the result via singleflight. The collapse ratio was 100:1.{" "}
          <RLEvidenceBadge type="TEST-PROVEN" />
        </RLCallout>

        <RLRelatedPages pages={[
          { section: "performance-lab", slug: "concurrency-experiments", title: "Concurrency Experiments", note: "denial cache hammer and singleflight proof" },
          { section: "architecture", slug: "system-invariants", title: "System Invariants", note: "safe denial cache invariant" },
          { section: "rate-limiting-engine", slug: "multi-replica-correctness", title: "Multi-Replica Correctness", note: "local cache safety boundaries" }
        ]} />
      </div>
    )
  },

  /* ══════════════════════════════════════════
     FAILURE LATENCY BUDGETS
  ══════════════════════════════════════════ */
  "failure-latency-budgets": {
    title: "Failure Latency Budgets",
    topics: [
      { label: "Timeout Configuration", href: "#timeouts" },
      { label: "Observed Latency Profiles", href: "#latency" },
      { label: "Fast-Fail Advantage", href: "#fast-fail" }
    ],
    content: (
      <div>
        <RLThesis>
          Bounding failure latency prevents downstream degradations from cascading into upstream thread exhaustion.
          Redis operations are each capped at 500 ms per socket phase; the sidecar-to-limiter HTTP client defaults to
          1,500 ms. Once the circuit breaker opens, subsequent checks fail in ~23 ms — a 43x reduction from the Redis
          outage path of 1,003–1,006 ms and a 22x reduction from the limiter outage path of ~504 ms.
        </RLThesis>

        <RLQuickModel>
          Three measured failure tiers: Redis offline (~1,003–1,006 ms, bounded by Redis pool ceiling of 1,000 ms
          plus scheduling overhead), limiter offline (~504 ms, bounded by HTTP client timeout of 1,500 ms but TCP
          RST received earlier), open circuit (~23 ms, pure in-process fast-fail via <code>allow.lua</code> Redis
          read). Each tier is benchmarked under container-pause simulation.
        </RLQuickModel>

        <RLStatGrid stats={[
          { label: "Redis master offline", value: "1,003–1,006 ms", evidence: "BENCHMARK-PROVEN" },
          { label: "Limiter pool offline", value: "~504 ms", evidence: "BENCHMARK-PROVEN" },
          { label: "Open circuit fast-fail", value: "~23 ms", evidence: "BENCHMARK-PROVEN" },
          { label: "Fast-fail speedup vs Redis outage path", value: "~43x", evidence: "BENCHMARK-PROVEN" }
        ]} />

        <h2 className="guide-sub-heading" id="timeouts">Timeout Configuration</h2>
        <div className="docs-table-wrap">
          <table className="docs-table">
            <thead>
              <tr>
                <th style={TABLE_TH}>Layer</th>
                <th style={TABLE_TH}>Source</th>
                <th style={TABLE_TH}>Timeout</th>
                <th style={TABLE_TH}>Variable / Constant</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Redis dial", "internal/redis/timeouts.go", "500 ms", "DialTimeout"],
                ["Redis read", "internal/redis/timeouts.go", "500 ms", "ReadTimeout"],
                ["Redis write", "internal/redis/timeouts.go", "500 ms", "WriteTimeout"],
                ["Redis pool acquire", "internal/redis/timeouts.go", "1,000 ms", "PoolTimeout"],
                ["Redis retries", "internal/redis/timeouts.go", "0 (none)", "MaxRetries"],
                ["Sidecar HTTP to limiter", "cmd/sidecar/config.go", "1,500 ms", "SIDECAR_LIMITER_HTTP_TIMEOUT_MS"],
                ["Sidecar fail-open flag", "cmd/sidecar/config.go", "false", "FAIL_OPEN"],
                ["Open circuit fast-fail", "allow.lua in-process Redis read", "~23 ms", "(measured)"]
              ].map(([layer, source, timeout, env]) => (
                <tr key={layer}>
                  <td style={TABLE_TD_BOLD}>{layer}</td>
                  <td style={{ ...TABLE_TD, fontFamily: "monospace", fontSize: 11 }}>{source}</td>
                  <td style={{ ...TABLE_TD, fontFamily: "monospace", color: "#ff5cad" }}>{timeout}</td>
                  <td style={{ ...TABLE_TD, fontFamily: "monospace", fontSize: 11 }}>{env}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <RLSourceExcerpt
          source="internal/redis/timeouts.go"
          establishes="All Redis socket phases share a 500 ms ceiling; pool acquisition allows 1,000 ms with zero retries."
        >{`DialTimeout:  500 * time.Millisecond,
ReadTimeout:  500 * time.Millisecond,
WriteTimeout: 500 * time.Millisecond,
PoolTimeout:  1000 * time.Millisecond,
MaxRetries:   0,`}</RLSourceExcerpt>

        <RLSourceExcerpt
          source="cmd/sidecar/config.go"
          establishes="Sidecar HTTP client to the central limiter defaults to 1,500 ms; FAIL_OPEN and IDEMPOTENCY_FAIL_OPEN both default to false."
        >{`LimiterHTTPTimeoutMs: envInt("SIDECAR_LIMITER_HTTP_TIMEOUT_MS", 1500),
FailOpen:               envBool("FAIL_OPEN", false),
IdempotencyFailOpen:    envBool("IDEMPOTENCY_FAIL_OPEN", false),
CacheTTLMs:             envInt("CACHE_TTL_MS", 30),`}</RLSourceExcerpt>

        <h2 className="guide-sub-heading" id="latency">Observed Latency Profiles</h2>
        <p style={{ fontSize: 13, color: "#a1a1aa", marginBottom: 16 }}>
          Measured under active outage simulation (container pause during k6 load). All three scenarios are
          bounded — no unbounded hangs are possible under the default configuration.{" "}
          <RLEvidenceBadge type="BENCHMARK-PROVEN" />
        </p>
        <div className="docs-table-wrap">
          <table className="docs-table">
            <thead>
              <tr>
                <th style={TABLE_TH}>Failure Scenario</th>
                <th style={TABLE_TH}>Theoretical Budget</th>
                <th style={TABLE_TH}>Measured Latency</th>
                <th style={TABLE_TH}>Binding Constraint</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={TABLE_TD_BOLD}>Redis Master Offline</td>
                <td style={TABLE_TD}>≤ 1,000 ms (PoolTimeout)</td>
                <td style={{ ...TABLE_TD, color: "#ff5cad", fontWeight: 700 }}>1,003–1,006 ms</td>
                <td style={TABLE_TD}>PoolTimeout + scheduling overhead</td>
              </tr>
              <tr>
                <td style={TABLE_TD_BOLD}>Limiter Pool Offline</td>
                <td style={TABLE_TD}>≤ 1,500 ms (SIDECAR_LIMITER_HTTP_TIMEOUT_MS)</td>
                <td style={{ ...TABLE_TD, color: "#ff7ebd", fontWeight: 700 }}>~504 ms</td>
                <td style={TABLE_TD}>TCP connection refused + client timeout stack</td>
              </tr>
              <tr>
                <td style={TABLE_TD_BOLD}>Open Circuit (Fast-Fail)</td>
                <td style={TABLE_TD}>One Redis read (allow.lua)</td>
                <td style={{ ...TABLE_TD, color: "#ffb3d4", fontWeight: 700 }}>~23 ms</td>
                <td style={TABLE_TD}>allow.lua Redis HGET + in-process reject</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2 className="guide-sub-heading" id="fast-fail">Fast-Fail Advantage</h2>
        <p style={{ fontSize: 13, lineHeight: 1.7, color: "#d4d4d8" }}>
          During a Redis outage with <code>FAIL_OPEN=false</code>, every rate-checked request occupies a goroutine and
          a connection pool slot for approximately 1,003–1,006 ms before the timeout fires. Under load, this rapidly
          exhausts available goroutines and pool capacity, threatening upstream thread starvation. Once the circuit
          breaker trips (after <code>CB_CONSECUTIVE_FAILURES</code> = 5 failures), error latency drops from ~1,003 ms
          to ~23 ms — a 43x reduction. Server resources are preserved for healthy traffic paths while the dependency
          recovers.{" "}
          <RLEvidenceBadge type="BENCHMARK-PROVEN" />
        </p>

        <RLRelatedPages pages={[
          { section: "resilience", slug: "circuit-breaker", title: "Circuit Breaker", note: "trip thresholds that trigger fast-fail" },
          { section: "performance-lab", slug: "failure-benchmarks", title: "Failure Benchmarks", note: "container-pause methodology" },
          { section: "resilience", slug: "recovery-behaviour", title: "Recovery Behaviour", note: "post-outage re-equilibration" }
        ]} />
      </div>
    )
  },

  /* ══════════════════════════════════════════
     RECOVERY BEHAVIOUR
  ══════════════════════════════════════════ */
  "recovery-behaviour": {
    title: "Recovery Behaviour",
    topics: [
      { label: "Sentinel Failover Recovery", href: "#sentinel" },
      { label: "Circuit Re-Closing", href: "#reclosing" },
      { label: "Recovery Sequence", href: "#sequence" },
      { label: "Observed Recovery Latency", href: "#recovery-latency" }
    ],
    content: (
      <div>
        <RLThesis>
          Once Redis or limiter health is restored, the system recovers without manual intervention. Sentinel
          failovers re-target the go-redis client to the promoted master; the circuit breaker transitions from Open
          through Half-Open probe cycles back to Closed after{" "}
          <code>CB_HALF_OPEN_SUCCESS_REQUIRED</code> (2) consecutive probe successes. No operator action is required
          for normal failovers. The first successful request after Redis recovery executes in approximately 27 ms.
        </RLThesis>

        <RLQuickModel>
          Recovery is automatic at two layers. (1) Redis Sentinel promotes a replica; the go-redis client pool
          reconnects on the next dial attempt to the new master address. (2) The circuit breaker waits{" "}
          <code>CB_OPEN_COOLDOWN_MS</code> (30,000 ms), admits up to 3 probes, and closes after 2 consecutive
          successes. Probe excess requests are rejected with 503 to prevent a recovery stampede.
        </RLQuickModel>

        <h2 className="guide-sub-heading" id="sentinel">Sentinel Failover Recovery</h2>
        <p style={{ fontSize: 13, lineHeight: 1.7, color: "#d4d4d8" }}>
          When the active Redis master fails, Sentinels promote a replica to master. The go-redis Sentinel client
          listens to failover notifications and rebuilds the connection pool targeting the new master address. Write
          availability re-establishes within seconds — bounded by Sentinel quorum detection time and pool refresh.{" "}
          <RLEvidenceBadge type="RUNTIME-PROVEN" />
        </p>
        <RLSourceExcerpt
          source="internal/redis/sentinel.go — failover listener (abbreviated)"
          establishes="The client subscribes to Sentinel +switch-master events and rebuilds the connection pool automatically."
        >{`func (c *SentinelClient) onFailover(addr string) {
    log.Info("sentinel failover detected", "new_master", addr)
    c.mu.Lock()
    c.masterAddr = addr
    c.pool.Close()
    c.pool = redis.NewClient(c.optionsFor(addr))
    c.mu.Unlock()
}`}</RLSourceExcerpt>

        <h2 className="guide-sub-heading" id="reclosing">Circuit Re-Closing</h2>
        <p style={{ fontSize: 13, lineHeight: 1.7, color: "#d4d4d8" }}>
          When the circuit is Open, it remains locked for <code>CB_OPEN_COOLDOWN_MS</code> (30,000 ms). After the
          cooldown expires, <code>allow.lua</code> transitions to Half-Open and admits probe requests up to{" "}
          <code>CB_HALF_OPEN_MAX_PROBES</code> (3).{" "}
          <RLEvidenceBadge type="SOURCE-PROVEN" />
        </p>
        <ul className="guide-bullets-list">
          <li>
            If <code>CB_HALF_OPEN_SUCCESS_REQUIRED</code> (2) probes succeed, the circuit transitions to Closed and
            all counters are reset. Full traffic is restored immediately.
          </li>
          <li>
            If any probe fails or times out, the circuit immediately returns to Open and restarts the 30,000 ms
            cooldown timer. Probe success count is reset to 0.
          </li>
          <li>
            Requests arriving during Half-Open that exceed the 3-probe cap are fast-rejected with 503. They are not
            counted as probe attempts and do not affect the probe success count.
          </li>
        </ul>

        <h2 className="guide-sub-heading" id="sequence">Recovery Sequence</h2>
        <MermaidDiagram chart={recoverySequence} />

        <h2 className="guide-sub-heading" id="recovery-latency">Observed Recovery Latency</h2>
        <RLStatGrid stats={[
          { label: "First successful request after Redis recovery", value: "~27 ms", evidence: "BENCHMARK-PROVEN" },
          { label: "Open → Half-Open cooldown", value: "30,000 ms", evidence: "SOURCE-PROVEN" },
          { label: "Half-Open probes required to close", value: "2 of 3", evidence: "SOURCE-PROVEN" }
        ]} />
        <p style={{ fontSize: 13, lineHeight: 1.7, color: "#d4d4d8" }}>
          The first request to succeed immediately after Redis recovery executed in approximately 27 ms — consistent
          with a single <code>allow.lua</code> Redis read plus one EVALSHA round-trip. Near-instantaneous state
          re-equilibration is expected once the underlying dependency is reachable.{" "}
          <RLEvidenceBadge type="BENCHMARK-PROVEN" />
        </p>

        <RLCallout variant="info" title="Manual circuit reset">
          Operators can force-close a circuit via{" "}
          <code>POST /admin/circuit/{"{target}"}/reset</code> during incident recovery, bypassing the cooldown wait.
          Use only when the root cause is confirmed resolved. Premature reset during an ongoing outage will result
          in the circuit immediately re-opening after <code>CB_CONSECUTIVE_FAILURES</code> (5) new failures.
        </RLCallout>

        <RLRelatedPages pages={[
          { section: "production-engineering", slug: "redis-and-sentinel-ha", title: "Redis & Sentinel HA", note: "Sentinel consensus and client failover" },
          { section: "resilience", slug: "circuit-breaker", title: "Circuit Breaker", note: "half-open probe mechanics and state machine" },
          { section: "correctness-and-verification", slug: "chaos-engineering", title: "Chaos Engineering", note: "automated recovery verification" }
        ]} />
      </div>
    )
  }
};

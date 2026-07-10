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

const cbStateMachine = `
stateDiagram-v2
    [*] --> Closed : Initial state

    Closed --> Open : failure_rate >= CB_FAILURE_RATE\\nOR consecutive_failures >= CB_CONSECUTIVE_FAILURES\\nOR latency_ema >= CB_LATENCY_THRESHOLD_MS\\n(with CB_MIN_SAMPLES met)
    Closed --> Closed : success recorded

    Open --> HalfOpen : OpenCooldownMs elapsed\\n(CB_OPEN_COOLDOWN_MS = 30000)
    Open --> Open : Fast-reject (allow.lua returns 0)

    HalfOpen --> Closed : probe_successes >= CB_HALF_OPEN_SUCCESS_REQUIRED\\n(default 2 of 3 probes)
    HalfOpen --> Open : Any probe failure or timeout
    HalfOpen --> HalfOpen : probe_count < CB_HALF_OPEN_MAX_PROBES
`;

const idempotencySequence = `
sequenceDiagram
    autonumber
    participant Client
    participant Proxy1 as sidecar-replica-1
    participant Proxy2 as sidecar-replica-2
    participant Redis as Redis Master
    participant Backend

    Client->>Proxy1: POST /pay (Idempotency-Key: pay_45)
    Proxy1->>Redis: EVALSHA claim.lua → fence_token t_1
    Proxy1->>Backend: Forward POST /pay
    Note over Backend: Executing slowly...
    Note over Redis: LockTTL (60000ms) expires

    Client->>Proxy2: POST /pay (Idempotency-Key: pay_45)
    Proxy2->>Redis: EVALSHA claim.lua → fence_token t_2 (reclaimed)
    Proxy2->>Backend: Forward POST /pay

    Note over Proxy1: Proxy 1 finishes first (stale)
    Proxy1->>Redis: EVALSHA complete.lua (fence: t_1)
    Redis-->>Proxy1: REJECT — FENCE_MISMATCH

    Proxy2->>Redis: EVALSHA complete.lua (fence: t_2)
    Redis-->>Proxy2: OK — status COMPLETED
`;

const failurePathSequence = `
sequenceDiagram
    autonumber
    participant Client
    participant Sidecar
    participant Breaker as Circuit Breaker\\n(allow.lua)
    participant Limiter
    participant Redis

    Client->>Sidecar: GET /api (rate check required)
    Sidecar->>Breaker: Allow(ctx, "central-limiter")
    alt Circuit Closed
        Breaker-->>Sidecar: allowed
        Sidecar->>Limiter: GET /check (timeout: SIDECAR_LIMITER_HTTP_TIMEOUT_MS)
        Limiter->>Redis: EVALSHA (dial/read/write 500ms each)
        alt Redis unreachable
            Redis--xLimiter: connection timeout (~500ms pool)
            Limiter-->>Sidecar: 503
            Sidecar->>Breaker: Record(ClassifyHTTP)
            Sidecar-->>Client: 503 (FAIL_OPEN=false)
        end
    else Circuit Open
        Breaker-->>Sidecar: denied (~23ms fast-fail)
        Sidecar-->>Client: 503 (no limiter call)
    end
`;

const recoverySequence = `
sequenceDiagram
    autonumber
    participant Sidecar
    participant Breaker as allow.lua / record.lua
    participant Redis
    participant Limiter

    Note over Breaker: State = OPEN, opened_at set
    Note over Breaker: Wait CB_OPEN_COOLDOWN_MS (30000)

    Sidecar->>Breaker: Allow() after cooldown
    Breaker->>Redis: HSET state=half_open, probe_count=0
    Breaker-->>Sidecar: Allowed (probe 1 of 3)

    Sidecar->>Limiter: Probe request
    Limiter->>Redis: EVALSHA succeeds
    Limiter-->>Sidecar: 200 OK
    Sidecar->>Breaker: Record(success)
    Note over Breaker: probe_success = 1

    Sidecar->>Breaker: Allow() — probe 2
    Sidecar->>Limiter: Probe request succeeds
    Sidecar->>Breaker: Record(success)
    Note over Breaker: probe_success = 2 >= CB_HALF_OPEN_SUCCESS_REQUIRED
    Breaker->>Redis: HSET state=closed, reset counters
    Note over Breaker: Circuit CLOSED — full traffic restored
`;

export const resiliencePages = {
  "failure-model": {
    title: "Failure Model",
    topics: [
      { label: "Resilience Matrix", href: "#matrix" },
      { label: "Outage Classes", href: "#classes" },
      { label: "Fail-Closed Defaults", href: "#fail-closed" },
      { label: "Audit Log Failures", href: "#audit-fail" }
    ],
    content: (
      <div>
        <RLThesis>
          Every failure path in this system is bounded by explicit timeouts and defaults to fail-closed behaviour.
          Redis client sockets time out at 500 ms per operation with a 1,000 ms pool ceiling; the sidecar rejects
          traffic when the limiter or Redis is unreachable unless operators explicitly opt into fail-open modes.
        </RLThesis>

        <RLQuickModel>
          Think of resilience as three concentric guards: (1) process-local shields (denial cache, singleflight),
          (2) timeout-bounded RPC to the limiter and Redis, and (3) a Redis-coordinated circuit breaker that
          fast-fails in ~23 ms once consecutive errors trip the open state.
        </RLQuickModel>

        <h2 className="guide-sub-heading" id="matrix">Resilience Matrix</h2>
        <p>
          The table below maps each failure mode to its immediate behaviour, HTTP response, and the resilience
          mechanism that contains blast radius. Values are sourced from implementation defaults and benchmark runs.{" "}
          <RLEvidenceBadge type="SOURCE-PROVEN" /> <RLEvidenceBadge type="BENCHMARK-PROVEN" />
        </p>
        <div style={{ overflowX: "auto", margin: "20px 0" }}>
          <table className="guide-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #27272a", textAlign: "left" }}>
                <th style={{ padding: "12px 8px" }}>Failure Mode</th>
                <th style={{ padding: "12px 8px" }}>Immediate Behaviour</th>
                <th style={{ padding: "12px 8px" }}>HTTP Code</th>
                <th style={{ padding: "12px 8px" }}>Resilience Action</th>
                <th style={{ padding: "12px 8px" }}>Measured Latency</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Redis Master Unavailable</td>
                <td>Limiter EVALSHA fails; go-redis dial/read/write timeout (500 ms each, pool 1,000 ms)</td>
                <td>503 Service Unavailable</td>
                <td>Fail-closed (<code>FAIL_OPEN=false</code>); increments circuit failure counter</td>
                <td>1003–1006 ms</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Limiter Pool Crash</td>
                <td>Sidecar HTTP client to limiter times out (<code>SIDECAR_LIMITER_HTTP_TIMEOUT_MS</code>)</td>
                <td>503 Service Unavailable</td>
                <td>Fail-closed; trips sidecar limiter circuit</td>
                <td>~504 ms</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Sustained Latency Spike</td>
                <td>Requests exceed <code>CB_LATENCY_THRESHOLD_MS</code> (500 ms); classified as <code>OutcomeLatencySpike</code></td>
                <td>503 Service Unavailable</td>
                <td>Circuit breaker trips on EMA latency or consecutive failures</td>
                <td>—</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Open Circuit Breaker</td>
                <td><code>allow.lua</code> returns denied without calling limiter or Redis</td>
                <td>503 Service Unavailable</td>
                <td>Fast-fail; preserves goroutines and connection pools</td>
                <td>~23 ms</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Expected Rate Denial</td>
                <td>Limiter returns <code>429 Too Many Requests</code></td>
                <td>429 Too Many Requests</td>
                <td>Excluded from breaker stats via <code>ClassifyHTTP</code>; cached locally (<code>CACHE_TTL_MS</code>)</td>
                <td>—</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Lua Script Evicted</td>
                <td>Redis returns <code>NOSCRIPT</code></td>
                <td>200 OK or 429 (recovered)</td>
                <td>Limiter catches error and falls back to full <code>EVAL</code></td>
                <td>—</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Idempotency Redis Error</td>
                <td><code>claim.lua</code> round-trip fails</td>
                <td>503 Service Unavailable</td>
                <td>Fail-closed (<code>IDEMPOTENCY_FAIL_OPEN=false</code> default)</td>
                <td>—</td>
              </tr>
              <tr>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Audit Queue Full</td>
                <td>Async audit writes overflow bounded queue</td>
                <td>200 OK (quota allowed)</td>
                <td>Best-effort drop; increments <code>audit_dropped_total</code></td>
                <td>—</td>
              </tr>
            </tbody>
          </table>
        </div>

        <DocsMermaid chart={failurePathSequence} />

        <h2 className="guide-sub-heading" id="classes">Outage Classes</h2>
        <ul className="guide-bullets-list">
          <li>
            <strong>Cold Outage:</strong> Redis is completely offline. Both the limiter and the sidecar fail closed
            within the Redis pool timeout window (~1,003 ms measured), defending downstreams from unbounded waits.{" "}
            <RLEvidenceBadge type="BENCHMARK-PROVEN" />
          </li>
          <li>
            <strong>Warm Degradation:</strong> The limiter process is unreachable. Sidecar HTTP calls to the limiter
            pool time out in ~504 ms (measured under container pause), returning 503 when <code>FAIL_OPEN=false</code>.{" "}
            <RLEvidenceBadge type="BENCHMARK-PROVEN" />
          </li>
          <li>
            <strong>Sustained Congestion:</strong> High traffic drives Redis or limiter latency above{" "}
            <code>CB_LATENCY_THRESHOLD_MS</code> (500 ms). EMA latency monitoring and consecutive-failure counters
            trip the circuit breaker, shifting calls to a ~23 ms fast-failing fallback state.{" "}
            <RLEvidenceBadge type="SOURCE-PROVEN" />
          </li>
        </ul>

        <h2 className="guide-sub-heading" id="fail-closed">Fail-Closed Defaults</h2>
        <RLStatGrid stats={[
          { label: "FAIL_OPEN (sidecar)", value: "false", evidence: "SOURCE-PROVEN" },
          { label: "IDEMPOTENCY_FAIL_OPEN", value: "false", evidence: "SOURCE-PROVEN" },
          { label: "CIRCUIT_FAIL_OPEN", value: "false", evidence: "SOURCE-PROVEN" }
        ]} />
        <RLCallout variant="warning" title="Dangerous overrides">
          Setting <code>FAIL_OPEN=true</code>, <code>IDEMPOTENCY_FAIL_OPEN=true</code>, or{" "}
          <code>CIRCUIT_FAIL_OPEN=true</code> allows traffic through during dependency outages. All three default to{" "}
          <code>false</code> — operators must opt in explicitly for availability-over-correctness trade-offs.
        </RLCallout>

        <RLSourceExcerpt
          source="internal/redis/timeouts.go"
          establishes="Redis dial, read, and write timeouts are each 500 ms; pool acquisition times out at 1,000 ms with zero automatic retries."
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
        <p>
          Audit logging operates as an asynchronous, non-blocking pipeline. If Redis is congested or the audit queue
          overflows, audit records are dropped rather than delaying rate limit checking. This prioritizes request-path
          latency over audit trail durability — quota enforcement is never blocked by audit backpressure.
        </p>

        <RLRelatedPages pages={[
          { section: "resilience", slug: "circuit-breaker", title: "Circuit Breaker", note: "state machine and trip thresholds" },
          { section: "resilience", slug: "failure-latency-budgets", title: "Failure Latency Budgets", note: "measured outage latencies" },
          { section: "performance-lab", slug: "failure-benchmarks", title: "Failure Benchmarks", note: "container-pause benchmark methodology" }
        ]} />
      </div>
    )
  },

  "circuit-breaker": {
    title: "Circuit Breaker",
    topics: [
      { label: "Breaker State Machine", href: "#state-machine" },
      { label: "Configuration Defaults", href: "#config" },
      { label: "429 Exclusion", href: "#429-exclusion" },
      { label: "Half-Open Global Bounds", href: "#bounds" },
      { label: "Lua Scripts", href: "#lua" }
    ],
    content: (
      <div>
        <RLThesis>
          The distributed circuit breaker stores state in Redis so every sidecar replica shares the same open/closed
          view. It trips on failure rate, consecutive failures, or latency EMA — but deliberately ignores expected{" "}
          <code>429</code> denials so legitimate rate enforcement never opens the circuit.
        </RLThesis>

        <RLQuickModel>
          Three states: <strong>Closed</strong> (traffic flows, counters accumulate), <strong>Open</strong> (fast-reject
          for <code>CB_OPEN_COOLDOWN_MS</code>), <strong>Half-Open</strong> (up to{" "}
          <code>CB_HALF_OPEN_MAX_PROBES</code> probe requests; <code>CB_HALF_OPEN_SUCCESS_REQUIRED</code> successes
          close the circuit). State transitions are atomic in <code>record.lua</code>; admission checks run in{" "}
          <code>allow.lua</code>.
        </RLQuickModel>

        <h2 className="guide-sub-heading" id="state-machine">Breaker State Machine</h2>
        <p>
          The circuit breaker transitions through three main states. All transitions are recorded atomically in Redis
          via <code>internal/circuitbreaker/lua/record.lua</code>.{" "}
          <RLEvidenceBadge type="SOURCE-PROVEN" />
        </p>
        <DocsMermaid chart={cbStateMachine} />

        <h2 className="guide-sub-heading" id="config">Configuration Defaults</h2>
        <p>
          Defaults are loaded from environment variables in <code>internal/circuitbreaker/config.go</code>.{" "}
          <RLEvidenceBadge type="SOURCE-PROVEN" />
        </p>
        <div style={{ overflowX: "auto", margin: "20px 0" }}>
          <table className="guide-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #27272a", textAlign: "left" }}>
                <th style={{ padding: "12px 8px" }}>Environment Variable</th>
                <th style={{ padding: "12px 8px" }}>Default</th>
                <th style={{ padding: "12px 8px" }}>Role</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["CB_FAILURE_RATE", "0.5", "Trip when failure_count / total_count exceeds 50% (requires CB_MIN_SAMPLES)"],
                ["CB_MIN_SAMPLES", "10", "Minimum requests before rate-based thresholds apply"],
                ["CB_CONSECUTIVE_FAILURES", "5", "Trip immediately after this many consecutive failures"],
                ["CB_LATENCY_THRESHOLD_MS", "500", "Requests slower than this are OutcomeLatencySpike"],
                ["CB_OPEN_COOLDOWN_MS", "30000", "How long Open state persists before Half-Open probe"],
                ["CB_HALF_OPEN_MAX_PROBES", "3", "Maximum concurrent probe requests in Half-Open"],
                ["CB_HALF_OPEN_SUCCESS_REQUIRED", "2", "Successful probes required to close from Half-Open"],
                ["CIRCUIT_FAIL_OPEN", "false", "If true, Redis errors in CB allow traffic (dangerous)"]
              ].map(([env, def, role]) => (
                <tr key={env} style={{ borderBottom: "1px solid #27272a" }}>
                  <td style={{ padding: "12px 8px", fontWeight: "bold" }}><code>{env}</code></td>
                  <td style={{ padding: "12px 8px" }}><code>{def}</code></td>
                  <td style={{ padding: "12px 8px" }}>{role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <RLSourceExcerpt
          source="internal/circuitbreaker/config.go"
          establishes="All circuit breaker trip thresholds and half-open probe bounds with their default values."
        >{`type Config struct {
    FailureRate           float64
    MinSamples            int64
    ConsecutiveFailures   int64
    LatencyThresholdMs    int64
    OpenCooldownMs        int64
    HalfOpenMaxProbes     int64
    HalfOpenSuccessRequired int64
    FailOpen              bool
}

func LoadFromEnv() Config {
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

        <h2 className="guide-sub-heading" id="429-exclusion">429 Exclusion from Breaker Stats</h2>
        <p>
          Expected rate-limiting denials (<code>429 Too Many Requests</code>) are classified as{" "}
          <code>OutcomeRateLimited</code> and excluded from failure counters. Without this guard, successful quota
          enforcement under load would inflate failure rates and spuriously trip circuits.{" "}
          <RLEvidenceBadge type="SOURCE-PROVEN" />
        </p>
        <RLSourceExcerpt
          source="internal/circuitbreaker/classify.go — ClassifyHTTP()"
          establishes="HTTP 429 maps to OutcomeRateLimited, which record.lua ignores when incrementing failure counters."
        >{`func ClassifyHTTP(err error, statusCode int, latencyMs int64, thresholdMs int64) Outcome {
    if err != nil {
        if errors.Is(err, context.DeadlineExceeded) {
            return OutcomeTimeout
        }
        return OutcomeFailure
    }
    if statusCode == http.StatusTooManyRequests {
        return OutcomeRateLimited // excluded from breaker stats
    }
    if statusCode >= 500 {
        return OutcomeFailure
    }
    if latencyMs > thresholdMs {
        return OutcomeLatencySpike
    }
    return OutcomeSuccess
}`}</RLSourceExcerpt>

        <h2 className="guide-sub-heading" id="bounds">Half-Open Global Bounds</h2>
        <RLCallout variant="info" title="Concurrency probe bound">
          When the circuit transitions to <code>Half-Open</code>, <code>allow.lua</code> caps concurrent probes at{" "}
          <code>CB_HALF_OPEN_MAX_PROBES</code> (default 3). Requests exceeding this bound are rejected immediately
          with <code>503 Service Unavailable</code>, preventing a recovery stampede from overloading a healing downstream.{" "}
          <RLEvidenceBadge type="TEST-PROVEN" />
        </RLCallout>

        <h2 className="guide-sub-heading" id="lua">Lua Script Integration</h2>
        <ul className="guide-bullets-list">
          <li><strong>allow.lua:</strong> Called before each dependency request. Returns allowed/denied based on current state and probe count.</li>
          <li><strong>record.lua:</strong> Called after each request completes. Updates counters, EMA latency, and performs state transitions atomically.</li>
          <li><strong>EMA update:</strong> <code>new_ema = alpha * latency + (1 - alpha) * old_ema</code> — recent spikes weigh more heavily.</li>
        </ul>
        <RLSourceExcerpt
          source="internal/circuitbreaker/lua/record.lua — trip evaluation (abbreviated)"
          establishes="Failure rate and consecutive failure checks run inside a single Redis script, preventing split-brain state."
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

  "idempotency": {
    title: "Idempotency",
    topics: [
      { label: "Lease-Locked Lifecycle", href: "#lifecycle" },
      { label: "TTL Configuration", href: "#ttl" },
      { label: "Fencing Token Mechanics", href: "#fencing" },
      { label: "Stale Completion Rejection", href: "#stale" }
    ],
    content: (
      <div>
        <RLThesis>
          The idempotency engine prevents duplicate request execution using Redis HASH leases and monotonic fencing
          tokens. A processing lock expires after <code>IDEMPOTENCY_LOCK_TTL_MS</code> (60 s); completed records persist
          for <code>IDEMPOTENCY_COMPLETED_TTL_MS</code> (24 h). Stale writers are rejected atomically in{" "}
          <code>complete.lua</code>.
        </RLThesis>

        <RLQuickModel>
          Three HASH states per key (<code>idem:&lt;scope&gt;:&lt;key&gt;</code>): <strong>PROCESSING</strong> (active
          lease with fence token), <strong>COMPLETED</strong> (response cached for replay), <strong>FAILED</strong>{" "}
          (transient error — client may retry). <code>claim.lua</code> acquires; <code>complete.lua</code> /{" "}
          <code>fail.lua</code> finalize — both verify the fence token before writing.
        </RLQuickModel>

        <h2 className="guide-sub-heading" id="lifecycle">Lease-Locked Lifecycle</h2>
        <DocsMermaid chart={`
stateDiagram-v2
    [*] --> PROCESSING : claim.lua — new key\\nINCR fence counter
    PROCESSING --> COMPLETED : complete.lua\\nfence token matches
    PROCESSING --> FAILED : fail.lua\\nfence token matches
    PROCESSING --> PROCESSING : LockTTL expires\\nretry reclaims lease
    COMPLETED --> COMPLETED : claim.lua replay\\nreturns stored response
    FAILED --> PROCESSING : client retry\\nclaim.lua reclaims
        `} />

        <ol className="guide-bullets-list">
          <li><strong>PROCESSING:</strong> The lease is active. The request is being proxied to the backend. Concurrent duplicates receive <code>409 Conflict</code>.</li>
          <li><strong>COMPLETED:</strong> The backend succeeded. The sidecar has written back status, headers, and body (inline or separate STRING key if &gt; 64 KB).</li>
          <li><strong>FAILED:</strong> The backend returned a transient error. The client is free to retry; a new fence token is issued on reclaim.</li>
        </ol>

        <h2 className="guide-sub-heading" id="ttl">TTL Configuration</h2>
        <RLStatGrid stats={[
          { label: "IDEMPOTENCY_LOCK_TTL_MS (processing lease)", value: "60,000 ms", evidence: "SOURCE-PROVEN" },
          { label: "IDEMPOTENCY_COMPLETED_TTL_MS (record retention)", value: "86,400,000 ms (24 h)", evidence: "SOURCE-PROVEN" },
          { label: "IDEMPOTENCY_FAIL_OPEN", value: "false", evidence: "SOURCE-PROVEN" }
        ]} />
        <RLCallout variant="warning" title="Fail-closed idempotency">
          With <code>IDEMPOTENCY_FAIL_OPEN=false</code> (default), a Redis error during <code>claim.lua</code> returns{" "}
          <code>503 Service Unavailable</code> rather than risking duplicate execution. Payment-critical paths should
          keep this default.
        </RLCallout>

        <h2 className="guide-sub-heading" id="fencing">Fencing Token Mechanics</h2>
        <p>
          If a worker crashes during execution, or the backend takes longer than the lock TTL to reply, the lease
          expires. A retry reclaims the lock with a new fence token. Fencing tokens protect against concurrent writes
          from stale goroutines.{" "}
          <RLEvidenceBadge type="TEST-PROVEN" />
        </p>
        <DocsMermaid chart={idempotencySequence} />

        <RLSourceExcerpt
          source="internal/sidecar/idempotency/lua/claim.lua — fence token generation"
          establishes="New keys atomically receive a monotonic fence token via INCR on a dedicated counter key."
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
        <p>
          The <code>complete.lua</code> script enforces that the stored fence token in Redis matches the writer's
          token. On mismatch, the update is rejected with <code>FENCE_MISMATCH</code>, preventing an out-of-order
          write from polluting subsequent retries.{" "}
          <RLEvidenceBadge type="SOURCE-PROVEN" />
        </p>
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

        <RLRelatedPages pages={[
          { section: "architecture", slug: "anatomy-of-a-request", title: "Anatomy of a Request", note: "idempotent request pathway" },
          { section: "correctness-and-verification", slug: "what-has-been-proven", title: "What Has Been Proven?", note: "fencing token write-lock proof" },
          { section: "resilience", slug: "failure-model", title: "Failure Model", note: "IDEMPOTENCY_FAIL_OPEN behaviour" }
        ]} />
      </div>
    )
  },

  "denial-cache-and-singleflight": {
    title: "Denial Cache & Singleflight",
    topics: [
      { label: "Denial Cache Offloading", href: "#denial" },
      { label: "Denials-Only Security Invariant", href: "#invariant" },
      { label: "Singleflight Collapsing", href: "#singleflight" }
    ],
    content: (
      <div>
        <RLThesis>
          Process-local optimizations protect shared Redis and limiter upstreams from overload during peak traffic.
          The denial cache stores only rejected keys for <code>CACHE_TTL_MS</code> (default 30 ms); singleflight
          collapses concurrent identical checks into a single limiter round-trip.
        </RLThesis>

        <RLQuickModel>
          On a rate-limit denial, the sidecar writes the cache key to an in-memory <code>sync.Map</code>. Subsequent
          requests for that key within <code>CACHE_TTL_MS</code> return <code>429</code> immediately — no limiter or
          Redis hop. Allowances are never served from cache (quota-freeze attack prevention). Concurrent cache misses
          for the same key collapse via Go's <code>singleflight.Group</code>.
        </RLQuickModel>

        <h2 className="guide-sub-heading" id="denial">Denial Cache Offloading</h2>
        <p>
          When a client exhausts their rate limit, the limiter returns <code>429 Too Many Requests</code>. The sidecar
          records the denial in an in-memory cache keyed by <code>tenantID|userID|path</code> with TTL governed by{" "}
          <code>CACHE_TTL_MS</code> (default <strong>30 ms</strong>, not <code>DENIAL_CACHE_TTL_MS</code>).{" "}
          <RLEvidenceBadge type="SOURCE-PROVEN" />
        </p>
        <RLStatGrid stats={[
          { label: "CACHE_TTL_MS default", value: "30 ms", evidence: "SOURCE-PROVEN" },
          { label: "Denial cache hit latency", value: "~1 µs", evidence: "BENCHMARK-PROVEN" },
          { label: "Hammer test cache serve rate", value: "99.9%", evidence: "BENCHMARK-PROVEN" }
        ]} />

        <DocsMermaid chart={`
sequenceDiagram
    autonumber
    participant Client
    participant Sidecar
    participant Cache as sync.Map\\n(CACHE_TTL_MS=30)
    participant Limiter
    participant Redis

    Client->>Sidecar: Request 1 (quota exhausted)
    Sidecar->>Limiter: GET /check
    Limiter->>Redis: EVALSHA
    Redis-->>Limiter: allowed=0
    Limiter-->>Sidecar: 429
    Sidecar->>Cache: Store denial (expires in 30ms)
    Sidecar-->>Client: 429

    Client->>Sidecar: Request 2 (within 30ms)
    Sidecar->>Cache: Lookup — HIT (denied)
    Sidecar-->>Client: 429 (no limiter call)

    Note over Sidecar,Redis: After TTL expires, next request re-checks limiter
        `} />

        <h2 className="guide-sub-heading" id="invariant">Denials-Only Security Invariant</h2>
        <RLCallout variant="limitation" title="Never cache allowances">
          Only denials are served from the local cache. Allowed responses may be stored in <code>sync.Map</code> for
          bookkeeping, but cache hits with <code>Allowed=true</code> always fall through to the central limiter.
          Caching allowances would create a quota-freeze attack vector: a user cached as "allowed" could bypass
          enforcement even after exhausting quota.
        </RLCallout>
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
        <p>
          Under heavy concurrency (e.g. login surges), hundreds of requests for the same user key can hit a sidecar
          replica in the same millisecond. The sidecar employs Go's <code>singleflight.Group</code> to collapse
          concurrent queries — if 100 identical key checks are active, they block and share the result of the first
          active check.{" "}
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
          In <code>TestSidecar_SingleflightCollapse</code>, 100 concurrent threads produced exactly 1 network call to
          the limiter; the remaining 99 shared the returned result.{" "}
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
          Bounding failure latency ensures downstream degradations do not cascade into upstream thread exhaustion.
          Redis operations time out at 500 ms per socket phase; the sidecar limiter HTTP client defaults to 1,500 ms.
          Once the circuit breaker opens, subsequent checks fail in ~23 ms — a 40× reduction from the Redis outage path.
        </RLThesis>

        <RLQuickModel>
          Three measured failure tiers: Redis down (~1,003–1,006 ms, bounded by pool timeout), limiter down (~504 ms,
          bounded by HTTP client timeout), open circuit (~23 ms, pure in-process fast-fail via <code>allow.lua</code>).
        </RLQuickModel>

        <h2 className="guide-sub-heading" id="timeouts">Timeout Configuration</h2>
        <div style={{ overflowX: "auto", margin: "20px 0" }}>
          <table className="guide-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #27272a", textAlign: "left" }}>
                <th style={{ padding: "12px 8px" }}>Layer</th>
                <th style={{ padding: "12px 8px" }}>Source</th>
                <th style={{ padding: "12px 8px" }}>Timeout</th>
                <th style={{ padding: "12px 8px" }}>Env / Constant</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Redis dial", "internal/redis/timeouts.go", "500 ms", "DialTimeout"],
                ["Redis read", "internal/redis/timeouts.go", "500 ms", "ReadTimeout"],
                ["Redis write", "internal/redis/timeouts.go", "500 ms", "WriteTimeout"],
                ["Redis pool acquire", "internal/redis/timeouts.go", "1,000 ms", "PoolTimeout"],
                ["Redis retries", "internal/redis/timeouts.go", "0", "MaxRetries"],
                ["Sidecar → Limiter HTTP", "cmd/sidecar/config.go", "1,500 ms", "SIDECAR_LIMITER_HTTP_TIMEOUT_MS"],
                ["Sidecar fail-open", "cmd/sidecar/config.go", "false", "FAIL_OPEN"],
                ["Circuit open fast-fail", "allow.lua in-process", "~23 ms", "—"]
              ].map(([layer, source, timeout, env]) => (
                <tr key={layer} style={{ borderBottom: "1px solid #27272a" }}>
                  <td style={{ padding: "12px 8px", fontWeight: "bold" }}>{layer}</td>
                  <td style={{ padding: "12px 8px" }}><code>{source}</code></td>
                  <td style={{ padding: "12px 8px" }}>{timeout}</td>
                  <td style={{ padding: "12px 8px" }}><code>{env}</code></td>
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
          establishes="Sidecar HTTP client to the central limiter defaults to 1,500 ms; FAIL_OPEN defaults to false."
        >{`LimiterHTTPTimeoutMs: envInt("SIDECAR_LIMITER_HTTP_TIMEOUT_MS", 1500),
FailOpen:               envBool("FAIL_OPEN", false),
IdempotencyFailOpen:    envBool("IDEMPOTENCY_FAIL_OPEN", false),
CacheTTLMs:             envInt("CACHE_TTL_MS", 30),`}</RLSourceExcerpt>

        <h2 className="guide-sub-heading" id="latency">Observed Latency Profiles</h2>
        <p>
          Benchmarks under active outage simulation (container pause during k6 load) verified the following failure
          latency bounds.{" "}
          <RLEvidenceBadge type="BENCHMARK-PROVEN" />
        </p>
        <RLStatGrid stats={[
          { label: "Redis master offline", value: "1003–1006 ms", color: "#f472b6", evidence: "BENCHMARK-PROVEN" },
          { label: "Limiter pool offline", value: "~504 ms", color: "#c084fc", evidence: "BENCHMARK-PROVEN" },
          { label: "Open circuit fast-fail", value: "~23 ms", color: "#22c55e", evidence: "BENCHMARK-PROVEN" }
        ]} />
        <div style={{ overflowX: "auto", margin: "20px 0" }}>
          <table className="guide-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #27272a", textAlign: "left" }}>
                <th style={{ padding: "12px 8px" }}>Failure Scenario</th>
                <th style={{ padding: "12px 8px" }}>Theoretical Budget</th>
                <th style={{ padding: "12px 8px" }}>Measured Latency</th>
                <th style={{ padding: "12px 8px" }}>Binding Constraint</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Redis Master Offline</td>
                <td>≤ 1,000 ms (PoolTimeout)</td>
                <td>1,003–1,006 ms</td>
                <td><code>PoolTimeout</code> + scheduling overhead</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Limiter Pool Offline</td>
                <td>≤ 1,500 ms (<code>SIDECAR_LIMITER_HTTP_TIMEOUT_MS</code>)</td>
                <td>~504 ms</td>
                <td>TCP connection refusal + client timeout stack</td>
              </tr>
              <tr>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Open Circuit (Fast Fail)</td>
                <td>Immediate</td>
                <td>~23 ms</td>
                <td><code>allow.lua</code> Redis read + in-process reject</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2 className="guide-sub-heading" id="fast-fail">Fast-Fail Advantage</h2>
        <p>
          During database outages, fail-closed timeouts near 1,000 ms consume goroutines and connection pool slots
          quickly, risking upstream thread starvation. Once the circuit breaker trips, error latencies drop from
          ~1,003 ms to ~23 ms — preserving server capacity for healthy request paths while the dependency recovers.{" "}
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
          through Half-Open probe cycles back to Closed after <code>CB_HALF_OPEN_SUCCESS_REQUIRED</code> consecutive
          successes.
        </RLThesis>

        <RLQuickModel>
          Recovery is automatic at two layers: (1) Redis Sentinel promotes a replica and the client pool reconnects,
          and (2) the circuit breaker waits <code>CB_OPEN_COOLDOWN_MS</code> (30 s), admits up to 3 probes, and
          closes after 2 successes. No operator action required for normal failovers.
        </RLQuickModel>

        <h2 className="guide-sub-heading" id="sentinel">Sentinel Failover Recovery</h2>
        <p>
          When the active Redis master fails, Sentinels promote a replica to master. The go-redis Sentinel client
          listens to failover notifications and updates connection pools to reference the new master. Write
          availability re-establishes within seconds — limited by Sentinel quorum detection and client pool refresh.{" "}
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
        <p>
          When the circuit is <code>Open</code>, it remains locked for <code>CB_OPEN_COOLDOWN_MS</code> (default
          30,000 ms). After the cooldown expires, <code>allow.lua</code> transitions to <code>Half-Open</code> and
          admits up to <code>CB_HALF_OPEN_MAX_PROBES</code> (3) probe requests:{" "}
          <RLEvidenceBadge type="SOURCE-PROVEN" />
        </p>
        <ul className="guide-bullets-list">
          <li>If <code>CB_HALF_OPEN_SUCCESS_REQUIRED</code> (2) probes succeed, the circuit transitions to <code>Closed</code>, resetting all counters.</li>
          <li>If any probe fails or times out, the circuit immediately transitions back to <code>Open</code> and restarts the cooldown timer.</li>
          <li>Probes beyond the max concurrent bound are fast-rejected with <code>503</code> — they do not count as probe attempts.</li>
        </ul>

        <h2 className="guide-sub-heading" id="sequence">Recovery Sequence</h2>
        <DocsMermaid chart={recoverySequence} />

        <h2 className="guide-sub-heading" id="recovery-latency">Observed Recovery Latency</h2>
        <RLStatGrid stats={[
          { label: "First success after Redis recovery", value: "~27 ms", evidence: "BENCHMARK-PROVEN" },
          { label: "Open → Half-Open wait", value: "30,000 ms", evidence: "SOURCE-PROVEN" },
          { label: "Half-Open probes required", value: "2 of 3", evidence: "SOURCE-PROVEN" }
        ]} />
        <p>
          The first request to succeed immediately after Redis recovery took approximately 27 ms, indicating
          near-instantaneous state re-equilibration once the dependency is reachable again.{" "}
          <RLEvidenceBadge type="BENCHMARK-PROVEN" />
        </p>

        <RLCallout variant="info" title="Manual circuit reset">
          Operators can force-close a circuit via <code>POST /admin/circuit/{"{target}"}/reset</code> during incident
          recovery, bypassing the cooldown wait. Use only when the root cause is confirmed resolved.
        </RLCallout>

        <RLRelatedPages pages={[
          { section: "production-engineering", slug: "redis-and-sentinel-ha", title: "Redis & Sentinel HA", note: "Sentinel consensus and client failover" },
          { section: "resilience", slug: "circuit-breaker", title: "Circuit Breaker", note: "half-open probe mechanics" },
          { section: "correctness-and-verification", slug: "chaos-engineering", title: "Chaos Engineering", note: "automated recovery verification" }
        ]} />
      </div>
    )
  }
};

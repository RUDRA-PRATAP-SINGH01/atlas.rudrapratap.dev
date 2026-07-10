import React from "react";
import DocsMermaid from "@/features/docs/components/DocsMermaid";

export const resiliencePages = {
  "failure-model": {
    title: "Failure Model",
    topics: [
      { label: "Resilience Matrix", href: "#matrix" },
      { label: "Outage Classes", href: "#classes" },
      { label: "Audit Log Failures", href: "#audit-fail" }
    ],
    content: (
      <div>
        <p>
          This section details the system failure matrix, tracing how components behave under network cuts, service crashes, and database outages.
        </p>

        <h2 className="guide-sub-heading" id="matrix">Resilience Matrix</h2>
        <div style={{ overflowX: "auto", margin: "20px 0" }}>
          <table className="guide-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #27272a", textAlign: "left" }}>
                <th style={{ padding: "12px 8px" }}>Failure Mode</th>
                <th style={{ padding: "12px 8px" }}>Immediate Behavior</th>
                <th style={{ padding: "12px 8px" }}>Error Code</th>
                <th style={{ padding: "12px 8px" }}>Resilience Action</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Redis Master Unavailable</td>
                <td>Limiter queries fail; sidecar reports loss of backend</td>
                <td>`503 Service Unavailable`</td>
                <td>Fails closed; increments circuit failure counter</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Limiter Pool Crash</td>
                <td>Sidecar RPC times out</td>
                <td>`503 Service Unavailable`</td>
                <td>Fails closed; trips sidecar gateway circuit</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Sustained Latency Spike</td>
                <td>Requests exceed latency thresholds</td>
                <td>`503 Service Unavailable`</td>
                <td>Circuit breaker trips based on EMA latency</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Lua Script Evicted</td>
                <td>Redis returns `NOSCRIPT` error</td>
                <td>`200 OK` or `429` (recovered)</td>
                <td>Limiter catches error and falls back to full `EVAL`</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Audit Queue Full</td>
                <td>Async audit writes overflow queue</td>
                <td>`200 OK` (quota allowed)</td>
                <td>Best-effort drop; increments `audit_dropped_total`</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2 className="guide-sub-heading" id="classes">Outage Classes</h2>
        <ul className="guide-bullets-list">
          <li><strong>Cold Outage:</strong> Redis is completely offline. Both the limiter and the sidecar fail closed within 1,000 ms, defending downstreams.</li>
          <li><strong>Sustained Congestion:</strong> High traffic drives Redis latency up. The EMA latency monitoring trips the circuit breaker, shifting calls to fast-failing fallback states.</li>
        </ul>

        <h2 className="guide-sub-heading" id="audit-fail">Audit Log Failures</h2>
        <p>
          Audit logging operates as an asynchronous, non-blocking pipeline. If Redis is congested or the audit queue overflows, audit records are dropped rather than delaying rate limit checking. This prioritizes system latency over audit trail durability.
        </p>
      </div>
    )
  },

  "circuit-breaker": {
    title: "Circuit Breaker",
    topics: [
      { label: "Breaker State Machine", href: "#state-machine" },
      { label: "Transition Thresholds", href: "#thresholds" },
      { label: "Half-Open Global Bounds", href: "#bounds" }
    ],
    content: (
      <div>
        <p>
          To prevent cascading failures when downstreams degrade, the sidecar employs a Redis-coordinated circuit breaker.
        </p>

        <h2 className="guide-sub-heading" id="state-machine">Breaker State Machine</h2>
        <p>
          The circuit breaker transitions through three main states: `Closed` (traffic flows), `Open` (calls fail fast), and `Half-Open` (probing health).
        </p>
        <DocsMermaid chart={`
stateDiagram-v2
    [*] --> Closed
    Closed --> Open : Failures >= consecutive OR rate >= threshold
    Open --> HalfOpen : Cooldown elapsed (OpenCooldownMs)
    HalfOpen --> Closed : Successes >= HalfOpenSuccessRequired
    HalfOpen --> Open : Any failure / timeout
        `} />

        <h2 className="guide-sub-heading" id="thresholds">Transition Thresholds & Outcomes</h2>
        <p>
          State recording occurs atomically in Redis (`internal/circuitbreaker/lua/record.lua`). The breaker uses both failure rate metrics and exponential moving averages (EMA) for latency:
        </p>
        <ul className="guide-bullets-list">
          <li><strong>Timeout Mapping:</strong> Slow requests are classified as timeouts (`OutcomeTimeout`) and increment consecutive failures.</li>
          <li><strong>429 Exclusion:</strong> Expected rate limiting denials (`429 Too Many Requests`) are excluded from breaker statistics, preventing successful limit enforcement from tripping circuits.</li>
          <li><strong>EMA Latency:</strong> Latency EMAs are updated using `alpha * latency + (1 - alpha) * EMA`. If EMA exceeds `LatencyThresholdMs`, the circuit trips.</li>
        </ul>

        <h2 className="guide-sub-heading" id="bounds">Half-Open Global Bounds</h2>
        <div style={{
          background: "rgba(59, 130, 246, 0.05)",
          border: "1px solid rgba(59, 130, 246, 0.2)",
          borderRadius: 8,
          padding: 16,
          marginTop: 16
        }}>
          <strong>Concurrency Probe Bound:</strong> When the circuit transitions to `Half-Open`, the number of concurrent probes is strictly capped at `HalfOpenMaxProbes` (e.g. 3). Concurrent requests exceeding this bound are rejected immediately with `503 Service Unavailable`, preventing a stampede from overloading a recovering downstream.
        </div>
      </div>
    )
  },

  "idempotency": {
    title: "Idempotency",
    topics: [
      { label: "Lease-Locked Lifecycle", href: "#lifecycle" },
      { label: "Fencing Token Mechanics", href: "#fencing" },
      { label: "stale completion rejection", href: "#stale" }
    ],
    content: (
      <div>
        <p>
          The idempotency engine prevents duplicate request execution using database locks and fencing tokens.
        </p>

        <h2 className="guide-sub-heading" id="lifecycle">Lease-Locked Lifecycle</h2>
        <p>
          Idempotency checks use a HASH key (`idem:&lt;scope&gt;:&lt;key&gt;`) representing three status states:
        </p>
        <ol className="guide-bullets-list">
          <li><strong>processing:</strong> The lease is active. The request is currently being proxied to the backend.</li>
          <li><strong>completed:</strong> The backend succeeded. The sidecar has written back the response headers, status, and body (cached inline or in a separate string key if &gt; 64 KB).</li>
          <li><strong>failed:</strong> The backend returned a transient error. The client is free to retry.</li>
        </ol>

        <h2 className="guide-sub-heading" id="fencing">Fencing Token Mechanics</h2>
        <p>
          If a worker node crashes during execution, or the backend takes longer than `LockTTL` to reply, the lease expires. A retry will reclaim the lock. Fencing tokens protect against concurrent writes:
        </p>
        <DocsMermaid chart={`
sequenceDiagram
    autonumber
    participant Client
    participant Proxy1 as sidecar-replica-1
    participant Proxy2 as sidecar-replica-2
    participant Redis as Redis Master
    participant Backend

    Client->>Proxy1: POST /pay (Idempotency-Key: pay_45)
    Proxy1->>Redis: claim(pay_45) -> returns fence: "t_1"
    Proxy1->>Backend: Forward POST /pay
    Note over Backend: Executing slowly...
    Note over Redis: LockTTL expires!
    Client->>Proxy2: POST /pay (Idempotency-Key: pay_45)
    Proxy2->>Redis: claim(pay_45) -> returns fence: "t_2" (Reclaimed)
    Proxy2->>Backend: Forward POST /pay
    Note over Backend: Proxy 1 finally finishes first!
    Proxy1->>Redis: complete(pay_45, fence: "t_1")
    Redis-->>Proxy1: REJECT (fence token stale!)
    Note over Redis: Prevents stale results from overwriting!
        `} />

        <h2 className="guide-sub-heading" id="stale">Stale Completion Rejection</h2>
        <p>
          The `complete.lua` script enforces that the current fence token in Redis matches the writer's token. If it mismatch, the update is rejected, preventing an out-of-order write from polluting subsequent retries.
        </p>
      </div>
    )
  },

  "denial-cache-and-singleflight": {
    title: "Denial Cache & Singleflight",
    topics: [
      { label: "Denial Cache Offloading", href: "#denial" },
      { label: "Singleflight Collapsing", href: "#singleflight" }
    ],
    content: (
      <div>
        <p>
          Process-local optimizations protect shared database upstreams from overload during peak traffic bursts.
        </p>

        <h2 className="guide-sub-heading" id="denial">Denial Cache Offloading</h2>
        <p>
          When a client exhausts their rate limit, Redis returns a denial (`allowed: 0`). The sidecar catches this and records the key in an in-memory cache (`sync.Map`) for 1 second.
        </p>
        <p>
          Subsequent calls for that key within the 1-second TTL are rejected immediately at the proxy layer, completely bypassing the network hop to the Limiter service and Redis. This protects Redis from key-hammering during DDoS attacks.
        </p>

        <h2 className="guide-sub-heading" id="singleflight">Singleflight Collapsing</h2>
        <p>
          Under heavy concurrency (e.g. login surges), hundreds of requests for the same user key can hit a sidecar replica at the same millisecond.
        </p>
        <p>
          The sidecar employs Go's `singleflight` package to collapse concurrent queries. If 100 identical key checks are active, they block and share the result of the first active check, reducing database connections to a single round-trip.
        </p>
      </div>
    )
  },

  "failure-latency-budgets": {
    title: "Failure Latency Budgets",
    topics: [
      { label: "Timeout Configuration", href: "#timeouts" },
      { label: "Observed Latency Profiles", href: "#latency" }
    ],
    content: (
      <div>
        <p>
          Bounding failure latency ensures that downstream degradations do not cascade into upstream bottlenecks.
        </p>

        <h2 className="guide-sub-heading" id="timeouts">Timeout Configuration</h2>
        <p>
          The sidecar limits connection durations strictly:
        </p>
        <ul className="guide-bullets-list">
          <li><strong>Redis Client Timeout:</strong> Capped at 1,000 ms. If Redis fails, sidecar paths fail closed in ~1,000 ms.</li>
          <li><strong>Limiter HTTP Timeout:</strong> Capped at 500 ms. If the limiter service stalls, sidecars timeout in ~500 ms.</li>
          <li><strong>Circuit Open State:</strong> If consecutive errors trip the circuit breaker, subsequent checks fail fast in ~23 ms.</li>
        </ul>

        <h2 className="guide-sub-heading" id="latency">Observed Latency Profiles</h2>
        <p>
          Benchmarks verified the following failure latency bounds under active outage simulation:
        </p>
        <div style={{ overflowX: "auto", margin: "20px 0" }}>
          <table className="guide-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #27272a", textAlign: "left" }}>
                <th style={{ padding: "12px 8px" }}>Failure Scenario</th>
                <th style={{ padding: "12px 8px" }}>Theoretical Budget</th>
                <th style={{ padding: "12px 8px" }}>Measured Latency</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Redis Master Offline</td>
                <td>1,000 ms</td>
                <td>1003–1006 ms</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Limiter Pool Offline</td>
                <td>500 ms</td>
                <td>504 ms</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Open Circuit (Fast Fail)</td>
                <td>Immediate</td>
                <td>23 ms</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    )
  },

  "recovery-behaviour": {
    title: "Recovery Behaviour",
    topics: [
      { label: "Sentinel Failover Recovery", href: "#sentinel" },
      { label: "Circuit Re-Closing", href: "#reclosing" }
    ],
    content: (
      <div>
        <p>
          Once database or network health is restored, the system must recover gracefully without manual intervention.
        </p>

        <h2 className="guide-sub-heading" id="sentinel">Sentinel Failover Recovery</h2>
        <p>
          When the active Redis master fails, Sentinels promote a replica to master. The Go Redis client automatically listens to Sentinel failover notifications, updating connection pools to reference the new master. This re-establishes write availability within seconds.
        </p>

        <h2 className="guide-sub-heading" id="reclosing">Circuit Re-Closing</h2>
        <p>
          When the circuit is `Open`, it remains locked for `OpenCooldownMs`. After the cooldown expires, the breaker transitions to `Half-Open`. It admits up to `HalfOpenMaxProbes` probes:
        </p>
        <ul className="guide-bullets-list">
          <li>If all probes succeed (reach `HalfOpenSuccessRequired`), the circuit transitions to `Closed`, restoring full traffic flow.</li>
          <li>If any probe fails or times out, the circuit immediately transitions back to `Open` and restarts the cooldown timer.</li>
        </ul>
        <p>
          <strong>Observed Recovery Latency:</strong> The first request to succeed immediately after Redis recovery took approximately 27 ms, indicating near-instantaneous state re-equilibration.
        </p>
      </div>
    )
  }
};

import DocsNavbar from "@/components/docs/DocsNavbar";
import DocsSidebar from "@/components/docs/DocsSidebar";
import DocsMermaid from "@/components/docs/DocsMermaid";
import GoCodeBlock from "@/components/docs/GoCodeBlock";

const pageTopics = [
  { label: "What Are Invariants", href: "#what-are-invariants" },
  { label: "Validation Gate Pipeline", href: "#gates" },
  { label: "Invariant 1: Atomic Refill & Capacity", href: "#refill-invariant" },
  { label: "Invariant 2: Deduplication Fencing", href: "#fencing-invariant" },
  { label: "Invariant 3: All-or-Nothing Quota", href: "#speculative" },
  { label: "Invariant 4: Fail-Soft Circuit Breaker", href: "#fail-soft" },
  { label: "Invariant 5: Idempotency Key TTL Bound", href: "#ttl-bound" },
  { label: "Invariant 6: Audit Ordering", href: "#audit-ordering" },
  { label: "Invariant 7: Monotonic Fence Token", href: "#monotonic-fence" },
  { label: "Invariant Violations & Mitigations", href: "#violations" },
];

const validationGatesDiagram = `
flowchart TD
    Req["Incoming Request\n(Idempotency-Key = idem_123,\nUser = alice,\nPath = /api/pay)"]

    subgraph Gate1["Gate 1: Idempotency Integrity Check"]
        IdemCheck{"Key exists in Redis?"}
        StatusCheck{"Status?"}
        FpCheck{"Request body SHA-256\nmatch stored fingerprint?"}
    end

    subgraph Gate2["Gate 2: Speculative All-or-Nothing Quota"]
        Phase1{"Read ALL bucket levels:\nglobal, tenant, user, endpoint\nAll >= 1 token?"}
    end

    subgraph Gate3["Gate 3: Atomic State Commit"]
        Decrement["Lua EVALSHA:\nDecrement ALL buckets atomically\nSet idempotency → PROCESSING\nWrite fence_token"]
    end

    Upstream["Forward to Upstream\n(X-Fence-Token: 42)"]
    Reject429["HTTP 429 — Rate Limited"]
    Reject409["HTTP 409 — Idempotency Conflict"]
    Replay["Return cached 200 response\n(idempotent replay)"]

    Req --> IdemCheck
    IdemCheck -->|"No — first attempt"| Phase1
    IdemCheck -->|"Yes"| StatusCheck
    StatusCheck -->|"COMPLETED"| FpCheck
    StatusCheck -->|"PROCESSING"| Reject409
    FpCheck -->|"Match"| Replay
    FpCheck -->|"Mismatch"| Reject409
    Phase1 -->|"All Pass"| Decrement --> Upstream
    Phase1 -->|"Any Fail"| Reject429

    style Req fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style IdemCheck fill:#1e1e2e,stroke:#c084fc,color:#fff
    style StatusCheck fill:#18181b,stroke:#c084fc,color:#fff
    style Phase1 fill:#1e1e2e,stroke:#c084fc,color:#fff
    style Decrement fill:#18181b,stroke:#c084fc,color:#fff
    style Upstream fill:#1e1e2e,stroke:#c084fc,color:#fff
    style Reject429 fill:#1e1e2e,stroke:#ec4899,color:#fff
    style Reject409 fill:#1e1e2e,stroke:#ec4899,color:#fff
    style Replay fill:#18181b,stroke:#a78bfa,color:#fff
`;

const refillDiagram = `
flowchart LR
    A["T_prev = HGET bucket tokens"]
    B["elapsed = now - HGET bucket last_refill"]
    C["T_refilled = T_prev + elapsed * rate"]
    D{"T_refilled > capacity?"}
    E["T_final = capacity\n(clamped)"]
    F["T_final = T_refilled"]
    G["HSET bucket tokens T_final\nHSET bucket last_refill now"]

    A --> B --> C --> D
    D -->|"Yes"| E --> G
    D -->|"No"| F --> G

    style A fill:#18181b,stroke:#c084fc,color:#fff
    style B fill:#18181b,stroke:#c084fc,color:#fff
    style C fill:#18181b,stroke:#c084fc,color:#fff
    style D fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style E fill:#1e1e2e,stroke:#ec4899,color:#fff
    style F fill:#18181b,stroke:#c084fc,color:#fff
    style G fill:#18181b,stroke:#c084fc,color:#fff
`;

const fencingDiagram = `
flowchart TD
    A["complete.lua receives\n(idempotency_key, response_body, fence_req)"]
    B["HGET key fence_token → fence_stored"]
    C{"fence_req == fence_stored?"}
    D["HMSET key status=COMPLETED\nbody=response\nfinished_at=now\nCompute SHA-256 fingerprint"]
    E["Discard write\nReturn STALE_FENCE_TOKEN error"]
    F["Caller receives COMMITTED"]
    G["Caller receives REJECTED\n(late-arriving stale goroutine\nor retry storm)"]

    A --> B --> C
    C -->|"Match"| D --> F
    C -->|"Mismatch"| E --> G

    style A fill:#18181b,stroke:#c084fc,color:#fff
    style B fill:#18181b,stroke:#c084fc,color:#fff
    style C fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style D fill:#18181b,stroke:#c084fc,color:#fff
    style E fill:#1e1e2e,stroke:#ec4899,color:#fff
    style F fill:#18181b,stroke:#c084fc,color:#fff
    style G fill:#1e1e2e,stroke:#ec4899,color:#fff
`;

export default function RLSystemInvariantsPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="what-are-invariants">
              System Invariants
            </h1>

            <div className="guide-body-text" style={{ marginTop: 24 }}>
              <p>
                A system invariant is a predicate that must hold true across every observable state transition — under normal operation, partial failure, container restart, Redis failover, split-brain network partition, and concurrent Lua re-entry. Unlike runtime assertions, which detect violations after they occur, invariants are <strong style={{ color: "#ff5cad" }}>enforced by construction</strong>: the architecture, data model, and Lua scripts are designed such that violating them is structurally impossible, not just unlikely.
              </p>
              <p style={{ marginTop: 14 }}>
                on this page, I document the seven formal invariants of the Distributed Rate Limiter. For each invariant, I state the formal guarantee, describe the mechanism that enforces it, enumerate the failure modes that could theoretically violate it, and document the mitigations in place.
              </p>

              <div style={{
                background: "rgba(192, 132, 252, 0.05)", border: "1px solid rgba(192, 132, 252, 0.2)",
                borderRadius: 8, padding: "14px 18px", fontSize: 13, lineHeight: 1.7, marginTop: 20, marginBottom: 28
              }}>
                <strong style={{ color: "#c084fc" }}>Design Principle:</strong> Redis Lua scripts execute atomically on the Redis thread. No other client command can interleave between the first and last instruction of a Lua script. This single property — Redis single-threaded atomicity — is the foundation upon which all seven invariants rest. Any design that moves quota logic client-side (into Go goroutines) would immediately invalidate Invariants 1, 2, and 3.
              </div>

              {/* Validation Gates */}
              <h2 className="guide-sub-heading" id="gates" style={{ fontSize: 22, color: "#ffffff", marginTop: 10, marginBottom: 12 }}>
                Validation Gate Pipeline
              </h2>
              <p>
                Every inbound request passes through three sequential validation gates. Each gate maps to one or more invariants. A failure at any gate terminates the request immediately with the appropriate HTTP status — no state is mutated beyond the point of failure.
              </p>
              <DocsMermaid chart={validationGatesDiagram} />
              <p style={{ marginTop: 16 }}>
                The gates are deliberately ordered: idempotency integrity (Gate 1) is checked before quota consumption (Gate 2) to ensure that a duplicate request does not consume tokens from buckets it has already charged. The commit step (Gate 3) is a single atomic Lua script that cannot partially succeed.
              </p>

              {/* ─── Invariant 1 ─────────────────────────────────── */}
              <h2 className="guide-sub-heading" id="refill-invariant" style={{ fontSize: 22, color: "#ffffff", marginTop: 44, marginBottom: 12 }}>
                Invariant 1 — Atomic Refill & Capacity Bound
              </h2>
              <div style={{
                background: "rgba(192, 132, 252, 0.05)", border: "1px solid rgba(192, 132, 252, 0.25)",
                borderRadius: 8, padding: "14px 18px", fontSize: 13, lineHeight: 1.7, marginBottom: 18
              }}>
                <strong style={{ color: "#c084fc" }}>Formal Statement:</strong> For any bucket B with capacity C and refill rate R (tokens/second), the token level T after any refill operation must satisfy:
                <div style={{ fontFamily: "monospace", margin: "10px 0 6px 0", fontSize: 14, color: "#ffffff", background: "#0a0a0a", padding: "10px 14px", borderRadius: 6 }}>
                  T_new = min(C, T_prev + (now − last_refill) × R)
                </div>
                <div style={{ color: "#a1a1aa" }}>
                  Corollary: <code>0 ≤ T ≤ C</code> holds after every operation. T can never go negative or exceed C under any concurrency pattern.
                </div>
              </div>
              <p>
                The token bucket is implemented as a Redis HASH with fields <code>tokens</code> (current level, fixed-point integer) and <code>last_refill</code> (Unix nanoseconds). The refill calculation runs inside the <code>allow.lua</code> Lua script before the decrement check. Because Redis is single-threaded, no two callers can interleave between reading <code>T_prev</code> and writing <code>T_new</code>.
              </p>
              <DocsMermaid chart={refillDiagram} />
              <p style={{ marginTop: 16 }}>
                <strong>Why client-side refill fails:</strong> A naive Go-side implementation reads <code>T_prev</code>, computes the refill, then writes back. Under concurrent goroutines, two threads read the same <code>T_prev</code>, both compute <code>T_prev + delta</code>, and both write back — the second write overwrites the first, and one refill quantum is silently lost (lost update problem). Over millions of requests, this causes systematic token undercounting and spurious rate limit rejections for compliant users.
              </p>
              <p style={{ marginTop: 12 }}>
                <strong>Capacity clamp enforcement:</strong> The <code>min(C, ...)</code> is applied inside Lua on every refill, not at bucket creation time. This means an operator can reduce C at runtime (via configuration reload) without creating a state where tokens exceed capacity — the next refill will clamp the level down. Increasing C takes effect immediately: the next refill computes against the new ceiling.
              </p>
              <div style={{ overflowX: "auto", marginTop: 20, marginBottom: 28 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 560 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #27272a" }}>
                      {["Failure Mode", "Could It Violate Invariant 1?", "Mitigation"].map(h => (
                        <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "#ff5cad", fontWeight: 600, fontSize: 12 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["Redis crash mid-Lua execution", "No — Redis rolls back the script; HASH remains at T_prev", "AOF + RDB persistence prevents data loss on restart"],
                      ["Clock skew between limiter pods", "Partial — if now < last_refill, elapsed is negative, clamped to 0", "Lua guards: elapsed = math.max(0, now - last_refill)"],
                      ["Integer overflow at very high rates", "Theoretical — fixed-point arithmetic with 1e9 scale", "Capacity is capped at 2^31 tokens; Lua validates on write"],
                      ["Go goroutine reading T without Lua", "Yes if bypassed — never call HGET directly for quota checks", "All quota reads go through EVALSHA; direct HGET is prohibited"],
                    ].map(([mode, violated, mitigation], i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #18181b", background: i % 2 === 0 ? "#0b0b0b" : "#0f0f12" }}>
                        <td style={{ padding: "8px 12px", color: "#a1a1aa" }}>{mode}</td>
                        <td style={{ padding: "8px 12px", color: i === 3 ? "#ec4899" : "#c084fc" }}>{violated}</td>
                        <td style={{ padding: "8px 12px", color: "#71717a", lineHeight: 1.5 }}>{mitigation}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ─── Invariant 2 ─────────────────────────────────── */}
              <h2 className="guide-sub-heading" id="fencing-invariant" style={{ fontSize: 22, color: "#ffffff", marginTop: 44, marginBottom: 12 }}>
                Invariant 2 — Deduplication Fencing
              </h2>
              <div style={{
                background: "rgba(244, 114, 182, 0.05)", border: "1px solid rgba(244, 114, 182, 0.25)",
                borderRadius: 8, padding: "14px 18px", fontSize: 13, lineHeight: 1.7, marginBottom: 18
              }}>
                <strong style={{ color: "#c084fc" }}>Formal Statement:</strong> A state transition for idempotency key K from <code>PROCESSING → COMPLETED</code> or <code>PROCESSING → FAILED</code> will be committed if and only if the fence token presented by the caller matches the token stored at claim time:
                <div style={{ fontFamily: "monospace", margin: "10px 0 6px 0", fontSize: 14, color: "#ffffff", background: "#0a0a0a", padding: "10px 14px", borderRadius: 6 }}>
                  CommitStatus = (F_request == F_stored) ? COMMITTED : REJECTED
                </div>
                <div style={{ color: "#a1a1aa" }}>
                  Corollary: No late-arriving goroutine can overwrite the response body of a committed or active PROCESSING record belonging to a different request epoch.
                </div>
              </div>
              <p>
                When the sidecar claims an idempotency key (transitions <code>NEW → PROCESSING</code>), the <code>claim.lua</code> script generates a monotonically increasing fence token using <code>INCR</code> on a dedicated counter key and stores it in the HASH alongside the request fingerprint (SHA-256 of the normalized request body). This token is returned to the Go caller via the <code>X-Fence-Token</code> response header and forwarded to the upstream service.
              </p>
              <p style={{ marginTop: 12 }}>
                When the upstream service responds, the sidecar calls <code>complete.lua</code> or <code>fail.lua</code>, passing back the stored fence token. The Lua script performs a compare-and-swap: it reads the stored token, compares it to the provided token, and either commits the state change or rejects the write entirely. This two-phase atomic check prevents stale goroutines — delayed by GC pauses, network jitter, or retry storms — from corrupting active records.
              </p>
              <DocsMermaid chart={fencingDiagram} />
              <p style={{ marginTop: 16 }}>
                <strong>The split-brain scenario this protects against:</strong> Consider a network partition where the sidecar sends a request to the upstream but does not receive the response in time. A retry fires, acquires a new PROCESSING claim (new fence token F2), and eventually completes. Meanwhile, the original goroutine's delayed response arrives and attempts to write <code>COMPLETED</code> with F1. The fencing check rejects it: F1 ≠ F2. The completed record from the retry survives intact.
              </p>
              <GoCodeBlock>{`// complete.lua — abbreviated key logic
local fence_stored = redis.call('HGET', key, 'fence_token')
local fence_req    = ARGV[1]

if fence_stored ~= fence_req then
  return redis.error_reply('STALE_FENCE_TOKEN')
end

redis.call('HMSET', key,
  'status',      'COMPLETED',
  'response',    ARGV[2],
  'finished_at', ARGV[3],
  'fingerprint', ARGV[4]   -- SHA-256(response body)
)
return 'OK'`}</GoCodeBlock>

              {/* ─── Invariant 3 ─────────────────────────────────── */}
              <h2 className="guide-sub-heading" id="speculative" style={{ fontSize: 22, color: "#ffffff", marginTop: 44, marginBottom: 12 }}>
                Invariant 3 — Speculative All-or-Nothing Quota
              </h2>
              <div style={{
                background: "rgba(167, 139, 250, 0.05)", border: "1px solid rgba(167, 139, 250, 0.25)",
                borderRadius: 8, padding: "14px 18px", fontSize: 13, lineHeight: 1.7, marginBottom: 18
              }}>
                <strong style={{ color: "#c084fc" }}>Formal Statement:</strong> In hierarchical limiting mode, a token decrement across the set of buckets {"{Global, Tenant, User, Endpoint}"} is committed if and only if all buckets simultaneously hold T ≥ 1 token at the moment of the atomic check:
                <div style={{ fontFamily: "monospace", margin: "10px 0 6px 0", fontSize: 14, color: "#ffffff", background: "#0a0a0a", padding: "10px 14px", borderRadius: 6 }}>
                  {"DecrementCommit = (T_global ≥ 1) ∧ (T_tenant ≥ 1) ∧ (T_user ≥ 1) ∧ (T_endpoint ≥ 1)"}
                </div>
                <div style={{ color: "#a1a1aa" }}>
                  Corollary: No partial decrement is possible. If T_user = 0 and all others are non-zero, zero tokens are consumed from any bucket. Quota is never leaked.
                </div>
              </div>
              <p>
                The hierarchical check is implemented as a strict two-phase Lua script (<code>allow_hierarchical.lua</code>). Phase 1 (speculative read) reads all four bucket levels in a single Lua execution frame, applies refill calculations, and evaluates the conjunction. Phase 2 (conditional commit) only executes if Phase 1 returns true. Because both phases run in the same Lua script, Redis provides the atomicity guarantee: no other client can modify any bucket between the speculative read and the commit.
              </p>
              <p style={{ marginTop: 12 }}>
                <strong>Why two separate EVALSHA calls would break this:</strong> A two-call approach (check first, decrement second) creates a TOCTOU (time-of-check time-of-use) race window. Between the check and the decrement, another goroutine serving a concurrent request could drain the tenant bucket to zero. The second goroutine's decrement would then overdraft — consuming a token that was not present at decrement time. The invariant is violated. The single-Lua-script approach eliminates this window entirely.
              </p>
              <div style={{ overflowX: "auto", marginTop: 20, marginBottom: 28 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 520 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #27272a" }}>
                      {["Scenario", "Naïve Two-Call Behavior", "Lua All-or-Nothing Behavior"].map(h => (
                        <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "#ff5cad", fontWeight: 600, fontSize: 12 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["User exhausted, tenant has tokens", "Check passes; decrement runs; user bucket goes negative (underflow bug)", "Phase 1 sees T_user=0; script aborts; no buckets touched"],
                      ["Concurrent burst from same tenant", "Multiple goroutines check, all see T=1, all decrement — T goes to -N", "Only one goroutine's Lua script runs atomically; others see T=0 in Phase 1"],
                      ["Endpoint limit only, global OK", "Depending on check order, global may be decremented before endpoint check fails", "All checked atomically first; global only decremented if endpoint passes too"],
                      ["Redis failover mid-script", "Lua script is rolled back on the old master; new master has pre-script state", "go-redis retries the entire Lua call on the new master; no partial state committed"],
                    ].map(([scenario, naive, lua], i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #18181b", background: i % 2 === 0 ? "#0b0b0b" : "#0f0f12" }}>
                        <td style={{ padding: "8px 12px", color: "#a1a1aa" }}>{scenario}</td>
                        <td style={{ padding: "8px 12px", color: "#ec4899", fontSize: 12 }}>{naive}</td>
                        <td style={{ padding: "8px 12px", color: "#c084fc", fontSize: 12 }}>{lua}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ─── Invariant 4 ─────────────────────────────────── */}
              <h2 className="guide-sub-heading" id="fail-soft" style={{ fontSize: 22, color: "#ffffff", marginTop: 44, marginBottom: 12 }}>
                Invariant 4 — Fail-Soft Circuit Breaker Bound
              </h2>
              <div style={{
                background: "rgba(219, 39, 119, 0.05)", border: "1px solid rgba(219, 39, 119, 0.25)",
                borderRadius: 8, padding: "14px 18px", fontSize: 13, lineHeight: 1.7, marginBottom: 18
              }}>
                <strong style={{ color: "#ec4899" }}>Formal Statement:</strong> During a total Redis outage, every in-flight request MUST receive a definitive response (allow or deny) within <code>max(circuit_breaker_timeout)</code> milliseconds. The sidecar MUST NOT block indefinitely, queue unboundedly, or propagate the Redis failure as a hung connection to the upstream service.
              </div>
              <p>
                When Redis becomes unavailable (connection refused, read timeout, dial timeout), my circuit breaker state machine in the Central Limiter transitions from <code>CLOSED</code> → <code>OPEN</code> after the configured failure threshold is exceeded. In the <code>OPEN</code> state, the sidecar bypasses the Redis check entirely and applies the configured fail-mode policy:
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14, margin: "16px 0 24px 0" }}>
                {[
                  { mode: "FAIL_OPEN", color: "#c084fc", description: "All requests are passed through to the upstream without quota enforcement. Used for non-critical paths where availability outweighs strictness. Risk: brief over-quota traffic during outage window." },
                  { mode: "FAIL_CLOSED", color: "#ec4899", description: "All requests are rejected with HTTP 503. Used for payment APIs, financial transactions, or any path where over-quota risk is unacceptable. Risk: temporary service unavailability." },
                ].map(item => (
                  <div key={item.mode} style={{ background: "#111113", border: `1px solid ${item.color}33`, borderRadius: 8, padding: "16px 18px" }}>
                    <div style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: item.color, marginBottom: 8 }}>{item.mode}</div>
                    <div style={{ fontSize: 12.5, color: "#a1a1aa", lineHeight: 1.65 }}>{item.description}</div>
                  </div>
                ))}
              </div>
              <p>
                The critical enforcement detail: the <code>HALF_OPEN</code> state allows a single probe request to pass through to Redis. If the probe succeeds, the breaker resets to <code>CLOSED</code>. If it fails, the breaker returns to <code>OPEN</code>. This prevents thundering-herd reconnect storms — where all goroutines simultaneously attempt Redis reconnection the moment the timeout expires — from overwhelming a freshly recovered Redis instance.
              </p>
              <GoCodeBlock>{`// Breaker state read path (Go-side enforcement)
func (cb *CircuitBreaker) Allow() (bool, error) {
    state := cb.State()
    switch state {
    case StateClosed:
        return true, nil   // proceed to Redis
    case StateOpen:
        return false, ErrCircuitOpen  // short-circuit: no Redis call
    case StateHalfOpen:
        // Only one probe allowed concurrently
        if cb.probeInFlight.CompareAndSwap(false, true) {
            return true, nil  // this goroutine is the probe
        }
        return false, ErrCircuitOpen
    }
    return false, ErrUnknownState
}`}</GoCodeBlock>

              {/* ─── Invariant 5 ─────────────────────────────────── */}
              <h2 className="guide-sub-heading" id="ttl-bound" style={{ fontSize: 22, color: "#ffffff", marginTop: 44, marginBottom: 12 }}>
                Invariant 5 — Idempotency Key TTL Bound
              </h2>
              <div style={{
                background: "rgba(192, 132, 252, 0.05)", border: "1px solid rgba(192, 132, 252, 0.25)",
                borderRadius: 8, padding: "14px 18px", fontSize: 13, lineHeight: 1.7, marginBottom: 18
              }}>
                <strong style={{ color: "#c084fc" }}>Formal Statement:</strong> Every idempotency record stored in Redis MUST carry a TTL of exactly <code>idempotency_ttl</code> seconds (default: 86400s). No idempotency key can persist beyond this bound, regardless of its state (<code>PROCESSING</code>, <code>COMPLETED</code>, <code>FAILED</code>).
              </div>
              <p>
                The TTL bound has two engineering motivations. First, <strong>memory safety</strong>: without TTLs, idempotency HASHes accumulate indefinitely. At 200 bytes/key and 10,000 requests/second, a 24-hour window accumulates 172GB of Redis memory. The TTL ensures the working set is bounded to <code>rate × ttl × bytes_per_key</code>, which is predictable and capacity-planned.
              </p>
              <p style={{ marginTop: 12 }}>
                Second, <strong>correctness</strong>: a <code>PROCESSING</code> record that outlives its TTL indicates a goroutine that never resolved (upstream hang, sidecar crash). When the TTL expires and the key is evicted, subsequent retries with the same idempotency key are treated as new requests. This is intentional: a 24-hour-old key cannot possibly represent an active in-flight request.
              </p>
              <p style={{ marginTop: 12 }}>
                <strong>TTL reset on access:</strong> The <code>claim.lua</code> script calls <code>EXPIRE key ttl</code> after every HMSET, including re-reads of existing <code>COMPLETED</code> records. This ensures that a frequently-replayed idempotency key (e.g., a client that retries GET requests hourly) maintains a sliding TTL window relative to the most recent access, not the original claim time.
              </p>
              <div style={{
                background: "rgba(219, 39, 119, 0.06)", border: "1px solid rgba(219, 39, 119, 0.2)",
                borderRadius: 8, padding: "14px 18px", fontSize: 13, lineHeight: 1.65, marginTop: 16, marginBottom: 24
              }}>
                <strong style={{ color: "#ec4899" }}>Violation Risk:</strong> If <code>EXPIRE</code> is called inconsistently (e.g., only on claim but not on status updates), a <code>PROCESSING</code> record can expire while the upstream is still executing. A retry would then create a second parallel execution of the same logical operation — the exact scenario idempotency is designed to prevent. All Lua scripts that mutate idempotency records <em>always</em> refresh the TTL as their final instruction.
              </div>

              {/* ─── Invariant 6 ─────────────────────────────────── */}
              <h2 className="guide-sub-heading" id="audit-ordering" style={{ fontSize: 22, color: "#ffffff", marginTop: 44, marginBottom: 12 }}>
                Invariant 6 — Audit Log Causal Ordering
              </h2>
              <div style={{
                background: "rgba(192, 132, 252, 0.05)", border: "1px solid rgba(192, 132, 252, 0.25)",
                borderRadius: 8, padding: "14px 18px", fontSize: 13, lineHeight: 1.7, marginBottom: 18
              }}>
                <strong style={{ color: "#c084fc" }}>Formal Statement:</strong> For any two audit events E1 and E2 associated with the same idempotency key K, if E1 causally precedes E2 (E1 → E2 in the happened-before relation), then <code>timestamp(E1) {"<"} timestamp(E2)</code> in the persisted audit log.
              </div>
              <p>
                Audit events are emitted by the Central Limiter and buffered in a Go channel (bounded, capacity 10,000). Worker goroutines drain the channel and write entries to Redis LISTs using <code>RPUSH</code>. Redis LIST semantics guarantee FIFO ordering within a single key — events pushed to the same key are always read in insertion order.
              </p>
              <p style={{ marginTop: 12 }}>
                The causal ordering invariant is maintained because: (a) audit events for the same idempotency key are always written by the same goroutine (the one that processed the request), ensuring no concurrent push racing; (b) the timestamp embedded in each audit event is the wall-clock time at the moment the rate-limit decision was made (not the time the worker drains the buffer), preserving causal order even under worker backpressure.
              </p>
              <p style={{ marginTop: 12 }}>
                <strong>Intentional relaxation:</strong> The audit log does <em>not</em> guarantee total global ordering across different idempotency keys. Events for <code>key_A</code> and <code>key_B</code> may be flushed to Redis in non-deterministic order if both are processed concurrently. This is an accepted trade-off: global ordering would require a distributed sequence number (e.g., a Redis INCR counter per flush), adding a synchronous Redis round-trip to every audit write. The current design accepts partial ordering (total order per key, causal order globally) in exchange for sub-millisecond audit path latency.
              </p>

              {/* ─── Invariant 7 ─────────────────────────────────── */}
              <h2 className="guide-sub-heading" id="monotonic-fence" style={{ fontSize: 22, color: "#ffffff", marginTop: 44, marginBottom: 12 }}>
                Invariant 7 — Monotonically Increasing Fence Tokens
              </h2>
              <div style={{
                background: "rgba(167, 139, 250, 0.05)", border: "1px solid rgba(167, 139, 250, 0.25)",
                borderRadius: 8, padding: "14px 18px", fontSize: 13, lineHeight: 1.7, marginBottom: 18
              }}>
                <strong style={{ color: "#c084fc" }}>Formal Statement:</strong> For any two fence tokens F1 and F2 generated by the system at times T1 and T2 respectively, if T1 {"<"} T2 then F1 {"<"} F2. The fence token sequence is strictly monotonically increasing across the lifetime of the Redis instance.
              </div>
              <p>
                Fence tokens are generated using Redis's atomic <code>INCR fence_token_counter</code> operation, which returns a sequence number guaranteed to be strictly greater than all previous values. This is the standard fencing token pattern from distributed systems literature (Martin Kleppmann's <em>Designing Data-Intensive Applications</em>, Chapter 8) applied to the idempotency claim lifecycle.
              </p>
              <p style={{ marginTop: 12 }}>
                The upstream service (payment processor, order system, etc.) is expected to record the highest fence token it has seen for each idempotency key. If it receives a write with a lower token than the maximum it has already processed, it must reject the write — this extends the fencing protection beyond the sidecar boundary, into the upstream system itself. The <code>X-Fence-Token</code> header enables this end-to-end fencing.
              </p>
              <p style={{ marginTop: 12 }}>
                <strong>Behavior across Redis failover:</strong> The fence token counter is stored in Redis and replicated to replicas asynchronously. If a master failover occurs and the promoted replica has not yet applied the last few INCR operations, the new master's counter starts from a stale value. This creates a <em>fence token regression</em> — the new sequence may temporarily overlap with tokens already issued. The current design treats this as an accepted edge case: the probability is low (async replication lag is typically sub-millisecond on LAN), and the consequence is bounded (at most a few duplicate tokens in a short window). A production-hardened solution would use Redis's <code>WAIT</code> command to block until replication is confirmed before acknowledging fence token generation.
              </p>

              {/* ─── Violations Summary ─────────────────────────────────── */}
              <h2 className="guide-sub-heading" id="violations" style={{ fontSize: 22, color: "#ffffff", marginTop: 44, marginBottom: 12 }}>
                Invariant Violations — Detection & Remediation
              </h2>
              <p>
                The following table summarizes known violation pathways, their detectability via observability signals, and the remediation procedure for each:
              </p>
              <div style={{ overflowX: "auto", marginTop: 16, marginBottom: 28 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 640 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #27272a" }}>
                      {["Invariant", "Violation Symptom", "Detection Signal", "Remediation"].map(h => (
                        <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "#ff5cad", fontWeight: 600, fontSize: 12 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["1 — Atomic Refill", "Users report spurious 429 at low traffic; token levels drift negative in audit logs", "rate_limit.tokens_at_check histogram shows negative values; Redis HGET direct check", "Flush all bucket keys (SCAN + DEL); buckets self-heal on next request via Lua init"],
                      ["2 — Fencing", "Duplicate payment charges; COMPLETED records overwritten by stale goroutines", "STALE_FENCE_TOKEN error rate spike in metrics; audit log shows conflicting response bodies for same key", "Trace goroutine leak via pprof; fix upstream timeout configuration; deploy fence_token_counter reset"],
                      ["3 — All-or-Nothing", "Global/tenant buckets drain faster than request count implies (quota leak)", "rate_limit.bucket_level gauge drops without corresponding request count increase", "Redis SCAN for buckets with anomalous levels; compare audit log vs bucket decrement count"],
                      ["4 — Fail-Soft", "Goroutines accumulate indefinitely during Redis outage; memory usage spikes", "goroutines gauge climbs monotonically; circuit breaker state metric stuck at OPEN with no timeouts", "Verify breaker timeout config; check Redis dial timeout is less than breaker evaluation window"],
                      ["5 — TTL Bound", "Redis memory grows unbounded; OOM eviction triggers; idempotency records for old keys still present", "redis_memory_used_bytes grows past capacity plan; DEBUG OBJECT on old keys shows no TTL (-1)", "Run SCAN + TTL audit script; patch claim.lua to always call EXPIRE; flush stale keys"],
                      ["6 — Audit Ordering", "Audit log shows COMPLETED before PROCESSING for same key (causal inversion)", "Audit log parser detects out-of-order timestamps for same idempotency_key", "Check for clock skew between sidecar pods; ensure audit events use Redis time (TIME command), not local wall clock"],
                      ["7 — Monotonic Fence", "Fence token value for new claim is less than a previously issued token", "X-Fence-Token header values observed out of sequence in request traces", "Inspect fence_token_counter key TTL; check for Redis eviction under memory pressure (noeviction policy required)"],
                    ].map(([inv, symptom, signal, rem], i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #18181b", background: i % 2 === 0 ? "#0b0b0b" : "#0f0f12" }}>
                        <td style={{ padding: "8px 12px", color: "#c084fc", fontWeight: 600, whiteSpace: "nowrap" }}>{inv}</td>
                        <td style={{ padding: "8px 12px", color: "#f472b6", lineHeight: 1.5, fontSize: 12 }}>{symptom}</td>
                        <td style={{ padding: "8px 12px", color: "#a1a1aa", lineHeight: 1.5, fontSize: 12 }}>{signal}</td>
                        <td style={{ padding: "8px 12px", color: "#71717a", lineHeight: 1.5, fontSize: 12 }}>{rem}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{
                background: "rgba(192, 132, 252, 0.05)", border: "1px solid rgba(192, 132, 252, 0.2)",
                borderRadius: 8, padding: "14px 18px", fontSize: 13, lineHeight: 1.65, marginBottom: 12
              }}>
                <strong style={{ color: "#c084fc" }}>Production Recommendation:</strong> Invariant monitoring should be a first-class concern in your observability stack. Wire the <code>STALE_FENCE_TOKEN</code> error counter and the <code>rate_limit.tokens_at_check</code> histogram to PagerDuty alerts with appropriate thresholds. The fence token counter key (<code>rl:fence:counter</code>) must use the <code>noeviction</code> maxmemory-policy — any eviction of this key causes a full fence token sequence reset and potential correctness violation.
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

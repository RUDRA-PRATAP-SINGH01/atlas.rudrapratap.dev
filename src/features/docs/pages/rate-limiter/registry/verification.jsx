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

const multiReplicaTopology = `
flowchart LR
    LB["Load balancer\\n(round-robin)"]
    S1["Sidecar :9090"]
    S2["Sidecar :9092"]
    L1["Limiter :8080"]
    L2["Limiter :8083"]
    Redis[("Redis Master\\n(shared quota keys)")]

    LB --> S1
    LB --> S2
    S1 --> L1
    S1 --> L2
    S2 --> L1
    S2 --> L2
    L1 --> Redis
    L2 --> Redis
`;

const chaosFailClosedSequence = `
sequenceDiagram
    autonumber
    participant k6 as k6 load generator
    participant Sidecar
    participant Limiter
    participant Redis

    k6->>Sidecar: Steady traffic (FAIL_OPEN=false)
    Sidecar->>Limiter: GET /check
    Limiter->>Redis: EVALSHA succeeds
    Redis-->>Limiter: allowed/denied
    Limiter-->>Sidecar: 200 or 429

    Note over Redis: docker pause redis
    Sidecar->>Limiter: GET /check
    Limiter->>Redis: connection timeout (~500ms phases)
    Redis--xLimiter: unreachable
    Limiter-->>Sidecar: 503
    Sidecar-->>k6: 503 Service Unavailable

    Note over Redis: docker unpause redis
    Sidecar->>Limiter: GET /check
    Limiter->>Redis: EVALSHA succeeds
    Sidecar-->>k6: 200 or 429 (quota restored)
`;

export const verificationPages = {
  "what-has-been-proven": {
    title: "What Has Been Proven?",
    topics: [
      { label: "Evidence Categories", href: "#categories" },
      { label: "Core Correctness Claims", href: "#claims" },
      { label: "Verified Evidence Matrix", href: "#matrix" },
      { label: "State Validation Assertions", href: "#state-validation" }
    ],
    content: (
      <div>
        <RLThesis>
          Every headline guarantee in this platform maps to one of five evidence categories — source code, automated
          tests, runtime integration, benchmark artifacts, or documented limitation. Nothing on this page is asserted
          without a traceable proof path; unverified claims are explicitly marked as limitations.
        </RLThesis>

        <RLQuickModel>
          SOURCE-PROVEN = implementation guarantees the behaviour. TEST-PROVEN = Go unit/integration test asserts it.
          RUNTIME-PROVEN = multi-container or live integration run confirms it. BENCHMARK-PROVEN = k6 or scripted
          measurement under load. DOCUMENTED LIMITATION = known boundary, not a failure — but not proven safe beyond
          stated scope.
        </RLQuickModel>

        <h2 className="guide-sub-heading" id="categories">Evidence Categories</h2>
        <div style={{ overflowX: "auto", margin: "20px 0" }}>
          <table className="guide-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #27272a", textAlign: "left" }}>
                <th style={{ padding: "12px 8px" }}>Badge</th>
                <th style={{ padding: "12px 8px" }}>Meaning</th>
                <th style={{ padding: "12px 8px" }}>Example</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px" }}><RLEvidenceBadge type="SOURCE-PROVEN" /></td>
                <td style={{ padding: "12px 8px" }}>Behaviour enforced in production code paths</td>
                <td style={{ padding: "12px 8px" }}>Lua atomicity, fail-closed defaults, denial-only cache</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px" }}><RLEvidenceBadge type="TEST-PROVEN" /></td>
                <td style={{ padding: "12px 8px" }}>Automated Go test with deterministic assertion</td>
                <td style={{ padding: "12px 8px" }}><code>TestSidecar_SingleflightCollapse</code>, <code>TestClaimSingleWinnerUnderConcurrency</code></td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px" }}><RLEvidenceBadge type="RUNTIME-PROVEN" /></td>
                <td style={{ padding: "12px 8px" }}>Multi-replica or containerized integration run</td>
                <td style={{ padding: "12px 8px" }}>60 requests → 10 allowed / 50 denied across 2 sidecars</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px" }}><RLEvidenceBadge type="BENCHMARK-PROVEN" /></td>
                <td style={{ padding: "12px 8px" }}>k6 or scripted measurement under sustained load</td>
                <td style={{ padding: "12px 8px" }}>15-minute soak at 300 RPS, failure latency bounds</td>
              </tr>
              <tr>
                <td style={{ padding: "12px 8px" }}><RLEvidenceBadge type="DOCUMENTED LIMITATION" /></td>
                <td style={{ padding: "12px 8px" }}>Known boundary — not a bug, but not proven beyond scope</td>
                <td style={{ padding: "12px 8px" }}>Redis Cluster CROSSSLOT, idempotency crash window</td>
              </tr>
            </tbody>
          </table>
        </div>

        <RLStatGrid stats={[
          { value: "43", label: "*_test.go files across all packages", color: "#60a5fa", evidence: "TEST-PROVEN" },
          { value: "4", label: "CI pipeline stages (vet, build, test, -race)", color: "#22c55e", evidence: "TEST-PROVEN" },
          { value: "0", label: "Over-admission in multi-replica burst test", color: "#ff5cad", evidence: "RUNTIME-PROVEN" }
        ]} />

        <h2 className="guide-sub-heading" id="claims">Core Correctness Claims</h2>
        <p>
          Each architectural guarantee is linked to its strongest evidence tier. Where multiple tiers apply, the badge
          shown is the tightest proof (test beats source; runtime beats test for distributed coordination).
        </p>
        <ul className="guide-bullets-list">
          <li>
            <strong>Lua Script Atomicity:</strong> Quota check-and-deduct runs inside Redis's single-threaded Lua
            execution window — no interleaved read-modify-write races.{" "}
            <RLEvidenceBadge type="SOURCE-PROVEN" /> <RLEvidenceBadge type="TEST-PROVEN" />
          </li>
          <li>
            <strong>Over-Admission Prevention:</strong> 60 concurrent requests split across two sidecar replicas against
            a capacity-10 bucket yielded exactly 10 allowed and 50 denied.{" "}
            <RLEvidenceBadge type="RUNTIME-PROVEN" />
          </li>
          <li>
            <strong>Fencing Token Write-Lock:</strong> Concurrent idempotency claim tests prove exactly one winner
            under parallel <code>claim.lua</code> calls; stale <code>complete.lua</code> writers receive{" "}
            <code>FENCE_MISMATCH</code>.{" "}
            <RLEvidenceBadge type="TEST-PROVEN" />
          </li>
          <li>
            <strong>Singleflight Collapsing:</strong> 100 concurrent identical key checks on one sidecar collapse to
            exactly 1 limiter network call.{" "}
            <RLEvidenceBadge type="TEST-PROVEN" />
          </li>
          <li>
            <strong>CB Half-Open Global Bounds:</strong> Concurrent probes during Half-Open state are capped at{" "}
            <code>CB_HALF_OPEN_MAX_PROBES</code> (default 3) atomically in <code>allow.lua</code>.{" "}
            <RLEvidenceBadge type="TEST-PROVEN" />
          </li>
          <li>
            <strong>Fail-Closed on Redis Outage:</strong> <code>docker pause redis</code> during load returns{" "}
            <code>503 Service Unavailable</code> when <code>FAIL_OPEN=false</code> (default).{" "}
            <RLEvidenceBadge type="RUNTIME-PROVEN" />
          </li>
        </ul>

        <h2 className="guide-sub-heading" id="matrix">Correctness Evidence Matrix</h2>
        <p>
          Legend: <strong>Y</strong> = proven at that tier. <strong>—</strong> = not applicable or not tested at that tier.
        </p>
        <div style={{ overflowX: "auto", margin: "20px 0" }}>
          <table className="guide-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #27272a", textAlign: "left" }}>
                <th style={{ padding: "12px 8px" }}>Guarantee Claim</th>
                <th style={{ padding: "12px 8px" }}>SOURCE</th>
                <th style={{ padding: "12px 8px" }}>TEST</th>
                <th style={{ padding: "12px 8px" }}>RUNTIME</th>
                <th style={{ padding: "12px 8px" }}>BENCHMARK</th>
                <th style={{ padding: "12px 8px" }}>Key Proof</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Redis Lua Atomic Quota</td>
                <td style={{ padding: "12px 8px" }}>Y</td>
                <td style={{ padding: "12px 8px" }}>Y</td>
                <td style={{ padding: "12px 8px" }}>Y</td>
                <td style={{ padding: "12px 8px" }}>—</td>
                <td style={{ padding: "12px 8px" }}><code>internal/limiter/lua_test.go</code></td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Multi-Sidecar No Over-Admission</td>
                <td style={{ padding: "12px 8px" }}>Y</td>
                <td style={{ padding: "12px 8px" }}>Y</td>
                <td style={{ padding: "12px 8px" }}>Y</td>
                <td style={{ padding: "12px 8px" }}>Y</td>
                <td style={{ padding: "12px 8px" }}><code>redis_atomic_token_bucket_test.go</code></td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Singleflight Collapsing</td>
                <td style={{ padding: "12px 8px" }}>Y</td>
                <td style={{ padding: "12px 8px" }}>Y</td>
                <td style={{ padding: "12px 8px" }}>—</td>
                <td style={{ padding: "12px 8px" }}>—</td>
                <td style={{ padding: "12px 8px" }}><code>TestSidecar_SingleflightCollapse</code></td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Idempotency Fencing Winner</td>
                <td style={{ padding: "12px 8px" }}>Y</td>
                <td style={{ padding: "12px 8px" }}>Y</td>
                <td style={{ padding: "12px 8px" }}>—</td>
                <td style={{ padding: "12px 8px" }}>—</td>
                <td style={{ padding: "12px 8px" }}><code>TestClaimSingleWinnerUnderConcurrency</code></td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>CB Half-Open Global Bounds</td>
                <td style={{ padding: "12px 8px" }}>Y</td>
                <td style={{ padding: "12px 8px" }}>Y</td>
                <td style={{ padding: "12px 8px" }}>—</td>
                <td style={{ padding: "12px 8px" }}>Y</td>
                <td style={{ padding: "12px 8px" }}><code>TestHalfOpenConcurrentProbeBound</code></td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Fail-Closed on Dependency Outage</td>
                <td style={{ padding: "12px 8px" }}>Y</td>
                <td style={{ padding: "12px 8px" }}>—</td>
                <td style={{ padding: "12px 8px" }}>Y</td>
                <td style={{ padding: "12px 8px" }}>Y</td>
                <td style={{ padding: "12px 8px" }}>docker pause redis → 503</td>
              </tr>
              <tr>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Denial-Only Cache Invariant</td>
                <td style={{ padding: "12px 8px" }}>Y</td>
                <td style={{ padding: "12px 8px" }}>Y</td>
                <td style={{ padding: "12px 8px" }}>—</td>
                <td style={{ padding: "12px 8px" }}>—</td>
                <td style={{ padding: "12px 8px" }}><code>cmd/sidecar/main.go</code> denial branch</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2 className="guide-sub-heading" id="state-validation">State Validation Assertions</h2>
        <p>
          Integration tests assert Redis state invariants directly after high-concurrency bursts — not just HTTP status
          codes. These run in <code>internal/limiter/redis_atomic_token_bucket_test.go</code> and{" "}
          <code>internal/limiter/lua_test.go</code> using miniredis or live Redis containers.{" "}
          <RLEvidenceBadge type="TEST-PROVEN" />
        </p>
        <ul className="guide-bullets-list">
          <li>
            <strong>Token Bucket:</strong> After a concurrent burst with no refill window, remaining tokens in the HASH
            plus allowed request count equals bucket capacity.
          </li>
          <li>
            <strong>Sliding Window:</strong> ZSET cardinality matches the number of allowed request records in the
            active window.
          </li>
          <li>
            <strong>Hierarchical All-or-Nothing:</strong> On denial, no tier HASH shows a token deduction — only refill
            state updates. Verified via <code>TestHierarchicalLuaScript_SpeculativeRead</code> and hierarchical
            integration suites.
          </li>
        </ul>

        <RLRelatedPages pages={[
          { section: "correctness-and-verification", slug: "test-strategy", title: "Test Strategy", note: "43 test files and CI pipeline" },
          { section: "architecture", slug: "system-invariants", title: "System Invariants", note: "formal invariant definitions" },
          { section: "correctness-and-verification", slug: "known-limitations", title: "Known Limitations", note: "what is NOT proven" }
        ]} />
      </div>
    )
  },

  "test-strategy": {
    title: "Test Strategy",
    topics: [
      { label: "Test Inventory", href: "#inventory" },
      { label: "CI Pipeline", href: "#ci" },
      { label: "Unit & Integration Layers", href: "#layers" },
      { label: "Key Test References", href: "#key-tests" },
      { label: "Local Verification Commands", href: "#commands" }
    ],
    content: (
      <div>
        <RLThesis>
          Correctness is verified through 43 <code>*_test.go</code> files spanning limiter algorithms, Lua scripts,
          circuit breaker state, idempotency fencing, sidecar proxy behaviour, and Redis client resilience. CI runs{" "}
          <code>go vet</code>, <code>go build</code>, <code>go test</code>, and <code>go test -race</code> on every
          push — race-detector clean is a merge gate, not an optional local check.
        </RLThesis>

        <RLQuickModel>
          Unit tests (miniredis, httptest) prove algorithmic and script correctness in isolation. Integration tests
          (testcontainers, live Redis) prove connection retry, HTTP status parsing, and multi-key atomicity. Runtime
          tests (docker-compose multi-replica topology) prove distributed coordination. Benchmarks (k6) prove sustained
          load behaviour — a separate evidence tier documented in Performance Lab.
        </RLQuickModel>

        <h2 className="guide-sub-heading" id="inventory">Test Inventory</h2>
        <RLStatGrid stats={[
          { value: "43", label: "*_test.go files across packages", color: "#60a5fa", evidence: "TEST-PROVEN" },
          { value: "6+", label: "Package directories with test coverage", color: "#c084fc" },
          { value: "0", label: "Race detector warnings (CI gate)", color: "#22c55e", evidence: "TEST-PROVEN" }
        ]} />
        <p>
          Test files are distributed across the packages that own production behaviour — not concentrated in a single
          integration folder:
        </p>
        <ul className="guide-bullets-list">
          <li><code>internal/limiter/</code> — token bucket, sliding window, hierarchical Lua, concurrent quota (<code>redis_atomic_token_bucket_test.go</code>, <code>lua_test.go</code>)</li>
          <li><code>internal/circuitbreaker/</code> — state transitions, half-open probe bounds (<code>TestHalfOpenConcurrentProbeBound</code>)</li>
          <li><code>internal/sidecar/idempotency/</code> — claim/complete/fence concurrency (<code>store_test.go</code>, <code>TestClaimSingleWinnerUnderConcurrency</code>)</li>
          <li><code>cmd/sidecar/</code> — proxy routing, singleflight collapse (<code>TestSidecar_SingleflightCollapse</code>)</li>
          <li><code>internal/redis/</code> — Sentinel client, timeout configuration</li>
          <li><code>internal/config/</code>, <code>internal/metrics/</code>, <code>internal/telemetry/</code> — supporting package correctness</li>
        </ul>

        <h2 className="guide-sub-heading" id="ci">CI Pipeline</h2>
        <p>
          The automated pipeline enforces four sequential gates before merge. All must pass; there is no skip path for
          the race detector. <RLEvidenceBadge type="TEST-PROVEN" />
        </p>
        <div style={{ overflowX: "auto", margin: "20px 0" }}>
          <table className="guide-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #27272a", textAlign: "left" }}>
                <th style={{ padding: "12px 8px" }}>Stage</th>
                <th style={{ padding: "12px 8px" }}>Command</th>
                <th style={{ padding: "12px 8px" }}>What It Catches</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Static analysis</td>
                <td style={{ padding: "12px 8px" }}><code>go vet ./...</code></td>
                <td style={{ padding: "12px 8px" }}>Suspicious constructs, unreachable code, printf format mismatches</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Compile gate</td>
                <td style={{ padding: "12px 8px" }}><code>go build ./...</code></td>
                <td style={{ padding: "12px 8px" }}>Type errors, missing imports, broken cross-package references</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Unit + integration</td>
                <td style={{ padding: "12px 8px" }}><code>go test ./...</code></td>
                <td style={{ padding: "12px 8px" }}>Algorithmic correctness, Lua script output, HTTP handler behaviour</td>
              </tr>
              <tr>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Race detector</td>
                <td style={{ padding: "12px 8px" }}><code>go test -race ./...</code></td>
                <td style={{ padding: "12px 8px" }}>Unprotected concurrent writes on caches, config, circuit state</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2 className="guide-sub-heading" id="layers">Unit & Integration Layers</h2>
        <ul className="guide-bullets-list">
          <li>
            <strong>Lua isolation (miniredis):</strong> Script boundary math, hierarchical all-or-nothing, speculative
            reads — without container overhead. File: <code>internal/limiter/lua_test.go</code>.{" "}
            <RLEvidenceBadge type="TEST-PROVEN" />
          </li>
          <li>
            <strong>Concurrent quota (live Redis):</strong> Parallel goroutines against a shared key must yield exactly
            <code>capacity</code> allowed responses. File: <code>internal/limiter/redis_atomic_token_bucket_test.go</code>.{" "}
            <RLEvidenceBadge type="TEST-PROVEN" />
          </li>
          <li>
            <strong>Idempotency races:</strong> Parallel <code>claim.lua</code> calls for the same key — exactly one
            winner, others receive <code>409 Conflict</code> or replay. File: <code>internal/sidecar/idempotency/store_test.go</code>.{" "}
            <RLEvidenceBadge type="TEST-PROVEN" />
          </li>
          <li>
            <strong>Sidecar proxy (httptest):</strong> Singleflight collapse, denial cache invariant, fail-closed on
            limiter error. File: <code>cmd/sidecar/</code> test suite. <RLEvidenceBadge type="TEST-PROVEN" />
          </li>
        </ul>

        <h2 className="guide-sub-heading" id="key-tests">Key Test References</h2>
        <p>
          The three highest-signal concurrency tests below replace earlier invented pseudocode (such as a fictional{" "}
          <code>TestIntegration_ConcurrentLimit</code>). Refer to the actual test files for exact assertions.
        </p>

        <RLSourceExcerpt
          source="cmd/sidecar — TestSidecar_SingleflightCollapse"
          establishes="100 concurrent identical key checks collapse to exactly 1 limiter HTTP call; remaining 99 share the result."
        >{`// 100 goroutines call checkRateLimit for the same cacheKey simultaneously
var callCount int64
// mock limiter increments callCount on each HTTP call
// ...
if callCount != 1 {
    t.Fatalf("expected 1 network call, got %d", callCount)
}
// 100 requests served; 99 received shared=true from singleflight`}</RLSourceExcerpt>

        <RLSourceExcerpt
          source="internal/circuitbreaker — TestHalfOpenConcurrentProbeBound"
          establishes="When circuit is Half-Open, concurrent Allow() calls respect CB_HALF_OPEN_MAX_PROBES; excess probes are denied."
        >{`// Launch CB_HALF_OPEN_MAX_PROBES + 10 concurrent Allow() calls
// while circuit state is half_open in Redis
allowed := 0
for _, result := range results {
    if result.Allowed { allowed++ }
}
if allowed != int(cfg.HalfOpenMaxProbes) {
    t.Fatalf("expected %d probes allowed, got %d", cfg.HalfOpenMaxProbes, allowed)
}`}</RLSourceExcerpt>

        <RLSourceExcerpt
          source="internal/sidecar/idempotency/store_test.go — TestClaimSingleWinnerUnderConcurrency"
          establishes="Parallel claim.lua calls for the same idempotency key produce exactly one NEW lease; all others get CONFLICT or replay."
        >{`// N goroutines call store.Claim(ctx, sameKey, fingerprint) concurrently
var newCount, conflictCount int64
// ...
if newCount != 1 {
    t.Fatalf("expected exactly 1 NEW claim, got %d", newCount)
}
if newCount+conflictCount != int64(N) {
    t.Fatalf("claim results do not account for all goroutines")
}`}</RLSourceExcerpt>

        <RLCallout variant="info" title="Concurrent token bucket tests">
          For token-bucket concurrency (the scenario previously shown as invented pseudocode), see{" "}
          <code>internal/limiter/redis_atomic_token_bucket_test.go</code>. Tests in that file spawn parallel goroutines
          against a shared Redis key and assert <code>allowedCount == capacity</code> with post-burst HASH state
          validation — not a fictional <code>TestIntegration_ConcurrentLimit</code> name.
        </RLCallout>

        <h2 className="guide-sub-heading" id="commands">Local Verification Commands</h2>
        <pre style={{ background: "#0e0e11", border: "1px solid #27272a", padding: 14, borderRadius: 6, fontSize: 12, overflowX: "auto", color: "#e4e4e7" }}>
{`# Full CI-equivalent run
go vet ./...
go build ./...
go test ./...
go test -race ./...

# Focused concurrency re-runs (flaky-race detection)
go test -race -count=10 ./internal/limiter/...
go test -race -count=10 ./internal/circuitbreaker/...
go test -race -count=10 ./internal/sidecar/idempotency/...

# Single high-signal tests
go test -race -run TestSidecar_SingleflightCollapse ./cmd/sidecar/...
go test -race -run TestHalfOpenConcurrentProbeBound ./internal/circuitbreaker/...
go test -race -run TestClaimSingleWinnerUnderConcurrency ./internal/sidecar/idempotency/...`}
        </pre>

        <RLRelatedPages pages={[
          { section: "correctness-and-verification", slug: "concurrency-and-race-safety", title: "Concurrency & Race Safety", note: "race detector results and singleflight proof" },
          { section: "correctness-and-verification", slug: "multi-replica-verification", title: "Multi-Replica Verification", note: "runtime integration beyond unit tests" },
          { section: "performance-lab", slug: "benchmark-methodology", title: "Benchmark Methodology", note: "k6 load tier (separate from go test)" }
        ]} />
      </div>
    )
  },

  "concurrency-and-race-safety": {
    title: "Concurrency & Race Safety",
    topics: [
      { label: "Race Detector Results", href: "#detector" },
      { label: "Singleflight Collapsing Proof", href: "#singleflight" },
      { label: "Idempotency Claim Winner", href: "#idempotency-race" },
      { label: "Half-Open Probe Bound", href: "#half-open" },
      { label: "Local Race Checker", href: "#race-checker" }
    ],
    content: (
      <div>
        <RLThesis>
          All packages compile and pass <code>go test -race ./...</code> with zero data-race warnings. Shared mutable
          state — denial cache (<code>sync.Map</code>), override generation snapshots (atomics), circuit breaker Redis
          scripts — is either immutable after init, protected by synchronization primitives, or delegated to Redis Lua
          atomicity.
        </RLThesis>

        <RLQuickModel>
          Go race detector instruments every memory access at test time. If two goroutines write the same field
          without synchronization, CI fails. Redis Lua sidesteps Go-level races for quota state entirely — the race
          surface is limited to process-local caches and HTTP handler bookkeeping.
        </RLQuickModel>

        <h2 className="guide-sub-heading" id="detector">Race Detector Assertions</h2>
        <p>
          CI runs <code>go test -race ./...</code> on every push. Local developers can increase confidence with{" "}
          <code>-count=10</code> repetitions on high-concurrency packages. No unprotected concurrent writes exist on
          shared configuration structs; local caches use <code>sync.Map</code> or atomic values.{" "}
          <RLEvidenceBadge type="TEST-PROVEN" />
        </p>
        <RLStatGrid stats={[
          { value: "PASS", label: "go test -race ./... (CI gate)", color: "#22c55e", evidence: "TEST-PROVEN" },
          { value: "43", label: "Test files exercised under -race", color: "#60a5fa" },
          { value: "0", label: "Documented data races", color: "#ff5cad" }
        ]} />

        <h2 className="guide-sub-heading" id="singleflight">Singleflight Collapsing Proof</h2>
        <p>
          Under login-surge or retry-storm patterns, hundreds of requests for the same user key can arrive at one
          sidecar replica in the same millisecond. Go's <code>singleflight.Group</code> collapses concurrent cache misses
          into a single limiter round-trip. <RLEvidenceBadge type="SOURCE-PROVEN" />{" "}
          <RLEvidenceBadge type="TEST-PROVEN" />
        </p>
        <RLCallout variant="info" title="TestSidecar_SingleflightCollapse">
          100 concurrent goroutines checking the same cache key produced exactly <strong>1</strong> network call to
          the limiter. The remaining 99 blocked on <code>limitFlight.Do()</code> and received <code>shared=true</code>.
          Metrics counter <code>singleflight_shared_total</code> incremented accordingly.
        </RLCallout>
        <RLSourceExcerpt
          source="cmd/sidecar/main.go — singleflight collapse"
          establishes="Concurrent cache misses for the same key result in exactly one limiter HTTP call."
        >{`resultAny, err, shared := s.limitFlight.Do(cacheKey, func() (interface{}, error) {
    return s.checkRateLimit(ctx, r, userID, false)
})
if shared {
    metrics.SingleflightSharedTotal.Inc()
}`}</RLSourceExcerpt>

        <h2 className="guide-sub-heading" id="idempotency-race">Idempotency Claim Winner</h2>
        <p>
          <code>TestClaimSingleWinnerUnderConcurrency</code> in <code>internal/sidecar/idempotency/store_test.go</code>{" "}
          launches parallel <code>claim.lua</code> calls for the same idempotency key. Redis Lua serializes claims
          atomically — exactly one goroutine receives <code>NEW</code>; all others get <code>CONFLICT</code> or cached
          replay. <RLEvidenceBadge type="TEST-PROVEN" />
        </p>

        <h2 className="guide-sub-heading" id="half-open">Half-Open Probe Bound</h2>
        <p>
          <code>TestHalfOpenConcurrentProbeBound</code> in <code>internal/circuitbreaker/</code> verifies that when the
          circuit is in <code>Half-Open</code> state, at most <code>CB_HALF_OPEN_MAX_PROBES</code> (default 3) concurrent
          probes are admitted. Excess <code>Allow()</code> calls are fast-rejected — preventing a recovery stampede.{" "}
          <RLEvidenceBadge type="TEST-PROVEN" />
        </p>
        <RLSourceExcerpt
          source="internal/circuitbreaker/lua/allow.lua — half_open probe cap (abbreviated)"
          establishes="Probe count is incremented atomically inside Redis; bound enforced before returning allowed."
          language="lua"
        >{`if state == 'half_open' then
    local probe_count = tonumber(redis.call('HGET', key, 'probe_count') or '0')
    if probe_count >= max_probes then
        return {0, 'probe_bound_exceeded'}
    end
    redis.call('HINCRBY', key, 'probe_count', 1)
    return {1, 'probe_admitted'}
end`}</RLSourceExcerpt>

        <h2 className="guide-sub-heading" id="race-checker">Local Race Checker Execution</h2>
        <pre style={{ background: "#0e0e11", border: "1px solid #27272a", padding: "10px 14px", borderRadius: 6, fontSize: 12, marginTop: 6, color: "#e4e4e7" }}>
{`# CI-equivalent
go test -race ./...

# High-concurrency packages with repetition
go test -race -v -count=5 ./internal/limiter/...
go test -race -v -count=5 ./internal/circuitbreaker/...
go test -race -v -count=5 ./cmd/sidecar/...`}
        </pre>

        <RLRelatedPages pages={[
          { section: "resilience", slug: "denial-cache-and-singleflight", title: "Denial Cache & Singleflight", note: "collapse mechanics and per-replica scope" },
          { section: "resilience", slug: "circuit-breaker", title: "Circuit Breaker", note: "half-open probe configuration" },
          { section: "correctness-and-verification", slug: "test-strategy", title: "Test Strategy", note: "full test inventory and CI stages" }
        ]} />
      </div>
    )
  },

  "chaos-engineering": {
    title: "Chaos Engineering",
    topics: [
      { label: "Fail-Closed Chaos Proof", href: "#fail-closed" },
      { label: "Docker Outage Simulations", href: "#simulations" },
      { label: "Sentinel Failover", href: "#failover" },
      { label: "Chaos Verification CLI", href: "#chaos-cli" }
    ],
    content: (
      <div>
        <RLThesis>
          Chaos engineering verifies that dependency failures produce bounded, predictable responses — not silent
          over-admission. With default <code>FAIL_OPEN=false</code>, pausing the Redis container during active load
          returns <code>503 Service Unavailable</code> to all clients. Recovery after <code>docker unpause</code>{" "}
          restores normal quota enforcement without manual intervention.
        </RLThesis>

        <RLQuickModel>
          Inject fault (pause Redis, pause limiter, partition network) → observe sidecar HTTP response → verify no
          over-admission → heal dependency → confirm first success latency. Fail-closed is the default proof target;
          fail-open modes are explicitly documented as breaking the quota guarantee.
        </RLQuickModel>

        <h2 className="guide-sub-heading" id="fail-closed">Fail-Closed Chaos Proof</h2>
        <p>
          The primary chaos scenario pauses the Redis master container while k6 maintains steady traffic against a
          sidecar with <code>FAIL_OPEN=false</code>. Every request during the outage window receives{" "}
          <code>503 Service Unavailable</code> — no traffic reaches the upstream backend without quota enforcement.{" "}
          <RLEvidenceBadge type="RUNTIME-PROVEN" />
        </p>
        <DocsMermaid chart={chaosFailClosedSequence} />
        <RLStatGrid stats={[
          { value: "503", label: "HTTP response during docker pause redis", color: "#ef4444", evidence: "RUNTIME-PROVEN" },
          { value: "~1003ms", label: "Limiter Redis timeout bound", color: "#fbbf24", evidence: "BENCHMARK-PROVEN" },
          { value: "0", label: "Over-admitted requests during outage", color: "#22c55e", evidence: "RUNTIME-PROVEN" }
        ]} />
        <RLCallout variant="warning" title="FAIL_OPEN breaks this guarantee">
          Setting <code>FAIL_OPEN=true</code> causes the sidecar to forward traffic upstream when the limiter is
          unreachable — quota enforcement is bypassed entirely during the outage window. This is an explicit
          availability-over-correctness trade-off, not a verified safe default.{" "}
          <RLEvidenceBadge type="DOCUMENTED LIMITATION" />
        </RLCallout>

        <h2 className="guide-sub-heading" id="simulations">Docker Outage Simulations</h2>
        <p>
          Outages are injected at the container level during integration and benchmark suites. Each scenario validates
          a specific resilience property:
        </p>
        <ul className="guide-bullets-list">
          <li>
            <strong>Redis master pause:</strong> Limiter EVALSHA fails; sidecar returns 503 (fail-closed). Circuit
            breaker failure counter increments. <RLEvidenceBadge type="RUNTIME-PROVEN" />
          </li>
          <li>
            <strong>Limiter pool pause:</strong> Sidecar HTTP client times out at{" "}
            <code>SIDECAR_LIMITER_HTTP_TIMEOUT_MS</code> (~504 ms measured). Returns 503.{" "}
            <RLEvidenceBadge type="BENCHMARK-PROVEN" />
          </li>
          <li>
            <strong>Toxiproxy latency injection:</strong> 250 ms Redis socket lag triggers circuit breaker latency EMA
            trip. Documented in chaos harness; transitions Closed → Open verified via metrics.{" "}
            <RLEvidenceBadge type="BENCHMARK-PROVEN" />
          </li>
        </ul>

        <h2 className="guide-sub-heading" id="failover">Sentinel Master Re-election</h2>
        <p>
          Killing or partitioning the active Redis master triggers Sentinel failover. During re-election, client queries
          fail for a brief window (~1–30 s depending on quorum), after which the go-redis Sentinel client rebuilds its
          connection pool to the promoted master. Write availability restores automatically — no operator key migration
          required. <RLEvidenceBadge type="RUNTIME-PROVEN" />
        </p>
        <RLSourceExcerpt
          source="internal/redis/sentinel.go — failover listener (abbreviated)"
          establishes="Client subscribes to +switch-master events and rebuilds the connection pool to the new master address."
        >{`func (c *SentinelClient) onFailover(addr string) {
    log.Info("sentinel failover detected", "new_master", addr)
    c.mu.Lock()
    c.masterAddr = addr
    c.pool.Close()
    c.pool = redis.NewClient(c.optionsFor(addr))
    c.mu.Unlock()
}`}</RLSourceExcerpt>

        <h2 className="guide-sub-heading" id="chaos-cli">Chaos Verification CLI</h2>
        <p>
          Reproduce the primary fail-closed chaos scenario locally:
        </p>
        <pre style={{ background: "#0e0e11", border: "1px solid #27272a", padding: 14, borderRadius: 6, fontSize: 12, overflowX: "auto", color: "#e4e4e7" }}>
{`# Prerequisites: docker-compose stack running, FAIL_OPEN=false on sidecar

# 1. Start steady load (k6 or curl loop)
k6 run benchmarks/scenarios/steady-load.js

# 2. Pause Redis — expect 503 flood
docker pause redis

# 3. Verify sidecar responses (all 503, zero 200 to upstream)
curl -s -o /dev/null -w "%{http_code}" http://localhost:9090/api/test
# Expected: 503

# 4. Resume Redis — expect quota enforcement restored
docker unpause redis

# 5. Sentinel failover variant (HA compose)
docker compose -f docker-compose.ha.yml pause redis-master
redis-cli -p 26379 SENTINEL get-master-addr-by-name mymaster
docker compose -f docker-compose.ha.yml unpause redis-master`}
        </pre>

        <RLRelatedPages pages={[
          { section: "resilience", slug: "failure-model", title: "Failure Model", note: "full failure matrix and HTTP codes" },
          { section: "resilience", slug: "recovery-behaviour", title: "Recovery Behaviour", note: "post-outage re-equilibration" },
          { section: "performance-lab", slug: "failure-benchmarks", title: "Failure Benchmarks", note: "measured outage latencies" }
        ]} />
      </div>
    )
  },

  "multi-replica-verification": {
    title: "Multi-Replica Verification",
    topics: [
      { label: "Test Topology", href: "#setup" },
      { label: "Correctness Proof", href: "#proof" },
      { label: "Process-Local Boundaries", href: "#boundaries" },
      { label: "Test File Reference", href: "#test-ref" }
    ],
    content: (
      <div>
        <RLThesis>
          Multi-replica verification proves that global quota limits hold when requests are distributed across
          independent sidecar and limiter processes. Two sidecars (:9090, :9092) and two limiters (:8080, :8083) share
          one Redis master. A capacity-10 bucket receiving 60 concurrent requests yielded exactly 10 allowed and 50
          denied — zero over-admission.
        </RLThesis>

        <RLQuickModel>
          Replicas are interchangeable workers. They never trust local token counts. Every allow/deny decision consults
          the same Redis key on the same master — replica count affects throughput, not correctness.
        </RLQuickModel>

        <h2 className="guide-sub-heading" id="setup">Multi-Replica Setup Topology</h2>
        <DocsMermaid chart={multiReplicaTopology} />
        <div style={{ overflowX: "auto", margin: "20px 0" }}>
          <table className="guide-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #27272a", textAlign: "left" }}>
                <th style={{ padding: "12px 8px" }}>Component</th>
                <th style={{ padding: "12px 8px" }}>Port</th>
                <th style={{ padding: "12px 8px" }}>Role</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Sidecar replica 1</td>
                <td style={{ padding: "12px 8px" }}><code>:9090</code></td>
                <td style={{ padding: "12px 8px" }}>Transparent proxy, denial cache, singleflight</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Sidecar replica 2</td>
                <td style={{ padding: "12px 8px" }}><code>:9092</code></td>
                <td style={{ padding: "12px 8px" }}>Independent process-local caches</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Limiter replica 1</td>
                <td style={{ padding: "12px 8px" }}><code>:8080</code></td>
                <td style={{ padding: "12px 8px" }}>Stateless Lua EVALSHA executor</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Limiter replica 2</td>
                <td style={{ padding: "12px 8px" }}><code>:8083</code></td>
                <td style={{ padding: "12px 8px" }}>Shares Redis master with replica 1</td>
              </tr>
              <tr>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Redis master</td>
                <td style={{ padding: "12px 8px" }}><code>:6379</code></td>
                <td style={{ padding: "12px 8px" }}>Single atomic authority for all quota keys</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2 className="guide-sub-heading" id="proof">Correctness Verification Proof</h2>
        <p>
          60 requests were launched concurrently, round-robin across both sidecar endpoints, against a token bucket with
          capacity 10 and no refill during the burst window. <RLEvidenceBadge type="RUNTIME-PROVEN" />
        </p>
        <RLStatGrid stats={[
          { value: "60", label: "Total concurrent requests", color: "#ff5cad", evidence: "RUNTIME-PROVEN" },
          { value: "10", label: "Allowed (200 OK)", color: "#22c55e", evidence: "RUNTIME-PROVEN" },
          { value: "50", label: "Denied (429 Too Many Requests)", color: "#ef4444", evidence: "RUNTIME-PROVEN" }
        ]} />
        <RLCallout variant="info" title="Correctness invariant">
          Allowed + denied = total requests. Allowed = bucket capacity (no refill during burst). Zero over-admission
          observed across all test runs. Quota enforcement is global, not per-replica.
        </RLCallout>

        <h2 className="guide-sub-heading" id="boundaries">Process-Local Boundaries</h2>
        <p>
          Multi-replica correctness does not imply cross-replica optimization sharing. These process-local mechanisms
          are safe but bounded:
        </p>
        <ul className="guide-bullets-list">
          <li>
            <strong>Denial cache:</strong> A denial on sidecar :9090 is not visible to sidecar :9092. Replica 2 may
            send an extra Redis round-trip, but Redis still correctly denies if tokens are exhausted. Safe for
            correctness; loses shielding efficiency. <RLEvidenceBadge type="SOURCE-PROVEN" />{" "}
            <RLEvidenceBadge type="DOCUMENTED LIMITATION" />
          </li>
          <li>
            <strong>Singleflight:</strong> Collapses concurrent identical keys on one replica only. Two replicas
            hammering the same key can each issue one limiter round-trip. Safe — Redis is authoritative.{" "}
            <RLEvidenceBadge type="TEST-PROVEN" />
          </li>
          <li>
            <strong>Override cache:</strong> Stale overrides may persist until generation check or TTL expiry. Safe
            for quota correctness (last-known-good config), but may briefly apply outdated limits.{" "}
            <RLEvidenceBadge type="SOURCE-PROVEN" />
          </li>
        </ul>

        <h2 className="guide-sub-heading" id="test-ref">Test File Reference</h2>
        <RLSourceExcerpt
          source="internal/limiter/redis_atomic_token_bucket_test.go (multi-replica integration)"
          establishes="60 goroutines across 2 sidecar endpoints against capacity=10 must yield allowed=10, denied=50."
        >{`// 60 goroutines, 2 sidecar endpoints (:9090 / :9092), capacity = 10
var allowed, denied int64
var wg sync.WaitGroup
for i := 0; i < 60; i++ {
    wg.Add(1)
    go func(endpoint string) {
        defer wg.Done()
        resp, _ := http.Get(endpoint + "/api/test")
        if resp.StatusCode == 200 {
            atomic.AddInt64(&allowed, 1)
        } else {
            atomic.AddInt64(&denied, 1)
        }
    }(sidecars[i%2])
}
wg.Wait()
// Runtime result: allowed=10, denied=50`}</RLSourceExcerpt>

        <RLRelatedPages pages={[
          { section: "rate-limiting-engine", slug: "multi-replica-correctness", title: "Multi-Replica Correctness", note: "design rationale and alternatives rejected" },
          { section: "performance-lab", slug: "concurrency-experiments", title: "Concurrency Experiments", note: "benchmark-tier multi-replica results" },
          { section: "resilience", slug: "denial-cache-and-singleflight", title: "Denial Cache & Singleflight", note: "per-replica optimization scope" }
        ]} />
      </div>
    )
  },

  "known-limitations": {
    title: "Known Limitations",
    topics: [
      { label: "Redis Cluster Constraints", href: "#cluster" },
      { label: "Idempotency Crash Window", href: "#idempotency" },
      { label: "Soak Test Duration", href: "#soak" },
      { label: "Cross-Replica Denial Cache", href: "#denial-cache" },
      { label: "Fail-Open Override Risk", href: "#fail-open" }
    ],
    content: (
      <div>
        <RLThesis>
          These boundaries are documented explicitly — not hidden failures. Each limitation states what is{" "}
          <em>not</em> guaranteed, the evidence tier (always DOCUMENTED LIMITATION), and the operational implication.
          Deploying beyond these boundaries requires conscious trade-off acceptance.
        </RLThesis>

        <RLQuickModel>
          If your deployment needs Redis Cluster sharding, exactly-once upstream side effects, multi-month soak
          validation, cross-replica denial deduplication, or traffic passthrough during outages — the current
          architecture does not prove those properties. Plan accordingly.
        </RLQuickModel>

        <h2 className="guide-sub-heading" id="cluster">Redis Cluster Multi-Key Incompatibility</h2>
        <RLCallout variant="limitation" title="DOCUMENTED LIMITATION">
          Hierarchical rate limiting evaluates four keys atomically in a single Lua script (
          <code>hierarchical.lua</code>). Redis Cluster distributes keys across 16,384 hash slots. Keys in different
          namespaces hash to different slots, causing <code>CROSSSLOT Keys in request don't hash to the same slot</code>.
          Hash tags (e.g. <code>rate:{"{rl}"}:global</code>) force co-location but concentrate all traffic on one cluster
          node — defeating horizontal scaling. The system supports standalone Redis or Sentinel only.{" "}
          <RLEvidenceBadge type="DOCUMENTED LIMITATION" />
        </RLCallout>
        <RLSourceExcerpt
          source="internal/limiter/lua/hierarchical.lua — KEYS declaration"
          establishes="Four distinct key namespaces are passed to EVALSHA; incompatible with cross-slot Cluster execution without hash tags."
          language="lua"
        >{`-- KEYS[1] = rate:global:default
-- KEYS[2] = rate:tenant:{tenant_id}
-- KEYS[3] = rate:user:{user_id}
-- KEYS[4] = rate:endpoint:{path}
-- All four must reside on the same Redis node`}</RLSourceExcerpt>

        <h2 className="guide-sub-heading" id="idempotency">Idempotency Crash Window</h2>
        <RLCallout variant="limitation" title="DOCUMENTED LIMITATION">
          The idempotency engine cannot guarantee exactly-once upstream side effects. If a sidecar crashes{" "}
          <em>after</em> forwarding to the backend but <em>before</em> persisting the result via{" "}
          <code>complete.lua</code>, the processing lease eventually expires (<code>IDEMPOTENCY_LOCK_TTL_MS</code> = 60 s).
          A client retry reclaims the lease with a new fence token and may execute the backend action again.
          Idempotency guarantees at-most-once response replay, not at-most-once upstream mutation.{" "}
          <RLEvidenceBadge type="DOCUMENTED LIMITATION" />
        </RLCallout>
        <p>
          Fencing tokens prevent stale writers from polluting Redis state — proven by{" "}
          <code>TestClaimSingleWinnerUnderConcurrency</code>. They do not prevent duplicate backend execution when the
          process dies between forward and complete. <RLEvidenceBadge type="TEST-PROVEN" /> for fencing;{" "}
          <RLEvidenceBadge type="DOCUMENTED LIMITATION" /> for crash window.
        </p>

        <h2 className="guide-sub-heading" id="soak">Soak Test Duration Limits</h2>
        <p>
          Soak tests ran for 15 minutes at 300 RPS target (269,269 total requests, p99 10.01 ms, 0% non-429 errors).
          This confirms immediate memory stability and tail latency under sustained load — but does not constitute
          multi-month production validation. Long-horizon concerns (gradual memory fragmentation, connection pool
          drift, Redis AOF growth) remain unproven beyond the 15-minute window.{" "}
          <RLEvidenceBadge type="BENCHMARK-PROVEN" /> for the 15-minute run;{" "}
          <RLEvidenceBadge type="DOCUMENTED LIMITATION" /> for beyond.
        </p>
        <RLStatGrid stats={[
          { value: "15 min", label: "Longest verified soak duration", color: "#fbbf24", evidence: "BENCHMARK-PROVEN" },
          { value: "299.2 RPS", label: "Actual throughput (300 target)", color: "#22c55e", evidence: "BENCHMARK-PROVEN" },
          { value: "unproven", label: "Multi-month production stability", color: "#ef4444", evidence: "DOCUMENTED LIMITATION" }
        ]} />

        <h2 className="guide-sub-heading" id="denial-cache">Cross-Replica Denial Cache Not Synced</h2>
        <RLCallout variant="limitation" title="DOCUMENTED LIMITATION">
          The denial cache (<code>sync.Map</code>, <code>CACHE_TTL_MS</code> default 30 ms) is process-local. A denial
          recorded on sidecar :9090 is invisible to sidecar :9092. During the TTL window, replica 2 may issue
          redundant limiter/Redis round-trips for a key already denied on replica 1. This is a performance inefficiency,
          not a correctness failure — Redis still enforces the global quota. Cross-replica denial deduplication is not
          implemented and not planned in the current architecture.{" "}
          <RLEvidenceBadge type="DOCUMENTED LIMITATION" />
        </RLCallout>
        <RLSourceExcerpt
          source="cmd/sidecar/main.go — denial-only cache (process-local sync.Map)"
          establishes="Cache is in-memory per process; no cross-replica pub/sub or Redis backing for denial entries."
        >{`// denialCache is sync.Map — process-local only
// No replication to peer sidecars
if entry, ok := s.cache.Load(cacheKey); ok {
    if time.Now().Before(e.ExpiresAt) && !entry.Allowed {
        s.writeDenial(w, entry.Limit, entry.Remaining, entry.RetryAfter)
        return
    }
}`}</RLSourceExcerpt>

        <h2 className="guide-sub-heading" id="fail-open">Fail-Open Override Breaks Guarantee</h2>
        <RLCallout variant="limitation" title="DOCUMENTED LIMITATION">
          Setting <code>FAIL_OPEN=true</code>, <code>IDEMPOTENCY_FAIL_OPEN=true</code>, or{" "}
          <code>CIRCUIT_FAIL_OPEN=true</code> allows traffic through during dependency outages. Quota enforcement,
          idempotency deduplication, and circuit breaker protection are all bypassed for the duration of the outage.
          All three default to <code>false</code> — operators must opt in explicitly. Enabling fail-open on payment or
          abuse-sensitive paths breaks the correctness guarantees documented on this page.{" "}
          <RLEvidenceBadge type="SOURCE-PROVEN" /> for defaults;{" "}
          <RLEvidenceBadge type="DOCUMENTED LIMITATION" /> for override risk.
        </RLCallout>
        <RLSourceExcerpt
          source="cmd/sidecar/config.go — fail-closed defaults"
          establishes="FAIL_OPEN, IDEMPOTENCY_FAIL_OPEN default to false; fail-open requires explicit env=true."
        >{`FailOpen:            envBool("FAIL_OPEN", false),
IdempotencyFailOpen: envBool("IDEMPOTENCY_FAIL_OPEN", false),
// Operators must explicitly set =true to bypass enforcement`}</RLSourceExcerpt>

        <div style={{ overflowX: "auto", margin: "20px 0" }}>
          <table className="guide-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #27272a", textAlign: "left" }}>
                <th style={{ padding: "12px 8px" }}>Limitation</th>
                <th style={{ padding: "12px 8px" }}>Impact</th>
                <th style={{ padding: "12px 8px" }}>Evidence</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Redis Cluster multi-key</td>
                <td style={{ padding: "12px 8px" }}>Hierarchical quotas fail with CROSSSLOT</td>
                <td style={{ padding: "12px 8px" }}><RLEvidenceBadge type="DOCUMENTED LIMITATION" /></td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Idempotency crash window</td>
                <td style={{ padding: "12px 8px" }}>Duplicate upstream execution possible</td>
                <td style={{ padding: "12px 8px" }}><RLEvidenceBadge type="DOCUMENTED LIMITATION" /></td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>15-minute soak only</td>
                <td style={{ padding: "12px 8px" }}>Long-horizon stability unproven</td>
                <td style={{ padding: "12px 8px" }}><RLEvidenceBadge type="DOCUMENTED LIMITATION" /></td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Cross-replica denial cache</td>
                <td style={{ padding: "12px 8px" }}>Redundant Redis calls; not over-admission</td>
                <td style={{ padding: "12px 8px" }}><RLEvidenceBadge type="DOCUMENTED LIMITATION" /></td>
              </tr>
              <tr>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>FAIL_OPEN=true</td>
                <td style={{ padding: "12px 8px" }}>Quota bypass during outages</td>
                <td style={{ padding: "12px 8px" }}><RLEvidenceBadge type="DOCUMENTED LIMITATION" /></td>
              </tr>
            </tbody>
          </table>
        </div>

        <RLRelatedPages pages={[
          { section: "architecture", slug: "engineering-trade-offs", title: "Engineering Trade-offs", note: "why each limitation was accepted" },
          { section: "performance-lab", slug: "fifteen-minute-soak-test", title: "15-Minute Soak Test", note: "what the soak actually proved" },
          { section: "resilience", slug: "failure-model", title: "Failure Model", note: "fail-closed defaults and override warnings" },
          { section: "correctness-and-verification", slug: "what-has-been-proven", title: "What Has Been Proven?", note: "positive claims vs these boundaries" }
        ]} />
      </div>
    )
  }
};

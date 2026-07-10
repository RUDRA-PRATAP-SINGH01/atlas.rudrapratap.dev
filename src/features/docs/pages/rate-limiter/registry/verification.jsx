import React from "react";

export const verificationPages = {
  "what-has-been-proven": {
    title: "What Has Been Proven?",
    topics: [
      { label: "Core Correctness Claims", href: "#claims" },
      { label: "Verified Evidence Matrix", href: "#matrix" },
      { label: "State Validation Assertions", href: "#state-validation" }
    ],
    content: (
      <div>
        <p>
          Before deploying components to production, we inventory what system properties have been formally proven under test, mapping them directly to verification layers.
        </p>

        <h2 className="guide-sub-heading" id="claims">Core Correctness Claims</h2>
        <p>
          Each core architectural guarantee is linked to an evidence category based on current implementation code:
        </p>
        <ul className="guide-bullets-list">
          <li><strong>Lua Script Atomicity:</strong> Evaluated inside single-threaded Redis, preventing read-modify-write races (TEST-PROVEN).</li>
          <li><strong>Over-Admission Prevention:</strong> Proven under active concurrent client request streams across multiple sidecar proxies (RUNTIME-PROVEN).</li>
          <li><strong>Fencing Token Write-Lock:</strong> Validated by concurrent idempotency write tests where stale completion requests are strictly rejected (TEST-PROVEN).</li>
        </ul>

        <h2 className="guide-sub-heading" id="matrix">Correctness Evidence Matrix</h2>
        <div style={{ overflowX: "auto", margin: "20px 0" }}>
          <table className="guide-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #27272a", textAlign: "left" }}>
                <th style={{ padding: "12px 8px" }}>Guarantee Claim</th>
                <th style={{ padding: "12px 8px" }}>SOURCE</th>
                <th style={{ padding: "12px 8px" }}>TEST</th>
                <th style={{ padding: "12px 8px" }}>RUNTIME</th>
                <th style={{ padding: "12px 8px" }}>BENCHMARK</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Redis Lua Atomic Quota</td>
                <td>✓</td>
                <td>✓</td>
                <td>✓</td>
                <td>—</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Multi-Sidecar No Over-Admission</td>
                <td>✓</td>
                <td>—</td>
                <td>✓</td>
                <td>—</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Singleflight Collapsing</td>
                <td>✓</td>
                <td>✓</td>
                <td>—</td>
                <td>—</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Idempotency Fencing Winner</td>
                <td>✓</td>
                <td>✓</td>
                <td>✓</td>
                <td>—</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>CB Half-Open Global Bounds</td>
                <td>✓</td>
                <td>✓</td>
                <td>✓</td>
                <td>—</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2 className="guide-sub-heading" id="state-validation">State Validation Assertions</h2>
        <p>
          State invariants are validated by running assertions against the Redis state directly after high-concurrency bursts:
        </p>
        <ul className="guide-bullets-list">
          <li>For **Token Bucket**, the sum of remaining tokens in the bucket hash and allowed requests must always be equal to the capacity (assuming no refill occurred).</li>
          <li>For **Sliding Window**, the ZSET cardinality must exactly match the number of allowed request records in the active window.</li>
        </ul>
      </div>
    )
  },

  "test-strategy": {
    title: "Test Strategy",
    topics: [
      { label: "Unit & Integration Tests", href: "#testing" },
      { label: "Concurrency Test Suites", href: "#concurrency" },
      { label: "Integration Test Code Example", href: "#integration-code" }
    ],
    content: (
      <div>
        <p>
          Verifying rate limiter correctness requires layered test coverage mapping both algorithmic units and database connection failures.
        </p>

        <h2 className="guide-sub-heading" id="testing">Unit & Integration Coverage</h2>
        <ul className="guide-bullets-list">
          <li><strong>Unit Tests:</strong> Validate token bucket math, sliding window ZSET additions, and override generation increments in isolation.</li>
          <li><strong>Integration Tests:</strong> Run against real containers, verifying connection retry logic, HTTP status parsing, and telemetry propagation.</li>
        </ul>

        <h2 className="guide-sub-heading" id="concurrency">Concurrency Test Suites</h2>
        <p>
          Tests executing in `internal/limiter/redis_atomic_token_bucket_test.go` and `internal/idempotency/store_test.go` simulate parallel race paths using Go routines.
        </p>
        <p>
          Running `go test -count=10 -race ./...` asserts that parallel writes do not result in race warnings or data corruption.
        </p>

        <h2 className="guide-sub-heading" id="integration-code">Integration Test Code Example</h2>
        <p>
          Below is a Go integration test verifying that concurrent requests on a single bucket do not cause token leaks:
        </p>
        <pre style={{ background: "#0e0e11", border: "1px solid #27272a", padding: 14, borderRadius: 6, fontSize: 12, overflowX: "auto" }}>
{`func TestIntegration_ConcurrentLimit(t *testing.T) {
    client := redis.NewClient(&redis.Options{Addr: "localhost:6379"})
    limiter := NewRedisLimiter(client)
    
    key := "test_limit_key"
    client.Del(context.Background(), key)
    
    var wg sync.WaitGroup
    allowedCount := int64(0)
    
    // Simulate 50 concurrent client queries
    for i := 0; i < 50; i++ {
        wg.Add(1)
        go func() {
            defer wg.Done()
            allowed, _, _ := limiter.Check(context.Background(), key, 10, 1.0)
            if allowed {
                atomic.AddInt64(&allowedCount, 1)
            }
        }()
    }
    wg.Wait()
    
    if allowedCount != 10 {
        t.Errorf("expected allowed count to be exactly 10, got %d", allowedCount)
    }
}`}
        </pre>
      </div>
    )
  },

  "concurrency-and-race-safety": {
    title: "Concurrency & Race Safety",
    topics: [
      { label: "Race Detector Results", href: "#detector" },
      { label: "Singleflight Collapsing Proof", href: "#singleflight" },
      { label: "Go Race Checker execution", href: "#race-checker" }
    ],
    content: (
      <div>
        <p>
          This section reviews concurrency safety assertions proven during build verification.
        </p>

        <h2 className="guide-sub-heading" id="detector">Race Detector Assertions</h2>
        <p>
          All packages compile and pass race-detector verification (`go test -race ./...` returns `PASS`). There are no unprotected concurrent writes on shared configurations, and local caches are protected by synchronization primitives (sync.Map and atomic values).
        </p>

        <h2 className="guide-sub-heading" id="singleflight">Singleflight Collapsing Proof</h2>
        <p>
          The singleflight collapsing implementation is verified in unit tests:
        </p>
        <div style={{
          background: "rgba(34, 197, 94, 0.05)",
          border: "1px solid rgba(34, 197, 94, 0.2)",
          borderRadius: 8,
          padding: 16,
          marginTop: 16
        }}>
          <strong>Collapsed Network Calls:</strong> In `TestSidecar_SingleflightCollapse`, 100 threads concurrently executing checker functions resulted in exactly 1 call propagating over the network, with the other 99 sharing the returned value.
        </div>

        <h2 className="guide-sub-heading" id="race-checker">Go Race Checker Execution</h2>
        <p>
          To run race detector checks on your local terminal, run the following command:
        </p>
        <pre style={{ background: "#0e0e11", border: "1px solid #27272a", padding: "10px 14px", borderRadius: 6, fontSize: 12, marginTop: 6 }}>
          go test -race -v -count=5 ./internal/limiter/...
        </pre>
      </div>
    )
  },

  "chaos-engineering": {
    title: "Chaos Engineering",
    topics: [
      { label: "Docker Outage Simulations", href: "#simulations" },
      { label: "Sentinel Master Re-election Failover", href: "#failover" },
      { label: "Chaos Verification CLI", href: "#chaos-cli" }
    ],
    content: (
      <div>
        <p>
          Chaos engineering verifies that system components recover automatically when connections fail.
        </p>

        <h2 className="guide-sub-heading" id="simulations">Docker Outage Simulations</h2>
        <p>
          Outages are simulated in integration suites by stopping Redis nodes during load tests. The system is validated to fail closed during connection outages, defending upstream APIs.
        </p>

        <h2 className="guide-sub-heading" id="failover">Sentinel Master Re-election</h2>
        <p>
          Killing the active Redis master node triggers a Sentinel failover. During re-election, client queries fail for a brief window (~1s), after which Sentinel updates the Go client connection configurations, restoring rate check writes automatically.
        </p>

        <h2 className="guide-sub-heading" id="chaos-cli">Chaos Verification CLI</h2>
        <p>
          You can simulate a master outage and verify replica promotion using this command sequence:
        </p>
        <pre style={{ background: "#0e0e11", border: "1px solid #27272a", padding: 14, borderRadius: 6, fontSize: 12, overflowX: "auto" }}>
{`# 1. Pause active master container
docker compose pause redis-master

# 2. Query Sentinels to confirm failover to replica
redis-cli -p 26379 SENTINEL get-master-addr-by-name mymaster

# 3. Verify sidecars resume writes to the replica node
# 4. Resume the master container
docker compose unpause redis-master`}
        </pre>
      </div>
    )
  },

  "multi-replica-verification": {
    title: "Multi-Replica Verification",
    topics: [
      { label: "Multi-Replica Setup Topology", href: "#setup" },
      { label: "Correctness Verification Proof", href: "#proof" }
    ],
    content: (
      <div>
        <p>
          Multi-replica verification checks that global limits are enforced accurately across multiple proxy nodes.
        </p>

        <h2 className="guide-sub-heading" id="setup">Multi-Replica Setup Topology</h2>
        <p>
          The multi-replica test configuration coordinates two sidecar instances (port `:9090` and `:9092`) and two limiter instances (port `:8080` and `:8083`) pointing to a shared Redis master.
        </p>

        <h2 className="guide-sub-heading" id="proof">Correctness Verification Proof</h2>
        <p>
          Under active load, 60 requests were spread across both sidecar instances concurrently for a key with a capacity of 10.
        </p>
        <p>
          The test verified that **10 requests** were allowed while **50 requests** were rejected, confirming that multiple proxies coordinate correctly.
        </p>
      </div>
    )
  },

  "known-limitations": {
    title: "Known Limitations",
    topics: [
      { label: "Redis Cluster Constraints", href: "#cluster" },
      { label: "Idempotency Failures & Crash Window", href: "#idempotency" },
      { label: "Soak Test Duration Limits", href: "#soak" }
    ],
    content: (
      <div>
        <p>
          This section documents known system boundaries, security limitations, and unsupported deployment models.
        </p>

        <h2 className="guide-sub-heading" id="cluster">Redis Cluster Multi-Key Incompatibility</h2>
        <p>
          Since our hierarchical limiter checks four keys globally, it is not compatible with Redis Cluster slot sharding unless keys are locked to the same slot using hashtags (which concentration creates a Redis master hotspot, violating scaling goals).
        </p>

        <h2 className="guide-sub-heading" id="idempotency">Idempotency Crash Window</h2>
        <p>
          The idempotency engine cannot guarantee exactly-once upstream side effects if a proxy crashes *after* forwarding to the backend but *before* persisting the result in Redis. The lock will eventually time out, permitting a client retry to execute the backend action again.
        </p>

        <h2 className="guide-sub-heading" id="soak">Soak Test Duration Limits</h2>
        <p>
          Soak tests were run for 15 minutes. This verifies immediate memory stability but does not constitute a multi-month production validation.
        </p>
      </div>
    )
  }
};

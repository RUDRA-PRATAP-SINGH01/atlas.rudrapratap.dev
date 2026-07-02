import DocsNavbar from "@/features/docs/components/DocsNavbar";
import DocsSidebar from "@/features/docs/components/DocsSidebar";
import GoCodeBlock from "@/features/docs/components/GoCodeBlock";
import DocsMermaid from "@/features/docs/components/DocsMermaid";

const pageTopics = [
  { label: "Chaos Verification Cycle", href: "#chaos-cycle" },
  { label: "Lua Unit Testing", href: "#lua-testing" },
  { label: "Toxiproxy Jitter Injection", href: "#toxiproxy" },
  { label: "Redis Partition Simulation", href: "#redis-partition" },
  { label: "k6 Resilience Assertions", href: "#k6-resilience" },
];

const chaosCycleDiagram = `
flowchart LR
    Load["1. Start k6 load test\\n(Constant 2000 RPS)"]
    Inject["2. Inject Redis Fault\\n(Toxiproxy disconnects)"]
    Observe["3. Verify Sidecar response\\n(Reverts to Fail-Open / 200 OK)"]
    Recover["4. Heal Redis connection\\n(Toxiproxy recovers)"]
    Verify["5. Check audit logs\\n(No duplicate transactions)"]

    Load --> Inject --> Observe --> Recover --> Verify

    style Load fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style Inject fill:#ec4899,stroke:#fff,color:#fff
    style Observe fill:#1e1e2e,stroke:#c084fc,color:#fff
    style Recover fill:#1e1e2e,stroke:#c084fc,color:#fff
    style Verify fill:#1e1e2e,stroke:#c084fc,color:#fff
`;

export default function RLChaosTestingPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="chaos-cycle">
              Chaos Engineering &amp; Testing
            </h1>

            <div className="guide-body-text" style={{ marginTop: 24 }}>
              <p>
                To guarantee high availability and fail-soft behavior, my automated testing suite goes beyond basic unit tests to simulate networking partitions, high-latency storage links, database crashes, and transaction replays.
              </p>

              <h2 className="guide-sub-heading" id="cycle" style={{ fontSize: 20, color: "#ffffff", marginTop: 28, marginBottom: 12 }}>
                Resilience Verification Cycle
              </h2>
              <p>
                The automated chaos test harness verifies system stability through the following loop:
              </p>
              <DocsMermaid chart={chaosCycleDiagram} />

              {/* Section 1 */}
              <h2 className="guide-sub-heading" id="lua-testing" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                1. Lua Unit Testing (Mock Engine)
              </h2>
              <p>
                Because rate limit decisions reside inside Lua scripts, I test the script logic in isolation using mock Redis databases. This lets us verify boundary refill math and speculative locks without spinning up full containers:
              </p>
              <div style={{ background: "#0f0f12", border: "1px solid #27272a", borderRadius: 8, padding: "16px 20px", marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#71717a", marginBottom: 10, textTransform: "uppercase" }}>
                  internal/limiter/lua_test.go
                </div>
                <GoCodeBlock>{`package limiter_test

import (
    "context"
    "testing"
    "time"

    "github.com/alicebob/miniredis/v2"
    "github.com/redis/go-redis/v9"
    "github.com/stretchr/testingify/assert"
)

func TestHierarchicalLuaScript_SpeculativeRead(t *testing.T) {
    s := miniredis.RunT(t)
    defer s.Close()

    rdb := redis.NewClient(&redis.Options{Addr: s.Addr()})
    ctx := context.Background()

    // Load hierarchical Lua script into miniredis
    sha, err := rdb.ScriptLoad(ctx, loadLuaScriptText()).Result()
    assert.NoError(t, err)

    // Setup keys: global capacity=10, tenant capacity=5
    keys := []string{"rate:global", "rate:tenant"}
    args := []interface{}{
        10, 5,       // capacities
        1, 1,        // refill rates (1 token/sec)
        time.Now().Unix(),
        2,           // level count
    }

    // Call 1: consume token
    res, err := rdb.EvalSha(ctx, sha, keys, args...).Int64Slice()
    assert.NoError(t, err)
    assert.Equal(t, int64(1), res[0]) // allowed
    assert.Equal(t, int64(4), res[1]) // remaining (min across levels)
}`}</GoCodeBlock>
              </div>

              {/* Section 2 */}
              <h2 className="guide-sub-heading" id="toxiproxy" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                2. Toxiproxy Jitter &amp; Latency Injection
              </h2>
              <p>
                I inject latency and TCP packet loss between the Central Limiter and Redis using Shopify's <strong>Toxiproxy</strong>. This ensures that the limiter's internal circuit breaker triggers when communication degrades:
              </p>
              <div style={{ background: "#0f0f12", border: "1px solid #27272a", borderRadius: 8, padding: "16px 20px", marginBottom: 20 }}>
                <GoCodeBlock>{`# Add a toxic latency of 250ms with 5% jitter to the Redis socket connection
curl -X POST http://toxiproxy:8474/proxies/redis/toxics \\
  -d '{
    "type": "latency",
    "name": "redis_lag",
    "stream": "upstream",
    "toxicity": 1.0,
    "attributes": {"latency": 250, "jitter": 50}
  }'

# Run benchmark: verify sidecar metrics show circuit breaker transitions
# from CLOSED to HALF-OPEN to OPEN.`}</GoCodeBlock>
              </div>

              {/* Section 3 */}
              <h2 className="guide-sub-heading" id="redis-partition" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                3. Redis Master-Replica Partition
              </h2>
              <p>
                During Sentinel failovers, I verify that the client handles master switchovers. The chaos suite tests this by blocking communication between the master node and sentinels:
              </p>
              <div style={{ background: "#0f0f12", border: "1px solid #27272a", borderRadius: 8, padding: "16px 20px", marginBottom: 20 }}>
                <GoCodeBlock>{`# Simulate network partition using iptables on the redis-master container
docker exec -it redis-master iptables -A INPUT -p tcp --dport 6379 -j DROP

# Check Sentinel logs: confirms failover election begins within 5s
docker-compose -f docker-compose.ha.yml logs sentinel-1`}</GoCodeBlock>
              </div>

              {/* Section 4 */}
              <h2 className="guide-sub-heading" id="k6-resilience" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                4. k6 Resilience Assertions
              </h2>
              <p>
                My k6 scripts include failure threshold assertions. During network partitions, if <code>IDEMPOTENCY_FAIL_OPEN=true</code> is set, k6 verifies that requests still return 200 OK (bypass) rather than failing:
              </p>
              <div style={{ background: "#0f0f12", border: "1px solid #27272a", borderRadius: 8, padding: "16px 20px", marginBottom: 20 }}>
                <GoCodeBlock>{`export const options = {
  thresholds: {
    // During chaos trials, error rate must remain under 1%
    // because the sidecar proxy must fail-open to the upstream.
    http_req_failed: ['rate<0.01'],
  },
};`}</GoCodeBlock>
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

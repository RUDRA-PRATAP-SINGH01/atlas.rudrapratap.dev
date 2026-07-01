import DocsNavbar from "@/components/docs/DocsNavbar";
import DocsSidebar from "@/components/docs/DocsSidebar";
import DocsMermaid from "@/components/docs/DocsMermaid";
import GoCodeBlock from "@/components/docs/GoCodeBlock";

const pageTopics = [
  { label: "Single Redis as SPOF", href: "#spof" },
  { label: "Sentinel Architecture", href: "#sentinel" },
  { label: "Failover Election", href: "#failover" },
  { label: "UniversalClient Factory", href: "#universal-client" },
  { label: "Connection Pool Tuning", href: "#pool-tuning" },
  { label: "Replication Lag Risk", href: "#replication-lag" },
  { label: "Chaos Testing", href: "#chaos" },
  { label: "docker-compose.ha.yml Walkthrough", href: "#compose-ha" },
];

const sentinelClusterDiagram = `
flowchart TD
    subgraph Sentinels["Sentinel Layer (Quorum = 2)"]
        S1["Sentinel 1\\n:26379\\nMonitors master"]
        S2["Sentinel 2\\n:26380\\nMonitors master"]
        S3["Sentinel 3\\n:26381\\nMonitors master"]
    end
    
    subgraph DataLayer["Redis Data Layer"]
        M["Redis Master\\n:6379\\n(Accepts writes)"]
        R1["Replica 1\\n:6380\\n(Read-only)"]
        R2["Replica 2\\n:6381\\n(Read-only)"]
    end
    
    GoClient["go-redis\\nFailoverClient\\n(UniversalClient)"]
    
    S1 & S2 & S3 -->|"PING / INFO replication"| M
    M -->|"async replication"| R1
    M -->|"async replication"| R2
    GoClient -->|"1. SENTINEL get-master-addr-by-name"| S1
    GoClient -->|"2. writes → discovered master"| M
    GoClient -.->|"reads (optional, replica=true)"| R1

    style M fill:#1e1e2e,stroke:#ec4899,color:#fff
    style GoClient fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style S1 fill:#18181b,stroke:#c084fc,color:#fff
    style S2 fill:#18181b,stroke:#c084fc,color:#fff
    style S3 fill:#18181b,stroke:#c084fc,color:#fff
    style R1 fill:#18181b,stroke:#c084fc,color:#fff
    style R2 fill:#18181b,stroke:#c084fc,color:#fff
`;

const failoverDiagram = `
sequenceDiagram
    participant M as Redis Master
    participant R1 as Replica 1
    participant S1 as Sentinel 1
    participant S2 as Sentinel 2
    participant S3 as Sentinel 3
    participant GC as go-redis Client

    Note over M,GC: Normal operation
    GC->>M: SET rate:user:alice tokens 500

    Note over M: Master fails (crash / network partition)
    M--xS1: PING timeout
    M--xS2: PING timeout
    M--xS3: PING timeout

    Note over S1,S3: Sentinels detect SDOWN (subjective down)
    S1->>S2: Is master SDOWN for you?
    S2-->>S1: Yes
    S1->>S3: Is master SDOWN for you?
    S3-->>S1: Yes
    Note over S1: Quorum reached → ODOWN (objective down)

    Note over S1,S3: Sentinel leader election (Raft-like)
    S1->>S2: Vote request epoch=42
    S2-->>S1: Vote granted
    S1->>S3: Vote request epoch=42
    S3-->>S1: Vote granted
    Note over S1: S1 elected as failover leader

    S1->>R1: SLAVEOF NO ONE (promote to master)
    R1-->>S1: OK — now master
    S1->>S2: Update config: new master=R1
    S1->>S3: Update config: new master=R1

    Note over GC: go-redis detects topology change via Pub/Sub
    GC->>S1: SENTINEL get-master-addr-by-name mymaster
    S1-->>GC: R1:6380
    GC->>R1: SET rate:user:alice tokens 500 (writes resume)
`;

export default function RLRedisHaPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="spof">
              Redis &amp; Sentinel High Availability
            </h1>

            <div className="guide-body-text" style={{ marginTop: 24 }}>

              {/* Single Redis as SPOF */}
              <h2 className="guide-sub-heading" id="spof" style={{ fontSize: 22, color: "#ffffff", marginTop: 0, marginBottom: 12 }}>
                Single Redis as a Single Point of Failure
              </h2>
              <p>
                The rate limiter's correctness depends entirely on Redis. Every quota check, idempotency claim, circuit breaker state transition, and audit log entry is a Redis operation. A Redis restart or crash has immediate, visible consequences:
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginTop: 16, marginBottom: 24 }}>
                {[
                  { icon: "", title: "Quota State Lost", body: "Token bucket HASH keys are in-memory by default. A restart wipes all buckets — all users start with full quota simultaneously, creating an accidental request surge (thundering herd).", color: "#ec4899" },
                  { icon: "", title: "Idempotency Keys Gone", body: "All PROCESSING records are lost. In-flight requests become orphans — the upstream may have already executed, but the sidecar can no longer detect it as a duplicate on retry.", color: "#c084fc" },
                  { icon: "", title: "Audit Trail Gap", body: "The async audit worker pool drains from Redis lists. Any buffered, unprocessed audit events not yet written to disk are permanently lost.", color: "#a78bfa" },
                ].map(item => (
                  <div key={item.title} style={{ background: "#111113", border: `1px solid ${item.color}33`, borderRadius: 8, padding: "16px 18px" }}>
                    <div style={{ fontSize: 22, marginBottom: 6 }}>{item.icon}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: item.color, marginBottom: 6 }}>{item.title}</div>
                    <div style={{ fontSize: 12.5, color: "#a1a1aa", lineHeight: 1.6 }}>{item.body}</div>
                  </div>
                ))}
              </div>
              <p>
                The <strong style={{ color: "#ff5cad" }}>availability math</strong>: A single Redis node typically achieves ~99.9% availability (planned maintenance, unplanned crashes). At 99.9% uptime, that's ~8.7 hours of downtime per year. For a payment API, this is unacceptable. Redis Sentinel HA pushes availability to ~99.99% by automating failover within 10–30 seconds.
              </p>

              {/* Sentinel Architecture */}
              <h2 className="guide-sub-heading" id="sentinel" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                Redis Sentinel Architecture
              </h2>
              <p>
                Redis Sentinel is a separate process (not part of the Redis server) that provides monitoring, automatic failover, and configuration provider services. This system runs 3 Sentinel nodes — the minimum required for a quorum of 2:
              </p>

              <DocsMermaid chart={sentinelClusterDiagram} />

              <div style={{ overflowX: "auto", marginTop: 20, marginBottom: 28 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #27272a" }}>
                      {["Sentinel Role", "What It Does", "Key Command"].map(h => (
                        <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "#ff5cad", fontWeight: 600, fontSize: 12 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["Monitor", "Continuously pings the master at sentinel-monitor interval (default 1s). Tracks response times and marks unreachable nodes as SDOWN.", "PING / INFO replication"],
                      ["Configuration Provider", "Acts as the authority for client connections. Clients ask sentinels for the current master address on startup and after failures.", "SENTINEL get-master-addr-by-name"],
                      ["Notification", "Publishes topology change events on the __sentinel__:hello Pub/Sub channel. go-redis subscribes to this to detect failovers without polling.", "PUBLISH __sentinel__:hello"],
                      ["Failover Orchestrator", "When quorum is reached on ODOWN, one sentinel is elected leader (Raft-style) and coordinates the promotion of a replica to master.", "SLAVEOF NO ONE + REPLICAOF"],
                    ].map(([role, what, cmd], i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #18181b", background: i % 2 === 0 ? "#0b0b0b" : "#0f0f12" }}>
                        <td style={{ padding: "8px 12px", color: "#c084fc", fontWeight: 600 }}>{role}</td>
                        <td style={{ padding: "8px 12px", color: "#a1a1aa" }}>{what}</td>
                        <td style={{ padding: "8px 12px", color: "#c084fc", fontFamily: "monospace", fontSize: 11 }}>{cmd}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Failover Election */}
              <h2 className="guide-sub-heading" id="failover" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                Failover Election Lifecycle
              </h2>
              <p>
                The following sequence shows what happens from the moment the master becomes unreachable to when Go client writes resume on the promoted replica:
              </p>
              <DocsMermaid chart={failoverDiagram} />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 20, marginBottom: 28 }}>
                {[
                  { title: "SDOWN (Subjective Down)", color: "#c084fc", body: "A single Sentinel marks the master as subjectively down after down-after-milliseconds (default 30s) without a PONG response. This is a local judgment only." },
                  { title: "ODOWN (Objective Down)", color: "#ec4899", body: "When quorum (≥ 2) sentinels independently agree the master is SDOWN, the state is upgraded to ODOWN — objective, consensus-based failure detection." },
                  { title: "Leader Election", color: "#a78bfa", body: "Sentinels elect a failover leader using a Raft-like protocol. The leader with the highest epoch wins the vote. Only the leader executes the promotion." },
                  { title: "Replica Promotion", color: "#c084fc", body: "The elected leader sends SLAVEOF NO ONE to the best-ranked replica (lowest replication offset lag). The replica becomes the new master." },
                ].map(item => (
                  <div key={item.title} style={{ background: "#111113", border: `1px solid ${item.color}33`, borderRadius: 8, padding: "14px 16px" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: item.color, marginBottom: 6 }}>{item.title}</div>
                    <div style={{ fontSize: 12.5, color: "#a1a1aa", lineHeight: 1.6 }}>{item.body}</div>
                  </div>
                ))}
              </div>

              {/* UniversalClient Factory */}
              <h2 className="guide-sub-heading" id="universal-client" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                <code style={{ color: "#ff5cad", fontSize: 18 }}>NewUniversalClient()</code> — Mode-Aware Factory
              </h2>
              <p>
                The Go client factory inspects the <code>REDIS_MODE</code> environment variable and constructs either a simple client (standalone) or a FailoverClient (sentinel). This means the application code is completely unaware of the Redis topology — all it sees is a <code>redis.UniversalClient</code> interface:
              </p>
              <div style={{ background: "#0f0f12", border: "1px solid #27272a", borderRadius: 8, padding: "16px 20px", marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#71717a", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  internal/redis/client.go
                </div>
                <GoCodeBlock>{`package redisclient

import (
    "fmt"
    "os"
    "strconv"
    "strings"
    "time"

    "github.com/redis/go-redis/v9"
)

// NewUniversalClient creates a Redis client appropriate for the deployment mode.
// REDIS_MODE=sentinel uses go-redis FailoverClient with automatic master discovery.
// REDIS_MODE=standalone (default) uses a plain Client with direct connection.
func NewUniversalClient() redis.UniversalClient {
    mode := strings.ToLower(os.Getenv("REDIS_MODE"))

    poolSize, _ := strconv.Atoi(os.Getenv("REDIS_POOL_SIZE"))
    if poolSize == 0 {
        poolSize = 20 // 20 connections per limiter instance
    }

    switch mode {
    case "sentinel":
        sentinelAddrs := strings.Split(
            os.Getenv("REDIS_SENTINEL_ADDRS"),
            ",",
        ) // e.g. "sentinel1:26379,sentinel2:26380,sentinel3:26381"

        return redis.NewFailoverClient(&redis.FailoverOptions{
            MasterName:       getEnvOrDefault("REDIS_SENTINEL_MASTER", "mymaster"),
            SentinelAddrs:    sentinelAddrs,
            SentinelPassword: os.Getenv("REDIS_SENTINEL_PASSWORD"),
            Password:         os.Getenv("REDIS_PASSWORD"),
            DB:               0,

            // Connection pool settings
            PoolSize:        poolSize,
            MinIdleConns:    5,
            MaxIdleConns:    10,

            // Timeout settings
            DialTimeout:  5 * time.Second,
            ReadTimeout:  3 * time.Second,
            WriteTimeout: 3 * time.Second,

            // Retry on connection errors (not command errors)
            MaxRetries:      3,
            MinRetryBackoff: 8 * time.Millisecond,
            MaxRetryBackoff: 512 * time.Millisecond,
        })

    default: // "standalone"
        return redis.NewClient(&redis.Options{
            Addr:         getEnvOrDefault("REDIS_ADDR", "localhost:6379"),
            Password:     os.Getenv("REDIS_PASSWORD"),
            DB:           0,
            PoolSize:     poolSize,
            DialTimeout:  5 * time.Second,
            ReadTimeout:  3 * time.Second,
            WriteTimeout: 3 * time.Second,
            MaxRetries:   3,
        })
    }
}

func getEnvOrDefault(key, defaultVal string) string {
    if v := os.Getenv(key); v != "" {
        return v
    }
    return defaultVal
}`}</GoCodeBlock>
              </div>

              {/* Connection Pool Tuning */}
              <h2 className="guide-sub-heading" id="pool-tuning" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                Connection Pool Tuning
              </h2>
              <p>
                Redis uses a single-threaded event loop. Too many concurrent connections cause kernel context-switch overhead; too few cause request queueing at the Go layer. The following table explains each parameter and its recommended setting for this system:
              </p>
              <div style={{ overflowX: "auto", marginBottom: 28 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #27272a" }}>
                      {["Parameter", "Default", "Recommendation", "Rationale"].map(h => (
                        <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "#ff5cad", fontWeight: 600, fontSize: 12 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["PoolSize", "10 × GOMAXPROCS", "20–50 per instance", "Match to expected concurrency per limiter pod. Higher = less queueing under burst; lower = less memory at idle."],
                      ["MinIdleConns", "0", "5", "Pre-warm connections on startup. Avoids cold-path latency spike on the first requests after a deploy."],
                      ["DialTimeout", "5s", "3s", "Aggressive timeout detects Sentinel failover faster. The circuit breaker will handle sustained failures."],
                      ["ReadTimeout", "3s", "1s (hot path)", "Lua scripts should complete in < 1ms. A 1s read timeout catches stuck Redis operations without hanging goroutines."],
                      ["MaxRetries", "3", "3", "Retry transient connection errors (EOF, broken pipe). Do NOT retry command errors — that's the circuit breaker's job."],
                      ["MaxRetryBackoff", "512ms", "256ms", "Reduce max backoff to fail faster to the circuit breaker during a sustained Redis outage."],
                    ].map(([param, def, rec, rationale], i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #18181b", background: i % 2 === 0 ? "#0b0b0b" : "#0f0f12" }}>
                        <td style={{ padding: "8px 12px", color: "#c084fc", fontFamily: "monospace", fontSize: 11 }}>{param}</td>
                        <td style={{ padding: "8px 12px", color: "#a1a1aa", fontFamily: "monospace" }}>{def}</td>
                        <td style={{ padding: "8px 12px", color: "#c084fc", fontFamily: "monospace" }}>{rec}</td>
                        <td style={{ padding: "8px 12px", color: "#71717a", lineHeight: 1.5 }}>{rationale}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Replication Lag Risk */}
              <h2 className="guide-sub-heading" id="replication-lag" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                Replication Lag &amp; Stale Read Risk
              </h2>
              <p>
                Redis replication is <strong>asynchronous</strong>. The master acknowledges a write before the replica applies it. This creates a short replication lag (typically &lt; 1ms on LAN, up to tens of ms on congested networks).
              </p>
              <div style={{
                background: "rgba(219, 39, 119,0.06)", border: "1px solid rgba(219, 39, 119,0.2)",
                borderRadius: 8, padding: "14px 18px", fontSize: 13, lineHeight: 1.65, marginBottom: 20, marginTop: 16
              }}>
                <strong style={{ color: "#ec4899" }}>Warning: Critical Design Decision:</strong> All rate-limit quota checks (EVALSHA on token buckets and sliding windows) MUST go to the <em>master</em> node only. Reading from a replica risks returning a stale token count — a user who has consumed all their tokens might receive an "allowed" response from a lagging replica, resulting in over-limit requests being served.
              </div>
              <p>
                The <code>go-redis</code> FailoverClient routes all commands to the master by default. Reading from replicas is opt-in via <code>RouteRandomly: true</code> or <code>RouteByLatency: true</code>. This system does NOT enable replica reads for any rate-limiting data path.
              </p>

              {/* Chaos Testing */}
              <h2 className="guide-sub-heading" id="chaos" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                Chaos Testing
              </h2>
              <p>
                The <code>chaos/</code> directory contains scripts for injecting Redis failures and verifying that the system recovers correctly. These should be run against the HA stack (<code>docker-compose.ha.yml</code>):
              </p>
              <div style={{ background: "#0f0f12", border: "1px solid #27272a", borderRadius: 8, padding: "16px 20px", marginBottom: 20 }}>
                <GoCodeBlock>{`# Start the HA stack
docker-compose -f docker-compose.ha.yml up -d

# Test 1: Kill the Redis master — watch Sentinel promote a replica
docker-compose -f docker-compose.ha.yml stop redis-master
# Monitor: watch the logs for "FailoverStarted" and "MasterChanged" events
docker-compose -f docker-compose.ha.yml logs -f sentinel-1

# Test 2: Verify write resumption after failover (typically 10-30s)
watch -n1 'curl -s http://localhost:9090/health | jq .redis_connected'

# Test 3: Restore the old master (now joins as replica)
docker-compose -f docker-compose.ha.yml start redis-master

# Test 4: Kill 2 of 3 sentinels — no quorum, failover should NOT trigger
docker-compose -f docker-compose.ha.yml stop sentinel-1 sentinel-2
# At this point: master failure would NOT trigger failover (quorum unavailable)
# This is correct — split-brain protection.`}</GoCodeBlock>
              </div>

              {/* docker-compose.ha.yml Walkthrough */}
              <h2 className="guide-sub-heading" id="compose-ha" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                <code style={{ color: "#ff5cad", fontSize: 18 }}>docker-compose.ha.yml</code> Walkthrough
              </h2>
              <div style={{ background: "#0f0f12", border: "1px solid #27272a", borderRadius: 8, padding: "16px 20px", marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#71717a", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  docker-compose.ha.yml — Key Configuration Blocks
                </div>
                <GoCodeBlock>{`services:
  # ── Redis Master ──────────────────────────────────────────
  redis-master:
    image: redis:7-alpine
    command: >
      redis-server
        --save 60 1           # RDB persistence: snapshot every 60s if ≥1 change
        --appendonly yes      # AOF: log every write for crash safety
        --appendfsync everysec # Fsync once/sec (balance durability vs throughput)
        --requirepass ${REDIS_PASSWORD}

  # ── Redis Replicas ─────────────────────────────────────────
  redis-replica-1:
    image: redis:7-alpine
    command: >
      redis-server
        --slaveof redis-master 6379
        --masterauth ${REDIS_PASSWORD}
        --requirepass ${REDIS_PASSWORD}
        --replica-read-only yes

  # ── Sentinel 1 ─────────────────────────────────────────────
  sentinel-1:
    image: redis:7-alpine
    command: >
      redis-sentinel /etc/redis/sentinel.conf
    volumes:
      - ./config/sentinel.conf:/etc/redis/sentinel.conf
    # sentinel.conf content:
    # sentinel monitor mymaster redis-master 6379 2
    # sentinel down-after-milliseconds mymaster 5000
    # sentinel failover-timeout mymaster 60000
    # sentinel parallel-syncs mymaster 1

  # ── Rate Limiter (Sentinel-aware) ──────────────────────────
  limiter:
    environment:
      REDIS_MODE: sentinel
      REDIS_SENTINEL_ADDRS: "sentinel-1:26379,sentinel-2:26380,sentinel-3:26381"
      REDIS_SENTINEL_MASTER: mymaster
      REDIS_PASSWORD: ${REDIS_PASSWORD}
      REDIS_POOL_SIZE: "20"`}</GoCodeBlock>
              </div>

              <div style={{
                background: "rgba(192, 132, 252,0.05)", border: "1px solid rgba(192, 132, 252,0.2)",
                borderRadius: 8, padding: "14px 18px", fontSize: 13, lineHeight: 1.65
              }}>
                <strong style={{ color: "#c084fc" }}>Production Recommendation:</strong> Enable both RDB (<code>--save 60 1</code>) and AOF (<code>--appendonly yes</code>) persistence on the master. RDB provides fast restart snapshots; AOF ensures at-most-1-second data loss. Without persistence, a master restart wipes all rate-limit state, causing a thundering herd on startup. Set <code>--appendfsync everysec</code> (not <code>always</code>) for a good durability/throughput trade-off.
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

import DocsNavbar from "@/components/docs/DocsNavbar";
import DocsSidebar from "@/components/docs/DocsSidebar";
import DocsMermaid from "@/components/docs/DocsMermaid";
import GoCodeBlock from "@/components/docs/GoCodeBlock";

const pageTopics = [
  { label: "High Availability Overview", href: "#overview" },
  { label: "Sentinel Topology", href: "#topology" },
  { label: "Go Universal Client Setup", href: "#client-config" },
  { label: "Master Election & Reconnects", href: "#failover" },
  { label: "HA Docker Compose Setup", href: "#compose" },
];

const sentinelTopologyDiagram = `
flowchart TD
    subgraph SentinelCluster["Sentinel Node Cluster (3 Nodes)"]
        S1["Sentinel 1\\n(:26379)"]
        S2["Sentinel 2\\n(:26379)"]
        S3["Sentinel 3\\n(:26379)"]
    end
    
    subgraph RedisNodes["Redis State Storage Nodes"]
        Master["Redis Master\\n(:6379, R/W)"]
        Replica1["Redis Replica 1\\n(:6379, Read-Only)"]
        Replica2["Redis Replica 2\\n(:6379, Read-Only)"]
    end

    Limiter["🧠 Central Limiter / Sidecar"]

    %% Monitoring
    S1 -.->|"Monitors"| Master
    S2 -.->|"Monitors"| Master
    S3 -.->|"Monitors"| Master
    
    %% Replication
    Master ==>|"Async Replication"| Replica1
    Master ==>|"Async Replication"| Replica2
    
    %% Client Queries
    Limiter -->|"1. Query current master"| S1
    S1 --"2. returns Master IP"--> Limiter
    Limiter ==>|"3. Hot-path R/W commands"| Master
    
    style Master fill:#1e1e2e,stroke:#f43f5e,color:#fff
    style Replica1 fill:#1e1e2e,stroke:#a1a1aa,color:#fff
    style Replica2 fill:#1e1e2e,stroke:#a1a1aa,color:#fff
    style Limiter fill:#1e1e2e,stroke:#ff5cad,color:#fff
`;

export default function RLRedisHaPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="overview">
              Redis &amp; Sentinel HA Architecture
            </h1>

            <div className="guide-body-text" style={{ marginTop: 24 }}>
              
              {/* Overview */}
              <p>
                In a distributed rate limiting system, the state storage is the central bottleneck. If the rate limiter backend is unavailable, the gateway cannot verify quotas. High Availability (HA) of the Redis cluster is a strict requirement for production deployments.
              </p>
              <p style={{ marginTop: 12 }}>
                The system supports two deployment modes configured via environment variables: <strong>Standalone</strong> (for local testing) and <strong>Redis Sentinel</strong> (for production failover).
              </p>

              {/* Sentinel Topology */}
              <h2 className="guide-sub-heading" id="topology" style={{ fontSize: 22, color: "#ffffff", marginTop: 36, marginBottom: 12 }}>
                Sentinel Cluster Topology
              </h2>
              <p>
                A standard high-availability setup consists of 1 Redis Master, 2 Redis Replicas, and a quorum of 3 Redis Sentinels. Sentinels run as separate processes that constantly monitor the health of the Master and Replica nodes.
              </p>

              <DocsMermaid chart={sentinelTopologyDiagram} />

              <p style={{ marginTop: 12 }}>
                When the Master node fails, the Sentinels form a consensus to promote one of the Read-Only Replicas to Master. The client driver automatically coordinates with the Sentinels to discover the new Master and redirect traffic.
              </p>

              {/* Universal Client Configuration */}
              <h2 className="guide-sub-heading" id="client-config" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                Go Connection Factory Setup
              </h2>
              <p>
                The Go services use <code>go-redis/v9</code>. To make client instantiation seamless regardless of the deployment configuration, the client uses `redis.UniversalClient`. This interface acts as an abstraction layer over standalone, cluster, or sentinel client options:
              </p>

              <div style={{ background: "#0f0f12", border: "1px solid #27272a", borderRadius: 8, padding: "16px 20px", marginBottom: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#71717a", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  internal/redis/client.go
                </div>
                <GoCodeBlock>{`package redis

import (
	"context"
	"strings"
	"time"
	"github.com/redis/go-redis/v9"
)

type Config struct {
	Mode           string   // "standalone" or "sentinel"
	Addresses      []string // Standalone: ["host:6379"], Sentinel: ["s1:26379","s2:26379"]
	MasterName     string   // Only used in sentinel mode (e.g. "mymaster")
	Password       string
	PoolSize       int
	ConnectTimeout time.Duration
}

func NewUniversalClient(cfg *Config) (redis.UniversalClient, error) {
	var opts redis.UniversalOptions
	opts.Addrs = cfg.Addresses
	opts.Password = cfg.Password
	opts.PoolSize = cfg.PoolSize
	opts.DialTimeout = cfg.ConnectTimeout
	
	if strings.ToLower(cfg.Mode) == "sentinel" {
		opts.MasterName = cfg.MasterName
		// Connection options for redis client to use Sentinel master discovery
	}

	client := redis.NewUniversalClient(&opts)

	// Validate connectivity
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	
	if err := client.Ping(ctx).Err(); err != nil {
		return nil, err
	}
	
	return client, nil
}`}</GoCodeBlock>
              </div>

              {/* Master Election & Failover Reconnections */}
              <h2 className="guide-sub-heading" id="failover" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                Master Election &amp; Reconnection Protocol
              </h2>
              <p>
                When a Master fails, the following failover protocol runs automatically:
              </p>
              <ul className="guide-bullets-list" style={{ marginTop: 12, marginBottom: 20 }}>
                <li><strong>Subjective Down (SDOWN):</strong> An individual Sentinel loses connection to the Master for the configured threshold (e.g. 3 seconds) and flags it down.</li>
                <li><strong>Objective Down (ODOWN):</strong> When a majority of Sentinels (quorum of 2 out of 3) flag the master as SDOWN, they agree it is objectively down.</li>
                <li><strong>Failover Election:</strong> The Sentinels select a leader node, which promotes the healthiest replica node to the Master role. The other replica is updated to point to the new Master.</li>
                <li><strong>Client Reconnection:</strong> The <code>go-redis</code> FailoverClient listens to pub/sub notifications from Sentinels. Upon receiving a master modification broadcast, it closes connections to the old IP and opens new connections to the promoted Master instantly. In-flight calls during the ~2-5s election window fail, but are mitigated by sidecar retries or circuit breakers.</li>
              </ul>

              {/* Docker Sentinel HA Compose Layout */}
              <h2 className="guide-sub-heading" id="compose" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                Docker HA Deployment Blueprint
              </h2>
              <p>
                For local HA validation, the system includes <code>deploy/docker-compose.ha.yml</code>, creating the multi-node infrastructure. Below is the configuration structure:
              </p>

              <div style={{ background: "#0f0f12", border: "1px solid #27272a", borderRadius: 8, padding: "16px 20px", marginBottom: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#71717a", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  deploy/docker-compose.ha.yml (simplified)
                </div>
                <GoCodeBlock>{`version: '3.8'
services:
  redis-master:
    image: redis:7-alpine
    command: redis-server --protected-mode no
    ports:
      - "6379:6379"

  redis-replica-1:
    image: redis:7-alpine
    command: redis-server --replicaof redis-master 6379 --protected-mode no
    depends_on:
      - redis-master

  redis-replica-2:
    image: redis:7-alpine
    command: redis-server --replicaof redis-master 6379 --protected-mode no
    depends_on:
      - redis-master

  sentinel-1:
    image: redis:7-alpine
    command: >
      redis-sentinel /etc/redis/sentinel.conf
      --sentinel monitor mymaster redis-master 6379 2
      --sentinel down-after-milliseconds mymaster 3000
      --sentinel failover-timeout mymaster 6000
    depends_on:
      - redis-master
      - redis-replica-1
      - redis-replica-2`}</GoCodeBlock>
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

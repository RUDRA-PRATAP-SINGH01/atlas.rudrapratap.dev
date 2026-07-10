import React from "react";
import DocsMermaid from "@/features/docs/components/DocsMermaid";

export const productionPages = {
  "deployment-topology": {
    title: "Deployment Topology",
    topics: [
      { label: "Container Layout & Networking", href: "#layout" },
      { label: "VPC & Edge Port Allocations", href: "#ports" },
      { label: "Docker Compose Configuration", href: "#compose" }
    ],
    content: (
      <div>
        <p>
          Deploying the Distributed Rate Limiter in a production-grade microservices architecture requires separating the stateless inspection pool from the stateful database layer. The sidecar proxy acts as a transparent network interception boundary.
        </p>

        <h2 className="guide-sub-heading" id="layout">Container Layout & Networking</h2>
        <p>
          In a standard multi-region deployment, each service host runs an application container alongside a local sidecar proxy instance. The sidecar handles all inbound and outbound traffic, offloading routing, rate limits, and idempotency checks from the core application.
        </p>
        <DocsMermaid chart={`
graph TD
    Client[Edge Load Balancer] -->|HTTP / gRPC| Sidecar1[Sidecar Proxy 1]
    Client -->|HTTP / gRPC| Sidecar2[Sidecar Proxy 2]
    
    subgraph Host1 [Application Host 1]
        Sidecar1 -->|localhost:8081| App1[App Instance 1]
        Sidecar1 -->|localhost:8080| Limiter1[Limiter Client]
    end

    subgraph Host2 [Application Host 2]
        Sidecar2 -->|localhost:8081| App2[App Instance 2]
        Sidecar2 -->|localhost:8080| Limiter2[Limiter Client]
    end

    Limiter1 -->|TCP Pool| RedisMaster[Redis Active Master]
    Limiter2 -->|TCP Pool| RedisMaster
    RedisMaster -.->|Replication| RedisReplica[Redis Replica]
        `} />

        <h2 className="guide-sub-heading" id="ports">VPC & Edge Port Allocations</h2>
        <p>
          To maintain strict network isolation, traffic is segmented into internal cluster zones and public egress interfaces. The following ports must be configured in your security group firewalls:
        </p>
        <div style={{ overflowX: "auto", margin: "20px 0" }}>
          <table className="guide-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #27272a", textAlign: "left" }}>
                <th style={{ padding: "12px 8px" }}>Port</th>
                <th style={{ padding: "12px 8px" }}>Service</th>
                <th style={{ padding: "12px 8px" }}>Protocol</th>
                <th style={{ padding: "12px 8px" }}>Network Scope</th>
                <th style={{ padding: "12px 8px" }}>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>9090</td>
                <td>Sidecar Proxy</td>
                <td>HTTP/1.1 & gRPC</td>
                <td>VPC Internal & Egress</td>
                <td>Intercepts ingress and forwards to local application.</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>8080</td>
                <td>Rate Limiter API</td>
                <td>HTTP/1.1</td>
                <td>Private Subnet Only</td>
                <td>Internal REST API serving `/check` and `/claim` routes.</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>8082</td>
                <td>Limiter Admin</td>
                <td>HTTP/1.1</td>
                <td>Admin Bastion Only</td>
                <td>Dynamic configurations, metrics, and rule overrides.</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>6379</td>
                <td>Redis Engine</td>
                <td>RESP (TCP)</td>
                <td>Database Private</td>
                <td>Direct Redis connection pool, isolated from public egress.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2 className="guide-sub-heading" id="compose">Docker Compose Configuration</h2>
        <p>
          Below is a production-hardened compose template defining the deployment topology. Note the CPU/Memory limits and the use of explicit health check configurations.
        </p>
        <pre style={{ background: "#0e0e11", border: "1px solid #27272a", padding: 14, borderRadius: 6, fontSize: 12, overflowX: "auto" }}>
{`version: '3.8'

services:
  redis-master:
    image: redis:7.2-alpine
    container_name: redis-master
    command: redis-server --appendonly yes --maxmemory 2gb --maxmemory-policy noeviction
    ports:
      - "6379:6379"
    deploy:
      resources:
        limits:
          cpus: '1.50'
          memory: 2048M
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  rate-limiter:
    build:
      context: .
      dockerfile: cmd/limiter/Dockerfile
    container_name: rate-limiter
    environment:
      - REDIS_ADDRS=redis-master:6379
      - LISTEN_PORT=8080
      - ADMIN_PORT=8082
      - LOG_LEVEL=json
    depends_on:
      redis-master:
        condition: service_healthy
    ports:
      - "8080:8080"
      - "8082:8082"
    deploy:
      resources:
        limits:
          cpus: '1.00'
          memory: 512M`}
        </pre>
      </div>
    )
  },

  "redis-and-sentinel-ha": {
    title: "Redis & Sentinel HA",
    topics: [
      { label: "Sentinel Consensus Setup", href: "#sentinel-consensus" },
      { label: "Client Failover Logic", href: "#client-failover" },
      { label: "Replication Guardrails", href: "#replication-guards" }
    ],
    content: (
      <div>
        <p>
          To avoid a Single Point of Failure (SPOF) at the state layer, the rate limiter uses a Redis Master-Replica topology coordinated by a Redis Sentinel quorum.
        </p>

        <h2 className="guide-sub-heading" id="sentinel-consensus">Sentinel Consensus Setup</h2>
        <p>
          Sentinel instances run as separate daemon processes, monitoring the master node's heartbeat. We configure a minimum cluster of three Sentinels with a quorum parameter of 2.
        </p>
        <p>
          If the master stops responding to ping queries for longer than `down-after-milliseconds` (e.g. 1000ms), the Sentinel detecting the outage flags it as *Subjectively Down* (SDOWN). Once a second Sentinel confirms the state, it transitions to *Objectively Down* (ODOWN), initiating leader promotion.
        </p>
        <pre style={{ background: "#0e0e11", border: "1px solid #27272a", padding: 14, borderRadius: 6, fontSize: 12, overflowX: "auto" }}>
{`# sentinel.conf
port 26379
sentinel monitor mymaster redis-master 6379 2
sentinel down-after-milliseconds mymaster 1000
sentinel failover-timeout mymaster 3000
sentinel parallel-syncs mymaster 1`}
        </pre>

        <h2 className="guide-sub-heading" id="client-failover">Client Failover Logic</h2>
        <p>
          The Go client does not connect directly to port `6379`. Instead, it initializes a Sentinel-aware connection pool:
        </p>
        <ol className="guide-bullets-list">
          <li>Queries the Sentinels to locate the active master: `GetMasterAddrByName("mymaster")`.</li>
          <li>Subscribes to Sentinel Pub/Sub channels (specifically `+switch-master`) to listen for failover events.</li>
          <li>When a failover triggers, the client blocks active writes, flushes the socket pool, and updates connection strings to target the new master address.</li>
        </ol>

        <h2 className="guide-sub-heading" id="replication-guards">Replication Guardrails</h2>
        <div style={{
          background: "rgba(239, 68, 68, 0.05)",
          border: "1px solid rgba(239, 68, 68, 0.2)",
          borderRadius: 8,
          padding: 16,
          marginTop: 16
        }}>
          <strong>Replication Lag Risk:</strong> Under high throughput, replication lag can allow a promoted replica to miss recent token deductions or idempotency lease records. To prevent over-admission, configure Redis with `min-replicas-to-write 1` and `min-replicas-max-lag 2`, forcing Redis to reject writes if replicas fall too far behind.
        </div>
      </div>
    )
  },

  "configuration-reference": {
    title: "Configuration Reference",
    topics: [
      { label: "Global Server Configuration", href: "#global-config" },
      { label: "Sidecar Middleware Parameters", href: "#sidecar-config" },
      { label: "Redis State Tuning", href: "#redis-config" }
    ],
    content: (
      <div>
        <p>
          The service is configured entirely using environment variables, facilitating seamless integration with Kubernetes ConfigMaps and container orchestrators.
        </p>

        <h2 className="guide-sub-heading" id="global-config">Global Server Configuration</h2>
        <p>
          These parameters control the stateless rate-limiter inspection daemon (`cmd/limiter`):
        </p>
        <div style={{ overflowX: "auto", margin: "20px 0" }}>
          <table className="guide-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #27272a", textAlign: "left" }}>
                <th style={{ padding: "12px 8px" }}>Variable</th>
                <th style={{ padding: "12px 8px" }}>Default</th>
                <th style={{ padding: "12px 8px" }}>Validation Bounds</th>
                <th style={{ padding: "12px 8px" }}>Purpose</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>`REDIS_ADDRS`</td>
                <td>`localhost:6379`</td>
                <td>Non-empty string</td>
                <td>Comma-separated list of Redis or Sentinel hosts.</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>`REDIS_MASTER_NAME`</td>
                <td>`mymaster`</td>
                <td>Alpha-numeric</td>
                <td>Required when Sentinel routing is active.</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>`LISTEN_PORT`</td>
                <td>`8080`</td>
                <td>`1024 - 65535`</td>
                <td>Port for the internal rate-checking REST interface.</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>`DEFAULT_ALGORITHM`</td>
                <td>`token_bucket`</td>
                <td>`token_bucket`, `sliding_window`</td>
                <td>Fallback algorithm when rules do not specify one.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2 className="guide-sub-heading" id="sidecar-config">Sidecar Middleware Parameters</h2>
        <p>
          These parameters control the proxy sidecar daemon (`cmd/sidecar`):
        </p>
        <div style={{ overflowX: "auto", margin: "20px 0" }}>
          <table className="guide-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #27272a", textAlign: "left" }}>
                <th style={{ padding: "12px 8px" }}>Variable</th>
                <th style={{ padding: "12px 8px" }}>Default</th>
                <th style={{ padding: "12px 8px" }}>Validation Bounds</th>
                <th style={{ padding: "12px 8px" }}>Purpose</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>`LIMITER_URL`</td>
                <td>`http://localhost:8080`</td>
                <td>Valid URI</td>
                <td>Target HTTP endpoint of the central limiter.</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>`DENIAL_CACHE_TTL_MS`</td>
                <td>`1000`</td>
                <td>`100 - 10000`</td>
                <td>Duration of the process-local in-memory block list.</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>`CIRCUIT_FAILURE_THRESHOLD`</td>
                <td>`0.5`</td>
                <td>`0.1 - 1.0`</td>
                <td>Error percentage threshold to open the circuit breaker.</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>`FAIL_OPEN_ON_DISCONNECT`</td>
                <td>`false`</td>
                <td>`true`, `false`</td>
                <td>Fail-open switch when the limiter or Redis is unavailable.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    )
  },

  "health-and-readiness": {
    title: "Health & Readiness",
    topics: [
      { label: "Liveness Check (/health)", href: "#health" },
      { label: "Readiness Check (/ready)", href: "#ready" },
      { label: "Go Probe Handler Code", href: "#go-probe-code" }
    ],
    content: (
      <div>
        <p>
          Health and readiness probes provide deployment health checks to load balancers, protecting the cluster from routing traffic to broken nodes.
        </p>

        <h2 className="guide-sub-heading" id="health">Liveness Check (`/health`)</h2>
        <p>
          Liveness checks evaluate process execution health. If the internal thread executor crashes or reaches a deadlock state, the endpoint fails to respond, triggering container restarts. The liveness check returns a lightweight `200 OK` without hitting external network connections.
        </p>

        <h2 className="guide-sub-heading" id="ready">Readiness Check (`/ready`)</h2>
        <p>
          Readiness checks verify downstream connectivity. The `/ready` endpoint queries active database connections:
        </p>
        <ul className="guide-bullets-list">
          <li>Performs a connection pool test and runs a quick `PING` command on Redis.</li>
          <li>Verifies that the Lua script engine can execute test transactions.</li>
          <li>If downstream connections are healthy, it returns `200 OK`. If they time out or fail, it returns `503 Service Unavailable`, prompting the load balancer to remove the node from active traffic rotation.</li>
        </ul>

        <h2 className="guide-sub-heading" id="go-probe-code">Go Probe Handler Code</h2>
        <p>
          Below is the Go code structure implementing the readiness probe handler:
        </p>
        <pre style={{ background: "#0e0e11", border: "1px solid #27272a", padding: 14, borderRadius: 6, fontSize: 12, overflowX: "auto" }}>
{`func (s *Server) HandleReadiness(w http.ResponseWriter, r *http.Request) {
    ctx, cancel := context.WithTimeout(r.Context(), 1000*time.Millisecond)
    defer cancel()

    // 1. Check Redis pool health
    err := s.redisClient.Ping(ctx).Err()
    if err != nil {
        s.logger.Error("readiness check failed: redis unreachable", "error", err)
        http.Error(w, "database unreachable", http.StatusServiceUnavailable)
        return
    }

    // 2. Respond healthy
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(http.StatusOK)
    w.Write([]byte(\`{"status":"ready","timestamp":\${time.Now().Unix()}\`}))
}`}
        </pre>
      </div>
    )
  },

  "graceful-shutdown": {
    title: "Graceful Shutdown",
    topics: [
      { label: "Graceful Draining Architecture", href: "#draining-arch" },
      { label: "Stateless Worker Code", href: "#worker-shutdown" }
    ],
    content: (
      <div>
        <p>
          Graceful shutdowns prevent in-flight connection drops during deployments, ensuring all active requests complete cleanly.
        </p>

        <h2 className="guide-sub-heading" id="draining-arch">Graceful Draining Architecture</h2>
        <p>
          Upon receiving a termination signal (`SIGTERM` or `SIGINT`), the system initiates a structured shutdown sequence:
        </p>
        <ol className="guide-bullets-list">
          <li>Closes the HTTP listener sockets immediately to block new incoming client connections.</li>
          <li>Keeps active HTTP connections open and sets a draining timeout limit (e.g. 15s) to allow them to complete.</li>
          <li>Drains the asynchronous audit trail queue, flushing all pending rate limiting event records to Redis.</li>
          <li>Flushes the OpenTelemetry trace collection buffer to the Jaeger collector.</li>
          <li>Closes connection pools and exits the process.</li>
        </ol>

        <h2 className="guide-sub-heading" id="worker-shutdown">Stateless Worker Code</h2>
        <p>
          This is the implementation of the graceful shutdown handler in the Go server:
        </p>
        <pre style={{ background: "#0e0e11", border: "1px solid #27272a", padding: 14, borderRadius: 6, fontSize: 12, overflowX: "auto" }}>
{`// Catch OS signal interrupt
quit := make(chan os.Signal, 1)
signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
<-quit

log.Info("Shutting down rate limiter server...")

// Create shutdown context with a grace period
ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
defer cancel()

// Close HTTP Server listeners first
if err := srv.Shutdown(ctx); err != nil {
    log.Error("Server forced to shutdown:", "error", err)
}

// Drain queue operations
auditQueue.DrainAndClose(ctx)
redisClient.Close()
log.Info("Graceful shutdown completed successfully.")`}
        </pre>
      </div>
    )
  },

  "security-model": {
    title: "Security Model",
    topics: [
      { label: "Authentication & Authorization Tiers", href: "#security-auth" },
      { label: "Trust Boundaries & Input Vectors", href: "#boundaries" },
      { label: "Header Protection Middleware", href: "#header-protection" }
    ],
    content: (
      <div>
        <p>
          Deploying rate limiters in microservice topologies requires enforcing strict authentication boundaries to prevent identity spoofing and unauthorized parameter updates.
        </p>

        <h2 className="guide-sub-heading" id="security-auth">Authentication & Authorization Tiers</h2>
        <p>
          The security model operates across three distinct privilege levels:
        </p>
        <div style={{ overflowX: "auto", margin: "20px 0" }}>
          <table className="guide-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #27272a", textAlign: "left" }}>
                <th style={{ padding: "12px 8px" }}>Privilege Tier</th>
                <th style={{ padding: "12px 8px" }}>Access Method</th>
                <th style={{ padding: "12px 8px" }}>Authentication Mechanism</th>
                <th style={{ padding: "12px 8px" }}>Threat Vector Protection</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Internal Proxy Path</td>
                <td>Local HTTP/gRPC</td>
                <td>VPC Private Network Routing</td>
                <td>No external ingress permitted; blocked by security groups.</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Admin Configurations</td>
                <td>Admin HTTP API (`:8082`)</td>
                <td>HMAC Auth / Private API Keys</td>
                <td>Prevents unauthorized override creation or generation updates.</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Client Authentication</td>
                <td>Request Headers</td>
                <td>Header signature checks</td>
                <td>Blocks spoofed `X-User-ID` parameters from public clients.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2 className="guide-sub-heading" id="boundaries">Trust Boundaries & Input Vectors</h2>
        <p>
          The sidecar proxy maps client identity using request headers (`X-User-ID`, `X-Tenant-ID`).
        </p>
        <div style={{
          background: "rgba(239, 68, 68, 0.05)",
          border: "1px solid rgba(239, 68, 68, 0.2)",
          borderRadius: 8,
          padding: 16,
          marginTop: 16
        }}>
          <strong>Critical Vulnerability Warning:</strong> By default, `ALLOW_QUERY_USER_ID=true` permits resolving client parameters from query string requests for testing. In production environments, this parameter **must** be set to `false`, and VPC gateway firewalls must be configured to strip public clients' `X-User-ID` headers to prevent quota bypass.
        </div>

        <h2 className="guide-sub-heading" id="header-protection">Header Protection Middleware</h2>
        <p>
          Below is the Go middleware checking and sanitizing ingress parameters:
        </p>
        <pre style={{ background: "#0e0e11", border: "1px solid #27272a", padding: 14, borderRadius: 6, fontSize: 12, overflowX: "auto" }}>
{`func SecureHeadersMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        // Strip public client-supplied identification headers
        if r.Header.Get("X-Public-Request") == "true" {
            r.Header.Del("X-User-ID")
            r.Header.Del("X-Tenant-ID")
        }

        // Validate query string fallback settings
        if os.Getenv("ALLOW_QUERY_USER_ID") != "true" {
            if r.URL.Query().Get("user_id") != "" {
                http.Error(w, "Query parameter user_id is disabled in production", http.StatusForbidden)
                return
            }
        }
        next.ServeHTTP(w, r)
    })
}`}
        </pre>
      </div>
    )
  },

  "operations-and-runbooks": {
    title: "Operations & Runbooks",
    topics: [
      { label: "Runbook 1: Redis Master Outage Mitigation", href: "#runbook-redis" },
      { label: "Runbook 2: Resolving Configuration Drift", href: "#runbook-drift" },
      { label: "Runbook 3: Managing Cache Memory Eviction", href: "#runbook-eviction" }
    ],
    content: (
      <div>
        <p>
          This section contains standard operational runbooks for diagnosing and mitigating production rate-limiting outages.
        </p>

        <h2 className="guide-sub-heading" id="runbook-redis">Runbook 1: Redis Master Outage Mitigation</h2>
        <p>
          <strong>Incident Scenario:</strong> The active Redis master node crashes, and the Sentinel cluster failover consensus is stalled.
        </p>
        <ol className="guide-bullets-list" style={{ listStyleType: "decimal" }}>
          <li>
            Query Sentinel status to locate the active master address:
            <pre style={{ background: "#0e0e11", border: "1px solid #27272a", padding: "10px 14px", borderRadius: 6, fontSize: 12, marginTop: 6 }}>
              redis-cli -h sentinel-host -p 26379 SENTINEL get-master-addr-by-name mymaster
            </pre>
          </li>
          <li>
            If Sentinel failover has failed to complete, promote a healthy replica node manually:
            <pre style={{ background: "#0e0e11", border: "1px solid #27272a", padding: "10px 14px", borderRadius: 6, fontSize: 12, marginTop: 6 }}>
              redis-cli -h replica-host -p 6379 SLAVEOF NO ONE
            </pre>
          </li>
          <li>
            Update the sidecar configurations to fail-open temporarily by changing `FAIL_OPEN_ON_DISCONNECT=true` to prevent application downtime.
          </li>
        </ol>

        <h2 className="guide-sub-heading" id="runbook-drift">Runbook 2: Resolving Configuration Drift</h2>
        <p>
          <strong>Incident Scenario:</strong> A subset of rate-limiter client instances fail to apply override parameters.
        </p>
        <ol className="guide-bullets-list" style={{ listStyleType: "decimal" }}>
          <li>
            Query the central configuration version generation parameter in Redis:
            <pre style={{ background: "#0e0e11", border: "1px solid #27272a", padding: "10px 14px", borderRadius: 6, fontSize: 12, marginTop: 6 }}>
              redis-cli -h redis-host -p 6379 GET config:generation
            </pre>
          </li>
          <li>
            If the generation ID fails to increment or is out of sync, force a global cache invalidation:
            <pre style={{ background: "#0e0e11", border: "1px solid #27272a", padding: "10px 14px", borderRadius: 6, fontSize: 12, marginTop: 6 }}>
              redis-cli -h redis-host -p 6379 INCR config:generation
            </pre>
          </li>
          <li>
            Check the rate-limiter instance logs to verify cache refresh confirmation: `local override cache invalidated, generation updated`.
          </li>
        </ol>

        <h2 className="guide-sub-heading" id="runbook-eviction">Runbook 3: Managing Cache Memory Eviction</h2>
        <p>
          <strong>Incident Scenario:</strong> Redis memory usage spikes, triggering key evictions and breaking rate-limiting math.
        </p>
        <ul className="guide-bullets-list">
          <li>Verify Redis memory statistics: `redis-cli info memory`.</li>
          <li>Ensure the Redis eviction policy is strictly set to `noeviction`. Under memory pressure, Redis must reject new writes rather than evict active rate limit keys, preventing client limits from being bypassed.</li>
          <li>Locate and clean up idle or expired keys using Redis scan commands.</li>
        </ul>
      </div>
    )
  }
};

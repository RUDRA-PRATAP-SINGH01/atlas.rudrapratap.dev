import React from "react";
import DocsMermaid from "@/features/docs/components/DocsMermaid";

export const productionPages = {
  "deployment-topology": {
    title: "Deployment Topology",
    topics: [
      { label: "Container Layout", href: "#layout" },
      { label: "Port Allocations", href: "#ports" }
    ],
    content: (
      <div>
        <p>
          This section outlines container placement and port configuration for standard and high-availability rate limiter deployments.
        </p>

        <h2 className="guide-sub-heading" id="layout">Container Layout</h2>
        <p>
          The default deployment (`docker-compose.yml`) stands up a sandbox topology on a single VM:
        </p>
        <ul className="guide-bullets-list">
          <li><strong>rate-sidecar:</strong> transparent proxy running alongside app services (intercepts `:9090`).</li>
          <li><strong>rate-limiter:</strong> stateless validation pool (exposed on `:8080`).</li>
          <li><strong>redis:</strong> state database (running on `:6379`).</li>
          <li><strong>demo-backend:</strong> dummy upstream application target (listening on `:8081`).</li>
        </ul>

        <h2 className="guide-sub-heading" id="ports">Port Allocations</h2>
        <div style={{ overflowX: "auto", margin: "20px 0" }}>
          <table className="guide-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #27272a", textAlign: "left" }}>
                <th style={{ padding: "12px 8px" }}>Port</th>
                <th style={{ padding: "12px 8px" }}>Service</th>
                <th style={{ padding: "12px 8px" }}>Protocol</th>
                <th style={{ padding: "12px 8px" }}>Visibility</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>9090</td>
                <td>rate-sidecar proxy</td>
                <td>HTTP / gRPC Proxying</td>
                <td>Edge / Internal Cluster</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>8080</td>
                <td>rate-limiter API</td>
                <td>HTTP API (`/check`)</td>
                <td>Cluster Private</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>8082</td>
                <td>rate-limiter admin</td>
                <td>HTTP CRUD Overrides</td>
                <td>Admin Network Only</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>6379</td>
                <td>Redis Master</td>
                <td>Redis Serialization Protocol</td>
                <td>Limiter Private Only</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    )
  },

  "redis-and-sentinel-ha": {
    title: "Redis & Sentinel HA",
    topics: [
      { label: "Sentinel Monitoring", href: "#monitoring" },
      { label: "Failover Sequence", href: "#failover" }
    ],
    content: (
      <div>
        <p>
          High-availability configurations rely on Redis Sentinel replication clusters to prevent master database outages.
        </p>

        <h2 className="guide-sub-heading" id="monitoring">Sentinel Monitoring</h2>
        <p>
          The Sentinel deployment (`docker-compose.ha.yml`) launches three Sentinel instances alongside a master and a replica.
        </p>
        <p>
          Sentinels monitor the active master on port `:26379`. If the master fails, they initiate a consensus vote. Upon reaching a quorum of 2, they elect and promote the replica to master, writing failover notifications to clients.
        </p>

        <h2 className="guide-sub-heading" id="failover">Failover Sequence</h2>
        <DocsMermaid chart={`
sequenceDiagram
    participant S as Sentinel Fleet
    participant M as Redis Master (Fails)
    participant R as Redis Replica
    participant L as Limiter Service

    S->>M: 1. Heartbeat fails (Subjectively Down)
    S->>S: 2. Reach Quorum (Objectively Down)
    S->>R: 3. Promote Replica to Master
    S->>L: 4. Broadcast master update (Failover notification)
    L->>R: 5. Connect and resume writes (Master role active)
        `} />
      </div>
    )
  },

  "configuration-reference": {
    title: "Configuration Reference",
    topics: [
      { label: "Limiter Env Variables", href: "#limiter-env" },
      { label: "Sidecar Env Variables", href: "#sidecar-env" }
    ],
    content: (
      <div>
        <p>
          This section documents environmental variables used to configure rate limiters and sidecars.
        </p>

        <h2 className="guide-sub-heading" id="limiter-env">Limiter Environment Variables</h2>
        <ul className="guide-bullets-list">
          <li>`REDIS_ADDRS`: Comma-separated list of Redis node addresses.</li>
          <li>`REDIS_MASTER_NAME`: Master name for Sentinel routing (e.g. `mymaster`).</li>
          <li>`LIMITER_PORT`: API listener port (default `8080`).</li>
          <li>`ADMIN_PORT`: Admin CRUD listener port (default `8082`).</li>
          <li>`DEFAULT_ALGORITHM`: Algorithmic engine (`token_bucket`/`sliding_window`).</li>
        </ul>

        <h2 className="guide-sub-heading" id="sidecar-env">Sidecar Environment Variables</h2>
        <ul className="guide-bullets-list">
          <li>`LIMITER_URL`: HTTP address of the central limiter service.</li>
          <li>`LISTEN_PORT`: Inbound proxy listener port (default `9090`).</li>
          <li>`DENIAL_CACHE_TTL_MS`: Local cache duration for rejections (default `1000`).</li>
          <li>`IDEMPOTENCY_LOCK_TTL_MS`: Idempotency lease lock duration (default `10000`).</li>
          <li>`CIRCUIT_FAILURE_THRESHOLD`: Error rate triggering the breaker (default `0.5`).</li>
        </ul>
      </div>
    )
  },

  "health-and-readiness": {
    title: "Health & Readiness",
    topics: [
      { label: "Health Endpoint /health", href: "#health" },
      { label: "Readiness Endpoint /ready", href: "#ready" }
    ],
    content: (
      <div>
        <p>
          Health and readiness probes provide deployment health checks to load balancers.
        </p>

        <h2 className="guide-sub-heading" id="health">Health Endpoint (`/health`)</h2>
        <p>
          Liveness checks evaluate process health. The `/health` endpoint returns `200 OK` instantly, indicating the runtime loop is active.
        </p>

        <h2 className="guide-sub-heading" id="ready">Readiness Endpoint (`/ready`)</h2>
        <p>
          Readiness checks verify downstream connectivity. The `/ready` endpoint queries active database connections:
        </p>
        <ul className="guide-bullets-list">
          <li>Queries the database with a quick ping (`PING`).</li>
          <li>If the ping succeeds, it returns `200 OK`.</li>
          <li>If it times out or returns a connection error, it responds with `503 Service Unavailable`, prompting the balancer to drop the node.</li>
        </ul>
      </div>
    )
  },

  "graceful-shutdown": {
    title: "Graceful Shutdown",
    topics: [
      { label: "Shutdown Lifecycle", href: "#lifecycle" },
      { label: "Draining Sequence", href: "#sequence" }
    ],
    content: (
      <div>
        <p>
          Graceful shutdowns prevent in-flight connection drops during deployments.
        </p>

        <h2 className="guide-sub-heading" id="lifecycle">Shutdown Lifecycle</h2>
        <p>
          Upon receiving `SIGTERM` or `SIGINT`, the service enters a draining sequence managed by the worker loops.
        </p>

        <h2 className="guide-sub-heading" id="sequence">Draining Sequence</h2>
        <ol className="guide-bullets-list" style={{ listStyleType: "decimal" }}>
          <li>Closes listener sockets immediately, blocking new connections.</li>
          <li>Allows active HTTP requests to complete, bounded by a draining timeout.</li>
          <li>Drains the asynchronous audit trail queue, flushing pending writes to Redis.</li>
          <li>Flushes OpenTelemetry trace exporters to Jaeger.</li>
          <li>Closes Redis client connections.</li>
          <li>Exits the process.</li>
        </ol>
      </div>
    )
  },

  "security-model": {
    title: "Security Model",
    topics: [
      { label: "Authentication & Keys", href: "#security-auth" },
      { label: "Trust Boundaries", href: "#boundaries" }
    ],
    content: (
      <div>
        <p>
          Deploying rate limiters in microservice topologies requires enforcing trust boundaries.
        </p>

        <h2 className="guide-sub-heading" id="security-auth">Authentication & Overrides</h2>
        <p>
          Standard check pathways require no client auth tokens since they run inside trusted private VPCs. The Admin override API (`:8082`), however, requires API key authentication, preventing unauthorized quota modification.
        </p>

        <h2 className="guide-sub-heading" id="boundaries">Trust Boundaries</h2>
        <div style={{
          background: "rgba(239, 68, 68, 0.05)",
          border: "1px solid rgba(239, 68, 68, 0.2)",
          borderRadius: 8,
          padding: 16,
          marginTop: 16
        }}>
          <strong>Input Safety:</strong> The sidecar uses header parameters (`X-User-ID`, `X-Tenant-ID`) to resolve user identity. By default, `ALLOW_QUERY_USER_ID=true` permits passing these parameters in query strings for local debugging. For production deployments, this must be disabled, and upstreams must configure gateway firewalls to prune client-supplied authentication headers.
        </div>
      </div>
    )
  },

  "operations-and-runbooks": {
    title: "Operations & Runbooks",
    topics: [
      { label: "Outage Mitigations", href: "#outages" },
      { label: "Override Mismatches", href: "#overrides" }
    ],
    content: (
      <div>
        <p>
          This section contains standard operational runbooks for resolving rate limiting and database incidents.
        </p>

        <h2 className="guide-sub-heading" id="outages">Runbook 1: Redis Master Outage</h2>
        <p>
          If the Redis master goes offline and Sentinel failover stalls:
        </p>
        <ol className="guide-bullets-list">
          <li>Confirm master status using command tools: `redis-cli -p 26379 SENTINEL get-master-addr-by-name mymaster`.</li>
          <li>If all nodes report failure, verify firewall settings or redeploy VM instances.</li>
          <li>To prevent customer impact, toggle the sidecar fallback mode to fail-open temporarily via `FAIL_OPEN_ON_DISCONNECT=true`.</li>
        </ol>

        <h2 className="guide-sub-heading" id="overrides">Runbook 2: Dynamic Override Mismatches</h2>
        <p>
          If override configurations diverge across replicas:
        </p>
        <ul className="guide-bullets-list">
          <li>Check the active generation counter using `GET config:generation`.</li>
          <li>If the value is out of sync or fails to update, force cache invalidation by executing `INCR config:generation`.</li>
          <li>Replicas will detect the updated version on their next check, clear local cache maps, and sync configurations.</li>
        </ul>
      </div>
    )
  }
};

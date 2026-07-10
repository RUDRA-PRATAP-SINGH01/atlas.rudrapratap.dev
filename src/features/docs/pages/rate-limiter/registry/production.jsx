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

export const productionPages = {
  "deployment-topology": {
    title: "Deployment Topology",
    topics: [
      { label: "Container Layout & Networking", href: "#layout" },
      { label: "Service Port Allocations", href: "#ports" },
      { label: "Docker Compose Stacks", href: "#compose" },
      { label: "Multi-Replica Scale Overlay", href: "#scale" }
    ],
    content: (
      <div>
        <RLThesis>
          Production deployments separate the client-facing sidecar boundary (<code>:9090</code>) from the stateless central limiter pool (<code>:8080</code> hot path, <code>:8082</code> admin) and the Redis authority layer (<code>:6379</code>). Observability services (Jaeger UI <code>:16686</code>, OTLP <code>:4318</code>, Prometheus UI <code>:9091</code>) sit on the same Docker network but must remain VPC-internal in real deployments.
        </RLThesis>

        <RLQuickModel>
          Client traffic enters the sidecar on <code>:9090</code>, quota checks go to the limiter on <code>:8080</code>, allowed requests forward to the demo/upstream on <code>:8081</code>, and all distributed state lives in Redis on <code>:6379</code>. Admin overrides and audit search use the isolated admin listener on <code>:8082</code>.
        </RLQuickModel>

        <RLStatGrid stats={[
          { value: ":9090", label: "Sidecar (cmd/sidecar)", evidence: "SOURCE-PROVEN" },
          { value: ":8080", label: "Limiter hot path", evidence: "SOURCE-PROVEN" },
          { value: ":8082", label: "Admin API", evidence: "SOURCE-PROVEN" },
          { value: ":9091", label: "Prometheus UI (host)", evidence: "SOURCE-PROVEN" }
        ]} />

        <h2 className="guide-sub-heading" id="layout">Container Layout & Networking</h2>
        <p>
          Each application host runs a sidecar companion that intercepts inbound HTTP before it reaches the upstream service. The sidecar delegates quota decisions to a central limiter that executes atomic Lua scripts against Redis. This separation keeps enforcement logic language-agnostic at the edge while concentrating Redis connection pools in the limiter tier.
        </p>
        <DocsMermaid chart={`
graph TD
    Client[Edge Load Balancer] -->|HTTP| Sidecar1[Sidecar :9090]
    Client -->|HTTP| Sidecar2[Sidecar :9090]

    subgraph Host1 [Application Host 1]
        Sidecar1 -->|RATE_LIMITER_URL| Limiter1[Limiter :8080]
        Sidecar1 -->|UPSTREAM_URL| App1[Upstream :8081]
    end

    subgraph Host2 [Application Host 2]
        Sidecar2 -->|RATE_LIMITER_URL| Limiter2[Limiter :8080]
        Sidecar2 -->|UPSTREAM_URL| App2[Upstream :8081]
    end

    Limiter1 -->|TCP| Redis[(Redis :6379)]
    Limiter2 -->|TCP| Redis
    Sidecar1 -.->|idempotency/routing| Redis
    Sidecar2 -.->|idempotency/routing| Redis
        `} />

        <h2 className="guide-sub-heading" id="ports">Service Port Allocations</h2>
        <p>
          Configure security groups and Kubernetes NetworkPolicies around these verified ports from <code>docker-compose.yml</code> and service defaults:
        </p>
        <div style={{ overflowX: "auto", margin: "20px 0" }}>
          <table className="guide-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #27272a", textAlign: "left" }}>
                <th style={{ padding: "12px 8px" }}>Port</th>
                <th style={{ padding: "12px 8px" }}>Service</th>
                <th style={{ padding: "12px 8px" }}>Protocol</th>
                <th style={{ padding: "12px 8px" }}>Network Scope</th>
                <th style={{ padding: "12px 8px" }}>Evidence</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["9090", "Sidecar Proxy", "HTTP/1.1", "VPC internal / edge ingress", "SOURCE-PROVEN"],
                ["8080", "Rate Limiter API", "HTTP/1.1", "Private subnet only", "SOURCE-PROVEN"],
                ["8082", "Limiter Admin API", "HTTP/1.1", "Admin bastion / ClusterIP only", "SOURCE-PROVEN"],
                ["8081", "Demo / Upstream backend", "HTTP/1.1", "Internal service mesh", "SOURCE-PROVEN"],
                ["6379", "Redis", "RESP (TCP)", "Database private subnet", "SOURCE-PROVEN"],
                ["16686", "Jaeger UI", "HTTP", "Ops / observability subnet", "SOURCE-PROVEN"],
                ["4318", "Jaeger OTLP HTTP ingest", "HTTP", "Internal telemetry only", "SOURCE-PROVEN"],
                ["9091", "Prometheus UI (host-mapped)", "HTTP", "Ops / observability subnet", "SOURCE-PROVEN"],
                ["26379", "Redis Sentinel (HA mode)", "RESP (TCP)", "Database private subnet", "SOURCE-PROVEN"]
              ].map(([port, svc, proto, scope, evidence]) => (
                <tr key={port} style={{ borderBottom: "1px solid #27272a" }}>
                  <td style={{ padding: "12px 8px", fontWeight: "bold", fontFamily: "monospace", color: "#ff5cad" }}>{port}</td>
                  <td style={{ padding: "12px 8px" }}>{svc}</td>
                  <td style={{ padding: "12px 8px" }}>{proto}</td>
                  <td style={{ padding: "12px 8px", color: "#a1a1aa" }}>{scope}</td>
                  <td style={{ padding: "12px 8px" }}><RLEvidenceBadge type={evidence} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <RLCallout variant="info" title="Prometheus host port">
          Prometheus runs on container port <code>9090</code> but is published to the host as <code>9091:9090</code> in <code>docker-compose.yml</code> — port <code>9091</code> on the host is already used by the sidecar-b replica in the scale overlay, so do not bind both on the same host without remapping.
        </RLCallout>

        <h2 className="guide-sub-heading" id="compose">Docker Compose Stacks</h2>
        <p>
          The base stack in <code>docker-compose.yml</code> defines Redis, limiter, sidecar, demo backend, Jaeger, Prometheus, and Grafana on the shared <code>rate-net</code> bridge network. Health checks use <code>GET /health</code> on the limiter (<code>wget -qO- http://localhost:8080/health</code>).
        </p>
        <RLSourceExcerpt
          source="docker-compose.yml — limiter service (excerpt)"
          language="yaml"
          establishes="Verified compose topology: PORT=8080, ADMIN_PORT=8082, ENABLE_HIERARCHICAL=true, audit enabled with 168h retention."
        >{`limiter:
  environment:
    - PORT=8080
    - REDIS_ADDR=redis:6379
    - ENABLE_HIERARCHICAL=true
    - ENABLE_ADMIN_API=true
    - ADMIN_PORT=8082
    - ADMIN_API_KEY=dev-key-change-in-prod
    - OVERRIDE_CACHE_TTL_MS=5000
    - ENABLE_AUDIT_TRAIL=true
    - AUDIT_RETENTION_HOURS=168
  ports:
    - "8080:8080"
    - "8082:8082"
  healthcheck:
    test: ["CMD", "wget", "-qO-", "http://localhost:8080/health"]`}</RLSourceExcerpt>

        <h2 className="guide-sub-heading" id="scale">Multi-Replica Scale Overlay</h2>
        <p>
          <code>docker-compose.scale.yml</code> adds a second limiter and sidecar under the <code>scale</code> profile for multi-replica correctness tests. Activate with:
        </p>
        <pre style={{ background: "#0e0e11", border: "1px solid #27272a", padding: 14, borderRadius: 6, fontSize: 12, overflowX: "auto", color: "#e4e4e7" }}>
{`docker compose -f docker-compose.yml -f docker-compose.scale.yml --profile scale up --build`}
        </pre>
        <div style={{ overflowX: "auto", margin: "20px 0" }}>
          <table className="guide-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #27272a", textAlign: "left" }}>
                <th style={{ padding: "12px 8px" }}>Service</th>
                <th style={{ padding: "12px 8px" }}>Host Port</th>
                <th style={{ padding: "12px 8px" }}>Container Port</th>
                <th style={{ padding: "12px 8px" }}>Notes</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px" }}>limiter-b</td>
                <td style={{ padding: "12px 8px", fontFamily: "monospace", color: "#ff5cad" }}>8083</td>
                <td style={{ padding: "12px 8px" }}>8080</td>
                <td style={{ padding: "12px 8px", color: "#a1a1aa" }}>Second limiter replica; admin mapped to 8084</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px" }}>sidecar-b</td>
                <td style={{ padding: "12px 8px", fontFamily: "monospace", color: "#ff5cad" }}>9092</td>
                <td style={{ padding: "12px 8px" }}>9090</td>
                <td style={{ padding: "12px 8px", color: "#a1a1aa" }}>9091 reserved for Prometheus in base compose</td>
              </tr>
            </tbody>
          </table>
        </div>

        <RLRelatedPages pages={[
          { section: "architecture", slug: "system-at-a-glance", title: "System at a Glance", note: "logical flow and port reference" },
          { section: "production-engineering", slug: "redis-and-sentinel-ha", title: "Redis & Sentinel HA", note: "Sentinel overlay profile" },
          { section: "correctness-and-verification", slug: "multi-replica-verification", title: "Multi-Replica Verification", note: "8083/9092 scale topology" }
        ]} />
      </div>
    )
  },

  "redis-and-sentinel-ha": {
    title: "Redis & Sentinel HA",
    topics: [
      { label: "Sentinel Consensus Setup", href: "#sentinel-consensus" },
      { label: "HA Compose Profile", href: "#ha-profile" },
      { label: "Client Failover Logic", href: "#client-failover" },
      { label: "Replication Guardrails", href: "#replication-guards" }
    ],
    content: (
      <div>
        <RLThesis>
          Standalone Redis is a single point of failure for all quota, override, circuit, and idempotency state. The <code>docker-compose.ha.yml</code> overlay switches limiter and sidecar to Sentinel mode via the <code>ha</code> profile, deploying one master, two replicas, and three sentinels with quorum 2.
        </RLThesis>

        <RLQuickModel>
          Sentinels monitor the master heartbeat. On objective down (ODOWN), a leader sentinel promotes the best replica. The Go <code>FailoverClient</code> rediscovers the new master via <code>SENTINEL get-master-addr-by-name</code> — no manual connection string updates required in application code.
        </RLQuickModel>

        <h2 className="guide-sub-heading" id="sentinel-consensus">Sentinel Consensus Setup</h2>
        <p>
          Each sentinel runs on port <code>26379</code> with a quorum of 2 (minimum sentinels agreeing before failover). The shipped <code>deploy/redis/sentinel.conf</code> uses <code>down-after-milliseconds 5000</code> and <code>failover-timeout 60000</code>:
        </p>
        <RLSourceExcerpt
          source="deploy/redis/sentinel.conf"
          language="yaml"
          establishes="Verified Sentinel quorum=2, down-after-milliseconds=5000, failover-timeout=60000."
        >{`port 26379
sentinel monitor mymaster redis-master 6379 2
sentinel auth-pass mymaster dev-redis-password
sentinel down-after-milliseconds mymaster 5000
sentinel failover-timeout mymaster 60000
sentinel parallel-syncs mymaster 1`}</RLSourceExcerpt>

        <h2 className="guide-sub-heading" id="ha-profile">HA Compose Profile</h2>
        <p>
          Activate Sentinel HA by combining the base and overlay files:
        </p>
        <pre style={{ background: "#0e0e11", border: "1px solid #27272a", padding: 14, borderRadius: 6, fontSize: 12, overflowX: "auto", color: "#e4e4e7" }}>
{`docker compose -f docker-compose.yml -f docker-compose.ha.yml --profile ha up --build`}
        </pre>
        <p>
          Under the <code>ha</code> profile, the standalone <code>redis</code> service is disabled (<code>profiles: ["standalone"]</code>) and replaced by <code>redis-master</code>, two replicas, and three sentinels. Limiter and sidecar receive:
        </p>
        <ul className="guide-bullets-list">
          <li><code>REDIS_MODE=sentinel</code></li>
          <li><code>REDIS_MASTER_NAME=mymaster</code></li>
          <li><code>REDIS_SENTINEL_ADDRS=redis-sentinel-1:26379,redis-sentinel-2:26379,redis-sentinel-3:26379</code></li>
        </ul>

        <h2 className="guide-sub-heading" id="client-failover">Client Failover Logic</h2>
        <p>
          Both limiter and sidecar use <code>redisclient.New(cfg)</code> which selects a standalone or Sentinel <code>FailoverClient</code> based on <code>REDIS_MODE</code>. On failover:
        </p>
        <ol className="guide-bullets-list">
          <li>Sentinels elect a new master and publish topology change on <code>+switch-master</code>.</li>
          <li>The Go client rediscovers the master address via Sentinel.</li>
          <li>Limiter <code>/health</code> continues to ping Redis and report replication role via <code>INFO replication</code>.</li>
        </ol>

        <RLSourceExcerpt
          source="internal/redis/health.go — CheckHealth"
          establishes="/health reads replication INFO after PING; reports role and master_addr in Sentinel mode."
        >{`func CheckHealth(ctx context.Context, client redis.UniversalClient, cfg Config) Health {
    h := Health{Mode: cfg.Mode}
    if err := client.Ping(ctx).Err(); err != nil {
        h.Error = err.Error()
        return h
    }
    h.Connected = true
    info, err := client.Info(ctx, "replication").Result()
    // ... parse role, master_host into Health struct
    return h
}`}</RLSourceExcerpt>

        <h2 className="guide-sub-heading" id="replication-guards">Replication Guardrails</h2>
        <RLCallout variant="warning" title="Replication lag risk">
          Under high throughput, replication lag can allow a promoted replica to miss recent token deductions or idempotency lease records. Configure Redis with <code>min-replicas-to-write 1</code> and <code>min-replicas-max-lag 2</code> in production to reject writes when replicas fall too far behind. Async audit events buffered in the worker queue are lost if Redis fails before drain completes.
        </RLCallout>

        <RLRelatedPages pages={[
          { section: "resilience", slug: "recovery-behaviour", title: "Recovery Behaviour", note: "failover timing and circuit recovery" },
          { section: "architecture", slug: "system-at-a-glance", title: "System at a Glance", note: "Level 3 Sentinel topology diagram" },
          { section: "production-engineering", slug: "operations-and-runbooks", title: "Operations & Runbooks", note: "Redis outage recovery steps" }
        ]} />
      </div>
    )
  },

  "configuration-reference": {
    title: "Configuration Reference",
    topics: [
      { label: "Central Limiter Config", href: "#limiter-config" },
      { label: "Sidecar Config", href: "#sidecar-config" },
      { label: "Audit Trail Defaults", href: "#audit-config" },
      { label: "Deprecated / Wrong Names", href: "#wrong-names" }
    ],
    content: (
      <div>
        <RLThesis>
          All runtime tuning is env-driven — no config files. Defaults come from <code>cmd/limiter/config.go</code> and inline parsing in <code>cmd/sidecar/main.go</code>. Code defaults differ from Docker compose overrides in several places (e.g. <code>ALGORITHM=sliding</code> in compose vs <code>token</code> in code).
        </RLThesis>

        <RLQuickModel>
          Limiter env controls algorithm, hierarchical tiers, admin API, and override cache TTL. Sidecar env controls upstream forwarding, limiter URL, denial cache TTL, and fail-open behaviour. Both share Redis connection env vars when idempotency or routing requires direct Redis access.
        </RLQuickModel>

        <h2 className="guide-sub-heading" id="limiter-config">Central Limiter (<code>cmd/limiter/config.go</code>)</h2>
        <div style={{ overflowX: "auto", margin: "20px 0" }}>
          <table className="guide-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #27272a", textAlign: "left" }}>
                <th style={{ padding: "12px 8px" }}>Variable</th>
                <th style={{ padding: "12px 8px" }}>Code Default</th>
                <th style={{ padding: "12px 8px" }}>Purpose</th>
                <th style={{ padding: "12px 8px" }}>Evidence</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["PORT", "8080", "Hot-path HTTP listener (/check, /check_hierarchical, /health, /metrics)", "SOURCE-PROVEN"],
                ["ADMIN_PORT", "8082", "Admin API listener (override CRUD, circuit, audit search)", "SOURCE-PROVEN"],
                ["ALGORITHM", "token", "Rate algorithm: token or sliding (compose uses sliding)", "SOURCE-PROVEN"],
                ["CAPACITY", "10", "Default per-user bucket capacity", "SOURCE-PROVEN"],
                ["REFILL_RATE", "1.0", "Token refill rate per second (token algorithm only)", "SOURCE-PROVEN"],
                ["ENABLE_HIERARCHICAL", "true", "Enable /check_hierarchical four-tier quotas", "SOURCE-PROVEN"],
                ["OVERRIDE_CACHE_TTL_MS", "5000", "Local override read-through cache TTL (ms)", "SOURCE-PROVEN"],
                ["ADMIN_API_KEY", "dev-key-change-in-prod", "X-API-Key for admin routes — MUST change in prod", "SOURCE-PROVEN"],
                ["ALLOW_QUERY_USER_ID", "false", "Allow ?user_id= query param (dev only)", "SOURCE-PROVEN"],
                ["REDIS_ADDR", "localhost:6379", "Standalone Redis address", "SOURCE-PROVEN"]
              ].map(([v, def, purpose, evidence]) => (
                <tr key={v} style={{ borderBottom: "1px solid #27272a" }}>
                  <td style={{ padding: "12px 8px", fontWeight: "bold", fontFamily: "monospace", color: "#ff5cad" }}>{v}</td>
                  <td style={{ padding: "12px 8px", fontFamily: "monospace", color: "#ff5cad" }}>{def}</td>
                  <td style={{ padding: "12px 8px", color: "#a1a1aa" }}>{purpose}</td>
                  <td style={{ padding: "12px 8px" }}><RLEvidenceBadge type={evidence} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <RLSourceExcerpt
          source="cmd/limiter/config.go — LoadConfig (excerpt)"
          establishes="Verified code defaults: ALGORITHM=token, ENABLE_HIERARCHICAL=true, ADMIN_API_KEY dev placeholder."
        >{`Algorithm:          getEnv("ALGORITHM", "token"),
Capacity:           mustParseIntEnv("CAPACITY", "10", strict),
RefillRate:         mustParseFloatEnv("REFILL_RATE", "1.0", strict),
EnableHierarchical: getEnv("ENABLE_HIERARCHICAL", "true") == "true",
AdminPort:          mustParseIntEnv("ADMIN_PORT", "8082", strict),
AdminAPIKey:        getEnv("ADMIN_API_KEY", "dev-key-change-in-prod"),
OverrideCacheTTLMs: mustParseIntEnv("OVERRIDE_CACHE_TTL_MS", "5000", strict),
AllowQueryUserID:   getEnv("ALLOW_QUERY_USER_ID", "false") == "true",`}</RLSourceExcerpt>

        <h2 className="guide-sub-heading" id="sidecar-config">Sidecar (<code>cmd/sidecar/main.go</code>)</h2>
        <div style={{ overflowX: "auto", margin: "20px 0" }}>
          <table className="guide-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #27272a", textAlign: "left" }}>
                <th style={{ padding: "12px 8px" }}>Variable</th>
                <th style={{ padding: "12px 8px" }}>Code Default</th>
                <th style={{ padding: "12px 8px" }}>Purpose</th>
                <th style={{ padding: "12px 8px" }}>Evidence</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["PORT", "9090", "Sidecar HTTP listener", "SOURCE-PROVEN"],
                ["RATE_LIMITER_URL", "(required)", "Base URL of central limiter — no default, startup fails if unset", "SOURCE-PROVEN"],
                ["FAIL_OPEN", "false", "Allow traffic when limiter unreachable — never enable in production", "SOURCE-PROVEN"],
                ["CACHE_TTL_MS", "30", "Denial cache TTL in ms (hardcoded 30ms unless env overrides)", "SOURCE-PROVEN"],
                ["ALLOW_QUERY_USER_ID", "false", "Allow ?user_id= for identity resolution", "SOURCE-PROVEN"],
                ["USE_HIERARCHICAL", "false", "Call /check_hierarchical instead of /check", "SOURCE-PROVEN"]
              ].map(([v, def, purpose, evidence]) => (
                <tr key={v} style={{ borderBottom: "1px solid #27272a" }}>
                  <td style={{ padding: "12px 8px", fontWeight: "bold", fontFamily: "monospace", color: "#ff5cad" }}>{v}</td>
                  <td style={{ padding: "12px 8px", fontFamily: "monospace", color: "#ff5cad" }}>{def}</td>
                  <td style={{ padding: "12px 8px", color: "#a1a1aa" }}>{purpose}</td>
                  <td style={{ padding: "12px 8px" }}><RLEvidenceBadge type={evidence} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <RLSourceExcerpt
          source="cmd/sidecar/main.go — env parsing (excerpt)"
          establishes="RATE_LIMITER_URL required; CACHE_TTL_MS defaults to 30ms; FAIL_OPEN=false unless explicitly true."
        >{`limiter := os.Getenv("RATE_LIMITER_URL")
if limiter == "" {
    logging.Fatal("RATE_LIMITER_URL must be set")
}
ttl := 30 * time.Millisecond
if raw := os.Getenv("CACHE_TTL_MS"); raw != "" {
    // ... parse override
}
failOpen := os.Getenv("FAIL_OPEN") == "true"
allowQueryUserID := os.Getenv("ALLOW_QUERY_USER_ID") == "true"`}</RLSourceExcerpt>

        <h2 className="guide-sub-heading" id="audit-config">Audit Trail Defaults</h2>
        <p>
          Audit configuration lives in <code>internal/audit/config.go</code>. <code>DefaultConfig()</code> enables audit by default with a 7-day retention window:
        </p>
        <div style={{ overflowX: "auto", margin: "20px 0" }}>
          <table className="guide-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #27272a", textAlign: "left" }}>
                <th style={{ padding: "12px 8px" }}>Variable</th>
                <th style={{ padding: "12px 8px" }}>Default</th>
                <th style={{ padding: "12px 8px" }}>Purpose</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["ENABLE_AUDIT_TRAIL", "true (disable with =false)", "Master audit switch"],
                ["AUDIT_RETENTION_HOURS", "168", "Event retention in Redis (7 days)"],
                ["AUDIT_QUEUE_SIZE", "4096", "Bounded async worker queue"],
                ["AUDIT_WORKERS", "4", "Async audit goroutine pool size"],
                ["AUDIT_ASYNC", "true", "Async writes via worker pool (vs inline)"],
                ["AUDIT_MAX_EVENTS", "100000", "Global audit index cap"]
              ].map(([v, def, purpose]) => (
                <tr key={v} style={{ borderBottom: "1px solid #27272a" }}>
                  <td style={{ padding: "12px 8px", fontWeight: "bold", fontFamily: "monospace", color: "#ff5cad" }}>{v}</td>
                  <td style={{ padding: "12px 8px", fontFamily: "monospace", color: "#ff5cad" }}>{def}</td>
                  <td style={{ padding: "12px 8px", color: "#a1a1aa" }}>{purpose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <RLSourceExcerpt
          source="internal/audit/config.go — DefaultConfig"
          establishes="Audit enabled by default; queue 4096, workers 4, retention 168h."
        >{`func DefaultConfig() Config {
    return Config{
        Enabled:   true,
        Retention: 7 * 24 * time.Hour,
        MaxEvents: 100_000,
        Async:     true,
        QueueSize: 4096,
        Workers:   4,
    }
}`}</RLSourceExcerpt>

        <h2 className="guide-sub-heading" id="wrong-names">Deprecated / Wrong Names</h2>
        <RLCallout variant="limitation" title="Common documentation errors">
          Earlier drafts used env names that do not exist in source. Use the corrected names below:
        </RLCallout>
        <div style={{ overflowX: "auto", margin: "20px 0" }}>
          <table className="guide-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #27272a", textAlign: "left" }}>
                <th style={{ padding: "12px 8px" }}>Wrong Name</th>
                <th style={{ padding: "12px 8px" }}>Correct Name</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["LIMITER_URL", "RATE_LIMITER_URL"],
                ["DENIAL_CACHE_TTL_MS", "CACHE_TTL_MS"],
                ["FAIL_OPEN_ON_DISCONNECT", "FAIL_OPEN"],
                ["LISTEN_PORT", "PORT"],
                ["DEFAULT_ALGORITHM", "ALGORITHM"],
                ["REDIS_ADDRS", "REDIS_ADDR (standalone) or REDIS_SENTINEL_ADDRS (sentinel)"]
              ].map(([wrong, correct]) => (
                <tr key={wrong} style={{ borderBottom: "1px solid #27272a" }}>
                  <td style={{ padding: "12px 8px", fontFamily: "monospace", color: "#db4577", textDecoration: "line-through" }}>{wrong}</td>
                  <td style={{ padding: "12px 8px", fontFamily: "monospace", color: "#ff5cad" }}>{correct}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <RLRelatedPages pages={[
          { section: "rate-limiting-engine", slug: "configuration-overrides", title: "Configuration Overrides", note: "OVERRIDE_CACHE_TTL_MS propagation" },
          { section: "production-engineering", slug: "security-model", title: "Security Model", note: "ADMIN_API_KEY and ALLOW_QUERY_USER_ID" },
          { section: "observability", slug: "metrics-and-prometheus", title: "Metrics & Prometheus", note: "OTEL env vars" }
        ]} />
      </div>
    )
  },

  "health-and-readiness": {
    title: "Health & Readiness",
    topics: [
      { label: "Limiter /health", href: "#limiter-health" },
      { label: "Sidecar /health", href: "#sidecar-health" },
      { label: "Probe Configuration", href: "#probes" },
      { label: "No /ready Endpoint", href: "#no-ready" }
    ],
    content: (
      <div>
        <RLThesis>
          Both binaries expose a single <code>GET /health</code> endpoint — there is no separate <code>/ready</code> route in source. The limiter health handler pings Redis and returns replication metadata; the sidecar health handler delegates to the limiter&apos;s <code>/health</code> and optionally checks Redis when idempotency or routing requires a direct connection.
        </RLThesis>

        <RLQuickModel>
          Limiter healthy = Redis PING succeeds. Sidecar healthy = limiter <code>/health</code> returns 200 (and Redis PING if <code>needsRedis</code>). Docker and Kubernetes should use these endpoints for both liveness and readiness — do not invent a separate readiness path.
        </RLQuickModel>

        <h2 className="guide-sub-heading" id="limiter-health">Limiter <code>GET /health</code></h2>
        <p>
          The limiter registers <code>/health</code> on the main HTTP server (<code>:8080</code>). It calls <code>redisclient.CheckHealth</code> which PINGs Redis and reads <code>INFO replication</code> for role and master address. Returns <code>503</code> when Redis is unreachable.
        </p>
        <RLSourceExcerpt
          source="cmd/limiter/main.go — /health handler"
          establishes="Limiter /health pings Redis via CheckHealth; returns 503 when not connected."
        >{`mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
    h := redisclient.CheckHealth(r.Context(), rdb, redisCfg)
    if !h.Connected {
        w.WriteHeader(http.StatusServiceUnavailable)
        json.NewEncoder(w).Encode(map[string]interface{}{
            "status": "unhealthy", "redis": h,
        })
        return
    }
    w.WriteHeader(http.StatusOK)
    json.NewEncoder(w).Encode(map[string]interface{}{
        "status": "healthy", "redis": h,
    })
})`}</RLSourceExcerpt>

        <h2 className="guide-sub-heading" id="sidecar-health">Sidecar <code>GET /health</code></h2>
        <p>
          The sidecar evaluates health in two stages: first probe the central limiter, then optionally ping Redis if the sidecar holds a direct connection (idempotency or intelligent routing enabled).
        </p>
        <RLSourceExcerpt
          source="cmd/sidecar/health.go — evaluateSidecarHealth"
          establishes="Sidecar health requires limiter /health OK; adds Redis check when needsRedis=true."
        >{`func evaluateSidecarHealth(ctx context.Context, deps sidecarHealthDeps) (int, map[string]interface{}) {
    limiterOK := checkLimiterHealth(ctx, deps.httpClient, deps.limiterURL)
    if !limiterOK {
        return http.StatusServiceUnavailable, map[string]interface{}{"status": "unhealthy"}
    }
    if deps.needsRedis {
        h := redisclient.CheckHealth(ctx, deps.redisClient, deps.redisCfg)
        if !h.Connected {
            return http.StatusServiceUnavailable, map[string]interface{}{
                "status": "unhealthy", "redis": h,
            }
        }
        return http.StatusOK, map[string]interface{}{"status": "healthy", "redis": h}
    }
    return http.StatusOK, map[string]interface{}{"status": "healthy"}
}

func checkLimiterHealth(ctx context.Context, client *http.Client, limiterURL string) bool {
    req, _ := http.NewRequestWithContext(ctx, http.MethodGet, limiterURL+"/health", nil)
    resp, err := client.Do(req)
    // ... returns resp.StatusCode == 200
}`}</RLSourceExcerpt>

        <h2 className="guide-sub-heading" id="probes">Probe Configuration</h2>
        <p>
          The shipped Docker healthcheck for the limiter uses:
        </p>
        <pre style={{ background: "#0e0e11", border: "1px solid #27272a", padding: 14, borderRadius: 6, fontSize: 12, overflowX: "auto", color: "#e4e4e7" }}>
{`healthcheck:
  test: ["CMD", "wget", "-qO-", "http://localhost:8080/health"]
  interval: 5s
  timeout: 3s
  retries: 5
  start_period: 10s`}
        </pre>
        <p>
          For Kubernetes, map liveness and readiness probes to the same endpoint. The sidecar returns <code>404</code> for <code>/health</code> on proxied traffic paths — health is served only on the sidecar&apos;s own mux, not forwarded upstream.
        </p>

        <h2 className="guide-sub-heading" id="no-ready">No <code>/ready</code> Endpoint</h2>
        <RLCallout variant="limitation" title="Documentation correction">
          Prior drafts described a separate <code>/ready</code> endpoint with invented <code>HandleReadiness</code> pseudocode. Source exposes only <code>/health</code> on both binaries. Use <code>/health</code> for all orchestrator probes.
        </RLCallout>

        <RLRelatedPages pages={[
          { section: "request-routing", slug: "gateway-health-and-failover", title: "Gateway Health & Failover", note: "routing health probes" },
          { section: "production-engineering", slug: "graceful-shutdown", title: "Graceful Shutdown", note: "drain before probe failure" },
          { section: "resilience", slug: "failure-model", title: "Failure Model", note: "fail-closed when health fails" }
        ]} />
      </div>
    )
  },

  "graceful-shutdown": {
    title: "Graceful Shutdown",
    topics: [
      { label: "Limiter Shutdown Order", href: "#limiter-shutdown" },
      { label: "Sidecar Shutdown Order", href: "#sidecar-shutdown" },
      { label: "Audit Queue Drain", href: "#audit-drain" },
      { label: "5-Second Timeout", href: "#timeout" }
    ],
    content: (
      <div>
        <RLThesis>
          Both binaries handle <code>SIGINT</code> and <code>SIGTERM</code> with a <strong>5-second</strong> HTTP shutdown context — not 15 seconds. The limiter shuts down admin first, then the main server, drains the async audit queue, flushes OpenTelemetry spans, and only then closes Redis if audit workers have fully stopped.
        </RLThesis>

        <RLQuickModel>
          Signal received → stop accepting new HTTP connections (admin, then main) → wait up to 5s for in-flight requests → drain audit queue → flush OTEL → close Redis. Sidecar cancels cache sweeper and routing probes first, then follows the same 5s HTTP + OTEL + Redis pattern.
        </RLQuickModel>

        <RLStatGrid stats={[
          { value: "5s", label: "HTTP shutdown timeout", color: "#ff5cad", evidence: "SOURCE-PROVEN" },
          { value: "5", label: "Limiter shutdown steps", evidence: "SOURCE-PROVEN" }
        ]} />

        <h2 className="guide-sub-heading" id="limiter-shutdown">Limiter Shutdown Order</h2>
        <DocsMermaid chart={`
flowchart TD
    SIG["SIGINT / SIGTERM"] --> Admin["1. adminSrv.Shutdown(5s)\\nAdmin API :8082"]
    Admin --> Main["2. srv.Shutdown(5s)\\nMain HTTP :8080"]
    Main --> Audit["3. auditStore.Shutdown(ctx)\\nDrain async queue"]
    Audit --> OTEL["4. otelShutdown(ctx)\\nFlush trace spans"]
    OTEL --> Redis["5. redisclient.Close(rdb)\\nOnly if auditStore.RedisCloseSafe()"]
    Redis --> Exit["Process exit"]
    style SIG fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style Exit fill:#1e1e2e,stroke:#ff5cad,color:#fff
        `} />

        <RLSourceExcerpt
          source="cmd/limiter/main.go — graceful shutdown"
          establishes="Verified order: admin → main → audit drain → OTEL → Redis close; 5*time.Second timeout."
        >{`ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()
if adminSrv != nil {
    if err := adminSrv.Shutdown(ctx); err != nil { /* log */ }
}
if err := srv.Shutdown(ctx); err != nil {
    logging.Fatal("Server forced to shutdown", "error", err)
}
if auditStore != nil && auditCfg.Enabled && auditCfg.Async {
    if err := auditStore.Shutdown(ctx); err != nil { /* log */ }
}
if err := otelShutdown(ctx); err != nil { /* log */ }
if auditStore != nil && !auditStore.RedisCloseSafe() {
    logging.Warn(ctx, "Skipping Redis close while audit workers are still active", ...)
} else if err := redisclient.Close(rdb); err != nil { /* log */ }`}</RLSourceExcerpt>

        <h2 className="guide-sub-heading" id="sidecar-shutdown">Sidecar Shutdown Order</h2>
        <ol className="guide-bullets-list">
          <li>Cancel cache sweeper goroutine (<code>sweeperCancel()</code>).</li>
          <li>Cancel gateway health probe ticker if routing enabled (<code>probeCancel()</code>).</li>
          <li><code>srv.Shutdown(5s)</code> — drain in-flight proxied requests.</li>
          <li><code>otelShutdown(ctx)</code> — flush trace batcher.</li>
          <li><code>redisclient.Close(sharedRdb)</code> if idempotency/routing holds a Redis connection.</li>
        </ol>

        <RLSourceExcerpt
          source="cmd/sidecar/main.go — shutdown (excerpt)"
          establishes="Sidecar uses 5*time.Second shutdown context; cancels background workers before HTTP drain."
        >{`sweeperCancel()
if probeCancel != nil { probeCancel() }

shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
defer shutdownCancel()
if err := srv.Shutdown(shutdownCtx); err != nil {
    logging.Fatal("Sidecar forced to shutdown", "error", err)
}
if err := otelShutdown(shutdownCtx); err != nil { /* log */ }
if sharedRdb != nil {
    redisclient.Close(sharedRdb)
}`}</RLSourceExcerpt>

        <h2 className="guide-sub-heading" id="audit-drain">Audit Queue Drain</h2>
        <p>
          When <code>ENABLE_AUDIT_TRAIL=true</code> and <code>AUDIT_ASYNC=true</code>, shutdown calls <code>auditStore.Shutdown(ctx)</code> which closes the bounded queue (default size 4096) and waits for all 4 worker goroutines to finish. If the 5-second context expires before workers stop, Redis close is skipped to prevent use-after-close panics.
        </p>

        <h2 className="guide-sub-heading" id="timeout">5-Second Timeout</h2>
        <RLCallout variant="warning" title="Not 15 seconds">
          Earlier documentation incorrectly stated a 15-second drain timeout. Source uses <code>5*time.Second</code> for both limiter and sidecar HTTP shutdown contexts. Rolling deploy configurations should align pod termination grace periods to at least 10–15s to accommodate audit drain + OTEL flush after HTTP drain.
        </RLCallout>

        <RLRelatedPages pages={[
          { section: "architecture", slug: "distributed-state-model", title: "Distributed State Model", note: "restart behaviour and 5s drain" },
          { section: "observability", slug: "distributed-tracing", title: "Distributed Tracing", note: "OTEL flush on shutdown" },
          { section: "production-engineering", slug: "operations-and-runbooks", title: "Operations & Runbooks", note: "deploy during drain window" }
        ]} />
      </div>
    )
  },

  "security-model": {
    title: "Security Model",
    topics: [
      { label: "Authentication Tiers", href: "#security-auth" },
      { label: "User Identity Resolution", href: "#identity" },
      { label: "ALLOW_QUERY_USER_ID Warning", href: "#query-warning" },
      { label: "Admin API Protection", href: "#admin-auth" }
    ],
    content: (
      <div>
        <RLThesis>
          Security boundaries are enforced at three layers: network isolation for the limiter hot path, API key authentication for admin and internal sidecar-to-limiter calls, and trusted identity resolution via the <code>X-User-ID</code> header. There is no custom header-stripping middleware in source — identity trust is delegated to upstream auth gateways.
        </RLThesis>

        <RLQuickModel>
          Public clients should never reach the limiter directly. The sidecar resolves user identity from <code>X-User-ID</code> (set by an auth gateway after JWT validation). Admin routes require <code>X-API-Key: {"{ADMIN_API_KEY}"}</code>. Sidecar-to-limiter calls require matching <code>INTERNAL_API_KEY</code> on both sides.
        </RLQuickModel>

        <h2 className="guide-sub-heading" id="security-auth">Authentication Tiers</h2>
        <div style={{ overflowX: "auto", margin: "20px 0" }}>
          <table className="guide-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #27272a", textAlign: "left" }}>
                <th style={{ padding: "12px 8px" }}>Tier</th>
                <th style={{ padding: "12px 8px" }}>Endpoint</th>
                <th style={{ padding: "12px 8px" }}>Mechanism</th>
                <th style={{ padding: "12px 8px" }}>Source</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Hot path /check", ":8080", "INTERNAL_API_KEY header (optional — warns if unset)", "auth.RequireAPIKey"],
                ["Admin API", ":8082", "ADMIN_API_KEY via X-API-Key header", "auth.RequireAPIKey"],
                ["Metrics", ":8080/metrics", "Open by default; METRICS_REQUIRE_AUTH=true to protect", "auth.RequireAPIKey"],
                ["Client identity", "Sidecar :9090", "X-User-ID header from trusted gateway", "identity.ResolveUserID"]
              ].map(([tier, ep, mech, src]) => (
                <tr key={tier} style={{ borderBottom: "1px solid #27272a" }}>
                  <td style={{ padding: "12px 8px", fontWeight: "bold" }}>{tier}</td>
                  <td style={{ padding: "12px 8px", fontFamily: "monospace", color: "#ff5cad" }}>{ep}</td>
                  <td style={{ padding: "12px 8px", color: "#a1a1aa" }}>{mech}</td>
                  <td style={{ padding: "12px 8px" }}><code>{src}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="guide-sub-heading" id="identity">User Identity Resolution</h2>
        <p>
          Identity resolution is implemented in <code>internal/identity/user.go</code> — not a custom <code>SecureHeadersMiddleware</code>. The sidecar calls <code>identity.ResolveUserID(r, allowQueryUserID)</code> during request handling:
        </p>
        <RLSourceExcerpt
          source="internal/identity/user.go — ResolveUserID"
          establishes="Production path: X-User-ID header only. Query param opt-in via ALLOW_QUERY_USER_ID."
        >{`// allowQuery enables ?user_id= for development; disable it anywhere clients are untrusted.
func ResolveUserID(r *http.Request, allowQuery bool) (string, error) {
    if userID := strings.TrimSpace(r.Header.Get(UserIDHeader)); userID != "" {
        return userID, nil
    }
    if allowQuery {
        if userID := strings.TrimSpace(r.URL.Query().Get("user_id")); userID != "" {
            return userID, nil
        }
    }
    return "", fmt.Errorf("missing trusted user identity: set %s header", UserIDHeader)
}`}</RLSourceExcerpt>
        <p style={{ fontSize: 12, color: "#71717a", marginTop: 8 }}>
          <em>Illustrative note:</em> prior documentation showed a fictional <code>SecureHeadersMiddleware</code> that stripped headers at the sidecar. Source does not implement header stripping — production deployments must ensure the auth gateway validates JWTs and sets <code>X-User-ID</code> before traffic reaches the sidecar.
        </p>

        <h2 className="guide-sub-heading" id="query-warning">ALLOW_QUERY_USER_ID Warning</h2>
        <RLCallout variant="warning" title="Production requirement">
          Code default for <code>ALLOW_QUERY_USER_ID</code> is <code>false</code> on both limiter and sidecar. Docker compose sets <code>true</code> for local demos only. In production, keep it <code>false</code> and ensure public clients cannot set <code>X-User-ID</code> directly — only a trusted auth gateway should inject this header after identity verification.
        </RLCallout>

        <h2 className="guide-sub-heading" id="admin-auth">Admin API Protection</h2>
        <RLSourceExcerpt
          source="cmd/limiter/config.go — ADMIN_API_KEY default"
          establishes="Default dev-key-change-in-prod; STRICT_SECURITY=true rejects this in production."
        >{`AdminAPIKey: getEnv("ADMIN_API_KEY", "dev-key-change-in-prod"),
// ...
if cfg.EnableAdminAPI && (cfg.AdminAPIKey == "" || cfg.AdminAPIKey == "dev-key-change-in-prod") {
    logging.Warn(nil, "ADMIN_API_KEY is using default dev placeholder — admin endpoints are insecure", ...)
}`}</RLSourceExcerpt>

        <RLRelatedPages pages={[
          { section: "resilience", slug: "failure-model", title: "Failure Model", note: "FAIL_OPEN=false default" },
          { section: "production-engineering", slug: "configuration-reference", title: "Configuration Reference", note: "full env var tables" },
          { section: "request-routing", slug: "sidecar-architecture", title: "Sidecar Architecture", note: "ServeHTTP pipeline and identity step" }
        ]} />
      </div>
    )
  },

  "operations-and-runbooks": {
    title: "Operations & Runbooks",
    topics: [
      { label: "Production Checklist", href: "#checklist" },
      { label: "Runbook: Redis Master Outage", href: "#runbook-redis" },
      { label: "Runbook: Override Propagation", href: "#runbook-drift" },
      { label: "Runbook: Memory Pressure", href: "#runbook-eviction" }
    ],
    content: (
      <div>
        <RLThesis>
          Standard operational procedures for the rate limiting platform, grounded in verified env defaults and admin API routes. All admin operations require <code>X-API-Key: {"{ADMIN_API_KEY}"}</code> and should only be reachable from internal networks.
        </RLThesis>

        <RLQuickModel>
          Redis down → limiter /health fails → sidecar returns 503 (FAIL_OPEN=false). Override drift → check config:generation → force INCR if stale. Memory pressure → verify noeviction policy — never allow LRU eviction of rate limit keys.
        </RLQuickModel>

        <h2 className="guide-sub-heading" id="checklist">Production Checklist</h2>
        <ul className="guide-bullets-list">
          <li>Replace <code>ADMIN_API_KEY</code>, <code>INTERNAL_API_KEY</code>, and <code>REDIS_PASSWORD</code> with generated secrets (<code>openssl rand -hex 32</code>).</li>
          <li>Set <code>FAIL_OPEN=false</code> on all sidecars — verify explicitly even though code default is safe.</li>
          <li>Set <code>ALLOW_QUERY_USER_ID=false</code> on limiter and sidecar.</li>
          <li>Restrict <code>ADMIN_PORT</code> (:8082) to internal VPC or Kubernetes ClusterIP — never expose publicly.</li>
          <li>Configure Redis <code>maxmemory-policy noeviction</code> — LRU eviction silently deletes rate limit buckets.</li>
          <li>Enable audit trail: <code>ENABLE_AUDIT_TRAIL=true</code>, retention <code>168h</code>, queue <code>4096</code>, workers <code>4</code>.</li>
          <li>Align pod termination grace period to accommodate 5s HTTP drain + audit/OTEL flush.</li>
        </ul>

        <h2 className="guide-sub-heading" id="runbook-redis">Runbook 1: Redis Master Outage</h2>
        <p><strong>Scenario:</strong> Redis master unreachable; limiter <code>/health</code> returns 503; sidecar circuit may open on <code>central-limiter</code>.</p>
        <ol className="guide-bullets-list" style={{ listStyleType: "decimal" }}>
          <li>
            In HA mode, query Sentinel for the current master:
            <pre style={{ background: "#0e0e11", border: "1px solid #27272a", padding: "10px 14px", borderRadius: 6, fontSize: 12, marginTop: 6, color: "#e4e4e7" }}>
              redis-cli -h redis-sentinel-1 -p 26379 SENTINEL get-master-addr-by-name mymaster
            </pre>
          </li>
          <li>
            Monitor failover progress:
            <pre style={{ background: "#0e0e11", border: "1px solid #27272a", padding: "10px 14px", borderRadius: 6, fontSize: 12, marginTop: 6, color: "#e4e4e7" }}>
              docker compose -f docker-compose.yml -f docker-compose.ha.yml logs -f redis-sentinel-1
            </pre>
          </li>
          <li>
            Verify sidecar recovery (do not set <code>FAIL_OPEN=true</code> unless explicitly approved — use <code>FAIL_OPEN</code>, not the nonexistent <code>FAIL_OPEN_ON_DISCONNECT</code>):
            <pre style={{ background: "#0e0e11", border: "1px solid #27272a", padding: "10px 14px", borderRadius: 6, fontSize: 12, marginTop: 6, color: "#e4e4e7" }}>
              watch -n1 'curl -s http://localhost:9090/health | jq .'
            </pre>
          </li>
          <li>Reset tripped circuits via admin API: <code>POST /admin/circuit/{"{target}"}/reset</code>.</li>
        </ol>

        <h2 className="guide-sub-heading" id="runbook-drift">Runbook 2: Override Propagation Delay</h2>
        <p><strong>Scenario:</strong> Admin override applied but limiter instances still serving stale quotas.</p>
        <ol className="guide-bullets-list" style={{ listStyleType: "decimal" }}>
          <li>
            Check the generation counter:
            <pre style={{ background: "#0e0e11", border: "1px solid #27272a", padding: "10px 14px", borderRadius: 6, fontSize: 12, marginTop: 6, color: "#e4e4e7" }}>
              redis-cli -a $REDIS_PASSWORD GET config:generation
            </pre>
          </li>
          <li>
            Apply override via admin API (propagates within <code>OVERRIDE_CACHE_TTL_MS</code>, default 5000ms):
            <pre style={{ background: "#0e0e11", border: "1px solid #27272a", padding: "10px 14px", borderRadius: 6, fontSize: 12, marginTop: 6, color: "#e4e4e7" }}>
{`curl -X POST http://localhost:8082/admin/limits/tenant/acme-corp \\
  -H "X-API-Key: $ADMIN_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"capacity": 50000, "refill_rate": 833}'`}
            </pre>
          </li>
          <li>If generation is stuck, force increment: <code>redis-cli INCR config:generation</code>.</li>
        </ol>

        <h2 className="guide-sub-heading" id="runbook-eviction">Runbook 3: Redis Memory Pressure</h2>
        <p><strong>Scenario:</strong> Redis memory usage spikes; risk of key eviction breaking rate limit math.</p>
        <ul className="guide-bullets-list">
          <li>Inspect memory: <code>redis-cli INFO memory</code>.</li>
          <li>Confirm eviction policy is <code>noeviction</code> — under pressure Redis must reject writes rather than evict active <code>rate:*</code> or <code>sw:*</code> keys.</li>
          <li>Review audit retention (<code>AUDIT_RETENTION_HOURS=168</code>) and max events (<code>AUDIT_MAX_EVENTS=100000</code>) if audit index grows large.</li>
          <li>Scale Redis vertically or shard by tenant before lowering retention windows.</li>
        </ul>

        <RLRelatedPages pages={[
          { section: "resilience", slug: "circuit-breaker", title: "Circuit Breaker", note: "manual reset via admin API" },
          { section: "rate-limiting-engine", slug: "configuration-overrides", title: "Configuration Overrides", note: "override CRUD and generation" },
          { section: "production-engineering", slug: "redis-and-sentinel-ha", title: "Redis & Sentinel HA", note: "failover procedures" }
        ]} />
      </div>
    )
  }
};

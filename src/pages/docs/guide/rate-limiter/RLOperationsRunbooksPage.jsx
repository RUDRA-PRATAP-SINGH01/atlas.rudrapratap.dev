import DocsNavbar from "@/components/docs/DocsNavbar";
import DocsSidebar from "@/components/docs/DocsSidebar";
import GoCodeBlock from "@/components/docs/GoCodeBlock";
import DocsMermaid from "@/components/docs/DocsMermaid";

const pageTopics = [
  { label: "Environment Configuration", href: "#env-config" },
  { label: "Override Quotas Runbook", href: "#override-runbook" },
  { label: "Circuit Breaker Controls", href: "#circuit-controls" },
  { label: "Redis Outage Recovery", href: "#redis-recovery" },
];

const outageRecoveryWorkflow = `
flowchart TD
    Outage["🚨 Redis / Limiter Outage Detected\\n(Sidecar logs circuit breaker OPEN or Timeout)"]
    Action1["1. Sidecar switches to fail-safe mode\\n(Default: ALLOW requests, increment metrics)"]
    Action2["2. Bring up fresh Redis Sentinel cluster\\n(Ensure AOF/RDB persistence config is active)"]
    Action3["3. Re-bootstrap override keys from backup config\\n(curl script to Admin API :8082)"]
    Action4["4. Reset sidecar denial cache to force refresh\\n(Restart sidecar pods or wait TTL)"]
    Action5["5. Reset circuit breakers manually\\n(POST /admin/circuit/limiter/reset)"]
    Verify["✓ System Operational (Healthy)"]

    Outage --> Action1 --> Action2 --> Action3 --> Action4 --> Action5 --> Verify

    style Outage fill:#f43f5e,stroke:#fff,color:#fff
    style Action1 fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style Action2 fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style Action5 fill:#1e1e2e,stroke:#4ade80,color:#fff
    style Verify fill:#1e1e2e,stroke:#4ade80,color:#fff
`;

export default function RLOperationsRunbooksPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="env-config">
              Operations &amp; Runbooks
            </h1>

            <div className="guide-body-text" style={{ marginTop: 24 }}>
              <p>
                This guide provides administrators and site reliability engineers (SREs) with standard configuration patterns and step-by-step procedures for runtime management and emergency recovery.
              </p>

              {/* Env Config */}
              <h2 className="guide-sub-heading" id="env-config" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                Environment Configuration
              </h2>
              <div style={{ overflowX: "auto", margin: "16px 0" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #27272a" }}>
                      {["Variable", "Default", "Description"].map(h => (
                        <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "#ff5cad", fontWeight: 600, fontSize: 12 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["LIMITER_ALGORITHM", "token_bucket", "Rate limiting algorithm: token_bucket | sliding_window"],
                      ["ENABLE_HIERARCHICAL", "false", "Activates the 4-level quota check. If true, /check_hierarchical is checked."],
                      ["REDIS_MODE", "standalone", "Redis deployment mode: standalone | sentinel"],
                      ["REDIS_SENTINEL_ADDRS", "", "Comma-separated list of sentinel addresses: port (e.g. sentinel1:26379,sentinel2:26379)"],
                      ["OVERRIDE_CACHE_TTL_MS", "5000", "Local TTL cache inside limiter process for overrides configured via Admin API."],
                      ["IDEMPOTENCY_FAIL_OPEN", "true", "If true, requests proceed to upstream if Redis is down during idempotency checks."],
                    ].map((row, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #18181b", background: i % 2 === 0 ? "#0b0b0b" : "#0f0f12" }}>
                        <td style={{ padding: "8px 12px", color: "#38bdf8", fontFamily: "monospace", fontSize: 12 }}>{row[0]}</td>
                        <td style={{ padding: "8px 12px", color: "#fb923c", fontFamily: "monospace" }}>{row[1]}</td>
                        <td style={{ padding: "8px 12px", color: "#a1a1aa" }}>{row[2]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Override Runbook */}
              <h2 className="guide-sub-heading" id="override-runbook" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                Emergency Quota Overrides
              </h2>
              <p>
                Use this runbook when a specific customer is experiencing a legitimate spike in traffic (e.g., flash sale) and is hitting quota boundaries, causing API errors.
              </p>
              <div style={{ background: "#0f0f12", border: "1px solid #27272a", borderRadius: 8, padding: "16px 20px", marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#71717a", marginBottom: 10, textTransform: "uppercase" }}>
                  Injecting Override
                </div>
                <GoCodeBlock>{`# 1. Authenticate using ADMIN_API_KEY
# 2. Inject override setting capacity and refill_rate for tenant "acme-corp"
curl -X POST http://localhost:8082/admin/limits/tenant/acme-corp \\
  -H "X-API-Key: $ADMIN_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"capacity": 50000, "refill_rate": 833}'

# Note: All limiter instances will fetch this new override limit within
# the configured OVERRIDE_CACHE_TTL_MS (default 5s).

# To verify the change has taken effect:
curl -X GET http://localhost:8082/admin/limits/tenant/acme-corp \\
  -H "X-API-Key: $ADMIN_API_KEY"

# Reverting/Deleting override once the burst ends:
curl -X DELETE http://localhost:8082/admin/limits/tenant/acme-corp \\
  -H "X-API-Key: $ADMIN_API_KEY"`}</GoCodeBlock>
              </div>

              {/* Circuit Breaker Controls */}
              <h2 className="guide-sub-heading" id="circuit-controls" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                Circuit Breaker Controls
              </h2>
              <p>
                If the Central Limiter becomes degraded, the sidecars automatically open their internal circuits to protect upstreams. Once the limiter issue is resolved, circuits will gradually transition back to closed.
              </p>
              <p style={{ marginTop: 10 }}>
                To bypass the wait and force all circuits to close immediately:
              </p>
              <div style={{ background: "#0f0f12", border: "1px solid #27272a", borderRadius: 8, padding: "16px 20px", marginBottom: 20 }}>
                <GoCodeBlock>{`# Reset the circuit breaker state in Redis
curl -X POST http://localhost:8082/admin/circuit/limiter/reset \\
  -H "X-API-Key: $ADMIN_API_KEY"

# This resets failure counts and transitions state to CLOSED.`}</GoCodeBlock>
              </div>

              {/* Redis Recovery */}
              <h2 className="guide-sub-heading" id="redis-recovery" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                Redis Outage Recovery Pipeline
              </h2>
              <p>
                In the event of a total Redis master-replica crash, use the following sequence to restore state:
              </p>
              <DocsMermaid chart={outageRecoveryWorkflow} />

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

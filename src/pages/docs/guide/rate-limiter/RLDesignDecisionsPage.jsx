import DocsNavbar from "@/components/docs/DocsNavbar";
import DocsSidebar from "@/components/docs/DocsSidebar";

const pageTopics = [
  { label: "Decision Philosophy", href: "#philosophy" },
  { label: "Architectural Decisions (DD-01 to DD-05)", href: "#arch-decisions" },
  { label: "Core Engine Decisions (DD-06 to DD-10)", href: "#core-decisions" },
];

export default function RLDesignDecisionsPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="design-decisions-title">
              Distributed Rate Limiter: Design Decisions
            </h1>

            <div className="guide-body-text" style={{ marginTop: 24 }}>
              <p>
                This document catalogs every major design decision made during the development of the Distributed Rate Limiter system.
                For each decision, I outline the <strong>Chosen Alternative</strong>, the <strong>Rejected Alternatives</strong>,
                and the detailed <strong>Technical Rationale</strong> behind the choice.
              </p>

              {/* Philosophy */}
              <h2 className="guide-sub-heading" id="philosophy" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                Decision Philosophy
              </h2>
              <p>
                The Distributed Rate Limiter is designed to run in high-throughput payment and API gateways where microsecond latency overhead matters,
                and where fail-soft behavior and high correctness (no double-charging, no quota leaks) are primary design constraints.
                The decisions reflect a strong preference for <strong>atomic, shared-state storage over distributed lock managers</strong>,
                and <strong>out-of-process boundaries (sidecars) over runtime integration libraries (SDKs)</strong>.
              </p>

              {/* Architectural Decisions */}
              <h2 className="guide-sub-heading" id="arch-decisions" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                Architectural Decisions
              </h2>

              <div className="guide-decision-card" style={{ background: "rgba(255, 92, 173, 0.03)", border: "1px solid rgba(255, 92, 173, 0.15)", borderRadius: 8, padding: 20, marginBottom: 20 }}>
                <h3 style={{ color: "#ff5cad", margin: 0, fontSize: 16 }}>DD-01: Out-of-Process Sidecar Proxy vs In-App SDK</h3>
                <p style={{ margin: "10px 0", lineHeight: "1.6" }}>
                  <strong>Chosen:</strong> Deploying the sidecar proxy (<code>cmd/sidecar</code>) as a companion container that transparently intercepts traffic.<br />
                  <strong>Rejected:</strong> An in-application client SDK library (e.g. Go package or Java jar) integrated directly into the application runtime.<br />
                  <strong>Rationale:</strong> An SDK couples the application codebase to the rate limiter infrastructure. Changes to routing algorithms, connection pooling, or idempotency rules require compiling and redeploying all services. The sidecar proxy allows language-agnostic integration (works with Python, Node, Go, Java), updates out-of-band without service disruption, and enforces security policies (like path allow-lists) before traffic even reaches the user application container.
                </p>
              </div>

              <div className="guide-decision-card" style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: 8, padding: 20, marginBottom: 20 }}>
                <h3 style={{ color: "#ffffff", margin: 0, fontSize: 16 }}>DD-02: Redis Sentinel (HA Master-Replica) vs Redis Cluster (Sharding)</h3>
                <p style={{ margin: "10px 0", lineHeight: "1.6" }}>
                  <strong>Chosen:</strong> Redis Sentinel with 1 master + replicas and automatic promotion.<br />
                  <strong>Rejected:</strong> Redis Cluster with key sharding across multiple master nodes.<br />
                  <strong>Rationale:</strong> The Hierarchical Rate Limiter requires executing multi-key Lua scripts (checking global, tenant, user, and endpoint buckets in a single transaction). In Redis Cluster mode, if these keys hash to different slots on different shards, Redis rejects the script with a <code>CROSSSLOT</code> error. Sentinel maintains a single master that processes all transactions, avoiding <code>CROSSSLOT</code> issues while maintaining automatic failover.
                </p>
              </div>

              <div className="guide-decision-card" style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: 8, padding: 20, marginBottom: 20 }}>
                <h3 style={{ color: "#ffffff", margin: 0, fontSize: 16 }}>DD-03: Isolated Admin API Port (:8082) vs Unified Service Port</h3>
                <p style={{ margin: "10px 0", lineHeight: "1.6" }}>
                  <strong>Chosen:</strong> Exposing administrative commands (override CRUD, circuit breaker resets, audit queries) on a separate port <code>:8082</code>.<br />
                  <strong>Rejected:</strong> A unified port (e.g. <code>:8080</code>) with route path prefixes (e.g. <code>/admin/*</code>) protected by auth middleware.<br />
                  <strong>Rationale:</strong> Separation of concerns and network isolation. By running the Admin API on a separate port, Kubernetes configurations can easily block external ingress to port <code>:8082</code> using simple network policies while leaving <code>:8080</code> accessible to sidecar instances. This reduces the risk of accidental exposure or credential leakage.
                </p>
              </div>

              <div className="guide-decision-card" style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: 8, padding: 20, marginBottom: 20 }}>
                <h3 style={{ color: "#ffffff", margin: 0, fontSize: 16 }}>DD-04: Redis Lua Script execution vs Client-Side Distributed Locking</h3>
                <p style={{ margin: "10px 0", lineHeight: "1.6" }}>
                  <strong>Chosen:</strong> Server-side atomic Lua scripts (via <code>EVALSHA</code>).<br />
                  <strong>Rejected:</strong> Client-side Go-based locking using Redlock or distributed lock managers.<br />
                  <strong>Rationale:</strong> Performance and deadlocking risk. Distributed locks require multiple network round-trips to acquire, refresh, and release the lock, creating a massive bottleneck on the hot path. A single Lua script runs atomically inside the Redis engine's single-threaded event loop, avoiding any lock contention or client-side latency.
                </p>
              </div>

              <div className="guide-decision-card" style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: 8, padding: 20, marginBottom: 20 }}>
                <h3 style={{ color: "#ffffff", margin: 0, fontSize: 16 }}>DD-05: Asynchronous Buffered Audit Logging vs Synchronous In-Line Writes</h3>
                <p style={{ margin: "10px 0", lineHeight: "1.6" }}>
                  <strong>Chosen:</strong> In-process Go channel (buffer cap 1024) consumed by a worker pool writing asynchronously to Redis indexes.<br />
                  <strong>Rejected:</strong> Writing audit logs to Redis directly inside the HTTP request handler before returning the decision.<br />
                  <strong>Rationale:</strong> Request latency optimization. Writing multi-index audit records to Redis requires a network hop and index evaluation, taking ~2–5ms. Exposing that on the hot path would double the overall check latency. The buffered async worker channel keeps check overhead under ~0.5ms under load.
                </p>
              </div>

              {/* Core Engine Decisions */}
              <h2 className="guide-sub-heading" id="core-decisions" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                Core Engine Decisions
              </h2>

              <div className="guide-decision-card" style={{ background: "rgba(255, 92, 173, 0.03)", border: "1px solid rgba(255, 92, 173, 0.15)", borderRadius: 8, padding: 20, marginBottom: 20 }}>
                <h3 style={{ color: "#ff5cad", margin: 0, fontSize: 16 }}>DD-06: Two-Phase Lua Checks for Hierarchical Quotas</h3>
                <p style={{ margin: "10px 0", lineHeight: "1.6" }}>
                  <strong>Chosen:</strong> Speculative read/refill Phase followed by a conditional commit decrement Phase.<br />
                  <strong>Rejected:</strong> Greedy step-by-step decrements (decrementing parent first, then backtracking if child check fails).<br />
                  <strong>Rationale:</strong> Avoids quota leakage. In a greedy approach, if a request passes Global and Tenant checks but fails the User check, the parent keys have already been decremented. Refilling them introduces complex backtracking logic and race conditions. A two-phase speculative check commits changes only when all levels are guaranteed to pass.
                </p>
              </div>

              <div className="guide-decision-card" style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: 8, padding: 20, marginBottom: 20 }}>
                <h3 style={{ color: "#ffffff", margin: 0, fontSize: 16 }}>DD-07: In-Memory Denial Cache vs pure Remote Checks</h3>
                <p style={{ margin: "10px 0", lineHeight: "1.6" }}>
                  <strong>Chosen:</strong> Short-lived local <code>sync.Map</code> cache on the sidecar to immediately serve HTTP 429 to denied clients.<br />
                  <strong>Rejected:</strong> Caching both allowed (200) and denied (429) requests, or caching nothing.<br />
                  <strong>Rationale:</strong> Protects infrastructure under DDoS. If a client is flooding the gateway with 10K RPS, forwarding every call to the Central Limiter saturates Redis. Serving cached 429s locally avoids this. Allowed requests (200) are never cached locally to prevent client-side bypass of token buckets.
                </p>
              </div>

              <div className="guide-decision-card" style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: 8, padding: 20, marginBottom: 20 }}>
                <h3 style={{ color: "#ffffff", margin: 0, fontSize: 16 }}>DD-08: Request Body Fingerprinting (SHA-256) for Idempotency</h3>
                <p style={{ margin: "10px 0", lineHeight: "1.6" }}>
                  <strong>Chosen:</strong> Generating a SHA-256 hash of the request body and comparing it to the stored record fingerprint on retry.<br />
                  <strong>Rejected:</strong> Key-only lookup (blindly replaying the stored response based solely on the <code>Idempotency-Key</code> header).<br />
                  <strong>Rationale:</strong> Prevents silent collisions and client coding bugs. If two distinct requests are sent with the same key (e.g. key collision or developer error), a blind replay would return the response of request A to request B — a critical security leak. Fingerprint verification rejects the request with a 422 if payloads differ.
                </p>
              </div>

              <div className="guide-decision-card" style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: 8, padding: 20, marginBottom: 20 }}>
                <h3 style={{ color: "#ffffff", margin: 0, fontSize: 16 }}>DD-09: Exponential Moving Average (EMA) for Gateway Scores</h3>
                <p style={{ margin: "10px 0", lineHeight: "1.6" }}>
                  <strong>Chosen:</strong> Latency score tracked as an Exponential Moving Average (EMA) updated atomically via Lua.<br />
                  <strong>Rejected:</strong> Simple rolling average or sliding window average of the last N requests.<br />
                  <strong>Rationale:</strong> Constant space complexity and speed. Storing the history of the last 50 request latencies in Redis per gateway consumes substantial memory and requires sliding window maintenance. EMA only stores a single float value, and weights recent performance higher, making it reactive to sudden failures.
                </p>
              </div>

              <div className="guide-decision-card" style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: 8, padding: 20, marginBottom: 20 }}>
                <h3 style={{ color: "#ffffff", margin: 0, fontSize: 16 }}>DD-10: singleflight Request Collapsing in Sidecar</h3>
                <p style={{ margin: "10px 0", lineHeight: "1.6" }}>
                  <strong>Chosen:</strong> Collapsing concurrent identical checks via <code>golang.org/x/sync/singleflight</code>.<br />
                  <strong>Rejected:</strong> Letting every incoming thread issue its own HTTP request to the Central Limiter.<br />
                  <strong>Rationale:</strong> Protects against the thundering herd problem. Under a flash sale or cache stampede, hundreds of threads might hit the sidecar simultaneously for the same resource. singleflight allows them to share a single backend call, reducing limiter load by up to 90%.
                </p>
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

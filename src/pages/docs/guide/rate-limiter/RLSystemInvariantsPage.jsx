import DocsNavbar from "@/components/docs/DocsNavbar";
import DocsSidebar from "@/components/docs/DocsSidebar";
import DocsMermaid from "@/components/docs/DocsMermaid";

const pageTopics = [
  { label: "Atomic Refill Invariant", href: "#refill-invariant" },
  { label: "Fencing Invariant", href: "#fencing-invariant" },
  { label: "Speculative All-or-Nothing", href: "#speculative" },
  { label: "Fail-Soft Invariant", href: "#fail-soft" },
];

const validationGatesDiagram = `
flowchart TD
    Req["Incoming Request\\n(Idempotency-Key = idem_123,\\nUser = alice,\\nPath = /api/pay)"]
    
    subgraph Gate1["Gate 1: Idempotency Integrity"]
        IdemCheck{"Does key exist?"}
        FpCheck{"If COMPLETED:\\nDoes request body SHA-256\\nmatch stored fingerprint?"}
    end

    subgraph Gate2["Gate 2: Speculative Quotas"]
        Phase1{"All-or-Nothing:\\nHave global, tenant, user,\\nand endpoint buckets got ≥ 1 token?"}
    end

    subgraph Gate3["Gate 3: State Committer"]
        Decrement["Atomically decrement ALL buckets\\nUpdate idempotency record to PROCESSING"]
    end

    Upstream["Forward to Upstream\\n(X-Fence-Token = 42)"]
    Reject["Reject Request\\nHTTP 429 / 409 / 422"]

    Req --> IdemCheck
    IdemCheck -->|"Yes, COMPLETED"| FpCheck
    IdemCheck -->|"No"| Phase1
    FpCheck -->|"Match"| Upstream
    FpCheck -->|"Mismatch"| Reject
    Phase1 -->|"All Pass"| Decrement --> Upstream
    Phase1 -->|"Any Fail"| Reject

    style Req fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style IdemCheck fill:#1e1e2e,stroke:#c084fc,color:#fff
    style Phase1 fill:#1e1e2e,stroke:#c084fc,color:#fff
    style Decrement fill:#1e1e2e,stroke:#c084fc,color:#fff
    style Upstream fill:#1e1e2e,stroke:#c084fc,color:#fff
    style Reject fill:#1e1e2e,stroke:#ec4899,color:#fff
`;

export default function RLSystemInvariantsPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="system-invariants">
              System Invariants
            </h1>

            <div className="guide-body-text" style={{ marginTop: 24 }}>
              <p>
                A production-grade distributed system must establish clear, non-negotiable **System Invariants** — safety guarantees that are mathematically or logically maintained across normal operations, container crashes, database failovers, and split-brain scenarios.
              </p>

              <h2 className="guide-sub-heading" id="gates" style={{ fontSize: 20, color: "#ffffff", marginTop: 28, marginBottom: 12 }}>
                Validation Gates Lifecycle
              </h2>
              <p>
                Every request must pass through three distinct validation gates to preserve system invariants:
              </p>
              <DocsMermaid chart={validationGatesDiagram} />

              {/* Invariant 1 */}
              <h2 className="guide-sub-heading" id="refill-invariant" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                1. Atomic Refill &amp; Capacity Invariant
              </h2>
              <div style={{
                background: "rgba(192, 132, 252,0.05)", border: "1px solid rgba(192, 132, 252,0.2)",
                borderRadius: 8, padding: "14px 18px", fontSize: 13, lineHeight: 1.65, marginBottom: 16
              }}>
                <strong style={{ color: "#c084fc" }}>Invariant Statement:</strong> For any rate-limit bucket B with capacity C, current tokens T, and refill rate R (tokens/sec), the level of tokens after any refill operation must always satisfy:
                <div style={{ fontFamily: "monospace", margin: "8px 0", fontSize: 14, color: "#ffffff" }}>
                  T_refilled = min(C, T_previous + (now - last_refill) * R)
                </div>
              </div>
              <p>
                The token level can never exceed C under any thread-interleaving pattern, and must remain monotonically non-negative unless a manual override reduces capacity below current levels.
              </p>
              <p style={{ marginTop: 12 }}>
                <strong>How it is maintained:</strong> Client-side refills are calculated inside the Redis Lua engine using atomic mathematical operations. By keeping the calculation on Redis, we eliminate thread-interleaving bugs (e.g. read old token level, add tokens, write back, overwriting concurrent additions) that plague Go-side refilling logic.
              </p>

              {/* Invariant 2 */}
              <h2 className="guide-sub-heading" id="fencing-invariant" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                2. Deduplication Fencing Invariant
              </h2>
              <div style={{
                background: "rgba(244, 114, 182,0.05)", border: "1px solid rgba(244, 114, 182,0.2)",
                borderRadius: 8, padding: "14px 18px", fontSize: 13, lineHeight: 1.65, marginBottom: 16
              }}>
                <strong style={{ color: "#c084fc" }}>Invariant Statement:</strong> An idempotency response write for key K with fence token F_req will be committed if and only if F_req matches the currently stored fence token F_stored in Redis.
                <div style={{ fontFamily: "monospace", margin: "8px 0", fontSize: 14, color: "#ffffff" }}>
                  CommitStatus = (F_req == F_stored) ? SUCCESS : REJECTED
                </div>
              </div>
              <p>
                This invariant prevents late-arriving requests from overwriting newer, active requests for the same idempotency key (e.g. after a network partition resolves and old threads deliver responses).
              </p>
              <p style={{ marginTop: 12 }}>
                <strong>How it is maintained:</strong> The <code>complete.lua</code> and <code>fail.lua</code> scripts run inside a Redis transaction block. They compare the passed token to the stored <code>fence_token</code> before executing the hash update, discarding modifications if there is a mismatch.
              </p>

              {/* Invariant 3 */}
              <h2 className="guide-sub-heading" id="speculative" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                3. Speculative All-or-Nothing Quota Invariant
              </h2>
              <div style={{
                background: "rgba(167, 139, 250,0.05)", border: "1px solid rgba(167, 139, 250,0.2)",
                borderRadius: 8, padding: "14px 18px", fontSize: 13, lineHeight: 1.65, marginBottom: 16
              }}>
                <strong style={{ color: "#c084fc" }}>Invariant Statement:</strong> In hierarchical limiting mode, tokens are consumed from all levels (Global, Tenant, User, Endpoint) if and only if ALL levels have sufficient tokens available.
                <div style={{ fontFamily: "monospace", margin: "8px 0", fontSize: 14, color: "#ffffff" }}>
                  {"DecrementCommit = (Global >= 1 && Tenant >= 1 && User >= 1 && Endpoint >= 1)"}
                </div>
              </div>
              <p>
                If a single level check fails (e.g., user is rate limited), no tokens must be decremented from the Global or Tenant buckets. This prevents quota leakage under abuse patterns.
              </p>
              <p style={{ marginTop: 12 }}>
                <strong>How it is maintained:</strong> A strict two-phase Lua script executes. Phase 1 performs a speculative check across all key structures. Phase 2 commits decrements only if all checks are valid.
              </p>

              {/* Invariant 4 */}
              <h2 className="guide-sub-heading" id="fail-soft" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                4. Fail-Soft Circuit Breaker Invariant
              </h2>
              <div style={{
                background: "rgba(219, 39, 119,0.05)", border: "1px solid rgba(219, 39, 119,0.2)",
                borderRadius: 8, padding: "14px 18px", fontSize: 13, lineHeight: 1.65, marginBottom: 16
              }}>
                <strong style={{ color: "#ec4899" }}>Invariant Statement:</strong> During a total Central Limiter or Redis outage, the Sidecar proxy must enforce safety boundaries based on environment rules, defaulting to fail-open (releasing traffic) or fail-closed.
              </div>
              <p>
                The system must never hang indefinitely or block upstream operations during rate-limiting infrastructure failures. If the circuit breaker enters the <code>OPEN</code> state, it must reject or bypass based on the configuration configuration.
              </p>

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

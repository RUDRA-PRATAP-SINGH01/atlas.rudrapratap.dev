import DocsNavbar from "@/components/docs/DocsNavbar";
import DocsSidebar from "@/components/docs/DocsSidebar";
import DocsMermaid from "@/components/docs/DocsMermaid";
import GoCodeBlock from "@/components/docs/GoCodeBlock";

const pageTopics = [
  { label: "Concept & Motivation", href: "#concept" },
  { label: "Idempotency Flow", href: "#flow" },
  { label: "Claim-and-Fence Protocol", href: "#fencing" },
  { label: "Storage Optimization", href: "#storage" },
  { label: "Fail-Open vs Fail-Closed", href: "#ha" },
];

const idempotencyFlowDiagram = `
sequenceDiagram
    autonumber
    actor C as Client
    participant SC as Sidecar Proxy
    participant R as Redis
    participant U as Upstream Service

    C->>SC: POST /payments (Idempotency-Key: pay-xyz-001)
    SC->>R: EVALSHA claim.lua KEYS[pay-xyz-001]
    
    alt Status: COMPLETED
        R-->>SC: return { "completed", 200, "captured headers", "cached body" }
        SC-->>C: return cached response (X-Idempotency-Status: replay)
    else Status: PROCESSING
        R-->>SC: return { "processing", fence_token }
        SC-->>C: return 409 Conflict (Request in progress)
    else Status: NEW / CLAIMED
        R-->>SC: return { "claimed", fence_token }
        SC->>U: Forward request (POST /payments)
        U-->>SC: return 200 OK (resp body)
        SC->>R: EVALSHA complete.lua KEYS[pay-xyz-001] ARGV[fence_token, 200, body]
        SC-->>C: return 200 OK (X-Idempotency-Status: created)
    end
`;

export default function RLIdempotencyPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="concept">
              Stripe-Style Idempotency Layer
            </h1>

            <div className="guide-body-text" style={{ marginTop: 24 }}>
              
              {/* Concept Section */}
              <p>
                In distributed systems, network operations can fail in ambiguous ways. If a client sends a <code>POST /payments</code> request and receives a network timeout, they cannot know if the request failed before reaching the server, or if the payment succeeded but the response was lost on the wire.
              </p>
              <p style={{ marginTop: 12 }}>
                If the client retries the request, they risk charging the customer twice. To make retries safe, the sidecar proxy implements a <strong style={{ color: "#ff5cad" }}>Stripe-style idempotency layer</strong>. Any request containing an <code>Idempotency-Key</code> header and using a mutating HTTP method (POST, PUT, PATCH) is automatically deduplicated.
              </p>

              {/* Flow Section */}
              <h2 className="guide-sub-heading" id="flow" style={{ fontSize: 22, color: "#ffffff", marginTop: 36, marginBottom: 12 }}>
                Execution Flow
              </h2>
              <p>
                The sidecar manages the lifecycle of the idempotency key atomically using Redis. The sequence below shows the three possible states:
              </p>

              <DocsMermaid chart={idempotencyFlowDiagram} />

              <ul className="guide-bullets-list" style={{ marginTop: 20, marginBottom: 20 }}>
                <li><strong>Replay (Status: COMPLETED):</strong> The request has already run to completion. The sidecar returns the cached status, headers, and body immediately without hitting the upstream service.</li>
                <li><strong>Conflict (Status: PROCESSING):</strong> A concurrent request with the same key is currently being executed by the upstream. The sidecar returns <code>409 Conflict</code>.</li>
                <li><strong>Created (Status: NEW / CLAIMED):</strong> This is the first time the key is seen. The sidecar claims the key, forwards the call upstream, caches the response, and returns the original response.</li>
              </ul>

              {/* Fencing Tokens */}
              <h2 className="guide-sub-heading" id="fencing" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                The Claim-and-Fence Protocol
              </h2>
              <p>
                In a highly concurrent, multi-instance proxy deployment, you must guard against race conditions caused by slow or crashed nodes.
              </p>
              <p style={{ marginTop: 12 }}>
                Suppose <code>Sidecar A</code> claims a key, forwards the request, but then experiences a long Garbage Collection pause. The lock TTL expires, and <code>Sidecar B</code> claims the key, executes the request, and caches the result. When <code>Sidecar A</code> wakes up, it must not overwrite the cache with its own result.
              </p>
              <p style={{ marginTop: 12 }}>
                The sidecar solves this using <strong style={{ color: "#ff5cad" }}>fencing tokens</strong>:
              </p>
              <ul className="guide-bullets-list" style={{ marginTop: 10, marginBottom: 20 }}>
                <li><code>claim.lua</code> generates a unique UUID (fence token) and writes it to the Redis hash for the key.</li>
                <li>When the sidecar completes execution, it calls <code>complete.lua</code>, passing the fence token.</li>
                <li><code>complete.lua</code> verifies that the token in Redis still matches the caller's token. If it matches, the response is saved. If the token has changed (because another node reclaimed the expired lock), the update is aborted.</li>
              </ul>

              <div style={{ background: "#0f0f12", border: "1px solid #27272a", borderRadius: 8, padding: "16px 20px", marginBottom: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#71717a", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  internal/idempotency/lua/claim.lua
                </div>
                <GoCodeBlock>{`-- KEYS[1] = idem:{key}
-- ARGV[1] = new_fence_token
-- ARGV[2] = lock_ttl_ms

local state = redis.call('HMGET', KEYS[1], 'status', 'fence_token', 'resp_status', 'resp_body')
local status = state[1]
local stored_token = state[2]

if status == 'completed' then
    -- Key completed, return cached response
    return {'completed', state[3], state[4]}
elseif status == 'processing' then
    -- Still executing, return conflict status
    return {'processing', stored_token}
else
    -- New request, claim the key
    redis.call('HMSET', KEYS[1], 
        'status', 'processing', 
        'fence_token', ARGV[1]
    )
    redis.call('PEXPIRE', KEYS[1], tonumber(ARGV[2]))
    return {'claimed', ARGV[1]}
end`}</GoCodeBlock>
              </div>

              {/* Storage Design */}
              <h2 className="guide-sub-heading" id="storage" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                Storage Optimization
              </h2>
              <p>
                Saving response bodies in Redis can lead to memory inflation if the bodies are large. The system optimizes memory footprint using a dual-storage scheme:
              </p>
              <ul className="guide-bullets-list" style={{ marginTop: 12, marginBottom: 20 }}>
                <li><strong style={{ color: "#38bdf8" }}>Inline HASH:</strong> If the response body is smaller than 64 KiB, it is stored directly inside the main <code>idem:{key}</code> Redis HASH under the <code>resp_body</code> field. This minimizes network round-trips.</li>
                <li><strong style={{ color: "#38bdf8" }}>External STRING Key:</strong> If the response body exceeds 64 KiB (up to 1 MiB limit), it is written to a separate Redis STRING key with its own expiration. This keeps the primary HASH metadata lean and prevents hashing performance degradation.</li>
              </ul>

              {/* Fail Open vs Fail Closed */}
              <h2 className="guide-sub-heading" id="ha" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                Fail-Open vs Fail-Closed Strategy
              </h2>
              <p>
                If the Redis cluster is unreachable, what happens to requests containing an <code>Idempotency-Key</code>? The system supports two modes configured via env variables:
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16, marginBottom: 24 }}>
                <div style={{ background: "#111113", border: "1px solid #f43f5e33", borderRadius: 8, padding: "16px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 18 }}>🛡️</span>
                    <strong style={{ fontSize: 13, color: "#ffffff" }}>Fail-Closed (Default)</strong>
                  </div>
                  <p style={{ fontSize: 12.5, color: "#a1a1aa", lineHeight: 1.6, margin: 0 }}>
                    If Redis is down, the sidecar rejects mutating requests with a <code>503 Service Unavailable</code>. This guarantees exact-once execution safety but reduces overall availability.
                  </p>
                </div>
                <div style={{ background: "#111113", border: "1px solid #4ade8033", borderRadius: 8, padding: "16px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 18 }}>🔓</span>
                    <strong style={{ fontSize: 13, color: "#ffffff" }}>Fail-Open (Optional)</strong>
                  </div>
                  <p style={{ fontSize: 12.5, color: "#a1a1aa", lineHeight: 1.6, margin: 0 }}>
                    Set <code>IDEMPOTENCY_FAIL_OPEN=true</code>. Mutating requests bypass deduplication and are forwarded directly to the upstream application, prioritizing service availability over exact-once execution.
                  </p>
                </div>
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

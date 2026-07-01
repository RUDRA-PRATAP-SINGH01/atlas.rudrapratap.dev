import DocsNavbar from "@/components/docs/DocsNavbar";
import DocsSidebar from "@/components/docs/DocsSidebar";
import DocsMermaid from "@/components/docs/DocsMermaid";
import GoCodeBlock from "@/components/docs/GoCodeBlock";

const pageTopics = [
  { label: "Why Idempotency Matters", href: "#why" },
  { label: "Key Format & Client Contract", href: "#key-format" },
  { label: "State Machine", href: "#state-machine" },
  { label: "Full Request Sequence", href: "#sequence" },
  { label: "claim.lua Script", href: "#claim-lua" },
  { label: "complete.lua & fail.lua", href: "#complete-fail" },
  { label: "Body Fingerprinting", href: "#fingerprinting" },
  { label: "Fence Tokens", href: "#fence-tokens" },
  { label: "Replay Detection", href: "#replay" },
];

const stateMachineDiagram = `
stateDiagram-v2
    [*] --> NEW : First request seen\\nclaim.lua → creates record
    NEW --> PROCESSING : claim.lua sets fence_token\\n(monotonic counter from Redis INCR)
    PROCESSING --> COMPLETED : complete.lua called\\nby upstream handler on 2xx response
    PROCESSING --> FAILED : fail.lua called\\nby upstream handler on 5xx response
    COMPLETED --> COMPLETED : Subsequent requests\\nwith same key → instant replay
    FAILED --> FAILED : Subsequent requests\\nwith same key → replay failure response
    PROCESSING --> PROCESSING : Concurrent duplicate requests\\nreceive 409 Conflict (in-flight)
`;

const fullSequenceDiagram = `
sequenceDiagram
    participant C as Client
    participant S as Sidecar Proxy
    participant R as Redis
    participant U as Upstream

    Note over C,U: First Request (New Key)
    C->>S: POST /payments\\nIdempotency-Key: pay_xyz123\\nbody: {amount: 100}
    S->>R: claim.lua(key="idem:sidecar:pay_xyz123",\\nfingerprint=sha256(body),\\ntenant="acme", ttl=86400)
    R-->>S: status="NEW" → fence_token=42\\n(atomically set to PROCESSING)
    S->>U: Forward request + X-Fence-Token: 42
    U->>R: complete.lua(key, fence=42,\\nstatus=200, body="{txn_id: abc}")
    R-->>U: OK
    U-->>S: 200 OK + response body
    S-->>C: 200 OK (cached response stored)

    Note over C,U: Retry Request (Same Key)
    C->>S: POST /payments\\nIdempotency-Key: pay_xyz123
    S->>R: claim.lua(key="idem:sidecar:pay_xyz123",\\nfingerprint=sha256(body))
    R-->>S: status="COMPLETED"\\nhttp_status=200, body="{txn_id: abc}"
    S-->>C: 200 OK (replayed from cache)\\nX-Idempotency-Status: REPLAYED

    Note over C,U: Concurrent Duplicate (In-Flight)
    C->>S: POST /payments (while first is processing)\\nIdempotency-Key: pay_xyz123
    S->>R: claim.lua(key=...)
    R-->>S: status="PROCESSING" → fence mismatch
    S-->>C: 409 Conflict\\nRetry-After: 1s\\nX-Idempotency-Status: IN_FLIGHT
`;

export default function RLIdempotencyPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="why">
              Idempotency Layer
            </h1>

            <div className="guide-body-text" style={{ marginTop: 24 }}>

              {/* Why Idempotency Matters */}
              <h2 className="guide-sub-heading" id="why" style={{ fontSize: 22, color: "#ffffff", marginTop: 0, marginBottom: 12 }}>
                Why Idempotency Matters
              </h2>
              <p>
                Network partitions, client timeouts, and load balancer retries mean that a single logical business operation can arrive at the server multiple times. Without idempotency, a POST that creates a payment, deducts inventory, or sends a notification can execute more than once — causing duplicate charges, oversold stock, or duplicate emails.
              </p>
              <p style={{ marginTop: 12 }}>
                The <strong>at-most-once vs exactly-once</strong> tradeoff is fundamental to distributed systems:
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginTop: 14, marginBottom: 24 }}>
                {[
                  { title: "At-Most-Once", color: "#38bdf8", icon: "1️⃣", body: "Fire-and-forget. Never retried. Avoids duplicates but loses the request permanently on any transient failure. Acceptable for non-critical logging. Unacceptable for payments." },
                  { title: "At-Least-Once", color: "#fb923c", icon: "🔁", body: "Retried until acknowledged. Prevents loss but creates duplicates on network errors. The default behavior of most HTTP clients and message queues. Dangerous for mutations." },
                  { title: "Exactly-Once", color: "#4ade80", icon: "✅", body: "The goal. Achieved by combining client-generated Idempotency-Key with server-side deduplication. This is what the idempotency layer implements." },
                ].map(item => (
                  <div key={item.title} style={{ background: "#111113", border: `1px solid ${item.color}33`, borderRadius: 8, padding: "16px 18px" }}>
                    <div style={{ fontSize: 20, marginBottom: 6 }}>{item.icon}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: item.color, marginBottom: 6 }}>{item.title}</div>
                    <div style={{ fontSize: 12.5, color: "#a1a1aa", lineHeight: 1.6 }}>{item.body}</div>
                  </div>
                ))}
              </div>

              <div style={{
                background: "rgba(255,92,173,0.06)", border: "1px solid rgba(255,92,173,0.2)",
                borderRadius: 8, padding: "14px 18px", fontSize: 13, lineHeight: 1.65, marginBottom: 28
              }}>
                <strong style={{ color: "#ff5cad" }}>The Implementation Contract:</strong> Any request that includes an <code>Idempotency-Key</code> header on a mutating HTTP method (POST, PUT, PATCH) is automatically intercepted by the sidecar's idempotency gate. Subsequent requests with the same key and matching body fingerprint return the stored response without forwarding to the upstream. The client is indistinguishable from a success that happened in real time.
              </div>

              {/* Key Format */}
              <h2 className="guide-sub-heading" id="key-format" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                Key Format &amp; Client Contract
              </h2>
              <p>
                The idempotency key is a client-generated string sent in the <code>Idempotency-Key</code> HTTP header. The sidecar scopes it internally by tenant and scope to prevent cross-tenant key collisions:
              </p>

              <div style={{ background: "#0f0f12", border: "1px solid #27272a", borderRadius: 8, padding: "16px 20px", marginBottom: 20, fontFamily: "monospace", fontSize: 13 }}>
                <div style={{ color: "#71717a", marginBottom: 8 }}># Internal Redis key format:</div>
                <div style={{ color: "#38bdf8" }}>idem:{"{scope}"}:{"{client_key}"}</div>
                <div style={{ marginTop: 14, color: "#71717a" }}># Example (scope = "sidecar"):</div>
                <div style={{ color: "#4ade80", marginTop: 4 }}>idem:sidecar:pay_xyz123_20240115</div>
                <div style={{ marginTop: 14, color: "#71717a" }}># Header the client sends:</div>
                <div style={{ color: "#fb923c", marginTop: 4 }}>Idempotency-Key: pay_xyz123_20240115</div>
              </div>

              <div style={{ overflowX: "auto", marginBottom: 28 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #27272a" }}>
                      {["Field", "Redis Type", "Key", "Description"].map(h => (
                        <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "#ff5cad", fontWeight: 600, fontSize: 12 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["status", "HASH field", "status", "NEW → PROCESSING → COMPLETED | FAILED"],
                      ["fence_token", "HASH field", "fence_token", "Monotonic counter. Prevents stale-request completion."],
                      ["fingerprint", "HASH field", "fingerprint", "SHA-256 of request body. Detects key reuse with different payload."],
                      ["http_status", "HASH field", "http_status", "HTTP status code of the completed upstream response."],
                      ["resp_body", "HASH field (small) / STRING (large)", "resp_body / resp_body_key", "Upstream response body. Inlined for ≤4KB, external key for larger."],
                      ["resp_headers", "HASH field", "resp_headers", "JSON-serialized upstream response headers to replay faithfully."],
                      ["created_at", "HASH field", "created_at", "Unix ms timestamp. Used for TTL audit and key expiry."],
                      ["tenant_id", "HASH field", "tenant_id", "Scopes the record to the originating tenant."],
                    ].map(([field, type_, key, desc], i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #18181b", background: i % 2 === 0 ? "#0b0b0b" : "#0f0f12" }}>
                        <td style={{ padding: "8px 12px", color: "#4ade80", fontFamily: "monospace", fontWeight: 600 }}>{field}</td>
                        <td style={{ padding: "8px 12px", color: "#fb923c", fontSize: 11 }}>{type_}</td>
                        <td style={{ padding: "8px 12px", color: "#38bdf8", fontFamily: "monospace", fontSize: 11 }}>{key}</td>
                        <td style={{ padding: "8px 12px", color: "#a1a1aa" }}>{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* State Machine */}
              <h2 className="guide-sub-heading" id="state-machine" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                Idempotency Key State Machine
              </h2>
              <p>
                Each idempotency key progresses through a strict state machine managed entirely inside Redis Lua scripts. No Go-side locking or distributed coordination is needed — Redis's single-threaded command execution guarantees that state transitions are atomic.
              </p>
              <DocsMermaid chart={stateMachineDiagram} />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 20, marginBottom: 28 }}>
                {[
                  { state: "NEW → PROCESSING", color: "#38bdf8", detail: "claim.lua is called with the client key and body fingerprint. If no prior record exists, a new HASH is created with status=PROCESSING and a fresh fence token (Redis INCR on a monotonic counter key). The caller receives the fence token." },
                  { state: "PROCESSING → COMPLETED", color: "#4ade80", detail: "complete.lua is called by the upstream handler after a successful 2xx response. The fence token is verified before writing. If it matches, status is set to COMPLETED and the response body and headers are stored. TTL is set to IDEMPOTENCY_TTL_SECONDS (default: 86400)." },
                  { state: "PROCESSING → FAILED", color: "#f43f5e", detail: "fail.lua is called on any 5xx response from upstream. The fence token is verified, status is set to FAILED, and the error response is stored. A failed key replays the same error on retry — preventing silent loss of failure information." },
                  { state: "COMPLETED/FAILED → replay", color: "#a78bfa", detail: "Any subsequent claim.lua call for an already-completed key returns the stored status, http_status, and response body without reaching upstream. The sidecar sets X-Idempotency-Status: REPLAYED." },
                ].map(item => (
                  <div key={item.state} style={{ background: "#111113", border: `1px solid ${item.color}33`, borderRadius: 8, padding: "14px 16px" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: item.color, marginBottom: 6, fontFamily: "monospace" }}>{item.state}</div>
                    <div style={{ fontSize: 12.5, color: "#a1a1aa", lineHeight: 1.6 }}>{item.detail}</div>
                  </div>
                ))}
              </div>

              {/* Full Request Sequence */}
              <h2 className="guide-sub-heading" id="sequence" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                Full Request Sequence
              </h2>
              <p>
                This sequence diagram covers three scenarios in one flow: the initial request, a client retry, and a concurrent duplicate that arrives while the first request is still processing:
              </p>
              <DocsMermaid chart={fullSequenceDiagram} />

              {/* claim.lua */}
              <h2 className="guide-sub-heading" id="claim-lua" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                <code style={{ color: "#ff5cad", fontSize: 18 }}>claim.lua</code> — Atomic Key Acquisition
              </h2>
              <p>
                The claim script is the entry point for every idempotency-protected request. It implements the check-and-set in a single Redis round-trip:
              </p>
              <div style={{ background: "#0f0f12", border: "1px solid #27272a", borderRadius: 8, padding: "16px 20px", marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#71717a", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  internal/sidecar/idempotency/lua/claim.lua
                </div>
                <GoCodeBlock>{`-- ============================================================
-- Idempotency Claim Script
-- ============================================================
-- KEYS[1] = main idempotency record key (HASH)
-- KEYS[2] = monotonic fence counter key (STRING, INCR)
-- ARGV[1] = fingerprint (SHA-256 of request body)
-- ARGV[2] = tenant_id
-- ARGV[3] = ttl_seconds (default 86400)
-- ============================================================
-- Returns: {status, fence_token, http_status, resp_body}
-- status: "NEW"       → caller should proceed to upstream
--         "REPLAYED"  → caller should return stored response
--         "IN_FLIGHT" → 409 Conflict; concurrent duplicate
-- ============================================================

local key  = KEYS[1]
local ctr  = KEYS[2]
local fp   = ARGV[1]
local tid  = ARGV[2]
local ttl  = tonumber(ARGV[3])

local exists = redis.call('EXISTS', key)

if exists == 0 then
    -- ── Brand new key: create PROCESSING record atomically ──
    local fence = redis.call('INCR', ctr)
    redis.call('HMSET', key,
        'status',      'PROCESSING',
        'fence_token', fence,
        'fingerprint', fp,
        'tenant_id',   tid,
        'created_at',  redis.call('TIME')[1]
    )
    redis.call('EXPIRE', key, ttl)
    return {'NEW', tostring(fence), '', ''}
end

-- ── Key exists: read current state ──
local data = redis.call('HMGET', key,
    'status', 'fence_token', 'fingerprint',
    'http_status', 'resp_body')

local status    = data[1]
local fence     = data[2]
local stored_fp = data[3]
local http_st   = data[4] or ''
local body      = data[5] or ''

-- Fingerprint mismatch: same key, different payload → reject
if stored_fp ~= fp then
    return {'FINGERPRINT_MISMATCH', '', '', ''}
end

if status == 'PROCESSING' then
    return {'IN_FLIGHT', fence, '', ''}
end

-- COMPLETED or FAILED: replay stored response
return {'REPLAYED', fence, http_st, body}`}</GoCodeBlock>
              </div>

              {/* complete.lua and fail.lua */}
              <h2 className="guide-sub-heading" id="complete-fail" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                <code style={{ color: "#4ade80", fontSize: 18 }}>complete.lua</code> &amp; <code style={{ color: "#f87171", fontSize: 18 }}>fail.lua</code>
              </h2>
              <p>
                After the upstream responds, the sidecar calls either <code>complete.lua</code> (on success) or <code>fail.lua</code> (on error). Both scripts verify the fence token before writing — preventing a stale, late-arriving request from overwriting a newer result:
              </p>
              <div style={{ background: "#0f0f12", border: "1px solid #27272a", borderRadius: 8, padding: "16px 20px", marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#71717a", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  internal/sidecar/idempotency/lua/complete.lua
                </div>
                <GoCodeBlock>{`-- KEYS[1] = idempotency record HASH key
-- ARGV[1] = expected fence_token (from claim result)
-- ARGV[2] = http_status (e.g. "200")
-- ARGV[3] = resp_body (response body, may be empty)
-- ARGV[4] = resp_headers (JSON string of headers)

local key          = KEYS[1]
local fence        = ARGV[1]
local http_status  = ARGV[2]
local body         = ARGV[3]
local headers      = ARGV[4]

local stored_fence = redis.call('HGET', key, 'fence_token')

-- Fence token mismatch: stale request — refuse to complete
if stored_fence ~= fence then
    return {0, 'FENCE_MISMATCH'}
end

-- Atomically mark as COMPLETED with response data
redis.call('HMSET', key,
    'status',       'COMPLETED',
    'http_status',  http_status,
    'resp_body',    body,
    'resp_headers', headers
)

return {1, 'OK'}`}</GoCodeBlock>
              </div>

              <div style={{ background: "#0f0f12", border: "1px solid #27272a", borderRadius: 8, padding: "16px 20px", marginBottom: 28 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#71717a", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  internal/sidecar/idempotency/lua/fail.lua
                </div>
                <GoCodeBlock>{`-- KEYS[1] = idempotency record HASH key
-- ARGV[1] = expected fence_token
-- ARGV[2] = http_status (e.g. "500")
-- ARGV[3] = error_body  (upstream error response body)

local key        = KEYS[1]
local fence      = ARGV[1]
local http_st    = ARGV[2]
local error_body = ARGV[3]

local stored_fence = redis.call('HGET', key, 'fence_token')

if stored_fence ~= fence then
    return {0, 'FENCE_MISMATCH'}
end

-- Mark as FAILED with the upstream error details preserved
redis.call('HMSET', key,
    'status',      'FAILED',
    'http_status', http_st,
    'resp_body',   error_body
)

return {1, 'OK'}`}</GoCodeBlock>
              </div>

              {/* Fingerprinting */}
              <h2 className="guide-sub-heading" id="fingerprinting" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                Request Body Fingerprinting
              </h2>
              <p>
                RFC 8835 recommends that servers reject idempotency key reuse with a different request body. The system enforces this by computing a SHA-256 of the request body before calling <code>claim.lua</code>, then comparing it to the stored fingerprint:
              </p>
              <div style={{ background: "#0f0f12", border: "1px solid #27272a", borderRadius: 8, padding: "16px 20px", marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#71717a", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  internal/sidecar/idempotency/fingerprint.go
                </div>
                <GoCodeBlock>{`package idempotency

import (
    "crypto/sha256"
    "encoding/hex"
    "io"
    "net/http"
    "bytes"
)

// BodyFingerprint reads the request body, buffers it (so it can be
// re-read for forwarding), and returns its hex-encoded SHA-256 digest.
func BodyFingerprint(r *http.Request) (fingerprint string, body []byte, err error) {
    if r.Body == nil {
        return "empty", nil, nil
    }
    body, err = io.ReadAll(io.LimitReader(r.Body, 10<<20)) // 10 MB cap
    if err != nil {
        return "", nil, err
    }
    r.Body = io.NopCloser(bytes.NewReader(body)) // re-inject for forwarding

    sum := sha256.Sum256(body)
    return hex.EncodeToString(sum[:]), body, nil
}

// IsMutatingMethod returns true for methods that require idempotency protection.
// GET, HEAD, OPTIONS are safe (idempotent by spec). DELETE is included in some
// configurations but excluded by default as it is safe to retry.
func IsMutatingMethod(method string) bool {
    switch method {
    case http.MethodPost, http.MethodPut, http.MethodPatch:
        return true
    default:
        return false
    }
}`}</GoCodeBlock>
              </div>

              {/* Fence Tokens */}
              <h2 className="guide-sub-heading" id="fence-tokens" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                Fence Tokens — Staleness Protection
              </h2>
              <p>
                A fence token is a strictly monotonically increasing integer assigned to each new idempotency claim. It protects against the following scenario:
              </p>
              <ol style={{ paddingLeft: 20, lineHeight: 1.8, color: "#a1a1aa", fontSize: 14, marginTop: 8, marginBottom: 16 }}>
                <li>Client sends Request A. Sidecar claims the key, gets <strong>fence=42</strong>. Forwards to upstream.</li>
                <li>Network partition: Request A stalls for 30 seconds inside upstream.</li>
                <li>Client retries. Sidecar attempts to claim (key is PROCESSING). Returns IN_FLIGHT 409.</li>
                <li>The key expires (TTL). Client retries again. New claim: fence=<strong>43</strong>.</li>
                <li>Upstream from step 1 finally responds. Calls <code>complete.lua</code> with fence=<strong>42</strong>.</li>
                <li>Fence check: <code>42 ≠ 43</code> → FENCE_MISMATCH → stale response is discarded.</li>
                <li>The in-flight result for fence=43 takes precedence.</li>
              </ol>
              <div style={{
                background: "rgba(251,146,60,0.07)", border: "1px solid rgba(251,146,60,0.25)",
                borderRadius: 8, padding: "14px 18px", fontSize: 13, lineHeight: 1.65, marginBottom: 28
              }}>
                <strong style={{ color: "#fb923c" }}>⚠️ Fence Counter Persistence:</strong> The fence counter key (<code>idem:fence:{"{scope}"}</code>) uses <code>INCR</code> which is crash-safe as long as Redis persistence is enabled (AOF or RDB). Without persistence, a Redis restart resets counters to 0, and old fence comparisons become unreliable. In production, enable AOF with <code>appendonly yes</code>.
              </div>

              {/* Replay Detection */}
              <h2 className="guide-sub-heading" id="replay" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                Replay Detection &amp; Response Headers
              </h2>
              <p>
                When a request is replayed from the idempotency cache, the sidecar adds diagnostic headers so clients and monitoring tools can distinguish a real upstream call from a cached replay:
              </p>
              <div style={{ overflowX: "auto", marginBottom: 24 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #27272a" }}>
                      {["Header", "Values", "Meaning"].map(h => (
                        <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "#ff5cad", fontWeight: 600, fontSize: 12 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["X-Idempotency-Status", "EXECUTED", "Request was forwarded to upstream for the first time."],
                      ["X-Idempotency-Status", "REPLAYED", "Response was served from idempotency cache. Upstream was NOT called."],
                      ["X-Idempotency-Status", "IN_FLIGHT", "Another request with this key is currently processing. Returns 409 Conflict."],
                      ["X-Idempotency-Status", "FINGERPRINT_MISMATCH", "Same key, different body. Request rejected with 422 Unprocessable Entity."],
                      ["X-Fence-Token", "{integer}", "The fence token assigned to this execution. Useful for distributed tracing correlation."],
                    ].map(([header, val, meaning], i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #18181b", background: i % 2 === 0 ? "#0b0b0b" : "#0f0f12" }}>
                        <td style={{ padding: "8px 12px", color: "#38bdf8", fontFamily: "monospace", fontSize: 11 }}>{header}</td>
                        <td style={{ padding: "8px 12px", color: "#fb923c", fontFamily: "monospace", fontWeight: 600 }}>{val}</td>
                        <td style={{ padding: "8px 12px", color: "#a1a1aa" }}>{meaning}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{
                background: "rgba(56,189,248,0.05)", border: "1px solid rgba(56,189,248,0.2)",
                borderRadius: 8, padding: "14px 18px", fontSize: 13, lineHeight: 1.65
              }}>
                <strong style={{ color: "#38bdf8" }}>Fail-Open vs Fail-Closed:</strong> If Redis is unavailable during the claim call, the sidecar's behavior is controlled by the <code>IDEMPOTENCY_FAIL_OPEN</code> env var. When <code>true</code> (default), the request proceeds as if no idempotency key was present — avoiding a hard outage. When <code>false</code>, the sidecar returns 503. Choose <code>false</code> for payment-critical services where duplicate execution is unacceptable.
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

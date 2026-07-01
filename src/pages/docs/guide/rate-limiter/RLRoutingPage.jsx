import DocsNavbar from "@/components/docs/DocsNavbar";
import DocsSidebar from "@/components/docs/DocsSidebar";
import DocsMermaid from "@/components/docs/DocsMermaid";
import GoCodeBlock from "@/components/docs/GoCodeBlock";

const pageTopics = [
  { label: "Why Intelligent Routing", href: "#why" },
  { label: "Scoring Algorithm", href: "#scoring" },
  { label: "EMA Latency Tracking", href: "#ema" },
  { label: "record_outcome.lua", href: "#record-outcome" },
  { label: "ComputeScore() in Go", href: "#compute-score" },
  { label: "Gateway Registration", href: "#registration" },
  { label: "Routing Pipeline", href: "#pipeline" },
  { label: "Failover Sequence", href: "#failover" },
];

const routingFlowDiagram = `
flowchart TD
    Request["Incoming Request\\n(rate limit passed ✓)"]
    
    subgraph GWSelection["Gateway Selection (per request)"]
        GetGWs["SMEMBERS route:index\\n→ [gw-alpha, gw-beta, gw-gamma]"]
        ScoreAll["For each gateway:\\nComputeScore(latency_ema, error_rate, timeout_rate)"]
        Rank["Sort by score DESC\\n(highest = healthiest)"]
        Pick["Pick primary gateway (score[0])\\nPick fallback gateway (score[1])"]
    end

    subgraph Forward["Forward & Record"]
        Proxy["httputil.ReverseProxy\\nForward to primary gateway"]
        RecordOK["record_outcome.lua\\nstatus=success, latency_ms=N"]
        RecordErr["record_outcome.lua\\nstatus=error, latency_ms=N"]
    end

    subgraph Retry["On Primary Failure"]
        FallbackProxy["httputil.ReverseProxy\\nForward to fallback gateway"]
        RecordFallback["record_outcome.lua\\nstatus=success on fallback"]
    end

    Request --> GetGWs --> ScoreAll --> Rank --> Pick --> Proxy
    Proxy -->|"2xx"| RecordOK
    Proxy -->|"5xx / timeout"| RecordErr --> FallbackProxy
    FallbackProxy --> RecordFallback

    style Request fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style Proxy fill:#1e1e2e,stroke:#c084fc,color:#fff
    style FallbackProxy fill:#1e1e2e,stroke:#c084fc,color:#fff
    style Pick fill:#1e1e2e,stroke:#a78bfa,color:#fff
    style RecordErr fill:#1e1e2e,stroke:#ec4899,color:#fff
`;

const failoverSequenceDiagram = `
sequenceDiagram
    participant S as Sidecar Router
    participant GA as Gateway Alpha (primary)
    participant GB as Gateway Beta (fallback)
    participant R as Redis

    Note over S,R: Normal request — Alpha has score 0.92
    S->>GA: POST /payments (forwarded)
    GA-->>S: 200 OK (latency: 45ms)
    S->>R: record_outcome.lua(gw=alpha, status=success, latency=45)
    R-->>S: new_score=0.93, new_ema=44ms

    Note over GA: Alpha starts having issues (high latency + errors)
    S->>GA: POST /payments
    GA-->>S: 504 Gateway Timeout (latency: 3050ms)
    S->>R: record_outcome.lua(gw=alpha, status=error, latency=3050)
    R-->>S: new_score=0.71 (EMA spikes, error_rate increases)

    Note over S,R: Next request — Alpha score degraded, Beta selected
    S->>R: SMEMBERS route:index → score alpha=0.71, beta=0.88
    S->>GB: POST /payments (Beta now primary)
    GB-->>S: 200 OK (latency: 82ms)
    S->>R: record_outcome.lua(gw=beta, status=success, latency=82)

    Note over GA: Alpha continues to fail — score drops to 0.12
    S->>GA: POST /payments (retry as fallback — Alpha is secondary now)
    GA-->>S: 500 Internal Server Error
    S->>GB: POST /payments (automatic failover to Beta)
    GB-->>S: 200 OK
`;

export default function RLRoutingPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="why">
              Intelligent Gateway Routing
            </h1>

            <div className="guide-body-text" style={{ marginTop: 24 }}>

              {/* Why Intelligent Routing */}
              <h2 className="guide-sub-heading" id="why" style={{ fontSize: 22, color: "#ffffff", marginTop: 0, marginBottom: 12 }}>
                Why Intelligent Routing?
              </h2>
              <p>
                Payment APIs often route through multiple upstream gateways (Stripe, Razorpay, Adyen) or multiple regional instances of the same gateway. Simple round-robin load balancing is oblivious to gateway health — it sends equal traffic to a degraded gateway that's timing out 80% of requests, adding seconds of latency to those transactions.
              </p>
              <p style={{ marginTop: 12 }}>
                Intelligent routing solves this by continuously measuring each gateway's performance and shifting traffic away from degraded gateways in real time — without manual intervention or configuration changes.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginTop: 16, marginBottom: 24 }}>
                {[
                  { icon: "📊", title: "Score-Based Selection", body: "Each gateway has a health score (0.0–1.0) computed from its recent latency EMA, error rate, and timeout rate. The highest-scoring gateway is selected as primary.", color: "#c084fc" },
                  { icon: "🔄", title: "Automatic Failover", body: "If the primary gateway returns a 5xx or times out, the router immediately retries with the next-best gateway — the user sees no failure if the fallback succeeds.", color: "#c084fc" },
                  { icon: "📉", title: "Continuous Adaptation", body: "Scores are updated after every request using EMA (exponential moving average). A recovering gateway sees its score gradually improve and earns traffic back organically.", color: "#a78bfa" },
                ].map(item => (
                  <div key={item.title} style={{ background: "#111113", border: `1px solid ${item.color}33`, borderRadius: 8, padding: "16px 18px" }}>
                    <div style={{ fontSize: 22, marginBottom: 6 }}>{item.icon}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: item.color, marginBottom: 6 }}>{item.title}</div>
                    <div style={{ fontSize: 12.5, color: "#a1a1aa", lineHeight: 1.6 }}>{item.body}</div>
                  </div>
                ))}
              </div>

              {/* Full routing flow */}
              <DocsMermaid chart={routingFlowDiagram} />

              {/* Scoring Algorithm */}
              <h2 className="guide-sub-heading" id="scoring" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                Gateway Scoring Algorithm
              </h2>
              <p>
                Each gateway's score is a weighted combination of three normalized components. The weights are tunable via environment variables:
              </p>
              <div style={{
                background: "#0f0f12", border: "1px solid #27272a", borderRadius: 8,
                padding: "20px 24px", marginBottom: 20, fontFamily: "monospace"
              }}>
                <div style={{ fontSize: 13, color: "#a1a1aa", marginBottom: 10 }}>Score formula:</div>
                <div style={{ fontSize: 15, color: "#ffffff", marginBottom: 8 }}>
                  <span style={{ color: "#ff5cad" }}>score</span>
                  {" = "}
                  <span style={{ color: "#c084fc" }}>W₁</span>
                  {" × "}
                  <span style={{ color: "#c084fc" }}>success_rate</span>
                  {" + "}
                  <span style={{ color: "#c084fc" }}>W₂</span>
                  {" × "}
                  <span style={{ color: "#a78bfa" }}>latency_score</span>
                  {" + "}
                  <span style={{ color: "#c084fc" }}>W₃</span>
                  {" × "}
                  <span style={{ color: "#c084fc" }}>timeout_score</span>
                </div>
                <div style={{ fontSize: 12, color: "#71717a", marginTop: 12 }}>
                  {"where: latency_score = max(0, 1 − ema_ms / baseline_ms)"}<br />
                  {"       timeout_score = 1 − timeout_rate"}<br />
                  {"       W₁ + W₂ + W₃ = 1.0  (default: 0.5, 0.3, 0.2)"}
                </div>
              </div>

              <div style={{ overflowX: "auto", marginBottom: 28 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #27272a" }}>
                      {["Component", "Env Var (weight)", "Range", "Meaning", "Example"].map(h => (
                        <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "#ff5cad", fontWeight: 600, fontSize: 12 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["Success Rate", "ROUTING_WEIGHT_SUCCESS=0.5", "0.0 – 1.0", "Fraction of recent requests that returned 2xx. Highest weight — a gateway crashing is the worst failure mode.", "0 errors in 100 reqs → 1.0"],
                      ["Latency Score", "ROUTING_WEIGHT_LATENCY=0.3", "0.0 – 1.0", "Normalized: 1 − (ema_ms / baseline_ms). Baseline is ROUTING_LATENCY_BASELINE_MS (default 200ms). Penalizes slow gateways.", "ema=100ms, base=200ms → 0.5"],
                      ["Timeout Score", "ROUTING_WEIGHT_TIMEOUT=0.2", "0.0 – 1.0", "1 − timeout_rate. Timeouts are worse than errors because they consume a connection for the full timeout duration.", "5% timeouts → 0.95"],
                    ].map(([comp, env, range_, meaning, ex], i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #18181b", background: i % 2 === 0 ? "#0b0b0b" : "#0f0f12" }}>
                        <td style={{ padding: "8px 12px", color: "#c084fc", fontWeight: 600 }}>{comp}</td>
                        <td style={{ padding: "8px 12px", color: "#c084fc", fontFamily: "monospace", fontSize: 11 }}>{env}</td>
                        <td style={{ padding: "8px 12px", color: "#c084fc", fontFamily: "monospace" }}>{range_}</td>
                        <td style={{ padding: "8px 12px", color: "#a1a1aa", lineHeight: 1.5 }}>{meaning}</td>
                        <td style={{ padding: "8px 12px", color: "#71717a", fontFamily: "monospace", fontSize: 11 }}>{ex}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* EMA */}
              <h2 className="guide-sub-heading" id="ema" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                EMA Latency Tracking
              </h2>
              <p>
                Exponential Moving Average (EMA) tracks latency with more weight on recent observations. Unlike a simple rolling average, EMA doesn't require storing a history of values — only the previous EMA and the new observation. This makes it ideal for Redis (stored as a single HASH field):
              </p>
              <div style={{
                background: "#0f0f12", border: "1px solid #27272a", borderRadius: 8,
                padding: "20px 24px", marginBottom: 20, fontFamily: "monospace"
              }}>
                <div style={{ fontSize: 14, color: "#ffffff" }}>
                  {"new_ema = α × latency + (1 − α) × prev_ema"}
                </div>
                <div style={{ fontSize: 12, color: "#71717a", marginTop: 10, lineHeight: 1.8 }}>
                  {"α (alpha) = ROUTING_EMA_ALPHA (default: 0.1)"}<br />
                  {"At α=0.1: each new sample has 10% influence on the EMA."}<br />
                  {"This means the EMA responds slowly to spikes (smoothed)"}<br />
                  {"but reacts over ~20 samples to a sustained change (responsive)."}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 28 }}>
                {[
                  { label: "α = 0.1 (default, smooth)", desc: "Stable under random latency spikes. Takes ~20–30 requests before a genuinely degraded gateway has its score visibly penalized. Good for stable traffic.", color: "#c084fc" },
                  { label: "α = 0.5 (responsive, noisy)", desc: "Reacts aggressively to every individual request. A single slow response causes a large score drop. Good for low-volume traffic where quick reaction matters more than stability.", color: "#c084fc" },
                ].map(item => (
                  <div key={item.label} style={{ background: "#111113", border: `1px solid ${item.color}33`, borderRadius: 8, padding: "14px 16px" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: item.color, marginBottom: 6 }}>{item.label}</div>
                    <div style={{ fontSize: 12.5, color: "#a1a1aa", lineHeight: 1.6 }}>{item.desc}</div>
                  </div>
                ))}
              </div>

              {/* record_outcome.lua */}
              <h2 className="guide-sub-heading" id="record-outcome" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                <code style={{ color: "#ff5cad", fontSize: 18 }}>record_outcome.lua</code> — Atomic Score Update
              </h2>
              <p>
                After every upstream response, the sidecar calls this script to atomically update the gateway's EMA, counters, and health score in one Redis round-trip:
              </p>
              <div style={{ background: "#0f0f12", border: "1px solid #27272a", borderRadius: 8, padding: "16px 20px", marginBottom: 28 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#71717a", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  internal/sidecar/routing/lua/record_outcome.lua
                </div>
                <GoCodeBlock>{`-- ============================================================
-- Record Gateway Outcome and Update Health Score
-- ============================================================
-- KEYS[1] = gateway metric HASH key: route:gw:{gateway_id}
-- ARGV[1] = status: "success" | "error" | "timeout"
-- ARGV[2] = latency_ms (integer)
-- ARGV[3] = alpha (EMA smoothing factor, e.g. "0.1")
-- ARGV[4] = weight_success  (e.g. "0.5")
-- ARGV[5] = weight_latency  (e.g. "0.3")
-- ARGV[6] = weight_timeout  (e.g. "0.2")
-- ARGV[7] = latency_baseline_ms (e.g. "200")
-- ============================================================

local key       = KEYS[1]
local status    = ARGV[1]
local latency   = tonumber(ARGV[2])
local alpha     = tonumber(ARGV[3])
local ws        = tonumber(ARGV[4])
local wl        = tonumber(ARGV[5])
local wt        = tonumber(ARGV[6])
local baseline  = tonumber(ARGV[7])

-- Read current metrics (default to healthy state for new gateways)
local data = redis.call('HMGET', key,
    'latency_ema_ms', 'total_requests', 'error_count', 'timeout_count')

local ema      = tonumber(data[1]) or latency  -- bootstrap with first observation
local total    = (tonumber(data[2]) or 0) + 1
local errors   = tonumber(data[3]) or 0
local timeouts = tonumber(data[4]) or 0

-- Update counters based on outcome
if status == 'error'   then errors   = errors   + 1 end
if status == 'timeout' then timeouts = timeouts + 1 end

-- Update EMA latency: new_ema = α × latency + (1-α) × prev_ema
ema = alpha * latency + (1 - alpha) * ema

-- Compute derived rates over total requests
local success_rate = (total - errors - timeouts) / total
local timeout_rate = timeouts / total

-- Compute normalized latency score (clamp to [0, 1])
local latency_score = math.max(0, math.min(1, 1 - ema / baseline))

-- Weighted health score
local health = ws * success_rate + wl * latency_score + wt * (1 - timeout_rate)
health = math.max(0, math.min(1, health))  -- clamp to [0, 1]

-- Write all updated metrics atomically
redis.call('HMSET', key,
    'latency_ema_ms', string.format("%.2f", ema),
    'total_requests', total,
    'error_count',    errors,
    'timeout_count',  timeouts,
    'health_score',   string.format("%.4f", health)
)

return {health, ema, total}`}</GoCodeBlock>
              </div>

              {/* ComputeScore in Go */}
              <h2 className="guide-sub-heading" id="compute-score" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                <code style={{ color: "#ff5cad", fontSize: 18 }}>ComputeScore()</code> in Go
              </h2>
              <p>
                The Go router reads each gateway's stored health score from Redis and uses it directly — no re-computation needed. The <code>ComputeScore</code> function is used only when the router needs to synthesize a score from raw data (e.g., during testing or before a gateway has accumulated enough history):
              </p>
              <div style={{ background: "#0f0f12", border: "1px solid #27272a", borderRadius: 8, padding: "16px 20px", marginBottom: 28 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#71717a", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  internal/sidecar/routing/router.go
                </div>
                <GoCodeBlock>{`package routing

import (
    "context"
    "sort"
    "strconv"
)

type Gateway struct {
    ID          string
    URL         string
    HealthScore float64
    LatencyEMA  float64
}

// SelectGateways fetches all registered gateways, reads their health scores
// from Redis, sorts by score descending, and returns the ordered list.
// The first element is the primary; the second is the fallback.
func (r *Router) SelectGateways(ctx context.Context) ([]Gateway, error) {
    // 1. Get all registered gateway IDs
    gwIDs, err := r.client.SMembers(ctx, "route:index").Result()
    if err != nil {
        return nil, err
    }

    gateways := make([]Gateway, 0, len(gwIDs))
    for _, id := range gwIDs {
        key := "route:gw:" + id
        data, err := r.client.HMGet(ctx, key,
            "health_score", "latency_ema_ms", "url").Result()
        if err != nil {
            continue // skip unreachable gateway metadata
        }

        score, _ := strconv.ParseFloat(fmt.Sprint(data[0]), 64)
        ema, _ := strconv.ParseFloat(fmt.Sprint(data[1]), 64)
        url := fmt.Sprint(data[2])

        // New gateways with no history start at score 1.0 (optimistic)
        if score == 0 {
            score = 1.0
        }

        gateways = append(gateways, Gateway{
            ID:          id,
            URL:         url,
            HealthScore: score,
            LatencyEMA:  ema,
        })
    }

    // Sort by health score descending (best gateway first)
    sort.Slice(gateways, func(i, j int) bool {
        return gateways[i].HealthScore > gateways[j].HealthScore
    })

    return gateways, nil
}`}</GoCodeBlock>
              </div>

              {/* Gateway Registration */}
              <h2 className="guide-sub-heading" id="registration" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                Gateway Registration
              </h2>
              <p>
                Gateways are registered via environment variables parsed at sidecar startup. The sidecar writes each gateway's URL and initial state to Redis on boot:
              </p>
              <div style={{ background: "#0f0f12", border: "1px solid #27272a", borderRadius: 8, padding: "16px 20px", marginBottom: 20 }}>
                <GoCodeBlock>{`# docker-compose.yml — sidecar gateway configuration
sidecar:
  environment:
    ENABLE_ROUTING: "true"
    GATEWAY_IDS: "alpha,beta,gamma"
    GATEWAY_ALPHA_URL: "http://gateway-sim-alpha:8081"
    GATEWAY_BETA_URL:  "http://gateway-sim-beta:8082"
    GATEWAY_GAMMA_URL: "http://gateway-sim-gamma:8083"
    ROUTING_EMA_ALPHA: "0.1"
    ROUTING_WEIGHT_SUCCESS: "0.5"
    ROUTING_WEIGHT_LATENCY: "0.3"
    ROUTING_WEIGHT_TIMEOUT: "0.2"
    ROUTING_LATENCY_BASELINE_MS: "200"
    ROUTING_REQUEST_TIMEOUT_MS: "3000"`}</GoCodeBlock>
              </div>

              {/* Routing Pipeline */}
              <h2 className="guide-sub-heading" id="pipeline" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                Routing Pipeline Integration
              </h2>
              <p>
                The intelligent router is an optional module that activates only after the rate limit check passes and <code>ENABLE_ROUTING=true</code> is set. It sits in the sidecar's forwarding phase:
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 0, marginBottom: 28 }}>
                {[
                  { step: "1", title: "Rate Limit Passed", detail: "The sidecar confirmed the request is allowed. Control passes to the router." },
                  { step: "2", title: "SelectGateways()", detail: "SMEMBERS route:index + HMGET per gateway → ordered list of gateways by score." },
                  { step: "3", title: "Forward to Primary", detail: "httputil.ReverseProxy forwards the request to gateways[0].URL with a ROUTING_REQUEST_TIMEOUT_MS deadline." },
                  { step: "4a", title: "Primary Succeeds → record_outcome.lua", detail: "Calls record_outcome.lua(status=success, latency_ms=N). Updates EMA and score. Returns response to client." },
                  { step: "4b", title: "Primary Fails → retry", detail: "On 5xx or timeout: record_outcome.lua(status=error|timeout). Immediately retry with gateways[1] (fallback)." },
                  { step: "5", title: "Fallback record_outcome.lua", detail: "Records the fallback outcome. If fallback also fails, return 502 Bad Gateway to the client." },
                ].map((item, i) => (
                  <div key={i} style={{ display: "flex", gap: 0, alignItems: "stretch" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 40 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: "50%",
                        background: item.step.includes("b") ? "rgba(219, 39, 119,0.15)" : "rgba(255,92,173,0.15)",
                        border: item.step.includes("b") ? "1px solid rgba(219, 39, 119,0.4)" : "1px solid rgba(255,92,173,0.4)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 10, fontWeight: 700,
                        color: item.step.includes("b") ? "#ec4899" : "#ff5cad",
                        flexShrink: 0, zIndex: 1
                      }}>{item.step}</div>
                      {i < 5 && <div style={{ width: 1, flex: 1, background: "rgba(255,92,173,0.15)", margin: "0 auto" }} />}
                    </div>
                    <div style={{ padding: "4px 0 20px 16px", flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#ffffff" }}>{item.title}</div>
                      <div style={{ fontSize: 13, color: "#71717a", lineHeight: 1.55, marginTop: 2 }}>{item.detail}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Failover Sequence */}
              <h2 className="guide-sub-heading" id="failover" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                Degradation &amp; Recovery Sequence
              </h2>
              <p>
                This sequence shows how the router dynamically shifts traffic from a degrading gateway (Alpha) to a healthy one (Beta) without any operator intervention:
              </p>
              <DocsMermaid chart={failoverSequenceDiagram} />

              <div style={{
                background: "rgba(192, 132, 252,0.05)", border: "1px solid rgba(192, 132, 252,0.2)",
                borderRadius: 8, padding: "14px 18px", fontSize: 13, lineHeight: 1.65, marginTop: 20
              }}>
                <strong style={{ color: "#c084fc" }}>Gateway Recovery:</strong> As Alpha recovers (errors stop, latency drops), its EMA improves with each successful request. The EMA decays toward the true latency at rate <code>α</code>. At default <code>α=0.1</code>, a gateway that had EMA=3000ms (timeout) needs roughly 45–50 successful fast requests before its score climbs back above 0.85. This prevents premature traffic restoration to a flapping gateway.
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

import DocsNavbar from "@/components/docs/DocsNavbar";
import DocsSidebar from "@/components/docs/DocsSidebar";
import DocsMermaid from "@/components/docs/DocsMermaid";
import GoCodeBlock from "@/components/docs/GoCodeBlock";

const pageTopics = [
  { label: "Concept & Purpose", href: "#concept" },
  { label: "Scoring Algorithm", href: "#scoring" },
  { label: "Lua Outcome Tracking", href: "#lua-tracking" },
  { label: "Failover Workflow", href: "#failover" },
];

const scoringFlowDiagram = `
flowchart TD
    Start(["Incoming Payment Request"])
    GetGateways["Read gateways metadata from Redis"]
    
    subgraph Scorer["ComputeScore(Gateway G)"]
        CBCheck{"Circuit Breaker\\nTripped?"}
        ScoreZero["Score = 0.001\\n(Fast-Fail/Skip)"]
        
        ReadEMA["Read Latency EMA\\n(Exponential Moving Average)"]
        ReadRates["Read Success & Timeout Rates"]
        
        CalcFormula["Score = (SuccessRate × Health) / (LatencyEMA × TimeoutRate)"]
    end
    
    ChooseMax["Route to Gateway with Highest Score"]
    SendReq["Forward Request to Gateway"]
    RecordRes["Call record_outcome.lua\\nUpdate latencies, success/fail counters"]
    
    Start --> GetGateways --> CBCheck
    CBCheck -->|"yes"| ScoreZero --> ChooseMax
    CBCheck -->|"no"| ReadEMA --> ReadRates --> CalcFormula --> ChooseMax
    ChooseMax --> SendReq --> RecordRes
    
    style Start fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style ChooseMax fill:#1e1e2e,stroke:#4ade80,color:#fff
    style RecordRes fill:#1e1e2e,stroke:#38bdf8,color:#fff
`;

export default function RLRoutingPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="concept">
              Intelligent Traffic Routing
            </h1>

            <div className="guide-body-text" style={{ marginTop: 24 }}>
              
              {/* Concept Section */}
              <p>
                In payment architectures (e.g. Juspay-style gateways), transactions are routed to different downstream providers (such as Stripe, Adyen, or Braintree) based on success rates, fees, and latency characteristics. If the primary payment provider is experiencing a latency spike or elevated failure rate, the router should dynamically pivot traffic to a healthy secondary provider.
              </p>
              <p style={{ marginTop: 12 }}>
                The sidecar proxy implements an <strong style={{ color: "#ff5cad" }}>Intelligent Routing Engine</strong>. It keeps track of live gateway health, failure counts, and latency averages, dynamically selecting the optimal gateway for each transaction.
              </p>

              {/* Scoring Algorithm */}
              <h2 className="guide-sub-heading" id="scoring" style={{ fontSize: 22, color: "#ffffff", marginTop: 36, marginBottom: 12 }}>
                Gateway Scoring Algorithm
              </h2>
              <p>
                The sidecar evaluates every configured gateway using a multi-dimensional scoring formula. A higher score represents a healthier gateway:
              </p>

              <DocsMermaid chart={scoringFlowDiagram} />

              <p style={{ marginTop: 16 }}>
                The core scoring calculation weighs three key dimensions:
              </p>
              <ul className="guide-bullets-list" style={{ marginTop: 10, marginBottom: 20 }}>
                <li><strong style={{ color: "#ff5cad" }}>Latency EMA:</strong> An Exponential Moving Average (EMA) of response times. Latency spikes decay the score exponentially, keeping the engine highly responsive to sudden degradation.</li>
                <li><strong style={{ color: "#ff5cad" }}>Failure Rate:</strong> Computed as a sliding window of HTTP 5xx responses and connection timeouts.</li>
                <li><strong style={{ color: "#ff5cad" }}>Circuit State:</strong> If a gateway's circuit breaker is open (tripped), its score is instantly forced to the absolute minimum (0.001) to short-circuit calls.</li>
              </ul>

              {/* Lua Outcome Tracking */}
              <h2 className="guide-sub-heading" id="lua-tracking" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                Lua Outcome Tracking (`record_outcome.lua`)
              </h2>
              <p>
                To avoid inconsistent states across multiple sidecar instances, all telemetry metrics (EMA latencies, success counts, timeout rates) are maintained inside a Redis HASH per gateway. Updates to these metrics are performed atomically using a single Lua script:
              </p>

              <div style={{ background: "#0f0f12", border: "1px solid #27272a", borderRadius: 8, padding: "16px 20px", marginBottom: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#71717a", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  internal/routing/lua/record_outcome.lua
                </div>
                <GoCodeBlock>{`-- KEYS[1] = route:gateway:{name}
-- ARGV[1] = outcome     ("success", "failure", "timeout")
-- ARGV[2] = latency_ms  (integer request duration)
-- ARGV[3] = alpha       (EMA weight factor, e.g., 0.1)

local outcome = ARGV[1]
local latency = tonumber(ARGV[2])
local alpha = tonumber(ARGV[3])

local data = redis.call('HMGET', KEYS[1], 
    'success_count', 'failure_count', 'timeout_count', 'latency_ema_ms'
)

local success = tonumber(data[1]) or 0
local failure = tonumber(data[2]) or 0
local timeout = tonumber(data[3]) or 0
local ema = tonumber(data[4]) or 100 -- default 100ms

-- 1. Update stats
if outcome == 'success' then
    success = success + 1
elseif outcome == 'failure' then
    failure = failure + 1
elseif outcome == 'timeout' then
    timeout = timeout + 1
end

-- 2. Compute Latency EMA: new_ema = alpha*latency + (1-alpha)*old_ema
local new_ema = alpha * latency + (1.0 - alpha) * ema

-- Write back atomically
redis.call('HMSET', KEYS[1],
    'success_count', success,
    'failure_count', failure,
    'timeout_count', timeout,
    'latency_ema_ms', math.floor(new_ema)
)

return {success, failure, timeout, math.floor(new_ema)}`}</GoCodeBlock>
              </div>

              {/* Failover Workflow */}
              <h2 className="guide-sub-heading" id="failover" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                Dynamic Failover Loop
              </h2>
              <p>
                When a payment request arrives:
              </p>
              <ol className="guide-bullets-list" style={{ marginTop: 10, marginBottom: 24, listStyleType: "decimal", paddingLeft: 20 }}>
                <li>The router computes the score for all configured gateways and sorts them.</li>
                <li>It attempts to dispatch the request to the highest-scoring gateway (primary).</li>
                <li>If the primary call fails due to a network connection failure or a gateway timeout, the router:
                  <ul style={{ paddingLeft: 20, marginTop: 4, listStyleType: "circle" }}>
                    <li>Calls <code>record_outcome.lua</code> flagging the gateway as <code>timeout</code> or <code>failure</code>.</li>
                    <li>Pivots instantly to the next highest-scoring gateway (secondary).</li>
                    <li>Executes the secondary call and returns the response, isolating the failure transparently from the user.</li>
                  </ul>
                </li>
              </ol>

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

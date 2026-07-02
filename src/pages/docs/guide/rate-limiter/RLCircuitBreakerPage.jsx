import DocsNavbar from "@/components/docs/DocsNavbar";
import DocsSidebar from "@/components/docs/DocsSidebar";
import DocsMermaid from "@/components/docs/DocsMermaid";
import GoCodeBlock from "@/components/docs/GoCodeBlock";

const pageTopics = [
  { label: "What Is a Circuit Breaker?", href: "#what-is" },
  { label: "State Machine", href: "#state-machine" },
  { label: "Redis-Backed State", href: "#redis-state" },
  { label: "allow.lua Script", href: "#allow-lua" },
  { label: "record.lua Script", href: "#record-lua" },
  { label: "Metric Dimensions", href: "#metrics" },
  { label: "Configuration", href: "#config" },
  { label: "Integration Points", href: "#integration" },
];

const stateMachineDiagram = `
stateDiagram-v2
    [*] --> Closed : Initial state
    
    Closed --> Open : failure_rate > threshold\\nOR consecutive_failures > limit\\nOR timeout_rate > threshold
    Closed --> Closed : success → counters updated
    
    Open --> HalfOpen : cooldown_ms elapsed\\n(time.Now - opened_at > OpenCooldownMs)
    Open --> Open : Reject all requests fast-fail
    
    HalfOpen --> Closed : probe_successes >= HalfOpenSuccessRequired
    HalfOpen --> Open : probe_failure → back to Open
    HalfOpen --> HalfOpen : probe_count < HalfOpenMaxProbes
`;

const allowLuaDiagram = `
flowchart TD
    Start(["allow.lua called\\nKEYS={cb:target}"])
    Read["HMGET key: state, opened_at, probe_count,\\nprobe_success, half_open_max, half_open_req"]
    
    StateCheck{"state?"}
    
    ClosedPath["state = 'closed'\\nreturn {1, 'closed', ...}\\nAllowed"]
    
    OpenCheck{"now - opened_at\\n> cooldown_ms?"}
    OpenReject["return {0, 'open', ...}\\nDenied"]
    
    TransitionHO["HSET key state half_open\\nprobe_count 0, probe_success 0\\nreturn {1, 'half_open', ...}\\nAllowed (first probe)"]
    
    HOCheck{"probe_count\\n< max_probes?"}
    HOIncrement["HINCRBY probe_count 1\\nreturn {1, 'half_open', ...}\\nAllowed (probe)"]
    HOFull["return {0, 'half_open', ...}\\nDenied (probes exhausted)"]
    
    Start --> Read --> StateCheck
    StateCheck -->|"closed"| ClosedPath
    StateCheck -->|"open"| OpenCheck
    StateCheck -->|"half_open"| HOCheck
    
    OpenCheck -->|"yes (cooldown elapsed)"| TransitionHO
    OpenCheck -->|"no"| OpenReject
    
    HOCheck -->|"yes"| HOIncrement
    HOCheck -->|"no"| HOFull

    style ClosedPath fill:#1e1e2e,stroke:#c084fc,color:#fff
    style TransitionHO fill:#1e1e2e,stroke:#c084fc,color:#fff
    style HOIncrement fill:#1e1e2e,stroke:#c084fc,color:#fff
    style OpenReject fill:#1e1e2e,stroke:#ec4899,color:#fff
    style HOFull fill:#1e1e2e,stroke:#ec4899,color:#fff
`;

const recordLuaDiagram = `
flowchart TD
    Start(["record.lua called\\nKEYS={cb:target}"])
    Load["HMGET key: state, failure_count, success_count,\\ntimeout_count, total_count, latency_ema_ms,\\nopened_at, probe_count, probe_success,\\nconsecutive_failures"]
    
    UpdateCounters["Update counters based on outcome:\\n+1 to success/failure/timeout/total\\nUpdate latency EMA:\\nnew_ema = alpha×latency + (1-alpha)×old_ema"]
    HalvingCheck{"total > 1000?"}
    HalveCounters["Halve all counters\\n(sliding-window approximation)"]
    
    StateCheck{"current state?"}
    
    ClosedEval["Compute rates:\\nfailure_rate = failures/total\\ntimeout_rate = timeouts/total"]
    ShouldTrip{"failure_rate > threshold\\nOR consecutive_failures > limit\\nOR timeout_rate > threshold\\nAND total >= min_samples?"}
    TripOpen["HSET state='open'\\nopened_at=now\\nreturn 'open'"]
    
    HalfOpenEval{"outcome == success?"}
    IncrSuccess["HINCRBY probe_success 1\\nEnough successes?"]
    EnoughSuccess{"probe_success >= required?"}
    CloseBreakerHO["HSET state='closed'\\nreset counters\\nreturn 'closed'"]
    TripOpenHO["HSET state='open'\\nreturn 'open'"]
    
    Start --> Load --> UpdateCounters --> HalvingCheck
    HalvingCheck -->|"yes"| HalveCounters --> StateCheck
    HalvingCheck -->|"no"| StateCheck
    
    StateCheck -->|"closed"| ClosedEval --> ShouldTrip
    ShouldTrip -->|"yes"| TripOpen
    ShouldTrip -->|"no, stay closed"| TripOpen
    
    StateCheck -->|"half_open"| HalfOpenEval
    HalfOpenEval -->|"success"| IncrSuccess --> EnoughSuccess
    HalfOpenEval -->|"failure/timeout"| TripOpenHO
    EnoughSuccess -->|"yes"| CloseBreakerHO
    EnoughSuccess -->|"no"| TripOpen

    style TripOpen fill:#1e1e2e,stroke:#ec4899,color:#fff
    style TripOpenHO fill:#1e1e2e,stroke:#ec4899,color:#fff
    style CloseBreakerHO fill:#1e1e2e,stroke:#c084fc,color:#fff
    style ClosedEval fill:#1e1e2e,stroke:#ff5cad,color:#fff
`;

export default function RLCircuitBreakerPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="what-is">
              Distributed Circuit Breaker
            </h1>

            <div className="guide-body-text" style={{ marginTop: 24 }}>

              {/* What is */}
              <h2 className="guide-sub-heading" id="what-is" style={{ fontSize: 22, color: "#ffffff", marginTop: 0, marginBottom: 12 }}>
                What Is a Circuit Breaker?
              </h2>
              <p>
                A circuit breaker is a fault-tolerance pattern that prevents a service from repeatedly calling a failing dependency. Instead of letting every request time out (consuming goroutines and connections), the circuit breaker <strong>short-circuits</strong> failed calls and returns immediately with an error.
              </p>
              <p style={{ marginTop: 12 }}>
                In this system, circuit breakers are used in two places:
              </p>
              <ul className="guide-bullets-list" style={{ marginBottom: 20 }}>
                <li><strong style={{ color: "#ff5cad" }}>Sidecar → Central Limiter:</strong> If the central limiter is consistently returning errors or timing out, the sidecar's circuit breaker trips and subsequent requests either fail-open or fail-closed immediately.</li>
                <li><strong style={{ color: "#ff5cad" }}>Router → Upstream Gateways:</strong> Each gateway has its own circuit breaker. If gateway-a is failing, the router skips it and tries gateway-b, recording the outcome.</li>
              </ul>

              <div style={{
                background: "rgba(255,92,173,0.06)",
                border: "1px solid rgba(255,92,173,0.2)",
                borderRadius: 8, padding: "14px 18px",
                fontSize: 13, lineHeight: 1.65, marginBottom: 28
              }}>
                <strong style={{ color: "#ff5cad" }}>What Makes This "Distributed":</strong> my circuit breaker state (state, failure_count, probe_count, etc.) is stored in Redis, not in process memory. This means multiple sidecar instances share the same circuit state — if one sidecar detects that gateway-a is failing, all sidecars see the circuit as Open within milliseconds.
              </div>

              {/* State Machine */}
              <h2 className="guide-sub-heading" id="state-machine" style={{ fontSize: 22, color: "#ffffff", marginTop: 36, marginBottom: 12 }}>
                The Three-State Machine
              </h2>
              <DocsMermaid chart={stateMachineDiagram} />

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, marginTop: 16, marginBottom: 28 }}>
                {[
                  {
                    state: "CLOSED",
                    color: "#c084fc",
                    desc: "Normal operation. All requests pass through. Failure counters accumulate. Trips to Open when thresholds are crossed.",
                    icon: ""
                  },
                  {
                    state: "OPEN",
                    color: "#f472b6",
                    desc: "All requests are fast-rejected without calling the dependency. Waits for cooldown_ms to elapse before attempting recovery.",
                    icon: ""
                  },
                  {
                    state: "HALF-OPEN",
                    color: "#c084fc",
                    desc: "Limited probe requests are allowed through. If enough succeed, transitions back to Closed. Any failure re-opens the circuit.",
                    icon: ""
                  },
                ].map(item => (
                  <div key={item.state} style={{
                    background: "#0f0f12",
                    border: `1px solid ${item.color}33`,
                    borderTop: `3px solid ${item.color}`,
                    borderRadius: 8, padding: "16px"
                  }}>
                    <div style={{ fontSize: 22, marginBottom: 6 }}>{item.icon}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: item.color, marginBottom: 8 }}>{item.state}</div>
                    <div style={{ fontSize: 12.5, color: "#a1a1aa", lineHeight: 1.6 }}>{item.desc}</div>
                  </div>
                ))}
              </div>

              {/* Redis-Backed State */}
              <h2 className="guide-sub-heading" id="redis-state" style={{ fontSize: 22, color: "#ffffff", marginTop: 36, marginBottom: 12 }}>
                Redis-Backed State
              </h2>
              <p>
                Each circuit breaker target (e.g., <code style={{ color: "#ff5cad" }}>gateway-a</code>, <code style={{ color: "#ff5cad" }}>central-limiter</code>) gets its own Redis HASH key:
              </p>

              <div style={{ background: "#0f0f12", border: "1px solid #27272a", borderRadius: 8, padding: "16px 20px", marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#71717a", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Redis Key: <code style={{ color: "#ff5cad" }}>cb:{"{target}"}</code> (HASH)
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", minWidth: "600px", borderCollapse: "collapse", fontSize: 12, fontFamily: "monospace" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #27272a" }}>
                        <th style={{ padding: "6px 10px", textAlign: "left", color: "#ff5cad", fontWeight: 600 }}>Field</th>
                        <th style={{ padding: "6px 10px", textAlign: "left", color: "#ff5cad", fontWeight: 600 }}>Type</th>
                        <th style={{ padding: "6px 10px", textAlign: "left", color: "#ff5cad", fontWeight: 600 }}>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ["state", "string", "'closed' | 'open' | 'half_open'"],
                        ["failure_count", "int64", "Total failures in current window"],
                        ["success_count", "int64", "Total successes in current window"],
                        ["timeout_count", "int64", "Requests that timed out"],
                        ["total_count", "int64", "Total requests (failure + success + timeout)"],
                        ["consecutive_failures", "int64", "Unbroken failure streak (resets on any success)"],
                        ["latency_ema_ms", "float64", "Exponential moving average of latency in ms"],
                        ["opened_at", "int64", "Unix milliseconds when circuit was last opened"],
                        ["probe_count", "int64", "Half-open: number of probes sent so far"],
                        ["probe_success", "int64", "Half-open: number of probe successes"],
                      ].map(([field, type, desc], i) => (
                        <tr key={i} style={{ borderBottom: "1px solid #18181b" }}>
                          <td style={{ padding: "6px 10px", color: "#c084fc" }}>{field}</td>
                          <td style={{ padding: "6px 10px", color: "#a78bfa" }}>{type}</td>
                          <td style={{ padding: "6px 10px", color: "#71717a" }}>{desc}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* allow.lua */}
              <h2 className="guide-sub-heading" id="allow-lua" style={{ fontSize: 22, color: "#ffffff", marginTop: 36, marginBottom: 12 }}>
                allow.lua — The Gate Keeper
              </h2>
              <p>
                <code style={{ color: "#ff5cad" }}>allow.lua</code> decides in one atomic operation whether a request should pass through. It checks the current state, handles the Open→HalfOpen transition based on cooldown elapsed time, and manages probe slot allocation.
              </p>
              <DocsMermaid chart={allowLuaDiagram} />

              <GoCodeBlock>{`-- KEYS[1] = cb:{target}
-- ARGV[1] = now_ms           (current time in milliseconds)
-- ARGV[2] = open_cooldown_ms (how long to stay open before trying half-open)
-- ARGV[3] = half_open_max    (max probe requests in half-open)

local key          = KEYS[1]
local now_ms       = tonumber(ARGV[1])
local cooldown_ms  = tonumber(ARGV[2])
local max_probes   = tonumber(ARGV[3])

local fields = redis.call('HMGET', key,
    'state', 'opened_at', 'probe_count', 'probe_success')

local state       = fields[1] or 'closed'
local opened_at   = tonumber(fields[2]) or 0
local probe_count = tonumber(fields[3]) or 0

if state == 'closed' then
    return {1, 'closed', 0, 0}   -- {allowed, state, probe_count, probe_success}
end

if state == 'open' then
    local elapsed = now_ms - opened_at
    if elapsed >= cooldown_ms then
        -- Transition to half-open — allow first probe
        redis.call('HMSET', key,
            'state', 'half_open',
            'probe_count', 1,
            'probe_success', 0)
        return {1, 'half_open', 1, 0}
    end
    return {0, 'open', 0, 0}   -- rejected
end

-- state == 'half_open'
if probe_count < max_probes then
    redis.call('HINCRBY', key, 'probe_count', 1)
    return {1, 'half_open', probe_count + 1, tonumber(fields[4]) or 0}
end
return {0, 'half_open', probe_count, tonumber(fields[4]) or 0}  -- probes full`}</GoCodeBlock>

              {/* record.lua */}
              <h2 className="guide-sub-heading" id="record-lua" style={{ fontSize: 22, color: "#ffffff", marginTop: 36, marginBottom: 12 }}>
                record.lua — The State Machine Driver
              </h2>
              <p>
                <code style={{ color: "#ff5cad" }}>record.lua</code> is called after every request completes. It updates counters, computes rates, updates the latency EMA, and performs state transitions atomically. This is where the bulk of the circuit breaker logic lives.
              </p>
              <DocsMermaid chart={recordLuaDiagram} />

              <div style={{
                background: "rgba(219, 39, 119,0.06)",
                border: "1px solid rgba(219, 39, 119,0.2)",
                borderRadius: 8, padding: "14px 18px",
                fontSize: 13, lineHeight: 1.65, marginBottom: 20
              }}>
                <strong style={{ color: "#f472b6" }}>Warning: Counter Halving Bug:</strong> The current implementation halves all counters when <code>total_count &gt; 1000</code>. However, this halving runs on <em>every</em> request above 1000, not just once per threshold crossing. After a few hundred more requests, all counters approach zero, which causes the circuit to remain closed even during sustained failure. This is a correctness bug that needs a <code>halved_at</code> guard timestamp.
              </div>

              {/* Metrics */}
              <h2 className="guide-sub-heading" id="metrics" style={{ fontSize: 22, color: "#ffffff", marginTop: 36, marginBottom: 12 }}>
                Trip Metric Dimensions
              </h2>
              <p>my circuit breaker can trip based on any combination of these independently configured thresholds:</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14, marginBottom: 28 }}>
                {[
                  { metric: "Failure Rate", env: "CB_FAILURE_RATE", default: "0.5 (50%)", desc: "Trip when failure_count/total_count exceeds this threshold, with at least min_samples total requests." },
                  { metric: "Consecutive Failures", env: "CB_CONSECUTIVE_FAILURES", default: "5", desc: "Trip immediately if this many failures occur in a row, even without hitting the min_samples threshold." },
                  { metric: "Timeout Rate", env: "CB_TIMEOUT_RATE", default: "0.3 (30%)", desc: "Trip when timeout_count/total_count exceeds this. Timeouts are classified separately from failures." },
                  { metric: "Minimum Samples", env: "CB_MIN_SAMPLES", default: "10", desc: "Don't trip on failure/timeout rates until at least this many requests have been seen. Prevents false-trips on startup." },
                  { metric: "Latency Spike", env: "CB_LATENCY_THRESHOLD_MS", default: "500ms", desc: "Requests slower than this are classified as OutcomeLatencySpike. Used by ClassifyHTTP() helper." },
                  { metric: "Open Cooldown", env: "CB_OPEN_COOLDOWN_MS", default: "30000 (30s)", desc: "How long the circuit stays Open before attempting a Half-Open recovery cycle." },
                  { metric: "Half-Open Max Probes", env: "CB_HALF_OPEN_MAX_PROBES", default: "3", desc: "Maximum number of probe requests to allow through in Half-Open state before making a decision." },
                  { metric: "Half-Open Required Successes", env: "CB_HALF_OPEN_SUCCESS_REQUIRED", default: "2", desc: "Number of successful probes required to close the circuit from Half-Open state." },
                ].map(item => (
                  <div key={item.metric} style={{ background: "#0f0f12", border: "1px solid #1e1e24", borderRadius: 8, padding: "14px 16px" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#ffffff", marginBottom: 4 }}>{item.metric}</div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
                      <code style={{ fontSize: 11, color: "#ff5cad" }}>{item.env}</code>
                      <span style={{ fontSize: 11, color: "#c084fc" }}>default: {item.default}</span>
                    </div>
                    <div style={{ fontSize: 12.5, color: "#71717a", lineHeight: 1.55 }}>{item.desc}</div>
                  </div>
                ))}
              </div>

              {/* EMA */}
              <h3 style={{ fontSize: 17, color: "#ffffff", marginBottom: 8 }}>Latency Exponential Moving Average (EMA)</h3>
              <p style={{ marginBottom: 12 }}>
                my circuit breaker tracks latency via an EMA rather than raw averages. This gives recent measurements more weight — a sudden spike in latency is reflected in the EMA within a few requests.
              </p>
              <GoCodeBlock>{`-- EMA update in record.lua
-- ARGV = alpha (e.g., 0.2 = recent measurements weighted 20%)
local alpha   = tonumber(ARGV[ema_alpha_idx])
local old_ema = tonumber(redis.call('HGET', key, 'latency_ema_ms')) or 0
local latency = tonumber(ARGV[latency_idx])  -- latency in ms for this request

-- new_ema = α × latency + (1-α) × old_ema
local new_ema = alpha * latency + (1 - alpha) * old_ema
redis.call('HSET', key, 'latency_ema_ms', new_ema)`}</GoCodeBlock>

              {/* Integration Points */}
              <h2 className="guide-sub-heading" id="integration" style={{ fontSize: 22, color: "#ffffff", marginTop: 36, marginBottom: 12 }}>
                Integration Points
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
                {[
                  { where: "routing/router.go — Forward()", detail: "Before each gateway attempt: breaker.Allow(ctx, gateway.ID). Records outcome after response: breaker.Record(ctx, gatewayID, ClassifyHTTP(err, statusCode, latency, threshold))." },
                  { where: "cmd/limiter/circuit.go — checkCircuit()", detail: "The limiter's own HTTP handler can optionally check a circuit breaker before processing quota requests. Useful for protecting downstream Redis from overload." },
                  { where: "cmd/sidecar/main.go — checkRateLimit()", detail: "Before calling the central limiter, the sidecar checks its own circuit breaker for the limiter endpoint. If the limiter circuit is Open, returns 503 or allows (based on FAIL_OPEN)." },
                  { where: "Admin API — /admin/circuit", detail: "GET /admin/circuit/{target} returns the full Snapshot. POST /admin/circuit/{target}/reset force-closes the circuit — used during incident recovery." },
                ].map((item, i) => (
                  <div key={i} style={{ background: "#0f0f12", border: "1px solid #1e1e24", borderRadius: 8, padding: "14px 18px" }}>
                    <code style={{ fontSize: 13, color: "#ff5cad" }}>{item.where}</code>
                    <div style={{ fontSize: 13, color: "#a1a1aa", lineHeight: 1.6, marginTop: 6 }}>{item.detail}</div>
                  </div>
                ))}
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

import React from "react";
import DocsMermaid from "@/features/docs/components/DocsMermaid";

export const routingPages = {
  "sidecar-architecture": {
    title: "Sidecar Architecture",
    topics: [
      { label: "Proxy Boundary & Interception", href: "#boundary" },
      { label: "Middleware Sequence", href: "#middleware" },
      { label: "OTel Tracing Integration", href: "#tracing" }
    ],
    content: (
      <div>
        <p>
          The sidecar proxy sits as a transparent network boundary in front of application instances, intercepting all inbound and outbound calls.
        </p>

        <h2 className="guide-sub-heading" id="boundary">Proxy Boundary & Interception</h2>
        <p>
          Running as a local sidecar (`cmd/sidecar`), the proxy intercepts HTTP requests on port `:9090` and performs rate checks, idempotency lookup, and upstream forwarding. By isolating proxy logic from the core application, it permits clean upgrades and prevents language lock-in.
        </p>

        <h2 className="guide-sub-heading" id="middleware">Middleware Sequence</h2>
        <p>
          Every request processed by the sidecar steps through a structured chain of middleware:
        </p>
        <DocsMermaid chart={`
flowchart TD
    In([Inbound Request]) --> Auth[1. Authentication & ID Extraction]
    Auth --> Idem{2. Idempotency Check}
    Idem -->|Replay Cached| Out([Client Return])
    Idem -->|Leased / New| Rate{3. Rate Limit Check}
    Rate -->|Denied / 429| DenCache[Denial Cache Write] --> Out
    Rate -->|Allowed / 200| Route[4. Intelligent Routing]
    Route --> Forward[5. Upstream HTTP Forward]
    Forward --> Complete[6. Complete Idempotency Lease] --> Out
    style In fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style Out fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style Idem fill:#1e1e2e,stroke:#ec4899,color:#fff
    style Rate fill:#1e1e2e,stroke:#ec4899,color:#fff
        `} />

        <h2 className="guide-sub-heading" id="tracing">OTel Tracing Integration</h2>
        <p>
          The sidecar initializes OpenTelemetry tracing using W3C propagation headers. It maps incoming spans, associates transaction IDs, and creates sub-spans tracking the rate checking round-trip, the routing selection step, and the upstream execution duration.
        </p>
      </div>
    )
  },

  "intelligent-routing": {
    title: "Intelligent Routing",
    topics: [
      { label: "Scoring Formula", href: "#scoring" },
      { label: "Selection Algorithm", href: "#selection" },
      { label: "Scale Boundaries", href: "#boundaries" }
    ],
    content: (
      <div>
        <p>
          To distribute load across payment processors or upstream API providers, the sidecar features an intelligent gateway selector.
        </p>

        <h2 className="guide-sub-heading" id="scoring">The Routing Scoring Formula</h2>
        <p>
          Gateways are ranked using a dynamic scoring function that incorporates static weights, latency EMAs, and error rates:
        </p>
        <div style={{
          background: "#111113",
          border: "1px solid #27272a",
          padding: "16px 20px",
          borderRadius: 8,
          margin: "16px 0",
          fontFamily: "monospace"
        }}>
          Score = Weight * LatencyFactor * HealthFactor * ErrorFactor
        </div>
        <p>
          Where:
        </p>
        <ul className="guide-bullets-list">
          <li><strong>Weight:</strong> Dynamic static weight assigned by operators (default 100).</li>
          <li><strong>LatencyFactor:</strong> Capped ratio: `TargetLatencyMs / LatencyEMA`. Higher latency degrades score.</li>
          <li><strong>HealthFactor:</strong> Health ratio: `HealthScore / 100.0` (computed in Redis from active probes).</li>
          <li><strong>ErrorFactor:</strong> Error penalty: `1.0 - (ErrorRate * ErrorPenalty)`.</li>
        </ul>

        <h2 className="guide-sub-heading" id="selection">Weighted Random Selection</h2>
        <p>
          The selector chooses a primary gateway using a weighted random spin. Summing scores of healthy gateways, it generates a random roll. This preserves distribution parity: healthy, fast gateways receive the majority of traffic, while slow or error-prone gateways are automatically deprioritized.
        </p>

        <h2 className="guide-sub-heading" id="boundaries">Scale Boundaries</h2>
        <p>
          Gateway states are ranked using an insertion sort since gateway pools are typically small (3-10 targets). Gateway parameters are persisted in Redis, ensuring all sidecar replicas route using synchronized health views.
        </p>
      </div>
    )
  },

  "gateway-health-and-failover": {
    title: "Gateway Health & Failover",
    topics: [
      { label: "Health Probing Lifecycle", href: "#probing" },
      { label: "Failover Execution Flow", href: "#failover" },
      { label: "Gateway Circuit Synchronization", href: "#circuit" }
    ],
    content: (
      <div>
        <p>
          This section details how the sidecar monitors gateway availability and executes automatic failovers during outages.
        </p>

        <h2 className="guide-sub-heading" id="probing">Health Probing Lifecycle</h2>
        <p>
          A background ticker (`StartHealthProbes`) in the router regularly scans all registered gateway configurations and queries their `/health` endpoints. Outbound latency is measured and success/failure results are written to Redis, updating the gateway's `HealthScore`.
        </p>

        <h2 className="guide-sub-heading" id="failover">Failover Execution Flow</h2>
        <p>
          If a gateway call fails:
        </p>
        <ol className="guide-bullets-list">
          <li>The sidecar intercepts the HTTP failure (e.g. `5xx` or network timeout).</li>
          <li>It writes the error outcome to Redis, updating the gateway's error metrics.</li>
          <li>It selects the next-highest ranking gateway from the failover list (`FailoverOrder`).</li>
          <li>It transparently proxies the request to the fallback gateway, injecting `X-Gateway-Failover: true` headers.</li>
          <li>If all gateways in the failover list fail, the sidecar returns a `502 Bad Gateway` error.</li>
        </ol>

        <h2 className="guide-sub-heading" id="circuit">Gateway Circuit Synchronization</h2>
        <p>
          Each gateway target is protected by the distributed circuit breaker. If a gateway experiences a sustained outage, its circuit transitions to `Open`, causing the router to immediately exclude it from selection, routing traffic elsewhere without waiting for connection timeouts.
        </p>
      </div>
    )
  }
};

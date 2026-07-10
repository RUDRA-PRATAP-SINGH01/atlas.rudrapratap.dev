import React from "react";

export const performancePages = {
  "benchmark-overview": {
    title: "Benchmark Overview",
    topics: [
      { label: "Environment & Hardware", href: "#environment" },
      { label: "Sustainable Criteria", href: "#criteria" }
    ],
    content: (
      <div>
        <p>
          This section details the performance baseline of the rate limiter, evaluated under constant-arrival workloads.
        </p>

        <h2 className="guide-sub-heading" id="environment">Environment & Hardware Specs</h2>
        <p>
          All performance metrics were gathered against a local Docker Compose topology running on the following hardware:
        </p>
        <ul className="guide-bullets-list">
          <li><strong>CPU:</strong> Intel Core i9-14900HX (24 cores / 32 threads).</li>
          <li><strong>RAM:</strong> 32 GB RAM.</li>
          <li><strong>System OS:</strong> Windows 11 Home.</li>
          <li><strong>Test Client:</strong> k6 1.7.1, configured for constant-arrival-rate scenarios.</li>
          <li><strong>Topology:</strong> Client &rarr; Sidecar (:9090) &rarr; Limiter (:8080) &rarr; Redis (:6379) &rarr; Backend (:8081).</li>
        </ul>

        <h2 className="guide-sub-heading" id="criteria">Sustainable Criteria</h2>
        <div style={{
          background: "rgba(59, 130, 246, 0.05)",
          border: "1px solid rgba(59, 130, 246, 0.2)",
          borderRadius: 8,
          padding: 16,
          marginTop: 16
        }}>
          <strong>Definition of Sustainable Load:</strong> A workload is considered sustainable if:
          <ul style={{ margin: "8px 0 0 0", paddingLeft: 16, fontSize: 13, color: "#93c5fd" }}>
            <li>The actual throughput stays within 15% of the target.</li>
            <li>The p99 latency is strictly under 100 ms.</li>
            <li>The non-429 error rate remains at 0%.</li>
          </ul>
        </div>
      </div>
    )
  },

  "throughput-and-saturation": {
    title: "Throughput & Saturation",
    topics: [
      { label: "Throughput Matrix", href: "#matrix" },
      { label: "The Saturation Knee", href: "#knee" }
    ],
    content: (
      <div>
        <p>
          This section details the limits where throughput scales linearly and where database congestion causes saturation.
        </p>

        <h2 className="guide-sub-heading" id="matrix">Throughput Performance Summary</h2>
        <div style={{ overflowX: "auto", margin: "20px 0" }}>
          <table className="guide-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #27272a", textAlign: "left" }}>
                <th style={{ padding: "12px 8px" }}>Workload</th>
                <th style={{ padding: "12px 8px" }}>Target RPS</th>
                <th style={{ padding: "12px 8px" }}>Actual RPS</th>
                <th style={{ padding: "12px 8px" }}>p99 Latency</th>
                <th style={{ padding: "12px 8px" }}>Result</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Direct Sliding Window</td>
                <td>1,000</td>
                <td>871</td>
                <td>8 ms</td>
                <td><span style={{ color: "#22c55e", fontWeight: "bold" }}>SUSTAINABLE</span></td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Sidecar Proxy e2e Path</td>
                <td>1,000</td>
                <td>872</td>
                <td>11 ms</td>
                <td><span style={{ color: "#22c55e", fontWeight: "bold" }}>SUSTAINABLE</span></td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Direct Sliding Window</td>
                <td>5,000</td>
                <td>285</td>
                <td>51 s</td>
                <td><span style={{ color: "#ef4444", fontWeight: "bold" }}>CONGESTED (Saturated)</span></td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Direct Token Bucket</td>
                <td>5,000</td>
                <td>4,161</td>
                <td>148 ms</td>
                <td><span style={{ color: "#eab308", fontWeight: "bold" }}>PEAK CAPACITY (p99 &gt; 100ms)</span></td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2 className="guide-sub-heading" id="knee">The Saturation Knee</h2>
        <p>
          The maximum sustainable capacity for sliding window logic is **872 RPS**. Beyond this, sorted set pruning (`ZREMRANGEBYSCORE`) and addition (`ZADD`) on Redis trigger database serialization queues, dropping actual throughput and causing p99 latencies to spike.
        </p>
        <p>
          Conversely, the token bucket algorithm achieves higher peak capacities, sustaining up to **4,161 RPS** at a p99 of **148 ms** due to the lower overhead of hash key writes compared to sorted sets.
        </p>
      </div>
    )
  },

  "latency-analysis": {
    title: "Latency Analysis",
    topics: [
      { label: "Sidecar Overhead", href: "#overhead" },
      { label: "Distribution curve", href: "#distribution" }
    ],
    content: (
      <div>
        <p>
          This section details how the sidecar proxy layer affects request latencies under sustainable load.
        </p>

        <h2 className="guide-sub-heading" id="overhead">Sidecar Proxy Overhead</h2>
        <p>
          To quantify the cost of transparent proxying, we run sequential tests at 1,000 target RPS, comparing direct limiter checks against sidecar proxied calls:
        </p>
        <div style={{ overflowX: "auto", margin: "20px 0" }}>
          <table className="guide-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #27272a", textAlign: "left" }}>
                <th style={{ padding: "12px 8px" }}>Execution Path</th>
                <th style={{ padding: "12px 8px" }}>p50 (ms)</th>
                <th style={{ padding: "12px 8px" }}>p95 (ms)</th>
                <th style={{ padding: "12px 8px" }}>p99 (ms)</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Direct Limiter /check</td>
                <td>1.13 ms</td>
                <td>3.14 ms</td>
                <td>7.98 ms</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Sidecar Proxy e2e</td>
                <td>4.86 ms</td>
                <td>8.21 ms</td>
                <td>11.21 ms</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Delta (Approx.)</td>
                <td>+3.73 ms</td>
                <td>+5.07 ms</td>
                <td>+3.23 ms</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          The sidecar proxy introduces a **~3.7 ms p50** latency penalty. This overhead is due to the additional network context swaps (HTTP parse and proxy routing) required at the edge layer.
        </p>
      </div>
    )
  },

  "failure-benchmarks": {
    title: "Failure Benchmarks",
    topics: [
      { label: "Measured Outage Latencies", href: "#failure-latency" },
      { label: "Circuit Fast-Failing", href: "#fast-fail" }
    ],
    content: (
      <div>
        <p>
          Measuring system performance during simulated outages guarantees that failure paths are bounded.
        </p>

        <h2 className="guide-sub-heading" id="failure-latency">Measured Outage Latency Budgets</h2>
        <p>
          Outages were simulated by pausing docker containers during active load tests. We observed the following latency responses:
        </p>
        <ul className="guide-bullets-list">
          <li><strong>Redis Master Outage:</strong> Call paths block until client socket timeouts expire, returning a `503` in **1003 ms**.</li>
          <li><strong>Limiter Pool Outage:</strong> Sidecar calls time out in **504 ms**, returning a `503`.</li>
          <li><strong>Open Circuit Breaker:</strong> Subsequent requests fail fast in **23 ms** at the sidecar, completely avoiding network calls.</li>
        </ul>

        <h2 className="guide-sub-heading" id="fast-fail">Circuit Fast-Failing Advantage</h2>
        <p>
          During database outages, fail-closed timeouts (1,000 ms) consume threads quickly, risking application crashes. The circuit breaker protects downstreams. Once tripped, it reduces error latencies from 1,000 ms to a fast-failing **23 ms**, preserving server thread availability.
        </p>
      </div>
    )
  },

  "concurrency-experiments": {
    title: "Concurrency Experiments",
    topics: [
      { label: "Denial Cache Hammer", href: "#denial" },
      { label: "Singleflight Collapsing", href: "#singleflight" }
    ],
    content: (
      <div>
        <p>
          This section details performance experiments validating how process-local optimizations protect core layers under heavy load.
        </p>

        <h2 className="guide-sub-heading" id="denial">Denial Cache Hammer</h2>
        <p>
          A single user key was hammered with a high concurrent volume (50 VUs, 30s duration).
        </p>
        <p>
          The experiment registered a throughput of **17,662 actual RPS**, with a p99 latency of **7.11 ms** and 0 errors (all requests correctly denied with `429`). The denial cache served **99.9%** of requests in memory, reducing Redis CPU load to near-zero.
        </p>

        <h2 className="guide-sub-heading" id="singleflight">Singleflight Collapsing</h2>
        <p>
          In concurrency unit tests (`TestSidecar_SingleflightCollapse`), 100 identical request threads checked a key simultaneously. The experiment verified that only **1 request** crossed the network to the Limiter service, while the other 99 shared the returned result, verifying client collapsing.
        </p>
      </div>
    )
  },

  "fifteen-minute-soak-test": {
    title: "15-Minute Soak Test",
    topics: [
      { label: "Soak Metrics", href: "#soak-metrics" },
      { label: "Stability Analysis", href: "#soak-stability" }
    ],
    content: (
      <div>
        <p>
          This section details soak test measurements tracking performance stability over a 15-minute window.
        </p>

        <h2 className="guide-sub-heading" id="soak-metrics">Soak Metrics Summary</h2>
        <div style={{ overflowX: "auto", margin: "20px 0" }}>
          <table className="guide-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #27272a", textAlign: "left" }}>
                <th style={{ padding: "12px 8px" }}>Metric</th>
                <th style={{ padding: "12px 8px" }}>Target</th>
                <th style={{ padding: "12px 8px" }}>Observed Value</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Target Rate</td>
                <td>300 RPS</td>
                <td>299.2 RPS</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Total Requests</td>
                <td>—</td>
                <td>269,269</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>p50 / p99 Latency</td>
                <td>—</td>
                <td>4.65 ms / 10.01 ms</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Max Spike</td>
                <td>—</td>
                <td>1,343 ms</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Non-429 Error Rate</td>
                <td>0%</td>
                <td>0%</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2 className="guide-sub-heading" id="soak-stability">Stability Analysis</h2>
        <p>
          The soak test demonstrated stable latencies with no cumulative memory growth or socket leaks. A single p99.9 latency spike of 1.3 seconds occurred during Docker GC sweeps, but recovery was immediate, indicating stable runtime health.
        </p>
      </div>
    )
  },

  "reproduce-the-results": {
    title: "Reproduce the Results",
    topics: [
      { label: "Deployment Steps", href: "#steps" },
      { label: "Script Index", href: "#scripts" }
    ],
    content: (
      <div>
        <p>
          Follow these instructions to reproduce the benchmarks on your local hardware.
        </p>

        <h2 className="guide-sub-heading" id="steps">Deployment Steps</h2>
        <ol className="guide-bullets-list" style={{ listStyleType: "decimal" }}>
          <li>
            Start the Docker Compose services in the background:
            <pre style={{ background: "#0e0e11", border: "1px solid #27272a", padding: "10px 14px", borderRadius: 6, fontSize: 12, marginTop: 6 }}>
              docker compose up -d
            </pre>
          </li>
          <li>
            Run the targeted benchmark suite:
            <pre style={{ background: "#0e0e11", border: "1px solid #27272a", padding: "10px 14px", borderRadius: 6, fontSize: 12, marginTop: 6 }}>
              powershell -ExecutionPolicy Bypass -File benchmarks/final/run-targeted-benchmarks.ps1
            </pre>
          </li>
          <li>
            Parse the raw k6 JSON stream to compile latency metrics:
            <pre style={{ background: "#0e0e11", border: "1px solid #27272a", padding: "10px 14px", borderRadius: 6, fontSize: 12, marginTop: 6 }}>
              python benchmarks/scripts/parse-k6-stream.py benchmarks/results/a1de9ec-final/raw/sidecar-e2e-1000-stream.json 70
            </pre>
          </li>
        </ol>

        <h2 className="guide-sub-heading" id="scripts">Script Index</h2>
        <ul className="guide-bullets-list">
          <li>`benchmarks/final/run-final-benchmarks.ps1`: Orchestrates all throughput, soak, and correctness tests sequentially.</li>
          <li>`benchmarks/parse-results.py`: Consolidates k6 json files into markdown tables.</li>
          <li>`benchmarks/graphs/generate-graphs.py`: Generates latency distribution curves using matplotlib.</li>
        </ul>
      </div>
    )
  }
};

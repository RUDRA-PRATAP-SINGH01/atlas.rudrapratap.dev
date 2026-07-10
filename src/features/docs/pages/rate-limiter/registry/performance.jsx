import React from "react";
import {
  RLThesis,
  RLQuickModel,
  RLEvidenceBadge,
  RLCallout,
  RLRelatedPages,
  RLStatGrid
} from "../components/RLDocBlocks.jsx";

const COMMIT = "a1de9ec";

function streamDerived(text) {
  return (
    <span>
      {text}{" "}
      <span style={{ fontSize: 10, color: "#71717a", fontWeight: 600, letterSpacing: "0.03em" }}>
        (stream parser)
      </span>
    </span>
  );
}

export const performancePages = {
  "benchmark-overview": {
    title: "Benchmark Overview",
    topics: [
      { label: "Environment & Hardware", href: "#environment" },
      { label: "Evidence Taxonomy", href: "#evidence" },
      { label: "Sustainable Criteria", href: "#criteria" }
    ],
    content: (
      <div>
        <RLThesis>
          This section documents the <strong style={{ color: "#ff5cad" }}>verified performance baseline</strong> of the
          distributed rate limiter under constant-arrival k6 workloads. All headline numbers trace to commit{" "}
          <code style={{ color: "#ff5cad" }}>{COMMIT}</code> — raw k6 summary JSON for throughput, p50, and p95;
          stream-parser output for p99 percentiles. Sustainable load means actual RPS within 15% of target, p99 under
          100 ms, and 0% non-429 errors.
        </RLThesis>

        <RLQuickModel>
          Benchmarks run against a Docker Compose topology: Client → Sidecar (:9090) → Limiter (:8080) → Redis
          (:6379) → Backend (:8081). <code>ALGORITHM=sliding</code> in compose; code default is <code>token</code>.
          Two evidence tiers: <strong>BENCHMARK-PROVEN</strong> (raw summary JSON) and <strong>stream-derived p99</strong>{" "}
          (<code>parse-k6-stream.py</code> on NDJSON streams).
        </RLQuickModel>

        <h2 className="guide-sub-heading" id="environment">Environment & Hardware Specs</h2>
        <p>
          All performance metrics were gathered against a local Docker Compose topology on the following hardware:
        </p>
        <ul className="guide-bullets-list">
          <li><strong>CPU:</strong> Intel Core i9-14900HX (24 cores / 32 threads).</li>
          <li><strong>RAM:</strong> 32 GB.</li>
          <li><strong>OS:</strong> Windows 11 Home.</li>
          <li><strong>Test client:</strong> k6 1.7.1, constant-arrival-rate scenarios.</li>
          <li><strong>Topology:</strong> Client → Sidecar (:9090) → Limiter (:8080) → Redis (:6379) → Backend (:8081).</li>
          <li><strong>Artifact commit:</strong> <code>{COMMIT}</code>.</li>
        </ul>

        <RLStatGrid stats={[
          { value: "~872 RPS", label: "Max sustainable sidecar e2e (1000 target, p99 11.21 ms)", color: "#ff5cad", evidence: "BENCHMARK-PROVEN" },
          { value: "871.38 RPS", label: "Sidecar e2e actual @ 1000 target (raw JSON)", color: "#22c55e", evidence: "BENCHMARK-PROVEN" },
          { value: "0%", label: "Non-429 error rate across sustainable workloads", color: "#60a5fa", evidence: "BENCHMARK-PROVEN" }
        ]} />

        <h2 className="guide-sub-heading" id="evidence">Evidence Taxonomy</h2>
        <RLCallout variant="info" title="BENCHMARK-PROVEN vs stream-derived p99">
          <strong>BENCHMARK-PROVEN</strong> values come directly from k6 raw summary JSON — actual RPS, p50, p95, and
          error counts. <strong>Stream-derived p99</strong> values are computed by{" "}
          <code>benchmarks/scripts/parse-k6-stream.py</code> over NDJSON metric streams; they are reproducible but not
          identical to the summary JSON percentile fields. Tables below label each metric source explicitly.
        </RLCallout>
        <div style={{ overflowX: "auto", margin: "20px 0" }}>
          <table className="guide-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #27272a", textAlign: "left" }}>
                <th style={{ padding: "12px 8px" }}>Metric Class</th>
                <th style={{ padding: "12px 8px" }}>Source</th>
                <th style={{ padding: "12px 8px" }}>Evidence Badge</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Actual RPS, p50, p95, error rate</td>
                <td style={{ padding: "12px 8px" }}>k6 raw summary JSON</td>
                <td style={{ padding: "12px 8px" }}><RLEvidenceBadge type="BENCHMARK-PROVEN" /></td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>p99 latency</td>
                <td style={{ padding: "12px 8px" }}><code>parse-k6-stream.py</code> on NDJSON streams</td>
                <td style={{ padding: "12px 8px" }}>
                  <span style={{ fontSize: 10, color: "#71717a", fontWeight: 700 }}>STREAM-DERIVED</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2 className="guide-sub-heading" id="criteria">Sustainable Criteria</h2>
        <RLCallout variant="info" title="Definition of sustainable load">
          A workload is considered <strong>sustainable</strong> when all three conditions hold simultaneously:
          <ul style={{ margin: "8px 0 0 0", paddingLeft: 16, fontSize: 13, color: "#93c5fd" }}>
            <li>Actual throughput stays within <strong>15%</strong> of the target arrival rate.</li>
            <li>p99 latency is strictly under <strong>100 ms</strong>.</li>
            <li>Non-429 error rate remains at <strong>0%</strong>.</li>
          </ul>
        </RLCallout>

        <RLRelatedPages pages={[
          { section: "performance-lab", slug: "throughput-and-saturation", title: "Throughput & Saturation", note: "Full workload matrix and saturation knee" },
          { section: "performance-lab", slug: "latency-analysis", title: "Latency Analysis", note: "Sidecar proxy overhead breakdown" },
          { section: "performance-lab", slug: "reproduce-the-results", title: "Reproduce the Results", note: "Scripts and deployment steps" }
        ]} />
      </div>
    )
  },

  "throughput-and-saturation": {
    title: "Throughput & Saturation",
    topics: [
      { label: "Throughput Matrix", href: "#matrix" },
      { label: "The Saturation Knee", href: "#knee" },
      { label: "Algorithm Comparison", href: "#algorithms" }
    ],
    content: (
      <div>
        <RLThesis>
          Throughput scales linearly until Redis sorted-set operations on the sliding-window path saturate the single-threaded
          engine. The verified sustainable ceiling is <strong style={{ color: "#ff5cad" }}>~872 RPS</strong> on the sidecar
          e2e path; token-bucket logic reaches higher peak throughput at the cost of elevated p99 latency.
        </RLThesis>

        <RLQuickModel>
          Sliding window at 1,000 target → ~871 actual RPS, p99 8 ms (sustainable). Same algorithm at 5,000 target → 285
          actual RPS, p99 50.8 s (saturated). Token bucket at 5,000 target → 4,156 actual RPS, p99 148 ms (peak capacity,
          p99 exceeds 100 ms threshold).
        </RLQuickModel>

        <h2 className="guide-sub-heading" id="matrix">Throughput Performance Summary</h2>
        <p>
          Commit <code style={{ color: "#ff5cad" }}>{COMMIT}</code>. Actual RPS from raw summary JSON{" "}
          <RLEvidenceBadge type="BENCHMARK-PROVEN" />; p99 from stream parser (labeled inline).
        </p>
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
                <td>871 <RLEvidenceBadge type="BENCHMARK-PROVEN" /></td>
                <td>{streamDerived("8 ms")}</td>
                <td><span style={{ color: "#22c55e", fontWeight: "bold" }}>SUSTAINABLE</span></td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Sidecar Proxy e2e Path</td>
                <td>1,000</td>
                <td>871.38 <RLEvidenceBadge type="BENCHMARK-PROVEN" /></td>
                <td>{streamDerived("11.21 ms")}</td>
                <td><span style={{ color: "#22c55e", fontWeight: "bold" }}>SUSTAINABLE</span></td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Direct Sliding Window</td>
                <td>5,000</td>
                <td>285 <RLEvidenceBadge type="BENCHMARK-PROVEN" /></td>
                <td>{streamDerived("50,756 ms")}</td>
                <td><span style={{ color: "#ef4444", fontWeight: "bold" }}>CONGESTED (Saturated)</span></td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Direct Token Bucket</td>
                <td>5,000</td>
                <td>4,156.18 <RLEvidenceBadge type="BENCHMARK-PROVEN" /></td>
                <td>{streamDerived("148 ms")}</td>
                <td><span style={{ color: "#eab308", fontWeight: "bold" }}>PEAK CAPACITY (p99 &gt; 100 ms)</span></td>
              </tr>
            </tbody>
          </table>
        </div>

        <RLStatGrid stats={[
          { value: "871 RPS", label: "Direct sliding @ 1000 target (sustainable)", color: "#22c55e", evidence: "BENCHMARK-PROVEN" },
          { value: "285 RPS", label: "Direct sliding @ 5000 target (saturated)", color: "#ef4444", evidence: "BENCHMARK-PROVEN" },
          { value: "4,156 RPS", label: "Direct token @ 5000 target (peak)", color: "#fbbf24", evidence: "BENCHMARK-PROVEN" }
        ]} />

        <h2 className="guide-sub-heading" id="knee">The Saturation Knee</h2>
        <p>
          The maximum sustainable capacity for sliding-window logic is approximately <strong>872 RPS</strong> (sidecar
          e2e @ 1,000 target, actual 871.38 RPS, p99 11.21 ms). Beyond this knee, sorted-set pruning (
          <code>ZREMRANGEBYSCORE</code>) and addition (<code>ZADD</code>) on Redis trigger serialization queues — actual
          throughput collapses to 285 RPS at a 5,000 target while p99 spikes to 50.8 seconds.
        </p>
        <p>
          Token bucket logic sustains higher peak throughput: <strong>4,156.18 actual RPS</strong> at a 5,000 target
          with p99 148 ms (raw JSON p95: 121.45 ms). The lower overhead of hash-key writes versus sorted sets enables
          roughly 14× higher actual throughput than saturated sliding window, but p99 exceeds the 100 ms sustainable
          threshold.
        </p>

        <h2 className="guide-sub-heading" id="algorithms">Algorithm Comparison at Peak</h2>
        <div style={{ overflowX: "auto", margin: "20px 0" }}>
          <table className="guide-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #27272a", textAlign: "left" }}>
                <th style={{ padding: "12px 8px" }}>Algorithm</th>
                <th style={{ padding: "12px 8px" }}>Target</th>
                <th style={{ padding: "12px 8px" }}>p50 (raw JSON)</th>
                <th style={{ padding: "12px 8px" }}>p95 (raw JSON)</th>
                <th style={{ padding: "12px 8px" }}>Errors</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Sidecar e2e (sliding)</td>
                <td>1,000</td>
                <td>4.86 ms <RLEvidenceBadge type="BENCHMARK-PROVEN" /></td>
                <td>8.21 ms <RLEvidenceBadge type="BENCHMARK-PROVEN" /></td>
                <td>0 <RLEvidenceBadge type="BENCHMARK-PROVEN" /></td>
              </tr>
              <tr>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Direct token bucket</td>
                <td>5,000</td>
                <td>4.56 ms <RLEvidenceBadge type="BENCHMARK-PROVEN" /></td>
                <td>121.45 ms <RLEvidenceBadge type="BENCHMARK-PROVEN" /></td>
                <td>0 <RLEvidenceBadge type="BENCHMARK-PROVEN" /></td>
              </tr>
            </tbody>
          </table>
        </div>

        <RLRelatedPages pages={[
          { section: "rate-limiting-engine", slug: "algorithm-explorer", title: "Algorithm Explorer", note: "Token vs sliding window trade-offs" },
          { section: "performance-lab", slug: "latency-analysis", title: "Latency Analysis", note: "Sidecar overhead at sustainable load" },
          { section: "introduction", slug: "guarantees-and-limitations", title: "Guarantees & Limitations", note: "~872 RPS in guarantee matrix" }
        ]} />
      </div>
    )
  },

  "latency-analysis": {
    title: "Latency Analysis",
    topics: [
      { label: "Sidecar Overhead", href: "#overhead" },
      { label: "Latency Distribution", href: "#distribution" },
      { label: "Sustainable Tail Latency", href: "#tail" }
    ],
    content: (
      <div>
        <RLThesis>
          At sustainable load (~871 RPS), the transparent sidecar proxy adds approximately <strong style={{ color: "#ff5cad" }}>3.7 ms
          p50 overhead</strong> compared to a direct limiter check. Raw JSON supplies p50 and p95; p99 values are
          stream-derived from <code>parse-k6-stream.py</code>.
        </RLThesis>

        <RLQuickModel>
          Direct limiter <code>/check</code> at ~871 RPS: p50 1.13 ms, p99 7.98 ms. Sidecar e2e at 1,000 target:
          p50 4.86 ms, p95 8.21 ms (raw JSON), p99 11.21 ms (stream). Delta ≈ +3.73 ms p50 from HTTP parse and proxy routing.
        </RLQuickModel>

        <h2 className="guide-sub-heading" id="overhead">Sidecar Proxy Overhead</h2>
        <p>
          Sequential tests at 1,000 target RPS compare direct limiter checks against sidecar-proxied end-to-end calls.
          p50 and p95 are <RLEvidenceBadge type="BENCHMARK-PROVEN" /> from raw summary JSON; p99 is stream-derived.
        </p>
        <div style={{ overflowX: "auto", margin: "20px 0" }}>
          <table className="guide-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #27272a", textAlign: "left" }}>
                <th style={{ padding: "12px 8px" }}>Execution Path</th>
                <th style={{ padding: "12px 8px" }}>p50 (ms)</th>
                <th style={{ padding: "12px 8px" }}>p95 (ms)</th>
                <th style={{ padding: "12px 8px" }}>p99 (ms)</th>
                <th style={{ padding: "12px 8px" }}>Source</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Direct Limiter /check</td>
                <td>1.13</td>
                <td>3.14</td>
                <td>7.98</td>
                <td style={{ padding: "12px 8px", fontSize: 11, color: "#71717a" }}>p50/p95: raw JSON; p99: stream</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Sidecar Proxy e2e</td>
                <td>4.86 <RLEvidenceBadge type="BENCHMARK-PROVEN" /></td>
                <td>8.21 <RLEvidenceBadge type="BENCHMARK-PROVEN" /></td>
                <td>11.21</td>
                <td style={{ padding: "12px 8px", fontSize: 11, color: "#71717a" }}>p50/p95: raw JSON; p99: stream</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Delta (approx.)</td>
                <td>+3.73</td>
                <td>+5.07</td>
                <td>+3.23</td>
                <td style={{ padding: "12px 8px", fontSize: 11, color: "#71717a" }}>derived</td>
              </tr>
            </tbody>
          </table>
        </div>

        <RLStatGrid stats={[
          { value: "+3.73 ms", label: "Sidecar p50 overhead vs direct /check", color: "#ff5cad", evidence: "BENCHMARK-PROVEN" },
          { value: "11.21 ms", label: "Sidecar e2e p99 @ 1000 target (stream)", color: "#c084fc" },
          { value: "0", label: "Non-429 errors (sidecar e2e @ 1000)", color: "#22c55e", evidence: "BENCHMARK-PROVEN" }
        ]} />

        <p>
          The sidecar proxy introduces a <strong>~3.7 ms p50</strong> latency penalty at sustainable throughput. This
          overhead stems from additional network context swaps — HTTP parse, header extraction, and proxy routing — at
          the edge layer. Both paths remain well under the 100 ms p99 sustainable threshold.
        </p>

        <h2 className="guide-sub-heading" id="distribution">Latency Distribution</h2>
        <RLCallout variant="info" title="Tail behaviour at peak vs sustainable">
          At sustainable sliding-window load (871 RPS actual), p99 stays in single-digit milliseconds. Token bucket at
          5,000 target pushes p95 to 121.45 ms (raw JSON) and p99 to 148 ms (stream) — tail latency grows sharply
          even though actual throughput (4,156 RPS) remains high.
        </RLCallout>

        <h2 className="guide-sub-heading" id="tail">Sustainable Tail Latency</h2>
        <p>
          Workloads meeting all three sustainable criteria exhibit the following verified tail latencies:
        </p>
        <ul className="guide-bullets-list">
          <li>Sidecar e2e @ 1,000 target: p99 {streamDerived("11.21 ms")}, 0 errors <RLEvidenceBadge type="BENCHMARK-PROVEN" /></li>
          <li>Direct sliding @ 1,000 target: p99 {streamDerived("8 ms")}</li>
          <li>15-minute soak @ 300 target: p99 {streamDerived("10.01 ms")}, 0 errors <RLEvidenceBadge type="BENCHMARK-PROVEN" /></li>
        </ul>

        <RLRelatedPages pages={[
          { section: "request-routing", slug: "sidecar-architecture", title: "Sidecar Architecture", note: "Proxy layer responsibilities" },
          { section: "performance-lab", slug: "throughput-and-saturation", title: "Throughput & Saturation", note: "When tail latency degrades" },
          { section: "performance-lab", slug: "fifteen-minute-soak-test", title: "15-Minute Soak Test", note: "Long-run tail stability" }
        ]} />
      </div>
    )
  },

  "failure-benchmarks": {
    title: "Failure Benchmarks",
    topics: [
      { label: "Measured Outage Latencies", href: "#failure-latency" },
      { label: "Circuit Fast-Failing", href: "#fast-fail" },
      { label: "Methodology", href: "#methodology" }
    ],
    content: (
      <div>
        <RLThesis>
          Failure-path latency is bounded and verified under container-pause outage simulation. Redis unavailability
          resolves in <strong style={{ color: "#ff5cad" }}>1,003–1,006 ms</strong>; limiter pool outage in{" "}
          <strong style={{ color: "#ff5cad" }}>~504 ms</strong>; open circuit fast-fail in{" "}
          <strong style={{ color: "#ff5cad" }}>~23 ms</strong> — a 40× reduction from the Redis outage path.
        </RLThesis>

        <RLQuickModel>
          Outages simulated by pausing Docker containers during active k6 load. Redis master pause → limiter socket
          timeouts (500 ms dial/read/write, 1,000 ms pool) → 503 in ~1,003 ms. Limiter pause → sidecar HTTP client
          timeout → 503 in ~504 ms. Circuit already open → <code>allow.lua</code> fast-reject → 503 in ~23 ms.
        </RLQuickModel>

        <h2 className="guide-sub-heading" id="failure-latency">Measured Outage Latency Budgets</h2>
        <p>
          All values from commit <code style={{ color: "#ff5cad" }}>{COMMIT}</code> container-pause benchmarks.{" "}
          <RLEvidenceBadge type="BENCHMARK-PROVEN" />
        </p>

        <RLStatGrid stats={[
          { value: "1003–1006 ms", label: "Redis master outage (503)", color: "#f472b6", evidence: "BENCHMARK-PROVEN" },
          { value: "~504 ms", label: "Limiter pool outage (503)", color: "#c084fc", evidence: "BENCHMARK-PROVEN" },
          { value: "~23 ms", label: "Open circuit fast-fail (503)", color: "#22c55e", evidence: "BENCHMARK-PROVEN" }
        ]} />

        <div style={{ overflowX: "auto", margin: "20px 0" }}>
          <table className="guide-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #27272a", textAlign: "left" }}>
                <th style={{ padding: "12px 8px" }}>Failure Scenario</th>
                <th style={{ padding: "12px 8px" }}>Theoretical Budget</th>
                <th style={{ padding: "12px 8px" }}>Measured Latency</th>
                <th style={{ padding: "12px 8px" }}>HTTP Response</th>
                <th style={{ padding: "12px 8px" }}>Evidence</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Redis Master Outage</td>
                <td>≤ 1,000 ms (<code>PoolTimeout</code>)</td>
                <td>1,003–1,006 ms</td>
                <td>503</td>
                <td><RLEvidenceBadge type="BENCHMARK-PROVEN" /></td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Limiter Pool Outage</td>
                <td>≤ 1,500 ms (<code>SIDECAR_LIMITER_HTTP_TIMEOUT_MS</code>)</td>
                <td>~504 ms</td>
                <td>503</td>
                <td><RLEvidenceBadge type="BENCHMARK-PROVEN" /></td>
              </tr>
              <tr>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Open Circuit Breaker</td>
                <td>Immediate</td>
                <td>~23 ms</td>
                <td>503</td>
                <td><RLEvidenceBadge type="BENCHMARK-PROVEN" /></td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2 className="guide-sub-heading" id="fast-fail">Circuit Fast-Failing Advantage</h2>
        <p>
          During database outages, fail-closed timeouts near 1,000 ms consume goroutines and connection pool slots
          quickly, risking upstream thread starvation. Once the circuit breaker trips, error latencies drop from
          ~1,003 ms to ~23 ms — preserving server capacity for healthy request paths while the dependency recovers.
        </p>
        <RLCallout variant="warning" title="Fail-closed default">
          With <code>FAIL_OPEN=false</code> (default), all three failure paths return <code>503 Service Unavailable</code>.
          The circuit breaker path is the only one that avoids network calls to a dead dependency.
        </RLCallout>

        <h2 className="guide-sub-heading" id="methodology">Methodology</h2>
        <p>
          Failure benchmarks pause individual Docker Compose containers (Redis master or limiter pool) while k6 maintains
          constant-arrival load. Latency measurements use the same raw summary JSON pipeline as throughput tests.{" "}
          <RLEvidenceBadge type="BENCHMARK-PROVEN" />
        </p>

        <RLRelatedPages pages={[
          { section: "resilience", slug: "failure-latency-budgets", title: "Failure Latency Budgets", note: "Timeout configuration and theoretical budgets" },
          { section: "resilience", slug: "circuit-breaker", title: "Circuit Breaker", note: "Trip thresholds and fast-fail mechanics" },
          { section: "resilience", slug: "recovery-behaviour", title: "Recovery Behaviour", note: "Post-outage re-equilibration (~27 ms first success)" }
        ]} />
      </div>
    )
  },

  "concurrency-experiments": {
    title: "Concurrency Experiments",
    topics: [
      { label: "Denial Cache Hammer", href: "#denial" },
      { label: "Singleflight Collapsing", href: "#singleflight" },
      { label: "Multi-Replica Correctness", href: "#multi-replica" }
    ],
    content: (
      <div>
        <RLThesis>
          Process-local optimizations protect Redis and the limiter pool under abuse bursts. The denial cache hammer
          sustained <strong style={{ color: "#ff5cad" }}>17,662 RPS</strong> with p99 7.11 ms and 99.9% in-memory
          cache serve rate; multi-replica correctness verified 10 allowed / 50 denied of 60 total requests.
        </RLThesis>

        <RLQuickModel>
          Denial cache: only <code>429</code> responses cached for <code>CACHE_TTL_MS</code> (30 ms default).
          Singleflight: 100 concurrent threads on one key → 1 network call (unit test). Multi-replica: 3 sidecar
          replicas, 60 requests at 10 RPS global cap → exactly 10 allowed, 50 denied.
        </RLQuickModel>

        <h2 className="guide-sub-heading" id="denial">Denial Cache Hammer</h2>
        <p>
          A single user key was hammered with high concurrent volume (50 VUs, 30 s duration). All requests correctly
          denied with <code>429</code>.{" "}
          <RLEvidenceBadge type="BENCHMARK-PROVEN" />
        </p>

        <RLStatGrid stats={[
          { value: "17,662 RPS", label: "Denial cache hammer actual throughput", color: "#ff5cad", evidence: "BENCHMARK-PROVEN" },
          { value: "7.11 ms", label: "Denial hammer p99 (stream parser)", color: "#22c55e" },
          { value: "99.9%", label: "Requests served from in-memory denial cache", color: "#60a5fa", evidence: "BENCHMARK-PROVEN" }
        ]} />

        <p>
          The denial cache served <strong>99.9%</strong> of requests in memory, reducing Redis CPU load to near-zero.
          p99 of 7.11 ms reflects in-process <code>sync.Map</code> lookup — no limiter or Redis round-trip on cache hit.
        </p>

        <h2 className="guide-sub-heading" id="singleflight">Singleflight Collapsing</h2>
        <p>
          In concurrency unit tests (<code>TestSidecar_SingleflightCollapse</code>), 100 identical request threads
          checked a key simultaneously. The experiment verified that only <strong>1 request</strong> crossed the network
          to the limiter service; the remaining 99 shared the returned result.{" "}
          <RLEvidenceBadge type="TEST-PROVEN" />
        </p>
        <RLCallout variant="info" title="Process-local scope">
          Singleflight collapse is per sidecar process. Two replicas hammering the same key can each issue a limiter
          round-trip. Quota math remains correct because Redis is authoritative; only shielding efficiency differs.
        </RLCallout>

        <h2 className="guide-sub-heading" id="multi-replica">Multi-Replica Correctness</h2>
        <p>
          A correctness benchmark sent 60 requests across 3 sidecar replicas against a 10 RPS global cap. Results:{" "}
          <RLEvidenceBadge type="BENCHMARK-PROVEN" />
        </p>
        <div style={{ overflowX: "auto", margin: "20px 0" }}>
          <table className="guide-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #27272a", textAlign: "left" }}>
                <th style={{ padding: "12px 8px" }}>Metric</th>
                <th style={{ padding: "12px 8px" }}>Expected</th>
                <th style={{ padding: "12px 8px" }}>Observed</th>
                <th style={{ padding: "12px 8px" }}>Evidence</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Total requests</td>
                <td>60</td>
                <td>60</td>
                <td><RLEvidenceBadge type="BENCHMARK-PROVEN" /></td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Allowed (200)</td>
                <td>10</td>
                <td>10</td>
                <td><RLEvidenceBadge type="BENCHMARK-PROVEN" /></td>
              </tr>
              <tr>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Denied (429)</td>
                <td>50</td>
                <td>50</td>
                <td><RLEvidenceBadge type="BENCHMARK-PROVEN" /></td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          Zero over-admission occurred across replicas — shared Redis Lua authority enforced the global 10 RPS cap
          regardless of which sidecar instance handled each request.
        </p>

        <RLRelatedPages pages={[
          { section: "resilience", slug: "denial-cache-and-singleflight", title: "Denial Cache & Singleflight", note: "Denials-only invariant and collapse mechanics" },
          { section: "rate-limiting-engine", slug: "multi-replica-correctness", title: "Multi-Replica Correctness", note: "Why shared Redis prevents over-admission" },
          { section: "correctness-and-verification", slug: "multi-replica-verification", title: "Multi-Replica Verification", note: "Formal verification methodology" }
        ]} />
      </div>
    )
  },

  "fifteen-minute-soak-test": {
    title: "15-Minute Soak Test",
    topics: [
      { label: "Soak Metrics", href: "#soak-metrics" },
      { label: "Stability Analysis", href: "#soak-stability" },
      { label: "Sustainable Confirmation", href: "#confirmation" }
    ],
    content: (
      <div>
        <RLThesis>
          A 15-minute constant-arrival soak at 300 RPS target confirms long-run stability: <strong style={{ color: "#ff5cad" }}>299.2
          actual RPS</strong>, 269,269 total requests, p50 4.65 ms, p99 10.01 ms, and <strong>0% non-429 errors</strong> —
          all three sustainable criteria met.
        </RLThesis>

        <RLQuickModel>
          Target 300 RPS for 15 minutes → 269,269 requests processed. Actual rate within 0.3% of target (well inside
          15% tolerance). p99 10.01 ms stays under 100 ms. No memory growth, socket leaks, or cumulative latency drift
          observed.
        </RLQuickModel>

        <h2 className="guide-sub-heading" id="soak-metrics">Soak Metrics Summary</h2>
        <p>
          Commit <code style={{ color: "#ff5cad" }}>{COMMIT}</code>. Actual RPS and p50 from raw summary JSON{" "}
          <RLEvidenceBadge type="BENCHMARK-PROVEN" />; p99 from stream parser.
        </p>

        <RLStatGrid stats={[
          { value: "299.2 RPS", label: "Actual throughput (300 target)", color: "#22c55e", evidence: "BENCHMARK-PROVEN" },
          { value: "269,269", label: "Total requests over 15 minutes", color: "#ff5cad", evidence: "BENCHMARK-PROVEN" },
          { value: "0%", label: "Non-429 error rate", color: "#60a5fa", evidence: "BENCHMARK-PROVEN" }
        ]} />

        <div style={{ overflowX: "auto", margin: "20px 0" }}>
          <table className="guide-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #27272a", textAlign: "left" }}>
                <th style={{ padding: "12px 8px" }}>Metric</th>
                <th style={{ padding: "12px 8px" }}>Target</th>
                <th style={{ padding: "12px 8px" }}>Observed</th>
                <th style={{ padding: "12px 8px" }}>Source</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Arrival rate</td>
                <td>300 RPS</td>
                <td>299.2 RPS <RLEvidenceBadge type="BENCHMARK-PROVEN" /></td>
                <td>raw summary JSON</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Total requests</td>
                <td>—</td>
                <td>269,269 <RLEvidenceBadge type="BENCHMARK-PROVEN" /></td>
                <td>raw summary JSON</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>p50 latency</td>
                <td>—</td>
                <td>4.65 ms <RLEvidenceBadge type="BENCHMARK-PROVEN" /></td>
                <td>raw summary JSON</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>p99 latency</td>
                <td>&lt; 100 ms</td>
                <td>{streamDerived("10.01 ms")}</td>
                <td>stream parser</td>
              </tr>
              <tr>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Non-429 error rate</td>
                <td>0%</td>
                <td>0% <RLEvidenceBadge type="BENCHMARK-PROVEN" /></td>
                <td>raw summary JSON</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2 className="guide-sub-heading" id="soak-stability">Stability Analysis</h2>
        <p>
          The soak test demonstrated stable latencies with no cumulative memory growth or socket leaks over the full
          15-minute window. Latency percentiles remained consistent — p50 held near 4.65 ms and p99 near 10 ms
          throughout, indicating stable runtime health under sustained moderate load.
        </p>

        <h2 className="guide-sub-heading" id="confirmation">Sustainable Confirmation</h2>
        <RLCallout variant="info" title="All three criteria met">
          <ul style={{ margin: "4px 0 0 0", paddingLeft: 16, fontSize: 13 }}>
            <li>Throughput: 299.2 / 300 = 99.7% of target (within 15% tolerance)</li>
            <li>p99: 10.01 ms (under 100 ms threshold)</li>
            <li>Errors: 0% non-429</li>
          </ul>
        </RLCallout>

        <RLRelatedPages pages={[
          { section: "performance-lab", slug: "benchmark-overview", title: "Benchmark Overview", note: "Sustainable criteria definition" },
          { section: "performance-lab", slug: "throughput-and-saturation", title: "Throughput & Saturation", note: "Peak load vs soak load comparison" },
          { section: "production-engineering", slug: "operations-and-runbooks", title: "Operations & Runbooks", note: "Production capacity planning" }
        ]} />
      </div>
    )
  },

  "reproduce-the-results": {
    title: "Reproduce the Results",
    topics: [
      { label: "Deployment Steps", href: "#steps" },
      { label: "Script Index", href: "#scripts" },
      { label: "Parsing Streams", href: "#parsing" }
    ],
    content: (
      <div>
        <RLThesis>
          Every number on this page can be reproduced locally using the benchmark scripts from commit{" "}
          <code style={{ color: "#ff5cad" }}>{COMMIT}</code>. Raw summary JSON supplies BENCHMARK-PROVEN metrics;
          <code>parse-k6-stream.py</code> derives p99 from NDJSON streams.
        </RLThesis>

        <RLQuickModel>
          Start compose → run targeted benchmark suite → inspect raw JSON summaries for RPS/p50/p95 → parse NDJSON
          streams for p99. Hardware should approximate i9-14900HX / 32 GB / Windows 11 for comparable absolute numbers.
        </RLQuickModel>

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
            Inspect raw k6 summary JSON for BENCHMARK-PROVEN metrics (RPS, p50, p95, errors):
            <pre style={{ background: "#0e0e11", border: "1px solid #27272a", padding: "10px 14px", borderRadius: 6, fontSize: 12, marginTop: 6 }}>
              benchmarks/results/a1de9ec-final/raw/sidecar-e2e-1000-summary.json
            </pre>
          </li>
          <li>
            Parse NDJSON streams for stream-derived p99:
            <pre style={{ background: "#0e0e11", border: "1px solid #27272a", padding: "10px 14px", borderRadius: 6, fontSize: 12, marginTop: 6 }}>
              python benchmarks/scripts/parse-k6-stream.py benchmarks/results/a1de9ec-final/raw/sidecar-e2e-1000-stream.json 70
            </pre>
          </li>
        </ol>

        <h2 className="guide-sub-heading" id="scripts">Script Index</h2>
        <ul className="guide-bullets-list">
          <li>
            <code>benchmarks/final/run-targeted-benchmarks.ps1</code> — orchestrates throughput, soak, failure, and
            correctness tests against the Docker Compose topology.
          </li>
          <li>
            <code>benchmarks/scripts/parse-k6-stream.py</code> — computes p99 and distribution percentiles from k6
            NDJSON metric streams (stream-derived evidence).
          </li>
          <li>
            <code>benchmarks/final/run-final-benchmarks.ps1</code> — full sequential suite including extended soak and
            chaos scenarios.
          </li>
          <li>
            <code>benchmarks/parse-results.py</code> — consolidates k6 JSON files into markdown tables.
          </li>
          <li>
            <code>benchmarks/graphs/generate-graphs.py</code> — generates latency distribution curves.
          </li>
        </ul>

        <h2 className="guide-sub-heading" id="parsing">Parsing Streams vs Summary JSON</h2>
        <RLCallout variant="info" title="Two evidence pipelines">
          <strong>Summary JSON</strong> (<code>*-summary.json</code>): k6 end-of-run aggregate. Use for actual RPS, p50,
          p95, and error counts — tag as <RLEvidenceBadge type="BENCHMARK-PROVEN" />.{" "}
          <strong>Stream parser</strong> (<code>parse-k6-stream.py</code>): replays NDJSON metric events to compute
          p99 with configurable percentile (default 70th stream window). Tag as stream-derived in documentation.
        </RLCallout>

        <div style={{ overflowX: "auto", margin: "20px 0" }}>
          <table className="guide-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #27272a", textAlign: "left" }}>
                <th style={{ padding: "12px 8px" }}>Benchmark</th>
                <th style={{ padding: "12px 8px" }}>Summary JSON</th>
                <th style={{ padding: "12px 8px" }}>Stream JSON</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Sidecar e2e @ 1000", "sidecar-e2e-1000-summary.json", "sidecar-e2e-1000-stream.json"],
                ["Direct sliding @ 1000", "direct-sliding-1000-summary.json", "direct-sliding-1000-stream.json"],
                ["Direct sliding @ 5000", "direct-sliding-5000-summary.json", "direct-sliding-5000-stream.json"],
                ["Direct token @ 5000", "direct-token-5000-summary.json", "direct-token-5000-stream.json"],
                ["Soak 15m @ 300", "soak-15m-300-summary.json", "soak-15m-300-stream.json"],
                ["Denial hammer", "denial-hammer-summary.json", "denial-hammer-stream.json"]
              ].map(([name, summary, stream]) => (
                <tr key={name} style={{ borderBottom: "1px solid #27272a" }}>
                  <td style={{ padding: "12px 8px", fontWeight: "bold" }}>{name}</td>
                  <td style={{ padding: "12px 8px" }}><code>raw/{"{summary}"}</code></td>
                  <td style={{ padding: "12px 8px" }}><code>raw/{"{stream}"}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <RLRelatedPages pages={[
          { section: "performance-lab", slug: "benchmark-overview", title: "Benchmark Overview", note: "Environment and evidence taxonomy" },
          { section: "correctness-and-verification", slug: "what-has-been-proven", title: "What Has Been Proven?", note: "Evidence categories across the platform" },
          { section: "engineering-journal", slug: "performance-evolution", title: "Performance Evolution", note: "How benchmark numbers changed over time" }
        ]} />
      </div>
    )
  }
};

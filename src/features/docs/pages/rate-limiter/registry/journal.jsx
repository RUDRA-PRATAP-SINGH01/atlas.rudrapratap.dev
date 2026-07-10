import React from "react";

export const journalPages = {
  "major-design-decisions": {
    title: "Major Design Decisions",
    topics: [
      { label: "Why Sidecars?", href: "#sidecar" },
      { label: "Why Lua Scripting?", href: "#lua" },
      { label: "Why Version Invalidation?", href: "#versioning" }
    ],
    content: (
      <div>
        <p>
          This engineering journal reviews the primary design choices and architectural trade-offs accepted during development.
        </p>

        <h2 className="guide-sub-heading" id="sidecar">Decision 1: Edge Sidecar Proxies</h2>
        <p>
          We chose a transparent sidecar architecture to separate rate enforcement from core application logic. While this introduces a latency penalty (~+3.7 ms p50), it allows language-agnostic integration and keeps codebases clean of coordination libraries.
        </p>

        <h2 className="guide-sub-heading" id="lua">Decision 2: Atomic Lua Execution</h2>
        <p>
          Alternative designs, like using distributed locks to coordinate token bucket balances, added significant latency and complex failure states. Executing transaction check-and-act operations inside Redis Lua scripts guarantees atomicity while keeping operations fast.
        </p>

        <h2 className="guide-sub-heading" id="versioning">Decision 3: Monotonic Generation Versioning</h2>
        <p>
          We rejected Redis Pub/Sub for config invalidation due to missed-message risks during network cuts. Instead, we use a version generation counter, version checking cached overrides on every request. This ensures consistency without Pub/Sub failure risks.
        </p>
      </div>
    )
  },

  "bugs-found-through-audits": {
    title: "Bugs Found Through Audits",
    topics: [
      { label: "Overlap Race Condition", href: "#race-bug" },
      { label: "Idempotency Hash Mismatch", href: "#idem-bug" }
    ],
    content: (
      <div>
        <p>
          This section reviews core bugs identified and resolved during testing.
        </p>

        <h2 className="guide-sub-heading" id="race-bug">Bug 1: Overlap Race Condition during Outages</h2>
        <p>
          <strong>Symptom:</strong> Under Redis outage recovery, concurrent requests sometimes bypassed the circuit breaker, resulting in double-admissions.
        </p>
        <p>
          <strong>Root Cause:</strong> The check-then-set transition in the circuit breaker allowed multiple requests to evaluate state concurrently when the circuit transitioned to half-open, exceeding probe limits.
        </p>
        <p>
          <strong>Fix:</strong> Shifted health checking logic into atomic Lua scripts (`allow.lua`), ensuring probe bounds are strictly enforced.
        </p>

        <h2 className="guide-sub-heading" id="idem-bug">Bug 2: Idempotency Key Re-play Hijacking</h2>
        <p>
          <strong>Symptom:</strong> Replaying an idempotency request with a different body sometimes returned the cached response of the original key.
        </p>
        <p>
          <strong>Root Cause:</strong> The system validated key existence but failed to check body signatures, exposing it to collisions.
        </p>
        <p>
          <strong>Fix:</strong> The claim script now calculates and stores request body hashes, returning a mismatch error if the retried body diverges.
        </p>
      </div>
    )
  },

  "performance-evolution": {
    title: "Performance Evolution",
    topics: [
      { label: "Initial Prototypes", href: "#proto" },
      { label: "Optimization Steps", href: "#opts" }
    ],
    content: (
      <div>
        <p>
          This section details how performance was optimized from initial prototypes to current benchmarks.
        </p>

        <h2 className="guide-sub-heading" id="proto">Initial Prototype Baseline</h2>
        <p>
          Early prototype iterations used full Redis commands for read-check-write sequences. Under heavy load, this pattern generated extensive race conditions, resulting in severe over-admission and high latency (p99 &gt; 250 ms at 200 target RPS).
        </p>

        <h2 className="guide-sub-heading" id="opts">Key Optimization Steps</h2>
        <ul className="guide-bullets-list">
          <li><strong>Moving Logic to Lua:</strong> Shifting checks to atomic Lua scripts eliminated races, reducing p99 latency to &lt; 10 ms at 500 target RPS.</li>
          <li><strong>Script Caching:</strong> Implementing `EVALSHA` reduced network utilization, lowering bandwidth requirements.</li>
          <li><strong>Denial Caching:</strong> Offloading denied checks in memory protected Redis from being hammered during bursts, keeping overall latency stable.</li>
        </ul>
      </div>
    )
  },

  "what-i-would-change-at-10x-scale": {
    title: "What I Would Change at 10× Scale",
    topics: [
      { label: "Cluster Routing", href: "#routing" },
      { label: "Decentralized Token Refills", href: "#refills" },
      { label: "Batching Updates", href: "#batching" }
    ],
    content: (
      <div>
        <p>
          Scaling this rate limiter to handle 10,000+ RPS would require resolving key design limitations.
        </p>

        <h2 className="guide-sub-heading" id="routing">Redis Cluster Sharding via Hash Rings</h2>
        <p>
          To scale past a single Redis master, we would need to shard user keys across a cluster using consistent hashing rings, routing keys directly to designated master nodes.
        </p>

        <h2 className="guide-sub-heading" id="refills">Decentralized Token Refills</h2>
        <p>
          Rather than coordinating every request with a database master, sidecar replicas could acquire token slices (e.g., 50 tokens at a time) from the central cluster. The proxies could then enforce these quotas locally, syncing usage statistics asynchronously and reducing master connection volume.
        </p>

        <h2 className="guide-sub-heading" id="batching">Batching Updates</h2>
        <p>
          Under peak loads, sidecars could batch usage increments over 50-100 ms windows before flushing updates to Redis, trading real-time consistency for substantial throughput gains.
        </p>
      </div>
    )
  }
};

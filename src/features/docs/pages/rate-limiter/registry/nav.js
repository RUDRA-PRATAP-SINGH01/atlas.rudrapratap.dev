/**
 * Light navigation metadata for Rate Limiter docs.
 * Page bodies live in section modules and are lazy-loaded by slug/section.
 */

export const canonicalNavigationOrder = [
  { section: "introduction", label: "INTRODUCTION", slug: "start-here" },
  { section: "introduction", label: "INTRODUCTION", slug: "the-problem" },
  { section: "introduction", label: "INTRODUCTION", slug: "guarantees-and-limitations" },
  { section: "introduction", label: "INTRODUCTION", slug: "five-minute-technical-tour" },

  { section: "architecture", label: "ARCHITECTURE", slug: "system-at-a-glance" },
  { section: "architecture", label: "ARCHITECTURE", slug: "anatomy-of-a-request" },
  { section: "architecture", label: "ARCHITECTURE", slug: "why-this-architecture" },
  { section: "architecture", label: "ARCHITECTURE", slug: "distributed-state-model" },
  { section: "architecture", label: "ARCHITECTURE", slug: "system-invariants" },
  { section: "architecture", label: "ARCHITECTURE", slug: "engineering-trade-offs" },

  { section: "rate-limiting-engine", label: "RATE LIMITING ENGINE", slug: "algorithm-explorer" },
  { section: "rate-limiting-engine", label: "RATE LIMITING ENGINE", slug: "redis-lua-atomicity" },
  { section: "rate-limiting-engine", label: "RATE LIMITING ENGINE", slug: "hierarchical-quotas" },
  { section: "rate-limiting-engine", label: "RATE LIMITING ENGINE", slug: "multi-replica-correctness" },
  { section: "rate-limiting-engine", label: "RATE LIMITING ENGINE", slug: "configuration-overrides" },

  { section: "resilience", label: "RESILIENCE", slug: "failure-model" },
  { section: "resilience", label: "RESILIENCE", slug: "circuit-breaker" },
  { section: "resilience", label: "RESILIENCE", slug: "idempotency" },
  { section: "resilience", label: "RESILIENCE", slug: "denial-cache-and-singleflight" },
  { section: "resilience", label: "RESILIENCE", slug: "failure-latency-budgets" },
  { section: "resilience", label: "RESILIENCE", slug: "recovery-behaviour" },

  { section: "request-routing", label: "REQUEST ROUTING", slug: "sidecar-architecture" },
  { section: "request-routing", label: "REQUEST ROUTING", slug: "intelligent-routing" },
  { section: "request-routing", label: "REQUEST ROUTING", slug: "gateway-health-and-failover" },

  { section: "observability", label: "OBSERVABILITY", slug: "overview" },
  { section: "observability", label: "OBSERVABILITY", slug: "distributed-tracing" },
  { section: "observability", label: "OBSERVABILITY", slug: "structured-logging" },
  { section: "observability", label: "OBSERVABILITY", slug: "metrics-and-prometheus" },
  { section: "observability", label: "OBSERVABILITY", slug: "grafana-dashboard" },
  { section: "observability", label: "OBSERVABILITY", slug: "incident-correlation" },

  { section: "performance-lab", label: "PERFORMANCE LAB", slug: "benchmark-overview" },
  { section: "performance-lab", label: "PERFORMANCE LAB", slug: "throughput-and-saturation" },
  { section: "performance-lab", label: "PERFORMANCE LAB", slug: "latency-analysis" },
  { section: "performance-lab", label: "PERFORMANCE LAB", slug: "failure-benchmarks" },
  { section: "performance-lab", label: "PERFORMANCE LAB", slug: "concurrency-experiments" },
  { section: "performance-lab", label: "PERFORMANCE LAB", slug: "fifteen-minute-soak-test" },
  { section: "performance-lab", label: "PERFORMANCE LAB", slug: "reproduce-the-results" },

  { section: "production-engineering", label: "PRODUCTION ENGINEERING", slug: "deployment-topology" },
  { section: "production-engineering", label: "PRODUCTION ENGINEERING", slug: "redis-and-sentinel-ha" },
  { section: "production-engineering", label: "PRODUCTION ENGINEERING", slug: "configuration-reference" },
  { section: "production-engineering", label: "PRODUCTION ENGINEERING", slug: "health-and-readiness" },
  { section: "production-engineering", label: "PRODUCTION ENGINEERING", slug: "graceful-shutdown" },
  { section: "production-engineering", label: "PRODUCTION ENGINEERING", slug: "security-model" },
  { section: "production-engineering", label: "PRODUCTION ENGINEERING", slug: "operations-and-runbooks" },

  { section: "correctness-and-verification", label: "CORRECTNESS & VERIFICATION", slug: "what-has-been-proven" },
  { section: "correctness-and-verification", label: "CORRECTNESS & VERIFICATION", slug: "test-strategy" },
  { section: "correctness-and-verification", label: "CORRECTNESS & VERIFICATION", slug: "concurrency-and-race-safety" },
  { section: "correctness-and-verification", label: "CORRECTNESS & VERIFICATION", slug: "chaos-engineering" },
  { section: "correctness-and-verification", label: "CORRECTNESS & VERIFICATION", slug: "multi-replica-verification" },
  { section: "correctness-and-verification", label: "CORRECTNESS & VERIFICATION", slug: "known-limitations" },

  { section: "engineering-journal", label: "ENGINEERING JOURNAL", slug: "major-design-decisions" },
  { section: "engineering-journal", label: "ENGINEERING JOURNAL", slug: "bugs-found-through-audits" },
  { section: "engineering-journal", label: "ENGINEERING JOURNAL", slug: "performance-evolution" },
  { section: "engineering-journal", label: "ENGINEERING JOURNAL", slug: "what-i-would-change-at-10x-scale" },
];

const SECTION_LABELS = {
  introduction: "INTRODUCTION",
  architecture: "ARCHITECTURE",
  "rate-limiting-engine": "RATE LIMITING ENGINE",
  resilience: "RESILIENCE",
  "request-routing": "REQUEST ROUTING",
  observability: "OBSERVABILITY",
  "performance-lab": "PERFORMANCE LAB",
  "production-engineering": "PRODUCTION ENGINEERING",
  "correctness-and-verification": "CORRECTNESS & VERIFICATION",
  "engineering-journal": "ENGINEERING JOURNAL",
};

/** Maps URL section id → dynamic import of that section's page map. */
export const sectionLoaders = {
  introduction: () => import("./introduction").then((m) => m.introductionPages),
  architecture: () => import("./architecture").then((m) => m.architecturePages),
  "rate-limiting-engine": () => import("./engine").then((m) => m.enginePages),
  resilience: () => import("./resilience").then((m) => m.resiliencePages),
  "request-routing": () => import("./routing").then((m) => m.routingPages),
  observability: () => import("./observability").then((m) => m.observabilityPages),
  "performance-lab": () => import("./performance").then((m) => m.performancePages),
  "production-engineering": () => import("./production").then((m) => m.productionPages),
  "correctness-and-verification": () => import("./verification").then((m) => m.verificationPages),
  "engineering-journal": () => import("./journal").then((m) => m.journalPages),
};

const slugToNav = Object.fromEntries(canonicalNavigationOrder.map((item) => [item.slug, item]));

export function getNavBySlug(slug) {
  return slugToNav[slug] || null;
}

export function getSectionInfoBySlug(slug) {
  const nav = slugToNav[slug];
  if (!nav) return null;
  return { id: nav.section, label: SECTION_LABELS[nav.section] || nav.label };
}

export function getPageHref(navItem) {
  return `/docs/distributed-rate-limiter/${navItem.section}/${navItem.slug}`;
}

/** Titles for prev/next without loading page bodies. */
export const pageTitles = {
  "start-here": "Start Here",
  "the-problem": "The Problem",
  "guarantees-and-limitations": "Guarantees & Limitations",
  "five-minute-technical-tour": "5-Minute Technical Tour",
  "system-at-a-glance": "System at a Glance",
  "anatomy-of-a-request": "Anatomy of a Request",
  "why-this-architecture": "Why This Architecture?",
  "distributed-state-model": "Distributed State Model",
  "system-invariants": "System Invariants",
  "engineering-trade-offs": "Engineering Trade-offs",
  "algorithm-explorer": "Algorithm Explorer",
  "redis-lua-atomicity": "Redis + Lua Atomicity",
  "hierarchical-quotas": "Hierarchical Quotas",
  "multi-replica-correctness": "Multi-Replica Correctness",
  "configuration-overrides": "Configuration Overrides",
  "failure-model": "Failure Model",
  "circuit-breaker": "Circuit Breaker",
  idempotency: "Idempotency",
  "denial-cache-and-singleflight": "Denial Cache & Singleflight",
  "failure-latency-budgets": "Failure Latency Budgets",
  "recovery-behaviour": "Recovery Behaviour",
  "sidecar-architecture": "Sidecar Architecture",
  "intelligent-routing": "Intelligent Routing",
  "gateway-health-and-failover": "Gateway Health & Failover",
  overview: "Overview",
  "distributed-tracing": "Distributed Tracing",
  "structured-logging": "Structured Logging",
  "metrics-and-prometheus": "Metrics & Prometheus",
  "grafana-dashboard": "Grafana Dashboard",
  "incident-correlation": "Incident Correlation",
  "benchmark-overview": "Benchmark Overview",
  "throughput-and-saturation": "Throughput & Saturation",
  "latency-analysis": "Latency Analysis",
  "failure-benchmarks": "Failure Benchmarks",
  "concurrency-experiments": "Concurrency Experiments",
  "fifteen-minute-soak-test": "15-Minute Soak Test",
  "reproduce-the-results": "Reproduce the Results",
  "deployment-topology": "Deployment Topology",
  "redis-and-sentinel-ha": "Redis & Sentinel HA",
  "configuration-reference": "Configuration Reference",
  "health-and-readiness": "Health & Readiness",
  "graceful-shutdown": "Graceful Shutdown",
  "security-model": "Security Model",
  "operations-and-runbooks": "Operations & Runbooks",
  "what-has-been-proven": "What Has Been Proven?",
  "test-strategy": "Test Strategy",
  "concurrency-and-race-safety": "Concurrency & Race Safety",
  "chaos-engineering": "Chaos Engineering",
  "multi-replica-verification": "Multi-Replica Verification",
  "known-limitations": "Known Limitations",
  "major-design-decisions": "Major Design Decisions",
  "bugs-found-through-audits": "Bugs Found Through Audits",
  "performance-evolution": "Performance Evolution",
  "what-i-would-change-at-10x-scale": "What I Would Change at 10× Scale",
};

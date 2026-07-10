import { introductionPages } from "./introduction";
import { architecturePages } from "./architecture";
import { enginePages } from "./engine";
import { resiliencePages } from "./resilience";
import { routingPages } from "./routing";
import { observabilityPages } from "./observability";
import { performancePages } from "./performance";
import { productionPages } from "./production";
import { verificationPages } from "./verification";
import { journalPages } from "./journal";

export const rateLimiterRegistry = {
  ...introductionPages,
  ...architecturePages,
  ...enginePages,
  ...resiliencePages,
  ...routingPages,
  ...observabilityPages,
  ...performancePages,
  ...productionPages,
  ...verificationPages,
  ...journalPages
};

// Help map slug to the correct section for back/forward navigation and metadata
export const getSectionInfoBySlug = (slug) => {
  if (slug in introductionPages) return { id: "introduction", label: "INTRODUCTION" };
  if (slug in architecturePages) return { id: "architecture", label: "ARCHITECTURE" };
  if (slug in enginePages) return { id: "rate-limiting-engine", label: "RATE LIMITING ENGINE" };
  if (slug in resiliencePages) return { id: "resilience", label: "RESILIENCE" };
  if (slug in routingPages) return { id: "request-routing", label: "REQUEST ROUTING" };
  if (slug in observabilityPages) return { id: "observability", label: "OBSERVABILITY" };
  if (slug in performancePages) return { id: "performance-lab", label: "PERFORMANCE LAB" };
  if (slug in productionPages) return { id: "production-engineering", label: "PRODUCTION ENGINEERING" };
  if (slug in verificationPages) return { id: "correctness-and-verification", label: "CORRECTNESS & VERIFICATION" };
  if (slug in journalPages) return { id: "engineering-journal", label: "ENGINEERING JOURNAL" };
  return null;
};

// Order of sections and their slug paths for sidebar construction and next/prev page calculations
export const canonicalNavigationOrder = [
  // INTRODUCTION
  { section: "introduction", label: "INTRODUCTION", slug: "start-here" },
  { section: "introduction", label: "INTRODUCTION", slug: "the-problem" },
  { section: "introduction", label: "INTRODUCTION", slug: "guarantees-and-limitations" },
  { section: "introduction", label: "INTRODUCTION", slug: "five-minute-technical-tour" },

  // ARCHITECTURE
  { section: "architecture", label: "ARCHITECTURE", slug: "system-at-a-glance" },
  { section: "architecture", label: "ARCHITECTURE", slug: "anatomy-of-a-request" },
  { section: "architecture", label: "ARCHITECTURE", slug: "why-this-architecture" },
  { section: "architecture", label: "ARCHITECTURE", slug: "distributed-state-model" },
  { section: "architecture", label: "ARCHITECTURE", slug: "system-invariants" },
  { section: "architecture", label: "ARCHITECTURE", slug: "engineering-trade-offs" },

  // RATE LIMITING ENGINE
  { section: "rate-limiting-engine", label: "RATE LIMITING ENGINE", slug: "algorithm-explorer" },
  { section: "rate-limiting-engine", label: "RATE LIMITING ENGINE", slug: "redis-lua-atomicity" },
  { section: "rate-limiting-engine", label: "RATE LIMITING ENGINE", slug: "hierarchical-quotas" },
  { section: "rate-limiting-engine", label: "RATE LIMITING ENGINE", slug: "multi-replica-correctness" },
  { section: "rate-limiting-engine", label: "RATE LIMITING ENGINE", slug: "configuration-overrides" },

  // RESILIENCE
  { section: "resilience", label: "RESILIENCE", slug: "failure-model" },
  { section: "resilience", label: "RESILIENCE", slug: "circuit-breaker" },
  { section: "resilience", label: "RESILIENCE", slug: "idempotency" },
  { section: "resilience", label: "RESILIENCE", slug: "denial-cache-and-singleflight" },
  { section: "resilience", label: "RESILIENCE", slug: "failure-latency-budgets" },
  { section: "resilience", label: "RESILIENCE", slug: "recovery-behaviour" },

  // REQUEST ROUTING
  { section: "request-routing", label: "REQUEST ROUTING", slug: "sidecar-architecture" },
  { section: "request-routing", label: "REQUEST ROUTING", slug: "intelligent-routing" },
  { section: "request-routing", label: "REQUEST ROUTING", slug: "gateway-health-and-failover" },

  // OBSERVABILITY
  { section: "observability", label: "OBSERVABILITY", slug: "overview" },
  { section: "observability", label: "OBSERVABILITY", slug: "distributed-tracing" },
  { section: "observability", label: "OBSERVABILITY", slug: "structured-logging" },
  { section: "observability", label: "OBSERVABILITY", slug: "metrics-and-prometheus" },
  { section: "observability", label: "OBSERVABILITY", slug: "grafana-dashboard" },
  { section: "observability", label: "OBSERVABILITY", slug: "incident-correlation" },

  // PERFORMANCE LAB
  { section: "performance-lab", label: "PERFORMANCE LAB", slug: "benchmark-overview" },
  { section: "performance-lab", label: "PERFORMANCE LAB", slug: "throughput-and-saturation" },
  { section: "performance-lab", label: "PERFORMANCE LAB", slug: "latency-analysis" },
  { section: "performance-lab", label: "PERFORMANCE LAB", slug: "failure-benchmarks" },
  { section: "performance-lab", label: "PERFORMANCE LAB", slug: "concurrency-experiments" },
  { section: "performance-lab", label: "PERFORMANCE LAB", slug: "fifteen-minute-soak-test" },
  { section: "performance-lab", label: "PERFORMANCE LAB", slug: "reproduce-the-results" },

  // PRODUCTION ENGINEERING
  { section: "production-engineering", label: "PRODUCTION ENGINEERING", slug: "deployment-topology" },
  { section: "production-engineering", label: "PRODUCTION ENGINEERING", slug: "redis-and-sentinel-ha" },
  { section: "production-engineering", label: "PRODUCTION ENGINEERING", slug: "configuration-reference" },
  { section: "production-engineering", label: "PRODUCTION ENGINEERING", slug: "health-and-readiness" },
  { section: "production-engineering", label: "PRODUCTION ENGINEERING", slug: "graceful-shutdown" },
  { section: "production-engineering", label: "PRODUCTION ENGINEERING", slug: "security-model" },
  { section: "production-engineering", label: "PRODUCTION ENGINEERING", slug: "operations-and-runbooks" },

  // CORRECTNESS & VERIFICATION
  { section: "correctness-and-verification", label: "CORRECTNESS & VERIFICATION", slug: "what-has-been-proven" },
  { section: "correctness-and-verification", label: "CORRECTNESS & VERIFICATION", slug: "test-strategy" },
  { section: "correctness-and-verification", label: "CORRECTNESS & VERIFICATION", slug: "concurrency-and-race-safety" },
  { section: "correctness-and-verification", label: "CORRECTNESS & VERIFICATION", slug: "chaos-engineering" },
  { section: "correctness-and-verification", label: "CORRECTNESS & VERIFICATION", slug: "multi-replica-verification" },
  { section: "correctness-and-verification", label: "CORRECTNESS & VERIFICATION", slug: "known-limitations" },

  // ENGINEERING JOURNAL
  { section: "engineering-journal", label: "ENGINEERING JOURNAL", slug: "major-design-decisions" },
  { section: "engineering-journal", label: "ENGINEERING JOURNAL", slug: "bugs-found-through-audits" },
  { section: "engineering-journal", label: "ENGINEERING JOURNAL", slug: "performance-evolution" },
  { section: "engineering-journal", label: "ENGINEERING JOURNAL", slug: "what-i-would-change-at-10x-scale" }
];

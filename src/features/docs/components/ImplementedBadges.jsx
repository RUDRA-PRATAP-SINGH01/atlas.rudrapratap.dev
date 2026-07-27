import React from "react";

const PEBBLEDB_IMPLEMENTED_FEATURES = [
  "WAL",
  "SSTables",
  "Bloom Filters",
  "Background Flush",
  "Compaction",
  "Snapshot Isolation",
  "Merge Iterator",
  "Crash Recovery",
  "Manifest",
  "Block Cache",
  "Memtable",
  "SkipList",
];

const RATELIMITER_IMPLEMENTED_FEATURES = [
  "Sidecar Proxy",
  "Central Limiter Pool",
  "Atomic Lua Scripts",
  "Sliding Window Engine",
  "Token Bucket Engine",
  "Hierarchical Limits",
  "Idempotency Replay",
  "Denial Offload Cache",
  "Singleflight Deduplication",
  "Circuit Breaker",
  "Dynamic Overrides",
  "Prometheus Metrics",
  "Jaeger Tracing",
  "Redis Sentinel HA",
];

export default function ImplementedBadges({
  project = "pebbledb",
  title,
  showBoth = false,
  compact = false,
}) {
  if (showBoth) {
    return (
      <div className="arch-implemented-both-container">
        <ImplementedBadges project="pebbledb" compact={compact} />
        <ImplementedBadges project="rate-limiter" compact={compact} />
      </div>
    );
  }

  const isPebble = project === "pebbledb";
  const features = isPebble ? PEBBLEDB_IMPLEMENTED_FEATURES : RATELIMITER_IMPLEMENTED_FEATURES;
  const defaultTitle = isPebble
    ? "PebbleDB Implemented Subsystems & Features"
    : "Rate Limiter Implemented Subsystems & Features";
  const badgeClass = isPebble ? "arch-implemented-badge--pebbledb" : "arch-implemented-badge--ratelimiter";
  const accentColor = isPebble ? "#ff5cad" : "#38bdf8";

  return (
    <div className={`arch-implemented-badges-container${compact ? " arch-implemented-badges-container--compact" : ""}`}>
      <div className="arch-implemented-badges-header">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              backgroundColor: accentColor,
              boxShadow: `0 0 8px ${accentColor}`,
            }}
          />
          <h4 className="arch-implemented-badges-title" style={{ color: accentColor }}>
            {title || defaultTitle}
          </h4>
        </div>
        <span className="arch-implemented-badges-count">{features.length} Components</span>
      </div>
      <div className="arch-implemented-badges-grid">
        {features.map((feature, idx) => (
          <span key={idx} className={`arch-implemented-badge ${badgeClass}`}>
            {feature}
          </span>
        ))}
      </div>
    </div>
  );
}

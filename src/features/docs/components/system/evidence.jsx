import React from "react";

const TYPE_TO_CLASS = {
  source: "docs-evidence-badge--source",
  "SOURCE-PROVEN": "docs-evidence-badge--source",
  test: "docs-evidence-badge--test",
  "TEST-PROVEN": "docs-evidence-badge--test",
  runtime: "docs-evidence-badge--runtime",
  "RUNTIME-PROVEN": "docs-evidence-badge--runtime",
  benchmark: "docs-evidence-badge--benchmark",
  "BENCHMARK-PROVEN": "docs-evidence-badge--benchmark",
  limitation: "docs-evidence-badge--limitation",
  "DOCUMENTED LIMITATION": "docs-evidence-badge--documented",
  documented: "docs-evidence-badge--documented",
  partial: "docs-evidence-badge--partial",
  "PARTIALLY VERIFIED": "docs-evidence-badge--partial",
  future: "docs-evidence-badge--future",
  "FUTURE DESIGN": "docs-evidence-badge--future",
  valid: "docs-evidence-badge--valid",
  "VALID DESIGN": "docs-evidence-badge--valid",
  "not-verified": "docs-evidence-badge--not-verified",
  "NOT VERIFIED": "docs-evidence-badge--not-verified",
};

const TYPE_TO_LABEL = {
  source: "SOURCE-PROVEN",
  test: "TEST-PROVEN",
  runtime: "RUNTIME-PROVEN",
  benchmark: "BENCHMARK-PROVEN",
  limitation: "DOCUMENTED LIMITATION",
  documented: "DOCUMENTED LIMITATION",
  partial: "PARTIALLY VERIFIED",
  future: "FUTURE DESIGN",
  valid: "VALID DESIGN",
  "not-verified": "NOT VERIFIED",
};

function normalizeEvidenceKey(type) {
  if (!type) return "SOURCE-PROVEN";
  return type;
}

export function EvidenceBadge({ type = "SOURCE-PROVEN", children, className = "" }) {
  const key = normalizeEvidenceKey(type);
  const cls = TYPE_TO_CLASS[key] || TYPE_TO_CLASS["SOURCE-PROVEN"];
  const label = children || TYPE_TO_LABEL[key] || key;
  return (
    <span className={`docs-evidence-badge ${cls} ${className}`.trim()} role="status">
      {label}
    </span>
  );
}

const EVIDENCE_ALIAS = {
  source: "SOURCE-PROVEN",
  test: "TEST-PROVEN",
  runtime: "RUNTIME-PROVEN",
  benchmark: "BENCHMARK-PROVEN",
};

export function EvidencePanel({ claim, evidence = [], limitation, children }) {
  const badges = evidence.map((e) => EVIDENCE_ALIAS[e] || e);
  return (
    <aside className="docs-evidence-panel" aria-label="Evidence panel">
      {claim && <p className="docs-evidence-panel__claim">{claim}</p>}
      {badges.length > 0 && (
        <div className="docs-evidence-panel__meta">
          {badges.map((b) => (
            <EvidenceBadge key={b} type={b} />
          ))}
        </div>
      )}
      {children}
      {limitation && (
        <p className="docs-evidence-panel__limitation">
          <strong>Limitation:</strong> {limitation}
        </p>
      )}
    </aside>
  );
}

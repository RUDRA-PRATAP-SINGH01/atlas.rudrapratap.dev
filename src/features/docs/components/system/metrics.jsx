import React from "react";
import { EvidenceBadge } from "./evidence";

export function MetricCard({ label, value, unit, context, evidence }) {
  return (
    <div className="docs-metric-card">
      <div className="docs-metric-card__value">
        {value}
        {unit ? <span className="docs-metric-card__unit">{unit}</span> : null}
      </div>
      <div className="docs-metric-card__label">{label}</div>
      {context && <div className="docs-metric-card__context">{context}</div>}
      {evidence && (
        <div style={{ marginTop: 6 }}>
          <EvidenceBadge type={evidence} />
        </div>
      )}
    </div>
  );
}

export function MetricGrid({ stats, children }) {
  if (children) {
    return <div className="docs-metric-grid">{children}</div>;
  }
  return (
    <div className="docs-metric-grid">
      {(stats || []).map((s) => (
        <MetricCard
          key={s.label}
          label={s.label}
          value={s.value}
          unit={s.unit}
          context={s.context}
          evidence={s.evidence}
        />
      ))}
    </div>
  );
}

export function BenchmarkTable({ caption, columns, rows }) {
  return (
    <div className="docs-table-wrap">
      <table className="docs-table">
        {caption && <caption>{caption}</caption>}
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key || c}>{c.label || c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id || i}>
              {columns.map((c) => {
                const key = c.key || c;
                const cell = row[key];
                return <td key={key}>{cell}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LatencySummary({ items = [] }) {
  const total = items.reduce((sum, i) => sum + (Number(i.ms) || 0), 0) || 1;
  return (
    <div>
      <div className="docs-latency-bar" role="img" aria-label="Latency breakdown">
        {items.map((item, idx) => (
          <div
            key={item.label}
            className="docs-latency-bar__seg"
            style={{
              width: `${((Number(item.ms) || 0) / total) * 100}%`,
              ["--seg-opacity"]: 0.45 + (idx % 4) * 0.15,
            }}
            title={`${item.label}: ${item.ms} ms`}
          />
        ))}
      </div>
      <ul className="guide-bullets-list" style={{ fontSize: 13 }}>
        {items.map((item) => (
          <li key={item.label}>
            <strong>{item.label}:</strong> {item.ms} ms
            {item.note ? ` — ${item.note}` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BeforeAfterMetric({ before, after, label }) {
  return (
    <div className="docs-before-after" aria-label={label || "Before and after"}>
      <MetricCard label={before.label || "Before"} value={before.value} unit={before.unit} context={before.context} evidence={before.evidence} />
      <div className="docs-before-after__arrow" aria-hidden="true">
        →
      </div>
      <MetricCard label={after.label || "After"} value={after.value} unit={after.unit} context={after.context} evidence={after.evidence} />
    </div>
  );
}

export function ResultDistribution({ rows = [], caption }) {
  return (
    <div className="docs-table-wrap">
      <table className="docs-table">
        {caption && <caption>{caption}</caption>}
        <thead>
          <tr>
            <th scope="col">Bucket</th>
            <th scope="col">Count / Share</th>
            <th scope="col">Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.bucket}>
              <th scope="row">{r.bucket}</th>
              <td>{r.share}</td>
              <td>{r.notes || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EvidenceSource({ path, note }) {
  return (
    <p className="docs-evidence-source">
      Source: <code>{path}</code>
      {note ? ` — ${note}` : ""}
    </p>
  );
}

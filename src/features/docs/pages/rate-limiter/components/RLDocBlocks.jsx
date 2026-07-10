import React from "react";
import GoCodeBlock from "@/features/docs/components/GoCodeBlock";

/** Pink-only evidence badge palette — intensity varies by evidence strength, hue stays pink. */
const EVIDENCE_COLORS = {
  "SOURCE-PROVEN": { bg: "rgba(255,92,173,0.14)", color: "#ff5cad" },
  "TEST-PROVEN": { bg: "rgba(255,92,173,0.10)", color: "#ff7ebd" },
  "RUNTIME-PROVEN": { bg: "rgba(219,69,119,0.14)", color: "#db4577" },
  "BENCHMARK-PROVEN": { bg: "rgba(255,143,191,0.14)", color: "#ff8fbf" },
  "DOCUMENTED LIMITATION": { bg: "rgba(255,92,173,0.08)", color: "#e879a9" },
  "FUTURE DESIGN": { bg: "rgba(255,92,173,0.06)", color: "#c45a8a" }
};

const PINK = {
  accent: "#ff5cad",
  soft: "rgba(255,92,173,0.08)",
  border: "rgba(255,92,173,0.25)",
  text: "#ffb3d4",
  muted: "#e879a9"
};

export function RLThesis({ children }) {
  return (
    <div style={{
      background: `linear-gradient(135deg, ${PINK.soft} 0%, rgba(219,69,119,0.04) 100%)`,
      border: `1px solid ${PINK.border}`,
      borderRadius: 10,
      padding: "20px 24px",
      marginBottom: 24
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: PINK.accent, marginBottom: 8, textTransform: "uppercase" }}>
        Page Thesis
      </div>
      <p style={{ fontSize: 15, lineHeight: 1.75, color: "#e4e4e7", margin: 0 }}>{children}</p>
    </div>
  );
}

export function RLQuickModel({ children }) {
  return (
    <div style={{
      background: "rgba(39, 39, 42, 0.35)",
      border: "1px solid rgba(255,92,173,0.12)",
      borderRadius: 8,
      padding: "14px 18px",
      marginBottom: 24,
      fontSize: 13,
      lineHeight: 1.7,
      color: "#d4d4d8"
    }}>
      <strong style={{ color: PINK.accent, display: "block", marginBottom: 6 }}>Quick mental model</strong>
      {children}
    </div>
  );
}

export function RLEvidenceBadge({ type }) {
  const style = EVIDENCE_COLORS[type] || EVIDENCE_COLORS["SOURCE-PROVEN"];
  return (
    <span style={{
      background: style.bg,
      color: style.color,
      padding: "2px 8px",
      borderRadius: 4,
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: "0.04em",
      whiteSpace: "nowrap"
    }}>
      {type}
    </span>
  );
}

export function RLCallout({ variant = "info", title, children }) {
  // All variants use pink shades only — intensity encodes severity.
  const intensity = {
    info: { bg: "rgba(255,92,173,0.05)", border: "rgba(255,92,173,0.22)", title: PINK.accent, text: PINK.text },
    warning: { bg: "rgba(255,92,173,0.08)", border: "rgba(255,92,173,0.35)", title: "#ff7ebd", text: "#ffb3d4" },
    limitation: { bg: "rgba(219,69,119,0.08)", border: "rgba(219,69,119,0.35)", title: "#db4577", text: "#e879a9" }
  };
  const v = intensity[variant] || intensity.info;
  return (
    <div style={{ background: v.bg, border: `1px solid ${v.border}`, borderRadius: 8, padding: "14px 18px", margin: "16px 0" }}>
      {title && <div style={{ color: v.title, fontWeight: 700, fontSize: 13, marginBottom: 6 }}>{title}</div>}
      <div style={{ fontSize: 13, lineHeight: 1.65, color: v.text }}>{children}</div>
    </div>
  );
}

export function RLSourceExcerpt({ source, language = "go", children, establishes }) {
  return (
    <div style={{ margin: "20px 0" }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.45)", marginBottom: 6, letterSpacing: "0.04em" }}>
        Implementation excerpt
      </div>
      <div style={{ fontSize: 12, color: "#a1a1aa", marginBottom: 8 }}>
        Source: <code style={{ color: PINK.accent }}>{source}</code>
      </div>
      {language === "go" ? (
        <GoCodeBlock>{children}</GoCodeBlock>
      ) : (
        <pre style={{ background: "#0e0e11", border: "1px solid #27272a", padding: 14, borderRadius: 6, fontSize: 12, overflowX: "auto", color: "#e4e4e7" }}>
          {children}
        </pre>
      )}
      {establishes && (
        <p style={{ fontSize: 12, color: "#a1a1aa", marginTop: 8, lineHeight: 1.6 }}>
          <strong style={{ color: "#d4d4d8" }}>Establishes:</strong> {establishes}
        </p>
      )}
    </div>
  );
}

export function RLRelatedPages({ pages }) {
  if (!pages?.length) return null;
  return (
    <div style={{ marginTop: 32, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
      <h3 className="guide-sub-heading" style={{ fontSize: 14 }}>Related pages</h3>
      <ul className="guide-bullets-list" style={{ fontSize: 13 }}>
        {pages.map((p) => (
          <li key={p.slug}>
            <a href={`/docs/distributed-rate-limiter/${p.section}/${p.slug}`} style={{ color: PINK.accent }}>{p.title}</a>
            {p.note && <span style={{ color: "#71717a" }}> — {p.note}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RLStatGrid({ stats }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, margin: "16px 0 24px" }}>
      {stats.map((s) => (
        <div key={s.label} style={{ background: "#111113", border: "1px solid rgba(255,92,173,0.15)", borderRadius: 8, padding: 14, textAlign: "center" }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: PINK.accent }}>{s.value}</div>
          <div style={{ fontSize: 11, color: "#a1a1aa", marginTop: 4, lineHeight: 1.4 }}>{s.label}</div>
          {s.evidence && <div style={{ marginTop: 6 }}><RLEvidenceBadge type={s.evidence} /></div>}
        </div>
      ))}
    </div>
  );
}

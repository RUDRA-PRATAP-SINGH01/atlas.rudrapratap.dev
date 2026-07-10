import React from "react";

export function DecisionRecord({ decision, chosen, alternatives, rationale, tradeoffs, children }) {
  return (
    <section className="docs-decision" aria-label="Decision record">
      <div className="docs-decision__label">Decision record</div>
      {decision && <h3 className="docs-decision__title">{decision}</h3>}
      <dl>
        {chosen && (
          <>
            <dt>Chosen</dt>
            <dd>{chosen}</dd>
          </>
        )}
        {alternatives && (
          <>
            <dt>Alternatives</dt>
            <dd>{Array.isArray(alternatives) ? alternatives.join(" · ") : alternatives}</dd>
          </>
        )}
        {rationale && (
          <>
            <dt>Rationale</dt>
            <dd>{rationale}</dd>
          </>
        )}
        {tradeoffs && (
          <>
            <dt>Trade-offs</dt>
            <dd>{tradeoffs}</dd>
          </>
        )}
      </dl>
      {children}
    </section>
  );
}

export function TradeoffPanel({ title, children }) {
  return (
    <section className="docs-tradeoff" aria-label={title || "Trade-off"}>
      <div className="docs-tradeoff__label">Trade-off</div>
      {title && <h3 className="docs-decision__title">{title}</h3>}
      <div className="docs-callout__body" style={{ color: "var(--docs-text-muted)" }}>
        {children}
      </div>
    </section>
  );
}

export function Invariant({ title, children }) {
  return (
    <section className="docs-invariant">
      <div className="docs-invariant__label">Invariant</div>
      {title && <h3 className="docs-invariant__title">{title}</h3>}
      <div style={{ fontSize: 13, lineHeight: 1.65, color: "var(--docs-text-muted)" }}>{children}</div>
    </section>
  );
}

export function Guarantee({ title, children }) {
  return (
    <section className="docs-guarantee">
      <div className="docs-guarantee__label">Guarantee</div>
      {title && <h3 className="docs-guarantee__title">{title}</h3>}
      <div style={{ fontSize: 13, lineHeight: 1.65, color: "var(--docs-text-muted)" }}>{children}</div>
    </section>
  );
}

export function Limitation({ title, children }) {
  return (
    <section className="docs-limitation-block">
      <div className="docs-limitation-block__label">Limitation</div>
      {title && <h3 className="docs-limitation-block__title">{title}</h3>}
      <div style={{ fontSize: 13, lineHeight: 1.65, color: "var(--docs-text-muted)" }}>{children}</div>
    </section>
  );
}

export function FailureScenario({ title, children }) {
  return (
    <section className="docs-failure-scenario">
      <div className="docs-failure-scenario__label">Failure scenario</div>
      {title && <h3 className="docs-failure-scenario__title">{title}</h3>}
      <div style={{ fontSize: 13, lineHeight: 1.65, color: "var(--docs-text-muted)" }}>{children}</div>
    </section>
  );
}

export function DesignRationale({ title, children }) {
  return (
    <section className="docs-design-rationale">
      <div className="docs-design-rationale__label">Design rationale</div>
      {title && <h3 className="docs-decision__title">{title}</h3>}
      <div style={{ fontSize: 13, lineHeight: 1.65, color: "var(--docs-text-muted)" }}>{children}</div>
    </section>
  );
}

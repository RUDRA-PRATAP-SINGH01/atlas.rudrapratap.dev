import React, { lazy, Suspense, useEffect, useRef, useState } from "react";

const LazyMermaid = lazy(() => import("@/features/docs/components/DocsMermaid"));

function DiagramShell({ title, caption, fallback, children, loading }) {
  return (
    <figure className="docs-diagram">
      {title && <figcaption className="docs-diagram__title">{title}</figcaption>}
      <div className="docs-diagram__shell">
        {loading ? <div className="docs-diagram__loading">Loading diagram…</div> : children}
      </div>
      {caption && <p className="docs-diagram__caption">{caption}</p>}
      {fallback && (
        <p className="docs-diagram__fallback">
          <span className="sr-only">Text description: </span>
          {fallback}
        </p>
      )}
    </figure>
  );
}

/** Lazy Mermaid: loads runtime only when near viewport; single shared DocsMermaid module. */
export function MermaidDiagram({ chart, title, caption, fallback, className = "" }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return undefined;
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px 0px", threshold: 0.01 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={className}>
      <DiagramShell title={title} caption={caption} fallback={fallback || (!visible ? "Diagram pending render." : undefined)} loading={!visible}>
        {visible ? (
          <Suspense fallback={<div className="docs-diagram__loading">Rendering diagram…</div>}>
            <LazyMermaid chart={chart} />
          </Suspense>
        ) : null}
      </DiagramShell>
    </div>
  );
}

export function ArchitectureDiagram(props) {
  return <MermaidDiagram {...props} />;
}

export function RequestFlow({ title, children }) {
  return (
    <section className="docs-flow" aria-label={title || "Request flow"}>
      {title && <h3 className="docs-diagram__title">{title}</h3>}
      {children}
    </section>
  );
}

export function FlowStep({ step, title, children }) {
  return (
    <div className="docs-flow-step">
      <div className="docs-flow-step__n" aria-hidden="true">
        {step}
      </div>
      <div>
        {title && <h4 className="docs-flow-step__title">{title}</h4>}
        <div className="docs-flow-step__body">{children}</div>
      </div>
    </div>
  );
}

export function SequenceExplanation({ title, children }) {
  return (
    <aside className="docs-impl-note" aria-label={title || "Sequence explanation"}>
      {title && <strong style={{ display: "block", color: "var(--docs-accent)", marginBottom: 6 }}>{title}</strong>}
      {children}
    </aside>
  );
}

export function StateMachine({ title, caption, chart, fallback }) {
  return <MermaidDiagram title={title} caption={caption} chart={chart} fallback={fallback} />;
}

export function Timeline({ items = [], title }) {
  return (
    <section className="docs-timeline" aria-label={title || "Timeline"}>
      {items.map((item) => (
        <div key={item.title} className="docs-timeline__item">
          <div className="docs-timeline__item-title">{item.title}</div>
          <div className="docs-timeline__item-body">{item.body}</div>
        </div>
      ))}
    </section>
  );
}

export function ComponentMap({ items = [], title }) {
  return (
    <section aria-label={title || "Component map"}>
      {title && <h3 className="docs-diagram__title">{title}</h3>}
      <div className="docs-grid" style={{ ["--docs-grid-min"]: "200px" }}>
        {items.map((item) => (
          <div key={item.name} className="docs-grid-card">
            <h4 className="docs-grid-card__title">{item.name}</h4>
            <p className="docs-grid-card__body">{item.role}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

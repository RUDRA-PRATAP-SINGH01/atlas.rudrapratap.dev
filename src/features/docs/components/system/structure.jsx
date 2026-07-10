import React from "react";
import { Link } from "react-router-dom";

export function DocsPage({ children, className = "" }) {
  return <div className={`docs-page ${className}`.trim()}>{children}</div>;
}

export function DocsHeader({ breadcrumb, title, id = "page-title" }) {
  return (
    <header className="docs-header">
      {breadcrumb && (
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.05em",
            color: "rgba(255,255,255,0.4)",
            textTransform: "uppercase",
            marginBottom: 8,
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
          }}
        >
          {breadcrumb.map((crumb, i) => (
            <React.Fragment key={`${crumb}-${i}`}>
              {i > 0 && <span>/</span>}
              <span style={i === breadcrumb.length - 1 ? { color: "var(--docs-accent)" } : undefined}>
                {crumb}
              </span>
            </React.Fragment>
          ))}
        </div>
      )}
      <h1 className="guide-main-title" id={id} style={{ fontSize: 32, fontWeight: 800, color: "#fff", marginBottom: 12 }}>
        {title}
      </h1>
    </header>
  );
}

export function DocsSection({ id, title, children, as: Heading = "h2" }) {
  return (
    <section className="docs-section" id={id} aria-labelledby={id ? `${id}-heading` : undefined}>
      {title && (
        <Heading className="guide-sub-heading" id={id ? `${id}-heading` : undefined}>
          {title}
        </Heading>
      )}
      {children}
    </section>
  );
}

export function SectionIntro({ children }) {
  return <p className="docs-section-intro">{children}</p>;
}

export function DocsGrid({ min = 240, children, items }) {
  const style = { ["--docs-grid-min"]: `${min}px` };
  if (items?.length) {
    return (
      <div className="docs-grid" style={style}>
        {items.map((item) => (
          <div key={item.title} className="docs-grid-card">
            <h3 className="docs-grid-card__title">{item.title}</h3>
            <div className="docs-grid-card__body">{item.body}</div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="docs-grid" style={style}>
      {children}
    </div>
  );
}

export function RelatedPages({ pages, base = "/docs/distributed-rate-limiter" }) {
  if (!pages?.length) return null;
  return (
    <nav className="docs-related" aria-label="Related pages">
      <h3 className="guide-sub-heading" style={{ fontSize: 14 }}>
        Related pages
      </h3>
      <ul className="guide-bullets-list" style={{ fontSize: 13 }}>
        {pages.map((p) => (
          <li key={p.slug}>
            <Link to={`${base}/${p.section}/${p.slug}`}>{p.title}</Link>
            {p.note && <span className="docs-related__note"> — {p.note}</span>}
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function PageNavigation({ prev, next, resolveTitle }) {
  return (
    <div className="guide-pager">
      {prev ? (
        <Link to={prev.to} className="guide-pager-link">
          <span aria-hidden="true">←</span>
          <span className="guide-pager-link-label">{resolveTitle ? resolveTitle(prev) : prev.title}</span>
        </Link>
      ) : (
        <div />
      )}
      {next ? (
        <Link to={next.to} className="guide-pager-link guide-pager-link--next">
          <span className="guide-pager-link-label">{resolveTitle ? resolveTitle(next) : next.title}</span>
          <span aria-hidden="true">→</span>
        </Link>
      ) : (
        <div />
      )}
    </div>
  );
}

export function OnThisPage({ topics }) {
  return (
    <aside className="guide-sidebar-right" aria-label="On this page">
      <div className="guide-sidebar-right-content">
        <h4 className="guide-sidebar-right-title">On this page</h4>
        {topics?.length ? (
          <ul className="guide-sidebar-right-list">
            {topics.map((topic) => (
              <li key={topic.href || topic.label} className="guide-sidebar-right-item">
                <a href={topic.href} className="guide-sidebar-right-link">
                  {topic.label}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="docs-diagram__loading" style={{ padding: 0, textAlign: "left" }}>
            …
          </p>
        )}
      </div>
    </aside>
  );
}

export function PageThesis({ children }) {
  return (
    <div className="docs-thesis">
      <div className="docs-thesis__label">Page Thesis</div>
      <div className="docs-thesis__body">{children}</div>
    </div>
  );
}

export function QuickModel({ children }) {
  return (
    <div className="docs-quick-model">
      <strong className="docs-quick-model__label">Quick mental model</strong>
      {children}
    </div>
  );
}

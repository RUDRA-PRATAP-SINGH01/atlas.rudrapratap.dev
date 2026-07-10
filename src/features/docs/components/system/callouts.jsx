import React from "react";

const VALID = new Set(["info", "note", "warning", "danger", "success", "limitation"]);

export function TechnicalCallout({ type = "info", title, children }) {
  const variant = VALID.has(type) ? type : "info";
  return (
    <aside
      className={`docs-callout docs-callout--${variant}`}
      role={variant === "danger" || variant === "warning" ? "alert" : "note"}
    >
      {title && <div className="docs-callout__title">{title}</div>}
      <div className="docs-callout__body">{children}</div>
    </aside>
  );
}

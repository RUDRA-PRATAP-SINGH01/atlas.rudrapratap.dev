import React, { useId, useState } from "react";

function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  return new Promise((resolve, reject) => {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(textarea);
      if (ok) resolve();
      else reject(new Error("copy failed"));
    } catch (err) {
      reject(err);
    }
  });
}

/** Small interactive island — only this button hydrates interaction, not the code body. */
export function CopyButton({ text, className = "" }) {
  const [copied, setCopied] = useState(false);
  if (typeof text !== "string" || !text) return null;

  const onCopy = () => {
    copyTextToClipboard(text)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  };

  return (
    <button
      type="button"
      onClick={onCopy}
      className={`guide-copy-code-btn ${copied ? "copied" : ""} ${className}`.trim()}
      aria-label={copied ? "Copied" : "Copy code"}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function escapeHtml(code) {
  return code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function highlightGo(code) {
  let html = escapeHtml(code);
  const placeholders = [];

  html = html.replace(/("(?:\\.|[^"\\])*")|(`(?:[^`])*`)/g, (match) => {
    const id = `___STR_${placeholders.length}___`;
    placeholders.push({ id, content: `<span style="color:#f472b6">${match}</span>` });
    return id;
  });
  html = html.replace(/(\/\/[^\n]*)|(\/\*[\s\S]*?\*\/)/g, (match) => {
    const id = `___COM_${placeholders.length}___`;
    placeholders.push({ id, content: `<span style="color:#71717a;font-style:italic">${match}</span>` });
    return id;
  });

  const keywords = [
    "break", "default", "func", "interface", "select", "case", "defer", "go", "map", "struct",
    "chan", "else", "goto", "package", "switch", "const", "fallthrough", "if", "range", "type",
    "continue", "for", "import", "return", "var", "true", "false", "nil",
  ];
  html = html.replace(new RegExp(`\\b(${keywords.join("|")})\\b`, "g"), `<span style="color:#ff5cad;font-weight:700">$1</span>`);
  html = html.replace(/\b(append|make|new|len|cap|panic|recover|close|delete)\b/g, `<span style="color:#c084fc">$1</span>`);
  html = html.replace(/\b(string|int|int64|uint64|uint32|byte|error|bool|float64|uintptr|int32)\b/g, `<span style="color:#e2d5f8">$1</span>`);
  html = html.replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)(?=\()/g, `<span style="color:#a78bfa">$1</span>`);
  html = html.replace(/\b(0x[0-9a-fA-F]+|\d+(?:\.\d+)?)\b/g, `<span style="color:#c084fc">$1</span>`);

  for (let i = placeholders.length - 1; i >= 0; i -= 1) {
    html = html.replace(placeholders[i].id, placeholders[i].content);
  }
  return html;
}

function highlightLua(code) {
  let html = escapeHtml(code);
  const placeholders = [];
  html = html.replace(/(--[^\n]*)|(\[=*\[[\s\S]*?\]=*\])/g, (match) => {
    const id = `___LCOM_${placeholders.length}___`;
    placeholders.push({ id, content: `<span style="color:#71717a;font-style:italic">${match}</span>` });
    return id;
  });
  html = html.replace(/("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g, (match) => {
    const id = `___LSTR_${placeholders.length}___`;
    placeholders.push({ id, content: `<span style="color:#f472b6">${match}</span>` });
    return id;
  });
  html = html.replace(
    /\b(local|function|end|if|then|else|elseif|return|for|while|do|in|and|or|not|nil|true|false)\b/g,
    `<span style="color:#ff5cad;font-weight:700">$1</span>`,
  );
  for (let i = placeholders.length - 1; i >= 0; i -= 1) {
    html = html.replace(placeholders[i].id, placeholders[i].content);
  }
  return html;
}

function highlightYaml(code) {
  let html = escapeHtml(code);
  html = html.replace(/(^|\n)([A-Za-z0-9_.-]+)(:)/g, `$1<span style="color:#ff5cad">$2</span>$3`);
  html = html.replace(/(#.*)$/gm, `<span style="color:#71717a;font-style:italic">$1</span>`);
  return html;
}

function highlightCode(code, language) {
  if (typeof code !== "string") return null;
  switch ((language || "").toLowerCase()) {
    case "go":
      return highlightGo(code);
    case "lua":
      return highlightLua(code);
    case "yaml":
    case "yml":
      return highlightYaml(code);
    default:
      return escapeHtml(code);
  }
}

export function CodeBlock({ children, language = "text", filename, highlightLines }) {
  const code = typeof children === "string" ? children : "";
  const html = highlightCode(code, language);
  return (
    <div className="docs-code-block guide-code-block-container">
      {filename && (
        <div className="docs-source-excerpt__path" style={{ marginBottom: 6 }}>
          <code>{filename}</code>
        </div>
      )}
      <CopyButton text={code} />
      <pre className="docs-code-block__pre guide-code-pre" data-language={language} data-highlight-lines={highlightLines || undefined}>
        <code
          className="guide-code-lines"
          dangerouslySetInnerHTML={html != null ? { __html: html } : undefined}
        >
          {html == null ? children : null}
        </code>
      </pre>
    </div>
  );
}

export function CodeTabs({ tabs }) {
  const baseId = useId();
  const [active, setActive] = useState(0);
  if (!tabs?.length) return null;
  const current = tabs[Math.min(active, tabs.length - 1)];

  return (
    <div className="docs-code-tabs">
      <div className="docs-code-tabs__list" role="tablist" aria-label="Code examples">
        {tabs.map((tab, i) => (
          <button
            key={tab.label}
            type="button"
            role="tab"
            id={`${baseId}-tab-${i}`}
            aria-selected={i === active}
            aria-controls={`${baseId}-panel-${i}`}
            className="docs-code-tabs__tab"
            onClick={() => setActive(i)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`${baseId}-panel-${active}`}
        aria-labelledby={`${baseId}-tab-${active}`}
      >
        <CodeBlock language={current.language} filename={current.filename}>
          {current.code}
        </CodeBlock>
      </div>
    </div>
  );
}

export function SourcePath({ path }) {
  return (
    <span className="docs-file-ref">
      <code>{path}</code>
    </span>
  );
}

export function FileReference({ path, note }) {
  return (
    <p className="docs-source-excerpt__path">
      File: <SourcePath path={path} />
      {note ? ` — ${note}` : ""}
    </p>
  );
}

export function ImplementationNote({ children }) {
  return <aside className="docs-impl-note">{children}</aside>;
}

export function SourceExcerpt({ source, language = "go", children, establishes }) {
  return (
    <figure className="docs-source-excerpt">
      <figcaption>
        <div className="docs-source-excerpt__eyebrow">Implementation excerpt</div>
        <div className="docs-source-excerpt__path">
          Source: <code>{source}</code>
        </div>
      </figcaption>
      <CodeBlock language={language}>{children}</CodeBlock>
      {establishes && (
        <p className="docs-source-excerpt__establishes">
          <strong style={{ color: "#d4d4d8" }}>Establishes:</strong> {establishes}
        </p>
      )}
    </figure>
  );
}

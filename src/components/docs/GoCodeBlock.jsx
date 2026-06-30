import React from "react";

function highlightGo(code) {
  if (typeof code !== "string") return code;

  // Escape HTML first
  let html = code
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Placeholders for comments and strings so they don't get highlighted by keywords
  const placeholders = [];
  
  // 1. Strings: dual-quoted or backticks
  html = html.replace(/("(?:\\.|[^"\\])*")|(`(?:[^`])*`)/g, (match) => {
    const id = `___STR_PLACEHOLDER_${placeholders.length}___`;
    placeholders.push({ id, content: `<span style="color: #c084fc;">${match}</span>` });
    return id;
  });

  // 2. Comments: single line and block
  html = html.replace(/(\/\/[^\n]*)|(\/\*[\s\S]*?\*\/)/g, (match) => {
    const id = `___COM_PLACEHOLDER_${placeholders.length}___`;
    placeholders.push({ id, content: `<span style="color: #71717a; font-style: italic;">${match}</span>` });
    return id;
  });

  // 3. Keywords
  const keywords = [
    "break", "default", "func", "interface", "select", "case", "defer", "go", "map", "struct",
    "chan", "else", "goto", "package", "switch", "const", "fallthrough", "if", "range", "type",
    "continue", "for", "import", "return", "var", "true", "false", "nil"
  ];
  const keywordRegex = new RegExp(`\\b(${keywords.join("|")})\\b`, "g");
  html = html.replace(keywordRegex, `<span style="color: #ff5cad; font-weight: bold;">$1</span>`);

  // 4. Built-in functions
  const builtins = ["append", "make", "new", "len", "cap", "panic", "recover", "close", "delete"];
  const builtinRegex = new RegExp(`\\b(${builtins.join("|")})\\b`, "g");
  html = html.replace(builtinRegex, `<span style="color: #f43f5e;">$1</span>`);

  // 5. Types
  const types = ["string", "int", "int64", "uint64", "uint32", "byte", "error", "bool", "float64", "uintptr", "int32"];
  const typesRegex = new RegExp(`\\b(${types.join("|")})\\b`, "g");
  html = html.replace(typesRegex, `<span style="color: #38bdf8;">$1</span>`);

  // 6. Function calls (e.g. OpenReader() or acquireDirLock())
  html = html.replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)(?=\()/g, `<span style="color: #60a5fa;">$1</span>`);

  // 7. Numbers (integers, floats, hex)
  html = html.replace(/\b(0x[0-9a-fA-F]+|\\d+(?:\\.\\d+)?)\\b/g, `<span style="color: #fb923c;">$1</span>`);

  // Restore comments and strings
  for (let i = placeholders.length - 1; i >= 0; i--) {
    html = html.replace(placeholders[i].id, placeholders[i].content);
  }

  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

export default function GoCodeBlock({ children }) {
  return (
    <div
      className="guide-code-block-container"
      style={{ marginTop: 8, marginBottom: 20 }}
    >
      <pre className="guide-code-pre" style={{ background: "#0e0e11", border: "1px solid #27272a", borderRadius: "8px", padding: "16px", overflowX: "auto" }}>
        <code className="guide-code-lines" style={{ fontFamily: "monospace", fontSize: "13px", lineHeight: "1.6", color: "#e4e4e7" }}>
          {highlightGo(children)}
        </code>
      </pre>
    </div>
  );
}

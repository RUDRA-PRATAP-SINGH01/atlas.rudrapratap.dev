export default function GoCodeBlock({ children }) {
  return (
    <div
      className="guide-code-block-container"
      style={{ marginTop: 8, marginBottom: 20 }}
    >
      <pre className="guide-code-pre">
        <code className="guide-code-lines">{children}</code>
      </pre>
    </div>
  );
}

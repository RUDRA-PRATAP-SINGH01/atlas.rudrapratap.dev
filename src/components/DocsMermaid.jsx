import { useEffect, useId, useRef, useState } from "react";
import mermaid from "mermaid";

let mermaidInitialized = false;

function initMermaid() {
  if (mermaidInitialized) return;

  mermaid.initialize({
    startOnLoad: false,
    theme: "dark",
    securityLevel: "strict",
    themeVariables: {
      primaryColor: "#18181b",
      primaryTextColor: "#ffffff",
      primaryBorderColor: "#ff5cad",
      lineColor: "#71717a",
      secondaryColor: "#0e0e11",
      tertiaryColor: "#18181b",
      fontFamily: "Poppins, system-ui, sans-serif",
    },
    flowchart: {
      htmlLabels: true,
      curve: "basis",
    },
  });

  mermaidInitialized = true;
}

export default function DocsMermaid({ chart, className = "" }) {
  const containerRef = useRef(null);
  const reactId = useId();
  const [svg, setSvg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const renderChart = async () => {
      initMermaid();

      try {
        const id = `mermaid-${reactId.replace(/:/g, "")}`;
        const { svg: renderedSvg } = await mermaid.render(id, chart.trim());

        if (!cancelled) {
          setSvg(renderedSvg);
          setError("");
        }
      } catch (renderError) {
        if (!cancelled) {
          setSvg("");
          setError(
            renderError instanceof Error
              ? renderError.message
              : "Failed to render diagram.",
          );
        }
      }
    };

    renderChart();

    return () => {
      cancelled = true;
    };
  }, [chart, reactId]);

  if (error) {
    return (
      <pre className={`guide-mermaid guide-mermaid--error ${className}`.trim()}>
        {chart}
      </pre>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`guide-mermaid ${className}`.trim()}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

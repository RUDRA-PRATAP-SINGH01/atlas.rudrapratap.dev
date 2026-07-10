import { useEffect, useId, useRef, useState } from "react";

const svgCache = new Map();
const renderPromises = new Map();

let mermaidModule = null;
let mermaidInitialized = false;

async function getMermaid() {
  if (!mermaidModule) {
    mermaidModule = (await import("mermaid")).default;
  }

  if (!mermaidInitialized) {
    mermaidModule.initialize({
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

  return mermaidModule;
}

function chartKey(chart) {
  return chart.trim();
}

async function renderCached(chart, renderId) {
  const key = chartKey(chart);

  if (svgCache.has(key)) {
    return svgCache.get(key);
  }

  if (renderPromises.has(key)) {
    return renderPromises.get(key);
  }

  const promise = (async () => {
    const mermaid = await getMermaid();
    const { svg } = await mermaid.render(renderId, key);
    svgCache.set(key, svg);
    return svg;
  })();

  renderPromises.set(key, promise);

  try {
    return await promise;
  } catch (error) {
    renderPromises.delete(key);
    throw error;
  } finally {
    if (svgCache.has(key)) {
      renderPromises.delete(key);
    }
  }
}

export default function DocsMermaid({ chart, className = "" }) {
  const containerRef = useRef(null);
  const reactId = useId();
  const [svg, setSvg] = useState(() => svgCache.get(chartKey(chart)) ?? "");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const key = chartKey(chart);

    if (svgCache.has(key)) {
      setSvg(svgCache.get(key));
      setError("");
      return undefined;
    }

    const renderChart = async () => {
      try {
        const id = `mermaid-${reactId.replace(/:/g, "")}`;
        const renderedSvg = await renderCached(chart, id);

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
      <pre className={`guide-mermaid guide-mermaid--error ${className}`.trim()} role="img" aria-label="Diagram failed to render; showing source">
        {chart}
      </pre>
    );
  }

  if (!svg) {
    return (
      <div className={`guide-mermaid ${className}`.trim()} aria-busy="true">
        <div className="docs-diagram__loading">Rendering diagram…</div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`guide-mermaid ${className}`.trim()}
      role="img"
      aria-label="Architecture diagram"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

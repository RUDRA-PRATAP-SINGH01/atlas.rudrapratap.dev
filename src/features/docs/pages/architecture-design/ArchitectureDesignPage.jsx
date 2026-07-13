import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  GRAPH_META,
  edges,
  getGraphBounds,
  getNodeMap,
  groups,
  nodes,
} from "./pebbledbArchitectureGraph";

const MIN_SCALE = 0.35;
const MAX_SCALE = 2.4;

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function nodeCenter(node) {
  const w = node.w || 160;
  const h = node.h || 56;
  return { x: node.x + w / 2, y: node.y + h / 2 };
}

function kindClass(kind) {
  return `arch-canvas-node arch-canvas-node--${kind}`;
}

export default function ArchitectureDesignPage() {
  const viewportRef = useRef(null);
  const [transform, setTransform] = useState({ x: 80, y: 40, scale: 0.85 });
  const [selectedId, setSelectedId] = useState("api");
  const [spaceDown, setSpaceDown] = useState(false);
  const dragRef = useRef(null);
  const nodeMap = useMemo(() => getNodeMap(), []);
  const bounds = useMemo(() => getGraphBounds(), []);
  const selected = selectedId ? nodeMap[selectedId] : null;

  useEffect(() => {
    document.title = "Architecture Design — PebbleDB | Atlas Docs";
  }, []);

  const fitToView = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const scale = clamp(
      Math.min((width - 80) / bounds.width, (height - 80) / bounds.height),
      MIN_SCALE,
      1.1,
    );
    setTransform({
      scale,
      x: (width - bounds.width * scale) / 2 - bounds.minX * scale,
      y: (height - bounds.height * scale) / 2 - bounds.minY * scale,
    });
  }, [bounds]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code === "Space" && !e.repeat && e.target === document.body) {
        e.preventDefault();
        setSpaceDown(true);
      }
      if (e.key === "Escape") setSelectedId(null);
      if (e.key === "0" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        fitToView();
      }
    };
    const onKeyUp = (e) => {
      if (e.code === "Space") setSpaceDown(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [fitToView]);

  useEffect(() => {
    fitToView();
    const onResize = () => fitToView();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [fitToView]);

  const zoomAt = useCallback((clientX, clientY, nextScale) => {
    const el = viewportRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    setTransform((prev) => {
      const scale = clamp(nextScale, MIN_SCALE, MAX_SCALE);
      const worldX = (px - prev.x) / prev.scale;
      const worldY = (py - prev.y) / prev.scale;
      return {
        scale,
        x: px - worldX * scale,
        y: py - worldY * scale,
      };
    });
  }, []);

  const onWheel = useCallback(
    (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.08 : 0.08;
      setTransform((prev) => {
        const scale = clamp(prev.scale + delta, MIN_SCALE, MAX_SCALE);
        const el = viewportRef.current;
        if (!el) return { ...prev, scale };
        const rect = el.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;
        const worldX = (px - prev.x) / prev.scale;
        const worldY = (py - prev.y) / prev.scale;
        return {
          scale,
          x: px - worldX * scale,
          y: py - worldY * scale,
        };
      });
    },
    [],
  );

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return undefined;
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [onWheel]);

  const onPointerDown = (e) => {
    if (e.button !== 0 && e.button !== 1) return;
    const panning = e.button === 1 || spaceDown || e.target === e.currentTarget || e.target.dataset?.canvasBg === "1";
    if (!panning && e.target.closest?.(".arch-canvas-node")) return;

    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX: transform.x,
      origY: transform.y,
    };
  };

  const onPointerMove = (e) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    setTransform((prev) => ({
      ...prev,
      x: drag.origX + (e.clientX - drag.startX),
      y: drag.origY + (e.clientY - drag.startY),
    }));
  };

  const onPointerUp = (e) => {
    if (dragRef.current?.pointerId === e.pointerId) {
      dragRef.current = null;
    }
  };

  return (
    <div className="arch-design-page">
      <header className="arch-design-toolbar">
        <div className="arch-design-toolbar-left">
          <Link to="/project-docs" className="arch-design-back">
            ← Docs
          </Link>
          <div className="arch-design-title-block">
            <h1 className="arch-design-title">Architecture Design</h1>
            <p className="arch-design-subtitle">
              {GRAPH_META.project} · {GRAPH_META.subtitle}
            </p>
          </div>
        </div>
        <div className="arch-design-toolbar-right">
          <span className="arch-design-evidence">{GRAPH_META.evidence}</span>
          <div className="arch-design-zoom">
            <button type="button" className="arch-design-icon-btn" onClick={() => zoomAt(window.innerWidth / 2, window.innerHeight / 2, transform.scale - 0.1)} aria-label="Zoom out">
              −
            </button>
            <span className="arch-design-zoom-label">{Math.round(transform.scale * 100)}%</span>
            <button type="button" className="arch-design-icon-btn" onClick={() => zoomAt(window.innerWidth / 2, window.innerHeight / 2, transform.scale + 0.1)} aria-label="Zoom in">
              +
            </button>
            <button type="button" className="arch-design-icon-btn" onClick={fitToView} aria-label="Fit to view">
              Fit
            </button>
          </div>
          <Link to={GRAPH_META.guideEntry} className="arch-design-link-btn">
            System overview docs
          </Link>
          <a href={GRAPH_META.github} target="_blank" rel="noopener noreferrer" className="arch-design-link-btn">
            GitHub
          </a>
        </div>
      </header>

      <div className="arch-design-body">
        <div
          ref={viewportRef}
          className={`arch-canvas-viewport${spaceDown ? " arch-canvas-viewport--pan" : ""}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          role="application"
          aria-label="PebbleDB architecture infinite canvas. Drag to pan, scroll to zoom."
        >
          <div className="arch-canvas-grid" data-canvas-bg="1" />
          <div
            className="arch-canvas-world"
            style={{
              transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            }}
          >
            <svg className="arch-canvas-edges" width={bounds.maxX + 200} height={bounds.maxY + 200} aria-hidden="true">
              <defs>
                <marker id="arch-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#71717a" />
                </marker>
              </defs>
              {edges.map((edge) => {
                const from = nodeMap[edge.from];
                const to = nodeMap[edge.to];
                if (!from || !to) return null;
                const a = nodeCenter(from);
                const b = nodeCenter(to);
                const midY = (a.y + b.y) / 2;
                const d = `M ${a.x} ${a.y} C ${a.x} ${midY}, ${b.x} ${midY}, ${b.x} ${b.y}`;
                const active = selectedId && (edge.from === selectedId || edge.to === selectedId);
                return (
                  <path
                    key={edge.id}
                    d={d}
                    className={`arch-canvas-edge${active ? " arch-canvas-edge--active" : ""}`}
                    markerEnd="url(#arch-arrow)"
                  />
                );
              })}
            </svg>

            {groups.map((group) => (
              <div
                key={group.id}
                className="arch-canvas-group"
                style={{
                  left: group.x,
                  top: group.y,
                  width: group.w,
                  height: group.h,
                }}
              >
                <span className="arch-canvas-group-label">{group.label}</span>
              </div>
            ))}

            {nodes.map((node) => {
              const w = node.w || 160;
              const h = node.h || 56;
              const isSelected = selectedId === node.id;
              return (
                <button
                  key={node.id}
                  type="button"
                  className={`${kindClass(node.kind)}${isSelected ? " is-selected" : ""}`}
                  style={{ left: node.x, top: node.y, width: w, height: h }}
                  onClick={() => setSelectedId(node.id)}
                >
                  <span className="arch-canvas-node-label">{node.label}</span>
                  {node.path && <span className="arch-canvas-node-path">{node.path}</span>}
                </button>
              );
            })}
          </div>

          <p className="arch-canvas-hint">
            Drag background to pan · Scroll to zoom · Space+drag · Click a node for details
          </p>
        </div>

        <aside className="arch-design-panel" aria-label="Node details">
          {selected ? (
            <>
              <p className="arch-design-panel-kicker">{selected.kind}</p>
              <h2 className="arch-design-panel-title">{selected.label}</h2>
              {selected.path && (
                <p className="arch-design-panel-path">
                  <code>{selected.path}</code>
                </p>
              )}
              <p className="arch-design-panel-body">{selected.summary}</p>
              <div className="arch-design-panel-actions">
                {selected.guideHref && (
                  <Link to={selected.guideHref} className="arch-design-link-btn">
                    Open related docs →
                  </Link>
                )}
              </div>
              <div className="arch-design-panel-connections">
                <h3>Connections</h3>
                <ul>
                  {edges
                    .filter((e) => e.from === selected.id || e.to === selected.id)
                    .map((e) => {
                      const otherId = e.from === selected.id ? e.to : e.from;
                      const other = nodeMap[otherId];
                      const dir = e.from === selected.id ? "→" : "←";
                      return (
                        <li key={e.id}>
                          <button type="button" onClick={() => setSelectedId(otherId)}>
                            {dir} {other?.label || otherId}
                          </button>
                        </li>
                      );
                    })}
                </ul>
              </div>
            </>
          ) : (
            <>
              <p className="arch-design-panel-kicker">canvas</p>
              <h2 className="arch-design-panel-title">PebbleDB system map</h2>
              <p className="arch-design-panel-body">
                Infinite architecture space for the exact layered design of PebbleDB: client API,
                in-memory LSM state, background workers, engine packages, and on-disk layout.
                Click any node to inspect it.
              </p>
              <Link to={GRAPH_META.guideEntry} className="arch-design-link-btn">
                Read system overview →
              </Link>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

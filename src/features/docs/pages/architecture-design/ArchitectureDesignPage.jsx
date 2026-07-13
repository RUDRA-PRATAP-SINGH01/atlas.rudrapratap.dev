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

const MIN_SCALE = 0.22;
const MAX_SCALE = 2.4;
const PAN_THRESHOLD = 8;

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

function useIsMobile(breakpoint = 960) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(`(max-width: ${breakpoint}px)`).matches : false,
  );

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [breakpoint]);

  return isMobile;
}

function DetailPanelContent({ selected, onSelectConnection }) {
  if (!selected) {
    return (
      <>
        <p className="arch-design-panel-kicker">canvas</p>
        <h2 className="arch-design-panel-title">PebbleDB system map</h2>
        <p className="arch-design-panel-body">
          Infinite architecture space for the exact layered design of PebbleDB: client API,
          in-memory LSM state, background workers, engine packages, and on-disk layout.
          Tap any node to inspect it.
        </p>
        <Link to={GRAPH_META.guideEntry} className="arch-design-link-btn">
          Read system overview →
        </Link>
      </>
    );
  }

  return (
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
              const otherLabel = nodes.find((n) => n.id === otherId)?.label || otherId;
              const dir = e.from === selected.id ? "→" : "←";
              return (
                <li key={e.id}>
                  <button type="button" onClick={() => onSelectConnection(otherId)}>
                    {dir} {otherLabel}
                  </button>
                </li>
              );
            })}
        </ul>
      </div>
    </>
  );
}

export default function ArchitectureDesignPage() {
  const viewportRef = useRef(null);
  const [transform, setTransform] = useState({ x: 40, y: 24, scale: 0.55 });
  const [selectedId, setSelectedId] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [spaceDown, setSpaceDown] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const dragRef = useRef(null);
  const pinchRef = useRef(null);
  const isMobile = useIsMobile(960);
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
    const pad = width < 640 ? 24 : 80;
    const maxFit = width < 640 ? 0.95 : 1.1;
    const scale = clamp(
      Math.min((width - pad) / bounds.width, (height - pad) / bounds.height),
      MIN_SCALE,
      maxFit,
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
      if (e.key === "Escape") {
        setSelectedId(null);
        setPanelOpen(false);
        setMenuOpen(false);
      }
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

  const zoomByButton = useCallback(
    (delta) => {
      const el = viewportRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, transform.scale + delta);
    },
    [transform.scale, zoomAt],
  );

  const onWheel = useCallback((e) => {
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
  }, []);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return undefined;
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [onWheel]);

  const selectNode = useCallback(
    (id) => {
      setSelectedId(id);
      if (isMobile) setPanelOpen(true);
    },
    [isMobile],
  );

  const onPointerDown = (e) => {
    if (e.button !== 0 && e.button !== 1) return;

    // Pinch start (second finger)
    if (e.isPrimary === false || (pinchRef.current && e.pointerId !== pinchRef.current.pointers[0]?.id)) {
      const el = viewportRef.current;
      if (!el) return;
      const existing = pinchRef.current;
      if (existing && existing.pointers.length === 1) {
        existing.pointers.push({ id: e.pointerId, x: e.clientX, y: e.clientY });
        const [a, b] = existing.pointers;
        existing.startDist = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        existing.startScale = transform.scale;
        existing.startMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        dragRef.current = null;
        el.setPointerCapture(e.pointerId);
      }
      return;
    }

    const onNode = Boolean(e.target.closest?.(".arch-canvas-node"));
    const panning =
      e.button === 1 ||
      spaceDown ||
      e.target === e.currentTarget ||
      e.target.dataset?.canvasBg === "1" ||
      onNode;

    if (!panning) return;

    e.currentTarget.setPointerCapture(e.pointerId);
    pinchRef.current = {
      pointers: [{ id: e.pointerId, x: e.clientX, y: e.clientY }],
      startDist: 0,
      startScale: transform.scale,
      startMid: { x: e.clientX, y: e.clientY },
    };
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX: transform.x,
      origY: transform.y,
      moved: false,
      onNode,
      nodeId: onNode ? e.target.closest(".arch-canvas-node")?.dataset?.nodeId : null,
    };
  };

  const onPointerMove = (e) => {
    const pinch = pinchRef.current;
    if (pinch && pinch.pointers.length >= 1) {
      const idx = pinch.pointers.findIndex((p) => p.id === e.pointerId);
      if (idx >= 0) {
        pinch.pointers[idx] = { id: e.pointerId, x: e.clientX, y: e.clientY };
      }

      if (pinch.pointers.length === 2 && pinch.startDist > 0) {
        const [a, b] = pinch.pointers;
        const dist = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const nextScale = clamp(pinch.startScale * (dist / pinch.startDist), MIN_SCALE, MAX_SCALE);
        zoomAt(mid.x, mid.y, nextScale);
        return;
      }
    }

    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) > PAN_THRESHOLD) {
      drag.moved = true;
    }
    if (!drag.moved && drag.onNode) return;

    setTransform((prev) => ({
      ...prev,
      x: drag.origX + dx,
      y: drag.origY + dy,
    }));
  };

  const onPointerUp = (e) => {
    const drag = dragRef.current;
    if (drag && drag.pointerId === e.pointerId) {
      if (!drag.moved && drag.onNode && drag.nodeId) {
        selectNode(drag.nodeId);
      }
      dragRef.current = null;
    }

    const pinch = pinchRef.current;
    if (pinch) {
      pinch.pointers = pinch.pointers.filter((p) => p.id !== e.pointerId);
      if (pinch.pointers.length < 2) {
        pinch.startDist = 0;
      }
      if (pinch.pointers.length === 0) {
        pinchRef.current = null;
      }
    }
  };

  const closePanel = () => {
    setPanelOpen(false);
    if (isMobile) setSelectedId(null);
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
              <span className="arch-design-subtitle-full">
                {GRAPH_META.project} · {GRAPH_META.subtitle}
              </span>
              <span className="arch-design-subtitle-short">{GRAPH_META.project}</span>
            </p>
          </div>
        </div>

        <div className="arch-design-toolbar-right">
          <span className="arch-design-evidence">{GRAPH_META.evidence}</span>
          <div className="arch-design-zoom" role="group" aria-label="Zoom controls">
            <button type="button" className="arch-design-icon-btn" onClick={() => zoomByButton(-0.12)} aria-label="Zoom out">
              −
            </button>
            <span className="arch-design-zoom-label">{Math.round(transform.scale * 100)}%</span>
            <button type="button" className="arch-design-icon-btn" onClick={() => zoomByButton(0.12)} aria-label="Zoom in">
              +
            </button>
            <button type="button" className="arch-design-icon-btn" onClick={fitToView} aria-label="Fit to view">
              Fit
            </button>
          </div>

          <div className="arch-design-desktop-links">
            <Link to={GRAPH_META.guideEntry} className="arch-design-link-btn">
              System overview
            </Link>
            <a href={GRAPH_META.github} target="_blank" rel="noopener noreferrer" className="arch-design-link-btn">
              GitHub
            </a>
          </div>

          <button
            type="button"
            className="arch-design-icon-btn arch-design-menu-toggle"
            aria-expanded={menuOpen}
            aria-controls="arch-design-mobile-menu"
            onClick={() => setMenuOpen((v) => !v)}
          >
            Menu
          </button>
        </div>

        {menuOpen && (
          <div id="arch-design-mobile-menu" className="arch-design-mobile-menu">
            <Link to={GRAPH_META.guideEntry} className="arch-design-link-btn" onClick={() => setMenuOpen(false)}>
              System overview docs
            </Link>
            <a
              href={GRAPH_META.github}
              target="_blank"
              rel="noopener noreferrer"
              className="arch-design-link-btn"
              onClick={() => setMenuOpen(false)}
            >
              GitHub repo
            </a>
            <p className="arch-design-mobile-evidence">{GRAPH_META.evidence}</p>
          </div>
        )}
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
          aria-label="PebbleDB architecture infinite canvas. Drag to pan, pinch or use buttons to zoom."
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
                  data-node-id={node.id}
                  className={`${kindClass(node.kind)}${isSelected ? " is-selected" : ""}`}
                  style={{ left: node.x, top: node.y, width: w, height: h }}
                  onClick={(ev) => {
                    // Desktop click; mobile selection handled in pointerup after pan threshold
                    if (!isMobile) {
                      ev.stopPropagation();
                      selectNode(node.id);
                    }
                  }}
                >
                  <span className="arch-canvas-node-label">{node.label}</span>
                  {node.path && <span className="arch-canvas-node-path">{node.path}</span>}
                </button>
              );
            })}
          </div>

          <p className="arch-canvas-hint arch-canvas-hint--desktop">
            Drag to pan · Scroll to zoom · Space+drag · Click a node for details
          </p>
          <p className="arch-canvas-hint arch-canvas-hint--mobile">
            Drag to pan · Pinch or +/− to zoom · Tap a node for details
          </p>

          <div className="arch-canvas-fab" aria-hidden={false}>
            <button type="button" className="arch-design-icon-btn" onClick={() => zoomByButton(-0.12)} aria-label="Zoom out">
              −
            </button>
            <button type="button" className="arch-design-icon-btn" onClick={() => zoomByButton(0.12)} aria-label="Zoom in">
              +
            </button>
            <button type="button" className="arch-design-icon-btn" onClick={fitToView} aria-label="Fit to view">
              Fit
            </button>
          </div>
        </div>

        {/* Desktop side panel */}
        <aside className="arch-design-panel arch-design-panel--desktop" aria-label="Node details">
          <DetailPanelContent selected={selected} onSelectConnection={selectNode} />
        </aside>
      </div>

      {/* Mobile bottom sheet */}
      {isMobile && panelOpen && (
        <>
          <button type="button" className="arch-design-sheet-backdrop" aria-label="Close details" onClick={closePanel} />
          <aside className="arch-design-panel arch-design-panel--sheet" aria-label="Node details">
            <div className="arch-design-sheet-handle" aria-hidden="true" />
            <div className="arch-design-sheet-header">
              <button type="button" className="arch-design-icon-btn" onClick={closePanel} aria-label="Close">
                Close
              </button>
            </div>
            <div className="arch-design-sheet-body">
              <DetailPanelContent selected={selected} onSelectConnection={selectNode} />
            </div>
          </aside>
        </>
      )}
    </div>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  GRAPH_META,
  edges,
  getGraphBounds,
  getNodeMap,
  groups,
  nodes,
} from "./data/graph";
import { flows } from "./data/flows";
import { getDecisionForNode } from "./data/index";

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

// Helper to construct GitHub links for source verification
function getGithubSourceUrl(path, codeRef) {
  const base = "https://github.com/RUDRA-PRATAP-SINGH01/PebbleDB/blob/main";
  if (!path) return null;
  let url = `${base}/${path}`;
  if (codeRef && codeRef.lineStart) {
    url += `#L${codeRef.lineStart}`;
    if (codeRef.lineEnd) {
      url += `-L${codeRef.lineEnd}`;
    }
  }
  return url;
}

export default function ArchitectureDesignPage() {
  const viewportRef = useRef(null);
  const [transform, setTransform] = useState({ x: 40, y: 24, scale: 0.55 });
  const [selectedId, setSelectedId] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [spaceDown, setSpaceDown] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  
  // Tab State
  const [inspectorTab, setInspectorTab] = useState("overview"); // 'overview' | 'technical' | 'evidence' | 'failures'
  
  // Flow Walkthrough State
  const [activeFlowId, setActiveFlowId] = useState("");
  const [activeStepIndex, setActiveStepIndex] = useState(-1);

  const dragRef = useRef(null);
  const pinchRef = useRef(null);
  const isMobile = useIsMobile(960);
  const nodeMap = useMemo(() => getNodeMap(), []);
  const bounds = useMemo(() => getGraphBounds(), []);
  const selectedNode = selectedId ? nodeMap[selectedId] : null;
  const decision = selectedId ? getDecisionForNode(selectedId) : null;

  useEffect(() => {
    document.title = "Explore PebbleDB — Interactive Architecture Inspector";
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
        setActiveFlowId("");
        setActiveStepIndex(-1);
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

  // Center a specific node on the canvas with smooth zoom
  const centerNode = useCallback((nodeId) => {
    const el = viewportRef.current;
    if (!el || !nodeId) return;
    const node = nodeMap[nodeId];
    if (!node) return;
    const { width, height } = el.getBoundingClientRect();
    const targetScale = 0.85; // Balanced detail scale
    const nc = nodeCenter(node);
    setTransform({
      scale: targetScale,
      x: width / 2 - nc.x * targetScale,
      y: height / 2 - nc.y * targetScale,
    });
  }, [nodeMap]);

  const selectNode = useCallback(
    (id) => {
      setSelectedId(id);
      setPanelOpen(true);
      centerNode(id);
    },
    [centerNode],
  );

  // Flow walking control helper
  const selectFlowStep = useCallback((flow, stepIdx) => {
    setActiveStepIndex(stepIdx);
    if (stepIdx >= 0 && stepIdx < flow.steps.length) {
      const step = flow.steps[stepIdx];
      setSelectedId(step.nodeId);
      centerNode(step.nodeId);
    }
  }, [centerNode]);

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
    setSelectedId(null);
    setActiveFlowId("");
    setActiveStepIndex(-1);
  };

  // Search filter logic
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return nodes.filter((node) => {
      const dec = getDecisionForNode(node.id);
      const matchesNode =
        node.label.toLowerCase().includes(query) ||
        (node.path && node.path.toLowerCase().includes(query)) ||
        node.summary.toLowerCase().includes(query);
      
      const matchesDecision = dec
        ? dec.title.toLowerCase().includes(query) ||
          dec.category.toLowerCase().includes(query) ||
          dec.whyItExists.problem.toLowerCase().includes(query) ||
          (dec.lld && dec.lld.implementation.some(impl => impl.toLowerCase().includes(query)))
        : false;

      return matchesNode || matchesDecision;
    });
  }, [searchQuery]);

  // Derived flow information for layout highlight
  const flowNodeIds = useMemo(() => {
    if (!activeFlowId) return new Set();
    const flow = flows.find(f => f.id === activeFlowId);
    return new Set(flow ? flow.steps.map(s => s.nodeId) : []);
  }, [activeFlowId]);

  const flowEdges = useMemo(() => {
    if (!activeFlowId) return new Set();
    const flow = flows.find(f => f.id === activeFlowId);
    if (!flow) return new Set();
    const activeEdgeIds = new Set();
    
    // An edge is in the flow if it links adjacent step nodes in correct order
    for (let i = 0; i < flow.steps.length - 1; i++) {
      const fromNodeId = flow.steps[i].nodeId;
      const toNodeId = flow.steps[i + 1].nodeId;
      const edge = edges.find(
        e => (e.from === fromNodeId && e.to === toNodeId) || 
             (e.from === toNodeId && e.to === fromNodeId)
      );
      if (edge) {
        activeEdgeIds.add(edge.id);
      }
    }
    return activeEdgeIds;
  }, [activeFlowId]);

  const activeTransitionEdgeId = useMemo(() => {
    if (!activeFlowId || activeStepIndex <= 0) return null;
    const flow = flows.find(f => f.id === activeFlowId);
    if (!flow) return null;
    const fromNodeId = flow.steps[activeStepIndex - 1].nodeId;
    const toNodeId = flow.steps[activeStepIndex].nodeId;
    const edge = edges.find(
      e => (e.from === fromNodeId && e.to === toNodeId) || 
           (e.from === toNodeId && e.to === fromNodeId)
    );
    return edge ? edge.id : null;
  }, [activeFlowId, activeStepIndex]);

  const activeStepNodeId = useMemo(() => {
    if (!activeFlowId || activeStepIndex === -1) return null;
    const flow = flows.find(f => f.id === activeFlowId);
    return flow && flow.steps[activeStepIndex] ? flow.steps[activeStepIndex].nodeId : null;
  }, [activeFlowId, activeStepIndex]);

  return (
    <div className="arch-design-page">
      <header className="arch-design-toolbar">
        <div className="arch-design-toolbar-left">
          <Link to="/project-docs" className="arch-design-back">
            ← Docs
          </Link>
          <div className="arch-design-title-block">
            <h1 className="arch-design-title">Explore PebbleDB</h1>
            <p className="arch-design-subtitle">
              <span className="arch-design-subtitle-full">
                Interactive Architecture Inspector & Operational Flow Walkthroughs
              </span>
              <span className="arch-design-subtitle-short">PebbleDB Explorer</span>
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
        {/* Infinite interactive canvas */}
        <div
          ref={viewportRef}
          className={`arch-canvas-viewport${spaceDown ? " arch-canvas-viewport--pan" : ""}${
            activeFlowId ? " arch-canvas-viewport--flow-active" : ""
          }`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          role="application"
          aria-label="PebbleDB architecture canvas. Drag to pan, pinch/wheel to zoom."
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
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#ff5cad" />
                </marker>
                <marker id="arch-arrow-dim" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#52525b" />
                </marker>
              </defs>
              {edges.map((edge) => {
                const fromNode = nodeMap[edge.from];
                const toNode = nodeMap[edge.to];
                if (!fromNode || !toNode) return null;
                const a = nodeCenter(fromNode);
                const b = nodeCenter(toNode);
                const midY = (a.y + b.y) / 2;
                const d = `M ${a.x} ${a.y} C ${a.x} ${midY}, ${b.x} ${midY}, ${b.x} ${b.y}`;
                
                // Determine flow highlight classes
                const isSelectedEdge = selectedId && (edge.from === selectedId || edge.to === selectedId);
                const isInFlow = flowEdges.has(edge.id);
                const isTransition = edge.id === activeTransitionEdgeId;
                
                let edgeClass = "arch-canvas-edge";
                if (isSelectedEdge) edgeClass += " arch-canvas-edge--active";
                if (isInFlow) edgeClass += " is-in-flow";
                if (isTransition) edgeClass += " is-in-flow-active";

                return (
                  <path
                    key={edge.id}
                    d={d}
                    className={edgeClass}
                    markerEnd={`url(#${isInFlow || isSelectedEdge ? "arch-arrow" : "arch-arrow-dim"})`}
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
              
              // Determine flow highlight classes
              const isInFlow = flowNodeIds.has(node.id);
              const isActiveStepNode = node.id === activeStepNodeId;
              
              let nodeClasses = kindClass(node.kind);
              if (isSelected) nodeClasses += " is-selected";
              if (isInFlow) nodeClasses += " is-in-flow";
              if (isActiveStepNode) nodeClasses += " is-in-flow-active";

              return (
                <button
                  key={node.id}
                  type="button"
                  data-node-id={node.id}
                  className={nodeClasses}
                  style={{ left: node.x, top: node.y, width: w, height: h }}
                  onClick={(ev) => {
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
            Drag to pan · Scroll to zoom · Space+drag · Click a node for detailed HLD/LLD inspector
          </p>
          <p className="arch-canvas-hint arch-canvas-hint--mobile">
            Drag to pan · Pinch or +/− to zoom · Tap a node for detailed inspector
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

        {/* Desktop Side Inspector Panel */}
        <aside className="arch-design-sidebar arch-design-panel--desktop" style={{ width: 440, minWidth: 440 }} aria-label="Interactive Inspector">
          {/* Node Search and Filter */}
          <div className="arch-design-search-container">
            <div className="arch-design-search-input-wrapper">
              <input
                type="text"
                className="arch-design-search-input"
                placeholder="Search components, symbols, files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button type="button" className="arch-design-search-clear" onClick={() => setSearchQuery("")}>
                  ✕
                </button>
              )}
            </div>
            {searchQuery && (
              <div className="arch-design-search-results">
                {searchResults.length > 0 ? (
                  searchResults.map((node) => (
                    <button
                      key={node.id}
                      type="button"
                      className="arch-design-search-result-item"
                      onClick={() => {
                        selectNode(node.id);
                        setSearchQuery("");
                      }}
                    >
                      <h4>{node.label}</h4>
                      <span>{node.path || "Component"}</span>
                    </button>
                  ))
                ) : (
                  <div style={{ padding: 12, fontSize: 12, color: "#71717a" }}>No matches found</div>
                )}
              </div>
            )}
          </div>

          {/* Operational Flow Walkthrough Trigger */}
          <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "#0a0a0c" }}>
            <div className="arch-design-flows-container">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#ff5cad" }}>
                  Operational Flows
                </span>
                {activeFlowId && (
                  <button
                    type="button"
                    style={{ background: "none", border: "none", color: "#71717a", fontSize: 11, cursor: "pointer", padding: 0 }}
                    onClick={() => {
                      setActiveFlowId("");
                      setActiveStepIndex(-1);
                    }}
                  >
                    Clear Walkthrough
                  </button>
                )}
              </div>
              <select
                className="arch-design-flow-select"
                value={activeFlowId}
                onChange={(e) => {
                  const flowId = e.target.value;
                  setActiveFlowId(flowId);
                  if (flowId) {
                    const flow = flows.find(f => f.id === flowId);
                    selectFlowStep(flow, 0);
                  } else {
                    setActiveStepIndex(-1);
                  }
                }}
              >
                <option value="">-- Choose Walkthrough Flow --</option>
                {flows.map((f) => (
                  <option key={f.id} value={f.id}>{f.title}</option>
                ))}
              </select>
              {activeFlowId && (
                <p className="arch-design-flow-desc">
                  {flows.find(f => f.id === activeFlowId)?.description}
                </p>
              )}
            </div>
            {activeFlowId && (
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button
                  type="button"
                  className="arch-design-link-btn"
                  style={{ flex: 1, textAlign: "center", fontSize: 11, padding: "6px 8px" }}
                  disabled={activeStepIndex <= 0}
                  onClick={() => selectFlowStep(flows.find(f => f.id === activeFlowId), activeStepIndex - 1)}
                >
                  ◀ Previous
                </button>
                <button
                  type="button"
                  className="arch-design-link-btn"
                  style={{ flex: 1, textAlign: "center", fontSize: 11, padding: "6px 8px" }}
                  disabled={activeStepIndex >= flows.find(f => f.id === activeFlowId).steps.length - 1}
                  onClick={() => selectFlowStep(flows.find(f => f.id === activeFlowId), activeStepIndex + 1)}
                >
                  Next ▶
                </button>
              </div>
            )}
          </div>

          {/* Main Inspector Tabs */}
          {selectedId && (
            <div className="arch-design-tab-bar">
              <button
                type="button"
                className={`arch-design-tab-btn${inspectorTab === "overview" ? " arch-design-tab-btn--active" : ""}`}
                onClick={() => setInspectorTab("overview")}
              >
                Overview
              </button>
              <button
                type="button"
                className={`arch-design-tab-btn${inspectorTab === "technical" ? " arch-design-tab-btn--active" : ""}`}
                onClick={() => setInspectorTab("technical")}
              >
                Technical
              </button>
              <button
                type="button"
                className={`arch-design-tab-btn${inspectorTab === "evidence" ? " arch-design-tab-btn--active" : ""}`}
                onClick={() => setInspectorTab("evidence")}
              >
                Evidence
              </button>
              <button
                type="button"
                className={`arch-design-tab-btn${inspectorTab === "failures" ? " arch-design-tab-btn--active" : ""}`}
                onClick={() => setInspectorTab("failures")}
              >
                Failures
              </button>
            </div>
          )}

          {/* Inspector Content Panel */}
          <div className="arch-design-panel-content">
            {!selectedId ? (
              activeFlowId ? (
                // Walkthrough steps list
                <div className="arch-design-flow-steps">
                  <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "#71717a", marginBottom: 4 }}>
                    Flow Progression Steps
                  </span>
                  {flows.find(f => f.id === activeFlowId).steps.map((step, idx) => {
                    const isStepActive = idx === activeStepIndex;
                    return (
                      <div
                        key={step.id}
                        className={`arch-design-flow-step-card${isStepActive ? " arch-design-flow-step-card--active" : ""}`}
                        onClick={() => selectFlowStep(flows.find(f => f.id === activeFlowId), idx)}
                      >
                        <div className="arch-design-flow-step-header">
                          <span className="arch-design-flow-step-label">{step.label}</span>
                          <span className="arch-design-flow-step-node-badge">
                            {nodeMap[step.nodeId]?.label || step.nodeId}
                          </span>
                        </div>
                        <p className="arch-design-flow-step-body">{step.description}</p>
                        {step.codeRef && (
                          <a
                            href={getGithubSourceUrl(step.codeRef.path, step.codeRef)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="arch-code-link"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span>Go Source:</span> {step.codeRef.symbol || step.codeRef.path}
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                // Default Canvas State
                <>
                  <p className="arch-design-panel-kicker">Embedded LSM-Tree</p>
                  <h2 className="arch-design-panel-title">PebbleDB Architecture</h2>
                  <p className="arch-design-panel-body">
                    Explore the complete internals of PebbleDB: a single-process embedded Key-Value engine implemented in Go.
                  </p>
                  <div style={{ marginTop: 24 }} className="arch-card-nested">
                    <h4 style={{ margin: "0 0 6px", fontSize: 12, color: "#fff", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      How to inspect:
                    </h4>
                    <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: "#a1a1aa", lineHeight: 1.6 }}>
                      <li>Click any node on the infinite canvas to view structural HLD, verified implementation details, concurrency parameters, and failure recovery.</li>
                      <li>Select an <strong>Operational Flow Walkthrough</strong> from the dropdown above to walk step-by-step through read, write, flush, compaction, or crash-recovery paths.</li>
                    </ul>
                  </div>
                  <Link to={GRAPH_META.guideEntry} className="arch-design-link-btn" style={{ marginTop: 20, display: "inline-block" }}>
                    Read PebbleDB System Overview →
                  </Link>
                </>
              )
            ) : (
              // Component Specific Tabs Detail
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div>
                    <span className="arch-design-panel-kicker">{decision ? decision.category : selectedNode.kind}</span>
                    <h2 className="arch-design-panel-title" style={{ margin: 0 }}>{decision ? decision.title : selectedNode.label}</h2>
                    {selectedNode.path && (
                      <p className="arch-design-panel-path" style={{ margin: "4px 0 0" }}>
                        <code>{selectedNode.path}</code>
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    style={{ background: "none", border: "none", color: "#ff5cad", fontSize: 18, cursor: "pointer", padding: "0 4px" }}
                    onClick={() => {
                      setSelectedId(null);
                      if (activeFlowId) {
                        // Keep flow open but unselect current node
                        setSelectedId(null);
                      } else {
                        closePanel();
                      }
                    }}
                    aria-label="Close details"
                  >
                    ✕
                  </button>
                </div>

                {/* TAB 1: OVERVIEW */}
                {inspectorTab === "overview" && (
                  <div>
                    <p className="arch-design-panel-body" style={{ fontSize: 13.5, color: "#e4e4e7" }}>
                      {decision ? decision.summary : selectedNode.summary}
                    </p>

                    {decision && (
                      <>
                        <div className="arch-details-section">
                          <h3>Ownership Boundaries</h3>
                          <h4 style={{ fontSize: 11, textTransform: "uppercase", color: "#71717a", margin: "8px 0 4px" }}>What it owns:</h4>
                          <ul className="arch-details-list">
                            {decision.responsibility.owns.map((o, idx) => (
                              <li key={idx}>{o}</li>
                            ))}
                          </ul>
                          <h4 style={{ fontSize: 11, textTransform: "uppercase", color: "#71717a", margin: "8px 0 4px" }}>What it does NOT own:</h4>
                          <ul className="arch-details-list">
                            {decision.responsibility.doesNotOwn.map((n, idx) => (
                              <li key={idx}>{n}</li>
                            ))}
                          </ul>
                        </div>

                        <div className="arch-details-section">
                          <h3>Why it exists</h3>
                          <div className="arch-card-nested">
                            <h4 style={{ color: "#f87171", fontSize: 11, textTransform: "uppercase", margin: "0 0 4px" }}>The Problem:</h4>
                            <p style={{ margin: "0 0 8px", fontSize: 12 }}>{decision.whyItExists.problem}</p>
                            <h4 style={{ color: "#fbbf24", fontSize: 11, textTransform: "uppercase", margin: "0 0 4px" }}>The Constraint:</h4>
                            <p style={{ margin: "0 0 8px", fontSize: 12 }}>{decision.whyItExists.constraint}</p>
                            <h4 style={{ color: "#34d399", fontSize: 11, textTransform: "uppercase", margin: "0 0 4px" }}>Design Decision:</h4>
                            <p style={{ margin: "0 0 8px", fontSize: 12 }}>{decision.whyItExists.decision}</p>
                            <h4 style={{ color: "#60a5fa", fontSize: 11, textTransform: "uppercase", margin: "0 0 4px" }}>System Result:</h4>
                            <p style={{ margin: 0, fontSize: 12 }}>{decision.whyItExists.result}</p>
                          </div>
                        </div>

                        {decision.qualityImpacts && (
                          <div className="arch-details-section">
                            <h3>Impact on Qualities</h3>
                            {decision.qualityImpacts.map((q, idx) => (
                              <div key={idx} className="arch-card-nested" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                  <strong style={{ fontSize: 12, color: "#fff" }}>{q.quality}</strong>
                                  <span style={{
                                    fontSize: 9,
                                    fontWeight: 700,
                                    color: q.direction.includes("positive") ? "#34d399" : "#fbbf24",
                                    textTransform: "uppercase"
                                  }}>{q.direction}</span>
                                </div>
                                <p style={{ margin: 0, fontSize: 11, color: "#a1a1aa" }}>{q.explanation}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* TAB 2: TECHNICAL DETAIL */}
                {inspectorTab === "technical" && decision && (
                  <div>
                    <div className="arch-details-section">
                      <h3>Architecture Level</h3>
                      <div className="arch-card-nested" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#ff5cad" }}>
                          {decision.classification.level}
                        </span>
                        <span className="arch-provenance-badge arch-provenance-badge--configured">
                          VERIFIED
                        </span>
                      </div>
                      <p style={{ marginTop: 6, fontSize: 12 }}>{decision.classification.explanation}</p>
                    </div>

                    <div className="arch-details-section">
                      <h3>HLD Architectural Role</h3>
                      <p style={{ fontSize: 12.5, lineHeight: 1.5, color: "#e4e4e7" }}>
                        {decision.hld.architecturalRole}
                      </p>
                      <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
                        <div style={{ flex: 1 }}>
                          <h4 style={{ fontSize: 10, textTransform: "uppercase", color: "#71717a" }}>Upstream:</h4>
                          <div style={{ fontSize: 11, color: "#fff", display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {decision.hld.upstream.length > 0 ? decision.hld.upstream.map(id => (
                              <button key={id} type="button" className="arch-provenance-badge" style={{ cursor: "pointer", background: "#18181b", border: "1px solid #3f3f46", color: "#fff" }} onClick={() => selectNode(id)}>
                                {nodeMap[id]?.label || id}
                              </button>
                            )) : <span style={{ color: "#71717a" }}>None</span>}
                          </div>
                        </div>
                        <div style={{ flex: 1 }}>
                          <h4 style={{ fontSize: 10, textTransform: "uppercase", color: "#71717a" }}>Downstream:</h4>
                          <div style={{ fontSize: 11, color: "#fff", display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {decision.hld.downstream.length > 0 ? decision.hld.downstream.map(id => (
                              <button key={id} type="button" className="arch-provenance-badge" style={{ cursor: "pointer", background: "#18181b", border: "1px solid #3f3f46", color: "#fff" }} onClick={() => selectNode(id)}>
                                {nodeMap[id]?.label || id}
                              </button>
                            )) : <span style={{ color: "#71717a" }}>None</span>}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="arch-details-section">
                      <h3>State & Concurrency Control</h3>
                      <div className="arch-card-nested">
                        <h4 style={{ fontSize: 10, textTransform: "uppercase", color: "#ffb3d4", margin: "0 0 4px" }}>Data Ownership:</h4>
                        <ul style={{ margin: "0 0 8px 0", paddingLeft: 14, fontSize: 11.5, color: "#a1a1aa" }}>
                          {decision.hld.dataOwnership.map((d, idx) => <li key={idx}>{d}</li>)}
                        </ul>
                        <h4 style={{ fontSize: 10, textTransform: "uppercase", color: "#ffb3d4", margin: "0 0 4px" }}>Control & Synchronization:</h4>
                        <ul style={{ margin: "0 0 8px 0", paddingLeft: 14, fontSize: 11.5, color: "#a1a1aa" }}>
                          {decision.hld.controlOwnership.map((c, idx) => <li key={idx}>{c}</li>)}
                        </ul>
                        <h4 style={{ fontSize: 10, textTransform: "uppercase", color: "#ffb3d4", margin: "0 0 4px" }}>Persistence Boundary:</h4>
                        <p style={{ margin: 0, fontSize: 11.5, color: "#a1a1aa" }}>{decision.hld.persistenceResponsibility}</p>
                      </div>
                    </div>

                    {decision.lld && (
                      <div className="arch-details-section">
                        <h3>Low-Level Design (LLD) Details</h3>
                        <h4 style={{ fontSize: 11, textTransform: "uppercase", color: "#71717a", margin: "8px 0 4px" }}>Implementation:</h4>
                        <ul className="arch-details-list">
                          {decision.lld.implementation.map((impl, idx) => (
                            <li key={idx}>{impl}</li>
                          ))}
                        </ul>
                        {decision.lld.concurrency && (
                          <>
                            <h4 style={{ fontSize: 11, textTransform: "uppercase", color: "#71717a", margin: "8px 0 4px" }}>Locking Protocol:</h4>
                            <ul className="arch-details-list">
                              {decision.lld.concurrency.map((con, idx) => (
                                <li key={idx}>{con}</li>
                              ))}
                            </ul>
                          </>
                        )}
                        {decision.lld.stateTransitions && (
                          <>
                            <h4 style={{ fontSize: 11, textTransform: "uppercase", color: "#71717a", margin: "8px 0 4px" }}>State Transitions:</h4>
                            <ul className="arch-details-list">
                              {decision.lld.stateTransitions.map((st, idx) => (
                                <li key={idx}>{st}</li>
                              ))}
                            </ul>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 3: EVIDENCE & ALTERNATIVES */}
                {inspectorTab === "evidence" && decision && (
                  <div>
                    <div className="arch-details-section">
                      <h3>Provenance Certification</h3>
                      <div className="arch-card-nested" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#fff" }}>
                          Status:
                        </span>
                        <span className={`arch-provenance-badge arch-provenance-badge--${decision.evidenceStatus}`}>
                          {decision.evidenceStatus}
                        </span>
                      </div>
                    </div>

                    <div className="arch-details-section">
                      <h3>Go Source Provenance Links</h3>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {decision.sources.map((s, idx) => (
                          <div key={idx} className="arch-card-nested" style={{ margin: 0, padding: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                              <strong style={{ fontSize: 12, color: "#fff" }}>{s.label}</strong>
                              {s.symbol && <span style={{ fontSize: 10, color: "#71717a", marginLeft: 6 }}>({s.symbol})</span>}
                            </div>
                            <a
                              href={getGithubSourceUrl(s.path, s)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="arch-provenance-badge arch-provenance-badge--source-verified"
                              style={{ textDecoration: "none" }}
                            >
                              Open Code ↗
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>

                    {decision.metrics && (
                      <div className="arch-details-section">
                        <h3>Sizing & Performance Metrics</h3>
                        <div className="arch-evidence-metrics">
                          {decision.metrics.map((m, idx) => (
                            <div key={idx} className="arch-metric-card">
                              <div className="arch-metric-header">
                                <span className="arch-metric-name">{m.name}</span>
                                <span className={`arch-provenance-badge arch-provenance-badge--${m.evidenceType}`}>
                                  {m.evidenceType}
                                </span>
                              </div>
                              {m.evidenceType !== "not-measured" ? (
                                <div className="arch-metric-value-block">
                                  <span className="arch-metric-value">{m.value}</span>
                                  {m.unit && <span className="arch-metric-unit">{m.unit}</span>}
                                </div>
                              ) : (
                                <span style={{ fontSize: 11, color: "#f87171", fontWeight: 700 }}>NOT MEASURED YET</span>
                              )}
                              {m.source && (
                                <div className="arch-metric-footer">
                                  <a href={getGithubSourceUrl(m.source.path, m.source)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: "#ffb3d4", textDecoration: "none" }}>
                                    Defined in {m.source.label}
                                  </a>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {decision.alternatives && (
                      <div className="arch-details-section" style={{ marginTop: 20 }}>
                        <h3>Design Alternatives Evaluated</h3>
                        {decision.alternatives.map((alt, idx) => (
                          <div key={idx} className="arch-card-nested" style={{ marginBottom: 12 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                              <strong style={{ fontSize: 12.5, color: "#fff" }}>{alt.name}</strong>
                              <span className="arch-provenance-badge arch-provenance-badge--theoretical" style={{ fontSize: 8 }}>
                                {alt.status}
                              </span>
                            </div>
                            <h5 style={{ fontSize: 10, textTransform: "uppercase", color: "#34d399", margin: "4px 0 2px" }}>Advantages:</h5>
                            <ul style={{ margin: "0 0 6px 0", paddingLeft: 12, fontSize: 11, color: "#a1a1aa" }}>
                              {alt.advantages.map((ad, i) => <li key={i}>{ad}</li>)}
                            </ul>
                            <h5 style={{ fontSize: 10, textTransform: "uppercase", color: "#f87171", margin: "4px 0 2px" }}>Disadvantages:</h5>
                            <ul style={{ margin: "0 0 6px 0", paddingLeft: 12, fontSize: 11, color: "#a1a1aa" }}>
                              {alt.disadvantages.map((dis, i) => <li key={i}>{dis}</li>)}
                            </ul>
                            <p style={{ fontSize: 11, margin: 0, color: "#fff" }}>
                              <strong>Fit for PebbleDB:</strong> {alt.fitForPebbleDB}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 4: FAILURES & FAULT TOLERANCE */}
                {inspectorTab === "failures" && decision && (
                  <div>
                    <div className="arch-details-section">
                      <h3>Consequences of Complete Failure</h3>
                      <div className="arch-card-nested" style={{ borderColor: "rgba(239, 68, 68, 0.4)", background: "rgba(239, 68, 68, 0.04)" }}>
                        <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: "#fca5a5", lineHeight: 1.6 }}>
                          {decision.failureWithoutComponent.map((f, idx) => (
                            <li key={idx} style={{ marginBottom: 6 }}>{f}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {decision.failureModes && (
                      <div className="arch-details-section">
                        <h3>Potential Failure Modes & Mitigation</h3>
                        {decision.failureModes.map((fm, idx) => (
                          <div key={idx} className="arch-card-nested">
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                              <strong style={{ fontSize: 12.5, color: "#fca5a5" }}>{fm.name}</strong>
                              <span className="arch-provenance-badge arch-provenance-badge--source-verified">
                                {fm.status}
                              </span>
                            </div>
                            <p style={{ margin: "0 0 6px", fontSize: 11.5 }}>{fm.explanation}</p>
                            {fm.sources && fm.sources.map((s, i) => (
                              <a
                                key={i}
                                href={getGithubSourceUrl(s.path, s)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="arch-code-link"
                                style={{ margin: 0, display: "inline-flex" }}
                              >
                                <span>Code Handler:</span> {s.symbol || s.label}
                              </a>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}

                    {decision.relatedNodes && (
                      <div className="arch-details-section">
                        <h3>Fault-Tolerance Coupling</h3>
                        <p style={{ fontSize: 11.5, color: "#a1a1aa", margin: "0 0 8px" }}>
                          Failure of this component immediately propagates to or requires coordination with the following related nodes:
                        </p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {decision.relatedNodes.map(id => (
                            <button key={id} type="button" className="arch-provenance-badge" style={{ cursor: "pointer", background: "#18181b", border: "1px solid #3f3f46", color: "#fff" }} onClick={() => selectNode(id)}>
                              {nodeMap[id]?.label || id}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Mobile Bottom Sheet Details (matching desktop capability) */}
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
              {/* Duplicate the detailed desktop sidebar content into bottom sheet for mobile accessibility */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div>
                    <span className="arch-design-panel-kicker">{decision ? decision.category : selectedNode?.kind}</span>
                    <h2 className="arch-design-panel-title" style={{ margin: 0 }}>{decision ? decision.title : selectedNode?.label}</h2>
                  </div>
                </div>

                {/* Tabs selection on mobile */}
                {selectedId && (
                  <div className="arch-design-tab-bar" style={{ marginBottom: 12 }}>
                    <button type="button" className={`arch-design-tab-btn${inspectorTab === "overview" ? " arch-design-tab-btn--active" : ""}`} onClick={() => setInspectorTab("overview")}>
                      Overview
                    </button>
                    <button type="button" className={`arch-design-tab-btn${inspectorTab === "technical" ? " arch-design-tab-btn--active" : ""}`} onClick={() => setInspectorTab("technical")}>
                      Tech
                    </button>
                    <button type="button" className={`arch-design-tab-btn${inspectorTab === "evidence" ? " arch-design-tab-btn--active" : ""}`} onClick={() => setInspectorTab("evidence")}>
                      Evidence
                    </button>
                    <button type="button" className={`arch-design-tab-btn${inspectorTab === "failures" ? " arch-design-tab-btn--active" : ""}`} onClick={() => setInspectorTab("failures")}>
                      Faults
                    </button>
                  </div>
                )}

                {selectedId && decision ? (
                  inspectorTab === "overview" ? (
                    <div>
                      <p className="arch-design-panel-body">{decision.summary}</p>
                      <h4 style={{ fontSize: 11, textTransform: "uppercase", color: "#71717a", margin: "8px 0 4px" }}>What it owns:</h4>
                      <ul className="arch-details-list">{decision.responsibility.owns.map((o, idx) => <li key={idx}>{o}</li>)}</ul>
                    </div>
                  ) : inspectorTab === "technical" ? (
                    <div>
                      <p style={{ fontSize: 12 }}>{decision.hld.architecturalRole}</p>
                      <h4 style={{ fontSize: 11, textTransform: "uppercase", color: "#71717a", margin: "8px 0 4px" }}>Implementation:</h4>
                      <ul className="arch-details-list">{decision.lld?.implementation.map((impl, idx) => <li key={idx}>{impl}</li>)}</ul>
                    </div>
                  ) : inspectorTab === "evidence" ? (
                    <div>
                      <div className="arch-card-nested" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span>Certification:</span>
                        <span className={`arch-provenance-badge arch-provenance-badge--${decision.evidenceStatus}`}>{decision.evidenceStatus}</span>
                      </div>
                      <h4 style={{ fontSize: 11, textTransform: "uppercase", color: "#71717a", margin: "12px 0 4px" }}>Verification Files:</h4>
                      {decision.sources.map((s, idx) => (
                        <div key={idx} style={{ margin: "4px 0", fontSize: 12 }}>{s.label}</div>
                      ))}
                    </div>
                  ) : (
                    <div>
                      <h4 style={{ fontSize: 11, textTransform: "uppercase", color: "#fca5a5" }}>Consequences of Failure:</h4>
                      <ul className="arch-details-list">{decision.failureWithoutComponent.map((f, idx) => <li key={idx}>{f}</li>)}</ul>
                    </div>
                  )
                ) : (
                  <p style={{ color: "#71717a", fontSize: 12 }}>No component selected. Tap any node on the canvas to inspect.</p>
                )}
              </div>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}

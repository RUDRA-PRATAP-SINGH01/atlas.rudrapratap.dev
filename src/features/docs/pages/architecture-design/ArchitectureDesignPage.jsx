import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import RouteFallback from "@/core/components/RouteFallback";
import { loadProjectPack, prefetchProjectPack } from "./data/loadProject";
import ImplementedBadges from "@/features/docs/components/ImplementedBadges";
import { computeDagLayout } from "./utils/dagLayout";
import {
  animateSignalAlongCurve,
  buildEdgeCurve,
  sleep,
} from "./utils/runtimeSignal";
import { getGithubSourceUrl } from "./utils/githubSourceUrl";
import ArchitectureTour from "./tour/ArchitectureTour";
import { hasCompletedArchTour } from "./tour/tourSteps";
import ArchCanvasViewport from "./components/ArchCanvasViewport";
import useIsMobile from "./hooks/useIsMobile";

const ZOOM_STEP = 0.15;
const SIGNAL_DURATION_MS = 780;
const NODE_DWELL_MS = 1600;

export default function ArchitectureDesignPage() {
  const canvasApiRef = useRef(null);
  const zoomLabelRef = useRef(null);
  const [searchParams, setSearchParams] = useSearchParams();

  // Read URL query parameters on initial mount for deep-linking
  const initialProject = searchParams.get("project") === "rate-limiter" ? "rate-limiter" : "pebbledb";
  const initialFlow = searchParams.get("flow") || "";
  const initialStep = searchParams.get("step") ? parseInt(searchParams.get("step"), 10) : -1;
  const initialNode = searchParams.get("node") || null;
  const initialSearch = searchParams.get("search") || "";

  const [activeProject, setActiveProject] = useState(initialProject);
  const [projectPack, setProjectPack] = useState(null);
  const [selectedId, setSelectedId] = useState(initialNode);
  const panelOpen = Boolean(selectedId);
  const [spaceDown, setSpaceDown] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  
  // Tab State
  const [inspectorTab, setInspectorTab] = useState("overview"); // 'overview' | 'technical' | 'evidence' | 'failures'
  
  // Flow Walkthrough State
  const [activeFlowId, setActiveFlowId] = useState(initialFlow);
  const [activeStepIndex, setActiveStepIndex] = useState(initialStep);
  const [isPlayingFlow, setIsPlayingFlow] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  /** Edge ids currently carrying the runtime signal */
  const [executingEdgeIds, setExecutingEdgeIds] = useState(() => new Set());
  /** edgeId → { from, to } travel orientation while the message is moving / just landed */
  const [edgeTravelDir, setEdgeTravelDir] = useState(() => new Map());
  /** Node that just received the signal (soft activation flash) */
  const [signalFocusNodeId, setSignalFocusNodeId] = useState(null);

  const signalRef = useRef(null);
  const signalArrowRef = useRef(null);
  const signalAbortRef = useRef({ current: false });
  const isPlayingFlowRef = useRef(false);
  const activeStepIndexRef = useRef(activeStepIndex);
  const activeFlowIdRef = useRef(activeFlowId);
  const transitionLockRef = useRef(false);
  const stepCardRefs = useRef(new Map());
  const panelContentRef = useRef(null);

  // Sync state → URL (one-way). Avoid depending on searchParams to prevent a
  // second effect pass after every replace.
  useEffect(() => {
    const params = new URLSearchParams();
    if (activeProject && activeProject !== "pebbledb") params.set("project", activeProject);
    if (activeFlowId) params.set("flow", activeFlowId);
    if (activeStepIndex >= 0) params.set("step", String(activeStepIndex));
    if (selectedId) params.set("node", selectedId);
    if (searchQuery) params.set("search", searchQuery);

    const newString = params.toString();
    const currentString = window.location.search.startsWith("?")
      ? window.location.search.slice(1)
      : window.location.search;

    if (currentString !== newString) {
      setSearchParams(params, { replace: true });
    }
  }, [activeProject, activeFlowId, activeStepIndex, selectedId, searchQuery, setSearchParams]);

  // Horizontal Panel Resizing State
  const [sidebarWidth, setSidebarWidth] = useState(480);
  const [isResizing, setIsResizing] = useState(false);

  const handleResizeStart = useCallback(
    (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();

      const startX = e.clientX;
      const startWidth = sidebarWidth;
      setIsResizing(true);

      const onPointerMove = (moveEvent) => {
        const deltaX = startX - moveEvent.clientX;
        const minW = 320;
        const maxW = Math.min(850, window.innerWidth - 320);
        const newWidth = Math.max(minW, Math.min(maxW, startWidth + deltaX));
        setSidebarWidth(newWidth);
      };

      const onPointerUp = () => {
        setIsResizing(false);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointercancel", onPointerUp);
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerUp);
    },
    [sidebarWidth],
  );

  const handleResizeReset = useCallback(() => {
    setSidebarWidth(480);
  }, []);

  const isMobile = useIsMobile(960);

  // Load active project pack; prefetch the other after first paint.
  useEffect(() => {
    let cancelled = false;
    loadProjectPack(activeProject).then((pack) => {
      if (!cancelled) setProjectPack(pack);
    });
    const other = activeProject === "rate-limiter" ? "pebbledb" : "rate-limiter";
    const prefetch = () => prefetchProjectPack(other);
    let idleId;
    let timeoutId;
    if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(prefetch, { timeout: 2500 });
    } else {
      timeoutId = window.setTimeout(prefetch, 1200);
    }
    return () => {
      cancelled = true;
      if (idleId != null && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId != null) window.clearTimeout(timeoutId);
    };
  }, [activeProject]);

  const packReady = projectPack?.projectId === activeProject;
  const projectMeta = packReady ? projectPack.GRAPH_META : null;
  const baseNodes = packReady ? projectPack.nodes : [];
  const baseEdges = packReady ? projectPack.edges : [];
  const baseGroups = packReady ? projectPack.groups : [];
  const baseBounds = useMemo(
    () => (packReady ? projectPack.getGraphBounds() : { minX: 0, minY: 0, maxX: 0, maxY: 0 }),
    [packReady, projectPack],
  );
  const flows = packReady ? projectPack.flows : [];
  const getDecisionForNode = packReady
    ? projectPack.getDecisionForNode
    : () => null;

  const [customLayout, setCustomLayout] = useState(null);

  const nodes = customLayout ? customLayout.nodes : baseNodes;
  const groups = customLayout ? customLayout.groups : baseGroups;
  const bounds = customLayout ? customLayout.bounds : baseBounds;
  const edges = baseEdges;

  const nodeMap = useMemo(() => {
    return Object.fromEntries(nodes.map((n) => [n.id, n]));
  }, [nodes]);

  const connectionCounts = useMemo(() => {
    const counts = {};
    for (const e of edges) {
      counts[e.from] = (counts[e.from] || 0) + 1;
      counts[e.to] = (counts[e.to] || 0) + 1;
    }
    return counts;
  }, [edges]);

  const selectedNode = selectedId ? nodeMap[selectedId] : null;
  const decision = selectedId ? getDecisionForNode(selectedId) : null;

  useEffect(() => {
    document.title = activeProject === "rate-limiter"
      ? "Explore Rate Limiter — Interactive Architecture Inspector"
      : "Explore PebbleDB — Interactive Architecture Inspector";
  }, [activeProject]);

  const handleProjectChange = (proj) => {
    setActiveProject(proj);
    setSelectedId(null);
    setMenuOpen(false);
    setActiveFlowId("");
    setActiveStepIndex(-1);
    setIsPlayingFlow(false);
    setHoveredNodeId(null);
    setSearchQuery("");
    setCustomLayout(null);
  };

  const fitToView = useCallback(() => {
    canvasApiRef.current?.fitToView();
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (tourOpen) return;
      if (e.code === "Space" && !e.repeat && e.target === document.body) {
        e.preventDefault();
        setSpaceDown(true);
      }
      if (e.key === "Escape") {
        setSelectedId(null);
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
  }, [fitToView, tourOpen]);

  // First-visit product tour
  useEffect(() => {
    if (hasCompletedArchTour()) return undefined;
    const t = window.setTimeout(() => setTourOpen(true), 700);
    return () => window.clearTimeout(t);
  }, []);

  const [hoveredNodeId, setHoveredNodeId] = useState(null);

  const centerNode = useCallback((nodeId) => {
    canvasApiRef.current?.centerNode(nodeId);
  }, []);

  const selectNode = useCallback(
    (id) => {
      setSelectedId(id);
      centerNode(id);
    },
    [centerNode],
  );

  const onHoverNode = useCallback((id) => {
    setHoveredNodeId(id);
  }, []);

  const pulseTourTarget = useCallback((selector) => {
    const el = document.querySelector(selector);
    if (!el) return;
    el.classList.add("is-tour-pulse");
    window.setTimeout(() => el.classList.remove("is-tour-pulse"), 900);
  }, []);

  const onTourStepEnter = useCallback(
    async (step) => {
      setIsPlayingFlow(false);

      if (step.action === "welcome") {
        fitToView();
        await sleep(220);
        return;
      }

      if (step.action === "pulse-fit") {
        await sleep(80);
        pulseTourTarget(".arch-zoom-btn--fit");
        return;
      }

      if (step.action === "pulse-node") {
        const sampleId = activeProject === "rate-limiter" ? "sidecar" : "api";
        if (nodeMap[sampleId]) {
          setSelectedId(sampleId);
          centerNode(sampleId);
          await sleep(280);
          pulseTourTarget('[data-tour="sample-node"]');
        }
        return;
      }

      if (step.action === "open-flow-select") {
        const select = document.querySelector('[data-tour="flow-select"]');
        if (select) {
          select.scrollIntoView({ behavior: "smooth", block: "nearest" });
          select.focus({ preventScroll: true });
          try {
            if (typeof select.showPicker === "function") {
              select.showPicker();
              await sleep(700);
              select.blur();
            } else {
              select.size = Math.min(5, 1 + flows.length);
              await sleep(700);
              select.size = 1;
            }
          } catch {
            /* showPicker may require a user gesture */
          }
        }
        return;
      }

      if (step.action === "pulse-play") {
        if (!activeFlowIdRef.current && flows[0]) {
          setActiveFlowId(flows[0].id);
          setActiveStepIndex(0);
          setIsPlayingFlow(false);
          setSelectedId(null);
          await sleep(220);
        } else if (activeFlowIdRef.current) {
          setIsPlayingFlow(false);
          await sleep(60);
        }
        await sleep(80);
        pulseTourTarget('[data-tour="flow-play"]');
      }
    },
    [activeProject, centerNode, fitToView, flows, nodeMap, pulseTourTarget],
  );

  const ensureTourTargetVisible = useCallback(
    async (el, step) => {
      if (!el) return;

      if (step?.action === "welcome") {
        fitToView();
        await sleep(220);
        return;
      }

      if (step?.action === "pulse-node") {
        const sampleId = activeProject === "rate-limiter" ? "sidecar" : "api";
        if (nodeMap[sampleId]) {
          centerNode(sampleId);
          await sleep(280);
        }
        return;
      }

      el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
      await sleep(200);
    },
    [activeProject, centerNode, fitToView, nodeMap],
  );

  const handleTourClose = useCallback(({ replay } = {}) => {
    setTourOpen(false);
    if (replay) {
      window.setTimeout(() => setTourOpen(true), 80);
    }
  }, []);

  const runAutoLayout = useCallback(() => {
    const layout = computeDagLayout(baseNodes, baseEdges, baseGroups);
    setCustomLayout(layout);
    // fitToView runs via the customLayout effect — avoid a second camera jump
  }, [baseNodes, baseEdges, baseGroups]);

  const closePanel = () => {
    setSelectedId(null);
    setActiveFlowId("");
    setActiveStepIndex(-1);
  };

  // Search filter logic
  const matchingNodeIds = useMemo(() => {
    if (!searchQuery.trim()) return new Set();
    const query = searchQuery.toLowerCase().trim();
    return new Set(
      nodes
        .filter((node) => {
          const dec = getDecisionForNode(node.id);
          return (
            node.label.toLowerCase().includes(query) ||
            (node.path && node.path.toLowerCase().includes(query)) ||
            (node.summary && node.summary.toLowerCase().includes(query)) ||
            (node.kind && node.kind.toLowerCase().includes(query)) ||
            (dec && dec.problem && dec.problem.toLowerCase().includes(query))
          );
        })
        .map((n) => n.id)
    );
  }, [searchQuery, nodes, getDecisionForNode]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return nodes.filter((node) => matchingNodeIds.has(node.id));
  }, [searchQuery, nodes, matchingNodeIds]);

  // Graph BFS helper to find shortest edge path between two nodes
  const getEdgePathBetweenNodes = useCallback((fromId, toId) => {
    if (!fromId || !toId || fromId === toId) return [];
    
    // Direct edge check
    const direct = edges.find(
      e => (e.from === fromId && e.to === toId) || (e.from === toId && e.to === fromId)
    );
    if (direct) return [direct.id];

    // BFS for multi-hop connection
    const queue = [[fromId, []]];
    const visited = new Set([fromId]);

    while (queue.length > 0) {
      const [curr, path] = queue.shift();
      if (curr === toId) return path;

      for (const edge of edges) {
        let next = null;
        if (edge.from === curr) next = edge.to;
        else if (edge.to === curr) next = edge.from;

        if (next && !visited.has(next)) {
          visited.add(next);
          const newPath = [...path, edge.id];
          if (next === toId) return newPath;
          queue.push([next, newPath]);
        }
      }
    }
    return [];
  }, [edges]);

  // Derived flow information for layout highlight
  const activeFlow = useMemo(
    () => (activeFlowId ? flows.find((f) => f.id === activeFlowId) ?? null : null),
    [activeFlowId, flows],
  );

  const flowNodeIds = useMemo(() => {
    if (!activeFlow) return new Set();
    return new Set(activeFlow.steps.map((s) => s.nodeId));
  }, [activeFlow]);

  const flowEdges = useMemo(() => {
    if (!activeFlow) return new Set();
    const activeEdgeIds = new Set();

    for (let i = 0; i < activeFlow.steps.length - 1; i++) {
      const fromNodeId = activeFlow.steps[i].nodeId;
      const toNodeId = activeFlow.steps[i + 1].nodeId;
      const pathEdgeIds = getEdgePathBetweenNodes(fromNodeId, toNodeId);
      for (const eid of pathEdgeIds) {
        activeEdgeIds.add(eid);
      }
    }
    return activeEdgeIds;
  }, [activeFlow, getEdgePathBetweenNodes]);

  const activeTransitionEdgeIds = useMemo(() => {
    // Residual highlight only on the hop that landed us on the current step
    if (!activeFlow || activeStepIndex <= 0) return new Set();
    if (!activeFlow.steps[activeStepIndex]) return new Set();

    const fromNodeId = activeFlow.steps[activeStepIndex - 1].nodeId;
    const toNodeId = activeFlow.steps[activeStepIndex].nodeId;
    return new Set(getEdgePathBetweenNodes(fromNodeId, toNodeId));
  }, [activeFlow, activeStepIndex, getEdgePathBetweenNodes]);

  const activeStepNodeId = useMemo(() => {
    if (!activeFlow || activeStepIndex === -1) return null;
    return activeFlow.steps[activeStepIndex] ? activeFlow.steps[activeStepIndex].nodeId : null;
  }, [activeFlow, activeStepIndex]);

  // Keep refs in sync for the autoplay / signal loop (avoids stale closures)
  useEffect(() => {
    isPlayingFlowRef.current = isPlayingFlow;
  }, [isPlayingFlow]);

  useEffect(() => {
    activeStepIndexRef.current = activeStepIndex;
  }, [activeStepIndex]);

  useEffect(() => {
    activeFlowIdRef.current = activeFlowId;
  }, [activeFlowId]);

  const scrollStepCardIntoView = useCallback((stepIdx) => {
    const el = stepCardRefs.current.get(stepIdx);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

  /**
   * Travel the runtime signal along graph edges from the current step to targetIdx,
   * then commit the step change. Physical motion — no teleports.
   */
  const transitionToFlowStep = useCallback(
    async (flow, targetIdx, { animate = true } = {}) => {
      if (!flow || targetIdx < 0 || targetIdx >= flow.steps.length) return;
      if (transitionLockRef.current) return;

      const fromIdx = activeStepIndexRef.current;
      const toNodeId = flow.steps[targetIdx].nodeId;
      const fromNodeId =
        fromIdx >= 0 && fromIdx < flow.steps.length ? flow.steps[fromIdx].nodeId : null;

      setSelectedId(null);
      transitionLockRef.current = true;
      signalAbortRef.current.current = false;

      try {
        if (animate && fromNodeId && fromNodeId !== toNodeId) {
          const edgeIds = getEdgePathBetweenNodes(fromNodeId, toNodeId);
          const orderedIds =
            edgeIds.length > 0
              ? edgeIds
              : edges
                  .filter(
                    (e) =>
                      (e.from === fromNodeId && e.to === toNodeId) ||
                      (e.to === fromNodeId && e.from === toNodeId),
                  )
                  .map((e) => e.id);

          // Walk each hop in path order — arrows reorient to travel direction
          let cursorId = fromNodeId;
          for (const edgeId of orderedIds) {
            if (signalAbortRef.current.current) break;
            const edge = edges.find((e) => e.id === edgeId);
            if (!edge) continue;

            const nextId = edge.from === cursorId ? edge.to : edge.from;
            const fromNode = nodeMap[cursorId];
            const toNode = nodeMap[nextId];
            if (!fromNode || !toNode) continue;

            setEdgeTravelDir((prev) => {
              const next = new Map(prev);
              next.set(edgeId, { from: cursorId, to: nextId });
              return next;
            });
            setExecutingEdgeIds(new Set([edgeId]));

            const curve = buildEdgeCurve(fromNode, toNode);
            await animateSignalAlongCurve(
              signalRef.current,
              curve,
              SIGNAL_DURATION_MS,
              signalAbortRef.current,
              signalArrowRef.current,
            );
            cursorId = nextId;
          }

          setExecutingEdgeIds(new Set());
        }

        // Arrive — commit step + soft node focus
        setActiveStepIndex(targetIdx);
        setSignalFocusNodeId(toNodeId);
        centerNode(toNodeId);
        // Allow paint then scroll panel into sync
        requestAnimationFrame(() => scrollStepCardIntoView(targetIdx));

        window.setTimeout(() => {
          setSignalFocusNodeId((curr) => (curr === toNodeId ? null : curr));
        }, 220);
      } finally {
        transitionLockRef.current = false;
        setExecutingEdgeIds(new Set());
      }
    },
    [centerNode, edges, getEdgePathBetweenNodes, nodeMap, scrollStepCardIntoView],
  );

  // Alias used by existing call sites
  const selectFlowStep = useCallback(
    (flow, stepIdx) => {
      void transitionToFlowStep(flow, stepIdx, { animate: true });
    },
    [transitionToFlowStep],
  );

  // Auto-play: advance only after the signal finishes travelling
  useEffect(() => {
    if (!activeFlow || !isPlayingFlow) return undefined;
    if (activeFlow.steps.length === 0) return undefined;

    let cancelled = false;
    signalAbortRef.current.current = false;

    const run = async () => {
      // Dwell on the current step before the first hop
      await sleep(NODE_DWELL_MS, signalAbortRef.current);
      if (cancelled || !isPlayingFlowRef.current) return;

      while (!cancelled && isPlayingFlowRef.current) {
        const flowNow = flows.find((f) => f.id === activeFlowIdRef.current);
        if (!flowNow) break;

        const prev = activeStepIndexRef.current;
        const next = prev < 0 ? 0 : (prev + 1) % flowNow.steps.length;

        await transitionToFlowStep(flowNow, next, { animate: true });
        if (cancelled || !isPlayingFlowRef.current) break;

        await sleep(NODE_DWELL_MS, signalAbortRef.current);
      }
    };

    void run();

    return () => {
      cancelled = true;
      signalAbortRef.current.current = true;
      signalAbortRef.current.cancel?.();
      signalAbortRef.current.cancelSleep?.();
    };
  }, [activeFlow, isPlayingFlow, flows, transitionToFlowStep]);

  const projectTitle = activeProject === "rate-limiter" ? "Distributed Rate Limiter" : "PebbleDB";
  const projectOverviewBody = activeProject === "rate-limiter"
    ? "Explore the complete internals of the Distributed Rate Limiter: a sidecar-based centralized rate limiting platform in Go + Redis."
    : "Explore the complete internals of PebbleDB: a single-process embedded Key-Value engine implemented in Go.";
  const projectKicker = activeProject === "rate-limiter" ? "Go + Redis Platform" : "Embedded LSM-Tree";
  const projectOverviewLinkText = activeProject === "rate-limiter"
    ? "Read Rate Limiter Introduction →"
    : "Read PebbleDB System Overview →";

  const fitEpoch = `${activeProject}:${customLayout ? "custom" : "base"}`;

  const graphProps = useMemo(
    () => ({
      groups,
      nodes,
      edges,
      bounds,
      nodeMap,
      selectedId,
      searchQuery,
      matchingNodeIds,
      flowEdges,
      activeTransitionEdgeIds,
      executingEdgeIds,
      edgeTravelDir,
      activeFlowId,
      activeFlow,
      activeStepIndex,
      flowNodeIds,
      activeStepNodeId,
      signalFocusNodeId,
      connectionCounts,
      activeProject,
      hoveredNodeId,
      onHoverNode,
      isMobile,
      onSelectNode: selectNode,
      signalRef,
      signalArrowRef,
    }),
    [
      groups,
      nodes,
      edges,
      bounds,
      nodeMap,
      selectedId,
      searchQuery,
      matchingNodeIds,
      flowEdges,
      activeTransitionEdgeIds,
      executingEdgeIds,
      edgeTravelDir,
      activeFlowId,
      activeFlow,
      activeStepIndex,
      flowNodeIds,
      activeStepNodeId,
      signalFocusNodeId,
      connectionCounts,
      activeProject,
      hoveredNodeId,
      onHoverNode,
      isMobile,
      selectNode,
    ],
  );

  if (!packReady) {
    return <RouteFallback />;
  }

  return (
    <div className="arch-design-page">
      <header className="arch-design-toolbar">
        <div className="arch-design-toolbar-left">
          <Link to="/project-docs" className="arch-design-back">
            <svg className="w-3.5 h-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Docs
          </Link>
          
          <span className="arch-toolbar-divider" />

          <div className="arch-project-toggle" data-tour="project-toggle">
            <button
              type="button"
              className={`arch-project-toggle-btn ${activeProject === "pebbledb" ? "is-active" : ""}`}
              onClick={() => handleProjectChange("pebbledb")}
            >
              <span className="arch-project-toggle-dot arch-project-toggle-dot--pink" />
              PebbleDB
            </button>
            <button
              type="button"
              className={`arch-project-toggle-btn ${activeProject === "rate-limiter" ? "is-active" : ""}`}
              onClick={() => handleProjectChange("rate-limiter")}
            >
              <span className="arch-project-toggle-dot arch-project-toggle-dot--blue" />
              Rate Limiter
            </button>
          </div>

          <span className="arch-toolbar-badge">
            <span className="arch-toolbar-pulse-dot" />
            Live Architecture Inspector
          </span>
        </div>

        <div className="arch-design-toolbar-right">
          <div className="arch-tour-nav-cluster" data-tour="nav-controls">
            <div className="arch-shortcuts-pill" title="Keyboard Shortcuts: Space+Drag to Pan, Scroll to Zoom, Ctrl+0 to Fit">
              <span className="arch-shortcut-kbd">Space</span> Pan
              <span className="arch-shortcut-sep">·</span>
              <span className="arch-shortcut-kbd">Ctrl+0</span> Fit
            </div>

            <div className="arch-zoom-group" role="group" aria-label="Zoom controls">
              <button type="button" className="arch-zoom-btn" onClick={() => canvasApiRef.current?.zoomBy(-ZOOM_STEP)} aria-label="Zoom out">
                −
              </button>
              <span ref={zoomLabelRef} className="arch-zoom-label">55%</span>
              <button type="button" className="arch-zoom-btn" onClick={() => canvasApiRef.current?.zoomBy(ZOOM_STEP)} aria-label="Zoom in">
                +
              </button>
              <button type="button" className="arch-zoom-btn arch-zoom-btn--fit" onClick={fitToView} aria-label="Fit to view">
                Fit
              </button>
            </div>
          </div>

          <button
            type="button"
            className="arch-tour-launch-btn"
            onClick={() => {
              setIsPlayingFlow(false);
              setTourOpen(true);
            }}
          >
            Take Tour
          </button>

          <button
            type="button"
            className="arch-autolayout-btn"
            onClick={runAutoLayout}
            title="Run group-aware layered DAG auto-layout"
          >
            Auto-Layout
          </button>

          <div className="arch-action-group">
            <Link to={projectMeta.guideEntry} className="arch-nav-action-btn">
              System Overview
            </Link>
            <a href={projectMeta.github} target="_blank" rel="noopener noreferrer" className="arch-nav-action-btn">
              <svg className="w-3.5 h-3.5 mr-1.5 opacity-70" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              GitHub
            </a>
          </div>

          <button
            type="button"
            className="arch-nav-action-btn arch-menu-toggle-btn"
            aria-expanded={menuOpen}
            aria-controls="arch-design-mobile-menu"
            onClick={() => setMenuOpen((v) => !v)}
          >
            Menu
          </button>
        </div>

        {menuOpen && (
          <div id="arch-design-mobile-menu" className="arch-design-mobile-menu">
            <Link to={projectMeta.guideEntry} className="arch-nav-action-btn" onClick={() => setMenuOpen(false)}>
              System Overview Docs
            </Link>
            <a
              href={projectMeta.github}
              target="_blank"
              rel="noopener noreferrer"
              className="arch-nav-action-btn"
              onClick={() => setMenuOpen(false)}
            >
              GitHub Repo
            </a>
          </div>
        )}
      </header>

      <div className="arch-design-body">
        <ArchCanvasViewport
          ref={canvasApiRef}
          zoomLabelRef={zoomLabelRef}
          spaceDown={spaceDown}
          bounds={bounds}
          fitEpoch={fitEpoch}
          projectTitle={projectTitle}
          activeFlowId={activeFlowId}
          searchQuery={searchQuery}
          graphProps={graphProps}
        />

        {/* Desktop Side Inspector Panel with Horizontal Resizer */}
        <aside
          className={`arch-design-sidebar arch-design-panel--desktop${isResizing ? " is-resizing" : ""}`}
          style={{ width: sidebarWidth, minWidth: sidebarWidth }}
          aria-label="Interactive Inspector"
        >
          {/* Horizontal Resizer Drag Handle */}
          <div
            className="arch-resizer-handle"
            onPointerDown={handleResizeStart}
            onDoubleClick={handleResizeReset}
            title="Drag to resize panel horizontally (Double-click to reset)"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize panel width"
          >
            <div className="arch-resizer-line" />
            <div className="arch-resizer-pill" />
          </div>

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
              {searchQuery ? (
                <div style={{ display: "flex", alignItems: "center", gap: 6, position: "absolute", right: 8 }}>
                  <span className="arch-search-match-badge">{searchResults.length} matches</span>
                  <button type="button" className="arch-design-search-clear" onClick={() => setSearchQuery("")}>
                    ✕
                  </button>
                </div>
              ) : (
                <span className="arch-search-kbd-hint">/</span>
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
                      setIsPlayingFlow(false);
                      setSelectedId(null);
                      setExecutingEdgeIds(new Set());
                      setEdgeTravelDir(new Map());
                      setSignalFocusNodeId(null);
                    }}
                  >
                    Clear Walkthrough
                  </button>
                )}
              </div>
              <select
                className="arch-design-flow-select"
                data-tour="flow-select"
                value={activeFlowId}
                onChange={(e) => {
                  const flowId = e.target.value;
                  setActiveFlowId(flowId);
                  setSelectedId(null);
                  setExecutingEdgeIds(new Set());
                  setEdgeTravelDir(new Map());
                  setSignalFocusNodeId(null);
                  if (flowId) {
                    const flow = flows.find((f) => f.id === flowId);
                    if (flow) {
                      selectFlowStep(flow, 0);
                      setIsPlayingFlow(true);
                    }
                  } else {
                    setActiveStepIndex(-1);
                    setIsPlayingFlow(false);
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
                  {activeFlow?.description}
                </p>
              )}
            </div>
            {activeFlow && (
              <div style={{ display: "flex", gap: 6, marginTop: 8 }} data-tour="flow-controls">
                <button
                  type="button"
                  className="arch-design-link-btn"
                  style={{ flex: 1, textAlign: "center", fontSize: 11, padding: "6px 4px" }}
                  disabled={activeStepIndex <= 0}
                  onClick={() => {
                    setIsPlayingFlow(false);
                    selectFlowStep(activeFlow, activeStepIndex - 1);
                  }}
                >
                  ◀ Prev
                </button>
                <button
                  type="button"
                  className="arch-design-link-btn"
                  data-tour="flow-play"
                  style={{
                    flex: 1.3,
                    textAlign: "center",
                    fontSize: 11,
                    padding: "6px 4px",
                    background: isPlayingFlow ? "rgba(255, 92, 173, 0.2)" : undefined,
                    borderColor: isPlayingFlow ? "#ff5cad" : undefined,
                    color: isPlayingFlow ? "#ff5cad" : "#fff",
                  }}
                  onClick={() => setIsPlayingFlow((p) => !p)}
                >
                  {isPlayingFlow ? "⏸ Pause" : "▶ Play Walkthrough"}
                </button>
                <button
                  type="button"
                  className="arch-design-link-btn"
                  style={{ flex: 1, textAlign: "center", fontSize: 11, padding: "6px 4px" }}
                  disabled={activeStepIndex >= activeFlow.steps.length - 1}
                  onClick={() => {
                    setIsPlayingFlow(false);
                    selectFlowStep(activeFlow, activeStepIndex + 1);
                  }}
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
          <div className="arch-design-panel-content" ref={panelContentRef}>
            {!selectedId ? (
              activeFlow ? (
                // Walkthrough steps list
                <div className="arch-design-flow-steps">
                  <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "#71717a", marginBottom: 4 }}>
                    Flow Progression Steps
                  </span>
                  {activeFlow.steps.map((step, idx) => {
                    const isStepActive = idx === activeStepIndex;
                    const isStepPast = activeStepIndex >= 0 && idx < activeStepIndex;
                    return (
                      <div
                        key={step.id}
                        ref={(el) => {
                          if (el) stepCardRefs.current.set(idx, el);
                          else stepCardRefs.current.delete(idx);
                        }}
                        className={`arch-design-flow-step-card${isStepActive ? " arch-design-flow-step-card--active" : ""}${isStepPast ? " arch-design-flow-step-card--past" : ""}`}
                        onClick={() => selectFlowStep(activeFlow, idx)}
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
                            href={getGithubSourceUrl(step.codeRef.path, step.codeRef, activeProject)}
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
                  <p className="arch-design-panel-kicker">{projectKicker}</p>
                  <h2 className="arch-design-panel-title">{projectTitle} Architecture</h2>
                  <p className="arch-design-panel-body">
                    {projectOverviewBody}
                  </p>
                  <ImplementedBadges project={activeProject} />
                  <div style={{ marginTop: 20 }} className="arch-card-nested">
                    <h4 style={{ margin: "0 0 6px", fontSize: 12, color: "#fff", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      How to inspect:
                    </h4>
                    <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: "#a1a1aa", lineHeight: 1.6 }}>
                      <li>Click any node on the infinite canvas to view structural HLD, verified implementation details, concurrency parameters, and failure recovery.</li>
                      <li>Select an <strong>Operational Flow Walkthrough</strong> from the dropdown above to walk step-by-step through read, write, flush, compaction, or crash-recovery paths.</li>
                    </ul>
                  </div>
                  <Link to={projectMeta.guideEntry} className="arch-design-link-btn" style={{ marginTop: 20, display: "inline-block" }}>
                    {projectOverviewLinkText}
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

                    {decision.hld && (
                      <div className="arch-details-section">
                        <h3>HLD Architectural Role</h3>
                        <p style={{ fontSize: 12.5, lineHeight: 1.5, color: "#e4e4e7" }}>
                          {decision.hld.architecturalRole}
                        </p>
                        <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
                          <div style={{ flex: 1 }}>
                            <h4 style={{ fontSize: 10, textTransform: "uppercase", color: "#71717a" }}>Upstream:</h4>
                            <div style={{ fontSize: 11, color: "#fff", display: "flex", flexWrap: "wrap", gap: 4 }}>
                              {decision.hld.upstream && decision.hld.upstream.length > 0 ? decision.hld.upstream.map(id => (
                                <button key={id} type="button" className="arch-provenance-badge" style={{ cursor: "pointer", background: "#18181b", border: "1px solid #3f3f46", color: "#fff" }} onClick={() => selectNode(id)}>
                                  {nodeMap[id]?.label || id}
                                </button>
                              )) : <span style={{ color: "#71717a" }}>None</span>}
                            </div>
                          </div>
                          <div style={{ flex: 1 }}>
                            <h4 style={{ fontSize: 10, textTransform: "uppercase", color: "#71717a" }}>Downstream:</h4>
                            <div style={{ fontSize: 11, color: "#fff", display: "flex", flexWrap: "wrap", gap: 4 }}>
                              {decision.hld.downstream && decision.hld.downstream.length > 0 ? decision.hld.downstream.map(id => (
                                <button key={id} type="button" className="arch-provenance-badge" style={{ cursor: "pointer", background: "#18181b", border: "1px solid #3f3f46", color: "#fff" }} onClick={() => selectNode(id)}>
                                  {nodeMap[id]?.label || id}
                                </button>
                              )) : <span style={{ color: "#71717a" }}>None</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {decision.hld && (
                      <div className="arch-details-section">
                        <h3>State & Concurrency Control</h3>
                        <div className="arch-card-nested">
                          {decision.hld.dataOwnership && (
                            <>
                              <h4 style={{ fontSize: 10, textTransform: "uppercase", color: "#ffb3d4", margin: "0 0 4px" }}>Data Ownership:</h4>
                              <ul style={{ margin: "0 0 8px 0", paddingLeft: 14, fontSize: 11.5, color: "#a1a1aa" }}>
                                {decision.hld.dataOwnership.map((d, idx) => <li key={idx}>{d}</li>)}
                              </ul>
                            </>
                          )}
                          {decision.hld.controlOwnership && (
                            <>
                              <h4 style={{ fontSize: 10, textTransform: "uppercase", color: "#ffb3d4", margin: "0 0 4px" }}>Control & Synchronization:</h4>
                              <ul style={{ margin: "0 0 8px 0", paddingLeft: 14, fontSize: 11.5, color: "#a1a1aa" }}>
                                {decision.hld.controlOwnership.map((c, idx) => <li key={idx}>{c}</li>)}
                              </ul>
                            </>
                          )}
                          {decision.hld.persistenceResponsibility && (
                            <>
                              <h4 style={{ fontSize: 10, textTransform: "uppercase", color: "#ffb3d4", margin: "0 0 4px" }}>Persistence Boundary:</h4>
                              <p style={{ margin: 0, fontSize: 11.5, color: "#a1a1aa" }}>{decision.hld.persistenceResponsibility}</p>
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    {decision.lld && (
                      <div className="arch-details-section">
                        <h3>Low-Level Design (LLD) Details</h3>
                        <h4 style={{ fontSize: 11, textTransform: "uppercase", color: "#71717a", margin: "8px 0 4px" }}>Implementation:</h4>
                        <ul className="arch-details-list">
                          {decision.lld.implementation && decision.lld.implementation.map((impl, idx) => (
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
                              href={getGithubSourceUrl(s.path, s, activeProject)}
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
                                  <a href={getGithubSourceUrl(m.source.path, m.source, activeProject)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: "#ffb3d4", textDecoration: "none" }}>
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
                              <strong>Fit for {activeProject === "rate-limiter" ? "Rate Limiter" : "PebbleDB"}:</strong> {alt.fitForPebbleDB || alt.fitForLimiter}
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
                          {(decision.failureWithoutComponent || []).map((f, idx) => (
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
                                href={getGithubSourceUrl(s.path, s, activeProject)}
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
                      {decision.hld && <p style={{ fontSize: 12 }}>{decision.hld.architecturalRole}</p>}
                      <h4 style={{ fontSize: 11, textTransform: "uppercase", color: "#71717a", margin: "8px 0 4px" }}>Implementation:</h4>
                      <ul className="arch-details-list">{decision.lld?.implementation?.map((impl, idx) => <li key={idx}>{impl}</li>)}</ul>
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
                  <div>
                    <ImplementedBadges project={activeProject} compact />
                    <p style={{ color: "#71717a", fontSize: 12 }}>Tap any node on the canvas to inspect components.</p>
                  </div>
                )}
              </div>
            </div>
          </aside>
        </>
      )}

      <ArchitectureTour
        open={tourOpen}
        onClose={handleTourClose}
        onStepEnter={onTourStepEnter}
        ensureTargetVisible={ensureTourTargetVisible}
      />
    </div>
  );
}

import { memo } from "react";
import { buildEdgeCurve } from "../utils/runtimeSignal";

function kindClass(kind) {
  return `arch-canvas-node arch-canvas-node--${kind}`;
}

function getNodeKindBadgeLabel(kind) {
  switch (kind) {
    case "client":
      return "CLIENT";
    case "core":
      return "CORE";
    case "worker":
      return "WORKER";
    case "disk":
      return "DISK";
    case "memory":
      return "MEMORY";
    case "package":
      return "PKG";
    default:
      return kind ? kind.toUpperCase() : "NODE";
  }
}

/**
 * Graph contents living under the camera transform.
 * Intentionally does NOT take `transform` — so pan/zoom parent updates can
 * skip reconciling nodes/edges when only the camera moves.
 */
function ArchGraphWorld({
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
  onSelectNode,
  signalRef,
  signalArrowRef,
}) {
  const searchActive = searchQuery.trim() !== "";

  return (
    <>
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

      <svg
        className="arch-canvas-edges"
        width={Math.max(3000, (bounds.maxX || 1200) + 800)}
        height={Math.max(2400, (bounds.maxY || 1000) + 800)}
        aria-hidden="true"
      >
        <defs>
          <marker id="arch-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#ff5cad" />
          </marker>
          <marker id="arch-arrow-flow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="8" markerHeight="8" orient="auto">
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#ff8ec8" />
          </marker>
        </defs>
        {edges.map((edge) => {
          const fromNode = nodeMap[edge.from];
          const toNode = nodeMap[edge.to];
          if (!fromNode || !toNode) return null;

          const isInFlow = flowEdges.has(edge.id);
          const isExecuting = executingEdgeIds.has(edge.id);
          const isTransition = activeTransitionEdgeIds.has(edge.id) || isExecuting;
          if (activeFlowId && !isInFlow && !isTransition) return null;

          const travel = edgeTravelDir.get(edge.id);
          const curve =
            travel && nodeMap[travel.from] && nodeMap[travel.to]
              ? buildEdgeCurve(nodeMap[travel.from], nodeMap[travel.to])
              : buildEdgeCurve(fromNode, toNode);

          const isSelectedEdge = selectedId && (edge.from === selectedId || edge.to === selectedId);
          const isSearchMatchEdge =
            searchActive && (matchingNodeIds.has(edge.from) || matchingNodeIds.has(edge.to));

          let edgeClass = "arch-canvas-edge";
          if (isSelectedEdge) edgeClass += " arch-canvas-edge--active";
          if (isInFlow) edgeClass += " is-in-flow";
          if (isExecuting) edgeClass += " is-executing";
          else if (isTransition) edgeClass += " is-in-flow-active";
          if (isSearchMatchEdge) edgeClass += " is-search-match";

          const markerId =
            isExecuting || isTransition || isSelectedEdge || isSearchMatchEdge
              ? "url(#arch-arrow-flow)"
              : "url(#arch-arrow)";

          return (
            <g key={edge.id}>
              <path d={curve.d} className={edgeClass} fill="none" markerEnd={markerId} />
            </g>
          );
        })}
        <circle
          ref={signalRef}
          className="arch-runtime-signal"
          r="2.5"
          cx="0"
          cy="0"
          visibility="hidden"
        />
        <polygon
          ref={signalArrowRef}
          className="arch-runtime-signal-arrow"
          points="5,0 -3.5,-3 -3.5,3"
          visibility="hidden"
        />
      </svg>

      {nodes.map((node) => {
        const w = node.w || 160;
        const h = node.h || 56;
        const isSelected = selectedId === node.id;
        const connCount = connectionCounts[node.id] || 0;
        const kindLabel = getNodeKindBadgeLabel(node.kind);

        const isInFlow = flowNodeIds.has(node.id);
        const isActiveStepNode = node.id === activeStepNodeId;
        const isSignalFocus = node.id === signalFocusNodeId;
        const isSearchMatch = searchActive && matchingNodeIds.has(node.id);

        let flowTier = "";
        if (activeFlow && isInFlow) {
          const stepIdx = activeFlow.steps.findIndex((s) => s.nodeId === node.id);
          if (stepIdx >= 0) {
            if (activeStepIndex < 0) flowTier = " is-flow-future";
            else if (stepIdx < activeStepIndex) flowTier = " is-flow-past";
            else if (stepIdx === activeStepIndex) flowTier = " is-flow-current";
            else flowTier = " is-flow-future";
          }
        }

        let nodeClasses = kindClass(node.kind);
        if (isSelected) nodeClasses += " is-selected";
        if (isInFlow) nodeClasses += " is-in-flow";
        if (isActiveStepNode) nodeClasses += " is-in-flow-active";
        if (isSignalFocus) nodeClasses += " is-signal-focus";
        if (isSearchMatch) nodeClasses += " is-search-match";
        nodeClasses += flowTier;

        return (
          <button
            key={node.id}
            type="button"
            data-node-id={node.id}
            data-tour={
              (activeProject === "pebbledb" && node.id === "api") ||
              (activeProject === "rate-limiter" && node.id === "sidecar")
                ? "sample-node"
                : undefined
            }
            className={nodeClasses}
            style={{ left: node.x, top: node.y, width: w, height: h }}
            onMouseEnter={() => onHoverNode(node.id)}
            onMouseLeave={() => onHoverNode(null)}
            onClick={(ev) => {
              if (!isMobile) {
                ev.stopPropagation();
                onSelectNode(node.id);
              }
            }}
          >
            <div className="arch-canvas-node-header">
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span className={`arch-node-status-dot arch-node-status-dot--${node.kind || "default"}`} />
                <span className="arch-canvas-node-kind-badge">{kindLabel}</span>
              </div>
              <span className="arch-canvas-node-conn-badge" title={`${connCount} connections`}>
                {connCount}
              </span>
            </div>
            <span className="arch-canvas-node-label">{node.label}</span>
            {node.path && <span className="arch-canvas-node-path">{node.path}</span>}
          </button>
        );
      })}

      {hoveredNodeId && nodeMap[hoveredNodeId] && (
        <div
          className="arch-canvas-node-tooltip"
          style={{
            left: nodeMap[hoveredNodeId].x + (nodeMap[hoveredNodeId].w || 160) / 2,
            top: nodeMap[hoveredNodeId].y - 8,
          }}
        >
          <div className="arch-canvas-node-tooltip-header">
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className={`arch-node-status-dot arch-node-status-dot--${nodeMap[hoveredNodeId].kind || "default"}`} />
              <span className="arch-canvas-node-tooltip-title">{nodeMap[hoveredNodeId].label}</span>
            </div>
            <span className="arch-canvas-node-kind-badge">{getNodeKindBadgeLabel(nodeMap[hoveredNodeId].kind)}</span>
          </div>
          {nodeMap[hoveredNodeId].path && (
            <div className="arch-canvas-node-tooltip-path">{nodeMap[hoveredNodeId].path}</div>
          )}
          <p className="arch-canvas-node-tooltip-summary">{nodeMap[hoveredNodeId].summary}</p>
        </div>
      )}
    </>
  );
}

export default memo(ArchGraphWorld);

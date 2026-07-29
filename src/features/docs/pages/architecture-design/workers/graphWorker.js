/**
 * Web Worker for Graph Traversal & BFS Pathfinding Offloading
 * 
 * Offloads graph BFS shortest path calculations and multi-step flow edge path resolution
 * off the main UI thread to guarantee 60 FPS animation loop performance.
 */

self.onmessage = function (e) {
  const { type, requestId, fromId, toId, flowSteps, edges } = e.data;

  if (type === "FIND_EDGE_PATH") {
    const path = getEdgePath(fromId, toId, edges);
    self.postMessage({ type, requestId, result: path });
  } else if (type === "COMPUTE_FLOW_EDGES") {
    const flowEdgeIds = computeFlowEdges(flowSteps, edges);
    self.postMessage({ type, requestId, result: Array.from(flowEdgeIds) });
  }
};

function getEdgePath(fromId, toId, edges = []) {
  if (!fromId || !toId || fromId === toId) return [];

  // Direct edge check
  const direct = edges.find(
    (e) => (e.from === fromId && e.to === toId) || (e.from === toId && e.to === fromId)
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
}

function computeFlowEdges(flowSteps = [], edges = []) {
  const activeEdgeIds = new Set();
  for (let i = 0; i < flowSteps.length - 1; i++) {
    const fromNodeId = flowSteps[i].nodeId;
    const toNodeId = flowSteps[i + 1].nodeId;
    const pathEdgeIds = getEdgePath(fromNodeId, toNodeId, edges);
    for (const eid of pathEdgeIds) {
      activeEdgeIds.add(eid);
    }
  }
  return activeEdgeIds;
}

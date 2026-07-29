/**
 * Layered Sugiyama DAG Auto-Layout Algorithm
 * 
 * Computes optimal 2D node coordinates (x, y) and dynamic group bounding boxes
 * for directed acyclic architecture graph topologies using a 3-phase Sugiyama layout:
 * 1. Layer Assignment (Topological Sort / Longest Path Rank)
 * 2. Layer Ordering (Barycenter Median Crossing Minimization)
 * 3. Coordinate Assignment & Group Bounding Box Fitting
 */

export function computeDagLayout(inputNodes = [], inputEdges = [], inputGroups = []) {
  if (!inputNodes || inputNodes.length === 0) {
    return { nodes: [], groups: [], bounds: { minX: 0, minY: 0, maxX: 800, maxY: 600, width: 800, height: 600 } };
  }

  const nodes = inputNodes.map((n) => ({ ...n }));
  const edges = inputEdges.map((e) => ({ ...e }));
  const groups = inputGroups.map((g) => ({ ...g }));

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const inDegree = new Map(nodes.map((n) => [n.id, 0]));
  const outEdges = new Map(nodes.map((n) => [n.id, []]));

  for (const edge of edges) {
    if (nodeMap.has(edge.from) && nodeMap.has(edge.to)) {
      inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
      const outList = outEdges.get(edge.from) || [];
      outList.push(edge.to);
      outEdges.set(edge.from, outList);
    }
  }

  // Phase 1: Topological Layer Assignment (Longest Path)
  const rankMap = new Map();
  const queue = [];

  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) {
      rankMap.set(id, 0);
      queue.push(id);
    }
  }

  // Process nodes in topological order
  let maxRank = 0;
  while (queue.length > 0) {
    const currId = queue.shift();
    const currRank = rankMap.get(currId) || 0;

    const children = outEdges.get(currId) || [];
    for (const childId of children) {
      const nextRank = Math.max(rankMap.get(childId) || 0, currRank + 1);
      rankMap.set(childId, nextRank);
      maxRank = Math.max(maxRank, nextRank);

      const nextDeg = (inDegree.get(childId) || 1) - 1;
      inDegree.set(childId, nextDeg);
      if (nextDeg === 0) {
        queue.push(childId);
      }
    }
  }

  // Fallback for any unranked nodes (e.g. isolated nodes or cycles)
  for (const node of nodes) {
    if (!rankMap.has(node.id)) {
      rankMap.set(node.id, 0);
    }
  }

  // Group nodes into layers
  const layers = Array.from({ length: maxRank + 1 }, () => []);
  for (const node of nodes) {
    const r = rankMap.get(node.id) || 0;
    layers[r].push(node);
  }

  // Phase 2: Barycenter Ordering within layers to minimize edge crossings
  for (let r = 1; r < layers.length; r++) {
    const prevLayer = layers[r - 1];
    const prevIndexMap = new Map(prevLayer.map((n, idx) => [n.id, idx]));

    layers[r].sort((a, b) => {
      const parentsA = edges.filter((e) => e.to === a.id).map((e) => prevIndexMap.get(e.from) ?? 0);
      const parentsB = edges.filter((e) => e.to === b.id).map((e) => prevIndexMap.get(e.from) ?? 0);

      const avgA = parentsA.length > 0 ? parentsA.reduce((sum, p) => sum + p, 0) / parentsA.length : 0;
      const avgB = parentsB.length > 0 ? parentsB.reduce((sum, p) => sum + p, 0) / parentsB.length : 0;

      return avgA - avgB;
    });
  }

  // Phase 3: Coordinate Assignment
  const startX = 60;
  const startY = 60;
  const gapX = 36;
  const gapY = 110;

  for (let r = 0; r < layers.length; r++) {
    const layer = layers[r];
    const y = startY + r * gapY;
    let currX = startX;

    for (const node of layer) {
      node.x = currX;
      node.y = y;
      const w = node.w || 180;
      currX += w + gapX;
    }
  }

  // Recalculate dynamic group bounding boxes to fit child nodes
  for (const group of groups) {
    const groupNodes = nodes.filter((n) => n.groupId === group.id);
    if (groupNodes.length > 0) {
      const minNodeX = Math.min(...groupNodes.map((n) => n.x));
      const minNodeY = Math.min(...groupNodes.map((n) => n.y));
      const maxNodeX = Math.max(...groupNodes.map((n) => n.x + (n.w || 180)));
      const maxNodeY = Math.max(...groupNodes.map((n) => n.y + (n.h || 60)));

      const padX = 24;
      const padY = 32;

      group.x = minNodeX - padX;
      group.y = minNodeY - padY;
      group.w = maxNodeX - minNodeX + padX * 2;
      group.h = maxNodeY - minNodeY + padY * 2;
    }
  }

  // Compute total graph bounds
  const minX = Math.min(...nodes.map((n) => n.x), ...groups.map((g) => g.x));
  const minY = Math.min(...nodes.map((n) => n.y), ...groups.map((g) => g.y));
  const maxX = Math.max(...nodes.map((n) => n.x + (n.w || 180)), ...groups.map((g) => g.x + g.w));
  const maxY = Math.max(...nodes.map((n) => n.y + (n.h || 60)), ...groups.map((g) => g.y + g.h));

  return {
    nodes,
    groups,
    bounds: {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
    },
  };
}

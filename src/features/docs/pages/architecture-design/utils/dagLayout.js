/**
 * Group-aware layered layout for architecture canvases.
 *
 * Keeps hand-authored layer bands (Client → Memory → …) and places nodes
 * inside each band with equal gaps and generous padding so the diagram
 * reads cleanly instead of as a dense topological scramble.
 */

function nodeCenter(node) {
  return {
    x: node.x + (node.w || 180) / 2,
    y: node.y + (node.h || 60) / 2,
  };
}

function groupContains(group, node) {
  const c = nodeCenter(node);
  return (
    c.x >= group.x &&
    c.x <= group.x + group.w &&
    c.y >= group.y &&
    c.y <= group.y + group.h
  );
}

function assignNodesToGroups(nodes, groups) {
  const assignment = new Map();
  const byGroup = new Map(groups.map((g) => [g.id, []]));

  for (const node of nodes) {
    if (node.groupId && byGroup.has(node.groupId)) {
      assignment.set(node.id, node.groupId);
      byGroup.get(node.groupId).push(node);
      continue;
    }
    const hit = groups.find((g) => groupContains(g, node));
    if (hit) {
      assignment.set(node.id, hit.id);
      byGroup.get(hit.id).push(node);
    }
  }

  for (const node of nodes) {
    if (assignment.has(node.id)) continue;
    const c = nodeCenter(node);
    let best = groups[0];
    let bestDist = Infinity;
    for (const g of groups) {
      const midY = g.y + g.h / 2;
      const dist = Math.abs(c.y - midY);
      if (dist < bestDist) {
        bestDist = dist;
        best = g;
      }
    }
    assignment.set(node.id, best.id);
    byGroup.get(best.id).push(node);
  }

  return { assignment, byGroup };
}

/** Keep the hand-authored left→right narrative inside each layer. */
function preserveReadingOrder(groupNodes) {
  return [...groupNodes].sort((a, b) => a.x - b.x || a.y - b.y || a.id.localeCompare(b.id));
}

/**
 * Place nodes in a single row with a fixed edge-to-edge gap.
 */
function packRow(nodes, startX, y, gapX) {
  let x = startX;
  let maxH = 0;
  for (const node of nodes) {
    const w = node.w || 180;
    const h = node.h || 60;
    node.x = x;
    node.y = y;
    x += w + gapX;
    maxH = Math.max(maxH, h);
  }
  return {
    width: nodes.length === 0 ? 0 : x - startX - gapX,
    height: maxH,
  };
}

/**
 * Place nodes on a regular grid with equal column widths and row heights
 * so spacing looks even even when individual node sizes differ.
 */
function packGrid(nodes, startX, startY, gapX, gapY, cols) {
  if (nodes.length === 0) return { width: 0, height: 0 };

  const colCount = Math.min(cols, nodes.length);
  const colW = Math.max(...nodes.map((n) => n.w || 180));
  const rowH = Math.max(...nodes.map((n) => n.h || 60));
  const rows = Math.ceil(nodes.length / colCount);

  nodes.forEach((node, i) => {
    const col = i % colCount;
    const row = Math.floor(i / colCount);
    const w = node.w || 180;
    const h = node.h || 60;
    node.x = startX + col * (colW + gapX) + (colW - w) / 2;
    node.y = startY + row * (rowH + gapY) + (rowH - h) / 2;
  });

  return {
    width: colCount * colW + (colCount - 1) * gapX,
    height: rows * rowH + (rows - 1) * gapY,
  };
}

function packIntoBand(nodes, startX, startY, gapX, gapY, maxRowWidth) {
  if (nodes.length === 0) return { width: 0, height: 0 };

  const singleW =
    nodes.reduce((sum, n) => sum + (n.w || 180), 0) + gapX * Math.max(0, nodes.length - 1);

  // Prefer one clean row whenever it fits
  if (singleW <= maxRowWidth || nodes.length <= 4) {
    return packRow(nodes, startX, startY, gapX);
  }

  // Otherwise a tidy 2-row grid (ceil(n/2) columns)
  const cols = Math.ceil(nodes.length / 2);
  return packGrid(nodes, startX, startY, gapX, gapY, cols);
}

export function computeDagLayout(inputNodes = [], inputEdges = [], inputGroups = []) {
  if (!inputNodes || inputNodes.length === 0) {
    return {
      nodes: [],
      groups: [],
      bounds: { minX: 0, minY: 0, maxX: 800, maxY: 600, width: 800, height: 600 },
    };
  }

  const nodes = inputNodes.map((n) => ({ ...n }));
  const groups = inputGroups.map((g) => ({ ...g }));

  groups.sort((a, b) => a.y - b.y || a.x - b.x);

  const { byGroup } = assignNodesToGroups(nodes, groups);

  const PAD_X = 40;
  const PAD_Y_TOP = 48;
  const PAD_Y_BOTTOM = 28;
  const GAP_X = 48;
  const GAP_Y_IN_BAND = 28;
  const GAP_BETWEEN_GROUPS = 56;
  const MAX_ROW_WIDTH = 1280;
  const BAND_START_X = 48;

  let bandY = 48;
  let maxGroupWidth = 0;
  const laidOut = [];

  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi];
    const members = byGroup.get(group.id) || [];
    const ordered = preserveReadingOrder(members);

    const innerX = BAND_START_X + PAD_X;
    const innerY = bandY + PAD_Y_TOP;
    const packed = packIntoBand(ordered, innerX, innerY, GAP_X, GAP_Y_IN_BAND, MAX_ROW_WIDTH);

    const contentW = Math.max(packed.width, ordered.length ? 0 : 220);
    const contentH = Math.max(packed.height, 64);

    group.x = BAND_START_X;
    group.y = bandY;
    group.w = contentW + PAD_X * 2;
    group.h = contentH + PAD_Y_TOP + PAD_Y_BOTTOM;
    maxGroupWidth = Math.max(maxGroupWidth, group.w);
    laidOut.push({ group, ordered });

    bandY = group.y + group.h + GAP_BETWEEN_GROUPS;
  }

  // Center narrower bands under the widest layer
  for (const { group, ordered } of laidOut) {
    const offsetX = (maxGroupWidth - group.w) / 2;
    group.x = BAND_START_X + offsetX;
    if (ordered.length === 0) continue;

    const minX = Math.min(...ordered.map((n) => n.x));
    const maxX = Math.max(...ordered.map((n) => n.x + (n.w || 180)));
    const usedW = maxX - minX;
    const shiftX = group.x + PAD_X + (group.w - PAD_X * 2 - usedW) / 2 - minX;
    for (const n of ordered) n.x += shiftX;
  }

  const allX = [
    ...nodes.map((n) => n.x),
    ...nodes.map((n) => n.x + (n.w || 180)),
    ...groups.map((g) => g.x),
    ...groups.map((g) => g.x + g.w),
  ];
  const allY = [
    ...nodes.map((n) => n.y),
    ...nodes.map((n) => n.y + (n.h || 60)),
    ...groups.map((g) => g.y),
    ...groups.map((g) => g.y + g.h),
  ];

  const minX = Math.min(...allX);
  const minY = Math.min(...allY);
  const maxX = Math.max(...allX);
  const maxY = Math.max(...allY);

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

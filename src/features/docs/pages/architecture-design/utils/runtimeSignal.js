/**
 * Subtle runtime-signal helpers for operational walkthroughs.
 * Cubic-bezier sampling + ease curves — no React involved in the hot path.
 */

export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function cubicPoint(p0, p1, p2, p3, t) {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;
  return {
    x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
    y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y,
  };
}

export function nodeCenter(node) {
  const w = node.w || 160;
  const h = node.h || 56;
  return { x: node.x + w / 2, y: node.y + h / 2 };
}

export function getNodeEdgePoint(node, targetCenter) {
  const w = node.w || 160;
  const h = node.h || 56;
  const cx = node.x + w / 2;
  const cy = node.y + h / 2;
  const dx = targetCenter.x - cx;
  const dy = targetCenter.y - cy;

  if (Math.abs(dy) >= Math.abs(dx)) {
    return { x: cx, y: dy > 0 ? node.y + h + 2 : node.y - 2 };
  }
  return { x: dx > 0 ? node.x + w + 2 : node.x - 2, y: cy };
}

/** Build the same cubic used by canvas edge rendering. */
export function buildEdgeCurve(fromNode, toNode) {
  const centerA = nodeCenter(fromNode);
  const centerB = nodeCenter(toNode);
  const a = getNodeEdgePoint(fromNode, centerB);
  const b = getNodeEdgePoint(toNode, centerA);
  const midY = Math.abs(a.y - b.y) < 15 ? a.y - 36 : (a.y + b.y) / 2;
  const c1 = { x: a.x, y: midY };
  const c2 = { x: b.x, y: midY };
  return {
    a,
    c1,
    c2,
    b,
    d: `M ${a.x} ${a.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${b.x} ${b.y}`,
  };
}

export function cubicTangentDeg(p0, p1, p2, p3, t) {
  const u = 1 - t;
  const dx =
    3 * u * u * (p1.x - p0.x) +
    6 * u * t * (p2.x - p1.x) +
    3 * t * t * (p3.x - p2.x);
  const dy =
    3 * u * u * (p1.y - p0.y) +
    6 * u * t * (p2.y - p1.y) +
    3 * t * t * (p3.y - p2.y);
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

/**
 * Animate a signal along one cubic edge via rAF.
 * Updates the SVG circle through the DOM — no React renders.
 * Optionally rotates a companion arrowhead to match travel direction.
 *
 * @returns {Promise<void>}
 */
export function animateSignalAlongCurve(signalEl, curve, durationMs = 780, signalAbort, arrowEl) {
  return new Promise((resolve) => {
    if (!signalEl || !curve) {
      resolve();
      return;
    }

    const duration = Math.max(500, Math.min(1200, durationMs));
    let start = null;
    let frameId = 0;

    signalEl.setAttribute("visibility", "visible");
    signalEl.setAttribute("opacity", "0.85");
    if (arrowEl) {
      arrowEl.setAttribute("visibility", "visible");
      arrowEl.setAttribute("opacity", "0.75");
    }

    const tick = (now) => {
      if (signalAbort?.current) {
        signalEl.setAttribute("visibility", "hidden");
        if (arrowEl) arrowEl.setAttribute("visibility", "hidden");
        resolve();
        return;
      }

      if (start == null) start = now;
      const raw = Math.min(1, (now - start) / duration);
      const t = easeInOutCubic(raw);
      const pt = cubicPoint(curve.a, curve.c1, curve.c2, curve.b, t);
      const deg = cubicTangentDeg(curve.a, curve.c1, curve.c2, curve.b, t);
      signalEl.setAttribute("transform", `translate(${pt.x} ${pt.y})`);
      if (arrowEl) {
        arrowEl.setAttribute("transform", `translate(${pt.x} ${pt.y}) rotate(${deg})`);
      }

      if (raw < 1) {
        frameId = requestAnimationFrame(tick);
      } else {
        signalEl.setAttribute("visibility", "hidden");
        if (arrowEl) arrowEl.setAttribute("visibility", "hidden");
        resolve();
      }
    };

    frameId = requestAnimationFrame(tick);
    if (signalAbort) {
      signalAbort.cancel = () => {
        cancelAnimationFrame(frameId);
        signalEl.setAttribute("visibility", "hidden");
        if (arrowEl) arrowEl.setAttribute("visibility", "hidden");
        resolve();
      };
    }
  });
}

export function sleep(ms, abortRef) {
  return new Promise((resolve) => {
    if (abortRef?.current) {
      resolve();
      return;
    }
    const id = setTimeout(resolve, ms);
    if (abortRef) {
      abortRef.cancelSleep = () => {
        clearTimeout(id);
        resolve();
      };
    }
  });
}

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { nodeCenter } from "../utils/runtimeSignal";
import ArchGraphWorld from "./ArchGraphWorld";
import CanvasMinimap from "./CanvasMinimap";

const MIN_SCALE = 0.3;
const MAX_SCALE = 2.4;
const PAN_THRESHOLD = 8;

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

/**
 * Owns camera transform + pointer/wheel interaction.
 * Keeping transform here prevents pan/zoom from re-rendering the inspector page.
 */
const ArchCanvasViewport = forwardRef(function ArchCanvasViewport(
  {
    zoomLabelRef,
    spaceDown,
    bounds,
    fitEpoch,
    projectTitle,
    activeFlowId,
    searchQuery,
    graphProps,
  },
  ref,
) {
  const viewportRef = useRef(null);
  const dragRef = useRef(null);
  const pinchRef = useRef(null);
  const viewportSizeRef = useRef({ width: 0, height: 0 });
  const [transform, setTransform] = useState({ x: 40, y: 24, scale: 0.55 });
  const transformRef = useRef(transform);
  transformRef.current = transform;

  // Cache viewport size — avoid getBoundingClientRect on every zoom event
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return undefined;
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      viewportSizeRef.current = { width, height };
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Keep toolbar zoom % in sync without re-rendering the page
  useEffect(() => {
    if (zoomLabelRef?.current) {
      zoomLabelRef.current.textContent = `${Math.round(transform.scale * 100)}%`;
    }
  }, [transform.scale, zoomLabelRef]);

  const fitToView = useCallback(() => {
    const el = viewportRef.current;
    if (!el || !bounds.width || !bounds.height) return;
    const { width, height } = viewportSizeRef.current.width
      ? viewportSizeRef.current
      : el.getBoundingClientRect();

    const paddingX = 64;
    const paddingY = 64;
    const scaleX = (width - paddingX) / bounds.width;
    const scaleY = (height - paddingY) / bounds.height;
    let idealScale = Math.min(scaleX, scaleY);
    idealScale = Math.max(0.35, Math.min(0.85, idealScale));

    const centerX = bounds.minX + bounds.width / 2;
    const centerY = bounds.minY + bounds.height / 2;

    setTransform({
      scale: idealScale,
      x: width / 2 - centerX * idealScale,
      y: height / 2 - centerY * idealScale,
    });
  }, [bounds]);

  useEffect(() => {
    fitToView();
  }, [fitEpoch, bounds, fitToView]);

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

  const zoomBy = useCallback(
    (delta) => {
      const el = viewportRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, transformRef.current.scale + delta);
    },
    [zoomAt],
  );

  const centerNode = useCallback((nodeId) => {
    const el = viewportRef.current;
    const node = graphProps.nodeMap?.[nodeId];
    if (!el || !nodeId || !node) return;
    const { width, height } = viewportSizeRef.current.width
      ? viewportSizeRef.current
      : el.getBoundingClientRect();
    const targetScale = 0.85;
    const nc = nodeCenter(node);
    setTransform({
      scale: targetScale,
      x: width / 2 - nc.x * targetScale,
      y: height / 2 - nc.y * targetScale,
    });
  }, [graphProps.nodeMap]);

  useImperativeHandle(
    ref,
    () => ({
      fitToView,
      zoomBy,
      centerNode,
    }),
    [fitToView, zoomBy, centerNode],
  );

  const onWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    const el = viewportRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    setTransform((prev) => {
      const scale = clamp(prev.scale + delta, MIN_SCALE, MAX_SCALE);
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

  const onPointerDown = (e) => {
    if (e.button !== 0 && e.button !== 1) return;

    if (e.isPrimary === false || (pinchRef.current && e.pointerId !== pinchRef.current.pointers[0]?.id)) {
      const el = viewportRef.current;
      if (!el) return;
      const existing = pinchRef.current;
      if (existing && existing.pointers.length === 1) {
        existing.pointers.push({ id: e.pointerId, x: e.clientX, y: e.clientY });
        const [a, b] = existing.pointers;
        existing.startDist = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        existing.startScale = transformRef.current.scale;
        existing.startMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        dragRef.current = null;
        el.setPointerCapture(e.pointerId);
      }
      return;
    }

    const nodeEl = e.target.closest?.(".arch-canvas-node");
    const onNode = Boolean(nodeEl);
    const onCanvasSurface = Boolean(
      e.target === e.currentTarget ||
        e.target.dataset?.canvasBg === "1" ||
        e.target.closest?.(".arch-canvas-world") ||
        e.target.closest?.(".arch-canvas-group") ||
        e.target.closest?.(".arch-canvas-edges"),
    );
    const panning = e.button === 1 || spaceDown || onCanvasSurface || onNode;
    if (!panning) return;

    const cam = transformRef.current;
    e.currentTarget.setPointerCapture(e.pointerId);
    pinchRef.current = {
      pointers: [{ id: e.pointerId, x: e.clientX, y: e.clientY }],
      startDist: 0,
      startScale: cam.scale,
      startMid: { x: e.clientX, y: e.clientY },
    };
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX: cam.x,
      origY: cam.y,
      moved: false,
      onNode,
      nodeId: onNode ? nodeEl?.dataset?.nodeId : null,
    };
  };

  const onPointerMove = (e) => {
    const pinch = pinchRef.current;
    const drag = dragRef.current;
    if (!pinch && !drag) return;

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
        graphProps.onSelectNode?.(drag.nodeId);
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

  return (
    <div className="arch-canvas-wrapper">
      <div
        ref={viewportRef}
        className={`arch-canvas-viewport${activeFlowId ? " arch-canvas-viewport--flow-active" : ""}${searchQuery.trim() ? " arch-canvas-viewport--search-active" : ""}`}
        data-tour="canvas"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="application"
        aria-label={`${projectTitle} architecture canvas. Drag to pan, pinch/wheel to zoom.`}
      >
        <div className="arch-canvas-grid" data-canvas-bg="1" />
        <div
          className="arch-canvas-world"
          style={{
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          }}
        >
          <ArchGraphWorld {...graphProps} />
        </div>
      </div>

      <CanvasMinimap
        nodes={graphProps.nodes}
        groups={graphProps.groups}
        bounds={bounds}
        transform={transform}
        setTransform={setTransform}
        viewportRef={viewportRef}
        viewportSizeRef={viewportSizeRef}
      />

      <p className="arch-canvas-hint arch-canvas-hint--desktop">
        Drag to pan · Scroll to zoom · Space+drag · Click a node for detailed HLD/LLD inspector
      </p>
      <p className="arch-canvas-hint arch-canvas-hint--mobile">
        Drag to pan · Pinch or +/− to zoom · Tap a node for detailed inspector
      </p>
    </div>
  );
});

export default ArchCanvasViewport;

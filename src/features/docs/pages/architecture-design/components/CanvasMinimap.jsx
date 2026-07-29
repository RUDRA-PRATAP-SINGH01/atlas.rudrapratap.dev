import { memo, useLayoutEffect, useMemo, useRef, useState } from "react";

/**
 * Overview minimap for the architecture canvas.
 * Static geometry is memoized; only the viewport frame updates on camera moves.
 */
function CanvasMinimap({ nodes, groups, bounds, transform, setTransform, viewportRef, viewportSizeRef }) {
  const [collapsed, setCollapsed] = useState(false);
  const frameRef = useRef(null);

  const mapW = 180;
  const mapH = 120;
  const padding = 40;

  const layout = useMemo(() => {
    const totalW = (bounds.width || 1000) + padding * 2;
    const totalH = (bounds.height || 800) + padding * 2;
    const minX = (bounds.minX || 0) - padding;
    const minY = (bounds.minY || 0) - padding;
    const scale = Math.min(mapW / totalW, mapH / totalH);
    return { totalW, totalH, minX, minY, scale };
  }, [bounds]);

  const { minX, minY, scale } = layout;

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame || collapsed) return;

    const size = viewportSizeRef?.current;
    const vpW = size?.width || viewportRef.current?.clientWidth || 0;
    const vpH = size?.height || viewportRef.current?.clientHeight || 0;
    if (!vpW || !vpH) return;

    const worldX1 = (0 - transform.x) / transform.scale;
    const worldY1 = (0 - transform.y) / transform.scale;
    const worldW = vpW / transform.scale;
    const worldH = vpH / transform.scale;

    const x = Math.max(0, (worldX1 - minX) * scale);
    const y = Math.max(0, (worldY1 - minY) * scale);
    const w = Math.min(mapW, worldW * scale);
    const h = Math.min(mapH, worldH * scale);

    frame.setAttribute("x", String(x));
    frame.setAttribute("y", String(y));
    frame.setAttribute("width", String(w));
    frame.setAttribute("height", String(h));
  }, [transform, minX, minY, scale, collapsed, viewportRef, viewportSizeRef]);

  const handleMinimapClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const worldX = minX + clickX / scale;
    const worldY = minY + clickY / scale;

    const size = viewportSizeRef?.current;
    const vpW = size?.width || viewportRef.current?.clientWidth || 0;
    const vpH = size?.height || viewportRef.current?.clientHeight || 0;
    if (!vpW || !vpH) return;

    setTransform((prev) => ({
      ...prev,
      x: vpW / 2 - worldX * prev.scale,
      y: vpH / 2 - worldY * prev.scale,
    }));
  };

  const staticGeometry = useMemo(
    () => (
      <>
        {groups.map((g) => (
          <rect
            key={g.id}
            x={(g.x - minX) * scale}
            y={(g.y - minY) * scale}
            width={g.w * scale}
            height={g.h * scale}
            fill="none"
            stroke="rgba(255,255,255,0.12)"
            strokeDasharray="2 2"
          />
        ))}
        {nodes.map((n) => (
          <rect
            key={n.id}
            x={(n.x - minX) * scale}
            y={(n.y - minY) * scale}
            width={(n.w || 160) * scale}
            height={(n.h || 56) * scale}
            className="arch-minimap-rect-node"
          />
        ))}
      </>
    ),
    [groups, nodes, minX, minY, scale],
  );

  return (
    <div className="arch-canvas-minimap">
      <div className="arch-minimap-header">
        <span className="arch-minimap-title">🗺️ Minimap</span>
        <button
          type="button"
          className="arch-minimap-toggle-btn"
          onClick={() => setCollapsed((p) => !p)}
        >
          {collapsed ? "Expand ▲" : "Hide ▼"}
        </button>
      </div>
      {!collapsed && (
        <div className="arch-minimap-svg-wrap" onClick={handleMinimapClick}>
          <svg width={mapW} height={mapH} viewBox={`0 0 ${mapW} ${mapH}`}>
            {staticGeometry}
            <rect
              ref={frameRef}
              x={0}
              y={0}
              width={mapW}
              height={mapH}
              className="arch-minimap-viewport-frame"
            />
          </svg>
        </div>
      )}
    </div>
  );
}

export default memo(CanvasMinimap);

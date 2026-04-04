type Props = {
  ctx: any;
};

export default function MapCanvas({ ctx }: Props) {
  const {
    imageUrl,
    viewportRef,
    viewMode,
    dragging,
    handleViewportMouseDown,
    handleViewportMouseMove,
    endDragging,
    handleViewportWheel,
    scheduleVisibleBoundsUpdate,
    imageWidth,
    imageHeight,
    zoom,
    selectedMap,
    setLoadedSize,
    syncLoadedImageMeta,
    polygons,
    selectedHexKeySet,
    selectedHex,
    visibleImageBounds,
    showTileStatePills,
    showTileNumbering,
    tileStateBadgesByKey,
    EMPTY_STATE_BADGES,
    suppressClickRef,
    setTileContextMenu,
    setSelectedHexIfChanged,
    showRegionStatusPills,
    activeTileRegionStates,
    activeTileMemos,
  } = ctx;

  return !imageUrl ? (
    <div className="rounded-lg border border-dashed border-zinc-800 px-4 py-10 text-sm text-zinc-500">
      지도가 없습니다. 먼저 이미지를 등록해 주세요.
    </div>
  ) : (
    <div
      ref={viewportRef}
      className={[
        "relative max-h-[78vh] rounded-lg border border-zinc-800 bg-[#08090c] p-2",
        viewMode === "drag" ? "overflow-hidden" : "overflow-auto",
        viewMode === "drag" ? "select-none" : "",
      ].join(" ")}
      style={{
        cursor: viewMode === "drag" ? (dragging ? "grabbing" : "grab") : "default",
        touchAction: viewMode === "drag" ? "none" : "auto",
        overscrollBehavior: viewMode === "drag" ? "none" : "auto",
      }}
      onMouseDown={handleViewportMouseDown}
      onMouseMove={handleViewportMouseMove}
      onMouseUp={endDragging}
      onMouseLeave={endDragging}
      onWheelCapture={handleViewportWheel}
      onWheel={handleViewportWheel}
      onScroll={viewMode === "scroll" ? scheduleVisibleBoundsUpdate : undefined}
    >
      <div
        className="relative origin-top-left"
        style={{
          width: imageWidth ? `${imageWidth * zoom}px` : "100%",
          height: imageHeight ? `${imageHeight * zoom}px` : "auto",
        }}
      >
        <img
          src={imageUrl}
          alt={selectedMap.name}
          className="block h-full w-full object-contain"
          onLoad={(e) => {
            const img = e.currentTarget;
            setLoadedSize({
              width: img.naturalWidth,
              height: img.naturalHeight,
            });
            void syncLoadedImageMeta(img.naturalWidth, img.naturalHeight);
          }}
        />
        {imageWidth > 0 && imageHeight > 0 ? (
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox={`0 0 ${imageWidth} ${imageHeight}`}
            preserveAspectRatio="none"
          >
            {polygons.map((poly: any) => {
              const active = selectedHex?.col === poly.col && selectedHex?.row === poly.row;
              const activeByMulti = selectedHexKeySet?.has?.(poly.tileKey) ?? false;
              const isActive = activeByMulti || active;
              const pillCullMargin = Math.max(selectedMap.hexSize * 1.4, 90);
              const isPillInViewport =
                !visibleImageBounds ||
                (poly.cx >= visibleImageBounds.left - pillCullMargin &&
                  poly.cx <= visibleImageBounds.right + pillCullMargin &&
                  poly.cy >= visibleImageBounds.top - pillCullMargin &&
                  poly.cy <= visibleImageBounds.bottom + pillCullMargin);
              const stateBadges: Array<{ text: string; color: string }> =
                showTileStatePills && isPillInViewport
                  ? (tileStateBadgesByKey[poly.tileKey] ?? EMPTY_STATE_BADGES)
                  : EMPTY_STATE_BADGES;
              const tileNumber = poly.row * selectedMap.cols + poly.col + 1;
              const tileNumberFontSize = Math.max(18, Math.round(selectedMap.hexSize * 0.7));
              const hasMemo =
                typeof activeTileMemos?.[poly.tileKey] === "string" &&
                String(activeTileMemos[poly.tileKey]).trim().length > 0;
              return (
                <g key={poly.key}>
                  <polygon
                    points={poly.points}
                    fill={isActive ? "rgba(245, 158, 11, 0.18)" : "rgba(0,0,0,0)"}
                    stroke={isActive ? "rgba(251,191,36,0.92)" : "rgba(56,189,248,0.48)"}
                    strokeWidth={isActive ? 2.2 : 1}
                    style={{
                      cursor:
                        viewMode === "drag" ? (dragging ? "grabbing" : "grab") : "pointer",
                    }}
                    onClick={(e) => {
                      if (suppressClickRef.current) return;
                      setTileContextMenu(null);
                      const withModifier = e.ctrlKey || e.shiftKey;
                      setSelectedHexIfChanged(poly.col, poly.row, withModifier, withModifier);
                    }}
                    onContextMenu={(e) => {
                      if (suppressClickRef.current) return;
                      e.preventDefault();
                      setTileContextMenu({
                        x: e.clientX,
                        y: e.clientY,
                        col: poly.col,
                        row: poly.row,
                      });
                    }}
                  />
                  {showTileNumbering && isPillInViewport ? (
                    <g pointerEvents="none">
                      <text
                        x={poly.cx}
                        y={poly.cy}
                        fill="rgba(244, 244, 245, 0.26)"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        style={{
                          fontSize: `${tileNumberFontSize}px`,
                          fontWeight: 800,
                          paintOrder: "stroke",
                          stroke: "rgba(0,0,0,0.22)",
                          strokeWidth: 0.8,
                        }}
                      >
                        {tileNumber}
                      </text>
                    </g>
                  ) : null}
                  {hasMemo && isPillInViewport ? (
                    <g pointerEvents="none">
                      {(() => {
                        const hexSize = selectedMap.hexSize;
                        const w = 18;
                        const h = 14;
                        const x = poly.cx - w / 2;
                        const y = poly.cy - hexSize * 0.66 - h / 2;
                        return (
                          <>
                            <rect
                              x={x}
                              y={y}
                              width={w}
                              height={h}
                              rx={6}
                              fill="rgba(0,0,0,0.62)"
                              stroke="rgba(250,204,21,0.8)"
                              strokeWidth={0.8}
                            />
                            <text
                              x={x + w / 2}
                              y={y + h / 2}
                              fill="#facc15"
                              textAnchor="middle"
                              dominantBaseline="middle"
                              style={{
                                fontSize: "9px",
                                fontWeight: 700,
                                paintOrder: "stroke",
                                stroke: "rgba(0,0,0,0.7)",
                                strokeWidth: 1,
                              }}
                            >
                              📝
                            </text>
                          </>
                        );
                      })()}
                    </g>
                  ) : null}
                  {showRegionStatusPills && isPillInViewport ? (
                    <g pointerEvents="none">
                      {(() => {
                        const hexSize = selectedMap.hexSize;
                        const pillH = 16;
                        const statW = Math.max(42, Math.round(hexSize * 0.4));
                        const regionState = activeTileRegionStates[poly.tileKey];
                        const hasSpace =
                          regionState?.spaceUsed != null || regionState?.spaceCap != null;
                        const hasThreat = regionState?.threat != null;
                        const hasPollution = regionState?.pollution != null;
                        const cornerCenters = {
                          tl: { x: poly.cx - hexSize * 0.36, y: poly.cy - hexSize * 0.58 },
                          tr: { x: poly.cx + hexSize * 0.36, y: poly.cy - hexSize * 0.58 },
                          bl: { x: poly.cx - hexSize * 0.36, y: poly.cy + hexSize * 0.56 },
                          br: { x: poly.cx + hexSize * 0.36, y: poly.cy + hexSize * 0.56 },
                        } as const;
                        const metricPills: Array<{
                          key: string;
                          text: string;
                          color: string;
                          w: number;
                          center: keyof typeof cornerCenters;
                        }> = [];
                        if (hasSpace) {
                          metricPills.push({
                            key: "space",
                            text: `${regionState?.spaceUsed ?? 0} / ${regionState?.spaceCap ?? 0}`,
                            color: "#38bdf8",
                            w: statW,
                            center: "tl",
                          });
                        }
                        if (hasThreat) {
                          metricPills.push({
                            key: "threat",
                            text: `⚠️ ${Math.max(0, Math.trunc(Number(regionState?.threat ?? 0) || 0))}`,
                            color: "#ef4444",
                            w: statW,
                            center: "bl",
                          });
                        }
                        if (hasPollution) {
                          metricPills.push({
                            key: "pollution",
                            text: `☣️ ${regionState?.pollution ?? 0}`,
                            color: "#c084fc",
                            w: statW,
                            center: "br",
                          });
                        }
                        return metricPills.map((pill) => {
                          const c = cornerCenters[pill.center];
                          const x = c.x - pill.w / 2;
                          const y = c.y - pillH / 2;
                          return (
                            <g key={`metric-${pill.key}`}>
                              <rect
                                x={x}
                                y={y}
                                width={pill.w}
                                height={pillH}
                                rx={7}
                                fill="rgba(0,0,0,0.58)"
                                stroke={pill.color}
                                strokeWidth={0.8}
                              />
                              <text
                                x={c.x}
                                y={c.y}
                                fill={pill.color}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                style={{
                                  fontSize: "10px",
                                  fontWeight: 700,
                                  paintOrder: "stroke",
                                  stroke: "rgba(0,0,0,0.65)",
                                  strokeWidth: 0.8,
                                }}
                              >
                                {pill.text}
                              </text>
                            </g>
                          );
                        });
                      })()}
                    </g>
                  ) : null}
                  {showTileStatePills && isPillInViewport && stateBadges.length > 0 ? (
                    <g pointerEvents="none">
                      {(() => {
                        const fontSize = 11;
                        const pillHeight = 18;
                        const pillRadius = 8;
                        const colGap = 4;
                        const rowGap = 4;
                        const maxPerRow = 3;
                        const measured = stateBadges.map((badge) => ({
                          ...badge,
                          width: Math.max(
                            53,
                            Math.min(238, Math.round(badge.text.length * 7.75 + 18))
                          ),
                        }));
                        const rows: typeof measured[] = [];
                        for (let i = 0; i < measured.length; i += maxPerRow) {
                          rows.push(measured.slice(i, i + maxPerRow));
                        }
                        const totalHeight =
                          rows.length * pillHeight + Math.max(0, rows.length - 1) * rowGap;
                        const top = poly.cy - totalHeight / 2;

                        return rows.map((rowBadges, rowIdx) => {
                          const rowWidth =
                            rowBadges.reduce((sum, b) => sum + b.width, 0) +
                            Math.max(0, rowBadges.length - 1) * colGap;
                          let left = poly.cx - rowWidth / 2;
                          const y = top + rowIdx * (pillHeight + rowGap);

                          return rowBadges.map((badge, colIdx) => {
                            const x = left;
                            left += badge.width + colGap;
                            return (
                              <g key={`badge-${rowIdx}-${colIdx}`}>
                                <rect
                                  x={x}
                                  y={y}
                                  width={badge.width}
                                  height={pillHeight}
                                  rx={pillRadius}
                                  fill="rgba(0,0,0,0.55)"
                                  stroke="rgba(255,255,255,0.12)"
                                  strokeWidth={0.7}
                                />
                                <text
                                  x={x + badge.width / 2}
                                  y={y + pillHeight / 2}
                                  fill={badge.color}
                                  textAnchor="middle"
                                  dominantBaseline="middle"
                                  style={{
                                    fontSize: `${fontSize}px`,
                                    fontWeight: 700,
                                    paintOrder: "stroke",
                                    stroke: "rgba(0,0,0,0.6)",
                                    strokeWidth: 0.8,
                                  }}
                                >
                                  {badge.text}
                                </text>
                              </g>
                            );
                          });
                        });
                      })()}
                    </g>
                  ) : null}
                </g>
              );
            })}
          </svg>
        ) : null}
      </div>
    </div>
  );
}

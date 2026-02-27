// src/Board.tsx
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type DragEvent as ReactDragEvent,
} from "react";
import type { Marker, Pos, Unit } from "./types";
import { unitTextColor } from "./UnitColor";

type View = { minX: number; maxX: number; minZ: number; maxZ: number };

function keyXZ(x: number, z: number) {
  return `${x},${z}`;
}

function formatSummaryTags(u: Unit): string[] {
  const order: string[] = [];
  const bag = new Map<string, { stacks?: number }>();

  function addTag(raw: string, stacks?: number) {
    const key = (raw ?? "").trim();
    if (!key) return;
    if (!bag.has(key)) {
      bag.set(key, {});
      order.push(key);
    }
    if (stacks !== undefined) {
      const s = Math.max(1, Math.trunc(Number(stacks)));
      const cur = bag.get(key)!;
      cur.stacks = cur.stacks === undefined ? s : Math.max(cur.stacks, s);
    }
  }

  const manual = Array.isArray(u.tags) ? u.tags : [];
  for (const t of manual) addTag(t);

  const states = u.tagStates ?? {};
  for (const [k, st] of Object.entries(states)) {
    const stacks = Math.max(1, Math.trunc(Number((st as any)?.stacks ?? 1)));
    addTag(k, stacks);
  }

  return order.map((k) => {
    const it = bag.get(k);
    if (it?.stacks !== undefined) return `${k} x${it.stacks}`;
    return k;
  });
}

export default function Board(props: {
  units: Unit[];
  markers: Marker[];
  selectedIds: string[];
  selectedId: string | null; // primary
  onSelectUnit: (id: string, opts?: { additive?: boolean }) => void;
  onOpenUnitMenu?: (e: MouseEvent, unitId: string) => void;
  onMoveUnitsByDelta?: (unitIds: string[], dx: number, dz: number) => void;
  view: View;
  maxHeightPx?: number;
  markerSelectActive?: boolean;
  selectedMarkerCells?: Pos[];
  onSelectCell?: (pos: Pos, opts?: { additive?: boolean }) => void;
  onToggleMarkerCreate?: () => void;
  markerCreateActive?: boolean;
  onOpenSideMemo?: () => void;
  sideMemoActive?: boolean;
}) {
  const {
    units,
    markers,
    selectedIds,
    selectedId,
    onSelectUnit,
    onOpenUnitMenu,
    onMoveUnitsByDelta,
    view,
    maxHeightPx = 520,
    markerSelectActive = false,
    selectedMarkerCells = [],
    onSelectCell,
    onToggleMarkerCreate,
    markerCreateActive = false,
    onOpenSideMemo,
    sideMemoActive = false,
  } = props;

  // ✅ 여기만 조절하면 "셀 크기/폰트"가 확실히 바뀜 (Tailwind 스캔 문제 없음)
  const AXIS_W = 52; // 왼쪽 z 라벨 폭
  const CELL_W = 100; // 셀 가로 폭(고정)
  const CELL_MIN_H = 80; // 셀 최소 세로 높이(내용 많으면 더 커짐)
  const FONT_AXIS = 12; // 축 라벨 폰트
  const FONT_ITEM = 11; // 셀 내부(유닛/마커) 폰트
  const LINE_H = 1.15;

  const cols = view.maxX - view.minX + 1;
  const rows = view.maxZ - view.minZ + 1;

  const xLabels = useMemo(() => {
    const xs: number[] = [];
    for (let x = view.minX; x <= view.maxX; x++) xs.push(x);
    return xs;
  }, [view.minX, view.maxX]);

  const cellUnits = useMemo(() => {
    const map = new Map<string, Unit[]>();
    for (const u of units) {
      if (!u.pos) continue;
      const k = keyXZ(u.pos.x, u.pos.z);
      const arr = map.get(k) ?? [];
      arr.push(u);
      map.set(k, arr);
    }
    return map;
  }, [units]);

  const cellMarkers = useMemo(() => {
    const map = new Map<string, Marker[]>();
    for (const m of markers) {
      // Render multi-cell markers across all selected cells.
      const cells =
        Array.isArray(m.cells) && m.cells.length > 0 ? m.cells : [m.pos];
      for (const cell of cells) {
        if (!cell) continue;
        const k = keyXZ(cell.x, cell.z);
        const arr = map.get(k) ?? [];
        arr.push(m);
        map.set(k, arr);
      }
    }
    return map;
  }, [markers]);

  const selectedCellSet = useMemo(() => {
    const set = new Set<string>();
    for (const c of selectedMarkerCells ?? []) {
      if (!c) continue;
      set.add(keyXZ(c.x, c.z));
    }
    return set;
  }, [selectedMarkerCells]);
  const [dropTargetCell, setDropTargetCell] = useState<string | null>(null);
  const [hoveredUnitId, setHoveredUnitId] = useState<string | null>(null);
  const hoverTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) {
        window.clearTimeout(hoverTimerRef.current);
      }
    };
  }, []);

  function handleUnitDragStart(e: ReactDragEvent, unitId: string) {
    if (markerSelectActive) return;
    e.dataTransfer.setData("application/x-unit-id", unitId);
    e.dataTransfer.setData("text/plain", unitId);
    e.dataTransfer.effectAllowed = "move";
  }

  // =========================
  // ✅ "카메라(스크롤)" 자동 이동
  // =========================
  const scrollRef = useRef<HTMLDivElement | null>(null);

  function centerToCell(container: HTMLDivElement, target: HTMLElement) {
    const c = container.getBoundingClientRect();
    const t = target.getBoundingClientRect();

    const nextLeft =
      container.scrollLeft + (t.left - c.left) - (c.width / 2 - t.width / 2);
    const nextTop =
      container.scrollTop + (t.top - c.top) - (c.height / 2 - t.height / 2);

    container.scrollTo({ left: nextLeft, top: nextTop, behavior: "smooth" });
  }

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    // 선택된 유닛의 pos 찾기
    const pos = units.find((u) => u.id === selectedId)?.pos;
    if (!pos) return;

    const k = keyXZ(pos.x, pos.z);
    const el = container.querySelector(
      `[data-cell="${k}"]`
    ) as HTMLElement | null;
    if (!el) return;

    // 레이아웃이 확정된 다음 스크롤 이동 (덜 튐)
    requestAnimationFrame(() => centerToCell(container, el));
  }, [
    selectedId,
    units,
    view.minX,
    view.maxX,
    view.minZ,
    view.maxZ, // view 범위가 바뀌어 DOM이 재배치될 때도 따라가게
  ]);

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-semibold text-zinc-200">Battle Grid</div>
        <div className="flex items-center gap-2">
          {onOpenSideMemo && (
            <button
              type="button"
              onClick={onOpenSideMemo}
              className={[
                "rounded-lg border px-2 py-1 text-[11px] font-semibold",
                "border-sky-500/40 bg-sky-950/30 text-sky-200",
                "hover:bg-sky-900/35 hover:text-sky-100",
                sideMemoActive ? "ring-1 ring-sky-400/60" : "",
              ].join(" ")}
              title="Edit side notes"
            >
              진영 메모
            </button>
          )}
          {onToggleMarkerCreate && (
            <button
              type="button"
              onClick={onToggleMarkerCreate}
              className={[
                "rounded-lg border px-2 py-1 text-[11px] font-semibold",
                "border-amber-500/50 bg-amber-950/25 text-amber-200",
                "hover:bg-amber-900/35 hover:text-amber-100",
                markerCreateActive ? "ring-1 ring-amber-400/60" : "",
              ].join(" ")}
              title="Select cells to create a marker"
            >
              마커 생성
            </button>
          )}
        </div>
      </div>

      {/* ✅ 그리드 전체 스크롤 뷰 */}
      <div
        ref={scrollRef}
        className="overflow-auto rounded-xl border border-zinc-800 bg-zinc-950/20 p-2"
        style={{ maxHeight: maxHeightPx }}
      >
        {/* ✅ 가로 스크롤을 위해 내용폭만큼 확장 */}
        <div className="w-max">
          {/* X axis header */}
          <div
            className="mb-1 grid gap-1"
            style={{
              gridTemplateColumns: `${AXIS_W}px repeat(${cols}, ${CELL_W}px)`,
            }}
          >
            <div className="h-7" />
            {xLabels.map((x) => (
              <div
                key={`x-${x}`}
                className="h-7 rounded-md border border-zinc-800 bg-zinc-950/40 text-center flex items-center justify-center"
                style={{
                  fontSize: FONT_AXIS,
                  lineHeight: LINE_H,
                  color: x === 0 ? "rgb(110 231 183)" : "rgb(161 161 170)", // emerald-300 / zinc-400 느낌
                }}
                title={`x=${x}`}
              >
                {x}
              </div>
            ))}
          </div>

          {/* Grid body
              ✅ 포인트: gridAutoRows를 minmax로 주면
              - 최소 높이는 보장(CELL_MIN_H)
              - 내용이 많으면 row 높이가 "자동으로" 커짐
          */}
          <div
            className="grid gap-1"
            style={{
              gridTemplateColumns: `${AXIS_W}px repeat(${cols}, ${CELL_W}px)`,
              gridAutoRows: `minmax(${CELL_MIN_H}px, max-content)`,
            }}
          >
            {Array.from({ length: rows }).map((_, r) => {
              const z = view.maxZ - r; // 위에서 아래로

              return (
                <div key={`row-${z}`} className="contents">
                  {/* Z axis label */}
                  <div
                    className="rounded-md border border-zinc-800 bg-zinc-950/40 flex items-center justify-center"
                    style={{
                      fontSize: FONT_AXIS,
                      lineHeight: LINE_H,
                      color: z === 0 ? "rgb(110 231 183)" : "rgb(161 161 170)",
                    }}
                    title={`z=${z}`}
                  >
                    z {z}
                  </div>

                  {xLabels.map((x) => {
                    const k = keyXZ(x, z);
                    const us = cellUnits.get(k) ?? [];
                    const ms = cellMarkers.get(k) ?? [];
                    const hasSel = us.some((u) => u.id === selectedId);
                    const isMarkerSelected =
                      markerSelectActive && selectedCellSet.has(k);

                    return (
                      <div
                        key={`cell-${k}`}
                        data-cell={k} // ✅ 자동 포커스용
                        className={[
                          "rounded-lg border px-2 py-1 text-left",
                          "border-zinc-800 bg-zinc-950/30",
                          x === 0 ? "bg-zinc-950/45" : "",
                          z === 0 ? "ring-1 ring-emerald-900/40" : "",
                          hasSel ? "outline outline-1 outline-white/60" : "",
                          isMarkerSelected
                            ? "outline outline-2 outline-amber-300/70"
                            : "",
                          dropTargetCell === k
                            ? "outline outline-2 outline-sky-300/80"
                            : "",
                          markerSelectActive ? "cursor-pointer" : "",
                        ].join(" ")}
                        style={{
                          minHeight: CELL_MIN_H, // ✅ 최소 높이 보장
                        }}
                        title={`(${x},${z})`}
                        onDragOver={(e) => {
                          if (markerSelectActive || !onMoveUnitsByDelta) return;
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                          setDropTargetCell(k);
                        }}
                        onDragLeave={() => {
                          setDropTargetCell((prev) => (prev === k ? null : prev));
                        }}
                        onDrop={(e) => {
                          if (markerSelectActive || !onMoveUnitsByDelta) return;
                          e.preventDefault();
                          setDropTargetCell(null);
                          const unitId =
                            e.dataTransfer.getData("application/x-unit-id") ||
                            e.dataTransfer.getData("text/plain");
                          if (!unitId) return;
                          const dragged = units.find((u) => u.id === unitId);
                          if (!dragged?.pos) return;
                          const dx = x - dragged.pos.x;
                          const dz = z - dragged.pos.z;
                          if (dx === 0 && dz === 0) return;
                          const targets = selectedIds.includes(unitId)
                            ? selectedIds
                            : [unitId];
                          const targetIds = targets.filter((id) =>
                            units.some((u) => u.id === id && u.pos)
                          );
                          if (targetIds.length === 0) return;
                          onMoveUnitsByDelta(targetIds, dx, dz);
                        }}
                        onClick={(e) => {
                          if (!markerSelectActive || !onSelectCell) return;
                          onSelectCell(
                            { x, z },
                            {
                              additive: e.shiftKey || e.ctrlKey || e.metaKey,
                            }
                          );
                        }}
                      >
                        {/* markers */}
                        {ms.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {/* Render markers as chips for quick scanning */}
                            {ms.map((m) => {
                              const alias = (m.alias ?? "").trim();
                              const label = alias || m.name;
                              const title = alias
                                ? `${m.name} (${alias})`
                                : m.name;

                              return (
                                <span
                                  key={m.id}
                                  className="inline-flex max-w-full items-center rounded-full border border-amber-800/60 bg-amber-950/40 px-2 py-0.5 text-[10px] font-semibold text-amber-200"
                                  style={{ lineHeight: LINE_H }}
                                  title={title}
                                >
                                  <span className="truncate">{label}</span>
                                </span>
                              );
                            })}
                          </div>
                        )}

                        {/* units */}
                        {us.length > 0 && (
                          <div
                            className={
                              ms.length > 0 ? "mt-1 space-y-0.5" : "space-y-0.5"
                            }
                          >
                            {us.map((u) => {
                              const label = (u.alias ?? "").trim() || u.name; // ✅ alias 우선, 없으면 name
                              const isHidden = !!u.hidden;
                              const color = isHidden ? "#ffffff" : unitTextColor(u); // ? colorCode 반영
                              const displayLabel = isHidden
                                ? `${label} 🥷`
                                : label;

                              const isPrimary = u.id === selectedId;
                              const isMulti = selectedIds.includes(u.id);
                              const showBubble = hoveredUnitId === u.id;
                              const hpCur =
                                typeof u.hp?.cur === "number" ? u.hp.cur : null;
                              const hpMax =
                                typeof u.hp?.max === "number" ? u.hp.max : null;
                              const hpTemp =
                                typeof u.hp?.temp === "number"
                                  ? u.hp.temp
                                  : null;
                              const integrity =
                                typeof u.integrityBase === "number"
                                  ? u.integrityBase
                                  : null;
                              const ac =
                                typeof u.acBase === "number" ? u.acBase : null;
                              const dsSuccess =
                                typeof u.deathSaves?.success === "number"
                                  ? u.deathSaves.success
                                  : 0;
                              const dsFailure =
                                typeof u.deathSaves?.failure === "number"
                                  ? u.deathSaves.failure
                                  : -1;
                              const showDeathSaves =
                                !(dsSuccess === 0 && dsFailure === -1);
                              const summaryTags = formatSummaryTags(u);

                              return (
                                <div key={u.id} className="relative">
                                  {showBubble && (
                                    <div className="pointer-events-none absolute left-0 top-0 z-20 -translate-y-full">
                                      <div className="relative max-w-[220px] rounded-lg border border-zinc-700/50 bg-zinc-950/55 px-2 py-1.5 text-[10px] text-zinc-200 shadow-xl backdrop-blur-[1px]">
                                        <div className="font-semibold text-zinc-100">
                                          {(u.alias ?? "").trim() || u.name}
                                        </div>
                                        <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
                                          <span className="text-red-400">
                                            HP{" "}
                                            <span className="font-semibold">
                                              {hpCur !== null && hpMax !== null
                                                ? `${hpCur}/${hpMax}`
                                                : "-"}
                                            </span>
                                            {hpTemp !== null ? (
                                              <span className="ml-1 font-semibold text-green-400">
                                                +{hpTemp}
                                              </span>
                                            ) : null}
                                            {integrity !== null ? (
                                              <span className="ml-1 text-violet-300">
                                                ({integrity})
                                              </span>
                                            ) : null}
                                          </span>
                                          <span className="text-yellow-300">
                                            AC{" "}
                                            <span className="font-semibold">
                                              {ac ?? "-"}
                                            </span>
                                          </span>
                                          {showDeathSaves && (
                                            <span className="text-zinc-400">
                                              (
                                              <span className="font-semibold text-green-400">
                                                {dsSuccess}
                                              </span>
                                              ,{" "}
                                              <span className="font-semibold text-red-400">
                                                {dsFailure}
                                              </span>
                                              )
                                            </span>
                                          )}
                                        </div>
                                        {summaryTags.length > 0 && (
                                          <div className="mt-1 text-violet-300">
                                            {summaryTags.join(", ")}
                                          </div>
                                        )}
                                        <div className="absolute left-3 top-full h-2 w-2 -translate-y-1 rotate-45 border-b border-l border-zinc-700/50 bg-zinc-950/55" />
                                      </div>
                                    </div>
                                  )}

                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onSelectUnit(u.id, {
                                        additive:
                                          e.shiftKey || e.ctrlKey || e.metaKey,
                                      });
                                    }}
                                    onMouseEnter={() => {
                                      if (hoverTimerRef.current) {
                                        window.clearTimeout(
                                          hoverTimerRef.current
                                        );
                                      }
                                      hoverTimerRef.current =
                                        window.setTimeout(() => {
                                          setHoveredUnitId(u.id);
                                        }, 250);
                                    }}
                                    onMouseLeave={() => {
                                      if (hoverTimerRef.current) {
                                        window.clearTimeout(
                                          hoverTimerRef.current
                                        );
                                        hoverTimerRef.current = null;
                                      }
                                      setHoveredUnitId((prev) =>
                                        prev === u.id ? null : prev
                                      );
                                    }}
                                    onContextMenu={(e) => {
                                      if (!onOpenUnitMenu) return;
                                      e.preventDefault();
                                      e.stopPropagation();
                                      onOpenUnitMenu(e, u.id);
                                    }}
                                    className={[
                                      "block w-full truncate rounded-md border px-1.5 py-0.5 text-left",
                                      "border-zinc-800 bg-zinc-950/20 hover:bg-zinc-900/60",
                                      "transition-colors",
                                      "cursor-grab active:cursor-grabbing",
                                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50",
                                      "active:bg-zinc-900/80",
                                      isPrimary
                                        ? "border-emerald-300 bg-emerald-950/70 ring-2 ring-emerald-300/60 shadow-[0_0_0_1px_rgba(16,185,129,0.25)]"
                                        : isMulti
                                          ? "border-sky-300 bg-sky-950/40 ring-2 ring-sky-300/60 shadow-[0_0_0_1px_rgba(56,189,248,0.22)]"
                                          : "",
                                    ].join(" ")}
                                    style={{
                                      color, // ✅ 유닛별 컬러
                                      fontSize: FONT_ITEM,
                                      lineHeight: LINE_H,
                                    }}
                                    title={
                                      u.name + (u.alias ? ` (${u.alias})` : "")
                                    } // ✅ 툴팁은 둘 다 보이게
                                    draggable={!markerSelectActive}
                                    onDragStart={(e) =>
                                      handleUnitDragStart(e, u.id)
                                    }
                                  >
                                    {displayLabel}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-2 text-xs text-zinc-500">
        * 1칸(인접) = 3m. z는 층, x는 거리축.
      </div>
    </section>
  );
}

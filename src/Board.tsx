// src/Board.tsx
import { useEffect, useMemo, useRef } from "react";
import type { Marker, Pos, Unit } from "./types";
import { unitTextColor } from "./UnitColor";

type View = { minX: number; maxX: number; minZ: number; maxZ: number };

function keyXZ(x: number, z: number) {
  return `${x},${z}`;
}

function bringSelectedFirst<T extends { id: string }>(
  arr: T[],
  selectedId: string | null
): T[] {
  if (!selectedId) return arr;
  const idx = arr.findIndex((u) => u.id === selectedId);
  if (idx <= 0) return arr; // 없거나 이미 맨 앞이면 그대로

  // 선택된 것만 맨 앞으로 (나머지는 기존 상대 순서 유지)
  return [arr[idx], ...arr.slice(0, idx), ...arr.slice(idx + 1)];
}

export default function Board(props: {
  units: Unit[];
  markers: Marker[];
  selectedIds: string[];
  selectedId: string | null; // primary
  onSelectUnit: (id: string, opts?: { additive?: boolean }) => void;
  view: View;
  maxHeightPx?: number;
  markerSelectActive?: boolean;
  selectedMarkerCells?: Pos[];
  onSelectCell?: (pos: Pos, opts?: { additive?: boolean }) => void;
  onToggleMarkerCreate?: () => void;
  markerCreateActive?: boolean;
}) {
  const {
    units,
    markers,
    selectedIds,
    selectedId,
    onSelectUnit,
    view,
    maxHeightPx = 520,
    markerSelectActive = false,
    selectedMarkerCells = [],
    onSelectCell,
    onToggleMarkerCreate,
    markerCreateActive = false,
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
                          markerSelectActive ? "cursor-pointer" : "",
                        ].join(" ")}
                        style={{
                          minHeight: CELL_MIN_H, // ✅ 최소 높이 보장
                        }}
                        title={`(${x},${z})`}
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

                              return (
                                <button
                                  key={u.id}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectUnit(u.id, {
                                      additive:
                                        e.shiftKey || e.ctrlKey || e.metaKey,
                                    });
                                  }}
                                  className={[
                                    "block w-full truncate rounded-md border px-1.5 py-0.5 text-left",
                                    "border-zinc-800 bg-zinc-950/20 hover:bg-zinc-900/60",
                                    "transition-colors",
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
                                >
                                  {displayLabel}
                                </button>
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

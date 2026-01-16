// src/TurnOrderBar.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import type { Marker, Unit } from "./types";
import { unitTextColor } from "./UnitColor";

// turnOrder에 label 같은 게 섞여 있어도 unitId만 최대한 뽑아내기
function extractUnitId(entry: any): string | null {
  if (!entry) return null;
  if (typeof entry === "string") return entry;
  if (typeof entry === "object") {
    if (typeof entry.unitId === "string") return entry.unitId;
    if (typeof entry.id === "string") return entry.id;
    if (typeof entry?.unit?.id === "string") return entry.unit.id;
  }
  return null;
}

function mod(n: number, m: number) {
  return ((n % m) + m) % m;
}

function turnLabel(u: Unit | undefined | null) {
  if (!u) return "unknown";
  const alias = ((u as any).alias ?? "").toString().trim();
  // ✅ TurnOrderBar에서는 alias만 표시 (없으면 name)
  return alias || u.name || "unknown";
}

function markerLabel(m: Marker | undefined | null) {
  if (!m) return "marker";
  const alias = (m.alias ?? "").toString().trim();
  return alias || m.name || m.id;
}

export default function TurnOrderBar(props: {
  units: Unit[];
  markers: Marker[];
  turnOrder: any[]; // backend에서 오는 turnOrder (label 섞여도 OK)
  // 둘 중 하나만 있어도 동작. 둘 다 주면 currentUnitId 우선.
  turnOrderIndex?: number | null; // turnOrder 배열 기준 현재 위치
  currentUnitId?: string | null; // 현재 턴 유닛 id
  className?: string;
  round?: number | null; // backend state.round
  battleStarted?: boolean;
  busy?: boolean;
  onReorder?: () => void;
  onNextTurn?: () => void;
  onBattleStart?: () => void;
  onTempTurn: () => void;
  canTempTurn: boolean;
  tempTurnStack?: string[];
}) {
  const {
    units,
    markers,
    turnOrder,
    turnOrderIndex,
    currentUnitId,
    className,
    round: roundProp,
    battleStarted,
    busy,
    onReorder,
    onNextTurn,
    onBattleStart,
    onTempTurn,
    canTempTurn,
    tempTurnStack,
  } = props;

  const isBattleStarted = battleStarted !== false;

  const unitById = useMemo(() => {
    const m = new Map<string, Unit>();
    for (const u of units) m.set(u.id, u);
    return m;
  }, [units]);

  const markerById = useMemo(() => {
    const m = new Map<string, Marker>();
    for (const mk of markers) m.set(mk.id, mk);
    return m;
  }, [markers]);

  // turnOrder에 marker 엔트리도 표시되도록 구성한다.
  const displayEntries = useMemo(() => {
    const out: Array<
      | { kind: "unit"; unitId: string; sourceIndex: number }
      | { kind: "marker"; markerId: string; sourceIndex: number }
    > = [];
    if (Array.isArray(turnOrder) && turnOrder.length > 0) {
      for (let i = 0; i < turnOrder.length; i++) {
        const entry = turnOrder[i];
        if (entry?.kind === "unit" && typeof entry.unitId === "string") {
          out.push({ kind: "unit", unitId: entry.unitId, sourceIndex: i });
          continue;
        }
        if (entry?.kind === "marker" && typeof entry.markerId === "string") {
          out.push({
            kind: "marker",
            markerId: entry.markerId,
            sourceIndex: i,
          });
          continue;
        }
        const id = extractUnitId(entry);
        if (id) out.push({ kind: "unit", unitId: id, sourceIndex: i });
      }
    }

    if (out.length === 0) {
      for (let i = 0; i < units.length; i++) {
        out.push({ kind: "unit", unitId: units[i].id, sourceIndex: i });
      }
    }

    // If turnOrder is missing some units (e.g. stale data), append them so the bar can still show neighbors.
    const unitIdsInOrder = new Set(
      out.filter((entry) => entry.kind === "unit").map((entry) => entry.unitId)
    );
    if (unitIdsInOrder.size < units.length) {
      let extraIndex = out.length;
      for (const u of units) {
        if (unitIdsInOrder.has(u.id)) continue;
        out.push({ kind: "unit", unitId: u.id, sourceIndex: extraIndex++ });
      }
    }

    return out;
  }, [turnOrder, units]);

  const n = displayEntries.length;

  const baseIdFromTurnIndex = useMemo(() => {
    if (!Array.isArray(turnOrder) || turnOrder.length === 0) return null;
    const idx =
      typeof turnOrderIndex === "number" && Number.isFinite(turnOrderIndex)
        ? mod(turnOrderIndex, turnOrder.length)
        : 0;

    for (let k = 0; k < turnOrder.length; k++) {
      const e = turnOrder[mod(idx + k, turnOrder.length)];
      const id = extractUnitId(e);
      if (!id) continue;
      if (unitById.get(id)?.turnDisabled) continue;
      return id;
    }
    return null;
  }, [turnOrder, turnOrderIndex, unitById]);

  const tempStack = useMemo(() => {
    const arr = Array.isArray(tempTurnStack) ? tempTurnStack : [];
    return arr.filter(
      (x): x is string => typeof x === "string" && x.length > 0
    );
  }, [tempTurnStack]);

  const isTempTurn = isBattleStarted && tempStack.length > 0;
  const tempTurnUnitId = isTempTurn ? tempStack[tempStack.length - 1] : null;

  // NEXT_TURN을 누르면(임시턴 중엔 pop) “다음으로 보일 턴”
  const resumeUnitId = isTempTurn
    ? tempStack.length >= 2
      ? tempStack[tempStack.length - 2]
      : baseIdFromTurnIndex
    : null;

  const resolvedCurrentId = useMemo(() => {
    if (!isBattleStarted) return null;
    if (currentUnitId) return currentUnitId;

    if (!Array.isArray(turnOrder) || turnOrder.length === 0) return null;
    const idx =
      typeof turnOrderIndex === "number" && Number.isFinite(turnOrderIndex)
        ? mod(turnOrderIndex, turnOrder.length)
        : 0;

    // idx에서부터 앞으로 훑어서 첫 유닛 엔트리를 current로 삼음(라벨 섞인 케이스 대비)
    for (let k = 0; k < turnOrder.length; k++) {
      const e = turnOrder[mod(idx + k, turnOrder.length)];
      const id = extractUnitId(e);
      if (!id) continue;
      if (unitById.get(id)?.turnDisabled) continue;
      return id;
    }
    return null;
  }, [currentUnitId, turnOrder, turnOrderIndex, isBattleStarted, unitById]);

  const displayIndexFromTurnIndex = useMemo(() => {
    if (!Array.isArray(turnOrder) || turnOrder.length === 0) return null;
    if (displayEntries.length === 0) return null;

    const idx =
      typeof turnOrderIndex === "number" && Number.isFinite(turnOrderIndex)
        ? mod(turnOrderIndex, turnOrder.length)
        : 0;

    const direct = displayEntries.findIndex((e) => e.sourceIndex === idx);
    return direct >= 0 ? direct : null;
  }, [turnOrder, turnOrderIndex, displayEntries]);

  const currentIndex = useMemo(() => {
    if (n === 0) return 0;
    if (displayIndexFromTurnIndex != null) return displayIndexFromTurnIndex;
    if (!resolvedCurrentId) return 0;
    const idx = displayEntries.findIndex(
      (entry) => entry.kind === "unit" && entry.unitId === resolvedCurrentId
    );
    return idx >= 0 ? idx : 0;
  }, [displayEntries, displayIndexFromTurnIndex, resolvedCurrentId, n]);

  const MAX_VISIBLE = 11; // 중앙 고정 때문에 홀수 권장 (12개 “정도”면 11이 가장 자연스러움)

  const visibleCount = useMemo(() => {
    if (n <= 0) return 0;
    return Math.min(n, MAX_VISIBLE);
  }, [n]);

  // Keep current near center, but allow even counts so small parties show all units.
  const leftCount = Math.floor((visibleCount - 1) / 2);
  const rightCount = Math.max(0, visibleCount - 1 - leftCount);

  // ---- 애니메이션용 상태 ----
  const SLOT_W = 132; // 슬롯 폭(=한 칸 이동 폭)
  const CARD_W = 116; // 유닛 pill(텍스트 박스) 폭
  const [renderIndex, setRenderIndex] = useState(currentIndex);
  const [animating, setAnimating] = useState(false);
  const [animDir, setAnimDir] = useState<"forward" | "backward" | null>(null);
  const [shiftPx, setShiftPx] = useState(0);
  const pendingIndexRef = useRef<number | null>(null);
  const animatingRef = useRef(false);

  // ---- 라운드 표시(프론트에서만 추적) ----
  const roundValue = Number.isFinite(roundProp as number)
    ? Math.trunc(roundProp as number)
    : 1;
  const [roundFlash, setRoundFlash] = useState(false);
  const prevIdxRef = useRef<number | null>(null);

  useEffect(() => {
    if (n <= 0) return;
    const prev = prevIdxRef.current;
    if (prev != null && prev === n - 1 && currentIndex === 0) {
      setRoundFlash(true);
      window.setTimeout(() => setRoundFlash(false), 900);
    }
    prevIdxRef.current = currentIndex;
  }, [currentIndex, n]);

  useEffect(() => {
    animatingRef.current = animating;
  }, [animating]);

  useEffect(() => {
    if (!animating) return;
    const t = window.setTimeout(() => {
      if (!animatingRef.current) return;
      const next = pendingIndexRef.current;
      pendingIndexRef.current = null;
      setAnimating(false);
      setAnimDir(null);
      if (typeof next === "number") setRenderIndex(next);
      setShiftPx(0);
    }, 360);
    return () => window.clearTimeout(t);
  }, [animating]);

  // currentIndex가 바뀔 때 “한 칸 굴러가는” 애니메이션
  useEffect(() => {
    if (n <= 1) {
      setRenderIndex(currentIndex);
      return;
    }
    if (animating) return; // 연타 시엔 일단 자연스럽게 “다음 업데이트”로 넘어가게(간단 버전)
    if (currentIndex === renderIndex) return;

    const forward = mod(renderIndex + 1, n) === currentIndex;
    const backward = mod(renderIndex - 1, n) === currentIndex;

    if (!forward && !backward) {
      // 한 칸 이동이 아니면(예: 유닛 삭제/선택점프) 그냥 점프
      setRenderIndex(currentIndex);
      setShiftPx(0);
      setAnimDir(null);
      setAnimating(false);
      return;
    }

    pendingIndexRef.current = currentIndex;
    const dir: "forward" | "backward" = forward ? "forward" : "backward";
    setAnimDir(dir);
    setAnimating(true);

    if (dir === "forward") {
      // 0 -> -SLOT_W
      setShiftPx(0);
      requestAnimationFrame(() => setShiftPx(-SLOT_W));
    } else {
      // -SLOT_W -> 0
      setShiftPx(-SLOT_W);
      requestAnimationFrame(() => setShiftPx(0));
    }
  }, [currentIndex, n, renderIndex, animating]);

  function finishAnimation() {
    if (!animating) return;
    const next = pendingIndexRef.current;
    pendingIndexRef.current = null;

    // 트랜지션 끄고(=animating false) 위치 리셋
    setAnimating(false);
    setAnimDir(null);

    if (typeof next === "number") setRenderIndex(next);

    // forward는 끝이 -SLOT_W라서 0으로 점프 리셋이 필요
    setShiftPx(0);
  }

  // 현재 화면에 렌더할 인덱스 목록 만들기
  const displayIndices = useMemo(() => {
    if (n <= 0 || visibleCount <= 0) return [];

    const extraLeft = animating && animDir === "backward" ? 1 : 0;
    const extraRight = animating && animDir === "forward" ? 1 : 0;

    const startOff = -leftCount - extraLeft;
    const endOff = rightCount + extraRight;

    const idxs: number[] = [];
    for (let off = startOff; off <= endOff; off++) {
      idxs.push(mod(renderIndex + off, n));
    }
    return idxs;
  }, [n, visibleCount, leftCount, rightCount, animating, animDir, renderIndex]);

  const focusPos = useMemo(() => {
    // 애니메이션 중에도 “실제 currentIndex”를 강조해서, 중앙으로 들어오는 느낌을 줌
    const p = displayIndices.indexOf(currentIndex);
    return p >= 0 ? p : leftCount;
  }, [displayIndices, currentIndex, leftCount]);

  const currentUnit = resolvedCurrentId
    ? unitById.get(resolvedCurrentId)
    : null;
  const currentHeaderColor = currentUnit
    ? unitTextColor(currentUnit)
    : undefined;

  const tempUnit = tempTurnUnitId ? unitById.get(tempTurnUnitId) : null;
  const resumeUnit = resumeUnitId ? unitById.get(resumeUnitId) : null;

  const tempColor = tempUnit ? unitTextColor(tempUnit) : undefined;
  const resumeColor = resumeUnit ? unitTextColor(resumeUnit) : undefined;

  if (n <= 0) return null;

  return (
    <section
      className={[
        "rounded-2xl border border-zinc-800 bg-zinc-900/40 p-2",
        className ?? "",
      ].join(" ")}
    >
      <div className="mb-1 grid grid-cols-3 items-center gap-2">
        {/* left */}
        <div className="text-xs font-semibold text-zinc-200">Turn Order</div>

        {/* center: (임시턴 안내 1줄 + 버튼들) */}
        <div className="flex flex-col items-center justify-center gap-1">
          {/* 임시턴 안내: on/off에도 높이 유지 */}
          <div className="h-4 flex items-center justify-center gap-2 text-[11px] text-zinc-500">
            {isTempTurn ? (
              <>
                <span className="text-sky-300 font-semibold">임시 턴</span>
                <span
                  className="font-semibold"
                  style={tempColor ? { color: tempColor } : undefined}
                  title={tempUnit?.name ?? ""}
                >
                  {turnLabel(tempUnit)}
                </span>

                <span className="text-zinc-700">→</span>

                <span className="text-zinc-400">다음 턴(재개)</span>
                <span
                  className="font-semibold"
                  style={resumeColor ? { color: resumeColor } : undefined}
                  title={resumeUnit?.name ?? ""}
                >
                  {turnLabel(resumeUnit)}
                </span>
              </>
            ) : null}
          </div>

          {/* 버튼들: 살짝 더 떨어지게 */}
          <div className="flex items-center justify-center gap-3">
            {onReorder ? (
              <button
                type="button"
                disabled={busy}
                onClick={onReorder}
                className={[
                  "rounded-lg border px-2 py-1 text-[11px] font-semibold",
                  "border-amber-500/50 bg-amber-950/25 text-amber-200",
                  "hover:bg-amber-900/35 hover:text-amber-100",
                  "disabled:opacity-50",
                ].join(" ")}
                title="Reorder Turn"
              >
                순서 조정
              </button>
            ) : null}
            {!isBattleStarted && onBattleStart ? (
              <button
                type="button"
                disabled={busy}
                onClick={onBattleStart}
                className={[
                  "rounded-lg border px-2 py-1 text-[11px] font-semibold",
                  "border-rose-500/50 bg-rose-950/30 text-rose-200",
                  "hover:bg-rose-900/35 hover:text-rose-100",
                  "disabled:opacity-50",
                ].join(" ")}
                title="Start Battle"
              >
                전투 개시
              </button>
            ) : null}
            {onNextTurn ? (
              <button
                type="button"
                disabled={busy || !isBattleStarted}
                onClick={onNextTurn}
                className={[
                  "rounded-lg border px-2 py-1 text-[11px] font-semibold",
                  "border-emerald-500/50 bg-emerald-950/35 text-emerald-200",
                  "hover:bg-emerald-900/40 hover:text-emerald-100",
                  "disabled:opacity-50",
                ].join(" ")}
                title="Next Turn"
              >
                다음 턴
              </button>
            ) : null}

            <button
              type="button"
              disabled={busy || !isBattleStarted || !canTempTurn}
              onClick={onTempTurn}
              title={
                !isBattleStarted
                  ? "전투 개시 후 사용할 수 있어"
                  : !canTempTurn
                    ? "임시 턴을 줄 유닛을 먼저 선택해줘"
                    : "선택된 유닛에게 임시 턴 부여"
              }
              className={[
                "rounded-lg border px-2 py-1 text-[11px] font-semibold",
                "border-sky-500/50 bg-sky-950/25 text-sky-200",
                "hover:bg-sky-900/35 hover:text-sky-100",
                "disabled:opacity-50",
              ].join(" ")}
            >
              임시 턴
            </button>
          </div>
        </div>

        {/* right: round/current (색 복구는 여기 style로 이미 들어가 있어야 함) :contentReference[oaicite:2]{index=2} */}
        <div className="flex justify-end">
          <div className="flex items-center gap-2 text-[11px] text-zinc-500">
            <span>
              round:{" "}
              <span
                className={
                  roundFlash ? "text-zinc-100 animate-pulse" : "text-zinc-300"
                }
              >
                {roundValue}
              </span>
            </span>
            <span>
              current:{" "}
              <span
                className={[
                  "font-semibold",
                  currentHeaderColor && isBattleStarted
                    ? ""
                    : "text-zinc-400",
                ].join(" ")}
                style={
                  currentHeaderColor && isBattleStarted
                    ? { color: currentHeaderColor }
                    : undefined
                }
                title={currentUnit?.name ?? ""}
              >
                {isBattleStarted ? turnLabel(currentUnit) : "-"}
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* 휠 영역 */}
      <div className="relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/20 px-2 py-2">
        {/* 양끝 페이드(휠 느낌) */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-zinc-950/70 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-zinc-950/70 to-transparent" />

        <div className="flex justify-center">
          <div
            className={[
              "flex items-center justify-center",
              animating ? "transition-transform duration-300 ease-out" : "",
            ].join(" ")}
            style={{ transform: `translateX(${shiftPx}px)` }}
            onTransitionEnd={finishAnimation}
          >
            {displayIndices.map((idx, i) => {
              const entry = displayEntries[idx];
              const isUnit = entry?.kind === "unit";
              const isMarker = entry?.kind === "marker";
              const u = isUnit ? unitById.get(entry.unitId) : null;
              const m =
                !isUnit && entry?.kind === "marker"
                  ? markerById.get(entry.markerId)
                  : null;
              const isDisabled = isUnit && !!u?.turnDisabled;
              const isCurrent = isBattleStarted && isUnit && idx === currentIndex;
              const currentColor =
                isCurrent && u ? unitTextColor(u) : undefined;
              const markerAlias = (m?.alias ?? "").trim();
              const markerTitle = m
                ? markerAlias
                  ? `${m.name} (${markerAlias})`
                  : m.name
                : entry?.kind === "marker"
                  ? entry.markerId
                  : "";
              const label = isUnit ? turnLabel(u) : markerLabel(m);

              const dist = Math.abs(i - focusPos);
              const fade =
                dist === 0
                  ? "opacity-100"
                  : dist === 1
                    ? "opacity-85"
                    : dist === 2
                      ? "opacity-65"
                      : "opacity-45";

              // 랩(끝→처음) 경계면인지 체크: idx 다음이 0이고 idx가 마지막이면
              const nextIdx =
                i < displayIndices.length - 1 ? displayIndices[i + 1] : null;
              const isWrapSeparator = nextIdx === 0 && idx === n - 1;

              // 실제 라운드 증가 직후(마지막→0)라면 wrap separator를 더 티나게
              const wrapFlash =
                roundFlash && currentIndex === 0 && isWrapSeparator;

              return (
                <div
                  key={`${idx}-${i}`}
                  className={[
                    "relative shrink-0 flex items-center justify-center",
                    fade,
                  ].join(" ")}
                  style={{ width: SLOT_W }}
                >
                  <div
                    className={[
                      "rounded-lg border text-center",
                      isMarker || isDisabled
                        ? "border-amber-800/50 bg-amber-950/20"
                        : "bg-zinc-950/30 border-zinc-800",
                      "px-2 py-1",
                      "truncate",
                      isCurrent
                        ? "border-emerald-400/70 bg-emerald-950/30 shadow-[0_0_0_1px_rgba(16,185,129,0.25)]"
                        : "",
                    ].join(" ")}
                    style={{ width: CARD_W }}
                  >
                    <div
                      className={
                        isCurrent
                          ? "text-[13px] font-semibold leading-tight"
                          : "text-[11px] leading-tight"
                      }
                    >
                      <span
                        title={isUnit ? u?.name ?? "" : markerTitle}
                        className={[
                          "block truncate",
                          isMarker || isDisabled
                            ? "text-amber-200"
                            : isCurrent
                              ? "text-zinc-100"
                              : "text-zinc-400",
                        ].join(" ")}
                        // ✅ 현재 턴만 colorCode(또는 side 기본색)로
                        style={
                          currentColor ? { color: currentColor } : undefined
                        }
                      >
                        {label}
                      </span>
                    </div>
                  </div>

                  {/* separator: "-" + wrap이면 이모지 추가 */}
                  {i < displayIndices.length - 1 && (
                    <div
                      className={[
                        "absolute -right-1 flex items-center gap-1 text-[11px] text-zinc-600",
                        wrapFlash ? "text-zinc-100 animate-pulse" : "",
                      ].join(" ")}
                    >
                      <span>-</span>
                      {isWrapSeparator ? (
                        <span title="next round">🔁</span>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

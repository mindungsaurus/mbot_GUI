// src/TurnOrderBar.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import type { Marker, TurnEntry, TurnGroup, Unit } from "./types";
import { unitTextColor } from "./UnitColor";

// turnOrder??label 媛숈? 寃??욎뿬 ?덉뼱??unitId留?理쒕???戮묒븘?닿린
function extractUnitId(entry: any): string | null {
  if (!entry) return null;
  if (typeof entry === "string") return entry;
  if (typeof entry === "object") {
    if (entry.kind === "group") return null;
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
  // ??TurnOrderBar?먯꽌??alias留??쒖떆 (?놁쑝硫?name)
  return alias || u.name || "unknown";
}

function markerLabel(m: Marker | undefined | null) {
  if (!m) return "marker";
  const alias = (m.alias ?? "").toString().trim();
  return alias || m.name || m.id;
}

function groupLabel(g: TurnGroup | undefined | null) {
  if (!g) return "group";
  const name = (g.name ?? "").toString().trim();
  return name || g.id;
}

function parseTempTurnToken(
  token: string | null | undefined,
  unitById: Map<string, Unit>,
  groupById: Map<string, TurnGroup>
): { kind: "unit"; unitId: string } | { kind: "group"; groupId: string } | null {
  const raw = (token ?? "").toString().trim();
  if (!raw) return null;
  if (raw.startsWith("unit:")) {
    const unitId = raw.slice(5).trim();
    if (unitId) return { kind: "unit", unitId };
    return null;
  }
  if (raw.startsWith("group:")) {
    const groupId = raw.slice(6).trim();
    if (groupId) return { kind: "group", groupId };
    return null;
  }
  if (unitById.has(raw)) return { kind: "unit", unitId: raw };
  if (groupById.has(raw)) return { kind: "group", groupId: raw };
  return null;
}

function sidePillTint(side: Unit["side"] | undefined): string {
  if (side === "TEAM") return "bg-blue-950/25 border-blue-500/30";
  if (side === "ENEMY") return "bg-red-950/25 border-red-500/30";
  return "bg-zinc-900/40 border-zinc-700/50";
}

function isTurnEligible(u: Unit | undefined | null) {
  if (!u) return false;
  if (u.bench) return false;
  if ((u.unitType ?? "NORMAL") !== "NORMAL") return false;
  return true;
}

function isGroupEligible(
  group: TurnGroup | undefined | null,
  unitById: Map<string, Unit>
) {
  if (!group) return false;
  for (const id of group.unitIds ?? []) {
    const u = unitById.get(id);
    if (!u) continue;
    if (!isTurnEligible(u)) continue;
    if (u.turnDisabled) continue;
    return true;
  }
  return false;
}

export default function TurnOrderBar(props: {
  units: Unit[];
  markers: Marker[];
  turnOrder: TurnEntry[]; // backend?먯꽌 ?ㅻ뒗 turnOrder (label ?욎뿬??OK)
  turnGroups?: TurnGroup[];
  // ??以??섎굹留??덉뼱???숈옉. ????二쇰㈃ currentUnitId ?곗꽑.
  turnOrderIndex?: number | null; // turnOrder 諛곗뿴 湲곗? ?꾩옱 ?꾩튂
  currentUnitId?: string | null; // ?꾩옱 ???좊떅 id
  className?: string;
  round?: number | null; // backend state.round
  battleStarted?: boolean;
  busy?: boolean;
  onReorder?: () => void;
  onRoundReset?: () => void;
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
    turnGroups,
    turnOrderIndex,
    currentUnitId,
    className,
    round: roundProp,
    battleStarted,
    busy,
    onReorder,
    onRoundReset,
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

  const groupById = useMemo(() => {
    const m = new Map<string, TurnGroup>();
    for (const g of turnGroups ?? []) m.set(g.id, g);
    return m;
  }, [turnGroups]);

  const groupedUnitIds = useMemo(() => {
    const ids = new Set<string>();
    for (const g of turnGroups ?? []) {
      for (const unitId of g.unitIds ?? []) ids.add(unitId);
    }
    return ids;
  }, [turnGroups]);

  // turnOrder??marker ?뷀듃由щ룄 ?쒖떆?섎룄濡?援ъ꽦?쒕떎.
  const displayEntries = useMemo(() => {
    const out: Array<
      | { kind: "unit"; unitId: string; sourceIndex: number }
      | { kind: "marker"; markerId: string; sourceIndex: number }
      | { kind: "group"; groupId: string; sourceIndex: number }
    > = [];
    if (Array.isArray(turnOrder) && turnOrder.length > 0) {
      for (let i = 0; i < turnOrder.length; i++) {
        const entry = turnOrder[i];
        if (entry?.kind === "group" && typeof entry.groupId === "string") {
          const g = groupById.get(entry.groupId);
          if (isGroupEligible(g, unitById)) {
            out.push({ kind: "group", groupId: entry.groupId, sourceIndex: i });
          }
          continue;
        }
        if (entry?.kind === "unit" && typeof entry.unitId === "string") {
          const u = unitById.get(entry.unitId);
          if (isTurnEligible(u) && !groupedUnitIds.has(entry.unitId)) {
            out.push({ kind: "unit", unitId: entry.unitId, sourceIndex: i });
          }
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
        if (id) {
          const u = unitById.get(id);
          if (isTurnEligible(u) && !groupedUnitIds.has(id)) {
            out.push({ kind: "unit", unitId: id, sourceIndex: i });
          }
        }
      }
    }

    if (out.length === 0) {
      let idx = 0;
      for (let i = 0; i < units.length; i++) {
        const u = units[i];
        if (!isTurnEligible(u)) continue;
        out.push({ kind: "unit", unitId: u.id, sourceIndex: idx++ });
      }
    }

    // If turnOrder is missing some units (e.g. stale data), append them so the bar can still show neighbors.
    const unitIdsInOrder = new Set(
      out.filter((entry) => entry.kind === "unit").map((entry) => entry.unitId)
    );
    const eligibleUnits = units.filter(
      (u) => isTurnEligible(u) && !groupedUnitIds.has(u.id)
    );
    if (unitIdsInOrder.size < eligibleUnits.length) {
      let extraIndex = out.length;
      for (const u of eligibleUnits) {
        if (unitIdsInOrder.has(u.id)) continue;
        out.push({ kind: "unit", unitId: u.id, sourceIndex: extraIndex++ });
      }
    }

    return out;
  }, [turnOrder, units, unitById, groupById, groupedUnitIds]);

  const n = displayEntries.length;

  const baseEntryFromTurnIndex = useMemo(() => {
    if (!Array.isArray(turnOrder) || turnOrder.length === 0) return null;
    const idx =
      typeof turnOrderIndex === "number" && Number.isFinite(turnOrderIndex)
        ? mod(turnOrderIndex, turnOrder.length)
        : 0;

    for (let k = 0; k < turnOrder.length; k++) {
      const entry = turnOrder[mod(idx + k, turnOrder.length)];
      if (!entry || typeof entry !== "object") continue;
      if (entry.kind === "unit") {
        const u = unitById.get(entry.unitId);
        if (!isTurnEligible(u)) continue;
        if (u?.turnDisabled) continue;
        return entry;
      }
      if (entry.kind === "group") {
        const g = groupById.get(entry.groupId);
        if (!isGroupEligible(g, unitById)) continue;
        return entry;
      }
    }
    return null;
  }, [turnOrder, turnOrderIndex, unitById, groupById]);

  const tempStack = useMemo(() => {
    const arr = Array.isArray(tempTurnStack) ? tempTurnStack : [];
    return arr.filter(
      (x): x is string => typeof x === "string" && x.length > 0
    );
  }, [tempTurnStack]);

  const isTempTurn = isBattleStarted && tempStack.length > 0;
  const tempTurnToken = isTempTurn ? tempStack[tempStack.length - 1] : null;

  // NEXT_TURN???꾨Ⅴ硫??꾩떆??以묒뿏 pop) ?쒕떎?뚯쑝濡?蹂댁씪 ?닳?
  const tempTurnEntry = useMemo(
    () => parseTempTurnToken(tempTurnToken, unitById, groupById),
    [tempTurnToken, unitById, groupById]
  );

  const resumeEntry = useMemo(() => {
    if (!isTempTurn) return null;
    if (tempStack.length >= 2) {
      return parseTempTurnToken(tempStack[tempStack.length - 2], unitById, groupById);
    }
    if (baseEntryFromTurnIndex?.kind === "unit") {
      return { kind: "unit", unitId: baseEntryFromTurnIndex.unitId } as const;
    }
    if (baseEntryFromTurnIndex?.kind === "group") {
      return { kind: "group", groupId: baseEntryFromTurnIndex.groupId } as const;
    }
    return null;
  }, [isTempTurn, tempStack, baseEntryFromTurnIndex, unitById, groupById]);

  const resolvedCurrentEntry = useMemo(() => {
    if (!isBattleStarted) return null;
    if (currentUnitId) return { kind: "unit", unitId: currentUnitId } as const;
    return baseEntryFromTurnIndex;
  }, [currentUnitId, isBattleStarted, baseEntryFromTurnIndex]);

  const resolvedCurrentKey = useMemo(() => {
    if (!resolvedCurrentEntry) return null;
    if (resolvedCurrentEntry.kind === "unit") {
      return `unit:${resolvedCurrentEntry.unitId}`;
    }
    if (resolvedCurrentEntry.kind === "group") {
      return `group:${resolvedCurrentEntry.groupId}`;
    }
    return null;
  }, [resolvedCurrentEntry]);

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
    if (!resolvedCurrentKey) return 0;
    const idx = displayEntries.findIndex((entry) => {
      if (entry.kind === "unit") {
        return resolvedCurrentKey === `unit:${entry.unitId}`;
      }
      if (entry.kind === "group") {
        return resolvedCurrentKey === `group:${entry.groupId}`;
      }
      return false;
    });
    return idx >= 0 ? idx : 0;
  }, [displayEntries, displayIndexFromTurnIndex, resolvedCurrentKey, n]);

  const MAX_VISIBLE = 11; // 以묒븰 怨좎젙 ?뚮Ц?????沅뚯옣 (12媛??쒖젙?꾟앸㈃ 11??媛???먯뿰?ㅻ윭?)

  const visibleCount = useMemo(() => {
    if (n <= 0) return 0;
    return Math.min(n, MAX_VISIBLE);
  }, [n]);

  // Keep current near center, but allow even counts so small parties show all units.
  const leftCount = Math.floor((visibleCount - 1) / 2);
  const rightCount = Math.max(0, visibleCount - 1 - leftCount);

  // ---- ?좊땲硫붿씠?섏슜 ?곹깭 ----
  const SLOT_W = 132; // ?щ’ ??=??移??대룞 ??
  const CARD_W = 116; // ?좊떅 pill(?띿뒪??諛뺤뒪) ??
  const [renderIndex, setRenderIndex] = useState(currentIndex);
  const [animating, setAnimating] = useState(false);
  const [animDir, setAnimDir] = useState<"forward" | "backward" | null>(null);
  const [shiftPx, setShiftPx] = useState(0);
  const pendingIndexRef = useRef<number | null>(null);
  const animatingRef = useRef(false);

  // ---- ?쇱슫???쒖떆(?꾨줎?몄뿉?쒕쭔 異붿쟻) ----
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

  // currentIndex媛 諛붾????쒗븳 移?援대윭媛?붴??좊땲硫붿씠??
  useEffect(() => {
    if (n <= 1) {
      setRenderIndex(currentIndex);
      return;
    }
    if (animating) return; // ?고? ?쒖뿏 ?쇰떒 ?먯뿰?ㅻ읇寃??쒕떎???낅뜲?댄듃?앸줈 ?섏뼱媛寃?媛꾨떒 踰꾩쟾)
    if (currentIndex === renderIndex) return;

    const forward = mod(renderIndex + 1, n) === currentIndex;
    const backward = mod(renderIndex - 1, n) === currentIndex;

    if (!forward && !backward) {
      // ??移??대룞???꾨땲硫??? ?좊떅 ??젣/?좏깮?먰봽) 洹몃깷 ?먰봽
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

    // ?몃옖吏???꾧퀬(=animating false) ?꾩튂 由ъ뀑
    setAnimating(false);
    setAnimDir(null);

    if (typeof next === "number") setRenderIndex(next);

    // forward???앹씠 -SLOT_W?쇱꽌 0?쇰줈 ?먰봽 由ъ뀑???꾩슂
    setShiftPx(0);
  }

  // ?꾩옱 ?붾㈃???뚮뜑???몃뜳??紐⑸줉 留뚮뱾湲?
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
    // ?좊땲硫붿씠??以묒뿉???쒖떎??currentIndex?앸? 媛뺤“?댁꽌, 以묒븰?쇰줈 ?ㅼ뼱?ㅻ뒗 ?먮굦??以?
    const p = displayIndices.indexOf(currentIndex);
    return p >= 0 ? p : leftCount;
  }, [displayIndices, currentIndex, leftCount]);

  const currentUnit =
    resolvedCurrentEntry?.kind === "unit"
      ? unitById.get(resolvedCurrentEntry.unitId)
      : null;
  const currentGroup =
    resolvedCurrentEntry?.kind === "group"
      ? groupById.get(resolvedCurrentEntry.groupId)
      : null;
  const currentGroupLeadId = currentGroup?.unitIds?.[0];
  const currentGroupLead = currentGroupLeadId
    ? unitById.get(currentGroupLeadId)
    : null;
  const currentHeaderColor = currentUnit
    ? unitTextColor(currentUnit)
    : currentGroupLead
      ? unitTextColor(currentGroupLead)
      : undefined;

  const tempUnit =
    tempTurnEntry?.kind === "unit" ? unitById.get(tempTurnEntry.unitId) : null;
  const tempGroup =
    tempTurnEntry?.kind === "group" ? groupById.get(tempTurnEntry.groupId) : null;
  const tempGroupLeadId = tempGroup?.unitIds?.[0];
  const tempGroupLead = tempGroupLeadId ? unitById.get(tempGroupLeadId) : null;
  const tempColor = tempUnit
    ? unitTextColor(tempUnit)
    : tempGroupLead
      ? unitTextColor(tempGroupLead)
      : undefined;
  const tempTitle =
    tempTurnEntry?.kind === "unit"
      ? tempUnit?.name ?? ""
      : tempTurnEntry?.kind === "group"
        ? tempGroup?.name ?? ""
        : "";
  const tempLabel =
    tempTurnEntry?.kind === "unit"
      ? turnLabel(tempUnit)
      : tempTurnEntry?.kind === "group"
        ? groupLabel(tempGroup)
        : "-";

  const resumeUnit =
    resumeEntry?.kind === "unit" ? unitById.get(resumeEntry.unitId) : null;
  const resumeGroup =
    resumeEntry?.kind === "group" ? groupById.get(resumeEntry.groupId) : null;
  const resumeGroupLeadId = resumeGroup?.unitIds?.[0];
  const resumeGroupLead = resumeGroupLeadId ? unitById.get(resumeGroupLeadId) : null;
  const resumeColor = resumeUnit
    ? unitTextColor(resumeUnit)
    : resumeGroupLead
      ? unitTextColor(resumeGroupLead)
      : undefined;
  const resumeTitle =
    resumeEntry?.kind === "unit"
      ? resumeUnit?.name ?? ""
      : resumeEntry?.kind === "group"
        ? resumeGroup?.name ?? ""
        : "";
  const resumeLabel =
    resumeEntry?.kind === "unit"
      ? turnLabel(resumeUnit)
      : resumeEntry?.kind === "group"
        ? groupLabel(resumeGroup)
        : "-";

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
          {isTempTurn ? (
            <div className="flex items-center justify-center gap-2 text-[11px] text-zinc-500">
              <span className="text-sky-300 font-semibold">임시 턴</span>
                <span
                  className="font-semibold"
                  style={tempColor ? { color: tempColor } : undefined}
                  title={tempTitle}
                >
                  {tempLabel}
                </span>

              <span className="text-zinc-700">→</span>

              <span className="text-zinc-400">(다음 턴 재개)</span>
                <span
                  className="font-semibold"
                  style={resumeColor ? { color: resumeColor } : undefined}
                  title={resumeTitle}
                >
                  {resumeLabel}
                </span>
            </div>
          ) : null}

          {/* 버튼들 간격 */}
          <div className="flex items-center justify-center gap-3">
            {isBattleStarted && onRoundReset ? (
              <button
                type="button"
                disabled={busy}
                onClick={onRoundReset}
                style={{ order: 1 }}
                className={[
                  "whitespace-nowrap rounded-lg border px-2 py-1 text-[10px] font-semibold",
                  "border-fuchsia-500/60 bg-fuchsia-950/35 text-fuchsia-200",
                  "hover:bg-fuchsia-900/45 hover:text-fuchsia-100",
                  "disabled:opacity-50",
                ].join(" ")}
                title="Reset Round"
              >
                라운드 초기화
              </button>
            ) : null}
            {!isBattleStarted && onBattleStart ? (
              <button
                type="button"
                disabled={busy}
                onClick={onBattleStart}
                style={{ order: 1 }}
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
            {onReorder ? (
              <button
                type="button"
                disabled={busy}
                onClick={onReorder}
                style={{ order: 2 }}
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
            {onNextTurn ? (
              <button
                type="button"
                disabled={busy || !isBattleStarted}
                onClick={onNextTurn}
                style={{ order: 3 }}
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
              style={{ order: 4 }}
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
        {/* right: round/current (??蹂듦뎄???ш린 style濡??대? ?ㅼ뼱媛 ?덉뼱???? :contentReference[oaicite:2]{index=2} */}
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
                title={
                  currentUnit?.name ??
                  currentGroup?.name ??
                  ""
                }
              >
                {isBattleStarted
                  ? currentUnit
                    ? turnLabel(currentUnit)
                    : currentGroup
                      ? groupLabel(currentGroup)
                      : "-"
                  : "-"}
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* ???곸뿭 */}
      <div className="relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/20 px-2 py-2">
        {/* ?묐걹 ?섏씠?????먮굦) */}
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
              const isGroup = entry?.kind === "group";
              const u = isUnit ? unitById.get(entry.unitId) : null;
              const g = isGroup ? groupById.get(entry.groupId) : null;
              const m =
                !isUnit && entry?.kind === "marker"
                  ? markerById.get(entry.markerId)
                  : null;
              const isDisabled = isUnit && !!u?.turnDisabled;
              const isCurrent = isBattleStarted && idx === currentIndex;
              const groupLeadId = isGroup ? g?.unitIds?.[0] : null;
              const groupLead = groupLeadId ? unitById.get(groupLeadId) : null;
              const groupColor = groupLead ? unitTextColor(groupLead) : undefined;
              const currentSide = isUnit
                ? u?.side
                : isGroup
                  ? groupLead?.side
                  : undefined;
              const currentColor = isCurrent
                ? isUnit
                  ? u
                    ? unitTextColor(u)
                    : undefined
                  : isGroup
                    ? groupColor
                    : undefined
                : undefined;
              const labelColor = isCurrent ? currentColor : undefined;
              const pillTint = isUnit
                ? sidePillTint(u?.side)
                : isGroup
                  ? sidePillTint(groupLead?.side)
                  : "";
              const currentAccent = isCurrent
                ? currentSide === "TEAM"
                  ? "border-lime-400/80 bg-lime-950/20 shadow-[0_0_0_2px_rgba(163,230,53,0.35)]"
                  : "border-lime-300/80 bg-lime-950/15 ring-1 ring-lime-300/45 shadow-[0_0_0_2px_rgba(163,230,53,0.25)]"
                : "";
              const markerAlias = (m?.alias ?? "").trim();
              const markerTitle = m
                ? markerAlias
                  ? `${m.name} (${markerAlias})`
                  : m.name
                : entry?.kind === "marker"
                  ? entry.markerId
                  : "";
              const label = isUnit
                ? turnLabel(u)
                : isGroup
                  ? groupLabel(g)
                  : markerLabel(m);

              const dist = Math.abs(i - focusPos);
              const fade =
                dist === 0
                  ? "opacity-100"
                  : dist === 1
                    ? "opacity-85"
                    : dist === 2
                      ? "opacity-65"
                      : "opacity-45";

              // ???앪넂泥섏쓬) 寃쎄퀎硫댁씤吏 泥댄겕: idx ?ㅼ쓬??0?닿퀬 idx媛 留덉?留됱씠硫?
              const nextIdx =
                i < displayIndices.length - 1 ? displayIndices[i + 1] : null;
              const isWrapSeparator = nextIdx === 0 && idx === n - 1;

              // ?ㅼ젣 ?쇱슫??利앷? 吏곹썑(留덉?留됤넂0)?쇰㈃ wrap separator瑜????곕굹寃?
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
                        : pillTint || "bg-zinc-950/30 border-zinc-800",
                      "px-2 py-1",
                      "truncate",
                      currentAccent,
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
                        title={
                          isUnit
                            ? u?.name ?? ""
                            : isGroup
                              ? g?.name ?? ""
                              : markerTitle
                        }
                        className={[
                          "block truncate",
                          isMarker || isDisabled
                            ? "text-amber-200"
                            : isCurrent
                              ? "text-zinc-100"
                              : "text-zinc-400",
                        ].join(" ")}
                        // ???꾩옱 ?대쭔 colorCode(?먮뒗 side 湲곕낯??濡?
                        style={labelColor ? { color: labelColor } : undefined}
                      >
                        {label}
                      </span>
                    </div>
                  </div>

                  {/* separator: "-" + wrap?대㈃ ?대え吏 異붽? */}
                  {i < displayIndices.length - 1 && (
                    <div
                      className={[
                        "absolute -right-1 flex items-center gap-1 text-[11px]",
                        isWrapSeparator
                          ? "text-fuchsia-300"
                          : "text-zinc-500",
                        wrapFlash ? "text-zinc-100" : "",
                      ].join(" ")}
                    >
                      {!isWrapSeparator ? <span>-</span> : null}
                      {isWrapSeparator ? (
                        <span
                          title="round boundary"
                          className={[
                            "inline-flex h-5 w-5 items-center justify-center rounded-full",
                            "border border-fuchsia-400/85 bg-fuchsia-900/60",
                            "text-[11px] font-bold text-fuchsia-100",
                            wrapFlash
                              ? "animate-pulse border-fuchsia-200 text-white shadow-[0_0_14px_rgba(232,121,249,0.65)]"
                              : "",
                          ].join(" ")}
                        >
                          ↺
                        </span>
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




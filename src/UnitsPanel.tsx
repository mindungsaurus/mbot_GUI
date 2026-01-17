// src/components/UnitsPanel.tsx
import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import type {
  CreateUnitPayload,
  Marker,
  Side,
  TurnEntry,
  Unit,
} from "./types";
import UnitCard from "./UnitCard";

type CreateUnitForm = Omit<
  CreateUnitPayload,
  "unitId" | "alias" | "colorCode"
> & {
  unitId: string; // input용
  alias: string; // input용
  colorCode: string; // "" = auto(by side), 아니면 "31" 같은 문자열
};

function clampInt(v: unknown, fallback: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
}

function normalizeAnsiColorCode(v: unknown): number | undefined {
  const n = Math.trunc(Number(v));
  if (!Number.isFinite(n)) return undefined;
  const ok = (n >= 30 && n <= 37) || n === 39;
  return ok ? n : undefined;
}

function moveItem<T>(arr: T[], from: number, to: number): T[] {
  if (from === to) return arr;
  const next = arr.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function PlusIcon(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={props.className}
      aria-hidden="true"
    >
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

type MarkerUpsertPayload = {
  markerId: string;
  name: string;
  alias?: string | null;
  x: number;
  z: number;
  duration?: number | null;
};

function MarkerRow(props: {
  marker: Marker;
  orderIndex: number | null;
  busy: boolean;
  onUpsert: (payload: MarkerUpsertPayload) => Promise<void> | void;
  onRemove: (markerId: string) => Promise<void> | void;
}) {
  const { marker, orderIndex, busy, onUpsert, onRemove } = props;
  const [name, setName] = useState(marker.name);
  const [alias, setAlias] = useState(marker.alias ?? "");
  const [duration, setDuration] = useState(
    marker.duration !== undefined ? String(marker.duration) : ""
  );
  const [rowErr, setRowErr] = useState<string | null>(null);

  useEffect(() => {
    setName(marker.name);
    setAlias(marker.alias ?? "");
    setDuration(marker.duration !== undefined ? String(marker.duration) : "");
    setRowErr(null);
  }, [marker.id, marker.name, marker.alias, marker.duration]);

  const orderLabel = orderIndex != null ? String(orderIndex + 1) : "-";
  const cellCount =
    Array.isArray(marker.cells) && marker.cells.length > 0
      ? marker.cells.length
      : 1;
  const durationLabel =
    marker.duration !== undefined ? String(marker.duration) : "영구";
  const aliasLabel = (marker.alias ?? "").trim();
  const displayName = aliasLabel ? `${marker.name} (${aliasLabel})` : marker.name;

  function handleApply() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setRowErr("마커 이름을 입력해줘.");
      return;
    }

    const trimmedAlias = alias.trim();
    const prevAlias = (marker.alias ?? "").trim();
    const aliasChanged = trimmedAlias !== prevAlias;

    const durationRaw = duration.trim();
    let nextDuration: number | null | undefined = undefined;

    if (durationRaw.length > 0) {
      const parsed = Math.trunc(Number(durationRaw));
      if (!Number.isFinite(parsed) || parsed <= 0) {
        setRowErr("지속시간은 1 이상의 숫자여야 해.");
        return;
      }
      nextDuration = parsed;
    } else if (marker.duration !== undefined) {
      // Empty input clears duration (permanent marker).
      nextDuration = null;
    }

    const nameChanged = trimmedName !== marker.name;
    const durationChanged = nextDuration !== undefined;
    if (!nameChanged && !durationChanged && !aliasChanged) {
      setRowErr(null);
      return;
    }

    onUpsert({
      markerId: marker.id,
      name: trimmedName,
      x: marker.pos.x,
      z: marker.pos.z,
      ...(aliasChanged ? { alias: trimmedAlias || null } : {}),
      ...(durationChanged ? { duration: nextDuration } : {}),
    });
    setRowErr(null);
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-amber-100">
            {displayName}
          </div>
          <div className="text-[11px] text-zinc-500">
            id: {marker.id} · 셀 {cellCount} · 턴오더 {orderLabel} · 지속{" "}
            {durationLabel}
          </div>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => onRemove(marker.id)}
          className="rounded-md border border-rose-900/60 bg-rose-950/40 px-2 py-1 text-[11px] text-rose-200 hover:bg-rose-900/40 disabled:opacity-50"
        >
          삭제
        </button>
      </div>

      {rowErr && (
        <div className="mb-2 rounded-md border border-rose-900/60 bg-rose-950/30 px-2 py-1 text-[11px] text-rose-200">
          {rowErr}
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr_140px]">
        <div>
          <label className="mb-1 block text-[11px] text-zinc-400">
            이름
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600"
            disabled={busy}
          />
        </div>

        <div>
          <label className="mb-1 block text-[11px] text-zinc-400">
            별명 (보드 표시)
          </label>
          <input
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600"
            disabled={busy}
          />
        </div>

        <div>
          <label className="mb-1 block text-[11px] text-zinc-400">
            지속시간
          </label>
          <input
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="영구"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600"
            disabled={busy}
          />
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setDuration("")}
          disabled={busy}
          className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-1 text-[11px] text-zinc-200 hover:bg-zinc-800/60 disabled:opacity-50"
        >
          영구로
        </button>
        <button
          type="button"
          onClick={handleApply}
          disabled={busy}
          className="rounded-lg bg-amber-700 px-3 py-1 text-[11px] text-white hover:bg-amber-600 disabled:opacity-50"
        >
          적용
        </button>
      </div>
    </div>
  );
}

export default function UnitsPanel(props: {
  units: Unit[];
  markers: Marker[];
  selectedIds: string[];
  selectedId: string | null; // primary
  selected: Unit | null;
  busy: boolean;

  // turnOrder에 label entry도 있을 수 있으니 length만 넘겨받는 게 안전
  turnOrderLen: number;
  turnOrder: TurnEntry[];

  onSelectUnit: (id: string, opts?: { additive?: boolean }) => void;
  onEditUnit: (unitId: string) => void;
  onCreateUnit: (payload: CreateUnitPayload) => Promise<void> | void;
  onRemoveUnit: (unitId: string) => Promise<void> | void;
  onToggleHidden: (unitId: string) => Promise<void> | void;
  onReorderUnits: (payload: {
    unitIds: string[];
    sideChanges?: { unitId: string; side: Side }[];
    benchChanges?: { unitId: string; bench: "TEAM" | "ENEMY" | null }[];
  }) => Promise<void> | void;
  onToggleMarkerCreate: () => void;
  onUpsertMarker: (payload: MarkerUpsertPayload) => Promise<void> | void;
  onRemoveMarker: (markerId: string) => Promise<void> | void;
}) {
  const {
    units,
    markers,
    selectedIds,
    selectedId,
    selected,
    busy,
    turnOrderLen,
    turnOrder,
  onSelectUnit,
  onEditUnit,
  onCreateUnit,
    onRemoveUnit,
    onUpsertMarker,
  onRemoveMarker,
  onToggleHidden,
  onReorderUnits,
    onToggleMarkerCreate,
  } = props;

  const [createOpen, setCreateOpen] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);

  const [panelMode, setPanelMode] = useState<"units" | "markers">("units");
  const isMarkerMode = panelMode === "markers";
  const [compactMode, setCompactMode] = useState(false);
  const [unitOrder, setUnitOrder] = useState<string[]>([]);
  const [dragUnitId, setDragUnitId] = useState<string | null>(null);
  const [overUnitId, setOverUnitId] = useState<string | null>(null);
  const [reorderPending, setReorderPending] = useState(false);
  const unitListRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isMarkerMode && createOpen) setCreateOpen(false);
  }, [isMarkerMode, createOpen]);

  useEffect(() => {
    if (busy || dragUnitId || reorderPending) return;
    const ids = units.map((u) => u.id);
    setUnitOrder(ids);
  }, [units]);

  const unitListSpacing = compactMode ? "space-y-1" : "space-y-2";


  const defaultPos = useMemo(() => {
    return selected?.pos ?? { x: 0, z: 0 };
  }, [selected?.pos]);

  const markerOrderById = useMemo(() => {
    const map = new Map<string, number>();
    if (!Array.isArray(turnOrder)) return map;
    for (let i = 0; i < turnOrder.length; i++) {
      const entry = turnOrder[i];
      if (entry?.kind === "marker" && typeof entry.markerId === "string") {
        if (!map.has(entry.markerId)) map.set(entry.markerId, i);
      }
    }
    return map;
  }, [turnOrder]);

  const [form, setForm] = useState<CreateUnitForm>(() => ({
    unitId: "",
    name: `unit_${units.length + 1}`,
    alias: "",
    side: "TEAM",
    hpMax: 20,
    acBase: 10,
    x: defaultPos.x,
    z: defaultPos.z,
    colorCode: "", // auto
    turnOrderIndex: turnOrderLen,
  }));

  function openCreate() {
    setLocalErr(null);
    setCreateOpen(true);
    setForm({
      unitId: "",
      name: `unit_${units.length + 1}`,
      alias: "",
      side: "TEAM",
      hpMax: 20,
      acBase: 10,
      x: defaultPos.x,
      z: defaultPos.z,
      colorCode: "", // auto
      turnOrderIndex: turnOrderLen,
    });
  }

  function closeCreate() {
    setLocalErr(null);
    setCreateOpen(false);
  }

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    setLocalErr(null);

    const unitIdRaw = (form.unitId ?? "").trim();
    const unitId = unitIdRaw ? unitIdRaw : undefined;

    const name = (form.name ?? "").trim();
    if (!name) {
      setLocalErr("name을 입력해줘.");
      return;
    }

    const aliasRaw = (form.alias ?? "").trim();
    const alias = aliasRaw ? aliasRaw : undefined;

    // ✅ hpMax: backend는 0 허용 (hp 없는 유닛 생성 가능)
    const hpMax = Math.max(0, clampInt(form.hpMax, 20));
    const acBase = Math.max(0, clampInt(form.acBase, 10));
    const x = clampInt(form.x, 0);
    const z = clampInt(form.z, 0);

    const idxRaw = clampInt(form.turnOrderIndex, turnOrderLen);
    const turnOrderIndex = Math.max(0, Math.min(turnOrderLen, idxRaw));

    // ✅ colorCode: ""이면 자동(미전송), 값 있으면 ANSI 범위 검증
    let colorCode: number | undefined = undefined;
    const ccRaw = (form.colorCode ?? "").trim();
    if (ccRaw) {
      const normalized = normalizeAnsiColorCode(ccRaw);
      if (normalized === undefined) {
        setLocalErr(
          "colorCode는 30~37, 39 중 하나만 가능해. (또는 비워서 자동)"
        );
        return;
      }
      colorCode = normalized;
    }

    await onCreateUnit({
      ...(unitId ? { unitId } : {}),
      name,
      side: form.side,
      ...(alias ? { alias } : {}),
      hpMax,
      acBase,
      x,
      z,
      ...(typeof colorCode === "number" ? { colorCode } : {}),
      turnOrderIndex,
    });

    closeCreate();
  }

  function handlePlusClick() {
    if (isMarkerMode) {
      // Marker creation lives in the Board panel; just toggle it here.
      setCreateOpen(false);
      onToggleMarkerCreate();
      return;
    }
    if (createOpen) {
      closeCreate();
    } else {
      openCreate();
    }
  }

  const pinnedUnit = selectedId
    ? (units.find((u) => u.id === selectedId) ?? null)
    : null;
  const showPinned = !!pinnedUnit && !pinnedUnit.bench && !compactMode;
  const unitById = useMemo(() => {
    const map = new Map<string, Unit>();
    for (const u of units) map.set(u.id, u);
    return map;
  }, [units]);
  const baseOrder = useMemo(() => {
    return unitOrder.length ? unitOrder : units.map((u) => u.id);
  }, [unitOrder, units]);
  const sideOrder = useMemo(() => {
    const teamIds: string[] = [];
    const enemyIds: string[] = [];
    const neutralIds: string[] = [];
    const benchTeamIds: string[] = [];
    const benchEnemyIds: string[] = [];

    for (const id of baseOrder) {
      const u = unitById.get(id);
      if (!u) continue;
      if (u.bench === "TEAM") {
        benchTeamIds.push(id);
        continue;
      }
      if (u.bench === "ENEMY") {
        benchEnemyIds.push(id);
        continue;
      }
      if (u.side === "TEAM") {
        teamIds.push(id);
      } else if (u.side === "ENEMY") {
        enemyIds.push(id);
      } else {
        neutralIds.push(id);
      }
    }

    return { teamIds, enemyIds, neutralIds, benchTeamIds, benchEnemyIds };
  }, [baseOrder, unitById]);

  const teamUnits = useMemo(
    () => sideOrder.teamIds.map((id) => unitById.get(id)).filter(Boolean) as Unit[],
    [sideOrder.teamIds, unitById]
  );
  const enemyUnits = useMemo(
    () =>
      sideOrder.enemyIds
        .map((id) => unitById.get(id))
        .filter(Boolean) as Unit[],
    [sideOrder.enemyIds, unitById]
  );
  const neutralUnits = useMemo(
    () =>
      sideOrder.neutralIds
        .map((id) => unitById.get(id))
        .filter(Boolean) as Unit[],
    [sideOrder.neutralIds, unitById]
  );

  async function handleRemove(u: Unit) {
    const ok = window.confirm(`Remove unit: ${u.name}?`);
    if (!ok) return;
    await onRemoveUnit(u.id);
  }

  function handleDragStart(unitId: string, e: DragEvent<HTMLDivElement>) {
    if (busy || isMarkerMode) return;
    setDragUnitId(unitId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", unitId);
  }

  function handleDragOver(unitId: string, e: DragEvent<HTMLDivElement>) {
    if (busy || isMarkerMode) return;
    e.preventDefault();
    e.stopPropagation();
    if (overUnitId !== unitId) setOverUnitId(unitId);
    autoScrollDuringDrag(e);
    e.dataTransfer.dropEffect = "move";
  }

  function handleSideDragOver(e: DragEvent<HTMLDivElement>) {
    if (busy || isMarkerMode) return;
    e.preventDefault();
    if (overUnitId) setOverUnitId(null);
    autoScrollDuringDrag(e);
    e.dataTransfer.dropEffect = "move";
  }

  function autoScrollDuringDrag(e: DragEvent<HTMLElement>) {
    if (!dragUnitId) return;

    const edge = 48;
    const speed = 12;
    const container = unitListRef.current;

    if (container && container.scrollHeight > container.clientHeight + 1) {
      const rect = container.getBoundingClientRect();
      const topGap = e.clientY - rect.top;
      const bottomGap = rect.bottom - e.clientY;
      if (topGap < edge) container.scrollTop -= speed;
      else if (bottomGap < edge) container.scrollTop += speed;
      return;
    }

    if (e.clientY < edge) window.scrollBy({ top: -speed, behavior: "auto" });
    else if (window.innerHeight - e.clientY < edge)
      window.scrollBy({ top: speed, behavior: "auto" });
  }

  function commitOrder(
    nextTeam: string[],
    nextEnemy: string[],
    nextNeutral: string[],
    nextBenchTeam: string[],
    nextBenchEnemy: string[],
    sideChanges?: { unitId: string; side: Side }[],
    benchChanges?: { unitId: string; bench: "TEAM" | "ENEMY" | null }[]
  ) {
    const nextOrder = [
      ...nextTeam,
      ...nextEnemy,
      ...nextNeutral,
      ...nextBenchTeam,
      ...nextBenchEnemy,
    ];
    if (nextOrder.length === 0) return;
    setUnitOrder(nextOrder);
    setReorderPending(true);
    Promise.resolve(
      onReorderUnits({ unitIds: nextOrder, sideChanges, benchChanges })
    ).finally(() => setReorderPending(false));
  }

  function handleDropToSide(
    targetSide: Side,
    targetUnitId: string | null,
    e: DragEvent<HTMLDivElement>
  ) {
    if (busy || isMarkerMode) return;
    e.preventDefault();
    const fromId = dragUnitId ?? e.dataTransfer.getData("text/plain");
    if (!fromId) {
      setDragUnitId(null);
      setOverUnitId(null);
      return;
    }

    const dragUnit = unitById.get(fromId);
    if (!dragUnit) {
      setDragUnitId(null);
      setOverUnitId(null);
      return;
    }

    const nextTeam = [...sideOrder.teamIds];
    const nextEnemy = [...sideOrder.enemyIds];
    const nextNeutral = [...sideOrder.neutralIds];
    const nextBenchTeam = [...sideOrder.benchTeamIds];
    const nextBenchEnemy = [...sideOrder.benchEnemyIds];
    const sourceBench = dragUnit.bench ?? null;

    const pickActiveList = (side: Side) => {
      if (side === "TEAM") return nextTeam;
      if (side === "ENEMY") return nextEnemy;
      return nextNeutral;
    };
    const pickBenchList = (bench: "TEAM" | "ENEMY") => {
      if (bench === "TEAM") return nextBenchTeam;
      return nextBenchEnemy;
    };

    const targetList = pickActiveList(targetSide);
    let sideChanges: { unitId: string; side: Side }[] | undefined = undefined;
    let benchChanges:
      | { unitId: string; bench: "TEAM" | "ENEMY" | null }[]
      | undefined = undefined;

    if (sourceBench) {
      const sourceList = pickBenchList(sourceBench);
      const fromIdx = sourceList.indexOf(fromId);
      if (fromIdx < 0) {
        setDragUnitId(null);
        setOverUnitId(null);
        return;
      }

      const toIdx = targetUnitId
        ? targetList.indexOf(targetUnitId)
        : targetList.length;
      if (toIdx < 0) {
        setDragUnitId(null);
        setOverUnitId(null);
        return;
      }
      sourceList.splice(fromIdx, 1);
      targetList.splice(toIdx, 0, fromId);
      benchChanges = [{ unitId: fromId, bench: null }];
      if (dragUnit.side !== targetSide) {
        sideChanges = [{ unitId: fromId, side: targetSide }];
      }
      commitOrder(
        nextTeam,
        nextEnemy,
        nextNeutral,
        nextBenchTeam,
        nextBenchEnemy,
        sideChanges,
        benchChanges
      );
    } else {
      const sourceSide = dragUnit.side;
      const sourceList = pickActiveList(sourceSide);
      const fromIdx = sourceList.indexOf(fromId);
      if (fromIdx < 0) {
        setDragUnitId(null);
        setOverUnitId(null);
        return;
      }

      const isSameSide = sourceSide === targetSide;
      if (isSameSide) {
        const toIdx = targetUnitId
          ? targetList.indexOf(targetUnitId)
          : targetList.length;
        if (toIdx < 0) {
          setDragUnitId(null);
          setOverUnitId(null);
          return;
        }
        const nextList = moveItem(targetList, fromIdx, toIdx);
        if (targetSide === "TEAM") {
          commitOrder(
            nextList,
            nextEnemy,
            nextNeutral,
            nextBenchTeam,
            nextBenchEnemy
          );
        } else if (targetSide === "ENEMY") {
          commitOrder(
            nextTeam,
            nextList,
            nextNeutral,
            nextBenchTeam,
            nextBenchEnemy
          );
        } else {
          commitOrder(
            nextTeam,
            nextEnemy,
            nextList,
            nextBenchTeam,
            nextBenchEnemy
          );
        }
      } else {
        sourceList.splice(fromIdx, 1);
        const insertAt = targetUnitId
          ? targetList.indexOf(targetUnitId)
          : targetList.length;
        if (insertAt < 0) {
          setDragUnitId(null);
          setOverUnitId(null);
          return;
        }
        targetList.splice(insertAt, 0, fromId);
        sideChanges = [{ unitId: fromId, side: targetSide }];
        commitOrder(
          nextTeam,
          nextEnemy,
          nextNeutral,
          nextBenchTeam,
          nextBenchEnemy,
          sideChanges
        );
      }
    }

    setDragUnitId(null);
    setOverUnitId(null);
  }

  function handleDropOnUnit(unitId: string, e: DragEvent<HTMLDivElement>) {
    e.stopPropagation();
    const targetUnit = unitById.get(unitId);
    if (!targetUnit) return;
    handleDropToSide(targetUnit.side, unitId, e);
  }

  function handleDropOnSide(side: Side, e: DragEvent<HTMLDivElement>) {
    handleDropToSide(side, null, e);
  }

  function handleDragEnd() {
    setDragUnitId(null);
    setOverUnitId(null);
  }

  function renderUnitCard(u: Unit) {
    const isPrimary = u.id === selectedId;
    const isMulti = selectedIds.includes(u.id);
    const multiIdx = selectedIds.indexOf(u.id);
    const isMultiMode = selectedIds.length > 1;
    const isDragging = dragUnitId === u.id;
    const isOver = overUnitId === u.id && dragUnitId !== u.id;

    return (
      <div
        key={u.id}
        onDragOver={(e) => handleDragOver(u.id, e)}
        onDrop={(e) => handleDropOnUnit(u.id, e)}
        className={[
          "relative rounded-xl",
          isMultiMode && isMulti
            ? "ring-2 ring-sky-400/60 shadow-[0_0_0_1px_rgba(56,189,248,0.20)]"
            : "",
          isOver ? "ring-2 ring-amber-400/60" : "",
          isDragging ? "opacity-70" : "",
        ].join(" ")}
      >
        {isMultiMode && isMulti && (
          <div
            className={[
              "pointer-events-none absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-md border border-sky-600/60 bg-sky-950/70 font-semibold text-sky-200",
              compactMode ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-1 text-[10px]",
            ].join(" ")}
          >
            <span>#{multiIdx >= 0 ? multiIdx + 1 : ""}</span>
            {isPrimary && <span className="text-sky-100/90">primary</span>}
          </div>
        )}

        <UnitCard
          unit={u}
          isSelected={isPrimary}
          busy={busy}
          variant="list"
          density={compactMode ? "compact" : "normal"}
          draggable={!busy && !isMarkerMode}
          onDragStart={(e) => handleDragStart(u.id, e)}
          onDragEnd={handleDragEnd}
          onSelect={(e) =>
            onSelectUnit(u.id, {
              additive: e.shiftKey || e.ctrlKey || e.metaKey,
            })
          }
          onEdit={() => onEditUnit(u.id)}
          onRemove={() => handleRemove(u)}
          onToggleHidden={() => onToggleHidden(u.id)}
          hideSide={compactMode || (isMultiMode && isMulti)}
          hideActions={compactMode || isMultiMode}
        />
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-3">
      {/* Header: Units + (+) 버튼 */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold text-zinc-200">
            {isMarkerMode ? "Markers" : "Units"}{" "}
            <span className="text-xs text-zinc-500">
              ({isMarkerMode ? markers.length : units.length})
            </span>
          </div>

          {!isMarkerMode && selectedIds.length > 1 && (
            <span className="rounded-md border border-sky-700/60 bg-sky-950/40 px-2 py-0.5 text-[11px] font-semibold text-sky-200">
              MULTI {selectedIds.length}
            </span>
          )}
        </div>

        {/* + icon button (스크린샷의 빨간 영역) */}
        <button
          type="button"
          onClick={handlePlusClick}
          disabled={busy}
          title={
            createOpen
              ? isMarkerMode
                ? "Close Create Marker"
                : "Close Create Unit"
              : isMarkerMode
                ? "Create Marker"
                : "Create Unit"
          }
          className={[
            "inline-flex items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950/30 text-zinc-200",
            "hover:bg-zinc-800/60 disabled:opacity-50",
            "!p-1.5", // 전역 button CSS가 있으면 대비용(!important)
          ].join(" ")}
        >
          <PlusIcon className="h-4 w-4" />
        </button>
      </div>

      {/* Create Unit 폼 */}
      <div className="mb-2 flex items-center gap-2 text-[11px]">
        <button
          type="button"
          onClick={() => setPanelMode("units")}
          className={[
            "rounded-md border px-2 py-1 font-semibold",
            panelMode === "units"
              ? "border-amber-700/70 bg-amber-950/30 text-amber-100"
              : "border-zinc-800 bg-zinc-950/30 text-zinc-400 hover:text-zinc-200",
          ].join(" ")}
        >
          유닛 목록
        </button>
        <button
          type="button"
          onClick={() => setPanelMode("markers")}
          className={[
            "rounded-md border px-2 py-1 font-semibold",
            panelMode === "markers"
              ? "border-amber-700/70 bg-amber-950/30 text-amber-100"
              : "border-zinc-800 bg-zinc-950/30 text-zinc-400 hover:text-zinc-200",
          ].join(" ")}
        >
          마커 관리
        </button>
        <button
          type="button"
          onClick={() => setCompactMode((prev) => !prev)}
          className={[
            "rounded-md border px-2 py-1 font-semibold",
            compactMode
              ? "border-amber-700/70 bg-amber-950/30 text-amber-100"
              : "border-zinc-800 bg-zinc-950/30 text-zinc-400 hover:text-zinc-200",
          ].join(" ")}
          title="간략화 모드: 드래그/정보 확인을 쉽게"
        >
          간략화
        </button>
      </div>

      {createOpen && !isMarkerMode && (
        <form
          onSubmit={submitCreate}
          className="mb-3 rounded-xl border border-zinc-800 bg-zinc-950/30 p-3"
        >
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-semibold text-zinc-200">
              Create Unit
            </div>
            <button
              type="button"
              onClick={closeCreate}
              disabled={busy}
              className={[
                "rounded-lg border border-zinc-800 bg-zinc-950/30 text-zinc-200",
                "hover:bg-zinc-800/60 disabled:opacity-50",
                "!px-2 !py-1 text-xs",
              ].join(" ")}
            >
              Cancel
            </button>
          </div>

          {localErr && (
            <div className="mb-2 rounded-lg border border-rose-900/60 bg-rose-950/30 px-3 py-2 text-xs text-rose-200">
              {localErr}
            </div>
          )}

          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-zinc-400">Name</label>
              <input
                value={form.name}
                onChange={(e) =>
                  setForm((p) => ({ ...p, name: e.target.value }))
                }
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600"
                disabled={busy}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-zinc-400">Side</label>
              <select
                value={form.side}
                onChange={(e) =>
                  setForm((p) => ({ ...p, side: e.target.value as Side }))
                }
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600"
                disabled={busy}
              >
                <option value="TEAM">TEAM</option>
                <option value="ENEMY">ENEMY</option>
                <option value="NEUTRAL">NEUTRAL</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs text-zinc-400">
                Alias <span className="text-zinc-500">(optional)</span>
              </label>
              <input
                value={form.alias}
                onChange={(e) =>
                  setForm((p) => ({ ...p, alias: e.target.value }))
                }
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600"
                disabled={busy}
                placeholder="formation용 별칭"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-zinc-400">HP Max</label>
              <input
                value={String(form.hpMax)}
                onChange={(e) =>
                  setForm((p) => ({ ...p, hpMax: e.target.value as any }))
                }
                inputMode="numeric"
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600"
                disabled={busy}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-zinc-400">
                AC Base
              </label>
              <input
                value={String(form.acBase)}
                onChange={(e) =>
                  setForm((p) => ({ ...p, acBase: e.target.value as any }))
                }
                inputMode="numeric"
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600"
                disabled={busy}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs text-zinc-400">
                  pos.x
                </label>
                <input
                  value={String(form.x)}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, x: e.target.value as any }))
                  }
                  inputMode="numeric"
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600"
                  disabled={busy}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-400">
                  pos.z
                </label>
                <input
                  value={String(form.z)}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, z: e.target.value as any }))
                  }
                  inputMode="numeric"
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600"
                  disabled={busy}
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs text-zinc-400">
                Color <span className="text-zinc-500">(optional, ANSI)</span>
              </label>
              <select
                value={form.colorCode}
                onChange={(e) =>
                  setForm((p) => ({ ...p, colorCode: e.target.value }))
                }
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600"
                disabled={busy}
              >
                <option value="">Auto (by side)</option>
                <option value="39">Default (39)</option>

                <option value="31">Red (31)</option>
                <option value="32">Green (32)</option>
                <option value="33">Yellow (33)</option>
                <option value="34">Blue (34)</option>
                <option value="35">Magenta (35)</option>
                <option value="36">Cyan (36)</option>
                <option value="37">White (37)</option>
                <option value="30">Gray (30)</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs text-zinc-400">
                turnOrderIndex{" "}
                <span className="text-zinc-500">(0~{turnOrderLen})</span>
              </label>
              <input
                value={String(form.turnOrderIndex)}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    turnOrderIndex: e.target.value as any,
                  }))
                }
                inputMode="numeric"
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600"
                disabled={busy}
              />
            </div>
          </div>

          <div className="mt-3 flex justify-end gap-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-emerald-700 px-3 py-2 text-sm text-white hover:bg-emerald-600 disabled:opacity-50"
            >
              Create
            </button>
          </div>
        </form>
      )}

      {/* Unit list */}
      <div
        ref={unitListRef}
        className={[unitListSpacing, isMarkerMode ? "hidden" : ""].join(" ")}
      >
        {/* ✅ 선택된 유닛이 있으면, 맨 위에 '복제(pinned)' 카드 추가 */}
        {showPinned && pinnedUnit && (
          <UnitCard
            key={`pinned-${pinnedUnit.id}`}
            unit={pinnedUnit}
            isSelected={true}
            busy={busy}
            variant="pinned"
            density={compactMode ? "compact" : "normal"}
            onSelect={() => onSelectUnit(pinnedUnit.id, { additive: false })}
            onEdit={() => onEditUnit(pinnedUnit.id)}
            onRemove={() => handleRemove(pinnedUnit)}
            onToggleHidden={() => onToggleHidden(pinnedUnit.id)}
            hideActions={compactMode || selectedIds.length > 1}
          />
        )}

        {/* ✅ 원래 목록은 그대로 유지 (원래 자리에 남겨두기) */}
        <div className="space-y-3">
          <div
            className={[
              "rounded-xl border border-zinc-800/70 bg-zinc-950/30",
              compactMode ? "p-1.5" : "p-2",
            ].join(" ")}
          >
            <div
              className={[
                "flex items-center justify-between font-semibold",
                compactMode ? "mb-1 text-[10px]" : "mb-2 text-[11px]",
              ].join(" ")}
            >
              <span className="text-sky-300">TEAM</span>
              <span className="text-sky-300/80">{teamUnits.length}</span>
            </div>
            <div
              className="space-y-2"
              onDragOver={handleSideDragOver}
              onDrop={(e) => handleDropOnSide("TEAM", e)}
            >
              {teamUnits.length === 0 ? (
                <div className="rounded-lg border border-dashed border-zinc-800/60 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-500">
                  No TEAM units.
                </div>
              ) : (
                teamUnits.map((u) => renderUnitCard(u))
              )}
            </div>
          </div>

          <div
            className={[
              "rounded-xl border border-zinc-800/70 bg-zinc-950/30",
              compactMode ? "p-1.5" : "p-2",
            ].join(" ")}
          >
            <div
              className={[
                "flex items-center justify-between font-semibold",
                compactMode ? "mb-1 text-[10px]" : "mb-2 text-[11px]",
              ].join(" ")}
            >
              <span className="text-red-300">ENEMY</span>
              <span className="text-red-300/80">{enemyUnits.length}</span>
            </div>
            <div
              className="space-y-2"
              onDragOver={handleSideDragOver}
              onDrop={(e) => handleDropOnSide("ENEMY", e)}
            >
              {enemyUnits.length === 0 ? (
                <div className="rounded-lg border border-dashed border-zinc-800/60 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-500">
                  No ENEMY units.
                </div>
              ) : (
                enemyUnits.map((u) => renderUnitCard(u))
              )}
            </div>
          </div>

          {neutralUnits.length > 0 && (
            <div
              className={[
                "rounded-xl border border-zinc-800/70 bg-zinc-950/30",
                compactMode ? "p-1.5" : "p-2",
              ].join(" ")}
            >
              <div
                className={[
                  "flex items-center justify-between font-semibold text-zinc-400",
                  compactMode ? "mb-1 text-[10px]" : "mb-2 text-[11px]",
                ].join(" ")}
              >
                <span>NEUTRAL</span>
                <span className="text-zinc-500">{neutralUnits.length}</span>
              </div>
              <div
                className="space-y-2"
                onDragOver={handleSideDragOver}
                onDrop={(e) => handleDropOnSide("NEUTRAL", e)}
              >
                {neutralUnits.map((u) => renderUnitCard(u))}
              </div>
            </div>
          )}
        </div>
      </div>

      {isMarkerMode && (
        <div className="space-y-2">
          {markers.length === 0 ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-3 text-xs text-zinc-500">
              등록된 마커가 없습니다.
            </div>
          ) : (
            markers.map((m) => (
              <MarkerRow
                key={m.id}
                marker={m}
                orderIndex={markerOrderById.get(m.id) ?? null}
                busy={busy}
                onUpsert={onUpsertMarker}
                onRemove={onRemoveMarker}
              />
            ))
          )}
        </div>
      )}

    </section>
  );
}


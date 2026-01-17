// src/BenchPanel.tsx
import { useEffect, useMemo, useState, type DragEvent } from "react";
import type { Unit } from "./types";
import UnitCard from "./UnitCard";

function moveItem<T>(arr: T[], from: number, to: number): T[] {
  if (from === to) return arr;
  const next = arr.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export default function BenchPanel(props: {
  units: Unit[];
  selectedId: string | null;
  selectedIds: string[];
  busy: boolean;
  hideBenchTeamOnPublish: boolean;
  hideBenchEnemyOnPublish: boolean;
  onToggleHideBenchTeam: () => void;
  onToggleHideBenchEnemy: () => void;
  onSelectUnit: (id: string, opts?: { additive?: boolean }) => void;
  onEditUnit: (unitId: string) => void;
  onToggleHidden: (unitId: string) => void;
  onRemoveUnit: (unitId: string) => Promise<void> | void;
  onReorderUnits: (payload: {
    unitIds: string[];
    benchChanges?: { unitId: string; bench: "TEAM" | "ENEMY" | null }[];
  }) => Promise<void> | void;
}) {
  const {
    units,
    selectedId,
    selectedIds,
    busy,
    hideBenchTeamOnPublish,
    hideBenchEnemyOnPublish,
    onToggleHideBenchTeam,
    onToggleHideBenchEnemy,
    onSelectUnit,
    onEditUnit,
    onToggleHidden,
    onRemoveUnit,
    onReorderUnits,
  } = props;

  const [unitOrder, setUnitOrder] = useState<string[]>([]);
  const [dragUnitId, setDragUnitId] = useState<string | null>(null);
  const [overUnitId, setOverUnitId] = useState<string | null>(null);
  const [overBench, setOverBench] = useState<"TEAM" | "ENEMY" | null>(null);
  const [reorderPending, setReorderPending] = useState(false);

  useEffect(() => {
    if (dragUnitId || reorderPending) return;
    setUnitOrder(units.map((u) => u.id));
  }, [units, dragUnitId, reorderPending]);

  const unitById = useMemo(() => {
    const map = new Map<string, Unit>();
    for (const u of units) map.set(u.id, u);
    return map;
  }, [units]);

  const baseOrder = useMemo(() => {
    return unitOrder.length ? unitOrder : units.map((u) => u.id);
  }, [unitOrder, units]);

  const benchOrder = useMemo(() => {
    const activeIds: string[] = [];
    const benchTeamIds: string[] = [];
    const benchEnemyIds: string[] = [];

    for (const id of baseOrder) {
      const u = unitById.get(id);
      if (!u) continue;
      if (u.bench === "TEAM") {
        benchTeamIds.push(id);
      } else if (u.bench === "ENEMY") {
        benchEnemyIds.push(id);
      } else {
        activeIds.push(id);
      }
    }

    return { activeIds, benchTeamIds, benchEnemyIds };
  }, [baseOrder, unitById]);

  const benchTeamUnits = useMemo(
    () =>
      benchOrder.benchTeamIds
        .map((id) => unitById.get(id))
        .filter(Boolean) as Unit[],
    [benchOrder.benchTeamIds, unitById]
  );
  const benchEnemyUnits = useMemo(
    () =>
      benchOrder.benchEnemyIds
        .map((id) => unitById.get(id))
        .filter(Boolean) as Unit[],
    [benchOrder.benchEnemyIds, unitById]
  );

  function commitOrder(
    nextActive: string[],
    nextBenchTeam: string[],
    nextBenchEnemy: string[],
    benchChanges?: { unitId: string; bench: "TEAM" | "ENEMY" | null }[]
  ) {
    const nextOrder = [...nextActive, ...nextBenchTeam, ...nextBenchEnemy];
    if (nextOrder.length === 0) return;
    setUnitOrder(nextOrder);
    setReorderPending(true);
    Promise.resolve(
      onReorderUnits({ unitIds: nextOrder, benchChanges })
    ).finally(() => setReorderPending(false));
  }

  function handleDragStart(unitId: string, e: DragEvent<HTMLDivElement>) {
    if (busy) return;
    setDragUnitId(unitId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", unitId);
  }

  function handleDragOver(unitId: string, e: DragEvent<HTMLDivElement>) {
    if (busy) return;
    e.preventDefault();
    e.stopPropagation();
    if (overUnitId !== unitId) setOverUnitId(unitId);
    if (overBench) setOverBench(null);
    e.dataTransfer.dropEffect = "move";
  }

  function handleSectionDragOver(
    bench: "TEAM" | "ENEMY",
    e: DragEvent<HTMLDivElement>
  ) {
    if (busy) return;
    e.preventDefault();
    e.stopPropagation();
    if (overUnitId) setOverUnitId(null);
    if (overBench !== bench) setOverBench(bench);
    e.dataTransfer.dropEffect = "move";
  }

  function handleSectionDragLeave(bench: "TEAM" | "ENEMY") {
    if (overBench === bench) setOverBench(null);
  }

  function handleDropToBench(
    targetBench: "TEAM" | "ENEMY",
    targetUnitId: string | null,
    e: DragEvent<HTMLDivElement>
  ) {
    if (busy) return;
    e.preventDefault();
    const fromId = dragUnitId ?? e.dataTransfer.getData("text/plain");
    if (!fromId) {
      setDragUnitId(null);
      setOverUnitId(null);
      setOverBench(null);
      return;
    }

    const dragUnit = unitById.get(fromId);
    if (!dragUnit) {
      setDragUnitId(null);
      setOverUnitId(null);
      setOverBench(null);
      return;
    }

    const nextActive = [...benchOrder.activeIds];
    const nextBenchTeam = [...benchOrder.benchTeamIds];
    const nextBenchEnemy = [...benchOrder.benchEnemyIds];

    const pickBenchList = (bench: "TEAM" | "ENEMY") =>
      bench === "TEAM" ? nextBenchTeam : nextBenchEnemy;
    const targetList = pickBenchList(targetBench);

    let benchChanges:
      | { unitId: string; bench: "TEAM" | "ENEMY" | null }[]
      | undefined = undefined;

    if (dragUnit.bench) {
      const sourceList = pickBenchList(dragUnit.bench);
      const fromIdx = sourceList.indexOf(fromId);
      if (fromIdx < 0) {
        setDragUnitId(null);
        setOverUnitId(null);
        setOverBench(null);
        return;
      }

      if (dragUnit.bench !== targetBench) {
        sourceList.splice(fromIdx, 1);
        const insertAt = targetUnitId
          ? targetList.indexOf(targetUnitId)
          : targetList.length;
        if (insertAt < 0) {
          setDragUnitId(null);
          setOverUnitId(null);
          setOverBench(null);
          return;
        }
        targetList.splice(insertAt, 0, fromId);
        benchChanges = [{ unitId: fromId, bench: targetBench }];
      } else {
        const toIdx = targetUnitId
          ? targetList.indexOf(targetUnitId)
          : targetList.length;
        if (toIdx < 0) {
          setDragUnitId(null);
          setOverUnitId(null);
          setOverBench(null);
          return;
        }
        const nextList = moveItem(targetList, fromIdx, toIdx);
        if (targetBench === "TEAM") {
          nextBenchTeam.splice(0, nextBenchTeam.length, ...nextList);
        } else {
          nextBenchEnemy.splice(0, nextBenchEnemy.length, ...nextList);
        }
      }
    } else {
      const activeIdx = nextActive.indexOf(fromId);
      if (activeIdx < 0) {
        setDragUnitId(null);
        setOverUnitId(null);
        setOverBench(null);
        return;
      }
      nextActive.splice(activeIdx, 1);
      const insertAt = targetUnitId
        ? targetList.indexOf(targetUnitId)
        : targetList.length;
      if (insertAt < 0) {
        setDragUnitId(null);
        setOverUnitId(null);
        setOverBench(null);
        return;
      }
      targetList.splice(insertAt, 0, fromId);
      benchChanges = [{ unitId: fromId, bench: targetBench }];
    }

    commitOrder(nextActive, nextBenchTeam, nextBenchEnemy, benchChanges);
    setDragUnitId(null);
    setOverUnitId(null);
    setOverBench(null);
  }

  function handleDropOnUnit(unitId: string, e: DragEvent<HTMLDivElement>) {
    e.stopPropagation();
    const targetUnit = unitById.get(unitId);
    if (!targetUnit || !targetUnit.bench) return;
    handleDropToBench(targetUnit.bench, unitId, e);
  }

  function handleDropOnSection(bench: "TEAM" | "ENEMY", e: DragEvent<HTMLDivElement>) {
    e.stopPropagation();
    handleDropToBench(bench, null, e);
  }

  function handleDragEnd() {
    setDragUnitId(null);
    setOverUnitId(null);
    setOverBench(null);
  }

  function renderBenchUnit(u: Unit) {
    const isPrimary = u.id === selectedId;
    const isMulti = selectedIds.includes(u.id);
    const isMultiMode = selectedIds.length > 1;
    const isDragging = dragUnitId === u.id;
    const isOver = overUnitId === u.id && dragUnitId !== u.id;

    return (
      <div
        key={u.id}
        onDragOver={(e) => handleDragOver(u.id, e)}
        onDrop={(e) => handleDropOnUnit(u.id, e)}
        className={[
          "relative rounded-lg",
          isMultiMode && isMulti
            ? "ring-2 ring-sky-400/60 shadow-[0_0_0_1px_rgba(56,189,248,0.20)]"
            : "",
          isOver ? "ring-2 ring-amber-400/60" : "",
          isDragging ? "opacity-70" : "",
        ].join(" ")}
      >
        <UnitCard
          unit={u}
          isSelected={isPrimary}
          busy={busy}
          variant="list"
          density="compact"
          draggable={!busy}
          onDragStart={(e) => handleDragStart(u.id, e)}
          onDragEnd={handleDragEnd}
          onSelect={(e) =>
            onSelectUnit(u.id, {
              additive: e.shiftKey || e.ctrlKey || e.metaKey,
            })
          }
          onEdit={() => onEditUnit(u.id)}
          onRemove={() => onRemoveUnit(u.id)}
          onToggleHidden={() => onToggleHidden(u.id)}
          hideSide={true}
          hideActions={true}
        />
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-2">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-semibold text-zinc-200">{"\ub300\uae30\uc11d"}</div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleHideBenchTeam}
            disabled={busy}
            title={
              "\ud300 \ub300\uae30\uc11d\uc744 \ub514\uc2a4\ucf54\ub4dc \uba54\uc138\uc9c0\uc5d0\uc11c \uc228\uae30\uae30"
            }
            className={[
              "rounded-md border px-2 py-1 text-[11px]",
              hideBenchTeamOnPublish
                ? "border-sky-600/70 bg-sky-900/40 text-sky-100"
                : "border-zinc-800 bg-zinc-950/30 text-zinc-300",
            ].join(" ")}
          >
            {hideBenchTeamOnPublish
              ? "TEAM \uc228\uae40"
              : "TEAM \uc228\uae30\uae30"}
          </button>
          <button
            type="button"
            onClick={onToggleHideBenchEnemy}
            disabled={busy}
            title={
              "\uc801 \ub300\uae30\uc11d\uc744 \ub514\uc2a4\ucf54\ub4dc \uba54\uc138\uc9c0\uc5d0\uc11c \uc228\uae30\uae30"
            }
            className={[
              "rounded-md border px-2 py-1 text-[11px]",
              hideBenchEnemyOnPublish
                ? "border-red-600/70 bg-red-900/40 text-red-100"
                : "border-zinc-800 bg-zinc-950/30 text-zinc-300",
            ].join(" ")}
          >
            {hideBenchEnemyOnPublish
              ? "ENEMY \uc228\uae40"
              : "ENEMY \uc228\uae30\uae30"}
          </button>
          <div className="text-xs text-zinc-500">
            {benchTeamUnits.length + benchEnemyUnits.length} units
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div
          className={[
            "rounded-xl border bg-zinc-950/30 p-2",
            overBench === "TEAM" && benchTeamUnits.length === 0
              ? "border-amber-400/60 bg-amber-500/5 ring-2 ring-amber-400/50"
              : "border-zinc-800/70",
          ].join(" ")}
          onDragOver={(e) => handleSectionDragOver("TEAM", e)}
          onDragLeave={() => handleSectionDragLeave("TEAM")}
          onDrop={(e) => handleDropOnSection("TEAM", e)}
        >
          <div className="mb-1 flex items-center justify-between text-[10px] font-semibold text-sky-300">
            <span>{"TEAM \ub300\uae30\uc11d"}</span>
            <span className="text-sky-300/80">{benchTeamUnits.length}</span>
          </div>
          <div className="space-y-2">
            {benchTeamUnits.length === 0 ? (
              <div className="rounded-lg border border-dashed border-zinc-800/60 bg-zinc-950/40 px-2 py-1.5 text-[11px] text-zinc-500">
                {"\ub300\uae30\uc11d \uc5c6\uc74c"}
              </div>
            ) : (
              benchTeamUnits.map((u) => renderBenchUnit(u))
            )}
          </div>
        </div>

        <div
          className={[
            "rounded-xl border bg-zinc-950/30 p-2",
            overBench === "ENEMY" && benchEnemyUnits.length === 0
              ? "border-amber-400/60 bg-amber-500/5 ring-2 ring-amber-400/50"
              : "border-zinc-800/70",
          ].join(" ")}
          onDragOver={(e) => handleSectionDragOver("ENEMY", e)}
          onDragLeave={() => handleSectionDragLeave("ENEMY")}
          onDrop={(e) => handleDropOnSection("ENEMY", e)}
        >
          <div className="mb-1 flex items-center justify-between text-[10px] font-semibold text-red-300">
            <span>{"ENEMY \ub300\uae30\uc11d"}</span>
            <span className="text-red-300/80">{benchEnemyUnits.length}</span>
          </div>
          <div className="space-y-2">
            {benchEnemyUnits.length === 0 ? (
              <div className="rounded-lg border border-dashed border-zinc-800/60 bg-zinc-950/40 px-2 py-1.5 text-[11px] text-zinc-500">
                {"\ub300\uae30\uc11d \uc5c6\uc74c"}
              </div>
            ) : (
              benchEnemyUnits.map((u) => renderBenchUnit(u))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}


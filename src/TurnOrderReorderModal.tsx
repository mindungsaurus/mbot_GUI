import { useEffect, useMemo, useRef, useState } from "react";
import type { TurnEntry, TurnGroup, Unit } from "./types";
import { unitTextColor } from "./UnitColor";

const DRAG_MIME = "application/x-turn-order";

type DragPayload =
  | { source: "order"; kind: "unit"; unitId: string; index: number }
  | { source: "order"; kind: "group"; groupId: string; index: number }
  | { source: "group"; kind: "unit"; unitId: string; groupId: string };

function moveItem<T>(arr: T[], from: number, to: number): T[] {
  if (from === to) return arr;
  if (!Number.isFinite(from) || !Number.isFinite(to)) return arr;
  if (from < 0 || from >= arr.length) return arr;
  const next = arr.slice();
  const [item] = next.splice(from, 1);
  if (typeof item === "undefined") return arr;
  const target = Math.max(0, Math.min(next.length, Math.floor(to)));
  next.splice(target, 0, item);
  return next;
}

function clampIndex(idx: number, len: number) {
  if (!Number.isFinite(idx)) return len;
  return Math.max(0, Math.min(len, Math.floor(idx)));
}

function unitLabel(u: Unit | undefined | null) {
  if (!u) return "unknown";
  const alias = ((u as any).alias ?? "").toString().trim();
  return alias ? `${u.name} (${alias})` : u.name;
}

function isTurnEligible(u: Unit | undefined | null) {
  if (!u) return false;
  if (u.bench) return false;
  if ((u.unitType ?? "NORMAL") !== "NORMAL") return false;
  return true;
}

function normalizeGroups(
  units: Unit[],
  groups: TurnGroup[],
  opts?: { keepEmpty?: boolean }
) {
  const unitById = new Map<string, Unit>();
  for (const u of units) unitById.set(u.id, u);

  const keepEmpty = !!opts?.keepEmpty;
  const out: TurnGroup[] = [];
  const seenGroupIds = new Set<string>();
  const usedUnitIds = new Set<string>();

  for (const raw of groups ?? []) {
    const id = (raw?.id ?? "").toString().trim();
    if (!id || seenGroupIds.has(id)) continue;
    seenGroupIds.add(id);

    const name = (raw?.name ?? "").toString().trim() || id;
    const unitIds: string[] = [];
    for (const rawId of raw?.unitIds ?? []) {
      const unitId = (rawId ?? "").toString().trim();
      if (!unitId || usedUnitIds.has(unitId)) continue;
      const u = unitById.get(unitId);
      if (!isTurnEligible(u) || u?.turnDisabled) continue;
      usedUnitIds.add(unitId);
      unitIds.push(unitId);
    }

    if (!unitIds.length && !keepEmpty) continue;
    out.push({ id, name, unitIds });
  }

  return out;
}

function buildInitialOrder(
  turnOrder: TurnEntry[],
  units: Unit[],
  groups: TurnGroup[]
) {
  const groupedUnitIds = new Set<string>();
  for (const g of groups) {
    for (const unitId of g.unitIds ?? []) groupedUnitIds.add(unitId);
  }

  const groupIds = new Set(groups.map((g) => g.id));
  const out: TurnEntry[] = [];
  for (const entry of turnOrder ?? []) {
    if (entry.kind === "unit") {
      if (groupedUnitIds.has(entry.unitId)) continue;
      out.push(entry);
      continue;
    }
    if (entry.kind === "group") {
      if (!groupIds.has(entry.groupId)) continue;
      out.push(entry);
      continue;
    }
    if (entry.kind === "label" || entry.kind === "marker") {
      out.push(entry);
    }
  }

  for (const g of groups) {
    if (out.some((e) => e.kind === "group" && e.groupId === g.id)) continue;
    out.push({ kind: "group", groupId: g.id });
  }

  for (const u of units) {
    if (!isTurnEligible(u)) continue;
    if (groupedUnitIds.has(u.id)) continue;
    if (out.some((e) => e.kind === "unit" && e.unitId === u.id)) continue;
    out.push({ kind: "unit", unitId: u.id });
  }

  return out;
}

function readDragPayload(e: React.DragEvent): DragPayload | null {
  const raw =
    e.dataTransfer.getData(DRAG_MIME) ||
    e.dataTransfer.getData("text/plain");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DragPayload;
  } catch {
    return null;
  }
}

function mergeMarkerTemplate(template: TurnEntry[], order: TurnEntry[]) {
  if (!template.length) return order;
  const out: TurnEntry[] = [];
  let idx = 0;
  for (const entry of template) {
    if (entry.kind === "marker") {
      out.push(entry);
      continue;
    }
    const next = order[idx++];
    if (next) out.push(next);
  }
  if (idx < order.length) {
    out.push(...order.slice(idx));
  }
  return out;
}

export default function TurnOrderReorderModal(props: {
  open: boolean;
  units: Unit[];
  turnOrder: TurnEntry[];
  turnGroups: TurnGroup[];
  busy?: boolean;
  onClose: () => void;
  onApply: (
    turnOrder: TurnEntry[],
    turnGroups: TurnGroup[],
    disabledChanges: { unitId: string; turnDisabled: boolean }[]
  ) => Promise<void> | void;
}) {
  const { open, units, turnOrder, turnGroups, busy, onClose, onApply } = props;

  const unitById = useMemo(() => {
    const m = new Map<string, Unit>();
    for (const u of units) m.set(u.id, u);
    return m;
  }, [units]);

  const [draftOrder, setDraftOrder] = useState<TurnEntry[]>([]);
  const [draftGroups, setDraftGroups] = useState<TurnGroup[]>([]);
  const [draftDisabled, setDraftDisabled] = useState<Record<string, boolean>>(
    {}
  );
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [overGroupId, setOverGroupId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState("");
  const initialOrderRef = useRef<TurnEntry[]>([]);
  const markerTemplateRef = useRef<TurnEntry[]>([]);
  const initialGroupsRef = useRef<TurnGroup[]>([]);
  const initialDisabledRef = useRef<Record<string, boolean>>({});
  const entryRefs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    if (!open) return;
    const normalizedGroups = normalizeGroups(units, turnGroups ?? [], {
      keepEmpty: true,
    });
    const templateOrder = buildInitialOrder(
      Array.isArray(turnOrder) ? turnOrder : [],
      units,
      normalizedGroups
    );
    const baseOrder = templateOrder.filter((entry) => entry.kind !== "marker");
    initialOrderRef.current = baseOrder;
    markerTemplateRef.current = templateOrder;
    initialGroupsRef.current = normalizedGroups;
    setDraftOrder(baseOrder);
    setDraftGroups(normalizedGroups);

    const disabledMap: Record<string, boolean> = {};
    for (const u of units) disabledMap[u.id] = !!u.turnDisabled;
    initialDisabledRef.current = disabledMap;
    setDraftDisabled({ ...disabledMap });

    setDragIndex(null);
    setOverIndex(null);
    setOverGroupId(null);
    setGroupName("");
  }, [open, turnOrder, turnGroups, units]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, busy]);

  if (!open) return null;

  function detachUnitFromGroups(unitId: string) {
    const removedGroupIds = new Set<string>();
    const nextGroups: TurnGroup[] = [];
    for (const g of draftGroups) {
      const unitIds = Array.isArray(g.unitIds) ? g.unitIds : [];
      if (!unitIds.includes(unitId)) {
        nextGroups.push({ ...g, unitIds });
        continue;
      }
      const nextUnitIds = unitIds.filter((id) => id !== unitId);
      if (nextUnitIds.length === 0) {
        removedGroupIds.add(g.id);
        continue;
      }
      nextGroups.push({ ...g, unitIds: nextUnitIds });
    }
    return { nextGroups, removedGroupIds };
  }

  function ensureGroupEntry(order: TurnEntry[], groupId: string) {
    if (order.some((e) => e.kind === "group" && e.groupId === groupId)) {
      return order;
    }
    const entry: TurnEntry = { kind: "group", groupId };
    return [...order, entry];
  }

  function handleDragStartEntry(
    entry: TurnEntry,
    idx: number,
    e: React.DragEvent
  ) {
    if (busy) return;
    if (entry.kind !== "unit" && entry.kind !== "group") return;
    setDragIndex(idx);
    setOverIndex(idx);
    e.dataTransfer.effectAllowed = "move";
    const payload: DragPayload =
      entry.kind === "unit"
        ? { source: "order", kind: "unit", unitId: entry.unitId, index: idx }
        : { source: "order", kind: "group", groupId: entry.groupId, index: idx };
    e.dataTransfer.setData(DRAG_MIME, JSON.stringify(payload));
    e.dataTransfer.setData("text/plain", JSON.stringify(payload));
  }

  function handleDragStartGroupUnit(
    groupId: string,
    unitId: string,
    e: React.DragEvent
  ) {
    if (busy) return;
    e.dataTransfer.effectAllowed = "move";
    const payload: DragPayload = {
      source: "group",
      kind: "unit",
      unitId,
      groupId,
    };
    e.dataTransfer.setData(DRAG_MIME, JSON.stringify(payload));
    e.dataTransfer.setData("text/plain", JSON.stringify(payload));
  }

  function handleDragOverEntry(idx: number, e: React.DragEvent) {
    if (busy) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const target = e.target as HTMLElement | null;
    if (target?.closest?.("[data-group-drop=\"true\"]")) return;
    if (overIndex !== idx) setOverIndex(idx);
    if (overGroupId) setOverGroupId(null);
  }

  function handleDragEnterEntry(idx: number, e: React.DragEvent) {
    if (busy) return;
    e.preventDefault();
    const target = e.target as HTMLElement | null;
    if (target?.closest?.("[data-group-drop=\"true\"]")) return;
    if (overIndex !== idx) setOverIndex(idx);
    if (overGroupId) setOverGroupId(null);
  }

  function handleListDragOver(e: React.DragEvent) {
    if (busy) return;
    e.preventDefault();
    const target = e.target as HTMLElement | null;
    if (target?.closest?.("[data-group-drop=\"true\"]")) return;
    const y = e.clientY;
    let nextIdx: number | null = null;
    for (let i = 0; i < entryRefs.current.length; i++) {
      const el = entryRefs.current[i];
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (y >= rect.top && y <= rect.bottom) {
        nextIdx = i;
        break;
      }
    }
    if (nextIdx == null) return;
    if (overIndex !== nextIdx) setOverIndex(nextIdx);
    if (overGroupId) setOverGroupId(null);
  }

  function handleListDragLeave(e: React.DragEvent) {
    if (busy) return;
    const nextTarget = e.relatedTarget as Node | null;
    if (nextTarget && e.currentTarget.contains(nextTarget)) return;
    if (overIndex !== null) setOverIndex(null);
    if (overGroupId) setOverGroupId(null);
  }

  function handleDropOnEntry(idx: number, e: React.DragEvent) {
    if (busy) return;
    e.preventDefault();
    const payload = readDragPayload(e);
    if (!payload) return;
    setOverGroupId(null);

    if (payload.source === "order") {
      if (payload.index == null || payload.index === idx) {
        setDragIndex(null);
        setOverIndex(null);
        return;
      }
      setDraftOrder((prev) => moveItem(prev, payload.index, idx));
      setDragIndex(null);
      setOverIndex(null);
      return;
    }

    if (payload.source === "group" && payload.kind === "unit") {
      const unitId = payload.unitId;
      const { nextGroups, removedGroupIds } = detachUnitFromGroups(unitId);
      setDraftGroups(nextGroups);
      setDraftOrder((prev) => {
        let next = prev.filter(
          (entry) => !(entry.kind === "unit" && entry.unitId === unitId)
        );
        if (removedGroupIds.size) {
          next = next.filter(
            (entry) =>
              !(
                entry.kind === "group" && removedGroupIds.has(entry.groupId)
              )
          );
        }
        const insertAt = clampIndex(idx, next.length);
        next.splice(insertAt, 0, { kind: "unit", unitId });
        return next;
      });
    }
    setDragIndex(null);
    setOverIndex(null);
  }

  function handleDragEnd() {
    setDragIndex(null);
    setOverIndex(null);
    setOverGroupId(null);
  }

  function handleGroupDragOver(groupId: string, e: React.DragEvent) {
    if (busy) return;
    e.stopPropagation();
    e.preventDefault();
    if (overGroupId !== groupId) setOverGroupId(groupId);
    if (overIndex !== null) setOverIndex(null);
  }

  function handleGroupDragEnter(groupId: string, e: React.DragEvent) {
    if (busy) return;
    e.stopPropagation();
    e.preventDefault();
    if (overGroupId !== groupId) setOverGroupId(groupId);
    if (overIndex !== null) setOverIndex(null);
  }

  function handleGroupDragLeave(groupId: string, e: React.DragEvent) {
    if (busy) return;
    const nextTarget = e.relatedTarget as Node | null;
    if (nextTarget && e.currentTarget.contains(nextTarget)) return;
    if (overGroupId === groupId) setOverGroupId(null);
  }

  function handleDropOnGroup(groupId: string, e: React.DragEvent) {
    if (busy) return;
    e.stopPropagation();
    e.preventDefault();
    const payload = readDragPayload(e);
    if (!payload || payload.kind !== "unit") return;

    const unitId = payload.unitId;
    const { nextGroups, removedGroupIds } = detachUnitFromGroups(unitId);
    const updatedGroups = nextGroups.map((g) => {
      const unitIds = Array.isArray(g.unitIds) ? g.unitIds : [];
      if (g.id !== groupId) return { ...g, unitIds };
      if (unitIds.includes(unitId)) return { ...g, unitIds };
      return { ...g, unitIds: [...unitIds, unitId] };
    });

    setDraftGroups(updatedGroups);
    setDraftOrder((prev) => {
      let next = prev.filter(
        (entry) => !(entry.kind === "unit" && entry.unitId === unitId)
      );
      if (removedGroupIds.size) {
        next = next.filter(
          (entry) =>
            !(entry.kind === "group" && removedGroupIds.has(entry.groupId))
        );
      }
      next = ensureGroupEntry(next, groupId);
      return next;
    });

    setDragIndex(null);
    setOverIndex(null);
    setOverGroupId(null);
  }

  function toggleDisabled(unitId: string) {
    if (busy) return;
    const nextValue = !draftDisabled[unitId];
    setDraftDisabled((prev) => ({ ...prev, [unitId]: nextValue }));

    if (!nextValue) return;

    const { nextGroups, removedGroupIds } = detachUnitFromGroups(unitId);
    setDraftGroups(nextGroups);
    setDraftOrder((prev) => {
      let next = prev.filter(
        (entry) => !(entry.kind === "unit" && entry.unitId === unitId)
      );
      if (removedGroupIds.size) {
        next = next.filter(
          (entry) =>
            !(entry.kind === "group" && removedGroupIds.has(entry.groupId))
        );
      }
      next.push({ kind: "unit", unitId });
      return next;
    });
  }

  function createGroup() {
    const name = groupName.trim() || "Group";
    const id =
      (crypto as any)?.randomUUID?.() ??
      `group_${Date.now().toString(36)}`;

    setDraftGroups((prev) => [...prev, { id, name, unitIds: [] }]);
    setDraftOrder((prev) => [...prev, { kind: "group", groupId: id }]);
    setGroupName("");
  }

  function removeGroup(groupId: string) {
    const group = draftGroups.find((g) => g.id === groupId);
    if (!group) return;
    const members = Array.isArray(group.unitIds) ? group.unitIds : [];

    setDraftGroups((prev) => prev.filter((g) => g.id !== groupId));
    setDraftOrder((prev) => {
      const base = prev.filter(
        (entry) => !(entry.kind === "group" && entry.groupId === groupId)
      );
      const withoutMembers = base.filter(
        (entry) =>
          !(entry.kind === "unit" && members.includes(entry.unitId))
      );
      const insertAt = Math.max(
        0,
        prev.findIndex(
          (entry) => entry.kind === "group" && entry.groupId === groupId
        )
      );
      const next = withoutMembers.slice();
      next.splice(
        insertAt,
        0,
        ...members.map((unitId) => ({ kind: "unit", unitId } as TurnEntry))
      );
      return next;
    });
  }

  function updateGroupName(groupId: string, name: string) {
    setDraftGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, name } : g))
    );
  }

  function promptRenameGroup(groupId: string) {
    if (busy) return;
    const group = draftGroups.find((g) => g.id === groupId);
    const next = window.prompt("Group name", group?.name ?? "");
    if (next == null) return;
    const name = next.trim();
    if (!name) return;
    updateGroupName(groupId, name);
  }

  function removeUnitFromGroup(groupId: string, unitId: string) {
    setDraftGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        const unitIds = Array.isArray(g.unitIds) ? g.unitIds : [];
        return { ...g, unitIds: unitIds.filter((id) => id !== unitId) };
      })
    );
    setDraftOrder((prev) => {
      if (prev.some((entry) => entry.kind === "unit" && entry.unitId === unitId)) {
        return prev;
      }
      const insertAt = Math.max(
        0,
        prev.findIndex(
          (entry) => entry.kind === "group" && entry.groupId === groupId
        )
      );
      const next = prev.slice();
      next.splice(insertAt + 1, 0, { kind: "unit", unitId });
      return next;
    });
  }

  function resetOrder() {
    setDraftOrder(initialOrderRef.current);
    setDraftGroups(initialGroupsRef.current);
    setDraftDisabled({ ...initialDisabledRef.current });
  }

  async function applyOrder() {
    if (busy) return;
    const disabledChanges: { unitId: string; turnDisabled: boolean }[] = [];
    for (const [unitId, disabled] of Object.entries(draftDisabled)) {
      const before = !!initialDisabledRef.current[unitId];
      if (!!disabled !== before) {
        disabledChanges.push({ unitId, turnDisabled: !!disabled });
      }
    }
    const nextOrder = mergeMarkerTemplate(
      markerTemplateRef.current,
      safeOrder as TurnEntry[]
    );
    await onApply(nextOrder, draftGroups, disabledChanges);
  }

  const safeOrder = draftOrder.filter((entry) => !!entry);
  const empty = safeOrder.length === 0;
  entryRefs.current.length = safeOrder.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Turn order reorder modal"
    >
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
        onClick={busy ? undefined : onClose}
        role="button"
        aria-label="Close overlay"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && !busy && onClose()}
      />

      <div className="relative z-10 w-[min(720px,92vw)] rounded-2xl border border-zinc-800 bg-zinc-950 p-4 shadow-2xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-zinc-100">
              순서 조정
            </div>
            <div className="mt-1 text-xs text-zinc-500">
              유닛을 드래그해 순서를 바꾸고, 그룹 카드에 드롭해 묶을 수 있습니다.
            </div>
          </div>

        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="그룹 이름"
            className="h-9 w-44 rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-xs text-zinc-100 placeholder:text-zinc-600"
          />
          <button
            type="button"
            disabled={busy}
            onClick={createGroup}
            className="rounded-lg bg-amber-700 px-3 py-2 text-xs text-white hover:bg-amber-600 disabled:opacity-50"
          >
            그룹 추가
          </button>
        </div>

        <div
          className="max-h-[62vh] space-y-2 overflow-y-auto pr-1"
          onDragOver={handleListDragOver}
          onDragLeave={handleListDragLeave}
        >
          {empty ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-3 text-xs text-zinc-500">
              배치된 엔트리가 없습니다.
            </div>
          ) : (
            safeOrder.map((entry, idx) => {
              const isUnit = entry.kind === "unit";
              const isGroup = entry.kind === "group";
              const unit = isUnit ? unitById.get(entry.unitId) : null;
              const group = isGroup
                ? draftGroups.find((g) => g.id === entry.groupId)
                : null;
              const label = isUnit
                ? unitLabel(unit)
                : isGroup
                  ? group?.name ?? entry.groupId
                  : entry.kind === "marker"
                    ? `마커: ${entry.markerId}`
                    : entry.text;
              const color = unit ? unitTextColor(unit) : undefined;
              const isOver = overIndex === idx;
              const isDragging = dragIndex === idx;
              const isDisabled = isUnit && !!draftDisabled[entry.unitId];

              return (
                <div
                  key={`${entry.kind}-${"unitId" in entry ? entry.unitId : "groupId" in entry ? entry.groupId : idx}-${idx}`}
                  ref={(el) => {
                    entryRefs.current[idx] = el;
                  }}
                  data-entry-index={idx}
                  draggable={!busy && (isUnit || isGroup)}
                  onDragStart={(e) => handleDragStartEntry(entry, idx, e)}
                  onDragEnd={handleDragEnd}
                  onDragEnter={(e) => handleDragEnterEntry(idx, e)}
                  onDragOver={(e) => handleDragOverEntry(idx, e)}
                  onDragEnterCapture={(e) => handleDragEnterEntry(idx, e)}
                  onDragOverCapture={(e) => handleDragOverEntry(idx, e)}
                  onDrop={(e) => handleDropOnEntry(idx, e)}
                  className={[
                    "rounded-lg border px-3 py-2",
                    "border-zinc-800 bg-zinc-950/30",
                    "text-xs text-zinc-200",
                    isOver
                      ? "border-amber-400/80 bg-amber-900/20 ring-2 ring-amber-400/40"
                      : "",
                    isDragging ? "opacity-60" : "",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="w-5 text-right text-[11px] text-zinc-500">
                        {idx + 1}
                      </span>
                      <span className="text-zinc-500" aria-hidden="true">
                        <svg
                          viewBox="0 0 24 24"
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        >
                          <path d="M4 7h16M4 12h16M4 17h16" />
                        </svg>
                      </span>
                      <span
                        className={[
                          "font-semibold",
                          isGroup ? "text-amber-200" : "",
                        ].join(" ")}
                        style={color ? { color } : undefined}
                        title={unit?.name ?? label}
                      >
                        {label}
                      </span>
                    </div>

                    {isUnit ? (
                      <label className="flex items-center gap-2 text-[11px] text-zinc-400">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-amber-500"
                          checked={isDisabled}
                          onChange={() => toggleDisabled(entry.unitId)}
                          disabled={busy}
                        />
                        <span>비활성화</span>
                      </label>
                    ) : null}
                  </div>

                  {isGroup ? (
                    <div
                      className={[
                        "mt-2 rounded-lg border border-dashed px-2 py-2",
                        overGroupId === entry.groupId
                          ? "border-amber-400/60 bg-amber-950/20"
                          : "border-zinc-800/80",
                      ].join(" ")}
                      data-group-drop="true"
                      onDragEnter={(e) => handleGroupDragEnter(entry.groupId, e)}
                      onDragOver={(e) => handleGroupDragOver(entry.groupId, e)}
                      onDragLeave={(e) => handleGroupDragLeave(entry.groupId, e)}
                      onDrop={(e) => handleDropOnGroup(entry.groupId, e)}
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="text-xs font-semibold text-amber-200">
                          {group?.name ?? entry.groupId}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => promptRenameGroup(entry.groupId)}
                            className="rounded-md border border-zinc-800 px-2 py-1 text-[11px] text-zinc-300 hover:border-zinc-600"
                          >
                            Rename
                          </button>
                          <button
                            type="button"
                            onClick={() => removeGroup(entry.groupId)}
                            className="rounded-md border border-zinc-800 px-2 py-1 text-[11px] text-zinc-300 hover:border-zinc-600"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                      {(group?.unitIds ?? []).length ? (
                        <div className="flex flex-wrap gap-2">
                          {(group?.unitIds ?? []).map((unitId) => {
                            const u = unitById.get(unitId);
                            const chipLabel = unitLabel(u);
                            const chipColor = u ? unitTextColor(u) : undefined;
                            return (
                              <div
                                key={unitId}
                                draggable={!busy}
                                onDragStart={(e) =>
                                  handleDragStartGroupUnit(
                                    entry.groupId,
                                    unitId,
                                    e
                                  )
                                }
                                onDragEnd={handleDragEnd}
                                className="flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-950/30 px-2 py-0.5 text-[11px] text-amber-100"
                                style={chipColor ? { color: chipColor } : undefined}
                                title={u?.name ?? unitId}
                              >
                                <span>{chipLabel}</span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeUnitFromGroup(entry.groupId, unitId);
                                  }}
                                  className="text-[10px] text-amber-200/80 hover:text-amber-100"
                                  aria-label="Remove from group"
                                >
                                  ×
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-[11px] text-zinc-500">
                          Drop units into this group.
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={resetOrder}
            disabled={busy || empty}
            className="rounded-lg border border-zinc-800 bg-zinc-950/30 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-800/60 disabled:opacity-50"
          >
            Reset
          </button>

          <button
            type="button"
            disabled={busy || empty}
            onClick={applyOrder}
            className="rounded-lg bg-amber-700 px-3 py-2 text-xs text-white hover:bg-amber-600 disabled:opacity-50"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import type { TurnEntry, Unit } from "./types";
import { unitTextColor } from "./UnitColor";

function moveItem<T>(arr: T[], from: number, to: number): T[] {
  if (from === to) return arr;
  const next = arr.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function unitLabel(u: Unit | undefined | null) {
  if (!u) return "unknown";
  const alias = ((u as any).alias ?? "").toString().trim();
  return alias ? `${u.name} (${alias})` : u.name;
}

export default function TurnOrderReorderModal(props: {
  open: boolean;
  units: Unit[];
  turnOrder: TurnEntry[];
  busy?: boolean;
  onClose: () => void;
  onApply: (
    unitIds: string[],
    disabledChanges: { unitId: string; turnDisabled: boolean }[]
  ) => Promise<void> | void;
}) {
  const { open, units, turnOrder, busy, onClose, onApply } = props;

  const unitById = useMemo(() => {
    const m = new Map<string, Unit>();
    for (const u of units) m.set(u.id, u);
    return m;
  }, [units]);

  const orderUnitIds = useMemo(() => {
    const ids: string[] = [];
    for (const e of turnOrder ?? []) {
      if (e?.kind === "unit" && typeof e.unitId === "string") {
        ids.push(e.unitId);
      }
    }
    if (ids.length === 0) {
      for (const u of units) ids.push(u.id);
    }
    return ids;
  }, [turnOrder, units]);

  const [draftIds, setDraftIds] = useState<string[]>([]);
  // Track turn-disabled toggles while the modal is open.
  const [draftDisabled, setDraftDisabled] = useState<Record<string, boolean>>(
    {}
  );
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const initialIdsRef = useRef<string[]>([]);
  const initialDisabledRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    if (!open) return;
    const base = orderUnitIds;
    initialIdsRef.current = base;
    setDraftIds(base);
    const disabledMap: Record<string, boolean> = {};
    for (const u of units) disabledMap[u.id] = !!u.turnDisabled;
    initialDisabledRef.current = disabledMap;
    setDraftDisabled({ ...disabledMap });
    setDragIndex(null);
    setOverIndex(null);
  }, [open, orderUnitIds, units]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, busy]);

  if (!open) return null;

  function handleDragStart(idx: number, e: React.DragEvent) {
    if (busy) return;
    setDragIndex(idx);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(idx));
  }

  function handleDragOver(idx: number, e: React.DragEvent) {
    if (busy) return;
    e.preventDefault();
    if (overIndex !== idx) setOverIndex(idx);
  }

  function handleDrop(idx: number, e: React.DragEvent) {
    if (busy) return;
    e.preventDefault();
    const raw = e.dataTransfer.getData("text/plain");
    const from = dragIndex ?? Number(raw);
    if (!Number.isFinite(from)) return;
    if (from < 0 || from >= draftIds.length) return;
    if (from === idx) {
      setDragIndex(null);
      setOverIndex(null);
      return;
    }
    setDraftIds((prev) => moveItem(prev, from, idx));
    setDragIndex(null);
    setOverIndex(null);
  }

  function handleDragEnd() {
    setDragIndex(null);
    setOverIndex(null);
  }

  function toggleDisabled(unitId: string) {
    if (busy) return;
    setDraftDisabled((prev) => ({
      ...prev,
      [unitId]: !prev[unitId],
    }));
  }

  function resetOrder() {
    setDraftIds(initialIdsRef.current);
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
    await onApply(draftIds, disabledChanges);
  }

  const empty = draftIds.length === 0;

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

      <div className="relative z-10 w-[min(520px,92vw)] rounded-2xl border border-zinc-800 bg-zinc-950 p-4 shadow-2xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-zinc-100">
              턴 순서 조정
            </div>
            <div className="mt-1 text-xs text-zinc-500">
              라벨은 숨기고 유닛만 재배치합니다.
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800/60 disabled:opacity-50"
          >
            Close
          </button>
        </div>

        <div className="mb-2 text-xs text-zinc-500">
          드래그해서 순서를 바꾼 뒤 적용을 눌러주세요.
        </div>

        <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
          {empty ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-3 text-xs text-zinc-500">
              정렬할 유닛이 없습니다.
            </div>
          ) : (
            draftIds.map((unitId, idx) => {
              const unit = unitById.get(unitId);
              const label = unit ? unitLabel(unit) : unitId;
              const color = unit ? unitTextColor(unit) : undefined;
              const isOver = overIndex === idx && dragIndex !== null;
              const isDragging = dragIndex === idx;
              const isDisabled = !!draftDisabled[unitId];

              return (
                <div
                  key={`${unitId}-${idx}`}
                  draggable={!busy}
                  onDragStart={(e) => handleDragStart(idx, e)}
                  onDragOver={(e) => handleDragOver(idx, e)}
                  onDrop={(e) => handleDrop(idx, e)}
                  onDragEnd={handleDragEnd}
                  className={[
                    "flex items-center justify-between rounded-lg border px-3 py-2",
                    "border-zinc-800 bg-zinc-950/30",
                    "text-xs text-zinc-200",
                    isOver ? "border-amber-400/60 bg-amber-950/20" : "",
                    isDragging ? "opacity-60" : "",
                    isDisabled ? "opacity-60" : "",
                  ].join(" ")}
                >
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
                      className="font-semibold"
                      style={color ? { color } : undefined}
                      title={unit?.name ?? ""}
                    >
                      {label}
                    </span>
                  </div>

                  <label className="flex items-center gap-2 text-[11px] text-zinc-400">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-amber-500"
                      checked={isDisabled}
                      onChange={() => toggleDisabled(unitId)}
                      disabled={busy}
                    />
                    <span>비활성화</span>
                  </label>
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

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-800/60 disabled:opacity-50"
            >
              Cancel
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
    </div>
  );
}

// src/ControlPanel.tsx
import { useEffect, useMemo, useRef, useState } from "react";

export type ControlActionMode =
  | "DAMAGE"
  | "HEAL"
  | "NEXT_TURN"
  | "TEMP_HP"
  | "ADD_TAG"
  | "REMOVE_TAG"
  | "SPELL_SLOT"
  | "ADD_DEATH_FAIL"
  | "TOGGLE_HIDDEN"
  | "CONSUMABLE";

const LS_PANEL_POS = "operator.controlPanel.pos";
const LS_PANEL_MODE = "operator.controlPanel.mode";
const LS_PANEL_COLLAPSED = "operator.controlPanel.collapsed";

type Pos = { x: number; y: number };

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function loadPos(): Pos | null {
  try {
    const raw = localStorage.getItem(LS_PANEL_POS);
    if (!raw) return null;
    const v = JSON.parse(raw) as Pos;
    if (typeof v?.x !== "number" || typeof v?.y !== "number") return null;
    return v;
  } catch {
    return null;
  }
}

function savePos(pos: Pos) {
  localStorage.setItem(LS_PANEL_POS, JSON.stringify(pos));
}

function loadMode(): ControlActionMode | null {
  try {
    const raw = localStorage.getItem(LS_PANEL_MODE);
    if (!raw) return null;
    if (
      raw === "DAMAGE" ||
      raw === "HEAL" ||
      raw === "NEXT_TURN" ||
      raw === "TEMP_HP" ||
      raw === "ADD_TAG" ||
      raw === "REMOVE_TAG" ||
      raw === "SPELL_SLOT" ||
      raw === "ADD_DEATH_FAIL" ||
      raw === "TOGGLE_HIDDEN" ||
      raw === "CONSUMABLE"
    )
      return raw;
    return null;
  } catch {
    return null;
  }
}

function saveMode(mode: ControlActionMode) {
  localStorage.setItem(LS_PANEL_MODE, mode);
}

function loadCollapsed(): boolean {
  try {
    return localStorage.getItem(LS_PANEL_COLLAPSED) === "1";
  } catch {
    return false;
  }
}

function saveCollapsed(collapsed: boolean) {
  localStorage.setItem(LS_PANEL_COLLAPSED, collapsed ? "1" : "0");
}

function defaultPos(): Pos {
  // SSR 고려(사실 Vite면 거의 없음)
  const w = typeof window !== "undefined" ? window.innerWidth : 1200;
  const h = typeof window !== "undefined" ? window.innerHeight : 800;
  // 오른쪽 아래 쪽에 적당히
  return { x: Math.max(16, w - 360), y: Math.max(16, h - 320) };
}

function isEditableTarget(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName?.toUpperCase();
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  return false;
}

export default function ControlPanel(props: {
  disabled?: boolean;
  canControlMove?: boolean; // selected 유닛이 있을 때 true
  canControlAction?: boolean; // damage/heal 적용 가능한지(유닛 선택 등)
  hotkeysEnabled?: boolean;
  amount: number;
  setAmount: (v: number) => void;
  onMove: (dx: number, dz: number) => void;
  onAction: (mode: ControlActionMode) => void;
  slotLevel: number;
  setSlotLevel: (level: number) => void;
  slotDelta: "spend" | "recover";
  setSlotDelta: (delta: "spend" | "recover") => void;
  consumableOptions: Array<{ name: string; value: number }>;
  consumableName: string;
  setConsumableName: (name: string) => void;
  consumableDelta: "dec" | "inc";
  setConsumableDelta: (delta: "dec" | "inc") => void;
  consumableRemaining?: number | null;
  consumableDisabled?: boolean;
  tagReduceOptions: Array<{ name: string; kind: "toggle" | "stack"; stacks?: number }>;
  tagReduceName: string;
  setTagReduceName: (name: string) => void;
  tagReduceKind?: "toggle" | "stack" | null;
  tagReduceStacks?: number | null;
  tagReduceDisabled?: boolean;
}) {
  const {
    disabled,
    canControlMove = true,
    canControlAction = true,
    hotkeysEnabled = true,
    amount,
    setAmount,
    onMove,
    onAction,
    slotLevel,
    setSlotLevel,
    slotDelta,
    setSlotDelta,
    consumableOptions,
    consumableName,
    setConsumableName,
    consumableDelta,
    setConsumableDelta,
    consumableRemaining,
    consumableDisabled = false,
    tagReduceOptions,
    tagReduceName,
    setTagReduceName,
    tagReduceKind = null,
    tagReduceStacks = null,
    tagReduceDisabled = false,
  } = props;

  const panelRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
  } | null>(null);

  const [pos, setPos] = useState<Pos>(() => loadPos() ?? defaultPos());
  const [mode, setMode] = useState<ControlActionMode>(
    () => loadMode() ?? "NEXT_TURN"
  );
  const [collapsed, setCollapsed] = useState<boolean>(() => loadCollapsed());
  const [amountInput, setAmountInput] = useState<string>(() => String(amount));

  const modeLabel = useMemo(() => {
    switch (mode) {
      case "DAMAGE":
        return "Damage";
      case "HEAL":
        return "Heal";
      case "TEMP_HP":
        return "Temp HP";
      case "ADD_TAG":
        return "Add Tag";
      case "REMOVE_TAG":
        return "Remove Tag";
      case "SPELL_SLOT":
        return "Spell Slot";
      case "ADD_DEATH_FAIL":
        return "Death Save";
      case "TOGGLE_HIDDEN":
        return "Hide";
      case "CONSUMABLE":
        return "Consumable";
      case "NEXT_TURN":
        return "Next Turn";
    }
  }, [mode]);

  useEffect(() => saveMode(mode), [mode]);
  useEffect(() => saveCollapsed(collapsed), [collapsed]);

  useEffect(() => {
    if (mode === "SPELL_SLOT") {
      const next = Math.max(1, amount);
      if (next !== amount) setAmount(next);
    }
  }, [mode, amount, setAmount]);
  useEffect(() => {
    setAmountInput(String(amount));
  }, [amount]);

  // 창 크기 바뀌면 화면 밖으로 나가지 않게 보정
  useEffect(() => {
    const onResize = () => {
      const el = panelRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setPos((p) => {
        const nx = clamp(p.x, 8, window.innerWidth - rect.width - 8);
        const ny = clamp(p.y, 8, window.innerHeight - rect.height - 8);
        const next = { x: nx, y: ny };
        savePos(next);
        return next;
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  function beginDrag(e: React.PointerEvent) {
    if (disabled) return;
    const el = panelRef.current;
    if (!el) return;

    dragRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: pos.x,
      startY: pos.y,
    };

    el.setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  function onPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    if (e.pointerId !== drag.pointerId) return;

    const el = panelRef.current;
    const rect = el?.getBoundingClientRect();
    const w = rect?.width ?? 320;
    const h = rect?.height ?? 260;

    const dx = e.clientX - drag.startClientX;
    const dy = e.clientY - drag.startClientY;

    const nx = clamp(drag.startX + dx, 8, window.innerWidth - w - 8);
    const ny = clamp(drag.startY + dy, 8, window.innerHeight - h - 8);

    const next = { x: nx, y: ny };
    setPos(next);
    savePos(next);
  }

  function endDrag(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    if (e.pointerId !== drag.pointerId) return;
    dragRef.current = null;
  }

  const btnBase =
    "flex items-center justify-center rounded-xl border border-zinc-700/70 bg-zinc-900/40 " +
    "hover:bg-zinc-800/60 active:bg-zinc-800/80 disabled:opacity-50 disabled:cursor-not-allowed";

  const arrowBtn = btnBase + " h-14 w-14 text-zinc-100";

  const centerBtn =
    "h-14 w-14 rounded-full border border-zinc-600/70 bg-zinc-950/30 " +
    "hover:bg-zinc-900/50 active:bg-zinc-900/70 disabled:opacity-50 disabled:cursor-not-allowed";

  const canApplyAction =
    mode === "NEXT_TURN"
      ? true
      : mode === "CONSUMABLE"
        ? canControlAction && !consumableDisabled && !!consumableName
        : mode === "REMOVE_TAG"
          ? canControlAction && !tagReduceDisabled && !!tagReduceName
        : canControlAction;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hotkeysEnabled || disabled || collapsed) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!hotkeysEnabled || disabled || collapsed) return;
      if (isEditableTarget(e.target)) {
        const el = e.target as HTMLElement | null;
        const isModeSelect =
          el?.tagName?.toUpperCase() === "SELECT" &&
          el?.dataset?.controlMode === "true";
        if (!isModeSelect) return;
      }
      if (e.metaKey || e.ctrlKey) return;
      if (!e.altKey) return;
      if (e.key !== "q" && e.key !== "Q") return;
      e.preventDefault();
      if (!canApplyAction) return;
      onAction(mode);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hotkeysEnabled, disabled, collapsed, canApplyAction, onAction, mode]);

  const amountUnusedMode =
    mode === "NEXT_TURN" ||
    mode === "ADD_TAG" ||
    mode === "ADD_DEATH_FAIL" ||
    mode === "TOGGLE_HIDDEN";
  const amountDisabled =
    disabled ||
    amountUnusedMode ||
    (mode === "REMOVE_TAG" && (tagReduceDisabled || tagReduceKind !== "stack"));
  const amountMuted =
    amountUnusedMode || (mode === "REMOVE_TAG" && tagReduceKind === "toggle");

  return (
    <div
      ref={panelRef}
      className="fixed z-40 select-none"
      style={{ left: pos.x, top: pos.y }}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div className="w-[320px] rounded-2xl border border-zinc-700/60 bg-zinc-950/70 shadow-2xl backdrop-blur-md">
        {/* Drag handle */}
        <div
          className="flex items-center justify-between gap-3 rounded-t-2xl border-b border-zinc-800/70 px-4 py-3 cursor-move touch-none"
          onPointerDown={beginDrag}
          title="드래그해서 이동"
        >
          <div className="text-sm font-semibold text-zinc-100">
            Control Panel
          </div>
          <div className="flex items-center gap-2">
            <div className="text-xs text-zinc-500">drag me</div>
            <button
              type="button"
              className="rounded-lg border border-zinc-700/70 px-2 py-1 text-[11px] text-zinc-200 hover:border-zinc-500 hover:text-zinc-50"
              onClick={(e) => {
                // Prevent drag start on button press.
                e.stopPropagation();
                setCollapsed((prev) => !prev);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              aria-expanded={!collapsed}
              title={collapsed ? "펼치기" : "접기"}
            >
              {collapsed ? "펼치기" : "접기"}
            </button>
          </div>
        </div>

        {!collapsed ? (
          <div className="p-4">
          {/* Direction pad */}
          <div className="grid grid-cols-3 grid-rows-3 gap-3 place-items-center">
            <div />
            <button
              type="button"
              className={arrowBtn}
              onClick={() => onMove(0, +1)}
              disabled={disabled || !canControlMove}
              aria-label="z +1"
              title="z +1"
            >
              ↑
            </button>
            <div />

            <button
              type="button"
              className={arrowBtn}
              onClick={() => onMove(-1, 0)}
              disabled={disabled || !canControlMove}
              aria-label="x -1"
              title="x -1"
            >
              ←
            </button>

            <button
              type="button"
              className={centerBtn + " text-xs font-semibold text-zinc-100"}
              onClick={() => onAction(mode)}
              disabled={disabled || !canApplyAction}
              aria-label={`Apply ${mode}`}
              title={`Apply: ${modeLabel}`}
            >
              ●
            </button>

            <button
              type="button"
              className={arrowBtn}
              onClick={() => onMove(+1, 0)}
              disabled={disabled || !canControlMove}
              aria-label="x +1"
              title="x +1"
            >
              →
            </button>

            <div />
            <button
              type="button"
              className={arrowBtn}
              onClick={() => onMove(0, -1)}
              disabled={disabled || !canControlMove}
              aria-label="z -1"
              title="z -1"
            >
              ↓
            </button>
            <div />
          </div>

          {/* Mode + Amount */}
          <div className="mt-4 flex items-center justify-between gap-3">
            {/* mode dropdown */}
            <div className="flex items-center gap-2">
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as ControlActionMode)}
                disabled={disabled}
                data-control-mode="true"
                className="h-9 rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-xs font-semibold text-zinc-100 outline-none focus:border-zinc-600"
                title="Action mode"
              >
                <option value="DAMAGE">데미지</option>
                <option value="HEAL">회복</option>
                <option value="NEXT_TURN">다음 턴</option>
                <option value="TEMP_HP">임체 부여</option>
                <option value="ADD_TAG">상태 부여</option>
                <option value="REMOVE_TAG">상태 감소(해제)</option>
                <option value="SPELL_SLOT">주문 슬롯</option>
                <option value="ADD_DEATH_FAIL">사망 내성 증가</option>
                <option value="TOGGLE_HIDDEN">숨겨짐 토글</option>
                <option value="CONSUMABLE">고유 소모값</option>
              </select>
            </div>

            {/* amount controller (damage/heal/slot에 사용) */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                className={[
                  btnBase,
                  "h-9 w-9",
                  amountMuted ? "text-zinc-500" : "",
                ].join(" ")}
                onClick={() => {
                  const next =
                    mode === "SPELL_SLOT"
                      ? Math.max(1, amount - 1)
                      : Math.max(0, amount - 1);
                  setAmount(next);
                }}
                disabled={amountDisabled}
                title="-1"
              >
                -
              </button>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={amountInput}
                onChange={(e) => {
                  const raw = e.target.value;
                  const filtered = raw.replace(/[^\d]/g, "");
                  setAmountInput(filtered);
                  if (filtered.trim() === "") return;
                  const parsed = Math.trunc(Number(filtered));
                  if (!Number.isFinite(parsed)) return;
                  const next =
                    mode === "SPELL_SLOT"
                      ? Math.max(1, parsed)
                      : Math.max(0, parsed);
                  setAmount(next);
                }}
                onBlur={() => {
                  if (amountInput.trim() !== "") return;
                  const next = mode === "SPELL_SLOT" ? 1 : 0;
                  setAmount(next);
                  setAmountInput(String(next));
                }}
                className={[
                  "h-9 w-16 rounded-xl border border-zinc-800 bg-zinc-950 px-2 text-sm outline-none focus:border-zinc-600",
                  amountMuted ? "text-zinc-500" : "text-zinc-100",
                ].join(" ")}
                disabled={amountDisabled}
                title="amount"
              />
              <button
                type="button"
                className={[
                  btnBase,
                  "h-9 w-9",
                  amountMuted ? "text-zinc-500" : "",
                ].join(" ")}
                onClick={() => {
                  const next =
                    mode === "SPELL_SLOT"
                      ? Math.max(1, amount + 1)
                      : amount + 1;
                  setAmount(next);
                }}
                disabled={amountDisabled}
                title="+1"
              >
                +
              </button>
            </div>
          </div>

          {mode === "REMOVE_TAG" && (
            <div className="mt-3 space-y-1">
              <div className="flex items-center gap-2">
                <select
                  value={tagReduceName}
                  onChange={(e) => setTagReduceName(e.target.value)}
                  disabled={disabled || tagReduceDisabled}
                  className={[
                    "h-9 flex-1 rounded-xl border bg-zinc-950 px-3 text-xs font-semibold text-zinc-100 outline-none focus:border-zinc-600",
                    "border-zinc-800",
                    "disabled:border-zinc-800/60 disabled:bg-zinc-900/40 disabled:text-zinc-500",
                  ].join(" ")}
                >
                  {tagReduceOptions.length === 0 ? (
                    <option value="">적용 중인 상태 없음</option>
                  ) : (
                    tagReduceOptions.map((entry) => (
                      <option key={entry.name} value={entry.name}>
                        {entry.name}
                      </option>
                    ))
                  )}
                </select>
                {tagReduceKind ? (
                  <div className="text-xs text-zinc-400">
                    {tagReduceKind === "stack" ? "스택형" : "토글형"}
                  </div>
                ) : (
                  <div className="text-xs text-zinc-500">-</div>
                )}
              </div>
              {tagReduceKind === "stack" &&
                typeof tagReduceStacks === "number" && (
                  <div className="text-[11px] text-amber-300">
                    잔여 스택: {tagReduceStacks}
                  </div>
                )}
            </div>
          )}

          {mode === "SPELL_SLOT" && (
            <div className="mt-3 flex items-center gap-2">
              <select
                value={slotLevel}
                onChange={(e) => setSlotLevel(Number(e.target.value))}
                disabled={disabled || !canControlAction}
                className="h-9 flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-xs font-semibold text-zinc-100 outline-none focus:border-zinc-600 disabled:border-zinc-800/60 disabled:bg-zinc-900/40 disabled:text-zinc-500"
              >
                {Array.from({ length: 9 }, (_, i) => i + 1).map((level) => (
                  <option key={level} value={level}>
                    {level}레벨 슬롯
                  </option>
                ))}
              </select>
              <select
                value={slotDelta}
                onChange={(e) =>
                  setSlotDelta(e.target.value as "spend" | "recover")
                }
                disabled={disabled || !canControlAction}
                className="h-9 w-24 rounded-xl border border-zinc-800 bg-zinc-950 px-2 text-xs font-semibold text-zinc-100 outline-none focus:border-zinc-600 disabled:border-zinc-800/60 disabled:bg-zinc-900/40 disabled:text-zinc-500"
              >
                <option value="spend">감소</option>
                <option value="recover">증가</option>
              </select>
            </div>
          )}

          {mode === "CONSUMABLE" && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2">
                <select
                  value={consumableName}
                  onChange={(e) => setConsumableName(e.target.value)}
                  disabled={disabled || consumableDisabled}
                  className={[
                    "h-9 flex-1 rounded-xl border bg-zinc-950 px-3 text-xs font-semibold text-zinc-100 outline-none focus:border-zinc-600",
                    "border-zinc-800",
                    "disabled:border-zinc-800/60 disabled:bg-zinc-900/40 disabled:text-zinc-500",
                  ].join(" ")}
                >
                  {consumableOptions.length === 0 ? (
                    <option value="">없음</option>
                  ) : (
                    consumableOptions.map((entry) => (
                      <option key={entry.name} value={entry.name}>
                        {entry.name}
                      </option>
                    ))
                  )}
                </select>
                <select
                  value={consumableDelta}
                  onChange={(e) =>
                    setConsumableDelta(e.target.value as "dec" | "inc")
                  }
                  disabled={disabled || consumableDisabled}
                  className={[
                    "h-9 w-24 rounded-xl border bg-zinc-950 px-2 text-xs font-semibold text-zinc-100 outline-none focus:border-zinc-600",
                    "border-zinc-800",
                    "disabled:border-zinc-800/60 disabled:bg-zinc-900/40 disabled:text-zinc-500",
                  ].join(" ")}
                >
                  <option value="dec">감소</option>
                  <option value="inc">증가</option>
                </select>
              </div>
              <div className="text-[11px] text-amber-300">
                {consumableName && consumableRemaining != null ? (
                  <>
                    {consumableName} 잔여:{" "}
                    <span className="font-semibold">{consumableRemaining}</span>
                  </>
                ) : (
                  "없음"
                )}
              </div>
            </div>
          )}
          </div>
        ) : (
          <div className="px-4 py-3 text-xs text-zinc-500">
            패널이 접혀 있음
          </div>
        )}
      </div>
    </div>
  );
}

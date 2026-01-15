// src/ControlPanel.tsx
import { useEffect, useMemo, useRef, useState } from "react";

export type ControlActionMode =
  | "DAMAGE"
  | "HEAL"
  | "NEXT_TURN"
  | "TEMP_HP"
  | "ADD_TAG"
  | "SPEND_SLOT"
  | "RECOVER_SLOT"
  | "ADD_DEATH_FAIL"
  | "TOGGLE_HIDDEN";

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
      raw === "SPEND_SLOT" ||
      raw === "RECOVER_SLOT" ||
      raw === "ADD_DEATH_FAIL" ||
      raw === "TOGGLE_HIDDEN"
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

export default function ControlPanel(props: {
  disabled?: boolean;
  canControlMove?: boolean; // selected 유닛이 있을 때 true
  canControlAction?: boolean; // damage/heal 적용 가능한지(유닛 선택 등)
  amount: number;
  setAmount: (v: number) => void;
  onMove: (dx: number, dz: number) => void;
  onAction: (mode: ControlActionMode) => void;
}) {
  const {
    disabled,
    canControlMove = true,
    canControlAction = true,
    amount,
    setAmount,
    onMove,
    onAction,
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
      case "SPEND_SLOT":
        return "Spend Slot";
      case "RECOVER_SLOT":
        return "Recover Slot";
      case "ADD_DEATH_FAIL":
        return "Death Save";
      case "TOGGLE_HIDDEN":
        return "Hide";
      case "NEXT_TURN":
        return "Next Turn";
    }
  }, [mode]);

  useEffect(() => saveMode(mode), [mode]);
  useEffect(() => saveCollapsed(collapsed), [collapsed]);

  useEffect(() => {
    if (mode === "SPEND_SLOT" || mode === "RECOVER_SLOT") {
      const next = clamp(amount, 1, 9);
      if (next !== amount) setAmount(next);
    }
  }, [mode, amount, setAmount]);

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
              disabled={disabled || (mode !== "NEXT_TURN" && !canControlAction)}
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
                className="h-9 rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-xs font-semibold text-zinc-100 outline-none focus:border-zinc-600"
                title="Action mode"
              >
                <option value="DAMAGE">데미지</option>
                <option value="HEAL">회복</option>
                <option value="NEXT_TURN">다음 턴</option>
                <option value="TEMP_HP">임체 부여</option>
                <option value="ADD_TAG">상태 부여</option>
                <option value="SPEND_SLOT">주문 슬롯 사용</option>
                <option value="RECOVER_SLOT">주문 슬롯 회복</option>
                <option value="ADD_DEATH_FAIL">사망 내성 증가</option>
                <option value="TOGGLE_HIDDEN">숨겨짐 토글</option>
              </select>
            </div>

            {/* amount controller (damage/heal/slot에 사용) */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                className={btnBase + " h-9 w-9"}
                onClick={() => {
                  const next =
                    mode === "SPEND_SLOT" || mode === "RECOVER_SLOT"
                      ? clamp(amount - 1, 1, 9)
                      : Math.max(0, amount - 1);
                  setAmount(next);
                }}
                disabled={
                  disabled ||
                  mode === "NEXT_TURN" ||
                  mode === "ADD_TAG" ||
                  mode === "ADD_DEATH_FAIL" ||
                  mode === "TOGGLE_HIDDEN"
                }
                title="-1"
              >
                -
              </button>
              <input
                type="number"
                value={amount}
                onChange={(e) => {
                  const raw = Math.trunc(Number(e.target.value));
                  const base = Number.isFinite(raw)
                    ? raw
                    : mode === "SPEND_SLOT" || mode === "RECOVER_SLOT"
                      ? 1
                      : 0;
                  const next =
                    mode === "SPEND_SLOT" || mode === "RECOVER_SLOT"
                      ? clamp(base, 1, 9)
                      : Math.max(0, base);
                  setAmount(next);
                }}
                className="h-9 w-16 rounded-xl border border-zinc-800 bg-zinc-950 px-2 text-sm text-zinc-100 outline-none focus:border-zinc-600"
                disabled={
                  disabled ||
                  mode === "NEXT_TURN" ||
                  mode === "ADD_TAG" ||
                  mode === "ADD_DEATH_FAIL" ||
                  mode === "TOGGLE_HIDDEN"
                }
                min={mode === "SPEND_SLOT" || mode === "RECOVER_SLOT" ? 1 : 0}
                max={mode === "SPEND_SLOT" || mode === "RECOVER_SLOT" ? 9 : undefined}
                step={1}
                title="amount"
              />
              <button
                type="button"
                className={btnBase + " h-9 w-9"}
                onClick={() => {
                  const next =
                    mode === "SPEND_SLOT" || mode === "RECOVER_SLOT"
                      ? clamp(amount + 1, 1, 9)
                      : amount + 1;
                  setAmount(next);
                }}
                disabled={
                  disabled ||
                  mode === "NEXT_TURN" ||
                  mode === "ADD_TAG" ||
                  mode === "ADD_DEATH_FAIL" ||
                  mode === "TOGGLE_HIDDEN"
                }
                title="+1"
              >
                +
              </button>
            </div>
          </div>

          <div className="mt-3 text-[11px] text-zinc-500">
            • 가운데 버튼: 선택된 액션 실행 • NEXT는 유닛 선택 없어도 동작
          </div>
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

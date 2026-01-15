// src/components/UnitsPanel.tsx
import { useEffect, useMemo, useState } from "react";
import type {
  CreateUnitPayload,
  Marker,
  Side,
  TurnEntry,
  Unit,
  UnitPatch,
} from "./types";
import EditUnitModal from "./EditUnitModal";
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
  const ok = (n >= 30 && n <= 37) || (n >= 90 && n <= 97) || n === 39;
  return ok ? n : undefined;
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
  onCreateUnit: (payload: CreateUnitPayload) => Promise<void> | void;
  onRemoveUnit: (unitId: string) => Promise<void> | void;
  onPatchUnit: (unitId: string, patch: UnitPatch) => Promise<void> | void;
  onEditDeathSaves: (
    unitId: string,
    success: number,
    failure: number
  ) => Promise<void> | void;
  onSetUnitPos: (unitId: string, x: number, z: number) => Promise<void> | void;
  onToggleHidden: (unitId: string) => Promise<void> | void;
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
    onCreateUnit,
    onRemoveUnit,
    onUpsertMarker,
    onRemoveMarker,
    onEditDeathSaves,
    onToggleHidden,
  } = props;

  const [createOpen, setCreateOpen] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);
  const [editUnitId, setEditUnitId] = useState<string | null>(null);
  const editUnit = editUnitId
    ? (units.find((u) => u.id === editUnitId) ?? null)
    : null;

  const [panelMode, setPanelMode] = useState<"units" | "markers">("units");
  const isMarkerMode = panelMode === "markers";

  useEffect(() => {
    if (isMarkerMode && createOpen) setCreateOpen(false);
  }, [isMarkerMode, createOpen]);

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
          "colorCode는 30~37, 90~97, 39 중 하나만 가능해. (또는 비워서 자동)"
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

  const pinnedUnit = selectedId
    ? (units.find((u) => u.id === selectedId) ?? null)
    : null;

  async function handleRemove(u: Unit) {
    const ok = window.confirm(`Remove unit: ${u.name}?`);
    if (!ok) return;
    await onRemoveUnit(u.id);
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
          onClick={() => (createOpen ? closeCreate() : openCreate())}
          disabled={busy || isMarkerMode}
          title={createOpen ? "Close Create Unit" : "Create Unit"}
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

                <option value="91">Bright Red (91)</option>
                <option value="92">Bright Green (92)</option>
                <option value="93">Bright Yellow (93)</option>
                <option value="94">Bright Blue (94)</option>
                <option value="95">Bright Magenta (95)</option>
                <option value="96">Bright Cyan (96)</option>
                <option value="97">Bright White (97)</option>
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
        className={[
          "space-y-2",
          isMarkerMode ? "hidden" : "",
        ].join(" ")}
      >
        {/* ✅ 선택된 유닛이 있으면, 맨 위에 '복제(pinned)' 카드 추가 */}
        {pinnedUnit && (
          <UnitCard
            key={`pinned-${pinnedUnit.id}`}
            unit={pinnedUnit}
            isSelected={true}
            busy={busy}
            variant="pinned"
            onSelect={() => onSelectUnit(pinnedUnit.id, { additive: false })}
            onEdit={() => setEditUnitId(pinnedUnit.id)}
            onRemove={() => handleRemove(pinnedUnit)}
            onToggleHidden={() => onToggleHidden(pinnedUnit.id)}
            hideActions={selectedIds.length > 1}
          />
        )}

        {/* ✅ 원래 목록은 그대로 유지 (원래 자리에 남겨두기) */}
        {units.map((u) => {
          const isPrimary = u.id === selectedId;
          const isMulti = selectedIds.includes(u.id);
          const multiIdx = selectedIds.indexOf(u.id); // 선택 순서 표시용(0-based)
          const isMultiMode = selectedIds.length > 1;

          return (
            <div
              key={u.id}
              className={[
                "relative rounded-xl",
                // multi 모드면 primary/secondary 모두 같은 링으로 강조
                isMultiMode && isMulti
                  ? "ring-2 ring-sky-400/60 shadow-[0_0_0_1px_rgba(56,189,248,0.20)]"
                  : "",
              ].join(" ")}
            >
              {/* ✅ secondary 선택 배지(클릭 방해 X) */}
              {isMultiMode && isMulti && (
                <div className="pointer-events-none absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-md border border-sky-600/60 bg-sky-950/70 px-2 py-1 text-[10px] font-semibold text-sky-200">
                  <span>✓{multiIdx >= 0 ? multiIdx + 1 : ""}</span>
                  {isPrimary && (
                    <span className="text-sky-100/90">primary</span>
                  )}
                </div>
              )}

              <UnitCard
                unit={u}
                isSelected={isPrimary} // 기존 규칙 유지
                busy={busy}
                variant="list"
                onSelect={(e) =>
                  onSelectUnit(u.id, {
                    additive: e.shiftKey || e.ctrlKey || e.metaKey,
                  })
                }
                onEdit={() => setEditUnitId(u.id)}
                onRemove={() => handleRemove(u)}
                onToggleHidden={() => onToggleHidden(u.id)}
                hideSide={isMultiMode && isMulti}
                hideActions={isMultiMode}
              />
            </div>
          );
        })}
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

      <EditUnitModal
        open={!!editUnit}
        unit={editUnit}
        busy={busy}
        onClose={() => setEditUnitId(null)}
        onSubmitPatch={async (unitId, patch) => {
          await props.onPatchUnit(unitId, patch);
        }}
        onSubmitDeathSaves={async (unitId, success, failure) => {
          await onEditDeathSaves(unitId, success, failure);
        }}
        onSubmitPos={async (unitId, x, z) => {
          await props.onSetUnitPos(unitId, x, z);
        }}
      />
    </section>
  );
}

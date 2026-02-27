// src/components/UnitsPanel.tsx
import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import type {
  CreateUnitPayload,
  Marker,
  Side,
  TurnEntry,
  Unit,
  UnitKind,
  UnitPatch,
  UnitPreset,
  UnitPresetFolder,
} from "./types";
import { listUnitPresets } from "./api";
import { ansiColorCodeToCss } from "./UnitColor";
import UnitCard from "./UnitCard";

type CreateUnitForm = Omit<
  CreateUnitPayload,
  "unitId" | "alias" | "colorCode" | "hpFormula"
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

function formatSpellSlots(slots?: Record<string, number>) {
  if (!slots) return "";
  const levels = Object.keys(slots)
    .map((key) => Math.trunc(Number(key)))
    .filter((lvl) => Number.isFinite(lvl) && lvl >= 1 && lvl <= 9)
    .sort((a, b) => a - b);
  if (levels.length === 0) return "";
  const maxLevel = levels[levels.length - 1];
  const parts: string[] = [];
  for (let lvl = 1; lvl <= maxLevel; lvl++) {
    const raw = (slots as any)[lvl] ?? (slots as any)[String(lvl)] ?? 0;
    parts.push(String(Math.max(0, Math.floor(Number(raw)))));
  }
  return `[${parts.join("/")}]`;
}

function formatConsumables(consumables?: Record<string, number>) {
  if (!consumables) return "";
  const entries = Object.entries(consumables)
    .map(([name, count]) => [String(name).trim(), Math.floor(Number(count))] as const)
    .filter(([name]) => name.length > 0);
  if (entries.length === 0) return "";
  return entries.map(([name, count]) => `${name} ${Math.max(0, count)}`).join(", ");
}

function formatAnsiColorName(code?: number) {
  if (typeof code !== "number") return "자동";
  if (code === 39) return "기본값";
  const map: Record<number, string> = {
    30: "회색",
    31: "빨강",
    32: "초록",
    33: "노랑",
    34: "파랑",
    35: "마젠타",
    36: "청록",
    37: "흰색",
  };
  return map[code] ?? `코드 ${code}`;
}

function extractHpFormulaParams(expr?: string) {
  if (!expr) return [];
  const out = new Set<string>();
  const regex = /\{([^}]+)\}/g;
  let match: RegExpExecArray | null = null;
  while ((match = regex.exec(expr))) {
    const name = String(match[1] ?? "").trim();
    if (name) out.add(name);
  }
  return Array.from(out);
}

function buildFormulaParamValues(
  expr: string,
  defaults: Record<string, number>,
  overrides?: Record<string, string>
) {
  const required = extractHpFormulaParams(expr);
  const allKeys = new Set<string>([
    ...required,
    ...Object.keys(defaults ?? {}),
    ...Object.keys(overrides ?? {}),
  ]);
  const params: Record<string, number> = {};

  for (const key of allKeys) {
    const raw = overrides?.[key];
    if (typeof raw === "string" && raw.trim() !== "") {
      const parsed = Number(raw);
      if (!Number.isFinite(parsed)) return null;
      params[key] = parsed;
      continue;
    }
    const fallback = defaults?.[key];
    if (typeof fallback === "number") params[key] = fallback;
  }

  const missing = required.filter((name) => params[name] === undefined);
  if (missing.length > 0) return null;
  return params;
}

function replaceFormulaParams(expr: string, params: Record<string, number>) {
  return expr.replace(/\{([^}]+)\}/g, (_raw, keyRaw) => {
    const key = String(keyRaw ?? "").trim();
    if (!key) return "0";
    const value = params[key];
    return Number.isFinite(value) ? String(value) : "0";
  });
}

function replaceDice(expr: string, kind: "min" | "max") {
  return expr.replace(/(\d*)[dD](\d+)/g, (_raw, countRaw, sidesRaw) => {
    const count = countRaw ? Number(countRaw) : 1;
    const sides = Number(sidesRaw);
    if (!Number.isFinite(count) || !Number.isFinite(sides)) return "0";
    const value = kind === "min" ? count * 1 : count * sides;
    return String(value);
  });
}

function evalFormulaExpression(expr: string): number | null {
  const prepared = expr
    .replace(/\s+/g, "")
    .replace(/\bmin\s*\(/gi, "Math.min(")
    .replace(/\bmax\s*\(/gi, "Math.max(");
  if (!/^[0-9+\-*/().,Mathinax]+$/.test(prepared)) return null;
  try {
    const value = Function(`"use strict";return (${prepared});`)();
    return Number.isFinite(value) ? Number(value) : null;
  } catch {
    return null;
  }
}

function estimateFormulaRange(
  expr: string,
  params: Record<string, number>
) {
  const resolved = replaceFormulaParams(expr, params);
  const minExpr = replaceDice(resolved, "min");
  const maxExpr = replaceDice(resolved, "max");
  const minValue = evalFormulaExpression(minExpr);
  const maxValue = evalFormulaExpression(maxExpr);
  if (minValue == null || maxValue == null) return null;
  const min = Math.min(minValue, maxValue);
  const max = Math.max(minValue, maxValue);
  return { min: Math.round(min), max: Math.round(max) };
}

function formatRangeLabel(range?: { min: number; max: number } | null) {
  if (!range) return "-";
  return `${range.min}~${range.max}`;
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
  onCreateUnitFromPreset: (payload: CreateUnitPayload, patch?: UnitPatch | null, deathSaves?: { success: number; failure: number }) => Promise<void> | void;
  onRemoveUnit: (unitId: string) => Promise<void> | void;
  onToggleHidden: (unitId: string) => Promise<void> | void;
  onViewMemo?: (unitId: string) => void;
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
  onCreateUnitFromPreset,
  onRemoveUnit,
    onUpsertMarker,
  onRemoveMarker,
  onToggleHidden,
  onViewMemo,
  onReorderUnits,
    onToggleMarkerCreate,
  } = props;

  const [createOpen, setCreateOpen] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);
  const [presetOpen, setPresetOpen] = useState(false);
  const [presetErr, setPresetErr] = useState<string | null>(null);
  const [presetLoading, setPresetLoading] = useState(false);
  const [presetFolders, setPresetFolders] = useState<UnitPresetFolder[]>([]);
  const [presetList, setPresetList] = useState<UnitPreset[]>([]);
  const [presetFolderFilter, setPresetFolderFilter] = useState<string>("ALL");
  const [presetQuery, setPresetQuery] = useState("");
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [presetQuantities, setPresetQuantities] = useState<
    Record<string, string>
  >({});
  const [presetPos, setPresetPos] = useState<{ x: number; z: number }>({
    x: 0,
    z: 0,
  });
  const [presetMasterId, setPresetMasterId] = useState("");
  const [presetFormulaParamsById, setPresetFormulaParamsById] = useState<
    Record<string, Record<string, string>>
  >({});
  const [presetHpMinById, setPresetHpMinById] = useState<Record<string, string>>(
    {}
  );
  const [presetHpMaxById, setPresetHpMaxById] = useState<Record<string, string>>(
    {}
  );

  const [panelMode, setPanelMode] = useState<"units" | "markers">("units");
  const isMarkerMode = panelMode === "markers";
  const [compactMode, setCompactMode] = useState(false);
  const [unitOrder, setUnitOrder] = useState<string[]>([]);
  const [dragUnitId, setDragUnitId] = useState<string | null>(null);
  const [overUnitId, setOverUnitId] = useState<string | null>(null);
  const [reorderPending, setReorderPending] = useState(false);
  const [unitMenu, setUnitMenu] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const unitListRef = useRef<HTMLDivElement | null>(null);
  const unitListSpacing = compactMode ? "space-y-1" : "space-y-2";

  const defaultPos = useMemo(() => {
    return selected?.pos ?? { x: 0, z: 0 };
  }, [selected?.pos]);
  const selectedPreset = useMemo(
    () => presetList.find((p) => p.id === selectedPresetId) ?? null,
    [presetList, selectedPresetId]
  );
  const presetFormulaExpr = useMemo(
    () =>
      typeof selectedPreset?.data?.hpFormula?.expr === "string"
        ? selectedPreset.data.hpFormula.expr.trim()
        : "",
    [selectedPreset?.data?.hpFormula?.expr]
  );
  const presetFormulaDefaults = useMemo(
    () => selectedPreset?.data?.hpFormula?.params ?? {},
    [selectedPreset?.data?.hpFormula?.params]
  );
  const presetFormulaParamKeys = useMemo(() => {
    if (!presetFormulaExpr) return [];
    const keys = new Set<string>();
    for (const name of extractHpFormulaParams(presetFormulaExpr)) keys.add(name);
    for (const name of Object.keys(presetFormulaDefaults)) keys.add(name);
    return Array.from(keys);
  }, [presetFormulaExpr, presetFormulaDefaults]);
  const activePresetParams = useMemo(() => {
    if (!selectedPresetId) return {};
    return presetFormulaParamsById[selectedPresetId] ?? {};
  }, [presetFormulaParamsById, selectedPresetId]);
  const activeHpMinInput = useMemo(() => {
    if (!selectedPresetId) return "";
    return presetHpMinById[selectedPresetId] ?? "";
  }, [presetHpMinById, selectedPresetId]);
  const activeHpMaxInput = useMemo(() => {
    if (!selectedPresetId) return "";
    return presetHpMaxById[selectedPresetId] ?? "";
  }, [presetHpMaxById, selectedPresetId]);
  const presetDefaultRange = useMemo(() => {
    if (!presetFormulaExpr) return null;
    const params = buildFormulaParamValues(
      presetFormulaExpr,
      presetFormulaDefaults
    );
    if (!params) return null;
    return estimateFormulaRange(presetFormulaExpr, params);
  }, [presetFormulaExpr, presetFormulaDefaults]);
  const presetDefaultClamp = useMemo(() => {
    const minRaw = selectedPreset?.data?.hpFormula?.min;
    const maxRaw = selectedPreset?.data?.hpFormula?.max;
    const min = typeof minRaw === "number" ? minRaw : undefined;
    const max = typeof maxRaw === "number" ? maxRaw : undefined;
    if (min === undefined && max === undefined) return null;
    return { min, max };
  }, [selectedPreset?.data?.hpFormula?.min, selectedPreset?.data?.hpFormula?.max]);
  const presetFolderTree = useMemo(() => {
    const byParent = new Map<string, UnitPresetFolder[]>();
    for (const folder of presetFolders) {
      const parent = folder.parentId ?? "__root__";
      const list = byParent.get(parent) ?? [];
      list.push(folder);
      byParent.set(parent, list);
    }
    for (const list of byParent.values()) {
      list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }
    const out: Array<{ folder: UnitPresetFolder; depth: number }> = [];
    const walk = (parentId: string, depth: number) => {
      const list = byParent.get(parentId) ?? [];
      for (const folder of list) {
        out.push({ folder, depth });
        walk(folder.id, depth + 1);
      }
    };
    walk("__root__", 0);
    return out;
  }, [presetFolders]);
  const filteredPresets = useMemo(() => {
    const query = presetQuery.trim().toLowerCase();
    let list = presetList;
    if (presetFolderFilter === "NONE") {
      list = list.filter((preset) => !preset.folderId);
    } else if (presetFolderFilter !== "ALL") {
      list = list.filter((preset) => (preset.folderId ?? "") === presetFolderFilter);
    }
    if (query) {
      list = list.filter((preset) => {
        const name = (preset.name ?? "").toLowerCase();
        const unitName = (preset.data?.name ?? "").toLowerCase();
        return name.includes(query) || unitName.includes(query);
      });
    }
    return [...list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [presetList, presetFolderFilter, presetQuery]);
  const presetSelectedCount = useMemo(() => {
    return presetList.reduce((sum, preset) => {
      const qty = clampInt(presetQuantities[preset.id] ?? "", 0);
      return sum + (qty > 0 ? qty : 0);
    }, 0);
  }, [presetList, presetQuantities]);
  const normalUnits = useMemo(
    () => units.filter((u) => (u.unitType ?? "NORMAL") === "NORMAL"),
    [units]
  );

  useEffect(() => {
    if (isMarkerMode && createOpen) setCreateOpen(false);
  }, [isMarkerMode, createOpen]);

  useEffect(() => {
    if (!presetOpen) return;
    setPresetPos({ x: defaultPos.x, z: defaultPos.z });
    loadPresetList().catch((e) => setPresetErr(String(e?.message ?? e)));
  }, [presetOpen, defaultPos.x, defaultPos.z]);

  useEffect(() => {
    if (!presetOpen) return;
    if (selectedPreset?.data?.unitType === "SERVANT") {
      setPresetMasterId("");
    } else {
      setPresetMasterId("");
    }
  }, [presetOpen, selectedPresetId, selected?.id, selected?.unitType, selectedPreset]);

  useEffect(() => {
    if (!presetOpen) return;
    if (!selectedPresetId) return;
    const existingParams = presetFormulaParamsById[selectedPresetId];
    const existingMin = presetHpMinById[selectedPresetId];
    const existingMax = presetHpMaxById[selectedPresetId];
    if (!presetFormulaExpr) {
      setPresetFormulaParamsById((prev) => ({
        ...prev,
        [selectedPresetId]: {},
      }));
      setPresetHpMinById((prev) => ({ ...prev, [selectedPresetId]: "" }));
      setPresetHpMaxById((prev) => ({ ...prev, [selectedPresetId]: "" }));
      return;
    }
    if (!existingParams || Object.keys(existingParams).length === 0) {
      const next: Record<string, string> = {};
      const keys = new Set<string>(presetFormulaParamKeys);
      for (const name of keys) {
        const raw = presetFormulaDefaults[name];
        next[name] = typeof raw === "number" ? String(raw) : "";
      }
      setPresetFormulaParamsById((prev) => ({
        ...prev,
        [selectedPresetId]: next,
      }));
    }
    if (existingMin === undefined) {
      const minRaw = selectedPreset?.data?.hpFormula?.min;
      setPresetHpMinById((prev) => ({
        ...prev,
        [selectedPresetId]: typeof minRaw === "number" ? String(minRaw) : "",
      }));
    }
    if (existingMax === undefined) {
      const maxRaw = selectedPreset?.data?.hpFormula?.max;
      setPresetHpMaxById((prev) => ({
        ...prev,
        [selectedPresetId]: typeof maxRaw === "number" ? String(maxRaw) : "",
      }));
    }
  }, [
    presetOpen,
    selectedPresetId,
    presetFormulaExpr,
    presetFormulaParamKeys,
    presetFormulaDefaults,
    presetFormulaParamsById,
    presetHpMinById,
    presetHpMaxById,
  ]);


  useEffect(() => {
    if (busy || dragUnitId || reorderPending) return;
    const ids = units.map((u) => u.id);
    setUnitOrder(ids);
  }, [units]);

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
    unitType: "NORMAL",
    masterUnitId: "",
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
      unitType: "NORMAL",
      masterUnitId: "",
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

  async function loadPresetList() {
    setPresetLoading(true);
    try {
      setPresetErr(null);
      const res = (await listUnitPresets()) as {
        folders: UnitPresetFolder[];
        presets: UnitPreset[];
      };
      const nextFolders = Array.isArray(res.folders) ? res.folders : [];
      const nextPresets = Array.isArray(res.presets) ? res.presets : [];
      setPresetFolders(nextFolders);
      setPresetList(nextPresets);
      setPresetFormulaParamsById((prev) => {
        const next: Record<string, Record<string, string>> = {};
        for (const preset of nextPresets) {
          next[preset.id] = prev[preset.id] ?? {};
        }
        return next;
      });
      setPresetHpMinById((prev) => {
        const next: Record<string, string> = {};
        for (const preset of nextPresets) {
          next[preset.id] = prev[preset.id] ?? "";
        }
        return next;
      });
      setPresetHpMaxById((prev) => {
        const next: Record<string, string> = {};
        for (const preset of nextPresets) {
          next[preset.id] = prev[preset.id] ?? "";
        }
        return next;
      });
      setPresetQuantities((prev) => {
        const next: Record<string, string> = {};
        for (const preset of nextPresets) {
          next[preset.id] = prev[preset.id] ?? "";
        }
        return next;
      });
      if (!selectedPresetId && nextPresets.length > 0) {
        setSelectedPresetId(nextPresets[0].id);
      }
    } catch (e: any) {
      setPresetErr(String(e?.message ?? e));
    } finally {
      setPresetLoading(false);
    }
  }

  function openPresetPicker() {
    if (busy || isMarkerMode) return;
    setPresetErr(null);
    setPresetFolderFilter("ALL");
    setPresetQuery("");
    setSelectedPresetId(null);
    setPresetQuantities({});
    setPresetFormulaParamsById({});
    setPresetHpMinById({});
    setPresetHpMaxById({});
    setPresetOpen(true);
    setCreateOpen(false);
  }

  function closePresetPicker() {
    setPresetErr(null);
    setPresetOpen(false);
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

    const unitType = (form.unitType ?? "NORMAL") as UnitKind;
    const masterUnitId = (form.masterUnitId ?? "").trim();
    if (unitType === "SERVANT") {
      if (!masterUnitId) {
        setLocalErr("서번트는 사역자를 선택해야 해.");
        return;
      }
      const master = units.find((u) => u.id === masterUnitId);
      const masterType = master?.unitType ?? "NORMAL";
      if (!master || masterType !== "NORMAL") {
        setLocalErr("사역자는 일반 유닛만 선택할 수 있어.");
        return;
      }
    }

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
      unitType,
      ...(unitType === "SERVANT" ? { masterUnitId } : {}),
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

  async function submitPresetCreate() {
    setPresetErr(null);
    const entries = presetList
      .map((preset) => ({
        preset,
        qty: clampInt(presetQuantities[preset.id] ?? "", 0),
      }))
      .filter((entry) => entry.qty > 0);

    if (entries.length === 0) {
      setPresetErr("불러올 프리셋 수량을 입력해줘.");
      return;
    }

    const needsMaster = entries.some((entry) => {
      const unitType = (entry.preset.data?.unitType ?? "NORMAL") as UnitKind;
      return unitType === "SERVANT";
    });
    const masterUnitId = presetMasterId.trim();
    if (needsMaster) {
      if (!masterUnitId) {
        setPresetErr("서번트는 사역자를 지정해야 해.");
        return;
      }
      const master = units.find((u) => u.id === masterUnitId);
      const masterType = master?.unitType ?? "NORMAL";
      if (!master || masterType !== "NORMAL") {
        setPresetErr("사역자는 일반 유닛만 선택할 수 있어.");
        return;
      }
    }

    const x = clampInt(presetPos.x, 0);
    const z = clampInt(presetPos.z, 0);

    setPresetLoading(true);
    try {
      for (const entry of entries) {
        const preset = entry.preset;
        const isSelected = preset.id === selectedPresetId;
        const data = preset.data ?? {};
        const rawPresetNote =
          typeof data.note === "string"
            ? data.note
            : typeof (data as any).memo === "string"
              ? (data as any).memo
              : typeof (preset as any).note === "string"
                ? (preset as any).note
                : "";
        const presetNote = rawPresetNote.trim();
        const unitType = (data.unitType ?? "NORMAL") as UnitKind;

        const hpMax = Math.max(0, Math.floor(Number(data.hp?.max ?? 0)));
        const acBase = Math.max(0, Math.floor(Number(data.acBase ?? 0)));
        const hpFormulaExpr =
          typeof data.hpFormula?.expr === "string"
            ? data.hpFormula.expr.trim()
            : "";
        let hpFormula: CreateUnitPayload["hpFormula"] | undefined = undefined;
        if (hpFormulaExpr) {
          const defaultParams = data.hpFormula?.params ?? {};
          const paramValues: Record<string, number> = {};
          const requiredParams = extractHpFormulaParams(hpFormulaExpr);
          const overrideSource = isSelected
            ? presetFormulaParamsById[preset.id] ?? {}
            : presetFormulaParamsById[preset.id] ?? {};
          const allKeys = new Set<string>([
            ...requiredParams,
            ...Object.keys(defaultParams),
            ...Object.keys(overrideSource),
          ]);
          for (const rawName of allKeys) {
            const name = String(rawName ?? "").trim();
            if (!name) continue;
            const rawInput = (overrideSource[name] ?? "").trim();
            if (rawInput === "") {
              const fallback = defaultParams[name];
              if (typeof fallback === "number") {
                paramValues[name] = fallback;
              }
              continue;
            }
            const parsed = Number(rawInput);
            if (!Number.isFinite(parsed)) {
              setPresetErr(`HP 공식 파라미터 "${name}" 값이 숫자가 아니야.`);
              return;
            }
            paramValues[name] = parsed;
          }
          const missing = requiredParams.filter(
            (name) => paramValues[name] === undefined
          );
          if (missing.length > 0) {
            setPresetErr(`HP 공식 파라미터가 누락됐어: ${missing.join(", ")}`);
            return;
          }
          const rawMin = (presetHpMinById[preset.id] ?? "").trim();
          const rawMax = (presetHpMaxById[preset.id] ?? "").trim();
          let minValue: number | undefined = undefined;
          let maxValue: number | undefined = undefined;
          if (rawMin) {
            const parsed = Number(rawMin);
            if (!Number.isFinite(parsed)) {
              setPresetErr("HP 공식 최소값이 숫자가 아니야.");
              return;
            }
            minValue = parsed;
          } else if (typeof data.hpFormula?.min === "number") {
            minValue = data.hpFormula.min;
          }
          if (rawMax) {
            const parsed = Number(rawMax);
            if (!Number.isFinite(parsed)) {
              setPresetErr("HP 공식 최대값이 숫자가 아니야.");
              return;
            }
            maxValue = parsed;
          } else if (typeof data.hpFormula?.max === "number") {
            maxValue = data.hpFormula.max;
          }
          hpFormula = {
            expr: hpFormulaExpr,
            ...(Object.keys(paramValues).length > 0
              ? { params: paramValues }
              : {}),
            ...(typeof minValue === "number" ? { min: minValue } : {}),
            ...(typeof maxValue === "number" ? { max: maxValue } : {}),
          };
        }

        const patch: UnitPatch = {};
        const tempValue =
          typeof data.hp?.temp === "number" ? Number(data.hp.temp) : undefined;
        if (!hpFormulaExpr && data.hp && typeof data.hp.max === "number") {
          const max = Math.max(0, Math.floor(Number(data.hp.max)));
          const cur = Math.max(0, Math.floor(Number(data.hp.cur ?? max)));
          patch.hp = {
            cur,
            max,
            ...(typeof tempValue === "number" ? { temp: tempValue } : {}),
          };
        } else if (typeof tempValue === "number") {
          patch.hp = { temp: tempValue };
        }
        if (typeof data.integrityBase === "number") {
          patch.integrity = Math.max(0, Math.floor(Number(data.integrityBase)));
        }
        if (Array.isArray(data.tags)) {
          patch.tags = { set: data.tags };
        }
        if (data.tagStates && Object.keys(data.tagStates).length > 0) {
          const nextTagStates: Record<string, any> = {};
          for (const [key, st] of Object.entries(data.tagStates)) {
            if (!st) continue;
            nextTagStates[key] = {
              stacks: Math.max(1, Math.floor(Number(st.stacks ?? 1))),
              decOnTurnStart: !!st.decOnTurnStart,
              decOnTurnEnd: !!st.decOnTurnEnd,
            };
          }
          if (Object.keys(nextTagStates).length > 0)
            patch.tagStates = nextTagStates;
        }
        if (data.spellSlots && Object.keys(data.spellSlots).length > 0) {
          patch.spellSlots = data.spellSlots as Record<number, number>;
        }
        if (data.consumables && Object.keys(data.consumables).length > 0) {
          patch.consumables = data.consumables as Record<string, number>;
        }
        if (presetNote) patch.note = presetNote;
        if (typeof data.colorCode === "number") patch.colorCode = data.colorCode;
        if (typeof data.hidden === "boolean") patch.hidden = data.hidden;
        if (typeof data.turnDisabled === "boolean") {
          patch.turnDisabled = data.turnDisabled;
        }

        const deathSaves =
          data.deathSaves &&
          (Number(data.deathSaves.success ?? 0) !== 0 ||
            Number(data.deathSaves.failure ?? -1) !== -1)
            ? {
                success: Math.max(
                  0,
                  Math.floor(Number(data.deathSaves.success ?? 0))
                ),
                failure: Math.max(
                  -1,
                  Math.floor(Number(data.deathSaves.failure ?? -1))
                ),
              }
            : undefined;

        for (let i = 0; i < entry.qty; i += 1) {
          const unitId =
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `preset_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
          const payload: CreateUnitPayload = {
            unitId,
            name: (data.name ?? preset.name ?? "유닛").trim(),
            side: (data.side ?? "TEAM") as Side,
            unitType,
            ...(unitType === "SERVANT" ? { masterUnitId } : {}),
            ...(data.alias ? { alias: data.alias } : {}),
            ...(presetNote ? { note: presetNote } : {}),
            hpMax,
            ...(hpFormula ? { hpFormula } : {}),
            acBase,
            x,
            z,
            ...(typeof data.colorCode === "number"
              ? { colorCode: data.colorCode }
              : {}),
            turnOrderIndex: turnOrderLen,
          };

          await onCreateUnitFromPreset(
            payload,
            Object.keys(patch).length > 0 ? patch : null,
            deathSaves
          );
        }
      }

      closePresetPicker();
    } finally {
      setPresetLoading(false);
    }
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

  function openUnitMenu(e: React.MouseEvent, unitId: string) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setUnitMenu({ id: unitId, x: e.clientX, y: e.clientY });
  }
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
    const ok = window.confirm(`총 1개의 유닛을 삭제합니다.`);
    if (!ok) return;
    await onRemoveUnit(u.id);
  }

  async function handleRemoveMany(unitIds: string[]) {
    if (unitIds.length === 0) return;
    const ok = window.confirm(`총 ${unitIds.length}개의 유닛을 삭제합니다.`);
    if (!ok) return;
    for (const id of unitIds) {
      await onRemoveUnit(id);
    }
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
          onContextMenu={(e) => openUnitMenu(e, u.id)}
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

        <div className="flex items-center gap-2">
          {!isMarkerMode && (
            <button
              type="button"
              onClick={openPresetPicker}
              disabled={busy}
              className="rounded-lg border border-amber-700/60 bg-amber-950/30 px-2 py-1 text-[11px] font-semibold text-amber-200 hover:bg-amber-900/40 disabled:opacity-50"
            >
              유닛 프리셋 불러오기
            </button>
          )}
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
              <label className="mb-1 block text-xs text-zinc-400">Type</label>
              <select
                value={form.unitType}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    unitType: e.target.value as UnitKind,
                    masterUnitId:
                      e.target.value === "SERVANT" ? p.masterUnitId : "",
                  }))
                }
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600"
                disabled={busy}
              >
                <option value="NORMAL">일반 유닛</option>
                <option value="SERVANT">서번트</option>
                <option value="BUILDING">건물</option>
              </select>
            </div>

            {form.unitType === "SERVANT" && (
              <div>
                <label className="mb-1 block text-xs text-zinc-400">
                  사역자
                </label>
                <select
                  value={form.masterUnitId}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, masterUnitId: e.target.value }))
                  }
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600"
                  disabled={busy}
                >
                  <option value="">선택</option>
                  {units
                    .filter((u) => (u.unitType ?? "NORMAL") === "NORMAL")
                    .map((u) => {
                      const alias = (u.alias ?? "").trim();
                      const label = alias ? `${u.name} (${alias})` : u.name;
                      return (
                        <option key={u.id} value={u.id}>
                          {label}
                        </option>
                      );
                    })}
                </select>
              </div>
            )}

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
                disabled={busy || form.unitType !== "NORMAL"}
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

      {presetOpen && !isMarkerMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-zinc-100">
                  유닛 프리셋 불러오기
                </div>
                <div className="text-xs text-zinc-500">
                  프리셋을 선택하고 초기 위치를 설정하세요.
                </div>
              </div>
              <button
                type="button"
                onClick={closePresetPicker}
                className="rounded-lg border border-zinc-800 bg-zinc-950/30 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800/60"
              >
                닫기
              </button>
            </div>

            {presetErr && (
              <div className="mb-3 whitespace-pre-line rounded-lg border border-red-900 bg-red-950/40 p-3 text-xs text-red-200">
                {presetErr}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-[220px_minmax(0,1fr)_260px]">
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
                <div className="text-xs font-semibold text-zinc-200">폴더</div>
                <div className="mt-2 max-h-60 space-y-1 overflow-auto">
                  <button
                    type="button"
                    className={[
                      "w-full rounded-md border px-2 py-1 text-left text-xs",
                      presetFolderFilter === "ALL"
                        ? "border-amber-700/70 bg-amber-950/30 text-amber-100"
                        : "border-zinc-800 bg-zinc-950/30 text-zinc-400 hover:text-zinc-200",
                    ].join(" ")}
                    onClick={() => setPresetFolderFilter("ALL")}
                    disabled={presetLoading}
                  >
                    전체
                  </button>
                  <button
                    type="button"
                    className={[
                      "w-full rounded-md border px-2 py-1 text-left text-xs",
                      presetFolderFilter === "NONE"
                        ? "border-amber-700/70 bg-amber-950/30 text-amber-100"
                        : "border-zinc-800 bg-zinc-950/30 text-zinc-400 hover:text-zinc-200",
                    ].join(" ")}
                    onClick={() => setPresetFolderFilter("NONE")}
                    disabled={presetLoading}
                  >
                    폴더 없음
                  </button>
                  {presetFolderTree.map(({ folder, depth }) => (
                    <button
                      key={folder.id}
                      type="button"
                      className={[
                        "w-full rounded-md border px-2 py-1 text-left text-xs",
                        presetFolderFilter === folder.id
                          ? "border-amber-700/70 bg-amber-950/30 text-amber-100"
                          : "border-zinc-800 bg-zinc-950/30 text-zinc-400 hover:text-zinc-200",
                      ].join(" ")}
                      style={{ paddingLeft: `${8 + depth * 12}px` }}
                      onClick={() => setPresetFolderFilter(folder.id)}
                      disabled={presetLoading}
                    >
                      {folder.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-xs font-semibold text-zinc-200">
                    프리셋
                  </div>
                  <button
                    type="button"
                    onClick={() => loadPresetList()}
                    disabled={presetLoading}
                    className="rounded-md border border-zinc-800 px-2 py-1 text-[11px] text-zinc-200 hover:bg-zinc-800/60 disabled:opacity-50"
                  >
                    새로고침
                  </button>
                </div>
                <input
                  value={presetQuery}
                  onChange={(e) => setPresetQuery(e.target.value)}
                  placeholder="프리셋 검색"
                  className="mb-2 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-zinc-600"
                />
                <div className="mb-1 flex items-center justify-between text-[10px] text-zinc-500">
                  <span>프리셋 목록</span>
                  <span className="pr-1">수량</span>
                </div>
                <div className="max-h-60 space-y-1 overflow-auto">
                  {filteredPresets.length === 0 ? (
                    <div className="rounded-md border border-zinc-800 bg-zinc-950/30 p-2 text-xs text-zinc-500">
                      표시할 프리셋이 없습니다.
                    </div>
                  ) : (
                    filteredPresets.map((preset) => (
                      <div
                        key={preset.id}
                        className="flex items-stretch gap-2"
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedPresetId(preset.id)}
                          className={[
                            "flex-1 rounded-md border px-2 py-1 text-left text-xs",
                            preset.id === selectedPresetId
                              ? "border-amber-700/70 bg-amber-950/30 text-amber-100"
                              : "border-zinc-800 bg-zinc-950/30 text-zinc-300 hover:bg-zinc-800/60",
                          ].join(" ")}
                        >
                          <div className="font-semibold">{preset.name}</div>
                          <div
                            className="text-[10px]"
                            style={
                              typeof preset.data?.colorCode === "number"
                                ? {
                                    color: ansiColorCodeToCss(
                                      preset.data.colorCode
                                    ),
                                  }
                                : undefined
                            }
                          >
                            {preset.data?.name ?? "유닛"}
                          </div>
                        </button>
                        <input
                          value={presetQuantities[preset.id] ?? ""}
                          onChange={(e) => {
                            const nextValue = e.target.value.replace(
                              /[^0-9]/g,
                              ""
                            );
                            setPresetQuantities((prev) => ({
                              ...prev,
                              [preset.id]: nextValue,
                            }));
                          }}
                          placeholder="0"
                          inputMode="numeric"
                          className="w-12 rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-right text-xs font-semibold text-amber-200 outline-none focus:border-zinc-600"
                        />
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
                <div className="text-xs font-semibold text-zinc-200">요약</div>
                {!selectedPreset ? (
                  <div className="mt-2 text-xs text-zinc-500">
                    프리셋을 선택하세요.
                  </div>
                ) : (
                  <div className="mt-2 space-y-2 text-xs text-zinc-200">
                    <div>
                      <span className="text-zinc-500">프리셋</span>
                      <span className="ml-2 font-semibold">
                        {selectedPreset.name}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-500">유닛 이름</span>
                      <span
                        className="ml-2"
                        style={
                          typeof selectedPreset.data?.colorCode === "number"
                            ? {
                                color: ansiColorCodeToCss(
                                  selectedPreset.data.colorCode
                                ),
                              }
                            : undefined
                        }
                      >
                        {selectedPreset.data?.name ?? "유닛"}
                      </span>
                    </div>
                    {selectedPreset.data?.alias ? (
                      <div>
                        <span className="text-zinc-500">별명</span>
                        <span className="ml-2">{selectedPreset.data.alias}</span>
                      </div>
                    ) : null}
                    <div>
                      <span className="text-zinc-500">진영</span>
                      <span className="ml-2">
                        {selectedPreset.data?.side ?? "TEAM"}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-500">유닛 타입</span>
                      <span className="ml-2">
                        {selectedPreset.data?.unitType ?? "NORMAL"}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-500">HP</span>
                      <span className="ml-2">
                        {selectedPreset.data?.hpFormula?.expr ? (
                          <div className="space-y-1">
                            <div>공식: {selectedPreset.data.hpFormula.expr}</div>
                            <div className="text-[11px] text-zinc-400">
                              범위(기본값): {formatRangeLabel(presetDefaultRange)}
                            </div>
                            {presetDefaultClamp ? (
                              <div className="text-[11px] text-zinc-400">
                                최소/최대:{" "}
                                {[
                                  typeof presetDefaultClamp.min === "number"
                                    ? presetDefaultClamp.min
                                    : "-",
                                  typeof presetDefaultClamp.max === "number"
                                    ? presetDefaultClamp.max
                                    : "-",
                                ].join("~")}
                              </div>
                            ) : null}
                          </div>
                        ) : selectedPreset.data?.hp ? (
                          `${selectedPreset.data.hp.cur ?? 0}/${selectedPreset.data.hp.max ?? 0}` +
                          (typeof selectedPreset.data.hp.temp === "number"
                            ? ` (+${selectedPreset.data.hp.temp})`
                            : "")
                        ) : (
                          "없음"
                        )}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-500">AC</span>
                      <span className="ml-2">
                        {typeof selectedPreset.data?.acBase === "number"
                          ? selectedPreset.data.acBase
                          : "-"}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-500">무결성</span>
                      <span className="ml-2">
                        {typeof selectedPreset.data?.integrityBase === "number"
                          ? selectedPreset.data.integrityBase
                          : "-"}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-500">사망 내성</span>
                      <span className="ml-2">
                        {selectedPreset.data?.deathSaves &&
                        ((selectedPreset.data.deathSaves.success ?? 0) !== 0 ||
                          (selectedPreset.data.deathSaves.failure ?? -1) !== -1)
                          ? `(${selectedPreset.data.deathSaves.success ?? 0}, ${selectedPreset.data.deathSaves.failure ?? -1})`
                          : "없음"}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-500">태그</span>
                      <span className="ml-2">
                        {Array.isArray(selectedPreset.data?.tags) &&
                        selectedPreset.data?.tags?.length
                          ? selectedPreset.data.tags.join(", ")
                          : "없음"}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-500">스택 태그</span>
                      <span className="ml-2">
                        {selectedPreset.data?.tagStates &&
                        Object.keys(selectedPreset.data.tagStates).length > 0
                          ? Object.keys(selectedPreset.data.tagStates).join(", ")
                          : "없음"}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-500">주문 슬롯</span>
                      <span className="ml-2">
                        {formatSpellSlots(selectedPreset.data?.spellSlots) ||
                          "없음"}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-500">고유 소모값</span>
                      <span className="ml-2">
                        {formatConsumables(selectedPreset.data?.consumables) ||
                          "없음"}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-500">컬러 코드</span>
                      <span className="ml-2">
                        {formatAnsiColorName(selectedPreset.data?.colorCode)}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-500">숨겨짐</span>
                      <span className="ml-2">
                        {selectedPreset.data?.hidden ? "예" : "아니오"}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-500">턴 비활성화</span>
                      <span className="ml-2">
                        {selectedPreset.data?.turnDisabled ? "예" : "아니오"}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
                <div className="text-xs font-semibold text-zinc-200">
                  초기 위치
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className="text-[11px] text-zinc-400">
                    x
                    <input
                      type="number"
                      value={presetPos.x}
                      onChange={(e) =>
                        setPresetPos((prev) => ({
                          ...prev,
                          x: clampInt(e.target.value, 0),
                        }))
                      }
                      className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs outline-none focus:border-zinc-600"
                    />
                  </label>
                  <label className="text-[11px] text-zinc-400">
                    z
                    <input
                      type="number"
                      value={presetPos.z}
                      onChange={(e) =>
                        setPresetPos((prev) => ({
                          ...prev,
                          z: clampInt(e.target.value, 0),
                        }))
                      }
                      className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs outline-none focus:border-zinc-600"
                    />
                  </label>
                </div>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3 md:col-span-2">
                <div className="text-xs font-semibold text-zinc-200">
                  서번트 사역자 지정
                </div>
                {selectedPreset?.data?.unitType === "SERVANT" ? (
                  <div className="mt-2">
                    <select
                      value={presetMasterId}
                      onChange={(e) => setPresetMasterId(e.target.value)}
                      className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-zinc-600"
                    >
                      <option value="">사역자 선택</option>
                      {normalUnits.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                    <div className="mt-1 text-[11px] text-zinc-500">
                      서번트는 반드시 일반 유닛을 사역자로 지정해야 해요.
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 text-xs text-zinc-500">
                    서번트 프리셋이 아닙니다.
                  </div>
                )}
              </div>
            </div>

            {presetFormulaExpr && (
            <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
              <div className="text-xs font-semibold text-zinc-200">
                HP 공식 파라미터
              </div>
              {presetFormulaParamKeys.length === 0 ? (
                <div className="mt-2 text-xs text-zinc-500">
                  파라미터 없음
                </div>
              ) : (
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {presetFormulaParamKeys.map((name) => {
                      const placeholder =
                        typeof presetFormulaDefaults[name] === "number"
                          ? `기본값 ${presetFormulaDefaults[name]}`
                          : "";
                      return (
                        <label
                          key={name}
                          className="text-[11px] text-amber-300"
                        >
                          {name}
                          <input
                            type="text"
                            inputMode="decimal"
                            value={activePresetParams[name] ?? ""}
                            placeholder={placeholder}
                            onChange={(e) =>
                              selectedPresetId
                                ? setPresetFormulaParamsById((prev) => ({
                                    ...prev,
                                    [selectedPresetId]: {
                                      ...(prev[selectedPresetId] ?? {}),
                                      [name]: e.target.value,
                                    },
                                  }))
                                : undefined
                            }
                            className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-sky-300 placeholder:text-sky-300/70 outline-none focus:border-zinc-600"
                          />
                        </label>
                      );
                    })}
                  </div>
                )}
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="text-[11px] text-red-300/80">
                    최소값
                    <input
                      type="text"
                      inputMode="decimal"
                      value={activeHpMinInput}
                      placeholder={
                        typeof selectedPreset?.data?.hpFormula?.min === "number"
                          ? `기본값 ${selectedPreset.data.hpFormula.min}`
                          : ""
                      }
                      onChange={(e) =>
                        selectedPresetId
                          ? setPresetHpMinById((prev) => ({
                              ...prev,
                              [selectedPresetId]: e.target.value,
                            }))
                          : undefined
                      }
                      className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-red-300/80 placeholder:text-red-300/60 outline-none focus:border-zinc-600"
                    />
                  </label>
                  <label className="text-[11px] text-red-300/80">
                    최대값
                    <input
                      type="text"
                      inputMode="decimal"
                      value={activeHpMaxInput}
                      placeholder={
                        typeof selectedPreset?.data?.hpFormula?.max === "number"
                          ? `기본값 ${selectedPreset.data.hpFormula.max}`
                          : ""
                      }
                      onChange={(e) =>
                        selectedPresetId
                          ? setPresetHpMaxById((prev) => ({
                              ...prev,
                              [selectedPresetId]: e.target.value,
                            }))
                          : undefined
                      }
                      className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-red-300/80 placeholder:text-red-300/60 outline-none focus:border-zinc-600"
                    />
                  </label>
                </div>
                <div className="mt-1 text-[11px] text-zinc-500">
                  빈칸이면 기본값을 사용합니다.
                </div>
              </div>
            )}

            {presetFormulaExpr && (
              <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
                <div className="text-xs font-semibold text-zinc-200">
                  현재 HP 범위
                </div>
                <div className="mt-2 text-sm text-zinc-200">
                  {formatRangeLabel(
                    estimateFormulaRange(
                      presetFormulaExpr,
                      buildFormulaParamValues(
                        presetFormulaExpr,
                        presetFormulaDefaults,
                        activePresetParams
                      ) ?? {}
                    )
                  )}
                </div>
                {(activeHpMinInput.trim() ||
                  activeHpMaxInput.trim() ||
                  typeof selectedPreset?.data?.hpFormula?.min === "number" ||
                  typeof selectedPreset?.data?.hpFormula?.max === "number") && (
                  <div className="mt-1 text-[11px] text-zinc-500">
                    수동 최소/최대 범위는 이 표시에서 제외됨
                  </div>
                )}
              </div>
            )}

            <div className="mt-4 flex items-center justify-end">
              <button
                type="button"
                onClick={submitPresetCreate}
                disabled={presetLoading || presetSelectedCount === 0}
                className="rounded-lg border border-amber-700/60 bg-amber-950/30 px-3 py-1.5 text-xs text-amber-200 hover:bg-amber-900/40 disabled:opacity-50"
              >
                불러오기
              </button>
            </div>
          </div>
        </div>
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
            onContextMenu={(e) => openUnitMenu(e, pinnedUnit.id)}
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

      {unitMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setUnitMenu(null)}
          />
          <div
            className="fixed z-50 w-44 rounded-md border border-zinc-800 bg-zinc-950 p-1 text-xs text-zinc-200 shadow-xl"
            style={{ left: unitMenu.x, top: unitMenu.y }}
          >
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-zinc-800/70"
              onClick={() => {
                const target = unitById.get(unitMenu.id);
                setUnitMenu(null);
                if (!target || busy) return;
                onViewMemo?.(target.id);
              }}
            >
              메모 확인
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-zinc-800/70"
              onClick={() => {
                const target = unitById.get(unitMenu.id);
                setUnitMenu(null);
                if (!target || busy) return;
                onToggleHidden(target.id);
              }}
            >
              숨겨짐 토글
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-zinc-800/70"
              onClick={() => {
                const target = unitById.get(unitMenu.id);
                setUnitMenu(null);
                if (!target || busy) return;
                onEditUnit(target.id);
              }}
            >
              유닛 편집
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-rose-200 hover:bg-rose-900/30"
              onClick={() => {
                const target = unitById.get(unitMenu.id);
                setUnitMenu(null);
                if (!target || busy) return;
                const ids =
                  selectedIds.length > 1 && selectedIds.includes(target.id)
                    ? selectedIds
                    : [target.id];
                handleRemoveMany(ids);
              }}
            >
              유닛 삭제
            </button>
          </div>
        </>
      )}

    </section>
  );
}


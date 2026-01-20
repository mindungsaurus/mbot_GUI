import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type {
  AuthUser,
  Side,
  TurnTagState,
  UnitKind,
  UnitPreset,
  UnitPresetData,
  UnitPresetFolder,
} from "./types";
import { ansiColorCodeToCss } from "./UnitColor";
import {
  createUnitPreset,
  createUnitPresetFolder,
  deleteUnitPreset,
  deleteUnitPresetFolder,
  listUnitPresets,
  updateUnitPreset,
  updateUnitPresetFolder,
  validateHpFormula,
} from "./api";

type EditTab = "INFO" | "STATUS" | "CONSUME" | "DEATH";

type DraftTagState = {
  stacks: number;
  decOnTurnStart?: boolean;
  decOnTurnEnd?: boolean;
};

type ConsumableDraft = { name: string; count: number };
type HpParamDraft = { id: string; name: string; value: string };

function FolderGlyph() {
  return (
    <span
      aria-hidden="true"
      className="relative inline-block h-3.5 w-4 rounded-sm border border-zinc-500/60 bg-zinc-900/40"
    >
      <span className="absolute -top-1 left-0.5 h-1.5 w-2.5 rounded-t-sm border border-zinc-500/60 bg-zinc-900/60" />
    </span>
  );
}

function normalizeTagName(raw: string) {
  return (raw ?? "").trim();
}

function uniqTags(tags: string[]) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of tags) {
    const t = normalizeTagName(raw);
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

function normalizeStacks(v: unknown, fallback = 1, min = 1) {
  const n = Math.trunc(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, n);
}

function normalizeCount(v: unknown, fallback = 0, min = 0) {
  const n = Math.trunc(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, n);
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

function buildHpParamMap(expr: string, drafts: HpParamDraft[]) {
  const required = extractHpFormulaParams(expr);
  const params: Record<string, number> = {};
  for (const entry of drafts) {
    const name = String(entry.name ?? "").trim();
    if (!name) continue;
    const raw = String(entry.value ?? "").trim();
    if (raw === "") continue;
    const num = Number(raw);
    if (!Number.isFinite(num)) return null;
    params[name] = num;
  }
  const missing = required.filter((name) => params[name] === undefined);
  if (missing.length > 0) return null;
  return params;
}

function replaceFormulaParams(expr: string, params: Record<string, number>) {
  return expr.replace(/\{([^}]+)\}/g, (_raw, keyRaw) => {
    const key = String(keyRaw ?? "").trim();
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

function estimateFormulaRange(expr: string, params: Record<string, number>) {
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

function renderHpFormulaHighlight(expr: string) {
  if (!expr) return null;
  const nodes: ReactNode[] = [];
  const regex = /\{[^}]*\}/g;
  let cursor = 0;
  let match: RegExpExecArray | null = null;
  while ((match = regex.exec(expr))) {
    if (match.index > cursor) {
      const plain = expr.slice(cursor, match.index);
      nodes.push(
        <span key={`plain-${cursor}`} className="text-zinc-200">
          {plain}
        </span>
      );
    }
    const token = match[0];
    const inner = token.slice(1, -1);
    nodes.push(
      <span key={`param-${match.index}`}>
        <span className="text-sky-300">{"{"}</span>
        <span className="text-yellow-300">{inner}</span>
        <span className="text-sky-300">{"}"}</span>
      </span>
    );
    cursor = match.index + token.length;
  }
  if (cursor < expr.length) {
    nodes.push(
      <span key={`plain-${cursor}`} className="text-zinc-200">
        {expr.slice(cursor)}
      </span>
    );
  }
  return nodes;
}

function buildEmptyPreset(): UnitPresetData {
  return {
    name: "새 유닛",
    side: "TEAM",
    unitType: "NORMAL",
    hp: { cur: 0, max: 0 },
    acBase: 10,
    tags: [],
    tagStates: {},
    spellSlots: {},
    consumables: {},
    deathSaves: { success: 0, failure: 0 },
  };
}

function buildSpellSlots(slots: number[]) {
  const desired: Record<string, number> = {};
  for (let i = 0; i < slots.length; i++) {
    desired[String(i + 1)] = normalizeCount(slots[i], 0);
  }
  return desired;
}

export default function UnitPresetManager(props: {
  authUser: AuthUser | null;
  onBack: () => void;
}) {
  const { authUser, onBack } = props;
  const [folders, setFolders] = useState<UnitPresetFolder[]>([]);
  const [presets, setPresets] = useState<UnitPreset[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [folderQuery, setFolderQuery] = useState("");
  const [presetQuery, setPresetQuery] = useState("");
  const [folderMenu, setFolderMenu] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const [dragging, setDragging] = useState<{
    type: "folder" | "preset";
    id: string;
    mode: "move" | "reorder";
  } | null>(null);
  const [folderDrop, setFolderDrop] = useState<{
    id: string | null;
    mode: "move" | "reorder";
  } | null>(null);
  const [presetDropId, setPresetDropId] = useState<string | null>(null);

  const [presetName, setPresetName] = useState("");
  const [presetFolderId, setPresetFolderId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<EditTab>("INFO");
  const [name, setName] = useState("");
  const [alias, setAlias] = useState("");
  const [side, setSide] = useState<Side>("TEAM");
  const [unitType, setUnitType] = useState<UnitKind>("NORMAL");
  const [note, setNote] = useState("");
  const [colorCode, setColorCode] = useState("");
  const [hidden, setHidden] = useState(false);
  const [turnDisabled, setTurnDisabled] = useState(false);

  const [acBase, setAcBase] = useState("");
  const [integrityBase, setIntegrityBase] = useState("");

  const [hasHp, setHasHp] = useState(true);
  const [hpCur, setHpCur] = useState("");
  const [hpMax, setHpMax] = useState("");
  const [hpTemp, setHpTemp] = useState("");
  const [hpFormulaEnabled, setHpFormulaEnabled] = useState(false);
  const [hpFormulaExpr, setHpFormulaExpr] = useState("");
  const [hpFormulaMin, setHpFormulaMin] = useState("");
  const [hpFormulaMax, setHpFormulaMax] = useState("");
  const [hpParamModalOpen, setHpParamModalOpen] = useState(false);
  const [hpParamDrafts, setHpParamDrafts] = useState<HpParamDraft[]>([]);
  const [newHpParamName, setNewHpParamName] = useState("");
  const [newHpParamValue, setNewHpParamValue] = useState("");
  const hpFormulaRef = useRef<HTMLTextAreaElement | null>(null);


  const [manualTags, setManualTags] = useState<string[]>([]);
  const [stackTags, setStackTags] = useState<Record<string, DraftTagState>>({});
  const [newTagName, setNewTagName] = useState("");
  const [newTagType, setNewTagType] = useState<"toggle" | "stack">("toggle");
  const [newTagStacks, setNewTagStacks] = useState(1);
  const [newTagDecStart, setNewTagDecStart] = useState(false);
  const [newTagDecEnd, setNewTagDecEnd] = useState(false);

  const [spellSlots, setSpellSlots] = useState<number[]>([]);
  const [deathSaveSuccess, setDeathSaveSuccess] = useState(0);
  const [deathSaveFailure, setDeathSaveFailure] = useState(0);
  const [consumables, setConsumables] = useState<ConsumableDraft[]>([]);
  const [newConsumableName, setNewConsumableName] = useState("");
  const [newConsumableCount, setNewConsumableCount] = useState(1);

  const selectedPreset = useMemo(
    () => presets.find((p) => p.id === selectedPresetId) ?? null,
    [presets, selectedPresetId]
  );
  const presetTextColor = useMemo(() => {
    const code = selectedPreset?.data?.colorCode;
    return typeof code === "number" ? ansiColorCodeToCss(code) : undefined;
  }, [selectedPreset]);
  const sideTextColor =
    side === "TEAM" ? "#60a5fa" : side === "ENEMY" ? "#f87171" : "#d1d5db";
  const unitTypeTextColor =
    unitType === "SERVANT"
      ? "#c4b5fd"
      : unitType === "BUILDING"
        ? "#bef264"
        : undefined;
  const colorCodeTextColor = colorCode.trim()
    ? ansiColorCodeToCss(Number(colorCode))
    : undefined;

  const formulaRange = useMemo(() => {
    if (!hpFormulaEnabled) return null;
    const expr = hpFormulaExpr.trim();
    if (!expr) return null;
    const params = buildHpParamMap(expr, hpParamDrafts);
    if (!params) return null;
    return estimateFormulaRange(expr, params);
  }, [hpFormulaEnabled, hpFormulaExpr, hpParamDrafts]);
  const formulaClampLabel = useMemo(() => {
    const minRaw = hpFormulaMin.trim();
    const maxRaw = hpFormulaMax.trim();
    const min = minRaw.length ? Number(minRaw) : undefined;
    const max = maxRaw.length ? Number(maxRaw) : undefined;
    if (!Number.isFinite(min) && !Number.isFinite(max)) return null;
    return [
      Number.isFinite(min) ? min : "-",
      Number.isFinite(max) ? max : "-",
    ].join("~");
  }, [hpFormulaMin, hpFormulaMax]);

  const visiblePresets = useMemo(() => {
    const query = presetQuery.trim().toLowerCase();
    const list =
      selectedFolderId === null
        ? presets
        : presets.filter((preset) => preset.folderId === selectedFolderId);
    const filtered = query
      ? list.filter((preset) => {
          const name = (preset.name ?? "").toLowerCase();
          const unitName = (preset.data?.name ?? "").toLowerCase();
          return name.includes(query) || unitName.includes(query);
        })
      : list;
    return [...filtered].sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0)
    );
  }, [presets, selectedFolderId, presetQuery]);

  const toggleTags = useMemo(
    () => manualTags.filter((t) => !stackTags[t]),
    [manualTags, stackTags]
  );
  const stackEntries = useMemo(
    () => Object.entries(stackTags),
    [stackTags]
  );
  const activeMenuFolder = useMemo(
    () => (folderMenu ? folders.find((f) => f.id === folderMenu.id) : null),
    [folderMenu, folders]
  );

  const [collapsedFolders, setCollapsedFolders] = useState<
    Record<string, boolean>
  >({});

  const folderTree = useMemo(() => {
    const byParent = new Map<string | null, UnitPresetFolder[]>();
    for (const folder of folders) {
      const parentId = folder.parentId ?? null;
      const list = byParent.get(parentId) ?? [];
      list.push(folder);
      byParent.set(parentId, list);
    }
    for (const list of byParent.values()) {
      list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }

    const query = folderQuery.trim().toLowerCase();
    const matches = (folder: UnitPresetFolder) =>
      folder.name.toLowerCase().includes(query);
    const hasMatch = (folder: UnitPresetFolder): boolean => {
      if (!query) return true;
      if (matches(folder)) return true;
      const children = byParent.get(folder.id) ?? [];
      return children.some(hasMatch);
    };

    const out: Array<{
      folder: UnitPresetFolder;
      depth: number;
      hasChildren: boolean;
      collapsed: boolean;
    }> = [];
    const walk = (parentId: string | null, depth: number) => {
      const list = byParent.get(parentId) ?? [];
      for (const folder of list) {
        if (!hasMatch(folder)) continue;
        const children = byParent.get(folder.id) ?? [];
        const collapsed = !!collapsedFolders[folder.id];
        out.push({
          folder,
          depth,
          hasChildren: children.length > 0,
          collapsed,
        });
        if (!collapsed) {
          walk(folder.id, depth + 1);
        }
      }
    };
    walk(null, 0);
    return out;
  }, [folders, folderQuery, collapsedFolders]);

  useEffect(() => {
    loadPresets().catch((e) => setErr(String(e?.message ?? e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedPreset) return;

    const data = selectedPreset.data ?? {};
    setPresetName(selectedPreset.name ?? "");
    setPresetFolderId(selectedPreset.folderId ?? null);
    setActiveTab("INFO");

    setName(data.name ?? "");
    setAlias((data.alias ?? "").toString());
    setSide((data.side ?? "TEAM") as Side);
    setUnitType((data.unitType ?? "NORMAL") as UnitKind);
    setNote((data as any).note ?? "");

    setColorCode(
      typeof (data as any).colorCode === "number"
        ? String((data as any).colorCode)
        : ""
    );

    setHidden(!!(data as any).hidden);
    setTurnDisabled(!!(data as any).turnDisabled);

    setAcBase(typeof data.acBase === "number" ? String(data.acBase) : "");
    setIntegrityBase(
      typeof (data as any).integrityBase === "number"
        ? String((data as any).integrityBase)
        : ""
    );

    const hp = data.hp;
    const hpFormula = (data as any).hpFormula;
    const formulaExpr =
      hpFormula && typeof hpFormula.expr === "string"
        ? hpFormula.expr.trim()
        : "";
    const formulaEnabled = !!formulaExpr;

    setHasHp(!!hp || formulaEnabled);
    setHpCur(hp ? String(hp.cur ?? 0) : "");
    setHpMax(hp ? String(hp.max ?? 0) : "");
    setHpTemp(hp && typeof hp.temp === "number" ? String(hp.temp) : "");

    if (formulaEnabled) {
      setHpFormulaEnabled(true);
      setHpFormulaExpr(formulaExpr);
      setHpFormulaMin(
        typeof hpFormula.min === "number" ? String(hpFormula.min) : ""
      );
      setHpFormulaMax(
        typeof hpFormula.max === "number" ? String(hpFormula.max) : ""
      );
    } else {
      setHpFormulaEnabled(false);
      setHpFormulaExpr("");
      setHpFormulaMin("");
      setHpFormulaMax("");
    }

    const paramEntries = Object.entries(
      (hpFormula?.params as Record<string, number> | undefined) ?? {}
    );
    setHpParamDrafts(
      paramEntries.map(([key, value]) => ({
        id: `${key}-${Math.random().toString(36).slice(2, 8)}`,
        name: key,
        value: Number.isFinite(value) ? String(value) : "",
      }))
    );
    setNewHpParamName("");
    setNewHpParamValue("");
    setHpParamModalOpen(false);


    const rawTags = Array.isArray(data.tags) ? data.tags : [];
    const baseTags = uniqTags(rawTags);
    const tagStates = data.tagStates ?? {};

    const nextStack: Record<string, DraftTagState> = {};
    for (const [k, st] of Object.entries(tagStates)) {
      const key = normalizeTagName(k);
      if (!key) continue;
      nextStack[key] = {
        stacks: normalizeStacks(st?.stacks ?? 1, 1),
        decOnTurnStart: !!st?.decOnTurnStart,
        decOnTurnEnd: !!st?.decOnTurnEnd,
      };
    }

    setManualTags(baseTags);
    setStackTags(nextStack);
    setNewTagName("");
    setNewTagType("toggle");
    setNewTagStacks(1);
    setNewTagDecStart(false);
    setNewTagDecEnd(false);

    const slotMap = data.spellSlots ?? {};
    const levels = Object.keys(slotMap)
      .map((k) => Math.trunc(Number(k)))
      .filter((n) => Number.isFinite(n) && n >= 1 && n <= 9)
      .sort((a, b) => a - b);
    const maxLevel = levels.length ? levels[levels.length - 1] : 0;
    const nextSlots: number[] = [];
    for (let lvl = 1; lvl <= maxLevel; lvl++) {
      const raw = (slotMap as any)[lvl] ?? (slotMap as any)[String(lvl)] ?? 0;
      nextSlots.push(normalizeCount(raw, 0));
    }
    setSpellSlots(nextSlots);

    setDeathSaveSuccess(normalizeCount(data.deathSaves?.success ?? 0, 0));
    setDeathSaveFailure(normalizeCount(data.deathSaves?.failure ?? 0, 0));

    const nextConsumables = Object.entries(data.consumables ?? {})
      .map(([raw, count]) => ({
        name: normalizeTagName(raw),
        count: normalizeCount(count, 0),
      }))
      .filter((c) => c.name.length > 0);
    setConsumables(nextConsumables);
    setNewConsumableName("");
    setNewConsumableCount(1);
  }, [selectedPresetId]);

  useEffect(() => {
    if (!hpFormulaRef.current) return;
    const el = hpFormulaRef.current;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [hpFormulaExpr, hpFormulaEnabled, selectedPresetId]);

  async function loadPresets(preferId?: string) {
    setBusy(true);
    try {
      setErr(null);
      const res = (await listUnitPresets()) as {
        folders: UnitPresetFolder[];
        presets: UnitPreset[];
      };
      setFolders(res.folders ?? []);
      setPresets(res.presets ?? []);

      const nextId = preferId ?? selectedPresetId;
      if (nextId && res.presets.some((p) => p.id === nextId)) {
        setSelectedPresetId(nextId);
      } else {
        setSelectedPresetId(res.presets[0]?.id ?? null);
      }
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  function nextFolderOrder(parentId: string | null) {
    return folders.filter((f) => (f.parentId ?? null) === parentId).length;
  }

  async function handleCreateFolder(parentId?: string | null) {
    if (busy) return;
    const name = window.prompt("폴더 이름", "새 폴더");
    if (name === null) return;
    const normalizedParent = parentId ?? null;
    setBusy(true);
    try {
      setErr(null);
      const created = (await createUnitPresetFolder({
        name,
        order: nextFolderOrder(normalizedParent),
        parentId: normalizedParent,
      })) as UnitPresetFolder;
      setFolders((prev) => [...prev, created]);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function handleRenameFolder(folder: UnitPresetFolder) {
    if (busy) return;
    const name = window.prompt("폴더 이름", folder.name ?? "");
    if (name === null) return;
    setBusy(true);
    try {
      setErr(null);
      const updated = (await updateUnitPresetFolder(folder.id, {
        name,
      })) as UnitPresetFolder;
      setFolders((prev) =>
        prev.map((f) => (f.id === folder.id ? updated : f))
      );
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteFolder(folder: UnitPresetFolder) {
    if (busy) return;
    const ok = window.confirm("이 폴더를 삭제할까요? 프리셋은 폴더에서만 해제됩니다.");
    if (!ok) return;
    setBusy(true);
    try {
      setErr(null);
      await deleteUnitPresetFolder(folder.id);
      setFolders((prev) => prev.filter((f) => f.id !== folder.id));
      setPresets((prev) =>
        prev.map((p) =>
          p.folderId === folder.id ? { ...p, folderId: null } : p
        )
      );
      if (selectedFolderId === folder.id) setSelectedFolderId(null);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function handleCreatePreset() {
    if (busy) return;
    const name = window.prompt("프리셋 이름", "새 프리셋");
    if (name === null) return;
    setBusy(true);
    try {
      setErr(null);
      const presetOrder = presets.filter(
        (preset) => (preset.folderId ?? null) === selectedFolderId
      ).length;
      const created = (await createUnitPreset({
        name,
        folderId: selectedFolderId,
        order: presetOrder,
        data: buildEmptyPreset(),
      })) as UnitPreset;
      setPresets((prev) => [created, ...prev]);
      setSelectedPresetId(created.id);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function handleDeletePreset() {
    if (!selectedPreset || busy) return;
    const ok = window.confirm("이 프리셋을 삭제할까요?");
    if (!ok) return;
    setBusy(true);
    try {
      setErr(null);
      await deleteUnitPreset(selectedPreset.id);
      setPresets((prev) => prev.filter((p) => p.id !== selectedPreset.id));
      setSelectedPresetId(null);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  function openFolderMenu(folderId: string, x: number, y: number) {
    setFolderMenu({ id: folderId, x, y });
  }

  function reorderItems<T extends { id: string }>(
    list: T[],
    draggedId: string,
    targetId: string
  ) {
    if (draggedId === targetId) return list;
    const fromIndex = list.findIndex((item) => item.id === draggedId);
    const toIndex = list.findIndex((item) => item.id === targetId);
    if (fromIndex < 0 || toIndex < 0) return list;

    const next = list.slice();
    const [dragged] = next.splice(fromIndex, 1);
    const insertIndex = fromIndex < toIndex ? toIndex : toIndex;
    next.splice(insertIndex, 0, dragged);
    return next;
  }

  async function reorderFolder(draggedId: string, targetId: string) {
    if (busy) return;
    const dragged = folders.find((f) => f.id === draggedId);
    const target = folders.find((f) => f.id === targetId);
    if (!dragged || !target) return;
    const parentId = target.parentId ?? null;
    if ((dragged.parentId ?? null) !== parentId) return;

    const siblings = folders
      .filter((f) => (f.parentId ?? null) === parentId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const next = reorderItems(siblings, draggedId, targetId).map(
      (folder, index) => ({ ...folder, order: index })
    );

    setFolders((prev) =>
      prev.map((item) => next.find((f) => f.id === item.id) ?? item)
    );

    setBusy(true);
    try {
      await Promise.all(
        next.map((folder) =>
          updateUnitPresetFolder(folder.id, { order: folder.order })
        )
      );
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function reorderPreset(draggedId: string, targetId: string) {
    if (busy) return;
    const dragged = presets.find((preset) => preset.id === draggedId);
    const target = presets.find((preset) => preset.id === targetId);
    if (!dragged || !target) return;
    const folderId = target.folderId ?? null;
    if ((dragged.folderId ?? null) !== folderId) return;
    const siblings = presets
      .filter((preset) => (preset.folderId ?? null) === folderId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const next = reorderItems(siblings, draggedId, targetId).map(
      (preset, index) => ({ ...preset, order: index })
    );

    setPresets((prev) =>
      prev.map((item) => next.find((p) => p.id === item.id) ?? item)
    );

    setBusy(true);
    try {
      await Promise.all(
        next.map((preset) =>
          updateUnitPreset(preset.id, { order: preset.order ?? 0 })
        )
      );
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  function isPresetDragEvent(e: React.DragEvent) {
    if (dragging?.type === "preset") return true;
    return Array.from(e.dataTransfer.types).includes("application/x-mbot-preset");
  }

  function getPresetDragId(e: React.DragEvent) {
    if (dragging?.type === "preset") return dragging.id;
    const raw =
      e.dataTransfer.getData("application/x-mbot-preset") ||
      e.dataTransfer.getData("text/plain");
    return raw || null;
  }

  async function movePresetToFolder(
    draggedId: string,
    folderId: string | null
  ) {
    if (busy) return;
    const dragged = presets.find((p) => p.id === draggedId);
    if (!dragged) return;
    const oldFolderId = dragged.folderId ?? null;
    if (oldFolderId === folderId) return;

    const nextOrder = presets.filter(
      (preset) => (preset.folderId ?? null) === folderId
    ).length;

    const nextPresets = presets.map((preset) =>
      preset.id === draggedId
        ? { ...preset, folderId, order: nextOrder }
        : preset
    );

    const reindex = (list: UnitPreset[]) =>
      list
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((preset, index) => ({ ...preset, order: index }));

    const updatedOld = reindex(
      nextPresets.filter((p) => (p.folderId ?? null) === oldFolderId)
    );
    const updatedNew = reindex(
      nextPresets.filter((p) => (p.folderId ?? null) === folderId)
    );

    const updates = new Map<string, UnitPreset>();
    for (const preset of [...updatedOld, ...updatedNew]) {
      updates.set(preset.id, preset);
    }

    setPresets((prev) => prev.map((p) => updates.get(p.id) ?? p));

    setBusy(true);
    try {
      await Promise.all(
        [...updates.values()].map((preset) =>
          updateUnitPreset(preset.id, {
            order: preset.order ?? 0,
            folderId: preset.folderId ?? null,
          })
        )
      );
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function handleSavePreset() {
    if (!selectedPreset || busy) return;

    const desiredManual = uniqTags(manualTags);
    const desiredStacks: Record<string, TurnTagState> = {};
    for (const [key, st] of Object.entries(stackTags)) {
      const name = normalizeTagName(key);
      if (!name) continue;
      desiredStacks[name] = {
        stacks: normalizeStacks(st?.stacks ?? 1, 1),
        decOnTurnStart: !!st?.decOnTurnStart,
        decOnTurnEnd: !!st?.decOnTurnEnd,
      };
    }

    const desiredConsumables: Record<string, number> = {};
    for (const entry of consumables) {
      const name = normalizeTagName(entry.name);
      if (!name) continue;
      if (desiredConsumables[name] !== undefined) {
        setErr("고유 소모값 이름은 중복될 수 없어.");
        return;
      }
      desiredConsumables[name] = normalizeCount(entry.count, 0);
    }

    const formulaExpr = hpFormulaExpr.trim();
    if (hpFormulaEnabled && !formulaExpr) {
      setErr("HP 공식이 비어 있어요.");
      return;
    }
    const formulaMinRaw = hpFormulaMin.trim();
    const formulaMaxRaw = hpFormulaMax.trim();
    const formulaMin = formulaMinRaw.length ? Number(formulaMinRaw) : undefined;
    const formulaMax = formulaMaxRaw.length ? Number(formulaMaxRaw) : undefined;
    if (formulaMinRaw.length && !Number.isFinite(formulaMin)) {
      setErr("HP 공식 최소값은 숫자여야 해요.");
      return;
    }
    if (formulaMaxRaw.length && !Number.isFinite(formulaMax)) {
      setErr("HP 공식 최대값은 숫자여야 해요.");
      return;
    }
    if (
      Number.isFinite(formulaMin) &&
      Number.isFinite(formulaMax) &&
      (formulaMin as number) > (formulaMax as number)
    ) {
      setErr("HP 공식 최소값은 최대값보다 클 수 없어요.");
      return;
    }

    const nextHpParams: Record<string, number> = {};
    for (const entry of hpParamDrafts) {
      const name = normalizeTagName(entry.name);
      if (!name) continue;
      if (nextHpParams[name] !== undefined) {
        setErr("HP 공식 파라미터 이름은 중복될 수 없어요.");
        return;
      }
      const raw = entry.value.trim();
      if (!raw) {
        if (hpFormulaEnabled) {
          setErr(`HP 공식 파라미터 "${name}" 값을 입력해줘.`);
          return;
        }
        continue;
      }
      const parsed = Number(raw);
      if (!Number.isFinite(parsed)) {
        setErr(`HP 공식 파라미터 "${name}" 값이 숫자가 아니야.`);
        return;
      }
      nextHpParams[name] = parsed;
    }

    const useFormula = hpFormulaEnabled && !!formulaExpr;
    if (useFormula) {
      const requiredParams = extractHpFormulaParams(formulaExpr);
      const missing = requiredParams.filter(
        (name) => nextHpParams[name] === undefined
      );
      if (missing.length > 0) {
        setErr(`HP 공식 파라미터가 누락됐어요: ${missing.join(", ")}`);
        return;
      }
    }

    const nextPresetName = presetName.trim() || "이름 없는 프리셋";
    const nextUnitName = name.trim() || "이름 없는 유닛";

    const nextData: UnitPresetData = {
      name: nextUnitName,
      side,
      unitType,
      alias: alias.trim() || undefined,
      note: note.trim() || undefined,
      colorCode: colorCode.trim() ? normalizeCount(colorCode, 0) : undefined,
      hidden,
      turnDisabled,
      acBase: acBase.trim() ? normalizeCount(acBase, 0) : undefined,
      integrityBase: integrityBase.trim()
        ? normalizeCount(integrityBase, 0)
        : undefined,
      hp: hasHp
        ? {
            cur: normalizeCount(hpCur, 0),
            max: normalizeCount(hpMax, 0),
            temp: hpTemp.trim() ? normalizeCount(hpTemp, 0) : undefined,
          }
        : undefined,
      hpFormula: useFormula
        ? {
            expr: formulaExpr,
            ...(Object.keys(nextHpParams).length > 0
              ? { params: nextHpParams }
              : {}),
            ...(Number.isFinite(formulaMin) ? { min: formulaMin } : {}),
            ...(Number.isFinite(formulaMax) ? { max: formulaMax } : {}),
          }
        : undefined,
      tags: desiredManual,
      tagStates:
        Object.keys(desiredStacks).length > 0 ? desiredStacks : undefined,
      spellSlots: spellSlots.length > 0 ? buildSpellSlots(spellSlots) : {},
      consumables:
        Object.keys(desiredConsumables).length > 0
          ? desiredConsumables
          : {},
      deathSaves:
        deathSaveSuccess || deathSaveFailure
          ? {
              success: normalizeCount(deathSaveSuccess, 0),
              failure: normalizeCount(deathSaveFailure, 0),
            }
          : undefined,
    };

    setBusy(true);
    try {
      setErr(null);
      if (useFormula) {
        await validateHpFormula({
          expr: formulaExpr,
          ...(Object.keys(nextHpParams).length > 0
            ? { params: nextHpParams }
            : {}),
          ...(Number.isFinite(formulaMin) ? { min: formulaMin } : {}),
          ...(Number.isFinite(formulaMax) ? { max: formulaMax } : {}),
        });
      }
      const updated = (await updateUnitPreset(selectedPreset.id, {
        name: nextPresetName,
        folderId: presetFolderId,
        data: nextData,
      })) as UnitPreset;
      setPresets((prev) =>
        prev.map((p) => (p.id === selectedPreset.id ? updated : p))
      );
      setPresetName(updated.name ?? nextPresetName);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  function addManualTag() {
    const next = normalizeTagName(newTagName);
    if (!next) return;
    setManualTags((prev) => uniqTags([...prev, next]));
    setNewTagName("");
  }

  function addStackTag() {
    const next = normalizeTagName(newTagName);
    if (!next) return;
    setStackTags((prev) => ({
      ...prev,
      [next]: {
        stacks: normalizeStacks(newTagStacks, 1),
        decOnTurnStart: newTagDecStart,
        decOnTurnEnd: newTagDecEnd,
      },
    }));
    setNewTagName("");
    setNewTagStacks(1);
    setNewTagDecStart(false);
    setNewTagDecEnd(false);
  }

  function removeTag(tag: string) {
    setManualTags((prev) => prev.filter((t) => t !== tag));
    setStackTags((prev) => {
      if (!prev[tag]) return prev;
      const next = { ...prev };
      delete next[tag];
      return next;
    });
  }

  function updateStackTag(name: string, patch: Partial<DraftTagState>) {
    setStackTags((prev) => ({
      ...prev,
      [name]: {
        ...(prev[name] ?? { stacks: 1 }),
        ...patch,
      },
    }));
  }

  function adjustSpellSlot(idx: number, delta: number) {
    setSpellSlots((prev) =>
      prev.map((c, i) => (i === idx ? Math.max(0, c + delta) : c))
    );
  }

  function addSpellSlotLevel() {
    setSpellSlots((prev) => {
      if (prev.length >= 9) return prev;
      return [...prev, 0];
    });
  }

  function removeSpellSlotLevel() {
    setSpellSlots((prev) => prev.slice(0, -1));
  }

  function addConsumable() {
    const name = normalizeTagName(newConsumableName);
    if (!name) return;
    setConsumables((prev) => [...prev, { name, count: newConsumableCount }]);
    setNewConsumableName("");
    setNewConsumableCount(1);
  }

  function removeConsumable(index: number) {
    setConsumables((prev) => prev.filter((_, i) => i !== index));
  }

  function updateConsumable(index: number, patch: Partial<ConsumableDraft>) {
    setConsumables((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item))
    );
  }

  function adjustDeathSave(kind: "success" | "failure", delta: number) {
    if (kind === "success") {
      setDeathSaveSuccess((prev) => Math.max(0, prev + delta));
    } else {
      setDeathSaveFailure((prev) => Math.max(0, prev + delta));
    }
  }

  const tabBtnClass = (active: boolean) =>
    [
      "rounded-lg border px-3 py-1.5 text-xs font-semibold",
      active
        ? "border-emerald-500/60 bg-emerald-950/40 text-emerald-200"
        : "border-zinc-800 bg-zinc-950/30 text-zinc-300 hover:bg-zinc-800/60",
    ].join(" ");

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-6xl p-4">
        <header className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-xl font-semibold">유닛 프리셋</div>
            <div className="text-xs text-zinc-500">
              재사용 가능한 유닛 템플릿 관리
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-300">
            {authUser ? <span>{authUser.username}</span> : null}
            <button
              type="button"
              className="rounded-md border border-zinc-800 px-2 py-1 text-xs text-zinc-200 hover:border-zinc-600"
              onClick={onBack}
              disabled={busy}
            >
              세션 목록
            </button>
          </div>
        </header>

        {err && (
          <div className="mb-4 whitespace-pre-line rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-200">
            {err}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="space-y-3">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs font-semibold text-zinc-200">
                  폴더
                </div>
                <button
                  type="button"
                  className="rounded-md border border-amber-700/60 bg-amber-950/30 px-2 py-1 text-[11px] text-amber-200 hover:bg-amber-900/40"
                  onClick={() => handleCreateFolder(null)}
                  disabled={busy}
                >
                  새 폴더
                </button>
              </div>
              <input
                value={folderQuery}
                onChange={(e) => setFolderQuery(e.target.value)}
                placeholder="폴더 검색"
                className="mb-2 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-zinc-600"
              />
              <div className="space-y-1">
                <div
                  className={[
                    "flex items-center justify-between rounded-md px-2 py-1.5 text-left text-xs",
                    selectedFolderId === null
                      ? "bg-amber-950/30 text-amber-200"
                      : "text-zinc-300 hover:bg-zinc-800/60",
                    folderDrop?.id === null ? "border border-emerald-600/60" : "border border-transparent",
                  ].join(" ")}
                  onDragOver={(e) => {
                    if (!isPresetDragEvent(e)) return;
                    e.preventDefault();
                    setFolderDrop({ id: null, mode: "move" });
                  }}
                  onDragLeave={() => {
                    if (folderDrop?.id === null) setFolderDrop(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (!isPresetDragEvent(e)) return;
                    setFolderDrop(null);
                    const draggedId = getPresetDragId(e);
                    if (!draggedId) return;
                    movePresetToFolder(draggedId, null);
                  }}
                >
                  <button
                    type="button"
                    className="flex flex-1 items-center justify-between text-left"
                    onClick={() => setSelectedFolderId(null)}
                    disabled={busy}
                  >
                    <span>전체 프리셋</span>
                    <span className="text-[10px] text-zinc-500">
                      {presets.length}
                    </span>
                  </button>
                </div>
                {folderTree.map(({ folder, depth, hasChildren, collapsed }) => {
                  const isActive = selectedFolderId === folder.id;
                  const dropMatch = folderDrop?.id === folder.id;
                  const dropMode = folderDrop?.mode ?? null;
                  const dropClass =
                    dropMatch && dropMode === "move"
                      ? "border border-emerald-600/60 bg-emerald-950/20"
                      : dropMatch && dropMode === "reorder"
                        ? "border border-amber-600/70"
                        : "border border-transparent";
                  return (
                    <div
                      key={folder.id}
                      className={[
                        "flex items-center justify-between rounded-md px-2 py-1.5 text-xs",
                        isActive
                          ? "bg-amber-950/30 text-amber-200"
                          : "text-zinc-300 hover:bg-zinc-800/60",
                        dropClass,
                      ].join(" ")}
                      style={{ paddingLeft: `${8 + depth * 12}px` }}
                      role="button"
                      tabIndex={0}
                      draggable
                      onDragStart={(e) => {
                        if (e.dataTransfer) {
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", folder.id);
                        }
                        setFolderMenu(null);
                        setDragging({
                          type: "folder",
                          id: folder.id,
                          mode: "reorder",
                        });
                      }}
                      onDragEnd={() => {
                        setDragging(null);
                        setFolderDrop(null);
                      }}
                      onClick={() => setSelectedFolderId(folder.id)}
                      onKeyDown={(e) =>
                        e.key === "Enter" && setSelectedFolderId(folder.id)
                      }
                      onContextMenu={(e) => {
                        e.preventDefault();
                        openFolderMenu(folder.id, e.clientX, e.clientY);
                      }}
                      onDragOver={(e) => {
                        if (isPresetDragEvent(e)) {
                          e.preventDefault();
                          setFolderDrop({ id: folder.id, mode: "move" });
                          return;
                        }
                        if (!dragging) return;
                        if (dragging.type !== "folder") return;
                        if (dragging.mode !== "reorder") return;
                        e.preventDefault();
                        setFolderDrop({ id: folder.id, mode: "reorder" });
                      }}
                      onDragLeave={() => {
                        if (folderDrop?.id === folder.id) setFolderDrop(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        setFolderDrop(null);
                        if (isPresetDragEvent(e)) {
                          const draggedId = getPresetDragId(e);
                          if (draggedId) movePresetToFolder(draggedId, folder.id);
                          return;
                        }
                        if (dragging?.type === "folder" && dragging.mode === "reorder") {
                          reorderFolder(dragging.id, folder.id);
                        }
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="h-5 w-5 rounded border border-zinc-800 text-[11px] text-zinc-300 hover:bg-zinc-800/60 disabled:opacity-40"
                          onClick={() =>
                            setCollapsedFolders((prev) => ({
                              ...prev,
                              [folder.id]: !prev[folder.id],
                            }))
                          }
                          disabled={!hasChildren}
                          aria-label="폴더 펼치기/접기"
                        >
                          {hasChildren ? (collapsed ? ">" : "v") : " "}
                        </button>
                        <FolderGlyph />
                        <span
                          className="cursor-grab text-[11px] text-zinc-500"
                          title="정렬"
                        >
                          ::
                        </span>
                        <span className="text-left">
                          {folder.name}
                        </span>
                      </div>
                      <div className="text-[10px] text-zinc-500" />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs font-semibold text-zinc-200">
                  프리셋
                </div>
                <button
                  type="button"
                  className="rounded-md border border-amber-700/60 bg-amber-950/30 px-2 py-1 text-[11px] text-amber-200 hover:bg-amber-900/40"
                  onClick={handleCreatePreset}
                  disabled={busy}
                >
                  새 프리셋
                </button>
              </div>
              <input
                value={presetQuery}
                onChange={(e) => setPresetQuery(e.target.value)}
                placeholder="프리셋 검색"
                className="mb-2 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-zinc-600"
              />
              {visiblePresets.length === 0 ? (
                <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3 text-xs text-zinc-500">
                  이 폴더에 프리셋이 없습니다.
                </div>
              ) : (
                <div className="space-y-1">
                  {visiblePresets.map((preset) => {
                    const isActive = preset.id === selectedPresetId;
                    const isDrop = presetDropId === preset.id;
                    const presetColor =
                      typeof preset.data?.colorCode === "number"
                        ? ansiColorCodeToCss(preset.data.colorCode)
                        : undefined;
                    return (
                      <div
                        key={preset.id}
                        className={[
                          "w-full rounded-md border px-2 py-1.5 text-left text-xs",
                          isActive
                            ? "border-amber-600/70 bg-amber-950/30 text-amber-200"
                            : "border-zinc-800 bg-zinc-950/20 text-zinc-300 hover:bg-zinc-800/60",
                          isDrop ? "ring-1 ring-amber-500/70" : "",
                        ].join(" ")}
                        onClick={() => setSelectedPresetId(preset.id)}
                        onKeyDown={(e) =>
                          e.key === "Enter" && setSelectedPresetId(preset.id)
                        }
                        role="button"
                        tabIndex={0}
                        draggable
                        onDragStart={(e) => {
                          if (e.dataTransfer) {
                            e.dataTransfer.effectAllowed = "move";
                            e.dataTransfer.setData("text/plain", preset.id);
                            e.dataTransfer.setData("application/x-mbot-preset", preset.id);
                          }
                          setDragging({
                            type: "preset",
                            id: preset.id,
                            mode: "reorder",
                          });
                        }}
                        onDragEnd={() => {
                          setDragging(null);
                          setPresetDropId(null);
                          setFolderDrop(null);
                        }}
                        onDragOver={(e) => {
                          if (!isPresetDragEvent(e)) return;
                          e.preventDefault();
                          setPresetDropId(preset.id);
                        }}
                        onDragLeave={() => {
                          if (presetDropId === preset.id) setPresetDropId(null);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (!isPresetDragEvent(e)) return;
                          setPresetDropId(null);
                          const draggedId = getPresetDragId(e);
                          if (!draggedId) return;
                          reorderPreset(draggedId, preset.id);
                        }}
                      >
                        <div
                          className="font-semibold"
                          style={presetColor ? { color: presetColor } : undefined}
                        >
                          {preset.name}
                        </div>
                        <div className="text-[10px] text-zinc-500">
                          {preset.data?.name ?? "유닛"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>

          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-zinc-100">
                  프리셋 편집
                </div>
                <div className="text-xs text-zinc-500">
                  유닛 기본 필드를 편집하고 저장합니다.
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800/60 disabled:opacity-50"
                  onClick={() => loadPresets(selectedPresetId ?? undefined)}
                  disabled={busy}
                >
                  새로고침
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-amber-700/60 bg-amber-950/30 px-3 py-1.5 text-xs text-amber-200 hover:bg-amber-900/40 disabled:opacity-50"
                  onClick={handleSavePreset}
                  disabled={busy || !selectedPreset}
                >
                  저장
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-rose-700/60 bg-rose-950/30 px-3 py-1.5 text-xs text-rose-200 hover:bg-rose-900/40 disabled:opacity-50"
                  onClick={handleDeletePreset}
                  disabled={busy || !selectedPreset}
                >
                  삭제
                </button>
              </div>
            </div>

            {!selectedPreset ? (
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4 text-sm text-zinc-500">
                편집할 프리셋을 선택하세요.
              </div>
            ) : (
              <>
                <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs text-zinc-400">
                      프리셋 이름
                    </label>
                    <input
                      value={presetName}
                      onChange={(e) => setPresetName(e.target.value)}
                      disabled={busy}
                      style={presetTextColor ? { color: presetTextColor } : undefined}
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-zinc-400">
                      폴더
                    </label>
                    <select
                      value={presetFolderId ?? ""}
                      onChange={(e) => setPresetFolderId(e.target.value || null)}
                      disabled={busy}
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600"
                    >
                      <option value="">(폴더 없음)</option>
                      {folders.map((folder) => (
                        <option key={folder.id} value={folder.id}>
                          {folder.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mb-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab("INFO")}
                    className={tabBtnClass(activeTab === "INFO")}
                    disabled={busy}
                  >
                    정보
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("STATUS")}
                    className={tabBtnClass(activeTab === "STATUS")}
                    disabled={busy}
                  >
                    상태 관리
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("DEATH")}
                    className={tabBtnClass(activeTab === "DEATH")}
                    disabled={busy}
                  >
                    사망 내성
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("CONSUME")}
                    className={tabBtnClass(activeTab === "CONSUME")}
                    disabled={busy}
                  >
                    고유 소모값
                  </button>
                </div>

                {activeTab === "INFO" && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs text-zinc-400">
                        유닛 이름
                      </label>
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={busy}
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-zinc-400">
                        별명
                      </label>
                      <input
                        value={alias}
                        onChange={(e) => setAlias(e.target.value)}
                        disabled={busy}
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-zinc-400">
                        진영
                      </label>
                      <select
                        value={side}
                        onChange={(e) => setSide(e.target.value as Side)}
                        disabled={busy}
                        style={sideTextColor ? { color: sideTextColor } : undefined}
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600"
                      >
                        <option value="TEAM" style={{ color: "#60a5fa" }}>
                          팀
                        </option>
                        <option value="ENEMY" style={{ color: "#f87171" }}>
                          적
                        </option>
                        <option value="NEUTRAL" style={{ color: "#d1d5db" }}>
                          중립
                        </option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-zinc-400">
                        유닛 타입
                      </label>
                      <select
                        value={unitType}
                        onChange={(e) => setUnitType(e.target.value as UnitKind)}
                        disabled={busy}
                        style={
                          unitTypeTextColor
                            ? { color: unitTypeTextColor }
                            : undefined
                        }
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600"
                      >
                        <option value="NORMAL">일반</option>
                        <option value="SERVANT" style={{ color: "#c4b5fd" }}>
                          서번트
                        </option>
                        <option value="BUILDING" style={{ color: "#bef264" }}>
                          건물
                        </option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-zinc-400">
                        컬러 코드
                      </label>
                      <select
                        value={colorCode}
                        onChange={(e) => setColorCode(e.target.value)}
                        disabled={busy}
                        style={
                          colorCodeTextColor
                            ? { color: colorCodeTextColor }
                            : undefined
                        }
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600"
                      >
                        <option value="">자동</option>
                        <option value="39">기본값 (39)</option>
                        <option value="31" style={{ color: ansiColorCodeToCss(31) }}>
                          빨강 (31)
                        </option>
                        <option value="32" style={{ color: ansiColorCodeToCss(32) }}>
                          초록 (32)
                        </option>
                        <option value="33" style={{ color: ansiColorCodeToCss(33) }}>
                          노랑 (33)
                        </option>
                        <option value="34" style={{ color: ansiColorCodeToCss(34) }}>
                          파랑 (34)
                        </option>
                        <option value="35" style={{ color: ansiColorCodeToCss(35) }}>
                          마젠타 (35)
                        </option>
                        <option value="36" style={{ color: ansiColorCodeToCss(36) }}>
                          청록 (36)
                        </option>
                        <option value="37" style={{ color: ansiColorCodeToCss(37) }}>
                          흰색 (37)
                        </option>
                        <option value="30" style={{ color: ansiColorCodeToCss(30) }}>
                          회색 (30)
                        </option>
                      </select>
                    </div>
                    

                    <div className="md:col-span-2 grid grid-cols-1 gap-3 md:grid-cols-[2.2fr_0.8fr]">
                      <div className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-3">
                        <div className="mb-2 text-xs font-semibold text-rose-300">
                          HP
                        </div>
                      <label className="mb-2 flex items-center gap-2 text-xs text-zinc-400">
                        <input
                          type="checkbox"
                          checked={hasHp}
                          onChange={(e) => {
                            const next = e.target.checked;
                            setHasHp(next);
                            if (!next) setHpFormulaEnabled(false);
                          }}
                          disabled={busy}
                        />
                        HP 사용
                      </label>
                      <label className="mb-2 flex items-center gap-2 text-xs text-zinc-400">
                        <input
                          type="checkbox"
                          checked={hpFormulaEnabled}
                          onChange={(e) => {
                            const next = e.target.checked;
                            setHpFormulaEnabled(next);
                            if (next && !hasHp) setHasHp(true);
                          }}
                          disabled={busy || !hasHp}
                        />
                        공식형 HP 사용
                      </label>
                        {hpFormulaEnabled && hasHp && (
                          <div className="mb-2 rounded-lg border border-zinc-800/70 bg-zinc-950/60 p-2">
                            <label className="text-[11px] text-zinc-400">
                              HP 공식
                            </label>
                            <div className="relative mt-1">
                            <div className="pointer-events-none absolute inset-0 whitespace-pre-wrap break-words rounded-md px-2 py-1 text-base leading-7 text-zinc-200">
                              {renderHpFormulaHighlight(hpFormulaExpr)}
                            </div>
                            <textarea
                              ref={hpFormulaRef}
                              rows={2}
                              value={hpFormulaExpr}
                              onChange={(e) => setHpFormulaExpr(e.target.value)}
                              onInput={(e) => {
                                const el = e.currentTarget;
                                el.style.height = "auto";
                                el.style.height = `${el.scrollHeight}px`;
                              }}
                              disabled={busy}
                              placeholder="예: (4D4 * {건강 보정} + 20) * {난이도 보정}"
                              style={{ minHeight: "3.5rem" }}
                              className="relative w-full resize-none overflow-hidden rounded-md border border-zinc-800 bg-transparent px-2 py-1 text-base leading-7 text-transparent caret-amber-200 outline-none focus:border-zinc-600 placeholder:text-zinc-600"
                            />
                          </div>
                            <div className="mt-2 grid grid-cols-2 gap-2">
                              <label className="text-[11px] text-rose-300">
                                최소값
                                <input
                                  type="number"
                                  value={hpFormulaMin}
                                  onChange={(e) => setHpFormulaMin(e.target.value)}
                                  disabled={busy}
                                  className="mt-1 w-full rounded-md border border-rose-900/40 bg-zinc-950 px-2 py-1 text-xs text-rose-200 outline-none focus:border-rose-700/60"
                                />
                              </label>
                              <label className="text-[11px] text-rose-300">
                                최대값
                                <input
                                  type="number"
                                  value={hpFormulaMax}
                                  onChange={(e) => setHpFormulaMax(e.target.value)}
                                  disabled={busy}
                                  className="mt-1 w-full rounded-md border border-rose-900/40 bg-zinc-950 px-2 py-1 text-xs text-rose-200 outline-none focus:border-rose-700/60"
                                />
                              </label>
                            </div>
                            <div className="mt-2 space-y-1 text-[11px] text-zinc-500">
                              <div>범위: {formatRangeLabel(formulaRange)}</div>
                              {formulaClampLabel ? (
                                <div>최소/최대: {formulaClampLabel}</div>
                              ) : null}
                            </div>
                            <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-zinc-500">
                              <span>공식 파라미터는 별도 모달에서 관리해요.</span>
                              <button
                                type="button"
                                onClick={() => setHpParamModalOpen(true)}
                              disabled={busy}
                              className="rounded-md border border-zinc-700 px-2 py-1 text-[11px] text-zinc-200 hover:bg-zinc-800/60"
                            >
                              매개변수 관리
                            </button>
                          </div>
                        </div>
                      )}
                      <div className="grid grid-cols-3 gap-2">
                        <label
                          className={[
                            "text-[11px]",
                            hpFormulaEnabled ? "text-zinc-500" : "text-rose-300",
                          ].join(" ")}
                        >
                          현재
                          <input
                            type="number"
                            min={0}
                            value={hpCur}
                            onChange={(e) => setHpCur(e.target.value)}
                            disabled={busy || !hasHp || hpFormulaEnabled}
                            className={[
                              "mt-1 w-full rounded-lg bg-zinc-950 px-2 py-1 text-xs outline-none",
                              hpFormulaEnabled
                                ? "border border-zinc-800/60 text-zinc-500"
                                : "border border-rose-900/40 text-rose-200 focus:border-rose-700/60",
                            ].join(" ")}
                          />
                        </label>
                        <label
                          className={[
                            "text-[11px]",
                            hpFormulaEnabled ? "text-zinc-500" : "text-rose-300",
                          ].join(" ")}
                        >
                          최대
                          <input
                            type="number"
                            min={0}
                            value={hpMax}
                            onChange={(e) => setHpMax(e.target.value)}
                            disabled={busy || !hasHp || hpFormulaEnabled}
                            className={[
                              "mt-1 w-full rounded-lg bg-zinc-950 px-2 py-1 text-xs outline-none",
                              hpFormulaEnabled
                                ? "border border-zinc-800/60 text-zinc-500"
                                : "border border-rose-900/40 text-rose-200 focus:border-rose-700/60",
                            ].join(" ")}
                          />
                        </label>
                        <label className="text-[11px] text-emerald-300">
                          임시
                          <input
                            type="number"
                            min={0}
                            value={hpTemp}
                            onChange={(e) => setHpTemp(e.target.value)}
                            disabled={busy || !hasHp}
                            className="mt-1 w-full rounded-lg border border-emerald-900/40 bg-zinc-950 px-2 py-1 text-xs text-emerald-200 outline-none focus:border-emerald-700/60"
                          />
                        </label>
                      </div>
                      </div>

                      <div className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-3">
                        <div className="mb-2 text-xs font-semibold text-zinc-200">
                          기본 능력치
                        </div>
                        <div className="space-y-2">
                          <label className="text-[11px] text-zinc-400">
                            <span className="text-yellow-300">AC</span>
                            <input
                              type="number"
                              min={0}
                              value={acBase}
                              onChange={(e) => setAcBase(e.target.value)}
                              disabled={busy}
                              className="mt-1 w-full rounded-lg border border-yellow-900/40 bg-zinc-950 px-2 py-1 text-xs text-yellow-200 outline-none focus:border-yellow-700/60"
                            />
                          </label>
                          <label className="text-[11px] text-purple-300">
                            무결성
                            <input
                              type="number"
                              min={0}
                              value={integrityBase}
                              onChange={(e) => setIntegrityBase(e.target.value)}
                              disabled={busy}
                              className="mt-1 w-full rounded-lg border border-purple-900/40 bg-zinc-950 px-2 py-1 text-xs text-purple-200 outline-none focus:border-purple-700/60"
                            />
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-3 md:col-span-2">
                      <div className="mb-2 text-xs font-semibold text-zinc-200">
                        상태 플래그
                      </div>
                      <label className="mb-2 flex items-center gap-2 text-xs text-zinc-400">
                        <input
                          type="checkbox"
                          checked={hidden}
                          onChange={(e) => setHidden(e.target.checked)}
                          disabled={busy}
                        />
                        숨겨짐
                      </label>
                      <label className="mb-2 flex items-center gap-2 text-xs text-zinc-400">
                        <input
                          type="checkbox"
                          checked={turnDisabled}
                          onChange={(e) => setTurnDisabled(e.target.checked)}
                          disabled={busy}
                        />
                        턴 비활성화
                      </label>
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-xs text-zinc-400">메모</label>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      disabled={busy}
                      rows={12}
                      spellCheck={false}
                      autoCorrect="off"
                      autoCapitalize="off"
                      className="min-h-[220px] w-full resize-y rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm leading-6 outline-none focus:border-zinc-600"
                    />
                  </div>
                </div>

                )}

                {activeTab === "STATUS" && (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-3">
                      <div className="mb-2 text-sm font-semibold text-zinc-200">
                        태그 (토글형)
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {toggleTags.map((tag) => (
                          <span
                            key={`toggle-${tag}`}
                            className="inline-flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-950/60 px-2 py-0.5 text-xs text-zinc-200"
                          >
                            {tag}
                            <button
                              type="button"
                              className="text-zinc-400 hover:text-zinc-200"
                              onClick={() => removeTag(tag)}
                              disabled={busy}
                              aria-label={`태그 제거: ${tag}`}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                        {toggleTags.length === 0 && (
                          <span className="text-xs text-zinc-500">
                            토글형 태그 없음.
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-3">
                      <div className="mb-2 text-sm font-semibold text-zinc-200">
                        태그 (스택형)
                      </div>
                      {stackEntries.length === 0 ? (
                        <div className="text-xs text-zinc-500">
                          스택형 태그 없음.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {stackEntries.map(([tag, st]) => (
                            <div
                              key={`stack-${tag}`}
                              className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-2 text-xs text-zinc-200"
                            >
                              <div className="flex items-center justify-between">
                                <div className="font-semibold">{tag}</div>
                                <button
                                  type="button"
                                  className="text-zinc-400 hover:text-zinc-200"
                                  onClick={() => removeTag(tag)}
                                  disabled={busy}
                                >
                                  제거
                                </button>
                              </div>
                              <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
                                <label className="text-xs text-zinc-400">
                                  스택
                                  <input
                                    type="number"
                                    min={1}
                                    value={st.stacks}
                                    onChange={(e) =>
                                      updateStackTag(tag, {
                                        stacks: normalizeStacks(
                                          e.target.value,
                                          1
                                        ),
                                      })
                                    }
                                    disabled={busy}
                                    className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs outline-none focus:border-zinc-600"
                                  />
                                </label>
                                <label className="flex items-center gap-2 text-xs text-zinc-400">
                                  <input
                                    type="checkbox"
                                    checked={!!st.decOnTurnStart}
                                    onChange={(e) =>
                                      updateStackTag(tag, {
                                        decOnTurnStart: e.target.checked,
                                      })
                                    }
                                    disabled={busy}
                                  />
                                  턴 시작 시 감소
                                </label>
                                <label className="flex items-center gap-2 text-xs text-zinc-400">
                                  <input
                                    type="checkbox"
                                    checked={!!st.decOnTurnEnd}
                                    onChange={(e) =>
                                      updateStackTag(tag, {
                                        decOnTurnEnd: e.target.checked,
                                      })
                                    }
                                    disabled={busy}
                                  />
                                  턴 종료 시 감소
                                </label>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-3">
                      <div className="mb-2 text-sm font-semibold text-zinc-200">
                        태그 추가
                      </div>
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
                        <input
                          value={newTagName}
                          onChange={(e) => setNewTagName(e.target.value)}
                          disabled={busy}
                          placeholder="태그 이름"
                          className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600 md:col-span-2"
                        />
                        <select
                          value={newTagType}
                          onChange={(e) =>
                            setNewTagType(e.target.value as "toggle" | "stack")
                          }
                          disabled={busy}
                          className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600"
                        >
                          <option value="toggle">토글형</option>
                          <option value="stack">스택형</option>
                        </select>
                        <button
                          type="button"
                          onClick={
                            newTagType === "stack" ? addStackTag : addManualTag
                          }
                          disabled={busy}
                          className="rounded-lg border border-amber-700/60 bg-amber-950/30 px-3 py-2 text-xs text-amber-200 hover:bg-amber-900/40"
                        >
                          추가
                        </button>
                      </div>
                      {newTagType === "stack" && (
                        <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
                          <label className="text-xs text-zinc-400">
                            스택
                            <input
                              type="number"
                              min={1}
                              value={newTagStacks}
                              onChange={(e) =>
                                setNewTagStacks(
                                  normalizeStacks(e.target.value, 1)
                                )
                              }
                              disabled={busy}
                              className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs outline-none focus:border-zinc-600"
                            />
                          </label>
                          <label className="flex items-center gap-2 text-xs text-zinc-400">
                            <input
                              type="checkbox"
                              checked={newTagDecStart}
                              onChange={(e) =>
                                setNewTagDecStart(e.target.checked)
                              }
                              disabled={busy}
                            />
                            턴 시작 시 감소
                          </label>
                          <label className="flex items-center gap-2 text-xs text-zinc-400">
                            <input
                              type="checkbox"
                              checked={newTagDecEnd}
                              onChange={(e) => setNewTagDecEnd(e.target.checked)}
                              disabled={busy}
                            />
                            턴 종료 시 감소
                          </label>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === "DEATH" && (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-3">
                      <div className="mb-2 text-sm font-semibold text-zinc-200">
                        사망 내성
                      </div>
                      <div className="flex flex-nowrap items-start gap-4">
                        <div className="flex flex-col items-center gap-1">
                          <div className="text-[11px] text-sky-300">
                            성공
                          </div>
                          <div className="w-14 rounded-md border border-zinc-800 bg-zinc-950/40 px-1 py-1">
                            <div className="flex flex-col items-center gap-1">
                              <button
                                type="button"
                                onClick={() => adjustDeathSave("success", 1)}
                                disabled={busy}
                                className="w-7 rounded border border-zinc-700 bg-zinc-950/40 py-0.5 text-[11px] text-zinc-200 hover:bg-zinc-800/60"
                                aria-label="사망 내성 성공 +1"
                              >
                                +
                              </button>
                              <div className="w-7 rounded border border-zinc-800 bg-zinc-950 px-1 py-0.5 text-center text-[11px] text-zinc-100">
                                {deathSaveSuccess}
                              </div>
                              <button
                                type="button"
                                onClick={() => adjustDeathSave("success", -1)}
                                disabled={busy}
                                className="w-7 rounded border border-zinc-700 bg-zinc-950/40 py-0.5 text-[11px] text-zinc-200 hover:bg-zinc-800/60"
                                aria-label="사망 내성 성공 -1"
                              >
                                -
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col items-center gap-1">
                          <div className="text-[11px] text-rose-300">
                            실패
                          </div>
                          <div className="w-14 rounded-md border border-zinc-800 bg-zinc-950/40 px-1 py-1">
                            <div className="flex flex-col items-center gap-1">
                              <button
                                type="button"
                                onClick={() => adjustDeathSave("failure", 1)}
                                disabled={busy}
                                className="w-7 rounded border border-zinc-700 bg-zinc-950/40 py-0.5 text-[11px] text-zinc-200 hover:bg-zinc-800/60"
                                aria-label="사망 내성 실패 +1"
                              >
                                +
                              </button>
                              <div className="w-7 rounded border border-zinc-800 bg-zinc-950 px-1 py-0.5 text-center text-[11px] text-zinc-100">
                                {deathSaveFailure}
                              </div>
                              <button
                                type="button"
                                onClick={() => adjustDeathSave("failure", -1)}
                                disabled={busy}
                                className="w-7 rounded border border-zinc-700 bg-zinc-950/40 py-0.5 text-[11px] text-zinc-200 hover:bg-zinc-800/60"
                                aria-label="사망 내성 실패 -1"
                              >
                                -
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "CONSUME" && (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-3">
                      <div className="mb-2 text-sm font-semibold text-zinc-200">
                        주문 슬롯
                      </div>
                      {spellSlots.length === 0 ? (
                        <div className="text-xs text-zinc-500">
                          레벨을 추가해 주문 슬롯을 관리하세요.
                        </div>
                      ) : (
                        <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1">
                          {spellSlots.map((count, idx) => {
                            const level = idx + 1;
                            return (
                              <div
                                key={`slot-${level}`}
                                className="shrink-0 flex flex-col items-center gap-1"
                              >
                                <div className="text-[11px] text-sky-300 text-center">
                                  {level}레벨
                                </div>
                                <div className="w-12 rounded-md border border-zinc-800 bg-zinc-950/40 px-1 py-1">
                                  <div className="flex flex-col items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => adjustSpellSlot(idx, 1)}
                                      disabled={busy}
                                      className="w-7 rounded border border-zinc-700 bg-zinc-950/40 py-0.5 text-[11px] text-zinc-200 hover:bg-zinc-800/60"
                                    >
                                      +
                                    </button>
                                    <div className="w-7 rounded border border-zinc-800 bg-zinc-950 px-1 py-0.5 text-center text-[11px] text-zinc-100">
                                      {count}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => adjustSpellSlot(idx, -1)}
                                      disabled={busy}
                                      className="w-7 rounded border border-zinc-700 bg-zinc-950/40 py-0.5 text-[11px] text-zinc-200 hover:bg-zinc-800/60"
                                    >
                                      -
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={addSpellSlotLevel}
                          disabled={busy || spellSlots.length >= 9}
                          className="rounded-lg border border-amber-700/60 bg-amber-950/30 px-3 py-1.5 text-xs text-amber-200 hover:bg-amber-900/40 disabled:opacity-50"
                        >
                          레벨 추가
                        </button>
                        <button
                          type="button"
                          onClick={removeSpellSlotLevel}
                          disabled={busy || spellSlots.length === 0}
                          className="rounded-lg border border-zinc-800 bg-zinc-950/30 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800/60 disabled:opacity-50"
                        >
                          최고 레벨 제거
                        </button>
                      </div>
                    </div>

                    <div className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-3">
                      <div className="mb-2 text-sm font-semibold text-zinc-200">
                        고유 소모값
                      </div>
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                        <div className="md:col-span-2">
                          <label className="mb-1 block text-xs text-zinc-400">
                            이름
                          </label>
                          <input
                            value={newConsumableName}
                            onChange={(e) => setNewConsumableName(e.target.value)}
                            disabled={busy}
                            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-zinc-400">
                            수량
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={String(newConsumableCount)}
                            onChange={(e) =>
                              setNewConsumableCount(
                                normalizeCount(e.target.value, 0)
                              )
                            }
                            disabled={busy}
                            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600"
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={addConsumable}
                        disabled={busy}
                        className="mt-3 rounded-lg border border-amber-700/60 bg-amber-950/30 px-3 py-1.5 text-xs text-amber-200 hover:bg-amber-900/40"
                      >
                        고유 소모값 추가
                      </button>

                      {consumables.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {consumables.map((entry, idx) => (
                            <div
                              key={`consumable-${idx}`}
                              className="grid grid-cols-1 gap-2 rounded-lg border border-zinc-800 bg-zinc-950/40 p-2 md:grid-cols-[1fr_120px_60px]"
                            >
                              <input
                                value={entry.name}
                                onChange={(e) =>
                                  updateConsumable(idx, { name: e.target.value })
                                }
                                disabled={busy}
                                className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs outline-none focus:border-zinc-600"
                              />
                              <input
                                type="number"
                                min={0}
                                value={String(entry.count)}
                                onChange={(e) =>
                                  updateConsumable(idx, {
                                    count: normalizeCount(e.target.value, 0),
                                  })
                                }
                                disabled={busy}
                                className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs outline-none focus:border-zinc-600"
                              />
                              <button
                                type="button"
                                onClick={() => removeConsumable(idx)}
                                disabled={busy}
                                className="rounded-md border border-zinc-800 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800/60"
                              >
                                제거
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>
      {hpParamModalOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60"
            onClick={() => setHpParamModalOpen(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-950 p-4 shadow-2xl">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-semibold text-zinc-200">
                  HP 공식 파라미터
                </div>
                <button
                  type="button"
                  onClick={() => setHpParamModalOpen(false)}
                  className="rounded-md border border-zinc-800 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800/60"
                >
                  닫기
                </button>
              </div>
              {hpFormulaExpr.trim() ? (
                <div className="mb-3 flex flex-wrap items-start gap-2 text-[11px]">
                  <div className="min-w-[220px] flex-1 text-zinc-500">
                    <span>공식: </span>
                    <span className="whitespace-pre-wrap break-words">
                      {renderHpFormulaHighlight(hpFormulaExpr.trim())}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const names = extractHpFormulaParams(
                        hpFormulaExpr.trim()
                      );
                      if (names.length === 0) {
                        setHpParamDrafts([]);
                        return;
                      }
                      setHpParamDrafts((prev) => {
                        const byName = new Map(
                          prev.map((item) => [
                            normalizeTagName(item.name),
                            item,
                          ])
                        );
                        return names.map((name, idx) => {
                          const existing = byName.get(name);
                          return {
                            id:
                              existing?.id ??
                              `param_${Date.now()}_${idx}`,
                            name,
                            value: existing?.value ?? "",
                          };
                        });
                      });
                    }}
                    disabled={busy}
                    className="shrink-0 whitespace-nowrap rounded-md border border-amber-700/60 bg-amber-950/40 px-2 py-1 text-[11px] text-amber-200 hover:bg-amber-900/40"
                  >
                    공식 기준 자동 정리
                  </button>
                </div>
              ) : (
                <div className="mb-3 text-[11px] text-zinc-500">
                  HP 공식이 비어 있습니다.
                </div>
              )}

              <div className="space-y-2">
                {hpParamDrafts.length === 0 ? (
                  <div className="rounded-md border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-500">
                    등록된 매개변수가 없습니다.
                  </div>
                ) : (
                  hpParamDrafts.map((param) => (
                    <div
                      key={param.id}
                      className="grid grid-cols-[1fr_120px_auto] gap-2"
                    >
                      <input
                        value={param.name}
                        onChange={(e) =>
                          setHpParamDrafts((prev) =>
                            prev.map((item) =>
                              item.id === param.id
                                ? { ...item, name: e.target.value }
                                : item
                            )
                          )
                        }
                        placeholder="이름"
                        className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-zinc-600"
                      />
                      <input
                        type="text"
                        inputMode="decimal"
                        value={param.value}
                        onChange={(e) =>
                          setHpParamDrafts((prev) =>
                            prev.map((item) =>
                              item.id === param.id
                                ? { ...item, value: e.target.value }
                                : item
                            )
                          )
                        }
                        placeholder="값"
                        className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-zinc-600"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setHpParamDrafts((prev) =>
                            prev.filter((item) => item.id !== param.id)
                          )
                        }
                        className="rounded-md border border-zinc-800 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800/60"
                      >
                        삭제
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
                <div className="mb-2 text-xs font-semibold text-zinc-200">
                  새 매개변수 추가
                </div>
                <div className="grid grid-cols-[1fr_120px_auto] gap-2">
                  <input
                    value={newHpParamName}
                    onChange={(e) => setNewHpParamName(e.target.value)}
                    placeholder="이름"
                    className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-zinc-600"
                  />
                      <input
                        type="text"
                        inputMode="decimal"
                        value={newHpParamValue}
                    onChange={(e) => setNewHpParamValue(e.target.value)}
                    placeholder="값"
                    className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-zinc-600"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const name = normalizeTagName(newHpParamName);
                      if (!name) return;
                      setHpParamDrafts((prev) => [
                        ...prev,
                        {
                          id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                          name,
                          value: newHpParamValue.trim(),
                        },
                      ]);
                      setNewHpParamName("");
                      setNewHpParamValue("");
                    }}
                    className="rounded-md border border-amber-700/60 bg-amber-950/30 px-2 py-1 text-xs text-amber-200 hover:bg-amber-900/40"
                  >
                    추가
                  </button>
                </div>
                {hpFormulaExpr.trim() ? (
                  <div className="mt-2 text-[11px] text-zinc-500">
                    공식에 포함된 변수:{" "}
                    {extractHpFormulaParams(hpFormulaExpr.trim()).join(", ") ||
                      "없음"}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </>
      )}
      {folderMenu && activeMenuFolder && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setFolderMenu(null)}
          />
          <div
            className="fixed z-50 w-44 rounded-md border border-zinc-800 bg-zinc-950 p-1 text-xs text-zinc-200 shadow-xl"
            style={{ left: folderMenu.x, top: folderMenu.y }}
          >
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-zinc-800/70"
              onClick={() => {
                setFolderMenu(null);
                handleCreateFolder(activeMenuFolder.id);
              }}
            >
              하위 폴더 생성
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-zinc-800/70"
              onClick={() => {
                setFolderMenu(null);
                handleRenameFolder(activeMenuFolder);
              }}
            >
              이름 변경
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-rose-200 hover:bg-rose-900/30"
              onClick={() => {
                setFolderMenu(null);
                handleDeleteFolder(activeMenuFolder);
              }}
            >
              삭제
            </button>
          </div>
        </>
      )}
    </div>
  );
}

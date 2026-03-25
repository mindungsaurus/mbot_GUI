import type {
  BuildingExecutionRule,
  BuildingPlacementRule,
  BuildingRuleAction,
  BuildingRuleComparisonOp,
  BuildingRuleExpr,
  BuildingRulePredicate,
  CityGlobalState,
  CityPopulationState,
  HexOrientation,
  MapTileRegionState,
  MapTileStateAssignment,
  MapTileStatePreset,
  PopulationId,
  PopulationTrackedId,
  UpkeepPopulationId,
  WorldMapBuildingInstanceRow,
  WorldMapBuildingPresetRow,
  WorldMap,
} from "../types";
import { API_BASE } from "../api";
export type Draft = {
  name: string;
  hexSize: string;
  originX: string;
  originY: string;
  cols: string;
  rows: string;
  orientation: HexOrientation;
};

export type SelectedHex = { col: number; row: number } | null;
export type ViewMode = "scroll" | "drag";
export type SettingsTab = "map" | "city";
export type PresetMode = "tile" | "building";
export type TileStatesByMap = Record<string, Record<string, MapTileStateAssignment[]>>;
export type TilePresetsByMap = Record<string, MapTileStatePreset[]>;
export type TileRegionStatesByMap = Record<string, Record<string, MapTileRegionState>>;
export type BuildingPresetsByMap = Record<string, WorldMapBuildingPresetRow[]>;
export type BuildingInstancesByMap = Record<string, WorldMapBuildingInstanceRow[]>;
export type ImageViewportBounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};
export const LEGACY_ANSI_TO_HEX: Record<number, string> = {
  30: "#9ca3af",
  31: "#ef4444",
  32: "#22c55e",
  33: "#eab308",
  34: "#3b82f6",
  35: "#a855f7",
  36: "#06b6d4",
  37: "#e5e7eb",
  90: "#9ca3af",
  91: "#f87171",
  92: "#4ade80",
  93: "#fde047",
  94: "#60a5fa",
  95: "#c084fc",
  96: "#22d3ee",
  97: "#f9fafb",
};

export const CAPPED_RESOURCE_IDS = ["wood", "stone", "fabric", "weave", "food"] as const;
export const UNCAPPED_RESOURCE_IDS = ["research", "order", "gold"] as const;
export const ALL_RESOURCE_IDS = [...CAPPED_RESOURCE_IDS, ...UNCAPPED_RESOURCE_IDS] as const;
export const BUILDING_PRESET_RESOURCE_IDS = ALL_RESOURCE_IDS.filter(
  (id) => id !== "research"
) as ResourceId[];
export const TRACKED_POPULATION_IDS = ["settlers", "engineers", "scholars", "laborers"] as const;
export const ALL_POPULATION_IDS = [...TRACKED_POPULATION_IDS, "elderly"] as const;
export const UPKEEP_POPULATION_IDS = [...ALL_POPULATION_IDS, "anyNonElderly"] as const;

export type CappedResourceId = (typeof CAPPED_RESOURCE_IDS)[number];
export type ResourceId = (typeof ALL_RESOURCE_IDS)[number];
export type BuildingResourceId = ResourceId | `item:${string}`;

export const RESOURCE_LABELS: Record<ResourceId, string> = {
  wood: "나무",
  stone: "석재",
  fabric: "직물",
  weave: "위브",
  food: "식량",
  research: "연구",
  order: "질서",
  gold: "금",
};

export const RESOURCE_EMOJIS: Record<ResourceId, string> = {
  wood: "🪵",
  stone: "🪨",
  fabric: "🧵",
  weave: "✨",
  food: "🍽️",
  research: "📘",
  order: "⚖️",
  gold: "🪙",
};

export function isBaseResourceId(value: unknown): value is ResourceId {
  return typeof value === "string" && (ALL_RESOURCE_IDS as readonly string[]).includes(value);
}

export function isBuildingResourceId(value: unknown): value is BuildingResourceId {
  if (isBaseResourceId(value)) return true;
  if (typeof value !== "string") return false;
  if (!value.startsWith("item:")) return false;
  return value.slice(5).trim().length > 0;
}

export function getItemNameFromBuildingResourceId(resourceId: BuildingResourceId): string | null {
  if (typeof resourceId !== "string" || !resourceId.startsWith("item:")) return null;
  const name = resourceId.slice(5).trim();
  return name.length > 0 ? name : null;
}

export function getBuildingResourceLabel(resourceId: BuildingResourceId): string {
  if (isBaseResourceId(resourceId)) return RESOURCE_LABELS[resourceId];
  const itemName = getItemNameFromBuildingResourceId(resourceId);
  return itemName ?? String(resourceId);
}

export const POPULATION_LABELS: Record<PopulationId, string> = {
  settlers: "정착민",
  engineers: "기술자",
  scholars: "학자",
  laborers: "역꾼",
  elderly: "노약자",
};

export const UPKEEP_POPULATION_LABELS: Record<UpkeepPopulationId, string> = {
  ...POPULATION_LABELS,
  anyNonElderly: "노약자를 제외한 아무나",
};

export const POPULATION_EMOJIS: Record<PopulationId, string> = {
  settlers: "🏠",
  engineers: "🛠️",
  scholars: "📚",
  laborers: "🛺",
  elderly: "🧓",
};

export const EMPTY_STATE_BADGES: Array<{ text: string; color: string }> = [];

export type ResourceCostDraft = Partial<Record<BuildingResourceId, string>>;
export type PopulationCostDraft = Partial<Record<UpkeepPopulationId, string>>;
export type WorkerAssignmentDraft = Record<PopulationTrackedId, string>;

export const EMPTY_WORKER_ASSIGNMENT_DRAFT: WorkerAssignmentDraft = {
  settlers: "0",
  engineers: "0",
  scholars: "0",
  laborers: "0",
};

export type BuildingDraftState = {
  id: string | null;
  name: string;
  color: string;
  tier: string;
  effort: string;
  space: string;
  description: string;
  placementRules: BuildingPlacementRule[];
  buildCost: ResourceCostDraft;
  upkeepResources: ResourceCostDraft;
  upkeepPopulation: PopulationCostDraft;
  onBuild: BuildingExecutionRule[];
  daily: BuildingExecutionRule[];
  onRemove: BuildingExecutionRule[];
};

export function createDefaultPopulationState(): CityPopulationState {
  return {
    settlers: { total: 0, available: 0 },
    engineers: { total: 0, available: 0 },
    scholars: { total: 0, available: 0 },
    laborers: { total: 0, available: 0 },
    elderly: { total: 0, available: 0 },
  };
}

export function createDefaultCityGlobalState(): CityGlobalState {
  return {
    values: {
      wood: 0,
      stone: 0,
      fabric: 0,
      weave: 0,
      food: 0,
      research: 0,
      order: 0,
      gold: 0,
    },
    caps: {
      wood: 100,
      stone: 100,
      fabric: 100,
      weave: 100,
      food: 100,
    },
    overflowToGold: {
      wood: 0,
      stone: 0,
      fabric: 0,
      weave: 0,
      food: 0,
    },
    warehouse: {},
    day: 0,
    satisfaction: 0,
    populationCap: 0,
    population: createDefaultPopulationState(),
  };
}

export function normalizeCityGlobalState(input?: Partial<CityGlobalState> | null): CityGlobalState {
  const base = createDefaultCityGlobalState();
  const values = (input?.values ?? {}) as Partial<CityGlobalState["values"]>;
  const caps = (input?.caps ?? {}) as Partial<CityGlobalState["caps"]>;
  const overflowToGold = (input?.overflowToGold ?? {}) as Partial<CityGlobalState["overflowToGold"]>;
  const warehouse = (input?.warehouse ?? {}) as Record<string, unknown>;
  const population = (input?.population ?? {}) as Partial<CityGlobalState["population"]>;
  const normalizeInt = (value: unknown, fallback: number) => {
    const n = Math.trunc(Number(value));
    return Number.isFinite(n) ? Math.max(0, n) : fallback;
  };
  const normalizePercent = (value: unknown, fallback: number) => {
    const n = Math.trunc(Number(value));
    if (!Number.isFinite(n)) return fallback;
    return Math.max(0, Math.min(100, n));
  };
  const nextPopulation = createDefaultPopulationState();
  for (const id of TRACKED_POPULATION_IDS) {
    const entry = (population[id] ?? {}) as Partial<CityPopulationState[PopulationTrackedId]>;
    const total = normalizeInt(entry.total, 0);
    const hasAvailable = Object.prototype.hasOwnProperty.call(entry, "available");
    nextPopulation[id] = {
      total,
      // 레거시 데이터 호환: available이 아예 없던 데이터는 total을 기본 가용치로 본다.
      available: hasAvailable ? normalizeInt(entry.available, total) : total,
    };
  }
  const elderlyEntry = (population.elderly ?? {}) as Partial<CityPopulationState["elderly"]>;
  const elderlyTotal = normalizeInt(elderlyEntry.total, 0);
  const hasElderlyAvailable = Object.prototype.hasOwnProperty.call(elderlyEntry, "available");
  nextPopulation.elderly = {
    total: elderlyTotal,
    // 레거시 데이터 호환: available이 아예 없던 데이터는 total을 기본 가용치로 본다.
    available: hasElderlyAvailable
      ? normalizeInt(elderlyEntry.available, elderlyTotal)
      : elderlyTotal,
  };
  for (const id of TRACKED_POPULATION_IDS) {
    if ((nextPopulation[id].available ?? 0) > nextPopulation[id].total) {
      nextPopulation[id].available = nextPopulation[id].total;
    }
  }
  if ((nextPopulation.elderly.available ?? 0) > nextPopulation.elderly.total) {
    nextPopulation.elderly.available = nextPopulation.elderly.total;
  }
  const totalPopulation =
    TRACKED_POPULATION_IDS.reduce((sum, id) => sum + (nextPopulation[id].total ?? 0), 0) +
    (nextPopulation.elderly.total ?? 0);
  const populationCap = Math.max(
    totalPopulation,
    normalizeInt(input?.populationCap, totalPopulation)
  );
  const nextWarehouse: Record<string, number> = {};
  for (const [rawKey, rawValue] of Object.entries(warehouse)) {
    const itemName = String(rawKey ?? "").trim();
    if (!itemName) continue;
    const qty = normalizeInt(rawValue, 0);
    if (qty <= 0) continue;
    nextWarehouse[itemName] = qty;
  }
  return {
    values: {
      wood: normalizeInt(values.wood, base.values.wood),
      stone: normalizeInt(values.stone, base.values.stone),
      fabric: normalizeInt(values.fabric, base.values.fabric),
      weave: normalizeInt(values.weave, base.values.weave),
      food: normalizeInt(values.food, base.values.food),
      research: normalizeInt(values.research, base.values.research),
      order: normalizeInt(values.order, base.values.order),
      gold: normalizeInt(values.gold, base.values.gold),
    },
    caps: {
      wood: normalizeInt(caps.wood, base.caps.wood),
      stone: normalizeInt(caps.stone, base.caps.stone),
      fabric: normalizeInt(caps.fabric, base.caps.fabric),
      weave: normalizeInt(caps.weave, base.caps.weave),
      food: normalizeInt(caps.food, base.caps.food),
    },
    overflowToGold: {
      wood: normalizeInt(overflowToGold.wood, base.overflowToGold.wood),
      stone: normalizeInt(overflowToGold.stone, base.overflowToGold.stone),
      fabric: normalizeInt(overflowToGold.fabric, base.overflowToGold.fabric),
      weave: normalizeInt(overflowToGold.weave, base.overflowToGold.weave),
      food: normalizeInt(overflowToGold.food, base.overflowToGold.food),
    },
    warehouse: nextWarehouse,
    day: normalizeInt(input?.day, base.day),
    satisfaction: normalizePercent(input?.satisfaction, base.satisfaction),
    populationCap,
    population: nextPopulation,
  };
}

export const DEFAULT_DRAFT: Draft = {
  name: "",
  hexSize: "64",
  originX: "0",
  originY: "0",
  cols: "30",
  rows: "30",
  orientation: "pointy",
};

export function resolveImageUrl(url?: string | null) {
  if (!url) return "";
  return new URL(url, API_BASE).toString();
}

export function buildDraft(map: WorldMap | null): Draft {
  if (!map) return DEFAULT_DRAFT;
  return {
    name: map.name,
    hexSize: String(map.hexSize),
    originX: String(map.originX),
    originY: String(map.originY),
    cols: String(map.cols),
    rows: String(map.rows),
    orientation: map.orientation,
  };
}

export function pointyHexPoints(cx: number, cy: number, size: number) {
  const points: Array<[number, number]> = [];
  for (let i = 0; i < 6; i += 1) {
    const angle = ((60 * i - 30) * Math.PI) / 180;
    points.push([cx + size * Math.cos(angle), cy + size * Math.sin(angle)]);
  }
  return points.map(([x, y]) => `${x},${y}`).join(" ");
}

export function flatHexPoints(cx: number, cy: number, size: number) {
  const points: Array<[number, number]> = [];
  for (let i = 0; i < 6; i += 1) {
    const angle = ((60 * i) * Math.PI) / 180;
    points.push([cx + size * Math.cos(angle), cy + size * Math.sin(angle)]);
  }
  return points.map(([x, y]) => `${x},${y}`).join(" ");
}

export function getHexLayout(
  orientation: HexOrientation,
  col: number,
  row: number,
  size: number,
  originX: number,
  originY: number
) {
  if (orientation === "flat") {
    const width = size * 2;
    const height = Math.sqrt(3) * size;
    const cx = originX + size + col * (width * 0.75);
    const cy = originY + height / 2 + row * height + (col % 2 ? height / 2 : 0);
    return { cx, cy, points: flatHexPoints(cx, cy, size) };
  }

  const width = Math.sqrt(3) * size;
  const height = size * 2;
  const cx = originX + width / 2 + col * width + (row % 2 ? width / 2 : 0);
  const cy = originY + size + row * (height * 0.75);
  return { cx, cy, points: pointyHexPoints(cx, cy, size) };
}

export function tileKey(col: number, row: number) {
  return `${col}:${row}`;
}

export function parseHexColor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw) return null;

  const six = raw.match(/^#?([0-9a-fA-F]{6})$/);
  if (six) return `#${six[1].toLowerCase()}`;

  const three = raw.match(/^#?([0-9a-fA-F]{3})$/);
  if (three) {
    const [r, g, b] = three[1].split("");
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return null;
}

export function legacyAnsiToHex(value: unknown): string | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return LEGACY_ANSI_TO_HEX[Math.floor(n)] ?? null;
}

export function normalizeHexColor(value: unknown, fallback = "#e5e7eb") {
  return parseHexColor(value) ?? fallback;
}

export function normalizeTilePresets(raw: unknown): MapTileStatePreset[] {
  if (!Array.isArray(raw)) return [];
  const out: MapTileStatePreset[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    const item = entry as
      | (Partial<MapTileStatePreset> & { colorCode?: unknown })
      | null
      | undefined;
    const id = String(item?.id ?? "").trim();
    const name = String(item?.name ?? "").trim();
    if (!id || !name || seen.has(id)) continue;
    const color =
      parseHexColor(item?.color) ??
      parseHexColor(item?.colorCode) ??
      legacyAnsiToHex(item?.colorCode) ??
      "#e5e7eb";
    seen.add(id);
    out.push({
      id,
      name,
      color,
      hasValue: !!item?.hasValue,
    });
  }
  return out;
}

export function normalizeTileStateAssignments(raw: unknown) {
  const src = raw as Record<string, unknown>;
  if (!src || typeof src !== "object") return {} as Record<string, MapTileStateAssignment[]>;
  const out: Record<string, MapTileStateAssignment[]> = {};
  for (const [key, value] of Object.entries(src)) {
    if (!Array.isArray(value)) continue;
    const next: MapTileStateAssignment[] = [];
    for (const item of value) {
      const cast = item as Partial<MapTileStateAssignment> | null | undefined;
      const presetId = String(cast?.presetId ?? "").trim();
      if (!presetId) continue;
      const assignment: MapTileStateAssignment = { presetId };
      if (cast?.value != null) assignment.value = String(cast.value);
      next.push(assignment);
    }
    if (next.length > 0) out[key] = next;
  }
  return out;
}

export function normalizeTileRegionStates(raw: unknown) {
  const src = raw as Record<string, unknown>;
  if (!src || typeof src !== "object") return {} as Record<string, MapTileRegionState>;
  const out: Record<string, MapTileRegionState> = {};
  const parseNum = (value: unknown) => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : undefined;
  };
  for (const [key, value] of Object.entries(src)) {
    if (!value || typeof value !== "object") continue;
    const cast = value as Partial<MapTileRegionState>;
    const next: MapTileRegionState = {
      spaceUsed: parseNum(cast.spaceUsed),
      spaceCap: parseNum(cast.spaceCap),
      threat: parseNum(cast.threat),
      pollution: parseNum(cast.pollution),
    };
    const hasAny =
      next.spaceUsed != null ||
      next.spaceCap != null ||
      next.threat != null ||
      next.pollution != null;
    if (hasAny) out[key] = next;
  }
  return out;
}

export function isTrackedPopulationId(value: unknown): value is PopulationTrackedId {
  return typeof value === "string" && TRACKED_POPULATION_IDS.includes(value as PopulationTrackedId);
}

export function normalizeRuleExpr(input: unknown, fallback = 0): BuildingRuleExpr {
  const cast = input as Partial<BuildingRuleExpr> | null | undefined;
  if (cast && typeof cast === "object" && typeof cast.kind === "string") {
    return cast as BuildingRuleExpr;
  }
  return { kind: "const", value: fallback };
}

export function normalizeExecutionAction(raw: unknown): BuildingRuleAction {
  const cast = raw as Partial<BuildingRuleAction> | null | undefined;
  const kind = cast?.kind;
  const normalizeActionTarget = () => {
    const target: "self" | "range" = (cast as any)?.target === "range" ? "range" : "self";
    const distance = Math.max(0, Math.trunc(Number((cast as any)?.distance ?? 1) || 0));
    return target === "range" ? { target, distance } : { target };
  };
  if (kind === "adjustResource") {
    const rawResourceId = (cast as any)?.resourceId;
    const resourceId: BuildingResourceId = isBuildingResourceId(rawResourceId)
      ? (rawResourceId as BuildingResourceId)
      : "gold";
    return {
      kind,
      resourceId,
      delta: normalizeRuleExpr((cast as any)?.delta, 0),
    };
  }
  if (kind === "adjustResourceCap") {
    const cappedIds: readonly CappedResourceId[] = CAPPED_RESOURCE_IDS;
    const resourceId: CappedResourceId =
      typeof (cast as any)?.resourceId === "string" &&
      cappedIds.includes((cast as any).resourceId as CappedResourceId)
        ? ((cast as any).resourceId as CappedResourceId)
        : "wood";
    return {
      kind,
      resourceId,
      delta: normalizeRuleExpr((cast as any)?.delta, 0),
    };
  }
  if (kind === "adjustPopulation") {
    const populationId = isTrackedPopulationId((cast as any)?.populationId)
      ? ((cast as any).populationId as PopulationTrackedId)
      : "settlers";
    const field = (cast as any)?.field === "total" ? "total" : "available";
    return {
      kind,
      populationId,
      field,
      delta: normalizeRuleExpr((cast as any)?.delta, 0),
    };
  }
  if (kind === "adjustPopulationCap") {
    return {
      kind,
      delta: normalizeRuleExpr((cast as any)?.delta, 0),
    };
  }
  if (kind === "convertPopulation") {
    const from = isTrackedPopulationId((cast as any)?.from)
      ? ((cast as any).from as PopulationTrackedId)
      : "settlers";
    const to = isTrackedPopulationId((cast as any)?.to)
      ? ((cast as any).to as PopulationTrackedId)
      : "laborers";
    return {
      kind,
      from,
      to,
      amount: normalizeRuleExpr((cast as any)?.amount, 1),
    };
  }
  if (kind === "adjustTileRegion") {
    const field = (cast as any)?.field;
    const normalizedField: keyof MapTileRegionState =
      field === "spaceUsed" ||
      field === "spaceCap" ||
      field === "threat" ||
      field === "pollution"
        ? field
        : "threat";
    return {
      kind,
      field: normalizedField,
      delta: normalizeRuleExpr((cast as any)?.delta, 0),
      ...normalizeActionTarget(),
    };
  }
  if (kind === "addTileState") {
    return {
      kind,
      tagPresetId: String((cast as any)?.tagPresetId ?? "").trim(),
      value:
        (cast as any)?.value == null ? undefined : String((cast as any)?.value ?? "").trim(),
      ...normalizeActionTarget(),
    };
  }
  if (kind === "removeTileState") {
    return {
      kind,
      tagPresetId: String((cast as any)?.tagPresetId ?? "").trim(),
      ...normalizeActionTarget(),
    };
  }
  return {
    kind: "adjustResource",
    resourceId: "gold",
    delta: { kind: "const", value: 0 },
  };
}

export function normalizeExecutionRules(raw: unknown, withInterval = false): BuildingExecutionRule[] {
  if (!Array.isArray(raw)) return [];
  const out: BuildingExecutionRule[] = [];
  for (const entry of raw) {
    const cast = entry as Partial<BuildingExecutionRule> | null | undefined;
    const actionsRaw = Array.isArray(cast?.actions) ? cast!.actions : [];
    const actions = actionsRaw.map((action) => normalizeExecutionAction(action));
    const intervalParsed = Math.trunc(Number(cast?.intervalDays));
    const intervalDays =
      withInterval && Number.isFinite(intervalParsed)
        ? Math.max(1, intervalParsed)
        : withInterval
          ? 1
          : undefined;
    out.push({
      id: String(cast?.id ?? "").trim() || makeLocalId(),
      intervalDays,
      when:
        cast?.when && typeof cast.when === "object"
          ? (cast.when as BuildingRulePredicate)
          : undefined,
      actions: actions.length > 0 ? actions : [normalizeExecutionAction(null)],
    });
  }
  return out;
}

export function normalizePlacementRules(raw: unknown): BuildingPlacementRule[] {
  if (!Array.isArray(raw)) return [];
  const out: BuildingPlacementRule[] = [];
  for (const entry of raw) {
    const cast = entry as Record<string, unknown> | null | undefined;
    const kind = String(cast?.kind ?? "").trim();
    if (!kind) continue;
    if (kind === "uniquePerTile") {
      const maxCount = Math.max(1, Math.trunc(Number(cast?.maxCount ?? 1) || 1));
      out.push({ kind: "uniquePerTile", maxCount });
      continue;
    }
  if (kind === "tileRegionCompare") {
    const fieldRaw = String(cast?.field ?? "").trim();
    const field: "spaceRemaining" | "pollution" | "threat" =
      fieldRaw === "pollution" ||
      fieldRaw === "threat" ||
      fieldRaw === "spaceRemaining"
        ? (fieldRaw as "spaceRemaining" | "pollution" | "threat")
        : "spaceRemaining";
      const opRaw = String(cast?.op ?? "").trim();
      const op: BuildingRuleComparisonOp =
        opRaw === "eq" ||
        opRaw === "ne" ||
        opRaw === "gt" ||
        opRaw === "gte" ||
        opRaw === "lt" ||
        opRaw === "lte"
          ? (opRaw as BuildingRuleComparisonOp)
          : "gte";
      const value = Math.max(0, Math.trunc(Number(cast?.value ?? 0) || 0));
      out.push({ kind: "tileRegionCompare", field, op, value });
      continue;
    }
    if (kind === "requireTagInRange") {
      const tagPresetId = String(cast?.tagPresetId ?? "").trim();
      if (!tagPresetId) continue;
      const distance = Math.max(0, Math.trunc(Number(cast?.distance ?? 1) || 1));
      const minCount = Math.max(1, Math.trunc(Number(cast?.minCount ?? 1) || 1));
      const negate = !!cast?.negate;
      const repeat = !!cast?.repeat;
      const valueModeRaw = String(cast?.valueMode ?? "").trim();
      const valueMode = valueModeRaw === "equals" || valueModeRaw === "contains" ? valueModeRaw : undefined;
      const value = String(cast?.value ?? "").trim();
      out.push({
        kind: "requireTagInRange",
        tagPresetId,
        distance,
        minCount,
        negate,
        repeat,
        ...(valueMode ? { valueMode } : {}),
        ...(value ? { value } : {}),
      });
      continue;
    }
    if (kind === "requireBuildingInRange") {
      const presetId = String(cast?.presetId ?? "").trim();
      if (!presetId) continue;
      const distance = Math.max(0, Math.trunc(Number(cast?.distance ?? 1) || 1));
      const minCount = Math.max(1, Math.trunc(Number(cast?.minCount ?? 1) || 1));
      const negate = !!cast?.negate;
      const repeat = !!cast?.repeat;
      out.push({ kind: "requireBuildingInRange", presetId, distance, minCount, negate, repeat });
      continue;
    }
    // Legacy compatibility
    if (kind === "requireAdjacentTag") {
      const tagId = String((cast as any).tagId ?? "").trim();
      if (!tagId) continue;
      out.push({ kind: "requireTagInRange", tagPresetId: tagId, distance: 1 });
      continue;
    }
    if (kind === "requireAdjacentBuilding") {
      const presetId = String((cast as any).presetId ?? "").trim();
      if (!presetId) continue;
      out.push({ kind: "requireBuildingInRange", presetId, distance: 1 });
      continue;
    }
    if (kind === "custom") {
      const label = String(cast?.label ?? "").trim();
      if (!label) continue;
      out.push({ kind: "custom", label });
      continue;
    }
  }
  return out;
}

export function normalizeBuildingPresets(raw: unknown): WorldMapBuildingPresetRow[] {
  if (!Array.isArray(raw)) return [];
  const out: WorldMapBuildingPresetRow[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    const cast = entry as Partial<WorldMapBuildingPresetRow> | null | undefined;
    const name = String(cast?.name ?? "").trim();
    if (!name) continue;
    const id = String(cast?.id ?? "").trim() || makeLocalId();
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      mapId: String(cast?.mapId ?? "").trim(),
      name,
      color: normalizeHexColor(cast?.color, "#eab308"),
      tier: String(cast?.tier ?? "").trim() || undefined,
      effort: Number.isFinite(Number(cast?.effort))
        ? Math.max(0, Math.trunc(Number(cast?.effort)))
        : undefined,
      space: Number.isFinite(Number(cast?.space))
        ? Math.max(0, Math.trunc(Number(cast?.space)))
        : undefined,
      description: String(cast?.description ?? "").trim() || undefined,
      placementRules: normalizePlacementRules(cast?.placementRules),
      buildCost:
        cast?.buildCost && typeof cast.buildCost === "object"
          ? (cast.buildCost as Record<string, number>)
          : {},
      researchCost:
        cast?.researchCost && typeof cast.researchCost === "object"
          ? (cast.researchCost as Record<string, number>)
          : {},
      upkeep:
        cast?.upkeep && typeof cast.upkeep === "object"
          ? {
              resources:
                cast.upkeep.resources && typeof cast.upkeep.resources === "object"
                  ? (cast.upkeep.resources as Record<string, number>)
                  : {},
              population:
                cast.upkeep.population && typeof cast.upkeep.population === "object"
                  ? (cast.upkeep.population as Record<string, number>)
                  : {},
            }
          : undefined,
      effects:
        cast?.effects && typeof cast.effects === "object"
          ? {
              onBuild: normalizeExecutionRules(cast.effects.onBuild, false),
              daily: normalizeExecutionRules(cast.effects.daily, true),
              onRemove: normalizeExecutionRules(cast.effects.onRemove, false),
            }
          : undefined,
      createdAt: String(cast?.createdAt ?? ""),
      updatedAt: String(cast?.updatedAt ?? ""),
    });
  }
  return out;
}

export function normalizeBuildingInstances(raw: unknown): WorldMapBuildingInstanceRow[] {
  if (!Array.isArray(raw)) return [];
  const out: WorldMapBuildingInstanceRow[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    const cast = entry as Partial<WorldMapBuildingInstanceRow> | null | undefined;
    const id = String(cast?.id ?? "").trim();
    const mapId = String(cast?.mapId ?? "").trim();
    const presetId = String(cast?.presetId ?? "").trim();
    if (!id || !mapId || !presetId || seen.has(id)) continue;
    const col = Math.trunc(Number(cast?.col));
    const row = Math.trunc(Number(cast?.row));
    if (!Number.isFinite(col) || !Number.isFinite(row)) continue;
    seen.add(id);
    out.push({
      id,
      mapId,
      presetId,
      col,
      row,
      enabled: cast?.enabled !== false,
      progressEffort: Number.isFinite(Number(cast?.progressEffort))
        ? Math.max(0, Math.trunc(Number(cast?.progressEffort)))
        : 0,
      meta:
        cast?.meta && typeof cast.meta === "object"
          ? (cast.meta as Record<string, unknown>)
          : undefined,
      createdAt: String(cast?.createdAt ?? ""),
      updatedAt: String(cast?.updatedAt ?? ""),
    });
  }
  return out;
}

export function readAssignedWorkersFromInstanceMeta(meta: unknown) {
  const root = (meta && typeof meta === "object" ? (meta as Record<string, unknown>) : {}) ?? {};
  const buildMeta =
    root.buildMeta && typeof root.buildMeta === "object"
      ? (root.buildMeta as Record<string, unknown>)
      : {};
  const raw = buildMeta.assignedWorkers ?? root.assignedWorkers ?? 0;
  const parsed = Math.trunc(Number(raw));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

export function readAssignedWorkersByTypeFromInstanceMeta(
  meta: unknown
): Record<PopulationTrackedId, number> {
  const root = (meta && typeof meta === "object" ? (meta as Record<string, unknown>) : {}) ?? {};
  const buildMeta =
    root.buildMeta && typeof root.buildMeta === "object"
      ? (root.buildMeta as Record<string, unknown>)
      : {};
  const byTypeRaw =
    buildMeta.assignedWorkersByType && typeof buildMeta.assignedWorkersByType === "object"
      ? (buildMeta.assignedWorkersByType as Record<string, unknown>)
      : root.assignedWorkersByType && typeof root.assignedWorkersByType === "object"
        ? (root.assignedWorkersByType as Record<string, unknown>)
        : {};
  const out: Record<PopulationTrackedId, number> = {
    settlers: 0,
    engineers: 0,
    scholars: 0,
    laborers: 0,
  };
  for (const id of TRACKED_POPULATION_IDS) {
    const parsed = Math.trunc(Number(byTypeRaw[id] ?? 0));
    out[id] = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }
  const total = out.settlers + out.engineers + out.scholars + out.laborers;
  if (total <= 0) {
    const legacy = readAssignedWorkersFromInstanceMeta(meta);
    if (legacy > 0) out.laborers = legacy;
  }
  return out;
}

export function convertUniquePerTileRulesForPersist(
  rules: BuildingPlacementRule[] | undefined,
  presetId: string | null | undefined
): BuildingPlacementRule[] {
  const normalized = normalizePlacementRules(rules);
  const targetPresetId = String(presetId ?? "").trim();
  if (!targetPresetId) return normalized;
  return normalized.map((rule) => {
    if (rule.kind !== "uniquePerTile") return rule;
    const maxCount = Math.max(1, safeInt(rule.maxCount, 1));
    return {
      kind: "requireBuildingInRange",
      presetId: targetPresetId,
      distance: 0,
      minCount: maxCount + 1,
      negate: true,
      repeat: false,
    };
  });
}

export function readUpkeepAnyNonElderlyByTypeFromInstanceMeta(
  meta: unknown
): Record<PopulationTrackedId, number> {
  const root = (meta && typeof meta === "object" ? (meta as Record<string, unknown>) : {}) ?? {};
  const buildMeta =
    root.buildMeta && typeof root.buildMeta === "object"
      ? (root.buildMeta as Record<string, unknown>)
      : {};
  const byTypeRaw =
    buildMeta.upkeepAnyNonElderlyByType &&
    typeof buildMeta.upkeepAnyNonElderlyByType === "object"
      ? (buildMeta.upkeepAnyNonElderlyByType as Record<string, unknown>)
      : root.upkeepAnyNonElderlyByType && typeof root.upkeepAnyNonElderlyByType === "object"
        ? (root.upkeepAnyNonElderlyByType as Record<string, unknown>)
        : {};
  const out: Record<PopulationTrackedId, number> = {
    settlers: 0,
    engineers: 0,
    scholars: 0,
    laborers: 0,
  };
  for (const id of TRACKED_POPULATION_IDS) {
    const parsed = Math.trunc(Number(byTypeRaw[id] ?? 0));
    out[id] = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }
  return out;
}

export function sumAssignedWorkersByType(workersByType: Record<PopulationTrackedId, number>) {
  return TRACKED_POPULATION_IDS.reduce((sum, id) => sum + Math.max(0, workersByType[id] ?? 0), 0);
}

export function readBuildStatusFromInstanceMeta(meta: unknown): "building" | "active" | null {
  const root = (meta && typeof meta === "object" ? (meta as Record<string, unknown>) : {}) ?? {};
  const buildMeta =
    root.buildMeta && typeof root.buildMeta === "object"
      ? (root.buildMeta as Record<string, unknown>)
      : {};
  const value = String(buildMeta.status ?? "").trim();
  if (value === "building" || value === "active") return value;
  return null;
}

export function getInstanceBuildStatus(
  instance: WorldMapBuildingInstanceRow,
  preset?: WorldMapBuildingPresetRow | null
) {
  const effort = Math.max(0, Math.trunc(Number(preset?.effort ?? 0)));
  if (effort <= 0) return "active" as const;
  const fromMeta = readBuildStatusFromInstanceMeta(instance.meta);
  if (fromMeta) return fromMeta;
  return instance.progressEffort >= effort ? ("active" as const) : ("building" as const);
}

export function createZeroWorkersByType(): Record<PopulationTrackedId, number> {
  return {
    settlers: 0,
    engineers: 0,
    scholars: 0,
    laborers: 0,
  };
}

export function makeLocalId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `preset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function formatWithCommas(value: number) {
  if (!Number.isFinite(value)) return "0";
  return Math.floor(value).toLocaleString("ko-KR");
}

export function roundTo2(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export function formatDailyDelta(value: number) {
  const rounded = roundTo2(value);
  if (Math.abs(rounded) < 0.0001) return "0";
  const sign = rounded > 0 ? "+" : "-";
  const abs = Math.abs(rounded);
  const text =
    Math.abs(abs - Math.trunc(abs)) < 0.0001
      ? Math.trunc(abs).toLocaleString("ko-KR")
      : abs.toLocaleString("ko-KR", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        });
  return `${sign}${text}`;
}

export type RuleEvalContext = {
  col: number;
  row: number;
  map: WorldMap;
  cityGlobal: CityGlobalState;
  tileStates: Record<string, MapTileStateAssignment[]>;
  tileRegions: Record<string, MapTileRegionState>;
  buildingInstances: WorldMapBuildingInstanceRow[];
};

export function oddRToCube(col: number, row: number) {
  const x = col - (row - (row & 1)) / 2;
  const z = row;
  const y = -x - z;
  return { x, y, z };
}

export function oddQToCube(col: number, row: number) {
  const x = col;
  const z = row - (col - (col & 1)) / 2;
  const y = -x - z;
  return { x, y, z };
}

export function hexDistanceByOrientation(
  orientation: HexOrientation,
  c1: number,
  r1: number,
  c2: number,
  r2: number
) {
  const a = orientation === "flat" ? oddQToCube(c1, r1) : oddRToCube(c1, r1);
  const b = orientation === "flat" ? oddQToCube(c2, r2) : oddRToCube(c2, r2);
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.z - b.z));
}

export function compareByOp(op: BuildingRuleComparisonOp, left: number, right: number) {
  if (op === "eq") return left === right;
  if (op === "ne") return left !== right;
  if (op === "gt") return left > right;
  if (op === "gte") return left >= right;
  if (op === "lt") return left < right;
  return left <= right;
}

export function safeInt(value: unknown, fallback = 0) {
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) ? n : fallback;
}

export function countTagsInRange(
  ctx: RuleEvalContext,
  rule: {
    tagPresetId: string;
    distance?: number;
    valueMode?: "equals" | "contains";
    value?: string;
  }
) {
  const distance = Math.max(0, safeInt(rule.distance, 1));
  const expectedValue = String(rule.value ?? "").trim();
  let count = 0;
  for (let r = 0; r < ctx.map.rows; r += 1) {
    for (let c = 0; c < ctx.map.cols; c += 1) {
      const dist = hexDistanceByOrientation(ctx.map.orientation, ctx.col, ctx.row, c, r);
      if (dist > distance) continue;
      const entries = ctx.tileStates[tileKey(c, r)] ?? [];
      const matched = entries.some((entry) => {
        if (entry.presetId !== rule.tagPresetId) return false;
        if (!expectedValue) return true;
        const value = String(entry.value ?? "").trim();
        if (rule.valueMode === "contains") return value.includes(expectedValue);
        return value === expectedValue;
      });
      if (matched) count += 1;
    }
  }
  return count;
}

export function countBuildingsInRange(
  ctx: RuleEvalContext,
  rule: { presetId: string; distance?: number }
) {
  const distance = Math.max(0, safeInt(rule.distance, 1));
  let count = 0;
  for (const instance of ctx.buildingInstances) {
    if (instance.presetId !== rule.presetId) continue;
    const dist = hexDistanceByOrientation(
      ctx.map.orientation,
      ctx.col,
      ctx.row,
      instance.col,
      instance.row
    );
    if (dist <= distance) count += 1;
  }
  return count;
}

export function getTileMetricValue(
  ctx: RuleEvalContext,
  metric: "adjacentTagCount" | "adjacentBuildingCount" | "tileStateValue",
  key: string
) {
  if (metric === "tileStateValue") {
    const entries = ctx.tileStates[tileKey(ctx.col, ctx.row)] ?? [];
    const found = entries.find((entry) => entry.presetId === key);
    if (!found) return 0;
    const n = Number(found.value ?? 0);
    return Number.isFinite(n) ? n : 0;
  }
  if (metric === "adjacentTagCount") {
    return countTagsInRange(ctx, { tagPresetId: key, distance: 1 });
  }
  return countBuildingsInRange(ctx, { presetId: key, distance: 1 });
}

export function evalRuleExpr(ctx: RuleEvalContext, expr: BuildingRuleExpr | undefined): number {
  if (!expr) return 0;
  if (expr.kind === "const") return Number.isFinite(expr.value) ? expr.value : 0;
  if (expr.kind === "resource") {
    if (isBaseResourceId(expr.resourceId)) {
      return safeInt(ctx.cityGlobal.values[expr.resourceId], 0);
    }
    const itemName = getItemNameFromBuildingResourceId(expr.resourceId);
    if (!itemName) return 0;
    return safeInt(ctx.cityGlobal.warehouse?.[itemName], 0);
  }
  if (expr.kind === "population") {
    const entry = ctx.cityGlobal.population[expr.populationId];
    if (!entry) return 0;
    if (expr.field === "total") return safeInt((entry as any).total, 0);
    return safeInt((entry as any).available, 0);
  }
  if (expr.kind === "tileMetric") return getTileMetricValue(ctx, expr.metric, expr.key);
  if (expr.kind === "binary") {
    const left = evalRuleExpr(ctx, expr.left);
    const right = evalRuleExpr(ctx, expr.right);
    if (expr.op === "add") return left + right;
    if (expr.op === "sub") return left - right;
    if (expr.op === "mul") return left * right;
    if (expr.op === "div") return Math.abs(right) < 0.0000001 ? 0 : left / right;
    if (expr.op === "min") return Math.min(left, right);
    return Math.max(left, right);
  }
  if (expr.kind === "clamp") {
    const value = evalRuleExpr(ctx, expr.value);
    const min = expr.min == null ? value : expr.min;
    const max = expr.max == null ? value : expr.max;
    return Math.max(min, Math.min(max, value));
  }
  if (expr.kind === "randPct") {
    const pct = Number.isFinite(expr.pct) ? expr.pct : 0;
    return Math.max(0, Math.min(100, pct)) / 100;
  }
  return 0;
}

export function evaluateRulePredicatePreview(
  ctx: RuleEvalContext,
  predicate?: BuildingRulePredicate
): { matched: boolean; repeatCount: number } {
  if (!predicate) return { matched: true, repeatCount: 1 };

  if (predicate.kind === "compare") {
    const left = evalRuleExpr(ctx, predicate.left);
    const right = evalRuleExpr(ctx, predicate.right);
    return { matched: compareByOp(predicate.op, left, right), repeatCount: 1 };
  }

  if (predicate.kind === "tileRegionCompare") {
    const state = ctx.tileRegions[tileKey(ctx.col, ctx.row)] ?? {};
    const left =
      predicate.field === "spaceRemaining"
        ? safeInt(state.spaceCap, 0) - safeInt(state.spaceUsed, 0)
        : safeInt((state as any)[predicate.field], 0);
    return { matched: compareByOp(predicate.op, left, safeInt(predicate.value, 0)), repeatCount: 1 };
  }

  if (predicate.kind === "hasTag") {
    const distance = predicate.scope === "self" ? 0 : 1;
    const count = countTagsInRange(ctx, { tagPresetId: predicate.tagId, distance });
    return { matched: count > 0, repeatCount: 1 };
  }

  if (predicate.kind === "hasBuilding") {
    const distance = predicate.scope === "self" ? 0 : 1;
    const count = countBuildingsInRange(ctx, { presetId: predicate.presetId, distance });
    return { matched: count > 0, repeatCount: 1 };
  }

  if (predicate.kind === "logic") {
    if (!Array.isArray(predicate.rules) || predicate.rules.length === 0) {
      return { matched: true, repeatCount: 1 };
    }
    const results = predicate.rules.map((entry) => evaluateRulePredicatePreview(ctx, entry));
    if (predicate.op === "and") {
      return { matched: results.every((entry) => entry.matched), repeatCount: 1 };
    }
    return { matched: results.some((entry) => entry.matched), repeatCount: 1 };
  }

  if (predicate.kind === "uniquePerTile") {
    const maxCount = Math.max(1, safeInt(predicate.maxCount, 1));
    const count = ctx.buildingInstances.filter(
      (entry) => entry.col === ctx.col && entry.row === ctx.row
    ).length;
    return { matched: count <= maxCount, repeatCount: 1 };
  }

  if (predicate.kind === "custom") {
    return { matched: true, repeatCount: 1 };
  }

  if (predicate.kind === "requireTagInRange") {
    const minCount = Math.max(1, safeInt(predicate.minCount, 1));
    const count = countTagsInRange(ctx, predicate);
    const negate = !!predicate.negate;
    const matched = negate ? count < minCount : count >= minCount;
    const repeatCount =
      matched && predicate.repeat && !negate ? Math.max(1, Math.floor(count / minCount)) : matched ? 1 : 0;
    return { matched, repeatCount };
  }

  if (predicate.kind === "requireBuildingInRange") {
    const minCount = Math.max(1, safeInt(predicate.minCount, 1));
    const count = countBuildingsInRange(ctx, predicate);
    const negate = !!predicate.negate;
    const matched = negate ? count < minCount : count >= minCount;
    const repeatCount =
      matched && predicate.repeat && !negate ? Math.max(1, Math.floor(count / minCount)) : matched ? 1 : 0;
    return { matched, repeatCount };
  }

  return { matched: true, repeatCount: 1 };
}

export function createEmptyResourceCostDraft(): ResourceCostDraft {
  const out: ResourceCostDraft = {};
  for (const id of ALL_RESOURCE_IDS) out[id] = "";
  return out;
}

export function createEmptyPopulationCostDraft(): PopulationCostDraft {
  const out: PopulationCostDraft = {};
  for (const id of UPKEEP_POPULATION_IDS) out[id] = "";
  return out;
}

export function createDefaultRuleAction(): BuildingRuleAction {
  return {
    kind: "adjustResource",
    resourceId: "gold",
    delta: { kind: "const", value: 0 },
  };
}

export function createDefaultExecutionRule(withInterval = false): BuildingExecutionRule {
  return {
    id: makeLocalId(),
    intervalDays: withInterval ? 1 : undefined,
    actions: [createDefaultRuleAction()],
  };
}

export function createDefaultBuildingDraftState(): BuildingDraftState {
  return {
    id: null,
    name: "",
    color: "#eab308",
    tier: "",
    effort: "",
    space: "",
    description: "",
    placementRules: [],
    buildCost: createEmptyResourceCostDraft(),
    upkeepResources: createEmptyResourceCostDraft(),
    upkeepPopulation: createEmptyPopulationCostDraft(),
    onBuild: [],
    daily: [],
    onRemove: [],
  };
}

export function toNonNegativeInt(value: string): number | undefined {
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n)) return undefined;
  return Math.max(0, n);
}

export function toNumberRecordFromDraft<T extends string>(
  ids: readonly T[],
  source: Partial<Record<T, string>>,
  allowZero = false
): Partial<Record<T, number>> {
  const out: Partial<Record<T, number>> = {};
  for (const id of ids) {
    const raw = String(source[id] ?? "").trim();
    if (!raw) continue;
    const n = toNonNegativeInt(raw);
    if (n == null) continue;
    if (!allowZero && n === 0) continue;
    out[id] = n;
  }
  return out;
}

export function toNumberRecordFromResourceDraft(
  source: ResourceCostDraft,
  allowZero = false
): Partial<Record<BuildingResourceId, number>> {
  const out: Partial<Record<BuildingResourceId, number>> = {};
  for (const [rawId, rawValue] of Object.entries(source ?? {})) {
    const id = String(rawId ?? "").trim();
    if (!isBuildingResourceId(id)) continue;
    const text = String(rawValue ?? "").trim();
    if (!text) continue;
    const n = toNonNegativeInt(text);
    if (n == null) continue;
    if (!allowZero && n === 0) continue;
    out[id] = n;
  }
  return out;
}

export function toStringRecordFromNumbers<T extends string>(
  ids: readonly T[],
  source: Partial<Record<string, number>> | undefined
): Partial<Record<T, string>> {
  const out: Partial<Record<T, string>> = {};
  for (const id of ids) {
    const n = Number(source?.[id]);
    out[id] = Number.isFinite(n) ? String(Math.max(0, Math.trunc(n))) : "";
  }
  return out;
}

export function toResourceCostDraftFromNumbers(
  source: Partial<Record<string, number>> | undefined
): ResourceCostDraft {
  const out = createEmptyResourceCostDraft();
  if (!source || typeof source !== "object") return out;
  for (const [rawId, rawValue] of Object.entries(source)) {
    if (!isBuildingResourceId(rawId)) continue;
    const n = Number(rawValue);
    out[rawId] = Number.isFinite(n) ? String(Math.max(0, Math.trunc(n))) : "";
  }
  return out;
}

export function exprToEditableNumber(expr: BuildingRuleExpr | undefined): string {
  if (!expr) return "";
  if (expr.kind === "const" && Number.isFinite(expr.value)) return String(Math.trunc(expr.value));
  return "";
}

export function buildDraftFromPreset(row: WorldMapBuildingPresetRow): BuildingDraftState {
  return {
    id: row.id,
    name: row.name,
    color: normalizeHexColor(row.color, "#eab308"),
    tier: row.tier ?? "",
    effort: row.effort == null ? "" : String(row.effort),
    space: row.space == null ? "" : String(row.space),
    description: row.description ?? "",
    placementRules: normalizePlacementRules(row.placementRules),
    buildCost: toResourceCostDraftFromNumbers(row.buildCost),
    upkeepResources: toResourceCostDraftFromNumbers(row.upkeep?.resources),
    upkeepPopulation: toStringRecordFromNumbers(UPKEEP_POPULATION_IDS, row.upkeep?.population),
    onBuild: normalizeExecutionRules(row.effects?.onBuild, false),
    daily: normalizeExecutionRules(row.effects?.daily, true),
    onRemove: normalizeExecutionRules(row.effects?.onRemove, false),
  };
}





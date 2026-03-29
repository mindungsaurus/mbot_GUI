import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createWorldMapBuildingInstance,
  createSharedWorldMapBuildingPreset,
  createSharedWorldMapTilePreset,
  createWorldMap,
  addInventoryItem,
  getWorldMap,
  deleteWorldMapBuildingInstance,
  deleteWorldMapBuildingPreset,
  deleteSharedWorldMapBuildingPreset,
  deleteSharedWorldMapTilePreset,
  deleteWorldMap,
  listWorldMapBuildingInstances,
  listWorldMapBuildingPresets,
  listSharedWorldMapBuildingPresets,
  listSharedWorldMapTilePresets,
  listWorldMaps,
  runWorldMapDaily,
  listInventory,
  listItemCatalog,
  useInventoryItem,
  updateWorldMapBuildingInstance,
  updateWorldMapBuildingPreset,
  updateSharedWorldMapBuildingPreset,
  updateWorldMap,
  uploadWorldMapImage,
} from "./api";
import type {
  AuthUser,
  BuildingExecutionRule,
  BuildingPlacementRule,
  BuildingRuleAction,
  BuildingRulePredicate,
  BuildingResourceId,
  CityGlobalState,
  ItemCatalogEntry,
  MapTileRegionState,
  MapTileStateAssignment,
  MapTileStatePreset,
  PopulationTrackedId,
  UpkeepPopulationId,
  WorldMapBuildingInstanceRow,
  WorldMapBuildingPresetRow,
  WorldMap,
} from "./types";

type Props = {
  authUser: AuthUser;
  mode?: "map" | "presets";
  onBack: () => void;
};

type OverflowConversionDetail = {
  resourceId: CappedResourceId;
  overflowAmount: number;
  goldGain: number;
};

type OverflowConversionNotice = {
  beforeGold: number;
  afterGold: number;
  totalGoldGain: number;
  details: OverflowConversionDetail[];
};

type TileYieldDelta = {
  resourceId: string;
  label: string;
  value: number;
};

type TileYieldBuildingRow = {
  instanceId: string;
  buildingName: string;
  color: string;
  deltas: TileYieldDelta[];
};

type ResourceStatusTileRow = {
  tileKey: string;
  tileNumber: number;
  col: number;
  row: number;
  value: number;
  buildings: Array<{
    instanceId: string;
    buildingName: string;
    color: string;
    value: number;
  }>;
};

type ResourceStatusGroupRow = {
  resourceId: string;
  label: string;
  total: number;
  tiles: ResourceStatusTileRow[];
};

import type {
  CappedResourceId,
  Draft,
  SelectedHex,
  ViewMode,
  SettingsTab,
  PresetMode,
  TileStatesByMap,
  TilePresetsByMap,
  TileRegionStatesByMap,
  BuildingPresetsByMap,
  BuildingInstancesByMap,
  ImageViewportBounds,
  ResourceId,
  WorkerAssignmentDraft,
  BuildingDraftState,
  RuleEvalContext,
} from "./world-map/utils";
import {
  CAPPED_RESOURCE_IDS,
  ALL_RESOURCE_IDS,
  BUILDING_PRESET_RESOURCE_IDS,
  TRACKED_POPULATION_IDS,
  ALL_POPULATION_IDS,
  UPKEEP_POPULATION_IDS,
  EMPTY_STATE_BADGES,
  EMPTY_WORKER_ASSIGNMENT_DRAFT,
  normalizeCityGlobalState,
  DEFAULT_DRAFT,
  resolveImageUrl,
  buildDraft,
  getHexLayout,
  tileKey,
  normalizeHexColor,
  normalizeTilePresets,
  normalizeTileStateAssignments,
  normalizeTileRegionStates,
  normalizeBuildingPresets,
  normalizeBuildingInstances,
  readAssignedWorkersByTypeFromInstanceMeta,
  readUpkeepAnyNonElderlyByTypeFromInstanceMeta,
  sumAssignedWorkersByType,
  getInstanceBuildStatus,
  createZeroWorkersByType,
  formatWithCommas,
  roundTo2,
  safeInt,
  evalRuleExpr,
  evaluateRulePredicatePreview,
  convertUniquePerTileRulesForPersist,
  createDefaultRuleAction,
  createDefaultExecutionRule,
  createDefaultBuildingDraftState,
  toNonNegativeInt,
  toNumberRecordFromDraft,
  toNumberRecordFromResourceDraft,
  buildDraftFromPreset,
  RESOURCE_LABELS,
  RESOURCE_EMOJIS,
  getBuildingResourceLabel,
} from "./world-map/utils";
import MapListPanel from "./world-map/components/MapListPanel";
import MapPresetsPanel from "./world-map/components/MapPresetsPanel";
import MapModePanel from "./world-map/components/MapModePanel";
import WorldMapHeaderBar from "./world-map/components/WorldMapHeaderBar";

const normalizePresetKeyPart = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

const getBuildingPresetMergeKey = (preset: Pick<WorldMapBuildingPresetRow, "id" | "name" | "tier">) => {
  const nameKey = normalizePresetKeyPart(preset.name);
  const tierKey = normalizePresetKeyPart(preset.tier ?? "");
  if (nameKey) return `${nameKey}::${tierKey}`;
  return `id:${String(preset.id ?? "").trim()}`;
};

const mergeSharedAndLocalBuildingPresets = (
  sharedRows: WorldMapBuildingPresetRow[],
  localRows: WorldMapBuildingPresetRow[]
) => {
  const merged = new Map<string, WorldMapBuildingPresetRow>();
  for (const row of sharedRows) merged.set(getBuildingPresetMergeKey(row), row);
  for (const row of localRows) merged.set(getBuildingPresetMergeKey(row), row);
  return Array.from(merged.values());
};

export default function WorldMapManager({ authUser, mode = "map", onBack }: Props) {
  const isAdmin = !!authUser.isAdmin;
  const isPresetMode = mode === "presets";
  const [maps, setMaps] = useState<WorldMap[]>([]);
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [mapListOpen, setMapListOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("map");
  const [presetMode, setPresetMode] = useState<PresetMode>("tile");
  const [resourceOverlayOpen, setResourceOverlayOpen] = useState(true);
  const [populationOverlayOpen, setPopulationOverlayOpen] = useState(true);
  const [resourceAdjustOpen, setResourceAdjustOpen] = useState(false);
  const [warehouseModalOpen, setWarehouseModalOpen] = useState(false);
  const [placementReportOpen, setPlacementReportOpen] = useState(false);
  const [resourceStatusModalOpen, setResourceStatusModalOpen] = useState(false);
  const [resourceAdjustTarget, setResourceAdjustTarget] = useState<ResourceId>("gold");
  const [resourceAdjustMode, setResourceAdjustMode] = useState<"inc" | "dec">("inc");
  const [resourceAdjustAmount, setResourceAdjustAmount] = useState("0");
  const [itemCatalogEntries, setItemCatalogEntries] = useState<ItemCatalogEntry[]>([]);
  const [dailyRunDays, setDailyRunDays] = useState("1");
  const [dailyRunResult, setDailyRunResult] = useState<string | null>(null);
  const [dailyRunLogs, setDailyRunLogs] = useState<string[]>([]);
  const [overflowNotice, setOverflowNotice] = useState<OverflowConversionNotice | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [createName, setCreateName] = useState("");
  const [draft, setDraft] = useState<Draft>(DEFAULT_DRAFT);
  const [selectedHex, setSelectedHex] = useState<SelectedHex>(null);
  const [selectedHexes, setSelectedHexes] = useState<Array<{ col: number; row: number }>>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("scroll");
  const [showTileStatePills, setShowTileStatePills] = useState(true);
  const [showRegionStatusPills, setShowRegionStatusPills] = useState(true);
  const [showTileNumbering, setShowTileNumbering] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [zoom, setZoom] = useState(0.7);
  const [visibleImageBounds, setVisibleImageBounds] = useState<ImageViewportBounds | null>(
    null
  );
  const [tilePresetsByMap, setTilePresetsByMap] = useState<TilePresetsByMap>({});
  const [sharedTilePresets, setSharedTilePresets] = useState<MapTileStatePreset[]>([]);
  const [tileStatesByMap, setTileStatesByMap] = useState<TileStatesByMap>({});
  const [tileRegionStatesByMap, setTileRegionStatesByMap] = useState<TileRegionStatesByMap>({});
  const [buildingPresetsByMap, setBuildingPresetsByMap] = useState<BuildingPresetsByMap>({});
  const [buildingInstancesByMap, setBuildingInstancesByMap] = useState<BuildingInstancesByMap>(
    {}
  );
  const [presetDraftName, setPresetDraftName] = useState("");
  const [presetDraftColorHex, setPresetDraftColorHex] = useState("#e5e7eb");
  const [presetDraftHasValue, setPresetDraftHasValue] = useState(false);
  const [buildingDraft, setBuildingDraft] = useState<BuildingDraftState>(
    createDefaultBuildingDraftState
  );
  const [placementRuleSearch, setPlacementRuleSearch] = useState<Record<string, string>>({});
  const [tileContextMenu, setTileContextMenu] = useState<{
    x: number;
    y: number;
    col: number;
    row: number;
  } | null>(null);
  const [tileEditor, setTileEditor] = useState<{
    targets: Array<{ key: string; col: number; row: number }>;
    draft: MapTileStateAssignment[];
  } | null>(null);
  const [tileRegionEditor, setTileRegionEditor] = useState<{
    key: string;
    col: number;
    row: number;
    draft: {
      spaceUsed: string;
      spaceCap: string;
      threat: string;
      pollution: string;
    };
  } | null>(null);
  const [tileBuildingEditor, setTileBuildingEditor] = useState<{
    col: number;
    row: number;
    presetId: string;
  } | null>(null);
  const [tileYieldViewer, setTileYieldViewer] = useState<{ col: number; row: number } | null>(
    null
  );
  const [tileBuildingSearchQuery, setTileBuildingSearchQuery] = useState("");
  const [loadedSize, setLoadedSize] = useState<{ width: number; height: number } | null>(
    null
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const tileContextMenuRef = useRef<HTMLDivElement | null>(null);
  const syncingImageMetaRef = useRef<string | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const citySettingsFormRef = useRef<HTMLFormElement | null>(null);
  const dragRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    startLeft: number;
    startTop: number;
    moved: boolean;
  }>({
    active: false,
    startX: 0,
    startY: 0,
    startLeft: 0,
    startTop: 0,
    moved: false,
  });
  const suppressClickRef = useRef(false);
  const tileRegionDraftRef = useRef<{
    spaceUsed: string;
    spaceCap: string;
    threat: string;
    pollution: string;
  } | null>(null);
  const visibleBoundsRafRef = useRef<number | null>(null);
  const tileBuildingSearchInputRef = useRef<HTMLInputElement | null>(null);
  const tileBuildingSearchTimerRef = useRef<number | null>(null);
  const tileBuildingCreateWorkersDraftRef = useRef<WorkerAssignmentDraft>({
    ...EMPTY_WORKER_ASSIGNMENT_DRAFT,
  });
  const tileBuildingWorkersDraftByIdRef = useRef<Record<string, WorkerAssignmentDraft>>({});
  const prevSelectedMapIdRef = useRef<string | null>(null);

  const loadMaps = async (preferredId?: string | null) => {
    setBusy(true);
    setErr(null);
    try {
      const [res, sharedTileRows, sharedBuildingRows] = await Promise.all([
        listWorldMaps(),
        listSharedWorldMapTilePresets().catch(() => []),
        listSharedWorldMapBuildingPresets().catch(() => []),
      ]);
      const items = Array.isArray(res) ? res : [];
      const normalizedSharedBuildingPresets = normalizeBuildingPresets(
        Array.isArray(sharedBuildingRows) ? sharedBuildingRows : []
      );
      setMaps(items);
      setSharedTilePresets(normalizeTilePresets(Array.isArray(sharedTileRows) ? sharedTileRows : []));
      setTilePresetsByMap(() => {
        const next: TilePresetsByMap = {};
        for (const entry of items) {
          if (!entry?.id) continue;
          next[entry.id] = normalizeTilePresets(entry.tileStatePresets ?? []);
        }
        return next;
      });
      setTileStatesByMap(() => {
        const next: TileStatesByMap = {};
        for (const entry of items) {
          if (!entry?.id) continue;
          const remoteStates = normalizeTileStateAssignments(entry.tileStateAssignments ?? {});
          next[entry.id] = remoteStates;
        }
        return next;
      });
      setTileRegionStatesByMap(() => {
        const next: TileRegionStatesByMap = {};
        for (const entry of items) {
          if (!entry?.id) continue;
          next[entry.id] = normalizeTileRegionStates(entry.tileRegionStates ?? {});
        }
        return next;
      });
      setBuildingPresetsByMap(() => {
        const next: BuildingPresetsByMap = {};
        for (const entry of items) {
          if (!entry?.id) continue;
          next[entry.id] = mergeSharedAndLocalBuildingPresets(
            normalizedSharedBuildingPresets,
            normalizeBuildingPresets(entry.buildingPresetRows ?? [])
          );
        }
        return next;
      });
      setBuildingInstancesByMap(() => {
        const next: BuildingInstancesByMap = {};
        for (const entry of items) {
          if (!entry?.id) continue;
          next[entry.id] = normalizeBuildingInstances(entry.buildingInstances ?? []);
        }
        return next;
      });
      const nextId =
        preferredId && items.some((entry) => entry.id === preferredId)
          ? preferredId
          : items[0]?.id ?? null;
      setSelectedMapId(nextId);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void loadMaps();
  }, []);

  useEffect(() => {
    let disposed = false;
    const run = async () => {
      try {
        const rows = await listItemCatalog();
        if (disposed) return;
        const normalized = Array.isArray(rows)
          ? rows
              .map((entry) => ({
                name: String((entry as any)?.name ?? "").trim(),
                quality: Number((entry as any)?.quality ?? 0) || 0,
                unit: String((entry as any)?.unit ?? "").trim(),
                type: String((entry as any)?.type ?? "").trim(),
              }))
              .filter((entry) => !!entry.name)
          : [];
        setItemCatalogEntries(normalized);
      } catch {
        if (!disposed) setItemCatalogEntries([]);
      }
    };
    void run();
    return () => {
      disposed = true;
    };
  }, []);

  const loadBuildingPresetsForMap = useCallback(
    async (mapId: string) => {
      try {
        const [rows, sharedRows] = await Promise.all([
          listWorldMapBuildingPresets(mapId),
          listSharedWorldMapBuildingPresets().catch(() => []),
        ]);
        const normalized = mergeSharedAndLocalBuildingPresets(
          normalizeBuildingPresets(Array.isArray(sharedRows) ? sharedRows : []),
          normalizeBuildingPresets(rows)
        );
        setBuildingPresetsByMap((prev) => ({ ...prev, [mapId]: normalized }));
      } catch (e: any) {
        setErr(String(e?.message ?? e));
      }
    },
    [setBuildingPresetsByMap]
  );

  const loadBuildingInstancesForMap = useCallback(
    async (mapId: string) => {
      try {
        const rows = await listWorldMapBuildingInstances(mapId);
        const normalized = normalizeBuildingInstances(rows);
        setBuildingInstancesByMap((prev) => ({ ...prev, [mapId]: normalized }));
      } catch (e: any) {
        setErr(String(e?.message ?? e));
      }
    },
    [setBuildingInstancesByMap]
  );

  const refreshCurrentMapOnly = useCallback(
    async (mapId: string) => {
      const latest = await getWorldMap(mapId);
      if (!latest?.id) return;
      const latestAny = latest as any;
      let latestSharedBuildingRows: WorldMapBuildingPresetRow[] = [];
      try {
        latestSharedBuildingRows = normalizeBuildingPresets(
          await listSharedWorldMapBuildingPresets()
        );
      } catch {
        latestSharedBuildingRows = [];
      }
      setMaps((prev) => {
        const has = prev.some((entry) => entry.id === latest.id);
        if (!has) return [...prev, latest];
        return prev.map((entry) => (entry.id === latest.id ? latest : entry));
      });
      if (Object.prototype.hasOwnProperty.call(latestAny, "tileStatePresets")) {
        setTilePresetsByMap((prev) => ({
          ...prev,
          [latest.id]: normalizeTilePresets(Array.isArray(latestAny.tileStatePresets) ? latestAny.tileStatePresets : []),
        }));
      }
      if (Object.prototype.hasOwnProperty.call(latestAny, "tileStateAssignments")) {
        setTileStatesByMap((prev) => ({
          ...prev,
          [latest.id]: normalizeTileStateAssignments(
            latestAny.tileStateAssignments && typeof latestAny.tileStateAssignments === "object"
              ? latestAny.tileStateAssignments
              : {}
          ),
        }));
      }
      if (Object.prototype.hasOwnProperty.call(latestAny, "tileRegionStates")) {
        setTileRegionStatesByMap((prev) => ({
          ...prev,
          [latest.id]: normalizeTileRegionStates(
            latestAny.tileRegionStates && typeof latestAny.tileRegionStates === "object"
              ? latestAny.tileRegionStates
              : {}
          ),
        }));
      }
      if (Object.prototype.hasOwnProperty.call(latestAny, "buildingPresetRows")) {
        setBuildingPresetsByMap((prev) => ({
          ...prev,
          [latest.id]: mergeSharedAndLocalBuildingPresets(
            latestSharedBuildingRows,
            normalizeBuildingPresets(
              Array.isArray(latestAny.buildingPresetRows) ? latestAny.buildingPresetRows : []
            )
          ),
        }));
      }
      if (Object.prototype.hasOwnProperty.call(latestAny, "buildingInstances")) {
        setBuildingInstancesByMap((prev) => ({
          ...prev,
          [latest.id]: normalizeBuildingInstances(
            Array.isArray(latestAny.buildingInstances) ? latestAny.buildingInstances : []
          ),
        }));
      }
      await loadBuildingPresetsForMap(mapId);
      await loadBuildingInstancesForMap(mapId);
      try {
        const [sharedTileRows, sharedBuildingRows] = await Promise.all([
          listSharedWorldMapTilePresets(),
          listSharedWorldMapBuildingPresets().catch(() => []),
        ]);
        setSharedTilePresets(normalizeTilePresets(sharedTileRows));
        setBuildingPresetsByMap((prev) => ({
          ...prev,
          [mapId]: mergeSharedAndLocalBuildingPresets(
            normalizeBuildingPresets(Array.isArray(sharedBuildingRows) ? sharedBuildingRows : []),
            prev[mapId] ?? []
          ),
        }));
      } catch {
        // ignore
      }
    },
    [loadBuildingInstancesForMap, loadBuildingPresetsForMap]
  );

  const releaseWorkersFromCompletedBuildings = useCallback(
    async (mapId: string) => {
      const instances = normalizeBuildingInstances(await listWorldMapBuildingInstances(mapId));
      let presets = buildingPresetsByMap[mapId] ?? [];
      if (presets.length === 0) {
        const rows = await listWorldMapBuildingPresets(mapId);
        presets = normalizeBuildingPresets(rows);
        setBuildingPresetsByMap((prev) => ({ ...prev, [mapId]: presets }));
      }
      const presetById = new Map<string, WorldMapBuildingPresetRow>();
      for (const preset of presets) presetById.set(preset.id, preset);

      const targets = instances.filter((instance) => {
        if (instance.enabled === false) return false;
        const preset = presetById.get(instance.presetId) ?? null;
        if (getInstanceBuildStatus(instance, preset) !== "active") return false;
        const assigned = readAssignedWorkersByTypeFromInstanceMeta(instance.meta);
        return sumAssignedWorkersByType(assigned) > 0;
      });
      if (targets.length === 0) return;

      for (const instance of targets) {
        const zeroWorkersByType = createZeroWorkersByType();
        const rootMeta =
          instance.meta && typeof instance.meta === "object"
            ? (instance.meta as Record<string, unknown>)
            : {};
        const rootBuildMeta =
          rootMeta.buildMeta && typeof rootMeta.buildMeta === "object"
            ? (rootMeta.buildMeta as Record<string, unknown>)
            : {};
        await updateWorldMapBuildingInstance(mapId, instance.id, {
          meta: {
            ...rootMeta,
            assignedWorkers: 0,
            assignedWorkersByType: zeroWorkersByType,
            buildMeta: {
              ...rootBuildMeta,
              status: "active",
              assignedWorkers: 0,
              assignedWorkersByType: zeroWorkersByType,
            },
          },
        });
      }
      await loadBuildingInstancesForMap(mapId);
    },
    [buildingPresetsByMap, loadBuildingInstancesForMap]
  );

  useEffect(() => {
    if (!selectedMapId) return;
    void loadBuildingPresetsForMap(selectedMapId);
    void loadBuildingInstancesForMap(selectedMapId);
  }, [selectedMapId, loadBuildingInstancesForMap, loadBuildingPresetsForMap]);

  useEffect(() => {
    if (!selectedMapId) return;
    void refreshCurrentMapOnly(selectedMapId);
  }, [selectedMapId, refreshCurrentMapOnly]);

  useEffect(() => {
    setDailyRunResult(null);
    setDailyRunLogs([]);
    setDailyRunDays("1");
    setOverflowNotice(null);
  }, [selectedMapId]);

  const selectedMap = useMemo(
    () => maps.find((entry) => entry.id === selectedMapId) ?? null,
    [maps, selectedMapId]
  );
  const activeTileStates = useMemo(
    () => (selectedMapId ? tileStatesByMap[selectedMapId] ?? {} : {}),
    [selectedMapId, tileStatesByMap]
  );
  const activeLocalTilePresets = useMemo(
    () => (selectedMapId ? tilePresetsByMap[selectedMapId] ?? [] : []),
    [selectedMapId, tilePresetsByMap]
  );
  const activeTilePresets = useMemo(() => {
    const next: MapTileStatePreset[] = [];
    const seenById = new Set<string>();
    const seenByName = new Set<string>();

    for (const preset of sharedTilePresets) {
      next.push(preset);
      seenById.add(preset.id);
      seenByName.add(String(preset.name ?? "").trim().toLowerCase());
    }

    for (const preset of activeLocalTilePresets) {
      const nameKey = String(preset.name ?? "").trim().toLowerCase();
      if (seenById.has(preset.id) || seenByName.has(nameKey)) continue;
      next.push(preset);
      seenById.add(preset.id);
      seenByName.add(nameKey);
    }
    return next;
  }, [activeLocalTilePresets, sharedTilePresets]);
  const activeTileRegionStates = useMemo(
    () => (selectedMapId ? tileRegionStatesByMap[selectedMapId] ?? {} : {}),
    [selectedMapId, tileRegionStatesByMap]
  );
  const activeBuildingPresets = useMemo(
    () => (selectedMapId ? buildingPresetsByMap[selectedMapId] ?? [] : []),
    [selectedMapId, buildingPresetsByMap]
  );
  const activeBuildingInstances = useMemo(
    () => (selectedMapId ? buildingInstancesByMap[selectedMapId] ?? [] : []),
    [selectedMapId, buildingInstancesByMap]
  );
  const getTilePresetNameKey = (preset: Pick<MapTileStatePreset, "name">) =>
    normalizePresetKeyPart(preset.name);
  const getBuildingPresetSharedKey = (preset: Pick<WorldMapBuildingPresetRow, "name" | "tier">) =>
    `${normalizePresetKeyPart(preset.name)}::${normalizePresetKeyPart(preset.tier ?? "")}`;
  const selectedHexKeySet = useMemo(
    () => new Set(selectedHexes.map((hex) => tileKey(hex.col, hex.row))),
    [selectedHexes]
  );
  const buildingPresetById = useMemo(() => {
    const out = new Map<string, WorldMapBuildingPresetRow>();
    for (const preset of activeBuildingPresets) out.set(preset.id, preset);
    return out;
  }, [activeBuildingPresets]);
  const presetById = useMemo(() => {
    const out = new Map<string, MapTileStatePreset>();
    for (const preset of activeTilePresets) out.set(preset.id, preset);
    return out;
  }, [activeTilePresets]);
  const tileStateBadgesByKey = useMemo(() => {
    if (!showTileStatePills) return {} as Record<string, Array<{ text: string; color: string }>>;
    const out: Record<string, Array<{ text: string; color: string }>> = {};
    for (const [key, entries] of Object.entries(activeTileStates)) {
      const next = entries
        .map((entry) => {
          const preset = presetById.get(entry.presetId);
          if (!preset) return null;
          return {
            text:
              preset.hasValue && entry.value != null && String(entry.value).trim()
                ? `${preset.name}: ${String(entry.value).trim()}`
                : preset.name,
            color: normalizeHexColor(preset.color, "#e5e7eb"),
          };
        })
        .filter((v): v is { text: string; color: string } => !!v);
      if (next.length > 0) out[key] = next;
    }
    return out;
  }, [activeTileStates, presetById, showTileStatePills]);

  const activeCityGlobal = useMemo(
    () => normalizeCityGlobalState(selectedMap?.cityGlobal),
    [selectedMap]
  );
  const operationalAllocation = useMemo(() => {
    const out: Record<string, boolean> = {};
    const upkeepWorkersByTypeById: Record<string, Record<PopulationTrackedId, number>> = {};
    const upkeepAnyRequiredById: Record<string, number> = {};
    const upkeepAnyAssignedByTypeById: Record<string, Record<PopulationTrackedId, number>> = {};
    const anyNonElderlyFillOrder: PopulationTrackedId[] = [
      "settlers",
      "engineers",
      "laborers",
      "scholars",
    ];
    const poolByType = createZeroWorkersByType();
    for (const id of TRACKED_POPULATION_IDS) {
      poolByType[id] = Math.max(
        0,
        Math.trunc(
          Number(activeCityGlobal.population[id]?.total ?? 0) || 0
        )
      );
    }
    let elderlyPool = Math.max(
      0,
      Math.trunc(
        Number(activeCityGlobal.population.elderly?.total ?? 0) || 0
      )
    );

    const sortedInstances = [...activeBuildingInstances].sort((a, b) => {
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      if (ta !== tb) return ta - tb;
      return a.id.localeCompare(b.id);
    });

    for (const instance of sortedInstances) {
      const preset = buildingPresetById.get(instance.presetId) ?? null;
      const buildStatus = getInstanceBuildStatus(instance, preset);
      upkeepWorkersByTypeById[instance.id] = createZeroWorkersByType();
      upkeepAnyRequiredById[instance.id] = 0;
      upkeepAnyAssignedByTypeById[instance.id] = createZeroWorkersByType();
      if (instance.enabled === false) {
        out[instance.id] = false;
        continue;
      }
      if (buildStatus !== "active") {
        // 건설중 건물에 투입된 인원은 즉시 점유되어 가용 인구에서 제외된다.
        const assignedBuildWorkers = readAssignedWorkersByTypeFromInstanceMeta(instance.meta);
        for (const id of TRACKED_POPULATION_IDS) {
          const used = Math.max(0, Math.trunc(Number(assignedBuildWorkers[id] ?? 0) || 0));
          if (used <= 0) continue;
          poolByType[id] = Math.max(0, poolByType[id] - used);
        }
        out[instance.id] = false;
        continue;
      }

      const upkeepPopulation = preset?.upkeep?.population ?? {};
      const requiredByType = createZeroWorkersByType();
      for (const id of TRACKED_POPULATION_IDS) {
        requiredByType[id] = Math.max(
          0,
          Math.trunc(Number((upkeepPopulation as Partial<Record<PopulationTrackedId, number>>)[id] ?? 0) || 0)
        );
      }
      const requiredElderly = Math.max(
        0,
        Math.trunc(Number((upkeepPopulation as Partial<Record<UpkeepPopulationId, number>>).elderly ?? 0) || 0)
      );
      let requiredAnyNonElderly = Math.max(
        0,
        Math.trunc(
          Number((upkeepPopulation as Partial<Record<UpkeepPopulationId, number>>).anyNonElderly ?? 0) || 0
        )
      );
      upkeepAnyRequiredById[instance.id] = requiredAnyNonElderly;
      const requestedAnyByType = readUpkeepAnyNonElderlyByTypeFromInstanceMeta(instance.meta);
      const assignedAnyByType = createZeroWorkersByType();

      let canOperate = true;
      const nextPoolByType = { ...poolByType };
      for (const id of TRACKED_POPULATION_IDS) {
        if (nextPoolByType[id] < requiredByType[id]) {
          canOperate = false;
          break;
        }
        nextPoolByType[id] = Math.max(0, nextPoolByType[id] - requiredByType[id]);
      }
      if (canOperate && elderlyPool < requiredElderly) canOperate = false;
      if (canOperate && requiredAnyNonElderly > 0) {
        for (const id of anyNonElderlyFillOrder) {
          if (requiredAnyNonElderly <= 0) break;
          const want = Math.max(0, Math.trunc(Number(requestedAnyByType[id] ?? 0) || 0));
          const used = Math.min(nextPoolByType[id], want, requiredAnyNonElderly);
          assignedAnyByType[id] += used;
          nextPoolByType[id] = Math.max(0, nextPoolByType[id] - used);
          requiredAnyNonElderly -= used;
        }
        for (const id of anyNonElderlyFillOrder) {
          if (requiredAnyNonElderly <= 0) break;
          const used = Math.min(nextPoolByType[id], requiredAnyNonElderly);
          assignedAnyByType[id] += used;
          nextPoolByType[id] = Math.max(0, nextPoolByType[id] - used);
          requiredAnyNonElderly -= used;
        }
        if (requiredAnyNonElderly > 0) canOperate = false;
      }

      if (!canOperate) {
        out[instance.id] = false;
        upkeepAnyAssignedByTypeById[instance.id] = assignedAnyByType;
        continue;
      }

      for (const id of TRACKED_POPULATION_IDS) {
        poolByType[id] = Math.max(0, nextPoolByType[id]);
        upkeepWorkersByTypeById[instance.id][id] =
          Math.max(0, requiredByType[id]) + Math.max(0, assignedAnyByType[id] ?? 0);
      }
      upkeepAnyAssignedByTypeById[instance.id] = assignedAnyByType;
      elderlyPool = Math.max(0, elderlyPool - requiredElderly);
      out[instance.id] = true;
    }

    return {
      operationalById: out,
      availablePoolByType: {
        settlers: Math.max(0, poolByType.settlers),
        engineers: Math.max(0, poolByType.engineers),
        scholars: Math.max(0, poolByType.scholars),
        laborers: Math.max(0, poolByType.laborers),
      } as Record<PopulationTrackedId, number>,
      availableElderly: Math.max(0, elderlyPool),
      upkeepWorkersByTypeById,
      upkeepAnyRequiredById,
      upkeepAnyAssignedByTypeById,
    };
  }, [activeBuildingInstances, activeCityGlobal, buildingPresetById]);
  const instanceOperationalById = operationalAllocation.operationalById;
  const instanceUpkeepWorkersByTypeById = operationalAllocation.upkeepWorkersByTypeById;
  const instanceUpkeepAnyRequiredById = operationalAllocation.upkeepAnyRequiredById;
  const instanceUpkeepAnyAssignedByTypeById = operationalAllocation.upkeepAnyAssignedByTypeById;

  const effectiveCityGlobal = useMemo(() => {
    const next = normalizeCityGlobalState(activeCityGlobal);
    for (const id of TRACKED_POPULATION_IDS) {
      next.population[id].available = Math.max(
        0,
        Math.trunc(Number(operationalAllocation.availablePoolByType[id] ?? 0) || 0)
      );
    }
    next.population.elderly.available = Math.max(
      0,
      Math.trunc(Number(operationalAllocation.availableElderly ?? 0) || 0)
    );
    return next;
  }, [activeCityGlobal, operationalAllocation]);
  const placementPopulationSummary = useMemo(
    () =>
      ALL_POPULATION_IDS.map((id) => {
        const total = Math.max(
          0,
          Math.trunc(Number(effectiveCityGlobal.population[id]?.total ?? 0) || 0)
        );
        const available = Math.max(
          0,
          Math.trunc(Number(effectiveCityGlobal.population[id]?.available ?? 0) || 0)
        );
        return {
          id,
          total,
          available,
          allocated: Math.max(0, total - available),
        };
      }),
    [effectiveCityGlobal.population]
  );
  const placementReportRows = useMemo(() => {
    if (!selectedMap) return [] as Array<{
      instanceId: string;
      tileNumber: number;
      col: number;
      row: number;
      buildingName: string;
      color: string;
      statusLabel: string;
      reason: string;
      required: {
        settlers: number;
        engineers: number;
        scholars: number;
        laborers: number;
        elderly: number;
        anyNonElderly: number;
      };
      assigned: {
        settlers: number;
        engineers: number;
        scholars: number;
        laborers: number;
        elderly: number;
      };
      assignedAnyByType: Record<PopulationTrackedId, number>;
      construction: {
        progressEffort: number;
        requiredEffort: number;
      };
    }>;

    const rows = activeBuildingInstances.map((instance) => {
      const preset = buildingPresetById.get(instance.presetId) ?? null;
      const buildStatus = getInstanceBuildStatus(instance, preset);
      const isActive = buildStatus === "active";
      const isOperational = !!instanceOperationalById[instance.id];
      const isManuallyDisabled = instance.enabled === false;
      const tileNumber = instance.row * selectedMap.cols + instance.col + 1;

      const upkeepPopulation = preset?.upkeep?.population ?? {};
      const required = {
        settlers: Math.max(0, Math.trunc(Number((upkeepPopulation as any).settlers ?? 0) || 0)),
        engineers: Math.max(0, Math.trunc(Number((upkeepPopulation as any).engineers ?? 0) || 0)),
        scholars: Math.max(0, Math.trunc(Number((upkeepPopulation as any).scholars ?? 0) || 0)),
        laborers: Math.max(0, Math.trunc(Number((upkeepPopulation as any).laborers ?? 0) || 0)),
        elderly: Math.max(0, Math.trunc(Number((upkeepPopulation as any).elderly ?? 0) || 0)),
        anyNonElderly:
          instanceUpkeepAnyRequiredById[instance.id] ??
          Math.max(0, Math.trunc(Number((upkeepPopulation as any).anyNonElderly ?? 0) || 0)),
      };
      const assignedByType = !isActive
        ? readAssignedWorkersByTypeFromInstanceMeta(instance.meta)
        : isOperational
          ? instanceUpkeepWorkersByTypeById[instance.id] ?? createZeroWorkersByType()
          : createZeroWorkersByType();
      const assignedAnyByType =
        isActive && isOperational
          ? instanceUpkeepAnyAssignedByTypeById[instance.id] ?? createZeroWorkersByType()
          : createZeroWorkersByType();
      const assignedElderly = isActive && isOperational ? required.elderly : 0;

      let statusLabel = "운영중";
      let reason = "요구 인원 충족";
      if (isManuallyDisabled) {
        statusLabel = "비활성";
        reason = "수동 비활성화";
      } else if (!isActive) {
        statusLabel = "건설중";
        reason = "건설 진행 중";
      } else if (!isOperational) {
        statusLabel = "비활성";
        reason = "유지관리 인원 부족";
      }

      return {
        instanceId: instance.id,
        tileNumber,
        col: instance.col,
        row: instance.row,
        buildingName: preset?.name ?? "이름 없는 건물",
        color: normalizeHexColor(preset?.color, "#e5e7eb"),
        statusLabel,
        reason,
        required,
        assigned: {
          settlers: Math.max(0, assignedByType.settlers ?? 0),
          engineers: Math.max(0, assignedByType.engineers ?? 0),
          scholars: Math.max(0, assignedByType.scholars ?? 0),
          laborers: Math.max(0, assignedByType.laborers ?? 0),
          elderly: Math.max(0, assignedElderly),
        },
        assignedAnyByType,
        construction: {
          progressEffort: Math.max(0, Math.trunc(Number(instance.progressEffort ?? 0) || 0)),
          requiredEffort: Math.max(0, Math.trunc(Number(preset?.effort ?? 0) || 0)),
        },
      };
    });

    rows.sort((a, b) => {
      if (a.tileNumber !== b.tileNumber) return a.tileNumber - b.tileNumber;
      return a.buildingName.localeCompare(b.buildingName, "ko");
    });
    return rows;
  }, [
    selectedMap,
    activeBuildingInstances,
    buildingPresetById,
    instanceOperationalById,
    instanceUpkeepAnyAssignedByTypeById,
    instanceUpkeepAnyRequiredById,
    instanceUpkeepWorkersByTypeById,
  ]);
  const totalPopulation = useMemo(
    () =>
      ALL_POPULATION_IDS.reduce(
        (sum, id) => sum + Math.max(0, effectiveCityGlobal.population[id]?.total ?? 0),
        0
      ),
    [effectiveCityGlobal.population]
  );
  const warehouseEntries = useMemo(() => {
    const warehouse = effectiveCityGlobal.warehouse ?? {};
    const byName = new Map<string, number>();
    for (const [rawName, rawAmount] of Object.entries(warehouse)) {
      const name = String(rawName ?? "").trim();
      if (!name) continue;
      const amount = Math.max(0, Math.trunc(Number(rawAmount) || 0));
      if (amount <= 0) continue;
      byName.set(name, amount);
    }
    for (const entry of itemCatalogEntries) {
      if (!entry?.name) continue;
      if (!byName.has(entry.name)) continue;
      byName.set(entry.name, Math.max(0, Math.trunc(Number(byName.get(entry.name) ?? 0))));
    }
    return [...byName.entries()]
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => a.name.localeCompare(b.name, "ko"));
  }, [effectiveCityGlobal.warehouse, itemCatalogEntries]);
  const dailyResourceDeltaById = useMemo(() => {
    const totals: Record<ResourceId, number> = {
      wood: 0,
      stone: 0,
      fabric: 0,
      weave: 0,
      food: 0,
      research: 0,
      order: 0,
      gold: 0,
    };
    if (!selectedMap) return totals;
    const activeBuiltInstances = activeBuildingInstances.filter((entry) => {
      if (entry.enabled === false) return false;
      const preset = buildingPresetById.get(entry.presetId) ?? null;
      return getInstanceBuildStatus(entry, preset) === "active";
    });
    const operationalInstances = activeBuiltInstances.filter(
      (entry) => instanceOperationalById[entry.id]
    );
    for (const instance of operationalInstances) {
      const preset = buildingPresetById.get(instance.presetId);
      if (!preset) continue;

      const ruleContext: RuleEvalContext = {
        col: instance.col,
        row: instance.row,
        map: selectedMap,
        cityGlobal: effectiveCityGlobal,
        tileStates: activeTileStates,
        tileRegions: activeTileRegionStates,
        buildingInstances: activeBuiltInstances,
      };

      const upkeepResources = preset.upkeep?.resources ?? {};
      for (const id of BUILDING_PRESET_RESOURCE_IDS) {
        const upkeepValue = Number(upkeepResources[id] ?? 0);
        if (!Number.isFinite(upkeepValue) || upkeepValue === 0) continue;
        totals[id] -= upkeepValue;
      }

      for (const rule of preset.effects?.daily ?? []) {
        const intervalDays = Math.max(1, safeInt(rule.intervalDays, 1));
        const nextDay = Math.max(0, safeInt(effectiveCityGlobal.day, 0) + 1);
        const shouldApplyThisTick =
          intervalDays <= 1 || (nextDay % intervalDays === 0);
        if (!shouldApplyThisTick) continue;
        const evalResult = evaluateRulePredicatePreview(ruleContext, rule.when);
        if (!evalResult.matched || evalResult.repeatCount <= 0) continue;
        const repeatMultiplier = Math.max(1, evalResult.repeatCount);
        for (const action of rule.actions ?? []) {
          if (action.kind !== "adjustResource") continue;
          const value = evalRuleExpr(ruleContext, action.delta);
          if (!Number.isFinite(value) || value === 0) continue;
          if ((ALL_RESOURCE_IDS as readonly string[]).includes(String(action.resourceId))) {
            totals[action.resourceId as ResourceId] += value * repeatMultiplier;
          }
        }
      }
    }
    for (const id of ALL_RESOURCE_IDS) {
      totals[id] = roundTo2(totals[id]);
    }
    return totals;
  }, [
    activeBuildingInstances,
    activeBuildingPresets,
    effectiveCityGlobal,
    instanceOperationalById,
    activeTileRegionStates,
    activeTileStates,
    buildingPresetById,
    selectedMap,
  ]);

  const resourceStatusRows = useMemo(() => {
    if (!selectedMap) return [] as ResourceStatusGroupRow[];

    const targetResourceIdSet = new Set<ResourceId>([
      "wood",
      "stone",
      "fabric",
      "weave",
      "food",
      "research",
      "gold",
    ]);

    const activeBuiltInstances = activeBuildingInstances.filter((entry) => {
      if (entry.enabled === false) return false;
      const preset = buildingPresetById.get(entry.presetId) ?? null;
      return getInstanceBuildStatus(entry, preset) === "active";
    });
    const operationalInstances = activeBuiltInstances.filter(
      (entry) => instanceOperationalById[entry.id]
    );
    const nextDay = Math.max(0, safeInt(effectiveCityGlobal.day, 0) + 1);

    const toLabel = (resourceId: string) => RESOURCE_LABELS[resourceId as ResourceId];
    const resourceMap = new Map<string, ResourceStatusGroupRow>();

    for (const instance of operationalInstances) {
      const preset = buildingPresetById.get(instance.presetId);
      if (!preset) continue;

      const deltasById = new Map<string, number>();
      const upkeepResources = preset.upkeep?.resources ?? {};
      for (const id of BUILDING_PRESET_RESOURCE_IDS) {
        const resourceId = String(id ?? "").trim();
        if (!resourceId || !targetResourceIdSet.has(resourceId as ResourceId)) continue;
        const upkeepValue = Number(upkeepResources[id] ?? 0);
        if (!Number.isFinite(upkeepValue) || upkeepValue === 0) continue;
        deltasById.set(resourceId, (deltasById.get(resourceId) ?? 0) - upkeepValue);
      }

      const ruleContext: RuleEvalContext = {
        col: instance.col,
        row: instance.row,
        map: selectedMap,
        cityGlobal: effectiveCityGlobal,
        tileStates: activeTileStates,
        tileRegions: activeTileRegionStates,
        buildingInstances: activeBuiltInstances,
      };
      for (const rule of preset.effects?.daily ?? []) {
        const intervalDays = Math.max(1, safeInt(rule.intervalDays, 1));
        const shouldApplyThisTick = intervalDays <= 1 || nextDay % intervalDays === 0;
        if (!shouldApplyThisTick) continue;
        const evalResult = evaluateRulePredicatePreview(ruleContext, rule.when);
        if (!evalResult.matched || evalResult.repeatCount <= 0) continue;
        const repeatMultiplier = Math.max(1, evalResult.repeatCount);
        for (const action of rule.actions ?? []) {
          if (action.kind !== "adjustResource") continue;
          const resourceId = String(action.resourceId ?? "").trim();
          if (!resourceId || !targetResourceIdSet.has(resourceId as ResourceId)) continue;
          const value = evalRuleExpr(ruleContext, action.delta);
          if (!Number.isFinite(value) || value === 0) continue;
          deltasById.set(resourceId, (deltasById.get(resourceId) ?? 0) + value * repeatMultiplier);
        }
      }

      const deltas = [...deltasById.entries()]
        .map(([resourceId, value]) => ({
          resourceId,
          label: toLabel(resourceId),
          value: roundTo2(value),
        }))
        .filter((entry) => entry.value !== 0)
        .sort((a, b) => a.label.localeCompare(b.label, "ko"));
      if (deltas.length === 0) continue;

      const tileK = tileKey(instance.col, instance.row);
      const tileNumber = instance.row * selectedMap.cols + instance.col + 1;
      for (const delta of deltas) {
        const group =
          resourceMap.get(delta.resourceId) ??
          ({
            resourceId: delta.resourceId,
            label: delta.label,
            total: 0,
            tiles: [],
          } satisfies ResourceStatusGroupRow);
        group.total = roundTo2(group.total + delta.value);
        const tileExisting =
          group.tiles.find((entry) => entry.tileKey === tileK) ??
          ({
            tileKey: tileK,
            tileNumber,
            col: instance.col,
            row: instance.row,
            value: 0,
            buildings: [],
          } satisfies ResourceStatusTileRow);
        tileExisting.value = roundTo2(tileExisting.value + delta.value);
        tileExisting.buildings.push({
          instanceId: instance.id,
          buildingName: preset.name,
          color: preset.color,
          value: delta.value,
        });
        if (!group.tiles.some((entry) => entry.tileKey === tileK)) {
          group.tiles.push(tileExisting);
        }
        resourceMap.set(delta.resourceId, group);
      }
    }

    const rows = [...resourceMap.values()];
    for (const row of rows) {
      row.tiles.sort((a, b) => a.tileNumber - b.tileNumber);
      for (const tile of row.tiles) {
        tile.buildings.sort((a, b) => a.buildingName.localeCompare(b.buildingName, "ko"));
      }
    }
    rows.sort((a, b) => a.label.localeCompare(b.label, "ko"));
    return rows;
  }, [
    selectedMap,
    activeBuildingInstances,
    buildingPresetById,
    instanceOperationalById,
    effectiveCityGlobal,
    activeTileStates,
    activeTileRegionStates,
  ]);

  const tileYieldPreview = useMemo(() => {
    if (!selectedMap || !tileYieldViewer) {
      return { rows: [] as TileYieldBuildingRow[], totals: [] as TileYieldDelta[] };
    }

    const activeBuiltInstances = activeBuildingInstances.filter((entry) => {
      if (entry.enabled === false) return false;
      const preset = buildingPresetById.get(entry.presetId) ?? null;
      return getInstanceBuildStatus(entry, preset) === "active";
    });
    const operationalInstances = activeBuiltInstances.filter(
      (entry) => instanceOperationalById[entry.id]
    );
    const targetInstances = operationalInstances.filter(
      (entry) => entry.col === tileYieldViewer.col && entry.row === tileYieldViewer.row
    );
    const nextDay = Math.max(0, safeInt(effectiveCityGlobal.day, 0) + 1);
    const toLabel = (resourceId: string) => {
      const trimmed = String(resourceId ?? "").trim();
      if (!trimmed) return "-";
      if ((ALL_RESOURCE_IDS as readonly string[]).includes(trimmed)) {
        return RESOURCE_LABELS[trimmed as ResourceId];
      }
      return getBuildingResourceLabel(trimmed as BuildingResourceId);
    };

    const rows: TileYieldBuildingRow[] = targetInstances.map((instance) => {
      const preset = buildingPresetById.get(instance.presetId);
      const deltasById = new Map<string, number>();
      if (!preset) {
        return {
          instanceId: instance.id,
          buildingName: "건물",
          color: "#eab308",
          deltas: [],
        };
      }

      const upkeepResources = preset.upkeep?.resources ?? {};
      for (const [resourceIdRaw, rawValue] of Object.entries(upkeepResources)) {
        const resourceId = String(resourceIdRaw ?? "").trim();
        if (!resourceId) continue;
        const upkeepValue = Number(rawValue ?? 0);
        if (!Number.isFinite(upkeepValue) || upkeepValue === 0) continue;
        deltasById.set(resourceId, (deltasById.get(resourceId) ?? 0) - upkeepValue);
      }

      const ruleContext: RuleEvalContext = {
        col: instance.col,
        row: instance.row,
        map: selectedMap,
        cityGlobal: effectiveCityGlobal,
        tileStates: activeTileStates,
        tileRegions: activeTileRegionStates,
        buildingInstances: activeBuiltInstances,
      };
      for (const rule of preset.effects?.daily ?? []) {
        const intervalDays = Math.max(1, safeInt(rule.intervalDays, 1));
        const shouldApplyThisTick = intervalDays <= 1 || nextDay % intervalDays === 0;
        if (!shouldApplyThisTick) continue;
        const evalResult = evaluateRulePredicatePreview(ruleContext, rule.when);
        if (!evalResult.matched || evalResult.repeatCount <= 0) continue;
        const repeatMultiplier = Math.max(1, evalResult.repeatCount);
        for (const action of rule.actions ?? []) {
          if (action.kind !== "adjustResource") continue;
          const resourceId = String(action.resourceId ?? "").trim();
          if (!resourceId) continue;
          const value = evalRuleExpr(ruleContext, action.delta);
          if (!Number.isFinite(value) || value === 0) continue;
          deltasById.set(resourceId, (deltasById.get(resourceId) ?? 0) + value * repeatMultiplier);
        }
      }

      const deltas = [...deltasById.entries()]
        .map(([resourceId, value]) => ({
          resourceId,
          label: toLabel(resourceId),
          value: roundTo2(value),
        }))
        .filter((entry) => entry.value !== 0)
        .sort((a, b) => a.label.localeCompare(b.label, "ko"));

      return {
        instanceId: instance.id,
        buildingName: preset.name,
        color: preset.color,
        deltas,
      };
    });

    const totalsById = new Map<string, number>();
    for (const row of rows) {
      for (const entry of row.deltas) {
        totalsById.set(entry.resourceId, (totalsById.get(entry.resourceId) ?? 0) + entry.value);
      }
    }
    const totals = [...totalsById.entries()]
      .map(([resourceId, value]) => ({
        resourceId,
        label: toLabel(resourceId),
        value: roundTo2(value),
      }))
      .filter((entry) => entry.value !== 0)
      .sort((a, b) => a.label.localeCompare(b.label, "ko"));

    rows.sort((a, b) => a.buildingName.localeCompare(b.buildingName, "ko"));
    return { rows, totals };
  }, [
    selectedMap,
    tileYieldViewer,
    activeBuildingInstances,
    buildingPresetById,
    instanceOperationalById,
    effectiveCityGlobal,
    activeTileStates,
    activeTileRegionStates,
  ]);

  useEffect(() => {
    if (!selectedMap) setSettingsOpen(false);
  }, [selectedMap]);

  useEffect(() => {
    if (!selectedMapId) setPlacementReportOpen(false);
  }, [selectedMapId]);

  useEffect(() => {
    if (!selectedMapId) setResourceStatusModalOpen(false);
  }, [selectedMapId]);

  useEffect(() => {
    if (!isPresetMode) return;
    setSettingsOpen(false);
    setMapListOpen(false);
    setSelectedHexes([]);
    setTileContextMenu(null);
    setTileEditor(null);
    setTileBuildingEditor(null);
    setTileYieldViewer(null);
  }, [isPresetMode]);

  useEffect(() => {
    const prevMapId = prevSelectedMapIdRef.current;
    const mapIdChanged = prevMapId !== selectedMapId;
    prevSelectedMapIdRef.current = selectedMapId;

    setDraft(buildDraft(selectedMap));

    if (!mapIdChanged) return;

    setPresetMode("tile");
    setSelectedHex(null);
    setSelectedHexes([]);
    setTileContextMenu(null);
    setTileEditor(null);
    setTileRegionEditor(null);
    setTileBuildingEditor(null);
    setTileYieldViewer(null);
    setTileBuildingSearchQuery("");
    setBuildingDraft(createDefaultBuildingDraftState());
    tileRegionDraftRef.current = null;
    setLoadedSize(null);
    syncingImageMetaRef.current = null;
    setDragging(false);
    dragRef.current.active = false;
    suppressClickRef.current = false;
  }, [selectedMapId, selectedMap]);

  const imageUrl = resolveImageUrl(selectedMap?.imageUrl);
  const imageWidth = loadedSize?.width ?? selectedMap?.imageWidth ?? 0;
  const imageHeight = loadedSize?.height ?? selectedMap?.imageHeight ?? 0;

  const updateVisibleImageBounds = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport || zoom <= 0 || imageWidth <= 0 || imageHeight <= 0) {
      setVisibleImageBounds(null);
      return;
    }
    const next: ImageViewportBounds = {
      left: viewport.scrollLeft / zoom,
      top: viewport.scrollTop / zoom,
      right: (viewport.scrollLeft + viewport.clientWidth) / zoom,
      bottom: (viewport.scrollTop + viewport.clientHeight) / zoom,
    };
    setVisibleImageBounds((prev) => {
      if (
        prev &&
        Math.abs(prev.left - next.left) < 0.75 &&
        Math.abs(prev.top - next.top) < 0.75 &&
        Math.abs(prev.right - next.right) < 0.75 &&
        Math.abs(prev.bottom - next.bottom) < 0.75
      ) {
        return prev;
      }
      return next;
    });
  }, [imageHeight, imageWidth, zoom]);

  const scheduleVisibleBoundsUpdate = useCallback(() => {
    if (visibleBoundsRafRef.current != null) return;
    visibleBoundsRafRef.current = window.requestAnimationFrame(() => {
      visibleBoundsRafRef.current = null;
      updateVisibleImageBounds();
    });
  }, [updateVisibleImageBounds]);

  useEffect(() => {
    if (!tileContextMenu) return;
    const closeIfOutside = (event: MouseEvent) => {
      const el = tileContextMenuRef.current;
      const target = event.target as Node | null;
      if (el && target && el.contains(target)) return;
      setTileContextMenu(null);
    };
    const close = () => setTileContextMenu(null);
    window.addEventListener("mousedown", closeIfOutside);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("mousedown", closeIfOutside);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [tileContextMenu]);

  useEffect(() => {
    scheduleVisibleBoundsUpdate();
  }, [scheduleVisibleBoundsUpdate, selectedMapId, imageWidth, imageHeight, zoom, settingsOpen]);

  useEffect(() => {
    const onResize = () => scheduleVisibleBoundsUpdate();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      if (visibleBoundsRafRef.current != null) {
        window.cancelAnimationFrame(visibleBoundsRafRef.current);
        visibleBoundsRafRef.current = null;
      }
    };
  }, [scheduleVisibleBoundsUpdate]);

  const polygons = useMemo(() => {
    if (!selectedMap || !imageWidth || !imageHeight) return [];
    const out: Array<{
      key: string;
      tileKey: string;
      col: number;
      row: number;
      points: string;
      cx: number;
      cy: number;
    }> = [];
    for (let row = 0; row < selectedMap.rows; row += 1) {
      for (let col = 0; col < selectedMap.cols; col += 1) {
        const { points, cx, cy } = getHexLayout(
          selectedMap.orientation,
          col,
          row,
          selectedMap.hexSize,
          selectedMap.originX,
          selectedMap.originY
        );
        out.push({ key: `${col}-${row}`, tileKey: tileKey(col, row), col, row, points, cx, cy });
      }
    }
    return out;
  }, [selectedMap, imageWidth, imageHeight]);

  const handleCreate = async () => {
    const name = createName.trim();
    if (!name) {
      setErr("지도의 이름을 입력해 주세요.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const created = await createWorldMap({ name });
      setCreateName("");
      await loadMaps(created?.id ?? null);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!selectedMap) return;
    setBusy(true);
    setErr(null);
    try {
      const updated = await updateWorldMap(selectedMap.id, {
        name: draft.name.trim(),
        hexSize: Number(draft.hexSize),
        originX: Number(draft.originX),
        originY: Number(draft.originY),
        cols: Number(draft.cols),
        rows: Number(draft.rows),
        orientation: draft.orientation,
      });
      setMaps((prev) => prev.map((entry) => (entry.id === updated.id ? updated : entry)));
      setDraft(buildDraft(updated));
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedMap) return;
    const ok = window.confirm(`지도를 삭제하시겠습니까? ${selectedMap.name}`);
    if (!ok) return;
    setBusy(true);
    setErr(null);
    try {
      await deleteWorldMap(selectedMap.id);
      await loadMaps(null);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const handleUploadImage = async (file: File | null) => {
    if (!selectedMap || !file) return;
    setBusy(true);
    setErr(null);
    try {
      const updated = await uploadWorldMapImage(selectedMap.id, file);
      setMaps((prev) => prev.map((entry) => (entry.id === updated.id ? updated : entry)));
      setLoadedSize(null);
      syncingImageMetaRef.current = null;
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const syncLoadedImageMeta = async (width: number, height: number) => {
    if (!selectedMap) return;
    if (
      selectedMap.imageWidth === width &&
      selectedMap.imageHeight === height &&
      syncingImageMetaRef.current === selectedMap.id
    ) {
      return;
    }
    syncingImageMetaRef.current = selectedMap.id;
    try {
      const updated = await updateWorldMap(selectedMap.id, {
        imageWidth: width,
        imageHeight: height,
      });
      setMaps((prev) => prev.map((entry) => (entry.id === updated.id ? updated : entry)));
    } catch {
      // dimension sync failure should not block viewer usage
    }
  };

  const handleViewportMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (viewMode !== "drag") return;
    if (e.button !== 0) return;
    e.preventDefault();
    const viewport = viewportRef.current;
    if (!viewport) return;
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      startLeft: viewport.scrollLeft,
      startTop: viewport.scrollTop,
      moved: false,
    };
    setDragging(true);
  };

  const handleViewportMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (viewMode !== "drag") return;
    if (!dragRef.current.active) return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
      dragRef.current.moved = true;
      suppressClickRef.current = true;
    }
    viewport.scrollLeft = dragRef.current.startLeft - dx;
    viewport.scrollTop = dragRef.current.startTop - dy;
  };

  const endDragging = () => {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;
    setDragging(false);
    scheduleVisibleBoundsUpdate();
    if (dragRef.current.moved) {
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    }
  };

  const handleViewportWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (viewMode !== "drag") return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = viewport.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const contentX = viewport.scrollLeft + mouseX;
    const contentY = viewport.scrollTop + mouseY;
    const delta = e.deltaY < 0 ? 0.04 : -0.04;
    setZoom((prev) => {
      const next = Math.max(0.2, Math.min(2.5, Number((prev + delta).toFixed(2))));
      if (next === prev) return prev;
      const ratio = next / prev;
      window.requestAnimationFrame(() => {
        if (!viewportRef.current) return;
        viewportRef.current.scrollLeft = contentX * ratio - mouseX;
        viewportRef.current.scrollTop = contentY * ratio - mouseY;
        scheduleVisibleBoundsUpdate();
      });
      return next;
    });
  };

  const handleSaveCityGlobal = async () => {
    if (!selectedMap) return;
    const formEl = citySettingsFormRef.current;
    if (!formEl) return;
    const formData = new FormData(formEl);
    const parseNonNegativeInt = (name: string, fallback: number) => {
      const raw = String(formData.get(name) ?? "").trim();
      if (!raw) return fallback;
      const n = Math.trunc(Number(raw));
      if (!Number.isFinite(n)) return fallback;
      return Math.max(0, n);
    };
    const parsePercent = (name: string, fallback: number) => {
      const raw = String(formData.get(name) ?? "").trim();
      if (!raw) return fallback;
      const n = Number(raw);
      if (!Number.isFinite(n)) return fallback;
      return Math.max(0, Math.min(100, n));
    };
    const nextState = normalizeCityGlobalState({
      values: {
        ...effectiveCityGlobal.values,
      },
      overflowToGold: {
        wood: parseNonNegativeInt("overflow_rate_wood", effectiveCityGlobal.overflowToGold.wood),
        stone: parseNonNegativeInt("overflow_rate_stone", effectiveCityGlobal.overflowToGold.stone),
        fabric: parseNonNegativeInt("overflow_rate_fabric", effectiveCityGlobal.overflowToGold.fabric),
        weave: parseNonNegativeInt("overflow_rate_weave", effectiveCityGlobal.overflowToGold.weave),
        food: parseNonNegativeInt("overflow_rate_food", effectiveCityGlobal.overflowToGold.food),
      },
      warehouse: {
        ...(effectiveCityGlobal.warehouse ?? {}),
      },
      caps: {
        wood: parseNonNegativeInt("cap_wood", effectiveCityGlobal.caps.wood),
        stone: parseNonNegativeInt("cap_stone", effectiveCityGlobal.caps.stone),
        fabric: parseNonNegativeInt("cap_fabric", effectiveCityGlobal.caps.fabric),
        weave: parseNonNegativeInt("cap_weave", effectiveCityGlobal.caps.weave),
        food: parseNonNegativeInt("cap_food", effectiveCityGlobal.caps.food),
      },
      day: parseNonNegativeInt("day", effectiveCityGlobal.day),
      satisfaction: parsePercent("satisfaction", effectiveCityGlobal.satisfaction),
      populationCap: parseNonNegativeInt("population_cap", effectiveCityGlobal.populationCap),
      population: {
        settlers: {
          available: parseNonNegativeInt(
            "pop_settlers_available",
            effectiveCityGlobal.population.settlers.available ?? 0
          ),
          total: parseNonNegativeInt("pop_settlers_total", effectiveCityGlobal.population.settlers.total),
        },
        engineers: {
          available: parseNonNegativeInt(
            "pop_engineers_available",
            effectiveCityGlobal.population.engineers.available ?? 0
          ),
          total: parseNonNegativeInt(
            "pop_engineers_total",
            effectiveCityGlobal.population.engineers.total
          ),
        },
        scholars: {
          available: parseNonNegativeInt(
            "pop_scholars_available",
            effectiveCityGlobal.population.scholars.available ?? 0
          ),
          total: parseNonNegativeInt("pop_scholars_total", effectiveCityGlobal.population.scholars.total),
        },
        laborers: {
          available: parseNonNegativeInt(
            "pop_laborers_available",
            effectiveCityGlobal.population.laborers.available ?? 0
          ),
          total: parseNonNegativeInt("pop_laborers_total", effectiveCityGlobal.population.laborers.total),
        },
        elderly: {
          available: parseNonNegativeInt(
            "pop_elderly_available",
            effectiveCityGlobal.population.elderly.available ?? 0
          ),
          total: parseNonNegativeInt("pop_elderly_total", effectiveCityGlobal.population.elderly.total),
        },
      },
    });
    for (const id of TRACKED_POPULATION_IDS) {
      const entry = nextState.population[id];
      if ((entry.available ?? 0) > entry.total) {
        entry.available = entry.total;
      }
    }
    if (
      (nextState.population.elderly.available ?? 0) > nextState.population.elderly.total
    ) {
      nextState.population.elderly.available = nextState.population.elderly.total;
    }
    const converted = applyOverflowToGold(nextState);
    setBusy(true);
    setErr(null);
    try {
      const updated = await updateWorldMap(selectedMap.id, {
        cityGlobal: converted.nextState,
      });
      setMaps((prev) =>
        prev.map((entry) =>
          entry.id === updated.id
            ? {
                ...entry,
                ...updated,
                cityGlobal: converted.nextState,
              }
            : entry
        )
      );
      if (converted.convertedGold > 0 && converted.details.length > 0) {
        setOverflowNotice({
          beforeGold: Math.max(0, Math.trunc(Number(nextState.values.gold ?? 0) || 0)),
          afterGold: Math.max(0, Math.trunc(Number(converted.nextState.values.gold ?? 0) || 0)),
          totalGoldGain: converted.convertedGold,
          details: converted.details,
        });
      }
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const applyOverflowToGold = useCallback((input: CityGlobalState) => {
    const nextState = normalizeCityGlobalState(input);
    let changed = false;
    let convertedGold = 0;
    const details: OverflowConversionDetail[] = [];
    for (const id of CAPPED_RESOURCE_IDS) {
      const cap = Math.max(0, Math.trunc(Number(nextState.caps[id] ?? 0) || 0));
      const current = Math.max(0, Math.trunc(Number(nextState.values[id] ?? 0) || 0));
      if (current <= cap) continue;
      const overflow = current - cap;
      nextState.values[id] = cap;
      changed = true;
      const rate = Math.max(0, Math.trunc(Number(nextState.overflowToGold[id] ?? 0) || 0));
      if (rate > 0) {
        const goldGain = overflow * rate;
        nextState.values.gold = Math.max(
          0,
          Math.trunc(Number(nextState.values.gold ?? 0) || 0) + goldGain
        );
        convertedGold += goldGain;
        details.push({
          resourceId: id,
          overflowAmount: overflow,
          goldGain,
        });
      }
    }
    return { nextState, changed, convertedGold, details };
  }, []);

  const handleApplyResourceAdjust = async () => {
    if (!selectedMap) return;
    const raw = Number(resourceAdjustAmount);
    const amount = Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : NaN;
    if (!Number.isFinite(amount)) {
      setErr("수치를 숫자로 입력해 주세요.");
      return;
    }

    const current = effectiveCityGlobal.values[resourceAdjustTarget] ?? 0;
    const signed = resourceAdjustMode === "inc" ? amount : -amount;
    let nextValue = current + signed;
    if (nextValue < 0) nextValue = 0;
    const nextState = normalizeCityGlobalState({
      ...effectiveCityGlobal,
      values: {
        ...effectiveCityGlobal.values,
        [resourceAdjustTarget]: nextValue,
      },
    });
    const beforeGold = Math.max(0, Math.trunc(Number(nextState.values.gold ?? 0) || 0));
    const converted = applyOverflowToGold(nextState);

    setBusy(true);
    setErr(null);
    try {
      const updated = await updateWorldMap(selectedMap.id, { cityGlobal: converted.nextState });
      setMaps((prev) =>
        prev.map((entry) =>
          entry.id === updated.id
            ? {
                ...entry,
                ...updated,
                cityGlobal: converted.nextState,
              }
            : entry
        )
      );
      if (converted.convertedGold > 0 && converted.details.length > 0) {
        setOverflowNotice({
          beforeGold,
          afterGold: Math.max(
            0,
            Math.trunc(Number(converted.nextState.values.gold ?? 0) || 0)
          ),
          totalGoldGain: converted.convertedGold,
          details: converted.details,
        });
      }
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const handleRunDailyRules = async () => {
    if (!selectedMap) return;
    const parsed = Math.trunc(Number(dailyRunDays));
    const days = Number.isFinite(parsed) ? Math.max(1, parsed) : 1;
    const startDay = Math.max(0, Math.trunc(Number(activeCityGlobal.day ?? 0) || 0));
    const startGold = Math.max(0, Math.trunc(Number(activeCityGlobal.values.gold ?? 0) || 0));
    setBusy(true);
    setErr(null);
    try {
      const result = await runWorldMapDaily(selectedMap.id, days);
      const dayCandidate =
        result?.day ??
        result?.currentDay ??
        result?.cityGlobal?.day ??
        result?.map?.cityGlobal?.day;
      const appliedRulesCandidate =
        result?.appliedRules ?? result?.ruleCount ?? result?.summary?.appliedRules;
      const appliedActionsCandidate =
        result?.appliedActions ?? result?.actionCount ?? result?.summary?.appliedActions;
      const failedRulesCandidate =
        result?.failedRules ?? result?.failureCount ?? result?.summary?.failedRules;

      const day = Number.isFinite(Number(dayCandidate))
        ? Math.max(0, Math.trunc(Number(dayCandidate)))
        : undefined;
      const appliedRules = Number.isFinite(Number(appliedRulesCandidate))
        ? Math.max(0, Math.trunc(Number(appliedRulesCandidate)))
        : undefined;
      const appliedActions = Number.isFinite(Number(appliedActionsCandidate))
        ? Math.max(0, Math.trunc(Number(appliedActionsCandidate)))
        : undefined;
      const failedRules = Number.isFinite(Number(failedRulesCandidate))
        ? Math.max(0, Math.trunc(Number(failedRulesCandidate)))
        : undefined;

      const rawLogs = Array.isArray(result?.logs) ? result.logs : [];
      const failedLines = rawLogs
        .filter((entry: any) => String(entry?.status ?? "") === "failed")
        .map((entry: any) => {
          const statusRaw = String(entry?.status ?? "");
          const status =
            statusRaw === "applied"
              ? "적용"
              : statusRaw === "failed"
                ? "실패"
                : statusRaw === "skipped"
                  ? "스킵"
                  : "기타";
          const presetName = String(entry?.presetName ?? "").trim() || "건물";
          const ruleId = String(entry?.ruleId ?? "").trim() || "-";
          const repeatCount = Number.isFinite(Number(entry?.repeatCount))
            ? Math.max(1, Math.trunc(Number(entry.repeatCount)))
            : null;
          const actionsApplied = Number.isFinite(Number(entry?.actionsApplied))
            ? Math.max(0, Math.trunc(Number(entry.actionsApplied)))
            : null;
          const reason = String(entry?.reason ?? "").trim();
          const suffix: string[] = [];
          if (repeatCount != null) suffix.push(`반복 ${repeatCount}`);
          if (actionsApplied != null) suffix.push(`액션 ${actionsApplied}`);
          if (reason) suffix.push(reason);
          const tail = suffix.length > 0 ? ` · ${suffix.join(" · ")}` : "";
          return `[${status}] ${presetName} · 규칙 ${ruleId}${tail}`;
        })
        .slice(-200);
      setDailyRunLogs(failedLines);

      await refreshCurrentMapOnly(selectedMap.id);
      const hasFailure =
        (failedRules != null ? failedRules > 0 : false) ||
        rawLogs.some((entry: any) => String(entry?.status ?? "") === "failed");

      if (hasFailure) {
        setDailyRunResult("일일 규칙 실행 중 실패가 있어 날짜를 유지했습니다.");
        const latest = await getWorldMap(selectedMap.id);
        if (latest?.id) {
          const latestCity = normalizeCityGlobalState(latest.cityGlobal);
          if ((latestCity.day ?? 0) !== startDay) {
            const rolled = await updateWorldMap(selectedMap.id, {
              cityGlobal: { ...latestCity, day: startDay },
            });
            setMaps((prev) => prev.map((entry) => (entry.id === rolled.id ? rolled : entry)));
          }
        }
        await refreshCurrentMapOnly(selectedMap.id);
      } else {
        const segments = [`일일 규칙 ${formatWithCommas(days)}일 실행 완료`];
        if (day != null) segments.push(`Day ${String(day).padStart(3, "0")}`);
        if (appliedRules != null) segments.push(`규칙 ${formatWithCommas(appliedRules)}개`);
        if (appliedActions != null) segments.push(`액션 ${formatWithCommas(appliedActions)}개`);
        setDailyRunResult(segments.join(" · "));
      }

      const overflowConvertedGoldCandidate =
        result?.overflowConvertedGold ?? result?.summary?.overflowConvertedGold;
      const overflowDetailsCandidate = Array.isArray(result?.overflowDetails)
        ? result.overflowDetails
        : Array.isArray(result?.summary?.overflowDetails)
          ? result.summary.overflowDetails
          : [];
      const overflowConvertedGold = Number.isFinite(Number(overflowConvertedGoldCandidate))
        ? Math.max(0, Math.trunc(Number(overflowConvertedGoldCandidate)))
        : 0;
      const overflowDetails = overflowDetailsCandidate
        .map((entry: any) => {
          const resourceId = String(entry?.resourceId ?? "").trim() as CappedResourceId;
          if (!CAPPED_RESOURCE_IDS.includes(resourceId)) return null;
          const overflowAmount = Number.isFinite(Number(entry?.overflowAmount))
            ? Math.max(0, Math.trunc(Number(entry.overflowAmount)))
            : 0;
          const goldGain = Number.isFinite(Number(entry?.goldGain))
            ? Math.max(0, Math.trunc(Number(entry.goldGain)))
            : 0;
          if (overflowAmount <= 0 || goldGain <= 0) return null;
          return { resourceId, overflowAmount, goldGain };
        })
        .filter((entry: any): entry is OverflowConversionDetail => entry != null);
      if (overflowConvertedGold > 0 && overflowDetails.length > 0) {
        setOverflowNotice({
          beforeGold: startGold,
          afterGold: startGold + overflowConvertedGold,
          totalGoldGain: overflowConvertedGold,
          details: overflowDetails,
        });
      }

      await releaseWorkersFromCompletedBuildings(selectedMap.id);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const syncMapAfterTileUpdate = (
    updated: WorldMap,
    nextPresets: MapTileStatePreset[],
    nextStates: Record<string, MapTileStateAssignment[]>,
    nextRegionStates: Record<string, MapTileRegionState>
  ) => {
    setMaps((prev) => prev.map((entry) => (entry.id === updated.id ? updated : entry)));
    setTilePresetsByMap((prev) => ({ ...prev, [updated.id]: nextPresets }));
    setTileStatesByMap((prev) => ({ ...prev, [updated.id]: nextStates }));
    setTileRegionStatesByMap((prev) => ({ ...prev, [updated.id]: nextRegionStates }));
  };

  const setStatesForCurrentMap = (next: Record<string, MapTileStateAssignment[]>) => {
    if (!selectedMapId) return;
    setTileStatesByMap((prev) => ({ ...prev, [selectedMapId]: next }));
  };

  const setRegionStatesForCurrentMap = (next: Record<string, MapTileRegionState>) => {
    if (!selectedMapId) return;
    setTileRegionStatesByMap((prev) => ({ ...prev, [selectedMapId]: next }));
  };

  const persistCurrentMapTileData = async (
    nextPresets: MapTileStatePreset[],
    nextStates: Record<string, MapTileStateAssignment[]>,
    nextRegionStates: Record<string, MapTileRegionState> = activeTileRegionStates
  ) => {
    if (!selectedMap) return;
    const updated = await updateWorldMap(selectedMap.id, {
      tileStatePresets: nextPresets,
      tileStateAssignments: nextStates,
      tileRegionStates: nextRegionStates,
    });
    const normalizedPresets = normalizeTilePresets(updated.tileStatePresets ?? []);
    const normalizedStates = normalizeTileStateAssignments(
      updated.tileStateAssignments ?? {}
    );
    const normalizedRegionStates = normalizeTileRegionStates(
      updated.tileRegionStates ?? nextRegionStates
    );
    syncMapAfterTileUpdate(updated, normalizedPresets, normalizedStates, normalizedRegionStates);
  };

  const handleCreateTilePreset = async () => {
    if (!isAdmin) {
      setErr("관리자만 타일 프리셋을 등록할 수 있습니다.");
      return;
    }
    if (!selectedMap) {
      setErr("지도를 먼저 선택해 주세요.");
      return;
    }
    const name = presetDraftName.trim();
    if (!name) {
      setErr("프리셋 이름을 입력해 주세요.");
      return;
    }
    const color = normalizeHexColor(presetDraftColorHex);
    const hasValue = presetDraftHasValue;
    const nameKey = getTilePresetNameKey({ name });
    if (sharedTilePresets.some((preset) => getTilePresetNameKey(preset) === nameKey)) {
      setErr("동일한 이름의 타일 속성 프리셋이 이미 존재합니다.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await createSharedWorldMapTilePreset({
        name,
        color,
        hasValue,
      });
      const latestShared = await listSharedWorldMapTilePresets();
      setSharedTilePresets(normalizeTilePresets(latestShared));
      setPresetDraftName("");
      setPresetDraftHasValue(false);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteTilePreset = async (presetId: string) => {
    if (!isAdmin) {
      setErr("관리자만 타일 속성 프리셋을 삭제할 수 있습니다.");
      return;
    }
    if (!selectedMap) {
      setErr("지도를 먼저 선택해 주세요.");
      return;
    }
    const target = activeTilePresets.find((entry) => entry.id === presetId);
    if (!target) return;
    const ok = window.confirm(`프리셋을 삭제합니다: ${target.name}`);
    if (!ok) return;
    setTileEditor((prev) =>
      prev
        ? {
            ...prev,
            draft: prev.draft.filter((entry) => entry.presetId !== presetId),
          }
        : null
    );
    setBusy(true);
    setErr(null);
    try {
      const isSharedTarget = sharedTilePresets.some((preset) => preset.id === presetId);
      if (isSharedTarget) {
        await deleteSharedWorldMapTilePreset(presetId);
        const latestShared = await listSharedWorldMapTilePresets();
        setSharedTilePresets(normalizeTilePresets(latestShared));
      } else if (selectedMap) {
        const nextPresets = activeLocalTilePresets.filter((preset) => preset.id !== presetId);
        const nextStates: Record<string, MapTileStateAssignment[]> = {};
        for (const [key, values] of Object.entries(activeTileStates)) {
          const filtered = values.filter((state) => state.presetId !== presetId);
          if (filtered.length > 0) nextStates[key] = filtered;
        }
        await updateWorldMap(selectedMap.id, {
          tileStatePresets: normalizeTilePresets(nextPresets),
          tileStateAssignments: nextStates,
          tileRegionStates: activeTileRegionStates,
        });
        setTilePresetsByMap((prev) => ({ ...prev, [selectedMap.id]: nextPresets }));
        setTileStatesByMap((prev) => ({ ...prev, [selectedMap.id]: nextStates }));
      }
      if (selectedMap) {
        await refreshCurrentMapOnly(selectedMap.id);
      }
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const resetBuildingDraft = () => {
    setBuildingDraft(createDefaultBuildingDraftState());
  };

  const handleSelectBuildingPreset = (presetId: string) => {
    const target = activeBuildingPresets.find((entry) => entry.id === presetId);
    if (!target) return;
    setBuildingDraft(buildDraftFromPreset(target));
  };

  const createDefaultComparePredicate = (): BuildingRulePredicate => ({
    kind: "compare",
    op: "gte",
    left: { kind: "resource", resourceId: "gold" },
    right: { kind: "const", value: 0 },
  });
  const createDefaultTileRegionComparePredicate = (): BuildingRulePredicate => ({
    kind: "tileRegionCompare",
    field: "spaceRemaining",
    op: "gte",
    value: 0,
  });

  const createPlacementRuleByKind = (kind: BuildingPlacementRule["kind"]): BuildingPlacementRule =>
    kind === "uniquePerTile"
      ? { kind: "uniquePerTile", maxCount: 1 }
      : kind === "tileRegionCompare"
        ? { kind: "tileRegionCompare", field: "spaceRemaining", op: "gte", value: 0 }
      : kind === "requireTagInRange"
        ? {
            kind: "requireTagInRange",
            tagPresetId: "",
            distance: 1,
            minCount: 1,
            negate: false,
            repeat: false,
          }
        : kind === "requireBuildingInRange"
          ? {
              kind: "requireBuildingInRange",
              presetId: "",
              distance: 1,
              minCount: 1,
              negate: false,
              repeat: false,
            }
          : { kind: "custom", label: "" };

  type RuleWhenKind = "compare" | "tileRegionCompare" | BuildingPlacementRule["kind"];
  const isPlacementRuleKind = (kind: string): kind is BuildingPlacementRule["kind"] =>
    kind === "uniquePerTile" ||
    kind === "tileRegionCompare" ||
    kind === "requireTagInRange" ||
    kind === "requireBuildingInRange" ||
    kind === "custom";
  const getWhenKind = (when?: BuildingRulePredicate): RuleWhenKind | null => {
    if (!when) return null;
    if (when.kind === "compare") return "compare";
    if (when.kind === "tileRegionCompare") return "tileRegionCompare";
    return isPlacementRuleKind(when.kind) ? when.kind : "compare";
  };
  const createDefaultWhenByKind = (kind: RuleWhenKind): BuildingRulePredicate =>
    kind === "compare"
      ? createDefaultComparePredicate()
      : kind === "tileRegionCompare"
        ? createDefaultTileRegionComparePredicate()
        : createPlacementRuleByKind(kind);

  const createActionByKind = (kind: BuildingRuleAction["kind"]): BuildingRuleAction => {
    if (kind === "adjustResource") {
      return { kind, resourceId: "gold", delta: { kind: "const", value: 0 } };
    }
    if (kind === "adjustResourceCap") {
      return { kind, resourceId: "wood", delta: { kind: "const", value: 0 } };
    }
    if (kind === "adjustPopulation") {
      return {
        kind,
        populationId: "settlers",
        field: "available",
        delta: { kind: "const", value: 0 },
      };
    }
    if (kind === "adjustPopulationCap") {
      return {
        kind,
        delta: { kind: "const", value: 0 },
      };
    }
    if (kind === "convertPopulation") {
      return {
        kind,
        from: "settlers",
        to: "laborers",
        amount: { kind: "const", value: 1 },
      };
    }
    if (kind === "adjustTileRegion") {
      return { kind, field: "threat", delta: { kind: "const", value: 0 }, target: "self" };
    }
    if (kind === "addTileState") {
      return {
        kind,
        tagPresetId: activeTilePresets[0]?.id ?? "",
        value: "",
        target: "self",
      };
    }
    return { kind, tagPresetId: activeTilePresets[0]?.id ?? "", target: "self" };
  };

  const setDraftResourceValue = (
    field: "buildCost" | "upkeepResources",
    resourceId: BuildingResourceId,
    value: string
  ) => {
    setBuildingDraft((prev) => ({
      ...prev,
      [field]: { ...prev[field], [resourceId]: value.replace(/[^\d]/g, "") },
    }));
  };

  const persistWarehouseState = useCallback(
    async (nextWarehouse: Record<string, number>) => {
      if (!selectedMap) return;
      const nextState = normalizeCityGlobalState({
        ...activeCityGlobal,
        warehouse: nextWarehouse,
      });
      setBusy(true);
      setErr(null);
      try {
        const updated = await updateWorldMap(selectedMap.id, { cityGlobal: nextState });
        setMaps((prev) => prev.map((entry) => (entry.id === updated.id ? updated : entry)));
      } catch (e: any) {
        setErr(String(e?.message ?? e));
        throw e;
      } finally {
        setBusy(false);
      }
    },
    [selectedMap, activeCityGlobal]
  );

  const handleAddWarehouseItem = useCallback(
    async (itemName: string, amount: number) => {
      const name = String(itemName ?? "").trim();
      if (!name) {
        throw new Error("아이템 이름을 입력해 주세요.");
      }
      const parsedAmount = Math.max(1, Math.trunc(Number(amount) || 0));
      const nextWarehouse = { ...(activeCityGlobal.warehouse ?? {}) };
      const current = Math.max(0, Math.trunc(Number(nextWarehouse[name] ?? 0) || 0));
      nextWarehouse[name] = current + parsedAmount;
      await persistWarehouseState(nextWarehouse);
    },
    [activeCityGlobal.warehouse, persistWarehouseState]
  );

  const handleDeleteWarehouseItem = useCallback(
    async (itemName: string) => {
      const name = String(itemName ?? "").trim();
      if (!name) return;
      const nextWarehouse = { ...(activeCityGlobal.warehouse ?? {}) };
      delete nextWarehouse[name];
      await persistWarehouseState(nextWarehouse);
    },
    [activeCityGlobal.warehouse, persistWarehouseState]
  );

  const handleImportWarehouseItem = useCallback(
    async (owner: string, itemName: string, amount: number) => {
      const ownerName = String(owner ?? "").trim();
      const name = String(itemName ?? "").trim();
      const parsedAmount = Math.max(1, Math.trunc(Number(amount) || 0));
      if (!ownerName) {
        throw new Error("캐릭터를 선택해 주세요.");
      }
      if (!name) {
        throw new Error("아이템을 선택해 주세요.");
      }

      const rows = await listInventory(ownerName);
      const normalized = Array.isArray(rows)
        ? rows
            .map((entry) => ({
              itemName: String((entry as any)?.itemName ?? "").trim(),
              amount: Math.max(0, Math.trunc(Number((entry as any)?.amount ?? 0) || 0)),
            }))
            .filter((entry) => !!entry.itemName)
        : [];
      const found = normalized.find((entry) => entry.itemName === name);
      const currentAmount = Math.max(0, Math.trunc(Number(found?.amount ?? 0) || 0));
      if (currentAmount < parsedAmount) {
        throw new Error("인벤토리 보유량을 초과했습니다.");
      }

      await useInventoryItem({
        owner: ownerName,
        itemName: name,
        amount: parsedAmount,
      });
      await handleAddWarehouseItem(name, parsedAmount);
    },
    [handleAddWarehouseItem]
  );

  const handleExportWarehouseItem = useCallback(
    async (owner: string, itemName: string, amount: number) => {
      const ownerName = String(owner ?? "").trim();
      const name = String(itemName ?? "").trim();
      const parsedAmount = Math.max(1, Math.trunc(Number(amount) || 0));
      if (!ownerName) {
        throw new Error("캐릭터를 선택해 주세요.");
      }
      if (!name) {
        throw new Error("내보낼 아이템을 선택해 주세요.");
      }

      const nextWarehouse = { ...(activeCityGlobal.warehouse ?? {}) };
      const current = Math.max(0, Math.trunc(Number(nextWarehouse[name] ?? 0) || 0));
      if (current < parsedAmount) {
        throw new Error("창고 보관량을 초과했습니다.");
      }

      await addInventoryItem({
        owner: ownerName,
        itemName: name,
        amount: parsedAmount,
      });

      const remain = current - parsedAmount;
      if (remain <= 0) delete nextWarehouse[name];
      else nextWarehouse[name] = remain;
      await persistWarehouseState(nextWarehouse);
    },
    [activeCityGlobal.warehouse, persistWarehouseState]
  );

  const removeDraftResourceValue = (
    field: "buildCost" | "upkeepResources",
    resourceId: BuildingResourceId
  ) => {
    setBuildingDraft((prev) => {
      const next = { ...(prev[field] ?? {}) } as Record<string, string>;
      delete next[resourceId];
      return { ...prev, [field]: next };
    });
  };

  const setDraftPopulationValue = (
    resourceId: UpkeepPopulationId,
    value: string
  ) => {
    setBuildingDraft((prev) => ({
      ...prev,
      upkeepPopulation: { ...prev.upkeepPopulation, [resourceId]: value.replace(/[^\d]/g, "") },
    }));
  };

  const setDraftEffectRules = (
    field: "onBuild" | "daily" | "onRemove",
    updater: (prev: BuildingExecutionRule[]) => BuildingExecutionRule[]
  ) => {
    setBuildingDraft((prev) => ({ ...prev, [field]: updater(prev[field]) }));
  };

  const setDraftPlacementRules = (
    updater: (prev: BuildingPlacementRule[]) => BuildingPlacementRule[]
  ) => {
    setBuildingDraft((prev) => ({ ...prev, placementRules: updater(prev.placementRules) }));
  };

  const handleAddPlacementRule = () => {
    setDraftPlacementRules((prev) => [...prev, { kind: "uniquePerTile" }]);
  };

  const handleAddExecutionRule = (field: "onBuild" | "daily" | "onRemove") => {
    setDraftEffectRules(field, (prev) => [...prev, createDefaultExecutionRule(field === "daily")]);
  };

  const handleRemovePlacementRule = (index: number) => {
    setDraftPlacementRules((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSetPlacementRuleKind = (index: number, kind: BuildingPlacementRule["kind"]) => {
    const nextRule = createPlacementRuleByKind(kind);
    setDraftPlacementRules((prev) => prev.map((rule, i) => (i === index ? nextRule : rule)));
  };

  const setEffectRuleAt = (
    field: "onBuild" | "daily" | "onRemove",
    index: number,
    nextRule: BuildingExecutionRule
  ) => {
    setDraftEffectRules(field, (prev) => prev.map((rule, i) => (i === index ? nextRule : rule)));
  };

  const removeEffectRule = (field: "onBuild" | "daily" | "onRemove", index: number) => {
    setDraftEffectRules(field, (prev) => prev.filter((_, i) => i !== index));
  };

  const addEffectAction = (field: "onBuild" | "daily" | "onRemove", index: number) => {
    setDraftEffectRules(field, (prev) =>
      prev.map((rule, i) =>
        i === index ? { ...rule, actions: [...rule.actions, createDefaultRuleAction()] } : rule
      )
    );
  };

  const removeEffectAction = (
    field: "onBuild" | "daily" | "onRemove",
    ruleIndex: number,
    actionIndex: number
  ) => {
    setDraftEffectRules(field, (prev) =>
      prev.map((rule, i) => {
        if (i !== ruleIndex) return rule;
        const actions = rule.actions.filter((_, idx) => idx !== actionIndex);
        return { ...rule, actions: actions.length > 0 ? actions : [createDefaultRuleAction()] };
      })
    );
  };

  const setEffectActionAt = (
    field: "onBuild" | "daily" | "onRemove",
    ruleIndex: number,
    actionIndex: number,
    next: BuildingRuleAction
  ) => {
    setDraftEffectRules(field, (prev) =>
      prev.map((rule, i) =>
        i === ruleIndex
          ? {
              ...rule,
              actions: rule.actions.map((action, idx) => (idx === actionIndex ? next : action)),
            }
          : rule
      )
    );
  };

  const handleSaveBuildingPreset = async () => {
    if (!isAdmin) {
      setErr("관리자만 건물 프리셋을 등록/수정할 수 있습니다.");
      return;
    }
    if (!selectedMap) {
      setErr("지도를 먼저 선택해 주세요.");
      return;
    }
    const name = buildingDraft.name.trim();
    if (!name) {
      setErr("건물 이름을 입력해 주세요.");
      return;
    }
    const effort = toNonNegativeInt(buildingDraft.effort.trim());
    const space = toNonNegativeInt(buildingDraft.space.trim());
    const buildCost = Object.fromEntries(
      Object.entries(toNumberRecordFromResourceDraft(buildingDraft.buildCost)).filter(([, v]) =>
        Number.isFinite(Number(v))
      )
    ) as Record<string, number>;
    const upkeepResources = Object.fromEntries(
      Object.entries(toNumberRecordFromResourceDraft(buildingDraft.upkeepResources)).filter(([, v]) =>
        Number.isFinite(Number(v))
      )
    ) as Record<string, number>;
    const upkeepPopulation = Object.fromEntries(
      Object.entries(toNumberRecordFromDraft(UPKEEP_POPULATION_IDS, buildingDraft.upkeepPopulation)).filter(
        ([, v]) => Number.isFinite(Number(v))
      )
    ) as Record<string, number>;
    const hasUniquePerTileRule = buildingDraft.placementRules.some(
      (rule) => rule.kind === "uniquePerTile"
    );
    const payload = {
      name,
      color: normalizeHexColor(buildingDraft.color, "#eab308"),
      tier: buildingDraft.tier.trim() || undefined,
      effort,
      space,
      description: buildingDraft.description.trim() || undefined,
      placementRules: buildingDraft.id
        ? convertUniquePerTileRulesForPersist(buildingDraft.placementRules, buildingDraft.id)
        : buildingDraft.placementRules,
      buildCost,
      upkeep:
        Object.keys(upkeepResources).length > 0 || Object.keys(upkeepPopulation).length > 0
          ? {
              resources: upkeepResources,
              population: upkeepPopulation,
            }
          : undefined,
      effects: {
        onBuild: buildingDraft.onBuild,
        daily: buildingDraft.daily,
        onRemove: buildingDraft.onRemove,
      },
    };

    const sourcePreset =
      buildingDraft.id != null
        ? activeBuildingPresets.find((entry) => entry.id === buildingDraft.id) ?? null
        : null;
    const isSharedPreset = sourcePreset ? sourcePreset.mapId == null : true;

    setBusy(true);
    setErr(null);
    try {
      const savedInitial =
        sourcePreset && buildingDraft.id
          ? isSharedPreset
            ? await updateSharedWorldMapBuildingPreset(sourcePreset.id, payload)
            : await updateWorldMapBuildingPreset(
                sourcePreset.mapId ?? selectedMap.id,
                sourcePreset.id,
                payload
              )
          : await createSharedWorldMapBuildingPreset(payload);
      const savedId = String(savedInitial?.id ?? "").trim();
      if (hasUniquePerTileRule && savedId) {
        const fixedPlacementRules = convertUniquePerTileRulesForPersist(
          buildingDraft.placementRules,
          savedId
        );
        if (sourcePreset && buildingDraft.id && !isSharedPreset) {
          await updateWorldMapBuildingPreset(sourcePreset.mapId ?? selectedMap.id, sourcePreset.id, {
            placementRules: fixedPlacementRules,
          });
        } else {
          await updateSharedWorldMapBuildingPreset(savedId, {
            placementRules: fixedPlacementRules,
          });
        }
      }
      await loadMaps(selectedMap.id);
      const latestSelectedRows = normalizeBuildingPresets(
        await listSharedWorldMapBuildingPresets()
      );
      const latestSaved =
        latestSelectedRows.find((entry) => String(entry.id ?? "") === savedId) ??
        latestSelectedRows.find(
          (entry) =>
            getBuildingPresetSharedKey(entry) ===
            getBuildingPresetSharedKey({ name, tier: buildingDraft.tier })
        ) ??
        null;
      if (latestSaved) setBuildingDraft(buildDraftFromPreset(latestSaved));
      else resetBuildingDraft();
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteBuildingPreset = async (presetId: string) => {
    if (!isAdmin) {
      setErr("관리자만 건물 프리셋을 삭제할 수 있습니다.");
      return;
    }
    if (!selectedMap) {
      setErr("지도를 먼저 선택해 주세요.");
      return;
    }
    const target = activeBuildingPresets.find((entry) => entry.id === presetId);
    if (!target) return;
    const ok = window.confirm(`건물 프리셋을 삭제합니다: ${target.name}`);
    if (!ok) return;
    setBusy(true);
    setErr(null);
    try {
      if (target.mapId == null) {
        await deleteSharedWorldMapBuildingPreset(presetId);
      } else {
        await deleteWorldMapBuildingPreset(target.mapId, presetId);
      }
      await loadMaps(selectedMap.id);
      if (buildingDraft.id === presetId) resetBuildingDraft();
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const handleOpenTileEditor = (col: number, row: number) => {
    const key = tileKey(col, row);
    const useMultiSelection =
      selectedHexes.length > 1 && selectedHexes.some((entry) => entry.col === col && entry.row === row);
    const targets = useMultiSelection
      ? selectedHexes.map((entry) => ({
          key: tileKey(entry.col, entry.row),
          col: entry.col,
          row: entry.row,
        }))
      : [{ key, col, row }];
    const current = useMultiSelection ? [] : activeTileStates[key] ?? [];
    setTileEditor({
      targets,
      draft: current.map((entry) => ({ ...entry })),
    });
    setTileContextMenu(null);
  };

  const handleTileEditorSave = async () => {
    if (!tileEditor) return;
    if (!selectedMap) {
      setErr("지도를 먼저 선택해 주세요.");
      return;
    }
    const clean = tileEditor.draft
      .filter((entry) => presetById.has(entry.presetId))
      .map((entry) => {
        const preset = presetById.get(entry.presetId);
        if (!preset?.hasValue) return { presetId: entry.presetId };
        return {
          presetId: entry.presetId,
          value: String(entry.value ?? "").trim(),
        };
      });
    const nextStates = { ...activeTileStates };
    const multiMode = tileEditor.targets.length > 1;
    if (!multiMode) {
      const targetKey = tileEditor.targets[0]?.key;
      if (targetKey) {
        if (clean.length > 0) nextStates[targetKey] = clean;
        else delete nextStates[targetKey];
      }
    } else {
      const cleanWithPreset = clean
        .map((entry) => ({ entry, preset: presetById.get(entry.presetId) }))
        .filter(
          (row): row is { entry: MapTileStateAssignment; preset: MapTileStatePreset } =>
            !!row.preset
        );
      for (const target of tileEditor.targets) {
        const existing = [...(nextStates[target.key] ?? [])];
        for (const { entry, preset } of cleanWithPreset) {
          const existingIndex = existing.findIndex((value) => value.presetId === entry.presetId);
          if (!preset.hasValue) {
            if (existingIndex >= 0) continue;
            existing.push({ presetId: entry.presetId });
            continue;
          }
          const deltaRaw = String(entry.value ?? "").trim();
          if (!deltaRaw) continue;
          const deltaNum = Number(deltaRaw);
          if (!Number.isFinite(deltaNum)) continue;
          if (existingIndex >= 0) {
            const baseNum = Number(existing[existingIndex]?.value ?? 0);
            const nextNum = (Number.isFinite(baseNum) ? baseNum : 0) + deltaNum;
            existing[existingIndex] = {
              presetId: entry.presetId,
              value: String(nextNum),
            };
          } else {
            existing.push({
              presetId: entry.presetId,
              value: String(deltaNum),
            });
          }
        }
        if (existing.length > 0) nextStates[target.key] = existing;
        else delete nextStates[target.key];
      }
    }
    setBusy(true);
    setErr(null);
    try {
      setStatesForCurrentMap(nextStates);
      await persistCurrentMapTileData(activeLocalTilePresets, nextStates, activeTileRegionStates);
      setTileEditor(null);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
      await refreshCurrentMapOnly(selectedMap.id);
    } finally {
      setBusy(false);
    }
  };

  const setSelectedHexIfChanged = useCallback(
    (col: number, row: number, additive?: boolean, toggleSelected = false) => {
      setSelectedHexes((prev) => {
        let next: Array<{ col: number; row: number }>;
        if (!additive) {
          next = [{ col, row }];
        } else {
          const existingIndex = prev.findIndex((entry) => entry.col === col && entry.row === row);
          if (existingIndex >= 0) {
            if (!toggleSelected) {
              next = prev;
            } else {
              next = prev.filter((_, idx) => idx !== existingIndex);
            }
          } else {
            next = [...prev, { col, row }];
          }
        }

        setSelectedHex((prevSelected) => {
          if (next.length === 0) return null;
          if (!additive) return { col, row };
          if (next.some((entry) => entry.col === col && entry.row === row)) return { col, row };
          if (
            prevSelected &&
            next.some((entry) => entry.col === prevSelected.col && entry.row === prevSelected.row)
          ) {
            return prevSelected;
          }
          const fallback = next[next.length - 1];
          return fallback ? { col: fallback.col, row: fallback.row } : null;
        });

        return next;
      });
    },
    []
  );

  const handleOpenTileRegionEditor = (col: number, row: number) => {
    const key = tileKey(col, row);
    const current = activeTileRegionStates[key] ?? {};
    const draft = {
      spaceUsed: current.spaceUsed != null ? String(current.spaceUsed) : "",
      spaceCap: current.spaceCap != null ? String(current.spaceCap) : "",
      threat: current.threat != null ? String(current.threat) : "",
      pollution: current.pollution != null ? String(current.pollution) : "",
    };
    tileRegionDraftRef.current = draft;
    setTileRegionEditor({
      key,
      col,
      row,
      draft,
    });
    setTileContextMenu(null);
  };

  const handleOpenTileBuildingEditor = (col: number, row: number) => {
    if (selectedMap?.id) {
      void releaseWorkersFromCompletedBuildings(selectedMap.id);
    }
    tileBuildingCreateWorkersDraftRef.current = { ...EMPTY_WORKER_ASSIGNMENT_DRAFT };
    tileBuildingWorkersDraftByIdRef.current = {};
    setTileBuildingEditor({
      col,
      row,
      presetId: activeBuildingPresets[0]?.id ?? "",
    });
    setTileBuildingSearchQuery("");
    if (tileBuildingSearchInputRef.current) {
      tileBuildingSearchInputRef.current.value = "";
    }
    setTileContextMenu(null);
  };

  const handleOpenTileYieldViewer = (col: number, row: number) => {
    setTileYieldViewer({ col, row });
    setTileContextMenu(null);
  };

  const handlePlaceBuildingOnTile = async () => {
    if (!tileBuildingEditor || !selectedMap) return;
    if (!tileBuildingEditor.presetId) {
      setErr("배치할 건물 프리셋을 선택해 주세요.");
      return;
    }
    let selectedPreset =
      activeBuildingPresets.find((entry) => entry.id === tileBuildingEditor.presetId) ?? null;
    const createDraft = tileBuildingCreateWorkersDraftRef.current ?? EMPTY_WORKER_ASSIGNMENT_DRAFT;
    const effort = Math.max(0, Math.trunc(Number(selectedPreset?.effort ?? 0)));
    const requestedWorkersByType: Record<PopulationTrackedId, number> = {
      settlers: Math.max(0, Math.trunc(Number(createDraft.settlers || "0") || 0)),
      engineers: Math.max(0, Math.trunc(Number(createDraft.engineers || "0") || 0)),
      scholars: Math.max(0, Math.trunc(Number(createDraft.scholars || "0") || 0)),
      laborers: Math.max(0, Math.trunc(Number(createDraft.laborers || "0") || 0)),
    };
    const assignedWorkersByType =
      effort <= 0 ? createZeroWorkersByType() : requestedWorkersByType;
    const assignedWorkers = sumAssignedWorkersByType(assignedWorkersByType);
    const initialStatus = effort <= 0 ? "active" : "building";
    setBusy(true);
    setErr(null);
    try {
      if (
        selectedPreset &&
        Array.isArray(selectedPreset.placementRules) &&
        selectedPreset.placementRules.some((rule) => rule.kind === "uniquePerTile")
      ) {
        const migrated = await updateWorldMapBuildingPreset(selectedMap.id, selectedPreset.id, {
          placementRules: convertUniquePerTileRulesForPersist(
            selectedPreset.placementRules,
            selectedPreset.id
          ),
        });
        const normalizedMigrated = normalizeBuildingPresets([migrated])[0];
        if (normalizedMigrated) {
          selectedPreset = normalizedMigrated;
          setBuildingPresetsByMap((prev) => {
            const base = prev[selectedMap.id] ?? [];
            const idx = base.findIndex((entry) => entry.id === normalizedMigrated.id);
            const next =
              idx >= 0
                ? base.map((entry, i) => (i === idx ? normalizedMigrated : entry))
                : [...base, normalizedMigrated];
            return { ...prev, [selectedMap.id]: next };
          });
        }
      }
      const created = await createWorldMapBuildingInstance(selectedMap.id, {
        presetId: tileBuildingEditor.presetId,
        col: tileBuildingEditor.col,
        row: tileBuildingEditor.row,
        enabled: true,
        progressEffort: 0,
        meta: {
          assignedWorkers,
          assignedWorkersByType,
          buildMeta: {
            status: initialStatus,
            assignedWorkers,
            assignedWorkersByType,
          },
        },
      });
      const normalized =
        normalizeBuildingInstances([created])[0] ??
        normalizeBuildingInstances([(created as any)?.building])[0] ??
        null;
      if (normalized) {
        setBuildingInstancesByMap((prev) => {
          const base = prev[selectedMap.id] ?? [];
          const deduped = base.filter((entry) => entry.id !== normalized.id);
          return { ...prev, [selectedMap.id]: [...deduped, normalized] };
        });
      } else {
        await loadBuildingInstancesForMap(selectedMap.id);
      }
      // 건물 배치 시점에 건설비/공간 점유가 반영되므로, 즉시 맵 상태를 재조회해 UI를 동기화한다.
      await refreshCurrentMapOnly(selectedMap.id);
      tileBuildingCreateWorkersDraftRef.current = {
        settlers: String(assignedWorkersByType.settlers),
        engineers: String(assignedWorkersByType.engineers),
        scholars: String(assignedWorkersByType.scholars),
        laborers: String(assignedWorkersByType.laborers),
      };
    } catch (e: any) {
      setErr(String(e?.message ?? e));
      await loadBuildingInstancesForMap(selectedMap.id);
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteBuildingOnTile = async (instanceId: string) => {
    if (!selectedMap) return;
    setBusy(true);
    setErr(null);
    try {
      await deleteWorldMapBuildingInstance(selectedMap.id, instanceId);
      setBuildingInstancesByMap((prev) => ({
        ...prev,
        [selectedMap.id]: (prev[selectedMap.id] ?? []).filter((entry) => entry.id !== instanceId),
      }));
      await refreshCurrentMapOnly(selectedMap.id);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
      await loadBuildingInstancesForMap(selectedMap.id);
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateBuildingWorkers = async (
    instance: WorldMapBuildingInstanceRow,
    workersByTypeInput: Partial<Record<PopulationTrackedId, number>>
  ) => {
    if (!selectedMap) return;
    const requestedWorkersByType: Record<PopulationTrackedId, number> = {
      settlers: Math.max(0, Math.trunc(Number(workersByTypeInput.settlers ?? 0) || 0)),
      engineers: Math.max(0, Math.trunc(Number(workersByTypeInput.engineers ?? 0) || 0)),
      scholars: Math.max(0, Math.trunc(Number(workersByTypeInput.scholars ?? 0) || 0)),
      laborers: Math.max(0, Math.trunc(Number(workersByTypeInput.laborers ?? 0) || 0)),
    };
    const preset = activeBuildingPresets.find((entry) => entry.id === instance.presetId) ?? null;
    const status = getInstanceBuildStatus(instance, preset);
    const requiredAnyNonElderly =
      status === "active"
        ? Math.max(
            0,
            Math.trunc(
              Number(
                (preset?.upkeep?.population as Partial<Record<UpkeepPopulationId, number>> | undefined)
                  ?.anyNonElderly ?? 0
              ) || 0
            )
          )
        : 0;
    if (status === "active" && requiredAnyNonElderly > 0) {
      const requestedTotal = TRACKED_POPULATION_IDS.reduce(
        (sum, id) => sum + Math.max(0, requestedWorkersByType[id] ?? 0),
        0
      );
      if (requestedTotal !== requiredAnyNonElderly) {
        setErr(
          `노약자 제외 아무나 배치는 총 ${requiredAnyNonElderly}명이 필요합니다. (현재 ${requestedTotal}명)`
        );
        return;
      }
    }
    const safeWorkersByType = status === "active" ? createZeroWorkersByType() : requestedWorkersByType;
    const safeWorkers = sumAssignedWorkersByType(safeWorkersByType);
    const upkeepAnyByType =
      status === "active"
        ? {
            settlers: requestedWorkersByType.settlers,
            engineers: requestedWorkersByType.engineers,
            scholars: requestedWorkersByType.scholars,
            laborers: requestedWorkersByType.laborers,
          }
        : undefined;
    const nextMeta = {
      ...(instance.meta && typeof instance.meta === "object"
        ? (instance.meta as Record<string, unknown>)
        : {}),
      assignedWorkers: safeWorkers,
      assignedWorkersByType: safeWorkersByType,
      ...(upkeepAnyByType
        ? {
            upkeepAnyNonElderlyByType: upkeepAnyByType,
          }
        : {}),
      buildMeta: {
        ...((instance.meta &&
        typeof instance.meta === "object" &&
        (instance.meta as any).buildMeta &&
        typeof (instance.meta as any).buildMeta === "object"
          ? (instance.meta as any).buildMeta
          : {}) as Record<string, unknown>),
        assignedWorkers: safeWorkers,
        assignedWorkersByType: safeWorkersByType,
        ...(upkeepAnyByType
          ? {
              upkeepAnyNonElderlyByType: upkeepAnyByType,
            }
          : {}),
        status,
      },
    };
    setBusy(true);
    setErr(null);
    try {
      const updated = await updateWorldMapBuildingInstance(selectedMap.id, instance.id, {
        meta: nextMeta,
      });
      const normalized =
        normalizeBuildingInstances([updated])[0] ??
        normalizeBuildingInstances([(updated as any)?.building])[0] ??
        null;
      if (normalized) {
        setBuildingInstancesByMap((prev) => {
          const base = prev[selectedMap.id] ?? [];
          return {
            ...prev,
            [selectedMap.id]: base.map((entry) => (entry.id === normalized.id ? normalized : entry)),
          };
        });
      } else {
        await loadBuildingInstancesForMap(selectedMap.id);
      }
      // 인원 배치 저장 후에도 도시 전역 가용 인구가 즉시 반영되도록 맵 데이터를 다시 동기화합니다.
      const latest = await getWorldMap(selectedMap.id);
      if (latest?.id) {
        setMaps((prev) => prev.map((entry) => (entry.id === latest.id ? latest : entry)));
        if (Array.isArray(latest.tileStatePresets)) {
          setTilePresetsByMap((prev) => ({
            ...prev,
            [latest.id]: normalizeTilePresets(latest.tileStatePresets ?? []),
          }));
        }
        if (latest.tileStateAssignments && typeof latest.tileStateAssignments === "object") {
          setTileStatesByMap((prev) => ({
            ...prev,
            [latest.id]: normalizeTileStateAssignments(latest.tileStateAssignments ?? {}),
          }));
        }
        if (latest.tileRegionStates && typeof latest.tileRegionStates === "object") {
          setTileRegionStatesByMap((prev) => ({
            ...prev,
            [latest.id]: normalizeTileRegionStates(latest.tileRegionStates ?? {}),
          }));
        }
      }
      await loadBuildingPresetsForMap(selectedMap.id);
      await loadBuildingInstancesForMap(selectedMap.id);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
      await loadBuildingInstancesForMap(selectedMap.id);
    } finally {
      setBusy(false);
    }
  };

  const handleToggleBuildingEnabled = async (instance: WorldMapBuildingInstanceRow) => {
    if (!selectedMap) return;
    const nextEnabled = instance.enabled === false ? true : false;
    setBusy(true);
    setErr(null);
    try {
      const updated = await updateWorldMapBuildingInstance(selectedMap.id, instance.id, {
        enabled: nextEnabled,
      });
      const normalized =
        normalizeBuildingInstances([updated])[0] ??
        normalizeBuildingInstances([(updated as any)?.building])[0] ??
        null;
      if (normalized) {
        setBuildingInstancesByMap((prev) => {
          const base = prev[selectedMap.id] ?? [];
          return {
            ...prev,
            [selectedMap.id]: base.map((entry) => (entry.id === normalized.id ? normalized : entry)),
          };
        });
      } else {
        await loadBuildingInstancesForMap(selectedMap.id);
      }
    } catch (e: any) {
      setErr(String(e?.message ?? e));
      await loadBuildingInstancesForMap(selectedMap.id);
    } finally {
      setBusy(false);
    }
  };

  const handleTileRegionEditorSave = async () => {
    if (!tileRegionEditor || !selectedMap) return;
    const draft = tileRegionDraftRef.current ?? tileRegionEditor.draft;
    const parseInput = (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return undefined;
      const n = Number(trimmed);
      if (!Number.isFinite(n)) return NaN;
      return Math.trunc(n);
    };
    const parsed = {
      spaceUsed: parseInput(draft.spaceUsed),
      spaceCap: parseInput(draft.spaceCap),
      threat: parseInput(draft.threat),
      pollution: parseInput(draft.pollution),
    };
    const hasInvalid = Object.values(parsed).some((v) => Number.isNaN(v));
    if (hasInvalid) {
      setErr("지역 상태 수치는 숫자로 입력해 주세요.");
      return;
    }
    const nextRegionStates = { ...activeTileRegionStates };
    const nextValue: MapTileRegionState = {
      spaceUsed: parsed.spaceUsed,
      spaceCap: parsed.spaceCap,
      threat: parsed.threat,
      pollution: parsed.pollution,
    };
    const hasAny =
      nextValue.spaceUsed != null ||
      nextValue.spaceCap != null ||
      nextValue.threat != null ||
      nextValue.pollution != null;
    if (hasAny) nextRegionStates[tileRegionEditor.key] = nextValue;
    else delete nextRegionStates[tileRegionEditor.key];

    setBusy(true);
    setErr(null);
    try {
      setRegionStatesForCurrentMap(nextRegionStates);
      await persistCurrentMapTileData(activeLocalTilePresets, activeTileStates, nextRegionStates);
      setTileRegionEditor(null);
      tileRegionDraftRef.current = null;
    } catch (e: any) {
      setErr(String(e?.message ?? e));
      await refreshCurrentMapOnly(selectedMap.id);
    } finally {
      setBusy(false);
    }
  };

  const tileBuildingInstances = useMemo(() => {
    if (!tileBuildingEditor) return [] as WorldMapBuildingInstanceRow[];
    return activeBuildingInstances.filter(
      (entry) => entry.col === tileBuildingEditor.col && entry.row === tileBuildingEditor.row
    );
  }, [activeBuildingInstances, tileBuildingEditor]);

  useEffect(() => {
    if (!tileBuildingEditor) {
      tileBuildingWorkersDraftByIdRef.current = {};
      return;
    }
    const prev = tileBuildingWorkersDraftByIdRef.current;
    const next: Record<string, WorkerAssignmentDraft> = {};
    for (const instance of tileBuildingInstances) {
      const fallback = readAssignedWorkersByTypeFromInstanceMeta(instance.meta);
      const preset = activeBuildingPresets.find((entry) => entry.id === instance.presetId) ?? null;
      const status = getInstanceBuildStatus(instance, preset);
      const normalizedFallback =
        status === "active"
          ? createZeroWorkersByType()
          : fallback;
      next[instance.id] =
        prev[instance.id] ??
        ({
          settlers: String(normalizedFallback.settlers),
          engineers: String(normalizedFallback.engineers),
          scholars: String(normalizedFallback.scholars),
          laborers: String(normalizedFallback.laborers),
        } satisfies WorkerAssignmentDraft);
    }
    tileBuildingWorkersDraftByIdRef.current = next;
  }, [activeBuildingPresets, tileBuildingEditor, tileBuildingInstances]);

  const filteredBuildingPresetsForTile = useMemo(() => {
    if (!tileBuildingEditor) return [] as WorldMapBuildingPresetRow[];
    const q = tileBuildingSearchQuery.trim().toLowerCase();
    if (!q) return activeBuildingPresets;
    return activeBuildingPresets.filter((preset) => {
      const name = preset.name.toLowerCase();
      const tier = String(preset.tier ?? "").toLowerCase();
      return name.includes(q) || tier.includes(q);
    });
  }, [activeBuildingPresets, tileBuildingEditor, tileBuildingSearchQuery]);

  useEffect(() => {
    if (!tileBuildingEditor && tileBuildingSearchTimerRef.current != null) {
      window.clearTimeout(tileBuildingSearchTimerRef.current);
      tileBuildingSearchTimerRef.current = null;
    }
  }, [tileBuildingEditor]);

  useEffect(() => {
    return () => {
      if (tileBuildingSearchTimerRef.current != null) {
        window.clearTimeout(tileBuildingSearchTimerRef.current);
        tileBuildingSearchTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (viewMode !== "drag") return;
    const handler = (ev: WheelEvent) => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      const target = ev.target as Node | null;
      if (!target || !viewport.contains(target)) return;
      ev.preventDefault();
      ev.stopPropagation();
    };
    window.addEventListener("wheel", handler, { passive: false });
    return () => {
      window.removeEventListener("wheel", handler);
    };
  }, [viewMode]);

  useEffect(() => {
    if (viewMode === "drag") setTileContextMenu(null);
  }, [viewMode]);

  const presetPanelCtx = {
    presetMode, setPresetMode, isAdmin, busy, activeTilePresets, presetDraftName, setPresetDraftName,
    presetDraftColorHex, setPresetDraftColorHex, presetDraftHasValue, setPresetDraftHasValue,
    handleCreateTilePreset, handleDeleteTilePreset, activeBuildingPresets, buildingDraft, setBuildingDraft,
    placementRuleSearch, setPlacementRuleSearch, handleSaveBuildingPreset, handleDeleteBuildingPreset,
    handleSelectBuildingPreset, resetBuildingDraft, setDraftPlacementRules, handleAddPlacementRule,
    handleRemovePlacementRule, handleAddExecutionRule, setEffectRuleAt, removeEffectRule, addEffectAction,
    removeEffectAction, setEffectActionAt, createDefaultRuleAction, getWhenKind, createDefaultWhenByKind,
    createDefaultComparePredicate, isPlacementRuleKind, createActionByKind, setDraftResourceValue,
    removeDraftResourceValue, setDraftPopulationValue, handleSetPlacementRuleKind, itemCatalogEntries,
  };

  const mapModePanelCtx = {
    selectedMap, settingsOpen, settingsTab, busy, draft, selectedHex, activeTileStates, presetById,
    activeCityGlobal: effectiveCityGlobal,
    totalPopulation, dailyRunDays, dailyRunResult, dailyRunLogs, fileInputRef,
    citySettingsFormRef, setDraft, setSettingsOpen, setSettingsTab, setDailyRunDays, normalizeHexColor,
    handleDelete, handleUploadImage, handleSaveDraft, handleSaveCityGlobal, handleRunDailyRules,
    showTileStatePills, showRegionStatusPills, showTileNumbering, viewMode, zoom, setShowTileStatePills,
    setShowRegionStatusPills, setViewMode, setDragging, dragRef, setZoom, resourceOverlayOpen,
    setShowTileNumbering,
    populationOverlayOpen, resourceAdjustOpen, warehouseModalOpen,
    resourceAdjustTarget, resourceAdjustMode, resourceAdjustAmount, dailyResourceDeltaById, warehouseEntries,
    itemCatalogEntries,
    setResourceOverlayOpen, setPopulationOverlayOpen, setResourceAdjustOpen, setWarehouseModalOpen,
    setResourceAdjustTarget, setResourceAdjustMode, setResourceAdjustAmount, handleApplyResourceAdjust,
    handleAddWarehouseItem, handleDeleteWarehouseItem, handleImportWarehouseItem,
    handleExportWarehouseItem,
    resourceStatusModalOpen,
    setResourceStatusModalOpen,
    resourceStatusRows,
    placementReportOpen, setPlacementReportOpen, placementPopulationSummary, placementReportRows,
    imageUrl, viewportRef, dragging, handleViewportMouseDown, handleViewportMouseMove, endDragging,
    handleViewportWheel, scheduleVisibleBoundsUpdate, imageWidth, imageHeight, setLoadedSize,
    syncLoadedImageMeta, polygons, visibleImageBounds, selectedHexKeySet, tileStateBadgesByKey, EMPTY_STATE_BADGES,
    suppressClickRef, setTileContextMenu, setSelectedHexIfChanged, activeTileRegionStates, tileContextMenu,
    tileContextMenuRef, handleOpenTileEditor, handleOpenTileRegionEditor, handleOpenTileBuildingEditor,
    handleOpenTileYieldViewer,
    tileYieldViewer,
    setTileYieldViewer,
    tileYieldRows: tileYieldPreview.rows,
    tileYieldTotals: tileYieldPreview.totals,
    tileBuildingEditor, setTileBuildingEditor, setTileBuildingSearchQuery, tileBuildingSearchInputRef,
    tileBuildingSearchTimerRef, tileBuildingCreateWorkersDraftRef, tileBuildingWorkersDraftByIdRef,
    tileBuildingSearchQuery, filteredBuildingPresetsForTile, activeBuildingPresets, tileBuildingInstances,
    instanceOperationalById, instanceUpkeepWorkersByTypeById, instanceUpkeepAnyRequiredById,
    instanceUpkeepAnyAssignedByTypeById,
    handlePlaceBuildingOnTile, handleUpdateBuildingWorkers, handleToggleBuildingEnabled,
    handleDeleteBuildingOnTile, tileEditor, setTileEditor, activeTilePresets, handleTileEditorSave,
    tileRegionEditor, setTileRegionEditor, tileRegionDraftRef, handleTileRegionEditorSave,
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-[1600px] p-4">
        <WorldMapHeaderBar
          isAdmin={isAdmin}
          isPresetMode={isPresetMode}
          mapListOpen={mapListOpen}
          settingsOpen={settingsOpen}
          busy={busy}
          hasSelectedMap={!!selectedMap}
          onBack={onBack}
          onRefresh={() => void loadMaps(selectedMapId)}
          onRunDailyRules={() => {
            if (!selectedMap || busy) return;
            const ok = window.confirm("일일 규칙을 실행하고 날짜를 넘기시겠습니까?");
            if (!ok) return;
            void handleRunDailyRules();
          }}
          onToggleMapList={() => setMapListOpen((prev) => !prev)}
          onToggleSettings={() => setSettingsOpen((prev) => ((prev ? false : (setSettingsTab("map"), true))))}
        />

        {err ? <div className="mb-4 rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-200">{err}</div> : null}

        <div
          className={[
            "grid gap-4",
            !isPresetMode && mapListOpen
              ? "xl:grid-cols-[320px_minmax(0,1fr)]"
              : "xl:grid-cols-1",
          ].join(" ")}
        >
          {!isPresetMode && mapListOpen ? (
            <MapListPanel
              maps={maps}
              selectedMapId={selectedMapId}
              busy={busy}
              createName={createName}
              onCreateNameChange={setCreateName}
              onCreate={handleCreate}
              onClose={() => setMapListOpen(false)}
              onSelectMapId={setSelectedMapId}
            />
          ) : null}

          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            {isPresetMode ? (
              <MapPresetsPanel ctx={presetPanelCtx} />
            ) : (
              <MapModePanel ctx={mapModePanelCtx} />
            )}
          </section>
        </div>
      </div>
      {overflowNotice ? (
        <div
          className="fixed inset-0 z-[170] flex items-center justify-center bg-black/60 px-4"
          onClick={() => setOverflowNotice(null)}
        >
          <div
            className="w-full max-w-xl rounded-xl border border-amber-700/60 bg-zinc-950/95 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-bold text-amber-300">잉여 자원 환전 결과</h3>
              <button
                type="button"
                className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
                onClick={() => setOverflowNotice(null)}
              >
                닫기
              </button>
            </div>

            <div className="space-y-2 text-sm text-zinc-200">
              <div>
                기존 소지금:{" "}
                <span className="font-semibold text-amber-300">
                  {formatWithCommas(overflowNotice.beforeGold)}
                </span>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-3">
                <div className="mb-2 text-xs text-zinc-400">환전 내역</div>
                <div className="space-y-1">
                  {overflowNotice.details.map((entry) => (
                    <div key={entry.resourceId} className="flex items-center justify-between gap-4">
                      <div className="text-zinc-200">
                        {RESOURCE_EMOJIS[entry.resourceId]} {RESOURCE_LABELS[entry.resourceId]}{" "}
                        {formatWithCommas(entry.overflowAmount)}
                      </div>
                      <div className="font-semibold text-amber-300">
                        +{formatWithCommas(entry.goldGain)}G
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                총 가산 금액:{" "}
                <span className="font-semibold text-amber-300">
                  +{formatWithCommas(overflowNotice.totalGoldGain)}G
                </span>
              </div>
              <div>
                현재 소지금:{" "}
                <span className="font-semibold text-emerald-300">
                  {formatWithCommas(overflowNotice.afterGold)}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

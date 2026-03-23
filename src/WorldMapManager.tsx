import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createWorldMapBuildingInstance,
  createWorldMapBuildingPreset,
  createWorldMap,
  getWorldMap,
  deleteWorldMapBuildingInstance,
  deleteWorldMapBuildingPreset,
  deleteWorldMap,
  listWorldMapBuildingInstances,
  listWorldMapBuildingPresets,
  listWorldMaps,
  runWorldMapDaily,
  updateWorldMapBuildingInstance,
  updateWorldMapBuildingPreset,
  updateWorldMap,
  uploadWorldMapImage,
} from "./api";
import type {
  AuthUser,
  BuildingExecutionRule,
  BuildingPlacementRule,
  BuildingRuleAction,
  BuildingRulePredicate,
  CityGlobalState,
  HexOrientation,
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

import type {
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
  CappedResourceId,
  ResourceId,
  WorkerAssignmentDraft,
  BuildingDraftState,
  RuleEvalContext,
} from "./world-map/utils";
import {
  CAPPED_RESOURCE_IDS,
  UNCAPPED_RESOURCE_IDS,
  ALL_RESOURCE_IDS,
  BUILDING_PRESET_RESOURCE_IDS,
  TRACKED_POPULATION_IDS,
  ALL_POPULATION_IDS,
  UPKEEP_POPULATION_IDS,
  RESOURCE_LABELS,
  RESOURCE_EMOJIS,
  POPULATION_LABELS,
  UPKEEP_POPULATION_LABELS,
  POPULATION_EMOJIS,
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
  sumAssignedWorkersByType,
  getInstanceBuildStatus,
  createZeroWorkersByType,
  makeLocalId,
  formatWithCommas,
  roundTo2,
  formatDailyDelta,
  safeInt,
  evalRuleExpr,
  evaluateRulePredicatePreview,
  createDefaultRuleAction,
  createDefaultExecutionRule,
  createDefaultBuildingDraftState,
  toNonNegativeInt,
  toNumberRecordFromDraft,
  exprToEditableNumber,
  buildDraftFromPreset,
} from "./world-map/utils";

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
  const [resourceAdjustTarget, setResourceAdjustTarget] = useState<ResourceId>("gold");
  const [resourceAdjustMode, setResourceAdjustMode] = useState<"inc" | "dec">("inc");
  const [resourceAdjustAmount, setResourceAdjustAmount] = useState("0");
  const [dailyRunDays, setDailyRunDays] = useState("1");
  const [dailyRunResult, setDailyRunResult] = useState<string | null>(null);
  const [dailyRunLogs, setDailyRunLogs] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [createName, setCreateName] = useState("");
  const [draft, setDraft] = useState<Draft>(DEFAULT_DRAFT);
  const [selectedHex, setSelectedHex] = useState<SelectedHex>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("scroll");
  const [showTileStatePills, setShowTileStatePills] = useState(true);
  const [showRegionStatusPills, setShowRegionStatusPills] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [zoom, setZoom] = useState(0.7);
  const [visibleImageBounds, setVisibleImageBounds] = useState<ImageViewportBounds | null>(
    null
  );
  const [tilePresetsByMap, setTilePresetsByMap] = useState<TilePresetsByMap>({});
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
    key: string;
    col: number;
    row: number;
    draft: MapTileStateAssignment[];
  } | null>(null);
  const [tileRegionEditor, setTileRegionEditor] = useState<{
    key: string;
    col: number;
    row: number;
    draft: {
      spaceUsed: string;
      spaceCap: string;
      satisfaction: string;
      threat: string;
      pollution: string;
    };
  } | null>(null);
  const [tileBuildingEditor, setTileBuildingEditor] = useState<{
    col: number;
    row: number;
    presetId: string;
  } | null>(null);
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
    satisfaction: string;
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

  const loadMaps = async (preferredId?: string | null) => {
    setBusy(true);
    setErr(null);
    try {
      const res = await listWorldMaps();
      const items = Array.isArray(res) ? res : [];
      setMaps(items);
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
          next[entry.id] = normalizeBuildingPresets(entry.buildingPresetRows ?? []);
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

  const loadBuildingPresetsForMap = useCallback(
    async (mapId: string) => {
      try {
        const rows = await listWorldMapBuildingPresets(mapId);
        const normalized = normalizeBuildingPresets(rows);
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
          [latest.id]: normalizeBuildingPresets(
            Array.isArray(latestAny.buildingPresetRows) ? latestAny.buildingPresetRows : []
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
    setDailyRunResult(null);
    setDailyRunLogs([]);
    setDailyRunDays("1");
  }, [selectedMapId]);

  const selectedMap = useMemo(
    () => maps.find((entry) => entry.id === selectedMapId) ?? null,
    [maps, selectedMapId]
  );
  const activeTileStates = useMemo(
    () => (selectedMapId ? tileStatesByMap[selectedMapId] ?? {} : {}),
    [selectedMapId, tileStatesByMap]
  );
  const activeTilePresets = useMemo(
    () => (selectedMapId ? tilePresetsByMap[selectedMapId] ?? [] : []),
    [selectedMapId, tilePresetsByMap]
  );
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
  const totalPopulation = useMemo(
    () =>
      ALL_POPULATION_IDS.reduce(
        (sum, id) => sum + Math.max(0, activeCityGlobal.population[id]?.total ?? 0),
        0
      ),
    [activeCityGlobal.population]
  );

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
    const enabledInstances = activeBuildingInstances.filter((entry) => {
      if (entry.enabled === false) return false;
      const preset = buildingPresetById.get(entry.presetId) ?? null;
      return getInstanceBuildStatus(entry, preset) === "active";
    });
    for (const instance of enabledInstances) {
      const preset = buildingPresetById.get(instance.presetId);
      if (!preset) continue;

      const ruleContext: RuleEvalContext = {
        col: instance.col,
        row: instance.row,
        map: selectedMap,
        cityGlobal: activeCityGlobal,
        tileStates: activeTileStates,
        tileRegions: activeTileRegionStates,
        buildingInstances: enabledInstances,
      };

      const upkeepResources = preset.upkeep?.resources ?? {};
      for (const id of BUILDING_PRESET_RESOURCE_IDS) {
        const upkeepValue = Number(upkeepResources[id] ?? 0);
        if (!Number.isFinite(upkeepValue) || upkeepValue === 0) continue;
        totals[id] -= upkeepValue;
      }

      for (const rule of preset.effects?.daily ?? []) {
        const intervalDays = Math.max(1, safeInt(rule.intervalDays, 1));
        const nextDay = Math.max(0, safeInt(activeCityGlobal.day, 0) + 1);
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
          totals[action.resourceId] += value * repeatMultiplier;
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
    activeCityGlobal,
    activeTileRegionStates,
    activeTileStates,
    buildingPresetById,
    selectedMap,
  ]);

  useEffect(() => {
    if (!selectedMap) setSettingsOpen(false);
  }, [selectedMap]);

  useEffect(() => {
    if (!isPresetMode) return;
    setSettingsOpen(false);
    setMapListOpen(false);
    setTileContextMenu(null);
    setTileEditor(null);
    setTileBuildingEditor(null);
  }, [isPresetMode]);

  useEffect(() => {
    setDraft(buildDraft(selectedMap));
    setPresetMode("tile");
    setSelectedHex(null);
    setTileContextMenu(null);
    setTileEditor(null);
    setTileRegionEditor(null);
    setTileBuildingEditor(null);
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
    const nextState = normalizeCityGlobalState({
      values: {
        ...activeCityGlobal.values,
      },
      caps: {
        wood: parseNonNegativeInt("cap_wood", activeCityGlobal.caps.wood),
        stone: parseNonNegativeInt("cap_stone", activeCityGlobal.caps.stone),
        fabric: parseNonNegativeInt("cap_fabric", activeCityGlobal.caps.fabric),
        weave: parseNonNegativeInt("cap_weave", activeCityGlobal.caps.weave),
        food: parseNonNegativeInt("cap_food", activeCityGlobal.caps.food),
      },
      day: parseNonNegativeInt("day", activeCityGlobal.day),
      populationCap: parseNonNegativeInt("population_cap", activeCityGlobal.populationCap),
      population: {
        settlers: {
          available: parseNonNegativeInt(
            "pop_settlers_available",
            activeCityGlobal.population.settlers.available ?? 0
          ),
          total: parseNonNegativeInt("pop_settlers_total", activeCityGlobal.population.settlers.total),
        },
        engineers: {
          available: parseNonNegativeInt(
            "pop_engineers_available",
            activeCityGlobal.population.engineers.available ?? 0
          ),
          total: parseNonNegativeInt(
            "pop_engineers_total",
            activeCityGlobal.population.engineers.total
          ),
        },
        scholars: {
          available: parseNonNegativeInt(
            "pop_scholars_available",
            activeCityGlobal.population.scholars.available ?? 0
          ),
          total: parseNonNegativeInt("pop_scholars_total", activeCityGlobal.population.scholars.total),
        },
        laborers: {
          available: parseNonNegativeInt(
            "pop_laborers_available",
            activeCityGlobal.population.laborers.available ?? 0
          ),
          total: parseNonNegativeInt("pop_laborers_total", activeCityGlobal.population.laborers.total),
        },
        elderly: {
          total: parseNonNegativeInt("pop_elderly_total", activeCityGlobal.population.elderly.total),
        },
      },
    });
    for (const id of TRACKED_POPULATION_IDS) {
      const entry = nextState.population[id];
      if ((entry.available ?? 0) > entry.total) {
        entry.available = entry.total;
      }
    }
    setBusy(true);
    setErr(null);
    try {
      const updated = await updateWorldMap(selectedMap.id, {
        cityGlobal: nextState,
      });
      setMaps((prev) => prev.map((entry) => (entry.id === updated.id ? updated : entry)));
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const handleApplyResourceAdjust = async () => {
    if (!selectedMap) return;
    const raw = Number(resourceAdjustAmount);
    const amount = Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : NaN;
    if (!Number.isFinite(amount)) {
      setErr("수치를 숫자로 입력해 주세요.");
      return;
    }

    const current = activeCityGlobal.values[resourceAdjustTarget] ?? 0;
    const signed = resourceAdjustMode === "inc" ? amount : -amount;
    let nextValue = current + signed;
    if (nextValue < 0) nextValue = 0;

    if ((CAPPED_RESOURCE_IDS as readonly string[]).includes(resourceAdjustTarget)) {
      const cap = activeCityGlobal.caps[resourceAdjustTarget as CappedResourceId] ?? 0;
      if (nextValue > cap) nextValue = cap;
    }

    const nextState: CityGlobalState = {
      ...activeCityGlobal,
      values: {
        ...activeCityGlobal.values,
        [resourceAdjustTarget]: nextValue,
      },
    };

    setBusy(true);
    setErr(null);
    try {
      const updated = await updateWorldMap(selectedMap.id, { cityGlobal: nextState });
      setMaps((prev) => prev.map((entry) => (entry.id === updated.id ? updated : entry)));
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

      const segments = [`일일 규칙 ${formatWithCommas(days)}일 실행 완료`];
      if (day != null) segments.push(`Day ${String(day).padStart(3, "0")}`);
      if (appliedRules != null) segments.push(`적용 규칙 ${formatWithCommas(appliedRules)}개`);
      if (appliedActions != null) segments.push(`적용 액션 ${formatWithCommas(appliedActions)}개`);
      if (failedRules != null) segments.push(`실패 ${formatWithCommas(failedRules)}개`);
      setDailyRunResult(segments.join(" · "));
      const rawLogs = Array.isArray(result?.logs) ? result.logs : [];
      const lines = rawLogs
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
      setDailyRunLogs(lines);

      await refreshCurrentMapOnly(selectedMap.id);
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

  const setPresetsForCurrentMap = (next: MapTileStatePreset[]) => {
    if (!selectedMapId) return;
    setTilePresetsByMap((prev) => ({ ...prev, [selectedMapId]: next }));
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
    const next: MapTileStatePreset = {
      id: makeLocalId(),
      name,
      color: normalizeHexColor(presetDraftColorHex),
      hasValue: presetDraftHasValue,
    };
    const nextPresets = [...activeTilePresets, next];
    setBusy(true);
    setErr(null);
    try {
      setPresetsForCurrentMap(nextPresets);
      await persistCurrentMapTileData(nextPresets, activeTileStates, activeTileRegionStates);
      setPresetDraftName("");
      setPresetDraftHasValue(false);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
      await refreshCurrentMapOnly(selectedMap.id);
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
    const nextPresets = activeTilePresets.filter((entry) => entry.id !== presetId);
    const nextStates: Record<string, MapTileStateAssignment[]> = {};
    for (const [key, values] of Object.entries(activeTileStates)) {
      const filtered = values.filter((entry) => entry.presetId !== presetId);
      if (filtered.length > 0) nextStates[key] = filtered;
    }
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
      setPresetsForCurrentMap(nextPresets);
      setStatesForCurrentMap(nextStates);
      await persistCurrentMapTileData(nextPresets, nextStates, activeTileRegionStates);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
      await refreshCurrentMapOnly(selectedMap.id);
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
      return { kind, resourceId: "gold", delta: { kind: "const", value: 0 }, target: "self" };
    }
    if (kind === "adjustResourceCap") {
      return { kind, resourceId: "wood", delta: { kind: "const", value: 0 }, target: "self" };
    }
    if (kind === "adjustPopulation") {
      return {
        kind,
        populationId: "settlers",
        field: "available",
        delta: { kind: "const", value: 0 },
        target: "self",
      };
    }
    if (kind === "adjustPopulationCap") {
      return {
        kind,
        delta: { kind: "const", value: 0 },
        target: "self",
      };
    }
    if (kind === "convertPopulation") {
      return {
        kind,
        from: "settlers",
        to: "laborers",
        amount: { kind: "const", value: 1 },
        target: "self",
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
    resourceId: ResourceId,
    value: string
  ) => {
    setBuildingDraft((prev) => ({
      ...prev,
      [field]: { ...prev[field], [resourceId]: value.replace(/[^\d]/g, "") },
    }));
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
    const buildCost = toNumberRecordFromDraft(
      BUILDING_PRESET_RESOURCE_IDS,
      buildingDraft.buildCost
    );
    const upkeepResources = toNumberRecordFromDraft(
      BUILDING_PRESET_RESOURCE_IDS,
      buildingDraft.upkeepResources
    );
    const upkeepPopulation = toNumberRecordFromDraft(
      UPKEEP_POPULATION_IDS,
      buildingDraft.upkeepPopulation
    );
    const payload = {
      name,
      color: normalizeHexColor(buildingDraft.color, "#eab308"),
      tier: buildingDraft.tier.trim() || undefined,
      effort,
      space,
      description: buildingDraft.description.trim() || undefined,
      placementRules: buildingDraft.placementRules,
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

    setBusy(true);
    setErr(null);
    try {
      const saved = buildingDraft.id
        ? await updateWorldMapBuildingPreset(selectedMap.id, buildingDraft.id, payload)
        : await createWorldMapBuildingPreset(selectedMap.id, payload);
      const normalizedSaved = normalizeBuildingPresets([saved])[0];
      if (!normalizedSaved) throw new Error("건물 프리셋 저장 결과를 확인할 수 없습니다.");
      setBuildingPresetsByMap((prev) => {
        const base = prev[selectedMap.id] ?? [];
        const idx = base.findIndex((entry) => entry.id === normalizedSaved.id);
        const next =
          idx >= 0
            ? base.map((entry, i) => (i === idx ? normalizedSaved : entry))
            : [...base, normalizedSaved];
        return { ...prev, [selectedMap.id]: next };
      });
      setBuildingDraft(buildDraftFromPreset(normalizedSaved));
    } catch (e: any) {
      setErr(String(e?.message ?? e));
      await loadBuildingPresetsForMap(selectedMap.id);
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
      await deleteWorldMapBuildingPreset(selectedMap.id, presetId);
      setBuildingPresetsByMap((prev) => ({
        ...prev,
        [selectedMap.id]: (prev[selectedMap.id] ?? []).filter((entry) => entry.id !== presetId),
      }));
      if (buildingDraft.id === presetId) resetBuildingDraft();
    } catch (e: any) {
      setErr(String(e?.message ?? e));
      await loadBuildingPresetsForMap(selectedMap.id);
    } finally {
      setBusy(false);
    }
  };

  const handleOpenTileEditor = (col: number, row: number) => {
    const key = tileKey(col, row);
    const current = activeTileStates[key] ?? [];
    setTileEditor({
      key,
      col,
      row,
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
    if (clean.length > 0) nextStates[tileEditor.key] = clean;
    else delete nextStates[tileEditor.key];
    setBusy(true);
    setErr(null);
    try {
      setStatesForCurrentMap(nextStates);
      await persistCurrentMapTileData(activeTilePresets, nextStates, activeTileRegionStates);
      setTileEditor(null);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
      await refreshCurrentMapOnly(selectedMap.id);
    } finally {
      setBusy(false);
    }
  };

  const setSelectedHexIfChanged = useCallback((col: number, row: number) => {
    setSelectedHex((prev) => (prev && prev.col === col && prev.row === row ? prev : { col, row }));
  }, []);

  const handleOpenTileRegionEditor = (col: number, row: number) => {
    const key = tileKey(col, row);
    const current = activeTileRegionStates[key] ?? {};
    const draft = {
      spaceUsed: current.spaceUsed != null ? String(current.spaceUsed) : "",
      spaceCap: current.spaceCap != null ? String(current.spaceCap) : "",
      satisfaction: current.satisfaction != null ? String(current.satisfaction) : "",
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

  const handlePlaceBuildingOnTile = async () => {
    if (!tileBuildingEditor || !selectedMap) return;
    if (!tileBuildingEditor.presetId) {
      setErr("배치할 건물 프리셋을 선택해 주세요.");
      return;
    }
    const selectedPreset =
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
    const safeWorkersByType =
      status === "active" ? createZeroWorkersByType() : requestedWorkersByType;
    const safeWorkers = sumAssignedWorkersByType(safeWorkersByType);
    const nextMeta = {
      ...(instance.meta && typeof instance.meta === "object"
        ? (instance.meta as Record<string, unknown>)
        : {}),
      assignedWorkers: safeWorkers,
      assignedWorkersByType: safeWorkersByType,
      buildMeta: {
        ...((instance.meta &&
        typeof instance.meta === "object" &&
        (instance.meta as any).buildMeta &&
        typeof (instance.meta as any).buildMeta === "object"
          ? (instance.meta as any).buildMeta
          : {}) as Record<string, unknown>),
        assignedWorkers: safeWorkers,
        assignedWorkersByType: safeWorkersByType,
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
      satisfaction: parseInput(draft.satisfaction),
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
      satisfaction: parsed.satisfaction,
      threat: parsed.threat,
      pollution: parsed.pollution,
    };
    const hasAny =
      nextValue.spaceUsed != null ||
      nextValue.spaceCap != null ||
      nextValue.satisfaction != null ||
      nextValue.threat != null ||
      nextValue.pollution != null;
    if (hasAny) nextRegionStates[tileRegionEditor.key] = nextValue;
    else delete nextRegionStates[tileRegionEditor.key];

    setBusy(true);
    setErr(null);
    try {
      setRegionStatesForCurrentMap(nextRegionStates);
      await persistCurrentMapTileData(activeTilePresets, activeTileStates, nextRegionStates);
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

  const selectedTileBuildingPreset = useMemo(() => {
    if (!tileBuildingEditor?.presetId) return null;
    return activeBuildingPresets.find((entry) => entry.id === tileBuildingEditor.presetId) ?? null;
  }, [activeBuildingPresets, tileBuildingEditor]);

  const selectedTileBuildingPresetNeedsWorkers = useMemo(
    () => Math.max(0, Math.trunc(Number(selectedTileBuildingPreset?.effort ?? 0))) > 0,
    [selectedTileBuildingPreset]
  );

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

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-[1600px] p-4">
        <header className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-xl font-semibold">World Map</div>
            {isAdmin ? <div className="text-xs text-amber-300">관리자</div> : null}
          </div>
          <div className="flex items-center gap-2">
            {!isPresetMode ? (
              <button
                type="button"
                className={[
                  "rounded-md border px-2 py-1 text-xs",
                  mapListOpen
                    ? "border-amber-700/70 bg-amber-950/30 text-amber-200"
                    : "border-zinc-800 text-zinc-200 hover:border-zinc-600",
                ].join(" ")}
                onClick={() => setMapListOpen((prev) => !prev)}
                disabled={busy}
              >
                지도 목록
              </button>
            ) : null}
            {!isPresetMode ? (
              <button
                type="button"
                className={[
                  "rounded-md border px-2 py-1 text-xs",
                  settingsOpen
                    ? "border-sky-700/70 bg-sky-950/30 text-sky-200"
                    : "border-zinc-800 text-zinc-200 hover:border-zinc-600",
                ].join(" ")}
                onClick={() =>
                  setSettingsOpen((prev) => {
                    const next = !prev;
                    if (next) setSettingsTab("map");
                    return next;
                  })
                }
                disabled={busy || !selectedMap}
                title="지도 설정"
              >
                설정
              </button>
            ) : null}
            <button
              type="button"
              className="rounded-md border border-zinc-800 px-2 py-1 text-xs text-zinc-200 hover:border-zinc-600"
              onClick={onBack}
              disabled={busy}
            >
              Back
            </button>
            <button
              type="button"
              className="rounded-md border border-zinc-800 px-2 py-1 text-xs text-zinc-200 hover:border-zinc-600"
              onClick={() => loadMaps(selectedMapId)}
              disabled={busy}
            >
              새로고침
            </button>
          </div>
        </header>

        {err ? (
          <div className="mb-4 rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-200">
            {err}
          </div>
        ) : null}

        <div
          className={[
            "grid gap-4",
            !isPresetMode && mapListOpen
              ? "xl:grid-cols-[320px_minmax(0,1fr)]"
              : "xl:grid-cols-1",
          ].join(" ")}
        >
          {!isPresetMode && mapListOpen ? (
            <aside className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-zinc-100">지도 목록</div>
                <button
                  type="button"
                  className="rounded-md border border-zinc-800 px-2 py-1 text-[11px] text-zinc-300 hover:border-zinc-600"
                  onClick={() => setMapListOpen(false)}
                  disabled={busy}
                >
                  접기
                </button>
              </div>
              <div className="mb-4 flex gap-2">
                <input
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="새 지도 이름"
                  className="h-10 flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-zinc-600"
                />
                <button
                  type="button"
                  className="rounded-lg border border-emerald-700/60 bg-emerald-950/30 px-3 text-xs font-semibold text-emerald-200 hover:bg-emerald-900/40"
                  onClick={handleCreate}
                  disabled={busy}
                >
                  생성
                </button>
              </div>
              <div className="space-y-2">
                {maps.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-zinc-800 px-3 py-4 text-sm text-zinc-500">
                    아직 등록된 지도가 없습니다.
                  </div>
                ) : (
                  maps.map((map) => {
                    const active = selectedMapId === map.id;
                    return (
                      <button
                        key={map.id}
                        type="button"
                        className={[
                          "w-full rounded-xl border px-3 py-3 text-left",
                          active
                            ? "border-amber-500/70 bg-amber-950/20"
                            : "border-zinc-800 bg-zinc-950/30 hover:border-zinc-700",
                        ].join(" ")}
                        onClick={() => setSelectedMapId(map.id)}
                      >
                        <div className="text-sm font-semibold text-zinc-100">{map.name}</div>
                        <div className="mt-1 text-[11px] text-zinc-500">
                          {map.imageUrl ? "이미지 등록됨" : "이미지 없음"} · {map.cols} x {map.rows}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </aside>
          ) : null}

          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            {isPresetMode ? (
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-4">
                <div className="mb-3 text-sm font-semibold text-zinc-100">맵 프리셋</div>
                <div className="mb-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className={[
                      "rounded-lg border px-3 py-1.5 text-xs font-semibold",
                      presetMode === "tile"
                        ? "border-amber-700/70 bg-amber-950/30 text-amber-200"
                        : "border-zinc-800 bg-zinc-950/30 text-zinc-300 hover:border-zinc-700",
                    ].join(" ")}
                    onClick={() => setPresetMode("tile")}
                  >
                    타일 속성 프리셋
                  </button>
                  <button
                    type="button"
                    className={[
                      "rounded-lg border px-3 py-1.5 text-xs font-semibold",
                      presetMode === "building"
                        ? "border-sky-700/70 bg-sky-950/30 text-sky-200"
                        : "border-zinc-800 bg-zinc-950/30 text-zinc-300 hover:border-zinc-700",
                    ].join(" ")}
                    onClick={() => setPresetMode("building")}
                  >
                    건물 프리셋
                  </button>
                </div>

                {presetMode === "tile" ? (
                  <>
                    <div className="mb-4 text-xs text-zinc-400">
                      타일 속성에서 사용할 프리셋을 관리합니다.
                    </div>
                    {isAdmin ? (
                      <div className="mb-4 grid gap-2 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3 md:grid-cols-[1fr_200px_120px_auto] md:items-end">
                        <label className="block">
                          <div className="mb-1 text-[11px] font-semibold text-zinc-400">이름</div>
                          <input
                            value={presetDraftName}
                            onChange={(e) => setPresetDraftName(e.target.value)}
                            className="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-zinc-600"
                            placeholder="새 지형 상태"
                          />
                        </label>
                        <label className="block">
                          <div className="mb-1 text-[11px] font-semibold text-zinc-400">색상 선택</div>
                          <div className="flex h-9 items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-2">
                            <input
                              type="color"
                              value={presetDraftColorHex}
                              onChange={(e) => setPresetDraftColorHex(e.target.value.toLowerCase())}
                              className="h-6 w-8 cursor-pointer rounded border border-zinc-700 bg-transparent p-0"
                              title="타일 속성 프리셋 색상"
                            />
                            <span className="text-[11px] text-zinc-300">{presetDraftColorHex}</span>
                          </div>
                        </label>
                        <label className="flex h-9 items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3">
                          <input
                            type="checkbox"
                            checked={presetDraftHasValue}
                            onChange={(e) => setPresetDraftHasValue(e.target.checked)}
                          />
                          <span className="text-xs text-zinc-200">값 있음</span>
                        </label>
                        <button
                          type="button"
                          className="h-9 rounded-lg border border-emerald-700/60 bg-emerald-950/30 px-3 text-xs font-semibold text-emerald-200 hover:bg-emerald-900/40"
                          onClick={handleCreateTilePreset}
                          disabled={busy}
                        >
                          프리셋 추가
                        </button>
                      </div>
                    ) : (
                      <div className="mb-4 rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-400">
                        현재 계정은 조회 전용입니다. 프리셋 등록/삭제는 관리자만 가능합니다.
                      </div>
                    )}
                    <div className="space-y-2">
                      {activeTilePresets.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-zinc-800 px-3 py-4 text-sm text-zinc-500">
                          등록된 맵 프리셋이 없습니다.
                        </div>
                      ) : (
                        activeTilePresets.map((preset) => {
                          const color = normalizeHexColor(preset.color);
                          return (
                            <div
                              key={preset.id}
                              className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2"
                            >
                              <div className="flex min-w-0 items-center gap-2">
                                <span
                                  className="inline-block h-3 w-3 rounded-full"
                                  style={{ backgroundColor: color }}
                                  aria-hidden="true"
                                />
                                <span className="truncate text-sm font-semibold" style={{ color }}>
                                  {preset.name}
                                </span>
                                <span className="text-[11px] text-zinc-500">
                                  {preset.hasValue ? "값 있음" : "값 없음"} · {color}
                                </span>
                              </div>
                              {isAdmin ? (
                                <button
                                  type="button"
                                  className="rounded-md border border-red-800/70 bg-red-950/40 px-2 py-1 text-[11px] font-semibold text-red-200 hover:bg-red-900/40"
                                  onClick={() => handleDeleteTilePreset(preset.id)}
                                  disabled={busy}
                                >
                                  삭제
                                </button>
                              ) : null}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mb-4 text-xs text-zinc-400">
                      건물 규칙을 블록 단위로 조합해 관리합니다.
                    </div>
                    {isAdmin ? (
                      <div className="mb-4 space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
                        <div className="grid gap-2 md:grid-cols-[1fr_160px_120px_120px]">
                          <label className="block">
                            <div className="mb-1 text-[11px] font-semibold text-zinc-400">건물 이름</div>
                            <input
                              value={buildingDraft.name}
                              onChange={(e) =>
                                setBuildingDraft((prev) => ({ ...prev, name: e.target.value }))
                              }
                              className="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-zinc-600"
                              placeholder="예: 감자밭"
                            />
                          </label>
                          <label className="block">
                            <div className="mb-1 text-[11px] font-semibold text-zinc-400">색상</div>
                            <div className="flex h-9 items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-2">
                              <input
                                type="color"
                                value={buildingDraft.color}
                                onChange={(e) =>
                                  setBuildingDraft((prev) => ({
                                    ...prev,
                                    color: e.target.value.toLowerCase(),
                                  }))
                                }
                                className="h-6 w-8 cursor-pointer rounded border border-zinc-700 bg-transparent p-0"
                              />
                              <span className="text-[11px] text-zinc-300">{buildingDraft.color}</span>
                            </div>
                          </label>
                          <label className="block">
                            <div className="mb-1 text-[11px] font-semibold text-zinc-400">노력치</div>
                            <input
                              value={buildingDraft.effort}
                              onChange={(e) =>
                                setBuildingDraft((prev) => ({
                                  ...prev,
                                  effort: e.target.value.replace(/[^\d]/g, ""),
                                }))
                              }
                              className="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-amber-200 outline-none focus:border-zinc-600"
                              placeholder="예: 25"
                            />
                          </label>
                          <label className="block">
                            <div className="mb-1 text-[11px] font-semibold text-zinc-400">怨듦컙</div>
                            <input
                              value={buildingDraft.space}
                              onChange={(e) =>
                                setBuildingDraft((prev) => ({
                                  ...prev,
                                  space: e.target.value.replace(/[^\d]/g, ""),
                                }))
                              }
                              className="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-sky-200 outline-none focus:border-zinc-600"
                              placeholder="예: 2"
                            />
                          </label>
                        </div>
                        <div className="grid gap-2 md:grid-cols-2">
                          <label className="block">
                            <div className="mb-1 text-[11px] font-semibold text-zinc-400">티어</div>
                            <input
                              value={buildingDraft.tier}
                              onChange={(e) =>
                                setBuildingDraft((prev) => ({ ...prev, tier: e.target.value }))
                              }
                              className="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-zinc-600"
                              placeholder="예: Tier 1"
                            />
                          </label>
                          <label className="block">
                            <div className="mb-1 text-[11px] font-semibold text-zinc-400">설명</div>
                            <input
                              value={buildingDraft.description}
                              onChange={(e) =>
                                setBuildingDraft((prev) => ({
                                  ...prev,
                                  description: e.target.value,
                                }))
                              }
                              className="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-zinc-600"
                              placeholder="요약 설명"
                            />
                          </label>
                        </div>
                        <div className="grid gap-3 md:grid-cols-3">
                          <div className="rounded-lg border border-amber-800/60 bg-amber-950/20 p-2.5">
                            <div className="mb-2 text-xs font-semibold text-zinc-300">건설 비용 블록</div>
                            <div className="grid grid-cols-2 gap-1.5">
                              {BUILDING_PRESET_RESOURCE_IDS.map((id) => (
                                <label key={`build-${id}`} className="block">
                                  <div className="mb-1 text-[11px] text-zinc-400">{RESOURCE_LABELS[id]}</div>
                                  <input
                                    value={buildingDraft.buildCost[id] ?? ""}
                                    onChange={(e) =>
                                      setDraftResourceValue("buildCost", id, e.target.value)
                                    }
                                    className="h-7 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 text-xs text-amber-200 outline-none focus:border-zinc-600"
                                    placeholder="0"
                                  />
                                </label>
                              ))}
                            </div>
                          </div>
                          <div className="rounded-lg border border-emerald-800/60 bg-emerald-950/20 p-2.5">
                            <div className="mb-2 text-xs font-semibold text-zinc-300">유지 자원 블록</div>
                            <div className="grid grid-cols-2 gap-1.5">
                              {BUILDING_PRESET_RESOURCE_IDS.map((id) => (
                                <label key={`upkeep-res-${id}`} className="block">
                                  <div className="mb-1 text-[11px] text-zinc-400">{RESOURCE_LABELS[id]}</div>
                                  <input
                                    value={buildingDraft.upkeepResources[id] ?? ""}
                                    onChange={(e) =>
                                      setDraftResourceValue("upkeepResources", id, e.target.value)
                                    }
                                    className="h-7 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 text-xs text-emerald-200 outline-none focus:border-zinc-600"
                                    placeholder="0"
                                  />
                                </label>
                              ))}
                            </div>
                          </div>
                          <div className="rounded-lg border border-fuchsia-800/60 bg-fuchsia-950/20 p-2.5">
                            <div className="mb-2 text-xs font-semibold text-zinc-300">유지 인구 블록</div>
                            <div className="grid grid-cols-2 gap-1.5">
                              {UPKEEP_POPULATION_IDS.map((id) => (
                                <label key={`upkeep-pop-${id}`} className="block">
                                  <div className="mb-1 text-[11px] text-zinc-400">
                                    {UPKEEP_POPULATION_LABELS[id]}
                                  </div>
                                  <input
                                    value={buildingDraft.upkeepPopulation[id] ?? ""}
                                    onChange={(e) => setDraftPopulationValue(id, e.target.value)}
                                    className="h-7 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 text-xs text-fuchsia-200 outline-none focus:border-zinc-600"
                                    placeholder="0"
                                  />
                                </label>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="rounded-lg border border-zinc-800 bg-zinc-950/30 p-3">
                          <div className="mb-2 flex items-center justify-between">
                            <div className="text-xs font-semibold text-zinc-300">배치 조건 블록</div>
                            <button
                              type="button"
                              className="rounded-md border border-zinc-700 px-2 py-1 text-[11px] font-semibold text-zinc-200 hover:border-zinc-500"
                              onClick={handleAddPlacementRule}
                              disabled={busy}
                            >
                                조건 추가
                            </button>
                          </div>
                          <div className="space-y-2">
                            {buildingDraft.placementRules.length === 0 ? (
                                <div className="text-xs text-zinc-500">조건 없음</div>
                            ) : (
                              buildingDraft.placementRules.map((rule, index) => (
                                <div
                                  key={`placement-${index}`}
                                  className="grid gap-2 rounded-md border border-zinc-800 bg-zinc-950/40 p-2 md:grid-cols-[180px_1fr_auto]"
                                >
                                  <select
                                    value={rule.kind}
                                    onChange={(e) =>
                                      handleSetPlacementRuleKind(
                                        index,
                                        e.target.value as BuildingPlacementRule["kind"]
                                      )
                                    }
                                    className="h-8 rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                  >
                                    <option value="uniquePerTile">타일당 N개</option>
                                    <option value="tileRegionCompare">지역 상태 비교</option>
                                    <option value="requireTagInRange">거리 내 속성 필요</option>
                                    <option value="requireBuildingInRange">거리 내 건물 필요</option>
                                    <option value="custom">사용자 정의</option>
                                  </select>
                                  <div className="flex flex-wrap items-center gap-2">
                                    {rule.kind === "uniquePerTile" ? (
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-zinc-400">최대</span>
                                        <input
                                          value={String(rule.maxCount ?? 1)}
                                          onChange={(e) =>
                                            setDraftPlacementRules((prev) =>
                                              prev.map((item, i) =>
                                                i === index && item.kind === "uniquePerTile"
                                                  ? {
                                                      ...item,
                                                      maxCount: Math.max(
                                                        1,
                                                        Math.trunc(
                                                          Number(
                                                            e.target.value.replace(/[^\d]/g, "")
                                                          ) || 1
                                                        )
                                                      ),
                                                    }
                                                  : item
                                              )
                                            )
                                          }
                                          className="h-8 w-20 rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                          placeholder="1"
                                        />
                                        <span className="text-xs text-zinc-400">개</span>
                                      </div>
                                    ) : null}
                                    {rule.kind === "tileRegionCompare" ? (
                                      <>
                                        <select
                                          value={rule.field}
                                          onChange={(e) =>
                                            setDraftPlacementRules((prev) =>
                                              prev.map((item, i) =>
                                                i === index && item.kind === "tileRegionCompare"
                                                  ? {
                                                      ...item,
                                                      field: e.target.value as
                                                        | "spaceRemaining"
                                                        | "pollution"
                                                        | "threat"
                                                        | "satisfaction",
                                                    }
                                                  : item
                                              )
                                            )
                                          }
                                          className="h-8 min-w-[140px] rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                        >
                                          <option value="spaceRemaining">남은 공간</option>
                                          <option value="pollution">오염도</option>
                                          <option value="threat">위협도</option>
                                          <option value="satisfaction">만족치</option>
                                        </select>
                                        <select
                                          value={rule.op}
                                          onChange={(e) =>
                                            setDraftPlacementRules((prev) =>
                                              prev.map((item, i) =>
                                                i === index && item.kind === "tileRegionCompare"
                                                  ? {
                                                      ...item,
                                                      op: e.target.value as
                                                        | "eq"
                                                        | "ne"
                                                        | "gt"
                                                        | "gte"
                                                        | "lt"
                                                        | "lte",
                                                    }
                                                  : item
                                              )
                                            )
                                          }
                                          className="h-8 min-w-[90px] rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                        >
                                          <option value="eq">==</option>
                                          <option value="ne">!=</option>
                                          <option value="gt">{">"}</option>
                                          <option value="gte">{">="}</option>
                                          <option value="lt">{"<"}</option>
                                          <option value="lte">{"<="}</option>
                                        </select>
                                        <input
                                          value={String(rule.value ?? 0)}
                                          onChange={(e) =>
                                            setDraftPlacementRules((prev) =>
                                              prev.map((item, i) =>
                                                i === index && item.kind === "tileRegionCompare"
                                                  ? {
                                                      ...item,
                                                      value:
                                                        toNonNegativeInt(
                                                          e.target.value.replace(/[^\d]/g, "")
                                                        ) ?? 0,
                                                    }
                                                  : item
                                              )
                                            )
                                          }
                                          className="h-8 w-24 rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                          placeholder="값"
                                        />
                                      </>
                                    ) : null}
                                    {rule.kind === "requireTagInRange" ? (
                                      <>
                                        <div className="min-w-[220px] space-y-1">
                                          <div className="rounded-md border border-zinc-800 bg-zinc-950/50 px-2 py-1 text-[11px] text-zinc-300">
                                            선택:{" "}
                                            {activeTilePresets.find((p) => p.id === rule.tagPresetId)?.name ??
                                              "없음"}
                                          </div>
                                          <div className="relative">
                                            <input
                                              value={placementRuleSearch[`tag-${index}`] ?? ""}
                                              onChange={(e) =>
                                                setPlacementRuleSearch((prev) => ({
                                                  ...prev,
                                                  [`tag-${index}`]: e.target.value,
                                                }))
                                              }
                                              className="h-8 min-w-[140px] rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                              placeholder="속성 검색"
                                            />
                                            {(placementRuleSearch[`tag-${index}`] ?? "").trim() ? (
                                              <div className="absolute left-0 right-0 top-[calc(100%+2px)] z-30 max-h-28 overflow-auto rounded-md border border-zinc-800 bg-zinc-950 p-1 shadow-xl">
                                                {activeTilePresets
                                                  .filter((preset) =>
                                                    preset.name.includes(
                                                      (placementRuleSearch[`tag-${index}`] ?? "").trim()
                                                    )
                                                  )
                                                  .slice(0, 12)
                                                  .map((preset) => (
                                                    <button
                                                      key={`pick-tag-${index}-${preset.id}`}
                                                      type="button"
                                                      className="mb-1 block w-full rounded border border-zinc-800 bg-zinc-900/70 px-2 py-1 text-left text-[11px] text-zinc-200 hover:border-zinc-600"
                                                      onClick={() => {
                                                        setDraftPlacementRules((prev) =>
                                                          prev.map((item, i) =>
                                                            i === index &&
                                                            item.kind === "requireTagInRange"
                                                              ? {
                                                                  ...item,
                                                                  tagPresetId: preset.id,
                                                                }
                                                              : item
                                                          )
                                                        );
                                                        setPlacementRuleSearch((prev) => ({
                                                          ...prev,
                                                          [`tag-${index}`]: "",
                                                        }));
                                                      }}
                                                    >
                                                      {preset.name}
                                                    </button>
                                                  ))}
                                              </div>
                                            ) : null}
                                          </div>
                                        </div>
                                        <span className="text-xs text-zinc-400">거리</span>
                                        <input
                                          value={String(rule.distance ?? 1)}
                                          onChange={(e) =>
                                            setDraftPlacementRules((prev) =>
                                              prev.map((item, i) =>
                                                i === index && item.kind === "requireTagInRange"
                                                  ? {
                                                      ...item,
                                                      distance: Math.max(
                                                        0,
                                                        Math.trunc(
                                                          Number(
                                                            e.target.value.replace(/[^\d]/g, "")
                                                          ) || 0
                                                        )
                                                      ),
                                                    }
                                                  : item
                                              )
                                            )
                                          }
                                          className="h-8 w-20 rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                          placeholder="0"
                                        />
                                        <label className="inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200">
                                          <input
                                            type="checkbox"
                                            checked={!!rule.negate}
                                            onChange={(e) =>
                                              setDraftPlacementRules((prev) =>
                                                prev.map((item, i) =>
                                                  i === index && item.kind === "requireTagInRange"
                                                    ? { ...item, negate: e.target.checked }
                                                    : item
                                                )
                                              )
                                            }
                                          />
                                          부정
                                        </label>
                                        {(() => {
                                          const selected = activeTilePresets.find(
                                            (preset) => preset.id === rule.tagPresetId
                                          );
                                          if (!selected?.hasValue) return null;
                                          return (
                                            <>
                                              <select
                                                value={rule.valueMode ?? "equals"}
                                                onChange={(e) =>
                                                  setDraftPlacementRules((prev) =>
                                                    prev.map((item, i) =>
                                                      i === index &&
                                                      item.kind === "requireTagInRange"
                                                        ? {
                                                            ...item,
                                                            valueMode: e.target.value as
                                                              | "equals"
                                                              | "contains",
                                                          }
                                                        : item
                                                    )
                                                  )
                                                }
                                                className="h-8 min-w-[110px] rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                              >
                                                <option value="equals">값 일치</option>
                                                <option value="contains">값 포함</option>
                                              </select>
                                              <input
                                                value={rule.value ?? ""}
                                                onChange={(e) =>
                                                  setDraftPlacementRules((prev) =>
                                                    prev.map((item, i) =>
                                                      i === index &&
                                                      item.kind === "requireTagInRange"
                                                        ? { ...item, value: e.target.value }
                                                        : item
                                                    )
                                                  )
                                                }
                                                className="h-8 min-w-[140px] rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                                placeholder="속성 값"
                                              />
                                            </>
                                          );
                                        })()}
                                      </>
                                    ) : null}
                                    {rule.kind === "requireBuildingInRange" ? (
                                      <>
                                        <div className="min-w-[220px] space-y-1">
                                          <div className="rounded-md border border-zinc-800 bg-zinc-950/50 px-2 py-1 text-[11px] text-zinc-300">
                                            선택:{" "}
                                            {activeBuildingPresets.find((p) => p.id === rule.presetId)?.name ??
                                              "없음"}
                                          </div>
                                          <div className="relative">
                                            <input
                                              value={placementRuleSearch[`building-${index}`] ?? ""}
                                              onChange={(e) =>
                                                setPlacementRuleSearch((prev) => ({
                                                  ...prev,
                                                  [`building-${index}`]: e.target.value,
                                                }))
                                              }
                                              className="h-8 min-w-[140px] rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                              placeholder="건물 검색"
                                            />
                                            {(placementRuleSearch[`building-${index}`] ?? "").trim() ? (
                                              <div className="absolute left-0 right-0 top-[calc(100%+2px)] z-30 max-h-28 overflow-auto rounded-md border border-zinc-800 bg-zinc-950 p-1 shadow-xl">
                                                {activeBuildingPresets
                                                  .filter((preset) =>
                                                    preset.name.includes(
                                                      (placementRuleSearch[`building-${index}`] ?? "").trim()
                                                    )
                                                  )
                                                  .slice(0, 12)
                                                  .map((preset) => (
                                                    <button
                                                      key={`pick-building-${index}-${preset.id}`}
                                                      type="button"
                                                      className="mb-1 block w-full rounded border border-zinc-800 bg-zinc-900/70 px-2 py-1 text-left text-[11px] text-zinc-200 hover:border-zinc-600"
                                                      onClick={() => {
                                                        setDraftPlacementRules((prev) =>
                                                          prev.map((item, i) =>
                                                            i === index &&
                                                            item.kind === "requireBuildingInRange"
                                                              ? {
                                                                  ...item,
                                                                  presetId: preset.id,
                                                                }
                                                              : item
                                                          )
                                                        );
                                                        setPlacementRuleSearch((prev) => ({
                                                          ...prev,
                                                          [`building-${index}`]: "",
                                                        }));
                                                      }}
                                                    >
                                                      {preset.name}
                                                    </button>
                                                  ))}
                                              </div>
                                            ) : null}
                                          </div>
                                        </div>
                                        <span className="text-xs text-zinc-400">거리</span>
                                        <input
                                          value={String(rule.distance ?? 1)}
                                          onChange={(e) =>
                                            setDraftPlacementRules((prev) =>
                                              prev.map((item, i) =>
                                                i === index && item.kind === "requireBuildingInRange"
                                                  ? {
                                                      ...item,
                                                      distance: Math.max(
                                                        0,
                                                        Math.trunc(
                                                          Number(
                                                            e.target.value.replace(/[^\d]/g, "")
                                                          ) || 0
                                                        )
                                                      ),
                                                    }
                                                  : item
                                              )
                                            )
                                          }
                                          className="h-8 w-20 rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                          placeholder="0"
                                        />
                                        <label className="inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200">
                                          <input
                                            type="checkbox"
                                            checked={!!rule.negate}
                                            onChange={(e) =>
                                              setDraftPlacementRules((prev) =>
                                                prev.map((item, i) =>
                                                  i === index &&
                                                  item.kind === "requireBuildingInRange"
                                                    ? { ...item, negate: e.target.checked }
                                                    : item
                                                )
                                              )
                                            }
                                          />
                                          부정
                                        </label>
                                      </>
                                    ) : null}
                                    {rule.kind === "custom" ? (
                                      <input
                                        value={rule.label ?? ""}
                                        onChange={(e) =>
                                          setDraftPlacementRules((prev) =>
                                            prev.map((item, i) =>
                                              i === index && item.kind === "custom"
                                                ? { ...item, label: e.target.value }
                                                : item
                                            )
                                          )
                                        }
                                        className="h-8 min-w-[180px] rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                        placeholder="사용자 정의 조건"
                                      />
                                    ) : null}
                                  </div>
                                  <button
                                    type="button"
                                    className="h-8 rounded-md border border-red-800/70 bg-red-950/40 px-2 text-[11px] font-semibold text-red-200 hover:bg-red-900/40"
                                    onClick={() => handleRemovePlacementRule(index)}
                                    disabled={busy}
                                  >
                                    제거
                                  </button>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                        {(
                          [
                            ["onBuild", "건설 시 규칙"],
                            ["daily", "일일 규칙"],
                            ["onRemove", "철거 시 규칙"],
                          ] as const
                        ).map(([field, title]) => (
                          <div
                            key={`effects-${field}`}
                            className="rounded-lg border border-zinc-800 bg-zinc-950/30 p-3"
                          >
                            <div className="mb-2 flex items-center justify-between">
                              <div className="text-xs font-semibold text-zinc-300">{title}</div>
                              <button
                                type="button"
                                className="rounded-md border border-zinc-700 px-2 py-1 text-[11px] font-semibold text-zinc-200 hover:border-zinc-500"
                                onClick={() => handleAddExecutionRule(field)}
                                disabled={busy}
                              >
                                규칙 추가
                              </button>
                            </div>
                            <div className="space-y-2">
                              {buildingDraft[field].length === 0 ? (
                                <div className="text-xs text-zinc-500">규칙 없음</div>
                              ) : (
                                buildingDraft[field].map((rule, ruleIndex) => {
                                  const whenKind = getWhenKind(rule.when);
                                  const compareWhen =
                                    whenKind === "compare" && rule.when?.kind === "compare"
                                      ? rule.when
                                      : null;
                                  const tileRegionCompareWhen =
                                    whenKind === "tileRegionCompare" &&
                                    rule.when?.kind === "tileRegionCompare"
                                      ? rule.when
                                      : null;
                                  const placementWhen =
                                    whenKind &&
                                    whenKind !== "compare" &&
                                    whenKind !== "tileRegionCompare" &&
                                    rule.when &&
                                    isPlacementRuleKind(rule.when.kind)
                                      ? (rule.when as BuildingPlacementRule)
                                      : null;
                                  const leftResource =
                                    compareWhen?.left.kind === "resource"
                                      ? compareWhen.left.resourceId
                                      : "gold";
                                  return (
                                    <div
                                      key={`rule-${field}-${rule.id}-${ruleIndex}`}
                                      className="rounded-md border border-amber-800/60 bg-amber-950/15 p-2"
                                    >
                                      <div className="mb-2 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <label className="flex items-center gap-2 text-xs text-zinc-300">
                                            <input
                                              type="checkbox"
                                              checked={!!rule.when}
                                              onChange={(e) =>
                                                setEffectRuleAt(field, ruleIndex, {
                                                  ...rule,
                                                  when: e.target.checked
                                                    ? createDefaultComparePredicate()
                                                    : undefined,
                                                })
                                              }
                                            />
                                            조건 사용
                                          </label>
                                          {rule.when ? (
                                            <select
                                              value={whenKind ?? "compare"}
                                              onChange={(e) =>
                                                setEffectRuleAt(field, ruleIndex, {
                                                  ...rule,
                                                  when: createDefaultWhenByKind(
                                                    e.target.value as RuleWhenKind
                                                  ),
                                                })
                                              }
                                              className="h-7 rounded-md border border-zinc-700 bg-zinc-950 px-2 text-[11px] text-zinc-100"
                                            >
                                              <option value="compare">자원 비교</option>
                                              <option value="tileRegionCompare">
                                                지역 상태 비교
                                              </option>
                                              <option value="uniquePerTile">타일당 N개</option>
                                              <option value="requireTagInRange">
                                                거리 내 속성 필요
                                              </option>
                                              <option value="requireBuildingInRange">
                                                거리 내 건물 필요
                                              </option>
                                              <option value="custom">사용자 정의</option>
                                            </select>
                                          ) : null}
                                          {field === "daily" ? (
                                            <div className="flex items-center gap-1">
                                              <input
                                                value={String(rule.intervalDays ?? 1)}
                                               onChange={(e) =>
                                                 setEffectRuleAt(field, ruleIndex, {
                                                   ...rule,
                                                   intervalDays:
                                                     Math.max(
                                                       1,
                                                       Math.trunc(
                                                         Number(
                                                           e.target.value.replace(/[^\d]/g, "")
                                                         ) || 1
                                                       )
                                                     ),
                                                 })
                                               }
                                               className="h-7 w-16 rounded-md border border-zinc-700 bg-zinc-950 px-2 text-[11px] text-emerald-200"
                                               placeholder="1"
                                             />
                                               <span className="text-[11px] text-zinc-400">일마다</span>
                                           </div>
                                          ) : null}
                                        </div>
                                        <button
                                          type="button"
                                          className="rounded-md border border-red-800/70 bg-red-950/40 px-2 py-1 text-[11px] font-semibold text-red-200 hover:bg-red-900/40"
                                          onClick={() => removeEffectRule(field, ruleIndex)}
                                          disabled={busy}
                                        >
                                          규칙 제거
                                        </button>
                                      </div>
                                      {compareWhen ? (
                                        <div className="mb-2 grid gap-2 rounded-md border border-sky-800/60 bg-sky-950/15 p-2 md:grid-cols-[1fr_90px_110px]">
                                          <select
                                            value={leftResource}
                                            onChange={(e) =>
                                              setEffectRuleAt(field, ruleIndex, {
                                                ...rule,
                                                when: {
                                                  ...compareWhen,
                                                  left: {
                                                    kind: "resource",
                                                    resourceId: e.target.value as ResourceId,
                                                  },
                                                },
                                              })
                                            }
                                            className="h-8 rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                          >
                                            {ALL_RESOURCE_IDS.map((id) => (
                                              <option key={`cond-r-${id}`} value={id}>
                                                {RESOURCE_LABELS[id]}
                                              </option>
                                            ))}
                                          </select>
                                          <select
                                            value={compareWhen.op}
                                            onChange={(e) =>
                                              setEffectRuleAt(field, ruleIndex, {
                                                ...rule,
                                                when: {
                                                  ...compareWhen,
                                                  op: e.target.value as typeof compareWhen.op,
                                                },
                                              })
                                            }
                                            className="h-8 rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                          >
                                            <option value="eq">==</option>
                                            <option value="ne">!=</option>
                                            <option value="gt">{">"}</option>
                                            <option value="gte">{">="}</option>
                                            <option value="lt">{"<"}</option>
                                            <option value="lte">{"<="}</option>
                                          </select>
                                          <input
                                            value={exprToEditableNumber(compareWhen.right)}
                                            onChange={(e) =>
                                              setEffectRuleAt(field, ruleIndex, {
                                                ...rule,
                                                when: {
                                                  ...compareWhen,
                                                  right: {
                                                    kind: "const",
                                                    value:
                                                      toNonNegativeInt(
                                                        e.target.value.replace(/[^\d]/g, "")
                                                      ) ?? 0,
                                                  },
                                                },
                                              })
                                            }
                                            className="h-8 rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                            placeholder="값"
                                          />
                                        </div>
                                      ) : null}
                                      {tileRegionCompareWhen ? (
                                        <div className="mb-2 grid gap-2 rounded-md border border-sky-800/60 bg-sky-950/15 p-2 md:grid-cols-[1fr_90px_110px]">
                                          <select
                                            value={tileRegionCompareWhen.field}
                                            onChange={(e) =>
                                              setEffectRuleAt(field, ruleIndex, {
                                                ...rule,
                                                when: {
                                                  ...tileRegionCompareWhen,
                                                  field: e.target.value as
                                                    | "spaceRemaining"
                                                    | "pollution"
                                                    | "threat"
                                                    | "satisfaction",
                                                },
                                              })
                                            }
                                            className="h-8 rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                          >
                                            <option value="spaceRemaining">남은 공간</option>
                                            <option value="pollution">오염도</option>
                                            <option value="threat">위협도</option>
                                            <option value="satisfaction">만족치</option>
                                          </select>
                                          <select
                                            value={tileRegionCompareWhen.op}
                                            onChange={(e) =>
                                              setEffectRuleAt(field, ruleIndex, {
                                                ...rule,
                                                when: {
                                                  ...tileRegionCompareWhen,
                                                  op: e.target.value as typeof tileRegionCompareWhen.op,
                                                },
                                              })
                                            }
                                            className="h-8 rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                          >
                                            <option value="eq">==</option>
                                            <option value="ne">!=</option>
                                            <option value="gt">{">"}</option>
                                            <option value="gte">{">="}</option>
                                            <option value="lt">{"<"}</option>
                                            <option value="lte">{"<="}</option>
                                          </select>
                                          <input
                                            value={String(tileRegionCompareWhen.value ?? 0)}
                                            onChange={(e) =>
                                              setEffectRuleAt(field, ruleIndex, {
                                                ...rule,
                                                when: {
                                                  ...tileRegionCompareWhen,
                                                  value:
                                                    toNonNegativeInt(
                                                      e.target.value.replace(/[^\d]/g, "")
                                                    ) ?? 0,
                                                },
                                              })
                                            }
                                            className="h-8 rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                            placeholder="값"
                                          />
                                        </div>
                                      ) : null}
                                      {!compareWhen && placementWhen ? (
                                        <div className="mb-2 flex flex-wrap items-center gap-2 rounded-md border border-sky-800/60 bg-sky-950/15 p-2">
                                          {placementWhen.kind === "uniquePerTile" ? (
                                            <div className="flex items-center gap-2">
                                              <span className="text-xs text-zinc-400">최대</span>
                                              <input
                                                value={String(placementWhen.maxCount ?? 1)}
                                                onChange={(e) =>
                                                  setEffectRuleAt(field, ruleIndex, {
                                                    ...rule,
                                                    when: {
                                                      ...placementWhen,
                                                      maxCount: Math.max(
                                                        1,
                                                        Math.trunc(
                                                          Number(
                                                            e.target.value.replace(/[^\d]/g, "")
                                                          ) || 1
                                                        )
                                                      ),
                                                    },
                                                  })
                                                }
                                                className="h-8 w-20 rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                                placeholder="1"
                                              />
                                              <span className="text-xs text-zinc-400">개</span>
                                            </div>
                                          ) : null}
                                          {placementWhen.kind === "requireTagInRange" ? (
                                            <>
                                              <div className="min-w-[220px] space-y-1">
                                                <div className="rounded-md border border-zinc-800 bg-zinc-950/50 px-2 py-1 text-[11px] text-zinc-300">
                                                  선택:{" "}
                                                  {activeTilePresets.find(
                                                    (p) => p.id === placementWhen.tagPresetId
                                                  )?.name ?? "없음"}
                                                </div>
                                                <div className="relative">
                                                  <input
                                                    value={
                                                      placementRuleSearch[
                                                        `when-tag-${field}-${ruleIndex}`
                                                      ] ?? ""
                                                    }
                                                    onChange={(e) =>
                                                      setPlacementRuleSearch((prev) => ({
                                                        ...prev,
                                                        [`when-tag-${field}-${ruleIndex}`]:
                                                          e.target.value,
                                                      }))
                                                    }
                                                    className="h-8 min-w-[140px] rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                                    placeholder="속성 검색"
                                                  />
                                                  {(
                                                    placementRuleSearch[
                                                      `when-tag-${field}-${ruleIndex}`
                                                    ] ?? ""
                                                  ).trim() ? (
                                                    <div className="absolute left-0 right-0 top-[calc(100%+2px)] z-30 max-h-28 overflow-auto rounded-md border border-zinc-800 bg-zinc-950 p-1 shadow-xl">
                                                      {activeTilePresets
                                                        .filter((preset) =>
                                                          preset.name.includes(
                                                            (
                                                              placementRuleSearch[
                                                                `when-tag-${field}-${ruleIndex}`
                                                              ] ?? ""
                                                            ).trim()
                                                          )
                                                        )
                                                        .slice(0, 12)
                                                        .map((preset) => (
                                                          <button
                                                            key={`pick-when-tag-${field}-${rule.id}-${ruleIndex}-${preset.id}`}
                                                            type="button"
                                                            className="mb-1 block w-full rounded border border-zinc-800 bg-zinc-900/70 px-2 py-1 text-left text-[11px] text-zinc-200 hover:border-zinc-600"
                                                            onClick={() => {
                                                              setEffectRuleAt(field, ruleIndex, {
                                                                ...rule,
                                                                when: {
                                                                  ...placementWhen,
                                                                  tagPresetId: preset.id,
                                                                },
                                                              });
                                                              setPlacementRuleSearch((prev) => ({
                                                                ...prev,
                                                                [`when-tag-${field}-${ruleIndex}`]: "",
                                                              }));
                                                            }}
                                                          >
                                                            {preset.name}
                                                          </button>
                                                        ))}
                                                    </div>
                                                  ) : null}
                                                </div>
                                              </div>
                                              <span className="text-xs text-zinc-400">거리</span>
                                              <input
                                                value={String(placementWhen.distance ?? 1)}
                                                onChange={(e) =>
                                                  setEffectRuleAt(field, ruleIndex, {
                                                    ...rule,
                                                    when: {
                                                      ...placementWhen,
                                                      distance: Math.max(
                                                        0,
                                                        Math.trunc(
                                                          Number(
                                                            e.target.value.replace(/[^\d]/g, "")
                                                          ) || 0
                                                        )
                                                      ),
                                                    },
                                                  })
                                                }
                                                className="h-8 w-20 rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                                placeholder="0"
                                              />
                                              <label className="inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200">
                                                <input
                                                  type="checkbox"
                                                  checked={!!placementWhen.negate}
                                                  onChange={(e) =>
                                                    setEffectRuleAt(field, ruleIndex, {
                                                      ...rule,
                                                      when: {
                                                        ...placementWhen,
                                                        negate: e.target.checked,
                                                      },
                                                    })
                                                  }
                                                />
                                                부정
                                              </label>
                                              <label className="inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200">
                                                <input
                                                  type="checkbox"
                                                  checked={!!placementWhen.repeat}
                                                  onChange={(e) =>
                                                    setEffectRuleAt(field, ruleIndex, {
                                                      ...rule,
                                                      when: {
                                                        ...placementWhen,
                                                        repeat: e.target.checked,
                                                      },
                                                    })
                                                  }
                                                />
                                                諛섎났
                                              </label>
                                              {(() => {
                                                const selected = activeTilePresets.find(
                                                  (preset) =>
                                                    preset.id === placementWhen.tagPresetId
                                                );
                                                if (!selected?.hasValue) return null;
                                                return (
                                                  <>
                                                    <select
                                                      value={placementWhen.valueMode ?? "equals"}
                                                      onChange={(e) =>
                                                        setEffectRuleAt(field, ruleIndex, {
                                                          ...rule,
                                                          when: {
                                                            ...placementWhen,
                                                            valueMode: e.target.value as
                                                              | "equals"
                                                              | "contains",
                                                          },
                                                        })
                                                      }
                                                      className="h-8 min-w-[110px] rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                                    >
                                                      <option value="equals">값 일치</option>
                                                      <option value="contains">값 포함</option>
                                                    </select>
                                                    <input
                                                      value={placementWhen.value ?? ""}
                                                      onChange={(e) =>
                                                        setEffectRuleAt(field, ruleIndex, {
                                                          ...rule,
                                                          when: {
                                                            ...placementWhen,
                                                            value: e.target.value,
                                                          },
                                                        })
                                                      }
                                                      className="h-8 min-w-[140px] rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                                      placeholder="속성 값"
                                                    />
                                                  </>
                                                );
                                              })()}
                                            </>
                                          ) : null}
                                          {placementWhen.kind === "requireBuildingInRange" ? (
                                            <>
                                              <div className="min-w-[220px] space-y-1">
                                                <div className="rounded-md border border-zinc-800 bg-zinc-950/50 px-2 py-1 text-[11px] text-zinc-300">
                                                  선택:{" "}
                                                  {activeBuildingPresets.find(
                                                    (p) => p.id === placementWhen.presetId
                                                  )?.name ?? "없음"}
                                                </div>
                                                <div className="relative">
                                                  <input
                                                    value={
                                                      placementRuleSearch[
                                                        `when-building-${field}-${ruleIndex}`
                                                      ] ?? ""
                                                    }
                                                    onChange={(e) =>
                                                      setPlacementRuleSearch((prev) => ({
                                                        ...prev,
                                                        [`when-building-${field}-${ruleIndex}`]:
                                                          e.target.value,
                                                      }))
                                                    }
                                                    className="h-8 min-w-[140px] rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                                    placeholder="건물 검색"
                                                  />
                                                  {(
                                                    placementRuleSearch[
                                                      `when-building-${field}-${ruleIndex}`
                                                    ] ?? ""
                                                  ).trim() ? (
                                                    <div className="absolute left-0 right-0 top-[calc(100%+2px)] z-30 max-h-28 overflow-auto rounded-md border border-zinc-800 bg-zinc-950 p-1 shadow-xl">
                                                      {activeBuildingPresets
                                                        .filter((preset) =>
                                                          preset.name.includes(
                                                            (
                                                              placementRuleSearch[
                                                                `when-building-${field}-${ruleIndex}`
                                                              ] ?? ""
                                                            ).trim()
                                                          )
                                                        )
                                                        .slice(0, 12)
                                                        .map((preset) => (
                                                          <button
                                                            key={`pick-when-building-${field}-${rule.id}-${ruleIndex}-${preset.id}`}
                                                            type="button"
                                                            className="mb-1 block w-full rounded border border-zinc-800 bg-zinc-900/70 px-2 py-1 text-left text-[11px] text-zinc-200 hover:border-zinc-600"
                                                            onClick={() => {
                                                              setEffectRuleAt(field, ruleIndex, {
                                                                ...rule,
                                                                when: {
                                                                  ...placementWhen,
                                                                  presetId: preset.id,
                                                                },
                                                              });
                                                              setPlacementRuleSearch((prev) => ({
                                                                ...prev,
                                                                [`when-building-${field}-${ruleIndex}`]: "",
                                                              }));
                                                            }}
                                                          >
                                                            {preset.name}
                                                          </button>
                                                        ))}
                                                    </div>
                                                  ) : null}
                                                </div>
                                              </div>
                                              <span className="text-xs text-zinc-400">거리</span>
                                              <input
                                                value={String(placementWhen.distance ?? 1)}
                                                onChange={(e) =>
                                                  setEffectRuleAt(field, ruleIndex, {
                                                    ...rule,
                                                    when: {
                                                      ...placementWhen,
                                                      distance: Math.max(
                                                        0,
                                                        Math.trunc(
                                                          Number(
                                                            e.target.value.replace(/[^\d]/g, "")
                                                          ) || 0
                                                        )
                                                      ),
                                                    },
                                                  })
                                                }
                                                className="h-8 w-20 rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                                placeholder="0"
                                              />
                                              <label className="inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200">
                                                <input
                                                  type="checkbox"
                                                  checked={!!placementWhen.negate}
                                                  onChange={(e) =>
                                                    setEffectRuleAt(field, ruleIndex, {
                                                      ...rule,
                                                      when: {
                                                        ...placementWhen,
                                                        negate: e.target.checked,
                                                      },
                                                    })
                                                  }
                                                />
                                                부정
                                              </label>
                                              <label className="inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200">
                                                <input
                                                  type="checkbox"
                                                  checked={!!placementWhen.repeat}
                                                  onChange={(e) =>
                                                    setEffectRuleAt(field, ruleIndex, {
                                                      ...rule,
                                                      when: {
                                                        ...placementWhen,
                                                        repeat: e.target.checked,
                                                      },
                                                    })
                                                  }
                                                />
                                                반복
                                              </label>
                                            </>
                                          ) : null}
                                          {placementWhen.kind === "custom" ? (
                                            <input
                                              value={placementWhen.label ?? ""}
                                              onChange={(e) =>
                                                setEffectRuleAt(field, ruleIndex, {
                                                  ...rule,
                                                  when: { ...placementWhen, label: e.target.value },
                                                })
                                              }
                                              className="h-8 min-w-[180px] rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                              placeholder="사용자 정의 조건"
                                            />
                                          ) : null}
                                        </div>
                                      ) : null}
                                      <div className="space-y-2">
                                        {rule.actions.map((action, actionIndex) => (
                                          <div
                                            key={`action-${field}-${rule.id}-${actionIndex}`}
                                            className="grid gap-2 rounded-md border border-emerald-800/60 bg-emerald-950/15 p-2 md:grid-cols-[170px_1fr_120px_auto]"
                                          >
                                            <select
                                              value={action.kind}
                                              onChange={(e) =>
                                                setEffectActionAt(
                                                  field,
                                                  ruleIndex,
                                                  actionIndex,
                                                  createActionByKind(
                                                    e.target.value as BuildingRuleAction["kind"]
                                                  )
                                                )
                                              }
                                              className="h-8 rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                            >
                                              <option value="adjustResource">자원 증감</option>
                                              <option value="adjustResourceCap">자원 상한 증감</option>
                                              <option value="adjustPopulation">인구 증감</option>
                                              <option value="adjustPopulationCap">인구 상한 증감</option>
                                              <option value="convertPopulation">인구 전환</option>
                                              <option value="adjustTileRegion">지역 상태 증감</option>
                                              <option value="addTileState">타일 속성 추가</option>
                                              <option value="removeTileState">타일 속성 제거</option>
                                            </select>
                                            <div className="flex flex-wrap items-center gap-2">
                                              {action.kind === "adjustResource" ? (
                                                <select
                                                  value={action.resourceId}
                                                  onChange={(e) =>
                                                    setEffectActionAt(field, ruleIndex, actionIndex, {
                                                      ...action,
                                                      resourceId: e.target.value as ResourceId,
                                                    })
                                                  }
                                                  className="h-8 min-w-[120px] rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                                >
                                                  {ALL_RESOURCE_IDS.map((id) => (
                                                    <option key={`act-r-${id}`} value={id}>
                                                      {RESOURCE_LABELS[id]}
                                                    </option>
                                                  ))}
                                                </select>
                                              ) : null}
                                              {action.kind === "adjustResourceCap" ? (
                                                <select
                                                  value={action.resourceId}
                                                  onChange={(e) =>
                                                    setEffectActionAt(field, ruleIndex, actionIndex, {
                                                      ...action,
                                                      resourceId: e.target.value as CappedResourceId,
                                                    })
                                                  }
                                                  className="h-8 min-w-[120px] rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                                >
                                                  {CAPPED_RESOURCE_IDS.map((id) => (
                                                    <option key={`act-cap-${id}`} value={id}>
                                                      {RESOURCE_LABELS[id]}
                                                    </option>
                                                  ))}
                                                </select>
                                              ) : null}
                                              {action.kind === "adjustPopulation" ? (
                                                <select
                                                  value={action.populationId}
                                                  onChange={(e) =>
                                                    setEffectActionAt(field, ruleIndex, actionIndex, {
                                                      ...action,
                                                      populationId: e.target.value as PopulationTrackedId,
                                                    })
                                                  }
                                                  className="h-8 min-w-[120px] rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                                >
                                                  {TRACKED_POPULATION_IDS.map((id) => (
                                                    <option key={`act-p-${id}`} value={id}>
                                                      {POPULATION_LABELS[id]}
                                                    </option>
                                                  ))}
                                                </select>
                                              ) : null}
                                              {action.kind === "adjustPopulationCap" ? (
                                                <span className="inline-flex h-8 items-center rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-300">
                                                  전체 인구 상한
                                                </span>
                                              ) : null}
                                              {action.kind === "convertPopulation" ? (
                                                <>
                                                  <select
                                                    value={action.from}
                                                    onChange={(e) =>
                                                      setEffectActionAt(field, ruleIndex, actionIndex, {
                                                        ...action,
                                                        from: e.target.value as PopulationTrackedId,
                                                      })
                                                    }
                                                    className="h-8 min-w-[120px] rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                                  >
                                                    {TRACKED_POPULATION_IDS.map((id) => (
                                                      <option key={`act-from-${id}`} value={id}>
                                                        {POPULATION_LABELS[id]}
                                                      </option>
                                                    ))}
                                                  </select>
                                                  <span className="text-xs text-zinc-500">→</span>
                                                  <select
                                                    value={action.to}
                                                    onChange={(e) =>
                                                      setEffectActionAt(field, ruleIndex, actionIndex, {
                                                        ...action,
                                                        to: e.target.value as PopulationTrackedId,
                                                      })
                                                    }
                                                    className="h-8 min-w-[120px] rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                                  >
                                                    {TRACKED_POPULATION_IDS.map((id) => (
                                                      <option key={`act-to-${id}`} value={id}>
                                                        {POPULATION_LABELS[id]}
                                                      </option>
                                                    ))}
                                                  </select>
                                                </>
                                              ) : null}
                                              {action.kind === "adjustTileRegion" ? (
                                                <select
                                                  value={action.field}
                                                  onChange={(e) =>
                                                    setEffectActionAt(field, ruleIndex, actionIndex, {
                                                      ...action,
                                                      field: e.target.value as keyof MapTileRegionState,
                                                    })
                                                  }
                                                  className="h-8 min-w-[120px] rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                                >
                                                  <option value="spaceUsed">사용 공간</option>
                                                  <option value="spaceCap">최대 공간</option>
                                                  <option value="satisfaction">만족치</option>
                                                  <option value="threat">위협도</option>
                                                  <option value="pollution">오염도</option>
                                                </select>
                                              ) : null}
                                              {action.kind === "addTileState" ||
                                              action.kind === "removeTileState" ? (
                                                <div className="min-w-[220px] space-y-1">
                                                  <div className="rounded-md border border-zinc-800 bg-zinc-950/50 px-2 py-1 text-[11px] text-zinc-300">
                                                    선택:{" "}
                                                    {activeTilePresets.find(
                                                      (p) => p.id === action.tagPresetId
                                                    )?.name ?? "없음"}
                                                  </div>
                                                  <div className="relative">
                                                    <input
                                                      value={
                                                        placementRuleSearch[
                                                          `action-tag-${field}-${ruleIndex}-${actionIndex}`
                                                        ] ?? ""
                                                      }
                                                      onChange={(e) =>
                                                        setPlacementRuleSearch((prev) => ({
                                                          ...prev,
                                                          [`action-tag-${field}-${ruleIndex}-${actionIndex}`]:
                                                            e.target.value,
                                                        }))
                                                      }
                                                      className="h-8 min-w-[140px] rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                                      placeholder="속성 검색"
                                                    />
                                                    {(
                                                      placementRuleSearch[
                                                        `action-tag-${field}-${ruleIndex}-${actionIndex}`
                                                      ] ?? ""
                                                    ).trim() ? (
                                                      <div className="absolute left-0 right-0 top-[calc(100%+2px)] z-30 max-h-28 overflow-auto rounded-md border border-zinc-800 bg-zinc-950 p-1 shadow-xl">
                                                        {activeTilePresets
                                                          .filter((preset) =>
                                                            preset.name.includes(
                                                              (
                                                                placementRuleSearch[
                                                                  `action-tag-${field}-${ruleIndex}-${actionIndex}`
                                                                ] ?? ""
                                                              ).trim()
                                                            )
                                                          )
                                                          .slice(0, 12)
                                                          .map((preset) => (
                                                            <button
                                                              key={`pick-action-tag-${field}-${rule.id}-${ruleIndex}-${actionIndex}-${preset.id}`}
                                                              type="button"
                                                              className="mb-1 block w-full rounded border border-zinc-800 bg-zinc-900/70 px-2 py-1 text-left text-[11px] text-zinc-200 hover:border-zinc-600"
                                                              onClick={() => {
                                                                setEffectActionAt(
                                                                  field,
                                                                  ruleIndex,
                                                                  actionIndex,
                                                                  {
                                                                    ...action,
                                                                    tagPresetId: preset.id,
                                                                  }
                                                                );
                                                                setPlacementRuleSearch((prev) => ({
                                                                  ...prev,
                                                                  [`action-tag-${field}-${ruleIndex}-${actionIndex}`]:
                                                                    "",
                                                                }));
                                                              }}
                                                            >
                                                              {preset.name}
                                                            </button>
                                                          ))}
                                                      </div>
                                                    ) : null}
                                                  </div>
                                                </div>
                                              ) : null}
                                              {action.kind === "addTileState" &&
                                              activeTilePresets.find((p) => p.id === action.tagPresetId)
                                                ?.hasValue ? (
                                                <input
                                                  value={action.value ?? ""}
                                                  onChange={(e) =>
                                                    setEffectActionAt(field, ruleIndex, actionIndex, {
                                                      ...action,
                                                      value: e.target.value,
                                                    })
                                                  }
                                                  className="h-8 min-w-[140px] rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                                  placeholder="속성 값"
                                                />
                                              ) : null}
                                              <select
                                                value={action.target ?? "self"}
                                                onChange={(e) => {
                                                  const target = e.target.value === "range" ? "range" : "self";
                                                  setEffectActionAt(field, ruleIndex, actionIndex, {
                                                    ...action,
                                                    target,
                                                    distance:
                                                      target === "range"
                                                        ? Math.max(
                                                            0,
                                                            Math.trunc(
                                                              Number((action as any).distance ?? 1) || 0
                                                            )
                                                          )
                                                        : undefined,
                                                  });
                                                }}
                                                className="h-8 min-w-[120px] rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                              >
                                                <option value="self">현재 타일</option>
                                                <option value="range">거리 내 타일</option>
                                              </select>
                                              {(action.target ?? "self") === "range" ? (
                                                <>
                                                  <span className="text-xs text-zinc-400">거리</span>
                                                  <input
                                                    value={String(
                                                      Math.max(
                                                        0,
                                                        Number((action as any).distance ?? 1) || 0
                                                      )
                                                    )}
                                                    onChange={(e) =>
                                                      setEffectActionAt(field, ruleIndex, actionIndex, {
                                                        ...action,
                                                        distance: Math.max(
                                                          0,
                                                          Math.trunc(
                                                            Number(e.target.value.replace(/[^\d]/g, "")) || 0
                                                          )
                                                        ),
                                                      })
                                                    }
                                                    className="h-8 w-20 rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                                    placeholder="0"
                                                  />
                                                </>
                                              ) : null}
                                            </div>
                                            {action.kind === "convertPopulation" ||
                                            action.kind === "adjustResource" ||
                                            action.kind === "adjustResourceCap" ||
                                            action.kind === "adjustPopulation" ||
                                            action.kind === "adjustPopulationCap" ||
                                            action.kind === "adjustTileRegion" ? (
                                              <input
                                                value={
                                                  action.kind === "convertPopulation"
                                                    ? exprToEditableNumber(action.amount)
                                                    : exprToEditableNumber(action.delta)
                                                }
                                                onChange={(e) => {
                                                  if (action.kind === "convertPopulation") {
                                                    const next =
                                                      toNonNegativeInt(
                                                        e.target.value.replace(/[^\d]/g, "")
                                                      ) ?? 0;
                                                    setEffectActionAt(field, ruleIndex, actionIndex, {
                                                      ...action,
                                                      amount: { kind: "const", value: next },
                                                    });
                                                    return;
                                                  }
                                                  const stripped = e.target.value.replace(/[^\d-]/g, "");
                                                  const normalized = stripped.startsWith("-")
                                                    ? `-${stripped.slice(1).replace(/-/g, "")}`
                                                    : stripped.replace(/-/g, "");
                                                  const parsed = Math.trunc(Number(normalized));
                                                  const next = Number.isFinite(parsed) ? parsed : 0;
                                                  setEffectActionAt(field, ruleIndex, actionIndex, {
                                                    ...action,
                                                    delta: { kind: "const", value: next },
                                                  });
                                                }}
                                                className="h-8 rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                                placeholder="0"
                                              />
                                            ) : (
                                              <div className="h-8" />
                                            )}
                                            <button
                                              type="button"
                                              className="h-8 rounded-md border border-red-800/70 bg-red-950/40 px-2 text-[11px] font-semibold text-red-200 hover:bg-red-900/40"
                                              onClick={() =>
                                                removeEffectAction(field, ruleIndex, actionIndex)
                                              }
                                              disabled={busy}
                                            >
                                              제거
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                      <div className="mt-2 flex justify-end">
                                        <button
                                          type="button"
                                          className="rounded-md border border-zinc-700 px-2 py-1 text-[11px] font-semibold text-zinc-100 hover:border-zinc-500"
                                          onClick={() => addEffectAction(field, ruleIndex)}
                                          disabled={busy}
                                        >
                                          액션 추가
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        ))}
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <button
                            type="button"
                            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:border-zinc-600"
                            onClick={resetBuildingDraft}
                            disabled={busy}
                          >
                            입력 초기화
                          </button>
                          <button
                            type="button"
                            className="rounded-lg border border-emerald-700/60 bg-emerald-950/30 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-900/40"
                            onClick={handleSaveBuildingPreset}
                            disabled={busy}
                          >
                            {buildingDraft.id ? "건물 프리셋 수정" : "건물 프리셋 추가"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mb-4 rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-400">
                        현재 계정은 조회 전용입니다. 프리셋 등록/삭제는 관리자만 가능합니다.
                      </div>
                    )}
                    <div className="space-y-2">
                      {activeBuildingPresets.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-zinc-800 px-3 py-4 text-sm text-zinc-500">
                          등록된 건물 프리셋이 없습니다.
                        </div>
                      ) : (
                        activeBuildingPresets.map((preset) => {
                          const color = normalizeHexColor(preset.color, "#eab308");
                          return (
                            <div
                              key={preset.id}
                              className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-semibold" style={{ color }}>
                                    {preset.name}
                                  </div>
                                  <div className="mt-0.5 text-[11px] text-zinc-500">
                                    {preset.tier ? `${preset.tier} · ` : ""}
                                    노력치 {preset.effort ?? 0} · 공간 {preset.space ?? 0}
                                    {" · "}조건 {preset.placementRules?.length ?? 0}
                                    {" · "}일일 규칙 {preset.effects?.daily?.length ?? 0}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {isAdmin ? (
                                    <button
                                      type="button"
                                      className="rounded-md border border-zinc-700 px-2 py-1 text-[11px] font-semibold text-zinc-100 hover:border-zinc-500"
                                      onClick={() => handleSelectBuildingPreset(preset.id)}
                                      disabled={busy}
                                    >
                                      편집
                                    </button>
                                  ) : null}
                                  {isAdmin ? (
                                    <button
                                      type="button"
                                      className="rounded-md border border-red-800/70 bg-red-950/40 px-2 py-1 text-[11px] font-semibold text-red-200 hover:bg-red-900/40"
                                      onClick={() => handleDeleteBuildingPreset(preset.id)}
                                      disabled={busy}
                                    >
                                      삭제
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                              {preset.description ? (
                                <div className="mt-1 text-xs text-zinc-400">{preset.description}</div>
                              ) : null}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </>
                )}
              </div>
            ) : !selectedMap ? (
              <div className="rounded-xl border border-dashed border-zinc-800 px-4 py-8 text-sm text-zinc-500">
                지도를 먼저 선택해 주세요.
              </div>
            ) : (
              <>
                <div className={settingsOpen ? "grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]" : ""}>
                  {settingsOpen ? (
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <div className="text-sm font-semibold text-zinc-100">설정</div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="rounded-md border border-zinc-700 px-2 py-1 text-[11px] font-semibold text-zinc-200 hover:border-zinc-600"
                            onClick={() => setSettingsOpen(false)}
                            disabled={busy}
                          >
                            닫기
                          </button>
                          <button
                            type="button"
                            className="rounded-md border border-red-700/60 bg-red-950/30 px-2 py-1 text-[11px] font-semibold text-red-200 hover:bg-red-900/40"
                            onClick={handleDelete}
                            disabled={busy}
                          >
                            삭제
                          </button>
                        </div>
                      </div>

                      <div className="mb-3 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          className={[
                            "rounded-lg border px-3 py-1.5 text-xs font-semibold",
                            settingsTab === "map"
                              ? "border-amber-700/70 bg-amber-950/30 text-amber-200"
                              : "border-zinc-800 bg-zinc-950/30 text-zinc-300 hover:border-zinc-700",
                          ].join(" ")}
                          onClick={() => setSettingsTab("map")}
                        >
                          지도 설정
                        </button>
                        <button
                          type="button"
                          className={[
                            "rounded-lg border px-3 py-1.5 text-xs font-semibold",
                            settingsTab === "city"
                              ? "border-emerald-700/70 bg-emerald-950/30 text-emerald-200"
                              : "border-zinc-800 bg-zinc-950/30 text-zinc-300 hover:border-zinc-700",
                          ].join(" ")}
                          onClick={() => setSettingsTab("city")}
                        >
                          도시 전역 설정
                        </button>
                      </div>

                      {settingsTab === "map" ? (
                        <div className="space-y-3">
                          <label className="block">
                            <div className="mb-1 text-[11px] font-semibold text-zinc-400">
                              지도 이름
                            </div>
                            <input
                              value={draft.name}
                              onChange={(e) =>
                                setDraft((prev) => ({ ...prev, name: e.target.value }))
                              }
                              className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-zinc-600"
                            />
                          </label>

                          <div>
                            <div className="mb-1 text-[11px] font-semibold text-zinc-400">
                              이미지 파일 / URL
                            </div>
                            <div className="flex gap-2">
                              <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                className="block w-full text-xs text-zinc-300 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-800 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-zinc-100 hover:file:bg-zinc-700"
                                onChange={(e) =>
                                  handleUploadImage(e.target.files?.[0] ?? null)
                                }
                                disabled={busy}
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <label className="block">
                              <div className="mb-1 text-[11px] font-semibold text-zinc-400">
                                Hex Size
                              </div>
                              <input
                                type="number"
                                step="0.1"
                                value={draft.hexSize}
                                onChange={(e) =>
                                  setDraft((prev) => ({ ...prev, hexSize: e.target.value }))
                                }
                                className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-amber-200 outline-none focus:border-zinc-600"
                              />
                            </label>
                            <label className="block">
                              <div className="mb-1 text-[11px] font-semibold text-zinc-400">
                                Orientation
                              </div>
                              <select
                                value={draft.orientation}
                                onChange={(e) =>
                                  setDraft((prev) => ({
                                    ...prev,
                                    orientation: e.target.value as HexOrientation,
                                  }))
                                }
                                className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-zinc-600"
                              >
                                <option value="pointy">pointy</option>
                                <option value="flat">flat</option>
                              </select>
                            </label>
                            <label className="block">
                              <div className="mb-1 text-[11px] font-semibold text-zinc-400">
                                Origin X
                              </div>
                              <input
                                value={draft.originX}
                                onChange={(e) =>
                                  setDraft((prev) => ({ ...prev, originX: e.target.value }))
                                }
                                className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-sky-200 outline-none focus:border-zinc-600"
                              />
                            </label>
                            <label className="block">
                              <div className="mb-1 text-[11px] font-semibold text-zinc-400">
                                Origin Y
                              </div>
                              <input
                                value={draft.originY}
                                onChange={(e) =>
                                  setDraft((prev) => ({ ...prev, originY: e.target.value }))
                                }
                                className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-sky-200 outline-none focus:border-zinc-600"
                              />
                            </label>
                            <label className="block">
                              <div className="mb-1 text-[11px] font-semibold text-zinc-400">
                                Columns
                              </div>
                              <input
                                value={draft.cols}
                                onChange={(e) =>
                                  setDraft((prev) => ({ ...prev, cols: e.target.value }))
                                }
                                className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-zinc-600"
                              />
                            </label>
                            <label className="block">
                              <div className="mb-1 text-[11px] font-semibold text-zinc-400">
                                Rows
                              </div>
                              <input
                                value={draft.rows}
                                onChange={(e) =>
                                  setDraft((prev) => ({ ...prev, rows: e.target.value }))
                                }
                                className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-zinc-600"
                              />
                            </label>
                          </div>

                          <button
                            type="button"
                            className="w-full rounded-lg border border-amber-700/60 bg-amber-950/30 px-3 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-900/40"
                            onClick={handleSaveDraft}
                            disabled={busy}
                          >
                            지도 설정 저장
                          </button>

                          <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-400">
                            선택 타일:
                            {selectedHex
                              ? `col ${selectedHex.col}, row ${selectedHex.row}`
                              : "없음"}
                            {selectedHex ? (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {(activeTileStates[tileKey(selectedHex.col, selectedHex.row)] ?? []).length ===
                                0 ? (
                                  <span className="text-[11px] text-zinc-500">
                                    등록된 속성이 없습니다.
                                  </span>
                                ) : (
                                    (activeTileStates[tileKey(selectedHex.col, selectedHex.row)] ?? []).map(
                                    (entry, idx) => {
                                      const preset = presetById.get(entry.presetId);
                                      if (!preset) return null;
                                      const color = normalizeHexColor(preset.color);
                                      return (
                                        <span
                                          key={`${entry.presetId}-${idx}`}
                                          className="rounded-md border border-zinc-700/70 bg-zinc-900/70 px-1.5 py-0.5"
                                          style={{ color }}
                                        >
                                          {preset.name}
                                          {preset.hasValue && entry.value != null
                                            ? `: ${entry.value}`
                                            : ""}
                                        </span>
                                      );
                                    }
                                  )
                                )}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ) : (
                        <form
                          key={`${selectedMap.id}:${selectedMap.updatedAt ?? "city"}`}
                          ref={citySettingsFormRef}
                          className="space-y-4"
                          onSubmit={(e) => {
                            e.preventDefault();
                            void handleSaveCityGlobal();
                          }}
                        >
                          <div className="space-y-2">
                            <div className="text-xs font-semibold text-zinc-300">상한 있음</div>
                            {CAPPED_RESOURCE_IDS.map((resourceId) => (
                              <label
                                key={resourceId}
                                className="grid grid-cols-[1fr_120px] items-center gap-2"
                              >
                                <span className="text-sm text-zinc-100">
                                  {RESOURCE_LABELS[resourceId]}
                                </span>
                                <input
                                  type="number"
                                  min={0}
                                  step={1}
                                  name={`cap_${resourceId}`}
                                  defaultValue={activeCityGlobal.caps[resourceId]}
                                  className="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-emerald-200 outline-none focus:border-zinc-600"
                                />
                              </label>
                            ))}
                          </div>
                          <div className="space-y-1 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
                            <div className="text-xs font-semibold text-zinc-300">상한 없음</div>
                            <div className="text-sm text-zinc-400">
                              {UNCAPPED_RESOURCE_IDS.map((id) => RESOURCE_LABELS[id]).join(", ")}
                            </div>
                          </div>
                          <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
                            <div className="text-xs font-semibold text-zinc-300">날짜 설정</div>
                            <input
                              type="number"
                              min={0}
                              step={1}
                              name="day"
                              defaultValue={activeCityGlobal.day}
                              className="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-sky-200 outline-none focus:border-zinc-600"
                            />
                          </div>
                          <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-xs font-semibold text-zinc-300">인구 설정</div>
                              <div className="text-xs font-semibold text-lime-300">
                                👥 전체 인구 {formatWithCommas(totalPopulation)} /{" "}
                                {formatWithCommas(activeCityGlobal.populationCap)}
                              </div>
                            </div>
                            <div className="space-y-2">
                              {TRACKED_POPULATION_IDS.map((id) => (
                                <div key={id} className="grid grid-cols-[1fr_110px_110px] items-center gap-2">
                                  <span className="text-sm text-zinc-100">
                                    {POPULATION_EMOJIS[id]} {POPULATION_LABELS[id]}
                                  </span>
                                  <input
                                    type="number"
                                    min={0}
                                    step={1}
                                    name={`pop_${id}_available`}
                                    defaultValue={activeCityGlobal.population[id].available ?? 0}
                                    className="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-sky-200 outline-none focus:border-zinc-600"
                                    placeholder="가용"
                                  />
                                  <input
                                    type="number"
                                    min={0}
                                    step={1}
                                    name={`pop_${id}_total`}
                                    defaultValue={activeCityGlobal.population[id].total}
                                    className="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-lime-200 outline-none focus:border-zinc-600"
                                    placeholder="총"
                                  />
                                </div>
                              ))}
                              <div className="grid grid-cols-[1fr_110px] items-center gap-2">
                                <span className="text-sm text-zinc-100">
                                  {POPULATION_EMOJIS.elderly} {POPULATION_LABELS.elderly}
                                </span>
                                <input
                                  type="number"
                                  min={0}
                                  step={1}
                                  name="pop_elderly_total"
                                  defaultValue={activeCityGlobal.population.elderly.total}
                                  className="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-zinc-600"
                                  placeholder="총"
                                />
                              </div>
                              <div className="grid grid-cols-[1fr_110px] items-center gap-2">
                                <span className="text-sm text-zinc-100">🧱 인구 상한</span>
                                <input
                                  type="number"
                                  min={0}
                                  step={1}
                                  name="population_cap"
                                  defaultValue={activeCityGlobal.populationCap}
                                  className="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-lime-200 outline-none focus:border-zinc-600"
                                  placeholder="인구 상한"
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-[1fr_110px_110px] gap-2 text-[11px] text-zinc-500">
                              <span />
                              <span className="px-1 text-center">가용</span>
                                <span className="px-1 text-center">도시 내 총 인구</span>
                              </div>
                          </div>
                          <button
                            type="submit"
                            className="w-full rounded-lg border border-emerald-700/60 bg-emerald-950/30 px-3 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-900/40"
                            disabled={busy}
                          >
                            도시 전역 설정 저장
                          </button>
                          <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
                            <div className="text-xs font-semibold text-zinc-300">일일 규칙 실행</div>
                            <div className="grid grid-cols-[120px_1fr] gap-2">
                              <input
                                type="number"
                                min={1}
                                step={1}
                                value={dailyRunDays}
                                onChange={(e) => {
                                  const raw = e.target.value.replace(/[^\d]/g, "");
                                  if (!raw) {
                                    setDailyRunDays("");
                                    return;
                                  }
                                  const n = Math.max(1, Math.trunc(Number(raw)));
                                  setDailyRunDays(String(n));
                                }}
                                className="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-amber-200 outline-none focus:border-zinc-600"
                                placeholder="일수"
                              />
                              <button
                                type="button"
                                className="h-9 rounded-lg border border-amber-700/60 bg-amber-950/30 px-3 text-sm font-semibold text-amber-200 hover:bg-amber-900/40 disabled:opacity-60"
                                disabled={busy || !selectedMap}
                                onClick={() => {
                                  void handleRunDailyRules();
                                }}
                              >
                                일일 규칙 실행
                              </button>
                            </div>
                            {dailyRunResult ? (
                              <div className="text-xs text-emerald-300">{dailyRunResult}</div>
                            ) : null}
                            {dailyRunLogs.length > 0 ? (
                              <div className="max-h-40 overflow-auto rounded-md border border-zinc-800 bg-zinc-950/50 p-2">
                                <div className="space-y-1">
                                  {dailyRunLogs.map((line, idx) => (
                                    <div key={`${idx}-${line}`} className="text-[11px] text-zinc-300">
                                      {line}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </form>
                      )}
                    </div>
                  ) : null}

                  <div className="relative rounded-xl border border-zinc-800 bg-zinc-950/30 p-4">
                    <div className="mb-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                      <div className="justify-self-start text-sm font-bold text-lime-300">
                        {selectedMap.name}{" "}
                        <span className="text-xs font-semibold text-zinc-200">
                          [Day {String(activeCityGlobal.day ?? 0).padStart(3, "0")}]
                        </span>
                      </div>
                      <div className="justify-self-center flex items-center gap-2">
                        <label className="inline-flex items-center gap-1 rounded-md border border-zinc-800 px-2 py-1 text-xs text-zinc-200 hover:border-zinc-600">
                          <input
                            type="checkbox"
                            checked={showTileStatePills}
                            onChange={(e) => setShowTileStatePills(e.target.checked)}
                          />
                          <span>타일 속성 표시</span>
                        </label>
                        <label className="inline-flex items-center gap-1 rounded-md border border-zinc-800 px-2 py-1 text-xs text-zinc-200 hover:border-zinc-600">
                          <input
                            type="checkbox"
                            checked={showRegionStatusPills}
                            onChange={(e) => setShowRegionStatusPills(e.target.checked)}
                          />
                          <span>지역 상태 표시</span>
                        </label>
                      </div>
                      <div className="justify-self-end flex items-center gap-2 text-xs text-zinc-300">
                        <button
                          type="button"
                          className={[
                            "rounded-md border px-2 py-1",
                            viewMode === "scroll"
                              ? "border-emerald-700/70 bg-emerald-950/30 text-emerald-200"
                              : "border-zinc-800 text-zinc-300 hover:border-zinc-600",
                          ].join(" ")}
                          onClick={() => {
                            setViewMode("scroll");
                            setDragging(false);
                            dragRef.current.active = false;
                          }}
                        >
                          스크롤 모드
                        </button>
                        <button
                          type="button"
                          className={[
                            "rounded-md border px-2 py-1",
                            viewMode === "drag"
                              ? "border-sky-700/70 bg-sky-950/30 text-sky-200"
                              : "border-zinc-800 text-zinc-300 hover:border-zinc-600",
                          ].join(" ")}
                          onClick={() => setViewMode("drag")}
                        >
                          드래그 모드
                        </button>
                        <button
                          type="button"
                          className="rounded-md border border-zinc-800 px-2 py-1 hover:border-zinc-600"
                          onClick={() => setZoom((prev) => Math.max(0.2, prev - 0.1))}
                        >
                          -
                        </button>
                        <span>{Math.round(zoom * 100)}%</span>
                        <button
                          type="button"
                          className="rounded-md border border-zinc-800 px-2 py-1 hover:border-zinc-600"
                          onClick={() => setZoom((prev) => Math.min(2.5, prev + 0.1))}
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div className="pointer-events-none absolute right-4 top-14 z-30">
                      <div className="pointer-events-auto flex flex-col gap-3">
                        <div className="rounded-xl border border-zinc-700/70 bg-zinc-900/55 backdrop-blur-sm">
                          <div className="flex items-center justify-between gap-2 border-b border-zinc-700/70 px-3 py-2">
                            <div className="text-xs font-semibold text-zinc-100">자원</div>
                            <button
                              type="button"
                              className="rounded-md border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-200 hover:border-zinc-500"
                              onClick={() => setResourceOverlayOpen((prev) => !prev)}
                            >
                              {resourceOverlayOpen ? "접기" : "펼치기"}
                            </button>
                          </div>
                          {resourceOverlayOpen ? (
                            <div className="space-y-1 px-3 py-2 text-[11px]">
                              {CAPPED_RESOURCE_IDS.map((id) => (
                                <div
                                  key={id}
                                  className="grid min-w-[190px] grid-cols-[1fr_auto] gap-3 text-zinc-100"
                                >
                                  <span>
                                    {RESOURCE_EMOJIS[id]} {RESOURCE_LABELS[id]}
                                  </span>
                                  <span className="font-semibold text-emerald-300">
                                    {formatWithCommas(activeCityGlobal.values[id])}
                                    <span
                                      className={[
                                        "ml-1",
                                        dailyResourceDeltaById[id] > 0
                                          ? "text-emerald-300"
                                          : dailyResourceDeltaById[id] < 0
                                            ? "text-rose-300"
                                            : "text-zinc-400",
                                      ].join(" ")}
                                    >
                                      ({formatDailyDelta(dailyResourceDeltaById[id] ?? 0)})
                                    </span>{" "}
                                    / {formatWithCommas(activeCityGlobal.caps[id])}
                                  </span>
                                </div>
                              ))}
                              <div className="my-1 border-t border-zinc-700/70" />
                              {UNCAPPED_RESOURCE_IDS.map((id) => (
                                <div
                                  key={id}
                                  className="grid min-w-[190px] grid-cols-[1fr_auto] gap-3 text-zinc-100"
                                >
                                  <span>
                                    {RESOURCE_EMOJIS[id]} {RESOURCE_LABELS[id]}
                                  </span>
                                  <span className="font-semibold text-amber-300">
                                    {formatWithCommas(activeCityGlobal.values[id])}
                                    <span
                                      className={[
                                        "ml-1",
                                        dailyResourceDeltaById[id] > 0
                                          ? "text-emerald-300"
                                          : dailyResourceDeltaById[id] < 0
                                            ? "text-rose-300"
                                            : "text-zinc-400",
                                      ].join(" ")}
                                    >
                                      ({formatDailyDelta(dailyResourceDeltaById[id] ?? 0)})
                                    </span>
                                  </span>
                                </div>
                              ))}

                              <div className="mt-2 border-t border-zinc-700/70 pt-2">
                                <button
                                  type="button"
                                  className="w-full rounded-md border border-zinc-700 px-2 py-1 text-left text-[11px] text-zinc-200 hover:border-zinc-500"
                                  onClick={() => setResourceAdjustOpen((prev) => !prev)}
                                  disabled={busy}
                                >
                                  {resourceAdjustOpen ? "자원 조정 접기" : "자원 조정 펼치기"}
                                </button>
                                {resourceAdjustOpen ? (
                                  <div className="mt-2 space-y-2">
                                    <div className="grid grid-cols-2 gap-2">
                                      <select
                                        value={resourceAdjustTarget}
                                        onChange={(e) =>
                                          setResourceAdjustTarget(e.target.value as ResourceId)
                                        }
                                        className="h-8 rounded-md border border-zinc-700 bg-zinc-950 px-2 text-[11px] text-zinc-100 outline-none focus:border-zinc-500"
                                      >
                                        {ALL_RESOURCE_IDS.map((id) => (
                                          <option key={id} value={id}>
                                            {RESOURCE_EMOJIS[id]} {RESOURCE_LABELS[id]}
                                          </option>
                                        ))}
                                      </select>
                                      <select
                                        value={resourceAdjustMode}
                                        onChange={(e) =>
                                          setResourceAdjustMode(
                                            (e.target.value as "inc" | "dec") ?? "inc"
                                          )
                                        }
                                        className="h-8 rounded-md border border-zinc-700 bg-zinc-950 px-2 text-[11px] text-zinc-100 outline-none focus:border-zinc-500"
                                      >
                                        <option value="inc">증가</option>
                                        <option value="dec">감소</option>
                                      </select>
                                    </div>
                                    <input
                                      type="number"
                                      min={0}
                                      step={1}
                                      value={resourceAdjustAmount}
                                      onChange={(e) => setResourceAdjustAmount(e.target.value)}
                                      className="h-8 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 text-[11px] text-zinc-100 outline-none focus:border-zinc-500"
                                      placeholder="수치 입력"
                                    />
                                    <button
                                      type="button"
                                      className="w-full rounded-md bg-amber-700 px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
                                      onClick={handleApplyResourceAdjust}
                                      disabled={busy}
                                    >
                                      적용
                                    </button>
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          ) : null}
                        </div>

                        <div className="rounded-xl border border-zinc-700/70 bg-zinc-900/55 backdrop-blur-sm">
                          <div className="flex items-center justify-between gap-2 border-b border-zinc-700/70 px-3 py-2">
                            <div className="text-xs font-semibold text-zinc-100">인구</div>
                            <button
                              type="button"
                              className="rounded-md border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-200 hover:border-zinc-500"
                              onClick={() => setPopulationOverlayOpen((prev) => !prev)}
                            >
                              {populationOverlayOpen ? "접기" : "펼치기"}
                            </button>
                          </div>
                          {populationOverlayOpen ? (
                            <div className="space-y-1 px-3 py-2 text-[11px]">
                              <div className="grid min-w-[190px] grid-cols-[1fr_auto] gap-3 text-zinc-100">
                                <span>👥 전체 인구</span>
                                <span className="font-semibold text-lime-300">
                                  {formatWithCommas(totalPopulation)}
                                </span>
                              </div>
                              <div className="grid min-w-[190px] grid-cols-[1fr_auto] gap-3 text-zinc-100">
                                <span>🧱 인구 상한</span>
                                <span className="font-semibold text-lime-300">
                                  {formatWithCommas(activeCityGlobal.populationCap)}
                                </span>
                              </div>
                              <div className="my-1 border-t border-zinc-700/70" />
                              {TRACKED_POPULATION_IDS.map((id) => (
                                <div
                                  key={id}
                                  className="grid min-w-[190px] grid-cols-[1fr_auto] gap-3 text-zinc-100"
                                >
                                  <span>
                                    {POPULATION_EMOJIS[id]} {POPULATION_LABELS[id]}
                                  </span>
                                  <span className="font-semibold text-sky-300">
                                    {formatWithCommas(activeCityGlobal.population[id].available ?? 0)} /{" "}
                                    {formatWithCommas(activeCityGlobal.population[id].total)}
                                  </span>
                                </div>
                              ))}
                              <div className="grid min-w-[190px] grid-cols-[1fr_auto] gap-3 text-zinc-100">
                                <span>
                                  {POPULATION_EMOJIS.elderly} {POPULATION_LABELS.elderly}
                                </span>
                                <span className="font-semibold text-zinc-200">
                                  {formatWithCommas(activeCityGlobal.population.elderly.total)}
                                </span>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {!imageUrl ? (
                      <div className="rounded-lg border border-dashed border-zinc-800 px-4 py-10 text-sm text-zinc-500">
                        지도가 없습니다. 먼저 이미지를 등록해 주세요.
                      </div>
                    ) : (
                      <div
                        ref={viewportRef}
                        className={[
                          "relative max-h-[78vh] rounded-lg border border-zinc-800 bg-[#08090c] p-2",
                          viewMode === "drag" ? "overflow-hidden" : "overflow-auto",
                          viewMode === "drag" ? "select-none" : "",
                        ].join(" ")}
                        style={{
                          cursor: viewMode === "drag" ? (dragging ? "grabbing" : "grab") : "default",
                          touchAction: viewMode === "drag" ? "none" : "auto",
                          overscrollBehavior: viewMode === "drag" ? "none" : "auto",
                        }}
                        onMouseDown={handleViewportMouseDown}
                        onMouseMove={handleViewportMouseMove}
                        onMouseUp={endDragging}
                        onMouseLeave={endDragging}
                        onWheelCapture={handleViewportWheel}
                        onWheel={handleViewportWheel}
                        onScroll={viewMode === "scroll" ? scheduleVisibleBoundsUpdate : undefined}
                      >
                        <div
                          className="relative origin-top-left"
                          style={{
                            width: imageWidth ? `${imageWidth * zoom}px` : "100%",
                            height: imageHeight ? `${imageHeight * zoom}px` : "auto",
                          }}
                        >
                          <img
                            src={imageUrl}
                            alt={selectedMap.name}
                            className="block h-full w-full object-contain"
                            onLoad={(e) => {
                              const img = e.currentTarget;
                              setLoadedSize({
                                width: img.naturalWidth,
                                height: img.naturalHeight,
                              });
                              void syncLoadedImageMeta(
                                img.naturalWidth,
                                img.naturalHeight
                              );
                            }}
                          />
                          {imageWidth > 0 && imageHeight > 0 ? (
                            <svg
                              className="absolute inset-0 h-full w-full"
                              viewBox={`0 0 ${imageWidth} ${imageHeight}`}
                              preserveAspectRatio="none"
                            >
                              {polygons.map((poly) => {
                                const active =
                                  selectedHex?.col === poly.col &&
                                  selectedHex?.row === poly.row;
                                const pillCullMargin = Math.max(selectedMap.hexSize * 1.4, 90);
                                const isPillInViewport =
                                  !visibleImageBounds ||
                                  (poly.cx >= visibleImageBounds.left - pillCullMargin &&
                                    poly.cx <= visibleImageBounds.right + pillCullMargin &&
                                    poly.cy >= visibleImageBounds.top - pillCullMargin &&
                                    poly.cy <= visibleImageBounds.bottom + pillCullMargin);
                                const stateBadges: Array<{ text: string; color: string }> =
                                  showTileStatePills && isPillInViewport
                                    ? (tileStateBadgesByKey[poly.tileKey] ?? EMPTY_STATE_BADGES)
                                    : EMPTY_STATE_BADGES;
                                return (
                                  <g key={poly.key}>
                                    <polygon
                                      points={poly.points}
                                      fill={
                                        active
                                          ? "rgba(245, 158, 11, 0.18)"
                                          : "rgba(0,0,0,0)"
                                      }
                                      stroke={
                                        active ? "rgba(251,191,36,0.92)" : "rgba(56,189,248,0.48)"
                                      }
                                      strokeWidth={active ? 2.2 : 1}
                                      style={{
                                        cursor:
                                          viewMode === "drag"
                                            ? dragging
                                              ? "grabbing"
                                              : "grab"
                                            : "pointer",
                                      }}
                                      onClick={() => {
                                        if (suppressClickRef.current) return;
                                        setTileContextMenu(null);
                                        setSelectedHexIfChanged(poly.col, poly.row);
                                      }}
                                      onContextMenu={(e) => {
                                        if (suppressClickRef.current) return;
                                        e.preventDefault();
                                        setSelectedHexIfChanged(poly.col, poly.row);
                                        setTileContextMenu({
                                          x: e.clientX,
                                          y: e.clientY,
                                          col: poly.col,
                                          row: poly.row,
                                        });
                                      }}
                                    />
                                    {showRegionStatusPills && isPillInViewport ? (
                                      <g pointerEvents="none">
                                        {(() => {
                                          const hexSize = selectedMap.hexSize;
                                          const pillH = 16;
                                          const statW = Math.max(42, Math.round(hexSize * 0.4));
                                          const regionState = activeTileRegionStates[poly.tileKey];
                                          const hasSpace =
                                            regionState?.spaceUsed != null ||
                                            regionState?.spaceCap != null;
                                          const hasSatisfaction =
                                            regionState?.satisfaction != null;
                                          const hasThreat = regionState?.threat != null;
                                          const hasPollution = regionState?.pollution != null;
                                          const cornerCenters = {
                                            tl: {
                                              x: poly.cx - hexSize * 0.36,
                                              y: poly.cy - hexSize * 0.58,
                                            },
                                            tr: {
                                              x: poly.cx + hexSize * 0.36,
                                              y: poly.cy - hexSize * 0.58,
                                            },
                                            bl: {
                                              x: poly.cx - hexSize * 0.36,
                                              y: poly.cy + hexSize * 0.56,
                                            },
                                            br: {
                                              x: poly.cx + hexSize * 0.36,
                                              y: poly.cy + hexSize * 0.56,
                                            },
                                          } as const;
                                          const metricPills: Array<{
                                            key: string;
                                            text: string;
                                            color: string;
                                            w: number;
                                            center: keyof typeof cornerCenters;
                                          }> = [];
                                          if (hasSpace) {
                                            metricPills.push({
                                              key: "space",
                                              text: `${regionState?.spaceUsed ?? 0} / ${regionState?.spaceCap ?? 0}`,
                                              color: "#38bdf8",
                                              w: statW,
                                              center: "tl",
                                            });
                                          }
                                          if (hasSatisfaction) {
                                            metricPills.push({
                                              key: "satisfaction",
                                              text: `🙂 ${regionState?.satisfaction ?? 0}`,
                                              color: "#f8fafc",
                                              w: statW,
                                              center: "tr",
                                            });
                                          }
                                          if (hasThreat) {
                                            metricPills.push({
                                              key: "threat",
                                              text: `⚠️ ${regionState?.threat ?? 0}`,
                                              color: "#ef4444",
                                              w: statW,
                                              center: "bl",
                                            });
                                          }
                                          if (hasPollution) {
                                            metricPills.push({
                                              key: "pollution",
                                              text: `☣️ ${regionState?.pollution ?? 0}`,
                                              color: "#c084fc",
                                              w: statW,
                                              center: "br",
                                            });
                                          }
                                          return metricPills.map((pill) => {
                                            const c = cornerCenters[pill.center];
                                            const x = c.x - pill.w / 2;
                                            const y = c.y - pillH / 2;
                                            return (
                                              <g key={`metric-${pill.key}`}>
                                                <rect
                                                  x={x}
                                                  y={y}
                                                  width={pill.w}
                                                  height={pillH}
                                                  rx={7}
                                                  fill="rgba(0,0,0,0.58)"
                                                  stroke={pill.color}
                                                  strokeWidth={0.8}
                                                />
                                                <text
                                                  x={c.x}
                                                  y={c.y}
                                                  fill={pill.color}
                                                  textAnchor="middle"
                                                  dominantBaseline="middle"
                                                  style={{
                                                    fontSize: "10px",
                                                    fontWeight: 700,
                                                    paintOrder: "stroke",
                                                    stroke: "rgba(0,0,0,0.65)",
                                                    strokeWidth: 0.8,
                                                  }}
                                                >
                                                  {pill.text}
                                                </text>
                                              </g>
                                            );
                                          });
                                        })()}
                                      </g>
                                    ) : null}
                                    {showTileStatePills && isPillInViewport && stateBadges.length > 0 ? (
                                      <g pointerEvents="none">
                                        {(() => {
                                          const fontSize = 11;
                                          const pillHeight = 18;
                                          const pillRadius = 8;
                                          const colGap = 4;
                                          const rowGap = 4;
                                          const maxPerRow = 3;
                                          const measured = stateBadges.map((badge) => ({
                                            ...badge,
                                            width: Math.max(
                                              53,
                                              Math.min(
                                                238,
                                                Math.round(badge.text.length * 7.75 + 18)
                                              )
                                            ),
                                          }));
                                          const rows: typeof measured[] = [];
                                          for (let i = 0; i < measured.length; i += maxPerRow) {
                                            rows.push(measured.slice(i, i + maxPerRow));
                                          }
                                          const totalHeight =
                                            rows.length * pillHeight +
                                            Math.max(0, rows.length - 1) * rowGap;
                                          const top = poly.cy - totalHeight / 2;

                                          return rows.map((rowBadges, rowIdx) => {
                                            const rowWidth =
                                              rowBadges.reduce((sum, b) => sum + b.width, 0) +
                                              Math.max(0, rowBadges.length - 1) * colGap;
                                            let left = poly.cx - rowWidth / 2;
                                            const y = top + rowIdx * (pillHeight + rowGap);

                                            return rowBadges.map((badge, colIdx) => {
                                              const x = left;
                                              left += badge.width + colGap;
                                              return (
                                                <g
                                                  key={`badge-${rowIdx}-${colIdx}`}
                                                >
                                                  <rect
                                                    x={x}
                                                    y={y}
                                                    width={badge.width}
                                                    height={pillHeight}
                                                    rx={pillRadius}
                                                    fill="rgba(0,0,0,0.55)"
                                                    stroke="rgba(255,255,255,0.12)"
                                                    strokeWidth={0.7}
                                                  />
                                                  <text
                                                    x={x + badge.width / 2}
                                                    y={y + pillHeight / 2}
                                                    fill={badge.color}
                                                    textAnchor="middle"
                                                    dominantBaseline="middle"
                                                    style={{
                                                      fontSize: `${fontSize}px`,
                                                      fontWeight: 700,
                                                      paintOrder: "stroke",
                                                      stroke: "rgba(0,0,0,0.6)",
                                                      strokeWidth: 0.8,
                                                    }}
                                                  >
                                                    {badge.text}
                                                  </text>
                                                </g>
                                              );
                                            });
                                          });
                                        })()}
                                      </g>
                                    ) : null}
                                  </g>
                                );
                              })}
                            </svg>
                          ) : null}
                        </div>
                      </div>
                    )}
                  </div>

                  {tileContextMenu ? (
                    <div
                      ref={tileContextMenuRef}
                      className="fixed z-[70] min-w-[180px] rounded-lg border border-zinc-700 bg-zinc-900/95 p-1 text-xs shadow-2xl"
                      style={{ left: tileContextMenu.x + 8, top: tileContextMenu.y + 8 }}
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="w-full rounded-md px-2 py-1.5 text-left text-zinc-100 hover:bg-zinc-800"
                        onClick={() =>
                          handleOpenTileEditor(tileContextMenu.col, tileContextMenu.row)
                        }
                      >
                        타일 속성
                      </button>
                      <button
                        type="button"
                        className="mt-1 w-full rounded-md px-2 py-1.5 text-left text-zinc-100 hover:bg-zinc-800"
                        onClick={() =>
                          handleOpenTileRegionEditor(tileContextMenu.col, tileContextMenu.row)
                        }
                      >
                        지역 상태
                      </button>
                      <button
                        type="button"
                        className="mt-1 w-full rounded-md px-2 py-1.5 text-left text-zinc-100 hover:bg-zinc-800"
                        onClick={() =>
                          handleOpenTileBuildingEditor(tileContextMenu.col, tileContextMenu.row)
                        }
                      >
                        건물 배치
                      </button>
                    </div>
                  ) : null}

                  {tileBuildingEditor ? (
                    <div className="fixed inset-0 z-[80] bg-black/55 p-4">
                      <div className="mx-auto mt-16 w-full max-w-3xl rounded-2xl border border-zinc-700 bg-zinc-950 p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <div className="text-sm font-semibold text-zinc-100">
                            건물 배치 · col {tileBuildingEditor.col}, row {tileBuildingEditor.row}
                          </div>
                          <button
                            type="button"
                            className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:border-zinc-500"
                            onClick={() => {
                              setTileBuildingEditor(null);
                              setTileBuildingSearchQuery("");
                              tileBuildingWorkersDraftByIdRef.current = {};
                            }}
                          >
                            닫기
                          </button>
                        </div>

                        <div className="mb-3 rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
                          <div className="mb-2 text-xs font-semibold text-zinc-300">건물 프리셋 선택</div>
                          <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
                            <input
                              ref={tileBuildingSearchInputRef}
                              defaultValue={tileBuildingSearchQuery}
                              onChange={(e) => {
                                const next = e.target.value;
                                if (tileBuildingSearchTimerRef.current != null) {
                                  window.clearTimeout(tileBuildingSearchTimerRef.current);
                                }
                                tileBuildingSearchTimerRef.current = window.setTimeout(() => {
                                  setTileBuildingSearchQuery(next);
                                }, 140);
                              }}
                              placeholder="건물 이름 검색"
                              className="h-9 rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                            />
                            <button
                              type="button"
                              className="rounded-md bg-amber-700 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
                              onClick={handlePlaceBuildingOnTile}
                              disabled={busy || !tileBuildingEditor.presetId}
                            >
                              건물 배치
                            </button>
                          </div>
                          {selectedTileBuildingPresetNeedsWorkers ? (
                            <div className="mt-2 grid gap-2 md:grid-cols-4">
                              {TRACKED_POPULATION_IDS.map((id) => (
                                <div key={`new-assigned-${id}`} className="space-y-1">
                                  <div className="text-[11px] text-zinc-400">
                                    {POPULATION_EMOJIS[id]} {POPULATION_LABELS[id]}
                                  </div>
                                  <input
                                    defaultValue={tileBuildingCreateWorkersDraftRef.current[id]}
                                    onChange={(e) => {
                                      const digits = e.target.value.replace(/[^\d]/g, "");
                                      tileBuildingCreateWorkersDraftRef.current = {
                                        ...tileBuildingCreateWorkersDraftRef.current,
                                        [id]: digits,
                                      };
                                    }}
                                    placeholder="0"
                                    className="h-8 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-amber-200 outline-none focus:border-amber-500"
                                  />
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="mt-2 text-[11px] text-zinc-500">
                              즉시 완공 건물은 인원 배치가 필요하지 않습니다.
                            </div>
                          )}
                          <div className="mt-2 max-h-48 overflow-auto rounded-md border border-zinc-800 bg-zinc-950/40">
                            {filteredBuildingPresetsForTile.length === 0 ? (
                              <div className="px-3 py-2 text-xs text-zinc-500">
                                검색 결과가 없습니다.
                              </div>
                            ) : (
                              filteredBuildingPresetsForTile.map((preset) => {
                                const active = tileBuildingEditor.presetId === preset.id;
                                return (
                                  <button
                                    key={preset.id}
                                    type="button"
                                    className={[
                                      "flex w-full items-center justify-between px-3 py-2 text-left text-xs",
                                      active
                                        ? "bg-amber-900/30 text-amber-200"
                                        : "text-zinc-200 hover:bg-zinc-800/60",
                                    ].join(" ")}
                                    onClick={() =>
                                      setTileBuildingEditor((prev) =>
                                        prev ? { ...prev, presetId: preset.id } : prev
                                      )
                                    }
                                  >
                                    <span className="font-semibold" style={{ color: normalizeHexColor(preset.color, "#e5e7eb") }}>
                                      {preset.name}
                                    </span>
                                    {preset.tier ? (
                                      <span className="text-[11px] text-zinc-500">{preset.tier}</span>
                                    ) : null}
                                  </button>
                                );
                              })
                            )}
                          </div>
                        </div>

                        <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
                          <div className="mb-2 text-xs font-semibold text-zinc-300">배치된 건물</div>
                          {tileBuildingInstances.length === 0 ? (
                            <div className="text-xs text-zinc-500">배치된 건물이 없습니다.</div>
                          ) : (
                            <div className="space-y-2">
                              {tileBuildingInstances.map((instance) => {
                                const preset = activeBuildingPresets.find(
                                  (entry) => entry.id === instance.presetId
                                );
                                const buildStatus = getInstanceBuildStatus(instance, preset);
                                const isActive = buildStatus === "active";
                                return (
                                  <div
                                    key={instance.id}
                                    className="grid items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950/50 px-3 py-2 md:grid-cols-[minmax(0,1fr)_auto_auto]"
                                  >
                                    <div className="min-w-0">
                                      <div
                                        className="truncate text-sm font-semibold"
                                        style={{ color: normalizeHexColor(preset?.color, "#e5e7eb") }}
                                      >
                                        {preset?.name ?? "이름 없는 건물"}
                                      </div>
                                      <div className="text-[11px] text-zinc-500">
                                        {(() => {
                                          const effort = Math.max(0, Math.trunc(Number(preset?.effort ?? 0)));
                                          if (effort <= 0) return "진행도: 즉시 완공";
                                          return `진행도: ${instance.progressEffort}/${effort}`;
                                        })()}
                                      </div>
                                      <div className="mt-1 text-[11px] text-zinc-500">
                                        투입{" "}
                                        {(() => {
                                          const byType = readAssignedWorkersByTypeFromInstanceMeta(instance.meta);
                                          return TRACKED_POPULATION_IDS.map(
                                            (id) =>
                                              `${POPULATION_EMOJIS[id]}${POPULATION_LABELS[id]} ${byType[id]}`
                                          ).join(" · ");
                                        })()}
                                      </div>
                                    </div>
                                    <span
                                      className={[
                                        "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                                        instance.enabled === false
                                          ? "bg-zinc-800 text-zinc-400"
                                          : isActive
                                            ? "bg-emerald-900/40 text-emerald-300"
                                            : "bg-amber-900/40 text-amber-300",
                                      ].join(" ")}
                                    >
                                      {instance.enabled === false
                                        ? "비활성"
                                        : isActive
                                          ? "완공"
                                          : "건설중"}
                                    </span>
                                    <div className="flex items-center gap-1">
                                      {!isActive ? (
                                        <>
                                          <div className="grid grid-cols-4 gap-1">
                                            {TRACKED_POPULATION_IDS.map((id) => {
                                              const fallback = readAssignedWorkersByTypeFromInstanceMeta(
                                                instance.meta
                                              );
                                              const currentDraft =
                                                tileBuildingWorkersDraftByIdRef.current[instance.id] ??
                                                ({
                                                  settlers: String(fallback.settlers),
                                                  engineers: String(fallback.engineers),
                                                  scholars: String(fallback.scholars),
                                                  laborers: String(fallback.laborers),
                                                } satisfies WorkerAssignmentDraft);
                                              tileBuildingWorkersDraftByIdRef.current[instance.id] =
                                                currentDraft;
                                              return (
                                                <input
                                                  key={`${instance.id}-${id}`}
                                                  defaultValue={currentDraft[id]}
                                                  onChange={(e) => {
                                                    const digits = e.target.value.replace(/[^\d]/g, "");
                                                    const prevDraft =
                                                      tileBuildingWorkersDraftByIdRef.current[
                                                        instance.id
                                                      ] ?? { ...EMPTY_WORKER_ASSIGNMENT_DRAFT };
                                                    tileBuildingWorkersDraftByIdRef.current = {
                                                      ...tileBuildingWorkersDraftByIdRef.current,
                                                      [instance.id]: {
                                                        ...prevDraft,
                                                        [id]: digits,
                                                      },
                                                    };
                                                  }}
                                                  title={`${POPULATION_LABELS[id]}`}
                                                  placeholder="0"
                                                  className="h-7 w-14 rounded-md border border-zinc-700 bg-zinc-950 px-1.5 text-center text-xs text-amber-200 outline-none focus:border-amber-500"
                                                />
                                              );
                                            })}
                                          </div>
                                          <button
                                            type="button"
                                            className="rounded-md border border-amber-700/70 bg-amber-950/30 px-2 py-1 text-[11px] text-amber-200 hover:bg-amber-900/50 disabled:opacity-50"
                                            onClick={() =>
                                              handleUpdateBuildingWorkers(
                                                instance,
                                                TRACKED_POPULATION_IDS.reduce(
                                                  (acc, id) => ({
                                                    ...acc,
                                                    [id]: Number(
                                                      tileBuildingWorkersDraftByIdRef.current[instance.id]?.[id] ??
                                                        String(
                                                          readAssignedWorkersByTypeFromInstanceMeta(
                                                            instance.meta
                                                          )[id]
                                                        )
                                                    ),
                                                  }),
                                                  {} as Partial<Record<PopulationTrackedId, number>>
                                                )
                                              )
                                            }
                                            disabled={busy}
                                          >
                                            인원 저장
                                          </button>
                                        </>
                                      ) : (
                                        <div className="text-[11px] text-zinc-500">완공 상태(투입 인원 없음)</div>
                                      )}
                                      <button
                                        type="button"
                                        className="rounded-md border border-red-800/70 bg-red-950/40 px-2 py-1 text-[11px] text-red-200 hover:bg-red-900/50 disabled:opacity-50"
                                        onClick={() => handleDeleteBuildingOnTile(instance.id)}
                                        disabled={busy}
                                      >
                                        제거
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {tileEditor ? (
                    <div className="fixed inset-0 z-[80] bg-black/55 p-4">
                      <div className="mx-auto mt-16 w-full max-w-2xl rounded-2xl border border-zinc-700 bg-zinc-950 p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <div className="text-sm font-semibold text-zinc-100">
                            타일 속성 편집 · col {tileEditor.col}, row {tileEditor.row}
                          </div>
                          <button
                            type="button"
                            className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:border-zinc-500"
                            onClick={() => setTileEditor(null)}
                          >
                            닫기
                          </button>
                        </div>

                        <div className="mb-3 space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
                          <div className="text-xs font-semibold text-zinc-300">현재 속성</div>
                          {tileEditor.draft.length === 0 ? (
                            <div className="text-xs text-zinc-500">설정된 속성이 없습니다.</div>
                          ) : (
                            tileEditor.draft.map((entry, idx) => {
                              const preset = presetById.get(entry.presetId);
                              if (!preset) return null;
                              const color = normalizeHexColor(preset.color);
                              return (
                                <div
                                  key={`${entry.presetId}-${idx}`}
                                  className="grid items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/40 px-2 py-2 md:grid-cols-[1fr_180px_auto]"
                                >
                                  <div className="min-w-0">
                                    <span className="text-sm font-semibold" style={{ color }}>
                                      {preset.name}
                                    </span>
                                  </div>
                                  {preset.hasValue ? (
                                    <input
                                      value={entry.value ?? ""}
                                      onChange={(e) =>
                                        setTileEditor((prev) =>
                                          prev
                                            ? {
                                                ...prev,
                                                draft: prev.draft.map((draftEntry, draftIdx) =>
                                                  draftIdx === idx
                                                    ? { ...draftEntry, value: e.target.value }
                                                    : draftEntry
                                                ),
                                              }
                                            : prev
                                        )
                                      }
                                      className="h-8 rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100 outline-none focus:border-zinc-500"
                                      placeholder="값 입력"
                                    />
                                  ) : (
                                    <div className="text-xs text-zinc-500">값 없음</div>
                                  )}
                                  <button
                                    type="button"
                                    className="rounded-md border border-red-800/70 bg-red-950/30 px-2 py-1 text-xs text-red-200 hover:bg-red-900/40"
                                    onClick={() =>
                                      setTileEditor((prev) =>
                                        prev
                                          ? {
                                              ...prev,
                                              draft: prev.draft.filter((_, draftIdx) => draftIdx !== idx),
                                            }
                                          : prev
                                      )
                                    }
                                  >
                                     제거
                                  </button>
                                </div>
                              );
                            })
                          )}
                        </div>

                        <div className="mb-4 space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
                          <div className="text-xs font-semibold text-zinc-300">속성 추가</div>
                          {activeTilePresets.length === 0 ? (
                            <div className="text-xs text-zinc-500">추가 가능한 속성이 없습니다.</div>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {activeTilePresets.map((preset) => {
                                const color = normalizeHexColor(preset.color);
                                const exists = tileEditor.draft.some(
                                  (entry) => entry.presetId === preset.id
                                );
                                return (
                                  <button
                                    key={preset.id}
                                    type="button"
                                    disabled={exists}
                                    className={[
                                      "rounded-md border px-2 py-1 text-xs font-semibold",
                                      exists
                                        ? "cursor-not-allowed border-zinc-800 bg-zinc-900 text-zinc-500"
                                        : "border-zinc-700 bg-zinc-950 text-zinc-100 hover:border-zinc-500",
                                    ].join(" ")}
                                    style={!exists ? { color } : undefined}
                                    onClick={() =>
                                      setTileEditor((prev) =>
                                        prev
                                          ? {
                                              ...prev,
                                              draft: [
                                                ...prev.draft,
                                                preset.hasValue
                                                  ? { presetId: preset.id, value: "" }
                                                  : { presetId: preset.id },
                                              ],
                                            }
                                          : prev
                                      )
                                    }
                                  >
                                    {preset.name}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            className="rounded-md bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600"
                            onClick={handleTileEditorSave}
                          >
                            저장
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {tileRegionEditor ? (
                    <div className="fixed inset-0 z-[82] bg-black/55 p-4">
                      <div className="mx-auto mt-20 w-full max-w-lg rounded-2xl border border-zinc-700 bg-zinc-950 p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <div className="text-sm font-semibold text-zinc-100">
                            지역 상태 편집 · col {tileRegionEditor.col}, row {tileRegionEditor.row}
                          </div>
                          <button
                            type="button"
                            className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:border-zinc-500"
                            onClick={() => {
                              setTileRegionEditor(null);
                              tileRegionDraftRef.current = null;
                            }}
                          >
                            닫기
                          </button>
                        </div>

                        <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
                          {(
                            [
                              { field: "spaceUsed", label: "💠 사용 공간", color: "#38bdf8" },
                              { field: "spaceCap", label: "🧊 최대 공간", color: "#38bdf8" },
                              { field: "satisfaction", label: "🙂 만족치", color: "#f8fafc" },
                              { field: "threat", label: "⚠️ 위협도", color: "#ef4444" },
                              { field: "pollution", label: "☣️ 오염도", color: "#c084fc" },
                            ] as const
                          ).map(({ field, label, color }) => (
                            <label key={field} className="grid grid-cols-[92px_1fr] items-center gap-2">
                              <span className="text-xs font-semibold" style={{ color }}>
                                {label}
                              </span>
                              <input
                                type="number"
                                step={1}
                                defaultValue={tileRegionEditor.draft[field]}
                                onChange={(e) =>
                                  tileRegionDraftRef.current
                                    ? (tileRegionDraftRef.current = {
                                        ...tileRegionDraftRef.current,
                                        [field]: e.target.value,
                                      })
                                    : undefined
                                }
                                className="h-8 rounded-md border bg-zinc-950 px-2 text-xs text-zinc-100 outline-none"
                                style={{ borderColor: `${color}aa`, color, caretColor: color }}
                                placeholder="미설정"
                              />
                            </label>
                          ))}
                        </div>

                        <div className="mt-3 flex justify-end gap-2">
                          <button
                            type="button"
                            className="rounded-md bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
                            onClick={handleTileRegionEditorSave}
                            disabled={busy}
                          >
                            저장
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}



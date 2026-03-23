// src/types.ts
export type NumPatch = number | { delta: number };

export interface HpPatch {
  cur?: NumPatch;
  max?: number;
  temp?: NumPatch | null;
}

export interface UnitPatch {
  name?: string;
  side?: Side;
  alias?: string | null;
  unitType?: UnitKind;
  masterUnitId?: string | null;
  ac?: NumPatch | null;
  integrity?: NumPatch | null;
  hp?: HpPatch | null;

  tags?: TagsPatch;
  tagStates?: Record<string, TurnTagPatch | null>;
  spellSlots?: Record<string, number | null>;
  consumables?: Record<string, number | null>;

  note?: string | null;
  colorCode?: number | null;
  hidden?: boolean | null;
  turnDisabled?: boolean | null;
  bench?: "TEAM" | "ENEMY" | null;
}

export type TurnEntry =
  | { kind: "unit"; unitId: string }
  | { kind: "label"; text: string }
  | { kind: "marker"; markerId: string }
  | { kind: "group"; groupId: string };

export type TurnGroup = {
  id: string;
  name: string;
  unitIds: string[];
};

export type TurnEndSnapshot = {
  spellSlots?: string;
  consumables?: string;
  toggleTags?: string;
  manualStacks?: string;
};

export type Side = "TEAM" | "ENEMY" | "NEUTRAL";
export type UnitKind = "NORMAL" | "SERVANT" | "BUILDING";

export type Pos = { x: number; z: number };

export type Unit = {
  id: string;
  side: Side;
  name: string;

  // ✅ backend supports
  alias?: string;
  note?: string;
  colorCode?: number;
  hidden?: boolean;
  turnDisabled?: boolean;
  bench?: "TEAM" | "ENEMY";
  unitType?: UnitKind;
  masterUnitId?: string;

  pos?: Pos;
  hp?: { cur: number; max: number; temp?: number };
  deathSaves?: { success: number; failure: number };
  acBase?: number;
  integrityBase?: number;

  tags?: string[];
  mods?: { key: string; stacks: number }[];
  tagStates?: Record<string, TurnTagState>;
  spellSlots?: Record<string, number>;
  consumables?: Record<string, number>;
};

export interface TurnTagState {
  stacks: number;
  decOnTurnStart?: boolean;
  decOnTurnEnd?: boolean;
}

export interface TagsPatch {
  set?: string[];
  add?: string[];
  remove?: string[];
  toggle?: string[];
}

export type TagStacksPatch = number | { delta: number } | null;

export interface TurnTagPatch {
  stacks?: TagStacksPatch;
  decOnTurnStart?: boolean;
  decOnTurnEnd?: boolean;
}

export type Marker = {
  id: string;
  kind: "MARKER";
  name: string;
  alias?: string;
  pos: Pos;
  // Optional multi-cell footprint on the board.
  cells?: Pos[];
  // Optional duration; decremented when marker entry is passed.
  duration?: number;
};

export type EncounterState = {
  id: string;
  updatedAt?: string;

  units: Unit[];
  markers?: Marker[];
  blockedCells?: Pos[];
  gridLabels?: {
    x?: Record<string, string>;
    z?: Record<string, string>;
  };
  sideNotes?: Partial<Record<Side, string>>;

  turnOrder?: TurnEntry[];
  turnGroups?: TurnGroup[];
  turnPriorities?: Record<string, number>;
  turnIndex?: number;
  turnEndSnapshots?: Record<string, TurnEndSnapshot>;
  turnStartSnapshots?: Record<string, TurnEndSnapshot>;
  battleStarted?: boolean;
  identifierCounters?: Record<string, number>;

  // optional (backend has these)
  round?: number;
  tempTurnStack?: string[];
  logs?: any[];
};

export type EncounterSummary = {
  id: string;
  name: string;
  updatedAt?: string;
};

export type AuthUser = {
  id: string;
  username: string;
  isAdmin?: boolean;
};

export type GoldCharacter = {
  name: string;
  gold: number;
  dailyExpense: number;
  day?: number | null;
  isNpc: boolean;
  friend?: string | null;
};

export type InventoryItem = {
  itemName: string;
  amount: number;
  owner?: string;
};

export type ItemCatalogEntry = {
  name: string;
  quality: number;
  unit: string;
  type: string;
};

export type HexOrientation = "pointy" | "flat";

export type CappedResourceId = "wood" | "stone" | "fabric" | "weave" | "food";
export type ResourceId = CappedResourceId | "research" | "order" | "gold";

export type PopulationTrackedId =
  | "settlers"
  | "engineers"
  | "scholars"
  | "laborers";
export type PopulationId = PopulationTrackedId | "elderly";
export type UpkeepPopulationId = PopulationId | "anyNonElderly";

export type PopulationEntry = {
  total: number;
  available?: number;
};

export type CityPopulationState = Record<PopulationId, PopulationEntry>;

export type CityGlobalState = {
  values: Record<ResourceId, number>;
  caps: Record<CappedResourceId, number>;
  day: number;
  populationCap: number;
  population: CityPopulationState;
};

export type MapTileStatePreset = {
  id: string;
  name: string;
  color: string;
  hasValue: boolean;
};

export type MapTileStateAssignment = {
  presetId: string;
  value?: string;
};

export type MapTileRegionState = {
  spaceUsed?: number;
  spaceCap?: number;
  satisfaction?: number;
  threat?: number;
  pollution?: number;
};

export type BuildingPresetLine = {
  id: string;
  text: string;
};

export type BuildingPreset = {
  id: string;
  name: string;
  color: string;
  tier?: string;
  effort?: number;
  space?: number;
  description?: string;
  buildCosts?: BuildingPresetLine[];
  researchCosts?: BuildingPresetLine[];
  upkeep?: BuildingPresetLine[];
  dailyEffects?: BuildingPresetLine[];
  requirements?: BuildingPresetLine[];
  notes?: BuildingPresetLine[];
};

export type BuildingRuleArithmeticOp =
  | "add"
  | "sub"
  | "mul"
  | "div"
  | "min"
  | "max";

export type BuildingRuleComparisonOp =
  | "eq"
  | "ne"
  | "gt"
  | "gte"
  | "lt"
  | "lte";

export type BuildingRuleLogicOp = "and" | "or";
export type BuildingRuleScope = "self" | "adjacent";
export type BuildingRuleActionTargetScope = "self" | "range";

export type BuildingRuleExpr =
  | { kind: "const"; value: number }
  | { kind: "resource"; resourceId: ResourceId }
  | { kind: "population"; populationId: PopulationId; field: "total" | "available" }
  | {
      kind: "tileMetric";
      metric: "adjacentTagCount" | "adjacentBuildingCount" | "tileStateValue";
      key: string;
    }
  | { kind: "binary"; op: BuildingRuleArithmeticOp; left: BuildingRuleExpr; right: BuildingRuleExpr }
  | { kind: "clamp"; value: BuildingRuleExpr; min?: number; max?: number }
  | { kind: "randPct"; pct: number };

export type BuildingRulePredicate =
  | { kind: "compare"; op: BuildingRuleComparisonOp; left: BuildingRuleExpr; right: BuildingRuleExpr }
  | {
      kind: "tileRegionCompare";
      field: "spaceRemaining" | "pollution" | "threat" | "satisfaction";
      op: BuildingRuleComparisonOp;
      value: number;
    }
  | { kind: "hasTag"; tagId: string; scope: BuildingRuleScope }
  | { kind: "hasBuilding"; presetId: string; scope: BuildingRuleScope }
  | { kind: "logic"; op: BuildingRuleLogicOp; rules: BuildingRulePredicate[] }
  | BuildingPlacementRule;

export type BuildingRuleAction =
  | {
      kind: "adjustResource";
      resourceId: ResourceId;
      delta: BuildingRuleExpr;
      target?: BuildingRuleActionTargetScope;
      distance?: number;
    }
  | {
      kind: "adjustResourceCap";
      resourceId: "wood" | "stone" | "fabric" | "weave" | "food";
      delta: BuildingRuleExpr;
      target?: BuildingRuleActionTargetScope;
      distance?: number;
    }
  | {
      kind: "adjustPopulation";
      populationId: PopulationTrackedId;
      field: "total" | "available";
      delta: BuildingRuleExpr;
      target?: BuildingRuleActionTargetScope;
      distance?: number;
    }
  | {
      kind: "adjustPopulationCap";
      delta: BuildingRuleExpr;
      target?: BuildingRuleActionTargetScope;
      distance?: number;
    }
  | {
      kind: "convertPopulation";
      from: PopulationTrackedId;
      to: PopulationTrackedId;
      amount: BuildingRuleExpr;
      target?: BuildingRuleActionTargetScope;
      distance?: number;
    }
  | {
      kind: "adjustTileRegion";
      field: keyof MapTileRegionState;
      delta: BuildingRuleExpr;
      target?: BuildingRuleActionTargetScope;
      distance?: number;
    }
  | {
      kind: "addTileState";
      tagPresetId: string;
      value?: string;
      target?: BuildingRuleActionTargetScope;
      distance?: number;
    }
  | {
      kind: "removeTileState";
      tagPresetId: string;
      target?: BuildingRuleActionTargetScope;
      distance?: number;
    };

export type BuildingExecutionRule = {
  id: string;
  intervalDays?: number;
  when?: BuildingRulePredicate;
  actions: BuildingRuleAction[];
};

export type BuildingPlacementRule =
  | { kind: "uniquePerTile"; maxCount?: number }
  | {
      kind: "tileRegionCompare";
      field: "spaceRemaining" | "pollution" | "threat" | "satisfaction";
      op: BuildingRuleComparisonOp;
      value: number;
    }
  | {
      kind: "requireTagInRange";
      tagPresetId: string;
      distance?: number;
      minCount?: number;
      negate?: boolean;
      repeat?: boolean;
      valueMode?: "equals" | "contains";
      value?: string;
    }
  | {
      kind: "requireBuildingInRange";
      presetId: string;
      distance?: number;
      minCount?: number;
      negate?: boolean;
      repeat?: boolean;
    }
  | { kind: "custom"; label: string };

export type WorldMapBuildingPresetRow = {
  id: string;
  mapId: string;
  name: string;
  color: string;
  tier?: string;
  effort?: number;
  space?: number;
  description?: string;
  placementRules?: BuildingPlacementRule[];
  buildCost?: Partial<Record<ResourceId, number>>;
  researchCost?: Partial<Record<ResourceId, number>>;
  upkeep?: {
    resources?: Partial<Record<ResourceId, number>>;
    population?: Partial<Record<UpkeepPopulationId, number>>;
  };
  effects?: {
    onBuild?: BuildingExecutionRule[];
    daily?: BuildingExecutionRule[];
    onRemove?: BuildingExecutionRule[];
  };
  createdAt: string;
  updatedAt: string;
};

export type WorldMapBuildingInstanceRow = {
  id: string;
  mapId: string;
  presetId: string;
  col: number;
  row: number;
  enabled: boolean;
  progressEffort: number;
  meta?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type WorldMapTickLogRow = {
  id: string;
  mapId: string;
  day: number;
  summary?: Record<string, unknown>;
  createdAt: string;
};

export type WorldMap = {
  id: string;
  ownerId: string;
  name: string;
  imageUrl?: string | null;
  imageWidth?: number | null;
  imageHeight?: number | null;
  hexSize: number;
  originX: number;
  originY: number;
  cols: number;
  rows: number;
  orientation: HexOrientation;
  cityGlobal?: CityGlobalState;
  tileStatePresets?: MapTileStatePreset[];
  tileStateAssignments?: Record<string, MapTileStateAssignment[]>;
  tileRegionStates?: Record<string, MapTileRegionState>;
  buildingPresets?: BuildingPreset[];
  buildingPresetRows?: WorldMapBuildingPresetRow[];
  buildingInstances?: WorldMapBuildingInstanceRow[];
  tickLogs?: WorldMapTickLogRow[];
  createdAt?: string;
  updatedAt?: string;
};

export type HpFormula = {
  expr: string;
  params?: Record<string, number>;
  min?: number;
  max?: number;
};

export type UnitPresetData = Omit<Unit, "id"> & {
  hpFormula?: HpFormula;
};

export type UnitPresetFolder = {
  id: string;
  name: string;
  order: number;
  parentId?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type UnitPreset = {
  id: string;
  name: string;
  ownerId?: string;
  folderId?: string | null;
  order?: number;
  data: UnitPresetData;
  createdAt?: string;
  updatedAt?: string;
};

export type TagPresetKind = "toggle" | "stack";

export type TagPreset = {
  id: string;
  ownerId?: string;
  folderId?: string | null;
  order?: number;
  name: string;
  kind: TagPresetKind;
  decOnTurnStart?: boolean;
  decOnTurnEnd?: boolean;
  colorCode?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type TagPresetFolder = {
  id: string;
  name: string;
  order: number;
  parentId?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

/**
 * ✅ UI에서 쓰는 CREATE_UNIT payload (backend CREATE_UNIT과 맞춤)
 * - unitId/alias/colorCode optional
 * - side includes NEUTRAL
 * - hpMax can be 0 (hp 없는 유닛 생성 가능)
 */
export type CreateUnitPayload = {
  unitId?: string;
  name: string;
  alias?: string;
  side: Side;
  unitType?: UnitKind;
  masterUnitId?: string;
  note?: string;
  hpFormula?: {
    expr: string;
    params?: Record<string, number>;
    min?: number;
    max?: number;
  };
  hpMax: number;
  acBase: number;
  x: number;
  z: number;
  colorCode?: number;
  turnOrderIndex: number; // UI에서는 항상 넣자
};

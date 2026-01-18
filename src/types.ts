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

  turnOrder?: TurnEntry[];
  turnGroups?: TurnGroup[];
  turnIndex?: number;
  battleStarted?: boolean;

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
};

export type UnitPresetData = Omit<Unit, "id">;

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
  hpMax: number;
  acBase: number;
  x: number;
  z: number;
  colorCode?: number;
  turnOrderIndex: number; // UI에서는 항상 넣자
};

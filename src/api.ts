import type { Pos } from "./types";

export const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:3000";

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("operator.auth.token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchState(encounterId: string) {
  const res = await fetch(`${API_BASE}/encounters/${encounterId}`, {
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function postAction(encounterId: string, action: any) {
  const res = await fetch(`${API_BASE}/encounters/${encounterId}/actions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(action),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function undo(encounterId: string) {
  const res = await fetch(`${API_BASE}/encounters/${encounterId}/undo`, {
    method: "POST",
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function listEncounters() {
  const res = await fetch(`${API_BASE}/encounters`, {
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createEncounter(name?: string) {
  const res = await fetch(`${API_BASE}/encounters`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteEncounter(encounterId: string) {
  const res = await fetch(`${API_BASE}/encounters/${encounterId}`, {
    method: "DELETE",
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) throw new Error(await res.text());
  if (res.status === 204) return null;
  return res.json();
}

export async function authRegister(username: string, password: string) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function authLogin(username: string, password: string) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function authMe() {
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function authLogout() {
  const res = await fetch(`${API_BASE}/auth/logout`, {
    method: "POST",
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function authClaimAdmin(key: string) {
  const res = await fetch(`${API_BASE}/auth/claim-admin`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ key }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function listUnitPresets() {
  const res = await fetch(`${API_BASE}/unit-presets`, {
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createUnitPresetFolder(body: {
  name?: string;
  order?: number;
  parentId?: string | null;
}) {
  const res = await fetch(`${API_BASE}/unit-presets/folders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateUnitPresetFolder(
  id: string,
  body: { name?: string; order?: number | null; parentId?: string | null }
) {
  const res = await fetch(`${API_BASE}/unit-presets/folders/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteUnitPresetFolder(id: string) {
  const res = await fetch(`${API_BASE}/unit-presets/folders/${id}`, {
    method: "DELETE",
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createUnitPreset(body: {
  name?: string;
  folderId?: string | null;
  order?: number;
  data?: any;
}) {
  const res = await fetch(`${API_BASE}/unit-presets`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateUnitPreset(
  id: string,
  body: {
    name?: string;
    folderId?: string | null;
    order?: number | null;
    data?: any;
  }
) {
  const res = await fetch(`${API_BASE}/unit-presets/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteUnitPreset(id: string) {
  const res = await fetch(`${API_BASE}/unit-presets/${id}`, {
    method: "DELETE",
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function validateHpFormula(body: {
  expr: string;
  params?: Record<string, number>;
  min?: number;
  max?: number;
}) {
  const res = await fetch(`${API_BASE}/unit-presets/validate-hp-formula`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function listTagPresets() {
  const res = await fetch(`${API_BASE}/tag-presets`, {
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createTagPresetFolder(body: {
  name?: string;
  order?: number;
  parentId?: string | null;
}) {
  const res = await fetch(`${API_BASE}/tag-presets/folders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateTagPresetFolder(
  id: string,
  body: { name?: string; order?: number | null; parentId?: string | null }
) {
  const res = await fetch(`${API_BASE}/tag-presets/folders/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteTagPresetFolder(id: string) {
  const res = await fetch(`${API_BASE}/tag-presets/folders/${id}`, {
    method: "DELETE",
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createTagPreset(body: {
  name?: string;
  folderId?: string | null;
  order?: number;
  kind?: "toggle" | "stack";
  decOnTurnStart?: boolean;
  decOnTurnEnd?: boolean;
  colorCode?: number | null;
}) {
  const res = await fetch(`${API_BASE}/tag-presets`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateTagPreset(
  id: string,
  body: {
    name?: string;
    folderId?: string | null;
    order?: number | null;
    kind?: "toggle" | "stack";
    decOnTurnStart?: boolean;
    decOnTurnEnd?: boolean;
    colorCode?: number | null;
  }
) {
  const res = await fetch(`${API_BASE}/tag-presets/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteTagPreset(id: string) {
  const res = await fetch(`${API_BASE}/tag-presets/${id}`, {
    method: "DELETE",
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function listGoldCharacters() {
  const res = await fetch(`${API_BASE}/gold/characters`, {
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getGoldCharacter(name: string) {
  const res = await fetch(`${API_BASE}/gold/characters/${encodeURIComponent(name)}`, {
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createGoldCharacter(body: {
  name: string;
  isNpc?: boolean;
  friend?: string | null;
}) {
  const res = await fetch(`${API_BASE}/gold/characters`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateGoldCharacter(
  name: string,
  body: {
    gold?: number;
    dailyExpense?: number;
    day?: number | null;
    isNpc?: boolean;
    friend?: string | null;
  }
) {
  const res = await fetch(`${API_BASE}/gold/characters/${encodeURIComponent(name)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteGoldCharacter(name: string) {
  const res = await fetch(`${API_BASE}/gold/characters/${encodeURIComponent(name)}`, {
    method: "DELETE",
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function listInventory(owner: string) {
  const res = await fetch(`${API_BASE}/items/inventory/${encodeURIComponent(owner)}`, {
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function addInventoryItem(body: {
  owner: string;
  itemName: string;
  amount: number;
  channelId?: string;
}) {
  const res = await fetch(`${API_BASE}/items/inventory/add`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function useInventoryItem(body: {
  owner: string;
  itemName: string;
  amount: number;
  channelId?: string;
}) {
  const res = await fetch(`${API_BASE}/items/inventory/use`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createItemCatalog(payload: {
  itemName: string;
  quality: string;
  type: string;
  unit: string;
  channelId?: string;
}) {
  const res = await fetch(`${API_BASE}/items/catalog/add`, {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function listWorldMaps() {
  const res = await fetch(`${API_BASE}/world-maps`, {
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getWorldMap(id: string) {
  const res = await fetch(`${API_BASE}/world-maps/${id}`, {
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createWorldMap(body: { name?: string }) {
  const res = await fetch(`${API_BASE}/world-maps`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateWorldMap(
  id: string,
  body: {
    name?: string;
    imageWidth?: number | null;
    imageHeight?: number | null;
    hexSize?: number;
    originX?: number;
    originY?: number;
    cols?: number;
    rows?: number;
    orientation?: "pointy" | "flat";
    cityGlobal?: {
      day?: number;
      populationCap?: number;
      warehouse?: Record<string, number>;
      values?: {
        wood?: number;
        stone?: number;
        fabric?: number;
        weave?: number;
        food?: number;
        research?: number;
        order?: number;
        gold?: number;
      };
      caps?: {
        wood?: number;
        stone?: number;
        fabric?: number;
        weave?: number;
        food?: number;
      };
      overflowToGold?: {
        wood?: number;
        stone?: number;
        fabric?: number;
        weave?: number;
        food?: number;
      };
      population?: {
        settlers?: { total?: number; available?: number };
        engineers?: { total?: number; available?: number };
        scholars?: { total?: number; available?: number };
        laborers?: { total?: number; available?: number };
        elderly?: { total?: number };
      };
      satisfaction?: number;
    };
    tileStatePresets?: Array<{
      id: string;
      name: string;
      color: string;
      hasValue: boolean;
    }>;
    tileStateAssignments?: Record<
      string,
      Array<{
        presetId: string;
        value?: string;
      }>
    >;
    tileRegionStates?: Record<
      string,
      {
        spaceUsed?: number;
        spaceCap?: number;
        threat?: number;
        pollution?: number;
      }
    >;
    buildingPresets?: Array<{
      id: string;
      name: string;
      color: string;
      tier?: string;
      effort?: number;
      space?: number;
      description?: string;
      buildCosts?: Array<{ id: string; text: string }>;
      researchCosts?: Array<{ id: string; text: string }>;
      upkeep?: Array<{ id: string; text: string }>;
      dailyEffects?: Array<{ id: string; text: string }>;
      requirements?: Array<{ id: string; text: string }>;
      notes?: Array<{ id: string; text: string }>;
    }>;
  }
) {
  const res = await fetch(`${API_BASE}/world-maps/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function uploadWorldMapImage(id: string, file: File) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/world-maps/${id}/image`, {
    method: "POST",
    headers: { ...getAuthHeaders() },
    body: form,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteWorldMap(id: string) {
  const res = await fetch(`${API_BASE}/world-maps/${id}`, {
    method: "DELETE",
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function listWorldMapBuildingPresets(mapId: string) {
  const res = await fetch(`${API_BASE}/world-maps/${mapId}/building-presets`, {
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createWorldMapBuildingPreset(
  mapId: string,
  body: {
    name?: string;
    color?: string;
    tier?: string;
    effort?: number | null;
    space?: number | null;
    description?: string | null;
    placementRules?: Array<Record<string, unknown>> | null;
    buildCost?: Record<string, number> | null;
    researchCost?: Record<string, number> | null;
    upkeep?: {
      resources?: Record<string, number>;
      population?: Record<string, number>;
    } | null;
    effects?: {
      onBuild?: Array<Record<string, unknown>>;
      daily?: Array<Record<string, unknown>>;
      onRemove?: Array<Record<string, unknown>>;
    } | null;
  },
) {
  const res = await fetch(`${API_BASE}/world-maps/${mapId}/building-presets`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateWorldMapBuildingPreset(
  mapId: string,
  presetId: string,
  body: {
    name?: string;
    color?: string;
    tier?: string;
    effort?: number | null;
    space?: number | null;
    description?: string | null;
    placementRules?: Array<Record<string, unknown>> | null;
    buildCost?: Record<string, number> | null;
    researchCost?: Record<string, number> | null;
    upkeep?: {
      resources?: Record<string, number>;
      population?: Record<string, number>;
    } | null;
    effects?: {
      onBuild?: Array<Record<string, unknown>>;
      daily?: Array<Record<string, unknown>>;
      onRemove?: Array<Record<string, unknown>>;
    } | null;
  },
) {
  const res = await fetch(`${API_BASE}/world-maps/${mapId}/building-presets/${presetId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteWorldMapBuildingPreset(mapId: string, presetId: string) {
  const res = await fetch(`${API_BASE}/world-maps/${mapId}/building-presets/${presetId}`, {
    method: "DELETE",
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function listWorldMapBuildingInstances(mapId: string) {
  const res = await fetch(`${API_BASE}/world-maps/${mapId}/buildings`, {
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createWorldMapBuildingInstance(
  mapId: string,
  body: {
    presetId?: string;
    col?: number;
    row?: number;
    enabled?: boolean;
    progressEffort?: number;
    meta?: Record<string, unknown>;
  },
) {
  const res = await fetch(`${API_BASE}/world-maps/${mapId}/buildings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateWorldMapBuildingInstance(
  mapId: string,
  instanceId: string,
  body: {
    enabled?: boolean;
    progressEffort?: number;
    meta?: Record<string, unknown> | null;
  },
) {
  const res = await fetch(`${API_BASE}/world-maps/${mapId}/buildings/${instanceId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteWorldMapBuildingInstance(mapId: string, instanceId: string) {
  const res = await fetch(`${API_BASE}/world-maps/${mapId}/buildings/${instanceId}`, {
    method: "DELETE",
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function listWorldMapTickLogs(mapId: string, limit = 30) {
  const query = Number.isFinite(limit) ? `?limit=${Math.max(1, Math.trunc(limit))}` : "";
  const res = await fetch(`${API_BASE}/world-maps/${mapId}/tick-logs${query}`, {
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function appendWorldMapTickLog(
  mapId: string,
  body: { day?: number; summary?: Record<string, unknown> },
) {
  const res = await fetch(`${API_BASE}/world-maps/${mapId}/tick-logs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function runWorldMapDaily(mapId: string, days = 1) {
  const res = await fetch(`${API_BASE}/world-maps/${mapId}/run-daily`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ days }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function transferInventoryItem(body: {
  fromName: string;
  toName: string;
  itemName: string;
  amount: number;
  channelId?: string;
}) {
  const res = await fetch(`${API_BASE}/items/inventory/give`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function listItemCatalog() {
  const res = await fetch(`${API_BASE}/items/catalog`, {
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// 이동/배치
export const moveUnit = (encounterId: string, unitId: string, dx = 0, dz = 0) =>
  postAction(encounterId, { type: "MOVE_UNIT", unitId, dx, dz });

export const setUnitPos = (
  encounterId: string,
  unitId: string,
  x: number,
  z: number,
) => postAction(encounterId, { type: "SET_UNIT_POS", unitId, x, z });

// 마커
export const upsertMarker = (payload: {
  encounterId: string;
  markerId: string;
  name: string;
  alias?: string | null;
  x: number;
  z: number;
  cells?: Pos[] | null;
  duration?: number | null;
}) => {
  const { encounterId, ...rest } = payload;
  return postAction(encounterId, { type: "UPSERT_MARKER", ...rest });
};

export const removeMarker = (encounterId: string, markerId: string) =>
  postAction(encounterId, { type: "REMOVE_MARKER", markerId });

// channelId를 body로 보내도록 변경
export async function publish(
  encounterId: string,
  channelId: string,
  opts?: {
    hideBench?: boolean;
    hideBenchTeam?: boolean;
    hideBenchEnemy?: boolean;
    planarMode?: boolean;
  },
) {
  const res = await fetch(`${API_BASE}/encounters/${encounterId}/publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({
      channelId,
      hideBench: !!opts?.hideBench,
      hideBenchTeam: !!opts?.hideBenchTeam,
      hideBenchEnemy: !!opts?.hideBenchEnemy,
      planarMode: !!opts?.planarMode,
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

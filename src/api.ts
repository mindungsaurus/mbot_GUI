import type { Pos } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:3000";

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
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

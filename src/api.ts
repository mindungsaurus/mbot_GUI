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

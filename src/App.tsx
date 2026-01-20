// src/App.tsx
import {
  useEffect,
  useMemo,
  useState,
  useRef,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  authLogin,
  authLogout,
  authMe,
  authClaimAdmin,
  authRegister,
  createEncounter,
  fetchState,
  listEncounters,
  listTagPresets,
  postAction,
  publish,
  undo as undoAction,
} from "./api";
import type {
  AuthUser,
  CreateUnitPayload,
  EncounterState,
  EncounterSummary,
  Marker,
  Pos,
  Side,
  TagPreset,
  TagPresetFolder,
  TurnEntry,
  TurnGroup,
  Unit,
  UnitPatch,
} from "./types";
import Board from "./Board";
import ControlPanel, { type ControlActionMode } from "./ControlPanel";
import EditUnitModal from "./EditUnitModal";
import UnitsPanel from "./UnitsPanel";
import BenchPanel from "./BenchPanel";
import TurnOrderBar from "./TurnOrderBar";
import TurnOrderReorderModal from "./TurnOrderReorderModal";
import UnitPresetManager from "./UnitPresetManager";
import TagPresetManager from "./TagPresetManager";
import GoldItemsManager from "./GoldItemsManager";
import { ansiColorCodeToCss } from "./UnitColor";

const LS_DEFAULT_CHANNEL = "operator.defaultChannelId";
const LS_RECENT_CHANNELS = "operator.recentChannelIds";
const LS_AUTH_TOKEN = "operator.auth.token";
const LS_ENCOUNTER_ID = "operator.encounterId";
const SIDE_MEMO_COLORS: Array<{ code: number; label: string }> = [
  { code: 30, label: "회색" },
  { code: 31, label: "빨강" },
  { code: 32, label: "초록" },
  { code: 33, label: "노랑" },
  { code: 34, label: "파랑" },
  { code: 35, label: "보라" },
  { code: 36, label: "하늘" },
  { code: 37, label: "흰색" },
];
const IDENTIFIER_SCHEME_OPTIONS = [
  { id: "korean", label: "한글 ㄱㄴㄷ" },
  { id: "abc", label: "영문 abc" },
  { id: "ABC", label: "영문 ABC" },
  { id: "greek", label: "그리스 문자" },
  { id: "number", label: "숫자" },
] as const;

type AnsiSegment = {
  text: string;
  color?: number | string;
  bold?: boolean;
};

function normalizeAnsiMemo(raw: string | null | undefined) {
  let text = String(raw ?? "");
  const fenced =
    text.match(/```ansi\s*([\s\S]*?)```/i) || text.match(/```\s*([\s\S]*?)```/);
  if (fenced) text = fenced[1];
  const esc = "\x1b[";
  text = text.split("\\u001b[").join(esc);
  text = text.split("\\x1b[").join(esc);
  return text;
}

function parseAnsiSegments(input: string): AnsiSegment[] {
  const segments: AnsiSegment[] = [];
  const re = /\u001b\[([0-9;]*)m/g;
  let last = 0;
  let bold = false;
  let color: string | undefined = undefined;
  let match: RegExpExecArray | null = null;

  while ((match = re.exec(input))) {
    if (match.index > last) {
      segments.push({ text: input.slice(last, match.index), color, bold });
    }

    const raw = match[1] ?? "";
    const codes = raw
      .split(";")
      .filter((part) => part.length > 0)
      .map((part) => Number(part));

    const seq = codes.length > 0 ? codes : [0];
    for (const code of seq) {
      if (!Number.isFinite(code)) continue;
      if (code === 0) {
        bold = false;
        color = undefined;
        continue;
      }
      if (code === 1) {
        bold = true;
        continue;
      }
      if (code === 22) {
        bold = false;
        continue;
      }
      if (code === 39) {
        color = undefined;
        continue;
      }
      if (code === 38) {
        color = ansiColorCodeToCss(30);
        continue;
      }
      const next = ansiColorCodeToCss(code);
      if (next) color = next;
    }

    last = re.lastIndex;
  }

  if (last < input.length) {
    segments.push({ text: input.slice(last), color, bold });
  }

  return segments;
}

function renderAnsiMemo(text: string) {
  const segments = parseAnsiSegments(text);
  return segments.map((seg, idx) => (
    <span
      key={`${idx}-${seg.text.length}`}
      style={{
        color:
          typeof seg.color === "number"
            ? ansiColorCodeToCss(seg.color)
            : seg.color,
        fontWeight: seg.bold ? 700 : 400,
        fontSynthesis: "weight",
      }}
    >
      {seg.text}
    </span>
  ));
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeCssColor(raw?: string | null): string | null {
  if (!raw) return null;
  const value = raw.trim().toLowerCase();
  if (!value) return null;
  if (value.startsWith("#")) {
    if (value.length === 4) {
      return (
        "#" +
        value
          .slice(1)
          .split("")
          .map((c) => c + c)
          .join("")
      );
    }
    return value;
  }
  const rgbMatch = value.match(/rgba?\(([^)]+)\)/);
  if (rgbMatch) {
    const parts = rgbMatch[1]
      .split(/[,\s/]+/)
      .map((part) => part.trim())
      .filter(Boolean);
    const [rRaw, gRaw, bRaw] = parts;
    const r = Number(rRaw);
    const g = Number(gRaw);
    const b = Number(bRaw);
    if ([r, g, b].every((n) => Number.isFinite(n))) {
      return (
        "#" +
        [r, g, b]
          .map((n) => n.toString(16).padStart(2, "0"))
          .join("")
      );
    }
  }
  return null;
}

const ANSI_COLOR_MAP: Array<{ code: number; css: string }> = SIDE_MEMO_COLORS.map(
  (c) => ({ code: c.code, css: ansiColorCodeToCss(c.code) ?? "" })
).filter((c) => c.css);

function cssColorToAnsiCode(raw?: string | null): number | undefined {
  const norm = normalizeCssColor(raw);
  if (!norm) return undefined;
  for (const entry of ANSI_COLOR_MAP) {
    if (normalizeCssColor(entry.css) === norm) return entry.code;
  }
  return undefined;
}

function segmentsToHtml(segments: AnsiSegment[]): string {
  if (!segments.length) return "";
  return segments
    .map((seg) => {
      const text = escapeHtml(seg.text);
      const styles: string[] = [];
      if (typeof seg.color === "number") {
        styles.push(`color: ${ansiColorCodeToCss(seg.color)}`);
      } else if (typeof seg.color === "string") {
        styles.push(`color: ${seg.color}`);
      }
      if (seg.bold) styles.push("font-weight: 700");
      const styleAttr = styles.length ? ` style="${styles.join("; ")}"` : "";
      return `<span${styleAttr}>${text}</span>`;
    })
    .join("");
}

function ansiToHtml(raw: string | null | undefined): string {
  const segments = parseAnsiSegments(normalizeAnsiMemo(raw));
  return segmentsToHtml(segments);
}

function extractSegmentsFromHtml(html: string): AnsiSegment[] {
  const container = document.createElement("div");
  container.innerHTML = html || "";
  const out: AnsiSegment[] = [];

  function pushText(text: string, style: { color?: number; bold?: boolean }) {
    if (!text) return;
    const cleaned = text.replace(/ /g, " ");
    if (!cleaned) return;
    const last = out[out.length - 1];
    if (last && last.color === style.color && last.bold === style.bold) {
      last.text += cleaned;
      return;
    }
    out.push({ text: cleaned, color: style.color, bold: style.bold });
  }

  function walk(node: Node, style: { color?: number; bold?: boolean }) {
    if (node.nodeType === Node.TEXT_NODE) {
      pushText(node.textContent ?? "", style);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const el = node as HTMLElement;
    let nextStyle = { ...style };
    const tag = el.tagName.toUpperCase();

    if (tag === "B" || tag === "STRONG") {
      nextStyle.bold = true;
    }

    const weight = el.style.fontWeight;
    if (weight) {
      if (weight === "bold") nextStyle.bold = true;
      const numeric = Number(weight);
      if (Number.isFinite(numeric) && numeric >= 600) nextStyle.bold = true;
    }

    const color = el.style.color || el.getAttribute("color");
    const mapped = cssColorToAnsiCode(color);
    if (mapped !== undefined) nextStyle.color = mapped;

    if (tag === "BR") {
      pushText("\n", style);
      return;
    }

    const isBlock = tag === "DIV" || tag === "P";
    const children = Array.from(el.childNodes);
    for (const child of children) {
      walk(child, nextStyle);
    }
    if (isBlock && children.length) {
      pushText("\n", style);
    }
  }

  for (const child of Array.from(container.childNodes)) {
    walk(child, {});
  }

  return out;
}

function segmentsToAnsi(segments: AnsiSegment[]): string {
  let out = "";
  let curColor: number | undefined = undefined;
  let curBold = false;
  for (const seg of segments) {
    if (!seg.text) continue;
    const color =
      typeof seg.color === "number"
        ? seg.color
        : cssColorToAnsiCode(seg.color);
    const bold = !!seg.bold;
    if (color !== curColor || bold !== curBold) {
      out += "[0m";
      const codes: string[] = [];
      if (bold) codes.push("1");
      if (typeof color === "number") codes.push(String(color));
      if (codes.length) out += `[${codes.join(";")}m`;
      curColor = color;
      curBold = bold;
    }
    out += seg.text;
  }
  if (curColor !== undefined || curBold) out += "[0m";
  return out;
}


function sanitizeChannelId(input: string): string {
  return (input ?? "").replace(/\D/g, "");
}

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveJson(key: string, value: any) {
  localStorage.setItem(key, JSON.stringify(value));
}

type View = { minX: number; maxX: number; minZ: number; maxZ: number };

/**
 * 자동 bounds 정책
 * - z: 기본은 0 기준, 필요하면 음수까지 확장
 * - x: 항상 0이 중앙(좌우 대칭), 좌/우 필요한 만큼 + pad
 */
function computeAutoView(
  units: Unit[],
  markers: Marker[],
  opts?: { padX?: number; padZ?: number; minCols?: number; minRows?: number }
): View {
  const padX = opts?.padX ?? 2;
  const padZ = opts?.padZ ?? 1;
  const minCols = opts?.minCols ?? 9; // 홀수 권장(0 중앙)
  const minRows = opts?.minRows ?? 3;

  let maxAbsX = 0;
  let minZ = 0;
  let maxZ = 0;

  for (const u of units) {
    if (!u.pos) continue;
    maxAbsX = Math.max(maxAbsX, Math.abs(u.pos.x));
    minZ = Math.min(minZ, u.pos.z);
    maxZ = Math.max(maxZ, u.pos.z);
  }
  for (const m of markers) {
    const cells = Array.isArray(m.cells) && m.cells.length ? m.cells : [m.pos];
    for (const cell of cells) {
      if (!cell) continue;
      maxAbsX = Math.max(maxAbsX, Math.abs(cell.x));
      minZ = Math.min(minZ, cell.z);
      maxZ = Math.max(maxZ, cell.z);
    }
  }

  const viewMinZ = minZ < 0 ? minZ - padZ : 0;
  const viewMaxZ = Math.max(maxZ + padZ, minRows - 1);

  let radius = maxAbsX + padX;
  const targetMinCols = minCols % 2 === 1 ? minCols : minCols + 1;
  const minRadiusForCols = Math.floor((targetMinCols - 1) / 2);
  radius = Math.max(radius, minRadiusForCols);

  return { minX: -radius, maxX: radius, minZ: viewMinZ, maxZ: viewMaxZ };
}

/*
type MoveTurnEntryAction = {
  type: "MOVE_TURN_ENTRY";
  fromIndex: number;
  toIndex: number;
};

function isUnitTurnEntry(
  entry: TurnEntry | null | undefined
): entry is Extract<TurnEntry, { kind: "unit" }> {
  return entry?.kind === "unit" && typeof entry.unitId === "string";
}

function buildMoveTurnEntryActions(
  order: TurnEntry[],
  unitIds: string[]
): { actions: MoveTurnEntryAction[]; error?: string } {
  const actions: MoveTurnEntryAction[] = [];
  if (!Array.isArray(order) || order.length === 0) return { actions };

  const unitEntries = order.filter(isUnitTurnEntry);
  if (unitEntries.length !== unitIds.length) {
    return {
      actions,
      error: "턴 순서에 있는 유닛 수와 재배치 대상 수가 맞지 않습니다.",
    };
  }

  const currentKeys: string[] = [];
  const labelKeys: string[] = [];
  const unitQueues = new Map<string, string[]>();
  const unitCounts = new Map<string, number>();
  let labelIdx = 0;

  for (const entry of order) {
    if (isUnitTurnEntry(entry)) {
      const count = unitCounts.get(entry.unitId) ?? 0;
      unitCounts.set(entry.unitId, count + 1);
      const key = `unit:${entry.unitId}:${count}`;
      currentKeys.push(key);
      const q = unitQueues.get(entry.unitId) ?? [];
      q.push(key);
      unitQueues.set(entry.unitId, q);
    } else {
      const key = `label:${labelIdx++}`;
      currentKeys.push(key);
      labelKeys.push(key);
    }
  }

  const desiredUnitKeys: string[] = [];
  for (const unitId of unitIds) {
    const q = unitQueues.get(unitId);
    if (!q || q.length === 0) {
      return {
        actions,
        error: "턴 순서에 없는 유닛이 포함되어 있습니다.",
      };
    }
    desiredUnitKeys.push(q.shift() as string);
  }

  const desiredKeys: string[] = [];
  let unitIdx = 0;
  let labelIdx2 = 0;
  for (const entry of order) {
    if (isUnitTurnEntry(entry)) {
      desiredKeys.push(desiredUnitKeys[unitIdx++]);
    } else {
      desiredKeys.push(labelKeys[labelIdx2++]);
    }
  }

  const working = currentKeys.slice();
  for (let i = 0; i < desiredKeys.length; i++) {
    if (working[i] === desiredKeys[i]) continue;
    const from = working.indexOf(desiredKeys[i], i + 1);
    if (from < 0) continue;
    actions.push({ type: "MOVE_TURN_ENTRY", fromIndex: from, toIndex: i });
    const [item] = working.splice(from, 1);
    working.splice(i, 0, item);
  }

  return { actions };
}

*/
export default function App() {
  const [state, setState] = useState<EncounterState | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(() =>
    localStorage.getItem(LS_AUTH_TOKEN)
  );
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authErr, setAuthErr] = useState<string | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [registerUsername, setRegisterUsername] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerConfirm, setRegisterConfirm] = useState("");
  const [registerErr, setRegisterErr] = useState<string | null>(null);
  const [adminKeyOpen, setAdminKeyOpen] = useState(false);
  const [adminKeyValue, setAdminKeyValue] = useState("");
  const [adminKeyErr, setAdminKeyErr] = useState<string | null>(null);
  const [adminKeyBusy, setAdminKeyBusy] = useState(false);
  const [encounterId, setEncounterId] = useState<string>(
    () => localStorage.getItem(LS_ENCOUNTER_ID) ?? ""
  );
  const [sessionSelected, setSessionSelected] = useState(false);
  const [presetView, setPresetView] = useState(false);
  const [tagPresetView, setTagPresetView] = useState(false);
  const [goldItemsView, setGoldItemsView] = useState(false);
  const [encounters, setEncounters] = useState<EncounterSummary[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null); // primary(대표) 선택
  const [amount, setAmount] = useState<number>(5);
  const [panelSlotLevel, setPanelSlotLevel] = useState<number>(1);
  const [panelSlotDelta, setPanelSlotDelta] = useState<"spend" | "recover">("spend");
  const [panelIdentifierScheme, setPanelIdentifierScheme] = useState<string>(
    () => IDENTIFIER_SCHEME_OPTIONS[0].id
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reorderOpen, setReorderOpen] = useState(false);
  const [editUnitId, setEditUnitId] = useState<string | null>(null);
  const [memoViewId, setMemoViewId] = useState<string | null>(null);
  const [boardMenu, setBoardMenu] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const [memoCopyToast, setMemoCopyToast] = useState(false);
  const memoCopyTimerRef = useRef<number | null>(null);
  const adminHotkeyKeysRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    return () => {
      if (memoCopyTimerRef.current) {
        window.clearTimeout(memoCopyTimerRef.current);
      }
    };
  }, []);  const [debugOpen, setDebugOpen] = useState(true);
  const [hideBenchTeamOnPublish, setHideBenchTeamOnPublish] = useState(false);
  const [hideBenchEnemyOnPublish, setHideBenchEnemyOnPublish] = useState(false);
  const channelInputRef = useRef<HTMLInputElement | null>(null);

  // 채널 입력/최근 채널
  const [channelInput, setChannelInput] = useState("");
  const [recentChannels, setRecentChannels] = useState<string[]>([]);
  const channelId = useMemo(
    () => sanitizeChannelId(channelInput),
    [channelInput]
  );

  // 마커 입력값
  // Marker creation flow (board selection + form)
  const [markerCreateOpen, setMarkerCreateOpen] = useState(false);
  const [markerSelectedCells, setMarkerSelectedCells] = useState<Pos[]>([]);
  const [markerMultiSelect, setMarkerMultiSelect] = useState(false);
  const [markerDraftName, setMarkerDraftName] = useState("");
  const [markerDraftAlias, setMarkerDraftAlias] = useState("");
  const [markerDraftDuration, setMarkerDraftDuration] = useState("");
  const [markerDraftErr, setMarkerDraftErr] = useState<string | null>(null);
  const [markerEmojiOpen, setMarkerEmojiOpen] = useState(false);
  const markerEmojiRef = useRef<HTMLDivElement | null>(null);
  // Quick emojis for marker alias.
  const markerEmojiList = [
    "🛢️",
    "💀",
    "🧊",
    "🪜",
    "💣",
    "🌪️",
    "💫",
    "☄️",
    "🔥",
    "🚪",
    "🪟",
  ];

  const [sideMemoOpen, setSideMemoOpen] = useState(false);
  const [sideMemoTab, setSideMemoTab] = useState<Side>("TEAM");
  const sideMemoDraftsRef = useRef<Record<Side, string>>({
    TEAM: "",
    ENEMY: "",
    NEUTRAL: "",
  });
  const sideMemoRefs = useRef<Record<Side, HTMLDivElement | null>>({
    TEAM: null,
    ENEMY: null,
    NEUTRAL: null,
  });

  useEffect(() => {
    if (!sideMemoOpen) return;
    const el = sideMemoRefs.current[sideMemoTab];
    if (!el) return;
    const html = sideMemoDraftsRef.current[sideMemoTab] ?? "";
    if (el.innerHTML !== html) {
      el.innerHTML = html;
    }
  }, [sideMemoOpen, sideMemoTab]);
  // Status tag grant modal
  const [tagGrantOpen, setTagGrantOpen] = useState(false);
  const [tagGrantName, setTagGrantName] = useState("");
  const [tagGrantType, setTagGrantType] = useState<"toggle" | "stack">(
    "toggle"
  );
  const [tagGrantStacks, setTagGrantStacks] = useState(1);
  const [tagGrantDecStart, setTagGrantDecStart] = useState(false);
  const [tagGrantDecEnd, setTagGrantDecEnd] = useState(false);
  const [tagGrantErr, setTagGrantErr] = useState<string | null>(null);
  const [tagGrantPresets, setTagGrantPresets] = useState<TagPreset[]>([]);
  const [tagGrantPresetFolders, setTagGrantPresetFolders] = useState<
    TagPresetFolder[]
  >([]);
  const [tagGrantPresetId, setTagGrantPresetId] = useState("");
  const [tagGrantFolderFilter, setTagGrantFolderFilter] = useState<string>("ALL");
  const [tagGrantPresetQuery, setTagGrantPresetQuery] = useState("");
  const [tagGrantFolderCollapsed, setTagGrantFolderCollapsed] = useState<
    Record<string, boolean>
  >({});
  const [tagGrantPresetErr, setTagGrantPresetErr] = useState<string | null>(
    null
  );
  const [tagGrantPresetLoading, setTagGrantPresetLoading] = useState(false);
  const [slotUseNotice, setSlotUseNotice] = useState<{
    level: number;
    kind: "spend" | "recover";
    rows: Array<{
      label: string;
      status: "missing" | "empty" | "applied";
      before?: string;
      after?: string;
    }>;
  } | null>(null);

  const units: Unit[] = useMemo(() => state?.units ?? [], [state]);
  const markers: Marker[] = useMemo(() => state?.markers ?? [], [state]);
  const activeUnits: Unit[] = useMemo(
    () => units.filter((u) => !u.bench),
    [units]
  );
  const editUnit = useMemo(
    () => (editUnitId ? units.find((u) => u.id === editUnitId) ?? null : null),
    [editUnitId, units]
  );
  const memoViewUnit = useMemo(
    () => (memoViewId ? units.find((u) => u.id === memoViewId) ?? null : null),
    [memoViewId, units]
  );
  const memoViewContent = useMemo(() => {
    if (!memoViewUnit?.note?.trim()) return null;
    const normalized = normalizeAnsiMemo(memoViewUnit.note);
    return renderAnsiMemo(normalized);
  }, [memoViewUnit?.note]);
  const logEntries = useMemo(() => {
    const logs = state?.logs ?? [];
    return logs.slice(-200).reverse();
  }, [state?.logs]);
  const battleStarted = state?.battleStarted ?? false;
  const activeEncounter = useMemo(
    () => encounters.find((enc) => enc.id === encounterId) ?? null,
    [encounters, encounterId]
  );

  const selected = useMemo(
    () =>
      selectedId
        ? (state?.units.find((u) => u.id === selectedId) ?? null)
        : null,
    [state?.units, selectedId]
  );
  const [panelConsumableName, setPanelConsumableName] = useState("");
  const [panelConsumableDelta, setPanelConsumableDelta] = useState<"dec" | "inc">(
    "dec"
  );
  const [panelTagReduceName, setPanelTagReduceName] = useState("");
  const panelConsumableOptions = useMemo(() => {
    const entries = Object.entries(selected?.consumables ?? {}).filter(
      ([, value]) => typeof value === "number"
    );
    return entries.map(([name, value]) => ({
      name,
      value: value ?? 0,
    }));
  }, [selected?.consumables]);
  const panelConsumableRemaining = useMemo(() => {
    if (!panelConsumableName) return null;
    const value = selected?.consumables?.[panelConsumableName];
    return typeof value === "number" ? value : null;
  }, [panelConsumableName, selected?.consumables]);
  const panelConsumableDisabled =
    !selectedId || panelConsumableOptions.length === 0;

  const panelTagReduceOptions = useMemo(() => {
    const out = new Map<
      string,
      { name: string; kind: "toggle" | "stack"; stacks?: number }
    >();
    const tags = Array.isArray(selected?.tags) ? selected?.tags : [];
    for (const raw of tags) {
      const name = String(raw ?? "").trim();
      if (!name) continue;
      if (!out.has(name)) out.set(name, { name, kind: "toggle" });
    }
    const tagStates = selected?.tagStates ?? {};
    for (const [nameRaw, st] of Object.entries(tagStates)) {
      const name = String(nameRaw ?? "").trim();
      if (!name) continue;
      const stacks = Math.max(
        0,
        Math.trunc(Number((st as any)?.stacks ?? 0))
      );
      if (Number.isFinite(stacks)) {
        out.set(name, { name, kind: "stack", stacks });
      }
    }
    return [...out.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [selected?.tags, selected?.tagStates]);
  const panelTagReduceDisabled =
    !selectedId || panelTagReduceOptions.length === 0;
  const panelTagReduceSelected = useMemo(
    () =>
      panelTagReduceOptions.find((opt) => opt.name === panelTagReduceName) ??
      null,
    [panelTagReduceOptions, panelTagReduceName]
  );

  useEffect(() => {
    if (!selectedId || panelConsumableOptions.length === 0) {
      if (panelConsumableName !== "") setPanelConsumableName("");
      return;
    }
    const exists = panelConsumableOptions.some(
      (entry) => entry.name === panelConsumableName
    );
    if (!exists) setPanelConsumableName(panelConsumableOptions[0].name);
  }, [selectedId, panelConsumableOptions, panelConsumableName]);

  useEffect(() => {
    if (!selectedId || panelTagReduceOptions.length === 0) {
      if (panelTagReduceName !== "") setPanelTagReduceName("");
      return;
    }
    const exists = panelTagReduceOptions.some(
      (entry) => entry.name === panelTagReduceName
    );
    if (!exists) setPanelTagReduceName(panelTagReduceOptions[0].name);
  }, [selectedId, panelTagReduceOptions, panelTagReduceName]);

  const canControlMove = selectedIds.length > 0 || !!selectedId;
  const tagGrantTargetCount = selectedIds.length
    ? selectedIds.length
    : selectedId
      ? 1
      : 0;
  const panelHotkeysEnabled =
    !busy &&
    !markerCreateOpen &&
    !tagGrantOpen &&
    !settingsOpen &&
    !reorderOpen &&
    !slotUseNotice &&
    !registerOpen &&
    !sideMemoOpen &&
    !editUnitId &&
    !memoViewId;
  const tagGrantFolderTree = useMemo(() => {
    const byParent = new Map<string | null, TagPresetFolder[]>();
    for (const folder of tagGrantPresetFolders) {
      const parentId = folder.parentId ?? null;
      const list = byParent.get(parentId) ?? [];
      list.push(folder);
      byParent.set(parentId, list);
    }
    for (const list of byParent.values()) {
      list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }
    const out: Array<{
      folder: TagPresetFolder;
      depth: number;
      hasChildren: boolean;
      collapsed: boolean;
    }> = [];
    const walk = (parentId: string | null, depth: number) => {
      const list = byParent.get(parentId) ?? [];
      for (const folder of list) {
        const children = byParent.get(folder.id) ?? [];
        const collapsed = !!tagGrantFolderCollapsed[folder.id];
        out.push({
          folder,
          depth,
          hasChildren: children.length > 0,
          collapsed,
        });
        if (!collapsed) walk(folder.id, depth + 1);
      }
    };
    walk(null, 0);
    return out;
  }, [tagGrantPresetFolders, tagGrantFolderCollapsed]);
  const tagGrantFilteredPresets = useMemo(() => {
    const query = tagGrantPresetQuery.trim().toLowerCase();
    let list = tagGrantPresets;
    if (tagGrantFolderFilter === "NONE") {
      list = list.filter((preset) => !preset.folderId);
    } else if (tagGrantFolderFilter !== "ALL") {
      list = list.filter(
        (preset) => (preset.folderId ?? "") === tagGrantFolderFilter
      );
    }
    if (query) {
      list = list.filter((preset) =>
        (preset.name ?? "").toLowerCase().includes(query)
      );
    }
    return [...list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [tagGrantPresets, tagGrantFolderFilter, tagGrantPresetQuery]);

  useEffect(() => {
    if (authToken) {
      localStorage.setItem(LS_AUTH_TOKEN, authToken);
    } else {
      localStorage.removeItem(LS_AUTH_TOKEN);
    }
  }, [authToken]);

  useEffect(() => {
    if (!authToken) {
      setAuthUser(null);
      setEncounters([]);
      setEncounterId("");
      setState(null);
      return;
    }

    authMe()
      .then((me) => setAuthUser(me as AuthUser))
      .catch((e) => {
        setAuthErr(String(e?.message ?? e));
        setAuthToken(null);
        setAuthUser(null);
      });
  }, [authToken]);

  useEffect(() => {
    if (!registerOpen) {
      setRegisterUsername("");
      setRegisterPassword("");
      setRegisterConfirm("");
      setRegisterErr(null);
    }
  }, [registerOpen]);

  // Reset session flow when auth changes.
  useEffect(() => {
    if (!authUser) {
      setSessionSelected(false);
      setPresetView(false);
      setTagPresetView(false);
      return;
    }
    setSessionSelected(false);
    setPresetView(false);
    setTagPresetView(false);
  }, [authUser?.id]);

  useEffect(() => {
    if (!authUser) return;
    loadEncounters().catch((e) => setErr(String(e?.message ?? e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser]);

  useEffect(() => {
    if (encounterId) {
      localStorage.setItem(LS_ENCOUNTER_ID, encounterId);
    } else {
      localStorage.removeItem(LS_ENCOUNTER_ID);
    }
  }, [encounterId]);

  useEffect(() => {
    if (!encounterId) {
      setSessionSelected(false);
    }
  }, [encounterId]);

  useEffect(() => {
    if (sessionSelected) return;
    setSettingsOpen(false);
    setReorderOpen(false);
    setTagGrantOpen(false);
    setMarkerCreateOpen(false);
    setSlotUseNotice(null);
  }, [sessionSelected]);

  function isEditableTarget(target: EventTarget | null) {
    const el = target as HTMLElement | null;
    if (!el) return false;
    const tag = el.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    return el.isContentEditable;
  }

  useEffect(() => {
    if (!state) return;

    const alive = new Set(state.units.map((u) => u.id));

    // selectedIds 정리
    setSelectedIds((prev) => {
      const filtered = prev.filter((id) => alive.has(id));
      if (filtered.length > 0) return filtered;

      // 아무것도 없으면 첫 유닛을 기본 선택(원하면 null 유지로 바꿔도 됨)
      return state.units[0]?.id ? [state.units[0].id] : [];
    });

    // primary 정리
    setSelectedId((prev) => {
      if (prev && alive.has(prev)) return prev;

      // selectedIds effect가 먼저 반영되기 전이므로 안전하게 units[0]로 fallback
      return state.units[0]?.id ?? null;
    });
  }, [state?.units]);

  // Keyboard movement (arrows/WASD) unless a modal/input is active.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (busy) return;
      if (
        markerCreateOpen ||
        tagGrantOpen ||
        settingsOpen ||
        reorderOpen ||
        slotUseNotice
      )
        return;
      if (isEditableTarget(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      let dx = 0;
      let dz = 0;
      switch (e.key) {
        case "ArrowUp":
        case "w":
        case "W":
          dz = +1;
          break;
        case "ArrowDown":
        case "s":
        case "S":
          dz = -1;
          break;
        case "ArrowLeft":
        case "a":
        case "A":
          dx = -1;
          break;
        case "ArrowRight":
        case "d":
        case "D":
          dx = +1;
          break;
        default:
          return;
      }

      if (!canControlMove) return;
      e.preventDefault();
      moveByPad(dx, dz);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    busy,
    canControlMove,
    markerCreateOpen,
    tagGrantOpen,
    settingsOpen,
    reorderOpen,
    slotUseNotice,
    selectedIds,
    selectedId,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!authUser) return;
    if (sessionSelected || presetView || tagPresetView || goldItemsView) return;

    const pressed = adminHotkeyKeysRef.current;
    const hasCombo = () =>
      (pressed.has("AltLeft") || pressed.has("AltRight")) &&
      pressed.has("KeyA") &&
      pressed.has("KeyT");

    const handleKeyDown = (event: KeyboardEvent) => {
      if (adminKeyOpen) return;
      pressed.add(event.code);
      if (!hasCombo()) return;

      event.preventDefault();
      event.stopPropagation();
      pressed.clear();
      setAdminKeyErr(null);
      setAdminKeyValue("");
      setAdminKeyOpen(true);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      pressed.delete(event.code);
    };

    const handleBlur = () => {
      pressed.clear();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, [
    authUser,
    adminKeyOpen,
    sessionSelected,
    presetView,
    tagPresetView,
    goldItemsView,
  ]);

  async function refresh() {
    if (!encounterId) return;
    const s = (await fetchState(encounterId)) as EncounterState;
    setState(s);

    const firstId = s?.units?.[0]?.id ?? null;

    if (!selectedId) {
      if (firstId) setSelectedId(firstId);
      return;
    }

    const exists = (s?.units ?? []).some((u) => u.id === selectedId);
    if (!exists) setSelectedId(firstId);
  }

  async function undoLast() {
    if (!encounterId) return;
    try {
      setErr(null);
      setBusy(true);
      const next = (await undoAction(encounterId)) as EncounterState;
      setState(next);

      const firstId = next?.units?.[0]?.id ?? null;

      if (!selectedId) {
        if (firstId) setSelectedId(firstId);
      } else {
        const exists = (next?.units ?? []).some((u) => u.id === selectedId);
        if (!exists) setSelectedId(firstId);
      }
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function run(action: any) {
    if (!encounterId) {
      setErr("선택된 전투 세션이 없습니다.");
      return;
    }
    try {
      setErr(null);
      setBusy(true);
      const next = (await postAction(encounterId, action)) as EncounterState;
      setState(next);

      const firstId = next?.units?.[0]?.id ?? null;

      if (!selectedId) {
        if (firstId) setSelectedId(firstId);
      } else {
        const exists = (next?.units ?? []).some((u) => u.id === selectedId);
        if (!exists) setSelectedId(firstId);
      }
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function loadEncounters(preferId?: string) {
    try {
      const list = (await listEncounters()) as EncounterSummary[];
      setEncounters(list);

      const nextId = preferId ?? encounterId;
      if (nextId && list.some((e) => e.id === nextId)) {
        if (nextId !== encounterId) setEncounterId(nextId);
        return;
      }

      if (nextId) {
        setEncounterId("");
      }
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    }
  }

  async function loginWithCredentials(username: string, password: string) {
    try {
      setAuthErr(null);
      const res = await authLogin(username, password);
      localStorage.setItem(LS_AUTH_TOKEN, res.token);
      setAuthToken(res.token);
      setAuthUser(res.user);
      setAuthPassword("");
    } catch (e: any) {
      setAuthErr(String(e?.message ?? e));
    }
  }

  async function handleLogin() {
    await loginWithCredentials(authUsername, authPassword);
  }

  async function handleRegisterSubmit() {
    try {
      setRegisterErr(null);
      const username = registerUsername.trim();
      if (!username) {
        setRegisterErr("아이디를 입력해 주세요.");
        return;
      }
      if (!registerPassword) {
        setRegisterErr("비밀번호를 입력해 주세요.");
        return;
      }
      if (registerPassword !== registerConfirm) {
        setRegisterErr("비밀번호가 서로 다릅니다.");
        return;
      }

      await authRegister(username, registerPassword);
      setRegisterOpen(false);
      setAuthUsername(username);
      await loginWithCredentials(username, registerPassword);
    } catch (e: any) {
      setRegisterErr(String(e?.message ?? e));
    }
  }

  async function handleClaimAdmin() {
    const key = adminKeyValue.trim();
    if (!key) {
      setAdminKeyErr("관리자 키를 입력해 주세요.");
      return;
    }

    try {
      setAdminKeyErr(null);
      setAdminKeyBusy(true);
      const user = await authClaimAdmin(key);
      setAuthUser(user);
      setAdminKeyOpen(false);
      setAdminKeyValue("");
    } catch (e: any) {
      setAdminKeyErr(String(e?.message ?? e));
    } finally {
      setAdminKeyBusy(false);
    }
  }

  const closeAdminKeyModal = () => {
    setAdminKeyOpen(false);
    setAdminKeyErr(null);
    setAdminKeyValue("");
  };

  async function handleLogout() {
    try {
      setAuthErr(null);
      await authLogout();
    } catch (e: any) {
      setAuthErr(String(e?.message ?? e));
    } finally {
      localStorage.removeItem(LS_AUTH_TOKEN);
      setAuthToken(null);
      setAuthUser(null);
      setEncounters([]);
      setEncounterId("");
      setState(null);
      setSessionSelected(false);
      setPresetView(false);
      setTagPresetView(false);
    }
  }

  async function handleCreateEncounter() {
    try {
      const name = window.prompt("새 전투 이름", "");
      if (name === null) return;
      const created = (await createEncounter(name)) as EncounterState;
      setState(created);
      setEncounterId(created.id);
      setSessionSelected(true);
      await loadEncounters(created.id);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    }
  }

  async function openEncounter(id: string) {
    setErr(null);
    setEncounterId(id);
    setSessionSelected(true);
  }

  async function startBattle() {
    if (!state) return;
    await run({ type: "BATTLE_START" });
  }

  // 최초 1회: localStorage에서 채널 값/최근 목록 불러오기

  function toggleMarkerCreate() {
    setMarkerDraftErr(null);
    setMarkerCreateOpen((prev) => !prev);
  }

  function clearMarkerSelection() {
    setMarkerSelectedCells([]);
  }

  function handleMarkerCellSelect(pos: Pos, opts?: { additive?: boolean }) {
    if (!markerCreateOpen) return;

    setMarkerSelectedCells((prev) => {
      const exists = prev.some((p) => p.x === pos.x && p.z === pos.z);
      const allowMulti = markerMultiSelect || !!opts?.additive;

      if (!allowMulti) return [pos];
      if (exists) return prev.filter((p) => p.x !== pos.x || p.z !== pos.z);
      return [...prev, pos];
    });
  }

  function buildMarkerId(name: string): string {
    const base = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    const suffix = Date.now().toString(36).slice(-4);
    return base ? `${base}_${suffix}` : `marker_${Date.now().toString(36)}`;
  }

  async function submitMarkerCreate() {
    if (busy) return;
    setMarkerDraftErr(null);

    const name = markerDraftName.trim();
    if (!name) {
      setMarkerDraftErr("?? ??? 저장.");
      return;
    }

    const alias = markerDraftAlias.trim();

    if (markerSelectedCells.length === 0) {
      setMarkerDraftErr("저장 ?? 저장.");
      return;
    }

    const durationRaw = markerDraftDuration.trim();
    let duration: number | undefined = undefined;

    if (durationRaw.length > 0) {
      const parsed = Math.trunc(Number(durationRaw));
      if (!Number.isFinite(parsed) || parsed <= 0) {
        setMarkerDraftErr("저장? 1 ??? 저장 ?.");
        return;
      }
      duration = parsed;
    }

    const markerId = buildMarkerId(name);
    const anchor = markerSelectedCells[0];
    const payload: any = {
      type: "UPSERT_MARKER",
      markerId,
      name,
      x: anchor.x,
      z: anchor.z,
    };

    if (alias) payload.alias = alias;
    if (markerSelectedCells.length > 1) payload.cells = markerSelectedCells;
    if (duration !== undefined) payload.duration = duration;

    await run(payload);
    setMarkerCreateOpen(false);
  }

  async function upsertMarkerFromPanel(payload: {
    markerId: string;
    name: string;
    alias?: string | null;
    x: number;
    z: number;
    duration?: number | null;
  }) {
    await run({ type: "UPSERT_MARKER", ...payload });
  }

  async function removeMarkerFromPanel(markerId: string) {
    await run({ type: "REMOVE_MARKER", markerId });
  }

  useEffect(() => {
    if (!markerCreateOpen) {
      setMarkerSelectedCells([]);
      setMarkerDraftName("");
      setMarkerDraftAlias("");
      setMarkerDraftDuration("");
      setMarkerDraftErr(null);
      setMarkerEmojiOpen(false);
    }
  }, [markerCreateOpen]);

  useEffect(() => {
    if (!markerEmojiOpen) return;
    // Close emoji popover when clicking outside the alias input area.
    const handleClick = (event: globalThis.MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (markerEmojiRef.current?.contains(target)) return;
      setMarkerEmojiOpen(false);
    };
    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [markerEmojiOpen]);

  useEffect(() => {
    if (!tagGrantOpen) {
      setTagGrantName("");
      setTagGrantType("toggle");
      setTagGrantStacks(1);
      setTagGrantDecStart(false);
      setTagGrantDecEnd(false);
      setTagGrantErr(null);
      setTagGrantPresets([]);
      setTagGrantPresetFolders([]);
      setTagGrantPresetId("");
      setTagGrantFolderFilter("ALL");
      setTagGrantPresetQuery("");
      setTagGrantFolderCollapsed({});
      setTagGrantPresetErr(null);
      setTagGrantPresetLoading(false);
    }
  }, [tagGrantOpen]);

  useEffect(() => {
    if (!tagGrantOpen) return;
    let cancelled = false;
    setTagGrantPresetLoading(true);
    setTagGrantPresetErr(null);
    listTagPresets()
      .then((res) => {
        if (cancelled) return;
        const data = res as {
          presets?: TagPreset[];
          folders?: TagPresetFolder[];
        };
        setTagGrantPresets(data.presets ?? []);
        setTagGrantPresetFolders(data.folders ?? []);
      })
      .catch((e) => {
        if (cancelled) return;
        setTagGrantPresetErr(String(e?.message ?? e));
      })
      .finally(() => {
        if (cancelled) return;
        setTagGrantPresetLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tagGrantOpen]);

  useEffect(() => {
    const savedDefault = localStorage.getItem(LS_DEFAULT_CHANNEL) ?? "";
    setChannelInput(savedDefault);

    const savedRecent = loadJson<string[]>(LS_RECENT_CHANNELS, []);
    setRecentChannels(Array.isArray(savedRecent) ? savedRecent : []);
  }, []);

  // channelInput이 바뀔 때마다(유효한 숫자면) 기본 채널로 저장
  useEffect(() => {
    if (!channelId) return;
    localStorage.setItem(LS_DEFAULT_CHANNEL, channelId);
  }, [channelId]);

  useEffect(() => {
    if (!settingsOpen) return;

    // 다음 tick에 포커스
    const t = window.setTimeout(() => channelInputRef.current?.focus(), 0);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSettingsOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [settingsOpen]);

  function pushRecent(chId: string) {
    setRecentChannels((prev) => {
      const cleaned = prev.filter((x) => x !== chId);
      const next = [chId, ...cleaned].slice(0, 5);
      saveJson(LS_RECENT_CHANNELS, next);
      return next;
    });
  }

  async function sendToDiscord() {
    try {
      setErr(null);
      if (!encounterId) {
        setErr("선택된 전투 세션이 없습니다.");
        return;
      }
      if (!channelId) {
        setErr("채널 ID를 입력해줘. (숫자 또는 <#...> 붙여넣기 가능)");
        return;
      }
      setBusy(true);
      await publish(encounterId, channelId, {
        hideBenchTeam: hideBenchTeamOnPublish,
        hideBenchEnemy: hideBenchEnemyOnPublish,
      });
      pushRecent(channelId);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  // ✅ ControlPanel hooks
  function normalizeTagName(raw: string) {
    return (raw ?? "").trim();
  }

  function normalizeStacks(v: unknown, fallback = 1, min = 1) {
    const n = Math.trunc(Number(v));
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, n);
  }

  function formatSpellSlotsSummary(
    slots: Record<string, number> | undefined
  ): string {
    if (!slots) return "";
    const levels = Object.keys(slots)
      .map((k) => Math.trunc(Number(k)))
      .filter((n) => Number.isFinite(n) && n >= 1 && n <= 9)
      .sort((a, b) => a - b);
    if (levels.length === 0) return "";

    const max = levels[levels.length - 1];
    const parts: string[] = [];
    for (let lvl = 1; lvl <= max; lvl++) {
      const raw = (slots as any)[lvl] ?? (slots as any)[String(lvl)];
      const n = Math.max(0, Math.trunc(Number(raw ?? 0)));
      parts.push(String(n));
    }
    return `[${parts.join("/")}]`;
  }

  function renderSlotSummary(summary: string) {
    if (!summary) return null;
    // Highlight numbers only; separators keep default color.
    const tokens = summary.match(/\d+|\D+/g) ?? [];
    return tokens.map((token, i) =>
      /^\d+$/.test(token) ? (
        <span key={`slot-num-${i}`} className="font-semibold text-sky-300">
          {token}
        </span>
      ) : (
        <span key={`slot-delim-${i}`}>{token}</span>
      )
    );
  }

  async function toggleHidden(unitId: string) {
    await run({ type: "TOGGLE_HIDDEN", unitId });
  }

  function renderLogLine(line: string) {
    // Bold the turn prefix ([... 턴]) while keeping the rest normal.
    const match = line.match(/^(\[[^\]]+\])\s*(.*)$/);
    if (!match) return line;
    const [, prefix, rest] = match;
    return (
      <>
        <span className="font-semibold">{prefix}</span>
        {rest ? ` ${rest}` : ""}
      </>
    );
  }

  async function applySpellSlotDelta(
    kind: "spend" | "recover",
    level: number,
    count: number
  ) {
    const safeLevel = Math.max(1, Math.min(9, Math.trunc(Number(level))));
    const safeCount = Number.isFinite(count)
      ? Math.max(1, Math.trunc(count))
      : 1;

    const targets = selectedIds.length
      ? selectedIds
      : selectedId
        ? [selectedId]
        : [];
    if (targets.length === 0) return;

    const results: Array<{
      label: string;
      status: "missing" | "empty" | "applied";
      before?: string;
      after?: string;
    }> = [];
    const actions: any[] = [];

    for (const unitId of targets) {
      const unit = units.find((u) => u.id === unitId);
      if (!unit) continue;

      const label = unit.alias ? `${unit.name} (${unit.alias})` : unit.name;
      const slots = unit.spellSlots ?? {};
      const raw =
        (slots as any)[safeLevel] ?? (slots as any)[String(safeLevel)];

      if (raw === undefined) {
        results.push({ label, status: "missing" });
        continue;
      }

      const currentCount = Math.max(0, Math.trunc(Number(raw)));
      if (kind === "spend" && currentCount < safeCount) {
        results.push({ label, status: "empty" });
        continue;
      }

      const nextCount =
        kind === "spend"
          ? Math.max(0, currentCount - safeCount)
          : currentCount + safeCount;
      const beforeSummary = formatSpellSlotsSummary(slots);
      const nextSlots = { ...slots, [safeLevel]: nextCount };
      const afterSummary = formatSpellSlotsSummary(nextSlots);

      for (let i = 0; i < safeCount; i += 1) {
        actions.push({
          type: kind === "spend" ? "SPEND_SPELL_SLOT" : "RECOVER_SPELL_SLOT",
          unitId,
          level: safeLevel,
        });
      }
      results.push({
        label,
        status: "applied",
        before: beforeSummary,
        after: afterSummary,
      });
    }

    if (actions.length > 0) await run(actions);
    setSlotUseNotice({ level: safeLevel, kind, rows: results });
  }

  function openTagGrantModal() {
    setTagGrantErr(null);
    setTagGrantOpen(true);
  }

  function closeTagGrantModal() {
    if (busy) return;
    setTagGrantOpen(false);
  }

  function applyTagPresetToGrant(presetOverride?: TagPreset) {
    const preset =
      presetOverride ??
      tagGrantPresets.find((p) => p.id === tagGrantPresetId);
    if (!preset) {
      setTagGrantErr("태그 프리셋을 선택해줘.");
      return;
    }
    setTagGrantErr(null);
    setTagGrantName(preset.name ?? "");
    setTagGrantType(preset.kind === "stack" ? "stack" : "toggle");
    setTagGrantStacks(1);
    setTagGrantDecStart(!!preset.decOnTurnStart);
    setTagGrantDecEnd(!!preset.decOnTurnEnd);
  }

  async function applyStatusTagGrant() {
    if (busy) return;
    const name = normalizeTagName(tagGrantName);
    if (!name) {
      setTagGrantErr("태그 이름을 입력해줘.");
      return;
    }

    const targets = selectedIds.length
      ? selectedIds
      : selectedId
        ? [selectedId]
        : [];

    if (targets.length === 0) {
      setTagGrantErr("선택된 유닛이 없어.");
      return;
    }

    setTagGrantErr(null);

    // 토글형: manual tag 추가 + 동일 키 stack 상태 제거.
    if (tagGrantType === "toggle") {
      const actions = targets.map((unitId) => ({
        type: "PATCH_UNIT",
        unitId,
        patch: {
          tags: { add: [name] },
          tagStates: { [name]: null },
        },
      }));
      await run(actions);
      setTagGrantOpen(false);
      return;
    }

    const stacks = normalizeStacks(tagGrantStacks, 1);
    const actions = targets.map((unitId) => {
      const unit = units.find((u) => u.id === unitId);
      const current = unit?.tagStates?.[name];
      const hasStack = !!current;
      const tagStatePatch = hasStack
        ? { stacks: { delta: stacks } }
        : {
            stacks,
            decOnTurnStart: tagGrantDecStart,
            decOnTurnEnd: tagGrantDecEnd,
          };

      return {
        type: "PATCH_UNIT",
        unitId,
        patch: {
          // Stack tag wins over manual tag when adding.
          tags: { remove: [name] },
          tagStates: {
            [name]: tagStatePatch,
          },
        },
      };
    });
    await run(actions);
    setTagGrantOpen(false);
  }
  function moveByPad(dx: number, dz: number) {
    const targets =
      selectedIds.length > 0 ? selectedIds : selectedId ? [selectedId] : [];

    if (targets.length === 0) return;

    // 다중 선택이면 MOVE_UNIT을 배열로 한 번에 전송
    if (targets.length > 1) {
      const actions = targets.map((unitId) => ({
        type: "MOVE_UNIT",
        unitId,
        dx,
        dz,
      }));
      run(actions);
      return;
    }

    // 단일 선택이면 기존처럼 1개 액션
    run({ type: "MOVE_UNIT", unitId: targets[0], dx, dz });
  }

  async function applyPanelAction(mode: ControlActionMode) {
    if (mode === "NEXT_TURN") {
      await run({ type: "NEXT_TURN" });
      return;
    }

    if (mode === "ADD_TAG") {
      openTagGrantModal();
      return;
    }

    if (mode === "REMOVE_TAG") {
      const unitId = selectedId;
      if (!unitId) return;
      const entry = panelTagReduceSelected;
      if (!entry) return;
      if (entry.kind === "toggle") {
        await run({
          type: "PATCH_UNIT",
          unitId,
          patch: {
            tags: { remove: [entry.name] },
            tagStates: { [entry.name]: null },
          },
        });
        return;
      }
      const deltaRaw = Math.max(1, Math.trunc(Number(amount)));
      if (!Number.isFinite(deltaRaw) || deltaRaw <= 0) return;
      const delta =
        typeof entry.stacks === "number"
          ? Math.min(deltaRaw, entry.stacks)
          : deltaRaw;
      await run({
        type: "PATCH_UNIT",
        unitId,
        patch: {
          tags: { remove: [entry.name] },
          tagStates: { [entry.name]: { stacks: { delta: -delta } } },
        },
      });
      return;
    }

    if (mode === "ADD_DEATH_FAIL") {
      const targets = selectedIds.length
        ? selectedIds
        : selectedId
          ? [selectedId]
          : [];
      if (targets.length === 0) return;

      const actions = targets.map((unitId) => ({
        type: "EDIT_DEATH_SAVES",
        unitId,
        deltaFailure: 1,
      }));
      await run(actions);
      return;
    }

    if (mode === "TOGGLE_HIDDEN") {
      const targets = selectedIds.length
        ? selectedIds
        : selectedId
          ? [selectedId]
          : [];
      if (targets.length === 0) return;

      const actions = targets.map((unitId) => ({
        type: "TOGGLE_HIDDEN",
        unitId,
      }));
      await run(actions);
      return;
    }

    if (mode === "ASSIGN_IDENTIFIER") {
      const targets = selectedIds.length
        ? selectedIds
        : selectedId
          ? [selectedId]
          : [];
      if (targets.length === 0) return;
      const scheme = panelIdentifierScheme || IDENTIFIER_SCHEME_OPTIONS[0].id;
      await run({ type: "ASSIGN_IDENTIFIER", unitIds: targets, scheme });
      return;
    }

    if (mode === "SPELL_SLOT") {
      await applySpellSlotDelta(panelSlotDelta, panelSlotLevel, amount);
      return;
    }

    if (mode === "CONSUMABLE") {
      const unitId = selectedId;
      if (!unitId) return;
      const unit = units.find((u) => u.id === unitId);
      if (!unit) return;
      const name = panelConsumableName;
      if (!name) return;
      const current = unit.consumables?.[name];
      if (typeof current !== "number") return;
      if (!Number.isFinite(amount) || amount === 0) return;
      const delta = panelConsumableDelta === "inc" ? amount : -amount;
      const nextValue = Math.max(0, current + delta);
      await run({
        type: "PATCH_UNIT",
        unitId,
        patch: { consumables: { [name]: nextValue } },
      });
      return;
    }

    const targets = selectedIds.length
      ? selectedIds
      : selectedId
        ? [selectedId]
        : [];
    if (targets.length === 0) return;

    if (mode === "TEMP_HP") {
      // selectedIds가 있으면 그걸 쓰고, 없으면 selectedId 하나만
      const targets = selectedIds?.length
        ? selectedIds
        : selectedId
          ? [selectedId]
          : [];
      if (!targets.length) return;

      await run(
        targets.map((unitId) => ({
          type: "SET_TEMP_HP",
          unitId,
          temp: amount,
          mode: "normal",
        }))
      );
      return;
    }

    const type = mode === "DAMAGE" ? "APPLY_DAMAGE" : "HEAL";

    // 선택된 모든 유닛에 대해 액션 배열 생성 → postAction에 한 번에 전달
    const actions = targets.map((unitId) => ({
      type,
      unitId,
      amount,
    }));

    await run(actions);
  }

  async function applyTurnOrderReorder(
    turnOrder: TurnEntry[],
    turnGroups: TurnGroup[],
    disabledChanges: { unitId: string; turnDisabled: boolean }[]
  ) {
    const patchActions = (disabledChanges ?? []).map((change) => ({
      type: "PATCH_UNIT",
      unitId: change.unitId,
      patch: { turnDisabled: change.turnDisabled },
    }));

    const actions: any[] = [];
    if (Array.isArray(turnOrder)) {
      actions.push({
        type: "SET_TURN_ORDER",
        turnOrder,
        turnGroups: Array.isArray(turnGroups) ? turnGroups : [],
      });
    }
    actions.push(...patchActions);

    if (actions.length === 0) return false;
    await run(actions.length === 1 ? actions[0] : actions);
    return true;
  }

  useEffect(() => {
    if (!authUser || !encounterId || !sessionSelected) return;
    refresh().catch((e) => setErr(String(e?.message ?? e)));
  }, [authUser, encounterId, sessionSelected]);

  // ✅ 동적 view 범위 계산
  const view = useMemo(() => {
    return computeAutoView(activeUnits, markers, {
      padX: 2,
      padZ: 1,
      minCols: 9,
      minRows: 3,
    });
  }, [activeUnits, markers]);

  // ---------- Unit helpers ----------
  async function createUnit(payload: CreateUnitPayload) {
    await run({ type: "CREATE_UNIT", ...payload });
  }

  async function createUnitFromPreset(
    payload: CreateUnitPayload,
    patch?: UnitPatch | null,
    deathSaves?: { success: number; failure: number }
  ) {
    if (!payload.unitId) {
      throw new Error("preset create requires unitId");
    }
    const actions: any[] = [{ type: "CREATE_UNIT", ...payload }];
    if (patch && Object.keys(patch).length > 0) {
      actions.push({ type: "PATCH_UNIT", unitId: payload.unitId, patch });
    }
    if (
      deathSaves &&
      (deathSaves.success > 0 || deathSaves.failure > 0)
    ) {
      actions.push({
        type: "EDIT_DEATH_SAVES",
        unitId: payload.unitId,
        success: deathSaves.success,
        failure: deathSaves.failure,
      });
    }
    await run(actions.length === 1 ? actions[0] : actions);
  }

  async function removeUnit(unitId: string) {
    await run({ type: "REMOVE_UNIT", unitId });
  }

  async function patchUnit(unitId: string, patch: UnitPatch) {
    await run({ type: "PATCH_UNIT", unitId, patch });
  }

  async function editDeathSaves(
    unitId: string,
    success: number,
    failure: number
  ) {
    await run({ type: "EDIT_DEATH_SAVES", unitId, success, failure });
  }

  async function reorderUnits(payload: {
    unitIds: string[];
    sideChanges?: { unitId: string; side: Side }[];
    benchChanges?: { unitId: string; bench: "TEAM" | "ENEMY" | null }[];
  }) {
    const ids = Array.isArray(payload.unitIds)
      ? payload.unitIds.filter((id) => typeof id === "string")
      : [];
    const sideChanges = Array.isArray(payload.sideChanges)
      ? payload.sideChanges.filter((c) => c && typeof c.unitId === "string")
      : [];
    const benchChanges = Array.isArray(payload.benchChanges)
      ? payload.benchChanges.filter((c) => c && typeof c.unitId === "string")
      : [];
    if (
      ids.length === 0 &&
      sideChanges.length === 0 &&
      benchChanges.length === 0
    )
      return;

    const actions: any[] = [];
    for (const change of benchChanges) {
      actions.push({
        type: "SET_UNIT_BENCH",
        unitId: change.unitId,
        bench: change.bench,
      });
    }
    for (const change of sideChanges) {
      actions.push({
        type: "PATCH_UNIT",
        unitId: change.unitId,
        patch: { side: change.side },
      });
    }
    if (ids.length > 0) {
      actions.push({ type: "SET_UNIT_LIST_ORDER", unitIds: ids });
    }
    await run(actions);
  }

  async function setUnitPos(unitId: string, x: number, z: number) {
    await run({ type: "SET_UNIT_POS", unitId, x, z });
  }

  function selectUnit(unitId: string, opts?: { additive?: boolean }) {
    const additive = !!opts?.additive;

    setSelectedIds((prev) => {
      let next: string[];
      if (!additive) {
        next = [unitId];
      } else {
        const has = prev.includes(unitId);
        next = has ? prev.filter((x) => x !== unitId) : [...prev, unitId];
      }

      // primary(대표) 선택 갱신 규칙:
      // - 단일선택이면 무조건 unitId
      // - additive면 "클릭한 애가 next에 남아있으면 그걸 primary"
      //   빠졌으면 기존 primary 유지 시도 -> 없으면 next 마지막
      setSelectedId((cur) => {
        if (next.length === 0) return null;
        if (!additive) return unitId;
        if (next.includes(unitId)) return unitId;
        if (cur && next.includes(cur)) return cur;
        return next[next.length - 1];
      });

      return next;
    });
  }

  async function grantTempTurn() {
    if (!selectedId) return; // 선택된 유닛 없으면 아무것도 안 함
    await run({ type: "GRANT_TEMP_TURN", unitId: selectedId });
  }

  // Screen flow: login -> session list / presets -> operator UI.
  if (!authUser) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <div className="flex min-h-screen items-center justify-center p-4">
          <div className="w-[min(420px,92vw)] rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
            <div className="text-xl font-semibold">Operator UI</div>
            <div className="mt-1 text-xs text-zinc-400">
              Login or register to continue
            </div>

            {authErr ? (
              <div className="mt-3 rounded-lg border border-red-900 bg-red-950/40 p-2 text-xs text-red-200">
                {authErr}
              </div>
            ) : null}

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs text-zinc-400">
                  Username
                </label>
                <input
                  value={authUsername}
                  onChange={(e) => setAuthUsername(e.target.value)}
                  placeholder="username"
                  className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-zinc-600"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-400">
                  Password
                </label>
                <input
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="password"
                  className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-zinc-600"
                />
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-lg bg-amber-700 px-3 py-2 text-sm text-white hover:bg-amber-600 disabled:opacity-50"
                onClick={handleLogin}
                disabled={busy}
              >
                Login
              </button>
              <button
                type="button"
                className="flex-1 rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800/60 disabled:opacity-50"
                onClick={() => setRegisterOpen(true)}
                disabled={busy}
              >
                Register
              </button>
            </div>
          </div>
        </div>

        {/* Register modal */}
        {registerOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            role="dialog"
            aria-modal="true"
            aria-label="Register modal"
          >
            <div
              className="absolute inset-0 bg-black/35 backdrop-blur-[2px]"
              onClick={() => setRegisterOpen(false)}
              role="button"
              aria-label="Close overlay"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && setRegisterOpen(false)}
            />
            <div className="relative z-10 w-[min(420px,92vw)] rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl">
              <div className="mb-3 text-base font-semibold text-zinc-100">
                회원가입
              </div>

              {registerErr ? (
                <div className="mb-3 rounded-lg border border-red-900 bg-red-950/40 p-2 text-xs text-red-200">
                  {registerErr}
                </div>
              ) : null}

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs text-zinc-400">
                    아이디
                  </label>
                  <input
                    value={registerUsername}
                    onChange={(e) => setRegisterUsername(e.target.value)}
                    placeholder="username"
                    className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-zinc-600"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-400">
                    비밀번호
                  </label>
                  <input
                    type="password"
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    placeholder="password"
                    className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-zinc-600"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-400">
                    비밀번호 확인
                  </label>
                  <input
                    type="password"
                    value={registerConfirm}
                    onChange={(e) => setRegisterConfirm(e.target.value)}
                    placeholder="password"
                    className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-zinc-600"
                  />
                </div>
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800/60"
                  onClick={() => setRegisterOpen(false)}
                  disabled={busy}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-amber-700 px-3 py-2 text-sm text-white hover:bg-amber-600 disabled:opacity-50"
                  onClick={handleRegisterSubmit}
                  disabled={busy}
                >
                  등록
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  function openMemoView(unitId: string) {
    setMemoViewId(unitId);
  }

  function showMemoCopyToast() {
    if (memoCopyTimerRef.current) {
      window.clearTimeout(memoCopyTimerRef.current);
    }
    setMemoCopyToast(true);
    memoCopyTimerRef.current = window.setTimeout(() => {
      setMemoCopyToast(false);
      memoCopyTimerRef.current = null;
    }, 1400);
  }

  function openBoardMenu(e: ReactMouseEvent, unitId: string) {
    e.preventDefault();
    e.stopPropagation();
    setBoardMenu({ id: unitId, x: e.clientX, y: e.clientY });
  }

  function openSideMemo() {
    const notes = (state as any)?.sideNotes ?? {};
    sideMemoDraftsRef.current = {
      TEAM: ansiToHtml(notes.TEAM ?? ""),
      ENEMY: ansiToHtml(notes.ENEMY ?? ""),
      NEUTRAL: ansiToHtml(notes.NEUTRAL ?? ""),
    };
    setSideMemoTab("TEAM");
    setSideMemoOpen(true);
  }

  function updateSideMemo(side: Side, value: string) {
    sideMemoDraftsRef.current[side] = value;
  }

  function syncSideMemoHtml(side: Side) {
    const el = sideMemoRefs.current[side];
    if (!el) return;
    updateSideMemo(side, el.innerHTML);
  }

  function execSideMemoCommand(
    side: Side,
    command: "bold" | "foreColor" | "removeFormat",
    value?: string
  ) {
    const el = sideMemoRefs.current[side];
    if (!el) return;
    el.focus();
    document.execCommand(command, false, value);
    syncSideMemoHtml(side);
  }

  function applySideMemoBold(side: Side) {
    execSideMemoCommand(side, "bold");
  }

  function applySideMemoColor(side: Side, code: number) {
    const css = ansiColorCodeToCss(code);
    if (!css) return;
    execSideMemoCommand(side, "foreColor", css);
  }

  function clearSideMemoFormat(side: Side) {
    execSideMemoCommand(side, "removeFormat");
  }

  async function saveSideNotes() {
    syncSideMemoHtml(sideMemoTab);
    if (!encounterId) {
      setErr("선택된 전투 세션이 없습니다.");
      return;
    }
    const notes: Partial<Record<Side, string | null>> = {};
    const sides: Side[] = ["TEAM", "ENEMY", "NEUTRAL"];
    for (const side of sides) {
      const html = sideMemoDraftsRef.current[side] ?? "";
      const segments = extractSegmentsFromHtml(html);
      const plain = segments.map((seg) => seg.text).join("");
      if (!plain.trim()) {
        notes[side] = null;
        continue;
      }
      notes[side] = segmentsToAnsi(segments);
    }

    try {
      setErr(null);
      setBusy(true);
      const next = (await postAction(encounterId, {
        type: "SET_SIDE_NOTES",
        notes,
      })) as EncounterState;
      setState(next);

      const firstId = next?.units?.[0]?.id ?? null;

      if (!selectedId) {
        if (firstId) setSelectedId(firstId);
      } else {
        const exists = (next?.units ?? []).some((u) => u.id === selectedId);
        if (!exists) setSelectedId(firstId);
      }

      setSideMemoOpen(false);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  if (presetView) {
    return (
      <UnitPresetManager
        authUser={authUser}
        onBack={() => setPresetView(false)}
      />
    );
  }

  if (tagPresetView) {
    return (
      <TagPresetManager
        authUser={authUser}
        onBack={() => setTagPresetView(false)}
      />
    );
  }

  if (goldItemsView) {
    return (
      <GoldItemsManager
        authUser={authUser}
        onBack={() => setGoldItemsView(false)}
      />
    );
  }

  if (!sessionSelected || !encounterId) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <div className="mx-auto max-w-3xl p-4">
          <header className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-xl font-semibold">Operator UI</div>
              <div className="text-xs text-zinc-400">Active sessions</div>
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-300">
              <span>{authUser.username}</span>
              {authUser.isAdmin ? (
                <span className="rounded-md border border-amber-500/60 bg-amber-950/40 px-1.5 py-0.5 text-[10px] font-semibold text-amber-200">
                  관리자
                </span>
              ) : null}
              <button
                type="button"
                className="rounded-md border border-zinc-800 px-2 py-1 text-xs text-zinc-200 hover:border-zinc-600"
                onClick={handleLogout}
                disabled={busy}
              >
                Logout
              </button>
            </div>
          </header>

          {err && (
            <div className="mb-4 whitespace-pre-line rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-200">
              {err}
            </div>
          )}

          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-zinc-200">
                Session list
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-emerald-700/60 bg-emerald-950/30 px-3 py-1.5 text-xs text-emerald-200 hover:bg-emerald-900/40"
                  onClick={() => {
                    setTagPresetView(false);
                    setPresetView(true);
                  }}
                  disabled={busy}
                >
                  유닛 프리셋 관리
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-sky-700/60 bg-sky-950/30 px-3 py-1.5 text-xs text-sky-200 hover:bg-sky-900/40"
                  onClick={() => {
                    setPresetView(false);
                    setTagPresetView(true);
                  }}
                  disabled={busy}
                >
                  태그 프리셋 관리
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-amber-700/60 bg-amber-950/30 px-3 py-1.5 text-xs text-amber-200 hover:bg-amber-900/40"
                  onClick={() => {
                    setPresetView(false);
                    setTagPresetView(false);
                    setGoldItemsView(true);
                  }}
                  disabled={busy}
                >
                  골드/아이템 관리
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800/60"
                  onClick={() => loadEncounters()}
                  disabled={busy}
                >
                  Refresh
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-amber-700 px-3 py-1.5 text-xs text-white hover:bg-amber-600 disabled:opacity-50"
                  onClick={handleCreateEncounter}
                  disabled={busy}
                >
                  New
                </button>
              </div>
            </div>

            {encounters.length === 0 ? (
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4 text-sm text-zinc-500">
                No active sessions yet.
              </div>
            ) : (
              <div className="space-y-2">
                {encounters.map((enc) => {
                  const isLastUsed = enc.id === encounterId;
                  const updated = enc.updatedAt
                    ? new Date(enc.updatedAt).toLocaleString()
                    : null;
                  return (
                    <div
                      key={enc.id}
                      className={[
                        "flex items-center justify-between rounded-lg border px-3 py-2",
                        "bg-zinc-950/40",
                        isLastUsed
                          ? "border-amber-700/70"
                          : "border-zinc-800",
                      ].join(" ")}
                    >
                      <div>
                        <div className="text-sm font-semibold text-zinc-100">
                          {enc.name || enc.id}
                        </div>
                        <div className="text-[11px] text-zinc-500">
                          {enc.id}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-zinc-400">
                        {updated ? <span>{updated}</span> : null}
                        <button
                          type="button"
                          className="rounded-md border border-zinc-800 px-2 py-1 text-xs text-zinc-200 hover:border-zinc-600"
                          onClick={() => openEncounter(enc.id)}
                          disabled={busy}
                        >
                          Open
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {adminKeyOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            role="dialog"
            aria-modal="true"
            aria-label="Admin key modal"
          >
            <div
              className="absolute inset-0 bg-black/35 backdrop-blur-[2px]"
              onClick={closeAdminKeyModal}
              role="button"
              aria-label="Close overlay"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && closeAdminKeyModal()}
            />
            <div className="relative z-10 w-[min(420px,92vw)] rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl">
              <div className="mb-3 text-base font-semibold text-zinc-100">
                관리자 전환
              </div>

              {adminKeyErr ? (
                <div className="mb-3 rounded-lg border border-red-900 bg-red-950/40 p-2 text-xs text-red-200">
                  {adminKeyErr}
                </div>
              ) : null}

              <div>
                <label className="mb-1 block text-xs text-zinc-400">
                  관리자 키
                </label>
                <input
                  autoFocus
                  type="password"
                  value={adminKeyValue}
                  onChange={(e) => setAdminKeyValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleClaimAdmin()}
                  placeholder="admin key"
                  className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-zinc-600"
                />
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeAdminKeyModal}
                  className="rounded-lg border border-zinc-800 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-800/60"
                  disabled={adminKeyBusy}
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleClaimAdmin}
                  className="rounded-lg bg-amber-700 px-3 py-2 text-xs text-white hover:bg-amber-600 disabled:opacity-50"
                  disabled={adminKeyBusy}
                >
                  승격
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-6xl p-4">
        <header className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-xl font-semibold">Operator UI by MING</div>
            <div className="text-sm text-zinc-400">
              {activeEncounter
                ? `encounter: ${activeEncounter.name || activeEncounter.id}`
                : `encounter: ${encounterId}`}
              {activeEncounter ? (
                <span className="ml-2 text-zinc-500">{activeEncounter.id}</span>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2 text-xs text-zinc-300">
              <span>{authUser.username}</span>
              <button
                type="button"
                className="rounded-md border border-zinc-800 px-2 py-1 text-xs text-zinc-200 hover:border-zinc-600"
                onClick={() => setSessionSelected(false)}
                disabled={busy}
              >
                Sessions
              </button>
              <button
                type="button"
                className="rounded-md border border-zinc-800 px-2 py-1 text-xs text-zinc-200 hover:border-zinc-600"
                onClick={handleLogout}
                disabled={busy}
              >
                Logout
              </button>
            </div>

            <div className="flex gap-2">
              <button
                className="rounded-lg bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700 disabled:opacity-50"
                onClick={() => undoLast()}
                disabled={busy || !encounterId}
              >
                Undo
              </button>
              <button
                className="rounded-lg bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700 disabled:opacity-50"
                onClick={() => refresh()}
                disabled={busy || !encounterId}
              >
                Refresh
              </button>

            {/* ✅ Split Button: Send + Settings (붙어있지만 클릭 영역 분리) */}
            <div
              className={[
                "inline-flex overflow-hidden rounded-lg border border-emerald-800/60",
                "bg-emerald-700 shadow-sm",
              ].join(" ")}
            >
              {/* left: send */}
              <button
                type="button"
                onClick={sendToDiscord}
                disabled={busy || !channelId || !encounterId}
                title={
                  !channelId
                    ? "채널 ID를 먼저 입력"
                    : "전투 상태를 디스코드로 전송"
                }
                className={[
                  "px-3 py-2 text-sm text-white",
                  "hover:bg-emerald-600 active:bg-emerald-700/90",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                ].join(" ")}
              >
                Send to Discord
              </button>

              {/* divider */}
              <div className="w-px bg-emerald-200/20" />

              {/* right: settings */}
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                disabled={busy}
                title="Discord 설정"
                aria-label="Discord settings"
                className={[
                  "px-2 py-2 text-white",
                  "hover:bg-emerald-600 active:bg-emerald-700/90",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                ].join(" ")}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.607 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </button>
            </div>
            </div>
          </div>
        </header>

        {err && (
          <div className="mb-4 whitespace-pre-line rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-200">
            {err}
          </div>
        )}

        {/* ✅ Board */}
        <div className="mb-4">
          <TurnOrderBar
            units={units}
            markers={markers}
            turnOrder={(state as any)?.turnOrder ?? []}
            turnGroups={(state as any)?.turnGroups ?? []}
            turnOrderIndex={(state as any)?.turnIndex ?? 0}
            round={(state as any)?.round ?? 1}
            battleStarted={battleStarted}
            busy={busy}
            onReorder={() => setReorderOpen(true)}
            onNextTurn={() => applyPanelAction("NEXT_TURN")}
            onBattleStart={startBattle}
            canTempTurn={!!selectedId}
            onTempTurn={grantTempTurn}
            tempTurnStack={(state as any)?.tempTurnStack ?? []}
          />

          <div className="mb-2 text-xs text-zinc-500">
            auto view: x [{view.minX}..{view.maxX}] / z [{view.minZ}..
            {view.maxZ}]
            <span className="ml-2 text-zinc-600">
              (셀 폭은 고정, 그리드 전체를 스크롤)
            </span>
          </div>

          <Board
            units={activeUnits}
            markers={markers}
            view={view}
            selectedId={selectedId}
            selectedIds={selectedIds}
            onSelectUnit={selectUnit}
            onOpenUnitMenu={openBoardMenu}
            onOpenSideMemo={openSideMemo}
            sideMemoActive={sideMemoOpen}
            markerSelectActive={markerCreateOpen}
            selectedMarkerCells={markerSelectedCells}
            onSelectCell={handleMarkerCellSelect}
            onToggleMarkerCreate={toggleMarkerCreate}
            markerCreateActive={markerCreateOpen}
            maxHeightPx={520}
          />

          {markerCreateOpen && (
            <div className="mt-3 rounded-xl border border-amber-900/40 bg-amber-950/10 p-3">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-amber-100">
                    마커 생성
                  </div>
                  <div className="text-xs text-zinc-500">
                    보드에서 셀을 선택한 뒤 이름/지속시간을 입력해줘.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMarkerCreateOpen(false)}
                  disabled={busy}
                  className="rounded-lg border border-zinc-800 bg-zinc-950/30 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800/60 disabled:opacity-50"
                >
                  닫기
                </button>
              </div>

              {markerDraftErr && (
                <div className="mb-2 rounded-lg border border-rose-900/60 bg-rose-950/30 px-3 py-2 text-xs text-rose-200">
                  {markerDraftErr}
                </div>
              )}

              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs text-zinc-400">
                    마커 이름
                  </label>
                  <input
                    value={markerDraftName}
                    onChange={(e) => setMarkerDraftName(e.target.value)}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600"
                    disabled={busy}
                    placeholder="예: 화염 지대"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs text-zinc-400">
                    별명
                  </label>
                  <div className="relative" ref={markerEmojiRef}>
                    <div className="flex items-center gap-2">
                      <input
                        value={markerDraftAlias}
                        onChange={(e) => setMarkerDraftAlias(e.target.value)}
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600"
                        disabled={busy}
                        placeholder="예: 🔥"
                      />
                      <button
                        type="button"
                        onClick={() => setMarkerEmojiOpen((prev) => !prev)}
                        disabled={busy}
                        className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-2 py-2 text-sm text-zinc-200 hover:bg-zinc-800/60 disabled:opacity-50"
                        aria-label="이모지 선택"
                        title="이모지 선택"
                      >
                        🙂
                      </button>
                    </div>

                    {markerEmojiOpen && (
                      <div className="absolute right-0 top-full z-20 mt-2 w-40 rounded-lg border border-zinc-800 bg-zinc-950 p-2 shadow-lg">
                        <div className="grid grid-cols-3 gap-2 text-lg">
                          {markerEmojiList.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              className="rounded-md border border-transparent px-1 py-1 hover:border-zinc-700 hover:bg-zinc-800/60"
                              onClick={() => {
                                setMarkerDraftAlias((prev) =>
                                  prev ? `${prev}${emoji}` : emoji
                                );
                                setMarkerEmojiOpen(false);
                              }}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs text-zinc-400">
                    지속시간
                  </label>
                  <input
                    value={markerDraftDuration}
                    onChange={(e) => setMarkerDraftDuration(e.target.value)}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    step={1}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600"
                    disabled={busy}
                    placeholder="영구"
                  />
                </div>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={markerMultiSelect}
                    onChange={(e) => setMarkerMultiSelect(e.target.checked)}
                    disabled={busy}
                  />
                  다중 선택
                </label>
                <span>선택된 셀: {markerSelectedCells.length}</span>
                <button
                  type="button"
                  onClick={clearMarkerSelection}
                  disabled={busy || markerSelectedCells.length === 0}
                  className="rounded-md border border-zinc-800 bg-zinc-950/30 px-2 py-1 text-[11px] text-zinc-200 hover:bg-zinc-800/60 disabled:opacity-50"
                >
                  선택 초기화
                </button>
              </div>

              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={submitMarkerCreate}
                  disabled={busy}
                  className="rounded-lg bg-amber-700 px-3 py-2 text-sm text-white hover:bg-amber-600 disabled:opacity-50"
                >
                  생성
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ✅ Discord Settings Modal */}
        {settingsOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            role="dialog"
            aria-modal="true"
            aria-label="Discord settings modal"
          >
            {/* overlay */}
            <div
              className="absolute inset-0 bg-black/15 backdrop-blur-[2px]"
              onClick={() => setSettingsOpen(false)}
              role="button"
              aria-label="Close overlay"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && setSettingsOpen(false)}
            />

            {/* modal panel */}
            <div className="relative z-10 w-[min(520px,92vw)] rounded-2xl border border-zinc-800 bg-zinc-950 p-4 shadow-2xl">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <div className="text-base font-semibold text-zinc-100">
                    Discord Settings
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    using:{" "}
                    <span className="text-zinc-200">{channelId || "-"}</span>
                    <span className="ml-2 text-zinc-600">(자동 저장)</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSettingsOpen(false)}
                  className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800/60"
                >
                  Close
                </button>
              </div>

              <label className="mb-1 block text-xs text-zinc-400">
                Channel ID (숫자 또는 &lt;#...&gt; 붙여넣기)
              </label>
              <input
                ref={channelInputRef}
                value={channelInput}
                onChange={(e) => setChannelInput(e.target.value)}
                placeholder="123456789012345678"
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600"
              />

              <div className="mt-3 flex items-center justify-between gap-2">
                <div className="text-xs text-zinc-500">
                  sanitized:{" "}
                  <span className="text-zinc-200">{channelId || "-"}</span>
                </div>

                {recentChannels.length > 0 && (
                  <select
                    className="rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-2 text-xs text-zinc-200 outline-none"
                    value=""
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v) setChannelInput(v);
                    }}
                    disabled={busy}
                    title="최근 사용 채널"
                  >
                    <option value="" disabled>
                      최근 채널 선택
                    </option>
                    {recentChannels.map((ch) => (
                      <option key={ch} value={ch}>
                        {ch}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-lg bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700"
                  onClick={() => setSettingsOpen(false)}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {tagGrantOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            role="dialog"
            aria-modal="true"
            aria-label="Status tag grant modal"
          >
            {/* overlay */}
            <div
              className="absolute inset-0 bg-black/25"
              onClick={busy ? undefined : closeTagGrantModal}
              role="button"
              aria-label="Close overlay"
              tabIndex={0}
              onKeyDown={(e) =>
                e.key === "Enter" && !busy && closeTagGrantModal()
              }
            />

            <div className="relative z-10 w-[min(560px,92vw)] rounded-2xl border border-zinc-800 bg-zinc-950 p-4 shadow-2xl">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <div className="text-base font-semibold text-zinc-100">
                    상태 부여
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    선택된 유닛:{" "}
                    <span className="text-zinc-200">
                      {tagGrantTargetCount}명
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeTagGrantModal}
                  disabled={busy}
                  className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800/60 disabled:opacity-50"
                >
                  닫기
                </button>
              </div>

              {tagGrantErr && (
                <div className="mb-2 rounded-lg border border-rose-900/60 bg-rose-950/30 px-3 py-2 text-xs text-rose-200">
                  {tagGrantErr}
                </div>
              )}

              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-zinc-400">
                    태그 이름
                  </label>
                  <input
                    value={tagGrantName}
                    onChange={(e) => setTagGrantName(e.target.value)}
                    disabled={busy}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600"
                    placeholder="예: 중독"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-400">
                    타입
                  </label>
                  <select
                    value={tagGrantType}
                    onChange={(e) =>
                      setTagGrantType(e.target.value as "toggle" | "stack")
                    }
                    disabled={busy}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600"
                  >
                    <option value="toggle">토글형</option>
                    <option value="stack">스택형</option>
                  </select>
                </div>
              </div>

              {tagGrantType === "stack" && (
                <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs text-zinc-400">
                      스택
                    </label>
                    <input
                      type="number"
                      value={String(tagGrantStacks)}
                      onChange={(e) =>
                        setTagGrantStacks(normalizeStacks(e.target.value, 1))
                      }
                      disabled={busy}
                      min={1}
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-xs text-zinc-300">
                    <input
                      type="checkbox"
                      checked={tagGrantDecStart}
                      onChange={(e) => setTagGrantDecStart(e.target.checked)}
                      disabled={busy}
                    />
                    턴 시작 시 감소
                  </label>
                  <label className="flex items-center gap-2 text-xs text-zinc-300">
                    <input
                      type="checkbox"
                      checked={tagGrantDecEnd}
                      onChange={(e) => setTagGrantDecEnd(e.target.checked)}
                      disabled={busy}
                    />
                    턴 종료 시 감소
                  </label>
                </div>
              )}

              <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
                <div className="mb-2 text-xs font-semibold text-zinc-300">
                  태그 프리셋
                </div>
                {tagGrantPresetErr && (
                  <div className="mb-2 rounded-md border border-rose-900/60 bg-rose-950/30 px-2 py-1 text-[11px] text-rose-200">
                    {tagGrantPresetErr}
                  </div>
                )}
                <div className="grid grid-cols-1 gap-2 md:grid-cols-[160px_minmax(0,1fr)]">
                  <div className="rounded-md border border-zinc-800 bg-zinc-950/30 p-2">
                    <div className="text-[11px] font-semibold text-zinc-200">
                      폴더
                    </div>
                    <div className="mt-2 max-h-40 space-y-1 overflow-auto pr-1">
                      <button
                        type="button"
                        className={[
                          "w-full rounded-md border px-2 py-1 text-left text-[11px]",
                          tagGrantFolderFilter === "ALL"
                            ? "border-amber-700/70 bg-amber-950/30 text-amber-100"
                            : "border-zinc-800 bg-zinc-950/30 text-zinc-400 hover:text-zinc-200",
                        ].join(" ")}
                        onClick={() => setTagGrantFolderFilter("ALL")}
                        disabled={tagGrantPresetLoading || busy}
                      >
                        전체
                      </button>
                      <button
                        type="button"
                        className={[
                          "w-full rounded-md border px-2 py-1 text-left text-[11px]",
                          tagGrantFolderFilter === "NONE"
                            ? "border-amber-700/70 bg-amber-950/30 text-amber-100"
                            : "border-zinc-800 bg-zinc-950/30 text-zinc-400 hover:text-zinc-200",
                        ].join(" ")}
                        onClick={() => setTagGrantFolderFilter("NONE")}
                        disabled={tagGrantPresetLoading || busy}
                      >
                        폴더 없음
                      </button>
                      {tagGrantFolderTree.map(
                        ({ folder, depth, hasChildren, collapsed }) => (
                        <button
                          key={folder.id}
                          type="button"
                          className={[
                            "flex w-full items-center gap-1 rounded-md border px-2 py-1 text-left text-[11px]",
                            tagGrantFolderFilter === folder.id
                              ? "border-amber-700/70 bg-amber-950/30 text-amber-100"
                              : "border-zinc-800 bg-zinc-950/30 text-zinc-400 hover:text-zinc-200",
                          ].join(" ")}
                          style={{ paddingLeft: `${8 + depth * 10}px` }}
                          onClick={() => setTagGrantFolderFilter(folder.id)}
                          disabled={tagGrantPresetLoading || busy}
                        >
                          {hasChildren ? (
                            <span
                              role="button"
                              tabIndex={0}
                              className="rounded border border-zinc-700 px-1 text-[10px] text-zinc-300 hover:text-zinc-100"
                              onClick={(e) => {
                                e.stopPropagation();
                                setTagGrantFolderCollapsed((prev) => ({
                                  ...prev,
                                  [folder.id]: !collapsed,
                                }));
                              }}
                              onKeyDown={(e) => {
                                if (e.key !== "Enter") return;
                                e.stopPropagation();
                                setTagGrantFolderCollapsed((prev) => ({
                                  ...prev,
                                  [folder.id]: !collapsed,
                                }));
                              }}
                            >
                              {collapsed ? "+" : "-"}
                            </span>
                          ) : (
                            <span className="w-4" />
                          )}
                          <span>{folder.name}</span>
                        </button>
                      )
                      )}
                    </div>
                  </div>

                  <div className="rounded-md border border-zinc-800 bg-zinc-950/30 p-2">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-[11px] font-semibold text-zinc-200">
                        프리셋
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (!tagGrantOpen) return;
                          setTagGrantPresetErr(null);
                          setTagGrantPresetLoading(true);
                          listTagPresets()
                            .then((res) => {
                              const data = res as {
                                presets?: TagPreset[];
                                folders?: TagPresetFolder[];
                              };
                              setTagGrantPresets(data.presets ?? []);
                              setTagGrantPresetFolders(data.folders ?? []);
                            })
                            .catch((e) =>
                              setTagGrantPresetErr(String(e?.message ?? e))
                            )
                            .finally(() => setTagGrantPresetLoading(false));
                        }}
                        disabled={tagGrantPresetLoading || busy}
                        className="rounded-md border border-zinc-800 px-2 py-1 text-[10px] text-zinc-200 hover:bg-zinc-800/60 disabled:opacity-50"
                      >
                        새로고침
                      </button>
                    </div>
                    <input
                      value={tagGrantPresetQuery}
                      onChange={(e) => setTagGrantPresetQuery(e.target.value)}
                      placeholder="프리셋 검색"
                      disabled={tagGrantPresetLoading || busy}
                      className="mb-2 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-zinc-600 disabled:opacity-60"
                    />
                    <div className="max-h-40 space-y-1 overflow-auto pr-1">
                      {tagGrantFilteredPresets.length === 0 ? (
                        <div className="rounded-md border border-zinc-800 bg-zinc-950/30 p-2 text-xs text-zinc-500">
                          표시할 프리셋이 없습니다.
                        </div>
                      ) : (
                        tagGrantFilteredPresets.map((preset) => {
                          const presetColor =
                            typeof preset.colorCode === "number" &&
                            preset.colorCode !== 37
                              ? ansiColorCodeToCss(preset.colorCode)
                              : undefined;
                          return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => {
                              setTagGrantPresetId(preset.id);
                              applyTagPresetToGrant(preset);
                            }}
                            className={[
                              "w-full rounded-md border px-2 py-1 text-left text-xs",
                              preset.id === tagGrantPresetId
                                ? "border-amber-700/70 bg-amber-950/30 text-amber-100"
                                : "border-zinc-800 bg-zinc-950/30 text-zinc-300 hover:bg-zinc-800/60",
                            ].join(" ")}
                          >
                            <div className="font-semibold">
                              <span
                                style={
                                  presetColor ? { color: presetColor } : undefined
                                }
                              >
                                {preset.name ?? ""}
                              </span>
                            </div>
                            <div className="text-[10px] text-zinc-500">
                              {preset.kind === "stack" ? "스택형" : "토글형"}
                            </div>
                          </button>
                        );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeTagGrantModal}
                  disabled={busy}
                  className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-800/60 disabled:opacity-50"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={applyStatusTagGrant}
                  disabled={busy}
                  className="rounded-lg bg-amber-700 px-3 py-2 text-xs text-white hover:bg-amber-600 disabled:opacity-50"
                >
                  추가
                </button>
              </div>
            </div>
          </div>
        )}

        {slotUseNotice && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            role="dialog"
            aria-modal="true"
            aria-label="Spell slot result modal"
          >
            {/* overlay */}
            <div className="absolute inset-0 bg-black/35 backdrop-blur-[2px]" />

            <div className="relative z-10 w-[min(640px,92vw)] rounded-2xl border border-zinc-800 bg-zinc-950 p-4 shadow-2xl">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <div className="text-base font-semibold text-zinc-100">
                    {slotUseNotice.level}레벨 주문 슬롯{" "}
                    {slotUseNotice.kind === "spend" ? "사용" : "회복"} 결과
                  </div>
                </div>
              </div>

              <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1 text-sm text-zinc-200">
                {slotUseNotice.rows.map((row, idx) => (
                  <div
                    key={`${row.label}-${idx}`}
                    className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2"
                  >
                    <div className="text-sm font-semibold text-zinc-100">
                      {row.label}
                    </div>
                    {row.status === "missing" && (
                      <div className="text-xs text-amber-200">
                        {slotUseNotice.level}레벨 주문 슬롯을 가지고 있지
                        않습니다.
                      </div>
                    )}
                    {row.status === "empty" && (
                      <div className="text-xs text-amber-200">
                        {slotUseNotice.level}레벨 주문 슬롯이 부족합니다.
                      </div>
                    )}
                    {row.status === "applied" && (
                      <div className="text-xs text-emerald-200">
                        정상 적용됨.{" "}
                        <span className="ml-1 text-zinc-400">
                          {renderSlotSummary(row.before ?? "")}
                        </span>
                        <span className="mx-1 text-zinc-500">→</span>
                        <span className="text-zinc-400">
                          {renderSlotSummary(row.after ?? "")}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSlotUseNotice(null)}
                  className="rounded-lg bg-amber-700 px-3 py-2 text-xs text-white hover:bg-amber-600"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        )}

        <TurnOrderReorderModal
          open={reorderOpen}
          units={activeUnits}
          turnOrder={(state as any)?.turnOrder ?? []}
          turnGroups={(state as any)?.turnGroups ?? []}
          busy={busy}
          onClose={() => setReorderOpen(false)}
          onApply={async (nextOrder, nextGroups, disabledChanges) => {
            const ok = await applyTurnOrderReorder(
              nextOrder,
              nextGroups,
              disabledChanges
            );
            if (ok) setReorderOpen(false);
          }}
        />

        <EditUnitModal
          open={!!editUnit}
          unit={editUnit}
          units={units}
          busy={busy}
          onClose={() => setEditUnitId(null)}
          onSubmitPatch={async (unitId, patch) => {
            await patchUnit(unitId, patch);
          }}
          onSubmitDeathSaves={async (unitId, success, failure) => {
            await editDeathSaves(unitId, success, failure);
          }}
          onSubmitPos={async (unitId, x, z) => {
            await setUnitPos(unitId, x, z);
          }}
          onRemoveUnit={async (unitId) => {
            await removeUnit(unitId);
          }}
        />

        {memoViewUnit && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            role="dialog"
            aria-modal="true"
            aria-label="Memo view modal"
          >
            <div
              className="absolute inset-0 bg-black/60"
              onClick={() => setMemoViewId(null)}
            />
            <div className="relative z-10 w-[min(640px,92vw)] rounded-2xl border border-zinc-800 bg-zinc-950 p-4 shadow-2xl">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <div className="text-base font-semibold text-zinc-100">
                    메모 확인
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {memoViewUnit.alias
                      ? `${memoViewUnit.name} (${memoViewUnit.alias})`
                      : memoViewUnit.name}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      const text = memoViewUnit.note ?? "";
                      if (!text) return;
                      try {
                        if (navigator.clipboard?.writeText) {
                          await navigator.clipboard.writeText(text);
                        }
                      } finally {
                        showMemoCopyToast();
                      }
                    }}
                    className="rounded-lg border border-amber-700/60 bg-amber-950/40 px-3 py-2 text-xs text-amber-200 hover:bg-amber-900/60"
                  >
                    {memoCopyToast ? "✓ 복사됨" : "복사하기"}
                  
                  </button>
                  <button
                    type="button"
                    onClick={() => setMemoViewId(null)}
                    className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-800/60"
                  >
                    Close
                  </button>
                </div>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
                <div className="text-xs text-zinc-400">메모</div>
                <div
                  className="mt-2 max-h-[50vh] overflow-y-auto whitespace-pre-wrap font-mono text-[12px] leading-5 text-zinc-200"
                  style={{ fontSynthesis: "weight" }}
                >
                  {memoViewContent ?? "메모 없음"}
                </div>
              </div>
            </div>
          </div>
        )}


        {sideMemoOpen && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
            <div className="w-[min(900px,96vw)] rounded-2xl border border-zinc-800 bg-zinc-950 p-4 shadow-2xl">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <div className="text-base font-semibold text-zinc-100">
                    진영별 메모
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    ANSI 스타일을 적용해 디스코드 출력과 동일하게 확인할 수 있습니다.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSideMemoOpen(false)}
                  className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800/60"
                >
                  닫기
                </button>
              </div>

              <div className="mb-3 flex flex-wrap items-center gap-2">
                {(["TEAM", "ENEMY", "NEUTRAL"] as Side[]).map((side) => {
                  const active = sideMemoTab === side;
                  const color =
                    side === "TEAM"
                      ? "text-sky-300"
                      : side === "ENEMY"
                        ? "text-red-300"
                        : "text-zinc-300";
                  return (
                    <button
                      key={side}
                      type="button"
                      onClick={() => setSideMemoTab(side)}
                      className={[
                        "rounded-lg border px-3 py-1 text-xs font-semibold",
                        color,
                        active
                          ? "border-amber-500/60 bg-amber-950/30"
                          : "border-zinc-800 bg-zinc-950/40 hover:bg-zinc-800/60",
                      ].join(" ")}
                    >
                      {side}
                    </button>
                  );
                })}
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => applySideMemoBold(sideMemoTab)}
                    className="rounded-md border border-zinc-800 bg-zinc-950/40 px-2 py-1 text-[11px] text-zinc-200 hover:bg-zinc-800/60"
                  >
                    굵게
                  </button>
                  <button
                    type="button"
                    onClick={() => clearSideMemoFormat(sideMemoTab)}
                    className="rounded-md border border-zinc-800 bg-zinc-950/40 px-2 py-1 text-[11px] text-zinc-400 hover:bg-zinc-800/60"
                  >
                    리셋
                  </button>
                  <div className="flex flex-wrap items-center gap-1">
                    {SIDE_MEMO_COLORS.map((color) => (
                      <button
                        key={color.code}
                        type="button"
                        onClick={() => applySideMemoColor(sideMemoTab, color.code)}
                        className="flex h-6 w-6 items-center justify-center rounded-md border border-zinc-800 bg-zinc-950/40 text-xs hover:bg-zinc-800/60"
                        title={color.label}
                        aria-label={color.label}
                      >
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: ansiColorCodeToCss(color.code) }}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div
                  ref={(el) => {
                    sideMemoRefs.current[sideMemoTab] = el;
                  }}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={(e) =>
                    updateSideMemo(sideMemoTab, e.currentTarget.innerHTML)
                  }
                  className="min-h-[140px] w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 outline-none focus:border-zinc-600 font-mono whitespace-pre-wrap [&_b]:font-semibold [&_strong]:font-semibold"
                  style={{ fontSynthesis: "weight" }}
                  data-placeholder="Side memo..."
                />
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSideMemoOpen(false)}
                  className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-800/60"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={saveSideNotes}
                  disabled={busy}
                  className="rounded-lg bg-amber-700 px-3 py-2 text-xs text-white hover:bg-amber-600 disabled:opacity-50"
                >
                  저장
                </button>
              </div>
            </div>
          </div>
        )}

{boardMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setBoardMenu(null)}
            />
            <div
              className="fixed z-50 w-44 rounded-md border border-zinc-800 bg-zinc-950 p-1 text-xs text-zinc-200 shadow-xl"
              style={{ left: boardMenu.x, top: boardMenu.y }}
            >
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-zinc-800/70"
                onClick={() => {
                  const target = units.find((u) => u.id === boardMenu.id);
                  setBoardMenu(null);
                  if (!target || busy) return;
                  openMemoView(target.id);
                }}
              >
                메모 확인
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-zinc-800/70"
                onClick={() => {
                  const target = units.find((u) => u.id === boardMenu.id);
                  setBoardMenu(null);
                  if (!target || busy) return;
                  toggleHidden(target.id);
                }}
              >
                숨겨짐 토글
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-zinc-800/70"
                onClick={() => {
                  const target = units.find((u) => u.id === boardMenu.id);
                  setBoardMenu(null);
                  if (!target || busy) return;
                  setEditUnitId(target.id);
                }}
              >
                유닛 편집
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-rose-200 hover:bg-rose-900/30"
                onClick={() => {
                  const target = units.find((u) => u.id === boardMenu.id);
                  setBoardMenu(null);
                  if (!target || busy) return;
                  removeUnit(target.id);
                }}
              >
                유닛 삭제
              </button>
            </div>
          </>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Units */}
          <UnitsPanel
            units={units}
            markers={markers}
            selectedId={selectedId}
            selectedIds={selectedIds}
            selected={selected}
            busy={busy}
            turnOrderLen={state?.turnOrder?.length ?? units.length}
            turnOrder={(state as any)?.turnOrder ?? []}
            onSelectUnit={selectUnit}
            onEditUnit={(unitId) => setEditUnitId(unitId)}
            onCreateUnit={createUnit}
            onCreateUnitFromPreset={createUnitFromPreset}
            onRemoveUnit={removeUnit}
            onToggleHidden={toggleHidden}
            onViewMemo={openMemoView}
            onReorderUnits={reorderUnits}
            onToggleMarkerCreate={toggleMarkerCreate}
            onUpsertMarker={upsertMarkerFromPanel}
            onRemoveMarker={removeMarkerFromPanel}
          />

          {/* Bench + Logs */}
          <div className="space-y-4">
            <BenchPanel
              units={units}
              selectedId={selectedId}
              selectedIds={selectedIds}
              busy={busy}
              hideBenchTeamOnPublish={hideBenchTeamOnPublish}
              hideBenchEnemyOnPublish={hideBenchEnemyOnPublish}
              onToggleHideBenchTeam={() =>
                setHideBenchTeamOnPublish((prev) => !prev)
              }
              onToggleHideBenchEnemy={() =>
                setHideBenchEnemyOnPublish((prev) => !prev)
              }
              onSelectUnit={selectUnit}
              onEditUnit={(unitId) => setEditUnitId(unitId)}
              onToggleHidden={toggleHidden}
              onRemoveUnit={removeUnit}
              onReorderUnits={reorderUnits}
            />

            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-semibold text-zinc-200"></div>
                <div className="text-xs text-zinc-500">
                  {selected ? `selected: ${selected.name}` : "no unit selected"}
                  {selected?.pos ? ` (x=${selected.pos.x}, z=${selected.pos.z})` : ""}
                </div>
              </div>

              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm font-semibold text-zinc-200">Logs</div>
                  <div className="text-xs text-zinc-500">
                    {logEntries.length ? `${logEntries.length} entries` : "empty"}
                  </div>
                </div>
                <div className="max-h-80 w-full overflow-auto rounded-xl border border-zinc-800 bg-zinc-950">
                  {logEntries.length === 0 ? (
                    <div className="p-3 text-xs text-zinc-500">{"\ub85c\uadf8 \uc5c6\uc74c"}</div>
                  ) : (
                    <div className="divide-y divide-zinc-900/70">
                      {logEntries.map((entry, idx) => (
                        <div
                          key={entry?.id ?? entry?.at ?? `log-${idx}`}
                          className="px-3 py-2 text-xs text-zinc-200"
                        >
                          {renderLogLine(entry?.line ?? String(entry))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm font-semibold text-zinc-200">State (debug)</div>
                  <button
                    type="button"
                    className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:border-zinc-500 hover:text-zinc-100"
                    onClick={() => setDebugOpen((prev) => !prev)}
                    aria-expanded={debugOpen}
                  >
                    {debugOpen ? "\uc811\uae30" : "\ud3bc\uce58\uae30"}
                  </button>
                </div>
                {debugOpen ? (
                  <textarea
                    className="h-80 w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-200 outline-none"
                    readOnly
                    value={state ? JSON.stringify(state, null, 2) : ""}
                  />
                ) : (
                  <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-500">
                    {"State \uc228\uae40"}
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>

        {/* ✅ Floating Control Panel (moved out of the Controls card) */}
        <ControlPanel
          disabled={busy || !encounterId}
          canControlMove={canControlMove}
          // NOTE: NEXT_TURN은 selectedId 없어도 동작해야 하므로
          // ControlPanel 내부에서 mode === NEXT_TURN이면 canControlAction 체크를 무시하도록 해둔 상태를 전제로 함.
          canControlAction={selectedIds.length > 0}
          hotkeysEnabled={panelHotkeysEnabled}
          amount={amount}
          setAmount={setAmount}
          onMove={moveByPad}
          onAction={applyPanelAction}
          slotLevel={panelSlotLevel}
          setSlotLevel={setPanelSlotLevel}
          slotDelta={panelSlotDelta}
          setSlotDelta={setPanelSlotDelta}
          identifierOptions={[...IDENTIFIER_SCHEME_OPTIONS]}
          identifierScheme={panelIdentifierScheme}
          setIdentifierScheme={setPanelIdentifierScheme}
          consumableOptions={panelConsumableOptions}
          consumableName={panelConsumableName}
          setConsumableName={setPanelConsumableName}
          consumableDelta={panelConsumableDelta}
          setConsumableDelta={setPanelConsumableDelta}
          consumableRemaining={panelConsumableRemaining}
          consumableDisabled={panelConsumableDisabled}
          tagReduceOptions={panelTagReduceOptions}
          tagReduceName={panelTagReduceName}
          setTagReduceName={setPanelTagReduceName}
          tagReduceKind={panelTagReduceSelected?.kind ?? null}
          tagReduceStacks={panelTagReduceSelected?.stacks ?? null}
          tagReduceDisabled={panelTagReduceDisabled}
        />
      </div>
    </div>
  );
}

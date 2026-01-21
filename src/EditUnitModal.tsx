// src/EditUnitModal.tsx
import { useEffect, useMemo, useState } from "react";
import type { Unit, UnitKind, UnitPatch } from "./types";

function parseIntOrNull(s: string): number | null {
  const t = (s ?? "").trim();
  if (!t) return null;
  const n = Math.trunc(Number(t));
  return Number.isFinite(n) ? n : null;
}

function isEmptyPatch(p: UnitPatch) {
  return Object.keys(p).length === 0;
}

type EditTab = "INFO" | "STATUS" | "CONSUME" | "DEATH" | "MEMO";

type DraftTagState = {
  stacks: number;
  decOnTurnStart?: boolean;
  decOnTurnEnd?: boolean;
};

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

export default function EditUnitModal(props: {
  open: boolean;
  unit: Unit | null;
  units: Unit[];
  busy: boolean;
  onClose: () => void;

  onSubmitPatch: (unitId: string, patch: UnitPatch) => Promise<void> | void;
  onSubmitDeathSaves: (
    unitId: string,
    success: number,
    failure: number,
  ) => Promise<void> | void;
  onSubmitPos: (unitId: string, x: number, z: number) => Promise<void> | void;
  onRemoveUnit: (unitId: string) => Promise<void> | void;
}) {
  const {
    open,
    unit,
    units,
    busy,
    onClose,
    onSubmitPatch,
    onSubmitDeathSaves,
    onSubmitPos,
    onRemoveUnit,
  } = props;

  const [err, setErr] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [alias, setAlias] = useState("");
  const [unitType, setUnitType] = useState<UnitKind>("NORMAL");
  const [masterUnitId, setMasterUnitId] = useState("");
  const [note, setNote] = useState("");

  const [colorCode, setColorCode] = useState(""); // "" => auto(remove explicit)
  const [acBase, setAcBase] = useState(""); // "" => remove base
  const [integrityBase, setIntegrityBase] = useState(""); // "" => remove base

  const [hasHp, setHasHp] = useState(true);
  const [hpCur, setHpCur] = useState("");
  const [hpMax, setHpMax] = useState("");
  const [hpTemp, setHpTemp] = useState("");

  const [x, setX] = useState("0");
  const [z, setZ] = useState("0");

  const [activeTab, setActiveTab] = useState<EditTab>("INFO");
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
  const [consumables, setConsumables] = useState<
    { name: string; count: number }[]
  >([]);
  const [newConsumableName, setNewConsumableName] = useState("");
  const [newConsumableCount, setNewConsumableCount] = useState(1);

  useEffect(() => {
    if (!unit) return;

    setErr(null);
    setActiveTab("INFO");

    setName(unit.name ?? "");
    setAlias((unit.alias ?? "").toString());
    setUnitType((unit.unitType ?? "NORMAL") as UnitKind);
    setMasterUnitId((unit.masterUnitId ?? "").toString());
    setNote((unit as any).note ?? "");

    setColorCode(
      typeof (unit as any).colorCode === "number"
        ? String((unit as any).colorCode)
        : "",
    );

    setAcBase(typeof unit.acBase === "number" ? String(unit.acBase) : "");
    setIntegrityBase(
      typeof (unit as any).integrityBase === "number"
        ? String((unit as any).integrityBase)
        : "",
    );

    const hp = unit.hp;
    setHasHp(!!hp);
    setHpCur(hp ? String(hp.cur ?? 0) : "");
    setHpMax(hp ? String(hp.max ?? 0) : "");
    setHpTemp(hp && typeof hp.temp === "number" ? String(hp.temp) : "");

    setX(unit.pos ? String(unit.pos.x) : "0");
    setZ(unit.pos ? String(unit.pos.z) : "0");

    const rawTags = Array.isArray(unit.tags) ? unit.tags : [];
    const baseTags = uniqTags(rawTags);
    const tagStates = unit.tagStates ?? {};

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

    const slotMap = unit.spellSlots ?? {};
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

    setDeathSaveSuccess(normalizeCount(unit.deathSaves?.success ?? 0, 0));
    setDeathSaveFailure(normalizeCount(unit.deathSaves?.failure ?? 0, 0));

    const nextConsumables = Object.entries(unit.consumables ?? {})
      .map(([raw, count]) => ({
        name: normalizeTagName(raw),
        count: normalizeCount(count, 0),
      }))
      .filter((c) => c.name.length > 0);
    setConsumables(nextConsumables);
    setNewConsumableName("");
    setNewConsumableCount(1);
  }, [unit?.id, open]);

  const aliasText = useMemo(() => (unit?.alias ?? "").trim(), [unit?.alias]);
  const toggleTags = useMemo(
    () => manualTags.filter((t) => !stackTags[t]),
    [manualTags, stackTags],
  );
  const stackEntries = useMemo(() => Object.entries(stackTags), [stackTags]);

  const tabBtnClass = (active: boolean) =>
    [
      "rounded-lg border px-3 py-1.5 text-xs font-semibold",
      active
        ? "border-emerald-500/60 bg-emerald-950/40 text-emerald-200"
        : "border-zinc-800 bg-zinc-950/30 text-zinc-300 hover:bg-zinc-800/60",
    ].join(" ");

  function addStatusTag() {
    const name = normalizeTagName(newTagName);
    if (!name) {
      setErr("태그 이름을 입력해줘.");
      return;
    }
    setErr(null);

    if (newTagType === "toggle") {
      if (stackTags[name]) {
        setErr("이미 스택형 태그로 등록되어 있어.");
        return;
      }
      setManualTags((prev) => (prev.includes(name) ? prev : [...prev, name]));
      setNewTagName("");
      return;
    }

    const stacks = normalizeStacks(newTagStacks, 1);
    setStackTags((prev) => {
      const cur = prev[name];
      if (cur) {
        const curStacks = normalizeStacks(cur.stacks ?? 1, 1);
        return {
          ...prev,
          [name]: {
            ...cur,
            stacks: curStacks + stacks,
          },
        };
      }

      return {
        ...prev,
        [name]: {
          stacks,
          decOnTurnStart: newTagDecStart,
          decOnTurnEnd: newTagDecEnd,
        },
      };
    });
    setManualTags((prev) => prev.filter((t) => t !== name));
    setNewTagName("");
  }

  function removeToggleTag(tag: string) {
    setManualTags((prev) => prev.filter((t) => t !== tag));
  }

  function removeStackTag(tag: string) {
    setStackTags((prev) => {
      const next = { ...prev };
      delete next[tag];
      return next;
    });
    setManualTags((prev) => prev.filter((t) => t !== tag));
  }

  function updateStackTag(tag: string, patch: Partial<DraftTagState>) {
    setStackTags((prev) => {
      const cur = prev[tag] ?? { stacks: 1 };
      return {
        ...prev,
        [tag]: { ...cur, ...patch },
      };
    });
  }

  function addSpellSlotLevel() {
    setSpellSlots((prev) => {
      if (prev.length >= 9) return prev;
      return [...prev, 1];
    });
  }

  function removeSpellSlotLevel() {
    setSpellSlots((prev) => {
      if (prev.length === 0) return prev;
      return prev.slice(0, -1);
    });
  }

  function adjustSpellSlot(idx: number, delta: number) {
    setSpellSlots((prev) => {
      const next = prev.slice();
      if (idx < 0 || idx >= next.length) return prev;
      next[idx] = Math.max(0, next[idx] + delta);
      return next;
    });
  }

  function adjustDeathSave(kind: "success" | "failure", delta: number) {
    if (kind === "success") {
      setDeathSaveSuccess((prev) => Math.max(0, prev + delta));
      return;
    }
    setDeathSaveFailure((prev) => Math.max(0, prev + delta));
  }

  function addConsumable() {
    const name = normalizeTagName(newConsumableName);
    if (!name) {
      setErr("소모값 이름을 입력해줘.");
      return;
    }
    if (consumables.some((c) => c.name === name)) {
      setErr("같은 이름의 소모값이 이미 있어.");
      return;
    }
    setErr(null);
    const count = normalizeCount(newConsumableCount, 0);
    setConsumables((prev) => [...prev, { name, count }]);
    setNewConsumableName("");
    setNewConsumableCount(1);
  }

  function removeConsumable(name: string) {
    setConsumables((prev) => prev.filter((c) => c.name !== name));
  }

  function updateConsumableCount(name: string, value: number) {
    setConsumables((prev) =>
      prev.map((c) =>
        c.name === name ? { ...c, count: normalizeCount(value, 0) } : c,
      ),
    );
  }

  // ✅ 여기서 렌더 자체를 막고
  if (!open || !unit) return null;

  // ✅ 이 아래부터는 unit이 절대 null이 아님을 고정
  const u = unit;

  async function submit() {
    setErr(null);

    const patch: UnitPatch = {};

    const nextName = name.trim();
    if (!nextName) {
      setErr("name은 비울 수 없어.");
      return;
    }
    if (nextName !== u.name) patch.name = nextName;

    const nextAlias = alias.trim();
    const prevAlias = (u.alias ?? "").toString().trim();
    if (!nextAlias) {
      if (prevAlias) patch.alias = null;
    } else if (nextAlias !== prevAlias) {
      patch.alias = nextAlias;
    }

    const prevType = (u.unitType ?? "NORMAL") as UnitKind;
    const nextType = unitType;
    if (nextType !== prevType) patch.unitType = nextType;

    const prevMaster = (u.masterUnitId ?? "").toString().trim();
    if (nextType === "SERVANT") {
      const masterId = masterUnitId.trim();
      if (!masterId) {
        setErr("서번트는 사역자를 선택해야 해.");
        return;
      }
      if (masterId === u.id) {
        setErr("사역자는 자기 자신일 수 없어.");
        return;
      }
      const master = units.find((item) => item.id === masterId);
      const masterType = master?.unitType ?? "NORMAL";
      if (!master || masterType !== "NORMAL") {
        setErr("사역자는 일반 유닛만 선택할 수 있어.");
        return;
      }
      if (masterId !== prevMaster) patch.masterUnitId = masterId;
    } else if (prevMaster) {
      patch.masterUnitId = null;
    }

    // note: "" => null(delete)
    const nextNote = note.trim();
    const prevNote = ((u as any).note ?? "").toString().trim();
    if (!nextNote) {
      if ((u as any).note != null) patch.note = null;
    } else if (nextNote !== prevNote) {
      patch.note = nextNote;
    }

    // colorCode: "" => null(delete explicit), number => set
    const prevColor =
      typeof (u as any).colorCode === "number" ? (u as any).colorCode : null;
    const cc = parseIntOrNull(colorCode);
    if (cc === null) {
      if (prevColor != null) patch.colorCode = null;
    } else {
      // backend 허용 범위: 30~37, 39
      const ok = (cc >= 30 && cc <= 37) || cc === 39;
      if (!ok) {
        setErr("colorCode는 30~37, 39 중 하나만 가능해. (또는 비워서 자동)");
        return;
      }
      if (cc !== prevColor) patch.colorCode = cc;
    }

    // acBase: "" => null(delete), number => set
    const acN = parseIntOrNull(acBase);
    if (acN === null) {
      if (typeof u.acBase === "number") patch.ac = null;
    } else {
      if (acN < 0) {
        setErr("AC는 0 이상이어야 해.");
        return;
      }
      if (acN !== u.acBase) patch.ac = acN;
    }

    // integrityBase: "" => null(delete), number => set
    const prevIntegrity =
      typeof (u as any).integrityBase === "number"
        ? (u as any).integrityBase
        : null;
    const intN = parseIntOrNull(integrityBase);
    if (intN === null) {
      if (prevIntegrity != null) patch.integrity = null;
    } else {
      if (intN < 0) {
        setErr("Integrity는 0 이상이어야 해.");
        return;
      }
      if (intN !== prevIntegrity) patch.integrity = intN;
    }

    // HP
    if (!hasHp) {
      if (u.hp) patch.hp = null;
    } else {
      const curN = parseIntOrNull(hpCur);
      const maxN = parseIntOrNull(hpMax);
      const tempN = parseIntOrNull(hpTemp);

      if (curN === null || maxN === null) {
        setErr("HP를 쓰려면 cur/max는 숫자로 입력해줘.");
        return;
      }
      if (maxN < 0 || curN < 0) {
        setErr("HP는 0 이상이어야 해.");
        return;
      }

      const prevHp = u.hp ?? { cur: 0, max: 0, temp: undefined as any };
      const hpPatch: any = {};

      if (!u.hp) {
        hpPatch.max = maxN;
        hpPatch.cur = curN;
        if (tempN !== null) hpPatch.temp = tempN;
        else hpPatch.temp = null;
      } else {
        if (maxN !== prevHp.max) hpPatch.max = maxN;
        if (curN !== prevHp.cur) hpPatch.cur = curN;

        const prevTemp = typeof prevHp.temp === "number" ? prevHp.temp : null;
        if (tempN === null) {
          if (prevTemp != null) hpPatch.temp = null;
        } else {
          if (tempN !== prevTemp) hpPatch.temp = tempN;
        }
      }

      if (Object.keys(hpPatch).length) patch.hp = hpPatch;
    }

    // Tags (manual + turn-based)
    const desiredStacks = (() => {
      const out: Record<string, DraftTagState> = {};
      for (const [rawKey, st] of Object.entries(stackTags)) {
        const key = normalizeTagName(rawKey);
        if (!key) continue;
        out[key] = {
          stacks: normalizeStacks(st?.stacks ?? 1, 1),
          decOnTurnStart: !!st?.decOnTurnStart,
          decOnTurnEnd: !!st?.decOnTurnEnd,
        };
      }
      return out;
    })();

    const desiredManual = uniqTags(manualTags);
    const currentManual = uniqTags(Array.isArray(u.tags) ? u.tags : []);

    if (
      desiredManual.length !== currentManual.length ||
      desiredManual.some((t, i) => t !== currentManual[i])
    ) {
      patch.tags = { set: desiredManual };
    }

    const currentStacks = u.tagStates ?? {};
    const tagStatesPatch: Record<string, any> = {};

    for (const [key, next] of Object.entries(desiredStacks)) {
      const cur = currentStacks[key];
      const curStacks = normalizeStacks(cur?.stacks ?? 0, 0, 0);
      const curStart = !!cur?.decOnTurnStart;
      const curEnd = !!cur?.decOnTurnEnd;

      if (
        curStacks !== next.stacks ||
        curStart !== !!next.decOnTurnStart ||
        curEnd !== !!next.decOnTurnEnd
      ) {
        tagStatesPatch[key] = {
          stacks: next.stacks,
          decOnTurnStart: !!next.decOnTurnStart,
          decOnTurnEnd: !!next.decOnTurnEnd,
        };
      }
    }

    for (const key of Object.keys(currentStacks)) {
      if (!desiredStacks[key]) tagStatesPatch[key] = null;
    }

    if (Object.keys(tagStatesPatch).length > 0) {
      patch.tagStates = tagStatesPatch;
    }

    // Spell slots
    const desiredSlots: Record<string, number> = {};
    for (let i = 0; i < spellSlots.length; i++) {
      desiredSlots[String(i + 1)] = normalizeCount(spellSlots[i], 0);
    }

    const currentSlots = u.spellSlots ?? {};
    const spellPatch: Record<string, number | null> = {};
    for (const [key, val] of Object.entries(desiredSlots)) {
      const hasKey = Object.prototype.hasOwnProperty.call(currentSlots, key);
      const cur = normalizeCount((currentSlots as any)[key], 0);
      if (!hasKey || cur !== val) spellPatch[key] = val;
    }
    for (const key of Object.keys(currentSlots as Record<string, number>)) {
      if (desiredSlots[key] === undefined) spellPatch[key] = null;
    }
    if (Object.keys(spellPatch).length > 0) {
      patch.spellSlots = spellPatch;
    }

    // Consumables
    const desiredConsumables: Record<string, number> = {};
    for (const entry of consumables) {
      const name = normalizeTagName(entry.name);
      if (!name) continue;
      if (desiredConsumables[name] !== undefined) {
        setErr("소모값 이름이 중복돼.");
        return;
      }
      desiredConsumables[name] = normalizeCount(entry.count, 0);
    }

    const currentConsumables = u.consumables ?? {};
    const consumablePatch: Record<string, number | null> = {};
    for (const [key, val] of Object.entries(desiredConsumables)) {
      const cur = normalizeCount((currentConsumables as any)[key], 0);
      if (cur !== val) consumablePatch[key] = val;
    }
    for (const key of Object.keys(
      currentConsumables as Record<string, number>,
    )) {
      if (desiredConsumables[key] === undefined) consumablePatch[key] = null;
    }
    if (Object.keys(consumablePatch).length > 0) {
      patch.consumables = consumablePatch;
    }

    // Death saves
    const currentDeathSuccess = normalizeCount(u.deathSaves?.success ?? 0, 0);
    const currentDeathFailure = normalizeCount(u.deathSaves?.failure ?? 0, 0);
    const nextDeathSuccess = normalizeCount(deathSaveSuccess, 0);
    const nextDeathFailure = normalizeCount(deathSaveFailure, 0);
    const deathChanged =
      currentDeathSuccess !== nextDeathSuccess ||
      currentDeathFailure !== nextDeathFailure;

    // POS (SET_UNIT_POS)
    const xN = parseIntOrNull(x);
    const zN = parseIntOrNull(z);
    if (xN === null || zN === null) {
      setErr("pos.x / pos.z는 숫자로 입력해줘.");
      return;
    }
    const prevX = u.pos?.x ?? 0;
    const prevZ = u.pos?.z ?? 0;
    const posChanged = xN !== prevX || zN !== prevZ;

    if (isEmptyPatch(patch) && !posChanged && !deathChanged) {
      onClose();
      return;
    }

    if (!isEmptyPatch(patch)) await onSubmitPatch(u.id, patch);
    if (posChanged) await onSubmitPos(u.id, xN, zN);
    if (deathChanged) {
      await onSubmitDeathSaves(u.id, nextDeathSuccess, nextDeathFailure);
    }

    onClose();
  }

  async function handleRemove() {
    if (busy) return;
    const ok = window.confirm("Delete this unit?");
    if (!ok) return;
    await onRemoveUnit(u.id);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60"
        onClick={busy ? undefined : onClose}
      />
      {/* 내용이 길어질 때 모달 자체가 스크롤되도록 제한 */}
      <div className="relative max-h-[90vh] w-[min(720px,92vw)] overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-4 shadow-xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-zinc-100">Edit Unit</div>
            <div className="mt-1 text-xs text-zinc-500">
              unitId: <span className="text-zinc-300">{u.id}</span>
              {aliasText ? (
                <>
                  {" "}
                  ? alias: <span className="text-zinc-300">{aliasText}</span>
                </>
              ) : null}
            </div>
          </div>

        </div>

        {err && (
          <div className="mb-3 rounded-lg border border-rose-900/60 bg-rose-950/30 px-3 py-2 text-xs text-rose-200">
            {err}
          </div>
        )}

        <div className="mb-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("INFO")}
            className={tabBtnClass(activeTab === "INFO")}
            disabled={busy}
          >
            유닛 정보
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
            사망 내성 관리
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("CONSUME")}
            className={tabBtnClass(activeTab === "CONSUME")}
            disabled={busy}
          >
            고유 소모값
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("MEMO")}
            className={tabBtnClass(activeTab === "MEMO")}
            disabled={busy}
          >
            메모
          </button>
        </div>

        {activeTab === "INFO" && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-zinc-400">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={busy}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-zinc-400">
                Alias (optional)
              </label>
              <input
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                disabled={busy}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-zinc-400">Type</label>
              <select
                value={unitType}
                onChange={(e) => {
                  const next = e.target.value as UnitKind;
                  setUnitType(next);
                  if (next !== "SERVANT") setMasterUnitId("");
                }}
                disabled={busy}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600"
              >
                <option value="NORMAL">일반 유닛</option>
                <option value="SERVANT">서번트</option>
                <option value="BUILDING">건물</option>
              </select>
            </div>

            {unitType === "SERVANT" && (
              <div>
                <label className="mb-1 block text-xs text-zinc-400">
                  사역자
                </label>
                <select
                  value={masterUnitId}
                  onChange={(e) => setMasterUnitId(e.target.value)}
                  disabled={busy}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600"
                >
                  <option value="">선택</option>
                  {units
                    .filter((item) => {
                      if (item.id === u.id) return false;
                      return (item.unitType ?? "NORMAL") === "NORMAL";
                    })
                    .map((item) => {
                      const aliasText = (item.alias ?? "").trim();
                      const label = aliasText
                        ? `${item.name} (${aliasText})`
                        : item.name;
                      return (
                        <option key={item.id} value={item.id}>
                          {label}
                        </option>
                      );
                    })}
                </select>
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs text-zinc-400">
                ColorCode (optional)
              </label>
              <select
                value={colorCode}
                onChange={(e) => setColorCode(e.target.value)}
                disabled={busy}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600"
              >
                <option value="">Auto (remove explicit)</option>
                <option value="39">Default (39)</option>

                <option value="31">Red (31)</option>
                <option value="32">Green (32)</option>
                <option value="33">Yellow (33)</option>
                <option value="34">Blue (34)</option>
                <option value="35">Magenta (35)</option>
                <option value="36">Cyan (36)</option>
                <option value="37">White (37)</option>
                <option value="30">Gray (30)</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs text-zinc-400">
                AC Base (optional)
              </label>
              <input
                value={acBase}
                onChange={(e) => setAcBase(e.target.value)}
                placeholder="비우면 base 삭제"
                disabled={busy}
                inputMode="numeric"
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-zinc-400">
                Integrity Base (optional)
              </label>
              <input
                value={integrityBase}
                onChange={(e) => setIntegrityBase(e.target.value)}
                placeholder="비우면 base 삭제"
                disabled={busy}
                inputMode="numeric"
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600"
              />
            </div>

            <div className="md:col-span-2 flex items-center gap-2">
              <input
                id="hasHp"
                type="checkbox"
                checked={hasHp}
                onChange={(e) => setHasHp(e.target.checked)}
                disabled={busy}
              />
              <label htmlFor="hasHp" className="text-sm text-zinc-200">
                Has HP
              </label>
              <span className="text-xs text-zinc-500">
                (끄면 PATCH에서 hp=null로 삭제)
              </span>
            </div>

            {hasHp && (
              <>
                <div>
                  <label className="mb-1 block text-xs text-zinc-400">
                    HP cur
                  </label>
                  <input
                    value={hpCur}
                    onChange={(e) => setHpCur(e.target.value)}
                    disabled={busy}
                    inputMode="numeric"
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-400">
                    HP max
                  </label>
                  <input
                    value={hpMax}
                    onChange={(e) => setHpMax(e.target.value)}
                    disabled={busy}
                    inputMode="numeric"
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-400">
                    HP temp (optional)
                  </label>
                  <input
                    value={hpTemp}
                    onChange={(e) => setHpTemp(e.target.value)}
                    placeholder="비우면 temp 삭제"
                    disabled={busy}
                    inputMode="numeric"
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600"
                  />
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-2 md:col-span-2">
              <div>
                <label className="mb-1 block text-xs text-zinc-400">
                  pos.x
                </label>
                <input
                  value={x}
                  onChange={(e) => setX(e.target.value)}
                  disabled={busy}
                  inputMode="numeric"
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-400">
                  pos.z
                </label>
                <input
                  value={z}
                  onChange={(e) => setZ(e.target.value)}
                  disabled={busy}
                  inputMode="numeric"
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === "STATUS" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-3">
              <div className="mb-2 text-sm font-semibold text-zinc-200">
                태그 추가
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-zinc-400">
                    태그 이름
                  </label>
                  <input
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    disabled={busy}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs text-zinc-400">
                    타입
                  </label>
                  <select
                    value={newTagType}
                    onChange={(e) =>
                      setNewTagType(e.target.value as "toggle" | "stack")
                    }
                    disabled={busy}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600"
                  >
                    <option value="toggle">토글형</option>
                    <option value="stack">스택형</option>
                  </select>
                </div>
              </div>

              {newTagType === "stack" && (
                <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs text-zinc-400">
                      스택
                    </label>
                    <input
                      type="number"
                      value={String(newTagStacks)}
                      onChange={(e) =>
                        setNewTagStacks(normalizeStacks(e.target.value, 1))
                      }
                      disabled={busy}
                      min={1}
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-xs text-zinc-300">
                    <input
                      type="checkbox"
                      checked={newTagDecStart}
                      onChange={(e) => setNewTagDecStart(e.target.checked)}
                      disabled={busy}
                    />
                    턴 시작 시 감소
                  </label>
                  <label className="flex items-center gap-2 text-xs text-zinc-300">
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

              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={addStatusTag}
                  disabled={busy}
                  className="rounded-lg bg-amber-700 px-3 py-2 text-xs text-white hover:bg-amber-600 disabled:opacity-50"
                >
                  추가
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-3">
              <div className="mb-2 text-sm font-semibold text-zinc-200">
                토글형 태그
              </div>
              {toggleTags.length === 0 ? (
                <div className="text-xs text-zinc-500">등록된 태그가 없어.</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {toggleTags.map((tag) => (
                    <div
                      key={tag}
                      className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/40 px-2 py-1 text-xs text-zinc-200"
                    >
                      <span>{tag}</span>
                      <button
                        type="button"
                        onClick={() => removeToggleTag(tag)}
                        disabled={busy}
                        className="text-zinc-400 hover:text-zinc-200"
                        title="remove"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-3">
              <div className="mb-2 text-sm font-semibold text-zinc-200">
                스택형 태그
              </div>
              {stackEntries.length === 0 ? (
                <div className="text-xs text-zinc-500">
                  등록된 스택 태그가 없어.
                </div>
              ) : (
                <div className="space-y-2">
                  {stackEntries.map(([tag, st]) => (
                    <div
                      key={tag}
                      className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-zinc-200">
                          {tag}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeStackTag(tag)}
                          disabled={busy}
                          className="text-xs text-zinc-400 hover:text-zinc-200"
                        >
                          remove
                        </button>
                      </div>
                      <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
                        <div>
                          <label className="mb-1 block text-xs text-zinc-400">
                            스택
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={String(st.stacks)}
                            onChange={(e) =>
                              updateStackTag(tag, {
                                stacks: normalizeStacks(e.target.value, 1),
                              })
                            }
                            disabled={busy}
                            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600"
                          />
                        </div>
                        <label className="flex items-center gap-2 text-xs text-zinc-300">
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
                        <label className="flex items-center gap-2 text-xs text-zinc-300">
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
                  <div className="text-[11px] text-sky-300">성공</div>
                  <div className="w-14 rounded-md border border-zinc-800 bg-zinc-950/40 px-1 py-1">
                    <div className="flex flex-col items-center gap-1">
                      <button
                        type="button"
                        onClick={() => adjustDeathSave("success", 1)}
                        disabled={busy}
                        className="w-7 rounded border border-zinc-700 bg-zinc-950/40 py-0.5 text-[11px] text-zinc-200 hover:bg-zinc-800/60 disabled:opacity-50"
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
                        className="w-7 rounded border border-zinc-700 bg-zinc-950/40 py-0.5 text-[11px] text-zinc-200 hover:bg-zinc-800/60 disabled:opacity-50"
                        aria-label="사망 내성 성공 -1"
                      >
                        -
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <div className="text-[11px] text-rose-300">실패</div>
                  <div className="w-14 rounded-md border border-zinc-800 bg-zinc-950/40 px-1 py-1">
                    <div className="flex flex-col items-center gap-1">
                      <button
                        type="button"
                        onClick={() => adjustDeathSave("failure", 1)}
                        disabled={busy}
                        className="w-7 rounded border border-zinc-700 bg-zinc-950/40 py-0.5 text-[11px] text-zinc-200 hover:bg-zinc-800/60 disabled:opacity-50"
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
                        className="w-7 rounded border border-zinc-700 bg-zinc-950/40 py-0.5 text-[11px] text-zinc-200 hover:bg-zinc-800/60 disabled:opacity-50"
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
                  등록된 주문 슬롯이 없어. 캐스터라면 레벨을 추가해줘.
                </div>
              ) : (
                <>
                  {/* 레벨별 얇은 막대를 가로로 유지 (9레벨도 한 줄에 보이게) */}
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
                                className="w-7 rounded border border-zinc-700 bg-zinc-950/40 py-0.5 text-[11px] text-zinc-200 hover:bg-zinc-800/60 disabled:opacity-50"
                                aria-label={`${level}레벨 슬롯 +1`}
                              >
                                +
                              </button>
                              {/* 숫자는 버튼으로만 조절 */}
                              <div className="w-7 rounded border border-zinc-800 bg-zinc-950 px-1 py-0.5 text-center text-[11px] text-zinc-100">
                                {count}
                              </div>
                              <button
                                type="button"
                                onClick={() => adjustSpellSlot(idx, -1)}
                                disabled={busy}
                                className="w-7 rounded border border-zinc-700 bg-zinc-950/40 py-0.5 text-[11px] text-zinc-200 hover:bg-zinc-800/60 disabled:opacity-50"
                                aria-label={`${level}레벨 슬롯 -1`}
                              >
                                -
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
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
                    초기 값
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={String(newConsumableCount)}
                    onChange={(e) =>
                      setNewConsumableCount(normalizeCount(e.target.value, 0))
                    }
                    disabled={busy}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600"
                  />
                </div>
              </div>

              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={addConsumable}
                  disabled={busy}
                  className="rounded-lg bg-amber-700 px-3 py-2 text-xs text-white hover:bg-amber-600 disabled:opacity-50"
                >
                  소모값 추가
                </button>
              </div>

              <div className="mt-3 space-y-2">
                {consumables.length === 0 ? (
                  <div className="text-xs text-zinc-500">
                    등록된 소모값이 없어.
                  </div>
                ) : (
                  consumables.map((entry) => (
                    <div
                      key={entry.name}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2"
                    >
                      <div className="text-sm font-semibold text-zinc-200">
                        {entry.name}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            updateConsumableCount(entry.name, entry.count - 1)
                          }
                          disabled={busy}
                          className="rounded-md border border-zinc-700 bg-zinc-950/40 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800/60 disabled:opacity-50"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min={0}
                          value={String(entry.count)}
                          onChange={(e) =>
                            updateConsumableCount(
                              entry.name,
                              normalizeCount(e.target.value, 0),
                            )
                          }
                          disabled={busy}
                          className="w-14 rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-100 outline-none focus:border-zinc-600"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            updateConsumableCount(entry.name, entry.count + 1)
                          }
                          disabled={busy}
                          className="rounded-md border border-zinc-700 bg-zinc-950/40 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800/60 disabled:opacity-50"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() => removeConsumable(entry.name)}
                          disabled={busy}
                          className="text-xs text-zinc-400 hover:text-zinc-200"
                        >
                          remove
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "MEMO" && (
          <div className="space-y-3">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-3">
              <label className="mb-1 block text-xs text-zinc-400">메모</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="비우면 메모 삭제"
                disabled={busy}
                rows={16}
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
                className="min-h-[260px] w-full resize-y rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm leading-6 outline-none focus:border-zinc-600"
              />
              <div className="mt-2 text-xs text-zinc-500">
                유닛 별 메모를 저장합니다.
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={handleRemove}
            className="rounded-lg border border-rose-900/60 bg-rose-950/40 px-3 py-2 text-sm text-rose-200 hover:bg-rose-900/40 disabled:opacity-50"
          >
            유닛 삭제
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={submit}
            className="rounded-lg bg-emerald-700 px-3 py-2 text-sm text-white hover:bg-emerald-600 disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

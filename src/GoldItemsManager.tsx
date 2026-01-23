import { useEffect, useMemo, useState } from "react";
import type {
  AuthUser,
  GoldCharacter,
  InventoryItem,
  ItemCatalogEntry,
} from "./types";
import {
  addInventoryItem,
  listGoldCharacters,
  listInventory,
  listItemCatalog,
  useInventoryItem,
} from "./api";

type Props = {
  authUser: AuthUser;
  onBack: () => void;
};

const numberFormat = new Intl.NumberFormat("ko-KR");

const ITEM_TYPE_OPTIONS = [
  "전체",
  "장비",
  "소모품",
  "식품",
  "광물",
  "수렵품",
  "채집물",
  "기타아이템",
  "매개체",
] as const;

const QUALITY_ORDER = [
  "유일",
  "전설",
  "서사",
  "진귀",
  "영웅",
  "희귀",
  "고급",
  "일반",
] as const;

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return "0";
  return numberFormat.format(value);
}

function formatGold(value: number | null | undefined): string {
  return `${formatNumber(value)}G`;
}

function formatDay(value: number | null | undefined): string {
  return `${formatNumber(value)}日`;
}

function qualityLabelFromNumber(value: number | null | undefined): string {
  switch (value) {
    case 8:
      return "유일";
    case 7:
      return "전설";
    case 6:
      return "서사";
    case 5:
      return "진귀";
    case 4:
      return "영웅";
    case 3:
      return "희귀";
    case 2:
      return "고급";
    case 1:
      return "일반";
    default:
      return "일반";
  }
}

function qualityColorClass(label: string): string {
  switch (label) {
    case "유일":
      return "text-teal-300";
    case "전설":
      return "text-yellow-300";
    case "서사":
      return "text-red-300";
    case "진귀":
      return "text-zinc-300";
    case "영웅":
      return "text-fuchsia-300";
    case "희귀":
      return "text-sky-300";
    case "고급":
      return "text-lime-300";
    default:
      return "text-zinc-100";
  }
}

function getDailyDeltaDisplay(value: number): { text: string; className: string } {
  if (value > 0) {
    return { text: `-${formatGold(value)}`, className: "text-rose-300" };
  }
  if (value < 0) {
    return {
      text: `+${formatGold(Math.abs(value))}`,
      className: "text-emerald-300",
    };
  }
  return { text: "0G", className: "text-zinc-200" };
}

function formatItemAmount(amount: number, unit?: string | null): string {
  if (!unit || unit === "-") return `${amount}`;
  return `${amount}${unit}`;
}

export default function GoldItemsManager({ authUser, onBack }: Props) {
  const isAdmin = !!authUser.isAdmin;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [characters, setCharacters] = useState<GoldCharacter[]>([]);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [catalog, setCatalog] = useState<ItemCatalogEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"gold" | "inventory" | "sheet">(
    "gold",
  );
  const [inventoryMode, setInventoryMode] = useState<
    "none" | "consume" | "acquire"
  >("none");
  const [inventoryType, setInventoryType] =
    useState<(typeof ITEM_TYPE_OPTIONS)[number]>("전체");
  const [inventorySearch, setInventorySearch] = useState("");
  const [selectedInventoryName, setSelectedInventoryName] = useState<
    string | null
  >(null);
  const [selectedCatalogName, setSelectedCatalogName] = useState<string | null>(
    null,
  );
  const [inventoryAmount, setInventoryAmount] = useState("1");
  const [inventoryResult, setInventoryResult] = useState<{
    title: string;
    ownerName: string;
    itemName: string;
    before: number;
    after: number;
    qualityLabel: string;
    unit?: string | null;
    action: "consume" | "acquire";
    delta: number;
  } | null>(null);
  const [inventoryNotice, setInventoryNotice] = useState<{
    title: string;
    ownerName: string;
    itemName: string;
    qualityLabel: string;
    message: string;
    detail: string;
  } | null>(null);

  const selected = useMemo(
    () => characters.find((c) => c.name === selectedName) ?? null,
    [characters, selectedName],
  );

  const companions = useMemo(() => {
    if (!selected) return [];
    return characters.filter(
      (c) => c.friend && c.friend === selected.name && c.name !== selected.name,
    );
  }, [characters, selected]);

  const filteredCharacters = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return characters;
    return characters.filter((c) => {
      const friend = c.friend ?? "";
      return (
        c.name.toLowerCase().includes(term) ||
        friend.toLowerCase().includes(term)
      );
    });
  }, [characters, searchTerm]);

  const catalogByName = useMemo(() => {
    return new Map(catalog.map((entry) => [entry.name, entry]));
  }, [catalog]);

  const catalogResults = useMemo(() => {
    const rankMap = new Map<string, number>();
    QUALITY_ORDER.forEach((label, idx) => rankMap.set(label, idx));
    const term = inventorySearch.trim().toLowerCase();
    return catalog
      .map((entry) => {
        const qualityLabel = qualityLabelFromNumber(entry.quality);
        return {
          ...entry,
          qualityLabel,
          qualityRank: rankMap.get(qualityLabel) ?? QUALITY_ORDER.length,
        };
      })
      .filter((entry) => {
        if (inventoryType !== "전체" && entry.type !== inventoryType) return false;
        if (term && !entry.name.toLowerCase().includes(term)) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.qualityRank !== b.qualityRank) {
          return a.qualityRank - b.qualityRank;
        }
        return a.name.localeCompare(b.name, "ko");
      })
      .slice(0, 12);
  }, [catalog, inventorySearch, inventoryType]);

  const inventoryRows = useMemo(() => {
    const rankMap = new Map<string, number>();
    QUALITY_ORDER.forEach((label, idx) => rankMap.set(label, idx));
    const term = inventorySearch.trim().toLowerCase();
    const list = inventory
      .map((item) => {
        const meta = catalogByName.get(item.itemName);
        const qualityLabel = qualityLabelFromNumber(meta?.quality);
        const type = meta?.type ?? "기타아이템";
        const unit = meta?.unit ?? "-";
        return {
          ...item,
          type,
          unit,
          qualityLabel,
          qualityRank: rankMap.get(qualityLabel) ?? QUALITY_ORDER.length,
        };
      })
      .filter((item) => {
        if (inventoryType !== "전체" && item.type !== inventoryType) return false;
        if (term && !item.itemName.toLowerCase().includes(term)) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.qualityRank !== b.qualityRank) {
          return a.qualityRank - b.qualityRank;
        }
        return a.itemName.localeCompare(b.itemName, "ko");
      });

    const rows: typeof list[] = [];
    for (let i = 0; i < list.length; i += 2) {
      rows.push(list.slice(i, i + 2));
    }
    return rows;
  }, [catalogByName, inventory, inventorySearch, inventoryType]);

  const reloadCharacters = async (preserveSelection = true) => {
    try {
      setErr(null);
      setBusy(true);
      const list = (await listGoldCharacters()) as GoldCharacter[];
      setCharacters(list);
      if (!preserveSelection || !selectedName) {
        setSelectedName(list[0]?.name ?? null);
      } else if (!list.some((c) => c.name === selectedName)) {
        setSelectedName(list[0]?.name ?? null);
      }
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const reloadCatalog = async () => {
    try {
      const items = (await listItemCatalog()) as ItemCatalogEntry[];
      setCatalog(items);
    } catch (e: any) {
      if (isAdmin) {
        setErr(String(e?.message ?? e));
      }
    }
  };

  const reloadInventory = async (owner: string | null) => {
    if (!owner) {
      setInventory([]);
      return;
    }
    try {
      setErr(null);
      const items = (await listInventory(owner)) as InventoryItem[];
      setInventory(items);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    }
  };

  useEffect(() => {
    reloadCharacters(false);
    reloadCatalog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selected) {
      setInventory([]);
      setSelectedInventoryName(null);
      setSelectedCatalogName(null);
      return;
    }
    setSelectedInventoryName(null);
    setSelectedCatalogName(null);
    reloadInventory(selected.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.name]);

  useEffect(() => {
    setInventoryAmount("1");
  }, [inventoryMode]);

  const parseAmount = (raw: string): number | null => {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const value = Number(trimmed);
    if (!Number.isFinite(value) || value <= 0) return null;
    return Math.trunc(value);
  };

  const handleConsume = async () => {
    if (!selected) return;
    if (!selectedInventoryName) {
      setErr("소모할 아이템을 선택해 주세요.");
      return;
    }
    const amount = parseAmount(inventoryAmount);
    if (!amount) {
      setErr("소모 수량을 입력해 주세요.");
      return;
    }
    const beforeItem = inventory.find(
      (item) => item.itemName === selectedInventoryName,
    );
    if (!beforeItem) {
      setErr("선택한 아이템이 인벤토리에 없습니다.");
      return;
    }
    const before = beforeItem.amount;
    const qualityLabel = qualityLabelFromNumber(
      catalogByName.get(selectedInventoryName)?.quality,
    );
    const unit = catalogByName.get(selectedInventoryName)?.unit ?? null;
    try {
      setErr(null);
      setBusy(true);
      await useInventoryItem({
        owner: selected.name,
        itemName: selectedInventoryName,
        amount,
      });
      await reloadInventory(selected.name);
      const delta = Math.min(before, amount);
      const after = Math.max(0, before - delta);
      setInventoryResult({
        title: "아이템 소모 결과",
        ownerName: selected.name,
        itemName: selectedInventoryName,
        before,
        after,
        qualityLabel,
        unit,
        action: "consume",
        delta,
      });
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (msg.toLowerCase().includes("insufficient")) {
        setInventoryNotice({
          title: "아이템 소모 실패",
          ownerName: selected.name,
          itemName: selectedInventoryName,
          qualityLabel,
          message: `보유 수량이 부족합니다.`,
          detail: `(요청: ${formatItemAmount(amount, unit)}, 보유: ${formatItemAmount(
            before,
            unit,
          )})`,
        });
        return;
      }
      setErr(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleAcquire = async () => {
    if (!selected) return;
    if (!selectedCatalogName) {
      setErr("획득할 아이템을 선택해 주세요.");
      return;
    }
    const amount = parseAmount(inventoryAmount);
    if (!amount) {
      setErr("획득 수량을 입력해 주세요.");
      return;
    }
    const beforeItem = inventory.find(
      (item) => item.itemName === selectedCatalogName,
    );
    const before = beforeItem?.amount ?? 0;
    const qualityLabel = qualityLabelFromNumber(
      catalogByName.get(selectedCatalogName)?.quality,
    );
    const unit = catalogByName.get(selectedCatalogName)?.unit ?? null;
    try {
      setErr(null);
      setBusy(true);
      await addInventoryItem({
        owner: selected.name,
        itemName: selectedCatalogName,
        amount,
      });
      await reloadInventory(selected.name);
      const delta = amount;
      const after = before + delta;
      setInventoryResult({
        title: "아이템 획득 결과",
        ownerName: selected.name,
        itemName: selectedCatalogName,
        before,
        after,
        qualityLabel,
        unit,
        action: "acquire",
        delta,
      });
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (!selectedInventoryName) return;
    if (!inventory.some((item) => item.itemName === selectedInventoryName)) {
      setSelectedInventoryName(null);
    }
  }, [inventory, selectedInventoryName]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-6xl p-4">
        <header className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-xl font-semibold">Gold / Items</div>
            <div className="text-xs text-zinc-400">
              {isAdmin ? "관리자 모드" : "조회 전용"}
            </div>
          </div>
          <div className="flex items-center gap-2">
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
              onClick={() => reloadCharacters(true)}
              disabled={busy}
            >
              새로고침
            </button>
          </div>
        </header>

        {err ? (
          <div className="mb-4 whitespace-pre-line rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-200">
            {err}
          </div>
        ) : null}

        <div className="grid grid-cols-[240px_1fr] gap-4">
          <section className="flex min-h-[calc(100vh-180px)] flex-col rounded-2xl border border-zinc-800 bg-zinc-900/40 p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-semibold text-zinc-200">
                캐릭터 목록
              </div>
              <button
                type="button"
                className="rounded-md border border-zinc-700 px-2 py-1 text-[10px] text-zinc-200 hover:border-zinc-600"
                onClick={() => reloadCharacters(true)}
                disabled={busy}
              >
                새로고침
              </button>
            </div>

            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="검색"
              className="h-8 rounded-md border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-100 outline-none focus:border-zinc-600"
            />

            <div className="mt-2 flex-1 space-y-1 overflow-y-auto pr-1">
              {filteredCharacters.map((c) => {
                const active = c.name === selectedName;
                return (
                  <button
                    key={c.name}
                    type="button"
                    className={[
                      "w-full rounded-md border px-2 py-1.5 text-left text-sm",
                      active
                        ? "border-amber-700/70 bg-amber-950/30 text-amber-100"
                        : "border-zinc-800 bg-zinc-950/40 text-zinc-200 hover:border-zinc-700",
                    ].join(" ")}
                    onClick={() => setSelectedName(c.name)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{c.name}</span>
                      {c.isNpc ? (
                        <span className="text-[10px] text-amber-300">NPC</span>
                      ) : null}
                    </div>
                    <div className="text-[10px] text-zinc-500">
                      gold {formatGold(c.gold)} / {formatDay(c.day ?? 0)}
                    </div>
                  </button>
                );
              })}
              {filteredCharacters.length === 0 ? (
                <div className="rounded-md border border-dashed border-zinc-800 p-3 text-xs text-zinc-500">
                  표시할 캐릭터가 없습니다.
                </div>
              ) : null}
            </div>
          </section>

          <div className="flex min-h-[calc(100vh-180px)] flex-col gap-4">
            <div className="flex gap-2">
              {(
                [
                  { key: "gold", label: "골드 관리" },
                  { key: "inventory", label: "인벤토리" },
                  { key: "sheet", label: "캐릭터 시트" },
                ] as const
              ).map((tab) => {
                const active = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    className={[
                      "rounded-lg border px-3 py-2 text-xs font-semibold",
                      active
                        ? "border-amber-500/70 bg-amber-950/30 text-amber-100"
                        : "border-zinc-800 bg-zinc-950/40 text-zinc-200 hover:border-zinc-700",
                    ].join(" ")}
                    onClick={() => setActiveTab(tab.key)}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {activeTab === "gold" ? (
              <section className="flex-1 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
                <div className="mb-3 text-sm font-semibold text-zinc-200">
                  캐릭터 정보
                </div>

                {selected ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-lg font-semibold text-zinc-100">
                          {selected.name}
                        </div>
                        <div className="text-xs text-zinc-400">
                          {selected.isNpc ? "NPC" : "PC"}
                          {selected.friend ? ` · friend: ${selected.friend}` : ""}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 md:flex-row">
                      <div className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
                        <div className="mb-2 text-xs font-semibold text-zinc-300">
                          소지금
                        </div>
                        <div className="text-2xl font-semibold text-amber-200">
                          {formatGold(selected.gold)}
                        </div>
                      </div>
                      <div className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
                        <div className="mb-2 text-xs font-semibold text-zinc-300">
                          일일 골드 증감
                        </div>
                        {(() => {
                          const delta = getDailyDeltaDisplay(
                            selected.dailyExpense,
                          );
                          return (
                            <div
                              className={[
                                "text-2xl font-semibold",
                                delta.className,
                              ].join(" ")}
                            >
                              {delta.text}
                            </div>
                          );
                        })()}
                      </div>
                      <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3 md:w-24">
                        <div className="mb-2 text-xs font-semibold text-zinc-300">
                          일수
                        </div>
                        <div className="text-base font-semibold text-zinc-200">
                          {formatDay(selected.day ?? 0)}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
                      <div className="mb-2 text-xs font-semibold text-zinc-300">
                        동료 목록
                      </div>
                      {companions.length === 0 ? (
                        <div className="text-xs text-zinc-500">
                          등록된 동료가 없습니다.
                        </div>
                      ) : (
                        <div className="overflow-hidden rounded-md border border-zinc-800">
                          <div className="grid grid-cols-[1fr_110px_130px_70px] bg-zinc-950/60 px-3 py-2 text-[11px] font-semibold text-zinc-400">
                            <span>이름</span>
                            <span className="text-right">소지금</span>
                            <span className="text-right">일일 골드 증감</span>
                            <span className="text-right">일수</span>
                          </div>
                          <div className="divide-y divide-zinc-800">
                            {companions.map((c) => {
                              const delta = getDailyDeltaDisplay(
                                c.dailyExpense,
                              );
                              return (
                                <div
                                  key={c.name}
                                  className="grid grid-cols-[1fr_110px_130px_70px] items-center bg-zinc-950/30 px-3 py-2 text-sm text-zinc-200"
                                >
                                  <span>{c.name}</span>
                                  <span className="text-right text-amber-200">
                                    {formatGold(c.gold)}
                                  </span>
                                  <span
                                    className={[
                                      "text-right",
                                      delta.className,
                                    ].join(" ")}
                                  >
                                    {delta.text}
                                  </span>
                                  <span className="text-right text-zinc-300">
                                    {formatDay(c.day ?? 0)}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-zinc-800 p-4 text-sm text-zinc-500">
                    캐릭터를 선택해 주세요.
                  </div>
                )}
              </section>
            ) : null}
            {activeTab === "inventory" ? (
              <section className="flex-1 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-sm font-semibold text-zinc-200">
                    인벤토리
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className={[
                        "rounded-md border px-2.5 py-1 text-[11px] font-semibold",
                        inventoryMode === "acquire"
                          ? "border-amber-500/70 bg-amber-950/30 text-amber-100"
                          : "border-zinc-800 bg-zinc-950/40 text-zinc-200 hover:border-zinc-700",
                      ].join(" ")}
                      onClick={() =>
                        setInventoryMode(
                          inventoryMode === "acquire" ? "none" : "acquire",
                        )
                      }
                    >
                      아이템 획득
                    </button>
                    <button
                      type="button"
                      className={[
                        "rounded-md border px-2.5 py-1 text-[11px] font-semibold",
                        inventoryMode === "consume"
                          ? "border-amber-500/70 bg-amber-950/30 text-amber-100"
                          : "border-zinc-800 bg-zinc-950/40 text-zinc-200 hover:border-zinc-700",
                      ].join(" ")}
                      onClick={() =>
                        setInventoryMode(
                          inventoryMode === "consume" ? "none" : "consume",
                        )
                      }
                    >
                      아이템 소모
                    </button>
                  </div>
                </div>

                <div className="mb-2 flex flex-wrap items-center gap-2">
                  {ITEM_TYPE_OPTIONS.map((type) => {
                    const active = inventoryType === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        className={[
                          "rounded-md border px-2.5 py-1 text-[11px] font-semibold",
                          active
                            ? "border-amber-500/70 bg-amber-950/30 text-amber-100"
                            : "border-zinc-800 bg-zinc-950/40 text-zinc-200 hover:border-zinc-700",
                        ].join(" ")}
                        onClick={() => setInventoryType(type)}
                        disabled={busy}
                      >
                        {type}
                      </button>
                    );
                  })}
                </div>

                <input
                  value={inventorySearch}
                  onChange={(e) => setInventorySearch(e.target.value)}
                  placeholder="아이템 검색"
                  className="mb-3 h-8 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-100 outline-none focus:border-zinc-600"
                />

                {inventoryMode !== "none" ? (
                  <div className="mb-3 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
                    <div className="mb-2 text-xs font-semibold text-zinc-300">
                      {inventoryMode === "consume"
                        ? "아이템 소모"
                        : "아이템 획득"}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-xs text-zinc-400">
                        {inventoryMode === "consume"
                          ? "선택한 아이템"
                          : "선택한 아이템"}
                        :
                      </div>
                      <div className="text-sm font-semibold text-zinc-100">
                        {inventoryMode === "consume"
                          ? selectedInventoryName ?? "없음"
                          : selectedCatalogName ?? "없음"}
                      </div>
                      <input
                        value={inventoryAmount}
                        onChange={(e) => setInventoryAmount(e.target.value)}
                        placeholder="수량"
                        className="h-8 w-24 rounded-md border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-100 outline-none focus:border-zinc-600"
                      />
                      <button
                        type="button"
                        className="rounded-md bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
                        onClick={
                          inventoryMode === "consume"
                            ? handleConsume
                            : handleAcquire
                        }
                        disabled={
                          busy ||
                          (inventoryMode === "consume"
                            ? !selectedInventoryName
                            : !selectedCatalogName) ||
                          !inventoryAmount.trim()
                        }
                      >
                        적용
                      </button>
                    </div>

                    {inventoryMode === "acquire" ? (
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {catalogResults.length === 0 ? (
                          <div className="col-span-2 text-xs text-zinc-500">
                            검색 결과가 없습니다.
                          </div>
                        ) : (
                          catalogResults.map((entry) => {
                            const active =
                              entry.name === selectedCatalogName;
                            return (
                              <button
                                key={entry.name}
                                type="button"
                                className={[
                                  "rounded-md border px-2 py-1 text-left text-xs",
                                  active
                                    ? "border-amber-500/70 bg-amber-950/30 text-amber-100"
                                    : "border-zinc-800 bg-zinc-950/40 text-zinc-200 hover:border-zinc-700",
                                ].join(" ")}
                                onClick={() => setSelectedCatalogName(entry.name)}
                              >
                                <div
                                  className={qualityColorClass(
                                    entry.qualityLabel,
                                  )}
                                >
                                  {entry.name}
                                </div>
                                <div className="text-[10px] text-zinc-500">
                                  {entry.type}
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {!selected ? (
                  <div className="rounded-lg border border-dashed border-zinc-800 p-4 text-sm text-zinc-500">
                    캐릭터를 선택해 주세요.
                  </div>
                ) : inventoryRows.length === 0 ? (
                  <div className="rounded-md border border-dashed border-zinc-800 p-3 text-xs text-zinc-500">
                    등록된 아이템이 없습니다.
                  </div>
                ) : (
                  <div className="overflow-visible rounded-lg border border-zinc-800">
                    <div className="grid grid-cols-[1fr_80px_4px_1fr_80px] bg-zinc-950/60 px-4 py-2 text-xs font-semibold text-zinc-400">
                      <span>항목</span>
                      <span className="pr-2 text-right">수량</span>
                      <span className="bg-zinc-700/80" aria-hidden="true" />
                      <span className="pl-2 text-right md:text-left">항목</span>
                      <span className="text-right">수량</span>
                    </div>
                    <div className="divide-y divide-zinc-800">
                      {inventoryRows.map((row, idx) => {
                        const left = row[0];
                        const right = row[1];
                        const leftSelected =
                          left && left.itemName === selectedInventoryName;
                        const rightSelected =
                          right && right.itemName === selectedInventoryName;
                          return (
                            <div
                              key={`${left?.itemName ?? "row"}-${idx}`}
                              className="grid grid-cols-[1fr_80px_4px_1fr_80px] items-center bg-zinc-950/30 px-4 py-2 text-sm text-zinc-200"
                            >
                              {left ? (
                                <button
                                  type="button"
                                  className={[
                                    "relative col-span-2 grid grid-cols-[1fr_80px] items-center rounded-md pl-1 pr-2 py-1 text-left",
                                    "hover:bg-zinc-900/40",
                                    leftSelected
                                      ? "bg-amber-950/30 ring-1 ring-amber-500/60"
                                      : "",
                                  ].join(" ")}
                                  onClick={() =>
                                    setSelectedInventoryName(
                                      leftSelected ? null : left.itemName,
                                    )
                                  }
                                >
                                <span
                                  className={qualityColorClass(left.qualityLabel)}
                                >
                                  {left.itemName}
                                </span>
                                <span className="text-right font-semibold text-amber-200">
                                  {left.amount}
                                </span>
                                {leftSelected ? (
                                  <div className="absolute left-0 top-full z-30 mt-2 w-52 rounded-lg border border-zinc-800 bg-zinc-950/95 p-2 text-[11px] text-zinc-200 shadow-xl">
                                    <div className="absolute left-4 top-0 h-2 w-2 -translate-y-1/2 rotate-45 border border-zinc-800 bg-zinc-950/95" />
                                    <div className="font-semibold text-zinc-100">
                                      {left.itemName}
                                    </div>
                                    <div className="mt-1 text-zinc-400">
                                      수량:{" "}
                                      <span className="font-semibold text-amber-200">
                                        {left.amount}
                                      </span>
                                    </div>
                                    <div className="mt-1 text-zinc-400">
                                      등급:{" "}
                                      <span
                                        className={qualityColorClass(
                                          left.qualityLabel,
                                        )}
                                      >
                                        {left.qualityLabel}
                                      </span>
                                    </div>
                                    <div className="mt-1 text-zinc-400">
                                      종류: {left.type}
                                    </div>
                                    <div className="mt-1 text-zinc-400">
                                      단위: {left.unit}
                                    </div>
                                  </div>
                                ) : null}
                              </button>
                            ) : (
                              <div className="col-span-2 grid grid-cols-[1fr_80px] items-center rounded-md px-2 py-1 text-zinc-600">
                                <span>-</span>
                                <span className="text-right">-</span>
                              </div>
                            )}
                            <span
                              className="h-full bg-zinc-700/80"
                              aria-hidden="true"
                            />
                            {right ? (
                              <button
                                type="button"
                                className={[
                                  "relative col-span-2 grid grid-cols-[1fr_80px] items-center rounded-md pl-2 pr-1 py-1 text-left",
                                  "hover:bg-zinc-900/40",
                                  rightSelected
                                    ? "bg-amber-950/30 ring-1 ring-amber-500/60"
                                    : "",
                                ].join(" ")}
                                onClick={() =>
                                  setSelectedInventoryName(
                                    rightSelected ? null : right.itemName,
                                  )
                                }
                              >
                                <span
                                  className={[
                                    "text-right md:text-left",
                                    qualityColorClass(right.qualityLabel),
                                  ].join(" ")}
                                >
                                  {right.itemName}
                                </span>
                                <span className="text-right font-semibold text-amber-200">
                                  {right.amount}
                                </span>
                                {rightSelected ? (
                                  <div className="absolute right-0 top-full z-30 mt-2 w-52 rounded-lg border border-zinc-800 bg-zinc-950/95 p-2 text-[11px] text-zinc-200 shadow-xl">
                                    <div className="absolute right-4 top-0 h-2 w-2 -translate-y-1/2 rotate-45 border border-zinc-800 bg-zinc-950/95" />
                                    <div className="font-semibold text-zinc-100">
                                      {right.itemName}
                                    </div>
                                    <div className="mt-1 text-zinc-400">
                                      수량:{" "}
                                      <span className="font-semibold text-amber-200">
                                        {right.amount}
                                      </span>
                                    </div>
                                    <div className="mt-1 text-zinc-400">
                                      등급:{" "}
                                      <span
                                        className={qualityColorClass(
                                          right.qualityLabel,
                                        )}
                                      >
                                        {right.qualityLabel}
                                      </span>
                                    </div>
                                    <div className="mt-1 text-zinc-400">
                                      종류: {right.type}
                                    </div>
                                    <div className="mt-1 text-zinc-400">
                                      단위: {right.unit}
                                    </div>
                                  </div>
                                ) : null}
                              </button>
                            ) : (
                              <div className="col-span-2 grid grid-cols-[1fr_80px] items-center rounded-md px-2 py-1 text-zinc-600">
                                <span className="text-right md:text-left">-</span>
                                <span className="text-right">-</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {inventoryResult ? (
                  <div
                    className="fixed inset-0 z-40 flex items-center justify-center"
                    role="dialog"
                    aria-modal="true"
                  >
                    <div
                      className="absolute inset-0 bg-black/40"
                      onClick={() => setInventoryResult(null)}
                      role="button"
                      tabIndex={0}
                      aria-label="Close overlay"
                      onKeyDown={(e) =>
                        e.key === "Enter" && setInventoryResult(null)
                      }
                    />
                    <div className="relative z-50 w-[min(360px,92vw)] rounded-2xl border border-zinc-800 bg-zinc-950 p-4 shadow-2xl">
                      <div className="mb-2 text-sm font-semibold text-zinc-100">
                        {inventoryResult.title}
                      </div>
                      <div className="text-sm text-zinc-100">
                        <span className="font-semibold">
                          「{inventoryResult.ownerName}」
                        </span>
                        , [
                        <span
                          className={[
                            "font-semibold",
                            qualityColorClass(inventoryResult.qualityLabel),
                          ].join(" ")}
                        >
                          {inventoryResult.itemName}
                        </span>
                        ] 을(를){" "}
                        {formatItemAmount(
                          inventoryResult.delta,
                          inventoryResult.unit,
                        )}
                        만큼{" "}
                        {inventoryResult.action === "acquire"
                          ? "획득하였다."
                          : "소모하였다."}
                      </div>
                      <div className="mt-1 text-sm text-zinc-300">
                        {formatItemAmount(
                          inventoryResult.before,
                          inventoryResult.unit,
                        )}{" "}
                        →{" "}
                        {formatItemAmount(
                          inventoryResult.after,
                          inventoryResult.unit,
                        )}
                      </div>
                      <div className="mt-4 flex justify-end">
                        <button
                          type="button"
                          className="rounded-md bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600"
                          onClick={() => setInventoryResult(null)}
                        >
                          확인
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
                {inventoryNotice ? (
                  <div
                    className="fixed inset-0 z-40 flex items-center justify-center"
                    role="dialog"
                    aria-modal="true"
                  >
                    <div
                      className="absolute inset-0 bg-black/40"
                      onClick={() => setInventoryNotice(null)}
                      role="button"
                      tabIndex={0}
                      aria-label="Close overlay"
                      onKeyDown={(e) =>
                        e.key === "Enter" && setInventoryNotice(null)
                      }
                    />
                    <div className="relative z-50 w-[min(360px,92vw)] rounded-2xl border border-red-800/60 bg-zinc-950 p-4 shadow-2xl">
                      <div className="mb-2 text-sm font-semibold text-rose-200">
                        {inventoryNotice.title}
                      </div>
                      <div className="text-sm text-zinc-100">
                        <span className="font-semibold">
                          「{inventoryNotice.ownerName}」
                        </span>
                        의 [
                        <span
                          className={[
                            "font-semibold",
                            qualityColorClass(inventoryNotice.qualityLabel),
                          ].join(" ")}
                        >
                          {inventoryNotice.itemName}
                        </span>
                        ] {inventoryNotice.message}
                        <div className="mt-1 text-sm text-zinc-300">
                          {inventoryNotice.detail}
                        </div>
                      </div>
                      <div className="mt-4 flex justify-end">
                        <button
                          type="button"
                          className="rounded-md bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-100 hover:bg-zinc-700"
                          onClick={() => setInventoryNotice(null)}
                        >
                          확인
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </section>
            ) : null}
            {activeTab === "sheet" ? (
              <section className="flex-1 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
                <div className="min-h-[280px]" />
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

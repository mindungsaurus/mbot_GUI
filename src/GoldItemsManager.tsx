import { useEffect, useMemo, useState } from "react";
import type { AuthUser, GoldCharacter, InventoryItem } from "./types";
import { listGoldCharacters, listInventory } from "./api";

type Props = {
  authUser: AuthUser;
  onBack: () => void;
};

const numberFormat = new Intl.NumberFormat("ko-KR");

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

export default function GoldItemsManager({ authUser, onBack }: Props) {
  const isAdmin = !!authUser.isAdmin;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [characters, setCharacters] = useState<GoldCharacter[]>([]);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"gold" | "inventory" | "sheet">(
    "gold",
  );

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selected) {
      setInventory([]);
      return;
    }
    reloadInventory(selected.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.name]);

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
                <div className="mb-3 text-sm font-semibold text-zinc-200">
                  인벤토리
                </div>

                {!selected ? (
                  <div className="rounded-lg border border-dashed border-zinc-800 p-4 text-sm text-zinc-500">
                    캐릭터를 선택해 주세요.
                  </div>
                ) : inventory.length === 0 ? (
                  <div className="rounded-md border border-dashed border-zinc-800 p-3 text-xs text-zinc-500">
                    등록된 아이템이 없습니다.
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-lg border border-zinc-800">
                    <div className="grid grid-cols-[1fr_90px] bg-zinc-950/60 px-3 py-2 text-xs font-semibold text-zinc-400">
                      <span>아이템</span>
                      <span className="text-right">수량</span>
                    </div>
                    <div className="divide-y divide-zinc-800">
                      {inventory.map((item) => (
                        <div
                          key={item.itemName}
                          className="grid grid-cols-[1fr_90px] items-center bg-zinc-950/30 px-3 py-2 text-sm text-zinc-200"
                        >
                          <span>{item.itemName}</span>
                          <span className="text-right text-zinc-300">
                            {item.amount}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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

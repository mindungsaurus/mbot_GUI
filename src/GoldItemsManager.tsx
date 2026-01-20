import { useEffect, useMemo, useState } from "react";
import type { AuthUser, GoldCharacter, InventoryItem, ItemCatalogEntry } from "./types";
import {
  addInventoryItem,
  createGoldCharacter,
  deleteGoldCharacter,
  listGoldCharacters,
  listInventory,
  listItemCatalog,
  updateGoldCharacter,
  useInventoryItem,
} from "./api";

type Props = {
  authUser: AuthUser;
  onBack: () => void;
};

function toNumberInput(value: number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

function parseNumberInput(raw: string): number | undefined {
  if (!raw.trim()) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n)) return undefined;
  return Math.trunc(n);
}

export default function GoldItemsManager({ authUser, onBack }: Props) {
  const isAdmin = !!authUser.isAdmin;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [characters, setCharacters] = useState<GoldCharacter[]>([]);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [catalog, setCatalog] = useState<ItemCatalogEntry[]>([]);

  const [newName, setNewName] = useState("");
  const [newIsNpc, setNewIsNpc] = useState(false);
  const [newFriend, setNewFriend] = useState("");

  const [editGold, setEditGold] = useState("");
  const [editExpense, setEditExpense] = useState("");
  const [editDay, setEditDay] = useState("");
  const [editIsNpc, setEditIsNpc] = useState(false);
  const [editFriend, setEditFriend] = useState("");

  const [itemName, setItemName] = useState("");
  const [itemAmount, setItemAmount] = useState("1");

  const selected = useMemo(
    () => characters.find((c) => c.name === selectedName) ?? null,
    [characters, selectedName],
  );

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
      if (isAdmin) {
        const items = (await listItemCatalog()) as ItemCatalogEntry[];
        setCatalog(items);
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
    if (!selected) return;
    setEditGold(toNumberInput(selected.gold));
    setEditExpense(toNumberInput(selected.dailyExpense));
    setEditDay(toNumberInput(selected.day ?? 0));
    setEditIsNpc(!!selected.isNpc);
    setEditFriend(selected.friend ?? "");
    reloadInventory(selected.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.name]);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) {
      setErr("캐릭터 이름을 입력해 주세요.");
      return;
    }
    try {
      setErr(null);
      setBusy(true);
      await createGoldCharacter({
        name,
        isNpc: newIsNpc,
        friend: newIsNpc ? (newFriend.trim() || null) : null,
      });
      setNewName("");
      setNewIsNpc(false);
      setNewFriend("");
      await reloadCharacters(false);
      setSelectedName(name);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const handleUpdate = async () => {
    if (!selected) return;
    const payload: {
      gold?: number;
      dailyExpense?: number;
      day?: number | null;
      isNpc?: boolean;
      friend?: string | null;
    } = {
      gold: parseNumberInput(editGold),
      dailyExpense: parseNumberInput(editExpense),
      day: parseNumberInput(editDay),
      isNpc: editIsNpc,
      friend: editIsNpc ? (editFriend.trim() || null) : null,
    };

    try {
      setErr(null);
      setBusy(true);
      await updateGoldCharacter(selected.name, payload);
      await reloadCharacters(true);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    if (!confirm(`"${selected.name}" 캐릭터를 삭제할까요?`)) return;
    try {
      setErr(null);
      setBusy(true);
      await deleteGoldCharacter(selected.name);
      setSelectedName(null);
      await reloadCharacters(false);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const handleAddItem = async () => {
    if (!selected) return;
    const name = itemName.trim();
    const amt = parseNumberInput(itemAmount);
    if (!name || !amt || amt <= 0) {
      setErr("아이템 이름과 수량을 확인해 주세요.");
      return;
    }
    try {
      setErr(null);
      setBusy(true);
      await addInventoryItem({
        owner: selected.name,
        itemName: name,
        amount: amt,
      });
      setItemName("");
      setItemAmount("1");
      await reloadInventory(selected.name);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const handleUseItem = async (item: InventoryItem, amount = 1) => {
    if (!selected) return;
    try {
      setErr(null);
      setBusy(true);
      await useInventoryItem({
        owner: selected.name,
        itemName: item.itemName,
        amount,
      });
      await reloadInventory(selected.name);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const handleAdjustItem = async (item: InventoryItem, delta: number) => {
    if (!selected || delta === 0) return;
    try {
      setErr(null);
      setBusy(true);
      if (delta > 0) {
        await addInventoryItem({
          owner: selected.name,
          itemName: item.itemName,
          amount: delta,
        });
      } else {
        await useInventoryItem({
          owner: selected.name,
          itemName: item.itemName,
          amount: Math.abs(delta),
        });
      }
      await reloadInventory(selected.name);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-5xl p-4">
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
              Refresh
            </button>
          </div>
        </header>

        {err ? (
          <div className="mb-4 whitespace-pre-line rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-200">
            {err}
          </div>
        ) : null}

        <div className="grid grid-cols-[220px_1fr] gap-4">
          <section className="h-full rounded-2xl border border-zinc-800 bg-zinc-900/40 p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-semibold text-zinc-200">
                캐릭터 목록
              </div>
              {isAdmin ? (
                <button
                  type="button"
                  className="rounded-md border border-zinc-700 px-2 py-1 text-[10px] text-zinc-200 hover:border-zinc-600"
                  onClick={() => reloadCharacters(true)}
                  disabled={busy}
                >
                  새로고침
                </button>
              ) : null}
            </div>

            <div className="space-y-1">
              {characters.map((c) => {
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
                      gold {c.gold} / day {c.day ?? 0}
                    </div>
                  </button>
                );
              })}
              {characters.length === 0 ? (
                <div className="rounded-md border border-dashed border-zinc-800 p-3 text-xs text-zinc-500">
                  등록된 캐릭터가 없습니다.
                </div>
              ) : null}
            </div>

          </section>

          <div className="flex min-h-[calc(100vh-180px)] flex-col gap-4">
            <section className="shrink-0 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
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
                    {isAdmin ? (
                      <button
                        type="button"
                        className="rounded-md border border-red-800 bg-red-950/40 px-2 py-1 text-xs text-red-200 hover:bg-red-900/40"
                        onClick={handleDelete}
                        disabled={busy}
                      >
                        삭제
                      </button>
                    ) : null}
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
                      <div className="mb-2 text-xs font-semibold text-zinc-300">
                        소지금
                      </div>
                      <div className="text-2xl font-semibold text-amber-200">
                        {selected.gold}
                      </div>
                    </div>
                    <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
                      <div className="mb-2 text-xs font-semibold text-zinc-300">
                        일일 지출 / 일수
                      </div>
                      <div className="text-sm text-zinc-200">
                        {selected.dailyExpense} / {selected.day ?? 0}
                      </div>
                    </div>
                  </div>

                  {isAdmin ? (
                    <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
                      <div className="mb-3 text-xs font-semibold text-zinc-300">
                        캐릭터 정보 수정
                      </div>
                      <div className="grid gap-2 md:grid-cols-2">
                        <input
                          value={editGold}
                          onChange={(e) => setEditGold(e.target.value)}
                          placeholder="gold"
                          className="h-8 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-100 outline-none focus:border-zinc-600"
                        />
                        <input
                          value={editExpense}
                          onChange={(e) => setEditExpense(e.target.value)}
                          placeholder="daily expense"
                          className="h-8 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-100 outline-none focus:border-zinc-600"
                        />
                        <input
                          value={editDay}
                          onChange={(e) => setEditDay(e.target.value)}
                          placeholder="day"
                          className="h-8 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-100 outline-none focus:border-zinc-600"
                        />
                        <label className="flex items-center gap-2 text-xs text-zinc-300">
                          <input
                            type="checkbox"
                            checked={editIsNpc}
                            onChange={(e) => setEditIsNpc(e.target.checked)}
                            className="h-3 w-3"
                          />
                          NPC
                        </label>
                        <input
                          value={editFriend}
                          onChange={(e) => setEditFriend(e.target.value)}
                          placeholder="friend (NPC일 때)"
                          disabled={!editIsNpc}
                          className={[
                            "h-8 w-full rounded-md border px-2 text-xs outline-none",
                            editIsNpc
                              ? "border-zinc-800 bg-zinc-950 text-zinc-100 focus:border-zinc-600"
                              : "border-zinc-900 bg-zinc-900/40 text-zinc-600",
                          ].join(" ")}
                        />
                      </div>
                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          className="rounded-md bg-amber-700 px-3 py-1.5 text-xs text-white hover:bg-amber-600 disabled:opacity-50"
                          onClick={handleUpdate}
                          disabled={busy}
                        >
                          적용
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-zinc-800 p-4 text-sm text-zinc-500">
                  캐릭터를 선택해 주세요.
                </div>
              )}

              {isAdmin ? (
                <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
                  <div className="mb-2 text-xs font-semibold text-zinc-300">
                    캐릭터 추가
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="이름"
                      className="h-8 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-100 outline-none focus:border-zinc-600"
                    />
                    <label className="flex items-center gap-2 text-xs text-zinc-300">
                      <input
                        type="checkbox"
                        checked={newIsNpc}
                        onChange={(e) => setNewIsNpc(e.target.checked)}
                        className="h-3 w-3"
                      />
                      NPC
                    </label>
                    <input
                      value={newFriend}
                      onChange={(e) => setNewFriend(e.target.value)}
                      placeholder="friend (NPC일 때)"
                      disabled={!newIsNpc}
                      className={[
                        "h-8 w-full rounded-md border px-2 text-xs outline-none md:col-span-2",
                        newIsNpc
                          ? "border-zinc-800 bg-zinc-950 text-zinc-100 focus:border-zinc-600"
                          : "border-zinc-900 bg-zinc-900/40 text-zinc-600",
                      ].join(" ")}
                    />
                  </div>
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      className="rounded-md bg-amber-700 px-3 py-1.5 text-xs text-white hover:bg-amber-600 disabled:opacity-50"
                      onClick={handleCreate}
                      disabled={busy}
                    >
                      추가
                    </button>
                  </div>
                </div>
              ) : null}
            </section>

            <section className="flex-1 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
              <div className="mb-3 text-sm font-semibold text-zinc-200">
                인벤토리
              </div>

              {!selected ? (
                <div className="rounded-lg border border-dashed border-zinc-800 p-4 text-sm text-zinc-500">
                  캐릭터를 선택해 주세요.
                </div>
              ) : (
                <>
                  {inventory.length === 0 ? (
                    <div className="rounded-md border border-dashed border-zinc-800 p-3 text-xs text-zinc-500">
                      등록된 아이템이 없습니다.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {inventory.map((item) => (
                        <div
                          key={item.itemName}
                          className="flex items-center justify-between rounded-md border border-zinc-800 bg-zinc-950/40 px-3 py-2"
                        >
                          <div>
                            <div className="text-sm text-zinc-100">
                              {item.itemName}
                            </div>
                            <div className="text-[11px] text-zinc-500">
                              x{item.amount}
                            </div>
                          </div>
                          {isAdmin ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                className="h-7 w-7 rounded-md border border-zinc-700 text-xs text-zinc-200 hover:border-zinc-500"
                                onClick={() => handleAdjustItem(item, -1)}
                                disabled={busy}
                              >
                                -
                              </button>
                              <button
                                type="button"
                                className="h-7 w-7 rounded-md border border-zinc-700 text-xs text-zinc-200 hover:border-zinc-500"
                                onClick={() => handleAdjustItem(item, 1)}
                                disabled={busy}
                              >
                                +
                              </button>
                              <button
                                type="button"
                                className="h-7 rounded-md border border-zinc-700 px-2 text-[10px] text-zinc-200 hover:border-zinc-500"
                                onClick={() => handleUseItem(item, item.amount)}
                                disabled={busy}
                              >
                                전부 제거
                              </button>
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}

                  {isAdmin ? (
                    <div className="mt-3 grid gap-2 md:grid-cols-[1fr_100px_120px]">
                      <div>
                        <input
                          list="item-catalog"
                          value={itemName}
                          onChange={(e) => setItemName(e.target.value)}
                          placeholder="아이템 이름"
                          className="h-8 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-100 outline-none focus:border-zinc-600"
                        />
                        {catalog.length > 0 ? (
                          <datalist id="item-catalog">
                            {catalog.map((c) => (
                              <option key={c.name} value={c.name} />
                            ))}
                          </datalist>
                        ) : null}
                      </div>
                      <input
                        value={itemAmount}
                        onChange={(e) => setItemAmount(e.target.value)}
                        placeholder="수량"
                        className="h-8 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-100 outline-none focus:border-zinc-600"
                      />
                      <button
                        type="button"
                        className="rounded-md bg-amber-700 px-2 py-1.5 text-xs text-white hover:bg-amber-600 disabled:opacity-50"
                        onClick={handleAddItem}
                        disabled={busy}
                      >
                        아이템 추가
                      </button>
                    </div>
                  ) : null}
                </>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

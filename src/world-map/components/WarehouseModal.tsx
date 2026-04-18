import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { listGoldCharacters, listInventory } from "../../api";
import type { GoldCharacter, InventoryItem, ItemCatalogEntry } from "../../types";
import { formatWithCommas } from "../utils";

type Props = {
  open: boolean;
  readOnly?: boolean;
  busy: boolean;
  warehouseEntries: Array<{ name: string; amount: number }>;
  itemCatalogEntries: ItemCatalogEntry[];
  onClose: () => void;
  onAddWarehouseItem: (itemName: string, amount: number) => Promise<void>;
  onDeleteWarehouseItem: (itemName: string) => Promise<void>;
  onImportWarehouseItem: (owner: string, itemName: string, amount: number) => Promise<void>;
  onExportWarehouseItem: (owner: string, itemName: string, amount: number) => Promise<void>;
};

const toPositiveInt = (raw: string, fallback = 1) => {
  const parsed = Math.trunc(Number(raw));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, parsed);
};

export default function WarehouseModal({
  open,
  readOnly = false,
  busy,
  warehouseEntries,
  itemCatalogEntries,
  onClose,
  onAddWarehouseItem,
  onDeleteWarehouseItem,
  onImportWarehouseItem,
  onExportWarehouseItem,
}: Props) {
  const [actionBusy, setActionBusy] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);

  const [catalogQuery, setCatalogQuery] = useState("");
  const [selectedCatalogItem, setSelectedCatalogItem] = useState("");
  const [catalogMenuOpen, setCatalogMenuOpen] = useState(false);
  const [addAmount, setAddAmount] = useState("1");

  const [owners, setOwners] = useState<GoldCharacter[]>([]);
  const [ownersLoading, setOwnersLoading] = useState(false);
  const [ownerQuery, setOwnerQuery] = useState("");
  const [selectedOwner, setSelectedOwner] = useState("");
  const [ownerMenuOpen, setOwnerMenuOpen] = useState(false);

  const [ownerInventory, setOwnerInventory] = useState<InventoryItem[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryQuery, setInventoryQuery] = useState("");
  const [selectedInventoryItem, setSelectedInventoryItem] = useState("");
  const [inventoryMenuOpen, setInventoryMenuOpen] = useState(false);
  const [importAmount, setImportAmount] = useState("1");
  const [warehouseQuery, setWarehouseQuery] = useState("");
  const [selectedWarehouseItem, setSelectedWarehouseItem] = useState("");
  const [warehouseMenuOpen, setWarehouseMenuOpen] = useState(false);
  const [exportOwnerQuery, setExportOwnerQuery] = useState("");
  const [selectedExportOwner, setSelectedExportOwner] = useState("");
  const [exportOwnerMenuOpen, setExportOwnerMenuOpen] = useState(false);
  const [exportAmount, setExportAmount] = useState("1");

  const deferredCatalogQuery = useDeferredValue(catalogQuery);
  const deferredOwnerQuery = useDeferredValue(ownerQuery);
  const deferredInventoryQuery = useDeferredValue(inventoryQuery);
  const deferredWarehouseQuery = useDeferredValue(warehouseQuery);
  const deferredExportOwnerQuery = useDeferredValue(exportOwnerQuery);

  useEffect(() => {
    if (!open) return;
    let disposed = false;
    setOwnersLoading(true);
    setLocalErr(null);
    void listGoldCharacters()
      .then((rows) => {
        if (disposed) return;
        const normalized = Array.isArray(rows)
          ? rows
              .map((entry) => ({
                name: String((entry as any)?.name ?? "").trim(),
                gold: Number((entry as any)?.gold ?? 0) || 0,
                dailyExpense: Number((entry as any)?.dailyExpense ?? 0) || 0,
                day: Number((entry as any)?.day ?? 0) || 0,
                isNpc: !!(entry as any)?.isNpc,
                friend: String((entry as any)?.friend ?? "").trim() || null,
              }))
              .filter((entry) => !!entry.name)
          : [];
        setOwners(normalized);
      })
      .catch((e: any) => {
        if (!disposed) setLocalErr(String(e?.message ?? e));
      })
      .finally(() => {
        if (!disposed) setOwnersLoading(false);
      });
    return () => {
      disposed = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !selectedOwner) {
      setOwnerInventory([]);
      setSelectedInventoryItem("");
      return;
    }
    let disposed = false;
    setInventoryLoading(true);
    setLocalErr(null);
    void listInventory(selectedOwner)
      .then((rows) => {
        if (disposed) return;
        const normalized = Array.isArray(rows)
          ? rows
              .map((entry) => ({
                itemName: String((entry as any)?.itemName ?? "").trim(),
                amount: Math.max(0, Math.trunc(Number((entry as any)?.amount ?? 0) || 0)),
              }))
              .filter((entry) => !!entry.itemName && entry.amount > 0)
          : [];
        setOwnerInventory(normalized);
      })
      .catch((e: any) => {
        if (!disposed) setLocalErr(String(e?.message ?? e));
      })
      .finally(() => {
        if (!disposed) setInventoryLoading(false);
      });
    return () => {
      disposed = true;
    };
  }, [open, selectedOwner]);

  const filteredCatalog = useMemo(() => {
    const q = deferredCatalogQuery.trim().toLowerCase();
    const base = itemCatalogEntries
      .filter((entry) => !!entry.name)
      .sort((a, b) => a.name.localeCompare(b.name, "ko"));
    if (!q) return base.slice(0, 24);
    return base.filter((entry) => entry.name.toLowerCase().includes(q)).slice(0, 24);
  }, [itemCatalogEntries, deferredCatalogQuery]);

  const filteredOwners = useMemo(() => {
    const q = deferredOwnerQuery.trim().toLowerCase();
    const base = owners.slice().sort((a, b) => a.name.localeCompare(b.name, "ko"));
    if (!q) return base.slice(0, 20);
    return base.filter((entry) => entry.name.toLowerCase().includes(q)).slice(0, 20);
  }, [owners, deferredOwnerQuery]);

  const filteredExportOwners = useMemo(() => {
    const q = deferredExportOwnerQuery.trim().toLowerCase();
    const base = owners.slice().sort((a, b) => a.name.localeCompare(b.name, "ko"));
    if (!q) return base.slice(0, 20);
    return base.filter((entry) => entry.name.toLowerCase().includes(q)).slice(0, 20);
  }, [owners, deferredExportOwnerQuery]);

  const filteredInventory = useMemo(() => {
    const q = deferredInventoryQuery.trim().toLowerCase();
    const base = ownerInventory
      .slice()
      .sort((a, b) => a.itemName.localeCompare(b.itemName, "ko"));
    if (!q) return base.slice(0, 24);
    return base.filter((entry) => entry.itemName.toLowerCase().includes(q)).slice(0, 24);
  }, [ownerInventory, deferredInventoryQuery]);

  const selectedInventoryAmount = useMemo(() => {
    if (!selectedInventoryItem) return 0;
    return ownerInventory.find((entry) => entry.itemName === selectedInventoryItem)?.amount ?? 0;
  }, [ownerInventory, selectedInventoryItem]);

  const filteredWarehouse = useMemo(() => {
    const q = deferredWarehouseQuery.trim().toLowerCase();
    const base = warehouseEntries
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, "ko"));
    if (!q) return base.slice(0, 24);
    return base.filter((entry) => entry.name.toLowerCase().includes(q)).slice(0, 24);
  }, [warehouseEntries, deferredWarehouseQuery]);

  const selectedWarehouseAmount = useMemo(() => {
    if (!selectedWarehouseItem) return 0;
    return warehouseEntries.find((entry) => entry.name === selectedWarehouseItem)?.amount ?? 0;
  }, [warehouseEntries, selectedWarehouseItem]);

  const runAction = async (runner: () => Promise<void>) => {
    setActionBusy(true);
    setLocalErr(null);
    try {
      await runner();
    } catch (e: any) {
      setLocalErr(String(e?.message ?? e));
    } finally {
      setActionBusy(false);
    }
  };

  if (!open) return null;

  const disabled = busy || actionBusy || readOnly;

  return (
    <div className="fixed inset-0 z-[95] bg-black/55 p-4">
      <div className="mx-auto mt-12 flex max-h-[calc(100vh-6rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-950">
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <div className="text-sm font-semibold text-zinc-100">창고</div>
          <button
            type="button"
            className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:border-zinc-500"
            onClick={onClose}
          >
            닫기
          </button>
        </div>

        <div className="grid flex-1 gap-4 overflow-y-auto p-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <section className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
            <div className="mb-2 text-xs font-semibold text-zinc-300">현재 보관 아이템</div>
            <div className="max-h-[420px] space-y-1 overflow-y-auto rounded-md border border-zinc-800 bg-zinc-950/50 p-2">
              {warehouseEntries.length === 0 ? (
                <div className="px-1 py-2 text-xs text-zinc-500">창고가 비어 있습니다.</div>
              ) : (
                warehouseEntries.map((entry) => (
                  <div
                    key={`warehouse-row-${entry.name}`}
                    className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 rounded border border-zinc-800 bg-zinc-950/60 px-2 py-1.5"
                  >
                    <div className="truncate text-xs text-zinc-100">📦 {entry.name}</div>
                    <div className="text-xs font-semibold text-emerald-300">
                      {formatWithCommas(entry.amount)}
                    </div>
                    <button
                      type="button"
                      className="rounded border border-red-800/70 bg-red-950/40 px-2 py-0.5 text-[11px] text-red-200 hover:bg-red-900/50 disabled:opacity-50"
                      disabled={disabled}
                      onClick={() =>
                        void runAction(async () => {
                          await onDeleteWarehouseItem(entry.name);
                        })
                      }
                      style={{ visibility: readOnly ? "hidden" : "visible" }}
                    >
                      삭제
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>

          {!readOnly ? (
            <div className="space-y-4">
            <section className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
              <div className="mb-2 text-xs font-semibold text-zinc-300">아이템 추가</div>
              <div className="space-y-2">
                <div className="relative">
                  <input
                    value={catalogQuery}
                    onChange={(e) => {
                      const next = e.target.value;
                      setCatalogQuery(next);
                      setSelectedCatalogItem("");
                      setCatalogMenuOpen(!!next.trim());
                    }}
                    onFocus={() => setCatalogMenuOpen(!!catalogQuery.trim())}
                    placeholder="아이템 검색"
                    className={[
                      "h-9 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-xs outline-none focus:border-zinc-500",
                      selectedCatalogItem ? "text-lime-300" : "text-zinc-100",
                    ].join(" ")}
                  />
                  {catalogMenuOpen && catalogQuery.trim() ? (
                    <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-44 overflow-y-auto rounded-md border border-zinc-700 bg-zinc-950 shadow-xl">
                      {filteredCatalog.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-zinc-500">검색 결과 없음</div>
                      ) : (
                        filteredCatalog.map((entry) => (
                          <button
                            key={`catalog-${entry.name}`}
                            type="button"
                            className="grid w-full grid-cols-[1fr_auto] gap-2 px-3 py-2 text-left text-xs text-zinc-200 hover:bg-zinc-800/60"
                            onClick={() => {
                              setSelectedCatalogItem(entry.name);
                              setCatalogQuery(entry.name);
                              setCatalogMenuOpen(false);
                            }}
                          >
                            <span className="truncate">{entry.name}</span>
                            <span className="text-zinc-500">{entry.unit || "-"}</span>
                          </button>
                        ))
                      )}
                    </div>
                  ) : null}
                </div>
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={addAmount}
                    onChange={(e) => setAddAmount(e.target.value)}
                    className="h-9 rounded-md border border-zinc-700 bg-zinc-950 px-3 text-xs text-zinc-100 outline-none focus:border-zinc-500"
                    placeholder="수량"
                  />
                  <button
                    type="button"
                    className="rounded-md bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
                    disabled={disabled}
                    onClick={() =>
                      void runAction(async () => {
                        const itemName = (selectedCatalogItem || catalogQuery).trim();
                        if (!itemName) throw new Error("추가할 아이템을 선택해 주세요.");
                        await onAddWarehouseItem(itemName, toPositiveInt(addAmount, 1));
                        setAddAmount("1");
                      })
                    }
                  >
                    아이템 추가
                  </button>
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
              <div className="mb-2 text-xs font-semibold text-zinc-300">인벤토리에서 가져오기</div>
              <div className="space-y-2">
                <div className="relative">
                  <input
                    value={ownerQuery}
                    onChange={(e) => {
                      const next = e.target.value;
                      setOwnerQuery(next);
                      setSelectedOwner("");
                      setSelectedInventoryItem("");
                      setOwnerMenuOpen(!!next.trim());
                    }}
                    onFocus={() => setOwnerMenuOpen(!!ownerQuery.trim())}
                    placeholder={ownersLoading ? "캐릭터 불러오는 중..." : "캐릭터 검색"}
                    className={[
                      "h-9 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-xs outline-none focus:border-zinc-500",
                      selectedOwner ? "text-lime-300" : "text-zinc-100",
                    ].join(" ")}
                  />
                  {ownerMenuOpen && ownerQuery.trim() ? (
                    <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-36 overflow-y-auto rounded-md border border-zinc-700 bg-zinc-950 shadow-xl">
                      {filteredOwners.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-zinc-500">검색 결과 없음</div>
                      ) : (
                        filteredOwners.map((owner) => (
                          <button
                            key={`owner-${owner.name}`}
                            type="button"
                            className="w-full px-3 py-2 text-left text-xs text-zinc-200 hover:bg-zinc-800/60"
                            onClick={() => {
                              setSelectedOwner(owner.name);
                              setOwnerQuery(owner.name);
                              setInventoryQuery("");
                              setSelectedInventoryItem("");
                              setOwnerMenuOpen(false);
                            }}
                          >
                            {owner.name}
                          </button>
                        ))
                      )}
                    </div>
                  ) : null}
                </div>

                <div className="relative">
                  <input
                    value={inventoryQuery}
                    onChange={(e) => {
                      const next = e.target.value;
                      setInventoryQuery(next);
                      setSelectedInventoryItem("");
                      setInventoryMenuOpen(!!next.trim());
                    }}
                    onFocus={() =>
                      setInventoryMenuOpen(!!selectedOwner && !!inventoryQuery.trim())
                    }
                    placeholder={
                      selectedOwner
                        ? inventoryLoading
                          ? "인벤토리 불러오는 중..."
                          : "아이템 검색"
                        : "먼저 캐릭터를 선택하세요"
                    }
                    disabled={!selectedOwner}
                    className={[
                      "h-9 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-xs outline-none focus:border-zinc-500 disabled:opacity-50",
                      selectedInventoryItem ? "text-lime-300" : "text-zinc-100",
                    ].join(" ")}
                  />
                  {selectedOwner && inventoryMenuOpen && inventoryQuery.trim() ? (
                    <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-44 overflow-y-auto rounded-md border border-zinc-700 bg-zinc-950 shadow-xl">
                      {filteredInventory.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-zinc-500">검색 결과 없음</div>
                      ) : (
                        filteredInventory.map((item) => (
                          <button
                            key={`inv-${selectedOwner}-${item.itemName}`}
                            type="button"
                            className="grid w-full grid-cols-[1fr_auto] gap-2 px-3 py-2 text-left text-xs text-zinc-200 hover:bg-zinc-800/60"
                            onClick={() => {
                              setSelectedInventoryItem(item.itemName);
                              setInventoryQuery(item.itemName);
                              setInventoryMenuOpen(false);
                            }}
                          >
                            <span className="truncate">{item.itemName}</span>
                            <span className="text-zinc-500">
                              {formatWithCommas(item.amount)}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  ) : null}
                </div>

                {selectedOwner && selectedInventoryItem ? (
                  <div className="text-[11px] text-zinc-400">
                    보유:{" "}
                    <span className="font-semibold text-zinc-200">
                      {formatWithCommas(selectedInventoryAmount)}
                    </span>
                  </div>
                ) : null}

                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={importAmount}
                    onChange={(e) => setImportAmount(e.target.value)}
                    className="h-9 rounded-md border border-zinc-700 bg-zinc-950 px-3 text-xs text-zinc-100 outline-none focus:border-zinc-500"
                    placeholder="가져올 수량"
                  />
                  <button
                    type="button"
                    className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
                    disabled={disabled}
                    onClick={() =>
                      void runAction(async () => {
                        if (!selectedOwner) throw new Error("캐릭터를 선택해 주세요.");
                        const itemName = (selectedInventoryItem || inventoryQuery).trim();
                        if (!itemName) throw new Error("인벤토리 아이템을 선택해 주세요.");
                        const inventoryRow = ownerInventory.find(
                          (entry) => entry.itemName === itemName
                        );
                        if (!inventoryRow) {
                          throw new Error("검색 결과에서 인벤토리 아이템을 선택해 주세요.");
                        }
                        const amount = toPositiveInt(importAmount, 1);
                        if (amount > inventoryRow.amount) {
                          throw new Error("보유 수량보다 많이 가져올 수 없습니다.");
                        }
                        await onImportWarehouseItem(selectedOwner, itemName, amount);
                        setOwnerInventory((prev) =>
                          prev
                            .map((entry) =>
                              entry.itemName === itemName
                                ? { ...entry, amount: Math.max(0, entry.amount - amount) }
                                : entry
                            )
                            .filter((entry) => entry.amount > 0)
                        );
                        const remain = Math.max(0, inventoryRow.amount - amount);
                        if (remain <= 0) {
                          setSelectedInventoryItem("");
                          setInventoryQuery("");
                        } else {
                          setSelectedInventoryItem(itemName);
                          setInventoryQuery(itemName);
                        }
                      })
                    }
                  >
                    인벤토리에서 가져오기
                  </button>
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
              <div className="mb-2 text-xs font-semibold text-zinc-300">인벤토리로 내보내기</div>
              <div className="space-y-2">
                <div className="relative">
                  <input
                    value={exportOwnerQuery}
                    onChange={(e) => {
                      const next = e.target.value;
                      setExportOwnerQuery(next);
                      setSelectedExportOwner("");
                      setExportOwnerMenuOpen(!!next.trim());
                    }}
                    onFocus={() => setExportOwnerMenuOpen(!!exportOwnerQuery.trim())}
                    placeholder={ownersLoading ? "캐릭터 불러오는 중..." : "내보낼 캐릭터 검색"}
                    className={[
                      "h-9 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-xs outline-none focus:border-zinc-500",
                      selectedExportOwner ? "text-lime-300" : "text-zinc-100",
                    ].join(" ")}
                  />
                  {exportOwnerMenuOpen && exportOwnerQuery.trim() ? (
                    <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-36 overflow-y-auto rounded-md border border-zinc-700 bg-zinc-950 shadow-xl">
                      {filteredExportOwners.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-zinc-500">검색 결과 없음</div>
                      ) : (
                        filteredExportOwners.map((owner) => (
                          <button
                            key={`export-owner-${owner.name}`}
                            type="button"
                            className="w-full px-3 py-2 text-left text-xs text-zinc-200 hover:bg-zinc-800/60"
                            onClick={() => {
                              setSelectedExportOwner(owner.name);
                              setExportOwnerQuery(owner.name);
                              setExportOwnerMenuOpen(false);
                            }}
                          >
                            {owner.name}
                          </button>
                        ))
                      )}
                    </div>
                  ) : null}
                </div>

                <div className="relative">
                  <input
                    value={warehouseQuery}
                    onChange={(e) => {
                      const next = e.target.value;
                      setWarehouseQuery(next);
                      setSelectedWarehouseItem("");
                      setWarehouseMenuOpen(!!next.trim());
                    }}
                    onFocus={() => setWarehouseMenuOpen(!!warehouseQuery.trim())}
                    placeholder="창고 아이템 검색"
                    className={[
                      "h-9 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-xs outline-none focus:border-zinc-500",
                      selectedWarehouseItem ? "text-lime-300" : "text-zinc-100",
                    ].join(" ")}
                  />
                  {warehouseMenuOpen && warehouseQuery.trim() ? (
                    <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-44 overflow-y-auto rounded-md border border-zinc-700 bg-zinc-950 shadow-xl">
                      {filteredWarehouse.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-zinc-500">검색 결과 없음</div>
                      ) : (
                        filteredWarehouse.map((entry) => (
                          <button
                            key={`warehouse-pick-${entry.name}`}
                            type="button"
                            className="grid w-full grid-cols-[1fr_auto] gap-2 px-3 py-2 text-left text-xs text-zinc-200 hover:bg-zinc-800/60"
                            onClick={() => {
                              setSelectedWarehouseItem(entry.name);
                              setWarehouseQuery(entry.name);
                              setWarehouseMenuOpen(false);
                            }}
                          >
                            <span className="truncate">{entry.name}</span>
                            <span className="text-zinc-500">
                              {formatWithCommas(entry.amount)}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  ) : null}
                </div>

                {selectedWarehouseItem ? (
                  <div className="text-[11px] text-zinc-400">
                    창고 보유:{" "}
                    <span className="font-semibold text-zinc-200">
                      {formatWithCommas(selectedWarehouseAmount)}
                    </span>
                  </div>
                ) : null}

                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={exportAmount}
                    onChange={(e) => setExportAmount(e.target.value)}
                    className="h-9 rounded-md border border-zinc-700 bg-zinc-950 px-3 text-xs text-zinc-100 outline-none focus:border-zinc-500"
                    placeholder="내보낼 수량"
                  />
                  <button
                    type="button"
                    className="rounded-md bg-sky-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-600 disabled:opacity-50"
                    disabled={disabled}
                    onClick={() =>
                      void runAction(async () => {
                        if (!selectedExportOwner) {
                          throw new Error("내보낼 캐릭터를 선택해 주세요.");
                        }
                        const itemName = (selectedWarehouseItem || warehouseQuery).trim();
                        if (!itemName) throw new Error("창고 아이템을 선택해 주세요.");
                        const row = warehouseEntries.find((entry) => entry.name === itemName);
                        if (!row) throw new Error("검색 결과에서 창고 아이템을 선택해 주세요.");
                        const amount = toPositiveInt(exportAmount, 1);
                        if (amount > row.amount) {
                          throw new Error("창고 보유 수량보다 많이 내보낼 수 없습니다.");
                        }
                        await onExportWarehouseItem(selectedExportOwner, itemName, amount);
                        setExportAmount("1");
                        const remain = Math.max(0, row.amount - amount);
                        if (remain <= 0) {
                          setSelectedWarehouseItem("");
                          setWarehouseQuery("");
                        } else {
                          setSelectedWarehouseItem(itemName);
                          setWarehouseQuery(itemName);
                        }
                      })
                    }
                  >
                    인벤토리로 내보내기
                  </button>
                </div>
              </div>
            </section>
            </div>
          ) : (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3 text-xs text-zinc-400">
              읽기 전용 모드에서는 창고 아이템 조회만 가능합니다.
            </div>
          )}
        </div>

        {localErr ? (
          <div className="border-t border-red-900 bg-red-950/40 px-4 py-2 text-xs text-red-200">
            {localErr}
          </div>
        ) : null}
      </div>
    </div>
  );
}

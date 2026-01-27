import { useEffect, useMemo, useState } from "react";
import type {
  AuthUser,
  GoldCharacter,
  InventoryItem,
  ItemCatalogEntry,
} from "./types";
import {
  addInventoryItem,
  createItemCatalog,
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
  "\uc804\uccb4",
  "\uc7a5\ube44",
  "\uc18c\ubaa8\ud488",
  "\uc2dd\ud488",
  "\uad11\ubb3c",
  "\uc218\ub835\ud488",
  "\ucc44\uc9d1\ubb3c",
  "\uae30\ud0c0\uc544\uc774\ud15c",
  "\ub9e4\uac1c\uccb4",
] as const;

const QUALITY_ORDER = [
  "\uc9c4\uadc0",
  "\uc11c\uc0ac",
  "\uc804\uc124",
  "\uc720\uc77c",
  "\uc601\uc6c5",
  "\ud76c\uadc0",
  "\uace0\uae09",
  "\uc77c\ubc18",
] as const;

const QUALITY_OPTIONS = [
  "\uc77c\ubc18",
  "\uace0\uae09",
  "\ud76c\uadc0",
  "\uc601\uc6c5",
  "\uc9c4\uadc0",
  "\uc11c\uc0ac",
  "\uc804\uc124",
  "\uc720\uc77c",
] as const;

const ITEM_TYPE_PICKER = [
  "\uc7a5\ube44",
  "\uc18c\ubaa8\ud488",
  "\uc2dd\ud488",
  "\uad11\ubb3c",
  "\uc218\ub835\ud488",
  "\ucc44\uc9d1\ubb3c",
  "\uae30\ud0c0\uc544\uc774\ud15c",
  "\ub9e4\uac1c\uccb4",
] as const;

const CATALOG_PAGE_SIZE = 12;

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return "0";
  return numberFormat.format(value);
}

function formatGold(value: number | null | undefined): string {
  return `${formatNumber(value)}G`;
}

function formatDay(value: number | null | undefined): string {
  return `${formatNumber(value)}\u65e5`;
}

function qualityLabelFromNumber(value: number | null | undefined): string {
  switch (value) {
    case 8:
      return "\uc720\uc77c";
    case 7:
      return "\uc804\uc124";
    case 6:
      return "\uc11c\uc0ac";
    case 5:
      return "\uc9c4\uadc0";
    case 4:
      return "\uc601\uc6c5";
    case 3:
      return "\ud76c\uadc0";
    case 2:
      return "\uace0\uae09";
    case 1:
      return "\uc77c\ubc18";
    default:
      return "\uc77c\ubc18";
  }
}

function qualityColorClass(label: string): string {
  switch (label) {
    case "\uc720\uc77c":
      return "text-teal-300";
    case "\uc804\uc124":
      return "text-yellow-300";
    case "\uc11c\uc0ac":
      return "text-red-300";
    case "\uc9c4\uadc0":
      return "text-zinc-300";
    case "\uc601\uc6c5":
      return "text-fuchsia-300";
    case "\ud76c\uadc0":
      return "text-sky-300";
    case "\uace0\uae09":
      return "text-lime-300";
    default:
      return "text-zinc-100";
  }
}

function qualityColorValue(label: string): string {
  switch (label) {
    case "\uc720\uc77c":
      return "#5eead4";
    case "\uc804\uc124":
      return "#fde047";
    case "\uc11c\uc0ac":
      return "#fca5a5";
    case "\uc9c4\uadc0":
      return "#d4d4d8";
    case "\uc601\uc6c5":
      return "#f0abfc";
    case "\ud76c\uadc0":
      return "#7dd3fc";
    case "\uace0\uae09":
      return "#bef264";
    default:
      return "#e4e4e7";
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

function getEulReul(word: string): string {
  if (!word) return "\ub97c";
  const code = word.charCodeAt(word.length - 1);
  if (code < 0xac00 || code > 0xd7a3) return "\ub97c";
  return (code - 0xac00) % 28 === 0 ? "\ub97c" : "\uc744";
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
    useState<(typeof ITEM_TYPE_OPTIONS)[number]>(ITEM_TYPE_OPTIONS[0]);
  const [inventorySearch, setInventorySearch] = useState("");
  const [selectedInventoryName, setSelectedInventoryName] = useState<
    string | null
  >(null);
  const [selectedCatalogName, setSelectedCatalogName] = useState<string | null>(
    null,
  );
  const [catalogPage, setCatalogPage] = useState(0);
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
  const [newItemOpen, setNewItemOpen] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemUnit, setNewItemUnit] = useState("");
  const [newItemAmount, setNewItemAmount] = useState("1");
  const [newItemQuality, setNewItemQuality] = useState<
    (typeof QUALITY_OPTIONS)[number]
  >(QUALITY_OPTIONS[0]);
  const [newItemType, setNewItemType] = useState<
    (typeof ITEM_TYPE_PICKER)[number]
  >(ITEM_TYPE_PICKER[0]);

  const [inventoryConfirm, setInventoryConfirm] = useState<{
    mode: "consume" | "acquire";
    itemName: string;
    amount: number;
    qualityLabel: string;
    unit?: string | null;
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

  const catalogFiltered = useMemo(() => {
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
        if (inventoryType !== ITEM_TYPE_OPTIONS[0] && entry.type !== inventoryType) return false;
        if (term && !entry.name.toLowerCase().includes(term)) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.qualityRank !== b.qualityRank) {
          return a.qualityRank - b.qualityRank;
        }
        return a.name.localeCompare(b.name, "ko");
      });
  }, [catalog, inventorySearch, inventoryType]);

  const catalogPageCount = useMemo(() => {
    return Math.max(1, Math.ceil(catalogFiltered.length / CATALOG_PAGE_SIZE));
  }, [catalogFiltered.length]);

  const catalogPageItems = useMemo(() => {
    const start = catalogPage * CATALOG_PAGE_SIZE;
    return catalogFiltered.slice(start, start + CATALOG_PAGE_SIZE);
  }, [catalogFiltered, catalogPage]);

  useEffect(() => {
    setCatalogPage(0);
  }, [inventorySearch, inventoryType, catalog, inventoryMode]);

  useEffect(() => {
    if (!selectedCatalogName) return;
    if (!catalogFiltered.some((item) => item.name === selectedCatalogName)) {
      setSelectedCatalogName(null);
    }
  }, [catalogFiltered, selectedCatalogName]);

  const inventoryRows = useMemo(() => {
    const rankMap = new Map<string, number>();
    QUALITY_ORDER.forEach((label, idx) => rankMap.set(label, idx));
    const term = inventorySearch.trim().toLowerCase();
    const list = inventory
      .map((item) => {
        const meta = catalogByName.get(item.itemName);
        const qualityLabel = qualityLabelFromNumber(meta?.quality);
        const type = meta?.type ?? "\uae30\ud0c0\uc544\uc774\ud15c";
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
        if (inventoryType !== ITEM_TYPE_OPTIONS[0] && item.type !== inventoryType) return false;
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

  const openInventoryConfirm = (mode: "consume" | "acquire") => {
    if (!selected) return;
    const itemName =
      mode === "consume" ? selectedInventoryName : selectedCatalogName;
    if (!itemName) {
      setErr(
        mode === "consume"
          ? "\uc544\uc774\ud15c \uc18c\ubaa8\ud560 \uc544\uc774\ud15c\uc744 \uc120\ud0dd\ud574 \uc8fc\uc138\uc694."
          : "\uc544\uc774\ud15c \ud68d\ub4dd\ud560 \uc544\uc774\ud15c\uc744 \uc120\ud0dd\ud574 \uc8fc\uc138\uc694.",
      );
      return;
    }
    const amount = parseAmount(inventoryAmount);
    if (!amount) {
      setErr(
        mode === "consume"
          ? "\uc18c\ubaa8 \uc218\ub7c9\uc744 \uc785\ub825\ud574 \uc8fc\uc138\uc694."
          : "\ud68d\ub4dd \uc218\ub7c9\uc744 \uc785\ub825\ud574 \uc8fc\uc138\uc694.",
      );
      return;
    }
    const qualityLabel = qualityLabelFromNumber(
      catalogByName.get(itemName)?.quality,
    );
    const unit = catalogByName.get(itemName)?.unit ?? null;
    setInventoryConfirm({
      mode,
      itemName,
      amount,
      qualityLabel,
      unit,
    });
  };

  const handleCreateCatalog = async () => {
    if (!selected) {
      setErr("\uce90\ub9ad\ud130\ub97c \uc120\ud0dd\ud574 \uc8fc\uc138\uc694.");
      return;
    }
    if (!isAdmin) {
      setErr("\uad00\ub9ac\uc790 \uad8c\ud55c\uc774 \ud544\uc694\ud569\ub2c8\ub2e4.");
      return;
    }
    const name = newItemName.trim();
    const unit = newItemUnit.trim();
    if (!name) {
      setErr("\uc544\uc774\ud15c \uc774\ub984\uc744 \uc785\ub825\ud574 \uc8fc\uc138\uc694.");
      return;
    }
    if (!unit) {
      setErr("\ub2e8\uc704\ub97c \uc785\ub825\ud574 \uc8fc\uc138\uc694.");
      return;
    }
    const amount = parseAmount(newItemAmount);
    if (!amount) {
      setErr("\uc218\ub7c9\uc744 \uc785\ub825\ud574 \uc8fc\uc138\uc694.");
      return;
    }
    try {
      setErr(null);
      setBusy(true);
      await createItemCatalog({
        itemName: name,
        quality: newItemQuality,
        type: newItemType,
        unit,
      });
      await reloadCatalog();
      setSelectedCatalogName(name);
      setNewItemOpen(false);
      setInventoryConfirm({
        mode: "acquire",
        itemName: name,
        amount,
        qualityLabel: newItemQuality,
        unit,
      });
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };



  const handleConsume = async () => {
  if (!selected) return;
  if (!selectedInventoryName) {
    setErr("\uc18c\ubaa8\ud560 \uc544\uc774\ud15c\uc744 \uc120\ud0dd\ud574 \uc8fc\uc138\uc694.");
    return;
  }
  const amount = parseAmount(inventoryAmount);
  if (!amount) {
    setErr("\uc18c\ubaa8 \uc218\ub7c9\uc744 \uc785\ub825\ud574 \uc8fc\uc138\uc694.");
    return;
  }
  const beforeItem = inventory.find(
    (item) => item.itemName === selectedInventoryName,
  );
  if (!beforeItem) {
    setErr("\uc120\ud0dd\ud55c \uc544\uc774\ud15c\uc774 \uc778\ubca4\ud1a0\ub9ac\uc5d0 \uc5c6\uc2b5\ub2c8\ub2e4.");
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
    setInventoryNotice(null);
    await useInventoryItem({
      owner: selected.name,
      itemName: selectedInventoryName,
      amount,
    });
    await reloadInventory(selected.name);
    const delta = Math.min(before, amount);
    const after = Math.max(0, before - delta);
    setInventoryResult({
      title: "\uc544\uc774\ud15c \uc18c\ubaa8 \uacb0\uacfc",
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
      setInventoryResult(null);
      setInventoryNotice({
        title: "\uc544\uc774\ud15c \uc18c\ubaa8 \uc2e4\ud328",
        ownerName: selected.name,
        itemName: selectedInventoryName,
        qualityLabel,
        message: `\ubcf4\uc720 \uc218\ub7c9\uc774 \ubd80\uc871\ud569\ub2c8\ub2e4.`,
        detail: `(\uc694\uccad: ${formatItemAmount(amount, unit)}, \ubcf4\uc720: ${formatItemAmount(
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
    setErr("\ud68d\ub4dd\ud560 \uc544\uc774\ud15c\uc744 \uc120\ud0dd\ud574 \uc8fc\uc138\uc694.");
    return;
  }
  const amount = parseAmount(inventoryAmount);
  if (!amount) {
    setErr("\ud68d\ub4dd \uc218\ub7c9\uc744 \uc785\ub825\ud574 \uc8fc\uc138\uc694.");
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
    setInventoryNotice(null);
    await addInventoryItem({
      owner: selected.name,
      itemName: selectedCatalogName,
      amount,
    });
    await reloadInventory(selected.name);
    const delta = amount;
    const after = before + delta;
    setInventoryResult({
      title: "\uc544\uc774\ud15c \ud68d\ub4dd \uacb0\uacfc",
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
                        {"\uc120\ud0dd\ud55c \uc544\uc774\ud15c"}:
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
            >{"\uc0c8\ub85c\uace0\uce68"}</button>
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
              <div className="text-sm font-semibold text-zinc-200">{"\uce90\ub9ad\ud130 \ubaa9\ub85d"}</div>
              <button
                type="button"
                className="rounded-md border border-zinc-700 px-2 py-1 text-[10px] text-zinc-200 hover:border-zinc-600"
                onClick={() => reloadCharacters(true)}
                disabled={busy}
              >{"\uc0c8\ub85c\uace0\uce68"}</button>
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
                    {"\ub4f1\ub85d\ub41c \uc544\uc774\ud15c\uc774 \uc5c6\uc2b5\ub2c8\ub2e4."}
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
                  {"\uce90\ub9ad\ud130 \uc815\ubcf4"}
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
                          {selected.friend ? ` / friend: ${selected.friend}` : ""}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 md:flex-row">
                      <div className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
                        <div className="mb-2 text-xs font-semibold text-zinc-300">
                          {"\uc18c\uc9c0\uae08"}
                        </div>
                        <div className="text-2xl font-semibold text-amber-200">
                          {formatGold(selected.gold)}
                        </div>
                      </div>
                      <div className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
                        <div className="mb-2 text-xs font-semibold text-zinc-300">
                          {"\uc77c\uc77c \uace8\ub4dc \uc99d\uac10"}
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
                          {"\uc77c\uc218"}
                        </div>
                        <div className="text-base font-semibold text-zinc-200">
                          {formatDay(selected.day ?? 0)}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
                      <div className="mb-2 text-xs font-semibold text-zinc-300">
                        {"\ub3d9\ub8cc \ubaa9\ub85d"}
                      </div>
                      {companions.length === 0 ? (
                        <div className="text-xs text-zinc-500">
                          {"\ub4f1\ub85d\ub41c \ub3d9\ub8cc\uac00 \uc5c6\uc2b5\ub2c8\ub2e4."}
                        </div>
                      ) : (
                        <div className="overflow-hidden rounded-md border border-zinc-800">
                          <div className="grid grid-cols-[1fr_110px_130px_70px] bg-zinc-950/60 px-3 py-2 text-[11px] font-semibold text-zinc-400">
                            <span>{"\uc774\ub984"}</span>
                            <span className="text-right">{"\uc18c\uc9c0\uae08"}</span>
                            <span className="text-right">
                              {"\uc77c\uc77c \uace8\ub4dc \uc99d\uac10"}
                            </span>
                            <span className="text-right">{"\uc77c\uc218"}</span>
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
                    {"\uce90\ub9ad\ud130\ub97c \uc120\ud0dd\ud574 \uc8fc\uc138\uc694."}
                  </div>
                )}
              </section>
            ) : null}
            {activeTab === "inventory" ? (
              <section className="flex-1 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-sm font-semibold text-zinc-200">{"\uce90\ub9ad\ud130 \ubaa9\ub85d"}</div>
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
                      {"\uc544\uc774\ud15c \ud68d\ub4dd"}
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
                      {"\uc544\uc774\ud15c \uc18c\ubaa8"}
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
                  placeholder={"아이템 검색"}
                  className="mb-3 h-8 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-100 outline-none focus:border-zinc-600"
                />

                {inventoryMode !== "none" ? (
                  <div className="mb-3 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
                    <div className="mb-2 text-xs font-semibold text-zinc-300">
                      {inventoryMode === "consume" ? "\uc544\uc774\ud15c \uc18c\ubaa8" : "\uc544\uc774\ud15c \ud68d\ub4dd"}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-xs text-zinc-400">
                        {"\uc120\ud0dd\ud55c \uc544\uc774\ud15c"}:
                      </div>
                      <div
                        className={[
                          "text-sm font-semibold",
                          inventoryMode === "consume"
                            ? qualityColorClass(
                                qualityLabelFromNumber(
                                  catalogByName.get(selectedInventoryName ?? "")
                                    ?.quality,
                                ),
                              )
                            : qualityColorClass(
                                qualityLabelFromNumber(
                                  catalogByName.get(selectedCatalogName ?? "")
                                    ?.quality,
                                ),
                              ),
                        ].join(" ")}
                      >
                        {inventoryMode === "consume"
                          ? selectedInventoryName ?? "\uc5c6\uc74c"
                          : selectedCatalogName ?? "\uc5c6\uc74c"}
                      </div>
                      <input
                        value={inventoryAmount}
                        onChange={(e) => setInventoryAmount(e.target.value)}
                        placeholder={"수량"}
                        className="h-8 w-24 rounded-md border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-100 outline-none focus:border-zinc-600"
                      />
                      <button
                        type="button"
                        className="rounded-md bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
                        onClick={() =>
                          openInventoryConfirm(
                            inventoryMode === "consume" ? "consume" : "acquire",
                          )
                        }
                        disabled={
                          busy ||
                          (inventoryMode === "consume"
                            ? !selectedInventoryName
                            : !selectedCatalogName) ||
                          !inventoryAmount.trim()
                        }
                      >
                        {"\uc801\uc6a9"}
                      </button>
                    </div>

                    {inventoryMode === "acquire" ? (
                      <div className="mt-2 text-xs text-zinc-500">
                        {"\uc544\ub798 \ubaa9\ub85d\uc5d0\uc11c \uc544\uc774\ud15c\uc744 \uc120\ud0dd\ud558\uc138\uc694."}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {inventoryMode === "acquire" ? (
                  <>
                    <button
                      type="button"
                      className="mb-2 w-full rounded-lg border border-amber-500/60 bg-amber-700/70 px-4 py-2 text-center text-xs font-semibold text-amber-50 hover:bg-amber-600/80"
                      onClick={() => {
                        setNewItemName("");
                        setNewItemUnit("");
                        setNewItemAmount(inventoryAmount || "1");
                        setNewItemQuality(QUALITY_OPTIONS[0]);
                        setNewItemType(ITEM_TYPE_PICKER[0]);
                        setNewItemOpen(true);
                      }}
                    >
                      {"\uc0c8 \uc544\uc774\ud15c \ub4f1\ub85d \ud6c4 \ud68d\ub4dd\ud558\uae30"}
                    </button>
                    <div className="overflow-visible rounded-lg border border-zinc-800">
                      <div className="grid grid-cols-[minmax(0,1fr)_90px_90px_70px] gap-2 bg-zinc-950/60 px-4 py-2 text-xs font-semibold text-zinc-400">
                      <span>{"\ud56d\ubaa9"}</span>
                      <span>{"\ub4f1\uae09"}</span>
                      <span>{"\uc885\ub958"}</span>
                      <span className="text-right">{"\ub2e8\uc704"}</span>
                    </div>
                    <div className="divide-y divide-zinc-800">
                      {catalogPageItems.length === 0 ? (
                        <div className="px-4 py-3 text-xs text-zinc-500">
                        {"\uac80\uc0c9 \uacb0\uacfc\uac00 \uc5c6\uc2b5\ub2c8\ub2e4."}
                      </div>
                      ) : (
                        catalogPageItems.map((entry) => {
                          const active = entry.name === selectedCatalogName;
                          return (
                            <button
                              key={entry.name}
                              type="button"
                              className={[
                                "grid w-full grid-cols-[minmax(0,1fr)_90px_90px_70px] items-center gap-2 px-4 py-2 text-left text-sm",
                                active
                                  ? "bg-amber-950/30 ring-1 ring-amber-500/60"
                                  : "bg-zinc-950/20 hover:bg-zinc-900/40",
                              ].join(" ")}
                              onClick={() => setSelectedCatalogName(entry.name)}
                            >
                              <span className={qualityColorClass(entry.qualityLabel)}>
                                {entry.name}
                              </span>
                              <span className={qualityColorClass(entry.qualityLabel)}>
                                {entry.qualityLabel}
                              </span>
                              <span className={qualityColorClass(entry.qualityLabel)}>{entry.type}</span>
                              <span className={"text-right " + qualityColorClass(entry.qualityLabel)}>

                                {entry.unit ?? "-"}
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>
                    <div className="flex items-center justify-center gap-3 border-t border-zinc-800 bg-zinc-950/40 px-4 py-2 text-sm text-zinc-300">
                      <button
                        type="button"
                        className="rounded-md border border-zinc-700 px-2 py-1 text-lg leading-none disabled:opacity-40"
                        onClick={() =>
                          setCatalogPage((prev) => Math.max(0, prev - 1))
                        }
                        disabled={catalogPage <= 0}
                      >
                        {"\u2B05\uFE0F"}
                      </button>
                      <span className="text-xs text-zinc-400">
                        {catalogPage + 1} / {catalogPageCount}
                      </span>
                      <button
                        type="button"
                        className="rounded-md border border-zinc-700 px-2 py-1 text-lg leading-none disabled:opacity-40"
                        onClick={() =>
                          setCatalogPage((prev) =>
                            Math.min(catalogPageCount - 1, prev + 1),
                          )
                        }
                        disabled={catalogPage >= catalogPageCount - 1}
                      >
                        {"\u27A1\uFE0F"}
                      </button>
                    </div>
                  </div>
                  </>
                ) : !selected ? (
                  <div className="rounded-lg border border-dashed border-zinc-800 p-4 text-sm text-zinc-500">
                    {"\uce90\ub9ad\ud130\ub97c \uc120\ud0dd\ud574 \uc8fc\uc138\uc694."}
                  </div>
                ) : inventoryRows.length === 0 ? (
                  <div className="rounded-md border border-dashed border-zinc-800 p-3 text-xs text-zinc-500">
                    {"\ub4f1\ub85d\ub41c \uc544\uc774\ud15c\uc774 \uc5c6\uc2b5\ub2c8\ub2e4."}
                  </div>
                ) : (
                  <div className="overflow-visible rounded-lg border border-zinc-800">
                    <div className="grid grid-cols-[1fr_80px_4px_1fr_80px] bg-zinc-950/60 px-4 py-2 text-xs font-semibold text-zinc-400">
                      <span>{"\ud56d\ubaa9"}</span>
                      <span className="pr-2 text-right">{"\uc218\ub7c9"}</span>
                      <span className="bg-zinc-700/80" aria-hidden="true" />
                      <span className="pl-2 text-right md:text-left">{"\ud56d\ubaa9"}</span>
                      <span className="text-right">{"\uc218\ub7c9"}</span>
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
                                      {"\uc218\ub7c9"}:{" "}
                                      <span className="font-semibold text-amber-200">
                                        {left.amount}
                                      </span>
                                    </div>
                                    <div className="mt-1 text-zinc-400">
                                      {"\ub4f1\uae09"}:{" "}
                                      <span
                                        className={qualityColorClass(
                                          left.qualityLabel,
                                        )}
                                      >
                                        {left.qualityLabel}
                                      </span>
                                    </div>
                                    <div className="mt-1 text-zinc-400">
                                      {"\uc885\ub958"}: {left.type}
                                    </div>
                                    <div className="mt-1 text-zinc-400">
                                      {"\ub2e8\uc704"}: {left.unit}
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
                                      {"\uc218\ub7c9"}:{" "}
                                      <span className="font-semibold text-amber-200">
                                        {right.amount}
                                      </span>
                                    </div>
                                    <div className="mt-1 text-zinc-400">
                                      {"\ub4f1\uae09"}:{" "}
                                      <span
                                        className={qualityColorClass(
                                          right.qualityLabel,
                                        )}
                                      >
                                        {right.qualityLabel}
                                      </span>
                                    </div>
                                    <div className="mt-1 text-zinc-400">
                                      {"\uc885\ub958"}: {right.type}
                                    </div>
                                    <div className="mt-1 text-zinc-400">
                                      {"\ub2e8\uc704"}: {right.unit}
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

                {newItemOpen ? (
                  <div
                    className="fixed inset-0 z-40 flex items-center justify-center"
                    role="dialog"
                    aria-modal="true"
                  >
                    <div
                      className="absolute inset-0 bg-black/40"
                      onClick={() => setNewItemOpen(false)}
                      role="button"
                      tabIndex={0}
                      aria-label="Close overlay"
                      onKeyDown={(e) =>
                        e.key === "Enter" && setNewItemOpen(false)
                      }
                    />
                    <div className="relative z-50 w-[min(480px,92vw)] rounded-2xl border border-zinc-800 bg-zinc-950 p-4 shadow-2xl">
                      <div className="mb-3 text-sm font-semibold text-zinc-100">
                        {"\uc0c8 \uc544\uc774\ud15c \ub4f1\ub85d"}
                      </div>
                      <div className="grid gap-3">
                        <label className="grid gap-1 text-xs text-zinc-400">
                          {"\uc544\uc774\ud15c \uc774\ub984"}
                          <input
                            value={newItemName}
                            onChange={(e) => setNewItemName(e.target.value)}
                            className="h-8 rounded-md border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-100 outline-none focus:border-zinc-600"
                          />
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <label className="grid gap-1 text-xs text-zinc-400">
                            {"\ub2e8\uc704"}
                            <input
                              value={newItemUnit}
                              onChange={(e) => setNewItemUnit(e.target.value)}
                              className="h-8 rounded-md border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-100 outline-none focus:border-zinc-600"
                            />
                          </label>
                          <label className="grid gap-1 text-xs text-zinc-400">
                            {"\uc218\ub7c9"}
                            <input
                              value={newItemAmount}
                              onChange={(e) => setNewItemAmount(e.target.value)}
                              className="h-8 rounded-md border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-100 outline-none focus:border-zinc-600"
                            />
                          </label>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <label className="grid gap-1 text-xs text-zinc-400">
                            {"\ub4f1\uae09"}
                            <select
                              value={newItemQuality}
                              onChange={(e) =>
                                setNewItemQuality(
                                  e.target.value as (typeof QUALITY_OPTIONS)[number],
                                )
                              }
                              className={[
                                "h-8 rounded-md border border-zinc-800 bg-zinc-950 px-2 text-xs outline-none focus:border-zinc-600",
                                qualityColorClass(newItemQuality),
                              ].join(" ")}
                            >
                              {QUALITY_OPTIONS.map((q) => (
                                <option key={q} value={q} style={{ color: qualityColorValue(q) }}>
                                  {q}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="grid gap-1 text-xs text-zinc-400">
                            {"\uc885\ub958"}
                            <select
                              value={newItemType}
                              onChange={(e) =>
                                setNewItemType(
                                  e.target.value as (typeof ITEM_TYPE_PICKER)[number],
                                )
                              }
                              className="h-8 rounded-md border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-100 outline-none focus:border-zinc-600"
                            >
                              {ITEM_TYPE_PICKER.map((t) => (
                                <option key={t} value={t}>
                                  {t}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      </div>
                      <div className="mt-4 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-100 hover:border-zinc-600"
                          onClick={() => setNewItemOpen(false)}
                        >
                          {"\ucde8\uc18c"}
                        </button>
                        <button
                          type="button"
                          className="rounded-md bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600"
                          onClick={handleCreateCatalog}
                        >
                          {"\ub4f1\ub85d \ud6c4 \ud68d\ub4dd"}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

                {inventoryConfirm ? (
                  <div
                    className="fixed inset-0 z-40 flex items-center justify-center"
                    role="dialog"
                    aria-modal="true"
                  >
                    <div
                      className="absolute inset-0 bg-black/40"
                      onClick={() => setInventoryConfirm(null)}
                      role="button"
                      tabIndex={0}
                      aria-label="Close overlay"
                      onKeyDown={(e) =>
                        e.key === "Enter" && setInventoryConfirm(null)
                      }
                    />
                    <div className="relative z-50 w-[min(360px,92vw)] rounded-2xl border border-zinc-800 bg-zinc-950 p-4 shadow-2xl">
                      <div className="mb-2 text-sm font-semibold text-zinc-100">
                        {inventoryConfirm.mode === "consume"
                          ? "\uc544\uc774\ud15c \uc18c\ubaa8 \ud655\uc778"
                          : "\uc544\uc774\ud15c \ud68d\ub4dd \ud655\uc778"}
                      </div>
                      <div className="text-sm text-zinc-100">
                        <span className="font-semibold">
                          {"\u300c"}
                          <span className="text-amber-200">{selected?.name ?? ""}</span>
                          {"\u300d"}
                        </span>
                        {",  ["}
                        <span
                          className={[
                            "font-semibold",
                            qualityColorClass(inventoryConfirm.qualityLabel),
                          ].join(" ")}
                        >
                          {inventoryConfirm.itemName}
                        </span>
                        {"]"}
                        {getEulReul(inventoryConfirm.itemName)}
                        {" "}
                        {formatItemAmount(
                          inventoryConfirm.amount,
                          inventoryConfirm.unit,
                        )}
                        {"\ub9cc\ud07c "}
                        {inventoryConfirm.mode === "consume"
                          ? "\uc18c\ubaa8"
                          : "\ud68d\ub4dd"}
                        {"\ud569\ub2c8\ub2e4."}
                      </div>
                      <div className="mt-4 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-100 hover:border-zinc-600"
                          onClick={() => setInventoryConfirm(null)}
                        >
                          {"\ucde8\uc18c"}
                        </button>
                        <button
                          type="button"
                          className="rounded-md bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600"
                          onClick={() => {
                            const mode = inventoryConfirm.mode;
                            setInventoryConfirm(null);
                            if (mode === "consume") {
                              handleConsume();
                            } else {
                              handleAcquire();
                            }
                          }}
                        >
                          {"\uc801\uc6a9"}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

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
                          {"\u300c"}
                          <span className="text-amber-200">{inventoryResult.ownerName}</span>
                          {"\u300d"}
                        </span>
                        {",  ["}
                        <span
                          className={[
                            "font-semibold",
                            qualityColorClass(inventoryResult.qualityLabel),
                          ].join(" ")}
                        >
                          {inventoryResult.itemName}
                        </span>
                        {"]"}
                        {getEulReul(inventoryResult.itemName)}
                        {" "}
                        {formatItemAmount(
                          inventoryResult.delta,
                          inventoryResult.unit,
                        )}
                        {"\ub9cc\ud07c "}
                        {inventoryResult.action === "acquire"
                          ? "\ud68d\ub4dd\ud558\uc600\ub2e4."
                          : "\uc18c\ubaa8\ud558\uc600\ub2e4."}
                      </div>
                      <div className="mt-1 text-sm text-zinc-300">
                        {"(\ub0a8\uc740 \uc218\ub7c9: "}
                        {formatItemAmount(
                          inventoryResult.before,
                          inventoryResult.unit,
                        )}
                        {" \u2192 "}
                        {formatItemAmount(
                          inventoryResult.after,
                          inventoryResult.unit,
                        )}
                        {")"}
                      </div>

                      <div className="mt-4 flex justify-end">
                        <button
                          type="button"
                          className="rounded-md bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600"
                          onClick={() => setInventoryResult(null)}
                        >
                          {"\ud655\uc778"}
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
                          {"\u300c"}
                          {inventoryNotice.ownerName}
                          {"\u300d"}
                        </span>
                        , [
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
                          {"\ud655\uc778"}
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




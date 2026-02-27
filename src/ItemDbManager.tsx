import { useEffect, useMemo, useState } from "react";
import type { AuthUser, ItemCatalogEntry } from "./types";
import { listItemCatalog } from "./api";

type Props = {
  authUser: AuthUser;
  onBack: () => void;
};

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
  "진귀",
  "서사",
  "전설",
  "유일",
  "영웅",
  "희귀",
  "고급",
  "일반",
] as const;

const PAGE_SIZE = 12;

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

export default function ItemDbManager({ authUser, onBack }: Props) {
  const isAdmin = !!authUser.isAdmin;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<ItemCatalogEntry[]>([]);
  const [dbType, setDbType] =
    useState<(typeof ITEM_TYPE_OPTIONS)[number]>(ITEM_TYPE_OPTIONS[0]);
  const [dbSearch, setDbSearch] = useState("");
  const [page, setPage] = useState(0);

  const loadCatalog = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await listItemCatalog();
      const items = Array.isArray(res?.items) ? res.items : res;
      setCatalog(items ?? []);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void loadCatalog();
  }, []);

  const prepared = useMemo(() => {
    return catalog.map((entry) => ({
      ...entry,
      qualityLabel: qualityLabelFromNumber(entry.quality),
    }));
  }, [catalog]);

  const filtered = useMemo(() => {
    const keyword = dbSearch.trim();
    return prepared.filter((entry) => {
      if (dbType !== "전체" && entry.type !== dbType) return false;
      if (!keyword) return true;
      return entry.name.includes(keyword);
    });
  }, [prepared, dbType, dbSearch]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const qa = QUALITY_ORDER.indexOf(a.qualityLabel as (typeof QUALITY_ORDER)[number]);
      const qb = QUALITY_ORDER.indexOf(b.qualityLabel as (typeof QUALITY_ORDER)[number]);
      if (qa !== qb) return qa - qb;
      return a.name.localeCompare(b.name, "ko");
    });
  }, [filtered]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageItems = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  useEffect(() => {
    setPage(0);
  }, [dbType, dbSearch]);

  useEffect(() => {
    if (page > pageCount - 1) {
      setPage(Math.max(0, pageCount - 1));
    }
  }, [page, pageCount]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-5xl p-4">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-xl font-semibold">Item DB</div>
            <div className="text-xs text-zinc-400">
              아이템 데이터베이스 · {isAdmin ? "관리자" : "조회 전용"}
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
              onClick={() => loadCatalog()}
              disabled={busy}
            >
              새로고침
            </button>
          </div>
        </header>

        {err ? (
          <div className="mb-3 rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-200">
            {err}
          </div>
        ) : null}

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {ITEM_TYPE_OPTIONS.map((type) => {
              const active = dbType === type;
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
                  onClick={() => setDbType(type)}
                  disabled={busy}
                >
                  {type}
                </button>
              );
            })}
          </div>

          <div className="mb-3">
            <input
              value={dbSearch}
              onChange={(e) => setDbSearch(e.target.value)}
              placeholder="아이템 검색"
              className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 text-xs text-zinc-100 outline-none focus:border-zinc-600"
            />
          </div>

          <div className="overflow-visible rounded-lg border border-zinc-800">
            <div className="grid grid-cols-[minmax(0,1fr)_90px_90px_70px] gap-2 bg-zinc-950/60 px-4 py-2 text-xs font-semibold text-zinc-400">
              <span>항목</span>
              <span>등급</span>
              <span>종류</span>
              <span className="text-right">단위</span>
            </div>
            <div className="divide-y divide-zinc-800">
              {pageItems.length === 0 ? (
                <div className="px-4 py-3 text-xs text-zinc-500">
                  검색 결과가 없습니다.
                </div>
              ) : (
                pageItems.map((entry) => {
                  const qualityLabel = entry.qualityLabel as string;
                  const colorClass = qualityColorClass(qualityLabel);
                  return (
                    <div
                      key={`db-${entry.name}`}
                      className="grid w-full grid-cols-[minmax(0,1fr)_90px_90px_70px] items-center gap-2 px-4 py-2 text-left text-sm"
                    >
                      <span className={colorClass}>{entry.name}</span>
                      <span className={colorClass}>{qualityLabel}</span>
                      <span className={colorClass}>{entry.type}</span>
                      <span className={`text-right ${colorClass}`}>
                        {entry.unit ?? "-"}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-3 flex items-center justify-center gap-3">
            <button
              type="button"
              className="rounded-md border border-zinc-700 px-2 py-1 text-lg leading-none disabled:opacity-40"
              onClick={() => setPage((prev) => Math.max(0, prev - 1))}
              disabled={page <= 0}
            >
              ⬅️
            </button>
            <span className="text-xs text-zinc-400">
              {page + 1} / {pageCount}
            </span>
            <button
              type="button"
              className="rounded-md border border-zinc-700 px-2 py-1 text-lg leading-none disabled:opacity-40"
              onClick={() => setPage((prev) => Math.min(pageCount - 1, prev + 1))}
              disabled={page >= pageCount - 1}
            >
              ➡️
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

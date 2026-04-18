import { useMemo, useState } from "react";
import type {
  BuildingResourceId,
  CityCarriageRecruitOrder,
  UpkeepPopulationId,
  WorldMapBuildingPresetRow,
} from "../../types";
import {
  formatWithCommas,
  getBuildingResourceLabel,
  normalizePresetType,
  UPKEEP_POPULATION_LABELS,
} from "../utils";

type Props = {
  open: boolean;
  readOnly?: boolean;
  busy: boolean;
  carriagePresets: WorldMapBuildingPresetRow[];
  carriageQueue?: CityCarriageRecruitOrder[];
  onClose: () => void;
  onRecruit: (presetId: string, quantity: number) => void;
  onCancelRecruit: (orderId: string) => void;
};

export default function CarriageModal({
  open,
  readOnly = false,
  busy,
  carriagePresets,
  carriageQueue = [],
  onClose,
  onRecruit,
  onCancelRecruit,
}: Props) {
  const [search, setSearch] = useState("");
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [quantity, setQuantity] = useState("1");

  const normalizedPresets = useMemo(
    () =>
      carriagePresets.filter((preset) => normalizePresetType(preset.presetType) === "carriage"),
    [carriagePresets]
  );

  const filteredPresets = useMemo(() => {
    const q = String(search ?? "").trim().toLowerCase();
    if (!q) return normalizedPresets;
    return normalizedPresets.filter((preset) =>
      String(preset.name ?? "").toLowerCase().includes(q)
    );
  }, [normalizedPresets, search]);

  const selectedPreset = useMemo(
    () => normalizedPresets.find((row) => row.id === selectedPresetId) ?? null,
    [normalizedPresets, selectedPresetId]
  );

  const normalizedQueue = useMemo(() => {
    const list = Array.isArray(carriageQueue) ? carriageQueue : [];
    return list
      .map((row) => {
        const id = String(row?.id ?? "").trim();
        const presetId = String(row?.presetId ?? "").trim();
        if (!id || !presetId) return null;
        const quantity = Math.max(1, Math.trunc(Number(row?.quantity ?? 0) || 1));
        const remainingDays = Math.max(1, Math.trunc(Number(row?.remainingDays ?? 0) || 1));
        const preset = normalizedPresets.find((entry) => entry.id === presetId) ?? null;
        return {
          id,
          presetId,
          quantity,
          remainingDays,
          presetName: preset?.name ?? presetId,
          presetColor: preset?.color ?? "#f59e0b",
          gainPopulation: row?.gainPopulation ?? {},
          gainResources: row?.gainResources ?? {},
        };
      })
      .filter((row): row is NonNullable<typeof row> => row != null)
      .sort((a, b) => a.remainingDays - b.remainingDays);
  }, [carriageQueue, normalizedPresets]);

  const qty = Math.max(1, Math.trunc(Number(quantity) || 1));

  if (!open) return null;

  const costEntries = Object.entries(selectedPreset?.buildCost ?? {}).filter(
    ([, amount]) => Math.max(0, Math.trunc(Number(amount) || 0)) > 0
  );
  const gainPopulationEntries = Object.entries(selectedPreset?.upkeep?.population ?? {})
    .map(([id, amount]) => [id as UpkeepPopulationId, Math.max(0, Math.trunc(Number(amount) || 0))] as const)
    .filter(([, amount]) => amount > 0 && amount != null);
  const gainResourceEntries = Object.entries(selectedPreset?.upkeep?.resources ?? {}).filter(
    ([, amount]) => Math.max(0, Math.trunc(Number(amount) || 0)) > 0
  );

  return (
    <div className="fixed inset-0 z-[88] overflow-y-auto bg-black/55 p-4">
      <div className="mx-auto mt-12 w-full max-w-5xl rounded-2xl border border-zinc-700 bg-zinc-950 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold text-zinc-100">역마차</div>
            <div className="text-xs text-zinc-400">영입 비용을 지불해 인구/자원을 영입합니다.</div>
          </div>
          <button
            type="button"
            className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:border-zinc-500"
            onClick={onClose}
          >
            닫기
          </button>
        </div>

        <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
            <div className="mb-2 text-xs font-semibold text-zinc-300">역마차 프리셋 검색</div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="역마차 프리셋 이름 검색"
              className="h-9 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-zinc-500"
            />
            <div className="mt-2 max-h-80 overflow-auto rounded-md border border-zinc-800 bg-zinc-950/40">
              {filteredPresets.length === 0 ? (
                <div className="px-3 py-2 text-xs text-zinc-500">검색 결과가 없습니다.</div>
              ) : (
                filteredPresets.map((preset) => {
                  const active = selectedPresetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      className={[
                        "block w-full px-3 py-2 text-left text-xs",
                        active
                          ? "bg-amber-900/30 text-amber-200"
                          : "text-zinc-200 hover:bg-zinc-800/60",
                      ].join(" ")}
                      onClick={() =>
                        setSelectedPresetId((prev) => (prev === preset.id ? "" : preset.id))
                      }
                    >
                      <div className="truncate font-semibold" style={{ color: preset.color }}>
                        {preset.name}
                      </div>
                      <div className="mt-0.5 text-[11px] text-zinc-500">
                        비용 {Object.keys(preset.buildCost ?? {}).length} · 인구{" "}
                        {Object.keys(preset.upkeep?.population ?? {}).length} · 획득{" "}
                        {Object.keys(preset.upkeep?.resources ?? {}).length}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
            {selectedPreset ? (
              <div className="space-y-3">
                <div className="text-sm font-semibold" style={{ color: selectedPreset.color }}>
                  {selectedPreset.name}
                </div>

                <div className="rounded-md border border-amber-800/50 bg-amber-950/20 p-3">
                  <div className="mb-1 text-xs font-semibold text-amber-200">영입 비용</div>
                  {costEntries.length === 0 ? (
                    <div className="text-xs text-zinc-500">없음</div>
                  ) : (
                    <div className="space-y-1 text-xs text-zinc-200">
                      {costEntries.map(([id, amount]) => {
                        const value = Math.max(0, Math.trunc(Number(amount) || 0));
                        return (
                          <div key={`cost-${id}`} className="flex items-center justify-between">
                            <span>{getBuildingResourceLabel(id as BuildingResourceId)}</span>
                            <span className="font-semibold text-amber-200">
                              {formatWithCommas(value)} × {formatWithCommas(qty)} ={" "}
                              {formatWithCommas(value * qty)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="rounded-md border border-sky-800/50 bg-sky-950/20 p-3">
                  <div className="mb-1 text-xs font-semibold text-sky-200">영입 인구</div>
                  {gainPopulationEntries.length === 0 ? (
                    <div className="text-xs text-zinc-500">없음</div>
                  ) : (
                    <div className="space-y-1 text-xs text-zinc-200">
                      {gainPopulationEntries.map(([id, amount]) => (
                        <div key={`pop-${id}`} className="flex items-center justify-between">
                          <span>{UPKEEP_POPULATION_LABELS[id]}</span>
                          <span className="font-semibold text-sky-200">
                            {formatWithCommas(amount)} × {formatWithCommas(qty)} ={" "}
                            {formatWithCommas(amount * qty)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-md border border-emerald-800/50 bg-emerald-950/20 p-3">
                  <div className="mb-1 text-xs font-semibold text-emerald-200">획득 자원</div>
                  {gainResourceEntries.length === 0 ? (
                    <div className="text-xs text-zinc-500">없음</div>
                  ) : (
                    <div className="space-y-1 text-xs text-zinc-200">
                      {gainResourceEntries.map(([id, amount]) => {
                        const value = Math.max(0, Math.trunc(Number(amount) || 0));
                        return (
                          <div key={`gain-${id}`} className="flex items-center justify-between">
                            <span>{getBuildingResourceLabel(id as BuildingResourceId)}</span>
                            <span className="font-semibold text-emerald-200">
                              {formatWithCommas(value)} × {formatWithCommas(qty)} ={" "}
                              {formatWithCommas(value * qty)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="grid gap-2 md:grid-cols-[180px_auto] md:items-end">
                  <label className="block">
                    <div className="mb-1 text-xs font-semibold text-zinc-300">영입 수량</div>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      className="h-9 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                    />
                  </label>
                  <button
                    type="button"
                    className="h-9 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
                    disabled={busy || readOnly}
                    onClick={() => onRecruit(selectedPreset.id, qty)}
                  >
                    영입 실행
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-zinc-700 px-3 py-8 text-center text-sm text-zinc-500">
                역마차 프리셋을 선택해 주세요.
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
          <div className="mb-2 text-sm font-semibold text-zinc-100">영입 대기열</div>
          {normalizedQueue.length === 0 ? (
            <div className="rounded-md border border-dashed border-zinc-700 px-3 py-3 text-xs text-zinc-500">
              현재 대기 중인 영입이 없습니다.
            </div>
          ) : (
            <div className="space-y-2">
              {normalizedQueue.map((order) => {
                const popRows = Object.entries(order.gainPopulation)
                  .map(([id, amount]) => [
                    id as UpkeepPopulationId,
                    Math.max(0, Math.trunc(Number(amount) || 0)),
                  ] as const)
                  .filter(([, amount]) => amount > 0);
                const resourceRows = Object.entries(order.gainResources)
                  .map(([id, amount]) => [
                    id as BuildingResourceId,
                    Math.max(0, Math.trunc(Number(amount) || 0)),
                  ] as const)
                  .filter(([, amount]) => amount > 0);
                return (
                  <div
                    key={order.id}
                    className="rounded-md border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-xs"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-semibold" style={{ color: order.presetColor }}>
                        {order.presetName}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-amber-300">
                          수량 {formatWithCommas(order.quantity)} · {formatWithCommas(order.remainingDays)}일 남음
                        </div>
                        <button
                          type="button"
                          className="rounded-md border border-red-800/80 px-2 py-0.5 text-[11px] font-semibold text-red-200 hover:bg-red-900/30 disabled:opacity-50"
                          disabled={busy || readOnly}
                          onClick={() => onCancelRecruit(order.id)}
                        >
                          취소
                        </button>
                      </div>
                    </div>
                    <div className="mt-1 text-zinc-400">
                      {popRows.length > 0 ? (
                        <span>
                          인구:{" "}
                          {popRows
                            .map(
                              ([id, amount]) =>
                                `${UPKEEP_POPULATION_LABELS[id]} ${formatWithCommas(amount)}`
                            )
                            .join(", ")}
                        </span>
                      ) : (
                        <span>인구: 없음</span>
                      )}
                      {" · "}
                      {resourceRows.length > 0 ? (
                        <span>
                          자원:{" "}
                          {resourceRows
                            .map(
                              ([id, amount]) =>
                                `${getBuildingResourceLabel(id)} ${formatWithCommas(amount)}`
                            )
                            .join(", ")}
                        </span>
                      ) : (
                        <span>자원: 없음</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

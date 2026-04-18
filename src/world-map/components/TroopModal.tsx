import { useEffect, useMemo, useState } from "react";
import type {
  CityTroopState,
  PopulationId,
  ResourceId,
  WorldMap,
  WorldMapBuildingPresetRow,
} from "../../types";
import {
  POPULATION_EMOJIS,
  POPULATION_LABELS,
  RESOURCE_EMOJIS,
  RESOURCE_LABELS,
  formatWithCommas,
  getTileDisplayNumber,
  normalizePresetType,
  parseTileKey,
  tileKey,
} from "../utils";

type Props = {
  open: boolean;
  readOnly?: boolean;
  busy: boolean;
  map: WorldMap | null;
  troopState: CityTroopState;
  troopPresets: WorldMapBuildingPresetRow[];
  selectedHex: { col: number; row: number } | null;
  scope?: "full" | "tile";
  onClose: () => void;
  onStartTraining: (presetId: string, quantity: number) => void;
  onCancelTraining: (orderId: string) => void;
  onDeployToSelectedTile: (presetId: string, quantity: number) => void;
  onWithdrawFromSelectedTile: (presetId: string, quantity: number) => void;
  onDisbandTroop: (presetId: string, quantity: number) => void;
};

type Tab = "train" | "deploy" | "disband";

export default function TroopModal({
  open,
  readOnly = false,
  busy,
  map,
  troopState,
  troopPresets,
  selectedHex,
  scope = "full",
  onClose,
  onStartTraining,
  onCancelTraining,
  onDeployToSelectedTile,
  onWithdrawFromSelectedTile,
  onDisbandTroop,
}: Props) {
  const [tab, setTab] = useState<Tab>("train");
  const [search, setSearch] = useState("");
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const isTileOnlyScope = scope === "tile";

  useEffect(() => {
    if ((isTileOnlyScope || readOnly) && tab !== "deploy") {
      setTab("deploy");
    }
  }, [isTileOnlyScope, readOnly, tab]);

  const normalizedPresets = useMemo(
    () =>
      troopPresets.filter((preset) => normalizePresetType(preset.presetType) === "troop"),
    [troopPresets]
  );

  const selectedPreset = useMemo(
    () => normalizedPresets.find((row) => row.id === selectedPresetId) ?? null,
    [normalizedPresets, selectedPresetId]
  );

  const filteredPresets = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return normalizedPresets;
    return normalizedPresets.filter((preset) =>
      String(preset.name ?? "").toLowerCase().includes(q)
    );
  }, [normalizedPresets, search]);

  const selectedQty = Math.max(1, Math.trunc(Number(quantity) || 1));
  const selectedTileKey =
    selectedHex != null ? tileKey(selectedHex.col, selectedHex.row) : null;

  const deployedOnSelectedTile = useMemo(() => {
    if (!selectedTileKey) return {};
    return troopState.deployed[selectedTileKey] ?? {};
  }, [selectedTileKey, troopState.deployed]);

  const deployedTotalByPreset = useMemo(() => {
    const out: Record<string, number> = {};
    for (const byPreset of Object.values(troopState.deployed ?? {})) {
      for (const [presetId, amountRaw] of Object.entries(byPreset ?? {})) {
        const amount = Math.max(0, Math.trunc(Number(amountRaw) || 0));
        if (amount <= 0) continue;
        out[presetId] = (out[presetId] ?? 0) + amount;
      }
    }
    return out;
  }, [troopState.deployed]);

  const currentTileNumber = useMemo(() => {
    if (!map || !selectedHex) return null;
    return getTileDisplayNumber(map.cols, selectedHex.col, selectedHex.row);
  }, [map, selectedHex]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[85] overflow-y-auto bg-black/55 p-4">
      <div className="mx-auto mt-12 w-full max-w-5xl rounded-2xl border border-zinc-700 bg-zinc-950 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold text-zinc-100">병력</div>
            <div className="text-xs text-zinc-400">
              {selectedHex
                ? `선택 타일: #${currentTileNumber}`
                : "선택 타일 없음"}
            </div>
          </div>
          <button
            type="button"
            className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:border-zinc-500"
            onClick={onClose}
          >
            닫기
          </button>
        </div>

        <div className="mb-3 flex items-center gap-2">
          {isTileOnlyScope || readOnly ? (
            <span className="rounded-md border border-sky-700/70 bg-sky-950/30 px-2 py-1 text-xs text-sky-200">
              병력 배치 현황
            </span>
          ) : (
            <>
              <button
                type="button"
                className={[
                  "rounded-md border px-2 py-1 text-xs",
                  tab === "train"
                    ? "border-amber-700/70 bg-amber-950/30 text-amber-200"
                    : "border-zinc-800 text-zinc-300 hover:border-zinc-600",
                ].join(" ")}
                onClick={() => setTab("train")}
              >
                병력 훈련
              </button>
              <button
                type="button"
                className={[
                  "rounded-md border px-2 py-1 text-xs",
                  tab === "deploy"
                    ? "border-sky-700/70 bg-sky-950/30 text-sky-200"
                    : "border-zinc-800 text-zinc-300 hover:border-zinc-600",
                ].join(" ")}
                onClick={() => setTab("deploy")}
              >
                병력 배치 현황
              </button>
              <button
                type="button"
                className={[
                  "rounded-md border px-2 py-1 text-xs",
                  tab === "disband"
                    ? "border-red-700/70 bg-red-950/30 text-red-200"
                    : "border-zinc-800 text-zinc-300 hover:border-zinc-600",
                ].join(" ")}
                onClick={() => setTab("disband")}
              >
                병력 해산
              </button>
            </>
          )}
        </div>

        <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
            <div className="mb-2 text-xs font-semibold text-zinc-300">병력 프리셋 검색</div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="병력 이름 검색"
              className="h-9 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-zinc-500"
            />
            <div className="mt-2 max-h-80 overflow-auto rounded-md border border-zinc-800 bg-zinc-950/40">
              {filteredPresets.length === 0 ? (
                <div className="px-3 py-2 text-xs text-zinc-500">검색 결과가 없습니다.</div>
              ) : (
                filteredPresets.map((preset) => {
                  const active = selectedPresetId === preset.id;
                  const stock = Math.max(
                    0,
                    Math.trunc(Number(troopState.stock?.[preset.id] ?? 0) || 0)
                  );
                  const deployed = Math.max(
                    0,
                    Math.trunc(Number(deployedTotalByPreset[preset.id] ?? 0) || 0)
                  );
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      className={[
                        "flex w-full items-center justify-between px-3 py-2 text-left text-xs",
                        active
                          ? "bg-amber-900/30 text-amber-200"
                          : "text-zinc-200 hover:bg-zinc-800/60",
                      ].join(" ")}
                      onClick={() =>
                        setSelectedPresetId((prev) => (prev === preset.id ? "" : preset.id))
                      }
                    >
                      <span className="truncate font-semibold" style={{ color: preset.color }}>
                        {preset.name}
                      </span>
                      <span className="ml-2 whitespace-nowrap text-[11px] text-zinc-400">
                        보유 {formatWithCommas(stock)} · 배치 {formatWithCommas(deployed)}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {tab === "train" && !isTileOnlyScope && !readOnly ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
              <div className="mb-2 text-xs font-semibold text-zinc-300">훈련 설정</div>
              {selectedPreset ? (
                <div className="space-y-3">
                  <div className="text-sm font-semibold" style={{ color: selectedPreset.color }}>
                    {selectedPreset.name}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[120px_minmax(0,1fr)]">
                    <label className="text-xs text-zinc-400">수량</label>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      className="h-9 rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                    />
                  </div>
                  <div className="rounded-md border border-zinc-800 bg-zinc-950/40 p-3 text-xs text-zinc-300">
                    <div className="mb-1 font-semibold text-zinc-200">훈련 소모(1기 기준)</div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {Object.entries(selectedPreset.buildCost ?? {})
                        .filter(([, v]) => Math.max(0, Math.trunc(Number(v) || 0)) > 0)
                        .map(([resourceId, value]) => (
                          <div key={resourceId}>
                            {RESOURCE_EMOJIS[resourceId as ResourceId] ?? "📦"}{" "}
                            {RESOURCE_LABELS[resourceId as ResourceId] ?? resourceId}{" "}
                            {formatWithCommas(Math.max(0, Math.trunc(Number(value) || 0)))}
                          </div>
                        ))}
                      {Object.entries(selectedPreset.upkeep?.population ?? {})
                        .filter(([, v]) => Math.max(0, Math.trunc(Number(v) || 0)) > 0)
                        .map(([populationId, value]) => (
                          <div key={populationId}>
                            {POPULATION_EMOJIS[populationId as PopulationId] ?? "👥"}{" "}
                            {POPULATION_LABELS[populationId as PopulationId] ?? populationId}{" "}
                            {formatWithCommas(Math.max(0, Math.trunc(Number(value) || 0)))}
                          </div>
                        ))}
                      <div>🕒 {formatWithCommas(Math.max(1, Math.trunc(Number(selectedPreset.effort ?? 1) || 1)))}일</div>
                    </div>
                  </div>
                  <div className="rounded-md border border-zinc-800 bg-zinc-950/40 p-3 text-xs text-zinc-300">
                    <div className="mb-1 font-semibold text-zinc-200">훈련 소모(총 {formatWithCommas(selectedQty)}기)</div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {Object.entries(selectedPreset.buildCost ?? {})
                        .filter(([, v]) => Math.max(0, Math.trunc(Number(v) || 0)) > 0)
                        .map(([resourceId, value]) => {
                          const n = Math.max(0, Math.trunc(Number(value) || 0)) * selectedQty;
                          return (
                            <div key={resourceId}>
                              {RESOURCE_EMOJIS[resourceId as ResourceId] ?? "📦"}{" "}
                              {RESOURCE_LABELS[resourceId as ResourceId] ?? resourceId}{" "}
                              {formatWithCommas(n)}
                            </div>
                          );
                        })}
                      {Object.entries(selectedPreset.upkeep?.population ?? {})
                        .filter(([, v]) => Math.max(0, Math.trunc(Number(v) || 0)) > 0)
                        .map(([populationId, value]) => {
                          const n = Math.max(0, Math.trunc(Number(value) || 0)) * selectedQty;
                          return (
                            <div key={populationId}>
                              {POPULATION_EMOJIS[populationId as PopulationId] ?? "👥"}{" "}
                              {POPULATION_LABELS[populationId as PopulationId] ?? populationId}{" "}
                              {formatWithCommas(n)}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="w-full rounded-md bg-amber-700 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
                    onClick={() => onStartTraining(selectedPreset.id, selectedQty)}
                    disabled={busy}
                  >
                    병력 훈련 시작
                  </button>
                </div>
              ) : (
                <div className="text-xs text-zinc-500">훈련할 병력 프리셋을 선택하세요.</div>
              )}

              <div className="mt-4 rounded-md border border-zinc-800 bg-zinc-950/30 p-3">
                <div className="mb-2 text-xs font-semibold text-zinc-300">훈련 대기열</div>
                {troopState.training.length === 0 ? (
                  <div className="text-xs text-zinc-500">진행 중인 훈련이 없습니다.</div>
                ) : (
                  <div className="space-y-2">
                    {troopState.training.map((order) => {
                      const preset = normalizedPresets.find((row) => row.id === order.presetId);
                      return (
                        <div
                          key={order.id}
                          className="rounded-md border border-zinc-800 bg-zinc-950/50 px-2 py-1.5 text-xs text-zinc-200"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-semibold" style={{ color: preset?.color ?? "#e5e7eb" }}>
                              {preset?.name ?? "병력"}
                            </div>
                            <button
                              type="button"
                              className="rounded border border-red-800 px-2 py-0.5 text-[11px] text-red-300 hover:bg-red-950/40 disabled:opacity-50"
                              disabled={busy}
                              onClick={() => onCancelTraining(order.id)}
                            >
                              취소
                            </button>
                          </div>
                          <div className="text-zinc-400">
                            수량 {formatWithCommas(order.quantity)} · {formatWithCommas(order.remainingDays)}일 남음
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : tab === "deploy" ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
              <div className="mb-2 text-xs font-semibold text-zinc-300">배치</div>
              {isTileOnlyScope && !readOnly ? (
                selectedPreset ? (
                  <div className="space-y-3">
                    <div className="text-sm font-semibold" style={{ color: selectedPreset.color }}>
                      {selectedPreset.name}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-[120px_minmax(0,1fr)]">
                      <label className="text-xs text-zinc-400">수량</label>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        className="h-9 rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                      />
                    </div>
                    <div className="rounded-md border border-zinc-800 bg-zinc-950/40 p-3 text-xs text-zinc-300">
                      <div>
                        보유 병력:{" "}
                        {formatWithCommas(
                          Math.max(0, Math.trunc(Number(troopState.stock?.[selectedPreset.id] ?? 0) || 0))
                        )}
                        기
                      </div>
                      <div>
                        선택 타일 배치:{" "}
                        {formatWithCommas(
                          Math.max(
                            0,
                            Math.trunc(Number(deployedOnSelectedTile[selectedPreset.id] ?? 0) || 0)
                          )
                        )}
                        기
                      </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        className="rounded-md bg-sky-700 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-600 disabled:opacity-50"
                        onClick={() => onDeployToSelectedTile(selectedPreset.id, selectedQty)}
                        disabled={busy || !selectedHex}
                      >
                        선택 타일에 배치
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-zinc-700 bg-zinc-900/50 px-3 py-2 text-sm font-semibold text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
                        onClick={() => onWithdrawFromSelectedTile(selectedPreset.id, selectedQty)}
                        disabled={busy || !selectedHex}
                      >
                        선택 타일에서 회수
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-zinc-500">배치할 병력 프리셋을 선택하세요.</div>
                )
              ) : (
                <div className="rounded-md border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-300">
                  병력 종류를 선택하면 해당 병력의 타일별 배치 현황을 확인할 수 있습니다.
                  <span className="ml-1 text-zinc-500">(같은 병력 재선택 시 전체 보기)</span>
                </div>
              )}

              <div className="mt-4 rounded-md border border-zinc-800 bg-zinc-950/30 p-3">
                <div className="mb-2 text-xs font-semibold text-zinc-300">
                  {isTileOnlyScope ? "선택 타일 배치 현황" : "타일별 배치 현황"}
                </div>
                <div className="space-y-2">
                  {Object.entries(troopState.deployed ?? {})
                    .filter(([key]) => !isTileOnlyScope || key === selectedTileKey)
                    .map(([key, byPreset]) => {
                      const entries = Object.entries(byPreset)
                        .map(([presetId, amountRaw]) => ({
                          presetId,
                          amount: Math.max(0, Math.trunc(Number(amountRaw) || 0)),
                        }))
                        .filter((row) => row.amount > 0);
                      const visibleEntries = selectedPresetId
                        ? entries.filter((row) => row.presetId === selectedPresetId)
                        : entries;
                      if (visibleEntries.length === 0) return null;
                      const parsed = parseTileKey(key);
                      const tileNumber =
                        map && parsed
                          ? getTileDisplayNumber(map.cols, parsed.col, parsed.row)
                          : null;
                      return (
                        <div key={key} className="rounded-md border border-zinc-800 bg-zinc-950/50 px-2 py-1.5 text-xs text-zinc-200">
                          <div className="font-semibold text-zinc-300">
                            타일 {tileNumber != null ? `#${tileNumber}` : key}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-x-1 text-amber-300">
                            {visibleEntries.map((row, idx) => {
                              const preset = normalizedPresets.find((entry) => entry.id === row.presetId);
                              const name = preset?.name ?? row.presetId;
                              const text = `${name} ${formatWithCommas(row.amount)}`;
                              return (
                                <span key={`${row.presetId}-${idx}`} className="font-semibold">
                                  {idx > 0 ? ", " : ""}
                                  {text}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  {Object.entries(troopState.deployed ?? {})
                    .filter(([key]) => !isTileOnlyScope || key === selectedTileKey)
                    .every(([, byPreset]) =>
                      Object.entries(byPreset ?? {}).every(([presetId, amountRaw]) => {
                        const amount = Math.max(0, Math.trunc(Number(amountRaw) || 0));
                        if (amount <= 0) return true;
                        if (!selectedPresetId) return false;
                        return presetId !== selectedPresetId;
                      })
                    ) ? (
                    <div className="text-xs text-zinc-500">배치된 병력이 없습니다.</div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : !isTileOnlyScope && !readOnly ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
              <div className="mb-2 text-xs font-semibold text-zinc-300">해산</div>
              {selectedPreset ? (
                <div className="space-y-3">
                  <div className="text-sm font-semibold" style={{ color: selectedPreset.color }}>
                    {selectedPreset.name}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[120px_minmax(0,1fr)]">
                    <label className="text-xs text-zinc-400">수량</label>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      className="h-9 rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                    />
                  </div>
                  <div className="rounded-md border border-zinc-800 bg-zinc-950/40 p-3 text-xs text-zinc-300">
                    <div>
                      총 병력:{" "}
                      {formatWithCommas(
                        Math.max(0, Math.trunc(Number(troopState.stock?.[selectedPreset.id] ?? 0) || 0)) +
                          Math.max(0, Math.trunc(Number(deployedTotalByPreset[selectedPreset.id] ?? 0) || 0))
                      )}
                      기
                    </div>
                    <div>
                      보유(미배치):{" "}
                      {formatWithCommas(
                        Math.max(0, Math.trunc(Number(troopState.stock?.[selectedPreset.id] ?? 0) || 0))
                      )}
                      기
                    </div>
                    <div>
                      배치 중:{" "}
                      {formatWithCommas(
                        Math.max(0, Math.trunc(Number(deployedTotalByPreset[selectedPreset.id] ?? 0) || 0))
                      )}
                      기
                    </div>
                  </div>
                  <div className="rounded-md border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-400">
                    해산 시 자원은 환불되지 않고, 가용 인구만 복구됩니다.
                  </div>
                  <button
                    type="button"
                    className="w-full rounded-md bg-red-700 px-3 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50"
                    onClick={() => onDisbandTroop(selectedPreset.id, selectedQty)}
                    disabled={busy}
                  >
                    병력 해산
                  </button>
                </div>
              ) : (
                <div className="text-xs text-zinc-500">해산할 병력 프리셋을 선택하세요.</div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

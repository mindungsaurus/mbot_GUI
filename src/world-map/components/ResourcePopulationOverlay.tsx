import type { CityGlobalState, ResourceId } from "../../types";
import {
  ALL_RESOURCE_IDS,
  CAPPED_RESOURCE_IDS,
  POPULATION_EMOJIS,
  POPULATION_LABELS,
  RESOURCE_EMOJIS,
  RESOURCE_LABELS,
  TRACKED_POPULATION_IDS,
  formatDailyDelta,
  formatWithCommas,
} from "../utils";

type Props = {
  readOnly?: boolean;
  activeCityGlobal: CityGlobalState;
  dailyResourceDeltaById: Record<ResourceId, number>;
  resourceOverlayOpen: boolean;
  populationOverlayOpen: boolean;
  resourceAdjustOpen: boolean;
  resourceAdjustTarget: ResourceId;
  resourceAdjustMode: "inc" | "dec";
  resourceAdjustAmount: string;
  totalPopulation: number;
  busy: boolean;
  onToggleResourceOverlay: () => void;
  onTogglePopulationOverlay: () => void;
  onToggleResourceAdjust: () => void;
  onOpenWarehouseModal: () => void;
  onResourceAdjustTargetChange: (id: ResourceId) => void;
  onResourceAdjustModeChange: (mode: "inc" | "dec") => void;
  onResourceAdjustAmountChange: (value: string) => void;
  onApplyResourceAdjust: () => void;
  onOpenPlacementReport: () => void;
  onOpenResourceStatus: () => void;
  onOpenTroopModal: () => void;
  onOpenCarriageModal: () => void;
};

export default function ResourcePopulationOverlay({
  readOnly = false,
  activeCityGlobal,
  dailyResourceDeltaById,
  resourceOverlayOpen,
  populationOverlayOpen,
  resourceAdjustOpen,
  resourceAdjustTarget,
  resourceAdjustMode,
  resourceAdjustAmount,
  totalPopulation,
  busy,
  onToggleResourceOverlay,
  onTogglePopulationOverlay,
  onToggleResourceAdjust,
  onOpenWarehouseModal,
  onResourceAdjustTargetChange,
  onResourceAdjustModeChange,
  onResourceAdjustAmountChange,
  onApplyResourceAdjust,
  onOpenPlacementReport,
  onOpenResourceStatus,
  onOpenTroopModal,
  onOpenCarriageModal,
}: Props) {
  const uncappedCore: ResourceId[] = ["research", "gold"];

  return (
    <div className="pointer-events-none absolute right-4 top-14 z-30">
      <div className="pointer-events-auto flex flex-col gap-3">
        <div className="w-[220px] max-w-[220px] rounded-xl border border-zinc-700/70 bg-zinc-900/55 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-2 border-b border-zinc-700/70 px-3 py-2">
            <div className="text-xs font-semibold text-zinc-100">자원</div>
            <button
              type="button"
              className="rounded-md border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-200 hover:border-zinc-500"
              onClick={onToggleResourceOverlay}
            >
              {resourceOverlayOpen ? "접기" : "펼치기"}
            </button>
          </div>
          {resourceOverlayOpen ? (
            <div className="space-y-1 px-3 py-2 text-[11px]">
              {CAPPED_RESOURCE_IDS.map((id) => (
                <div
                  key={id}
                  className="grid w-full grid-cols-[1fr_auto] gap-3 text-zinc-100"
                >
                  <span className="truncate">
                    {RESOURCE_EMOJIS[id]} {RESOURCE_LABELS[id]}
                  </span>
                  <span className="text-right font-semibold text-emerald-300 whitespace-nowrap">
                    {formatWithCommas(activeCityGlobal.values[id])}
                    <span
                      className={[
                        "ml-1",
                        dailyResourceDeltaById[id] > 0
                          ? "text-emerald-300"
                          : dailyResourceDeltaById[id] < 0
                            ? "text-rose-300"
                            : "text-zinc-400",
                      ].join(" ")}
                    >
                      ({formatDailyDelta(dailyResourceDeltaById[id] ?? 0)})
                    </span>{" "}
                    / {formatWithCommas(activeCityGlobal.caps[id])}
                  </span>
                </div>
              ))}
              <div className="my-1 border-t border-zinc-700/70" />
              {uncappedCore.map((id) => (
                <div
                  key={id}
                  className="grid w-full grid-cols-[1fr_auto] gap-3 text-zinc-100"
                >
                  <span className="truncate">
                    {RESOURCE_EMOJIS[id]} {RESOURCE_LABELS[id]}
                  </span>
                  <span className="text-right font-semibold text-amber-300 whitespace-nowrap">
                    {formatWithCommas(activeCityGlobal.values[id])}
                    <span
                      className={[
                        "ml-1",
                        dailyResourceDeltaById[id] > 0
                          ? "text-emerald-300"
                          : dailyResourceDeltaById[id] < 0
                            ? "text-rose-300"
                            : "text-zinc-400",
                      ].join(" ")}
                    >
                      ({formatDailyDelta(dailyResourceDeltaById[id] ?? 0)})
                    </span>
                  </span>
                </div>
              ))}
              <div className="my-1 border-t border-zinc-700/70" />
              <div className="grid w-full grid-cols-[1fr_auto] gap-3 text-zinc-100">
                <span className="truncate">
                  {RESOURCE_EMOJIS.order} {RESOURCE_LABELS.order}
                </span>
                <span className="text-right font-semibold text-amber-300 whitespace-nowrap">
                  {formatWithCommas(activeCityGlobal.values.order)}
                  <span
                    className={[
                      "ml-1",
                      dailyResourceDeltaById.order > 0
                        ? "text-emerald-300"
                        : dailyResourceDeltaById.order < 0
                          ? "text-rose-300"
                          : "text-zinc-400",
                    ].join(" ")}
                  >
                    ({formatDailyDelta(dailyResourceDeltaById.order ?? 0)})
                  </span>
                </span>
              </div>
              <div className="grid w-full grid-cols-[1fr_auto] gap-3 text-zinc-100">
                <span className="truncate">🙂 만족도</span>
                <span className="text-right font-semibold text-amber-300 whitespace-nowrap">
                  {`${Math.max(0, Math.min(100, Number(activeCityGlobal.satisfaction ?? 0))).toFixed(1)}%`}
                </span>
              </div>

              <div className="mt-2 border-t border-zinc-700/70 pt-2">
                {!readOnly ? (
                  <>
                    <button
                      type="button"
                      className="w-full rounded-md border border-zinc-700 px-2 py-1 text-left text-[11px] text-zinc-200 hover:border-zinc-500"
                      onClick={onToggleResourceAdjust}
                      disabled={busy}
                    >
                      {resourceAdjustOpen ? "자원 조정 접기" : "자원 조정 펼치기"}
                    </button>
                    {resourceAdjustOpen ? (
                      <div className="mt-2 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <select
                            value={resourceAdjustTarget}
                            onChange={(e) => onResourceAdjustTargetChange(e.target.value as ResourceId)}
                            className="h-8 rounded-md border border-zinc-700 bg-zinc-950 px-2 text-[11px] text-zinc-100 outline-none focus:border-zinc-500"
                          >
                            {ALL_RESOURCE_IDS.map((id) => (
                              <option key={id} value={id}>
                                {RESOURCE_EMOJIS[id]} {RESOURCE_LABELS[id]}
                              </option>
                            ))}
                          </select>
                          <select
                            value={resourceAdjustMode}
                            onChange={(e) =>
                              onResourceAdjustModeChange((e.target.value as "inc" | "dec") ?? "inc")
                            }
                            className="h-8 rounded-md border border-zinc-700 bg-zinc-950 px-2 text-[11px] text-zinc-100 outline-none focus:border-zinc-500"
                          >
                            <option value="inc">증가</option>
                            <option value="dec">감소</option>
                          </select>
                        </div>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={resourceAdjustAmount}
                          onChange={(e) => onResourceAdjustAmountChange(e.target.value)}
                          className="h-8 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 text-[11px] text-zinc-100 outline-none focus:border-zinc-500"
                          placeholder="수치 입력"
                        />
                        <button
                          type="button"
                          className="w-full rounded-md bg-amber-700 px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
                          onClick={onApplyResourceAdjust}
                          disabled={busy}
                        >
                          적용
                        </button>
                      </div>
                    ) : null}
                  </>
                ) : null}
                <button
                  type="button"
                  className="mt-2 w-full rounded-md border border-zinc-700 px-2 py-1 text-left text-[11px] text-zinc-200 hover:border-zinc-500"
                  onClick={onOpenWarehouseModal}
                  disabled={busy}
                >
                  창고 열기
                </button>
                <button
                  type="button"
                  className="mt-2 w-full rounded-md border border-zinc-700 px-2 py-1 text-left text-[11px] text-zinc-200 hover:border-zinc-500"
                  onClick={onOpenResourceStatus}
                  disabled={busy}
                >
                  자원 현황 확인
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="w-[220px] max-w-[220px] rounded-xl border border-zinc-700/70 bg-zinc-900/55 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-2 border-b border-zinc-700/70 px-3 py-2">
            <div className="text-xs font-semibold text-zinc-100">인구</div>
            <button
              type="button"
              className="rounded-md border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-200 hover:border-zinc-500"
              onClick={onTogglePopulationOverlay}
            >
              {populationOverlayOpen ? "접기" : "펼치기"}
            </button>
          </div>
          {populationOverlayOpen ? (
            <div className="space-y-1 px-3 py-2 text-[11px]">
              <div className="grid w-full grid-cols-[1fr_auto] gap-3 text-zinc-100">
                <span className="truncate">👥 전체 인구</span>
                <span className="text-right font-semibold text-lime-300 whitespace-nowrap">{formatWithCommas(totalPopulation)}</span>
              </div>
              <div className="grid w-full grid-cols-[1fr_auto] gap-3 text-zinc-100">
                <span className="truncate">🧱 인구 상한</span>
                <span className="text-right font-semibold text-lime-300 whitespace-nowrap">
                  {formatWithCommas(activeCityGlobal.populationCap)}
                </span>
              </div>
              <div className="my-1 border-t border-zinc-700/70" />
              {TRACKED_POPULATION_IDS.map((id) => (
                <div
                  key={id}
                  className="grid w-full grid-cols-[1fr_auto] gap-3 text-zinc-100"
                >
                  <span className="truncate">
                    {POPULATION_EMOJIS[id]} {POPULATION_LABELS[id]}
                  </span>
                  <span className="text-right font-semibold text-sky-300 whitespace-nowrap">
                    {formatWithCommas(activeCityGlobal.population[id].available ?? 0)} /{" "}
                    {formatWithCommas(activeCityGlobal.population[id].total)}
                  </span>
                </div>
              ))}
              <div className="grid w-full grid-cols-[1fr_auto] gap-3 text-zinc-100">
                <span className="truncate">
                  {POPULATION_EMOJIS.elderly} {POPULATION_LABELS.elderly}
                </span>
                <span className="text-right font-semibold text-sky-300 whitespace-nowrap">
                  {formatWithCommas(activeCityGlobal.population.elderly.available ?? 0)} /{" "}
                  {formatWithCommas(activeCityGlobal.population.elderly.total)}
                </span>
              </div>
              <div className="mt-2 border-t border-zinc-700/70 pt-2">
                <button
                  type="button"
                  className="w-full rounded-md border border-zinc-700 px-2 py-1 text-left text-[11px] text-zinc-200 hover:border-zinc-500"
                  onClick={onOpenPlacementReport}
                  disabled={busy}
                >
                  인구 배치 현황
                </button>
                <button
                  type="button"
                  className="mt-2 w-full rounded-md border border-zinc-700 px-2 py-1 text-left text-[11px] text-zinc-200 hover:border-zinc-500"
                  onClick={onOpenTroopModal}
                  disabled={busy}
                >
                  병력
                </button>
                {!readOnly ? (
                  <button
                    type="button"
                    className="mt-2 w-full rounded-md border border-zinc-700 px-2 py-1 text-left text-[11px] text-zinc-200 hover:border-zinc-500"
                    onClick={onOpenCarriageModal}
                    disabled={busy}
                  >
                    역마차
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

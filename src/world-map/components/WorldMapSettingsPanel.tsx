import type { Dispatch, FormEvent, MutableRefObject, SetStateAction } from "react";
import type {
  CityGlobalState,
  HexOrientation,
  MapTileStateAssignment,
  MapTileStatePreset,
  WorldMap,
} from "../../types";
import type { Draft, SelectedHex, SettingsTab } from "../utils";
import {
  CAPPED_RESOURCE_IDS,
  POPULATION_EMOJIS,
  POPULATION_LABELS,
  RESOURCE_LABELS,
  TRACKED_POPULATION_IDS,
  UNCAPPED_RESOURCE_IDS,
  formatWithCommas,
  tileKey,
} from "../utils";

type Props = {
  settingsOpen: boolean;
  settingsTab: SettingsTab;
  busy: boolean;
  selectedMap: WorldMap;
  draft: Draft;
  selectedHex: SelectedHex;
  activeTileStates: Record<string, MapTileStateAssignment[]>;
  presetById: Map<string, MapTileStatePreset>;
  activeCityGlobal: CityGlobalState;
  totalPopulation: number;
  fileInputRef: MutableRefObject<HTMLInputElement | null>;
  citySettingsFormRef: MutableRefObject<HTMLFormElement | null>;
  setDraft: Dispatch<SetStateAction<Draft>>;
  setSettingsTab: Dispatch<SetStateAction<SettingsTab>>;
  normalizeHexColor: (value: string) => string;
  onDelete: () => void;
  onUploadImage: (file: File | null) => void;
  onSaveDraft: () => void;
  onSaveCityGlobal: () => void;
};

export default function WorldMapSettingsPanel({
  settingsOpen,
  settingsTab,
  busy,
  selectedMap,
  draft,
  selectedHex,
  activeTileStates,
  presetById,
  activeCityGlobal,
  totalPopulation,
  fileInputRef,
  citySettingsFormRef,
  setDraft,
  setSettingsTab,
  normalizeHexColor,
  onDelete,
  onUploadImage,
  onSaveDraft,
  onSaveCityGlobal,
}: Props) {
  if (!settingsOpen) return null;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold text-zinc-100">설정</div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-md border border-red-700/60 bg-red-950/30 px-2 py-1 text-[11px] font-semibold text-red-200 hover:bg-red-900/40"
            onClick={onDelete}
            disabled={busy}
          >
            삭제
          </button>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          className={[
            "rounded-lg border px-3 py-1.5 text-xs font-semibold",
            settingsTab === "map"
              ? "border-amber-700/70 bg-amber-950/30 text-amber-200"
              : "border-zinc-800 bg-zinc-950/30 text-zinc-300 hover:border-zinc-700",
          ].join(" ")}
          onClick={() => setSettingsTab("map")}
        >
          지도 설정
        </button>
        <button
          type="button"
          className={[
            "rounded-lg border px-3 py-1.5 text-xs font-semibold",
            settingsTab === "city"
              ? "border-emerald-700/70 bg-emerald-950/30 text-emerald-200"
              : "border-zinc-800 bg-zinc-950/30 text-zinc-300 hover:border-zinc-700",
          ].join(" ")}
          onClick={() => setSettingsTab("city")}
        >
          도시 전역 설정
        </button>
      </div>

      {settingsTab === "map" ? (
        <div className="space-y-3">
          <label className="block">
            <div className="mb-1 text-[11px] font-semibold text-zinc-400">지도 이름</div>
            <input
              value={draft.name}
              onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
              className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-zinc-600"
            />
          </label>

          <div>
            <div className="mb-1 text-[11px] font-semibold text-zinc-400">이미지 파일 / URL</div>
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="block w-full text-xs text-zinc-300 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-800 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-zinc-100 hover:file:bg-zinc-700"
                onChange={(e) => onUploadImage(e.target.files?.[0] ?? null)}
                disabled={busy}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <div className="mb-1 text-[11px] font-semibold text-zinc-400">Hex Size</div>
              <input
                type="number"
                step="0.1"
                value={draft.hexSize}
                onChange={(e) => setDraft((prev) => ({ ...prev, hexSize: e.target.value }))}
                className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-amber-200 outline-none focus:border-zinc-600"
              />
            </label>
            <label className="block">
              <div className="mb-1 text-[11px] font-semibold text-zinc-400">Orientation</div>
              <select
                value={draft.orientation}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    orientation: e.target.value as HexOrientation,
                  }))
                }
                className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-zinc-600"
              >
                <option value="pointy">pointy</option>
                <option value="flat">flat</option>
              </select>
            </label>
            <label className="block">
              <div className="mb-1 text-[11px] font-semibold text-zinc-400">Origin X</div>
              <input
                value={draft.originX}
                onChange={(e) => setDraft((prev) => ({ ...prev, originX: e.target.value }))}
                className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-sky-200 outline-none focus:border-zinc-600"
              />
            </label>
            <label className="block">
              <div className="mb-1 text-[11px] font-semibold text-zinc-400">Origin Y</div>
              <input
                value={draft.originY}
                onChange={(e) => setDraft((prev) => ({ ...prev, originY: e.target.value }))}
                className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-sky-200 outline-none focus:border-zinc-600"
              />
            </label>
            <label className="block">
              <div className="mb-1 text-[11px] font-semibold text-zinc-400">Columns</div>
              <input
                value={draft.cols}
                onChange={(e) => setDraft((prev) => ({ ...prev, cols: e.target.value }))}
                className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-zinc-600"
              />
            </label>
            <label className="block">
              <div className="mb-1 text-[11px] font-semibold text-zinc-400">Rows</div>
              <input
                value={draft.rows}
                onChange={(e) => setDraft((prev) => ({ ...prev, rows: e.target.value }))}
                className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-zinc-600"
              />
            </label>
          </div>

          <button
            type="button"
            className="w-full rounded-lg border border-amber-700/60 bg-amber-950/30 px-3 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-900/40"
            onClick={onSaveDraft}
            disabled={busy}
          >
            지도 설정 저장
          </button>

          <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-400">
            선택 타일:
            {selectedHex ? `col ${selectedHex.col}, row ${selectedHex.row}` : "없음"}
            {selectedHex ? (
              <div className="mt-1 flex flex-wrap gap-1">
                {(activeTileStates[tileKey(selectedHex.col, selectedHex.row)] ?? []).length === 0 ? (
                  <span className="text-[11px] text-zinc-500">등록된 속성이 없습니다.</span>
                ) : (
                  (activeTileStates[tileKey(selectedHex.col, selectedHex.row)] ?? []).map(
                    (entry, idx) => {
                      const preset = presetById.get(entry.presetId);
                      if (!preset) return null;
                      const color = normalizeHexColor(preset.color);
                      return (
                        <span
                          key={`${entry.presetId}-${idx}`}
                          className="rounded-md border border-zinc-700/70 bg-zinc-900/70 px-1.5 py-0.5"
                          style={{ color }}
                        >
                          {preset.name}
                          {preset.hasValue && entry.value != null ? `: ${entry.value}` : ""}
                        </span>
                      );
                    }
                  )
                )}
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <form
          key={`${selectedMap.id}:${selectedMap.updatedAt ?? "city"}`}
          ref={citySettingsFormRef}
          className="space-y-4"
          onSubmit={(e: FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            onSaveCityGlobal();
          }}
        >
          <div className="space-y-2">
            <div className="text-xs font-semibold text-zinc-300">상한 있음</div>
            {CAPPED_RESOURCE_IDS.map((resourceId) => (
              <label key={resourceId} className="grid grid-cols-[1fr_120px] items-center gap-2">
                <span className="text-sm text-zinc-100">{RESOURCE_LABELS[resourceId]}</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  name={`cap_${resourceId}`}
                  defaultValue={activeCityGlobal.caps[resourceId]}
                  className="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-emerald-200 outline-none focus:border-zinc-600"
                />
              </label>
            ))}
          </div>
          <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
            <div className="text-xs font-semibold text-zinc-300">
              잉여 자원 전환 (상한 초과 1당 금 환전)
            </div>
            {CAPPED_RESOURCE_IDS.map((resourceId) => (
              <label key={`overflow_${resourceId}`} className="grid grid-cols-[1fr_120px] items-center gap-2">
                <span className="text-sm text-zinc-100">{RESOURCE_LABELS[resourceId]}</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  name={`overflow_rate_${resourceId}`}
                  defaultValue={activeCityGlobal.overflowToGold[resourceId] ?? 0}
                  className="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-amber-200 outline-none focus:border-zinc-600"
                />
              </label>
            ))}
          </div>
          <div className="space-y-1 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
            <div className="text-xs font-semibold text-zinc-300">상한 없음</div>
            <div className="text-sm text-zinc-400">
              {UNCAPPED_RESOURCE_IDS.map((id) => RESOURCE_LABELS[id]).join(", ")}
            </div>
          </div>
          <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
            <div className="text-xs font-semibold text-zinc-300">식량 부족 시 금 차감 비율</div>
            <label className="grid grid-cols-[1fr_120px] items-center gap-2">
              <span className="text-sm text-zinc-100">식량 1당 금 차감</span>
              <input
                type="number"
                min={0}
                step={1}
                name="food_deficit_gold_rate"
                defaultValue={activeCityGlobal.foodDeficitGoldRate ?? 0}
                className="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-amber-200 outline-none focus:border-zinc-600"
              />
            </label>
          </div>
          <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
            <div className="text-xs font-semibold text-zinc-300">날짜 설정</div>
            <input
              type="number"
              min={0}
              step={1}
              name="day"
              defaultValue={activeCityGlobal.day}
              className="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-sky-200 outline-none focus:border-zinc-600"
            />
          </div>
          <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
            <div className="text-xs font-semibold text-zinc-300">만족도 설정(%)</div>
            <input
              type="number"
              min={0}
              max={100}
              step={0.1}
              name="satisfaction"
              defaultValue={activeCityGlobal.satisfaction}
              className="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-amber-200 outline-none focus:border-zinc-600"
            />
          </div>
          <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold text-zinc-300">인구 설정</div>
              <div className="text-xs font-semibold text-lime-300">
                👥 전체 인구 {formatWithCommas(totalPopulation)} /{" "}
                {formatWithCommas(activeCityGlobal.populationCap)}
              </div>
            </div>
            <div className="space-y-2">
              {TRACKED_POPULATION_IDS.map((id) => (
                <div key={id} className="grid grid-cols-[1fr_110px_110px] items-center gap-2">
                  <span className="text-sm text-zinc-100">
                    {POPULATION_EMOJIS[id]} {POPULATION_LABELS[id]}
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    name={`pop_${id}_available`}
                    defaultValue={activeCityGlobal.population[id].available ?? 0}
                    className="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-sky-200 outline-none focus:border-zinc-600"
                    placeholder="가용"
                  />
                  <input
                    type="number"
                    min={0}
                    step={1}
                    name={`pop_${id}_total`}
                    defaultValue={activeCityGlobal.population[id].total}
                    className="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-lime-200 outline-none focus:border-zinc-600"
                    placeholder="총"
                  />
                </div>
              ))}
              <div className="grid grid-cols-[1fr_110px_110px] items-center gap-2">
                <span className="text-sm text-zinc-100">
                  {POPULATION_EMOJIS.elderly} {POPULATION_LABELS.elderly}
                </span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  name="pop_elderly_available"
                  defaultValue={activeCityGlobal.population.elderly.available ?? 0}
                  className="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-sky-200 outline-none focus:border-zinc-600"
                  placeholder="가용"
                />
                <input
                  type="number"
                  min={0}
                  step={1}
                  name="pop_elderly_total"
                  defaultValue={activeCityGlobal.population.elderly.total}
                  className="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-lime-200 outline-none focus:border-zinc-600"
                  placeholder="총"
                />
              </div>
              <div className="grid grid-cols-[1fr_110px] items-center gap-2">
                <span className="text-sm text-zinc-100">🧱 인구 상한</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  name="population_cap"
                  defaultValue={activeCityGlobal.populationCap}
                  className="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-lime-200 outline-none focus:border-zinc-600"
                  placeholder="인구 상한"
                />
              </div>
            </div>
            <div className="grid grid-cols-[1fr_110px_110px] gap-2 text-[11px] text-zinc-500">
              <span />
              <span className="px-1 text-center">가용</span>
              <span className="px-1 text-center">도시 내 총 인구</span>
            </div>
          </div>
          <button
            type="submit"
            className="w-full rounded-lg border border-emerald-700/60 bg-emerald-950/30 px-3 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-900/40"
            disabled={busy}
          >
            도시 전역 설정 저장
          </button>
        </form>
      )}
    </div>
  );
}

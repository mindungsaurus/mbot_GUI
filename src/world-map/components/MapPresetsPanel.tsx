// @ts-nocheck
import { useMemo, useState } from "react";
import type { BuildingPlacementRule, BuildingResourceId, ItemCatalogEntry, ResourceId } from "../../types";
import {
  ALL_RESOURCE_IDS,
  CAPPED_RESOURCE_IDS,
  BUILDING_PRESET_RESOURCE_IDS,
  RESOURCE_LABELS,
  TRACKED_POPULATION_IDS,
  POPULATION_LABELS,
  UPKEEP_POPULATION_IDS,
  UPKEEP_POPULATION_LABELS,
  getBuildingResourceLabel,
  normalizeHexColor,
  toNonNegativeInt,
  exprToEditableNumber,
  readAutoTroopThreatReduction,
} from "../utils";

type Props = { ctx: any };

export default function MapPresetsPanel({ ctx }: Props) {
  const {
    presetMode, setPresetMode, isAdmin, busy,
    activeTilePresets, presetDraftName, setPresetDraftName, presetDraftColorHex, setPresetDraftColorHex, presetDraftHasValue, setPresetDraftHasValue,
    handleCreateTilePreset, handleDeleteTilePreset,
    activeBuildingPresets, activeStructurePresets, activeTroopPresets, activeCarriagePresets, buildingDraft, setBuildingDraft, placementRuleSearch, setPlacementRuleSearch,
    handleSaveBuildingPreset, handleDeleteBuildingPreset, handleSelectBuildingPreset, resetBuildingDraft,
    setDraftPlacementRules, handleAddPlacementRule, handleRemovePlacementRule,
    handleAddExecutionRule, setEffectRuleAt, removeEffectRule, addEffectAction, removeEffectAction, setEffectActionAt,
    createDefaultRuleAction, getWhenKind, createDefaultComparePredicate, createDefaultWhenByKind, isPlacementRuleKind,
    setDraftResourceValue, removeDraftResourceValue, setDraftPopulationValue, handleSetPlacementRuleKind, createActionByKind,
    itemCatalogEntries,
  } = ctx;

  const [buildCostItemQuery, setBuildCostItemQuery] = useState("");
  const [upkeepItemQuery, setUpkeepItemQuery] = useState("");

  const itemNames = useMemo(
    () =>
      (Array.isArray(itemCatalogEntries) ? itemCatalogEntries : [])
        .map((entry: ItemCatalogEntry) => String(entry?.name ?? "").trim())
        .filter((name: string) => !!name),
    [itemCatalogEntries]
  );

  const buildCostCustomIds = useMemo(
    () =>
      Object.keys(buildingDraft?.buildCost ?? {})
        .map((id) => String(id ?? "").trim())
        .filter((id) => id.startsWith("item:") && id.slice(5).trim().length > 0),
    [buildingDraft?.buildCost]
  );

  const upkeepCustomIds = useMemo(
    () =>
      Object.keys(buildingDraft?.upkeepResources ?? {})
        .map((id) => String(id ?? "").trim())
        .filter((id) => id.startsWith("item:") && id.slice(5).trim().length > 0),
    [buildingDraft?.upkeepResources]
  );

  const pickMatchedItemName = (query: string) => {
    const q = String(query ?? "").trim().toLowerCase();
    if (!q) return null;
    const exact = itemNames.find((name) => name.toLowerCase() === q);
    if (exact) return exact;
    const partial = itemNames.find((name) => name.toLowerCase().includes(q));
    return partial ?? null;
  };

  const addCustomResourceToField = (field: "buildCost" | "upkeepResources", query: string) => {
    const matched = pickMatchedItemName(query);
    if (!matched) return;
    const resourceId = `item:${matched}` as BuildingResourceId;
    const current =
      field === "buildCost"
        ? String(buildingDraft?.buildCost?.[resourceId] ?? "")
        : String(buildingDraft?.upkeepResources?.[resourceId] ?? "");
    setDraftResourceValue(field, resourceId, current || "0");
    if (field === "buildCost") setBuildCostItemQuery("");
    if (field === "upkeepResources") setUpkeepItemQuery("");
  };

  const getItemSearchCandidates = (query: string) => {
    const q = String(query ?? "").trim().toLowerCase();
    if (!q) return [];
    return itemNames
      .filter((name) => name.toLowerCase().includes(q))
      .slice(0, 8);
  };

  const editingPresetType = (buildingDraft?.presetType ?? (presetMode === "troop" ? "troop" : presetMode === "carriage" ? "carriage" : "building")) as
    | "building"
    | "troop"
    | "carriage";
  const activePresetRows =
    presetMode === "troop"
      ? activeTroopPresets
      : presetMode === "carriage"
        ? activeCarriagePresets
      : presetMode === "building"
        ? activeStructurePresets
        : activeBuildingPresets;
  const presetEntityLabel =
    editingPresetType === "troop"
      ? "병력"
      : editingPresetType === "carriage"
        ? "역마차"
        : "건물";
  const buildCostBlockTitle =
    editingPresetType === "troop"
      ? "훈련 비용 블록"
      : editingPresetType === "carriage"
        ? "영입 비용 블록"
        : "건설 비용 블록";
  const upkeepResourceBlockTitle =
    editingPresetType === "carriage" ? "획득 자원 블록" : "유지 자원 블록";
  const upkeepPopulationBlockTitle =
    editingPresetType === "carriage" ? "영입 인구 블록" : "유지 인구 블록";

  return (
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-4">
                <div className="mb-3 text-sm font-semibold text-zinc-100">맵 프리셋</div>
                <div className="mb-4 grid grid-cols-4 gap-2">
                  <button
                    type="button"
                    className={[
                      "rounded-lg border px-3 py-1.5 text-xs font-semibold",
                      presetMode === "tile"
                        ? "border-amber-700/70 bg-amber-950/30 text-amber-200"
                        : "border-zinc-800 bg-zinc-950/30 text-zinc-300 hover:border-zinc-700",
                    ].join(" ")}
                    onClick={() => setPresetMode("tile")}
                  >
                    타일 속성 프리셋
                  </button>
                  <button
                    type="button"
                    className={[
                      "rounded-lg border px-3 py-1.5 text-xs font-semibold",
                      presetMode === "building"
                        ? "border-sky-700/70 bg-sky-950/30 text-sky-200"
                        : "border-zinc-800 bg-zinc-950/30 text-zinc-300 hover:border-zinc-700",
                    ].join(" ")}
                    onClick={() => {
                      setPresetMode("building");
                      setBuildingDraft((prev) => ({ ...prev, presetType: "building" }));
                    }}
                  >
                    건물 프리셋
                  </button>
                  <button
                    type="button"
                    className={[
                      "rounded-lg border px-3 py-1.5 text-xs font-semibold",
                      presetMode === "troop"
                        ? "border-indigo-700/70 bg-indigo-950/30 text-indigo-200"
                        : "border-zinc-800 bg-zinc-950/30 text-zinc-300 hover:border-zinc-700",
                    ].join(" ")}
                    onClick={() => {
                      setPresetMode("troop");
                      setBuildingDraft((prev) => ({
                        ...prev,
                        presetType: "troop",
                        effort: prev.effort?.trim() ? prev.effort : "1",
                        space: "0",
                      }));
                    }}
                  >
                    병력 프리셋
                  </button>
                  <button
                    type="button"
                    className={[
                      "rounded-lg border px-3 py-1.5 text-xs font-semibold",
                      presetMode === "carriage"
                        ? "border-violet-700/70 bg-violet-950/30 text-violet-200"
                        : "border-zinc-800 bg-zinc-950/30 text-zinc-300 hover:border-zinc-700",
                    ].join(" ")}
                    onClick={() => {
                      setPresetMode("carriage");
                      setBuildingDraft((prev) => ({
                        ...prev,
                        presetType: "carriage",
                        effort: prev.effort?.trim() ? prev.effort : "1",
                        space: "0",
                        troopThreatReduction: "0",
                      }));
                    }}
                  >
                    역마차 프리셋
                  </button>
                </div>

                {presetMode === "tile" ? (
                  <>
                    <div className="mb-4 text-xs text-zinc-400">
                      타일 속성에서 사용할 프리셋을 관리합니다.
                    </div>
                    {isAdmin ? (
                      <div className="mb-4 grid gap-2 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3 md:grid-cols-[1fr_200px_120px_auto] md:items-end">
                        <label className="block">
                          <div className="mb-1 text-[11px] font-semibold text-zinc-400">이름</div>
                          <input
                            value={presetDraftName}
                            onChange={(e) => setPresetDraftName(e.target.value)}
                            className="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-zinc-600"
                            placeholder="새 지형 상태"
                          />
                        </label>
                        <label className="block">
                          <div className="mb-1 text-[11px] font-semibold text-zinc-400">색상 선택</div>
                          <div className="flex h-9 items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-2">
                            <input
                              type="color"
                              value={presetDraftColorHex}
                              onChange={(e) => setPresetDraftColorHex(e.target.value.toLowerCase())}
                              className="h-6 w-8 cursor-pointer rounded border border-zinc-700 bg-transparent p-0"
                              title="타일 속성 프리셋 색상"
                            />
                            <span className="text-[11px] text-zinc-300">{presetDraftColorHex}</span>
                          </div>
                        </label>
                        <label className="flex h-9 items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3">
                          <input
                            type="checkbox"
                            checked={presetDraftHasValue}
                            onChange={(e) => setPresetDraftHasValue(e.target.checked)}
                          />
                          <span className="text-xs text-zinc-200">값 있음</span>
                        </label>
                        <button
                          type="button"
                          className="h-9 rounded-lg border border-emerald-700/60 bg-emerald-950/30 px-3 text-xs font-semibold text-emerald-200 hover:bg-emerald-900/40"
                          onClick={handleCreateTilePreset}
                          disabled={busy}
                        >
                          프리셋 추가
                        </button>
                      </div>
                    ) : (
                      <div className="mb-4 rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-400">
                        현재 계정은 조회 전용입니다. 프리셋 등록/삭제는 관리자만 가능합니다.
                      </div>
                    )}
                    <div className="space-y-2">
                      {activeTilePresets.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-zinc-800 px-3 py-4 text-sm text-zinc-500">
                          등록된 맵 프리셋이 없습니다.
                        </div>
                      ) : (
                        activeTilePresets.map((preset) => {
                          const color = normalizeHexColor(preset.color);
                          return (
                            <div
                              key={preset.id}
                              className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2"
                            >
                              <div className="flex min-w-0 items-center gap-2">
                                <span
                                  className="inline-block h-3 w-3 rounded-full"
                                  style={{ backgroundColor: color }}
                                  aria-hidden="true"
                                />
                                <span className="truncate text-sm font-semibold" style={{ color }}>
                                  {preset.name}
                                </span>
                                <span className="text-[11px] text-zinc-500">
                                  {preset.hasValue ? "값 있음" : "값 없음"} · {color}
                                </span>
                              </div>
                              {isAdmin ? (
                                <button
                                  type="button"
                                  className="rounded-md border border-red-800/70 bg-red-950/40 px-2 py-1 text-[11px] font-semibold text-red-200 hover:bg-red-900/40"
                                  onClick={() => handleDeleteTilePreset(preset.id)}
                                  disabled={busy}
                                >
                                  삭제
                                </button>
                              ) : null}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mb-4 text-xs text-zinc-400">
                      {editingPresetType === "troop"
                        ? "병력 기본 스펙(훈련 비용/인구/시간/위협도 감소)을 관리합니다."
                        : editingPresetType === "carriage"
                          ? "역마차 영입 프리셋(영입 비용/인구/획득 자원)을 관리합니다."
                          : "건물 규칙을 블록 단위로 조합해 관리합니다."}
                    </div>
                    {isAdmin ? (
                      <div className="mb-4 space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
                        <div
                          className={[
                            "grid gap-2",
                            editingPresetType === "troop"
                              ? "md:grid-cols-[1fr_160px_160px]"
                              : editingPresetType === "carriage"
                                ? "md:grid-cols-[1fr_160px_160px]"
                                : "md:grid-cols-[1fr_160px_120px_120px]",
                          ].join(" ")}
                        >
                          <label className="block">
                            <div className="mb-1 text-[11px] font-semibold text-zinc-400">{presetEntityLabel} 이름</div>
                            <input
                              value={buildingDraft.name}
                              onChange={(e) =>
                                setBuildingDraft((prev) => ({ ...prev, name: e.target.value }))
                              }
                              className="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-zinc-600"
                              placeholder={
                                editingPresetType === "troop"
                                  ? "예: 정찰대"
                                  : editingPresetType === "carriage"
                                    ? "작은 난민 집단"
                                    : "예: 감자밭"
                              }
                            />
                          </label>
                          <label className="block">
                            <div className="mb-1 text-[11px] font-semibold text-zinc-400">색상</div>
                            <div className="flex h-9 items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-2">
                              <input
                                type="color"
                                value={buildingDraft.color}
                                onChange={(e) =>
                                  setBuildingDraft((prev) => ({
                                    ...prev,
                                    color: e.target.value.toLowerCase(),
                                  }))
                                }
                                className="h-6 w-8 cursor-pointer rounded border border-zinc-700 bg-transparent p-0"
                              />
                              <span className="text-[11px] text-zinc-300">{buildingDraft.color}</span>
                            </div>
                          </label>
                          <label className="block">
                            <div className="mb-1 text-[11px] font-semibold text-zinc-400">
                              {editingPresetType === "troop"
                                ? "훈련 시간 (일)"
                                : editingPresetType === "carriage"
                                  ? "영입 기한 (일)"
                                  : "노력치"}
                            </div>
                            <input
                              value={buildingDraft.effort}
                              onChange={(e) =>
                                setBuildingDraft((prev) => ({
                                  ...prev,
                                  effort: e.target.value.replace(/[^\d]/g, ""),
                                }))
                              }
                              className="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-amber-200 outline-none focus:border-zinc-600"
                              placeholder={
                                editingPresetType === "troop" || editingPresetType === "carriage"
                                  ? "예: 1"
                                  : "예: 25"
                              }
                            />
                          </label>
                          {editingPresetType === "building" ? (
                            <label className="block">
                              <div className="mb-1 text-[11px] font-semibold text-zinc-400">공간</div>
                              <input
                                value={buildingDraft.space}
                                onChange={(e) =>
                                  setBuildingDraft((prev) => ({
                                    ...prev,
                                    space: e.target.value.replace(/[^\d]/g, ""),
                                  }))
                                }
                                className="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-sky-200 outline-none focus:border-zinc-600"
                                placeholder="예: 2"
                              />
                            </label>
                          ) : null}
                        </div>
                        {editingPresetType === "troop" ? (
                          <div className="grid gap-2 md:grid-cols-2">
                            <label className="block">
                              <div className="mb-1 text-[11px] font-semibold text-zinc-400">기본 위협도 감소</div>
                              <input
                                value={buildingDraft.troopThreatReduction ?? ""}
                                onChange={(e) =>
                                  setBuildingDraft((prev) => ({
                                    ...prev,
                                    troopThreatReduction: e.target.value.replace(/[^\d]/g, ""),
                                  }))
                                }
                                className="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-red-200 outline-none focus:border-zinc-600"
                                placeholder="예: 1"
                              />
                            </label>
                          </div>
                        ) : null}
                        <div className="grid gap-2 md:grid-cols-2">
                          <label className="block">
                            <div className="mb-1 text-[11px] font-semibold text-zinc-400">티어</div>
                            <input
                              value={buildingDraft.tier}
                              onChange={(e) =>
                                setBuildingDraft((prev) => ({ ...prev, tier: e.target.value }))
                              }
                              className="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-zinc-600"
                              placeholder="예: Tier 1"
                            />
                          </label>
                          <label className="block">
                            <div className="mb-1 text-[11px] font-semibold text-zinc-400">설명</div>
                            <input
                              value={buildingDraft.description}
                              onChange={(e) =>
                                setBuildingDraft((prev) => ({
                                  ...prev,
                                  description: e.target.value,
                                }))
                              }
                              className="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-zinc-600"
                              placeholder="요약 설명"
                            />
                          </label>
                        </div>
                        <div className="grid gap-3 md:grid-cols-3">
                          <div className="rounded-lg border border-amber-800/60 bg-amber-950/20 p-2.5">
                            <div className="mb-2 text-xs font-semibold text-zinc-300">{buildCostBlockTitle}</div>
                            <div className="grid grid-cols-2 gap-1.5">
                              {BUILDING_PRESET_RESOURCE_IDS.map((id) => (
                                <label key={`build-${id}`} className="block">
                                  <div className="mb-1 text-[11px] text-zinc-400">{RESOURCE_LABELS[id]}</div>
                                  <input
                                    value={buildingDraft.buildCost[id] ?? ""}
                                    onChange={(e) =>
                                      setDraftResourceValue("buildCost", id, e.target.value)
                                    }
                                    className="h-7 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 text-xs text-amber-200 outline-none focus:border-zinc-600"
                                    placeholder="0"
                                  />
                                </label>
                              ))}
                            </div>
                            {buildCostCustomIds.length > 0 ? (
                              <div className="mt-2 space-y-1.5">
                                {buildCostCustomIds.map((id) => (
                                  <div
                                    key={`build-custom-${id}`}
                                    className="grid grid-cols-[1fr_90px_auto] items-end gap-1.5"
                                  >
                                    <label className="block">
                                      <div className="mb-1 truncate text-[11px] text-zinc-400">
                                        {getBuildingResourceLabel(id)}
                                      </div>
                                      <input
                                        value={buildingDraft.buildCost[id] ?? ""}
                                        onChange={(e) =>
                                          setDraftResourceValue("buildCost", id, e.target.value)
                                        }
                                        className="h-7 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 text-xs text-amber-200 outline-none focus:border-zinc-600"
                                        placeholder="0"
                                      />
                                    </label>
                                    <span className="pb-1 text-[10px] text-zinc-500">사용자 지정</span>
                                    <button
                                      type="button"
                                      className="h-7 rounded-md border border-red-800/70 bg-red-950/40 px-2 text-[11px] font-semibold text-red-200 hover:bg-red-900/40"
                                      onClick={() => removeDraftResourceValue("buildCost", id)}
                                    >
                                      제거
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                            <div className="mt-2">
                              <div className="mb-1 text-[11px] text-zinc-400">사용자 지정 (아이템 DB 검색)</div>
                              <div className="relative">
                                <div className="grid grid-cols-[1fr_auto] gap-1.5">
                                  <input
                                    value={buildCostItemQuery}
                                    onChange={(e) => setBuildCostItemQuery(e.target.value)}
                                    className="h-7 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-100 outline-none focus:border-zinc-600"
                                    placeholder="아이템 이름 검색"
                                  />
                                  <button
                                    type="button"
                                    className="h-7 rounded-md border border-amber-700/70 bg-amber-950/40 px-2 text-[11px] font-semibold text-amber-200 hover:bg-amber-900/40"
                                    onClick={() =>
                                      addCustomResourceToField("buildCost", buildCostItemQuery)
                                    }
                                  >
                                    추가
                                  </button>
                                </div>
                                {getItemSearchCandidates(buildCostItemQuery).length > 0 ? (
                                  <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-20 max-h-28 overflow-y-auto rounded-md border border-zinc-700 bg-zinc-950/95 p-1">
                                    {getItemSearchCandidates(buildCostItemQuery).map((name) => (
                                      <button
                                        key={`build-item-candidate-${name}`}
                                        type="button"
                                        className="block w-full rounded px-2 py-1 text-left text-[11px] text-zinc-200 hover:bg-zinc-800/60"
                                        onClick={() => {
                                          setBuildCostItemQuery(name);
                                          addCustomResourceToField("buildCost", name);
                                        }}
                                      >
                                        {name}
                                      </button>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </div>
                          <div className="rounded-lg border border-emerald-800/60 bg-emerald-950/20 p-2.5">
                            <div className="mb-2 text-xs font-semibold text-zinc-300">{upkeepResourceBlockTitle}</div>
                            <div className="grid grid-cols-2 gap-1.5">
                              {BUILDING_PRESET_RESOURCE_IDS.map((id) => (
                                <label key={`upkeep-res-${id}`} className="block">
                                  <div className="mb-1 text-[11px] text-zinc-400">{RESOURCE_LABELS[id]}</div>
                                  <input
                                    value={buildingDraft.upkeepResources[id] ?? ""}
                                    onChange={(e) =>
                                      setDraftResourceValue("upkeepResources", id, e.target.value)
                                    }
                                    className="h-7 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 text-xs text-emerald-200 outline-none focus:border-zinc-600"
                                    placeholder="0"
                                  />
                                </label>
                              ))}
                            </div>
                            {upkeepCustomIds.length > 0 ? (
                              <div className="mt-2 space-y-1.5">
                                {upkeepCustomIds.map((id) => (
                                  <div
                                    key={`upkeep-custom-${id}`}
                                    className="grid grid-cols-[1fr_90px_auto] items-end gap-1.5"
                                  >
                                    <label className="block">
                                      <div className="mb-1 truncate text-[11px] text-zinc-400">
                                        {getBuildingResourceLabel(id)}
                                      </div>
                                      <input
                                        value={buildingDraft.upkeepResources[id] ?? ""}
                                        onChange={(e) =>
                                          setDraftResourceValue("upkeepResources", id, e.target.value)
                                        }
                                        className="h-7 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 text-xs text-emerald-200 outline-none focus:border-zinc-600"
                                        placeholder="0"
                                      />
                                    </label>
                                    <span className="pb-1 text-[10px] text-zinc-500">사용자 지정</span>
                                    <button
                                      type="button"
                                      className="h-7 rounded-md border border-red-800/70 bg-red-950/40 px-2 text-[11px] font-semibold text-red-200 hover:bg-red-900/40"
                                      onClick={() => removeDraftResourceValue("upkeepResources", id)}
                                    >
                                      제거
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                            <div className="mt-2">
                              <div className="mb-1 text-[11px] text-zinc-400">사용자 지정 (아이템 DB 검색)</div>
                              <div className="relative">
                                <div className="grid grid-cols-[1fr_auto] gap-1.5">
                                  <input
                                    value={upkeepItemQuery}
                                    onChange={(e) => setUpkeepItemQuery(e.target.value)}
                                    className="h-7 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-100 outline-none focus:border-zinc-600"
                                    placeholder="아이템 이름 검색"
                                  />
                                  <button
                                    type="button"
                                    className="h-7 rounded-md border border-emerald-700/70 bg-emerald-950/40 px-2 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-900/40"
                                    onClick={() =>
                                      addCustomResourceToField("upkeepResources", upkeepItemQuery)
                                    }
                                  >
                                    추가
                                  </button>
                                </div>
                                {getItemSearchCandidates(upkeepItemQuery).length > 0 ? (
                                  <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-20 max-h-28 overflow-y-auto rounded-md border border-zinc-700 bg-zinc-950/95 p-1">
                                    {getItemSearchCandidates(upkeepItemQuery).map((name) => (
                                      <button
                                        key={`upkeep-item-candidate-${name}`}
                                        type="button"
                                        className="block w-full rounded px-2 py-1 text-left text-[11px] text-zinc-200 hover:bg-zinc-800/60"
                                        onClick={() => {
                                          setUpkeepItemQuery(name);
                                          addCustomResourceToField("upkeepResources", name);
                                        }}
                                      >
                                        {name}
                                      </button>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </div>
                          <div className="rounded-lg border border-fuchsia-800/60 bg-fuchsia-950/20 p-2.5">
                            <div className="mb-2 text-xs font-semibold text-zinc-300">{upkeepPopulationBlockTitle}</div>
                            <div className="grid grid-cols-2 gap-1.5">
                              {UPKEEP_POPULATION_IDS.map((id) => (
                                <label key={`upkeep-pop-${id}`} className="block">
                                  <div className="mb-1 text-[11px] text-zinc-400">
                                    {UPKEEP_POPULATION_LABELS[id]}
                                  </div>
                                  <input
                                    value={buildingDraft.upkeepPopulation[id] ?? ""}
                                    onChange={(e) => setDraftPopulationValue(id, e.target.value)}
                                    className="h-7 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 text-xs text-fuchsia-200 outline-none focus:border-zinc-600"
                                    placeholder="0"
                                  />
                                </label>
                              ))}
                            </div>
                          </div>
                        </div>
                        {editingPresetType === "building" ? (
                          <div className="rounded-lg border border-zinc-800 bg-zinc-950/30 p-3">
                          <div className="mb-2 flex items-center justify-between">
                            <div className="text-xs font-semibold text-zinc-300">배치 조건 블록</div>
                            <button
                              type="button"
                              className="rounded-md border border-zinc-700 px-2 py-1 text-[11px] font-semibold text-zinc-200 hover:border-zinc-500"
                              onClick={handleAddPlacementRule}
                              disabled={busy}
                            >
                                조건 추가
                            </button>
                          </div>
                          <div className="space-y-2">
                            {buildingDraft.placementRules.length === 0 ? (
                                <div className="text-xs text-zinc-500">조건 없음</div>
                            ) : (
                              buildingDraft.placementRules.map((rule, index) => (
                                <div
                                  key={`placement-${index}`}
                                  className="grid gap-2 rounded-md border border-zinc-800 bg-zinc-950/40 p-2 md:grid-cols-[180px_1fr_auto]"
                                >
                                  <select
                                    value={rule.kind}
                                    onChange={(e) =>
                                      handleSetPlacementRuleKind(
                                        index,
                                        e.target.value as BuildingPlacementRule["kind"]
                                      )
                                    }
                                    className="h-8 rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                  >
                                    <option value="uniquePerTile">타일당 N개</option>
                                    <option value="tileRegionCompare">지역 상태 비교</option>
                                    <option value="requireTagInRange">거리 내 속성 필요</option>
                                    <option value="requireBuildingInRange">거리 내 건물 필요</option>
                                    <option value="requireTroopInRange">거리 내 병력 필요</option>
                                    <option value="custom">사용자 정의</option>
                                  </select>
                                  <div className="flex flex-wrap items-center gap-2">
                                    {rule.kind === "uniquePerTile" ? (
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-zinc-400">최대</span>
                                        <input
                                          value={String(rule.maxCount ?? 1)}
                                          onChange={(e) =>
                                            setDraftPlacementRules((prev) =>
                                              prev.map((item, i) =>
                                                i === index && item.kind === "uniquePerTile"
                                                  ? {
                                                      ...item,
                                                      maxCount: Math.max(
                                                        1,
                                                        Math.trunc(
                                                          Number(
                                                            e.target.value.replace(/[^\d]/g, "")
                                                          ) || 1
                                                        )
                                                      ),
                                                    }
                                                  : item
                                              )
                                            )
                                          }
                                          className="h-8 w-20 rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                          placeholder="1"
                                        />
                                        <span className="text-xs text-zinc-400">개</span>
                                      </div>
                                    ) : null}
                                    {rule.kind === "tileRegionCompare" ? (
                                      <>
                                        <select
                                          value={rule.field}
                                          onChange={(e) =>
                                            setDraftPlacementRules((prev) =>
                                              prev.map((item, i) =>
                                                i === index && item.kind === "tileRegionCompare"
                                                  ? {
                                                      ...item,
                                                      field: e.target.value as
                                                        | "spaceRemaining"
                                                        | "pollution"
                                                        | "threat",
                                                    }
                                                  : item
                                              )
                                            )
                                          }
                                          className="h-8 min-w-[140px] rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                        >
                                          <option value="spaceRemaining">남은 공간</option>
                                          <option value="pollution">오염도</option>
                                          <option value="threat">위협도</option>
                                        </select>
                                        <select
                                          value={rule.op}
                                          onChange={(e) =>
                                            setDraftPlacementRules((prev) =>
                                              prev.map((item, i) =>
                                                i === index && item.kind === "tileRegionCompare"
                                                  ? {
                                                      ...item,
                                                      op: e.target.value as
                                                        | "eq"
                                                        | "ne"
                                                        | "gt"
                                                        | "gte"
                                                        | "lt"
                                                        | "lte",
                                                    }
                                                  : item
                                              )
                                            )
                                          }
                                          className="h-8 min-w-[90px] rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                        >
                                          <option value="eq">==</option>
                                          <option value="ne">!=</option>
                                          <option value="gt">{">"}</option>
                                          <option value="gte">{">="}</option>
                                          <option value="lt">{"<"}</option>
                                          <option value="lte">{"<="}</option>
                                        </select>
                                        <input
                                          value={String(rule.value ?? 0)}
                                          onChange={(e) =>
                                            setDraftPlacementRules((prev) =>
                                              prev.map((item, i) =>
                                                i === index && item.kind === "tileRegionCompare"
                                                  ? {
                                                      ...item,
                                                      value:
                                                        toNonNegativeInt(
                                                          e.target.value.replace(/[^\d]/g, "")
                                                        ) ?? 0,
                                                    }
                                                  : item
                                              )
                                            )
                                          }
                                          className="h-8 w-24 rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                          placeholder="값"
                                        />
                                      </>
                                    ) : null}
                                    {rule.kind === "requireTagInRange" ? (
                                      <>
                                        <div className="min-w-[220px] space-y-1">
                                          <div className="rounded-md border border-zinc-800 bg-zinc-950/50 px-2 py-1 text-[11px] text-zinc-300">
                                            선택:{" "}
                                            {activeTilePresets.find((p) => p.id === rule.tagPresetId)?.name ??
                                              "없음"}
                                          </div>
                                          <div className="relative">
                                            <input
                                              value={placementRuleSearch[`tag-${index}`] ?? ""}
                                              onChange={(e) =>
                                                setPlacementRuleSearch((prev) => ({
                                                  ...prev,
                                                  [`tag-${index}`]: e.target.value,
                                                }))
                                              }
                                              className="h-8 min-w-[140px] rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                              placeholder="속성 검색"
                                            />
                                            {(placementRuleSearch[`tag-${index}`] ?? "").trim() ? (
                                              <div className="absolute left-0 right-0 top-[calc(100%+2px)] z-30 max-h-28 overflow-auto rounded-md border border-zinc-800 bg-zinc-950 p-1 shadow-xl">
                                                {activeTilePresets
                                                  .filter((preset) =>
                                                    preset.name.includes(
                                                      (placementRuleSearch[`tag-${index}`] ?? "").trim()
                                                    )
                                                  )
                                                  .slice(0, 12)
                                                  .map((preset) => (
                                                    <button
                                                      key={`pick-tag-${index}-${preset.id}`}
                                                      type="button"
                                                      className="mb-1 block w-full rounded border border-zinc-800 bg-zinc-900/70 px-2 py-1 text-left text-[11px] text-zinc-200 hover:border-zinc-600"
                                                      onClick={() => {
                                                        setDraftPlacementRules((prev) =>
                                                          prev.map((item, i) =>
                                                            i === index &&
                                                            item.kind === "requireTagInRange"
                                                              ? {
                                                                  ...item,
                                                                  tagPresetId: preset.id,
                                                                }
                                                              : item
                                                          )
                                                        );
                                                        setPlacementRuleSearch((prev) => ({
                                                          ...prev,
                                                          [`tag-${index}`]: "",
                                                        }));
                                                      }}
                                                    >
                                                      {preset.name}
                                                    </button>
                                                  ))}
                                              </div>
                                            ) : null}
                                          </div>
                                        </div>
                                        <span className="text-xs text-zinc-400">거리</span>
                                        <input
                                          value={String(rule.distance ?? 1)}
                                          onChange={(e) =>
                                            setDraftPlacementRules((prev) =>
                                              prev.map((item, i) =>
                                                i === index && item.kind === "requireTagInRange"
                                                  ? {
                                                      ...item,
                                                      distance: Math.max(
                                                        0,
                                                        Math.trunc(
                                                          Number(
                                                            e.target.value.replace(/[^\d]/g, "")
                                                          ) || 0
                                                        )
                                                      ),
                                                    }
                                                  : item
                                              )
                                            )
                                          }
                                          className="h-8 w-20 rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                          placeholder="0"
                                        />
                                        <label className="inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200">
                                          <input
                                            type="checkbox"
                                            checked={!!rule.negate}
                                            onChange={(e) =>
                                              setDraftPlacementRules((prev) =>
                                                prev.map((item, i) =>
                                                  i === index && item.kind === "requireTagInRange"
                                                    ? { ...item, negate: e.target.checked }
                                                    : item
                                                )
                                              )
                                            }
                                          />
                                          부정
                                        </label>
                                        {(() => {
                                          const selected = activeTilePresets.find(
                                            (preset) => preset.id === rule.tagPresetId
                                          );
                                          if (!selected?.hasValue) return null;
                                          return (
                                            <>
                                              <select
                                                value={rule.valueMode ?? "equals"}
                                                onChange={(e) =>
                                                  setDraftPlacementRules((prev) =>
                                                    prev.map((item, i) =>
                                                      i === index &&
                                                      item.kind === "requireTagInRange"
                                                        ? {
                                                            ...item,
                                                            valueMode: e.target.value as
                                                              | "equals"
                                                              | "contains",
                                                          }
                                                        : item
                                                    )
                                                  )
                                                }
                                                className="h-8 min-w-[110px] rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                              >
                                                <option value="equals">값 일치</option>
                                                <option value="contains">값 포함</option>
                                              </select>
                                              <input
                                                value={rule.value ?? ""}
                                                onChange={(e) =>
                                                  setDraftPlacementRules((prev) =>
                                                    prev.map((item, i) =>
                                                      i === index &&
                                                      item.kind === "requireTagInRange"
                                                        ? { ...item, value: e.target.value }
                                                        : item
                                                    )
                                                  )
                                                }
                                                className="h-8 min-w-[140px] rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                                placeholder="속성 값"
                                              />
                                            </>
                                          );
                                        })()}
                                      </>
                                    ) : null}
                                    {rule.kind === "requireBuildingInRange" ? (
                                      <>
                                        <div className="min-w-[220px] space-y-1">
                                          <div className="rounded-md border border-zinc-800 bg-zinc-950/50 px-2 py-1 text-[11px] text-zinc-300">
                                            선택:{" "}
                                            {activeBuildingPresets.find((p) => p.id === rule.presetId)?.name ??
                                              "없음"}
                                          </div>
                                          <div className="relative">
                                            <input
                                              value={placementRuleSearch[`building-${index}`] ?? ""}
                                              onChange={(e) =>
                                                setPlacementRuleSearch((prev) => ({
                                                  ...prev,
                                                  [`building-${index}`]: e.target.value,
                                                }))
                                              }
                                              className="h-8 min-w-[140px] rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                              placeholder="건물 검색"
                                            />
                                            {(placementRuleSearch[`building-${index}`] ?? "").trim() ? (
                                              <div className="absolute left-0 right-0 top-[calc(100%+2px)] z-30 max-h-28 overflow-auto rounded-md border border-zinc-800 bg-zinc-950 p-1 shadow-xl">
                                                {activeBuildingPresets
                                                  .filter((preset) =>
                                                    preset.name.includes(
                                                      (placementRuleSearch[`building-${index}`] ?? "").trim()
                                                    )
                                                  )
                                                  .slice(0, 12)
                                                  .map((preset) => (
                                                    <button
                                                      key={`pick-building-${index}-${preset.id}`}
                                                      type="button"
                                                      className="mb-1 block w-full rounded border border-zinc-800 bg-zinc-900/70 px-2 py-1 text-left text-[11px] text-zinc-200 hover:border-zinc-600"
                                                      onClick={() => {
                                                        setDraftPlacementRules((prev) =>
                                                          prev.map((item, i) =>
                                                            i === index &&
                                                            item.kind === "requireBuildingInRange"
                                                              ? {
                                                                  ...item,
                                                                  presetId: preset.id,
                                                                }
                                                              : item
                                                          )
                                                        );
                                                        setPlacementRuleSearch((prev) => ({
                                                          ...prev,
                                                          [`building-${index}`]: "",
                                                        }));
                                                      }}
                                                    >
                                                      {preset.name}
                                                    </button>
                                                  ))}
                                              </div>
                                            ) : null}
                                          </div>
                                        </div>
                                        <span className="text-xs text-zinc-400">거리</span>
                                        <input
                                          value={String(rule.distance ?? 1)}
                                          onChange={(e) =>
                                            setDraftPlacementRules((prev) =>
                                              prev.map((item, i) =>
                                                i === index && item.kind === "requireBuildingInRange"
                                                  ? {
                                                      ...item,
                                                      distance: Math.max(
                                                        0,
                                                        Math.trunc(
                                                          Number(
                                                            e.target.value.replace(/[^\d]/g, "")
                                                          ) || 0
                                                        )
                                                      ),
                                                    }
                                                  : item
                                              )
                                            )
                                          }
                                          className="h-8 w-20 rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                          placeholder="0"
                                        />
                                        <label className="inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200">
                                          <input
                                            type="checkbox"
                                            checked={!!rule.negate}
                                            onChange={(e) =>
                                              setDraftPlacementRules((prev) =>
                                                prev.map((item, i) =>
                                                  i === index &&
                                                  item.kind === "requireBuildingInRange"
                                                    ? { ...item, negate: e.target.checked }
                                                    : item
                                                )
                                              )
                                            }
                                          />
                                          부정
                                        </label>
                                      </>
                                    ) : null}
                                    {rule.kind === "requireTroopInRange" ? (
                                      <>
                                        <div className="min-w-[220px] space-y-1">
                                          <div className="rounded-md border border-zinc-800 bg-zinc-950/50 px-2 py-1 text-[11px] text-zinc-300">
                                            선택:{" "}
                                            {activeTroopPresets.find((p) => p.id === rule.presetId)?.name ??
                                              "없음"}
                                          </div>
                                          <div className="relative">
                                            <input
                                              value={placementRuleSearch[`troop-${index}`] ?? ""}
                                              onChange={(e) =>
                                                setPlacementRuleSearch((prev) => ({
                                                  ...prev,
                                                  [`troop-${index}`]: e.target.value,
                                                }))
                                              }
                                              className="h-8 min-w-[140px] rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                              placeholder="병력 검색"
                                            />
                                            {(placementRuleSearch[`troop-${index}`] ?? "").trim() ? (
                                              <div className="absolute left-0 right-0 top-[calc(100%+2px)] z-30 max-h-28 overflow-auto rounded-md border border-zinc-800 bg-zinc-950 p-1 shadow-xl">
                                                {activeTroopPresets
                                                  .filter((preset) =>
                                                    preset.name.includes(
                                                      (placementRuleSearch[`troop-${index}`] ?? "").trim()
                                                    )
                                                  )
                                                  .slice(0, 12)
                                                  .map((preset) => (
                                                    <button
                                                      key={`pick-troop-${index}-${preset.id}`}
                                                      type="button"
                                                      className="mb-1 block w-full rounded border border-zinc-800 bg-zinc-900/70 px-2 py-1 text-left text-[11px] text-zinc-200 hover:border-zinc-600"
                                                      onClick={() => {
                                                        setDraftPlacementRules((prev) =>
                                                          prev.map((item, i) =>
                                                            i === index &&
                                                            item.kind === "requireTroopInRange"
                                                              ? {
                                                                  ...item,
                                                                  presetId: preset.id,
                                                                }
                                                              : item
                                                          )
                                                        );
                                                        setPlacementRuleSearch((prev) => ({
                                                          ...prev,
                                                          [`troop-${index}`]: "",
                                                        }));
                                                      }}
                                                    >
                                                      {preset.name}
                                                    </button>
                                                  ))}
                                              </div>
                                            ) : null}
                                          </div>
                                        </div>
                                        <span className="text-xs text-zinc-400">거리</span>
                                        <input
                                          value={String(rule.distance ?? 1)}
                                          onChange={(e) =>
                                            setDraftPlacementRules((prev) =>
                                              prev.map((item, i) =>
                                                i === index && item.kind === "requireTroopInRange"
                                                  ? {
                                                      ...item,
                                                      distance: Math.max(
                                                        0,
                                                        Math.trunc(
                                                          Number(
                                                            e.target.value.replace(/[^\d]/g, "")
                                                          ) || 0
                                                        )
                                                      ),
                                                    }
                                                  : item
                                              )
                                            )
                                          }
                                          className="h-8 w-20 rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                          placeholder="0"
                                        />
                                        <label className="inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200">
                                          <input
                                            type="checkbox"
                                            checked={!!rule.negate}
                                            onChange={(e) =>
                                              setDraftPlacementRules((prev) =>
                                                prev.map((item, i) =>
                                                  i === index &&
                                                  item.kind === "requireTroopInRange"
                                                    ? { ...item, negate: e.target.checked }
                                                    : item
                                                )
                                              )
                                            }
                                          />
                                          부정
                                        </label>
                                      </>
                                    ) : null}
                                    {rule.kind === "custom" ? (
                                      <input
                                        value={rule.label ?? ""}
                                        onChange={(e) =>
                                          setDraftPlacementRules((prev) =>
                                            prev.map((item, i) =>
                                              i === index && item.kind === "custom"
                                                ? { ...item, label: e.target.value }
                                                : item
                                            )
                                          )
                                        }
                                        className="h-8 min-w-[180px] rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                        placeholder="사용자 정의 조건"
                                      />
                                    ) : null}
                                  </div>
                                  <button
                                    type="button"
                                    className="h-8 rounded-md border border-red-800/70 bg-red-950/40 px-2 text-[11px] font-semibold text-red-200 hover:bg-red-900/40"
                                    onClick={() => handleRemovePlacementRule(index)}
                                    disabled={busy}
                                  >
                                    제거
                                  </button>
                                </div>
                              ))
                            )}
                          </div>
                          </div>
                        ) : null}
                        {editingPresetType === "building"
                          ? (
                          [
                            ["onBuild", "건설 시 규칙"],
                            ["daily", "일일 규칙"],
                            ["sustain", "지속 효과"],
                            ["onRemove", "철거 시 규칙"],
                          ] as const
                        ).map(([field, title]) => (
                          <div
                            key={`effects-${field}`}
                            className="rounded-lg border border-zinc-800 bg-zinc-950/30 p-3"
                          >
                            <div className="mb-2 flex items-center justify-between">
                              <div className="text-xs font-semibold text-zinc-300">{title}</div>
                              <button
                                type="button"
                                className="rounded-md border border-zinc-700 px-2 py-1 text-[11px] font-semibold text-zinc-200 hover:border-zinc-500"
                                onClick={() => handleAddExecutionRule(field)}
                                disabled={busy}
                              >
                                규칙 추가
                              </button>
                            </div>
                            <div className="space-y-2">
                              {buildingDraft[field].length === 0 ? (
                                <div className="text-xs text-zinc-500">규칙 없음</div>
                              ) : (
                                buildingDraft[field].map((rule, ruleIndex) => {
                                  const whenKind = getWhenKind(rule.when);
                                  const compareWhen =
                                    whenKind === "compare" && rule.when?.kind === "compare"
                                      ? rule.when
                                      : null;
                                  const tileRegionCompareWhen =
                                    whenKind === "tileRegionCompare" &&
                                    rule.when?.kind === "tileRegionCompare"
                                      ? rule.when
                                      : null;
                                  const placementWhen =
                                    whenKind &&
                                    whenKind !== "compare" &&
                                    whenKind !== "tileRegionCompare" &&
                                    rule.when &&
                                    isPlacementRuleKind(rule.when.kind)
                                      ? (rule.when as BuildingPlacementRule)
                                      : null;
                                  const leftResource =
                                    compareWhen?.left.kind === "resource"
                                      ? compareWhen.left.resourceId
                                      : "gold";
                                  return (
                                    <div
                                      key={`rule-${field}-${rule.id}-${ruleIndex}`}
                                      className="rounded-md border border-amber-800/60 bg-amber-950/15 p-2"
                                    >
                                      <div className="mb-2 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <label className="flex items-center gap-2 text-xs text-zinc-300">
                                            <input
                                              type="checkbox"
                                              checked={!!rule.when}
                                              onChange={(e) =>
                                                setEffectRuleAt(field, ruleIndex, {
                                                  ...rule,
                                                  when: e.target.checked
                                                    ? createDefaultComparePredicate()
                                                    : undefined,
                                                })
                                              }
                                            />
                                            조건 사용
                                          </label>
                                          {rule.when ? (
                                            <select
                                              value={whenKind ?? "compare"}
                                              onChange={(e) =>
                                                setEffectRuleAt(field, ruleIndex, {
                                                  ...rule,
                                                  when: createDefaultWhenByKind(
                                                    e.target.value as RuleWhenKind
                                                  ),
                                                })
                                              }
                                              className="h-7 rounded-md border border-zinc-700 bg-zinc-950 px-2 text-[11px] text-zinc-100"
                                            >
                                              <option value="compare">자원 비교</option>
                                              <option value="tileRegionCompare">
                                                지역 상태 비교
                                              </option>
                                              <option value="uniquePerTile">타일당 N개</option>
                                              <option value="requireTagInRange">
                                                거리 내 속성 필요
                                              </option>
                                              <option value="requireBuildingInRange">
                                                거리 내 건물 필요
                                              </option>
                                              <option value="requireTroopInRange">
                                                거리 내 병력 필요
                                              </option>
                                              <option value="custom">사용자 정의</option>
                                            </select>
                                          ) : null}
                                          {field === "daily" ? (
                                            <div className="flex items-center gap-1">
                                              <input
                                                value={String(rule.intervalDays ?? 1)}
                                               onChange={(e) =>
                                                 setEffectRuleAt(field, ruleIndex, {
                                                   ...rule,
                                                   intervalDays:
                                                     Math.max(
                                                       1,
                                                       Math.trunc(
                                                         Number(
                                                           e.target.value.replace(/[^\d]/g, "")
                                                         ) || 1
                                                       )
                                                     ),
                                                 })
                                               }
                                               className="h-7 w-16 rounded-md border border-zinc-700 bg-zinc-950 px-2 text-[11px] text-emerald-200"
                                               placeholder="1"
                                             />
                                               <span className="text-[11px] text-zinc-400">일마다</span>
                                           </div>
                                          ) : null}
                                        </div>
                                        <button
                                          type="button"
                                          className="rounded-md border border-red-800/70 bg-red-950/40 px-2 py-1 text-[11px] font-semibold text-red-200 hover:bg-red-900/40"
                                          onClick={() => removeEffectRule(field, ruleIndex)}
                                          disabled={busy}
                                        >
                                          규칙 제거
                                        </button>
                                      </div>
                                      {compareWhen ? (
                                        <div className="mb-2 grid gap-2 rounded-md border border-sky-800/60 bg-sky-950/15 p-2 md:grid-cols-[1fr_90px_110px]">
                                          <select
                                            value={leftResource}
                                            onChange={(e) =>
                                              setEffectRuleAt(field, ruleIndex, {
                                                ...rule,
                                                when: {
                                                  ...compareWhen,
                                                  left: {
                                                    kind: "resource",
                                                    resourceId: e.target.value as ResourceId,
                                                  },
                                                },
                                              })
                                            }
                                            className="h-8 rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                          >
                                            {ALL_RESOURCE_IDS.map((id) => (
                                              <option key={`cond-r-${id}`} value={id}>
                                                {RESOURCE_LABELS[id]}
                                              </option>
                                            ))}
                                          </select>
                                          <select
                                            value={compareWhen.op}
                                            onChange={(e) =>
                                              setEffectRuleAt(field, ruleIndex, {
                                                ...rule,
                                                when: {
                                                  ...compareWhen,
                                                  op: e.target.value as typeof compareWhen.op,
                                                },
                                              })
                                            }
                                            className="h-8 rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                          >
                                            <option value="eq">==</option>
                                            <option value="ne">!=</option>
                                            <option value="gt">{">"}</option>
                                            <option value="gte">{">="}</option>
                                            <option value="lt">{"<"}</option>
                                            <option value="lte">{"<="}</option>
                                          </select>
                                          <input
                                            value={exprToEditableNumber(compareWhen.right)}
                                            onChange={(e) =>
                                              setEffectRuleAt(field, ruleIndex, {
                                                ...rule,
                                                when: {
                                                  ...compareWhen,
                                                  right: {
                                                    kind: "const",
                                                    value:
                                                      toNonNegativeInt(
                                                        e.target.value.replace(/[^\d]/g, "")
                                                      ) ?? 0,
                                                  },
                                                },
                                              })
                                            }
                                            className="h-8 rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                            placeholder="값"
                                          />
                                        </div>
                                      ) : null}
                                      {tileRegionCompareWhen ? (
                                        <div className="mb-2 grid gap-2 rounded-md border border-sky-800/60 bg-sky-950/15 p-2 md:grid-cols-[1fr_90px_110px]">
                                          <select
                                            value={tileRegionCompareWhen.field}
                                            onChange={(e) =>
                                              setEffectRuleAt(field, ruleIndex, {
                                                ...rule,
                                                when: {
                                                  ...tileRegionCompareWhen,
                                                  field: e.target.value as
                                                    | "spaceRemaining"
                                                    | "pollution"
                                                    | "threat",
                                                },
                                              })
                                            }
                                            className="h-8 rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                          >
                                            <option value="spaceRemaining">남은 공간</option>
                                            <option value="pollution">오염도</option>
                                            <option value="threat">위협도</option>
                                          </select>
                                          <select
                                            value={tileRegionCompareWhen.op}
                                            onChange={(e) =>
                                              setEffectRuleAt(field, ruleIndex, {
                                                ...rule,
                                                when: {
                                                  ...tileRegionCompareWhen,
                                                  op: e.target.value as typeof tileRegionCompareWhen.op,
                                                },
                                              })
                                            }
                                            className="h-8 rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                          >
                                            <option value="eq">==</option>
                                            <option value="ne">!=</option>
                                            <option value="gt">{">"}</option>
                                            <option value="gte">{">="}</option>
                                            <option value="lt">{"<"}</option>
                                            <option value="lte">{"<="}</option>
                                          </select>
                                          <input
                                            value={String(tileRegionCompareWhen.value ?? 0)}
                                            onChange={(e) =>
                                              setEffectRuleAt(field, ruleIndex, {
                                                ...rule,
                                                when: {
                                                  ...tileRegionCompareWhen,
                                                  value:
                                                    toNonNegativeInt(
                                                      e.target.value.replace(/[^\d]/g, "")
                                                    ) ?? 0,
                                                },
                                              })
                                            }
                                            className="h-8 rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                            placeholder="값"
                                          />
                                        </div>
                                      ) : null}
                                      {!compareWhen && placementWhen ? (
                                        <div className="mb-2 flex flex-wrap items-center gap-2 rounded-md border border-sky-800/60 bg-sky-950/15 p-2">
                                          {placementWhen.kind === "uniquePerTile" ? (
                                            <div className="flex items-center gap-2">
                                              <span className="text-xs text-zinc-400">최대</span>
                                              <input
                                                value={String(placementWhen.maxCount ?? 1)}
                                                onChange={(e) =>
                                                  setEffectRuleAt(field, ruleIndex, {
                                                    ...rule,
                                                    when: {
                                                      ...placementWhen,
                                                      maxCount: Math.max(
                                                        1,
                                                        Math.trunc(
                                                          Number(
                                                            e.target.value.replace(/[^\d]/g, "")
                                                          ) || 1
                                                        )
                                                      ),
                                                    },
                                                  })
                                                }
                                                className="h-8 w-20 rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                                placeholder="1"
                                              />
                                              <span className="text-xs text-zinc-400">개</span>
                                            </div>
                                          ) : null}
                                          {placementWhen.kind === "requireTagInRange" ? (
                                            <>
                                              <div className="min-w-[220px] space-y-1">
                                                <div className="rounded-md border border-zinc-800 bg-zinc-950/50 px-2 py-1 text-[11px] text-zinc-300">
                                                  선택:{" "}
                                                  {activeTilePresets.find(
                                                    (p) => p.id === placementWhen.tagPresetId
                                                  )?.name ?? "없음"}
                                                </div>
                                                <div className="relative">
                                                  <input
                                                    value={
                                                      placementRuleSearch[
                                                        `when-tag-${field}-${ruleIndex}`
                                                      ] ?? ""
                                                    }
                                                    onChange={(e) =>
                                                      setPlacementRuleSearch((prev) => ({
                                                        ...prev,
                                                        [`when-tag-${field}-${ruleIndex}`]:
                                                          e.target.value,
                                                      }))
                                                    }
                                                    className="h-8 min-w-[140px] rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                                    placeholder="속성 검색"
                                                  />
                                                  {(
                                                    placementRuleSearch[
                                                      `when-tag-${field}-${ruleIndex}`
                                                    ] ?? ""
                                                  ).trim() ? (
                                                    <div className="absolute left-0 right-0 top-[calc(100%+2px)] z-30 max-h-28 overflow-auto rounded-md border border-zinc-800 bg-zinc-950 p-1 shadow-xl">
                                                      {activeTilePresets
                                                        .filter((preset) =>
                                                          preset.name.includes(
                                                            (
                                                              placementRuleSearch[
                                                                `when-tag-${field}-${ruleIndex}`
                                                              ] ?? ""
                                                            ).trim()
                                                          )
                                                        )
                                                        .slice(0, 12)
                                                        .map((preset) => (
                                                          <button
                                                            key={`pick-when-tag-${field}-${rule.id}-${ruleIndex}-${preset.id}`}
                                                            type="button"
                                                            className="mb-1 block w-full rounded border border-zinc-800 bg-zinc-900/70 px-2 py-1 text-left text-[11px] text-zinc-200 hover:border-zinc-600"
                                                            onClick={() => {
                                                              setEffectRuleAt(field, ruleIndex, {
                                                                ...rule,
                                                                when: {
                                                                  ...placementWhen,
                                                                  tagPresetId: preset.id,
                                                                },
                                                              });
                                                              setPlacementRuleSearch((prev) => ({
                                                                ...prev,
                                                                [`when-tag-${field}-${ruleIndex}`]: "",
                                                              }));
                                                            }}
                                                          >
                                                            {preset.name}
                                                          </button>
                                                        ))}
                                                    </div>
                                                  ) : null}
                                                </div>
                                              </div>
                                              <span className="text-xs text-zinc-400">거리</span>
                                              <input
                                                value={String(placementWhen.distance ?? 1)}
                                                onChange={(e) =>
                                                  setEffectRuleAt(field, ruleIndex, {
                                                    ...rule,
                                                    when: {
                                                      ...placementWhen,
                                                      distance: Math.max(
                                                        0,
                                                        Math.trunc(
                                                          Number(
                                                            e.target.value.replace(/[^\d]/g, "")
                                                          ) || 0
                                                        )
                                                      ),
                                                    },
                                                  })
                                                }
                                                className="h-8 w-20 rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                                placeholder="0"
                                              />
                                              <label className="inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200">
                                                <input
                                                  type="checkbox"
                                                  checked={!!placementWhen.negate}
                                                  onChange={(e) =>
                                                    setEffectRuleAt(field, ruleIndex, {
                                                      ...rule,
                                                      when: {
                                                        ...placementWhen,
                                                        negate: e.target.checked,
                                                      },
                                                    })
                                                  }
                                                />
                                                부정
                                              </label>
                                              <label className="inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200">
                                                <input
                                                  type="checkbox"
                                                  checked={!!placementWhen.repeat}
                                                  onChange={(e) =>
                                                    setEffectRuleAt(field, ruleIndex, {
                                                      ...rule,
                                                      when: {
                                                        ...placementWhen,
                                                        repeat: e.target.checked,
                                                      },
                                                    })
                                                  }
                                                />
                                                반복
                                              </label>
                                              {(() => {
                                                const selected = activeTilePresets.find(
                                                  (preset) =>
                                                    preset.id === placementWhen.tagPresetId
                                                );
                                                if (!selected?.hasValue) return null;
                                                return (
                                                  <>
                                                    <select
                                                      value={placementWhen.valueMode ?? "equals"}
                                                      onChange={(e) =>
                                                        setEffectRuleAt(field, ruleIndex, {
                                                          ...rule,
                                                          when: {
                                                            ...placementWhen,
                                                            valueMode: e.target.value as
                                                              | "equals"
                                                              | "contains",
                                                          },
                                                        })
                                                      }
                                                      className="h-8 min-w-[110px] rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                                    >
                                                      <option value="equals">값 일치</option>
                                                      <option value="contains">값 포함</option>
                                                    </select>
                                                    <input
                                                      value={placementWhen.value ?? ""}
                                                      onChange={(e) =>
                                                        setEffectRuleAt(field, ruleIndex, {
                                                          ...rule,
                                                          when: {
                                                            ...placementWhen,
                                                            value: e.target.value,
                                                          },
                                                        })
                                                      }
                                                      className="h-8 min-w-[140px] rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                                      placeholder="속성 값"
                                                    />
                                                  </>
                                                );
                                              })()}
                                            </>
                                          ) : null}
                                          {placementWhen.kind === "requireBuildingInRange" ? (
                                            <>
                                              <div className="min-w-[220px] space-y-1">
                                                <div className="rounded-md border border-zinc-800 bg-zinc-950/50 px-2 py-1 text-[11px] text-zinc-300">
                                                  선택:{" "}
                                                  {activeBuildingPresets.find(
                                                    (p) => p.id === placementWhen.presetId
                                                  )?.name ?? "없음"}
                                                </div>
                                                <div className="relative">
                                                  <input
                                                    value={
                                                      placementRuleSearch[
                                                        `when-building-${field}-${ruleIndex}`
                                                      ] ?? ""
                                                    }
                                                    onChange={(e) =>
                                                      setPlacementRuleSearch((prev) => ({
                                                        ...prev,
                                                        [`when-building-${field}-${ruleIndex}`]:
                                                          e.target.value,
                                                      }))
                                                    }
                                                    className="h-8 min-w-[140px] rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                                    placeholder="건물 검색"
                                                  />
                                                  {(
                                                    placementRuleSearch[
                                                      `when-building-${field}-${ruleIndex}`
                                                    ] ?? ""
                                                  ).trim() ? (
                                                    <div className="absolute left-0 right-0 top-[calc(100%+2px)] z-30 max-h-28 overflow-auto rounded-md border border-zinc-800 bg-zinc-950 p-1 shadow-xl">
                                                      {activeBuildingPresets
                                                        .filter((preset) =>
                                                          preset.name.includes(
                                                            (
                                                              placementRuleSearch[
                                                                `when-building-${field}-${ruleIndex}`
                                                              ] ?? ""
                                                            ).trim()
                                                          )
                                                        )
                                                        .slice(0, 12)
                                                        .map((preset) => (
                                                          <button
                                                            key={`pick-when-building-${field}-${rule.id}-${ruleIndex}-${preset.id}`}
                                                            type="button"
                                                            className="mb-1 block w-full rounded border border-zinc-800 bg-zinc-900/70 px-2 py-1 text-left text-[11px] text-zinc-200 hover:border-zinc-600"
                                                            onClick={() => {
                                                              setEffectRuleAt(field, ruleIndex, {
                                                                ...rule,
                                                                when: {
                                                                  ...placementWhen,
                                                                  presetId: preset.id,
                                                                },
                                                              });
                                                              setPlacementRuleSearch((prev) => ({
                                                                ...prev,
                                                                [`when-building-${field}-${ruleIndex}`]: "",
                                                              }));
                                                            }}
                                                          >
                                                            {preset.name}
                                                          </button>
                                                        ))}
                                                    </div>
                                                  ) : null}
                                                </div>
                                              </div>
                                              <span className="text-xs text-zinc-400">거리</span>
                                              <input
                                                value={String(placementWhen.distance ?? 1)}
                                                onChange={(e) =>
                                                  setEffectRuleAt(field, ruleIndex, {
                                                    ...rule,
                                                    when: {
                                                      ...placementWhen,
                                                      distance: Math.max(
                                                        0,
                                                        Math.trunc(
                                                          Number(
                                                            e.target.value.replace(/[^\d]/g, "")
                                                          ) || 0
                                                        )
                                                      ),
                                                    },
                                                  })
                                                }
                                                className="h-8 w-20 rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                                placeholder="0"
                                              />
                                              <label className="inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200">
                                                <input
                                                  type="checkbox"
                                                  checked={!!placementWhen.negate}
                                                  onChange={(e) =>
                                                    setEffectRuleAt(field, ruleIndex, {
                                                      ...rule,
                                                      when: {
                                                        ...placementWhen,
                                                        negate: e.target.checked,
                                                      },
                                                    })
                                                  }
                                                />
                                                부정
                                              </label>
                                              <label className="inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200">
                                                <input
                                                  type="checkbox"
                                                  checked={!!placementWhen.repeat}
                                                  onChange={(e) =>
                                                    setEffectRuleAt(field, ruleIndex, {
                                                      ...rule,
                                                      when: {
                                                        ...placementWhen,
                                                        repeat: e.target.checked,
                                                      },
                                                    })
                                                  }
                                                />
                                                반복
                                              </label>
                                            </>
                                          ) : null}
                                          {placementWhen.kind === "requireTroopInRange" ? (
                                            <>
                                              <div className="min-w-[220px] space-y-1">
                                                <div className="rounded-md border border-zinc-800 bg-zinc-950/50 px-2 py-1 text-[11px] text-zinc-300">
                                                  선택:{" "}
                                                  {activeTroopPresets.find(
                                                    (p) => p.id === placementWhen.presetId
                                                  )?.name ?? "없음"}
                                                </div>
                                                <div className="relative">
                                                  <input
                                                    value={
                                                      placementRuleSearch[
                                                        `when-troop-${field}-${ruleIndex}`
                                                      ] ?? ""
                                                    }
                                                    onChange={(e) =>
                                                      setPlacementRuleSearch((prev) => ({
                                                        ...prev,
                                                        [`when-troop-${field}-${ruleIndex}`]:
                                                          e.target.value,
                                                      }))
                                                    }
                                                    className="h-8 min-w-[140px] rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                                    placeholder="병력 검색"
                                                  />
                                                  {(
                                                    placementRuleSearch[
                                                      `when-troop-${field}-${ruleIndex}`
                                                    ] ?? ""
                                                  ).trim() ? (
                                                    <div className="absolute left-0 right-0 top-[calc(100%+2px)] z-30 max-h-28 overflow-auto rounded-md border border-zinc-800 bg-zinc-950 p-1 shadow-xl">
                                                      {activeTroopPresets
                                                        .filter((preset) =>
                                                          preset.name.includes(
                                                            (
                                                              placementRuleSearch[
                                                                `when-troop-${field}-${ruleIndex}`
                                                              ] ?? ""
                                                            ).trim()
                                                          )
                                                        )
                                                        .slice(0, 12)
                                                        .map((preset) => (
                                                          <button
                                                            key={`pick-when-troop-${field}-${rule.id}-${ruleIndex}-${preset.id}`}
                                                            type="button"
                                                            className="mb-1 block w-full rounded border border-zinc-800 bg-zinc-900/70 px-2 py-1 text-left text-[11px] text-zinc-200 hover:border-zinc-600"
                                                            onClick={() => {
                                                              setEffectRuleAt(field, ruleIndex, {
                                                                ...rule,
                                                                when: {
                                                                  ...placementWhen,
                                                                  presetId: preset.id,
                                                                },
                                                              });
                                                              setPlacementRuleSearch((prev) => ({
                                                                ...prev,
                                                                [`when-troop-${field}-${ruleIndex}`]: "",
                                                              }));
                                                            }}
                                                          >
                                                            {preset.name}
                                                          </button>
                                                        ))}
                                                    </div>
                                                  ) : null}
                                                </div>
                                              </div>
                                              <span className="text-xs text-zinc-400">거리</span>
                                              <input
                                                value={String(placementWhen.distance ?? 1)}
                                                onChange={(e) =>
                                                  setEffectRuleAt(field, ruleIndex, {
                                                    ...rule,
                                                    when: {
                                                      ...placementWhen,
                                                      distance: Math.max(
                                                        0,
                                                        Math.trunc(
                                                          Number(
                                                            e.target.value.replace(/[^\d]/g, "")
                                                          ) || 0
                                                        )
                                                      ),
                                                    },
                                                  })
                                                }
                                                className="h-8 w-20 rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                                placeholder="0"
                                              />
                                              <label className="inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200">
                                                <input
                                                  type="checkbox"
                                                  checked={!!placementWhen.negate}
                                                  onChange={(e) =>
                                                    setEffectRuleAt(field, ruleIndex, {
                                                      ...rule,
                                                      when: {
                                                        ...placementWhen,
                                                        negate: e.target.checked,
                                                      },
                                                    })
                                                  }
                                                />
                                                부정
                                              </label>
                                              <label className="inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200">
                                                <input
                                                  type="checkbox"
                                                  checked={!!placementWhen.repeat}
                                                  onChange={(e) =>
                                                    setEffectRuleAt(field, ruleIndex, {
                                                      ...rule,
                                                      when: {
                                                        ...placementWhen,
                                                        repeat: e.target.checked,
                                                      },
                                                    })
                                                  }
                                                />
                                                반복
                                              </label>
                                            </>
                                          ) : null}
                                          {placementWhen.kind === "custom" ? (
                                            <input
                                              value={placementWhen.label ?? ""}
                                              onChange={(e) =>
                                                setEffectRuleAt(field, ruleIndex, {
                                                  ...rule,
                                                  when: { ...placementWhen, label: e.target.value },
                                                })
                                              }
                                              className="h-8 min-w-[180px] rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                              placeholder="사용자 정의 조건"
                                            />
                                          ) : null}
                                        </div>
                                      ) : null}
                                      <div className="space-y-2">
                                        {rule.actions.map((action, actionIndex) => (
                                          (() => {
                                            const supportsTileTarget =
                                              action.kind === "adjustTileRegion" ||
                                              action.kind === "addTileState" ||
                                              action.kind === "removeTileState";
                                            const actionTarget =
                                              (action.target ?? "self") === "range" ? "range" : "self";
                                            return (
                                          <div
                                            key={`action-${field}-${rule.id}-${actionIndex}`}
                                            className="grid gap-2 rounded-md border border-emerald-800/60 bg-emerald-950/15 p-2 md:grid-cols-[170px_1fr_120px_auto]"
                                          >
                                            <select
                                              value={action.kind}
                                              onChange={(e) =>
                                                setEffectActionAt(
                                                  field,
                                                  ruleIndex,
                                                  actionIndex,
                                                  createActionByKind(
                                                    e.target.value as BuildingRuleAction["kind"]
                                                  )
                                                )
                                              }
                                              className="h-8 rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                            >
                                              <option value="adjustResource">자원 증감</option>
                                              <option value="adjustResourceCap">자원 상한 증감</option>
                                              <option value="adjustPopulation">인구 증감</option>
                                              <option value="adjustPopulationCap">인구 상한 증감</option>
                                              <option value="convertPopulation">인구 전환</option>
                                              <option value="adjustTileRegion">지역 상태 증감</option>
                                              <option value="addTileState">타일 속성 추가</option>
                                              <option value="removeTileState">타일 속성 제거</option>
                                            </select>
                                            <div className="flex flex-wrap items-center gap-2">
                                              {action.kind === "adjustResource" ? (
                                                (() => {
                                                  const isCustomResource = !ALL_RESOURCE_IDS.includes(
                                                    action.resourceId as ResourceId
                                                  );
                                                  return (
                                                <div className="relative flex min-w-[560px] flex-nowrap items-center gap-2 overflow-visible">
                                                  <select
                                                    value={
                                                      isCustomResource
                                                        ? "__custom__"
                                                        : action.resourceId
                                                    }
                                                    onChange={(e) => {
                                                      if (e.target.value === "__custom__") {
                                                        const fallbackItem =
                                                          itemNames.length > 0 ? itemNames[0] : null;
                                                        if (!fallbackItem) return;
                                                        setEffectActionAt(field, ruleIndex, actionIndex, {
                                                          ...action,
                                                          resourceId: `item:${fallbackItem}` as BuildingResourceId,
                                                        });
                                                        return;
                                                      }
                                                      setEffectActionAt(field, ruleIndex, actionIndex, {
                                                        ...action,
                                                        resourceId: e.target.value as BuildingResourceId,
                                                      });
                                                    }}
                                                    className="h-8 min-w-[120px] rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                                  >
                                                    {ALL_RESOURCE_IDS.map((id) => (
                                                      <option key={`act-r-${id}`} value={id}>
                                                        {RESOURCE_LABELS[id]}
                                                      </option>
                                                    ))}
                                                    <option value="__custom__">사용자 지정(아이템)</option>
                                                  </select>
                                                  <div className="min-w-[160px] rounded-md border border-zinc-800 bg-zinc-950/50 px-2 py-1 text-[11px] text-zinc-300">
                                                    선택: {getBuildingResourceLabel(action.resourceId)}
                                                  </div>
                                                  {isCustomResource ? (
                                                    <div className="relative min-w-[220px]">
                                                      <input
                                                        value={
                                                          placementRuleSearch[
                                                            `action-resource-${field}-${ruleIndex}-${actionIndex}`
                                                          ] ?? ""
                                                        }
                                                        onChange={(e) =>
                                                          setPlacementRuleSearch((prev) => ({
                                                            ...prev,
                                                            [`action-resource-${field}-${ruleIndex}-${actionIndex}`]:
                                                              e.target.value,
                                                          }))
                                                        }
                                                        className="h-8 min-w-[160px] rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                                        placeholder="아이템 DB 검색"
                                                      />
                                                      {(
                                                        placementRuleSearch[
                                                          `action-resource-${field}-${ruleIndex}-${actionIndex}`
                                                        ] ?? ""
                                                      ).trim() ? (
                                                        <div className="absolute left-0 right-0 top-[calc(100%+2px)] z-50 max-h-28 overflow-auto rounded-md border border-zinc-800 bg-zinc-950 p-1 shadow-xl">
                                                          {getItemSearchCandidates(
                                                            placementRuleSearch[
                                                              `action-resource-${field}-${ruleIndex}-${actionIndex}`
                                                            ] ?? ""
                                                          ).map((name) => (
                                                            <button
                                                              key={`pick-action-resource-${field}-${rule.id}-${ruleIndex}-${actionIndex}-${name}`}
                                                              type="button"
                                                              className="mb-1 block w-full rounded border border-zinc-800 bg-zinc-900/70 px-2 py-1 text-left text-[11px] text-zinc-200 hover:border-zinc-600"
                                                              onClick={() => {
                                                                setEffectActionAt(
                                                                  field,
                                                                  ruleIndex,
                                                                  actionIndex,
                                                                  {
                                                                    ...action,
                                                                    resourceId: `item:${name}` as BuildingResourceId,
                                                                  }
                                                                );
                                                                setPlacementRuleSearch((prev) => ({
                                                                  ...prev,
                                                                  [`action-resource-${field}-${ruleIndex}-${actionIndex}`]:
                                                                    "",
                                                                }));
                                                              }}
                                                            >
                                                              {name}
                                                            </button>
                                                          ))}
                                                        </div>
                                                      ) : null}
                                                    </div>
                                                  ) : null}
                                                </div>
                                                  );
                                                })()
                                              ) : null}
                                              {action.kind === "adjustResourceCap" ? (
                                                <select
                                                  value={action.resourceId}
                                                  onChange={(e) =>
                                                    setEffectActionAt(field, ruleIndex, actionIndex, {
                                                      ...action,
                                                      resourceId: e.target.value as CappedResourceId,
                                                    })
                                                  }
                                                  className="h-8 min-w-[120px] rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                                >
                                                  {CAPPED_RESOURCE_IDS.map((id) => (
                                                    <option key={`act-cap-${id}`} value={id}>
                                                      {RESOURCE_LABELS[id]}
                                                    </option>
                                                  ))}
                                                </select>
                                              ) : null}
                                              {action.kind === "adjustPopulation" ? (
                                                <select
                                                  value={action.populationId}
                                                  onChange={(e) =>
                                                    setEffectActionAt(field, ruleIndex, actionIndex, {
                                                      ...action,
                                                      populationId: e.target.value as PopulationTrackedId,
                                                    })
                                                  }
                                                  className="h-8 min-w-[120px] rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                                >
                                                  {TRACKED_POPULATION_IDS.map((id) => (
                                                    <option key={`act-p-${id}`} value={id}>
                                                      {POPULATION_LABELS[id]}
                                                    </option>
                                                  ))}
                                                </select>
                                              ) : null}
                                              {action.kind === "adjustPopulationCap" ? (
                                                <span className="inline-flex h-8 items-center rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-300">
                                                  전체 인구 상한
                                                </span>
                                              ) : null}
                                              {action.kind === "convertPopulation" ? (
                                                <>
                                                  <select
                                                    value={action.from}
                                                    onChange={(e) =>
                                                      setEffectActionAt(field, ruleIndex, actionIndex, {
                                                        ...action,
                                                        from: e.target.value as PopulationTrackedId,
                                                      })
                                                    }
                                                    className="h-8 min-w-[120px] rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                                  >
                                                    {TRACKED_POPULATION_IDS.map((id) => (
                                                      <option key={`act-from-${id}`} value={id}>
                                                        {POPULATION_LABELS[id]}
                                                      </option>
                                                    ))}
                                                  </select>
                                                  <span className="text-xs text-zinc-500">→</span>
                                                  <select
                                                    value={action.to}
                                                    onChange={(e) =>
                                                      setEffectActionAt(field, ruleIndex, actionIndex, {
                                                        ...action,
                                                        to: e.target.value as PopulationTrackedId,
                                                      })
                                                    }
                                                    className="h-8 min-w-[120px] rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                                  >
                                                    {TRACKED_POPULATION_IDS.map((id) => (
                                                      <option key={`act-to-${id}`} value={id}>
                                                        {POPULATION_LABELS[id]}
                                                      </option>
                                                    ))}
                                                  </select>
                                                </>
                                              ) : null}
                                              {action.kind === "adjustTileRegion" ? (
                                                <select
                                                  value={action.field}
                                                  onChange={(e) =>
                                                    setEffectActionAt(field, ruleIndex, actionIndex, {
                                                      ...action,
                                                      field: e.target.value as keyof MapTileRegionState,
                                                    })
                                                  }
                                                  className="h-8 min-w-[120px] rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                                >
                                                  <option value="spaceUsed">사용 공간</option>
                                                  <option value="spaceCap">최대 공간</option>
                                                  <option value="threat">위협도</option>
                                                  <option value="pollution">오염도</option>
                                                </select>
                                              ) : null}
                                              {action.kind === "addTileState" ||
                                              action.kind === "removeTileState" ? (
                                                <div className="min-w-[220px] space-y-1">
                                                  <div className="rounded-md border border-zinc-800 bg-zinc-950/50 px-2 py-1 text-[11px] text-zinc-300">
                                                    선택:{" "}
                                                    {activeTilePresets.find(
                                                      (p) => p.id === action.tagPresetId
                                                    )?.name ?? "없음"}
                                                  </div>
                                                  <div className="relative">
                                                    <input
                                                      value={
                                                        placementRuleSearch[
                                                          `action-tag-${field}-${ruleIndex}-${actionIndex}`
                                                        ] ?? ""
                                                      }
                                                      onChange={(e) =>
                                                        setPlacementRuleSearch((prev) => ({
                                                          ...prev,
                                                          [`action-tag-${field}-${ruleIndex}-${actionIndex}`]:
                                                            e.target.value,
                                                        }))
                                                      }
                                                      className="h-8 min-w-[140px] rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                                      placeholder="속성 검색"
                                                    />
                                                    {(
                                                      placementRuleSearch[
                                                        `action-tag-${field}-${ruleIndex}-${actionIndex}`
                                                      ] ?? ""
                                                    ).trim() ? (
                                                      <div className="absolute left-0 right-0 top-[calc(100%+2px)] z-30 max-h-28 overflow-auto rounded-md border border-zinc-800 bg-zinc-950 p-1 shadow-xl">
                                                        {activeTilePresets
                                                          .filter((preset) =>
                                                            preset.name.includes(
                                                              (
                                                                placementRuleSearch[
                                                                  `action-tag-${field}-${ruleIndex}-${actionIndex}`
                                                                ] ?? ""
                                                              ).trim()
                                                            )
                                                          )
                                                          .slice(0, 12)
                                                          .map((preset) => (
                                                            <button
                                                              key={`pick-action-tag-${field}-${rule.id}-${ruleIndex}-${actionIndex}-${preset.id}`}
                                                              type="button"
                                                              className="mb-1 block w-full rounded border border-zinc-800 bg-zinc-900/70 px-2 py-1 text-left text-[11px] text-zinc-200 hover:border-zinc-600"
                                                              onClick={() => {
                                                                setEffectActionAt(
                                                                  field,
                                                                  ruleIndex,
                                                                  actionIndex,
                                                                  {
                                                                    ...action,
                                                                    tagPresetId: preset.id,
                                                                  }
                                                                );
                                                                setPlacementRuleSearch((prev) => ({
                                                                  ...prev,
                                                                  [`action-tag-${field}-${ruleIndex}-${actionIndex}`]:
                                                                    "",
                                                                }));
                                                              }}
                                                            >
                                                              {preset.name}
                                                            </button>
                                                          ))}
                                                      </div>
                                                    ) : null}
                                                  </div>
                                                </div>
                                              ) : null}
                                              {action.kind === "addTileState" &&
                                              activeTilePresets.find((p) => p.id === action.tagPresetId)
                                                ?.hasValue ? (
                                                <input
                                                  value={action.value ?? ""}
                                                  onChange={(e) =>
                                                    setEffectActionAt(field, ruleIndex, actionIndex, {
                                                      ...action,
                                                      value: e.target.value,
                                                    })
                                                  }
                                                  className="h-8 min-w-[140px] rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                                  placeholder="속성 값"
                                                />
                                              ) : null}
                                              {supportsTileTarget ? (
                                                <select
                                                  value={actionTarget}
                                                  onChange={(e) => {
                                                    const target =
                                                      e.target.value === "range" ? "range" : "self";
                                                    setEffectActionAt(field, ruleIndex, actionIndex, {
                                                      ...action,
                                                      target,
                                                      distance:
                                                        target === "range"
                                                          ? Math.max(
                                                              0,
                                                              Math.trunc(
                                                                Number((action as any).distance ?? 1) || 0
                                                              )
                                                            )
                                                          : undefined,
                                                      excludeSelf:
                                                        target === "range"
                                                          ? !!(action as any).excludeSelf
                                                          : false,
                                                    });
                                                  }}
                                                  className="h-8 min-w-[120px] rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                                >
                                                  <option value="self">현재 타일</option>
                                                  <option value="range">거리 내 타일</option>
                                                </select>
                                              ) : null}
                                              {supportsTileTarget && actionTarget === "range" ? (
                                                <>
                                                  <span className="text-xs text-zinc-400">거리</span>
                                                  <input
                                                    value={String(
                                                      Math.max(
                                                        0,
                                                        Number((action as any).distance ?? 1) || 0
                                                      )
                                                    )}
                                                    onChange={(e) =>
                                                      setEffectActionAt(field, ruleIndex, actionIndex, {
                                                        ...action,
                                                        distance: Math.max(
                                                          0,
                                                          Math.trunc(
                                                            Number(e.target.value.replace(/[^\d]/g, "")) || 0
                                                          )
                                                        ),
                                                      })
                                                    }
                                                    className="h-8 w-20 rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                                    placeholder="0"
                                                  />
                                                  <label className="inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200">
                                                    <input
                                                      type="checkbox"
                                                      checked={!!(action as any).excludeSelf}
                                                      onChange={(e) =>
                                                        setEffectActionAt(field, ruleIndex, actionIndex, {
                                                          ...action,
                                                          excludeSelf: e.target.checked,
                                                        })
                                                      }
                                                    />
                                                    본인 타일 제외
                                                  </label>
                                                </>
                                              ) : null}
                                            </div>
                                            {action.kind === "convertPopulation" ||
                                            action.kind === "adjustResource" ||
                                            action.kind === "adjustResourceCap" ||
                                            action.kind === "adjustPopulation" ||
                                            action.kind === "adjustPopulationCap" ||
                                            action.kind === "adjustTileRegion" ? (
                                              <input
                                                key={`action-value-${field}-${rule.id}-${actionIndex}-${action.kind}-${
                                                  action.kind === "convertPopulation"
                                                    ? exprToEditableNumber(action.amount)
                                                    : exprToEditableNumber(action.delta)
                                                }`}
                                                defaultValue={
                                                  action.kind === "convertPopulation"
                                                    ? exprToEditableNumber(action.amount)
                                                    : exprToEditableNumber(action.delta)
                                                }
                                                onBlur={(e) => {
                                                  if (action.kind === "convertPopulation") {
                                                    const next =
                                                      toNonNegativeInt(
                                                        e.target.value.replace(/[^\d]/g, "")
                                                      ) ?? 0;
                                                    setEffectActionAt(field, ruleIndex, actionIndex, {
                                                      ...action,
                                                      amount: { kind: "const", value: next },
                                                    });
                                                    return;
                                                  }
                                                  const stripped = e.target.value.replace(/[^\d-]/g, "");
                                                  const normalized = stripped.startsWith("-")
                                                    ? `-${stripped.slice(1).replace(/-/g, "")}`
                                                    : stripped.replace(/-/g, "");
                                                  if (!normalized || normalized === "-") return;
                                                  const parsed = Math.trunc(Number(normalized));
                                                  if (!Number.isFinite(parsed)) return;
                                                  setEffectActionAt(field, ruleIndex, actionIndex, {
                                                    ...action,
                                                    delta: { kind: "const", value: parsed },
                                                  });
                                                }}
                                                className="h-8 rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"
                                                placeholder="0"
                                              />
                                            ) : (
                                              <div className="h-8" />
                                            )}
                                            <button
                                              type="button"
                                              className="h-8 rounded-md border border-red-800/70 bg-red-950/40 px-2 text-[11px] font-semibold text-red-200 hover:bg-red-900/40"
                                              onClick={() =>
                                                removeEffectAction(field, ruleIndex, actionIndex)
                                              }
                                              disabled={busy}
                                            >
                                              제거
                                            </button>
                                          </div>
                                            );
                                          })()
                                        ))}
                                      </div>
                                      <div className="mt-2 flex justify-end">
                                        <button
                                          type="button"
                                          className="rounded-md border border-zinc-700 px-2 py-1 text-[11px] font-semibold text-zinc-100 hover:border-zinc-500"
                                          onClick={() => addEffectAction(field, ruleIndex)}
                                          disabled={busy}
                                        >
                                          액션 추가
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        ))
                          : null}
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <button
                            type="button"
                            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:border-zinc-600"
                            onClick={resetBuildingDraft}
                            disabled={busy}
                          >
                            입력 초기화
                          </button>
                          <button
                            type="button"
                            className="rounded-lg border border-emerald-700/60 bg-emerald-950/30 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-900/40"
                            onClick={handleSaveBuildingPreset}
                            disabled={busy}
                          >
                            {buildingDraft.id
                              ? `${presetEntityLabel} 프리셋 수정`
                              : `${presetEntityLabel} 프리셋 추가`}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mb-4 rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-400">
                        현재 계정은 조회 전용입니다. 프리셋 등록/삭제는 관리자만 가능합니다.
                      </div>
                    )}
                    <div className="space-y-2">
                      {activePresetRows.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-zinc-800 px-3 py-4 text-sm text-zinc-500">
                          등록된 {presetEntityLabel} 프리셋이 없습니다.
                        </div>
                      ) : (
                        activePresetRows.map((preset) => {
                          const color = normalizeHexColor(preset.color, "#eab308");
                          return (
                            <div
                              key={preset.id}
                              className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-semibold" style={{ color }}>
                                    {preset.name}
                                  </div>
                                  <div className="mt-0.5 text-[11px] text-zinc-500">
                                    {preset.tier ? `${preset.tier} · ` : ""}
                                    {(preset.presetType ?? "building") === "troop" ? (
                                      <>
                                        훈련 시간 {preset.effort ?? 1}일 · 기본 위협도 감소{" "}
                                        {readAutoTroopThreatReduction(preset.effects?.daily)}
                                      </>
                                    ) : (preset.presetType ?? "building") === "carriage" ? (
                                      <>
                                        영입 비용 {Object.keys(preset.buildCost ?? {}).length}
                                        {" · "}영입 인구 {Object.keys(preset.upkeep?.population ?? {}).length}
                                        {" · "}획득 자원 {Object.keys(preset.upkeep?.resources ?? {}).length}
                                      </>
                                    ) : (
                                      <>
                                        노력치 {preset.effort ?? 0} · 공간 {preset.space ?? 0}
                                        {" · "}조건 {preset.placementRules?.length ?? 0}
                                        {" · "}일일 규칙 {preset.effects?.daily?.length ?? 0}
                                      </>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {isAdmin ? (
                                    <button
                                      type="button"
                                      className="rounded-md border border-zinc-700 px-2 py-1 text-[11px] font-semibold text-zinc-100 hover:border-zinc-500"
                                      onClick={() => handleSelectBuildingPreset(preset.id)}
                                      disabled={busy}
                                    >
                                      편집
                                    </button>
                                  ) : null}
                                  {isAdmin ? (
                                    <button
                                      type="button"
                                      className="rounded-md border border-red-800/70 bg-red-950/40 px-2 py-1 text-[11px] font-semibold text-red-200 hover:bg-red-900/40"
                                      onClick={() => handleDeleteBuildingPreset(preset.id)}
                                      disabled={busy}
                                    >
                                      삭제
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                              {preset.description ? (
                                <div className="mt-1 text-xs text-zinc-400">{preset.description}</div>
                              ) : null}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </>
                )}
              </div>
  );
}


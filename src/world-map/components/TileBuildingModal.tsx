import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from "react";
import type {
  PopulationTrackedId,
  WorldMapBuildingInstanceRow,
  WorldMapBuildingPresetRow,
} from "../../types";
import type { WorkerAssignmentDraft } from "../utils";
import {
  EMPTY_WORKER_ASSIGNMENT_DRAFT,
  POPULATION_EMOJIS,
  POPULATION_LABELS,
  TRACKED_POPULATION_IDS,
  createZeroWorkersByType,
  getInstanceBuildStatus,
  normalizeHexColor,
  readAssignedWorkersByTypeFromInstanceMeta,
  readUpkeepAnyNonElderlyByTypeFromInstanceMeta,
  sumAssignedWorkersByType,
} from "../utils";

type TileBuildingEditorState = {
  col: number;
  row: number;
  presetId: string;
};

type Props = {
  tileBuildingEditor: TileBuildingEditorState | null;
  setTileBuildingEditor: Dispatch<SetStateAction<TileBuildingEditorState | null>>;
  setTileBuildingSearchQuery: Dispatch<SetStateAction<string>>;
  tileBuildingSearchInputRef: RefObject<HTMLInputElement | null>;
  tileBuildingSearchTimerRef: MutableRefObject<number | null>;
  tileBuildingWorkersDraftByIdRef: MutableRefObject<Record<string, WorkerAssignmentDraft>>;
  tileBuildingSearchQuery: string;
  filteredBuildingPresetsForTile: WorldMapBuildingPresetRow[];
  activeBuildingPresets: WorldMapBuildingPresetRow[];
  tileBuildingInstances: WorldMapBuildingInstanceRow[];
  instanceOperationalById: Record<string, boolean>;
  instanceUpkeepWorkersByTypeById: Record<string, Record<PopulationTrackedId, number>>;
  instanceUpkeepAnyRequiredById: Record<string, number>;
  instanceUpkeepAnyAssignedByTypeById: Record<string, Record<PopulationTrackedId, number>>;
  busy: boolean;
  onPlaceBuilding: () => void;
  onUpdateBuildingWorkers: (
    instance: WorldMapBuildingInstanceRow,
    workersByTypeInput: Partial<Record<PopulationTrackedId, number>>
  ) => void;
  onToggleBuildingEnabled: (instance: WorldMapBuildingInstanceRow) => void;
  onDeleteBuildingOnTile: (instanceId: string) => void;
};

export default function TileBuildingModal({
  tileBuildingEditor,
  setTileBuildingEditor,
  setTileBuildingSearchQuery,
  tileBuildingSearchInputRef,
  tileBuildingSearchTimerRef,
  tileBuildingWorkersDraftByIdRef,
  tileBuildingSearchQuery,
  filteredBuildingPresetsForTile,
  activeBuildingPresets,
  tileBuildingInstances,
  instanceOperationalById,
  instanceUpkeepWorkersByTypeById,
  instanceUpkeepAnyRequiredById,
  instanceUpkeepAnyAssignedByTypeById,
  busy,
  onPlaceBuilding,
  onUpdateBuildingWorkers,
  onToggleBuildingEnabled,
  onDeleteBuildingOnTile,
}: Props) {
  if (!tileBuildingEditor) return null;

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-black/55 p-4">
      <div className="mx-auto mt-16 max-h-[calc(100vh-8rem)] w-full max-w-3xl overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-950 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-semibold text-zinc-100">
            건물 배치 · col {tileBuildingEditor.col}, row {tileBuildingEditor.row}
            </div>
          <button
            type="button"
            className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:border-zinc-500"
            onClick={() => {
              setTileBuildingEditor(null);
              setTileBuildingSearchQuery("");
              tileBuildingWorkersDraftByIdRef.current = {};
            }}
          >
            닫기
          </button>
        </div>

        <div className="mb-3 rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
          <div className="mb-2 text-xs font-semibold text-zinc-300">
            건물 프리셋 선택
          </div>
          <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
            <input
              ref={tileBuildingSearchInputRef}
              defaultValue={tileBuildingSearchQuery}
              onChange={(e) => {
                const next = e.target.value;
                if (tileBuildingSearchTimerRef.current != null) {
                  window.clearTimeout(tileBuildingSearchTimerRef.current);
                }
                tileBuildingSearchTimerRef.current = window.setTimeout(() => {
                  setTileBuildingSearchQuery(next);
                }, 140);
              }}
              placeholder="건물 이름 검색"
              className="h-9 rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-zinc-500"
            />
            <button
              type="button"
              className="rounded-md bg-amber-700 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
              onClick={onPlaceBuilding}
              disabled={busy || !tileBuildingEditor.presetId}
              >
                건물 배치
              </button>
            </div>
          <div className="mt-2 max-h-48 overflow-auto rounded-md border border-zinc-800 bg-zinc-950/40">
            {filteredBuildingPresetsForTile.length === 0 ? (
              <div className="px-3 py-2 text-xs text-zinc-500">검색 결과가 없습니다.</div>
            ) : (
              filteredBuildingPresetsForTile.map((preset) => {
                const active = tileBuildingEditor.presetId === preset.id;
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
                      setTileBuildingEditor((prev) =>
                        prev ? { ...prev, presetId: preset.id } : prev
                      )
                    }
                  >
                    <span
                      className="font-semibold"
                      style={{ color: normalizeHexColor(preset.color, "#e5e7eb") }}
                    >
                      {preset.name}
                    </span>
                    {preset.tier ? (
                      <span className="text-[11px] text-zinc-500">{preset.tier}</span>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
          <div className="mb-2 text-xs font-semibold text-zinc-300">배치된 개체</div>
          {tileBuildingInstances.length === 0 ? (
            <div className="text-xs text-zinc-500">
              배치된 건물이 없습니다.
            </div>
          ) : (
            <div className="space-y-2">
              {tileBuildingInstances.map((instance) => {
                const preset = activeBuildingPresets.find(
                  (entry) => entry.id === instance.presetId
                );
                const buildStatus = getInstanceBuildStatus(instance, preset);
                const isActive = buildStatus === "active";
                const isOperational = !!instanceOperationalById[instance.id];
                const isInactive = instance.enabled === false || (isActive && !isOperational);
                const isManuallyDisabled = instance.enabled === false;
                const upkeepPopulation = preset?.upkeep?.population ?? {};
                const requiredByType: Record<PopulationTrackedId, number> = {
                  settlers: Math.max(
                    0,
                    Math.trunc(Number((upkeepPopulation as any).settlers ?? 0) || 0)
                  ),
                  engineers: Math.max(
                    0,
                    Math.trunc(Number((upkeepPopulation as any).engineers ?? 0) || 0)
                  ),
                  scholars: Math.max(
                    0,
                    Math.trunc(Number((upkeepPopulation as any).scholars ?? 0) || 0)
                  ),
                  laborers: Math.max(
                    0,
                    Math.trunc(Number((upkeepPopulation as any).laborers ?? 0) || 0)
                  ),
                };
                const requiredElderly = Math.max(
                  0,
                  Math.trunc(Number((upkeepPopulation as any).elderly ?? 0) || 0)
                );
                const requiredAnyNonElderly =
                  instanceUpkeepAnyRequiredById[instance.id] ??
                  Math.max(
                    0,
                    Math.trunc(Number((upkeepPopulation as any).anyNonElderly ?? 0) || 0)
                  );
                const hasUpkeepPopulationNeed =
                  requiredByType.settlers > 0 ||
                  requiredByType.engineers > 0 ||
                  requiredByType.scholars > 0 ||
                  requiredByType.laborers > 0 ||
                  requiredElderly > 0 ||
                  requiredAnyNonElderly > 0;
                const appliedByType =
                  instanceUpkeepWorkersByTypeById[instance.id] ?? createZeroWorkersByType();
                const appliedAnyByType =
                  instanceUpkeepAnyAssignedByTypeById[instance.id] ?? createZeroWorkersByType();
                return (
                  <div
                    key={instance.id}
                    className="grid items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950/50 px-3 py-2 md:grid-cols-[minmax(0,1fr)_auto_auto]"
                  >
                    <div className="min-w-0">
                      <div
                        className="truncate text-sm font-semibold"
                        style={{ color: normalizeHexColor(preset?.color, "#e5e7eb") }}
                      >
                        {preset?.name ?? "이름 없는 프리셋"}
                        <span className="ml-1 text-[11px] font-medium text-zinc-500">[건물]</span>
                      </div>
                      {!isActive ? (
                        <div className="text-[11px] text-zinc-500">
                          {(() => {
                            const effort = Math.max(
                              0,
                              Math.trunc(Number(preset?.effort ?? 0))
                            );
                            if (effort <= 0) return "진행도: 즉시 완공";
                            return `진행도: ${instance.progressEffort}/${effort}`;
                          })()}
                        </div>
                      ) : null}
                      {!isActive || hasUpkeepPopulationNeed ? (
                        <div className="mt-1 text-[11px] text-zinc-500">
                          인원{" "}
                          {(() => {
                            if (!preset) return "-";
                            if (!isActive) {
                              const byType = readAssignedWorkersByTypeFromInstanceMeta(instance.meta);
                              return TRACKED_POPULATION_IDS.map(
                                (id) =>
                                  `${POPULATION_EMOJIS[id]}${POPULATION_LABELS[id]} ${byType[id]}`
                              ).join(" · ");
                            }
                            if (!isOperational) {
                              return `🏠정착민 ${requiredByType.settlers} · 🛠️기술자 ${requiredByType.engineers} · 📚학자 ${requiredByType.scholars} · 🛺역꾼 ${requiredByType.laborers} · 🧓노약자 ${requiredElderly}`;
                            }
                            return `🏠정착민 ${appliedByType.settlers} · 🛠️기술자 ${appliedByType.engineers} · 📚학자 ${appliedByType.scholars} · 🛺역꾼 ${appliedByType.laborers} · 🧓노약자 ${requiredElderly}`;
                          })()}
                        </div>
                      ) : null}
                    </div>
                    <span
                      className={[
                        "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                        isInactive
                          ? "bg-zinc-800 text-zinc-400"
                          : isActive
                            ? "bg-emerald-900/40 text-emerald-300"
                            : "bg-amber-900/40 text-amber-300",
                      ].join(" ")}
                    >
                      {isInactive
                        ? "비활성"
                        : isActive
                          ? "완공"
                          : "건설중"}
                    </span>
                    <div className="flex items-center gap-1">
                      {!isActive || requiredAnyNonElderly > 0 ? (
                        <>
                          <div className="grid grid-cols-4 gap-1">
                            {TRACKED_POPULATION_IDS.map((id) => {
                              const fallback = !isActive
                                ? readAssignedWorkersByTypeFromInstanceMeta(instance.meta)
                                : (() => {
                                    const saved = readUpkeepAnyNonElderlyByTypeFromInstanceMeta(
                                      instance.meta
                                    );
                                    if (sumAssignedWorkersByType(saved) > 0) return saved;
                                    return appliedAnyByType;
                                  })();
                              const currentDraft =
                                tileBuildingWorkersDraftByIdRef.current[instance.id] ??
                                ({
                                  settlers: String(fallback.settlers),
                                  engineers: String(fallback.engineers),
                                  scholars: String(fallback.scholars),
                                  laborers: String(fallback.laborers),
                                } satisfies WorkerAssignmentDraft);
                              tileBuildingWorkersDraftByIdRef.current[instance.id] = currentDraft;
                              return (
                                <input
                                  key={`${instance.id}-${id}`}
                                  defaultValue={currentDraft[id]}
                                  onChange={(e) => {
                                    const digits = e.target.value.replace(/[^\d]/g, "");
                                    const prevDraft =
                                      tileBuildingWorkersDraftByIdRef.current[instance.id] ?? {
                                        ...EMPTY_WORKER_ASSIGNMENT_DRAFT,
                                      };
                                    tileBuildingWorkersDraftByIdRef.current = {
                                      ...tileBuildingWorkersDraftByIdRef.current,
                                      [instance.id]: {
                                        ...prevDraft,
                                        [id]: digits,
                                      },
                                    };
                                  }}
                                  title={`${POPULATION_LABELS[id]}`}
                                  placeholder="0"
                                  className="h-7 w-14 rounded-md border border-zinc-700 bg-zinc-950 px-1.5 text-center text-xs text-amber-200 outline-none focus:border-amber-500"
                                />
                              );
                            })}
                          </div>
                          <button
                            type="button"
                            className="rounded-md border border-amber-700/70 bg-amber-950/30 px-2 py-1 text-[11px] text-amber-200 hover:bg-amber-900/50 disabled:opacity-50"
                            onClick={() =>
                              onUpdateBuildingWorkers(
                                instance,
                                TRACKED_POPULATION_IDS.reduce(
                                  (acc, id) => ({
                                    ...acc,
                                    [id]: Number(
                                      tileBuildingWorkersDraftByIdRef.current[instance.id]?.[id] ??
                                        String(
                                          !isActive
                                            ? readAssignedWorkersByTypeFromInstanceMeta(instance.meta)[id]
                                            : sumAssignedWorkersByType(
                                                  readUpkeepAnyNonElderlyByTypeFromInstanceMeta(
                                                    instance.meta
                                                  )
                                                ) > 0
                                              ? readUpkeepAnyNonElderlyByTypeFromInstanceMeta(
                                                  instance.meta
                                                )[id]
                                              : appliedAnyByType[id]
                                        )
                                    ),
                                  }),
                                  {} as Partial<Record<PopulationTrackedId, number>>
                                )
                              )
                            }
                            disabled={busy}
                          >
                            {isActive ? "인원 배치" : "인원 저장"}
                          </button>
                        </>
                      ) : null}
                      <button
                        type="button"
                        className={[
                          "rounded-md px-2 py-1 text-[11px] disabled:opacity-50",
                          isManuallyDisabled
                            ? "border border-emerald-700/70 bg-emerald-950/30 text-emerald-200 hover:bg-emerald-900/50"
                            : "border border-zinc-700 bg-zinc-900/50 text-zinc-200 hover:bg-zinc-800",
                        ].join(" ")}
                        onClick={() => onToggleBuildingEnabled(instance)}
                        disabled={busy}
                      >
                        {isManuallyDisabled ? "활성화" : "비활성화"}
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-red-800/70 bg-red-950/40 px-2 py-1 text-[11px] text-red-200 hover:bg-red-900/50 disabled:opacity-50"
                        onClick={() => onDeleteBuildingOnTile(instance.id)}
                        disabled={busy}
                      >
                        제거
                      </button>
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

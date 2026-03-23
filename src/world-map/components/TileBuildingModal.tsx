import type {
  Dispatch,
  MutableRefObject,
  RefObject,
  SetStateAction,
} from "react";
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
  getInstanceBuildStatus,
  normalizeHexColor,
  readAssignedWorkersByTypeFromInstanceMeta,
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
  tileBuildingCreateWorkersDraftRef: MutableRefObject<WorkerAssignmentDraft>;
  tileBuildingWorkersDraftByIdRef: MutableRefObject<Record<string, WorkerAssignmentDraft>>;
  tileBuildingSearchQuery: string;
  filteredBuildingPresetsForTile: WorldMapBuildingPresetRow[];
  activeBuildingPresets: WorldMapBuildingPresetRow[];
  tileBuildingInstances: WorldMapBuildingInstanceRow[];
  selectedTileBuildingPresetNeedsWorkers: boolean;
  busy: boolean;
  onPlaceBuilding: () => void;
  onUpdateBuildingWorkers: (
    instance: WorldMapBuildingInstanceRow,
    workersByTypeInput: Partial<Record<PopulationTrackedId, number>>
  ) => void;
  onDeleteBuildingOnTile: (instanceId: string) => void;
};

export default function TileBuildingModal({
  tileBuildingEditor,
  setTileBuildingEditor,
  setTileBuildingSearchQuery,
  tileBuildingSearchInputRef,
  tileBuildingSearchTimerRef,
  tileBuildingCreateWorkersDraftRef,
  tileBuildingWorkersDraftByIdRef,
  tileBuildingSearchQuery,
  filteredBuildingPresetsForTile,
  activeBuildingPresets,
  tileBuildingInstances,
  selectedTileBuildingPresetNeedsWorkers,
  busy,
  onPlaceBuilding,
  onUpdateBuildingWorkers,
  onDeleteBuildingOnTile,
}: Props) {
  if (!tileBuildingEditor) return null;

  return (
    <div className="fixed inset-0 z-[80] bg-black/55 p-4">
      <div className="mx-auto mt-16 w-full max-w-3xl rounded-2xl border border-zinc-700 bg-zinc-950 p-4">
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
          <div className="mb-2 text-xs font-semibold text-zinc-300">건물 프리셋 선택</div>
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
          {selectedTileBuildingPresetNeedsWorkers ? (
            <div className="mt-2 grid gap-2 md:grid-cols-4">
              {TRACKED_POPULATION_IDS.map((id) => (
                <div key={`new-assigned-${id}`} className="space-y-1">
                  <div className="text-[11px] text-zinc-400">
                    {POPULATION_EMOJIS[id]} {POPULATION_LABELS[id]}
                  </div>
                  <input
                    defaultValue={tileBuildingCreateWorkersDraftRef.current[id]}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/[^\d]/g, "");
                      tileBuildingCreateWorkersDraftRef.current = {
                        ...tileBuildingCreateWorkersDraftRef.current,
                        [id]: digits,
                      };
                    }}
                    placeholder="0"
                    className="h-8 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-amber-200 outline-none focus:border-amber-500"
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-2 text-[11px] text-zinc-500">
              즉시 완공 건물은 인원 배치가 필요하지 않습니다.
            </div>
          )}
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
          <div className="mb-2 text-xs font-semibold text-zinc-300">배치된 건물</div>
          {tileBuildingInstances.length === 0 ? (
            <div className="text-xs text-zinc-500">배치된 건물이 없습니다.</div>
          ) : (
            <div className="space-y-2">
              {tileBuildingInstances.map((instance) => {
                const preset = activeBuildingPresets.find(
                  (entry) => entry.id === instance.presetId
                );
                const buildStatus = getInstanceBuildStatus(instance, preset);
                const isActive = buildStatus === "active";
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
                        {preset?.name ?? "이름 없는 건물"}
                      </div>
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
                      <div className="mt-1 text-[11px] text-zinc-500">
                        투입{" "}
                        {(() => {
                          const byType = readAssignedWorkersByTypeFromInstanceMeta(instance.meta);
                          return TRACKED_POPULATION_IDS.map(
                            (id) =>
                              `${POPULATION_EMOJIS[id]}${POPULATION_LABELS[id]} ${byType[id]}`
                          ).join(" · ");
                        })()}
                      </div>
                    </div>
                    <span
                      className={[
                        "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                        instance.enabled === false
                          ? "bg-zinc-800 text-zinc-400"
                          : isActive
                            ? "bg-emerald-900/40 text-emerald-300"
                            : "bg-amber-900/40 text-amber-300",
                      ].join(" ")}
                    >
                      {instance.enabled === false
                        ? "비활성"
                        : isActive
                          ? "완공"
                          : "건설중"}
                    </span>
                    <div className="flex items-center gap-1">
                      {!isActive ? (
                        <>
                          <div className="grid grid-cols-4 gap-1">
                            {TRACKED_POPULATION_IDS.map((id) => {
                              const fallback = readAssignedWorkersByTypeFromInstanceMeta(
                                instance.meta
                              );
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
                                          readAssignedWorkersByTypeFromInstanceMeta(instance.meta)[id]
                                        )
                                    ),
                                  }),
                                  {} as Partial<Record<PopulationTrackedId, number>>
                                )
                              )
                            }
                            disabled={busy}
                          >
                            인원 저장
                          </button>
                        </>
                      ) : (
                        <div className="text-[11px] text-zinc-500">
                          완공 상태(투입 인원 없음)
                        </div>
                      )}
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


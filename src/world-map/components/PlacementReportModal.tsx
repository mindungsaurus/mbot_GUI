import { useMemo, useState } from "react";
import type { PopulationId, PopulationTrackedId } from "../../types";
import {
  POPULATION_EMOJIS,
  POPULATION_LABELS,
  formatWithCommas,
} from "../utils";

type PlacementReportRow = {
  instanceId: string;
  tileNumber: number;
  col: number;
  row: number;
  buildingName: string;
  color: string;
  statusLabel: string;
  reason: string;
  required: {
    settlers: number;
    engineers: number;
    scholars: number;
    laborers: number;
    elderly: number;
    anyNonElderly: number;
  };
  assigned: {
    settlers: number;
    engineers: number;
    scholars: number;
    laborers: number;
    elderly: number;
  };
  assignedAnyByType: Record<PopulationTrackedId, number>;
  construction: {
    progressEffort: number;
    requiredEffort: number;
  };
};

type PopulationSummaryRow = {
  id: PopulationId;
  total: number;
  available: number;
  allocated: number;
};

type TroopCommittedRow = {
  presetId: string;
  presetName: string;
  units: number;
  population: {
    settlers: number;
    engineers: number;
    scholars: number;
    laborers: number;
    elderly: number;
    anyNonElderly: number;
  };
};

type Props = {
  open: boolean;
  rows: PlacementReportRow[];
  populationSummary: PopulationSummaryRow[];
  troopCommittedByPreset: TroopCommittedRow[];
  onClose: () => void;
};

function renderByType(values: {
  settlers: number;
  engineers: number;
  scholars: number;
  laborers: number;
  elderly?: number;
}) {
  const chunks: string[] = [];
  if ((values.settlers ?? 0) > 0) chunks.push(`🏠정착민 ${formatWithCommas(values.settlers ?? 0)}`);
  if ((values.engineers ?? 0) > 0) chunks.push(`🛠️기술자 ${formatWithCommas(values.engineers ?? 0)}`);
  if ((values.scholars ?? 0) > 0) chunks.push(`📚학자 ${formatWithCommas(values.scholars ?? 0)}`);
  if ((values.laborers ?? 0) > 0) chunks.push(`🛺역꾼 ${formatWithCommas(values.laborers ?? 0)}`);
  if (values.elderly != null && (values.elderly ?? 0) > 0) {
    chunks.push(`🧓노약자 ${formatWithCommas(values.elderly ?? 0)}`);
  }
  return chunks.length > 0 ? chunks.join(" · ") : "없음";
}

export default function PlacementReportModal({
  open,
  rows,
  populationSummary,
  troopCommittedByPreset,
  onClose,
}: Props) {
  const [expandedByTile, setExpandedByTile] = useState<Record<string, boolean>>({});

  const getRowOccupiedByType = (row: PlacementReportRow) => ({
    settlers: Math.max(0, Math.trunc(Number(row.assigned.settlers ?? 0) || 0)),
    engineers: Math.max(0, Math.trunc(Number(row.assigned.engineers ?? 0) || 0)),
    scholars: Math.max(0, Math.trunc(Number(row.assigned.scholars ?? 0) || 0)),
    laborers: Math.max(0, Math.trunc(Number(row.assigned.laborers ?? 0) || 0)),
    elderly: Math.max(0, Math.trunc(Number(row.assigned.elderly ?? 0) || 0)),
  });
  const getRowOccupiedTotal = (row: PlacementReportRow) => {
    const occupied = getRowOccupiedByType(row);
    return (
      occupied.settlers +
      occupied.engineers +
      occupied.scholars +
      occupied.laborers +
      occupied.elderly
    );
  };

  const groupedByTile = useMemo(() => {
    const grouped = new Map<
      string,
      {
        tileNumber: number;
        col: number;
        row: number;
        rows: PlacementReportRow[];
        occupied: {
          settlers: number;
          engineers: number;
          scholars: number;
          laborers: number;
          elderly: number;
        };
      }
    >();
    for (const row of rows) {
      if (getRowOccupiedTotal(row) <= 0) continue;
      const occupiedByType = getRowOccupiedByType(row);
      const key = `${row.tileNumber}:${row.col}:${row.row}`;
      const existing = grouped.get(key);
      if (!existing) {
        grouped.set(key, {
          tileNumber: row.tileNumber,
          col: row.col,
          row: row.row,
          rows: [row],
          occupied: {
            settlers: occupiedByType.settlers,
            engineers: occupiedByType.engineers,
            scholars: occupiedByType.scholars,
            laborers: occupiedByType.laborers,
            elderly: occupiedByType.elderly,
          },
        });
      } else {
        existing.rows.push(row);
        existing.occupied.settlers += occupiedByType.settlers;
        existing.occupied.engineers += occupiedByType.engineers;
        existing.occupied.scholars += occupiedByType.scholars;
        existing.occupied.laborers += occupiedByType.laborers;
        existing.occupied.elderly += occupiedByType.elderly;
      }
    }
    return [...grouped.entries()]
      .map(([key, value]) => ({ key, ...value }))
      .sort((a, b) => a.tileNumber - b.tileNumber);
  }, [rows]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[105] bg-black/60 p-4" onClick={onClose}>
      <div
        className="mx-auto mt-12 flex max-h-[calc(100vh-6rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-950"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <div className="text-sm font-semibold text-zinc-100">
            인구 배치 현황
          </div>
          <button
            type="button"
            className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:border-zinc-500"
            onClick={onClose}
          >
            닫기
          </button>
        </div>

        <div className="space-y-3 overflow-y-auto p-4">
          <section className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
            <div className="mb-2 text-xs font-semibold text-zinc-300">
              인구 배치 요약
            </div>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {populationSummary.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-md border border-zinc-800 bg-zinc-950/50 px-2 py-1.5 text-xs text-zinc-200"
                >
                  <div className="font-semibold text-zinc-100">
                    {POPULATION_EMOJIS[entry.id]} {POPULATION_LABELS[entry.id]}
                  </div>
                  <div className="mt-0.5 text-zinc-400">
                    총 {formatWithCommas(entry.total)} · 배치{" "}
                    {formatWithCommas(entry.allocated)} · 가용{" "}
                    {formatWithCommas(entry.available)}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
            <div className="mb-2 text-xs font-semibold text-zinc-300">
              병력 편성 점유 인구
            </div>
            {troopCommittedByPreset.length === 0 ? (
              <div className="text-xs text-zinc-500">병력 편성으로 점유된 인구가 없습니다.</div>
            ) : (
              <div className="space-y-1.5">
                {troopCommittedByPreset.map((row) => (
                  <div
                    key={row.presetId}
                    className="rounded-md border border-zinc-800 bg-zinc-950/50 px-2 py-1.5 text-xs"
                  >
                    <div className="font-semibold text-amber-300">
                      {row.presetName} · {formatWithCommas(row.units)}기
                    </div>
                    <div className="mt-0.5 text-zinc-300">
                      {renderByType(row.population)}
                      {row.population.anyNonElderly > 0
                        ? ` · 노약자 제외 아무나 ${formatWithCommas(row.population.anyNonElderly)}`
                        : ""}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
            <div className="mb-2 text-xs font-semibold text-zinc-300">
              건물별 배치 현황
            </div>
            {groupedByTile.length === 0 ? (
              <div className="text-xs text-zinc-500">배치된 건물이 없습니다.</div>
            ) : (
              <div className="space-y-2">
                {groupedByTile.map((group) => {
                  const isExpanded = !!expandedByTile[group.key];
                  return (
                    <div key={group.key} className="rounded-md border border-zinc-800 bg-zinc-950/60">
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-zinc-900/40"
                        onClick={() =>
                          setExpandedByTile((prev) => ({ ...prev, [group.key]: !isExpanded }))
                        }
                      >
                        <div className="min-w-0">
                          <div className="text-base font-extrabold tracking-wide text-amber-300">
                            타일 #{formatWithCommas(group.tileNumber)}
                          </div>
                          <div className="mt-1 text-[11px] text-sky-300">
                            점유 · {renderByType(group.occupied)}
                          </div>
                        </div>
                        <span className="text-xs text-zinc-400">{isExpanded ? "접기 ▲" : "펼치기 ▼"}</span>
                      </button>

                      {isExpanded ? (
                        <div className="space-y-2 border-t border-zinc-800 px-3 py-2">
                          <div className="text-[11px] text-zinc-500">
                            위치: col {group.col}, row {group.row}
                          </div>
                          {group.rows.map((row) => {
                            return (
                              <div
                                key={row.instanceId}
                                className="rounded-md border border-zinc-800 bg-zinc-900/45 p-2.5"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div
                                    className="truncate text-sm font-semibold"
                                    style={{ color: row.color }}
                                  >
                                    {row.buildingName}
                                  </div>
                                  <span
                                    className={[
                                      "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                                      row.statusLabel === "운영중"
                                        ? "bg-emerald-900/40 text-emerald-300"
                                        : row.statusLabel === "건설중"
                                          ? "bg-amber-900/40 text-amber-300"
                                          : "bg-zinc-800 text-zinc-300",
                                    ].join(" ")}
                                  >
                                    {row.statusLabel}
                                  </span>
                                </div>

                                <div className="mt-1 text-[11px] text-zinc-400">사유: {row.reason}</div>
                                {row.statusLabel === "건설중" ? (
                                  <>
                                    <div className="mt-1 text-[11px] text-zinc-400">
                                      진행도: {formatWithCommas(row.construction.progressEffort)}/
                                      {formatWithCommas(row.construction.requiredEffort)}
                                    </div>
                                    <div className="mt-1 text-[11px] text-sky-300">
                                      건설 투입: {renderByType(getRowOccupiedByType(row))}
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    {renderByType(row.required) !== "없음" ||
                                    row.required.anyNonElderly > 0 ? (
                                      <div className="mt-1 text-[11px] text-zinc-400">
                                        요구: {renderByType(row.required)}{" "}
                                        {row.required.anyNonElderly > 0
                                          ? `· 노약자 제외 아무나 ${formatWithCommas(row.required.anyNonElderly)}`
                                          : ""}
                                      </div>
                                    ) : null}
                                    <div className="mt-1 text-[11px] text-sky-300">
                                      배치: {renderByType(getRowOccupiedByType(row))}
                                    </div>
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

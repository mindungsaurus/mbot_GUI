import { useMemo, useState } from "react";
import { formatWithCommas } from "../utils";

type ResourceStatusBuildingRow = {
  instanceId: string;
  buildingName: string;
  color: string;
  value: number;
};

type ResourceStatusTileRow = {
  tileKey: string;
  tileNumber: number;
  col: number;
  row: number;
  value: number;
  buildings: ResourceStatusBuildingRow[];
};

type ResourceStatusGroupRow = {
  resourceId: string;
  label: string;
  total: number;
  tiles: ResourceStatusTileRow[];
};

type Props = {
  open: boolean;
  rows: ResourceStatusGroupRow[];
  onClose: () => void;
};

function formatDelta(value: number) {
  const normalized = Math.round((Number(value) || 0) * 100) / 100;
  if (normalized > 0) return `+${formatWithCommas(normalized)}`;
  return formatWithCommas(normalized);
}

function DeltaChip({ label, value }: { label: string; value: number }) {
  return (
    <span
      className={[
        "rounded-md border px-2 py-1 text-xs",
        value > 0
          ? "border-emerald-800/60 bg-emerald-950/40 text-emerald-300"
          : value < 0
            ? "border-rose-800/60 bg-rose-950/30 text-rose-300"
            : "border-zinc-700 bg-zinc-900 text-zinc-300",
      ].join(" ")}
    >
      {label} {formatDelta(value)}
    </span>
  );
}

export default function ResourceStatusModal({ open, rows, onClose }: Props) {
  const [expandedByResource, setExpandedByResource] = useState<Record<string, boolean>>({});
  const [expandedByTile, setExpandedByTile] = useState<Record<string, boolean>>({});
  const normalizedRows = useMemo(() => rows ?? [], [rows]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[180] flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <div
        className="flex max-h-[calc(100vh-6rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-950"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <div>
            <h3 className="text-lg font-bold text-zinc-100">자원 현황 확인</h3>
            <p className="text-xs text-zinc-400">질서/만족도 제외 · 일일 실행 기준</p>
          </div>
          <button
            type="button"
            className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
            onClick={onClose}
          >
            닫기
          </button>
        </div>

        <div className="space-y-3 overflow-y-auto p-4">
          {normalizedRows.length === 0 ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 text-sm text-zinc-400">
              표시할 자원 산출/소모 내역이 없습니다.
            </div>
          ) : (
            normalizedRows.map((resource) => {
              const resourceOpen = expandedByResource[resource.resourceId] ?? true;
              return (
                <div key={resource.resourceId} className="rounded-lg border border-zinc-800 bg-zinc-900/50">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
                    onClick={() =>
                      setExpandedByResource((prev) => ({
                        ...prev,
                        [resource.resourceId]: !(prev[resource.resourceId] ?? true),
                      }))
                    }
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-zinc-100">{resource.label}</div>
                      <div className="mt-2">
                        <DeltaChip label="합계" value={resource.total} />
                      </div>
                    </div>
                    <span className="shrink-0 text-xs text-zinc-400">
                      {resourceOpen ? "접기" : "펼치기"} · {resource.tiles.length}개 타일
                    </span>
                  </button>

                  {resourceOpen ? (
                    <div className="space-y-2 border-t border-zinc-800 px-3 pb-3 pt-2">
                      {resource.tiles.map((tile) => {
                        const tileToggleKey = `${resource.resourceId}:${tile.tileKey}`;
                        const tileOpen = !!expandedByTile[tileToggleKey];
                        return (
                          <div key={tileToggleKey} className="rounded-md border border-zinc-800 bg-zinc-950/50">
                            <button
                              type="button"
                              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
                              onClick={() =>
                                setExpandedByTile((prev) => ({
                                  ...prev,
                                  [tileToggleKey]: !prev[tileToggleKey],
                                }))
                              }
                            >
                              <div className="text-sm font-semibold text-zinc-200">
                                타일 #{tile.tileNumber} · col {tile.col}, row {tile.row}
                              </div>
                              <div className="flex items-center gap-3">
                                <DeltaChip label={resource.label} value={tile.value} />
                                <span className="text-xs text-zinc-400">{tileOpen ? "접기" : "펼치기"}</span>
                              </div>
                            </button>

                            {tileOpen ? (
                              <div className="space-y-1 border-t border-zinc-800 px-3 pb-2 pt-2">
                                {tile.buildings.length === 0 ? (
                                  <div className="text-xs text-zinc-500">건물 상세 내역 없음</div>
                                ) : (
                                  tile.buildings.map((building) => (
                                    <div key={building.instanceId} className="flex items-center justify-between gap-3">
                                      <span className="text-sm font-semibold" style={{ color: building.color }}>
                                        {building.buildingName}
                                      </span>
                                      <DeltaChip label={resource.label} value={building.value} />
                                    </div>
                                  ))
                                )}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}


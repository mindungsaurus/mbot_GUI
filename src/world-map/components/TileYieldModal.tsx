type TileYieldViewerState = {
  col: number;
  row: number;
} | null;

type TileYieldDelta = {
  resourceId: string;
  label: string;
  value: number;
};

type TileYieldBuildingRow = {
  instanceId: string;
  buildingName: string;
  color: string;
  deltas: TileYieldDelta[];
};

type Props = {
  tileYieldViewer: TileYieldViewerState;
  setTileYieldViewer: (next: TileYieldViewerState) => void;
  tileYieldRows: TileYieldBuildingRow[];
  tileYieldTotals: TileYieldDelta[];
};

function formatDelta(value: number) {
  const normalized = Math.round((Number(value) || 0) * 100) / 100;
  if (normalized > 0) return `+${normalized.toLocaleString("ko-KR")}`;
  return normalized.toLocaleString("ko-KR");
}

export default function TileYieldModal({
  tileYieldViewer,
  setTileYieldViewer,
  tileYieldRows,
  tileYieldTotals,
}: Props) {
  if (!tileYieldViewer) return null;

  return (
    <div
      className="fixed inset-0 z-[170] flex items-center justify-center bg-black/60 px-4"
      onClick={() => setTileYieldViewer(null)}
    >
      <div
        className="w-full max-w-3xl rounded-xl border border-zinc-800 bg-zinc-950/95 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-bold text-zinc-100">
            타일 산출량 확인 · col {tileYieldViewer.col}, row {tileYieldViewer.row}
          </h3>
          <button
            type="button"
            className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
            onClick={() => setTileYieldViewer(null)}
          >
            닫기
          </button>
        </div>

        <div className="mb-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
          <div className="mb-2 text-xs font-semibold text-zinc-400">타일 합계 (일일 실행 기준)</div>
          {tileYieldTotals.length === 0 ? (
            <div className="text-xs text-zinc-500">산출/소모가 없습니다.</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {tileYieldTotals.map((entry) => (
                <span
                  key={entry.resourceId}
                  className={[
                    "rounded-md border px-2 py-1 text-xs",
                    entry.value > 0
                      ? "border-emerald-800/60 bg-emerald-950/40 text-emerald-300"
                      : entry.value < 0
                        ? "border-rose-800/60 bg-rose-950/30 text-rose-300"
                        : "border-zinc-700 bg-zinc-900 text-zinc-300",
                  ].join(" ")}
                >
                  {entry.label} {formatDelta(entry.value)}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
          {tileYieldRows.length === 0 ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 text-xs text-zinc-500">
              운영 중인 완공 건물이 없어 산출량을 계산할 수 없습니다.
            </div>
          ) : (
            tileYieldRows.map((row) => (
              <div key={row.instanceId} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
                <div className="mb-2 text-base font-bold" style={{ color: row.color }}>
                  {row.buildingName}
                </div>
                {row.deltas.length === 0 ? (
                  <div className="text-xs text-zinc-500">변동 없음</div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {row.deltas.map((entry) => (
                      <span
                        key={`${row.instanceId}:${entry.resourceId}`}
                        className={[
                          "rounded-md border px-2 py-1 text-xs",
                          entry.value > 0
                            ? "border-emerald-800/60 bg-emerald-950/40 text-emerald-300"
                            : entry.value < 0
                              ? "border-rose-800/60 bg-rose-950/30 text-rose-300"
                              : "border-zinc-700 bg-zinc-900 text-zinc-300",
                        ].join(" ")}
                      >
                        {entry.label} {formatDelta(entry.value)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}


import type { ViewMode } from "../utils";

type Props = {
  mapName: string;
  day: number;
  showTileStatePills: boolean;
  showRegionStatusPills: boolean;
  showTileNumbering: boolean;
  viewMode: ViewMode;
  zoom: number;
  onShowTileStatePillsChange: (next: boolean) => void;
  onShowRegionStatusPillsChange: (next: boolean) => void;
  onShowTileNumberingChange: (next: boolean) => void;
  onActivateScrollMode: () => void;
  onActivateDragMode: () => void;
  onZoomOut: () => void;
  onZoomIn: () => void;
};

export default function MapViewportHeader({
  mapName,
  day,
  showTileStatePills,
  showRegionStatusPills,
  showTileNumbering,
  viewMode,
  zoom,
  onShowTileStatePillsChange,
  onShowRegionStatusPillsChange,
  onShowTileNumberingChange,
  onActivateScrollMode,
  onActivateDragMode,
  onZoomOut,
  onZoomIn,
}: Props) {
  return (
    <div className="mb-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
      <div className="justify-self-start text-sm font-bold text-lime-300">
        {mapName}{" "}
        <span className="text-xs font-semibold text-zinc-200">
          [Day {String(day ?? 0).padStart(3, "0")}]
        </span>
      </div>
      <div className="justify-self-center flex items-center gap-2">
        <label className="inline-flex items-center gap-1 rounded-md border border-zinc-800 px-2 py-1 text-xs text-zinc-200 hover:border-zinc-600">
          <input
            type="checkbox"
            checked={showTileStatePills}
            onChange={(e) => onShowTileStatePillsChange(e.target.checked)}
          />
          <span>타일 속성 표시</span>
        </label>
        <label className="inline-flex items-center gap-1 rounded-md border border-zinc-800 px-2 py-1 text-xs text-zinc-200 hover:border-zinc-600">
          <input
            type="checkbox"
            checked={showRegionStatusPills}
            onChange={(e) => onShowRegionStatusPillsChange(e.target.checked)}
          />
          <span>지역 상태 표시</span>
        </label>
        <label className="inline-flex items-center gap-1 rounded-md border border-zinc-800 px-2 py-1 text-xs text-zinc-200 hover:border-zinc-600">
          <input
            type="checkbox"
            checked={showTileNumbering}
            onChange={(e) => onShowTileNumberingChange(e.target.checked)}
          />
          <span>타일 번호 표시</span>
        </label>
      </div>
      <div className="justify-self-end flex items-center gap-2 text-xs text-zinc-300">
        <button
          type="button"
          className={[
            "rounded-md border px-2 py-1",
            viewMode === "scroll"
              ? "border-emerald-700/70 bg-emerald-950/30 text-emerald-200"
              : "border-zinc-800 text-zinc-300 hover:border-zinc-600",
          ].join(" ")}
          onClick={onActivateScrollMode}
        >
          스크롤 모드
        </button>
        <button
          type="button"
          className={[
            "rounded-md border px-2 py-1",
            viewMode === "drag"
              ? "border-sky-700/70 bg-sky-950/30 text-sky-200"
              : "border-zinc-800 text-zinc-300 hover:border-zinc-600",
          ].join(" ")}
          onClick={onActivateDragMode}
        >
          드래그 모드
        </button>
        <button
          type="button"
          className="rounded-md border border-zinc-800 px-2 py-1 hover:border-zinc-600"
          onClick={onZoomOut}
        >
          -
        </button>
        <span>{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          className="rounded-md border border-zinc-800 px-2 py-1 hover:border-zinc-600"
          onClick={onZoomIn}
        >
          +
        </button>
      </div>
    </div>
  );
}

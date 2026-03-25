import type { MutableRefObject } from "react";

type TileContextMenuState = {
  x: number;
  y: number;
  col: number;
  row: number;
};

type Props = {
  tileContextMenu: TileContextMenuState | null;
  tileContextMenuRef: MutableRefObject<HTMLDivElement | null>;
  onOpenTileEditor: (col: number, row: number) => void;
  onOpenTileRegionEditor: (col: number, row: number) => void;
  onOpenTileBuildingEditor: (col: number, row: number) => void;
  onOpenTileYieldViewer: (col: number, row: number) => void;
};

export default function TileContextMenu({
  tileContextMenu,
  tileContextMenuRef,
  onOpenTileEditor,
  onOpenTileRegionEditor,
  onOpenTileBuildingEditor,
  onOpenTileYieldViewer,
}: Props) {
  if (!tileContextMenu) return null;

  return (
    <div
      ref={tileContextMenuRef}
      className="fixed z-[70] min-w-[180px] rounded-lg border border-zinc-700 bg-zinc-900/95 p-1 text-xs shadow-2xl"
      style={{ left: tileContextMenu.x + 8, top: tileContextMenu.y + 8 }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="w-full rounded-md px-2 py-1.5 text-left text-zinc-100 hover:bg-zinc-800"
        onClick={() => onOpenTileEditor(tileContextMenu.col, tileContextMenu.row)}
      >
        타일 속성
      </button>
      <button
        type="button"
        className="mt-1 w-full rounded-md px-2 py-1.5 text-left text-zinc-100 hover:bg-zinc-800"
        onClick={() => onOpenTileRegionEditor(tileContextMenu.col, tileContextMenu.row)}
      >
        지역 상태
      </button>
      <button
        type="button"
        className="mt-1 w-full rounded-md px-2 py-1.5 text-left text-zinc-100 hover:bg-zinc-800"
        onClick={() => onOpenTileBuildingEditor(tileContextMenu.col, tileContextMenu.row)}
      >
        건물 배치
      </button>
      <button
        type="button"
        className="mt-1 w-full rounded-md px-2 py-1.5 text-left text-zinc-100 hover:bg-zinc-800"
        onClick={() => onOpenTileYieldViewer(tileContextMenu.col, tileContextMenu.row)}
      >
        타일 산출량 확인
      </button>
    </div>
  );
}

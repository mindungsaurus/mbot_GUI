import type { Dispatch, MutableRefObject, SetStateAction } from "react";

type TileRegionDraft = {
  spaceUsed: string;
  spaceCap: string;
  threat: string;
  pollution: string;
};

type TileRegionEditorState = {
  key: string;
  col: number;
  row: number;
  draft: TileRegionDraft;
};

type Props = {
  tileRegionEditor: TileRegionEditorState | null;
  setTileRegionEditor: Dispatch<SetStateAction<TileRegionEditorState | null>>;
  tileRegionDraftRef: MutableRefObject<TileRegionDraft | null>;
  onSave: () => void;
  busy: boolean;
};

export default function TileRegionModal({
  tileRegionEditor,
  setTileRegionEditor,
  tileRegionDraftRef,
  onSave,
  busy,
}: Props) {
  if (!tileRegionEditor) return null;

  return (
    <div className="fixed inset-0 z-[82] bg-black/55 p-4">
      <div className="mx-auto mt-20 w-full max-w-lg rounded-2xl border border-zinc-700 bg-zinc-950 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-semibold text-zinc-100">
            지역 상태 편집 · col {tileRegionEditor.col}, row {tileRegionEditor.row}
          </div>
          <button
            type="button"
            className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:border-zinc-500"
            onClick={() => {
              setTileRegionEditor(null);
              tileRegionDraftRef.current = null;
            }}
          >
            닫기
          </button>
        </div>

        <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
          {(
            [
              { field: "spaceUsed", label: "💠 사용 공간", color: "#38bdf8" },
              { field: "spaceCap", label: "🧊 최대 공간", color: "#38bdf8" },
              { field: "threat", label: "⚠️ 위협도", color: "#ef4444" },
              { field: "pollution", label: "☣️ 오염도", color: "#c084fc" },
            ] as const
          ).map(({ field, label, color }) => (
            <label key={field} className="grid grid-cols-[92px_1fr] items-center gap-2">
              <span className="text-xs font-semibold" style={{ color }}>
                {label}
              </span>
              <input
                type="number"
                step={1}
                defaultValue={tileRegionEditor.draft[field]}
                onChange={(e) =>
                  tileRegionDraftRef.current
                    ? (tileRegionDraftRef.current = {
                        ...tileRegionDraftRef.current,
                        [field]: e.target.value,
                      })
                    : undefined
                }
                className="h-8 rounded-md border bg-zinc-950 px-2 text-xs text-zinc-100 outline-none"
                style={{ borderColor: `${color}aa`, color, caretColor: color }}
                placeholder="미설정"
              />
            </label>
          ))}
        </div>

        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-md bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
            onClick={onSave}
            disabled={busy}
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}

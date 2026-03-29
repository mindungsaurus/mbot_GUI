import type { Dispatch, MutableRefObject, SetStateAction } from "react";

type TileMemoEditorState = {
  targets: Array<{ key: string; col: number; row: number }>;
  draft: string;
};

type Props = {
  tileMemoEditor: TileMemoEditorState | null;
  setTileMemoEditor: Dispatch<SetStateAction<TileMemoEditorState | null>>;
  tileMemoDraftRef: MutableRefObject<string>;
  onSave: () => void;
  busy: boolean;
};

export default function TileMemoModal({
  tileMemoEditor,
  setTileMemoEditor,
  tileMemoDraftRef,
  onSave,
  busy,
}: Props) {
  if (!tileMemoEditor) return null;
  const isMulti = tileMemoEditor.targets.length > 1;
  const firstTarget = tileMemoEditor.targets[0];

  return (
    <div className="fixed inset-0 z-[82] bg-black/55 p-4">
      <div className="mx-auto mt-20 w-full max-w-2xl rounded-2xl border border-zinc-700 bg-zinc-950 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-semibold text-zinc-100">
            {isMulti
              ? `타일 메모 일괄 편집 · ${tileMemoEditor.targets.length}개 타일`
              : `타일 메모 · col ${firstTarget?.col ?? 0}, row ${firstTarget?.row ?? 0}`}
          </div>
          <button
            type="button"
            className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:border-zinc-500"
            onClick={() => {
              setTileMemoEditor(null);
              tileMemoDraftRef.current = "";
            }}
          >
            닫기
          </button>
        </div>

        {isMulti ? (
          <div className="mb-3 rounded-md border border-zinc-700 bg-zinc-900/40 px-3 py-2 text-[11px] text-zinc-300">
            여러 타일에 같은 메모를 적용합니다. 비워서 저장하면 선택된 타일의 메모를 제거합니다.
          </div>
        ) : null}

        <textarea
          defaultValue={tileMemoEditor.draft}
          onChange={(e) => {
            tileMemoDraftRef.current = e.target.value;
          }}
          className="h-48 w-full resize-y rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
          placeholder="이 타일에 대한 메모를 입력하세요."
        />

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


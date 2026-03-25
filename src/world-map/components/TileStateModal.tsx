import type { Dispatch, SetStateAction } from "react";
import type { MapTileStateAssignment, MapTileStatePreset } from "../../types";

type TileEditorState = {
  targets: Array<{ key: string; col: number; row: number }>;
  draft: MapTileStateAssignment[];
};

type Props = {
  tileEditor: TileEditorState | null;
  setTileEditor: Dispatch<SetStateAction<TileEditorState | null>>;
  presetById: Map<string, MapTileStatePreset>;
  activeTilePresets: MapTileStatePreset[];
  normalizeHexColor: (value: unknown, fallback?: string) => string;
  onSave: () => void;
};

export default function TileStateModal({
  tileEditor,
  setTileEditor,
  presetById,
  activeTilePresets,
  normalizeHexColor,
  onSave,
}: Props) {
  if (!tileEditor) return null;
  const isMulti = tileEditor.targets.length > 1;
  const firstTarget = tileEditor.targets[0] ?? null;

  return (
    <div className="fixed inset-0 z-[80] bg-black/55 p-4">
      <div className="mx-auto mt-16 w-full max-w-2xl rounded-2xl border border-zinc-700 bg-zinc-950 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-semibold text-zinc-100">
            {isMulti
              ? `타일 속성 부여 · ${tileEditor.targets.length}개 타일`
              : `타일 속성 편집 · col ${firstTarget?.col ?? "-"}, row ${firstTarget?.row ?? "-"}`}
          </div>
          <button
            type="button"
            className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:border-zinc-500"
            onClick={() => setTileEditor(null)}
          >
            닫기
          </button>
        </div>

        <div className="mb-3 space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
          <div className="text-xs font-semibold text-zinc-300">현재 속성</div>
          {tileEditor.draft.length === 0 ? (
            <div className="text-xs text-zinc-500">
              {isMulti ? "부여할 속성을 아래에서 추가해 주세요." : "설정된 속성이 없습니다."}
            </div>
          ) : (
            tileEditor.draft.map((entry, idx) => {
              const preset = presetById.get(entry.presetId);
              if (!preset) return null;
              const color = normalizeHexColor(preset.color);
              return (
                <div
                  key={`${entry.presetId}-${idx}`}
                  className="grid items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/40 px-2 py-2 md:grid-cols-[1fr_180px_auto]"
                >
                  <div className="min-w-0">
                    <span className="text-sm font-semibold" style={{ color }}>
                      {preset.name}
                    </span>
                  </div>
                  {preset.hasValue ? (
                    <input
                      value={entry.value ?? ""}
                      onChange={(e) =>
                        setTileEditor((prev) =>
                          prev
                            ? {
                                ...prev,
                                draft: prev.draft.map((draftEntry, draftIdx) =>
                                  draftIdx === idx
                                    ? { ...draftEntry, value: e.target.value }
                                    : draftEntry
                                ),
                              }
                            : prev
                        )
                      }
                      className="h-8 rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100 outline-none focus:border-zinc-500"
                      placeholder="값 입력"
                    />
                  ) : (
                    <div className="text-xs text-zinc-500">값 없음</div>
                  )}
                  <button
                    type="button"
                    className="rounded-md border border-red-800/70 bg-red-950/30 px-2 py-1 text-xs text-red-200 hover:bg-red-900/40"
                    onClick={() =>
                      setTileEditor((prev) =>
                        prev
                          ? {
                              ...prev,
                              draft: prev.draft.filter((_, draftIdx) => draftIdx !== idx),
                            }
                          : prev
                      )
                    }
                  >
                    제거
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="mb-4 space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
          <div className="text-xs font-semibold text-zinc-300">속성 추가</div>
          {activeTilePresets.length === 0 ? (
            <div className="text-xs text-zinc-500">추가 가능한 속성이 없습니다.</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {activeTilePresets.map((preset) => {
                const color = normalizeHexColor(preset.color);
                const exists = tileEditor.draft.some((entry) => entry.presetId === preset.id);
                return (
                  <button
                    key={preset.id}
                    type="button"
                    disabled={exists}
                    className={[
                      "rounded-md border px-2 py-1 text-xs font-semibold",
                      exists
                        ? "cursor-not-allowed border-zinc-800 bg-zinc-900 text-zinc-500"
                        : "border-zinc-700 bg-zinc-950 text-zinc-100 hover:border-zinc-500",
                    ].join(" ")}
                    style={!exists ? { color } : undefined}
                    onClick={() =>
                      setTileEditor((prev) =>
                        prev
                          ? {
                              ...prev,
                              draft: [
                                ...prev.draft,
                                preset.hasValue
                                  ? { presetId: preset.id, value: "" }
                                  : { presetId: preset.id },
                              ],
                            }
                          : prev
                      )
                    }
                  >
                    {preset.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            className="rounded-md bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600"
            onClick={onSave}
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}

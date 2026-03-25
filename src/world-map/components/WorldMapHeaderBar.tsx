// @ts-nocheck
type Props = {
  isAdmin: boolean;
  isPresetMode: boolean;
  mapListOpen: boolean;
  settingsOpen: boolean;
  busy: boolean;
  hasSelectedMap: boolean;
  onBack: () => void;
  onRefresh: () => void;
  onRunDailyRules: () => void;
  onToggleMapList: () => void;
  onToggleSettings: () => void;
};

export default function WorldMapHeaderBar({
  isAdmin,
  isPresetMode,
  mapListOpen,
  settingsOpen,
  busy,
  hasSelectedMap,
  onBack,
  onRefresh,
  onRunDailyRules,
  onToggleMapList,
  onToggleSettings,
}: Props) {
  return (
    <header className="relative mb-4 flex items-center justify-between gap-3">
      <div className="z-10">
        <div className="text-xl font-semibold">World Map</div>
        {isAdmin ? <div className="text-xs text-amber-300">관리자</div> : null}
      </div>
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center">
        {!isPresetMode ? (
          <button
            type="button"
            className="pointer-events-auto rounded-md border border-amber-700/70 bg-amber-950/30 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-900/40 disabled:opacity-60"
            onClick={onRunDailyRules}
            disabled={busy || !hasSelectedMap}
          >
            진행
          </button>
        ) : null}
      </div>
      <div className="z-10 flex items-center gap-2">
        {!isPresetMode ? (
          <button
            type="button"
            className={[
              "rounded-md border px-2 py-1 text-xs",
              mapListOpen
                ? "border-amber-700/70 bg-amber-950/30 text-amber-200"
                : "border-zinc-800 text-zinc-200 hover:border-zinc-600",
            ].join(" ")}
            onClick={onToggleMapList}
            disabled={busy}
          >
            지도 목록
          </button>
        ) : null}
        {!isPresetMode ? (
          <button
            type="button"
            className={[
              "rounded-md border px-2 py-1 text-xs",
              settingsOpen
                ? "border-sky-700/70 bg-sky-950/30 text-sky-200"
                : "border-zinc-800 text-zinc-200 hover:border-zinc-600",
            ].join(" ")}
            onClick={onToggleSettings}
            disabled={busy || !hasSelectedMap}
            title="지도 설정"
          >
            {"\u2699"} 설정
          </button>
        ) : null}
        <button
          type="button"
          className="rounded-md border border-zinc-800 px-2 py-1 text-xs text-zinc-200 hover:border-zinc-600"
          onClick={onBack}
          disabled={busy}
        >
          Back
        </button>
        <button
          type="button"
          className="rounded-md border border-zinc-800 px-2 py-1 text-xs text-zinc-200 hover:border-zinc-600"
          onClick={onRefresh}
          disabled={busy}
        >
          새로고침
        </button>
      </div>
    </header>
  );
}

import type { WorldMap } from "../../types";

type Props = {
  maps: WorldMap[];
  selectedMapId: string | null;
  busy: boolean;
  canCreate: boolean;
  canClose?: boolean;
  createName: string;
  onCreateNameChange: (value: string) => void;
  onCreate: () => void;
  onClose: () => void;
  onSelectMapId: (id: string) => void;
};

export default function MapListPanel({
  maps,
  selectedMapId,
  busy,
  canCreate,
  canClose = true,
  createName,
  onCreateNameChange,
  onCreate,
  onClose,
  onSelectMapId,
}: Props) {
  return (
    <aside className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="text-sm font-semibold text-zinc-100">지도 목록</div>
        {canClose ? (
          <button
            type="button"
            className="rounded-md border border-zinc-800 px-2 py-1 text-[11px] text-zinc-300 hover:border-zinc-600"
            onClick={onClose}
            disabled={busy}
          >
            접기
          </button>
        ) : null}
      </div>
      {canCreate ? (
        <div className="mb-4 flex gap-2">
          <input
            value={createName}
            onChange={(e) => onCreateNameChange(e.target.value)}
            placeholder="새 지도 이름"
            className="h-10 flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-zinc-600"
          />
          <button
            type="button"
            className="rounded-lg border border-emerald-700/60 bg-emerald-950/30 px-3 text-xs font-semibold text-emerald-200 hover:bg-emerald-900/40"
            onClick={onCreate}
            disabled={busy}
          >
            생성
          </button>
        </div>
      ) : null}
      <div className="space-y-2">
        {maps.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-800 px-3 py-4 text-sm text-zinc-500">
            아직 등록된 지도가 없습니다.
          </div>
        ) : (
          maps.map((map) => {
            const active = selectedMapId === map.id;
            return (
              <button
                key={map.id}
                type="button"
                className={[
                  "w-full rounded-xl border px-3 py-3 text-left",
                  active
                    ? "border-amber-500/70 bg-amber-950/20"
                    : "border-zinc-800 bg-zinc-950/30 hover:border-zinc-700",
                ].join(" ")}
                onClick={() => onSelectMapId(map.id)}
              >
                <div className="text-sm font-semibold text-zinc-100">{map.name}</div>
                <div className="mt-1 text-[11px] text-zinc-500">
                  {map.imageUrl ? "이미지 등록됨" : "이미지 없음"} · {map.cols} x {map.rows}
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}

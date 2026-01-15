// src/components/UnitCard.tsx
import type { MouseEvent, ReactNode } from "react";
import type { Unit } from "./types";
import { unitTextColor } from "./UnitColor";

function TrashIcon(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={props.className}
      aria-hidden="true"
    >
      <path
        d="M9 3h6m-8 4h10m-9 0 1 14h6l1-14M10 11v7M14 11v7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PenIcon(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={props.className}
      aria-hidden="true"
    >
      <path
        d="M12 20h9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EyeIcon(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={props.className}
      aria-hidden="true"
    >
      <path
        d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function formatDisplayTags(u: Unit): string {
  const order: string[] = [];
  const bag = new Map<string, { stacks?: number }>();

  function addTag(raw: string, stacks?: number) {
    const key = (raw ?? "").trim();
    if (!key) return;
    if (!bag.has(key)) {
      bag.set(key, {});
      order.push(key);
    }
    if (stacks !== undefined) {
      const s = Math.max(1, Math.trunc(Number(stacks)));
      const cur = bag.get(key)!;
      cur.stacks = cur.stacks === undefined ? s : Math.max(cur.stacks, s);
    }
  }

  const manual = Array.isArray(u.tags) ? u.tags : [];
  for (const t of manual) addTag(t);

  const ts = u.tagStates ?? {};
  for (const [k, st] of Object.entries(ts)) {
    const stacks = Math.max(1, Math.trunc(Number(st?.stacks ?? 1)));
    addTag(k, stacks);
  }

  return (
    order
      .map((k) => {
        const it = bag.get(k);
        if (it?.stacks !== undefined) return `${k} x${it.stacks}`;
        return k;
      })
      .filter(Boolean)
      .join(", ") || "-"
  );
}

function formatSpellSlotsSummary(u: Unit): string {
  // 슬롯은 1..최고레벨까지 이어서 보여주고, 누락 레벨은 0으로 채움
  const slots = u.spellSlots ?? {};
  const levels = Object.keys(slots)
    .map((k) => Math.trunc(Number(k)))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 9)
    .sort((a, b) => a - b);
  if (levels.length === 0) return "";

  const max = levels[levels.length - 1];
  const parts: string[] = [];
  for (let lvl = 1; lvl <= max; lvl++) {
    const raw = (slots as any)[lvl] ?? (slots as any)[String(lvl)];
    const n = Math.max(0, Math.trunc(Number(raw ?? 0)));
    parts.push(String(n));
  }
  return `[${parts.join("/")}]`;
}

function formatConsumablesSummary(u: Unit): string {
  // 이름/수량 쌍을 [이름 수량] 형태로 모아 보여줌
  const entries = Object.entries(u.consumables ?? {})
    .map(([raw, count]) => [raw.trim(), count] as const)
    .filter(([name]) => name.length > 0);
  if (entries.length === 0) return "";
  return entries
    .map(([name, count]) => {
      const n = Math.max(0, Math.trunc(Number(count ?? 0)));
      return `[${name} ${n}]`;
    })
    .join(" ");
}

function renderSlotSummary(summary: string) {
  if (!summary) return null;
  // 숫자만 강조하고 구분자는 기존 색을 유지
  const tokens = summary.match(/\d+|\D+/g) ?? [];
  return tokens.map((token, i) =>
    /^\d+$/.test(token) ? (
      <span key={`slot-num-${i}`} className="font-semibold text-sky-300">
        {token}
      </span>
    ) : (
      <span key={`slot-delim-${i}`}>{token}</span>
    )
  );
}

function renderConsumableSummary(summary: string): ReactNode {
  if (!summary) return null;
  // [이름 수량]에서 대괄호는 기본색, 내부 텍스트만 강조
  const out: ReactNode[] = [];
  const re = /\[(.*?)\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let idx = 0;
  while ((m = re.exec(summary)) !== null) {
    if (m.index > last) {
      out.push(<span key={`cons-text-${idx++}`}>{summary.slice(last, m.index)}</span>);
    }
    out.push(<span key={`cons-open-${idx++}`}>[</span>);
    out.push(
      <span key={`cons-body-${idx++}`} className="font-semibold text-sky-300">
        {m[1]}
      </span>
    );
    out.push(<span key={`cons-close-${idx++}`}>]</span>);
    last = m.index + m[0].length;
  }
  if (last < summary.length) {
    out.push(<span key={`cons-tail-${idx++}`}>{summary.slice(last)}</span>);
  }
  return out;
}

export default function UnitCard(props: {
  unit: Unit;
  isSelected: boolean;
  busy: boolean;
  variant?: "list" | "pinned";
  hideSide?: boolean;
  hideActions?: boolean;

  onSelect: (e: MouseEvent) => void;
  onEdit: () => void;
  onRemove: () => void;
  onToggleHidden: () => void;
}) {
  const {
    unit: u,
    isSelected,
    busy,
    variant = "list",
    onSelect,
    onEdit,
    onRemove,
    onToggleHidden,
  } = props;

  const hpMain = u.hp ? `${u.hp.cur}/${u.hp.max}` : "";
  const hpTemp = u.hp?.temp ? `+${u.hp.temp}` : "";
  const slotSummary = formatSpellSlotsSummary(u);
  const consumableSummary = formatConsumablesSummary(u);
  const tagsText = formatDisplayTags(u);
  // "tag1, tag2" 형태를 칩 렌더링용 배열로 변환
  const tagsList = tagsText === "-" ? [] : tagsText.split(", ");
  const hasHidden = !!u.hidden;
  const deathSuccess = Math.max(0, Math.trunc(u.deathSaves?.success ?? 0));
  const deathFailure = Math.max(0, Math.trunc(u.deathSaves?.failure ?? 0));
  const c = unitTextColor(u);

  const hideActions = props.hideActions ?? false;

  // pinned는 항상 액션 버튼 보이게 (끌려온 느낌 + UX)
  const showActions = !hideActions && (variant === "pinned" || isSelected);

  const baseCls = [
    "group relative w-full rounded-xl border px-3 py-3.5 text-left cursor-pointer select-none",
    props.hideSide ? "pr-24" : "pr-14",
  ].join(" ");
  const selCls = isSelected
    ? "border-zinc-500 bg-zinc-800"
    : "border-zinc-800 bg-zinc-900 hover:bg-zinc-800/60";
  const busyCls = busy ? "opacity-70 cursor-not-allowed" : "";

  const pinnedCls =
    variant === "pinned"
      ? "border-emerald-500/60 bg-emerald-950/20 ring-1 ring-emerald-400/20 border-dashed"
      : "";

  return (
    <div
      className={[baseCls, selCls, pinnedCls, busyCls].join(" ")}
      onClick={(e) => {
        if (busy) return;
        onSelect(e);
      }}
      title={variant === "pinned" ? "선택된 유닛(복제 카드)" : "클릭: 선택"}
    >
      {/* pinned 배지: '끌고 온 티' */}
      {variant === "pinned" && (
        <div className="mb-1 flex items-center gap-2">
          <span className="rounded-md border border-emerald-700/60 bg-emerald-950/40 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
            PINNED
          </span>
          <span className="text-[10px] text-zinc-500">
            원본 카드는 아래 목록에 그대로 있음
          </span>
        </div>
      )}

      {!props.hideSide && (
        <div className="absolute right-3 top-3 text-xs text-zinc-400">
          {u.side}
        </div>
      )}

      {/* 오른쪽 하단: 액션 버튼 */}
      {!hideActions && (
        <div className="absolute right-3 bottom-2 flex flex-col items-end gap-1">
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={busy}
              onClick={(e) => {
                e.stopPropagation();
                if (busy) return;
                onToggleHidden();
              }}
              title="Toggle hidden"
              className={[
                "flex h-6 w-6 flex-none items-center justify-center rounded-lg border bg-zinc-950/30",
                u.hidden
                  ? "border-red-800/70 text-red-300"
                  : "border-zinc-800 text-zinc-200",
                "hover:bg-zinc-800/60 disabled:opacity-50",
                showActions
                  ? "opacity-100"
                  : "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto",
              ].join(" ")}
            >
              <EyeIcon className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={(e) => {
                e.stopPropagation();
                if (busy) return;
                onEdit();
              }}
              title="Edit unit"
              className={[
                "flex h-6 w-6 flex-none items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950/30 text-zinc-200",
                "hover:bg-zinc-800/60 disabled:opacity-50",
                showActions
                  ? "opacity-100"
                  : "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto",
              ].join(" ")}
            >
              <PenIcon className="h-3.5 w-3.5" />
            </button>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={(e) => {
              e.stopPropagation();
              if (busy) return;
              onRemove();
            }}
            title="Remove unit"
            className={[
              "flex h-6 w-6 flex-none items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950/30 text-zinc-200",
              "hover:bg-zinc-800/60 disabled:opacity-50",
              showActions
                ? "opacity-100"
                : "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto",
            ].join(" ")}
          >
            <TrashIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* 이름/별명 */}
      <div className="flex items-start justify-between gap-2">
        <div
          className="min-w-0 font-medium leading-tight"
          style={c ? { color: c } : undefined}
        >
          {u.name}
          {u.alias ? (
            <span className="ml-1 text-sm opacity-80">({u.alias})</span>
          ) : null}
          {(deathSuccess > 0 || deathFailure > 0) && (
            <span className="ml-2 text-xs font-normal text-zinc-400">
              (
              <span className="font-semibold text-green-400">
                {deathSuccess}
              </span>
              ,{" "}
              <span className="font-semibold text-red-400">
                {deathFailure}
              </span>
              )
            </span>
          )}
          {slotSummary || consumableSummary ? (
            <span className="ml-2 text-xs font-normal text-zinc-400">
              {slotSummary ? renderSlotSummary(slotSummary) : null}
              {slotSummary && consumableSummary ? " " : ""}
              {consumableSummary ? renderConsumableSummary(consumableSummary) : null}
            </span>
          ) : null}
        </div>
      </div>

      {/* 상세 */}
            <div className="mt-1 text-xs text-zinc-400">
        {/* HP/AC highlight for quick scan */}
        {u.hp ? (
          <span className="text-red-400">
            HP <span className="font-semibold">{hpMain}</span>
            {hpTemp ? (
              <span className="font-semibold text-green-400">{hpTemp}</span>
            ) : null}
          </span>
        ) : (
          <span className="text-red-400">HP -</span>
        )}{" "}
        <span className="mx-2">•</span>
        {typeof u.acBase === "number" ? (
          <span className="text-yellow-300">
            AC <span className="font-semibold">{u.acBase}</span>
          </span>
        ) : (
          <span className="text-yellow-300">AC -</span>
        )}
        <span className="mx-2">•</span>
        <span className="text-zinc-500">
          pos: {u.pos ? `(${u.pos.x},${u.pos.z})` : "-"}
        </span>
      </div>

      {/* list에서는 tags 유지, pinned는 생략(덩치 줄여서 '복제 카드' 느낌 강화) */}
      <div className="mt-1 text-xs text-zinc-500">
        {tagsList.length === 0 && !hasHidden ? (
          <span>적용중인 상태 없음</span>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {/* 태그는 칩 형태로 노출해 가독성을 확보 */}
            {hasHidden && (
              <span className="rounded-md border border-red-500/40 bg-red-950/40 px-2 py-0.5 text-[11px] font-semibold text-red-300">
                숨겨짐
              </span>
            )}
            {tagsList.map((tag) => (
              <span
                key={tag}
                className="rounded-md border border-violet-500/30 bg-violet-950/30 px-2 py-0.5 text-[11px] font-semibold text-violet-300"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

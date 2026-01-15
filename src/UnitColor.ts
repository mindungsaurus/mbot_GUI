// src/unitColor.ts
import type { Unit } from "./types";

/**
 * backend encounter.render.ts 기준:
 * - u.colorCode 있으면 그걸 우선
 * - 없으면 TEAM=34, ENEMY=31, NEUTRAL=37
 * - 39는 "default"로 취급해서 undefined 반환(기존 색 유지)
 */
export function getUnitAnsiColorCode(
  u: Pick<Unit, "colorCode" | "side">
): number | undefined {
  if (typeof u.colorCode === "number") return u.colorCode;

  if (u.side === "TEAM") return 34;
  if (u.side === "ENEMY") return 31;
  return 37; // NEUTRAL
}

export function ansiColorCodeToCss(code?: number): string | undefined {
  if (code == null) return undefined;

  // 39: default(기존 글자색 유지)
  if (code === 39) return undefined;

  // 기본 30~37
  const base: Record<number, string> = {
    30: "#111827", // black-ish
    31: "#ef4444", // red
    32: "#22c55e", // green
    33: "#eab308", // yellow
    34: "#3b82f6", // blue
    35: "#a855f7", // magenta
    36: "#06b6d4", // cyan
    37: "#e5e7eb", // white/gray
  };

  // 밝은 90~97
  const bright: Record<number, string> = {
    90: "#9ca3af", // bright black => gray
    91: "#f87171",
    92: "#4ade80",
    93: "#fde047",
    94: "#60a5fa",
    95: "#c084fc",
    96: "#22d3ee",
    97: "#f9fafb",
  };

  return bright[code] ?? base[code];
}

export function unitTextColor(
  u: Pick<Unit, "colorCode" | "side">
): string | undefined {
  const code = getUnitAnsiColorCode(u);
  return ansiColorCodeToCss(code);
}

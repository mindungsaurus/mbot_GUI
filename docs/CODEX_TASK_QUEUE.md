# Codex Task Queue (Single-Task Mode)

Purpose:
- Prevent context compression loops by keeping one active task only.
- Keep a compact queue with strict status.

Policy:
1) Only one task can be `IN_PROGRESS`.
2) Do not start next task before marking current task `DONE` or `BLOCKED`.
3) Every task row must include exact target files.

Current Queue:

| ID | Status | Task | Target Files |
|---|---|---|---|
| WM-001 | DONE | Implement world-map carriage preset runtime (recruit flow) | `src/WorldMapManager.tsx`, `src/world-map/components/MapModePanel.tsx`, `src/world-map/components/ResourcePopulationOverlay.tsx`, `src/world-map/components/CarriageModal.tsx` |
| WM-002 | DONE | Validate carriage costs/rewards with base resources + item resources | `src/WorldMapManager.tsx`, `src/world-map/components/CarriageModal.tsx` |
| WM-003 | DONE | Type-check and regression check for map preset panel context wiring | `src/WorldMapManager.tsx`, `src/world-map/components/MapPresetsPanel.tsx` |
| WM-004 | IN_PROGRESS | New-thread resume completed; keep loop-guard docs synced until the next concrete task is chosen | `docs/CODEX_TASK_QUEUE.md`, `docs/CODEX_WORKLOG.md`, `docs/CODEX_SESSION_STATE.md` |

Resume Rule:
- When session resumes, read:
  1) `docs/CODEX_SESSION_STATE.md`
  2) `docs/CODEX_TASK_QUEUE.md`
  3) `docs/CODEX_CODEMAP.md`
  in this order before touching code.

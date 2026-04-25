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
| WM-004 | DONE | New-thread resume completed; keep loop-guard docs synced until the next concrete task is chosen | `docs/CODEX_TASK_QUEUE.md`, `docs/CODEX_WORKLOG.md`, `docs/CODEX_SESSION_STATE.md` |
| WM-005 | DONE | Add folder management for world-map tile/building/troop/carriage presets with persistent frontend/backend sync | `src/WorldMapManager.tsx`, `src/world-map/components/MapPresetsPanel.tsx`, `src/world-map/utils.ts`, `src/types.ts`, `src/api.ts`, `c:/Users/USER/Desktop/mbot2/src/world-maps/world-maps.controller.ts`, `c:/Users/USER/Desktop/mbot2/src/world-maps/world-maps.service.ts`, `c:/Users/USER/Desktop/mbot2/src/world-maps/world-maps.types.ts`, `c:/Users/USER/Desktop/mbot2/prisma/schema.prisma` |
| WM-006 | DONE | Await next concrete world-map task; keep loop-guard docs synced | `docs/CODEX_TASK_QUEUE.md`, `docs/CODEX_WORKLOG.md`, `docs/CODEX_SESSION_STATE.md` |
| WM-007 | DONE | Apply local Prisma migration for world-map preset folders and confirm DB status | `c:/Users/USER/Desktop/mbot2/prisma/migrations/20260423091500_add_world_map_preset_folders/migration.sql`, `c:/Users/USER/Desktop/mbot2/prisma/schema.prisma`, `docs/CODEX_TASK_QUEUE.md`, `docs/CODEX_WORKLOG.md`, `docs/CODEX_SESSION_STATE.md` |
| WM-008 | DONE | Await next concrete world-map task; keep loop-guard docs synced | `docs/CODEX_TASK_QUEUE.md`, `docs/CODEX_WORKLOG.md`, `docs/CODEX_SESSION_STATE.md` |
| WM-009 | DONE | Restore runtime-compatible Prisma client after backend startup failure | `c:/Users/USER/Desktop/mbot2/prisma/schema.prisma`, `c:/Users/USER/Desktop/mbot2/node_modules/@prisma/client`, `c:/Users/USER/Desktop/mbot2/node_modules/.prisma/client`, `docs/CODEX_TASK_QUEUE.md`, `docs/CODEX_WORKLOG.md`, `docs/CODEX_SESSION_STATE.md` |
| WM-010 | DONE | Await next concrete world-map task; keep loop-guard docs synced | `docs/CODEX_TASK_QUEUE.md`, `docs/CODEX_WORKLOG.md`, `docs/CODEX_SESSION_STATE.md` |
| WM-011 | DONE | Add nested parent-child support for world-map preset folders across frontend/backend | `src/WorldMapManager.tsx`, `src/world-map/components/MapPresetsPanel.tsx`, `src/world-map/utils.ts`, `src/types.ts`, `src/api.ts`, `c:/Users/USER/Desktop/mbot2/prisma/schema.prisma`, `c:/Users/USER/Desktop/mbot2/src/world-maps/world-maps.controller.ts`, `c:/Users/USER/Desktop/mbot2/src/world-maps/world-maps.service.ts`, `c:/Users/USER/Desktop/mbot2/src/world-maps/world-maps.types.ts`, `docs/CODEX_TASK_QUEUE.md`, `docs/CODEX_WORKLOG.md`, `docs/CODEX_SESSION_STATE.md` |
| WM-012 | DONE | Await next concrete world-map task; keep loop-guard docs synced | `docs/CODEX_TASK_QUEUE.md`, `docs/CODEX_WORKLOG.md`, `docs/CODEX_SESSION_STATE.md` |
| EC-001 | DONE | Add caster-based stack decay for encounter status tags and tag presets | `src/App.tsx`, `src/TagPresetManager.tsx`, `src/types.ts`, `src/api.ts`, `c:/Users/USER/Desktop/mbot2/src/encounter/encounter.actions.ts`, `c:/Users/USER/Desktop/mbot2/src/encounter/encounter.types.ts`, `c:/Users/USER/Desktop/mbot2/src/tag-presets/tag-presets.dto.ts`, `c:/Users/USER/Desktop/mbot2/src/tag-presets/tag-presets.service.ts`, `c:/Users/USER/Desktop/mbot2/prisma/schema.prisma`, `c:/Users/USER/Desktop/mbot2/prisma/migrations/20260423153000_add_tag_preset_dec_by_caster/migration.sql`, `docs/CODEX_TASK_QUEUE.md`, `docs/CODEX_WORKLOG.md`, `docs/CODEX_SESSION_STATE.md` |
| EC-002 | DONE | Fix encounter caster-based tag decay so the source unit turn decrements tags on all affected targets | `c:/Users/USER/Desktop/mbot2/src/encounter/encounter.actions.ts`, `docs/CODEX_TASK_QUEUE.md`, `docs/CODEX_WORKLOG.md`, `docs/CODEX_SESSION_STATE.md` |
| EC-003 | DONE | Prevent caster-based encounter tag decay from reacting to temporary turn start/end | `c:/Users/USER/Desktop/mbot2/src/encounter/encounter.actions.ts`, `docs/CODEX_TASK_QUEUE.md`, `docs/CODEX_WORKLOG.md`, `docs/CODEX_SESSION_STATE.md` |
| OPS-001 | IN_PROGRESS | Mitigate deployed web responsiveness regression by proxying production API traffic through Vercel instead of hitting the Railway public URL directly | `src/api.ts`, `src/world-map/utils.ts`, `vercel.json`, `docs/CODEX_TASK_QUEUE.md`, `docs/CODEX_WORKLOG.md`, `docs/CODEX_SESSION_STATE.md` |

Resume Rule:
- When session resumes, read:
  1) `docs/CODEX_SESSION_STATE.md`
  2) `docs/CODEX_TASK_QUEUE.md`
  3) `docs/CODEX_CODEMAP.md`
  in this order before touching code.

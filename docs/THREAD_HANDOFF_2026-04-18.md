# THREAD HANDOFF 2026-04-18

Purpose:
- Resume work in a new thread without re-parsing the whole repo.
- Preserve current world-map context, recent fixes, and safe entry points.
- Reduce context-compression loops.

Read Order For New Thread:
1) `docs/THREAD_HANDOFF_2026-04-18.md`
2) `docs/CODEX_SESSION_STATE.md`
3) `docs/CODEX_TASK_QUEUE.md`
4) `docs/CODEX_CODEMAP.md`
5) Only then open source files.

Repo Layout:
- Frontend cwd:
  - `c:\Users\USER\Desktop\mbot_combat\operater-ui`
- Backend sibling repo used by this project:
  - `c:\Users\USER\Desktop\mbot2`

Working Rules The User Explicitly Asked For:
- Do not fall into "context compression loop".
- Do not re-scan the full repo when fixed entry documents already exist.
- Handle one task at a time.
- If work may be interrupted, write progress into docs first.
- When frontend changes imply backend sync, check backend too.
- Be careful with regressions; small changes must not break unrelated flows.

Current Feature Area:
- World Map subsystem.
- This is the largest and most stateful area in the frontend.
- Main orchestration is in `src/WorldMapManager.tsx`.

Primary Frontend Entry Points:
- `src/WorldMapManager.tsx`
  - core world-map state
  - handler wiring
  - preset and modal context assembly
- `src/world-map/components/MapModePanel.tsx`
  - main map-mode composition
  - modal mounting
- `src/world-map/components/MapPresetsPanel.tsx`
  - preset editing tabs
- `src/world-map/components/ResourcePopulationOverlay.tsx`
  - right-side overlay and modal entry buttons
- `src/world-map/components/CarriageModal.tsx`
  - carriage recruit UI and queue
- `src/world-map/components/TroopModal.tsx`
  - troop training / deploy / disband flows
- `src/world-map/utils.ts`
  - world-map normalization and helper logic
- `src/types.ts`
  - domain types
- `src/api.ts`
  - frontend API calls

Current Backend Reminder:
- World-map related API/state is not frontend-only.
- When persistence or cross-user visibility is involved, inspect backend in:
  - `c:\Users\USER\Desktop\mbot2`
- User expects frontend/backend consistency.

Most Recent Completed Changes In This Thread:
1. World map opens with map list collapsed by default.
   - File:
     - `src/WorldMapManager.tsx`
   - Change:
     - `mapListOpen` initial value set to `false`.

2. Carriage preset defaults adjusted.
   - User requirement:
     - carriage preset name must NOT auto-fill
     - name placeholder only should be `작은 난민 집단`
     - recruit deadline default should be `1`
   - Files:
     - `src/world-map/components/MapPresetsPanel.tsx`
     - `src/WorldMapManager.tsx`
   - Result:
     - placeholder only = `작은 난민 집단`
     - default effort = `1`

3. Carriage recruit queue cancel/refund implemented.
   - Files:
     - `src/world-map/components/CarriageModal.tsx`
     - `src/world-map/components/MapModePanel.tsx`
     - `src/WorldMapManager.tsx`
     - `src/world-map/utils.ts`
     - `src/types.ts`
   - Result:
     - each queue item can be canceled
     - committed costs are refunded
     - order stores `committedCosts` snapshot

4. Carriage daily progress overwrite bug fixed.
   - Symptom:
     - after day progress, queue state could revert
   - Root cause:
     - stale `cityGlobal.carriage` could overwrite progressed carriage state
   - Fix:
     - merge now prefers memo state `__sys_carriage_state__`
   - File:
     - `src/WorldMapManager.tsx`

State/Flow Assumptions To Preserve:
- World-map state is often reconstructed from:
  - backend payload
  - memo-backed recovered state
  - local normalized frontend state
- Regression risk is high when merging:
  - `cityGlobal`
  - `tileMemos`
  - recovered runtime state
- Carriage runtime is memo-backed; do not casually change merge precedence.

Known Documentation Situation:
- Some older docs in `docs/` are mojibake due to prior encoding issues.
- Prefer:
  - this file
  - `CODEX_SESSION_STATE.md`
  - `CODEX_TASK_QUEUE.md`
  - `CODEX_CODEMAP.md`
- Avoid relying on mojibake-heavy notes unless necessary.

Safe Resume Procedure:
1. Read this file.
2. Read the three stable docs listed above.
3. Open only the source entry files relevant to the active task.
4. Before editing, summarize the exact write targets.
5. After each meaningful step, update docs if the thread may end soon.

If The Next Task Is World-Map Related:
- Start with:
  - `src/WorldMapManager.tsx`
  - then only the directly relevant component
- Do not expand into unrelated combat/gold/item files unless the user asks.

If The Next Task Touches Persistence:
- Check whether it is:
  - frontend-only local state
  - backend DB/API state
  - both
- User expects persistent features to be DB-backed, not local-only.

Quick Sanity Checklist Before Finalizing Any Patch:
- Typecheck frontend:
  - `npx tsc -p tsconfig.app.json --noEmit`
- If backend touched, typecheck backend too.
- Check map reopen flow if state UI changed.
- Check day-progress flow if resource/carriage/troop/world state changed.
- Check admin/non-admin visibility if list/preset scope changed.

Open Risks Right Now:
- Large `WorldMapManager.tsx` remains a hotspot for regression.
- Some old world-map logic still mixes runtime-derived and persisted state.
- There may still be backend follow-up work for future world-map preset sharing / persistence tasks depending on the next request.

Recommended First Message Behavior In New Thread:
- State that this handoff doc was read.
- State which exact files will be inspected next.
- Keep scope to a single task.

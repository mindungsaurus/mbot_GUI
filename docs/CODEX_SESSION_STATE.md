# CODEX SESSION STATE (ASCII)

Purpose:
- Prevent repeated full-code re-analysis after context compression.
- Keep a compact, stable execution state that can be resumed quickly.

Rules:
1) One task at a time.
2) Before editing code, read this file first.
2.1) For new-thread resume, read `docs/THREAD_HANDOFF_2026-04-18.md` before this file.
3) After each meaningful step, update:
   - DONE
   - NEXT
   - RISKS
   - FILES TO TOUCH
4) If interrupted, write exact resume point and stop.
5) Always use queue + codemap:
   - `docs/CODEX_TASK_QUEUE.md`
   - `docs/CODEX_CODEMAP.md`
   before scanning source files.

Current Primary Goal:
- Continue concrete feature work without context-loop re-scans.

Latest User Instruction:
- Add a Vercel-side API proxy so the deployed web stops calling the Railway public URL directly.

DONE:
- Added persistent tracking docs:
  - docs/CODEX_WORKLOG.md
  - docs/CODEX_WORLDMAP_FLOW.md
- Added this stable ASCII tracker:
  - docs/CODEX_SESSION_STATE.md
- Added loop guard docs:
  - docs/CODEX_TASK_QUEUE.md
  - docs/CODEX_CODEMAP.md
- Added new-thread handoff doc:
  - docs/THREAD_HANDOFF_2026-04-18.md
- New-thread resume completed:
  - loaded `THREAD_HANDOFF_2026-04-18.md`
  - loaded `CODEX_SESSION_STATE.md`
  - loaded `CODEX_TASK_QUEUE.md`
  - loaded `CODEX_CODEMAP.md`
  - kept scope on fixed docs only; no repo-wide rescan yet
- New active task identified:
  - add persistent preset folders for world-map tile/building/troop/carriage presets
  - inspect frontend fixed entry points first
  - inspect backend world-map preset persistence because folder state must survive reload
- Completed `WM-005`:
  - added persistent shared preset-folder storage in backend
  - added folderId support to tile/building world-map presets
  - grouped preset UI by folder in `MapPresetsPanel`
  - added folder create/rename/delete and preset folder assignment flows
  - verified frontend and backend TypeScript builds
- Completed `WM-009`:
  - root cause was a runtime-incompatible Prisma client generated during recovery work
  - regenerated normal Prisma client with `npx prisma generate`
  - verified direct Prisma query works again
  - re-ran backend TypeScript build successfully
- Completed `WM-011`:
  - added `parentId` support to world-map preset folders in frontend/backend
  - added same-kind parent validation and descendant-cycle blocking
  - updated preset panel to create, move, and render nested folder trees
  - applied local Prisma migration for folder tree support
  - restored backend `start:dev` watch process after regeneration/migration
- Completed `EC-001`:
  - added `decByCaster` storage on tag presets and applied local Prisma migration
  - added encounter tag state fields `decByCaster` and `sourceUnitId`
  - updated status-tag grant modal to allow caster-based decay and require an active unit turn when used
  - updated tag preset manager to save/load the caster-based option
  - updated turn-based decay logic so stack reduction can follow the caster's turn instead of the holder's turn
- Completed `EC-002`:
  - fixed the runtime bug where caster-based decay only checked the current turn holder's own tags
  - added a turn-decay sweep for all units so tags sourced by the acting unit now decrement on that acting unit's turn
  - aligned direct unit turns, temp turns, disabled-unit pass-through, servant-linked turns, and group turns to use the same decay sweep helper
- Completed `EC-003`:
  - temp-turn start/end now keep holder-based tag decay but suppress caster-based decay
  - forwarded the same suppression through servant-linked temp-turn decay calls
  - verified backend TypeScript build passes
- Started `OPS-001`:
  - investigate deployed web responsiveness regression affecting login/bootstrap
  - compare frontend request path, backend `/auth/me`, and startup/init candidates without repo-wide rescan
- OPS-001 findings so far:
  - direct measurement against `https://motivated-intuition-production-416d.up.railway.app` shows DNS/TCP/TLS are fast but TTFB is about 12-15s
  - the delay reproduces on `/auth/me`, `/auth/login`, `/`, and a missing route, so it is not specific to auth or the new preset features
  - direct measurement against `https://mbot-gui.vercel.app/` is fast
  - current evidence points to Railway public ingress or process-wide response-start delay, not a recent UI route/regression in the new feature code
- OPS-001 implementation step:
  - add a lightweight `/healthz` endpoint for HTTP-only response timing checks
  - add request timing logs around the Nest HTTP app to separate app-internal delay from ingress delay
- OPS-001 implementation progress:
  - added `/healthz` in the backend app controller/service
  - added slow-request timing logs in `main.ts` for requests taking 1000ms or longer
  - verified backend TypeScript build passes
- OPS-001 redeploy check:
  - after redeploy, external `/healthz` still shows about 15.2s TTFB
  - external `/` still shows about 15.2s TTFB
  - external `/auth/me` OPTIONS/GET still show about 12.2-12.4s TTFB
  - the slowdown still reproduces on the new minimal health endpoint
  - mobile access is also slow, so the issue is less likely to be tied to one desktop environment or one local browser state
- OPS-001 mitigation step:
  - move the deployed frontend to same-origin `/api` calls
  - add a Vercel rewrite that proxies `/api/*` to Railway
- OPS-001 mitigation progress:
  - updated `src/api.ts` so production defaults to same-origin `/api`
  - added `vercel.json` rewrite for `/api/* -> Railway`
  - verified frontend TypeScript build passes

NEXT:
- `OPS-001` in progress:
  - redeploy the frontend and retest the production URL

RISKS:
- Existing non-ASCII notes can display as mojibake in some terminal encodings.
- Avoid non-ASCII in this state file.

FILES TO TOUCH:
- docs/CODEX_SESSION_STATE.md
- docs/CODEX_TASK_QUEUE.md
- docs/CODEX_WORKLOG.md
- src/api.ts
- vercel.json

RESUME POINTER:
- `OPS-001` is active. Production frontend now targets same-origin `/api` and Vercel rewrites `/api/*` to Railway; the next step is redeploy and remeasure live latency.

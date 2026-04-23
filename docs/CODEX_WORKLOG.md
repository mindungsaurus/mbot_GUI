# Codex Worklog (World Map)

## Resume Notes (ASCII)
- [2026-04-18] New thread resume completed.
- Loaded in order:
  - `docs/THREAD_HANDOFF_2026-04-18.md`
  - `docs/CODEX_SESSION_STATE.md`
  - `docs/CODEX_TASK_QUEUE.md`
  - `docs/CODEX_CODEMAP.md`
- Kept scope on loop-guard docs only.
- No repo-wide rescan performed.
- Active queue remains `WM-004` until the next concrete task is selected.
- [2026-04-23] Started `WM-005`.
- Goal: add folder management for world-map tile/building/troop/carriage presets.
- Scope chosen from fixed entry points only:
  - frontend: `WorldMapManager`, `MapPresetsPanel`, `utils`, `types`, `api`
  - backend: world-map controller/service/types + Prisma schema
- Early finding: current world-map preset storage is flat and has no folder concept, so persistence changes are required.
- [2026-04-23] Completed `WM-005`.
- Backend:
  - added `WorldMapPresetFolder` Prisma model
  - added `folderId` on shared tile presets and world-map building presets
  - added shared preset-folder CRUD endpoints in world-map controller/service
- Frontend:
  - added folder types/API calls and normalization
  - added folder grouping/assignment UI in `MapPresetsPanel`
  - wired state + handlers in `WorldMapManager`
- Verification:
  - `npx tsc -p tsconfig.app.json --noEmit`
  - `npx prisma generate --no-engine`
  - `npx tsc -p tsconfig.build.json --noEmit`
- [2026-04-23] Started `WM-007`.
- Goal: apply the pending local Prisma migration for world-map preset folders.
- [2026-04-23] Completed `WM-007`.
- Local DB migration:
  - `npx prisma migrate deploy`
  - applied `20260330190000_add_world_map_tile_memos`
  - applied `20260423091500_add_world_map_preset_folders`
- Status check:
  - `npx prisma migrate status`
  - database schema is up to date
- [2026-04-23] Started `WM-009`.
- Goal: fix backend startup after Prisma client was regenerated in a runtime-incompatible mode.
- [2026-04-23] Completed `WM-009`.
- Recovery:
  - `npx prisma generate`
  - verified direct Prisma query with `prisma.user.findMany({ take: 1 })`
  - `npx tsc -p tsconfig.build.json --noEmit`
- Result: backend Prisma client is back in normal runtime mode.
- [2026-04-23] Started `WM-011`.
- Goal: allow world-map preset folders to be nested with parent-child structure.
- [2026-04-23] Completed `WM-011`.
- Backend:
  - added `WorldMapPresetFolder.parentId` self-relation
  - added same-kind parent validation and cycle prevention
  - migration applied: `20260423103000_add_world_map_preset_folder_tree`
- Frontend:
  - added parent-aware folder types/API wiring
  - folder manager now supports parent selection and moving folders
  - preset lists now render nested folder trees instead of flat groups
- Verification:
  - `npx tsc -p tsconfig.app.json --noEmit`
  - `npx prisma generate`
  - `npx prisma migrate deploy`
  - `npx tsc -p tsconfig.build.json --noEmit`
  - `npx prisma migrate status`
  - direct Prisma check: `prisma.worldMapPresetFolder.findMany({ take: 1 })`
- Runtime:
  - restarted backend dev watch process with `npm run start:dev`
- [2026-04-23] Started `EC-001`.
- Goal: add caster-based stack decay to encounter status-tag grant and tag presets.
- [2026-04-23] Completed `EC-001`.
- Frontend:
  - added `decByCaster` to tag preset types and API payloads
  - updated `App.tsx` status-tag grant modal to expose the option and capture the current turn unit as source
  - updated `TagPresetManager.tsx` so stack tag presets can save/load the option
- Backend:
  - added `decByCaster` column to `TagPreset`
  - added encounter tag-state fields `decByCaster` and `sourceUnitId`
  - updated encounter turn decay logic so caster-based tags decay on the source unit's turn while holder-based tags keep existing behavior
- Local DB/runtime:
  - applied migration `20260423153000_add_tag_preset_dec_by_caster`
  - regenerated Prisma client after stopping backend watch processes that locked the engine DLL
- Verification:
  - `npx tsc -p tsconfig.app.json --noEmit`
  - `npx prisma migrate deploy`
  - `npx prisma generate`
  - `npx prisma migrate status`
  - `npx tsc -p tsconfig.build.json --noEmit`
- [2026-04-24] Started `EC-002`.
- Goal: fix caster-based tag decay because tags were not decrementing on the source unit's turn.
- [2026-04-24] Completed `EC-002`.
- Root cause:
  - the first implementation only called `decTurnTags()` on the current turn holder (or servant/group member) itself
  - caster-based tags attached to other units never entered the decay loop even though `sourceUnitId` matched
- Fix:
  - added `applyUnitTurnTagDecays()` to sweep every unit's tag state against the current source unit id
  - switched direct turn start/end, temp turns, disabled-unit pass-through, servant-linked turns, and group turns to use that helper
- Verification:
  - `npx tsc -p tsconfig.build.json --noEmit`
- [2026-04-24] Started `EC-003`.
- Goal: keep caster-based tag decay from reacting to temp-turn start/end while preserving existing holder-based temp-turn decay.
- [2026-04-24] Completed `EC-003`.
- Root cause:
  - the shared turn-decay sweep introduced in `EC-002` treated temp turns like normal turns for both holder-based and caster-based decay
  - as a result, `decByCaster` tags reacted to temp-turn start/end even though they should only react to normal source-unit turns
- Fix:
  - added an option on the internal turn-decay sweep helper to suppress caster-based decay while still supplying holder-based decay
  - used that option only on temp-turn start/end, including the servant-linked temp-turn decay path
- Verification:
  - `npx tsc -p C:\Users\USER\Desktop\mbot2\tsconfig.build.json --noEmit`

이 파일은 컨텍스트 압축 루프를 방지하기 위한 작업 로그다.
앞으로 월드맵/프리셋 작업은 이 파일을 기준으로 이어서 진행한다.

## Rules
- 코드 탐색 전에 이 파일의 `Current Focus`, `Last Stable Flow`를 먼저 확인한다.
- 작업 단위는 한 번에 1개 태스크로 제한한다.
- 각 태스크 완료 시 `Done`과 `Next`를 반드시 갱신한다.
- 중단/오류 발생 시 재현 조건과 수정 지점을 기록한다.

## Last Stable Flow
- 월드맵 프리셋 탭: `tile / building / troop / carriage` 탭 UI 존재.
- 병력 기능: 훈련/배치/해산 모달 및 상태 저장 흐름 존재.
- 역마차(carriage): 런타임 영입 모달/핸들러 연결 완료.
  - 비용: 기본 자원 + 창고 아이템 차감
  - 보상: 인구(total/available) + 자원/아이템 지급
  - 저장: `updateWorldMap` 반영 + 오버플로우 금 환전 연동

## Current Focus
1. 사용자 다음 요청 단계 처리
2. 루프 방지 문서 동기화 유지

## Known Gaps (Carriage)
- 현재 알려진 carriage 런타임 누락 없음(2026-04-18 기준 타입체크 통과).

## Done
- [2026-04-18] 작업 로그 파일 생성 및 루프 방지 규칙 적용.
- [2026-04-18] 루프 방지 강화:
  - `docs/CODEX_TASK_QUEUE.md` 추가 (single-task queue)
  - `docs/CODEX_CODEMAP.md` 추가 (고정 진입점 codemap)
  - `docs/CODEX_SESSION_STATE.md`에 queue/codemap 선확인 규칙 추가
- [2026-04-18] carriage 런타임 구현 마무리:
  - `ResourcePopulationOverlay` 역마차 버튼 추가
  - `CarriageModal` 신규 추가 및 `MapModePanel` 연결
  - `WorldMapManager` 영입 핸들러(`handleRecruitCarriage`) 반영
  - 컨텍스트 전달 누락 수정(`presetPanelCtx`, `mapModePanelCtx`)
  - `npx tsc -p tsconfig.app.json --noEmit` 통과

## Next
- 사용자의 다음 기능 요청 처리.

- [2026-04-18] carriage 영입 지연(기한) 작업 진행:
  - cityGlobal.carriage 정규화/기본값 보강 유지
  - WorldMapManager에 carriage memo 상태 키 추가(__sys_carriage_state__)
  - 즉시 영입 로직 제거, 영입 대기열 등록 로직으로 전환
  - 일일 진행 시 carriage 대기열 감소/완료 반영(applyCarriageRecruitProgress) 추가
  - MapPresetsPanel에서 carriage effort(영입 기한 (일)) 입력 노출
  - 진행 후 타입체크 예정
  - compile 검증: npx tsc -p tsconfig.app.json --noEmit 통과
  - 역마차 영입: 즉시 합류 -> 대기열 합류로 변경 완료, 일일 진행 시 완료 처리
- [2026-04-18] 역마차 모달에 영입 대기열 섹션 추가(프리셋명/수량/남은일수/획득 인구·자원 표시), MapModePanel에서 cityGlobal.carriage.recruiting 전달
- [2026-04-18] 역마차 영입 큐 일자 진행 반영 누락/되돌림 방지 패치: mergeMapWithRecoveredTroops에서 carriage 상태 병합 시 cityGlobal 우선이 아니라 tileMemos(__sys_carriage_state__) 우선으로 통일. 서버 응답의 stale carriage가 로컬 진행 결과를 덮어쓰던 경로 차단.
- [2026-04-18] 역마차 영입 대기열 취소 기능 추가: CarriageModal에 항목별 취소 버튼, WorldMapManager에 handleCancelCarriageRecruit 구현(비용 환불 포함), 주문 시 committedCosts 스냅샷 저장/정규화로 프리셋 변경 후에도 환불 정확도 유지.
- [2026-04-18] 역마차 프리셋 기본값 조정: 기본 이름 '작은 난민 집단', 기본 영입 기한 1일. 모드 전환/드래프트 초기화/역마차 탭 클릭 경로 모두 동기화.

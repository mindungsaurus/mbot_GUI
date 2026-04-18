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

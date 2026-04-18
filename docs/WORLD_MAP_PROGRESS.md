# World Map Progress Snapshot

Last updated: 2026-04-12 (Asia/Seoul)

## Why this file exists
컨텍스트 압축 이후에도 동일 상태로 이어서 작업하기 위한 진행 스냅샷.
월드맵 작업 시 매 턴 끝에 갱신한다.

## Recently stabilized
- 타일/지역 상태 다중 적용
- 지역 상태 signed 내부값 유지 + 프론트 clamp 표시(위협도)
- 자원/인구 패널 및 각종 관리 모달(창고/자원 현황/배치 현황)
- 저장 완료 모달/환전 모달/식량-금 대체 모달

## In-progress feature thread (latest user request)
병력 프리셋 개편:
1. 병력은 프리셋 직접 타일 배치가 아니라 “보유 병력”을 배치
2. 인구 패널 하단 `병력` 버튼 → 별도 모달
   - 탭1: 병력 훈련
   - 탭2: 병력 배치 현황
3. 병력 편성 인구는 가용 인구 차감
4. 타일 전력 총합 pill(노란색+이모지) 표시
5. 병력은 공간 비점유
6. 병력 배치/건물 배치 분리
7. 병력 프리셋은 규칙 블록 없이 스펙만 관리
8. 훈련 시간 표기: `(일)`

## Open technical points
- 현재 구조는 troop가 building instance 경로를 일부 공유함.
- backend 변경 없이 구현하려면
  - troop 보유/배치를 cityGlobal 확장 필드로 관리하거나
  - hidden instance 전략 중 하나를 고정해야 함.

## Next edit order
1. 타입/정규화 확장(`types.ts`, `world-map/utils.ts`)
2. 병력 모달 컴포넌트 추가 + 인구 패널 버튼 연결
3. 컨텍스트 메뉴의 `병력 배치` 제거
4. MapCanvas에 타일 전력 pill 추가
5. operationalAllocation에 병력 편성 인구 차감 통합
6. TS build 점검 및 연결 누락 정리

## Regression checklist (must pass after edits)
- 타일 우클릭/타일 속성/지역 상태 저장 정상
- 일일 규칙 실행 정상
- 건물 배치 모달 정상
- 인구 가용치 음수 미발생
- 저장 후 새로고침 시 병력 상태 보존


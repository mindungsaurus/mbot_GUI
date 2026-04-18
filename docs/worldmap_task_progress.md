# World Map Task Progress

Updated: 2026-04-16

## Current request
- 원정 캠프 구현을 위한 사전 단계
  - 조건 `거리 내 건물/병력 필요` 분리
  - `거리 내 타일`의 `본인 타일 제외` 옵션
  - `지속 효과` 효과 타입 추가

## Step-by-step status
1. **완료**: 조건 분리 1차 반영
   - `requireBuildingInRange`(건물) / `requireTroopInRange`(병력) 타입 분리
   - 프리셋 UI(배치 조건/규칙 조건)에서 옵션 분리
   - 판정 로직 분리:
     - 건물 카운트는 건물 인스턴스만 카운트
     - 병력 카운트는 배치 병력만 카운트
2. **완료**: `거리 내 타일`의 `본인 타일 제외` 옵션 추가
   - 액션 타입에 `excludeSelf` 추가
   - 액션 정규화/기본값에 `excludeSelf` 반영
   - 규칙 편집 UI에서 `거리 내 타일` 선택 시 체크박스 제공
3. **완료(프론트 1차)**: `지속 효과` 타입/실행 파이프라인 추가
   - 타입/드래프트/API payload에 `effects.sustain` 추가
   - 프리셋 UI에 `지속 효과` 섹션 추가
   - `WorldMapManager`에서 `지속 효과` 실시간 계산 추가:
     - 운영중 건물의 `effects.sustain`만 평가
     - 조건/반복/거리/`본인 타일 제외` 반영
     - `adjustTileRegion` 액션을 누적 적용
   - 표시/규칙 미리보기 컨텍스트에서 `effectiveTileRegionStates` 사용
4. **다음 단계**: 백엔드 실행 엔진(run-daily)과 `sustain` 동기화
   - 현재 단계는 프론트 표시/미리보기 중심 반영
   - 서버 `run-daily` 결과에도 동일한 지속효과 기준이 필요하면 백엔드 적용 필요

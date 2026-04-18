# World Map Context (Persistent Handoff)

이 파일은 컨텍스트 압축 이후에도 동일한 맥락으로 바로 작업을 재개하기 위한 기준 문서다.
월드맵 관련 수정 시 반드시 이 문서를 갱신한다.

## 1) Runtime Entry
- Main container: `src/WorldMapManager.tsx`
- Mode split:
  - Map mode UI orchestration: `src/world-map/components/MapModePanel.tsx`
  - Preset mode UI orchestration: `src/world-map/components/MapPresetsPanel.tsx`
- Shared normalization + domain utils:
  - `src/world-map/utils.ts`

## 2) Core State Ownership
- Map list / selected map / image metadata:
  - `WorldMapManager.tsx`
- Tile state preset/assignment/region/memo:
  - Local state in `WorldMapManager.tsx`, persisted via `updateWorldMap(...)`
- City global state (resources/population/day/warehouse/...):
  - Normalized with `normalizeCityGlobalState(...)` in `src/world-map/utils.ts`
  - Persisted as `cityGlobal` in `updateWorldMap(...)`
- Building presets + instances:
  - Presets: shared APIs + local cache in `buildingPresetsByMap`
  - Instances: `buildingInstancesByMap`

## 3) Critical Invariants
- `normalizeCityGlobalState(...)`는 모르는 필드를 제거할 수 있다.
  - CityGlobal에 필드 추가 시:
    1. `src/types.ts` 타입 확장
    2. `createDefaultCityGlobalState` 확장
    3. `normalizeCityGlobalState` 확장
    4. `handleSaveCityGlobal`에서 새 필드 보존 여부 확인
- 타일 상태/지역 상태/메모는 저장 시 반드시:
  - local optimistic update + persist + 실패 시 refresh rollback
- 건물 인구 점유는 `operationalAllocation` 계산 결과가 기준이며,
  UI 표기용 `effectiveCityGlobal.population.*.available`에 반영된다.

## 4) Map Mode Component Responsibilities
- `MapViewportHeader`: 모드 토글/줌/표시 토글
- `ResourcePopulationOverlay`: 자원/인구 패널 + 관련 액션 버튼
- `MapCanvas`: 이미지 + hex overlay + pill 렌더링 + tile click/contextmenu
- `TileContextMenu`: 우클릭 메뉴 엔트리
- `TileBuildingModal`: 타일 건물 배치/상태 편집
- `TileStateModal` / `TileRegionModal` / `TileMemoModal`: 타일 속성 편집 모달
- `WarehouseModal` / `ResourceStatusModal` / `PlacementReportModal` / `TileYieldModal`:
  보조 관리/조회 모달

## 5) Fast Resume Checklist (필수)
1. `src/world-map/utils.ts`의 normalize 계열 먼저 확인
2. `src/WorldMapManager.tsx`에서 해당 기능 state + handler 위치 확인
3. `src/world-map/components/MapModePanel.tsx`에서 ctx 전달 누락 여부 확인
4. 렌더가 안 보이면:
   - MapCanvas props 전달
   - Overlay props 전달
   - modal open state 전달
5. 저장이 안 되면:
   - `updateWorldMap(...)` payload 포함 여부
   - save 후 `setMaps(...)` 반영 여부
   - `refreshCurrentMapOnly(...)` 타이밍 확인

## 6) Active Refactor Rule
- 500줄 이상 신규 로직 추가 금지.
- 신규 기능은 원칙적으로:
  - 컴포넌트: `src/world-map/components/*`
  - 순수 로직/정규화: `src/world-map/utils.ts` 또는 신규 util 파일
  - manager에는 상태 조립/핸들러 연결만 남긴다.

## 7) Current Known Large Files
- `src/WorldMapManager.tsx` (대형, 우선 분리 대상)
- `src/world-map/components/MapPresetsPanel.tsx` (대형, 우선 분리 대상)


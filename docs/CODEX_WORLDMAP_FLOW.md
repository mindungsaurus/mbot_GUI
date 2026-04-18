# World Map Code Flow (Compact Reference)

## Entry
- `src/WorldMapManager.tsx`
  - 상태 소스/핸들러 정의
  - `presetPanelCtx`, `mapModePanelCtx` 생성
  - `WorldMapHeaderBar` + `MapPresetsPanel`/`MapModePanel` 렌더

## Preset UI
- `src/world-map/components/MapPresetsPanel.tsx`
  - 타일 속성 프리셋
  - 건물 프리셋
  - 병력 프리셋
  - 역마차 프리셋(UI만 부분 존재)

## Map UI
- `src/world-map/components/MapModePanel.tsx`
  - 설정 패널 + 맵 캔버스 + 오버레이 + 각종 모달 연결
- `src/world-map/components/ResourcePopulationOverlay.tsx`
  - 자원/인구 패널 버튼
  - 병력 모달 오픈 버튼 존재

## Troop Runtime
- `WorldMapManager.tsx`
  - `handleStartTroopTraining`
  - `handleCancelTroopTraining`
  - `handleDeployTroopToSelectedTile`
  - `handleWithdrawTroopFromSelectedTile`
  - `handleDisbandTroop`
- `src/world-map/components/TroopModal.tsx`
  - 훈련/배치현황/해산 탭

## Data Helpers
- `src/world-map/utils.ts`
  - 리소스/인구/프리셋 타입 normalize
  - `PresetMode` includes carriage
  - building resource id (`item:<name>`) 처리 유틸

## API
- `src/api.ts`
  - `updateWorldMap` 등 월드맵 저장 API

## Carriage Implementation Target
1. Manager에 carriage 파생 리스트/상태 추가
2. Overlay 버튼 + CarriageModal 추가
3. 영입 핸들러 추가(비용/보상/저장)
4. presetType carriage가 타일 직접 배치되지 않게 가드

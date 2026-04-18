# Codex Codemap (World Map)

Goal:
- Avoid repeated full-repo scanning.
- Provide fixed entry points for the current feature area.

Primary Entry:
- `src/WorldMapManager.tsx`
  - core state and handlers
  - context assembly (`presetPanelCtx`, `mapModePanelCtx`)

Preset Editor:
- `src/world-map/components/MapPresetsPanel.tsx`
  - preset tabs: tile/building/troop/carriage
  - draft edit UI

Main Map View:
- `src/world-map/components/MapModePanel.tsx`
  - map view composition
  - modal mounting points

Overlay Controls:
- `src/world-map/components/ResourcePopulationOverlay.tsx`
  - resource/population panel actions
  - entry button for troop modal (and carriage modal target)

Existing Troop Runtime Reference:
- `src/world-map/components/TroopModal.tsx`
- `src/WorldMapManager.tsx`
  - `handleStartTroopTraining`
  - `handleCancelTroopTraining`
  - `handleDeployTroopToSelectedTile`
  - `handleWithdrawTroopFromSelectedTile`
  - `handleDisbandTroop`

Utility + Types:
- `src/world-map/utils.ts`
  - normalize helpers
  - resource/id helpers
  - preset mode definitions
- `src/types.ts`
  - world map domain types

API Layer:
- `src/api.ts`
  - `updateWorldMap` and world-map preset APIs

Current Focus Pointers:
- Add carriage runtime path with minimal touch:
  1) `WorldMapManager` (state + recruit handler + context wiring)
  2) `ResourcePopulationOverlay` (button)
  3) `MapModePanel` (new modal mounting)
  4) `CarriageModal` (new)


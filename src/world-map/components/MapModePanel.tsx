// @ts-nocheck
import WorldMapSettingsPanel from "./WorldMapSettingsPanel";
import MapViewportHeader from "./MapViewportHeader";
import ResourcePopulationOverlay from "./ResourcePopulationOverlay";
import MapCanvas from "./MapCanvas";
import TileContextMenu from "./TileContextMenu";
import TileBuildingModal from "./TileBuildingModal";
import TileStateModal from "./TileStateModal";
import TileMemoModal from "./TileMemoModal";
import TileRegionModal from "./TileRegionModal";
import WarehouseModal from "./WarehouseModal";
import PlacementReportModal from "./PlacementReportModal";
import TileYieldModal from "./TileYieldModal";
import ResourceStatusModal from "./ResourceStatusModal";
import TroopModal from "./TroopModal";
import CarriageModal from "./CarriageModal";

type Props = { ctx: any };

export default function MapModePanel({ ctx }: Props) {
  const {
    isReadOnly,
    selectedMap,
    settingsOpen,
    settingsTab,
    busy,
    draft,
    selectedHex,
    activeTileStates,
    presetById,
    activeCityGlobal,
    troopPowerByTile,
    totalPopulation,
    fileInputRef,
    citySettingsFormRef,
    setDraft,
    setSettingsOpen,
    setSettingsTab,
    normalizeHexColor,
    handleDelete,
    handleUploadImage,
    handleSaveDraft,
    handleSaveCityGlobal,
    showTileStatePills,
    showRegionStatusPills,
    showTileNumbering,
    viewMode,
    zoom,
    setShowTileStatePills,
    setShowRegionStatusPills,
    setShowTileNumbering,
    setViewMode,
    setDragging,
    dragRef,
    setZoom,
    resourceOverlayOpen,
    populationOverlayOpen,
    resourceAdjustOpen,
    resourceAdjustTarget,
    resourceAdjustMode,
    resourceAdjustAmount,
    dailyResourceDeltaById,
    warehouseEntries,
    itemCatalogEntries,
    warehouseModalOpen,
    setResourceOverlayOpen,
    setPopulationOverlayOpen,
    setResourceAdjustOpen,
    setWarehouseModalOpen,
    setResourceAdjustTarget,
    setResourceAdjustMode,
    setResourceAdjustAmount,
    handleApplyResourceAdjust,
    handleAddWarehouseItem,
    handleDeleteWarehouseItem,
    handleImportWarehouseItem,
    handleExportWarehouseItem,
    resourceStatusModalOpen,
    setResourceStatusModalOpen,
    resourceStatusRows,
    placementReportOpen,
    setPlacementReportOpen,
    placementPopulationSummary,
    placementReportRows,
    troopCommittedByPreset,
    imageUrl,
    viewportRef,
    dragging,
    handleViewportMouseDown,
    handleViewportMouseMove,
    endDragging,
    handleViewportWheel,
    scheduleVisibleBoundsUpdate,
    imageWidth,
    imageHeight,
    setLoadedSize,
    syncLoadedImageMeta,
    polygons,
    selectedHexKeySet,
    visibleImageBounds,
    tileStateBadgesByKey,
    EMPTY_STATE_BADGES,
    suppressClickRef,
    setTileContextMenu,
    setSelectedHexIfChanged,
    activeTileRegionStates,
    activeTileMemos,
    tileContextMenu,
    tileContextMenuRef,
    handleOpenTileEditor,
    handleOpenTileMemoEditor,
    handleOpenTileRegionEditor,
    handleOpenTileBuildingEditor,
    handleOpenTileTroopEditor,
    handleOpenTileYieldViewer,
    troopModalOpen,
    troopModalScope,
    setTroopModalScope,
    setTroopModalOpen,
    activeTroopPresets,
    troopState,
    handleStartTroopTraining,
    handleCancelTroopTraining,
    handleDeployTroopToSelectedTile,
    handleWithdrawTroopFromSelectedTile,
    handleDisbandTroop,
    carriageModalOpen,
    setCarriageModalOpen,
    activeCarriagePresets,
    handleRecruitCarriage,
    handleCancelCarriageRecruit,
    tileYieldViewer,
    setTileYieldViewer,
    tileYieldRows,
    tileYieldTotals,
    tileBuildingEditor,
    setTileBuildingEditor,
    setTileBuildingSearchQuery,
    tileBuildingSearchInputRef,
    tileBuildingSearchTimerRef,
    tileBuildingWorkersDraftByIdRef,
    tileBuildingSearchQuery,
    filteredBuildingPresetsForTile,
    activeBuildingPresets,
    tileBuildingInstances,
    instanceOperationalById,
    instanceUpkeepWorkersByTypeById,
    instanceUpkeepAnyRequiredById,
    instanceUpkeepAnyAssignedByTypeById,
    handlePlaceBuildingOnTile,
    handleUpdateBuildingWorkers,
    handleToggleBuildingEnabled,
    handleDeleteBuildingOnTile,
    tileEditor,
    setTileEditor,
    tileMemoEditor,
    setTileMemoEditor,
    tileMemoDraftRef,
    activeTilePresets,
    handleTileEditorSave,
    handleTileMemoEditorSave,
    tileRegionEditor,
    setTileRegionEditor,
    tileRegionDraftRef,
    handleTileRegionEditorSave,
  } = ctx;

  if (!selectedMap) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-800 px-4 py-8 text-sm text-zinc-500">
        지도를 먼저 선택해 주세요.
      </div>
    );
  }

  return (
    <>
      <div className={settingsOpen ? "grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]" : ""}>
        <WorldMapSettingsPanel
          settingsOpen={settingsOpen}
          settingsTab={settingsTab}
          busy={busy}
          selectedMap={selectedMap}
          draft={draft}
          selectedHex={selectedHex}
          activeTileStates={activeTileStates}
          presetById={presetById}
          activeCityGlobal={activeCityGlobal}
          totalPopulation={totalPopulation}
          fileInputRef={fileInputRef}
          citySettingsFormRef={citySettingsFormRef}
          setDraft={setDraft}
          setSettingsTab={setSettingsTab}
          normalizeHexColor={normalizeHexColor}
          onDelete={handleDelete}
          onUploadImage={handleUploadImage}
          onSaveDraft={handleSaveDraft}
          onSaveCityGlobal={() => {
            void handleSaveCityGlobal();
          }}
        />

        <div className="relative rounded-xl border border-zinc-800 bg-zinc-950/30 p-4">
          <MapViewportHeader
            mapName={selectedMap.name}
            day={activeCityGlobal.day ?? 0}
            showTileStatePills={showTileStatePills}
            showRegionStatusPills={showRegionStatusPills}
            showTileNumbering={showTileNumbering}
            viewMode={viewMode}
            zoom={zoom}
            onShowTileStatePillsChange={setShowTileStatePills}
            onShowRegionStatusPillsChange={setShowRegionStatusPills}
            onShowTileNumberingChange={setShowTileNumbering}
            onActivateScrollMode={() => {
              setViewMode("scroll");
              setDragging(false);
              dragRef.current.active = false;
            }}
            onActivateDragMode={() => setViewMode("drag")}
            onZoomOut={() => setZoom((prev: number) => Math.max(0.2, prev - 0.1))}
            onZoomIn={() => setZoom((prev: number) => Math.min(2.5, prev + 0.1))}
          />

          <ResourcePopulationOverlay
            readOnly={isReadOnly}
            activeCityGlobal={activeCityGlobal}
            dailyResourceDeltaById={dailyResourceDeltaById}
            resourceOverlayOpen={resourceOverlayOpen}
            populationOverlayOpen={populationOverlayOpen}
            resourceAdjustOpen={resourceAdjustOpen}
            resourceAdjustTarget={resourceAdjustTarget}
            resourceAdjustMode={resourceAdjustMode}
            resourceAdjustAmount={resourceAdjustAmount}
            totalPopulation={totalPopulation}
            busy={busy}
            onToggleResourceOverlay={() => setResourceOverlayOpen((prev: boolean) => !prev)}
            onTogglePopulationOverlay={() => setPopulationOverlayOpen((prev: boolean) => !prev)}
            onToggleResourceAdjust={() => setResourceAdjustOpen((prev: boolean) => !prev)}
            onOpenWarehouseModal={() => setWarehouseModalOpen(true)}
            onResourceAdjustTargetChange={setResourceAdjustTarget}
            onResourceAdjustModeChange={setResourceAdjustMode}
            onResourceAdjustAmountChange={setResourceAdjustAmount}
            onApplyResourceAdjust={handleApplyResourceAdjust}
            onOpenPlacementReport={() => setPlacementReportOpen(true)}
            onOpenResourceStatus={() => setResourceStatusModalOpen(true)}
            onOpenTroopModal={() => {
              setTroopModalScope("full");
              setTroopModalOpen(true);
            }}
            onOpenCarriageModal={() => setCarriageModalOpen(true)}
          />

          <MapCanvas
            ctx={{
              imageUrl,
              viewportRef,
              viewMode,
              dragging,
              handleViewportMouseDown,
              handleViewportMouseMove,
              endDragging,
              handleViewportWheel,
              scheduleVisibleBoundsUpdate,
              imageWidth,
              imageHeight,
              zoom,
              selectedMap,
              setLoadedSize,
              syncLoadedImageMeta,
              polygons,
              selectedHexKeySet,
              selectedHex,
              visibleImageBounds,
              showTileStatePills,
              showTileNumbering,
              tileStateBadgesByKey,
              EMPTY_STATE_BADGES,
              suppressClickRef,
                setTileContextMenu,
                setSelectedHexIfChanged,
                showRegionStatusPills,
                activeTileRegionStates,
                activeTileMemos,
                troopPowerByTile,
              }}
            />
        </div>

        <TileContextMenu
          readOnly={isReadOnly}
          tileContextMenu={tileContextMenu}
          tileContextMenuRef={tileContextMenuRef}
          onOpenTileEditor={handleOpenTileEditor}
          onOpenTileMemoEditor={handleOpenTileMemoEditor}
          onOpenTileRegionEditor={handleOpenTileRegionEditor}
          onOpenTileBuildingEditor={handleOpenTileBuildingEditor}
          onOpenTileTroopEditor={handleOpenTileTroopEditor}
          onOpenTileYieldViewer={handleOpenTileYieldViewer}
        />

        <TileBuildingModal
          tileBuildingEditor={tileBuildingEditor}
          setTileBuildingEditor={setTileBuildingEditor}
          setTileBuildingSearchQuery={setTileBuildingSearchQuery}
          tileBuildingSearchInputRef={tileBuildingSearchInputRef}
          tileBuildingSearchTimerRef={tileBuildingSearchTimerRef}
          tileBuildingWorkersDraftByIdRef={tileBuildingWorkersDraftByIdRef}
          tileBuildingSearchQuery={tileBuildingSearchQuery}
          filteredBuildingPresetsForTile={filteredBuildingPresetsForTile}
          activeBuildingPresets={activeBuildingPresets}
          tileBuildingInstances={tileBuildingInstances}
          instanceOperationalById={instanceOperationalById}
          instanceUpkeepWorkersByTypeById={instanceUpkeepWorkersByTypeById}
          instanceUpkeepAnyRequiredById={instanceUpkeepAnyRequiredById}
          instanceUpkeepAnyAssignedByTypeById={instanceUpkeepAnyAssignedByTypeById}
          busy={busy}
          onPlaceBuilding={handlePlaceBuildingOnTile}
          onUpdateBuildingWorkers={handleUpdateBuildingWorkers}
          onToggleBuildingEnabled={handleToggleBuildingEnabled}
          onDeleteBuildingOnTile={handleDeleteBuildingOnTile}
        />

        <TileStateModal
          tileEditor={tileEditor}
          setTileEditor={setTileEditor}
          presetById={presetById}
          activeTilePresets={activeTilePresets}
          normalizeHexColor={normalizeHexColor}
          onSave={handleTileEditorSave}
        />

        <TileMemoModal
          tileMemoEditor={tileMemoEditor}
          setTileMemoEditor={setTileMemoEditor}
          tileMemoDraftRef={tileMemoDraftRef}
          onSave={handleTileMemoEditorSave}
          busy={busy}
        />

        <TileRegionModal
          tileRegionEditor={tileRegionEditor}
          setTileRegionEditor={setTileRegionEditor}
          tileRegionDraftRef={tileRegionDraftRef}
          onSave={handleTileRegionEditorSave}
          busy={busy}
        />

        <WarehouseModal
          open={warehouseModalOpen}
          readOnly={isReadOnly}
          busy={busy}
          warehouseEntries={warehouseEntries}
          itemCatalogEntries={itemCatalogEntries}
          onClose={() => setWarehouseModalOpen(false)}
          onAddWarehouseItem={handleAddWarehouseItem}
          onDeleteWarehouseItem={handleDeleteWarehouseItem}
          onImportWarehouseItem={handleImportWarehouseItem}
          onExportWarehouseItem={handleExportWarehouseItem}
        />

        <PlacementReportModal
          open={placementReportOpen}
          rows={placementReportRows}
          populationSummary={placementPopulationSummary}
          troopCommittedByPreset={troopCommittedByPreset}
          onClose={() => setPlacementReportOpen(false)}
        />

        <ResourceStatusModal
          open={resourceStatusModalOpen}
          rows={resourceStatusRows}
          onClose={() => setResourceStatusModalOpen(false)}
        />

        <TileYieldModal
          tileYieldViewer={tileYieldViewer}
          setTileYieldViewer={setTileYieldViewer}
          tileYieldRows={tileYieldRows}
          tileYieldTotals={tileYieldTotals}
        />

        <TroopModal
          open={troopModalOpen}
          readOnly={isReadOnly}
          busy={busy}
          map={selectedMap}
          troopState={troopState}
          troopPresets={activeTroopPresets}
          selectedHex={selectedHex}
          scope={troopModalScope}
          onClose={() => {
            setTroopModalOpen(false);
            setTroopModalScope("full");
          }}
          onStartTraining={(presetId, qty) => {
            if (isReadOnly) return;
            void handleStartTroopTraining(presetId, qty);
          }}
          onCancelTraining={(orderId) => {
            if (isReadOnly) return;
            void handleCancelTroopTraining(orderId);
          }}
          onDeployToSelectedTile={(presetId, qty) => {
            if (isReadOnly) return;
            void handleDeployTroopToSelectedTile(presetId, qty);
          }}
          onWithdrawFromSelectedTile={(presetId, qty) => {
            if (isReadOnly) return;
            void handleWithdrawTroopFromSelectedTile(presetId, qty);
          }}
          onDisbandTroop={(presetId, qty) => {
            if (isReadOnly) return;
            void handleDisbandTroop(presetId, qty);
          }}
        />

        <CarriageModal
          open={carriageModalOpen}
          readOnly={isReadOnly}
          busy={busy}
          carriagePresets={activeCarriagePresets}
          carriageQueue={activeCityGlobal?.carriage?.recruiting ?? []}
          onClose={() => setCarriageModalOpen(false)}
          onRecruit={(presetId, qty) => {
            if (isReadOnly) return;
            void handleRecruitCarriage(presetId, qty);
          }}
          onCancelRecruit={(orderId) => {
            if (isReadOnly) return;
            void handleCancelCarriageRecruit(orderId);
          }}
        />
      </div>
    </>
  );
}

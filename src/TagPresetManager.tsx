import { useEffect, useMemo, useState } from "react";
import type { AuthUser, TagPreset, TagPresetFolder, TagPresetKind } from "./types";
import { ansiColorCodeToCss } from "./UnitColor";
import {
  createTagPreset,
  createTagPresetFolder,
  deleteTagPreset,
  deleteTagPresetFolder,
  listTagPresets,
  updateTagPreset,
  updateTagPresetFolder,
} from "./api";

const DEFAULT_TAG_NAME = "새 태그";

const COLOR_OPTIONS = [
  { value: "", label: "없음" },
  { value: "31", label: "빨강 (31)", color: ansiColorCodeToCss(31) },
  { value: "32", label: "초록 (32)", color: ansiColorCodeToCss(32) },
  { value: "33", label: "노랑 (33)", color: ansiColorCodeToCss(33) },
  { value: "34", label: "파랑 (34)", color: ansiColorCodeToCss(34) },
  { value: "35", label: "보라 (35)", color: ansiColorCodeToCss(35) },
  { value: "36", label: "청록 (36)", color: ansiColorCodeToCss(36) },
  { value: "37", label: "기본 (37)" },
  { value: "30", label: "진회색 (30)", color: ansiColorCodeToCss(30) },
];

function FolderGlyph() {
  return (
    <span
      aria-hidden="true"
      className="relative inline-block h-3.5 w-4 rounded-sm border border-zinc-500/60 bg-zinc-900/40"
    >
      <span className="absolute -top-1 left-0.5 h-1.5 w-2.5 rounded-t-sm border border-zinc-500/60 bg-zinc-900/60" />
    </span>
  );
}

function normalizeCount(value: unknown, fallback = 0) {
  const num = Math.trunc(Number(value));
  if (!Number.isFinite(num)) return fallback;
  return num;
}

function normalizeName(value: unknown, fallback: string) {
  const name = String(value ?? "").trim();
  return name.length ? name : fallback;
}

function buildFolderTree(
  folders: TagPresetFolder[],
  query: string,
  collapsed: Record<string, boolean>
) {
  const byParent = new Map<string | null, TagPresetFolder[]>();
  for (const folder of folders) {
    const parentId = folder.parentId ?? null;
    const list = byParent.get(parentId) ?? [];
    list.push(folder);
    byParent.set(parentId, list);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  const q = query.trim().toLowerCase();
  const matches = (folder: TagPresetFolder) =>
    folder.name.toLowerCase().includes(q);
  const hasMatch = (folder: TagPresetFolder): boolean => {
    if (!q) return true;
    if (matches(folder)) return true;
    const children = byParent.get(folder.id) ?? [];
    return children.some(hasMatch);
  };

  const out: Array<{
    folder: TagPresetFolder;
    depth: number;
    hasChildren: boolean;
    collapsed: boolean;
  }> = [];

  const walk = (parentId: string | null, depth: number) => {
    const list = byParent.get(parentId) ?? [];
    for (const folder of list) {
      if (!hasMatch(folder)) continue;
      const children = byParent.get(folder.id) ?? [];
      const isCollapsed = !!collapsed[folder.id];
      out.push({
        folder,
        depth,
        hasChildren: children.length > 0,
        collapsed: isCollapsed,
      });
      if (!isCollapsed) walk(folder.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

function reorderItems<T extends { id: string }>(
  list: T[],
  draggedId: string,
  targetId: string
) {
  if (draggedId === targetId) return list;
  const fromIndex = list.findIndex((item) => item.id === draggedId);
  const toIndex = list.findIndex((item) => item.id === targetId);
  if (fromIndex < 0 || toIndex < 0) return list;

  const next = list.slice();
  const [dragged] = next.splice(fromIndex, 1);
  const insertIndex = Math.min(Math.max(toIndex, 0), next.length);
  next.splice(insertIndex, 0, dragged);
  return next;
}

export default function TagPresetManager(props: {
  authUser: AuthUser | null;
  onBack: () => void;
}) {
  const { authUser, onBack } = props;
  const [folders, setFolders] = useState<TagPresetFolder[]>([]);
  const [presets, setPresets] = useState<TagPreset[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [folderQuery, setFolderQuery] = useState("");
  const [presetQuery, setPresetQuery] = useState("");
  const [folderMenu, setFolderMenu] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const [dragging, setDragging] = useState<{
    type: "folder" | "preset";
    id: string;
  } | null>(null);
  const [folderDropId, setFolderDropId] = useState<string | null>(null);
  const [presetDropId, setPresetDropId] = useState<string | null>(null);
  const [collapsedFolders, setCollapsedFolders] = useState<
    Record<string, boolean>
  >({});

  const [name, setName] = useState("");
  const [kind, setKind] = useState<TagPresetKind>("toggle");
  const [decStart, setDecStart] = useState(false);
  const [decEnd, setDecEnd] = useState(false);
  const [colorCode, setColorCode] = useState("");
  const [presetFolderId, setPresetFolderId] = useState<string | null>(null);

  const selectedPreset = useMemo(
    () => presets.find((preset) => preset.id === selectedPresetId) ?? null,
    [presets, selectedPresetId]
  );

  const colorCodeTextColor =
    colorCode.trim() && colorCode.trim() !== "37"
      ? ansiColorCodeToCss(Number(colorCode))
      : undefined;

  const activeMenuFolder = useMemo(
    () => (folderMenu ? folders.find((f) => f.id === folderMenu.id) : null),
    [folderMenu, folders]
  );

  const visiblePresets = useMemo(() => {
    const query = presetQuery.trim().toLowerCase();
    const list =
      selectedFolderId === null
        ? presets
        : presets.filter((preset) => preset.folderId === selectedFolderId);
    const filtered = query
      ? list.filter((preset) =>
          (preset.name ?? "").toLowerCase().includes(query)
        )
      : list;
    return [...filtered].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [presets, selectedFolderId, presetQuery]);

  const folderTree = useMemo(
    () => buildFolderTree(folders, folderQuery, collapsedFolders),
    [folders, folderQuery, collapsedFolders]
  );
  const allFolderTree = useMemo(
    () => buildFolderTree(folders, "", {}),
    [folders]
  );

  useEffect(() => {
    if (!authUser) return;
    void loadPresets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser?.id]);

  useEffect(() => {
    if (!selectedPreset) {
      setName("");
      setKind("toggle");
      setDecStart(false);
      setDecEnd(false);
      setColorCode("");
      setPresetFolderId(null);
      return;
    }

    setName(selectedPreset.name ?? "");
    setKind(selectedPreset.kind ?? "toggle");
    setDecStart(!!selectedPreset.decOnTurnStart);
    setDecEnd(!!selectedPreset.decOnTurnEnd);
    setColorCode(
      typeof selectedPreset.colorCode === "number"
        ? String(selectedPreset.colorCode)
        : ""
    );
    setPresetFolderId(selectedPreset.folderId ?? null);
  }, [selectedPreset?.id]);

  async function loadPresets(preferId?: string) {
    setBusy(true);
    try {
      setErr(null);
      const res = (await listTagPresets()) as {
        folders: TagPresetFolder[];
        presets: TagPreset[];
      };
      setFolders(res.folders ?? []);
      setPresets(res.presets ?? []);

      const nextId = preferId ?? selectedPresetId;
      if (nextId && res.presets.some((p) => p.id === nextId)) {
        setSelectedPresetId(nextId);
      } else {
        setSelectedPresetId(res.presets[0]?.id ?? null);
      }
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  function nextFolderOrder(parentId: string | null) {
    return folders.filter((f) => (f.parentId ?? null) === parentId).length;
  }

  async function handleCreateFolder(parentId?: string | null) {
    if (busy) return;
    const name = window.prompt("폴더 이름", "새 폴더");
    if (name === null) return;
    const normalizedParent = parentId ?? null;
    setBusy(true);
    try {
      setErr(null);
      const created = (await createTagPresetFolder({
        name,
        order: nextFolderOrder(normalizedParent),
        parentId: normalizedParent,
      })) as TagPresetFolder;
      setFolders((prev) => [...prev, created]);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function handleRenameFolder(folder: TagPresetFolder) {
    if (busy) return;
    const name = window.prompt("폴더 이름", folder.name ?? "");
    if (name === null) return;
    setBusy(true);
    try {
      setErr(null);
      const updated = (await updateTagPresetFolder(folder.id, {
        name,
      })) as TagPresetFolder;
      setFolders((prev) => prev.map((f) => (f.id === folder.id ? updated : f)));
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteFolder(folder: TagPresetFolder) {
    if (busy) return;
    const ok = window.confirm(
      "폴더를 삭제할까요? 프리셋은 폴더에서 분리됩니다."
    );
    if (!ok) return;
    setBusy(true);
    try {
      setErr(null);
      await deleteTagPresetFolder(folder.id);
      setFolders((prev) => prev.filter((f) => f.id !== folder.id));
      setPresets((prev) =>
        prev.map((p) =>
          p.folderId === folder.id ? { ...p, folderId: null } : p
        )
      );
      if (selectedFolderId === folder.id) setSelectedFolderId(null);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function handleCreatePreset() {
    if (busy) return;
    const name = window.prompt("태그 이름", DEFAULT_TAG_NAME);
    if (name === null) return;
    setBusy(true);
    try {
      setErr(null);
      const presetOrder = presets.filter(
        (preset) => (preset.folderId ?? null) === selectedFolderId
      ).length;
      const created = (await createTagPreset({
        name,
        folderId: selectedFolderId,
        order: presetOrder,
        kind: "toggle",
      })) as TagPreset;
      setPresets((prev) => [created, ...prev]);
      setSelectedPresetId(created.id);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function handleDeletePreset() {
    if (!selectedPreset || busy) return;
    const ok = window.confirm("태그 프리셋을 삭제할까요?");
    if (!ok) return;
    setBusy(true);
    try {
      setErr(null);
      await deleteTagPreset(selectedPreset.id);
      setPresets((prev) => prev.filter((p) => p.id !== selectedPreset.id));
      setSelectedPresetId(null);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  function openFolderMenu(folderId: string, x: number, y: number) {
    setFolderMenu({ id: folderId, x, y });
  }

  async function reorderFolder(draggedId: string, targetId: string) {
    if (busy) return;
    const dragged = folders.find((f) => f.id === draggedId);
    const target = folders.find((f) => f.id === targetId);
    if (!dragged || !target) return;
    const parentId = target.parentId ?? null;
    if ((dragged.parentId ?? null) !== parentId) return;

    const siblings = folders
      .filter((f) => (f.parentId ?? null) === parentId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const next = reorderItems(siblings, draggedId, targetId).map(
      (folder, index) => ({ ...folder, order: index })
    );

    setFolders((prev) =>
      prev.map((item) => next.find((f) => f.id === item.id) ?? item)
    );

    setBusy(true);
    try {
      await Promise.all(
        next.map((folder) =>
          updateTagPresetFolder(folder.id, { order: folder.order })
        )
      );
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function reorderPreset(draggedId: string, targetId: string) {
    if (busy) return;
    const dragged = presets.find((preset) => preset.id === draggedId);
    const target = presets.find((preset) => preset.id === targetId);
    if (!dragged || !target) return;
    const folderId = target.folderId ?? null;
    if ((dragged.folderId ?? null) !== folderId) return;
    const siblings = presets
      .filter((preset) => (preset.folderId ?? null) === folderId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const next = reorderItems(siblings, draggedId, targetId).map(
      (preset, index) => ({ ...preset, order: index })
    );

    setPresets((prev) =>
      prev.map((item) => next.find((p) => p.id === item.id) ?? item)
    );

    setBusy(true);
    try {
      await Promise.all(
        next.map((preset) =>
          updateTagPreset(preset.id, { order: preset.order ?? 0 })
        )
      );
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  function isPresetDragEvent(e: React.DragEvent) {
    if (dragging?.type === "preset") return true;
    return Array.from(e.dataTransfer.types).includes("application/x-mbot-tag");
  }

  function getPresetDragId(e: React.DragEvent) {
    if (dragging?.type === "preset") return dragging.id;
    const raw =
      e.dataTransfer.getData("application/x-mbot-tag") ||
      e.dataTransfer.getData("text/plain");
    return raw || null;
  }

  async function movePresetToFolder(draggedId: string, folderId: string | null) {
    if (busy) return;
    const dragged = presets.find((p) => p.id === draggedId);
    if (!dragged) return;
    const oldFolderId = dragged.folderId ?? null;
    if (oldFolderId === folderId) return;

    const nextOrder = presets.filter(
      (preset) => (preset.folderId ?? null) === folderId
    ).length;

    const nextPresets = presets.map((preset) =>
      preset.id === draggedId
        ? { ...preset, folderId, order: nextOrder }
        : preset
    );

    const reindex = (list: TagPreset[]) =>
      list
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((preset, index) => ({ ...preset, order: index }));

    const updatedOld = reindex(
      nextPresets.filter((p) => (p.folderId ?? null) === oldFolderId)
    );
    const updatedNew = reindex(
      nextPresets.filter((p) => (p.folderId ?? null) === folderId)
    );

    const updates = new Map<string, TagPreset>();
    for (const preset of [...updatedOld, ...updatedNew]) {
      updates.set(preset.id, preset);
    }

    setPresets((prev) => prev.map((p) => updates.get(p.id) ?? p));

    setBusy(true);
    try {
      await Promise.all(
        [...updates.values()].map((preset) =>
          updateTagPreset(preset.id, {
            order: preset.order ?? 0,
            folderId: preset.folderId ?? null,
          })
        )
      );
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function handleSavePreset() {
    if (!selectedPreset || busy) return;

    const nextName = normalizeName(name, DEFAULT_TAG_NAME);
    const nextFolderId = presetFolderId ?? null;
    const nextOrder =
      (selectedPreset.folderId ?? null) === nextFolderId
        ? selectedPreset.order ?? 0
        : presets.filter(
            (preset) =>
              (preset.folderId ?? null) === nextFolderId &&
              preset.id !== selectedPreset.id
          ).length;
    setBusy(true);
    try {
      setErr(null);
      const updated = (await updateTagPreset(selectedPreset.id, {
        name: nextName,
        kind,
        decOnTurnStart: kind === "stack" ? decStart : false,
        decOnTurnEnd: kind === "stack" ? decEnd : false,
        colorCode: colorCode.trim() ? normalizeCount(colorCode, 0) : null,
        folderId: nextFolderId,
        order: nextOrder,
      })) as TagPreset;
      setPresets((prev) =>
        prev.map((p) => (p.id === selectedPreset.id ? updated : p))
      );
      setName(updated.name ?? nextName);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-6xl p-4">
        <header className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-xl font-semibold">태그 프리셋 관리</div>
            <div className="text-xs text-zinc-500">
              자주 쓰는 태그를 폴더로 정리할 수 있습니다.
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-300">
            {authUser ? <span>{authUser.username}</span> : null}
            <button
              type="button"
              className="rounded-md border border-zinc-800 px-2 py-1 text-xs text-zinc-200 hover:border-zinc-600"
              onClick={onBack}
              disabled={busy}
            >
              세션 목록
            </button>
          </div>
        </header>

        {err && (
          <div className="mb-4 whitespace-pre-line rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-200">
            {err}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="space-y-3">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs font-semibold text-zinc-200">폴더</div>
                <button
                  type="button"
                  className="rounded-md border border-amber-700/60 bg-amber-950/30 px-2 py-1 text-[11px] text-amber-200 hover:bg-amber-900/40"
                  onClick={() => handleCreateFolder(null)}
                  disabled={busy}
                >
                  새 폴더
                </button>
              </div>
              <input
                value={folderQuery}
                onChange={(e) => setFolderQuery(e.target.value)}
                placeholder="폴더 검색"
                className="mb-2 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-zinc-600"
              />
              <div className="space-y-1">
                <div
                  className={[
                    "flex items-center justify-between rounded-md px-2 py-1.5 text-left text-xs",
                    selectedFolderId === null
                      ? "bg-zinc-800/80 text-zinc-100"
                      : "text-zinc-400 hover:bg-zinc-800/40",
                  ].join(" ")}
                  onClick={() => setSelectedFolderId(null)}
                  onKeyDown={(e) => e.key === "Enter" && setSelectedFolderId(null)}
                  role="button"
                  tabIndex={0}
                  onDragOver={(e) => {
                    if (!isPresetDragEvent(e)) return;
                    e.preventDefault();
                    setFolderDropId(null);
                  }}
                  onDrop={(e) => {
                    if (!isPresetDragEvent(e)) return;
                    e.preventDefault();
                    const draggedId = getPresetDragId(e);
                    if (draggedId) movePresetToFolder(draggedId, null);
                  }}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-[11px] text-zinc-500">전체</span>
                  </span>
                </div>
                {folderTree.map(({ folder, depth, hasChildren, collapsed }) => {
                  const isActive = selectedFolderId === folder.id;
                  const isDropTarget = folderDropId === folder.id;
                  return (
                    <div
                      key={folder.id}
                      className={[
                        "flex items-center justify-between rounded-md px-2 py-1.5 text-left text-xs",
                        isActive
                          ? "bg-zinc-800/80 text-zinc-100"
                          : "text-zinc-300 hover:bg-zinc-800/40",
                        isDropTarget ? "ring-1 ring-amber-400/60" : "",
                      ].join(" ")}
                      style={{ paddingLeft: 8 + depth * 12 }}
                      role="button"
                      tabIndex={0}
                      draggable
                      onClick={() => setSelectedFolderId(folder.id)}
                      onKeyDown={(e) =>
                        e.key === "Enter" && setSelectedFolderId(folder.id)
                      }
                      onContextMenu={(e) => {
                        e.preventDefault();
                        openFolderMenu(folder.id, e.clientX, e.clientY);
                      }}
                      onDragStart={(e) => {
                        setDragging({ type: "folder", id: folder.id });
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", folder.id);
                      }}
                      onDragEnd={() => {
                        setDragging(null);
                        setFolderDropId(null);
                      }}
                      onDragOver={(e) => {
                        if (dragging?.type === "folder") {
                          e.preventDefault();
                          setFolderDropId(folder.id);
                          return;
                        }
                        if (isPresetDragEvent(e)) {
                          e.preventDefault();
                          setFolderDropId(folder.id);
                        }
                      }}
                      onDragLeave={() => {
                        if (folderDropId === folder.id) setFolderDropId(null);
                      }}
                      onDrop={(e) => {
                        if (dragging?.type === "folder") {
                          e.preventDefault();
                          setFolderDropId(null);
                          reorderFolder(dragging.id, folder.id);
                          return;
                        }
                        if (!isPresetDragEvent(e)) return;
                        e.preventDefault();
                        const draggedId = getPresetDragId(e);
                        setFolderDropId(null);
                        if (draggedId) movePresetToFolder(draggedId, folder.id);
                      }}
                    >
                      <span className="flex items-center gap-2">
                        {hasChildren ? (
                          <button
                            type="button"
                            className="text-[10px] text-zinc-500"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCollapsedFolders((prev) => ({
                                ...prev,
                                [folder.id]: !collapsed,
                              }));
                            }}
                          >
                            {collapsed ? "+" : "-"}
                          </button>
                        ) : (
                          <span className="w-3" />
                        )}
                        <FolderGlyph />
                        <span>{folder.name}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs font-semibold text-zinc-200">
                  태그 목록
                </div>
                <button
                  type="button"
                  className="rounded-md border border-amber-700/60 bg-amber-950/30 px-2 py-1 text-[11px] text-amber-200 hover:bg-amber-900/40"
                  onClick={handleCreatePreset}
                  disabled={busy}
                >
                  새 태그
                </button>
              </div>
              <input
                value={presetQuery}
                onChange={(e) => setPresetQuery(e.target.value)}
                placeholder="태그 검색"
                className="mb-2 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-zinc-600"
              />
              <div className="max-h-[60vh] space-y-1 overflow-y-auto pr-1">
                {visiblePresets.length === 0 ? (
                  <div className="rounded-md border border-zinc-800 bg-zinc-950/40 p-3 text-xs text-zinc-500">
                    표시할 태그가 없습니다.
                  </div>
                ) : (
                  visiblePresets.map((preset) => {
                    const isActive = preset.id === selectedPresetId;
                    const presetColor =
                      typeof preset.colorCode === "number" &&
                      preset.colorCode !== 37
                        ? ansiColorCodeToCss(preset.colorCode)
                        : undefined;
                    return (
                      <div
                        key={preset.id}
                        className={[
                          "flex items-center justify-between rounded-md border px-2 py-1.5 text-xs",
                          isActive
                            ? "border-amber-500/60 bg-amber-950/30"
                            : "border-zinc-800 bg-zinc-950/40 hover:border-zinc-600",
                          presetDropId === preset.id
                            ? "ring-1 ring-amber-400/60"
                            : "",
                        ].join(" ")}
                        draggable
                        onClick={() => setSelectedPresetId(preset.id)}
                        onDragStart={(e) => {
                          setDragging({ type: "preset", id: preset.id });
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData(
                            "application/x-mbot-tag",
                            preset.id
                          );
                        }}
                        onDragEnd={() => {
                          setDragging(null);
                          setPresetDropId(null);
                        }}
                        onDragOver={(e) => {
                          if (!isPresetDragEvent(e)) return;
                          e.preventDefault();
                          setPresetDropId(preset.id);
                        }}
                        onDragLeave={() => {
                          if (presetDropId === preset.id) setPresetDropId(null);
                        }}
                        onDrop={(e) => {
                          if (!isPresetDragEvent(e)) return;
                          e.preventDefault();
                          const draggedId = getPresetDragId(e);
                          setPresetDropId(null);
                          if (draggedId) reorderPreset(draggedId, preset.id);
                        }}
                      >
                        <div>
                          <div
                            className="text-sm font-semibold"
                            style={presetColor ? { color: presetColor } : undefined}
                          >
                            {preset.name}
                          </div>
                          <div className="text-[11px] text-zinc-500">
                            {preset.kind === "stack" ? "스택형" : "토글형"}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </aside>

          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="mb-3 text-sm font-semibold text-zinc-200">
              태그 편집
            </div>
            {!selectedPreset ? (
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4 text-sm text-zinc-500">
                왼쪽에서 태그 프리셋을 선택하거나 새로 만들어 주세요.
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs text-zinc-400">
                    태그 이름
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-zinc-600"
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs text-zinc-400">
                      태그 종류
                    </label>
                    <select
                      value={kind}
                      onChange={(e) =>
                        setKind(
                          e.target.value === "stack" ? "stack" : "toggle"
                        )
                      }
                      className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-zinc-600"
                    >
                      <option value="toggle">토글형</option>
                      <option value="stack">스택형</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-zinc-400">
                      폴더
                    </label>
                    <select
                      value={presetFolderId ?? ""}
                      onChange={(e) =>
                        setPresetFolderId(e.target.value || null)
                      }
                      disabled={busy}
                      className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-zinc-600"
                    >
                      <option value="">폴더 없음</option>
                      {allFolderTree.map(({ folder, depth }) => (
                        <option key={folder.id} value={folder.id}>
                          {`${"—".repeat(depth)}${depth ? " " : ""}${
                            folder.name
                          }`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-zinc-400">
                      컬러 코드
                    </label>
                    <select
                      value={colorCode}
                      onChange={(e) => setColorCode(e.target.value)}
                      disabled={busy}
                      style={
                        colorCodeTextColor
                          ? { color: colorCodeTextColor }
                          : undefined
                      }
                      className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 text-sm outline-none focus:border-zinc-600"
                    >
                      {COLOR_OPTIONS.map((opt) => (
                        <option
                          key={opt.value || "none"}
                          value={opt.value}
                          style={opt.color ? { color: opt.color } : undefined}
                        >
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {kind === "stack" ? (
                  <div className="rounded-md border border-zinc-800 bg-zinc-950/40 p-3">
                    <div className="mb-2 text-xs font-semibold text-zinc-300">
                      스택 옵션
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-zinc-300">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={decStart}
                          onChange={(e) => setDecStart(e.target.checked)}
                        />
                        턴 시작 시 감소
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={decEnd}
                          onChange={(e) => setDecEnd(e.target.checked)}
                        />
                        턴 종료 시 감소
                      </label>
                    </div>
                  </div>
                ) : null}

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    className="rounded-md border border-zinc-800 px-3 py-1.5 text-xs text-zinc-200 hover:border-zinc-600 disabled:opacity-50"
                    onClick={handleDeletePreset}
                    disabled={busy}
                  >
                    삭제
                  </button>
                  <button
                    type="button"
                    className="rounded-md bg-amber-700 px-3 py-1.5 text-xs text-white hover:bg-amber-600 disabled:opacity-50"
                    onClick={handleSavePreset}
                    disabled={busy}
                  >
                    저장
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>

        {folderMenu && activeMenuFolder && (
          <div
            className="fixed inset-0 z-50"
            onClick={() => setFolderMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setFolderMenu(null);
            }}
            role="presentation"
          >
            <div
              className="absolute z-50 min-w-[140px] rounded-lg border border-zinc-700 bg-zinc-900 p-1 text-xs shadow-xl"
              style={{ top: folderMenu.y, left: folderMenu.x }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="w-full rounded-md px-2 py-1 text-left text-zinc-200 hover:bg-zinc-800/80"
                onClick={() => {
                  setFolderMenu(null);
                  handleCreateFolder(activeMenuFolder.id);
                }}
              >
                하위 폴더 추가
              </button>
              <button
                type="button"
                className="w-full rounded-md px-2 py-1 text-left text-zinc-200 hover:bg-zinc-800/80"
                onClick={() => {
                  setFolderMenu(null);
                  handleRenameFolder(activeMenuFolder);
                }}
              >
                이름 변경
              </button>
              <button
                type="button"
                className="w-full rounded-md px-2 py-1 text-left text-red-300 hover:bg-red-950/50"
                onClick={() => {
                  setFolderMenu(null);
                  handleDeleteFolder(activeMenuFolder);
                }}
              >
                삭제
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

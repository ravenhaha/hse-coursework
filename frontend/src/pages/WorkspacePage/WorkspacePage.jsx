import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Workspace/components/Sidebar/Sidebar';
import Workspace from '../../components/Workspace/Workspace.jsx';
import ProfileModal from '../../components/ProfileModal/ProfileModal';
import MaterialViewerModal from '../../components/MaterialViewerModal/MaterialViewerModal';
import DeleteAccountModal from '../../components/DeleteAccountModal/DeleteAccountModal';
import { useAuth } from '../../hooks/useAuth';
import useCollections from '../../hooks/useCollections';
import useMaterials from '../../hooks/useMaterials';
import useGraph from '../../hooks/useGraph';
import { useModal } from '../../hooks/useModal.js';
import { usersApi } from '../../api/users';
import { graphApi } from '../../api/graph';
import styles from './WorkspacePage.module.css';

const HINT_FIRST_COLLECTION_KEY = 'omut_hint_first_collection_shown';

function mergeTree(collections, materials) {
  const byCollection = {};
  for (const m of materials) {
    const cid = m.raw?.collection_id;
    if (cid == null) continue;
    if (!byCollection[cid]) byCollection[cid] = [];
    byCollection[cid].push(m);
  }
  function walk(nodes) {
    return nodes.map((node) => ({
      ...node,
      children: [
        ...walk(node.children || []),
        ...(byCollection[node.id] || []),
      ],
    }));
  }
  return walk(collections);
}

function buildCollectionsSignature(nodes) {
  const parts = [];
  const walk = (list, parentId = 0) => {
    for (const n of list) {
      parts.push(`${n.id}:${parentId}:${n.name ?? ''}`);
      if (n.children?.length) walk(n.children, n.id);
    }
  };
  walk(nodes);
  return parts.join('|');
}

function buildMaterialsSignature(materials) {
  return materials
    .map(
      (m) =>
        `${m.id}:${m.collectionId ?? m.raw?.collection_id ?? 0}:${m.name ?? ''}`,
    )
    .join('|');
}

// 🆕 ИСПРАВЛЕНИЕ БАГА №3
// Граф присылает id в формате "material:9" / "collection:3".
// Достаём из строки число.
function parseGraphMaterialId(rawId) {
  if (rawId == null) return null;
  if (typeof rawId === 'number') return rawId;
  const s = String(rawId);
  const m = s.match(/(\d+)$/);
  return m ? Number(m[1]) : null;
}

export default function WorkspacePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const {
    collections,
    loading: collectionsLoading,
    create: createCollection,
    rename: renameCollection,
    remove: removeCollection,
    move: moveCollection,
    reload: reloadCollections,
  } = useCollections();

  const {
    materials,
    create: createMaterial,
    rename: renameMaterial,
    remove: removeMaterial,
    removeByCollectionIds,
    move: moveMaterial,
    reload: reloadMaterials,
  } = useMaterials();

  const { loadTree, clearTree } = useGraph();

  const collectionsSig = useMemo(
    () => buildCollectionsSignature(collections),
    [collections],
  );
  const materialsSig = useMemo(
    () => buildMaterialsSignature(materials),
    [materials],
  );

  useEffect(() => {
    let cancelled = false;
    graphApi
      .tree()
      .then((data) => { if (!cancelled) loadTree(data); })
      .catch((err) => console.error('Не удалось загрузить граф:', err.message));
    return () => { cancelled = true; };
  }, [loadTree, collectionsSig, materialsSig]);

  useEffect(() => clearTree, [clearTree]);

  // ── UI state ──
  const [activeItemId, setActiveItemId] = useState(null);
  const [previewMaterial, setPreviewMaterial] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [homeOpen, setHomeOpen] = useState(true);
  const materialModal = useModal();

  const homeAutoInitedRef = useRef(false);
  const sidebarRef = useRef(null);

  const [hintShown, setHintShown] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(HINT_FIRST_COLLECTION_KEY) === '1';
  });

  const markHintShown = useCallback(() => {
    if (!hintShown) {
      window.localStorage.setItem(HINT_FIRST_COLLECTION_KEY, '1');
      setHintShown(true);
    }
  }, [hintShown]);

  // ── SOFT-DELETE ──
  const [pendingDeletes, setPendingDeletes] = useState(() => new Map());

  const collectCollectionBranch = useCallback(
    (rootId, nodes = collections) => {
      const ids = [];
      const walk = (list) => {
        for (const n of list) {
          if (n.id === rootId) {
            const collectAll = (x) => {
              ids.push(x.id);
              (x.children || []).forEach((c) => {
                if (c.type === 'folder') collectAll(c);
              });
            };
            collectAll(n);
            return true;
          }
          if (n.children?.length && walk(n.children)) return true;
        }
        return false;
      };
      walk(nodes);
      return ids;
    },
    [collections],
  );

  const hiddenIds = useMemo(() => {
    const hiddenColl = new Set();
    const hiddenMat = new Set();
    for (const p of pendingDeletes.values()) {
      p.hiddenCollectionIds?.forEach((id) => hiddenColl.add(Number(id)));
      p.hiddenMaterialIds?.forEach((id) => hiddenMat.add(Number(id)));
    }
    return { hiddenColl, hiddenMat };
  }, [pendingDeletes]);

  const visibleCollections = useMemo(() => {
    const { hiddenColl } = hiddenIds;
    if (hiddenColl.size === 0) return collections;
    const walk = (nodes) =>
      nodes
        .filter((n) => !hiddenColl.has(Number(n.id)))
        .map((n) => ({ ...n, children: walk(n.children || []) }));
    return walk(collections);
  }, [collections, hiddenIds]);

  const visibleMaterials = useMemo(() => {
    const { hiddenColl, hiddenMat } = hiddenIds;
    if (hiddenColl.size === 0 && hiddenMat.size === 0) return materials;
    return materials.filter(
      (m) =>
        !hiddenMat.has(Number(m.id)) &&
        !hiddenColl.has(Number(m.collectionId ?? m.raw?.collection_id)),
    );
  }, [materials, hiddenIds]);

  const collectionsTree = useMemo(
    () => mergeTree(visibleCollections, visibleMaterials),
    [visibleCollections, visibleMaterials],
  );

  useEffect(() => {
    if (collectionsLoading) return;
    if (homeAutoInitedRef.current) return;
    homeAutoInitedRef.current = true;
    if (collections.length > 0) setHomeOpen(false);
  }, [collectionsLoading, collections.length]);

  useEffect(() => {
    if (!homeOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape' && collections.length > 0) setHomeOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [homeOpen, collections.length]);

  // ── Навигация ──
  const handleSelectItem = useCallback(
    (id, type = 'document') => {
      setActiveItemId(id);
      setHomeOpen(false);
      if (type === 'folder') { setPreviewMaterial(null); return; }
      const mat = materials.find((m) => m.id === id);
      if (mat) setPreviewMaterial(mat);
    },
    [materials],
  );

  // 🆕 ИСПРАВЛЕНИЕ БАГА №3
  // Открытие материала из графа.
  // Graph даёт id в виде "material:9" — чистим до integer
  // и ищем материал в локальном состоянии.
  const handleOpenMaterialFromGraph = useCallback(
    (rawId) => {
      const numId = parseGraphMaterialId(rawId);
      if (numId == null) {
        console.warn('Не удалось распарсить id материала из графа:', rawId);
        return;
      }
      const mat = materials.find((m) => Number(m.id) === numId);
      if (!mat) {
        console.warn('Материал из графа не найден в локальном состоянии:', numId);
        return;
      }
      setActiveItemId(mat.id);
      setHomeOpen(false);
      setPreviewMaterial(mat);
    },
    [materials],
  );

  const handleNavigateHome = useCallback(() => {
    setHomeOpen(true);
    setActiveItemId(null);
    setPreviewMaterial(null);
  }, []);

  const handleCloseHome = useCallback(() => setHomeOpen(false), []);

  // ── КОЛЛЕКЦИИ ──
  const handleCreateCollection = useCallback(
    async (name) => {
      try {
        await createCollection(name);
        markHintShown();
      } catch (err) {
        console.error('Не удалось создать коллекцию:', err.message);
        throw err;
      }
    },
    [createCollection, markHintShown],
  );

  const handleStartCreateCollection = useCallback(() => {
    sidebarRef.current?.startCreateCollection?.();
  }, []);

  const handleCreateSubcollection = useCallback(
    async (parentId, name) => {
      try {
        await createCollection(name, parentId);
      } catch (err) {
        console.error('Не удалось создать подколлекцию:', err.message);
        if (err?.status === 404) await reloadCollections();
        throw err;
      }
    },
    [createCollection, reloadCollections],
  );

  // ── МАТЕРИАЛЫ ──
  const handleAddMaterial = useCallback(
    async (data) => {
      try {
        const created = await createMaterial(data);
        if (created?.id) {
          setActiveItemId(created.id);
          setHomeOpen(false);
        }
        return created;
      } catch (err) {
        console.error('Не удалось добавить материал:', err.message, err);
        if (err?.status === 404 || err?.status === 403) {
          await reloadCollections();
          await reloadMaterials();
        }
        throw err;
      }
    },
    [createMaterial, reloadCollections, reloadMaterials],
  );

  const handleAddMaterialToFolder = useCallback(
    async (folderId, data) => {
      try {
        const created = await createMaterial({ ...data, collection: folderId });
        if (created?.id) {
          setActiveItemId(created.id);
          setHomeOpen(false);
        }
        return created;
      } catch (err) {
        console.error('Не удалось добавить материал в папку:', err.message, err);
        if (err?.status === 404 || err?.status === 403) {
          await reloadCollections();
          await reloadMaterials();
        }
        throw err;
      }
    },
    [createMaterial, reloadCollections, reloadMaterials],
  );

  const handleRenameItem = useCallback(
    async (id, newName, type) => {
      try {
        if (type === 'folder') await renameCollection(id, newName);
        else await renameMaterial(id, newName);
      } catch (err) {
        console.error('Не удалось переименовать:', err.message);
      }
    },
    [renameCollection, renameMaterial],
  );

  // ── SOFT-DELETE ──
  const handleDeleteItem = useCallback(
    (id, type) => {
      const numId = Number(id);
      if (type === 'folder') {
        const branch = collectCollectionBranch(numId);
        const branchSet = new Set(branch.map(Number));
        const hiddenMaterialIds = materials
          .filter((m) =>
            branchSet.has(Number(m.collectionId ?? m.raw?.collection_id)),
          )
          .map((m) => m.id);
        setPendingDeletes((prev) => {
          const next = new Map(prev);
          next.set(numId, {
            type: 'folder',
            hiddenCollectionIds: branch,
            hiddenMaterialIds,
          });
          return next;
        });
      } else {
        setPendingDeletes((prev) => {
          const next = new Map(prev);
          next.set(numId, {
            type: 'document',
            hiddenCollectionIds: [],
            hiddenMaterialIds: [numId],
          });
          return next;
        });
      }
      if (activeItemId === id) setActiveItemId(null);
      if (previewMaterial?.id === id) setPreviewMaterial(null);
    },
    [collectCollectionBranch, materials, activeItemId, previewMaterial],
  );

  const handleRestoreItem = useCallback((item) => {
    setPendingDeletes((prev) => {
      const next = new Map(prev);
      next.delete(Number(item.id));
      return next;
    });
  }, []);

  const handleCommitDelete = useCallback(
    async (id, type) => {
      const numId = Number(id);
      setPendingDeletes((prev) => {
        const next = new Map(prev);
        next.delete(numId);
        return next;
      });
      try {
        if (type === 'folder') {
          const affectedIds = await removeCollection(numId);
          removeByCollectionIds(affectedIds);
        } else {
          await removeMaterial(numId);
        }
      } catch (err) {
        console.error('Не удалось удалить на сервере:', err);
        if (err?.status !== 404) {
          await reloadCollections();
          await reloadMaterials();
        }
      }
    },
    [
      removeCollection,
      removeMaterial,
      removeByCollectionIds,
      reloadCollections,
      reloadMaterials,
    ],
  );

  const handleMoveItem = useCallback(
    async (id, type, newParentId) => {
      try {
        if (type === 'folder') {
          await moveCollection(id, newParentId);
        } else {
          if (newParentId == null) return;
          await moveMaterial(id, newParentId);
        }
      } catch (err) {
        console.error('Не удалось переместить:', err.message, err);
        if (err?.status === 404 || err?.status === 409) {
          await reloadCollections();
          await reloadMaterials();
        }
      }
    },
    [moveCollection, moveMaterial, reloadCollections, reloadMaterials],
  );

  const handleLogout = useCallback(async () => {
    await logout();
  }, [logout]);

  const handleConfirmDeleteAccount = useCallback(async () => {
    await usersApi.deleteAccount();
    setDeleteAccountOpen(false);
    setSettingsOpen(false);
    try {
      await logout();
    } catch {
      /* игнор */
    }
    navigate('/login', { replace: true });
  }, [logout, navigate]);

  const countCollections = (nodes) => {
    let count = 0;
    for (const n of nodes) {
      count += 1;
      if (n.children?.length) {
        const folders = n.children.filter((c) => c.type === 'folder');
        count += countCollections(folders);
      }
    }
    return count;
  };

  const stats = {
    collections: countCollections(visibleCollections),
    materials: visibleMaterials.length,
  };

  const isFirstCollection = collections.length === 0 && !hintShown;
  const canCloseHome = collections.length > 0;

  return (
    <div className={styles.layout}>
      <Sidebar
        ref={sidebarRef}
        collections={collectionsTree}
        pureCollections={visibleCollections}
        materials={visibleMaterials}
        user={user}
        activeItemId={activeItemId}
        homeOpen={homeOpen}
        isFirstCollection={isFirstCollection}
        onSelectItem={handleSelectItem}
        onNavigateHome={handleNavigateHome}
        onCreateCollection={handleCreateCollection}
        onCreateSubcollection={handleCreateSubcollection}
        onAddMaterial={handleAddMaterial}
        onAddMaterialToFolder={handleAddMaterialToFolder}
        onRenameItem={handleRenameItem}
        onDeleteItem={handleDeleteItem}
        onRestoreItem={handleRestoreItem}
        onCommitDelete={handleCommitDelete}
        onMoveItem={handleMoveItem}
        onSettings={() => setSettingsOpen(true)}
        onLogout={handleLogout}
      />

      <main className={styles.content}>
        <Workspace
          materialModal={materialModal}
          collections={visibleCollections}
          onAddMaterial={handleAddMaterial}
          onCreateCollection={handleStartCreateCollection}
          activeItemId={activeItemId}
          homeOpen={homeOpen}
          canCloseHome={canCloseHome}
          onCloseHome={handleCloseHome}
          onOpenMaterialFromGraph={handleOpenMaterialFromGraph}
        />
      </main>

      {settingsOpen && (
        <ProfileModal
          user={user}
          stats={stats}
          onClose={() => setSettingsOpen(false)}
          onLogout={handleLogout}
          onDeleteAccount={() => setDeleteAccountOpen(true)}
          onExportData={() => console.log('Экспорт данных')}
        />
      )}

      <DeleteAccountModal
        isOpen={deleteAccountOpen}
        onClose={() => setDeleteAccountOpen(false)}
        onConfirm={handleConfirmDeleteAccount}
        stats={stats}
      />

      {previewMaterial && (
        <MaterialViewerModal
          material={previewMaterial}
          onClose={() => setPreviewMaterial(null)}
          onUpdated={() => reloadMaterials()}
        />
      )}
    </div>
  );
}
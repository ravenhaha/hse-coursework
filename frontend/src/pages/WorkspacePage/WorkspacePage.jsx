import { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Workspace/components/Sidebar/Sidebar';
import Workspace from '../../components/Workspace/Workspace.jsx';
import ProfileModal from '../../components/ProfileModal/ProfileModal';
import MaterialViewerModal from '../../components/MaterialViewerModal/MaterialViewerModal';
import DeleteAccountModal from '../../components/DeleteAccountModal/DeleteAccountModal';
import { useAuth } from '../../hooks/useAuth';
import useCollections from '../../hooks/useCollections';
import useMaterials from '../../hooks/useMaterials';
import { useModal } from '../../hooks/useModal.js';
import { usersApi } from '../../api/users';
import styles from './WorkspacePage.module.css';

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

  const [activeItemId, setActiveItemId] = useState(null);
  const [previewMaterial, setPreviewMaterial] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const materialModal = useModal();

  // 🆕 ЭТАП 5: soft-delete — карта отложенных удалений
  // id → { type, hiddenCollectionIds, hiddenMaterialIds }
  const [pendingDeletes, setPendingDeletes] = useState(() => new Map());

  // 🆕 Собирает все ID коллекций в ветке (рекурсивно)
  const collectCollectionBranch = useCallback((rootId, nodes = collections) => {
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
  }, [collections]);

  // 🆕 Множества скрытых ID (для быстрых проверок)
  const hiddenIds = useMemo(() => {
    const hiddenColl = new Set();
    const hiddenMat = new Set();
    for (const p of pendingDeletes.values()) {
      p.hiddenCollectionIds?.forEach((id) => hiddenColl.add(Number(id)));
      p.hiddenMaterialIds?.forEach((id) => hiddenMat.add(Number(id)));
    }
    return { hiddenColl, hiddenMat };
  }, [pendingDeletes]);

  // 🆕 Видимые коллекции (рекурсивный фильтр)
  const visibleCollections = useMemo(() => {
    const { hiddenColl } = hiddenIds;
    if (hiddenColl.size === 0) return collections;
    const walk = (nodes) =>
      nodes
        .filter((n) => !hiddenColl.has(Number(n.id)))
        .map((n) => ({ ...n, children: walk(n.children || []) }));
    return walk(collections);
  }, [collections, hiddenIds]);

  // 🆕 Видимые материалы (плоский фильтр)
  const visibleMaterials = useMemo(() => {
    const { hiddenColl, hiddenMat } = hiddenIds;
    if (hiddenColl.size === 0 && hiddenMat.size === 0) return materials;
    return materials.filter(
      (m) =>
        !hiddenMat.has(Number(m.id)) &&
        !hiddenColl.has(Number(m.collectionId ?? m.raw?.collection_id)),
    );
  }, [materials, hiddenIds]);

  // ❗ дерево строим из ВИДИМЫХ
  const collectionsTree = useMemo(
    () => mergeTree(visibleCollections, visibleMaterials),
    [visibleCollections, visibleMaterials],
  );

  // ── Главная-как-справка ──
  const [homeOpen, setHomeOpen] = useState(true);
  const [homeAutoInited, setHomeAutoInited] = useState(false);

  useEffect(() => {
    if (collectionsLoading) return;
    if (homeAutoInited) return;
    setHomeOpen(collections.length === 0);
    setHomeAutoInited(true);
  }, [collectionsLoading, collections.length, homeAutoInited]);

  useEffect(() => {
    if (!homeOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape' && collections.length > 0) {
        setHomeOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [homeOpen, collections.length]);

  const handleSelectItem = useCallback((id, type = 'document') => {
    setActiveItemId(id);
    setHomeOpen(false);

    if (type === 'folder') {
      setPreviewMaterial(null);
      return;
    }

    const mat = materials.find((m) => m.id === id);
    if (mat) setPreviewMaterial(mat);
  }, [materials]);

  const handleNavigateHome = useCallback(() => {
    setHomeOpen(true);
    setActiveItemId(null);
    setPreviewMaterial(null);
  }, []);

  const handleCloseHome = useCallback(() => {
    setHomeOpen(false);
  }, []);

  // ── Коллекции ──
  const handleCreateCollection = useCallback(async (name) => {
    try {
      await createCollection(name);
    } catch (err) {
      console.error('Не удалось создать коллекцию:', err.message);
      throw err;
    }
  }, [createCollection]);

  const handleCreateSubcollection = useCallback(async (parentId, name) => {
    try {
      await createCollection(name, parentId);
    } catch (err) {
      console.error('Не удалось создать подколлекцию:', err.message);
      if (err?.status === 404) {
        await reloadCollections();
      }
      throw err;
    }
  }, [createCollection, reloadCollections]);

  // ── Материалы ──
  const handleAddMaterial = useCallback(async (data) => {
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
  }, [createMaterial, reloadCollections, reloadMaterials]);

  const handleAddMaterialToFolder = useCallback(async (folderId, data) => {
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
  }, [createMaterial, reloadCollections, reloadMaterials]);

  // ── Переименование ──
  const handleRenameItem = useCallback(async (id, newName, type) => {
    try {
      if (type === 'folder') {
        await renameCollection(id, newName);
      } else {
        await renameMaterial(id, newName);
      }
    } catch (err) {
      console.error('Не удалось переименовать:', err.message);
    }
  }, [renameCollection, renameMaterial]);

  // ── 🆕 ЭТАП 5: SOFT-DELETE ──

  // 1) Юзер нажал «Удалить» → прячем в UI, ждём решения
  const handleDeleteItem = useCallback((id, type) => {
    const numId = Number(id);

    if (type === 'folder') {
      const branch = collectCollectionBranch(numId);
      const branchSet = new Set(branch.map(Number));
      const hiddenMaterialIds = materials
        .filter((m) => branchSet.has(Number(m.collectionId ?? m.raw?.collection_id)))
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

    // Сбросить активный/превью, если удалили его
    if (activeItemId === id) setActiveItemId(null);
    if (previewMaterial?.id === id) setPreviewMaterial(null);
  }, [collectCollectionBranch, materials, activeItemId, previewMaterial]);

  // 2) Юзер нажал «Отменить» → возвращаем
  const handleRestoreItem = useCallback((item /*, type */) => {
    setPendingDeletes((prev) => {
      const next = new Map(prev);
      next.delete(Number(item.id));
      return next;
    });
  }, []);

  // 3) Тост закрылся сам → реально удаляем на бэке
  const handleCommitDelete = useCallback(async (id, type) => {
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
  }, [
    removeCollection,
    removeMaterial,
    removeByCollectionIds,
    reloadCollections,
    reloadMaterials,
  ]);

  // ── Перемещение (DnD) ──
  const handleMoveItem = useCallback(async (id, type, newParentId) => {
    console.log('[DnD] handleMoveItem:', { id, type, newParentId });
    try {
      if (type === 'folder') {
        await moveCollection(id, newParentId);
      } else {
        if (newParentId == null) {
          console.warn('[DnD] Отмена: материал нельзя в корень');
          return;
        }
        await moveMaterial(id, newParentId);
        console.log('[DnD] Материал перемещён ✅');
      }
    } catch (err) {
      console.error('Не удалось переместить:', err.message, err);
      if (err?.status === 404 || err?.status === 409) {
        await reloadCollections();
        await reloadMaterials();
      }
    }
  }, [
    moveCollection,
    moveMaterial,
    reloadCollections,
    reloadMaterials,
  ]);

  const handleLogout = useCallback(async () => {
    await logout();
  }, [logout]);

  const handleConfirmDeleteAccount = useCallback(async () => {
    await usersApi.deleteAccount();
    setDeleteAccountOpen(false);
    setSettingsOpen(false);
    try { await logout(); } catch { /* игнор */ }
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
    collections: countCollections(visibleCollections),  // 🆕 считаем по видимым
    materials: visibleMaterials.length,                  // 🆕
  };

  const canCloseHome = collections.length > 0;

  return (
    <div className={styles.layout}>
      <Sidebar
        collections={collectionsTree}
        pureCollections={visibleCollections}   // 🆕 видимые
        materials={visibleMaterials}            // 🆕 видимые
        user={user}
        activeItemId={activeItemId}
        homeOpen={homeOpen}
        onSelectItem={handleSelectItem}
        onNavigateHome={handleNavigateHome}
        onCreateCollection={handleCreateCollection}
        onCreateSubcollection={handleCreateSubcollection}
        onAddMaterial={handleAddMaterial}
        onAddMaterialToFolder={handleAddMaterialToFolder}
        onRenameItem={handleRenameItem}
        onDeleteItem={handleDeleteItem}         // 🆕 soft
        onRestoreItem={handleRestoreItem}       // 🆕
        onCommitDelete={handleCommitDelete}     // 🆕
        onMoveItem={handleMoveItem}
        onSettings={() => setSettingsOpen(true)}
        onLogout={handleLogout}
      />

      <main className={styles.content}>
        <Workspace
          materialModal={materialModal}
          collections={visibleCollections}     // 🆕 чтобы модалка добавления не предлагала удалённые
          onAddMaterial={handleAddMaterial}
          activeItemId={activeItemId}
          homeOpen={homeOpen}
          canCloseHome={canCloseHome}
          onCloseHome={handleCloseHome}
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
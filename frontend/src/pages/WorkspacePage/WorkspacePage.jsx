import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
const WORKSPACE_SETTINGS_KEY = 'omut_workspace_settings';

const DEFAULT_SETTINGS = {
  theme: 'dark',
  language: 'ru',
};

function readWorkspaceSettings() {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;

  try {
    const raw = window.localStorage.getItem(WORKSPACE_SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;

    const parsed = JSON.parse(raw);
    return {
      theme: parsed?.theme || DEFAULT_SETTINGS.theme,
      language: parsed?.language || DEFAULT_SETTINGS.language,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function getMaterialCollectionId(material) {
  const raw =
    material?.collectionId ??
    material?.collection_id ??
    material?.collection?.id ??
    material?.raw?.collection_id ??
    material?.raw?.collectionId;

  return raw == null ? null : Number(raw);
}

function mergeTree(collections, materials) {
  const byCollection = {};

  for (const material of materials) {
    const collectionId = getMaterialCollectionId(material);
    if (collectionId == null) continue;

    if (!byCollection[collectionId]) {
      byCollection[collectionId] = [];
    }

    byCollection[collectionId].push(material);
  }

  function walk(nodes) {
    return nodes.map((node) => ({
      ...node,
      children: [...walk(node.children || []), ...(byCollection[node.id] || [])],
    }));
  }

  return walk(collections);
}

function buildCollectionsSignature(nodes) {
  const parts = [];

  const walk = (list, parentId = 0) => {
    for (const node of list) {
      parts.push(`${node.id}:${parentId}:${node.name ?? ''}`);
      if (node.children?.length) {
        walk(node.children, node.id);
      }
    }
  };

  walk(nodes);

  return parts.join('|');
}

function buildMaterialsSignature(materials) {
  return materials
    .map(
      (m) =>
        `${m.id}:${getMaterialCollectionId(m) ?? 0}:${m.name ?? ''}`,
    )
    .join('|');
}

function parseGraphMaterialId(rawId) {
  if (rawId == null) return null;
  if (typeof rawId === 'number') return rawId;

  const s = String(rawId);
  const m = s.match(/(\d+)$/);

  return m ? Number(m[1]) : null;
}

function countCollections(nodes = []) {
  let count = 0;

  for (const node of nodes) {
    count += 1;

    if (node.children?.length) {
      const folders = node.children.filter((child) => child.type === 'folder');
      count += countCollections(folders);
    }
  }

  return count;
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

  const [settings, setSettings] = useState(readWorkspaceSettings);

  useEffect(() => {
    window.localStorage.setItem(
      WORKSPACE_SETTINGS_KEY,
      JSON.stringify(settings),
    );

    document.documentElement.lang = settings.language || 'ru';
    document.documentElement.dataset.theme = settings.theme || 'dark';
  }, [settings]);

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
      .then((data) => {
        if (!cancelled) {
          loadTree(data);
        }
      })
      .catch((err) => {
        console.error('Не удалось загрузить граф:', err.message);
      });

    return () => {
      cancelled = true;
    };
  }, [loadTree, collectionsSig, materialsSig]);

  useEffect(() => {
    return () => clearTree();
  }, [clearTree]);

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

  const [pendingDeletes, setPendingDeletes] = useState(() => new Map());

  const collectCollectionBranch = useCallback(
    (rootId, nodes = collections) => {
      const ids = [];

      const walk = (list) => {
        for (const node of list) {
          if (node.id === rootId) {
            const collectAll = (x) => {
              ids.push(x.id);

              (x.children || []).forEach((child) => {
                if (child.type === 'folder') {
                  collectAll(child);
                }
              });
            };

            collectAll(node);
            return true;
          }

          if (node.children?.length && walk(node.children)) {
            return true;
          }
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

    for (const pending of pendingDeletes.values()) {
      pending.hiddenCollectionIds?.forEach((id) => hiddenColl.add(Number(id)));
      pending.hiddenMaterialIds?.forEach((id) => hiddenMat.add(Number(id)));
    }

    return { hiddenColl, hiddenMat };
  }, [pendingDeletes]);

  const visibleCollections = useMemo(() => {
    const { hiddenColl } = hiddenIds;
    if (hiddenColl.size === 0) return collections;

    const walk = (nodes) =>
      nodes
        .filter((node) => !hiddenColl.has(Number(node.id)))
        .map((node) => ({
          ...node,
          children: walk(node.children || []),
        }));

    return walk(collections);
  }, [collections, hiddenIds]);

  const visibleMaterials = useMemo(() => {
    const { hiddenColl, hiddenMat } = hiddenIds;
    if (hiddenColl.size === 0 && hiddenMat.size === 0) return materials;

    return materials.filter((material) => {
      const collectionId = getMaterialCollectionId(material);

      return (
        !hiddenMat.has(Number(material.id)) &&
        !hiddenColl.has(Number(collectionId))
      );
    });
  }, [materials, hiddenIds]);

  const collectionsTree = useMemo(
    () => mergeTree(visibleCollections, visibleMaterials),
    [visibleCollections, visibleMaterials],
  );

  useEffect(() => {
    if (collectionsLoading) return;
    if (homeAutoInitedRef.current) return;

    homeAutoInitedRef.current = true;

    if (collections.length > 0) {
      setHomeOpen(false);
    }
  }, [collectionsLoading, collections.length]);

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

  const handleSelectItem = useCallback(
    (id, type = 'document') => {
      setActiveItemId(id);
      setHomeOpen(false);

      if (type === 'folder') {
        setPreviewMaterial(null);
        return;
      }

      const material = materials.find((m) => Number(m.id) === Number(id));
      if (material) {
        setPreviewMaterial(material);
      }
    },
    [materials],
  );

  const handleOpenMaterialFromGraph = useCallback(
    (rawId) => {
      const numId = parseGraphMaterialId(rawId);

      if (numId == null) {
        console.warn('Не удалось распарсить id материала из графа:', rawId);
        return;
      }

      const material = materials.find((m) => Number(m.id) === numId);
      if (!material) {
        console.warn('Материал из графа не найден в локальном состоянии:', numId);
        return;
      }

      setActiveItemId(material.id);
      setHomeOpen(false);
      setPreviewMaterial(material);
    },
    [materials],
  );

  const handleNavigateHome = useCallback(() => {
    setHomeOpen(true);
    setActiveItemId(null);
    setPreviewMaterial(null);
  }, []);

  const handleCloseHome = useCallback(() => setHomeOpen(false), []);

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
        if (err?.status === 404) {
          await reloadCollections();
        }
        throw err;
      }
    },
    [createCollection, reloadCollections],
  );

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
        if (type === 'folder') {
          await renameCollection(id, newName);
        } else {
          await renameMaterial(id, newName);
        }
      } catch (err) {
        console.error('Не удалось переименовать:', err.message);
      }
    },
    [renameCollection, renameMaterial],
  );

  const handleDeleteItem = useCallback(
    (id, type) => {
      const numId = Number(id);

      if (type === 'folder') {
        const branch = collectCollectionBranch(numId);
        const branchSet = new Set(branch.map(Number));

        const hiddenMaterialIds = materials
          .filter((material) =>
            branchSet.has(Number(getMaterialCollectionId(material))),
          )
          .map((material) => material.id);

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

      if (Number(activeItemId) === numId) {
        setActiveItemId(null);
      }

      if (Number(previewMaterial?.id) === numId) {
        setPreviewMaterial(null);
      }
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
      // ignore
    }

    navigate('/login', { replace: true });
  }, [logout, navigate]);

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
          settings={settings}
          stats={stats}
          collections={visibleCollections}
          materials={visibleMaterials}
          onClose={() => setSettingsOpen(false)}
          onUpdateSettings={setSettings}
          onLogout={handleLogout}
          onDeleteAccount={() => setDeleteAccountOpen(true)}
          onDataImported={async () => {
            await reloadCollections();
            await reloadMaterials();
          }}
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
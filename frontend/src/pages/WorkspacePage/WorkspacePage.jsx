import { useState, useCallback } from 'react';
import Sidebar from '../../components/Workspace/components/Sidebar/Sidebar';
import Workspace from '../../components/Workspace/Workspace.jsx';
import ProfileModal from '../../components/ProfileModal/ProfileModal';
import { useAuth } from '../../context/useAuth';
import useCollections from '../../hooks/useCollections';
import useMaterials from '../../hooks/useMaterials';
import { useModal } from '../../hooks/useModal.js';
import styles from './WorkspacePage.module.css';

export default function WorkspacePage() {
  const { user, logout } = useAuth();
  const {
    collections,
    create: createCollection,
    rename: renameCollection,
    remove: removeCollection,
  } = useCollections();
  const {
    materials,
    create: createMaterial,
    rename: renameMaterial,
    remove: removeMaterial,
  } = useMaterials();

  const [activeItemId, setActiveItemId] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const materialModal = useModal();

  // ── Коллекции ──
  const handleCreateCollection = useCallback(async (name) => {
    try {
      await createCollection(name);
    } catch (err) {
      console.error('Не удалось создать коллекцию:', err.message);
    }
  }, [createCollection]);

  // ── Материалы ──
  const handleAddMaterial = useCallback(async (data) => {
    try {
      const created = await createMaterial(data);
      setActiveItemId(created.id);
    } catch (err) {
      console.error('Не удалось добавить материал:', err.message);
    }
  }, [createMaterial]);

  const handleAddMaterialToFolder = useCallback(async (folderId, data) => {
    try {
      await createMaterial({ ...data, collection_id: folderId });
    } catch (err) {
      console.error('Не удалось добавить материал в папку:', err.message);
    }
  }, [createMaterial]);

  // ── Переименование (определяем, коллекция или материал) ──
  const handleRenameItem = useCallback(async (id, newName) => {
    try {
      await renameCollection(id, newName);
    } catch {
      try {
        await renameMaterial(id, newName);
      } catch (err) {
        console.error('Не удалось переименовать:', err.message);
      }
    }
  }, [renameCollection, renameMaterial]);

  // ── Удаление ──
  const handleDeleteItem = useCallback(async (id) => {
    try {
      await removeCollection(id);
    } catch {
      try {
        await removeMaterial(id);
      } catch (err) {
        console.error('Не удалось удалить:', err.message);
      }
    }
    if (activeItemId === id) setActiveItemId(null);
  }, [removeCollection, removeMaterial, activeItemId]);

  // ── Logout ──
  const handleLogout = useCallback(async () => {
    await logout();
  }, [logout]);

  const stats = {
    collections: collections.length,
    materials: materials.length,
  };

  return (
    <div className={styles.layout}>
      <Sidebar
        collections={collections}
        materials={materials}
        user={user}
        activeItemId={activeItemId}
        onSelectItem={(id) => setActiveItemId(id)}
        onNavigateHome={() => setActiveItemId(null)}
        onCreateCollection={handleCreateCollection}
        onAddMaterial={handleAddMaterial}
        onAddMaterialToFolder={handleAddMaterialToFolder}
        onRenameItem={handleRenameItem}
        onDeleteItem={handleDeleteItem}
        onSettings={() => setSettingsOpen(true)}
        onLogout={handleLogout}
      />

      <main className={styles.content}>
        <Workspace materialModal={materialModal} />
      </main>

      {settingsOpen && (
        <ProfileModal
          user={user}
          stats={stats}
          onClose={() => setSettingsOpen(false)}
          onLogout={handleLogout}
          onDeleteAccount={() => console.log('Удалить аккаунт')}
          onExportData={() => console.log('Экспорт данных')}
        />
      )}
    </div>
  );
}
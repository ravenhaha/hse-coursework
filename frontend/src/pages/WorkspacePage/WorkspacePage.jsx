import { useState } from 'react';
import Sidebar from '../../components/Workspace/components/Sidebar/Sidebar';
import Workspace from '../../components/Workspace/Workspace.jsx';
import ProfileModal from '../../components/ProfileModal/ProfileModal';
import { useModal } from '../../hooks/useModal.js';
import styles from './WorkspacePage.module.css';

const initialCollections = [
  {
    id: 1,
    name: 'Проекты',
    type: 'folder',
    children: [
      { id: 11, name: 'Веб-дизайн 2025', type: 'document' },
      { id: 12, name: 'Исследования', type: 'document' },
    ],
  },
  {
    id: 2,
    name: 'Обучение',
    type: 'folder',
    children: [],
  },
];

const initialMaterials = [
  { id: 3, name: 'Личные заметки', type: 'document' },
  { id: 4, name: 'Избранное', type: 'document' },
];

// Универсальный апдейт узла в дереве коллекций
const updateTree = (nodes, id, updater) =>
  nodes.map((node) => {
    if (node.id === id) return updater(node);
    if (node.children?.length) {
      return { ...node, children: updateTree(node.children, id, updater) };
    }
    return node;
  });

// Универсальное удаление по id (включая глубокие дочерние)
const removeFromTree = (nodes, id) =>
  nodes
    .filter((node) => node.id !== id)
    .map((node) =>
      node.children?.length
        ? { ...node, children: removeFromTree(node.children, id) }
        : node
    );

export default function WorkspacePage({ user, settings, onUpdateSettings, onLogout }) {
  const [collections, setCollections] = useState(initialCollections);
  const [materials, setMaterials] = useState(initialMaterials);
  const [activeItemId, setActiveItemId] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const materialModal = useModal();

  // Создать коллекцию (инлайн из сайдбара)
  const handleCreateCollection = (name) => {
    setCollections((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name,
        type: 'folder',
        children: [],
      },
    ]);
  };

  // Добавить материал в корневой список
  const handleAddMaterial = () => {
    const id = crypto.randomUUID();
    setMaterials((prev) => [
      ...prev,
      { id, name: `Материал ${prev.length + 1}`, type: 'document' },
    ]);
    setActiveItemId(id);
  };

  // Добавить материал внутрь папки
  const handleAddMaterialToFolder = (folderId, name) => {
    if (!name) return;
    const newItem = { id: crypto.randomUUID(), name, type: 'document' };
    setCollections((prev) =>
      updateTree(prev, folderId, (node) => ({
        ...node,
        children: [...(node.children || []), newItem],
      }))
    );
  };

  // Переименовать (работает и для коллекций, и для материалов)
  const handleRenameItem = (id, name) => {
    setCollections((prev) => updateTree(prev, id, (node) => ({ ...node, name })));
    setMaterials((prev) => prev.map((m) => (m.id === id ? { ...m, name } : m)));
  };

  // Удалить (из коллекций или корневых материалов)
  const handleDeleteItem = (id) => {
    setCollections((prev) => removeFromTree(prev, id));
    setMaterials((prev) => prev.filter((m) => m.id !== id));
    if (activeItemId === id) setActiveItemId(null);
  };

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
        onLogout={onLogout}
      />
      <main className={styles.content}>
        <Workspace materialModal={materialModal} />
      </main>

      {settingsOpen && (
        <ProfileModal
          user={user}
          settings={settings}
          stats={stats}
          onClose={() => setSettingsOpen(false)}
          onUpdateSettings={onUpdateSettings}
          onLogout={onLogout}
          onDeleteAccount={() => console.log('Удалить аккаунт')}
          onExportData={() => console.log('Экспорт данных')}
        />
      )}
    </div>
  );
}
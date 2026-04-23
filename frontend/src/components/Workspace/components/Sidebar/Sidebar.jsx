import { useState, useCallback } from 'react';
import {
  IoWater, IoHome, IoLayersOutline, IoDocumentTextOutline,
  IoPencilOutline, IoTrashOutline, IoAddOutline,
} from 'react-icons/io5';
import SidebarSection from './SidebarSection';
import TreeItem from './TreeItem';
import UserPanel from './UserPanel';
import ContextMenu from './ContextMenu';
import AddMaterialModal from '../AddMaterialModal/AddMaterialModal';
import { filterTree, filterFlat } from './filters';
import styles from './Sidebar.module.css';

export default function Sidebar({
  collections = [],
  materials = [],
  user = null,
  activeItemId = null,
  onSelectItem,
  onCreateCollection,
  onAddMaterial,
  onAddMaterialToFolder,
  onRenameItem,
  onDeleteItem,
  onNavigateHome,
  onSettings,
  onLogout,
}) {
  const [expandedFolders, setExpandedFolders] = useState({});
  const [ctxMenu, setCtxMenu] = useState(null);
  const [renamingId, setRenamingId] = useState(null);

  // Модалка добавления материала
  // parentId === null → корневой раздел «Материалы»
  // parentId === <id> → внутрь папки коллекции
  const [addModal, setAddModal] = useState({ open: false, parentId: null });

  const handleToggleFolder = useCallback((id) => {
    setExpandedFolders((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const handleExpandFolder = useCallback((id) => {
    setExpandedFolders((prev) => (prev[id] ? prev : { ...prev, [id]: true }));
  }, []);

  const handleItemClick = useCallback(
    (item) => {
      if (item.type === 'folder') handleToggleFolder(item.id);
      onSelectItem?.(item.id);
    },
    [handleToggleFolder, onSelectItem]
  );

  // «+» у папки коллекции → открыть модалку с привязкой к папке
  const handleRequestAddToFolder = useCallback((folder) => {
    handleExpandFolder(folder.id);
    setAddModal({ open: true, parentId: folder.id });
  }, [handleExpandFolder]);

  // «+» у заголовка «Материалы» → открыть модалку без привязки
  const handleRequestAddMaterial = useCallback(() => {
    setAddModal({ open: true, parentId: null });
  }, []);

  const handleCloseAddModal = useCallback(() => {
    setAddModal({ open: false, parentId: null });
  }, []);

  const handleSubmitAddModal = useCallback(
    (data) => {
      if (addModal.parentId) {
        onAddMaterialToFolder?.(addModal.parentId, data);
      } else {
        onAddMaterial?.(data);
      }
      handleCloseAddModal();
    },
    [addModal.parentId, onAddMaterialToFolder, onAddMaterial, handleCloseAddModal]
  );

  const handleContextMenu = useCallback(
    (e, item) => {
      const items = [
        {
          label: 'Переименовать',
          icon: IoPencilOutline,
          onClick: () => setRenamingId(item.id),
        },
      ];

      if (item.type === 'folder') {
        items.push({
          label: 'Добавить материал',
          icon: IoAddOutline,
          onClick: () => handleRequestAddToFolder(item),
        });
      }

      items.push(
        { divider: true },
        {
          label: 'Удалить',
          icon: IoTrashOutline,
          danger: true,
          onClick: () => {
            if (confirm(`Удалить «${item.name}»?`)) onDeleteItem?.(item.id);
          },
        }
      );

      setCtxMenu({ x: e.clientX, y: e.clientY, items });
    },
    [handleRequestAddToFolder, onDeleteItem]
  );

  const handleRenameSubmit = useCallback(
    (id, name) => {
      onRenameItem?.(id, name);
      setRenamingId(null);
    },
    [onRenameItem]
  );

  const handleRenameCancel = useCallback(() => setRenamingId(null), []);

  return (
    <aside className={styles.sidebar}>
      <div className={styles.scrollArea}>
        <div className={styles.logo}>
          <IoWater className={styles.logoIcon} />
          <span className={styles.logoText}>Омут памяти</span>
        </div>

        <nav className={styles.nav}>
          <button
            className={`${styles.navItem} ${!activeItemId ? styles.navItemActive : ''}`}
            onClick={() => onNavigateHome?.()}
          >
            <IoHome className={styles.navIcon} />
            <span>Главная</span>
          </button>
        </nav>

        {/* Коллекции: «+» создаёт коллекцию инлайн */}
        <SidebarSection
          icon={IoLayersOutline}
          title="Коллекция"
          addTitle="Создать коллекцию"
          inlineCreate
          onAdd={onCreateCollection}
        >
          {(search) =>
            filterTree(collections, search).map((item) => (
              <TreeItem
                key={item.id}
                item={item}
                activeItemId={activeItemId}
                expandedFolders={
                  search
                    ? Object.fromEntries(collections.map((c) => [c.id, true]))
                    : expandedFolders
                }
                onItemClick={handleItemClick}
                onToggleFolder={handleToggleFolder}
                onExpandFolder={handleExpandFolder}
                onRequestAdd={handleRequestAddToFolder}
                onContextMenu={handleContextMenu}
                renamingId={renamingId}
                onRenameSubmit={handleRenameSubmit}
                onRenameCancel={handleRenameCancel}
              />
            ))
          }
        </SidebarSection>

        {/* Материалы: «+» открывает модалку */}
        <SidebarSection
          icon={IoDocumentTextOutline}
          title="Материалы"
          addTitle="Добавить материал"
          onAdd={handleRequestAddMaterial}
        >
          {(search) =>
            filterFlat(materials, search).map((item) => (
              <TreeItem
                key={item.id}
                item={item}
                activeItemId={activeItemId}
                onItemClick={(it) => onSelectItem?.(it.id)}
                onContextMenu={handleContextMenu}
                renamingId={renamingId}
                onRenameSubmit={handleRenameSubmit}
                onRenameCancel={handleRenameCancel}
              />
            ))
          }
        </SidebarSection>
      </div>

      <UserPanel user={user} onSettings={onSettings} onLogout={onLogout} />

      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          items={ctxMenu.items}
          onClose={() => setCtxMenu(null)}
        />
      )}

      <AddMaterialModal
        isOpen={addModal.open}
        onClose={handleCloseAddModal}
        onSubmit={handleSubmitAddModal}
      />
    </aside>
  );
}
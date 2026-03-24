import { useState } from 'react';
import { IoWater, IoHome, IoLayersOutline, IoDocumentTextOutline } from 'react-icons/io5';
import SidebarSection from './SidebarSection';
import TreeItem from './TreeItem';
import UserPanel from './UserPanel';
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
  onNavigateHome,
  onSettings,
  onLogout,
}) {
  const [expandedFolders, setExpandedFolders] = useState({});

  const toggleFolder = (id) => {
    setExpandedFolders((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleItemClick = (item) => {
    if (item.type === 'folder') {
      toggleFolder(item.id);
    }
    onSelectItem?.(item.id);
  };

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

        <SidebarSection
          icon={IoLayersOutline}
          title="Коллекция"
          addTitle="Создать коллекцию"
          onAdd={onCreateCollection}
        >
          {(search) => filterTree(collections, search).map((item) => (
            <TreeItem
              key={item.id}
              item={item}
              isActive={activeItemId === item.id}
              isExpanded={search ? true : expandedFolders[item.id]}
              onItemClick={handleItemClick}
            />
          ))}
        </SidebarSection>

        <SidebarSection
          icon={IoDocumentTextOutline}
          title="Материалы"
          addTitle="Добавить материал"
          onAdd={onAddMaterial}
        >
          {(search) => filterFlat(materials, search).map((item) => (
            <TreeItem
              key={item.id}
              item={item}
              isActive={activeItemId === item.id}
              onItemClick={(it) => onSelectItem?.(it.id)}
            />
          ))}
        </SidebarSection>
      </div>

      <UserPanel user={user} onSettings={onSettings} onLogout={onLogout} />
    </aside>
  );
}
import { useState, useMemo } from 'react';
import {
  IoWater,
  IoHome,
  IoLayersOutline,
  IoChevronForward,
  IoChevronDown,
  IoSettingsOutline,
  IoLogOutOutline,
  IoFolderOutline,
  IoDocumentTextOutline,
  IoAdd,
} from 'react-icons/io5';
import styles from './Sidebar.module.css';

function filterTree(items, query) {
  if (!query) return items;
  const lower = query.toLowerCase();

  return items.reduce((acc, item) => {
    if (item.type === 'folder') {
      const filteredChildren = filterTree(item.children || [], query);
      if (filteredChildren.length > 0 || item.name.toLowerCase().includes(lower)) {
        acc.push({ ...item, children: filteredChildren });
      }
    } else {
      if (item.name.toLowerCase().includes(lower)) {
        acc.push(item);
      }
    }
    return acc;
  }, []);
}

function filterFlat(items, query) {
  if (!query) return items;
  const lower = query.toLowerCase();
  return items.filter((item) => item.name.toLowerCase().includes(lower));
}

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
  const [collectionOpen, setCollectionOpen] = useState(true);
  const [materialsOpen, setMaterialsOpen] = useState(true);
  const [expandedFolders, setExpandedFolders] = useState({});
  const [collectionSearch, setCollectionSearch] = useState('');
  const [materialsSearch, setMaterialsSearch] = useState('');

  const filteredCollections = useMemo(
    () => filterTree(collections, collectionSearch),
    [collections, collectionSearch]
  );

  const filteredMaterials = useMemo(
    () => filterFlat(materials, materialsSearch),
    [materials, materialsSearch]
  );

  const toggleFolder = (id) => {
    setExpandedFolders((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleItemClick = (item) => {
    if (item.type === 'folder') {
      toggleFolder(item.id);
    }
    onSelectItem?.(item.id);
  };

  const renderTreeItem = (item, depth = 0) => {
    const isFolder = item.type === 'folder';
    const isExpanded = collectionSearch ? true : expandedFolders[item.id];
    const isActive = activeItemId === item.id;

    return (
      <div key={item.id}>
        <div className={styles.treeRow}>
          <button
            className={`${styles.treeItem} ${isActive ? styles.treeItemActive : ''}`}
            style={{ paddingLeft: `${12 + depth * 20}px` }}
            onClick={() => handleItemClick(item)}
          >
            {isFolder ? (
              <IoFolderOutline className={styles.treeIcon} />
            ) : (
              <IoDocumentTextOutline className={styles.treeIcon} />
            )}
            <span className={styles.treeLabel}>{item.name}</span>
            {isFolder && (
              <IoChevronForward
                className={`${styles.treeChevron} ${isExpanded ? styles.treeChevronOpen : ''}`}
              />
            )}
          </button>
        </div>
        {isFolder && isExpanded && item.children?.map((child) => renderTreeItem(child, depth + 1))}
      </div>
    );
  };

  const renderMaterialItem = (item) => {
    const isActive = activeItemId === item.id;

    return (
      <div key={item.id} className={styles.treeRow}>
        <button
          className={`${styles.treeItem} ${isActive ? styles.treeItemActive : ''}`}
          onClick={() => onSelectItem?.(item.id)}
        >
          <IoDocumentTextOutline className={styles.treeIcon} />
          <span className={styles.treeLabel}>{item.name}</span>
        </button>
      </div>
    );
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

        <div className={styles.section}>
          <div className={styles.sectionHeaderRow}>
            <button
              className={styles.sectionHeader}
              onClick={() => setCollectionOpen(!collectionOpen)}
            >
              <IoLayersOutline className={styles.sectionIcon} />
              <span className={styles.sectionTitle}>Коллекция</span>
              {collectionOpen ? (
                <IoChevronDown className={styles.sectionChevron} />
              ) : (
                <IoChevronForward className={styles.sectionChevron} />
              )}
            </button>
            <button
              className={styles.addButton}
              title="Создать коллекцию"
              onClick={() => onCreateCollection?.()}
            >
              <IoAdd />
            </button>
          </div>

          {collectionOpen && (
            <div className={styles.sectionBody}>
              <div className={styles.searchWrap}>
                <input
                  className={styles.searchInput}
                  placeholder="Поиск..."
                  value={collectionSearch}
                  onChange={(e) => setCollectionSearch(e.target.value)}
                />
              </div>
              <div className={styles.tree}>
                {filteredCollections.map((item) => renderTreeItem(item))}
              </div>
            </div>
          )}
        </div>

        <div className={styles.section}>
          <div className={styles.sectionHeaderRow}>
            <button
              className={styles.sectionHeader}
              onClick={() => setMaterialsOpen(!materialsOpen)}
            >
              <IoDocumentTextOutline className={styles.sectionIcon} />
              <span className={styles.sectionTitle}>Материалы</span>
              {materialsOpen ? (
                <IoChevronDown className={styles.sectionChevron} />
              ) : (
                <IoChevronForward className={styles.sectionChevron} />
              )}
            </button>
            <button
              className={styles.addButton}
              title="Добавить материал"
              onClick={() => onAddMaterial?.()}
            >
              <IoAdd />
            </button>
          </div>

          {materialsOpen && (
            <div className={styles.sectionBody}>
              <div className={styles.searchWrap}>
                <input
                  className={styles.searchInput}
                  placeholder="Поиск..."
                  value={materialsSearch}
                  onChange={(e) => setMaterialsSearch(e.target.value)}
                />
              </div>
              <div className={styles.tree}>
                {filteredMaterials.map((item) => renderMaterialItem(item))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className={styles.userSection}>
        {user && (
          <div className={styles.userInfo}>
            <div className={styles.avatar}>
              {user.name?.charAt(0) || '?'}
            </div>
            <div className={styles.userText}>
              <div className={styles.userName}>{user.name}</div>
              <div className={styles.userEmail}>{user.email}</div>
            </div>
          </div>
        )}
        <div className={styles.userActions}>
          <button className={styles.settingsButton} onClick={() => onSettings?.()}>
            <IoSettingsOutline />
            <span>Настройки</span>
          </button>
          <button className={styles.logoutButton} onClick={() => onLogout?.()}>
            <IoLogOutOutline />
          </button>
        </div>
      </div>
    </aside>
  );
}
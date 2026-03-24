import { memo } from 'react';
import {
  IoChevronForward,
  IoFolderOutline,
  IoDocumentTextOutline,
} from 'react-icons/io5';
import styles from './Sidebar.module.css';

const TreeItem = memo(function TreeItem({ item, depth = 0, isActive, isExpanded, onItemClick }) {
  const isFolder = item.type === 'folder';

  return (
    <div>
      <div className={styles.treeRow}>
        <button
          className={`${styles.treeItem} ${isActive ? styles.treeItemActive : ''}`}
          style={{ paddingLeft: `${12 + depth * 20}px` }}
          onClick={() => onItemClick(item)}
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
      {isFolder && isExpanded && item.children?.map((child) => (
        <TreeItem
          key={child.id}
          item={child}
          depth={depth + 1}
          isActive={isActive}
          isExpanded={isExpanded}
          onItemClick={onItemClick}
        />
      ))}
    </div>
  );
});

export default TreeItem;

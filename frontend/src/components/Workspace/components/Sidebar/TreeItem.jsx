import { memo, useRef, useEffect, useCallback } from 'react';
import {
  IoChevronForward,
  IoFolderOutline,
  IoDocumentTextOutline,
  IoAdd,
} from 'react-icons/io5';
import styles from './Sidebar.module.css';

const TreeItem = memo(function TreeItem({
  item,
  depth = 0,
  activeItemId,
  expandedFolders,
  onItemClick,
  onToggleFolder,
  onExpandFolder,
  onRequestAdd,
  onContextMenu,
  renamingId,
  onRenameSubmit,
  onRenameCancel,
}) {
  const isFolder = item.type === 'folder';
  const isActive = activeItemId === item.id;
  const isExpanded = !!expandedFolders?.[item.id];
  const isRenaming = renamingId === item.id;

  const renameInputRef = useRef(null);
  const renameSubmittedRef = useRef(false);

  useEffect(() => {
    if (isRenaming) {
      renameSubmittedRef.current = false;
      requestAnimationFrame(() => {
        renameInputRef.current?.focus();
        renameInputRef.current?.select();
      });
    }
  }, [isRenaming]);

  const handleAddClick = useCallback(
    (e) => {
      e.stopPropagation();
      if (!isExpanded) onExpandFolder?.(item.id);
      onRequestAdd?.(item);
    },
    [isExpanded, item, onExpandFolder, onRequestAdd]
  );

  const submitRename = useCallback(() => {
    if (renameSubmittedRef.current) return;
    renameSubmittedRef.current = true;
    const name = renameInputRef.current?.value.trim() || '';
    if (name && name !== item.name) onRenameSubmit?.(item.id, name);
    else onRenameCancel?.();
  }, [item.id, item.name, onRenameSubmit, onRenameCancel]);

  const handleRenameKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submitRename();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        renameSubmittedRef.current = true;
        onRenameCancel?.();
      }
    },
    [submitRename, onRenameCancel]
  );

  const handleContextMenu = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      onContextMenu?.(e, item);
    },
    [onContextMenu, item]
  );

  const handleClick = useCallback(() => {
    onItemClick(item);
  }, [onItemClick, item]);

  return (
    <div>
      <div className={styles.treeRow} onContextMenu={handleContextMenu}>
        {isRenaming ? (
          <div
            className={styles.searchWrap}
            style={{ paddingLeft: `${12 + depth * 20}px`, flex: 1 }}
          >
            <input
              key={`rename-${item.id}-${item.name}`}
              ref={renameInputRef}
              className={styles.inlineCreateInput}
              defaultValue={item.name}
              onKeyDown={handleRenameKeyDown}
              onBlur={submitRename}
              maxLength={64}
            />
          </div>
        ) : (
          <>
            <button
              className={`${styles.treeItem} ${isActive ? styles.treeItemActive : ''}`}
              style={{ paddingLeft: `${12 + depth * 20}px` }}
              onClick={handleClick}
            >
              {isFolder ? (
                <IoFolderOutline className={styles.treeIcon} />
              ) : (
                <IoDocumentTextOutline className={styles.treeIcon} />
              )}
              <span className={styles.treeLabel}>{item.name}</span>
              {isFolder && (
                <IoChevronForward
                  className={`${styles.treeChevron} ${
                    isExpanded ? styles.treeChevronOpen : ''
                  }`}
                />
              )}
            </button>

            {isFolder && (
              <button
                className={styles.addButton}
                title="Добавить материал"
                onClick={handleAddClick}
              >
                <IoAdd />
              </button>
            )}
          </>
        )}
      </div>

      {isFolder &&
        isExpanded &&
        item.children?.map((child) => (
          <TreeItem
            key={child.id}
            item={child}
            depth={depth + 1}
            activeItemId={activeItemId}
            expandedFolders={expandedFolders}
            onItemClick={onItemClick}
            onToggleFolder={onToggleFolder}
            onExpandFolder={onExpandFolder}
            onRequestAdd={onRequestAdd}
            onContextMenu={onContextMenu}
            renamingId={renamingId}
            onRenameSubmit={onRenameSubmit}
            onRenameCancel={onRenameCancel}
          />
        ))}
    </div>
  );
});

export default TreeItem;
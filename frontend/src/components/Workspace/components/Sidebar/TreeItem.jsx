import { memo, useRef, useEffect, useCallback } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import {
  IoChevronForward,
  IoFolderOutline,
  IoAdd,
  IoEllipsisHorizontal, // 🆕 ЭТАП 1
} from 'react-icons/io5';
import { getMaterialIcon } from '../../../../utils/materialType';
import { formatRelativeDate, formatFullDate } from '../../../../utils/formatDate';
import styles from './Sidebar.module.css';

// Рендер вертикальных гайд-линий по уровню вложенности
function GuideLines({ depth }) {
  if (depth <= 0) return null;
  return (
    <div className={styles.guideLines} aria-hidden="true">
      {Array.from({ length: depth }).map((_, i) => (
        <span key={i} className={styles.guideLine} />
      ))}
    </div>
  );
}

const TreeItem = memo(function TreeItem({
  item,
  depth = 0,
  section = 'tree',
  activeItemId,
  expandedFolders,
  onItemClick,
  onToggleFolder,
  onExpandFolder,
  onRequestAdd,
  onContextMenu,
  onKebabMenu, // 🆕 ЭТАП 1
  renamingKey,
  onRenameSubmit,
  onRenameCancel,
  creatingInFolderId,
  onSubmitSubcollection,
  onCancelSubcollection,
  draggable = false,
}) {
  const itemType = item.type || 'document';
  const isFolder = itemType === 'folder';

  const isActive = activeItemId === item.id;
  const isExpanded = !!expandedFolders?.[item.id];
  const isRenaming = renamingKey === `${section}:${itemType}:${item.id}`;
  const isCreatingSubHere = isFolder && creatingInFolderId === item.id;

  const renameInputRef = useRef(null);
  const renameSubmittedRef = useRef(false);

  const materialIcon = !isFolder ? getMaterialIcon(item) : null;
  const MaterialIcon = materialIcon?.Icon;

  // Дата материала — только в секции "Все материалы" для документов
  const rawDate =
    !isFolder && section === 'all'
      ? item.createdAt ?? item.raw?.created_at ?? null
      : null;

  const relativeDate = rawDate ? formatRelativeDate(rawDate) : '';
  const fullDate = rawDate ? formatFullDate(rawDate) : '';

  // ── DnD: draggable ──
  const dragData = draggable
    ? {
        kind: 'item',
        id: item.id,
        type: itemType,
        name: item.name,
        currentParentId: item.raw?.collection_id ?? item.collectionId ?? null,
      }
    : {};

  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({
    id: `drag-${section}-${itemType}-${item.id}-${depth}`,
    data: dragData,
    disabled: !draggable || isRenaming,
  });

  const {
    setNodeRef: setDropRef,
    isOver,
  } = useDroppable({
    id: `drop-${section}-folder-${item.id}`,
    data: { kind: 'folder', id: item.id },
    disabled: !isFolder,
  });

  const setCombinedRef = useCallback((node) => {
    setDragRef(node);
    if (isFolder) setDropRef(node);
  }, [setDragRef, setDropRef, isFolder]);

  // data-атрибуты для sticky breadcrumb
  const folderDataProps = isFolder
    ? {
        'data-folder-id': item.id,
        'data-folder-name': item.name,
        'data-folder-depth': depth,
      }
    : {};

  const submitRename = useCallback(() => {
    if (renameSubmittedRef.current) return;
    renameSubmittedRef.current = true;
    const name = renameInputRef.current?.value.trim() || '';
    if (name && name !== item.name) {
      onRenameSubmit?.(item.id, name, itemType);
    } else {
      onRenameCancel?.();
    }
  }, [item.id, item.name, itemType, onRenameSubmit, onRenameCancel]);

  useEffect(() => {
    if (!isRenaming) return;
    renameSubmittedRef.current = false;

    const focusRaf = requestAnimationFrame(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    });

    const handleDocMouseDown = (e) => {
      if (renameInputRef.current && !renameInputRef.current.contains(e.target)) {
        submitRename();
      }
    };

    const listenerTimer = setTimeout(() => {
      document.addEventListener('mousedown', handleDocMouseDown);
    }, 100);

    return () => {
      cancelAnimationFrame(focusRaf);
      clearTimeout(listenerTimer);
      document.removeEventListener('mousedown', handleDocMouseDown);
    };
  }, [isRenaming, submitRename]);

  const handleRenameKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitRename();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      renameSubmittedRef.current = true;
      onRenameCancel?.();
    }
  }, [submitRename, onRenameCancel]);

  const handleAddClick = useCallback((e) => {
    e.stopPropagation();
    if (!isExpanded) onExpandFolder?.(item.id);
    onRequestAdd?.(item);
  }, [isExpanded, item, onExpandFolder, onRequestAdd]);

  // 🆕 ЭТАП 1: клик по kebab-кнопке — открыть меню рядом с ней
  const handleKebabClick = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
    onKebabMenu?.({ ...item, type: itemType }, e.currentTarget);
  }, [onKebabMenu, item, itemType]);

  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu?.(e, { ...item, type: itemType });
  }, [onContextMenu, item, itemType]);

  const handleClick = useCallback(() => {
    onItemClick({ ...item, type: itemType });
  }, [onItemClick, item, itemType]);

  const rowClassName = [
    styles.treeRow,
    isFolder && isOver ? styles.treeRowDropOver : '',
    isDragging ? styles.treeRowDragging : '',
  ].filter(Boolean).join(' ');

  return (
    <div>
      <div
        className={rowClassName}
        ref={setCombinedRef}
        onContextMenu={handleContextMenu}
        {...folderDataProps}
        {...(draggable && !isRenaming ? attributes : {})}
        {...(draggable && !isRenaming ? listeners : {})}
      >
        {isRenaming ? (
          <>
            <GuideLines depth={depth} />
            <div className={styles.searchWrap} style={{ flex: 1, padding: '0 8px 0 4px' }}>
              <input
                key={`rename-${section}-${itemType}-${item.id}`}
                ref={renameInputRef}
                className={styles.inlineCreateInput}
                defaultValue={item.name}
                onKeyDown={handleRenameKeyDown}
                maxLength={64}
              />
            </div>
          </>
        ) : (
          <>
            <div className={styles.treeItemWrap}>
              <GuideLines depth={depth} />
              <button
                className={`${styles.treeItem} ${isActive ? styles.treeItemActive : ''}`}
                onClick={handleClick}
                title={item.name}
              >
                {isFolder ? (
                  <IoFolderOutline className={styles.treeIcon} />
                ) : (
                  MaterialIcon && (
                    <MaterialIcon
                      className={styles.treeIcon}
                      style={{ color: materialIcon.color }}
                    />
                  )
                )}

                {relativeDate ? (
                  <span className={styles.treeLabelGroup}>
                    <span className={styles.treeLabel}>{item.name}</span>
                    <span
                      className={styles.treeDate}
                      title={fullDate}
                    >
                      {relativeDate}
                    </span>
                  </span>
                ) : (
                  <span className={styles.treeLabel}>{item.name}</span>
                )}

                {isFolder && (
                  <IoChevronForward
                    className={`${styles.treeChevron} ${
                      isExpanded ? styles.treeChevronOpen : ''
                    }`}
                  />
                )}
              </button>
            </div>

            {/* 🆕 ЭТАП 1: блок hover-действий (+ и ⋯)
                У папок: + (быстрое добавление материала) и ⋯ (меню).
                У материалов: только ⋯ (меню). */}
            <div className={styles.rowActions} data-no-dnd>
              {isFolder && (
                <button
                  className={styles.addButton}
                  title="Добавить материал в коллекцию"
                  onClick={handleAddClick}
                  onPointerDown={(e) => e.stopPropagation()}
                  data-no-dnd
                >
                  <IoAdd />
                </button>
              )}
              {onKebabMenu && (
                <button
                  className={styles.kebabButton}
                  title="Действия"
                  onClick={handleKebabClick}
                  onPointerDown={(e) => e.stopPropagation()}
                  data-no-dnd
                  aria-label="Действия с элементом"
                >
                  <IoEllipsisHorizontal />
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {isFolder && isExpanded && (
        <>
          {isCreatingSubHere && (
            <SubcollectionInput
              depth={depth + 1}
              onSubmit={(name) => onSubmitSubcollection?.(item.id, name)}
              onCancel={onCancelSubcollection}
            />
          )}

          {item.children?.map((child) => (
            <TreeItem
              key={child.id}
              item={child}
              depth={depth + 1}
              section={section}
              activeItemId={activeItemId}
              expandedFolders={expandedFolders}
              onItemClick={onItemClick}
              onToggleFolder={onToggleFolder}
              onExpandFolder={onExpandFolder}
              onRequestAdd={onRequestAdd}
              onContextMenu={onContextMenu}
              onKebabMenu={onKebabMenu}
              renamingKey={renamingKey}
              onRenameSubmit={onRenameSubmit}
              onRenameCancel={onRenameCancel}
              creatingInFolderId={creatingInFolderId}
              onSubmitSubcollection={onSubmitSubcollection}
              onCancelSubcollection={onCancelSubcollection}
              draggable={draggable}
            />
          ))}
        </>
      )}
    </div>
  );
});

// ── Inline-input для создания подколлекции ──
function SubcollectionInput({ depth, onSubmit, onCancel }) {
  const ref = useRef(null);
  const submittedRef = useRef(false);

  const submit = useCallback(() => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    const name = ref.current?.value.trim() || '';
    if (name) onSubmit?.(name);
    else onCancel?.();
  }, [onSubmit, onCancel]);

  useEffect(() => {
    submittedRef.current = false;

    const focusRaf = requestAnimationFrame(() => {
      ref.current?.focus();
    });

    const handleDocMouseDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        submit();
      }
    };

    const listenerTimer = setTimeout(() => {
      document.addEventListener('mousedown', handleDocMouseDown);
    }, 100);

    return () => {
      cancelAnimationFrame(focusRaf);
      clearTimeout(listenerTimer);
      document.removeEventListener('mousedown', handleDocMouseDown);
    };
  }, [submit]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      submittedRef.current = true;
      onCancel?.();
    }
  };

  return (
    <div className={styles.treeRow}>
      <GuideLines depth={depth} />
      <div style={{ flex: 1, padding: '0 8px 6px 4px' }}>
        <input
          ref={ref}
          className={styles.inlineCreateInput}
          placeholder="Название подколлекции…"
          onKeyDown={handleKeyDown}
          maxLength={64}
        />
      </div>
    </div>
  );
}

export default TreeItem;
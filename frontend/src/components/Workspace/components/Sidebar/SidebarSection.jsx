import { useState, useRef, useEffect, useCallback } from 'react';
import { useDroppable } from '@dnd-kit/core';
import {
  IoChevronForward,
  IoChevronDown,
  IoAdd,
  IoContractOutline,
  IoFolderOutline,
} from 'react-icons/io5';
import styles from './Sidebar.module.css';

export default function SidebarSection({
  // eslint-disable-next-line no-unused-vars
  icon: Icon,
  title,
  addTitle,
  onAdd,
  onCollapseAll,
  inlineCreate = false,
  droppableRoot = false,
  hideAddButton = false,
  stickyBreadcrumb = false,
  searchPlaceholder = 'Поиск…',
  createPlaceholder = 'Название…',
  collapseAllTitle = 'Свернуть все коллекции',
  toggleTitle = 'Свернуть/развернуть раздел',
  children,
}) {
  const [open, setOpen] = useState(true);
  const [search, setSearch] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [stickyFolder, setStickyFolder] = useState(null);

  const inputRef = useRef(null);
  const submittedRef = useRef(false);
  const bodyRef = useRef(null);

  const { setNodeRef: setRootDropRef, isOver: isRootOver } = useDroppable({
    id: 'drop-root-collections',
    data: { kind: 'root', id: null },
    disabled: !droppableRoot,
  });

  useEffect(() => {
    if (isCreating) {
      submittedRef.current = false;
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isCreating]);

  useEffect(() => {
    if (!stickyBreadcrumb) return;
    const body = bodyRef.current;
    if (!body) return;

    const scrollEl = body.closest(`.${styles.scrollArea}`);
    if (!scrollEl) return;

    let raf = null;

    const update = () => {
      raf = null;
      const containerTop = scrollEl.getBoundingClientRect().top;
      const folders = body.querySelectorAll('[data-folder-id]');

      let candidate = null;
      for (const el of folders) {
        const rect = el.getBoundingClientRect();
        if (rect.top < containerTop + 4) {
          candidate = el;
        } else {
          break;
        }
      }

      if (candidate) {
        const id = candidate.getAttribute('data-folder-id');
        const name = candidate.getAttribute('data-folder-name');
        setStickyFolder((prev) =>
          prev?.id === id ? prev : { id, name }
        );
      } else {
        setStickyFolder(null);
      }
    };

    const onScroll = () => {
      if (raf == null) raf = requestAnimationFrame(update);
    };

    scrollEl.addEventListener('scroll', onScroll, { passive: true });
    update();

    return () => {
      scrollEl.removeEventListener('scroll', onScroll);
      if (raf != null) cancelAnimationFrame(raf);
    };
  }, [stickyBreadcrumb, open, search]);

  const startCreate = () => {
    if (inlineCreate) {
      if (!open) setOpen(true);
      setNewName('');
      setIsCreating(true);
    } else {
      onAdd?.();
    }
  };

  const submitCreate = () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    const name = newName.trim();
    if (name) onAdd?.(name);
    setIsCreating(false);
    setNewName('');
  };

  const cancelCreate = () => {
    submittedRef.current = true;
    setIsCreating(false);
    setNewName('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitCreate();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelCreate();
    }
  };

  const handleCollapseAll = useCallback((e) => {
    e.stopPropagation();
    onCollapseAll?.();
  }, [onCollapseAll]);

  const bodyClassName = [
    styles.sectionBody,
    droppableRoot && isRootOver ? styles.sectionBodyDropOver : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeaderRow}>
        <button
          className={styles.sectionHeader}
          onClick={() => setOpen(!open)}
          title={toggleTitle}
        >
          <Icon className={styles.sectionIcon} />
          <span className={styles.sectionTitle}>{title}</span>
          {open ? (
            <IoChevronDown className={styles.sectionChevron} />
          ) : (
            <IoChevronForward className={styles.sectionChevron} />
          )}
        </button>

        {onCollapseAll && (
          <button
            className={styles.collapseAllButton}
            title={collapseAllTitle}
            onClick={handleCollapseAll}
            aria-label={collapseAllTitle}
          >
            <IoContractOutline />
          </button>
        )}

        {!hideAddButton && (
          <button
            className={styles.addButton}
            title={addTitle}
            onClick={startCreate}
            aria-label={addTitle}
          >
            <IoAdd />
          </button>
        )}
      </div>

      {open && (
        <div
          className={bodyClassName}
          ref={(node) => {
            bodyRef.current = node;
            if (droppableRoot) setRootDropRef(node);
          }}
        >
          {stickyBreadcrumb && stickyFolder && (
            <div className={styles.stickyBreadcrumb} title={stickyFolder.name}>
              <IoFolderOutline />
              <span className={styles.breadcrumbItem}>
                {stickyFolder.name}
              </span>
            </div>
          )}

          <div className={styles.searchWrap}>
            <input
              className={styles.searchInput}
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label={searchPlaceholder}
            />
          </div>

          {isCreating && (
            <div className={styles.searchWrap}>
              <input
                ref={inputRef}
                className={styles.inlineCreateInput}
                placeholder={createPlaceholder}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={submitCreate}
                maxLength={64}
              />
            </div>
          )}

          {/* прокидываем startCreate, чтобы empty-state мог запускать inline-создание */}
          <div className={styles.tree}>{children(search, startCreate)}</div>
        </div>
      )}
    </div>
  );
}
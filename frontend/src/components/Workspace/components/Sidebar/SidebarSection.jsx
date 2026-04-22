import { useState, useRef, useEffect } from 'react';
import { IoChevronForward, IoChevronDown, IoAdd } from 'react-icons/io5';
import styles from './Sidebar.module.css';

export default function SidebarSection({
  icon: Icon, // eslint-disable-line no-unused-vars
  title,
  addTitle,
  onAdd,
  inlineCreate = false,
  children,
}) {
  const [open, setOpen] = useState(true);
  const [search, setSearch] = useState('');

  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const inputRef = useRef(null);
  const submittedRef = useRef(false);

  useEffect(() => {
    if (isCreating) {
      submittedRef.current = false;
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isCreating]);

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

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeaderRow}>
        <button
          className={styles.sectionHeader}
          onClick={() => setOpen(!open)}
        >
          <Icon className={styles.sectionIcon} />
          <span className={styles.sectionTitle}>{title}</span>
          {open ? (
            <IoChevronDown className={styles.sectionChevron} />
          ) : (
            <IoChevronForward className={styles.sectionChevron} />
          )}
        </button>
        <button
          className={styles.addButton}
          title={addTitle}
          onClick={startCreate}
        >
          <IoAdd />
        </button>
      </div>

      {open && (
        <div className={styles.sectionBody}>
          <div className={styles.searchWrap}>
            <input
              className={styles.searchInput}
              placeholder="Поиск..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {isCreating && (
            <div className={styles.searchWrap}>
              <input
                ref={inputRef}
                className={styles.inlineCreateInput}
                placeholder="Название…"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={submitCreate}
                maxLength={64}
              />
            </div>
          )}

          <div className={styles.tree}>
            {children(search)}
          </div>
        </div>
      )}
    </div>
  );
}
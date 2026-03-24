import { useState } from 'react';
import { IoChevronForward, IoChevronDown, IoAdd } from 'react-icons/io5';
import styles from './Sidebar.module.css';

export default function SidebarSection({ icon: Icon, title, addTitle, onAdd, children }) {
  const [open, setOpen] = useState(true);
  const [search, setSearch] = useState('');

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
          onClick={() => onAdd?.()}
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
          <div className={styles.tree}>
            {children(search)}
          </div>
        </div>
      )}
    </div>
  );
}
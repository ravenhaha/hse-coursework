import { useState, useEffect, useCallback, useMemo } from 'react';
import styles from './CollectionPicker.module.css';

// 🔄 Сплющиваем дерево — берём ТОЛЬКО папки (на случай, если в children
//    подмешаны материалы — это вторая линия защиты).
function flatten(nodes, depth = 0, acc = []) {
  for (const n of nodes) {
    // ✅ Только папки — материалы пропускаем
    if (n.type && n.type !== 'folder') continue;

    acc.push({ id: n.id, name: n.name, depth });
    if (n.children?.length) flatten(n.children, depth + 1, acc);
  }
  return acc;
}

export default function CollectionPicker({ selected, onChange, collections = [] }) {
  const [isOpen, setIsOpen] = useState(false);

  const flatList = useMemo(() => flatten(collections), [collections]);

  const current = useMemo(
    () => flatList.find((c) => c.id === selected),
    [selected, flatList]
  );

  const close = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, close]);

  const isEmpty = flatList.length === 0;

  return (
    <div className={styles.wrapper}>
      <button
        className={`${styles.trigger} ${isOpen ? styles.triggerOpen : ''}`}
        onClick={() => !isEmpty && setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={current ? `Коллекция: ${current.name}` : 'Выберите коллекцию'}
        type="button"
        disabled={isEmpty}
      >
        {current ? (
          <>
            <span className={styles.selectedIcon}>📁</span>
            <span className={styles.selectedName}>{current.name}</span>
          </>
        ) : (
          <>
            <svg
              width="14" height="14" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            <span className={styles.placeholder}>
              {isEmpty ? 'Сначала создайте коллекцию' : 'Выберите коллекцию'}
            </span>
          </>
        )}
        <svg
          className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}
          width="12" height="12" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2.5"
          strokeLinecap="round" aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && !isEmpty && (
        <>
          <div className={styles.overlay} onClick={close} />
          <div className={styles.dropdown} role="listbox">
            {flatList.map((col) => (
              <button
                key={col.id}
                role="option"
                type="button"
                aria-selected={selected === col.id}
                className={`${styles.option} ${selected === col.id ? styles.optionActive : ''}`}
                style={{ paddingLeft: `${12 + col.depth * 16}px` }}
                onClick={() => {
                  onChange(col.id);
                  close();
                }}
              >
                <span className={styles.optionIcon}>📁</span>
                <span className={styles.optionName}>{col.name}</span>
                {selected === col.id && (
                  <svg
                    width="14" height="14" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" strokeWidth="2.5"
                    strokeLinecap="round" aria-hidden="true"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
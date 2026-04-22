import { useState, useEffect, useCallback, useMemo } from 'react';
import styles from './CollectionPicker.module.css';

const MOCK_COLLECTIONS = [
    { id: '1', name: 'Лекции', icon: '📖' },
    { id: '2', name: 'Конспекты', icon: '📝' },
    { id: '3', name: 'Статьи', icon: '📰' },
    { id: '4', name: 'Разное', icon: '📁' },
];

export default function CollectionPicker({ selected, onChange }) {
    const [isOpen, setIsOpen] = useState(false);

    const current = useMemo(
        () => MOCK_COLLECTIONS.find((c) => c.id === selected),
        [selected]
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

    return (
        <div className={styles.wrapper}>
            <button
                className={`${styles.trigger} ${isOpen ? styles.triggerOpen : ''}`}
                onClick={() => setIsOpen((prev) => !prev)}
                aria-expanded={isOpen}
                aria-haspopup="listbox"
                aria-label={current ? `Коллекция: ${current.name}` : 'Выберите коллекцию'}
                type="button"
            >
                {current ? (
                    <>
                        <span className={styles.selectedIcon}>{current.icon}</span>
                        <span className={styles.selectedName}>{current.name}</span>
                    </>
                ) : (
                    <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                        </svg>
                        <span className={styles.placeholder}>Выберите коллекцию</span>
                    </>
                )}
                <svg
                    className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}
                    width="12" height="12" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                    aria-hidden="true"
                >
                    <polyline points="6 9 12 15 18 9" />
                </svg>
            </button>

            {isOpen && (
                <>
                    <div className={styles.overlay} onClick={close} />
                    <div className={styles.dropdown} role="listbox">
                        {MOCK_COLLECTIONS.map((col) => (
                            <button
                                key={col.id}
                                role="option"
                                type="button"
                                aria-selected={selected === col.id}
                                className={`${styles.option} ${selected === col.id ? styles.optionActive : ''}`}
                                onClick={() => {
                                    onChange(col.id);
                                    close();
                                }}
                            >
                                <span className={styles.optionIcon}>{col.icon}</span>
                                <span className={styles.optionName}>{col.name}</span>
                                {selected === col.id && (
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                                        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                                        aria-hidden="true">
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
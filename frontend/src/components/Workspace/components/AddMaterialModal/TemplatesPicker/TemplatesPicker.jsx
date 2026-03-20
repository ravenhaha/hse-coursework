import { useState, useRef, useEffect } from 'react';
import { templates } from '../templates';
import styles from './TemplatesPicker.module.css';

export function TemplatesPicker({ onSelect }) {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <div className={styles.wrapper} ref={ref}>
            <button
                className={`${styles.trigger} ${isOpen ? styles.triggerActive : ''}`}
                onClick={() => setIsOpen(!isOpen)}
            >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                </svg>
                Шаблон
            </button>

            {isOpen && (
                <div className={styles.dropdown}>
                    {templates.map((t) => (
                        <button
                            key={t.id}
                            className={styles.item}
                            onClick={() => {
                                onSelect(t);
                                setIsOpen(false);
                            }}
                        >
                            <span className={styles.itemIcon}>{t.icon}</span>
                            <span className={styles.itemName}>{t.name}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
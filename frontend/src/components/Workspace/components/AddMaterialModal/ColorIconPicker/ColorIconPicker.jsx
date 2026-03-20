import { useState, useRef, useEffect } from 'react';
import styles from './ColorIconPicker.module.css';

const COLORS = [
    { id: 'teal', value: '#3AD7D3', label: 'Бирюзовый' },
    { id: 'blue', value: '#4A90D9', label: 'Синий' },
    { id: 'purple', value: '#9B59B6', label: 'Фиолетовый' },
    { id: 'pink', value: '#E74C8B', label: 'Розовый' },
    { id: 'red', value: '#E74C3C', label: 'Красный' },
    { id: 'orange', value: '#F39C12', label: 'Оранжевый' },
    { id: 'green', value: '#2ECC71', label: 'Зелёный' },
    { id: 'grey', value: '#7F8C8D', label: 'Серый' },
];

const ICONS = [
    '📝', '📚', '📖', '📰', '💡', '🚀', '🎓', '🧪',
    '📊', '🎨', '🎵', '💻', '🔬', '📐', '🌍', '⭐',
];

export function ColorIconPicker({ color, setColor, icon, setIcon }) {
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
                className={styles.trigger}
                onClick={() => setIsOpen(!isOpen)}
                style={{ borderColor: color }}
            >
                <span className={styles.triggerIcon}>{icon}</span>
                <span
                    className={styles.triggerDot}
                    style={{ background: color }}
                />
            </button>

            {isOpen && (
                <div className={styles.dropdown}>
                    <div className={styles.section}>
                        <span className={styles.sectionLabel}>Цвет</span>
                        <div className={styles.colorGrid}>
                            {COLORS.map((c) => (
                                <button
                                    key={c.id}
                                    className={`${styles.colorBtn} ${color === c.value ? styles.colorBtnActive : ''}`}
                                    style={{ background: c.value }}
                                    onClick={() => setColor(c.value)}
                                    title={c.label}
                                />
                            ))}
                        </div>
                    </div>

                    <div className={styles.divider} />

                    <div className={styles.section}>
                        <span className={styles.sectionLabel}>Иконка</span>
                        <div className={styles.iconGrid}>
                            {ICONS.map((ic) => (
                                <button
                                    key={ic}
                                    className={`${styles.iconBtn} ${icon === ic ? styles.iconBtnActive : ''}`}
                                    onClick={() => setIcon(ic)}
                                >
                                    {ic}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
import { useState, useEffect, useCallback } from 'react';
import styles from './ColorPicker.module.css';

const COLORS = [
    { name: 'По умолчанию', value: null },
    { name: 'Красный', value: '#ff6b6b' },
    { name: 'Оранжевый', value: '#ffa94d' },
    { name: 'Жёлтый', value: '#ffd43b' },
    { name: 'Зелёный', value: '#69db7c' },
    { name: 'Бирюзовый', value: '#3AD7D3' },
    { name: 'Голубой', value: '#74c0fc' },
    { name: 'Синий', value: '#748ffc' },
    { name: 'Фиолетовый', value: '#b197fc' },
    { name: 'Розовый', value: '#f783ac' },
    { name: 'Серый', value: '#868e96' },
    { name: 'Белый', value: '#ffffff' },
];

export default function ColorPicker({ editor }) {
    const [isOpen, setIsOpen] = useState(false);

    const currentColor = editor?.getAttributes('textStyle')?.color || null;

    const close = useCallback(() => setIsOpen(false), []);

    // ── Закрытие по Escape ──
    useEffect(() => {
        if (!isOpen) return;
        const handleKey = (e) => {
            if (e.key === 'Escape') close();
        };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [isOpen, close]);

    const handleSelect = useCallback((color) => {
        if (!editor) return;
        if (color) {
            editor.chain().focus().setColor(color).run();
        } else {
            editor.chain().focus().unsetColor().run();
        }
        close();
    }, [editor, close]);

    return (
        <div className={styles.wrapper}>
            <button
                className={`${styles.trigger} ${isOpen ? styles.triggerOpen : ''}`}
                onClick={() => setIsOpen((prev) => !prev)}
                title="Цвет текста"
                aria-label="Цвет текста"
                aria-expanded={isOpen}
                type="button"
            >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                    aria-hidden="true">
                    <path d="M12 2L2 22h20L12 2z" fill="none" />
                    <path d="M7.5 16h9" />
                </svg>
                <span
                    className={styles.colorIndicator}
                    style={{ background: currentColor || '#e9f7ff' }}
                />
            </button>

            {isOpen && (
                <>
                    <div className={styles.overlay} onClick={close} />
                    <div className={styles.dropdown} role="listbox" aria-label="Выбор цвета">
                        <div className={styles.grid}>
                            {COLORS.map((c) => (
                                <button
                                    key={c.name}
                                    type="button"
                                    role="option"
                                    aria-selected={currentColor === c.value}
                                    className={`${styles.swatch} ${currentColor === c.value ? styles.swatchActive : ''}`}
                                    onClick={() => handleSelect(c.value)}
                                    title={c.name}
                                >
                                    {c.value ? (
                                        <span
                                            className={styles.swatchColor}
                                            style={{ background: c.value }}
                                        />
                                    ) : (
                                        <span className={styles.swatchReset}>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                                                stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                                                aria-hidden="true">
                                                <line x1="5" y1="5" x2="19" y2="19" />
                                                <circle cx="12" cy="12" r="10" />
                                            </svg>
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
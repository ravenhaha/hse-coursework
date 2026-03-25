import { useState, useCallback } from 'react';
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

export function ColorPicker({ editor }) {
    const [isOpen, setIsOpen] = useState(false);

    const currentColor = editor?.getAttributes('textStyle')?.color || null;

    const handleSelect = useCallback((color) => {
        if (!editor) return;
        if (color) {
            editor.chain().focus().setColor(color).run();
        } else {
            editor.chain().focus().unsetColor().run();
        }
        setIsOpen(false);
    }, [editor]);

    return (
        <div className={styles.wrapper}>
            <button
                className={`${styles.trigger} ${isOpen ? styles.triggerOpen : ''}`}
                onClick={() => setIsOpen(!isOpen)}
                title="Цвет текста"
            >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round">
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
                    <div className={styles.overlay} onClick={() => setIsOpen(false)} />
                    <div className={styles.dropdown}>
                        <div className={styles.grid}>
                            {COLORS.map((c) => (
                                <button
                                    key={c.name}
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
                                                stroke="currentColor" strokeWidth="2" strokeLinecap="round">
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
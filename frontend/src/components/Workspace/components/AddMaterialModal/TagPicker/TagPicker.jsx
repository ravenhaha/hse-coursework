import { useState, useCallback, useMemo } from 'react';
import styles from './TagPicker.module.css';

const PRESET_TAGS = [
    'лекция', 'семинар', 'домашка', 'экзамен',
    'конспект', 'формула', 'важно', 'повторить',
];

const MAX_TAG_LENGTH = 30;

export default function TagPicker({ selectedTags, onChange }) {
    const [input, setInput] = useState('');

    // Кастомные теги — считаем один раз
    const customTags = useMemo(
        () => selectedTags.filter((t) => !PRESET_TAGS.includes(t)),
        [selectedTags],
    );

    const toggleTag = useCallback((tag) => {
        if (selectedTags.includes(tag)) {
            onChange(selectedTags.filter((t) => t !== tag));
        } else {
            onChange([...selectedTags, tag]);
        }
    }, [selectedTags, onChange]);

    const handleAddCustom = useCallback(() => {
        const tag = input.trim().toLowerCase().slice(0, MAX_TAG_LENGTH);
        if (tag && !selectedTags.includes(tag)) {
            onChange([...selectedTags, tag]);
        }
        setInput('');
    }, [input, selectedTags, onChange]);

    const handleKeyDown = useCallback((e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddCustom();
        }
    }, [handleAddCustom]);

    const handleInput = useCallback((e) => {
        const value = e.target.value;
        if (value.length <= MAX_TAG_LENGTH) {
            setInput(value);
        }
    }, []);

    return (
        <div className={styles.container}>
            {/* Ввод своего тега */}
            <div className={styles.inputRow}>
                <input
                    className={styles.input}
                    type="text"
                    placeholder="Новый тег..."
                    value={input}
                    onChange={handleInput}
                    onKeyDown={handleKeyDown}
                    maxLength={MAX_TAG_LENGTH}
                    aria-label="Добавить свой тег"
                />
                {input.trim() && (
                    <button
                        type="button"
                        className={styles.addBtn}
                        onClick={handleAddCustom}
                        aria-label="Добавить тег"
                    >
                        <svg
                            width="14" height="14" viewBox="0 0 24 24"
                            fill="none" stroke="currentColor" strokeWidth="2.5"
                            strokeLinecap="round"
                            aria-hidden="true"
                        >
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                    </button>
                )}
            </div>

            {/* Пресеты */}
            <div className={styles.presets} role="group" aria-label="Готовые теги">
                {PRESET_TAGS.map((tag) => {
                    const isActive = selectedTags.includes(tag);
                    return (
                        <button
                            key={tag}
                            type="button"
                            className={`${styles.tag} ${isActive ? styles.tagActive : ''}`}
                            onClick={() => toggleTag(tag)}
                            aria-pressed={isActive}
                        >
                            #{tag}
                        </button>
                    );
                })}
            </div>

            {/* Кастомные теги */}
            {customTags.length > 0 && (
                <div
                    className={styles.custom}
                    role="group"
                    aria-label="Пользовательские теги"
                >
                    {customTags.map((tag) => (
                        <button
                            key={tag}
                            type="button"
                            className={`${styles.tag} ${styles.tagActive} ${styles.tagCustom}`}
                            onClick={() => toggleTag(tag)}
                            aria-label={`Удалить тег ${tag}`}
                        >
                            #{tag}
                            <svg
                                width="10" height="10" viewBox="0 0 24 24"
                                fill="none" stroke="currentColor" strokeWidth="2.5"
                                strokeLinecap="round"
                                aria-hidden="true"
                            >
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
import { useState, useCallback } from 'react';
import styles from './TagPicker.module.css';

const PRESETS = [
    { icon: '📖', name: 'Лекция' },
    { icon: '📝', name: 'Конспект' },
    { icon: '📰', name: 'Статья' },
    { icon: '📕', name: 'Книга' },
    { icon: '🎬', name: 'Видео' },
    { icon: '🎧', name: 'Подкаст' },
    { icon: '💡', name: 'Идея' },
    { icon: '🚀', name: 'Проект' },
    { icon: '✅', name: 'Задача' },
    { icon: '📐', name: 'Формула' },
    { icon: '💬', name: 'Цитата' },
    { icon: '💻', name: 'Код' },
];

export function TagPicker({ tags, setTags }) {
    const [input, setInput] = useState('');

    const addTag = useCallback((name) => {
        const trimmed = name.trim();
        if (!trimmed || tags.includes(trimmed)) return;
        setTags(prev => [...prev, trimmed]);
    }, [tags, setTags]);

    const removeTag = useCallback((tag) => {
        setTags(prev => prev.filter(t => t !== tag));
    }, [setTags]);

    const handleSubmit = useCallback((e) => {
        e.preventDefault();
        addTag(input);
        setInput('');
    }, [input, addTag]);

    const togglePreset = useCallback((name) => {
        if (tags.includes(name)) {
            removeTag(name);
        } else {
            addTag(name);
        }
    }, [tags, addTag, removeTag]);

    return (
        <div className={styles.wrapper}>
            <form className={styles.inputRow} onSubmit={handleSubmit}>
                <input
                    className={styles.input}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder="Добавьте тег..."
                    maxLength={30}
                    autoFocus
                />
                <button type="submit" className={styles.addBtn} disabled={!input.trim()}>
                    Добавить
                </button>
            </form>

            {tags.length > 0 && (
                <div className={styles.selectedTags}>
                    {tags.map(tag => (
                        <span key={tag} className={styles.selectedTag}>
                            {tag}
                            <button className={styles.removeTag} onClick={() => removeTag(tag)}>
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </span>
                    ))}
                </div>
            )}

            <div className={styles.presets}>
                {PRESETS.map(p => (
                    <button
                        key={p.name}
                        className={`${styles.preset} ${tags.includes(p.name) ? styles.presetActive : ''}`}
                        onClick={() => togglePreset(p.name)}
                    >
                        <span className={styles.presetIcon}>{p.icon}</span>
                        <span className={styles.presetName}>{p.name}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}
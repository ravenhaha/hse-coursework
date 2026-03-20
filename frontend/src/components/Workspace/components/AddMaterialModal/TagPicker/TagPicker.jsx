import { useState } from 'react';
import styles from './TagPicker.module.css';

const PRESET_TAGS = [
    { label: 'Лекция', icon: '🎓' },
    { label: 'Конспект', icon: '📝' },
    { label: 'Статья', icon: '📰' },
    { label: 'Книга', icon: '📚' },
    { label: 'Видео', icon: '🎬' },
    { label: 'Подкаст', icon: '🎧' },
    { label: 'Идея', icon: '💡' },
    { label: 'Проект', icon: '🚀' },
    { label: 'Задача', icon: '✅' },
    { label: 'Формула', icon: '🔬' },
    { label: 'Цитата', icon: '💬' },
    { label: 'Код', icon: '💻' },
];

const MAX_TAGS = 8;

export function TagPicker({ tags, setTags }) {
    const [input, setInput] = useState('');

    const getIcon = (label) => {
        const preset = PRESET_TAGS.find(p => p.label === label);
        return preset ? preset.icon : '🏷';
    };

    const addTag = (tag) => {
        const trimmed = tag.trim();
        if (!trimmed || tags.includes(trimmed) || tags.length >= MAX_TAGS) return;
        setTags([...tags, trimmed]);
        setInput('');
    };

    const removeTag = (tag) => {
        setTags(tags.filter(t => t !== tag));
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addTag(input);
        }
        if (e.key === 'Backspace' && !input && tags.length) {
            removeTag(tags[tags.length - 1]);
        }
    };

    const isFull = tags.length >= MAX_TAGS;

    return (
        <div className={styles.section}>
            <div className={styles.header}>
                <label className={styles.label}>Теги</label>
                <span className={`${styles.counter} ${isFull ? styles.counterFull : ''}`}>
                    {tags.length}/{MAX_TAGS}
                </span>
            </div>

            <div className={styles.list}>
                {tags.map(tag => (
                    <span key={tag} className={styles.tag}>
                        <span className={styles.tagIcon}>{getIcon(tag)}</span>
                        <span className={styles.tagText}>{tag}</span>
                        <button
                            type="button"
                            className={styles.remove}
                            onClick={() => removeTag(tag)}
                            aria-label={`Удалить тег ${tag}`}
                        >
                            ×
                        </button>
                    </span>
                ))}
                {!isFull && (
                    <input
                        className={styles.input}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={tags.length ? 'Ещё тег...' : 'Добавьте тег...'}
                        maxLength={30}
                    />
                )}
            </div>

            {!isFull && (
                <div className={styles.presets}>
                    {PRESET_TAGS
                        .filter(p => !tags.includes(p.label))
                        .map(preset => (
                            <button
                                key={preset.label}
                                type="button"
                                className={styles.preset}
                                onClick={() => addTag(preset.label)}
                            >
                                <span className={styles.presetIcon}>{preset.icon}</span>
                                {preset.label}
                            </button>
                        ))
                    }
                </div>
            )}
        </div>
    );
}
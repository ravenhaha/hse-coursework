import { useState } from 'react';
import styles from './TagPicker.module.css';

const PRESET_TAGS = [
    'Лекция', 'Конспект', 'Статья', 'Книга',
    'Видео', 'Подкаст', 'Идея', 'Проект', 'Задача'
];

export function TagPicker({ tags, setTags }) {
    const [input, setInput] = useState('');

    const addTag = (tag) => {
        const trimmed = tag.trim();
        if (trimmed && !tags.includes(trimmed)) {
            setTags([...tags, trimmed]);
        }
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

    return (
        <div className={styles.section}>
            <label className={styles.label}>Теги</label>

            <div className={styles.list}>
                {tags.map(tag => (
                    <span key={tag} className={styles.tag}>
                        {tag}
                        <button
                            type="button"
                            className={styles.remove}
                            onClick={() => removeTag(tag)}
                        >
                            ×
                        </button>
                    </span>
                ))}
                <input
                    className={styles.input}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={tags.length ? '' : 'Добавьте тег...'}
                />
            </div>

            <div className={styles.presets}>
                {PRESET_TAGS.filter(t => !tags.includes(t)).map(tag => (
                    <button
                        key={tag}
                        type="button"
                        className={styles.preset}
                        onClick={() => addTag(tag)}
                    >
                        + {tag}
                    </button>
                ))}
            </div>
        </div>
    );
}
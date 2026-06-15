import { useState, useCallback, useEffect } from 'react';
import { ACTIONS } from '../state';
import TagPicker from '../TagPicker/TagPicker';
import styles from './GlobalActions.module.css';

export default function GlobalActions({
    commonFileTags,
    commonFileImportant,
    filesCount,
    dispatch,
}) {
    const [showTags, setShowTags] = useState(false);

    const toggleTags = useCallback(() => {
        setShowTags((prev) => !prev);
    }, []);

    const closeTags = useCallback(() => {
        setShowTags(false);
    }, []);

    // Закрытие по Escape
    useEffect(() => {
        if (!showTags) return;
        const handleKey = (e) => {
            if (e.key === 'Escape') closeTags();
        };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [showTags, closeTags]);

    if (filesCount === 0) return null;

    return (
        <div className={styles.container}>
            <span className={styles.label}>
                Ко всем ({filesCount}):
            </span>

            {/* Важное */}
            <button
                type="button"
                className={`${styles.btn} ${commonFileImportant ? styles.importantActive : ''}`}
                onClick={() => dispatch({ type: ACTIONS.TOGGLE_COMMON_FILE_IMPORTANT })}
                title={commonFileImportant ? 'Убрать пометку со всех' : 'Пометить все важными'}
                aria-label={commonFileImportant ? 'Убрать пометку со всех' : 'Пометить все важными'}
                aria-pressed={commonFileImportant}
            >
                <svg
                    width="14" height="14" viewBox="0 0 24 24"
                    fill={commonFileImportant ? 'currentColor' : 'none'}
                    stroke="currentColor" strokeWidth="2"
                    aria-hidden="true"
                >
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                Важное
            </button>

            {/* Теги */}
            <button
                type="button"
                className={`${styles.btn} ${showTags ? styles.btnActive : ''}`}
                onClick={toggleTags}
                title="Теги для всех файлов"
                aria-label="Теги для всех файлов"
                aria-expanded={showTags}
            >
                <svg
                    width="14" height="14" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" strokeWidth="2"
                    strokeLinecap="round" strokeLinejoin="round"
                    aria-hidden="true"
                >
                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
                    <line x1="7" y1="7" x2="7.01" y2="7" />
                </svg>
                Теги
                {commonFileTags.length > 0 && (
                    <span className={styles.badge}>{commonFileTags.length}</span>
                )}
            </button>

            {/* Панель тегов */}
            {showTags && (
                <div className={styles.tagPickerWrap}>
                    <div className={styles.tagPickerHeader}>
                        <span className={styles.tagPickerTitle}>
                            Общие теги для всех файлов
                        </span>
                        {commonFileTags.length > 0 && (
                            <button
                                type="button"
                                className={styles.tagPickerClear}
                                onClick={() =>
                                    dispatch({ type: ACTIONS.SET_COMMON_FILE_TAGS, payload: [] })
                                }
                            >
                                Очистить
                            </button>
                        )}
                    </div>
                    <TagPicker
                        selectedTags={commonFileTags}
                        onChange={(tags) =>
                            dispatch({ type: ACTIONS.SET_COMMON_FILE_TAGS, payload: tags })
                        }
                    />
                </div>
            )}
        </div>
    );
}
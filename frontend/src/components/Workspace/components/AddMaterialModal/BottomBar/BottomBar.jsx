import { useState, useCallback } from 'react';
import { TagPicker } from '../TagPicker/TagPicker';
import styles from './BottomBar.module.css';

export function BottomBar({
    onFileClick,
    isRecording,
    onRecordToggle,
    tags,
    setTags,
    isImportant,
    onImportantToggle,
    wordCount,
    onSave,
}) {
    const [showTags, setShowTags] = useState(false);

    const toggleTags = useCallback(() => {
        setShowTags(prev => !prev);
    }, []);

    return (
        <div className={styles.bar}>
            <div className={styles.row}>
                <div className={styles.actions}>
                    <button className={styles.actionBtn} onClick={onFileClick} title="Прикрепить файл">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                        </svg>
                    </button>

                    <button
                        className={`${styles.actionBtn} ${isRecording ? styles.recording : ''}`}
                        onClick={onRecordToggle}
                        title={isRecording ? 'Остановить запись' : 'Записать аудио'}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                            <line x1="12" y1="19" x2="12" y2="23" />
                            <line x1="8" y1="23" x2="16" y2="23" />
                        </svg>
                    </button>

                    <div className={styles.tagWrapper}>
                        <button
                            className={`${styles.actionBtn} ${showTags ? styles.actionBtnActive : ''}`}
                            onClick={toggleTags}
                            title="Теги"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                                stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                                <line x1="7" y1="7" x2="7.01" y2="7" />
                            </svg>
                            {tags.length > 0 && (
                                <span className={styles.badge}>{tags.length}</span>
                            )}
                        </button>

                        {showTags && (
                            <>
                                <div className={styles.tagOverlay} onClick={() => setShowTags(false)} />
                                <div className={styles.tagPopup}>
                                    <div className={styles.tagPopupHeader}>
                                        <span className={styles.tagPopupTitle}>Теги</span>
                                        {tags.length > 0 && (
                                            <button
                                                className={styles.tagClearBtn}
                                                onClick={() => setTags([])}
                                            >
                                                Очистить все
                                            </button>
                                        )}
                                    </div>
                                    <TagPicker tags={tags} setTags={setTags} />
                                </div>
                            </>
                        )}
                    </div>

                    <button
                        className={`${styles.actionBtn} ${isImportant ? styles.important : ''}`}
                        onClick={onImportantToggle}
                        title={isImportant ? 'Убрать из важных' : 'Отметить как важное'}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24"
                            fill={isImportant ? 'currentColor' : 'none'}
                            stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                    </button>
                </div>

                <div className={styles.right}>
                    <span className={styles.wordCount}>
                        {wordCount} {wordCount === 1 ? 'слово' : wordCount < 5 ? 'слова' : 'слов'}
                    </span>

                    <button className={styles.saveBtn} onClick={onSave}>
                        Создать материал
                    </button>
                </div>
            </div>
        </div>
    );
}
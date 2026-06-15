import { useState, useCallback, useEffect } from 'react';
import TagPicker from '../TagPicker/TagPicker';
import { getFilePreview } from '../../../../../utils/filePreview';
import styles from './FilesList.module.css';

/* ── Утилиты ── */

function formatSize(bytes) {
    if (!bytes || bytes <= 0) return '0 Б';
    const units = ['Б', 'КБ', 'МБ', 'ГБ'];
    const i = Math.min(
        Math.floor(Math.log(bytes) / Math.log(1024)),
        units.length - 1,
    );
    return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function getFileExt(name) {
    if (!name) return '';
    const dot = name.lastIndexOf('.');
    return dot >= 0 ? name.slice(dot + 1).toUpperCase() : '';
}

function getFileIconSvg(type) {
    if (!type) return 'file';
    if (type.startsWith('image/')) return 'image';
    if (type.startsWith('video/')) return 'video';
    if (type.startsWith('audio/')) return 'audio';
    if (type.includes('pdf')) return 'pdf';
    if (type.includes('word') || type.includes('document')) return 'doc';
    if (type.includes('sheet') || type.includes('excel')) return 'sheet';
    return 'file';
}

const ICON_PATHS = {
    image: 'M4 5a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm2 12l4-5 3 3 2-2 3 4H6z',
    video: 'M15 10l5-3v10l-5-3M4 6h9a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2z',
    audio: 'M9 18V5l12-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zm12-2a3 3 0 11-6 0 3 3 0 016 0z',
    pdf: 'M7 21h10a2 2 0 002-2V9l-6-6H7a2 2 0 00-2 2v14a2 2 0 002 2zm6-18v6h6',
    doc: 'M7 21h10a2 2 0 002-2V9l-6-6H7a2 2 0 00-2 2v14a2 2 0 002 2zm2-10h6m-6 4h6m-6 4h4',
    sheet: 'M7 21h10a2 2 0 002-2V9l-6-6H7a2 2 0 00-2 2v14a2 2 0 002 2zm2-10h6m-6 3h6m-6 3h6M9 8v10',
    file: 'M7 21h10a2 2 0 002-2V9l-6-6H7a2 2 0 00-2 2v14a2 2 0 002 2zm6-18v6h6',
};

function FileIcon({ type }) {
    const icon = getFileIconSvg(type);
    return (
        <svg
            width="16" height="16" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d={ICON_PATHS[icon]} />
        </svg>
    );
}

/* ── FileItem ── */

export default function FileItem({ item, onRemove, onToggleImportant, onUpdateTags }) {
    const [showTags, setShowTags] = useState(false);

    const { file, tags, isImportant } = item;
    const ext = getFileExt(file.name);

    // ✅ Превью берётся из кеша. Один URL на один File за всё время жизни.
    // StrictMode mount→unmount→mount не ломает: URL переиспользуется.
    // Освобождение — в FilesList через releaseFilePreview при удалении.
    const preview = getFilePreview(file);

    const toggleTags = useCallback(() => {
        setShowTags((prev) => !prev);
    }, []);

    const closeTags = useCallback(() => {
        setShowTags(false);
    }, []);

    // Закрытие панели тегов по Escape
    useEffect(() => {
        if (!showTags) return;
        const handleKey = (e) => {
            if (e.key === 'Escape') closeTags();
        };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [showTags, closeTags]);

    return (
        <div className={styles.itemWrapper}>
            <div className={styles.item}>
                {/* Иконка / превью */}
                {preview ? (
                    <img
                        src={preview}
                        alt=""
                        className={styles.preview}
                        aria-hidden="true"
                    />
                ) : (
                    <div className={styles.fileIcon}>
                        <FileIcon type={file.type} />
                        {ext && <span className={styles.ext}>{ext}</span>}
                    </div>
                )}

                {/* Имя и размер */}
                <span className={styles.name} title={file.name}>
                    {file.name}
                </span>

                <span className={styles.size}>
                    {formatSize(file.size)}
                </span>

                {/* Действия */}
                <button
                    type="button"
                    className={`${styles.actionBtn} ${isImportant ? styles.actionBtnImportant : ''}`}
                    onClick={onToggleImportant}
                    title={isImportant ? 'Убрать пометку' : 'Пометить важным'}
                    aria-label={isImportant ? 'Убрать пометку' : 'Пометить важным'}
                    aria-pressed={isImportant}
                >
                    <svg
                        width="14" height="14" viewBox="0 0 24 24"
                        fill={isImportant ? 'currentColor' : 'none'}
                        stroke="currentColor" strokeWidth="2"
                        aria-hidden="true"
                    >
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                </button>

                <button
                    type="button"
                    className={`${styles.actionBtn} ${showTags ? styles.actionBtnActive : ''}`}
                    onClick={toggleTags}
                    title="Теги"
                    aria-label="Теги"
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
                    {tags.length > 0 && (
                        <span className={styles.tagBadge}>{tags.length}</span>
                    )}
                </button>

                <button
                    type="button"
                    className={styles.remove}
                    onClick={onRemove}
                    title="Удалить файл"
                    aria-label="Удалить файл"
                >
                    <svg
                        width="14" height="14" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor" strokeWidth="2"
                        strokeLinecap="round" aria-hidden="true"
                    >
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>
            </div>

            {/* Панель тегов */}
            {showTags && (
                <div className={styles.fileTagsPanel}>
                    <div className={styles.fileTagsHeader}>
                        <span className={styles.fileTagsTitle}>
                            Теги для {file.name}
                        </span>
                        {tags.length > 0 && (
                            <button
                                type="button"
                                className={styles.fileTagsClear}
                                onClick={() => onUpdateTags([])}
                            >
                                Очистить
                            </button>
                        )}
                    </div>
                    <TagPicker
                        selectedTags={tags}
                        onChange={onUpdateTags}
                    />
                </div>
            )}
        </div>
    );
}
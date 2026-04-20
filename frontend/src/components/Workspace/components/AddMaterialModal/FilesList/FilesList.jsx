import { useMemo, useEffect } from 'react';
import styles from './FilesList.module.css';

const IMAGE_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
]);

function formatSize(bytes) {
    if (!bytes || bytes <= 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
}

function getExtension(name) {
    if (!name) return '';
    const parts = name.split('.');
    if (parts.length < 2) return '';
    return parts.pop().toUpperCase();
}

function FileItem({ file, fileId, onRemove }) {
    const isImage = file instanceof Blob && IMAGE_TYPES.has(file.type);

    const src = useMemo(() => {
        if (!isImage) return null;
        return URL.createObjectURL(file);
    }, [file, isImage]);

    useEffect(() => {
        return () => {
            if (src) URL.revokeObjectURL(src);
        };
    }, [src]);

    const ext = useMemo(() => getExtension(file.name), [file.name]);

    return (
        <div className={styles.item}>
            {src ? (
                <img src={src} alt="" className={styles.preview} />
            ) : (
                <div className={styles.fileIcon}>
                    <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                    >
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                    </svg>
                    {ext && <span className={styles.ext}>{ext}</span>}
                </div>
            )}

            <span className={styles.name} title={file.name}>
                {file.name}
            </span>

            <span className={styles.size}>
                {formatSize(file.size)}
            </span>

            <button
                type="button"
                className={styles.remove}
                onClick={() => onRemove(fileId)}
                aria-label={`Удалить ${file.name}`}
            >
                <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
            </button>
        </div>
    );
}

export function FilesList({ files, onRemove }) {
    if (!files.length) return null;

    return (
        <div className={styles.list} role="list">
            {files.map((file) => (
                <FileItem
                    key={file._id}
                    file={file}
                    fileId={file._id}
                    onRemove={onRemove}
                />
            ))}
        </div>
    );
}
import { useState, useEffect } from 'react';
import styles from './FilesList.module.css';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];

function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
}

function FileItem({ file, index, onRemove }) {
    const isImage = file instanceof Blob && IMAGE_TYPES.includes(file.type);
    const [src, setSrc] = useState(null);

    useEffect(() => {
        if (!isImage) return;

        let cancelled = false;
        const reader = new FileReader();

        reader.onload = () => {
            if (!cancelled) setSrc(reader.result);
        };

        reader.readAsDataURL(file);

        return () => {
            cancelled = true;
            reader.abort();
        };
    }, [file, isImage]);

    return (
        <div className={styles.item}>
            {src ? (
                <img src={src} alt="" className={styles.preview} />
            ) : (
                <div className={styles.fileIcon}>
                    <svg width="18" height="18" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <span className={styles.ext}>
                        {file.name.split('.').pop()?.toUpperCase()}
                    </span>
                </div>
            )}
            <span className={styles.name} title={file.name}>{file.name}</span>
            <span className={styles.size}>{formatSize(file.size)}</span>
            <button className={styles.remove} onClick={() => onRemove(index)} title="Удалить">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round">
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
        <div className={styles.list}>
            {files.map((file, i) => (
                <FileItem key={`${file.name}-${file.size}-${i}`} file={file} index={i} onRemove={onRemove} />
            ))}
        </div>
    );
}
import { useState, useCallback, useRef } from 'react';
import styles from './DropZone.module.css';

export function DropZone({ onFiles, onManualCreate }) {
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef(null);
    const dragCounter = useRef(0);

    const handleDragEnter = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current++;
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current--;
        if (dragCounter.current === 0) setIsDragging(false);
    }, []);

    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current = 0;
        setIsDragging(false);

        const droppedFiles = Array.from(e.dataTransfer.files);
        if (droppedFiles.length > 0) {
            onFiles(droppedFiles);
        }
    }, [onFiles]);

    const handleBrowse = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    const handleFileSelect = useCallback((e) => {
        const selected = Array.from(e.target.files);
        if (selected.length > 0) {
            onFiles(selected);
        }
        e.target.value = '';
    }, [onFiles]);

    return (
        <div className={styles.wrapper}>
            <div
                className={`${styles.zone} ${isDragging ? styles.zoneDragging : ''}`}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
            >
                <div className={styles.icon}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                </div>

                <div className={styles.title}>
                    Перетащите файлы сюда
                </div>
                <div className={styles.subtitle}>
                    или{' '}
                    <button
                        type="button"
                        className={styles.browseBtn}
                        onClick={handleBrowse}
                    >
                        выберите на компьютере
                    </button>
                </div>
                <div className={styles.hint}>
                    Документы, изображения, аудио — любые файлы
                </div>
            </div>

            <div className={styles.divider}>
                <span className={styles.dividerLine} />
                <span className={styles.dividerText}>или</span>
                <span className={styles.dividerLine} />
            </div>

            <button
                type="button"
                className={styles.manualBtn}
                onClick={onManualCreate}
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
                Создать материал вручную
            </button>

            <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                tabIndex={-1}
                aria-label="Выбрать файлы"
                className={styles.hiddenInput}
            />
        </div>
    );
}
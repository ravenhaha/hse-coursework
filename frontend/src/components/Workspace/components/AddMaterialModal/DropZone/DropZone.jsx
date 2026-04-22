import { useRef, useState, useCallback } from 'react';
import styles from './DropZone.module.css';

export default function DropZone({ onFilesAdded }) {
    const inputRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);

    const handleFiles = useCallback((files) => {
        if (files && files.length > 0) {
            onFilesAdded(files);
        }
    }, [onFilesAdded]);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        setIsDragging(false);
        handleFiles(e.dataTransfer.files);
    }, [handleFiles]);

    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        setIsDragging((prev) => {
            if (!prev) return true;
            return prev;
        });
    }, []);

    const handleDragLeave = useCallback((e) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleClick = useCallback(() => {
        inputRef.current?.click();
    }, []);

    const handleInputChange = useCallback((e) => {
        handleFiles(e.target.files);
        e.target.value = '';
    }, [handleFiles]);

    return (
        <div
            className={`${styles.zone} ${isDragging ? styles.dragging : ''}`}
            role="button"
            tabIndex={0}
            aria-label="Область загрузки файлов. Нажмите или перетащите файлы"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={handleClick}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleClick();
                }
            }}
        >
            <input
                ref={inputRef}
                type="file"
                multiple
                className={styles.input}
                onChange={handleInputChange}
                tabIndex={-1}
            />
            <div className={styles.content}>
                <span className={styles.icon} aria-hidden="true">📂</span>
                <p className={styles.text}>
                    Перетащите файлы сюда или <span className={styles.link}>выберите</span>
                </p>
                <p className={styles.hint}>
                    PDF, DOCX, изображения, аудио, видео
                </p>
            </div>
        </div>
    );
}
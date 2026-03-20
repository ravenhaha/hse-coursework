import { useState, useRef } from 'react';
import styles from './CoverUpload.module.css';

export function CoverUpload({ cover, setCover }) {
    const [isDragging, setIsDragging] = useState(false);
    const inputRef = useRef(null);

    const handleFile = (file) => {
        if (!file || !file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = () => setCover(reader.result);
        reader.readAsDataURL(file);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        handleFile(e.dataTransfer.files[0]);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    return (
        <div className={styles.wrapper}>
            {cover ? (
                <div className={styles.preview}>
                    <img src={cover} alt="Обложка" className={styles.image} />
                    <div className={styles.previewOverlay}>
                        <button
                            className={styles.changeBtn}
                            onClick={() => inputRef.current?.click()}
                        >
                            Изменить
                        </button>
                        <button
                            className={styles.removeBtn}
                            onClick={() => setCover(null)}
                        >
                            Удалить
                        </button>
                    </div>
                </div>
            ) : (
                <div
                    className={`${styles.dropArea} ${isDragging ? styles.dropAreaActive : ''}`}
                    onClick={() => inputRef.current?.click()}
                    onDragOver={handleDragOver}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                    </svg>
                    <span>Добавить обложку</span>
                </div>
            )}
            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className={styles.hiddenInput}
                onChange={(e) => handleFile(e.target.files[0])}
            />
        </div>
    );
}
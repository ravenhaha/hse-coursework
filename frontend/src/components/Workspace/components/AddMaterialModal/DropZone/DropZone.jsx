import { useState, useRef } from 'react';
import styles from './DropZone.module.css';

export function DropZone({ editor, files, setFiles }) {
    const [isDragging, setIsDragging] = useState(false);
    const inputRef = useRef(null);

    const processFiles = (fileList) => {
        const newFiles = Array.from(fileList);

        newFiles.forEach((file) => {
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = () => {
                    editor?.chain().focus().setImage({ src: reader.result }).run();
                };
                reader.readAsDataURL(file);
            }
        });

        setFiles((prev) => [...prev, ...newFiles]);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        processFiles(e.dataTransfer.files);
    };

    const handleClick = () => {
        inputRef.current?.click();
    };

    const handleInputChange = (e) => {
        processFiles(e.target.files);
        e.target.value = '';
    };

    const removeFile = (index) => {
        setFiles((prev) => prev.filter((_, i) => i !== index));
    };

    const formatSize = (bytes) => {
        if (bytes < 1024) return bytes + ' Б';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ';
        return (bytes / (1024 * 1024)).toFixed(1) + ' МБ';
    };

    const getFileIcon = (type) => {
        if (type.startsWith('image/')) return '🖼️';
        if (type.startsWith('audio/')) return '🎵';
        if (type.startsWith('video/')) return '🎬';
        if (type.includes('pdf')) return '📄';
        if (type.includes('word') || type.includes('document')) return '📝';
        if (type.includes('sheet') || type.includes('excel')) return '📊';
        if (type.includes('presentation') || type.includes('powerpoint')) return '📑';
        if (type.includes('zip') || type.includes('rar') || type.includes('archive')) return '📦';
        return '📎';
    };

    return (
        <div className={styles.wrapper}>
            <div
                className={`${styles.dropZone} ${isDragging ? styles.active : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={handleClick}
            >
                <input
                    ref={inputRef}
                    type="file"
                    multiple
                    className={styles.hiddenInput}
                    onChange={handleInputChange}
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.txt,.mp3,.mp4"
                />

                <div className={styles.iconRow}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                </div>

                <span className={styles.text}>
                    Перетащите файлы сюда или нажмите для загрузки
                </span>
                <span className={styles.hint}>
                    Изображения, PDF, документы, аудио, видео
                </span>
            </div>

            {files.length > 0 && (
                <div className={styles.fileList}>
                    {files.map((file, index) => (
                        <div key={index} className={styles.fileItem}>
                            <span className={styles.fileIcon}>
                                {getFileIcon(file.type)}
                            </span>
                            <div className={styles.fileInfo}>
                                <span className={styles.fileName}>{file.name}</span>
                                <span className={styles.fileSize}>{formatSize(file.size)}</span>
                            </div>
                            <button
                                className={styles.removeBtn}
                                onClick={() => removeFile(index)}
                                title="Удалить"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                                    stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
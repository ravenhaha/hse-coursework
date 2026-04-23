import { useEffect, useCallback } from 'react';
import { IoDocumentTextOutline, IoPricetagOutline } from 'react-icons/io5';
import styles from './NodePreviewModal.module.css';

// Отдельная модалка для превью файла (узла-документа) в графе.
// Держим её независимой от общего Ui/Modal — чтобы можно было в будущем
// легко менять вёрстку под превью, не влияя на другие модалки проекта.
export default function NodePreviewModal({ node, onClose, onOpenFull }) {
    const handleKeyDown = useCallback(
        (e) => {
            if (e.key === 'Escape') onClose();
        },
        [onClose]
    );

    useEffect(() => {
        if (!node) return;
        document.body.classList.add('no-scroll');
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.body.classList.remove('no-scroll');
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [node, handleKeyDown]);

    if (!node) return null;

    const { name, content, tags } = node;

    return (
        <div
            className={styles.overlay}
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-label={name}
        >
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <div className={styles.titleRow}>
                        <IoDocumentTextOutline className={styles.titleIcon} />
                        <h2 className={styles.title}>{name}</h2>
                    </div>
                    <button type="button" className={styles.close} onClick={onClose} aria-label="Закрыть">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {tags && tags.length > 0 && (
                    <div className={styles.tags}>
                        {tags.map((tag) => (
                            <span className={styles.tag} key={tag}>
                                <IoPricetagOutline />
                                {tag}
                            </span>
                        ))}
                    </div>
                )}

                <div className={styles.body}>
                    {content ? (
                        <p className={styles.snippet}>{content}</p>
                    ) : (
                        <p className={styles.empty}>Пока пусто. Откройте материал, чтобы добавить содержимое.</p>
                    )}
                </div>

                <div className={styles.footer}>
                    <button type="button" className={styles.secondary} onClick={onClose}>
                        Закрыть
                    </button>
                    {onOpenFull && (
                        <button type="button" className={styles.primary} onClick={() => onOpenFull(node)}>
                            Открыть полностью
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
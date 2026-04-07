import { useEffect, useCallback, useRef } from 'react';
import styles from './Modal.module.css';

let openCount = 0;

export function Modal({ isOpen, onClose, title, children }) {
    const wasOpenRef = useRef(false);

    const handleKeyDown = useCallback((e) => {
        if (e.key === 'Escape') onClose();
    }, [onClose]);

    useEffect(() => {
        if (isOpen && !wasOpenRef.current) {
            openCount++;
            wasOpenRef.current = true;
            document.body.classList.add('no-scroll');
            document.addEventListener('keydown', handleKeyDown);
        } else if (!isOpen && wasOpenRef.current) {
            openCount--;
            wasOpenRef.current = false;
            if (openCount === 0) {
                document.body.classList.remove('no-scroll');
            }
            document.removeEventListener('keydown', handleKeyDown);
        }

        return () => {
            if (wasOpenRef.current) {
                openCount--;
                wasOpenRef.current = false;
                if (openCount === 0) {
                    document.body.classList.remove('no-scroll');
                }
            }
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, handleKeyDown]);

    if (!isOpen) return null;

    return (
        <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2 className={styles.title}>{title}</h2>
                    <button className={styles.close} onClick={onClose}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            strokeWidth="2" strokeLinecap="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}
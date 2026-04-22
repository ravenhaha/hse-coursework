import { useEffect, useRef } from 'react';
import styles from './Modal.module.css';

const openModals = new Set();

function updateBodyScroll() {
    if (openModals.size > 0) {
        document.body.classList.add('no-scroll');
    } else {
        document.body.classList.remove('no-scroll');
    }
}

export function Modal({
    isOpen,
    onClose,
    title,
    children,
}) {
    const modalRef = useRef(null);
    const previousFocusRef = useRef(null);
    const onCloseRef = useRef(onClose);

    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    // Scroll lock + focus management
    useEffect(() => {
        if (!isOpen) return;

        const id = Symbol('modal');
        openModals.add(id);
        updateBodyScroll();

        previousFocusRef.current = document.activeElement;

        const raf = requestAnimationFrame(() => {
            modalRef.current?.focus();
        });

        return () => {
            cancelAnimationFrame(raf);
            openModals.delete(id);
            updateBodyScroll();
            previousFocusRef.current?.focus?.();
        };
    }, [isOpen]);

    // Keyboard: focus trap only (no Escape close)
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e) => {
            if (e.key === 'Tab' && modalRef.current) {
                const focusable = modalRef.current.querySelectorAll(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
                );
                if (focusable.length === 0) return;

                const first = focusable[0];
                const last = focusable[focusable.length - 1];

                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div
            className={styles.overlay}
            role="presentation"
        >
            <div
                ref={modalRef}
                className={styles.modal}
                role="dialog"
                aria-modal="true"
                aria-label={title}
                tabIndex={-1}
            >
                <div className={styles.header}>
                    <h2 className={styles.title}>{title}</h2>
                    <button
                        type="button"
                        className={styles.close}
                        onClick={onClose}
                        aria-label="Закрыть"
                    >
                        <svg
                            width="18" height="18" viewBox="0 0 24 24"
                            fill="none" stroke="currentColor"
                            strokeWidth="2" strokeLinecap="round"
                            aria-hidden="true"
                        >
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
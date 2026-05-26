import { useEffect, useCallback, useId, useRef } from 'react';
import styles from './Modal.module.css';

let openCount = 0;
const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(',');

export function Modal({ isOpen, onClose, title, children }) {
    const titleId = useId();
    const modalRef = useRef(null);
    const previousFocusRef = useRef(null);
    const wasOpenRef = useRef(false);

    // Focus trap on Tab (no Escape close, no overlay close — by design)
    const handleKeyDown = useCallback((e) => {
        if (e.key !== 'Tab' || !modalRef.current) return;

        const focusable = Array.from(modalRef.current.querySelectorAll(FOCUSABLE_SELECTOR));
        if (focusable.length === 0) {
            e.preventDefault();
            return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    }, []);

    useEffect(() => {
        if (isOpen && !wasOpenRef.current) {
            previousFocusRef.current = document.activeElement;
            openCount++;
            wasOpenRef.current = true;
            document.body.classList.add('no-scroll');
            document.addEventListener('keydown', handleKeyDown);
            requestAnimationFrame(() => {
                const firstFocusable = modalRef.current?.querySelector(FOCUSABLE_SELECTOR);
                firstFocusable?.focus();
            });
        } else if (!isOpen && wasOpenRef.current) {
            openCount = Math.max(0, openCount - 1);
            wasOpenRef.current = false;
            if (openCount === 0) {
                document.body.classList.remove('no-scroll');
            }
            document.removeEventListener('keydown', handleKeyDown);
            previousFocusRef.current?.focus?.();
        }

        return () => {
            if (wasOpenRef.current) {
                openCount = Math.max(0, openCount - 1);
                wasOpenRef.current = false;
                if (openCount === 0) {
                    document.body.classList.remove('no-scroll');
                }
                document.removeEventListener('keydown', handleKeyDown);
                previousFocusRef.current?.focus?.();
            }
        };
    }, [isOpen, handleKeyDown]);

    if (!isOpen) return null;

    return (
        <div className={styles.overlay} role="presentation">
            <div
                ref={modalRef}
                className={styles.modal}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
            >
                <div className={styles.header}>
                    <h2 id={titleId} className={styles.title}>{title}</h2>
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
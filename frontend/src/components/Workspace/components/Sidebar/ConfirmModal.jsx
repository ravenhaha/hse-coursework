import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { IoWarningOutline, IoCloseOutline } from 'react-icons/io5';
import styles from './ConfirmModal.module.css';

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Подтвердить',
  cancelLabel = 'Отмена',
  danger = false,
  onConfirm,
  onCancel,
}) {
  const [isBusy, setIsBusy] = useState(false);
  const confirmBtnRef = useRef(null);
  const cancelBtnRef = useRef(null);
  const overlayRef = useRef(null);

  // фокус на «Подтвердить» при открытии
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => {
        confirmBtnRef.current?.focus();
      });
      setIsBusy(false);
    }
  }, [isOpen]);

  const handleConfirm = useCallback(async () => {
    if (isBusy) return;
    try {
      setIsBusy(true);
      await onConfirm?.();
    } finally {
      setIsBusy(false);
    }
  }, [isBusy, onConfirm]);

  // ESC + Enter + Tab focus trap
  useEffect(() => {
    if (!isOpen) return;

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (!isBusy) onCancel?.();
      } else if (e.key === 'Enter') {
        if (document.activeElement === cancelBtnRef.current) return;
        e.preventDefault();
        handleConfirm();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        if (document.activeElement === confirmBtnRef.current) {
          cancelBtnRef.current?.focus();
        } else {
          confirmBtnRef.current?.focus();
        }
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, isBusy, onCancel, handleConfirm]);

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current && !isBusy) {
      onCancel?.();
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      ref={overlayRef}
      className={styles.overlay}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      aria-describedby={message ? 'confirm-message' : undefined}
    >
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={`${styles.iconWrap} ${danger ? styles.iconDanger : ''}`}>
            <IoWarningOutline />
          </div>
          <h2 id="confirm-title" className={styles.title}>
            {title}
          </h2>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={() => !isBusy && onCancel?.()}
            aria-label="Закрыть"
            disabled={isBusy}
          >
            <IoCloseOutline />
          </button>
        </div>

        {message && (
          <div id="confirm-message" className={styles.message}>
            {message}
          </div>
        )}

        <div className={styles.actions}>
          <button
            ref={cancelBtnRef}
            type="button"
            className={styles.btnSecondary}
            onClick={onCancel}
            disabled={isBusy}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            className={`${styles.btnPrimary} ${danger ? styles.btnDanger : ''}`}
            onClick={handleConfirm}
            disabled={isBusy}
          >
            {isBusy ? '...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
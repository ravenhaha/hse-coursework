import { useEffect, useRef, useState } from 'react';
import styles from './Toast.module.css';

const TYPE_META = {
  info:    { icon: 'ℹ️', toastClass: styles.toastInfo,    progressClass: styles.progressInfo },
  success: { icon: '✅', toastClass: styles.toastSuccess, progressClass: styles.progressSuccess },
  error:   { icon: '⚠️', toastClass: styles.toastError,   progressClass: styles.progressError },
  warning: { icon: '🟡', toastClass: styles.toastWarning, progressClass: styles.progressWarning },
};

export default function Toast({ toast, onAction, onClose }) {
  const [visible, setVisible] = useState(false);
  const [paused, setPaused] = useState(false);

  const meta = TYPE_META[toast.type] ?? TYPE_META.info;
  const duration = toast.duration ?? 5000;

  const fillRef = useRef(null);
  const startedAtRef = useRef(null);
  const remainingRef = useRef(duration);
  const rafRef = useRef(null);

  // Появление с задержкой для transition
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  // Прогресс-бар
  useEffect(() => {
    if (duration <= 0) return;

    const tick = () => {
      if (!fillRef.current) return;
      const elapsed = performance.now() - startedAtRef.current;
      const left = Math.max(0, remainingRef.current - elapsed);
      const pct = (left / duration) * 100;
      fillRef.current.style.width = `${pct}%`;
      if (left > 0 && !paused) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    if (!paused) {
      startedAtRef.current = performance.now();
      rafRef.current = requestAnimationFrame(tick);
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (paused && startedAtRef.current != null) {
        const elapsed = performance.now() - startedAtRef.current;
        remainingRef.current = Math.max(0, remainingRef.current - elapsed);
      }
    };
  }, [paused, duration]);

  const toastClassName = [
    styles.toast,
    meta.toastClass,
    visible ? styles.toastVisible : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={toastClassName}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {duration > 0 && (
        <div
          ref={fillRef}
          className={`${styles.progress} ${meta.progressClass}`}
        />
      )}

      <div className={styles.body}>
        <span className={styles.icon}>{meta.icon}</span>
        <span className={styles.message}>{toast.message}</span>

        {toast.actionLabel && (
          <button
            type="button"
            className={styles.actionButton}
            onClick={() => onAction(toast.id)}
          >
            {toast.actionLabel}
          </button>
        )}

        <button
          type="button"
          className={styles.closeButton}
          onClick={() => onClose(toast.id)}
          title="Закрыть"
          aria-label="Закрыть уведомление"
        >
          ×
        </button>
      </div>
    </div>
  );
}
import { useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import styles from './ContextMenu.module.css';

export default function ContextMenu({ x, y, items, onClose }) {
  const ref = useRef(null);

  // Закрытие по клику вне / Esc / скроллу / resize
  useEffect(() => {
    const handleDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleDown);
    document.addEventListener('keydown', handleKey);
    window.addEventListener('scroll', onClose, true);
    window.addEventListener('resize', onClose);
    return () => {
      document.removeEventListener('mousedown', handleDown);
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('scroll', onClose, true);
      window.removeEventListener('resize', onClose);
    };
  }, [onClose]);

  // Корректировка позиции — напрямую через DOM, без setState
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let nx = x;
    let ny = y;
    if (x + rect.width + 8 > vw) nx = Math.max(8, vw - rect.width - 8);
    if (y + rect.height + 8 > vh) ny = Math.max(8, vh - rect.height - 8);
    el.style.left = `${nx}px`;
    el.style.top = `${ny}px`;
  }, [x, y]);

  return createPortal(
    <div
      ref={ref}
      className={styles.menu}
      style={{ top: y, left: x }}
      onContextMenu={(e) => e.preventDefault()}
      role="menu"
    >
      {items.map((item, i) =>
        item.divider ? (
          <div key={`d-${i}`} className={styles.divider} />
        ) : (
          <button
            key={i}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            className={`${styles.item} ${item.danger ? styles.itemDanger : ''}`}
            onClick={() => {
              if (item.disabled) return;
              item.onClick?.();
              onClose();
            }}
          >
            {item.icon && <item.icon className={styles.icon} />}
            <span className={styles.label}>{item.label}</span>
            {item.shortcut && <span className={styles.shortcut}>{item.shortcut}</span>}
          </button>
        )
      )}
    </div>,
    document.body
  );
}
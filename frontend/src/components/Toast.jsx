import { useEffect, useRef, useState } from 'react';

const typeStyles = {
  info:    { bg: '#1f2937', accent: '#3b82f6', icon: 'ℹ️' },
  success: { bg: '#064e3b', accent: '#10b981', icon: '✅' },
  error:   { bg: '#7f1d1d', accent: '#ef4444', icon: '⚠️' },
};

export default function Toast({ toast, onAction, onClose }) {
  const [visible, setVisible] = useState(false);
  const [paused, setPaused] = useState(false);
  const style = typeStyles[toast.type] ?? typeStyles.info;
  const duration = toast.duration ?? 5000;

  const fillRef = useRef(null);
  const startedAtRef = useRef(null);
  const remainingRef = useRef(duration);
  const rafRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

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

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: style.bg,
        color: '#fff',
        borderRadius: 8,
        borderLeft: `4px solid ${style.accent}`,
        minWidth: 280,
        maxWidth: 400,
        boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
        transform: visible ? 'translateX(0)' : 'translateX(120%)',
        opacity: visible ? 1 : 0,
        transition: 'transform .25s ease, opacity .25s ease',
        marginBottom: 8,
      }}
    >
      {duration > 0 && (
        <div
          ref={fillRef}
          style={{
            position: 'absolute',
            top: 0,
            right: 0,          // 🆕 прижато к ПРАВОМУ краю
            bottom: 0,
            // left убрали — теперь блок сжимается ВЛЕВО при уменьшении width
            width: '100%',
            background: style.accent,
            opacity: 0.18,
            pointerEvents: 'none',
            transition: 'width 60ms linear',
            zIndex: 0,
          }}
        />
      )}

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
        }}
      >
        <span style={{ fontSize: 18 }}>{style.icon}</span>

        <span style={{ flex: 1, fontSize: 14, lineHeight: 1.4 }}>
          {toast.message}
        </span>

        {toast.actionLabel && (
          <button
            onClick={() => onAction(toast.id)}
            style={{
              background: 'transparent',
              border: `1px solid ${style.accent}`,
              color: '#fff',
              padding: '4px 10px',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
          >
            {toast.actionLabel}
          </button>
        )}

        <button
          onClick={() => onClose(toast.id)}
          title="Закрыть"
          style={{
            background: 'transparent',
            border: 'none',
            color: '#cbd5e1',
            cursor: 'pointer',
            fontSize: 18,
            padding: 0,
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
}
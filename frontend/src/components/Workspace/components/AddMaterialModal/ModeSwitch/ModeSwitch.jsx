import { useRef, useEffect, useCallback } from 'react';
import styles from './ModeSwitch.module.css';

const MODES = [
    { id: 'upload', label: 'Загрузить' },
    { id: 'editor', label: 'Создать' },
];

const ICONS = {
    upload: 'M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 4v12m0-12L8 8m4-4l4 4',
    editor: 'M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z',
};

function ModeIcon({ mode }) {
    return (
        <svg
            width="14" height="14" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d={ICONS[mode]} />
        </svg>
    );
}

export default function ModeSwitch({ activeMode, onChange }) {
    const containerRef = useRef(null);
    const pillRef = useRef(null);
    const btnRefs = useRef({});

    const updatePill = useCallback(() => {
        const btn = btnRefs.current[activeMode];
        const container = containerRef.current;
        const pill = pillRef.current;
        if (!btn || !container || !pill) return;

        const containerRect = container.getBoundingClientRect();
        const btnRect = btn.getBoundingClientRect();

        pill.style.width = `${btnRect.width}px`;
        pill.style.transform = `translateX(${btnRect.left - containerRect.left}px)`;
    }, [activeMode]);

    // Обновляем позицию pill
    useEffect(() => {
        updatePill();
    }, [updatePill]);

    // Ресайз с throttle через rAF
    useEffect(() => {
        let rafId = null;
        const handleResize = () => {
            if (rafId) return;
            rafId = requestAnimationFrame(() => {
                updatePill();
                rafId = null;
            });
        };
        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
            if (rafId) cancelAnimationFrame(rafId);
        };
    }, [updatePill]);

    return (
        <div
            className={styles.container}
            ref={containerRef}
            role="tablist"
            aria-label="Режим работы"
        >
            <div
                className={styles.pill}
                ref={pillRef}
                aria-hidden="true"
            />

            {MODES.map((mode) => {
                const isActive = activeMode === mode.id;
                return (
                    <button
                        key={mode.id}
                        ref={(el) => { btnRefs.current[mode.id] = el; }}
                        className={`${styles.btn} ${isActive ? styles.active : ''}`}
                        onClick={() => onChange(mode.id)}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        tabIndex={isActive ? 0 : -1}
                    >
                        <ModeIcon mode={mode.id} />
                        {mode.label}
                    </button>
                );
            })}
        </div>
    );
}
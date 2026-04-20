import { useRef, useEffect, useState, useCallback } from 'react';
import styles from './ModeSwitch.module.css';

const modes = [
    { id: 'upload', icon: 'upload', label: 'Загрузить' },
    { id: 'editor', icon: 'edit', label: 'Создать' },
];

const Icons = {
    upload: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
    ),
    edit: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
    ),
};

export function ModeSwitch({ activeMode, onChange }) {
    const containerRef = useRef(null);
    const [pillStyle, setPillStyle] = useState({});

    const updatePill = useCallback(() => {
        const container = containerRef.current;
        if (!container) return;

        const activeIndex = modes.findIndex(m => m.id === activeMode);
        const buttons = container.querySelectorAll('[data-mode-btn]');
        const btn = buttons[activeIndex];

        if (btn) {
            setPillStyle({
                width: `${btn.offsetWidth}px`,
                transform: `translateX(${btn.offsetLeft - 4}px)`,
            });
        }
    }, [activeMode]);

    useEffect(() => {
        updatePill();
    }, [updatePill]);

    useEffect(() => {
        window.addEventListener('resize', updatePill);
        return () => window.removeEventListener('resize', updatePill);
    }, [updatePill]);

    return (
        <div className={styles.container} ref={containerRef}>
            <div className={styles.pill} style={pillStyle} />

            {modes.map(mode => (
                <button
                    key={mode.id}
                    data-mode-btn
                    className={`${styles.tab} ${activeMode === mode.id ? styles.active : ''}`}
                    onClick={() => onChange(mode.id)}
                    type="button"
                >
                    <span className={styles.icon}>{Icons[mode.icon]}</span>
                    <span>{mode.label}</span>
                </button>
            ))}
        </div>
    );
}
import styles from './RecordingBar.module.css';

function formatTime(seconds) {
    const safe = Math.max(0, Math.floor(seconds) || 0);
    const m = Math.floor(safe / 60);
    const s = safe % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function RecordingBar({ time, onStop }) {
    const display = formatTime(time);

    return (
        <div
            className={styles.bar}
            role="status"
            aria-live="polite"
            aria-label={`Идёт запись: ${display}`}
        >
            <span className={styles.dot} aria-hidden="true" />
            <span className={styles.time}>
                Запись {display}
            </span>
            <button
                type="button"
                className={styles.stop}
                onClick={onStop}
                aria-label="Остановить запись"
            >
                <svg
                    width="12" height="12" viewBox="0 0 24 24"
                    fill="currentColor" stroke="none"
                    aria-hidden="true"
                >
                    <rect x="4" y="4" width="16" height="16" rx="2" />
                </svg>
                Остановить
            </button>
        </div>
    );
}
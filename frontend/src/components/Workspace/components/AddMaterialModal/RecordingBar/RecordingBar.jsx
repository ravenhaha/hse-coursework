import styles from './RecordingBar.module.css';

function formatTime(seconds) {
    const safe = Math.max(0, Math.floor(seconds) || 0);
    const m = Math.floor(safe / 60);
    const s = safe % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

export function RecordingBar({ time, onStop }) {
    return (
        <div className={styles.bar} role="status" aria-live="polite">
            <span className={styles.dot} aria-hidden="true" />
            <span>Запись {formatTime(time)}</span>
            <button
                type="button"
                className={styles.stop}
                onClick={onStop}
            >
                Остановить
            </button>
        </div>
    );
}
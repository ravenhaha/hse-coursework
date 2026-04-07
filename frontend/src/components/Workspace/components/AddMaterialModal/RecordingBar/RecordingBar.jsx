import styles from './RecordingBar.module.css';

export function RecordingBar({ time, onStop }) {
    const formatted = `${Math.floor(time / 60)}:${(time % 60).toString().padStart(2, '0')}`;

    return (
        <div className={styles.bar}>
            <span className={styles.dot} />
            <span>Запись {formatted}</span>
            <button className={styles.stop} onClick={onStop}>
                Остановить
            </button>
        </div>
    );
}
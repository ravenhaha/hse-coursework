import { templates } from '../templates';
import styles from './TemplatesGrid.module.css';

export function TemplatesGrid({ onSelect }) {
    const filtered = templates.filter(t => t.id !== 'empty');

    return (
        <div className={styles.grid}>
            {filtered.map((t) => (
                <button
                    key={t.id}
                    className={styles.card}
                    onClick={() => onSelect(t)}
                >
                    <span className={styles.icon}>{t.icon}</span>
                    <span className={styles.name}>{t.name}</span>
                </button>
            ))}
        </div>
    );
}
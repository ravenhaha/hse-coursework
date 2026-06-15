import { visibleTemplates } from './templates';
import styles from './TemplatesGrid.module.css';

const ICON_PATHS = {
    lecture:
        'M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422A12.083 12.083 0 0121 12.766V19a2 2 0 01-2 2H5a2 2 0 01-2-2v-6.234c0-2.194.89-4.296 2.84-5.766L12 14z',
    book:
        'M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5V4.5A2.5 2.5 0 016.5 2H20v20H6.5A2.5 2.5 0 014 19.5z',
    article:
        'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2',
    idea:
        'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
    project:
        'M13 10V3L4 14h7v7l9-11h-7z',
    empty:
        'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
};

function TemplateIcon({ type }) {
    return (
        <svg
            className={styles.icon}
            width="14" height="14" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d={ICON_PATHS[type] || ICON_PATHS.empty} />
        </svg>
    );
}

export function TemplatesGrid({ onSelect }) {
    return (
        <div
            className={styles.grid}
            role="group"
            aria-label="Шаблоны заметок"
        >
            {visibleTemplates.map((t) => (
                <button
                    key={t.id}
                    type="button"
                    className={styles.card}
                    onClick={() => onSelect(t)}
                    aria-label={`Шаблон: ${t.name}`}
                >
                    <TemplateIcon type={t.icon} />
                    <span className={styles.name}>{t.name}</span>
                </button>
            ))}
        </div>
    );
}
import styles from './Toolbar.module.css';

export function ToolbarButton({ active, onClick, title, children }) {
    return (
        <button
            type="button"
            className={`${styles.toolBtn} ${active ? styles.active : ''}`}
            onClick={onClick}
            title={title}
        >
            {children}
        </button>
    );
}
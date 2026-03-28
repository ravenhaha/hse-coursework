import styles from './ButtonMain.module.css';

function ButtonMain({ className, onClick, children }) {
    return (
        <button
            type="button"
            className={`${styles.linkMain} ${className || ''}`}
            onClick={onClick}
        >
            {children}
        </button>
    );
}

export default ButtonMain;
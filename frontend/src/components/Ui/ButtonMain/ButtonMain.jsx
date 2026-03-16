import styles from './ButtonMain.module.css';

function ButtonMain({ className, onClick, children }) {
    return (
        <button
            type="button"
            className={`${styles.link_main} ${className || ''}`}
            onClick={onClick}
        >
            {children}
        </button>
    );
}

export default ButtonMain;
import styles from './ButtonMain.module.css';

function ButtonMain({ className, onClick }) {
    return (
        <button
            type="button"
            className={`${styles.link_main} ${className || ''}`}
            onClick={onClick}
        >
            Погрузиться
        </button>
    );
}

export default ButtonMain;
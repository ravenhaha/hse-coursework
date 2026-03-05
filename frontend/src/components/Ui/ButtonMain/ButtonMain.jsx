import styles from './ButtonMain.module.css';

function ButtonMain ({className}) {

    return (
        <a className={`${styles.link_main} ${className || ''}`}>
            Погрузиться
        </a>
    )
}

export default ButtonMain
import styles from './Ripples.module.css';

function Ripples() {
    return (
        <div className={styles.ripples}>
            <div className={styles.ripple} />
            <div className={styles.ripple} />
            <div className={styles.ripple} />
        </div>
    );
}

export default Ripples;
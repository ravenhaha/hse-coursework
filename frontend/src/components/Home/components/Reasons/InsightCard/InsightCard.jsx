import styles from "./InsightCard.module.css";

function InsightCard(props) {
    const { text, signature } = props;

    return (
        <div className={styles.item}>
            <div className={styles.line} aria-hidden="true" />
            <div className={styles.textBlock}>
                <p className={styles.text}>{text}</p>
                <p className={styles.signature}>{signature}</p>
            </div>
        </div>
    )
}

export default InsightCard;
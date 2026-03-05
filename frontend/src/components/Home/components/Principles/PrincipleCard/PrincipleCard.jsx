import styles from "./PrincipleCard.module.css";

function PrincipleCard(props) {
    const { icon, title, text } = props;

    return (
        <div className={styles.card}>
            <div className={styles.iconWrapper}>
                <img src={icon} alt={title} />
            </div>
            <h3 className={styles.title}>{title}</h3>
            <p className={styles.text}>{text}</p>
        </div>
    )
}

export default PrincipleCard;
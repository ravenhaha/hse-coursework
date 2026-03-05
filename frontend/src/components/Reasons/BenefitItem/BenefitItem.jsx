import styles from "./BenefitItem.module.css";

function BenefitItem(props) {
    const {
        icon,
        title,
        text
    } = props;

    return (
        <div className={styles.item}>
            <div className={styles.iconWrapper}>
                <img className={styles.icon} src={icon} alt={title}/>
            </div>
            <div className={styles.textBlock}>
                <h3 className={styles.title}>{title}</h3>
                <p className={styles.text}>{text}</p>
            </div>
        </div>
    )
}

export default BenefitItem;
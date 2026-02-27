import styles from "./FeatureCard.module.css";
import checkIcon from "../../../assets/icons/features-check.svg"

function FeatureCard(props) {
    const {
        icon,
        title,
        text,
        list,
    } = props;

    return(
        <div className={styles.card}>
            <div className={styles.iconWrapper}>
                <img src={icon} alt={title} />
            </div>
            <h3 className={styles.title}>{title}</h3>
            <p className={styles.text}>{text}</p>
            <ul className={styles.featureList}>
                {list && list.map((item, index) =>(
                    <li className={styles.featureItem} key={index}>
                        <img
                            className={styles.featureIcon}
                            src={checkIcon}
                            alt="✓"
                        />
                        <span className={styles.featureText}>{item}</span>
                    </li>
                ))}
            </ul>
        </div>
    )
}

export default FeatureCard;
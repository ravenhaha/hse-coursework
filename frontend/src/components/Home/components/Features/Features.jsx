import styles from "./Features.module.css";
import featuresData from "./data.js";
import { FaCheck } from 'react-icons/fa';

function Features(props) {
    const {
        title,
        text,
    } = props;

    return (
        <section id="features" className={styles.section}>
            <div className={`container ${styles.container}`}>
                <div className={styles.header}>
                    <h2 className={styles.title}>{title}</h2>
                    <p className={styles.description}>{text}</p>
                </div>

                <div className={styles.showcase}>
                    {featuresData.map((item, index) => (
                        <article
                            key={item.id}
                            className={`${styles.featureRow} ${index % 2 === 1 ? styles.featureRowReverse : ''}`}
                        >
                            <div className={styles.visual}>
                                <div className={styles.glow} />
                                <div className={styles.iconPanel}>
                                    <img src={item.icon} alt="" aria-hidden="true" />
                                </div>
                            </div>

                            <div className={styles.content}>
                                <h3>{item.title}</h3>
                                <p>{item.text}</p>
                                <ul className={styles.featureList}>
                                    {item.list.map((listItem) => (
                                        <li key={listItem}>
                                            <FaCheck aria-hidden="true" />
                                            <span>{listItem}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </article>
                    ))}
                </div>
            </div>
        </section>
    )
}

export default Features;

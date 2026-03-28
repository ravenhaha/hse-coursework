import styles from "./Features.module.css";
import FeatureCard from "./FeatureCard/FeatureCard.jsx";
import featuresData from "./data.js";

function Features(props) {
    const {
        title,
        text,
    } = props;

    return (
        <section className={styles.section}>
            <div className="container">
                <h2 className={styles.title}>{title}</h2>
                <p className={styles.description}>{text}</p>
                <div className={styles.cardsGrid}>
                    {featuresData.map(item => (
                        <FeatureCard
                            key={item.id}
                            icon={item.icon}
                            title={item.title}
                            text={item.text}
                            list={item.list}
                        />
                    ))}
                </div>
            </div>
        </section>
    )
}

export default Features;
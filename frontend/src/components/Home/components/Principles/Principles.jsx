import { titleData, principlesData } from "./data.js";
import PrincipleCard from "./PrincipleCard/PrincipleCard.jsx";
import styles from "./Principles.module.css";

function Principles() {
    return (
        <section className={styles.section}>
            
                <div className={styles.header}>
                    <h2 className={styles.title}>{titleData.title}</h2>
                    <p className={styles.subtitle}>{titleData.text}</p>
                </div>
                <div className={styles.cards}>
                    {principlesData.map(item => (
                        <PrincipleCard
                            key={item.id}
                            icon={item.icon}
                            title={item.title}
                            text={item.text}
                        />
                    ))}
                </div>
            
        </section>
    )
}

export default Principles;
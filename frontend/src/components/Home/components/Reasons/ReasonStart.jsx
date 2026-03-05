import {titleData, benefitsData, insightsData} from "./data.js";
import BenefitItem from "./BenefitItem/BenefitItem.jsx";
import InsightItem from "./InsightCard/InsightCard.jsx";
import styles from "./ReasonStart.module.css";

function ReasonsStart() {
    return (
        <section className={styles.section}>

            
                <div className={styles.content}>
                    <div className={styles.left}>
                        <h2 className={styles.title}>{titleData.title}</h2>
                        <p className={styles.description}>{titleData.text}</p>
                        {benefitsData.map(item => (
                            <BenefitItem
                                key={item.id}
                                icon={item.icon}
                                title={item.title}
                                text={item.text}
                            />
                        ))}
                    </div>
                    <div className={styles.right}>
                        <div className={styles.insightsWrapper}>
                            {insightsData.map(item => (
                                <InsightItem
                                    key={item.id}
                                    text={item.text}
                                    signature={item.signature}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            
        </section>
    )
}

export default ReasonsStart;
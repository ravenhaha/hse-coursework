import cards from './index.js';
import styles from './HowItWorks.module.css';

function HowItWorks() {
    return (
        <section className={styles.section}>
            <header className={styles.head}>
                <h2 className={styles.title}>Как это работает</h2>
                <p className={styles.subtitle}>
                    Три простых шага чтобы превратить документы в живую базу знаний
                </p>
            </header>

            <div className={styles.grid}>
                {cards.map((card) => {
                    const Icon = card.Icon;
                    return (
                        <article
                            key={card.id}
                            className={styles.card}
                            style={{ '--accent': card.color }}
                        >
                            <div className={styles.iconWrap}>
                                {Icon && <Icon />}
                            </div>
                            <span className={styles.number}>{card.number}</span>
                            <h3 className={styles.cardTitle}>{card.title}</h3>
                            <p className={styles.cardText}>{card.text}</p>
                        </article>
                    );
                })}
            </div>
        </section>
    );
}

export default HowItWorks;
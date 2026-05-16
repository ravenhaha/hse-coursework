import { IoArrowForward } from 'react-icons/io5';
import cards from './index.js';
import styles from './QuickActions.module.css';

function QuickActions(props) {
    return (
        <section className={styles.section}>
            <header className={styles.head}>
                <h2 className={styles.title}>Быстрые действия</h2>
                <p className={styles.subtitle}>Начните с одного клика</p>
            </header>

            <div className={styles.grid}>
                {cards.map((card) => {
                    const Icon = card.Icon;
                    const handler = props[card.handler];
                    return (
                        <button
                            key={card.id}
                            type="button"
                            className={styles.card}
                            onClick={handler}
                            disabled={!handler}
                        >
                            <div
                                className={styles.iconWrap}
                                style={{
                                    color: card.color,
                                    background: `${card.color}1a`,
                                    borderColor: `${card.color}33`,
                                }}
                            >
                                {Icon && <Icon />}
                            </div>
                            <div className={styles.cardBody}>
                                <h3 className={styles.cardTitle}>{card.title}</h3>
                                <p className={styles.cardText}>{card.text}</p>
                            </div>
                            <IoArrowForward className={styles.arrow} />
                        </button>
                    );
                })}
            </div>
        </section>
    );
}

export default QuickActions;
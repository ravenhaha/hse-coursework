import styles from './About.module.css';
import ButtonMain from "../../../Ui/ButtonMain/ButtonMain.jsx";
import AboutCard from "./AboutCard/AboutCard.jsx";
import useDive from '../../../../hooks/useDive.js';
import FadeIn from '../../../Effects/FadeIn/FadeIn.jsx';

function About() {
    const { handleDive } = useDive();

    const cards = [
        {id: 1, title: 'Сбор', text: 'Фиксируйте воспоминания, мысли и \nсобытия в удобном формате. \nСоздавайте записи с деталями, \nэмоциями и контекстом.', numbercard: 1},
        {id: 2, title: 'Смысл', text: 'Анализируйте связи между \nсобытиями, находите закономерности \nи понимайте, как прошлое влияет на \nнастоящее.', numbercard: 2},
        {id: 3, title: 'Применение', text: 'Используйте полученные инсайты для \nпринятия решений, личностного роста \nи осознанного движения вперёд.', numbercard: 3},
    ];

    return (
        <section id="about" className={styles.about}>
            <FadeIn>
                <h2 className={styles.title}>О нас</h2>
            </FadeIn>
            <FadeIn delay={0.1}>
                <p className={styles.text}>
                    Омут памяти — это пространство для работы с вашими воспоминаниями, где
                    каждая деталь обретает новый смысл
                </p>
            </FadeIn>
            <FadeIn delay={0.2}>
                <h3 className={styles.subtitle}>Как работает</h3>
            </FadeIn>
            <div className={styles.cards}>
                {cards.map((card, i) => (
                    <FadeIn key={card.id} delay={0.35 * i} y={40}>
                        <AboutCard
                            className={styles.card}
                            title={card.title}
                            text={card.text}
                            numbercard={card.numbercard}
                        />
                    </FadeIn>
                ))}
            </div>
            <FadeIn delay={0.3}>
                <ButtonMain onClick={() => handleDive('/auth')} />
            </FadeIn>
        </section>
    );
}

export default About;
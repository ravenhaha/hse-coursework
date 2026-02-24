import styles from './About.module.css';
import ButtonMain from "../Ui/ButtonMain/ButtonMain.jsx";
import AboutCard from "../Ui/AboutCard/AboutCard.jsx";


function About() {
    const cards = [
        {id: 1, title: 'Сбор', text: 'Фиксируйте воспоминания, мысли и \n' +
                'события в удобном формате. \n' +
                'Создавайте записи с деталями, \n' +
                'эмоциями и контекстом.', numbercard: 1},
        {id: 2, title: 'Смысл', text: 'Анализируйте связи между \n' +
                'событиями, находите закономерности \n' +
                'и понимайте, как прошлое влияет на \n' +
                'настоящее.', numbercard: 2},
        {id: 3, title: 'Применение', text: 'Используйте полученные инсайты для \n' +
                'принятия решений, личностного роста \n' +
                'и осознанного движения вперёд.', numbercard: 3},
    ]

    return (
        <section id="about" className={styles.about}>
            <h2 className={styles.title}>
                О нас
            </h2>
            <p className={styles.text}>
                Омут памяти — это пространство для работы с вашими воспоминаниями, где
                каждая деталь обретает новый смысл
            </p>
            <h3 className={styles.subtitle}>
                Как работает
            </h3>
            <div className={styles.cards}>
                {cards.map((card) => (
                    <AboutCard
                        key={card.id}
                        className={styles.card}
                        title={card.title}
                        text={card.text}
                        numbercard={card.numbercard}
                    />
                ))}
            </div>

            <ButtonMain />
        </section>
    )
}

export default About;
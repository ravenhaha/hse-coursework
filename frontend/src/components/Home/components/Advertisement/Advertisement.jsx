import ButtonMain from "../../../Ui/ButtonMain/ButtonMain.jsx";
import styles from './Advertisement.module.css';
import useDive from '../../../../hooks/useDive.js';

function Advertisement() {
    const { handleDive } = useDive();

    return (
        <section className={styles.advertisement}>
            <div className="container">
            <h2 className={styles.title}>
                Начните своё путешествие
                в глубины памяти
            </h2>
            <p className={styles.text}>
                Каждое воспоминание — это часть вашей истории. Соберите их
                вместе и откройте новые грани себя.
            </p>
            <ButtonMain onClick={() => handleDive('/auth')}>
                Погрузиться
            </ButtonMain>
            <p className={styles.subtext}>
                Регистрация не требуется • Начните прямо сейчас
            </p>
            </div>
        </section>
    );
}

export default Advertisement;
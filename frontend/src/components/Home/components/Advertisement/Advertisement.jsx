import ButtonMain from "../../../Ui/ButtonMain/ButtonMain.jsx";
import styles from './Advertisement.module.css';
import questions from "../Questions/index.js";

function Advertisement() {
    return (
        <section className={styles.advertisement}>
            <h2 className={styles.title}>
                Начните своё путешествие
                в глубины памяти
            </h2>
            <p className={styles.text}>
                Каждое воспоминание — это часть вашей истории. Соберите их
                вместе и откройте новые грани себя.
            </p>
            <ButtonMain/>
            <p className={styles.subtext}>
                Регистрация не требуется • Начните прямо сейчас
            </p>
        </section>
    )
}

export default Advertisement;
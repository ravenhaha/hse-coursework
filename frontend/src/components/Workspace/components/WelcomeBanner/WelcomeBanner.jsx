import { IoSparkles, IoAdd } from 'react-icons/io5';
import styles from './WelcomeBanner.module.css';

function WelcomeBanner({ onAddMaterial }) {
    return (
        <section className={styles.banner}>
            <div className={styles.glow} aria-hidden="true" />

            <div className={styles.badge}>
                <IoSparkles />
                <span>Добро пожаловать</span>
            </div>

            <h1 className={styles.title}>
                Начните создавать свою <span className={styles.accent}>базу знаний</span>
            </h1>

            <p className={styles.subtitle}>
                Омут памяти поможет организовать материалы, найти ключевые идеи
                и закрепить знания. Загружайте документы, делайте заметки
                и связывайте всё в единую систему.
            </p>

            <button
                type="button"
                onClick={onAddMaterial}
                className={styles.cta}
            >
                <IoAdd className={styles.ctaIcon} />
                <span>Добавить первый материал</span>
            </button>
        </section>
    );
}

export default WelcomeBanner;
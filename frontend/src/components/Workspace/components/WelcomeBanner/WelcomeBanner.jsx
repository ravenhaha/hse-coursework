import { IoSparkles, IoFolderOpenOutline, IoArrowForward } from 'react-icons/io5';
import styles from './WelcomeBanner.module.css';

function WelcomeBanner({ onCreateCollection }) {
  const handleClick = (e) => {
    e.preventDefault();
    console.log('1️⃣ WelcomeBanner click, onCreateCollection:', onCreateCollection);
    onCreateCollection?.();
    };

  return (
    <section className={styles.banner}>
      <div className={styles.glow} aria-hidden="true" />

      <div className={styles.badge}>
        <IoSparkles />
        <span>Добро пожаловать</span>
      </div>

      <h1 className={styles.title}>
        Начните создавать свою{' '}
        <span className={styles.accent}>базу знаний</span>
      </h1>

      <p className={styles.subtitle}>
        Омут памяти поможет организовать материалы, найти ключевые идеи
        и закрепить знания. Начните с коллекции — она объединит связанные
        материалы по теме.
      </p>

      <button
        type="button"
        onClick={handleClick}
        className={styles.cta}
        aria-label="Создать первую коллекцию — откроется поле ввода в сайдбаре"
      >
        <IoFolderOpenOutline className={styles.ctaIcon} />
        <span>Создать первую коллекцию</span>
        <IoArrowForward className={styles.ctaArrow} />
      </button>
    </section>
  );
}

export default WelcomeBanner;
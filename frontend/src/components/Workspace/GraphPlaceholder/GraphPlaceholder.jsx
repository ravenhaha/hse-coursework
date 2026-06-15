import { IoGitNetworkOutline, IoSparklesOutline } from 'react-icons/io5';
import styles from './GraphPlaceholder.module.css';

function GraphPlaceholder() {
    return (
        <div className={styles.wrap}>
            <div className={styles.glow} aria-hidden="true" />

            <div className={styles.iconCircle}>
                <IoGitNetworkOutline />
            </div>

            <h2 className={styles.title}>
                Граф знаний
                <span className={styles.soon}>
                    <IoSparklesOutline />
                    скоро
                </span>
            </h2>

            <p className={styles.subtitle}>
                Здесь появится визуализация связей между вашими материалами.
                <br />
                А пока — выберите материал в сайдбаре, чтобы открыть его.
            </p>

            <div className={styles.hint}>
                💡 Нажмите «Главная» слева, чтобы открыть справку
            </div>
        </div>
    );
}

export default GraphPlaceholder;
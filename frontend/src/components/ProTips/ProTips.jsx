import {
    IoHandRightOutline,
    IoArrowRedoOutline,
    IoAddCircleOutline,
    IoStarOutline,
} from 'react-icons/io5';
import styles from './ProTips.module.css';

const TIPS = [
    {
        id: 'rmb',
        Icon: IoHandRightOutline,
        text: 'Правая кнопка мыши на коллекции — быстрое меню действий',
    },
    {
        id: 'dnd',
        Icon: IoArrowRedoOutline,
        text: 'Перетаскивайте материалы между коллекциями мышью',
    },
    {
        id: 'plus',
        Icon: IoAddCircleOutline,
        text: 'Наведите на коллекцию — появится «+» для быстрого добавления',
    },
    {
        id: 'star',
        Icon: IoStarOutline,
        text: 'Отмечайте важное звёздочкой — потом легко отфильтровать',
    },
];

function ProTips() {
    return (
        <section className={styles.section}>
            <h2 className={styles.title}>Полезно знать</h2>
            <div className={styles.list}>
                {TIPS.map((tip) => {
                    const Icon = tip.Icon;
                    return (
                        <div key={tip.id} className={styles.tip}>
                            <div className={styles.iconWrap}>
                                <Icon />
                            </div>
                            <span className={styles.text}>{tip.text}</span>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

export default ProTips;
import { useRef, useCallback } from 'react';
import styles from "./FeatureCard.module.css";
import checkIcon from "../../../../../assets/icons/features-check.svg";

function FeatureCard(props) {
    const { icon, title, text, list } = props;
    const cardRef = useRef(null);
    const rafRef = useRef(0);

    const handleMouseMove = useCallback((e) => {
        cancelAnimationFrame(rafRef.current);
        const clientX = e.clientX;
        const clientY = e.clientY;
        rafRef.current = requestAnimationFrame(() => {
            const card = cardRef.current;
            if (!card) return;
            const rect = card.getBoundingClientRect();
            card.style.setProperty('--x', `${clientX - rect.left}px`);
            card.style.setProperty('--y', `${clientY - rect.top}px`);
        });
    }, []);

    return (
        <div
            ref={cardRef}
            className={styles.card}
            onMouseMove={handleMouseMove}
        >
            <div className={styles.glow} />
            <div className={styles.content}>
                <div className={styles.iconWrapper}>
                    <img src={icon} alt={title} />
                </div>
                <h3 className={styles.title}>{title}</h3>
                <p className={styles.text}>{text}</p>
                <ul className={styles.featureList}>
                    {list && list.map((item, index) => (
                        <li className={styles.featureItem} key={index}>
                            <img
                                className={styles.featureIcon}
                                src={checkIcon}
                                alt="✓"
                            />
                            <span className={styles.featureText}>{item}</span>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}

export default FeatureCard;
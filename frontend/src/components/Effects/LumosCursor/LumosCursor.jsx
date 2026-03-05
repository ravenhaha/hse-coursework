import { useEffect, useRef } from 'react';
import styles from './LumosCursor.module.css';
import wandImg from '../../../assets/images/wand.png';

function LumosCursor() {
    const glowRef = useRef(null);
    const wandRef = useRef(null);
    const tipRef = useRef(null);

    useEffect(() => {
        const move = (e) => {
            const x = e.clientX;
            const y = e.clientY;

            // Всё на одной точке — позиция мыши = кончик
            if (glowRef.current) {
                glowRef.current.style.left = x + 'px';
                glowRef.current.style.top = y + 'px';
            }
            if (tipRef.current) {
                tipRef.current.style.left = x + 'px';
                tipRef.current.style.top = y + 'px';
            }
            if (wandRef.current) {
                wandRef.current.style.left = x + 'px';
                wandRef.current.style.top = y + 'px';
            }
        };

        window.addEventListener('mousemove', move);
        return () => window.removeEventListener('mousemove', move);
    }, []);

    return (
        <>
            <div ref={glowRef} className={styles.glow} />
            <div ref={tipRef} className={styles.tip} />
            <img
                ref={wandRef}
                src={wandImg}
                alt=""
                className={styles.wand}
                draggable={false}
            />
        </>
    );
}

export default LumosCursor;
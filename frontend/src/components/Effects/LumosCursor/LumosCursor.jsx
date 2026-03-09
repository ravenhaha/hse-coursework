import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useLocation } from 'react-router-dom';
import styles from './LumosCursor.module.css';
import wandImg from '../../../assets/images/wand.png';

const pointerQuery = '(pointer: fine)';

function subscribe(callback) {
    const mql = window.matchMedia(pointerQuery);
    mql.addEventListener('change', callback);
    return () => mql.removeEventListener('change', callback);
}

function getSnapshot() {
    return window.matchMedia(pointerQuery).matches;
}

function getServerSnapshot() {
    return true;
}

function LumosCursor() {
    const glowRef = useRef(null);
    const wandRef = useRef(null);
    const tipRef = useRef(null);
    const pos = useRef({ x: -200, y: -200 });
    const hasMoved = useRef(false);
    const rafId = useRef(null);

    const hasPointer = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
    const { pathname } = useLocation();
    const isWorkspace = pathname.startsWith('/workspace');

    useEffect(() => {
        if (!hasPointer || isWorkspace) return;

        const onMove = (e) => {
            pos.current.x = e.clientX;
            pos.current.y = e.clientY;

            if (!hasMoved.current) {
                hasMoved.current = true;
                if (glowRef.current) glowRef.current.style.opacity = '';
                if (tipRef.current) tipRef.current.style.opacity = '';
                if (wandRef.current) wandRef.current.style.opacity = '';
            }
        };

        const update = () => {
            const { x, y } = pos.current;

            if (glowRef.current) {
                glowRef.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
            }
            if (tipRef.current) {
                tipRef.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
            }
            if (wandRef.current) {
                wandRef.current.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-30%, 92%) rotate(-75deg)`;
            }

            rafId.current = requestAnimationFrame(update);
        };

        window.addEventListener('mousemove', onMove, { passive: true });
        rafId.current = requestAnimationFrame(update);

        return () => {
            window.removeEventListener('mousemove', onMove);
            cancelAnimationFrame(rafId.current);
        };
    }, [hasPointer, isWorkspace]);

    if (!hasPointer || isWorkspace) return null;

    return (
        <>
            <div ref={glowRef} className={styles.glow} style={{ opacity: 0 }} />
            <div ref={tipRef} className={styles.tip} style={{ opacity: 0 }} />
            <img
                ref={wandRef}
                src={wandImg}
                alt=""
                className={styles.wand}
                style={{ opacity: 0 }}
                draggable={false}
            />
        </>
    );
}

export default LumosCursor;
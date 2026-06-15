import { useState, useRef, useCallback, useEffect } from 'react';
import { IoAdd, IoRemove, IoRefresh } from 'react-icons/io5';
import styles from './ImageZoomViewer.module.css';

const MIN_SCALE = 0.1;
const MAX_SCALE = 8;
const ZOOM_STEP = 0.2;

export default function ImageZoomViewer({ src, alt }) {
    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [dragging, setDragging] = useState(false);

    const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
    const wrapRef = useRef(null);

    const reset = useCallback(() => {
        setScale(1);
        setOffset({ x: 0, y: 0 });
    }, []);

    const zoomTo = useCallback((newScale, cx, cy) => {
        setScale((prev) => {
            const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, newScale));
            if (cx == null || cy == null) return next;
            setOffset((prevOffset) => {
                const k = next / prev;
                return {
                    x: cx - (cx - prevOffset.x) * k,
                    y: cy - (cy - prevOffset.y) * k,
                };
            });
            return next;
        });
    }, []);

    const handleZoomIn = () => zoomTo(scale + ZOOM_STEP);
    const handleZoomOut = () => zoomTo(scale - ZOOM_STEP);

    const handleWheel = useCallback(
        (e) => {
            e.preventDefault();
            const rect = wrapRef.current?.getBoundingClientRect();
            const cx = e.clientX - (rect?.left || 0) - (rect?.width || 0) / 2;
            const cy = e.clientY - (rect?.top || 0) - (rect?.height || 0) / 2;
            const delta = -e.deltaY * 0.0015;
            zoomTo(scale * (1 + delta), cx, cy);
        },
        [scale, zoomTo],
    );

    useEffect(() => {
        const el = wrapRef.current;
        if (!el) return;
        el.addEventListener('wheel', handleWheel, { passive: false });
        return () => el.removeEventListener('wheel', handleWheel);
    }, [handleWheel]);

    const handleMouseDown = (e) => {
        if (e.button !== 0) return;
        setDragging(true);
        dragStart.current = {
            x: e.clientX,
            y: e.clientY,
            ox: offset.x,
            oy: offset.y,
        };
    };

    useEffect(() => {
        if (!dragging) return;
        const onMove = (e) => {
            setOffset({
                x: dragStart.current.ox + (e.clientX - dragStart.current.x),
                y: dragStart.current.oy + (e.clientY - dragStart.current.y),
            });
        };
        const onUp = () => setDragging(false);
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
    }, [dragging]);

    const handleDoubleClick = () => reset();

    return (
        <div className={styles.root}>
            <div
                ref={wrapRef}
                className={`${styles.canvas} ${dragging ? styles.grabbing : styles.grab}`}
                onMouseDown={handleMouseDown}
                onDoubleClick={handleDoubleClick}
            >
                <img
                    src={src}
                    alt={alt}
                    className={styles.img}
                    draggable={false}
                    style={{
                        transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${scale})`,
                    }}
                />
            </div>

            <div className={styles.controls}>
                <button
                    className={styles.ctrlBtn}
                    onClick={handleZoomOut}
                    title="Уменьшить"
                    disabled={scale <= MIN_SCALE}
                    type="button"
                >
                    <IoRemove />
                </button>
                <button
                    className={styles.ctrlBtn}
                    onClick={reset}
                    title="Сбросить (двойной клик)"
                    type="button"
                >
                    <IoRefresh />
                </button>
                <span className={styles.scaleLabel}>{Math.round(scale * 100)}%</span>
                <button
                    className={styles.ctrlBtn}
                    onClick={handleZoomIn}
                    title="Увеличить"
                    disabled={scale >= MAX_SCALE}
                    type="button"
                >
                    <IoAdd />
                </button>
            </div>
        </div>
    );
}
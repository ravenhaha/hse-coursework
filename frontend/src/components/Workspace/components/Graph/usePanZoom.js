import { useRef, useState, useCallback, useEffect } from 'react';

// ===== Настройки pan/zoom — правь эти константы, чтобы кастомить поведение =====
const MIN_SCALE = 0.3;        // минимальный зум
const MAX_SCALE = 2.5;        // максимальный зум
const ZOOM_INTENSITY = 0.0015; // чувствительность колеса (выше — быстрее зум)
// ==============================================================================

export function usePanZoom() {
    const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });

    const containerRef = useRef(null);
    const panStateRef = useRef(null);
    const transformRef = useRef(transform);

    useEffect(() => {
        transformRef.current = transform;
    }, [transform]);

    // --- Pan: pointer-события (работают и на мыши, и на тач) ---
    const onPointerDown = useCallback((e) => {
        // pan только при ЛКМ / касании — иначе отдаём клик узлу
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        // Пропускаем клики по узлам — панорамируем только по фону
        if (e.target.closest('[data-graph-node]')) return;

        panStateRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            originX: transformRef.current.x,
            originY: transformRef.current.y,
            pointerId: e.pointerId,
        };
        e.currentTarget.setPointerCapture(e.pointerId);
    }, []);

    const onPointerMove = useCallback((e) => {
        const pan = panStateRef.current;
        if (!pan || pan.pointerId !== e.pointerId) return;
        const dx = e.clientX - pan.startX;
        const dy = e.clientY - pan.startY;
        setTransform((t) => ({ ...t, x: pan.originX + dx, y: pan.originY + dy }));
    }, []);

    const endPan = useCallback((e) => {
        const pan = panStateRef.current;
        if (!pan) return;
        if (e.currentTarget.hasPointerCapture?.(pan.pointerId)) {
            e.currentTarget.releasePointerCapture(pan.pointerId);
        }
        panStateRef.current = null;
    }, []);

    // --- Zoom: колесо (центрируем относительно курсора) ---
    // Подвешиваем вручную через addEventListener, потому что React ставит
    // wheel как passive и preventDefault() внутри onWheel игнорируется.
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const handleWheel = (e) => {
            e.preventDefault();
            const rect = el.getBoundingClientRect();
            const cursorX = e.clientX - rect.left;
            const cursorY = e.clientY - rect.top;

            setTransform((prev) => {
                const delta = -e.deltaY * ZOOM_INTENSITY;
                const nextScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, prev.scale * (1 + delta)));
                if (nextScale === prev.scale) return prev;

                // Держим точку под курсором неподвижной: (cursor - origin) / scale = const
                const ratio = nextScale / prev.scale;
                return {
                    scale: nextScale,
                    x: cursorX - (cursorX - prev.x) * ratio,
                    y: cursorY - (cursorY - prev.y) * ratio,
                };
            });
        };

        el.addEventListener('wheel', handleWheel, { passive: false });
        return () => el.removeEventListener('wheel', handleWheel);
    }, []);

    // --- Сброс / центрирование — для хлебной крошки и «вписать в экран» ---
    const reset = useCallback(() => setTransform({ x: 0, y: 0, scale: 1 }), []);
    const setTransformManually = useCallback((next) => setTransform(next), []);

    return {
        containerRef,
        transform,
        reset,
        setTransform: setTransformManually,
        handlers: {
            onPointerDown,
            onPointerMove,
            onPointerUp: endPan,
            onPointerCancel: endPan,
        },
    };
}
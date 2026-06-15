import { useEffect, useRef, useState, useCallback } from 'react';

const MIN_WIDTH = 220;
const MAX_WIDTH = 560;
const DEFAULT_WIDTH = 280;
const STORAGE_KEY = 'mindbase:sidebar-width';

const clamp = (v) => Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, v));

/**
 * Хук ресайза сайдбара.
 *  • Хранит ширину в state + localStorage
 *  • Пишет --sidebar-width в :root (для контента)
 *  • Глобальные mousemove/mouseup → тащить можно даже за пределами сайдбара
 *  • Блокирует выделение текста во время drag
 */
export function useSidebarResize() {
    const [width, setWidth] = useState(() => {
        const saved = parseInt(localStorage.getItem(STORAGE_KEY), 10);
        return Number.isFinite(saved) ? clamp(saved) : DEFAULT_WIDTH;
    });

    const [isResizing, setIsResizing] = useState(false);
    const draggingRef = useRef(false);

    // Синхронизация width → CSS-переменная
    useEffect(() => {
        document.documentElement.style.setProperty('--sidebar-width', `${width}px`);
    }, [width]);

    // Старт drag (вызывается из onMouseDown ресайзера)
    const startResize = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        draggingRef.current = true;
        setIsResizing(true);
    }, []);

    // Глобальные слушатели — навешиваем 1 раз
    useEffect(() => {
        const onMove = (e) => {
            if (!draggingRef.current) return;
            setWidth(clamp(e.clientX));
        };

        const onUp = () => {
            if (!draggingRef.current) return;
            draggingRef.current = false;
            setIsResizing(false);
            // Сохраняем актуальную ширину
            setWidth((w) => {
                localStorage.setItem(STORAGE_KEY, String(w));
                return w;
            });
        };

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
    }, []);

    // Глобальный курсор + блок выделения во время drag
    useEffect(() => {
        if (!isResizing) return;
        const prevCursor = document.body.style.cursor;
        const prevSelect = document.body.style.userSelect;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        return () => {
            document.body.style.cursor = prevCursor;
            document.body.style.userSelect = prevSelect;
        };
    }, [isResizing]);

    return { width, isResizing, startResize };
}
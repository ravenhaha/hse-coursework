import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { IoChevronForward, IoHomeOutline } from 'react-icons/io5';
import { useTreeLayout } from './useTreeLayout';
import { usePanZoom } from './usePanZoom';
import GraphNode from './GraphNode';
import NodePreviewModal from '../NodePreviewModal/NodePreviewModal';
import styles from './Graph.module.css';

// ===== Настройки drag’а — правь, чтобы кастомить ощущение перетаскивания =====
const DRAG_MOVE_THRESHOLD = 3; // пиксели в screen-координатах, после которых движение считается дрэгом
// ============================================================================

// Находим узел в дереве по цепочке id (breadcrumb).
function findByPath(root, path) {
    let current = root;
    for (let i = 1; i < path.length; i++) {
        const nextId = path[i];
        current = current.children?.find((c) => c.id === nextId);
        if (!current) return null;
    }
    return current;
}

// Собираем хлебные крошки по текущему пути.
function buildBreadcrumbs(root, path) {
    const crumbs = [];
    let current = root;
    crumbs.push({ id: current.id, name: current.name });
    for (let i = 1; i < path.length; i++) {
        current = current.children?.find((c) => c.id === path[i]);
        if (!current) break;
        crumbs.push({ id: current.id, name: current.name });
    }
    return crumbs;
}

export default function Graph({ data }) {
    // path — цепочка id от настоящего корня к текущему «корню» отображения.
    const [path, setPath] = useState([data.id]);
    const [hoveredId, setHoveredId] = useState(null);
    const [previewNode, setPreviewNode] = useState(null);

    // Позиции узлов, которые пользователь перетащил. key = id узла.
    // При drill-down сбрасываем, чтобы новый уровень начинался с авто-раскладки.
    const [dragOverrides, setDragOverrides] = useState({});
    const dragStateRef = useRef(null);

    // Если пришло новое дерево (mock кликнули повторно) — сбрасываем путь.
    useEffect(() => {
        setPath([data.id]);
    }, [data]);

    const currentRoot = useMemo(() => findByPath(data, path), [data, path]);
    const crumbs = useMemo(() => buildBreadcrumbs(data, path), [data, path]);

    // На верхнем уровне (path.length === 1) не строим дерево — показываем только
    // прямых детей корня как разбросанных светлячков, без связей и без маркеров
    // вложенности. При drill-down рисуем полное поддерево текущего корня.
    const isTopLevel = path.length === 1;
    const { nodes: treeNodes, edges: treeEdges } = useTreeLayout(
        isTopLevel ? null : currentRoot
    );
    const { containerRef, transform, handlers, setTransform } = usePanZoom();

    // Верхний уровень: прямые дети корня, раскиданные по подсолнуховой спирали.
    const scatteredNodes = useMemo(() => {
        if (!isTopLevel) return [];
        const kids = currentRoot?.children ?? [];
        return kids.map((child, i) => {
            const pos = sunflowerScatter(child.id, i, kids.length);
            return {
                id: child.id,
                name: child.name,
                type: child.type,
                raw: child,
                depth: 1,
                x: pos.x,
                y: pos.y,
                hasChildren: false, // на верхнем уровне маркер не показываем
            };
        });
    }, [isTopLevel, currentRoot]);

    // При смене уровня: центрируем сцену и сбрасываем перетаскивания.
    useEffect(() => {
        setDragOverrides({});
        const el = containerRef.current;
        if (!el) return;
        const { width, height } = el.getBoundingClientRect();
        // Верхний уровень: скаттер центрирован в (0,0) — ставим в центр вьюпорта.
        // Drill-down: корень поддерева в (0,0), рост вправо — сдвигаем влево.
        const x = isTopLevel ? width / 2 : width * 0.15;
        setTransform({ x, y: height / 2, scale: 1 });
    }, [path, isTopLevel, setTransform, containerRef]);

    // Применяем перетаскивания поверх авто-раскладки / скаттера.
    const displayNodes = useMemo(() => {
        const base = isTopLevel ? scatteredNodes : treeNodes;
        return base.map((n) => {
            const ov = dragOverrides[n.id];
            return ov ? { ...n, x: ov.x, y: ov.y } : n;
        });
    }, [isTopLevel, scatteredNodes, treeNodes, dragOverrides]);

    const displayEdges = useMemo(
        () => (isTopLevel ? [] : treeEdges),
        [isTopLevel, treeEdges]
    );

    // Карта id → позиция, чтобы рёбра следили за перетаскиваемыми узлами.
    const nodeById = useMemo(() => {
        const m = new Map();
        displayNodes.forEach((n) => m.set(n.id, n));
        return m;
    }, [displayNodes]);

    // --- Drag узлов: стартуем на pointerdown, слушаем move/up на window ---
    const handleNodePointerDown = useCallback(
        (e, node) => {
            e.stopPropagation();
            // Пропускаем правый клик и прочее.
            if (e.button !== 0 && e.pointerType === 'mouse') return;

            const override = dragOverrides[node.id];
            dragStateRef.current = {
                nodeId: node.id,
                startX: e.clientX,
                startY: e.clientY,
                originX: override?.x ?? node.x,
                originY: override?.y ?? node.y,
                scale: transform.scale, // фиксируем зум на момент старта
                moved: false,
                pointerId: e.pointerId,
            };

            const handleMove = (ev) => {
                const drag = dragStateRef.current;
                if (!drag || drag.pointerId !== ev.pointerId) return;
                const dxScreen = ev.clientX - drag.startX;
                const dyScreen = ev.clientY - drag.startY;
                if (!drag.moved && Math.hypot(dxScreen, dyScreen) > DRAG_MOVE_THRESHOLD) {
                    drag.moved = true;
                }
                // Переводим delta экрана в delta SVG-сцены (учитываем зум).
                const dx = dxScreen / drag.scale;
                const dy = dyScreen / drag.scale;
                setDragOverrides((prev) => ({
                    ...prev,
                    [drag.nodeId]: { x: drag.originX + dx, y: drag.originY + dy },
                }));
            };

            const handleUp = () => {
                window.removeEventListener('pointermove', handleMove);
                window.removeEventListener('pointerup', handleUp);
                window.removeEventListener('pointercancel', handleUp);

                const drag = dragStateRef.current;
                dragStateRef.current = null;
                if (!drag) return;

                // Если пользователь не двигал — трактуем как клик.
                if (!drag.moved) {
                    handleNodeActivate(node);
                }
            };

            window.addEventListener('pointermove', handleMove);
            window.addEventListener('pointerup', handleUp);
            window.addEventListener('pointercancel', handleUp);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [dragOverrides, transform.scale]
    );

    const handleNodeActivate = useCallback((node) => {
        // Защита: если каким-то образом кликнули по текущему корню —
        // не пытаемся провалиться «в себя», чтобы не сломать путь.
        if (node.depth === 0) return;
        if (node.type === 'folder') {
            // Drill-down: кликнутая папка становится новым корнем.
            setPath((prev) => [...prev, node.id]);
        } else {
            // Файл — открываем превью.
            setPreviewNode(node.raw);
        }
    }, []);

    const handleCrumbClick = useCallback((index) => {
        setPath((prev) => prev.slice(0, index + 1));
    }, []);

    return (
        <div className={styles.wrapper}>
            <div
                ref={containerRef}
                className={styles.canvas}
                onPointerDown={handlers.onPointerDown}
                onPointerMove={handlers.onPointerMove}
                onPointerUp={handlers.onPointerUp}
                onPointerCancel={handlers.onPointerCancel}
            >
                {crumbs.length > 1 && (
                    <div
                        className={styles.breadcrumbs}
                        onPointerDown={(e) => e.stopPropagation()}
                    >
                        {crumbs.map((crumb, i) => {
                            const isLast = i === crumbs.length - 1;
                            return (
                                <div key={crumb.id} className={styles.crumbRow}>
                                    <button
                                        type="button"
                                        className={`${styles.crumb} ${isLast ? styles.crumbActive : ''}`}
                                        onClick={() => handleCrumbClick(i)}
                                        disabled={isLast}
                                    >
                                        {i === 0 && <IoHomeOutline />}
                                        <span>{crumb.name}</span>
                                    </button>
                                    {!isLast && <IoChevronForward className={styles.crumbSep} />}
                                </div>
                            );
                        })}
                    </div>
                )}
                <svg className={styles.svg} width="100%" height="100%">
                    <defs>
                        {/* Палитра светлячка: от белого ядра к бирюзовому ореолу (#3ad7d3) */}
                        <radialGradient id="fireflyCore" cx="50%" cy="50%" r="50%">
                            <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
                            <stop offset="55%" stopColor="#d8fffe" stopOpacity="0.95" />
                            <stop offset="100%" stopColor="#3ad7d3" stopOpacity="0.65" />
                        </radialGradient>
                        <radialGradient id="fireflyGlow" cx="50%" cy="50%" r="50%">
                            <stop offset="0%" stopColor="#a5f0ee" stopOpacity="0.85" />
                            <stop offset="40%" stopColor="#3ad7d3" stopOpacity="0.35" />
                            <stop offset="100%" stopColor="#3ad7d3" stopOpacity="0" />
                        </radialGradient>
                        <radialGradient id="fireflyHalo" cx="50%" cy="50%" r="50%">
                            <stop offset="0%" stopColor="#3ad7d3" stopOpacity="0.35" />
                            <stop offset="45%" stopColor="#3ad7d3" stopOpacity="0.12" />
                            <stop offset="100%" stopColor="#3ad7d3" stopOpacity="0" />
                        </radialGradient>
                    </defs>

                    <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
                        {/* Связи рендерим по текущим позициям узлов — так они «ходят» за dragom */}
                        <g>
                            {displayEdges.map((edge) => {
                                const s = nodeById.get(edge.sourceId);
                                const t = nodeById.get(edge.targetId);
                                if (!s || !t) return null;
                                return (
                                    <path
                                        key={edge.id}
                                        d={buildCurve(s.x, s.y, t.x, t.y)}
                                        fill="none"
                                        stroke="#1d4f70"
                                        strokeWidth={1.4}
                                        opacity={0.85}
                                    />
                                );
                            })}
                        </g>

                        <g>
                            {displayNodes.map((node) => (
                                <GraphNode
                                    key={node.id}
                                    node={node}
                                    onPointerDown={handleNodePointerDown}
                                    isHovered={hoveredId === node.id}
                                    onHoverChange={setHoveredId}
                                />
                            ))}
                        </g>
                    </g>
                </svg>

                <div className={styles.hint}>
                    Колесо — зум · тянуть фон — pan · узел можно тащить · клик по папке — внутрь · клик по файлу — превью
                </div>
            </div>

            <NodePreviewModal
                node={previewNode}
                onClose={() => setPreviewNode(null)}
                onOpenFull={(n) => {
                    // TODO: интеграция с редактором материалов
                    console.log('Открыть материал полностью:', n);
                }}
            />
        </div>
    );
}

// Кубическая кривая Безье между parent-child (горизонтальная ориентация:
// родитель слева, ребёнок справа — изгиб через серединную вертикаль).
function buildCurve(sx, sy, tx, ty) {
    const midX = (sx + tx) / 2;
    return `M ${sx} ${sy} C ${midX} ${sy}, ${midX} ${ty}, ${tx} ${ty}`;
}

// Стабильный хэш id → число, чтобы seed-ить рандом per-узел.
function hashCode(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    return Math.abs(h);
}

// Детерминированный PRNG (mulberry32) — одинаковый seed даёт одинаковую
// последовательность, поэтому позиции не прыгают между рендерами.
function mulberry32(seed) {
    let t = seed >>> 0;
    return function () {
        t = (t + 0x6d2b79f5) >>> 0;
        let x = Math.imul(t ^ (t >>> 15), 1 | t);
        x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
        return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
}

// Подсолнуховая (фибоначчи) спираль — точки распределяются по диску
// равномерно и без перекрытий. Плюс небольшой per-id джиттер, чтобы
// отойти от идеальной регулярности и получить «созвездие».
function sunflowerScatter(id, i, total) {
    const phi = Math.PI * (3 - Math.sqrt(5)); // золотой угол
    const rMax = 120 + Math.sqrt(total) * 80;  // радиус области растёт с количеством узлов
    const r = rMax * Math.sqrt((i + 0.5) / Math.max(total, 1));
    const theta = i * phi;
    const rng = mulberry32(hashCode(String(id)));
    const jitter = 35;
    return {
        x: r * Math.cos(theta) + (rng() - 0.5) * jitter * 2,
        y: r * Math.sin(theta) + (rng() - 0.5) * jitter * 2,
    };
}

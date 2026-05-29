import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { IoChevronForward, IoHomeOutline } from 'react-icons/io5';
import { useTreeLayout } from './useTreeLayout';
import { usePanZoom } from './usePanZoom';
import GraphNode from './GraphNode';
import NodePreviewModal from '../NodePreviewModal/NodePreviewModal';
import styles from './Graph.module.css';

// ===== Настройки drag’а =====
const DRAG_MOVE_THRESHOLD = 3;
// ============================

function findByPath(root, path) {
    let current = root;
    for (let i = 1; i < path.length; i++) {
        const nextId = path[i];
        current = current.children?.find((c) => c.id === nextId);
        if (!current) return null;
    }
    return current;
}

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

// 🆕 onOpenMaterial — колбэк, который открывает материал в основном вьюере.
//    Прокидывается с уровня WorkspacePage через Workspace.
export default function Graph({ data, onOpenMaterial }) {
    const [path, setPath] = useState([data.id]);
    const [hoveredId, setHoveredId] = useState(null);
    const [previewNode, setPreviewNode] = useState(null);

    const [dragOverrides, setDragOverrides] = useState({});
    const dragStateRef = useRef(null);

    useEffect(() => {
        setPath([data.id]);
    }, [data]);

    const currentRoot = useMemo(() => findByPath(data, path), [data, path]);
    const crumbs = useMemo(() => buildBreadcrumbs(data, path), [data, path]);

    const isTopLevel = path.length === 1;
    const { nodes: treeNodes, edges: treeEdges } = useTreeLayout(
        isTopLevel ? null : currentRoot
    );
    const { containerRef, transform, handlers, setTransform } = usePanZoom();

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
                hasChildren: false,
            };
        });
    }, [isTopLevel, currentRoot]);

    useEffect(() => {
        setDragOverrides({});
        const el = containerRef.current;
        if (!el) return;
        const { width, height } = el.getBoundingClientRect();
        const x = isTopLevel ? width / 2 : width * 0.15;
        setTransform({ x, y: height / 2, scale: 1 });
    }, [path, isTopLevel, setTransform, containerRef]);

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

    const nodeById = useMemo(() => {
        const m = new Map();
        displayNodes.forEach((n) => m.set(n.id, n));
        return m;
    }, [displayNodes]);

    const handleNodeActivate = useCallback((node) => {
        if (node.depth === 0) return;
        if (node.type === 'folder') {
            setPath((prev) => [...prev, node.id]);
        } else {
            setPreviewNode(node.raw);
        }
    }, []);

    const handleNodePointerDown = useCallback(
        (e, node) => {
            e.stopPropagation();
            if (e.button !== 0 && e.pointerType === 'mouse') return;

            const override = dragOverrides[node.id];
            dragStateRef.current = {
                nodeId: node.id,
                startX: e.clientX,
                startY: e.clientY,
                originX: override?.x ?? node.x,
                originY: override?.y ?? node.y,
                scale: transform.scale,
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

                if (!drag.moved) {
                    handleNodeActivate(node);
                }
            };

            window.addEventListener('pointermove', handleMove);
            window.addEventListener('pointerup', handleUp);
            window.addEventListener('pointercancel', handleUp);
        },
        [dragOverrides, transform.scale, handleNodeActivate]
    );

    const handleCrumbClick = useCallback((index) => {
        setPath((prev) => prev.slice(0, index + 1));
    }, []);

    // 🆕 ИСПРАВЛЕНИЕ БАГА №3
    // Кнопка «Открыть полностью» в превью графа.
    // Закрываем модалку превью и передаём id наверх — там откроется
    // полноценный MaterialViewerModal.
    const handleOpenFull = useCallback(
        (node) => {
            setPreviewNode(null);
            if (onOpenMaterial) {
                onOpenMaterial(node.id);
            } else {
                console.warn('Graph: onOpenMaterial не прокинут — материал не открыть.');
            }
        },
        [onOpenMaterial],
    );

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
                onOpenFull={handleOpenFull}
            />
        </div>
    );
}

function buildCurve(sx, sy, tx, ty) {
    const midX = (sx + tx) / 2;
    return `M ${sx} ${sy} C ${midX} ${sy}, ${midX} ${ty}, ${tx} ${ty}`;
}

function hashCode(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    return Math.abs(h);
}

function mulberry32(seed) {
    let t = seed >>> 0;
    return function () {
        t = (t + 0x6d2b79f5) >>> 0;
        let x = Math.imul(t ^ (t >>> 15), 1 | t);
        x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
        return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
}

function sunflowerScatter(id, i, total) {
    const phi = Math.PI * (3 - Math.sqrt(5));
    const rMax = 120 + Math.sqrt(total) * 80;
    const r = rMax * Math.sqrt((i + 0.5) / Math.max(total, 1));
    const theta = i * phi;
    const rng = mulberry32(hashCode(String(id)));
    const jitter = 35;
    return {
        x: r * Math.cos(theta) + (rng() - 0.5) * jitter * 2,
        y: r * Math.sin(theta) + (rng() - 0.5) * jitter * 2,
    };
}
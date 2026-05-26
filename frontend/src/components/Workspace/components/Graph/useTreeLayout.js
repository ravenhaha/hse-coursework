import { useMemo } from 'react';
import { hierarchy, tree as d3tree } from 'd3-hierarchy';

// ===== Геометрия дерева — правь эти значения, чтобы кастомить раскладку =====
const SIBLING_SPACING = 80;   // вертикальное расстояние между соседями
const LEVEL_SPACING = 220;    // горизонтальное расстояние между уровнями
// Ориентация — слева направо: корень в (0, 0), дети правее (x > 0), сиблинги
// распределены по вертикали. Это достигается тем, что мы меняем местами
// результаты d3.tree (по умолчанию сверху вниз) после раскладки.
// Глубину не ограничиваем — на drill-down рисуем полное поддерево.
// ============================================================================

export function useTreeLayout(rootData) {
    return useMemo(() => {
        if (!rootData) return { nodes: [], edges: [], bounds: null };

        // 1) d3-hierarchy превращает объект в иерархию с parent/children.
        const root = hierarchy(rootData);

        // 2) d3.tree раскладывает дерево по алгоритму Рейнгольда–Тилфорда.
        //    nodeSize([sibling_gap, level_gap]) — так как мы разворачиваем
        //    результат на 90° (меняем x ↔ y), первый параметр становится
        //    расстоянием между сиблингами по вертикали, второй — между
        //    уровнями по горизонтали.
        const layout = d3tree().nodeSize([SIBLING_SPACING, LEVEL_SPACING]);
        layout(root);

        const nodes = root.descendants().map((d) => ({
            id: d.data.id,
            name: d.data.name,
            type: d.data.type,
            raw: d.data,
            depth: d.depth,
            // Swap: d3.tree кладёт root сверху (y=0, x — сиблинг-ось), а нам
            // нужен рост слева направо, поэтому x = d.y (уровень), y = d.x (сиблинг).
            x: d.y,
            y: d.x,
            hasChildren: !!(d.children && d.children.length),
        }));

        const edges = root.links().map((link) => ({
            id: `${link.source.data.id}->${link.target.data.id}`,
            sourceId: link.source.data.id,
            targetId: link.target.data.id,
        }));

        const xs = nodes.map((n) => n.x);
        const ys = nodes.map((n) => n.y);
        const bounds = {
            minX: Math.min(...xs),
            maxX: Math.max(...xs),
            minY: Math.min(...ys),
            maxY: Math.max(...ys),
        };

        return { nodes, edges, bounds };
    }, [rootData]);
}
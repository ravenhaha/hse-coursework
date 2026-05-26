import { memo } from 'react';
import styles from './Graph.module.css';

// ===== Размеры узла-«светлячка» =====
const CORE_RADIUS = 10;       // яркое ядро
const GLOW_RADIUS = 26;       // основное свечение
const HALO_RADIUS = 52;       // внешний ореол
const HIT_RADIUS = 30;        // область клика/драга (невидимая)
const LABEL_OFFSET = GLOW_RADIUS + 18;
const ICON_SIZE = 16;
// ====================================

const FOLDER_ICON_PATH =
    'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z';
const DOC_ICON_PATH =
    'M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm7 0v5h5';

// Стабильный сдвиг фазы пульсации — чтобы светлячки не мигали в унисон.
function phaseDelay(id) {
    const s = String(id);
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return `-${(Math.abs(h) % 400) / 100}s`; // 0..4s отрицательного сдвига
}

const GraphNode = memo(function GraphNode({ node, onPointerDown, isHovered, onHoverChange }) {
    const isFolder = node.type === 'folder';
    const iconPath = isFolder ? FOLDER_ICON_PATH : DOC_ICON_PATH;
    const delay = phaseDelay(node.id);

    return (
        <g
            data-graph-node
            transform={`translate(${node.x}, ${node.y})`}
            className={`${styles.firefly} ${isHovered ? styles.fireflyHover : ''}`}
            style={{ cursor: isHovered ? 'grab' : 'pointer' }}
            onPointerDown={(e) => onPointerDown(e, node)}
            onPointerEnter={() => onHoverChange(node.id)}
            onPointerLeave={() => onHoverChange(null)}
        >
            {/* Внешний ореол — широкое мягкое свечение, пульсирует */}
            <circle
                r={HALO_RADIUS}
                fill="url(#fireflyHalo)"
                className={styles.halo}
                style={{ animationDelay: delay }}
            />

            {/* Основное свечение */}
            <circle
                r={GLOW_RADIUS}
                fill="url(#fireflyGlow)"
                className={styles.glow}
                style={{ animationDelay: delay }}
            />

            {/* Яркое ядро */}
            <circle
                r={CORE_RADIUS}
                fill="url(#fireflyCore)"
                className={styles.core}
                style={{ animationDelay: delay }}
            />

            {/* Иконка внутри ядра — едва заметная, намёк на тип */}
            <svg
                x={-ICON_SIZE / 2}
                y={-ICON_SIZE / 2}
                width={ICON_SIZE}
                height={ICON_SIZE}
                viewBox="0 0 24 24"
                fill="none"
                stroke="#062e40"
                strokeOpacity={0.6}
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ pointerEvents: 'none' }}
            >
                <path d={iconPath} />
            </svg>

            {/* Маркер «есть содержимое» — крошечный огонёк-спутник */}
            {isFolder && node.hasChildren && (
                <circle
                    cx={GLOW_RADIUS - 4}
                    cy={-GLOW_RADIUS + 4}
                    r={3}
                    fill="#d8fffe"
                    className={styles.spark}
                    style={{ animationDelay: delay }}
                />
            )}

            {/* Невидимая область клика, чтобы было удобно попадать */}
            <circle r={HIT_RADIUS} fill="transparent" />

            <text
                x={0}
                y={LABEL_OFFSET}
                textAnchor="middle"
                className={styles.label}
            >
                {truncate(node.name, 18)}
            </text>
        </g>
    );
});

function truncate(text, max) {
    return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

export default GraphNode;

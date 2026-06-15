import { memo, useMemo } from 'react';
import styles from './Sidebar.module.css';

// Палитра цветов для тегов — стабильно по id/имени.
const TAG_PALETTE = [
  '#6366f1', // indigo
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#8b5cf6', // violet
  '#84cc16', // lime
  '#f97316', // orange
  '#14b8a6', // teal
];

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function colorForTag(tag) {
  const key = String(tag?.id ?? tag?.name ?? '');
  return TAG_PALETTE[hashString(key) % TAG_PALETTE.length];
}

const MAX_DOTS = 3;

/**
 * Точки-индикаторы тегов с tooltip'ом при наведении.
 * @param {Array<{id, name} | string>} tags
 */
const TagDots = memo(function TagDots({ tags = [] }) {
  const normalized = useMemo(
    () =>
      tags
        .map((t) =>
          typeof t === 'string'
            ? { id: t, name: t }
            : { id: t?.id, name: t?.name ?? t?.tag_name },
        )
        .filter((t) => t.name),
    [tags],
  );

  if (normalized.length === 0) return null;

  const visible = normalized.slice(0, MAX_DOTS);
  const extra = normalized.length - visible.length;

  const tooltip = normalized.map((t) => `#${t.name}`).join(', ');

  return (
    <span
      className={styles.tagDots}
      title={tooltip}
      aria-label={`Теги: ${tooltip}`}
      data-no-dnd
    >
      {visible.map((tag, idx) => (
        <span
          key={tag.id ?? `${tag.name}-${idx}`}
          className={styles.tagDot}
          style={{ backgroundColor: colorForTag(tag) }}
        />
      ))}
      {extra > 0 && <span className={styles.tagDotsMore}>+{extra}</span>}
    </span>
  );
});

export default TagDots;
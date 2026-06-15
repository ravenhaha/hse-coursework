import styles from './EmptyState.module.css';

/**
 * Универсальный компонент пустого состояния.
 *
 * @param {object}   props
 * @param {React.ComponentType} [props.icon]        — компонент иконки (react-icons)
 * @param {string}              props.title         — заголовок (обязательно)
 * @param {string}              [props.description] — подзаголовок
 * @param {string}              [props.actionLabel] — текст кнопки CTA
 * @param {() => void}          [props.onAction]    — обработчик CTA
 * @param {'sm'|'md'}           [props.size='md']   — размер
 * @param {'default'|'subtle'}  [props.tone='default']
 */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  size = 'md',
  tone = 'default',
}) {
  const cls = [
    styles.empty,
    size === 'sm' ? styles.sizeSm : styles.sizeMd,
    tone === 'subtle' ? styles.toneSubtle : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cls} role="status">
      {Icon && (
        <div className={styles.iconWrap} aria-hidden="true">
          <Icon className={styles.icon} />
        </div>
      )}
      <div className={styles.title}>{title}</div>
      {description && <div className={styles.desc}>{description}</div>}
      {actionLabel && onAction && (
        <button
          type="button"
          className={styles.cta}
          onClick={onAction}
          title={actionLabel}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
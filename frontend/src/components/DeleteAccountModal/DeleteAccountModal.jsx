import { useState, useCallback, useEffect } from 'react';
import { IoWarningOutline, IoCloseOutline } from 'react-icons/io5';
import styles from './DeleteAccountModal.module.css';

const CONFIRM_WORD = 'УДАЛИТЬ';

export default function DeleteAccountModal({
  isOpen,
  onClose,
  onConfirm,
  stats,
}) {
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setValue('');
      setError('');
      setLoading(false);
    }
  }, [isOpen]);

  const isValid = value.trim() === CONFIRM_WORD;

  const handleConfirm = useCallback(async () => {
    if (!isValid || loading) return;
    setLoading(true);
    setError('');
    try {
      await onConfirm();
    } catch (e) {
      setError(e?.message || 'Ошибка удаления аккаунта');
      setLoading(false);
    }
  }, [isValid, loading, onConfirm]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && isValid) {
      e.preventDefault();
      handleConfirm();
    } else if (e.key === 'Escape') {
      onClose?.();
    }
  }, [isValid, handleConfirm, onClose]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button className={styles.closeBtn} onClick={onClose} aria-label="Закрыть">
          <IoCloseOutline />
        </button>

        <div className={styles.iconWrap}>
          <IoWarningOutline className={styles.icon} />
        </div>

        <h2 className={styles.title}>Удалить аккаунт?</h2>

        <p className={styles.text}>
          Это действие <strong>нельзя отменить</strong>. Будут безвозвратно удалены:
        </p>

        <ul className={styles.list}>
          <li>Все ваши коллекции и подколлекции</li>
          <li>Все материалы (тексты и загруженные файлы)</li>
          <li>Все теги</li>
          <li>Привязки к VK и Яндекс</li>
          <li>Профиль и аватар</li>
        </ul>

        {stats && (
          <div className={styles.stats}>
            Будет удалено: <strong>{stats.collections ?? 0}</strong> коллекций,{' '}
            <strong>{stats.materials ?? 0}</strong> материалов
          </div>
        )}

        <label className={styles.label}>
          Для подтверждения введите <code>{CONFIRM_WORD}</code>:
        </label>
        <input
          type="text"
          className={styles.input}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          disabled={loading}
          placeholder={CONFIRM_WORD}
        />

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.actions}>
          <button
            className={styles.cancelBtn}
            onClick={onClose}
            disabled={loading}
          >
            Отмена
          </button>
          <button
            className={styles.deleteBtn}
            onClick={handleConfirm}
            disabled={!isValid || loading}
          >
            {loading ? 'Удаление…' : 'Удалить навсегда'}
          </button>
        </div>
      </div>
    </div>
  );
}
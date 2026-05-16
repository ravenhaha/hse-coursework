import { useState, useRef, useEffect, useCallback } from 'react';
import { IoPencilOutline, IoCheckmark, IoClose } from 'react-icons/io5';
import styles from './EditableField.module.css';

/**
 * Inline-редактируемое текстовое поле.
 *
 * Поведение:
 *   - Иконка ✏️ справа — клик переводит в режим редактирования.
 *   - Enter / клик по ✓ / blur (клик вне) — сохранить.
 *   - Esc / клик по ✕ — отменить.
 *   - Если значение не изменилось → onSave НЕ вызывается.
 *   - Если onSave упал с ошибкой → показываем ошибку, остаёмся в режиме редактирования.
 *
 * Props:
 *   value         — текущее значение (string)
 *   onSave        — async (newValue) => void | throws Error
 *   placeholder   — что показывать когда value пустой
 *   maxLength     — ограничение длины (опционально)
 *   minLength     — минимум после trim (по умолчанию 1)
 */
export default function EditableField({
  value = '',
  onSave,
  placeholder = '—',
  maxLength = 100,
  minLength = 1,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const inputRef = useRef(null);
  // Чтобы blur после клика по ✓/✕ не вызывал двойного save.
  const skipBlurRef = useRef(false);

  // Когда внешнее value меняется (например, после успешного PATCH или
  // когда модалка переоткрылась) — синхронизируем draft.
  useEffect(() => {
    if (!isEditing) setDraft(value);
  }, [value, isEditing]);

  // Авто-фокус и выделение при входе в режим редактирования.
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const enterEdit = useCallback(() => {
    setDraft(value);
    setError(null);
    setIsEditing(true);
  }, [value]);

  const cancel = useCallback(() => {
    setDraft(value);
    setError(null);
    setIsEditing(false);
  }, [value]);

  const save = useCallback(async () => {
    const trimmed = draft.trim();

    // Не изменилось → молча выходим, без запроса.
    if (trimmed === value.trim()) {
      setIsEditing(false);
      setError(null);
      return;
    }

    // Локальная валидация (та же, что на бэке).
    if (trimmed.length < minLength) {
      setError('Имя не может быть пустым');
      return;
    }
    if (trimmed.length > maxLength) {
      setError(`Максимум ${maxLength} символов`);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await onSave?.(trimmed);
      setIsEditing(false);
    } catch (err) {
      // Достаём текст из стандартного { message } от apiFetch.
      setError(err?.message || 'Не удалось сохранить');
    } finally {
      setBusy(false);
    }
  }, [draft, value, onSave, minLength, maxLength]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      skipBlurRef.current = true; // Enter уже триггерит save — blur не нужен.
      save();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      skipBlurRef.current = true;
      cancel();
    }
  };

  const handleBlur = () => {
    // Если уход вызвал клик по ✓ или ✕ — пропускаем (они сами сделают что надо).
    if (skipBlurRef.current) {
      skipBlurRef.current = false;
      return;
    }
    save();
  };

  // mousedown на кнопках ✓/✕ срабатывает РАНЬШЕ blur у input → можем
  // отменить blur и явно вызвать нужное действие.
  const onConfirmMouseDown = (e) => {
    e.preventDefault();
    skipBlurRef.current = true;
    save();
  };
  const onCancelMouseDown = (e) => {
    e.preventDefault();
    skipBlurRef.current = true;
    cancel();
  };

  // ────────── Режим просмотра ──────────
  if (!isEditing) {
    return (
      <div className={styles.viewWrap}>
        <span className={styles.viewValue}>{value || placeholder}</span>
        <button
          type="button"
          className={styles.editBtn}
          onClick={enterEdit}
          title="Редактировать"
          aria-label="Редактировать"
        >
          <IoPencilOutline />
        </button>
      </div>
    );
  }

  // ────────── Режим редактирования ──────────
  return (
    <div className={styles.editWrap}>
      <div className={styles.inputRow}>
        <input
          ref={inputRef}
          className={`${styles.input} ${error ? styles.inputError : ''}`}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          maxLength={maxLength}
          disabled={busy}
        />
        <button
          type="button"
          className={`${styles.actionBtn} ${styles.confirmBtn}`}
          onMouseDown={onConfirmMouseDown}
          disabled={busy}
          title="Сохранить (Enter)"
          aria-label="Сохранить"
        >
          {busy ? <span className={styles.spinner} /> : <IoCheckmark />}
        </button>
        <button
          type="button"
          className={`${styles.actionBtn} ${styles.cancelBtn}`}
          onMouseDown={onCancelMouseDown}
          disabled={busy}
          title="Отмена (Esc)"
          aria-label="Отмена"
        >
          <IoClose />
        </button>
      </div>
      {error && <div className={styles.errorText}>{error}</div>}
    </div>
  );
}
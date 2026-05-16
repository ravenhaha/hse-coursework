import { useState } from 'react';
import { IoEyeOutline, IoEyeOffOutline } from 'react-icons/io5';
import styles from '../Auth.module.css';

export default function PasswordInput({
  value,
  onChange,
  placeholder = 'Пароль',
  disabled = false,
  tabIndex = 0,
  autoComplete = 'current-password',
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={styles.passwordWrap}>
      <input
        className={`${styles.input} ${styles.inputWithIcon}`}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        tabIndex={tabIndex}
        autoComplete={autoComplete}
      />
      <button
        type="button"
        className={styles.eyeButton}
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
        aria-label={visible ? 'Скрыть пароль' : 'Показать пароль'}
        disabled={disabled}
      >
        {visible ? <IoEyeOffOutline /> : <IoEyeOutline />}
      </button>
    </div>
  );
}
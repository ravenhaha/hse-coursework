import { FaVk, FaYandex } from 'react-icons/fa';
import styles from '../Auth.module.css';
import PasswordInput from './PasswordInput';
import PasswordHints from './PasswordHints';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export default function AuthForm({
  mode, email, password, confirmPassword, errorText, loading, isFormReady,
  onEmailChange, onPasswordChange, onConfirmChange, onSubmit,
}) {
  const submitText = mode === 'register' ? 'Создать аккаунт' : 'Войти';
  const isRegister = mode === 'register';
  const showHints = isRegister && password.length > 0;
  const passwordsMatch =
    isRegister && confirmPassword.length > 0
      ? password === confirmPassword
      : undefined;

  return (
    <form className={styles.form} onSubmit={onSubmit}>
      <input
        className={styles.input}
        onChange={(e) => onEmailChange(e.target.value)}
        placeholder="Электронная почта"
        type="email"
        value={email}
        autoComplete="email"
      />

      <PasswordInput
        value={password}
        onChange={onPasswordChange}
        placeholder={isRegister ? 'Пароль' : 'Пароль'}
        autoComplete={isRegister ? 'new-password' : 'current-password'}
      />

      {showHints && (
        <PasswordHints
          password={password}
          match={passwordsMatch}
        />
      )}

      <div className={`${styles.confirmWrap} ${isRegister ? styles.confirmWrapOpen : ''}`}>
        <div className={styles.confirmInner}>
          <PasswordInput
            value={confirmPassword}
            onChange={onConfirmChange}
            placeholder="Подтвердите пароль"
            disabled={!isRegister}
            tabIndex={isRegister ? 0 : -1}
            autoComplete="new-password"
          />
        </div>
      </div>

      {errorText && <p className={styles.error}>{errorText}</p>}

      <div className={styles.dividerWrap}>
        <span className={styles.dividerText}>или</span>
      </div>

      <div className={styles.oauthRow}>
        <button
          aria-label="Войти через VK"
          className={styles.oauthButton}
          onClick={() => { window.location.href = `${API_BASE}/auth/vk`; }}
          type="button"
        >
          <FaVk />
        </button>
        <button
          aria-label="Войти через Яндекс"
          className={styles.oauthButton}
          onClick={() => { window.location.href = `${API_BASE}/auth/yandex`; }}
          type="button"
        >
          <FaYandex />
        </button>
      </div>

      <button className={styles.submitButton} disabled={loading || !isFormReady} type="submit">
        {loading ? 'Загрузка...' : submitText}
      </button>
    </form>
  );
}
import { FaVk, FaYandex } from 'react-icons/fa';
import styles from '../Auth.module.css';
import PasswordInput from './PasswordInput';
import PasswordHints from './PasswordHints';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export default function AuthForm({
  mode,
  email,
  password,
  confirmPassword,
  errorText,
  loading,
  isFormReady,
  emailSuggestion,
  onEmailChange,
  onPasswordChange,
  onConfirmChange,
  onApplyEmailSuggestion,
  onSubmit,
}) {
  const isRegister = mode === 'register';
  const submitText = isRegister ? 'Создать аккаунт' : 'Войти';
  const loadingText = isRegister ? 'Создаём аккаунт…' : 'Входим…';
  const showHints = isRegister && password.length > 0;
  const passwordsMatch =
    isRegister && confirmPassword.length > 0
      ? password === confirmPassword
      : undefined;

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      <input
        className={styles.input}
        onChange={(e) => onEmailChange(e.target.value)}
        placeholder="Электронная почта"
        type="email"
        value={email}
        autoComplete="email"
        autoFocus
      />

      {emailSuggestion && (
        <p className={styles.emailSuggestion}>
          Возможно, вы имели в виду{' '}
          <button
            type="button"
            className={styles.emailSuggestionBtn}
            onClick={onApplyEmailSuggestion}
          >
            {emailSuggestion}
          </button>
          ?
        </p>
      )}

      <PasswordInput
        value={password}
        onChange={onPasswordChange}
        placeholder="Пароль"
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

      <button
        className={styles.submitButton}
        disabled={loading || !isFormReady}
        type="submit"
      >
        {loading ? loadingText : submitText}
      </button>
    </form>
  );
}
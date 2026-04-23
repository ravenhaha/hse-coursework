import { FaVk, FaYandex } from 'react-icons/fa';
import styles from './AuthForm.module.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export default function AuthForm({
  mode,
  email,
  password,
  confirmPassword,
  errorText,
  loading,
  isFormReady,
  onEmailChange,
  onPasswordChange,
  onConfirmChange,
  onSubmit,
}) {
  return (
    <form onSubmit={onSubmit} className={styles.form}>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => onEmailChange(e.target.value)}
        className={styles.input}
        required
      />

      <input
        type="password"
        placeholder="Пароль"
        value={password}
        onChange={(e) => onPasswordChange(e.target.value)}
        className={styles.input}
        required
      />

      {mode === 'register' && (
        <input
          type="password"
          placeholder="Повторите пароль"
          value={confirmPassword}
          onChange={(e) => onConfirmChange(e.target.value)}
          className={styles.input}
          required
        />
      )}

      {errorText && <p className={styles.error}>{errorText}</p>}

      <button
        type="submit"
        className={styles.submit}
        disabled={!isFormReady || loading}
      >
        {loading
          ? 'Подождите...'
          : mode === 'register' ? 'Зарегистрироваться' : 'Войти'}
      </button>

      <div className={styles.divider}>или</div>
      <div className={styles.oauth}>
        <button
          type="button"
          className={styles.oauthBtn}
          onClick={() => { window.location.href = `${API_BASE}/auth/vk`; }}
        >
          <FaVk /> VK
        </button>
        <button
          type="button"
          className={styles.oauthBtn}
          onClick={() => { window.location.href = `${API_BASE}/auth/yandex`; }}
        >
          <FaYandex /> Яндекс
        </button>
      </div>
    </form>
  );
}
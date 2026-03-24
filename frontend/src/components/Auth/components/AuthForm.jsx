import { FaVk, FaYandex } from 'react-icons/fa';
import styles from '../Auth.module.css';

export default function AuthForm({
  mode, email, password, confirmPassword, errorText, loading, isFormReady,
  onEmailChange, onPasswordChange, onConfirmChange, onSubmit,
}) {
  const submitText = mode === 'register' ? 'Создать аккаунт' : 'Войти';

  return (
    <form className={styles.form} onSubmit={onSubmit}>
      <input
        className={styles.input}
        onChange={(e) => onEmailChange(e.target.value)}
        placeholder="Электронная почта"
        type="email"
        value={email}
      />
      <input
        className={styles.input}
        onChange={(e) => onPasswordChange(e.target.value)}
        placeholder={mode === 'register' ? 'Пароль (минимум 8 символов)' : 'Пароль'}
        type="password"
        value={password}
      />

      <div className={`${styles.confirmWrap} ${mode === 'register' ? styles.confirmWrapOpen : ''}`}>
        <div className={styles.confirmInner}>
          <input
            className={styles.input}
            disabled={mode !== 'register'}
            onChange={(e) => onConfirmChange(e.target.value)}
            placeholder="Подтвердите пароль"
            tabIndex={mode === 'register' ? 0 : -1}
            type="password"
            value={confirmPassword}
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
          onClick={() => console.log('[mock-auth] vk')}
          type="button"
        >
          <FaVk />
        </button>
        <button
          aria-label="Войти через Яндекс"
          className={styles.oauthButton}
          onClick={() => console.log('[mock-auth] yandex')}
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
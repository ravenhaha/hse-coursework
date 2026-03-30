import { useMemo, useState } from 'react';
import { FaVk, FaYandex } from 'react-icons/fa';
import { IoClose } from 'react-icons/io5';
import styles from './AuthPage.module.css';

function AuthPage({ onAuthSuccess }) {
  const [mode, setMode] = useState('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorText, setErrorText] = useState('');
  const [loading, setLoading] = useState(false);

  const submitText = useMemo(
    () => (mode === 'register' ? 'Создать аккаунт' : 'Войти'),
    [mode],
  );

  const helperPrefix = useMemo(
    () => (mode === 'register' ? 'Нажимая «Создать аккаунт», вы принимаете ' : 'Нажимая «Войти», вы принимаете '),
    [mode],
  );

  const isFormReady = useMemo(() => {
    const hasEmail = email.trim().length > 0;
    const hasPassword = password.trim().length > 0;

    if (mode === 'login') {
      return hasEmail && hasPassword;
    }

    const hasConfirm = confirmPassword.trim().length > 0;
    const strongEnough = password.length >= 8;
    const matches = password === confirmPassword;

    return hasEmail && hasPassword && hasConfirm && strongEnough && matches;
  }, [mode, email, password, confirmPassword]);

  const onModeSwitch = (nextMode) => {
    setMode(nextMode);
    setErrorText('');
    setPassword('');
    setConfirmPassword('');
  };

  const onClose = () => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.assign('/');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorText('');

    if (!email.trim() || !password.trim()) {
      setErrorText('Заполните email и пароль.');
      return;
    }

    if (mode === 'register' && password.length < 8) {
      setErrorText('Пароль должен содержать минимум 8 символов.');
      return;
    }

    if (mode === 'register' && password !== confirmPassword) {
      setErrorText('Пароли не совпадают.');
      return;
    }

    setLoading(true);
    try {
      // TODO: заменить на реальный API-вызов
      await new Promise((resolve) => setTimeout(resolve, 500));
      onAuthSuccess?.({ name: email.split('@')[0], email });
    } catch {
      setErrorText('Ошибка сервера. Попробуйте позже.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <button
          aria-label="Закрыть"
          className={styles.closeButton}
          onClick={onClose}
          type="button"
        >
          <IoClose />
        </button>

        <h1 className={styles.title}>Омут памяти</h1>
        <p className={styles.subtitle}>Войдите или создайте новый аккаунт</p>

        <div className={styles.switcher}>
          <span
            className={`${styles.switchHighlight} ${mode === 'login' ? styles.switchHighlightRight : ''}`}
          />
          <button
            className={`${styles.switchButton} ${mode === 'register' ? styles.switchButtonActive : ''}`}
            onClick={() => onModeSwitch('register')}
            type="button"
          >
            Регистрация
          </button>
          <button
            className={`${styles.switchButton} ${mode === 'login' ? styles.switchButtonActive : ''}`}
            onClick={() => onModeSwitch('login')}
            type="button"
          >
            Вход
          </button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <input
            className={styles.input}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Электронная почта"
            type="email"
            value={email}
          />
          <input
            className={styles.input}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={mode === 'register' ? 'Пароль (минимум 8 символов)' : 'Пароль'}
            type="password"
            value={password}
          />

          <div className={`${styles.confirmWrap} ${mode === 'register' ? styles.confirmWrapOpen : ''}`}>
            <div className={styles.confirmInner}>
              <input
                className={styles.input}
                disabled={mode !== 'register'}
                onChange={(event) => setConfirmPassword(event.target.value)}
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

        <p className={styles.legalText}>
          {helperPrefix}
          <a className={styles.legalLink} href="/terms.html" target="_blank" rel="noreferrer">
            пользовательское соглашение
          </a>
          {' '}и{' '}
          <a className={styles.legalLink} href="/privacy.html" target="_blank" rel="noreferrer">
            политику конфиденциальности
          </a>
        </p>
      </section>
    </main>
  );
}

export default AuthPage;


import { IoClose } from 'react-icons/io5';
import useAuthForm from './useAuthForm';
import ModeSwitcher from './components/ModeSwitcher';
import AuthForm from './components/AuthForm';
import LegalText from './components/LegalText';
import SessionExpiredBanner from '../SessionExpiredBanner/SessionExpiredBanner'; // 🆕
import styles from './Auth.module.css';

function Auth() {
  const form = useAuthForm();

  const onClose = () => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.assign('/');
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

        <SessionExpiredBanner /> {/* 🆕 */}

        <ModeSwitcher mode={form.mode} onSwitch={form.switchMode} />

        <AuthForm
          mode={form.mode}
          email={form.email}
          password={form.password}
          confirmPassword={form.confirmPassword}
          errorText={form.errorText}
          loading={form.loading}
          isFormReady={form.isFormReady}
          onEmailChange={form.setEmail}
          onPasswordChange={form.setPassword}
          onConfirmChange={form.setConfirmPassword}
          onSubmit={form.handleSubmit}
        />

        <LegalText mode={form.mode} />
      </section>
    </main>
  );
}

export default Auth;
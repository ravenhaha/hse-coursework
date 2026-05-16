import { IoClose, IoTimeOutline } from 'react-icons/io5';
import { useAuth } from '../../hooks/useAuth';
import styles from './SessionExpiredBanner.module.css';

function SessionExpiredBanner() {
  const { sessionExpired, dismissSessionExpired } = useAuth();

  if (!sessionExpired) return null;

  return (
    <div className={styles.banner} role="alert">
      <IoTimeOutline className={styles.icon} aria-hidden="true" />
      <div className={styles.text}>
        <strong>Сессия истекла</strong>
        <span>Войдите снова, чтобы продолжить.</span>
      </div>
      <button
        type="button"
        className={styles.closeButton}
        onClick={dismissSessionExpired}
        aria-label="Закрыть уведомление"
      >
        <IoClose />
      </button>
    </div>
  );
}

export default SessionExpiredBanner;
import { IoSettingsOutline, IoLogOutOutline } from 'react-icons/io5';
import styles from './Sidebar.module.css';

export default function UserPanel({ user, onSettings, onLogout }) {
  return (
    <div className={styles.userSection}>
      {user && (
        <div className={styles.userInfo}>
          <div className={styles.avatar}>
            {user.name?.charAt(0) || '?'}
          </div>
          <div className={styles.userText}>
            <div className={styles.userName}>{user.name}</div>
            <div className={styles.userEmail}>{user.email}</div>
          </div>
        </div>
      )}
      <div className={styles.userActions}>
        <button className={styles.settingsButton} onClick={() => onSettings?.()}>
          <IoSettingsOutline />
          <span>Настройки</span>
        </button>
        <button className={styles.logoutButton} onClick={() => onLogout?.()}>
          <IoLogOutOutline />
        </button>
      </div>
    </div>
  );
}

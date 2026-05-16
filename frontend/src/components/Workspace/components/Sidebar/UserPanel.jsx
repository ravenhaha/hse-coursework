import { IoSettingsOutline, IoLogOutOutline } from 'react-icons/io5';
import styles from './Sidebar.module.css';
import { getAvatarUrl } from '../../../../utils/avatar';

export default function UserPanel({ user, onSettings, onLogout }) {
  const avatarUrl = getAvatarUrl(user);
  const initial = (user?.name || user?.email || '?')
    .trim()
    .charAt(0)
    .toUpperCase();

  return (
    <div className={styles.userSection}>
      {user && (
        <div className={styles.userInfo}>
          <div
            className={styles.avatar}
            title={user.email || user.name}  /* 🆕 ЭТАП 2 */
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={user.name ? `Аватар ${user.name}` : 'Аватар пользователя'}
                className={styles.avatarImg}
              />
            ) : (
              initial
            )}
          </div>
          <div className={styles.userText}>
            <div className={styles.userName} title={user.name}>
              {user.name}
            </div>
            <div className={styles.userEmail} title={user.email}>
              {user.email}
            </div>
          </div>
        </div>
      )}
      <div className={styles.userActions}>
        <button
          className={styles.settingsButton}
          onClick={() => onSettings?.()}
          title="Настройки профиля"          /* 🆕 ЭТАП 2 */
          aria-label="Открыть настройки профиля"
        >
          <IoSettingsOutline />
          <span>Настройки</span>
        </button>
        <button
          className={styles.logoutButton}
          onClick={() => onLogout?.()}
          title="Выйти из аккаунта"           /* 🆕 ЭТАП 2 */
          aria-label="Выйти из аккаунта"
        >
          <IoLogOutOutline />
        </button>
      </div>
    </div>
  );
}
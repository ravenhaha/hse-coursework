import styles from '../Auth.module.css';

export default function ModeSwitcher({ mode, onSwitch }) {
  return (
    <div className={styles.switcher}>
      <span
        className={`${styles.switchHighlight} ${mode === 'login' ? styles.switchHighlightRight : ''}`}
      />
      <button
        className={`${styles.switchButton} ${mode === 'register' ? styles.switchButtonActive : ''}`}
        onClick={() => onSwitch('register')}
        type="button"
      >
        Регистрация
      </button>
      <button
        className={`${styles.switchButton} ${mode === 'login' ? styles.switchButtonActive : ''}`}
        onClick={() => onSwitch('login')}
        type="button"
      >
        Вход
      </button>
    </div>
  );
}
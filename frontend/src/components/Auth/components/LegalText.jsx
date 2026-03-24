import styles from '../Auth.module.css';

export default function LegalText({ mode }) {
  const prefix = mode === 'register'
    ? 'Нажимая «Создать аккаунт», вы принимаете '
    : 'Нажимая «Войти», вы принимаете ';

  return (
    <p className={styles.legalText}>
      {prefix}
      <a className={styles.legalLink} href="/terms.html" target="_blank" rel="noreferrer">
        пользовательское соглашение
      </a>
      {' '}и{' '}
      <a className={styles.legalLink} href="/privacy.html" target="_blank" rel="noreferrer">
        политику конфиденциальности
      </a>
    </p>
  );
}

import { IoCheckmarkCircle, IoEllipseOutline } from 'react-icons/io5';
import styles from '../Auth.module.css';
import { checkPasswordRules, PASSWORD_RULES } from './passwordRules';

export default function PasswordHints({ password, match }) {
  const rules = checkPasswordRules(password);

  return (
    <ul className={styles.hintList}>
      {PASSWORD_RULES.map((r) => {
        const ok = rules[r.key];
        return (
          <li
            key={r.key}
            className={`${styles.hintItem} ${ok ? styles.hintItemOk : ''}`}
          >
            {ok ? <IoCheckmarkCircle /> : <IoEllipseOutline />}
            <span>{r.text}</span>
          </li>
        );
      })}
      {match !== undefined && (
        <li className={`${styles.hintItem} ${match ? styles.hintItemOk : ''}`}>
          {match ? <IoCheckmarkCircle /> : <IoEllipseOutline />}
          <span>Пароли совпадают</span>
        </li>
      )}
    </ul>
  );
}
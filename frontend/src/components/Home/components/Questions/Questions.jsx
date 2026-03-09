import styles from './Questions.module.css';
import questions from './index.js';

function Questions() {
    return (
        <section id="questions" className={styles.questions}>
            <h2 className={styles.maintitle}>Частые вопросы</h2>
            <p className={styles.maintext}>Ответы на вопросы о работе с Омутом памяти</p>
            <ul className={styles.list}>
                {questions.map((question) => (
                    <li key={question.id} className={styles['quest-card']}>
                        <h3 className={styles.title}>{question.title}</h3>
                        <p className={styles.text}>{question.text}</p>
                    </li>
                ))}
            </ul>
        </section>
    );
}

export default Questions;
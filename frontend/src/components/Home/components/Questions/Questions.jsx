import { useState } from 'react';
import styles from './Questions.module.css';
import questions from './index.js';
import chevronDown from '../../../../assets/icons/chevron-down.svg';

function Questions() {
    const [openId, setOpenId] = useState(null);

    const toggle = (id) => {
        setOpenId(openId === id ? null : id);
    };

    return (
        <section id="questions" className={styles.questions}>
            <div className="container">
                <div>
                    <h2 className={styles.mainTitle}>Частые вопросы</h2>
                    <p className={styles.mainText}>Ответы на вопросы о работе с Омутом памяти</p>
                </div>
                <ul className={styles.list}>
                    {questions.map((question) => (
                        <li
                            key={question.id}
                            className={`${styles.questCard} ${openId === question.id ? styles.open : ''}`}
                            onClick={() => toggle(question.id)}
                        >
                            <div className={styles.header}>
                                <h3 className={styles.title}>{question.title}</h3>
                                <img src={chevronDown} alt="" className={`${styles.icon} ${openId === question.id ? styles.iconOpen : ''}`} />
                            </div>
                            {openId === question.id && (
                                <p className={styles.text}>{question.text}</p>
                            )}
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    );
}

export default Questions;
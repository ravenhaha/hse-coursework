import { useState } from 'react';
import styles from './Questions.module.css';
import questions from './index.js';
import { FaDatabase, FaGlobe, FaLock, FaStar, FaUsers } from 'react-icons/fa';

const questionIcons = [FaStar, FaLock, FaDatabase, FaGlobe, FaUsers];

function Questions() {
    const [openId, setOpenId] = useState(null);

    const toggle = (id) => {
        setOpenId(openId === id ? null : id);
    };

    return (
        <section id="faq" className={styles.questions}>
            <div className={`container ${styles.container}`}>
                <div className={styles.heading}>
                    <h2 className={styles.mainTitle}>Частые вопросы</h2>
                    <p className={styles.mainText}>Ответы на вопросы о работе с Омутом памяти</p>
                </div>
                <ul className={styles.list}>
                    {questions.map((question, index) => {
                        const Icon = questionIcons[index % questionIcons.length];
                        const isOpen = openId === question.id;

                        return (
                            <li key={question.id}>
                                <button
                                    type="button"
                                    className={`${styles.questCard} ${isOpen ? styles.open : ''}`}
                                    onClick={() => toggle(question.id)}
                                    aria-expanded={isOpen}
                                >
                                    <span className={styles.iconBox}>
                                        <Icon aria-hidden="true" />
                                    </span>
                                    <span className={styles.cardBody}>
                                        <span className={styles.title}>{question.title}</span>
                                        <span className={styles.text}>{question.text}</span>
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </section>
    );
}

export default Questions;

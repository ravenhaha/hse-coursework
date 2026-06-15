import { useState } from 'react';
import { FaCheck } from 'react-icons/fa';
import styles from './Advertisement.module.css';
import useDive from '../../../../hooks/useDive.js';

const trustItems = [
    'Без кредитной карты',
    'Начать можно сразу',
    'Данные под контролем',
];

function Advertisement() {
    const [email, setEmail] = useState('');
    const { handleDive } = useDive();

    const handleSubmit = (event) => {
        event.preventDefault();
        handleDive('/auth');
    };

    return (
        <section className={styles.advertisement}>
            <div className={`container ${styles.container}`}>
                <div className={styles.heading}>
                    <h2 className={styles.title}>
                        Начните
                        <br />
                        сейчас
                    </h2>
                    <p className={styles.text}>
                        Каждое воспоминание — это часть вашей истории. Соберите их вместе и откройте новые грани себя.
                    </p>
                </div>

                <form className={styles.form} onSubmit={handleSubmit}>
                    <div className={styles.formRow}>
                        <input
                            className={styles.input}
                            type="email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            placeholder="Введите ваш email"
                            aria-label="Email"
                        />
                        <button className={styles.button} type="submit">
                            Создать аккаунт
                        </button>
                    </div>
                    <p className={styles.subtext}>
                        Регистрируясь, вы соглашаетесь с условиями использования
                    </p>
                </form>

                <ul className={styles.trustList}>
                    {trustItems.map((item) => (
                        <li key={item} className={styles.trustItem}>
                            <FaCheck aria-hidden="true" />
                            <span>{item}</span>
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    );
}

export default Advertisement;

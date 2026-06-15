import { FaTelegramPlane, FaVk, FaYoutube } from 'react-icons/fa';
import styles from './Footer.module.css';

const navLinks = [
    { label: 'О нас', href: '#about' },
    { label: 'Возможности', href: '#features' },
    { label: 'Принципы', href: '#principles' },
    { label: 'FAQ', href: '#faq' },
    { label: 'Блог', href: '#' },
    { label: 'Контакты', href: '#' },
];

const socialLinks = [
    { label: 'Telegram', href: '#', icon: FaTelegramPlane },
    { label: 'VK', href: '#', icon: FaVk },
    { label: 'YouTube', href: '#', icon: FaYoutube },
];

function Footer() {
    return (
        <footer className={styles.footer}>
            <div className={`container ${styles.container}`}>
                <div className={styles.brand}>
                    <span className={styles.logo} aria-hidden="true" />
                    <h3 className={styles.title}>Омут Памяти</h3>
                </div>

                <nav className={styles.nav} aria-label="Навигация в футере">
                    {navLinks.map((link, index) => (
                        <a key={link.label} href={link.href} className={styles.navLink}>
                            {link.label}
                            {index < navLinks.length - 1 && (
                                <span className={styles.dot} aria-hidden="true">•</span>
                            )}
                        </a>
                    ))}
                </nav>

                <div className={styles.socialLink}>
                    {socialLinks.map(({ label, href, icon: Icon }) => (
                        <a className={styles.link} href={href} key={label} aria-label={label}>
                            <Icon aria-hidden="true" />
                        </a>
                    ))}
                </div>

                <p className={styles.copyright}>
                    © 2024 Омут Памяти. Все права защищены.
                </p>

                <div className={styles.legalLinks}>
                    <a href="#">Политика конфиденциальности</a>
                    <span aria-hidden="true">•</span>
                    <a href="#">Условия использования</a>
                    <span aria-hidden="true">•</span>
                    <a href="#">Cookies</a>
                </div>
            </div>
        </footer>
    );
}

export default Footer;

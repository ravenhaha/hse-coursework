import styles from './BlurFade.module.css';

function BlurFade({ active }) {
    return (
        <div className={`${styles.overlay} ${active ? styles.active : ''}`} />
    );
}

export default BlurFade;
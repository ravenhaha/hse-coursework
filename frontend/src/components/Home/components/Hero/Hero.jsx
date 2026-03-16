import styles from './Hero.module.css';
import ButtonMain from "../../../Ui/ButtonMain/ButtonMain.jsx";
import VortexBackground from './VortexBackground.jsx';
import Ripples from '../../../Effects/Ripples/Ripples.jsx';
import useDive from '../../../../hooks/useDive.js';


function Hero() {
    const { vortexFast, handleHeroDive } = useDive();

    return (
        <section id="hero" className={styles.hero}>
            <div className={`${styles.vortexWrap} ${vortexFast ? styles.vortexDiving : ''}`}>
                <VortexBackground fast={vortexFast} />
                <Ripples />
            </div>

            <div className={styles.content}>
                <h1 className={styles.title}>Омут памяти</h1>
                <p className={styles.text}>
                    Погрузитесь в&nbsp;глубины своих воспоминаний и&nbsp;извлеките
                    смысл из&nbsp;прошлого
                </p>
                <ButtonMain
                    className={styles.link_lk}
                    onClick={() => handleHeroDive('/auth')}>
                    Погрузиться
                </ButtonMain>

                <a href="#about" className={styles.link_bottom} aria-label="Scroll down">
                    <svg width="25" height="14" viewBox="0 0 25 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M11.0182 13.49C11.7018 14.1736 12.8119 14.1736 13.4955 13.49L23.9955 2.99004C24.6791 2.30645 24.6791 1.19629 23.9955 0.512695C23.3119 -0.170898 22.2018 -0.170898 21.5182 0.512695L12.2541 9.77676L2.99004 0.518164C2.30645 -0.16543 1.19629 -0.16543 0.512695 0.518164C-0.170898 1.20176 -0.170898 2.31191 0.512695 2.99551L11.0127 13.4955L11.0182 13.49Z" fill="#3AD7D3"/>
                    </svg>
                </a>
            </div>
        </section>
    );
}

export default Hero;

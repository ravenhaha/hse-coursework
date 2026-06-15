/* eslint-disable no-unused-vars */
import { motion } from 'framer-motion';
/* eslint-enable no-unused-vars */
import styles from './FadeIn.module.css';

function FadeIn({ children, delay = 0, y = 50, duration = 0.7, className, style }) {
    return (
        <motion.div
            className={`${styles.wrapper} ${className || ''}`}
            style={style}
            initial={{ opacity: 0, y }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{
                duration,
                delay,
                ease: [0.16, 1, 0.3, 1],
            }}
        >
            {children}
        </motion.div>
    );
}

export default FadeIn;
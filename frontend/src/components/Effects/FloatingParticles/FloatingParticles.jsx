import { useEffect, useRef } from 'react';
import styles from './FloatingParticles.module.css';

function FloatingParticles() {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        const resize = () => {
            canvas.width = window.innerWidth;
            // Полная высота документа
            canvas.height = Math.max(
                document.body.scrollHeight,
                document.documentElement.scrollHeight,
                window.innerHeight * 3
            );
        };

        resize();

        const particles = [];
        const count = 120;

        const initParticles = () => {
            particles.length = 0;
            for (let i = 0; i < count; i++) {
                particles.push({
                    x: Math.random() * canvas.width,
                    y: Math.random() * canvas.height,
                    size: Math.random() * 2.5 + 0.5,       
                    speedX: (Math.random() - 0.5) * 0.1,  
                    speedY: -Math.random() * 0.2 - 0.03,
                    opacity: Math.random() * 0.15 + 0.03,
                    pulse: Math.random() * Math.PI * 2,
    });
}
        };

        initParticles();

        let animId;

        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            particles.forEach(p => {
                p.x += p.speedX;
                p.y += p.speedY;
                p.pulse += 0.015;

                const currentOpacity = p.opacity * (0.5 + 0.5 * Math.sin(p.pulse));

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(58, 215, 211, ${currentOpacity})`;
                ctx.fill();

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size * 4, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(58, 215, 211, ${currentOpacity * 0.06})`;
                ctx.fill();

                // Улетела вверх — появляется внизу
                if (p.y < -10) p.y = canvas.height + 10;
                // Улетела вниз — появляется вверху
                if (p.y > canvas.height + 10) p.y = -10;
                if (p.x < -10) p.x = canvas.width + 10;
                if (p.x > canvas.width + 10) p.x = -10;
            });

            animId = requestAnimationFrame(animate);
        };

        animate();

        // Пересчёт при изменении контента
        const observer = new ResizeObserver(() => {
            resize();
            initParticles();
        });
        observer.observe(document.body);

        window.addEventListener('resize', resize);

        return () => {
            cancelAnimationFrame(animId);
            window.removeEventListener('resize', resize);
            observer.disconnect();
        };
    }, []);

    return <canvas ref={canvasRef} className={styles.canvas} />;
}

export default FloatingParticles;
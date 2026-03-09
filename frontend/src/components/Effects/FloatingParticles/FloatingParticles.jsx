/*import { useEffect, useRef } from 'react';
import styles from './FloatingParticles.module.css';

const FloatingParticles = () => {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        let animationId;

        const getSize = () => ({
            w: window.innerWidth,
            h: document.documentElement.scrollHeight,
        });

        const createParticles = (width, height) =>
            Array.from({ length: 60 }, () => ({
                x: Math.random() * width,
                y: Math.random() * height,
                size: Math.random() * 4 + 1,
                speedX: (Math.random() - 0.5) * 0.3,
                speedY: (Math.random() - 0.5) * 0.3,
                opacity: Math.random() * 0.3 + 0.1,
                color: ['#3AD7D3', '#b4dcff', '#7B6FE0', '#ffffff'][
                    Math.floor(Math.random() * 4)
                ],
            }));

        let { w, h } = getSize();
        canvas.width = w;
        canvas.height = h;
        let particles = createParticles(w, h);

        const resize = () => {
            const newSize = getSize();
            const oldW = canvas.width;
            const oldH = canvas.height;
            canvas.width = newSize.w;
            canvas.height = newSize.h;

            particles.forEach((p) => {
                p.x = (p.x / oldW) * newSize.w;
                p.y = (p.y / oldH) * newSize.h;
            });
        };

        window.addEventListener('resize', resize);

        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            particles.forEach((p) => {
                p.x += p.speedX;
                p.y += p.speedY;

                if (p.x < 0) p.x = canvas.width;
                if (p.x > canvas.width) p.x = 0;
                if (p.y < 0) p.y = canvas.height;
                if (p.y > canvas.height) p.y = 0;

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fillStyle = p.color;
                ctx.globalAlpha = p.opacity;
                ctx.fill();
            });

            ctx.globalAlpha = 1;
            animationId = requestAnimationFrame(animate);
        };

        animate();

        return () => {
            cancelAnimationFrame(animationId);
            window.removeEventListener('resize', resize);
        };
    }, []);

    return <canvas ref={canvasRef} className={styles.canvas} />;
};

export default FloatingParticles;*/
import { useRef, useCallback } from 'react';

function AboutCard({ className, text, numbercard, title }) {
    const cardRef = useRef(null);
    const rafRef = useRef(0);

    const handleMouseMove = useCallback((e) => {
        cancelAnimationFrame(rafRef.current);
        const clientX = e.clientX;
        const clientY = e.clientY;
        rafRef.current = requestAnimationFrame(() => {
            const card = cardRef.current;
            if (!card) return;
            const rect = card.getBoundingClientRect();
            card.style.setProperty('--x', `${clientX - rect.left}px`);
            card.style.setProperty('--y', `${clientY - rect.top}px`);
        });
    }, []);

    return (
        <div
            ref={cardRef}
            className={className}
            onMouseMove={handleMouseMove}
        >
            <div className="cardGlow" />
            <span>{numbercard}</span>
            <h4>{title}</h4>
            <p>{text}</p>
        </div>
    );
}

export default AboutCard;
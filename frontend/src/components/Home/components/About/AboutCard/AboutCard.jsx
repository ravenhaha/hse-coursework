import { useRef } from 'react';

function AboutCard({ className, text, numbercard, title }) {
    const cardRef = useRef(null);

    const handleMouseMove = (e) => {
        const card = cardRef.current;
        if (!card) return;
        const rect = card.getBoundingClientRect();
        card.style.setProperty('--x', `${e.clientX - rect.left}px`);
        card.style.setProperty('--y', `${e.clientY - rect.top}px`);
    };

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
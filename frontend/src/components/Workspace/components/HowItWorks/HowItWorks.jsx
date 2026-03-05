import cards from './index.js';

function HowItWorks() {
    return (
        <div>
            <h3>
                Как это работает
            </h3>
            <div>
                {cards.map((card) => (
                    <div key={card.id}>
                        <span>{card.number}</span>
                        <h4>
                            {card.title}
                        </h4>
                        <p>{card.text}</p>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default HowItWorks;
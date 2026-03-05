import cards from './index.js';

function QuickActions() {
    return (
        <div>
            <h3>
                Быстрые действия
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

export default QuickActions;
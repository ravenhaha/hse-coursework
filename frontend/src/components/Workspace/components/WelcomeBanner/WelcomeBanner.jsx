import ButtonMain from '../../../Ui/ButtonMain/ButtonMain';

function WelcomeBanner({ onAddMaterial }) {
    return (
        <div>
            <h2>Начните создавать свою базу знаний</h2>
            <p>
                Омут памяти поможет вам организовать материалы, извлечь ключевые идеи
                и укрепить знания через интервальное повторение
            </p>
            <ButtonMain onClick={onAddMaterial}>
                Добавить первый материал +
            </ButtonMain>
        </div>
    );
}

export default WelcomeBanner;
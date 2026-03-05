import Features from "../../components/Features/Features";
import ReasonsStart from "../../components/Reasons/ReasonStart";
import Principles from "../../components/Principles/Principles";
import styles from "./HomePage.module.css";

function HomePage() {
    return (
        <div className={styles.page}>
            <Features
                title="Возможности"
                text="Откройте для себя инструменты, которые изменят ваш подход к обучению"
            />
            <ReasonsStart />
            <Principles />
        </div>
    );
}

export default HomePage;
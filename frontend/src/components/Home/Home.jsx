import Hero from "./components/Hero/Hero.jsx";
import Questions from "./components/Questions/Questions.jsx";
import Advertisement from "./components/Advertisement/Advertisement.jsx";
import About from "./components/About/About.jsx";
import Features from "./components/Features/Features.jsx";
import Principles from "./components/Principles/Principles.jsx";
import ReasonsStart from "./components/Reasons/ReasonStart.jsx";

function Home() {
    return (
        <>
            <Hero />
            <About />
            <Features
                title="Возможности"
                text="Откройте для себя инструменты, которые изменят ваш подход к обучению"
            />
            <ReasonsStart />
            <Principles />
            <Questions />
            <Advertisement />
        </>
    )
}

export default Home
import { useEffect } from 'react';
import Hero from "./components/Hero/Hero.jsx";
import Questions from "./components/Questions/Questions.jsx";
import Advertisement from "./components/Advertisement/Advertisement.jsx";
import About from "./components/About/About.jsx";
import Features from "./components/Features/Features.jsx";
import Principles from "./components/Principles/Principles.jsx";
import ReasonsStart from "./components/Reasons/ReasonStart.jsx";
import SectionDivider from "../Ui/SectionDivider/SectionDivider.jsx";

function Home() {
    useEffect(() => {
        document.body.classList.add('landing');
        return () => document.body.classList.remove('landing');
    }, []);

    return (
        <>
            <Hero />
            <SectionDivider />
            <About />
            <SectionDivider />
            <Features
                title="Возможности"
                text="Откройте для себя инструменты, которые изменят ваш подход к обучению"
            />
            <SectionDivider />
            <ReasonsStart />
            <SectionDivider />
            <Principles />
            <SectionDivider />
            <Questions />
            <SectionDivider />
            <Advertisement />
        </>
    );
}

export default Home;
import Hero from "./components/Hero/Hero.jsx";
import Questions from "./components/Questions/Questions.jsx";
import Advertisement from "./components/Advertisement/Advertisement.jsx";
import Footer from "./components/Footer/Footer.jsx";
import About from "./components/About/About.jsx";

function Home() {
    return (
        <>
            <Hero />
            <Questions />
            <Advertisement />
            <About />
        </>
    )
}

export default Home
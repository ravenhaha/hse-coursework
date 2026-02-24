import Header from "./components/Header/Header.jsx";
import MainLayout from './layouts/MainLayout/MainLayout';
import Hero from "./components/Hero/Hero.jsx";
import About from "./components/About/About.jsx";

function App() {

  return (
    <MainLayout>
        <Hero />
        <About />
    </MainLayout>
  )
}

export default App

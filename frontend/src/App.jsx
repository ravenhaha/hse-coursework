import Features from "./components/Features/Features";
import ReasonsStart from "./components/Reasons/ReasonStart";
import Principles from "./components/Principles/Principles";

function App() {
  return (
    <main>
      <Features
        title="Возможности"
        text="Откройте для себя инструменты, которые изменят ваш подход к обучению"
      />
      <ReasonsStart />
      <Principles />
    </main>
  )
}

export default App
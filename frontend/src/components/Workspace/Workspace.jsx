import WelcomeBanner from './components/WelcomeBanner/WelcomeBanner'
import HowItWorks from "./components/HowItWorks/HowItWorks.jsx";
import QuickActions from "./components/QuickActions/QuickActions.jsx";

function Workspace() {
    return (
        <>
            <WelcomeBanner/>
            <HowItWorks/>
            <QuickActions />
        </>
    )
}

export default Workspace
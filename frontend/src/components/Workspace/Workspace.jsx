import { useModal } from '../../hooks/useModal';
import { AddMaterialModal } from './components/AddMaterialModal/AddMaterialModal';
import WelcomeBanner from './components/WelcomeBanner/WelcomeBanner';
import HowItWorks from "./components/HowItWorks/HowItWorks.jsx";
import QuickActions from "./components/QuickActions/QuickActions.jsx";

function Workspace() {
    const modal = useModal();

    return (
        <>
            <WelcomeBanner onAddMaterial={modal.open} />
            <HowItWorks />
            <QuickActions />
            <AddMaterialModal isOpen={modal.isOpen} onClose={modal.close} />
        </>
    );
}

export default Workspace;
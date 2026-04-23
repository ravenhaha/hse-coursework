import AddMaterialModal from './components/AddMaterialModal/AddMaterialModal';
import WelcomeBanner from './components/WelcomeBanner/WelcomeBanner';
import HowItWorks from "./components/HowItWorks/HowItWorks.jsx";
import QuickActions from "./components/QuickActions/QuickActions.jsx";

function Workspace({ materialModal }) {
    return (
        <>
            <WelcomeBanner onAddMaterial={materialModal.open} />
            <HowItWorks />
            <QuickActions />
            <AddMaterialModal
                isOpen={materialModal.isOpen}
                onClose={materialModal.close}
            />
        </>
    );
}

export default Workspace;
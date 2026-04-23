import { useModal } from '../../hooks/useModal';
import { useGraph } from '../../context/GraphContext';
import { AddMaterialModal } from './components/AddMaterialModal/AddMaterialModal';
import WelcomeBanner from './components/WelcomeBanner/WelcomeBanner';
import HowItWorks from "./components/HowItWorks/HowItWorks.jsx";
import QuickActions from "./components/QuickActions/QuickActions.jsx";
import Graph from './components/Graph/Graph.jsx';

function Workspace() {
    const modal = useModal();
    const { tree } = useGraph();

    // Пока у пользователя нет материалов — приветственные блоки.
    // Как только tree != null (добавил материал / включил mock) — рендерим граф.
    if (tree) {
        return <Graph data={tree} />;
    }

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
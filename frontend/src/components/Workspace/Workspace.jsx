import { useState, useCallback } from 'react';
import { IoClose } from 'react-icons/io5';
import AddMaterialModal from './components/AddMaterialModal/AddMaterialModal';
import WelcomeBanner from './components/WelcomeBanner/WelcomeBanner';
import HowItWorks from './components/HowItWorks/HowItWorks.jsx';
import QuickActions from './components/QuickActions/QuickActions.jsx';
import GraphPlaceholder from '../Workspace/GraphPlaceholder/GraphPlaceholder.jsx';
import Graph from './components/Graph/Graph.jsx';
import useGraph from '../../hooks/useGraph';
import styles from './Workspace.module.css';

function Workspace({
    materialModal,
    collections = [],
    onAddMaterial,
    // eslint-disable-next-line no-unused-vars
    activeItemId,
    onImportFile,
    onCreateNote,
    homeOpen = false,
    canCloseHome = false,
    onCloseHome,
}) {
    const [modalInitialMode, setModalInitialMode] = useState(null);
    const { tree } = useGraph();

    const openModalWith = useCallback(
        (mode) => {
            setModalInitialMode(mode);
            materialModal.open();
        },
        [materialModal]
    );

    const handleImportFile = useCallback(() => {
        if (onImportFile) return onImportFile();
        openModalWith('upload');
    }, [onImportFile, openModalWith]);

    const handleCreateNote = useCallback(() => {
        if (onCreateNote) return onCreateNote();
        openModalWith('editor');
    }, [onCreateNote, openModalWith]);

    const handleBannerAdd = useCallback(() => {
        openModalWith(null);
    }, [openModalWith]);

    const handleModalClose = useCallback(() => {
        materialModal.close();
        setModalInitialMode(null);
    }, [materialModal]);

    // Решаем, что показывать в основной зоне:
    // 1) Если открыт домашний экран — показываем его (приоритет)
    // 2) Иначе если есть данные графа — рендерим граф Кирилла
    // 3) Иначе — старый плейсхолдер
    const renderMainArea = () => {
        if (homeOpen) {
            return (
                <div className={styles.home}>
                    {canCloseHome && (
                        <button
                            type="button"
                            className={styles.closeHomeBtn}
                            onClick={onCloseHome}
                            title="Закрыть справку (Esc)"
                            aria-label="Закрыть"
                        >
                            <IoClose />
                        </button>
                    )}

                    <WelcomeBanner onAddMaterial={handleBannerAdd} />
                    <HowItWorks />
                    <QuickActions
                        onImportFile={handleImportFile}
                        onCreateNote={handleCreateNote}
                    />
                </div>
            );
        }

        if (tree) {
            return <Graph data={tree} />;
        }

        return <GraphPlaceholder />;
    };

    return (
        <>
            {renderMainArea()}

            <AddMaterialModal
                isOpen={materialModal.isOpen}
                onClose={handleModalClose}
                onSubmit={(data) => {
                    onAddMaterial?.(data);
                    handleModalClose();
                }}
                collections={collections}
                initialMode={modalInitialMode}
            />
        </>
    );
}

export default Workspace;
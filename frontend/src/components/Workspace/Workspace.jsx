import { useState, useCallback } from 'react';
import { IoClose } from 'react-icons/io5';
import AddMaterialModal from './components/AddMaterialModal/AddMaterialModal';
import WelcomeBanner from './components/WelcomeBanner/WelcomeBanner';
import HowItWorks from './components/HowItWorks/HowItWorks.jsx';
import QuickActions from './components/QuickActions/QuickActions.jsx';
import ProTips from '../ProTips/ProTips.jsx';
import GraphPlaceholder from '../Workspace/GraphPlaceholder/GraphPlaceholder.jsx';
import Graph from './components/Graph/Graph.jsx';
import useGraph from '../../hooks/useGraph';
import styles from './Workspace.module.css';

function Workspace({
  materialModal,
  collections = [],
  onAddMaterial,
  onCreateCollection,
  // eslint-disable-next-line no-unused-vars
  activeItemId,
  onImportFile,
  onCreateNote,
  onOpenMaterialFromGraph, // 🆕 для бага №3
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
    [materialModal],
  );

  const handleCreateNote = useCallback(() => {
    if (onCreateNote) return onCreateNote();
    openModalWith('editor');
  }, [onCreateNote, openModalWith]);

  const handleImportFile = useCallback(() => {
    if (onImportFile) return onImportFile();
    openModalWith('upload');
  }, [onImportFile, openModalWith]);

  const handleCreateCollection = useCallback(() => {
    onCreateCollection?.();
  }, [onCreateCollection]);

  const handleModalClose = useCallback(() => {
    materialModal.close();
    setModalInitialMode(null);
  }, [materialModal]);

  // 🆕 ИСПРАВЛЕНИЕ БАГА №1:
  // делаем onSubmit ИСТИННО асинхронным, чтобы AddMaterialModal
  // правильно дождался завершения и не позволил повторного submit.
  // Также пробрасываем ошибки наверх, чтобы модалка их показала.
  const handleSubmitMaterial = useCallback(
    async (data) => {
      try {
        await onAddMaterial?.(data);
        handleModalClose();
      } catch (err) {
        // Не закрываем модалку — пусть пользователь увидит ошибку и исправит
        console.error('Не удалось создать материал:', err);
        throw err;
      }
    },
    [onAddMaterial, handleModalClose],
  );

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

          <WelcomeBanner onCreateCollection={handleCreateCollection} />
          <HowItWorks />
          <QuickActions
            onCreateNote={handleCreateNote}
            onImportFile={handleImportFile}
            onCreateCollection={handleCreateCollection}
          />
          <ProTips />
        </div>
      );
    }

    if (tree) {
      // 🆕 передаём колбэк "открыть материал полностью" в граф
      return <Graph data={tree} onOpenMaterial={onOpenMaterialFromGraph} />;
    }

    return <GraphPlaceholder />;
  };

  return (
    <>
      {renderMainArea()}

      <AddMaterialModal
        isOpen={materialModal.isOpen}
        onClose={handleModalClose}
        onSubmit={handleSubmitMaterial}
        collections={collections}
        initialMode={modalInitialMode}
      />
    </>
  );
}

export default Workspace;
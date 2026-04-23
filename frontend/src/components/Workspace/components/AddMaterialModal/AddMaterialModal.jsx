import {
  useReducer,
  useCallback,
  useRef,
  useState,
  useEffect,
  lazy,
  Suspense,
} from 'react';
import { reducer, initialState, ACTIONS } from './state';

import styles from './AddMaterialModal.module.css';

import ModeSwitch from './ModeSwitch/ModeSwitch';
import CollectionPicker from './CollectionPicker/CollectionPicker';
import DropZone from './DropZone/DropZone';
import FilesList from './FilesList/FilesList';
import TagPicker from './TagPicker/TagPicker';

const EditorArea = lazy(() => import('./EditorArea/EditorArea'));
const Toolbar = lazy(() => import('./Toolbar/Toolbar'));

function EditorFallback() {
  return (
    <div className={styles.editorFallback}>
      <span>Загружаем редактор…</span>
    </div>
  );
}

function pluralWords(n) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'слово';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'слова';
  return 'слов';
}

const BottomIcon = ({ children }) => (
  <svg
    width="18" height="18" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

const IconMic = () => (
  <BottomIcon>
    <rect x="9" y="3" width="6" height="12" rx="3" />
    <path d="M5 11a7 7 0 0014 0" />
    <line x1="12" y1="18" x2="12" y2="22" />
    <line x1="8" y1="22" x2="16" y2="22" />
  </BottomIcon>
);

const IconTag = () => (
  <BottomIcon>
    <path d="M20.5 12.5L12 21a2 2 0 01-2.8 0l-6.2-6.2a2 2 0 010-2.8L11.5 3.5A2 2 0 0113 3h6a2 2 0 012 2v6a2 2 0 01-.5 1.5z" />
    <circle cx="16" cy="8" r="1.3" fill="currentColor" />
  </BottomIcon>
);

const IconStar = ({ filled }) => (
  <svg
    width="18" height="18" viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true"
  >
    <polygon points="12 2 15.1 8.6 22 9.6 17 14.5 18.2 21.5 12 18.2 5.8 21.5 7 14.5 2 9.6 8.9 8.6 12 2" />
  </svg>
);

function EditorBottomBar({ tags, isImportant, wordCount, dispatch }) {
  const [showTags, setShowTags] = useState(false);

  return (
    <div className={styles.bottomBar}>
      <div className={styles.bottomBarRow}>
        <div className={styles.bottomBarLeft}>
          <button
            className={styles.bottomBarBtn}
            disabled
            title="Запись голоса (скоро)"
            type="button"
          >
            <IconMic />
          </button>

          <button
            className={styles.bottomBarBtn}
            onClick={() => setShowTags(!showTags)}
            title="Теги"
            type="button"
          >
            <IconTag />
            {tags.length > 0 && (
              <span className={styles.bottomBarBadge}>{tags.length}</span>
            )}
          </button>

          <button
            className={`${styles.bottomBarBtn} ${isImportant ? styles.importantActive : ''}`}
            onClick={() => dispatch({ type: ACTIONS.TOGGLE_EDITOR_IMPORTANT })}
            title={isImportant ? 'Убрать пометку' : 'Пометить важным'}
            type="button"
          >
            <IconStar filled={isImportant} />
          </button>
        </div>

        <div className={styles.bottomBarRight}>
          <span className={styles.wordCount}>
            {wordCount} {pluralWords(wordCount)}
          </span>
        </div>
      </div>

      {showTags && (
        <div className={styles.bottomBarTags}>
          <TagPicker
            selectedTags={tags}
            onChange={(newTags) =>
              dispatch({ type: ACTIONS.SET_EDITOR_TAGS, payload: newTags })
            }
            onClose={() => setShowTags(false)}
          />
        </div>
      )}
    </div>
  );
}

// ============================================
// Основной компонент
// ============================================

export default function AddMaterialModal({
  isOpen,
  onClose,
  onSubmit,
  initialCollection = null,
}) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const [editor, setEditor] = useState(null);
  const editorRef = useRef(null);

  const [editorMounted, setEditorMounted] = useState(false);
  const [wordCount, setWordCount] = useState(0);

  // Подставляем предвыбранную коллекцию каждый раз при открытии модалки
  useEffect(() => {
    if (isOpen && initialCollection) {
      dispatch({ type: ACTIONS.SET_COLLECTION, payload: initialCollection });
    }
  }, [isOpen, initialCollection]);

  const handleEditorReady = useCallback((ed) => {
    editorRef.current = ed;
    setEditor(ed);

    const updateWordCount = () => {
      const { doc } = ed.state;
      const text = doc.textBetween(0, doc.content.size, '\n', ' ').trim();
      const count = text ? text.split(/\s+/).filter(Boolean).length : 0;
      setWordCount(count);
    };

    updateWordCount();
    ed.on('update', updateWordCount);
    ed.on('destroy', () => {
      setWordCount(0);
      setEditor(null);
      editorRef.current = null;
    });
  }, []);

  const handleModeChange = useCallback((mode) => {
    dispatch({ type: ACTIONS.SET_MODE, payload: mode });
    if (mode === 'editor') setEditorMounted(true);
  }, []);

  const handleCollectionChange = useCallback((collection) => {
    dispatch({ type: ACTIONS.SET_COLLECTION, payload: collection });
  }, []);

  const handleFilesAdded = useCallback((fileList) => {
    const filesArray = Array.from(fileList);
    if (filesArray.length === 0) return;
    dispatch({ type: ACTIONS.ADD_FILES, payload: filesArray });
  }, []);

  const handleTitleChange = useCallback((e) => {
    dispatch({ type: ACTIONS.SET_TITLE, payload: e.target.value });
  }, []);

  const handleClose = useCallback(() => {
    dispatch({ type: ACTIONS.RESET });
    setEditorMounted(false);
    setWordCount(0);
    onClose();
  }, [onClose]);

  const handleSubmit = useCallback(() => {
    if (!state.collection) {
      dispatch({ type: ACTIONS.SET_ERROR, payload: 'Выберите коллекцию' });
      return;
    }

    if (state.mode === 'upload') {
      if (state.files.length === 0) {
        dispatch({ type: ACTIONS.SET_ERROR, payload: 'Добавьте хотя бы один файл' });
        return;
      }

      const finalFiles = state.files.map((item) => ({
        file: item.file,
        tags: item.tags,
        isImportant: item.isImportant,
      }));

      onSubmit({
        mode: 'upload',
        collection: state.collection,
        files: finalFiles,
      });
    }

    if (state.mode === 'editor') {
      const ed = editorRef.current;
      const content = ed ? ed.getHTML() : '';
      const textLength = ed ? ed.state.doc.textContent.length : 0;

      if (textLength === 0 && !state.title.trim()) {
        dispatch({ type: ACTIONS.SET_ERROR, payload: 'Введите заголовок или текст' });
        return;
      }

      onSubmit({
        mode: 'editor',
        collection: state.collection,
        title: state.title,
        content,
        tags: state.editorTags,
        isImportant: state.editorImportant,
      });
    }

    handleClose();
  }, [state, onSubmit, handleClose]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <ModeSwitch activeMode={state.mode} onChange={handleModeChange} />
          <button className={styles.closeBtn} onClick={handleClose} type="button">
            ✕
          </button>
        </div>

        <div className={styles.section}>
          <CollectionPicker
            selected={state.collection}
            onChange={handleCollectionChange}
          />
        </div>

        {state.error && <div className={styles.error}>{state.error}</div>}

        {state.mode === 'upload' && (
          <div className={styles.modeContent}>
            <DropZone onFilesAdded={handleFilesAdded} />
            {state.files.length > 0 && (
              <FilesList files={state.files} dispatch={dispatch} />
            )}
          </div>
        )}

        {(state.mode === 'editor' || editorMounted) && (
          <div
            className={styles.modeContent}
            style={{ display: state.mode === 'editor' ? 'flex' : 'none' }}
          >
            <Suspense fallback={<EditorFallback />}>
              <input
                className={styles.titleInput}
                type="text"
                placeholder="Название заметки..."
                value={state.title}
                onChange={handleTitleChange}
              />

              <Toolbar editor={editor} />

              <div className={styles.editorWrap}>
                <EditorArea onEditorReady={handleEditorReady} />
              </div>

              <EditorBottomBar
                tags={state.editorTags}
                isImportant={state.editorImportant}
                wordCount={wordCount}
                dispatch={dispatch}
              />
            </Suspense>
          </div>
        )}

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={handleClose} type="button">
            Отмена
          </button>
          <button className={styles.submitBtn} onClick={handleSubmit} type="button">
            {state.mode === 'upload' ? 'Загрузить файлы' : 'Создать заметку'}
          </button>
        </div>
      </div>
    </div>
  );
}
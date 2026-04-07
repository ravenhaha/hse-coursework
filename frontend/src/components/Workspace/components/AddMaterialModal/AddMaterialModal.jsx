import { useState, useRef, useEffect, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { Modal } from '../../../Ui/Modal/Modal';
import { DropZone } from './DropZone/DropZone';
import { Toolbar } from './Toolbar/Toolbar';
import { AudioPlayer } from './AudioPlayer/AudioPlayer';
import { BottomBar } from './BottomBar/BottomBar';
import { FilesList } from './FilesList/FilesList';
import { RecordingBar } from './RecordingBar/RecordingBar';
import { CollectionPicker } from './CollectionPicker/CollectionPicker';
import { TagPicker } from './TagPicker/TagPicker';
import { useAudioRecorder } from '../../../../hooks/useAudioRecorder';
import { useWordCount } from '../../../../hooks/useWordCount';
import { useDraft } from '../../../../hooks/useDraft';
import { editorExtensions } from './editorExtensions';
import styles from './AddMaterialModal.module.css';

export function AddMaterialModal({ isOpen, onClose }) {
    const [title, setTitle] = useState('');
    const [tags, setTags] = useState([]);
    const [files, setFiles] = useState([]);
    const [isImportant, setIsImportant] = useState(false);
    const [showEditor, setShowEditor] = useState(false);
    const [collection, setCollection] = useState(null);
    const [showDropTags, setShowDropTags] = useState(false);
    const [error, setError] = useState('');

    const fileInputRef = useRef(null);
    const draftRestored = useRef(false);

    const editor = useEditor({
        extensions: editorExtensions,
        content: '',
    });

    const { isRecording, audioUrl, recordingTime, start, stop, remove } = useAudioRecorder();
    const { words } = useWordCount(editor);
    const { loadDraft, clearDraft, hasDraft } = useDraft({ editor, title, tags });

    useEffect(() => {
        if (!isOpen) {
            draftRestored.current = false;
            return;
        }
        if (!editor || draftRestored.current) return;
        draftRestored.current = true;

        if (hasDraft()) {
            const draft = loadDraft();
            if (draft) {
                const hasContent = draft.content && draft.content !== '<p></p>' && draft.content.trim() !== '';
                queueMicrotask(() => {
                    setTitle(draft.title || '');
                    setTags(draft.tags || []);
                    editor.commands.setContent(draft.content || '');
                    if (hasContent) setShowEditor(true);
                });
            }
        }
    }, [isOpen, editor, hasDraft, loadDraft]);

    const resetAll = useCallback(() => {
        editor?.commands.clearContent();
        setTitle('');
        setTags([]);
        setFiles([]);
        setIsImportant(false);
        setShowEditor(false);
        setShowDropTags(false);
        setCollection(null);
        setError('');
        remove();
        clearDraft();
    }, [editor, remove, clearDraft]);

    const handleClose = useCallback(() => {
        resetAll();
        onClose();
    }, [resetAll, onClose]);

    const handleTemplate = useCallback((template) => {
        if (!editor) return;
        setShowEditor(true);
        editor.commands.setContent(template.content);
        if (template.id !== 'empty' && !title) {
            setTitle(template.name);
        }
        setTimeout(() => editor.commands.focus(), 50);
    }, [editor, title]);

    const handleManualCreate = useCallback(() => {
        setShowEditor(true);
        setTimeout(() => editor?.commands.focus(), 50);
    }, [editor]);

    const handleBackToDropZone = useCallback(() => {
        setShowEditor(false);
    }, []);

    const handleDropFiles = useCallback((droppedFiles) => {
        setFiles(prev => [...prev, ...droppedFiles]);
        setError('');
    }, []);

    const handleFileClick = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    const handleFileSelect = useCallback((e) => {
        const newFiles = Array.from(e.target.files);
        if (newFiles.length > 0) {
            setFiles(prev => [...prev, ...newFiles]);
            setError('');
        }
        e.target.value = '';
    }, []);

    const removeFile = useCallback((index) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    }, []);

    const handleImportantToggle = useCallback(() => {
        setIsImportant(prev => !prev);
    }, []);

    const handleSave = useCallback(() => {
        const hasFiles = files.length > 0;
        const hasContent = editor && editor.getHTML() !== '<p></p>' && editor.getText().trim() !== '';
        const hasAudio = !!audioUrl;

        if (!hasFiles && !hasContent && !hasAudio) {
            setError('Добавьте контент: текст, аудио или файлы');
            setTimeout(() => setError(''), 4000);
            return;
        }

        setError('');

        const material = {
            title: title || 'Без названия',
            content: editor?.getHTML() || '',
            tags,
            collection,
            audioUrl,
            isImportant,
            files: files.map(f => ({ name: f.name, size: f.size, type: f.type })),
            createdAt: new Date().toISOString(),
        };

        console.log('Сохранённый материал:', material);
        resetAll();
        onClose();
    }, [editor, title, tags, collection, audioUrl, isImportant, files, resetAll, onClose]);

    useEffect(() => {
        if (!isOpen) return;
        const onKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                handleSave();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isOpen, handleSave]);

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="Добавление нового материала">
            <div className={styles.content}>
                <input
                    className={styles.titleInput}
                    value={title}
                    onChange={e => { setTitle(e.target.value); setError(''); }}
                    placeholder="Название материала"
                    autoFocus
                />

                {!showEditor ? (
                    <>
                        <CollectionPicker value={collection} onChange={setCollection} />

                        <FilesList files={files} onRemove={removeFile} />

                        <DropZone
                            onFiles={handleDropFiles}
                            onManualCreate={handleManualCreate}
                        />

                        <div className={styles.dropActions}>
                            <div className={styles.tagBtnWrapper}>
                                <button
                                    className={`${styles.dropActionBtn} ${showDropTags ? styles.dropActionBtnActive : ''}`}
                                    onClick={() => setShowDropTags(prev => !prev)}
                                    title="Добавить теги"
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                                        stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                                        <line x1="7" y1="7" x2="7.01" y2="7" />
                                    </svg>
                                    <span>Теги</span>
                                    {tags.length > 0 && (
                                        <span className={styles.tagCount}>{tags.length}</span>
                                    )}
                                </button>

                                {showDropTags && (
                                    <>
                                        <div className={styles.tagOverlay} onClick={() => setShowDropTags(false)} />
                                        <div className={styles.tagPopup}>
                                            <div className={styles.tagPopupHeader}>
                                                <span className={styles.tagPopupTitle}>Теги</span>
                                                {tags.length > 0 && (
                                                    <button className={styles.tagClearBtn} onClick={() => setTags([])}>
                                                        Очистить
                                                    </button>
                                                )}
                                            </div>
                                            <TagPicker tags={tags} setTags={setTags} />
                                        </div>
                                    </>
                                )}
                            </div>

                            <button
                                className={`${styles.dropActionBtn} ${isImportant ? styles.dropActionImportant : ''}`}
                                onClick={handleImportantToggle}
                                title={isImportant ? 'Убрать из важных' : 'Важное'}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24"
                                    fill={isImportant ? 'currentColor' : 'none'}
                                    stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                </svg>
                                <span>Важное</span>
                            </button>
                        </div>

                        {error && <div className={styles.error}>{error}</div>}

                        <button className={styles.saveBtn} onClick={handleSave}>
                            Создать материал
                        </button>
                    </>
                ) : (
                    <>
                        <CollectionPicker value={collection} onChange={setCollection} />

                        <div className={styles.editor}>
                            <Toolbar
                                editor={editor}
                                onTemplate={handleTemplate}
                                onBack={handleBackToDropZone}
                            />
                            <div className={styles.editorBody}>
                                <EditorContent className={styles.editorContent} editor={editor} />
                            </div>
                        </div>

                        {audioUrl && <AudioPlayer src={audioUrl} onRemove={remove} />}

                        <FilesList files={files} onRemove={removeFile} />

                        {isRecording && <RecordingBar time={recordingTime} onStop={stop} />}

                        {error && <div className={styles.error}>{error}</div>}

                        <BottomBar
                            onFileClick={handleFileClick}
                            isRecording={isRecording}
                            onRecordToggle={isRecording ? stop : start}
                            tags={tags}
                            setTags={setTags}
                            isImportant={isImportant}
                            onImportantToggle={handleImportantToggle}
                            wordCount={words}
                            onSave={handleSave}
                        />
                    </>
                )}
            </div>

            <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                tabIndex={-1}
                className={styles.hiddenInput}
            />
        </Modal>
    );
}
import { useState, useRef, useEffect, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { Modal } from '../../../Ui/Modal/Modal';
import { Toolbar } from './Toolbar/Toolbar';
import { TagPicker } from './TagPicker/TagPicker';
import { DropZone } from './DropZone/DropZone';
import { AudioPlayer } from './AudioPlayer/AudioPlayer';
import { CoverUpload } from './CoverUpload/CoverUpload';
import { TemplatesPicker } from './TemplatesPicker/TemplatesPicker';
import { ColorIconPicker } from './ColorIconPicker/ColorIconPicker';
import { useDraft } from '../../../../hooks/useDraft';
import { editorExtensions } from './editorExtensions';
import styles from './AddMaterialModal.module.css';

export function AddMaterialModal({ isOpen, onClose }) {
    const [title, setTitle] = useState('');
    const [tags, setTags] = useState([]);
    const [files, setFiles] = useState([]);
    const [cover, setCover] = useState(null);
    const [materialColor, setMaterialColor] = useState('#3AD7D3');
    const [materialIcon, setMaterialIcon] = useState('📝');
    const [isImportant, setIsImportant] = useState(false);
    const [isPreview, setIsPreview] = useState(false);

    // Аудио
    const [isRecording, setIsRecording] = useState(false);
    const [audioUrl, setAudioUrl] = useState(null);
    const [recordingTime, setRecordingTime] = useState(0);
    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);
    const timerRef = useRef(null);

    // Черновик
    const [draftChecked, setDraftChecked] = useState(false);
    const [showDraftBanner, setShowDraftBanner] = useState(false);

    const editor = useEditor({
        extensions: editorExtensions,
        content: '',
        editable: !isPreview,
    });

    const { loadDraft, clearDraft, hasDraft } = useDraft({
        editor,
        title,
        tags,
    });

    // Счётчик слов
    const [wordCount, setWordCount] = useState({ words: 0, chars: 0 });

    useEffect(() => {
        if (!editor) return;
        const update = () => {
            const text = editor.state.doc.textContent;
            const chars = text.length;
            const words = text.trim() ? text.trim().split(/\s+/).length : 0;
            setWordCount({ words, chars });
        };
        editor.on('update', update);
        update();
        return () => editor.off('update', update);
    }, [editor]);

    // Сброс при закрытии
useEffect(() => {
    if (!isOpen) {
        const timer = setTimeout(() => {
            setDraftChecked(false);
            setShowDraftBanner(false);
            setIsPreview(false);
        }, 0);
        return () => clearTimeout(timer);
    }
}, [isOpen]);

// Проверка черновика при открытии
useEffect(() => {
    if (!isOpen || !editor || draftChecked) return;

    const timer = setTimeout(() => {
        if (hasDraft()) {
            setShowDraftBanner(true);
        }
        setDraftChecked(true);
    }, 0);

    return () => clearTimeout(timer);
}, [isOpen, editor, draftChecked, hasDraft]);

    // Превью
    useEffect(() => {
        if (editor) editor.setEditable(!isPreview);
    }, [isPreview, editor]);

    const restoreDraft = () => {
        const draft = loadDraft();
        if (draft && editor) {
            setTitle(draft.title || '');
            editor.commands.setContent(draft.content || '');
            setTags(draft.tags || []);
        }
        setShowDraftBanner(false);
    };

    const dismissDraft = () => {
        clearDraft();
        setShowDraftBanner(false);
    };

    // Шаблоны
    const applyTemplate = (template) => {
        if (!editor) return;
        editor.commands.setContent(template.content);
        if (template.id !== 'empty' && !title) {
            setTitle(template.name);
        }
    };

    // Аудио
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                setAudioUrl(URL.createObjectURL(blob));
                stream.getTracks().forEach(t => t.stop());
                clearInterval(timerRef.current);
                setRecordingTime(0);
            };

            mediaRecorder.start();
            setIsRecording(true);
            setAudioUrl(null);
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } catch (err) {
            console.error('Микрофон недоступен:', err);
        }
    };

    const stopRecording = () => {
        mediaRecorderRef.current?.stop();
        setIsRecording(false);
    };

    const removeAudio = () => {
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
    };

    const formatTime = (s) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m}:${sec.toString().padStart(2, '0')}`;
    };

    const pluralWords = (n) => {
        if (n % 10 === 1 && n % 100 !== 11) return 'слово';
        if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return 'слова';
        return 'слов';
    };

    // Сохранение
    const handleSave = useCallback(() => {
        if (!editor) return;

        const material = {
            title: title || 'Без названия',
            content: editor.getHTML(),
            tags,
            audioUrl,
            cover,
            color: materialColor,
            icon: materialIcon,
            isImportant,
            files: files.map(f => ({ name: f.name, size: f.size, type: f.type })),
            createdAt: new Date().toISOString(),
        };

        console.log('Сохранённый материал:', material);

        editor.commands.clearContent();
        setTitle('');
        setTags([]);
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
        setCover(null);
        setMaterialColor('#3AD7D3');
        setMaterialIcon('📝');
        setIsImportant(false);
        setFiles([]);
        clearDraft();
        onClose();
    }, [editor, title, tags, audioUrl, cover, materialColor, materialIcon, isImportant, files, clearDraft, onClose]);

    // Горячие клавиши
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                handleSave();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, handleSave]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Добавить материал">

            {/* ── Баннер черновика ── */}
            {showDraftBanner && (
                <div className={styles.draftBanner}>
                    <div className={styles.draftBannerContent}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                        </svg>
                        <span>Найден незавершённый черновик</span>
                    </div>
                    <div className={styles.draftBannerActions}>
                        <button className={styles.draftRestore} onClick={restoreDraft}>
                            Восстановить
                        </button>
                        <button className={styles.draftDismiss} onClick={dismissDraft}>
                            Удалить
                        </button>
                    </div>
                </div>
            )}

            {/* ── Обложка ── */}
            <CoverUpload cover={cover} setCover={setCover} />

            {/* ── Верхняя панель: иконка/цвет + название + важное ── */}
            <div className={styles.titleRow}>
                <ColorIconPicker
                    color={materialColor}
                    setColor={setMaterialColor}
                    icon={materialIcon}
                    setIcon={setMaterialIcon}
                />
                <input
                    className={styles.titleInput}
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Название материала..."
                />
                <button
                    className={`${styles.importantBtn} ${isImportant ? styles.importantBtnActive : ''}`}
                    onClick={() => setIsImportant(!isImportant)}
                    title={isImportant ? 'Убрать из важных' : 'Отметить как важное'}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24"
                        fill={isImportant ? 'currentColor' : 'none'}
                        stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                </button>
            </div>

            {/* ── Панель: Шаблоны + Превью ── */}
            <div className={styles.actionBar}>
                <TemplatesPicker onSelect={applyTemplate} />

                <button
                    className={`${styles.previewBtn} ${isPreview ? styles.previewBtnActive : ''}`}
                    onClick={() => setIsPreview(!isPreview)}
                >
                    {isPreview ? (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                        </svg>
                    ) : (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                        </svg>
                    )}
                    {isPreview ? 'Редактор' : 'Превью'}
                </button>
            </div>

            {/* ── Редактор ── */}
            <div className={`${styles.editor} ${isPreview ? styles.editorPreview : ''}`}>
                {!isPreview && <Toolbar editor={editor} />}
                <EditorContent className={styles.editorContent} editor={editor} />

                <div className={styles.editorFooter}>
                    {audioUrl && (
                        <AudioPlayer src={audioUrl} onRemove={removeAudio} />
                    )}

                    {isRecording && (
                        <div className={styles.recordingIndicator}>
                            <span className={styles.recordingDot} />
                            <span className={styles.recordingText}>
                                Запись {formatTime(recordingTime)}
                            </span>
                        </div>
                    )}

                    <div className={styles.wordCount}>
                        {wordCount.words > 0 && (
                            <span>
                                {wordCount.words} {pluralWords(wordCount.words)} · {wordCount.chars.toLocaleString()} симв.
                            </span>
                        )}
                    </div>

                    <button
                        className={`${styles.micBtn} ${isRecording ? styles.micBtnActive : ''}`}
                        onClick={isRecording ? stopRecording : startRecording}
                        title={isRecording ? 'Остановить' : 'Записать аудио'}
                    >
                        {isRecording ? (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                <rect x="6" y="6" width="12" height="12" rx="2" />
                            </svg>
                        ) : (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                                <line x1="12" y1="19" x2="12" y2="23" />
                                <line x1="8" y1="23" x2="16" y2="23" />
                            </svg>
                        )}
                    </button>
                </div>
            </div>

            {/* ── Файлы ── */}
            <DropZone editor={editor} files={files} setFiles={setFiles} />

            {/* ── Теги ── */}
            <TagPicker tags={tags} setTags={setTags} />

            {/* ── Сохранить ── */}
            <button className={styles.saveBtn} onClick={handleSave}>
                <span>Сохранить материал</span>
                <span className={styles.saveBtnHint}>Ctrl + ↵</span>
            </button>
        </Modal>
    );
}
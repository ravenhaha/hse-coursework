import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
    IoClose,
    IoDownloadOutline,
    IoPencilOutline,
    IoEyeOutline,
    IoSaveOutline,
    IoDocumentOutline,
} from 'react-icons/io5';
import { materialsApi } from '../../api/materials';
import EditorArea from '../Workspace/components/AddMaterialModal/EditorArea/EditorArea';
import Toolbar from '../Workspace/components/AddMaterialModal/Toolbar/Toolbar';
import ImageZoomViewer from '../ImageZoomViewer';
import styles from './MaterialViewerModal.module.css';

/* ──────────────────────────────────────────────
   Определяем тип превью
   ────────────────────────────────────────────── */
function detectPreviewType(material) {
    if (!material) return 'unknown';

    const sourceType = material.raw?.source_type || material.sourceType;
    if (sourceType !== 'file') return 'note';

    if (material.kind === 'image') return 'image';

    const name = (material.name || material.raw?.material_name || '').toLowerCase();
    const path = (material.raw?.file_path || '').toLowerCase();
    const src = path || name;
    const i = src.lastIndexOf('.');
    const ext = i >= 0 ? src.slice(i + 1) : '';

    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return 'image';
    if (ext === 'pdf') return 'pdf';
    if (ext === 'txt') return 'txt';
    if (ext === 'md') return 'md';
    if (ext === 'docx' || ext === 'doc') return 'docx';
    if (ext === 'xlsx' || ext === 'xls') return 'xlsx';
    if (ext === 'pptx' || ext === 'ppt') return 'pptx';
    return 'binary';
}

/* Конфиг для типа: иконка, лейбл, можно ли редактировать */
function getTypeConfig(type) {
    switch (type) {
        case 'note':
            return { canEdit: true, label: 'Заметка' };
        case 'txt':
            return { canEdit: true, label: 'Текстовый файл', ext: '.txt' };
        case 'md':
            return { canEdit: true, label: 'Markdown', ext: '.md' };
        case 'pdf':
            return { canEdit: false, label: 'PDF-документ', ext: '.pdf' };
        case 'docx':
            return { canEdit: false, label: 'Документ Word', ext: '.docx' };
        case 'xlsx':
            return { canEdit: false, label: 'Таблица Excel', ext: '.xlsx' };
        case 'pptx':
            return { canEdit: false, label: 'Презентация PowerPoint', ext: '.pptx' };
        case 'image':
            return { canEdit: false, label: 'Изображение' };
        case 'binary':
            return { canEdit: false, label: 'Файл' };
        default:
            return { canEdit: false, label: 'Материал' };
    }
}

export default function MaterialViewerModal({ material, onClose, onUpdated }) {
    const [fresh, setFresh] = useState(null);
    const [loadingMeta, setLoadingMeta] = useState(true);
    const [error, setError] = useState('');

    const [editor, setEditor] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [saving, setSaving] = useState(false);

    const [blobUrl, setBlobUrl] = useState(null);
    const [rawText, setRawText] = useState(''); // содержимое .txt/.md как текст

    const previewType = useMemo(() => detectPreviewType(material), [material]);
    const typeConfig = useMemo(() => getTypeConfig(previewType), [previewType]);

    const isImage = previewType === 'image';
    const isPdf = previewType === 'pdf';
    const isTxt = previewType === 'txt';
    const isMd = previewType === 'md';
    const isDocx = previewType === 'docx';
    const isXlsx = previewType === 'xlsx';
    const isPptx = previewType === 'pptx';
    const isNote = previewType === 'note';
    const isBinary = previewType === 'binary';
    const isOfficeOnly = isDocx || isXlsx || isPptx; // Office-форматы — только скачать
    const isFileSource =
        material?.raw?.source_type === 'file' || material?.sourceType === 'file';

    const needsBlob = isFileSource;
    const hasTextContent = !!(fresh?.text_content && fresh.text_content.trim());

    const dirtyRef = useRef(false);
    useEffect(() => { dirtyRef.current = isDirty; }, [isDirty]);

    /* ── Загрузка meta + text_content ── */
    useEffect(() => {
        if (!material) return;
        if (isImage || isBinary || isOfficeOnly || isPdf) {
            // Для типов без редактируемой заметки meta не нужна
            setLoadingMeta(false);
            return;
        }

        let alive = true;
        setLoadingMeta(true);
        setError('');

        materialsApi
            .get(material.id)
            .then((data) => { if (alive) setFresh(data); })
            .catch((e) => { if (alive) setError(e?.message || 'Ошибка загрузки'); })
            .finally(() => { if (alive) setLoadingMeta(false); });

        return () => { alive = false; };
    }, [material, isImage, isBinary, isOfficeOnly, isPdf]);

    /* ── Загрузка blob ── */
    useEffect(() => {
        if (!material || !needsBlob) return;

        let url = null;
        let alive = true;

        materialsApi
            .getFileBlob(material.id)
            .then(async (blob) => {
                if (!alive) return;
                url = URL.createObjectURL(blob);
                setBlobUrl(url);

                // Для .txt/.md дополнительно вытаскиваем сырой текст —
                // он понадобится при переходе в режим редактирования
                if (isTxt || isMd) {
                    try {
                        const text = await blob.text();
                        if (alive) setRawText(text);
                    } catch { /* ignore */ }
                }
            })
            .catch((e) => {
                if (alive) setError(e?.message || 'Не удалось загрузить файл');
            });

        return () => {
            alive = false;
            if (url) URL.revokeObjectURL(url);
            setBlobUrl(null);
        };
    }, [material, needsBlob, isTxt, isMd]);

    /* ── Заливка контента в редактор (только когда редактируем) ── */
    useEffect(() => {
        if (!editor || !isEditing) return;

        let content = '';
        if (isNote) {
            content = fresh?.text_content || '';
        } else if (isTxt || isMd) {
            // .txt/.md — оборачиваем сырой текст в <p> чтобы tiptap нормально показал
            content = rawText
                ? rawText
                      .split('\n')
                      .map((line) => `<p>${escapeHtml(line) || '<br>'}</p>`)
                      .join('')
                : '';
        }

        editor.commands.setContent(content, false);
        setIsDirty(false);

        const onUpdate = () => setIsDirty(true);
        editor.on('update', onUpdate);
        return () => editor.off('update', onUpdate);
    }, [editor, isEditing, isNote, isTxt, isMd, fresh, rawText]);

    const tryClose = useCallback(() => {
        if (dirtyRef.current && !confirm('Есть несохранённые изменения. Закрыть?')) return;
        onClose();
    }, [onClose]);

    const handleSave = useCallback(async () => {
        if (!editor || !isDirty || saving) return;
        setSaving(true);
        try {
            // Для заметок сохраняем HTML, для .txt/.md — тоже HTML
            // (на бэке отдельно надо будет реализовать обновление .txt/.md как файлов,
            //  но пока сохраняем text_content универсально)
            const html = editor.getHTML();
            const updated = await materialsApi.update(material.id, { text_content: html });
            setFresh(updated);
            setIsDirty(false);
            setIsEditing(false);
            onUpdated?.(updated);
        } catch (e) {
            alert(`Не удалось сохранить: ${e?.message || 'ошибка'}`);
        } finally {
            setSaving(false);
        }
    }, [editor, isDirty, saving, material, onUpdated]);

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape') tryClose();
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && isEditing) {
                e.preventDefault();
                handleSave();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [tryClose, isEditing, handleSave]);

    const handleToggleEdit = () => {
        if (isEditing && isDirty) {
            if (!confirm('Отменить изменения?')) return;
            setIsDirty(false);
        }
        setIsEditing((v) => !v);
    };

    const handleDownloadOriginal = () => {
        if (!blobUrl) return;
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = material.name || 'file';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    if (!material) return null;

    /* ─── Заглушка для Office-форматов ─── */
    const renderOfficePlaceholder = () => {
        const ext = typeConfig.ext || '';
        return (
            <div className={styles.center}>
                <IoDocumentOutline
                    style={{ fontSize: 64, color: '#9ca3af', marginBottom: 12 }}
                />
                <p style={{ fontSize: 16, fontWeight: 500, marginBottom: 6 }}>
                    Превью {ext} недоступно
                </p>
                <p className={styles.muted} style={{ maxWidth: 400, marginBottom: 16 }}>
                    Браузер не умеет открывать {ext} напрямую.
                    Скачайте файл, чтобы открыть его в подходящей программе.
                </p>
                <button
                    className={styles.primaryBtn}
                    onClick={handleDownloadOriginal}
                    disabled={!blobUrl}
                    type="button"
                >
                    <IoDownloadOutline /> Скачать {ext}
                </button>
            </div>
        );
    };

    /* ─── РЕНДЕР ТЕЛА ─── */
    const renderBody = () => {
        if (error) return <div className={styles.center}>{error}</div>;

        // 🖼 Картинка
        if (isImage) {
            if (!blobUrl) return <div className={styles.center}>Загрузка изображения…</div>;
            return <ImageZoomViewer src={blobUrl} alt={material.name} />;
        }

        // 🚫 Бинарник
        if (isBinary) {
            return (
                <div className={styles.center}>
                    <p className={styles.muted} style={{ marginBottom: 16 }}>
                        Превью для этого типа файла недоступно.
                    </p>
                    <button
                        className={styles.primaryBtn}
                        onClick={handleDownloadOriginal}
                        disabled={!blobUrl}
                        type="button"
                    >
                        <IoDownloadOutline /> Скачать файл
                    </button>
                </div>
            );
        }

        // 📊 Office-форматы (docx/xlsx/pptx) — только заглушка + скачать
        if (isOfficeOnly) return renderOfficePlaceholder();

        // 📕 PDF — iframe, без редактирования
        if (isPdf) {
            if (!blobUrl) return <div className={styles.center}>Загрузка PDF…</div>;
            return <iframe src={blobUrl} title={material.name} className={styles.frame} />;
        }

        // 📝 TXT / MD (просмотр) — iframe из blob
        if ((isTxt || isMd) && !isEditing) {
            if (!blobUrl) return <div className={styles.center}>Загрузка файла…</div>;
            return <iframe src={blobUrl} title={material.name} className={styles.frame} />;
        }

        // 🗒 Заметка (просмотр) — HTML напрямую
        if (isNote && !isEditing) {
            if (loadingMeta) return <div className={styles.center}>Загрузка…</div>;

            if (!hasTextContent) {
                return (
                    <div className={styles.center}>
                        <p className={styles.muted}>Заметка пуста</p>
                    </div>
                );
            }

            return (
                <div
                    className={`${styles.editorWrap} ${styles.proseView}`}
                    dangerouslySetInnerHTML={{ __html: fresh.text_content }}
                />
            );
        }

        // ✏️ Режим редактирования (только для note/txt/md)
        if (loadingMeta && isNote) return <div className={styles.center}>Загрузка…</div>;

        return (
            <div className={styles.editorBlock}>
                <div className={styles.toolbarWrap}>
                    <Toolbar editor={editor} />
                </div>
                <div className={`${styles.editorWrap} ${styles.editorEditable}`}>
                    <EditorArea
                        onEditorReady={setEditor}
                        initialContent=""
                        editable={true}
                    />
                </div>
            </div>
        );
    };

    // Кнопка "Редактировать" показывается только для note/txt/md
    const canEdit = typeConfig.canEdit && !error;

    return (
        <div
            className={styles.overlay}
            onMouseDown={(e) => { if (e.target === e.currentTarget) tryClose(); }}
        >
            <div className={styles.modal} role="dialog" aria-modal="true">
                <header className={styles.header}>
                    <div className={styles.title} title={material.name}>
                        {material.name}
                        {isDirty && <span className={styles.dirtyDot} title="Не сохранено" />}
                    </div>

                    <div className={styles.headerActions}>
                        {isFileSource && (
                            <button
                                className={styles.iconBtn}
                                onClick={handleDownloadOriginal}
                                disabled={!blobUrl}
                                title="Скачать оригинал"
                                type="button"
                            >
                                <IoDownloadOutline />
                            </button>
                        )}
                        <button
                            className={styles.iconBtn}
                            onClick={tryClose}
                            title="Закрыть (Esc)"
                            type="button"
                        >
                            <IoClose />
                        </button>
                    </div>
                </header>

                <div className={styles.body}>{renderBody()}</div>

                {/* Футер показываем только если есть что в нём показывать */}
                {(canEdit || isEditing) && (
                    <footer className={styles.footer}>
                        {canEdit && (
                            <button
                                className={styles.ghostBtn}
                                onClick={handleToggleEdit}
                                type="button"
                            >
                                {isEditing ? (
                                    <><IoEyeOutline /> Просмотр</>
                                ) : (
                                    <><IoPencilOutline /> Редактировать</>
                                )}
                            </button>
                        )}

                        <div className={styles.footerRight}>
                            {isEditing && (
                                <span className={styles.meta}>
                                    {saving ? 'Сохраняется…' : isDirty ? 'Не сохранено' : 'Сохранено'}
                                </span>
                            )}
                            {isEditing && (
                                <button
                                    className={styles.primaryBtn}
                                    onClick={handleSave}
                                    disabled={!isDirty || saving}
                                    type="button"
                                >
                                    <IoSaveOutline /> Сохранить
                                </button>
                            )}
                        </div>
                    </footer>
                )}
            </div>
        </div>
    );
}

/* Маленький helper для безопасной вставки сырого текста */
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
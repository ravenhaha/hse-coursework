import { useState, useCallback } from 'react';
import { TemplatesGrid } from '../TemplatesGrid/TemplatesGrid';
import { ColorPicker } from '../ColorPicker/ColorPicker';
import { useFonts } from '../../../../../hooks/useFonts';
import styles from './Toolbar.module.css';

export function Toolbar({ editor, onTemplate, onBack }) {
    const [showTemplates, setShowTemplates] = useState(false);
    const { fonts, loadFont, loadingFont } = useFonts();

    const handleTemplateSelect = useCallback((template) => {
        setShowTemplates(false);
        if (onTemplate) onTemplate(template);
    }, [onTemplate]);

    const handleFontChange = useCallback(async (e) => {
        if (!editor) return;
        const value = e.target.value;

        if (!value) {
            editor.chain().focus().unsetFontFamily().run();
            return;
        }

        const fontConfig = fonts.find(f => f.value === value);
        if (fontConfig) {
            await loadFont(fontConfig);
        }
        editor.chain().focus().setFontFamily(value).run();
    }, [editor, fonts, loadFont]);

    const handleHeadingChange = useCallback((e) => {
        if (!editor) return;
        const value = e.target.value;
        if (value === 'paragraph') {
            editor.chain().focus().setParagraph().run();
        } else {
            editor.chain().focus().toggleHeading({ level: Number(value) }).run();
        }
    }, [editor]);

    if (!editor) return null;

    const currentFont = editor.getAttributes('textStyle')?.fontFamily || '';

    const getHeadingValue = () => {
        for (let i = 1; i <= 4; i++) {
            if (editor.isActive('heading', { level: i })) return String(i);
        }
        return 'paragraph';
    };

    const btn = (action, isActive, icon, title, disabled = false) => (
        <button
            className={`${styles.btn} ${isActive ? styles.btnActive : ''} ${disabled ? styles.btnDisabled : ''}`}
            onClick={disabled ? undefined : action}
            title={title}
            disabled={disabled}
        >
            {icon}
        </button>
    );

    return (
        <div className={styles.toolbar}>
            {onBack && (
                <>
                    <div className={styles.group}>
                        <button className={styles.btn} onClick={onBack} title="Назад">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                                stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                <polyline points="15 18 9 12 15 6" />
                            </svg>
                        </button>
                    </div>
                    <span className={styles.sep} />
                </>
            )}

            <div className={styles.group}>
                {btn(
                    () => editor.chain().focus().undo().run(),
                    false,
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <polyline points="1 4 1 10 7 10" />
                        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                    </svg>,
                    'Отменить (Ctrl+Z)',
                    !editor.can().undo()
                )}
                {btn(
                    () => editor.chain().focus().redo().run(),
                    false,
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <polyline points="23 4 23 10 17 10" />
                        <path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10" />
                    </svg>,
                    'Повторить (Ctrl+Y)',
                    !editor.can().redo()
                )}
            </div>

            <span className={styles.sep} />

            <div className={styles.group}>
                <select
                    className={styles.select}
                    value={getHeadingValue()}
                    onChange={handleHeadingChange}
                >
                    <option value="paragraph">Текст</option>
                    <option value="1">H1</option>
                    <option value="2">H2</option>
                    <option value="3">H3</option>
                    <option value="4">H4</option>
                </select>

                <select
                    className={`${styles.select} ${loadingFont ? styles.selectLoading : ''}`}
                    value={currentFont}
                    onChange={handleFontChange}
                    disabled={!!loadingFont}
                >
                    {fonts.map(f => (
                        <option key={f.name} value={f.value}>
                            {f.name}{loadingFont === f.name ? ' ⏳' : ''}
                        </option>
                    ))}
                </select>
            </div>

            <span className={styles.sep} />

            <div className={styles.group}>
                {btn(
                    () => editor.chain().focus().toggleBold().run(),
                    editor.isActive('bold'),
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
                        <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
                    </svg>,
                    'Жирный (Ctrl+B)'
                )}
                {btn(
                    () => editor.chain().focus().toggleItalic().run(),
                    editor.isActive('italic'),
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <line x1="19" y1="4" x2="10" y2="4" />
                        <line x1="14" y1="20" x2="5" y2="20" />
                        <line x1="15" y1="4" x2="9" y2="20" />
                    </svg>,
                    'Курсив (Ctrl+I)'
                )}
                {btn(
                    () => editor.chain().focus().toggleUnderline().run(),
                    editor.isActive('underline'),
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3" />
                        <line x1="4" y1="21" x2="20" y2="21" />
                    </svg>,
                    'Подчёркнутый (Ctrl+U)'
                )}
                {btn(
                    () => editor.chain().focus().toggleStrike().run(),
                    editor.isActive('strike'),
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M16 4c-.5-1.5-2.5-3-5-3C8 1 5.5 3 5.5 5.5c0 2 1 3.5 3.5 4.5" />
                        <path d="M8 20c.5 1.5 2.5 3 5 3 3 0 5.5-2 5.5-4.5 0-2-1-3.5-3.5-4.5" />
                        <line x1="2" y1="12" x2="22" y2="12" />
                    </svg>,
                    'Зачёркнутый'
                )}

                <ColorPicker editor={editor} />

                {btn(
                    () => editor.chain().focus().toggleHighlight().run(),
                    editor.isActive('highlight'),
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>,
                    'Выделение'
                )}
            </div>

            <span className={styles.sep} />

            <div className={styles.group}>
                {btn(
                    () => editor.chain().focus().toggleBulletList().run(),
                    editor.isActive('bulletList'),
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <line x1="9" y1="6" x2="20" y2="6" />
                        <line x1="9" y1="12" x2="20" y2="12" />
                        <line x1="9" y1="18" x2="20" y2="18" />
                        <circle cx="4" cy="6" r="1.5" fill="currentColor" stroke="none" />
                        <circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none" />
                        <circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none" />
                    </svg>,
                    'Маркированный список'
                )}
                {btn(
                    () => editor.chain().focus().toggleOrderedList().run(),
                    editor.isActive('orderedList'),
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <line x1="10" y1="6" x2="21" y2="6" />
                        <line x1="10" y1="12" x2="21" y2="12" />
                        <line x1="10" y1="18" x2="21" y2="18" />
                        <text x="2" y="8" fontSize="8" fill="currentColor" stroke="none"
                            fontFamily="inherit" fontWeight="600">1</text>
                        <text x="2" y="14" fontSize="8" fill="currentColor" stroke="none"
                            fontFamily="inherit" fontWeight="600">2</text>
                        <text x="2" y="20" fontSize="8" fill="currentColor" stroke="none"
                            fontFamily="inherit" fontWeight="600">3</text>
                    </svg>,
                    'Нумерованный список'
                )}
                {btn(
                    () => editor.chain().focus().toggleTaskList().run(),
                    editor.isActive('taskList'),
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <rect x="3" y="5" width="6" height="6" rx="1" />
                        <line x1="13" y1="8" x2="21" y2="8" />
                        <path d="M4.5 14.5l2 2 3-3" />
                        <rect x="3" y="13" width="6" height="6" rx="1" />
                        <line x1="13" y1="16" x2="21" y2="16" />
                    </svg>,
                    'Чек-лист'
                )}
            </div>

            <span className={styles.sep} />

            <div className={styles.group}>
                {btn(
                    () => editor.chain().focus().toggleBlockquote().run(),
                    editor.isActive('blockquote'),
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21z" />
                        <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" />
                    </svg>,
                    'Цитата'
                )}
                {btn(
                    () => editor.chain().focus().toggleCodeBlock().run(),
                    editor.isActive('codeBlock'),
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <polyline points="16 18 22 12 16 6" />
                        <polyline points="8 6 2 12 8 18" />
                    </svg>,
                    'Блок кода'
                )}
                {btn(
                    () => editor.chain().focus().setHorizontalRule().run(),
                    false,
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <line x1="2" y1="12" x2="22" y2="12" />
                    </svg>,
                    'Разделитель'
                )}
            </div>

            <span className={styles.sep} />

            <div className={styles.group}>
                {['left', 'center', 'right'].map(align => (
                    <button
                        key={align}
                        className={`${styles.btn} ${editor.isActive({ textAlign: align }) ? styles.btnActive : ''}`}
                        onClick={() => editor.chain().focus().setTextAlign(align).run()}
                        title={`По ${align === 'left' ? 'левому краю' : align === 'center' ? 'центру' : 'правому краю'}`}
                    >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            {align === 'left' && (
                                <>
                                    <line x1="2" y1="6" x2="18" y2="6" />
                                    <line x1="2" y1="12" x2="14" y2="12" />
                                    <line x1="2" y1="18" x2="18" y2="18" />
                                </>
                            )}
                            {align === 'center' && (
                                <>
                                    <line x1="4" y1="6" x2="20" y2="6" />
                                    <line x1="6" y1="12" x2="18" y2="12" />
                                    <line x1="4" y1="18" x2="20" y2="18" />
                                </>
                            )}
                            {align === 'right' && (
                                <>
                                    <line x1="6" y1="6" x2="22" y2="6" />
                                    <line x1="10" y1="12" x2="22" y2="12" />
                                    <line x1="6" y1="18" x2="22" y2="18" />
                                </>
                            )}
                        </svg>
                    </button>
                ))}
            </div>

            <span className={styles.sep} />

            <div className={styles.templateWrapper}>
                <button
                    className={`${styles.btn} ${showTemplates ? styles.btnActive : ''}`}
                    onClick={() => setShowTemplates(!showTemplates)}
                    title="Шаблоны"
                >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <line x1="3" y1="9" x2="21" y2="9" />
                        <line x1="9" y1="21" x2="9" y2="9" />
                    </svg>
                </button>

                {showTemplates && (
                    <>
                        <div className={styles.templateOverlay} onClick={() => setShowTemplates(false)} />
                        <div className={styles.templatePopup}>
                            <TemplatesGrid onSelect={handleTemplateSelect} />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
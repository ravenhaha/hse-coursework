import { useCallback, useEffect, useState, useRef } from 'react';
import styles from './Toolbar.module.css';
import { useFonts } from '../../../../../hooks/useFonts';

/* ══════════════════════════════════════════════
   ДАННЫЕ
   ══════════════════════════════════════════════ */

const TEXT_COLORS = [
    { label: 'По умолчанию', value: null },
    { label: 'Красный',      value: '#ef4444' },
    { label: 'Оранжевый',    value: '#f97316' },
    { label: 'Жёлтый',       value: '#eab308' },
    { label: 'Зелёный',      value: '#22c55e' },
    { label: 'Бирюзовый',    value: '#14b8a6' },
    { label: 'Голубой',      value: '#3b82f6' },
    { label: 'Фиолетовый',   value: '#8b5cf6' },
    { label: 'Розовый',      value: '#ec4899' },
    { label: 'Белый',        value: '#ffffff' },
];

const HIGHLIGHT_COLORS = [
    { label: 'Без выделения', value: null },
    { label: 'Жёлтый',        value: '#fef08a' },
    { label: 'Зелёный',       value: '#bbf7d0' },
    { label: 'Бирюзовый',     value: '#99f6e4' },
    { label: 'Голубой',       value: '#bfdbfe' },
    { label: 'Фиолетовый',    value: '#ddd6fe' },
    { label: 'Розовый',       value: '#fecdd3' },
    { label: 'Оранжевый',     value: '#fed7aa' },
];

const TEMPLATES = [
    {
        id: 'meeting',
        label: '📋 Заметка о встрече',
        html: `
            <h2>Встреча</h2>
            <p><strong>Дата:</strong> </p>
            <p><strong>Участники:</strong> </p>
            <h3>Повестка</h3>
            <ul><li></li></ul>
            <h3>Решения</h3>
            <ul><li></li></ul>
            <h3>Задачи</h3>
            <ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div></div></li></ul>
        `,
    },
    {
        id: 'todo',
        label: '✅ Чек-лист',
        html: `
            <h2>Задачи на сегодня</h2>
            <ul data-type="taskList">
                <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p></p></div></li>
                <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p></p></div></li>
                <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p></p></div></li>
            </ul>
        `,
    },
    {
        id: 'article',
        label: '📝 Статья',
        html: `
            <h1>Заголовок</h1>
            <p><em>Краткое описание…</em></p>
            <h2>Введение</h2>
            <p></p>
            <h2>Основная часть</h2>
            <p></p>
            <h2>Заключение</h2>
            <p></p>
        `,
    },
    {
        id: 'code',
        label: '💻 Код + описание',
        html: `
            <h3>Задача</h3>
            <p></p>
            <h3>Решение</h3>
            <pre><code>// ваш код</code></pre>
            <h3>Примечания</h3>
            <ul><li></li></ul>
        `,
    },
];

/* ══════════════════════════════════════════════
   КНОПКИ
   ══════════════════════════════════════════════ */

const BUTTONS = [
    { id: 'bold',       title: 'Жирный (Ctrl+B)',       action: 'style', style: 'bold' },
    { id: 'italic',     title: 'Курсив (Ctrl+I)',       action: 'style', style: 'italic' },
    { id: 'underline',  title: 'Подчёркнутый (Ctrl+U)', action: 'style', style: 'underline' },
    { id: 'strike',     title: 'Зачёркнутый',           action: 'style', style: 'strike' },
    { id: 'code',       title: 'Код (инлайн)',          action: 'style', style: 'code' },
    { id: 'sep1', type: 'separator' },

    { id: 'h1', title: 'Заголовок 1', action: 'heading', level: 1 },
    { id: 'h2', title: 'Заголовок 2', action: 'heading', level: 2 },
    { id: 'h3', title: 'Заголовок 3', action: 'heading', level: 3 },
    { id: 'h4', title: 'Заголовок 4', action: 'heading', level: 4 },
    { id: 'sep2', type: 'separator' },

    { id: 'font',      title: 'Шрифт',      action: 'font-picker' },
    { id: 'textColor', title: 'Цвет текста', action: 'color-picker', pickerType: 'text' },
    { id: 'highlight', title: 'Выделение',   action: 'color-picker', pickerType: 'highlight' },
    { id: 'sep3', type: 'separator' },

    { id: 'alignLeft',    title: 'По левому краю',  action: 'align', alignment: 'left' },
    { id: 'alignCenter',  title: 'По центру',       action: 'align', alignment: 'center' },
    { id: 'alignRight',   title: 'По правому краю', action: 'align', alignment: 'right' },
    { id: 'alignJustify', title: 'По ширине',       action: 'align', alignment: 'justify' },
    { id: 'sep4', type: 'separator' },

    { id: 'bulletList',  title: 'Маркированный список', action: 'list', list: 'bulletList' },
    { id: 'orderedList', title: 'Нумерованный список',  action: 'list', list: 'orderedList' },
    { id: 'taskList',    title: 'Чек-лист',             action: 'list', list: 'taskList' },
    { id: 'sep5', type: 'separator' },

    { id: 'blockquote', title: 'Цитата',    action: 'block', block: 'blockquote' },
    { id: 'codeBlock',  title: 'Блок кода', action: 'block', block: 'codeBlock' },
    { id: 'link',       title: 'Ссылка',    action: 'link' },
    { id: 'sep6', type: 'separator' },

    { id: 'template',    title: 'Вставить шаблон', action: 'template-picker' },
    { id: 'hr',          title: 'Разделитель',     action: 'hr' },
    { id: 'clearFormat', title: 'Очистить формат', action: 'clear' },
];

/* ══════════════════════════════════════════════
   ИКОНКИ
   ══════════════════════════════════════════════ */

const ICONS = {
    bold: (
        <>
            <path d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z" />
            <path d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z" />
        </>
    ),
    italic: (
        <>
            <line x1="19" y1="4" x2="10" y2="4" />
            <line x1="14" y1="20" x2="5" y2="20" />
            <line x1="15" y1="4" x2="9" y2="20" />
        </>
    ),
    underline: (
        <>
            <path d="M6 4v6a6 6 0 006 6 6 6 0 006-6V4" />
            <line x1="4" y1="20" x2="20" y2="20" />
        </>
    ),
    strike: (
        <>
            <line x1="4" y1="12" x2="20" y2="12" />
            <path d="M17.3 4.9C16.2 4 14.7 3.5 13 3.5c-3 0-5.5 1.4-5.5 4 0 5 11 5 11 10 0 2.6-2.5 4-5.5 4-1.7 0-3.2-.5-4.3-1.4" />
        </>
    ),
    code: (
        <>
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
        </>
    ),
    h1: (
        <>
            <path d="M4 12h8M4 18V6M12 18V6" />
            <path d="M17 12l3-2v8" />
        </>
    ),
    h2: (
        <>
            <path d="M4 12h8M4 18V6M12 18V6" />
            <path d="M21 18h-4l4-6a2 2 0 10-3.464-2" />
        </>
    ),
    h3: (
        <>
            <path d="M4 12h8M4 18V6M12 18V6" />
            <path d="M17.5 10a2 2 0 011.5.7 2 2 0 010 2.6M17.5 18a2 2 0 001.5-.7 2 2 0 000-2.6" />
        </>
    ),
    h4: (
        <>
            <path d="M4 12h8M4 18V6M12 18V6" />
            <path d="M17 6v6h4M21 18v-6" />
        </>
    ),
    font: (
        <>
            <path d="M5 18L12 4l7 14" />
            <line x1="8" y1="14" x2="16" y2="14" />
            <polyline points="19 10 21 12 19 14" />
        </>
    ),
    textColor: (
        <>
            <path d="M6 18L12 4l6 14" />
            <line x1="8.5" y1="13" x2="15.5" y2="13" />
            <line x1="4" y1="21" x2="20" y2="21" strokeWidth="3" strokeLinecap="round" />
        </>
    ),
    highlight: (
        <>
            <path d="M15.5 4.5l4 4L8 20H4v-4L15.5 4.5z" />
            <line x1="13.5" y1="6.5" x2="17.5" y2="10.5" />
            <line x1="4" y1="22" x2="12" y2="22" strokeWidth="2.5" strokeLinecap="round" />
        </>
    ),
    alignLeft: (
        <>
            <line x1="3" y1="6"  x2="21" y2="6" />
            <line x1="3" y1="10" x2="15" y2="10" />
            <line x1="3" y1="14" x2="21" y2="14" />
            <line x1="3" y1="18" x2="15" y2="18" />
        </>
    ),
    alignCenter: (
        <>
            <line x1="3" y1="6"  x2="21" y2="6" />
            <line x1="6" y1="10" x2="18" y2="10" />
            <line x1="3" y1="14" x2="21" y2="14" />
            <line x1="6" y1="18" x2="18" y2="18" />
        </>
    ),
    alignRight: (
        <>
            <line x1="3" y1="6"  x2="21" y2="6" />
            <line x1="9" y1="10" x2="21" y2="10" />
            <line x1="3" y1="14" x2="21" y2="14" />
            <line x1="9" y1="18" x2="21" y2="18" />
        </>
    ),
    alignJustify: (
        <>
            <line x1="3" y1="6"  x2="21" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
            <line x1="3" y1="14" x2="21" y2="14" />
            <line x1="3" y1="18" x2="21" y2="18" />
        </>
    ),
    bulletList: (
        <>
            <line x1="9" y1="6"  x2="20" y2="6" />
            <line x1="9" y1="12" x2="20" y2="12" />
            <line x1="9" y1="18" x2="20" y2="18" />
            <circle cx="5" cy="6"  r="1.5" fill="currentColor" />
            <circle cx="5" cy="12" r="1.5" fill="currentColor" />
            <circle cx="5" cy="18" r="1.5" fill="currentColor" />
        </>
    ),
    orderedList: (
        <>
            <line x1="10" y1="6"  x2="21" y2="6" />
            <line x1="10" y1="12" x2="21" y2="12" />
            <line x1="10" y1="18" x2="21" y2="18" />
            <text x="3" y="8"  fontSize="7" fill="currentColor">1</text>
            <text x="3" y="14" fontSize="7" fill="currentColor">2</text>
            <text x="3" y="20" fontSize="7" fill="currentColor">3</text>
        </>
    ),
    taskList: (
        <>
            <rect x="3" y="3"  width="7" height="7" rx="1.5" />
            <polyline points="5 7 6.5 8.5 9.5 4.5" />
            <line x1="13" y1="6.5" x2="21" y2="6.5" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" />
            <line x1="13" y1="17.5" x2="21" y2="17.5" />
        </>
    ),
    blockquote: (
        <>
            <path d="M3 6h18M3 12h18M3 18h12" />
            <rect x="1" y="4" width="2" height="16" rx="1" fill="currentColor" />
        </>
    ),
    codeBlock: (
        <>
            <rect x="2" y="3" width="20" height="18" rx="3" />
            <polyline points="8 9 5 12 8 15" />
            <polyline points="16 9 19 12 16 15" />
            <line x1="13" y1="7" x2="11" y2="17" />
        </>
    ),
    link: (
        <>
            <path d="M10 13a5 5 0 007.5.5l2-2a5 5 0 00-7-7l-1.5 1.5" />
            <path d="M14 11a5 5 0 00-7.5-.5l-2 2a5 5 0 007 7l1.5-1.5" />
        </>
    ),
    template: (
        <>
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <line x1="7" y1="8"  x2="17" y2="8" />
            <line x1="7" y1="12" x2="14" y2="12" />
            <line x1="7" y1="16" x2="11" y2="16" />
        </>
    ),
    hr: (
        <>
            <line x1="2" y1="12" x2="22" y2="12" />
        </>
    ),
    clearFormat: (
        <>
            <path d="M4 7V4h16v3" />
            <path d="M9 20h6" />
            <path d="M12 4v16" />
            <line x1="18" y1="4" x2="4" y2="20" strokeWidth="2" />
        </>
    ),
};

/* ══════════════════════════════════════════════
   ВСПОМОГАТЕЛЬНЫЕ КОМПОНЕНТЫ
   ══════════════════════════════════════════════ */

function Icon({ name }) {
    const paths = ICONS[name];
    if (!paths) return null;
    return (
        <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            {paths}
        </svg>
    );
}

function Dropdown({ onClose, children }) {
    const dropRef = useRef(null);

    useEffect(() => {
        function handleClick(e) {
            if (dropRef.current && dropRef.current.contains(e.target)) return;
            if (e.target.closest(`.${styles.btn}`)) return;
            onClose();
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [onClose]);

    return (
        <div ref={dropRef} className={styles.dropdown}>
            {children}
        </div>
    );
}

function ColorPicker({ colors, activeColor, onPick, onClose }) {
    return (
        <Dropdown onClose={onClose}>
            <div className={styles.colorGrid}>
                {colors.map((c) => {
                    const isActive = c.value === activeColor || (!c.value && !activeColor);
                    return (
                        <button
                            key={c.label}
                            className={`${styles.colorSwatch} ${isActive ? styles.colorSwatchActive : ''}`}
                            style={{
                                background: c.value || 'transparent',
                                border: !c.value ? '2px dashed #3d6a7e' : undefined,
                            }}
                            title={c.label}
                            type="button"
                            onMouseDown={(e) => {
                                e.preventDefault();
                                onPick(c.value);
                                onClose();
                            }}
                        />
                    );
                })}
            </div>
        </Dropdown>
    );
}

function FontPicker({ activeFont, onPick, onClose }) {
    const { fonts, loadFont, loadingFont, isLoaded } = useFonts();

    const handleClick = async (font) => {
        if (!font.value) {
            onPick(null);
            onClose();
            return;
        }

        const ok = await loadFont(font);
        if (ok) {
            onPick(font.value);
            onClose();
        }
    };

    return (
        <Dropdown onClose={onClose}>
            <div className={styles.fontList}>
                {fonts.map((f) => {
                    const isActive =
                        f.value === activeFont || (!f.value && !activeFont);
                    const loading = loadingFont === f.name;
                    const loaded = isLoaded(f.name);

                    return (
                        <button
                            key={f.name}
                            className={`${styles.fontItem} ${isActive ? styles.fontItemActive : ''}`}
                            style={{ fontFamily: loaded ? (f.value || 'inherit') : 'inherit' }}
                            type="button"
                            disabled={loading}
                            onMouseDown={(e) => {
                                e.preventDefault();
                                handleClick(f);
                            }}
                        >
                            <span>{f.name}</span>
                            {loading && <span className={styles.fontLoader}>…</span>}
                        </button>
                    );
                })}
            </div>
        </Dropdown>
    );
}

function TemplatePicker({ onPick, onClose }) {
    return (
        <Dropdown onClose={onClose}>
            <div className={styles.templateList}>
                {TEMPLATES.map((t) => (
                    <button
                        key={t.id}
                        className={styles.templateItem}
                        type="button"
                        onMouseDown={(e) => {
                            e.preventDefault();
                            onPick(t.html);
                            onClose();
                        }}
                    >
                        {t.label}
                    </button>
                ))}
            </div>
        </Dropdown>
    );
}

/* ══════════════════════════════════════════════
   ТУЛБАР
   ══════════════════════════════════════════════ */

export default function Toolbar({ editor }) {
    const [, forceRender] = useState(0);
    const [openPicker, setOpenPicker] = useState(null);

    useEffect(() => {
        if (!editor) return;
        const onUpdate = () => forceRender((n) => n + 1);
        editor.on('transaction', onUpdate);
        return () => editor.off('transaction', onUpdate);
    }, [editor]);

    const getActiveColor = useCallback(
        () => (editor ? editor.getAttributes('textStyle')?.color || null : null),
        [editor],
    );
    const getActiveHighlight = useCallback(
        () => (editor ? editor.getAttributes('highlight')?.color || null : null),
        [editor],
    );
    const getActiveFont = useCallback(
        () => (editor ? editor.getAttributes('textStyle')?.fontFamily || null : null),
        [editor],
    );

    const isActive = useCallback(
        (btn) => {
            if (!editor) return false;
            if (btn.action === 'style')   return editor.isActive(btn.style);
            if (btn.action === 'heading') return editor.isActive('heading', { level: btn.level });
            if (btn.action === 'align')   return editor.isActive({ textAlign: btn.alignment });
            if (btn.action === 'list')    return editor.isActive(btn.list);
            if (btn.action === 'block')   return editor.isActive(btn.block);
            return false;
        },
        [editor],
    );

    const handleClick = useCallback(
        (btn) => {
            if (!editor) return;
            const chain = editor.chain().focus();

            switch (btn.action) {
                case 'style':
                    chain[`toggle${btn.style[0].toUpperCase()}${btn.style.slice(1)}`]().run();
                    break;
                case 'heading':
                    chain.toggleHeading({ level: btn.level }).run();
                    break;
                case 'align':
                    chain.setTextAlign(btn.alignment).run();
                    break;
                case 'list':
                    if (btn.list === 'bulletList')  chain.toggleBulletList().run();
                    if (btn.list === 'orderedList') chain.toggleOrderedList().run();
                    if (btn.list === 'taskList')    chain.toggleTaskList().run();
                    break;
                case 'block':
                    if (btn.block === 'blockquote') chain.toggleBlockquote().run();
                    if (btn.block === 'codeBlock')  chain.toggleCodeBlock().run();
                    break;
                case 'link': {
                    if (editor.isActive('link')) {
                        chain.unsetLink().run();
                    } else {
                        const url = window.prompt('URL ссылки:');
                        if (url) chain.setLink({ href: url }).run();
                    }
                    break;
                }
                case 'hr':
                    chain.setHorizontalRule().run();
                    break;
                case 'clear':
                    chain.unsetAllMarks().clearNodes().run();
                    break;
                case 'color-picker':
                    setOpenPicker((prev) => (prev === btn.pickerType ? null : btn.pickerType));
                    return;
                case 'font-picker':
                    setOpenPicker((prev) => (prev === 'font' ? null : 'font'));
                    return;
                case 'template-picker':
                    setOpenPicker((prev) => (prev === 'template' ? null : 'template'));
                    return;
                default:
                    break;
            }
            setOpenPicker(null);
        },
        [editor],
    );

    const applyTextColor = useCallback(
        (color) => {
            if (!editor) return;
            if (color) editor.chain().focus().setColor(color).run();
            else       editor.chain().focus().unsetColor().run();
        },
        [editor],
    );

    const applyHighlight = useCallback(
        (color) => {
            if (!editor) return;
            if (color) editor.chain().focus().setHighlight({ color }).run();
            else       editor.chain().focus().unsetHighlight().run();
        },
        [editor],
    );

    const applyFont = useCallback(
        (fontFamily) => {
            if (!editor) return;
            if (fontFamily) editor.chain().focus().setFontFamily(fontFamily).run();
            else            editor.chain().focus().unsetFontFamily().run();
        },
        [editor],
    );

    const applyTemplate = useCallback(
        (html) => {
            if (!editor) return;
            editor.commands.setContent(html.trim());
            editor.commands.focus('end');
        },
        [editor],
    );

    const closePicker = useCallback(() => setOpenPicker(null), []);

    return (
        <div className={styles.toolbar}>
            <div className={styles.toolbarInner}>
                {BUTTONS.map((btn) => {
                    if (btn.type === 'separator') {
                        return <div key={btn.id} className={styles.separator} />;
                    }

                    const active = isActive(btn);

                    return (
                        <div key={btn.id} className={styles.btnWrap}>
                            <button
                                className={`${styles.btn} ${active ? styles.btnActive : ''}`}
                                title={btn.title}
                                type="button"
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    handleClick(btn);
                                }}
                            >
                                <Icon name={btn.id} />

                                {btn.id === 'textColor' && (
                                    <span
                                        className={styles.colorIndicator}
                                        style={{ background: getActiveColor() || '#e9f7ff' }}
                                    />
                                )}
                                {btn.id === 'highlight' && (
                                    <span
                                        className={styles.colorIndicator}
                                        style={{ background: getActiveHighlight() || 'transparent' }}
                                    />
                                )}
                            </button>

                            {btn.action === 'color-picker' && btn.pickerType === 'text' && openPicker === 'text' && (
                                <ColorPicker
                                    colors={TEXT_COLORS}
                                    activeColor={getActiveColor()}
                                    onPick={applyTextColor}
                                    onClose={closePicker}
                                />
                            )}

                            {btn.action === 'color-picker' && btn.pickerType === 'highlight' && openPicker === 'highlight' && (
                                <ColorPicker
                                    colors={HIGHLIGHT_COLORS}
                                    activeColor={getActiveHighlight()}
                                    onPick={applyHighlight}
                                    onClose={closePicker}
                                />
                            )}

                            {btn.action === 'font-picker' && openPicker === 'font' && (
                                <FontPicker
                                    activeFont={getActiveFont()}
                                    onPick={applyFont}
                                    onClose={closePicker}
                                />
                            )}

                            {btn.action === 'template-picker' && openPicker === 'template' && (
                                <TemplatePicker
                                    onPick={applyTemplate}
                                    onClose={closePicker}
                                />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
import { useState, useRef, useEffect } from 'react';
import { FontSelect } from './FontSelect';
import { COLORS } from './colors';
import styles from './Toolbar.module.css';

export function Toolbar({ editor }) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [, forceUpdate] = useState(0);
  const colorRef = useRef(null);

  // Подписка на изменения редактора — чтобы кнопки undo/redo обновлялись
  useEffect(() => {
    if (!editor) return;

    const update = () => forceUpdate(n => n + 1);

    editor.on('transaction', update);
    return () => editor.off('transaction', update);
  }, [editor]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (colorRef.current && !colorRef.current.contains(e.target)) {
        setShowColorPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!editor) return null;

  const setColor = (color) => {
    editor.chain().focus().setColor(color).run();
    setShowColorPicker(false);
  };

  const addLink = () => {
    if (editor.isActive('link')) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const url = prompt('Вставьте URL:');
    if (url) editor.chain().focus().setLink({ href: url }).run();
  };

  const addImage = () => {
    const url = prompt('Вставьте ссылку на картинку:');
    if (url) editor.chain().focus().setImage({ src: url }).run();
  };

  const addTable = () => {
    editor
      .chain()
      .focus()
      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
      .run();
  };

  const currentColor = editor.getAttributes('textStyle').color || '#FFFFFF';

  const canUndo = editor.can().undo();
  const canRedo = editor.can().redo();

  return (
    <div className={styles.toolbar}>

      {/* ─── Строка 1 ─── */}
      <div className={styles.row}>

        <FontSelect editor={editor} />

        <span className={styles.divider} />

        {/* Форматирование */}
        <span className={styles.group}>
          <button
            className={`${styles.btn} ${editor.isActive('bold') ? styles.active : ''}`}
            onClick={() => editor.chain().focus().toggleBold().run()}
            title="Жирный (Ctrl+B)"
          >
            <strong>B</strong>
          </button>
          <button
            className={`${styles.btn} ${editor.isActive('italic') ? styles.active : ''}`}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            title="Курсив (Ctrl+I)"
          >
            <em>I</em>
          </button>
          <button
            className={`${styles.btn} ${editor.isActive('underline') ? styles.active : ''}`}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            title="Подчёркнутый (Ctrl+U)"
          >
            <span style={{ textDecoration: 'underline' }}>U</span>
          </button>
          <button
            className={`${styles.btn} ${editor.isActive('strike') ? styles.active : ''}`}
            onClick={() => editor.chain().focus().toggleStrike().run()}
            title="Зачёркнутый"
          >
            <s>S</s>
          </button>
        </span>

        <span className={styles.divider} />

        {/* Цвет и маркер */}
        <span className={styles.group} ref={colorRef} style={{ position: 'relative' }}>
          <button
            className={`${styles.btn} ${editor.isActive('highlight') ? styles.active : ''}`}
            onClick={() => editor.chain().focus().toggleHighlight().run()}
            title="Маркер"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </button>

          <button
            className={styles.btn}
            onClick={() => setShowColorPicker(!showColorPicker)}
            title="Цвет текста"
          >
            <span className={styles.colorIndicator}>
              <span style={{ background: currentColor }} className={styles.colorDot} />
              A
            </span>
          </button>

          {showColorPicker && (
            <div className={styles.colorPicker}>
              {COLORS.map(color => (
                <button
                  key={color}
                  className={styles.colorSwatch}
                  style={{ background: color }}
                  onClick={() => setColor(color)}
                  title={color}
                />
              ))}
            </div>
          )}

          <button
            className={styles.btn}
            onClick={() => editor.chain().focus().unsetAllMarks().run()}
            title="Очистить форматирование"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </span>

        <span className={styles.divider} />

        {/* Индексы */}
        <span className={styles.group}>
          <button
            className={`${styles.btn} ${editor.isActive('superscript') ? styles.active : ''}`}
            onClick={() => editor.chain().focus().toggleSuperscript().run()}
            title="Верхний индекс"
          >
            X<sup>²</sup>
          </button>
          <button
            className={`${styles.btn} ${editor.isActive('subscript') ? styles.active : ''}`}
            onClick={() => editor.chain().focus().toggleSubscript().run()}
            title="Нижний индекс"
          >
            X<sub>₂</sub>
          </button>
        </span>

        <span className={styles.divider} />

        {/* Заголовки */}
        <span className={styles.group}>
          {[1, 2, 3, 4].map(level => (
            <button
              key={level}
              className={`${styles.btn} ${editor.isActive('heading', { level }) ? styles.active : ''}`}
              onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
              title={`Заголовок ${level}`}
            >
              H{level}
            </button>
          ))}
          <button
            className={`${styles.btn} ${editor.isActive('paragraph') ? styles.active : ''}`}
            onClick={() => editor.chain().focus().setParagraph().run()}
            title="Обычный текст"
          >
            ¶
          </button>
        </span>
      </div>

      {/* ─── Строка 2 ─── */}
      <div className={styles.row}>

        {/* Выравнивание */}
        <span className={styles.group}>
          {[
            { align: 'left', lines: [['3','21'],['3','15'],['3','18']] },
            { align: 'center', lines: [['3','21'],['6','18'],['4','20']] },
            { align: 'right', lines: [['3','21'],['9','21'],['6','21']] },
            { align: 'justify', lines: [['3','21'],['3','21'],['3','21']] },
          ].map(({ align, lines }) => (
            <button
              key={align}
              className={`${styles.btn} ${editor.isActive({ textAlign: align }) ? styles.active : ''}`}
              onClick={() => editor.chain().focus().setTextAlign(align).run()}
              title={align === 'left' ? 'По левому краю' : align === 'center' ? 'По центру' : align === 'right' ? 'По правому краю' : 'По ширине'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1={lines[0][0]} y1="6" x2={lines[0][1]} y2="6" />
                <line x1={lines[1][0]} y1="12" x2={lines[1][1]} y2="12" />
                <line x1={lines[2][0]} y1="18" x2={lines[2][1]} y2="18" />
              </svg>
            </button>
          ))}
        </span>

        <span className={styles.divider} />

        {/* Списки */}
        <span className={styles.group}>
          <button
            className={`${styles.btn} ${editor.isActive('bulletList') ? styles.active : ''}`}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            title="Маркированный список"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="4" cy="6" r="1.5" fill="currentColor" stroke="none" />
              <circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none" />
              <circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none" />
              <line x1="9" y1="6" x2="21" y2="6" />
              <line x1="9" y1="12" x2="21" y2="12" />
              <line x1="9" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <button
            className={`${styles.btn} ${editor.isActive('orderedList') ? styles.active : ''}`}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            title="Нумерованный список"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
              <text x="2" y="8" style={{ fontSize: '8px', fontFamily: 'Arial, sans-serif', fontWeight: 'bold' }}>1.</text>
              <text x="2" y="15" style={{ fontSize: '8px', fontFamily: 'Arial, sans-serif', fontWeight: 'bold' }}>2.</text>
              <text x="2" y="22" style={{ fontSize: '8px', fontFamily: 'Arial, sans-serif', fontWeight: 'bold' }}>3.</text>
              <rect x="11" y="5" width="10" height="1.5" rx="0.75" />
              <rect x="11" y="12" width="10" height="1.5" rx="0.75" />
              <rect x="11" y="19" width="10" height="1.5" rx="0.75" />
            </svg>
          </button>

          <button
            className={`${styles.btn} ${editor.isActive('taskList') ? styles.active : ''}`}
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            title="Чек-лист"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="6" height="6" rx="1" />
              <path d="M5 6l1 1 2.5-2.5" />
              <line x1="13" y1="6" x2="21" y2="6" />
              <rect x="3" y="14" width="6" height="6" rx="1" />
              <line x1="13" y1="17" x2="21" y2="17" />
            </svg>
          </button>
        </span>

        <span className={styles.divider} />

        {/* Блоки */}
        <span className={styles.group}>
          <button
            className={`${styles.btn} ${editor.isActive('blockquote') ? styles.active : ''}`}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            title="Цитата"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="3" y1="4" x2="3" y2="20" />
              <line x1="8" y1="8" x2="20" y2="8" />
              <line x1="8" y1="12" x2="17" y2="12" />
              <line x1="8" y1="16" x2="14" y2="16" />
            </svg>
          </button>
          <button
            className={`${styles.btn} ${editor.isActive('codeBlock') ? styles.active : ''}`}
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            title="Блок кода"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
          </button>
          <button
            className={`${styles.btn} ${editor.isActive('code') ? styles.active : ''}`}
            onClick={() => editor.chain().focus().toggleCode().run()}
            title="Инлайн код"
          >
            <code style={{ fontSize: '11px' }}>{'{}'}</code>
          </button>
        </span>

        <span className={styles.divider} />

        {/* Вставки */}
        <span className={styles.group}>
          <button
            className={`${styles.btn} ${editor.isActive('link') ? styles.active : ''}`}
            onClick={addLink}
            title="Ссылка"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
            </svg>
          </button>
          <button className={styles.btn} onClick={addImage} title="Картинка">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
          </button>
          <button className={styles.btn} onClick={addTable} title="Таблица">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="3" y1="15" x2="21" y2="15" />
              <line x1="9" y1="3" x2="9" y2="21" />
              <line x1="15" y1="3" x2="15" y2="21" />
            </svg>
          </button>
          <button
            className={styles.btn}
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            title="Разделитель"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="12" x2="21" y2="12" />
            </svg>
          </button>
        </span>

        <span className={styles.divider} />

        {/* Отмена / Повтор */}
        <span className={styles.group}>
          <button
            className={`${styles.btn} ${!canUndo ? styles.disabled : ''}`}
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!canUndo}
            title="Отменить (Ctrl+Z)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 105.64-11.36L1 10" />
            </svg>
          </button>
          <button
            className={`${styles.btn} ${!canRedo ? styles.disabled : ''}`}
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!canRedo}
            title="Повторить (Ctrl+Shift+Z)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 11-5.64-11.36L23 10" />
            </svg>
          </button>
        </span>
      </div>
    </div>
  );
}
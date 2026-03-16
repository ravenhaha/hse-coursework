import { ToolbarButton as Btn } from './ToolbarButton';
import { ToolbarDivider as Div } from './ToolbarDivider';
import styles from './Toolbar.module.css';

export function Toolbar({ editor }) {
    if (!editor) return null;

    const addImage = () => {
        const url = prompt('Вставьте ссылку на картинку:');
        if (url) editor.chain().focus().setImage({ src: url }).run();
    };

    const addLink = () => {
        const url = prompt('Вставьте URL:');
        if (url) editor.chain().focus().setLink({ href: url }).run();
    };

    const addTable = () => {
        editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    };

    return (
        <div className={styles.toolbar}>
            <Btn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Жирный">B</Btn>
            <Btn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Курсив">I</Btn>
            <Btn active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Подчёркнутый">U</Btn>
            <Btn active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} title="Зачёркнутый">S</Btn>
            <Btn active={editor.isActive('highlight')} onClick={() => editor.chain().focus().toggleHighlight().run()} title="Маркер">🖍</Btn>

            <Div />

            <Btn active={editor.isActive('superscript')} onClick={() => editor.chain().focus().toggleSuperscript().run()} title="Верхний индекс">X²</Btn>
            <Btn active={editor.isActive('subscript')} onClick={() => editor.chain().focus().toggleSubscript().run()} title="Нижний индекс">X₂</Btn>

            <Div />

            <Btn active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="Заголовок 1">H1</Btn>
            <Btn active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Заголовок 2">H2</Btn>
            <Btn active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Заголовок 3">H3</Btn>

            <Div />

            <Btn active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()} title="По левому краю">≡</Btn>
            <Btn active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()} title="По центру">⊡</Btn>
            <Btn active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()} title="По правому краю">≡ˌ</Btn>

            <Div />

            <Btn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Маркированный список">•</Btn>
            <Btn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Нумерованный список">1.</Btn>
            <Btn active={editor.isActive('taskList')} onClick={() => editor.chain().focus().toggleTaskList().run()} title="Чек-лист">☑</Btn>

            <Div />

            <Btn active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Цитата">«»</Btn>
            <Btn active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()} title="Блок кода">{'</>'}</Btn>
            <Btn active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()} title="Инлайн код">`</Btn>

            <Div />

            <Btn active={editor.isActive('link')} onClick={addLink} title="Ссылка">🔗</Btn>
            <Btn onClick={addImage} title="Картинка">🖼</Btn>
            <Btn onClick={addTable} title="Таблица">📊</Btn>
            <Btn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Разделитель">—</Btn>

            <Div />

            <Btn onClick={() => editor.chain().focus().undo().run()} title="Отменить">↩</Btn>
            <Btn onClick={() => editor.chain().focus().redo().run()} title="Повторить">↪</Btn>
        </div>
    );
}
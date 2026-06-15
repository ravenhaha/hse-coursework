import { StarterKit } from '@tiptap/starter-kit';
import { Placeholder } from '@tiptap/extension-placeholder';
import { Underline } from '@tiptap/extension-underline';
import { Link } from '@tiptap/extension-link';
import { TextAlign } from '@tiptap/extension-text-align';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Highlight } from '@tiptap/extension-highlight';

export const editorExtensions = [
    StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
        bulletList: {
            HTMLAttributes: { class: 'tiptap-bullet-list' },
            keepMarks: true,
        },
        orderedList: {
            HTMLAttributes: { class: 'tiptap-ordered-list' },
            keepMarks: true,
        },
        // ❗ Отключаем встроенные, чтобы подключить свои с конфигом
        link: false,
        underline: false,
    }),

    Underline,

    Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
            rel: 'noopener noreferrer',
            target: '_blank',
        },
    }),

    TextAlign.configure({
        types: ['heading', 'paragraph'],
        alignments: ['left', 'center', 'right', 'justify'],
        defaultAlignment: 'left',
    }),

    TaskList,
    TaskItem.configure({ nested: true }),

    TextStyle,
    Color.configure({ types: ['textStyle'] }),

    Highlight.configure({ multicolor: false }),

    Placeholder.configure({
        placeholder: 'Начните писать…',
        emptyEditorClass: 'is-editor-empty',
    }),
];
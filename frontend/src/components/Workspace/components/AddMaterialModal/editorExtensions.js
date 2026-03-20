import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import Color from '@tiptap/extension-color';
import Link from '@tiptap/extension-link';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import Typography from '@tiptap/extension-typography';
import { TextStyle } from '@tiptap/extension-text-style';
import { FontFamily } from '@tiptap/extension-font-family';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';

export const editorExtensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3, 4] },
    // Отключаем встроенный Link — подключим свой с настройками
    link: false,
  }),

  // Отдельные расширения
  Underline,
  Link.configure({
    openOnClick: false,
    HTMLAttributes: {
      rel: 'noopener noreferrer',
      target: '_blank',
    },
  }),

  Placeholder.configure({
    placeholder: 'Начните писать или вставьте текст...',
  }),
  Image.configure({
    inline: true,
    allowBase64: true,
  }),

  // Стили текста
  TextStyle,
  Color,
  FontFamily,
  Highlight.configure({ multicolor: true }),

  TextAlign.configure({
    types: ['heading', 'paragraph'],
    alignments: ['left', 'center', 'right', 'justify'],
  }),

  Subscript,
  Superscript,

  // Списки
  TaskList,
  TaskItem.configure({ nested: true }),

  // Таблицы
  Table.configure({
    resizable: true,
    HTMLAttributes: { class: 'editor-table' },
  }),
  TableRow,
  TableCell,
  TableHeader,

  Typography,
];
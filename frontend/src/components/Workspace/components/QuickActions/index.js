import {
  IoCreateOutline,
  IoCloudUploadOutline,
  IoFolderOpenOutline,   // 🆕
} from 'react-icons/io5';

const cards = [
  {
    id: 'note',
    Icon: IoCreateOutline,
    title: 'Создать заметку',
    text: 'Запишите идею или мысль прямо сейчас',
    handler: 'onCreateNote',
    color: '#FF9F43',
  },
  {
    id: 'file',
    Icon: IoCloudUploadOutline,
    title: 'Загрузить файл',
    text: 'PDF, Word, картинка или любой документ',
    handler: 'onImportFile',
    color: '#9B7CF5',
  },
];

export default cards;
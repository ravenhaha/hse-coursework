import {
    IoAttachOutline,
    IoDocumentTextOutline,
    IoFolderOpenOutline,
} from 'react-icons/io5';

const cards = [
    {
        id: 'collection',
        Icon: IoFolderOpenOutline,
        color: '#b890ff',
        title: 'Создать коллекцию',
        text: 'Сгруппируйте материалы по теме',
        handler: 'onCreateCollection',
    },
    {
        id: 'import',
        Icon: IoAttachOutline,
        color: '#3AD7D3',
        title: 'Импортировать файл',
        text: 'PDF, DOCX, TXT, MD или картинка',
        handler: 'onImportFile',
    },
    {
        id: 'note',
        Icon: IoDocumentTextOutline,
        color: '#6bb6d6',
        title: 'Создать заметку',
        text: 'Напишите текст прямо в редакторе',
        handler: 'onCreateNote',
    },
];

export default cards;
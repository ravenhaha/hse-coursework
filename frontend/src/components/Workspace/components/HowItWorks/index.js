import {
    IoCloudUploadOutline,
    IoFolderOpenOutline,
    IoBulbOutline,
} from 'react-icons/io5';

const cards = [
    {
        id: 1,
        number: 1,
        Icon: IoCloudUploadOutline,
        color: '#3AD7D3',
        title: 'Загрузите материал',
        text:
            'Перетащите файл прямо в сайдбар, нажмите «+» рядом с разделом ' +
            'или вставьте текст. Поддерживаются PDF, DOCX, TXT, MD и изображения.',
    },
    {
        id: 2,
        number: 2,
        Icon: IoFolderOpenOutline,
        color: '#6bb6d6',
        title: 'Организуйте',
        text:
            'Группируйте материалы в коллекции и подколлекции. Кликните правой ' +
            'кнопкой по любому элементу — переименовать, удалить или добавить ' +
            'вложенную коллекцию.',
    },
    {
        id: 3,
        number: 3,
        Icon: IoBulbOutline,
        color: '#b890ff',
        title: 'Возвращайтесь к знаниям',
        text:
            'Открывайте материалы в один клик, редактируйте заметки, ' +
            'отмечайте важное и фильтруйте по дате или типу в разделе ' +
            '«Все материалы».',
    },
];

export default cards;
import {
  IoCloudUploadOutline,
  IoSparklesOutline,
  IoGitNetworkOutline,
} from 'react-icons/io5';

const cards = [
  {
    id: 'upload',
    number: '01',
    Icon: IoCloudUploadOutline,
    color: '#3AD7D3',                 // 🔵 бирюза — загрузка/действие
    title: 'Загружайте материалы',
    text: 'Документы, статьи, заметки — всё в одном месте. PDF, текст, ссылки.',
  },
  {
    id: 'organize',
    number: '02',
    Icon: IoSparklesOutline,
    color: '#A78BFA',                 // 🟣 лаванда — структурирование
    title: 'Структурируйте идеи',
    text: 'Создавайте коллекции, делайте заметки, выделяйте ключевые мысли.',
  },
  {
    id: 'connect',
    number: '03',
    Icon: IoGitNetworkOutline,
    color: '#FB923C',                 // 🍑 персик — связи/творчество
    title: 'Стройте связи',
    text: 'Граф знаний покажет как материалы переплетаются между собой.',
  },
];

export default cards;
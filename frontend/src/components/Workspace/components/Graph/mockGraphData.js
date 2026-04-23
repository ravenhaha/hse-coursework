// Мок-дерево для демонстрации графа.
// Структура узла: { id, name, type: 'folder' | 'document', tags?, content?, children? }
// Для кастомизации — добавляй поля сюда и отображай их в NodePreviewModal.
export const mockGraphData = {
    id: 'root',
    name: 'Мои материалы',
    type: 'folder',
    children: [
        {
            id: 'projects',
            name: 'Проекты',
            type: 'folder',
            children: [
                {
                    id: 'web-design-2025',
                    name: 'Веб-дизайн 2025',
                    type: 'folder',
                    children: [
                        {
                            id: 'moodboard',
                            name: 'Мудборд',
                            type: 'document',
                            tags: ['дизайн', 'референсы'],
                            content:
                                'Собрали 40+ референсов в стиле Bento UI — глубокий синий, акценты бирюзы, минималистичная типографика. Основные источники: Dribbble, Awwwards, Cosmos.',
                        },
                        {
                            id: 'design-system',
                            name: 'Дизайн-система',
                            type: 'document',
                            tags: ['UI', 'системность'],
                            content:
                                'Токены цвета и типографики, базовые компоненты: кнопки, модалки, карточки. Все измерения идут через 4px-grid.',
                        },
                        {
                            id: 'prototypes',
                            name: 'Прототипы',
                            type: 'folder',
                            children: [
                                {
                                    id: 'landing-v1',
                                    name: 'Лендинг v1',
                                    type: 'document',
                                    tags: ['figma'],
                                    content: 'Первая версия лендинга — hero, how it works, CTA. Без анимаций.',
                                },
                                {
                                    id: 'landing-v2',
                                    name: 'Лендинг v2',
                                    type: 'document',
                                    tags: ['figma', 'утверждено'],
                                    content: 'Вторая версия с vortex-эффектом в hero и частицами. Принято командой.',
                                },
                                {
                                    id: 'header-concept',
                                    name: 'Концепт хедера',
                                    type: 'document',
                                    tags: ['figma'],
                                    content: 'Прозрачный хедер с бирюзовым свечением логотипа.',
                                },
                                {
                                    id: 'mobile-version',
                                    name: 'Мобильная версия',
                                    type: 'document',
                                    tags: ['figma', 'mobile'],
                                    content: 'Адаптив под 360/390/430. Сложное меню ушло в bottom sheet.',
                                },
                            ],
                        },
                        {
                            id: 'typography',
                            name: 'Типографика',
                            type: 'document',
                            tags: ['дизайн'],
                            content: 'Inter для интерфейса, Spectral для длинного текста.',
                        },
                        {
                            id: 'brandbook',
                            name: 'Брендбук',
                            type: 'document',
                            tags: ['бренд'],
                            content: 'Логотип, охранная зона, цвета, голос бренда.',
                        },
                    ],
                },
                {
                    id: 'research',
                    name: 'Исследования',
                    type: 'folder',
                    children: [
                        {
                            id: 'user-interviews',
                            name: 'Интервью с пользователями',
                            type: 'document',
                            tags: ['UX'],
                            content: 'Пять глубинных интервью. Главная боль — нет единого места для визуальной структуры.',
                        },
                        {
                            id: 'competitors',
                            name: 'Конкуренты',
                            type: 'document',
                            tags: ['анализ'],
                            content: 'Notion, Obsidian, Logseq, Roam. Сильны в тексте, слабы в визуальных связях.',
                        },
                        {
                            id: 'analytics',
                            name: 'Статистика использования',
                            type: 'document',
                            tags: ['data'],
                            content: 'Основная сессия — 12 минут. 70% пользователей возвращаются за неделю.',
                        },
                        {
                            id: 'scenarios',
                            name: 'Сценарии использования',
                            type: 'document',
                            tags: ['UX'],
                            content: 'Конспектирование лекции, сбор референсов, составление ресёрча.',
                        },
                    ],
                },
                {
                    id: 'blog-redesign',
                    name: 'Редизайн блога',
                    type: 'folder',
                    children: [
                        { id: 'wireframes', name: 'Wireframes', type: 'document', tags: ['figma'] },
                        { id: 'visual-q4', name: 'Visual Q4', type: 'document', tags: ['дизайн'] },
                        { id: 'dark-theme', name: 'Тёмная тема', type: 'document', tags: ['theme'] },
                    ],
                },
            ],
        },
        {
            id: 'learning',
            name: 'Обучение',
            type: 'folder',
            children: [
                {
                    id: 'react-notes',
                    name: 'Конспекты React',
                    type: 'document',
                    tags: ['react', 'заметки'],
                    content: 'Hooks, Suspense, Server Components. Акцент на useMemo/useCallback и когда они реально нужны.',
                },
                {
                    id: 'd3-notes',
                    name: 'Заметки по D3',
                    type: 'document',
                    tags: ['d3', 'визуализация'],
                    content: 'd3-hierarchy, d3-tree, d3-zoom. Принципы раскладки Рейнгольда–Тилфорда.',
                },
                {
                    id: 'video-courses',
                    name: 'Видео-курсы',
                    type: 'folder',
                    children: [
                        { id: 'epic-react', name: 'Epic React', type: 'document', tags: ['курс'] },
                        { id: 'threejs-journey', name: 'Three.js Journey', type: 'document', tags: ['3D'] },
                        { id: 'animation-web', name: 'Animation for Web', type: 'document', tags: ['motion'] },
                    ],
                },
                {
                    id: 'books',
                    name: 'Книги',
                    type: 'folder',
                    children: [
                        { id: 'don-norman', name: 'Дизайн привычных вещей', type: 'document', tags: ['дизайн'] },
                        { id: 'dont-make-me-think', name: "Don't Make Me Think", type: 'document', tags: ['UX'] },
                        { id: 'refactoring-ui', name: 'Refactoring UI', type: 'document', tags: ['UI'] },
                    ],
                },
                {
                    id: 'articles',
                    name: 'Статьи',
                    type: 'document',
                    tags: ['закладки'],
                    content: 'Подборка статей — Josh Comeau, Smashing Magazine, CSS-Tricks.',
                },
            ],
        },
        {
            id: 'ideas',
            name: 'Идеи',
            type: 'folder',
            children: [
                {
                    id: 'startups',
                    name: 'Стартапы',
                    type: 'folder',
                    children: [
                        { id: 'notekeeper', name: 'Notekeeper v2', type: 'document', tags: ['идея'] },
                        { id: 'readlater', name: 'ReadLater++', type: 'document', tags: ['идея'] },
                        { id: 'retrospect', name: 'Retrospect', type: 'document', tags: ['идея'] },
                    ],
                },
                { id: 'experiments', name: 'Эксперименты', type: 'document', tags: ['sandbox'] },
                { id: 'idea-diary', name: 'Дневник идей', type: 'document', tags: ['дневник'] },
            ],
        },
        {
            id: 'archive',
            name: 'Архив',
            type: 'folder',
            children: [
                {
                    id: 'year-2023',
                    name: '2023',
                    type: 'folder',
                    children: [
                        { id: 'old-project-1', name: 'Старый лендинг', type: 'document' },
                        { id: 'old-notes-1', name: 'Конспекты 2023', type: 'document' },
                    ],
                },
                {
                    id: 'year-2024',
                    name: '2024',
                    type: 'folder',
                    children: [
                        { id: 'old-project-2', name: 'Редизайн SaaS', type: 'document' },
                        { id: 'old-notes-2', name: 'Интервью 2024', type: 'document' },
                        { id: 'old-brand', name: 'Бренд-гайды 2024', type: 'document' },
                    ],
                },
            ],
        },
        {
            id: 'resources',
            name: 'Ресурсы',
            type: 'folder',
            children: [
                { id: 'icons', name: 'Иконки', type: 'document', tags: ['assets'] },
                { id: 'fonts', name: 'Шрифты', type: 'document', tags: ['assets'] },
                { id: 'palettes', name: 'Палитры', type: 'document', tags: ['color'] },
                { id: 'figma-plugins', name: 'Плагины Figma', type: 'document', tags: ['figma'] },
                { id: 'component-libs', name: 'Библиотеки компонентов', type: 'document', tags: ['ui'] },
            ],
        },
        {
            id: 'personal',
            name: 'Личные заметки',
            type: 'document',
            tags: ['быстрое'],
            content: 'Мысли, черновики, идеи. Всё, что не нашло пока место в структуре.',
        },
        {
            id: 'quick-thoughts',
            name: 'Быстрые мысли',
            type: 'document',
            tags: ['inbox'],
            content: 'Ловушка для мыслей на ходу. Раз в неделю разбираю и раскидываю по папкам.',
        },
    ],
};

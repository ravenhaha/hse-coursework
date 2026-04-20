export const templates = [
    {
        id: 'lecture',
        name: 'Конспект лекции',
        icon: '🎓',
        content: `
<h2>📚 Тема лекции</h2>
<p></p>
<h3>Основные тезисы</h3>
<ul>
    <li>Тезис 1</li>
    <li>Тезис 2</li>
    <li>Тезис 3</li>
</ul>
<h3>Подробные заметки</h3>
<p></p>
<h3>Вопросы</h3>
<ul><li></li></ul>
<h3>Выводы</h3>
<p></p>
`.trim(),
    },
    {
        id: 'book',
        name: 'Заметка к книге',
        icon: '📖',
        content: `
<h2>📖 Название книги</h2>
<p><strong>Автор:</strong> </p>
<p><strong>Глава:</strong> </p>
<h3>Ключевые идеи</h3>
<ul>
    <li>Идея 1</li>
    <li>Идея 2</li>
</ul>
<h3>Цитаты</h3>
<blockquote><p>Цитата из книги</p></blockquote>
<h3>Мои мысли</h3>
<p></p>
`.trim(),
    },
    {
        id: 'article',
        name: 'Анализ статьи',
        icon: '📰',
        content: `
<h2>📰 Название статьи</h2>
<p><strong>Источник:</strong> </p>
<h3>Краткое содержание</h3>
<p></p>
<h3>Ключевые факты</h3>
<ol>
    <li>Факт 1</li>
    <li>Факт 2</li>
</ol>
<h3>Анализ</h3>
<p></p>
`.trim(),
    },
    {
        id: 'idea',
        name: 'Идея',
        icon: '💡',
        content: `
<h2>💡 Название идеи</h2>
<h3>Суть</h3>
<p></p>
<h3>Зачем?</h3>
<p></p>
<h3>Шаги</h3>
<ul>
    <li>Шаг 1</li>
    <li>Шаг 2</li>
</ul>
`.trim(),
    },
    {
        id: 'project',
        name: 'План проекта',
        icon: '🚀',
        content: `
<h2>🚀 Название проекта</h2>
<h3>Цель</h3>
<p></p>
<h3>Задачи</h3>
<ul>
    <li>Задача 1</li>
    <li>Задача 2</li>
    <li>Задача 3</li>
</ul>
<h3>Дедлайн</h3>
<p></p>
`.trim(),
    },
    {
        id: 'empty',
        name: 'Пустой',
        icon: '📝',
        content: '',
    },
];
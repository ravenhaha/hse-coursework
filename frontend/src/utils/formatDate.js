const MONTHS_SHORT = [
    'янв', 'фев', 'мар', 'апр', 'мая', 'июн',
    'июл', 'авг', 'сен', 'окт', 'ноя', 'дек',
];

/**
 * Умное относительное форматирование даты.
 *   • Сегодня        → "Сегодня"
 *   • Вчера          → "Вчера"
 *   • 2-6 дней назад → "N дн. назад"
 *   • Этот год       → "12 окт"
 *   • Прошлые годы   → "12 окт 2024"
 *
 * @param {string|Date|number|null|undefined} input
 * @returns {string} пустая строка если входа нет / он невалидный
 */
export function formatRelativeDate(input) {
    if (!input) return '';
    const date = input instanceof Date ? input : new Date(input);
    if (Number.isNaN(date.getTime())) return '';

    const now = new Date();

    // Сравниваем по локальной дате (без времени)
    const startOfDay = (d) =>
        new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

    const diffDays = Math.floor((startOfDay(now) - startOfDay(date)) / 86400000);

    if (diffDays === 0) return 'Сегодня';
    if (diffDays === 1) return 'Вчера';
    if (diffDays > 1 && diffDays < 7) return `${diffDays} дн. назад`;

    const day = date.getDate();
    const month = MONTHS_SHORT[date.getMonth()];
    const isThisYear = date.getFullYear() === now.getFullYear();

    return isThisYear
        ? `${day} ${month}`
        : `${day} ${month} ${date.getFullYear()}`;
}

/**
 * Полная дата для tooltip: "12.10.2025, 14:32"
 *
 * @param {string|Date|number|null|undefined} input
 * @returns {string}
 */
export function formatFullDate(input) {
    if (!input) return '';
    const date = input instanceof Date ? input : new Date(input);
    if (Number.isNaN(date.getTime())) return '';

    const pad = (n) => String(n).padStart(2, '0');
    return (
        `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}` +
        `, ${pad(date.getHours())}:${pad(date.getMinutes())}`
    );
}
// 📁 src/utils/materialFilters.js

/**
 * Фильтр по важности
 */
export function filterByImportant(items) {
  return items.filter(item => item.isImportant);
}

/**
 * Фильтр по типу
 * @param {string} kind - 'text' | 'pdf' | 'docx' | 'image' | 'file' | 'all'
 */
export function filterByKind(items, kind) {
  if (!kind || kind === 'all') return items;
  return items.filter(item => item.kind === kind);
}

/**
 * Сортировка по дате создания
 * @param {string} order - 'desc' (новые сверху) | 'asc' (старые сверху)
 */
export function sortByDate(items, order = 'desc') {
  return [...items].sort((a, b) => {
    const dateA = new Date(a.createdAt).getTime();
    const dateB = new Date(b.createdAt).getTime();
    return order === 'desc' ? dateB - dateA : dateA - dateB;
  });
}

/**
 * Поиск по названию
 */
export function filterBySearch(items, query) {
  if (!query) return items;
  const q = query.toLowerCase().trim();
  return items.filter(item => 
    item.name.toLowerCase().includes(q)
  );
}

/**
 * 🎯 Главная функция — применяет все фильтры разом
 * @param {Array} items - материалы
 * @param {Object} filters - { important, kind, search, sortOrder }
 */
export function applyFilters(items, filters = {}) {
  let result = items;
  
  if (filters.important) result = filterByImportant(result);
  if (filters.kind)      result = filterByKind(result, filters.kind);
  if (filters.search)    result = filterBySearch(result, filters.search);
  
  result = sortByDate(result, filters.sortOrder || 'desc');
  
  return result;
}
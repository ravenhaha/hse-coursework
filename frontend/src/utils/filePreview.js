// Кеш blob URL'ов по File объекту.
// WeakMap → когда File собирается GC, запись автоматически удалится.
const previewCache = new WeakMap();

/**
 * Возвращает blob URL для превью картинки.
 * Для одного и того же File всегда возвращает один и тот же URL.
 * Для не-картинок возвращает null.
 */
export function getFilePreview(file) {
    if (!file?.type?.startsWith('image/')) return null;

    let url = previewCache.get(file);
    if (!url) {
        url = URL.createObjectURL(file);
        previewCache.set(file, url);
    }
    return url;
}

/**
 * Явно освобождает blob URL для файла.
 * Вызывать при удалении файла из списка / закрытии модалки.
 */
export function releaseFilePreview(file) {
    const url = previewCache.get(file);
    if (url) {
        URL.revokeObjectURL(url);
        previewCache.delete(file);
    }
}
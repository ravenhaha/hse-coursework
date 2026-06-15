const API_ORIGIN = (() => {
  const base = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
  try {
    const u = new URL(base);
    return `${u.protocol}//${u.host}`;
  } catch {
    return '';
  }
})();

// Версия для кэш-бастинга. Меняется только после загрузки/удаления аватара.
let _avatarCacheVersion = 0;

/** Принудительно обновить кэш картинок аватара (после upload/delete). */
export function bumpAvatarCache() {
  _avatarCacheVersion = Date.now();
}

/** Текущая версия (если нужна снаружи). */
export function getAvatarCacheVersion() {
  return _avatarCacheVersion;
}

/**
 * Возвращает абсолютный URL аватара.
 * Поддерживает:
 *   - null/undefined  -> null
 *   - "http(s)://..." -> как есть
 *   - "/static/..."   -> origin + path
 *   - "static/..."    -> origin + "/" + path
 *
 * Параметр bust:
 *   - true (по умолчанию)  -> добавляет ?v=<version>, если version > 0
 *   - false                -> возвращает «чистый» URL
 */
export function getAvatarUrl(user, { bust = true } = {}) {
  if (!user?.avatar) return null;

  let src = user.avatar;
  if (!/^https?:\/\//i.test(src)) {
    if (!src.startsWith('/')) src = '/' + src;
    src = API_ORIGIN + src;
  }

  if (bust && _avatarCacheVersion > 0) {
    const sep = src.includes('?') ? '&' : '?';
    src += `${sep}v=${_avatarCacheVersion}`;
  }

  return src;
}
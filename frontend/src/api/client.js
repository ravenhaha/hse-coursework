const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

// ============================================================================
// Хуки уведомлений
// ============================================================================

let onSessionExpired = null;
let onNetworkError = null;

export function setSessionExpiredHandler(fn) {
  onSessionExpired = fn;
}

export function setNetworkErrorHandler(fn) {
  onNetworkError = fn;
}

// ============================================================================
// Утилиты
// ============================================================================

function getCsrfToken() {
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function buildUrl(path) {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE}${path}`;
}

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'UNKNOWN', details = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// ============================================================================
// Авто-рефреш access-токена
// ============================================================================

let refreshPromise = null;

async function refreshAccessToken({ suppressSessionExpired = false } = {}) {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const csrf = getCsrfToken();

    let res;
    try {
      res = await fetch(buildUrl('/auth/refresh'), {
        method: 'POST',
        credentials: 'include',
        headers: csrf ? { 'X-CSRF-Token': csrf } : {},
      });
    } catch {
      onNetworkError?.();
      throw new ApiError('Нет связи с сервером', {
        status: 0,
        code: 'NETWORK',
      });
    }

    if (!res.ok) {
      if (!suppressSessionExpired) onSessionExpired?.();
      throw new ApiError('Сессия истекла, войдите снова', {
        status: res.status,
        code: 'SESSION_EXPIRED',
      });
    }

    return true;
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

function shouldTryRefresh(path, { skipRefresh = false, isRetry = false } = {}) {
  if (skipRefresh || isRetry) return false;

  const authPaths = ['/auth/login', '/auth/register', '/auth/refresh'];
  if (authPaths.some((p) => path.startsWith(p))) return false;

  return true;
}

// ============================================================================
// Основная функция: apiFetch
// ============================================================================

export async function apiFetch(path, options = {}) {
  const {
    method = 'GET',
    body,
    headers = {},
    _skipRefresh = false,
    _isRetry = false,
    _suppressSessionExpired = false,
    ...rest
  } = options;

  const finalHeaders = new Headers(headers);
  let finalBody;

  // --------------------------------------------------------------------------
  // Обработка body
  // --------------------------------------------------------------------------
  if (body !== undefined && body !== null) {
    if (
      body instanceof FormData ||
      body instanceof Blob ||
      body instanceof ArrayBuffer ||
      body instanceof URLSearchParams ||
      ArrayBuffer.isView(body)
    ) {
      finalBody = body;

      if (body instanceof URLSearchParams && !finalHeaders.has('Content-Type')) {
        finalHeaders.set(
          'Content-Type',
          'application/x-www-form-urlencoded;charset=UTF-8'
        );
      }
    } else if (typeof body === 'string') {
      finalBody = body;
      // Content-Type не трогаем: вызывающий код сам может его передать
    } else {
      if (!finalHeaders.has('Content-Type')) {
        finalHeaders.set('Content-Type', 'application/json');
      }
      finalBody = JSON.stringify(body);
    }
  }

  // --------------------------------------------------------------------------
  // CSRF
  // --------------------------------------------------------------------------
  if (method !== 'GET' && method !== 'HEAD' && !finalHeaders.has('X-CSRF-Token')) {
    const csrf = getCsrfToken();
    if (csrf) {
      finalHeaders.set('X-CSRF-Token', csrf);
    }
  }

  // --------------------------------------------------------------------------
  // Запрос
  // --------------------------------------------------------------------------
  let res;
  try {
    res = await fetch(buildUrl(path), {
      method,
      credentials: 'include',
      headers: finalHeaders,
      body: finalBody,
      ...rest,
    });
  } catch {
    onNetworkError?.();
    throw new ApiError('Нет связи с сервером', {
      status: 0,
      code: 'NETWORK',
    });
  }

  // --------------------------------------------------------------------------
  // Авто-рефреш при 401
  // --------------------------------------------------------------------------
  if (
    res.status === 401 &&
    shouldTryRefresh(path, {
      skipRefresh: _skipRefresh,
      isRetry: _isRetry,
    })
  ) {
    await refreshAccessToken({ suppressSessionExpired: _suppressSessionExpired });
    return apiFetch(path, { ...options, _isRetry: true });
  }

  // --------------------------------------------------------------------------
  // Парсим тело
  // --------------------------------------------------------------------------
  const text = await res.text();
  const data = text ? safeJsonParse(text) : null;

  // --------------------------------------------------------------------------
  // HTTP-ошибка
  // --------------------------------------------------------------------------
  if (!res.ok) {
    const message = extractErrorMessage(data, res.status);
    const code =
      (data && typeof data === 'object' && data.code) ||
      (res.status === 401 ? 'UNAUTHORIZED' : `HTTP_${res.status}`);

    throw new ApiError(message, {
      status: res.status,
      code,
      details: data,
    });
  }

  return data;
}

// ============================================================================
// Хелперы
// ============================================================================

function extractErrorMessage(data, status) {
  if (!data) return `Что-то пошло не так (${status})`;

  if (typeof data === 'string') {
    return data || `Что-то пошло не так (${status})`;
  }

  if (Array.isArray(data.errors) && data.errors.length > 0) {
    return data.errors
      .map((e) => {
        if (e?.field && e?.message) return `${e.field}: ${e.message}`;
        return e?.message || e?.field || null;
      })
      .filter(Boolean)
      .join(', ');
  }

  if (Array.isArray(data.detail)) {
    const msgs = data.detail
      .map((e) => e?.msg || e?.message)
      .filter(Boolean);

    return msgs.length ? msgs.join(', ') : `Ошибка валидации (${status})`;
  }

  if (typeof data.detail === 'string') return data.detail;
  if (typeof data.message === 'string') return data.message;
  if (typeof data.error === 'string') return data.error;

  return `Что-то пошло не так (${status})`;
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

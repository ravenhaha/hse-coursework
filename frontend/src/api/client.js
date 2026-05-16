const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

// ============================================================================
// Хук для уведомления о смерти сессии
// ============================================================================

let onSessionExpired = null;

export function setSessionExpiredHandler(fn) {
  onSessionExpired = fn;
}

// ============================================================================
// Хук для уведомления о сетевых ошибках
// ============================================================================

let onNetworkError = null;

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

async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const csrf = getCsrfToken();
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: csrf ? { 'X-CSRF-Token': csrf } : {},
    });
    if (!res.ok) {
      onSessionExpired?.();
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
    ...rest
  } = options;

  const finalHeaders = { ...headers };
  let finalBody;

  // ─── Обработка body ─────────────────────────────────────────────────────
  // FormData / Blob / ArrayBuffer / URLSearchParams отправляем как есть.
  // Браузер сам выставит правильный Content-Type (с boundary для multipart).
  if (body !== undefined && body !== null) {
    if (
      body instanceof FormData ||
      body instanceof Blob ||
      body instanceof ArrayBuffer ||
      body instanceof URLSearchParams
    ) {
      finalBody = body;
    } else {
      finalHeaders['Content-Type'] = 'application/json';
      finalBody = JSON.stringify(body);
    }
  }
  // ────────────────────────────────────────────────────────────────────────

  // CSRF добавляем на все небезопасные методы
  if (method !== 'GET' && method !== 'HEAD') {
    const csrf = getCsrfToken();
    if (csrf) finalHeaders['X-CSRF-Token'] = csrf;
  }

  // --- Выполняем запрос ---
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
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

  // --- Авто-рефреш при 401 ---
  if (res.status === 401 && !_skipRefresh && !_isRetry) {
    await refreshAccessToken();
    return apiFetch(path, { ...options, _isRetry: true });
  }

  // --- Парсим тело ---
  const text = await res.text();
  const data = text ? safeJsonParse(text) : null;

  // --- HTTP-ошибка ---
  if (!res.ok) {
    const message =
      (data && (data.message || data.error)) ||
      `Ошибка ${res.status}`;
    const code =
      (data && data.code) ||
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
// Хелпер
// ============================================================================

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
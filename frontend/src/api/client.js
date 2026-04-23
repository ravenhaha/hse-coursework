const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

function getCsrfToken() {
  const m = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export async function apiFetch(path, options = {}) {
  const { method = 'GET', body, headers = {}, ...rest } = options;
  const finalHeaders = { ...headers };
  let finalBody = body;

  if (body && !(body instanceof FormData) && typeof body !== 'string') {
    finalHeaders['Content-Type'] = 'application/json';
    finalBody = JSON.stringify(body);
  }

  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) {
    const csrf = getCsrfToken();
    if (csrf) finalHeaders['X-CSRF-Token'] = csrf;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: 'include',
    headers: finalHeaders,
    body: finalBody,
    ...rest,
  });

  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const err = new Error(data?.detail || `Ошибка ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}
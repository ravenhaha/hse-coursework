const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

function getCsrfToken() {
  const m = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

let refreshPromise = null;
async function tryRefresh() {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
      .then(r => r.ok)
      .catch(() => false)
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

async function request(path, { method = 'GET', body, isForm = false, headers = {}, _retry = false } = {}) {
  const opts = { method, credentials: 'include', headers: { ...headers } };

  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
    const csrf = getCsrfToken();
    if (csrf) opts.headers['X-CSRF-Token'] = csrf;
  }

  if (body !== undefined) {
    if (isForm) {
      opts.body = body;
    } else {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
  }

  const res = await fetch(`${API_BASE}${path}`, opts);

  if (res.status === 401 && !_retry && !path.startsWith('/auth/')) {
    const ok = await tryRefresh();
    if (ok) return request(path, { method, body, isForm, headers, _retry: true });
  }

  if (res.status === 204) return null;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.detail || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  get:      (p)       => request(p),
  post:     (p, body) => request(p, { method: 'POST', body }),
  postForm: (p, form) => request(p, { method: 'POST', body: form, isForm: true }),
  patch:    (p, body) => request(p, { method: 'PATCH', body }),
  del:      (p)       => request(p, { method: 'DELETE' }),
};
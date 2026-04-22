const API_URL = import.meta.env.VITE_API_URL;

async function request(endpoint, options = {}) {
  const token = localStorage.getItem('access_token');

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Если body — FormData, убираем Content-Type (браузер сам поставит)
  if (options.body instanceof FormData) {
    delete headers['Content-Type'];
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // 401 — токен невалиден
  if (response.status === 401) {
    localStorage.removeItem('access_token');
    window.location.href = '/login';
    return;
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  // 204 No Content
  if (response.status === 204) return null;

  return response.json();
}

export const api = {
  get: (endpoint) => request(endpoint, { method: 'GET' }),

  post: (endpoint, body) => request(endpoint, {
    method: 'POST',
    body: body instanceof FormData ? body : JSON.stringify(body),
  }),

  put: (endpoint, body) => request(endpoint, {
    method: 'PUT',
    body: body instanceof FormData ? body : JSON.stringify(body),
  }),

  delete: (endpoint) => request(endpoint, { method: 'DELETE' }),
};
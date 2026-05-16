import { apiFetch } from './client';

export const authApi = {
  register: (email, password) =>
    apiFetch('/auth/register', {
      method: 'POST',
      body: { email, password },
      _skipRefresh: true,
    }),

  login: (email, password) =>
    apiFetch('/auth/login', {
      method: 'POST',
      body: { email, password },
      _skipRefresh: true,
    }),

  logout: () =>
    apiFetch('/auth/logout', {
      method: 'POST',
      _skipRefresh: true,
    }),

  refresh: () =>
    apiFetch('/auth/refresh', {
      method: 'POST',
      _skipRefresh: true,
    }),
  me: () => apiFetch('/users/me'),
};
import { api } from './client';

export const authApi = {
  // Регистрация
  register: (username, email, password) =>
    api.post('/auth/register', { username, email, password }),

  // Логин — возвращает токен
  login: async (username, password) => {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);
    return api.post('/auth/token', formData);
  },

  // Получить текущего пользователя
  getMe: () => api.get('/auth/me'),
};
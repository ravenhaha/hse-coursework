import { api } from './client';

export const memoriesApi = {
  // Получить все воспоминания
  getAll: () => api.get('/memories/'),

  // Получить одно воспоминание
  getById: (id) => api.get(`/memories/${id}/`),

  // Создать воспоминание
  create: (data) => api.post('/memories/', data),

  // Обновить воспоминание
  update: (id, data) => api.put(`/memories/${id}/`, data),

  // Удалить воспоминание
  delete: (id) => api.delete(`/memories/${id}/`),

  // Поиск
  search: (query) => api.get(`/memories/search/?q=${encodeURIComponent(query)}`),
};
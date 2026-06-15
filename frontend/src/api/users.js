import { apiFetch } from './client';

export const usersApi = {
  // Загрузка нового аватара (файл уже обрезан на клиенте)
  uploadAvatar: (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return apiFetch('/users/me/avatar', { method: 'POST', body: fd });
  },

  // Удаление аватара
  deleteAvatar: () =>
    apiFetch('/users/me/avatar', { method: 'DELETE' }),

  // Обновление профиля (имя и т.п.)
  updateProfile: (patch) =>
    apiFetch('/users/me', { method: 'PATCH', body: patch }),

  // 🆕 Полное удаление аккаунта (со всеми коллекциями, материалами, файлами)
  deleteAccount: () =>
    apiFetch('/users/me', { method: 'DELETE' }),
};
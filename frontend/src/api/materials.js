import { apiFetch } from './client';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export const materialsApi = {
  // collectionId === null/undefined → ВСЕ материалы пользователя
  // collectionId === <id>           → материалы конкретной коллекции
  list: (collectionId = null) => {
    const qs = collectionId != null ? `?collection_id=${collectionId}` : '';
    return apiFetch(`/materials/${qs}`);
  },

  get: (id) => apiFetch(`/materials/${id}`),

  search: ({ q = '', collectionId = null, tagIds = [] } = {}) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (collectionId != null) params.set('collection_id', String(collectionId));
    tagIds.forEach((id) => params.append('tag_ids', String(id)));
    const qs = params.toString();
    return apiFetch(`/materials/search${qs ? `?${qs}` : ''}`);
  },

  createText: ({ collection_id, material_name, text_content }) =>
    apiFetch('/materials/text', {
      method: 'POST',
      body: { collection_id, material_name, text_content },
    }),

  createFile: ({ collection_id, material_name, file }) => {
    const fd = new FormData();
    fd.append('collection_id', String(collection_id));
    fd.append('material_name', material_name);
    fd.append('file', file);
    return apiFetch('/materials/file', { method: 'POST', body: fd });
  },

  update: (id, data) =>
    apiFetch(`/materials/${id}`, { method: 'PATCH', body: data }),

  delete: (id) =>
    apiFetch(`/materials/${id}`, { method: 'DELETE' }),

  // 🆕 Прямой URL — оставляем на всякий случай (для navigation-скачивания)
  fileUrl: (id) => `${API_BASE}/materials/${id}/file`,

  // 🆕 Скачать файл как Blob (через credentials: 'include' — куки шлются)
  // Используется для показа картинок и для скачивания оригинала.
  async getFileBlob(id) {
    const res = await fetch(`${API_BASE}/materials/${id}/file`, {
      method: 'GET',
      credentials: 'include',
    });
    if (!res.ok) {
      const err = new Error(`Ошибка загрузки файла: ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return res.blob();
  },
};
import { apiFetch } from './client';

export const materialsApi = {
  list: (collectionId = null) => {
    const params = collectionId ? `?collection_id=${collectionId}` : '';
    return apiFetch(`/materials/${params}`);
  },

  get: (id) => apiFetch(`/materials/${id}`),

  create: (data) =>
    apiFetch('/materials/', {
      method: 'POST',
      body: data,
    }),

  update: (id, data) =>
    apiFetch(`/materials/${id}`, { method: 'PATCH', body: data }),

  delete: (id) =>
    apiFetch(`/materials/${id}`, { method: 'DELETE' }),
};
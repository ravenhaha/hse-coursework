import { apiFetch } from './client';

export const collectionsApi = {
  list: () => apiFetch('/collections/'),

  get: (id) => apiFetch(`/collections/${id}`),

  create: (name, parentId = null) =>
    apiFetch('/collections/', {
      method: 'POST',
      body: { collection_name: name, parent_id: parentId },
    }),

  update: (id, data) =>
    apiFetch(`/collections/${id}`, { method: 'PATCH', body: data }),

  delete: (id) =>
    apiFetch(`/collections/${id}`, { method: 'DELETE' }),
};
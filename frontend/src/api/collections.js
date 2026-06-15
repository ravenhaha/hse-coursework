// api/collections.js
import { apiFetch } from './client';

export const collectionsApi = {
  tree: () => apiFetch('/collections/tree'),

  list: (parentId = null) => {
    const qs = parentId !== null ? `?parent_id=${parentId}` : '';
    return apiFetch(`/collections/${qs}`);
  },

  get: (id) => apiFetch(`/collections/${id}`),

  search: (query) =>
    apiFetch(`/collections/search?q=${encodeURIComponent(query)}`),

  create: (name, parentId = null, icon = null) =>
    apiFetch('/collections/', {
      method: 'POST',
      body: { name, icon, parent_id: parentId },
    }),

  update: (id, data) =>
    apiFetch(`/collections/${id}`, { method: 'PATCH', body: data }),

  delete: (id) =>
    apiFetch(`/collections/${id}`, { method: 'DELETE' }),
};
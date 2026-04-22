import { api } from './client';

export const collectionsApi = {
  list: (parentId = null) => {
    const qs = parentId != null ? `?parent_id=${parentId}` : '';
    return api.get(`/collections/${qs}`);
  },
  create: (collection_name, parent_id = null) =>
    api.post('/collections/', { collection_name, parent_id }),
  rename: (id, collection_name) =>
    api.patch(`/collections/${id}`, { collection_name }),
  move: (id, parent_id) =>
    api.patch(`/collections/${id}`, { parent_id }),
  remove: (id) =>
    api.del(`/collections/${id}`),
};
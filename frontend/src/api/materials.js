import { api } from './client';

export const materialsApi = {
  listByCollection: (collectionId) =>
    api.get(`/materials/?collection_id=${collectionId}`),

  getOne: (id) => api.get(`/materials/${id}`),

  createText: ({ collection_id, material_name, text_content }) =>
    api.post('/materials/text', { collection_id, material_name, text_content }),

  createFile: ({ collection_id, material_name, file }) => {
    const fd = new FormData();
    fd.append('collection_id', collection_id);
    fd.append('material_name', material_name);
    fd.append('file', file);
    return api.postForm('/materials/file', fd);
  },

  update: (id, patch) => api.patch(`/materials/${id}`, patch),
  remove: (id) => api.del(`/materials/${id}`),
};
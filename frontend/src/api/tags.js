import { apiFetch } from './client';

export const tagsApi = {
  // ─── CRUD тегов ───

  /** GET /tags/ — список всех тегов юзера */
  list: () => apiFetch('/tags/'),

  /** GET /tags/:id — один тег */
  get: (id) => apiFetch(`/tags/${id}`),

  /** POST /tags/ — создать тег */
  create: (tagName) =>
    apiFetch('/tags/', {
      method: 'POST',
      body: { tag_name: tagName },
    }),

  /** PATCH /tags/:id — переименовать тег */
  update: (id, tagName) =>
    apiFetch(`/tags/${id}`, {
      method: 'PATCH',
      body: { tag_name: tagName },
    }),

  /** DELETE /tags/:id — удалить тег */
  delete: (id) =>
    apiFetch(`/tags/${id}`, { method: 'DELETE' }),

  // ─── Привязка к материалам ───

  /** GET /tags/materials/:materialId — теги конкретного материала */
  getMaterialTags: (materialId) =>
    apiFetch(`/tags/materials/${materialId}`),

  /** POST /tags/materials/:materialId — привязать один тег */
  assignToMaterial: (materialId, tagId) =>
    apiFetch(`/tags/materials/${materialId}`, {
      method: 'POST',
      body: { tag_id: tagId },
    }),

  /** 🆕 PUT /tags/materials/:materialId — заменить весь набор тегов одним запросом */
  setMaterialTags: (materialId, tagIds) =>
    apiFetch(`/tags/materials/${materialId}`, {
      method: 'PUT',
      body: { tag_ids: tagIds },
    }),

  /** DELETE /tags/materials/:materialId/:tagId — отвязать один тег */
  unassignFromMaterial: (materialId, tagId) =>
    apiFetch(`/tags/materials/${materialId}/${tagId}`, {
      method: 'DELETE',
    }),
};
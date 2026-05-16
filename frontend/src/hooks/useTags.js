import { useState, useEffect, useCallback, useRef } from 'react';
import { tagsApi } from '../api/tags';

/**
 * Преобразует сырой тег с бэка → объект для UI.
 */
function toTagItem(t) {
  return {
    id: t.id,
    name: t.tag_name,
    userId: t.user_id,
    createdAt: t.created_at,
    raw: t,
  };
}

/**
 * Управление тегами пользователя.
 * - CRUD тегов
 * - Привязка/отвязка к материалам
 */
export default function useTags() {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const requestIdRef = useRef(0);

  // ─── Загрузка ───

  const load = useCallback(async () => {
    const myId = ++requestIdRef.current;
    setLoading(true);
    setError('');
    try {
      const data = await tagsApi.list();
      if (myId !== requestIdRef.current) return;
      setTags((Array.isArray(data) ? data : []).map(toTagItem));
    } catch (err) {
      if (myId !== requestIdRef.current) return;
      setError(err?.message || 'Ошибка загрузки тегов');
      setTags([]);
    } finally {
      if (myId === requestIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ─── CRUD ───

  const create = useCallback(async (tagName) => {
    const name = tagName?.trim();
    if (!name) throw new Error('Имя тега не может быть пустым');

    const created = await tagsApi.create(name);
    const item = toTagItem(created);
    setTags((prev) => [...prev, item]);
    return item;
  }, []);

  const rename = useCallback(async (id, newName) => {
    const name = newName?.trim();
    if (!name) throw new Error('Имя тега не может быть пустым');

    const updated = await tagsApi.update(id, name);
    setTags((prev) =>
      prev.map((t) => (t.id === id ? toTagItem(updated) : t))
    );
    return updated;
  }, []);

  const remove = useCallback(async (id) => {
    await tagsApi.delete(id);
    setTags((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ─── Привязка к материалам ───

  /**
   * Привязать тег к материалу.
   * Возвращает обновлённый список тегов материала.
   */
  const assignToMaterial = useCallback(async (materialId, tagId) => {
    await tagsApi.assignToMaterial(materialId, tagId);
    return await tagsApi.getMaterialTags(materialId);
  }, []);

  /**
   * Отвязать тег от материала.
   */
  const unassignFromMaterial = useCallback(async (materialId, tagId) => {
    await tagsApi.unassignFromMaterial(materialId, tagId);
    return await tagsApi.getMaterialTags(materialId);
  }, []);

  /**
   * Получить теги материала (отдельный запрос).
   */
  const getMaterialTags = useCallback(async (materialId) => {
    const data = await tagsApi.getMaterialTags(materialId);
    return (Array.isArray(data) ? data : []).map(toTagItem);
  }, []);

  /**
   * Найти тег по имени (для автокомплита).
   */
  const findByName = useCallback((name) => {
    const lower = name?.trim().toLowerCase();
    if (!lower) return null;
    return tags.find((t) => t.name.toLowerCase() === lower) || null;
  }, [tags]);

  /**
   * Создать тег если его нет, иначе вернуть существующий.
   */
  const getOrCreate = useCallback(async (tagName) => {
    const existing = findByName(tagName);
    if (existing) return existing;
    return await create(tagName);
  }, [findByName, create]);

  return {
    tags,
    loading,
    error,
    reload: load,

    // CRUD
    create,
    rename,
    remove,

    // Привязка
    assignToMaterial,
    unassignFromMaterial,
    getMaterialTags,

    // Утилиты
    findByName,
    getOrCreate,
  };
}
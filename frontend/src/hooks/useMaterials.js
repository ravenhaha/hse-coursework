import { useState, useEffect, useCallback, useRef } from 'react';
import { materialsApi } from '../api/materials';
import { tagsApi } from '../api/tags';

function toSidebarItem(m) {
  const ext = m.file_path ? m.file_path.split('.').pop().toLowerCase() : null;

  let kind = 'text';
  if (m.source_type === 'file') {
    if (ext === 'pdf') kind = 'pdf';
    else if (['doc', 'docx'].includes(ext)) kind = 'docx';
    else if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) kind = 'image';
    else kind = 'file';
  }

  const tags = Array.isArray(m.tags)
    ? m.tags.map((t) => ({
        id: t.id,
        name: t.tag_name,
        userId: t.user_id,
        createdAt: t.created_at,
      }))
    : [];

  return {
    id: m.id,
    name: m.material_name || 'Без названия',
    type: 'document',
    kind,
    sourceType: m.source_type,
    isImportant: !!m.is_important,
    createdAt: m.created_at,
    updatedAt: m.updated_at,
    collectionId: m.collection_id,
    tags,
    tagIds: tags.map((t) => t.id),
    raw: m,
  };
}

export default function useMaterials() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    const myId = ++requestIdRef.current;
    setLoading(true);
    setError('');
    try {
      const data = await materialsApi.list();
      if (myId !== requestIdRef.current) return;
      setItems((Array.isArray(data) ? data : []).map(toSidebarItem));
    } catch (err) {
      if (myId !== requestIdRef.current) return;
      setError(err?.message || 'Ошибка загрузки материалов');
      setItems([]);
    } finally {
      if (myId === requestIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ─── helper: получить или создать теги по именам ───
  const ensureTags = useCallback(async (tagNames = []) => {
    if (!tagNames.length) return [];

    const existing = await tagsApi.list();
    const existingMap = new Map(
      (Array.isArray(existing) ? existing : []).map((t) => [
        t.tag_name.toLowerCase(),
        t.id,
      ])
    );

    const ids = [];
    for (const name of tagNames) {
      const lower = name.trim().toLowerCase();
      if (!lower) continue;

      if (existingMap.has(lower)) {
        ids.push(existingMap.get(lower));
      } else {
        const created = await tagsApi.create(name.trim());
        existingMap.set(lower, created.id);
        ids.push(created.id);
      }
    }
    return ids;
  }, []);

  const finalizeMaterial = useCallback(async (materialId, tagNames, isImportant) => {
    if (tagNames?.length) {
      const tagIds = await ensureTags(tagNames);
      await Promise.all(
        tagIds.map((id) => tagsApi.assignToMaterial(materialId, id))
      );
    }

    if (isImportant) {
      await materialsApi.update(materialId, { is_important: true });
    }

    return await materialsApi.get(materialId);
  }, [ensureTags]);

  // ─── Создание ───
  const create = useCallback(async (data) => {
    if (!data?.collection) throw new Error('Не выбрана коллекция');
    const collectionId = Number(data.collection);

    if (data.mode === 'editor') {
      const created = await materialsApi.createText({
        collection_id: collectionId,
        material_name: data.title?.trim() || 'Без названия',
        text_content: (data.content && data.content.trim()) || ' ',
      });

      const fresh = await finalizeMaterial(
        created.id,
        data.tags,
        data.isImportant
      );

      setItems((prev) => [toSidebarItem(fresh), ...prev]);
      return fresh;
    }

    if (data.mode === 'upload') {
      if (!data.files?.length) throw new Error('Нет файлов');

      const finalItems = [];
      for (const f of data.files) {
        const res = await materialsApi.createFile({
          collection_id: collectionId,
          material_name: f.file.name,
          file: f.file,
        });

        const fresh = await finalizeMaterial(res.id, f.tags, f.isImportant);
        finalItems.push(fresh);
      }

      setItems((prev) => [...finalItems.map(toSidebarItem), ...prev]);
      return finalItems[0];
    }

    throw new Error('Неизвестный режим создания материала');
  }, [finalizeMaterial]);

  // ─── Обновления ───
  const rename = useCallback(async (id, newName) => {
    const updated = await materialsApi.update(id, { material_name: newName });
    setItems((prev) =>
      prev.map((it) => (it.id === id ? toSidebarItem({ ...it.raw, ...updated }) : it))
    );
    return updated;
  }, []);

  const update = useCallback(async (id, patch) => {
    const updated = await materialsApi.update(id, patch);
    setItems((prev) =>
      prev.map((it) => (it.id === id ? toSidebarItem({ ...it.raw, ...updated }) : it))
    );
    return updated;
  }, []);

  const remove = useCallback(async (id) => {
    await materialsApi.delete(id);
    setItems((prev) => prev.filter((it) => it.id !== id));
  }, []);

  // 🆕 Локально вычистить материалы по списку id коллекций.
  // Вызывается из WorkspacePage после удаления коллекции,
  // чтобы материалы пропали из «Все материалы» моментально, без F5.
  const removeByCollectionIds = useCallback((collectionIds) => {
    if (!collectionIds?.length) return;
    const idSet = new Set(collectionIds.map(Number));
    setItems((prev) => prev.filter((it) => !idSet.has(Number(it.collectionId))));
  }, []);

  const move = useCallback(async (id, newCollectionId) => {
    const updated = await materialsApi.update(id, { collection_id: newCollectionId });
    setItems((prev) =>
      prev.map((it) => (it.id === id ? toSidebarItem({ ...it.raw, ...updated }) : it))
    );
    return updated;
  }, []);

  const toggleImportant = useCallback(async (id, isImportant) => {
    return update(id, { is_important: isImportant });
  }, [update]);

  return {
    materials: items,
    loading,
    error,
    reload: load,
    create,
    rename,
    update,
    remove,
    removeByCollectionIds, // 🆕
    move,
    toggleImportant,
  };
}
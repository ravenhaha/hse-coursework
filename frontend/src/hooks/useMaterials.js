import { useState, useEffect, useCallback } from 'react';
import { materialsApi } from '../api/materials';

function toSidebarItem(m) {
  return {
    id: m.id,
    name: m.title || m.material_name || 'Без названия',
    type: 'document',
    raw: m,
  };
}

export default function useMaterials() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await materialsApi.list();
      setItems((data || []).map(toSidebarItem));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = useCallback(async (data) => {
    const created = await materialsApi.create(data);
    setItems((prev) => [...prev, toSidebarItem(created)]);
    return created;
  }, []);

  const rename = useCallback(async (id, newName) => {
    const updated = await materialsApi.update(id, { title: newName });
    setItems((prev) =>
      prev.map((it) => (it.id === id ? toSidebarItem({ ...it.raw, ...updated }) : it))
    );
  }, []);

  const remove = useCallback(async (id) => {
    await materialsApi.delete(id);
    setItems((prev) => prev.filter((it) => it.id !== id));
  }, []);

  return { materials: items, loading, error, reload: load, create, rename, remove };
}
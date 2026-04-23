import { useState, useEffect, useCallback, useMemo } from 'react';
import { collectionsApi } from '../api/collections';

function buildTree(flat) {
  const map = {};
  const roots = [];

  flat.forEach((item) => {
    map[item.id] = {
      id: item.id,
      name: item.collection_name,
      type: 'folder',
      children: [],
      raw: item,
    };
  });

  flat.forEach((item) => {
    if (item.parent_id && map[item.parent_id]) {
      map[item.parent_id].children.push(map[item.id]);
    } else {
      roots.push(map[item.id]);
    }
  });

  return roots;
}

export default function useCollections() {
  const [flat, setFlat] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const collections = useMemo(() => buildTree(flat), [flat]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await collectionsApi.list();
      setFlat(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = useCallback(async (name, parentId = null) => {
    const created = await collectionsApi.create(name, parentId);
    setFlat((prev) => [...prev, created]);
    return created;
  }, []);

  const rename = useCallback(async (id, newName) => {
    const updated = await collectionsApi.update(id, { collection_name: newName });
    setFlat((prev) => prev.map((c) => (c.id === id ? { ...c, ...updated } : c)));
  }, []);

  const remove = useCallback(async (id) => {
    await collectionsApi.delete(id);
    setFlat((prev) => prev.filter((c) => c.id !== id));
  }, []);

  return { collections, loading, error, reload: load, create, rename, remove };
}
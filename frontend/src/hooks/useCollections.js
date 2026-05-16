import { useState, useEffect, useCallback, useRef } from 'react';
import { collectionsApi } from '../api/collections';

/**
 * Преобразует CollectionTreeNode из API в формат TreeItem для сайдбара.
 *
 * Бэк отдаёт:
 *   { id, name, icon, parent_id, created_at, children: [...] }
 *
 * Сайдбар ждёт:
 *   { id, name, icon, type: 'folder', children: [...], raw: <оригинал> }
 */
function normalizeTree(nodes) {
  if (!Array.isArray(nodes)) return [];
  return nodes.map((node) => ({
    id: node.id,
    name: node.name,
    icon: node.icon ?? null,
    type: 'folder',
    children: normalizeTree(node.children || []),
    raw: node,
  }));
}

export default function useCollections() {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Защита от гонок: если пользователь быстро дёргает load() несколько раз подряд,
  // в state попадёт результат только последнего запроса.
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    const myId = ++requestIdRef.current;
    setLoading(true);
    setError('');
    try {
      const data = await collectionsApi.tree();
      if (myId !== requestIdRef.current) return;
      setCollections(normalizeTree(data));
    } catch (err) {
      if (myId !== requestIdRef.current) return;
      setError(err?.message || 'Ошибка загрузки коллекций');
      setCollections([]);
    } finally {
      if (myId === requestIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ─── CRUD ──────────────────────────────────────────────────────────

  const create = useCallback(async (name, parentId = null, icon = null) => {
    const created = await collectionsApi.create(name, parentId, icon);
    await load();
    return created;
  }, [load]);

  const rename = useCallback(async (id, newName) => {
    // Бэк ждёт поле `name` (не `collection_name`!)
    const updated = await collectionsApi.update(id, { name: newName });
    await load();
    return updated;
  }, [load]);

  // 🆕 Обновление иконки (раз бэк её поддерживает — даём API наружу)
  const setIcon = useCallback(async (id, icon) => {
    const updated = await collectionsApi.update(id, { icon });
    await load();
    return updated;
  }, [load]);

  /**
   * Собрать id коллекции + всех её потомков по текущему загруженному дереву.
   * Нужно для удаления: бэк каскадно удаляет вложенные коллекции и их материалы,
   * а фронту нужно знать какие именно id были затронуты, чтобы локально
   * вычистить материалы из useMaterials без перезагрузки страницы.
   */
  const collectBranchIds = useCallback((rootId, nodes = collections) => {
    const result = [];
    const walk = (list) => {
      for (const n of list) {
        if (n.id === rootId) {
          const collectAll = (x) => {
            result.push(x.id);
            (x.children || []).forEach(collectAll);
          };
          collectAll(n);
          return true;
        }
        if (n.children?.length && walk(n.children)) return true;
      }
      return false;
    };
    walk(nodes);
    return result;
  }, [collections]);

  const remove = useCallback(async (id) => {
    // ВАЖНО: собираем ветку ДО запроса, потому что после load() дерево обновится
    // и id уже не будет — мы не сможем понять какие материалы чистить.
    const affectedIds = collectBranchIds(id);
    await collectionsApi.delete(id);
    await load();
    return affectedIds; // возвращаем наружу для синхронизации useMaterials
  }, [load, collectBranchIds]);

  /**
   * Перемещение коллекции.
   *   newParentId = number → переместить под этого родителя
   *   newParentId = null   → переместить в корень
   *
   * По схеме CollectionUpdate бэка: поле parent_id=null означает «в корень»,
   * отсутствие поля — «не трогать родителя». Здесь мы всегда явно передаём
   * parent_id (включая null), потому что это и есть смысл операции move.
   */
  const move = useCallback(async (id, newParentId) => {
    const updated = await collectionsApi.update(id, { parent_id: newParentId });
    await load();
    return updated;
  }, [load]);

  return {
    collections,
    loading,
    error,
    reload: load,
    create,
    rename,
    setIcon,        // 🆕
    remove,
    move,
    collectBranchIds,
  };
}
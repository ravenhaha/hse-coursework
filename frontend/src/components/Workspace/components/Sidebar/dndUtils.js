// Вспомогалки для DnD: проверка циклов и поиск родителя
// Структура коллекций — плоская (то что в useCollections без materials).

/**
 * Проверяет: является ли potentialAncestorId потомком nodeId.
 * Используется чтобы НЕ дать перетащить папку внутрь её собственного потомка.
 */
export function isDescendant(collectionsTree, nodeId, potentialAncestorId) {
  if (nodeId === potentialAncestorId) return true;

  // Найдём узел nodeId в дереве и пройдёмся по его поддереву
  function findAndCheck(nodes) {
    for (const n of nodes) {
      if (n.id === nodeId) {
        // нашли — теперь ищем potentialAncestorId в его потомках
        return containsId(n.children || [], potentialAncestorId);
      }
      const inner = findAndCheck(n.children || []);
      if (inner) return inner;
    }
    return false;
  }

  function containsId(nodes, id) {
    for (const n of nodes) {
      if (n.type !== 'folder') continue;
      if (n.id === id) return true;
      if (containsId(n.children || [], id)) return true;
    }
    return false;
  }

  return findAndCheck(collectionsTree);
}

/** Текущий parent_id коллекции (или null) */
export function findCollectionParent(collectionsTree, id) {
  function walk(nodes, parentId) {
    for (const n of nodes) {
      if (n.type !== 'folder') continue;
      if (n.id === id) return parentId;
      const found = walk(n.children || [], n.id);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  const result = walk(collectionsTree, null);
  return result === undefined ? null : result;
}
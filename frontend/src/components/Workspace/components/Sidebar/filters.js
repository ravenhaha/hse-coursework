export function filterTree(items, query) {
  if (!query) return items;
  const lower = query.toLowerCase();

  return items.reduce((acc, item) => {
    if (item.type === 'folder') {
      const filteredChildren = filterTree(item.children || [], query);
      if (filteredChildren.length > 0 || item.name.toLowerCase().includes(lower)) {
        acc.push({ ...item, children: filteredChildren });
      }
    } else {
      if (item.name.toLowerCase().includes(lower)) {
        acc.push(item);
      }
    }
    return acc;
  }, []);
}

export function filterFlat(items, query) {
  if (!query) return items;
  const lower = query.toLowerCase();
  return items.filter((item) => item.name.toLowerCase().includes(lower));
}

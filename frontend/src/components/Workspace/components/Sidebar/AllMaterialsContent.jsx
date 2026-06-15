import { useCallback, useMemo, useState } from 'react';
import { IoSearchOutline } from 'react-icons/io5';

import FiltersBar from './FilterBar/FilterBar';
import TreeItem from './TreeItem';
import EmptyState from './EmptyState';
import { filterFlat } from './filters';
import { materialsApi } from '../../../../api/materials';
import { useToast } from '../../../../hooks/useToast';
import MaterialsSummaryPanel from './MaterialsSummaryPanel';
import ImportMaterialsCsvModal from './ImportMaterialsCsvModal';

const isFiltersEmpty = (f) =>
  f.collectionId == null &&
  (f.tagIds?.length ?? 0) === 0 &&
  !f.onlyImportant &&
  !f.kind &&
  !f.dateFrom &&
  !f.dateTo;

function detectSourceType(material) {
  const sourceType =
    material.sourceType ??
    material.raw?.source_type ??
    (material.filePath || material.raw?.file_path ? 'file' : 'text');

  return sourceType === 'file' ? 'file' : 'text';
}

function buildCollectionNameMap(nodes, map = new Map()) {
  for (const node of nodes || []) {
    map.set(Number(node.id), node.name);
    if (node.children?.length) {
      buildCollectionNameMap(
        node.children.filter((child) => child.type !== 'document'),
        map,
      );
    }
  }
  return map;
}

function buildTagsNameMap(tags = []) {
  const map = new Map();
  for (const tag of tags) {
    map.set(Number(tag.id), tag.name);
  }
  return map;
}

function buildSummary(materials, pureCollections, availableTags) {
  const byType = { text: 0, file: 0 };
  const byCollectionMap = new Map();
  const byTagMap = new Map();

  const collectionNames = buildCollectionNameMap(pureCollections);
  const tagNames = buildTagsNameMap(availableTags);

  for (const material of materials) {
    const sourceType = detectSourceType(material);
    byType[sourceType] += 1;

    const collectionId = Number(
      material.collectionId ?? material.raw?.collection_id,
    );

    if (Number.isFinite(collectionId)) {
      const name = collectionNames.get(collectionId) || `Коллекция #${collectionId}`;
      const prev = byCollectionMap.get(collectionId) || { id: collectionId, name, count: 0 };
      prev.count += 1;
      byCollectionMap.set(collectionId, prev);
    }

    const tagIds =
      material.tagIds ??
      material.raw?.tag_ids ??
      material.tags?.map((tag) => tag.id) ??
      [];

    for (const rawTagId of tagIds) {
      const tagId = Number(rawTagId);
      if (!Number.isFinite(tagId)) continue;

      const name = tagNames.get(tagId) || `Тег #${tagId}`;
      const prev = byTagMap.get(tagId) || { id: tagId, name, count: 0 };
      prev.count += 1;
      byTagMap.set(tagId, prev);
    }
  }

  const sortItems = (a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return String(a.name).localeCompare(String(b.name), 'ru');
  };

  return {
    total: materials.length,
    byType,
    byCollection: [...byCollectionMap.values()].sort(sortItems),
    byTag: [...byTagMap.values()].sort(sortItems),
  };
}

function saveBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'materials_export.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

function buildImportMessage(result) {
  const created =
    result?.createdCount ??
    result?.created_count ??
    result?.created ??
    result?.imported ??
    null;

  const skipped =
    result?.skippedCount ??
    result?.skipped_count ??
    result?.skipped ??
    null;

  if (created == null && skipped == null) {
    return 'Импорт CSV завершён';
  }

  const parts = [];
  if (created != null) parts.push(`создано: ${created}`);
  if (skipped != null) parts.push(`пропущено: ${skipped}`);

  return `Импорт завершён, ${parts.join(', ')}`;
}

export default function AllMaterialsContent({
  search,
  materials,
  filteredMaterials,
  filters,
  setFilters,
  pureCollections,
  availableTags,
  activeItemId,
  onSelectItem,
  onContextMenuAll,
  onKebabAll,
  renamingKey,
  onRenameSubmit,
  onRenameCancel,
  onImportCompleted,
}) {
  const { show: showToast } = useToast();
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const visible = useMemo(
    () => filterFlat(filteredMaterials, search),
    [filteredMaterials, search],
  );

  const summary = useMemo(
    () => buildSummary(visible, pureCollections, availableTags),
    [visible, pureCollections, availableTags],
  );

  const filtersActive = !isFiltersEmpty(filters);

  const unsupportedServerFilters =
    !!filters.onlyImportant ||
    !!filters.kind ||
    !!filters.dateFrom ||
    !!filters.dateTo ||
    (filters.period && filters.period !== 'all');

  const handleExport = useCallback(async () => {
    try {
      setExporting(true);

      const { blob, filename } = await materialsApi.exportCsv({
        q: search,
        collectionId: filters.collectionId,
        tagIds: filters.tagIds,
      });

      saveBlob(blob, filename);

      showToast({
        message: 'CSV экспортирован',
        type: 'success',
        duration: 2500,
      });
    } catch (err) {
      showToast({
        message: err?.message || 'Не удалось экспортировать CSV',
        type: 'error',
        duration: 3500,
      });
    } finally {
      setExporting(false);
    }
  }, [filters.collectionId, filters.tagIds, search, showToast]);

  const handleImport = useCallback(
    async ({ collectionId, file }) => {
      const result = await materialsApi.importCsv({ collectionId, file });
      await onImportCompleted?.();

      showToast({
        message: buildImportMessage(result),
        type: 'success',
        duration: 3500,
      });
    },
    [onImportCompleted, showToast],
  );

  return (
    <>
      <FiltersBar filters={filters} onChange={setFilters} />

      <MaterialsSummaryPanel
        summary={summary}
        onExport={handleExport}
        onImport={() => setImportOpen(true)}
        canImport={pureCollections.length > 0}
        exporting={exporting}
        note={
          unsupportedServerFilters
            ? 'Важно: CSV-экспорт сейчас учитывает только поиск, коллекцию и теги.'
            : ''
        }
      />

      {materials.length > 0 && visible.length === 0 && (
        <EmptyState
          icon={IoSearchOutline}
          title="Ничего не подходит"
          description={
            search
              ? `По запросу «${search}» ничего не найдено.`
              : 'Под текущие фильтры ничего не подходит.'
          }
          size="sm"
          actionLabel={filtersActive ? 'Сбросить фильтры' : undefined}
          onAction={
            filtersActive
              ? () =>
                  setFilters({
                    collectionId: null,
                    tagIds: [],
                    onlyImportant: false,
                    kind: null,
                    dateFrom: null,
                    dateTo: null,
                    period: 'all',
                  })
              : undefined
          }
        />
      )}

      {visible.map((item) => (
        <TreeItem
          key={item.id}
          item={item}
          section="all"
          activeItemId={activeItemId}
          onItemClick={(it) => onSelectItem?.(it.id, 'document')}
          onContextMenu={onContextMenuAll}
          onKebabMenu={onKebabAll}
          renamingKey={renamingKey}
          onRenameSubmit={onRenameSubmit}
          onRenameCancel={onRenameCancel}
          draggable
        />
      ))}

      <ImportMaterialsCsvModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        collections={pureCollections}
        onSubmit={handleImport}
        initialCollectionId={filters.collectionId}
      />
    </>
  );
}